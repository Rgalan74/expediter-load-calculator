# GA4 Purchase Tracking Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GA4 `purchase` event reliably reach `gtag()` — and actually leave the browser — on checkout return from Stripe, instead of racing an in-memory queue (and then a bare `reload()`) that can destroy it before it's ever sent.

**Architecture:** Extract the purchase-params construction into a pure function (`public/js/purchase-tracking.js`), call it directly from `gtag()` in `handleCheckoutResult()` — bypassing `analyticsManager`'s queue entirely for this one event — with a `getUserPlan(user.uid)` fallback when `sessionStorage.pendingCheckoutPlan` is missing (and a guard against silently recording a `$0` purchase if that fallback can't confirm a real paid plan yet, e.g. the Stripe webhook hasn't caught up). The `gtag()` call itself waits on GA4's `event_callback`/`event_timeout` (plus one more independent timeout as backstop) before continuing — proving the hit had a real chance to be dispatched, not just that the function was called. A small testability seam (`window.__reloadPage`) lets a Playwright harness verify both the happy path and the timeout-backstop path, without needing to fully boot the real authenticated app.

**Tech Stack:** Vanilla JS (no new dependencies), Node for the pure-function unit test, Playwright (already used elsewhere this session) for the browser-level ordering test.

**Reference spec:** `docs/superpowers/specs/2026-08-24-ga4-purchase-tracking-design.md`

