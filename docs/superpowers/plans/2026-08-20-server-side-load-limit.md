# Server-Side Load Limit Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the free plan's 30-loads/month limit actually enforced by the server (a new Cloud Function `createLoad`), instead of only suggested by client-side JavaScript that anyone can bypass.

**Architecture:** A new callable Cloud Function `createLoad` becomes the only legitimate way to create a `loads` document — it resolves the caller's real plan (replicating the client's existing Stripe-subscription-aware logic), atomically checks the monthly limit and writes the load + counter update in one Firestore transaction, and `firestore.rules` is tightened to reject any direct client write. The client (`calculator.js`) is updated to call the function instead of writing directly, keeping its existing fast client-side pre-check and upgrade-modal UX unchanged. A code review of the first draft found that `createLoad`'s security check reads `users/{uid}` fields (`plan`, `loadsThisMonth`, `monthStartDate`) that were still directly writable by the client — Tasks 3-4 close that gap by trimming two client-side writes down to only what's still needed and adding a matching `firestore.rules` lockdown, before Tasks 5-6 do the originally-planned `loads`-collection lockdown.

**Tech Stack:** Firebase Cloud Functions v2 (`onCall`), Firestore Admin SDK transactions (`db.runTransaction`), vanilla JS callable-function invocation on the client — no new dependencies.

**Reference specs:** `docs/superpowers/specs/2026-08-20-server-side-load-limit-design.md`, `docs/superpowers/specs/2026-08-20-lock-server-owned-user-fields-design.md`

---

## Task 1: Backend — write the failing test for createLoad

**Files:**
- Create: `functions/test-createLoad.js`

This is a brand-new, self-contained test file (no emulator required), following the exact mocked-Firestore pattern already established in `functions/test-admin.js` — but as a new file, this task writes the entire mock harness AND all test assertions in one step, since the harness itself has no behavior of its own to fail; only the assertions against the not-yet-implemented `createLoad` function will fail.

- [ ] **Step 1: Write the complete test file**

Create `functions/test-createLoad.js`:

