// finances-charts.js - Chart.js Visualizations Module
// Version: 1.0.0
// Dependencies: Chart.js, finances-core.js
// Last Updated: 2025-12-19

/**
 * FINANCES CHARTS MODULE
 * 
 * Este módulo contiene todas las funciones de visualización con Chart.js
 * Se carga de forma lazy (bajo demanda) para reducir el bundle inicial
 * 
 * Funciones incluidas:
 * - updateFinancialCharts() - Coordinador principal
 * - updateCashFlowChart() - Gráfico de flujo de caja (línea)
 * - updateExpenseBreakdownChart() - Gráfico de distribución de gastos (dona)
 * - updateLoadDistributionChart() - Distribución de cargas por distancia
 */

// ========================================
// COORDINADOR PRINCIPAL DE GRÁFICOS
// ========================================

// 🎨 THEME-AWARE CHART COLORS
function getChartThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        tickColor: isDark ? '#e2e8f0' : '#475569',
        gridColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.07)',
        legendColor: isDark ? '#e2e8f0' : '#334155'
    };
}

function updateFinancialCharts(context = "global") {
    debugFinances(` Actualizando gráficos financieros... (contexto: ${context})`);

    if (typeof Chart === 'undefined') {
        debugFinances("❌ Chart.js no está disponible");
        return;
    }

    if (!financesData || financesData.length === 0) {
        debugFinances("⚠️ No hay datos de finanzas para graficar");
        return;
    }

    try {
        if (context === "global" || context === "summary") {
            updateCashFlowChart();
            updateExpenseBreakdownChart();
            updateLoadDistributionChart();
        }

        debugFinances("✅ Gráficos actualizados exitosamente");
    } catch (error) {
        debugFinances("❌ Error actualizando gráficos:", error);
    }
}

// ========================================
// GRÁFICO DE FLUJO DE CAJA (LINE CHART)
// ========================================

// Función corregida para updateCashFlowChart
function updateCashFlowChart() {
    const canvas = document.getElementById('cashFlowChart');
    if (!canvas) {
        debugLog("⚠️ Canvas cashFlowChart no encontrado");
        return;
    }

    const monthlyData = {};

    // Usar TODOS los datos
    (window.allFinancesData || []).forEach(load => {
        const month = load.date.slice(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expenses: 0 };
        monthlyData[month].revenue += load.totalCharge || 0;
    });

    (window.allExpensesData || []).forEach(expense => {
        const month = (expense.date || "").slice(0, 7);
        if (!month) return;
        if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expenses: 0 };
        monthlyData[month].expenses += expense.amount || 0;
    });

    let labels = Object.keys(monthlyData).sort();

    // Filtro acumulativo
    const selectedYear = document.getElementById("yearSelect")?.value || "";
    const selectedMonth = document.getElementById("monthSelect")?.value || "";

    if (selectedYear && selectedMonth) {
        const currentPeriod = `${selectedYear}-${selectedMonth.padStart(2, '0')}`;
        labels = labels.filter(m => m <= currentPeriod);
        debugLog("📊 Mostrando hasta", currentPeriod, ":", labels);
    }

    const revenues = labels.map(m => monthlyData[m].revenue);
    const expenses = labels.map(m => monthlyData[m].expenses);
    const profits = labels.map(m => monthlyData[m].revenue - monthlyData[m].expenses);

    const locale = window.i18n?.currentLang === 'es' ? 'es-ES' : 'en-US';
    const formattedLabels = labels.map(month => {
        const [y, m] = month.split("-");
        return new Date(y, m - 1).toLocaleString(locale, { month: "short", year: "numeric" });
    });

    if (cashFlowChart) {
        cashFlowChart.data.labels = formattedLabels;
        cashFlowChart.data.datasets[0].data = revenues;
        cashFlowChart.data.datasets[0].label = window.i18n?.t('finances.chart_revenue') || 'Revenue';
        cashFlowChart.data.datasets[1].data = expenses;
        cashFlowChart.data.datasets[1].label = window.i18n?.t('finances.chart_expenses_label') || 'Expenses';
        cashFlowChart.data.datasets[2].data = profits;
        cashFlowChart.data.datasets[2].label = window.i18n?.t('finances.chart_profit') || 'Profit';
        cashFlowChart.update();
        debugLog("✅ Gráfico actualizado con", labels.length, "meses");
    } else {
        cashFlowChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: [
                    { label: window.i18n?.t('finances.chart_revenue') || 'Revenue', data: revenues, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', tension: 0.3, fill: true },
                    { label: window.i18n?.t('finances.chart_expenses_label') || 'Expenses', data: expenses, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', tension: 0.3, fill: true },
                    { label: window.i18n?.t('finances.chart_profit') || 'Profit', data: profits, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', tension: 0.3, fill: true }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: getChartThemeColors().legendColor } } },
                scales: {
                    x: { ticks: { color: getChartThemeColors().tickColor }, grid: { color: getChartThemeColors().gridColor } },
                    y: { beginAtZero: true, ticks: { color: getChartThemeColors().tickColor, callback: value => '$' + value.toLocaleString() } }
                }
            }
        });
        debugLog("✅ Gráfico creado con", labels.length, "meses");
    }
}