**Explicitly out of scope — do not touch:** `begin_checkout` (both call sites in `stripe-config.js`), Meta Pixel/`trackMeta`/Conversions API (`functions/index.js`'s `sendMetaPurchaseEvent`), any GA4/Google Ads dashboard config, Stripe backend/webhook logic, the other two `window.location.reload()` call sites in `stripe-config.js` (portal-return flow, auth-not-ready retry).

---

## Task 1: Pure function — write the failing test

**Files:**
- Create: `public/.test/test-purchase-tracking.js`

- [ ] **Step 1: Write the complete test file**

Create `public/.test/test-purchase-tracking.js`:

```js
/**
 * test-purchase-tracking.js — Test unitario de buildPurchaseParams (funcion pura).
 * No requiere navegador ni mocks de Firebase -- la funcion no toca DOM/window.
 * Ejecutar: node public/.test/test-purchase-tracking.js
 */

const { buildPurchaseParams } = require('../js/purchase-tracking.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const PLANS = {
    professional: { id: 'professional', name: 'Professional', price: 14.99 },
    premium: { id: 'premium', name: 'Premium + AI', price: 29.99 },
};

section('buildPurchaseParams — plan encontrado');
const r1 = buildPurchaseParams('cs_test_123', 'professional', PLANS);
assert(r1.transaction_id === 'cs_test_123', 'transaction_id es siempre el sessionId (' + r1.transaction_id + ')');
assert(r1.currency === 'USD', 'currency es USD');
assert(r1.value === 14.99, 'value toma el precio real del plan (' + r1.value + ')');
assert(r1._planFound === true, '_planFound es true cuando el plan existe en plansMap');
assert(Array.isArray(r1.items) && r1.items.length === 1, 'items tiene exactamente 1 entrada');
assert(r1.items[0].item_id === 'professional', 'items[0].item_id es el plan id');
assert(r1.items[0].item_name === 'Professional', 'items[0].item_name es el nombre legible');
assert(r1.items[0].price === 14.99, 'items[0].price coincide con value');
assert(r1.items[0].quantity === 1, 'items[0].quantity es 1');

section('buildPurchaseParams — plan NO encontrado (sessionStorage perdido)');
const r2 = buildPurchaseParams('cs_test_456', null, PLANS);
assert(r2.transaction_id === 'cs_test_456', 'transaction_id se preserva aunque no haya plan');
assert(r2.value === 0, 'value es 0 cuando no hay plan (caso a evitar via fallback en el caller)');
assert(r2._planFound === false, '_planFound es false -- señal para que el caller intente el fallback');
assert(Array.isArray(r2.items) && r2.items.length === 0, 'items es un array vacio, no undefined');

section('buildPurchaseParams — planId no existe en plansMap');
const r3 = buildPurchaseParams('cs_test_789', 'plan_que_no_existe', PLANS);
assert(r3._planFound === false, 'plan id invalido tambien marca _planFound false');
assert(r3.value === 0, 'value es 0 para un plan id invalido');

section('buildPurchaseParams — plan premium');
const r4 = buildPurchaseParams('cs_test_999', 'premium', PLANS);
assert(r4.value === 29.99, 'funciona igual para el plan premium (' + r4.value + ')');
assert(r4._planFound === true, '_planFound true para premium');

console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node public/.test/test-purchase-tracking.js`
Expected: FAIL with `Cannot find module '../js/purchase-tracking.js'` (the file doesn't exist yet)

---

## Task 2: Pure function — implement `buildPurchaseParams`

**Files:**
- Create: `public/js/purchase-tracking.js`

- [ ] **Step 1: Write the file**

```js
/**
 * purchase-tracking.js
 * Construccion pura de los parametros del evento GA4 "purchase".
 * Sin DOM, sin sessionStorage, sin firebase -- solo datos in, datos out.
 * Se puede requerir desde Node (test) o cargar como <script> normal (browser).
 */

function buildPurchaseParams(sessionId, purchasedPlanId, plansMap) {
    const purchasedPlan = (plansMap && purchasedPlanId) ? plansMap[purchasedPlanId] : null;
    const purchaseValue = Number(purchasedPlan?.price || 0);

    return {
        transaction_id: sessionId,
        currency: 'USD',
        value: purchaseValue,
        items: purchasedPlan
            ? [{ item_id: purchasedPlanId, item_name: purchasedPlan.name, price: purchaseValue, quantity: 1 }]
            : [],
        _planFound: !!purchasedPlan,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildPurchaseParams };
} else {
    window.buildPurchaseParams = buildPurchaseParams;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node public/.test/test-purchase-tracking.js`
Expected: `RESULTADO: 17 pasaron, 0 fallaron` (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add public/js/purchase-tracking.js public/.test/test-purchase-tracking.js
git commit -m "feat(analytics): add pure buildPurchaseParams function + unit tests"
```

---

## Task 3: Wire `purchase-tracking.js` into `app.html`

**Files:**
- Modify: `public/app.html`

- [ ] **Step 1: Add the script tag before `stripe-config.js`**

Find (around line 2682-2683):

```html
  <!-- 💳 Stripe Integration - Payments & Subscriptions -->
  <script src="js/stripe-config.js?v=3.5.1"></script>
```

Replace with:

```html
  <!-- 💳 Stripe Integration - Payments & Subscriptions -->
  <script src="js/purchase-tracking.js?v=1.0.0"></script>
  <script src="js/stripe-config.js?v=3.5.1"></script>
```

- [ ] **Step 2: Commit**

```bash
git add public/app.html
git commit -m "feat(analytics): load purchase-tracking.js on app.html"
```

---

## Task 4: Fix `handleCheckoutResult()` — direct `gtag()`, fallback, testability seam

**Files:**
- Modify: `public/js/stripe-config.js`

- [ ] **Step 1: Add the `__reloadPage` indirection near the top of the file**

Find (around line 10-14, right after the file's opening comment block):

```js
// ========================================
// CONFIGURACIÓN DE STRIPE
// ========================================
```

Add immediately before it:

```js
// Indireccion para poder testear handleCheckoutResult() sin recargar la
// pagina de verdad -- un harness de test puede pre-definir esto ANTES de
// que este script cargue. En produccion es exactamente location.reload().
window.__reloadPage = window.__reloadPage || (() => window.location.reload());

// ========================================
// CONFIGURACIÓN DE STRIPE
// ========================================
```

- [ ] **Step 2: Replace the purchase-tracking block**

Find (around line 341-367):

```js
        // ✅ Bug #3 fix: toast DENTRO del callback, después de confirmar auth
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.subscribed_ok') || '¡Suscripción activada exitosamente! 🎉', 'success');

        const purchasedPlanId = sessionStorage.getItem('pendingCheckoutPlan');
        const purchasedPlan = window.PLANS && window.PLANS[purchasedPlanId];
        const purchaseValue = Number(purchasedPlan?.price || 0);
        const purchaseParams = {
            transaction_id: sessionId,
            currency: 'USD',
            value: purchaseValue,
            items: purchasedPlan ? [{ item_id: purchasedPlanId, item_name: purchasedPlan.name, price: purchaseValue, quantity: 1 }] : []
        };

        // GA4/Firebase Analytics — confirmed checkout return.
        if (window.analyticsManager) {
            window.analyticsManager.trackEvent('purchase', purchaseParams);
        } else if (typeof gtag === 'function') {
            gtag('event', 'purchase', purchaseParams);
        }

        // Meta Pixel
        if (typeof window.trackMeta === 'function') {
            window.trackMeta('Purchase', { currency: 'USD', value: purchaseValue });
        } else if (typeof window.fbq === 'function') {
            window.fbq('track', 'Purchase', { currency: 'USD', value: purchaseValue }, { eventID: sessionId });
        }
        sessionStorage.removeItem('pendingCheckoutPlan');
```

Replace with:

```js
        // ✅ Bug #3 fix: toast DENTRO del callback, después de confirmar auth
        if (typeof showToast === 'function') showToast(window.i18n?.t('stripe.subscribed_ok') || '¡Suscripción activada exitosamente! 🎉', 'success');

        const PAID_PLAN_IDS = ['professional', 'premium'];
        const pendingPlanId = sessionStorage.getItem('pendingCheckoutPlan');
        let purchaseParams = window.buildPurchaseParams(sessionId, pendingPlanId, window.PLANS);

        // Fallback: si sessionStorage se perdio (pestaña cerrada y reabierta,
        // storage limpiado, etc.), confirmar el plan real desde Stripe en vez
        // de mandar value: 0. OJO: justo al volver de Stripe el webhook puede
        // no haber terminado de actualizar Firestore todavia -- si
        // getUserPlan() no devuelve un plan pagado reconocido (ej. sigue en
        // "free"), NO lo tratamos como resuelto. Mejor omitir el evento que
        // mandar una "compra" de $0 con datos inventados.
        if (!purchaseParams._planFound && typeof window.getUserPlan === 'function') {
            try {
                const confirmedPlan = await window.getUserPlan(user.uid);
                if (confirmedPlan && PAID_PLAN_IDS.includes(confirmedPlan.id)) {
                    purchaseParams = window.buildPurchaseParams(sessionId, confirmedPlan.id, window.PLANS);
                } else {
                    debugLog('[STRIPE] No se pudo confirmar un plan pagado para el evento purchase (sessionId=' + sessionId + ', plan devuelto=' + (confirmedPlan?.id || 'ninguno') + '). Evento GA4/Meta omitido, revisar manualmente.');
                }
            } catch (e) {
                debugLog('[STRIPE] Error confirmando plan via getUserPlan para el evento purchase:', e.message);
            }
        }

        if (purchaseParams._planFound) {
            // _planFound es metadata interna de control -- no forma parte
            // del payload que le mandamos a GA4.
            const { _planFound, ...ga4PurchaseParams } = purchaseParams;
            const purchaseValue = ga4PurchaseParams.value;

            // GA4 — directo a gtag, sin pasar por analyticsManager (su cola
            // en memoria no sobrevive el reload de mas abajo). Llamar
            // gtag() no prueba por si solo que el hit salio por la red --
            // usamos su event_callback (mas event_timeout de respaldo, mas
            // un setTimeout propio como ultima red de seguridad) para darle
            // al hit una oportunidad real de salir ANTES de continuar hacia
            // el reload. Nunca esperamos indefinidamente: si nada dispara
            // en ~1.2s, seguimos igual.
            if (typeof gtag === 'function') {
                await new Promise((resolve) => {
                    let done = false;
                    const finish = () => { if (!done) { done = true; resolve(); } };
                    gtag('event', 'purchase', {
                        ...ga4PurchaseParams,
                        event_callback: finish,
                        event_timeout: 1000,
                    });
                    setTimeout(finish, 1200);
                });
            }

            // Meta Pixel
            if (typeof window.trackMeta === 'function') {
                window.trackMeta('Purchase', { currency: 'USD', value: purchaseValue });
            } else if (typeof window.fbq === 'function') {
                window.fbq('track', 'Purchase', { currency: 'USD', value: purchaseValue }, { eventID: sessionId });
            }
        }
        sessionStorage.removeItem('pendingCheckoutPlan');
```

Nota sobre el diseño: el `await new Promise(...)` pausa la ejecución de
`handleCheckoutResult()` en este punto — el resto de la función (deteccion
de cambio de plan via portal, y el `window.__reloadPage()` final del Step 3
mas abajo) sigue corriendo *despues*, sin cambios en su propia logica. No
hace falta mover el reload: ya esta al final de la funcion, y ahora
simplemente espera a que este `await` se resuelva primero.

- [ ] **Step 3: Replace the final `window.location.reload()` with the indirection**

Find (around line 388-390, the very end of the `onAuthStateChanged` callback inside `handleCheckoutResult`):

```js
        // Recargar para reflejar el nuevo plan
        window.location.reload();
    });
}
```

Replace with:

```js
        // Recargar para reflejar el nuevo plan
        window.__reloadPage();
    });
}
```

**Do not change** the other two `window.location.reload()` calls in this file (portal-return flow near the top of `handleCheckoutResult`, and the auth-not-ready retry) — out of scope.

- [ ] **Step 4: Manual sanity check — no syntax errors**

Run: `node -c public/js/stripe-config.js` — wait, this is loaded as a plain
script (not a module) and uses top-level `await` inside an async arrow
function only, so `node -c` should parse it fine as a syntax check. If it
errors on something unrelated to this change (e.g. `firebase` not defined),
that's expected — `node -c` only checks syntax, doesn't execute.

Expected: no output (silent success) or only a syntax-related complaint if
a typo was introduced — compare against `git diff` to confirm the edit
matches exactly what's specified above.

- [ ] **Step 5: Commit**

```bash
git add public/js/stripe-config.js
git commit -m "fix(analytics): send purchase directly via gtag, add plan fallback, testable reload"
```

---

## Task 5: Playwright test — prove `gtag('purchase')` fires before reload

**Files:**
- Create: `public/.test/purchase-flow-harness.html`
- Create: `public/.test/run-purchase-flow-test.js`

- [ ] **Step 1: Write the test harness page**

Create `public/.test/purchase-flow-harness.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Purchase flow test harness — not deployed</title></head>
<body>
<script>
  // ── Stubs, definidos ANTES de cargar el codigo real ──────────────────────
  window.__callLog = [];

  window.debugLog = function (...args) { window.__callLog.push(['debugLog', args]); };
  window.showToast = function () {};
  // Simula un gtag.js real: registra la llamada y, salvo que la URL pida
  // lo contrario (?skip_callback=1, para probar el respaldo por timeout),
  // dispara event_callback de forma asincronica -- como haria gtag.js de
  // verdad al confirmar (o fallar) el envio del hit.
  var _skipCallback = new URLSearchParams(window.location.search).get('skip_callback') === '1';
  window.gtag = function (...args) {
    window.__callLog.push(['gtag', args]);
    var params = args[2];
    if (!_skipCallback && params && typeof params.event_callback === 'function') {
      setTimeout(params.event_callback, 50);
    }
  };
  window.PLANS = {
    professional: { id: 'professional', name: 'Professional', price: 14.99 },
  };
  window.getUserPlan = async function (uid) {
    window.__callLog.push(['getUserPlan', [uid]]);
    return { id: 'professional', name: 'Professional', price: 14.99 };
  };
  // __reloadPage se define ANTES de que stripe-config.js cargue, por eso
  // stripe-config.js usa "window.__reloadPage || (() => ...)" -- respeta
  // este stub en vez de pisarlo.
  window.__reloadPage = function () { window.__callLog.push(['__reloadPage', []]); };

  // Firebase stub minimo -- solo lo que handleCheckoutResult() toca.
  var _authUser = { uid: 'test-uid-123' };
  window.firebase = {
    auth: function () {
      return {
        currentUser: _authUser,
        onAuthStateChanged: function (cb) {
          setTimeout(function () { cb(_authUser); }, 0);
          return function unsubscribe() {};
        },
      };
    },
  };

  // Simular que ya paso por checkout y volvio de Stripe.
  sessionStorage.setItem('pendingCheckoutPlan', 'professional');
