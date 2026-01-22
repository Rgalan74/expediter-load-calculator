/**
 * ui-enhancements.js
 * Mejoras UI/UX para la aplicación Expediter
 * - Animaciones sutiles
 * - Feedback visual mejorado
 * - Loading states
 * - Micro-interacciones
 */

// ========================================
// ANIMACIONES Y TRANSICIONES
// ========================================

/**
 * Agregar animaciones de entrada a elementos
 */
function initializePageAnimations() {
    // Fade in para cards
    const cards = document.querySelectorAll('.card, .metric-card, .section-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 50 * index);
    });

    console.log(`✨ Animaciones inicializadas para ${cards.length} elementos`);
}

/**
 * Smooth scroll to element
 */
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });
    }
}

// ========================================
// LOADING STATES
// ========================================

/**
 * Mostrar loading state en botón
 */
function setButtonLoading(button, isLoading, originalText = null) {
    if (isLoading) {
        // Guardar texto original si no se provee
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = `
      <svg class="animate-spin inline-block w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      ${originalText || 'Procesando...'}
    `;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = button.dataset.originalText || originalText || 'Guardar';
        delete button.dataset.originalText;
    }
}

/**
 * Skeleton loader para contenido
 */
function showSkeletonLoader(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-loader bg-gray-200 rounded p-4 mb-3';
        skeleton.innerHTML = `
      <div class="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div class="h-3 bg-gray-300 rounded w-1/2"></div>
    `;
        container.appendChild(skeleton);
    }
}

// ========================================
// FEEDBACK VISUAL
// ========================================

/**
 * Vibración háptica (si está disponible)
 */
function hapticFeedback(pattern = 10) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

/**
 * Pulsar elemento para feedback
 */
function pulseElement(element) {
    if (!element) return;

    element.style.transform = 'scale(0.95)';
    element.style.transition = 'transform 0.1s ease';

    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 100);
}

/**
 * Highlight temporal de elemento
 */
function highlightElement(element, duration = 2000) {
    if (!element) return;

    const originalBg = element.style.backgroundColor;
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = '#fef3c7'; // yellow-100

    setTimeout(() => {
        element.style.backgroundColor = originalBg;
    }, duration);
}

/**
 * Copiar al clipboard con feedback
 */
async function copyToClipboard(text, buttonElement = null) {
    try {
        await navigator.clipboard.writeText(text);

        if (buttonElement) {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✓ Copiado';
            buttonElement.classList.add('bg-green-500');

            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('bg-green-500');
            }, 2000);
        }

        showToast('Copiado al portapapeles', 'success');
        hapticFeedback();

        return true;
    } catch (error) {
        console.error('Error copiando:', error);
        showToast('Error al copiar', 'error');
        return false;
    }
}

// ========================================
// MEJORAS DE FORMULARIOS
// ========================================

/**
 * Auto-resize textarea mientras escribes
 */
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

/**
 * Validación en tiempo real
 */
function setupRealtimeValidation(inputId, validationFn, errorMsg) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-xs text-red-500 mt-1 hidden';
    errorDiv.textContent = errorMsg;
    input.parentNode.appendChild(errorDiv);

    input.addEventListener('blur', () => {
        const isValid = validationFn(input.value);

        if (!isValid && input.value) {
            input.classList.add('border-red-500');
            errorDiv.classList.remove('hidden');
        } else {
            input.classList.remove('border-red-500');
            errorDiv.classList.add('hidden');
        }
    });

    input.addEventListener('input', () => {
        if (input.classList.contains('border-red-500')) {
            const isValid = validationFn(input.value);
            if (isValid) {
                input.classList.remove('border-red-500');
                errorDiv.classList.add('hidden');
            }
        }
    });
}

// ========================================
// TOOLTIPS MEJORADOS
// ========================================

/**
 * Mostrar tooltip en hover
 */
function showTooltip(element, text, position = 'top') {
    const tooltip = document.createElement('div');
    tooltip.className = `tooltip tooltip-${position}`;
    tooltip.textContent = text;
    tooltip.style.cssText = `
    position: absolute;
    background: #1f2937;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 1000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';

    setTimeout(() => tooltip.style.opacity = '1', 10);

    return tooltip;
}

/**
 * Inicializar tooltips automáticos
 */
function initializeTooltips() {
    const elementsWithTooltip = document.querySelectorAll('[data-tooltip]');

    elementsWithTooltip.forEach(element => {
        let tooltip = null;

        element.addEventListener('mouseenter', () => {
            const text = element.dataset.tooltip;
            tooltip = showTooltip(element, text);
        });

        element.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => tooltip.remove(), 200);
            }
        });
    });

    console.log(`💬 Tooltips inicializados para ${elementsWithTooltip.length} elementos`);
}

// ========================================
// MOBILE ENHANCEMENTS
// ========================================

/**
 * Detectar si es dispositivo móvil
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Mejorar touch targets en mobile
 */
function enhanceTouchTargets() {
    if (!isMobile()) return;

    const buttons = document.querySelectorAll('button, a, input[type="checkbox"], input[type="radio"]');
    buttons.forEach(btn => {
        const computed = window.getComputedStyle(btn);
        const height = parseInt(computed.height);

        if (height < 44) {
            btn.style.minHeight = '44px';
            btn.style.minWidth = '44px';
        }
    });

    console.log('📱 Touch targets mejorados para mobile');
}

/**
 * Swipe detection
 */
function initializeSwipeGestures(element, callbacks = {}) {
    let touchStartX = 0;
    let touchStartY = 0;

    element.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, false);

    element.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Swipe horizontal
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 50 && callbacks.onSwipeRight) {
                callbacks.onSwipeRight();
            } else if (deltaX < -50 && callbacks.onSwipeLeft) {
                callbacks.onSwipeLeft();
            }
        }
        // Swipe vertical
        else {
            if (deltaY > 50 && callbacks.onSwipeDown) {
                callbacks.onSwipeDown();
            } else if (deltaY < -50 && callbacks.onSwipeUp) {
                callbacks.onSwipeUp();
            }
        }
    }, false);
}

// ========================================
// INICIALIZACIÓN
// ========================================

/**
 * Inicializar todas las mejoras UI/UX
 */
function initializeUIEnhancements() {
    console.log('🎨 Inicializando mejoras UI/UX...');

    // Animaciones de página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePageAnimations);
    } else {
        initializePageAnimations();
    }

    // Tooltips
    initializeTooltips();

    // Mobile enhancements
    if (isMobile()) {
        enhanceTouchTargets();
    }

    // Auto-resize textareas
    document.querySelectorAll('textarea[data-auto-resize]').forEach(textarea => {
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        autoResizeTextarea(textarea); // Initial resize
    });

    console.log('✨ Mejoras UI/UX inicializadas correctamente');
}

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUIEnhancements);
} else {
    initializeUIEnhancements();
}

// ========================================
// EXPORTAR FUNCIONES
// ========================================

window.UIEnhancements = {
    smoothScrollTo,
    setButtonLoading,
    showSkeletonLoader,
    hapticFeedback,
    pulseElement,
    highlightElement,
    copyToClipboard,
    autoResizeTextarea,
    setupRealtimeValidation,
    showTooltip,
    isMobile,
    enhanceTouchTargets,
    initializeSwipeGestures
};

console.log('📦 UI Enhancements module loaded');
