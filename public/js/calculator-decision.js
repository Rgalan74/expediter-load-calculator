/**
 * calculator-decision.js
 * Decision intelligence logic for load acceptance
 * Extracted from calculator.js for lazy loading
 * Version: 1.0.0
 */

// ========================================
// DECISION LOGIC FUNCTIONS
// ========================================

/**
 * Get decision mode
 */
function getDecisionMode() {
    return (typeof window !== 'undefined' && window.DECISION_MODE) || 'realista2025';
}

/**
 * Classify zone based on real experience
 */
function clasificarZonaReal(state) {
    if (!state) return 'DESCONOCIDA';
    const ZONAS_CORE_MIDWEST = window.ZONAS_CORE_MIDWEST || new Set(['IL', 'IN', 'OH', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS']);
    const ZONAS_EXTENDED_MIDWEST = window.ZONAS_EXTENDED_MIDWEST || new Set(['PA', 'KY', 'TN', 'AR', 'OK', 'AL']);
    const ZONAS_SALIDA_OK = window.ZONAS_SALIDA_OK || new Set(['NC', 'SC', 'GA', 'WV', 'VA', 'MD', 'DE', 'NJ', 'NY']);
    const ZONAS_TRAP = window.ZONAS_TRAP || new Set(['FL', 'TX', 'NM', 'AZ', 'NV', 'CA', 'OR', 'WA', 'ID', 'MT', 'WY', 'UT', 'CO', 'ND', 'SD', 'NE']);

    if (ZONAS_CORE_MIDWEST.has(state)) return 'CORE_MIDWEST';
    if (ZONAS_EXTENDED_MIDWEST.has(state)) return 'EXTENDED_MIDWEST';
    if (ZONAS_SALIDA_OK.has(state)) return 'SALIDA_OK';
    if (ZONAS_TRAP.has(state)) return 'TRAP';
    return 'DESCONOCIDA';
}

/**
 * Analyze trap penalty and calculate real cycle RPM
 */
function analizarTrapPenalty(origenState, destinoState, millas, rpm) {
    const zonaOrigen = clasificarZonaReal(origenState);
    const zonaDestino = clasificarZonaReal(destinoState);

    // CASO 1: Sales del Midwest hacia TRAP
    if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
        zonaDestino === 'TRAP') {

        const millasRegreso = 2200;
        const rpmSalida = 0.65;
        const costoPorMilla = 0.526;

        const revenueIda = rpm * millas;
        const revenueSalida = rpmSalida * millasRegreso;
        const revenueTotal = revenueIda + revenueSalida;

        const millasTotal = millas + millasRegreso;
        const costoTotal = millasTotal * costoPorMilla;

        const rpmRealCiclo = revenueTotal / millasTotal;
        const gananciaCiclo = revenueTotal - costoTotal;
        const diasEstimados = Math.ceil(millasTotal / 600);
        const gananciaPorDia = gananciaCiclo / diasEstimados;

        return {
            esTrampa: true,
            rpmOfrecido: rpm,
            rpmRealCiclo,
            millasTotal,
            revenueTotal,
            costoTotal,
            gananciaCiclo,
            diasEstimados,
            gananciaPorDia,
            advertencia: `TRAMPA: Te saca del Midwest al ${destinoState}. Costo de regresar incluido.`,
            detalles: {
                ida: { millas, rpm, revenue: revenueIda },
                regreso: { millas: millasRegreso, rpm: rpmSalida, revenue: revenueSalida }
            }
        };
    }

    // CASO 2: Movimiento dentro del Midwest
    if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
        (zonaDestino === 'CORE_MIDWEST' || zonaDestino === 'EXTENDED_MIDWEST')) {
        return {
            esTrampa: false,
            rpmRealCiclo: rpm,
            nivel: 'OPTIMO',
            advertencia: `PERFECTO: Te mantienes en zona operativa rentable`,
            zonaOrigen,
            zonaDestino
        };
    }

    // CASO 3: Midwest → Salida OK
    if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
        zonaDestino === 'SALIDA_OK') {
        return {
            esTrampa: false,
            rpmRealCiclo: rpm,
            nivel: 'EVALUAR',
            advertencia: `EVALUAR: Sales del Midwest a ${destinoState}. Sale razonable pero menos cargas cortas.`,
            minimumRPM: 0.95
        };
    }

    // CASO 4: Relocalizacion (TRAP → Midwest)
    if (zonaOrigen === 'TRAP' &&
        (zonaDestino === 'CORE_MIDWEST' || zonaDestino === 'EXTENDED_MIDWEST')) {
        return {
            esTrampa: false,
            rpmRealCiclo: rpm,
            nivel: 'RELOCALIZACION',
            advertencia: `RELOCALIZACION: Regresando del ${origenState} al Midwest. Necesario para volver a zona rentable.`,
            minimumRPM: 0.70
        };
    }

    // CASO 5: Otros
    return {
        esTrampa: zonaDestino === 'TRAP',
        rpmRealCiclo: rpm,
        nivel: 'NORMAL',
        zonaOrigen,
        zonaDestino
    };
}