</script>
<script src="/js/purchase-tracking.js"></script>
<script src="/js/stripe-config.js"></script>
<script>
  // handleCheckoutResult() normalmente se dispara solo si el pathname
  // incluye "app.html" (ver stripe-config.js, bloque de inicializacion).
  // Este harness no es app.html, asi que lo llamamos directo -- probamos
  // la funcion, no el gate del pathname (eso no es parte de este bug).
  window.__testDone = handleCheckoutResult();
</script>
</body>
</html>
```

- [ ] **Step 2: Write the Playwright driver script**

Create `public/.test/run-purchase-flow-test.js`:

```js
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

    const start = Date.now();
    await page.goto('http://localhost:8090/.test/purchase-flow-harness.html?session_id=cs_test_playwright_123' + urlSuffix, {
        waitUntil: 'networkidle',
        timeout: 20000,
    });
    // Esperar lo suficiente para que tanto el camino feliz (callback a 50ms)
    // como el de respaldo (timeout a 1200ms) hayan tenido tiempo de correr.
    await page.waitForTimeout(1800);
    const elapsedMs = Date.now() - start;

    const log = await page.evaluate(() => window.__callLog);
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
```

Nota sobre el assert de `event_callback`: la funcion viaja de la pagina de
Node (Playwright) al contexto del navegador via `page.evaluate`, que
serializa a JSON — las funciones no sobreviven ese viaje, por eso el
`window.__callLog` que se lee de vuelta nunca va a tener el `event_callback`
real como funcion invocable desde Node. Lo que si podemos confirmar desde
el lado del navegador es que la *key* `event_callback` estaba presente
en el objeto que se le paso a `gtag()` (aunque para cuando llega a Node ya
sea `undefined` tras la serializacion) y que `event_timeout` sí viaja
(es un numero, sobrevive la serializacion) — de ahi el assert exacto de
arriba.

- [ ] **Step 3: Run it**

```bash
npx http-server public -p 8090 -c-1 &
sleep 1
node public/.test/run-purchase-flow-test.js
```

Expected: `RESULTADO: 20 pasaron, 0 fallaron` across both scenarios, and in
the second scenario's printed call log, `__reloadPage` appears only after
roughly 1.2s (not immediately) — proving the timeout backstop works, not
just the happy path.

- [ ] **Step 4: Also verify the fallback path (sessionStorage missing)**

Temporarily edit `purchase-flow-harness.html`'s
`sessionStorage.setItem('pendingCheckoutPlan', 'professional');` line to
`sessionStorage.removeItem('pendingCheckoutPlan');` instead, re-run Step 3,
and confirm in the printed call log that `getUserPlan` was called and the
final `purchase` event still has `value: 14.99` (not `0`) — proving the
fallback works. **Revert this temporary edit back to the `setItem` version
afterward** so the committed harness represents the primary/common path.

- [ ] **Step 5: Commit**

```bash
git add public/.test/purchase-flow-harness.html public/.test/run-purchase-flow-test.js
git commit -m "test(analytics): add Playwright test proving purchase fires before reload"
```

---

## Task 6: Deploy and manual smoke test

**Files:** none (deploy + verification only)

**⚠️ Prerequisite — check before Step 3, not after:** `functions/index.js:36`
currently reads `const IS_TEST_MODE = false; // LIVE MODE`, and the
fallback price IDs in `stripe-config.js` are commented `LIVE`. Stripe's
test card `4242 4242 4242 4242` only works against Stripe **test-mode**
keys and test-mode price IDs. Confirm with Ricardo whether this
environment can be pointed at Stripe test mode for the smoke test, or
whether verification needs to be a real, refundable live transaction
instead — otherwise a failed smoke test could be misread as "the fix
didn't work" when it's really "the test card was rejected by Stripe live
mode."

