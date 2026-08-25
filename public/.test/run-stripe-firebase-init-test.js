/**
 * run-stripe-firebase-init-test.js — Prueba de integracion con Playwright:
 * confirma que stripe-config.js ya NO lanza "No Firebase App '[DEFAULT]'
 * has been created" cuando se ejecuta ANTES de que exista una app Firebase
 * inicializada (el caso real de app.html, donde firebase.initializeApp()
 * se difiere a DOMContentLoaded via config.js), y que en ambos casos
 * window.StripeIntegration SI queda definido al final del archivo.
 *
 * Requiere un servidor local sirviendo public/ en localhost:8090:
 *   npx http-server public -p 8090 -c-1 &
 * Ejecutar: node public/.test/run-stripe-firebase-init-test.js
 */
const { chromium } = require('playwright');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}

async function runScenario(browser, label, scenario, expectImmediateAuthListener) {
    console.log(`\n=== Escenario: ${label} ===`);
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));

    await page.goto(`http://localhost:8090/.test/stripe-firebase-init-harness.html?scenario=${scenario}`, {
        waitUntil: 'networkidle',
        timeout: 20000,
    });
    // Esperar lo suficiente para que el escenario 'delayed' (init a los
    // ~250ms) tenga tiempo de completarse y de que el reintento de 100ms
    // de stripe-config.js lo detecte.
    await page.waitForTimeout(600);

    const log = await page.evaluate(() => window.__callLog);
    log.forEach(([name, args]) => console.log('  ', name, JSON.stringify(args).slice(0, 150)));

    assert(consoleErrors.length === 0,
        'sin errores de pagina no capturados (' + JSON.stringify(consoleErrors) + ')');

    const hasStripeIntegration = await page.evaluate(() =>
        typeof window.StripeIntegration === 'object' &&
        typeof window.StripeIntegration.createCheckoutSession === 'function'
    );
    assert(hasStripeIntegration,
        'window.StripeIntegration quedo definido (el resto del archivo se ejecuto sin abortar)');

    const authListenerRegistered = log.some(([name]) => name === 'onAuthStateChanged-registered');
    assert(authListenerRegistered,
        'el listener de auth para _loadStripePriceMap se registro (eventualmente)');

    if (expectImmediateAuthListener) {
        // Firebase ya estaba listo -- el listener debio registrarse en el
        // primer intento, sin esperar ningun reintento de 100ms.
        const initIdx = -1; // no aplica en este escenario
        const listenerIdx = log.findIndex(([name]) => name === 'onAuthStateChanged-registered');
        assert(listenerIdx === 0 || (listenerIdx !== -1 && !log.slice(0, listenerIdx).some(([n]) => n === 'debugLog')),
            'camino "ya inicializado": el listener se registro de inmediato, sin reintentos de por medio');
    } else {
        // Firebase se inicializo tarde -- el listener debio registrarse
        // DESPUES del evento simulado 'firebase-initialized-late'.
        const lateInitIdx = log.findIndex(([name]) => name === 'firebase-initialized-late');
        const listenerIdx = log.findIndex(([name]) => name === 'onAuthStateChanged-registered');
        assert(lateInitIdx !== -1 && listenerIdx !== -1 && lateInitIdx < listenerIdx,
            'camino "inicializado despues": el listener se registro DESPUES de que Firebase estuvo listo, no antes');
    }

    await page.close();
}

(async () => {
    const browser = await chromium.launch();

    await runScenario(browser, 'Firebase YA inicializado antes de cargar stripe-config.js (plans.html/account.html/auth.html)', 'ready', true);
    await runScenario(browser, 'Firebase NO inicializado al cargar, se inicializa despues (app.html)', 'delayed', false);

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
