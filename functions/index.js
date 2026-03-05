/**
 * functions/index.js
 * Cloud Functions para Expediter / Smart Load Solution
 *
 * stripeWebhook  — recibe checkout.session.completed de Stripe
 *                  y dispara el evento Purchase a la Meta Conversions API
 */

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");

setGlobalOptions({ maxInstances: 10 });

// ─── Constantes ───────────────────────────────────────────────────────────────
const META_PIXEL_ID = "1227322958231625";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ─── Webhook handler ──────────────────────────────────────────────────────────
exports.stripeWebhook = onRequest(
    { cors: false },
    async (req, res) => {

        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        // 1. Verificar firma de Stripe (sin SDK — solo crypto nativo)
        const sig = req.headers["stripe-signature"];
        if (!sig || !STRIPE_WEBHOOK_SECRET) {
            logger.error("[stripeWebhook] Falta stripe-signature o STRIPE_WEBHOOK_SECRET");
            res.status(400).send("Missing signature");
            return;
        }

        let event;
        try {
            event = verifyStripeSignature(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            logger.error("[stripeWebhook] Firma inválida:", err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }

        logger.info("[stripeWebhook] Evento recibido:", event.type);

        // 2. Solo procesar checkout completado
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            logger.info("[stripeWebhook] Checkout completado:", session.id, "amount:", session.amount_total);

            await sendMetaPurchaseEvent(session);
        }

        res.status(200).json({ received: true });
    }
);

// ─── Verificación de firma Stripe (manual, sin SDK) ───────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
    const parts = sigHeader.split(",");
    let timestamp = null;
    const v1Sigs = [];

    for (const part of parts) {
        const [key, value] = part.split("=");
        if (key === "t") timestamp = value;
        if (key === "v1") v1Sigs.push(value);
    }

    if (!timestamp || v1Sigs.length === 0) {
        throw new Error("Malformed stripe-signature header");
    }

    // Verificar que el timestamp no sea muy viejo (300 segundos = 5 min)
    const timeDiff = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (timeDiff > 300) {
        throw new Error(`Webhook timestamp too old: ${timeDiff}s`);
    }

    const payload = typeof rawBody === "string"
        ? rawBody
        : rawBody.toString("utf8");

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(signedPayload, "utf8")
        .digest("hex");

    const isValid = v1Sigs.some((s) => s === expectedSig);
    if (!isValid) throw new Error("Stripe signature mismatch");

    return JSON.parse(payload);
}

// ─── Enviar evento Purchase a Meta Conversions API ────────────────────────────
async function sendMetaPurchaseEvent(session) {
    if (!META_ACCESS_TOKEN) {
        logger.error("[sendMetaPurchaseEvent] META_ACCESS_TOKEN no configurado");
        return;
    }

    // Hashear el email (requerido por Meta)
    const email = session.customer_details?.email || "";
    const hashedEmail = email
        ? crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex")
        : null;

    const eventPayload = {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: session.id,                          // deduplicación con pixel del browser
        event_source_url: "https://smartloadsolution.com/app.html",
        action_source: "website",
        user_data: {
            em: hashedEmail ? [hashedEmail] : [],          // email hasheado SHA-256
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
