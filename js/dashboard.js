// ✅ dashboard.js - VERSIÓN OPTIMIZADA (solo vista)

let chartInstance;
let expenseChartInstance;
let rpmTrendChartInstance; 
let companyRankingChartInstance;

console.log("🚀 dashboard.js INICIO cargado");
console.log("🚀 dashboard.js cargado correctamente");

function loadDashboardData(selectedMonth = "all") {
  console.log("📊 loadDashboardData ejecutado con:", selectedMonth);
}
window.loadDashboardData = loadDashboardData;


// ✅ Asegurar que existan los canvas
function ensureCanvasExists() {
  console.log("🔧 Ensuring canvas elements exist...");

  if (!document.getElementById('combinedChart')) {
    const container = document.querySelector('#dashboard .bg-gray-50, #dashboard .h-80');
    if (container) container.innerHTML = '<canvas id="combinedChart" width="800" height="400"></canvas>';
  }

  if (!document.getElementById('expenseChart')) {
    const container = document.querySelector('#dashboard .h-64');
    if (container) container.innerHTML = '<canvas id="expenseChart"></canvas>';
  }
}

// ✅ Función principal (consume el motor)
async function updateDashboard(period = "all") {
  try {
    console.log(`📈 Updating dashboard for period: ${period}`);

    const { loads } = await loadFinancialData(period);

    // ✅ Poblar el selector con las cargas recibidas
    populateDashboardMonthSelector(loads);

    // Dibujar gráficos y resúmenes
    ensureCanvasExists();
    drawChart(loads);
    fetchMonthlySummary(loads);
    renderTopRoutes(loads);
    fetchExpenseDataAndRender(loads);

    // Nuevas métricas operativas
    renderRpmTrend(loads);
    renderCompanyRanking(loads);
    renderEfficiency(loads);

    console.log("✅ Dashboard updated successfully");
  } catch (err) {
    console.error("❌ Error updating dashboard:", err);
    showDashboardError(err.message || "Error desconocido");
  }
}



renderRpmTrend(loads);
renderCompanyRanking(loads);
renderEfficiency(loads);


function renderRpmTrend(loads) {
  const grouped = {};
  loads.forEach(l => {
    const month = l.date?.substring(0, 7);
    if (!grouped[month]) grouped[month] = { rpmSum: 0, count: 0 };
    grouped[month].rpmSum += l.rpm;
    grouped[month].count++;
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(m => grouped[m].rpmSum / grouped[m].count);

  const canvas = document.getElementById("rpmTrendChart");
  if (!canvas) return;

  // 👇 Destruir gráfico previo si existe
  if (rpmTrendChartInstance && typeof rpmTrendChartInstance.destroy === "function") {
    rpmTrendChartInstance.destroy();
  }

  rpmTrendChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "RPM promedio",
        data: values,
        borderColor: "#3b82f6",
        tension: 0.3
      }]
    }
  });
}


function renderCompanyRanking(loads) {
  const stats = {};
  loads.forEach(l => {
    const c = l.companyName || "—";
    if (!stats[c]) stats[c] = { profit: 0, count: 0 };
    stats[c].profit += l.netProfit;
    stats[c].count++;
  });

  const top = Object.entries(stats)
    .map(([name, s]) => ({ name, avgProfit: s.profit / s.count, count: s.count }))
    .sort((a, b) => b.avgProfit - a.avgProfit)
    .slice(0, 5);

  const body = document.getElementById("companyRankingBody");
  body.innerHTML = "";
  top.forEach(r => {
    body.innerHTML += `<tr>
      <td class="p-2">${r.name}</td>
      <td class="p-2">${r.count}</td>
      <td class="p-2">$${r.avgProfit.toFixed(2)}</td>
    </tr>`;
  });
}

function renderEfficiency(loads) {
  const totalMiles = loads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
  const repositionMiles = loads.reduce((s, l) => s + (Number(l.repositionMiles) || 0), 0);

  const efficiency = totalMiles > 0 
    ? ((totalMiles - repositionMiles) / totalMiles) * 100 
    : 0;

  console.log("⚙️ Efficiency debug:", { totalMiles, repositionMiles, efficiency });

  updateElement("dashEfficiency", efficiency.toFixed(1) + "%");
}

