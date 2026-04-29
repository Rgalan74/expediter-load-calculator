// finances-reports.js - Report Generation Module
// Version: 1.0.0
// Dependencies: html2pdf, finances-core.js
// Last Updated: 2025-12-19

/**
 * FINANCES REPORTS MODULE
 * 
 * Este módulo contiene todas las funciones de generación de reportes
 * Se carga de forma lazy (bajo demanda) para reducir el bundle inicial
 * 
 * Funciones incluidas:
 * - generatePLReport() - Reporte de Profit & Loss
 * - generateTaxReport() - Reporte fiscal IRS Schedule C
 * - exportReportToPDF() - Exportación a PDF
 * - printReport() - Impresión directa
 * - openReportModal() - Abrir modal de reportes
 * - closeReportModal() - Cerrar modal
 */
// ─── Helper: garantiza que window.financesData/expensesData estén cargados ───
// Los datos se asignan cuando el usuario abre el subtab 'Resumen'.
// Si entra directo a 'Reportes', need to load them first.
async function ensureFinancesData() {
  if (window.financesData && window.financesData.length > 0) {
    debugLog('[REPORTS] Datos ya en caché ✅');
    return true;
  }

  debugLog('[REPORTS] Datos no disponibles — cargando desde Firestore...');

  if (!window.currentUser) {
    debugLog('[REPORTS] Sin usuario autenticado');
    return false;
  }

  try {
    // Intentar usar loadFinancesData() del módulo de finances si existe
    if (typeof window.loadFinancesData === 'function') {
      const result = await window.loadFinancesData('all');
      if (result?.loads) {
        window.financesData = result.loads;
        window.expensesData = result.expenses || [];
        debugLog('[REPORTS] Datos cargados vía loadFinancesData ✅');
        return true;
      }
    }

    // Fallback: cargar directamente desde Firestore
    const uid = window.currentUser.uid;
    const [loadsSnap, expSnap] = await Promise.all([
      firebase.firestore().collection('loads').where('userId', '==', uid).get(),
      firebase.firestore().collection('expenses').where('userId', '==', uid).get()
    ]);

    window.financesData = loadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.expensesData = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    debugLog(`[REPORTS] Cargados ${window.financesData.length} cargas, ${window.expensesData.length} gastos ✅`);
    return window.financesData.length > 0;
  } catch (err) {
    debugLog('[REPORTS] Error cargando datos:', err);
    return false;
  }
}

function generatePLReport() {
  debugLog("📊 Generando Estado de Resultados Profesional...");

  // ✅ Abrir modal con loading
  openReportModal('pl', window.i18n?.t('finances.report_pl_title') || 'P&L Statement', window.i18n?.t('finances.generating_report') || 'Loading...', '📘');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div><p class="text-gray-600">Generando reporte...</p></div>';
  }

  // Asegurar datos disponibles (carga automática si es necesario)
  ensureFinancesData().then(hasData => {
    if (!hasData) {
      if (reportContent) {
        reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>' + (window.i18n?.t('finances.report_no_data') || 'No hay datos suficientes para generar el reporte') + '</p></div>';
      }
      return;
    }
    _renderPLReport(reportContent);
  });
}

