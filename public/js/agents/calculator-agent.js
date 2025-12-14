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
    const cpm = profile?.avgCPM || 0.576;
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
      cpm
    };
  }

  // Detectar trap load
  detectTrap(originState, destState, miles, rpm) {
    const trapZones = ['NV', 'CA', 'FL'];
    const goodZones = ['IL', 'IN', 'OH', 'KY', 'TN', 'IA', 'MO'];

    const analysis = {
      isTrap: false,
      level: 'NORMAL',
      warning: null,
      minimumRPM: null
    };

    // Caso 1: Midwest → Trap
    if (goodZones.includes(originState) && trapZones.includes(destState)) {
      analysis.isTrap = true;
      analysis.level = 'TRAMPA';
      analysis.warning = `⚠️ Zona trampa: ${originState} → ${destState}`;
      analysis.minimumRPM = 1.25;
    }
    // Caso 2: Dentro de trap
    else if (trapZones.includes(destState)) {
      analysis.isTrap = true;
      analysis.level = 'EVALUAR';
      analysis.warning = `⚠️ ${destState} tiene pocas salidas`;
      analysis.minimumRPM = 1.05;
    }

    return analysis;
  }

  // Generar recomendación
  generateRecommendation(ctx) {
    const { metrics, trap, profile } = ctx;

    const decision = {
      action: null,
      level: null,
      reasons: [],
      alternatives: []
    };

    const minSafe = profile?.minSafeRPM || 0.85;
    const target = profile?.targetRPM || 1.0;

    // Lógica de decisión
    if (trap.isTrap && metrics.rpm < trap.minimumRPM) {
      decision.action = 'RECHAZA';
      decision.level = 'reject';
      decision.reasons.push(trap.warning);
      decision.reasons.push(`RPM $${metrics.rpm.toFixed(2)} < Mínimo $${trap.minimumRPM}`);
    }
    else if (metrics.rpm < minSafe) {
      decision.action = 'RECHAZA';
      decision.level = 'reject';
      decision.reasons.push(`RPM $${metrics.rpm.toFixed(2)} debajo del costo`);
    }
    else if (metrics.rpm >= target) {
      decision.action = 'ACEPTA';
      decision.level = 'accept';
      decision.reasons.push(`Excelente RPM $${metrics.rpm.toFixed(2)}`);
      decision.reasons.push(`Ganancia: $${metrics.profit.toFixed(0)}`);
    }
    else {
      decision.action = 'EVALUA';
      decision.level = 'warning';
      decision.reasons.push(`RPM aceptable $${metrics.rpm.toFixed(2)}`);
      if (trap.isTrap) decision.reasons.push(trap.warning);
    }

    // Contraoferta
    if (metrics.rpm < target && metrics.rpm >= minSafe) {
      const counterRate = target * ctx.loadData.totalMiles;
      decision.alternatives.push({
        type: 'COUNTER_OFFER',
        value: counterRate,
        rpm: target,
        message: `Contraofertar $${counterRate.toFixed(0)}`
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

console.log('🧮 CalculatorAgent loaded');