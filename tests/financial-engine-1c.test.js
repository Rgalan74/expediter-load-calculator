/**
 * Pruebas del bloque 1c del motor financiero: cobros (§3.4, §3.5).
 * Ejecutar:  npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FE = require('../public/js/core/financial-engine.js');

const cerca = (real, esperado, tol = 1e-9) =>
  assert.ok(Math.abs(real - esperado) <= tol, `esperado ${esperado}, obtenido ${real}`);

// Carga de $1,000 con pago esperado el 2026-03-06
const carga = (extra = {}) => ({
  id: 'L1', companyName: 'Broker A', date: '2026-02-26',
  totalCharge: 1000, expectedPaymentDate: '2026-03-06', gananciaEstimada: 412.5,
  ...extra
});
const ANTES = '2026-03-01';   // antes del vencimiento
const DESPUES = '2026-03-20'; // 14 días de atraso

// ---------------------------------------------------------------- pagos
test('pago total: pagada, actualPaymentDate = fecha del abono, original intacto', () => {
  const original = carga();
  const copia = JSON.parse(JSON.stringify(original));
  const c = FE.registrarAbono(original, { importe: 1000, fecha: '2026-03-05' }, '2026-03-05');
  const e = FE.estadoCobro(c, '2026-03-05');
  assert.equal(e.estado, 'pagada');
  assert.equal(c.actualPaymentDate, '2026-03-05');
  assert.equal(c.paymentStatus, 'paid');
  assert.deepEqual(original, copia);
});

test('pago parcial: estado, pendiente y sin actualPaymentDate', () => {
  const c = FE.registrarAbono(carga(), { importe: 600, fecha: '2026-02-28' }, ANTES);
  const e = FE.estadoCobro(c, ANTES);
  assert.equal(e.estado, 'pagoParcial');
  cerca(e.pendiente, 400);
  cerca(e.cobrado, 600);
  assert.equal(c.actualPaymentDate, null);
  assert.equal(c.paymentStatus, 'pending');
});

test('varios abonos hasta completar: pagada con la fecha del último', () => {
  let c = FE.registrarAbono(carga(), { importe: 600, fecha: '2026-03-02' }, '2026-03-02');
  c = FE.registrarAbono(c, { importe: 400, fecha: '2026-03-12' }, '2026-03-12');
  const e = FE.estadoCobro(c, '2026-03-12');
  assert.equal(e.estado, 'pagada');
  assert.equal(c.actualPaymentDate, '2026-03-12');
  assert.equal(e.pendiente, 0);
});

test('los pagos no cambian lo facturado ni la ganancia estimada', () => {
  const c = FE.registrarAbono(carga(), { importe: 300, fecha: '2026-03-02' }, ANTES);
  assert.equal(c.totalCharge, 1000);
  assert.equal(c.gananciaEstimada, 412.5);
});

// ---------------------------------------------------------------- vencidas (rev. 7.1)
test('rev. 7.1: $1,000 con $600 cobrados y vencida -> "Vencida · pago parcial"; solo $400 vencidos', () => {
  const c = FE.registrarAbono(carga(), { importe: 600, fecha: '2026-03-02' }, '2026-03-02');
  const e = FE.estadoCobro(c, DESPUES);
  assert.equal(e.estado, 'vencida');
  assert.equal(e.pagoParcial, true);
  cerca(e.pendiente, 400);
  assert.equal(e.diasAtraso, 14);
  const r = FE.resumenCuentas([c], DESPUES);
  cerca(r.totales.vencido, 400);
  cerca(r.antiguedad['0-30'].importe, 400);
  cerca(r.porCompania['Broker A'].vencido, 400);
  assert.deepEqual(r.avisos.map(a => a.tipo), ['vencidaPagoParcial']);
});

test('un abono no reinicia el vencimiento', () => {
  const c = FE.registrarAbono(carga(), { importe: 200, fecha: '2026-03-19' }, '2026-03-19');
  assert.equal(FE.estadoCobro(c, DESPUES).diasAtraso, 14); // desde el 2026-03-06, no desde el abono
});

test('vencida sin abonos', () => {
  const e = FE.estadoCobro(carga(), DESPUES);
  assert.equal(e.estado, 'vencida');
  assert.equal(e.pagoParcial, false);
  assert.deepEqual(FE.resumenCuentas([carga()], DESPUES).avisos.map(a => a.tipo), ['vencida']);
});

test('pendiente sin abonos antes del vencimiento', () => {
  assert.equal(FE.estadoCobro(carga(), ANTES).estado, 'pendiente');
});

test('antigüedad de saldos sobre el pendiente, por tramos', () => {
  const cargas = [
    carga({ id: 'a', expectedPaymentDate: '2026-03-10' }),                                   // 10 días
    FE.registrarAbono(carga({ id: 'b', expectedPaymentDate: '2026-02-01' }), { importe: 250, fecha: '2026-02-05' }, '2026-02-05'), // 47 días, 750 pendiente
    carga({ id: 'c', expectedPaymentDate: '2025-12-10' })                                    // 100 días
  ];
  const r = FE.resumenCuentas(cargas, DESPUES);
  cerca(r.antiguedad['0-30'].importe, 1000);
  cerca(r.antiguedad['31-60'].importe, 750);
  cerca(r.antiguedad['90+'].importe, 1000);
  cerca(r.totales.pendiente, 2750);
});

test('totales por compañía', () => {
  const r = FE.resumenCuentas([
    carga({ id: 'x' }), carga({ id: 'y', companyName: 'Broker B', totalCharge: 500 }), carga({ id: 'z', expectedPaymentDate: '2026-04-30' })
  ], DESPUES);
  assert.equal(r.porCompania['Broker A'].cargas, 2);
  cerca(r.porCompania['Broker A'].pendiente, 2000);
  cerca(r.porCompania['Broker A'].vencido, 1000);
  cerca(r.porCompania['Broker B'].vencido, 500);
});

// ---------------------------------------------------------------- cargas antiguas
test('carga antigua con actualPaymentDate y sin abonos se lee como un abono único', () => {
  const vieja = carga({ actualPaymentDate: '2026-03-04', paymentStatus: 'paid' });
  const e = FE.estadoCobro(vieja, DESPUES);
  assert.equal(e.estado, 'pagada');
  cerca(e.cobrado, 1000);
  assert.equal(e.abonos[0].tipo, 'legado');
  assert.equal(vieja.abonos, undefined); // no se reescribe
  cerca(FE.flujoCaja([vieja], '2026-03-01', '2026-03-31').entradas, 1000);
});

// ---------------------------------------------------------------- incobrable
test('incobrable con motivo: sin pendiente, facturado intacto', () => {
  let c = FE.registrarAbono(carga(), { importe: 800, fecha: '2026-03-05' }, '2026-03-05');
  c = FE.registrarIncobrable(c, { importe: 200, fecha: '2026-04-15', motivo: 'Broker cerró' }, '2026-04-15');
  const e = FE.estadoCobro(c, '2026-04-15');
  assert.equal(e.estado, 'pagada');
  assert.equal(e.pendiente, 0);
  assert.equal(c.totalCharge, 1000);
  cerca(e.incobrable, 200);
  assert.equal(c.actualPaymentDate, '2026-04-15');
});

test('incobrable sin motivo o mayor que el pendiente -> error', () => {
  const c = FE.registrarAbono(carga(), { importe: 800, fecha: '2026-03-05' }, '2026-03-05');
  assert.throws(() => FE.registrarIncobrable(c, { importe: 200, fecha: '2026-04-15' }, '2026-04-15'), /motivo/);
  assert.throws(() => FE.registrarIncobrable(c, { importe: 300, fecha: '2026-04-15', motivo: 'x' }, '2026-04-15'), /pendiente/);
});

// ---------------------------------------------------------------- sobrepago (rev. 7.1, decisión 13)
test('sobrepago: importe por aclarar separado; pendiente 0, nunca negativo', () => {
  const c = FE.registrarAbono(carga(), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  const e = FE.estadoCobro(c, '2026-03-05');
  assert.equal(e.estado, 'pagada');
  assert.equal(e.pendiente, 0);
  cerca(e.importePorAclarar, 50);
  assert.equal(c.totalCharge, 1000);
  assert.equal(c.gananciaEstimada, 412.5);
});

test('sobrepago: no entra en cuentas por cobrar ni en la antigüedad, y no las reduce', () => {
  const pagada = FE.registrarAbono(carga({ id: 'sobre' }), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  const otra = carga({ id: 'otra' });
  const r = FE.resumenCuentas([pagada, otra], DESPUES);
  cerca(r.totales.pendiente, 1000);                  // solo la otra carga; el exceso no resta
  cerca(r.antiguedad['0-30'].importe, 1000);
  assert.equal(Object.values(r.antiguedad).every(t => t.importe >= 0), true);
  assert.deepEqual(r.porAclarar.map(p => [p.id, p.importe]), [['sobre', 50]]);
});

test('sobrepago: el flujo de caja cuenta el dinero una sola vez', () => {
  const c = FE.registrarAbono(carga(), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  const f = FE.flujoCaja([c], '2026-03-01', '2026-03-31');
  cerca(f.entradas, 1050);
  assert.equal(f.movimientos.length, 1);
});

test('sobrepago aclarado como Extra adicional: sube facturado, desaparece el exceso, la caja no cambia', () => {
  const c = FE.registrarAbono(carga(), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  const a = FE.aclararExceso(c, 'extra', '2026-03-10', '2026-03-10');
  const e = FE.estadoCobro(a, '2026-03-10');
  assert.equal(a.totalCharge, 1050);
  assert.equal(e.importePorAclarar, 0);
  assert.equal(e.pendiente, 0);
  assert.equal(a.abonos.length, 1);
  cerca(FE.flujoCaja([a], '2026-03-01', '2026-03-31').entradas, 1050);
  assert.equal(a.facturadoHistorial[0].anterior, 1000);
  assert.equal(a.aclaraciones[0].tipo, 'extra');
});

test('sobrepago aclarado como devolución: abono negativo, salida en caja una vez', () => {
  const c = FE.registrarAbono(carga(), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  const a = FE.aclararExceso(c, 'devolucion', '2026-03-12', '2026-03-12');
  const e = FE.estadoCobro(a, '2026-03-12');
  assert.equal(e.importePorAclarar, 0);
  assert.equal(e.estado, 'pagada');
  assert.equal(a.totalCharge, 1000);
  const f = FE.flujoCaja([a], '2026-03-01', '2026-03-31');
  cerca(f.entradas, 1050);
  cerca(f.salidas, 50);
  cerca(f.neto, 1000);
});

test('aviso cuando un importe lleva más de 30 días sin aclarar', () => {
  const c = FE.registrarAbono(carga(), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  assert.deepEqual(FE.resumenCuentas([c], '2026-03-30').avisos, []);
  assert.deepEqual(FE.resumenCuentas([c], '2026-04-10').avisos.map(a => [a.tipo, a.dias]), [['porAclarar', 36]]);
});

test('aclarar sin exceso o con un tipo inválido -> error', () => {
  assert.throws(() => FE.aclararExceso(carga(), 'extra', '2026-03-10', '2026-03-10'), /por aclarar/);
  const c = FE.registrarAbono(carga(), { importe: 1050, fecha: '2026-03-05' }, '2026-03-05');
  assert.throws(() => FE.aclararExceso(c, 'saldoAFavor', '2026-03-10', '2026-03-10'), /tipo/);
});

test('pendiente e importe por aclarar nunca son ambos > 0', () => {
  const escenarios = [0, 300, 999.99, 1000, 1000.004, 1050, 2000].map(importe =>
    importe > 0 ? FE.registrarAbono(carga(), { importe, fecha: '2026-03-05' }, '2026-03-05') : carga());
  escenarios.forEach(c => {
    const e = FE.estadoCobro(c, DESPUES);
    assert.ok(e.pendiente >= 0 && e.importePorAclarar >= 0);
    assert.ok(!(e.pendiente > 0 && e.importePorAclarar > 0));
  });
});

// ---------------------------------------------------------------- flujo de caja y validaciones
test('flujo de caja por fecha de cobro, no por fecha de carga', () => {
  const c = FE.registrarAbono(carga({ date: '2026-01-20' }), { importe: 1000, fecha: '2026-02-03' }, '2026-02-03');
  cerca(FE.flujoCaja([c], '2026-01-01', '2026-01-31').entradas, 0);
  cerca(FE.flujoCaja([c], '2026-02-01', '2026-02-28').entradas, 1000);
});

test('validaciones de abono y fechas', () => {
  assert.throws(() => FE.registrarAbono(carga(), { importe: 0, fecha: '2026-03-05' }, ANTES), /mayor que 0/);
  assert.throws(() => FE.registrarAbono(carga(), { importe: -10, fecha: '2026-03-05' }, ANTES), /importe/);
  assert.throws(() => FE.registrarAbono(carga(), { importe: 10, fecha: '05/03/2026' }, ANTES), /fecha/);
  assert.throws(() => FE.estadoCobro(carga(), 'hoy'), /hoy/);
  assert.throws(() => FE.estadoCobro(carga({ totalCharge: 'abc' }), ANTES), /facturado/);
});
