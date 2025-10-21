// finances.js - VersiÃ³n Completamente Corregida

var financesData = [];
var expensesData = [];
var cashFlowChart = null;
var expenseBreakdownChart = null;
var financesLoaded = false;
var allFinancesData = [];
var allExpensesData = [];

// âœ… SISTEMA DE CACHÃ‰ para optimizar cargas
var dataCache = {
  lastLoadTime: null,
  lastPeriod: null,
  cacheTimeout: 30000, // 30 segundos
  isLoading: false
};

// Agregar al INICIO de finances.js
function ensurePaymentFields(loads) {
  return loads.map(load => {
    if (!load.paymentStatus) {
      // Calcular fecha de pago automÃ¡ticamente
      const date = new Date(load.date);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 0) {
        date.setDate(date.getDate() + 1);
      }
      
      const daysUntilNextFriday = (5 - date.getDay() + 7) % 7 + 7;
      const paymentDate = new Date(date);
      paymentDate.setDate(date.getDate() + daysUntilNextFriday);
      
      return {
        ...load,
        paymentStatus: 'pending',
        expectedPaymentDate: paymentDate.toISOString().split('T')[0],
        actualPaymentDate: null,
      
      };
    }
    return load;
  });
}

// âœ… FUNCIÃ“N loadFinancialData OPTIMIZADA CON CACHÃ‰
async function loadFinancialData(period = "all") {
  if (!window.currentUser) throw new Error("Usuario no autenticado");
  const uid = window.currentUser.uid;

  // âœ… VERIFICAR CACHÃ‰
  const now = Date.now();
  const cacheValid = dataCache.lastLoadTime && 
                     (now - dataCache.lastLoadTime < dataCache.cacheTimeout) &&
                     dataCache.lastPeriod === period;

  if (cacheValid) {
    console.log("ðŸ“¦ [CACHE] Usando datos en cachÃ© para perÃ­odo:", period);
    const elapsed = Math.round((now - dataCache.lastLoadTime) / 1000);
    console.log(`âš¡ CachÃ© vÃ¡lido (${elapsed}s desde Ãºltima carga)`);
    return {
      loads: window.financesData || [],
      expenses: window.expensesData || [],
      kpis: {
        totalRevenue: (window.financesData || []).reduce((sum, load) => sum + load.totalCharge, 0),
        totalExpenses: (window.expensesData || []).reduce((sum, exp) => sum + exp.amount, 0),
        netProfit: (window.financesData || []).reduce((sum, load) => sum + load.netProfit, 0),
        totalMiles: (window.financesData || []).reduce((sum, load) => sum + load.totalMiles, 0)
      }
    };
  }

  // âœ… EVITAR CARGAS SIMULTÃNEAS
  if (dataCache.isLoading) {
    console.log("â³ [CACHE] Ya hay una carga en progreso, esperando...");
    let attempts = 0;
    while (dataCache.isLoading && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return {
      loads: window.financesData || [],
      expenses: window.expensesData || [],
      kpis: {
        totalRevenue: (window.financesData || []).reduce((sum, load) => sum + load.totalCharge, 0),
        totalExpenses: (window.expensesData || []).reduce((sum, exp) => sum + exp.amount, 0),
        netProfit: (window.financesData || []).reduce((sum, load) => sum + load.netProfit, 0),
        totalMiles: (window.financesData || []).reduce((sum, load) => sum + load.totalMiles, 0)
      }
    };
  }

  // âœ… MARCAR COMO CARGANDO
  dataCache.isLoading = true;

  try {
    console.log("ðŸ“¦ Cargando TODOS los datos sin filtrar...");

    // Cargar todas las cargas
    const loadSnapshot = await window.db.collection("loads").where("userId", "==", uid).get();
    
    allFinancesData = loadSnapshot.docs.map(doc => {
      const data = doc.data();
      let date = data.date;
      
      if (!date && data.createdAt) {
        try {
          date = data.createdAt.toDate().toISOString().split("T")[0];
        } catch (e) {
          date = new Date().toISOString().split("T")[0];
        }
      }
      if (!date) date = new Date().toISOString().split("T")[0];

      return {
        id: doc.id,
        date: date,
        loadNumber: data.loadNumber || "",
        companyName: data.companyName || "",
        origin: data.origin || "-",
        destination: data.destination || "-",
        
        // âœ… CAMPOS FINANCIEROS
        totalMiles: Number(data.totalMiles || 0),
        totalCharge: Number(data.totalCharge || 0),
        netProfit: Number(data.netProfit || 0),
        rpm: Number(data.rpm || 0),
        operatingCost: Number(data.operatingCost || 0),
        fuelCost: Number(data.fuelCost || 0),
        tolls: Number(data.tolls || 0),
        otherCosts: Number(data.otherCosts || 0),
        loadedMiles: Number(data.loadedMiles || 0),
        
        // âœ… CAMPOS DE PAGO
        paymentStatus: data.paymentStatus || "pending",
        actualPaymentDate: data.actualPaymentDate || null,
        paymentDate: data.paymentDate || null,
        expectedPaymentDate: data.expectedPaymentDate || null
      };
    });

    // Procesar para aÃ±adir campos de pago faltantes
    allFinancesData = ensurePaymentFields(allFinancesData);

    // Actualizar variables globales para compatibilidad
    window.allFinancesData = allFinancesData;
    
    // Filtrar por perÃ­odo si se especifica
    let filteredData = allFinancesData;
    if (period !== "all") {
      filteredData = allFinancesData.filter(load => {
        const loadDate = load.date;
        if (period.includes("-")) {
          // Formato YYYY-MM
          return loadDate.startsWith(period);
        } else {
          // Solo aÃ±o YYYY
          return loadDate.startsWith(period);
        }
      });
    }

    // Cargar gastos
    const expenseSnapshot = await window.db.collection("expenses").where("userId", "==", uid).get();
    
    allExpensesData = expenseSnapshot.docs.map(doc => {
      const data = doc.data();
      let date = data.date;
      
      if (!date && data.createdAt) {
        try {
          date = data.createdAt.toDate().toISOString().split("T")[0];
        } catch (e) {
          date = new Date().toISOString().split("T")[0];
        }
      }
      if (!date) date = new Date().toISOString().split("T")[0];

      return {
        id: doc.id,
        date: date,
        amount: Number(data.amount || 0),
        type: data.type || "",
        category: data.category || data.type || "",
        description: data.description || "",
        deductible: data.deductible || false
      };
    });

    // Filtrar gastos por perÃ­odo
    let filteredExpenses = allExpensesData;
    if (period !== "all") {
      filteredExpenses = allExpensesData.filter(expense => {
        const expenseDate = expense.date;
        if (period.includes("-")) {
          return expenseDate.startsWith(period);
        } else {
          return expenseDate.startsWith(period);
        }
      });
    }

    // Actualizar variables globales
    window.financesData = filteredData;
    window.expensesData = filteredExpenses;
    window.allExpensesData = allExpensesData;

    // âœ… ACTUALIZAR CACHÃ‰
    dataCache.lastLoadTime = Date.now();
    dataCache.lastPeriod = period;

    console.log(`âœ… Datos cargados: ${filteredData.length} cargas, ${filteredExpenses.length} gastos`);
    console.log(`ðŸ“Š Cargas con actualPaymentDate: ${allFinancesData.filter(load => load.actualPaymentDate).length}`);

    return {
      loads: filteredData,
      expenses: filteredExpenses,
      kpis: {
        totalRevenue: filteredData.reduce((sum, load) => sum + load.totalCharge, 0),
        totalExpenses: filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        netProfit: filteredData.reduce((sum, load) => sum + load.netProfit, 0),
        totalMiles: filteredData.reduce((sum, load) => sum + load.totalMiles, 0)
      }
    };
  } finally {
    // âœ… LIBERAR LOCK DE CARGA
    dataCache.isLoading = false;
  }
}

// âœ… FUNCIÃ“N PARA INVALIDAR CACHÃ‰
function invalidateFinancesCache() {
  console.log("ðŸ—‘ï¸ [CACHE] Invalidando cachÃ© de datos financieros");
  dataCache.lastLoadTime = null;
  dataCache.lastPeriod = null;
}

// Exponer funciÃ³n globalmente
window.invalidateFinancesCache = invalidateFinancesCache;


function getItemPeriodUTC(item) {
  // prioriza los campos que sueles tener
  return getUTCPeriod(item?.date || item?.createdAt || item?.timestamp);
}


function debugFinances(message, data) {
    console.log("ðŸ’° [FINANCES] " + message, data || "");
}

// ðŸ”§ Normalizar fechas con aÃ±o/mes/dÃ­a en zona local (evita desfases UTC)
function normalizeDate(d, mode = "month") {
  if (!d) return null;
  let dateObj;
  try {
    if (d.toDate) {
      dateObj = d.toDate(); // Firestore Timestamp
    } else if (typeof d === "string") {
      dateObj = new Date(d); // ISO string o "YYYY-MM-DD"
    } else if (d instanceof Date) {
      dateObj = d;
    } else {
      return null;
    }

    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    if (mode === "year") return `${y}`;
    if (mode === "day") return `${y}-${m}-${day}`;
    return `${y}-${m}`; // ðŸ‘ˆ por defecto mes en local time
  } catch {
    return null;
  }
}

async function loadFinancesData(period = "all") {
  if (!window.currentUser) {
    console.error("âŒ No hay usuario autenticado");
    return;
  }
  const uid = window.currentUser.uid;

  // === 1. Cargas ===
  const loadSnapshot = await window.db
    .collection("loads")
    .where("userId", "==", uid)
    .get();

  window.financesData = loadSnapshot.docs.map(doc => {
    const data = doc.data();
    let date = data.date || null;

    if (!date && data.createdAt) {
      if (typeof data.createdAt.toDate === "function") {
        date = data.createdAt.toDate().toISOString().split("T")[0];
      } else if (data.createdAt.seconds) {
        date = new Date(data.createdAt.seconds * 1000).toISOString().split("T")[0];
      }
    }

    return {
      id: doc.id,
      date: date || new Date().toISOString().split("T")[0],
      totalMiles: Number(data.totalMiles || 0),
      totalCharge: Number(data.totalCharge || 0),
      netProfit: Number(data.netProfit || 0),
      rpm: Number(data.rpm || 0),
      operatingCost: Number(data.operatingCost || 0),
      fuelCost: Number(data.fuelCost || 0),
      tolls: Number(data.tolls || 0),
      otherCosts: Number(data.otherCosts || 0),
      origin: data.origin || "-",
      destination: data.destination || "-",
      companyName: data.companyName || "",
      notes: data.notes || ""
    };
  });

  // === 2. Gastos ===
  const expSnapshot = await window.db
    .collection("expenses")
    .where("userId", "==", uid)
    .get();

  window.expensesData = expSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      date: data.date || new Date().toISOString().split("T")[0],
      type: data.type || "other",
      amount: Number(data.amount || 0),
      description: data.description || ""
    };
  });

  console.log("ðŸ“¦ Loads guardadas en memoria:", window.financesData.length);
  console.log("ðŸ’³ Expenses guardadas en memoria:", window.expensesData.length);

  // === 3. Filtrar por perÃ­odo (si aplica) ===
  const filteredLoads = (period === "all")
    ? window.financesData
    : window.financesData.filter(l => l.date.startsWith(period));

  const filteredExpenses = (period === "all")
    ? window.expensesData
    : window.expensesData.filter(e => e.date.startsWith(period));

  // === 4. Calcular KPIs ===
  const kpis = calculateKPIs(filteredLoads, filteredExpenses);

  // === 5. Devolver datos para usar en .then() ===
  return {
    kpis,
    expenses: filteredExpenses,
    loads: filteredLoads
  };
}


