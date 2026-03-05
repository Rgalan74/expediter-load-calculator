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
        const rpmSalida = 0.65; // RPM promedio que pagan para salir de TRAP
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
 * getDecisionInteligente — Logica user-agnostic
 * 4 zonas dinamicas derivadas de datos reales del usuario.
 * NOTA: ahora es async — usar await donde se llame.
 */
async function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
    const { destinoState = '' } = factoresAdicionales;

    // Obtener CPM real del usuario
    const cpmResult = await window.CPMEngine.getCPM();
    const cpm = cpmResult.cpm;

    // Obtener avgRPM y stateStats desde lexProfiles
    let avgRPM = 0;
    let stateStats = {};
    try {
        const uid = window.currentUser?.uid;
        if (uid) {
            const profileSnap = await firebase.firestore()
                .collection('lexProfiles').doc(uid).get();
            if (profileSnap.exists) {
                avgRPM = profileSnap.data().avgRPM || 0;
                stateStats = profileSnap.data().stateStats || {};
            }
        }
    } catch (e) { /* sin historial, usar solo cpm */ }

    // Obtener targetProfit % desde config del usuario
    let targetProfitPct = 0.20; // fallback 20%
    try {
        const uid = window.currentUser?.uid;
        if (uid) {
            const userSnap = await firebase.firestore()
                .collection('users').doc(uid).get();
            if (userSnap.exists) {
                const tp = userSnap.data().targetProfit;
                if (tp && tp > 0) targetProfitPct = tp / 100;
            }
        }
    } catch (e) { /* usar fallback */ }

    // Calcular thresholds dinamicos
    const targetRPM_margen = cpm / (1 - targetProfitPct);
    const acceptThreshold = avgRPM > 0 ? Math.max(targetRPM_margen, avgRPM) : targetRPM_margen;
    const midThreshold = avgRPM > 0 ? Math.min(targetRPM_margen, avgRPM) : targetRPM_margen;

    // Logica de decision
    let decision, level, icon, color, razon;

    if (rpm < cpm) {
        decision = 'RECHAZA';
        level = 'reject';
        icon = '❌';
        color = 'decision-reject';
        const perdida = ((cpm - rpm) * 100).toFixed(1);
        razon = `Pierdes $${perdida} por cada 100mi — RPM $${rpm.toFixed(3)} no cubre tu costo de $${cpm.toFixed(3)}/mi`;

    } else if (rpm >= acceptThreshold) {
        decision = 'ACEPTA';
        level = 'accept';
        icon = '✅';
        color = 'decision-accept';
        const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
        const ganancia100 = ((rpm - cpm) * 100).toFixed(0);
        razon = `Margen ${margenReal}% — ganas $${ganancia100} por cada 100mi`;

    } else if (rpm >= midThreshold) {
        decision = 'CASI ACEPTA';
        level = 'warning-high';
        icon = '🟡';
        color = 'decision-warning-high';
        const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
        const falta = ((acceptThreshold - rpm) * 100).toFixed(1);
        razon = `Margen ${margenReal}% — faltan $${falta}¢/100mi para tu objetivo`;

    } else {
        decision = 'EVALUA CON CUIDADO';
        level = 'warning-low';
        icon = '🟠';
        color = 'decision-warning-low';
        const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
        razon = `Margen ${margenReal}% — cubre costos pero debajo de tu umbral minimo`;
    }

    // Contexto del estado — solo informa, no cambia decision
    if (destinoState && stateStats[destinoState]?.loads >= 2) {
        const stats = stateStats[destinoState];
        const diff = ((rpm - stats.avgRPM) / stats.avgRPM * 100).toFixed(1);
        const signo = diff >= 0 ? '+' : '';
        razon += ` | ${destinoState}: tu historico $${stats.avgRPM.toFixed(3)}/mi (${signo}${diff}%)`;
    }

    return {
        decision,
        level,
        icon,
        color,
        razon,
        confianza: (level === 'accept' || level === 'reject') ? 'Alta' : 'Media',
        thresholds: { cpm, midThreshold, acceptThreshold, avgRPM, targetProfitPct }
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
