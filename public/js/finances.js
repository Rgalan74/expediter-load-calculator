// finances.js - Refactored Version
// ⚠️ Core functionality moved to finances-core.js and finances-data.js

// ========================================
// MOVED TO finances-core.js
// ========================================
// var financesData = [];
// var expensesData = [];
// var cashFlowChart = null;
// var expenseBreakdownChart = null;
// var financesLoaded = false;
// var allFinancesData = [];
// var allExpensesData = [];

// ========================================
// MOVED TO finances-core.js
// ========================================
// Chart.js configuration now in finances-core.js

// Estado de ordenamiento para gastos (Agregado para soportar sorting)
window.currentExpenseSort = { column: 'date', asc: false };


// ========================================
// MOVED TO finances-data.js
// ========================================
// ensurePaymentFields function now in finances-data.js
// loadFinancialData function now in finances-data.js

/*
// Original ensurePaymentFields - NOW IN finances-data.js
function ensurePaymentFields(loads) {
  return loads.map(load => {
    if (!load.paymentStatus) {
      // Calcular fecha de pago automticamente
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

// OK FUNCIN loadFinancialData CORREGIDA DEFINITIVA
// Reemplazar en finances.js

async function loadFinancialData(period = "all") {
  if (!window.currentUser) throw new Error("Usuario no autenticado");
  const uid = window.currentUser.uid;

  debugLog(" Cargando TODOS los datos sin filtrar...");

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

      // OK CAMPOS FINANCIEROS
      totalMiles: Number(data.totalMiles || 0),
      totalCharge: Number(data.totalCharge || 0),
      netProfit: Number(data.netProfit || 0),
      rpm: Number(data.rpm || 0),
      operatingCost: Number(data.operatingCost || 0),
      fuelCost: Number(data.fuelCost || 0),
      tolls: Number(data.tolls || 0),
      otherCosts: Number(data.otherCosts || 0),
      loadedMiles: Number(data.loadedMiles || 0),

      // OK CAMPOS DE PAGO - ESTE ES EL FIX PRINCIPAL
      paymentStatus: data.paymentStatus || "pending",
      actualPaymentDate: data.actualPaymentDate || null,    // [TARGET] CAMPO CRTICO
      paymentDate: data.paymentDate || null,
      expectedPaymentDate: data.expectedPaymentDate || null
    };
  });

  // Procesar para aadir campos de pago faltantes
  allFinancesData = ensurePaymentFields(allFinancesData);

  // Actualizar variables globales para compatibilidad
  window.allFinancesData = allFinancesData;

  // Filtrar por perodo si se especifica
  let filteredData = allFinancesData;
  if (period !== "all") {
    filteredData = allFinancesData.filter(load => {
      const loadDate = load.date;
      if (period.includes("-")) {
        // Formato YYYY-MM
        return loadDate.startsWith(period);
      } else {
        // Solo ao YYYY
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
      deductible: data.deductible !== undefined ? data.deductible : true
    };
  });

  // Filtrar gastos por perodo
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

  debugLog(`OK Datos cargados: ${filteredData.length} cargas, ${filteredExpenses.length} gastos`);
  debugLog(` Cargas con actualPaymentDate: ${allFinancesData.filter(load => load.actualPaymentDate).length}`);

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
}
*/

// ========================================
// MOVED TO finances-core.js
// ========================================
// getItemPeriodUTC - now in finances-core.js
// debugFinances - now in finances-core.js

// ========================================
// MOVED TO finances-core.js
// ========================================
/*
// normalizeDate - NOW IN finances-core.js
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
    return `${y}-${m}`; //  por defecto mes en local time
  } catch {
    return null;
  }
}
*/

// ========================================
// MOVED TO finances-data.js
// ========================================
/*
// loadFinancesData - NOW IN finances-data.js (as loadFinancialData)
async function loadFinancesData(period = "all", forceReload = false) {
  if (!window.currentUser) {
    debugLog(" No hay usuario autenticado");
    return;
  }
  const uid = window.currentUser.uid;

  // --- CACHE: si ya cargamos datos y no forzamos recarga, filtrar en memoria ---
  if (!forceReload && window.financesLoaded &&
      Array.isArray(window._allFinancesRaw) && Array.isArray(window._allExpensesRaw)) {
    debugLog('[FINANCES] Usando cache en memoria (sin Firestore)');
    const filteredLoads = period === 'all'
      ? window._allFinancesRaw
      : window._allFinancesRaw.filter(l => l.date.startsWith(period));
    const filteredExpenses = period === 'all'
      ? window._allExpensesRaw
      : window._allExpensesRaw.filter(e => e.date.startsWith(period));
    window.financesData = filteredLoads;
    window.expensesData = filteredExpenses;
    window.currentFinancesData = { loads: filteredLoads, expenses: filteredExpenses };
    const kpis = calculateKPIs(filteredLoads, filteredExpenses);
    return { kpis, expenses: filteredExpenses, loads: filteredLoads };
  }

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

  // Guardar copia completa para cache
  window._allFinancesRaw = window.financesData;
  window._allExpensesRaw = window.expensesData;

  debugLog(" Loads guardadas en memoria:", window.financesData.length);
  debugLog(" Expenses guardadas en memoria:", window.expensesData.length);

  // === 3. Filtrar por período (si aplica) ===
  const filteredLoads = (period === "all")
    ? window.financesData
    : window.financesData.filter(l => l.date.startsWith(period));

  const filteredExpenses = (period === "all")
    ? window.expensesData
    : window.expensesData.filter(e => e.date.startsWith(period));

  // === 4. Calcular KPIs ===
  const kpis = calculateKPIs(filteredLoads, filteredExpenses);

  // === 5. Actualizar cache y flags ===
  window.financesLoaded = true;
  window.currentFinancesData = { loads: filteredLoads, expenses: filteredExpenses };

  // === 6. Devolver datos para usar en .then() ===
  return {
    kpis,
    expenses: filteredExpenses,
    loads: filteredLoads
  };
}
*/

// ==============================
//  FUNCIN updateExpenseCategories SIMPLIFICADA
// ==============================
function updateExpenseCategories(expenses = []) {
  debugLog(" Actualizando categorias de gastos...");

  const categories = calculateExpenseCategories(expenses);
  debugLog("OK Categorias calculadas:", categories);

  // Las categoras se procesan para la tabla de gastos y grficos
  // Ya NO intentamos actualizar elementos DOM individuales
  return categories;
}

// ========================================
// FUNCIONES DE ORDENAMIENTO (Agregadas en finances.js)
// ========================================

function sortExpensesBy(column) {
  if (window.currentExpenseSort.column === column) {
    window.currentExpenseSort.asc = !window.currentExpenseSort.asc;
  } else {
    window.currentExpenseSort.column = column;
    window.currentExpenseSort.asc = true;

    if (column === 'date' || column === 'amount') {
      window.currentExpenseSort.asc = false;
    }
  }

  updateExpenseSortIcons();

  // Recargar datos para aplicar ordenamiento
  // loadFinancesData llama a renderExpensesList al final
  loadFinancesData().then(() => {
    // Asegurar renderizado si loadFinancesData no lo hace directamente
    if (window.expensesData) {
      renderExpensesList(window.expensesData);
    }
  });
}

function updateExpenseSortIcons() {
  ['date', 'type', 'description', 'amount'].forEach(col => {
    const icon = document.getElementById(`sort-exp-${col}`);
    if (icon) {
      if (window.currentExpenseSort.column === col) {
        icon.textContent = window.currentExpenseSort.asc ? '↑' : '↓';
        icon.className = 'ml-1 text-blue-600 font-bold';
      } else {
        icon.textContent = '↕';
        icon.className = 'ml-1 text-gray-400';
      }
    }
  });
}

// Exportar globalmente
window.sortExpensesBy = sortExpensesBy;
window.updateExpenseSortIcons = updateExpenseSortIcons;

// OK FUNCIN INDEPENDIENTE PARA RENDERIZAR GASTOS
function renderExpensesList(filteredExpenses = []) {
  const expensesList = document.getElementById("expensesList");
  if (!expensesList) return;

  if (!filteredExpenses || filteredExpenses.length === 0) {
    expensesList.innerHTML = `
            <tr>
                <td colspan="5" class="p-4 text-center text-gray-500">
                    ${window.i18n?.t('finances.no_expenses_period') || 'No expenses registered for this period'}
                </td>
            </tr>`;
    return;
  }

  const sortedExpenses = filteredExpenses
    .sort((a, b) => {
      const { column, asc } = window.currentExpenseSort;
      let valA = a[column];
      let valB = b[column];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (column === 'amount') {
        return asc ? (parseFloat(valA) - parseFloat(valB)) : (parseFloat(valB) - parseFloat(valA));
      }

      if (column === 'date') {
        const dateA = new Date(valA || '1970-01-01');
        const dateB = new Date(valB || '1970-01-01');
        return asc ? dateA - dateB : dateB - dateA;
      }

      return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    })
    .slice(0, 10);

  const categoryIcons = {
    fuel: "", maintenance: "", food: "", lodging: "",
    tolls: "", insurance: "", permits: "", other: ""
  };

  const rows = sortedExpenses.map(expense => `
        <tr class="bg-red-50 hover:bg-red-100 transition-colors">
            <td class="px-4 py-3 text-sm whitespace-nowrap">${expense.date || "-"}</td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">${categoryIcons[expense.type] || ""} ${expense.type}</td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">${expense.description || "-"}</td>
            <td class="px-4 py-3 text-sm font-semibold text-red-700 whitespace-nowrap">${formatCurrency(expense.amount)}</td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">
                <button onclick="editExpense('${expense.id}')" class="text-blue-600 hover:text-blue-800 font-medium mr-3">${window.i18n?.t('finances.btn_edit') || 'Edit'}</button>
                <button onclick="deleteExpense('${expense.id}')" class="text-red-600 hover:text-red-800 font-medium">${window.i18n?.t('finances.btn_delete') || 'Delete'}</button>
            </td>
        </tr>
    `);

  expensesList.innerHTML = rows.join("");
  debugFinances(`OK Lista de gastos renderizada: ${rows.length} elementos`);
}


// ========================================
// CHARTS FUNCTIONS - NOW LAZY LOADED
// ========================================
// These functions have been moved to finances-charts.js
// They are loaded on-demand when the user opens the Finances tab
// Use the lazy wrappers below instead

/*
// COMMENTED OUT - Now in finances-charts.js (lazy loaded)
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
    }

    debugFinances("✅ Gráficos actualizados exitosamente");
  } catch (error) {
    debugFinances("❌ Error actualizando gráficos:", error);
  }
}

function updateCashFlowChart() { ... }
function updateExpenseBreakdownChart() { ... }
function updateLoadDistributionChart() { ... }
// ... (all chart functions are now in finances-charts.js)
*/

// ========================================
// LAZY LOADING WRAPPERS FOR CHARTS
// ========================================

/**
 * Wrapper for updateFinancialCharts with lazy loading
 * Loads finances-charts.js on demand, then calls the function
 */
async function updateFinancialCharts(context = "global") {
  if (typeof window.loadChartsModule === 'function') {
    try {
      await window.loadChartsModule();
      if (window.FinancesCharts && window.FinancesCharts.updateFinancialCharts) {
        window.FinancesCharts.updateFinancialCharts(context);
      }
    } catch (error) {
      debugLog('Error loading charts module:', error);
    }
  } else {
    debugLog('Lazy loader not available, charts module cannot be loaded');
  }
}

/**
 * Wrapper for updateCashFlowChart with lazy loading
 */
async function updateCashFlowChart() {
  if (typeof window.loadChartsModule === 'function') {
    try {
      await window.loadChartsModule();
      if (window.FinancesCharts && window.FinancesCharts.updateCashFlowChart) {
        window.FinancesCharts.updateCashFlowChart();
      }
    } catch (error) {
      debugLog('Error loading charts module:', error);
    }
  }
}

/**
 * Wrapper for updateExpenseBreakdownChart with lazy loading
 */
async function updateExpenseBreakdownChart() {
  if (typeof window.loadChartsModule === 'function') {
    try {
      await window.loadChartsModule();
      if (window.FinancesCharts && window.FinancesCharts.updateExpenseBreakdownChart) {
        window.FinancesCharts.updateExpenseBreakdownChart();
      }
    } catch (error) {
      debugLog('Error loading charts module:', error);
    }
  }
}

/**
 * Wrapper for updateLoadDistributionChart with lazy loading
 */
async function updateLoadDistributionChart() {
  if (typeof window.loadChartsModule === 'function') {
    try {
      await window.loadChartsModule();
      if (window.FinancesCharts && window.FinancesCharts.updateLoadDistributionChart) {
        window.FinancesCharts.updateLoadDistributionChart();
      }
    } catch (error) {
      debugLog('Error loading charts module:', error);
    }
  }
}

// =============================================
// SUBSCRIBE TO LANGUAGE CHANGES (Observer pattern)
// Loads charts module on demand so labels update
// even if Finances tab was never opened yet
// =============================================
(function registerChartLanguageObserver() {
  async function refreshCharts() {
    if (window.FinancesCharts) {
      // Charts module already loaded → update directly
      window.FinancesCharts.updateExpenseBreakdownChart();
      window.FinancesCharts.updateLoadDistributionChart();
      window.FinancesCharts.updateCashFlowChart();
    } else if (typeof window.loadChartsModule === 'function') {
      // Charts module not yet loaded → load it first then update
      try {
        await window.loadChartsModule();
        if (window.FinancesCharts) {
          window.FinancesCharts.updateExpenseBreakdownChart();
          window.FinancesCharts.updateLoadDistributionChart();
          window.FinancesCharts.updateCashFlowChart();
        }
      } catch (e) {
        debugLog('[FINANCES] Error loading charts module on language change:', e);
      }
    }
  }

  if (window.i18n && typeof window.i18n.subscribe === 'function') {
    window.i18n.subscribe(refreshCharts);
    debugLog('[FINANCES] Subscribed to language changes via Observer');
  } else {
    document.addEventListener('languageChanged', refreshCharts);
    debugLog('[FINANCES] Subscribed to languageChanged event (fallback)');
  }
})();

function updateBusinessMetrics() {
  debugFinances(" Actualizando mtricas de negocio...");

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
      debugFinances(`OK Mtrica actualizada ${id}: ${value}`);
    }
  });

  // Debug agrupado
  debugFinances(" Totales calculados:", {
    totalMiles,
    totalLoadedMiles,
    totalRevenue,
    totalExpenses,
    costPerMile,
    averageRPM,
    efficiency
  });
}

// ========================================
// MOVED TO finances-core.js (1st instance)
// ========================================
// calculateKPIs - NOW IN finances-core.js
// This was the first of TWO duplicate definitions
// Second duplicate at line ~1978 also removed

function showFinancesMessage(message, type = "info") {
  debugFinances(` Mensaje: ${message} (${type})`);

  if (typeof showMessage === "function") {
    showMessage(message, type);
  } else {
    switch (type) {
      case "error":
        debugLog(" Finances:", message);
        break;
      case "success":
        debugLog("OK Finances:", message);
        break;
      case "warning":
        debugLog(" Finances:", message);
        break;
      default:
        debugLog(" Finances:", message);
    }
  }
}

function showFinancesLoading() {
  debugFinances(" Mostrando estado de carga...");

  // Todos los elementos que deberan mostrar '...'
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
  debugFinances("OK Finalizando estado de carga (sin reset de valores)");

  //  Si ms adelante quieres manejar spinners, este es el lugar
  const loadingEls = document.querySelectorAll(".finances-loading");
  loadingEls.forEach(el => el.classList.add("hidden"));
}


function openExpenseModal(expense = null) {
  debugFinances(" Abriendo modal de gastos...");
  const modal = document.getElementById('expenseModal');
  if (!modal) {
    debugFinances(" Modal de gastos no encontrado");
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
    //  Editar gasto existente
    dateEl.value = expense.date || new Date().toISOString().split('T')[0];
    typeEl.value = expense.type || "";
    descEl.value = expense.description || "";
    amountEl.value = expense.amount || 0;
  } else {
    //  Nuevo gasto
    dateEl.value = new Date().toISOString().split('T')[0];
    typeEl.value = "";
    descEl.value = "";
    amountEl.value = "";
  }
}

