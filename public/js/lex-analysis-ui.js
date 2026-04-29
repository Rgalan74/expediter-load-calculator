// js/lex-analysis-ui.js
// Extraído de lex-ai-brain.js para separar la interfaz visual del cálculo matemático.

const lexUIHelpers = {
  safe(num, decimals = 2, fallback = '--') {
    const n = Number(num);
    if (!Number.isFinite(n)) return fallback;
    try {
      return n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    } catch (e) {
      return n.toFixed(decimals);
    }
  }
};

window.lexAI = window.lexAI || {};

// Cache last analysis for re-rendering on language change
let _lastLexAnalysis = null;

// ============================================================
//  showLexInsightInPanel
//  Convierte el resultado de analyzeLoadWithLearning en un
//  mensaje Markdown y lo inyecta en el chat de Lex.
//  Si el chat está cerrado lo abre automáticamente.
// ============================================================
window.lexAI.showLexInsightInPanel = function (analysis, options = {}) {
  _lastLexAnalysis = analysis;
  const autoOpen = options.autoOpen !== false; // default: true

  if (!analysis || analysis.recommendation === 'ERROR') {
    debugLog('[LEX-UI] showLexInsightInPanel: análisis inválido, saltando');
    return;
  }

  const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

  // ── Encabezado con recomendación ──────────────────────────
  const recIcon = analysis.color === 'green' ? '✅'
    : analysis.color === 'red'   ? '❌'
    : '⚠️';

  const vsAvgNum  = parseFloat(analysis.vsYourAvg);
  const vsSign    = vsAvgNum >= 0 ? '+' : '';
  const vsStateNum = analysis.vsStateAvg !== null ? parseFloat(analysis.vsStateAvg) : null;

  // ── Construir mensaje ──────────────────────────────────────
  let msg = '';

  if (isEs) {
    msg += `${recIcon} **${analysis.recommendation}**\n`;
    msg += `📊 RPM: **$${Number(analysis.rpm).toFixed(3)}/mi**`;
    msg += ` — ${vsSign}${analysis.vsYourAvg}% vs tu promedio ($${Number(analysis.yourAvgRPM).toFixed(3)}/mi)\n`;
    if (vsStateNum !== null && analysis.destState) {
      const stSign = vsStateNum >= 0 ? '+' : '';
      msg += `📍 En **${analysis.destState}**: ${stSign}${analysis.vsStateAvg}% vs tu histórico en esa zona (${analysis.stateExperience})\n`;
    }
    msg += `💵 Ganancia estimada: **$${Number(analysis.estimatedProfit).toFixed(0)}**\n`;
    if (analysis.reasons && analysis.reasons.length) {
      msg += `\n**Por qué:**\n`;
      analysis.reasons.forEach(r => { msg += `• ${r}\n`; });
    }
    msg += `\n_¿Quieres que negocie o compare con otra oferta? Escríbeme._`;
  } else {
    msg += `${recIcon} **${analysis.recommendation}**\n`;
    msg += `📊 RPM: **$${Number(analysis.rpm).toFixed(3)}/mi**`;
    msg += ` — ${vsSign}${analysis.vsYourAvg}% vs your average ($${Number(analysis.yourAvgRPM).toFixed(3)}/mi)\n`;
    if (vsStateNum !== null && analysis.destState) {
      const stSign = vsStateNum >= 0 ? '+' : '';
      msg += `📍 **${analysis.destState}**: ${stSign}${analysis.vsStateAvg}% vs your history there (${analysis.stateExperience})\n`;
    }
    msg += `💵 Estimated profit: **$${Number(analysis.estimatedProfit).toFixed(0)}**\n`;
    if (analysis.reasons && analysis.reasons.length) {
      msg += `\n**Why:**\n`;
      analysis.reasons.forEach(r => { msg += `• ${r}\n`; });
    }
    msg += `\n_Want me to help negotiate or compare with another offer? Just ask._`;
  }

  // ── Inyectar en el chat ────────────────────────────────────
  // Si el chat no está abierto, abrirlo primero y luego esperar a que el DOM esté listo
  const injectMsg = () => {
    if (typeof window.appendLexMessageFromRouter === 'function') {
      window.appendLexMessageFromRouter(msg);
      // Cambiar al tab de chat para que el usuario lo vea
      if (typeof window.switchLexTab === 'function') {
        window.switchLexTab('chat');
      }
      debugLog('[LEX-UI] Análisis inyectado en chat OK');
    }
  };

  if (!window.lexChatOpen) {
    if (autoOpen && typeof window.openLexChatModal === 'function') {
      // Llamada manual del usuario (ej: botón "Analizar carga") → abrir chat y mostrar
      window.openLexChatModal();
      setTimeout(injectMsg, 700);
    }
    // autoOpen:false → análisis automático, el chat no estaba abierto → no hacer nada
    // (el estado visual y la burbuja proactiva ya informaron al usuario)
  } else {
    // El chat ya está abierto — inyectar directo independientemente de autoOpen
    injectMsg();
  }
};

