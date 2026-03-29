/**
 * Role Badge Display
 * Muestra el badge visual del rol del usuario en el header
 */

// Configuración de estilos por rol
const ROLE_BADGE_CONFIG = {
    admin: {
        icon: '👑',
        text: 'Admin',
        bgColor: 'bg-purple-800', // Más oscuro para contraste
        textColor: 'text-white',  // Texto blanco
        borderColor: 'border-purple-900'
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
            debugLog('⚠️ RolesManager no disponible después de 10 intentos, abandonando...');
            return;
        }

        debugLog(`⏳ RolesManager no disponible aún, reintentando... (${roleBadgeRetryCount}/${MAX_ROLE_BADGE_RETRIES})`);
        setTimeout(showRoleBadge, 500);
        return;
    }

    // Verificar que el rol esté REALMENTE cargado (no solo que exista la instancia)
    const role = window.rolesManager.getUserRole();

    if (!role || role === null) {
        roleBadgeRetryCount++;

        if (roleBadgeRetryCount >= MAX_ROLE_BADGE_RETRIES) {
            debugLog('⚠️ Rol de usuario no cargado después de 10 intentos, usando default');
            // Mostrar badge de user por defecto
        } else {
            debugLog(`⏳ Esperando a que RolesManager cargue el rol... (${roleBadgeRetryCount}/${MAX_ROLE_BADGE_RETRIES})`);
            setTimeout(showRoleBadge, 500);
            return;
        }
    }

    // Reset counter on success
    roleBadgeRetryCount = 0;

    try {
        const config = ROLE_BADGE_CONFIG[role] || ROLE_BADGE_CONFIG.user;

        const badge = document.getElementById('roleBadge');
        let icon = document.getElementById('roleBadgeIcon');
        const text = document.getElementById('roleBadgeText');

        // Elementos del menú mobile
        const mobileLink = document.getElementById('mobileRoleLink');
        const mobileIcon = document.getElementById('mobileRoleIcon');
        const mobileText = document.getElementById('mobileRoleText');

        if (!badge || !icon || !text) {
            debugLog('⚠️ Elementos del badge de rol no encontrados en DOM');
            return;
        }

        // --- 1. Configurar Badge del Header (Icono) ---
        // En mobile: El SVG ya está hardcoded en HTML, NO tocar innerHTML
        // Solo agregar clases de color al badge container

        // FORZAR color blanco al elemento
        if (icon) {
            icon.classList.add('role-badge-icon');

            // SEGURIDAD: Si por caché el HTML es viejo y el elemento NO es un SVG (es un span vacío), reemplazarlo
            if (window.innerWidth < 768 && icon.tagName !== 'svg') {
                // Crear SVG elemento
                const svgNS = "http://www.w3.org/2000/svg";
                const newSvg = document.createElementNS(svgNS, "svg");
                newSvg.setAttribute("viewBox", "0 0 24 24");
                newSvg.setAttribute("class", "role-badge-icon");
                newSvg.style.cssText = "width: 24px; height: 24px; display: block; fill: white !important; z-index: 50;";

                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("fill-rule", "evenodd");
                path.setAttribute("d", "M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z");
                path.setAttribute("clip-rule", "evenodd");

                newSvg.appendChild(path);

                // Reemplazar el span viejo con el nuevo SVG
                icon.parentNode.replaceChild(newSvg, icon);
                icon = newSvg; // Update the 'icon' reference to the new SVG element
            }
        }

        if (window.innerWidth >= 768) {
            // En desktop: Si queremos cambiar el icono (ej: corona), lo hacemos aquí
            // PERO CUIDADO: si icon es un SVG, necesitamos un span para poner texto/emoji

            let targetElement = icon;

            // Si el elemento actual es un SVG (mobile), necesitamos reemplazarlo por un span para desktop
            if (icon.tagName === 'svg') {
                const newSpan = document.createElement('span');
                newSpan.id = 'roleBadgeIcon';
                newSpan.className = icon.className; // Mantener clases
                icon.parentNode.replaceChild(newSpan, icon);
                targetElement = newSpan;
                icon = newSpan; // Update the 'icon' reference to the new span element
            }

            targetElement.textContent = config.icon;
            targetElement.style.cssText = ""; // Reset estilos inline
            targetElement.classList.remove('role-badge-icon');
        }

        text.textContent = config.text;

        // Tooltip nativo
        badge.title = `Rol: ${config.text}`;
        badge.dataset.roleName = config.text; // Para uso en toast

        // Limpiar clases anteriores
        // Limpiar clases anteriores
        badge.className = 'flex items-center justify-center shrink-0 w-8 h-8 p-0 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-full text-lg leading-none md:text-xs font-bold border-2 transition-all cursor-pointer hover:scale-105 active:scale-95';

        // Agregar nuevas clases de color
        badge.classList.add(config.bgColor, config.textColor, config.borderColor);

        // Mostrar badge
        badge.classList.remove('hidden');


        // --- 2. Configurar Link en Menú Mobile ---
        if (mobileLink && mobileIcon && mobileText) {
            mobileIcon.textContent = config.icon; // Aquí sí mostrar la corona/laptop
            mobileText.textContent = config.text;

            // Colores específicos para el texto del rol en menú
            mobileText.className = `font-bold ${config.textColor.replace('text-', 'text-')}`;

            // Mostrar link en menú
            mobileLink.classList.remove('hidden');
            mobileLink.classList.add('flex'); // Asegurar flex
        }

        debugLog(`✅ Badge de rol mostrado: ${config.text}`);

        // Ocultar botón de Mejorar Plan para privilegiados
        hideUpgradePlanForPrivileged();

    } catch (error) {
        debugLog('❌ Error mostrando badge de rol:', error);
    }
}

/**
 * Mostrar pequeño toast/alerta con el rol al hacer click
 * Se llama desde el HTML onclick
 */
window.showRoleToast = function () {
    const badge = document.getElementById('roleBadge');
    const roleName = badge?.dataset.roleName || 'Usuario';

    // Crear toast si no existe
    let toast = document.getElementById('roleToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'roleToast';
        toast.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 transition-opacity duration-300 opacity-0 pointer-events-none';
        document.body.appendChild(toast);
    }

    toast.textContent = `Rol: ${roleName}`;
    toast.classList.remove('opacity-0');

    // Ocultar después de 2s
    setTimeout(() => {
        toast.classList.add('opacity-0');
    }, 2000);
};

/**
 * Ocultar botón de "Mejorar Plan" para usuarios privilegiados
 * Admin y Developer no necesitan mejorar plan
 */
function hideUpgradePlanForPrivileged() {
    if (!window.rolesManager) return;

    const isPrivileged = window.rolesManager.isPrivileged();
    const upgradeBtn = document.getElementById('upgradePlanBtn');

    if (upgradeBtn) {
        if (isPrivileged) {
            upgradeBtn.classList.add('hidden'); // Usar clase hidden en lugar de style
            debugLog('🔒 Botón "Mejorar Plan" oculto para usuario privilegiado');
        } else {
            upgradeBtn.classList.remove('hidden'); // Asegurar que se muestre si no es privilegiado
        }
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

debugLog('✅ role-badge-display.js cargado');
