# Admin Billing Overview Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "💳 Facturación" dashboard section to the top of the admin User Control list page (`public/admin-users.html`) showing aggregate revenue/MRR/payment-issue numbers across all users, with a revenue-trend chart (Mes/Año toggle) and a plan-distribution donut, backed by a new admin-only Cloud Function.

**Architecture:** A new Cloud Function `adminGetBillingOverview` scans `collectionGroup('payments')` and `collectionGroup('subscriptions')` across every user (Admin SDK bypasses security rules), aggregates in memory (no new Firestore index needed), and returns both a totals summary and pre-computed month/year revenue breakdowns so the frontend's Mes/Año toggle never needs to re-fetch. The frontend adds a new section to the existing list view using Chart.js (already loaded elsewhere in this app for `app.html`'s finances charts) for the two visualizations, with the plan-distribution donut computed entirely client-side from data the page already has.

**Tech Stack:** Firebase Cloud Functions v2 (`onCall`), Firestore Admin SDK (`collectionGroup` queries), vanilla JS + Chart.js 4.4.0 (CDN) on the frontend — no build step, no new dependencies beyond the CDN script tag already proven elsewhere in this codebase.

**Reference spec:** `docs/superpowers/specs/2026-08-20-admin-billing-overview-design.md`

---

## Task 1: Backend test infra — collectionGroup mock support + fixtures

**Files:**
- Modify: `functions/test-admin.js`

This task only prepares the mock test harness (no production code, no new assertions for the function itself yet) — Task 2 adds the failing test, Task 3 implements the function.

- [ ] **Step 1: Add relative-date helpers and new fixtures**

In `functions/test-admin.js`, find the very top of the file, right before `const STORE = {`:

```js
const Module = require('module');
const path = require('path');

// ─── Mock Firestore store ────────────────────────────────────────────────────
const STORE = {
```

Replace with (adding date helpers before `STORE` — `revenueByMonth` is a rolling 12-month window, so fixtures must use dates relative to "now" rather than fixed epochs, or the test would silently stop exercising that window once enough real time passes):

```js
const Module = require('module');
const path = require('path');

// Fechas relativas a "ahora": revenueByMonth es una ventana movil de 12 meses,
// asi que los fixtures de esa parte del test deben ser relativos al momento en
// que se ejecuta el test, no epochs fijos (que eventualmente quedarian fuera
// de la ventana y dejarian de probar nada).
const _now = new Date();
function _monthsAgoEpoch(n, day = 15) {
    return Math.floor(new Date(_now.getFullYear(), _now.getMonth() - n, day).getTime() / 1000);
}

// ─── Mock Firestore store ────────────────────────────────────────────────────
const STORE = {
```

- [ ] **Step 2: Add the `u3` user and extend the `u1` subscription fixture**

In `functions/test-admin.js`, find the `u2` entry in `STORE.users` and the closing of the `users` object:

```js
        u2: {
            email: 'driver2@test.com', role: 'user', plan: 'free',
            subscriptionStatus: 'none', subscriptionId: null,
            accountStatus: 'active', createdAt: new Date('2025-07-01'),
        },
    },
```

Replace with (adding `u3`, a second paying user needed to prove `adminGetBillingOverview` aggregates *across* users, not just the one already used by the per-user detail tests):

```js
        u2: {
            email: 'driver2@test.com', role: 'user', plan: 'free',
            subscriptionStatus: 'none', subscriptionId: null,
            accountStatus: 'active', createdAt: new Date('2025-07-01'),
        },
        u3: {
            email: 'biller@test.com', role: 'user', plan: 'premium',
            subscriptionStatus: 'active', subscriptionId: 'sub_999',
            accountStatus: 'active', createdAt: new Date('2024-01-01'),
            stripeCustomerId: 'cus_3',
        },
    },
```

- [ ] **Step 3: Add price data to the existing subscription and seed `u3`'s subscription/payments**

In `functions/test-admin.js`, find:

```js
    'customers/u1/subscriptions': {
        sub_123: { id: 'sub_123', status: 'active', current_period_end: 1800000000 },
    },
    'customers/u1/payments': {
        pay_1: { id: 'pay_1', amount: 1499, currency: 'usd', status: 'succeeded', created: 1700000000 },
        pay_2: { id: 'pay_2', amount: 2999, currency: 'usd', status: 'succeeded', created: 1701000000 },
        pay_3: { id: 'pay_3', amount: 1499, currency: 'usd', status: 'requires_payment_method', created: 1702000000 },
    },
};
```

