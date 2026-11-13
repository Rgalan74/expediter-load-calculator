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
 *   1b — Resolución del CPM: periodo de meses con actividad, meses
 *        incompletos, criterios de confianza, cobertura de fijos, candidatos
 *        a extraordinario, antigüedad y regla "el CPM nunca baja solo"
 *        (§4.2 – §4.6, §6).
 *   1c — Cobros: facturado, abonos, pendiente, importe por aclarar, estados
 *        (vencida con pago parcial), incobrables, resumen de Cuentas y flujo
 *        de caja (§3.4, §3.5). Las funciones que "registran" devuelven una
 *        COPIA de la carga; nunca modifican el original.
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
    // Una carga sin ingresos nunca puede recibir ACEPTAR, aunque todos los
    // umbrales sean 0 (auditoría fase 1).
    if (!(ingresosTotales > 0)) incumple.push('sinIngresos');
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

  // ================================================================
  // 1b — Resolución del CPM (§4.2 – §4.6, §6)
  // ================================================================

  var UMBRALES_CPM = {
    actividadPctMediana: 0.25,      // §4.2: mes con actividad
    actividadMinMillas: 300,
    mesIncompletoCombustible: 0.5,  // §4.2: combustible < 0.5× esperado
    bandaCombustibleMin: 0.5,       // §4.2 criterio 3
    bandaCombustibleMax: 1.5,
    bandaAbsolutaMin: 0.10,         // sin MPG/precio en Configuración
    bandaAbsolutaMax: 0.50,
    mesesVentana: 12,
    mesesCombustible: 3,
    minMillasCombustibleReciente: 1000,
    minMesesActivos: 3,
    minCargas: 20,
    minMesesConGastos: 3,
    pagoSignificativo: 0.5,         // §4.2 criterio 4
    coberturaImporte: 0.8,
    avisoMillasMeta: 0.4,           // §4.2 criterio 5 (solo aviso)
    extraordinarioPctTotal: 0.05,   // §6
    extraordinarioMinMovimientos: 3,
    extraordinarioVecesMediana: 2,
    cambioRepregunta: 0.15,         // §4.4
    mesesVigencia: 6                // §4.5, §4.6
  };

  var CATEGORIA_COMBUSTIBLE = 'fuel';
  var CATEGORIA_PEAJES = 'tolls';
  var CATEGORIA_SEGURO = 'insurance';
  var CATEGORIA_VEHICULO = 'carpayment';

  function mesDe(fecha) {
    var f = String(fecha || '');
    return /^\d{4}-\d{2}/.test(f) ? f.slice(0, 7) : null;
  }

  function indiceMes(ym) {
    return Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);
  }

  function mesDesdeIndice(i) {
    var anio = Math.floor(i / 12);
    var mes = (i % 12) + 1;
    return anio + '-' + (mes < 10 ? '0' : '') + mes;
  }

  function mesesEntre(desde, hasta) {
    return indiceMes(hasta) - indiceMes(desde);
  }

  function mediana(valores) {
    if (!valores.length) return 0;
    var v = valores.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /**
   * Reparto lineal de un gasto marcado como no recurrente (§6, decisión #2):
   * 12 asignaciones mensuales consecutivas desde el mes del gasto. Cada mes
   * recibe la doceava parte en centavos y el último absorbe la diferencia, de
   * modo que las 12 asignaciones suman EXACTAMENTE el importe original.
   * No modifica el asiento original.
   */
  function asignacionMensualNoRecurrente(importe, mesGasto) {
    var total = noNegativo(importe, 'importe');
    var ym = mesDe(mesGasto);
    if (!ym) throw new RangeError('mesGasto debe ser YYYY-MM');
    var totalCentavos = Math.round(total * 100);
    var base = Math.floor(totalCentavos / 12);
    var inicio = indiceMes(ym);
    var asignaciones = [];
    for (var i = 0; i < 12; i++) {
      var centavos = i < 11 ? base : totalCentavos - base * 11;
      asignaciones.push({ mes: mesDesdeIndice(inicio + i), centavos: centavos, importe: centavos / 100 });
    }
    return asignaciones;
  }

  /** Millas de una carga con lectura tolerante de campos antiguos (§8), sin reescribirlos. */
  function millasDeCarga(carga) {
    if (!carga) return 0;
    var candidatos = [carga.millas, carga.totalMiles, carga.miles];
    for (var i = 0; i < candidatos.length; i++) {
      var v = Number(candidatos[i]);
      if (isFinite(v) && v > 0) return v;
    }
    var cargadas = Number(carga.loadedMiles || carga.loaded || 0);
    var vacias = Number(carga.deadheadMiles || carga.deadhead || 0);
    var suma = (isFinite(cargadas) ? cargadas : 0) + (isFinite(vacias) ? vacias : 0);
    return suma > 0 ? suma : 0;
  }

  function cpmDeConfiguracion(configuracion) {
    var c = configuracion || {};
    if (c.cpm === null || c.cpm === undefined) return null;
    return noNegativo(c.cpm, 'configuracion.cpm');
  }

  /**
   * Calcula el CPM real a partir de cargas y gastos y decide qué CPM aplicar.
   *
   * @param {object} datos
   *   cargas  [{ fecha:'YYYY-MM-DD', millas | totalMiles | miles | loadedMiles+deadheadMiles }]
   *   gastos  [{ id, fecha:'YYYY-MM-DD', categoria, importe }]
   *   categoriasNoOperativas  [ids]  categorías personalizadas marcadas como no operativas
   *   gastosNoRecurrentes     [ids]  gastos que el conductor marcó como no recurrentes (§6)
   *   configuracion {
   *     completa: boolean,               configuración mínima (§4.1)
   *     cpm: number|null,                CPM de Configuración
   *     combustibleEsperadoPorMilla: number|null   precio por galón / MPG
   *     seguroMensual: number|null,
   *     pagoVehiculoMensual: number|null (0 = vehículo propio, no se exige)
   *     metaMillasMes: number|null
   *   }
   *   mesActual  'YYYY-MM' (obligatorio: el mes en curso nunca entra, §4.2)
   *   preferencia { fuente:'real'|'configuracion', fecha, cpmReal, cpmConfig } | null  (§4.4)
   *   ultimoCpmRealConfiable { valor, periodoHasta:'YYYY-MM' } | null  (§4.5)
   */
  function resolverCpm(datos) {
    var d = datos || {};
    if (!mesDe(d.mesActual)) throw new RangeError('mesActual (YYYY-MM) es obligatorio');
    var mesActual = mesDe(d.mesActual);
    var U = UMBRALES_CPM;
    var configuracion = d.configuracion || {};
    var cpmConfig = cpmDeConfiguracion(configuracion);
    var combustibleEsperado = configuracion.combustibleEsperadoPorMilla === null || configuracion.combustibleEsperadoPorMilla === undefined
      ? null : noNegativo(configuracion.combustibleEsperadoPorMilla, 'combustibleEsperadoPorMilla');
    var noOperativas = d.categoriasNoOperativas || [];
    var noRecurrentes = d.gastosNoRecurrentes || [];

    var real = calcularCpmReal(d.cargas || [], d.gastos || [], {
      mesActual: mesActual,
      combustibleEsperado: combustibleEsperado,
      noOperativas: noOperativas,
      noRecurrentes: noRecurrentes,
      seguroMensual: configuracion.seguroMensual,
      pagoVehiculoMensual: configuracion.pagoVehiculoMensual,
      metaMillasMes: configuracion.metaMillasMes
    });

    var resultado = {
      real: real,
      cpmConfiguracion: cpmConfig,
      umbrales: U
    };

    // ---- Etapa A: sin configuración mínima → sin CPM para decidir (§4.1, decisión #8)
    if (configuracion.completa !== true || cpmConfig === null) {
      resultado.etapa = 'A';
      resultado.fuente = 'sinConfiguracion';
      resultado.cpmAplicado = null;
      resultado.requiereEleccion = false;
      resultado.requiereRevision = false;
      resultado.etiqueta = 'Completa tu configuración para ver tu ganancia estimada';
      return resultado;
    }

    var pref = d.preferencia || null;
    var ultimo = d.ultimoCpmRealConfiable || null;
    var ultimoValido = ultimo && esNumeroFinito(ultimo.valor) && ultimo.valor > 0 ? ultimo : null;
    var cpmReal = real.confiable ? real.cpm : null;

    resultado.preferencia = pref;
    resultado.requiereEleccion = false;
    resultado.requiereRevision = false;
    // Valor que la app debe guardar para el momento siguiente: el último CPM
    // real confiable calculado (nunca un valor inventado).
    resultado.guardar = real.confiable
      ? { ultimoCpmRealConfiable: { valor: real.cpm, periodoHasta: real.periodo.hasta } }
      : null;

    if (!real.confiable) {
      var eligioConfiguracion = pref && pref.fuente === 'configuracion';
      var eligioReal = pref && pref.fuente === 'real';
      // Referencia temporal (§4.5): si eligió el real, o si NO eligió nada pero
      // ya se estaba aplicando un provisional basado en un CPM real confiable.
      // Así el CPM no baja automáticamente (decisión #7). Si eligió
      // Configuración, se respeta su elección.
      if (eligioReal || (!eligioConfiguracion && ultimoValido)) {
        return aplicarReferenciaTemporal(resultado, ultimoValido, cpmConfig, mesActual);
      }
      // ---- Etapa B
      resultado.etapa = 'B';
      resultado.fuente = 'configuracion';
      resultado.cpmAplicado = cpmConfig;
      resultado.etiqueta = eligioConfiguracion ? 'Según tu Configuración (elegido)' : 'Según tu Configuración';
      return resultado;
    }

    resultado.etapa = 'C';

    if (!pref) {
      // Sin elección: provisional = el mayor de los dos; nunca baja solo (§4.4.2)
      resultado.fuente = 'provisional';
      resultado.cpmAplicado = Math.max(cpmReal, cpmConfig);
      resultado.requiereEleccion = true;
      resultado.etiqueta = 'Provisional — elige tu fuente';
    } else if (pref.fuente === 'configuracion') {
      resultado.fuente = 'configuracion';
      resultado.cpmAplicado = cpmConfig;
      resultado.etiqueta = 'Según tu Configuración (elegido)';
      if (cpmReal !== null && cambioMaterial(pref, cpmReal, cpmConfig)) resultado.requiereEleccion = true;
    } else {
      // Eligió el real: su valor sigue a los datos (sube o baja) (§4.4.4)
      resultado.fuente = 'real';
      resultado.cpmAplicado = cpmReal;
      resultado.etiqueta = 'Tus gastos reales (elegido)';
      if (cambioMaterial(pref, cpmReal, cpmConfig)) resultado.requiereEleccion = true;
    }

    // Antigüedad de los datos (§4.6): nunca se presentan como costo actual confirmado
    if (real.confiable && real.datosAntiguos) {
      resultado.requiereRevision = true;
      resultado.etiqueta += ' · Datos antiguos (hasta ' + real.periodo.hasta + ')';
    }
    return resultado;
  }

  /**
   * Referencia temporal (§4.5): máximo(último CPM real confiable, Configuración).
   * Vencida a los 6 meses: conserva el valor y pide revisión; nunca baja sola.
   * No modifica la preferencia del conductor.
   */
  function aplicarReferenciaTemporal(resultado, ultimo, cpmConfig, mesActual) {
    var referencia = ultimo ? Math.max(ultimo.valor, cpmConfig) : cpmConfig;
    var vencida = ultimo && mesDe(ultimo.periodoHasta)
      ? mesesEntre(mesDe(ultimo.periodoHasta), mesActual) > UMBRALES_CPM.mesesVigencia
      : false;
    resultado.etapa = 'C';
    resultado.fuente = vencida ? 'referenciaVencida' : 'referenciaTemporal';
    resultado.cpmAplicado = referencia;
    resultado.requiereRevision = vencida;
    resultado.ultimoCpmRealConfiable = ultimo;
    resultado.etiqueta = vencida
      ? 'Referencia vencida desde ' + mesDe(ultimo.periodoHasta) + ' — puede no reflejar tus costos actuales'
      : 'Referencia temporal: tu historial actual no es confiable';
    return resultado;
  }

  /** ¿La diferencia real − configuración cambió más del 15 % desde la elección? (§4.4.3) */
  function cambioMaterial(pref, cpmReal, cpmConfig) {
    if (!pref || !esNumeroFinito(pref.cpmReal) || !esNumeroFinito(pref.cpmConfig) || pref.cpmConfig <= 0) return false;
    var antes = pref.cpmReal - pref.cpmConfig;
    var ahora = cpmReal - cpmConfig;
    return Math.abs(ahora - antes) / pref.cpmConfig > UMBRALES_CPM.cambioRepregunta;
  }

  function calcularCpmReal(cargas, gastos, opciones) {
    var U = UMBRALES_CPM;
    var mesActual = opciones.mesActual;

    // ---- Agregación mensual (antes del mes en curso)
    var millasMes = {};
    var cargasMes = {};
    cargas.forEach(function (c) {
      var ym = mesDe(c && (c.fecha || c.date));
      if (!ym) return;
      millasMes[ym] = (millasMes[ym] || 0) + millasDeCarga(c);
      cargasMes[ym] = (cargasMes[ym] || 0) + 1;
    });
    var gastosValidos = gastos.map(function (g) {
      var importe = Number(g && (g.importe !== undefined ? g.importe : g.amount));
      return {
        id: g && g.id !== undefined ? g.id : null,
        fecha: g && (g.fecha || g.date),
        mes: mesDe(g && (g.fecha || g.date)),
        categoria: String((g && (g.categoria || g.category || g.type)) || 'other').toLowerCase(),
        importe: isFinite(importe) ? importe : 0,
        descripcion: g && (g.descripcion || g.description) ? String(g.descripcion || g.description) : ''
      };
    }).filter(function (g) { return g.mes && g.importe > 0; });

    var combustibleMes = {};
    gastosValidos.forEach(function (g) {
      if (g.categoria === CATEGORIA_COMBUSTIBLE) combustibleMes[g.mes] = (combustibleMes[g.mes] || 0) + g.importe;
    });

    var mesesConMillas = Object.keys(millasMes).filter(function (m) { return millasMes[m] > 0 && m < mesActual; });
    var resultado = {
      confiable: false,
      motivos: [],
      avisos: [],
      excluidos: [],
      periodo: null,
      cpm: null,
      desglose: null,
      cobertura: null,
      candidatosExtraordinarios: [],
      antiguedadMeses: null,
      datosAntiguos: false,
      millasMesPromedio: null,
      metaMillasMes: opciones.metaMillasMes === undefined ? null : opciones.metaMillasMes
    };
    if (Object.keys(millasMes).some(function (m) { return m >= mesActual && millasMes[m] > 0; })) {
      resultado.excluidos.push({ mes: mesActual, motivo: 'mesEnCurso' });
    }
    if (!mesesConMillas.length) {
      resultado.motivos.push('sinCargas');
      return resultado;
    }

    var medianaMillas = mediana(mesesConMillas.map(function (m) { return millasMes[m]; }));
    var umbralActividad = Math.max(U.actividadMinMillas, U.actividadPctMediana * medianaMillas);
    var activos = mesesConMillas.filter(function (m) { return millasMes[m] >= umbralActividad; }).sort();
    resultado.umbralActividad = umbralActividad;

    var incompleto = function (m) {
      var comb = combustibleMes[m] || 0;
      if (comb <= 0) return true;
      return opciones.combustibleEsperado ? (comb / millasMes[m]) < U.mesIncompletoCombustible * opciones.combustibleEsperado : false;
    };

    // ---- Meses finales históricos incompletos: se excluyen (decisión #9)
    while (activos.length && incompleto(activos[activos.length - 1])) {
      resultado.excluidos.push({ mes: activos.pop(), motivo: 'mesFinalIncompleto' });
    }
    // ---- Ventana: últimos 12 meses con actividad
    activos = activos.slice(-U.mesesVentana);
    if (activos.length < U.minMesesActivos) {
      resultado.motivos.push('pocosMesesActivos');
      if (!activos.length) return resultado;
    }
    var desde = activos[0];
    var hasta = activos[activos.length - 1];
    var mesesPeriodo = mesesEntre(desde, hasta) + 1;

    // ---- Meses intermedios incompletos: bloquean
    activos.forEach(function (m) {
      if (incompleto(m)) resultado.motivos.push('mesIntermedioIncompleto:' + m);
    });

    // ---- Dentro del periodo cuenta todo (decisión #12)
    var dentro = function (m) { return m >= desde && m <= hasta; };
    var millasPeriodo = 0;
    var cargasPeriodo = 0;
    Object.keys(millasMes).forEach(function (m) {
      if (dentro(m)) { millasPeriodo += millasMes[m]; cargasPeriodo += cargasMes[m] || 0; }
    });

    var recientes = activos.slice(-U.mesesCombustible);
    var desdeReciente = recientes[0];
    var millasRecientes = 0;
    Object.keys(millasMes).forEach(function (m) {
      if (m >= desdeReciente && m <= hasta) millasRecientes += millasMes[m];
    });

    var esOperativo = function (g) { return opciones.noOperativas.indexOf(g.categoria) === -1; };
    var esNoRecurrente = function (g) { return g.id !== null && opciones.noRecurrentes.indexOf(g.id) !== -1; };

    // Registros reales del periodo (importe original): cobertura de fijos,
    // meses con gastos y candidatos a extraordinario.
    var gastosPeriodo = gastosValidos.filter(function (g) { return dentro(g.mes) && esOperativo(g); });
    var mesesConGastos = {};
    gastosPeriodo.forEach(function (g) { mesesConGastos[g.mes] = true; });

    // Aporte al CPM por asignaciones mensuales que caen dentro del periodo:
    //   - sin marcar: una sola asignación, entera, en su mes;
    //   - marcado no recurrente: 12 asignaciones desde su mes (reparto lineal
    //     por solape). Incluye gastos ANTERIORES al periodo cuyas mensualidades
    //     todavía caen dentro (auditoría fase 1). Nunca se cuenta dos veces.
    var totalPeriodo = 0, peajes = 0, combustible = 0, combustibleReciente = 0, resto = 0;
    var porCategoria = {};
    gastosValidos.filter(esOperativo).forEach(function (g) {
      var asignaciones = esNoRecurrente(g)
        ? asignacionMensualNoRecurrente(g.importe, g.mes)
        : [{ mes: g.mes, importe: g.importe }];
      asignaciones.forEach(function (a) {
        if (!dentro(a.mes)) return;
        totalPeriodo += a.importe;
        porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + a.importe;
        if (g.categoria === CATEGORIA_PEAJES) peajes += a.importe;
        else if (g.categoria === CATEGORIA_COMBUSTIBLE) {
          combustible += a.importe;
          if (a.mes >= desdeReciente) combustibleReciente += a.importe;
        } else resto += a.importe;
      });
    });

    // ---- Criterios que bloquean (§4.2)
    if (activos.length < U.minMesesActivos || cargasPeriodo < U.minCargas) resultado.motivos.push('historialInsuficiente');
    if (Object.keys(mesesConGastos).length < U.minMesesConGastos) resultado.motivos.push('pocosMesesConGastos');

    var combustiblePorMilla = millasPeriodo > 0 ? combustible / millasPeriodo : 0;
    if (combustible <= 0) {
      resultado.motivos.push('sinCombustible');
    } else if (opciones.combustibleEsperado) {
      var ratio = combustiblePorMilla / opciones.combustibleEsperado;
      if (ratio > U.bandaCombustibleMax) resultado.motivos.push('combustibleAlto:posiblesCargasSinRegistrar');
      if (ratio < U.bandaCombustibleMin) resultado.motivos.push('combustibleBajo:posiblesRecibosSinRegistrar');
      resultado.combustibleVsEsperado = ratio;
    } else if (combustiblePorMilla < U.bandaAbsolutaMin || combustiblePorMilla > U.bandaAbsolutaMax) {
      resultado.motivos.push('combustibleFueraDeRango');
    }

    // Cobertura global de gastos fijos (criterio 4)
    var cobertura = {};
    [[CATEGORIA_SEGURO, opciones.seguroMensual], [CATEGORIA_VEHICULO, opciones.pagoVehiculoMensual]].forEach(function (par) {
      var categoria = par[0];
      var mensual = par[1] === null || par[1] === undefined ? null : Number(par[1]);
      var pagos = gastosPeriodo.filter(function (g) { return g.categoria === categoria; }).map(function (g) { return g.importe; });
      if (mensual === 0) return;                     // vehículo propio: no se exige
      if (mensual === null && !pagos.length) return; // no declarado ni registrado
      var referencia = mensual !== null ? mensual : mediana(pagos);
      var significativos = pagos.filter(function (x) { return x >= U.pagoSignificativo * referencia; }).length;
      var exigidos = Math.max(mesesPeriodo - 1, 0);
      var total = pagos.reduce(function (a, b) { return a + b; }, 0);
      var pctImporte = mensual !== null && mensual > 0 ? total / (mensual * mesesPeriodo) : null;
      var cumple = significativos >= exigidos || (pctImporte !== null && pctImporte >= U.coberturaImporte);
      cobertura[categoria] = { pagos: pagos.length, significativos: significativos, exigidos: exigidos, total: total, pctImporte: pctImporte, cumple: cumple };
      if (!cumple) resultado.motivos.push('coberturaFijos:' + categoria);
    });
    resultado.cobertura = cobertura;

    // Aviso de millas (criterio 5) e información de millas
    var millasMesPromedio = millasPeriodo / activos.length;
    resultado.millasMesPromedio = millasMesPromedio;
    if (opciones.metaMillasMes > 0 && millasMesPromedio < U.avisoMillasMeta * opciones.metaMillasMes) {
      resultado.avisos.push('millasMuyPorDebajoDeLaMeta');
    }

    // ---- CPM (§4.3)
    var combustibleLargo = millasPeriodo > 0 ? combustible / millasPeriodo : 0;
    var combustibleCorto = millasRecientes >= U.minMillasCombustibleReciente ? combustibleReciente / millasRecientes : 0;
    var usaReciente = combustibleCorto > 0 && combustibleCorto >= 0.5 * combustibleLargo;
    var combustibleAplicado = usaReciente ? combustibleCorto : combustibleLargo;
    var restoPorMilla = millasPeriodo > 0 ? resto / millasPeriodo : 0;

    resultado.periodo = {
      desde: desde, hasta: hasta, meses: mesesPeriodo, mesesActivos: activos.length,
      millas: millasPeriodo, cargas: cargasPeriodo,
      mesesCombustible: recientes, millasCombustible: millasRecientes
    };
    resultado.cpm = restoPorMilla + combustibleAplicado;
    resultado.desglose = {
      totalGastos: totalPeriodo,
      peajes: peajes,
      combustible: combustible,
      combustibleReciente: combustibleReciente,
      resto: resto,
      porCategoria: porCategoria,
      combustiblePorMilla: combustibleAplicado,
      combustibleFuente: usaReciente ? 'reciente' : 'periodo',
      restoPorMilla: restoPorMilla,
      peajesPorMilla: millasPeriodo > 0 ? peajes / millasPeriodo : 0,
      cpmContable: millasPeriodo > 0 ? totalPeriodo / millasPeriodo : 0
    };

    // ---- Candidatos a extraordinario (§6)
    var porCategoriaLista = {};
    gastosPeriodo.forEach(function (g) {
      (porCategoriaLista[g.categoria] = porCategoriaLista[g.categoria] || []).push(g.importe);
    });
    resultado.candidatosExtraordinarios = gastosPeriodo.filter(function (g) {
      if (g.categoria === CATEGORIA_COMBUSTIBLE || g.categoria === CATEGORIA_PEAJES) return false;
      if (g.importe < U.extraordinarioPctTotal * totalPeriodo) return false;
      var lista = porCategoriaLista[g.categoria];
      if (lista.length >= U.extraordinarioMinMovimientos) {
        return g.importe >= U.extraordinarioVecesMediana * mediana(lista);
      }
      return true;
    }).map(function (g) {
      return { id: g.id, fecha: g.fecha, categoria: g.categoria, importe: g.importe, descripcion: g.descripcion,
        marcadoNoRecurrente: g.id !== null && opciones.noRecurrentes.indexOf(g.id) !== -1 };
    });

    // ---- Antigüedad (§4.6)
    resultado.antiguedadMeses = mesesEntre(hasta, mesActual);
    resultado.datosAntiguos = resultado.antiguedadMeses > U.mesesVigencia;

    resultado.confiable = resultado.motivos.length === 0;
    return resultado;
  }

  // ================================================================
  // 1c — Cobros: contratado, facturado, cobrado (§3.4, §3.5)
  // ================================================================

  var DIAS_AVISO_POR_ACLARAR = 30;
  var CENTAVO = 0.005; // tolerancia para comparar importes en dólares

  function diaDe(fecha, nombre) {
    var f = String(fecha || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(f)) throw new RangeError(nombre + ' debe ser una fecha YYYY-MM-DD');
    return Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10))) / 86400000;
  }

  function diasEntre(desde, hasta) {
    return Math.round(diaDe(hasta, 'fecha') - diaDe(desde, 'fecha'));
  }

  function facturadoDe(carga) {
    var v = carga.facturado !== undefined ? carga.facturado : carga.totalCharge;
    return noNegativo(Number(v), 'facturado');
  }

  /**
   * Abonos de una carga. Una carga antigua con actualPaymentDate y sin abonos
   * se LEE como un único abono por el total facturado en esa fecha (§3.4),
   * sin reescribirla.
   */
  function abonosDe(carga) {
    if (Array.isArray(carga.abonos) && carga.abonos.length) {
      return carga.abonos.map(function (a, i) {
        var importe = Number(a.importe);
        if (!esNumeroFinito(importe)) throw new RangeError('abonos[' + i + '].importe no es válido');
        diaDe(a.fecha, 'abonos[' + i + '].fecha');
        return { importe: importe, fecha: String(a.fecha).slice(0, 10), tipo: a.tipo || 'abono' };
      });
    }
    if (carga.actualPaymentDate) {
      return [{ importe: facturadoDe(carga), fecha: String(carga.actualPaymentDate).slice(0, 10), tipo: 'legado' }];
    }
    return [];
  }

  /**
   * Estado de cobro de una carga en la fecha `hoy`.
   * pendiente e importePorAclarar se DERIVAN del mismo saldo: nunca son
   * negativos ni ambos > 0 a la vez.
   */
  function estadoCobro(carga, hoy) {
    if (!carga || typeof carga !== 'object') throw new TypeError('Se requiere la carga');
    diaDe(hoy, 'hoy');
    var facturado = facturadoDe(carga);
    var abonos = abonosDe(carga);
    var incobrable = carga.ajusteIncobrable ? noNegativo(Number(carga.ajusteIncobrable.importe), 'ajusteIncobrable.importe') : 0;
    var cobrado = abonos.reduce(function (s, a) { return s + a.importe; }, 0);
    var saldo = facturado - incobrable - cobrado;
    if (Math.abs(saldo) < CENTAVO) saldo = 0;
    var pendiente = Math.max(saldo, 0);
    var importePorAclarar = Math.max(-saldo, 0);

    var fechaEsperada = carga.fechaEsperada || carga.expectedPaymentDate || null;
    var vencida = pendiente > 0 && !!fechaEsperada && diasEntre(fechaEsperada, hoy) > 0;
    var cobradoPositivo = abonos.filter(function (a) { return a.importe > 0; })
      .reduce(function (s, a) { return s + a.importe; }, 0);
    var pagoParcial = pendiente > 0 && cobradoPositivo > 0;

    var estado;
    if (pendiente === 0) estado = 'pagada';
    else if (vencida) estado = 'vencida';
    else if (pagoParcial) estado = 'pagoParcial';
    else estado = 'pendiente';

    // Fecha en que el acumulado de abonos completó lo debido (para actualPaymentDate)
    var fechaPagoCompleto = null;
    var fechaExceso = null;
    if (pendiente === 0) {
      var acumulado = 0;
      var debido = facturado - incobrable;
      var ordenados = abonos.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
      for (var i = 0; i < ordenados.length; i++) {
        acumulado += ordenados[i].importe;
        if (fechaPagoCompleto === null && acumulado >= debido - CENTAVO) fechaPagoCompleto = ordenados[i].fecha;
        if (fechaExceso === null && acumulado > debido + CENTAVO) fechaExceso = ordenados[i].fecha;
      }
      // Con incobrable, la carga queda cerrada cuando se registra el ajuste, no antes
      if (incobrable > 0 && carga.ajusteIncobrable.fecha) {
        var fechaAjuste = String(carga.ajusteIncobrable.fecha).slice(0, 10);
        if (fechaPagoCompleto === null || fechaAjuste > fechaPagoCompleto) fechaPagoCompleto = fechaAjuste;
      }
    }

    return {
      id: carga.id !== undefined ? carga.id : null,
      compania: carga.companyName || carga.compania || '',
      facturado: facturado,
      cobrado: cobrado,
      incobrable: incobrable,
      saldo: saldo,
      pendiente: pendiente,
      importePorAclarar: importePorAclarar,
      estado: estado,
      pagoParcial: pagoParcial,
      vencida: vencida,
      diasAtraso: vencida ? diasEntre(fechaEsperada, hoy) : 0,
      fechaEsperada: fechaEsperada,
      fechaPagoCompleto: fechaPagoCompleto,
      fechaExceso: importePorAclarar > 0 ? fechaExceso : null,
      diasPorAclarar: importePorAclarar > 0 && fechaExceso ? diasEntre(fechaExceso, hoy) : 0,
      abonos: abonos
    };
  }

  /** Copia de la carga con los abonos leídos (convierte el abono "legado" en explícito). */
  function copiaConAbonos(carga) {
    var nueva = copiaProfunda(carga);
    nueva.abonos = abonosDe(carga).map(function (a) { return { importe: a.importe, fecha: a.fecha, tipo: a.tipo }; });
    return nueva;
  }

  /** Mantiene los campos actuales de la app coherentes: actualPaymentDate solo cuando no queda saldo. */
  function sincronizarCamposExistentes(carga, hoy) {
    var e = estadoCobro(carga, hoy);
    if (e.pendiente === 0) {
      carga.actualPaymentDate = e.fechaPagoCompleto;
      carga.paymentStatus = 'paid';
    } else {
      carga.actualPaymentDate = null;
      carga.paymentStatus = 'pending';
    }
    return carga;
  }

  /**
   * Registra un abono (importe > 0). Devuelve una COPIA de la carga; no modifica la original.
   * La ganancia estimada y lo facturado no cambian (§3.4).
   */
  function registrarAbono(carga, abono, hoy) {
    var importe = noNegativo(abono && abono.importe, 'importe');
    if (!(importe > 0)) throw new RangeError('importe debe ser mayor que 0');
    diaDe(abono.fecha, 'fecha');
    var nueva = copiaConAbonos(carga);
    nueva.abonos.push({ importe: importe, fecha: String(abono.fecha).slice(0, 10), tipo: 'abono' });
    return sincronizarCamposExistentes(nueva, hoy);
  }

  /**
   * Aclara un importe recibido de más (decisión #13):
   *   'extra'      → sube lo facturado; no crea otro ingreso ni otro abono.
   *   'devolucion' → abono negativo; salida en el flujo de caja.
   */
  function aclararExceso(carga, tipo, fecha, hoy) {
    var e = estadoCobro(carga, hoy);
    if (!(e.importePorAclarar > 0)) throw new RangeError('La carga no tiene importe por aclarar');
    diaDe(fecha, 'fecha');
    var nueva = copiaConAbonos(carga);
    nueva.aclaraciones = (nueva.aclaraciones || []).concat([{ tipo: tipo, importe: e.importePorAclarar, fecha: String(fecha).slice(0, 10) }]);
    if (tipo === 'extra') {
      var facturadoAnterior = facturadoDe(carga);
      if (nueva.facturado !== undefined) nueva.facturado = facturadoAnterior + e.importePorAclarar;
      else nueva.totalCharge = facturadoAnterior + e.importePorAclarar;
      nueva.facturadoHistorial = (nueva.facturadoHistorial || []).concat([{
        fecha: String(fecha).slice(0, 10), anterior: facturadoAnterior,
        nuevo: facturadoAnterior + e.importePorAclarar, motivo: 'exceso aclarado como Extra adicional'
      }]);
    } else if (tipo === 'devolucion') {
      nueva.abonos.push({ importe: -e.importePorAclarar, fecha: String(fecha).slice(0, 10), tipo: 'devolucion' });
    } else {
      throw new RangeError("tipo debe ser 'extra' o 'devolucion'");
    }
    return sincronizarCamposExistentes(nueva, hoy);
  }

  /** Ajuste explícito por incobrable (con motivo). No modifica lo facturado. */
  function registrarIncobrable(carga, ajuste, hoy) {
    var e = estadoCobro(carga, hoy);
    var importe = noNegativo(ajuste && ajuste.importe, 'importe');
    if (!(importe > 0)) throw new RangeError('importe debe ser mayor que 0');
    if (importe > e.pendiente + CENTAVO) throw new RangeError('El incobrable no puede superar el pendiente');
    if (!ajuste.motivo || !String(ajuste.motivo).trim()) throw new RangeError('El incobrable requiere un motivo');
    diaDe(ajuste.fecha, 'fecha');
    var nueva = copiaConAbonos(carga);
    var previo = carga.ajusteIncobrable ? Number(carga.ajusteIncobrable.importe) : 0;
    nueva.ajusteIncobrable = { importe: previo + importe, fecha: String(ajuste.fecha).slice(0, 10), motivo: String(ajuste.motivo) };
    return sincronizarCamposExistentes(nueva, hoy);
  }

  /**
   * Resumen de Cuentas (§3.5): totales, antigüedad sobre el PENDIENTE,
   * totales por compañía, importes por aclarar (separados) y avisos.
   */
  function resumenCuentas(cargas, hoy) {
    diaDe(hoy, 'hoy');
    var tramos = { '0-30': { cargas: 0, importe: 0 }, '31-60': { cargas: 0, importe: 0 }, '61-90': { cargas: 0, importe: 0 }, '90+': { cargas: 0, importe: 0 } };
    var totales = { facturado: 0, cobrado: 0, pendiente: 0, vencido: 0, porAclarar: 0, incobrable: 0 };
    var porCompania = {};
    var porAclarar = [];
    var avisos = [];

    (cargas || []).forEach(function (carga) {
      var e = estadoCobro(carga, hoy);
      totales.facturado += e.facturado;
      totales.cobrado += e.cobrado;
      totales.pendiente += e.pendiente;
      totales.incobrable += e.incobrable;
      totales.porAclarar += e.importePorAclarar;
      if (e.vencida) totales.vencido += e.pendiente;

      if (e.pendiente > 0) {
        var referencia = e.fechaEsperada || carga.date || carga.fecha || hoy;
        var dias = diasEntre(referencia, hoy);
        var tramo = dias <= 30 ? '0-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+';
        tramos[tramo].cargas++;
        tramos[tramo].importe += e.pendiente;

        var nombre = e.compania || '(sin compañía)';
        var c = porCompania[nombre] || (porCompania[nombre] = { cargas: 0, pendiente: 0, vencido: 0 });
        c.cargas++;
        c.pendiente += e.pendiente;
        if (e.vencida) c.vencido += e.pendiente;
      }
      if (e.vencida) avisos.push({ tipo: e.pagoParcial ? 'vencidaPagoParcial' : 'vencida', id: e.id, pendiente: e.pendiente, diasAtraso: e.diasAtraso });
      if (e.importePorAclarar > 0) {
        porAclarar.push({ id: e.id, compania: e.compania, importe: e.importePorAclarar, desde: e.fechaExceso, dias: e.diasPorAclarar });
        if (e.diasPorAclarar > DIAS_AVISO_POR_ACLARAR) avisos.push({ tipo: 'porAclarar', id: e.id, importe: e.importePorAclarar, dias: e.diasPorAclarar });
      }
    });

    return { totales: totales, antiguedad: tramos, porCompania: porCompania, porAclarar: porAclarar, avisos: avisos };
  }

  /**
   * Flujo de caja (§3.4): SOLO los abonos (incluidas devoluciones negativas),
   * por su fecha de cobro. Cada dólar recibido cuenta una sola vez.
   */
  function flujoCaja(cargas, desde, hasta) {
    var d = diaDe(desde, 'desde');
    var h = diaDe(hasta, 'hasta');
    var movimientos = [];
    (cargas || []).forEach(function (carga) {
      abonosDe(carga).forEach(function (a) {
        var dia = diaDe(a.fecha, 'fecha');
        if (dia >= d && dia <= h) movimientos.push({ id: carga.id !== undefined ? carga.id : null, fecha: a.fecha, importe: a.importe, tipo: a.tipo });
      });
    });
    movimientos.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    var entradas = movimientos.filter(function (m) { return m.importe > 0; }).reduce(function (s, m) { return s + m.importe; }, 0);
    var salidas = movimientos.filter(function (m) { return m.importe < 0; }).reduce(function (s, m) { return s - m.importe; }, 0);
    return { entradas: entradas, salidas: salidas, neto: entradas - salidas, movimientos: movimientos };
  }

  return {
    FORMULA_VERSION: FORMULA_VERSION,
    UMBRALES_CPM: UMBRALES_CPM,
    estadoCobro: estadoCobro,
    registrarAbono: registrarAbono,
    aclararExceso: aclararExceso,
    registrarIncobrable: registrarIncobrable,
    resumenCuentas: resumenCuentas,
    flujoCaja: flujoCaja,
    evaluarCarga: evaluarCarga,
    calcularDiasCarga: calcularDiasCarga,
    sueldoPorDia: sueldoPorDia,
    resolverCpm: resolverCpm,
    asignacionMensualNoRecurrente: asignacionMensualNoRecurrente,
    millasDeCarga: millasDeCarga,
    // utilidades expuestas para los bloques siguientes y las pruebas
    _util: { noNegativo: noNegativo, copiaProfunda: copiaProfunda }
  };
});
