/**
 * sw-register.js
 * Registro del Service Worker TEMPORALMENTE DESACTIVADO
 * Para resolver problemas de caché persistente
 */

// ========================================
// SERVICE WORKER DESACTIVADO TEMPORALMENTE
// ========================================

debugLog('⚠️ Service Worker registration DISABLED for debugging');
debugLog('   Los cambios se verán INMEDIATAMENTE sin caché');

// Desregistrar cualquier Service Worker existente
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            debugLog('🗑️ Service Worker removed');
        }
    });
}

// CÓDIGO ORIGINAL COMENTADO - Reactivar después
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        registerServiceWorker();
    });
}

async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
        });

        debugLog('✅ Service Worker registered:', registration.scope);

        // Manejar actualizaciones
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Hay una nueva versión disponible
                    showUpdateNotification();
                }
            });
        });

        // Check for updates periodically (cada hora)
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000);

    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
    }
}

function showUpdateNotification() {
    const message = '🎉 Nueva versión disponible! Actualizar ahora?';

    if (confirm(message)) {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    }
}
*/

debugLog('📦 Service Worker registration script loaded (DISABLED MODE)');