```js
/**
 * test-createLoad.js — Test unitario aislado de la Cloud Function createLoad.
 * No requiere emulador ni producción: mockea firebase-admin, firebase-functions.
 * Ejecutar: node functions/test-createLoad.js
 */

const Module = require('module');
const path = require('path');

// ─── Mock Firestore store ────────────────────────────────────────────────────
const _now = new Date();

const STORE = {
    users: {
        free_under: {
            role: 'user', plan: 'free',
            loadsThisMonth: 5, monthStartDate: _now.toISOString(),
        },
        free_at_limit: {
            role: 'user', plan: 'free',
            loadsThisMonth: 30, monthStartDate: _now.toISOString(),
        },
        free_stale_month: {
            role: 'user', plan: 'free',
            loadsThisMonth: 30, monthStartDate: '2020-01-01T00:00:00.000Z',
        },
        pro_user: {
            role: 'user', plan: 'professional',
            loadsThisMonth: 500, monthStartDate: _now.toISOString(),
        },
        premium_user: {
            role: 'user', plan: 'premium',
            loadsThisMonth: 500, monthStartDate: _now.toISOString(),
        },
        admin_user: {
            role: 'admin', plan: 'free',
            loadsThisMonth: 999, monthStartDate: _now.toISOString(),
        },
        starter_user: {
            role: 'user', plan: 'starter',
            loadsThisMonth: 30, monthStartDate: _now.toISOString(),
        },
        stripe_pro_user: {
            role: 'user', plan: 'free', // campo plan desactualizado a proposito
            loadsThisMonth: 500, monthStartDate: _now.toISOString(),
        },
    },
    'customers/stripe_pro_user/subscriptions': {
        sub_1: { status: 'active', items: [{ price: { id: 'price_1T4CmZPrcqI2pVW0wjZkexA8' } }] },
    },
};

const VALID_LOAD = {
    userId: 'ignored-should-be-overwritten',
    origin: 'Detroit, MI',
    destination: 'Atlanta, GA',
    totalMiles: 700,
    rpm: 1.6,
    totalCharge: 1120,
};

function getColObj(name) { return STORE[name] || (STORE[name] = {}); }
function collectionSnapshot(name) {
    const obj = getColObj(name);
    const entries = Object.entries(obj);
    return {
        empty: entries.length === 0, size: entries.length,
        forEach(cb) { entries.forEach(([id, data]) => cb({ id, data: () => data })); },
        docs: entries.map(([id, data]) => ({ id, data: () => data })),
    };
}

// Resuelve sentinels de FieldValue (por ahora solo increment()) contra el
// valor existente antes de guardar -- un Object.assign ingenuo sobrescribiria
// el campo con el objeto sentinel literal en vez de sumar.
function _applyFieldValues(existing, incoming) {
    const result = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
        if (v && typeof v === 'object' && '__increment' in v) {
            result[k] = (Number(existing?.[k]) || 0) + v.__increment;
        } else {
            result[k] = v;
        }
    }
    return result;
}

let _autoIdCounter = 0;
function makeDoc(colName, id) {
    return {
        id,
        get() {
            const sub = STORE[colName] && STORE[colName][id];
            return Promise.resolve(sub ? { exists: true, data: () => sub, id } : { exists: false, data: () => undefined, id });
        },
        set(obj, opts) {
            STORE[colName] = STORE[colName] || {};
            STORE[colName][id] = (opts && opts.merge)
                ? _applyFieldValues(STORE[colName][id] || {}, obj)
                : _applyFieldValues({}, obj);
            return Promise.resolve();
        },
        update(obj) {
            STORE[colName] = STORE[colName] || {};
            STORE[colName][id] = _applyFieldValues(STORE[colName][id] || {}, obj);
            return Promise.resolve();
        },
        collection(sub) { return makeCol(`${colName}/${id}/${sub}`); },
    };
}

function makeCol(name, filter) {
    const query = {
        orderBy() { return query; },
        limit() { return query; },
        where(field, op, value) { return makeCol(name, { field, op, value }); },
        get: async () => {
            const snap = collectionSnapshot(name);
            if (filter) {
                const filtered = snap.docs.filter(d => d.data()[filter.field] === filter.value);
                return {
                    empty: filtered.length === 0, size: filtered.length,
                    forEach(cb) { filtered.forEach(d => cb(d)); },
                    docs: filtered,
                };
            }
            return snap;
        },
        doc(id) {
            const realId = id || ('auto_' + (++_autoIdCounter));
            return makeDoc(name, realId);
        },
    };
    return query;
}

// Simula runTransaction con rollback real: los writes solo se aplican si el
// callback no lanza (misma garantia de atomicidad que la Firestore real, para
// lo que este test necesita verificar: nada se escribe si el limite rechaza).
async function mockRunTransaction(updateFn) {
    const pendingWrites = [];
    const tx = {
        get(refLike) { return refLike.get(); },
        set(refLike, data, opts) { pendingWrites.push(() => refLike.set(data, opts)); },
        update(refLike, data) { pendingWrites.push(() => refLike.update(data)); },
    };
    const result = await updateFn(tx);
    for (const w of pendingWrites) w();
    return result;
}

const db = {
    collection(name) { return makeCol(name); },
    runTransaction: mockRunTransaction,
};

// ─── Mock firebase-admin ─────────────────────────────────────────────────────
const firestoreInstance = Object.assign(
    () => db,
    {
        Timestamp: { fromDate: (d) => ({ _seconds: Math.floor(d.getTime() / 1000) }) },
        FieldValue: {
            serverTimestamp: () => ({ __serverTS: true }),
            increment: (n) => ({ __increment: n }),
        },
    }
);
const adminMock = {
    initializeApp() {},
    firestore: firestoreInstance,
    apps: [{}],
};

// ─── Mock firebase-functions ───────────────────────────────────────────────
class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; this.details = message; }
}
function onCall(opts, handler) {
    return async (request) => handler(request);
}
const fnV2 = {
    HttpsError,
    onCall,
    onRequest(opts, handler) { return { __onRequest: true }; },
    onSchedule(opts, handler) { return { __onSchedule: true }; },
    setGlobalOptions() {},
};
const loggerMock = { info() {}, warn() {}, error() {}, debug() {} };

// ─── Mock stripe ─────────────────────────────────────────────────────────────
class StripeMock {
    constructor() {
        this.subscriptions = {
            update: (id, obj) => Promise.resolve({ id, status: 'canceled', ...obj }),
            list: () => Promise.resolve({ data: [] }),
        };
    }
}

// ─── Interceptar requires ────────────────────────────────────────────────────
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'firebase-admin') return adminMock;
    if (request === 'firebase-functions/v2/https') return fnV2;
    if (request === 'firebase-functions/v2/scheduler') return fnV2;
    if (request === 'firebase-functions/v2') return fnV2;
    if (request === 'firebase-functions/logger') return loggerMock;
    if (request === 'stripe') return StripeMock;
    if (request === 'express') { const e = () => ({ use() {}, post() {}, get() {} }); e.raw = () => ({}); e.json = () => ({}); e.urlencoded = () => ({}); return e; }
    return origLoad.apply(this, arguments);
};

// ─── Cargar index.js (ya con mocks) ──────────────────────────────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
const fns = require('./index.js');

// ─── Utilidades de test ──────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

(async () => {
    const call = (uid, data) => fns.createLoad({ auth: uid ? { uid } : null, data: data || {} });

    section('createLoad — guard de autenticacion');
    try {
        await call(null, VALID_LOAD);
        assert(false, 'sin auth debe ser rechazado');
    } catch (e) {
        assert(e.code === 'unauthenticated', 'sin auth lanza unauthenticated (' + e.code + ')');
    }

    section('createLoad — validacion de payload');
    try {
        await call('free_under', { ...VALID_LOAD, origin: undefined });
        assert(false, 'campo requerido faltante debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'falta origin lanza invalid-argument (' + e.code + ')');
    }
    try {
        await call('free_under', { ...VALID_LOAD, rpm: 999 });
        assert(false, 'rpm fuera de rango debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'rpm fuera de rango lanza invalid-argument (' + e.code + ')');
    }

    section('createLoad — usuario free bajo el limite');
    const r1 = await call('free_under', VALID_LOAD);
    assert(typeof r1.id === 'string' && r1.id.length > 0, 'devuelve un id de carga');
    assert(STORE.users.free_under.loadsThisMonth === 6, 'loadsThisMonth incrementa de 5 a 6');
    const createdLoad1 = STORE.loads[r1.id];
    assert(createdLoad1.userId === 'free_under', 'userId lo pone el servidor, ignora el del payload');
    assert(createdLoad1.createdAt && createdLoad1.createdAt.__serverTS === true, 'createdAt lo pone el servidor (serverTimestamp)');

    section('createLoad — usuario free en el limite exacto');
    const loadsCountBefore = Object.keys(STORE.loads).length;
    try {
        await call('free_at_limit', VALID_LOAD);
        assert(false, 'en el limite exacto debe ser rechazado');
    } catch (e) {
        assert(e.code === 'resource-exhausted', 'en el limite lanza resource-exhausted (' + e.code + ')');
    }
    assert(STORE.users.free_at_limit.loadsThisMonth === 30, 'loadsThisMonth NO cambia tras el rechazo');
    assert(Object.keys(STORE.loads).length === loadsCountBefore, 'no se crea ninguna carga tras el rechazo (rollback)');

    section('createLoad — mes anterior resetea el contador');
    const r3 = await call('free_stale_month', VALID_LOAD);
    assert(typeof r3.id === 'string', 'usuario con mes vencido si puede guardar aunque loadsThisMonth viejo sea 30');
    assert(STORE.users.free_stale_month.loadsThisMonth === 1, 'loadsThisMonth resetea a 1');
    assert(new Date(STORE.users.free_stale_month.monthStartDate).getMonth() === _now.getMonth(), 'monthStartDate se actualiza al mes actual');

    section('createLoad — plan ilimitado no tiene tope');
    const r4 = await call('pro_user', VALID_LOAD);
    assert(typeof r4.id === 'string', 'usuario professional guarda sin problema con loadsThisMonth=500');
    const r4b = await call('premium_user', VALID_LOAD);
    assert(typeof r4b.id === 'string', 'usuario premium guarda sin problema con loadsThisMonth=500');

    section('createLoad — admin no tiene tope');
    const r5 = await call('admin_user', VALID_LOAD);
    assert(typeof r5.id === 'string', 'usuario admin guarda sin problema con loadsThisMonth=999');

    section('createLoad — plan "starter" sin definicion cae al limite de free');
    try {
        await call('starter_user', VALID_LOAD);
        assert(false, 'plan starter en el limite (30) debe ser rechazado igual que free');
    } catch (e) {
        assert(e.code === 'resource-exhausted', 'plan starter sin definicion trata el limite como free (' + e.code + ')');
    }

    section('createLoad — suscripcion activa de Stripe manda sobre el campo plan');
    const r6 = await call('stripe_pro_user', VALID_LOAD);
    assert(typeof r6.id === 'string', 'usuario con suscripcion activa "professional" en Stripe guarda sin tope aunque users.plan diga free');

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node functions/test-createLoad.js`
Expected: crashes with `FATAL: TypeError: fns.createLoad is not a function` (or similar) — `createLoad` doesn't exist yet in `functions/index.js`. This is expected; the function is implemented in Task 2.

