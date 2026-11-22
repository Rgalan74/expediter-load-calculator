/**
 * @copyright 2026 SmartLoad Solution — Ricardo Galan. All rights reserved.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without prior written permission.
 * Violators may be prosecuted under applicable copyright law.
 *
 * @product    Expediter Load Calculator (SmartLoad Solution)
 * @author     Ricardo Galan <ricardogalan74@gmail.com>
 * @license    Proprietary — All Rights Reserved
 * @fingerprint SLS-2026-RG74-EXPEDITER
 */
//  CALCULATOR.JS - VERSION INTEGRADA COMPLETA
// Combina: Costos reales + Todas las funcionalidades existentes

// IMPORTS COMENTADOS - Usando funciones globales en su lugar
// import { sanitizeNumber, sanitizeText } from './security.js';
// import { LoadingManager, showToast } from './ui-feedback.js';
// Las funciones están disponibles globalmente desde los scripts

//  TUS COSTOS OPERATIVOS REALES - Actualizado DINÁMICO 2025
// Ahora obtiene los datos del perfil del usuario si existe, o usa defaults seguros
const DEFAULT_COSTS = {
  combustible: 0.195,  // $3.70/gal ÷ 19 MPG
  mantenimiento: 0.051, // mant $0.014 + tires $0.012 + reparaciones $0.025
  comida: 0,     // eliminado — no aplica como costo operativo
  costosFijos: 0.288, // $2,307/mes ÷ 8,000 mi (auto + seguro + permisos + otros)
  TOTAL: 0.534
};

// Getter dinámico para usar los costos actuales del usuario.
// users/{uid}.costs puede venir en DOS esquemas, y el documento puede tener
// claves de ambos a la vez (settings.js guarda con merge sobre el perfil default):
//   A) Configuración (settings.js): combustible / mantenimiento / comida / costosFijos / totalCPM
//   B) Default del onboarding:      fuelCost / maintenanceCost / insuranceCost / depreciationCost / otherCost / totalCPM
// Regla: si existe el esquema A se usa SOLO ese (un 0 es un valor valido, no se
// rellena con claves viejas del esquema B). Los componentes siempre suman TOTAL,
// que coincide con costs.totalCPM — el mismo numero que usan Historial,
// CPMEngine y la Cloud Function evaluateLoad.
function _costNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function getConfigCosts() {
  const costs = window.currentUser && window.currentUser.costs;
  if (!costs) return DEFAULT_COSTS;

  let combustible, mantenimiento, comida, costosFijos;

  const cfgFuel = _costNum(costs.combustible);
  const defFuel = _costNum(costs.fuelCost);

  if (cfgFuel !== null && cfgFuel > 0) {
    // Esquema A — configurado por el usuario en Configuración
    combustible = cfgFuel;
    mantenimiento = _costNum(costs.mantenimiento) ?? 0;
    comida = _costNum(costs.comida) ?? 0;
    costosFijos = _costNum(costs.costosFijos) ?? 0;
  } else if (defFuel !== null && defFuel > 0) {
    // Esquema B — perfil default del onboarding (promedio de industria, $0.55/mi)
    combustible = defFuel;
    mantenimiento = _costNum(costs.maintenanceCost) ?? 0;
    comida = 0;
    costosFijos = (_costNum(costs.insuranceCost) ?? 0) +
      (_costNum(costs.depreciationCost) ?? 0) +
      (_costNum(costs.otherCost) ?? 0);
  } else {
    return DEFAULT_COSTS;
  }

  return {
    combustible,
    mantenimiento,
    comida,
    costosFijos,
    TOTAL: combustible + mantenimiento + comida + costosFijos
  };
}
window.getConfigCosts = getConfigCosts;

// ------------------------------------------------------------------
// COSTO POR MILLA ACTIVO — el mismo para calculadora, guardado, panel de
// decision e Historial. Tres etapas (las decide CPMEngine):
//   real    -> gastos reales de Finanzas (ultimos 6 meses) / millas de las cargas
//   config  -> estimacion de Configuración
//   default -> promedio de industria (perfil sin configurar)
// En "real" solo se conoce el combustible aparte; el resto va agrupado.
// ------------------------------------------------------------------
// Costos fijos mensuales actuales de Configuracion (pago del vehiculo, seguro,
// permisos y otros fijos como telefono/internet).
function configFixedMonthly() {
  const p = window.currentUser?.profileData || {};
  return ['vehiclePayment', 'insurance', 'licenses', 'otherFixed']
    .reduce((sum, k) => sum + (Number(p[k]) > 0 ? Number(p[k]) : 0), 0);
}
window.configFixedMonthly = configFixedMonthly;

function getUsersCosts() {
  const engine = window.CPMEngine && typeof window.CPMEngine.current === 'function'
    ? window.CPMEngine.current()
    : null;

  if (engine && engine.source === 'real' && engine.cpm > 0) {
    const fuel = Math.max(0, Number(engine.fuelCpm) || 0);
    const hasSplit = Number.isFinite(Number(engine.otherCpm));
    // Fijos mensuales: importe ACTUAL de Configuracion / millas reales al mes del
    // historial (incluye meses y dias parados). Se quitan del promedio de Finanzas.
    const cfgFixed = configFixedMonthly();
    const monthlyMiles = Number(engine.realMonthlyMiles) || 0;
    const useConfigFixed = cfgFixed > 0 && monthlyMiles > 0 && Number.isFinite(Number(engine.otherVarCpm));
    const fixedPerMile = useConfigFixed ? cfgFixed / monthlyMiles : 0;
    const perMile = useConfigFixed
      ? Math.max(0, Number(engine.otherVarCpm)) + fixedPerMile
      : (hasSplit ? Math.max(0, Number(engine.otherCpm)) : Math.max(0, engine.cpm - fuel));
    return {
      combustible: fuel,
      mantenimiento: 0,
      comida: 0,
      // Sin comida/hospedaje: esos van por dia de viaje (comidaPorDia)
      costosFijos: perMile,
      comidaPorDia: hasSplit ? Math.max(0, Number(engine.foodPerDay) || 0) : 0,
      fixedFromConfig: useConfigFixed,
      fixedMonthly: useConfigFixed ? cfgFixed : 0,
      fixedPerMile,
      TOTAL: engine.cpm
    };
  }
  return getConfigCosts();
}
window.getUsersCosts = getUsersCosts;

// De donde sale el costo por milla que se esta usando ahora mismo
function getActiveCpmInfo() {
  const engine = window.CPMEngine && typeof window.CPMEngine.current === 'function'
    ? window.CPMEngine.current()
    : null;
  let source;
  if (engine && engine.source === 'real' && engine.cpm > 0) source = 'real';
  else source = window.currentUser?.costs?.isDefault === false ? 'config' : 'default';
  return { cpm: getUsersCosts().TOTAL, source };
}
window.getActiveCpmInfo = getActiveCpmInfo;

// Sueldo del dueño POR DIA de trabajo (0 si no esta configurado):
// sueldo mensual / dias de trabajo al mes. Cada carga "cuesta" los dias que
// ocupa. No depende de cuantas millas haya guardadas.
function getOwnerPayPerDay() {
  const pay = Number(window.currentUser?.profileData?.ownerPayMonthly) || 0;
  if (!(pay > 0)) return 0;
  const days = Number(window.currentUser?.profileData?.workDaysPerMonth) || 22;
  return pay / Math.min(31, Math.max(1, days));
}
window.getOwnerPayPerDay = getOwnerPayPerDay;

// Aviso unico (por dispositivo) cuando el costo por milla pasa de la
// estimacion a los gastos reales, para que el cambio de numeros no sorprenda.
function notifyRealCpmSwitchOnce() {
  try {
    const uid = window.currentUser?.uid;
    if (!uid || getActiveCpmInfo().source !== 'real') return;
    const key = 'cpmRealNotice_' + uid;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');

    const from = getConfigCosts().TOTAL;
    const to = getUsersCosts().TOTAL;
    const template = window.i18n?.t('calculator.cpm_switch_notice') ||
      'From now on we use your real expenses: your cost per mile went from ${{from}} to ${{to}}.';
    const msg = template.replace('{{from}}', from.toFixed(3)).replace('{{to}}', to.toFixed(3));
    if (typeof showToast === 'function') showToast(msg, 'info', 9000);
  } catch (e) { /* el aviso es opcional */ }
}

// Desglose "como se calcula" del costo por milla real: que gastos y que millas
// entran en el numero. Se construye con nodos de texto (los nombres de
// categorias personalizadas los escribe el usuario).
function renderCpmBreakdown() {
  const box = document.getElementById('cpmBreakdown');
  if (!box) return;
  const engine = window.CPMEngine && typeof window.CPMEngine.current === 'function'
    ? window.CPMEngine.current()
    : null;
  const b = engine && engine.source === 'real' ? engine.breakdown : null;
  const body = document.getElementById('cpmBreakdownBody');
  if (!b || !body) { box.style.display = 'none'; return; }

  const isEs = (window.i18n?.currentLang || 'en') === 'es';
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const perMile = (n, miles) => miles > 0 ? '$' + (n / miles).toFixed(3) + '/mi' : '—';

  body.textContent = '';
  const addRow = (left, right, strong) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;padding:2px 0;' + (strong ? 'font-weight:700;' : '');
    const l = document.createElement('span'); l.textContent = left;
    const r = document.createElement('span'); r.textContent = right; r.style.whiteSpace = 'nowrap';
    row.appendChild(l); row.appendChild(r);
    body.appendChild(row);
  };
  const addNote = (text) => {
    const p = document.createElement('div');
    p.style.cssText = 'margin:6px 0 2px;opacity:0.8;';
    p.textContent = text;
    body.appendChild(p);
  };

  addNote(isEs
    ? `Periodo: tus últimos ${b.activeMonths} meses con cargas (${b.firstMonth} a ${b.lastMonth}).`
    : `Period: your last ${b.activeMonths} months with loads (${b.firstMonth} to ${b.lastMonth}).`);
  addNote(isEs
    ? `Cargas guardadas: ${b.loadsInWindow} cargas, ${b.milesLong.toLocaleString()} millas.`
    : `Saved loads: ${b.loadsInWindow} loads, ${b.milesLong.toLocaleString()} miles.`);
  addNote(isEs
    ? `Gastos registrados en ese periodo: ${b.countExpenses}, en ${b.monthsWithExpenses} meses distintos.`
    : `Expenses recorded in that period: ${b.countExpenses}, across ${b.monthsWithExpenses} different months.`);

  const isFoodLodging = (id) => id === 'food' || id === 'lodging';
  const _uc = getUsersCosts();
  const fixedIds = new Set(_uc.fixedFromConfig ? (b.fixedIds || []) : []);
  b.byCategory.forEach(c => {
    if (c.id === 'fuel' || isFoodLodging(c.id) || fixedIds.has(c.id)) return;
    addRow(c.name, `${money(c.total)}  →  ${perMile(c.total, b.milesLong)}`);
  });
  const otherTotal = _uc.fixedFromConfig && Number.isFinite(b.otherVarTotal) ? b.otherVarTotal
    : (Number.isFinite(b.otherTotal) ? b.otherTotal : b.nonFuelTotal);
  addRow(_uc.fixedFromConfig
      ? (isEs ? 'Otros costos variables por milla (todo el periodo)' : 'Other variable per-mile costs (whole period)')
      : (isEs ? 'Otros costos por milla (todo el periodo)' : 'Other per-mile costs (whole period)'),
    `${money(otherTotal)}  →  ${perMile(otherTotal, b.milesLong)}`, true);

  if (_uc.fixedFromConfig) {
    addRow(isEs
      ? `Fijos de Configuración: ${money(_uc.fixedMonthly)}/mes ÷ ${Number(b.realMonthlyMiles).toLocaleString()} mi/mes (tu promedio real)`
      : `Fixed costs from Settings: ${money(_uc.fixedMonthly)}/mo ÷ ${Number(b.realMonthlyMiles).toLocaleString()} mi/mo (your real average)`,
      `$${_uc.fixedPerMile.toFixed(3)}/mi`, true);
    const hist = Number(b.fixedHistMonthly) || 0;
    addNote(isEs
      ? `Millas al mes: ${Number(b.milesLong).toLocaleString()} mi ÷ ${b.spanMonths} meses de calendario (incluye meses sin cargas: los fijos se pagan igual).`
      : `Miles per month: ${Number(b.milesLong).toLocaleString()} mi ÷ ${b.spanMonths} calendar months (includes months without loads: fixed costs are still paid).`);
    addNote(isEs
      ? `Fijos registrados en Finanzas: ${money(hist)}/mes de promedio (${b.spanMonths} meses).`
      : `Fixed costs recorded in Finances: ${money(hist)}/mo on average (${b.spanMonths} months).`);
    if (hist > 0 && Math.abs(hist - _uc.fixedMonthly) / _uc.fixedMonthly > 0.2) {
      addNote(isEs
        ? '⚠ Difieren más de un 20%: revisa los importes fijos en Configuración.'
        : '⚠ They differ by more than 20%: check the fixed amounts in Settings.');
    }
  }

  if (Number(b.foodLodgingTotal) > 0 && Number(b.travelDays) > 0) {
    addRow(isEs ? `Comida y hospedaje (${money(b.foodLodgingTotal)} en ${b.travelDays} días de viaje)` : `Food and lodging (${money(b.foodLodgingTotal)} over ${b.travelDays} travel days)`,
      `${money(b.foodPerDay)}/${isEs ? 'día' : 'day'}`, true);
  }

  const _fr = window._lastLoadExp && window._lastLoadExp.fuelRoute;
  if (_fr) {
    const fuelName = _fr.fuelType === 'diesel' ? (isEs ? 'Diésel' : 'Diesel') : (isEs ? 'Gasolina' : 'Gasoline');
    // Agrupar por serie de precio (varios estados comparten región), sumando millas
    const groups = [];
    for (const p of _fr.parts) {
      const g = groups.find(x => x.code === p.code);
      if (g) g.miles += p.miles || 0;
      else groups.push({ code: p.code, name: p.name, price: p.price, miles: p.miles || 0 });
    }
    groups.sort((a, b) => b.miles - a.miles);
    const partsTxt = groups.map(g => `${g.name}${g.miles ? ' ' + g.miles + ' mi' : ''} $${g.price.toFixed(2)}`).join(', ');
    addRow(isEs ? `${fuelName} de esta ruta${_fr.weighted ? ', ponderada por millas' : ''} (EIA, semana ${_fr.period || '—'}): ${partsTxt}` : `${fuelName} on this route${_fr.weighted ? ', weighted by miles' : ''} (EIA, week ${_fr.period || '—'}): ${partsTxt}`,
      `$${_fr.base.toFixed(2)}/gal`);
    if (_fr.adjust) addRow(isEs ? 'Tu ajuste sobre el promedio' : 'Your adjustment to the average', `${_fr.adjust > 0 ? '+' : '−'}$${Math.abs(_fr.adjust).toFixed(2)}/gal`);
    addRow(isEs ? `Combustible de esta carga: $${_fr.price.toFixed(2)}/gal ÷ ${_fr.mpg} MPG` : `Fuel for this load: $${_fr.price.toFixed(2)}/gal ÷ ${_fr.mpg} MPG`,
      `$${_fr.cpm.toFixed(3)}/mi`, true);
  }
  if (b.fuelSource === 'price') {
    const age = typeof window.fuelPriceAgeDays === 'function' ? window.fuelPriceAgeDays() : null;
    const ageTxt = age === null ? (isEs ? 'fecha no registrada' : 'date not recorded')
      : (isEs ? `actualizado hace ${age} días` : `updated ${age} days ago`);
    addRow(isEs ? `${_fr ? 'Precio de Configuración (respaldo)' : 'Gasolina'}: $${Number(b.fuelPrice).toFixed(2)}/gal ÷ ${b.fuelMPG} MPG (${ageTxt})` : `${_fr ? 'Settings price (fallback)' : 'Fuel'}: $${Number(b.fuelPrice).toFixed(2)}/gal ÷ ${b.fuelMPG} MPG (${ageTxt})`,
      `$${(b.fuelPrice / b.fuelMPG).toFixed(3)}/mi`, !_fr);
    if (Number(b.receiptsFuelCpm) > 0) {
      addNote(isEs ? `Tus recibos de gasolina del periodo daban $${Number(b.receiptsFuelCpm).toFixed(3)}/mi.` : `Your fuel receipts in the period gave $${Number(b.receiptsFuelCpm).toFixed(3)}/mi.`);
    }
  } else if (b.useRecentFuel) {
    addRow(isEs ? `Gasolina (recibos de ${(b.fuelMonths || []).join(', ')}; ${b.milesRecent.toLocaleString()} mi)` : `Fuel (receipts from ${(b.fuelMonths || []).join(', ')}; ${b.milesRecent.toLocaleString()} mi)`,
      `${money(b.fuelRecent)}  →  ${perMile(b.fuelRecent, b.milesRecent)}`, true);
  } else {
    addRow(isEs ? 'Gasolina (todo el periodo)' : 'Fuel (whole period)',
      `${money(b.fuelLong)}  →  ${perMile(b.fuelLong, b.milesLong)}`, true);
  }
  addRow(isEs ? 'Costo por milla de referencia (comida promediada por milla)' : 'Reference cost per mile (food averaged per mile)', '$' + Number(engine.cpm).toFixed(3) + '/mi', true);
  addNote(isEs
    ? 'En cada carga: gasolina y otros costos por milla + comida y hospedaje por los días que dura + peajes de esa carga.'
    : 'Per load: fuel and other per-mile costs + food and lodging for the days it takes + that load’s tolls.');

  // Para cuadrar contra Finanzas
  addNote(isEs ? 'Para comparar con Finanzas:' : 'To compare with Finances:');
  addRow(isEs ? 'Gasolina de todo el periodo' : 'Fuel for the whole period', money(b.fuelLong));
  addRow(isEs ? `Total de gastos del periodo (${b.firstMonth} a ${b.lastMonth})` : `Total expenses in the period (${b.firstMonth} to ${b.lastMonth})`,
    money(b.nonFuelTotal + b.fuelLong), true);
  if (b.outsideCount > 0) {
    addRow(isEs ? `Gastos posteriores a ${b.lastMonth}, NO incluidos (${b.outsideCount})` : `Expenses after ${b.lastMonth}, NOT included (${b.outsideCount})`,
      money(b.outsideTotal));
  }

  const summary = document.getElementById('cpmBreakdownSummary');
  if (summary) summary.textContent = isEs ? 'Ver cómo se calcula' : 'See how it is calculated';
  box.style.display = '';
}
window.renderCpmBreakdown = renderCpmBreakdown;

// Deja cargado (y cacheado 5 min por CPMEngine) el costo por milla activo
async function refreshActiveCpm() {
  if (window.SLSF2Runtime?.active()) {
    try { await window.SLSF2Runtime.refresh(); }
    catch (e) { debugLog('[SmartLoad F2] refresco omitido:', e.message); }
  }
  try {
    if (window.CPMEngine) {
      const result = await window.CPMEngine.getCPM();
      if (result && result.cpm > 0) {
        window._userCPM = getUsersCosts().TOTAL;
        notifyRealCpmSwitchOnce();
      }
    }
  } catch (e) {
    debugLog('[CPM] No se pudo refrescar el costo por milla, se usa el ultimo conocido:', e.message);
  }
}
window.refreshActiveCpm = refreshActiveCpm;

// Mantener compatibilidad con llamadas directas (usando Proxy si es soportado, o getter)
// Para navegadores antiguos o simplicidad, definimos TU_COSTO_REAL como un objeto que se actualiza o una función
// La mejor estrategia es actualizar window.TU_COSTO_REAL cuando carga el usuario, pero por ahora usaremos una función wrapper
const TU_COSTO_REAL = new Proxy(DEFAULT_COSTS, {
  get: function (target, prop) {
    const dynamicCosts = getUsersCosts();
    return prop in dynamicCosts ? dynamicCosts[prop] : target[prop];
  }
});

// ========================================
//  SHARED FUNCTION: Calculate Total Expenses
// ========================================
// Used by both Decision Panel and Lex for consistent calculations
// Dias de viaje de una carga (misma regla que el promedio historico de comida).
function estimateTripDays(miles) {
  if (window.CPMEngine && typeof window.CPMEngine.estimateTripDays === 'function') {
    return window.CPMEngine.estimateTripDays(miles, getVehicleProfile());
  }
  const pr = getVehicleProfile();
  const m = Math.max(0, Number(miles) || 0);
  return Math.max(1, (m / pr.speedAvg + Math.floor(m / 300) * 0.5) / pr.horasManejoPorDia);
}
window.estimateTripDays = estimateTripDays;

// Tipo de combustible del usuario (por defecto segun su vehiculo).
function getUserFuelType() {
  const p = window.currentUser?.profileData || {};
  if (p.fuelType === 'gasoline' || p.fuelType === 'diesel') return p.fuelType;
  const v = p.vehicleType || window._userVehicleType || 'van';
  return ['boxtruck', 'semi', 'hotshot'].includes(v) ? 'diesel' : 'gasoline';
}
window.getUserFuelType = getUserFuelType;

// Estados de la ruta de una carga: origen, paradas y destino.
function loadRouteStates(origin, destination, stopDestinations = []) {
  return [origin, ...stopDestinations, destination].map(getStateFromLocation).filter(Boolean);
}
window.loadRouteStates = loadRouteStates;

// Ruta para el combustible: estados (respaldo) y, si la ruta de Google de esta
// misma carga ya se calculó, las millas recorridas en cada estado.
function loadRoute(origin, destination, stopDestinations = []) {
  const route = { states: loadRouteStates(origin, destination, stopDestinations), stateMiles: null };
  const last = window._lastRouteStateMiles;
  if (last && last.miles && typeof window.routeKeyForFuel === 'function' &&
      last.key === window.routeKeyForFuel(origin, destination)) {
    route.stateMiles = last.miles;
  }
  return route;
}
window.loadRoute = loadRoute;