Replace with (`sub_123` gains a `price.unit_amount` field — a pure addition, doesn't change any existing assertion about it — and `u3` gets its own subscription using the *other* documented shape, `items.data[0].price.unit_amount`, so the test covers both fallback paths the MRR calculation must tolerate; `u3`'s payments use the new relative-date helper so one lands in "this month", one two months back, and one 13 months back — deliberately just outside the 12-month window):

```js
    'customers/u1/subscriptions': {
        sub_123: { id: 'sub_123', status: 'active', current_period_end: 1800000000, price: { unit_amount: 1499 } },
    },
    'customers/u1/payments': {
        pay_1: { id: 'pay_1', amount: 1499, currency: 'usd', status: 'succeeded', created: 1700000000 },
        pay_2: { id: 'pay_2', amount: 2999, currency: 'usd', status: 'succeeded', created: 1701000000 },
        pay_3: { id: 'pay_3', amount: 1499, currency: 'usd', status: 'requires_payment_method', created: 1702000000 },
    },
    'customers/u3/subscriptions': {
        sub_999: { id: 'sub_999', status: 'active', items: { data: [{ price: { unit_amount: 2999 } }] } },
    },
    'customers/u3/payments': {
        pay_u3_1: { id: 'pay_u3_1', amount: 999, currency: 'usd', status: 'succeeded', created: _monthsAgoEpoch(0) },
        pay_u3_2: { id: 'pay_u3_2', amount: 1999, currency: 'usd', status: 'succeeded', created: _monthsAgoEpoch(2) },
        pay_u3_3: { id: 'pay_u3_3', amount: 999, currency: 'usd', status: 'succeeded', created: _monthsAgoEpoch(13) },
    },
    'customers/u2/payments': {
        pay_u2_1: { id: 'pay_u2_1', amount: 500, currency: 'usd', status: 'succeeded', created: 1650000000 },
    },
};
```

(`u2` — the existing free-plan user with no active subscription — gets one old payment, e.g. from before they downgraded to free. This gives the aggregation test a third distinct contributing user without adding a new user record or touching the `count === 4` assertion from Step 5 below, and adds a third calendar year, 2022, to `revenueByYear`.)

- [ ] **Step 4: Add `collectionGroup` support to the mock Firestore `db`**

In `functions/test-admin.js`, find:

```js
const db = {
    collection(name) { return makeCol(name); },
    // acceso raw usado por tests para sembrar
    _seed: STORE,
};
```

Replace with (a real Firestore `collectionGroup(id)` query matches every subcollection named `id` regardless of its parent document — the mock reproduces that by scanning every top-level `STORE` key whose path ends in `/${name}`, since this mock stores subcollections as flat keys like `'customers/u1/payments'`):

```js
function collectionGroupSnapshot(name) {
    const docs = [];
    for (const key of Object.keys(STORE)) {
        if (key === name || key.endsWith('/' + name)) {
            for (const [id, data] of Object.entries(STORE[key])) {
                docs.push({ id, data: () => data });
            }
        }
    }
    return { docs, size: docs.length, forEach(cb) { docs.forEach(cb); } };
}
function makeCollectionGroup(name) {
    const query = {
        limit() { return query; },
        orderBy() { return query; },
        get: async () => collectionGroupSnapshot(name),
    };
    return query;
}

const db = {
    collection(name) { return makeCol(name); },
    collectionGroup(name) { return makeCollectionGroup(name); },
    // acceso raw usado por tests para sembrar
    _seed: STORE,
};
```

- [ ] **Step 5: Update the now-stale user-count assertion**

In `functions/test-admin.js`, find:

```js
    assert(listRes.count === 3, 'lista 3 usuarios (count=' + listRes.count + ')');
```

Replace with:

```js
    assert(listRes.count === 4, 'lista 4 usuarios (count=' + listRes.count + ')');
```

- [ ] **Step 6: Run the test suite to confirm nothing broke**

Run: `node functions/test-admin.js`
Expected: `RESULTADO: 30 pasaron, 0 fallaron` (same count as before — this task only added fixtures/infra and fixed the one assertion that adding `u3` was guaranteed to break; no new assertions yet).