function _renderPLReport(reportContent) {
  // Datos ya filtrados
  const filteredLoads = window.financesData || [];
  const filteredExpenses = window.expensesData || [];

  // Per iodo legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": window.i18n?.t('common.month_jan')||'January', "02": window.i18n?.t('common.month_feb')||'February', "03": window.i18n?.t('common.month_mar')||'March', "04": window.i18n?.t('common.month_apr')||'April',
      "05": window.i18n?.t('common.month_may')||'May', "06": window.i18n?.t('common.month_jun')||'June', "07": window.i18n?.t('common.month_jul')||'July', "08": window.i18n?.t('common.month_aug')||'August',
      "09": window.i18n?.t('common.month_sep')||'September', "10": window.i18n?.t('common.month_oct')||'October', "11": window.i18n?.t('common.month_nov')||'November', "12": window.i18n?.t('common.month_dec')||'December'
    };
    periodLabel = `${monthNames[month]} ${year}`;
  } else if (year) {
    periodLabel = `Año ${year}`;
  }

  // Calculos financieros
  const totalRevenue = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Metricas operativas
  const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
  const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
  const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
  const totalLoads = filteredLoads.length;

  // Desglose de gastos por categoría
  const categories = {};
  filteredExpenses.forEach(exp => {
    const type = (exp.type || "other").toLowerCase();
    categories[type] = (categories[type] || 0) + (Number(exp.amount) || 0);
  });

  const categoryLabels = {
    fuel: `🚚 ${window.i18n?.t('finances.expense_fuel') || 'Fuel'}`,
    maintenance: `🔧 ${window.i18n?.t('finances.expense_maintenance') || 'Maintenance'}`,
    food: `🍔 ${window.i18n?.t('finances.expense_food') || 'Food'}`,
    lodging: `🏨 ${window.i18n?.t('finances.expense_lodging') || 'Lodging'}`,
    tolls: `🛣️ ${window.i18n?.t('finances.expense_tolls') || 'Tolls'}`,
    insurance: `🛡️ ${window.i18n?.t('finances.expense_insurance') || 'Insurance'}`,
    permits: `📄 ${window.i18n?.t('finances.expense_permits') || 'Permits'}`,
    carpayment: `🚗 ${window.i18n?.t('finances.expense_car_payment') || 'Car Payment'}`,
    other: `📌 ${window.i18n?.t('finances.expense_other') || 'Other'}`
  };

  // Análisis de distribución de cargas
  let shortHauls = 0, mediumHauls = 0, longHauls = 0;
  filteredLoads.forEach(load => {
    const miles = load.totalMiles || 0;
    if (miles < 300) shortHauls++;
    else if (miles <= 600) mediumHauls++;
    else longHauls++;
  });

  // Generar contenido del reporte
  const container = document.getElementById("reportContent");
  if (!container) {
    debugLog("⚠️ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Agregar estilo de página al contenedor
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.maxWidth = '1200px'; // Ancho amplio para tablas
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.style.minHeight = 'auto'; // Alto automático

  container.className = 'report-container'; // Clase para targeting CSS
  container.innerHTML = `
    <div id="print-area-pl">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #000;">
        <h1 style="font-size: 24px; font-weight: bold; color: #000; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">${window.i18n?.t('finances.report_pl_header') || 'INCOME STATEMENT'}</h1>
        <p style="font-size: 14px; color: #000; margin: 5px 0;">Expediter Load Calculator</p>
        <p style="font-size: 12px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}</p>
        <p style="font-size: 10px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_generated_on') || 'Generated on'} ${currentDate}</p>
      </div>

      <style>
        #print-area-pl, #print-area-pl * {
          color: #000000 !important;
          background-color: transparent !important;
          font-family: 'Times New Roman', Times, serif !important;
          box-sizing: border-box !important;
          text-shadow: none !important;
          box-shadow: none !important;
        }
        #print-area-pl table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1px solid #000 !important;
          margin-bottom: 20px !important;
          table-layout: fixed !important;
        }
        #print-area-pl th, #print-area-pl td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          color: #000000 !important;
          background-color: #ffffff !important;
          word-wrap: break-word !important;
        }
        /* Eliminar efectos hover globales */
        #print-area-pl tr:hover, #print-area-pl td:hover {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
      </style>

    <!-- Resumen ejecutivo -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_exec_summary') || 'EXECUTIVE SUMMARY'}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr style="background-color: #fff;">
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_concept') || 'Concept'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_amount') || 'Amount'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_detail') || 'Detail'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_revenue_label') || 'Total Revenue'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalRevenue)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${totalLoads} ${window.i18n?.t('finances.report_loads_completed') || 'completed loads'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_expenses_label') || 'Total Expenses'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalExpenses)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_operating_expenses') || 'Actual operating expenses'}</td>
          </tr>
          <tr style="background-color: #f0f0f0;">
            <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_net_profit') || 'Net Profit'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(netProfit)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_margin_label') || 'Margin:'} ${margin.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Métricas operativas -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_op_metrics_header') || 'OPERATING METRICS'}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_metric') || 'Metric'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_value') || 'Value'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_miles_label') || 'Total Miles'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalMiles.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_avg_rpm') || 'Avg RPM'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(avgRpm)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_cost_per_mile_label') || 'Cost per Mile'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(costPerMile)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_avg_per_load') || 'Avg per Load'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(totalLoads > 0 ? totalRevenue / totalLoads : 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Desglose de gastos -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_expense_breakdown_header') || 'EXPENSE BREAKDOWN'}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_category') || 'Category'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_amount') || 'Amount'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_pct') || '% of Total'}</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(categories)
      .filter(([cat, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => {
        const percentage = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
        return `
                <tr>
                  <td style="border: 1px solid #000; padding: 8px; text-align: left;">
                    ${categoryLabels[cat] || cat}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px; text-align: right;">
                    ${formatCurrency(val)}
                  </td>
                  <td style="border: 1px solid #000; padding: 8px; text-align: right;">
                    ${percentage.toFixed(1)}%
                  </td>
                </tr>
              `;
      }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Análisis de cargas -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_load_analysis_header') || 'LOAD ANALYSIS BY DISTANCE'}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_type') || 'Type'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_count') || 'Count'}</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_pct') || '% of Total'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_short_loads_label') || 'Short Loads (<300 mi)'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${shortHauls}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalLoads > 0 ? ((shortHauls / totalLoads) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_medium_loads_label') || 'Medium Loads (300-600 mi)'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${mediumHauls}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalLoads > 0 ? ((mediumHauls / totalLoads) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_long_loads_label') || 'Long Loads (>600 mi)'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${longHauls}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalLoads > 0 ? ((longHauls / totalLoads) * 100).toFixed(1) : 0}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}`;

  debugLog("✅ Estado de Resultados profesional generado");
}

// ========================================
// COMPANY REPORT (Revenue by Company)
// ========================================

function generateCompanyReport() {
  debugLog("🏢 Generando Reporte por Compañías...");
  openReportModal('company', window.i18n?.t('finances.report_company_title') || 'Company Report', window.i18n?.t('finances.generating_report') || 'Loading...', '🏢');
  const reportContent = document.getElementById("reportContent");
  if (reportContent) reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div><p class="text-gray-600">Analizando datos por compañía...</p></div>';

  ensureFinancesData().then(hasData => {
    if (!hasData) {
      if (reportContent) reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>' + (window.i18n?.t('finances.report_no_data') || 'No hay datos suficientes') + '</p></div>';
      return;
    }
    _renderCompanyReport(reportContent);
  });
}

function _renderCompanyReport(reportContent) {
  // Datos ya filtrados
  const filteredLoads = window.financesData || [];

  // Período legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": window.i18n?.t('common.month_jan')||'January', "02": window.i18n?.t('common.month_feb')||'February', "03": window.i18n?.t('common.month_mar')||'March', "04": window.i18n?.t('common.month_apr')||'April',
      "05": window.i18n?.t('common.month_may')||'May', "06": window.i18n?.t('common.month_jun')||'June', "07": window.i18n?.t('common.month_jul')||'July', "08": window.i18n?.t('common.month_aug')||'August',
      "09": window.i18n?.t('common.month_sep')||'September', "10": window.i18n?.t('common.month_oct')||'October', "11": window.i18n?.t('common.month_nov')||'November', "12": window.i18n?.t('common.month_dec')||'December'
    };
    periodLabel = `${monthNames[month]} ${year}`;
  } else if (year) {
    periodLabel = `Año ${year}`;
  }

  // Agrupar por compañía
  const companiesData = {};

  filteredLoads.forEach(load => {
    const company = (load.companyName || "Sin Compañía").trim();
    if (!companiesData[company]) {
      companiesData[company] = {
        totalRevenue: 0,
        totalMiles: 0,
        totalLoads: 0,
        loads: []
      };
    }

    companiesData[company].totalRevenue += Number(load.totalCharge) || 0;
    companiesData[company].totalMiles += Number(load.totalMiles) || 0;
    companiesData[company].totalLoads += 1;
    companiesData[company].loads.push(load);
  });

  // Calcular RPM por compañía
  Object.keys(companiesData).forEach(company => {
    const data = companiesData[company];
    data.avgRPM = data.totalMiles > 0 ? data.totalRevenue / data.totalMiles : 0;
    data.avgRevenuePerLoad = data.totalLoads > 0 ? data.totalRevenue / data.totalLoads : 0;
  });

  // Ordenar por ingresos totales
  const sortedCompanies = Object.entries(companiesData)
    .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue);

  // Totales generales
  const totalRevenue = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalLoads = filteredLoads.length;
  const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);

  // Identificar mejores y peores
  const topCompanies = sortedCompanies.slice(0, 3);
  const bottomCompanies = sortedCompanies.slice(-3).reverse();

  const container = document.getElementById("reportContent");
  if (!container) {
    debugLog("⚠️ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Agregar estilo de página al contenedor
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.maxWidth = '1200px'; // Ancho amplio para tablas
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.style.minHeight = 'auto'; // Alto automático

  container.className = 'report-container';
  container.innerHTML = `
    <div id="print-area-co">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #000;">
        <h1 style="font-size: 24px; font-weight: bold; color: #000; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">${window.i18n?.t('finances.report_company_header') || 'COMPANY REVENUE REPORT'}</h1>
        <p style="font-size: 14px; color: #000; margin: 5px 0;">Expediter Load Calculator</p>
        <p style="font-size: 12px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}</p>
        <p style="font-size: 10px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_generated_on') || 'Generated on'} ${currentDate}</p>
      </div>

      <style>
        #print-area-co, #print-area-co * {
          color: #000000 !important;
          background-color: transparent !important;
          font-family: 'Times New Roman', Times, serif !important;
          box-sizing: border-box !important;
           text-shadow: none !important;
        }
        #print-area-co table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1px solid #000 !important;
          table-layout: fixed !important;
          margin-bottom: 20px !important;
        }
        #print-area-co th, #print-area-co td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          color: #000000 !important;
          background-color: #ffffff !important;
          word-wrap: break-word !important;
        }
        #print-area-co tr:hover, #print-area-co td:hover {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
      </style>

    <!-- Resumen ejecutivo -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_exec_summary') || 'EXECUTIVE SUMMARY'}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left; width: 50%;">${window.i18n?.t('finances.report_total_companies') || 'Total Companies'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${sortedCompanies.length}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_revenue_label') || 'Total Revenue'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalRevenue)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_loads_completed_label') || 'Completed Loads'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${totalLoads}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_miles_label') || 'Total Miles'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${totalMiles.toLocaleString()}</td>
          </tr>
          <tr style="background-color: #f0f0f0;">
            <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_avg_rpm') || 'Avg RPM'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalMiles > 0 ? totalRevenue / totalMiles : 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tabla completa de todas las compañías -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_company_detail_header') || 'COMPANY DETAIL'}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_company_label') || 'Company'}</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_revenue_label') || 'Revenue'}</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">%</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_loads_label') || 'Loads'}</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_miles_label') || 'Miles'}</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">RPM</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_per_load') || '$/Load'}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedCompanies.map(([company, data]) => {
    const percentage = totalRevenue > 0 ? (data.totalRevenue / totalRevenue) * 100 : 0;
    return `
              <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${company}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCurrency(data.totalRevenue)}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${percentage.toFixed(1)}%</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${data.totalLoads}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${data.totalMiles.toLocaleString()}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCurrency(data.avgRPM)}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCurrency(data.avgRevenuePerLoad)}</td>
              </tr>
              `;
  }).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f0f0f0;">
            <td style="border: 1px solid #000; padding: 6px; text-align: left; font-weight: bold;">TOTAL</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(totalRevenue)}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">100%</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${totalLoads}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${totalMiles.toLocaleString()}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(totalMiles > 0 ? totalRevenue / totalMiles : 0)}</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(totalLoads > 0 ? totalRevenue / totalLoads : 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}`;

  debugLog("✅ Reporte por Compañías generado exitosamente");
}