// ==============================
// ðŸ’³ FUNCIÃ“N updateExpenseCategories SIMPLIFICADA
// ==============================
function updateExpenseCategories(expenses = []) {
  console.log("ðŸ’³ Actualizando categorÃ­as de gastos...");
  
  const categories = calculateExpenseCategories(expenses);
  console.log("âœ… CategorÃ­as calculadas:", categories);
  
  // Las categorÃ­as se procesan para la tabla de gastos y grÃ¡ficos
  // Ya NO intentamos actualizar elementos DOM individuales
  return categories;
}

// âœ… FUNCIÃ“N INDEPENDIENTE PARA RENDERIZAR GASTOS
function renderExpensesList(filteredExpenses = []) {
    const expensesList = document.getElementById("expensesList");
    if (!expensesList) return;

    if (!filteredExpenses || filteredExpenses.length === 0) {
        expensesList.innerHTML = `
            <tr>
                <td colspan="5" class="p-4 text-center text-gray-500">
                    No hay gastos registrados para este perÃ­odo
                </td>
            </tr>`;
        return;
    }

    const sortedExpenses = filteredExpenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

    const categoryIcons = {
        fuel: "ðŸšš", maintenance: "ðŸ”§", food: "ðŸ”", lodging: "ðŸ¨",
        tolls: "ðŸ›£ï¸", insurance: "ðŸ›¡ï¸", permits: "ðŸ“‹", other: "ðŸ“¦"
    };

    const rows = sortedExpenses.map(expense => `
        <tr class="hover:bg-gray-50">
            <td class="p-2 text-sm">${expense.date || "-"}</td>
            <td class="p-2 text-sm">${categoryIcons[expense.type] || "ðŸ“¦"} ${expense.type}</td>
            <td class="p-2 text-sm">${expense.description || "-"}</td>
            <td class="p-2 text-sm font-semibold">${formatCurrency(expense.amount)}</td>
            <td class="p-2 text-sm">
                <button onclick="editExpense('${expense.id}')" class="text-blue-600 hover:underline mr-2">Editar</button>
                <button onclick="deleteExpense('${expense.id}')" class="text-red-600 hover:underline">Eliminar</button>
            </td>
        </tr>
    `);

    expensesList.innerHTML = rows.join("");
    debugFinances(`âœ… Lista de gastos renderizada: ${rows.length} elementos`);
}


function updateFinancialCharts(context = "global") {
    debugFinances(`ðŸ“ˆ Actualizando grÃ¡ficos financieros... (contexto: ${context})`);

    if (typeof Chart === 'undefined') {
        debugFinances("âŒ Chart.js no estÃ¡ disponible");
        return;
    }

    if (!financesData || financesData.length === 0) {
        debugFinances("âš ï¸ No hay datos de finanzas para graficar");
        return;
    }

    try {
        if (context === "global" || context === "summary") {
            updateCashFlowChart(); // âœ… Sin parÃ¡metro, que lea los selectores internamente
            updateExpenseBreakdownChart();
        }

        debugFinances("âœ… GrÃ¡ficos actualizados exitosamente");
    } catch (error) {
        debugFinances("âŒ Error actualizando grÃ¡ficos:", error);
    }
}

// FunciÃ³n corregida para updateCashFlowChart
function updateCashFlowChart() {
  const canvas = document.getElementById('cashFlowChart');
  if (!canvas) {
    console.warn("Canvas no encontrado");
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
    console.log("Mostrando hasta", currentPeriod, ":", labels);
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
    console.log("GrÃ¡fico actualizado con", labels.length, "meses");
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
        scales: { y: { beginAtZero: true, ticks: { callback: value => '$' + value.toLocaleString() } } }
      }
    });
    console.log("GrÃ¡fico creado con", labels.length, "meses");
  }
}








function updateExpenseBreakdownChart() {
    const canvas = document.getElementById('expenseBreakdownChart');
    if (!canvas) {
        debugFinances("âŒ Canvas expenseBreakdownChart no encontrado");
        return;
    }

    debugFinances("ðŸ¥§ Creando grÃ¡fico de distribuciÃ³n de gastos...");

    // ðŸ”§ Destruir instancia previa
    if (expenseBreakdownChart && typeof expenseBreakdownChart.destroy === "function") {
        expenseBreakdownChart.destroy();
    }

    // CategorÃ­as internas
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
        debugFinances("âš ï¸ No hay gastos para el grÃ¡fico de distribuciÃ³n");
        canvas.parentElement.innerHTML = '<div class="text-center text-gray-500 p-8">No hay gastos para mostrar</div>';
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
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
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
        debugFinances("âœ… GrÃ¡fico de distribuciÃ³n de gastos creado");
    } catch (error) {
        debugFinances("âŒ Error creando grÃ¡fico de distribuciÃ³n:", error);
    }
}

function updateBusinessMetrics() {
    debugFinances("ðŸ“Š Actualizando mÃ©tricas de negocio...");

    const totalMiles = financesData.reduce((sum, load) => sum + Number(load.totalMiles || 0), 0);
    const totalLoadedMiles = financesData.reduce((sum, load) => sum + Number(load.loadedMiles || 0), 0);
    const totalRevenue = financesData.reduce((sum, load) => sum + Number(load.totalCharge || 0), 0);
    const totalExpenses = expensesData.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
    const averageRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const efficiency = totalMiles > 0 ? (totalLoadedMiles / totalMiles) * 100 : 0;

    // Actualizar elementos en el DOM
    const updates = [
        ['costPerMile', formatCurrency(costPerMile)],
        ['averageRPM', formatCurrency(averageRPM)],
        ['efficiency', efficiency.toFixed(1) + '%']
    ];

    updates.forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            debugFinances(`âœ… MÃ©trica actualizada ${id}: ${value}`);
        }
    });

    // Debug agrupado
    debugFinances("ðŸ“Š Totales calculados:", {
        totalMiles,
        totalLoadedMiles,
        totalRevenue,
        totalExpenses,
        costPerMile,
        averageRPM,
        efficiency
    });
}


// ==============================
// ðŸ§® FUNCIÃ“N formatCurrency (mantenida)
// ==============================
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num) || num === null || num === undefined) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num);
}

// ============================
// ðŸ“Š Helper para calcular KPIs
// ============================
function calculateKPIs(loads = [], expenses = []) {
  const totalRevenue = loads.reduce((sum, load) => sum + (Number(load.totalCharge) || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const totalMiles = loads.reduce((sum, load) => sum + (Number(load.totalMiles) || 0), 0);
  const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

  const kpis = {
    totalRevenue,
    totalExpenses,
    netProfit,
    margin,
    totalMiles,
    avgRpm
  };

  console.log("ðŸ’° [KPIs] Calculados:", kpis);
  return kpis;
}

function showFinancesMessage(message, type = "info") {
    debugFinances(`ðŸ’¬ Mensaje: ${message} (${type})`);

    if (typeof showMessage === "function") {
        showMessage(message, type);
    } else {
        switch (type) {
            case "error":
                console.error("âŒ Finances:", message);
                break;
            case "success":
                console.log("âœ… Finances:", message);
                break;
            case "warning":
                console.warn("âš ï¸ Finances:", message);
                break;
            default:
                console.log("â„¹ï¸ Finances:", message);
        }
    }
}

function showFinancesLoading() {
    debugFinances("ðŸ”„ Mostrando estado de carga...");

    // Todos los elementos que deberÃ­an mostrar '...'
    const elements = [
        "totalRevenue",
        "totalExpensesSummary",
        "netProfit",
        "profitMarginPercent",
        "fuelExpenses",
        "maintenanceExpenses",
        "foodExpenses",
        "otherExpenses",
        "tollExpenses",
        "insuranceExpenses",
        "permitsExpenses",
        "costPerMile",
        "averageRPM",
        "efficiency"
    ];

    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = "...";
    });
}

function hideFinancesLoading() {
    debugFinances("âœ… Finalizando estado de carga (sin reset de valores)");

    // ðŸ‘‰ Si mÃ¡s adelante quieres manejar spinners, este es el lugar
    const loadingEls = document.querySelectorAll(".finances-loading");
    loadingEls.forEach(el => el.classList.add("hidden"));
}


function openExpenseModal(expense = null) {
    debugFinances("ðŸ“ Abriendo modal de gastos...");
    const modal = document.getElementById('expenseModal');
    if (!modal) {
        debugFinances("âŒ Modal de gastos no encontrado");
        return;
    }

    // Mostrar modal
    modal.classList.remove('hidden');

    // Inputs del modal
    const dateEl = document.getElementById('expenseDate');
    const typeEl = document.getElementById('expenseType');
    const descEl = document.getElementById('expenseDescription');
    const amountEl = document.getElementById('expenseAmount');

    if (expense) {
        // ðŸ‘‰ Editar gasto existente
        dateEl.value = expense.date || new Date().toISOString().split('T')[0];
        typeEl.value = expense.type || "";
        descEl.value = expense.description || "";
        amountEl.value = expense.amount || 0;
    } else {
        // ðŸ‘‰ Nuevo gasto
        dateEl.value = new Date().toISOString().split('T')[0];
        typeEl.value = "";
        descEl.value = "";
        amountEl.value = "";
    }
}

