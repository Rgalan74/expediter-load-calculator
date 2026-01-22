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

    container.innerHTML = `
    <!-- Header profesional -->
    <div class="text-center mb-8 border-b pb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">📊 Estado de Resultados</h1>
      <h2 class="text-xl text-blue-600 font-semibold mb-2">Expediter Load Calculator</h2>
      <p class="text-gray-600">Período: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-sm text-gray-500">Generado el ${currentDate}</p>
    </div>

    <!-- Resumen ejecutivo -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-green-700 mb-2">💵 Ingresos Totales</h3>
        <p class="text-3xl font-bold text-green-900">${formatCurrency(totalRevenue)}</p>
        <p class="text-sm text-green-600 mt-1">${totalLoads} Cargas completadas</p>
      </div>
      
      <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-red-700 mb-2">💸 Gastos Totales</h3>
        <p class="text-3xl font-bold text-red-900">${formatCurrency(totalExpenses)}</p>
        <p class="text-sm text-red-600 mt-1">Gastos operativos reales</p>
      </div>
      
      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-blue-700 mb-2">💰 Ganancia Neta</h3>
        <p class="text-3xl font-bold ${netProfit >= 0 ? 'text-blue-900' : 'text-red-900'}">${formatCurrency(netProfit)}</p>
        <p class="text-sm ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'} mt-1">Margen: ${margin.toFixed(1)}%</p>
      </div>
    </div>

    <!-- Métricas operativas -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">📈 Métricas Operativas</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">Millas Totales</p>
          <p class="text-2xl font-bold text-gray-900">${totalMiles.toLocaleString()}</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">RPM Promedio</p>
          <p class="text-2xl font-bold text-gray-900">${formatCurrency(avgRpm)}</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">Costo por Milla</p>
          <p class="text-2xl font-bold text-gray-900">${formatCurrency(costPerMile)}</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">Promedio por Carga</p>
          <p class="text-2xl font-bold text-gray-900">${formatCurrency(totalLoads > 0 ? totalRevenue / totalLoads : 0)}</p>
        </div>
      </div>
    </div>

    <!-- Desglose de gastos -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">💳 Desglose de Gastos</h3>
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% del Total</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${Object.entries(categories)
            .filter(([cat, val]) => val > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, val]) => {
                const percentage = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                return `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${categoryLabels[cat] || cat}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${formatCurrency(val)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      ${percentage.toFixed(1)}%
                    </td>
                  </tr>
                `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Análisis de cargas -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">🚚 Análisis de Cargas por Distancia</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p class="text-sm text-yellow-700">Cargas Cortas (&lt;300 mi)</p>
          <p class="text-3xl font-bold text-yellow-900">${shortHauls}</p>
          <p class="text-xs text-yellow-600">${totalLoads > 0 ? ((shortHauls / totalLoads) * 100).toFixed(1) : 0}% del total</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p class="text-sm text-blue-700">Cargas Medianas (300-600 mi)</p>
          <p class="text-3xl font-bold text-blue-900">${mediumHauls}</p>
          <p class="text-xs text-blue-600">${totalLoads > 0 ? ((mediumHauls / totalLoads) * 100).toFixed(1) : 0}% del total</p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p class="text-sm text-green-700">Cargas Largas (&gt;600 mi)</p>
          <p class="text-3xl font-bold text-green-900">${longHauls}</p>
          <p class="text-xs text-green-600">${totalLoads > 0 ? ((longHauls / totalLoads) * 100).toFixed(1) : 0}% del total</p>
        </div>
      </div>
    </div>
  `;

    // Actualizar subtítulo del modal con el período
    const subtitleEl = document.getElementById("reportModalSubtitle");
    if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

    debugLog("✅ Estado de Resultados profesional generado");
}

// ========================================
// TAX REPORT (SCHEDULE C)
// ========================================

