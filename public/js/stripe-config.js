/**
 * stripe-config.js
 * Integración con Stripe para Expediter
 * Version: 3.5.1
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
    professional: 'price_1T4CmZPrcqI2pVW0wjZkexA8', // $14.99/mes — LIVE
    premium: 'price_1T4CpaPrcqI2pVW0EgoJJq6Q'        // $29.99/mes — LIVE
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
        debugLog('[STRIPE] Error getting user plan:', error);
        return 'free';
    }
}

/**
 * Verificar si usuario puede hacer una acción.
 * Usa canAccessFeature() y canCreateMoreLoads() de userPlans.js.
 */
async function canUserPerformAction(action) {
    if (!window.currentUser) return false;

    // Usar plan cacheado por config.js (evita extra Firestore read en cada acción)
    // Fallback a getUserPlan() solo si el caché no está disponible aún
    const userPlan = window.userPlan || await window.getUserPlan(window.currentUser.uid);
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
            showToast(window.i18n?.t('stripe.upgrade_prompt') || '🔒 Esta función requiere un plan superior. Ve a Planes para más info.', 'warning');
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
    if (!priceId) { debugLog('[STRIPE] Invalid plan:', targetPlan); return; }

    if (typeof window.trackMeta === 'function') {
        const planData = window.PLANS && window.PLANS[targetPlan];
        window.trackMeta('InitiateCheckout', { value: planData ? planData.price : 0, currency: 'USD', plan: targetPlan });
    }

    try {
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.upgrade_starting') || 'Iniciando upgrade de plan...', 'info');

        const checkoutSessionRef = await firebase.firestore()
            .collection('customers')
            .doc(user.uid)
            .collection('checkout_sessions')
            .add({
                price: priceId,
                success_url: window.location.origin + '/app.html?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: window.location.href,
                metadata: {
                    plan: targetPlan,
                    firebaseId: user.uid,
                    upgrading_from_subscription: currentSubscriptionId
                }
            });

        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.waiting_server') || 'Esperando respuesta del servidor...', 'info');

        const unsubscribe = checkoutSessionRef.onSnapshot((snap) => {
            const data = snap.data();
            if (!data) return;
            if (data.error) {
                debugLog('❌ Stripe error:', data.error);
                if (typeof showToast === 'function') showToast('Error: ' + data.error.message, 'error');
                unsubscribe();
                return;
            }
            if (data.url) {
                if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.redirecting') || 'Redirigiendo a Stripe...', 'success');
                window.location.assign(data.url);
                unsubscribe();
            }
        });

        setTimeout(() => { unsubscribe(); }, 15000);
    } catch (error) {
        debugLog('Error creating upgrade checkout:', error);
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.error_upgrade') || 'Error al iniciar upgrade', 'error');
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
        debugLog('[STRIPE] Invalid plan or no priceId:', planId);
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
            debugLog('[STRIPE] Sub activa detectada, se cancelará al completar checkout:', existingSubId);
        }
    } catch (e) {
        debugLog('[STRIPE] No se pudo detectar sub existente:', e.message);
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
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.checkout_starting') || 'Iniciando sesión de pago...', 'info');

        // Crear checkout session usando Firebase Extension
        // DEBE coincidir con la colección configurada en la extensión (customers)
        const checkoutSessionRef = await firebase.firestore()
            .collection('customers')
            .doc(user.uid)
            .collection('checkout_sessions')
            .add({
                price: priceId,
                success_url: window.location.origin + '/app.html?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: window.location.href,
                metadata: {
                    plan: planId,
                    firebaseId: user.uid,
                    ...(existingSubId ? { upgrading_from_subscription: existingSubId } : {})
                }
            });

        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.waiting_server') || 'Esperando respuesta del servidor...', 'info');

        // Esperar a que se genere la URL
        const unsubscribe = checkoutSessionRef.onSnapshot((snap) => {
            const data = snap.data();

            if (!data) return; // Esperando datos...

            if (data.error) {
                debugLog('❌ Error devuelto por Stripe:', data.error);
                if (typeof showToast === 'function') showToast('Error: ' + data.error.message, 'error');
                unsubscribe();
                return;
            }

            if (data.url) {
                if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.redirecting') || 'Redirigiendo a Stripe...', 'success');
                window.location.assign(data.url);
                unsubscribe();
            }
        });

        // Timeout de seguridad (15 segundos)
        setTimeout(() => {
            unsubscribe(); // Detener escucha silenciosamente si el usuario ya se fue o si falló
        }, 15000);

    } catch (error) {
        debugLog('Error creating checkout:', error);
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.error_checkout') || 'Error al iniciar proceso de pago', 'error');
    }
}

/**
 * Manejar resultado de checkout
 */
