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
const IS_TEST_MODE = false; // LIVE MODE

// Mapeo inverso: Stripe Price ID → plan ID interno
const PRICE_TO_PLAN = {
    // TEST MODE
    "price_1TBCyEPrcqI2pVW0vcn6xbxd": "professional",
    "price_1TBCzcPrcqI2pVW07PAeFG9I": "premium",
    // LIVE MODE
    "price_1T4CmZPrcqI2pVW0wjZkexA8": "professional", // $14.99/mes — LIVE
    "price_1T4CpaPrcqI2pVW0EgoJJq6Q": "premium",       // $29.99/mes — LIVE
    "price_1TAbirPrcqI2pVW0WDb2tNAx": "professional",  // $1.00/mes — LIVE Test Plan (old)
    // LIVE TEST PRICES
    "price_1TBzVvPrcqI2pVW0NGKl0Znw": "professional", // $1.00 — LIVE TEST
    "price_1TBzXhPrcqI2pVW0bToystoo": "premium",       // $1.50 — LIVE TEST
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

                        // Net de seguridad: deshabilitado temporalmente para evitar cancelar sub recién creada
                        // if (invoice.billing_reason === "subscription_create") {
                        //     await cancelOtherSubscriptions(invoice.customer, invoice.subscription);
                        // }

                        // Enviar email HTML de confirmación de pago
                        const userEmail = invoice.customer_email;
                        const planMeta = {
                            professional: { name: "Professional", price: "14.99" },
                            premium:      { name: "Premium + AI", price: "29.99" },
                        };
                        if (userEmail && planMeta[planId]) {
                            const { name: planName, price: planPrice } = planMeta[planId];
                            await db.collection("mail").add({
                                to: [userEmail],
                                message: {
                                    subject: `¡Bienvenido al Plan ${planName}! 🎉`,
                                    html: buildActivationEmail(planName, planPrice),
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

                const SUB_PRICE_TO_PLAN = {
                    'price_1TBCyEPrcqI2pVW0vcn6xbxd': 'professional',
                    'price_1TBCzcPrcqI2pVW07PAeFG9I': 'premium',
                    'price_1T4CmZPrcqI2pVW0wjZkexA8': 'professional',
                    'price_1T4CpaPrcqI2pVW0EgoJJq6Q': 'premium'
                };
                const PLAN_NAMES = { 'professional': 'Professional', 'premium': 'Premium + AI' };

                const newPriceId = subscription.items?.data?.[0]?.price?.id;
                const oldPriceId = previousAttributes?.items?.data?.[0]?.price?.id;
                const newPlanId = SUB_PRICE_TO_PLAN[newPriceId] || null;
                const oldPlanId = SUB_PRICE_TO_PLAN[oldPriceId] || null;

                const scheduleCreated = subscription.schedule && !previousAttributes?.schedule;
                const priceChanged = oldPriceId && newPriceId && oldPriceId !== newPriceId;

                logger.info("[stripeWebhook] subscription.updated — schedule:", scheduleCreated, "priceChanged:", priceChanged, "old:", oldPlanId, "new:", newPlanId);

                if (scheduleCreated) {
                    const periodEndRaw = subscription.current_period_end;
                    const periodEnd = periodEndRaw ? new Date(periodEndRaw * 1000) : null;
                    const fechaFin = periodEnd ? periodEnd.toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'la fecha de vencimiento';
                    await sendEmailByUid(firebaseUid, {
                        subject: '📋 Cambio de plan programado — Smart Load Solution',
                        html: buildDowngradeScheduledEmail(fechaFin)
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
                    const fechaFin = periodEnd
                        ? periodEnd.toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'la fecha de vencimiento';
                    await sendEmailByUid(firebaseUid, {
                        subject: '😔 Tu suscripción se cancelará pronto — Smart Load Solution',
                        html: buildCancellationScheduledEmail(fechaFin)
                    });
                    logger.info("[stripeWebhook] ✅ Email cancelación programada uid:", firebaseUid);
                }

                if (priceChanged && newPlanId) {
                    const isDowngrade = SUB_PRICE_TO_PLAN[oldPriceId] === 'premium' && newPlanId === 'professional';
                    const planName = PLAN_NAMES[newPlanId];
                    const planPrice = newPlanId === 'premium' ? '29.99' : '14.99';
                    await sendEmailByUid(firebaseUid, {
                        subject: isDowngrade
                            ? `Tu plan cambió a ${planName} — Smart Load Solution`
                            : `¡Bienvenido al Plan ${planName}! 🎉`,
                        html: buildPlanChangedEmail(planName, planPrice, isDowngrade)
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

// ─── Enviar email via Firestore ───────────────────────────────────────────────
async function sendEmailByUid(uid, { subject, html }) {
    const userDoc = await db.collection('users').doc(uid).get();
    const email = userDoc.data()?.email;
    if (!email) { logger.warn("[sendEmailByUid] No email para uid:", uid); return; }
    await db.collection('mail').add({ to: [email], message: { subject, html } });
    logger.info("[sendEmailByUid] ✅ Email enviado a:", email);
}

// ─── Template: downgrade programado ──────────────────────────────────────────
function buildDowngradeScheduledEmail(fechaFin) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">Cambio de plan programado 📋</h2>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">
            Tu plan cambiará a <strong style="color:#fff;">Professional</strong> el <strong style="color:#FF6D4A;">${fechaFin}</strong>.<br>
            Hasta entonces sigues teniendo acceso completo a Premium + AI.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:28px;">
            <tr><td>
              <p style="margin:0 0 12px;color:#FF6D4A;font-size:13px;font-weight:700;text-transform:uppercase;">Lo que perderás el ${fechaFin}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Lex AI Assistant</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Historial ilimitado</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Reportes de impuestos</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Academia completa</p>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;text-align:center;">¿Cambiaste de opinión? Puedes mantener Premium y seguir tomando mejores decisiones en la carretera.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr><td align="center">
              <a href="https://app.smartloadsolution.com/account.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">Mantener Premium →</a>
            </td></tr>
          </table>
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
function buildCancellationScheduledEmail(fechaFin) {
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
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">Suscripción cancelada</h2>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">
            Tu suscripción se cancelará el <strong style="color:#FF6D4A;">${fechaFin}</strong>.<br>
            Hasta entonces sigues teniendo acceso completo a tu plan actual.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:28px;">
            <tr><td>
              <p style="margin:0 0 12px;color:#FF6D4A;font-size:13px;font-weight:700;text-transform:uppercase;">Lo que perderás el ${fechaFin}</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Cargas ilimitadas</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Dashboard financiero completo</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Análisis de zonas avanzado</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Reportes y exportaciones</p>
              <p style="margin:4px 0;color:#94a3b8;font-size:14px;">⚠️ &nbsp;Lex AI Assistant</p>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;text-align:center;">¿Fue un error? Puedes reactivar tu suscripción en cualquier momento antes del ${fechaFin}.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr><td align="center">
              <a href="https://app.smartloadsolution.com/account.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">Reactivar Suscripción →</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr><td align="center">
              <a href="https://app.smartloadsolution.com/plans.html" style="display:inline-block;background:transparent;color:#FF6D4A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #FF6D4A;">Ver Planes →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
          <p style="margin:8px 0 0;color:#64748b;font-size:11px;">Lamentamos verte partir. Si tienes alguna sugerencia para mejorar, <a href="mailto:support@smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">escríbenos</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Template: cambio de plan efectivo ───────────────────────────────────────
function buildPlanChangedEmail(planName, planPrice, isDowngrade) {
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
            <div style="display:inline-block;background:#FF6D4A;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;">PLAN ${planName.toUpperCase()} ACTIVO</div>
          </div>
          <h2 style="margin:0 0 16px;color:#fff;font-size:22px;text-align:center;">
            ${isDowngrade ? `Tu plan es ahora ${planName}` : `¡Plan ${planName} activado! 🚀`}
          </h2>
          <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">
            ${isDowngrade
                ? `Tu cuenta ahora está en el plan <strong style="color:#fff;">Professional</strong> a $${planPrice}/mes.`
                : `Tienes acceso completo a <strong style="color:#fff;">${planName}</strong> por $${planPrice}/mes.`}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr><td align="center">
              <a href="https://app.smartloadsolution.com/app.html" style="display:inline-block;background:#FF6D4A;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">Ir a la App →</a>
            </td></tr>
          </table>
          ${isDowngrade ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr><td align="center">
              <a href="https://app.smartloadsolution.com/plans.html" style="display:inline-block;background:transparent;color:#FF6D4A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #FF6D4A;">Volver a Premium + AI →</a>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