- [ ] **Step 7: Commit**

```bash
git add functions/test-admin.js
git commit -m "test(admin): add collectionGroup mock support and multi-user billing fixtures"
```

---

## Task 2: Backend — write the failing test for adminGetBillingOverview

**Files:**
- Modify: `functions/test-admin.js`

- [ ] **Step 1: Add the new test section**

In `functions/test-admin.js`, find the end of the file:

```js
    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
```

Replace with (inserting the new section right before the final summary — computing expected values the same way the fixtures were built, so the assertions stay correct no matter which real calendar month/year the suite actually runs in):

```js
    section('adminGetBillingOverview — agregados globales');
    const bo = await call(fns.adminGetBillingOverview, adminCtx, {});
    assert(Math.abs(bo.totalRevenue - 89.95) < 0.001, 'totalRevenue suma todos los pagos succeeded de los 3 usuarios contribuyentes (14.99+29.99+9.99+19.99+9.99+5.00)');
    assert(bo.failedPaymentsCount === 1, 'failedPaymentsCount cuenta el unico pago no-succeeded (pay_3)');
    assert(Math.abs(bo.mrr - 44.98) < 0.001, 'mrr suma unit_amount de las 2 suscripciones activas, via ambos formatos (price.unit_amount y items.data[0].price.unit_amount)');
    assert(Math.abs(bo.thisMonthRevenue - 9.99) < 0.001, 'thisMonthRevenue solo cuenta el pago de este mes (pay_u3_1)');

    assert(bo.revenueByMonth.length === 12, 'revenueByMonth tiene exactamente 12 meses');
    const monthSum = bo.revenueByMonth.reduce((s, r) => s + r.total, 0);
    assert(Math.abs(monthSum - 29.98) < 0.001, 'revenueByMonth suma 29.98 (9.99+19.99; los pagos de 2022/2023 y el de hace 13 meses quedan fuera de la ventana de 12 meses)');
    assert(Math.abs(bo.revenueByMonth[11].total - 9.99) < 0.001, 'el ultimo mes de revenueByMonth (mes actual) tiene 9.99');

    const expectedByYear = {};
    expectedByYear['2023'] = 44.98;
    expectedByYear['2022'] = 5.00;
    const yThis = String(new Date(_monthsAgoEpoch(0) * 1000).getFullYear());
    expectedByYear[yThis] = (expectedByYear[yThis] || 0) + 9.99;
    const yTwo = String(new Date(_monthsAgoEpoch(2) * 1000).getFullYear());
    expectedByYear[yTwo] = (expectedByYear[yTwo] || 0) + 19.99;
    const yThirteen = String(new Date(_monthsAgoEpoch(13) * 1000).getFullYear());
    expectedByYear[yThirteen] = (expectedByYear[yThirteen] || 0) + 9.99;
    const yearSum = bo.revenueByYear.reduce((s, r) => s + r.total, 0);
    assert(Math.abs(yearSum - 89.95) < 0.001, 'revenueByYear suma el total completo (incluye anios fuera de la ventana de 12 meses)');
    const yearsMatch = bo.revenueByYear.length === Object.keys(expectedByYear).length &&
        bo.revenueByYear.every(r => Math.abs(r.total - (expectedByYear[r.year] || 0)) < 0.001);
    assert(yearsMatch, 'revenueByYear agrupa correctamente por anio calendario, 3 usuarios distintos (' + JSON.stringify(bo.revenueByYear) + ' vs ' + JSON.stringify(expectedByYear) + ')');

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node functions/test-admin.js`
Expected: crashes with `FATAL: TypeError: fn is not a function` — `fns.adminGetBillingOverview` doesn't exist yet (it's `undefined`), so the `call()` helper's `fn({...})` invocation fails immediately, before any `assert()` in the new section runs. This is expected; the function is implemented in Task 3.

- [ ] **Step 3: Commit**

```bash
git add functions/test-admin.js
git commit -m "test(admin): add failing test for adminGetBillingOverview"
```

---

## Task 3: Backend — implement adminGetBillingOverview

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Add date/aggregation helpers and the new function**

In `functions/index.js`, find:

```js
exports.adminGetUsers = onCall(
```

