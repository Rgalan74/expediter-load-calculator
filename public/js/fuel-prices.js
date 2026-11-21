// Precios de combustible por ruta (EIA, semanal). Lee appConfig/fuelPrices, que
// actualiza la funcion updateFuelPrices una vez por semana para toda la app.
(function (w) {
  'use strict';

  // Region EIA (PADD) de cada estado. California tiene serie propia.
  const REGION = {
    CT: 'R1X', ME: 'R1X', MA: 'R1X', NH: 'R1X', RI: 'R1X', VT: 'R1X',
    DE: 'R1Y', DC: 'R1Y', MD: 'R1Y', NJ: 'R1Y', NY: 'R1Y', PA: 'R1Y',
    FL: 'R1Z', GA: 'R1Z', NC: 'R1Z', SC: 'R1Z', VA: 'R1Z', WV: 'R1Z',
    IL: 'R20', IN: 'R20', IA: 'R20', KS: 'R20', KY: 'R20', MI: 'R20', MN: 'R20', MO: 'R20',
    NE: 'R20', ND: 'R20', SD: 'R20', OH: 'R20', OK: 'R20', TN: 'R20', WI: 'R20',
    AL: 'R30', AR: 'R30', LA: 'R30', MS: 'R30', NM: 'R30', TX: 'R30',
    CO: 'R40', ID: 'R40', MT: 'R40', UT: 'R40', WY: 'R40',
    AK: 'R5XCA', AZ: 'R5XCA', HI: 'R5XCA', NV: 'R5XCA', OR: 'R5XCA', WA: 'R5XCA',
    CA: 'SCA'
  };
  // Estados con precio propio de gasolina en la EIA (el diesel solo es regional).
  const GAS_STATE = { CA: 'SCA', CO: 'SCO', FL: 'SFL', MA: 'SMA', MN: 'SMN', NY: 'SNY', OH: 'SOH', TX: 'STX', WA: 'SWA' };
  const NAMES = {
    R1X: 'Nueva Inglaterra', R1Y: 'Atlántico central', R1Z: 'Atlántico sur', R20: 'Medio Oeste',
    R30: 'Costa del Golfo', R40: 'Montañas Rocosas', R5XCA: 'Costa Oeste', SCA: 'California',
    SCO: 'Colorado', SFL: 'Florida', SMA: 'Massachusetts', SMN: 'Minnesota', SNY: 'Nueva York',
    SOH: 'Ohio', STX: 'Texas', SWA: 'Washington', NUS: 'EE. UU.'
  };
  const MAX_AGE_DAYS = 21;
  let data = null;
  let loading = null;

  function normFuel(fuelType) { return fuelType === 'diesel' ? 'diesel' : 'gasoline'; }

  // Precio de un estado: serie propia (solo gasolina) o su region.
  function priceForState(prices, state, fuelType) {
    const fuel = normFuel(fuelType);
    const table = prices && prices[fuel];
    const st = String(state || '').trim().toUpperCase();
    if (!table || !REGION[st]) return null;
    for (const code of [fuel === 'gasoline' ? GAS_STATE[st] : null, REGION[st]]) {
      if (code && Number(table[code]) > 0) return { state: st, code, name: NAMES[code] || code, price: Number(table[code]) };
    }
    return null;
  }

  // Precio medio de la ruta. Con millas por estado (stateMiles) es la media
  // ponderada por millas; si no, un valor por estado distinto (origen, paradas, destino).
  function routePrice(prices, states, fuelType, stateMiles) {
    const period = prices && prices.periods ? prices.periods[normFuel(fuelType)] : null;
    if (stateMiles && typeof stateMiles === 'object') {
      const parts = [];
      let total = 0;
      let sum = 0;
      for (const [st, mi] of Object.entries(stateMiles)) {
        const p = priceForState(prices, st, fuelType);
        const m = Number(mi) || 0;
        if (!p || !(m > 0)) continue;
        parts.push({ ...p, miles: Math.round(m) });
        total += m;
        sum += p.price * m;
      }
      if (parts.length && total > 0) {
        parts.sort((a, b) => b.miles - a.miles);
        return { price: Math.round((sum / total) * 1000) / 1000, parts, period, weighted: true };
      }
    }
    const seen = new Set();
    const parts = [];
    for (const s of states || []) {
      const p = priceForState(prices, s, fuelType);
      if (p && !seen.has(p.state)) { seen.add(p.state); parts.push(p); }
    }
    if (!parts.length) return null;
    const price = parts.reduce((sum, p) => sum + p.price, 0) / parts.length;
    return { price: Math.round(price * 1000) / 1000, parts, period, weighted: false };
  }

  function isFresh(prices, fuelType, now = Date.now()) {
    const period = prices && prices.periods && prices.periods[normFuel(fuelType)];
    const t = Date.parse(period ? period + 'T12:00:00Z' : '');
    return Number.isFinite(t) && (now - t) / 86400000 <= MAX_AGE_DAYS;
  }

  // Nombres de estado (inglés y español) -> código, para los avisos de Google
  // "Entering Georgia" / "Entrando a Georgia".
  const STATE_NAMES = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
    CONNECTICUT: 'CT', DELAWARE: 'DE', 'DISTRICT OF COLUMBIA': 'DC', FLORIDA: 'FL', GEORGIA: 'GA',
    HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY',
    LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN',
    MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH',
    'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND',
    OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT',
    VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
    // español
    'CAROLINA DEL NORTE': 'NC', 'CAROLINA DEL SUR': 'SC', 'DAKOTA DEL NORTE': 'ND', 'DAKOTA DEL SUR': 'SD',
    'NUEVA YORK': 'NY', 'NUEVA JERSEY': 'NJ', 'NUEVO MEXICO': 'NM', 'NUEVO MÉXICO': 'NM', 'NUEVO HAMPSHIRE': 'NH',
    LUISIANA: 'LA', MISISIPI: 'MS', 'MISISIPÍ': 'MS', MISURI: 'MO', PENSILVANIA: 'PA', 'VIRGINIA OCCIDENTAL': 'WV',
    'HAWÁI': 'HI', OREGÓN: 'OR', 'MÍCHIGAN': 'MI', 'TENESÍ': 'TN', 'DISTRITO DE COLUMBIA': 'DC'
  };
  const NAME_KEYS = Object.keys(STATE_NAMES).map((k) => k.trim()).sort((a, b) => b.length - a.length);
  // Avisos de Google en cada tramo (inglés y español), cada uno en su <div>:
  //   "Entering Texas" / "Entrando en Texas"
  //   "Passing through Alabama, Mississippi" / "Pasando por Alabama, Misisipi"
  const ENTER_RE = /^(?:entering|entrando (?:a|en)|ingresando (?:a|en)|entra (?:a|en))\s+(.+)$/i;
  const PASS_RE = /^(?:passing through|pasando por|atravesando)\s+(.+)$/i;

  // Estados nombrados en los avisos de un tramo, en orden.
  function statesInNotes(instructions) {
    const raw = String(instructions || '');
    let notes = [...raw.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)].map((m) => m[1]);
    if (!notes.length) notes = [raw];
    const found = [];
    for (const note of notes) {
      const text = note.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const pass = text.match(PASS_RE);
      const enter = text.match(ENTER_RE);
      const names = pass ? pass[1].split(/\s*,\s*|\s+(?:and|y)\s+/i) : enter ? [enter[1]] : [];
      for (const name of names) {
        const st = stateFromName(name);
        if (st) found.push(st);
      }
    }
    return found;
  }

  function stateFromName(text) {
    const up = String(text || '').toUpperCase().trim();
    for (const name of NAME_KEYS) if (up.startsWith(name)) return STATE_NAMES[name];
    return null;
  }

  // Millas por estado de una ruta de Google Directions: cada tramo empieza en el
  // estado de su dirección de salida y cambia con los avisos "Entering X".
  // Devuelve null si no se detecta ningún cambio de estado pese a que origen y
  // destino de un tramo están en estados distintos (sin datos fiables).
  function stateMilesFromDirections(result, stateOf) {
    const legs = result && result.routes && result.routes[0] && result.routes[0].legs;
    if (!Array.isArray(legs) || !legs.length || typeof stateOf !== 'function') return null;
    const miles = {};
    for (const leg of legs) {
      let current = stateOf(leg.start_address);
      const end = stateOf(leg.end_address);
      let crossed = false;
      for (const step of leg.steps || []) {
        const m = (Number(step.distance && step.distance.value) || 0) / 1609.34;
        // Un tramo largo puede cruzar varios estados ("Passing through Alabama,
        // Mississippi" + "Entering Louisiana"). Google no dice dónde se cruza cada
        // frontera: el tramo se reparte a partes iguales entre el estado actual y los nuevos.
        const entered = [];
        for (const st of statesInNotes(step.instructions || step.html_instructions)) {
          if (st !== (entered[entered.length - 1] || current)) entered.push(st);
        }
        if (entered.length) {
          const share = [current, ...entered].filter(Boolean);
          for (const st of share) miles[st] = (miles[st] || 0) + m / share.length;
          current = entered[entered.length - 1];
          crossed = true;
        } else if (current) {
          miles[current] = (miles[current] || 0) + m;
        }
      }
      if (!crossed && current && end && current !== end) return null;
    }
    for (const k of Object.keys(miles)) miles[k] = Math.round(miles[k] * 10) / 10;
    return Object.keys(miles).length ? miles : null;
  }

  async function load() {
    if (data) return data;
    if (loading) return loading;
    loading = (async () => {
      try {
        const snap = await w.firebase.firestore().collection('appConfig').doc('fuelPrices').get();
        data = snap.exists ? snap.data() : null;
      } catch (e) {
        data = null;
      } finally {
        loading = null;
      }
      return data;
    })();
    return loading;
  }

  w.SLSFuelPrices = Object.freeze({
    REGION, GAS_STATE, NAMES, priceForState, routePrice, isFresh, load, stateMilesFromDirections, stateFromName,
    current: () => data,
    set: (d) => { data = d || null; } // pruebas
  });
})(window);