// Combustible de ESTA ruta con los precios semanales de la EIA, el tipo de
// combustible, el ajuste y las MPG del usuario. null si falta algo o los precios
// tienen mas de 3 semanas: entonces se usa el precio de Configuracion.
function routeFuel(route) {
  const F = window.SLSFuelPrices;
  const prices = F && F.current();
  const p = window.currentUser?.profileData || {};
  const mpg = Number(p.fuelMPG);
  const fuelType = getUserFuelType();
  if (!route || ((!route.states || !route.states.length) && !route.stateMiles) || !prices || !(mpg > 0) || !F.isFresh(prices, fuelType)) return null;
  const rp = F.routePrice(prices, route.states, fuelType, route.stateMiles);
  if (!rp) return null;
  const adjust = Number(p.fuelPriceAdjust) || 0;
  const price = Math.max(0.5, rp.price + adjust);
  return { cpm: price / mpg, price, base: rp.price, adjust, mpg, fuelType, parts: rp.parts, period: rp.period, weighted: rp.weighted };
}

// UNICA formula del costo de una carga (pantalla, panel, guardado e Historial):
//   combustible (precio de la ruta o de Configuracion) + otros costos por milla
//   + comida/hospedaje por dia de viaje (promedio real) + peajes de la carga.
function calculateTotalExpenses(totalMiles, tolls = 0, route = null) {
  const miles = Math.max(0, Number(totalMiles) || 0);
  const costs = getUsersCosts();
  const fuelRoute = routeFuel(route);
  const fuelCost = miles * (fuelRoute ? fuelRoute.cpm : (Number(costs.combustible) || 0));
  const maintenanceCost = miles * (Number(costs.mantenimiento) || 0);
  const foodPerDay = Number(costs.comidaPorDia) || 0;
  const tripDays = miles > 0 ? estimateTripDays(miles) : 0;
  const foodCost = miles * (Number(costs.comida) || 0) + foodPerDay * tripDays;
  const fixedCosts = miles * (Number(costs.costosFijos) || 0);
  tolls = Number(tolls) || 0;

  return {
    fuelCost,
    maintenanceCost,
    foodCost,
    foodPerDay,
    tripDays,
    fixedCosts,
    tolls,
    fuelRoute,
    // Costo por milla de ESTA carga sin peajes (umbrales del panel)
    costPerMile: miles > 0 ? (fuelCost + maintenanceCost + foodCost + fixedCosts) / miles : 0,
    // Mismo total que guarda saveLoad(): combustible + operativos (incl. comida) + tolls.
    // "Otros" NO es gasto: es un cargo extra cobrado al cliente (ingreso).
    total: fuelCost + maintenanceCost + foodCost + fixedCosts + tolls
  };
}

// Expose globally for use by Lex and other modules
window.calculateTotalExpenses = calculateTotalExpenses;

// Dias desde la ultima actualizacion del precio de la gasolina (null si no consta).
function fuelPriceAgeDays() {
  const t = Date.parse(window.currentUser?.profileData?.fuelPriceUpdatedAt || '');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
window.fuelPriceAgeDays = fuelPriceAgeDays;


// ======== DECISION 2025 (realista) ========
let DECISION_MODE = (typeof window !== 'undefined' && window.DECISION_MODE) || 'realista2025';

const COSTO_BASE_MI = 0.55;
const FLOOR_ESCAPE = 0.55;
const FLOOR_ACCEPT = 0.75;

// ============================================================
// ZONAS DIFICILES DE SALIR — segun el historial de CADA usuario
// Un estado es "dificil de salir" si las cargas del usuario que SALEN de ese
// estado (minimo 3) pagan menos que su costo por milla o un 15% menos que su
// RPM promedio. No hay listas fijas de estados.
// ============================================================
window._userExitStats = null;

async function loadUserExitStats() {
  try {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) return;
    const since = new Date(); since.setMonth(since.getMonth() - 12);
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-01`;
    const snap = await firebase.firestore().collection('loads')
      .where('userId', '==', uid).where('date', '>=', sinceStr).get();
    const byState = {};
    let miles = 0, revenue = 0;
    snap.forEach(doc => {
      const d = doc.data();
      const m = Number(d.totalMiles) || 0;
      const r = Number(d.rpm) > 0 ? Number(d.rpm) * m : (Number(d.totalCharge) || 0) - (Number(d.otherCosts) || 0);
      if (m <= 0 || r <= 0) return;
      miles += m; revenue += r;
      const st = d.originState || (typeof window.getStateCode === 'function' ? window.getStateCode(d.origin || '') : '');
      if (!st) return;
      const e = byState[st] || (byState[st] = { loads: 0, miles: 0, revenue: 0 });
      e.loads++; e.miles += m; e.revenue += r;
    });
    Object.values(byState).forEach(e => { e.avgRPM = e.revenue / e.miles; e.avgMiles = e.miles / e.loads; });
    window._userExitStats = { byState, avgRPM: miles > 0 ? revenue / miles : 0, loads: snap.size };
  } catch (e) {
    debugLog('loadUserExitStats:', e);
  }
}
window.loadUserExitStats = loadUserExitStats;

function userTrapInfo(state, cpm) {
  const st = window._userExitStats;
  const e = st?.byState?.[state];
  if (!e || e.loads < 3) return null;
  const isTrap = (cpm > 0 && e.avgRPM < cpm) || (st.avgRPM > 0 && e.avgRPM < st.avgRPM * 0.85);
  return isTrap ? e : null;
}
window.userTrapInfo = userTrapInfo;

// Ciclo ida + salida: esta carga + una carga de salida tipica del usuario desde ese estado
function analizarTrapPenalty(origenState, destinoState, millas, rpm, cpm) {
  const e = userTrapInfo(destinoState, cpm);
  if (!e) return { esTrampa: false };
  const millasSalida = Math.round(e.avgMiles);
  const revenueTotal = rpm * millas + e.avgRPM * millasSalida;
  const millasTotal = millas + millasSalida;
  return {
    esTrampa: true,
    cargasSalida: e.loads,
    rpmSalida: e.avgRPM,
    millasSalida,
    rpmRealCiclo: revenueTotal / millasTotal,
    gananciaCiclo: revenueTotal - millasTotal * (cpm || 0)
  };
}
window.analizarTrapPenalty = analizarTrapPenalty;

// Esperar a que Firebase este inicializado (config.js carga despues de este archivo)
(function initUserExitStats(tries = 0) {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      if (tries < 60) setTimeout(() => initUserExitStats(tries + 1), 500);
      return;
    }
    firebase.auth().onAuthStateChanged(u => { if (u) loadUserExitStats(); });
    document.addEventListener('loadSaved', () => loadUserExitStats());
  } catch (e) {
    debugLog('initUserExitStats:', e);
  }
})();




// ========================================
//  FUNCIÓN: Obtener clima del destino
// ========================================
async function getWeatherForDestination(destination) {

  try {
    const data = await window.SLSWeather.request('current',{query:destination});
    const temp = Math.round(data.current.temp_f);
    const condition = data.current.condition.text;
    const isSnow = condition.toLowerCase().includes('snow');
    const isStorm = condition.toLowerCase().includes('storm') || condition.toLowerCase().includes('thunder');
    const isRain = condition.toLowerCase().includes('rain');

    // Elegir emoji según condición
    let emoji = '🌤️';
    if (isSnow) emoji = '❄️';
    else if (isStorm) emoji = '⛈️';
    else if (isRain) emoji = '🌧️';
    else if (condition.toLowerCase().includes('cloud')) emoji = '☁️';
    else if (condition.toLowerCase().includes('clear') || condition.toLowerCase().includes('sunny')) emoji = '☀️';

    // Determinar color del badge
    let badgeClass = '';
    if (isSnow || temp <= 32) {
      badgeClass = 'bg-blue-900/40 border border-blue-400/40'; // Azul para frío/nieve
    } else if (isStorm) {
      badgeClass = 'bg-orange-900/40 border border-orange-400/40'; // Naranja para tormentas
    }

    return {
      temp,
      condition,
      emoji,
      badgeClass,
      text: `${emoji} ${temp}°F • ${window.SLSWeather.conditionEs(data.current.condition)}`
    };

  } catch (error) {
    debugLog('No se pudo obtener clima:', error);
    return {
      temp: null,
      condition: 'No disponible',
      emoji: '🌤️',
      badgeClass: '',
      text: '🌤️ Clima no disponible'
    };
  }
}

// ========================================
//  FUNCIÓN: Cargar mapa con ruta y clima
// ========================================
async function loadRouteMap() {
  if (!window.weatherModalData) return;

  const { origin, destination } = window.weatherModalData;

  // Inicializar mapa
  const mapDiv = document.getElementById('routeMap');
  const map = new google.maps.Map(mapDiv, {
    zoom: 6,
    center: { lat: 39.8, lng: -86.1 }, // Centro aproximado USA
    mapTypeId: 'roadmap'
  });

  // Directions Service
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true // Usaremos markers custom con clima
  });

  // Calcular ruta
  const request = {
    origin: origin,
    destination: destination,
    travelMode: 'DRIVING'
  };

  directionsService.route(request, async (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);

      const route = result.routes[0];
      const leg = route.legs[0];

      // Waypoints: Origen, Medio, Destino
      const waypoints = [
        { position: leg.start_location, name: origin, type: 'origin' },
        { position: route.overview_path[Math.floor(route.overview_path.length / 2)], name: 'Punto Medio', type: 'mid' },
        { position: leg.end_location, name: destination, type: 'destination' }
      ];

      // Obtener clima para cada waypoint
      const waypointContainer = document.getElementById('waypointWeather');
      waypointContainer.innerHTML = '<div class="text-sm font-bold text-gray-700 mb-2">Clima en Ruta:</div>';

      for (const wp of waypoints) {
        const lat = wp.position.lat();
        const lng = wp.position.lng();

        // Llamar WeatherAPI por coordenadas
        const weatherData = await getWeatherByCoords(lat, lng);

        if (weatherData) {
          // Marker con clima
          const icon = getWeatherMarkerIcon(weatherData.temp, weatherData.condition);

          const marker = new google.maps.Marker({
            position: wp.position,
            map: map,
            title: `${wp.name}: ${weatherData.temp}°F ${weatherData.condition}`,
            label: {
              text: `${weatherData.temp}°F`,
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            },
            icon: icon
          });

          // Info en lista
          waypointContainer.innerHTML += `
            <div class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${getWeatherEmoji(weatherData.condition)}</span>
                <div>
                  <div class="font-semibold text-sm">${wp.name}</div>
                  <div class="text-xs text-gray-600">${weatherData.condition}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-lg font-bold">${weatherData.temp}°F</div>
                <div class="text-xs text-gray-600">${weatherData.wind} mph viento</div>
              </div>
            </div>
          `;
        }
      }
    } else {
      debugLog('Directions request failed:', status);
      mapDiv.innerHTML = '<div class="flex items-center justify-center h-full text-red-600">Error cargando ruta</div>';
    }
  });

  window.routeMapLoaded = true;
  window.routeMap = map;
}

// ========================================
//  FUNCIÓN: Ícono de marker según clima
// ========================================
function getWeatherMarkerIcon(temp, condition) {
  let color = '#3b82f6'; // Azul default

  if (temp <= 32 || condition.toLowerCase().includes('snow')) {
    color = '#60a5fa'; // Azul claro para frío/nieve
  } else if (condition.toLowerCase().includes('rain') || condition.toLowerCase().includes('storm')) {
    color = '#6366f1'; // Índigo para lluvia
  } else if (temp >= 80) {
    color = '#f59e0b'; // Naranja para calor
  }

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: 'white',
    strokeWeight: 2
  };
}

// ========================================
//  FUNCIÓN: Toggle radar layer (RainViewer)
// ========================================
let radarLayer = null;

function toggleRadarLayer() {
  if (!window.routeMap) return;

  const button = document.getElementById('radarToggle');

  if (radarLayer) {
    // Quitar radar
    radarLayer.setMap(null);
    radarLayer = null;
    button.textContent = '📡 Mostrar Radar';
    button.className = 'px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition';
  } else {
    // Agregar radar de RainViewer
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(response => response.json())
      .then(data => {
        // Obtener el frame más reciente
        const lastFrame = data.radar.past[data.radar.past.length - 1];
        const radarUrl = `https://tilecache.rainviewer.com${lastFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

        radarLayer = new google.maps.ImageMapType({
          getTileUrl: function (coord, zoom) {
            return radarUrl.replace('{z}', zoom).replace('{x}', coord.x).replace('{y}', coord.y);
          },
          tileSize: new google.maps.Size(256, 256),
          opacity: 0.6,
          name: 'Radar'
        });

        window.routeMap.overlayMapTypes.push(radarLayer);

        button.textContent = '📡 Ocultar Radar';
        button.className = 'px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition';
      })
      .catch(error => {
        debugLog('Error cargando radar:', error);
        alert('No se pudo cargar el radar');
      });
  }
}

// Exponer funciones globalmente
window.loadRouteMap = loadRouteMap;
window.toggleRadarLayer = toggleRadarLayer;

// Exponer globalmente
window.getWeatherForDestination = getWeatherForDestination;

function getDecisionMode() {
  return (typeof window !== 'undefined' && window.DECISION_MODE) || DECISION_MODE || 'realista2025';
}






//  FUNCION: Calcular tiempo de viaje real
function calcularTiempoReal(millas, speedMph) {
  const speed = speedMph || (VEHICLE_PROFILES[window._userVehicleType] || VEHICLE_PROFILES['van']).speedAvg;
  const paradasCombustible = Math.floor(millas / 300); // parada cada 300mi aprox.
  const tiempoManejo = millas / speed;
  const tiempoParadas = paradasCombustible * 0.5; // 30 min por parada
  const tiempoTotal = tiempoManejo + tiempoParadas;

  return {
    paradas: paradasCombustible,
    horasTotal: tiempoTotal,
    formato: `${Math.floor(tiempoTotal)}h ${Math.round((tiempoTotal % 1) * 60)}m`
  };
}

//  FUNCION: Reglas de decision inteligentes — user-agnostic (4 zonas dinamicas)
async function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
  const { destinoState = '' } = factoresAdicionales;

  // Obtener CPM real del usuario
  const cpmResult = await window.CPMEngine.getCPM();
  const cpm = cpmResult.cpm;

  // Obtener avgRPM y stateStats desde lexProfiles
  let avgRPM = 0;
  let stateStats = {};
  try {
    const uid = window.currentUser?.uid;
    if (uid) {
      const profileSnap = await firebase.firestore()
        .collection('lexProfiles').doc(uid).get();
      if (profileSnap.exists) {
        avgRPM = profileSnap.data().avgRPM || 0;
        stateStats = profileSnap.data().stateStats || {};
        // Cachear para detectTrap en calculator-agent
        window._userStateStats = stateStats;
        window._userCPM = cpm;
      }
    }
  } catch (e) { /* sin historial, usar solo cpm */ }

  // Obtener targetProfit % desde config del usuario
  let targetProfitPct = 0.20; // fallback 20%
  try {
    const uid = window.currentUser?.uid;
    if (uid) {
      const userSnap = await firebase.firestore()
        .collection('users').doc(uid).get();
      if (userSnap.exists) {
        const tp = userSnap.data().targetProfit;
        if (tp && tp > 0) targetProfitPct = tp / 100;
        window._userVehicleType = userSnap.data().vehicleType || userSnap.data().vehicle?.type || 'van';
      }
    }
  } catch (e) { /* usar fallback */ }

  // Calcular thresholds dinamicos
  const targetRPM_margen = cpm / (1 - targetProfitPct);
  const acceptThreshold = targetRPM_margen; // D5: RPM historico solo referencia, no cambia el umbral
  const midThreshold = targetRPM_margen; // D5: RPM historico solo referencia, no cambia el umbral

  // Logica de decision — 4 zonas
  let decision, level, icon, color, razon;

  if (rpm < cpm) {
    decision = 'REJECT';
    level = 'reject';
    icon = '❌';
    color = 'decision-reject';
    const perdida = ((cpm - rpm) * 100).toFixed(1);
    razon = `Losing $${perdida} per 100mi — RPM $${rpm.toFixed(3)} doesn't cover your cost of $${cpm.toFixed(3)}/mi`;

  } else if (rpm >= acceptThreshold) {
    decision = 'ACCEPT';
    level = 'accept';
    icon = '✅';
    color = 'decision-accept';
    const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
    const ganancia100 = ((rpm - cpm) * 100).toFixed(0);
    razon = `Margin ${margenReal}% — earning $${ganancia100} per 100mi`;

  } else if (rpm >= midThreshold) {
    decision = 'ALMOST ACCEPT';
    level = 'warning-high';
    icon = '🟡';
    color = 'decision-warning-high';
    const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
    const falta = ((acceptThreshold - rpm) * 100).toFixed(1);
    razon = `Margin ${margenReal}% — $${falta}¢/100mi short of your target`;

  } else {
    decision = 'EVALUATE';
    level = 'warning-low';
    icon = '🟠';
    color = 'decision-warning-low';
    const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
    razon = `Margin ${margenReal}% — covers costs but below your minimum threshold`;
  }

  // Contexto del estado — solo informa, no cambia decision
  if (destinoState && stateStats[destinoState]?.loads >= 2) {
    const stats = stateStats[destinoState];
    const diff = ((rpm - stats.avgRPM) / stats.avgRPM * 100).toFixed(1);
    const signo = diff >= 0 ? '+' : '';
    razon += ` | ${destinoState}: tu historico $${stats.avgRPM.toFixed(3)}/mi (${signo}${diff}%)`;
  }

  return {
    decision,
    level,
    icon,
    color,
    razon,
    confianza: (level === 'accept' || level === 'reject') ? 'Alta' : 'Media',
    thresholds: { cpm, midThreshold, acceptThreshold, avgRPM, targetProfitPct }
  };
}





//  FUNCION: Generar razones detalladas
function obtenerRazonDetallada(nivel, rpm, millas, factores, razonesEspeciales = []) {
  const categoria = millas <= 400 ? "corta" : millas <= 600 ? "media" : "larga";
  const gananciaEstimada = rpm - TU_COSTO_REAL.TOTAL;
  const gananciaTotal = gananciaEstimada * millas;

  let razon = `Carga ${categoria} (${millas}mi): `;

  if (nivel === "accept") {
    razon += `Excelente RPM $${rpm.toFixed(2)}/mi. Ganancia estimada: $${gananciaTotal.toFixed(0)}`;
  } else if (nivel === "warning") {
    razon += `RPM $${rpm.toFixed(2)}/mi en lmite. Ganancia: $${gananciaTotal.toFixed(0)}`;
    if (razonesEspeciales.length > 0) {
      razon += `. Factores a favor: ${razonesEspeciales.join(", ")}`;
    }
  } else {
    razon += `RPM $${rpm.toFixed(2)}/mi, Muy bajo. Ganancia: $${gananciaTotal.toFixed(0)}`;
    if (gananciaTotal < 50) {
      razon += ". Busca mejor alternativa.";
    }
  }

  return razon;
}