function populateDashboardMonthSelector(loads) {
  const monthSelect = document.getElementById("dashboardMonthSelect");
  if (!monthSelect) {
    console.warn("⚠️ Selector #dashboardMonthSelect no encontrado en el DOM");
    return;
  }

  console.log("📅 populateDashboardMonthSelector ejecutada con", loads.length, "cargas");

  // Guardar selección actual
  const currentValue = monthSelect.value;

  // Limpiar y agregar "Todos los Meses"
  monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';

  // Extraer meses únicos
  const months = new Set();
  loads.forEach(load => {
    if (load.date && typeof load.date === "string" && load.date.length >= 7) {
      months.add(load.date.substring(0, 7));
    }
  });

  const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
  console.log("📅 Meses detectados:", sortedMonths);

  // Poblar selector
  sortedMonths.forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  // Restaurar selección previa si aplica
  if (currentValue && [...months, "all"].includes(currentValue)) {
    monthSelect.value = currentValue;
  }

  console.log("📅 Selector final:", [...monthSelect.options].map(o => o.value));
}





// ✅ Gráfico combinado (ingresos, gastos, millas)
function drawChart(loads) {
  ensureCanvasExists();
  const canvas = document.getElementById("combinedChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const grouped = {};
  loads.forEach(load => {
    const loadMonth = load.date?.substring(0, 7) || "2025-01";
    if (!grouped[loadMonth]) grouped[loadMonth] = { profit: 0, miles: 0, revenue: 0, expenses: 0 };

    grouped[loadMonth].profit += load.netProfit;
    grouped[loadMonth].miles += load.totalMiles;
    grouped[loadMonth].revenue += load.totalCharge;
    grouped[loadMonth].expenses += load.operatingCost + load.fuelCost + load.tolls + load.otherCosts;
  });

  const labels = Object.keys(grouped).sort();
  const revenues = labels.map(m => grouped[m].revenue);
  const expenses = labels.map(m => grouped[m].expenses);
  const miles = labels.map(m => grouped[m].miles);

  if (labels.length === 0) return showEmptyChart(canvas.parentElement, "📊 No hay datos");
  if (chartInstance && typeof chartInstance.destroy === "function") {
  chartInstance.destroy();
}


  chartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Revenue ($)", data: revenues, backgroundColor: "rgba(34,197,94,0.6)", borderColor: "rgba(34,197,94,1)" },
        { label: "Expenses ($)", data: expenses, backgroundColor: "rgba(239,68,68,0.6)", borderColor: "rgba(239,68,68,1)" },
        { label: "Miles", data: miles, type: "line", borderColor: "rgba(59,130,246,1)", tension: 0.3, yAxisID: "y1" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Amount ($)" } },
        y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Miles" } }
      }
    }
  });
}

// ✅ Resumen mensual
function fetchMonthlySummary(loads) {
  const revenue = loads.reduce((s, l) => s + (l.totalCharge || 0), 0);
  const expenses = loads.reduce((s, l) => s + (l.fuelCost || 0) + (l.operatingCost || 0) + (l.tolls || 0) + (l.otherCosts || 0), 0);
  const profit = loads.reduce((s, l) => s + (l.netProfit || 0), 0);
  const miles = loads.reduce((s, l) => s + (l.totalMiles || 0), 0);

  updateElement("monthlyRevenue", formatCurrency(revenue));
  updateElement("monthlyExpenses", formatCurrency(expenses));
  updateElement("monthlyProfit", formatCurrency(profit));
  updateElement("monthlyMiles", miles);
}

