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

window.lexAI.showLexAnalysisModal = function (analysis) {
  const safe = lexUIHelpers.safe;

  // En lugar de modal, poblamos la sección en app.html
  const insightSection = document.getElementById('lexInsightSection');
  const zoneText = document.getElementById('lexZoneText');
  const reasonsList = document.getElementById('lexReasonsList');

  if (!insightSection || !zoneText || !reasonsList) return;

  // Llenar datos
  zoneText.textContent = analysis.stateExperience || 'Estás analizando una ruta en esta zona.';

  reasonsList.innerHTML = analysis.reasons && analysis.reasons.length
    ? analysis.reasons.map(r => `<li style="font-size:1rem;color:rgba(255,255,255,0.85);display:flex;align-items:flex-start;gap:0.4rem;line-height:1.4;"><span style="color:#00D9FF;margin-top:2px;">▸</span><span>${r}</span></li>`).join('')
    : '<li style="font-size:1rem;color:rgba(255,255,255,0.5);">Métricas estándar para la evaluación general.</li>';

  // Mostrar sección con animación
  insightSection.classList.remove('hidden');
  insightSection.style.animation = 'fadeIn 0.3s ease-in-out';
};

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
            <h3 class="text-lg font-bold">Analisis del Historial</h3>
            <p class="text-xs text-blue-100">
              Basado en tus cargas registradas, zonas y rentabilidad real
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        <!-- KPIs principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-blue-50 p-3 rounded-xl border border-blue-200">
            <p class="text-[10px] text-blue-600 uppercase">Cargas analizadas</p>
            <p class="text-lg font-bold" style="color: #1e40af !important;">${analysis.loads}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Millas totales</p>
            <p class="text-lg font-bold text-slate-900">${safe(analysis.totalMiles, 0)}</p>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">RPM promedio</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.avgRPM, 2)}</p>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">Ganancia promedio</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.avgProfit, 0)}</p>
          </div>
        </div>

        <!-- Rentabilidad -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs text-emerald-700 font-semibold mb-1">
              &#128200; Resumen de rentabilidad
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Margen global: <span class="font-bold">${safe(analysis.profitMargin, 1)}%</span>
            </p>
            <p class="text-xs text-slate-600">
              Cargas rentables: ${analysis.profitableLoads} &#183; No rentables: ${analysis.unprofitableLoads}
            </p>
          </div>

          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs text-slate-700 font-semibold mb-1">
              &#127758; Zonas destacadas
            </p>
            <p class="text-xs text-slate-700">
              ${(analysis.insights || []).find((m) =>
    m.startsWith('Tus mejores estados')
  ) || 'Aun no hay suficientes datos por estado'
    }
            </p>
            <p class="text-xs text-red-600 mt-1">
              ${(analysis.alerts || []).find((m) =>
      m.startsWith('Evita estas zonas')
    ) || ''
    }
            </p>
          </div>
        </div>

        <!-- Insights y alertas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-slate-700 mb-2">
              &#9989; Puntos positivos
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${(analysis.insights || []).length
      ? analysis.insights
        .filter(i => !i.startsWith('Tus mejores estados'))
        .map(
          (i) =>
            `<li class="text-xs text-slate-700">&#8226; ${i}</li>`
        )
        .join('')
      : '<li class="text-xs text-slate-500">Aun no hay suficientes datos para generar insights.</li>'
    }
            </ul>
          </div>
          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">
              &#128161; Alertas y oportunidades de mejora
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${(analysis.alerts || []).length
      ? analysis.alerts
        .filter(a => !a.startsWith('Evita estas zonas'))
        .map(
          (a) =>
            `<li class="text-xs text-amber-800">&#8226; ${a}</li>`
        )
        .join('')
      : '<li class="text-xs text-amber-700">No se detectaron alertas importantes en tu historial.</li>'
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
  💬 Chat con Lex
</button>

<button
  type="button"
  onclick="closeLexHistoryModal()"
  class="lex-modal-btn lex-modal-btn-ghost"
>
  ✕ Cerrar
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
            <h3 class="text-lg font-bold">Analisis financiero</h3>
            <p class="text-xs text-emerald-100">
              Per&#237;odo: ${analysis.periodLabel || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        <!-- KPIs principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">Ingresos</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.totalRevenue, 0)}</p>
          </div>
          <div class="bg-red-50 p-3 rounded-xl border border-red-200">
            <p class="text-[10px] text-red-600 uppercase">Gastos</p>
            <p class="text-lg font-bold" style="color: #b91c1c !important;">$${safe(analysis.totalExpenses, 0)}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Ganancia neta</p>
            <p class="text-lg font-bold" style="color: ${Number(analysis.netProfit) >= 0 ? '#047857' : '#b91c1c'
    } !important;">$${safe(analysis.netProfit, 0)}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Margen</p>
            <p class="text-lg font-bold" style="color: ${Number(analysis.margin) >= 0 ? '#047857' : '#b91c1c'
    } !important;">${safe(analysis.margin, 1)}%</p>
          </div>
        </div>

        <!-- RPM y productividad -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <p class="text-xs text-blue-700 font-semibold mb-1">
              &#128202; Eficiencia operativa
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Millas totales: <span class="font-bold">${safe(analysis.totalMiles, 0)}</span>
            </p>
            <p class="text-sm text-slate-800 mb-1">
              RPM promedio: <span class="font-bold">$${safe(analysis.avgRpm, 2)}/mi</span>
            </p>
            <p class="text-xs text-slate-600">
              Cargas: ${analysis.numLoads || 0} &#183; Gastos registrados: ${analysis.numExpenses || 0}
            </p>
          </div>

          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs text-slate-700 font-semibold mb-1">
              &#128176; Ticket promedio
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Ingreso por carga: 
              <span class="font-bold">
                $${safe(analysis.avgRevenuePerLoad, 0)}
              </span>
            </p>
            <p class="text-sm text-slate-800 mb-1">
              Gasto por carga:
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
              &#9989; Puntos positivos
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.insights && analysis.insights.length
      ? analysis.insights
        .map(
          (i) =>
            `<li class="text-xs text-emerald-800">&#8226; ${i}</li>`
        )
        .join('')
      : '<li class="text-xs text-emerald-700">Aún no hay suficientes datos para generar insights claros.</li>'
    }
            </ul>
          </div>
          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">
              &#128161; Alertas y oportunidades de mejora
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.alerts && analysis.alerts.length
      ? analysis.alerts
        .map(
          (a) =>
            `<li class="text-xs text-amber-800">&#8226; ${a}</li>`
        )
        .join('')
      : '<li class="text-xs text-amber-700">No se detectaron alertas importantes en este período.</li>'
    }
            </ul>
          </div>
        </div>

        <!-- Recomendación general -->
        <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-2">
          <p class="text-xs font-semibold text-slate-700 mb-1">
            &#129517; Resumen de Lex
          </p>
          <p class="text-sm text-slate-800">
            ${analysis.summary || 'Estoy monitoreando tus números, sigue registrando cargas y gastos para que pueda darte recomendaciones más precisas.'}
          </p>
        </div>
       </div>
      <div class="p-4 border-t border-slate-700/60 lex-modal-actions">

<button 
  type="button"
  onclick="closeLexFinanceModal(); setTimeout(() => window.openLexChatModal(), 150);"
  class="lex-modal-btn lex-modal-btn-primary"
>
  💬 Chat con Lex
</button>

<button 
  type="button"
  onclick="closeLexFinanceModal()"
  class="lex-modal-btn lex-modal-btn-ghost"
>
  ✕ Cerrar
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
