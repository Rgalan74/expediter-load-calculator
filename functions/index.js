/**
 * functions/index.js
 * Cloud Functions para Expediter / Smart Load Solution
 *
 * stripeWebhook — maneja eventos de Stripe:
 *   - checkout.session.completed    → activa plan en Firestore + Meta Purchase
 *   - customer.subscription.created → confirma plan activo
 *   - invoice.payment_succeeded     → renueva plan (pagos recurrentes)
 *   - customer.subscription.updated → notifica downgrade/cancelación/cambio de plan
 *   - customer.subscription.deleted → baja plan a free
 *
 * Usa Express con express.raw() para capturar el body exacto antes del parsing
 * y permitir la verificación de firma HMAC de Stripe.
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const express = require("express");
const Stripe = require("stripe");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// ─── Constantes ────────────────────────────────────────────────────────────────
const META_PIXEL_ID = "1227322958231625";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const IS_TEST_MODE = false; // LIVE MODE

// Mapeo inverso: Stripe Price ID → plan ID interno
// ⚠️ Solo precios LIVE de producción. Los precios de test no deben estar aquí.
const PRICE_TO_PLAN = {
    // TEST MODE (Stripe test keys)
    "price_1TBCyEPrcqI2pVW0vcn6xbxd": "professional",
    "price_1TBCzcPrcqI2pVW07PAeFG9I": "premium",
    // LIVE MODE
    "price_1T4CmZPrcqI2pVW0wjZkexA8": "professional", // $14.99/mes
    "price_1T4CpaPrcqI2pVW0EgoJJq6Q": "premium",       // $29.99/mes
};

// ─── Express app — captura raw body antes de cualquier parsing ────────────────
const app = express();
app.use(express.raw({ type: "application/json" }));

app.post("/", async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    let event;
    const rawBody = req.rawBody; // Buffer preservado por Firebase rawBody: true

    if (IS_TEST_MODE) {
        try {
            event = JSON.parse(rawBody.toString("utf8"));
        } catch (e) {
            event = rawBody;
        }
        logger.info("[stripeWebhook] TEST MODE - saltando verificación de firma");
    } else {
        const sig = req.headers["stripe-signature"];
        if (!sig || !STRIPE_WEBHOOK_SECRET) {
            logger.error("[stripeWebhook] Falta stripe-signature o STRIPE_WEBHOOK_SECRET");
            res.status(400).send("Missing signature");
            return;
        }
        const stripe = new Stripe(STRIPE_SECRET_KEY);
        try {
            event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            logger.error("[stripeWebhook] Firma inválida:", err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }
    }

    logger.info("[stripeWebhook] ✅ Evento recibido:", event.type);

    try {
        switch (event.type) {

            case "checkout.session.completed": {
                const session = event.data.object;
                logger.info("[stripeWebhook] Checkout completado:", session.id);

                // Si es un upgrade, cancelar la suscripción anterior inmediatamente
                const oldSubId = session.metadata?.upgrading_from_subscription;
                if (oldSubId) {
                    // metadata la escribe el cliente: verificar en Stripe que esa
                    // suscripcion es del MISMO customer que pago este checkout (y que
                    // no es la recien creada) antes de cancelarla. Sin esto, cualquiera
                    // podia cancelar la suscripcion de otro usuario pasando su ID.
                    const ownsOldSub = await subscriptionBelongsToCustomer(oldSubId, session.customer);
                    if (ownsOldSub && oldSubId !== session.subscription) {
                        logger.info("[stripeWebhook] Upgrade detectado — cancelando suscripción antigua:", oldSubId);
                        await cancelStripeSubscription(oldSubId);
                    } else {
                        logger.warn("[stripeWebhook] upgrading_from_subscription ignorado (no pertenece al customer del checkout):", oldSubId, "customer:", session.customer);
                    }
                }

                await sendMetaPurchaseEvent(session);
                break;
            }

            case "customer.subscription.created": {
                const sub = event.data.object;
                logger.info("[stripeWebhook] Suscripción creada:", sub.id, "status:", sub.status);
                // No activar aquí — la suscripción llega como "incomplete" hasta que se confirma el pago
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object;
                logger.info("[stripeWebhook] Pago exitoso:", invoice.id, "reason:", invoice.billing_reason);

                // Activar en creación y en renovación
                if (invoice.billing_reason === "subscription_cycle" || invoice.billing_reason === "subscription_create") {
                    const lineItem = invoice.lines?.data?.[0];

                    // Nueva API Stripe (2025+): precio en pricing.price_details.price
                    const priceId =
                        lineItem?.pricing?.price_details?.price ||
                        lineItem?.price?.id ||
                        null;
                    const planId = PRICE_TO_PLAN[priceId];
                    const firebaseId = await getFirebaseIdFromCustomer(invoice.customer);

                    logger.info("[stripeWebhook] priceId:", priceId, "→ planId:", planId, "firebaseId:", firebaseId);

                    if (planId && firebaseId) {
                        // Nueva API Stripe (2025-03-31.basil+): invoice.subscription quedo
                        // obsoleto, reemplazado por invoice.parent.subscription_details.subscription
                        // (ver changelog de Stripe: "adds new parent field to invoicing objects").
                        // Sin este fallback, subscriptionId llegaba null a activateUserPlan()
                        // y el plan se activaba bien pero users/{uid}.subscriptionId nunca
                        // se escribia -- rompiendo cancelUserSubscription() mas adelante.
                        const subscriptionId =
                            invoice.subscription ||
                            invoice.parent?.subscription_details?.subscription ||
                            null;
                        await activateUserPlan(firebaseId, planId, subscriptionId);

                        // Enviar email HTML de confirmación de pago
                        const userEmail = invoice.customer_email;
                        const planMeta = {
                            professional: { name: "Professional", price: "14.99" },
                            premium:      { name: "Premium + AI", price: "29.99" },
                        };
                        // Solo en el primer pago: en subscription_cycle (renovacion
                        // mensual) este mismo email de "Bienvenido" se mandaba cada mes.
                        if (invoice.billing_reason === "subscription_create" && userEmail && planMeta[planId]) {
                            const lang = await getUserLang(firebaseId);
                            await queueEmail(userEmail, EMAILS.planActivated(planId, lang))
                                .catch(e => logger.warn("[stripeWebhook] Email no enviado:", e.message));
                        }
                    } else {
                        logger.warn("[stripeWebhook] No se activó — priceId:", priceId, "planId:", planId, "firebaseId:", firebaseId);
                    }
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object;
                const previousAttributes = event.data.previous_attributes;
                const firebaseUid = subscription.metadata?.firebaseId || null;

                if (!firebaseUid) {
                    logger.warn("[stripeWebhook] subscription.updated sin firebaseId");
                    break;
                }

                // Reusar PRICE_TO_PLAN global para evitar desincronización
                const PLAN_NAMES = { 'professional': 'Professional', 'premium': 'Premium + AI' };

                const newPriceId = subscription.items?.data?.[0]?.price?.id;
                const oldPriceId = previousAttributes?.items?.data?.[0]?.price?.id;
                const newPlanId = PRICE_TO_PLAN[newPriceId] || null;
                const oldPlanId = PRICE_TO_PLAN[oldPriceId] || null;

                const scheduleCreated = subscription.schedule && !previousAttributes?.schedule;
                const priceChanged = oldPriceId && newPriceId && oldPriceId !== newPriceId;

                logger.info("[stripeWebhook] subscription.updated — schedule:", scheduleCreated, "priceChanged:", priceChanged, "old:", oldPlanId, "new:", newPlanId);

                if (scheduleCreated) {
                    const periodEndRaw = subscription.current_period_end;
                    const periodEnd = periodEndRaw ? new Date(periodEndRaw * 1000) : null;
                    const lang = await getUserLang(firebaseUid);
                    const locale = lang === 'en' ? 'en-US' : 'es-US';
                    const fechaFin = periodEnd
                        ? periodEnd.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
                        : (lang === 'en' ? 'the end date' : 'la fecha de vencimiento');
                    await sendEmailByUid(firebaseUid, EMAILS.downgradeScheduled(fechaFin, lang));
                    logger.info("[stripeWebhook] ✅ Email downgrade programado uid:", firebaseUid);
                }

                // Detectar cancelación programada
                const cancelScheduled =
                    subscription.cancel_at_period_end === true &&
                    previousAttributes?.cancel_at_period_end === false;

                if (cancelScheduled) {
                    const periodEndRaw = subscription.current_period_end;
                    const periodEnd = periodEndRaw
                        ? new Date(periodEndRaw * 1000)
                        : (subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null);
                    const lang = await getUserLang(firebaseUid);
                    const locale = lang === 'en' ? 'en-US' : 'es-US';
                    const fechaFin = periodEnd
                        ? periodEnd.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
                        : (lang === 'en' ? 'the end date' : 'la fecha de vencimiento');
                    await sendEmailByUid(firebaseUid, EMAILS.cancellationScheduled(fechaFin, newPlanId || oldPlanId || 'professional', lang));
                    logger.info("[stripeWebhook] ✅ Email cancelación programada uid:", firebaseUid);
                }

                if (priceChanged && newPlanId) {
                    const isDowngrade = PRICE_TO_PLAN[oldPriceId] === 'premium' && newPlanId === 'professional';
                    const planName = PLAN_NAMES[newPlanId];
                    const planPrice = newPlanId === 'premium' ? '29.99' : '14.99';
                    const lang = await getUserLang(firebaseUid);
                    await sendEmailByUid(firebaseUid, isDowngrade ? EMAILS.planDowngraded(lang) : EMAILS.planActivated(newPlanId, lang));
                    logger.info("[stripeWebhook] ✅ Email cambio de plan enviado:", planName, "uid:", firebaseUid);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const sub = event.data.object;
                logger.info("[stripeWebhook] Suscripción cancelada:", sub.id);

                const firebaseId = await getFirebaseIdFromCustomer(sub.customer);
                if (firebaseId) {
                    const bajado = await downgradeUserPlan(firebaseId, sub.customer, sub.id);
                    if (bajado) {
                        const lang = await getUserLang(firebaseId);
                        await sendEmailByUid(firebaseId, EMAILS.planEnded(lang))
                            .catch(e => logger.warn("[stripeWebhook] Email plan terminado no enviado:", e.message));
                    }
                }
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object;
                logger.info("[stripeWebhook] Pago fallido:", invoice.id, "reason:", invoice.billing_reason, "intento:", invoice.attempt_count);
                // Solo renovaciones: en el primer pago el usuario ve el error en el checkout
                if (invoice.billing_reason !== "subscription_cycle") break;
                const firebaseId = await getFirebaseIdFromCustomer(invoice.customer);
                if (!firebaseId) break;
                const uref = db.collection("users").doc(firebaseId);
                const udata = (await uref.get()).data() || {};
                // Un aviso cada 48 h como máximo (Stripe reintenta varias veces)
                const ultimo = udata.paymentFailedEmailAt?.toDate?.() || null;
                if (ultimo && Date.now() - ultimo.getTime() < 48 * 3600 * 1000) break;
                const lineItem = invoice.lines?.data?.[0];
                const priceId = lineItem?.pricing?.price_details?.price || lineItem?.price?.id || null;
                const planId = PRICE_TO_PLAN[priceId] || udata.plan || 'professional';
                const lang = await getUserLang(firebaseId);
                await sendEmailByUid(firebaseId, EMAILS.paymentFailed(planId, lang));
                await uref.set({ paymentFailedEmailAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                break;
            }

            default:
                logger.info("[stripeWebhook] Evento no manejado:", event.type);
        }
    } catch (err) {
        logger.error("[stripeWebhook] Error procesando evento:", event.type, err.message);
        // Responder 500 para que Stripe REINTENTE: si activateUserPlan() o
        // downgradeUserPlan() fallan por un error transitorio y contestamos
        // 200, el evento se pierde y el cliente queda pagando sin su plan.
        // Los handlers son idempotentes (set con merge), asi que reintentar es seguro.
        res.status(500).json({ received: false });
        return;
    }

    res.status(200).json({ received: true });
});

// ─── Export ────────────────────────────────────────────────────────────────────
exports.stripeWebhook = onRequest(
    {
        cors: false,
        rawBody: true,
        secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY", "META_ACCESS_TOKEN"]
    },
    app
);

// ============================================================
// evaluateLoad — Motor de decisión en servidor (OCULTO)
// © 2026 SmartLoad Solution — Ricardo Galan. All rights reserved.
// @fingerprint SLS-2026-RG74-EXPEDITER
// ============================================================
const ZONAS_PREMIUM      = new Set(['IL', 'WI', 'MI']);
const ZONAS_MEDIO        = new Set(['MN', 'IN', 'OH', 'PA', 'AR', 'TN', 'GA', 'KY', 'MO', 'IA', 'KS', 'VA', 'WV']);
const ZONAS_MEDIO_DIFICIL = new Set(['GA', 'TN', 'KY']);
const ZONAS_TRAP         = new Set(['FL', 'TX', 'NM', 'AZ', 'NV', 'CA', 'OR', 'WA',
    'ID', 'MT', 'WY', 'UT', 'CO', 'ND', 'SD', 'NE',
    'NC', 'SC', 'MD', 'DE', 'NJ', 'NY', 'CT', 'MA', 'RI', 'NH', 'VT', 'ME',
    'AL', 'MS', 'LA', 'OK']);

function _clasificarZona(state) {
    if (!state) return 'DESCONOCIDA';
    if (ZONAS_PREMIUM.has(state))       return 'PREMIUM';
    if (ZONAS_MEDIO_DIFICIL.has(state)) return 'MEDIO_DIFICIL';
    if (ZONAS_MEDIO.has(state))         return 'MEDIO';
    if (ZONAS_TRAP.has(state))          return 'TRAP';
    return 'DESCONOCIDA';
}

function _getUmbrales(origenZona, destinoZona, millas) {
    if (origenZona === 'PREMIUM' && destinoZona === 'TRAP') {
        return { acepta: Infinity, evalua: Infinity, razon: 'TRAP zone — you will lose days repositioning' };
    }
    if (origenZona === 'PREMIUM') {
        if (destinoZona === 'MEDIO_DIFICIL') return { acepta: 1.26, evalua: null, razon: 'Hard zone to exit, local loads pay $0.80-0.90' };
        if (millas < 100)  return { acepta: 3.75, evalua: 2.50, pisoAbsoluto: 375, razon: 'Very short load — floor $375' };
        if (millas < 200)  return { acepta: 2.00, evalua: 1.50, pisoAbsoluto: 400, razon: 'Short load — floor $400' };
        if (millas < 400)  return { acepta: 1.30, evalua: 1.13, pisoAbsoluto: 450, razon: 'Medium load from Premium zone' };
        if (millas < 600)  return { acepta: 1.10, evalua: 0.92, pisoAbsoluto: 550, razon: 'Long load from Premium zone' };
        return { acepta: 1.00, evalua: 0.88, pisoAbsoluto: 700, razon: 'Very long load from Premium zone' };
    }
    if ((origenZona === 'MEDIO' || origenZona === 'MEDIO_DIFICIL') && destinoZona === 'PREMIUM') {
        if (millas < 300) return { acepta: 1.43, evalua: 1.09, pisoAbsoluto: 250, razon: 'Short load toward Premium zone' };
        return { acepta: 1.07, evalua: 0.90, razon: 'Repositions you in Premium zone' };
    }
    if (origenZona === 'MEDIO' || origenZona === 'MEDIO_DIFICIL') {
        if (destinoZona === 'TRAP') return { acepta: 1.25, evalua: 1.00, razon: 'TRAP destination — charge premium' };
        if (millas < 300) return { acepta: 1.43, evalua: 1.09, pisoAbsoluto: 250, razon: 'Short load from Medium zone' };
        return { acepta: 1.00, evalua: 0.85, razon: 'Load from Medium zone' };
    }
    if (origenZona === 'TRAP') {
        if (destinoZona === 'PREMIUM' || destinoZona === 'MEDIO')
            return { acepta: 0.87, evalua: 0.69, razon: 'Exiting TRAP — accept to reposition' };
        return { acepta: 0.90, evalua: 0.80, razon: 'Within TRAP zone' };
    }
    return { acepta: 1.00, evalua: 0.80, razon: 'General threshold' };
}

exports.evaluateLoad = onCall(
    { region: 'us-central1' },
    async (request) => {
        // Verificar autenticación
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const uid  = request.auth.uid;
        const data = request.data || {};

        // Extraer y validar parámetros
        const rpm    = Number(data.rpm)    || 0;
        const millas = Number(data.millas) || 0;
        const origenState  = (data.origenState  || '').toUpperCase().trim();
        const destinoState = (data.destinoState || '').toUpperCase().trim();

        if (rpm <= 0 || millas <= 0) {
            throw new HttpsError('invalid-argument', 'rpm and millas must be positive numbers');
        }

        // Leer perfil de Lex y configuración del usuario desde Firestore
        let cpm = 0.534;         // default
        let avgRPM = 0;
        let targetProfitPct = 0.20;
        let stateStats = {};

        try {
            const [userSnap, lexSnap] = await Promise.all([
                db.collection('users').doc(uid).get(),
                db.collection('lexProfiles').doc(uid).get()
            ]);

            if (userSnap.exists) {
                const costs = userSnap.data().costs || {};
                cpm = Number(costs.totalCPM || costs.total) || 0.534;
                const tp = userSnap.data().targetProfit;
                if (tp && tp > 0) targetProfitPct = tp / 100;
            }

            if (lexSnap.exists) {
                avgRPM = lexSnap.data().avgRPM || 0;
                stateStats = lexSnap.data().stateStats || {};
            }
        } catch (e) {
            logger.warn('[evaluateLoad] Error leyendo perfil:', e.message);
        }

        // ── Lógica de zonas ──────────────────────────────────────────────
        const origenZona  = _clasificarZona(origenState);
        const destinoZona = _clasificarZona(destinoState);
        const umbrales    = _getUmbrales(origenZona, destinoZona, millas);

        // ── Thresholds dinámicos ─────────────────────────────────────────
        const targetRPM    = cpm / (1 - targetProfitPct);
        const acceptThresh = targetRPM; // D5: RPM historico solo referencia, no cambia el umbral
        const midThresh    = targetRPM; // D5: RPM historico solo referencia, no cambia el umbral

        // ── Decisión — 4 zonas ───────────────────────────────────────────
        let decision, level, icon, razon;

        // Piso absoluto (cargas muy cortas)
        const pisoAbsoluto = umbrales.pisoAbsoluto || 0;
        const totalCharge  = rpm * millas;
        if (pisoAbsoluto > 0 && totalCharge < pisoAbsoluto) {
            decision = 'REJECT';
            level    = 'reject';
            icon     = '❌';
            razon    = `Total $${totalCharge.toFixed(0)} below minimum floor $${pisoAbsoluto} for this distance`;
        } else if (rpm < cpm) {
            decision = 'REJECT';
            level    = 'reject';
            icon     = '❌';
            const perdida = ((cpm - rpm) * 100).toFixed(1);
            razon = `Losing $${perdida} per 100mi — RPM $${rpm.toFixed(3)} doesn't cover cost $${cpm.toFixed(3)}/mi`;
        } else if (rpm >= acceptThresh && rpm >= umbrales.acepta) {
            decision = 'ACCEPT';
            level    = 'accept';
            icon     = '✅';
            const margen = (((rpm - cpm) / rpm) * 100).toFixed(1);
            razon = `Margin ${margen}% — earning $${((rpm - cpm) * 100).toFixed(0)} per 100mi. ${umbrales.razon}`;
        } else if (rpm >= midThresh && (!umbrales.evalua || rpm >= umbrales.evalua)) {
            decision = 'ALMOST ACCEPT';
            level    = 'warning-high';
            icon     = '🟡';
            const margen = (((rpm - cpm) / rpm) * 100).toFixed(1);
            const falta  = ((acceptThresh - rpm) * 100).toFixed(1);
            razon = `Margin ${margen}% — $${falta}¢/100mi short of target. ${umbrales.razon}`;
        } else {
            decision = 'EVALUATE';
            level    = 'warning-low';
            icon     = '🟠';
            const margen = (((rpm - cpm) / rpm) * 100).toFixed(1);
            razon = `Margin ${margen}% — covers costs but below threshold. ${umbrales.razon}`;
        }

        // Contexto histórico del estado destino
        if (destinoState && stateStats[destinoState]?.loads >= 2) {
            const stats = stateStats[destinoState];
            const diff  = ((rpm - stats.avgRPM) / stats.avgRPM * 100).toFixed(1);
            const signo = diff >= 0 ? '+' : '';
            razon += ` | ${destinoState}: your avg $${stats.avgRPM.toFixed(3)}/mi (${signo}${diff}%)`;
        }

        logger.info(`[evaluateLoad] uid:${uid} rpm:${rpm} millas:${millas} → ${decision}`);

        return {
            decision,
            level,
            icon,
            razon,
            confianza: (level === 'accept' || level === 'reject') ? 'Alta' : 'Media',
            thresholds: { cpm, midThresh, acceptThresh, avgRPM, targetProfitPct },
            zonas: { origenZona, destinoZona }
        };
    }
);

// ─── Crear una carga nueva con limite de plan aplicado (callable) ────────────
// Unico camino legitimo para crear un documento en `loads` -- firestore.rules
// bloquea la escritura directa del cliente (ver Task 4 del plan). Duplica
// deliberadamente los numeros de limite de public/js/userPlans.js (mismo
// patron ya usado en este archivo para ACADEMY_MODULE_LESSONS): si esos
// numeros cambian alli, deben actualizarse aqui tambien.
const PLAN_LOAD_LIMITS = { free: 30, professional: -1, premium: -1, admin: -1 };

// userId no esta aqui: siempre se sobreescribe con request.auth.uid (linea ~535),
// nunca se confia en el valor del cliente, asi que tampoco se exige en el payload.
const LOAD_REQUIRED_FIELDS = ['origin', 'destination', 'totalMiles', 'rpm', 'totalCharge'];

function _validateLoadPayload(data) {
    for (const field of LOAD_REQUIRED_FIELDS) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            throw new HttpsError('invalid-argument', `Missing required field: ${field}`);
        }
    }
    const rpm = Number(data.rpm);
    const totalMiles = Number(data.totalMiles);
    const totalCharge = Number(data.totalCharge);
    if (!(rpm >= 0 && rpm <= 50)) throw new HttpsError('invalid-argument', 'rpm out of bounds');
    if (!(totalMiles >= 0 && totalMiles <= 10000)) throw new HttpsError('invalid-argument', 'totalMiles out of bounds');
    if (!(totalCharge >= 0 && totalCharge <= 500000)) throw new HttpsError('invalid-argument', 'totalCharge out of bounds');
}

// Replica exactamente la logica de resolucion de plan de getUserPlan() en
// public/js/userPlans.js: si el usuario es admin, plan=admin; si tiene una
// suscripcion activa de Stripe, esa suscripcion manda (mapeada via
// PRICE_TO_PLAN) sobre el campo `plan` del documento, que puede estar
// desactualizado; si no, se usa el campo `plan` directamente.
async function _resolveUserPlan(uid, userData, transaction = null) {
    if (userData.role === 'admin') return 'admin';

    const subscriptions = db.collection('customers').doc(uid)
        .collection('subscriptions').where('status', '==', 'active');
    const subsSnap = transaction ? await transaction.get(subscriptions) : await subscriptions.get();

    const PLAN_PRIORITY = { free: 0, professional: 1, premium: 2, admin: 3 };
    let planId = null;
    let bestPriority = -1;
    subsSnap.forEach(doc => {
        const priceId = doc.data().items?.[0]?.price?.id;
        const docPlanId = PRICE_TO_PLAN[priceId] || 'free';
        const priority = PLAN_PRIORITY[docPlanId] ?? 0;
        if (priority > bestPriority) {
            bestPriority = priority;
            planId = docPlanId;
        }
    });

    return planId || userData.plan || 'free';
}

exports.createLoad = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const uid = request.auth.uid;
        const data = request.data || {};

        _validateLoadPayload(data);

        const userRef = db.collection('users').doc(uid);
        const newLoadRef = db.collection('loads').doc();

        // Resolver el plan (puede requerir leer suscripciones de Stripe) antes
        // de la transaccion -- no necesita ser transaccionalmente consistente
        // con el contador, solo la creacion de la carga + el contador si.
        const preSnap = await userRef.get();
        const preUserData = preSnap.exists ? preSnap.data() : {};
        const planId = await _resolveUserPlan(uid, preUserData);
        const maxLoads = PLAN_LOAD_LIMITS[planId] ?? PLAN_LOAD_LIMITS.free;

        const result = await db.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            const userData = userSnap.exists ? userSnap.data() : {};

            const now = new Date();
            const monthStart = userData.monthStartDate ? new Date(userData.monthStartDate) : null;
            const sameMonth = !!monthStart &&
                now.getMonth() === monthStart.getMonth() &&
                now.getFullYear() === monthStart.getFullYear();
            const currentCount = sameMonth ? Number(userData.loadsThisMonth || 0) : 0;

            if (maxLoads !== -1 && currentCount >= maxLoads) {
                throw new HttpsError('resource-exhausted', 'Límite de cargas del mes alcanzado');
            }

            const loadData = {
                ...data,
                userId: uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            tx.set(newLoadRef, loadData);

            if (sameMonth) {
                tx.update(userRef, {
                    loadsThisMonth: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                tx.set(userRef, {
                    loadsThisMonth: 1,
                    monthStartDate: now.toISOString(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            return { id: newLoadRef.id, newCount: currentCount + 1 };
        });

        if (maxLoads !== -1 && result.newCount >= maxLoads) {
            const mes = new Date().toISOString().slice(0, 7);
            if (preUserData.limitEmailMonth !== mes) {
                try {
                    await userRef.set({ limitEmailMonth: mes }, { merge: true });
                    const lang = preUserData.preferredLanguage === 'en' ? 'en' : 'es';
                    await sendEmailByUid(uid, EMAILS.loadLimit(lang, maxLoads));
                } catch (e) { logger.warn('[createLoad] Aviso de límite no enviado:', e.message); }
            }
        }

        return { id: result.id };
    }
);

// ============================================================
// sendWelcomeEmail — la app lo llama justo después de registrarse.
// El correo se arma en el servidor y sale una sola vez por cuenta.
// ============================================================
exports.sendWelcomeEmail = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
        const uid = request.auth.uid;
        const email = request.auth.token.email;
        if (!email) return { sent: false };
        const ref = db.collection('users').doc(uid);
        const enviar = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (snap.exists && snap.data().welcomeEmailSentAt) return null;
            tx.set(ref, { welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return snap.exists ? snap.data() : {};
        });
        if (!enviar) return { sent: false };
        const lang = (request.data && request.data.lang === 'en') || enviar.preferredLanguage === 'en' ? 'en' : 'es';
        await queueEmail(email, EMAILS.welcome(lang, enviar.fullName || ''));
        return { sent: true };
    }
);

// ============================================================
// lifecycleEmails — diario. Avisa 2 días antes de que termine la prueba
// de 14 días de Lex a quien sigue en el plan gratis (una vez por cuenta).
// ============================================================
exports.lifecycleEmails = onSchedule(
    { schedule: '0 15 * * *', timeZone: 'America/New_York', region: 'us-central1' },
    async () => {
        const ahora = Date.now();
        const desde = new Date(ahora + 1 * 24 * 3600 * 1000).toISOString();
        const hasta = new Date(ahora + 3 * 24 * 3600 * 1000).toISOString();
        const snap = await db.collection('users')
            .where('lexTrialEndsAt', '>=', desde)
            .where('lexTrialEndsAt', '<=', hasta)
            .get();
        let enviados = 0;
        for (const d of snap.docs) {
            const u = d.data() || {};
            if (u.lexTrialEndingEmailAt) continue;
            if (['professional', 'premium', 'admin'].includes(u.plan) || u.role === 'admin') continue;
            try {
                const lang = u.preferredLanguage === 'en' ? 'en' : 'es';
                const fecha = new Date(u.lexTrialEndsAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-US', { year: 'numeric', month: 'long', day: 'numeric' });
                await d.ref.set({ lexTrialEndingEmailAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                await sendEmailByUid(d.id, EMAILS.lexTrialEnding(lang, fecha));
                enviados++;
            } catch (e) { logger.warn('[lifecycleEmails] Error con', d.id, e.message); }
        }
        logger.info(`[lifecycleEmails] Aviso de fin de prueba de Lex: ${enviados} de ${snap.size}`);
    }
);

// ============================================================
// lexDailyAlerts — Alertas proactivas de Lex (Phase 5)
// Corre diariamente. Escribe en alerts/{uid} si detecta:
//   1. 2+ días sin registrar una carga (usuario activo con historial)
//   2. RPM semanal bajó ≥15% vs la semana anterior (mín. 2 cargas c/u)
// El cliente lee alerts/{uid} al abrir el chat y muestra los mensajes.
// ============================================================
exports.lexDailyAlerts = onSchedule(
    { schedule: "every 24 hours", timeZone: "America/Chicago", maxInstances: 1 },
    async () => {
        const now       = new Date();
        const todayKey  = now.toISOString().split('T')[0];
        const ms        = (d) => d * 86400000;
        const dateStr   = (d) => d.toISOString().split('T')[0];
        const cutoff2   = dateStr(new Date(now - ms(2)));
        const cutoff7   = dateStr(new Date(now - ms(7)));
        const cutoff14  = dateStr(new Date(now - ms(14)));
        const cutoff30  = dateStr(new Date(now - ms(30)));
        // Usuarios activos = lexProfile actualizado en los últimos 30 días
        const cutoff30Ts = admin.firestore.Timestamp.fromDate(new Date(now - ms(30)));
        const profilesSnap = await db.collection('lexProfiles')
            .where('lastUpdated', '>=', cutoff30Ts)
            .get();

        if (profilesSnap.empty) {
            logger.info('[lexDailyAlerts] No active users.');
            return;
        }

        let alertsCreated = 0;

        for (const profileDoc of profilesSnap.docs) {
            const uid = profileDoc.id;
            try {
                // Leer alertas existentes y limpiar las leídas > 7 días
                const alertRef  = db.collection('alerts').doc(uid);
                const alertSnap = await alertRef.get();
                const existing  = alertSnap.exists ? (alertSnap.data().items || []) : [];
                const cleaned   = existing.filter(a =>
                    !(a.read && a.createdAt < cutoff7)
                );
                const seenIds   = new Set(cleaned.map(a => a.id));
                const newAlerts = [];

                // ── Alerta 1: 2+ días sin carga ───────────────────────────
                const noLoadId = `no_load_${todayKey}`;
                if (!seenIds.has(noLoadId)) {
                    const [recent, history] = await Promise.all([
                        db.collection('loads').where('userId','==',uid).where('date','>=',cutoff2).limit(1).get(),
                        db.collection('loads').where('userId','==',uid).where('date','>=',cutoff30).limit(1).get(),
                    ]);
                    if (recent.empty && !history.empty) {
                        newAlerts.push({ id: noLoadId, type: 'no_loads', createdAt: todayKey, read: false });
                    }
                }

                // ── Alerta 2: RPM semanal bajó ≥15% ──────────────────────
                const rpmDropId = `rpm_drop_${todayKey}`;
                if (!seenIds.has(rpmDropId)) {
                    const [thisWeek, lastWeek] = await Promise.all([
                        db.collection('loads').where('userId','==',uid).where('date','>=',cutoff7).get(),
                        db.collection('loads').where('userId','==',uid).where('date','>=',cutoff14).where('date','<',cutoff7).get(),
                    ]);
                    if (thisWeek.size >= 2 && lastWeek.size >= 2) {
                        const avg = (snap) => snap.docs.reduce((s,d) => s + (Number(d.data().rpm)||0), 0) / snap.size;
                        const avgThis = avg(thisWeek);
                        const avgLast = avg(lastWeek);
                        if (avgLast > 0 && avgThis > 0 && (avgLast - avgThis) / avgLast >= 0.15) {
                            newAlerts.push({
                                id: rpmDropId, type: 'rpm_drop',
                                dropPct: Math.round((avgLast - avgThis) / avgLast * 100),
                                avgThisWeek: Math.round(avgThis * 1000) / 1000,
                                avgLastWeek: Math.round(avgLast * 1000) / 1000,
                                createdAt: todayKey, read: false,
                            });
                        }
                    }
                }

                if (newAlerts.length > 0 || cleaned.length !== existing.length) {
                    await alertRef.set({
                        items: [...cleaned, ...newAlerts],
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    alertsCreated += newAlerts.length;
                }

            } catch (e) {
                logger.error(`[lexDailyAlerts] uid ${uid}:`, e.message);
            }
        }

        logger.info(`[lexDailyAlerts] Done — ${alertsCreated} alerts / ${profilesSnap.size} users.`);
    }
);

// ─── Cancelar suscripción del usuario (callable) ──────────────────────────────
exports.cancelUserSubscription = onCall(
    { secrets: ["STRIPE_SECRET_KEY"] },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError("unauthenticated", "Debes estar autenticado");
        if (!STRIPE_SECRET_KEY) throw new HttpsError("internal", "Stripe no configurado");

        const userDoc = await db.collection("users").doc(uid).get();
        const subscriptionId = userDoc.exists ? userDoc.data().subscriptionId : null;
        if (!subscriptionId) throw new HttpsError("not-found", "No se encontró suscripción activa");

        const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "cancel_at_period_end=true",
        });
        const result = await response.json();
        if (result.error) throw new HttpsError("internal", result.error.message);

        logger.info("[cancelUserSubscription] ✅ Cancelación programada:", subscriptionId, "uid:", uid);
        return { success: true };
    }
);

// ─── Eliminar la cuenta del usuario (callable) ────────────────────────────────
// Unico camino para borrar users/{uid}: firestore.rules ya no permite el
// delete desde el cliente (borrar y recrear el perfil reiniciaba el contador
// de cargas y permitia sembrar campos protegidos). Ademas cancela las
// suscripciones de Stripe ANTES de borrar nada, para no dejar a alguien
// pagando por una cuenta que ya no existe.
const DELETE_ACCOUNT_MAX_AUTH_AGE_SEC = 10 * 60;

// Colecciones con un documento por usuario (id = uid)
const USER_DOC_COLLECTIONS = ['lexProfiles', 'academyProgress', 'userPlans', 'alerts'];
// Colecciones donde cada documento lleva el campo userId (o uid)
const USER_FIELD_COLLECTIONS = [
    ['loads', 'userId'], ['expenses', 'userId'], ['notes', 'userId'],
    ['lexAnalyses', 'userId'], ['lexConversations', 'userId'], ['analytics', 'userId'],
    ['lexUsage', 'uid']
];

async function _deleteUserData(uid, email) {
    const writer = db.bulkWriter();
    const removed = {};
    for (const [col, field] of USER_FIELD_COLLECTIONS) {
        const snap = await db.collection(col).where(field, '==', uid).get();
        snap.forEach(d => writer.delete(d.ref));
        removed[col] = snap.size;
    }
    if (email) {
        const mailSnap = await db.collection('mail').where('to', 'array-contains', email).get();
        mailSnap.forEach(d => writer.delete(d.ref));
        removed.mail = mailSnap.size;
    }
    for (const col of USER_DOC_COLLECTIONS) {
        writer.delete(db.collection(col).doc(uid));
    }
    await writer.close();
    // users/{uid} con sus subcolecciones (p. ej. checkout_sessions)
    await db.recursiveDelete(db.collection('users').doc(uid));
    return removed;
}

exports.deleteUserAccount = onCall(
    { region: 'us-central1', secrets: ["STRIPE_SECRET_KEY"] },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

        // Misma proteccion que daba user.delete() en el cliente: exigir login reciente.
        const authTime = Number(request.auth.token?.auth_time || 0);
        if (!authTime || (Date.now() / 1000 - authTime) > DELETE_ACCOUNT_MAX_AUTH_AGE_SEC) {
            throw new HttpsError('failed-precondition', 'requires-recent-login');
        }

        const custSnap = await db.collection('customers').doc(uid).get();
        const stripeCustomerId = custSnap.exists ? (custSnap.data().stripeId || null) : null;

        if (stripeCustomerId) {
            if (!STRIPE_SECRET_KEY) throw new HttpsError('internal', 'Stripe not configured');
            const stripe = new Stripe(STRIPE_SECRET_KEY);
            try {
                const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 20 });
                const live = subs.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
                for (const s of live) {
                    await stripe.subscriptions.cancel(s.id);
                    logger.info(`[deleteUserAccount] Suscripcion cancelada: ${s.id} uid: ${uid}`);
                }
            } catch (e) {
                // No borrar la cuenta si no se pudo cancelar el cobro.
                logger.error(`[deleteUserAccount] No se pudo cancelar la suscripcion de ${uid}:`, e.message);
                throw new HttpsError('internal', 'Could not cancel the active subscription. Account was not deleted.');
            }
        }

        // Borrar TODOS los datos del usuario (lo que promete la pantalla de Mi Cuenta).
        // customers/{uid} y el cliente de Stripe los borra la extension al borrar Auth.
        const email = (await admin.auth().getUser(uid).catch(() => null))?.email || null;
        const removed = await _deleteUserData(uid, email);
        await admin.auth().deleteUser(uid);
        logger.info(`[deleteUserAccount] ✅ Cuenta eliminada: ${uid}`, removed);
        return { success: true };
    }
);

// ─── Lex AI: proxy a OpenRouter (callable) ────────────────────────────────────
// La API key de OpenRouter vive en appConfig/openrouter y SOLO se lee aqui,
// via Admin SDK. Antes el navegador la descargaba y llamaba a OpenRouter
// directo, asi que cualquier usuario autenticado podia copiarla. El acceso
// (plan premium/admin o trial) tambien se decide aqui, no en el cliente.
const LEX_TRIAL_DAYS = 14;
const LEX_MAX_MESSAGES = 12;
const LEX_MAX_TOTAL_CHARS = 60000;
const LEX_MAX_TOKENS = 600;
const LEX_DEFAULT_MODEL = 'google/gemini-2.5-flash-lite'; // antes deepseek/deepseek-chat
// Respaldo de pago (EE. UU.). Los modelos gratis de OpenRouter pueden guardar o entrenar con los mensajes.
const LEX_FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';
const LEX_CONFIG_TTL_MS = 5 * 60 * 1000;
let _lexConfigCache = { at: 0, data: null };

async function _getLexConfig() {
    if (_lexConfigCache.data && (Date.now() - _lexConfigCache.at) < LEX_CONFIG_TTL_MS) {
        return _lexConfigCache.data;
    }
    const snap = await db.collection('appConfig').doc('openrouter').get();
    const data = snap.exists ? snap.data() : {};
    _lexConfigCache = { at: Date.now(), data };
    return data;
}

// El trial se calcula desde la fecha de creacion de la cuenta en Firebase Auth
// (no falsificable), no desde users/{uid}.lexTrialEndsAt, que escribe el cliente.
// Devuelve 'admin' | 'premium' | 'trial' | 'pro' | null (sin acceso).
// Pro tiene Lex con limite diario pequeno; durante el trial conserva el limite del trial.
async function _lexAccessTier(uid) {
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const planId = await _resolveUserPlan(uid, userData);
    if (planId === 'premium' || planId === 'admin') return planId;

    const authUser = await admin.auth().getUser(uid);
    const createdMs = new Date(authUser.metadata.creationTime).getTime();
    if (!!createdMs && Date.now() < createdMs + LEX_TRIAL_DAYS * 86400000) return 'trial';
    return planId === 'professional' ? 'pro' : null;
}

// Limite diario de mensajes por usuario (control de costo y abuso).
// Dia segun hora de Nueva York; admin sin limite.
const LEX_DAILY_LIMITS = { trial: 25, pro: 10, premium: 150 };

function _lexDayKey(now = new Date()) {
    return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
}

async function _consumeLexDailyQuota(uid, tier) {
    const limit = LEX_DAILY_LIMITS[tier];
    if (!limit) return { limit: null, used: null };
    const day = _lexDayKey();
    const ref = db.collection('lexUsage').doc(`${uid}_${day}`);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const used = snap.exists ? Number(snap.data().count) || 0 : 0;
        if (used >= limit) {
            throw new HttpsError('resource-exhausted', 'lex-daily-limit', { limit, tier });
        }
        tx.set(ref, {
            uid, day, tier, count: used + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Para una politica TTL opcional: se puede borrar a los 30 dias
            expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 86400000)
        }, { merge: true });
        return { limit, used: used + 1 };
    });
}

async function _callOpenRouter(apiKey, model, messages, maxTokens, temperature) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://smartloadsolution.com',
            'X-Title': 'SmartLoad Lex AI',
        },
        // data_collection 'deny': OpenRouter solo usa proveedores que no guardan ni entrenan con los datos.
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, provider: { data_collection: 'deny' } }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'OpenRouter error');
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Empty completion');
    return { content, model: data.model || model, totalTokens: data.usage?.total_tokens || null };
}

exports.lexChat = onCall(
    { region: 'us-central1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

        const data = request.data || {};
        const rawMessages = Array.isArray(data.messages) ? data.messages : null;
        if (!rawMessages || rawMessages.length === 0 || rawMessages.length > LEX_MAX_MESSAGES) {
            throw new HttpsError('invalid-argument', 'Invalid messages');
        }
        let totalChars = 0;
        const messages = rawMessages.map(m => {
            const role = m && m.role;
            const content = m && m.content;
            if (!['system', 'user', 'assistant'].includes(role) || typeof content !== 'string') {
                throw new HttpsError('invalid-argument', 'Invalid message');
            }
            totalChars += content.length;
            return { role, content };
        });
        if (totalChars > LEX_MAX_TOTAL_CHARS) {
            throw new HttpsError('invalid-argument', 'Messages too long');
        }
        const maxTokens = Math.min(LEX_MAX_TOKENS, Math.max(1, Math.floor(Number(data.maxTokens) || LEX_MAX_TOKENS)));
        const tempNum = Number(data.temperature);
        const temperature = Number.isFinite(tempNum) ? Math.min(1, Math.max(0, tempNum)) : 0.4;

        const tier = await _lexAccessTier(uid);
        if (!tier) {
            throw new HttpsError('permission-denied', 'Lex AI requires the Pro or Premium plan, or an active trial');
        }
        await _consumeLexDailyQuota(uid, tier);

        const cfg = await _getLexConfig();
        const apiKey = cfg.apiKey;
        if (!apiKey) {
            logger.error('[lexChat] appConfig/openrouter.apiKey no configurado');
            throw new HttpsError('failed-precondition', 'Lex AI is not configured');
        }
        const model = cfg.model || LEX_DEFAULT_MODEL;

        try {
            let result;
            try {
                result = await _callOpenRouter(apiKey, model, messages, maxTokens, temperature);
            } catch (primaryErr) {
                if (model === LEX_FALLBACK_MODEL) throw primaryErr;
                logger.warn(`[lexChat] ${model} fallo (${primaryErr.message}) — usando fallback`);
                result = await _callOpenRouter(apiKey, LEX_FALLBACK_MODEL, messages, maxTokens, temperature);
            }
            logger.info(`[lexChat] uid:${uid} modelo:${result.model} tokens:${result.totalTokens}`);
            return { content: result.content, model: result.model };
        } catch (e) {
            logger.error(`[lexChat] uid:${uid} error:`, e.message);
            throw new HttpsError('unavailable', 'Lex AI is temporarily unavailable');
        }
    }
);

// ─── Activar plan en Firestore ─────────────────────────────────────────────────
async function activateUserPlan(firebaseId, planId, subscriptionId) {
    logger.info("[activateUserPlan]", firebaseId, "→", planId);
    await db.collection("users").doc(firebaseId).set({
        plan: planId,
        subscriptionStatus: "active",
        subscriptionId: subscriptionId || null,
        planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info("[activateUserPlan] ✅ Plan actualizado:", firebaseId, planId);
}

// ─── Bajar plan a free ─────────────────────────────────────────────────────────
async function downgradeUserPlan(firebaseId, customerId, deletedSubId) {
    const userDoc = await db.collection("users").doc(firebaseId).get();
    // Cuenta eliminada (deleteUserAccount cancela la sub y borra el perfil):
    // no recrear un users/{uid} huerfano con el set(merge) de mas abajo.
    if (!userDoc.exists) {
        logger.info(`[downgradeUserPlan] users/${firebaseId} no existe (cuenta eliminada) — ignorando`);
        return;
    }

    // Si la sub eliminada no coincide con la que está en Firestore, ignorar
    if (deletedSubId) {
        const currentSubId = userDoc.data().subscriptionId || null;
        if (currentSubId && currentSubId !== deletedSubId) {
            logger.info(`[downgradeUserPlan] Sub eliminada (${deletedSubId}) ≠ sub actual (${currentSubId}) — ignorando`);
            return;
        }
    }

    // Verificar si aún tiene suscripción activa antes de bajar a free
    if (customerId && STRIPE_SECRET_KEY) {
        const stripe = new Stripe(STRIPE_SECRET_KEY);
        const activeSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
            limit: 5,
        });
        if (activeSubs.data.length > 0) {
            logger.info(`[downgradeUserPlan] ${firebaseId} aún tiene ${activeSubs.data.length} sub(s) activa(s) — no se baja a free`);
            return false;
        }
    }

    logger.info("[downgradeUserPlan]", firebaseId, "→ free");
    await db.collection("users").doc(firebaseId).set({
        plan: "free",
        subscriptionStatus: "canceled",
        subscriptionId: null,
        planCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info("[downgradeUserPlan] ✅ Plan bajado a free:", firebaseId);
    return true;
}

// ─── Obtener Firebase UID desde Stripe Customer ID ────────────────────────────
async function getFirebaseIdFromCustomer(stripeCustomerId) {
    if (!stripeCustomerId) return null;
    try {
        // La Firebase Extension guarda el customer en customers/{uid}
        const snapshot = await db.collection("customers")
            .where("stripeId", "==", stripeCustomerId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        // Fallback: buscar en users por stripeCustomerId
        const usersSnap = await db.collection("users")
            .where("stripeCustomerId", "==", stripeCustomerId)
            .limit(1)
            .get();

        return usersSnap.empty ? null : usersSnap.docs[0].id;
    } catch (err) {
        logger.error("[getFirebaseIdFromCustomer] Error:", err.message);
        return null;
    }
}

// ─── Verificar que una suscripcion pertenece a un customer de Stripe ─────────
async function subscriptionBelongsToCustomer(subscriptionId, customerId) {
    if (!subscriptionId || !customerId || !STRIPE_SECRET_KEY) return false;
    try {
        const stripe = new Stripe(STRIPE_SECRET_KEY);
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const subCustomer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        return subCustomer === customerId;
    } catch (err) {
        logger.warn("[subscriptionBelongsToCustomer] No se pudo verificar:", subscriptionId, err.message);
        return false;
    }
}

// ─── Cancelar suscripción de Stripe vía REST (inmediato) ─────────────────────
async function cancelStripeSubscription(subscriptionId) {
    if (!STRIPE_SECRET_KEY) {
        logger.warn("[cancelStripeSubscription] STRIPE_SECRET_KEY no configurado — suscripción no cancelada:", subscriptionId);
        return;
    }
    try {
        const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        const result = await response.json();
        if (result.error) {
            logger.error("[cancelStripeSubscription] Error de Stripe:", result.error.message);
        } else {
            logger.info("[cancelStripeSubscription] ✅ Suscripción cancelada inmediatamente:", subscriptionId);
        }
    } catch (err) {
        logger.error("[cancelStripeSubscription] Fetch error:", err.message);
    }
}

// ─── Cancelar otras suscripciones activas del mismo customer ──────────────────
async function cancelOtherSubscriptions(customerId, keepSubscriptionId) {
    if (!STRIPE_SECRET_KEY) {
        logger.warn("[cancelOtherSubscriptions] STRIPE_SECRET_KEY no configurado — no se cancelaron subs duplicadas");
        return;
    }
    try {
        const response = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=10`,
            { headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        const data = await response.json();
        const others = (data.data || []).filter(s => s.id !== keepSubscriptionId);
        if (others.length === 0) return;
        logger.info("[cancelOtherSubscriptions] Cancelando", others.length, "sub(s) duplicada(s) para customer:", customerId);
        await Promise.all(others.map(s => cancelStripeSubscription(s.id)));
    } catch (err) {
        logger.error("[cancelOtherSubscriptions] Error:", err.message);
    }
}

// ─── Enviar evento Purchase a Meta Conversions API ────────────────────────────
async function sendMetaPurchaseEvent(session) {
    if (!META_ACCESS_TOKEN) {
        logger.error("[sendMetaPurchaseEvent] META_ACCESS_TOKEN no configurado");
        return;
    }

    const email = session.customer_details?.email || "";
    const hashedEmail = email
        ? crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex")
        : null;

    const eventPayload = {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: session.id,
        event_source_url: "https://smartloadsolution.com/app.html",
        action_source: "website",
        user_data: {
            em: hashedEmail ? [hashedEmail] : [],
        },
        custom_data: {
            value: ((session.amount_total || 0) / 100).toFixed(2),
            currency: (session.currency || "usd").toUpperCase(),
        },
    };

    const url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: [eventPayload] }),
        });

        const result = await response.json();

        if (result.error) {
            logger.error("[sendMetaPurchaseEvent] Error de Meta API:", result.error);
        } else {
            logger.info("[sendMetaPurchaseEvent] ✅ Purchase enviado a Meta:", result);
        }
    } catch (err) {
        logger.error("[sendMetaPurchaseEvent] ❌ Fetch error:", err.message);
    }
}

// ─── Correos: plantillas en ./emails.js; todos salen por la colección 'mail' ───
const EMAILS = require('./emails');
async function queueEmail(to, msg) {
    const dest = String(to || '').trim().toLowerCase();
    if (!dest || dest.endsWith('@example.com')) return false; // cuentas de prueba: no enviar
    await db.collection('mail').add({
        to: [dest],
        replyTo: 'support@smartloadsolution.com',
        message: { subject: msg.subject, html: msg.html },
    });
    return true;
}

// ─── Obtener idioma preferido del usuario ───────────────────────────────────────────────
async function getUserLang(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        return doc.data()?.preferredLanguage || 'en';
    } catch (e) {
        return 'en';
    }
}

// ─── Enviar email via Firestore ───────────────────────────────────────────────
async function sendEmailByUid(uid, { subject, html }) {
    // Obtener email desde Firebase Auth (fuente de verdad)
    let email;
    try {
        const authUser = await admin.auth().getUser(uid);
        email = authUser.email;
    } catch (e) {
        // Fallback: buscar en Firestore
        const userDoc = await db.collection('users').doc(uid).get();
        email = userDoc.data()?.email;
    }
    if (!email) { logger.warn("[sendEmailByUid] No email para uid:", uid); return; }
    await queueEmail(email, { subject, html });
    logger.info("[sendEmailByUid] ✅ Email enviado a:", email);
}

// ─── Template: activación de plan (NUEVO — faltaba) ──────────────────────────
// (Plantillas de correo: ver ./emails.js)


// ============================================================
// subscribeLead � Alta de lead en Brevo desde el backend (OCULTO)
// Recibe nombre + email + UTMs desde el frontend (calculadora RPM, home, etc.)
// y llama a la API de Brevo desde el servidor, donde la IP si esta autorizada.
// (c) 2026 SmartLoad Solution - Ricardo Galan.
// ============================================================
exports.subscribeLead = onCall(
    { region: 'us-central1', secrets: ["BREVO_API_KEY"] },
    async (request) => {
        const data = request.data || {};

        const name  = String(data.name  || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const utmSource   = String(data.utm_source   || 'direct').trim();
        const utmMedium   = String(data.utm_medium   || 'none').trim();
        const utmCampaign = String(data.utm_campaign || 'none').trim();
        const landingPage = String(data.landing_page || '').trim();
        const listId = Number(data.listId) || 2;

        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            throw new HttpsError('invalid-argument', 'Valid email is required');
        }
        if (!BREVO_API_KEY) {
            logger.warn('[subscribeLead] BREVO_API_KEY no configurado - lead no enviado a Brevo');
            throw new HttpsError('internal', 'Brevo no configurado');
        }

        // Idioma del contacto (para que Brevo mande la versión ES o EN)
        const idioma = (String(data.lang || '').toLowerCase() === 'en' || landingPage.startsWith('/en/') || landingPage === '/en') ? 'EN' : 'ES';
        const enviar = (conIdioma) => fetch("https://api.brevo.com/v3/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
            body: JSON.stringify({
                email: email,
                attributes: Object.assign({
                    FIRSTNAME: name,
                    UTM_SOURCE: utmSource,
                    UTM_MEDIUM: utmMedium,
                    UTM_CAMPAIGN: utmCampaign,
                    LANDING_PAGE: landingPage
                }, conIdioma ? { LANGUAGE: idioma } : {}),
                listIds: [listId],
                updateEnabled: true
            })
        });

        try {
            let res = await enviar(true);
            if (res.status === 400) {
                // Si el atributo LANGUAGE no existe en Brevo, no perder el contacto: reintentar sin él
                const txt = await res.text();
                logger.warn(`[subscribeLead] Brevo 400 con LANGUAGE (${txt.slice(0, 160)}) — reintento sin idioma`);
                res = await enviar(false);
            }

            if (res.status === 201 || res.status === 204) {
                logger.info(`[subscribeLead] Lead agregado a Brevo: ${email} (${idioma})`);
                return { success: true };
            }

            const errBody = await res.text();
            logger.warn(`[subscribeLead] Brevo respondio ${res.status}: ${errBody}`);
            throw new HttpsError('internal', 'Brevo rejected the request');
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            logger.error('[subscribeLead] Error llamando a Brevo:', e.message);
            throw new HttpsError('internal', 'Error contacting Brevo');
        }
    }
);

// ============================================================
// sendContactMessage — formulario de Contacto (OCULTO)
// Reemplaza la integracion EmailJS que nunca estuvo conectada.
// Escribe a Firestore "mail" via Admin SDK (bypassa firestore.rules,
// que solo permite a un usuario logueado mandarse mail a si mismo) con
// "to" fijo en support@smartloadsolution.com -- el visitante nunca
// controla el destinatario.
// (c) 2026 SmartLoad Solution - Ricardo Galan.
// ============================================================
const CONTACT_SUBJECTS = {
    general: { es: 'Consulta General', en: 'General Inquiry' },
    support: { es: 'Soporte Técnico', en: 'Technical Support' },
    billing: { es: 'Facturación / Plan', en: 'Billing / Plan' },
    feature: { es: 'Solicitud de Funcionalidad', en: 'Feature Request' },
    partnership: { es: 'Partnership / Negocios', en: 'Partnership / Business' },
};

exports.sendContactMessage = onCall(
    { region: 'us-central1' },
    async (request) => {
        const data = request.data || {};

        const name = String(data.name || '').trim().slice(0, 100);
        const email = String(data.email || '').trim().toLowerCase();
        const subjectKey = String(data.subject || '').trim();
        const message = String(data.message || '').trim().slice(0, 5000);
        const lang = data.lang === 'en' ? 'en' : 'es';

        if (!name) {
            throw new HttpsError('invalid-argument', 'Name is required');
        }
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            throw new HttpsError('invalid-argument', 'Valid email is required');
        }
        if (!CONTACT_SUBJECTS[subjectKey]) {
            throw new HttpsError('invalid-argument', 'Valid subject is required');
        }
        if (!message) {
            throw new HttpsError('invalid-argument', 'Message is required');
        }

        const subjectLabel = CONTACT_SUBJECTS[subjectKey][lang];
        const subjectLine = lang === 'en'
            ? `New contact message: ${subjectLabel}`
            : `Nuevo mensaje de contacto: ${subjectLabel}`;

        const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2>${lang === 'en' ? 'New contact form message' : 'Nuevo mensaje del formulario de contacto'}</h2>
        <p><strong>${lang === 'en' ? 'Name' : 'Nombre'}:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>${lang === 'en' ? 'Category' : 'Categoría'}:</strong> ${subjectLabel}</p>
        <p><strong>${lang === 'en' ? 'Message' : 'Mensaje'}:</strong></p>
        <p style="white-space:pre-wrap;border-left:3px solid #ccc;padding-left:12px;">${message}</p>
      </div>
    `;

        try {
            await db.collection('mail').add({
                to: ['support@smartloadsolution.com'],
                replyTo: email,
                message: {
                    subject: subjectLine,
                    html,
                },
            });
            logger.info(`[sendContactMessage] Mensaje de contacto recibido de: ${email}`);
            return { success: true };
        } catch (e) {
            logger.error('[sendContactMessage] Error escribiendo a mail:', e.message);
            throw new HttpsError('internal', 'Error sending message');
        }
    }
);

// ============================================================
// requestReviews — pide reviews de Google a usuarios reales y
// activos (OCULTO). Corre 1x/dia, mismo patron que lexDailyAlerts.
// (c) 2026 SmartLoad Solution - Ricardo Galan.
// ============================================================
// El link real se configura en functions/.env como GOOGLE_REVIEW_LINK cuando
// exista el Google Business Profile
// (docs/superpowers/specs/2026-08-23-reviews-system-design.md, Fase 1).
// Mientras no este definido, la funcion no envia ningun email aunque se despliegue.
const GOOGLE_REVIEW_LINK = (process.env.GOOGLE_REVIEW_LINK || '').trim();

const REVIEW_MIN_LOADS = 10;
const REVIEW_MIN_ACCOUNT_AGE_DAYS = 7;

exports.requestReviews = onSchedule(
    { schedule: 'every 24 hours', timeZone: 'America/Chicago', maxInstances: 1 },
    async () => {
        if (!/^https:\/\//.test(GOOGLE_REVIEW_LINK) || GOOGLE_REVIEW_LINK.includes('PLACEHOLDER')) {
            logger.warn('[requestReviews] GOOGLE_REVIEW_LINK no configurado — no se envia nada.');
            return;
        }
        const now = new Date();
        const cutoffMs = now.getTime() - REVIEW_MIN_ACCOUNT_AGE_DAYS * 86400000;

        const usersSnap = await db.collection('users').get();
        if (usersSnap.empty) {
            logger.info('[requestReviews] No users found.');
            return;
        }

        let sent = 0;

        for (const userDoc of usersSnap.docs) {
            const uid = userDoc.id;
            const data = userDoc.data();

            if (data.reviewRequestSent === true) continue;
            if (!data.email) continue;

            const createdAtMs = data.createdAt && data.createdAt.toDate
                ? data.createdAt.toDate().getTime()
                : new Date(data.createdAt || 0).getTime();
            if (!createdAtMs || createdAtMs > cutoffMs) continue;

            try {
                const loadsCountSnap = await db.collection('loads')
                    .where('userId', '==', uid)
                    .count()
                    .get();
                const totalLoads = loadsCountSnap.data().count;
                if (totalLoads < REVIEW_MIN_LOADS) continue;

                const lang = data.preferredLanguage === 'en' ? 'en' : 'es';
                const subject = lang === 'en'
                    ? 'Quick favor? (30 seconds)'
                    : '¿Un favor rápido? (30 segundos)';
                const html = lang === 'en'
                    ? `<div style="font-family:Arial,sans-serif;max-width:600px;">
                         <p>Hey! You've calculated ${totalLoads} loads with SmartLoad Solution — glad it's been useful.</p>
                         <p>Would you mind leaving a quick Google review? It takes 30 seconds and really helps other independent carriers find us.</p>
                         <p><a href="${GOOGLE_REVIEW_LINK}" style="background:#C2410C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Leave a review →</a></p>
                       </div>`
                    : `<div style="font-family:Arial,sans-serif;max-width:600px;">
                         <p>¡Hola! Ya calculaste ${totalLoads} cargas con SmartLoad Solution — nos alegra que te esté sirviendo.</p>
                         <p>¿Nos regalas una reseña rápida en Google? Toma 30 segundos y ayuda a que otros transportistas independientes nos encuentren.</p>
                         <p><a href="${GOOGLE_REVIEW_LINK}" style="background:#C2410C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Dejar una reseña →</a></p>
                       </div>`;

                await db.collection('mail').add({
                    to: [data.email],
                    message: { subject, html },
                });
                await userDoc.ref.update({ reviewRequestSent: true });
                sent++;
            } catch (e) {
                logger.error(`[requestReviews] Error procesando usuario ${uid}:`, e.message);
            }
        }

        logger.info(`[requestReviews] Emails de review enviados: ${sent}`);
    }
);

// ============================================================
// ADMIN PANEL — User management (Cloud Functions, Admin SDK)
// © 2026 SmartLoad Solution — Ricardo Galan
// Expone gestión total de usuarios solo para rol 'admin'.
// Lee customers/{uid}/subscriptions y /payments vía Admin SDK
// (las reglas de Firestore no permiten lectura admin de esas
// subcolecciones, por eso se sirve desde backend).
// ============================================================

// Verifica que el llamador tenga rol admin en users/{uid}
async function _requireAdmin(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const callerUid = request.auth.uid;
    const userSnap = await db.collection('users').doc(callerUid).get();
    const role = userSnap.exists ? (userSnap.data().role || 'user') : 'user';
    if (role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }
    return callerUid;
}

// Convierte Timestamps a ISO para el cliente
function _iso(v) {
    if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
    if (v && typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
    return v;
}

// Sanea recursivamente valores crudos del Admin SDK de Firestore (Timestamp,
// DocumentReference) antes de devolverlos en la respuesta de una funcion
// onCall. El encode() de firebase-functions no tiene proteccion para estos
// tipos -- solo hace Object.entries() a mano, sin llamar toJSON() ni
// detectar ciclos -- asi que un DocumentReference crudo camina hacia el
// cliente completo de Firestore (su propiedad interna _firestore), que es
// genuinamente ciclico, y revienta la pila con "Maximum call stack size
// exceeded" (confirmado via logs de produccion: uid con suscripcion real,
// campo subscriptions[0].product).
function _sanitizeFirestoreValue(value) {
    if (value === null || value === undefined || typeof value !== 'object') return value;
    if (typeof value.toDate === 'function') return _iso(value); // Timestamp
    if (typeof value.path === 'string' && typeof value.get === 'function') return value.path; // DocumentReference
    if (Array.isArray(value)) return value.map(_sanitizeFirestoreValue);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        out[k] = _sanitizeFirestoreValue(v);
    }
    return out;
}

// Lee el pago/RPM/fecha de una carga tolerando los nombres de campo legacy que
// ya maneja public/js/history.js (los datos viejos no se migraron de esquema).
function _loadPay(l) {
    const v = l.totalCharge ?? l.rate ?? l.totalCost;
    return Number(v || 0);
}
function _loadRpm(l) {
    return Number(l.rpm || 0);
}
function _loadDateMs(l) {
    const d = l.date;
    if (d instanceof Date) return d.getTime();
    if (d && typeof d.toDate === 'function') return d.toDate().getTime();
    if (d && typeof d._seconds === 'number') return d._seconds * 1000;
    if (typeof d === 'string' || typeof d === 'number') return new Date(d).getTime();
    return 0;
}

// Lecciones por modulo — debe coincidir con AcademyProgress.MODULES en
// public/academy/js/academy.js (modulo 0 = "Empieza Aqui", no cuenta para el
// total de "8 modulos" que se le muestra al usuario).
const ACADEMY_MODULE_LESSONS = { 1: 5, 2: 6, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 };

function _academyModulesCompleted(academyData) {
    if (!academyData || !academyData.modules) return 0;
    let count = 0;
    for (const [modNum, lessonCount] of Object.entries(ACADEMY_MODULE_LESSONS)) {
        const mod = academyData.modules[modNum];
        if (mod && Array.isArray(mod.completed) && new Set(mod.completed).size === lessonCount) count++;
    }
    return count;
}

// Lee datos de facturación de un usuario desde Firestore (Stripe extension)
async function _getUserBilling(uid) {
    const out = { stripeCustomerId: null, subscriptions: [], payments: [], totalPaid: 0, failedPaymentsCount: 0 };
    try {
        const custSnap = await db.collection('customers').doc(uid).get();
        if (custSnap.exists) out.stripeCustomerId = custSnap.data().stripeId || null;

        const subsSnap = await db.collection('customers').doc(uid)
            .collection('subscriptions').limit(20).get();
        subsSnap.forEach(d => out.subscriptions.push({ id: d.id, ...d.data() }));

        // Los pagos se consultan directo a la API de Stripe, no a un mirror
        // de Firestore: la extension firestore-stripe-payments no sincroniza
        // facturas de suscripcion a customers/{uid}/payments (confirmado
        // inspeccionando Firestore -- esa subcoleccion nunca existe para
        // pagos recurrentes), asi que "Sin pagos registrados" salia siempre
        // vacio aunque el pago real existiera en el Dashboard de Stripe.
        if (out.stripeCustomerId && STRIPE_SECRET_KEY) {
            try {
                const stripe = new Stripe(STRIPE_SECRET_KEY);
                const charges = await stripe.charges.list({ customer: out.stripeCustomerId, limit: 10 });
                charges.data.forEach(c => {
                    out.payments.push({
                        id: c.id,
                        amount: c.amount,
                        currency: c.currency,
                        status: c.status,
                        description: c.description || null,
                        created: new Date(c.created * 1000).toISOString(),
                    });
                });
            } catch (stripeErr) {
                logger.warn(`[_getUserBilling] stripe.charges.list fallo uid ${uid}:`, stripeErr.message);
            }
        }

        // Totales sobre los ultimos 10 pagos (mismo set ya traido, sin lecturas
        // extra) -- no es lifetime value real si hay mas de 10 pagos historicos.
        for (const py of out.payments) {
            if (py.status === 'succeeded') out.totalPaid += Number(py.amount || 0) / 100;
            else out.failedPaymentsCount++;
        }
    } catch (e) {
        logger.warn(`[_getUserBilling] uid ${uid}:`, e.message);
    }
    return out;
}

// Lee la fecha de un pago de Stripe (el campo `created` del extension mirror es
// tipicamente un numero en segundos Unix, pero tambien puede llegar como
// Timestamp de Firestore segun como se haya escrito el documento).
function _paymentDateMs(py) {
    const c = py.created;
    if (typeof c === 'number') return c * 1000;
    if (c && typeof c.toDate === 'function') return c.toDate().getTime();
    if (c && typeof c._seconds === 'number') return c._seconds * 1000;
    return 0;
}
function _monthKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _yearKey(ms) {
    return String(new Date(ms).getFullYear());
}

// ─── Facturacion agregada de todos los usuarios (solo admin) ─────────────────
exports.adminGetBillingOverview = onCall(
    { region: 'us-central1' },
    async (request) => {
        await _requireAdmin(request);

        // Sin where/orderBy a proposito: un collectionGroup con filtros needs a
        // composite index que no existe hoy. Se agrega todo en memoria abajo.
        // limit() es un techo de seguridad, no paginacion real (mismo criterio
        // que la agregacion de `loads` en adminGetUserDetail).
        const [paySnap, subsSnap] = await Promise.all([
            db.collectionGroup('payments').limit(5000).get()
                .catch(e => { logger.warn('[adminGetBillingOverview] payments query failed:', e.message); return { forEach: () => {}, size: 0 }; }),
            db.collectionGroup('subscriptions').limit(2000).get()
                .catch(e => { logger.warn('[adminGetBillingOverview] subscriptions query failed:', e.message); return { forEach: () => {}, size: 0 }; }),
        ]);

        if (paySnap.size >= 5000) logger.warn('[adminGetBillingOverview] payments hit the 5000 safety cap — totals may be incomplete');
        if (subsSnap.size >= 2000) logger.warn('[adminGetBillingOverview] subscriptions hit the 2000 safety cap — MRR may be incomplete');

        const payments = [];
        paySnap.forEach(doc => payments.push(doc.data()));
        const subscriptions = [];
        subsSnap.forEach(doc => subscriptions.push(doc.data()));

        let totalRevenue = 0;
        let thisMonthRevenue = 0;
        let failedPaymentsCount = 0;
        const byMonth = {};
        const byYear = {};

        const now = new Date();
        const currentMonthKey = _monthKey(now.getTime());

        for (const py of payments) {
            const amount = Number(py.amount || 0) / 100;
            if (py.status === 'succeeded') {
                totalRevenue += amount;
                const ms = _paymentDateMs(py);
                const mKey = _monthKey(ms);
                const yKey = _yearKey(ms);
                byMonth[mKey] = (byMonth[mKey] || 0) + amount;
                byYear[yKey] = (byYear[yKey] || 0) + amount;
                if (mKey === currentMonthKey) thisMonthRevenue += amount;
            } else {
                failedPaymentsCount++;
            }
        }

        // Ultimos 12 meses, mas antiguo primero, con 0 en los meses sin pagos.
        const revenueByMonth = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = _monthKey(d.getTime());
            revenueByMonth.push({ month: key, total: byMonth[key] || 0 });
        }

        const revenueByYear = Object.keys(byYear).sort().map(year => ({ year, total: byYear[year] }));

        let mrr = 0;
        for (const sub of subscriptions) {
            if (sub.status !== 'active') continue;
            const unitAmount = sub.price?.unit_amount ?? sub.items?.data?.[0]?.price?.unit_amount ?? 0;
            mrr += Number(unitAmount || 0) / 100;
        }

        return { totalRevenue, mrr, thisMonthRevenue, failedPaymentsCount, revenueByMonth, revenueByYear };
    }
);

// ─── Listar todos los usuarios (solo admin) ───────────────────────────────────
exports.adminGetUsers = onCall(
    { region: 'us-central1' },
    async (request) => {
        await _requireAdmin(request);
        const snapshot = await db.collection('users')
            .orderBy('createdAt', 'desc').limit(1000).get();
        const users = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            users.push({
                uid: doc.id,
                email: d.email || null,
                displayName: d.displayName || null,
                role: d.role || 'user',
                plan: d.plan || 'free',
                subscriptionStatus: d.subscriptionStatus || 'none',
                accountStatus: d.accountStatus || 'active',
                createdAt: _iso(d.createdAt),
                lastActiveAt: _iso(d.lastActiveAt || d.lastLoginAt),
                adminNotes: d.adminNotes || '',
            });
        });

        // Conteo historico total de cargas por usuario (aggregate query: no
        // transfiere los documentos, solo el numero) — una query por usuario,
        // en paralelo via Promise.all (mismo patron que ya usa este archivo
        // para operaciones N-por-usuario, ej. cancelStripeSubscription arriba).
        await Promise.all(users.map(async (u) => {
            const countSnap = await db.collection('loads').where('userId', '==', u.uid).count().get();
            u.loadsCount = countSnap.data().count;
        }));

        return { count: users.length, users };
    }
);

// ─── Detalle completo de un usuario (solo admin) ──────────────────────────────
exports.adminGetUserDetail = onCall(
    { region: 'us-central1', secrets: ["STRIPE_SECRET_KEY"] },
    async (request) => {
        await _requireAdmin(request);
        const targetUid = String(request.data?.targetUid || '').trim();
        if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required');

        const userSnap = await db.collection('users').doc(targetUid).get();
        if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
        const d = userSnap.data();

        const [billing, userPlansSnap, academySnap, loadsSnap] = await Promise.all([
            _getUserBilling(targetUid),
            db.collection('userPlans').doc(targetUid).get(),
            db.collection('academyProgress').doc(targetUid).get(),
            // Sin orderBy a propósito: un where('userId','==',...) + orderBy('date') en
            // Firestore real necesita un índice compuesto que no existe hoy. Se ordena
            // en memoria abajo. limit(2000) es un techo de seguridad, no paginación real
            // (ver "Non-goals" en el spec).
            db.collection('loads').where('userId', '==', targetUid).limit(2000).get()
                .catch(() => ({ forEach: () => {} })),
        ]);

        const academyData = academySnap.exists ? academySnap.data() : null;

        const loads = [];
        loadsSnap.forEach(doc => loads.push({ id: doc.id, ...doc.data() }));
        loads.sort((a, b) => _loadDateMs(b) - _loadDateMs(a));
        const loadsCount = loads.length;
        const loadsTotal = loads.reduce((sum, l) => sum + _loadPay(l), 0);
        const loadsAvgRpm = loadsCount > 0
            ? loads.reduce((sum, l) => sum + _loadRpm(l), 0) / loadsCount
            : 0;
        const recentLoads = loads.slice(0, 10).map(l => ({
            id: l.id,
            date: _iso(l.date),
            origin: l.origin || '-',
            destination: l.destination || '-',
            pay: _loadPay(l),
            rpm: _loadRpm(l),
        }));

        const _adminGetUserDetailResult = {
            uid: targetUid,
            profile: {
                email: d.email || null,
                displayName: d.displayName || null,
                fullName: d.fullName || null,
                phone: d.phone || null,
                role: d.role || 'user',
                plan: d.plan || 'free',
                subscriptionStatus: d.subscriptionStatus || 'none',
                subscriptionId: d.subscriptionId || null,
                accountStatus: d.accountStatus || 'active',
                createdAt: _iso(d.createdAt),
                lastActiveAt: _iso(d.lastActiveAt || d.lastLoginAt),
                adminNotes: d.adminNotes || '',
                vehicle: _sanitizeFirestoreValue(d.vehicle) || null,
                costs: _sanitizeFirestoreValue(d.costs) || null,
                preferences: _sanitizeFirestoreValue(d.preferences) || null,
                onboarding: _sanitizeFirestoreValue(d.onboarding) || null,
                stripeCustomerId: d.stripeCustomerId || null,
            },
            billing: {
                stripeCustomerId: billing.stripeCustomerId || d.stripeCustomerId || null,
                subscriptions: _sanitizeFirestoreValue(billing.subscriptions),
                payments: _sanitizeFirestoreValue(billing.payments),
                totalPaid: billing.totalPaid,
                failedPaymentsCount: billing.failedPaymentsCount,
            },
            userPlans: userPlansSnap.exists ? _sanitizeFirestoreValue(userPlansSnap.data()) : null,
            academy: _sanitizeFirestoreValue(academyData),
            stats: {
                loadsCount,
                loadsTotal,
                loadsAvgRpm,
                recentLoads,
                academyModulesCompleted: _academyModulesCompleted(academyData),
                academyModulesTotal: 8,
            },
        };

        return _adminGetUserDetailResult;
    }
);

// ─── Actualizar usuario (solo admin) ──────────────────────────────────────────
exports.adminUpdateUser = onCall(
    { region: 'us-central1' },
    async (request) => {
        const callerUid = await _requireAdmin(request);
        const data = request.data || {};
        const targetUid = String(data.targetUid || '').trim();
        const operation = String(data.operation || '').trim();
        if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required');
        if (!operation) throw new HttpsError('invalid-argument', 'operation required');

        const callerSnap = await db.collection('users').doc(callerUid).get();
        const callerEmail = callerSnap.exists ? (callerSnap.data().email || callerUid) : callerUid;

        const userRef = db.collection('users').doc(targetUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
        const current = userSnap.data();

        switch (operation) {
            case 'setPlan': {
                const plan = String(data.plan || '').trim();
                const valid = ['free', 'starter', 'professional', 'premium'];
                if (!valid.includes(plan)) throw new HttpsError('invalid-argument', 'Invalid plan');
                await userRef.update({
                    plan,
                    subscriptionStatus: plan === 'free' ? 'none' : (current.subscriptionStatus || 'active'),
                    manualPlanOverride: true,
                    planChangedByAdmin: callerEmail,
                    planChangedAt: admin.firestore.FieldValue.serverTimestamp(),
                    planChangeReason: String(data.reason || 'Cambio manual por admin').slice(0, 280),
                });
                logger.info(`[adminUpdateUser] setPlan ${targetUid} -> ${plan} by ${callerEmail}`);
                return { success: true, plan };
            }
            case 'setAccountStatus': {
                const status = String(data.status || '').trim();
                if (!['active', 'suspended'].includes(status)) throw new HttpsError('invalid-argument', 'Invalid status');
                await userRef.update({
                    accountStatus: status,
                    accountStatusChangedBy: callerEmail,
                    accountStatusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                logger.info(`[adminUpdateUser] setAccountStatus ${targetUid} -> ${status}`);
                return { success: true, status };
            }
            case 'saveNotes': {
                const notes = String(data.notes || '').slice(0, 2000);
                await userRef.update({ adminNotes: notes });
                return { success: true };
            }
            case 'cancelSubscription': {
                const atPeriodEnd = data.atPeriodEnd !== false;
                const subscriptionId = current.subscriptionId || (data.subscriptionId || null);
                if (!subscriptionId) throw new HttpsError('not-found', 'No subscriptionId found for user');
                if (!STRIPE_SECRET_KEY) throw new HttpsError('internal', 'Stripe not configured');
                const stripe = new Stripe(STRIPE_SECRET_KEY);
                const result = await stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: atPeriodEnd,
                });
                await userRef.update({
                    subscriptionStatus: atPeriodEnd ? 'canceled_scheduled' : 'canceled',
                    subscriptionCanceledByAdmin: callerEmail,
                    subscriptionCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                logger.info(`[adminUpdateUser] cancelSubscription ${subscriptionId} atPeriodEnd=${atPeriodEnd}`);
                return { success: true, stripeStatus: result.status };
            }
            default:
                throw new HttpsError('invalid-argument', `Unknown operation: ${operation}`);
        }
    }
);

// Weather proxy: additive integration; reuse Admin and the existing server plan resolver.
exports.getWeather = require('./get-weather').buildGetWeather({ admin, db, resolveUserPlan: _resolveUserPlan });

// Precios semanales de combustible por region (EIA) para el costo de cada carga.
exports.updateFuelPrices = require('./fuel-prices').buildUpdateFuelPrices({ db });