//  FUNCIÓN PRINCIPAL: Calculate con costos reales
let _isCalculating = false;
async function calculate() {
  // Guard: prevenir doble-click
  if (_isCalculating) return;
  _isCalculating = true;

  const calculateBtn = document.getElementById('calculateBtn');

  // Show loading state
  if (calculateBtn) {
    LoadingManager.show(calculateBtn, 'Calculando...');
  }

  try {
    debugLog(" Calculando con costos reales confirmados...");

    // Asegurar que el costo por milla activo (real / config / default) esta cargado
    await refreshActiveCpm();

    // Obtener y sanitizar valores de los campos
    const origin = sanitizeText(document.getElementById('origin')?.value?.trim() || '', 100);
    const destination = sanitizeText(document.getElementById('destination')?.value?.trim() || '', 100);

    // Sanitize numeric inputs with reasonable limits
    debugLog('[DEBUG] RAW VALUES before sanitization:');
    debugLog('  loadedMiles RAW:', document.getElementById('loadedMiles')?.value);
    debugLog('  rpm RAW:', document.getElementById('rpm')?.value);
    debugLog('  rate RAW:', document.getElementById('rate')?.value);

    let loadedMiles = sanitizeNumber(document.getElementById('loadedMiles')?.value, 0, 10000);
    let deadheadMiles = sanitizeNumber(document.getElementById('deadheadMiles')?.value, 0, 5000);
    let rpm = sanitizeNumber(document.getElementById('rpm')?.value, 0, 50);
    let rate = sanitizeNumber(document.getElementById('rate')?.value, 0, 500000);
    const tolls = sanitizeNumber(document.getElementById('tolls')?.value, 0, 10000);
    const others = sanitizeNumber(document.getElementById('otherCosts')?.value, 0, 10000);

    //  Definir totalMiles ANTES de validaciones
    const totalMiles = loadedMiles + deadheadMiles;

    // DEBUG: Log all values before validation
    debugLog('[DEBUG calculate()] Values after sanitization:');
    debugLog('  origin:', origin);
    debugLog('  destination:', destination);
    debugLog('  loadedMiles:', loadedMiles);
    debugLog('  deadheadMiles:', deadheadMiles);
    debugLog('  totalMiles:', totalMiles);
    debugLog('  rpm:', rpm);
    debugLog('  rate:', rate);

    //  Condición mínima antes de mostrar resultados
    if (!origin || !destination || totalMiles <= 0 || (rpm <= 0 && rate <= 0)) {
      debugLog('[DEBUG calculate()] FAILED validation, returning early');
      debugLog('  !origin:', !origin);
      debugLog('  !destination:', !destination);
      debugLog('  totalMiles <= 0:', totalMiles <= 0);
      debugLog('  (rpm <= 0 && rate <= 0):', (rpm <= 0 && rate <= 0));
      hideDecisionPanel();
      if (calculateBtn) LoadingManager.hide(calculateBtn);
      return;
    }

    //  Validaciones suaves
    if (!origin || !destination) {
      debugLog(" Faltan origen/destino, no se ejecuta cálculo.");
      return;
    }
    if (totalMiles <= 0) {
      debugLog(" Millas inválidas, no se ejecuta cálculo.");
      return;
    }

    //  Ajuste de lógica Rate / RPM
    if (rpm > 0 && rate === 0) {
      rate = Math.round(rpm * totalMiles);
    } else if (rate > 0 && totalMiles > 0) {
      rpm = Math.round((rate / totalMiles) * 100) / 100;
    }

    // 🎯 MULTI-STOP: Get all additional stops
    debugLog('[DEBUG] About to call getStops()');
    const stops = getStops();
    debugLog('[DEBUG] getStops() returned:', stops);
    let combinedMiles = totalMiles;
    let combinedRevenue = rate;
    let stopsData = []; // For breakdown display

    if (stops.length > 0) {
      // Add main leg as first stop for display
      stopsData.push({
        from: origin,
        to: destination,
        miles: totalMiles,
        rpm: rpm,
        revenue: rate
      });

      // Add all additional stops  
      let previousDest = destination;
      stops.forEach((stop, index) => {
        combinedMiles += stop.miles;
        combinedRevenue += stop.revenue;

        stopsData.push({
          from: previousDest,
          to: stop.destination,
          miles: stop.miles,
          rpm: stop.rpm,
          revenue: stop.revenue
        });

        previousDest = stop.destination;
      });

      debugLog(`[MULTI-STOP] Total: ${stopsData.length} stops, ${combinedMiles}mi, $${combinedRevenue.toFixed(0)} revenue`);
    }

    // Cálculo de ingresos (usar valores combinados si hay stops)
    debugLog('[DEBUG] Calculating totals...');
    const baseIncome = combinedRevenue;
    // Cobro = tarifa + "otros" (cargos extra que se le cobran al cliente: descarga,
    // esperas, etc. — son INGRESO). Los tolls son un GASTO de la carga, como el
    // combustible. Misma formula que saveLoad() y que la edicion en Historial.
    const totalCharge = baseIncome + others;
    debugLog('[DEBUG] totalCharge:', totalCharge);

    // Use shared expense calculation function — usar combinedMiles (todas las paradas del viaje)
    if (window.SLSFuelPrices) await window.SLSFuelPrices.load();
    const _route = loadRoute(origin, destination, stops.map(s => s.destination));
    window._lastLoadRoute = _route;
    const expenseBreakdown = calculateTotalExpenses(combinedMiles, tolls, _route);
    const { fuelCost, maintenanceCost, foodCost, fixedCosts } = expenseBreakdown;
    const totalExpenses = expenseBreakdown.total;

    const netProfit = totalCharge - totalExpenses;
    const margin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;
    const profitPerMile = combinedMiles > 0 ? netProfit / combinedMiles : 0;
    // RPM sobre la tarifa base (sin tolls/otros), igual que el rpm que se guarda
    const actualRPM = combinedMiles > 0 ? baseIncome / combinedMiles : 0;

    // Actualizar UI principal
    updateMainResults({
      origin, destination, totalMiles: combinedMiles, baseIncome, totalCharge,
      fuelCost, maintenanceCost, foodCost, fixedCosts, tolls, others,
      totalExpenses, netProfit, margin, profitPerMile, actualRPM, rpm, rate
    });

    // Extraer códigos de estado
    let originState = '';
    let destinationState = '';
    if (typeof window.getStateCode === 'function') {
      originState = window.getStateCode(origin) || '';
      destinationState = window.getStateCode(destination) || '';
    }


    // Mostrar panel simplificado

    showDecisionPanel({
      baseIncome, tolls, others, loadedMiles, deadheadMiles,
      totalCharge,
      netProfit,
      profitMargin: margin,
      profitPerMile,
      totalMiles: combinedMiles, // Usar millas combinadas
      actualRPM,
      origin,
      destination,
      originState,
      destinationState,
      stopsData: stopsData // Multi-stop breakdown data
    });

    // 🎯 MULTI-STOP: Poblar breakdown visual si hay paradas
    const roundTripBreakdownEl = document.getElementById('roundTripBreakdown');
    if (roundTripBreakdownEl) {
      if (stopsData.length > 0) {
        // Mostrar breakdown
        roundTripBreakdownEl.classList.remove('hidden');
        roundTripBreakdownEl.innerHTML = ''; // Clear previous content

        // Add each stop
        stopsData.forEach((stop, index) => {
          const stopDiv = document.createElement('div');
          stopDiv.className = 'text-white/90 text-xs';
          const stopLabel = window.i18n?.t('calculator.stop_label') || 'Parada';
          stopDiv.innerHTML = `📍 ${stopLabel} ${index + 1}: ${stop.from} → ${stop.to} | ${stop.miles}mi @ $${stop.rpm.toFixed(2)} = <strong>$${stop.revenue.toFixed(0)}</strong>`;
          roundTripBreakdownEl.appendChild(stopDiv);
        });

        // Add total
        const totalDiv = document.createElement('div');
        totalDiv.className = 'text-white font-semibold border-t border-white/20 pt-1 mt-1 text-xs';
        totalDiv.innerHTML = `💰 Total: ${combinedMiles}mi | $${combinedRevenue.toFixed(0)} revenue | $${netProfit.toFixed(0)} profit`;
        roundTripBreakdownEl.appendChild(totalDiv);
      } else {
        // Ocultar breakdown si no hay paradas adicionales
        roundTripBreakdownEl.classList.add('hidden');
      }
    }


    // Lex listo para ayudar
    if (typeof window.setLexState === 'function') {
      window.setLexState('thinking', {
        message: window.i18n?.t('lex.load_calculated_hint') || 'Carga calculada. Si quieres mi recomendacion, haz clic en mi',
        duration: 6000
      });
    }

    // Actualizar mapa
    updateMap();

    debugLog(" Calculo completado con costos reales");

    // Show success toast
    showToast(window.i18n?.t('calculator.load_calculated_success') || 'Load calculated successfully', 'success', 2000);

  } catch (error) {
    debugLog(' Error en calculo:', error);
    showToast('Error al calcular: ' + error.message, 'error');
  } finally {
    // Always hide loading state and reset guard
    _isCalculating = false;
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      LoadingManager.hide(calculateBtn);
    }
  }
}

// ========================================
//  FUNCIONES AUXILIARES (FUERA DE CALCULATE)
// ========================================

//  Mantener sincronía entre Rate y RPM
let calculateTimeout;
let listenersAdded = false;