function closeExpenseModal() {
    debugFinances("âŒ Cerrando modal de gastos...");
    const modal = document.getElementById("expenseModal");
    if (!modal) return;

    // Ocultar modal
    modal.classList.add("hidden");

    // Resetear modo ediciÃ³n
    modal.dataset.editId = "";

    // Limpiar campos del formulario
    const fields = ["expenseDate", "expenseType", "expenseDescription", "expenseAmount"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

async function saveExpenseToFirebase() {
    const amount = parseFloat(document.getElementById("expenseAmount").value.trim());
    const type = document.getElementById("expenseType").value.trim().toLowerCase();
    const description = document.getElementById("expenseDescription").value.trim();
    const date = document.getElementById("expenseDate").value;

    if (!window.currentUser) {
        showFinancesMessage("Debe iniciar sesiÃ³n", "error");
        return;
    }

    if (!amount || amount <= 0 || !type || !date) {
        showFinancesMessage("Todos los campos son obligatorios", "error");
        return;
    }

    const expense = {
        userId: window.currentUser.uid,
        amount,
        type,
        description,
        date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const modal = document.getElementById("expenseModal");
    const editId = modal ? modal.dataset.editId : "";

    const saveBtn = document.querySelector("#expenseModal button[type='submit']");
    if (saveBtn) saveBtn.disabled = true;

    try {
        if (editId) {
            await firebase.firestore().collection("expenses").doc(editId).update(expense);
            debugFinances(`âœï¸ Gasto actualizado (${editId}):`, expense);
            showFinancesMessage("âœï¸ Gasto editado correctamente", "success");
        } else {
            const docRef = await firebase.firestore().collection("expenses").add(expense);
            debugFinances(`âœ… Gasto agregado (${docRef.id}):`, expense);
            showFinancesMessage("âœ… Gasto agregado correctamente", "success");
        }

        if (modal) modal.dataset.editId = ""; // reset
        closeExpenseModal();
        loadFinancesData();
    } catch (error) {
        debugFinances("âŒ Error guardando gasto:", error);
        showFinancesMessage("âŒ No se pudo guardar el gasto", "error");
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function deleteExpense(id) {
    if (!id) {
        showFinancesMessage("âŒ ID de gasto no vÃ¡lido", "error");
        return;
    }

    const confirmDelete = confirm("ðŸ—‘ï¸ Â¿EstÃ¡s seguro de que deseas eliminar este gasto?");
    if (!confirmDelete) return;

    try {
        await firebase.firestore().collection("expenses").doc(id).delete();
        debugFinances(`ðŸ—‘ï¸ Gasto eliminado (${id})`);
        showFinancesMessage("âœ… Gasto eliminado correctamente", "success");
        loadFinancesData();
    } catch (error) {
        debugFinances("âŒ Error al eliminar gasto:", error);
        showFinancesMessage("âŒ No se pudo eliminar el gasto", "error");
    }
}

async function editExpense(id) {
    try {
        const doc = await firebase.firestore().collection("expenses").doc(id).get();

        if (!doc.exists) {
            showFinancesMessage("âŒ Gasto no encontrado", "error");
            return;
        }

        const exp = { id, ...doc.data() };

        // Guardar ID de ediciÃ³n en el modal
        const modal = document.getElementById("expenseModal");
        if (modal) modal.dataset.editId = id;

        // Reutilizar openExpenseModal con datos cargados
        openExpenseModal(exp);

        debugFinances(`âœï¸ Editando gasto (${id}):`, exp);
    } catch (err) {
        debugFinances("âŒ Error al editar gasto:", err);
        showFinancesMessage("âŒ No se pudo cargar el gasto", "error");
    }
}

function generatePLReport() {
  console.log("ðŸ“Š Generando Estado de Resultados Profesional...");

  if (!financesData || !expensesData) {
    alert("No hay datos suficientes para generar el reporte");
    return;
  }

  // Datos ya filtrados
  const filteredLoads = window.financesData || [];
  const filteredExpenses = window.expensesData || [];

  // PerÃ­odo legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";
  
  let periodLabel = "Todos los perÃ­odos";
  if (year && month) {
    const monthNames = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", 
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    };
    periodLabel = `${monthNames[month]} ${year}`;
  } else if (year) {
    periodLabel = `AÃ±o ${year}`;
  }

  // CÃ¡lculos financieros
  const totalRevenue = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // MÃ©tricas operativas
  const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
  const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
  const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
  const totalLoads = filteredLoads.length;

  // Desglose de gastos por categorÃ­a
  const categories = {};
  filteredExpenses.forEach(exp => {
    const type = (exp.type || "other").toLowerCase();
    categories[type] = (categories[type] || 0) + (Number(exp.amount) || 0);
  });

  const categoryLabels = {
    fuel: "ðŸšš Combustible",
    maintenance: "ðŸ”§ Mantenimiento", 
    food: "ðŸ” Comida",
    lodging: "ðŸ¨ Hospedaje",
    tolls: "ðŸ›£ï¸ Peajes",
    insurance: "ðŸ›¡ï¸ Seguro",
    permits: "ðŸ“‹ Permisos",
    other: "ðŸ“¦ Otros"
  };

  // AnÃ¡lisis de distribuciÃ³n de cargas
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
    console.warn("âš ï¸ Contenedor reportContent no encontrado");
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
      <h1 class="text-3xl font-bold text-gray-900 mb-2">ðŸ“Š Estado de Resultados</h1>
      <h2 class="text-xl text-blue-600 font-semibold mb-2">Expediter Load Calculator</h2>
      <p class="text-gray-600">PerÃ­odo: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-sm text-gray-500">Generado el ${currentDate}</p>
    </div>

    <!-- Resumen ejecutivo -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-green-700 mb-2">ðŸ’° Ingresos Totales</h3>
        <p class="text-3xl font-bold text-green-900">${formatCurrency(totalRevenue)}</p>
        <p class="text-sm text-green-600 mt-1">${totalLoads} cargas completadas</p>
      </div>
      
      <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-red-700 mb-2">ðŸ’¸ Gastos Totales</h3>
        <p class="text-3xl font-bold text-red-900">${formatCurrency(totalExpenses)}</p>
        <p class="text-sm text-red-600 mt-1">Gastos operativos reales</p>
      </div>
      
      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-blue-700 mb-2">ðŸ“ˆ Ganancia Neta</h3>
        <p class="text-3xl font-bold ${netProfit >= 0 ? 'text-blue-900' : 'text-red-900'}">${formatCurrency(netProfit)}</p>
        <p class="text-sm ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'} mt-1">Margen: ${margin.toFixed(1)}%</p>
      </div>
    </div>

    <!-- MÃ©tricas operativas -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">ðŸš› MÃ©tricas Operativas</h3>
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
      <h3 class="text-xl font-bold text-gray-900 mb-4">ðŸ’³ Desglose de Gastos</h3>
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CategorÃ­a</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% del Total</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${Object.entries(categories)
              .filter(([cat, val]) => val > 0)
              .sort(([,a], [,b]) => b - a)
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

    <!-- AnÃ¡lisis de cargas -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">ðŸŽ¯ AnÃ¡lisis de Cargas por Distancia</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p class="text-sm text-yellow-700">Cargas Cortas (&lt;300 mi)</p>
          <p class="text-3xl font-bold text-yellow-900">${shortHauls}</p>
          <p class="text-xs text-yellow-600">${totalLoads > 0 ? ((shortHauls/totalLoads)*100).toFixed(1) : 0}% del total</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p class="text-sm text-blue-700">Cargas Medianas (300-600 mi)</p>
          <p class="text-3xl font-bold text-blue-900">${mediumHauls}</p>
          <p class="text-xs text-blue-600">${totalLoads > 0 ? ((mediumHauls/totalLoads)*100).toFixed(1) : 0}% del total</p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p class="text-sm text-green-700">Cargas Largas (&gt;600 mi)</p>
          <p class="text-3xl font-bold text-green-900">${longHauls}</p>
          <p class="text-xs text-green-600">${totalLoads > 0 ? ((longHauls/totalLoads)*100).toFixed(1) : 0}% del total</p>
        </div>
      </div>
    </div>

    <!-- Botones de acciÃ³n -->
    <div class="text-center pt-6 border-t">
      <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mr-4">
        ðŸ–¨ï¸ Imprimir Reporte
      </button>
      <button onclick="exportReportToPDF()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
        ðŸ“„ Exportar PDF
      </button>
    </div>
  `;
  
  container.classList.remove("hidden");
  console.log("âœ… Estado de Resultados profesional generado");
}

function generateTaxReport() {
  console.log("ðŸ§¾ Generando Reporte Fiscal para aÃ±o completo...");

  if (!window.allFinancesData || !window.allExpensesData) {
    alert("No hay datos suficientes para generar el reporte fiscal");
    return;
  }

  // Usar aÃ±o seleccionado, datos completos del aÃ±o
  const year = document.getElementById("reportYear")?.value || new Date().getFullYear().toString();
  
  // Filtrar por aÃ±o completo, no por mes
  const filteredLoads = window.allFinancesData.filter(load => 
    load.date && load.date.startsWith(year)
  );
  const filteredExpenses = window.allExpensesData.filter(exp => 
    exp.date && exp.date.startsWith(year)
  );

  console.log(`Procesando datos fiscales para ${year}:`, {
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

  // Categorizar gastos segÃºn IRS Schedule C
  filteredExpenses.forEach(exp => {
    const amount = Number(exp.amount) || 0;
    const type = (exp.type || "other").toLowerCase();
    
    switch(type) {
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
    console.warn("âš ï¸ Contenedor reportContent no encontrado");
    return;
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric', 
    month: 'long',
    day: 'numeric'
  });

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
          <p class="text-3xl font-bold text-blue-900">$${grossReceipts.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-blue-600">Total Business Miles</p>
          <p class="text-3xl font-bold text-blue-900">${totalMiles.toLocaleString()}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-blue-600">Net Profit/Loss (Line 31)</p>
          <p class="text-3xl font-bold ${netProfitLoss >= 0 ? 'text-green-900' : 'text-red-900'}">
            $${netProfitLoss.toLocaleString('en-US', {minimumFractionDigits: 2})}
          </p>
        </div>
      </div>
    </div>

    <!-- Part II: Expenses -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">PART II - EXPENSES (Schedule C)</h3>
      <div class="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Line #</th>
              <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Expense Category</th>
              <th class="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">9</td>
              <td class="px-4 py-3 text-sm text-gray-900">Car and truck expenses</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.vehicleExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">17</td>
              <td class="px-4 py-3 text-sm text-gray-900">Insurance (other than health)</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.insurance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">20a</td>
              <td class="px-4 py-3 text-sm text-gray-900">Office expense</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.officeExpense.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">22</td>
              <td class="px-4 py-3 text-sm text-gray-900">Repairs and maintenance</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.repairsMaintenance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">25</td>
              <td class="px-4 py-3 text-sm text-gray-900">Travel, meals, and entertainment</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.travel.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">27a</td>
              <td class="px-4 py-3 text-sm text-gray-900">Other expenses</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.otherExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-200">
            <tr>
              <td class="px-4 py-3 text-sm font-bold text-gray-900">28</td>
              <td class="px-4 py-3 text-sm font-bold text-gray-900">Total expenses</td>
              <td class="px-4 py-3 text-sm font-bold text-gray-900 text-right">$${totalBusinessExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Vehicle Expense Comparison -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">VEHICLE EXPENSE METHOD COMPARISON</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 class="text-lg font-semibold text-yellow-800 mb-3">Standard Mileage Method</h4>
          <p class="text-3xl font-bold text-yellow-900">$${standardMileageDeduction.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          <p class="text-sm text-yellow-700 mt-2">${totalMiles.toLocaleString()} miles Ã— $0.67/mile (2024 rate)</p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 class="text-lg font-semibold text-green-800 mb-3">Actual Expense Method</h4>
          <p class="text-3xl font-bold text-green-900">$${actualExpenseMethod.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          <p class="text-sm text-green-700 mt-2">Fuel, tolls, and vehicle expenses</p>
        </div>
      </div>
      <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-sm text-blue-800">
          <strong>Recommended:</strong> ${recommendedMethod} 
          (saves $${Math.abs(standardMileageDeduction - actualExpenseMethod).toLocaleString('en-US', {minimumFractionDigits: 2})})
        </p>
      </div>
    </div>

    <!-- Self-Employment Tax -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4">SCHEDULE SE - SELF-EMPLOYMENT TAX</h3>
      <div class="bg-white border border-gray-300 rounded-lg p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center">
            <p class="text-sm text-gray-600">Self-Employment Earnings</p>
            <p class="text-2xl font-bold text-gray-900">$${selfEmploymentEarnings.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-600">Self-Employment Tax (14.13%)</p>
            <p class="text-2xl font-bold text-red-900">$${selfEmploymentTax.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-600">Deductible Portion (50%)</p>
            <p class="text-2xl font-bold text-green-900">$${deductibleSETax.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Important Tax Notes -->
    <div class="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
      <h4 class="text-lg font-bold text-red-800 mb-3">IMPORTANT TAX CONSIDERATIONS</h4>
      <ul class="text-sm text-red-700 space-y-2">
        <li>â€¢ Quarterly estimated tax payments may be required if you owe $1,000+ in taxes</li>
        <li>â€¢ Keep detailed records of all business miles and expenses</li>
        <li>â€¢ Meals while away from home are 50% deductible</li>
        <li>â€¢ Consider maximizing retirement contributions (SEP-IRA, Solo 401k)</li>
        <li>â€¢ This report is for reference only - consult a tax professional</li>
      </ul>
    </div>

    <!-- Action Buttons -->
    <div class="text-center pt-6 border-t-2 border-gray-300">
      <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mr-4 font-semibold">
        Print Tax Report
      </button>
      <button onclick="exportTaxData()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold">
        Export for Tax Software
      </button>
    </div>

    <!-- Disclaimer -->
    <div class="mt-8 text-center text-xs text-gray-500 border-t pt-4">
      <p>This report is generated for informational purposes only. Tax laws are complex and change frequently.</p>
      <p>Always consult with a qualified tax professional or CPA for tax advice and filing.</p>
    </div>
  `;
  
  container.classList.remove("hidden");
  console.log("âœ… Reporte fiscal anual generado exitosamente");
}




function exportFinancialData() {
  debugFinances("ðŸ“¤ Exportando datos financieros...");

  if (!financesData || !expensesData) {
    alert("No hay datos suficientes para exportar");
    return;
  }

  var csvData = [];

  // =======================
  // 1. Ingresos (cargas)
  // =======================
  csvData.push(['=== INGRESOS (CARGAS) ===']);
  csvData.push(['Fecha', 'Origen', 'Destino', 'Millas', 'RPM', 'Ingresos']);

  financesData.forEach(load => {
    csvData.push([
      load.date || '',
      (load.origin || '').replace(/,/g, ' '),
      (load.destination || '').replace(/,/g, ' '),
      load.totalMiles || 0,
      load.rpm || 0,
      formatCurrency(load.totalCharge || 0)
    ]);
  });

  // =======================
  // 2. Gastos manuales
  // =======================
  csvData.push(['']);
  csvData.push(['=== GASTOS MANUALES ===']);
  csvData.push(['Fecha', 'CategorÃ­a', 'DescripciÃ³n', 'Monto', 'Deducible']);

  expensesData.forEach(exp => {
    csvData.push([
      exp.date || '',
      exp.type || '',
      (exp.description || '').replace(/,/g, ' '),
      formatCurrency(exp.amount || 0),
      exp.deductible === false ? 'No' : 'SÃ­'
    ]);
  });

  // =======================
  // 3. Resumen
  // =======================
  const totalRevenue = financesData.reduce((s, l) => s + (l.totalCharge || 0), 0);
  const totalExpenses = expensesData.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  csvData.push(['']);
  csvData.push(['=== RESUMEN ===']);
  csvData.push(['Total Ingresos', formatCurrency(totalRevenue)]);
  csvData.push(['Total Gastos', formatCurrency(totalExpenses)]);
  csvData.push(['Ganancia Neta', formatCurrency(netProfit)]);
  csvData.push(['Total Cargas', financesData.length]);
  csvData.push(['Total Gastos', expensesData.length]);

  // =======================
  // 4. Generar archivo CSV
  // =======================
  const csvContent = "\uFEFF" + csvData.map(row =>
    row.map(cell => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const today = new Date();
  const fileName = `finanzas-expediter-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getDate()}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  debugFinances("âœ… Datos exportados exitosamente");
}



// âœ… DEBUG AVANZADO DE FINANZAS
function debugFinancesElements() {
    debugFinances("ðŸ” === DEBUG DE ELEMENTOS DOM FINANCIEROS ===");

    const criticalElements = [
        'totalRevenue',
        'totalExpensesSummary',
        'netProfit',
        'profitMarginPercent',
        'yearSelect',
        'monthSelect',
        'lastUpdated',
        'fuelExpenses',
        'maintenanceExpenses',
        'foodExpenses',
        'otherExpenses',
        'expensesList',
        'cashFlowChart',
        'expenseBreakdownChart'
    ];

    const results = criticalElements.map(id => {
        const el = document.getElementById(id);
        return {
            id,
            encontrado: !!el,
            tag: el ? el.tagName : "âŒ",
            texto: el ? el.textContent.trim() : "N/A"
        };
    });

    console.table(results);

    // ðŸ“Š Resumen rÃ¡pido
    const encontrados = results.filter(r => r.encontrado).length;
    const faltantes = results.filter(r => !r.encontrado).map(r => r.id);
    debugFinances(`ðŸ“Š Resumen â†’ Encontrados: ${encontrados}/${criticalElements.length}`);
    if (faltantes.length) debugFinances("âŒ Faltantes:", faltantes);

    // ðŸ” Extra: verificar si los grÃ¡ficos tienen contexto
    ['cashFlowChart','expenseBreakdownChart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas && canvas.getContext) {
            debugFinances(`ðŸŽ¨ ${id} tiene contexto 2D disponible`);
        }
    });

    debugFinances("===========================================");
}


// ðŸ“Š FUNCIÃ“N updateFinancialKPIs LIMPIA
// ==============================
function updateFinancialKPIs() {
  console.log("ðŸ“Š Actualizando KPIs mejorados...");
  
  // Datos bÃ¡sicos (solo gastos manuales)
  const totalRevenue = financesData.reduce((sum, load) => sum + (load.totalCharge || 0), 0);
  const totalExpenses = expensesData.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalMiles = financesData.reduce((sum, load) => sum + (load.totalMiles || 0), 0);
  const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
  const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  // Actualizar elementos existentes usando selectores especÃ­ficos
  const updateElementSafe = (id, value) => {
    const element = document.querySelector(`#finances #${id}`) || document.getElementById(id);
    if (element) {
      element.textContent = value;
      return true;
    }
    console.warn(`Elemento no encontrado: ${id}`);
    return false;
  };
  
  // Actualizar KPIs
  updateElementSafe('totalRevenue', formatCurrency(totalRevenue));
  updateElementSafe('totalExpensesSummary', formatCurrency(totalExpenses));
  updateElementSafe('netProfit', formatCurrency(netProfit));
  updateElementSafe('profitMarginPercent', margin.toFixed(1) + '%');
  
  // Actualizar nuevos elementos
  updateElementSafe('totalMiles', totalMiles.toLocaleString());
  updateElementSafe('avgRpm', formatCurrency(avgRpm));
  updateElementSafe('costPerMile', formatCurrency(costPerMile));
  
  // Calcular eficiencia
  const efficiency = calculateEfficiency();
  updateElementSafe('efficiency', efficiency + '%');
  
  console.log("âœ… KPIs actualizados:", {
    revenue: totalRevenue,
    expenses: totalExpenses,
    profit: netProfit,
    miles: totalMiles,
    rpm: avgRpm
  });
}







function populateYearSelect() {
  console.log("ðŸ“… Poblando selector de aÃ±os...");

  // ðŸ‘‰ Validar si hay datos
  const hasLoads = window.financesData && window.financesData.length > 0;
  const hasExpenses = window.expensesData && window.expensesData.length > 0;

  if (!hasLoads && !hasExpenses) {
    console.log("âš ï¸ No hay datos financieros para extraer aÃ±os");
    return;
  }

  // ðŸ‘‰ Extraer aÃ±os de cargas
  const yearsFromLoads = (window.financesData || [])
    .filter(l => l.date)
    .map(l => {
      try {
        return new Date(l.date).getFullYear().toString();
      } catch {
        return null;
      }
    });

  // ðŸ‘‰ Extraer aÃ±os de gastos
  const yearsFromExpenses = (window.expensesData || [])
    .filter(e => e.date)
    .map(e => {
      try {
        return new Date(e.date).getFullYear().toString();
      } catch {
        return null;
      }
    });

  // ðŸ‘‰ Consolidar aÃ±os Ãºnicos
  const years = [...new Set([...yearsFromLoads, ...yearsFromExpenses])]
    .filter(y => y)
    .sort((a, b) => b - a); // orden descendente

  const yearSelect = document.getElementById("yearSelect");
  if (!yearSelect) {
    console.warn("âš ï¸ No se encontrÃ³ el selector de aÃ±os (yearSelect)");
    return;
  }

  // ðŸ‘‰ Poblar selector
  yearSelect.innerHTML = '<option value="">ðŸ“Š Todos los AÃ±os</option>';
  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = `ðŸ—“ï¸ ${year}`;
    yearSelect.appendChild(option);
  });

  console.log(`âœ… AÃ±os disponibles: ${years.join(", ")}`);

  // ðŸ‘‰ Seleccionar el mÃ¡s reciente y actualizar meses
  if (years.length > 0) {
    yearSelect.value = years[0];
    if (typeof updateMonthOptions === "function") {
      updateMonthOptions();
    } else {
      console.warn("âš ï¸ updateMonthOptions no estÃ¡ definida aÃºn");
    }
  }
}

function updateMonthOptions() {
  console.log("ðŸ“… Actualizando meses...");

  const year = document.getElementById("yearSelect")?.value;
  const monthSelect = document.getElementById("monthSelect");

  if (!monthSelect) {
    console.warn("âŒ No se encontrÃ³ el selector de mes");
    return;
  }

  // âœ… Siempre dejamos la opciÃ³n de "Todos los Meses"
  monthSelect.innerHTML = '<option value="">ðŸ“Š Todos los Meses</option>';

  if (!year) {
    console.log("âš ï¸ No hay aÃ±o seleccionado, solo se muestra 'Todos los Meses'");
    return;
  }

  // ðŸ‘‰ Extraer meses de cargas
  const monthsFromLoads = (window.financesData || [])
    .filter(l => l.date)
    .map(l => {
      try {
        return new Date(l.date).toISOString().slice(0, 7); // YYYY-MM
      } catch {
        return null;
      }
    })
    .filter(m => m && m.startsWith(year));

  // ðŸ‘‰ Extraer meses de gastos
  const monthsFromExpenses = (window.expensesData || [])
    .filter(e => e.date)
    .map(e => {
      try {
        return new Date(e.date).toISOString().slice(0, 7);
      } catch {
        return null;
      }
    })
    .filter(m => m && m.startsWith(year));

  // ðŸ‘‰ Consolidar meses Ãºnicos y ordenarlos cronolÃ³gicamente
  const allMonths = [...new Set([...monthsFromLoads, ...monthsFromExpenses])]
    .filter(m => m)
    .sort((a, b) => new Date(a + "-01") - new Date(b + "-01"));

  const monthNames = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };

  // ðŸ‘‰ Poblar selector
  allMonths.forEach(m => {
    const month = m.slice(5, 7);
    const option = document.createElement("option");
    option.value = month;
    option.textContent = `ðŸ“… ${monthNames[month] || month}`;
    monthSelect.appendChild(option);
  });

  console.log(`âœ… Meses disponibles para ${year}: ${allMonths.join(", ")}`);

  // ðŸ‘‰ Seleccionar automÃ¡ticamente el Ãºltimo mes con datos
  if (allMonths.length > 0) {
    const latestMonth = allMonths[allMonths.length - 1].slice(5, 7);
    monthSelect.value = latestMonth;

    if (typeof filterByYearMonth === "function") {
      filterByYearMonth();
    } else {
      console.warn("âš ï¸ filterByYearMonth no estÃ¡ definida aÃºn");
    }
  }
}

// ============================
// ðŸ“… Selectores de PerÃ­odo Globalizados
// ============================

// 1. Leer perÃ­odo segÃºn contexto
function getSelectedPeriod(context = "global") {
  let year = "", month = "";

  if (context === "reports") {
    year = document.getElementById("reportYear")?.value || "";
    month = document.getElementById("reportMonth")?.value || "";
  } else if (context === "accounts") {
    year = document.getElementById("accountsYear")?.value || "";
    month = document.getElementById("accountsMonth")?.value || "";
  } else {
    year = document.getElementById("yearSelect")?.value || "";
    month = document.getElementById("monthSelect")?.value || "";
  }

  return { year, month };
}

// âœ… FunciÃ³n global para aplicar el filtro (reutilizable en main.js y tabs)
// 1. Primero actualiza la funciÃ³n applyFilter para que use la nueva lÃ³gica
function applyFilter(context = "global") {
  let yearEl, monthEl;
  if (context === "reports") {
    yearEl = document.getElementById("reportYear");
    monthEl = document.getElementById("reportMonth");
  } else if (context === "accounts") {
    yearEl = document.getElementById("accountsYear");
    monthEl = document.getElementById("accountsMonth");
  } else {
    yearEl = document.getElementById("yearSelect");
    monthEl = document.getElementById("monthSelect");
  }

  if (!yearEl || !monthEl) return;

  const year = yearEl.value;
  const month = monthEl.value;
  const period = (year && month) ? `${year}-${month}` : (year || "all");
  console.log(`Filtro aplicado (${context}): ${period}`);

  if (typeof window.loadFinancialData === "function") {
    window.loadFinancialData(period).then(r => {
      console.log("ðŸ’° [FINANCES] âœ… Datos cargados, actualizando UI completa...");
      
      // Actualizar KPIs mejorados
      updateFinancialKPIs(); // Sin parÃ¡metros, que use window.financesData
      updateExpenseCategories();
      renderExpensesList(window.expensesData);
      
      // Actualizar grÃ¡ficas principales
      setTimeout(() => {
        updateCashFlowChartEnhanced(); // âœ… VersiÃ³n mejorada
        updateExpenseBreakdownChart();
        
        // âœ… Nuevos grÃ¡ficos del Dashboard
        updateRpmTrendChart();
        updateLoadDistributionChart();
      }, 100);
      
      updateBusinessMetrics();
      
      console.log("âœ… UI completa de finanzas actualizada");
    }).catch(err => console.error("Error aplicando filtro:", err));
  }
}



// âœ… Inicializar selectores con aÃ±o/mes actual
// 2. Verificar que los listeners estÃ©n bien configurados
function initPeriodSelectors(context = "global") {
  console.log("Inicializando selectores para contexto:", context);
  
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");

  let yearEl, monthEl;
  if (context === "reports") {
    yearEl = document.getElementById("reportYear");
    monthEl = document.getElementById("reportMonth");
  } else if (context === "accounts") {
    yearEl = document.getElementById("accountsYear");
    monthEl = document.getElementById("accountsMonth");
  } else {
    yearEl = document.getElementById("yearSelect");
    monthEl = document.getElementById("monthSelect");
  }

  if (yearEl && monthEl) {
    // Poblar opciones...
    const minYear = 2023;
    yearEl.innerHTML = `<option value="">Todos</option>`;
    for (let y = minYear; y <= parseInt(currentYear); y++) {
      yearEl.innerHTML += `<option value="${y}">${y}</option>`;
    }
    yearEl.value = currentYear;

    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    monthEl.innerHTML = `<option value="">Todos</option>`;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      monthEl.innerHTML += `<option value="${mm}">${meses[m - 1]}</option>`;
    }
    monthEl.value = currentMonth;

    // Listeners (solo una vez)
    if (!yearEl.hasListener) {
      yearEl.addEventListener("change", () => {
        console.log("AÃ±o cambiado, aplicando filtro...");
        applyFilter(context);
      });
      yearEl.hasListener = true;
    }
    if (!monthEl.hasListener) {
      monthEl.addEventListener("change", () => {
        console.log("Mes cambiado, aplicando filtro...");
        applyFilter(context);
      });
      monthEl.hasListener = true;
    }

    // âœ… OPTIMIZACIÃ“N: Solo aplicar filtro si no hay datos en cachÃ©
    if (!window.financesData || window.financesData.length === 0 || !dataCache.lastLoadTime) {
      console.log("â±ï¸ Sin datos en cachÃ©, aplicando filtro inicial...");
      setTimeout(() => applyFilter(context), 500);
    } else {
      console.log("ðŸ“¦ [CACHE] Ya hay datos cargados, omitiendo filtro inicial");
    }
  }
}


// 3. Aplicar perÃ­odo segÃºn contexto
function applyPeriod(context) {
  const { year, month } = getSelectedPeriod(context);
  console.log(`ðŸ“… Filtro aplicado (${context}):`, year || "Todos", month || "Todos");

  if (context === "global") {
  const period = (year && month) ? `${year}-${month}` : (year || "all");
  console.log("ðŸ•’ Period final:", period);

  if (typeof window.loadFinancialData === "function") {
    window.loadFinancialData(period).then(r => {
      updateFinancialKPIs(r.kpis);
      updateExpenseCategories();
      updateFinancialCharts();
      updateBusinessMetrics();
    }).catch(err => {
      console.error("âŒ Error aplicando filtro global:", err);
    });
  }
                        
  } else if (context === "reports") {
    generatePLReport();
  } else if (context === "accounts") {
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    } else {
      console.warn("âš ï¸ loadAccountsData no implementado aÃºn");
    }
  }
}


// âœ… FUNCIÃ“N GLOBAL PARA TODOS LOS CONTEXTOS (summary, reports, accounts)
function filterByYearMonth(context = "global") {
  console.log(`ðŸ”„ [CLEAN] === INICIO filterByYearMonth (${context}) ===`);

  // ðŸ”§ Obtener periodo segÃºn contexto
  let yearSelect, monthSelect, periodInfo, periodSummary;

  switch (context) {
    case "reports":
      yearSelect = document.getElementById("reportYear");
      monthSelect = document.getElementById("reportMonth");
      break;
    case "accounts":
      yearSelect = document.getElementById("accountsYear");
      monthSelect = document.getElementById("accountsMonth");
      break;
    default: // summary/global
      yearSelect = document.getElementById("yearSelect");
      monthSelect = document.getElementById("monthSelect");
      periodInfo = document.getElementById("periodInfo");
      periodSummary = document.getElementById("periodSummary");
      break;
  }

  if (!yearSelect || !monthSelect) {
    console.error(`âŒ [CLEAN] Selectores no encontrados para contexto: ${context}`);
    return;
  }

  const year = yearSelect.value;
  const month = monthSelect.value;

  

  // âœ… Filtrar datasets
  let filteredLoads = window.financesData || [];
  let filteredExpenses = window.expensesData || [];

  if (year && month) {
    filteredLoads = filteredLoads.filter(load => normalizeDate(load.date) === `${year}-${month}`);
    filteredExpenses = filteredExpenses.filter(exp => normalizeDate(exp.date) === `${year}-${month}`);
  } else if (year && !month) {
    filteredLoads = filteredLoads.filter(load => normalizeDate(load.date, "year") === year);
    filteredExpenses = filteredExpenses.filter(exp => normalizeDate(exp.date, "year") === year);
  }

  console.log("ðŸ“Š [CLEAN] Datos filtrados:", {
    context,
    loads: filteredLoads.length,
    expenses: filteredExpenses.length
  });

  // ðŸ‘‰ Usar datos segÃºn el contexto
  if (context === "global") {
    const totalRevenue = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
    const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

    const kpis = { totalRevenue, totalExpenses, netProfit, margin, totalMiles, avgRpm };

    // Actualizar la UI del resumen
    updateFinancialKPIs(kpis);
    updateExpenseCategories(filteredExpenses);
    renderExpensesList(filteredExpenses);
    updateBusinessMetrics(filteredLoads, filteredExpenses);
    updateFinancialCharts(filteredLoads, filteredExpenses);

  
   

    console.log(`ðŸ”„ [CLEAN] === FIN filterByYearMonth (${context}) ===`);
    return;
  }

  if (context === "reports") {
    generatePLReport();
  } else if (context === "accounts") {
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    }
  }

  console.log(`ðŸ”„ [CLEAN] === FIN filterByYearMonth (${context}) ===`);
}