function closeExpenseModal() {
  debugFinances(" Cerrando modal de gastos...");
  const modal = document.getElementById("expenseModal");
  if (!modal) return;

  // Ocultar modal
  modal.classList.add("hidden");

  // Resetear modo edicin
  modal.dataset.editId = "";

  // Limpiar campos del formulario
  const fields = ["expenseDate", "expenseType", "expenseDescription", "expenseAmount"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function saveExpenseToFirebase() {
  // ✅ VERIFICAR QUE LOS ELEMENTOS EXISTEN PRIMERO
  const amountEl = document.getElementById("expenseAmount");
  const typeEl = document.getElementById("expenseType");
  const descEl = document.getElementById("expenseDescription");
  const dateEl = document.getElementById("expenseDate");

  // Verificación de elementos antes de acceder a .value
  if (!amountEl || !typeEl || !descEl || !dateEl) {
    debugLog("❌ Elementos del formulario de gastos no encontrados");
    showFinancesMessage(window.i18n?.t('finances.form_not_available') || "Error: Formulario no disponible. Intenta recargar la página.", "error");
    return;
  }

  const amount = parseFloat(amountEl.value.trim());
  const type = typeEl.value.trim().toLowerCase();
  const description = descEl.value.trim();
  const date = dateEl.value;

  if (!window.currentUser) {
    showFinancesMessage(window.i18n?.t('finances.sign_in_required') || "Debe iniciar sesión", "error");
    return;
  }

  if (!amount || amount <= 0 || !type || !date) {
    showFinancesMessage(window.i18n?.t('finances.all_fields_required') || "Todos los campos son obligatorios", "error");
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
      debugFinances(` Gasto actualizado (${editId}):`, expense);
      showFinancesMessage(" Gasto editado correctamente", "success");
      if (window.showToast) {
        showToast('✅ Gasto actualizado exitosamente', 'success');
      }
    } else {
      const docRef = await firebase.firestore().collection("expenses").add(expense);
      debugFinances(`OK Gasto agregado (${docRef.id}):`, expense);
      showFinancesMessage("OK Gasto agregado correctamente", "success");
      if (window.showToast) {
        showToast('✅ Gasto guardado exitosamente', 'success');
      }
    }

    if (modal) modal.dataset.editId = ""; // reset
    closeExpenseModal();
    loadFinancesData('all', true); // forceReload: gasto guardado, invalidar cache
  } catch (error) {
    debugFinances(" Error guardando gasto:", error);
    showFinancesMessage(" No se pudo guardar el gasto", "error");
    if (window.showToast) {
      showToast('❌ Error al guardar el gasto', 'error');
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function deleteExpense(id) {
  if (!id) {
    showFinancesMessage(" ID de gasto no vlido", "error");
    return;
  }

  const confirmDelete = confirm(window.i18n?.t('finances.confirm_delete_expense') || 'Are you sure you want to delete this expense?');
  if (!confirmDelete) return;

  try {
    await firebase.firestore().collection("expenses").doc(id).delete();
    debugFinances(` Gasto eliminado (${id})`);
    showFinancesMessage("OK Gasto eliminado correctamente", "success");
    if (window.showToast) {
      showToast('✅ Gasto eliminado exitosamente', 'success');
    }
    loadFinancesData('all', true); // forceReload: gasto eliminado, invalidar cache
  } catch (error) {
    debugFinances(" Error al eliminar gasto:", error);
    showFinancesMessage(" No se pudo eliminar el gasto", "error");
    if (window.showToast) {
      showToast('❌ Error al eliminar el gasto', 'error');
    }
  }
}

async function editExpense(id) {
  try {
    const doc = await firebase.firestore().collection("expenses").doc(id).get();

    if (!doc.exists) {
      showFinancesMessage(" Gasto no encontrado", "error");
      return;
    }

    const exp = { id, ...doc.data() };

    // Guardar ID de edicin en el modal
    const modal = document.getElementById("expenseModal");
    if (modal) modal.dataset.editId = id;

    // Reutilizar openExpenseModal con datos cargados
    openExpenseModal(exp);

    debugFinances(` Editando gasto (${id}):`, exp);
  } catch (err) {
    debugFinances(" Error al editar gasto:", err);
    showFinancesMessage(" No se pudo cargar el gasto", "error");
  }
}

// ========================================
// MOVED TO finances-reports.js
// ========================================
// generatePLReport() - now in finances-reports.js
// generateTaxReport() - now in finances-reports.js
// exportReportToPDF() - now in finances-reports.js
// printReport() - now in finances-reports.js
// openReportModal() - now in finances-reports.js
// closeReportModal() - now in finances-reports.js

function generatePLReport() {
  debugLog(" Generando Estado de Resultados Profesional...");

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

  // Perodo legible
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los perodos";
  if (year && month) {
    const monthNames = {
      "01": window.i18n?.t('common.month_jan')||'January', "02": window.i18n?.t('common.month_feb')||'February', "03": window.i18n?.t('common.month_mar')||'March', "04": window.i18n?.t('common.month_apr')||'April',
      "05": window.i18n?.t('common.month_may')||'May', "06": window.i18n?.t('common.month_jun')||'June', "07": window.i18n?.t('common.month_jul')||'July', "08": window.i18n?.t('common.month_aug')||'August',
      "09": window.i18n?.t('common.month_sep')||'September', "10": window.i18n?.t('common.month_oct')||'October', "11": window.i18n?.t('common.month_nov')||'November', "12": window.i18n?.t('common.month_dec')||'December'
    };
    periodLabel = `${monthNames[month]} ${year}`;
  } else if (year) {
    periodLabel = `Ao ${year}`;
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

  // Desglose de gastos por categora
  const categories = {};
  filteredExpenses.forEach(exp => {
    const type = (exp.type || "other").toLowerCase();
    categories[type] = (categories[type] || 0) + (Number(exp.amount) || 0);
  });

  const t = (k, fb) => { const v = window.i18n?.t(k); return (v && v !== k) ? v : fb; };
  const categoryLabels = {
    fuel:        `🚚 ${t('finances.expense_fuel',        'Fuel')}`,
    maintenance: `🔧 ${t('finances.expense_maintenance', 'Maintenance')}`,
    food:        `🍔 ${t('finances.expense_food',        'Food')}`,
    lodging:     `🏨 ${t('finances.expense_lodging',     'Lodging')}`,
    tolls:       `🛣️ ${t('finances.expense_tolls',       'Tolls')}`,
    insurance:   `🛡️ ${t('finances.expense_insurance',   'Insurance')}`,
    permits:     `📄 ${t('finances.expense_permits',     'Permits')}`,
    carpayment:  `🚗 ${t('finances.expense_car_payment', 'Car Payment')}`,
    other:       `📌 ${t('finances.expense_other',       'Other')}`
  };

  // Anlisis de distribucin de cargas
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
    debugLog(" Contenedor reportContent no encontrado");
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
      <h1 class="text-3xl font-bold text-gray-900 mb-2"> Estado de Resultados</h1>
      <h2 class="text-xl text-blue-600 font-semibold mb-2">Expediter Load Calculator</h2>
      <p class="text-gray-600">Perodo: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-sm text-gray-500">Generado el ${currentDate}</p>
    </div>

    <!-- Resumen ejecutivo -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white dark:bg-gray-800 border-l-4 border-gray-400 p-4 rounded-r-lg shadow-sm">
        <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">💰 Ingresos Totales</h3>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">${formatCurrency(totalRevenue)}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">${totalLoads} Cargas completadas</p>
      </div>
      
      <div class="bg-white dark:bg-gray-800 border-l-4 border-gray-400 p-4 rounded-r-lg shadow-sm">
        <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">📉 Gastos Totales</h3>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">${formatCurrency(totalExpenses)}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Gastos operativos reales</p>
      </div>
      
      <div class="bg-white dark:bg-gray-800 border-l-4 border-gray-400 p-4 rounded-r-lg shadow-sm">
        <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">📈 Ganancia Neta</h3>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">${formatCurrency(netProfit)}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Margen: ${margin.toFixed(1)}%</p>
      </div>
    </div>

    <!-- Mtricas operativas -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4"> Metricas Operativas</h3>
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
      <h3 class="text-xl font-bold text-gray-900 mb-4"> Desglose de Gastos</h3>
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
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

    <!-- Anlisis de cargas -->
    <div class="mb-8">
      <h3 class="text-xl font-bold text-gray-900 mb-4"> Analisis de Cargas por Distancia</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center shadow-sm">
          <p class="text-sm text-gray-500 dark:text-gray-400">Cargas Cortas (&lt;300 mi)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">${shortHauls}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">${totalLoads > 0 ? ((shortHauls / totalLoads) * 100).toFixed(1) : 0}% del total</p>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center shadow-sm">
          <p class="text-sm text-gray-500 dark:text-gray-400">Cargas Medianas (300-600 mi)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">${mediumHauls}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">${totalLoads > 0 ? ((mediumHauls / totalLoads) * 100).toFixed(1) : 0}% del total</p>
        </div>
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center shadow-sm">
          <p class="text-sm text-gray-500 dark:text-gray-400">Cargas Largas (&gt;600 mi)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">${longHauls}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">${totalLoads > 0 ? ((longHauls / totalLoads) * 100).toFixed(1) : 0}% del total</p>
        </div>
      </div>
    </div>
  `;

  // Actualizar subtítulo del modal con el período
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

  debugLog("OK Estado de Resultados profesional generado");
}

function generateTaxReport() {
  debugLog("🇺🇸 Generando Reporte Fiscal IRS Schedule C...");

  openReportModal('tax', 'IRS Schedule C — Tax Report', 'Calculating deductions...', '🇺🇸');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;"><div style="width:48px;height:48px;border:4px solid #ca8a04;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;"></div><p style="color:#4b5563;font-weight:bold;">Calculating Schedule C deductions...</p></div>';
  }

  const year = document.getElementById("reportYear")?.value || new Date().getFullYear().toString();
  const homeState = document.getElementById("reportHomeState")?.value || "FL";

  // ─── Ensure all data is loaded (loads + expenses unfiltered) ────────
  _ensureTaxData(year).then(({ loads, expenses }) => {
    _renderTaxReport(reportContent, year, homeState, loads, expenses);
    // Update subtitle after render to win race against lazy openReportModal
    const periodLabel = `Tax Year ${year} (Jan 1 – Dec 31)`;
    setTimeout(() => {
      const subEl = document.getElementById("reportModalSubtitle");
      if (subEl) subEl.textContent = periodLabel;
    }, 200);
  }).catch(() => {
    if (reportContent) {
      reportContent.innerHTML = '<div style="text-align:center;padding:48px;color:#ef4444;"><span style="font-size:2.5rem;display:block;margin-bottom:12px;">⚠️</span><p>No data available to generate the tax report.</p></div>';
    }
  });
}

async function _ensureTaxData(year) {
  // Use cached all-data if available and populated
  if (window.allFinancesData?.length > 0 && window.allExpensesData?.length >= 0) {
    return {
      loads: window.allFinancesData.filter(l => l.date && l.date.startsWith(year)),
      expenses: window.allExpensesData.filter(e => e.date && e.date.startsWith(year))
    };
  }
  // Fallback: load directly from Firestore (covers "direct to Reports" case)
  if (!window.currentUser) throw new Error('Not authenticated');
  const uid = window.currentUser.uid;
  const [loadsSnap, expSnap] = await Promise.all([
    window.db.collection('loads').where('userId', '==', uid).get(),
    window.db.collection('expenses').where('userId', '==', uid).get()
  ]);
  const allLoads = loadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allExpenses = expSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      date: data.date || new Date().toISOString().split('T')[0],
      amount: Number(data.amount || 0),
      type: data.type || '',
      description: data.description || '',
      deductible: data.deductible !== undefined ? data.deductible : true
    };
  });
  // Cache for reuse
  window.allFinancesData = allLoads;
  window.allExpensesData = allExpenses;
  return {
    loads: allLoads.filter(l => l.date && l.date.startsWith(year)),
    expenses: allExpenses.filter(e => e.date && e.date.startsWith(year))
  };
}

function _renderTaxReport(reportContent, year, homeState, filteredLoads, filteredExpenses) {

  // ─── State Income Tax Table (2024/2025) ─────────────────────────────
  const STATE_TAX = {
    AL:{rate:0.0495,name:"Alabama",note:"Top bracket 4.95%"},
    AK:{rate:0,name:"Alaska",note:"No state income tax"},
    AZ:{rate:0.025,name:"Arizona",note:"Flat 2.5% (2023+)"},
    AR:{rate:0.047,name:"Arkansas",note:"Top bracket 4.7%"},
    CA:{rate:0.093,name:"California",note:"Top bracket up to 13.3%. Rate shown: 9.3% for ~$65k–$338k"},
    CO:{rate:0.044,name:"Colorado",note:"Flat 4.4%"},
    CT:{rate:0.0699,name:"Connecticut",note:"Top bracket 6.99%"},
    DE:{rate:0.066,name:"Delaware",note:"Top bracket 6.6%"},
    FL:{rate:0,name:"Florida",note:"No state income tax"},
    GA:{rate:0.0549,name:"Georgia",note:"Flat 5.49% (2024)"},
    HI:{rate:0.11,name:"Hawaii",note:"Top bracket 11%"},
    ID:{rate:0.058,name:"Idaho",note:"Flat 5.8%"},
    IL:{rate:0.0495,name:"Illinois",note:"Flat 4.95%"},
    IN:{rate:0.0305,name:"Indiana",note:"Flat 3.05%"},
    IA:{rate:0.038,name:"Iowa",note:"Flat 3.8% (2025)"},
    KS:{rate:0.057,name:"Kansas",note:"Top bracket 5.7%"},
    KY:{rate:0.04,name:"Kentucky",note:"Flat 4.0%"},
    LA:{rate:0.0425,name:"Louisiana",note:"Top bracket 4.25%"},
    ME:{rate:0.0715,name:"Maine",note:"Top bracket 7.15%"},
    MD:{rate:0.0575,name:"Maryland",note:"5.75% + county tax (~3%)"},
    MA:{rate:0.05,name:"Massachusetts",note:"Flat 5.0%"},
    MI:{rate:0.0405,name:"Michigan",note:"Flat 4.05%"},
    MN:{rate:0.0985,name:"Minnesota",note:"Top bracket 9.85%"},
    MS:{rate:0.05,name:"Mississippi",note:"Flat 5.0%"},
    MO:{rate:0.0495,name:"Missouri",note:"Top bracket 4.95%"},
    MT:{rate:0.0675,name:"Montana",note:"Top bracket 6.75%"},
    NE:{rate:0.0584,name:"Nebraska",note:"Top bracket 5.84%"},
    NV:{rate:0,name:"Nevada",note:"No state income tax"},
    NH:{rate:0,name:"New Hampshire",note:"No state income tax (wages)"},
    NJ:{rate:0.1075,name:"New Jersey",note:"Top bracket 10.75%"},
    NM:{rate:0.059,name:"New Mexico",note:"Top bracket 5.9%"},
    NY:{rate:0.109,name:"New York",note:"Top bracket 10.9% (+ NYC up to 3.876%)"},
    NC:{rate:0.045,name:"North Carolina",note:"Flat 4.5%"},
    ND:{rate:0.025,name:"North Dakota",note:"Top bracket 2.5%"},
    OH:{rate:0.0399,name:"Ohio",note:"Top bracket 3.99%"},
    OK:{rate:0.0475,name:"Oklahoma",note:"Top bracket 4.75%"},
    OR:{rate:0.099,name:"Oregon",note:"Top bracket 9.9%"},
    PA:{rate:0.0307,name:"Pennsylvania",note:"Flat 3.07%"},
    RI:{rate:0.0599,name:"Rhode Island",note:"Top bracket 5.99%"},
    SC:{rate:0.064,name:"South Carolina",note:"Top bracket 6.4%"},
    SD:{rate:0,name:"South Dakota",note:"No state income tax"},
    TN:{rate:0,name:"Tennessee",note:"No state income tax (wages)"},
    TX:{rate:0,name:"Texas",note:"No state income tax"},
    UT:{rate:0.0465,name:"Utah",note:"Flat 4.65%"},
    VT:{rate:0.0875,name:"Vermont",note:"Top bracket 8.75%"},
    VA:{rate:0.0575,name:"Virginia",note:"Top bracket 5.75%"},
    WA:{rate:0,name:"Washington",note:"No state income tax"},
    WV:{rate:0.065,name:"West Virginia",note:"Top bracket 6.5%"},
    WI:{rate:0.0765,name:"Wisconsin",note:"Top bracket 7.65%"},
    WY:{rate:0,name:"Wyoming",note:"No state income tax"}
  };
  const stateInfo = STATE_TAX[homeState] || {rate:0,name:homeState,note:""};

  const periodLabel = `Tax Year ${year} (Jan 1 – Dec 31)`;

  // ─── IRS Mileage Rates ───────────────────────────────────────────────
  const mileageRates = { "2022": 0.585, "2023": 0.655, "2024": 0.67, "2025": 0.70 };
  const mileageRate = mileageRates[year] || 0.70;

  // ─── Part I — Income ────────────────────────────────────────────────
  const grossReceipts = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);

  // ─── Expense Buckets ────────────────────────────────────────────────
  const exp = {
    fuel: 0, tolls: 0, insurance: 0, maintenance: 0, permits: 0,
    food: 0, lodging: 0, carPayment: 0, tires: 0, repairs: 0, other: 0
  };

  filteredExpenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    const type = (e.type || "other").toLowerCase();
    switch (type) {
      case 'fuel':        exp.fuel += amt; break;
      case 'tolls':       exp.tolls += amt; break;
      case 'insurance':   exp.insurance += amt; break;
      case 'maintenance': exp.maintenance += amt; break;
      case 'permits':     exp.permits += amt; break;
      case 'food':        exp.food += amt; break;
      case 'lodging':     exp.lodging += amt; break;
      case 'carpayment':  exp.carPayment += amt; break;
      case 'tires':       exp.tires += amt; break;
      case 'repairs':     exp.repairs += amt; break;
      default:            exp.other += amt; break;
    }
  });

  // DOT-regulated drivers: meals 80% deductible (IRC §274(n)(3)), not 50%
  const mealsDeductible = exp.food * 0.80;
  const lodgingDeductible = exp.lodging; // 100%

  // Standard Mileage vs Actual
  const standardMileageDeduction = totalMiles * mileageRate;
  const actualVehicleExpenses = exp.fuel + exp.maintenance + exp.tires + exp.repairs + exp.insurance + exp.permits;
  const useStandard = standardMileageDeduction >= actualVehicleExpenses;

  // Line 9 — Car & Truck
  const line9 = useStandard ? standardMileageDeduction : actualVehicleExpenses;
  // Line 15 — Insurance (only under actual)
  const line15 = useStandard ? 0 : exp.insurance;
  // Line 21 — Repairs & Maintenance (only under actual)
  const line21 = useStandard ? 0 : (exp.maintenance + exp.tires + exp.repairs);
  // Line 23 — Taxes & Licenses (only under actual)
  const line23 = useStandard ? 0 : exp.permits;
  // Line 24a — Travel (lodging, 100%)
  const line24a = lodgingDeductible;
  // Line 24b — Deductible Meals (80% DOT rule)
  const line24b = mealsDeductible;
  // Line 27a — Other (tolls always deductible; car payment goes here as note)
  const line27a = exp.tolls + exp.other;

  // Line 28 — Total expenses
  const line28 = line9 + line15 + line21 + line23 + line24a + line24b + line27a;
  // Line 29 — Tentative profit (no home-office here)
  const line29 = grossReceipts - line28;
  // Line 31 — Net profit
  const netProfit = line29;

  // ─── Schedule SE ────────────────────────────────────────────────────
  // Line 2: net profit from Sch C
  // Line 4a: net earnings × 92.35%
  const netEarningsSE = Math.max(0, netProfit) * 0.9235;
  const ssTaxableWageBase = year >= "2024" ? 168600 : 160200;
  const ssWages = Math.min(netEarningsSE, ssTaxableWageBase);
  const ssTax = ssWages * 0.124;          // 12.4% Social Security
  const medicareTax = netEarningsSE * 0.029; // 2.9% Medicare (no cap)
  const additionalMedicare = Math.max(0, netEarningsSE - 200000) * 0.009; // 0.9% Additional Medicare
  const totalSETax = ssTax + medicareTax + additionalMedicare;
  const deductibleSETax = totalSETax * 0.5;

  // ─── QBI (Section 199A) — 20% deduction ────────────────────────────
  const qbiDeduction = Math.max(0, netProfit - deductibleSETax) * 0.20;

  // ─── Estimated Tax (25% safe harbor estimate) ───────────────────────
  const adjustedGrossIncome = netProfit - deductibleSETax;
  const estimatedIncomeTax = adjustedGrossIncome > 0
    ? Math.max(0, adjustedGrossIncome - qbiDeduction) * 0.22
    : 0; // simplified 22% bracket estimate
  const totalEstimatedTax = estimatedIncomeTax + totalSETax;
  const quarterlyPayment = totalEstimatedTax / 4;

  // ─── Monthly mileage breakdown ───────────────────────────────────────
  const monthlyMiles = {};
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  filteredLoads.forEach(l => {
    if (!l.date) return;
    const mo = parseInt(l.date.split('-')[1], 10) - 1;
    monthlyMiles[mo] = (monthlyMiles[mo] || 0) + (Number(l.totalMiles) || 0);
  });

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n) => n.toLocaleString('en-US');

  const container = document.getElementById("reportContent");
  if (!container) return;

  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.maxWidth = '900px';
  container.style.margin = '0 auto';
  container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
  container.className = 'report-container';

  container.innerHTML = `
  <div id="irs-report-root">
  <style>
    #irs-report-root, #irs-report-root * {
      color: #000 !important;
      background-color: transparent !important;
      font-family: 'Arial', sans-serif !important;
      box-sizing: border-box !important;
      text-shadow: none !important;
      -webkit-text-fill-color: #000 !important;
    }
    #irs-report-root table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    #irs-report-root th, #irs-report-root td { border: 1px solid #000; padding: 6px 8px; font-size: 11px; }
    #irs-report-root th { font-weight: bold; background-color: #f0f0f0 !important; text-transform: uppercase; font-size: 10px; }
    #irs-report-root .val { text-align: right; font-family: 'Courier New', monospace !important; font-weight: bold; }
    #irs-report-root .sec-header {
      background-color: #1e3a5f !important;
      color: #fff !important; -webkit-text-fill-color: #fff !important;
      font-weight: bold; font-size: 12px; padding: 5px 10px;
      border: 1px solid #000; margin: 16px 0 0 0;
      text-transform: uppercase; letter-spacing: 1px;
    }
    #irs-report-root .highlight-row { background-color: #fffbeb !important; font-weight: bold; }
    #irs-report-root .total-row { background-color: #f0f0f0 !important; font-weight: bold; }
    #irs-report-root .net-row { background-color: #dcfce7 !important; font-weight: bold; }
    #irs-report-root .warning-row { background-color: #fef3c7 !important; }
    #irs-report-root .note { font-size: 10px; color: #555 !important; -webkit-text-fill-color: #555 !important; font-style: italic; }
    #irs-report-root .badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 10px; font-weight: bold; border: 1px solid #000;
    }
    #irs-report-root .badge-green { background-color: #dcfce7 !important; }
    #irs-report-root .badge-blue  { background-color: #dbeafe !important; }
    #irs-report-root .badge-red   { background-color: #fee2e2 !important; }
    #irs-report-root .page-divider { border-top: 3px solid #000; margin: 24px 0 16px; }
    @media print {
      .no-print { display: none !important; }
      #irs-report-root { padding: 0 !important; box-shadow: none !important; }
    }
  </style>

  <!-- ═══════════════════════════════════════════════════════════
       HEADER — Schedule C (Form 1040)
  ════════════════════════════════════════════════════════════ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:12px;">
    <div style="font-size:11px;line-height:1.6;">
      <div style="font-size:18px;font-weight:900;">SCHEDULE C</div>
      <div style="font-size:14px;font-weight:bold;">(Form 1040)</div>
      <div>Department of the Treasury</div>
      <div>Internal Revenue Service</div>
    </div>
    <div style="text-align:center;flex:1;padding:0 20px;">
      <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">Profit or Loss From Business</div>
      <div style="font-size:14px;font-weight:bold;margin:4px 0;">(Sole Proprietorship)</div>
      <div style="font-size:10px;">▶ Attach to Form 1040, 1040-SR, or 1040-NR. ▶ Go to <u>www.irs.gov/ScheduleC</u> for instructions.</div>
    </div>
    <div style="text-align:right;font-size:11px;line-height:1.6;">
      <div style="font-size:13px;font-weight:bold;">OMB No. 1545-0074</div>
      <div style="font-size:28px;font-weight:900;line-height:1;">${year}</div>
      <div>Attachment Sequence No. 09</div>
    </div>
  </div>

  <!-- ─── Business Info Lines A–I ─────────────────────────────────── -->
  <table style="font-size:11px;margin-bottom:4px;">
    <tr>
      <td style="width:60%;border:1px solid #000;padding:4px 6px;">
        <strong>Name of proprietor:</strong>&nbsp;
        <span style="font-family:'Courier New',monospace !important;">${window.currentUser?.displayName || window.currentUser?.email || 'Transport Owner'}</span>
      </td>
      <td style="border:1px solid #000;padding:4px 6px;">
        <strong>Social security number (SSN) / EIN:</strong>
        <div style="border-bottom:1px solid #000;margin-top:4px;height:12px;"></div>
      </td>
    </tr>
  </table>
  <table style="font-size:11px;margin-bottom:4px;">
    <tr>
      <td style="border:1px solid #000;padding:4px 6px;">
        <strong>A</strong> Principal business or profession: <strong>Trucking — Expedited Freight (Owner-Operator)</strong>
      </td>
      <td style="width:35%;border:1px solid #000;padding:4px 6px;">
        <strong>B</strong> Business code (NAICS): <strong style="font-family:'Courier New',monospace !important;">484120</strong>
        &nbsp;<span class="note">(General Freight Trucking, Long-distance)</span>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:4px 6px;">
        <strong>C</strong> Business name (if different): <span style="font-family:'Courier New',monospace !important;">Owner-Operator / DBA</span>
        &nbsp;<div style="border-bottom:1px solid #aaa;margin-top:2px;height:10px;display:inline-block;width:180px;"></div>
      </td>
      <td style="border:1px solid #000;padding:4px 6px;">
        <strong>D</strong> EIN (if any): <div style="border-bottom:1px solid #000;height:12px;margin-top:4px;"></div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #000;padding:4px 6px;">
        <strong>E</strong> Business address (street, city, state, ZIP):
        <div style="border-bottom:1px solid #aaa;height:12px;margin-top:4px;"></div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:4px 6px;">
        <strong>F</strong> Accounting method: ☑ <strong>Cash</strong> &nbsp; ☐ Accrual &nbsp; ☐ Other
      </td>
      <td style="border:1px solid #000;padding:4px 6px;">
        <strong>G</strong> Did you materially participate? ☑ <strong>Yes</strong> &nbsp; ☐ No
      </td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #000;padding:4px 6px;">
        <strong>H</strong> Did you start or acquire this business in ${year}? &nbsp; ☐ Yes &nbsp; ☑ No &nbsp;&nbsp;
        <strong>I</strong> Did you make any payments requiring Form 1099? &nbsp; ☐ Yes &nbsp; ☑ No
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       PART I — INCOME
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Part I — Income</div>
  <table>
    <tr><th style="width:40px;">#</th><th>Description</th><th style="width:140px;">Amount ($)</th></tr>
    <tr>
      <td style="text-align:right;font-weight:bold;">1</td>
      <td>Gross receipts or sales <span class="note">(freight charges billed to brokers/shippers)</span></td>
      <td class="val">${fmt(grossReceipts)}</td>
    </tr>
    <tr><td style="text-align:right;font-weight:bold;">2</td><td>Returns and allowances</td><td class="val">0.00</td></tr>
    <tr><td style="text-align:right;font-weight:bold;">3</td><td>Subtract line 2 from line 1</td><td class="val">${fmt(grossReceipts)}</td></tr>
    <tr><td style="text-align:right;font-weight:bold;">4</td><td>Cost of goods sold (Part III)</td><td class="val">0.00</td></tr>
    <tr class="highlight-row">
      <td style="text-align:right;font-weight:bold;">5</td>
      <td><strong>Gross profit</strong> (Line 3 − Line 4)</td>
      <td class="val">${fmt(grossReceipts)}</td>
    </tr>
    <tr><td style="text-align:right;font-weight:bold;">6</td><td>Other income <span class="note">(fuel surcharges, bonuses, detention pay)</span></td><td class="val">0.00</td></tr>
    <tr class="total-row">
      <td style="text-align:right;font-weight:bold;">7</td>
      <td><strong>Gross income</strong> (Line 5 + Line 6)</td>
      <td class="val">${fmt(grossReceipts)}</td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       MILEAGE METHOD COMPARISON
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Vehicle Expense Method — Standard vs. Actual Comparison (${year})</div>
  <table>
    <tr>
      <th>Method</th><th>Calculation</th><th style="width:140px;">Deduction ($)</th><th style="width:100px;">Recommended</th>
    </tr>
    <tr class="${useStandard ? 'net-row' : ''}">
      <td><strong>Standard Mileage</strong> @ $${mileageRate.toFixed(3)}/mi</td>
      <td>${fmtInt(totalMiles)} mi × $${mileageRate.toFixed(3)}</td>
      <td class="val">${fmt(standardMileageDeduction)}</td>
      <td style="text-align:center;">${useStandard ? '<span class="badge badge-green">✔ AUTO-SELECTED</span>' : ''}</td>
    </tr>
    <tr class="${!useStandard ? 'net-row' : ''}">
      <td><strong>Actual Expenses</strong></td>
      <td>Fuel + Maint + Tires + Insurance + Permits</td>
      <td class="val">${fmt(actualVehicleExpenses)}</td>
      <td style="text-align:center;">${!useStandard ? '<span class="badge badge-green">✔ AUTO-SELECTED</span>' : ''}</td>
    </tr>
    <tr class="warning-row">
      <td colspan="4" style="font-size:10px;padding:4px 8px;">
        ⚠ <strong>Note:</strong> Tolls ($${fmt(exp.tolls)}) are deductible <em>in addition to</em> the Standard Mileage rate (IRS Rev. Proc. 2010-51).
        Under Standard Mileage, fuel/maintenance/insurance/permits are <em>already included</em> in the rate and cannot be deducted separately.
        ${useStandard ? `Savings vs. Actual: <strong>$${fmt(standardMileageDeduction - actualVehicleExpenses)}</strong>` : `Savings vs. Standard: <strong>$${fmt(actualVehicleExpenses - standardMileageDeduction)}</strong>`}
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       PART II — EXPENSES
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Part II — Expenses &nbsp; <span style="font-size:10px;font-weight:normal;">Method: ${useStandard ? 'STANDARD MILEAGE' : 'ACTUAL EXPENSES'}</span></div>
  <div style="display:flex;gap:12px;">
    <!-- Left Column -->
    <table style="flex:1;">
      <tr><th>#</th><th>Expense</th><th style="width:110px;">Amount ($)</th></tr>
      <tr><td class="val">8</td><td>Advertising</td><td class="val">0.00</td></tr>
      <tr class="${useStandard ? 'highlight-row' : ''}">
        <td class="val">9</td>
        <td>
          <strong>Car &amp; truck expenses</strong><br>
          <span class="note">${useStandard ? `Standard: ${fmtInt(totalMiles)} mi × $${mileageRate.toFixed(3)}` : 'Actual: fuel + maint + tires + insurance + permits'}</span>
        </td>
        <td class="val">${fmt(line9)}</td>
      </tr>
      <tr><td class="val">10</td><td>Commissions and fees</td><td class="val">0.00</td></tr>
      <tr><td class="val">11</td><td>Contract labor</td><td class="val">0.00</td></tr>
      <tr><td class="val">12</td><td>Depletion</td><td class="val">0.00</td></tr>
      <tr>
        <td class="val">13</td>
        <td>Depreciation (Form 4562) <span class="note">— enter if claiming vehicle depreciation</span></td>
        <td class="val">0.00</td>
      </tr>
      <tr><td class="val">14</td><td>Employee benefit programs</td><td class="val">0.00</td></tr>
      <tr>
        <td class="val">15</td>
        <td>Insurance (other than health)<br><span class="note">${useStandard ? 'Included in Standard Mileage' : 'Truck/cargo/liability insurance'}</span></td>
        <td class="val">${fmt(line15)}</td>
      </tr>
      <tr><td class="val">16a</td><td>Mortgage interest (banks)</td><td class="val">0.00</td></tr>
      <tr>
        <td class="val">16b</td>
        <td>Other interest <span class="note">(truck loan interest only)</span></td>
        <td class="val">0.00</td>
      </tr>
      <tr><td class="val">17</td><td>Legal and professional services</td><td class="val">0.00</td></tr>
      <tr><td class="val">18</td><td>Office expense</td><td class="val">0.00</td></tr>
      <tr><td class="val">19</td><td>Pension / profit-sharing plans</td><td class="val">0.00</td></tr>
    </table>
    <!-- Right Column -->
    <table style="flex:1;">
      <tr><th>#</th><th>Expense</th><th style="width:110px;">Amount ($)</th></tr>
      <tr><td class="val">20a</td><td>Rent / lease — vehicles, machinery</td><td class="val">0.00</td></tr>
      <tr><td class="val">20b</td><td>Rent / lease — other business property</td><td class="val">0.00</td></tr>
      <tr>
        <td class="val">21</td>
        <td>Repairs &amp; maintenance<br><span class="note">${useStandard ? 'Included in Standard Mileage' : 'Oil changes, tires, inspections'}</span></td>
        <td class="val">${fmt(line21)}</td>
      </tr>
      <tr><td class="val">22</td><td>Supplies (not in Part III)</td><td class="val">0.00</td></tr>
      <tr>
        <td class="val">23</td>
        <td>Taxes and licenses<br><span class="note">${useStandard ? 'Included in Standard Mileage' : 'Permits, IFTA, IRP, HVUT'}</span></td>
        <td class="val">${fmt(line23)}</td>
      </tr>
      <tr>
        <td class="val">24a</td>
        <td><strong>Travel</strong> (lodging, 100% deductible)<br><span class="note">Hotel, motel during business trips</span></td>
        <td class="val">${fmt(line24a)}</td>
      </tr>
      <tr class="${exp.food > 0 ? 'highlight-row' : ''}">
        <td class="val">24b</td>
        <td>
          <strong>Deductible meals — 80% (DOT rule)</strong><br>
          <span class="note">IRC §274(n)(3): DOT-regulated HOS drivers deduct 80%, not 50%.</span><br>
          <span class="note">Actual meals: $${fmt(exp.food)} × 80% = $${fmt(mealsDeductible)}</span>
        </td>
        <td class="val">${fmt(line24b)}</td>
      </tr>
      <tr><td class="val">25</td><td>Utilities</td><td class="val">0.00</td></tr>
      <tr><td class="val">26</td><td>Wages (less employment credits)</td><td class="val">0.00</td></tr>
      <tr>
        <td class="val">27a</td>
        <td>Other expenses (Part V detail)<br><span class="note">Tolls: $${fmt(exp.tolls)} | Other: $${fmt(exp.other)}</span></td>
        <td class="val">${fmt(line27a)}</td>
      </tr>
      <tr><td class="val">27b</td><td>Reserved for future use</td><td class="val">0.00</td></tr>
    </table>
  </div>

  <table>
    <tr class="total-row">
      <td style="width:40px;text-align:right;font-weight:bold;">28</td>
      <td><strong>Total expenses before business use of home</strong></td>
      <td class="val" style="width:140px;">${fmt(line28)}</td>
    </tr>
    <tr>
      <td style="text-align:right;font-weight:bold;">29</td>
      <td>Tentative profit (Gross income Line 7 − Line 28)</td>
      <td class="val">${fmt(line29)}</td>
    </tr>
    <tr>
      <td style="text-align:right;font-weight:bold;">30</td>
      <td>Expenses for business use of home (Form 8829) <span class="note">— if applicable</span></td>
      <td class="val">0.00</td>
    </tr>
    <tr class="${netProfit >= 0 ? 'net-row' : 'badge-red'}">
      <td style="text-align:right;font-weight:bold;font-size:14px;">31</td>
      <td>
        <strong>Net profit or (loss)</strong> — enter on Schedule 1 (Form 1040), Line 3; also on Schedule SE, Line 2<br>
        <span class="note">If loss, check if at-risk rules apply (Form 6198)</span>
      </td>
      <td class="val" style="font-size:14px;">${fmt(netProfit)}</td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       PART IV — VEHICLE INFORMATION
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Part IV — Information on Your Vehicle</div>
  <table>
    <tr>
      <td style="width:50%;padding:6px 8px;">
        <strong>43.</strong> Date vehicle placed in service for business:
        <div style="border-bottom:1px solid #000;height:14px;margin-top:4px;"></div>
      </td>
      <td style="padding:6px 8px;">
        <strong>45a.</strong> Do you have written evidence? ☑ <strong>Yes</strong> &nbsp; ☐ No &nbsp;
        <strong>45b.</strong> Is evidence written? ☑ <strong>Yes</strong>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:6px 8px;">
        <strong>44.</strong> Miles driven in ${year}: &nbsp;
        <strong>a) Business: ${fmtInt(totalMiles)}</strong> &nbsp;&nbsp;
        b) Commuting: <strong>0</strong> &nbsp;&nbsp;
        c) Other: <strong>0</strong>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:6px 8px;">
        <strong>46.</strong> Business-use %: <strong>100%</strong>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>47a.</strong> Depreciation (§179 / Bonus): <strong>$0.00</strong> — enter on Line 13 if applicable
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>47b.</strong> Section 179 deduction: <strong>$0.00</strong>
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       PART V — OTHER EXPENSES (feeds Line 27a)
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Part V — Other Expenses (Line 27a Detail)</div>
  <table>
    <tr><th>Description</th><th style="width:200px;">IRS Category / Note</th><th style="width:140px;">Amount ($)</th></tr>
    <tr>
      <td>Tolls &amp; weigh stations</td>
      <td>Always deductible with Standard Mileage (Rev. Proc. 2010-51)</td>
      <td class="val">${fmt(exp.tolls)}</td>
    </tr>
    ${exp.carPayment > 0 ? `
    <tr class="warning-row">
      <td>Vehicle payment (total recorded)</td>
      <td>⚠ Only the <em>interest portion</em> goes on Line 16b. Principal is not deductible — consider depreciation (Form 4562) instead.</td>
      <td class="val">${fmt(exp.carPayment)}</td>
    </tr>` : ''}
    ${exp.other > 0 ? `
    <tr>
      <td>Miscellaneous business expenses</td>
      <td>Lumped "Other" category — review for specific IRS lines</td>
      <td class="val">${fmt(exp.other)}</td>
    </tr>` : ''}
    <tr class="total-row">
      <td colspan="2"><strong>Total — Part V (carries to Line 27a)</strong></td>
      <td class="val">${fmt(line27a)}</td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       SCHEDULE SE — SELF-EMPLOYMENT TAX
  ════════════════════════════════════════════════════════════ -->
  <div class="page-divider"></div>
  <div class="sec-header">Schedule SE (Form 1040) — Self-Employment Tax Calculation</div>
  <table>
    <tr><th style="width:40px;">#</th><th>Line Description</th><th style="width:140px;">Amount ($)</th></tr>
    <tr><td class="val">1a</td><td>Net farm profit (N/A)</td><td class="val">0.00</td></tr>
    <tr>
      <td class="val">2</td>
      <td>Net profit from Schedule C (Line 31 above)</td>
      <td class="val">${fmt(Math.max(0, netProfit))}</td>
    </tr>
    <tr>
      <td class="val">3</td>
      <td>Combined SE income (Line 2)</td>
      <td class="val">${fmt(Math.max(0, netProfit))}</td>
    </tr>
    <tr class="highlight-row">
      <td class="val">4a</td>
      <td><strong>Net earnings subject to SE tax</strong> (Line 3 × 92.35%)</td>
      <td class="val">${fmt(netEarningsSE)}</td>
    </tr>
    <tr>
      <td class="val">5</td>
      <td>SS Wage Base (${year}): $${fmtInt(ssTaxableWageBase)} — enter smaller of Line 4a or SS base</td>
      <td class="val">${fmt(ssWages)}</td>
    </tr>
    <tr>
      <td class="val">6</td>
      <td>Social Security Tax (Line 5 × 12.4%)</td>
      <td class="val">${fmt(ssTax)}</td>
    </tr>
    <tr>
      <td class="val">7</td>
      <td>Medicare Tax (Line 4a × 2.9%) — no income cap</td>
      <td class="val">${fmt(medicareTax)}</td>
    </tr>
    ${additionalMedicare > 0 ? `
    <tr class="warning-row">
      <td class="val">8</td>
      <td>Additional Medicare Tax (income &gt; $200,000 × 0.9%)</td>
      <td class="val">${fmt(additionalMedicare)}</td>
    </tr>` : ''}
    <tr class="total-row">
      <td class="val">10</td>
      <td><strong>Total Self-Employment Tax</strong> (enter on Form 1040, Schedule 2, Line 4)</td>
      <td class="val">${fmt(totalSETax)}</td>
    </tr>
    <tr class="net-row">
      <td class="val">11</td>
      <td><strong>Deductible portion of SE Tax (50%)</strong> — enter on Schedule 1 (Form 1040), Line 15</td>
      <td class="val">${fmt(deductibleSETax)}</td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       SECTION 199A — QBI DEDUCTION (20%)
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Section 199A — Qualified Business Income (QBI) Deduction</div>
  <table>
    <tr><th>Calculation</th><th style="width:140px;">Amount ($)</th></tr>
    <tr>
      <td>Net profit (Line 31) minus SE Tax deduction = QBI Base</td>
      <td class="val">${fmt(Math.max(0, netProfit - deductibleSETax))}</td>
    </tr>
    <tr class="net-row">
      <td>
        <strong>Estimated QBI Deduction (20% of QBI Base)</strong><br>
        <span class="note">Owner-operators generally qualify. Verify income threshold ($191,950 single / $383,900 MFJ in 2024). Enter on Form 1040, Line 13.</span>
      </td>
      <td class="val">${fmt(qbiDeduction)}</td>
    </tr>
    <tr class="warning-row">
      <td colspan="2" style="font-size:10px;padding:4px 8px;">
        ⚠ <strong>Do not miss this deduction.</strong> The QBI deduction reduces your <em>taxable income</em> by up to 20% — it is one of the most valuable deductions for owner-operators.
        Confirm eligibility and limitations with a CPA (TCJA, IRC §199A).
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       QUARTERLY ESTIMATED TAX PAYMENTS
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Estimated Tax Payments — Form 1040-ES (${parseInt(year)+1})</div>
  <table>
    <tr><th>Quarter</th><th>Period Covered</th><th>Due Date</th><th style="width:140px;">Estimated Payment ($)</th></tr>
    <tr>
      <td style="text-align:center;font-weight:bold;">Q1</td>
      <td>Jan 1 – Mar 31, ${parseInt(year)+1}</td>
      <td><strong>April 15, ${parseInt(year)+1}</strong></td>
      <td class="val">${fmt(quarterlyPayment)}</td>
    </tr>
    <tr>
      <td style="text-align:center;font-weight:bold;">Q2</td>
      <td>Apr 1 – May 31, ${parseInt(year)+1}</td>
      <td><strong>June 16, ${parseInt(year)+1}</strong></td>
      <td class="val">${fmt(quarterlyPayment)}</td>
    </tr>
    <tr>
      <td style="text-align:center;font-weight:bold;">Q3</td>
      <td>Jun 1 – Aug 31, ${parseInt(year)+1}</td>
      <td><strong>September 15, ${parseInt(year)+1}</strong></td>
      <td class="val">${fmt(quarterlyPayment)}</td>
    </tr>
    <tr>
      <td style="text-align:center;font-weight:bold;">Q4</td>
      <td>Sep 1 – Dec 31, ${parseInt(year)+1}</td>
      <td><strong>January 15, ${parseInt(year)+2}</strong></td>
      <td class="val">${fmt(quarterlyPayment)}</td>
    </tr>
    <tr class="total-row">
      <td colspan="3"><strong>Total Estimated Annual Tax (SE + Income Tax ~22% bracket)</strong></td>
      <td class="val">${fmt(totalEstimatedTax)}</td>
    </tr>
    <tr class="warning-row">
      <td colspan="4" style="font-size:10px;padding:4px 8px;">
        ⚠ <strong>Underpayment penalty:</strong> If you expect to owe more than $1,000, you must make quarterly payments.
        Safe harbor: pay 100% of prior year tax (110% if AGI &gt; $150,000). Pay via IRS Direct Pay or EFTPS.
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       MONTHLY MILEAGE LOG SUMMARY
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Monthly Mileage Log Summary — ${year}</div>
  <table>
    <tr>
      ${monthNames.map(m => `<th style="text-align:center;">${m}</th>`).join('')}
      <th>Total</th>
    </tr>
    <tr>
      ${monthNames.map((_, i) => `<td style="text-align:center;">${fmtInt(monthlyMiles[i] || 0)}</td>`).join('')}
      <td class="val">${fmtInt(totalMiles)}</td>
    </tr>
    <tr class="highlight-row">
      ${monthNames.map((_, i) => {
    const mi = monthlyMiles[i] || 0;
    return `<td style="text-align:center;font-size:10px;">$${fmt(mi * mileageRate)}</td>`;
  }).join('')}
      <td class="val" style="font-size:10px;">$${fmt(standardMileageDeduction)}</td>
    </tr>
    <tr>
      <td colspan="13" style="font-size:10px;padding:4px 8px;" class="note">
        Row 1: Miles driven per month. Row 2: Standard mileage value per month at $${mileageRate.toFixed(3)}/mi.
        IRS requires a contemporaneous mileage log (date, destination, business purpose, miles). Apps like MileIQ, TripLog, or a spreadsheet qualify.
      </td>
    </tr>
  </table>

  <!-- ═══════════════════════════════════════════════════════════
       STATE INCOME TAX
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">State Income Tax — ${stateInfo.name} (${homeState})</div>
  ${stateInfo.rate === 0 ? `
  <table>
    <tr class="net-row">
      <td colspan="2" style="padding:10px 12px;font-size:13px;">
        ✅ <strong>${stateInfo.name} has NO state income tax.</strong> You owe $0.00 in state income tax on your business income.
        <br><span class="note">${stateInfo.note}</span>
      </td>
    </tr>
  </table>` : `
  <table>
    <tr><th>Line Item</th><th style="width:140px;">Amount ($)</th></tr>
    <tr>
      <td>State taxable income (approximates federal taxable income)</td>
      <td class="val">${fmt(Math.max(0, netProfit - deductibleSETax - qbiDeduction))}</td>
    </tr>
    <tr class="highlight-row">
      <td>
        <strong>Estimated ${stateInfo.name} State Income Tax</strong><br>
        <span class="note">${stateInfo.note}. Rate applied: ${(stateInfo.rate * 100).toFixed(2)}%</span>
      </td>
      <td class="val">${fmt(Math.max(0, netProfit - deductibleSETax - qbiDeduction) * stateInfo.rate)}</td>
    </tr>
    <tr class="warning-row">
      <td colspan="2" style="font-size:10px;padding:4px 8px;">
        ⚠ State tax is estimated using the applicable marginal rate. Actual liability depends on state-specific deductions, credits, and filing status.
        Some states do not fully conform to federal deductions (QBI, SE deduction). Verify with a local CPA.
      </td>
    </tr>
  </table>`}

  <!-- ═══════════════════════════════════════════════════════════
       TAX SUMMARY DASHBOARD
  ════════════════════════════════════════════════════════════ -->
  <div class="sec-header">Tax Year ${year} — Complete Tax Summary (${stateInfo.name})</div>
  <table>
    <tr><th>Line Item</th><th style="width:50%;">Detail / Note</th><th style="width:140px;">Amount ($)</th></tr>

    <!-- INCOME -->
    <tr class="total-row"><td colspan="3" style="padding:4px 8px;font-size:11px;"><strong>── GROSS INCOME ──</strong></td></tr>
    <tr>
      <td>Gross Revenue (Line 1)</td>
      <td class="note">${filteredLoads.length} loads completed</td>
      <td class="val">${fmt(grossReceipts)}</td>
    </tr>

    <!-- DEDUCTIONS BREAKDOWN -->
    <tr class="total-row"><td colspan="3" style="padding:4px 8px;font-size:11px;"><strong>── DEDUCTIONS (Schedule C) ──</strong></td></tr>
    <tr>
      <td>Vehicle — Line 9 (${useStandard ? 'Standard Mileage' : 'Actual Expenses'})</td>
      <td class="note">${useStandard ? `${fmtInt(totalMiles)} mi × $${mileageRate.toFixed(3)}/mi` : 'Fuel + Maintenance + Tires + Insurance + Permits'}</td>
      <td class="val">(${fmt(line9)})</td>
    </tr>
    ${line24a > 0 ? `
    <tr>
      <td>Lodging / Travel — Line 24a (100% deductible)</td>
      <td class="note">Hotel, motel during business trips — fully deductible</td>
      <td class="val">(${fmt(line24a)})</td>
    </tr>` : ''}
    ${line24b > 0 ? `
    <tr class="highlight-row">
      <td>Meals — Line 24b (80% DOT rule)</td>
      <td class="note">Actual meals $${fmt(exp.food)} × 80% — IRC §274(n)(3) DOT drivers</td>
      <td class="val">(${fmt(line24b)})</td>
    </tr>` : ''}
    ${line15 > 0 ? `
    <tr>
      <td>Insurance — Line 15</td>
      <td class="note">Truck / cargo / liability insurance (actual method)</td>
      <td class="val">(${fmt(line15)})</td>
    </tr>` : ''}
    ${line21 > 0 ? `
    <tr>
      <td>Repairs &amp; Maintenance — Line 21</td>
      <td class="note">Oil changes, tires, inspections (actual method)</td>
      <td class="val">(${fmt(line21)})</td>
    </tr>` : ''}
    ${line23 > 0 ? `
    <tr>
      <td>Taxes &amp; Licenses — Line 23</td>
      <td class="note">IFTA, IRP, HVUT, permits (actual method)</td>
      <td class="val">(${fmt(line23)})</td>
    </tr>` : ''}
    ${line27a > 0 ? `
    <tr>
      <td>Tolls &amp; Other — Line 27a</td>
      <td class="note">Tolls: $${fmt(exp.tolls)} | Other: $${fmt(exp.other)}</td>
      <td class="val">(${fmt(line27a)})</td>
    </tr>` : ''}
    ${exp.carPayment > 0 ? `
    <tr class="warning-row">
      <td>Vehicle Payment (recorded: $${fmt(exp.carPayment)})</td>
      <td class="note">⚠ Principal NOT deductible. Only interest (Line 16b) + depreciation (Form 4562) are deductible — consult CPA</td>
      <td class="val" style="color:#b45309 !important;-webkit-text-fill-color:#b45309 !important;">N/A</td>
    </tr>` : ''}

    <tr class="total-row">
      <td><strong>Total Deductions — Line 28</strong></td>
      <td class="note">Sum of all deductible business expenses</td>
      <td class="val">(${fmt(line28)})</td>
    </tr>
    <tr class="highlight-row">
      <td><strong>Net Profit — Schedule C Line 31</strong></td>
      <td class="note">Gross Revenue − Total Deductions</td>
      <td class="val">${fmt(netProfit)}</td>
    </tr>

    <!-- POST-SCHEDULE C DEDUCTIONS -->
    <tr class="total-row"><td colspan="3" style="padding:4px 8px;font-size:11px;"><strong>── FEDERAL ADJUSTMENTS ──</strong></td></tr>
    <tr>
      <td>SE Tax Deduction — Sch 1 Line 15 (50% of SE Tax)</td>
      <td class="note">Reduces AGI. SE Tax = $${fmt(totalSETax)}</td>
      <td class="val">(${fmt(deductibleSETax)})</td>
    </tr>
    <tr>
      <td>QBI Deduction — Section 199A (20%)</td>
      <td class="note">20% of qualified business income — Form 1040 Line 13</td>
      <td class="val">(${fmt(qbiDeduction)})</td>
    </tr>

    <!-- TAXABLE INCOME & TAX LIABILITY -->
    <tr class="total-row"><td colspan="3" style="padding:4px 8px;font-size:11px;"><strong>── TAX LIABILITY ──</strong></td></tr>
    <tr class="total-row">
      <td><strong>Estimated Federal Taxable Income</strong></td>
      <td class="note">After SE deduction and QBI</td>
      <td class="val">${fmt(Math.max(0, netProfit - deductibleSETax - qbiDeduction))}</td>
    </tr>
    <tr>
      <td>Self-Employment Tax (SS 12.4% + Medicare 2.9%)</td>
      <td class="note">Schedule SE — Form 1040 Schedule 2 Line 4</td>
      <td class="val">${fmt(totalSETax)}</td>
    </tr>
    <tr>
      <td>Estimated Federal Income Tax (~22% bracket)</td>
      <td class="note">Simplified estimate — actual depends on filing status and credits</td>
      <td class="val">${fmt(estimatedIncomeTax)}</td>
    </tr>
    ${stateInfo.rate > 0 ? `
    <tr>
      <td>Estimated ${stateInfo.name} State Income Tax (${(stateInfo.rate*100).toFixed(2)}%)</td>
      <td class="note">${stateInfo.note}</td>
      <td class="val">${fmt(Math.max(0, netProfit - deductibleSETax - qbiDeduction) * stateInfo.rate)}</td>
    </tr>` : `
    <tr class="net-row">
      <td>${stateInfo.name} State Income Tax</td>
      <td class="note">${stateInfo.note}</td>
      <td class="val">$0.00 ✅</td>
    </tr>`}
    <tr class="net-row">
      <td><strong>Estimated Total Tax Liability</strong></td>
      <td class="note">Federal SE + Federal Income + State (${homeState})</td>
      <td class="val">${fmt(totalEstimatedTax + (stateInfo.rate > 0 ? Math.max(0, netProfit - deductibleSETax - qbiDeduction) * stateInfo.rate : 0))}</td>
    </tr>
    <tr>
      <td>Effective Tax Rate on Gross Revenue</td>
      <td class="note">Total tax ÷ gross revenue</td>
      <td class="val">${grossReceipts > 0 ? (((totalEstimatedTax + (stateInfo.rate > 0 ? Math.max(0, netProfit - deductibleSETax - qbiDeduction) * stateInfo.rate : 0)) / grossReceipts) * 100).toFixed(1) : '0.0'}%</td>
    </tr>
    <tr>
      <td>Take-Home (after all taxes)</td>
      <td class="note">Gross − Total Tax Liability</td>
      <td class="val">${fmt(grossReceipts - (totalEstimatedTax + (stateInfo.rate > 0 ? Math.max(0, netProfit - deductibleSETax - qbiDeduction) * stateInfo.rate : 0)))}</td>
    </tr>
  </table>

  <!-- ─── Disclaimer ──────────────────────────────────────────────── -->
  <div style="border:1px solid #000;padding:10px;margin-top:16px;font-size:10px;background-color:#fffbeb !important;">
    <strong>⚠ IMPORTANT DISCLAIMER:</strong> This report is generated from your load and expense data for informational and preparation purposes only.
    It does <strong>not</strong> constitute tax advice. Tax laws change annually. Always verify rates, deductions, and thresholds with a licensed CPA or tax professional
    before filing. This tool uses the <strong>80% meal deduction rate</strong> for DOT-regulated drivers subject to Hours of Service (HOS) rules under IRC §274(n)(3).
    Car payment principal is <strong>not</strong> deductible — only the interest portion (Line 16b) and/or depreciation (Form 4562 / §179).
  </div>

  <!-- ─── Action Buttons ──────────────────────────────────────────── -->
  <div class="no-print" style="display:flex;justify-content:center;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid #000;">
    <button onclick="window.print()"
      style="background-color:#1e3a5f !important;color:#fff !important;-webkit-text-fill-color:#fff !important;padding:10px 24px;border-radius:8px;font-weight:bold;border:none;cursor:pointer;font-size:14px;">
      🖨️ Print / Save as PDF
    </button>
    <button onclick="closeReportModal()"
      style="background-color:#fff !important;color:#374151 !important;-webkit-text-fill-color:#374151 !important;padding:10px 24px;border-radius:8px;font-weight:bold;border:2px solid #000;cursor:pointer;font-size:14px;">
      Close
    </button>
  </div>

  <!-- ─── IRS Footer ──────────────────────────────────────────────── -->
  <div style="border-top:1px solid #000;margin-top:16px;padding-top:6px;display:flex;justify-content:space-between;font-size:10px;">
    <span>For Paperwork Reduction Act Notice, see the separate instructions.</span>
    <span>Cat. No. 11334P</span>
    <span style="font-weight:bold;">Schedule C (Form 1040) ${year}</span>
  </div>

  </div>`; // end #irs-report-root

  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = periodLabel;

  debugLog("✅ Reporte IRS Schedule C profesional generado.");
}

// Asegurar que la función sea global para que app.html la pueda llamar:
window.generateTaxReport = generateTaxReport;




function exportFinancialData() {
  debugFinances(" Exportando datos financieros...");

  if (!financesData || !expensesData) {
    alert("No hay datos suficientes para exportar");
    return;
  }

  var csvData = [];

  // =======================
  // 1. Ingresos (cargas)
  // =======================
  csvData.push([window.i18n?.t('finances.csv_revenues_section') || '=== REVENUE (LOADS) ===']);
  csvData.push((window.i18n?.t('finances.csv_revenues_headers') || 'Date,Origin,Destination,Miles,RPM,Revenue').split(','));

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
  csvData.push([window.i18n?.t('finances.csv_expenses_section') || '=== MANUAL EXPENSES ===']);
  csvData.push((window.i18n?.t('finances.csv_expenses_headers') || 'Date,Category,Description,Amount,Deductible').split(','));

  expensesData.forEach(exp => {
    csvData.push([
      exp.date || '',
      exp.type || '',
      (exp.description || '').replace(/,/g, ' '),
      formatCurrency(exp.amount || 0),
      exp.deductible === false ? 'No' : 'S'
    ]);
  });

  // =======================
  // 3. Resumen
  // =======================
  const totalRevenue = financesData.reduce((s, l) => s + (l.totalCharge || 0), 0);
  const totalExpenses = expensesData.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  csvData.push(['']);
  csvData.push([window.i18n?.t('finances.csv_summary_section') || '=== SUMMARY ===']);
  csvData.push([window.i18n?.t('finances.csv_total_revenue') || 'Total Revenue', formatCurrency(totalRevenue)]);
  csvData.push([window.i18n?.t('finances.csv_total_expenses') || 'Total Expenses', formatCurrency(totalExpenses)]);
  csvData.push([window.i18n?.t('finances.csv_net_profit') || 'Net Profit', formatCurrency(netProfit)]);
  csvData.push([window.i18n?.t('finances.csv_total_loads') || 'Total Loads', financesData.length]);
  csvData.push([window.i18n?.t('finances.csv_total_expenses') || 'Total Expenses', expensesData.length]);

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

  debugFinances("OK Datos exportados exitosamente");
}



// OK DEBUG AVANZADO DE FINANZAS
function debugFinancesElements() {
  debugFinances(" === DEBUG DE ELEMENTOS DOM FINANCIEROS ===");

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
      tag: el ? el.tagName : "",
      texto: el ? el.textContent.trim() : "N/A"
    };
  });

  console.table(results);

  //  Resumen rpido
  const encontrados = results.filter(r => r.encontrado).length;
  const faltantes = results.filter(r => !r.encontrado).map(r => r.id);
  debugFinances(` Resumen  Encontrados: ${encontrados}/${criticalElements.length}`);
  if (faltantes.length) debugFinances(" Faltantes:", faltantes);

  //  Extra: verificar si los grficos tienen contexto
  ['cashFlowChart', 'expenseBreakdownChart'].forEach(id => {
    const canvas = document.getElementById(id);
    if (canvas && canvas.getContext) {
      debugFinances(` ${id} tiene contexto 2D disponible`);
    }
  });

  debugFinances("===========================================");
}


//  FUNCIN updateFinancialKPIs LIMPIA
// ==============================
function updateFinancialKPIs() {
  debugLog(" Actualizando KPIs mejorados...");

  // Datos bsicos (solo gastos manuales)
  const totalRevenue = financesData.reduce((sum, load) => sum + (load.totalCharge || 0), 0);
  const totalExpenses = expensesData.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalMiles = financesData.reduce((sum, load) => sum + (load.totalMiles || 0), 0);
  const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
  const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Actualizar elementos existentes usando selectores especficos
  const updateElementSafe = (id, value) => {
    const element = document.querySelector(`#finances #${id}`) || document.getElementById(id);
    if (element) {
      element.textContent = value;
      return true;
    }
    debugLog(`Elemento no encontrado: ${id}`);
    return false;
  };

  // Actualizar KPIs
  updateElementSafe('totalRevenue', formatCurrency(totalRevenue));
  updateElementSafe('totalExpensesSummary', formatCurrency(totalExpenses));
  updateElementSafe('netProfit', formatCurrency(netProfit));
  // updateElementSafe('profitMarginPercent', margin.toFixed(1) + '%'); // Elemento no existe en HTML

  // Actualizar nuevos elementos
  updateElementSafe('totalMiles', totalMiles.toLocaleString());
  updateElementSafe('avgRpm', formatCurrency(avgRpm));
  updateElementSafe('costPerMile', formatCurrency(costPerMile));

  // Calcular eficiencia
  const efficiency = calculateEfficiency();
  updateElementSafe('efficiency', efficiency + '%');

  // Colores dinámicos: Ganancia y Margen
  const profitCard = document.getElementById('profitKpiCard');
  if (profitCard) {
    profitCard.classList.remove('fin-kpi-slate', 'fin-kpi-green', 'fin-kpi-red');
    profitCard.classList.add(netProfit >= 0 ? 'fin-kpi-green' : 'fin-kpi-red');
  }
  const marginCard = document.getElementById('marginKpiCard');
  if (marginCard) {
    marginCard.classList.remove('fin-kpi-slate', 'fin-kpi-green', 'fin-kpi-amber', 'fin-kpi-red');
    marginCard.classList.add(margin >= 20 ? 'fin-kpi-green' : margin >= 0 ? 'fin-kpi-amber' : 'fin-kpi-red');
  }

  debugLog("OK KPIs actualizados:", {
    revenue: totalRevenue,
    expenses: totalExpenses,
    profit: netProfit,
    miles: totalMiles,
    rpm: avgRpm
  });
}







