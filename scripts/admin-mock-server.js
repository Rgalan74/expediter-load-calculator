/**
 * admin-mock-server.js — Servidor local de PRUEBA para el panel de admin.
 * ZERO daño: no toca Firebase ni Stripe. Reutiliza la lógica REAL de
 * functions/index.js (adminGetUsers, adminGetUserDetail, adminUpdateUser)
 * con firebase-admin / stripe mockeados y un store en memoria.
 *
 * Uso:
 *   1) node scripts/admin-mock-server.js
 *   2) Abrir http://localhost:5050/admin-users.html?mock=1
 *   3) Click around (listar, abrir, cambiar plan, suspender, cancelar sub)
 *
 * El store vive en memoria: los cambios duran hasta reiniciar el server.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = 5050;

// ─── Store en memoria (compartido entre requests) ────────────────────────────
const STORE = {
    users: {
        admin1: { role: 'admin', email: 'admin@smartload.com', createdAt: new Date('2025-01-01'), accountStatus: 'active' },
        u1: {
            email: 'driver1@test.com', role: 'user', plan: 'professional',
            subscriptionStatus: 'active', subscriptionId: 'sub_123',
            accountStatus: 'active', createdAt: new Date('2025-06-01'),
            stripeCustomerId: 'cus_1', lastActiveAt: new Date('2025-08-10'),
            costs: { totalCPM: 0.55 }, preferences: { minRPM: 1.5 },
        },
        u2: {
            email: 'driver2@test.com', role: 'user', plan: 'free',
            subscriptionStatus: 'none', subscriptionId: null,
            accountStatus: 'active', createdAt: new Date('2025-07-01'),
        },
        u3: {
            email: 'vip@test.com', role: 'user', plan: 'premium',
            subscriptionStatus: 'canceled_scheduled', subscriptionId: 'sub_999',
            accountStatus: 'suspended', createdAt: new Date('2025-03-01'),
            adminNotes: 'Cliente con disputa resuelta',
        },
    },
    'customers/u1/subscriptions': {
        sub_123: { id: 'sub_123', status: 'active', current_period_end: 1800000000, price: { id: 'price_pro' } },
    },
    'customers/u1/payments': {
        pay_1: { id: 'pay_1', amount: 1499, currency: 'usd', status: 'succeeded', created: 1700000000 },
        pay_2: { id: 'pay_2', amount: 1499, currency: 'usd', status: 'succeeded', created: 1702500000 },
    },
};

// ─── Mock Firestore ──────────────────────────────────────────────────────────
function getColObj(name) { return STORE[name] || (STORE[name] = {}); }
function collectionSnapshot(name) {
    const obj = getColObj(name); const entries = Object.entries(obj);
    return { empty: entries.length === 0, size: entries.length,
        forEach(cb) { entries.forEach(([id, data]) => cb({ id, data: () => data })); },
        docs: entries.map(([id, data]) => ({ id, data: () => data })) };
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
        collection(sub) { return makeCol(`${colName}/${id}/${sub}`); },
    };
}
function makeCol(name, filter) {
    const query = {
        orderBy() { return query; }, limit() { return query; },
        where(field, op, value) { return makeCol(name, { field, op, value }); },
        count() { return { get: async () => { const snap = collectionSnapshot(name); let docs = snap.docs; if (filter) docs = docs.filter(d => d.data()[filter.field] === filter.value); return { data: () => ({ count: docs.length }) }; } }; },
        get: async () => { const snap = collectionSnapshot(name); if (filter) { const f = snap.docs.filter(d => d.data()[filter.field] === filter.value); return { empty: f.length === 0, size: f.length, forEach(cb) { f.forEach(d => cb(d)); }, docs: f }; } return snap; },
        doc(id) { return makeDoc(name, id); },
    };
    return query;
}
const db = { collection(name) { return makeCol(name); } };

// ─── Mock firebase-admin / functions / stripe / express ──────────────────────
const firestoreInstance = Object.assign(() => db, {
    Timestamp: { fromDate: (d) => ({ _seconds: Math.floor(d.getTime() / 1000) }) },
    FieldValue: { serverTimestamp: () => ({ __serverTS: true }) },
});
const adminMock = { initializeApp() {}, firestore: firestoreInstance, apps: [{}] };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fnV2 = { HttpsError, onCall: (opts, h) => async (req) => h(req), onRequest: () => ({}), onSchedule: () => ({}), setGlobalOptions() {} };
const loggerMock = { info() {}, warn() {}, error() {}, debug() {} };
class StripeMock { constructor() { this.subscriptions = { update: (id, obj) => Promise.resolve({ id, status: 'canceled', ...obj }), list: () => Promise.resolve({ data: [] }) }; } }
const expressMockFn = Object.assign(() => ({ use() {}, post() {}, get() {} }), { raw: () => ({}), json: () => ({}), urlencoded: () => ({}) });
function expressMock() { return expressMockFn; }

const origLoad = Module._load;
Module._load = function (request) {
    if (request === 'firebase-admin') return adminMock;
    if (request === 'firebase-functions/logger') return loggerMock;
    if (request.startsWith('firebase-functions')) return fnV2;
    if (request === 'stripe') return StripeMock;
    if (request === 'express') return expressMockFn;
    return origLoad.apply(this, arguments);
};

// Stripe key debe existir ANTES de require(index.js) (lo captura en const al cargar)
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_for_local_harness';
const fns = require(path.join(ROOT, 'functions', 'index.js'));
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function serveStatic(req, res) {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const filePath = path.normalize(path.join(PUBLIC, urlPath));
    if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found: ' + urlPath); }
        res.writeHead(200, { 'Content-Type': CT[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}

// ─── Mock callable endpoint ──────────────────────────────────────────────────
function handleMock(req, res) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
        const fnName = req.url.split('/').pop();
        const payload = body ? JSON.parse(body) : {};
        const ctx = { auth: { uid: 'admin1' }, data: payload.data || {} };
        try {
            const result = await fns[fnName](ctx);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: result }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: e.code || 'internal', message: e.message } }));
        }
    });
}

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/__mock/')) return handleMock(req, res);
    return serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log(`\n🧪 Admin mock server corriendo en http://localhost:${PORT}/admin-users.html?mock=1`);
    console.log('   (store en memoria — reinicia el server para resetear datos)\n');
});
