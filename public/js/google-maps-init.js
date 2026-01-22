/**
 * google-maps-init.js
 * Inicialización de Google Maps API
 * Extraído de app.html para mejor organización
 * Versión: 1.0.0
 */

/**
 * Función para verificar cuando Google Maps esté listo
 * Se ejecuta periódicamente hasta que la API está disponible
 */
function waitForGoogleMaps() {
    if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
        console.log("✅ Google Maps API disponible");

        // Dar tiempo a que se carguen completamente todos los scripts
        setTimeout(() => {
            if (typeof initMap === 'function') {
                initMap();
            } else {
                console.log("⏳ Esperando función initMap...");
                setTimeout(() => {
                    if (typeof initMap === 'function') {
                        initMap();
                    }
                }, 2000);
            }
        }, 1000);
    } else {
        console.log("⏳ Esperando Google Maps API...");
        setTimeout(waitForGoogleMaps, 1000);
    }
}

/**
 * Iniciar verificación cuando carga la página
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log("🔧 DOM cargado, iniciando verificación de Google Maps en 3 segundos...");
    setTimeout(waitForGoogleMaps, 3000);
});