function syncRateAndRpm() {
  const loadedMilesEl = document.getElementById('loadedMiles');
  const deadheadMilesEl = document.getElementById('deadheadMiles');
  const rpmEl = document.getElementById('rpm');
  const rateEl = document.getElementById('rate');
  const tripMilesEl = document.getElementById('tripMiles');

  if (!rpmEl || !rateEl || !loadedMilesEl) return;

  // Función para calcular con delay (debounce)
  function triggerCalculate() {
    clearTimeout(calculateTimeout);
    calculateTimeout = setTimeout(() => {
      calculate();
      updateTotalMiles();
    }, 800);
  }

  // Función para actualizar millas totales en pantalla
  function updateTotalMiles() {
    const loadedMiles = Number(loadedMilesEl?.value || 0);
    const deadheadMiles = Number(deadheadMilesEl?.value || 0);
    const totalMiles = loadedMiles + deadheadMiles;

    if (tripMilesEl) {
      tripMilesEl.textContent = totalMiles.toLocaleString();
    }

    return { loadedMiles, totalMiles };
  }

  // Solo agregar listeners UNA VEZ
  if (!listenersAdded) {
    // Cuando cambia RPM → recalcula Rate
    rpmEl.addEventListener("input", () => {
      const { totalMiles } = updateTotalMiles();
      const rpm = parseFloat(rpmEl.value) || 0;

      if (totalMiles > 0 && rpm > 0) {
        rateEl.value = (rpm * totalMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambia Rate → recalcula RPM
    rateEl.addEventListener("input", () => {
      const { totalMiles } = updateTotalMiles();
      const rate = parseFloat(rateEl.value) || 0;

      if (totalMiles > 0 && rate > 0) {
        rpmEl.value = (rate / totalMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambian las millas → actualiza Rate/RPM
    loadedMilesEl.addEventListener("input", () => {
      const { loadedMiles, totalMiles } = updateTotalMiles();

      if (totalMiles > 0) {
        const rpm = parseFloat(rpmEl.value) || 0;
        const rate = parseFloat(rateEl.value) || 0;

        if (rpm > 0) {
          rateEl.value = (rpm * totalMiles).toFixed(2);
        } else if (rate > 0) {
          rpmEl.value = (rate / totalMiles).toFixed(2);
        }
      }
      triggerCalculate();
    });

    deadheadMilesEl?.addEventListener("input", () => {
      updateTotalMiles();
      triggerCalculate();
    });

    // ✅ Tolls y Others recalculan automáticamente
    document.getElementById('tolls')?.addEventListener("input", () => {
      triggerCalculate();
    });

    document.getElementById('otherCosts')?.addEventListener("input", () => {
      triggerCalculate();
    });

    listenersAdded = true;

    // Actualizar millas al iniciar
    updateTotalMiles();
  }
}

//  FUNCIÓN: Actualizar resultados principales
function updateMainResults(data) {
  const updates = {
    tripMiles: data.totalMiles.toLocaleString(),
    baseIncome: '$' + data.baseIncome.toFixed(2),
    additionalCosts: '$' + (data.tolls + data.others).toFixed(2),
    totalCharge: '$' + data.totalCharge.toFixed(2),
    operatingCost: '$' + ((data.maintenanceCost || 0) + (data.foodCost || 0) + (data.fixedCosts || 0)).toFixed(2),
    fuelCost: '$' + data.fuelCost.toFixed(2),
    maintenanceCost: '$' + data.maintenanceCost.toFixed(2),
    tollsCost: '$' + data.tolls.toFixed(2),
    otherCost: '$' + data.others.toFixed(2),
    totalExpenses: '$' + data.totalExpenses.toFixed(2),
    netProfit: '$' + data.netProfit.toFixed(2),
    profitPerMile: '$' + data.profitPerMile.toFixed(2),
    profitMargin: data.margin.toFixed(1) + '%',
    actualRPM: '$' + data.actualRPM.toFixed(2),
    estimatedTime: calcularTiempoReal(data.totalMiles).formato,
    fuelStops: calcularTiempoReal(data.totalMiles).paradas.toString(),
    tripDays: Math.ceil(calcularTiempoReal(data.totalMiles).horasTotal / 11).toString()
  };

  Object.entries(updates).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  updateProfitabilityStatus(data.margin);
}

// Parámetros de decisión por tipo de vehículo
// horasManejoPorDia = horas reales al volante por día (vans: sin logbook, realista 10h; hotshot/boxtruck: HOS 11h pero más breaks)
const VEHICLE_PROFILES = {
  'van':      { shortHopMin: 150, shortHopMinTrap: 250, speedAvg: 60, horasManejoPorDia: 10, minDailyProfit: 100 },
  'hotshot':  { shortHopMin: 300, shortHopMinTrap: 450, speedAvg: 62, horasManejoPorDia: 9,  minDailyProfit: 150 },
  'boxtruck': { shortHopMin: 350, shortHopMinTrap: 500, speedAvg: 58, horasManejoPorDia: 9,  minDailyProfit: 200 },
};
const _DEFAULT_VEHICLE_PROFILE = VEHICLE_PROFILES['van'];
function getVehicleProfile() {
  return VEHICLE_PROFILES[window._userVehicleType] || _DEFAULT_VEHICLE_PROFILE;
}
window.getVehicleProfile = getVehicleProfile;

//  FUNCIÓN: Panel de decisión con header dinámico
function showDecisionPanel(calculationData = {}) {
  const panel = document.getElementById('decisionPanel');

  if (!panel) {
    debugLog("Panel de decisión no encontrado");
    return;
  }

  const {
    totalCharge = 0,
    netProfit = 0,
    totalMiles = 0,
    actualRPM = 0,
    profitMargin = 0,
    profitPerMile = 0,
    origin = '',
    destination = '',
    originState = '',
    destinationState = ''
  } = calculationData;

  // Calcular margin si viene como profitMargin
  const margin = profitMargin || (totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0);

  // ========== DETERMINAR DECISIÓN — user-agnostic ==========
  let decision = 'EVALUATE';
  let decisionClasses = ['decision-header-warning-low'];
  let decisionIcon = '🟠';
  let profitClass = 'profit-section-warning';

  // Thresholds reales del usuario (sincrono desde cache si está disponible)
  // Costo por milla de ESTA carga (gasolina actual, otros por milla, comida por dia)
  const _cpm = (Number(totalMiles) > 0 ? calculateTotalExpenses(totalMiles, 0, window._lastLoadRoute).costPerMile : 0) || window._userCPM || TU_COSTO_REAL.TOTAL;
  const _avgRPM = window._userAvgRPM || 0;
  const _targetProfitPct = ((window.currentUser?.profileData?.targetProfit) || 20) / 100;

  // Vehicle profile — cargo van by default
  const _vp = VEHICLE_PROFILES[window._userVehicleType] || _DEFAULT_VEHICLE_PROFILE;

  // Daily profit — días reales: horas de viaje (vel+paradas) / horas al volante por día
  const _horasViaje = calcularTiempoReal(totalMiles, _vp.speedAvg).horasTotal;
  const _diasInvertidos = Math.max(1, Math.ceil(_horasViaje / _vp.horasManejoPorDia));

  // Si el usuario configuro su sueldo mensual, el objetivo es cubrir costo +
  // el sueldo de los dias que ocupa la carga (reemplaza al margen objetivo).
  // Sin sueldo, margen objetivo como antes.
  //
  // Dias para el sueldo: proporcionales a las horas reales de la carga (minimo
  // 1 dia), no redondeados hacia arriba. Se usa el tiempo de ruta de Google si
  // esta disponible y es coherente con las millas (35-80 mph); si no, la
  // estimacion interna. Una carga de 9-10 h es ~1 dia, no 2.
  const _googleHours = (window.routeDuration && window.routeDuration.totalSeconds > 0)
    ? window.routeDuration.totalSeconds / 3600
    : 0;
  const _googleSpeed = _googleHours > 0 ? totalMiles / _googleHours : 0;
  const _horasSueldo = (_googleSpeed >= 35 && _googleSpeed <= 80)
    ? _googleHours + calcularTiempoReal(totalMiles, _vp.speedAvg).paradas * 0.5
    : _horasViaje;
  const _diasSueldo = Math.max(1, _horasSueldo / _vp.horasManejoPorDia);
  const _diasSueldoTxt = String(Math.round(_diasSueldo * 10) / 10);
  const _payShare = getOwnerPayPerDay() * _diasSueldo;
  const _payPerMile = (_payShare > 0 && totalMiles > 0) ? _payShare / totalMiles : 0;
  const _targetRPM_margen = _payPerMile > 0
    ? _cpm + _payPerMile
    : _cpm / (1 - _targetProfitPct);
  // D5 (aprobado 2026-11-14): el RPM histórico es solo referencia comercial;
  // no sube ni baja los umbrales. La decisión depende del costo y del objetivo.
  // RPM mínimo de Configuración (aprobado 2026-11-13): piso sobre millas totales.
  const _minRPM = Number(window.currentUser?.profileData?.targetRPM) || 0;
  const _acceptThreshold = Math.max(_targetRPM_margen, _minRPM);
  const _midThreshold = _acceptThreshold;
  const _gananciaDia = Math.max(0, netProfit) / _diasInvertidos;
  const _lowDailyProfit = _gananciaDia < _vp.minDailyProfit;

  // Short-hop filter — trap zones raise the minimum (you're still stuck there after)
  const _destinoEsTrampa = !!userTrapInfo(destinationState, _cpm);
  const _shortHopMinimo = _destinoEsTrampa ? _vp.shortHopMinTrap : _vp.shortHopMin;
  const _isShortHop = totalMiles > 0 && totalMiles <= 150 && netProfit < _shortHopMinimo;

  if (actualRPM < _cpm || netProfit < 0) {
    decision = 'REJECT';
    decisionClasses = ['decision-header-reject'];
    decisionIcon = '❌';
    profitClass = 'profit-section-negative';
  } else if (_isShortHop || _lowDailyProfit) {
    decision = 'EVALUATE';
    decisionClasses = ['decision-header-warning-low'];
    decisionIcon = '🟠';
    profitClass = 'profit-section-warning';
  } else if (actualRPM >= _acceptThreshold) {
    decision = 'ACCEPT';
    decisionClasses = ['decision-header-accept', 'pulse-glow-green'];
    decisionIcon = '✅';
    profitClass = 'profit-section-positive';
  } else if (actualRPM >= _midThreshold) {
    decision = 'ALMOST ACCEPT';
    decisionClasses = ['decision-header-warning-high'];
    decisionIcon = '🟡';
    profitClass = 'profit-section-warning';
  } else {
    decision = 'EVALUATE';
    decisionClasses = ['decision-header-warning-low'];
    decisionIcon = '🟠';
    profitClass = 'profit-section-warning';
  }

  window._lastDecisionData = {
    decision, actualRPM, totalMiles, originState, destinationState,
    // Para que Lex muestre la misma ganancia que el panel
    netProfit, totalCharge,
    thresholds: { cpm: _cpm, midThreshold: _midThreshold, acceptThreshold: _acceptThreshold },
    reasons: {
      lowDailyProfit: _lowDailyProfit,
      isShortHop: _isShortHop,
      gananciaDia: Math.round(_gananciaDia),
      minDailyProfit: _vp.minDailyProfit,
      diasInvertidos: _diasInvertidos
    }
  };

  // F2: comparar solo en cuentas de prueba; apagado por defecto y sin UI/Firebase.
  if (window.SLSF2Runtime?.active() && window.SLSF2Runtime.current() &&
      window.SLSShadowF2?.isEnabled(window.currentUser, window.SLS_F2_TEST_ENABLED)) {
    try {
      if (Array.isArray(calculationData.stopsData) && calculationData.stopsData.length > 1) {
        console.debug('[SmartLoad F2] multistop sin adaptador: no comparable');
      } else {
        const _shadowCosts = getUsersCosts();
        const _shadowCpm = window.SLSF2Runtime.current();
        window.SLSShadowF2.compare({
          entradas: {
            tarifa: calculationData.baseIncome, extrasConfirmados: calculationData.others,
            tollCarga: calculationData.tolls,
            millasCargadas: calculationData.loadedMiles, millasDeadhead: calculationData.deadheadMiles
          },
          supuestos: {
            configuracionCompleta: _shadowCpm.etapa !== 'A',
            cpmBase: _shadowCpm.cpmAplicado,
            combustiblePorMilla: _shadowCosts.combustible,
            cpmFuente: _shadowCpm.fuente,
            sueldoPorDia: getOwnerPayPerDay(), diasCarga: _diasSueldo,
            margenObjetivo: _targetProfitPct, rpmMinimo: Number(window.currentUser?.profileData?.targetRPM ?? 0),
            rpmPromedioHistorico: _avgRPM
          },
          legacy: { decision, netProfit }
        }, window.FinancialEngine, console.debug.bind(console));
      }
    } catch (_shadowError) {
      console.debug('[SmartLoad F2] comparacion omitida:', String(_shadowError.message || _shadowError));
    }
  }

  const titleEl = document.getElementById('decisionTitle');
  const routeEl = document.getElementById('decisionRoute');
  const iconEl = document.getElementById('decisionIcon');

  if (titleEl) {
    const _decisionKeyMap = { 'ACCEPT': 'decision_accept', 'REJECT': 'decision_reject', 'ALMOST ACCEPT': 'decision_almost', 'EVALUATE': 'decision_evaluate' };
    const _decisionKey = _decisionKeyMap[decision];
    titleEl.setAttribute('data-decision', decision); // store EN value for DOM checks
    if (_decisionKey) titleEl.setAttribute('data-i18n', 'calculator.' + _decisionKey);
    titleEl.textContent = (_decisionKey && window.i18n?.t('calculator.' + _decisionKey)) || decision;
  }
  if (iconEl) iconEl.textContent = decisionIcon;
  if (routeEl && origin && destination) {
    routeEl.textContent = `${origin} → ${destination} • ${totalMiles.toFixed(0)} mi`;
  }

  // ========== ACTUALIZAR MÉTRICAS ==========
  const quickPrice = document.getElementById('quickPrice');
  const quickRPM = document.getElementById('quickRPM');
  const quickNetProfit = document.getElementById('quickNetProfit');
  const quickMargin = document.getElementById('quickMargin');
  const quickProfitPerMile = document.getElementById('quickProfitPerMile');

  if (quickPrice) quickPrice.textContent = `$${Math.round(totalCharge).toLocaleString()}`;
  if (quickRPM) quickRPM.textContent = `$${actualRPM.toFixed(2)}`;
  if (quickNetProfit) quickNetProfit.textContent = `$${Math.round(netProfit).toLocaleString()}`;
  if (quickMargin) quickMargin.textContent = `${margin.toFixed(1)}%`;
  if (quickProfitPerMile) quickProfitPerMile.textContent = `$${profitPerMile.toFixed(2)}`;

  // ========== CREAR BADGES DINÁMICOS ==========
  const badgesContainer = document.getElementById('decisionBadges');
  if (badgesContainer) {
    let badgesHTML = '';

    // Badge de estado destino — desde historial real del usuario
    if (destinationState) {
      const _stateStats = window._userStateStats || {};
      if (_stateStats[destinationState]?.loads >= 2) {
        const stats = _stateStats[destinationState];
        const diff = ((actualRPM - stats.avgRPM) / stats.avgRPM * 100).toFixed(1);
        const signo = diff >= 0 ? '+' : '';
        const badgeColor = parseFloat(diff) >= 0
          ? 'bg-green-600/30 border border-green-400/40'
          : 'bg-yellow-600/30 border border-yellow-400/40';
        badgesHTML += `<span class="${badgeColor} px-2 md:px-3 py-1 rounded-full backdrop-blur whitespace-nowrap">📍 ${destinationState}: ${signo}${diff}% vs avg</span>`;
      } else if (originState && destinationState) {
        badgesHTML += `<span class="px-2 md:px-3 py-1 rounded-full backdrop-blur whitespace-nowrap">🗺️ ${originState} → ${destinationState}</span>`;
      }
    }

    // Badge de tiempo estimado - use real duration from Google Maps if available
    let estimatedTime;
    if (window.routeDuration && window.routeDuration.hours !== undefined) {
      // Use real duration from Google Maps
      estimatedTime = `${window.routeDuration.hours}h ${window.routeDuration.minutes}m`;
    } else {
      // Fallback to estimation if not available
      estimatedTime = totalMiles > 0 ? `${Math.floor(totalMiles / _vp.speedAvg)}h ${Math.round((totalMiles / _vp.speedAvg % 1) * 60)}m` : '0h';
    }
    badgesHTML += `<span class="px-2 md:px-3 py-1 rounded-full backdrop-blur whitespace-nowrap">⏱️ ${estimatedTime}</span>`;

    // Badge de clima (se actualizará con API) - ESTILO DISTINTIVO CON !important
    badgesHTML += `<span id="weatherBadge" class="px-3 py-1.5 rounded-full font-semibold whitespace-nowrap cursor-pointer" onclick="showWeatherModal('${destination}')" style="background: linear-gradient(to right, #38bdf8, #3b82f6) !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 2px solid rgba(255,255,255,0.5); text-shadow: 0 1px 2px rgba(0,0,0,0.2);">🌤️ Loading...</span>`;

    badgesContainer.innerHTML = badgesHTML;
  }

  // ========== ACTUALIZAR COSTOS ==========
  const tolls = Number(document.getElementById('tolls')?.value || 0);
  const others = Number(document.getElementById('otherCosts')?.value || 0);
  const _exp = calculateTotalExpenses(totalMiles, tolls, window._lastLoadRoute);
  window._lastLoadExp = _exp;
  const fuelCost = _exp.fuelCost;

  if (document.getElementById('totalMilesForFuel')) {
    document.getElementById('totalMilesForFuel').textContent = totalMiles.toFixed(0);
  }
  if (document.getElementById('fuelCost')) {
    document.getElementById('fuelCost').textContent = `$${fuelCost.toFixed(2)}`;
  }
  if (document.getElementById('tollsAndOthers')) {
    // Solo tolls: "otros" es un cargo extra al cliente (ingreso), no un gasto
    document.getElementById('tollsAndOthers').textContent = `$${tolls.toFixed(2)}`;
  }

  const fixedCostsValue = _exp.maintenanceCost + _exp.foodCost + _exp.fixedCosts;
  if (document.getElementById('fixedCosts')) {
    document.getElementById('fixedCosts').textContent = `$${fixedCostsValue.toFixed(2)}`;
  }

  const totalExp = fuelCost + tolls + fixedCostsValue; // misma formula que calculate() y saveLoad()

  // Indicar de donde sale el costo por milla (real / configuracion / promedio)
  const _cpmNoteEl = document.getElementById('cpmSourceNote');
  if (_cpmNoteEl) {
    const _info = getActiveCpmInfo();
    const _fallbackText = {
      real: 'Cost per mile: your real expenses',
      config: 'Cost per mile: estimate from your Settings',
      default: 'Cost per mile: industry average — set up your costs'
    }[_info.source];
    const _text = window.i18n?.t('calculator.cpm_source_' + _info.source) || _fallbackText;
    const _isEs = (window.i18n?.currentLang || 'en') === 'es';
    _cpmNoteEl.textContent = `${_text} · $${(_exp.costPerMile || _info.cpm).toFixed(3)}/mi ${_isEs ? 'en esta carga' : 'on this load'}`;
    const _fuelAge = fuelPriceAgeDays();
    if (_exp.fuelRoute) {
      const _fr = _exp.fuelRoute;
      _cpmNoteEl.textContent += _isEs
        ? ` · ${_fr.fuelType === 'diesel' ? 'Diésel' : 'Gasolina'} $${_fr.price.toFixed(2)}/gal (promedio de tu ruta, EIA ${_fr.period || ''})`
        : ` · ${_fr.fuelType === 'diesel' ? 'Diesel' : 'Gasoline'} $${_fr.price.toFixed(2)}/gal (your route average, EIA ${_fr.period || ''})`;
    } else if (_info.source !== 'default' && (_fuelAge === null || _fuelAge > 30)) {
      _cpmNoteEl.textContent += _isEs
        ? (_fuelAge === null ? ' · Actualiza el precio de la gasolina en Configuración' : ` · Precio de gasolina de hace ${_fuelAge} días: actualízalo en Configuración`)
        : (_fuelAge === null ? ' · Update the fuel price in Settings' : ` · Fuel price is ${_fuelAge} days old: update it in Settings`);
    }
  }
  renderCpmBreakdown();
  if (document.getElementById('totalExpenses')) {
    document.getElementById('totalExpenses').textContent = `$${totalExp.toFixed(2)}`;
  }

  // ========== ACTUALIZAR GANANCIA ==========
  const profitSection = document.getElementById('profitSection');
  if (profitSection) {
    profitSection.className = 'border-2 rounded-lg p-3 md:p-4';
    profitSection.classList.add(profitClass);
  }

  if (document.getElementById('profitLabel')) {
    const _profitKey = netProfit >= 0 ? 'net_profit_label' : 'net_loss_label';
    document.getElementById('profitLabel').setAttribute('data-i18n', 'calculator.' + _profitKey);
    document.getElementById('profitLabel').textContent = window.i18n?.t('calculator.' + _profitKey) || (netProfit >= 0 ? '💰 Net Profit' : '💀 Net Loss');
  }

  if (document.getElementById('netProfit')) {
    document.getElementById('netProfit').textContent = netProfit >= 0
      ? `$${netProfit.toFixed(2)}`
      : `-$${Math.abs(netProfit).toFixed(2)}`;
  }

  if (document.getElementById('profitDetails')) {
    const _marginWord = window.i18n?.t('calculator.margin_short') || 'margin';
    const _detailsEl = document.getElementById('profitDetails');
    _detailsEl.setAttribute('data-profit-per-mile', profitPerMile.toFixed(2));
    _detailsEl.setAttribute('data-margin', margin.toFixed(1));
    _detailsEl.setAttribute('data-ganancia-dia', Math.round(_gananciaDia));
    _detailsEl.textContent = `$${profitPerMile.toFixed(2)}/mi • ${margin.toFixed(1)}% ${_marginWord} • ~$${Math.round(_gananciaDia)}/day`;
  }

  // Linea aparte: lo que queda despues del sueldo del dueño (si lo configuro).
  // No cambia la ganancia mostrada ni la que se guarda con la carga.
  const _afterPayEl = document.getElementById('afterPayNote');
  if (_afterPayEl) {
    if (_payShare > 0) {
      const _afterPay = netProfit - _payShare;
      const _label = window.i18n?.t('calculator.after_pay_label') || 'After your pay';
      const _amount = _afterPay >= 0 ? `$${_afterPay.toFixed(2)}` : `-$${Math.abs(_afterPay).toFixed(2)}`;
      const _daysWord = (window.i18n?.currentLang || 'en') === 'es' ? 'día(s)' : 'day(s)';
      _afterPayEl.textContent = `${_label} (${_diasSueldoTxt} ${_daysWord}, $${_payShare.toFixed(0)}): ${_amount}`;
      _afterPayEl.style.display = '';
    } else {
      _afterPayEl.textContent = '';
      _afterPayEl.style.display = 'none';
    }
  }

  // Tiempo y paradas - use real duration from Google Maps if available
  let estimatedTime;
  if (window.routeDuration && window.routeDuration.hours !== undefined) {
    estimatedTime = `${window.routeDuration.hours}h ${window.routeDuration.minutes}m`;
  } else {
    const _estH = totalMiles / _vp.speedAvg;
    estimatedTime = totalMiles > 0 ? `${Math.floor(_estH)}h ${Math.round((_estH % 1) * 60)}m` : '0h';
  }
  const fuelStops = Math.floor(totalMiles / 300); // parada al llegar a 300mi, no antes

  if (document.getElementById('estimatedTimeShort')) {
    document.getElementById('estimatedTimeShort').textContent = `⏱️ ${estimatedTime}`;
  }

  if (document.getElementById('fuelStopsShort')) {
    const _stopsWord = window.i18n?.t('calculator.stops_short') || 'stops';
    const _stopsEl = document.getElementById('fuelStopsShort');
    _stopsEl.setAttribute('data-fuel-stops', fuelStops);
    _stopsEl.textContent = `⛽ ${fuelStops} ${_stopsWord}`;
  }

  // Mostrar panel
  panel.classList.remove('hidden');

  // Colorear metric cards según decisión
  setTimeout(() => {
    const metricCards = document.querySelectorAll('#decisionPanel div.backdrop-blur');
    const _decisionVal = document.getElementById('decisionTitle')?.getAttribute('data-decision') || '';
    const isReject = _decisionVal === 'REJECT';
    const isEvalua = _decisionVal === 'EVALUATE';
    const isCasiAcepta = _decisionVal === 'ALMOST ACCEPT';
    const isAccept = _decisionVal === 'ACCEPT';
    const bg = isAccept ? 'rgba(34, 197, 94, 0.25)' :   // 🟢 Verde
      isCasiAcepta ? 'rgba(234, 179, 8, 0.25)' :   // 🟡 Amarillo
        isEvalua ? 'rgba(251, 146, 60, 0.25)' :   // 🟠 Naranja
          'rgba(239, 68, 68, 0.25)';                    // 🔴 Rojo
    const border = isAccept ? '1px solid rgba(34, 197, 94, 0.5)' :
      isCasiAcepta ? '1px solid rgba(234, 179, 8, 0.5)' :
        isEvalua ? '1px solid rgba(251, 146, 60, 0.5)' :
          '1px solid rgba(239, 68, 68, 0.5)';
    metricCards.forEach(card => {
      card.style.setProperty('background', bg, 'important');
      card.style.setProperty('border', border, 'important');
    });
  }, 100);

  // Destacar panel principal con glow según decisión
  setTimeout(() => {
    const decisionPanel = document.querySelector('#decisionPanel > div.decision-panel');
    if (!decisionPanel) return;
    const _decisionVal2 = document.getElementById('decisionTitle')?.getAttribute('data-decision') || '';
    const isReject = _decisionVal2 === 'REJECT';
    const isEvalua = _decisionVal2 === 'EVALUATE';
    const isCasiAcepta = _decisionVal2 === 'ALMOST ACCEPT';
    const isAccept = _decisionVal2 === 'ACCEPT';

    const glow = isAccept ? '0 0 40px rgba(34, 197, 94, 0.4), 0 8px 32px rgba(0,0,0,0.8)' :
      isCasiAcepta ? '0 0 40px rgba(234, 179, 8, 0.4), 0 8px 32px rgba(0,0,0,0.8)' :
        isEvalua ? '0 0 40px rgba(251, 146, 60, 0.4), 0 8px 32px rgba(0,0,0,0.8)' :
          '0 0 40px rgba(239, 68, 68, 0.4), 0 8px 32px rgba(0,0,0,0.8)';

    const borderColor = isAccept ? 'rgba(34, 197, 94, 0.6)' :
      isCasiAcepta ? 'rgba(234, 179, 8, 0.6)' :
        isEvalua ? 'rgba(251, 146, 60, 0.6)' :
          'rgba(239, 68, 68, 0.6)';

    decisionPanel.style.setProperty('box-shadow', glow, 'important');
    decisionPanel.style.setProperty('border', `2px solid ${borderColor}`, 'important');
    decisionPanel.style.setProperty('transform', 'scale(1.01)', 'important');
  }, 150);

  // Centrar y colorear sección de Ganancia Neta
  setTimeout(() => {
    const profit = document.querySelector('#decisionPanel #profitSection') || document.querySelector('#profitSection');
    if (!profit) return;
    profit.style.setProperty('display', 'flex', 'important');
    profit.style.setProperty('flex-direction', 'column', 'important');
    profit.style.setProperty('justify-content', 'center', 'important');
    // Detectar si fondo es claro u oscuro
    const profitBg = window.getComputedStyle(profit).backgroundColor;
    const isLightBg = profitBg.includes('rgba(0, 0, 0, 0)') ||
      profitBg.includes('rgb(2') ||
      profitBg.includes('rgb(1');
    const textColor = isLightBg ? '#1a1a1a' : '#ffffff';
    // Pérdida en rojo; ganancia en verde (o dorado sobre fondo oscuro)
    const amountColor = netProfit < 0
      ? (isLightBg ? '#b91c1c' : '#f87171')
      : (isLightBg ? '#166534' : '#FFD700');

    profit.querySelectorAll('*').forEach(el => {
      el.style.setProperty('color', textColor, 'important');
    });
    const amount = profit.querySelector('#netProfit');
    if (amount) amount.style.setProperty('color', amountColor, 'important');

    // Agrandar textos solo en desktop
    if (window.innerWidth >= 768) {
      if (amount) amount.style.setProperty('font-size', '2.5rem', 'important');
      const label = profit.querySelector('#profitLabel, .text-xs, .text-sm');
      if (label) label.style.setProperty('font-size', '0.85rem', 'important');
      const subtext = profit.querySelectorAll('p, div, span');
      subtext.forEach(el => {
        if (el.textContent.includes('/mi') || el.textContent.includes('margin')) {
          el.style.setProperty('font-size', '0.9rem', 'important');
        }
      });
    }
  }, 200);

  // ========== 💡 SUGERENCIA DE CONTRAOFERTA ==========
  // Visible solo cuando el operador debería negociar (no ACCEPT)
  const _coBlock = document.getElementById('counterOfferBlock');
  if (_coBlock) {
    if (decision === 'ACCEPT') {
      // Carga ya es buena — ocultar panel de sugerencia
      _coBlock.classList.add('hidden');
    } else {
      // Calcular las 3 tasas clave usando valores reales del usuario
      const _breakevenRate  = Math.ceil(_cpm * totalMiles);                      // Piso: cubre costos exacto
      const _targetRate     = Math.ceil(_acceptThreshold * totalMiles);          // Target: margen objetivo
      const _idealRate      = Math.ceil(_acceptThreshold * totalMiles * 1.08);   // Contraoferta: +8% sobre target

      // Actualizar los 3 valores en el panel
      const _coBreakevenEl = document.getElementById('coBreakeven');
      const _coTargetEl    = document.getElementById('coTarget');
      const _coIdealEl     = document.getElementById('coIdeal');
      const _coDetailEl    = document.getElementById('counterOfferDetail');
      const _coTitleEl     = document.getElementById('counterOfferTitle');

      if (_coBreakevenEl) _coBreakevenEl.textContent = `$${_breakevenRate.toLocaleString()}`;
      if (_coTargetEl)    _coTargetEl.textContent    = `$${_targetRate.toLocaleString()}`;
      if (_coIdealEl)     _coIdealEl.textContent     = `$${_idealRate.toLocaleString()}`;

      // Detalle contextual según la decisión
      const _lang = window.i18n?.currentLang || 'en';
      const _gapAmount = _targetRate - Math.round(totalCharge);
      const _targetPctLabel = Math.round(_targetProfitPct * 100);

      if (_coDetailEl) {
        if (decision === 'REJECT') {
          _coDetailEl.textContent = _lang === 'es'
            ? `Esta carga pierde dinero. Necesitas mínimo $${_breakevenRate.toLocaleString()} para cubrir costos. Contraoferta en $${_idealRate.toLocaleString()} o rechaza.`
            : `This load loses money. You need at least $${_breakevenRate.toLocaleString()} to cover costs. Counter at $${_idealRate.toLocaleString()} or pass.`;
        } else {
          // Misma regla que el semaforo: con sueldo configurado, el objetivo
          // es costo + sueldo de los dias de la carga; sin sueldo, el margen.
          if (_payShare > 0) {
            _coDetailEl.textContent = _lang === 'es'
              ? `Para cubrir tus costos y tu sueldo de ${_diasSueldoTxt} día(s) ($${Math.round(_payShare).toLocaleString()}), necesitas $${_targetRate.toLocaleString()} (faltan $${_gapAmount.toLocaleString()}). Sugiere $${_idealRate.toLocaleString()} y negocia.`
              : `To cover your costs and your pay for ${_diasSueldoTxt} day(s) ($${Math.round(_payShare).toLocaleString()}), you need $${_targetRate.toLocaleString()} ($${_gapAmount.toLocaleString()} short). Counter at $${_idealRate.toLocaleString()} and negotiate.`;
          } else {
            _coDetailEl.textContent = _lang === 'es'
              ? `Para tu margen objetivo de ${_targetPctLabel}%, necesitas $${_targetRate.toLocaleString()} (faltan $${_gapAmount.toLocaleString()}). Sugiere $${_idealRate.toLocaleString()} y negocia.`
              : `For your ${_targetPctLabel}% target margin, you need $${_targetRate.toLocaleString()} ($${_gapAmount.toLocaleString()} short). Counter at $${_idealRate.toLocaleString()} and negotiate.`;
          }
        }
      }

      // Cambiar color del bloque según severidad
      const _coInner = document.getElementById('counterOfferInner');
      if (_coInner) {
        if (decision === 'REJECT') {
          _coInner.style.borderColor = 'rgba(239,68,68,0.5)';
          _coInner.style.background  = 'rgba(239,68,68,0.08)';
          if (_coTitleEl) { _coTitleEl.style.color = '#f87171'; }
        } else {
          _coInner.style.borderColor = 'rgba(251,146,60,0.4)';
          _coInner.style.background  = 'rgba(251,146,60,0.08)';
          if (_coTitleEl) { _coTitleEl.style.color = '#fb923c'; }
        }
      }

      _coBlock.classList.remove('hidden');
    }
  }

  debugLog(`✅ Panel mostrado: ${decision} - RPM $${actualRPM.toFixed(2)}/mi - Ganancia $${Math.round(netProfit)}`);

  // ========== NOTIFICAR A LEX PROACTIVO ==========
  // Lex escucha este evento para mostrar burbuja contextual sin que el usuario abra el chat
  document.dispatchEvent(new CustomEvent('lexDecisionChanged', {
    detail: {
      decision,
      actualRPM,
      netProfit,
      totalMiles,
      origin,
      destination,
      originState,
      destinationState,
      thresholds: { cpm: _cpm, midThreshold: _midThreshold, acceptThreshold: _acceptThreshold },
      lowDailyProfit: _lowDailyProfit,
      isShortHop: _isShortHop
    }
  }));

  // ========== ANALIZAR CON LEX AUTOMÁTICAMENTE ==========
  if (typeof window.analyzeLexLoad === 'function') {
    setTimeout(() => {
      debugLog("[LEX] Ejecutando análisis automático al mostrar panel...");
      window.analyzeLexLoad();
    }, 500); // Pequeño delay para que la UI respire
  }

  // ========== NOTAS + HISTORIAL + DÍA ==========
  (async () => {
    try {
      const uid = window.currentUser?.uid;
      if (!uid || !destination) return;
      const infoContainer = document.getElementById('decisionExtraInfo');
      if (!infoContainer) return;

      let html = '';

      const _t = (k, p) => window.i18n?.t(k, p) || k;

      // Low daily profit warning — buen RPM pero ganancia diaria insuficiente
      if (_lowDailyProfit && !_isShortHop && netProfit >= 0) {
        html += `<div class="decision-info-block">
          <div class="decision-info-label">📉 ${_t('calculator.low_daily_profit_label') || 'Low Daily Profit'}</div>
          <div class="decision-info-text">${_t('calculator.low_daily_profit_detail') || `Only ~$${Math.round(_gananciaDia)}/day for ${_diasInvertidos} day(s) invested. Min recommended: $${_vp.minDailyProfit}/day`}</div>
        </div>`;
      }

      // Short-hop warning
      if (_isShortHop) {
        html += `<div class="decision-info-block">
          <div class="decision-info-label">⚠️ ${_t('calculator.short_hop_label') || 'Short Hop'}</div>
          <div class="decision-info-text">${_t('calculator.short_hop_detail') || `Good RPM but only $${netProfit.toFixed(0)} net for a full day of work. (Min: $${_shortHopMinimo})`}</div>
        </div>`;
      }

      // Trap penalty — auto-trigger si el destino es zona trampa
      if (_destinoEsTrampa && destinationState) {
        const _trap = analizarTrapPenalty(originState, destinationState, totalMiles, actualRPM, _cpm);
        if (_trap?.esTrampa) {
          const _isEsT = (window.i18n?.currentLang || 'en') === 'es';
          html += `<div class="decision-info-block">
            <div class="decision-info-label">🪤 ${_isEsT ? 'Zona difícil de salir' : 'Hard-to-leave zone'} — ${destinationState}</div>
            <div class="decision-info-text">${_isEsT
              ? `Tus ${_trap.cargasSalida} cargas saliendo de ${destinationState} pagaron <strong>$${_trap.rpmSalida.toFixed(2)}/mi</strong> de promedio. Esta carga más una de salida típica (~${_trap.millasSalida} mi): <strong>$${_trap.rpmRealCiclo.toFixed(2)}/mi</strong>, ganancia del ciclo $${Math.round(_trap.gananciaCiclo)}.`
              : `Your ${_trap.cargasSalida} loads leaving ${destinationState} paid <strong>$${_trap.rpmSalida.toFixed(2)}/mi</strong> on average. This load plus a typical outbound one (~${_trap.millasSalida} mi): <strong>$${_trap.rpmRealCiclo.toFixed(2)}/mi</strong>, cycle profit $${Math.round(_trap.gananciaCiclo)}.`}</div>
          </div>`;
        }
      }

      // Counter-offer — solo cuando el RPM es el factor limitante (no cuando es ganancia diaria baja)
      const _rpmEsElProblema = actualRPM < _acceptThreshold;
      if (_rpmEsElProblema && (decision === 'ALMOST ACCEPT' || decision === 'EVALUATE') && !_isShortHop) {
        const _targetTotal = Math.ceil(_acceptThreshold * totalMiles);
        html += `<div class="decision-info-block">
          <div class="decision-info-label">💬 ${_t('calculator.counter_offer_label') || 'Counter-offer'}</div>
          <div class="decision-info-text">${_t('calculator.counter_offer_ask') || 'Ask for'} <strong>$${_acceptThreshold.toFixed(2)}/mi ($${_targetTotal.toLocaleString()} ${_t('calculator.total_label') || 'total'})</strong> ${_t('calculator.counter_offer_reason') || 'to hit your threshold'}</div>
        </div>`;
      }

      // Notas para el precio (lugar + viajes anteriores); tambien las usa Lex
      let _placeNotesDest = [], _placeNotesOrig = [], _tripNotes = [];
      const _escN = (t) => String(t || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      window._lastLoadNotes = { destination: destinationState || '', origin: originState || '', place: [], trips: [] };

      // 2) Notas de origen y destino — el usuario marca cada nota "Como Destino",
      // "Como Origen" o "Ambos" al guardarla (ver app.html #noteZoneType), asi que
      // hay que comparar cada lado por separado en vez de solo contra destination.
      // Try/catch propio: si esta consulta falla, no debe tumbar el historial ni
      // la nota del dia que vienen despues (antes compartian un solo try/catch).
      try {
        const destKey = destination.toLowerCase().replace(/,.*$/, '').trim();
        const destKeyFull = destination.toLowerCase().trim();
        const origKey = origin.toLowerCase().replace(/,.*$/, '').trim();
        const origKeyFull = origin.toLowerCase().trim();
        const notesSnap = await window.db.collection('notes')
          .where('userId', '==', uid).get();
        const matches = (k, key, keyFull) => k.includes(key) || key.includes(k) || k.includes(keyFull);
        let notasDestino = [];
        let notasOrigen = [];
        notesSnap.forEach(doc => {
          const d = doc.data();
          const k = (d.key || '').toLowerCase().trim();
          // Notas guardadas antes de que existiera #noteZoneType no tienen `type` --
          // se comportaban como "destino" (unico lado que se comparaba antes de este
          // fix), asi que sin type se tratan igual para no romper notas viejas.
          const t = d.type || 'destino';
          if ((t === 'destino' || t === 'ambos') && destKey && matches(k, destKey, destKeyFull)) {
            notasDestino.push(d);
          }
          if ((t === 'origen' || t === 'ambos') && origKey && matches(k, origKey, origKeyFull)) {
            notasOrigen.push(d);
          }
        });
        const typeBadge = { destino: '🔵', origen: '🟢', ambos: '🟣' };
        const renderNotas = (notas) => notas.map(n => {
          const badge = typeBadge[n.type] || '🔵';
          return `<div style="margin-bottom:6px">${badge} ${n.note}</div>`;
        }).join('');
        _placeNotesDest = notasDestino;
        _placeNotesOrig = notasOrigen;
      } catch (err) {
        debugLog('Error cargando notas del panel de decision:', err);
      }

      // 3) Historial de la ruta
      try {
        if (originState && destinationState) {
          const histSnap = await window.db.collection('loads')
            .where('userId', '==', uid)
            .where('originState', '==', originState)
            .where('destinationState', '==', destinationState)
            .orderBy('createdAt', 'desc')
            .limit(10).get();
          if (!histSnap.empty) {
            const cargas = [];
            histSnap.forEach(doc => cargas.push(doc.data()));
            const rpms = cargas.map(c => c.rpm || c.actualRPM || 0).filter(r => r > 0);
            const avgRPM = rpms.reduce((a, b) => a + b, 0) / rpms.length;
            const maxRPM = Math.max(...rpms);
            const minRPM = Math.min(...rpms);
            html += `<div class="decision-info-block decision-info-hist">
              <div class="decision-info-label">📈 ${_t('calculator.hist_label')} ${originState} → ${destinationState} (${cargas.length} ${cargas.length === 1 ? _t('calculator.hist_load_singular') : _t('calculator.hist_loads')})</div>
              <div class="decision-info-text">
                ${_t('calculator.hist_avg')}: <strong>$${avgRPM.toFixed(2)}/mi</strong> · ${_t('calculator.hist_best')}: <strong>$${maxRPM.toFixed(2)}</strong> · ${_t('calculator.hist_min')}: $${minRPM.toFixed(2)}
                ${actualRPM < avgRPM
                ? `<br><span style="color:#fbbf24">⚠️ ${_t('calculator.hist_below_avg', { diff: (avgRPM - actualRPM).toFixed(2) })}</span>`
                : `<br><span style="color:#4ade80">✓ ${_t('calculator.hist_within_range')}</span>`}
              </div>
            </div>`;
          }
        }
      } catch (err) {
        debugLog('Error cargando historial de ruta del panel de decision:', err);
      }

      // 3b) Notas de viajes anteriores al mismo destino (campo "Notas" de cada carga)
      try {
        if (destinationState) {
          const tripSnap = await window.db.collection('loads')
            .where('userId', '==', uid)
            .where('destinationState', '==', destinationState)
            .limit(50).get();
          tripSnap.forEach(doc => {
            const d = doc.data();
            const n = String(d.notes || '').trim();
            if (n) _tripNotes.push({ date: d.date || '', origin: (d.origin || '').split(',')[0], destination: (d.destination || '').split(',')[0], note: n });
          });
          _tripNotes.sort((a, b) => String(b.date).localeCompare(String(a.date)));
          _tripNotes = _tripNotes.slice(0, 5);
        }
      } catch (err) {
        debugLog('Error cargando notas de viajes anteriores:', err);
      }

      // Bloque unico: todo lo que conviene tener en cuenta al dar el precio
      {
        const _isEsN = (window.i18n?.currentLang || 'en') === 'es';
        const typeBadge = { destino: '🔵', origen: '🟢', ambos: '🟣' };
        const placeRows = [..._placeNotesDest.map(n => ({ n, where: destinationState || destination.split(',')[0] })),
                           ..._placeNotesOrig.map(n => ({ n, where: originState || origin.split(',')[0] }))];
        window._lastLoadNotes.place = placeRows.map(r => `${r.where}: ${r.n.note}`);
        window._lastLoadNotes.trips = _tripNotes.map(t => `${t.date} ${t.origin} → ${t.destination}: ${t.note}`);
        if (placeRows.length || _tripNotes.length) {
          const placeHtml = placeRows.map(r => `<div style="margin-bottom:6px">${typeBadge[r.n.type] || '🔵'} <strong>${_escN(r.where)}:</strong> ${_escN(r.n.note)}</div>`).join('');
          const tripHtml = _tripNotes.map(t => `<div style="margin-bottom:6px">🚚 <span style="opacity:.75">${_escN(t.date)} · ${_escN(t.origin)} → ${_escN(t.destination)}:</span> ${_escN(t.note)}</div>`).join('');
          html += `<div class="decision-info-block decision-info-nota">
            <div class="decision-info-label">📝 ${_isEsN ? 'Tenlo en cuenta al dar el precio' : 'Keep in mind when quoting'}</div>
            <div class="decision-info-text">${placeHtml}${tripHtml}
              <div style="margin-top:4px;opacity:.75;font-size:12px">${_isEsN
                ? 'Si alguna nota habla de esperas, muelles difíciles o poca carga de salida, úsala para pedir más. Lex te ayuda con la frase para el dispatcher.'
                : 'If a note mentions waiting time, difficult docks or few outbound loads, use it to ask for more. Lex can help with the line for the dispatcher.'}</div>
            </div>
          </div>`;
        }
      }

      // 4) Día y hora (sin I/O, no necesita su propio try/catch)
      const now = new Date();
      const _dayKeys = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'];
      const hora = now.getHours();
      const momentoStr = hora < 12 ? _t('calculator.time_am') : hora < 18 ? _t('calculator.time_pm') : _t('calculator.time_night');
      const esFinSemana = now.getDay() === 0 || now.getDay() === 6;
      const notaDia = esFinSemana
        ? `⚠️ ${_t('calculator.note_weekend')}`
        : now.getDay() <= 3
          ? `✓ ${_t('calculator.note_start_week')}`
          : `→ ${_t('calculator.note_thu_fri')}`;
      html += `<div class="decision-info-block">
        <div class="decision-info-label">📅 ${_t('calculator.' + _dayKeys[now.getDay()])} ${momentoStr}</div>
        <div class="decision-info-text">${notaDia}</div>
      </div>`;

      infoContainer.innerHTML = html;
      infoContainer.classList.remove('hidden');
    } catch (err) {
      debugLog('Error info extra panel:', err);
    }
  })();

  // Obtener clima del destino (async)
  if (destination && typeof window.getWeatherForDestination === 'function') {
    window.getWeatherForDestination(destination).then(weather => {
      const weatherBadge = document.getElementById('weatherBadge');
      if (weatherBadge && weather) {
        weatherBadge.textContent = weather.text;
        // Mantener estilo azul siempre - usar style para forzar
        weatherBadge.style.cssText = 'background: linear-gradient(to right, #38bdf8, #3b82f6) !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 2px solid rgba(255,255,255,0.5); text-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 0.375rem 0.75rem; border-radius: 9999px; font-weight: 600; white-space: nowrap; cursor: pointer;';
        // Actualizar onclick con destino correcto
        weatherBadge.onclick = () => {
          const hasWeatherAccess = typeof window.canAccessFeature === 'function'
              ? window.canAccessFeature(window.userPlan, 'WeatherDetails')
              : false;
          if (hasWeatherAccess) {
            showWeatherModal(destination, origin);
          } else {
            showUpgradeModal('Detailed weather forecast — available on Premium Plan');
          }
        };
      }
    }).catch(error => {
      debugLog('Error clima:', error);
      const weatherBadge = document.getElementById('weatherBadge');
      if (weatherBadge) {
        weatherBadge.textContent = '🌤️ Unavailable';
      }
    });
  }
}

//  Exponer globalmente
window.calculate = calculate;

// Re-translate dynamic decision panel elements when language changes
document.addEventListener('languageChanged', () => {
  // profitDetails
  const detailsEl = document.getElementById('profitDetails');
  if (detailsEl && detailsEl.dataset.profitPerMile) {
    const marginWord = window.i18n?.t('calculator.margin_short') || 'margin';
    detailsEl.textContent = `$${detailsEl.dataset.profitPerMile}/mi • ${detailsEl.dataset.margin}% ${marginWord} • ~$${detailsEl.dataset.gananciaDia}/day`;
  }
  // fuelStopsShort
  const stopsEl = document.getElementById('fuelStopsShort');
  if (stopsEl && stopsEl.dataset.fuelStops) {
    const stopsWord = window.i18n?.t('calculator.stops_short') || 'stops';
    stopsEl.textContent = `⛽ ${stopsEl.dataset.fuelStops} ${stopsWord}`;
  }
});

//  Inicializar cuando cargue la página
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('calculator-sync-rate-rpm', syncRateAndRpm);

  // 🎯 FIX: Auto-calculate when RPM or Rate changes
  initializeOnce('calculator-rpm-rate-listeners', () => {
    const rpmField = document.getElementById('rpm');
    const rateField = document.getElementById('rate');

    if (rpmField) {
      rpmField.addEventListener('input', () => {
        debugLog('[RPM Field] Value changed, triggering calculate()');
        if (typeof calculate === 'function') calculate();
      });
    }

    if (rateField) {
      rateField.addEventListener('input', () => {
        debugLog('[Rate Field] Value changed, triggering calculate()');
        if (typeof calculate === 'function') calculate();
      });
    }

    debugLog('✅ RPM/Rate auto-calculate listeners configured');
  });
});


//  Exponer globalmente (importante para que funcione oninput="...")
window.showDestinationNotes = showDestinationNotes;

// ========================================
//  MANTENER TODAS LAS FUNCIONES EXISTENTES
// ========================================

//  FUNCION: Copiar precio al portapapeles (MANTENER)
function copyPriceToClipboard() {
  const totalChargeEl = document.getElementById('totalCharge');
  if (!totalChargeEl) {
    debugLog("Elemento totalCharge no encontrado");
    return;
  }

  const price = totalChargeEl.textContent;

  navigator.clipboard.writeText(price).then(() => {
    // Feedback visual
    const button = event.target;
    const originalText = button.textContent;
    const originalClass = button.className;

    button.textContent = ' COPIADO';
    button.className = originalClass + ' copy-feedback';

    // Revertir despus de 2 segundos
    setTimeout(() => {
      button.textContent = originalText;
      button.className = originalClass;
    }, 2000);

    debugLog(` Precio copiado: ${price}`);

    // Opcional: Mostrar notificacin
    if (typeof showMessage === 'function') {
      showMessage(`Precio ${price} copiado al portapapeles`, 'success');
    }

  }).catch(err => {
    debugLog('Error copiando precio:', err);
    alert(`Precio: ${price}\n(Copiado manualmente)`);
  });

  // Obtener clima del destino (async)
  if (destination && typeof window.getWeatherForDestination === 'function') {
    window.getWeatherForDestination(destination).then(weather => {
      const weatherBadge = document.getElementById('weatherBadge');
      if (weatherBadge && weather) {
        weatherBadge.textContent = weather.text;
        // Mantener estilo azul siempre
        weatherBadge.style.cssText = 'background: linear-gradient(to right, #38bdf8, #3b82f6) !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 2px solid rgba(255,255,255,0.5); text-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 0.375rem 0.75rem; border-radius: 9999px; font-weight: 600; white-space: nowrap; cursor: pointer;';
      }
    });
  }
}

//  FUNCION: Aceptar y guardar automaticamente (MANTENER)
function acceptAndSave() {
  if (typeof saveLoad === 'function') {
    saveLoad();

    // Feedback visual
    const button = event.target;
    const originalText = button.textContent;

    button.textContent = ' GUARDANDO...';
    button.disabled = true;

    setTimeout(() => {
      button.textContent = ' GUARDADO';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }, 1000);

    debugLog(' Carga aceptada y guardada');
  } else {
    debugLog("Función saveLoad no disponible");
    alert("Unable to save the load at this time. Check your session and try again.");
  }
}

//  FUNCION: Ocultar panel de decision (MANTENER)
function hideDecisionPanel() {
  const panel = document.getElementById('decisionPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

//  Funcin para guardar carga (crear o editar)
let _isSaving = false;
async function saveLoad(existingLoadId = null) {
  // Guard: prevenir doble-click
  if (_isSaving) return;
  _isSaving = true;

  let _planForWarning = null;

  // ✅ GATE: Verificar límite de cargas (solo en cargas nuevas, no en ediciones)
  if (!existingLoadId) {
    try {
      // Siempre leer de Firestore para tener el contador actualizado
      const uid = window.currentUser?.uid;
      const userPlan = uid && typeof window.getUserPlan === 'function'
        ? await window.getUserPlan(uid)
        : window.userPlan;
      _planForWarning = userPlan;

      if (userPlan && typeof window.canCreateMoreLoads === 'function' && !window.canCreateMoreLoads(userPlan)) {
        _isSaving = false;

        // Mostrar modal de upgrade
        if (typeof window.showUpgradeModal === 'function') {
          window.showUpgradeModal('Cargas ilimitadas');
        }

        // Email de límite alcanzado (una sola vez por sesión para no spamear)
        if (!sessionStorage.getItem('limitEmailSent')) {
          sessionStorage.setItem('limitEmailSent', '1');
          const user = firebase.auth().currentUser;
          if (user) {
            const maxLoads = userPlan.limits?.maxLoadsPerMonth || 30;
            firebase.firestore().collection('mail').add({
              to: [user.email],
              message: {
                subject: '¡Alcanzaste tu límite de cargas este mes! 🚐',
                html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;border-bottom:2px solid #FF6D4A;">
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">Smart<span style="color:#FF6D4A;">Load</span> Solution</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <div style="text-align:center;margin-bottom:24px;font-size:48px;">🚐</div>
            <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;text-align:center;">Llegaste al límite de ${maxLoads} cargas este mes</h2>
            <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6;text-align:center;">Tu Plan Starter incluye ${maxLoads} cargas por mes. Actualiza a Professional para cargas ilimitadas y mucho más.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:28px;">
              <tr><td>
                <p style="margin:0 0 16px;color:#FF6D4A;font-size:13px;font-weight:700;text-transform:uppercase;">Plan Professional — $14.99/mes</p>
                <table width="100%">
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Cargas ilimitadas</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Dashboard financiero completo</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Análisis de zonas y mercados</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Reportes avanzados</td></tr>
                  <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✅ &nbsp;Smart Load Academy</td></tr>
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://smartloadsolution.com/plans.html" style="display:inline-block;background:#FF6D4A;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">Ver Planes →</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Smart Load Solution · <a href="https://smartloadsolution.com" style="color:#FF6D4A;text-decoration:none;">smartloadsolution.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
              }
            }).catch(e => debugLog('[saveLoad] Email límite no enviado:', e.message));
          }
        }

        return;
      }
    } catch (planError) {
      debugLog('[saveLoad] Error verificando plan, continuando:', planError.message);
    }
  }

  let loadData;
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) LoadingManager.show(saveBtn, 'Guardando...');

  try {
    if (typeof window.db === 'undefined') {
      throw new Error('Base de datos no disponible. Inicia sesin primero.');
    }

    // Obtener datos del formulario
    const origin = document.getElementById('origin')?.value?.trim();
    const destination = document.getElementById('destination')?.value?.trim();
    const loadedMiles = document.getElementById('loadedMiles')?.value;
    const deadheadMiles = document.getElementById('deadheadMiles')?.value || '0';
    const rpm = document.getElementById('rpm')?.value;
    const rate = document.getElementById('rate')?.value || '0';  //  nuevo
    const tolls = document.getElementById('tolls')?.value || '0';
    const others = document.getElementById('otherCosts')?.value || '0';
    const loadNumber = document.getElementById('loadNumber')?.value?.trim() || '';

    // Fecha de pago esperada: fecha de la carga + 15 días naturales
    // (mismo plazo en finances-data.js ensurePaymentFields).
    function calculatePaymentDate(loadDate) {
      const PAYMENT_TERM_DAYS = 15;
      // A load date is a local calendar day, never a UTC instant.
      const match = String(loadDate).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
      if (!match) throw new Error('Invalid load date');
      const [year, month, day] = match.slice(1).map(Number);
      const date = new Date(year, month - 1, day, 12);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new Error('Invalid load date');
      }
      date.setDate(date.getDate() + PAYMENT_TERM_DAYS);
      return formatDateLocal(date);
    }

    //  Manejo de fechas
    let loadDate;
    try {
      const dateInputEl = document.getElementById('dateInput');
      const editDateEl = document.getElementById('editDate');

      if (dateInputEl && dateInputEl.value) {
        loadDate = dateInputEl.value.trim();
      } else if (editDateEl && editDateEl.value) {
        loadDate = editDateEl.value.trim();
      } else if (existingLoadId && typeof existingLoadId === "string") {
        // Solo si el ID es vlido
        const existingDoc = await window.db.collection('loads').doc(existingLoadId).get();
        loadDate = existingDoc.exists ? existingDoc.data().date : getTodayDateString();
      } else {
        loadDate = getTodayDateString();
      }
    } catch (err) {
      debugLog(" No se encontro campo de fecha, usando hoy:", err);
      loadDate = getTodayDateString();
    }

    // Nuevos campos de pago (usando la fecha REAL de la carga)
    const paymentStatus = 'pending';
    const expectedPaymentDate = calculatePaymentDate(loadDate);
    const actualPaymentDate = null;
    const companyName = document.getElementById('companyName')?.value?.trim() || '';
    const notes = document.getElementById('notes')?.value?.trim() || '';


    // Validaciones
    if (!origin || !destination) throw new Error('Origen y destino son requeridos');

    if (!origin || !destination) {
      throw new Error('Pon origen y destino para guardar la carga 📍');
    }

    if (
      loadedMiles === "" || isNaN(loadedMiles) || loadedMiles <= 0 ||
      deadheadMiles === "" || isNaN(deadheadMiles) || Number(deadheadMiles) < 0 ||
      rpm === "" || isNaN(rpm) || rpm <= 0
    ) {
      throw new Error('Revisa millas cargadas, deadhead y RPM antes de guardar ✅');
    }



    // Same main-leg rounding and additional stops as calculate().
    const mainMiles = Number(loadedMiles) + Number(deadheadMiles);
    const stops = getStops();
    const stopMiles = stops.reduce((sum, stop) => sum + stop.miles, 0);
    const totalMiles = mainMiles + stopMiles;
    const mainIncome = Number(rate) > 0 ? Number(rate) : Math.round(Number(rpm) * mainMiles);
    const baseIncome = mainIncome + stops.reduce((sum, stop) => sum + stop.revenue, 0);
    const finalRpm = baseIncome / totalMiles;

    const additionalCosts = Number(tolls) + Number(others);
    // Cobro = tarifa + otros (cargos extra al cliente). Tolls = gasto (ver calculate())
    const totalCharge = baseIncome + Number(others);


    // Mismo costo por milla que se mostro en pantalla; se guarda con la carga
    // de que etapa salio para poder entender despues una ganancia antigua.
    await refreshActiveCpm();
    const _cpmInfo = getActiveCpmInfo();

    // Misma formula que la pantalla (calculateTotalExpenses). "Otros" es ingreso.
    if (window.SLSFuelPrices) await window.SLSFuelPrices.load();
    const _exp = calculateTotalExpenses(totalMiles, Number(tolls), loadRoute(origin, destination, stops.map(s => s.destination)));
    const fuelCost = _exp.fuelCost;
    const operatingCost = _exp.maintenanceCost + _exp.foodCost + _exp.fixedCosts;
    const totalExpenses = _exp.total;
    const netProfit = totalCharge - totalExpenses;
    const profitMargin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;

    // Objeto de carga
    loadData = {
      loadNumber: loadNumber,
      paymentStatus: paymentStatus,
      expectedPaymentDate: expectedPaymentDate,
      actualPaymentDate: actualPaymentDate,
      companyName,
      origin,
      destination,
      originState: getStateFromLocation(origin),
      destinationState: getStateFromLocation(destination),
      notes,
      userId: window.currentUser?.uid || null,
      loadedMiles: Number(loadedMiles) + stopMiles,
      deadheadMiles: Number(deadheadMiles),
      totalMiles,
      rate: stops.length ? baseIncome : Number(rate),
      rpm: finalRpm,
      baseIncome,
      tolls: Number(tolls),
      otherCosts: Number(others),
      additionalCosts,
      totalCharge,
      fuelCost,
      operatingCost,
      totalExpenses,
      netProfit,
      profitPerMile: totalMiles > 0 ? netProfit / totalMiles : 0,
      profitMargin,
      date: loadDate || getTodayDateString(), //  aseguramos siempre fecha
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
      cpmUsed: Number(_cpmInfo.cpm.toFixed(4)),
      cpmSource: _cpmInfo.source

    };

    // Guardar en Firebase
    if (existingLoadId && typeof existingLoadId === "string") {
      await window.db.collection('loads').doc(existingLoadId).update(loadData);
      debugLog('✅ Carga actualizada con ID:', existingLoadId);
    } else {
      try {
        const { userId: _omitUserId, createdAt: _omitCreatedAt, ...payload } = loadData;
        const createLoadFn = firebase.app().functions('us-central1').httpsCallable('createLoad');
        const res = await createLoadFn(payload);
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

    // NUEVO: Actualizar perfil de Lex con la nueva carga
    if (window.lexAI && window.lexAI.updateProfileWithLoad) {
      try {
        await window.lexAI.updateProfileWithLoad(loadData);
        debugLog('🧠 Lex aprendió de esta carga');
      } catch (error) {
        debugLog('⚠️ Error actualizando perfil de Lex:', error);
        // No interrumpir el flujo si falla Lex
      }
    }

    window.showMessage?.('✅ Carga guardada', 'success');

    // Warning anticipado: avisar cuando quedan pocas cargas (≤5)
    if (!existingLoadId && _planForWarning && typeof window.getRemainingLoads === 'function') {
      const remaining = window.getRemainingLoads(_planForWarning);
      if (remaining !== null && remaining > 0 && remaining <= 5) {
        const lang = window.i18n?.currentLanguage || 'en';
        const msg = lang === 'es'
          ? `⚠️ Te quedan ${remaining} carga${remaining === 1 ? '' : 's'} este mes. <a href="plans.html" style="color:#FF6D4A;font-weight:700;">Ver planes →</a>`
          : `⚠️ ${remaining} load${remaining === 1 ? '' : 's'} left this month. <a href="plans.html" style="color:#FF6D4A;font-weight:700;">See plans →</a>`;
        setTimeout(() => showToast(msg, 'warning', 7000), 1500);
      }
    }

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('loadSaved'));
    }, 500);

  } catch (error) {
    debugLog('Error guardando carga:', error);

    // 🗄️ Offline fallback: save to IndexedDB if Firestore fails
    if (window.offlineStorage && !navigator.onLine) {
      try {
        await window.offlineStorage.saveCalculation(loadData);
        window.showMessage?.('📴 No internet — load saved locally. It will sync automatically.', 'warning');
        debugLog('[OFFLINE] Carga guardada en IndexedDB para sync posterior');
      } catch (offlineError) {
        debugLog('❌ Error guardando offline:', offlineError);
        window.showMessage?.('Error al guardar la carga: ' + error.message, 'error');
      }
    } else {
      window.showMessage?.('Error al guardar la carga: ' + error.message, 'error');
    }
  } finally {
    _isSaving = false;
    if (saveBtn) LoadingManager.hide(saveBtn);
  }

}




function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  } else {
    alert('⚠️ ' + message);
  }
}


function getStateFromLocation(location) {
  if (!location) return '';

  const stateNames = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'IDAHO': 'ID', 'ILLINOIS': 'IL',
    'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY',
    'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA',
    'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH',
    'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC',
    'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR',
    'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY'
  };

  const upper = location.toUpperCase();
  const validStates = new Set(Object.values(stateNames));

  // 1) Nombre completo primero — evita CHICAGO→CA
  const sortedNames = Object.keys(stateNames).sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    if (upper.includes(name)) return stateNames[name];
  }

  // 2) Código 2 letras después de coma
  const m = location.match(/,\s*([A-Za-z]{2})\s*[,\.]/);
  if (m) {
    const code = m[1].toUpperCase();
    if (validStates.has(code)) return code;
  }

  // 3) Código 2 letras al final
  const m2 = location.match(/,\s*([A-Za-z]{2})\s*$/);
  if (m2) {
    const code = m2[1].toUpperCase();
    if (validStates.has(code)) return code;
  }

  return '';
}

//  FUNCION: Actualizar estado de rentabilidad (MANTENER)
function updateProfitabilityStatus(margin) {
  const statusEl = document.getElementById('profitabilityStatus');
  if (!statusEl) return;

  let status, className, warning = '';

  if (margin >= 20) {
    status = 'Excelente ganancia 💰';
    className = 'text-green-700 bg-green-100';
  } else if (margin >= 10) {
    status = 'Buena ganancia 👍';
    className = 'text-blue-700 bg-blue-100';
  } else if (margin >= 0) {
    status = 'Margen justo ⚠️';
    className = 'text-yellow-700 bg-yellow-100';
    warning = ' · Evalúa el destino';
  } else {
    status = 'Pérdida 🚫';
    className = 'text-red-700 bg-red-100';
    warning = ' · Mejor rechazar';
  }

  statusEl.textContent = status + warning;
  statusEl.className = className;
}


function clearForm() {
  debugLog('Limpiando formulario...');

  const fields = ['origin', 'destination', 'loadedMiles', 'deadheadMiles', 'rpm', 'tolls', 'otherCosts', 'loadNumber', 'companyName', 'notes'];
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const resultIds = ['tripMiles', 'baseIncome', 'additionalCosts', 'totalCharge', 'operatingCost', 'fuelCost', 'maintenanceCost', 'tollsCost', 'otherCost', 'totalExpenses', 'netProfit', 'profitPerMile', 'profitMargin', 'actualRPM', 'tripDays', 'fuelStops', 'estimatedTime', 'profitabilityStatus'];
  resultIds.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '--';
  });

  const section = document.getElementById('suggestedPriceSection');
  if (section) section.style.display = 'none';

  // Limpiar panel de costos reales
  const realCostPanel = document.getElementById('realCostPanel');
  if (realCostPanel) realCostPanel.remove();

  // Resetear destinos secuenciales si están activos
  if (typeof window.resetDestinations === 'function') {
    window.resetDestinations();
  }

  debugLog('Formulario limpiado');
  hideDecisionPanel();

  // Ocultar tambien el cuadro de notas
  hideNotesBox();

  //IMPORTANTE: Resetear la bandera de Lex para permitir que vuelva a avisar
  lexNotifiedForCurrentCalc = false;
}



