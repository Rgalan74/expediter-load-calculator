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

// Guard (2026-11-23): saving before the form has the user's data would
// overwrite their costs with empty fields.
test('settings does not save before the user configuration is loaded', async () => {
  const f = fixture();
  f.w._settingsFormLoaded = false;
  f.w._settingsLoading = true; // ya cargando: no relanza la lectura
  await f.w.saveUserConfiguration();
  assert.equal(f.writes.length, 0, 'nothing saved while loading');
  assert.ok(f.messages.length > 0, 'user is told to wait');
});

test('settings: empty minimum RPM means no floor, empty margin means 20%', async () => {
  const f = fixture();
  f.w._settingsFormLoaded = true;
  f.el('targetRPM').value = '';
  f.el('targetProfit').value = '';
  await f.w.saveUserConfiguration();
  assert.equal(f.writes[0].data.targetRPM, 0, 'not the old silent $1.25');
  assert.equal(f.writes[0].data.targetProfit, 20, 'same default as the calculator');
});

test('settings preserves decimal/zero values and blocks ambiguous historical amounts', async () => {
  const f = fixture();
  f.w._settingsFormLoaded = true;
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

// Decision 2026-11-23: food is a personal expense (stays in Finanzas only);
// lodging is a trip cost and stays in the per-mile cost.
test('real CPM excludes food but keeps lodging', async () => {
  const months = ['2032-01', '2032-02', '2032-03', '2032-04'];
  const loads = months.map(m => ({ date: `${m}-10`, totalMiles: 2000, userId: 'u' }));
  const expenses = months.flatMap(m => [
    { date: `${m}-12`, category: 'fuel', amount: 400 },
    { date: `${m}-12`, category: 'insurance', amount: 600 },
    { date: `${m}-14`, category: 'food', amount: 500 },
    { date: `${m}-15`, category: 'lodging', amount: 200 }
  ]);
  const snap = rows => ({ forEach: fn => rows.forEach(r => fn({ data: () => r })) });
  const query = rows => { const q = { where: () => q, get: async () => snap(rows) }; return q; };
  const w = {
    console, debugLog() {}, document: { addEventListener() {} },
    firebase: { firestore: () => ({ collection: n => query(n === 'loads' ? loads : expenses) }) },
    CustomCategories: { getAllCategories: async () => [] }
  };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/cpm-engine.js'), 'utf8'), vm.createContext(w), { filename: 'cpm-engine.js' });
  const r = await w.CPMEngine._fromRealData('u', 4, 4);
  assert.equal(r.source, 'real');
  assert.equal(r.cpm, 0.6, '(fuel 1600 + insurance 2400 + lodging 800) / 8000 mi; food 2000 excluded');
  assert.equal(r.foodLodgingCpm, 0.1, 'lodging only: 800 / 8000');
  assert.equal(r.breakdown.foodTotal, 2000, 'food reported for information');
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

// Tolls of the load (approved 2026-11-23) are part of that load's cost: they
// raise break-even and target by tolls / miles, at cost (no margin).
test('decision panel adds the load tolls to cost and thresholds', () => {
  const f = fixture();
  const w = f.w;
  const orig = w.document.getElementById;
  w.document.getElementById = id => orig(id) || f.el(id);
  const run = tolls => {
    w._userAvgRPM = 0; w._userCPM = 0.5;
    w.__realShowDecisionPanel({ totalCharge: 700, netProfit: 450 - tolls, totalMiles: 500, tolls,
      actualRPM: 1.4, profitMargin: 64, profitPerMile: 0.9, origin: 'Newark NJ', destination: 'Boston MA',
      originState: 'NJ', destinationState: 'MA' });
    return w._lastDecisionData;
  };
  const sin = run(0), con = run(150);
  assert.ok(Math.abs((con.thresholds.cpm - sin.thresholds.cpm) - 0.3) < 1e-9, '150 / 500 mi = $0.30 more per mile');
  assert.ok(Math.abs((con.thresholds.acceptThreshold - sin.thresholds.acceptThreshold) - 0.3) < 1e-9, 'tolls at cost, no margin');
  assert.equal(con.thresholds.tolls, 150);
  assert.equal(sin.thresholds.tolls, 0);
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

// Clima: etiquetas en español, conteos honestos y alertas vigentes.
function weatherClient() {
  const w = { console };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/weather-client.js'), 'utf8'), vm.createContext(w), { filename: 'weather-client.js' });
  return w.SLSWeather;
}

test('weather helpers: Spanish labels, categories and route counts', () => {
  const W = weatherClient();
  assert.equal(W.conditionEs({ code: 1003, text: 'Partly cloudy' }), 'Parcialmente nublado');
  assert.equal(W.conditionEs({ code: 1063, text: 'Patchy rain nearby' }), 'Lluvia dispersa');
  assert.equal(W.conditionEs({ code: 9999, text: 'Unknown' }), 'Unknown', 'unknown code keeps provider text');
  assert.equal(W.kind({ code: 1063 }), 'rain');
  assert.equal(W.kind({ code: 1210 }), 'snow');
  assert.equal(W.kind({ code: 1201 }), 'snow', 'freezing rain counts as snow/ice');
  assert.equal(W.kind({ code: 1276 }), 'storm');
  assert.equal(W.kind({ code: 1003 }), 'other');
  const n = W.routeCounts([{ code: 1063 }, { code: 1183 }, null, { code: 1003 }, { code: 1276 }]);
  assert.deepEqual({ ...n }, { total: 4, rain: 2, snow: 0, storm: 1 }, 'failed points are not counted');
  const now = Date.parse('2032-05-10T12:00:00Z');
  const alerts = W.activeAlerts({ alerts: { alert: [
    { event: 'Old', severity: 'Severe', expires: '2032-05-09T00:00:00Z' },
    { event: 'Moderate one', severity: 'Moderate', expires: '2032-05-11T00:00:00Z' },
    { event: 'Extreme one', severity: 'Extreme', expires: '2032-05-11T00:00:00Z' }
  ] } }, now);
  assert.deepEqual(alerts.map(a => a.event), ['Extreme one', 'Moderate one']);
});

test('weather modal: Spanish, no removed sections, escapes provider and user text', async () => {
  const f = fixture();
  const w = f.w;
  let html = '';
  w.document.body.insertAdjacentHTML = (_pos, h) => { html += h; };
  w.crypto = { randomUUID: () => 'synthetic-request' };
  w.SLSWeatherAppCheck = { ensure: async () => {} };
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/weather-client.js'), 'utf8'), w, { filename: 'weather-client.js' });
  const day = (date, max, min, rain, snow) => ({ date, day: { maxtemp_f: max, mintemp_f: min, daily_chance_of_rain: rain, daily_chance_of_snow: snow, condition: { code: 1003 } } });
  w.firebase.app = () => ({ functions: () => ({ httpsCallable: () => async () => ({ data: {
    location: { name: 'Atlanta<img src=x onerror=alert(1)>', region: 'Georgia' },
    current: { temp_f: 57.8, wind_mph: 7, condition: { code: 1003, text: 'Partly cloudy', icon: '//cdn.weatherapi.com/x.png' } },
    forecast: { forecastday: [day('2032-05-10', 68, 49, 4, 0), day('2032-05-11', 68, 52, 10, 0), day('2032-05-12', 66, 53, 8, 30)] },
    alerts: { alert: [{ event: 'Winter Storm Warning', severity: 'Severe', areas: 'Fulton <b>County</b>', effective: '2032-05-10T06:00:00Z', expires: '2099-05-11T18:00:00Z' }] }
  } }) }) });
  await w.showWeatherModal('Atlanta<img src=x onerror=alert(1)>, GA', 'Miami, FL');
  assert.match(html, /Clima de la ruta/);
  assert.match(html, /Parcialmente nublado/);
  assert.match(html, />Hoy</);
  assert.match(html, /58°F/);
  assert.match(html, /Nieve 30%/, 'snow chance shown only when above zero');
  assert.match(html, /Alerta: Winter Storm Warning/);
  assert.match(html, /Zona: Fulton &lt;b&gt;County&lt;\/b&gt;/);
  assert.match(html, /Atlanta&lt;img/, 'location name is escaped');
  assert.doesNotMatch(html, /<img src=x/);
  for (const removed of ['Share Forecast', 'UV Index', 'Visibility', 'Humidity', 'Current Weather', 'View Route'])
    assert.doesNotMatch(html, new RegExp(removed), removed);
});

// Costos actuales (aprobado 2026-11-21): gasolina con el precio actual de
// Configuración; comida y hospedaje como promedio real por día de viaje.
test('real CPM: current fuel price, food/lodging per travel day, rest per mile', async () => {
  const months = ['2032-01', '2032-02', '2032-03', '2032-04'];
  const loads = months.map(m => ({ date: `${m}-10`, totalMiles: 2000, userId: 'u' }));
  const expenses = months.flatMap(m => [
    { date: `${m}-12`, category: 'fuel', amount: 600 },
    { date: `${m}-12`, category: 'insurance', amount: 600 },
    { date: `${m}-13`, category: 'food', amount: 200 },
    { date: `${m}-14`, category: 'lodging', amount: 100 }
  ]);
  const snap = rows => ({ forEach: fn => rows.forEach(r => fn({ data: () => r })) });
  const query = rows => { const q = { where: () => q, get: async () => snap(rows) }; return q; };
  const w = {
    console, debugLog() {}, document: { addEventListener() {} },
    firebase: { firestore: () => ({ collection: n => query(n === 'loads' ? loads : expenses) }) },
    CustomCategories: { getAllCategories: async () => [] },
    currentUser: { profileData: { fuelPricePerGallon: 3.8, fuelMPG: 19, fuelPriceUpdatedAt: '2032-05-01T00:00:00Z' } }
  };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/cpm-engine.js'), 'utf8'), vm.createContext(w), { filename: 'cpm-engine.js' });
  const r = await w.CPMEngine._fromRealData('u', 4, 4);
  const days = w.CPMEngine.estimateTripDays(2000);
  assert.equal(Math.round(days * 1000) / 1000, Math.round(((2000 / 60 + 6 * 0.5) / 10) * 1000) / 1000);
  assert.equal(r.fuelSource, 'price');
  assert.equal(r.fuelCpm, 0.2, '3.80 / 19, not receipts (2400 / 8000 = 0.30)');
  assert.equal(r.breakdown.receiptsFuelCpm, 0.3);
  assert.equal(r.otherCpm, 0.3, 'insurance 2400 / 8000 mi, without food/lodging');
  // Desde 2026-11-23 la comida no entra: solo hospedaje (400) / días de viaje
  assert.equal(r.foodPerDay, Math.round((400 / (4 * days)) * 100) / 100, 'lodging 400 / travel days (food excluded)');

  // Sin precio en Configuración: vuelve a los recibos
  delete w.currentUser.profileData.fuelPricePerGallon;
  const r2 = await w.CPMEngine._fromRealData('u', 4, 4);
  assert.equal(r2.fuelSource, 'receipts');
  assert.equal(r2.fuelCpm, 0.3);
});

test('calculator: one cost formula for screen and save, food & lodging charged per mile', async () => {
  const f = fixture();
  const w = f.w;
  w.CPMEngine = {
    // foodPerDay queda solo informativo: comida+hotel se cobran por milla (foodLodgingCpm)
    current: () => ({ source: 'real', cpm: 0.7, fuelCpm: 0.2, otherCpm: 0.3, foodPerDay: 50, foodLodgingCpm: 0.2 }),
    getCPM: async () => ({ source: 'real', cpm: 0.7 }),
    estimateTripDays: () => 2
  };
  await w.calculate();
  await w.saveLoad();
  const saved = f.writes.find(x => x.name === 'loads')?.data;
  assert.ok(saved, 'save completed');
  // 500 mi x (0.20 + 0.30) + 500 mi x 0.20 comida/hotel + 10 peajes
  assert.equal(saved.totalExpenses, 360);
  assert.equal(f.w.visible.totalExpenses, 360);
  assert.equal(saved.netProfit, f.w.visible.netProfit);
  const e = w.calculateTotalExpenses(500, 0);
  assert.equal(e.foodCost, 100);
  assert.equal(e.costPerMile, 0.7, '(100 + 250) / 500 for this load');
});

test('fuel price age is reported in days', () => {
  const f = fixture();
  f.w.currentUser.profileData = { fuelPriceUpdatedAt: new Date(Date.now() - 40 * 86400000).toISOString() };
  assert.equal(f.w.fuelPriceAgeDays(), 40);
  f.w.currentUser.profileData = {};
  assert.equal(f.w.fuelPriceAgeDays(), null);
});

// Combustible por ruta (EIA): precios reales de la semana 2026-11-16.
const EIA_WEEK = {
  periods: { gasoline: '2026-11-16', diesel: '2026-11-16' },
  gasoline: { NUS: 3.805, R1X: 3.908, R1Y: 4.064, R1Z: 3.436, R20: 3.604, R30: 3.293, R40: 3.696, R5XCA: 4.405, SCA: 5.387, SFL: 3.525, STX: 3.216, SNY: 4.063, SOH: 3.396, SCO: 3.513, SMA: 3.872, SMN: 3.608, SWA: 4.714 },
  diesel: { NUS: 5.937, R1X: 6.225, R1Y: 6.309, R1Z: 5.541, R20: 5.967, R30: 5.547, R40: 6.011, R5XCA: 6.269, SCA: 7.733 }
};

test('server: EIA rows -> latest week only, plausible prices', () => {
  const { parseEia } = require(path.join(root, 'functions/fuel-prices.js'));
  const out = parseEia([
    { period: '2026-11-16', product: 'EPMR', duoarea: 'STX', value: '3.216' },
    { period: '2026-11-09', product: 'EPMR', duoarea: 'STX', value: '3.100' },
    { period: '2026-11-16', product: 'EPD2D', duoarea: 'R30', value: 5.547 },
    { period: '2026-11-16', product: 'EPMR', duoarea: 'SCA', value: '99' },
    { period: '2026-11-16', product: 'EPMM', duoarea: 'NUS', value: '4.2' }
  ]);
  assert.deepEqual(out.gasoline, { STX: 3.216 });
  assert.deepEqual(out.diesel, { R30: 5.547 });
  assert.deepEqual(out.periods, { gasoline: '2026-11-16', diesel: '2026-11-16' });
});

test('route fuel price: state series for gasoline, regions for diesel', () => {
  const w = { console };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/fuel-prices.js'), 'utf8'), vm.createContext(w), { filename: 'fuel-prices.js' });
  const F = w.SLSFuelPrices;
  assert.equal(F.priceForState(EIA_WEEK, 'TX', 'gasoline').price, 3.216);
  assert.equal(F.priceForState(EIA_WEEK, 'TX', 'diesel').price, 5.547);
  assert.equal(F.priceForState(EIA_WEEK, 'GA', 'gasoline').code, 'R1Z');
  assert.equal(F.priceForState(EIA_WEEK, 'CA', 'diesel').price, 7.733);
  assert.equal(F.priceForState(EIA_WEEK, 'AZ', 'gasoline').code, 'R5XCA');
  assert.equal(F.priceForState(EIA_WEEK, 'XX', 'gasoline'), null);
  const r = F.routePrice(EIA_WEEK, ['FL', 'GA', 'FL'], 'gasoline');
  assert.equal(r.price, Math.round(((3.525 + 3.436) / 2) * 1000) / 1000, 'each state once');
  assert.equal(r.parts.length, 2);
  assert.ok(F.isFresh(EIA_WEEK, 'gasoline', Date.parse('2026-11-21T12:00:00Z')));
  assert.ok(!F.isFresh(EIA_WEEK, 'gasoline', Date.parse('2026-12-20T12:00:00Z')), 'older than 3 weeks');
});

test('calculator: fuel from route prices + user adjustment / MPG, fallback when stale', () => {
  const f = fixture();
  const w = f.w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/fuel-prices.js'), 'utf8'), w, { filename: 'fuel-prices.js' });
  w.currentUser.profileData = { fuelMPG: 20, fuelPriceAdjust: -0.2, fuelType: 'gasoline' };
  w.SLSFuelPrices.set({ ...EIA_WEEK, periods: { gasoline: new Date().toISOString().slice(0, 10), diesel: new Date().toISOString().slice(0, 10) } });
  const route = { states: ['FL', 'TX'] };
  const e = w.calculateTotalExpenses(500, 0, route);
  const price = (3.525 + 3.216) / 2 - 0.2;
  assert.ok(e.fuelRoute, 'route price used');
  assert.ok(Math.abs(e.fuelCost - 500 * price / 20) < 0.02, `fuel ${e.fuelCost} vs ${500 * price / 20}`);
  assert.ok(Math.abs(e.fuelRoute.price - price) < 0.001);
  // Diésel con el mismo usuario
  w.currentUser.profileData.fuelType = 'diesel';
  assert.equal(w.calculateTotalExpenses(500, 0, route).fuelRoute.base, Math.round(((5.541 + 5.547) / 2) * 1000) / 1000);
  // Precios viejos -> precio de Configuración (costs.combustible = 0.2 en el fixture)
  w.SLSFuelPrices.set(EIA_WEEK);
  w.currentUser.profileData.fuelType = 'gasoline';
  const old = w.calculateTotalExpenses(500, 0, route);
  if (!w.SLSFuelPrices.isFresh(EIA_WEEK, 'gasoline')) {
    assert.equal(old.fuelRoute, null);
    assert.equal(old.fuelCost, 100);
  }
  // Sin ruta -> precio de Configuración
  assert.equal(w.calculateTotalExpenses(500, 0).fuelCost, 100);
});

// Combustible ponderado por millas en cada estado (avisos "Entering X" de Google).
function directionsRoute(stepsSpec, start = 'Miami, FL, USA', end = 'Dallas, TX, USA') {
  return { routes: [{ legs: [{ start_address: start, end_address: end,
    steps: stepsSpec.map(([miles, instructions]) => ({ distance: { value: miles * 1609.34 }, instructions })) }] }] };
}
function fuelModule() {
  const w = { console };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/fuel-prices.js'), 'utf8'), vm.createContext(w), { filename: 'fuel-prices.js' });
  return w.SLSFuelPrices;
}
const stateOfAddress = (a) => (String(a).match(/,\s*([A-Z]{2})\s*,/) || [])[1] || '';

test('route miles per state from Google "Entering X" notes (English and Spanish)', () => {
  const F = fuelModule();
  const en = F.stateMilesFromDirections(directionsRoute([
    [300, 'Merge onto I-75 N'],
    [100, 'Continue on I-10 W<div style="font-size:0.9em">Entering Alabama</div>'],
    [60, 'Continue<div style="font-size:0.9em">Entering Mississippi</div>'],
    [80, 'Keep left<div style="font-size:0.9em">Entering Louisiana</div>'],
    [260, 'Continue on I-20 W<div style="font-size:0.9em">Entering Texas</div>'],
    [190, 'Take exit 470 toward Dallas']
  ]), stateOfAddress);
  // El tramo donde se cruza la frontera se reparte mitad y mitad
  assert.deepEqual({ ...en }, { FL: 350, AL: 80, MS: 70, LA: 170, TX: 320 });
  const es = F.stateMilesFromDirections(directionsRoute([
    [300, 'Incorpórate a I-75 N'],
    [100, 'Continúa por I-10 O<div>Entrando a Alabama</div>'],
    [140, 'Mantente a la izquierda<div>Entrando a Luisiana</div>'],
    [450, 'Continúa por I-20 O<div>Entrando a Texas</div>']
  ]), stateOfAddress);
  assert.deepEqual({ ...es }, { FL: 350, AL: 120, LA: 295, TX: 225 });
  // Origen y destino en estados distintos sin ningún aviso: sin datos fiables
  assert.equal(F.stateMilesFromDirections(directionsRoute([[990, 'Head west']]), stateOfAddress), null);
  // Mismo estado sin avisos: todo en ese estado
  assert.deepEqual({ ...F.stateMilesFromDirections(directionsRoute([[200, 'Head north']], 'Miami, FL, USA', 'Orlando, FL, USA'), stateOfAddress) }, { FL: 200 });
});

test('route miles per state from REAL Google directions text (Miami -> Dallas, en/es)', () => {
  const F = fuelModule();
  // Pasos reales devueltos por Google el 2026-11-21 (millas redondeadas)
  const real = (enter) => [
    [8, 'Keep <b>left</b> to continue on <b>I-95Exp</b><div style="font-size:0.9em">Toll road</div>'],
    [195, 'Take the ramp onto <b>Florida\'s Tpke</b>'], [67, 'Continue onto <b>Florida\'s Tpke</b>'],
    [107, 'Merge onto <b>I-75 N</b>'],
    [336, `Take exit <b>435</b> to merge onto <b>I-10 W</b><div style="font-size:0.9em">${enter} Alabama</div>`],
    [25, 'Continue onto <b>I-165 N</b>'],
    [65, `Continue onto <b>US-98 W</b><div style="font-size:0.9em">${enter} ${enter === 'Entering' ? 'Mississippi' : 'Misisipi'}</div>`],
    [9, 'Slight right to merge onto <b>I-59 N</b>'],
    [213, `Keep <b>left</b> to stay on <b>I-20 W</b><div style="font-size:0.9em">${enter} ${enter === 'Entering' ? 'Louisiana' : 'Luisiana'}</div>`],
    [174, `Keep <b>left</b> to stay on <b>I-20 W</b><div style="font-size:0.9em">${enter} Texas</div>`],
    [40, 'Turn <b>right</b> onto <b>S Akard St</b>']
  ];
  const en = F.stateMilesFromDirections(directionsRoute(real('Entering')), stateOfAddress);
  const es = F.stateMilesFromDirections(directionsRoute(real('Entrando en'), 'Miami, Florida, EE. UU.', 'Dallas, Texas, EE. UU.'),
    (a) => ({ 'Miami, Florida, EE. UU.': 'FL', 'Dallas, Texas, EE. UU.': 'TX' })[a]);
  for (const r of [en, es]) {
    assert.deepEqual(Object.keys(r).sort(), ['AL', 'FL', 'LA', 'MS', 'TX']);
    assert.equal(Math.round(r.FL), 8 + 195 + 67 + 107 + 168);
    assert.equal(Math.round(r.TX), 87 + 40);
  }
});

test('route miles per state with "Passing through" notes (real Miami -> Los Angeles step)', () => {
  const F = fuelModule();
  for (const [pass, enter, la] of [['Passing through Alabama, Mississippi', 'Entering', 'Louisiana'], ['Pasando por Alabama, Misisipi', 'Entrando en', 'Luisiana']]) {
    const r = F.stateMilesFromDirections(directionsRoute([
      [270, 'Florida\'s Tpke'],
      [444, `Take exit <b>435</b> to merge onto <b>I-10 W</b><div style="font-size:0.9em">${pass}</div><div style="font-size:0.9em">${enter} ${la}</div>`],
      [272, `Take the ramp onto <b>I-10 W</b><div style="font-size:0.9em">${enter} Texas</div>`]
    ], 'Miami, FL, USA', 'Houston, TX, USA'), stateOfAddress);
    // El tramo de 444 mi se reparte entre FL, AL, MS y LA (111 cada uno)
    assert.deepEqual({ ...r }, { FL: 381, AL: 111, MS: 111, LA: 247, TX: 136 });
  }
});

test('route fuel price weighted by miles per state', () => {
  const F = fuelModule();
  const r = F.routePrice(EIA_WEEK, ['FL', 'TX'], 'gasoline', { FL: 300, AL: 100, MS: 60, LA: 80, TX: 450 });
  // FL 3.525, AL/MS/LA Costa del Golfo 3.293, TX 3.216
  const expected = (300 * 3.525 + 240 * 3.293 + 450 * 3.216) / 990;
  assert.ok(r.weighted);
  assert.ok(Math.abs(r.price - expected) < 0.001, `${r.price} vs ${expected}`);
  assert.equal(r.parts[0].state, 'TX', 'largest share first');
  // Sin millas por estado: promedio simple de origen y destino
  const simple = F.routePrice(EIA_WEEK, ['FL', 'TX'], 'gasoline', null);
  assert.equal(simple.weighted, false);
  assert.equal(simple.price, Math.round(((3.525 + 3.216) / 2) * 1000) / 1000);
});

test('calculator uses state miles only for the same origin and destination', () => {
  const f = fixture();
  const w = f.w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/fuel-prices.js'), 'utf8'), w, { filename: 'fuel-prices.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/sequential-destinations.js'), 'utf8'), w, { filename: 'sequential-destinations.js' });
  w._lastRouteStateMiles = { key: w.routeKeyForFuel('Miami, FL', 'Dallas, TX'), miles: { FL: 300, TX: 690 } };
  assert.deepEqual({ ...w.loadRoute('Miami, FL', 'Dallas, TX').stateMiles }, { FL: 300, TX: 690 });
  assert.equal(w.loadRoute('Miami, FL', 'Atlanta, GA').stateMiles, null, 'another load: no stale miles');
});

// Costos fijos (aprobado 2026-11-21): importe mensual ACTUAL de Configuración /
// millas reales al mes del historial; las categorías fijas salen del promedio.
function realEngine(expenses, categories, profileData = {}) {
  const months = ['2032-01', '2032-02', '2032-04'];            // 2032-03 en pausa
  const loads = months.map(m => ({ date: `${m}-10`, totalMiles: 3000, userId: 'u' }));
  const snap = rows => ({ forEach: fn => rows.forEach(r => fn({ data: () => r })) });
  const query = rows => { const q = { where: () => q, get: async () => snap(rows) }; return q; };
  const w = {
    console, debugLog() {}, document: { addEventListener() {} },
    firebase: { firestore: () => ({ collection: n => query(n === 'loads' ? loads : expenses) }) },
    CustomCategories: { getAllCategories: async () => categories },
    currentUser: { profileData }
  };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/cpm-engine.js'), 'utf8'), vm.createContext(w), { filename: 'cpm-engine.js' });
  return w.CPMEngine;
}

test('real CPM: fixed monthly categories leave the per-mile average', async () => {
  const exp = ['2032-01', '2032-02', '2032-03', '2032-04'].flatMap(m => [
    { date: `${m}-05`, category: 'fuel', amount: 600 },
    { date: `${m}-05`, category: 'insurance', amount: 1200 },
    { date: `${m}-05`, category: 'carpayment', amount: 800 },
    { date: `${m}-06`, category: 'custom-phone', amount: 100 },
    { date: `${m}-07`, category: 'maintenance', amount: 90 }
  ]);
  const engine = realEngine(exp, [{ id: 'custom-phone', isFixed: true, isOperational: true }]);
  const r = await engine._fromRealData('u', 4, 3);
  assert.equal(r.realMonthlyMiles, 9000 / 4, '9000 mi over 4 calendar months (pause month included)');
  assert.equal(r.otherVarCpm, Math.round((4 * 90 / 9000) * 10000) / 10000, 'only maintenance stays per mile');
  assert.equal(r.breakdown.fixedHistTotal, 4 * (1200 + 800 + 100));
  assert.equal(r.breakdown.fixedHistMonthly, 2100);
  assert.ok(r.breakdown.fixedIds.includes('custom-phone'));
});

test('calculator: fixed per mile = Settings monthly / real monthly miles; fallback without Settings', () => {
  const f = fixture();
  const w = f.w;
  w.CPMEngine = {
    current: () => ({ source: 'real', cpm: 0.9, fuelCpm: 0.2, otherCpm: 0.5, otherVarCpm: 0.05, realMonthlyMiles: 5000, foodPerDay: 0 }),
    getCPM: async () => ({ source: 'real', cpm: 0.9 }),
    estimateTripDays: () => 1
  };
  w.currentUser.profileData = { vehiclePayment: 900, insurance: 1250, licenses: 10, otherFixed: 150 };
  const c = w.getUsersCosts();
  assert.equal(c.fixedFromConfig, true);
  assert.equal(c.fixedMonthly, 2310);
  assert.ok(Math.abs(c.costosFijos - (0.05 + 2310 / 5000)) < 1e-9);
  // Sin importes fijos en Configuración: promedio de Finanzas como antes
  w.currentUser.profileData = {};
  const c2 = w.getUsersCosts();
  assert.equal(c2.fixedFromConfig, false);
  assert.equal(c2.costosFijos, 0.5);
});

test('custom category: create as fixed and toggle an existing one', async () => {
  let stored = [{ id: 'custom-phone', name: 'Telefono', isOperational: false }];
  const ref = {
    get: async () => ({ exists: true, data: () => ({ customExpenseCategories: stored }) }),
    set: async (data) => { if (data.customExpenseCategories && !data.customExpenseCategories.__union) stored = data.customExpenseCategories; }
  };
  const fsStub = () => ({ collection: () => ({ doc: () => ref }) });
  fsStub.FieldValue = { arrayUnion: (x) => { stored = [...stored, x]; return { __union: true }; } };
  const w = { console, debugLog() {}, document: { addEventListener() {}, getElementById: () => null },
    firebase: { auth: () => ({ currentUser: { uid: 'u' } }), firestore: fsStub } };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/custom-categories.js'), 'utf8'), vm.createContext(w), { filename: 'custom-categories.js' });
  const created = await w.CustomCategories.createCustomCategory('Internet', '🌐', '#000000', false, true);
  assert.equal(created.isFixed, true);
  assert.equal(created.isOperational, true, 'fixed implies operational');
  await w.CustomCategories.setCustomCategoryFixed('custom-phone', true);
  assert.equal(stored.find(c => c.id === 'custom-phone').isFixed, true);
  await w.CustomCategories.setCustomCategoryFixed('custom-phone', false);
  assert.equal(stored.find(c => c.id === 'custom-phone').isFixed, false);
});

// Lex = panel (2026-11-21): misma ganancia y mismo objetivo que el panel para la carga activa.
test('Lex uses the panel profit and target for the active load', async () => {
  const profile = { version: '1.2', avgRPM: 1.2, avgCPM: 0.4, minSafeRPM: 0.6, stateStats: {} };
  const w = {
    console, debugLog() {}, document: { addEventListener() {}, getElementById: () => null },
    currentUser: { uid: 'u' },
    firebase: { firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => profile }) }) }) }) }
  };
  w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/lex-learning.js'), 'utf8'), vm.createContext(w), { filename: 'lex-learning.js' });
  w._lastDecisionData = { decision: 'EVALUATE', actualRPM: 0.9, totalMiles: 1000, netProfit: 215.5, thresholds: { cpm: 0.685, acceptThreshold: 0.98 }, reasons: {} };
  const a = await w.analyzeLoadWithLearning({ rpm: 0.9, totalMiles: 1000, destinationState: 'TX' });
  assert.equal(a.estimatedProfit, '215.50', 'same net profit as the panel');
  assert.equal(a.targetRPM, 0.98, 'same target as the panel');
  assert.ok(a.reasons.some(r => r.includes('$0.98/mi') && r.includes('target')), 'caution text asks for the panel target');
  // Otra carga (no la del panel): promedio historico de Lex
  const b = await w.analyzeLoadWithLearning({ rpm: 1.5, totalMiles: 500, destinationState: 'TX' });
  assert.equal(b.estimatedProfit, ((1.5 - 0.4) * 500).toFixed(2));
  assert.equal(b.targetRPM, null);
});