/**
 * Calculate real travel time
 */
function calcularTiempoReal(millas) {
    const paradasCombustible = Math.floor(millas / 300);
    const tiempoManejo = millas / 75;
    const tiempoParadas = paradasCombustible * 0.5;
    const tiempoTotal = tiempoManejo + tiempoParadas;

    return {
        paradas: paradasCombustible,
        horasTotal: tiempoTotal,
        formato: `${Math.floor(tiempoTotal)}h ${Math.round((tiempoTotal % 1) * 60)}m`
    };
}

/**
 * Smart decision rules with TRAP load analysis
 */
function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
    const {
        zonaOrigen = 'DESCONOCIDA',
        zonaDestino = 'DESCONOCIDA',
        origenState = '',
        destinoState = '',
        areaMala = false,
        relocalizaBuena = false,
        tiempoSinCarga = 0
    } = factoresAdicionales;

    // Analyze trap penalty
    let trapAnalysis = null;
    if (origenState && destinoState) {
        trapAnalysis = analizarTrapPenalty(origenState, destinoState, millas, rpm);
    }

    const COSTO_BASE_MI = window.COSTO_BASE_MI || 0.55;
    const FLOOR_ACCEPT = window.FLOOR_ACCEPT || 0.75;
    const FLOOR_ESCAPE = window.FLOOR_ESCAPE || 0.55;

    // Handle TRAP loads
    if (trapAnalysis && trapAnalysis.esTrampa) {
        const rpmMinimo = 1.25;

        if (rpm < rpmMinimo) {
            return {
                decision: "RECHAZA - TRAMPA",
                level: "reject",
                icon: "❌",
                color: "decision-reject",
                razon: trapAnalysis.advertencia + `\nRPM ofrecido: $${rpm.toFixed(2)} < Mínimo $${rpmMinimo}`,
                confianza: "Alta",
                trapAnalysis
            };
        } else {
            return {
                decision: "EVALUA CON MUCHO CUIDADO",
                level: "warning",
                icon: "⚠️",
                color: "decision-warning",
                razon: `RPM $${rpm.toFixed(2)} es bueno, pero te saca del Midwest.\n` + trapAnalysis.advertencia,
                confianza: "Media",
                trapAnalysis
            };
        }
    }

    // Optimal Midwest movement
    if (trapAnalysis && trapAnalysis.nivel === 'OPTIMO') {
        const umbralOptimo = millas <= 400 ? 1.00 : 0.85;
        if (rpm >= umbralOptimo) {
            return {
                decision: "ACEPTA",
                level: "accept",
                icon: "✅",
                color: "decision-accept",
                razon: trapAnalysis.advertencia + `\nRPM $${rpm.toFixed(2)} excelente para movimiento interno`,
                confianza: "Alta",
                trapAnalysis
            };
        }
    }

    // Relocation
    if (trapAnalysis && trapAnalysis.nivel === 'RELOCALIZACION') {
        if (rpm >= 0.70) {
            return {
                decision: "ACEPTA",
                level: "accept",
                icon: "✅",
                color: "decision-accept",
                razon: trapAnalysis.advertencia + `\nRPM $${rpm.toFixed(2)} aceptable para salir`,
                confianza: tiempoSinCarga >= 1 ? "Alta" : "Media-Alta",
                trapAnalysis
            };
        }
    }

    // Default logic
    let pisoAceptar = FLOOR_ACCEPT;
    let pisoEscape = FLOOR_ESCAPE;
    if (millas <= 400) pisoAceptar = Math.max(pisoAceptar, 0.80);
    if (millas > 800) pisoAceptar = Math.min(pisoAceptar, 0.72);

    if (rpm < COSTO_BASE_MI - 0.01) {
        return {
            decision: "RECHAZA",
            level: "reject",
            icon: "❌",
            color: "decision-reject",
            razon: `RPM $${rpm.toFixed(2)} < costo $${COSTO_BASE_MI.toFixed(2)}`,
            confianza: "Alta"
        };
    }

    if (rpm >= pisoAceptar) {
        return {
            decision: "ACEPTA",
            level: "accept",
            icon: "✅",
            color: "decision-accept",
            razon: `RPM $${rpm.toFixed(2)} ≥ ${pisoAceptar.toFixed(2)} · Destino ${zonaDestino}`,
            confianza: "Alta"
        };
    }

    return {
        decision: "RECHAZA",
        level: "reject",
        icon: "❌",
        color: "decision-reject",
        razon: `RPM $${rpm.toFixed(2)} por debajo de umbral`,
        confianza: "Alta"
    };
}

