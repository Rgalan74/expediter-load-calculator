/**
 * CONSENT MODE — Google Consent Mode v2 + Meta Pixel + Metricool consent gate
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
    // 2. Meta Pixel — cola local; el script (~200 KB) solo se descarga
    //    al aceptar cookies. Las llamadas a fbq() se guardan hasta entonces.
    // =========================================================
    !function (f) {
        if (f.fbq) return; var n = f.fbq = function () {
            n.callMethod ?
                n.callMethod.apply(n, arguments) : n.queue.push(arguments)
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = [];
    }(window);

    fbq('init', FB_PIXEL_ID);
    fbq('consent', 'revoke');
    fbq('track', 'PageView');

    function cargarMetaPixel() {
        if (window.__slsFbq) return;
        window.__slsFbq = true;
        var t = document.createElement('script'); t.async = true;
        t.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(t);
    }

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
        cargarMetaPixel();

        // Metricool: solo se carga con consentimiento (antes se cargaba siempre)
        if (!window.__slsMetricool) {
            window.__slsMetricool = true;
            var mc = document.createElement('script');
            mc.async = true;
            mc.src = 'https://tracker.metricool.com/resources/be.js';
            mc.onload = function () { try { window.beTracker && window.beTracker.t({ hash: '7da74d6dfb9767939b3eb010fa322db6' }); } catch (e) {} };
            document.head.appendChild(mc);
        }

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
