/**
 * Pruebas del bloque 1a del motor financiero: evaluación de una carga.
 * Ejecutar:  node --test tests/
 *
 * Las marcadas [prototipo] reutilizan los casos del prototipo de ChatGPT
 * (financial-engine.test.mjs), adaptados a la especificación 7.1.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FE = require('../public/js/core/financial-engine.js');

const TOL = 1e-9;
const cerca = (real, esperado, tol = TOL) =>
  assert.ok(Math.abs(real - esperado) <= tol, `esperado ${esperado}, obtenido ${real}`);

// Carga base del prototipo: $750, 500 mi cargadas + 100 deadhead, CPM 0.534
const ENTRADAS = { tarifa: 750, millasCargadas: 500, millasDeadhead: 100 };
const SUPUESTOS = {
  configuracionCompleta: true,
  cpmBase: 0.534,
  combustiblePorMilla: 0.195,
  margenObjetivo: 0.30,
  rpmMinimo: 0,
  margenNegociacion: 0.08
};
const evaluar = (e = {}, s = {}) => FE.evaluarCarga({ ...ENTRADAS, ...e }, { ...SUPUESTOS, ...s });

// ---------------------------------------------------------------- prototipo
test('[prototipo] carga básica: $750 / 600 mi, CPM 0.534', () => {
  const r = evaluar();
  cerca(r.rpm.total, 1.25);
  cerca(r.costos.operativo, 320.4);
  cerca(r.gananciaEstimada, 429.6);
  assert.equal(r.naturaleza, 'ESTIMACION');
});

test('[prototipo] Extras confirmados son ingreso, no gasto', () => {
  const r = evaluar({ extrasConfirmados: 20 });
  cerca(r.ingresos.total, 770);
  cerca(r.rpm.total, 770 / 600);
  cerca(r.gananciaEstimada, 449.6);
});

test('[prototipo] toll de la carga reduce la ganancia pero no el ingreso', () => {
  const r = evaluar({ tollCarga: 50 });
  cerca(r.ingresos.total, 750);
  cerca(r.costos.peajeEstimado, 50);
  cerca(r.gananciaEstimada, 379.6);
});

test('[prototipo] Extras y toll respetan sus signos', () => {
  cerca(evaluar({ extrasConfirmados: 20, tollCarga: 50 }).gananciaEstimada, 399.6);
});

test('[prototipo] una pérdida queda negativa, nunca se fuerza a cero', () => {
  cerca(evaluar({ tarifa: 100 }).gananciaEstimada, -220.4);
});

test('[prototipo] un CPM de cero es válido y se respeta', () => {
  const r = evaluar({}, { cpmBase: 0, combustiblePorMilla: 0 });
  assert.equal(r.costos.cpmBase, 0);
  cerca(r.gananciaEstimada, 750);
});

test('[prototipo, adaptada] el combustible es parte del CPM: no puede superarlo (sin doble conteo)', () => {
  assert.throws(() => evaluar({}, { cpmBase: 0.534, combustiblePorMilla: 0.6 }), /combustiblePorMilla/);
  const r = evaluar();
  cerca(r.costos.combustible + r.costos.restoOperativo, r.costos.operativo);
});

test('[prototipo] entradas inválidas producen error, no resultados engañosos', () => {
  assert.throws(() => evaluar({ millasDeadhead: -20 }), /millasDeadhead/);
  assert.throws(() => evaluar({ tarifa: NaN }), /tarifa/);
  assert.throws(() => evaluar({ tarifa: '750' }), /tarifa/);
  assert.throws(() => evaluar({ millasCargadas: 0, millasDeadhead: 0 }), /millasTotales/);
  assert.throws(() => evaluar({}, { cpmBase: Infinity }), /cpmBase/);
  assert.throws(() => FE.evaluarCarga(null, SUPUESTOS), /entradas/);
});

test('[prototipo] el snapshot es una copia independiente y no se puede modificar', () => {
  const entradas = { ...ENTRADAS, extrasConfirmados: 30 };
  const supuestos = { ...SUPUESTOS };
  const r = FE.evaluarCarga(entradas, supuestos);
  entradas.extrasConfirmados = 900;
  supuestos.cpmBase = 9;
  assert.equal(r.snapshot.entradas.extrasConfirmados, 30);
  assert.equal(r.snapshot.supuestos.cpmBase, 0.534);
  assert.ok(Object.isFrozen(r.snapshot) && Object.isFrozen(r.snapshot.entradas));
  assert.equal(r.formulaVersion, FE.FORMULA_VERSION);
});

test('[prototipo, decisión de Ricardo] sin ingresos el margen es null (N/D) y el RPM es 0', () => {
  const r = evaluar({ tarifa: 0 });
  assert.equal(r.margenEstimado, null);
  assert.equal(r.rpm.total, 0);
});

// ---------------------------------------------------------------- especificación 7.1
test('§3.3: sin redondeo en el resultado', () => {
  const r = evaluar({ tarifa: 100, millasCargadas: 3, millasDeadhead: 0 });
  assert.equal(r.rpm.total, 100 / 3);
});

test('§5: toll vacío, null o ausente = $0 (no se presupone peaje)', () => {
  for (const v of ['', null, undefined]) {
    const r = evaluar({ tollCarga: v });
    assert.equal(r.costos.peajeEstimado, 0);
    cerca(r.gananciaEstimada, 429.6);
  }
});

test('§4.1 / decisión #8: sin configuración mínima solo hay tarifa, millas y RPM', () => {
  for (const s of [null, undefined, { configuracionCompleta: false, cpmBase: 0.5 }]) {
    const r = FE.evaluarCarga({ ...ENTRADAS, tollCarga: 20 }, s);
    assert.equal(r.estado, 'sinConfiguracion');
    cerca(r.rpm.tarifa, 1.25);
    assert.equal(r.millas.deadhead, 100);
    assert.equal(r.gananciaEstimada, undefined);
    assert.equal(r.decision, undefined);
    assert.equal(r.contraoferta, undefined);
    assert.equal(r.umbrales, undefined);
    assert.equal(r.snapshot.supuestos, null);
  }
});

test('§2: Extras no confirmados no son ingreso; se muestran como posible adicional', () => {
  const r = evaluar({ extrasNoConfirmados: 75 });
  cerca(r.ingresos.total, 750);
  cerca(r.ingresos.posibleAdicional, 75);
  cerca(r.gananciaEstimada, 429.6);
});

test('§7.1: ACEPTAR cuando cumple objetivo y RPM mínimo; sin contraoferta', () => {
  const r = evaluar({}, { rpmMinimo: 0.85 });
  assert.equal(r.decision, 'ACEPTAR');
  assert.deepEqual(r.incumple, []);
  assert.equal(r.contraoferta, null);
});

test('§7.1: RECHAZAR cuando el RPM total no cubre los costos', () => {
  const r = evaluar({ tarifa: 300 });
  assert.equal(r.decision, 'RECHAZAR');
  assert.deepEqual(r.incumple, ['costos']);
});

test('§7.1: el toll de la carga sube el umbral de costos', () => {
  const r = evaluar({ tollCarga: 60 });
  cerca(r.umbrales.costos, 0.534 + 60 / 600);
});

test('§7.1: Extras confirmados cumplen el objetivo, pero el RPM de tarifa no llega al mínimo -> EVALUAR', () => {
  // tarifa 420 (0.70/mi) + 100 de extras = 520 (0.8667/mi) >= objetivo 0.7629; mínimo 0.85 sobre tarifa
  const r = evaluar({ tarifa: 420, extrasConfirmados: 100 }, { rpmMinimo: 0.85 });
  assert.ok(r.rpm.total >= r.umbrales.objetivo);
  assert.equal(r.decision, 'EVALUAR');
  assert.deepEqual(r.incumple, ['rpmMinimo']);
});

test('§7.1: objetivo = máximo entre sueldo y margen (gana el sueldo)', () => {
  const r = evaluar({}, { sueldoPorDia: 4000 / 22, diasCarga: 1 });
  cerca(r.umbrales.objetivoMargen, 0.534 / 0.7);
  cerca(r.umbrales.objetivoSueldo, 0.534 + (4000 / 22) / 600);
  assert.equal(r.umbrales.objetivoTipo, 'sueldo');
  cerca(r.umbrales.objetivo, r.umbrales.objetivoSueldo);
});

test('§7.1: objetivo = máximo entre sueldo y margen (gana el margen); no se suman', () => {
  const r = evaluar({}, { sueldoPorDia: 50, diasCarga: 1 });
  assert.equal(r.umbrales.objetivoTipo, 'margen');
  cerca(r.umbrales.objetivo, 0.534 / 0.7);
  assert.ok(r.umbrales.objetivo < r.umbrales.objetivoMargen + r.umbrales.objetivoSueldo - 0.534);
});

test('§7.1: sin sueldo, el objetivo es el margen y objetivoSueldo es null', () => {
  const r = evaluar();
  assert.equal(r.umbrales.objetivoSueldo, null);
  assert.equal(r.umbrales.objetivoTipo, 'margen');
});

test('§7.1: el promedio histórico de RPM eleva el umbral de aceptar', () => {
  const r = evaluar({}, { rpmPromedioHistorico: 1.30 });
  cerca(r.umbrales.aceptar, 1.30);
  assert.equal(r.decision, 'EVALUAR');
});

test('§7.2: la ganancia tras sueldo usa el sueldo de los días de la carga', () => {
  const r = evaluar({}, { sueldoPorDia: 200, diasCarga: 1.5 });
  cerca(r.sueldo.carga, 300);
  cerca(r.sueldo.gananciaTrasSueldo, 429.6 - 300);
  cerca(r.sueldo.gananciaEstimadaPorDia, 429.6 / 1.5);
});

test('§7.4: contraoferta descuenta solo Extras confirmados', () => {
  const sinExtras = evaluar({ tarifa: 400 });
  const conExtras = evaluar({ tarifa: 400, extrasConfirmados: 20 });
  const noConfirmados = evaluar({ tarifa: 400, extrasNoConfirmados: 20 });
  cerca(sinExtras.contraoferta.tarifaObjetivo, (0.534 / 0.7) * 600);
  cerca(conExtras.contraoferta.tarifaObjetivo, (0.534 / 0.7) * 600 - 20);
  cerca(noConfirmados.contraoferta.tarifaObjetivo, sinExtras.contraoferta.tarifaObjetivo);
});

test('§7.4: cuando manda el RPM mínimo, la tarifa objetivo lo cumple', () => {
  const r = evaluar({ tarifa: 400 }, { rpmMinimo: 0.85 });
  cerca(r.contraoferta.tarifaPorMinimo, 510);
  cerca(r.contraoferta.tarifaObjetivo, 510);
});

test('§7.4: la tarifa de equilibrio cubre los costos y no es negativa', () => {
  cerca(evaluar({ tarifa: 300 }).contraoferta.tarifaEquilibrio, 0.534 * 600);
  // Extras muy altos cubren los costos solos; el RPM mínimo de tarifa obliga a contraofertar
  const r = evaluar({ tarifa: 300, extrasConfirmados: 5000 }, { rpmMinimo: 0.85 });
  assert.equal(r.decision, 'EVALUAR');
  assert.equal(r.contraoferta.tarifaEquilibrio, 0);
  cerca(r.contraoferta.tarifaObjetivo, 0.85 * 600);
});

test('decisión #10: margen de negociación configurable; 0 % y 12 %; no altera el veredicto', () => {
  const c8 = evaluar({ tarifa: 400 });
  const c0 = evaluar({ tarifa: 400 }, { margenNegociacion: 0 });
  const c12 = evaluar({ tarifa: 400 }, { margenNegociacion: 0.12 });
  cerca(c8.contraoferta.tarifaContraoferta, c8.contraoferta.tarifaObjetivo * 1.08);
  cerca(c0.contraoferta.tarifaContraoferta, c0.contraoferta.tarifaObjetivo);
  cerca(c12.contraoferta.tarifaContraoferta, c12.contraoferta.tarifaObjetivo * 1.12);
  assert.equal(c0.decision, c12.decision);
  cerca(c0.umbrales.objetivo, c12.umbrales.objetivo);
  cerca(c0.margenEstimado, c12.margenEstimado);
});

test('§3.3: valores 0 en los supuestos se respetan (sin || )', () => {
  const r = evaluar({}, { margenObjetivo: 0, rpmMinimo: 0, sueldoPorDia: 0, margenNegociacion: 0 });
  cerca(r.umbrales.objetivo, 0.534);
  assert.equal(r.sueldo.carga, 0);
  assert.equal(r.snapshot.supuestos.margenNegociacion, 0);
});

test('margenObjetivo debe ser una fracción menor que 1', () => {
  assert.throws(() => evaluar({}, { margenObjetivo: 1 }), /margenObjetivo/);
  assert.throws(() => evaluar({}, { margenObjetivo: 30 }), /margenObjetivo/);
});

// ---------------------------------------------------------------- §7.2 sueldo y días
test('§7.2: sueldo por día = sueldo mensual / días de trabajo (22 por defecto)', () => {
  cerca(FE.sueldoPorDia(4000), 4000 / 22);
  cerca(FE.sueldoPorDia(4000, 20), 200);
  assert.equal(FE.sueldoPorDia(0), 0);
  assert.equal(FE.sueldoPorDia(null), 0);
  cerca(FE.sueldoPorDia(4000, 40), 4000 / 31);
  assert.throws(() => FE.sueldoPorDia(-1), /sueldoMensual/);
});

test('§7.2: días de la carga con la duración de la ruta (Miami–Atlanta, 679 mi, 9 h 32 min)', () => {
  const d = FE.calcularDiasCarga({ millasTotales: 679, segundosRuta: 9 * 3600 + 32 * 60 });
  assert.equal(d.fuente, 'ruta');
  assert.equal(d.paradasCombustible, 2);
  cerca(d.horas, 9 + 32 / 60 + 1);
  cerca(d.dias, (9 + 32 / 60 + 1) / 10);
});

test('§7.2: duración de ruta incoherente -> estimación interna; mínimo 1 día', () => {
  const d = FE.calcularDiasCarga({ millasTotales: 679, segundosRuta: 3600 });
  assert.equal(d.fuente, 'estimacion');
  cerca(d.horas, 679 / 52 + 1);
  assert.equal(FE.calcularDiasCarga({ millasTotales: 120 }).dias, 1);
});

// ---------------------------------------------------------------- auditoría ChatGPT (fase 1)
test('auditoría: una carga sin ingresos nunca recibe ACEPTAR, aunque todo sea 0', () => {
  const r = FE.evaluarCarga(
    { tarifa: 0, extrasConfirmados: 0, millasCargadas: 500, millasDeadhead: 0 },
    { configuracionCompleta: true, cpmBase: 0, combustiblePorMilla: 0, margenObjetivo: 0, rpmMinimo: 0 }
  );
  assert.equal(r.margenEstimado, null);
  assert.notEqual(r.decision, 'ACEPTAR');
  assert.ok(r.incumple.includes('sinIngresos'));
});

test('auditoría: sin ingresos y con costos -> RECHAZAR, también marca sinIngresos', () => {
  const r = evaluar({ tarifa: 0 });
  assert.equal(r.decision, 'RECHAZAR');
  assert.ok(r.incumple.includes('sinIngresos'));
});
