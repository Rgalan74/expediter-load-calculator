// ==========================================================
//  LEX MODALS - Adaptador de agentes a modales visuales
// ==========================================================

class LexModals {
  constructor() {
    console.log('🎨 LexModals inicializado');
  }

  // Mostrar resultado según tipo de agente
  showAgentResult(agentResult, context = {}) {
    if (!agentResult || !agentResult.agent) {
      console.error('[LexModals] Resultado inválido:', agentResult);
      return;
    }

    switch (agentResult.agent) {
      case 'Calculator':
        this.showCalculatorModal(agentResult, context);
        break;
      case 'History':
        this.showHistoryModal(agentResult);
        break;
      case 'Zones':
        this.showZonesModal(agentResult);
        break;
      case 'Finances':
        this.showFinancesModal(agentResult);
        break;
      default:
        console.warn('[LexModals] Agente sin modal:', agentResult.agent);
    }
  }

  // ==========================================================
  //  CALCULATOR MODAL
  // ==========================================================
  showCalculatorModal(result, context) {
    const { data, recommendation, confidence } = result;
    
    // Adaptar al formato del modal existente
    const analysis = {
      recommendation: recommendation.action, // ACEPTA, RECHAZA, EVALUA
      confidence: Math.round(confidence * 100),
      metrics: {
        rpm: data.metrics.rpm.toFixed(2),
        rate: data.loadData.rate.toFixed(0),
        estimatedCost: (data.metrics.cpm * data.loadData.totalMiles).toFixed(0),
        profit: data.metrics.profit.toFixed(0),
        dailyProfit: (data.metrics.hourlyRate * 10).toFixed(0), // estimado
        vsAverage: ((data.metrics.rpm - (context.profile?.avgRPM || 0.95)) / (context.profile?.avgRPM || 0.95) * 100).toFixed(1),
        stateAvgRPM: 'N/A', // TODO: agregar desde perfil
        deadheadPercent: data.metrics.deadheadPercent.toFixed(1)
      },
      reasons: recommendation.reasons,
      trapWarning: data.trap.isTrap ? data.trap.warning : null
    };

    // Mapear estados a nombres de imágenes correctos
    const stateMap = {
      'accept': 'happy',
      'reject': 'sad',
      'warning': 'alert'
    };
    const lexState = stateMap[recommendation.level] || 'thinking';
    const loadData = data.loadData;

    // Llamar al modal existente si existe
    if (window.lexAI && typeof window.lexAI.showLexAnalysisModal === 'function') {
      window.lexAI.showLexAnalysisModal(analysis, lexState, loadData);
    } else {
      // Fallback: modal simple
      this.showSimpleModal('Calculator', analysis.recommendation, recommendation.reasons);
    }
  }

  // ==========================================================
  //  HISTORY MODAL
  // ==========================================================
  showHistoryModal(result) {
    const { data, insights } = result;
    
    // Adaptar al formato del modal existente
    const analysis = {
      loads: data.totalLoads,
      totalMiles: data.performance.totalMiles,
      totalRevenue: data.performance.totalRevenue,
      totalProfit: data.performance.totalProfit,
      avgRPM: data.performance.avgRPM,
      avgProfit: data.performance.avgProfit,
      profitMargin: data.performance.profitMargin,
      profitableLoads: data.performance.profitableLoads,
      unprofitableLoads: data.performance.unprofitableLoads,
      topStates: data.stateAnalysis.topStates,
      worstStates: data.stateAnalysis.worstStates,
      insights: insights.positive,
      alerts: insights.warnings
    };

    // Llamar al modal existente si existe
    if (window.lexAI && typeof window.lexAI.showHistoryAnalysisModal === 'function') {
      window.lexAI.showHistoryAnalysisModal(analysis);
    } else {
      // Fallback: modal simple
      this.showSimpleModal('History', `${data.totalLoads} cargas analizadas`, insights.positive);
    }
  }

