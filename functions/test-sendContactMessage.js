/**
 * test-sendContactMessage.js — Test unitario aislado de sendContactMessage.
 * No requiere emulador ni producción: mockea firebase-admin, firebase-functions.
 * Ejecutar: node functions/test-sendContactMessage.js
 */

const Module = require('module');

// ─── Mock Firestore "mail" collection ────────────────────────────────────────
const STORE = { mail: {} };
let _autoIdCounter = 0;

const db = {
    collection(name) {
        return {
            add(data) {
                const id = 'auto_' + (++_autoIdCounter);
                STORE[name] = STORE[name] || {};
                STORE[name][id] = data;
                return Promise.resolve({ id });
            },
        };
    },
};

// ─── Mock firebase-admin ─────────────────────────────────────────────────────
const adminMock = {
    initializeApp() {},
    firestore: Object.assign(() => db, {}),
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

// ─── Mock stripe / express (index.js requires them at top-level) ────────────
class StripeMock {
    constructor() {
        this.subscriptions = { update: () => Promise.resolve({}), list: () => Promise.resolve({ data: [] }) };
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

process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
const fns = require('./index.js');

// ─── Utilidades de test ──────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const VALID_MSG = {
    name: 'Ricardo Galan',
    email: 'ricardo@example.com',
    subject: 'support',
    message: 'Mi calculadora no guarda las cargas.',
    lang: 'es',
};

(async () => {
    const call = (data) => fns.sendContactMessage({ auth: null, data: data || {} });

    section('sendContactMessage — validacion de email');
    try {
        await call({ ...VALID_MSG, email: 'not-an-email' });
        assert(false, 'email invalido debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'email invalido lanza invalid-argument (' + e.code + ')');
    }

    section('sendContactMessage — validacion de subject');
    try {
        await call({ ...VALID_MSG, subject: 'not-a-real-option' });
        assert(false, 'subject fuera de la lista permitida debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'subject invalido lanza invalid-argument (' + e.code + ')');
    }

    section('sendContactMessage — validacion de message vacio');
    try {
        await call({ ...VALID_MSG, message: '   ' });
        assert(false, 'message vacio debe ser rechazado');
    } catch (e) {
        assert(e.code === 'invalid-argument', 'message vacio lanza invalid-argument (' + e.code + ')');
    }

    section('sendContactMessage — envio valido');
    const r1 = await call(VALID_MSG);
    assert(r1.success === true, 'devuelve success: true');
    const mailDocs = Object.values(STORE.mail);
    assert(mailDocs.length === 1, 'escribe exactamente un documento en mail');
    const doc = mailDocs[0];
    assert(JSON.stringify(doc.to) === JSON.stringify(['support@smartloadsolution.com']), 'to es siempre support@smartloadsolution.com, ignora cualquier input del visitante (' + JSON.stringify(doc.to) + ')');
    assert(doc.message.subject === 'Nuevo mensaje de contacto: Soporte Técnico', 'el subject usa la etiqueta legible de la categoria, no la key tecnica (' + doc.message.subject + ')');
    assert(doc.message.html.includes('Ricardo Galan'), 'el html incluye el nombre del visitante');
    assert(doc.message.html.includes('ricardo@example.com'), 'el html incluye el email del visitante para poder responder');
    assert(doc.message.html.includes('Mi calculadora no guarda las cargas.'), 'el html incluye el mensaje del visitante');

    section('sendContactMessage — lang=en cambia el subject a ingles');
    const r2 = await call({ ...VALID_MSG, lang: 'en' });
    assert(r2.success === true, 'devuelve success: true con lang en');
    const mailDocs2 = Object.values(STORE.mail);
    const lastDoc = mailDocs2[mailDocs2.length - 1];
    assert(!lastDoc.message.subject.includes('Nuevo mensaje'), 'con lang en, el subject no usa el texto en espanol');

    console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
