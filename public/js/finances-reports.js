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

// ========================================
// PROFIT & LOSS REPORT
// ========================================

function generatePLReport() {
  debugLog("📊 Generando Estado de Resultados Profesional...");

  // ✅ Abrir modal con loading
  openReportModal('pl', 'Estado de Resultados', 'Cargando datos...', '📘');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div><p class="text-gray-600">Generando reporte...</p></div>';
  }

  if (!financesData || !expensesData) {
    if (reportContent) {
      reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>No hay datos suficientes para generar el reporte</p></div>';
    }
    return;
  }

  // Datos ya filtrados
  const filteredLoads = window.financesData || [];
  const filteredExpenses = window.expensesData || [];

  // Per iodo legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
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
    fuel: "Combustible",
    maintenance: "🔧 Mantenimiento",
    food: "🍔 Comida",
    lodging: "🏨 Hospedaje",
    tolls: "Toll 🛣️ Peajes",
    insurance: "Seguro",
    permits: "📄 Permisos",
    other: "📌 Otros"
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
    console.warn("⚠️ Contenedor reportContent no encontrado");
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
  container.style.maxWidth = '210mm'; // Ancho A4
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.style.minHeight = '297mm'; // Alto A4

  container.className = 'report-container'; // Clase para targeting CSS
  container.innerHTML = `
    <!-- Header estilo documento PDF -->
    <div class="text-center" style="margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #000;">
      <h1 style="font-size: 24px; font-weight: bold; color: #000; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">ESTADO DE RESULTADOS</h1>
      <p style="font-size: 14px; color: #000; margin: 5px 0;">Expediter Load Calculator</p>
      <p style="font-size: 12px; color: #000; margin: 5px 0;">Período: ${periodLabel}</p>
      <p style="font-size: 10px; color: #000; margin: 5px 0;">Generado el ${currentDate}</p>
    </div>

    <style>
      /* Estilos para forzar apariencia de impresión profesional */
      .report-container {
        color: #000000 !important;
        background-color: #ffffff !important;
      }
      .report-container * {
        color: #000000 !important;
        font-family: 'Times New Roman', Times, serif, sans-serif !important;
        transition: none !important; /* Eliminar animaciones */
      }
      .report-container table {
        width: 100% !important;
        max-width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
        background-color: #ffffff !important;
      }
      .report-container thead, .report-container th {
        background-color: #ffffff !important; /* Fondo blanco forzado en headers */
        color: #000000 !important;
        border: 1px solid #000 !important;
      }
      .report-container td {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #000 !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
      }
      /* Anular completamente cualquier hover y forzar visibilidad */
      .report-container tr:hover, 
      .report-container td:hover, 
      .report-container th:hover,
      .report-container *:hover {
        background-color: #ffffff !important;
        color: #000000 !important;
        transform: none !important;
        box-shadow: none !important;
        cursor: default !important; /* Quitar cursor pointer para que no parezca interactivo */
      }
    </style>

    <!-- Resumen ejecutivo -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">RESUMEN EJECUTIVO</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr style="background-color: #fff;">
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">Concepto</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">Monto</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Ingresos Totales</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalRevenue)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">${totalLoads} cargas completadas</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Gastos Totales</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalExpenses)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Gastos operativos reales</td>
          </tr>
          <tr style="background-color: #f0f0f0;">
            <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Ganancia Neta</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(netProfit)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Margen: ${margin.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Métricas operativas -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">MÉTRICAS OPERATIVAS</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">Métrica</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Millas Totales</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalMiles.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">RPM Promedio</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(avgRpm)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Costo por Milla</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(costPerMile)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Promedio por Carga</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(totalLoads > 0 ? totalRevenue / totalLoads : 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Desglose de gastos -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">DESGLOSE DE GASTOS</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">Categoría</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">Monto</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">% del Total</th>
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
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">ANÁLISIS DE CARGAS POR DISTANCIA</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">Tipo</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">Cantidad</th>
            <th style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold;">% del Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Cargas Cortas (&lt;300 mi)</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${shortHauls}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalLoads > 0 ? ((shortHauls / totalLoads) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Cargas Medianas (300-600 mi)</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${mediumHauls}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalLoads > 0 ? ((mediumHauls / totalLoads) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Cargas Largas (&gt;600 mi)</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${longHauls}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalLoads > 0 ? ((longHauls / totalLoads) * 100).toFixed(1) : 0}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

  debugLog("✅ Estado de Resultados profesional generado");
}

// ========================================
// COMPANY REPORT (Revenue by Company)
// ========================================

function generateCompanyReport() {
  debugLog("🏢 Generando Reporte por Compañías...");

  // ✅ Abrir modal con loading
  openReportModal('company', 'Reporte por Compañías', 'Cargando datos...', '🏢');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div><p class="text-gray-600">Analizando datos por compañía...</p></div>';
  }

  if (!window.financesData || window.financesData.length === 0) {
    if (reportContent) {
      reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>No hay datos suficientes para generar el reporte</p></div>';
    }
    return;
  }

  // Datos ya filtrados
  const filteredLoads = window.financesData || [];

  // Período legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
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
    console.warn("⚠️ Contenedor reportContent no encontrado");
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
  container.style.maxWidth = '210mm';
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.style.minHeight = '297mm';

  container.className = 'report-container';
  container.innerHTML = `
    <!-- Header estilo documento PDF -->
    <div class="text-center" style="margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #000;">
      <h1 style="font-size: 24px; font-weight: bold; color: #000; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">REPORTE POR COMPAÑÍAS</h1>
      <p style="font-size: 14px; color: #000; margin: 5px 0;">Expediter Load Calculator</p>
      <p style="font-size: 12px; color: #000; margin: 5px 0;">Período: ${periodLabel}</p>
      <p style="font-size: 10px; color: #000; margin: 5px 0;">Generado el ${currentDate}</p>
    </div>

    <style>
       /* Estilos compartidos inyectados para asegurar consistencia */
       .report-container { background-color: #fff !important; }
       .report-container * { 
         color: #000 !important; 
         transition: none !important;
       }
       .report-container table { 
         width: 100% !important; 
         table-layout: fixed !important; 
         background-color: #fff !important;
       }
       .report-container thead, .report-container th {
         background-color: #ffffff !important;
         color: #000000 !important;
         border: 1px solid #000 !important;
       }
       .report-container td { 
         word-wrap: break-word !important;
         background-color: #ffffff !important;
         border: 1px solid #000 !important;
       }
       /* Fix extremo para hover */
       .report-container tr:hover, 
       .report-container td:hover,
       .report-container th:hover,
       .report-container *:hover {
         background-color: #ffffff !important;
         color: #000000 !important;
         transform: none !important;
         cursor: default !important;
       }
    </style>

    <!-- Resumen ejecutivo -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">RESUMEN EJECUTIVO</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left; width: 50%;">Total de Compañías</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${sortedCompanies.length}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Ingresos Totales</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalRevenue)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Cargas Completadas</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${totalLoads}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: left;">Millas Totales</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${totalMiles.toLocaleString()}</td>
          </tr>
          <tr style="background-color: #f0f0f0;">
            <td style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">RPM Promedio</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(totalMiles > 0 ? totalRevenue / totalMiles : 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tabla completa de todas las compañías -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #000; margin: 0 0 12px 0; padding-bottom: 5px; border-bottom: 2px solid #000;">DETALLE POR COMPAÑÍA</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Compañía</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Ingresos</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">%</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Cargas</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Millas</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">RPM</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">$/Carga</th>
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
  if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

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

  // ✅ Abrir modal con loading
  openReportModal('expenses', 'Desglose de Gastos', 'Cargando datos...', '📈');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div><p class="text-gray-600">Analizando gastos...</p></div>';
  }

  if (!window.expensesData || window.expensesData.length === 0) {
    if (reportContent) {
      reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>No hay datos de gastos para generar el reporte</p></div>';
    }
    return;
  }

  // Datos ya filtrados
  const filteredExpenses = window.expensesData || [];

  // Período legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
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
    fuel: "Combustible",
    maintenance: "Mantenimiento",
    food: "Comida",
    lodging: "Hospedaje",
    tolls: "Peajes",
    insurance: "Seguro",
    permits: "Permisos",
    other: "Otros"
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
    console.warn("⚠️ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  container.innerHTML = `
    <!-- Header profesional -->
    <div class="text-center mb-8 border-b pb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">📈 Desglose de Gastos</h1>
      <h2 class="text-xl text-orange-600 font-semibold mb-2">Expediter Load Calculator</h2>
      <p class="text-gray-600">Período: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-sm text-gray-500">Generado el ${currentDate}</p>
    </div>

    <!-- Resumen ejecutivo -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-orange-700 mb-2">💸 Gastos Totales</h3>
        <p class="text-3xl font-bold text-orange-900">${formatCurrency(totalExpenses)}</p>
        <p class="text-sm text-orange-600 mt-1">Total desembolsado</p>
      </div>
      
      <div class="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-purple-700 mb-2">📊 Total Transacciones</h3>
        <p class="text-3xl font-bold text-purple-900">${totalCount}</p>
        <p class="text-sm text-purple-600 mt-1">Gastos registrados</p>
      </div>
      
      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-blue-700 mb-2">📋 Categorías</h3>
        <p class="text-3xl font-bold text-blue-900">${sortedCategories.length}</p>
        <p class="text-sm text-blue-600 mt-1">Tipos de gastos</p>
      </div>
    </div>

    <!-- Top 3 Categorías -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">🔥 Top 3 Categorías de Mayor Gasto</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${topCategories.map(([type, data], index) => {
    const colors = ['red', 'orange', 'yellow'];
    const medals = ['🥇', '🥈', '🥉'];
    const color = colors[index] || 'gray';
    const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
    const avgPerTransaction = data.count > 0 ? data.total / data.count : 0;

    return `
            <div class="bg-${color}-50 border border-${color}-200 rounded-lg p-4">
              <div class="text-center mb-2">
                <span class="text-3xl">${medals[index]}</span>
                <h4 class="text-lg font-bold text-gray-900 mt-2">${categoryLabels[type] || type}</h4>
              </div>
              <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Total:</span>
                  <strong class="text-${color}-700">${formatCurrency(data.total)}</strong>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">% del Total:</span>
                  <strong class="text-gray-900">${percentage.toFixed(1)}%</strong>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Transacciones:</span>
                  <strong class="text-gray-900">${data.count}</strong>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Promedio:</span>
                  <strong class="text-blue-700">${formatCurrency(avgPerTransaction)}</strong>
                </div>
              </div>
            </div>
            `;
  }).join('')}
      </div>
    </div>

    <!-- Tabla completa de categorías -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">📋 Detalle por Categoría</h3>
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% del Total</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transacciones</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Promedio</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${sortedCategories.map(([type, data]) => {
    const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
    const avgPerTransaction = data.count > 0 ? data.total / data.count : 0;

    return `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${categoryLabels[type] || type}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                      ${formatCurrency(data.total)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      ${percentage.toFixed(1)}%
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${data.count}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-700 text-right font-medium">
                      ${formatCurrency(avgPerTransaction)}
                    </td>
                  </tr>
                  `;
  }).join('')}
            </tbody>
            <tfoot class="bg-gray-100">
              <tr class="font-bold">
                <td class="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                <td class="px-6 py-4 text-sm text-gray-900 text-right">${formatCurrency(totalExpenses)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 text-right">100%</td>
                <td class="px-6 py-4 text-sm text-gray-900 text-right">${totalCount}</td>
                <td class="px-6 py-4 text-sm text-blue-700 text-right">${formatCurrency(totalCount > 0 ? totalExpenses / totalCount : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Gráfico visual de distribución -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">📊 Distribución Visual</h3>
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="space-y-3">
          ${sortedCategories.map(([type, data]) => {
    const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
    return `
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="font-medium text-gray-700">${categoryLabels[type] || type}</span>
                  <span class="text-gray-600">${formatCurrency(data.total)} (${percentage.toFixed(1)}%)</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div class="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
              </div>
              `;
  }).join('')}
        </div>
      </div>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

  debugLog("✅ Reporte de Desglose de Gastos generado exitosamente");
}

// ========================================
// PROFITABILITY BY ZONE REPORT
// ========================================

function generateProfitabilityReport() {
  debugLog("🗺️ Generando Reporte de Rentabilidad por Zona...");

  // ✅ Abrir modal con loading
  openReportModal('profitability', 'Rentabilidad por Zona', 'Cargando datos...', '🗺️');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mb-4"></div><p class="text-gray-600">Analizando rutas...</p></div>';
  }

  if (!window.financesData || window.financesData.length === 0) {
    if (reportContent) {
      reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>No hay datos suficientes para generar el reporte</p></div>';
    }
    return;
  }

  // Datos ya filtrados
  const filteredLoads = window.financesData || [];

  // Período legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los periodos";
  if (year && month) {
    const monthNames = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
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
    console.warn("⚠️ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  container.innerHTML = `
    <!-- Header profesional -->
    <div class="text-center mb-8 border-b pb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">🗺️ Rentabilidad por Zona</h1>
      <h2 class="text-xl text-green-600 font-semibold mb-2">Expediter Load Calculator</h2>
      <p class="text-gray-600">Período: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-sm text-gray-500">Generado el ${currentDate}</p>
    </div>

    <!-- Resumen ejecutivo -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-green-700 mb-2">🛣️ Rutas Totales</h3>
        <p class="text-3xl font-bold text-green-900">${sortedRoutes.length}</p>
        <p class="text-sm text-green-600 mt-1">Diferentes rutas</p>
      </div>
      
      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-blue-700 mb-2">💵 RPM Promedio</h3>
        <p class="text-3xl font-bold text-blue-900">${formatCurrency(avgRPM)}</p>
        <p class="text-sm text-blue-600 mt-1">General</p>
      </div>
      
      <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-yellow-700 mb-2">📏 Millas Totales</h3>
        <p class="text-3xl font-bold text-yellow-900">${totalMiles.toLocaleString()}</p>
        <p class="text-sm text-yellow-600 mt-1">${totalLoads} cargas</p>
      </div>
      
      <div class="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-purple-700 mb-2">💰 Ingresos</h3>
        <p class="text-3xl font-bold text-purple-900">${formatCurrency(totalRevenue)}</p>
        <p class="text-sm text-purple-600 mt-1">Total generado</p>
      </div>
    </div>

    <!-- Top 5 Rutas Más Rentables -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">🏆 Top 5 Rutas Más Rentables (por RPM)</h3>
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-green-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">#</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Ruta</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider">RPM</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider">Cargas</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider">Millas</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider">Ingresos</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${topRoutes.map(([route, data], index) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    return `
                  <tr class="hover:bg-green-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span class="text-2xl">${medals[index]}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${route}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-700 text-right font-bold">
                      ${formatCurrency(data.avgRPM)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${data.totalLoads}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${data.totalMiles.toLocaleString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-700 text-right font-semibold">
                      ${formatCurrency(data.totalRevenue)}
                    </td>
                  </tr>
                  `;
  }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Rutas Menos Rentables -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">⚠️ Top 5 Rutas Menos Rentables (por RPM)</h3>
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-red-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Ruta</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">RPM</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">Cargas</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">Ingresos</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${bottomRoutes.map(([route, data]) => {
    return `
                  <tr class="hover:bg-red-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${route}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-red-700 text-right font-bold">
                      ${formatCurrency(data.avgRPM)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${data.totalLoads}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${formatCurrency(data.totalRevenue)}
                    </td>
                  </tr>
                  `;
  }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p class="text-sm text-yellow-800">
          💡 <strong>Recomendación:</strong> Considera evitar estas rutas o negociar mejores tarifas para mejorar la rentabilidad.
        </p>
      </div>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

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

console.log("💰 Reports module loaded successfully");