function populateYearSelect() {
  debugLog(" Poblando selector de aos...");

  //  Validar si hay datos
  const hasLoads = window.financesData && window.financesData.length > 0;
  const hasExpenses = window.expensesData && window.expensesData.length > 0;

  if (!hasLoads && !hasExpenses) {
    debugLog(" No hay datos financieros para extraer aos");
    return;
  }

  //  Extraer aos de cargas
  const yearsFromLoads = (window.financesData || [])
    .filter(l => l.date)
    .map(l => {
      try {
        return new Date(l.date).getFullYear().toString();
      } catch {
        return null;
      }
    });

  //  Extraer aos de gastos
  const yearsFromExpenses = (window.expensesData || [])
    .filter(e => e.date)
    .map(e => {
      try {
        return new Date(e.date).getFullYear().toString();
      } catch {
        return null;
      }
    });

  //  Consolidar aos nicos
  const years = [...new Set([...yearsFromLoads, ...yearsFromExpenses])]
    .filter(y => y)
    .sort((a, b) => b - a); // orden descendente

  const yearSelect = document.getElementById("yearSelect");
  if (!yearSelect) {
    debugLog(" No se encontr el selector de aos (yearSelect)");
    return;
  }

  //  Poblar selector
  yearSelect.innerHTML = `<option value="">${window.i18n?.t('finances.all_years') || 'All Years'}</option>`;
  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = ` ${year}`;
    yearSelect.appendChild(option);
  });

  debugLog(`OK Aos disponibles: ${years.join(", ")}`);

  //  Seleccionar el ms reciente y actualizar meses
  if (years.length > 0) {
    yearSelect.value = years[0];
    if (typeof updateMonthOptions === "function") {
      updateMonthOptions();
    } else {
      debugLog(" updateMonthOptions no est definida an");
    }
  }
}