// ========================================
//  FUNCIONES DE GOOGLE MAPS (MANTENER TODAS)
// ========================================

//  Variables globales para Google Maps
let googleMap, directionsService, directionsRenderer;

//  FUNCION: Actualizar mapa
function updateMap() {
  //  CRITICAL: Don't override route if sequential destinations are active
  // Check if there are any destination inputs with IDs starting with "dest-"
  const hasSequentialDestinations = document.querySelector('input[id^="dest-"]') !== null;

  if (hasSequentialDestinations) {
    debugLog(" Sequential destinations active, skipping updateMap to preserve multi-waypoint route");
    return;
  }

  const origin = document.getElementById('origin')?.value?.trim();
  const destination = document.getElementById('destination')?.value?.trim();

  if (!origin || !destination) {
    debugLog(" Cannot update map: missing origin or destination");
    return;
  }

  if (googleMap && directionsService && directionsRenderer) {
    showRouteOnMap(origin, destination);
  } else {
    debugLog(" Map not ready, showing fallback");
    showMapFallback(origin, destination);
  }
}

//  FALLBACK para cuando el mapa no este listo
function showMapFallback(origin, destination) {
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.innerHTML = `
            <div class="w-full h-96 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center justify-center">
                <div class="text-center p-6">
                    <h3 class="text-lg font-semibold text-blue-800 mb-2"> Ruta: ${origin}  ${destination}</h3>
                    <p class="text-blue-600 mb-4">Mapa en proceso de carga...</p>
                    <button onclick="openGoogleMapsDirections()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Ver en Google Maps
                    </button>
                </div>
            </div>
        `;
  }
}

