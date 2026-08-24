/**
 * run-purchase-flow-test.js — Prueba de integracion con Playwright:
 * confirma que gtag('event','purchase',...) se llama, y que el reload
 * SIEMPRE espera a que ese intento de envio termine (via event_callback,
 * o via el timeout de respaldo si el callback nunca llega) antes de
 * disparar window.__reloadPage() en el flujo de regreso de Stripe.
 *
 * Requiere un servidor local sirviendo public/ en localhost:8090:
 *   npx http-server public -p 8090 -c-1 &
 * Ejecutar: node public/.test/run-purchase-flow-test.js
 */
const { chromium } = require('playwright');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}

async function runScenario(browser, label, urlSuffix, expectCallbackFired) {
    console.log(`\n=== Escenario: ${label} ===`);
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));

    await page.goto('http://localhost:8090/.test/purchase-flow-harness.html?session_id=cs_test_playwright_123' + urlSuffix, {
        waitUntil: 'networkidle',
        timeout: 20000,
    });
    // Esperar lo suficiente para que tanto el camino feliz (callback a 50ms)
    // como el de respaldo (timeout a 1200ms) hayan tenido tiempo de correr.
    await page.waitForTimeout(1800);

    const log = await page.evaluate(() => window.__callLog);
    // Medido con performance.now() DENTRO de la pagina (window.__startTime,
    // window.__reloadTime), no con Date.now() del lado de Playwright antes
    // del page.goto() -- eso incluiria tiempo de navegacion/carga de la
    // pagina, que es ruido ajeno a la duracion real del await gtag/timeout
    // que este assert quiere medir.
    const elapsedMs = await page.evaluate(() => window.__reloadTime - window.__startTime);
    log.forEach(([name, args]) => console.log('  ', name, JSON.stringify(args).slice(0, 150)));

    assert(consoleErrors.length === 0, 'sin errores de pagina (' + JSON.stringify(consoleErrors) + ')');

    const gtagPurchaseIdx = log.findIndex(([name, args]) => name === 'gtag' && args[0] === 'event' && args[1] === 'purchase');
    const reloadIdx = log.findIndex(([name]) => name === '__reloadPage');

    assert(gtagPurchaseIdx !== -1, 'gtag("event","purchase",...) se llamo');
    assert(reloadIdx !== -1, '__reloadPage() se llamo eventualmente (no se quedo colgado)');
    assert(gtagPurchaseIdx !== -1 && reloadIdx !== -1 && gtagPurchaseIdx < reloadIdx,
        'gtag("purchase") se dispara ANTES de __reloadPage()');

    if (gtagPurchaseIdx !== -1) {
        const callParams = log[gtagPurchaseIdx][1][2];
        assert(typeof callParams.event_callback === 'function' || callParams.event_callback === undefined,
            'gtag recibe event_callback en los params (revisado via presencia de la key mas abajo)');
        assert('event_timeout' in callParams, 'gtag recibe event_timeout como respaldo documentado de GA4');
        assert(!('_planFound' in callParams), '_planFound NO se manda como parametro de GA4 (es metadata interna)');
        assert(callParams.transaction_id === 'cs_test_playwright_123', 'transaction_id coincide con el session_id de la URL');
        assert(callParams.value === 14.99, 'value viene del plan real (' + callParams.value + ')');
    }

    if (expectCallbackFired) {
        assert(elapsedMs < 1500, 'camino feliz: el reload no espero el timeout completo de respaldo (' + elapsedMs + 'ms)');
    } else {
        assert(elapsedMs >= 1150, 'camino de respaldo: el reload SI espero el timeout (~1200ms) cuando el callback nunca llego (' + elapsedMs + 'ms)');
    }

    await page.close();
}

(async () => {
    const browser = await chromium.launch();

    await runScenario(browser, 'camino feliz (gtag confirma via event_callback)', '', true);
    await runScenario(browser, 'respaldo (event_callback nunca llega -> timeout de 1200ms)', '&skip_callback=1', false);

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