// ✅ Top Rutas
function renderTopRoutes(loads) {
  const stats = {};
  loads.forEach(load => {
    const key = `${load.origin} → ${load.destination}`;
    if (!stats[key]) stats[key] = { route: key, count: 0, rpmSum: 0, profitSum: 0, companies: {} };
    stats[key].count++;
    stats[key].rpmSum += load.rpm;
    stats[key].profitSum += load.netProfit;
    const company = load.companyName || "—";
    stats[key].companies[company] = (stats[key].companies[company] || 0) + 1;
  });

  const top = Object.values(stats)
    .map(r => ({ ...r, avgRpm: r.rpmSum / r.count, topCompany: Object.entries(r.companies).sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.avgRpm - a.avgRpm)
    .slice(0, 5);

  const body = document.getElementById("topRoutesBody");
  body.innerHTML = "";

  if (top.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay rutas disponibles.</td></tr>`;
    return;
  }

  top.forEach(route => {
    body.innerHTML += `
      <tr>
        <td class="p-2">${route.route}</td>
        <td class="p-2">${route.topCompany}</td>
        <td class="p-2">${route.count}</td>
        <td class="p-2">$${route.avgRpm.toFixed(2)}</td>
        <td class="p-2 ${route.profitSum >= 0 ? 'text-green-600' : 'text-red-600'}">$${route.profitSum.toFixed(2)}</td>
      </tr>`;
  });
}

// ✅ Gráfico de gastos
function fetchExpenseDataAndRender(loads) {
  let operating = 0, fuel = 0, tolls = 0, other = 0;
  loads.forEach(l => { operating += l.operatingCost; fuel += l.fuelCost; tolls += l.tolls; other += l.otherCosts; });
  renderExpenseChart({ operating, fuel, tolls, other });
}

function renderExpenseChart(data) {
  ensureCanvasExists();
  const canvas = document.getElementById("expenseChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (expenseChartInstance) {
    expenseChartInstance.destroy();
    expenseChartInstance = null;
  }

  const total = data.operating + data.fuel + data.tolls + data.other;
  if (total === 0) return showEmptyChart(canvas.parentElement, "💰 No hay gastos");

  expenseChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels: ["Operating", "Fuel", "Tolls", "Other"],
      datasets: [{ data: [data.operating, data.fuel, data.tolls, data.other], backgroundColor: ["#f97316", "#3b82f6", "#facc15", "#a855f7"] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

function loadDashboardData(period = "all") {
  console.log("📊 loadDashboardData ejecutado con:", period);
  updateDashboard(period);
}
window.loadDashboardData = loadDashboardData;


// ✅ Estado del Dashboard
function showDashboardError(message) {
  const chartCanvas = document.getElementById("combinedChart");
  if (chartCanvas && chartCanvas.parentElement) {
    chartCanvas.parentElement.innerHTML = `<div class="p-4 text-red-600">❌ ${message}</div>`;
  }
}

function showEmptyChart(container, message) {
  if (container) container.innerHTML = `<div class="p-4 text-gray-500">${message}</div>`;
}

// ✅ Event listeners
document.addEventListener("DOMContentLoaded", () => console.log("📈 Dashboard.js DOM loaded"));

document.addEventListener("userStateChanged", e => {
  if (e.detail.user) {
    console.log("👤 User authenticated, loading dashboard");
    updateDashboard("all");   // 👈 CORREGIDO
  }
});

document.addEventListener("loadSaved", () => {
  console.log("🔄 Load saved, refreshing dashboard");
  const selectedMonth = document.getElementById("dashboardMonthSelect")?.value || "all";
  updateDashboard(selectedMonth);
});

// ✅ Listener para el selector de meses en Dashboard
document.addEventListener("DOMContentLoaded", () => {
  const monthSelect = document.getElementById("dashboardMonthSelect");
  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => {
      const selected = e.target.value || "all";
      console.log("📊 Dashboard selector changed:", selected);
      updateDashboard(selected);
    });
  }
});

// ✅ Función puente para tabs.js
function loadDashboardData(period = "all") {
  console.log("📊 loadDashboardData ejecutado con:", period);
  updateDashboard(period);
}
window.loadDashboardData = loadDashboardData;



// ✅ Exponer global
window.updateDashboard = updateDashboard;
window.drawChart = drawChart;
window.fetchMonthlySummary = fetchMonthlySummary;
window.renderTopRoutes = renderTopRoutes;
window.ensureCanvasExists = ensureCanvasExists;

console.log("✅ Dashboard.js FINAL WORKING version loaded successfully");

console.log("🏁 dashboard.js FIN cargado");
