/**
 * stripe-config.js
 * Configuración de Stripe para Expediter
 * Version: 1.0.0
 */

// ========================================
// CONFIGURACIÓN
// ========================================

// Planes disponibles (definir IDs después de crear en Stripe)
const STRIPE_PLANS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        priceId: null, // No tiene precio en Stripe
        features: {
            calculations: 5,
            history: false,
            zones: false,
            reports: false,
            lex: false,
            export: false
        }
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        price: 9.99,
        priceId: 'price_1SgAxCLwtUKgOVkpzgR6MWwJ', // ID real de Stripe
        features: {
            calculations: -1, // Ilimitado
            history: 90, // 90 días
            zones: true,
            reports: 'basic',
            lex: false,
            export: 'pdf'
        }
    },
    PREMIUM: {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        priceId: 'price_1SgAxwLwtUKgOVkpDRkLMtqL', // ID real de Stripe
        features: {
            calculations: -1, // Ilimitado
            history: -1, // Ilimitado
            zones: true,
            reports: 'advanced',
            lex: true,
            export: 'all',
            tax: true,
            priority: true
        }
    }
};

// ========================================
// FUNCIONES DE VERIFICACIÓN
// ========================================

/**
 * Obtener plan actual del usuario
 */
async function getCurrentUserPlan() {
    const user = firebase.auth().currentUser;
    if (!user) return STRIPE_PLANS.FREE.id;

    try {
        // La extensión guarda las suscripciones activas en la subcolección 'subscriptions'
        // de la colección 'customers'
        const snapshot = await firebase.firestore()
            .collection('customers')
            .doc(user.uid)
            .collection('subscriptions')
            .where('status', 'in', ['active', 'trialing'])
            .get();

        if (snapshot.empty) return STRIPE_PLANS.FREE.id;

        // Verificar el rol o producto de la primera suscripción activa
        const subData = snapshot.docs[0].data();
        // Mapear role/price a nuestro ID interno
        return subData.role || STRIPE_PLANS.FREE.id;
    } catch (error) {
        console.error('Error getting user plan:', error);
        return STRIPE_PLANS.FREE.id;
    }
}

/**
 * Verificar si usuario puede hacer una acción
 */
async function canUserPerformAction(action) {
    const currentPlan = await getCurrentUserPlan();
    const plan = Object.values(STRIPE_PLANS).find(p => p.id === currentPlan) || STRIPE_PLANS.FREE;

    switch (action) {
        case 'calculate':
            if (plan.features.calculations === -1) return true;
            // Verificar límite mensual
            const count = await getMonthlyCalculationCount();
            return count < plan.features.calculations;

        case 'history':
            return plan.features.history !== false;

        case 'zones':
            return plan.features.zones === true;

        case 'reports':
            return plan.features.reports !== false;

        case 'lex':
            return plan.features.lex === true;

        case 'export':
            return plan.features.export !== false;

        default:
            return false;
    }
}

/**
 * Obtener contador de cálculos del mes actual
 */
async function getMonthlyCalculationCount() {
    const user = firebase.auth().currentUser;
    if (!user) return 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
        const snapshot = await firebase.firestore()
            .collection('loads')
            .where('userId', '==', user.uid)
            .where('timestamp', '>=', startOfMonth)
            .get();

        return snapshot.size;
    } catch (error) {
        console.error('Error getting calculation count:', error);
        return 0;
    }
}

/**
 * Mostrar modal de upgrade si no puede hacer algo
 */
function showUpgradeModal(feature) {
    const messages = {
        calculate: 'Has alcanzado el límite de 5 cálculos este mes. Upgradeate a Pro para cálculos ilimitados.',
        history: 'El historial solo está disponible en planes Pro y Premium.',
        zones: 'El análisis de zonas solo está disponible en planes Pro y Premium.',
        reports: 'Los reportes financieros solo están disponibles en planes Pro y Premium.',
        lex: 'Lex AI solo está disponible en el plan Premium.',
        export: 'La exportación solo está disponible en planes Pro y Premium.'
    };

    const message = messages[feature] || 'Esta función no está disponible en tu plan actual.';

    // Mostrar modal
    showModal({
        title: '🔒 Función Premium',
        message: message,
        buttons: [
            {
                text: 'Ver Planes',
                class: 'btn-primary',
                onClick: () => window.location.href = '/plans.html'
            },
            {
                text: 'Cancelar',
                class: 'btn-secondary'
            }
        ]
    });
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

    const plan = Object.values(STRIPE_PLANS).find(p => p.id === planId);
    if (!plan || !plan.priceId) {
        console.error('Invalid plan:', planId);
        return;
    }

    try {
        showToast('Iniciando sesión de pago...', 'info');

        // Crear checkout session usando Firebase Extension
        // DEBE coincidir con la colección configurada en la extensión (customers)
        const checkoutSessionRef = await firebase.firestore()
            .collection('customers')
            .doc(user.uid)
            .collection('checkout_sessions')
            .add({
                price: plan.priceId,
                success_url: window.location.origin + '/app.html?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: window.location.origin + '/plans.html',
                metadata: {
                    plan: planId,
                    firebaseId: user.uid // Backup ID
                }
            });

        showToast('Esperando respuesta del servidor...', 'info');

        // Esperar a que se genere la URL
        const unsubscribe = checkoutSessionRef.onSnapshot((snap) => {
            const data = snap.data();

            if (!data) return; // Esperando datos...

            if (data.error) {
                console.error('❌ Error devuelto por Stripe:', data.error);
                showToast('Error: ' + data.error.message, 'error');
                unsubscribe();
                return;
            }

            if (data.url) {
                showToast('Redirigiendo a Stripe...', 'success');
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
        showToast('Error al iniciar proceso de pago', 'error');
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
    showUpgradeModal,
    createCheckoutSession,
    cancelSubscription,
    openBillingPortal,
    PLANS: STRIPE_PLANS
};

console.log('📦 Stripe Integration loaded');