//  FUNCION: Abrir Google Maps (MANTENER)
function openGoogleMapsDirections() {
  const origin = document.getElementById('origin').value.trim();
  const destination = document.getElementById('destination').value.trim();

  if (origin && destination) {
    const url = 'https://www.google.com/maps/dir/' + encodeURIComponent(origin) + '/' + encodeURIComponent(destination);
    window.open(url, '_blank');
  }
}

//  FUNCION: Mostrar ruta en mapa
function showRouteOnMap(origin, destination) {
  if (!directionsService || !directionsRenderer) {
    debugLog("Google Maps services not ready");
    return;
  }

  const request = {
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING,
    avoidTolls: false,
    avoidHighways: false
  };

  directionsService.route(request, (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);

      // Calcular distancia automaticamente si est disponible
      const route = result.routes[0];
      const distance = route.legs[0].distance.value * 0.000621371; // metros a millas

      // Actualizar campo de millas si esta vacio
      const loadedMilesEl = document.getElementById('loadedMiles');
      if (loadedMilesEl && !loadedMilesEl.value) {
        loadedMilesEl.value = Math.round(distance);
        updateTotalMiles();
      }

      debugLog(` Ruta calculada: ${Math.round(distance)} millas`);
    } else {
      debugLog('Error calculando ruta:', status);
      showMapFallback(origin, destination);
    }
  });
}

//  FUNCION: Calcular distancia automaticamente
function calculateDistanceAutomatically() {
  // Intentar obtener de inputs ocultos primero (nuevo sistema)
  let origin = document.getElementById('origin-value')?.value?.trim();
  let destination = document.getElementById('destination-value')?.value?.trim();

  // Fallback a inputs normales (sistema legacy)
  if (!origin) origin = document.getElementById('origin')?.value?.trim();
  if (!destination) destination = document.getElementById('destination')?.value?.trim();

  if (!origin || !destination) {
    debugLog(" Faltan origin/destination para calcular");
    return;
  }

  // Si hay funcin especfica para hidden values, usarla
  if (typeof calculateDistanceFromHidden === 'function' &&
    document.getElementById('origin-value')?.value) {
    calculateDistanceFromHidden(origin, destination);
    return;
  }

  // Metodo estandar
  if (typeof google !== 'undefined' && google.maps && google.maps.DistanceMatrixService) {
    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix({
      origins: [origin],
      destinations: [destination],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.IMPERIAL,
      avoidHighways: false,
      avoidTolls: false
    }, (response, status) => {
      if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
        const distance = response.rows[0].elements[0].distance.value * 0.000621371;

        const loadedMilesEl = document.getElementById('loadedMiles');
        if (loadedMilesEl && !loadedMilesEl.value) {
          loadedMilesEl.value = Math.round(distance);
          updateTotalMiles();
          debugLog(` Distancia calculada: ${Math.round(distance)} millas`);
        }
      }
    });
  }
}

//  FUNCION: Actualizar total de millas
function updateTotalMiles() {
  const loadedMiles = Number(document.getElementById('loadedMiles')?.value || 0);
  const deadheadMiles = Number(document.getElementById('deadheadMiles')?.value || 0);
  const total = loadedMiles + deadheadMiles;

  const tripMilesEl = document.getElementById('tripMiles');
  if (tripMilesEl) {
    tripMilesEl.textContent = total.toLocaleString();
  }
}

//  FUNCION: Inicializar Google Maps
function initGoogleMaps() {
  try {
    if (typeof google === 'undefined') {
      debugLog("Google Maps API no cargada");
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      debugLog("Elemento de mapa no encontrado");
      return;
    }

    // Crear mapa centrado en EE.UU.
    googleMap = new google.maps.Map(mapElement, {
      zoom: 5,
      center: { lat: 39.8283, lng: -98.5795 }, // Centro de EE.UU.
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    // Expose globally for sequential-destinations.js
    window.googleMap = googleMap;
    debugLog('[MAPS] ✅ window.googleMap set (from calculator.js):', !!window.googleMap);

    // Inicializar servicios de direcciones
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      draggable: false,
      panel: null
    });

    directionsRenderer.setMap(googleMap);

    debugLog(" Google Maps inicializado correctamente");

    // Configurar autocompletado despus de inicializar el mapa
    // Solo si no se ha configurado ya (evitar duplicados)
    if (!window.autocompleteConfigured) {
      window.autocompleteConfigured = true;
      setTimeout(setupGoogleAutocomplete, 1000);
    }

  } catch (error) {
    debugLog("Error inicializando Google Maps:", error);
  }
}

//  FUNCION: Entry point oficial para Google Maps callback
function initMap() {
  debugLog(" initMap() llamado por Google Maps API");
  initGoogleMaps();
}

// Exponer initMap globalmente para el callback de Google Maps
window.initMap = initMap;

//  FUNCION: Configurar autocompletado de Google Places
// NOTA: PlaceAutocompleteElement no se inicializa correctamente (shadow DOM vaco)
// Usando mtodo Autocomplete legacy que funciona perfectamente
async function setupGoogleAutocomplete() {
  try {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      debugLog("Google Places API no disponible");
      return;
    }

    debugLog(" Configurando Autocomplete (mtodo legacy)...");

    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');

    if (!originInput || !destinationInput) {
      debugLog("Inputs de origin/destination no encontrados");
      return;
    }

    // Si son elementos gmp-place-autocomplete, reemplazarlos con inputs normales
    if (originInput.tagName === 'GMP-PLACE-AUTOCOMPLETE') {
      const newOrigin = document.createElement('input');
      newOrigin.type = 'text';
      newOrigin.id = 'origin';
      newOrigin.className = originInput.className;
      newOrigin.placeholder = originInput.getAttribute('placeholder') || 'Origen (ej: Miami, FL)';
      newOrigin.autocomplete = 'off';
      originInput.parentNode.replaceChild(newOrigin, originInput);
      debugLog(" Origin convertido a input normal");
    }

    if (destinationInput.tagName === 'GMP-PLACE-AUTOCOMPLETE') {
      const newDest = document.createElement('input');
      newDest.type = 'text';
      newDest.id = 'destination';
      newDest.className = destinationInput.className;
      newDest.placeholder = destinationInput.getAttribute('placeholder') || 'Destino (ej: Atlanta, GA)';
      newDest.autocomplete = 'off';
      destinationInput.parentNode.replaceChild(newDest, destinationInput);
      debugLog(" Destination convertido a input normal");
    }

    // Ahora configurar con el mtodo legacy
    setupLegacyAutocomplete();

  } catch (error) {
    debugLog("Error configurando autocompletado:", error);
  }
}

//  FUNCIN FALLBACK: Autocomplete legacy si falla el nuevo
function setupLegacyAutocomplete() {
  try {
    debugLog(" Configurando Autocomplete legacy...");

    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');

    if (!originInput || !destinationInput) return;

    const originAutocomplete = new google.maps.places.Autocomplete(originInput, {
      types: ['geocode'],
      componentRestrictions: { country: ['us', 'ca'] }
    });

    // Si #destination es hidden, el sistema sequential-destinations maneja sus propios inputs
    if (destinationInput.type === 'hidden') {
      debugLog('[AUTOCOMPLETE] Skipping destination autocomplete — sequential-destinations system in use');
      originAutocomplete.addListener('place_changed', () => {
        setTimeout(() => calculateDistanceAutomatically(), 500);
      });
      debugLog(' Autocomplete legacy configurado (solo origin)');
      return;
    }

    const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {
      types: ['geocode'],
      componentRestrictions: { country: ['us', 'ca'] }
    });

    function normalizePlace(inputEl, place) {
      if (place && place.address_components) {
        let city = "";
        let state = "";

        place.address_components.forEach(c => {
          if (c.types.includes("locality")) city = c.long_name;
          if (c.types.includes("administrative_area_level_1")) state = c.short_name;
        });

        if (!city) {
          const postal = place.address_components.find(c => c.types.includes("postal_code"));
          if (postal) city = postal.long_name;
        }

        if (city && state) {
          inputEl.value = `${city}, ${state}`;
        }
      }
    }

    originAutocomplete.addListener('place_changed', () => {
      normalizePlace(originInput, originAutocomplete.getPlace());
      setTimeout(() => calculateDistanceAutomatically(), 500);
    });

    destinationAutocomplete.addListener('place_changed', () => {
      normalizePlace(destinationInput, destinationAutocomplete.getPlace());

      if (destinationInput.value.trim()) {
        showDestinationNotes(destinationInput.value.trim());
      }

      setTimeout(() => calculateDistanceAutomatically(), 500);
    });

    debugLog(" Autocomplete legacy configurado");
  } catch (error) {
    debugLog("Error en legacy autocomplete:", error);
  }
}

//  FUNCION: Calcular distancia usando valores de inputs ocultos
function calculateDistanceFromHidden(origin, destination) {
  if (!origin || !destination) {
    debugLog(" Faltan valores para calcular");
    return;
  }

  debugLog(" Calculando distancia:", origin, "", destination);

  if (!google.maps.DistanceMatrixService) {
    debugLog(" DistanceMatrixService no disponible");
    return;
  }

  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [origin],
    destinations: [destination],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
    avoidHighways: false,
    avoidTolls: false
  }, (response, status) => {
    if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
      const distanceMiles = Math.round(response.rows[0].elements[0].distance.value * 0.000621371);

      debugLog(` Distancia calculada: ${distanceMiles} millas`);

      const loadedMilesEl = document.getElementById('loadedMiles');
      if (loadedMilesEl && !loadedMilesEl.value) {
        loadedMilesEl.value = distanceMiles;
        loadedMilesEl.dispatchEvent(new Event('input', { bubbles: true }));

        if (typeof updateTotalMiles === 'function') {
          updateTotalMiles();
        }

        debugLog(" Millas actualizadas en el campo");
      }
    } else {
      debugLog(" Error calculando distancia:", status);
    }
  });
}



//  FUNCION: Sincronizar vista de rentabilidad
function syncRentabilityCardSingleView() {
  const rentCard = document.getElementById('rentabilityCard');
  if (rentCard) {
    rentCard.style.display = 'none';
    rentCard.setAttribute('aria-hidden', 'true');
  }
}

// ========================================
//  FUNCIN DE LIMPIEZA
// ========================================
function clearForm() {
  debugLog(" Limpiando formulario de calculadora...");

  // Campos de texto y números
  const fields = [
    'origin', 'destination',
    'loadedMiles', 'deadheadMiles',
    'rpm', 'rate', 'price', 'totalCharge', // posibles variantes
    'tolls', 'otherCosts', 'detention',
    'loadNumber', 'companyName', 'notes'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Resetear resultados visuales
  updateElement('netProfit', '$0.00');
  updateElement('profitMargin', '0%');
  updateElement('totalExpenses', '$0.00');
  updateElement('fuelCostDisp', '$0.00');
  updateElement('operatingCostDisp', '$0.00');

  // Resetear destinos secuenciales si están activos
  if (typeof window.resetDestinations === 'function') {
    window.resetDestinations();
  }

  // Resetear mapa si existe función
  if (typeof resetMap === 'function') {
    resetMap();
  }

  // Enfocar primer campo
  const origin = document.getElementById('origin');
  if (origin) origin.focus();

  showToast("Formulario limpiado", "info");
}

// ========================================
//  CONFIGURACIN DE EVENTOS (MANTENER COMPLETA)
// ========================================

document.addEventListener('DOMContentLoaded', function () {
  initializeOnce('calculator-setup-events', function () {
    debugLog(' Calculator integrado cargado - configurando eventos');

    setTimeout(function () {
      // Configurar botones principales
      const calculateBtn = document.getElementById('calculateBtn');
      const saveBtn = document.getElementById('saveBtn');
      const clearBtn = document.getElementById('clearBtn');

      if (calculateBtn) {
        calculateBtn.addEventListener('click', calculate);
        debugLog(' Boton calcular configurado con costos reales');
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => saveLoad());
        debugLog(' Boton guardar configurado');
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
        debugLog(' Boton limpiar configurado');
      }

      // Configurar auto-clculo de millas totales
      const loadedInput = document.getElementById('loadedMiles');
      const deadheadInput = document.getElementById('deadheadMiles');

      if (loadedInput && deadheadInput) {
        [loadedInput, deadheadInput].forEach(input => {
          input.addEventListener('input', updateTotalMiles);
        });
        debugLog(' Auto-clculo de millas totales configurado');
      }

      // Configurar validacin en tiempo real
      const requiredFields = ['origin', 'destination', 'loadedMiles', 'deadheadMiles', 'rpm'];
      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.addEventListener('blur', function () {
            if (!this.value.trim()) {
              this.classList.add('border-red-500');
            } else {
              this.classList.remove('border-red-500');
            }
          });
        }
      });

    }, 500);

    // NO configurar autocompletado aqu - se hace automaticamente cuando Google Maps carga via callback

    // Sincronizar vista de rentabilidad
    syncRentabilityCardSingleView();
  });
});

// NO inicializar mapa manualmente - Google Maps lo hace via callback a initMap()

//  Autocalculado en todos los campos de la calculadora
// ----------------------------------------------------
function setupAutoCalculation() {
  const fields = [
    "origin", "destination", "loadNumber", "companyName", "notes",
    "loadedMiles", "deadheadMiles", "rpm", "tolls", "otherCosts"
  ];

  const debouncedCalc = debounce(() => {
    if (typeof window.calculate === "function") {
      window.calculate();
    } else {
      debugLog(" calculate() no esta disponible todavia");
    }
  }, 400);

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", debouncedCalc);
      el.addEventListener("change", debouncedCalc);
    }
  });

  debugLog(" Auto clculo configurado en la calculadora");
}

function initAutoCalculation() {
  if (typeof window.calculate === "function") {
    setupAutoCalculation();
  } else {
    debugLog(" Esperando a calculate...");
    setTimeout(initAutoCalculation, 300);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('calculator-auto-calculation', initAutoCalculation);
});