- [ ] **Step 3: Commit**

```bash
git add functions/test-createLoad.js
git commit -m "test(loads): add failing test for createLoad Cloud Function"
```

---

## Task 2: Backend — implement createLoad

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Add the plan-limits constant, helpers, and the new function**

In `functions/index.js`, find:

```js
exports.evaluateLoad = onCall(
```

Search forward from there to find where that function's closing `);` is — it's immediately followed by:

```js
// ============================================================
// lexDailyAlerts — Alertas proactivas de Lex (Phase 5)
```

Insert the following new code between `exports.evaluateLoad`'s closing `);` and that `lexDailyAlerts` comment block:

```js

// ─── Crear una carga nueva con limite de plan aplicado (callable) ────────────
// Unico camino legitimo para crear un documento en `loads` -- firestore.rules
// bloquea la escritura directa del cliente (ver Task 4 del plan). Duplica
// deliberadamente los numeros de limite de public/js/userPlans.js (mismo
// patron ya usado en este archivo para ACADEMY_MODULE_LESSONS): si esos
// numeros cambian alli, deben actualizarse aqui tambien.
const PLAN_LOAD_LIMITS = { free: 30, professional: -1, premium: -1, admin: -1 };

const LOAD_REQUIRED_FIELDS = ['userId', 'origin', 'destination', 'totalMiles', 'rpm', 'totalCharge'];

function _validateLoadPayload(data) {
    for (const field of LOAD_REQUIRED_FIELDS) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            throw new HttpsError('invalid-argument', `Missing required field: ${field}`);
        }
    }
    const rpm = Number(data.rpm);
    const totalMiles = Number(data.totalMiles);
    const totalCharge = Number(data.totalCharge);
    if (!(rpm >= 0 && rpm <= 50)) throw new HttpsError('invalid-argument', 'rpm out of bounds');
    if (!(totalMiles >= 0 && totalMiles <= 10000)) throw new HttpsError('invalid-argument', 'totalMiles out of bounds');
    if (!(totalCharge >= 0 && totalCharge <= 500000)) throw new HttpsError('invalid-argument', 'totalCharge out of bounds');
}

// Replica exactamente la logica de resolucion de plan de getUserPlan() en
// public/js/userPlans.js: si el usuario es admin, plan=admin; si tiene una
// suscripcion activa de Stripe, esa suscripcion manda (mapeada via
// PRICE_TO_PLAN) sobre el campo `plan` del documento, que puede estar
// desactualizado; si no, se usa el campo `plan` directamente.
async function _resolveUserPlan(uid, userData) {
    if (userData.role === 'admin') return 'admin';

    const subsSnap = await db.collection('customers').doc(uid)
        .collection('subscriptions').where('status', '==', 'active').get();

    const PLAN_PRIORITY = { free: 0, professional: 1, premium: 2, admin: 3 };
    let planId = null;
    let bestPriority = -1;
    subsSnap.forEach(doc => {
        const priceId = doc.data().items?.[0]?.price?.id;
        const docPlanId = PRICE_TO_PLAN[priceId] || 'free';
        const priority = PLAN_PRIORITY[docPlanId] ?? 0;
        if (priority > bestPriority) {
            bestPriority = priority;
            planId = docPlanId;
        }
    });

    return planId || userData.plan || 'free';
}

exports.createLoad = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const uid = request.auth.uid;
        const data = request.data || {};

        _validateLoadPayload(data);

        const userRef = db.collection('users').doc(uid);
        const newLoadRef = db.collection('loads').doc();

        // Resolver el plan (puede requerir leer suscripciones de Stripe) antes
        // de la transaccion -- no necesita ser transaccionalmente consistente
        // con el contador, solo la creacion de la carga + el contador si.
        const preSnap = await userRef.get();
        const preUserData = preSnap.exists ? preSnap.data() : {};
        const planId = await _resolveUserPlan(uid, preUserData);
        const maxLoads = PLAN_LOAD_LIMITS[planId] ?? PLAN_LOAD_LIMITS.free;

        const result = await db.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            const userData = userSnap.exists ? userSnap.data() : {};

            const now = new Date();
            const monthStart = userData.monthStartDate ? new Date(userData.monthStartDate) : null;
            const sameMonth = !!monthStart &&
                now.getMonth() === monthStart.getMonth() &&
                now.getFullYear() === monthStart.getFullYear();
            const currentCount = sameMonth ? Number(userData.loadsThisMonth || 0) : 0;

            if (maxLoads !== -1 && currentCount >= maxLoads) {
                throw new HttpsError('resource-exhausted', 'Límite de cargas del mes alcanzado');
            }

            const loadData = {
                ...data,
                userId: uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            tx.set(newLoadRef, loadData);

            if (sameMonth) {
                tx.update(userRef, {
                    loadsThisMonth: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                tx.set(userRef, {
                    loadsThisMonth: 1,
                    monthStartDate: now.toISOString(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            return { id: newLoadRef.id };
        });

        return result;
    }
);
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `node functions/test-createLoad.js`
Expected: `RESULTADO: 18 pasaron, 0 fallaron`

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat(loads): implement createLoad Cloud Function with server-side limit enforcement"
```