// Re-apply Lex panel on language change
document.addEventListener('languageChanged', () => {
  if (_lastLexAnalysis && window.lexChatOpen) {
    // Solo re-mostrar si el chat ya está abierto para no interrumpir
    window.lexAI.showLexInsightInPanel(_lastLexAnalysis, { autoOpen: false });
  }
});

window.closeLexLoadModal = function () {
  const modal = document.getElementById('lexLoadModal');
  if (modal) modal.remove();
};

window.lexAI.showHistoryAnalysisModal = function (analysis) {
  const safe = lexUIHelpers.safe;
  const existingModal = document.getElementById('lexHistoryModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'lexHistoryModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4';
  modal.style.zIndex = '10000';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style="max-height: 90vh;">
      <div class="text-white p-4 rounded-t-2xl flex-shrink-0" style="background: linear-gradient(to right, #2563eb, #7c3aed) !important;">
        <div class="flex items-center gap-3">
          <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
          <div>
            <h3 class="text-lg font-bold">History Analysis</h3>
            <p class="text-xs text-blue-100">
              Based on your registered loads, zones and real profitability
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        <!-- KPIs principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-blue-50 p-3 rounded-xl border border-blue-200">
            <p class="text-[10px] text-blue-600 uppercase">Loads analyzed</p>
            <p class="text-lg font-bold" style="color: #1e40af !important;">${analysis.loads}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Total miles</p>
            <p class="text-lg font-bold text-slate-900">${safe(analysis.totalMiles, 0)}</p>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">Avg RPM</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.avgRPM, 2)}</p>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">Avg Profit</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.avgProfit, 0)}</p>
          </div>
        </div>

        <!-- Rentabilidad -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs text-emerald-700 font-semibold mb-1">
              &#128200; Profitability Summary
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Overall margin: <span class="font-bold">${safe(analysis.profitMargin, 1)}%</span>
            </p>
            <p class="text-xs text-slate-600">
              Profitable loads: ${analysis.profitableLoads} &#183; Unprofitable: ${analysis.unprofitableLoads}
            </p>
          </div>

          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs text-slate-700 font-semibold mb-1">
              &#127758; Top Zones
            </p>
            <p class="text-xs text-slate-700">
              ${(analysis.insights || []).find((m) =>
    m.startsWith('Tus mejores estados') || m.startsWith('Your best states')
  ) || 'Not enough data per state yet'
    }
            </p>
            <p class="text-xs text-red-600 mt-1">
              ${(analysis.alerts || []).find((m) =>
      m.startsWith('Evita estas zonas') || m.startsWith('Avoid these zones')
    ) || ''
    }
            </p>
          </div>
        </div>

        <!-- Insights y alertas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-slate-700 mb-2">
              &#9989; Positive points
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${(analysis.insights || []).length
      ? analysis.insights
        .filter(i => !i.startsWith('Tus mejores estados') && !i.startsWith('Your best states'))
        .map(
          (i) =>
            `<li class="text-xs text-slate-700">&#8226; ${i}</li>`
        )
        .join('')
      : '<li class="text-xs text-slate-500">Not enough data to generate insights yet.</li>'
    }
            </ul>
          </div>
          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">
              &#128161; Alerts and improvement opportunities
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${(analysis.alerts || []).length
      ? analysis.alerts
        .filter(a => !a.startsWith('Evita estas zonas') && !a.startsWith('Avoid these zones'))
        .map(
          (a) =>
            `<li class="text-xs text-amber-800">&#8226; ${a}</li>`
        )
        .join('')
      : '<li class="text-xs text-amber-700">No significant alerts detected in your history.</li>'
    }
            </ul>
          </div>
        </div>
      </div>
      <div class="p-4 border-t border-slate-700/60 lex-modal-actions">

<button 
  type="button"
  onclick="closeLexHistoryModal(); setTimeout(() => window.openLexChatModal(), 150);"
  class="lex-modal-btn lex-modal-btn-primary"
>
  💬 Chat with Lex
</button>

<button
  type="button"
  onclick="closeLexHistoryModal()"
  class="lex-modal-btn lex-modal-btn-ghost"
>
  ✕ Close