//  Exponer globalmente
window.showDestinationNotes = showDestinationNotes;

// =============================
//  Funciones para Modal de Notas
// =============================

// Variable global para recordar el destino actual
let currentDestinationKey = "";

//  Normalizar destinos (para usar como key uniforme en Firestore)
function normalizeDestination(value) {
  if (!value) return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/,?\s*(ee\.?\s*uu\.?|usa|united states)/gi, "") // quitar pas
    .replace(/,/g, "")   // quitar comas
    .replace(/\s+/g, " "); // normalizar espacios
}



//  Obtener notas de Firebase para un destino (por key normalizado)
async function getNotesForDestination(normalizedKey) {
  try {
    const snapshot = await firebase.firestore()
      .collection("notes")
      .where("userId", "==", window.currentUser.uid)
      .where("key", "==", normalizedKey)   //  bsqueda exacta con clave uniforme
      .orderBy("createdAt", "desc")
      .get();

    return snapshot;
  } catch (error) {
    debugLog(" Error en getNotesForDestination:", error);
    return { empty: true, docs: [] };
  }
}

//  Cuadro amarillo de informacion rpida (solo contador)
async function showDestinationNotes(destination) {
  if (!destination) return;

  const normalized = normalizeDestination(destination);
  debugLog(" showDestinationNotes ejecutado con:", destination, " normalizado:", normalized);

  const snapshot = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", window.currentUser.uid)
    .get();

  const notes = snapshot.docs.filter(doc => {
    const data = doc.data();
    const keyNorm = normalizeDestination(data.key || "");
    const destNorm = normalizeDestination(data.destination || "");
    return keyNorm === normalized || destNorm === normalized;
  });

  debugLog(" Notas filtradas para", normalized, ":", notes.length);

  const box = document.getElementById("previousNoteBox");
  const status = document.getElementById("notesStatusText");

  if (notes.length > 0) {
    status.textContent = `📝 Tienes ${notes.length} nota(s) guardada(s) para este destino`;
    box.classList.remove("hidden");
  } else {
    status.textContent = "ℹ️ No hay notas para este destino todavía.";
    box.classList.remove("hidden");
  }
}


//  Modal de Notas
async function openNotesModal(destination) {
  currentDestinationKey = normalizeDestination(destination);

  const modal = document.getElementById("notesModal");
  const title = document.getElementById("notesModalTitle");
  const list = document.getElementById("notesListModal");

  if (!currentDestinationKey) {
    title.textContent = "Notas";
    list.innerHTML = `<p class="text-gray-500 text-sm"> No se especific un destino.</p>`;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    return;
  }

  //  mostramos el destino original en el ttulo, pero usamos el key para buscar
  title.textContent = `Notas para ${destination}`;
  list.innerHTML = `<p class="text-gray-500 text-sm">Cargando notas...</p>`;
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const snapshot = await getNotesForDestination(currentDestinationKey);

  if (snapshot.empty) {
    list.innerHTML = `<p class="text-gray-500 text-sm">No hay notas registradas an.</p>`;
  } else {
    let html = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      html += `
  <div class="border rounded p-2 flex justify-between items-start">
    <div>
      <p class="text-base text-gray-800">${data.note}</p>
      <p class="text-xs text-gray-500">
        ${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : ""}
      </p>
    </div>
    <div class="flex gap-2">
      <button
        class="text-blue-600 text-xs"
        onclick="editNote('${doc.id}', '${data.note.replace(/'/g, "\\'")}')"
        title="Editar nota"
      >
        ✏️
      </button>
      <button
        class="text-red-600 text-xs"
        onclick="deleteNote('${doc.id}')"
        title="Eliminar nota"
      >
        🗑️
      </button>
    </div>
  </div>
`;

    });
    list.innerHTML = html;
  }
}