function updateMonthOptions() {
  debugLog(" Actualizando meses...");

  const year = document.getElementById("yearSelect")?.value;
  const monthSelect = document.getElementById("monthSelect");

  if (!monthSelect) {
    debugLog(" No se encontr el selector de mes");
    return;
  }

  // OK Siempre dejamos la opcin de "Todos los Meses"
  monthSelect.innerHTML = `<option value="">${window.i18n?.t('finances.all_months') || 'All Months'}</option>`;

  if (!year) {
    debugLog(" No hay ao seleccionado, solo se muestra 'Todos los Meses'");
    return;
  }

  //  Extraer meses de cargas
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

  //  Extraer meses de gastos
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

  //  Consolidar meses nicos y ordenarlos cronolgicamente
  const allMonths = [...new Set([...monthsFromLoads, ...monthsFromExpenses])]
    .filter(m => m)
    .sort((a, b) => new Date(a + "-01") - new Date(b + "-01"));

  const monthNames = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };

  //  Poblar selector
  allMonths.forEach(m => {
    const month = m.slice(5, 7);
    const option = document.createElement("option");
    option.value = month;
    option.textContent = ` ${monthNames[month] || month}`;
    monthSelect.appendChild(option);
  });

  debugLog(`OK Meses disponibles para ${year}: ${allMonths.join(", ")}`);

  //  Seleccionar automticamente el ltimo mes con datos
  if (allMonths.length > 0) {
    const latestMonth = allMonths[allMonths.length - 1].slice(5, 7);
    monthSelect.value = latestMonth;

    if (typeof filterByYearMonth === "function") {
      filterByYearMonth();
    } else {
      debugLog(" filterByYearMonth no est definida an");
    }
  }
}