async function handleCheckoutResult() {
    // Detectar regreso del portal de Stripe
    const _portalTs = localStorage.getItem('returningFromPortal');
    if (_portalTs && (Date.now() - parseInt(_portalTs)) < 300000) {
        localStorage.removeItem('returningFromPortal');
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.syncing_plan') || 'Sincronizando tu plan... ⏳', 'info');

        // Bug #8 fix: detectar cambio de plan vía portal AQUÍ (no en el flujo de session_id)
        const planAntes = localStorage.getItem('planBeforePortal');
        if (planAntes) {
            // Esperar a que el webhook actualice el plan (puede tardar unos segundos)
            await new Promise(resolve => setTimeout(resolve, 3000));
            const authUser = firebase.auth().currentUser;
            if (authUser) {
                const planAhoraObj = typeof window.getUserPlan === 'function'
                    ? await window.getUserPlan(authUser.uid)
                    : null;
                const planAhora = planAhoraObj?.id;
                if (planAhora && planAntes !== planAhora && planAhoraObj) {
                    localStorage.removeItem('planBeforePortal');
                    // Email manejado por webhook customer.subscription.updated en functions/index.js
                    debugLog('[STRIPE] Plan actualizado vía portal:', planAhora);
                } else {
                    localStorage.removeItem('planBeforePortal');
                }
            }
        }

        window.location.reload();
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (!sessionId) return;

    // Limpiar URL inmediatamente
    window.history.replaceState({}, document.title, '/app.html');

    // Esperar a que Firebase Auth restaure la sesión (currentUser es null en DOMContentLoaded)
    const unsubscribeAuth = firebase.auth().onAuthStateChanged(async (user) => {
        unsubscribeAuth(); // Solo escuchar una vez

        if (!user) {
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        // ✅ Bug #3 fix: toast DENTRO del callback, después de confirmar auth
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.subscribed_ok') || '¡Suscripción activada exitosamente! 🎉', 'success');

        // META PIXEL
        if (typeof window.trackMeta === 'function') {
            window.trackMeta('Purchase', { currency: 'USD', value: 0 });
        } else if (typeof window.fbq === 'function') {
            window.fbq('track', 'Purchase', { currency: 'USD', value: 0 }, { eventID: sessionId });
        }

        // Email de activación: el backend (functions/index.js) ya lo envía vía invoice.payment_succeeded
        // No duplicar aquí para evitar doble email al usuario.

        // Detectar upgrade/downgrade via portal de Stripe
        const planAntes = localStorage.getItem('planBeforePortal');
        if (planAntes) {
            // Bug #5 fix: no redeclarar 'user' — usar el del parámetro del callback
            const planAhoraObj = await window.getUserPlan(user.uid);
            const planAhora = planAhoraObj?.id;

            if (planAhora && planAntes !== planAhora) {
                localStorage.removeItem('planBeforePortal');
                // Email manejado por webhook customer.subscription.updated en functions/index.js
                debugLog('[STRIPE] Plan cambiado via session_id:', planAhora);
            } else {
                localStorage.removeItem('planBeforePortal');
            }
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

    const confirmed = confirm(window.i18n?.t('stripe.cancel_confirm') || '¿Estás seguro que quieres cancelar tu suscripción? Perderás acceso a las funciones premium al final del período de facturación.');
    if (!confirmed) return;

    try {
        showToast(window.i18n?.t('stripe.canceling') || 'Cancelando suscripción...', 'info');

        const functionRef = firebase.app().functions('us-central1').httpsCallable('cancelUserSubscription');
        await functionRef({});

        showToast(window.i18n?.t('stripe.canceled_ok') || 'Suscripción programada para cancelar al final del período', 'info');
        setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
        debugLog('Error canceling subscription:', error);
        showToast((window.i18n?.t('stripe.error_cancel') || 'Error al cancelar suscripción') + ': ' + (error.message || (window.i18n?.t('common.try_again') || 'intenta de nuevo')), 'error');
    }
}

/**
 * Portal de facturación (customer portal)
 */
async function openBillingPortal() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        showToast(window.i18n?.t('stripe.portal_opening') || 'Abriendo portal de facturación...', 'info');

        const functionRef = firebase
            .app()
            .functions('us-central1')
            .httpsCallable('ext-firestore-stripe-payments-createPortalLink');

        const { data } = await functionRef({
            returnUrl: window.location.origin + '/app.html',
            locale: 'auto'
        });

        localStorage.setItem('returningFromPortal', Date.now().toString());
        localStorage.setItem('planBeforePortal', await getCurrentUserPlan());
        window.location.assign(data.url);

    } catch (error) {
        localStorage.removeItem('returningFromPortal');
        debugLog('Error opening portal:', error);
        showToast(window.i18n?.t('stripe.error_portal') || 'Error al abrir portal de facturación', 'error');
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
