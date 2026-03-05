// ==========================================================
//  CALCULATOR AGENT - Experto en análisis de cargas
// ==========================================================

class CalculatorAgent extends AgentBase {
  constructor() {
    super('Calculator', [
      'ANALYZE_LOAD',
      'CALCULATE_RPM',
      'DETECT_TRAP',
      'SUGGEST_NEGOTIATION'
    ]);

    this.tools = {
      rpmCalc: this.calculateRPM.bind(this),
      trapDetect: this.detectTrap.bind(this)
    };

    this.log('Inicializado', 'SUCCESS');
  }

  // Ejecutar análisis
  async execute(task, context) {
    this.setState('THINKING');

    try {
      // 1. Obtener datos
      const loadData = this.extractLoadData(context);

      if (!loadData || !loadData.totalMiles) {
        throw new Error('No hay datos de carga');
      }

      this.log(`Analizando: ${loadData.totalMiles} millas`, 'INFO');

      // 2. Calcular métricas
      const metrics = this.tools.rpmCalc(loadData, context.profile);

      // 3. Detectar trap
      const trap = this.tools.trapDetect(
        loadData.originState,
        loadData.destinationState,
        loadData.totalMiles,
        metrics.rpm
      );

      // 4. Generar recomendación
      const recommendation = this.generateRecommendation({
        loadData,
        metrics,
        trap,
        profile: context.profile
      });

      this.setState('DONE');
      this.remember('lastAnalysis', { loadData, metrics, recommendation });

      return {
        agent: this.name,
        success: true,
        data: { loadData, metrics, trap },
        recommendation,
        confidence: this.calculateConfidence(recommendation)
      };

    } catch (err) {
      this.setState('ERROR');
      this.log(err.message, 'ERROR');
      throw err;
    }
  }

  // Extraer datos de carga del DOM
  extractLoadData(context) {
    // Si viene en contexto, usar
    if (context.currentLoad) return context.currentLoad;

    // Si no, extraer del DOM
    try {
      const origin = document.getElementById('origin');
      const dest = document.getElementById('destination');
      const rate = document.getElementById('rate');
      const loaded = document.getElementById('loadedMiles');
      const deadhead = document.getElementById('deadhead');

      if (!origin || !dest || !rate) return null;

      const loadedMi = parseFloat(loaded?.value) || 0;
      const deadheadMi = parseFloat(deadhead?.value) || 0;

      return {
        origin: origin.value,
        destination: dest.value,
        rate: parseFloat(rate.value) || 0,
        loadedMiles: loadedMi,
        deadheadMiles: deadheadMi,
        totalMiles: loadedMi + deadheadMi,
        originState: this.extractState(origin.value),
        destinationState: this.extractState(dest.value)
      };

    } catch (err) {
      this.log('Error extrayendo del DOM', 'ERROR');
      return null;
    }
  }

  // Calcular RPM y métricas
  calculateRPM(loadData, profile) {
    const total = loadData.totalMiles;
    const rpm = total > 0 ? loadData.rate / total : 0;
    const cpm = profile?.realCPM || profile?.avgCPM || getUserCPM();
    const historicalCPM = profile?.avgCPM || cpm;
    const profit = loadData.rate - (total * cpm);
    const deadheadPct = total > 0 ? (loadData.deadheadMiles / total) * 100 : 0;

    // Tiempo estimado
    const speed = 65;
    const driveTime = total / speed;
    const stops = Math.floor(total / 300);
    const stopTime = stops * 0.5;
    const totalTime = driveTime + stopTime;
    const hourlyRate = totalTime > 0 ? profit / totalTime : 0;

    return {
      rpm,
      profit,
      profitPerMile: total > 0 ? profit / total : 0,
      deadheadPercent: deadheadPct,
      hourlyRate,
      estimatedTime: totalTime,
      cpm,
      historicalCPM
    };
  }