// ============================
//  Selectores de Perodo Globalizados
// ============================

// 1. Leer perodo segn contexto
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

// OK Funcin global para aplicar el filtro (reutilizable en main.js y tabs)
// 1. Primero actualiza la funcin applyFilter para que use la nueva lgica
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
  debugLog(`Filtro aplicado (${context}): ${period}`);

  if (typeof window.loadFinancialData === "function") {
    window.loadFinancialData(period).then(r => {
      debugLog(" [FINANCES] OK Datos cargados, actualizando UI completa...");

      // Actualizar KPIs mejorados
      updateFinancialKPIs(); // Sin parmetros, que use window.financesData
      updateExpenseCategories();
      renderExpensesList(window.expensesData);

      // Actualizar grficas principales
      setTimeout(() => {
        updateCashFlowChartEnhanced(); // OK Versin mejorada
        updateExpenseBreakdownChart();

        // OK Nuevos grficos del Dashboard
        updateRpmTrendChart();
        updateLoadDistributionChart();
      }, 100);

      updateBusinessMetrics();

      debugLog("OK UI completa de finanzas actualizada");
    }).catch(err => debugLog("Error aplicando filtro:", err));
  }
}



// OK Inicializar selectores con ao/mes actual
// 2. Verificar que los listeners estn bien configurados
function initPeriodSelectors(context = "global") {
  debugLog("Inicializando selectores para contexto:", context);

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
    yearEl.innerHTML = `<option value="">${window.i18n?.t('finances.all_periods') || 'All'}</option>`;
    for (let y = minYear; y <= parseInt(currentYear); y++) {
      yearEl.innerHTML += `<option value="${y}">${y}</option>`;
    }
    yearEl.value = currentYear;

    const meses = [
      window.i18n?.t('common.month_jan')||'January',
      window.i18n?.t('common.month_feb')||'February',
      window.i18n?.t('common.month_mar')||'March',
      window.i18n?.t('common.month_apr')||'April',
      window.i18n?.t('common.month_may')||'May',
      window.i18n?.t('common.month_jun')||'June',
      window.i18n?.t('common.month_jul')||'July',
      window.i18n?.t('common.month_aug')||'August',
      window.i18n?.t('common.month_sep')||'September',
      window.i18n?.t('common.month_oct')||'October',
      window.i18n?.t('common.month_nov')||'November',
      window.i18n?.t('common.month_dec')||'December'
    ];
    monthEl.innerHTML = `<option value="">${window.i18n?.t('finances.all_periods') || 'All'}</option>`;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      monthEl.innerHTML += `<option value="${mm}">${meses[m - 1]}</option>`;
    }
    monthEl.value = currentMonth;

    // Listeners (solo una vez)
    if (!yearEl.hasListener) {
      yearEl.addEventListener("change", () => {
        debugLog("Ao cambiado, aplicando filtro...");
        applyFilter(context);
      });
      yearEl.hasListener = true;
    }
    if (!monthEl.hasListener) {
      monthEl.addEventListener("change", () => {
        debugLog("Mes cambiado, aplicando filtro...");
        applyFilter(context);
      });
      monthEl.hasListener = true;
    }

    // Aplicar filtro inicial
    setTimeout(() => applyFilter(context), 500);
  }
}


// 3. Aplicar perodo segn contexto
function applyPeriod(context) {
  const { year, month } = getSelectedPeriod(context);
  debugLog(` Filtro aplicado (${context}):`, year || "Todos", month || "Todos");

  if (context === "global") {
    const period = (year && month) ? `${year}-${month}` : (year || "all");
    debugLog(" Period final:", period);

    if (typeof window.loadFinancialData === "function") {
      window.loadFinancialData(period).then(r => {
        updateFinancialKPIs(r.kpis);
        updateExpenseCategories();
        updateFinancialCharts();
        updateBusinessMetrics();
      }).catch(err => {
        debugLog(" Error aplicando filtro global:", err);
      });
    }

  } else if (context === "reports") {
    // No generar reporte automáticamente, solo cuando el usuario hace clic en el botón
    debugLog("Reports tab selected - awaiting user action");
  } else if (context === "accounts") {
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    } else {
      debugLog(" loadAccountsData no implementado an");
    }
  }
}


// OK FUNCIN GLOBAL PARA TODOS LOS CONTEXTOS (summary, reports, accounts)
function filterByYearMonth(context = "global") {
  debugLog(` [CLEAN] === INICIO filterByYearMonth (${context}) ===`);

  //  Obtener periodo segn contexto
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
    debugLog(` [CLEAN] Selectores no encontrados para contexto: ${context}`);
    return;
  }

  const year = yearSelect.value;
  const month = monthSelect.value;



  // OK Filtrar datasets
  let filteredLoads = window.financesData || [];
  let filteredExpenses = window.expensesData || [];

  if (year && month) {
    filteredLoads = filteredLoads.filter(load => normalizeDate(load.date) === `${year}-${month}`);
    filteredExpenses = filteredExpenses.filter(exp => normalizeDate(exp.date) === `${year}-${month}`);
  } else if (year && !month) {
    filteredLoads = filteredLoads.filter(load => normalizeDate(load.date, "year") === year);
    filteredExpenses = filteredExpenses.filter(exp => normalizeDate(exp.date, "year") === year);
  }

  debugLog(" [CLEAN] Datos filtrados:", {
    context,
    loads: filteredLoads.length,
    expenses: filteredExpenses.length
  });

  //  Usar datos segn el contexto
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




    debugLog(` [CLEAN] === FIN filterByYearMonth (${context}) ===`);
    return;
  }

  if (context === "reports") {
    // No generar reporte automáticamente - el usuario debe hacer clic en el botón
    debugLog("Reports filter applied - awaiting user action");
  } else if (context === "accounts") {
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    }
  }

  debugLog(` [CLEAN] === FIN filterByYearMonth (${context}) ===`);
}

// OK Funcin auxiliar para calcular KPIs de cargas y gastos
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
//  FUNCIÓN updateKPIsUI SIMPLIFICADA
// ==============================
function updateKPIsUI({ totalRevenue, totalExpenses, netProfit, margin, totalMiles, avgRpm }) {
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
    { id: 'profitMarginPercent', value: `${margin.toFixed(1)}%` },
    { id: 'totalMiles', value: totalMiles ? totalMiles.toLocaleString() : '0' },
    { id: 'avgRpm', value: formatCurrency(avgRpm || 0) }
  ];

  elementosFinances.forEach(item => {
    const el = document.querySelector(`#finances #${item.id}`);
    if (el) {
      el.textContent = item.value;
      el.style.fontSize = '2rem';
      el.style.fontWeight = 'bold';
      el.style.textAlign = 'center';
      debugLog(`✅ [CLEAN] ${item.id}: ${item.value}`);
    }
  });

  // ✅ ELIMINADO: Referencias a elementos de categorías individuales
}

// ==============================
//  FUNCIN calculateExpenseCategories (mantenida)
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

// OK Actualizar categoras en la UI
function updateExpenseCategoriesUI(categories) {
  const updateElementInFinances = (id, value) => {
    const element = document.getElementById(id); // OK corregido
    if (element) {
      element.textContent = value;
    } else {
      debugLog(` [FINANCES] Elemento no encontrado: ${id}`);
    }
  };

  updateElementInFinances("fuelExpenses", formatCurrency(categories.fuel));
  updateElementInFinances("maintenanceExpenses", formatCurrency(categories.maintenance));
  updateElementInFinances("foodExpenses", formatCurrency(categories.food + categories.lodging));
  updateElementInFinances("tollExpenses", formatCurrency(categories.tolls));
  updateElementInFinances("insuranceExpenses", formatCurrency(categories.insurance));
  updateElementInFinances("permitsExpenses", formatCurrency(categories.permits));
  updateElementInFinances("otherExpenses", formatCurrency(categories.other));

  debugLog("OK [CLEAN] Categoras actualizadas:", categories);
}



// OK EXPONER LA FUNCIN DE DEBUG GLOBALMENTE
window.debugFinancesElements = debugFinancesElements;
window.loadFinancesData = loadFinancesData;
window.openExpenseModal = openExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.saveExpenseToFirebase = saveExpenseToFirebase;
window.deleteExpense = deleteExpense;
window.editExpense = editExpense;
window.generatePLReport = generatePLReport;
window.initPeriodSelectors = initPeriodSelectors;
window.generateTaxReport = generateTaxReport;
window.exportFinancialData = exportFinancialData;
window.updateFinancialKPIs = updateFinancialKPIs;

// ========================================
// REPORT MODAL CONTROL FUNCTIONS
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

window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;

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

// 🖨️ Imprimir Reporte (funciona mejor que PDF)
function printReport() {
  window.print();
}

window.exportReportToPDF = exportReportToPDF;
window.printReport = printReport;

// OK Manejo de subtabs dentro de Finanzas
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('finances-event-listeners', () => {
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
});

debugFinances("OK Finances.js CORREGIDO cargado completamente");

// Agregar al final de finances.js
async function loadAccountsData() {
  debugLog(" Cargando datos de cuentas con filtros avanzados...");

  if (!window.allFinancesData || window.allFinancesData.length === 0) {
    debugLog("No hay datos de cargas disponibles");
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

  // Poblar selector de compaas dinmicamente
  populateCompanyFilter();

  // Filtrar cargas por perodo
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

  // Filtro por compaa
  if (companyFilter) {
    filteredLoads = filteredLoads.filter(load =>
      (load.companyName || "").toLowerCase().includes(companyFilter.toLowerCase())
    );
  }

  // Ordenamiento
  filteredLoads.sort((a, b) => {
    switch (sortBy) {
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

  debugLog(`Procesando ${filteredLoads.length} cargas para cuentas (filtradas y ordenadas)`);

  renderAccountsSummaryCards(filteredLoads);
  renderPendingLoads(filteredLoads);
  debugLog("OK Datos de cuentas cargados");
}

// Funcin para poblar el selector de compaas
function populateCompanyFilter() {
  const companyEl = document.getElementById("accountsCompany");
  if (!companyEl || !window.allFinancesData) return;

  // Obtener compaas nicas
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
  initializeOnce('finances-period-selectors', () => {
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
});

// Exponer la funcin globalmente
window.populateCompanyFilter = populateCompanyFilter;

// OK 1. FUNCIN markAsPaid CORREGIDA
async function markAsPaid(loadId) {
  try {
    const paymentDate = new Date().toISOString().split('T')[0];

    // OK CORREGIDO: Guardar actualPaymentDate + paymentDate
    await firebase.firestore().collection("loads").doc(loadId).update({
      paymentStatus: "paid",
      actualPaymentDate: paymentDate,  // OK CAMPO CORRECTO para filtro
      paymentDate: paymentDate,        // OK Mantener por compatibilidad
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // OK CORREGIDO: Actualizar en memoria ambos campos
    const load = window.allFinancesData.find(l => l.id === loadId);
    if (load) {
      load.paymentStatus = "paid";
      load.actualPaymentDate = paymentDate;  // OK CAMPO CORRECTO
      load.paymentDate = paymentDate;        // OK Compatibilidad
    }

    debugLog("OK Carga marcada como pagada:", loadId);
    loadAccountsData();
    showMessage("Carga marcada como pagada exitosamente", "success");
  } catch (error) {
    debugLog(" Error marcando como pagada:", error);
    showMessage("Error al marcar como pagada", "error");
  }
}

// 2. FUNCIÓN markAsUnpaid - Desmarcar como pagada
async function markAsUnpaid(loadId) {
  try {
    // Actualizar en Firestore: volver a estado pending y limpiar fechas de pago
    await firebase.firestore().collection("loads").doc(loadId).update({
      paymentStatus: "pending",
      actualPaymentDate: null,
      paymentDate: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Actualizar en memoria local
    const load = window.allFinancesData.find(l => l.id === loadId);
    if (load) {
      load.paymentStatus = "pending";
      load.actualPaymentDate = null;
      load.paymentDate = null;
    }

    debugLog("✅ Carga desmarcada como pagada:", loadId);
    loadAccountsData();
    showMessage("Carga desmarcada exitosamente", "success");
  } catch (error) {
    debugLog("❌ Error desmarcando carga:", error);
    showMessage("Error al desmarcar carga", "error");
  }
}

// Exponer funciones globalmente
window.loadAccountsData = loadAccountsData;
window.markAsPaid = markAsPaid;
window.markAsUnpaid = markAsUnpaid;



function updateAccountsSummary(summary) {
  const summaryEl = document.getElementById("accountsSummary");
  if (!summaryEl) return;

  summaryEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-800 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
        <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400">⏳ Pendientes</h3>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">${formatCurrency(summary.pending.amount)}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500">${summary.pending.count} cargas</p>
      </div>
      
      <div class="bg-white dark:bg-gray-800 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
        <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400">${window.i18n?.t('finances.overdue_section_title') || '🚨 Overdue'}</h3>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">${formatCurrency(summary.overdue.amount)}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500">${summary.overdue.count} cargas</p>
      </div>
      
      <div class="bg-white dark:bg-gray-800 border-l-4 border-green-500 p-4 rounded-r-lg shadow-sm">
        <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400">✅ Pagadas</h3>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">${formatCurrency(summary.paid.amount)}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500">${summary.paid.count} cargas</p>
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
          ${isOverdue ? (window.i18n?.t('finances.overdue_days', { days: load.daysOverdue }) || `Overdue (${load.daysOverdue} days)`) : (window.i18n?.t('finances.pending_label') || 'Pending')}
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
        No hay cargas pagadas en este periodo
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
      <td class="p-2 text-sm">
        <button onclick="markAsUnpaid('${load.id}')" 
                class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">
          Desmarcar Pagada
        </button>
      </td>
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
          <th class="p-2 text-left">Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}// ==============================
// EVENT LISTENERS
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('finances-expense-modal', () => {
    // Listeners para botones de Reportes
    const generatePLBtn = document.getElementById("generatePLBtn");
    const generateTaxBtn = document.getElementById("generateTaxBtn");
    const exportBtn = document.getElementById("exportBtn");

    if (generatePLBtn) {
      generatePLBtn.addEventListener("click", () => {
        debugLog("Generando Estado de Resultados...");
        generatePLReport();
      });
    }

    if (generateTaxBtn) {
      generateTaxBtn.addEventListener("click", () => {
        debugLog("Generando Reporte Fiscal...");
        generateTaxReport();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        debugLog("Exportando datos...");
        exportFinancialData();
      });
    }
  });
});

//  Se ejecuta cuando el DOM ya est listo
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('finances-export-buttons', () => {
    debugFinances(" DOM cargado - Configurando event listeners");
  });

  //  Evento personalizado: cuando se guarda algo (ej: nueva carga o gasto)
  document.addEventListener("loadSaved", () => {
    debugFinances(" loadSaved disparado  refrescando finanzas");

    if (!window.currentUser) {
      debugFinances(" No hay usuario logueado, no se recargan finanzas");
      return;
    }

    if (financesLoaded) {
      setTimeout(() => {
        loadFinancesData();
      }, 500);
    } else {
      debugFinances(" Finances an no estaban cargadas al recibir loadSaved");
    }
  });
});

// Event listener para selectores de reportes
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('finances-status-filter', () => {
    const reportYear = document.getElementById("reportYear");
    const reportMonth = document.getElementById("reportMonth");

    if (reportYear) {
      reportYear.addEventListener("change", () => {
        const reportModal = document.getElementById("reportModal");
        if (reportModal && !reportModal.classList.contains("hidden")) {
          // Si el modal de reporte está visible, regenerarlo
          setTimeout(() => {
            applyFilter("reports");
            setTimeout(() => generatePLReport(), 300);
          }, 100);
        }
      });
    }

    if (reportMonth) {
      reportMonth.addEventListener("change", () => {
        const reportModal = document.getElementById("reportModal");
        if (reportModal && !reportModal.classList.contains("hidden")) {
          // Si el modal de reporte está visible, regenerarlo
          setTimeout(() => {
            applyFilter("reports");
            setTimeout(() => generatePLReport(), 300);
          }, 100);
        }
      });
    }
  });
});

// ===== FUNCIN DE EFICIENCIA =====
function calculateEfficiency() {
  if (financesData.length === 0) return 0;

  // Anlisis: cargas con buen RPM vs total
  const goodRpmLoads = financesData.filter(load => {
    const rpm = load.totalMiles > 0 ? load.totalCharge / load.totalMiles : 0;
    return rpm >= 1.0; // RPM mayor a $1.00 se considera bueno
  }).length;

  return Math.round((goodRpmLoads / financesData.length) * 100);
}

// ===== GRFICO COMBINADO MEJORADO =====
function updateCashFlowChartEnhanced() {
  const canvas = document.getElementById('cashFlowChart');
  if (!canvas) return;

  // Destruir grfico existente
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

  // Crear grfico (barras si es un mes, lneas si son varios)
  const chartType = labels.length === 1 ? 'bar' : 'line';

  window.cashFlowChart = new Chart(canvas, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [
        {
          label: window.i18n?.t('finances.chart_revenue') || 'Revenue',
          data: revenues,
          borderColor: '#10b981',
          backgroundColor: chartType === 'bar' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        },
        {
          label: window.i18n?.t('finances.chart_expenses_label') || 'Expenses',
          data: expenses,
          borderColor: '#ef4444',
          backgroundColor: chartType === 'bar' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        },
        {
          label: window.i18n?.t('finances.chart_profit') || 'Profit',
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
            padding: 20,
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e2e8f0' : '#334155'
          }
        }
      },
      scales: {
        x: { ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e2e8f0' : '#475569' }, grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.07)' } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return '$' + value.toLocaleString();
            },
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e2e8f0' : '#475569'
          }
        }
      }
    }
  });

  debugLog("OK Grfico combinado mejorado actualizado");
}

// ===== GRFICO DE TENDENCIA RPM =====
function updateRpmTrendChart() {
  const canvas = document.getElementById('rpmTrendChart');
  if (!canvas) {
    debugLog(" Canvas rpmTrendChart no encontrado");
    return;
  }

  // Destruir grfico existente
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

  // Si solo hay un mes, usar grfico de barras
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
          position: 'top',
          labels: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e2e8f0' : '#334155' }
        }
      },
      scales: {
        x: { ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e2e8f0' : '#475569' }, grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.07)' } },
        y: {
          beginAtZero: true,
          ticks: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e2e8f0' : '#475569',
            callback: function (value) {
              return '$' + value.toFixed(2);
            }
          }
        }
      }
    }
  });

  debugLog("OK Grfico RPM Trend actualizado");
}