// ========================================
// PDF EXPORT
// ========================================

// 📄 Exportar Reporte a PDF
function exportReportToPDF() {
  debugLog("📄 Exportando reporte a PDF...");

  const reportContent = document.getElementById('reportContent');
  const reportTitle = document.getElementById('reportModalTitle')?.textContent || 'Reporte Financiero';

  if (!reportContent) {
    alert('No hay contenido de reporte para exportar');
    return;
  }

  // Verificar que html2pdf esté disponible
  if (typeof html2pdf === 'undefined') {
    alert('Error: Librería html2pdf no está cargada');
    debugLog("❌ html2pdf no disponible");
    return;
  }

  // Configuración simple y efectiva
  const opt = {
    margin: 10,
    filename: `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      backgroundColor: '#1e293b'
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    }
  };

  // Generar PDF
  html2pdf().set(opt).from(reportContent).save();
}

// ========================================
// PRINT REPORT
// ========================================

function printReport() {
  debugLog("🖨️ Imprimiendo reporte...");
  window.print();
}

// ========================================
// EXPENSE BREAKDOWN REPORT
// ========================================

function generateExpenseBreakdownReport() {
  debugLog("📈 Generando Reporte de Desglose de Gastos...");
  openReportModal('expenses', window.i18n?.t('finances.report_expense_title') || 'Expense Breakdown', window.i18n?.t('finances.generating_report') || 'Loading...', '📈');
  const reportContent = document.getElementById("reportContent");
  if (reportContent) reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div><p class="text-gray-600">Analizando gastos...</p></div>';

  ensureFinancesData().then(hasData => {
    if (!hasData || !window.expensesData || window.expensesData.length === 0) {
      if (reportContent) reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>' + (window.i18n?.t('finances.report_no_data') || 'No hay datos de gastos') + '</p></div>';
      return;
    }
    _renderExpenseBreakdownReport(reportContent);
  });
}

function _renderExpenseBreakdownReport(reportContent) {
  // Datos ya filtrados
  const filteredExpenses = window.expensesData || [];

  // Período legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": window.i18n?.t('common.month_jan')||'January', "02": window.i18n?.t('common.month_feb')||'February', "03": window.i18n?.t('common.month_mar')||'March', "04": window.i18n?.t('common.month_apr')||'April',
      "05": window.i18n?.t('common.month_may')||'May', "06": window.i18n?.t('common.month_jun')||'June', "07": window.i18n?.t('common.month_jul')||'July', "08": window.i18n?.t('common.month_aug')||'August',
      "09": window.i18n?.t('common.month_sep')||'September', "10": window.i18n?.t('common.month_oct')||'October', "11": window.i18n?.t('common.month_nov')||'November', "12": window.i18n?.t('common.month_dec')||'December'
    };
    periodLabel = `${monthNames[month]} ${year}`;
  } else if (year) {
    periodLabel = `Año ${year}`;
  }

  // Agrupar por categoría
  const categories = {};
  filteredExpenses.forEach(exp => {
    const type = (exp.type || "other").toLowerCase();
    if (!categories[type]) {
      categories[type] = {
        total: 0,
        count: 0,
        expenses: []
      };
    }
    categories[type].total += Number(exp.amount) || 0;
    categories[type].count += 1;
    categories[type].expenses.push(exp);
  });

  const categoryLabels = {
    fuel: window.i18n?.t('finances.expense_fuel') || 'Fuel',
    maintenance: window.i18n?.t('finances.expense_maintenance') || 'Maintenance',
    food: window.i18n?.t('finances.expense_food') || 'Food',
    lodging: window.i18n?.t('finances.expense_lodging') || 'Lodging',
    tolls: window.i18n?.t('finances.expense_tolls') || 'Tolls',
    insurance: window.i18n?.t('finances.expense_insurance') || 'Insurance',
    permits: window.i18n?.t('finances.expense_permits') || 'Permits',
    other: window.i18n?.t('finances.expense_other') || 'Other'
  };

  // Calcular totales
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalCount = filteredExpenses.length;

  // Ordenar categorías por monto
  const sortedCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b.total - a.total);

  // Top 3 categorías
  const topCategories = sortedCategories.slice(0, 3);

  const container = document.getElementById("reportContent");
  if (!container) {
    debugLog("⚠️ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Agregar estilo de página al contenedor
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.maxWidth = '1200px'; // Ancho amplio para tablas
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.style.minHeight = 'auto'; // Alto automático

  container.className = 'report-container';
  container.innerHTML = `
    <div id="print-area-exp">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #000;">
        <h1 style="font-size: 24px; font-weight: bold; color: #000; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">${window.i18n?.t('finances.report_expense_breakdown_header') || 'EXPENSE BREAKDOWN'}</h1>
        <p style="font-size: 14px; color: #000; margin: 5px 0;">Expediter Load Calculator</p>
        <p style="font-size: 12px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}</p>
        <p style="font-size: 10px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_generated_on') || 'Generated on'} ${currentDate}</p>
      </div>

      <style>
        #print-area-exp, #print-area-exp * {
          color: #000000 !important;
          background-color: transparent !important;
          font-family: 'Times New Roman', Times, serif !important;
          box-sizing: border-box !important;
          text-shadow: none !important;
          box-shadow: none !important;
        }
        #print-area-exp table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1px solid #000 !important;
          margin-bottom: 20px !important;
          table-layout: fixed !important;
        }
        #print-area-exp th, #print-area-exp td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          color: #000000 !important;
          background-color: #ffffff !important;
          word-wrap: break-word !important;
        }
        #print-area-exp tr:hover, #print-area-exp td:hover {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
      </style>

      <!-- Resumen de Gastos -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_expense_summary_header') || 'EXPENSE SUMMARY'}</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_expenses_label') || 'Total Expenses'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalExpenses)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_total_transactions') || 'Total Transactions'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalCount}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">${window.i18n?.t('finances.report_active_categories') || 'Active Categories'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${sortedCategories.length}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detalle por Categoría -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">DETALLE POR CATEGORÍA</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px;">
          <thead>
            <tr style="background-color: #fff;">
              <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Categoría</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Monto Total</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">% Total</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Transacciones</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Promedio</th>
            </tr>
          </thead>
          <tbody>
            ${sortedCategories.map(([type, data]) => {
    const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
    const avgPerTransaction = data.count > 0 ? data.total / data.count : 0;
    return `
              <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${categoryLabels[type] || type}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCurrency(data.total)}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${percentage.toFixed(1)}%</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${data.count}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCurrency(avgPerTransaction)}</td>
              </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>

      ${categories['other'] && categories['other'].count > 0 ? `
      <!-- Detalle de Categoría "Otros" -->
      <div style="margin-bottom: 25px; padding: 15px; background-color: #f9fafb; border: 1px solid #000; border-radius: 8px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">
          📌 DETALLE DE "OTROS" GASTOS
        </h3>
        <p style="font-size: 11px; color: #555; margin-bottom: 15px;">
          A continuación se muestran todos los gastos clasificados como "Otros" con su descripción detallada:
        </p>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px;">
          <thead>
            <tr style="background-color: #fff;">
              <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; width: 15%;">Fecha</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; width: 55%;">Descripción</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; width: 15%;">Monto</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; width: 15%;">Deducible</th>
            </tr>
          </thead>
          <tbody>
            ${categories['other'].expenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(expense => {
          const expenseDate = expense.date ? new Date(expense.date).toLocaleDateString('es-ES') : 'N/A';
          const description = expense.description || 'Sin descripción';
          const amount = formatCurrency(expense.amount || 0);
          const deductible = expense.deductible ? '✓' : '—';
          return `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px; text-align: left;">${expenseDate}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: left;">${description}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: 600;">${amount}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">${deductible}</td>
                  </tr>
                `;
        }).join('')}
            <tr style="background-color: #f0f0f0;">
              <td colspan="2" style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">Total "Otros":</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(categories['other'].total)}</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${categories['other'].count} gastos</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}`;

  debugLog("✅ Reporte de Desglose de Gastos generado exitosamente");
}

// ========================================
// PROFITABILITY BY ZONE REPORT
// ========================================

function generateProfitabilityReport() {
  debugLog("🗺️ Generando Reporte de Rentabilidad por Zona...");
  openReportModal('profitability', window.i18n?.t('finances.report_zone_title') || 'Zone Profitability', window.i18n?.t('finances.generating_report') || 'Loading...', '🗺️');
  const reportContent = document.getElementById("reportContent");
  if (reportContent) reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mb-4"></div><p class="text-gray-600">Analizando rutas...</p></div>';

  ensureFinancesData().then(hasData => {
    if (!hasData) {
      if (reportContent) reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>' + (window.i18n?.t('finances.report_no_data') || 'No hay datos suficientes') + '</p></div>';
      return;
    }
    _renderProfitabilityReport(reportContent);
  });
}

function _renderProfitabilityReport(reportContent) {
  // Datos ya filtrados
  const filteredLoads = window.financesData || [];

  // Período legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": window.i18n?.t('common.month_jan')||'January', "02": window.i18n?.t('common.month_feb')||'February', "03": window.i18n?.t('common.month_mar')||'March', "04": window.i18n?.t('common.month_apr')||'April',
      "05": window.i18n?.t('common.month_may')||'May', "06": window.i18n?.t('common.month_jun')||'June', "07": window.i18n?.t('common.month_jul')||'July', "08": window.i18n?.t('common.month_aug')||'August',
      "09": window.i18n?.t('common.month_sep')||'September', "10": window.i18n?.t('common.month_oct')||'October', "11": window.i18n?.t('common.month_nov')||'November', "12": window.i18n?.t('common.month_dec')||'December'
    };
    periodLabel = `${monthNames[month]} ${year}`;
  } else if (year) {
    periodLabel = `Año ${year}`;
  }

  // Extraer estados de origen y destino
  function extractState(location) {
    if (!location) return "Desconocido";
    // Extraer código de estado (últimos 2 caracteres después de la coma)
    const parts = location.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 1].trim().toUpperCase();
    }
    return location.trim();
  }

  // Agrupar por rutas (origen -> destino)
  const routes = {};

  filteredLoads.forEach(load => {
    const origin = extractState(load.origin);
    const destination = extractState(load.destination);
    const routeKey = `${origin} → ${destination}`;

    if (!routes[routeKey]) {
      routes[routeKey] = {
        totalRevenue: 0,
        totalMiles: 0,
        totalLoads: 0,
        loads: []
      };
    }

    routes[routeKey].totalRevenue += Number(load.totalCharge) || 0;
    routes[routeKey].totalMiles += Number(load.totalMiles) || 0;
    routes[routeKey].totalLoads += 1;
    routes[routeKey].loads.push(load);
  });

  // Calcular RPM y métricas por ruta
  Object.keys(routes).forEach(route => {
    const data = routes[route];
    data.avgRPM = data.totalMiles > 0 ? data.totalRevenue / data.totalMiles : 0;
    data.avgRevenuePerLoad = data.totalLoads > 0 ? data.totalRevenue / data.totalLoads : 0;
    data.avgMilesPerLoad = data.totalLoads > 0 ? data.totalMiles / data.totalLoads : 0;
  });

  // Ordenar por RPM (más rentable)
  const sortedRoutes = Object.entries(routes)
    .sort(([, a], [, b]) => b.avgRPM - a.avgRPM);

  // Top y bottom rutas
  const topRoutes = sortedRoutes.slice(0, 5);
  const bottomRoutes = sortedRoutes.slice(-5).reverse();

  // Totales generales
  const totalRevenue = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
  const totalLoads = filteredLoads.length;
  const avgRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;

  const container = document.getElementById("reportContent");
  if (!container) {
    debugLog("⚠️ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Agregar estilo de página al contenedor
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.maxWidth = '1200px'; // Ancho amplio para tablas
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.style.minHeight = 'auto'; // Alto automático

  container.className = 'report-container';
  container.innerHTML = `
    <div id="print-area-profitability">
      <style>
        #print-area-profitability, #print-area-profitability * {
          color: #000000 !important;
          background-color: transparent !important;
          font-family: 'Times New Roman', Times, serif !important;
          box-sizing: border-box !important;
          text-shadow: none !important;
          box-shadow: none !important;
        }
        #print-area-profitability table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1px solid #000 !important;
          margin-bottom: 20px !important;
          table-layout: fixed !important;
        }
        #print-area-profitability th, #print-area-profitability td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          color: #000000 !important;
          background-color: #ffffff !important;
          word-wrap: break-word !important;
        }
        #print-area-profitability tr:hover, #print-area-profitability td:hover {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
      </style>

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #000;">
        <h1 style="font-size: 24px; font-weight: bold; color: #000; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">${window.i18n?.t('finances.report_zone_title') || 'ZONE PROFITABILITY'}</h1>
        <p style="font-size: 14px; color: #000; margin: 5px 0;">Expediter Load Calculator</p>
        <p style="font-size: 12px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}</p>
        <p style="font-size: 10px; color: #000; margin: 5px 0;">${window.i18n?.t('finances.report_generated_on') || 'Generated on'} ${currentDate}</p>
      </div>

      <!-- Resumen ejecutivo -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">${window.i18n?.t('finances.report_exec_summary') || 'EXECUTIVE SUMMARY'}</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_metric') || 'Metric'}</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_value') || 'Value'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">🛣️ ${window.i18n?.t('finances.report_total_routes') || 'Total Routes'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${sortedRoutes.length}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">📦 ${window.i18n?.t('finances.report_loads_completed') || 'Completed Loads'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${totalLoads}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">📏 ${window.i18n?.t('finances.report_total_miles_label') || 'Total Miles'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${totalMiles.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">💵 ${window.i18n?.t('finances.report_avg_rpm') || 'Avg RPM'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(avgRPM)}</td>
            </tr>
            <tr style="background-color: #f0f0f0 !important;">
              <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; background-color: #f0f0f0 !important;">💰 ${window.i18n?.t('finances.report_total_revenue_label') || 'Total Revenue'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #f0f0f0 !important;">${formatCurrency(totalRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Top 5 Rutas Más Rentables -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">🏆 ${window.i18n?.t('finances.report_top_routes') || 'TOP 5 MOST PROFITABLE ROUTES (by RPM)'}</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold; width: 5%;">#</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_route') || 'Route'}</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">RPM</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_count') || 'Loads'}</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_total_miles_label') || 'Miles'}</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_amount') || 'Revenue'}</th>
            </tr>
          </thead>
          <tbody>
            ${topRoutes.map(([route, data], index) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    return `
              <tr>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${medals[index]}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">${route}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(data.avgRPM)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${data.totalLoads}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${data.totalMiles.toLocaleString()}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(data.totalRevenue)}</td>
              </tr>`;
  }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Top 5 Rutas Menos Rentables -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">⚠️ ${window.i18n?.t('finances.report_bottom_routes') || 'TOP 5 LEAST PROFITABLE ROUTES (by RPM)'}</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${window.i18n?.t('finances.report_col_route') || 'Route'}</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">RPM</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_count') || 'Loads'}</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">${window.i18n?.t('finances.report_col_amount') || 'Revenue'}</th>
            </tr>
          </thead>
          <tbody>
            ${bottomRoutes.map(([route, data]) => `
              <tr>
                <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">${route}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(data.avgRPM)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${data.totalLoads}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(data.totalRevenue)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <p style="font-size: 11px; color: #000; margin-top: 8px; padding: 8px; border: 1px solid #000; background-color: #fffbe6 !important;">
          💡 <strong>${window.i18n?.t('finances.report_recommendation') || 'Recommendation'}:</strong> ${window.i18n?.t('finances.report_zone_tip') || 'Consider avoiding these routes or negotiating better rates to improve profitability.'}
        </p>
      </div>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${window.i18n?.t('finances.report_period') || 'Period:'} ${periodLabel}`;

  debugLog("✅ Reporte de Rentabilidad por Zona generado exitosamente");
}

// ========================================
// MODALS
// ========================================

// Abrir modal de reportes
function openReportModal(type, title, subtitle, icon) {
  const modal = document.getElementById('reportModal');
  const titleEl = document.getElementById('reportModalTitle');
  const subtitleEl = document.getElementById('reportModalSubtitle');
  const iconEl = document.getElementById('reportModalIcon');
  const headerEl = document.getElementById('reportModalHeader');

  if (modal) {
    // Actualizar header según tipo
    if (titleEl) titleEl.textContent = title || 'Reporte Financiero';
    if (subtitleEl) subtitleEl.textContent = subtitle || 'Período: --';
    if (iconEl) iconEl.textContent = icon || '📊';

    // Cambiar color del header según tipo
    if (headerEl) {
      headerEl.className = 'flex-shrink-0 text-white p-4 flex justify-between items-center shadow-lg ';
      if (type === 'pl') {
        headerEl.className += 'bg-gradient-to-r from-blue-700 to-blue-900';
      } else if (type === 'tax') {
        headerEl.className += 'bg-gradient-to-r from-green-700 to-green-900';
      } else {
        headerEl.className += 'bg-gradient-to-r from-purple-700 to-purple-900';
      }
    }

    modal.classList.remove('hidden');
    modal.style.animation = 'fadeIn 0.3s ease';
    document.body.style.overflow = 'hidden';
  }
}

// Cerrar modal de reportes
function closeReportModal() {
  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }, 150);
  }
}

// ========================================
// EXPORTS
// ========================================

// Export to window namespace
window.FinancesReports = {
  generatePLReport,
  generateCompanyReport,
  generateExpenseBreakdownReport,
  generateProfitabilityReport,
  exportReportToPDF,
  printReport,
  openReportModal,
  closeReportModal
};

// También exportar funciones individuales para compatibilidad
window.generatePLReport = generatePLReport;
window.generateCompanyReport = generateCompanyReport;
window.generateExpenseBreakdownReport = generateExpenseBreakdownReport;
window.generateProfitabilityReport = generateProfitabilityReport;
window.exportReportToPDF = exportReportToPDF;
window.printReport = printReport;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;

debugLog("💰 Reports module loaded successfully");
