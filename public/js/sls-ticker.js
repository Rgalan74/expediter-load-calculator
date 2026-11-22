// Cinta "en vivo" de la calculadora: gasolina de la semana (EIA), RPM y cargas
// del mes del usuario, su costo por milla activo y la semana de los precios.
// Solo lectura: una consulta de las cargas del mes y el documento de precios.
(function (w) {
  'use strict';

  const t = (k, fb) => (w.i18n && typeof w.i18n.t === 'function' && w.i18n.t(k)) || fb;
  const isEs = () => (w.i18n?.currentLang || 'en') === 'es';
  let busy = false;

  function setVal(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function weekLabel(period) {
    if (!period) return '—';
    const d = new Date(period + 'T12:00:00');
    if (!Number.isFinite(d.getTime())) return period;
    const m = d.toLocaleDateString(isEs() ? 'es-US' : 'en-US', { month: 'short' }).replace('.', '');
    return `${d.getDate()} ${m}`.toUpperCase();
  }

  async function refresh() {
    if (busy) return;
    const uid = w.currentUser?.uid || w.firebase?.auth?.().currentUser?.uid;
    if (!uid || !document.getElementById('slsTicker')) return;
    busy = true;
    try {
      // 1) Gasolina de la semana: promedio nacional EIA del combustible del usuario
      const fuelType = typeof w.getUserFuelType === 'function' ? w.getUserFuelType() : 'gasoline';
      const fuel = fuelType === 'diesel' ? 'diesel' : 'gasoline';
      const prices = w.SLSFuelPrices ? await w.SLSFuelPrices.load() : null;
      const nus = Number(prices?.[fuel]?.NUS) || 0;
      setVal('slsTkFuel', nus > 0 ? `$${nus.toFixed(2)}/GAL` : '—');
      setVal('slsTkWeek', weekLabel(prices?.periods?.[fuel]));
      const fuelLabel = document.getElementById('slsTkFuelLabel');
      if (fuelLabel) fuelLabel.textContent = fuel === 'diesel'
        ? t('calculator.ticker_diesel', 'Diesel this week')
        : t('calculator.ticker_fuel', 'Gas this week');

      // 2) Costo por milla activo
      const cpm = typeof w.getActiveCpmInfo === 'function' ? Number(w.getActiveCpmInfo().cpm) || 0 : 0;
      setVal('slsTkCpm', cpm > 0 ? `$${cpm.toFixed(3)}` : '—');

      // 3) Cargas y RPM del mes en curso
      const now = new Date();
      const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const snap = await w.firebase.firestore().collection('loads')
        .where('userId', '==', uid).where('date', '>=', first).get();
      let count = 0, miles = 0, revenue = 0;
      snap.forEach(doc => {
        const d = doc.data();
        const m = Number(d.totalMiles) || 0;
        const r = Number(d.rpm) > 0 ? Number(d.rpm) * m : (Number(d.totalCharge) || 0) - (Number(d.otherCosts) || 0);
        count++;
        if (m > 0 && r > 0) { miles += m; revenue += r; }
      });
      setVal('slsTkLoads', String(count));
      setVal('slsTkRpm', miles > 0 ? `$${(revenue / miles).toFixed(2)}` : '—');
    } catch (e) {
      if (typeof w.debugLog === 'function') w.debugLog('[TICKER] error', e && e.message);
    } finally {
      busy = false;
    }
  }

  function start(attempt = 0) {
    if (!(w.currentUser?.uid && w.firebase?.firestore)) {
      if (attempt < 120) setTimeout(() => start(attempt + 1), 500);
      return;
    }
    refresh();
    // Al guardar una carga, actualizar cargas y RPM del mes
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('#saveBtn')) setTimeout(refresh, 3500);
    });
    // Cada 10 minutos, por si los precios o el costo cambian
    setInterval(refresh, 10 * 60 * 1000);
  }

  w.SLSTicker = { refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start());
  else start();
})(window);