Insert immediately before it (these helpers are specific to the payments/subscriptions aggregation this function does, so they live right next to it rather than near the `loads`-related helpers, which serve a different collection with different field-name quirks):

```js
// Lee la fecha de un pago de Stripe (el campo `created` del extension mirror es
// tipicamente un numero en segundos Unix, pero tambien puede llegar como
// Timestamp de Firestore segun como se haya escrito el documento).
function _paymentDateMs(py) {
    const c = py.created;
    if (typeof c === 'number') return c * 1000;
    if (c && typeof c.toDate === 'function') return c.toDate().getTime();
    if (c && typeof c._seconds === 'number') return c._seconds * 1000;
    return 0;
}
function _monthKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _yearKey(ms) {
    return String(new Date(ms).getFullYear());
}

// ─── Facturacion agregada de todos los usuarios (solo admin) ─────────────────
exports.adminGetBillingOverview = onCall(
    { region: 'us-central1' },
    async (request) => {
        await _requireAdmin(request);

        // Sin where/orderBy a proposito: un collectionGroup con filtros needs a
        // composite index que no existe hoy. Se agrega todo en memoria abajo.
        // limit() es un techo de seguridad, no paginacion real (mismo criterio
        // que la agregacion de `loads` en adminGetUserDetail).
        const [paySnap, subsSnap] = await Promise.all([
            db.collectionGroup('payments').limit(5000).get()
                .catch(() => ({ forEach: () => {} })),
            db.collectionGroup('subscriptions').limit(2000).get()
                .catch(() => ({ forEach: () => {} })),
        ]);

        const payments = [];
        paySnap.forEach(doc => payments.push(doc.data()));
        const subscriptions = [];
        subsSnap.forEach(doc => subscriptions.push(doc.data()));

        let totalRevenue = 0;
        let thisMonthRevenue = 0;
        let failedPaymentsCount = 0;
        const byMonth = {};
        const byYear = {};

        const now = new Date();
        const currentMonthKey = _monthKey(now.getTime());

        for (const py of payments) {
            const amount = Number(py.amount || 0) / 100;
            if (py.status === 'succeeded') {
                totalRevenue += amount;
                const ms = _paymentDateMs(py);
                const mKey = _monthKey(ms);
                const yKey = _yearKey(ms);
                byMonth[mKey] = (byMonth[mKey] || 0) + amount;
                byYear[yKey] = (byYear[yKey] || 0) + amount;
                if (mKey === currentMonthKey) thisMonthRevenue += amount;
            } else {
                failedPaymentsCount++;
            }
        }

        // Ultimos 12 meses, mas antiguo primero, con 0 en los meses sin pagos.
        const revenueByMonth = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = _monthKey(d.getTime());
            revenueByMonth.push({ month: key, total: byMonth[key] || 0 });
        }

        const revenueByYear = Object.keys(byYear).sort().map(year => ({ year, total: byYear[year] }));

        let mrr = 0;
        for (const sub of subscriptions) {
            if (sub.status !== 'active') continue;
            const unitAmount = sub.price?.unit_amount ?? sub.items?.data?.[0]?.price?.unit_amount ?? 0;
            mrr += Number(unitAmount || 0) / 100;
        }

        return { totalRevenue, mrr, thisMonthRevenue, failedPaymentsCount, revenueByMonth, revenueByYear };
    }
);

```

- [ ] **Step 2: Run the test to verify it passes**

