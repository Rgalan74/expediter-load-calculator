/**
 * sw-register.js
 * Registro y manejo del Service Worker
 */

// ========================================
// REGISTRO DEL SERVICE WORKER
// ========================================

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

        console.log('✅ Service Worker registered:', registration.scope);

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

// ========================================
// NOTIFICACIÓN DE ACTUALIZACIÓN
// ========================================

function showUpdateNotification() {
    // Mostrar notificación al usuario
    const message = '🎉 Nueva versión disponible! Actualizar ahora?';

    if (confirm(message)) {
        // Activar nueva versión
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }

        // Recargar página
        window.location.reload();
    }
}

// ========================================
// UTILIDADES
// ========================================

/**
 * Forzar actualización del Service Worker
 */
window.updateServiceWorker = async function () {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
        await registration.update();
        console.log('🔄 Service Worker update triggered');
    }
};

/**
 * Limpiar cache manualmente
 */
window.clearServiceWorkerCache = async function () {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration && registration.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
        console.log('🗑️ Cache cleared');

        // Reload después de limpiar
        setTimeout(() => window.location.reload(), 500);
    }
};

/**
 * Desregistrar Service Worker (para debugging)
 */
window.unregisterServiceWorker = async function () {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
        await registration.unregister();
        console.log('❌ Service Worker unregistered');
        window.location.reload();
    }
};

// ========================================
// STATUS EN CONSOLA
// ========================================

navigator.serviceWorker.ready.then((registration) => {
    console.log('📦 Service Worker status: READY');
    console.log('   Scope:', registration.scope);
    console.log('   Active:', registration.active ? 'YES' : 'NO');
});

console.log('📦 Service Worker registration script loaded');