  // ==========================================================
  //  ZONES MODAL (NUEVO - crear estructura)
  // ==========================================================
  showZonesModal(result) {
    const { data, recommendations } = result;
    
    const existingModal = document.getElementById('lexZonesModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'lexZonesModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col" style="max-height: 90vh;">
        <!-- Header -->
        <div class="text-white p-4 rounded-t-2xl flex-shrink-0" style="background: linear-gradient(to right, #059669, #2563eb) !important;">
          <div class="flex items-center gap-3">
            <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
            <div>
              <h3 class="text-lg font-bold">Análisis de Zonas</h3>
              <p class="text-xs text-emerald-100">Tu rendimiento geográfico</p>
            </div>
          </div>
        </div>

        <div class="p-6 flex-1 overflow-y-auto">
          <!-- Top States -->
          ${data.userZones.topStates.length > 0 ? `
            <div class="mb-4">
              <h4 class="font-bold text-emerald-700 mb-2">🏆 Mejores Estados</h4>
              <div class="space-y-2">
                ${data.userZones.topStates.slice(0, 5).map(s => `
                  <div class="flex justify-between items-center bg-emerald-50 p-2 rounded">
                    <span class="font-semibold">${s.state}</span>
                    <span class="text-sm">$${s.avgRPM.toFixed(2)}/mi (${s.loads} cargas)</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Trap Zones -->
          ${data.userZones.trapStates.length > 0 ? `
            <div class="mb-4">
              <h4 class="font-bold text-red-700 mb-2">⚠️ Zonas Trampa</h4>
              <div class="space-y-2">
                ${data.userZones.trapStates.map(s => `
                  <div class="flex justify-between items-center bg-red-50 p-2 rounded">
                    <span class="font-semibold">${s.state}</span>
                    <span class="text-sm">$${s.avgRPM.toFixed(2)}/mi (${s.loads} cargas)</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Recommendations -->
          <div class="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <h4 class="font-bold text-blue-700 mb-2">💡 Recomendaciones</h4>
            <ul class="space-y-1">
              ${recommendations.map(r => `<li class="text-sm text-blue-900">• ${r}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="p-4 border-t border-gray-200 flex gap-2">
          <button onclick="window.openLexChatModal()" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            💬 Chat con Lex
          </button>
          <button onclick="closeLexZonesModal()" class="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            ✕ Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // ==========================================================
  //  FINANCES MODAL
  // ==========================================================
  showFinancesModal(result) {
    const { data, insights, summary } = result;
    
    // Adaptar al formato del modal existente
    const analysis = {
      periodLabel: data.period,
      totalRevenue: data.kpis.totalRevenue,
      totalExpenses: data.kpis.totalExpenses,
      netProfit: data.kpis.netProfit,
      margin: data.kpis.margin,
      totalMiles: data.kpis.totalMiles,
      avgRpm: data.kpis.avgRPM,
      numLoads: data.kpis.numLoads,
      numExpenses: data.kpis.numExpenses,
      avgRevenuePerLoad: data.kpis.avgRevenuePerLoad,
      avgExpensePerLoad: data.kpis.avgExpensePerLoad,
      insights: insights.positive,
      alerts: insights.warnings,
      summary: summary
    };

    // Llamar al modal existente si existe
    if (window.lexAI && typeof window.lexAI.showFinanceAnalysisModal === 'function') {
      window.lexAI.showFinanceAnalysisModal(analysis);
    } else {
      // Fallback: modal simple
      this.showSimpleModal('Finances', summary, insights.positive);
    }
  }

  // ==========================================================
  //  FALLBACK: Modal simple
  // ==========================================================
  showSimpleModal(title, message, items = []) {
    alert(`${title}\n\n${message}\n\n${items.join('\n')}`);
  }
}

// Función global para cerrar modal de zonas
window.closeLexZonesModal = function() {
  const modal = document.getElementById('lexZonesModal');
  if (modal) modal.remove();
};

// Crear instancia global
window.lexModals = new LexModals();

console.log('🎨 LexModals loaded');