Run: `node functions/test-admin.js`
Expected: `RESULTADO: 39 pasaron, 0 fallaron` (30 from before + 9 new assertions in Task 2's section).

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat(admin): add adminGetBillingOverview Cloud Function"
```

---

## Task 4: Sync mock-server fixtures for manual/visual testing

**Files:**
- Modify: `scripts/admin-mock-server.js`

Without this task, the new dashboard would render with mostly-empty/flat charts when manually verified via `?mock=1`, even though the backend logic is correct and tested.

- [ ] **Step 1: Add `collectionGroup` support to the mock server's `db`**

In `scripts/admin-mock-server.js`, find:

```js
const db = { collection(name) { return makeCol(name); } };
```

Replace with:

```js
function collectionGroupSnapshot(name) {
    const docs = [];
    for (const key of Object.keys(STORE)) {
        if (key === name || key.endsWith('/' + name)) {
            for (const [id, data] of Object.entries(STORE[key])) {
                docs.push({ id, data: () => data });
            }
        }
    }
    return { docs, size: docs.length, forEach(cb) { docs.forEach(cb); } };
}
function makeCollectionGroup(name) {
    const query = { limit() { return query; }, orderBy() { return query; }, get: async () => collectionGroupSnapshot(name) };
    return query;
}
const db = { collection(name) { return makeCol(name); }, collectionGroup(name) { return makeCollectionGroup(name); } };
```

- [ ] **Step 2: Add price data and a second user's billing fixtures**

In `scripts/admin-mock-server.js`, find:

```js
    'customers/u1/subscriptions': {
        sub_123: { id: 'sub_123', status: 'active', current_period_end: 1800000000, price: { id: 'price_pro' } },
    },
    'customers/u1/payments': {
        pay_1: { id: 'pay_1', amount: 1499, currency: 'usd', status: 'succeeded', created: 1700000000 },
        pay_2: { id: 'pay_2', amount: 1499, currency: 'usd', status: 'succeeded', created: 1702500000 },
        pay_3: { id: 'pay_3', amount: 1499, currency: 'usd', status: 'requires_payment_method', created: 1703000000 },
    },
};
```

Replace with (`sub_123` gains a real `unit_amount`; `u3` — already defined earlier in this same `STORE.users` as `vip@test.com`, premium, `canceled_scheduled` — gets its own Stripe subscription doc with `status: 'active'` and `cancel_at_period_end: true`, which is realistic: Stripe keeps a subscription's raw `status` as `'active'` right up until it actually cancels, even when it's scheduled to cancel at period end, matching how the app derives the friendlier `canceled_scheduled` label shown elsewhere. A spread of payment dates across several recent months, using the same relative-date approach as the automated tests, gives the trend chart real shape to display instead of a flat line):

```js
    'customers/u1/subscriptions': {
        sub_123: { id: 'sub_123', status: 'active', current_period_end: 1800000000, price: { id: 'price_pro', unit_amount: 1499 } },
    },
    'customers/u1/payments': {
        pay_1: { id: 'pay_1', amount: 1499, currency: 'usd', status: 'succeeded', created: _monthsAgo(0) },
        pay_2: { id: 'pay_2', amount: 1499, currency: 'usd', status: 'succeeded', created: _monthsAgo(1) },
        pay_3: { id: 'pay_3', amount: 1499, currency: 'usd', status: 'requires_payment_method', created: _monthsAgo(2) },
        pay_4: { id: 'pay_4', amount: 1499, currency: 'usd', status: 'succeeded', created: _monthsAgo(3) },
    },
    'customers/u3/subscriptions': {
        sub_999: { id: 'sub_999', status: 'active', cancel_at_period_end: true, items: { data: [{ price: { unit_amount: 2999 } }] } },
    },
    'customers/u3/payments': {
        pay_u3_1: { id: 'pay_u3_1', amount: 2999, currency: 'usd', status: 'succeeded', created: _monthsAgo(0) },
        pay_u3_2: { id: 'pay_u3_2', amount: 2999, currency: 'usd', status: 'succeeded', created: _monthsAgo(2) },
        pay_u3_3: { id: 'pay_u3_3', amount: 2999, currency: 'usd', status: 'succeeded', created: _monthsAgo(5) },
        pay_u3_4: { id: 'pay_u3_4', amount: 2999, currency: 'usd', status: 'succeeded', created: _monthsAgo(14) },
    },
};
```

- [ ] **Step 3: Add the `_monthsAgo` helper used by the fixtures above**

In `scripts/admin-mock-server.js`, find:

```js
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = 5050;
```

Replace with:

```js
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = 5050;

function _monthsAgo(n, day = 15) {
    const now = new Date();
    return Math.floor(new Date(now.getFullYear(), now.getMonth() - n, day).getTime() / 1000);
}
```

- [ ] **Step 4: Verify the mock server still starts cleanly**

Run: `node scripts/admin-mock-server.js` (in the background — it doesn't exit on its own)
Expected output: `🧪 Admin mock server corriendo en http://localhost:5050/admin-users.html?mock=1`, no stack trace. Stop it afterwards (full manual verification happens in Task 9).

- [ ] **Step 5: Commit**