// Zonas dificiles de salir segun el historial de CADA usuario (sin listas fijas de estados).
test('hard-to-leave zones come from the user history, not fixed states', () => {
  const { w } = fixture();
  assert.equal(typeof w.userTrapInfo, 'function');
  assert.equal(w.ZONAS_TRAP, undefined, 'no fixed trap state list in the client');
  w._userExitStats = {
    avgRPM: 1.0,
    byState: {
      TX: { loads: 4, miles: 2000, revenue: 1400, avgRPM: 0.70, avgMiles: 500 }, // 30% bajo su promedio
      FL: { loads: 2, miles: 1000, revenue: 500, avgRPM: 0.50, avgMiles: 500 },  // pocas cargas: sin datos
      GA: { loads: 5, miles: 2500, revenue: 2375, avgRPM: 0.95, avgMiles: 500 }  // normal
    }
  };
  assert.ok(w.userTrapInfo('TX', 0.6), 'TX pays 30% below the user average');
  assert.equal(w.userTrapInfo('FL', 0.6), null, 'fewer than 3 loads: no verdict');
  assert.equal(w.userTrapInfo('GA', 0.6), null);
  assert.ok(w.userTrapInfo('GA', 1.0), 'below the user cost per mile is also hard to leave');
  const t = w.analizarTrapPenalty('GA', 'TX', 500, 1.2, 0.6);
  assert.equal(t.esTrampa, true);
  assert.equal(t.millasSalida, 500);
  assert.ok(Math.abs(t.rpmRealCiclo - (1.2 * 500 + 0.7 * 500) / 1000) < 1e-9);
  assert.ok(Math.abs(t.gananciaCiclo - (1.2 * 500 + 0.7 * 500 - 1000 * 0.6)) < 1e-9);
  assert.equal(w.analizarTrapPenalty('TX', 'GA', 500, 1.2, 0.6).esTrampa, false);
});
