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
                    logger.info("[stripeWebhook] Upgrade detectado — cancelando suscripción antigua:", oldSubId);
                    await cancelStripeSubscription(oldSubId);
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
                        await activateUserPlan(firebaseId, planId, invoice.subscription);

                        // Enviar email HTML de confirmación de pago
                        const userEmail = invoice.customer_email;
                        const planMeta = {
                            professional: { name: "Professional", price: "14.99" },
                            premium:      { name: "Premium + AI", price: "29.99" },
                        };
                        if (userEmail && planMeta[planId]) {
                            const { name: planName, price: planPrice } = planMeta[planId];
                            const lang = await getUserLang(firebaseId);
                            await db.collection("mail").add({
                                to: [userEmail],
                                message: {
                                    subject: lang === 'en'
                                        ? `Welcome to the ${planName} Plan! 🎉`
                                        : `¡Bienvenido al Plan ${planName}! 🎉`,
                                    html: buildActivationEmail(planName, planPrice, lang),
                                },
                            }).catch(e => logger.warn("[stripeWebhook] Email no enviado:", e.message));
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
                    await sendEmailByUid(firebaseUid, {
                        subject: lang === 'en'
                            ? '📋 Plan change scheduled — Smart Load Solution'
                            : '📋 Cambio de plan programado — Smart Load Solution',
                        html: buildDowngradeScheduledEmail(fechaFin, lang)
                    });
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
                    await sendEmailByUid(firebaseUid, {
                        subject: lang === 'en'
                            ? '😔 Your subscription will be cancelled soon — Smart Load Solution'
                            : '😔 Tu suscripción se cancelará pronto — Smart Load Solution',
                        html: buildCancellationScheduledEmail(fechaFin, lang)
                    });
                    logger.info("[stripeWebhook] ✅ Email cancelación programada uid:", firebaseUid);
                }

                if (priceChanged && newPlanId) {
                    const isDowngrade = PRICE_TO_PLAN[oldPriceId] === 'premium' && newPlanId === 'professional';
                    const planName = PLAN_NAMES[newPlanId];
                    const planPrice = newPlanId === 'premium' ? '29.99' : '14.99';
                    const lang = await getUserLang(firebaseUid);
                    await sendEmailByUid(firebaseUid, {
                        subject: lang === 'en'
                            ? (isDowngrade
                                ? `Your plan changed to ${planName} — Smart Load Solution`
                                : `Welcome to the ${planName} Plan! 🎉`)
                            : (isDowngrade
                                ? `Tu plan cambió a ${planName} — Smart Load Solution`
                                : `¡Bienvenido al Plan ${planName}! 🎉`),
                        html: buildPlanChangedEmail(planName, planPrice, isDowngrade, lang)
                    });
                    logger.info("[stripeWebhook] ✅ Email cambio de plan enviado:", planName, "uid:", firebaseUid);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const sub = event.data.object;
                logger.info("[stripeWebhook] Suscripción cancelada:", sub.id);

                const firebaseId = await getFirebaseIdFromCustomer(sub.customer);
                if (firebaseId) {
                    await downgradeUserPlan(firebaseId, sub.customer, sub.id);
                }
                break;
            }

            default:
                logger.info("[stripeWebhook] Evento no manejado:", event.type);
        }
    } catch (err) {
        logger.error("[stripeWebhook] Error procesando evento:", err.message);
        // Responder 200 igual para evitar reintentos de Stripe en errores internos
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
        const acceptThresh = avgRPM > 0 ? Math.max(targetRPM, avgRPM) : targetRPM;
        const midThresh    = avgRPM > 0 ? Math.min(targetRPM, avgRPM) : targetRPM;

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
    // Si la sub eliminada no coincide con la que está en Firestore, ignorar
    if (deletedSubId) {
        const userDoc = await db.collection("users").doc(firebaseId).get();
        const currentSubId = userDoc.exists ? userDoc.data().subscriptionId : null;
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
            return;
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
    await db.collection('mail').add({ to: [email], message: { subject, html } });
    logger.info("[sendEmailByUid] ✅ Email enviado a:", email);
}

// ─── Template: activación de plan (NUEVO — faltaba) ──────────────────────────
function buildActivationEmail(planName, planPrice, lang = 'es') {
    const isEn = lang === 'en';
    const title    = isEn ? `Welcome to the ${planName} Plan! 🎉` : `¡Bienvenido al Plan ${planName}! 🎉`;
    const body     = isEn
        ? `You now have full access to the <strong style="color:#fff;">${planName}</strong> plan at $${planPrice}/month.`
        : `Ahora tienes acceso completo al Plan <strong style="color:#fff;">${planName}</strong> por $${planPrice}/mes.`;
    const f1 = isEn ? 'Unlimited loads' : 'Cargas ilimitadas';
    const f2 = isEn ? 'Full financial system' : 'Sistema financiero completo';
    const f3 = isEn ? 'Advanced zone analysis' : 'Análisis de zonas avanzado';
    const f4 = 'Smart Load Academy';
    const btn = isEn ? 'Go to App →' : 'Ir a la App →';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;background:#FF6D4A;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;">PLAN ${planName.toUpperCase()} ${isEn ? 'ACTIVE' : 'ACTIVO'}</div>
          </div>
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">${title}</h2>
          <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">${body}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="padding:12px;background:#0f172a;border-radius:8px;"><table width="100%"><tr><td width="32" style="font-size:18px;">✅</td><td><p style="margin:0;color:#fff;font-size:14px;font-weight:600;">${f1}</p></td></tr></table></td></tr>
            <tr><td style="padding:4px 0;"></td></tr>
            <tr><td style="padding:12px;background:#0f172a;border-radius:8px;"><table width="100%"><tr><td width="32" style="font-size:18px;">✅</td><td><p style="margin:0;color:#fff;font-size:14px;font-weight:600;">${f2}</p></td></tr></table></td></tr>
            <tr><td style="padding:4px 0;"></td></tr>
            <tr><td style="padding:12px;background:#0f172a;border-radius:8px;"><table width="100%"><tr><td width="32" style="font-size:18px;">✅</td><td><p style="margin:0;color:#fff;font-size:14px;font-weight:600;">${f3}</p></td></tr></table></td></tr>
            <tr><td style="padding:4px 0;"></td></tr>
            <tr><td style="padding:12px;background:#0f172a;border-radius:8px;"><table width="100%"><tr><td width="32" style="font-size:18px;">✅</td><td><p style="margin:0;color:#fff;font-size:14px;font-weight:600;">${f4}</p></td></tr></table></td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="https://app.smartloadsolution.com/app.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">${btn}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Template: downgrade programado ──────────────────────────────────────────
function buildDowngradeScheduledEmail(fechaFin, lang = 'es') {
    const isEn = lang === 'en';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">${isEn ? 'Plan change scheduled 📋' : 'Cambio de plan programado 📋'}</h2>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">
            ${isEn
                ? `Your plan will change to <strong style="color:#fff;">Professional</strong> on <strong style="color:#FF6D4A;">${fechaFin}</strong>.<br>Until then you still have full access to Premium + AI.`
                : `Tu plan cambiará a <strong style="color:#fff;">Professional</strong> el <strong style="color:#FF6D4A;">${fechaFin}</strong>.<br>Hasta entonces sigues teniendo acceso completo a Premium + AI.`}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:28px;">
            <tr><td>
              <p style="margin:0 0 12px;color:#FF6D4A;font-size:13px;font-weight:700;text-transform:uppercase;">${isEn ? `What you'll lose on ${fechaFin}` : `Lo que perderás el ${fechaFin}`}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;Lex AI Assistant</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Unlimited history' : 'Historial ilimitado'}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Tax reports' : 'Reportes de impuestos'}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Full Academy' : 'Academia completa'}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;text-align:center;">${isEn ? 'Changed your mind? You can keep Premium and keep making better decisions on the road.' : '¿Cambiaste de opinión? Puedes mantener Premium y seguir tomando mejores decisiones en la carretera.'}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td align="center">
            <a href="https://app.smartloadsolution.com/account.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">${isEn ? 'Keep Premium →' : 'Mantener Premium →'}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Template: cancelación programada ────────────────────────────────────────
function buildCancellationScheduledEmail(fechaFin, lang = 'es') {
    const isEn = lang === 'en';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <div style="text-align:center;font-size:48px;margin-bottom:16px;">😔</div>
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">${isEn ? 'Subscription cancelled' : 'Suscripción cancelada'}</h2>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">
            ${isEn
                ? `Your subscription will be cancelled on <strong style="color:#FF6D4A;">${fechaFin}</strong>.<br>Until then you still have full access to your current plan.`
                : `Tu suscripción se cancelará el <strong style="color:#FF6D4A;">${fechaFin}</strong>.<br>Hasta entonces sigues teniendo acceso completo a tu plan actual.`}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:28px;">
            <tr><td>
              <p style="margin:0 0 12px;color:#FF6D4A;font-size:13px;font-weight:700;text-transform:uppercase;">${isEn ? `What you'll lose on ${fechaFin}` : `Lo que perderás el ${fechaFin}`}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Unlimited loads' : 'Cargas ilimitadas'}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Full financial dashboard' : 'Dashboard financiero completo'}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Advanced zone analysis' : 'Análisis de zonas avanzado'}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;${isEn ? 'Reports & exports' : 'Reportes y exportaciones'}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️&nbsp;Lex AI Assistant</p>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;text-align:center;">${isEn ? `Was this a mistake? You can reactivate your subscription any time before ${fechaFin}.` : `¿Fue un error? Puedes reactivar tu suscripción en cualquier momento antes del ${fechaFin}.`}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td align="center">
            <a href="https://app.smartloadsolution.com/account.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">${isEn ? 'Reactivate Subscription →' : 'Reactivar Suscripción →'}</a>
          </td></tr></table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr><td align="center">
            <a href="https://app.smartloadsolution.com/plans.html" style="display:inline-block;background:transparent;color:#FF6D4A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #FF6D4A;">${isEn ? 'View Plans →' : 'Ver Planes →'}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
          <p style="margin:8px 0 0;color:#64748b;font-size:11px;">${isEn ? 'Sorry to see you go. If you have feedback, <a href="mailto:support@smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">let us know</a>.' : 'Lamentamos verte partir. Si tienes alguna sugerencia para mejorar, <a href="mailto:support@smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">escríbenos</a>.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Template: cambio de plan efectivo ───────────────────────────────────────
function buildPlanChangedEmail(planName, planPrice, isDowngrade, lang = 'es') {
    const isEn = lang === 'en';
    const heading = isDowngrade
        ? (isEn ? `Your plan is now ${planName}` : `Tu plan es ahora ${planName}`)
        : (isEn ? `${planName} Plan activated! 🚀` : `¡Plan ${planName} activado! 🚀`);
    const body = isDowngrade
        ? (isEn
            ? `Your account is now on the <strong style="color:#fff;">Professional</strong> plan at $${planPrice}/month.`
            : `Tu cuenta ahora está en el plan <strong style="color:#fff;">Professional</strong> a $${planPrice}/mes.`)
        : (isEn
            ? `You have full access to <strong style="color:#fff;">${planName}</strong> at $${planPrice}/month.`
            : `Tienes acceso completo a <strong style="color:#fff;">${planName}</strong> por $${planPrice}/mes.`);
    const btnLabel  = isEn ? 'Go to App →' : 'Ir a la App →';
    const upgradeLbl = isEn ? 'Go back to Premium + AI →' : 'Volver a Premium + AI →';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;background:#FF6D4A;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;">PLAN ${planName.toUpperCase()} ${isEn ? 'ACTIVE' : 'ACTIVO'}</div>
          </div>
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">${heading}</h2>
          <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">${body}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td align="center">
            <a href="https://app.smartloadsolution.com/app.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">${btnLabel}</a>
          </td></tr></table>
          ${isDowngrade ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr><td align="center">
            <a href="https://app.smartloadsolution.com/plans.html" style="display:inline-block;background:transparent;color:#FF6D4A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #FF6D4A;">${upgradeLbl}</a>
          </td></tr></table>` : ''}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}


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

        try {
            const res = await fetch("https://api.brevo.com/v3/contacts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": BREVO_API_KEY
                },
                body: JSON.stringify({
                    email: email,
                    attributes: {
                        FIRSTNAME: name,
                        UTM_SOURCE: utmSource,
                        UTM_MEDIUM: utmMedium,
                        UTM_CAMPAIGN: utmCampaign,
                        LANDING_PAGE: landingPage
                    },
                    listIds: [listId],
                    updateEnabled: true
                })
            });

            if (res.status === 201 || res.status === 204) {
                logger.info(`[subscribeLead] Lead agregado a Brevo: ${email}`);
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

        const paySnap = await db.collection('customers').doc(uid)
            .collection('payments').orderBy('created', 'desc').limit(10).get();
        paySnap.forEach(d => out.payments.push({ id: d.id, ...d.data() }));

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
                .catch(() => ({ forEach: () => {} })),
            db.collectionGroup('subscriptions').limit(2000).get()
                .catch(() => ({ forEach: () => {} })),
        ]);

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
        return { count: users.length, users };
    }
);

// ─── Detalle completo de un usuario (solo admin) ──────────────────────────────
exports.adminGetUserDetail = onCall(
    { region: 'us-central1' },
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

        return {
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
                vehicle: d.vehicle || null,
                costs: d.costs || null,
                preferences: d.preferences || null,
                onboarding: d.onboarding || null,
                stripeCustomerId: d.stripeCustomerId || null,
            },
            billing: {
                stripeCustomerId: billing.stripeCustomerId || d.stripeCustomerId || null,
                subscriptions: billing.subscriptions,
                payments: billing.payments,
                totalPaid: billing.totalPaid,
                failedPaymentsCount: billing.failedPaymentsCount,
            },
            userPlans: userPlansSnap.exists ? userPlansSnap.data() : null,
            academy: academyData,
            stats: {
                loadsCount,
                loadsTotal,
                loadsAvgRpm,
                recentLoads,
                academyModulesCompleted: _academyModulesCompleted(academyData),
                academyModulesTotal: 8,
            },
        };
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
