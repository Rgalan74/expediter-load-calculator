/**
 * CONSENT MODE — Google Consent Mode v2 + Meta Pixel consent gate
 *
 * Fuente unica para inicializar GA4 y Meta Pixel en todo el sitio.
 * Por defecto todo arranca "denied" (sin cookies, sin datos personales) y
 * Google/Meta reciben solo señales agregadas/modeladas. Cuando el usuario
 * acepta el banner (cookie-consent.js), se llama a window.grantTrackingConsent()
 * para pasar a "granted" y habilitar cookies reales.
 *
 * Debe cargarse ANTES de cookie-consent.js.
 */

(function () {
    'use strict';

    var GA4_ID = 'G-EK7NM7PJE2';
    var FB_PIXEL_ID = '2077223159668765';

    // =========================================================
    // 1. Google Consent Mode v2 — default state (denegado)
    // =========================================================
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('consent', 'default', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'denied',
        'wait_for_update': 500
    });

    // Cargar gtag.js (siempre — Google usa el consent state para decidir
    // si manda cookies reales o solo pings sin cookies)
    var gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(gtagScript);

    gtag('js', new Date());
    gtag('config', GA4_ID);

    // =========================================================
    // 2. Meta Pixel — consent revocado por defecto
    // =========================================================
    !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
            n.callMethod ?
                n.callMethod.apply(n, arguments) : n.queue.push(arguments)
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', FB_PIXEL_ID);
    fbq('consent', 'revoke');
    fbq('track', 'PageView');

    // =========================================================
    // 3. Otorgar consentimiento (llamado por cookie-consent.js)
    // =========================================================
    window.grantTrackingConsent = function () {
        gtag('consent', 'update', {
            'ad_storage': 'granted',
            'ad_user_data': 'granted',
            'ad_personalization': 'granted',
            'analytics_storage': 'granted'
        });
        fbq('consent', 'grant');

        if (typeof window.debugLog === 'function') {
            window.debugLog('[CONSENT] ✅ Tracking consent granted (GA4 + Meta Pixel)');
        }
    };

    // =========================================================
    // 4. Si ya habia consentimiento guardado de una visita anterior,
    //    otorgar de inmediato (leido directo de localStorage: no depende
    //    de que cookie-consent.js ya haya corrido su init())
    // =========================================================
    try {
        var stored = localStorage.getItem('cookieConsent');
        if (stored) {
            var parsed = JSON.parse(stored);
            if (parsed.version === '1.0' && parsed.accepted === true) {
                window.cookieConsentGiven = true;
                window.grantTrackingConsent();
            }
        }
    } catch (e) {
        // localStorage no disponible, se queda en "denied" por defecto
    }
})();
