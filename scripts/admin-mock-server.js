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

function _monthsAgo(n, day = 15) {
    const now = new Date();
    return Math.floor(new Date(now.getFullYear(), now.getMonth() - n, day).getTime() / 1000);
}

// ─── Store en memoria (compartido entre requests) ────────────────────────────
const STORE = {
    users: {
        admin1: { role: 'admin', email: 'admin@smartload.com', createdAt: new Date('2025-01-01'), accountStatus: 'active' },
        u1: {
            email: 'driver1@test.com', role: 'user', plan: 'professional',
            subscriptionStatus: 'active', subscriptionId: 'sub_123',
            accountStatus: 'active', createdAt: new Date('2025-06-01'),
            stripeCustomerId: 'cus_1', lastActiveAt: new Date('2025-08-10'),
            fullName: 'Carlos Rodriguez', phone: '+1-813-555-0142',
            vehicle: { type: 'Cargo Van', mpg: 18, fuelPrice: 3.5 },
            costs: {
                totalCPM: 0.55, fuelCost: 0.19, maintenanceCost: 0.12, insuranceCost: 0.08,
                depreciationCost: 0.10, otherCost: 0.06, totalFixedMonthly: 1380,
            },
            preferences: { minRPM: 1.5, targetRPM: 1.6, maxDeadhead: 100 },
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
    loads: {
        load1: { userId: 'u1', date: new Date('2025-08-01'), origin: 'Detroit, MI', destination: 'Atlanta, GA', totalCharge: 1500, rpm: 1.6 },
        load2: { userId: 'u1', date: new Date('2025-08-05'), origin: 'Atlanta, GA', destination: 'Miami, FL', rate: 1200, rpm: 1.4 },
        load3: { userId: 'u1', date: new Date('2025-07-20'), origin: 'Chicago, IL', destination: 'Detroit, MI', totalCost: 900, rpm: 1.3 },
    },
    academyProgress: {
        u1: { modules: { 1: { completed: [1, 2, 3, 4, 5] }, 2: { completed: [1, 2, 3] }, 3: { completed: [] } } },
    },
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