```bash
git add scripts/admin-mock-server.js
git commit -m "test(admin): sync mock-server with collectionGroup support and billing fixtures"
```

---

## Task 5: Frontend — CSS for the billing section

**Files:**
- Modify: `public/admin-users.html`

- [ ] **Step 1: Add the billing-section CSS block**

In `public/admin-users.html`, find:

```css
        .pill-status-canceled_scheduled { background: rgba(245,158,11,.18); color: #fbbf24; }

        /* Detail page */
```

Replace with:

```css
        .pill-status-canceled_scheduled { background: rgba(245,158,11,.18); color: #fbbf24; }

        /* Billing overview (lista principal) */
        .billing-section { margin-bottom: 18px; }
        .billing-section .billing-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 12px; flex-wrap: wrap; gap: 10px;
        }
        .billing-section .billing-header h2 { font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
        .period-toggle { display: inline-flex; background: rgba(0,0,0,.3); border-radius: 8px; padding: 2px; font-size: .78rem; }
        .period-toggle span { padding: 5px 14px; border-radius: 6px; color: var(--muted); cursor: pointer; user-select: none; }
        .period-toggle span.active { background: var(--purple); color: #fff; }
        .billing-charts { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-top: 14px; }
        .billing-charts .card {
            background: var(--glass); border: 1px solid var(--glass-border);
            border-radius: 14px; padding: 16px; backdrop-filter: blur(8px);
        }
        .billing-charts .card h4 { font-size: .72rem; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; letter-spacing: .05em; }
        .billing-charts canvas { max-height: 220px; }
        @media (max-width: 860px) { .billing-charts { grid-template-columns: 1fr; } }

        /* Detail page */
```

- [ ] **Step 2: Commit**

```bash
git add public/admin-users.html
git commit -m "feat(admin): add CSS for the billing overview dashboard section"
```

---

## Task 6: Frontend — HTML container and Chart.js script tag

**Files:**
- Modify: `public/admin-users.html`

- [ ] **Step 1: Insert the billing overview container**

In `public/admin-users.html`, find:

```html
            <div class="stats" id="stats"></div>

            <div class="table-card">
```

Replace with:

```html
            <div class="stats" id="stats"></div>

            <div id="billingOverview" class="billing-section hidden">
                <div class="billing-header">
                    <h2>💳 Facturación</h2>
                    <div class="period-toggle">
                        <span id="periodMonthBtn" class="active" onclick="setBillingPeriod('month')">Mes</span>
                        <span id="periodYearBtn" onclick="setBillingPeriod('year')">Año</span>
                    </div>
                </div>
                <div class="stats">
                    <div class="stat"><div class="label">Ingresos totales</div><div class="value" id="billTotalRevenue">—</div></div>
                    <div class="stat"><div class="label">MRR actual</div><div class="value" id="billMrr">—</div></div>
                    <div class="stat"><div class="label">Este mes</div><div class="value" id="billThisMonth">—</div></div>
                    <div class="stat"><div class="label">Pagos con problema</div><div class="value" id="billFailed">—</div></div>
                </div>
                <div class="billing-charts">
                    <div class="card">
                        <h4>Ingresos por período</h4>
                        <canvas id="revenueChart"></canvas>
                    </div>
                    <div class="card">
                        <h4>Distribución por plan</h4>
                        <canvas id="planChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="table-card">
```

- [ ] **Step 2: Add the Chart.js CDN script tag**

In `public/admin-users.html`, find:

```html
    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js"></script>
    <script src="./js/config.js"></script>
```

Replace with:

```html
    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <script src="./js/config.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add public/admin-users.html
git commit -m "feat(admin): add billing overview HTML container and load Chart.js"
```

---

## Task 7: Frontend — render logic and charts

**Files:**
- Modify: `public/admin-users.html`

- [ ] **Step 1: Add the module-level billing state variables**

In `public/admin-users.html`, find:

```js
        let ALL_USERS = [];
        let routingInitialized = false;
```

Replace with:

