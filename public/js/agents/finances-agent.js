// ==========================================================
//  FINANCES AGENT - Experto en análisis financiero
// ==========================================================

class FinancesAgent extends AgentBase {
  constructor() {
    super('Finances', [
      'ANALYZE_FINANCES',
      'TRACK_EXPENSES',
      'CALCULATE_PROFIT',
      'REVIEW_FINANCES'
    ]);

    this.log('Inicializado', 'SUCCESS');
  }

  async execute(task, context) {
    this.setState('THINKING');

    try {
      // 1. Cargar datos financieros
      const finances = await this.loadFinancialData(context);

      // 2. Analizar KPIs
      const kpis = this.calculateKPIs(finances);

      // 3. Detectar alertas
      const alerts = this.detectAlerts(kpis);

      // 4. Generar insights
      const insights = this.generateInsights(kpis, alerts);

      this.setState('DONE');

      return {
        agent: this.name,
        success: true,
        data: {
          period: finances.period,
          kpis,
          alerts
        },
        insights,
        summary: this.generateSummary(kpis)
      };

    } catch (err) {
      this.setState('ERROR');
      this.log(err.message, 'ERROR');
      throw err;
    }
  }

  async loadFinancialData(context) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Período: últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      // Cargar cargas
      const loadsSnapshot = await firebase.firestore()
        .collection('loads')
        .where('userId', '==', user.uid)
        .get();

      const loads = [];
      loadsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.date >= dateStr) {
          loads.push({
            date: data.date,
            revenue: Number(data.totalCharge || 0),
            miles: Number(data.totalMiles || 0),
            profit: Number(data.netProfit || 0)
          });
        }
      });

      // Cargar gastos
      const expensesSnapshot = await firebase.firestore()
        .collection('expenses')
        .where('userId', '==', user.uid)
        .get();

      const expenses = [];
      expensesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.date >= dateStr) {
          expenses.push({
            date: data.date,
            category: data.category || 'Otros',
            amount: Number(data.amount || 0)
          });
        }
      });

      this.log(`Cargadas ${loads.length} cargas y ${expenses.length} gastos`, 'SUCCESS');

      return {
        period: 'Últimos 30 días',
        loads,
        expenses
      };

    } catch (err) {
      this.log(`Error cargando datos: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  calculateKPIs(finances) {
    const { loads, expenses } = finances;

    // Revenue & miles
    const totalRevenue = loads.reduce((sum, l) => sum + l.revenue, 0);
    const totalMiles = loads.reduce((sum, l) => sum + l.miles, 0);
    const numLoads = loads.length;

    // Expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Profit
    const totalProfit = loads.reduce((sum, l) => sum + l.profit, 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Averages
    const avgRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const avgRevenuePerLoad = numLoads > 0 ? totalRevenue / numLoads : 0;
    const avgExpensePerLoad = numLoads > 0 ? totalExpenses / numLoads : 0;

    // Por categoría
    const expensesByCategory = {};
    expenses.forEach(e => {
      const cat = e.category;
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = 0;
      }
      expensesByCategory[cat] += e.amount;
    });

    return {
      totalRevenue,
      totalMiles,
      totalExpenses,
      netProfit,
      margin,
      numLoads,
      numExpenses: expenses.length,
      avgRPM,
      avgRevenuePerLoad,
      avgExpensePerLoad,
      expensesByCategory
    };
  }

  detectAlerts(kpis) {
    const alerts = [];

    // Margen bajo
    if (kpis.margin < 20) {
      alerts.push(`⚠️ Margen bajo: ${kpis.margin.toFixed(1)}% (objetivo: >25%)`);
    }

    // Gastos altos
    if (kpis.totalExpenses > kpis.totalRevenue * 0.6) {
      alerts.push(`⚠️ Gastos representan ${((kpis.totalExpenses/kpis.totalRevenue)*100).toFixed(0)}% de ingresos`);
    }

    // RPM bajo
    if (kpis.avgRPM < 0.95) {
      alerts.push(`⚠️ RPM promedio bajo: $${kpis.avgRPM.toFixed(2)}/mi`);
    }

    // Pérdida neta
    if (kpis.netProfit < 0) {
      alerts.push(`❌ Pérdida neta: $${Math.abs(kpis.netProfit).toFixed(0)}`);
    }

    return alerts;
  }

  generateInsights(kpis, alerts) {
    const insights = {
      positive: [],
      warnings: []
    };

    // Positivos
    if (kpis.margin > 30) {
      insights.positive.push(`Excelente margen: ${kpis.margin.toFixed(1)}%`);
    }

    if (kpis.avgRPM > 1.0) {
      insights.positive.push(`Buen RPM promedio: $${kpis.avgRPM.toFixed(2)}/mi`);
    }

    if (kpis.netProfit > 0) {
      insights.positive.push(`Ganancia neta positiva: $${kpis.netProfit.toFixed(0)}`);
    }

    // Warnings
    insights.warnings = alerts;

    // Categoría más cara
    if (Object.keys(kpis.expensesByCategory).length > 0) {
      const sorted = Object.entries(kpis.expensesByCategory).sort((a, b) => b[1] - a[1]);
      const topCategory = sorted[0];
      insights.positive.push(`Mayor gasto: ${topCategory[0]} ($${topCategory[1].toFixed(0)})`);
    }

    return insights;
  }

  generateSummary(kpis) {
    if (kpis.netProfit > 0 && kpis.margin > 25) {
      return `Excelente período: $${kpis.netProfit.toFixed(0)} de ganancia neta con ${kpis.margin.toFixed(1)}% de margen. Sigue así 🚀`;
    } else if (kpis.netProfit > 0) {
      return `Período rentable con $${kpis.netProfit.toFixed(0)} de ganancia, pero el margen podría mejorar (${kpis.margin.toFixed(1)}%)`;
    } else {
      return `Pérdida de $${Math.abs(kpis.netProfit).toFixed(0)} este período. Revisa costos y selectividad de cargas`;
    }
  }
}

// Auto-registrar
if (window.lexMaster) {
  const financesAgent = new FinancesAgent();
  window.lexMaster.registerAgent('finances', financesAgent);
}

console.log('💰 FinancesAgent loaded');