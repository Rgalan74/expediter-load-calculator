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
const STRIPE_PRICE_MAP = {
    free: null, // No tiene precio en Stripe
    professional: 'price_1T4CmZPrcqI2pVW0wjZkexA8', // $14.99/mes — VERIFICAR en Stripe
    premium: 'price_1T4CpaPrcqI2pVW0EgoJJq6Q'  // $29.99/mes — VERIFICAR en Stripe
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
            return window.canAccessFeature(userPlan, 'ExportAdvanced') || window.canAccessFeature(userPlan, 'CanExportAdvanced');
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
                    firebaseId: user.uid
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

    if (sessionId) {
        showToast('¡Suscripción activada exitosamente! 🎉', 'success');

        // ✅ META PIXEL: Purchase browser-side (fallback del webhook server-side)
        // event_id = sessionId → Meta deduplica automáticamente con el evento server-side
        if (typeof window.trackMeta === 'function') {
            window.trackMeta('Purchase', {
                currency: 'USD',
                value: 0  // el server-side ya manda el valor real; este es solo fallback
            });
        } else if (typeof window.fbq === 'function') {
            // Fallback si trackMeta no está disponible (ej. usuario llegó directo a app.html)
            window.fbq('track', 'Purchase', { currency: 'USD', value: 0 }, { eventID: sessionId });
        }

        // Limpiar URL
        window.history.replaceState({}, document.title, '/app.html');

        // Recargar datos de usuario
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
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
    cancelSubscription,
    openBillingPortal,
    STRIPE_PRICE_MAP
};

debugLog('[STRIPE] Stripe Integration loaded');
