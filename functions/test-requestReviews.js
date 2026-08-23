/**
 * test-requestReviews.js — Test unitario aislado de requestReviews.
 * No requiere emulador ni producción: mockea firebase-admin, firebase-functions.
 * Ejecutar: node functions/test-requestReviews.js
 */

const Module = require('module');

// ─── Mock Firestore ──────────────────────────────────────────────────────────
const STORE = { users: {}, loads: {}, mail: {} };
let _autoIdCounter = 0;

function makeUserDoc(uid) {
    const update = (obj) => { STORE.users[uid] = Object.assign({}, STORE.users[uid], obj); return Promise.resolve(); };
    return {
        id: uid,
        ref: { id: uid, update },
        data() { return STORE.users[uid]; },
        update,
    };
}

const db = {
    collection(name) {
        if (name === 'users') {
            return {
                get() {
                    const docs = Object.keys(STORE.users).map(makeUserDoc);
                    return Promise.resolve({ empty: docs.length === 0, docs, forEach(cb) { docs.forEach(cb); } });
                },
            };
        }
        if (name === 'loads') {
            return {
                where(field, op, value) {
                    return {
                        count() {
                            return {
                                get() {
                                    const matching = Object.values(STORE.loads).filter(l => l[field] === value);
                                    return Promise.resolve({ data: () => ({ count: matching.length }) });
                                },
                            };
                        },
                    };
                },
            };
        }
        if (name === 'mail') {
            return {
                add(data) {
                    const id = 'auto_' + (++_autoIdCounter);
                    STORE.mail[id] = data;
                    return Promise.resolve({ id });
                },
            };
        }
        throw new Error('Unexpected collection in test: ' + name);
    },
};

const adminMock = {
    initializeApp() {},
    firestore: Object.assign(() => db, {
        Timestamp: { fromDate: (d) => ({ _seconds: Math.floor(d.getTime() / 1000) }) },
    }),
    apps: [{}],
};

// ─── Mock firebase-functions ───────────────────────────────────────────────
class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; this.details = message; }
}
const fnV2 = {
    HttpsError,
    onCall(opts, handler) { return async (request) => handler(request); },
    onRequest(opts, handler) { return { __onRequest: true }; },
    onSchedule(opts, handler) { return { __onSchedule: true, __run: handler }; },
    setGlobalOptions() {},
};
const loggerMock = { info() {}, warn() {}, error() {}, debug() {} };
class StripeMock {
    constructor() { this.subscriptions = { update: () => Promise.resolve({}), list: () => Promise.resolve({ data: [] }) }; }
}

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

process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
const fns = require('./index.js');

// ─── Utilidades de test ──────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const now = new Date();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

(async () => {
    // Fixtures
    STORE.users = {
        qualifies: { email: 'qualifies@example.com', createdAt: daysAgo(30), preferredLanguage: 'es' },
        too_new: { email: 'too_new@example.com', createdAt: daysAgo(2), preferredLanguage: 'es' },
        not_enough_loads: { email: 'not_enough_loads@example.com', createdAt: daysAgo(30), preferredLanguage: 'es' },
        already_asked: { email: 'already_asked@example.com', createdAt: daysAgo(30), reviewRequestSent: true, preferredLanguage: 'es' },
    };
    for (let i = 0; i < 12; i++) STORE.loads['qualifies_' + i] = { userId: 'qualifies' };
    for (let i = 0; i < 12; i++) STORE.loads['already_asked_' + i] = { userId: 'already_asked' };
    for (let i = 0; i < 12; i++) STORE.loads['too_new_' + i] = { userId: 'too_new' };
    for (let i = 0; i < 3; i++) STORE.loads['not_enough_' + i] = { userId: 'not_enough_loads' };

    section('requestReviews — corre el scheduler');
    await fns.requestReviews.__run();

    section('requestReviews — resultados');
    assert(Object.keys(STORE.mail).length === 1, 'manda exactamente 1 email (solo "qualifies" califica) (' + Object.keys(STORE.mail).length + ')');
    const sentMail = Object.values(STORE.mail)[0];
    assert(JSON.stringify(sentMail.to) === JSON.stringify(['qualifies@example.com']), 'el email va al usuario que califica');
    assert(STORE.users.qualifies.reviewRequestSent === true, 'marca reviewRequestSent en el usuario que califica');
    assert(!STORE.users.too_new.reviewRequestSent, 'NO marca a un usuario con cuenta de menos de 7 dias');
    assert(!STORE.users.not_enough_loads.reviewRequestSent, 'NO marca a un usuario con menos de 10 cargas');
    assert(STORE.users.already_asked.reviewRequestSent === true, 'un usuario ya pedido sigue marcado (no se le vuelve a mandar)');

    section('requestReviews — no manda dos veces si corre otra vez');
    await fns.requestReviews.__run();
    assert(Object.keys(STORE.mail).length === 1, 'correr el scheduler de nuevo no manda un segundo email al mismo usuario');

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
