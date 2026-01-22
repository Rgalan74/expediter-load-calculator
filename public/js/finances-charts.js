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
            updateCashFlowChart(); // OK Sin parámetro, que lea los selectores internamente
            updateExpenseBreakdownChart();
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
        console.warn("⚠️ Canvas cashFlowChart no encontrado");
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

    const formattedLabels = labels.map(month => {
        const [y, m] = month.split("-");
        return new Date(y, m - 1).toLocaleString("es-ES", { month: "short", year: "numeric" });
    });

    if (cashFlowChart) {
        cashFlowChart.data.labels = formattedLabels;
        cashFlowChart.data.datasets[0].data = revenues;
        cashFlowChart.data.datasets[1].data = expenses;
        cashFlowChart.data.datasets[2].data = profits;
        cashFlowChart.update();
        debugLog("✅ Gráfico actualizado con", labels.length, "meses");
    } else {
        cashFlowChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: [
                    { label: 'Ingresos', data: revenues, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', tension: 0.3, fill: true },
                    { label: 'Gastos', data: expenses, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', tension: 0.3, fill: true },
                    { label: 'Ganancia', data: profits, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', tension: 0.3, fill: true }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(59, 130, 246, 0.1)" } },
                    y: { beginAtZero: true, ticks: { callback: value => '$' + value.toLocaleString() } }
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

    // 🧹 Destruir instancia previa
    if (expenseBreakdownChart && typeof expenseBreakdownChart.destroy === "function") {
        expenseBreakdownChart.destroy();
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
        'Combustible',
        'Mantenimiento',
        'Comida',
        'Hospedaje',
        'Peajes',
        'Seguros',
        'Permisos',
        'Otros'
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

        // Destruir gráfico si existe
        if (expenseBreakdownChart && typeof expenseBreakdownChart.destroy === "function") {
            expenseBreakdownChart.destroy();
        }

        // Mostrar mensaje SIN borrar el canvas
        const container = canvas.parentElement;
        let messageDiv = container.querySelector('.no-data-message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.className = 'no-data-message text-center text-gray-500 p-8 absolute inset-0 flex items-center justify-center';
            messageDiv.textContent = 'No hay gastos para mostrar';
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
                    legend: { position: 'bottom' },
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

    // Destruir gráfico existente
    if (window.loadDistributionChart && typeof window.loadDistributionChart.destroy === "function") {
        window.loadDistributionChart.destroy();
    }

    // Clasificar cargas por distancia
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

    window.loadDistributionChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Cortas (<300mi)', 'Medianas (300-600mi)', 'Largas (>600mi)'],
            datasets: [{
                data: [shortHauls, mediumHauls, longHauls],
                backgroundColor: [
                    '#fbbf24', // Amarillo para cortas
                    '#3b82f6', // Azul para medianas  
                    '#10b981'  // Verde para largas
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
                        font: { size: 11 }
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

console.log("💰 Charts module loaded successfully");
