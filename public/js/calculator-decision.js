/**
 * @copyright 2026 SmartLoad Solution — Ricardo Galan. All rights reserved.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without prior written permission.
 * Violators may be prosecuted under applicable copyright law.
 *
 * @product    Expediter Load Calculator (SmartLoad Solution)
 * @author     Ricardo Galan <ricardogalan74@gmail.com>
 * @license    Proprietary — All Rights Reserved
 * @fingerprint SLS-2026-RG74-EXPEDITER
 */
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

        // Distancias estimadas promedio de escape (Bounce) hacia la zona verde más cercana para Cargo Vans
        const millasEscapePorTrampa = {
            'FL': 400, 'TX': 350, 'CA': 750, 'AZ': 450, 'NM': 500, 
            'NV': 550, 'OR': 350, 'WA': 400, 'ID': 300, 'MT': 500, 
            'WY': 400, 'UT': 400, 'CO': 400, 'ND': 300, 'SD': 300, 'NE': 300
        };
        const millasRegreso = millasEscapePorTrampa[destinoState] || 600; 
        const rpmSalida = 0.65; // RPM de rescate asumido para un reposicionamiento ligero
        // Usar costo real del usuario si está disponible, o fallback al default
        const costoPorMilla = (window.TU_COSTO_REAL && window.TU_COSTO_REAL.TOTAL) ? window.TU_COSTO_REAL.TOTAL : 0.576;

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
            advertencia: `TRAMPA: Te envía a ${destinoState} (costo de ${millasRegreso} millas de escape hacia zona segura incluido).`,
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
 * getDecisionInteligente — Proxy al servidor (Cloud Function evaluateLoad)
 * La logica real corre en functions/index.js — invisible en DevTools.
 * Fallback local si el servidor no responde.
 */
async function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
    const { destinoState = '', origenState = '' } = factoresAdicionales;

    try {
        // Llamar al servidor — logica 100% oculta al cliente
        const evaluateLoad = firebase.functions().httpsCallable('evaluateLoad');
        const result = await evaluateLoad({ rpm, millas, origenState, destinoState });
        const d = result.data;
        return {
            decision:   d.decision,
            level:      d.level,
            icon:       d.icon,
            color:      'decision-' + d.level,
            razon:      d.razon,
            confianza:  d.confianza,
            thresholds: d.thresholds
        };

    } catch (err) {
        debugLog('[evaluateLoad] Servidor no disponible, fallback local:', err.message);

        // Fallback local basico
        const cpmResult = await window.CPMEngine.getCPM();
        const cpm = cpmResult.cpm;
        const netProfit = Math.max(0, (rpm - cpm) * millas);
        const diasInvertidos = Math.max(1, Math.ceil(millas / 600)) + 1;
        const gananciaDia = (netProfit / diasInvertidos).toFixed(0);

        let decision, level, icon, color, razon;
        if (rpm < cpm) {
            decision = 'RECHAZA'; level = 'reject'; icon = '❌'; color = 'decision-reject';
            razon = 'RPM $' + rpm.toFixed(3) + ' no cubre costos $' + cpm.toFixed(3) + '/mi';
        } else if (rpm >= cpm * 1.20) {
            decision = 'ACEPTA'; level = 'accept'; icon = '✅'; color = 'decision-accept';
            razon = 'Margen ' + (((rpm-cpm)/rpm)*100).toFixed(1) + '% — ~$' + gananciaDia + '/dia';
        } else {
            decision = 'EVALUA CON CUIDADO'; level = 'warning-low'; icon = '🟠'; color = 'decision-warning-low';
            razon = 'Margen ' + (((rpm-cpm)/rpm)*100).toFixed(1) + '% — cubre costos, verifica rentabilidad';
        }
        return { decision, level, icon, color, razon, confianza: 'Media',
            thresholds: { cpm, midThreshold: cpm, acceptThreshold: cpm*1.20, avgRPM: 0, targetProfitPct: 0.20 } };
    }
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
    debugLog('Decision panel:', calculationData);
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

debugLog('📦 Calculator Decision module loaded successfully');
