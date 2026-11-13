/**
 * financial-engine.js — Motor financiero único de Smart Load Solution.
 *
 * Implementa la especificación docs/superpowers/specs/2026-11-13-motor-financiero-design.md
 * (revisión 7.1 + decisión de margen nulo sin ingresos).
 *
 * Funciones PURAS: sin DOM, sin Firebase, sin red, sin almacenamiento.
 * Funciona en el navegador (window.FinancialEngine) y en Node (require).
 *
 * FASE 1: todavía NO está conectado a ninguna pantalla de la app.
 *
 * Bloques:
 *   1a — Evaluación de una carga: ingresos, costos, ganancia estimada,
 *        umbrales, veredicto y contraoferta (§3.1, §7).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FinancialEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FORMULA_VERSION = 1;

  // ================================================================
  // Utilidades de validación
  // ================================================================

  function esNumeroFinito(valor) {
    return typeof valor === 'number' && isFinite(valor);
  }

  /** Número finito >= 0. Lanza RangeError en cualquier otro caso (NaN, Infinity, texto, negativo). */
  function noNegativo(valor, nombre) {
    if (!esNumeroFinito(valor) || valor < 0) {
      throw new RangeError(nombre + ' debe ser un número finito mayor o igual que 0');
    }
    return valor;
  }

  /** Igual que noNegativo, pero null/undefined devuelven el valor por defecto. Un 0 es válido (§3.3). */
  function noNegativoOpcional(valor, nombre, porDefecto) {
    if (valor === null || valor === undefined) return porDefecto;
    return noNegativo(valor, nombre);
  }

  /** Toll de la carga: vacío ('' / null / undefined) = 0, sin presuponer peajes (§5). */
  function peajeDeLaCarga(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    return noNegativo(valor, 'tollCarga');
  }

  function copiaProfunda(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function congelarProfundo(objeto) {
    Object.keys(objeto).forEach(function (clave) {
      var v = objeto[clave];
      if (v && typeof v === 'object') congelarProfundo(v);
    });
    return Object.freeze(objeto);
  }

  // ================================================================
  // 1a — Sueldo y días de una carga (§7.2)
  // ================================================================

  /**
   * Sueldo bruto del dueño por día de trabajo.
   * @param {number|null} sueldoMensual  Sueldo bruto mensual (0 o vacío = sin sueldo).
   * @param {number} [diasTrabajoMes=22] Días de trabajo al mes (se acota a 1..31).
   */
  function sueldoPorDia(sueldoMensual, diasTrabajoMes) {
    var sueldo = noNegativoOpcional(sueldoMensual, 'sueldoMensual', 0);
    if (sueldo === 0) return 0;
    var dias = noNegativoOpcional(diasTrabajoMes, 'diasTrabajoMes', 22);
    dias = Math.min(31, Math.max(1, dias));
    return sueldo / dias;
  }

  /**
   * Días que ocupa una carga, proporcionales a sus horas reales (mínimo 1).
   * Usa la duración de la ruta (Google) si la velocidad resultante es coherente
   * (35–80 mph); si no, la estimación interna. Suma 30 min por parada de
   * combustible (una cada 300 mi).
   */
  function calcularDiasCarga(opciones) {
    var o = opciones || {};
    var millas = noNegativo(o.millasTotales, 'millasTotales');
    var velocidad = noNegativoOpcional(o.velocidadPromedio, 'velocidadPromedio', 52) || 52;
    var horasPorDia = noNegativoOpcional(o.horasManejoPorDia, 'horasManejoPorDia', 10) || 10;
    var segundosRuta = noNegativoOpcional(o.segundosRuta, 'segundosRuta', 0);

    var paradas = Math.floor(millas / 300);
    var horasEstimadas = millas / velocidad + paradas * 0.5;
    var horas = horasEstimadas;
    var fuente = 'estimacion';

    if (segundosRuta > 0) {
      var horasRuta = segundosRuta / 3600;
      var velocidadRuta = millas / horasRuta;
      if (velocidadRuta >= 35 && velocidadRuta <= 80) {
        horas = horasRuta + paradas * 0.5;
        fuente = 'ruta';
      }
    }

    return {
      horas: horas,
      dias: Math.max(1, horas / horasPorDia),
      paradasCombustible: paradas,
      fuente: fuente
    };
  }

  // ================================================================
  // 1a — Evaluación de una carga (§3.1, §7.1, §7.4)
  // ================================================================

  /**
   * Evalúa una carga.
   *
   * @param {object} entradas
   *   tarifa               número >= 0 (obligatorio)
   *   extrasConfirmados    número >= 0 (por defecto 0)
   *   extrasNoConfirmados  número >= 0 (por defecto 0; solo informativo)
   *   tollCarga            número >= 0, o vacío = 0
   *   millasCargadas       número >= 0 (obligatorio)
   *   millasDeadhead       número >= 0 (por defecto 0)
   *   estadoOrigen, estadoDestino, fecha  (texto, opcionales, se copian al snapshot)
   *
   * @param {object|null} supuestos  Resueltos antes (§4). Si es null o
   *   configuracionCompleta !== true, el resultado es "sinConfiguracion" (§4.1).
   *   configuracionCompleta  boolean
   *   cpmBase                número >= 0 (costo por milla sin peajes)
   *   combustiblePorMilla    número >= 0 y <= cpmBase (parte de cpmBase; por defecto 0)
   *   cpmFuente              'configuracion' | 'real' | 'provisional' | 'referenciaTemporal' | 'referenciaVencida' | 'datosAntiguos'
   *   cpmUltimoPeriodoConfiable  'YYYY-MM' o null
   *   sueldoPorDia           número >= 0 (por defecto 0)
   *   diasCarga              número >= 1 (por defecto 1)
   *   margenObjetivo         fracción 0 <= m < 1 (p. ej. 0.30)
   *   rpmMinimo              número >= 0 (por defecto 0 = sin mínimo)
   *   margenNegociacion      fracción >= 0 (por defecto 0.08, decisión #10)
   *   rpmPromedioHistorico   número >= 0 (por defecto 0 = no aplica)
   */
  function evaluarCarga(entradas, supuestos) {
    if (!entradas || typeof entradas !== 'object' || Array.isArray(entradas)) {
      throw new TypeError('Se requieren las entradas de la carga');
    }

    var tarifa = noNegativo(entradas.tarifa, 'tarifa');
    var extrasConfirmados = noNegativoOpcional(entradas.extrasConfirmados, 'extrasConfirmados', 0);
    var extrasNoConfirmados = noNegativoOpcional(entradas.extrasNoConfirmados, 'extrasNoConfirmados', 0);
    var tollCarga = peajeDeLaCarga(entradas.tollCarga);
    var millasCargadas = noNegativo(entradas.millasCargadas, 'millasCargadas');
    var millasDeadhead = noNegativoOpcional(entradas.millasDeadhead, 'millasDeadhead', 0);

    var millasTotales = millasCargadas + millasDeadhead;
    if (!(millasTotales > 0)) {
      throw new RangeError('millasTotales debe ser mayor que 0');
    }

    var ingresosTotales = tarifa + extrasConfirmados;
    var rpmTarifa = tarifa / millasTotales;
    var rpmTotal = ingresosTotales / millasTotales;

    var entradasSnapshot = {
      tarifa: tarifa,
      extrasConfirmados: extrasConfirmados,
      extrasNoConfirmados: extrasNoConfirmados,
      tollCarga: tollCarga,
      millasCargadas: millasCargadas,
      millasDeadhead: millasDeadhead,
      estadoOrigen: entradas.estadoOrigen !== undefined ? String(entradas.estadoOrigen) : null,
      estadoDestino: entradas.estadoDestino !== undefined ? String(entradas.estadoDestino) : null,
      fecha: entradas.fecha !== undefined ? String(entradas.fecha) : null
    };

    var base = {
      formulaVersion: FORMULA_VERSION,
      naturaleza: 'ESTIMACION',
      millas: { cargadas: millasCargadas, deadhead: millasDeadhead, totales: millasTotales },
      ingresos: {
        tarifa: tarifa,
        extrasConfirmados: extrasConfirmados,
        total: ingresosTotales,
        posibleAdicional: extrasNoConfirmados
      },
      rpm: { tarifa: rpmTarifa, total: rpmTotal }
    };

    // ---- Etapa A: sin configuración mínima (§4.1, decisión #8) ----
    if (!supuestos || supuestos.configuracionCompleta !== true) {
      base.estado = 'sinConfiguracion';
      base.mensaje = 'Completa tu configuración para ver tu ganancia estimada';
      base.snapshot = congelarProfundo({ entradas: entradasSnapshot, supuestos: null });
      return base;
    }

    var cpmBase = noNegativo(supuestos.cpmBase, 'cpmBase');
    var combustiblePorMilla = noNegativoOpcional(supuestos.combustiblePorMilla, 'combustiblePorMilla', 0);
    if (combustiblePorMilla > cpmBase) {
      // El combustible es PARTE del cpmBase: nunca se suma por separado (sin doble conteo).
      throw new RangeError('combustiblePorMilla no puede ser mayor que cpmBase');
    }
    var sueldoDia = noNegativoOpcional(supuestos.sueldoPorDia, 'sueldoPorDia', 0);
    var diasCarga = noNegativoOpcional(supuestos.diasCarga, 'diasCarga', 1);
    if (diasCarga < 1) diasCarga = 1;
    var margenObjetivo = noNegativoOpcional(supuestos.margenObjetivo, 'margenObjetivo', 0);
    if (margenObjetivo >= 1) throw new RangeError('margenObjetivo debe ser menor que 1 (fracción, p. ej. 0.30)');
    var rpmMinimo = noNegativoOpcional(supuestos.rpmMinimo, 'rpmMinimo', 0);
    var margenNegociacion = noNegativoOpcional(supuestos.margenNegociacion, 'margenNegociacion', 0.08);
    var rpmPromedioHistorico = noNegativoOpcional(supuestos.rpmPromedioHistorico, 'rpmPromedioHistorico', 0);

    // ---- Costos y ganancia estimada (§3.1) ----
    var costoOperativo = cpmBase * millasTotales;
    var costoCombustible = combustiblePorMilla * millasTotales;
    var costoEstimado = costoOperativo + tollCarga;
    var gananciaEstimada = ingresosTotales - costoEstimado;
    // Decisión de Ricardo: sin ingresos el margen no está definido (la UI mostrará "N/D").
    var margenEstimado = ingresosTotales > 0 ? gananciaEstimada / ingresosTotales : null;
    var sueldoCarga = sueldoDia * diasCarga;

    // ---- Umbrales (§7.1): todos los RPM sobre millas totales ----
    var umbralCostos = cpmBase + tollCarga / millasTotales;
    var objetivoMargen = umbralCostos / (1 - margenObjetivo);
    var objetivoSueldo = sueldoCarga > 0 ? umbralCostos + sueldoCarga / millasTotales : null;
    var umbralObjetivo = objetivoSueldo !== null ? Math.max(objetivoSueldo, objetivoMargen) : objetivoMargen;
    var objetivoTipo = (objetivoSueldo !== null && objetivoSueldo >= objetivoMargen) ? 'sueldo' : 'margen';
    // El promedio histórico de RPM sigue elevando el umbral de aceptar (§7.1).
    var umbralAceptar = Math.max(umbralObjetivo, rpmPromedioHistorico);

    // ---- Veredicto (§7.1) ----
    var incumple = [];
    var decision;
    if (rpmTotal < umbralCostos) {
      decision = 'RECHAZAR';
      incumple.push('costos');
    } else {
      if (rpmTotal < umbralAceptar) incumple.push(objetivoTipo === 'sueldo' ? 'objetivoSueldo' : 'objetivoMargen');
      if (rpmTarifa < rpmMinimo) incumple.push('rpmMinimo');
      decision = incumple.length === 0 ? 'ACEPTAR' : 'EVALUAR';
    }

    // ---- Contraoferta (§7.4): cifras de TARIFA ----
    // Debe cumplir los dos requisitos de "Aceptar" (por eso usa umbralAceptar)
    // y descuenta solo los Extras confirmados.
    var tarifaPorObjetivo = umbralAceptar * millasTotales - extrasConfirmados;
    var tarifaPorMinimo = rpmMinimo * millasTotales;
    var tarifaObjetivo = Math.max(tarifaPorObjetivo, tarifaPorMinimo, 0);
    var tarifaEquilibrio = Math.max(umbralCostos * millasTotales - extrasConfirmados, 0);

    base.estado = 'completo';
    base.costos = {
      cpmBase: cpmBase,
      cpmFuente: supuestos.cpmFuente || 'configuracion',
      cpmUltimoPeriodoConfiable: supuestos.cpmUltimoPeriodoConfiable || null,
      combustible: costoCombustible,
      restoOperativo: costoOperativo - costoCombustible,
      operativo: costoOperativo,
      peajeEstimado: tollCarga,
      total: costoEstimado
    };
    base.gananciaEstimada = gananciaEstimada;
    base.margenEstimado = margenEstimado;
    base.gananciaPorMilla = gananciaEstimada / millasTotales;
    base.sueldo = {
      porDia: sueldoDia,
      dias: diasCarga,
      carga: sueldoCarga,
      gananciaTrasSueldo: gananciaEstimada - sueldoCarga,
      gananciaEstimadaPorDia: gananciaEstimada / diasCarga
    };
    base.umbrales = {
      costos: umbralCostos,
      objetivoMargen: objetivoMargen,
      objetivoSueldo: objetivoSueldo,
      objetivo: umbralObjetivo,
      objetivoTipo: objetivoTipo,
      aceptar: umbralAceptar,
      rpmMinimo: rpmMinimo
    };
    base.decision = decision;
    base.incumple = incumple;
    base.contraoferta = decision === 'ACEPTAR' ? null : {
      tarifaEquilibrio: tarifaEquilibrio,
      tarifaObjetivo: tarifaObjetivo,
      tarifaPorObjetivo: tarifaPorObjetivo,
      tarifaPorMinimo: tarifaPorMinimo,
      margenNegociacion: margenNegociacion,
      tarifaContraoferta: tarifaObjetivo * (1 + margenNegociacion)
    };
    base.snapshot = congelarProfundo({
      entradas: entradasSnapshot,
      supuestos: {
        configuracionCompleta: true,
        cpmBase: cpmBase,
        combustiblePorMilla: combustiblePorMilla,
        cpmFuente: supuestos.cpmFuente || 'configuracion',
        cpmUltimoPeriodoConfiable: supuestos.cpmUltimoPeriodoConfiable || null,
        sueldoPorDia: sueldoDia,
        diasCarga: diasCarga,
        margenObjetivo: margenObjetivo,
        rpmMinimo: rpmMinimo,
        margenNegociacion: margenNegociacion,
        rpmPromedioHistorico: rpmPromedioHistorico
      }
    });
    return base;
  }

  return {
    FORMULA_VERSION: FORMULA_VERSION,
    evaluarCarga: evaluarCarga,
    calcularDiasCarga: calcularDiasCarga,
    sueldoPorDia: sueldoPorDia,
    // utilidades expuestas para los bloques siguientes y las pruebas
    _util: { noNegativo: noNegativo, copiaProfunda: copiaProfunda }
  };
});
