// ==========================================================
//  HISTORY AGENT - Experto en análisis histórico
// ==========================================================

class HistoryAgent extends AgentBase {
  constructor() {
    super('History', [
      'ANALYZE_PERFORMANCE',
      'COMPARE_HISTORY',
      'DETECT_TRENDS',
      'STATE_ANALYSIS'
    ]);

    this.tools = {
      loadHistory: this.loadHistoricalData.bind(this),
      analyzePerformance: this.analyzePerformance.bind(this),
      detectTrends: this.detectTrends.bind(this)
    };

    this.log('Inicializado', 'SUCCESS');
  }

  async execute(task, context) {
    this.setState('THINKING');

    try {
      // 1. Cargar datos históricos
      const loads = await this.tools.loadHistory(context);

      if (!loads || loads.length === 0) {
        throw new Error('No hay historial de cargas');
      }

      this.log(`Analizando ${loads.length} cargas`, 'INFO');

      // 2. Analizar rendimiento
      const performance = this.tools.analyzePerformance(loads);

      // 3. Detectar tendencias
      const trends = this.tools.detectTrends(loads);

      // 4. Análisis por estado
      const stateAnalysis = this.analyzeByState(loads);

      // 5. Generar insights
      const insights = this.generateInsights(performance, trends, stateAnalysis);

      this.setState('DONE');
      this.remember('lastAnalysis', { performance, trends, stateAnalysis });

      return {
        agent: this.name,
        success: true,
        data: {
          totalLoads: loads.length,
          performance,
          trends,
          stateAnalysis
        },
        insights,
        recommendations: this.generateRecommendations(insights)
      };

    } catch (err) {
      this.setState('ERROR');
      this.log(err.message, 'ERROR');
      throw err;
    }
  }

  async loadHistoricalData(context) {
    // Si viene en contexto
    if (context.historicalLoads) return context.historicalLoads;

    // Cargar de Firebase
    const user = firebase.auth().currentUser;
    if (!user) {
      this.log('Usuario no autenticado', 'WARNING');
      return [];
    }

    try {
      const snapshot = await firebase.firestore()
        .collection('loads')
        .where('userId', '==', user.uid)
        .limit(100)
        .get();

      const loads = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        loads.push({
          id: doc.id,
          date: data.date,
          originState: data.originState,
          destinationState: data.destinationState,
          totalMiles: Number(data.totalMiles || 0),
          rate: Number(data.totalCharge || 0),
          rpm: Number(data.rpm || 0),
          profit: Number(data.netProfit || 0)
        });
      });

