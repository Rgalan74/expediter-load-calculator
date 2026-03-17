/**
 * stripe-config.js
 * Integración con Stripe para Expediter
 * Version: 2.0.0
 *
 * IMPORTANTE: Los planes se definen en userPlans.js (window.PLANS)
 * Este archivo solo maneja la integración de pagos con Stripe.
 * ⚠️ Si cambias precios en userPlans.js, actualiza también en Stripe Dashboard.
 */

// ========================================
// CONFIGURACIÓN DE STRIPE
// ========================================

// Mapeo de plan IDs a Stripe Price IDs
// ⚠️ ACTUALIZAR estos IDs cuando cambien los precios en Stripe Dashboard
// ⚠️ Para cambiar entre TEST y LIVE, cambia IS_TEST_MODE
const STRIPE_PRICE_MAP = {
    free: null,
    professional: 'price_1TBzVvPrcqI2pVW0NGKl0Znw', // LIVE TEST $1.00
    premium: 'price_1TBzXhPrcqI2pVW0bToystoo'        // LIVE TEST $1.50
};

// ========================================
// FUNCIONES DE VERIFICACIÓN
// ========================================

/**
 * Obtener plan actual del usuario.
 * Usa getUserPlan() de userPlans.js como fuente de verdad.
 */
async function getCurrentUserPlan() {
    if (!window.currentUser) return 'free';
    try {
        const plan = await window.getUserPlan(window.currentUser.uid);
        return plan?.id || 'free';
    } catch (error) {
        console.error('[STRIPE] Error getting user plan:', error);
        return 'free';
    }
}

/**
 * Verificar si usuario puede hacer una acción.
 * Usa canAccessFeature() y canCreateMoreLoads() de userPlans.js.
 */
async function canUserPerformAction(action) {
    if (!window.currentUser) return false;
    const userPlan = await window.getUserPlan(window.currentUser.uid);
    if (!userPlan) return false;

    switch (action) {
        case 'calculate':
        case 'loads':
            return window.canCreateMoreLoads(userPlan);
        case 'lex':
            return window.canAccessFeature(userPlan, 'Lex');
        case 'accounts':
            return window.canAccessFeature(userPlan, 'Accounts');
        case 'advancedReports':
            return window.canAccessFeature(userPlan, 'AdvancedReports');
        case 'taxReports':
            return window.canAccessFeature(userPlan, 'TaxReports');
        case 'exportAdvanced':
            return window.canAccessFeature(userPlan, 'ExportAdvanced');
        default:
            // Finanzas y Zonas están disponibles para todos
            return true;
    }
}

// showUpgradeModal se define en userPlans.js — no duplicar aquí
// Solo dejamos la referencia para consistencia
function stripeShowUpgradePrompt(feature) {
    // Delega al modal de userPlans.js
    if (typeof window.showUpgradeModal === 'function') {
        window.showUpgradeModal(feature);
    } else {
        // Fallback con toast si el modal no está disponible
        if (typeof showToast === 'function') {
            showToast('🔒 Esta función requiere un plan superior. Ve a Planes para más info.', 'warning');
        }
    }
}

// ========================================
// INTEGRACIÓN CON STRIPE CHECKOUT
// ========================================

/**
 * Upgrade desde Professional → Premium.
 * Pasa el subscriptionId actual en metadata para que el backend lo cancele.
 */