// ========================================
// GRÁFICO DE DISTRIBUCIÓN DE GASTOS (DOUGHNUT)
// ========================================

function updateExpenseBreakdownChart() {
    const canvas = document.getElementById('expenseBreakdownChart');
    if (!canvas) {
        debugFinances("⚠️ Canvas expenseBreakdownChart no encontrado");
        return;
    }

    debugFinances("🥧 Creando gráfico de distribución de gastos...");

    // 🧹 Destroy any existing Chart.js instance on this canvas (handles module reload)
    const existingExpense = Chart.getChart(canvas);
    if (existingExpense) {
        expenseBreakdownChart = existingExpense; // re-adopt the existing instance
    } else if (expenseBreakdownChart && typeof expenseBreakdownChart.destroy === 'function') {
        expenseBreakdownChart.destroy();
        expenseBreakdownChart = null;
    }

    // Categorías internas
    const categories = {
        fuel: 0,
        maintenance: 0,
        food: 0,
        lodging: 0,
        tolls: 0,
        insurance: 0,
        permits: 0,
        other: 0
    };

    (expensesData || []).forEach(expense => {
        const type = (expense.type || '').toLowerCase();
        const amount = Number(expense.amount) || 0;
        if (categories.hasOwnProperty(type)) {
            categories[type] += amount;
        } else {
            categories.other += amount;
        }
    });

    const labels = [
        window.i18n?.t('finances.expense_fuel') || 'Fuel',
        window.i18n?.t('finances.expense_maintenance') || 'Maintenance',
        window.i18n?.t('finances.expense_food') || 'Food',
        window.i18n?.t('finances.expense_lodging') || 'Lodging',
        window.i18n?.t('finances.expense_tolls') || 'Tolls',
        window.i18n?.t('finances.expense_insurance') || 'Insurance',
        window.i18n?.t('finances.expense_permits') || 'Permits',
        window.i18n?.t('finances.expense_other') || 'Other'
    ];

    const data = [
        categories.fuel,
        categories.maintenance,
        categories.food,
        categories.lodging,
        categories.tolls,
        categories.insurance,
        categories.permits,
        categories.other
    ];

    const colors = [
        '#f97316', // Combustible (naranja)
        '#3b82f6', // Mantenimiento (azul)
        '#facc15', // Comida (amarillo)
        '#a855f7', // Hospedaje (morado)
        '#10b981', // Peajes (verde)
        '#ef4444', // Seguros (rojo)
        '#6366f1', // Permisos (indigo)
        '#6b7280'  // Otros (gris)
    ];

    const totalExpenses = data.reduce((a, b) => a + b, 0);
    if (totalExpenses === 0) {
        debugFinances("⚠️ No hay gastos para el gráfico de distribución");

        // Destruir gráfico si existe (usando Chart.getChart para seguridad)
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        } else if (expenseBreakdownChart && typeof expenseBreakdownChart.destroy === 'function') {
            expenseBreakdownChart.destroy();
        }
        expenseBreakdownChart = null;

        // Mostrar mensaje SIN borrar el canvas
        const container = canvas.parentElement;
        let messageDiv = container.querySelector('.no-data-message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.className = 'no-data-message text-center text-gray-500 p-8 absolute inset-0 flex items-center justify-center';
            messageDiv.textContent = window.i18n?.t('finances.no_expenses_chart') || 'No expenses to show';
            container.style.position = 'relative';
            container.appendChild(messageDiv);
        }
        messageDiv.style.display = 'flex';
        canvas.style.display = 'none';
        return;
    }

    // Si hay datos, ocultar mensaje y mostrar canvas
    const messageDiv = canvas.parentElement.querySelector('.no-data-message');
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
    canvas.style.display = 'block';

    // UPDATE IN-PLACE if chart already exists (avoids canvas destroy/recreate issues)
    if (expenseBreakdownChart && expenseBreakdownChart.data) {
        expenseBreakdownChart.data.labels = labels;
        expenseBreakdownChart.data.datasets[0].data = data;
        expenseBreakdownChart.update();
        debugLog("\u2705 Expense breakdown chart updated in-place");
        return;
    }

    try {
        expenseBreakdownChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: getChartThemeColors().legendColor } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${labels[context.dataIndex]}: ${formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        debugFinances("✅ Gráfico de distribución de gastos creado");
    } catch (error) {
        debugFinances("❌ Error creando gráfico de distribución:", error);
    }
}