// âœ… FunciÃ³n auxiliar para calcular KPIs de cargas y gastos
function calculateKPIs(loads = [], expenses = []) {
  const totalRevenue = loads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const totalMiles = loads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
  const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

  return { totalRevenue, totalExpenses, netProfit, margin, totalMiles, avgRpm };
}

// ==============================
// ðŸ“Š FUNCIÃ“N updateKPIsUI SIMPLIFICADA
// ==============================
function updateKPIsUI({ totalRevenue, totalExpenses, netProfit, margin }) {
  const netProfitEl = document.querySelector('#finances #netProfit');
  if (netProfitEl) {
    netProfitEl.textContent = formatCurrency(netProfit);
    netProfitEl.style.fontSize = '2rem';
    netProfitEl.style.fontWeight = 'bold';
    netProfitEl.style.textAlign = 'center';
    netProfitEl.style.color = netProfit >= 0 ? '#16a34a' : '#dc2626';
  }

  const elementosFinances = [
    { id: 'totalRevenue', value: formatCurrency(totalRevenue) },
    { id: 'totalExpensesSummary', value: formatCurrency(totalExpenses) },
    { id: 'profitMarginPercent', value: `${margin.toFixed(1)}%` }
  ];

  elementosFinances.forEach(item => {
    const el = document.querySelector(`#finances #${item.id}`);
    if (el) {
      el.textContent = item.value;
      el.style.fontSize = '2rem';
      el.style.fontWeight = 'bold';
      el.style.textAlign = 'center';
      console.log(`âœ… [CLEAN] ${item.id}: ${item.value}`);
    }
  });

  // âœ… ELIMINADO: Referencias a elementos de categorÃ­as individuales
}

