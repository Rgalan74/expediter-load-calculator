/**
 * Pruebas del bloque 1b del motor financiero: resolución del CPM.
 * Ejecutar:  npm test
 *
 * Datos sintéticos. Historial "maduro" de referencia: 12 meses (ene–dic 2025),
 * 5,000 mi/mes en 5 cargas; gastos mensuales: combustible $1,000 (0.20/mi),
 * seguro $1,250, vehículo $900, comida $200, peajes $50.
 *   resto sin peajes = (1250 + 900 + 200) × 12 / 60,000 = 0.47/mi
 *   combustible reciente (oct–dic) = 3,000 / 15,000      = 0.20/mi
 *   CPM real                                            = 0.67/mi
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FE = require('../public/js/core/financial-engine.js');

const cerca = (real, esperado, tol = 1e-9) =>
  assert.ok(Math.abs(real - esperado) <= tol, `esperado ${esperado}, obtenido ${real}`);

const MESES_2025 = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];

const CONFIG = {
  completa: true, cpm: 0.55, combustibleEsperadoPorMilla: 0.20,
  seguroMensual: 1250, pagoVehiculoMensual: 900, metaMillasMes: 6000
};

let siguienteId = 1;
function mes(ym, { millas = 5000, cargas = 5, fuel = 1000, insurance = 1250, carpayment = 900, food = 200, tolls = 50, extra = [] } = {}) {
  const c = [];
  for (let i = 0; i < cargas; i++) c.push({ fecha: `${ym}-1${i}`, millas: millas / cargas });
  const g = [];
  const add = (categoria, importe) => { if (importe > 0) g.push({ id: `g${siguienteId++}`, fecha: `${ym}-15`, categoria, importe }); };
  add('fuel', fuel); add('insurance', insurance); add('carpayment', carpayment); add('food', food); add('tolls', tolls);
  extra.forEach(([categoria, importe, id]) => g.push({ id: id || `g${siguienteId++}`, fecha: `${ym}-20`, categoria, importe }));
  return { cargas: c, gastos: g };
}
function historial(meses) {
  return meses.reduce((acc, m) => ({ cargas: acc.cargas.concat(m.cargas), gastos: acc.gastos.concat(m.gastos) }), { cargas: [], gastos: [] });
}
const maduro = (cambios = {}) => historial(MESES_2025.map(ym => mes(ym, cambios[ym] || {})));
const resolver = (h, extra = {}) => FE.resolverCpm({ ...h, configuracion: CONFIG, mesActual: '2026-01', ...extra });

// ---------------------------------------------------------------- cálculo base
test('§4.3: CPM real = resto sin peajes por milla + combustible reciente', () => {
  const r = resolver(maduro()).real;
  assert.equal(r.confiable, true, JSON.stringify(r.motivos));
  assert.equal(r.periodo.desde, '2025-01');
  assert.equal(r.periodo.hasta, '2025-12');
  cerca(r.periodo.millas, 60000);
  cerca(r.desglose.restoPorMilla, 0.47);
  cerca(r.desglose.combustiblePorMilla, 0.20);
  cerca(r.cpm, 0.67);
  assert.equal(r.desglose.combustibleFuente, 'reciente');
});

test('§5: el CPM real excluye peajes; el contable los incluye (identidad de control)', () => {
  const r = resolver(maduro()).real;
  cerca(r.desglose.peajes, 600);
  cerca(r.desglose.cpmContable, (1000 + 1250 + 900 + 200 + 50) * 12 / 60000);
  cerca(r.desglose.peajesPorMilla + r.desglose.restoPorMilla + r.desglose.combustible / r.periodo.millas, r.desglose.cpmContable);
});

test('categorías marcadas como no operativas no cuentan', () => {
  const h = maduro({ '2025-06': { extra: [['custom-personal', 6000]] } });
  const r = FE.resolverCpm({ ...h, configuracion: CONFIG, mesActual: '2026-01', categoriasNoOperativas: ['custom-personal'] }).real;
  cerca(r.cpm, 0.67);
});

test('§8: millas de cargas con campos antiguos se leen sin reescribirlos', () => {
  assert.equal(FE.millasDeCarga({ totalMiles: 500 }), 500);
  assert.equal(FE.millasDeCarga({ miles: '420' }), 420);
  assert.equal(FE.millasDeCarga({ loaded: 300, deadhead: 50 }), 350);
  assert.equal(FE.millasDeCarga({ loadedMiles: 300, deadheadMiles: 40 }), 340);
  assert.equal(FE.millasDeCarga({}), 0);
});

test('meses finales por debajo del umbral de actividad no forman parte del periodo', () => {
  const cambios = {};
  ['2025-10', '2025-11', '2025-12'].forEach(m => { cambios[m] = { millas: 300, cargas: 1, fuel: 60 }; });
  const r = resolver(maduro(cambios)).real;
  assert.equal(r.periodo.hasta, '2025-09');
});

test('combustible reciente < 0.5× el del periodo -> se usa el del periodo completo', () => {
  // oct–dic con combustible bajo pero no tanto como para ser meses incompletos (≥ 0.5× esperado)
  const cambios = {};
  ['2025-10', '2025-11', '2025-12'].forEach(m => { cambios[m] = { fuel: 510 }; }); // 0.102/mi
  MESES_2025.slice(0, 9).forEach(m => { cambios[m] = { fuel: 2000 }; });         // 0.40/mi
  const r = resolver(maduro(cambios)).real;
  assert.equal(r.desglose.combustibleFuente, 'periodo');
  cerca(r.desglose.combustiblePorMilla, (2000 * 9 + 510 * 3) / 60000);
});

// ---------------------------------------------------------------- meses incompletos (decisión 9)
test('decisión 9: el mes en curso se excluye siempre, aunque esté completo', () => {
  const h = historial([...MESES_2025.map(ym => mes(ym)), mes('2026-01')]);
  const r = resolver(h).real;
  assert.equal(r.periodo.hasta, '2025-12');
  assert.ok(r.excluidos.some(e => e.mes === '2026-01' && e.motivo === 'mesEnCurso'));
  cerca(r.cpm, 0.67);
});

test('decisión 9: un mes final sin combustible se excluye con millas y gastos', () => {
  const r = resolver(maduro({ '2025-12': { fuel: 0 } })).real;
  assert.equal(r.confiable, true, JSON.stringify(r.motivos));
  assert.equal(r.periodo.hasta, '2025-11');
  assert.deepEqual(r.excluidos, [{ mes: '2025-12', motivo: 'mesFinalIncompleto' }]);
  cerca(r.periodo.millas, 55000);
});

test('decisión 9: varios meses finales incompletos consecutivos se excluyen', () => {
  const vacio = { fuel: 0, insurance: 0, carpayment: 0, food: 0, tolls: 0 };
  const r = resolver(maduro({ '2025-11': vacio, '2025-12': vacio })).real;
  assert.equal(r.periodo.hasta, '2025-10');
  assert.deepEqual(r.excluidos.map(e => e.mes), ['2025-12', '2025-11']);
});

test('decisión 9: mes final con combustible < 0.5× el esperado es incompleto', () => {
  const r = resolver(maduro({ '2025-12': { fuel: 400 } })).real; // 0.08/mi vs 0.20 esperado
  assert.equal(r.periodo.hasta, '2025-11');
});

test('decisión 9: un mes intermedio incompleto bloquea la confiabilidad', () => {
  const r = resolver(maduro({ '2025-06': { fuel: 0 } })).real;
  assert.equal(r.confiable, false);
  assert.ok(r.motivos.includes('mesIntermedioIncompleto:2025-06'));
});

test('decisión 9: si tras excluir quedan menos de 3 meses activos, no es confiable', () => {
  const h = historial(['2025-09', '2025-10', '2025-11', '2025-12'].map((ym, i) => mes(ym, i >= 2 ? { fuel: 0 } : {})));
  const r = resolver(h).real;
  assert.equal(r.confiable, false);
  assert.ok(r.motivos.includes('pocosMesesActivos'));
});

test('decisión 9: los registros originales no se modifican', () => {
  const h = maduro({ '2025-12': { fuel: 0 } });
  const copia = JSON.parse(JSON.stringify(h));
  resolver(h);
  assert.deepEqual(h, copia);
});

// ---------------------------------------------------------------- meses con poca actividad (decisión 12)
test('decisión 12: mes interior con poca actividad -> cuentan sus millas y sus gastos', () => {
  const r = resolver(maduro({ '2025-07': { millas: 800, cargas: 1, fuel: 160 } })).real;
  assert.equal(r.periodo.mesesActivos, 11);
  cerca(r.periodo.millas, 55800);
  assert.equal(r.confiable, true, JSON.stringify(r.motivos));
});

test('decisión 12: el mismo mes sin combustible no bloquea (no es mes con actividad)', () => {
  const r = resolver(maduro({ '2025-07': { millas: 800, cargas: 1, fuel: 0 } })).real;
  assert.ok(!r.motivos.some(m => m.startsWith('mesIntermedioIncompleto')));
});

test('decisión 12: mes con poca actividad posterior al último activo -> fuera, con sus gastos', () => {
  const r = resolver(maduro({ '2025-12': { millas: 500, cargas: 1, fuel: 100 } })).real;
  assert.equal(r.periodo.hasta, '2025-11');
  cerca(r.periodo.millas, 55000);
  cerca(r.desglose.totalGastos, (1000 + 1250 + 900 + 200 + 50) * 11);
});

test('decisión 12: mes con poca actividad anterior al primero activo -> fuera, con sus gastos', () => {
  const r = resolver(maduro({ '2025-01': { millas: 500, cargas: 1, fuel: 100 } })).real;
  assert.equal(r.periodo.desde, '2025-02');
});

test('mes de pausa intermedio (sin millas) -> sus gastos cuentan', () => {
  const r = resolver(maduro({ '2025-06': { millas: 0, cargas: 0, fuel: 0, food: 0, tolls: 0 } })).real;
  assert.equal(r.confiable, true, JSON.stringify(r.motivos));
  cerca(r.desglose.porCategoria.insurance, 1250 * 12);
  cerca(r.periodo.millas, 55000);
});

// ---------------------------------------------------------------- criterios que bloquean
test('criterio 1: menos de 20 cargas -> no confiable', () => {
  const h = historial(['2025-10', '2025-11', '2025-12'].map(ym => mes(ym, { cargas: 2 })));
  assert.ok(resolver(h).real.motivos.includes('historialInsuficiente'));
});

test('criterio 3: combustible > 1.5× el esperado -> posibles cargas sin registrar', () => {
  const cambios = {};
  MESES_2025.forEach(m => { cambios[m] = { fuel: 1750 }; }); // 0.35/mi
  assert.ok(resolver(maduro(cambios)).real.motivos.includes('combustibleAlto:posiblesCargasSinRegistrar'));
});

test('criterio 3: sin MPG/precio se usa el rango absoluto $0.10–$0.50', () => {
  const cambios = {};
  MESES_2025.forEach(m => { cambios[m] = { fuel: 250 }; }); // 0.05/mi
  const r = FE.resolverCpm({ ...maduro(cambios), configuracion: { ...CONFIG, combustibleEsperadoPorMilla: null }, mesActual: '2026-01' }).real;
  assert.ok(r.motivos.includes('combustibleFueraDeRango'));
});

test('criterio 4: cumple por número de pagos aunque falle por importe (póliza nueva más cara)', () => {
  const r = FE.resolverCpm({ ...maduro(), configuracion: { ...CONFIG, seguroMensual: 2000 }, mesActual: '2026-01' }).real;
  const c = r.cobertura.insurance;
  assert.ok(c.pctImporte < 0.8);
  assert.equal(c.significativos, 12);
  assert.equal(c.cumple, true);
});

test('criterio 4: cumple por importe con pagos acumulados', () => {
  const cambios = {};
  MESES_2025.forEach((m, i) => { cambios[m] = { insurance: i % 2 ? 2500 : 0 }; });
  const c = resolver(maduro(cambios)).real.cobertura.insurance;
  assert.equal(c.significativos, 6);
  assert.ok(c.pctImporte >= 0.8);
  assert.equal(c.cumple, true);
});

test('criterio 4: pagos muy pequeños no cuentan como cobertura', () => {
  const cambios = {};
  MESES_2025.forEach(m => { cambios[m] = { insurance: 24.88 }; });
  const r = resolver(maduro(cambios)).real;
  assert.equal(r.cobertura.insurance.significativos, 0);
  assert.ok(r.motivos.includes('coberturaFijos:insurance'));
});

test('criterio 4: pago del vehículo $0 no se exige', () => {
  const cambios = {};
  MESES_2025.forEach(m => { cambios[m] = { carpayment: 0 }; });
  const r = FE.resolverCpm({ ...maduro(cambios), configuracion: { ...CONFIG, pagoVehiculoMensual: 0 }, mesActual: '2026-01' }).real;
  assert.equal(r.cobertura.carpayment, undefined);
  assert.equal(r.confiable, true, JSON.stringify(r.motivos));
});

test('criterio 4: un mes de pausa cuenta como mes del periodo', () => {
  const r = resolver(maduro({ '2025-06': { millas: 0, cargas: 0, fuel: 0, insurance: 0, carpayment: 0 } })).real;
  assert.equal(r.cobertura.insurance.exigidos, 11); // 12 meses del periodo − 1
  assert.equal(r.cobertura.insurance.significativos, 11);
});

test('criterio 5: millas < 40 % de la meta solo producen aviso', () => {
  const r = FE.resolverCpm({ ...maduro(), configuracion: { ...CONFIG, metaMillasMes: 20000 }, mesActual: '2026-01' }).real;
  assert.ok(r.avisos.includes('millasMuyPorDebajoDeLaMeta'));
  assert.equal(r.confiable, true);
});

// ---------------------------------------------------------------- candidatos a extraordinario (§6)
test('§6: combustible y peajes nunca son candidatos', () => {
  const r = resolver(maduro({ '2025-05': { fuel: 9000, tolls: 5000 } })).real;
  assert.equal(r.candidatosExtraordinarios.length, 0);
});

test('§6: categoría con ≥ 3 movimientos: ≥ 5 % del total y ≥ 2× mediana -> candidato', () => {
  const r = resolver(maduro({ '2025-05': { insurance: 5000 } })).real;
  assert.deepEqual(r.candidatosExtraordinarios.map(c => [c.categoria, c.importe]), [['insurance', 5000]]);
});

test('§6: ≥ 5 % del total pero < 2× mediana -> no candidato', () => {
  const r = resolver(maduro({ '2025-05': { insurance: 2400 } })).real;
  assert.equal(r.candidatosExtraordinarios.length, 0);
});

test('§6: pago de vehículo acumulado -> no candidato', () => {
  const r = resolver(maduro({ '2025-05': { carpayment: 0 }, '2025-06': { carpayment: 1800 } })).real;
  assert.equal(r.candidatosExtraordinarios.length, 0);
});

test('§6: categoría con < 3 movimientos -> solo materialidad', () => {
  const r = resolver(maduro({ '2025-08': { extra: [['repairs', 3000]] } })).real;
  assert.deepEqual(r.candidatosExtraordinarios.map(c => c.categoria), ['repairs']);
});

test('decisiones 2 y 11: candidato sin marcar cuenta entero y no se modifica; marcado -> se reparte en 12 meses', () => {
  const h = maduro({ '2025-05': { extra: [['repairs', 6000, 'reparacion-1']] } });
  const sinMarcar = resolver(h).real;
  assert.equal(sinMarcar.candidatosExtraordinarios[0].marcadoNoRecurrente, false);
  cerca(sinMarcar.desglose.porCategoria.repairs, 6000);
  const marcado = resolver(h, { gastosNoRecurrentes: ['reparacion-1'] }).real;
  cerca(marcado.desglose.porCategoria.repairs, 6000 * 8 / 12); // may–dic = 8 meses del periodo
  assert.ok(marcado.cpm < sinMarcar.cpm);
  assert.equal(h.gastos.find(g => g.id === 'reparacion-1').importe, 6000);
});

// ---------------------------------------------------------------- antigüedad (§4.6)
test('§4.6: datos de hace ≤ 6 meses no son antiguos', () => {
  const r = resolver(maduro(), { mesActual: '2026-06' }).real;
  assert.equal(r.antiguedadMeses, 6);
  assert.equal(r.datosAntiguos, false);
});

test('§4.6: actividad terminada hace > 6 meses -> datos antiguos', () => {
  const r = resolver(maduro(), { mesActual: '2026-09' }).real;
  assert.equal(r.antiguedadMeses, 9);
  assert.equal(r.datosAntiguos, true);
  assert.equal(r.confiable, true);
});

// ---------------------------------------------------------------- elección y regla de no bajar (§4.4, §4.5)
test('§4.1: sin configuración mínima no hay CPM para decidir', () => {
  for (const configuracion of [{ ...CONFIG, completa: false }, { ...CONFIG, cpm: null }]) {
    const r = FE.resolverCpm({ ...maduro(), configuracion, mesActual: '2026-01' });
    assert.equal(r.etapa, 'A');
    assert.equal(r.cpmAplicado, null);
  }
});

test('§4.4: historial no confiable -> CPM de Configuración (etapa B)', () => {
  const r = resolver(maduro({ '2025-06': { fuel: 0 } }));
  assert.equal(r.etapa, 'B');
  assert.equal(r.cpmAplicado, 0.55);
});

test('§4.4: confiable y sin elección -> el mayor de los dos, provisional, pide elegir', () => {
  const r = resolver(maduro());
  assert.equal(r.fuente, 'provisional');
  cerca(r.cpmAplicado, 0.67);
  assert.equal(r.requiereEleccion, true);
  const conConfigMayor = FE.resolverCpm({ ...maduro(), configuracion: { ...CONFIG, cpm: 0.80 }, mesActual: '2026-01' });
  cerca(conConfigMayor.cpmAplicado, 0.80);
});

test('§4.4: eligió Configuración -> se respeta; pide elegir si la diferencia cambia > 15 %', () => {
  const sinCambio = resolver(maduro(), { preferencia: { fuente: 'configuracion', cpmReal: 0.67, cpmConfig: 0.55 } });
  assert.equal(sinCambio.cpmAplicado, 0.55);
  assert.equal(sinCambio.requiereEleccion, false);
  const conCambio = resolver(maduro(), { preferencia: { fuente: 'configuracion', cpmReal: 0.55, cpmConfig: 0.55 } });
  assert.equal(conCambio.requiereEleccion, true);
});

test('§4.4: eligió el real -> sigue a sus datos, también hacia abajo', () => {
  const cambios = {};
  MESES_2025.forEach(m => { cambios[m] = { food: 0 }; }); // resto 0.43 -> CPM 0.63
  const r = resolver(maduro(cambios), { preferencia: { fuente: 'real', cpmReal: 0.67, cpmConfig: 0.55 } });
  assert.equal(r.fuente, 'real');
  cerca(r.cpmAplicado, 0.63);
  assert.equal(r.requiereEleccion, false);
});

test('§4.5: eligió el real y deja de ser confiable -> referencia temporal = máximo(último real, config)', () => {
  const h = maduro({ '2025-06': { fuel: 0 } });
  const r = resolver(h, {
    preferencia: { fuente: 'real', cpmReal: 0.76, cpmConfig: 0.51 },
    ultimoCpmRealConfiable: { valor: 0.76, periodoHasta: '2025-10' }
  });
  assert.equal(r.fuente, 'referenciaTemporal');
  cerca(r.cpmAplicado, 0.76);
  assert.equal(r.requiereRevision, false);
});

test('§4.5: referencia vencida (> 6 meses) conserva su valor, no baja y pide revisión', () => {
  const r = FE.resolverCpm({
    ...maduro({ '2025-06': { fuel: 0 } }),
    configuracion: { ...CONFIG, cpm: 0.51 },
    mesActual: '2026-09',
    preferencia: { fuente: 'real', cpmReal: 0.76, cpmConfig: 0.51 },
    ultimoCpmRealConfiable: { valor: 0.76, periodoHasta: '2025-12' }
  });
  assert.equal(r.fuente, 'referenciaVencida');
  cerca(r.cpmAplicado, 0.76);
  assert.equal(r.requiereRevision, true);
});

test('§4.6: eligió el real con datos antiguos -> conserva el valor y pide revisión', () => {
  const r = resolver(maduro(), { mesActual: '2026-09', preferencia: { fuente: 'real', cpmReal: 0.67, cpmConfig: 0.55 } });
  cerca(r.cpmAplicado, 0.67);
  assert.equal(r.requiereRevision, true);
  assert.match(r.etiqueta, /Datos antiguos/);
});

test('regla general: ningún camino automático aplica un CPM menor que el de Configuración ni que la referencia', () => {
  const casos = [
    resolver(maduro()),
    resolver(maduro(), { mesActual: '2026-09' }),
    resolver(maduro({ '2025-06': { fuel: 0 } }), { preferencia: { fuente: 'real', cpmReal: 0.9, cpmConfig: 0.55 }, ultimoCpmRealConfiable: { valor: 0.9, periodoHasta: '2025-05' } }),
    resolver(maduro({ '2025-06': { fuel: 0 } }), { mesActual: '2027-01', preferencia: { fuente: 'real', cpmReal: 0.9, cpmConfig: 0.55 }, ultimoCpmRealConfiable: { valor: 0.9, periodoHasta: '2025-05' } })
  ];
  casos.forEach(r => assert.ok(r.cpmAplicado >= 0.55, r.fuente));
  assert.ok(casos[2].cpmAplicado >= 0.9 && casos[3].cpmAplicado >= 0.9);
});

test('mesActual es obligatorio', () => {
  assert.throws(() => FE.resolverCpm({ ...maduro(), configuracion: CONFIG }), /mesActual/);
});

// ---------------------------------------------------------------- auditoría ChatGPT (fase 1)
test('auditoría: transición provisional -> historial incompleto sin elección: el CPM no baja', () => {
  // Momento 1: historial confiable, sin elección -> provisional 0.67 (> config 0.55)
  const m1 = resolver(maduro());
  assert.equal(m1.fuente, 'provisional');
  cerca(m1.cpmAplicado, 0.67);
  // El motor indica qué guardar para el momento siguiente (valor calculado, no inventado)
  assert.deepEqual(m1.guardar.ultimoCpmRealConfiable, { valor: m1.real.cpm, periodoHasta: '2025-12' });

  // Momento 2: el historial pasa a incompleto; el conductor sigue sin elegir
  const m2 = resolver(maduro({ '2025-06': { fuel: 0 } }), { ultimoCpmRealConfiable: m1.guardar.ultimoCpmRealConfiable });
  assert.equal(m2.real.confiable, false);
  assert.ok(m2.cpmAplicado >= m1.cpmAplicado, `bajó de ${m1.cpmAplicado} a ${m2.cpmAplicado}`);
  assert.equal(m2.fuente, 'referenciaTemporal');
  assert.equal(m2.preferencia, null); // no se crea ni cambia ninguna preferencia
});

test('auditoría: la referencia anterior vence a los 6 meses, conserva el valor y pide revisión', () => {
  const ultimo = { valor: 0.67, periodoHasta: '2025-12' };
  const r = resolver(maduro({ '2025-06': { fuel: 0 } }), { mesActual: '2026-08', ultimoCpmRealConfiable: ultimo });
  assert.equal(r.fuente, 'referenciaVencida');
  cerca(r.cpmAplicado, 0.67);
  assert.equal(r.requiereRevision, true);
});

test('auditoría: sin ninguna referencia anterior guardada, el historial no confiable usa Configuración', () => {
  const r = resolver(maduro({ '2025-06': { fuel: 0 } }));
  assert.equal(r.fuente, 'configuracion');
  assert.equal(r.cpmAplicado, 0.55);
});

test('auditoría: si el conductor eligió Configuración, una referencia anterior no la sustituye', () => {
  const r = resolver(maduro({ '2025-06': { fuel: 0 } }), {
    preferencia: { fuente: 'configuracion', cpmReal: 0.67, cpmConfig: 0.55 },
    ultimoCpmRealConfiable: { valor: 0.67, periodoHasta: '2025-12' }
  });
  assert.equal(r.fuente, 'configuracion');
  assert.equal(r.cpmAplicado, 0.55);
});

// ---------------------------------------------------------------- prorrateo lineal por solape (decisión 2, auditoría fase 1)
const MESES_2024_2026 = [];
for (let y = 2024; y <= 2026; y++) for (let m = 1; m <= 12; m++) MESES_2024_2026.push(`${y}-${String(m).padStart(2, '0')}`);
// 16 meses activos (2025-01 .. 2026-04) -> periodo = últimos 12 activos = 2025-05 .. 2026-04
const largo = (extraGastos = []) => {
  const h = historial(MESES_2024_2026.filter(m => m >= '2025-01' && m <= '2026-04').map(ym => mes(ym)));
  h.gastos = h.gastos.concat(extraGastos);
  return h;
};
const resolverLargo = (h, marcados) => FE.resolverCpm({ ...h, configuracion: CONFIG, mesActual: '2026-05', gastosNoRecurrentes: marcados }).real;

test('prorrateo: las 12 asignaciones mensuales suman exactamente el gasto original (al centavo)', () => {
  for (const importe of [6000, 2705.03, 1000.01, 0.05, 12345.67]) {
    const a = FE.asignacionMensualNoRecurrente(importe, '2025-02');
    assert.equal(a.length, 12);
    assert.equal(a.reduce((s, x) => s + x.centavos, 0), Math.round(importe * 100), `importe ${importe}`);
    assert.ok(Math.abs(a.reduce((s, x) => s + x.importe, 0) - importe) < 0.005);
    assert.deepEqual(a.map(x => x.mes), MESES_2024_2026.slice(13, 25)); // 2025-02 .. 2026-01, consecutivos
    assert.ok(a.slice(0, 11).every(x => x.centavos === a[0].centavos)); // el último absorbe la diferencia
  }
});

test('prorrateo: gasto marcado ANTERIOR al periodo cuenta sus mensualidades que caen dentro (9/12)', () => {
  const r = resolverLargo(largo([{ id: 'rep', fecha: '2025-02-10', categoria: 'repairs', importe: 6000 }]), ['rep']);
  assert.equal(r.periodo.desde, '2025-05');
  cerca(r.desglose.porCategoria.repairs, 4500); // mayo 2025 .. enero 2026 = 9 × $500
});

test('prorrateo: gasto marcado sin ningún mes dentro del periodo cuenta 0', () => {
  const r = resolverLargo(largo([{ id: 'rep', fecha: '2024-03-10', categoria: 'repairs', importe: 6000 }]), ['rep']);
  assert.equal(r.desglose.porCategoria.repairs, undefined);
});

test('prorrateo: gasto SIN marcar anterior al periodo no cuenta (sin cambios)', () => {
  const r = resolverLargo(largo([{ id: 'rep', fecha: '2025-02-10', categoria: 'repairs', importe: 6000 }]), []);
  assert.equal(r.desglose.porCategoria.repairs, undefined);
});

test('prorrateo: un periodo que contiene sus 12 meses cuenta exactamente el importe', () => {
  const r = resolverLargo(largo([{ id: 'rep', fecha: '2025-05-10', categoria: 'repairs', importe: 2705.03 }]), ['rep']);
  assert.ok(Math.abs(r.desglose.porCategoria.repairs - 2705.03) < 1e-9);
});

test('prorrateo: el aporte dentro de un periodo es la suma de SUS asignaciones en ese periodo (sin sumar periodos superpuestos)', () => {
  const asignaciones = FE.asignacionMensualNoRecurrente(2705.03, '2025-02');
  const esperado = asignaciones.filter(a => a.mes >= '2025-05' && a.mes <= '2026-04').reduce((s, a) => s + a.importe, 0);
  const r = resolverLargo(largo([{ id: 'rep', fecha: '2025-02-10', categoria: 'repairs', importe: 2705.03 }]), ['rep']);
  cerca(r.desglose.porCategoria.repairs, esperado);
});

test('prorrateo: el gasto marcado anterior no cuenta para cobertura, meses con gastos ni candidatos; el registro no cambia', () => {
  const extra = { id: 'seg', fecha: '2025-02-10', categoria: 'insurance', importe: 9000 };
  const h = largo([extra]);
  const sinMarcar = resolverLargo(h, []);
  const marcado = resolverLargo(h, ['seg']);
  assert.deepEqual(marcado.cobertura.insurance, sinMarcar.cobertura.insurance);
  assert.equal(marcado.candidatosExtraordinarios.length, 0);
  assert.equal(h.gastos.find(g => g.id === 'seg').importe, 9000);
  cerca(marcado.desglose.porCategoria.insurance - sinMarcar.desglose.porCategoria.insurance, 9000 * 9 / 12);
});