// ========================================
// GRÁFICO DE DISTRIBUCIÓN DE CARGAS
// ========================================

// ===== GRÁFICO DE DISTRIBUCIÓN DE CARGAS =====
function updateLoadDistributionChart() {
    const canvas = document.getElementById('loadDistributionChart');
    if (!canvas) {
        debugLog("[🚫] Canvas loadDistributionChart no encontrado");
        return;
    }

    // 🧹 Destroy any existing Chart.js instance on this canvas (handles module reload)
    const existingLoad = Chart.getChart(canvas);
    if (existingLoad) {
        window.loadDistributionChart = existingLoad; // re-adopt the existing instance
    }

    let shortHauls = 0;   // < 300 millas
    let mediumHauls = 0;  // 300-600 millas
    let longHauls = 0;    // > 600 millas

    (financesData || []).forEach(load => {
        const miles = Number(load.totalMiles) || 0;
        if (miles < 300) {
            shortHauls++;
        } else if (miles <= 600) {
            mediumHauls++;
        } else {
            longHauls++;
        }
    });

    const newLabels = [
        window.i18n?.t('finances.chart_load_short') || 'Short (<300mi)',
        window.i18n?.t('finances.chart_load_medium') || 'Medium (300-600mi)',
        window.i18n?.t('finances.chart_load_long') || 'Long (>600mi)'
    ];

    // UPDATE IN-PLACE if chart already exists (avoids canvas destroy/recreate issues)
    if (window.loadDistributionChart && window.loadDistributionChart.data) {
        window.loadDistributionChart.data.labels = newLabels;
        window.loadDistributionChart.data.datasets[0].data = [shortHauls, mediumHauls, longHauls];
        window.loadDistributionChart.update();
        debugLog("\u2705 Load distribution chart updated in-place");
        return;
    }

    // First-time creation
    window.loadDistributionChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: newLabels,
            datasets: [{
                data: [shortHauls, mediumHauls, longHauls],
                backgroundColor: [
                    '#fbbf24',
                    '#3b82f6',
                    '#10b981'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        font: { size: 11 },
                        color: getChartThemeColors().legendColor
                    }
                }
            }
        }
    });

    debugLog("✅ Gráfico de distribución de cargas actualizado");
}

// ========================================
// EXPORTS
// ========================================

// Export to window namespace
window.FinancesCharts = {
    updateFinancialCharts,
    updateCashFlowChart,
    updateExpenseBreakdownChart,
    updateLoadDistributionChart
};

// También exportar funciones individuales para compatibilidad
window.updateFinancialCharts = updateFinancialCharts;
window.updateCashFlowChart = updateCashFlowChart;
window.updateExpenseBreakdownChart = updateExpenseBreakdownChart;
window.updateLoadDistributionChart = updateLoadDistributionChart;

// =============================================
// SUBSCRIBE TO LANGUAGE CHANGES (Observer pattern)
// This fires when i18n.setLanguage() is called,
// BEFORE the DOM event, and is always synchronous
// =============================================
if (window.i18n && typeof window.i18n.subscribe === 'function') {
    window.i18n.subscribe(() => {
        updateExpenseBreakdownChart();
        updateLoadDistributionChart();
        updateCashFlowChart();
    });
    debugLog("✅ Charts subscribed to language changes via Observer");
} else {
    // Fallback: wait for i18n to be ready
    document.addEventListener('languageChanged', () => {
        updateExpenseBreakdownChart();
        updateLoadDistributionChart();
        updateCashFlowChart();
    });
    debugLog("✅ Charts subscribed to languageChanged event (fallback)");
}

debugLog("💰 Charts module loaded successfully");