// ==============================
// ðŸ§® FUNCIÃ“N calculateExpenseCategories (mantenida)
// ==============================
function calculateExpenseCategories(expenses = []) {
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

  expenses.forEach(expense => {
    const amount = Number(expense.amount) || 0;
    const type = (expense.type || "").toLowerCase();

    switch (type) {
      case "fuel": categories.fuel += amount; break;
      case "maintenance": categories.maintenance += amount; break;
      case "food": categories.food += amount; break;
      case "lodging": categories.lodging += amount; break;
      case "tolls": categories.tolls += amount; break;
      case "insurance": categories.insurance += amount; break;
      case "permits": categories.permits += amount; break;
      default: categories.other += amount; break;
    }
  });

  return categories;
}

// âœ… Actualizar categorÃ­as en la UI
function updateExpenseCategoriesUI(categories) {
  const updateElementInFinances = (id, value) => {
    const element = document.getElementById(id); // âœ… corregido
    if (element) {
      element.textContent = value;
    } else {
      console.warn(`âš ï¸ [FINANCES] Elemento no encontrado: ${id}`);
    }
  };

  updateElementInFinances("fuelExpenses", formatCurrency(categories.fuel));
  updateElementInFinances("maintenanceExpenses", formatCurrency(categories.maintenance));
  updateElementInFinances("foodExpenses", formatCurrency(categories.food + categories.lodging));
  updateElementInFinances("tollExpenses", formatCurrency(categories.tolls));
  updateElementInFinances("insuranceExpenses", formatCurrency(categories.insurance));
  updateElementInFinances("permitsExpenses", formatCurrency(categories.permits));
  updateElementInFinances("otherExpenses", formatCurrency(categories.other));

  console.log("âœ… [CLEAN] CategorÃ­as actualizadas:", categories);
}



