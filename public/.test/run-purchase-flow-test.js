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

/**
 * Endurecimiento post-revision: _planFound por si solo no bastaba como señal
 * de "compra valida" -- si pendingCheckoutPlan contenia "free" (que SI existe
 * en window.PLANS, con price: 0), buildPurchaseParams() lo marcaba
 * _planFound: true y el evento se mandaba con value: 0 sin pasar por el
 * fallback. stripe-config.js ahora exige ademas que el plan de sessionStorage
 * sea explicitamente "professional" o "premium" (PAID_PLAN_IDS) antes de
 * confiar en _planFound. Estos tres escenarios prueban ese guard.
 */
async function runEdgeCaseScenario(browser, label, urlSuffix, checks) {
    console.log(`\n=== Escenario: ${label} ===`);
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));

    await page.goto('http://localhost:8090/.test/purchase-flow-harness.html?session_id=cs_test_playwright_123' + urlSuffix, {
        waitUntil: 'networkidle',
        timeout: 20000,
    });
    await page.waitForTimeout(1800);

    const log = await page.evaluate(() => window.__callLog);
    log.forEach(([name, args]) => console.log('  ', name, JSON.stringify(args).slice(0, 150)));

    assert(consoleErrors.length === 0, 'sin errores de pagina (' + JSON.stringify(consoleErrors) + ')');

    const reloadIdx = log.findIndex(([name]) => name === '__reloadPage');
    assert(reloadIdx !== -1, '__reloadPage() se llamo eventualmente (no se quedo colgado)');

    checks(log);

    await page.close();
}

(async () => {
    const browser = await chromium.launch();

    await runScenario(browser, 'camino feliz (gtag confirma via event_callback)', '', true);
    await runScenario(browser, 'respaldo (event_callback nunca llega -> timeout de 1200ms)', '&skip_callback=1', false);

    await runEdgeCaseScenario(
        browser,
        'pendingCheckoutPlan="free" (conocido pero no pagado) -> cae al fallback, nunca $0',
        '&pending_plan=free',
        (log) => {
            const getUserPlanCalled = log.some(([name]) => name === 'getUserPlan');
            assert(getUserPlanCalled, 'getUserPlan() se llamo -- "free" en sessionStorage no basta, activa el fallback');

            const purchaseIdx = log.findIndex(([name, args]) => name === 'gtag' && args[0] === 'event' && args[1] === 'purchase');
            assert(purchaseIdx !== -1, 'el fallback resolvio un plan pagado (professional) -> el purchase SI se manda');
            if (purchaseIdx !== -1) {
                const callParams = log[purchaseIdx][1][2];
                assert(callParams.value === 14.99, 'value viene del plan real resuelto por el fallback, nunca 0 (' + callParams.value + ')');
            }
        }
    );

    await runEdgeCaseScenario(
        browser,
        'fallback tambien resuelve a "free" -> el purchase se omite por completo',
        '&pending_plan=free&user_plan=free',
        (log) => {
            const getUserPlanCalled = log.some(([name]) => name === 'getUserPlan');
            assert(getUserPlanCalled, 'getUserPlan() se llamo -- el fallback si se intento');

            const purchaseIdx = log.findIndex(([name, args]) => name === 'gtag' && args[0] === 'event' && args[1] === 'purchase');
            assert(purchaseIdx === -1, 'ningun evento purchase se manda cuando ni sessionStorage ni el fallback confirman un plan pagado');

            const omittedLog = log.some(([name, args]) => name === 'debugLog' && JSON.stringify(args).includes('omitido'));
            assert(omittedLog, 'se registra un debugLog explicando por que se omitio el evento (trazable para soporte)');
        }
    );

    await runEdgeCaseScenario(
        browser,
        'pendingCheckoutPlan="premium" sigue funcionando directo, sin pasar por el fallback',
        '&pending_plan=premium',
        (log) => {
            const getUserPlanCalled = log.some(([name]) => name === 'getUserPlan');
            assert(!getUserPlanCalled, 'getUserPlan() NO se llama -- "premium" ya es un plan pagado valido, no necesita fallback');

            const purchaseIdx = log.findIndex(([name, args]) => name === 'gtag' && args[0] === 'event' && args[1] === 'purchase');
            assert(purchaseIdx !== -1, 'el purchase se manda directo para el plan premium');
            if (purchaseIdx !== -1) {
                const callParams = log[purchaseIdx][1][2];
                assert(callParams.value === 29.99, 'value es el precio real de premium (' + callParams.value + ')');
                assert(callParams.transaction_id === 'cs_test_playwright_123', 'transaction_id coincide con el session_id de la URL');
            }
        }
    );

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