/**
 * Get detailed reasoning
 */
function obtenerRazonDetallada(nivel, rpm, millas, factores, razonesEspeciales = []) {
    const TU_COSTO_REAL = window.TU_COSTO_REAL || { TOTAL: 0.576 };
    const categoria = millas <= 400 ? "corta" : millas <= 600 ? "media" : "larga";
    const gananciaEstimada = rpm - TU_COSTO_REAL.TOTAL;
    const gananciaTotal = gananciaEstimada * millas;

    let razon = `Carga ${categoria} (${millas}mi): `;

    if (nivel === "accept") {
        razon += `Excelente RPM $${rpm.toFixed(2)}/mi. Ganancia estimada: $${gananciaTotal.toFixed(0)}`;
    } else if (nivel === "warning") {
        razon += `RPM $${rpm.toFixed(2)}/mi en límite. Ganancia: $${gananciaTotal.toFixed(0)}`;
        if (razonesEspeciales.length > 0) {
            razon += `. Factores a favor: ${razonesEspeciales.join(", ")}`;
        }
    } else {
        razon += `RPM $${rpm.toFixed(2)}/mi, Muy bajo. Ganancia: $${gananciaTotal.toFixed(0)}`;
        if (gananciaTotal < 50) {
            razon += ". Busca mejor alternativa.";
        }
    }

    return razon;
}

/**
 * Detect special factors automatically
 */
function detectarFactoresEspeciales(origin, destination, { diasSinCarga = 0 } = {}) {
    const sO = window.getStateFromPlace ? window.getStateFromPlace(origin || '') : '';
    const sD = window.getStateFromPlace ? window.getStateFromPlace(destination || '') : '';
    const zonaO = window.categorizeZone ? window.categorizeZone(sO) : 'DESCONOCIDA';
    const zonaD = window.categorizeZone ? window.categorizeZone(sD) : 'DESCONOCIDA';

    const areaMala = (zonaO === 'ROJA');
    const destinoMejorQueOrigen = (
        (zonaO === 'ROJA' && (zonaD === 'AMARILLA' || zonaD === 'VERDE')) ||
        (zonaO === 'AMARILLA' && zonaD === 'VERDE')
    );

    return {
        areaMala,
        relocalizaBuena: destinoMejorQueOrigen,
        zonaOrigen: zonaO,
        zonaDestino: zonaD,
        origenState: sO,
        destinoState: sD,
        tiempoSinCarga: diasSinCarga,
        alternativasLimitadas: false
    };
}

// ========================================
// DECISION PANEL UI
// ========================================

/**
 * Show decision panel
 */
function showDecisionPanel(calculationData = {}) {
    // Implementation would go here - simplified for lazy loading
    console.log('Decision panel:', calculationData);
}

/**
 * Hide decision panel
 */
function hideDecisionPanel() {
    const panel = document.getElementById('decisionPanel');
    if (panel) panel.classList.add('hidden');
}

// ========================================
// EXPORTS
// ========================================

window.CalculatorDecision = {
    getDecisionMode,
    clasificarZonaReal,
    analizarTrapPenalty,
    calcularTiempoReal,
    getDecisionInteligente,
    obtenerRazonDetallada,
    detectarFactoresEspeciales,
    showDecisionPanel,
    hideDecisionPanel
};

// Individual exports for compatibility
window.getDecisionMode = getDecisionMode;
window.clasificarZonaReal = clasificarZonaReal;
window.analizarTrapPenalty = analizarTrapPenalty;
window.calcularTiempoReal = calcularTiempoReal;
window.getDecisionInteligente = getDecisionInteligente;
window.obtenerRazonDetallada = obtenerRazonDetallada;
window.detectarFactoresEspeciales = detectarFactoresEspeciales;
window.showDecisionPanel = showDecisionPanel;
window.hideDecisionPanel = hideDecisionPanel;

console.log('📦 Calculator Decision module loaded successfully');
