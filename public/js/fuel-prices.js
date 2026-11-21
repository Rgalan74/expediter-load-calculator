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

  // Precio medio de la ruta: un valor por estado distinto (origen, paradas, destino).
  function routePrice(prices, states, fuelType) {
    const seen = new Set();
    const parts = [];
    for (const s of states || []) {
      const p = priceForState(prices, s, fuelType);
      if (p && !seen.has(p.state)) { seen.add(p.state); parts.push(p); }
    }
    if (!parts.length) return null;
    const price = parts.reduce((sum, p) => sum + p.price, 0) / parts.length;
    return { price: Math.round(price * 1000) / 1000, parts, period: prices.periods ? prices.periods[normFuel(fuelType)] : null };
  }

  function isFresh(prices, fuelType, now = Date.now()) {
    const period = prices && prices.periods && prices.periods[normFuel(fuelType)];
    const t = Date.parse(period ? period + 'T12:00:00Z' : '');
    return Number.isFinite(t) && (now - t) / 86400000 <= MAX_AGE_DAYS;
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
    REGION, GAS_STATE, NAMES, priceForState, routePrice, isFresh, load,
    current: () => data,
    set: (d) => { data = d || null; } // pruebas
  });
})(window);
