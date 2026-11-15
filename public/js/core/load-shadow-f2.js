/* Smart Load Solution — F2 modo sombra (solo lectura).
 * Por defecto DESACTIVADO. Sin DOM, Firebase, almacenamiento ni red.
 * No influye en el panel actual.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLSShadowF2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function isEnabled(user, temporaryFlag) {
    return temporaryFlag === true || user?.flags?.shadowFinancialF2 === true;
  }
  function compare(input, engine, logger) {
    if (!engine || typeof engine.evaluarCarga !== 'function') throw new Error('F1 no disponible');
    if (!input || !input.entradas || !input.legacy) throw new Error('Datos incompletos');
    var newResult = engine.evaluarCarga(input.entradas, input.supuestos);
    var oldDecision = String(input.legacy.decision || '');
    var normalizedOld = ({ACCEPT:'ACEPTAR', REJECT:'RECHAZAR', EVALUATE:'EVALUAR', 'ALMOST ACCEPT':'EVALUAR'})[oldDecision] || oldDecision;
    var deltaProfit = (newResult.gananciaEstimada === undefined || !Number.isFinite(Number(input.legacy.netProfit)))
      ? null : newResult.gananciaEstimada - input.legacy.netProfit;
    var report = {
      etapa:'F2', formulaVersion:newResult.formulaVersion,
      decisionActual:oldDecision, decisionNueva:newResult.decision ?? null,
      diferenciaDecision: newResult.decision == null ? null : normalizedOld !== newResult.decision,
      gananciaActual:Number(input.legacy.netProfit), gananciaNueva:newResult.gananciaEstimada ?? null,
      diferenciaGanancia:deltaProfit,
      precioEquilibrio:newResult.preciosReferencia?.tarifaEquilibrio ?? newResult.contraoferta?.tarifaEquilibrio ?? null,
      precioMinimo:newResult.preciosReferencia?.tarifaMinimaRentable ?? newResult.contraoferta?.tarifaObjetivo ?? null,
      precioSugerido:newResult.preciosReferencia?.sugerenciaNegociacion ?? newResult.contraoferta?.tarifaContraoferta ?? null,
      fuenteCPM:input.supuestos?.cpmFuente ?? null,
      nota:'Solo diagnóstico local. F2 no cambia la decisión visible.'
    };
    if (typeof logger === 'function') logger('[SmartLoad F2 modo sombra]', report);
    return report;
  }
  return { isEnabled, compare };
});
