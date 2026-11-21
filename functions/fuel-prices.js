'use strict';
// Precios semanales de combustible (EIA, Energy Information Administration).
// Una consulta por semana para TODA la app; los usuarios leen el resultado de
// appConfig/fuelPrices. La clave vive solo en Secret Manager (EIA_API_KEY).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

const eiaKey = defineSecret('EIA_API_KEY');
const PRODUCTS = { EPMR: 'gasoline', EPD2D: 'diesel' };

// Convierte las filas de la EIA en { gasoline: {duoarea: precio}, diesel: {...}, periods }
// usando solo la semana más reciente de cada producto y precios plausibles.
function parseEia(rows) {
  const out = { gasoline: {}, diesel: {}, periods: {} };
  const latest = {};
  for (const r of rows || []) {
    const fuel = PRODUCTS[r && r.product];
    if (!fuel || typeof r.period !== 'string') continue;
    if (!latest[fuel] || r.period > latest[fuel]) latest[fuel] = r.period;
  }
  for (const r of rows || []) {
    const fuel = PRODUCTS[r && r.product];
    if (!fuel || r.period !== latest[fuel]) continue;
    const value = Number(r.value);
    const area = String(r.duoarea || '');
    if (!/^[A-Z0-9]{2,8}$/.test(area) || !(value >= 1 && value <= 15)) continue;
    if (!(area in out[fuel])) out[fuel][area] = Math.round(value * 1000) / 1000;
  }
  out.periods = latest;
  return out;
}

async function fetchEia(key, fetchImpl = fetch) {
  const url = new URL('https://api.eia.gov/v2/petroleum/pri/gnd/data/');
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', 'weekly');
  url.searchParams.append('data[0]', 'value');
  url.searchParams.append('facets[product][]', 'EPMR');
  url.searchParams.append('facets[product][]', 'EPD2D');
  url.searchParams.append('sort[0][column]', 'period');
  url.searchParams.append('sort[0][direction]', 'desc');
  url.searchParams.set('length', '300');
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`EIA HTTP ${res.status}`);
  const body = await res.json();
  return (body && body.response && body.response.data) || [];
}

function buildUpdateFuelPrices({ db, fetchImpl }) {
  return onSchedule(
    // La EIA publica el lunes por la tarde; se actualiza el martes temprano.
    { schedule: 'every tuesday 06:00', timeZone: 'America/New_York', secrets: [eiaKey], maxInstances: 1, retryCount: 2, timeoutSeconds: 60 },
    async () => {
      const key = eiaKey.value();
      if (!key) throw new Error('EIA_API_KEY not configured');
      const parsed = parseEia(await fetchEia(key, fetchImpl));
      if (!Object.keys(parsed.gasoline).length && !Object.keys(parsed.diesel).length) {
        throw new Error('EIA returned no usable prices');
      }
      await db.collection('appConfig').doc('fuelPrices').set({
        source: 'EIA',
        gasoline: parsed.gasoline,
        diesel: parsed.diesel,
        periods: parsed.periods,
        fetchedAt: new Date().toISOString()
      });
      logger.info('[updateFuelPrices] saved', parsed.periods,
        Object.keys(parsed.gasoline).length, Object.keys(parsed.diesel).length);
    }
  );
}

module.exports = { parseEia, fetchEia, buildUpdateFuelPrices };
