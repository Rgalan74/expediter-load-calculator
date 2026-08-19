/**
 * test-admin.js — Test unitario aislado de las 3 Cloud Functions nuevas
 * (adminGetUsers, adminGetUserDetail, adminUpdateUser).
 * No requiere emulador ni producción: mockea firebase-admin, firebase-functions y stripe.
 * Ejecutar: node test-admin.js
 */

const Module = require('module');
const path = require('path');

// ─── Mock Firestore store ────────────────────────────────────────────────────
const STORE = {
    users: {
        admin1: { role: 'admin', email: 'admin@smartload.com', createdAt: new Date('2025-01-01') },
        u1: {
            email: 'driver1@test.com', role: 'user', plan: 'professional',
            subscriptionStatus: 'active', subscriptionId: 'sub_123',
            accountStatus: 'active', createdAt: new Date('2025-06-01'),
            stripeCustomerId: 'cus_1',
            fullName: 'Carlos Rodriguez', phone: '+1-813-555-0142',
            vehicle: { type: 'Cargo Van', mpg: 18, fuelPrice: 3.5 },
        },
        u2: {
            email: 'driver2@test.com', role: 'user', plan: 'free',
            subscriptionStatus: 'none', subscriptionId: null,
            accountStatus: 'active', createdAt: new Date('2025-07-01'),
        },
    },
    loads: {
        load1: { userId: 'u1', date: new Date('2025-08-01'), origin: 'Detroit, MI', destination: 'Atlanta, GA', totalCharge: 1500, rpm: 1.6 },
        load2: { userId: 'u1', date: new Date('2025-08-05'), origin: 'Atlanta, GA', destination: 'Miami, FL', rate: 1200, rpm: 1.4 },
        load3: { userId: 'u1', date: new Date('2025-07-20'), origin: 'Chicago, IL', destination: 'Detroit, MI', totalCost: 900, rpm: 1.3 },
    },
    academyProgress: {
        u1: { modules: { 1: { completed: [1, 2, 3, 4, 5] }, 2: { completed: [1, 2, 3] }, 3: { completed: [] }, 6: { completed: [1, 1, 2, 3, 4] } } },
    },
    'customers/u1/subscriptions': {
        sub_123: { id: 'sub_123', status: 'active', current_period_end: 1800000000 },
    },
    'customers/u1/payments': {
        pay_1: { id: 'pay_1', amount: 1499, currency: 'usd', status: 'succeeded', created: 1700000000 },
    },
};

function getColObj(name) {
    return STORE[name] || (STORE[name] = {});
}

// Construye un snapshot de colección (para forEach)
function collectionSnapshot(name) {
    const obj = getColObj(name);
    const entries = Object.entries(obj);
    return {
        empty: entries.length === 0,
        size: entries.length,
        forEach(cb) { entries.forEach(([id, data]) => cb({ id, data: () => data })); },
        docs: entries.map(([id, data]) => ({ id, data: () => data })),
    };
}

function docSnapshot(pathParts) {
    // pathParts: ['users','u1'] o ['customers','cus_1','subscriptions','sub_123']
    let node = STORE;
    for (const p of pathParts) {
        if (node[p] == null) return { exists: false, data: () => undefined };
        node = node[p];
    }
    return { exists: true, data: () => node, id: pathParts[pathParts.length - 1] };
}

function makeDoc(colName, id) {
    return {
        id,
        get() {
            const sub = STORE[colName] && STORE[colName][id];
            return Promise.resolve(sub ? { exists: true, data: () => sub, id } : { exists: false, data: () => undefined, id });
        },
        set(obj) { STORE[colName] = STORE[colName] || {}; STORE[colName][id] = Object.assign(STORE[colName][id] || {}, obj); return Promise.resolve(); },
        update(obj) { STORE[colName] = STORE[colName] || {}; STORE[colName][id] = Object.assign(STORE[colName][id] || {}, obj); return Promise.resolve(); },
        collection(sub) {
            const subName = `${colName}/${id}/${sub}`;
            return makeCol(subName);
        },
    };
}

function makeCol(name, filter) {
    const query = {
        orderBy() { return query; },
        limit() { return query; },
        where(field, op, value) { return makeCol(name, { field, op, value }); },
        count() { return { get: async () => {
            const snap = collectionSnapshot(name);
            let docs = snap.docs;
            if (filter) docs = docs.filter(d => d.data()[filter.field] === filter.value);
            return { data: () => ({ count: docs.length }) };
        } }; },
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
        doc(id) { return makeDoc(name, id); },
    };
    return query;
}

const db = {
    collection(name) { return makeCol(name); },
    // acceso raw usado por tests para sembrar
    _seed: STORE,
};

