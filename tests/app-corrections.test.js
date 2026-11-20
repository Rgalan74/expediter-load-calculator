// Synthetic regression tests. Real app scripts; no SDK, network or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function fixture() {
  const elements = new Map(), writes = [], messages = [];
  const el = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', innerHTML: '', style: {}, checked: false,
      classList: { add() {}, remove() {} }, addEventListener() {},
      setAttribute() {}, setCustomValidity(v) { this.validityMessage = v; },
      reportValidity() {}, focus() {}, querySelectorAll: () => [], appendChild() {}
    });
    return elements.get(id);
  };
  const db = { collection(name) { return { doc() { return {
    set: async data => writes.push({ name, data }),
    update: async data => writes.push({ name, data })
  }; } }; } };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => '<synthetic-timestamp>' };
  const w = {
    document: { getElementById: id => elements.get(id) || null,
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      dispatchEvent() {}, createElement: () => el('created'), body: { style: {} } },
    console: { log() {}, warn() {}, error() {} }, debugLog() {},
    Event: class {}, CustomEvent: class {}, setTimeout: () => 0, clearTimeout() {},
    setInterval: () => 0, clearInterval() {}, addEventListener() {},
    navigator: { onLine: true }, localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    LoadingManager: { show() {}, hide() {} },
    showToast: (...args) => messages.push(args), showMessage: (...args) => messages.push(args),
    sanitizeText: v => String(v), sanitizeNumber: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    formatDateLocal: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    getTodayDateString: () => '2032-05-01',
    firebase: { firestore, app: () => ({ functions: () => ({ httpsCallable: () => async data => {
      writes.push({ name: 'loads', data }); return { data: { id: 'synthetic-load' } };
    } }) }) }, db,
    currentUser: { uid: 'synthetic-user', costs: { combustible: .2, mantenimiento: .05,
      comida: 0, costosFijos: .2, totalCPM: .45, isDefault: false } }
  };
  w.window = w; w.self = w;
  const ctx = vm.createContext(w);
  for (const name of ['settings.js', 'calculator.js'])
    vm.runInContext(fs.readFileSync(path.join(root, 'public/js', name), 'utf8'), ctx, { filename: name });
  w.__realShowDecisionPanel = w.showDecisionPanel;
  w.showConfigMessage = (...args) => messages.push(args);
  w.updateMainResults = data => { w.visible = data; };
  w.showDecisionPanel = data => { w.decision = data; };
  w.updateMap = () => {};
  for (const [id, value] of Object.entries({ origin: 'Miami FL', destination: 'Austin TX',
    loadedMiles: 450, deadheadMiles: 50, rate: 700, rpm: 1.4, tolls: 10, otherCosts: 25,
    dateInput: '2032-05-01', fuelMPG: 20, fuelPricePerGallon: 4, vehiclePayment: 600,
    insurance: 600, licenses: 0, otherFixed: 0, monthlyMilesGoal: 6000,
    maintenancePerMile: .02, tiresPerMile: .01, repairsPerMile: .02 })) el(id).value = String(value);
  function stops(rows) {
    el('stopsContainer').querySelectorAll = () => rows.map((r, i) => ({ id: `stop-${i}` }));
    rows.forEach((r, i) => {
      el(`stop-${i}-dest`).value = r.destination;
      el(`stop-${i}-miles`).value = String(r.miles);
      el(`stop-${i}-rpm`).value = String(r.rpm);
    });
  }
  return { w, el, writes, messages, stops };
}