// âœ… EXPONER LA FUNCIÃ“N DE DEBUG GLOBALMENTE
window.debugFinancesElements = debugFinancesElements;
window.loadFinancesData = loadFinancesData;
window.openExpenseModal = openExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.saveExpenseToFirebase = saveExpenseToFirebase;
window.deleteExpense = deleteExpense;
window.editExpense = editExpense;
window.generatePLReport = generatePLReport;
window.generateTaxReport = generateTaxReport;
window.exportFinancialData = exportFinancialData;
window.updateFinancialKPIs = updateFinancialKPIs;

// âœ… Manejo de subtabs dentro de Finanzas
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('#finances .subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // quitar "active" de todos los botones
      document.querySelectorAll('#finances .subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // ocultar todos los contenidos
      document.querySelectorAll('#finances .subtab-content').forEach(sec => sec.classList.add('hidden'));

      // mostrar el seleccionado
      const subtab = btn.dataset.subtab;
      document.getElementById(`subtab-${subtab}`).classList.remove('hidden');
    });
  });
});

debugFinances("âœ… Finances.js CORREGIDO cargado completamente");

// Agregar al final de finances.js
async function loadAccountsData() {
  console.log("ðŸ“‹ Cargando datos de cuentas con filtros avanzados...");
  
  if (!window.allFinancesData || window.allFinancesData.length === 0) {
    console.log("No hay datos de cargas disponibles");
    return;
  }

  // Obtener todos los filtros
  const yearEl = document.getElementById("accountsYear");
  const monthEl = document.getElementById("accountsMonth");
  const statusEl = document.getElementById("accountsStatus");
  const companyEl = document.getElementById("accountsCompany");
  const sortEl = document.getElementById("accountsSort");
  
  const year = yearEl?.value || "";
  const month = monthEl?.value || "";
  const statusFilter = statusEl?.value || "";
  const companyFilter = companyEl?.value || "";
  const sortBy = sortEl?.value || "date-desc";
  
  // Poblar selector de compaÃ±Ã­as dinÃ¡micamente
  populateCompanyFilter();
  
  // Filtrar cargas por perÃ­odo
  let filteredLoads = window.allFinancesData;
  
  // Filtro por fecha
  if (year && month) {
    const period = `${year}-${month.padStart(2, '0')}`;
    filteredLoads = filteredLoads.filter(load => load.date && load.date.startsWith(period));
  } else if (year) {
    filteredLoads = filteredLoads.filter(load => load.date && load.date.startsWith(year));
  }
  
  // Filtro por estado
  if (statusFilter) {
    filteredLoads = filteredLoads.filter(load => {
      const status = updatePaymentStatus(load);
      return status === statusFilter;
    });
  }
  
  // Filtro por compaÃ±Ã­a
  if (companyFilter) {
    filteredLoads = filteredLoads.filter(load => 
      (load.companyName || "").toLowerCase().includes(companyFilter.toLowerCase())
    );
  }
  
  // Ordenamiento
  filteredLoads.sort((a, b) => {
    switch(sortBy) {
      case "date-asc":
        return new Date(a.date) - new Date(b.date);
      case "date-desc":
        return new Date(b.date) - new Date(a.date);
      case "amount-asc":
        return (a.totalCharge || 0) - (b.totalCharge || 0);
      case "amount-desc":
        return (b.totalCharge || 0) - (a.totalCharge || 0);
      case "company":
        return (a.companyName || "").localeCompare(b.companyName || "");
      case "overdue":
        const aOverdue = updatePaymentStatus(a) === 'overdue' ? calculateOverdueDays(a.expectedPaymentDate) : -1;
        const bOverdue = updatePaymentStatus(b) === 'overdue' ? calculateOverdueDays(b.expectedPaymentDate) : -1;
        return bOverdue - aOverdue;
      default:
        return new Date(b.date) - new Date(a.date);
    }
  });

  console.log(`Procesando ${filteredLoads.length} cargas para cuentas (filtradas y ordenadas)`);

  renderAccountsSummaryCards(filteredLoads);
  renderPendingLoads(filteredLoads);
  console.log("âœ… Datos de cuentas cargados");
}

// FunciÃ³n para poblar el selector de compaÃ±Ã­as
function populateCompanyFilter() {
  const companyEl = document.getElementById("accountsCompany");
  if (!companyEl || !window.allFinancesData) return;
  
  // Obtener compaÃ±Ã­as Ãºnicas
  const companies = [...new Set(
    window.allFinancesData
      .map(load => load.companyName)
      .filter(name => name && name.trim())
      .sort()
  )];
  
  // Limpiar y poblar
  const currentValue = companyEl.value;
  companyEl.innerHTML = '<option value="">Todas</option>';
  
  companies.forEach(company => {
    const option = document.createElement('option');
    option.value = company;
    option.textContent = company;
    companyEl.appendChild(option);
  });
  
  // Restaurar valor seleccionado
  companyEl.value = currentValue;
}

// Event listeners para los filtros
document.addEventListener("DOMContentLoaded", () => {
  const filterElements = ['accountsStatus', 'accountsCompany', 'accountsSort'];
  
  filterElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => {
        loadAccountsData();
      });
    }
  });
});

// Exponer la funciÃ³n globalmente
window.populateCompanyFilter = populateCompanyFilter;