function generateTaxReport() {
    debugLog("🧾 Generando Reporte Fiscal para año completo...");

    // ✅ Abrir modal con loading
    openReportModal('tax', 'Reporte de Impuestos', 'Cargando datos fiscales...', '🧾');

    const reportContent = document.getElementById("reportContent");
    if (reportContent) {
        reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mb-4"></div><p class="text-gray-600">Calculando impuestos...</p></div>';
    }

    if (!window.allFinancesData || !window.allExpensesData) {
        if (reportContent) {
            reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3">⚠️</span><p>No hay datos suficientes para generar el reporte fiscal</p></div>';
        }
        return;
    }

    // Usar año seleccionado, datos completos del año
    const year = document.getElementById("reportYear")?.value || new Date().getFullYear().toString();

    // Filtrar por año completo, no por mes
    const filteredLoads = window.allFinancesData.filter(load =>
        load.date && load.date.startsWith(year)
    );
    const filteredExpenses = window.allExpensesData.filter(exp =>
        exp.date && exp.date.startsWith(year)
    );

    debugLog(`Procesando datos fiscales para ${year}:`, {
        cargas: filteredLoads.length,
        gastos: filteredExpenses.length
    });

    const periodLabel = `Tax Year ${year} (Complete Year)`;

    // SCHEDULE C CALCULATIONS (Profit or Loss from Business)
    const grossReceipts = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
    const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);

    // IRS Business Expense Categories (Schedule C)
    const businessExpenses = {
        vehicleExpenses: 0,
        depreciation: 0,
        insurance: 0,
        officeExpense: 0,
        repairsMaintenance: 0,
        travel: 0,
        otherExpenses: 0
    };

    // Categorizar gastos según IRS Schedule C
    filteredExpenses.forEach(exp => {
        const amount = Number(exp.amount) || 0;
        const type = (exp.type || "other").toLowerCase();

        switch (type) {
            case 'fuel':
            case 'tolls':
                businessExpenses.vehicleExpenses += amount;
                break;
            case 'maintenance':
                businessExpenses.repairsMaintenance += amount;
                break;
            case 'insurance':
                businessExpenses.insurance += amount;
                break;
            case 'permits':
                businessExpenses.officeExpense += amount;
                break;
            case 'food':
            case 'lodging':
                businessExpenses.travel += amount;
                break;
            default:
                businessExpenses.otherExpenses += amount;
        }
    });

    const totalBusinessExpenses = Object.values(businessExpenses).reduce((a, b) => a + b, 0);

    // Schedule C Line 31: Net profit or loss
    const netProfitLoss = grossReceipts - totalBusinessExpenses;

    // Self-Employment Tax Calculations (Schedule SE)
    const selfEmploymentEarnings = Math.max(0, netProfitLoss);
    const selfEmploymentTax = selfEmploymentEarnings * 0.1413; // 2024 rate: 14.13%

    // Deductible portion of self-employment tax (Form 1040, Schedule 1)
    const deductibleSETax = selfEmploymentTax * 0.5;

    // Standard mileage deduction option (IRS 2024: $0.67/mile for business)
    const standardMileageDeduction = totalMiles * 0.67;
    const actualExpenseMethod = businessExpenses.vehicleExpenses;
    const recommendedMethod = standardMileageDeduction > actualExpenseMethod ? 'Standard Mileage' : 'Actual Expense';

    const container = document.getElementById("reportContent");
    if (!container) {
        console.warn("⚠️ Contenedor reportContent no encontrado");
        return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Resto del contenido HTML del tax report (simplificado)
    container.innerHTML = `
    <!-- IRS Compliant Header -->
    <div class="text-center mb-8 border-b-2 border-gray-300 pb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">SCHEDULE C (Form 1040)</h1>
      <h2 class="text-xl text-blue-600 font-semibold mb-2">Profit or Loss From Business</h2>
      <h3 class="text-lg text-gray-700">Sole Proprietorship - Transportation Services</h3>
      <p class="text-gray-600 mt-2">Period: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-sm text-blue-600 font-medium">Note: Tax report includes all ${filteredLoads.length} loads and ${filteredExpenses.length} expenses for ${year}</p>
      <p class="text-sm text-gray-500">Generated on ${currentDate}</p>
    </div>

    <!-- Tax Year Summary -->
    <div class="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 class="text-xl font-bold text-blue-900 mb-4">TAX YEAR SUMMARY</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="text-center">
          <p class="text-sm text-blue-600">Gross Receipts (Line 1)</p>
          <p class="text-3xl font-bold text-blue-900">$${grossReceipts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-blue-600">Total Business Miles</p>
          <p class="text-3xl font-bold text-blue-900">${totalMiles.toLocaleString()}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-blue-600">Net Profit/Loss (Line 31)</p>
          <p class="text-3xl font-bold ${netProfitLoss >= 0 ? 'text-green-900' : 'text-red-900'}">
            $${netProfitLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>

    <!-- Self-Employment Tax -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">SCHEDULE SE - SELF-EMPLOYMENT TAX</h3>
      <div class="bg-white border border-gray-300 rounded-lg p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center">
            <p class="text-sm text-gray-600">Self-Employment Earnings</p>
            <p class="text-2xl font-bold text-gray-900">$${selfEmploymentEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-600">Self-Employment Tax (14.13%)</p>
            <p class="text-2xl font-bold text-red-900">$${selfEmploymentTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-600">Deductible Portion (50%)</p>
            <p class="text-2xl font-bold text-green-900">$${deductibleSETax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div class="mt-4 text-center text-sm bg-gray-100 rounded-lg p-4 border border-gray-300">
      <p class="text-gray-800 font-medium">⚠️ This report is generated for informational purposes only.</p>
      <p class="text-gray-700 mt-1">Tax laws are complex and change frequently. Always consult with a qualified tax professional or CPA.</p>
    </div>
  `;

    // Actualizar subtítulo del modal con el período
    const subtitleEl = document.getElementById("reportModalSubtitle");
    if (subtitleEl) subtitleEl.textContent = periodLabel;

    debugLog("✅ Reporte fiscal anual generado exitosamente");
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
    generateTaxReport,
    exportReportToPDF,
    printReport,
    openReportModal,
    closeReportModal
};

// También exportar funciones individuales para compatibilidad
window.generatePLReport = generatePLReport;
window.generateTaxReport = generateTaxReport;
window.exportReportToPDF = exportReportToPDF;
window.printReport = printReport;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;

console.log("💰 Reports module loaded successfully");
