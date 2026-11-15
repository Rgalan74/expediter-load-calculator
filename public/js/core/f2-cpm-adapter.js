/* Smart Load Solution — F2. Adaptador PURO para resolverCpm.
 * No accede a Firebase, DOM, red ni almacenamiento. NO escribe datos.
 * Solo usar con un lector autenticado que entregue datos completos y validos.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLSF2CpmAdapter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function fecha(v) {
    if (v && typeof v.toDate === 'function') v = v.toDate();
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      var s = v.slice(0, 10), d = new Date(s + 'T00:00:00Z');
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
    }
    return null;
  }
  function monto(v) { var x = Number(v); return Number.isFinite(x) && x > 0 ? x : null; }
  function normalizarCargas(cargas) {
    if (!Array.isArray(cargas)) throw new TypeError('cargas debe ser arreglo completo');
    return cargas.map(function (raw, i) {
      if (!raw || typeof raw !== 'object') throw new Error('carga invalida ' + i);
      var dia = fecha(raw.date || raw.fecha || raw.createdAt || raw.timestamp);
      if (!dia) throw new Error('fecha invalida en carga ' + i);
      var miles = [raw.totalMiles, raw.millas, raw.miles].map(monto).find(function(x){return x !== null;});
      if (miles === undefined) {
        var loaded = Number(raw.loadedMiles ?? raw.loaded ?? 0);
        var deadhead = Number(raw.deadheadMiles ?? raw.deadhead ?? 0);
        miles = loaded + deadhead;
      }
      if (!Number.isFinite(miles) || miles <= 0) throw new Error('millas invalidas en carga ' + i);
      return { fecha: dia, millas: miles };
    });
  }
  function normalizarGastos(gastos) {
    if (!Array.isArray(gastos)) throw new TypeError('gastos debe ser arreglo completo');
    return gastos.map(function (raw, i) {
      if (!raw || typeof raw !== 'object') throw new Error('gasto invalido ' + i);
      var dia = fecha(raw.date || raw.fecha || raw.createdAt);
      var importe = Number(raw.amount ?? raw.importe);
      if (!dia || !Number.isFinite(importe) || importe <= 0) throw new Error('gasto incompleto ' + i);
      var categoria = String(raw.category || raw.categoria || raw.type || 'other').toLowerCase();
      return { id: raw.id ?? null, fecha: dia, categoria: categoria, importe: importe,
        descripcion: String(raw.description || raw.descripcion || '') };
    });
  }
  function resolver(datos, engine) {
    if (!engine || typeof engine.resolverCpm !== 'function') throw new TypeError('F1.resolverCpm requerido');
    if (!datos || datos.historialCompleto !== true || datos.autenticado !== true) {
      return { estado: 'omitido', motivo: 'historial no confirmado como completo y autenticado', guardar: null };
    }
    if (!datos.configuracion || datos.configuracion.completa !== true) {
      return { estado: 'omitido', motivo: 'configuracion minima no confirmada', guardar: null };
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(datos.mesActual || '')) {
      return { estado: 'omitido', motivo: 'mes actual invalido', guardar: null };
    }
    try {
      var input = {
        cargas: normalizarCargas(datos.cargas), gastos: normalizarGastos(datos.gastos),
        configuracion: datos.configuracion, mesActual: datos.mesActual,
        categoriasNoOperativas: datos.categoriasNoOperativas || [],
        gastosNoRecurrentes: datos.gastosNoRecurrentes || [],
        preferencia: datos.preferencia || null,
        ultimoCpmRealConfiable: datos.ultimoCpmRealConfiable || null
      };
      var calculo = engine.resolverCpm(input);
      var candidato = calculo?.real?.confiable === true && calculo.guardar?.ultimoCpmRealConfiable;
      return { estado: 'resuelto', resultado: calculo,
        candidato: candidato ? { valor: candidato.valor, periodoHasta: candidato.periodoHasta } : null,
        guardar: null }; // La persistencia requiere ADAPTADOR SEPARADO en emulador; NUNCA autoescribir.
    } catch (e) {
      return { estado: 'omitido', motivo: 'datos no aptos: ' + (e.message || String(e)), guardar: null };
    }
  }
  return { fecha: fecha, normalizarCargas: normalizarCargas, normalizarGastos: normalizarGastos, resolver: resolver };
});
