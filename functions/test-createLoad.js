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

    section('createLoad — payload sin userId (asi lo mandan calculator.js y sync-manager.js)');
    const { userId: _omitUserId, ...VALID_LOAD_NO_USERID } = VALID_LOAD;
    const r1b = await call('free_under', VALID_LOAD_NO_USERID);
    assert(typeof r1b.id === 'string' && r1b.id.length > 0, 'guarda sin problema aunque el payload no traiga userId');
    assert(STORE.loads[r1b.id].userId === 'free_under', 'el servidor igual asigna userId aunque el payload no lo tenga');

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
