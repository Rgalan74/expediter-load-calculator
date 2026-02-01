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
      deductible: data.deductible || false
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
async function loadFinancesData(period = "all") {
  if (!window.currentUser) {
    console.error(" No hay usuario autenticado");
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

  debugLog(" Loads guardadas en memoria:", window.financesData.length);
  debugLog(" Expenses guardadas en memoria:", window.expensesData.length);

  // === 3. Filtrar por perodo (si aplica) ===
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

// OK FUNCIN INDEPENDIENTE PARA RENDERIZAR GASTOS
function renderExpensesList(filteredExpenses = []) {
  const expensesList = document.getElementById("expensesList");
  if (!expensesList) return;

  if (!filteredExpenses || filteredExpenses.length === 0) {
    expensesList.innerHTML = `
            <tr>
                <td colspan="5" class="p-4 text-center text-gray-500">
                    No hay gastos registrados para este periodo
                </td>
            </tr>`;
    return;
  }

  const sortedExpenses = filteredExpenses
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const categoryIcons = {
    fuel: "", maintenance: "", food: "", lodging: "",
    tolls: "", insurance: "", permits: "", other: ""
  };

  const rows = sortedExpenses.map(expense => `
        <tr class="hover:bg-gray-50">
            <td class="p-2 text-sm">${expense.date || "-"}</td>
            <td class="p-2 text-sm">${categoryIcons[expense.type] || ""} ${expense.type}</td>
            <td class="p-2 text-sm">${expense.description || "-"}</td>
            <td class="p-2 text-sm font-semibold">${formatCurrency(expense.amount)}</td>
            <td class="p-2 text-sm">
                <button onclick="editExpense('${expense.id}')" class="text-blue-600 hover:underline mr-2">Editar</button>
                <button onclick="deleteExpense('${expense.id}')" class="text-red-600 hover:underline">Eliminar</button>
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
      console.error('Error loading charts module:', error);
    }
  } else {
    console.warn('Lazy loader not available, charts module cannot be loaded');
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
      console.error('Error loading charts module:', error);
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
      console.error('Error loading charts module:', error);
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
      console.error('Error loading charts module:', error);
    }
  }
}

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
        console.error(" Finances:", message);
        break;
      case "success":
        debugLog("OK Finances:", message);
        break;
      case "warning":
        console.warn(" Finances:", message);
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
    console.error("❌ Elementos del formulario de gastos no encontrados");
    showFinancesMessage("Error: Formulario no disponible. Intenta recargar la página.", "error");
    return;
  }

  const amount = parseFloat(amountEl.value.trim());
  const type = typeEl.value.trim().toLowerCase();
  const description = descEl.value.trim();
  const date = dateEl.value;

  if (!window.currentUser) {
    showFinancesMessage("Debe iniciar sesin", "error");
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
    loadFinancesData();
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

  const confirmDelete = confirm(" Ests seguro de que deseas eliminar este gasto?");
  if (!confirmDelete) return;

  try {
    await firebase.firestore().collection("expenses").doc(id).delete();
    debugFinances(` Gasto eliminado (${id})`);
    showFinancesMessage("OK Gasto eliminado correctamente", "success");
    if (window.showToast) {
      showToast('✅ Gasto eliminado exitosamente', 'success');
    }
    loadFinancesData();
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
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
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

  const categoryLabels = {
    fuel: "🚚 Combustible",
    maintenance: "🔧 Mantenimiento",
    food: "🍔 Comida",
    lodging: "🏨 Hospedaje",
    tolls: "🛣️ Peajes",
    insurance: "🛡️ Seguro",
    permits: "📄 Permisos",
    carpayment: "🚗 Pago de Auto",
    other: "📌 Otros"
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
    console.warn(" Contenedor reportContent no encontrado");
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
      <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-green-700 mb-2"> Ingresos Totales</h3>
        <p class="text-3xl font-bold text-green-900">${formatCurrency(totalRevenue)}</p>
        <p class="text-sm text-green-600 mt-1">${totalLoads} Cargas completadas</p>
      </div>
      
      <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-red-700 mb-2"> Gastos Totales</h3>
        <p class="text-3xl font-bold text-red-900">${formatCurrency(totalExpenses)}</p>
        <p class="text-sm text-red-600 mt-1">Gastos operativos reales</p>
      </div>
      
      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 class="text-lg font-semibold text-blue-700 mb-2"> Ganancia Neta</h3>
        <p class="text-3xl font-bold ${netProfit >= 0 ? 'text-blue-900' : 'text-red-900'}">${formatCurrency(netProfit)}</p>
        <p class="text-sm ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'} mt-1">Margen: ${margin.toFixed(1)}%</p>
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

  debugLog("OK Estado de Resultados profesional generado");
}

function generateTaxReport() {
  debugLog(" Generando Reporte Fiscal para ao completo...");

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

  // Usar ao seleccionado, datos completos del ao
  const year = document.getElementById("reportYear")?.value || new Date().getFullYear().toString();

  // Filtrar por ao completo, no por mes
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

  // Categorizar gastos segn IRS Schedule C
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
    console.warn(" Contenedor reportContent no encontrado");
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

    <!-- Part II: Expenses -->
    <div class="mb-8">
      <h3 class="text-xl font-bold mb-4" style="color: white !important;">PART II - EXPENSES (Schedule C)</h3>
      <div class="rounded-lg overflow-hidden" style="background-color: rgba(30, 58, 138, 0.8);">
        <table class="min-w-full">
          <thead style="background-color: rgba(30, 58, 138, 1);">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: white !important;">Line #</th>
              <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: white !important;">Expense Category</th>
              <th class="px-4 py-3 text-right text-xs font-bold uppercase" style="color: white !important;">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-blue-400/30">
            <tr>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">9</td>
              <td class="px-4 py-3 text-sm text-gray-900">Car and truck expenses</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.vehicleExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">17</td>
              <td class="px-4 py-3 text-sm text-gray-900">Insurance (other than health)</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.insurance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">20a</td>
              <td class="px-4 py-3 text-sm text-gray-900">Office expense</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.officeExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">22</td>
              <td class="px-4 py-3 text-sm text-gray-900">Repairs and maintenance</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.repairsMaintenance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">25</td>
              <td class="px-4 py-3 text-sm text-gray-900">Travel, meals, and entertainment</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.travel.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">27a</td>
              <td class="px-4 py-3 text-sm text-gray-900">Other expenses</td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right">$${businessExpenses.otherExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-200">
            <tr>
              <td class="px-4 py-3 text-sm font-bold text-gray-900">28</td>
              <td class="px-4 py-3 text-sm font-bold text-gray-900">Total expenses</td>
              <td class="px-4 py-3 text-sm font-bold text-gray-900 text-right">$${totalBusinessExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
          <p class="text-3xl font-bold text-yellow-900">$${standardMileageDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p class="text-sm text-yellow-700 mt-2">${totalMiles.toLocaleString()} miles  $0.67/mile (2024 rate)</p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 class="text-lg font-semibold text-green-800 mb-3">Actual Expense Method</h4>
          <p class="text-3xl font-bold text-green-900">$${actualExpenseMethod.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p class="text-sm text-green-700 mt-2">Fuel, tolls, and vehicle expenses</p>
        </div>
      </div>
      <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-sm text-blue-800">
          <strong>Recommended:</strong> ${recommendedMethod} 
          (saves $${Math.abs(standardMileageDeduction - actualExpenseMethod).toLocaleString('en-US', { minimumFractionDigits: 2 })})
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

    <!-- Important Tax Notes -->
    <div class="mb-8 bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
      <h4 class="text-base font-bold text-amber-900 mb-3">⚠️ IMPORTANT TAX CONSIDERATIONS</h4>
      <ul class="text-sm text-amber-800 space-y-2">
        <li>📌 Quarterly estimated tax payments may be required if you owe $1,000+ in taxes</li>
        <li>📌 Keep detailed records of all business miles and expenses</li>
        <li>📌 Meals while away from home are 50% deductible</li>
        <li>📌 Consider maximizing retirement contributions (SEP-IRA, Solo 401k)</li>
        <li>📌 This report is for reference only - consult a tax professional</li>
      </ul>
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

  debugLog("OK Reporte fiscal anual generado exitosamente");
}




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
  csvData.push(['Fecha', 'Categora', 'Descripcin', 'Monto', 'Deducible']);

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
    console.warn(`Elemento no encontrado: ${id}`);
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
    console.warn(" No se encontr el selector de aos (yearSelect)");
    return;
  }

  //  Poblar selector
  yearSelect.innerHTML = '<option value=""> Todos los Aos</option>';
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
      console.warn(" updateMonthOptions no est definida an");
    }
  }
}

function updateMonthOptions() {
  debugLog(" Actualizando meses...");

  const year = document.getElementById("yearSelect")?.value;
  const monthSelect = document.getElementById("monthSelect");

  if (!monthSelect) {
    console.warn(" No se encontr el selector de mes");
    return;
  }

  // OK Siempre dejamos la opcin de "Todos los Meses"
  monthSelect.innerHTML = '<option value=""> Todos los Meses</option>';

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
      console.warn(" filterByYearMonth no est definida an");
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
    }).catch(err => console.error("Error aplicando filtro:", err));
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
    yearEl.innerHTML = `<option value="">Todos</option>`;
    for (let y = minYear; y <= parseInt(currentYear); y++) {
      yearEl.innerHTML += `<option value="${y}">${y}</option>`;
    }
    yearEl.value = currentYear;

    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    monthEl.innerHTML = `<option value="">Todos</option>`;
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
        console.error(" Error aplicando filtro global:", err);
      });
    }

  } else if (context === "reports") {
    // No generar reporte automáticamente, solo cuando el usuario hace clic en el botón
    debugLog("Reports tab selected - awaiting user action");
  } else if (context === "accounts") {
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    } else {
      console.warn(" loadAccountsData no implementado an");
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
    console.error(` [CLEAN] Selectores no encontrados para contexto: ${context}`);
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
      console.warn(` [FINANCES] Elemento no encontrado: ${id}`);
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
    console.error(" Error marcando como pagada:", error);
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
    console.error("❌ Error desmarcando carga:", error);
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
          ${isOverdue ? `Vencida (${load.daysOverdue} das)` : 'Pendiente'}
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
          label: ' Ingresos',
          data: revenues,
          borderColor: '#10b981',
          backgroundColor: chartType === 'bar' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        },
        {
          label: ' Gastos',
          data: expenses,
          borderColor: '#ef4444',
          backgroundColor: chartType === 'bar' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: chartType === 'line',
          borderWidth: chartType === 'bar' ? 2 : 3
        },
        {
          label: ' Ganancia',
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
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(59, 130, 246, 0.1)" } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return '$' + value.toLocaleString();
            }
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
          position: 'top'
        }
      },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(59, 130, 246, 0.1)" } },
        y: {
          beginAtZero: true,
          ticks: {
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
    console.error(" Error marcando como pagada:", error);
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
          <div class="text-6xl mb-4">OK</div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">No hay cargas pagadas</h3>
          <p class="text-gray-500">Las cargas pagadas aparecern aqui</p>
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
          <td class="p-2 text-sm text-green-600 font-medium">OK Pagada</td>
        </tr>
      `).join('');

      html = `
        <div class="mb-4">
          <h3 class="text-lg font-bold text-green-700 mb-4">Cargas Pagadas (${paidLoads.length})</h3>
          <div class="bg-green-50 border border-green-200 rounded-lg overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-green-100">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Compañia</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Numero</th>
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
    //  MOSTRAR PENDIENTES Y VENCIDAS (cdigo original)
    const activePending = pendingLoads.filter(load => !overdueLoads.includes(load));
    const totalPaid = paidLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0);

    // Estado de Cargas Vencidas
    html += overdueLoads.length > 0 ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-red-700 mb-4"> Cargas Vencidas (${overdueLoads.length})</h3>
        <div class="bg-red-50 border border-red-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-red-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Fecha Carga</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Compañia</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Numero</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Monto</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Vencida Desde</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Accion</th>
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
                    <td class="px-4 py-3 text-sm text-red-600">${daysOverdue} das</td>
                    <td class="px-4 py-3 text-sm">
                      <button onclick="markAsPaid('${load.id}')" 
                              class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                        OK Marcar Pagada
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
        <h3 class="text-lg font-bold text-yellow-700 mb-4"> Cargas Pendientes de Pago (${activePending.length})</h3>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-yellow-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Fecha Carga</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Compañia</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Numero</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Monto</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Se Paga El</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Accion</th>
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
                      Marcar Pagada
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    // Tabla completa de Cargas Pagadas cuando filtro es "Todos"
    html += paidLoads.length > 0 && statusFilter === '' ? `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-green-700 mb-4">Cargas Pagadas (${paidLoads.length})</h3>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-green-100">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Fecha</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Compañía</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Número</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Monto</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Fecha Pago</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Estado</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">Acciones</th>
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
                  <td class="p-2 text-sm text-green-600 font-medium">✓ Pagada</td>
                  <td class="p-2 text-sm">
                    <button onclick="markAsUnpaid('${load.id}')" 
                            class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">
                      Desmarcar
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
        <h3 class="text-lg font-bold text-green-700 mb-4">Resumen de Cargas Pagadas</h3>
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
          <div class="text-6xl mb-4"></div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">No hay cargas por gestionar</h3>
          <p class="text-gray-500">Las cargas aparecen aqui cuando tengan informacion de pago</p>
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
  summaryEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      <!-- Tarjeta: Pagadas -->
      <div class="bg-green-50 border-2 border-green-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-green-700 uppercase tracking-wide">Pagadas</h3>
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

      <!-- Tarjeta: Pendientes (TOTAL SIN PAGAR) -->
      <div class="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-yellow-700 uppercase tracking-wide">💰 Sin Cobrar</h3>
        </div>
        <div class="mt-2">
          <p class="text-3xl font-bold text-yellow-900">${pendingLoads.length}</p>
          <p class="text-sm text-yellow-600 mt-1">cargas totales</p>
        </div>
        <div class="mt-3 pt-3 border-t border-yellow-200">
          <p class="text-lg font-semibold text-yellow-800">${formatCurrency(pendingLoads.reduce((sum, load) => sum + (load.totalCharge || 0), 0))}</p>
          <p class="text-xs text-yellow-600">Total por cobrar</p>
        </div>
      </div>

      <!-- Tarjeta: Vencidas -->
      <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-red-700 uppercase tracking-wide"> Vencidas</h3>
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
    let periodLabel = "todo el período";
    let periodKey = "all";

    if (typeof getSelectedPeriod === "function") {
      const { year, month } = getSelectedPeriod("global");
      if (year && month) {
        periodKey = `${year}-${month}`;
        periodLabel = `${year}-${month}`;
      } else if (year) {
        periodKey = year;
        periodLabel = `año ${year}`;
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
          message: `No tengo datos financieros para ${periodLabel} todavía 😕`,
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

    const insights = [];
    const alerts = [];

    if (netProfit <= 0 || margin <= 5) {
      lexState = "sad";
      alerts.push(
        "Este período está muy ajustado o en pérdida. Revisa tarifas mínimas y gastos fijos."
      );
    } else if (netProfit > 0 && margin >= 20) {
      lexState = "happy";
      insights.push(
        "Buen margen de ganancia, tu operación se ve saludable en este período."
      );
    } else {
      lexState = "thinking";
      insights.push(
        "Período estable, pero con espacio para mejorar margen y control de costos."
      );
    }

    if (numLoads > 0 && avgRevenuePerLoad > 0) {
      insights.push(
        `Ingreso promedio por carga: $${avgRevenuePerLoad.toFixed(0)}`
      );
    }
    if (numLoads > 0 && avgExpensePerLoad > 0) {
      alerts.push(
        `Gasto promedio por carga: $${avgExpensePerLoad.toFixed(0)}`
      );
    }

    // 6. Mensaje corto para la burbuja
    const safeNumber = (n, dec = 0) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return "--";
      return v.toFixed(dec);
    };

    const parts = [];
    parts.push(`Período: ${periodLabel}`);
    parts.push(`Ingresos: $${safeNumber(kpis.totalRevenue, 0)}`);
    parts.push(`Gastos: $${safeNumber(kpis.totalExpenses, 0)}`);
    parts.push(`Ganancia: $${safeNumber(kpis.netProfit, 0)}`);
    parts.push(`Margen: ${safeNumber(kpis.margin, 1)}%`);
    if (kpis.totalMiles) {
      parts.push(`RPM: $${safeNumber(kpis.avgRpm, 2)}/mi`);
    }
    if (numLoads) {
      parts.push(`Cargas: ${numLoads}`);
    }
    if (numExpenses) {
      parts.push(`Gastos registrados: ${numExpenses}`);
    }

    let prefix = "";
    if (lexState === "happy") {
      prefix = "✅ Buen período, tus números van bien.\n";
    } else if (lexState === "sad") {
      prefix = "⚠️ Ojo, este período está ajustado.\n";
    } else {
      prefix = "📊 Te resumo tus finanzas:\n";
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
          ? "Buen balance entre ingresos y gastos. Mantén este nivel de tarifas y control de costos."
          : lexState === "sad"
            ? "Este período se ve apretado. Puede ser buen momento para ajustar tarifas mínimas y revisar tus principales gastos."
            : "Tus números están en un punto intermedio. Con pequeños ajustes podrías mejorar bastante tu margen.",
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
    console.error("[LEX-FINANCES] Error en analyzeLexFinances:", err);
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
    console.warn(" reportContent container not found");
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
  console.log('🟢 Abriendo modal de categorías...');
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('categoryName').value = '';
    document.getElementById('selectedIcon').value = '📌';
    document.getElementById('categoryColor').value = '#6b7280';

    // Resetear selección de ícono
    document.querySelectorAll('.icon-option').forEach(btn => {
      btn.classList.remove('bg-purple-200', 'border-purple-500');
    });

    // Cargar lista de categorías personalizadas
    console.log('🟡 Llamando a loadCustomCategoriesList...');
    await loadCustomCategoriesList();
    console.log('🟢 Lista de categorías cargada');
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
function selectIcon(icon) {
  document.getElementById('selectedIcon').value = icon;

  // Visual feedback
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.classList.remove('bg-purple-200', 'border-purple-500');
  });
  event.target.classList.add('bg-purple-200', 'border-purple-500');
}

/**
 * Guardar nueva categoría personalizada
 */
async function saveCustomCategory() {
  const name = document.getElementById('categoryName').value.trim();
  const icon = document.getElementById('selectedIcon').value;
  const color = document.getElementById('categoryColor').value;

  if (!name) {
    showFinancesMessage('El nombre de la categoría es requerido', 'error');
    return;
  }

  try {
    const newCategory = await window.CustomCategories.createCustomCategory(name, icon, color);
    showFinancesMessage(`✅ Categoría "${name}" creada exitosamente`, 'success');

    if (window.showToast) {
      showToast(`✅ Categoría "${name}" creada`, 'success');
    }

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
    console.error('❌ Error creating category:', error);
    showFinancesMessage('Error al crear la categoría', 'error');

    if (window.showToast) {
      showToast('❌ Error al crear categoría', 'error');
    }
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
    console.error('❌ Error loading categories list:', error);
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

/**
 * Eliminar categoría personalizada
 * @param {string} categoryId - ID de la categoría a eliminar
 */
async function deleteCategory(categoryId) {
  if (!confirm('¿Estás seguro de eliminar esta categoría?\n\nLos gastos existentes con esta categoría se mantendrán, pero no podrás crear nuevos gastos con ella.')) return;

  try {
    await window.CustomCategories.deleteCustomCategory(categoryId);
    showFinancesMessage('Categoría eliminada exitosamente', 'success');

    if (window.showToast) {
      showToast('✅ Categoría eliminada', 'success');
    }

    await window.CustomCategories.populateExpenseCategoriesSelect();
    await loadCustomCategoriesList();
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    showFinancesMessage('Error al eliminar la categoría', 'error');

    if (window.showToast) {
      showToast('❌ Error al eliminar', 'error');
    }
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
      console.error('❌ Error initializing custom categories:', error);
    }
  } else {
    console.warn('⚠️ CustomCategories module not loaded');
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
    console.log(`🔧 Eliminando ${oldModals.length} modal(es) viejo(s)...`);
    oldModals.forEach(m => m.remove());
  }

  console.log('🔧 Creando modal de categorías dinámicamente desde finances.js...');

  const modalHTML = `
  <div id="categoryModal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      
      <!-- Modal Header -->
      <div class="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
        <h3 class="text-lg font-semibold text-gray-900">⚙️ Gestión de Categorías de Gastos</h3>
        <button type="button" onclick="closeCategoryModal()" class="text-gray-400 hover:text-gray-600">
          <span class="text-2xl">&times;</span>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="px-6 py-4">
        
        <!-- Formulario de Nueva Categoría -->
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <h4 class="text-md font-semibold text-purple-900 mb-3">➕ Crear Nueva Categoría</h4>
          
          <div class="space-y-4">
            
            <!-- Nombre -->
            <div>
              <label for="categoryName" class="block text-sm font-medium text-gray-700 mb-1">Nombre de la Categoría</label>
              <input type="text" id="categoryName" placeholder="Ej: Préstamos, Marketing, etc."
                     class="border border-gray-300 rounded px-3 py-2 w-full focus:border-purple-500 focus:outline-none"
                     maxlength="30" required>
            </div>

            <!-- Icono (selector simple) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Ícono</label>
              <div id="iconSelector" class="grid grid-cols-8 gap-2">
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('💳')">💳</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('💰')">💰</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('💻')">💻</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('📱')">📱</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🏦')">🏦</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🏠')">🏠</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🎓')">🎓</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('⚡')">⚡</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🔧')">🔧</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🛠️')">🛠️</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('📦')">📦</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🎯')">🎯</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('📊')">📊</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('💡')">💡</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('🚀')">🚀</button>
                <button type="button" class="icon-option text-2xl p-2 border rounded hover:bg-purple-100 hover:border-purple-500 transition" onclick="selectIcon('⭐')">⭐</button>
              </div>
              <input type="hidden" id="selectedIcon" value="📌">
            </div>

            <!-- Color -->
            <div>
              <label for="categoryColor" class="block text-sm font-medium text-gray-700 mb-1">Color (opcional)</label>
              <input type="color" id="categoryColor" value="#6b7280"
                     class="border border-gray-300 rounded px-3 py-2 w-full h-10">
            </div>
            
            <!-- Botón Crear -->
            <button type="button" onclick="saveCustomCategory()"
                    class="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
              💾 Crear Categoría
            </button>
            
          </div>
        </div>

        <!-- Lista de Categorías Personalizadas -->
        <div>
          <h4 class="text-md font-semibold text-gray-900 mb-3">📋 Tus Categorías Personalizadas</h4>
          <div id="customCategoriesList" class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <!-- Se poblará dinámicamente -->
          </div>
        </div>
        
      </div>

      <!-- Modal Footer -->
      <div class="border-t border-gray-200 px-6 py-4 flex justify-end sticky bottom-0 bg-white">
        <button type="button" onclick="closeCategoryModal()"
                class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cerrar
        </button>
      </div>

    </div>
  </div>
  `;

  // Insertar al final del body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  console.log('✅ Modal de categorías creado dinámicamente desde finances.js');
}
