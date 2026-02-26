/**
 * image-optimizer.js
 * Sistema de optimización automática de imágenes
 * - WebP con fallback PNG
 * - Lazy loading automático
 * - Detección de soporte de formatos
 */

// ========================================
// DETECCIÓN DE SOPORTE WEBP
// ========================================

/**
 * Detectar si el navegador soporta WebP
 */
function supportsWebP() {
    if (window._supportsWebP !== undefined) {
        return window._supportsWebP;
    }

    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
        // Verificar WebP support
        window._supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } else {
        window._supportsWebP = false;
    }

    return window._supportsWebP;
}

// ========================================
// WEBP CON FALLBACK AUTOMÁTICO
// ========================================

/**
 * Configurar <picture> elementos para WebP con fallback
 */
function setupWebPElements() {
    // Buscar todas las imágenes que tienen versión WebP
    const images = document.querySelectorAll('img[data-webp]');

    images.forEach(img => {
        const webpSrc = img.dataset.webp;
        const pngSrc = img.src;

        // Crear elemento <picture>
        const picture = document.createElement('picture');

        // Source WebP
        const sourceWebP = document.createElement('source');
        sourceWebP.srcset = webpSrc;
        sourceWebP.type = 'image/webp';

        // Clonar img original
        const newImg = img.cloneNode(true);
        newImg.removeAttribute('data-webp');

        // Ensamblar
        picture.appendChild(sourceWebP);
        picture.appendChild(newImg);

        // Reemplazar en DOM
        img.parentNode.replaceChild(picture, img);
    });

    debugLog(`✅ WebP fallback configurado para ${images.length} imágenes`);
}

/**
 * Usar WebP si está disponible, PNG como fallback
 */
function getOptimizedImageSrc(basePath, extension = 'png') {
    const webpSupport = supportsWebP();

    if (webpSupport) {
        // Intentar cargar WebP primero
        return basePath.replace(`.${extension}`, '.webp');
    }

    return basePath;
}

// ========================================
// LAZY LOADING
// ========================================

/**
 * Configurar lazy loading con Intersection Observer
 */
function setupLazyLoading() {
    // Si navegador moderno, usar native lazy loading
    if ('loading' in HTMLImageElement.prototype) {
        document.querySelectorAll('img[data-lazy]').forEach(img => {
            img.loading = 'lazy';
            if (img.dataset.src) {
                img.src = img.dataset.src;
            }
            img.removeAttribute('data-lazy');
        });

        debugLog('✅ Native lazy loading activado');
        return;
    }

    // Fallback: Intersection Observer
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;

                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                    }
                    if (img.dataset.srcset) {
                        img.srcset = img.dataset.srcset;
                    }

                    img.classList.remove('lazy');
                    img.classList.add('lazy-loaded');

                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px', // Cargar 50px antes de entrar al viewport
            threshold: 0.01
        });

        document.querySelectorAll('img.lazy, img[data-lazy]').forEach(img => {
            imageObserver.observe(img);
        });

        debugLog('✅ Intersection Observer lazy loading activado');
    } else {
        // Fallback final: cargar todas las imágenes
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
        });

        debugLog('⚠️ Lazy loading no soportado, cargando todas las imágenes');
    }
}

/**
 * Precargar imágenes críticas
 */
function preloadCriticalImages(images = []) {
    images.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });

    if (images.length > 0) {
        debugLog(`✅ Precargando ${images.length} imágenes críticas`);
    }
}

// ========================================
// RESPONSIVE IMAGES
// ========================================

/**
 * Generar srcset automático para imágenes responsive
 */
function generateResponsiveSrcset(basePath, sizes = [320, 640, 1024, 1920]) {
    return sizes
        .map(size => {
            const path = basePath.replace(/\.(png|jpg|jpeg|webp)$/, `-${size}w.$1`);
            return `${path} ${size}w`;
        })
        .join(', ');
}

// ========================================
// OPTIMIZACIÓN AUTOMÁTICA DE BACKGROUND IMAGES
// ========================================

/**
 * Optimizar background-image en CSS usand WebP
 */
function optimizeBackgroundImages() {
    if (!supportsWebP()) return;

    // Buscar elementos con data-bg-webp
    document.querySelectorAll('[data-bg-webp]').forEach(el => {
        const webpBg = el.dataset.bgWebp;
        el.style.backgroundImage = `url('${webpBg}')`;
        el.removeAttribute('data-bg-webp');
    });
}

// ========================================
// CSS PARA LAZY LOADING
// ========================================

function injectLazyLoadingStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* Placeholder mientras carga */
    img.lazy, img[data-lazy] {
      background: linear-gradient(
        90deg,
        #f0f0f0 25%,
        #e0e0e0 50%,
        #f0f0f0 75%
      );
      background-size: 200% 100%;
      animation: loading 1.5s ease-in-out infinite;
    }
    
    /* Fade in cuando carga */
    img.lazy-loaded {
      animation: fadeIn 0.3s ease-in;
    }
    
    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    /* Blur effect mientras carga (opcional) */
    img.lazy[data-src] {
      filter: blur(5px);
      transition: filter 0.3s;
    }
    
    img.lazy-loaded {
      filter: blur(0);
    }
  `;
    document.head.appendChild(style);
}

// ========================================
// INICIALIZACIÓN
// ========================================

/**
 * Inicializar todas las optimizaciones de imágenes
 */
function initializeImageOptimization() {
    debugLog('🎨 Inicializando optimizaciones de imágenes...');

    // Inyectar estilos
    injectLazyLoadingStyles();

    // Configurar WebP
    setupWebPElements();
    optimizeBackgroundImages();

    // Configurar lazy loading
    setupLazyLoading();

    // Precargar imágenes críticas (logo, etc.)
    // NOTA: logo-app.webp ya se carga via <picture> element, no necesita preload
    preloadCriticalImages([
        // Agregar imágenes críticas aquí si es necesario
    ]);

    debugLog('✨ Optimizaciones de imágenes completadas');
}

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageOptimization);
} else {
    initializeImageOptimization();
}

// ========================================
// EXPORTAR FUNCIONES
// ========================================

window.ImageOptimizer = {
    supportsWebP,
    getOptimizedImageSrc,
    setupLazyLoading,
    preloadCriticalImages,
    generateResponsiveSrcset
};

debugLog('📦 Image Optimizer module loaded');