// ─── Mock firebase-admin ─────────────────────────────────────────────────────
const firestoreInstance = Object.assign(
    () => db,
    {
        Timestamp: { fromDate: (d) => ({ _seconds: Math.floor(d.getTime() / 1000) }) },
        FieldValue: { serverTimestamp: () => ({ __serverTS: true }) },
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
const handlers = {};
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
    const call = (fn, ctx, data) => fn({ auth: ctx.auth, data: data || {} });
    const adminCtx = { auth: { uid: 'admin1' } };
    const userCtx = { auth: { uid: 'u1' } };

    section('adminGetUsers — guard de rol');
    try {
        await fns.adminGetUsers(userCtx);
        assert(false, 'usuario no-admin debe ser rechazado');
    } catch (e) {
        assert(e.code === 'permission-denied', 'no-admin lanza permission-denied (' + e.code + ')');
    }

    section('adminGetUsers — listado (admin)');
    const listRes = await fns.adminGetUsers(adminCtx);
    assert(listRes.count === 3, 'lista 3 usuarios (count=' + listRes.count + ')');
    const u1 = listRes.users.find(u => u.uid === 'u1');
    assert(u1 && u1.plan === 'professional', 'u1 tiene plan professional');
    assert(u1.subscriptionStatus === 'active', 'u1 subscriptionStatus active');

    section('adminGetUserDetail — detalle completo');
    const det = await call(fns.adminGetUserDetail, adminCtx, { targetUid: 'u1' });
    const d = det;
    assert(d.profile.email === 'driver1@test.com', 'email correcto');
    assert(d.profile.fullName === 'Carlos Rodriguez', 'fullName presente');
    assert(d.profile.phone === '+1-813-555-0142', 'phone presente');
    assert(d.profile.vehicle?.type === 'Cargo Van', 'vehicle presente');
    assert(d.stats.loadsCount === 3, 'loadsCount 3 (con cargas sembradas)');
    assert(d.stats.loadsTotal === 3600, 'loadsTotal suma pay con fallback totalCharge/rate/totalCost (1500+1200+900)');
    assert(Math.abs(d.stats.loadsAvgRpm - 1.4333333333333333) < 0.0001, 'loadsAvgRpm promedio correcto');
    assert(d.stats.recentLoads.length === 3, 'recentLoads trae las 3 cargas sembradas');
    assert(d.stats.recentLoads[0].origin === 'Atlanta, GA', 'recentLoads ordenado por fecha desc (load2 es la mas reciente)');
    assert(d.stats.academyModulesCompleted === 1, 'academyModulesCompleted cuenta solo modulos 100% completos (modulo 1 con 5/5, no el 2 con 3/6, no el 6 con [1,1,2,3,4] que tiene length 5 pero solo 4 IDs unicos)');
    assert(d.stats.academyModulesTotal === 8, 'academyModulesTotal es 8');
    assert(d.billing.stripeCustomerId === 'cus_1', 'stripeCustomerId resuelto');
    assert(d.billing.subscriptions.length === 1, '1 suscripción en Firestore');
    assert(d.billing.payments.length === 1, '1 pago en Firestore');

    section('adminUpdateUser — setPlan');
    const sp = await call(fns.adminUpdateUser, adminCtx, { targetUid: 'u1', operation: 'setPlan', plan: 'premium', reason: 'upgrade manual' });
    assert(sp.success && sp.plan === 'premium', 'plan cambiado a premium');
    const after = await call(fns.adminGetUserDetail, adminCtx, { targetUid: 'u1' });
    assert(after.profile.plan === 'premium', 'persistió en Firestore');

    section('adminUpdateUser — setAccountStatus (suspender)');
    const ss = await call(fns.adminUpdateUser, adminCtx, { targetUid: 'u1', operation: 'setAccountStatus', status: 'suspended' });
    assert(ss.status === 'suspended', 'estado suspendido');
    const after2 = await call(fns.adminGetUserDetail, adminCtx, { targetUid: 'u1' });
    assert(after2.profile.accountStatus === 'suspended', 'suspensión persistió');

    section('adminUpdateUser — saveNotes');
    const sn = await call(fns.adminUpdateUser, adminCtx, { targetUid: 'u1', operation: 'saveNotes', notes: 'Cliente VIP' });
    assert(sn.success, 'notas guardadas');

    section('adminUpdateUser — cancelSubscription');
    const cs = await call(fns.adminUpdateUser, adminCtx, { targetUid: 'u1', operation: 'cancelSubscription', atPeriodEnd: true });
    assert(cs.success && cs.stripeStatus === 'canceled', 'suscripción cancelada en Stripe (status=' + cs.stripeStatus + ')');
    const after3 = await call(fns.adminGetUserDetail, adminCtx, { targetUid: 'u1' });
    assert(after3.profile.subscriptionStatus === 'canceled_scheduled', 'subscriptionStatus actualizado a canceled_scheduled');

    section('adminUpdateUser — validaciones');
    try {
        await call(fns.adminUpdateUser, adminCtx, { targetUid: 'u1', operation: 'setPlan', plan: 'invalido' });
        assert(false, 'plan inválido debe rechazarse');
    } catch (e) { assert(e.code === 'invalid-argument', 'plan inválido → invalid-argument'); }
    try {
        await call(fns.adminUpdateUser, adminCtx, { targetUid: 'noexiste', operation: 'setPlan', plan: 'free' });
        assert(false, 'uid inexistente debe rechazarse');
    } catch (e) { assert(e.code === 'not-found', 'uid inexistente → not-found'); }
    try {
        await call(fns.adminGetUserDetail, adminCtx, { targetUid: '' });
        assert(false, 'targetUid vacío debe rechazarse');
    } catch (e) { assert(e.code === 'invalid-argument', 'targetUid vacío → invalid-argument'); }

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