```js
        let ALL_USERS = [];
        let routingInitialized = false;
        let BILLING_DATA = null;
        let billingPeriod = 'month';
        let revenueChart = null;
        let planChart = null;
        // Inspirados en los colores de .pill-* (mismo orden de tonos: gris, azul,
        // cyan, magenta/purpura) pero mas saturados -- los fondos reales de las
        // pills son oscuros y quedan planos/dificiles de distinguir como
        // segmentos solidos de una dona sobre el mismo fondo oscuro de la pagina.
        const PLAN_CHART_COLORS = { free: '#64748b', starter: '#3b82f6', professional: '#22d3ee', premium: '#db2777' };
```

- [ ] **Step 2: Add the render functions**

In `public/admin-users.html`, find:

```js
        function fmtMoney(n) {
            return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
```

Replace with (keeping `fmtMoney` and adding the new billing-overview functions right after it, since they all use it):

```js
        function fmtMoney(n) {
            return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        async function renderBillingOverview() {
            try {
                const res = await cf('adminGetBillingOverview')();
                BILLING_DATA = res.data;
                document.getElementById('billingOverview').classList.remove('hidden');
                document.getElementById('billTotalRevenue').textContent = fmtMoney(BILLING_DATA.totalRevenue);
                document.getElementById('billMrr').textContent = fmtMoney(BILLING_DATA.mrr);
                document.getElementById('billThisMonth').textContent = fmtMoney(BILLING_DATA.thisMonthRevenue);
                document.getElementById('billFailed').textContent = BILLING_DATA.failedPaymentsCount;
                renderRevenueChart();
                renderPlanDistributionChart();
            } catch (e) {
                console.warn('[billing-overview]', e.message || e);
                document.getElementById('billingOverview').classList.add('hidden');
            }
        }

        function setBillingPeriod(period) {
            billingPeriod = period;
            document.getElementById('periodMonthBtn').classList.toggle('active', period === 'month');
            document.getElementById('periodYearBtn').classList.toggle('active', period === 'year');
            renderRevenueChart();
        }

        function renderRevenueChart() {
            if (!BILLING_DATA || typeof Chart === 'undefined') return;
            const rows = billingPeriod === 'month' ? BILLING_DATA.revenueByMonth : BILLING_DATA.revenueByYear;
            const labels = rows.map(r => r.month || r.year);
            const values = rows.map(r => r.total);
            const canvas = document.getElementById('revenueChart');
            if (revenueChart) {
                revenueChart.data.labels = labels;
                revenueChart.data.datasets[0].data = values;
                revenueChart.update();
                return;
            }
            revenueChart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{ label: 'Ingresos', data: values, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.2)', tension: 0.3, fill: true }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#93a0c0' }, grid: { color: 'rgba(255,255,255,.06)' } },
                        y: { beginAtZero: true, ticks: { color: '#93a0c0', callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,.06)' } },
                    },
                },
            });
        }

        function renderPlanDistributionChart() {
            if (typeof Chart === 'undefined') return;
            const canvas = document.getElementById('planChart');
            if (!canvas) return;
            const byPlan = { free: 0, starter: 0, professional: 0, premium: 0 };
            ALL_USERS.forEach(u => { if (byPlan[u.plan] !== undefined) byPlan[u.plan]++; });
            const labels = Object.keys(byPlan);
            const values = labels.map(k => byPlan[k]);
            const colors = labels.map(k => PLAN_CHART_COLORS[k]);
            if (planChart) {
                planChart.data.datasets[0].data = values;
                planChart.update();
                return;
            }
            planChart = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels.map(l => l.toUpperCase()),
                    datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#93a0c0', font: { size: 10 } } } },
                },
            });
        }
```

- [ ] **Step 3: Commit**

```bash
git add public/admin-users.html
git commit -m "feat(admin): add billing overview render logic and Chart.js charts"
```

---

## Task 8: Wire the billing overview into the list-view load flow

**Files:**
- Modify: `public/admin-users.html`

- [ ] **Step 1: Call `renderBillingOverview()` when the list view shows**

In `public/admin-users.html`, find:

```js
        function showListView() {
            document.getElementById('detailView').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            refreshUsers();
        }
```