// âœ… 1. FUNCIÃ“N markAsPaid CORREGIDA
async function markAsPaid(loadId) {
  try {
    const paymentDate = new Date().toISOString().split('T')[0];
    
    // âœ… CORREGIDO: Guardar actualPaymentDate + paymentDate
    await firebase.firestore().collection("loads").doc(loadId).update({
      paymentStatus: "paid",
      actualPaymentDate: paymentDate,  // âœ… CAMPO CORRECTO para filtro
      paymentDate: paymentDate,        // âœ… Mantener por compatibilidad
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // âœ… CORREGIDO: Actualizar en memoria ambos campos
    const load = window.allFinancesData.find(l => l.id === loadId);
    if (load) {
      load.paymentStatus = "paid";
      load.actualPaymentDate = paymentDate;  // âœ… CAMPO CORRECTO
      load.paymentDate = paymentDate;        // âœ… Compatibilidad
    }

    console.log("âœ… Carga marcada como pagada:", loadId);
    loadAccountsData();
    showMessage("Carga marcada como pagada exitosamente", "success");
  } catch (error) {
    console.error("âŒ Error marcando como pagada:", error);
    showMessage("Error al marcar como pagada", "error");
  }
}

// Exponer funciones globalmente
window.loadAccountsData = loadAccountsData;
window.markAsPaid = markAsPaid;



function updateAccountsSummary(summary) {
  const summaryEl = document.getElementById("accountsSummary");
  if (!summaryEl) return;

  summaryEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 class="text-lg font-semibold text-yellow-800">Pendientes</h3>
        <p class="text-2xl font-bold text-yellow-900">${formatCurrency(summary.pending.amount)}</p>
        <p class="text-sm text-yellow-600">${summary.pending.count} cargas</p>
      </div>
      
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 class="text-lg font-semibold text-red-800">Vencidas</h3>
        <p class="text-2xl font-bold text-red-900">${formatCurrency(summary.overdue.amount)}</p>
        <p class="text-sm text-red-600">${summary.overdue.count} cargas</p>
      </div>
      
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 class="text-lg font-semibold text-green-800">Pagadas</h3>
        <p class="text-2xl font-bold text-green-900">${formatCurrency(summary.paid.amount)}</p>
        <p class="text-sm text-green-600">${summary.paid.count} cargas</p>
      </div>
    </div>
  `;
}

function renderPendingPayments(loads) {
  const listEl = document.getElementById("pendingPaymentsList");
  if (!listEl) return;

  if (loads.length === 0) {
    listEl.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        No hay cargas pendientes de pago
      </div>
    `;
    return;
  }

  const rows = loads.map(load => {
    const isOverdue = load.paymentStatus === "overdue";
    const statusClass = isOverdue ? "text-red-600" : "text-yellow-600";
    const bgClass = isOverdue ? "bg-red-50" : "bg-yellow-50";
    
    return `
      <tr class="${bgClass}">
        <td class="p-2 text-sm">${load.date}</td>
        <td class="p-2 text-sm">${load.companyName || '-'}</td>
        <td class="p-2 text-sm font-semibold">${formatCurrency(load.totalCharge)}</td>
        <td class="p-2 text-sm">${load.dueDate}</td>
        <td class="p-2 text-sm ${statusClass}">
          ${isOverdue ? `Vencida (${load.daysOverdue} dÃ­as)` : 'Pendiente'}
        </td>
        <td class="p-2 text-sm">
          <button onclick="markAsPaid('${load.id}')" 
                  class="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700">
            Marcar Pagada
          </button>
        </td>
      </tr>
    `;
  }).join('');

  listEl.innerHTML = `
    <table class="min-w-full text-xs border border-gray-300">
      <thead class="bg-gray-100">
        <tr>
          <th class="p-2 text-left">Fecha</th>
          <th class="p-2 text-left">Empresa</th>
          <th class="p-2 text-left">Monto</th>
          <th class="p-2 text-left">Vencimiento</th>
          <th class="p-2 text-left">Estado</th>
          <th class="p-2 text-left">Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPaidLoads(loads) {
  const listEl = document.getElementById("paidLoadsList");
  if (!listEl) return;

  if (loads.length === 0) {
    listEl.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        No hay cargas pagadas en este perÃ­odo
      </div>
    `;
    return;
  }

  const rows = loads.map(load => `
    <tr class="bg-green-50">
      <td class="p-2 text-sm">${load.date}</td>
      <td class="p-2 text-sm">${load.companyName || '-'}</td>
      <td class="p-2 text-sm font-semibold">${formatCurrency(load.totalCharge)}</td>
      <td class="p-2 text-sm">${load.paymentDate || '-'}</td>
    </tr>
  `).join('');

  listEl.innerHTML = `
    <table class="min-w-full text-xs border border-gray-300">
      <thead class="bg-gray-100">
        <tr>
          <th class="p-2 text-left">Fecha Carga</th>
          <th class="p-2 text-left">Empresa</th>
          <th class="p-2 text-left">Monto</th>
          <th class="p-2 text-left">Fecha Pago</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}// ==============================
// EVENT LISTENERS
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  // Listeners para botones de Reportes
  const generatePLBtn = document.getElementById("generatePLBtn");
  const generateTaxBtn = document.getElementById("generateTaxBtn");
  const exportBtn = document.getElementById("exportBtn");
  
  if (generatePLBtn) {
    generatePLBtn.addEventListener("click", () => {
      console.log("Generando Estado de Resultados...");
      generatePLReport();
    });
  }
  
  if (generateTaxBtn) {
    generateTaxBtn.addEventListener("click", () => {
      console.log("Generando Reporte Fiscal...");
      generateTaxReport();
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      console.log("Exportando datos...");
      exportFinancialData();
    });
  }
});

// ðŸ‘‰ Se ejecuta cuando el DOM ya estÃ¡ listo
document.addEventListener("DOMContentLoaded", () => {
    debugFinances("ðŸ“‹ DOM cargado - Configurando event listeners");
});

// ðŸ‘‰ Evento personalizado: cuando se guarda algo (ej: nueva carga o gasto)
document.addEventListener("loadSaved", () => {
    debugFinances("ðŸ”„ loadSaved disparado â†’ refrescando finanzas");

    if (!window.currentUser) {
        debugFinances("âš ï¸ No hay usuario logueado, no se recargan finanzas");
        return;
    }

    if (financesLoaded) {
        setTimeout(() => {
            loadFinancesData();
        }, 500);
    } else {
        debugFinances("âš ï¸ Finances aÃºn no estaban cargadas al recibir loadSaved");
    }
});

// Event listener para selectores de reportes
document.addEventListener("DOMContentLoaded", () => {
  const reportYear = document.getElementById("reportYear");
  const reportMonth = document.getElementById("reportMonth");
  
  if (reportYear) {
    reportYear.addEventListener("change", () => {
      const reportContainer = document.getElementById("reportContent");
      if (reportContainer && !reportContainer.classList.contains("hidden")) {
        // Si hay un reporte visible, regenerarlo
        setTimeout(() => {
          applyFilter("reports");
          setTimeout(() => generatePLReport(), 300);
        }, 100);
      }
    });
  }
  
  if (reportMonth) {
    reportMonth.addEventListener("change", () => {
      const reportContainer = document.getElementById("reportContent");
      if (reportContainer && !reportContainer.classList.contains("hidden")) {
        // Si hay un reporte visible, regenerarlo
        setTimeout(() => {
          applyFilter("reports");
          setTimeout(() => generatePLReport(), 300);
        }, 100);
      }
    });
  }
});

// ===== FUNCIÃ“N DE EFICIENCIA =====
function calculateEfficiency() {
  if (financesData.length === 0) return 0;
  
  // AnÃ¡lisis: cargas con buen RPM vs total
  const goodRpmLoads = financesData.filter(load => {
    const rpm = load.totalMiles > 0 ? load.totalCharge / load.totalMiles : 0;
    return rpm >= 1.0; // RPM mayor a $1.00 se considera bueno
  }).length;
  
  return Math.round((goodRpmLoads / financesData.length) * 100);
}

// ===== GRÃFICO COMBINADO MEJORADO =====
function updateCashFlowChartEnhanced() {
  const canvas = document.getElementById('cashFlowChart');
  if (!canvas) return;

  // Destruir grÃ¡fico existente
  if (window.cashFlowChart && typeof window.cashFlowChart.destroy === "function") {
    window.cashFlowChart.destroy();
  }

  // Usar los datos correctos (solo gastos manuales)
  const monthlyData = {};
  
  // Procesar cargas
  financesData.forEach(load => {
    const month = load.date ? load.date.substring(0, 7) : '2025-08';
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0, profit: 0 };
    }
    monthlyData[month].revenue += load.totalCharge || 0;
  });
  
  // Procesar gastos manuales
  expensesData.forEach(expense => {
    const month = expense.date ? expense.date.substring(0, 7) : '2025-08';
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0, profit: 0 };
    }
    monthlyData[month].expenses += expense.amount || 0;
  });
  
  // Calcular ganancias
  Object.keys(monthlyData).forEach(month => {
    monthlyData[month].profit = monthlyData[month].revenue - monthlyData[month].expenses;
  });

  const labels = Object.keys(monthlyData).sort();
  const revenues = labels.map(month => monthlyData[month].revenue);
  const expenses = labels.map(month => monthlyData[month].expenses);
  const profits = labels.map(month => monthlyData[month].profit);

  // Crear grÃ¡fico (barras si es un mes, lÃ­neas si son varios)
  const chartType = labels.length === 1 ? 'bar' : 'line';
  
  window.cashFlowChart = new Chart(canvas, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [
        {
          label: 'ðŸ’° Ingresos',
          data: revenues,
          borderColor: '#10b981',
          backgroundColor: chartType === 'bar' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        },
        {
          label: 'ðŸ’¸ Gastos',
          data: expenses,
          borderColor: '#ef4444',
          backgroundColor: chartType === 'bar' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        },
        {
          label: 'ðŸ“ˆ Ganancia',
          data: profits,
          borderColor: '#3b82f6',
          backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    }
  });

  console.log("âœ… GrÃ¡fico combinado mejorado actualizado");
}

// ===== GRÃFICO DE TENDENCIA RPM =====
function updateRpmTrendChart() {
  const canvas = document.getElementById('rpmTrendChart');
  if (!canvas) {
    console.log("ðŸ“ˆ Canvas rpmTrendChart no encontrado");
    return;
  }

  // Destruir grÃ¡fico existente
  if (window.rpmTrendChart && typeof window.rpmTrendChart.destroy === "function") {
    window.rpmTrendChart.destroy();
  }

  // Calcular RPM por mes
  const monthlyRpm = {};
  (window.financesData || []).forEach(load => {
    const month = load.date ? load.date.substring(0, 7) : '2025-08';
    const rpm = load.totalMiles > 0 ? load.totalCharge / load.totalMiles : 0;
    
    if (!monthlyRpm[month]) {
      monthlyRpm[month] = { sum: 0, count: 0 };
    }
    monthlyRpm[month].sum += rpm;
    monthlyRpm[month].count++;
  });

  const labels = Object.keys(monthlyRpm).sort();
  const rpmValues = labels.map(month => {
    return monthlyRpm[month].count > 0 ? monthlyRpm[month].sum / monthlyRpm[month].count : 0;
  });

  // Si solo hay un mes, usar grÃ¡fico de barras
  const chartType = labels.length === 1 ? 'bar' : 'line';

  window.rpmTrendChart = new Chart(canvas, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: 'RPM Promedio',
        data: rpmValues,
        borderColor: '#3b82f6',
        backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: chartType === 'line',
        borderWidth: chartType === 'bar' ? 2 : 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        }
      }
    }
  });

  console.log("âœ… GrÃ¡fico RPM Trend actualizado");
}

// ===== GRÃFICO DE DISTRIBUCIÃ“N DE CARGAS =====
function updateLoadDistributionChart() {
  const canvas = document.getElementById('loadDistributionChart');
  if (!canvas) {
    console.log("ðŸŽ¯ Canvas loadDistributionChart no encontrado");
    return;
  }

  // Destruir grÃ¡fico existente
  if (window.loadDistributionChart && typeof window.loadDistributionChart.destroy === "function") {
    window.loadDistributionChart.destroy();
  }

  // Clasificar cargas por distancia
  let shortHauls = 0;   // < 300 millas
  let mediumHauls = 0;  // 300-600 millas
  let longHauls = 0;    // > 600 millas

  (window.financesData || []).forEach(load => {
    const miles = load.totalMiles || 0;
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
      labels: ['Cortas (<300 mi)', 'Medianas (300-600 mi)', 'Largas (>600 mi)'],
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

  console.log("âœ… GrÃ¡fico de distribuciÃ³n de cargas actualizado");
}

// ===============================
// FUNCIONES COMPLEMENTARIAS DE CUENTAS
// ===============================

function calculateOverdueDays(expectedDate) {
  const today = new Date();
  const expected = new Date(expectedDate);
  const diffTime = today - expected;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function updatePaymentStatus(load) {
  if (load.actualPaymentDate) {
    return 'paid';
  }
  
  if (load.expectedPaymentDate) {
    const overdueDays = calculateOverdueDays(load.expectedPaymentDate);
    if (overdueDays > 0) {
      return 'overdue';
    }
  }
  
  return 'pending';
}

// ===============================
// ðŸ”§ FUNCIONES CORREGIDAS PARA finances.js
// ===============================

// âœ… 1. FUNCIÃ“N markAsPaid CORREGIDA
async function markAsPaid(loadId) {
  try {
    const paymentDate = new Date().toISOString().split('T')[0];
    
    // âœ… CORREGIDO: Guardar actualPaymentDate + paymentDate
    await firebase.firestore().collection("loads").doc(loadId).update({
      paymentStatus: "paid",
      actualPaymentDate: paymentDate,  // âœ… CAMPO CORRECTO para filtro
      paymentDate: paymentDate,        // âœ… Mantener por compatibilidad
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // âœ… CORREGIDO: Actualizar en memoria ambos campos
    const load = window.allFinancesData.find(l => l.id === loadId);
    if (load) {
      load.paymentStatus = "paid";
      load.actualPaymentDate = paymentDate;  // âœ… CAMPO CORRECTO
      load.paymentDate = paymentDate;        // âœ… Compatibilidad
    }

    console.log("âœ… Carga marcada como pagada:", loadId);
    loadAccountsData();
    showMessage("Carga marcada como pagada exitosamente", "success");
  } catch (error) {
    console.error("âŒ Error marcando como pagada:", error);
    showMessage("Error al marcar como pagada", "error");
  }
}
// ðŸ”§ FIX PERMANENTE - Actualizar funciÃ³n renderPendingLoads con scroll horizontal

function renderPendingLoads(loads) {
  const listEl = document.getElementById("accountsList");
  if (!listEl) return;

  console.log("ðŸ“„ Organizando datos de cuentas...");

  // Obtener filtro actual
  const statusFilter = document.getElementById("accountsStatus")?.value || "";
  
  // Separar cargas por estado de pago
  const allLoads = loads.filter(load => load.paymentStatus || load.actualPaymentDate);
  const pendingLoads = allLoads.filter(load => !load.actualPaymentDate && load.paymentStatus !== 'paid');
  const paidLoads = allLoads.filter(load => load.actualPaymentDate || load.paymentStatus === 'paid');
  
  // Identificar cargas vencidas (pendientes que ya pasaron su fecha)
  const today = new Date();
  const overdueLoads = pendingLoads.filter(load => {
    if (!load.expectedPaymentDate) return false;
    const expectedDate = new Date(load.expectedPaymentDate);
    return today > expectedDate;
  });

  console.log(`ðŸ“Š Cargas organizadas: ${pendingLoads.length} pendientes, ${overdueLoads.length} vencidas, ${paidLoads.length} pagadas`);

  // âœ… RENDERIZAR SEGÃšN EL FILTRO SELECCIONADO
  let html = '';

  if (statusFilter === 'paid') {
    // ðŸŸ¢ MOSTRAR SOLO CARGAS PAGADAS
    if (paidLoads.length === 0) {
      html = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">âœ…</div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">No hay cargas pagadas</h3>
          <p class="text-gray-500">Las cargas pagadas aparecerÃ¡n aquÃ­</p>
        </div>
      `;
    } else {
      const rows = paidLoads.map(load => `
        <tr class="bg-green-50">
          <td class="p-2 text-sm">${load.date}</td>
          <td class="p-2 text-sm">${load.companyName || '-'}</td>
          <td class="p-2 text-sm">${load.loadNumber || '-'}</td>
          <td class="p-2 text-sm font-semibold text-green-900">${formatCurrency(load.totalCharge)}</td>
          <td class="p-2 text-sm">${load.actualPaymentDate || load.paymentDate || '-'}</td>
          <td class="p-2 text-sm text-green-600 font-medium">âœ… Pagada</td>
        </tr>
      `).join('');

      html = `
        <div class="mb-4">
          <h3 class="text-lg font-bold text-green-700 mb-4">âœ… Cargas Pagadas (${paidLoads.length})</h3>
          <div class="bg-green-50 border border-green-200 rounded-lg overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-green-100">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">CompaÃ±Ã­a</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">NÃºmero</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Monto</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Fecha Pago</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-green-200">
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } else {
    // ðŸŸ¡ MOSTRAR PENDIENTES Y VENCIDAS
    const activePending = pendingLoads.filter(load => !overdueLoads.includes(load));
    const totalPaid = paidLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0);

    // Estado de Cargas Vencidas
    html += overdueLoads.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-red-700 mb-4">ðŸš¨ Cargas Vencidas (${overdueLoads.length})</h3>
        <div class="bg-red-50 border border-red-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-red-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Fecha Carga</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">CompaÃ±Ã­a</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">NÃºmero</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Monto</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Se Pagaba El</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">DÃ­as Vencida</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">AcciÃ³n</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-red-200">
              ${overdueLoads.map(load => {
                const daysOverdue = calculateOverdueDays(load.expectedPaymentDate);
                return `
                  <tr class="bg-red-50">
                    <td class="px-4 py-3 text-sm">${load.date}</td>
                    <td class="px-4 py-3 text-sm font-medium">${load.companyName || '-'}</td>
                    <td class="px-4 py-3 text-sm">${load.loadNumber || '-'}</td>
                    <td class="px-4 py-3 text-sm font-bold text-red-900">${formatCurrency(load.totalCharge)}</td>
                    <td class="px-4 py-3 text-sm">${load.expectedPaymentDate}</td>
                    <td class="px-4 py-3 text-sm font-bold text-red-700">${daysOverdue} dÃ­as</td>
                    <td class="px-4 py-3 text-sm">
                      <button onclick="markAsPaid('${load.id}')" 
                              class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                        âœ… Marcar Pagada
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    // Estado de Cargas Pendientes Activas
    html += activePending.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-yellow-700 mb-4">â³ Cargas Pendientes de Pago (${activePending.length})</h3>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-yellow-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Fecha Carga</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">CompaÃ±Ã­a</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">NÃºmero</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Monto</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Se Paga El</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">AcciÃ³n</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-yellow-200">
              ${activePending.map(load => `
                <tr class="bg-yellow-50">
                  <td class="px-4 py-3 text-sm">${load.date}</td>
                  <td class="px-4 py-3 text-sm font-medium">${load.companyName || '-'}</td>
                  <td class="px-4 py-3 text-sm">${load.loadNumber || '-'}</td>
                  <td class="px-4 py-3 text-sm font-bold text-yellow-900">${formatCurrency(load.totalCharge)}</td>
                  <td class="px-4 py-3 text-sm">${load.expectedPaymentDate || 'Calculando...'}</td>
                  <td class="px-4 py-3 text-sm">
                    <button onclick="markAsPaid('${load.id}')" 
                            class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                      âœ… Marcar Pagada
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    // Resumen de Cargas Pagadas (solo cuando no es el filtro "paid")
    html += paidLoads.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-green-700 mb-4">âœ… Resumen de Cargas Pagadas</h3>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-green-800">
            <strong>${paidLoads.length} cargas</strong> han sido pagadas por un total de 
            <strong>${formatCurrency(totalPaid)}</strong>
          </p>
        </div>
      </div>
    ` : '';

    // Mensaje cuando no hay cargas
    if (allLoads.length === 0) {
      html = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">ðŸ’¼</div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">No hay cargas por gestionar</h3>
          <p class="text-gray-500">Las cargas aparecerÃ¡n aquÃ­ cuando tengan informaciÃ³n de pago</p>
        </div>
      `;
    }
  }

  listEl.innerHTML = html;
}

// âœ… Sobrescribir la funciÃ³n global
window.renderPendingLoads = renderPendingLoads;

console.log("âœ… FunciÃ³n renderPendingLoads actualizada con scroll horizontal para mÃ³vil");
console.log("ðŸ“± Ahora las tablas tendrÃ¡n scroll horizontal en dispositivos mÃ³viles");

// Recargar los datos para aplicar el cambio
if (typeof loadAccountsData === 'function') {
  loadAccountsData();
  console.log("ðŸ”„ Datos de cuentas recargados");
}


// Actualizar la funciÃ³n loadAccountsData para usar las nuevas funciones
function loadAccountsDataImproved() {
  console.log("ðŸ“‹ Cargando sistema de cuentas mejorado...");
  
  if (!window.allFinancesData || window.allFinancesData.length === 0) {
    console.log("No hay datos de cargas disponibles");
    return;
  }

  // Obtener perÃ­odo seleccionado
  const yearEl = document.getElementById("accountsYear");
  const monthEl = document.getElementById("accountsMonth");
  const year = yearEl?.value || "";
  const month = monthEl?.value || "";
  
  // Filtrar cargas por perÃ­odo
  let filteredLoads = window.allFinancesData;
  if (year && month) {
    const period = `${year}-${month.padStart(2, '0')}`;
    filteredLoads = filteredLoads.filter(load => load.date && load.date.startsWith(period));
  } else if (year) {
    filteredLoads = filteredLoads.filter(load => load.date && load.date.startsWith(year));
  }

  console.log(`Procesando ${filteredLoads.length} cargas para cuentas`);

  // Renderizar cargas pendientes y pagadas
  renderPendingLoads(filteredLoads);
  
  // Si existe renderPaidLoads, tambiÃ©n actualizarla
  if (typeof renderPaidLoads === 'function') {
    const paidLoads = filteredLoads.filter(load => load.actualPaymentDate);
    renderPaidLoads(paidLoads);
  }
}

// âœ… FUNCIÃ“N PARA CREAR TARJETAS DE RESUMEN EN CUENTAS
// Agregar a finances.js

function renderAccountsSummaryCards(loads) {
  const summaryEl = document.getElementById("accountsSummaryCards");
  if (!summaryEl) {
    console.log("âŒ Elemento accountsSummaryCards no encontrado");
    return;
  }

  console.log("ðŸ“Š Renderizando tarjetas de resumen...");

  // Separar cargas por estado
  const paidLoads = loads.filter(load => load.actualPaymentDate);
  const pendingLoads = loads.filter(load => !load.actualPaymentDate && load.paymentStatus !== 'paid');
  
  // Identificar vencidas
  const today = new Date();
  const overdueLoads = pendingLoads.filter(load => {
    if (!load.expectedPaymentDate) return false;
    const expectedDate = new Date(load.expectedPaymentDate);
    return today > expectedDate;
  });

  // Cargas pendientes activas (no vencidas)
  const activePendingLoads = pendingLoads.filter(load => !overdueLoads.includes(load));

  // Calcular totales
  const paidTotal = paidLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0);
  const pendingTotal = activePendingLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0);
  const overdueTotal = overdueLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0);

  console.log(`ðŸ“Š Resumen: ${paidLoads.length} pagadas, ${activePendingLoads.length} pendientes, ${overdueLoads.length} vencidas`);

  // Renderizar tarjetas
  summaryEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      <!-- Tarjeta: Pagadas -->
      <div class="bg-green-50 border-2 border-green-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-green-700 uppercase tracking-wide">âœ… Pagadas</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-green-900">${paidLoads.length}</p>
          <p class="text-sm text-green-600 mt-1">cargas</p>
        </div>
        <div class="mt-3 pt-3 border-t border-green-200">
          <p class="text-lg font-semibold text-green-800">${formatCurrency(paidTotal)}</p>
          <p class="text-xs text-green-600">Monto total cobrado</p>
        </div>
      </div>

      <!-- Tarjeta: Pendientes -->
      <div class="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-yellow-700 uppercase tracking-wide">â³ Pendientes</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-yellow-900">${activePendingLoads.length}</p>
          <p class="text-sm text-yellow-600 mt-1">cargas</p>
        </div>
        <div class="mt-3 pt-3 border-t border-yellow-200">
          <p class="text-lg font-semibold text-yellow-800">${formatCurrency(pendingTotal)}</p>
          <p class="text-xs text-yellow-600">Por cobrar</p>
        </div>
      </div>

      <!-- Tarjeta: Vencidas -->
      <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-red-700 uppercase tracking-wide">ðŸš¨ Vencidas</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-red-900">${overdueLoads.length}</p>
          <p class="text-sm text-red-600 mt-1">cargas</p>
        </div>
        <div class="mt-3 pt-3 border-t border-red-200">
          <p class="text-lg font-semibold text-red-800">${formatCurrency(overdueTotal)}</p>
          <p class="text-xs text-red-600">En mora</p>
        </div>
      </div>

    </div>
  `;
}

// Exponer las funciones globalmente
window.calculateOverdueDays = calculateOverdueDays;
window.updatePaymentStatus = updatePaymentStatus;
window.renderPendingLoads = renderPendingLoads;
window.loadAccountsDataImproved = loadAccountsDataImproved;