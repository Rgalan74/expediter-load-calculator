/*
// read-only-mode.js - Protección para V2
// Permite leer datos reales de Firebase sin modificarlos

window.V2_READ_ONLY_MODE = true; // ← NUNCA cambiar a false en V2

debugLog('🔒 V2 READ-ONLY MODE ACTIVADO');
debugLog('⚠️  Esta versión NO puede modificar datos en Firebase');

// Interceptar y bloquear operaciones de escritura
const originalFirestore = window.firebase ? window.firebase.firestore : null;

if (originalFirestore) {
    // Guardar referencias originales
    const originalDelete = firebase.firestore.DocumentReference.prototype.delete;
    const originalSet = firebase.firestore.DocumentReference.prototype.set;
    const originalUpdate = firebase.firestore.DocumentReference.prototype.update;

    // Sobrescribir métodos de escritura
    firebase.firestore.DocumentReference.prototype.delete = function () {
        console.error('🚫 DELETE bloqueado en V2 READ-ONLY MODE');
        showToast('⚠️ V2 está en modo solo lectura. No se pueden eliminar cargas.', 'warning', 4000);
        return Promise.reject(new Error('Operación bloqueada en modo solo lectura'));
    };

    firebase.firestore.DocumentReference.prototype.set = function () {
        console.error('🚫 SET bloqueado en V2 READ-ONLY MODE');
        showToast('⚠️ V2 está en modo solo lectura. No se pueden guardar cambios.', 'warning', 4000);
        return Promise.reject(new Error('Operación bloqueada en modo solo lectura'));
    };

    firebase.firestore.DocumentReference.prototype.update = function () {
        console.error('🚫 UPDATE bloqueado en V2 READ-ONLY MODE');
        showToast('⚠️ V2 está en modo solo lectura. No se pueden actualizar datos.', 'warning', 4000);
        return Promise.reject(new Error('Operación bloqueada en modo solo lectura'));
    };

    debugLog('✅ Protecciones de solo lectura aplicadas');
}

// Mostrar banner de advertencia
document.addEventListener('DOMContentLoaded', function () {
    // Crear banner de advertencia
    const banner = document.createElement('div');
    banner.id = 'readOnlyBanner';
    banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    padding: 0.75rem;
    text-align: center;
    font-weight: 600;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-size: 0.875rem;
  `;
    banner.innerHTML = `
    ⚠️ VERSIÓN V2 - MODO SOLO LECTURA | 
    Puedes ver todos los datos reales pero NO puedes modificarlos | 
    <span style="font-size: 0.75rem; opacity: 0.9;">Para editar, usa la versión V1 de producción</span>
  `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Ajustar padding del body para el banner
    const appContent = document.getElementById('appContent');
    if (appContent) {
        appContent.style.paddingTop = '3rem';
    }

    debugLog('⚠️ Banner de READ-ONLY mostrado');
});

// Modificar botones de acciones de escritura para mostrar advertencia
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        // Deshabilitar botón de guardar en calculadora
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                showToast('⚠️ V2 está en modo solo lectura. Usa V1 para guardar cargas.', 'warning', 4000);
                return false;
            }, true);

            // Cambiar estilo del botón
            saveBtn.style.opacity = '0.6';
            saveBtn.title = 'Deshabilitado en V2 (solo lectura)';
        }

        debugLog('✅ Botones de escritura protegidos');
    }, 2000);
});

debugLog('🔒 Read-Only Mode cargado y activo');
*/
