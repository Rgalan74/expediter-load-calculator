/**
 * COOKIE CONSENT BANNER
 * Cumple con GDPR/CCPA - Gate para analytics (GA4 + Firebase Analytics)
 * 
 * Uso: Incluir antes de analytics-manager.js
 * - Si usuario acepta → window.cookieConsentGiven = true, carga analytics
 * - Si usuario rechaza → window.cookieConsentGiven = false, NO carga analytics
 * - Preferencia guardada en localStorage.cookieConsent
 */

(function () {
    'use strict';

    const CONSENT_KEY = 'cookieConsent';
    const CONSENT_VERSION = '1.0'; // Incrementar para re-pedir consentimiento

    // =========================================================
    // Verificar consentimiento previo
    // =========================================================
    function getStoredConsent() {
        try {
            const stored = localStorage.getItem(CONSENT_KEY);
            if (!stored) return null;

            const parsed = JSON.parse(stored);
            // Si cambió la versión, re-pedir consentimiento
            if (parsed.version !== CONSENT_VERSION) return null;

            return parsed.accepted;
        } catch (e) {
            return null;
        }
    }

    function saveConsent(accepted) {
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify({
                accepted: accepted,
                version: CONSENT_VERSION,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            // localStorage no disponible, continuar sin guardar
        }
    }

    // =========================================================
    // Crear banner
    // =========================================================
    function createBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
      <div class="cc-content">
        <div class="cc-text">
          <span class="cc-icon">🍪</span>
          <p>Usamos cookies y analytics (Google Analytics) para mejorar tu experiencia. 
          <a href="privacy.html" class="cc-link">Política de Privacidad</a></p>
        </div>
        <div class="cc-buttons">
          <button id="cc-reject" class="cc-btn cc-btn-reject">Rechazar</button>
          <button id="cc-accept" class="cc-btn cc-btn-accept">Aceptar</button>
        </div>
      </div>
    `;

        // Inyectar estilos inline (no requiere CSS externo)
        const style = document.createElement('style');
        style.textContent = `
      #cookie-consent-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        background: rgba(15, 15, 25, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding: 16px 20px;
        font-family: 'Inter', -apple-system, sans-serif;
        animation: cc-slide-up 0.4s ease-out;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      }
      @keyframes cc-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .cc-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .cc-text {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 250px;
      }
      .cc-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      .cc-text p {
        margin: 0;
        color: #b0b0c0;
        font-size: 14px;
        line-height: 1.5;
      }
      .cc-link {
        color: #60a5fa;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .cc-link:hover {
        color: #93c5fd;
      }
      .cc-buttons {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
      }
      .cc-btn {
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }
      .cc-btn-reject {
        background: rgba(255, 255, 255, 0.08);
        color: #a0a0b0;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .cc-btn-reject:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }
      .cc-btn-accept {
        background: linear-gradient(135deg, #3b82f6, #06b6d4);
        color: #ffffff;
      }
      .cc-btn-accept:hover {
        background: linear-gradient(135deg, #2563eb, #0891b2);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }
      /* Mobile responsive */
      @media (max-width: 640px) {
        .cc-content {
          flex-direction: column;
          text-align: center;
        }
        .cc-text {
          flex-direction: column;
          min-width: auto;
        }
        .cc-buttons {
          width: 100%;
          justify-content: center;
        }
        .cc-btn {
          flex: 1;
        }
      }
    `;

        document.head.appendChild(style);
        document.body.appendChild(banner);

        // Event listeners
        document.getElementById('cc-accept').addEventListener('click', function () {
            handleConsent(true);
        });

        document.getElementById('cc-reject').addEventListener('click', function () {
            handleConsent(false);
        });
    }

    // =========================================================
    // Manejar decisión
    // =========================================================
    function handleConsent(accepted) {
        saveConsent(accepted);
        window.cookieConsentGiven = accepted;

        // Remover banner con animación
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.style.animation = 'cc-slide-down 0.3s ease-in forwards';
            const slideDown = document.createElement('style');
            slideDown.textContent = `
        @keyframes cc-slide-down {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
      `;
            document.head.appendChild(slideDown);
            setTimeout(function () { banner.remove(); }, 300);
        }

        if (accepted) {
            if (typeof window.debugLog === 'function') {
                window.debugLog('[COOKIES] ✅ Consent granted — loading analytics');
            }
            loadAnalytics();
        } else {
            if (typeof window.debugLog === 'function') {
                window.debugLog('[COOKIES] ❌ Consent rejected — analytics disabled');
            }
        }
    }

    // =========================================================
    // Cargar analytics (solo si consent dado)
    // =========================================================
    function loadAnalytics() {
        // Si analytics-manager.js ya está cargado, inicializar
        if (window.analyticsManager && typeof window.analyticsManager.init === 'function') {
            window.analyticsManager.init();
            return;
        }

        // Si no está cargado, cargar dinámicamente
        var script = document.createElement('script');
        script.src = 'js/analytics-manager.js?v=1.0.0';
        script.onload = function () {
            if (window.analyticsManager) {
                window.analyticsManager.init();
            }
        };
        document.body.appendChild(script);
    }

    // =========================================================
    // Inicialización
    // =========================================================
    function init() {
        var storedConsent = getStoredConsent();

        if (storedConsent === true) {
            // Ya aceptó antes — cargar analytics silenciosamente
            window.cookieConsentGiven = true;
            loadAnalytics();
        } else if (storedConsent === false) {
            // Ya rechazó antes — no mostrar banner
            window.cookieConsentGiven = false;
        } else {
            // Primera visita — mostrar banner
            window.cookieConsentGiven = false;
            createBanner();
        }
    }

    // Exponer función para resetear consentimiento (útil para settings)
    window.resetCookieConsent = function () {
        localStorage.removeItem(CONSENT_KEY);
        window.cookieConsentGiven = false;
        init();
    };

    // Ejecutar cuando DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