  // Detectar si el destino es historicamente dificil para ESTE usuario
  // No usa zonas hardcodeadas — usa historial real del usuario
  detectTrap(originState, destState, miles, rpm) {
    const analysis = {
      isTrap: false,
      level: 'NORMAL',
      warning: null,
      minimumRPM: null
    };

    try {
      const stateStats = window._userStateStats || {};
      const userCPM = window._userCPM || 0;

      if (destState && stateStats[destState] && stateStats[destState].loads >= 2) {
        const stats = stateStats[destState];
        // Dificil para este usuario si su RPM historico alli esta cerca del CPM
        if (userCPM > 0 && stats.avgRPM < userCPM * 1.10) {
          analysis.isTrap = true;
          analysis.level = 'EVALUAR';
          analysis.warning = `⚠️ ${destState}: tu RPM historico alli es bajo ($${stats.avgRPM.toFixed(3)}/mi en ${stats.loads} cargas)`;
        }
      }
    } catch (e) { /* sin datos de historial */ }

    return analysis;
  }

  // Generar recomendacion — user-agnostic
  generateRecommendation(ctx) {
    const { metrics, trap, profile } = ctx;

    const decision = {
      action: null,
      level: null,
      reasons: [],
      alternatives: []
    };

    // Thresholds calculados desde datos reales del usuario
    const cpm = metrics.cpm;
    const avgRPM = profile?.avgRPM || 0;
    const targetProfitPct = profile?.targetProfitPct || 0.20;

    const targetRPM_margen = cpm > 0 ? cpm / (1 - targetProfitPct) : cpm * 1.20;
    const acceptThreshold = avgRPM > 0 ? Math.max(targetRPM_margen, avgRPM) : targetRPM_margen;
    const midThreshold = avgRPM > 0 ? Math.min(targetRPM_margen, avgRPM) : targetRPM_margen;

    const rpm = metrics.rpm;

    if (rpm < cpm) {
      decision.action = 'RECHAZA';
      decision.level = 'reject';
      const perdida = ((cpm - rpm) * 100).toFixed(1);
      decision.reasons.push(`Pierdes $${perdida}/100mi — RPM no cubre tu costo`);

    } else if (rpm >= acceptThreshold) {
      decision.action = 'ACEPTA';
      decision.level = 'accept';
      const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
      const ganancia = ((rpm - cpm) * 100).toFixed(0);
      decision.reasons.push(`Margen ${margenReal}% — ganas $${ganancia}/100mi`);
      decision.reasons.push(`Ganancia total: $${metrics.profit.toFixed(0)}`);

    } else if (rpm >= midThreshold) {
      decision.action = 'CASI ACEPTA';
      decision.level = 'warning-high';
      const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
      const falta = ((acceptThreshold - rpm) * 100).toFixed(1);
      decision.reasons.push(`Margen ${margenReal}% — faltan $${falta}¢/100mi para tu objetivo`);

    } else {
      decision.action = 'EVALUA CON CUIDADO';
      decision.level = 'warning-low';
      const margenReal = (((rpm - cpm) / rpm) * 100).toFixed(1);
      decision.reasons.push(`Margen ${margenReal}% — debajo de tu umbral minimo`);
    }

    // Contexto del estado si hay historial — solo informa
    if (trap.isTrap && trap.warning) {
      decision.reasons.push(trap.warning);
    }

    // Comparacion historica de costos
    if (metrics.historicalCPM && Math.abs(metrics.cpm - metrics.historicalCPM) > 0.02) {
      const trend = metrics.cpm > metrics.historicalCPM ? '📈 Costos subieron' : '📉 Costos bajaron';
      decision.reasons.push(`${trend} vs historico ($${metrics.historicalCPM.toFixed(3)}/mi)`);
    }

    // Contraoferta — siempre hacia el acceptThreshold
    if (rpm < acceptThreshold && rpm >= cpm) {
      const counterRate = acceptThreshold * ctx.loadData.totalMiles;
      decision.alternatives.push({
        type: 'COUNTER_OFFER',
        value: counterRate,
        rpm: acceptThreshold,
        message: `Contraofertar $${counterRate.toFixed(0)} ($${acceptThreshold.toFixed(3)}/mi)`
      });
    }

    return decision;
  }

  // Calcular confianza
  calculateConfidence(rec) {
    if (rec.level === 'accept' || rec.level === 'reject') return 0.85;
    return 0.65;
  }

  // Extraer estado de dirección
  extractState(address) {
    if (!address) return null;
    const match = address.match(/,\s*([A-Z]{2})\s*$/);
    return match ? match[1] : null;
  }
}

// Auto-registrar si LexMaster existe
if (window.lexMaster) {
  const calcAgent = new CalculatorAgent();
  window.lexMaster.registerAgent('calculator', calcAgent);
}

debugLog('🧮 CalculatorAgent loaded');