---

## Task 3: Fix client-side writes to server-owned plan/counter fields

**Files:**
- Modify: `public/js/userPlans.js`

A code quality review of Task 2 found that `createLoad`'s security check reads `users/{uid}.plan`, `.loadsThisMonth`, and `.monthStartDate` — but nothing yet stops a client from writing those fields directly, which would fully defeat the limit check. This task removes the two places `public/js/userPlans.js` itself writes these fields from the client, so that Task 4's `firestore.rules` lockdown doesn't break anything. See `docs/superpowers/specs/2026-08-20-lock-server-owned-user-fields-design.md` for the full investigation of why these two writes are safe to remove.

- [ ] **Step 1: Remove the redundant Stripe-plan-sync write in `getUserPlan()`**

In `public/js/userPlans.js`, find:

```js
            // Sincronizar en users/{uid} para consistencia
            await firebase.firestore().collection('users').doc(userId)
                .set({
                    plan: planId,
                    subscriptionStatus: 'active',
                    subscriptionId: stripeSubId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
        } else {
```

Replace with (this write was always redundant — `activateUserPlan()` in `functions/index.js`, triggered by the existing `stripeWebhook`, already keeps these three fields in sync server-side via the Admin SDK every time a subscription changes. This client-side copy was just a same-page cache refresh, and after Task 4 lands it would fail with `permission-denied` on every login for every paying user — worse, that error would be silently swallowed by this function's own outer `catch` below, incorrectly falling back to a default free-tier plan object and making paying users appear as free-tier in the UI. Removing the write avoids that regression entirely; the function still computes and `return`s the correct resolved plan a few lines down, unchanged):

```js
            // Nota: ya NO se sincroniza aqui de vuelta a Firestore. activateUserPlan()
            // en functions/index.js (via stripeWebhook) ya mantiene plan/subscriptionStatus/
            // subscriptionId al dia server-side; escribir esto desde el cliente es
            // redundante y firestore.rules ahora lo rechaza (ver Task 4).
        } else {
```

- [ ] **Step 2: Stop seeding plan/counter fields at account initialization**

In `public/js/userPlans.js`, find:

```js
            .set({
                email: email,
                plan: 'free',
                subscriptionStatus: 'active',
                loadsThisMonth: 0,
                monthStartDate: new Date().toISOString(),
                lexTrialEndsAt: trialEnd,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
```

Replace with (a user whose `users/{uid}` doc has no `plan` field is already handled correctly everywhere it's read — `getUserPlan()`'s own fallback a few lines up is `userData.plan || 'free'`, and `createLoad`'s `_resolveUserPlan` has the equivalent `planId || userData.plan || 'free'`. A missing `loadsThisMonth`/`monthStartDate` is likewise already handled by `createLoad`'s transaction, which treats a missing/null `monthStartDate` as "month rolled over" and initializes both fields the first time this user ever saves a load. No code path needs these four fields to exist before that point, so it's safe to stop writing them from the client — this write is actually the very first one to touch `users/{uid}` during signup (`public/auth.html` calls `initializeUserPlan()` before writing its own `fullName`/`phone`/`preferredLanguage` fields a few lines later), so it's evaluated as a Firestore `create`, not an `update` — either way, Task 4's rules change requires these fields to be absent at `create` time too, so trimming them here is required regardless of which operation type applies):

```js
            .set({
                email: email,
                lexTrialEndsAt: trialEnd,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
```

- [ ] **Step 3: Verify by reading it back**

Read `public/js/userPlans.js` around both edited regions and confirm: `getUserPlan()`'s `catch` block and its final `return` statement (a few lines after the removed write) are unchanged, `initializeUserPlan()`'s `trialEnd` variable and its own `catch`/`return` are unchanged, and neither edit touches any other function in the file (e.g. `canCreateMoreLoads`, `incrementMonthlyLoads`, `setUserAsAdmin` must all be byte-identical to before). There is no automated test harness for this browser file — this read-back is the verification step.

- [ ] **Step 4: Commit**

```bash
git add public/js/userPlans.js
git commit -m "fix(plans): stop writing plan/counter fields from the client, server already owns them"
```

---

## Task 4: Firestore rules — lock down server-owned fields on users/{uid}

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the two new helper functions**

In `firestore.rules`, find:

```
    function isModifyingRoleFields() {
      return request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'roleAssignedBy', 'roleAssignedAt', 'permissions']);
    }
    
```

Replace with:

```
    function isModifyingRoleFields() {
      return request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'roleAssignedBy', 'roleAssignedAt', 'permissions']);
    }

    function isModifyingServerOwnedFields() {
      return request.resource.data.diff(resource.data).affectedKeys().hasAny(['plan', 'subscriptionStatus', 'subscriptionId', 'loadsThisMonth', 'monthStartDate']);
    }

    function hasNoServerOwnedFieldsAtCreate() {
      return !request.resource.data.keys().hasAny(['plan', 'subscriptionStatus', 'subscriptionId', 'loadsThisMonth', 'monthStartDate']);
    }
    
```

- [ ] **Step 2: Update the `users/{userId}` create/update rules**

In `firestore.rules`, find:

```
      // Creación: usuario puede crear su propio perfil
      allow create: if isOwner(userId);
      
      // Actualización NORMAL (sin tocar roles):
      // Usuario puede actualizar su perfil EXCEPTO campos de roles
      allow update: if isOwner(userId) && !isModifyingRoleFields();
```

Replace with (only these two rules change — the admin-role `update` rule and `allow delete`, both a few lines below, are untouched; `activateUserPlan()`, `adminUpdateUser`'s `setPlan`, and `createLoad` all write via the Admin SDK, which bypasses security rules entirely, so none of them are affected by this change):

```
      // Creación: usuario puede crear su propio perfil, pero no puede sembrar
      // campos server-owned (plan/suscripcion/contador de cargas) con valores
      // propios -- esos siempre empiezan ausentes y el codigo ya trata su
      // ausencia como el default seguro (free / 0 cargas).
      allow create: if isOwner(userId) && hasNoServerOwnedFieldsAtCreate();
      
      // Actualización NORMAL (sin tocar roles ni campos server-owned):
      // Usuario puede actualizar su perfil EXCEPTO campos de roles y los
      // campos que solo debe tocar el Admin SDK (activateUserPlan, adminUpdateUser,
      // createLoad)
      allow update: if isOwner(userId) && !isModifyingRoleFields() && !isModifyingServerOwnedFields();
```

- [ ] **Step 3: Verify by reading the file back**

Read `firestore.rules` and confirm: the `users/{userId}` block now has, in order, `allow read: ...` (unchanged), `allow create: if isOwner(userId) && hasNoServerOwnedFieldsAtCreate();`, `allow update: if isOwner(userId) && !isModifyingRoleFields() && !isModifyingServerOwnedFields();`, `allow update: if isAdminByRole() && isModifyingRoleFields();` (unchanged), `allow delete: if isOwner(userId);` (unchanged), and the two nested `match` blocks below it (`checkout_sessions`, `loads`) are untouched. Confirm the two new helper functions are present near `isModifyingRoleFields()` and are not duplicated anywhere else in the file.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "fix(users): block client writes to plan/subscription/loads-counter fields"
```

---

## Task 5: Frontend — call createLoad instead of writing directly

**Files:**
- Modify: `public/js/calculator.js`

- [ ] **Step 1: Replace the direct Firestore write with the callable function**

In `public/js/calculator.js`, find:

```js
    // Guardar en Firebase
    if (existingLoadId && typeof existingLoadId === "string") {
      await window.db.collection('loads').doc(existingLoadId).update(loadData);
      debugLog('✅ Carga actualizada con ID:', existingLoadId);
    } else {
      const doc = await window.db.collection('loads').add(loadData);
      debugLog('✅ Carga guardada con ID:', doc.id);
      // Incrementar contador mensual solo en cargas nuevas
      if (window.currentUser?.uid && typeof window.incrementMonthlyLoads === 'function') {
        window.incrementMonthlyLoads(window.currentUser.uid).catch(e =>
          debugLog('[saveLoad] Error incrementando contador:', e.message)
        );
      }
    }
```

Replace with (edits to an existing load are completely untouched — they never counted against the limit and still don't; only the new-load branch changes. The counter increment call is removed here because `createLoad` now does it atomically as part of its own transaction — leaving the old call in place would double-count every new load):

```js
    // Guardar en Firebase
    if (existingLoadId && typeof existingLoadId === "string") {
      await window.db.collection('loads').doc(existingLoadId).update(loadData);
      debugLog('✅ Carga actualizada con ID:', existingLoadId);
    } else {
      try {
        const createLoadFn = firebase.app().functions('us-central1').httpsCallable('createLoad');
        const res = await createLoadFn(loadData);
        debugLog('✅ Carga guardada con ID:', res.data.id);
      } catch (e) {
        if (e.code === 'functions/resource-exhausted') {
          if (typeof window.showUpgradeModal === 'function') {
            window.showUpgradeModal('Cargas ilimitadas');
          }
          return;
        }
        throw e;
      }
    }
```

(The `e.code === 'functions/resource-exhausted'` check exists because the client's own pre-check earlier in `saveLoad()` — unchanged by this task — can be stale, e.g. two browser tabs saving at nearly the same time. If the server rejects for the same reason the pre-check would have caught, the user sees the identical upgrade-modal UX either way rather than a raw error. Any other error `throw`s and is handled by `saveLoad()`'s existing outer `catch` block, unchanged.)

- [ ] **Step 2: Verify the edit by reading it back**

Read `public/js/calculator.js` around the edited region and confirm: the `existingLoadId` (edit) branch is byte-identical to before, the new-load branch no longer references `window.db.collection('loads').add` or `window.incrementMonthlyLoads`, and the surrounding code (the `setTimeout` dispatching `loadSaved`, the outer `catch`/`finally`) is unchanged. There is no automated test harness for this browser file — this read-back is the verification step.

- [ ] **Step 3: Commit**

```bash
git add public/js/calculator.js
git commit -m "feat(loads): call createLoad Cloud Function instead of writing loads directly"
```

---

## Task 6: Firestore rules — block direct client creation of loads

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Deny direct client creates**

In `firestore.rules`, find:

```
      allow create: if isAuthenticated() &&
                       request.resource.data.userId == request.auth.uid &&
                       hasRequiredFields() &&
                       hasValidNumbers();
```

Replace with:

```
      allow create: if false;
```

(This is the `loads` collection's create rule specifically — `allow read`, `allow update`, and `allow delete` on `loads`, a few lines below this block, are untouched. Only creation moves behind `createLoad`; editing and deleting your own existing loads works exactly as before.)

- [ ] **Step 2: Verify by reading the file back**

Read `firestore.rules` and confirm: the `loads` block now reads `allow read: ...`, `allow create: if false;`, `allow update: ...` (unchanged), `allow delete: ...` (unchanged) — in that order, and no other rule in the file was touched (e.g. the separate, unrelated `users/{userId}/loads/{loadId}` nested-collection rule elsewhere in the file must be untouched, since it's explicitly out of scope per the spec's non-goals).

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "fix(loads): deny direct client writes to loads collection, force through createLoad"
```

---

## Task 7: Final verification and commit check

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite one more time**

Run: `node functions/test-createLoad.js`
Expected: `RESULTADO: 18 pasaron, 0 fallaron`

Run: `node functions/test-admin.js`
Expected: `RESULTADO: 41 pasaron, 0 fallaron` (confirms this change didn't break the unrelated admin-panel tests — `createLoad` doesn't touch any admin function, but this is a cheap, valuable sanity check on a file both features share).

- [ ] **Step 2: Confirm all commits from Tasks 1-6 are present**

Run: `git log --oneline -8`
Expected: 6 commits from this plan (Tasks 1-6), most recent first, plus the plan/spec commits before them.

Run: `git status --short`
Expected: no pending changes from this feature.

- [ ] **Step 3: Manual smoke-test plan for after deploy (do not perform yet)**

This change touches the load-saving flow used by every real user, and both `firestore.rules` changes in this plan are easy to get subtly wrong (a typo could lock out something unrelated — `createLoad`'s own Admin SDK writes are unaffected by rules either way, but a misplaced condition could accidentally lock out `update`/`delete` on `loads`, or lock legitimate users out of their own profile). Once deployed, verify on production with a real account before considering this done:

1. As a normal (non-admin) user on a paid plan, save a new load through the calculator UI. Confirm it saves successfully and appears in history — this proves the `createLoad` path works end-to-end for the common case.
2. Edit an existing load. Confirm it still saves — this proves the untouched `update` path still works after the rules change.
3. Using the admin panel (`admin-users.html`), temporarily set a test account's plan to `free` and, via the Firestore console, set that test account's `loadsThisMonth` to `30`. Log in as that test account and try to save a new load through the calculator UI. Confirm the upgrade modal appears and no new load is created (check the `loads` collection in the Firestore console directly, not just the UI, to be sure).
4. Reset the test account's `loadsThisMonth` back down (or wait for month rollover) and confirm saving works again.
5. Delete one of your own loads through the History UI. Confirm it still works — proves the untouched `delete` rule still works.
6. Sign up a brand-new test account. Confirm it lands on the free plan with no console errors, and that the settings/account page doesn't show anything broken (e.g. "undefined" where a plan name should be) — proves Task 3's trimmed `initializeUserPlan()` write didn't break signup.
7. Log in as an existing real paying test account (professional or premium). Confirm it still shows the correct paid plan and its features are unlocked — proves Task 3's removal of the redundant client-side plan-sync write didn't break paying users (the server-side `activateUserPlan`/webhook sync is what actually keeps this correct, but this step proves it end-to-end after the client-side write is gone).
8. While logged in as any test account, open the browser console and run `firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).update({ plan: 'premium' })`. Confirm it's rejected with a `permission-denied` error — proves Task 4's rules lockdown actually blocks the exploit this whole plan exists to close. Then try `.update({ loadsThisMonth: 0 })` and confirm that's rejected too.

- [ ] **Step 4: Stop here — do not deploy**

Report completion and wait for the user to say "deploy" before running
`firebase deploy --only functions:createLoad,firestore:rules,hosting` (scoping
the functions deploy to just the new function, same reasoning as prior deploys
in this project — avoids re-triggering the unrelated, pre-existing
`stripeWebhook` secret/env-var conflict).