Replace with (both calls are fire-and-forget — `renderBillingOverview()`'s heavier `collectionGroup` scan runs in parallel with `refreshUsers()` rather than blocking the table, matching the spec's requirement that the dashboard not slow down the page's primary job):

```js
        function showListView() {
            document.getElementById('detailView').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            refreshUsers();
            renderBillingOverview();
        }
```

- [ ] **Step 2: Re-draw the plan-distribution donut once user data is available**

In `public/admin-users.html`, find:

```js
        async function refreshUsers() {
            try {
                showToast('Cargando usuarios…');
                const res = await cf('adminGetUsers')();
                ALL_USERS = res.data.users || [];
                renderStats();
                renderTable();
                showToast('✅ ' + ALL_USERS.length + ' usuarios', 'ok');
            } catch (e) {
                showToast('❌ ' + (e.message || e), 'err');
            }
        }
```

Replace with (`renderBillingOverview()` and `refreshUsers()` run concurrently and finish in an unpredictable order; the plan-distribution chart needs both `ALL_USERS` populated AND the billing section visible, so each function re-draws it once its own half of the data is ready — whichever finishes last ends up with a fully correct chart, and if `refreshUsers()` finishes first, `BILLING_DATA` is still `null` so this guard simply skips, letting `renderBillingOverview()`'s own call draw it moments later):

```js
        async function refreshUsers() {
            try {
                showToast('Cargando usuarios…');
                const res = await cf('adminGetUsers')();
                ALL_USERS = res.data.users || [];
                renderStats();
                renderTable();
                if (BILLING_DATA) renderPlanDistributionChart();
                showToast('✅ ' + ALL_USERS.length + ' usuarios', 'ok');
            } catch (e) {
                showToast('❌ ' + (e.message || e), 'err');
            }
        }
```

- [ ] **Step 3: Commit**

```bash
git add public/admin-users.html
git commit -m "feat(admin): wire billing overview into the list-view load flow"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the mock server**

Run (background): `node scripts/admin-mock-server.js`
Expected: `🧪 Admin mock server corriendo en http://localhost:5050/admin-users.html?mock=1`

- [ ] **Step 2: Verify the dashboard renders with real data**

Open `http://localhost:5050/admin-users.html?mock=1` in a browser (or drive it with Playwright, matching the pattern already established in this project's `scripts/`/scratchpad tooling).

Expected:
- A "💳 Facturación" section appears above the user table, below the existing plan/status stats row.
- Four stat cards show non-zero, dollar-formatted values for Ingresos totales, MRR actual, Este mes, and a numeric count for Pagos con problema.
- A line chart labeled "Ingresos por período" renders with visible variation across months (not a flat line), reflecting the spread of payment dates seeded in Task 4.
- A doughnut chart labeled "Distribución por plan" renders with segments for the plans present among the 4 mock users.

- [ ] **Step 3: Verify the Mes/Año toggle works without a network request**

Click "Año". Confirm the revenue chart's x-axis labels switch from `YYYY-MM` months to `YYYY` years, and that no new network request fires (open browser dev tools' Network tab, or check that the switch is instantaneous with no loading state) — this confirms the toggle uses the already-fetched `BILLING_DATA` rather than re-calling the backend, as specified.

- [ ] **Step 4: Verify graceful failure**

Temporarily rename `scripts/admin-mock-server.js`'s `adminGetBillingOverview` mock route (or stop the server and reload the page to force a fetch failure), reload the page, and confirm the "💳 Facturación" section is simply absent — not a broken/error-styled block — while the user list and its own stats row continue to work normally. Revert any temporary change before moving on.

- [ ] **Step 5: Stop the mock server**

Find and stop the background process started in Step 1.

- [ ] **Step 6: If any step didn't match, fix and re-verify before continuing**

---

## Task 10: Final commit check

**Files:** none

- [ ] **Step 1: Confirm all commits from Tasks 1-8 are present**

Run: `git log --oneline -10`
Expected: 8 commits (one per Task 1-8), most recent first, matching this plan's task list.

Run: `git status --short`
Expected: no pending changes from this feature.

- [ ] **Step 2: Run the full backend test suite one more time**

Run: `node functions/test-admin.js`
Expected: `RESULTADO: 39 pasaron, 0 fallaron`

- [ ] **Step 3: Stop here — do not deploy**

Report completion and wait for the user to say "deploy" before running `firebase deploy --only functions:adminGetBillingOverview,hosting` (scoping the functions deploy to just the new function, same reasoning as the prior admin-detail-page plan's deploy — avoids re-triggering the unrelated, pre-existing `stripeWebhook` secret/env-var conflict documented earlier in this project's history).
