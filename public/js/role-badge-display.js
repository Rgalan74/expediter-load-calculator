/**
 * Role Badge Display
 * Muestra el badge visual del rol del usuario en el header
 */

// Configuración de estilos por rol
const ROLE_BADGE_CONFIG = {
    admin: {
        icon: '👑',
        text: 'Admin',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-900',
        borderColor: 'border-purple-400'
    },
    developer: {
        icon: '💻',
        text: 'Developer',
        bgColor: 'bg-green-100',
        textColor: 'text-green-900',
        borderColor: 'border-green-400'
    },
    user: {
        icon: '👤',
        text: 'User',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-900',
        borderColor: 'border-gray-400'
    }
};

/**
 * Mostrar badge de rol en el header
 */
let roleBadgeRetryCount = 0;
const MAX_ROLE_BADGE_RETRIES = 10;

async function showRoleBadge() {
    // Esperar a que rolesManager esté disponible
    if (!window.rolesManager) {
        roleBadgeRetryCount++;

        if (roleBadgeRetryCount >= MAX_ROLE_BADGE_RETRIES) {
            console.warn('⚠️ RolesManager no disponible después de 10 intentos, abandonando...');
            return;
        }

        console.log(`⏳ RolesManager no disponible aún, reintentando... (${roleBadgeRetryCount}/${MAX_ROLE_BADGE_RETRIES})`);
        setTimeout(showRoleBadge, 500);
        return;
    }

    // Verificar que el rol esté REALMENTE cargado (no solo que exista la instancia)
    const role = window.rolesManager.getUserRole();

    if (!role || role === null) {
        roleBadgeRetryCount++;

        if (roleBadgeRetryCount >= MAX_ROLE_BADGE_RETRIES) {
            console.warn('⚠️ Rol de usuario no cargado después de 10 intentos, usando default');
            // Mostrar badge de user por defecto
        } else {
            console.log(`⏳ Esperando a que RolesManager cargue el rol... (${roleBadgeRetryCount}/${MAX_ROLE_BADGE_RETRIES})`);
            setTimeout(showRoleBadge, 500);
            return;
        }
    }

    // Reset counter on success
    roleBadgeRetryCount = 0;

    try {
        const config = ROLE_BADGE_CONFIG[role] || ROLE_BADGE_CONFIG.user;

        const badge = document.getElementById('roleBadge');
        const icon = document.getElementById('roleBadgeIcon');
        const text = document.getElementById('roleBadgeText');

        if (!badge || !icon || !text) {
            console.warn('⚠️ Elementos del badge de rol no encontrados en DOM');
            return;
        }

        // Configurar contenido
        icon.textContent = config.icon;
        text.textContent = config.text;

        // Limpiar clases anteriores
        badge.className = 'flex items-center px-2 py-0.5 md:px-3 md:py-1.5 rounded-full text-xs font-bold border-2 transition-all';

        // Agregar nuevas clases
        badge.classList.add(config.bgColor, config.textColor, config.borderColor);

        // Mostrar badge
        badge.classList.remove('hidden');

        console.log(`✅ Badge de rol mostrado: ${config.icon} ${config.text}`);

        // Ocultar botón de Mejorar Plan para privilegiados
        hideUpgradePlanForPrivileged();

    } catch (error) {
        console.error('❌ Error mostrando badge de rol:', error);
    }
}

/**
 * Ocultar botón de "Mejorar Plan" para usuarios privilegiados
 * Admin y Developer no necesitan mejorar plan
 */
function hideUpgradePlanForPrivileged() {
    if (!window.rolesManager) return;

    const isPrivileged = window.rolesManager.isPrivileged();
    const upgradeBtn = document.getElementById('upgradePlanBtn');

    if (upgradeBtn && isPrivileged) {
        upgradeBtn.style.display = 'none';
        console.log('🔒 Botón "Mejorar Plan" oculto para usuario privilegiado');
    }
}

/**
 * Ocultar badge de rol
 */
function hideRoleBadge() {
    const badge = document.getElementById('roleBadge');
    if (badge) {
        badge.classList.add('hidden');
    }
}

/**
 * Actualizar badge cuando cambia el rol
 */
function refreshRoleBadge() {
    hideRoleBadge();
    setTimeout(showRoleBadge, 100);
}

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco para que todo cargue
    setTimeout(showRoleBadge, 1500);
});

// Exportar funciones
window.showRoleBadge = showRoleBadge;
window.hideRoleBadge = hideRoleBadge;
window.refreshRoleBadge = refreshRoleBadge;

console.log('✅ role-badge-display.js cargado');