async function upgradeSubscription(targetPlan) {
    const user = firebase.auth().currentUser;
    if (!user) { window.location.href = '/auth.html'; return; }

    const currentPlan = await window.getUserPlan(user.uid);
    const currentSubscriptionId = currentPlan?.subscriptionId || null;

    if (!currentSubscriptionId) {
        // Sin suscripción activa — checkout normal
        return createCheckoutSession(targetPlan);
    }

    const priceId = STRIPE_PRICE_MAP[targetPlan];
    if (!priceId) { console.error('[STRIPE] Invalid plan:', targetPlan); return; }

    if (typeof window.trackMeta === 'function') {
        const planData = window.PLANS && window.PLANS[targetPlan];
        window.trackMeta('InitiateCheckout', { value: planData ? planData.price : 0, currency: 'USD', plan: targetPlan });
    }

    try {
        if (typeof showToast === 'function') showToast('Iniciando upgrade de plan...', 'info');

        const checkoutSessionRef = await firebase.firestore()
            .collection('customers')
            .doc(user.uid)
            .collection('checkout_sessions')
            .add({
                price: priceId,
                success_url: window.location.origin + '/app.html?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: window.location.origin + '/plans.html',
                metadata: {
                    plan: targetPlan,
                    firebaseId: user.uid,
                    upgrading_from_subscription: currentSubscriptionId
                }
            });

        if (typeof showToast === 'function') showToast('Esperando respuesta del servidor...', 'info');

        const unsubscribe = checkoutSessionRef.onSnapshot((snap) => {
            const data = snap.data();
            if (!data) return;
            if (data.error) {
                console.error('❌ Stripe error:', data.error);
                if (typeof showToast === 'function') showToast('Error: ' + data.error.message, 'error');
                unsubscribe();
                return;
            }
            if (data.url) {
                if (typeof showToast === 'function') showToast('Redirigiendo a Stripe...', 'success');
                window.location.assign(data.url);
                unsubscribe();
            }
        });

        setTimeout(() => { unsubscribe(); }, 15000);
    } catch (error) {
        console.error('Error creating upgrade checkout:', error);
        if (typeof showToast === 'function') showToast('Error al iniciar upgrade', 'error');
    }
}

/**
 * Crear checkout session para suscripción
 */
async function createCheckoutSession(planId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = '/auth.html';
        return;
    }

    const priceId = STRIPE_PRICE_MAP[planId];
    if (!priceId) {
        console.error('[STRIPE] Invalid plan or no priceId:', planId);
        return;
    }

    // Detectar suscripción activa existente para que el backend la cancele al completar
    let existingSubId = null;
    try {
        const existingSubs = await firebase.firestore()
            .collection('customers').doc(user.uid)
            .collection('subscriptions')
            .where('status', '==', 'active')
            .limit(1)
            .get();
        if (!existingSubs.empty) {
            existingSubId = existingSubs.docs[0].id;
            console.log('[STRIPE] Sub activa detectada, se cancelará al completar checkout:', existingSubId);
        }
    } catch (e) {
        console.warn('[STRIPE] No se pudo detectar sub existente:', e.message);
    }

    // ✅ META PIXEL: Intención de pago confirmada
    if (typeof window.trackMeta === 'function') {
        const planData = window.PLANS && window.PLANS[planId];
        window.trackMeta('InitiateCheckout', {
            value: planData ? planData.price : 0,
            currency: 'USD',
            plan: planId
        });
    }

    try {
        if (typeof showToast === 'function') showToast('Iniciando sesión de pago...', 'info');

        // Crear checkout session usando Firebase Extension
        // DEBE coincidir con la colección configurada en la extensión (customers)
        const checkoutSessionRef = await firebase.firestore()
            .collection('customers')
            .doc(user.uid)
            .collection('checkout_sessions')
            .add({
                price: priceId,
                success_url: window.location.origin + '/app.html?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: window.location.origin + '/plans.html',
                metadata: {
                    plan: planId,
                    firebaseId: user.uid,
                    ...(existingSubId ? { upgrading_from_subscription: existingSubId } : {})
                }
            });

        if (typeof showToast === 'function') showToast('Esperando respuesta del servidor...', 'info');

        // Esperar a que se genere la URL
        const unsubscribe = checkoutSessionRef.onSnapshot((snap) => {
            const data = snap.data();

            if (!data) return; // Esperando datos...

            if (data.error) {
                console.error('❌ Error devuelto por Stripe:', data.error);
                if (typeof showToast === 'function') showToast('Error: ' + data.error.message, 'error');
                unsubscribe();
                return;
            }

            if (data.url) {
                if (typeof showToast === 'function') showToast('Redirigiendo a Stripe...', 'success');
                window.location.assign(data.url);
                unsubscribe();
            }
        });

        // Timeout de seguridad (15 segundos)
        setTimeout(() => {
            unsubscribe(); // Detener escucha silenciosamente si el usuario ya se fue o si falló
        }, 15000);

    } catch (error) {
        console.error('Error creating checkout:', error);
        if (typeof showToast === 'function') showToast('Error al iniciar proceso de pago', 'error');
    }
}

/**
 * Manejar resultado de checkout
 */