- [ ] **Step 1: Confirm the `.test` folder won't deploy**

```bash
npx firebase deploy --only hosting --dry-run 2>&1 | grep -i "\.test"
```

Expected: no output (nothing under `public/.test/` appears in the deploy
manifest — it's excluded by the existing `"**/.*"` pattern in
`firebase.json`'s hosting `ignore` list; no `firebase.json` change needed
for this).

- [ ] **Step 2: Deploy**

```bash
npx firebase deploy --only hosting
```

- [ ] **Step 3: Manual smoke test with a real Stripe test-mode checkout**

This is the one thing no automated test in this plan can substitute for —
confirms the fix works against the *real* `app.html`, real Firebase Auth
timing, real Stripe redirect round-trip, not just the harness's stubs.

1. Log in to `https://smartloadsolution.com/app.html` with a test account.
2. Open GA4 → Admin → DebugView (or enable debug mode via the
   `?gtm_debug=1`-style flag your GA4 setup uses, if any — check with
   Ricardo which method his GA4 property expects).
3. Start a checkout for the Professional or Premium plan, complete it
   using Stripe's test card `4242 4242 4242 4242`, any future expiry,
   any CVC.
4. On the redirect back to `/app.html?session_id=...`, confirm in GA4
   DebugView (should update in real time) that a `purchase` event
   arrived with a non-zero `value` and the correct `transaction_id`.

- [ ] **Step 4: Report back**

Note whether the manual smoke test in Step 3 succeeded. If GA4 DebugView
doesn't show the event, that's a signal something in the *real* auth/init
timing differs from the harness's assumptions — worth a follow-up
investigation, not something to guess-fix blind.