      // Ordenar en JS (más recientes primero)
      loads.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });

      this.log(`Cargadas ${loads.length} cargas`, 'SUCCESS');
      return loads;

    } catch (err) {
      this.log(`Error Firebase: ${err.message}`, 'ERROR');
      return [];
    }
  }

  analyzePerformance(loads) {
    const totalMiles = loads.reduce((sum, l) => sum + l.totalMiles, 0);
    const totalRevenue = loads.reduce((sum, l) => sum + l.rate, 0);
    const totalProfit = loads.reduce((sum, l) => sum + l.profit, 0);

    const avgRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const avgProfit = loads.length > 0 ? totalProfit / loads.length : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const profitable = loads.filter(l => l.profit > 0).length;
    const unprofitable = loads.length - profitable;

    return {
      totalLoads: loads.length,
      totalMiles,
      totalRevenue,
      totalProfit,
      avgRPM,
      avgProfit,
      profitMargin,
      profitableLoads: profitable,
      unprofitableLoads: unprofitable
    };
  }

  detectTrends(loads) {
    if (loads.length < 10) {
      return { status: 'INSUFFICIENT_DATA', message: 'Necesitas más cargas para detectar tendencias' };
    }

    // Dividir en dos períodos
    const mid = Math.floor(loads.length / 2);
    const recent = loads.slice(0, mid);
    const older = loads.slice(mid);

    const recentAvgRPM = recent.reduce((sum, l) => sum + l.rpm, 0) / recent.length;
    const olderAvgRPM = older.reduce((sum, l) => sum + l.rpm, 0) / older.length;

    const rpmChange = ((recentAvgRPM - olderAvgRPM) / olderAvgRPM) * 100;

    const direction = rpmChange > 5 ? 'IMPROVING' : rpmChange < -5 ? 'DECLINING' : 'STABLE';
    const strength = Math.abs(rpmChange) > 15 ? 'STRONG' : Math.abs(rpmChange) > 5 ? 'MODERATE' : 'WEAK';

    return {
      status: 'DETECTED',
      direction,
      strength,
      rpmChange: rpmChange.toFixed(1),
      recentAvgRPM: recentAvgRPM.toFixed(2),
      olderAvgRPM: olderAvgRPM.toFixed(2)
    };
  }

  analyzeByState(loads) {
    const stateStats = {};

    loads.forEach(load => {
      const state = load.destinationState;
      if (!state) return;

      if (!stateStats[state]) {
        stateStats[state] = {
          loads: 0,
          totalMiles: 0,
          totalRevenue: 0,
          totalProfit: 0,
          rpms: []
        };
      }

      stateStats[state].loads++;
      stateStats[state].totalMiles += load.totalMiles;
      stateStats[state].totalRevenue += load.rate;
      stateStats[state].totalProfit += load.profit;
      stateStats[state].rpms.push(load.rpm);
    });

    // Calcular promedios
    Object.keys(stateStats).forEach(state => {
      const stats = stateStats[state];
      stats.avgRPM = stats.totalMiles > 0 ? stats.totalRevenue / stats.totalMiles : 0;
      stats.avgProfit = stats.loads > 0 ? stats.totalProfit / stats.loads : 0;
    });

    // Top 5 y Bottom 3
    const sorted = Object.entries(stateStats)
      .filter(([_, stats]) => stats.loads >= 2)
      .sort(([_, a], [__, b]) => b.avgRPM - a.avgRPM);

    const topStates = sorted.slice(0, 5);
    const worstStates = sorted.slice(-3).reverse();

    return {
      byState: stateStats,
      topStates,
      worstStates
    };
  }

  generateInsights(performance, trends, stateAnalysis) {
    const insights = {
      positive: [],
      warnings: [],
      opportunities: []
    };

    // Insights positivos
    if (performance.profitMargin > 35) {
      insights.positive.push(`Excelente margen: ${performance.profitMargin.toFixed(1)}%`);
    }

    if (trends.direction === 'IMPROVING') {
      insights.positive.push(`Tu RPM ha mejorado ${trends.rpmChange}% recientemente 📈`);
    }

    // Warnings
    if (performance.unprofitableLoads > performance.profitableLoads * 0.3) {
      insights.warnings.push(`${performance.unprofitableLoads} cargas no rentables detectadas`);
    }

    if (trends.direction === 'DECLINING' && trends.strength === 'STRONG') {
      insights.warnings.push(`⚠️ RPM bajando ${Math.abs(parseFloat(trends.rpmChange))}%`);
    }

    // Oportunidades
    if (stateAnalysis.topStates.length > 0) {
      const top = stateAnalysis.topStates[0];
      insights.opportunities.push(`Enfócate en ${top[0]}: $${top[1].avgRPM.toFixed(2)}/mi promedio`);
    }

    return insights;
  }

  generateRecommendations(insights) {
    const recs = [];

    if (insights.warnings.length > 2) {
      recs.push('Revisa tus criterios de aceptación de cargas');
    }

    if (insights.opportunities.length > 0) {
      recs.push('Busca más cargas en tus estados más rentables');
    }

    return recs;
  }
}

// Auto-registrar
if (window.lexMaster) {
  const historyAgent = new HistoryAgent();
  window.lexMaster.registerAgent('history', historyAgent);
}

console.log('📊 HistoryAgent loaded');