</button>

</div>


      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

window.lexAI.showFinanceAnalysisModal = function (analysis) {
  const safe = lexUIHelpers.safe;
  const existingModal = document.getElementById('lexFinanceModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'lexFinanceModal';
  modal.className =
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4';
  modal.style.zIndex = '10000';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style="max-height: 90vh;">
      <!-- Header -->
      <div class="text-white p-4 rounded-t-2xl flex-shrink-0" style="background: linear-gradient(to right, #059669, #1d4ed8) !important;">
        <div class="flex items-center gap-3">
          <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
          <div>
            <h3 class="text-lg font-bold">Financial Analysis</h3>
            <p class="text-xs text-emerald-100">
              Period: ${analysis.periodLabel || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        <!-- KPIs principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">Revenue</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.totalRevenue, 0)}</p>
          </div>
          <div class="bg-red-50 p-3 rounded-xl border border-red-200">
            <p class="text-[10px] text-red-600 uppercase">Expenses</p>
            <p class="text-lg font-bold" style="color: #b91c1c !important;">$${safe(analysis.totalExpenses, 0)}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Net Profit</p>
            <p class="text-lg font-bold" style="color: ${Number(analysis.netProfit) >= 0 ? '#047857' : '#b91c1c'
    } !important;">$${safe(analysis.netProfit, 0)}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Margin</p>
            <p class="text-lg font-bold" style="color: ${Number(analysis.margin) >= 0 ? '#047857' : '#b91c1c'
    } !important;">${safe(analysis.margin, 1)}%</p>
          </div>
        </div>

        <!-- RPM y productividad -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <p class="text-xs text-blue-700 font-semibold mb-1">
              &#128202; Operational Efficiency
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Total miles: <span class="font-bold">${safe(analysis.totalMiles, 0)}</span>
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Avg RPM: <span class="font-bold">$${safe(analysis.avgRpm, 2)}/mi</span>
            </p>
            <p class="text-xs text-slate-600">
              Loads: ${analysis.numLoads || 0} &#183; Recorded expenses: ${analysis.numExpenses || 0}
            </p>
          </div>

          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs text-slate-700 font-semibold mb-1">
              &#128176; Avg Ticket
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Revenue per load:
              <span class="font-bold">
                $${safe(analysis.avgRevenuePerLoad, 0)}
              </span>
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Expense per load:
              <span class="font-bold">
                $${safe(analysis.avgExpensePerLoad, 0)}
              </span>
            </p>
          </div>
        </div>

        <!-- Insights y alertas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs font-semibold text-emerald-800 mb-2">
              &#9989; Positive points
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.insights && analysis.insights.length
      ? analysis.insights
        .map(
          (i) =>
            `<li class="text-xs text-emerald-800">&#8226; ${i}</li>`
        )
        .join('')
      : '<li class="text-xs text-emerald-700">Not enough data to generate clear insights yet.</li>'
    }
            </ul>
          </div>
          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">
              &#128161; Alerts and improvement opportunities
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.alerts && analysis.alerts.length
      ? analysis.alerts
        .map(
          (a) =>
            `<li class="text-xs text-amber-800">&#8226; ${a}</li>`
        )
        .join('')
      : '<li class="text-xs text-amber-700">No significant alerts detected in this period.</li>'
    }
            </ul>
          </div>
        </div>

        <!-- Recomendación general -->
        <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-2">
          <p class="text-xs font-semibold text-slate-700 mb-1">
            &#129517; Lex Summary
          </p>
          <p class="text-sm text-slate-800">
            ${analysis.summary || 'I\'m monitoring your numbers. Keep logging loads and expenses so I can give you more accurate recommendations.'}
          </p>
        </div>
       </div>
      <div class="p-4 border-t border-slate-700/60 lex-modal-actions">

<button 
  type="button"
  onclick="closeLexFinanceModal(); setTimeout(() => window.openLexChatModal(), 150);"
  class="lex-modal-btn lex-modal-btn-primary"
>
  💬 Chat with Lex
</button>

<button 
  type="button"
  onclick="closeLexFinanceModal()"
  class="lex-modal-btn lex-modal-btn-ghost"
>
  ✕ Close
</button>

</div>

    </div>
  `;

  document.body.appendChild(modal);
};

// Funciones globales disponibles para que cierren las modales generadas
window.closeLexHistoryModal = function () {
  const modal = document.getElementById('lexHistoryModal');
  if (modal) modal.remove();
};

window.closeLexFinanceModal = function () {
  const modal = document.getElementById('lexFinanceModal');
  if (modal) modal.remove();
};