test('settings UI consistently declares per-mile decimal costs', () => {
  const html = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
  for (const id of ['maintenancePerMile', 'tiresPerMile', 'repairsPerMile']) {
    const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0];
    assert.match(input, /step="0\.0001"/);
    assert.ok(Number(input.match(/value="([^"]*)"/)[1]) < 1);
    const label = html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`))[1];
    assert.match(label, /\/mi/);
  }
  for (const lang of ['en', 'es']) {
    const json = JSON.parse(fs.readFileSync(path.join(root, `public/js/i18n/${lang}.json`), 'utf8'));
    assert.match(json.settings.label_maintenance, /\/mi/);
  }
});

test('settings preserves decimal/zero values and blocks ambiguous historical amounts', async () => {
  const f = fixture();
  await f.w.saveUserConfiguration();
  assert.equal(f.writes[0].data.costs.totalCPM, .45);
  f.el('maintenancePerMile').value = '0';
  await f.w.saveUserConfiguration();
  assert.equal(f.writes[1].data.maintenancePerMile, 0);
  for (const value of ['120', '-0.1', 'invalid', '']) {
    const n = f.writes.length;
    f.el('maintenancePerMile').value = value;
    await f.w.saveUserConfiguration();
    assert.equal(f.writes.length, n, 'ambiguous values must not be saved');
  }
  f.w.applyConfigurationToForm({ maintenancePerMile: 120, tiresPerMile: .01, repairsPerMile: .02 });
  assert.equal(f.el('maintenancePerMile').value, 120, 'historical value not converted');
  assert.ok(f.messages.some(m => /USD\/mi/.test(m[0])));
});

for (const mode of ['rate', 'rpm']) for (const count of [0, 1, 2]) {
  test(`calculate/save agree: ${mode}, ${count} additional stops`, async () => {
    const f = fixture();
    if (mode === 'rpm') { f.el('rate').value = '0'; f.el('rpm').value = '1.333'; }
    const rows = [{ destination: 'Dallas TX', miles: 100, rpm: 2 },
      { destination: 'Houston TX', miles: 150, rpm: 1.5 }].slice(0, count);
    f.stops(rows);
    await f.w.calculate(); await f.w.saveLoad();
    assert.ok(f.w.visible, 'calculation completed');
    const saved = f.writes.find(r => r.name === 'loads')?.data;
    assert.ok(saved, 'save completed');
    const miles = 500 + rows.reduce((s, r) => s + r.miles, 0);
    const base = (mode === 'rate' ? 700 : Math.round(1.333 * 500)) + rows.reduce((s, r) => s + r.miles * r.rpm, 0);
    assert.equal(saved.totalMiles, miles);
    assert.equal(saved.loadedMiles + saved.deadheadMiles, miles);
    assert.equal(f.w.visible.totalMiles, miles);
    assert.equal(saved.totalCharge, base + 25);
    for (const key of ['baseIncome', 'totalCharge', 'totalExpenses', 'netProfit', 'profitPerMile'])
      assert.equal(saved[key], f.w.visible[key], key);
    assert.equal(saved.rpm, f.w.visible.actualRPM);
  });
}

// Payment term approved by Ricardo 2026-11-15: load date + 15 calendar days.
test('payment calendar: +15 days, weekends, year boundary, leap year and DST', async () => {
  const cases = [['2032-05-03','2032-05-18'], ['2032-05-04','2032-05-19'],
    ['2032-05-05','2032-05-20'], ['2032-05-06','2032-05-21'],
    ['2032-05-07','2032-05-22'], ['2032-05-08','2032-05-23'],
    ['2032-05-09','2032-05-24'], ['2032-12-31','2033-01-15'],
    ['2032-02-20','2032-03-06'],
    ['2026-03-07','2026-03-22'], ['2026-10-31','2026-11-15']];
  for (const [date, expected] of cases) {
    const f = fixture(); f.el('dateInput').value = date;
    await f.w.saveLoad();
    assert.equal(f.writes.find(r => r.name === 'loads')?.data.expectedPaymentDate, expected, date);
  }
});

if (!process.env.SLS_CALENDAR_CHILD) test('payment calendar in US time zones', () => {
  for (const TZ of ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Pacific/Honolulu']) {
    const env = { ...process.env, TZ, SLS_CALENDAR_CHILD: '1' };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--test', '--test-name-pattern=^payment calendar:', __filename],
      { encoding: 'utf8', env });
    assert.equal(r.status, 0, `${TZ}\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /(?:#|ℹ) pass 1\b/, 'calendar cases actually executed');
  }
});

test('finances legacy loads without payment fields use the same +15 day term', () => {
  const w = { console, debugFinances() {}, formatDateLocal: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/finances-data.js'), 'utf8'), vm.createContext(w), { filename: 'finances-data.js' });
  const [a, b, c] = w.ensurePaymentFields([{ date: '2032-05-08' }, { date: 'not-a-date' },
    { date: '2032-05-08', paymentStatus: 'paid', expectedPaymentDate: '2032-05-14' }]);
  assert.equal(a.expectedPaymentDate, '2032-05-23');
  assert.equal(a.paymentStatus, 'pending');
  assert.equal(b.expectedPaymentDate, null, 'invalid date must not break Finances');
  assert.equal(c.expectedPaymentDate, '2032-05-14', 'existing records untouched');
});

// Real CPM from Finanzas must not include tolls: the calculator already adds
// each load's tolls, so tolls inside the CPM would be counted twice.
test('real CPM excludes registered tolls (no double count with load tolls)', async () => {
  const months = ['2032-01', '2032-02', '2032-03', '2032-04'];
  const loads = months.map(m => ({ date: `${m}-10`, totalMiles: 2000, userId: 'u' }));
  const expenses = months.flatMap(m => [
    { date: `${m}-12`, category: 'fuel', amount: 400 },
    { date: `${m}-12`, category: 'insurance', amount: 600 },
    { date: `${m}-15`, category: 'tolls', amount: 300 }
  ]);
  const snap = rows => ({ forEach: fn => rows.forEach(r => fn({ data: () => r })) });
  const query = rows => { const q = { where: () => q, get: async () => snap(rows) }; return q; };
  const w = {
    console, debugLog() {}, document: { addEventListener() {} },
    firebase: { firestore: () => ({ collection: n => query(n === 'loads' ? loads : expenses) }) },
    CustomCategories: { getAllCategories: async () => [{ id: 'tolls', isOperational: true }] }
  };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/cpm-engine.js'), 'utf8'), vm.createContext(w), { filename: 'cpm-engine.js' });
  const r = await w.CPMEngine._fromRealData('u', 4, 4);
  assert.equal(r.source, 'real');
  assert.equal(r.cpm, 0.5, '(fuel 1600 + insurance 2400) / 8000 mi; tolls 1200 excluded');
});

// D5 (approved 2026-11-14): historical average RPM is only a commercial
// reference; it must not raise the ACCEPT threshold of the live panel.
test('decision panel thresholds ignore historical average RPM (D5)', () => {
  const f = fixture();
  const w = f.w;
  const panel = f.el('decisionPanel');
  const orig = f.w.document.getElementById;
  w.document.getElementById = id => orig(id) || f.el(id);
  const run = avg => {
    w._userAvgRPM = avg; w._userCPM = 0.5;
    w.__realShowDecisionPanel({ totalCharge: 700, netProfit: 450, totalMiles: 500,
      actualRPM: 1.4, profitMargin: 64, profitPerMile: 0.9, origin: 'Miami FL', destination: 'Austin TX',
      originState: 'FL', destinationState: 'TX' });
    return w._lastDecisionData;
  };
  const sinHistorial = run(0), conHistorialAlto = run(5);
  assert.ok(panel);
  assert.equal(conHistorialAlto.thresholds.acceptThreshold, sinHistorial.thresholds.acceptThreshold);
  assert.equal(conHistorialAlto.thresholds.midThreshold, sinHistorial.thresholds.midThreshold);
  assert.equal(conHistorialAlto.decision, sinHistorial.decision);
});

// Minimum RPM from Configuración (approved 2026-11-13) is a floor for ACCEPT.
test('decision panel uses configured minimum RPM as floor for ACCEPT', () => {
  const f = fixture();
  const w = f.w;
  const orig = w.document.getElementById;
  w.document.getElementById = id => orig(id) || f.el(id);
  const run = minRPM => {
    w._userAvgRPM = 0; w._userCPM = 0.5;
    w.currentUser.profileData = { targetProfit: 20, targetRPM: minRPM };
    w.__realShowDecisionPanel({ totalCharge: 700, netProfit: 450, totalMiles: 500,
      actualRPM: 1.4, profitMargin: 64, profitPerMile: 0.9, origin: 'Miami FL', destination: 'Austin TX',
      originState: 'FL', destinationState: 'TX' });
    return w._lastDecisionData;
  };
  const bajo = run(0.85), alto = run(2);
  assert.ok(bajo.thresholds.acceptThreshold < 1.4);
  assert.equal(alto.thresholds.acceptThreshold, 2);
  assert.notEqual(alto.decision, 'ACCEPT', 'RPM 1.40 below a 2.00 minimum cannot be ACCEPT');
});

test('settings cost info text is translated and no longer says Finances never applies', () => {
  const html = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
  assert.doesNotMatch(html, /does <em>not<\/em> override these costs/);
  for (const lang of ['en', 'es']) {
    const s = JSON.parse(fs.readFileSync(path.join(root, `public/js/i18n/${lang}.json`), 'utf8')).settings;
    for (const k of ['cost_info_title', 'cost_info_config', 'cost_info_real']) assert.ok(s[k], `${lang}.${k}`);
    assert.match(html, new RegExp(`data-i18n="settings.${'cost_info_real'}"`));
  }
});

// Finanzas: the "Margen" KPI card must show net profit / revenue. Several
// functions (duplicated in finances.js and finances-ui.js; the later script
// wins) write the KPIs, so the card must use the id they write the margin to.
// This runs the three real scripts in the page's load order.
test('finances margin card shows profit margin with the real script load order', () => {
  const html = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
  const card = html.match(/<div[^>]*id="marginKpiCard"[\s\S]*?<\/div>/)[0];
  const cardId = card.match(/class="fin-kpi-value" id="([^"]+)"/)[1];
  const els = new Map();
  const el = id => {
    if (!els.has(id)) els.set(id, { id, textContent: '', style: {}, value: '',
      classList: { add() {}, remove() {}, contains: () => false }, addEventListener() {},
      querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {} });
    return els.get(id);
  };
  for (const m of html.matchAll(/id="([^"]+)"/g)) el(m[1]);
  const byId = id => els.get(id) || null;
  const w = {
    console: { log() {}, warn() {}, error() {}, debug() {} }, debugLog() {}, debugFinances() {},
    document: {
      getElementById: byId, readyState: 'complete', addEventListener() {}, removeEventListener() {},
      querySelector: sel => { const m = String(sel).match(/#([\w-]+)$|data-kpi="([\w-]+)"/); return m ? byId(m[1] || m[2]) : null; },
      querySelectorAll: () => [], createElement: () => el('created-' + els.size), body: { appendChild() {} }
    },
    addEventListener() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
    navigator: {}, location: { hash: '' }, i18n: { t: () => '' },
    formatCurrency: v => `$${Number(v).toFixed(2)}`, firebase: { firestore: () => ({}) }
  };
  w.window = w; w.self = w;
  const ctx = vm.createContext(w);
  const order = [...html.matchAll(/<script src="js\/(finances[\w-]*\.js)/g)].map(m => m[1])
    .filter(f => ['finances-core.js', 'finances-data.js', 'finances.js', 'finances-ui.js'].includes(f));
  assert.deepEqual(order, ['finances-core.js', 'finances-data.js', 'finances.js', 'finances-ui.js']);
  for (const f of order) vm.runInContext(fs.readFileSync(path.join(root, 'public/js', f), 'utf8'), ctx, { filename: f });
  vm.runInContext('financesData = [{ totalCharge: 1000, totalMiles: 1000, loadedMiles: 900 }]; expensesData = [{ amount: 750 }];', ctx);
  w.updateFinancialKPIs();
  if (typeof w.updateBusinessMetrics === 'function') w.updateBusinessMetrics();
  assert.equal(byId(cardId).textContent, '25.0%', `card #${cardId} must show (1000-750)/1000`);
});
