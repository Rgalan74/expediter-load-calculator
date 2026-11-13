/**
 * Validación del motor con los datos reales de Ricardo (§10.3).
 *
 * El CSV es PRIVADO y nunca se guarda en el repositorio. Esta prueba solo se
 * ejecuta si se indica la ruta del archivo exportado desde Finanzas
 * (exportFinancialData):
 *
 *   PowerShell:  $env:SLS_FINANZAS_CSV="C:\Users\...\finanzas-expediter-2026-11-13.csv"; npm test
 *   Bash:        SLS_FINANZAS_CSV=/c/Users/.../finanzas-expediter-2026-11-13.csv npm test
 *
 * Sin esa variable, la prueba se marca como omitida.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const FE = require('../public/js/core/financial-engine.js');

const RUTA = process.env.SLS_FINANZAS_CSV;
const omitir = !RUTA ? 'sin SLS_FINANZAS_CSV (datos privados, solo en local)' : false;

/** Lector mínimo del CSV exportado por exportFinancialData() (campos entre comillas incluidos). */
function leerCsv(texto) {
  const filas = [];
  texto.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(linea => {
    const campos = [];
    let actual = '', comillas = false;
    for (const ch of linea) {
      if (ch === '"') comillas = !comillas;
      else if (ch === ',' && !comillas) { campos.push(actual); actual = ''; }
      else actual += ch;
    }
    campos.push(actual);
    filas.push(campos);
  });
  return filas;
}

function cargarDatos(ruta) {
  const filas = leerCsv(fs.readFileSync(ruta, 'utf8'));
  const iGastos = filas.findIndex(f => /GASTOS|EXPENSES/.test(f[0]));
  const iResumen = filas.findIndex(f => /RESUMEN|SUMMARY/.test(f[0]));
  const dinero = s => Number(String(s).replace(/[$,]/g, '')) || 0;
  const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(f[0]);
  const cargas = filas.slice(1, iGastos).filter(esFecha).map(f => ({ fecha: f[0], millas: Number(f[3]) }));
  const gastos = filas.slice(iGastos + 1, iResumen).filter(esFecha)
    .map((f, i) => ({ id: `csv-${i}`, fecha: f[0], categoria: f[1], descripcion: f[2], importe: dinero(f[3]) }));
  return { cargas, gastos };
}

// Configuración de Ricardo (decisión 6: mantenimiento por milla, ≈ $0.051/mi)
const CONFIG_RICARDO = {
  completa: true,
  cpm: 0.5068,
  combustibleEsperadoPorMilla: 3.79 / 19,
  seguroMensual: 1250,
  pagoVehiculoMensual: 897,
  metaMillasMes: 9000
};

test('§10.3 A — validación contable: mismas cargas, gastos y millas que Finanzas', { skip: omitir }, () => {
  const { cargas, gastos } = cargarDatos(RUTA);
  assert.equal(cargas.length, 112);
  assert.equal(gastos.length, 80);
  const millas = cargas.reduce((s, c) => s + c.millas, 0);
  const total = gastos.reduce((s, g) => s + g.importe, 0);
  assert.ok(Math.abs(millas - 68736.15) < 0.01, `millas ${millas}`);
  assert.ok(Math.abs(total - 50671.32) < 0.005, `gastos ${total}`);
  assert.ok(Math.abs(total / millas - 0.73719) < 5e-6, 'CPM contable');
});

test('§10.3 B — CPM real, abril de 2026 excluido, cobertura y candidato único', { skip: omitir }, () => {
  const { cargas, gastos } = cargarDatos(RUTA);
  const r = FE.resolverCpm({ cargas, gastos, configuracion: CONFIG_RICARDO, mesActual: '2026-11' });
  const real = r.real;

  // Periodo (decisiones 9 y 12)
  assert.equal(real.periodo.desde, '2025-05');
  assert.equal(real.periodo.hasta, '2026-03');
  assert.deepEqual(real.excluidos, [{ mes: '2026-04', motivo: 'mesFinalIncompleto' }]);
  assert.equal(real.periodo.mesesActivos, 10);
  assert.ok(Math.abs(real.periodo.millas - 66467.15) < 0.01, `millas ${real.periodo.millas}`);

  // CPM de decisión (validado por Claude y ChatGPT: $0.76412)
  assert.ok(Math.abs(real.cpm - 0.76412) < 5e-6, `cpm ${real.cpm}`);
  assert.ok(Math.abs(real.desglose.cpmContable - 0.76235) < 5e-6, `contable ${real.desglose.cpmContable}`);
  assert.equal(real.desglose.combustibleFuente, 'reciente');

  // Criterios
  assert.equal(real.confiable, true, JSON.stringify(real.motivos));
  assert.ok(real.combustibleVsEsperado > 0.5 && real.combustibleVsEsperado < 1.5);
  assert.equal(real.cobertura.insurance.significativos, 11);   // el pago de $24.88 no cuenta
  assert.equal(real.cobertura.insurance.cumple, true);
  assert.equal(real.cobertura.carpayment.significativos, 10);
  assert.equal(real.cobertura.carpayment.cumple, true);
  assert.deepEqual(real.avisos, []);                           // 69 % de la meta: sin aviso

  // Candidato único (decisión 11): seguro de $2,705.03 del 11-09-2025
  assert.equal(real.candidatosExtraordinarios.length, 1);
  const c = real.candidatosExtraordinarios[0];
  assert.equal(c.categoria, 'insurance');
  assert.equal(c.fecha, '2025-09-11');
  assert.ok(Math.abs(c.importe - 2705.03) < 0.005);
  assert.equal(c.marcadoNoRecurrente, false);

  // Antigüedad (§4.6): último periodo confiable marzo 2026, hoy noviembre 2026
  assert.equal(real.antiguedadMeses, 8);
  assert.equal(real.datosAntiguos, true);

  // Sin elección: provisional = el mayor; pide elegir y revisar
  assert.equal(r.fuente, 'provisional');
  assert.ok(Math.abs(r.cpmAplicado - 0.76412) < 5e-6);
  assert.equal(r.requiereEleccion, true);
  assert.equal(r.requiereRevision, true);
});
