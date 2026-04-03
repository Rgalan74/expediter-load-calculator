/**
 * sw-register.js
 * Registro del Service Worker — ACTIVO
 */

// Registrar Service Worker al cargar la página
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
                    showUpdateNotification();
                }
            });
        });

        // Verificar actualizaciones cada hora
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000);

    } catch (error) {
        debugLog('❌ Service Worker registration failed:', error);
    }
}

// M2 fix: usar toast en lugar de confirm() nativo (mejor UX mobile)
function showUpdateNotification() {
    if (typeof showToast === 'function') {
        showToast(window.i18n?.t('pwa.new_version') || '🎉 Nueva versión disponible. Recarga para actualizar.', 'info');
        // Auto-recargar después de 5s con el nuevo SW activo
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        setTimeout(() => window.location.reload(), 5000);
    } else {
        // Fallback silencioso — SW se activará en la próxima carga normal
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
    }
}

debugLog('📦 Service Worker registration script loaded');