// ===== GRFICO DE DISTRIBUCIN DE CARGAS =====
function updateLoadDistributionChart() {
  const canvas = document.getElementById('loadDistributionChart');
  if (!canvas) {
    debugLog("[TARGET] Canvas loadDistributionChart no encontrado");
    return;
  }

  // Destruir grfico existente
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

  debugLog("OK Grfico de distribucin de cargas actualizado");
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
//  FUNCIONES CORREGIDAS PARA finances.js
// ===============================

// OK 1. FUNCIN markAsPaid CORREGIDA
async function markAsPaid(loadId) {
  try {
    const paymentDate = new Date().toISOString().split('T')[0];

    // OK CORREGIDO: Guardar actualPaymentDate + paymentDate
    await firebase.firestore().collection("loads").doc(loadId).update({
      paymentStatus: "paid",
      actualPaymentDate: paymentDate,  // OK CAMPO CORRECTO para filtro
      paymentDate: paymentDate,        // OK Mantener por compatibilidad
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // OK CORREGIDO: Actualizar en memoria ambos campos
    const load = window.allFinancesData.find(l => l.id === loadId);
    if (load) {
      load.paymentStatus = "paid";
      load.actualPaymentDate = paymentDate;  // OK CAMPO CORRECTO
      load.paymentDate = paymentDate;        // OK Compatibilidad
    }

    debugLog("OK Carga marcada como pagada:", loadId);
    loadAccountsData();
    showMessage("Carga marcada como pagada exitosamente", "success");
  } catch (error) {
    debugLog(" Error marcando como pagada:", error);
    showMessage("Error al marcar como pagada", "error");
  }
}

// OK 2. FUNCIN renderPendingLoads CORREGIDA  
function renderPendingLoads(loads) {
  const listEl = document.getElementById("accountsList");
  if (!listEl) return;

  debugLog(" Organizando datos de cuentas...");

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

  debugLog(` Cargas organizadas: ${pendingLoads.length} pendientes, ${overdueLoads.length} vencidas, ${paidLoads.length} pagadas`);

  // OK RENDERIZAR SEGN EL FILTRO SELECCIONADO
  let html = '';

  if (statusFilter === 'paid') {
    //  MOSTRAR SOLO CARGAS PAGADAS
    if (paidLoads.length === 0) {
      html = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">✅</div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">${window.i18n?.t('finances.no_paid_loads') || 'No paid loads'}</h3>
          <p class="text-gray-500">${window.i18n?.t('finances.paid_loads_appear_here') || 'Paid loads will appear here'}</p>
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
          <td class="p-2 text-sm text-green-600 font-medium">${window.i18n?.t('finances.status_paid_text') || '✓ Paid'}</td>
        </tr>
      `).join('');

      html = `
        <div class="mb-4">
          <h3 class="text-lg font-bold text-green-700 mb-4">${window.i18n?.t('finances.paid_loads_title') || 'Paid Loads'} (${paidLoads.length})</h3>
          <div class="bg-green-50 border border-green-200 rounded-lg overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-green-100">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.expense_date') || 'Date'}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('history.col_company') || 'Company'}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('history.col_load_num') || 'Load #'}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.expense_amount') || 'Amount'}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.col_pay_date') || 'Payment Date'}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.status_label') || 'Status'}</th>
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
    //  MOSTRAR PENDIENTES Y VENCIDAS (cdigo original)
    const activePending = pendingLoads.filter(load => !overdueLoads.includes(load));
    const totalPaid = paidLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0);

    // Estado de Cargas Vencidas
    html += overdueLoads.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-red-700 mb-4">${window.i18n?.t('finances.overdue_loads_title') || 'Overdue Loads'} (${overdueLoads.length})</h3>
        <div class="bg-red-50 border border-red-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-red-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">${window.i18n?.t('finances.expense_date') || 'Date'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">${window.i18n?.t('history.col_company') || 'Company'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">${window.i18n?.t('history.col_load_num') || 'Load #'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">${window.i18n?.t('finances.expense_amount') || 'Amount'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">${window.i18n?.t('finances.overdue_since_label') || 'Overdue Since'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">${window.i18n?.t('history.col_actions') || 'Action'}</th>
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
                    <td class="px-4 py-3 text-sm text-red-600">${daysOverdue} ${window.i18n?.t('finances.overdue_days_label') || 'days'}</td>
                    <td class="px-4 py-3 text-sm">
                      <button onclick="markAsPaid('${load.id}')"
                              class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                        ${window.i18n?.t('finances.status_paid') || 'Mark Paid'}
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

    // Estado de Cargas Pendientes
    html += activePending.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-yellow-700 mb-4">⏳ ${window.i18n?.t('finances.pending_loads_title') || 'Pending Loads'} (${activePending.length})</h3>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-yellow-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">${window.i18n?.t('finances.col_load_date') || 'Load Date'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">${window.i18n?.t('history.col_company') || 'Company'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">${window.i18n?.t('history.col_load_num') || 'Load #'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">${window.i18n?.t('finances.expense_amount') || 'Amount'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">${window.i18n?.t('finances.col_expected_pay') || 'Expected Payment'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">${window.i18n?.t('finances.col_action') || 'Action'}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-yellow-200">
              ${activePending.map(load => `
                <tr class="bg-yellow-50">
                  <td class="px-4 py-3 text-sm">${load.date}</td>
                  <td class="px-4 py-3 text-sm font-medium">${load.companyName || '-'}</td>
                  <td class="px-4 py-3 text-sm">${load.loadNumber || '-'}</td>
                  <td class="px-4 py-3 text-sm font-bold text-yellow-900">${formatCurrency(load.totalCharge)}</td>
                  <td class="px-4 py-3 text-sm">${load.expectedPaymentDate || (window.i18n?.t('finances.calculating') || 'Calculating...')}</td>
                  <td class="px-4 py-3 text-sm">
                    <button onclick="markAsPaid('${load.id}')"
                            class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                      ${window.i18n?.t('finances.mark_paid') || 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <div class="text-4xl mb-3">📭</div>
        <h3 class="text-lg font-bold text-gray-700 mb-1">${window.i18n?.t('finances.no_active_accounts') || 'No active accounts'}</h3>
        <p class="text-gray-500 max-w-md mx-auto">
          ${window.i18n?.t('finances.active_accounts_desc') || 'Loads marked as Paid or Pending will appear here to track your collections.'}
        </p>
      </div>
    `;

    // Tabla completa de Cargas Pagadas cuando filtro es "Todos"
    html += paidLoads.length > 0 && statusFilter === '' ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-green-700 mb-4">${window.i18n?.t('finances.paid_loads_title') || 'Paid Loads'} (${paidLoads.length})</h3>
        <div class="bg-green-50 border border-green-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-green-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.expense_date') || 'Date'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('history.col_company') || 'Company'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('history.col_load_num') || 'Load #'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.expense_amount') || 'Amount'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.col_pay_date') || 'Payment Date'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.status_label') || 'Status'}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">${window.i18n?.t('finances.col_actions_label') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-green-200">
              ${paidLoads.map(load => `
                <tr class="bg-green-50">
                  <td class="p-2 text-sm">${load.date}</td>
                  <td class="p-2 text-sm">${load.companyName || '-'}</td>
                  <td class="p-2 text-sm">${load.loadNumber || '-'}</td>
                  <td class="p-2 text-sm font-semibold text-green-900">${formatCurrency(load.totalCharge)}</td>
                  <td class="p-2 text-sm">${load.actualPaymentDate || load.paymentDate || '-'}</td>
                  <td class="p-2 text-sm text-green-600 font-medium">${window.i18n?.t('finances.status_paid_text') || '✓ Paid'}</td>
                  <td class="p-2 text-sm">
                    <button onclick="markAsUnpaid('${load.id}')"
                            class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">
                      ${window.i18n?.t('finances.unmark_paid') || 'Unmark'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : paidLoads.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-green-700 mb-4">${window.i18n?.t('finances.paid_summary_title') || 'Paid Loads Summary'}</h3>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-green-800">
            ${(window.i18n?.t('finances.paid_summary_text') || '{{count}} loads have been paid for a total of {{amount}}').replace('{{count}}', `<strong>${paidLoads.length}</strong>`).replace('{{amount}}', `<strong>${formatCurrency(totalPaid)}</strong>`)}
          </p>
        </div>
      </div>
    ` : '';

    // Mensaje cuando no hay cargas
    if (allLoads.length === 0) {
      html = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4"></div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">${window.i18n?.t('finances.no_loads_to_manage') || 'No loads to manage'}</h3>
          <p class="text-gray-500">${window.i18n?.t('finances.loads_appear_here') || 'Loads appear here when they have payment information'}</p>
        </div>
      `;
    }
  }

  listEl.innerHTML = html;
}

// OK Sobrescribir la funcin global
window.renderPendingLoads = renderPendingLoads;

debugLog(" Funcin renderPendingLoads corregida y aplicada");
debugLog("Ahora prueba cambiar el filtro a 'Pagadas'");

// Actualizar la funcin loadAccountsData para usar las nuevas funciones
function loadAccountsDataImproved() {
  debugLog(" Cargando sistema de cuentas mejorado...");

  if (!window.allFinancesData || window.allFinancesData.length === 0) {
    debugLog("No hay datos de cargas disponibles");
    return;
  }

  // Obtener perodo seleccionado
  const yearEl = document.getElementById("accountsYear");
  const monthEl = document.getElementById("accountsMonth");
  const year = yearEl?.value || "";
  const month = monthEl?.value || "";

  // Filtrar cargas por perodo
  let filteredLoads = window.allFinancesData;
  if (year && month) {
    const period = `${year}-${month.padStart(2, '0')}`;
    filteredLoads = filteredLoads.filter(load => load.date && load.date.startsWith(period));
  } else if (year) {
    filteredLoads = filteredLoads.filter(load => load.date && load.date.startsWith(year));
  }

  debugLog(`Procesando ${filteredLoads.length} cargas para cuentas`);

  // Renderizar cargas pendientes y pagadas
  renderPendingLoads(filteredLoads);

  // Si existe renderPaidLoads, tambin actualizarla
  if (typeof renderPaidLoads === 'function') {
    const paidLoads = filteredLoads.filter(load => load.actualPaymentDate);
    renderPaidLoads(paidLoads);
  }
}

// OK FUNCIN PARA CREAR TARJETAS DE RESUMEN EN CUENTAS
// Agregar a finances.js

function renderAccountsSummaryCards(loads) {
  const summaryEl = document.getElementById("accountsSummaryCards");
  if (!summaryEl) {
    debugLog(" Elemento accountsSummaryCards no encontrado");
    return;
  }

  debugLog(" Renderizando tarjetas de resumen...");

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

  debugLog(` Resumen: ${paidLoads.length} pagadas, ${activePendingLoads.length} pendientes, ${overdueLoads.length} vencidas`);

  // Renderizar tarjetas
  const t = (key, p) => window.i18n?.t(key, p) || '';
  summaryEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

      <!-- Paid -->
      <div class="bg-green-50 border-2 border-green-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-green-700 uppercase tracking-wide">${t('finances.status_paid') || 'Paid'}</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-green-900">${paidLoads.length}</p>
          <p class="text-sm text-green-600 mt-1">${t('finances.csv_total_loads') || 'loads'}</p>
        </div>
        <div class="mt-3 pt-3 border-t border-green-200">
          <p class="text-lg font-semibold text-green-800">${formatCurrency(paidTotal)}</p>
          <p class="text-xs text-green-600">${t('finances.csv_total_revenue') || 'Total collected'}</p>
        </div>
      </div>

      <!-- Pending (Uncollected) -->
      <div class="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-yellow-700 uppercase tracking-wide">${t('finances.status_pending') || 'Pending'}</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-yellow-900">${pendingLoads.length}</p>
          <p class="text-sm text-yellow-600 mt-1">${t('finances.csv_total_loads') || 'loads'}</p>
        </div>
        <div class="mt-3 pt-3 border-t border-yellow-200">
          <p class="text-lg font-semibold text-yellow-800">${formatCurrency(pendingLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0))}</p>
          <p class="text-xs text-yellow-600">${t('finances.pending_label') || 'Pending'}</p>
        </div>
      </div>

      <!-- Overdue -->
      <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-red-700 uppercase tracking-wide">${t('finances.status_overdue') || 'Overdue'}</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-red-900">${overdueLoads.length}</p>
          <p class="text-sm text-red-600 mt-1">${t('finances.csv_total_loads') || 'loads'}</p>
        </div>
        <div class="mt-3 pt-3 border-t border-red-200">
          <p class="text-lg font-semibold text-red-800">${formatCurrency(overdueTotal)}</p>
          <p class="text-xs text-red-600">${t('finances.overdue_section_title') || 'Overdue'}</p>
        </div>
      </div>

    </div>
  `;
}

// ======================================================
// LEX: Análisis financiero desde la burbuja
// ======================================================
window.analyzeLexFinances = async function () {
  try {
    debugFinances(" [LEX-FINANCES] Iniciando análisis financiero con Lex...");

    // Asegurar que LexAI esté listo
    if (!window.lexAI && typeof LexAI === "function") {
      window.lexAI = new LexAI();
      await window.lexAI.initializeContext();
    }

    // 1. Determinar período actual (según selects de Finanzas)
    const _isEsFinPeriod = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    let periodLabel = _isEsFinPeriod ? "todo el período" : "all periods";
    let periodKey = "all";

    if (typeof getSelectedPeriod === "function") {
      const { year, month } = getSelectedPeriod("global");
      if (year && month) {
        periodKey = `${year}-${month}`;
        periodLabel = `${year}-${month}`;
      } else if (year) {
        periodKey = year;
        periodLabel = _isEsFinPeriod ? `año ${year}` : `year ${year}`;
      }
    }

    // 2. Asegurar que tenemos datos en memoria (o cargarlos)
    if (
      (!Array.isArray(window.financesData) ||
        window.financesData.length === 0) &&
      typeof window.loadFinancesData === "function"
    ) {
      debugFinances(
        " [LEX-FINANCES] No había datos cargados, llamando a loadFinancesData..."
      );
      const result = await window.loadFinancesData(
        periodKey === "all" ? "all" : periodKey
      );
      window.financesData = result.loads || [];
      window.expensesData = result.expenses || [];
    }

    const allLoads = Array.isArray(window.financesData)
      ? window.financesData.slice()
      : [];
    const allExpenses = Array.isArray(window.expensesData)
      ? window.expensesData.slice()
      : [];

    // 3. Filtrar por período si no es "all"
    let loads = allLoads;
    let expenses = allExpenses;

    if (periodKey !== "all") {
      loads = allLoads.filter(
        (l) => typeof l.date === "string" && l.date.startsWith(periodKey)
      );
      expenses = allExpenses.filter(
        (e) => typeof e.date === "string" && e.date.startsWith(periodKey)
      );
    }

    if (
      (!loads || loads.length === 0) &&
      (!expenses || expenses.length === 0)
    ) {
      debugFinances(
        " [LEX-FINANCES] No hay datos para el período seleccionado"
      );
      if (window.setLexState) {
        window.setLexState("sad", {
          message: _isEsFinPeriod
            ? `No tengo datos financieros para ${periodLabel} todavía 😕`
            : `No financial data found for ${periodLabel} yet 😕`,
          duration: 5000,
        });
      }
      alert("No hay datos financieros en este período para analizar con Lex.");
      return null;
    }

    // 4. Calcular KPIs reutilizando la lógica existente
    let kpis = null;
    if (typeof calculateKPIs === "function") {
      kpis = calculateKPIs(loads, expenses);
    } else {
      // Fallback muy básico si algo falla
      const totalRevenue = loads.reduce(
        (s, l) => s + (Number(l.totalCharge) || 0),
        0
      );
      const totalExpenses = expenses.reduce(
        (s, e) => s + (Number(e.amount) || 0),
        0
      );
      const netProfit = totalRevenue - totalExpenses;
      const margin =
        totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const totalMiles = loads.reduce(
        (s, l) => s + (Number(l.totalMiles) || 0),
        0
      );
      const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

      kpis = {
        totalRevenue,
        totalExpenses,
        netProfit,
        margin,
        totalMiles,
        avgRpm,
      };
    }

    const numLoads = loads.length;
    const numExpenses = expenses.length;
    const avgRevenuePerLoad =
      numLoads > 0 ? kpis.totalRevenue / numLoads : 0;
    const avgExpensePerLoad =
      numLoads > 0 ? kpis.totalExpenses / numLoads : 0;

    // 5. Decidir "estado emocional" de Lex según los números
    let lexState = "thinking";
    const margin = Number(kpis.margin || 0);
    const netProfit = Number(kpis.netProfit || 0);

    const _isEsFin = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const insights = [];
    const alerts = [];

    if (netProfit <= 0 || margin <= 5) {
      lexState = "sad";
      alerts.push(_isEsFin
        ? "Este período está muy ajustado o en pérdida. Revisa tarifas mínimas y gastos fijos."
        : "This period is very tight or at a loss. Review your minimum rates and fixed expenses."
      );
    } else if (netProfit > 0 && margin >= 20) {
      lexState = "happy";
      insights.push(_isEsFin
        ? "Buen margen de ganancia, tu operación se ve saludable en este período."
        : "Good profit margin — your operation looks healthy this period."
      );
    } else {
      lexState = "thinking";
      insights.push(_isEsFin
        ? "Período estable, pero con espacio para mejorar margen y control de costos."
        : "Stable period, but there's room to improve your margin and cost control."
      );
    }

    if (numLoads > 0 && avgRevenuePerLoad > 0) {
      insights.push(_isEsFin
        ? `Ingreso promedio por carga: $${avgRevenuePerLoad.toFixed(0)}`
        : `Revenue per load: $${avgRevenuePerLoad.toFixed(0)}`
      );
    }
    if (numLoads > 0 && avgExpensePerLoad > 0) {
      alerts.push(_isEsFin
        ? `Gasto promedio por carga: $${avgExpensePerLoad.toFixed(0)}`
        : `Expense per load: $${avgExpensePerLoad.toFixed(0)}`
      );
    }

    // 6. Mensaje corto para la burbuja
    const safeNumber = (n, dec = 0) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return "--";
      return v.toFixed(dec);
    };

    const parts = [];
    parts.push(`${_isEsFin ? 'Período' : 'Period'}: ${periodLabel}`);
    parts.push(`${_isEsFin ? 'Ingresos' : 'Revenue'}: $${safeNumber(kpis.totalRevenue, 0)}`);
    parts.push(`${_isEsFin ? 'Gastos' : 'Expenses'}: $${safeNumber(kpis.totalExpenses, 0)}`);
    parts.push(`${_isEsFin ? 'Ganancia' : 'Profit'}: $${safeNumber(kpis.netProfit, 0)}`);
    parts.push(`${_isEsFin ? 'Margen' : 'Margin'}: ${safeNumber(kpis.margin, 1)}%`);
    if (kpis.totalMiles) {
      parts.push(`RPM: $${safeNumber(kpis.avgRpm, 2)}/mi`);
    }
    if (numLoads) {
      parts.push(`${_isEsFin ? 'Cargas' : 'Loads'}: ${numLoads}`);
    }
    if (numExpenses) {
      parts.push(`${_isEsFin ? 'Gastos registrados' : 'Recorded expenses'}: ${numExpenses}`);
    }

    let prefix = "";
    if (lexState === "happy") {
      prefix = _isEsFin ? "✅ Buen período, tus números van bien.\n" : "✅ Good period, your numbers look solid.\n";
    } else if (lexState === "sad") {
      prefix = _isEsFin ? "⚠️ Ojo, este período está ajustado.\n" : "⚠️ Watch out, this period is tight.\n";
    } else {
      prefix = _isEsFin ? "📊 Te resumo tus finanzas:\n" : "📊 Here's your financial summary:\n";
    }

    if (window.setLexState) {
      window.setLexState(lexState, {
        message: prefix + parts.join(" · "),
        duration: 8000,
      });
    }

    // 7. Construir análisis para el MODAL de Lex
    const analysis = {
      periodLabel,
      totalRevenue: Number(kpis.totalRevenue || 0),
      totalExpenses: Number(kpis.totalExpenses || 0),
      netProfit: Number(kpis.netProfit || 0),
      margin: Number(kpis.margin || 0),
      totalMiles: Number(kpis.totalMiles || 0),
      avgRpm: Number(kpis.avgRpm || 0),
      numLoads,
      numExpenses,
      avgRevenuePerLoad,
      avgExpensePerLoad,
      insights,
      alerts,
      summary:
        lexState === "happy"
          ? (_isEsFin
              ? "Buen balance entre ingresos y gastos. Mantén este nivel de tarifas y control de costos."
              : "Good balance between revenue and expenses. Keep this rate level and cost control up.")
          : lexState === "sad"
            ? (_isEsFin
                ? "Este período se ve apretado. Puede ser buen momento para ajustar tarifas mínimas y revisar tus principales gastos."
                : "This period looks tight. It may be a good time to adjust your minimum rates and review your main expenses.")
            : (_isEsFin
                ? "Tus números están en un punto intermedio. Con pequeños ajustes podrías mejorar bastante tu margen."
                : "Your numbers are in the middle range. Small adjustments could significantly improve your margin."),
    };

    // 8. Mostrar MODAL financiero de Lex si está disponible
    if (
      window.lexAI &&
      typeof window.lexAI.showFinanceAnalysisModal === "function"
    ) {
      window.lexAI.showFinanceAnalysisModal(analysis);
    }

    debugFinances(" [LEX-FINANCES] Análisis completado:", {
      kpis,
      numLoads,
      numExpenses,
    });

    return { kpis, loads, expenses, periodKey, periodLabel };
  } catch (err) {
    debugLog("[LEX-FINANCES] Error en analyzeLexFinances:", err);
    if (window.setLexState) {
      window.setLexState("warning", {
        message: "Tuve un problema al leer tus datos financieros 🛠️",
        duration: 5000,
      });
    }
    return null;
  }
};



// Exponer las funciones globalmente
window.calculateOverdueDays = calculateOverdueDays;
window.updatePaymentStatus = updatePaymentStatus;
window.renderPendingLoads = renderPendingLoads;
window.loadAccountsDataImproved = loadAccountsDataImproved;
// ==============================================================================
// COMPREHENSIVE FINANCIAL REPORT - CALCULATION FUNCTIONS
// ==============================================================================

/**
 * Calculate Cash Flow Analysis
 * Returns detailed cash flow breakdown and aging report
 */
function calculateCashFlowAnalysis(loads, expenses) {
  const today = new Date();

  // Separate paid vs unpaid loads
  const paidLoads = loads.filter(l => l.actualPaymentDate);
  const unpaidLoads = loads.filter(l => !l.actualPaymentDate);

  // Cash Inflows (paid loads)
  const cashInflows = paidLoads.reduce((sum, l) => sum + (Number(l.totalCharge) || 0), 0);

  // Cash Outflows (all expenses)
  const cashOutflows = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Net Cash Flow
  const netCashFlow = cashInflows - cashOutflows;

  // Aging Report for Accounts Receivable
  const aging = {
    current: { count: 0, amount: 0 },      // 0-30 days
    days31_60: { count: 0, amount: 0 },    // 31-60 days
    days61_90: { count: 0, amount: 0 },    // 61-90 days
    over90: { count: 0, amount: 0 }        // >90 days
  };

  unpaidLoads.forEach(load => {
    const expectedDate = load.expectedPaymentDate ? new Date(load.expectedPaymentDate) : new Date(load.date);
    const daysOverdue = Math.floor((today - expectedDate) / (1000 * 60 * 60 * 24));
    const amount = Number(load.totalCharge) || 0;

    if (daysOverdue <= 30) {
      aging.current.count++;
      aging.current.amount += amount;
    } else if (daysOverdue <= 60) {
      aging.days31_60.count++;
      aging.days31_60.amount += amount;
    } else if (daysOverdue <= 90) {
      aging.days61_90.count++;
      aging.days61_90.amount += amount;
    } else {
      aging.over90.count++;
      aging.over90.amount += amount;
    }
  });

  // Total outstanding
  const totalOutstanding = unpaidLoads.reduce((sum, l) => sum + (Number(l.totalCharge) || 0), 0);

  return {
    cashInflows,
    cashOutflows,
    netCashFlow,
    aging,
    totalOutstanding,
    paidCount: paidLoads.length,
    unpaidCount: unpaidLoads.length
  };
}

/**
 * Calculate Performance Metrics
 * Returns key financial ratios and efficiency metrics
 */
function calculatePerformanceMetrics(loads, expenses, totalRevenue, totalExpenses, netProfit) {
  const totalMiles = loads.reduce((sum, l) => sum + (Number(l.totalMiles) || 0), 0);
  const totalLoads = loads.length;

  // Operating Ratio (lower is better)
  const operatingRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  // Profit per Load
  const profitPerLoad = totalLoads > 0 ? netProfit / totalLoads : 0;

  // Profit per Mile
  const profitPerMile = totalMiles > 0 ? netProfit / totalMiles : 0;

  // Revenue per Mile (RPM)
  const revenuePerMile = totalMiles > 0 ? totalRevenue / totalMiles : 0;

  // Cost per Mile
  const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;

  // Break-even Revenue (expenses / (1 - target margin))
  // Assuming 20% target margin
  const targetMargin = 0.20;
  const breakEvenRevenue = totalExpenses / (1 - targetMargin);

  // Profit Margin
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Average Revenue per Load
  const avgRevenuePerLoad = totalLoads > 0 ? totalRevenue / totalLoads : 0;

  return {
    operatingRatio,
    profitPerLoad,
    profitPerMile,
    revenuePerMile,
    costPerMile,
    breakEvenRevenue,
    profitMargin,
    avgRevenuePerLoad,
    totalMiles,
    totalLoads
  };
}

/**
 * Calculate Trend Analysis
 * Compares current period with previous period
 */
function calculateTrendAnalysis(loads, expenses, year, month) {
  // If no period specified, can't do comparison
  if (!year || !month) {
    return {
      hasPreviousPeriod: false,
      message: 'Seleccione un período específico para ver comparaciones'
    };
  }

  // Calculate previous period
  let prevYear = year;
  let prevMonth = parseInt(month) - 1;

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = (parseInt(year) - 1).toString();
  }

  const prevMonthStr = prevMonth.toString().padStart(2, '0');
  const prevPeriod = `${prevYear}-${prevMonthStr}`;
  const currentPeriod = `${year}-${month.padStart(2, '0')}`;

  // Filter previous period data
  const prevLoads = window.allFinancesData?.filter(l => l.date && l.date.startsWith(prevPeriod)) || [];
  const prevExpenses = window.allExpensesData?.filter(e => e.date && e.date.startsWith(prevPeriod)) || [];

  // If no previous data, return early
  if (prevLoads.length === 0) {
    return {
      hasPreviousPeriod: false,
      message: 'No hay datos del período anterior para comparar'
    };
  }

  // Current period metrics
  const currentRevenue = loads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const currentExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const currentProfit = currentRevenue - currentExpenses;
  const currentLoads = loads.length;

  // Previous period metrics
  const prevRevenue = prevLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const prevExpensesTotal = prevExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const prevProfit = prevRevenue - prevExpenses;
  const prevLoadsCount = prevLoads.length;

  // Calculate changes
  const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const expenseChange = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
  const profitChange = prevProfit !== 0 ? ((currentProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;
  const loadsChange = prevLoadsCount > 0 ? ((currentLoads - prevLoadsCount) / prevLoadsCount) * 100 : 0;

  return {
    hasPreviousPeriod: true,
    current: {
      revenue: currentRevenue,
      expenses: currentExpenses,
      profit: currentProfit,
      loads: currentLoads
    },
    previous: {
      revenue: prevRevenue,
      expenses: prevExpenses,
      profit: prevProfit,
      loads: prevLoadsCount
    },
    changes: {
      revenue: revenueChange,
      expenses: expenseChange,
      profit: profitChange,
      loads: loadsChange
    },
    prevPeriodLabel: `${getMonthName(prevMonthStr)} ${prevYear}`
  };
}

// Helper function for month names
function getMonthName(month) {
  const monthNames = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };
  return monthNames[month] || month;
}


// ==============================================================================
// COMPREHENSIVE FINANCIAL REPORT - MAIN FUNCTION
// ==============================================================================

/**
 * Generate Comprehensive Financial Report
 * Main function that creates a robust professional financial report
 */
function generateComprehensiveReport() {
  debugLog(" Generando Reporte Financiero Completo...");

  // Open modal with loading
  openReportModal('pl', 'Reporte Financiero Completo', 'Cargando datos...', '');

  const reportContent = document.getElementById("reportContent");
  if (reportContent) {
    reportContent.innerHTML = '<div class="flex flex-col items-center justify-center p-12"><div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div><p class="text-gray-600">Generando reporte completo...</p></div>';
  }

  // Check data availability
  if (!window.financesData || !window.expensesData) {
    if (reportContent) {
      reportContent.innerHTML = '<div class="text-center p-12 text-red-500"><span class="text-4xl block mb-3"></span><p>No hay datos suficientes para generar el reporte</p></div>';
    }
    return;
  }

  // Get filtered data
  const filteredLoads = window.financesData || [];
  const filteredExpenses = window.expensesData || [];

  // Get period info
  const year = document.getElementById("reportYear")?.value || "";
  const month = document.getElementById("reportMonth")?.value || "";

  let periodLabel = "Todos los períodos";
  if (year && month) {
    periodLabel = `${getMonthName(month.padStart(2, '0'))} ${year}`;
  } else if (year) {
    periodLabel = `Año ${year}`;
  }

  // ===== CALCULATIONS =====

  // Basic financials
  const totalRevenue = filteredLoads.reduce((s, l) => s + (Number(l.totalCharge) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalMiles = filteredLoads.reduce((s, l) => s + (Number(l.totalMiles) || 0), 0);
  const totalLoads = filteredLoads.length;

  // Advanced calculations
  const cashFlowAnalysis = calculateCashFlowAnalysis(filteredLoads, filteredExpenses);
  const performanceMetrics = calculatePerformanceMetrics(filteredLoads, filteredExpenses, totalRevenue, totalExpenses, netProfit);
  const trendAnalysis = calculateTrendAnalysis(filteredLoads, filteredExpenses, year, month);

  // ===== RENDER REPORT =====

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (!reportContent) {
    debugLog(" reportContent container not found");
    return;
  }

  reportContent.innerHTML = `
    <!-- Professional Header -->
    <div class="text-center mb-6 pb-4 border-b-2 border-blue-200">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-2"> Reporte Financiero Completo</h1>
      <h2 class="text-lg md:text-xl text-white/90 font-semibold mb-1">Expediter Load Calculator</h2>
      <p class="text-sm text-white/80">Período: <span class="font-semibold">${periodLabel}</span></p>
      <p class="text-xs text-white/60">Generado el ${currentDate}</p>
    </div>
    
    ${renderExecutiveSummary(totalRevenue, totalExpenses, netProfit, performanceMetrics, cashFlowAnalysis, totalLoads)}
    
    ${renderCashFlowSection(cashFlowAnalysis)}
    
    ${renderPerformanceMetricsSection(performanceMetrics, totalRevenue)}
    
    ${renderTrendAnalysisSection(trendAnalysis)}
    
    <!-- Footer Note -->
    <div class="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-400/30">
      <p class="text-xs text-white/70 text-center">
         Este reporte proporciona un análisis completo de la salud financiera de tu negocio.
        Úsalo para tomar decisiones informadas sobre operaciones, precios y crecimiento.
      </p>
    </div>
  `;

  // Update modal subtitle
  const subtitleEl = document.getElementById("reportModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `Período: ${periodLabel}`;

  debugLog(" Reporte Financiero Completo generado exitosamente");
}


// ==============================================================================
// RENDER FUNCTIONS FOR EACH SECTION
// ==============================================================================

/**
 * Render Executive Summary Section
 */
function renderExecutiveSummary(totalRevenue, totalExpenses, netProfit, metrics, cashFlow, loads) {
  const profitMarginClass = netProfit >= 0 ? 'text-green-400' : 'text-red-400';
  const profitIcon = netProfit >= 0 ? '' : '';

  // Health Score (0-100)
  let healthScore = 50; // Base score
  if (metrics.profitMargin > 20) healthScore += 20;
  else if (metrics.profitMargin > 10) healthScore += 10;
  else if (metrics.profitMargin < 0) healthScore -= 20;

  if (metrics.operatingRatio < 80) healthScore += 15;
  else if (metrics.operatingRatio > 95) healthScore -= 15;

  if (cashFlow.netCashFlow > 0) healthScore += 15;
  else healthScore -= 15;

  healthScore = Math.max(0, Math.min(100, healthScore)); // Clamp 0-100

  const healthColor = healthScore >= 70 ? 'green' : healthScore >= 40 ? 'yellow' : 'red';
  const healthLabel = healthScore >= 70 ? 'Excelente' : healthScore >= 40 ? 'Buena' : 'Requiere Atención';

  return `
    <div class="mb-6">
      <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span></span> Executive Summary
      </h2>
      
      <!-- Health Score -->
      <div class="mb-4 p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-white/20">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-white/80">Salud Financiera</span>
          <span class="text-lg font-bold text-${healthColor}-400">${healthScore}/100 - ${healthLabel}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-3">
          <div class="bg-gradient-to-r from-${healthColor}-500 to-${healthColor}-400 h-3 rounded-full transition-all" style="width: ${healthScore}%"></div>
        </div>
      </div>
      
      <!-- KPI Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        <!-- Revenue -->
        <div class="bg-gradient-to-br from-blue-600/40 to-blue-800/40 p-4 rounded-lg border border-blue-400/30">
          <div class="text-xs text-white/95 mb-1">💰 Ingresos</div>
          <div class="text-lg md:text-xl font-bold text-white">${formatCurrency(totalRevenue)}</div>
          <div class="text-xs text-white/90 mt-1">${loads} cargas</div>
        </div>
        
        <!-- Expenses -->
        <div class="bg-gradient-to-br from-red-600/40 to-red-800/40 p-4 rounded-lg border border-red-400/30">
          <div class="text-xs text-white/95 mb-1">💸 Gastos</div>
          <div class="text-lg md:text-xl font-bold text-white">${formatCurrency(totalExpenses)}</div>
          <div class="text-xs text-white/90 mt-1">${((totalExpenses / totalRevenue) * 100).toFixed(1)}% de ingresos</div>
        </div>
        
        <!-- Net Profit -->
        <div class="bg-gradient-to-br from-green-600/40 to-green-800/40 p-4 rounded-lg border border-green-400/30">
          <div class="text-xs text-white/95 mb-1">${profitIcon} Ganancia Neta</div>
          <div class="text-lg md:text-xl font-bold ${profitMarginClass}">${formatCurrency(netProfit)}</div>
          <div class="text-xs text-white/90 mt-1">Margen: ${metrics.profitMargin.toFixed(1)}%</div>
        </div>
        
        <!-- Operating Ratio -->
        <div class="bg-gradient-to-br from-purple-600/40 to-purple-800/40 p-4 rounded-lg border border-purple-400/30">
          <div class="text-xs text-white/95 mb-1">⚙️ Operating Ratio</div>
          <div class="text-lg md:text-xl font-bold text-white">${metrics.operatingRatio.toFixed(1)}%</div>
          <div class="text-xs text-white/90 mt-1">${metrics.operatingRatio < 90 ? '✅ Excelente' : metrics.operatingRatio < 95 ? '✔️ Aceptable' : '⚠️ Alto'}</div>
        </div>
        
        <!-- Profit per Load -->
        <div class="bg-gradient-to-br from-cyan-600/40 to-cyan-800/40 p-4 rounded-lg border border-cyan-400/30">
          <div class="text-xs text-white/95 mb-1">💵 Ganancia/Carga</div>
          <div class="text-lg md:text-xl font-bold text-white">${formatCurrency(metrics.profitPerLoad)}</div>
          <div class="text-xs text-white/90 mt-1">Promedio</div>
        </div>
        
        <!-- Profit per Mile -->
        <div class="bg-gradient-to-br from-teal-600/40 to-teal-800/40 p-4 rounded-lg border border-teal-400/30">
          <div class="text-xs text-white/95 mb-1">🛣️ Ganancia/Milla</div>
          <div class="text-lg md:text-xl font-bold text-white">${formatCurrency(metrics.profitPerMile)}</div>
          <div class="text-xs text-white/90 mt-1">${metrics.totalMiles.toLocaleString()} millas</div>
        </div>
        
        <!-- Cash Flow -->
        <div class="bg-gradient-to-br from-amber-600/40 to-amber-800/40 p-4 rounded-lg border border-amber-400/30">
          <div class="text-xs text-white/95 mb-1">💰 Flujo de Efectivo</div>
          <div class="text-lg md:text-xl font-bold ${cashFlow.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(cashFlow.netCashFlow)}</div>
          <div class="text-xs text-white/90 mt-1">${cashFlow.netCashFlow >= 0 ? 'Positivo ✅' : 'Negativo ⚠️'}</div>
        </div>
        
        <!-- Outstanding AR -->
        <div class="bg-gradient-to-br from-orange-600/40 to-orange-800/40 p-4 rounded-lg border border-orange-400/30">
          <div class="text-xs text-white/95 mb-1">📋 Por Cobrar</div>
          <div class="text-lg md:text-xl font-bold text-white">${formatCurrency(cashFlow.totalOutstanding)}</div>
          <div class="text-xs text-white/90 mt-1">${cashFlow.unpaidCount} cargas pendientes</div>
        </div>
        
      </div>
    </div>
  `;
}


/**
 * Render Cash Flow Analysis Section
 */
function renderCashFlowSection(cashFlow) {
  const totalAging = cashFlow.aging.current.amount + cashFlow.aging.days31_60.amount +
    cashFlow.aging.days61_90.amount + cashFlow.aging.over90.amount;

  return `
    <div class="mb-6">
      <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span></span> Análisis de Flujo de Efectivo
      </h2>
      
      <!-- Cash Flow Summary -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="bg-green-900/30 p-4 rounded-lg border border-green-400/30">
          <div class="text-sm text-green-300 mb-1">Entradas de Efectivo</div>
          <div class="text-2xl font-bold text-green-400">${formatCurrency(cashFlow.cashInflows)}</div>
          <div class="text-xs text-green-300/90 mt-1">${cashFlow.paidCount} cargas pagadas</div>
        </div>
        
        <div class="bg-red-900/30 p-4 rounded-lg border border-red-400/30">
          <div class="text-sm text-red-300 mb-1">Salidas de Efectivo</div>
          <div class="text-2xl font-bold text-red-400">${formatCurrency(cashFlow.cashOutflows)}</div>
          <div class="text-xs text-red-300/90 mt-1">Gastos totales</div>
        </div>
        
        <div class="bg-blue-900/30 p-4 rounded-lg border border-blue-400/30">
          <div class="text-sm text-blue-300 mb-1">Flujo Neto</div>
          <div class="text-2xl font-bold ${cashFlow.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${formatCurrency(cashFlow.netCashFlow)}
          </div>
          <div class="text-xs text-blue-300/90 mt-1">${cashFlow.netCashFlow >= 0 ? 'Superávit ✅' : 'Déficit ⚠️'}</div>
        </div>
      </div>
      
      <!-- Aging Report -->
      <div class="bg-gray-900/50 p-4 rounded-lg border border-gray-600/30">
        <h3 class="text-lg font-semibold text-white mb-3"> Antigüedad de Cuentas por Cobrar</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-blue-900/50">
              <tr>
                <th class="px-3 py-2 text-left text-white font-semibold">Período</th>
                <th class="px-3 py-2 text-center text-white font-semibold">Cargas</th>
                <th class="px-3 py-2 text-right text-white font-semibold">Monto</th>
                <th class="px-3 py-2 text-right text-white font-semibold">% del Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr class="bg-green-900/20">
                <td class="px-3 py-2 text-white"> Actual (0-30 días)</td>
                <td class="px-3 py-2 text-center text-white">${cashFlow.aging.current.count}</td>
                <td class="px-3 py-2 text-right text-white font-semibold">${formatCurrency(cashFlow.aging.current.amount)}</td>
                <td class="px-3 py-2 text-right text-white">${totalAging > 0 ? ((cashFlow.aging.current.amount / totalAging) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr class="bg-yellow-900/20">
                <td class="px-3 py-2 text-white"> 31-60 días</td>
                <td class="px-3 py-2 text-center text-white">${cashFlow.aging.days31_60.count}</td>
                <td class="px-3 py-2 text-right text-white font-semibold">${formatCurrency(cashFlow.aging.days31_60.amount)}</td>
                <td class="px-3 py-2 text-right text-white">${totalAging > 0 ? ((cashFlow.aging.days31_60.amount / totalAging) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr class="bg-orange-900/20">
                <td class="px-3 py-2 text-white"> 61-90 días</td>
                <td class="px-3 py-2 text-center text-white">${cashFlow.aging.days61_90.count}</td>
                <td class="px-3 py-2 text-right text-white font-semibold">${formatCurrency(cashFlow.aging.days61_90.amount)}</td>
                <td class="px-3 py-2 text-right text-white">${totalAging > 0 ? ((cashFlow.aging.days61_90.amount / totalAging) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr class="bg-red-900/20">
                <td class="px-3 py-2 text-white"> Más de 90 días</td>
                <td class="px-3 py-2 text-center text-white">${cashFlow.aging.over90.count}</td>
                <td class="px-3 py-2 text-right text-white font-semibold">${formatCurrency(cashFlow.aging.over90.amount)}</td>
                <td class="px-3 py-2 text-right text-white">${totalAging > 0 ? ((cashFlow.aging.over90.amount / totalAging) * 100).toFixed(1) : 0}%</td>
              </tr>
            </tbody>
            <tfoot class="bg-blue-900/70">
              <tr>
                <td class="px-3 py-2 text-white font-bold">TOTAL</td>
                <td class="px-3 py-2 text-center text-white font-bold">${cashFlow.unpaidCount}</td>
                <td class="px-3 py-2 text-right text-white font-bold">${formatCurrency(cashFlow.totalOutstanding)}</td>
                <td class="px-3 py-2 text-right text-white font-bold">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        ${cashFlow.aging.over90.count > 0 ? `
          <div class="mt-3 p-3 bg-red-900/30 border border-red-400/30 rounded">
            <p class="text-sm text-red-300">
              <strong> Alerta:</strong> Tienes ${cashFlow.aging.over90.count} carga(s) con más de 90 días vencidas 
              por un total de ${formatCurrency(cashFlow.aging.over90.amount)}. Se recomienda tomar acción inmediata.
            </p>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}


/**
 * Render Performance Metrics Section
 */
function renderPerformanceMetricsSection(metrics, totalRevenue) {
  return `
    <div class="mb-6">
      <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span></span> Métricas de Desempeño
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Operating Ratio Card -->
        <div class="bg-gradient-to-br from-purple-900/40 to-purple-700/40 p-4 rounded-lg border border-purple-400/30">
          <h3 class="text-sm font-semibold text-purple-200 mb-2"> Operating Ratio</h3>
          <div class="text-3xl font-bold text-white mb-2">${metrics.operatingRatio.toFixed(1)}%</div>
          <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div class="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full" style="width: ${Math.min(metrics.operatingRatio, 100)}%"></div>
          </div>
          <p class="text-xs text-purple-200/90">
            ${metrics.operatingRatio < 80 ? '✅ Excelente eficiencia operativa' :
      metrics.operatingRatio < 90 ? '✔️ Buena eficiencia' :
        metrics.operatingRatio < 95 ? '➡️ Eficiencia aceptable' :
          '⚠️ Requiere optimización - costos muy altos'}
          </p>
          <p class="text-xs text-purple-200/90 mt-1">Menor es mejor (gastos/ingresos)</p>
        </div>
        
        <!-- Break-even Analysis -->
        <div class="bg-gradient-to-br from-amber-900/40 to-amber-700/40 p-4 rounded-lg border border-amber-400/30">
          <h3 class="text-sm font-semibold text-amber-200 mb-2"> Análisis de Punto de Equilibrio</h3>
          <div class="text-3xl font-bold text-white mb-2">${formatCurrency(metrics.breakEvenRevenue)}</div>
          <p class="text-xs text-amber-200/90 mb-2">
            Revenue necesario (con 20% margen objetivo)
          </p>
          ${totalRevenue >= metrics.breakEvenRevenue ? `
            <div class="flex items-center gap-2 text-green-400 text-sm">
              <span></span>
              <span>Sobre el punto de equilibrio</span>
            </div>
            <p class="text-xs text-green-300/90 mt-1">
              Exceso: ${formatCurrency(totalRevenue - metrics.breakEvenRevenue)}
            </p>
          ` : `
            <div class="flex items-center gap-2 text-red-400 text-sm">
              <span></span>
              <span>Bajo el punto de equilibrio</span>
            </div>
            <p class="text-xs text-red-300/90 mt-1">
              Faltante: ${formatCurrency(metrics.breakEvenRevenue - totalRevenue)}
            </p>
          `}
        </div>
        
        <!-- Revenue Metrics -->
        <div class="bg-gradient-to-br from-blue-900/40 to-blue-700/40 p-4 rounded-lg border border-blue-400/30">
          <h3 class="text-sm font-semibold text-blue-200 mb-3"> Métricas de Ingresos</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-xs text-blue-200/90">Revenue por Milla (RPM)</span>
              <span class="text-sm font-bold text-white">${formatCurrency(metrics.revenuePerMile)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-blue-200/90">Revenue por Carga</span>
              <span class="text-sm font-bold text-white">${formatCurrency(metrics.avgRevenuePerLoad)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-blue-200/90">Total de Millas</span>
              <span class="text-sm font-bold text-white">${metrics.totalMiles.toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-blue-200/90">Total de Cargas</span>
              <span class="text-sm font-bold text-white">${metrics.totalLoads}</span>
            </div>
          </div>
        </div>
        
        <!-- Cost & Profit Metrics -->
        <div class="bg-gradient-to-br from-teal-900/40 to-teal-700/40 p-4 rounded-lg border border-teal-400/30">
          <h3 class="text-sm font-semibold text-teal-200 mb-3"> Métricas de Costo y Ganancia</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-xs text-teal-200/90">Costo por Milla</span>
              <span class="text-sm font-bold text-white">${formatCurrency(metrics.costPerMile)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-teal-200/90">Ganancia por Milla</span>
              <span class="text-sm font-bold ${metrics.profitPerMile >= 0 ? 'text-green-400' : 'text-red-400'}">
                ${formatCurrency(metrics.profitPerMile)}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-teal-200/90">Ganancia por Carga</span>
              <span class="text-sm font-bold ${metrics.profitPerLoad >= 0 ? 'text-green-400' : 'text-red-400'}">
                ${formatCurrency(metrics.profitPerLoad)}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-teal-200/90">Margen de Ganancia</span>
              <span class="text-sm font-bold ${metrics.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}">
                ${metrics.profitMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  `;
}

/**
 * Render Trend Analysis Section
 */
function renderTrendAnalysisSection(trend) {
  if (!trend.hasPreviousPeriod) {
    return `
      <div class="mb-6">
        <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span></span> Análisis de Tendencias
        </h2>
        <div class="bg-blue-900/30 p-6 rounded-lg border border-blue-400/30 text-center">
          <p class="text-white/90">${trend.message}</p>
        </div>
      </div>
    `;
  }

  const getChangeIcon = (change) => {
    if (change > 0) return '';
    if (change < 0) return '';
    return '';
  };

  const getChangeClass = (change, isExpense = false) => {
    // For expenses, negative is good
    if (isExpense) {
      if (change < 0) return 'text-green-400';
      if (change > 0) return 'text-red-400';
      return 'text-gray-400';
    }
    // For revenue/profit, positive is good
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  return `
    <div class="mb-6">
      <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span></span> Análisis de Tendencias
      </h2>
      
      <div class="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 p-4 rounded-lg border border-indigo-400/30 mb-4">
        <h3 class="text-sm font-semibold text-white/90 mb-3">
          Comparación con Período Anterior (${trend.prevPeriodLabel})
        </h3>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          <!-- Revenue Comparison -->
          <div class="bg-black/20 p-3 rounded-lg">
            <div class="text-xs text-white/90 mb-1">Ingresos</div>
            <div class="text-sm font-bold text-white mb-1">${formatCurrency(trend.current.revenue)}</div>
            <div class="flex items-center gap-1 text-xs ${getChangeClass(trend.changes.revenue)}">
              <span>${getChangeIcon(trend.changes.revenue)}</span>
              <span>${trend.changes.revenue > 0 ? '+' : ''}${trend.changes.revenue.toFixed(1)}%</span>
            </div>
            <div class="text-xs text-white/90 mt-1">Prev: ${formatCurrency(trend.previous.revenue)}</div>
          </div>
          
          <!-- Expense Comparison -->
          <div class="bg-black/20 p-3 rounded-lg">
            <div class="text-xs text-white/90 mb-1">Gastos</div>
            <div class="text-sm font-bold text-white mb-1">${formatCurrency(trend.current.expenses)}</div>
            <div class="flex items-center gap-1 text-xs ${getChangeClass(trend.changes.expenses, true)}">
              <span>${getChangeIcon(trend.changes.expenses)}</span>
              <span>${trend.changes.expenses > 0 ? '+' : ''}${trend.changes.expenses.toFixed(1)}%</span>
            </div>
            <div class="text-xs text-white/90 mt-1">Prev: ${formatCurrency(trend.previous.expenses)}</div>
          </div>
          
          <!-- Profit Comparison -->
          <div class="bg-black/20 p-3 rounded-lg">
            <div class="text-xs text-white/90 mb-1">Ganancia</div>
            <div class="text-sm font-bold ${trend.current.profit >= 0 ? 'text-green-400' : 'text-red-400'} mb-1">
              ${formatCurrency(trend.current.profit)}
            </div>
            <div class="flex items-center gap-1 text-xs ${getChangeClass(trend.changes.profit)}">
              <span>${getChangeIcon(trend.changes.profit)}</span>
              <span>${trend.changes.profit > 0 ? '+' : ''}${trend.changes.profit.toFixed(1)}%</span>
            </div>
            <div class="text-xs text-white/90 mt-1">Prev: ${formatCurrency(trend.previous.profit)}</div>
          </div>
          
          <!-- Loads Comparison -->
          <div class="bg-black/20 p-3 rounded-lg">
            <div class="text-xs text-white/90 mb-1">Cargas</div>
            <div class="text-sm font-bold text-white mb-1">${trend.current.loads}</div>
            <div class="flex items-center gap-1 text-xs ${getChangeClass(trend.changes.loads)}">
              <span>${getChangeIcon(trend.changes.loads)}</span>
              <span>${trend.changes.loads > 0 ? '+' : ''}${trend.changes.loads.toFixed(1)}%</span>
            </div>
            <div class="text-xs text-white/90 mt-1">Prev: ${trend.previous.loads}</div>
          </div>
          
        </div>
        
        <!-- Trend Summary -->
        <div class="mt-4 p-3 bg-white/5 rounded-lg">
          <p class="text-sm text-white/80">
            <strong>Resumen:</strong> 
            ${trend.changes.profit > 5 ? ' Mejora significativa en rentabilidad' :
      trend.changes.profit > 0 ? ' Ligera mejora en rentabilidad' :
        trend.changes.profit > -5 ? ' Ligera disminución en rentabilidad' :
          ' Disminución significativa - requiere atención'}
          </p>
        </div>
      </div>
    </div>
  `;
}

// Expose the new function globally
window.generateComprehensiveReport = generateComprehensiveReport;


// =====================================================
// CUSTOM CATEGORIES MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Abrir modal de nueva categoría
 */
async function openCategoryModal() {
  debugLog('🟢 Abriendo modal de categorías...');
  // Regenerar el modal con el idioma actual cada vez que se abre
  createCategoryModalIfNeeded();
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.remove('hidden');
    // Cargar lista de categorías personalizadas
    debugLog('🟡 Llamando a loadCustomCategoriesList...');
    await loadCustomCategoriesList();
    debugLog('🟢 Lista de categorías cargada');
  }
}

/**
 * Cerrar modal de categorías
 */
function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Seleccionar ícono para la categoría
 * @param {string} icon - Emoji seleccionado
 */
function selectIcon(icon, btn) {
  document.getElementById('selectedIcon').value = icon;

  // Visual feedback — scope to the modal so we don't affect hidden elements
  const modal = document.getElementById('categoryModal');
  (modal || document).querySelectorAll('.icon-option').forEach(b => {
    b.classList.remove('bg-purple-200', 'border-purple-500');
  });
  if (btn) btn.classList.add('bg-purple-200', 'border-purple-500');
}

/**
 * Guardar nueva categoría personalizada
 */
async function saveCustomCategory() {
  const name = document.getElementById('categoryName').value.trim();
  const icon = document.getElementById('selectedIcon').value;
  const color = document.getElementById('categoryColor').value;
  const isOperational = document.getElementById('isOperationalYes').checked;

  if (!name) {
    showFinancesMessage(window.i18n?.t('finances.category_name_required') || 'Category name is required', 'error');
    return;
  }

  try {
    const newCategory = await window.CustomCategories.createCustomCategory(name, icon, color, isOperational);
    const _isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    showFinancesMessage(_isEs ? `✅ Categoría "${name}" creada exitosamente` : `✅ Category "${name}" created`, 'success');
    if (window.showToast) showToast(_isEs ? `✅ Categoría "${name}" creada` : `✅ Category "${name}" created`, 'success');

    // NO cerrar el modal, solo limpiar el formulario
    document.getElementById('categoryName').value = '';
    document.getElementById('selectedIcon').value = '📌';
    document.getElementById('categoryColor').value = '#6b7280';

    // Resetear selección de ícono
    document.querySelectorAll('.icon-option').forEach(btn => {
      btn.classList.remove('bg-purple-200', 'border-purple-500');
    });

    // Actualizar select y lista inmediatamente
    await window.CustomCategories.populateExpenseCategoriesSelect();
    await loadCustomCategoriesList();
  } catch (error) {
    debugLog('❌ Error creating category:', error);
    showFinancesMessage(window.i18n?.t('finances.error_create_category') || 'Error creating category', 'error');
    if (window.showToast) showToast(window.i18n?.t('finances.error_create_category') || '❌ Error creating category', 'error');
  }
}

/**
 * Cargar y mostrar lista de categorías personalizadas
 */
async function loadCustomCategoriesList() {
  const container = document.getElementById('customCategoriesList');
  if (!container) return;

  try {
    const categories = await window.CustomCategories.getAllCategories();
    const customCats = categories.filter(c => !c.isSystem);

    if (customCats.length === 0) {
      // Ocultar el contenedor si no hay categorías personalizadas
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    // Mostrar el contenedor si hay categorías
    container.style.display = 'grid';
    container.innerHTML = customCats.map(cat => `
      \u003cdiv class="border rounded-lg p-3 flex items-center justify-between" style="border-color: ${cat.color}"\u003e
        \u003cdiv class="flex items-center gap-2"\u003e
          \u003cspan class="text-2xl"\u003e${cat.icon}\u003c/span\u003e
          \u003cspan class="text-sm font-medium" style="color: ${cat.color}"\u003e${cat.name}\u003c/span\u003e
        \u003c/div\u003e
        \u003cbutton onclick="deleteCategory('${cat.id}')" 
                class="text-red-500 hover:text-red-700 text-sm"
                title="Eliminar categoría"\u003e
          ✕
        \u003c/button\u003e
      \u003c/div\u003e
    `).join('');
  } catch (error) {
    debugLog('❌ Error loading categories list:', error);
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

/**
 * Eliminar categoría personalizada
 * @param {string} categoryId - ID de la categoría a eliminar
 */
async function deleteCategory(categoryId) {
  const _isDel = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
  if (!confirm(_isDel
    ? '¿Estás seguro de eliminar esta categoría?\n\nLos gastos existentes con esta categoría se mantendrán, pero no podrás crear nuevos gastos con ella.'
    : "Are you sure you want to delete this category?\n\nExisting expenses will be kept, but you won't be able to create new ones with it.")) return;

  try {
    await window.CustomCategories.deleteCustomCategory(categoryId);
    showFinancesMessage(window.i18n?.t('finances.category_deleted') || 'Category deleted successfully', 'success');
    if (window.showToast) showToast(window.i18n?.t('finances.category_deleted') || '✅ Category deleted', 'success');

    await window.CustomCategories.populateExpenseCategoriesSelect();
    await loadCustomCategoriesList();
  } catch (error) {
    debugLog('❌ Error deleting category:', error);
    showFinancesMessage(window.i18n?.t('finances.error_delete_category') || 'Error deleting category', 'error');
    if (window.showToast) showToast(window.i18n?.t('finances.error_delete_category') || '❌ Error deleting', 'error');
  }
}

// Inicializar categorías al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  debugFinances('🎨 Initializing custom categories...');

  // Esperar a que CustomCategories esté disponible
  if (window.CustomCategories) {
    try {
      await window.CustomCategories.populateExpenseCategoriesSelect();
      await loadCustomCategoriesList();
      debugFinances('✅ Custom categories initialized');
    } catch (error) {
      debugLog('❌ Error initializing custom categories:', error);
    }
  } else {
    debugLog('⚠️ CustomCategories module not loaded');
  }

  // 🔧 WORKAROUND: Crear modal dinámicamente porque Firebase cachea HTML agresivamente
  createCategoryModalIfNeeded();
});

/**
 * 🔧 WORKAROUND: Crear modal de categorías dinámicamente
 * Firebase CDN tiene caché muy agresivo del HTML, así que lo creamos via JS
 */
function createCategoryModalIfNeeded() {
  // Eliminar TODOS los modales viejos (puede haber múltiples por caché)
  const oldModals = document.querySelectorAll('#categoryModal');
  if (oldModals.length > 0) {
    debugLog(`🔧 Eliminando ${oldModals.length} modal(es) viejo(s)...`);
    oldModals.forEach(m => m.remove());
  }

  debugLog('🔧 Creando modal de categorías dinámicamente desde finances.js...');
  const t = (k, fb) => { const v = window.i18n?.t(k); return (v && v !== k) ? v : fb; };
  const modalHTML = `
  <div id="categoryModal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col" style="max-height: 85vh;">
      
      <!-- Modal Header -->
      <div class="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
        <h3 class="text-lg font-semibold text-gray-900">⚙️ ${t('finances.manage_categories_title', 'Manage Expense Categories')}</h3>
        <button type="button" onclick="closeCategoryModal()" class="text-gray-400 hover:text-gray-600">
          <span class="text-2xl">&times;</span>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="px-6 py-4 overflow-y-auto flex-1">
        
        <!-- New Category Form -->
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <h4 class="text-md font-semibold text-purple-900 mb-3">${t('finances.create_new_category_title', '➕ Create New Category')}</h4>
          
          <div class="space-y-4">
            
            <!-- Name -->
            <div>
              <label for="categoryName" class="block text-sm font-medium text-gray-700 mb-1">${t('finances.modal_category_name_label', 'Category Name')}</label>
              <input type="text" id="categoryName" placeholder="${t('finances.modal_category_name_ph', 'e.g. Loans, Marketing...')}"
                     class="border border-gray-300 rounded px-3 py-2 w-full focus:border-purple-500 focus:outline-none"
                     maxlength="30" required>
            </div>

            <!-- Icon -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">${t('finances.modal_icon_label', 'Icon')}</label>
              <div id="iconSelector" class="grid grid-cols-8 gap-2">
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udcb3', this)">\ud83d\udcb3</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udcb0', this)">\ud83d\udcb0</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udcbb', this)">\ud83d\udcbb</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udcf1', this)">\ud83d\udcf1</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83c\udfe6', this)">\ud83c\udfe6</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83c\udfe0', this)">\ud83c\udfe0</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83c\udf93', this)">\ud83c\udf93</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\u26a1', this)">\u26a1</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udd27', this)">\ud83d\udd27</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udee0\ufe0f', this)">\ud83d\udee0\ufe0f</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udce6', this)">\ud83d\udce6</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83c\udfaf', this)">\ud83c\udfaf</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udcca', this)">\ud83d\udcca</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\udca1', this)">\ud83d\udca1</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\ud83d\ude80', this)">\ud83d\ude80</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('\u2b50', this)">\u2b50</button>
              </div>
              <input type="hidden" id="selectedIcon" value="\ud83d\udccc">
            </div>

            <!-- Color -->
            <div>
              <label for="categoryColor" class="block text-sm font-medium text-gray-700 mb-1">${t('finances.modal_color_label', 'Color (optional)')}</label>
              <input type="color" id="categoryColor" value="#6b7280"
                     class="border border-gray-300 rounded px-3 py-2 w-full h-10">
            </div>

            <!-- Expense Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">${t('finances.modal_category_type_label', 'Expense Type?')}</label>
              <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isOperational" id="isOperationalYes" value="true" checked class="text-purple-600">
                  <span class="text-sm">\ud83d\ude9b ${t('finances.modal_type_operational', 'Operational (affects CPM)')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isOperational" id="isOperationalNo" value="false" class="text-purple-600">
                  <span class="text-sm">\ud83d\udce6 ${t('finances.modal_type_general', "General (doesn't affect CPM)")}</span>
                </label>
              </div>
            </div>

            <!-- Create Button -->
            <button type="button" onclick="saveCustomCategory()"
                    class="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    style="color: white !important; -webkit-text-fill-color: white !important;">
              ${t('finances.modal_create_category_btn', 'Save')}
            </button>
            
          </div>
        </div>

        <!-- Custom Categories List -->
        <div>
          <h4 class="text-md font-semibold text-gray-900 mb-3">\ud83d\udccb ${t('finances.custom_categories_label', 'Custom Categories')}</h4>
          <div id="customCategoriesList" class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <!-- Populated dynamically -->
          </div>
        </div>
        
      </div>

      <!-- Modal Footer -->
      <div class="border-t border-gray-200 px-6 py-4 flex justify-end sticky bottom-0 bg-white">
        <button type="button" onclick="closeCategoryModal()"
                class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          ${t('finances.btn_close_categories', 'Close')}
        </button>
      </div>

    </div>
  </div>
  `;

  // Insertar al final del body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  debugLog('✅ Modal de categorías creado dinámicamente desde finances.js');
}