async function handleCheckoutResult() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (!sessionId) return;

    showToast('¡Suscripción activada exitosamente! 🎉', 'success');

    // Limpiar URL inmediatamente
    window.history.replaceState({}, document.title, '/app.html');

    // Esperar a que Firebase Auth restaure la sesión (currentUser es null en DOMContentLoaded)
    const unsubscribeAuth = firebase.auth().onAuthStateChanged(async (user) => {
        unsubscribeAuth(); // Solo escuchar una vez

        // META PIXEL
        if (typeof window.trackMeta === 'function') {
            window.trackMeta('Purchase', { currency: 'USD', value: 0 });
        } else if (typeof window.fbq === 'function') {
            window.fbq('track', 'Purchase', { currency: 'USD', value: 0 }, { eventID: sessionId });
        }

        if (!user) {
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        // Email de confirmación de upgrade
        try {
            // Esperar 4s para que el webhook procese el plan antes de leerlo
            await new Promise(resolve => setTimeout(resolve, 4000));

            const userPlan = typeof window.getUserPlan === 'function'
                ? await window.getUserPlan(user.uid)
                : null;
            const planName = userPlan?.name || 'Professional';
            const planPrice = userPlan?.price || '14.99';

            await firebase.firestore().collection('mail').add({
                to: [user.email],
                message: {
                    subject: `¡Bienvenido al Plan ${planName}! 🎉`,
                    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
            <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Inteligencia de Carga para el Transportista Moderno</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <div style="text-align:center;margin-bottom:28px;">
              <div style="display:inline-block;background:#FF6D4A;color:#ffffff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;">PLAN ${planName.toUpperCase()} ACTIVADO</div>
            </div>
            <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;text-align:center;">¡Tu suscripción está activa! 🚀</h2>
            <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">Ahora tienes acceso completo a todas las funciones del Plan ${planName} por $${planPrice}/mes.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:28px;">
              <tr><td>
                <p style="margin:0 0 16px;color:#FF6D4A;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Lo que incluye tu plan</p>
                <table width="100%">
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Cargas ilimitadas</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Dashboard financiero completo</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Análisis de zonas y mercados</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Reportes avanzados</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Smart Load Academy</td></tr>
                  ${planName === 'Premium + AI' ? '<tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Lex AI Assistant</td></tr>' : ''}
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://smartloadsolution.com/app.html" style="display:inline-block;background:#FF6D4A;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">Ir a la App →</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
            <p style="margin:8px 0 0;color:#64748b;font-size:11px;">Recibiste este email porque activaste una suscripción en nuestra plataforma.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
                }
            });
            console.log('✅ Email de upgrade enviado');
        } catch (emailError) {
            console.error('❌ Error enviando email de upgrade:', emailError);
        }

        // Recargar para reflejar el nuevo plan
        window.location.reload();
    });
}

/**
 * Cancelar suscripción
 */
async function cancelSubscription() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const confirmed = confirm('¿Estás seguro que quieres cancelar tu suscripción? Perderás acceso a las funciones premium al final del período de facturación.');

    if (!confirmed) return;

    try {
        // Marcar para cancelación al final del período
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .update({
                'subscription.cancel_at_period_end': true
            });

        showToast('Suscripción programada para cancelar al final del período', 'info');

        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error('Error canceling subscription:', error);
        showToast('Error al cancelar suscripción', 'error');
    }
}

/**
 * Portal de facturación (customer portal)
 */
async function openBillingPortal() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        showToast('Abriendo portal de facturación...', 'info');

        const functionRef = firebase
            .app()
            .functions('us-central1')
            .httpsCallable('ext-firestore-stripe-payments-createPortalLink');

        const { data } = await functionRef({
            returnUrl: window.location.origin + '/app.html',
            locale: 'auto'
        });

        window.location.assign(data.url);

    } catch (error) {
        console.error('Error opening portal:', error);
        showToast('Error al abrir portal de facturación', 'error');
    }
}

// ========================================
// INICIALIZACIÓN
// ========================================

// Verificar resultado de checkout al cargar
if (window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', handleCheckoutResult);
}

// Exportar funciones globales
window.StripeIntegration = {
    getCurrentUserPlan,
    canUserPerformAction,
    showUpgradePrompt: stripeShowUpgradePrompt,
    createCheckoutSession,
    upgradeSubscription,
    cancelSubscription,
    openBillingPortal,
    STRIPE_PRICE_MAP
};

debugLog('[STRIPE] Stripe Integration loaded');