//  Cerrar modal
function closeNotesModal() {
  const modal = document.getElementById("notesModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

//  Añadir nueva nota
async function addNoteToDestination(key) {
  const textarea = document.getElementById("newNoteModalInput");
  const note = textarea.value.trim();
  if (!note) return alert("La nota no puede estar vacía ✍️");

  try {
    const rawDestination = document.getElementById("destination")?.value?.trim() || key;

    await firebase.firestore().collection("notes").add({
      userId: window.currentUser.uid,
      key: normalizeDestination(rawDestination), //  clave uniforme para busquedas
      destination: rawDestination,               //  lo que ves en el input
      note: note,
      type: document.getElementById("notesModalType")?.value || "destino",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    textarea.value = "";
    openNotesModal(rawDestination);
    showDestinationNotes(rawDestination);
  } catch (error) {
    debugLog(" Error guardando nota:", error);
    alert("Ocurrió un problema guardando la nota. Inténtalo de nuevo.");
  }

}

//  Escuchar cambios en el destino (blur + change)
function handleDestinationChange(e) {
  const dest = e.target.value.trim();
  if (dest && dest.length > 3) {
    debugLog(" Detectado destino valido:", dest);
    showDestinationNotes(dest);
  } else {
    debugLog(" Destino muy corto, no se buscan notas:", dest);
  }
}

const destInput = document.getElementById("destination");
destInput?.addEventListener("blur", handleDestinationChange);
destInput?.addEventListener("change", handleDestinationChange);

//  Editar nota
async function editNote(noteId, oldText) {
  const nuevoTexto = prompt("Editar tu nota:", oldText);
  if (!nuevoTexto) return;

  try {
    await firebase.firestore().collection("notes").doc(noteId).update({
      note: nuevoTexto,
      updatedAt: new Date().toISOString()
    });

    openNotesModal(currentDestinationKey);
    showDestinationNotes(document.getElementById("destination")?.value?.trim());
  } catch (error) {
    debugLog(" Error editando nota:", error);
  }
}

//  Eliminar nota
async function deleteNote(noteId) {
  if (!confirm("Eliminar esta nota?")) return;

  try {
    await firebase.firestore().collection("notes").doc(noteId).delete();

    openNotesModal(currentDestinationKey);
    showDestinationNotes(document.getElementById("destination")?.value?.trim());
  } catch (error) {
    debugLog(" Error eliminando nota:", error);
    alert("No se pudo eliminar la nota. Inténtalo otra vez.");
  }
}

if (typeof window.refreshLexStateNotes === "function") {
  (async () => {
    try {
      await window.refreshLexStateNotes();
    } catch (e) {
      debugLog("[LEX] Error refrescando stateNotes después de cambiar nota:", e);
    }
  })();
}


//  Exponer globalmente
window.showDestinationNotes = showDestinationNotes;
window.openNotesModal = openNotesModal;
window.closeNotesModal = closeNotesModal;
window.addNoteToDestination = addNoteToDestination;
window.editNote = editNote;
window.deleteNote = deleteNote;


//  DEBUG: inspeccionar notas en Firestore
async function debugNotas() {
  const uid = window.currentUser?.uid;
  if (!uid) {
    debugLog(" Usuario no autenticado");
    return;
  }

  // 1. Ver todas las notas del usuario
  const allNotes = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .get();

  debugLog(" TOTAL notas encontradas:", allNotes.docs.length);
  allNotes.docs.forEach(doc => debugLog(" Nota:", doc.id, doc.data()));

  // 2. Buscar exactamente por destination
  const snapDest = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .where("destination", "==", "Miami, FL")
    .get();

  debugLog(" Resultado destination='Miami, FL':", snapDest.docs.length);
  snapDest.docs.forEach(doc => debugLog(" Dest:", doc.id, doc.data()));

  // 3. Buscar por key (maysculas)
  const snapKey = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .where("key", "==", "MIAMI, FL")
    .get();

  debugLog(" Resultado key='MIAMI, FL':", snapKey.docs.length);
  snapKey.docs.forEach(doc => debugLog(" Key:", doc.id, doc.data()));
}

let notesTimeout;

//  Ejecuta showDestinationNotes con delay (debounce)
function showDestinationNotesDebounced(value) {
  clearTimeout(notesTimeout);
  notesTimeout = setTimeout(() => {
    showDestinationNotes(value);
  }, 600); // espera 600ms despus de dejar de escribir
}
function getStateFromPlace(placeStr = '') {
  const m = String(placeStr).match(/,\s*([A-Za-z]{2})\b/);
  if (m) return m[1].toUpperCase();
  const tokens = String(placeStr).toUpperCase().split(/[\s,.-]+/);
  for (const t of tokens) { if (t.length === 2) return t; }
  return '';
}


// =========================================================
// LEX: Detectar cuando la calculadora esta lista (IDs reales)
// =========================================================
let lexNotifiedForCurrentCalc = false;

function calculatorIsReady() {
  const originEl = document.getElementById('origin');
  const destinationEl = document.getElementById('destination');
  const loadedEl = document.getElementById('loadedMiles');
  const deadheadEl = document.getElementById('deadheadMiles');
  const rpmEl = document.getElementById('rpm');
  const rateEl = document.getElementById('rate');

  // Si algo no existe, no hacemos nada
  if (!originEl || !destinationEl || !loadedEl || !deadheadEl || !rpmEl || !rateEl) {
    debugLog('[LEX] No encontrÃ© uno de los campos de la calculadora');
    return false;
  }

  const origin = originEl.value.trim();
  const destination = destinationEl.value.trim();
  const loadedMiles = Number(loadedEl.value || 0);
  const deadheadMiles = Number(deadheadEl.value || 0);
  const totalMiles = loadedMiles + deadheadMiles;
  const rpm = Number(rpmEl.value || 0);
  const rate = Number(rateEl.value || 0);

  // Tiene que haber origen, destino, millas y (rpm o rate)
  return (
    origin &&
    destination &&
    totalMiles > 0 &&
    (rpm > 0 || rate > 0)
  );
}

function notifyLexCalculatorReady() {
  if (lexNotifiedForCurrentCalc) return;
  if (typeof window.setLexState !== 'function') return;

  // 1) Detectar estado de destino y zonas aprendidas
  const destinationEl = document.getElementById('destination');
  let destinoTexto = destinationEl ? destinationEl.value.trim() : '';
  let destinoEstado = null;

  if (typeof window.getStateCode === 'function' && destinoTexto) {
    destinoEstado = window.getStateCode(destinoTexto);
  }

  let zonaTipo = 'neutral'; // 'buena' | 'mala' | 'neutral'

  if (destinoEstado && window.lexAI && window.lexAI.userContext) {
    const ctx = window.lexAI.userContext;
    const buenas = ctx.preferredZones || [];
    const malas = ctx.badZones || [];

    if (malas.includes(destinoEstado)) zonaTipo = 'mala';
    else if (buenas.includes(destinoEstado)) zonaTipo = 'buena';
  }

  lexNotifiedForCurrentCalc = true;

  // 2) Mensajes y tono segun la zona
  let mensajeSorpresa = 'Oye Ricardo… esta carga se ve interesante 🚐';
  let mensajeAlerta = '¿Quieres que la revise por ti? Haz clic en mí 🧠✨';

  if (zonaTipo === 'mala' && destinoEstado) {
    mensajeSorpresa = `Hmm… ${destinoEstado} suele ser complicado para salir 😬`;
    mensajeAlerta = 'Mejor la revisamos bien antes de decir que sí. Haz clic en mí 🧠⚠️';
  } else if (zonaTipo === 'buena' && destinoEstado) {
    mensajeSorpresa = `Oye, ${destinoEstado} suele ser buena zona para ti ✅`;
    mensajeAlerta = 'Si quieres, la analizo y vemos si está a la altura de tus números 📊✨';
  }

  // 3) Cara de sorpresa segun la zona
  const estadoLexInicial = (zonaTipo === 'mala') ? 'warning' : 'surprise';

  window.setLexState(estadoLexInicial, {
    message: mensajeSorpresa,
    duration: 1800
  });

  // 4) DespuÃ©s de la sorpresa, invitacion a analizar + animacion
  setTimeout(() => {
    window.setLexState('alert', {
      message: mensajeAlerta,
      duration: 6000
    });

    const shell = document.querySelector('.lex-avatar-shell');
    if (shell) {
      shell.classList.add('lex-attention-pulse');
      setTimeout(() => {
        shell.classList.remove('lex-attention-pulse');
      }, 6000);
    }
  }, 1800);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeOnce('lex-calculator-input-listeners', () => {
    const calcInputs = [
      'origin',
      'destination',
      'loadedMiles',
      'deadheadMiles',
      'rpm',
      'rate'
    ];

    calcInputs.forEach(id => {
      const input = document.getElementById(id);
      if (!input) {
        debugLog('[LEX] Input no encontrado al registrar listener:', id);
        return;
      }

      input.addEventListener('input', () => {
        if (calculatorIsReady()) {
          notifyLexCalculatorReady();
        }
      });
    });

    debugLog('[LEX] Listeners de calculadora configurados correctamente');
  });
});


// ========================================
//  EXPOSICION DE FUNCIONES GLOBALES (MANTENER TODAS)
// ========================================

// Funciones principales
window.calculate = calculate;
window.saveLoad = saveLoad;
window.clearForm = clearForm;

// Funciones de mapas
window.updateMap = updateMap;
window.openGoogleMapsDirections = openGoogleMapsDirections;
window.initGoogleMaps = initGoogleMaps;
// Si Google Maps termino de cargar antes que este archivo, su callback dejo un
// aviso (ver app.html): iniciar ahora el mapa y el autocompletado.
if (window.__mapsCallbackPending && window.google && window.google.maps) {
  window.__mapsCallbackPending = false;
  try { initGoogleMaps(); } catch (e) { debugLog('initGoogleMaps tardio:', e); }
}
window.setupGoogleAutocomplete = setupGoogleAutocomplete;
window.setupLegacyAutocomplete = setupLegacyAutocomplete;
window.calculateDistanceAutomatically = calculateDistanceAutomatically;
window.calculateDistanceFromHidden = calculateDistanceFromHidden;
window.showRouteOnMap = showRouteOnMap;
window.updateTotalMiles = updateTotalMiles;
window.showMapFallback = showMapFallback;

// Funciones del panel de decision
window.showDecisionPanel = showDecisionPanel;
window.hideDecisionPanel = hideDecisionPanel;
window.copyPriceToClipboard = copyPriceToClipboard;
window.acceptAndSave = acceptAndSave;

// Funciones de costos reales (NUEVAS)
window.TU_COSTO_REAL = TU_COSTO_REAL;
window.calcularTiempoReal = calcularTiempoReal;
window.getDecisionInteligente = getDecisionInteligente;

// Funciones de deteccion de trap loads (NUEVAS)
window.analizarTrapPenalty = analizarTrapPenalty;

// ========================================
//  CLIMA CON RUTA - VERSION SIN CONFLICTOS
//  INSTRUCCIONES: 
//  1. BORRA todo lo que pegaste antes (desde las variables hasta el final)
//  2. PEGA este código AL FINAL de calculator.js (antes del último debugLog)
// ========================================

// Variables para clima modal (nombres únicos)
let weatherModalRouteLoaded = false;
let weatherModalMap = null;
let weatherModalDirections = null;

// ========================================
//  FUNCIÓN: Modal de clima MEJORADO - Mobile First
// ========================================
// ========================================
//  CLIMA DE LA RUTA — paleta de la "Guía de color — Clima de la ruta"
//  (un solo lugar para los colores; el resto usa var(--wx-*)).
// ========================================
const WX_PALETTE = {
  bg: '#081735',        // fondo principal
  bg2: '#0D2352',       // fondo secundario
  card: '#112B67',      // tarjeta principal
  highlight: '#1E56D9', // tarjeta resaltada / botón activo
  glow: '#33A2FF',      // borde activo, línea de checkpoints
  text: '#F5F8FF',      // texto principal
  text2: '#B8C8E6',     // texto secundario
  text3: '#8097BF',     // texto tenue
  rain: '#54C8FF',
  snow: '#7FD6FF',
  ok: '#34D399',        // condición segura
  warn: '#F6B24A',      // advertencia
  danger: '#D94A6A',    // alerta severa
  storm: '#FFD447'
};
const WX_STATE = {
  rain: WX_PALETTE.rain,
  snow: WX_PALETTE.snow,
  storm: WX_PALETTE.storm,
  other: WX_PALETTE.ok,
  none: WX_PALETTE.text3
};
const WX_CSS_VARS = Object.entries({
  '--wx-bg': WX_PALETTE.bg, '--wx-bg2': WX_PALETTE.bg2, '--wx-card': WX_PALETTE.card,
  '--wx-hl': WX_PALETTE.highlight, '--wx-glow': WX_PALETTE.glow, '--wx-t1': WX_PALETTE.text,
  '--wx-t2': WX_PALETTE.text2, '--wx-t3': WX_PALETTE.text3, '--wx-rain': WX_PALETTE.rain,
  '--wx-snow': WX_PALETTE.snow, '--wx-ok': WX_PALETTE.ok, '--wx-warn': WX_PALETTE.warn,
  '--wx-danger': WX_PALETTE.danger, '--wx-storm': WX_PALETTE.storm
}).map(([k, v]) => `${k}:${v}`).join(';');

const WX_PATHS = {
  drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"></path>',
  flake: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10"></path>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"></path>',
  check: '<path d="M5 12l4 4 10-10"></path>',
  dash: '<path d="M6 12h12"></path>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  okCircle: '<circle cx="12" cy="12" r="9"></circle><path d="M8 12l3 3 5-6"></path>',
  warn: '<path d="M12 3l9 16H3L12 3z"></path><path d="M12 10v4"></path><path d="M12 17h.01"></path>'
};
const WX_KIND_PATH = { rain: WX_PATHS.drop, snow: WX_PATHS.flake, storm: WX_PATHS.bolt, other: WX_PATHS.check, none: WX_PATHS.dash };

function wxLineIcon(path, color, size = 16, width = 2.2) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${path}</svg>`;
}
// Círculo del checkpoint: verde con check blanco si está despejado; azul intenso con
// borde blanco y el icono del estado (gota, copo, rayo) en su color si no.
function wxCheckpointCircle(kind) {
  const P = WX_PALETTE;
  const color = WX_STATE[kind] || WX_STATE.other;
  const fill = kind === 'other' ? P.ok : kind === 'none' ? P.bg2 : P.highlight;
  const iconColor = kind === 'other' ? P.text : color;
  return `<div style="width:36px;height:36px;border-radius:18px;background:${fill};border:3px solid ${P.text};box-shadow:0 0 16px ${color}99;display:flex;align-items:center;justify-content:center">${wxLineIcon(WX_KIND_PATH[kind] || '', iconColor, 18, 2.8)}</div>`;
}

async function showWeatherModal(destination, origin = null) {
  try {
    const W = window.SLSWeather;
    const esc = W.escape;
    const P = WX_PALETTE;
    const data = await W.request('forecast', { query: destination });
    const current = data.current;
    const forecast = (data.forecast && data.forecast.forecastday) || [];
    const today = forecast[0] ? forecast[0].day : {};
    const alerts = W.activeAlerts(data);
    const originCity = origin || document.getElementById('origin')?.value || '';
    // "Miami, FL, USA" -> "Miami, FL"; sin coma, el nombre tal cual
    const cityState = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 2).join(', ');
    const short = (s) => String(s || '').split(',')[0].trim();
    const pct = (v) => Number.isFinite(Number(v)) ? Math.round(Number(v)) + '%' : '—';
    const tempF = Math.round(current.temp_f);
    const destLabel = cityState(destination) || [data.location.name, data.location.region].filter(Boolean).join(', ');
    const icon = (c, size) => c && c.icon ? `<img src="https:${esc(c.icon)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;flex-shrink:0">` : '';
    const title = (path, text) => `<div class="wx-h">${wxLineIcon(path, P.glow, 22)}<span>${text}</span></div>`;

    const dayLabel = (d, i) => {
      if (i === 0) return 'Hoy';
      const s = new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const daysHTML = forecast.slice(0, 3).map((d, i) => `
      <div class="wx-day${i === 0 ? ' wx-today' : ''}">
        <div style="font-size:16px;font-weight:800;color:var(--wx-t1)">${dayLabel(d, i)}</div>
        ${icon(d.day.condition, 38)}
        <div class="wx-day-temp" style="font-size:19px;font-weight:800"><span style="color:var(--wx-t1)">${Math.round(d.day.maxtemp_f)}°</span> <span style="color:var(--wx-t2);font-weight:600">/ ${Math.round(d.day.mintemp_f)}°</span></div>
        <div style="font-size:14px;color:var(--wx-rain);margin-top:4px">Lluvia ${pct(d.day.daily_chance_of_rain)}</div>
        ${Number(d.day.daily_chance_of_snow) > 0 ? `<div style="font-size:14px;color:var(--wx-snow);margin-top:2px">Nieve ${pct(d.day.daily_chance_of_snow)}</div>` : ''}
      </div>`).join('');

    const when = (v) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? new Date(t).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
    };
    const alertsHTML = alerts.length ? alerts.map((a) => {
      const severe = a.severity === 'Extreme' || a.severity === 'Severe';
      const base = severe ? P.danger : P.warn;
      const fg = severe ? P.text : P.bg;
      return `
      <div class="wx-alert" style="background:linear-gradient(90deg, ${base} 0%, ${base}B3 100%);border:1px solid ${base};color:${fg};box-shadow:0 0 22px ${base}66">
        ${wxLineIcon(WX_PATHS.warn, fg, 34, 2.4)}
        <div>
          <div style="font-size:18px;font-weight:800">Alerta: ${esc(a.event || a.headline || 'meteorológica')}</div>
          ${a.areas ? `<div style="font-size:14px;margin-top:4px">Zona: ${esc(a.areas)}</div>` : ''}
          <div style="font-size:14px;margin-top:2px">Vigencia: ${esc(when(a.effective))} – ${esc(when(a.expires))}</div>
        </div>
      </div>`;
    }).join('') : `
      <div class="wx-alert wx-ok">
        ${wxLineIcon(WX_PATHS.okCircle, P.ok, 22)}
        <span>Sin alertas meteorológicas vigentes del proveedor</span>
      </div>`;

    const routeBlocks = originCity ? `
      <div class="wx-box">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          ${title(WX_PATHS.pin, 'Checkpoints')}
          <span id="wxRoutePill" class="wx-pill" style="border-color:var(--wx-t3)">Consultando…</span>
        </div>
        <div id="wxCheckpoints"><div style="font-size:14px;color:var(--wx-t2);padding:6px 0">Consultando el clima en la ruta…</div></div>
        <div style="font-size:12px;color:var(--wx-t3);margin-top:10px">Clima actual en cada punto, no a la hora de paso · Destino: pronóstico · Fuente: WeatherAPI</div>
      </div>` : '';
    const countCell = (path, color, label, id) => `
        <div class="wx-count-cell">${wxLineIcon(path, color, 28, 2.2)}<div style="text-align:left"><div class="wx-count-label">${label}</div><div id="${id}" class="wx-count">–</div></div></div>`;
    const countsHTML = originCity ? `
      <div id="wxCounts" class="wx-counts">
        ${countCell(WX_PATHS.drop, P.rain, 'Lluvia', 'wxCountRain')}
        ${countCell(WX_PATHS.flake, P.snow, 'Nieve o hielo', 'wxCountSnow')}
        ${countCell(WX_PATHS.bolt, P.storm, 'Tormenta', 'wxCountStorm')}
      </div>` : '';
    const mapHTML = originCity ? `
      <details id="wxMapDetails">
        <summary class="wx-btn">Ver mapa de la ruta</summary>
        <div id="routeMap" style="width:100%;height:340px;margin-top:12px;border-radius:12px;overflow:hidden;background:var(--wx-bg2)"></div>
      </details>` : '';

    const modalHTML = `
  <div id="weatherModal" onclick="if (event.target === this) closeWeatherModal()" style="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);padding:16px;animation:fadeIn 0.2s ease">
    <div role="dialog" aria-label="Clima de la ruta" class="wx-modal" style="${WX_CSS_VARS}">
      <div class="wx-header">
        ${icon(current.condition, 40)}
        <div style="flex:1;min-width:0;font-size:22px;font-weight:800;color:var(--wx-t1)">Clima de la ruta</div>
        <button type="button" onclick="closeWeatherModal()" aria-label="Cerrar" style="width:44px;height:44px;border:0;background:transparent;color:var(--wx-t1);font-size:28px;cursor:pointer">×</button>
      </div>
      <div class="wx-body">
        <div style="display:flex;align-items:center;gap:12px">
          ${wxLineIcon(WX_PATHS.pin, P.glow, 26)}
          <div style="min-width:0">
            <div class="wx-route">${originCity ? esc(cityState(originCity)) + ' <span style="color:var(--wx-glow)">→</span> ' : ''}${esc(destLabel)}</div>
            <div id="wxRouteMeta" style="font-size:14px;color:var(--wx-t2);margin-top:2px">${originCity ? 'Calculando la ruta…' : 'Clima del destino'}</div>
          </div>
        </div>
        <div class="wx-top">
          <div class="wx-box wx-hero">
            ${title(WX_PATHS.pin, 'Destino ahora')}
            <div style="font-size:17px;font-weight:700;color:var(--wx-t1);margin:4px 0 0 28px">${esc(destLabel)}</div>
            <div style="display:flex;align-items:center;gap:16px;margin-top:2px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:220px">
                ${icon(current.condition, 76)}
                <div><div class="wx-temp">${tempF}°F</div><div style="font-size:16px;color:var(--wx-t2);margin-top:6px">${esc(W.conditionEs(current.condition))}</div></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;font-size:16px;color:var(--wx-t1);padding-left:16px;border-left:1px solid rgba(51,162,255,0.35)">
                <div style="display:flex;align-items:center;gap:10px">${wxLineIcon(WX_PATHS.drop, P.rain, 24)}<span><b>${pct(today.daily_chance_of_rain)}</b> Lluvia hoy</span></div>
                <div style="display:flex;align-items:center;gap:10px">${wxLineIcon(WX_PATHS.flake, P.snow, 24)}<span><b>${pct(today.daily_chance_of_snow)}</b> Nieve hoy</span></div>
                ${Number(current.wind_mph) >= 25 ? `<div style="display:flex;align-items:center;gap:10px;color:var(--wx-warn)"><b>${Math.round(current.wind_mph)} mph</b> Viento fuerte</div>` : ''}
              </div>
            </div>
          </div>
          <div class="wx-box">
            <div style="margin-bottom:10px">${title(WX_PATHS.cal, 'Próximos 3 días')}</div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${daysHTML}</div>
          </div>
        </div>
        ${routeBlocks}
        <div class="wx-status${countsHTML ? ' wx-status-2' : ''}">
          <div style="display:flex;flex-direction:column;gap:12px;min-width:0">${alertsHTML}</div>
          ${countsHTML}
        </div>
        ${mapHTML}
        ${originCity ? '' : '<div style="font-size:12px;color:var(--wx-t3)">Destino: pronóstico · Fuente: WeatherAPI</div>'}
      </div>
    </div>
  </div>
  <style>
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .wx-modal { width: 100%; min-width: 0; max-width: 1080px; max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; margin: auto; background: var(--wx-bg); border: 1px solid var(--wx-glow); border-radius: 20px; overflow: hidden; color: var(--wx-t1); box-shadow: 0 0 44px rgba(51,162,255,0.35), 0 24px 60px rgba(0,0,0,0.55); animation: slideUp 0.3s ease; }
    .wx-header { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 6px 10px 6px 22px; background: linear-gradient(90deg, var(--wx-hl) 0%, var(--wx-card) 100%); border-bottom: 1px solid var(--wx-glow); }
    .wx-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 22px 16px; display: flex; flex-direction: column; gap: 12px; }
    .wx-route { font-size: 22px; font-weight: 800; color: var(--wx-t1); line-height: 1.15; }
    .wx-top { display: grid; grid-template-columns: minmax(0,1fr); gap: 12px; }
    @media (min-width: 900px) { .wx-top { grid-template-columns: minmax(0,1fr) minmax(0,1fr); } }
    .wx-box { padding: 14px 18px; border-radius: 16px; background: var(--wx-card); border: 1px solid rgba(51,162,255,0.35); box-shadow: inset 0 1px 0 rgba(245,248,255,0.06); }
    .wx-hero { background: linear-gradient(135deg, var(--wx-hl) 0%, var(--wx-card) 75%); border-color: var(--wx-glow); box-shadow: 0 0 24px rgba(51,162,255,0.35); }
    .wx-h { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800; color: var(--wx-t1); }
    .wx-temp { font-size: 54px; font-weight: 800; line-height: 1; color: var(--wx-t1); }
    .wx-day { padding: 8px 6px; border-radius: 14px; text-align: center; background: var(--wx-bg2); border: 1px solid rgba(51,162,255,0.3); display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .wx-day.wx-today { background: var(--wx-hl); border-color: var(--wx-glow); box-shadow: 0 0 20px rgba(51,162,255,0.6); }
    .wx-day.wx-today div, .wx-day.wx-today span { color: var(--wx-t1) !important; }
    .wx-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; border: 1.5px solid; background: var(--wx-bg2); color: var(--wx-t1); font-size: 15px; font-weight: 700; }
    .wx-alert { display: flex; gap: 14px; align-items: center; padding: 10px 18px; border-radius: 16px; }
    .wx-alert.wx-ok { background: rgba(52,211,153,0.12); border: 1px solid var(--wx-ok); color: var(--wx-t1); font-size: 16px; font-weight: 700; }
    .wx-counts { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); border-radius: 16px; background: var(--wx-card); border: 1px solid rgba(51,162,255,0.35); overflow: hidden; }
    .wx-count-cell { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px; }
    .wx-count-cell + .wx-count-cell { border-left: 1px solid rgba(51,162,255,0.3); }
    .wx-count-label { font-size: 15px; color: var(--wx-t2); }
    .wx-count { font-size: 24px; font-weight: 800; line-height: 1.1; color: var(--wx-t3); }
    .wx-btn { cursor: pointer; display: inline-flex; align-items: center; min-height: 44px; padding: 0 22px; border-radius: 999px; background: var(--wx-hl); border: 1px solid var(--wx-glow); box-shadow: 0 0 16px rgba(51,162,255,0.5); color: var(--wx-t1); font-size: 16px; font-weight: 700; list-style: none; }
    .wx-btn::-webkit-details-marker { display: none; }
    .wx-status { display: grid; grid-template-columns: minmax(0,1fr); gap: 12px; }
    @media (min-width: 900px) { .wx-status.wx-status-2 { grid-template-columns: minmax(0,1fr) minmax(0,1.4fr); align-items: stretch; } .wx-status .wx-alert { height: 100%; box-sizing: border-box; } }
    @media (max-height: 780px) and (min-width: 641px) { .wx-cp-cond { display: none; } }
    @media (max-width: 640px) {
      .wx-body { padding: 16px; gap: 14px; }
      .wx-route { font-size: 20px; }
      .wx-temp { font-size: 48px; }
      .wx-h { font-size: 17px; }
      .wx-count-cell { flex-direction: column; gap: 6px; }
      .wx-count-cell > div { text-align: center !important; }
      .wx-count { font-size: 22px; }
      .wx-box { padding: 14px; }
      .wx-day { padding: 10px 4px; }
      .wx-day-temp { font-size: 15px !important; white-space: nowrap; }
      .wx-pill { font-size: 13px; padding: 6px 12px; }
      .wx-alert.wx-ok { font-size: 14px; }
    }
  </style>
`;

    document.getElementById('weatherModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';

    if (originCity) {
      window.weatherModalData = { origin: originCity, destination: destination };
      weatherModalRouteLoaded = false;
      const details = document.getElementById('wxMapDetails');
      details?.addEventListener('toggle', () => {
        if (details.open && weatherModalMap && window.google?.maps) {
          google.maps.event.trigger(weatherModalMap, 'resize');
          if (window._wxRouteBounds) weatherModalMap.fitBounds(window._wxRouteBounds);
        }
      });
      loadRouteMapWithWeather();
    }

  } catch (error) {
    debugLog('Error forecast:', error);
    alert('No se pudo obtener el pronóstico del clima');
  }
}

// Ruta del modal de clima: checkpoints repartidos por la ruta de Google,
// clima ACTUAL en cada uno, resumen "Lluvia en X de N puntos" y mapa plegado.
async function loadRouteMapWithWeather() {
  if (!window.weatherModalData) return;
  const { origin, destination } = window.weatherModalData;
  const W = window.SLSWeather;
  const esc = W.escape;
  const P = WX_PALETTE;
  const cpBox = document.getElementById('wxCheckpoints');
  const pill = document.getElementById('wxRoutePill');
  const setPill = (text, color, path) => {
    if (!pill) return;
    pill.innerHTML = (path ? wxLineIcon(path, color, 18) : '') + `<span>${esc(text)}</span>`;
    pill.style.borderColor = color;
    pill.style.boxShadow = `0 0 12px ${color}55`;
  };
  const setMsg = (text) => {
    if (cpBox) cpBox.innerHTML = `<div style="font-size:14px;color:var(--wx-t2);padding:6px 0">${esc(text)}</div>`;
    setPill('Sin datos de la ruta', P.text3);
  };
  if (!window.google?.maps) { setMsg('No se pudo cargar el mapa para consultar la ruta.'); return; }

  const mapDiv = document.getElementById('routeMap');
  weatherModalMap = new google.maps.Map(mapDiv, {
    zoom: 5,
    center: { lat: 39, lng: -95 },
    mapTypeId: 'roadmap',
    streetViewControl: false
  });
  const directionsService = new google.maps.DirectionsService();
  weatherModalDirections = new google.maps.DirectionsRenderer({
    map: weatherModalMap,
    suppressMarkers: true,
    polylineOptions: { strokeColor: P.highlight, strokeWeight: 6, strokeOpacity: 0.9 }
  });
  weatherModalRouteLoaded = true;

  directionsService.route({ origin, destination, travelMode: 'DRIVING' }, async (result, status) => {
    if (status !== 'OK') {
      debugLog('Error de ruta:', status);
      setMsg('No se pudo calcular la ruta.');
      return;
    }
    weatherModalDirections.setDirections(result);
    const route = result.routes[0];
    const leg = route.legs[0];
    window._wxRouteBounds = route.bounds;
    const totalMiles = leg.distance.value * 0.000621371;

    // Puntos según la distancia: 3 a 6, origen y destino incluidos.
    let numWaypoints = 3;
    if (totalMiles >= 900) numWaypoints = 6;
    else if (totalMiles >= 600) numWaypoints = 5;
    else if (totalMiles >= 300) numWaypoints = 4;

    const cityState = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 2).join(', ');
    const pathLength = route.overview_path.length;
    const waypoints = [];
    for (let i = 0; i < numWaypoints; i++) {
      const fraction = i / (numWaypoints - 1);
      if (i === 0) waypoints.push({ position: leg.start_location, label: cityState(origin) });
      else if (i === numWaypoints - 1) waypoints.push({ position: leg.end_location, label: cityState(destination) });
      else waypoints.push({
        position: route.overview_path[Math.floor(fraction * (pathLength - 1))],
        label: 'Milla ' + Math.round(fraction * totalMiles)
      });
    }

    const meta = document.getElementById('wxRouteMeta');
    if (meta) {
      const secs = Number(leg.duration?.value) || 0;
      const time = secs > 0 ? ` · ${Math.floor(secs / 3600)} h ${Math.round((secs % 3600) / 60)} min` : '';
      meta.textContent = `${Math.round(totalMiles)} mi · ${numWaypoints} checkpoints${time}`;
    }

    const results = await Promise.all(waypoints.map((wp) => getWeatherByCoords(wp.position.lat(), wp.position.lng())));
    if (!document.getElementById('weatherModal')) return; // el modal se cerró mientras se consultaba

    const cells = waypoints.map((wp, i) => {
      const r = results[i];
      const k = r ? W.kind(r) : 'none';
      const color = WX_STATE[k] || WX_STATE.other;
      if (r) {
        new google.maps.Marker({
          position: wp.position,
          map: weatherModalMap,
          title: `${wp.label}: ${r.temp}°F · ${W.conditionEs(r)}`,
          label: { text: `${r.temp}°`, color: P.text, fontSize: '13px', fontWeight: 'bold' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: k === 'other' ? P.ok : P.highlight, fillOpacity: 1, strokeColor: P.text, strokeWeight: 2 }
        });
      }
      return `
        <div title="${esc(r ? W.conditionEs(r) : 'Sin datos')}" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0">
          ${wxCheckpointCircle(k)}
          <div class="wx-cp-label">${esc(wp.label)}</div>
          <div class="wx-cp-temp">${r && r.icon ? `<img class="wx-cp-img" src="https:${esc(r.icon)}" alt="" width="28" height="28" style="width:28px;height:28px">` : ''}${r ? r.temp + '°F' : '—'}</div>
          <div class="wx-cp-cond" style="color:${color}">${esc(r ? W.conditionEs(r) : 'Sin datos')}</div>
        </div>`;
    }).join('');

    if (cpBox) {
      cpBox.innerHTML = `
        <style>
          .wx-cp-label{font-size:16px;font-weight:800;color:var(--wx-t1);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .wx-cp-temp{display:flex;align-items:center;gap:4px;font-size:17px;font-weight:700;color:var(--wx-t1)}
          .wx-cp-cond{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          @media (max-width:640px){.wx-cp-label{font-size:11px}.wx-cp-temp{font-size:13px}.wx-cp-img,.wx-cp-cond{display:none}}
        </style>
        <div style="position:relative">
          <div style="position:absolute;left:${50 / numWaypoints}%;right:${50 / numWaypoints}%;top:16px;height:4px;border-radius:2px;background:var(--wx-glow);box-shadow:0 0 12px rgba(51,162,255,0.8)"></div>
          <div style="position:relative;display:grid;grid-template-columns:repeat(${numWaypoints},minmax(0,1fr))">${cells}</div>
        </div>`;
    }

    const n = W.routeCounts(results);
    if (!n.total) setPill('Sin datos de la ruta', P.text3);
    else if (n.storm) setPill(`Tormenta en ${n.storm} de ${n.total} checkpoints`, P.storm, WX_PATHS.bolt);
    else if (n.snow) setPill(`Nieve o hielo en ${n.snow} de ${n.total} checkpoints`, P.snow, WX_PATHS.flake);
    else if (n.rain) setPill(`Lluvia en ${n.rain} de ${n.total} checkpoints`, P.rain, WX_PATHS.drop);
    else setPill('Sin lluvia ni nieve en la ruta', P.ok, WX_PATHS.check);

    const put = (id, v, color) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = n.total ? `${v}/${n.total}` : '–';
      el.style.color = n.total && v > 0 ? color : P.text3;
    };
    put('wxCountRain', n.rain, P.text);
    put('wxCountSnow', n.snow, P.text);
    put('wxCountStorm', n.storm, P.storm);
  });
}
async function getWeatherByCoords(lat, lng) {
  try {
    const data = await window.SLSWeather.request('current', { lat, lng });
    return {
      temp: Math.round(data.current.temp_f),
      condition: data.current.condition.text,
      code: data.current.condition.code,
      text: data.current.condition.text,
      wind: Math.round(data.current.wind_mph),
      icon: data.current.condition.icon
    };
  } catch (error) {
    debugLog('Error clima:', error);
    return null;
  }
}

function getWeatherEmoji(condition) {
  const cond = condition.toLowerCase();
  if (cond.includes('snow')) return '❄️';
  if (cond.includes('storm') || cond.includes('thunder')) return '⛈️';
  if (cond.includes('rain')) return '🌧️';
  if (cond.includes('cloud')) return '☁️';
  if (cond.includes('clear') || cond.includes('sunny')) return '☀️';
  return '🌤️';
}

// ========================================
// 🎯 MULTI-STOP CALCULATOR Functions
// ========================================
let stopCounter = 0; // Global counter for unique stop IDs
const stopsArray = []; // Array to store stops data

/**
 * Add a new stop card
 */
function addStop() {
  stopCounter++;
  const stopId = `stop-${stopCounter}`;

  const stopCard = document.createElement('div');
  stopCard.id = stopId;
  stopCard.className = 'bg-white border-2 border-purple-200 rounded-lg p-3';
  stopCard.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-bold text-purple-800">📍 Parada ${stopCounter}</span>
      <button type="button" onclick="removeStop('${stopId}')" 
        class="text-red-600 hover:text-red-800 font-bold text-lg px-2">
        ×
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Destino</label>
        <input type="text" id="${stopId}-dest" placeholder="Ej: Chicago, IL"
          class="border border-gray-300 p-2 w-full rounded text-sm stop-input">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Millas</label>
        <input type="number" id="${stopId}-miles" placeholder="280"
          class="border border-gray-300 p-2 w-full rounded text-sm stop-input">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">RPM ($/mi)</label>
        <input type="number" id="${stopId}-rpm" step="0.01" placeholder="1.50"
          class="border border-gray-300 p-2 w-full rounded text-sm stop-input">
      </div>
    </div>
  `;

  const container = document.getElementById('stopsContainer');
  const noStopsMessage = document.getElementById('noStopsMessage');

  // Hide "no stops" message
  if (noStopsMessage) {
    noStopsMessage.classList.add('hidden');
  }

  container.appendChild(stopCard);

  // Add event listeners to recalculate on input
  const inputs = stopCard.querySelectorAll('.stop-input');
  inputs.forEach(input => {
    input.addEventListener('input', calculateFromInputs);
  });

  debugLog(`[MULTI-STOP] Added stop ${stopCounter}`);
}

/**
 * Remove a stop card
 */
function removeStop(stopId) {
  const stopCard = document.getElementById(stopId);
  if (stopCard) {
    stopCard.remove();
    debugLog(`[MULTI-STOP] Removed ${stopId}`);

    // Show "no stops" message if container is empty
    const container = document.getElementById('stopsContainer');
    const remainingStops = container.querySelectorAll('[id^="stop-"]');

    if (remainingStops.length === 0) {
      const noStopsMessage = document.getElementById('noStopsMessage');
      if (noStopsMessage) {
        noStopsMessage.classList.remove('hidden');
      }
    }

    // Recalculate
    calculateFromInputs();
  }
}

/**
 * Get all stops data as array
 */
function getStops() {
  const stops = [];
  const container = document.getElementById('stopsContainer');

  // Return empty array if container doesn't exist (using new sequential destinations system)
  if (!container) {
    return stops;
  }

  const stopCards = container.querySelectorAll('[id^="stop-"]');

  stopCards.forEach(card => {
    const stopId = card.id;
    const destination = sanitizeText(document.getElementById(`${stopId}-dest`)?.value || '');
    const miles = sanitizeNumber(document.getElementById(`${stopId}-miles`)?.value, 0, 10000);
    const rpm = sanitizeNumber(document.getElementById(`${stopId}-rpm`)?.value, 0, 50);

    if (destination && miles > 0 && rpm > 0) {
      stops.push({
        id: stopId,
        destination,
        miles,
        rpm,
        revenue: miles * rpm
      });
    }
  });

  return stops;
}

// Expose functions globally
window.addStop = addStop;
window.removeStop = removeStop;
window.getStops = getStops;

// Exponer funciones
// Función para cerrar modal de clima con animación
function closeWeatherModal() {
  const modal = document.getElementById('weatherModal');
  if (modal) {
    const content = modal.querySelector('.bg-white');
    if (content) {
      content.style.animation = 'slideDown 0.2s ease forwards';
    }
    modal.style.animation = 'fadeIn 0.2s ease reverse forwards';
    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = '';
    }, 200);
  }
}

window.closeWeatherModal = closeWeatherModal;
window.showWeatherModal = showWeatherModal;
window.loadRouteMapWithWeather = loadRouteMapWithWeather;
window.getWeatherByCoords = getWeatherByCoords;
window.getWeatherEmoji = getWeatherEmoji;
window.calculate = calculate;

debugLog(' Calculator.js INTEGRADO cargado completamente - Costos reales + Funcionalidad completa');
