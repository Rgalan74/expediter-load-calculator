// history.js - VERSIÓN CORREGIDA PARA CARGAS HISTÓRICAS

// IMPORTS COMENTADOS - Usando funciones globales en su lugar
// import { sanitizeHTML } from './security.js';
// import { confirmDialog, showToast } from './ui-feedback.js';
// Las funciones están disponibles globalmente desde los scripts

let allData = [];
let filteredData = [];
// Estado de ordenamiento
let currentHistorySort = { column: 'date', asc: false }; // Por defecto: más recientes primero

// FUNCION PRINCIPAL CORREGIDA - getLoadHistory
function getLoadHistory() {
  debugLog(" Starting to load history...");

  if (!window.currentUser) {
    debugLog(" No user logged in for history");
    showHistoryMessage("Debe iniciar sesión para ver el historial", "error");
    setLoadingState(false);
    return;
  }

  debugLog(" Loading history for user:", window.currentUser.uid);
  setLoadingState(true);

  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.error(" Firebase not available");
    showHistoryMessage("Error: Firebase no está disponible", "error");
    setLoadingState(false);
    return;
  }

  // CONSULTA CORREGIDA - SIN orderBy que excluye cargas sin createdAt
  firebase.firestore()
    .collection("loads")
    .where("userId", "==", window.currentUser.uid)
    .get()
    .then(snapshot => {
      debugLog(` Firebase returned ${snapshot.docs.length} documents for history`);

      if (snapshot.empty) {
        debugLog(" No loads found for history");
        showHistoryEmpty();
        setLoadingState(false);
        return;
      }

      // Fix para el mapeo de datos en history.js - Sección que procesa las cargas

      // En la función getLoadHistory(), reemplaza la sección de mapeo con esto:

      allData = snapshot.docs.map(doc => {
        const data = doc.data();

        // Determinar fecha
        debugLog(" Documento crudo:", doc.id, data);

        let loadDate = data.date;

        debugLog(" Antes de procesar | data.date:", data.date, " | createdAt:", data.createdAt);

        if (!loadDate && data.createdAt) {
          try {
            loadDate = data.createdAt.toDate().toISOString().split('T')[0];
          } catch (e) {
            loadDate = new Date().toISOString().split('T')[0];
          }
        } else if (!loadDate) {
          loadDate = new Date().toISOString().split('T')[0];
        }

        debugLog(" Fecha final usada:", loadDate, " (doc.id:", doc.id, ")");


        // CALCULAR CAMPOS FALTANTES BASADOS EN MILLAS
        const totalMiles = Number(data.totalMiles || data.miles || ((data.loaded || 0) + (data.deadhead || data.deadheadMiles || 0)));
        const operatingRate = data.operatingRate || 0.33;
        const fuelRate = data.fuelRate || 0.18;

        // MAPEAR CAMPOS ANTIGUOS A NUEVOS FORMATOS CON FALLBACKS
        return {
          id: doc.id,
          ...data,
          date: loadDate,
          // Mapear diferentes nombres de campos
          totalMiles: totalMiles,
          loadedMiles: Number(data.loadedMiles || data.loaded || 0),
          deadheadMiles: Number(data.deadheadMiles || data.deadhead || 0),
          totalCharge: Number(data.totalCharge || data.rate || data.totalCost || 0),
          netProfit: Number(data.netProfit || data.profit || 0),
          rpm: Number(data.rpm || 0),
          // ASEGURAR CAMPOS DE COSTOS CON CÁLCULO AUTOMÁTICO SI FALTAN
          fuelCost: Number(data.fuelCost || (totalMiles * fuelRate)),
          operatingCost: Number(data.operatingCost || data.opCost || (totalMiles * operatingRate)),
          tolls: Number(data.tolls || 0),
          otherCosts: Number(data.otherCosts || 0),
          // Campos de texto
          origin: data.origin || '-',
          destination: data.destination || '-',
          loadNumber: data.loadNumber || '',
          companyName: data.companyName || '',
          notes: data.notes || '',
          // CAMPOS ADICIONALES PARA COMPATIBILIDAD
          operatingRate: operatingRate,
          fuelRate: fuelRate
        };
      });

      // ORDENAR POR FECHA (más recientes primero)
      allData.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return dateB - dateA;
      });

      debugLog(" Total processed loads for history:", allData.length);

      try {
        populateHistoryMonthSelector();
        renderFilteredImmediate();
        setLoadingState(false);

        if (allData.length === 0) {
          showHistoryMessage("No hay cargas guardadas. Crea tu primera carga en la calculadora.", "info");
        } else {
          showHistoryMessage(` Se cargaron ${allData.length} cargas exitosamente`, "success");
        }

      } catch (error) {
        console.error(" Error updating history UI components:", error);
        showHistoryMessage("Error actualizando componentes: " + error.message, "error");
        setLoadingState(false);
      }
    })
    .catch(error => {
      console.error(" Error loading history data:", error);
      setLoadingState(false);
      showHistoryMessage(" Error loading history: " + error.message, "error");
      setErrorState("Error cargando datos");
    });
}

function renderFilteredImmediate() {
  try {
    const originFilter = document.getElementById('filterOrigin')?.value.toLowerCase() || '';
    const destFilter = document.getElementById('filterDestination')?.value.toLowerCase() || '';
    const month = document.getElementById('historyMonthSelect')?.value || '';

    filteredData = allData.filter(load => {
      const originMatch = !originFilter || (load.origin?.toLowerCase().includes(originFilter));
      const destMatch = !destFilter || (load.destination?.toLowerCase().includes(destFilter));
      const monthMatch = !month || (load.date && load.date.startsWith(month));
      return originMatch && destMatch && monthMatch;
    });

    // APLICAR ORDENAMIENTO
    if (window.currentHistorySort && window.currentHistorySort.column) {
      const { column, asc } = window.currentHistorySort;
      filteredData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Manejo de nulos
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // Comparación numérica 
        if (column === 'totalMiles' || column === 'rpm' || column === 'totalCharge' || column === 'netProfit') {
          return asc ? (Number(valA) - Number(valB)) : (Number(valB) - Number(valA));
        }

        // Comparación de fechas
        if (column === 'date') {
          const dateA = new Date(valA || '1970-01-01');
          const dateB = new Date(valB || '1970-01-01');
          return asc ? dateA - dateB : dateB - dateA;
        }

        // Comparación de texto por defecto
        return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    }

    // APLICAR ORDENAMIENTO
    if (currentHistorySort.column) {
      const { column, asc } = currentHistorySort;
      filteredData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Manejo de nulos
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // Comparación numérica o string
        if (typeof valA === 'number' && typeof valB === 'number') {
          return asc ? valA - valB : valB - valA;
        } else {
          return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        }
      });
    }

    updateCounts();
    updateSummaryStats();
    renderHistoryTable();

    debugLog(` History filtered and rendered: ${filteredData.length} loads from ${allData.length} total`);
  } catch (error) {
    console.error("Error filtering history data:", error);
    showHistoryMessage("Error al filtrar datos", "error");
  }
}

function setLoadingState(isLoading) {
  const loadList = document.getElementById('loadList');
  if (!loadList) return;

  if (isLoading) {
    loadList.innerHTML = `
 <tr>
 <td colspan="9" class="p-4 text-center text-gray-500">
 <div class="spinner mx-auto mb-2"></div>
 Cargando historial...
 </td>
 </tr>
 `;
  }
}

function showHistoryEmpty() {
  const loadList = document.getElementById('loadList');
  if (!loadList) return;

  loadList.innerHTML = `
 <tr>
 <td colspan="9" class="p-4 text-center text-gray-500">
 No hay cargas para analizar. ¡Crea algunas cargas primero!
 </td>
 </tr>
 `;

  updateElement('filteredCount', '0');
  updateElement('totalCount', '0');
  updateElement('sumTotal', '0');
  updateElement('sumMiles', '0');
  updateElement('sumProfit', '$0.00');
  updateElement('sumRpm', '$0.00');
}

function setErrorState(message) {
  const loadList = document.getElementById('loadList');
  if (!loadList) return;

  loadList.innerHTML = `
 <tr>
 <td colspan="9" class="p-4 text-center">
 <div class="bg-red-50 border border-red-200 rounded p-4">
 <p class="text-red-600 font-semibold"> ${message}</p>
 <button onclick="getLoadHistory()" class="mt-3 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600">
 Reintentar
 </button>
 </div>
 </td>
 </tr>
 `;
}

function populateHistoryMonthSelector() {
  const selector = document.getElementById("historyMonthSelect");
  if (!selector) {
    console.warn("Month selector not found");
    return;
  }

  const months = new Set();
  (allData || []).forEach(load => {
    const month = normalizeDate(load.date, "month"); // usamos función unificada
    if (month) months.add(month);
  });

  const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));

  selector.innerHTML = '<option value="">Todos los Meses</option>';

  sortedMonths.forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    selector.appendChild(option);
  });

  debugLog(` Populated month selector with ${sortedMonths.length} months`);
}


function renderFiltered() {
  renderFilteredImmediate();
}

function updateCounts() {
  const filteredCountEl = document.getElementById('filteredCount');
  const totalCountEl = document.getElementById('totalCount');

  if (filteredCountEl) filteredCountEl.textContent = filteredData.length;
  if (totalCountEl) totalCountEl.textContent = allData.length;
}

async function updateSummaryStats() {
  try {
    console.log('📊 updateSummaryStats iniciado');

    let totalMiles = 0;
    let totalRevenue = 0; // ingresos totales

    filteredData.forEach(load => {
      totalMiles += Number(load.totalMiles || 0);
      totalRevenue += Number(load.totalCharge || 0); // sumar ingresos
    });

    console.log('📊 Calculado revenue:', totalRevenue, 'miles:', totalMiles);

    // Cargar gastos del mismo periodo que las cargas filtradas
    let totalExpenses = 0;

    if (window.currentUser && filteredData.length > 0) {
      try {
        console.log('📊 Cargando gastos...');

        // Obtener rango de fechas de las cargas filtradas
        const dates = filteredData.map(load => load.date).filter(d => d);
        const minDate = dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : null;
        const maxDate = dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : null;

        console.log('📊 Rango de fechas:', minDate, 'a', maxDate);

        if (minDate && maxDate) {
          // Verificar que Firebase esté disponible
          if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.warn('⚠️ Firebase no disponible, usando totalExpenses = 0');
          } else {
            // Cargar todos los gastos del usuario
            const expensesSnapshot = await firebase.firestore()
              .collection("expenses")
              .where("userId", "==", window.currentUser.uid)
              .get();

            console.log('📊 Gastos encontrados:', expensesSnapshot.docs.length);


            // Sumar TODOS los gastos (sin filtro de fechas - Opción A)
            expensesSnapshot.docs.forEach(doc => {
              const expense = doc.data();
              totalExpenses += Number(expense.amount || 0);
            });


            console.log('📊 Total gastos (TODOS):', totalExpenses);
          }
        }
      } catch (error) {
        console.error("❌ Error cargando gastos para History:", error);
        // Si hay error, totalExpenses queda en 0
      }
    } else {
      console.log('📊 Sin usuario, totalExpenses = 0');
    }

    // Ganancia neta REAL (igual que Finances): Ingresos - Gastos
    const totalProfit = totalRevenue - totalExpenses;

    // RPM ponderado por millas (igual que Finances) - más preciso
    const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

    console.log('📊 KPIs finales:', { totalProfit, avgRpm, totalExpenses });

    updateElement('sumTotal', filteredData.length);
    updateElement('sumMiles', totalMiles.toLocaleString());
    updateElement('sumRevenue', formatCurrency(totalRevenue)); // mostrar ingresos
    updateElement('sumProfit', formatCurrency(totalProfit));  // Ganancia neta real
    updateElement('sumRpm', formatCurrency(avgRpm));

    console.log('✅ updateSummaryStats completado');
  } catch (error) {
    console.error('❌ ERROR CRÍTICO en updateSummaryStats:', error);
    // Fallback: mostrar al menos los valores básicos
    updateElement('sumTotal', filteredData?.length || 0);
    updateElement('sumMiles', '0');
    updateElement('sumRevenue', '$0.00');
    updateElement('sumProfit', '$0.00');
    updateElement('sumRpm', '$0.00');
  }
}


// FUNCION CORREGIDA - renderHistoryTable
function renderHistoryTable() {
  const table = document.getElementById("loadList");
  if (!table) {
    console.warn(" Load list table not found");
    return;
  }

  if (!Array.isArray(filteredData) || filteredData.length === 0) {
    table.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-gray-500">No hay datos disponibles con los filtros actuales.</td></tr>';
    return;
  }

  try {
    const rows = filteredData.map(load => {
      const safeLoad = {
        id: load.id || '',
        date: load.date || '-',
        loadNumber: load.loadNumber || '', // AGREGADO - Número de carga
        origin: load.origin || '-',
        destination: load.destination || '-',
        companyName: load.companyName || '-',
        totalMiles: load.totalMiles || 0,
        rpm: load.rpm || 0,
        totalCharge: load.totalCharge || 0,
        netProfit: load.netProfit || 0,
        fuelCost: load.fuelCost || 0
      };


      return `
 <tr class="bg-blue-50 hover:bg-blue-100 transition-colors">
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">${safeLoad.date}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">${safeLoad.loadNumber || "-"}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">${safeLoad.origin}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">${safeLoad.destination}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">${safeLoad.companyName}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">${safeLoad.totalMiles.toLocaleString()}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">$${formatAmount(safeLoad.rpm)}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 whitespace-nowrap">$${formatAmount(safeLoad.totalCharge)}</td>
 <td class="px-4 py-3 text-sm border-b border-blue-100 flex gap-2 whitespace-nowrap">
 <button class="text-blue-600 hover:text-blue-800 font-medium" onclick="editLoad('${safeLoad.id}')">Editar</button>
 <button class="text-red-600 hover:text-red-800 font-medium" onclick="deleteLoad('${safeLoad.id}')">Eliminar</button>
 </td>
 </tr>
`;

    });

    table.innerHTML = rows.join('');

    debugLog(` History table rendered successfully with ${filteredData.length} rows`);
  } catch (error) {
    console.error(" Error rendering history table:", error);
    table.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-red-500">Error al mostrar los datos.</td></tr>';
  }
}

function deleteLoad(loadId) {
  if (!loadId) {
    showHistoryMessage("ID de carga inválido", "error");
    return;
  }

  // Use modern confirm dialog instead of window.confirm
  confirmDialog(
    "¿Estás seguro de que deseas eliminar esta carga? Esta acción no se puede deshacer.",
    () => {
      // onConfirm - Execute delete
      executeDeleteLoad(loadId);
    },
    () => {
      // onCancel - Do nothing
      debugLog("Delete cancelled by user");
    }
  );
}

// Extracted delete logic
function executeDeleteLoad(loadId) {

  debugLog(" Deleting load:", loadId);

  firebase.firestore()
    .collection("loads")
    .doc(loadId)
    .delete()
    .then(() => {
      allData = allData.filter(l => l.id !== loadId);
      renderFilteredImmediate();
      showToast("Carga eliminada exitosamente", "success");
      debugLog(" Load deleted successfully");
    })
    .catch(error => {
      console.error(" Error deleting load:", error);
      showToast("Error al eliminar la carga: " + error.message, "error");
    });
}

function exportToCSV() {
  if (!Array.isArray(filteredData) || filteredData.length === 0) {
    showHistoryMessage("No hay datos para exportar", "error");
    return;
  }

  try {
    const headers = ['Fecha', 'Número de Carga', 'Origen', 'Destino', 'Millas', 'RPM', 'Tarifa', 'Empresa'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(load => [
        load.date || '',
        load.loadNumber || '',
        `"${(load.origin || '').replace(/"/g, '""')}"`,
        `"${(load.destination || '').replace(/"/g, '""')}"`,
        load.totalMiles || 0,
        load.rpm || 0,
        load.totalCharge || 0,
        `"${(load.companyName || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expediter-loads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showHistoryMessage(` CSV exportado con ${filteredData.length} cargas`, "success");
    debugLog(" CSV exported successfully");
  } catch (error) {
    console.error("Error exporting CSV:", error);
    showHistoryMessage(" Error al exportar CSV", "error");
  }
}

// Enviar carga a la calculadora
function loadIntoCalculator(loadId) {
  const load = allData.find(l => l.id === loadId);
  if (!load) {
    showHistoryMessage("Carga no encontrada", "error");
    return;
  }

  debugLog(" Cargando en calculadora:", loadId, load);

  if (typeof openTab === 'function') {
    openTab('calculator');
  } else {
    const calculatorTab = document.querySelector('[data-tab="calculator"]');
    if (calculatorTab) calculatorTab.click();
  }

  setTimeout(() => {
    const fields = {
      'origin': load.origin || '',
      'destination': load.destination || '',
      'loadedMiles': load.loadedMiles || '',
      'deadheadMiles': load.deadheadMiles || '',
      'rpm': load.rpm || '',
      'tolls': load.tolls || '',
      'otherCosts': load.otherCosts || '',
      'loadNumber': load.loadNumber || '',
      'companyName': load.companyName || '',
      'notes': load.notes || ''
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value;
        element.classList.add('bg-blue-50');
        setTimeout(() => element.classList.remove('bg-blue-50'), 1000);
      }
    });

    setTimeout(() => {
      if (typeof calculate === 'function') {
        calculate();
      }
    }, 100);

    showHistoryMessage(" Carga cargada en la calculadora", "success");
  }, 200);
}

// Función para abrir modal de edición
let currentEditingLoad = null;

function editLoad(loadId) {
  const load = allData.find(l => l.id === loadId);
  if (!load) {
    showHistoryMessage("Carga no encontrada", "error");
    return;
  }

  debugLog(" Editando carga:", loadId, load);
  currentEditingLoad = { ...load, id: loadId }; // Aquí SIEMPRE guardamos el id

  // Llenar los campos del modal
  populateEditForm(load);

  // Mostrar modal
  document.getElementById('editModal').classList.remove('hidden');

  // Configurar auto-cálculo
  setupEditModalCalculations();
}

// Llenar formulario de edición
function populateEditForm(load) {
  // Campos básicos
  document.getElementById('editDate').value = load.date || '';
  document.getElementById('editLoadNumber').value = load.loadNumber || '';
  document.getElementById('editOrigin').value = load.origin || '';
  document.getElementById('editDestination').value = load.destination || '';

  // Millas
  document.getElementById('editLoadedMiles').value = load.loadedMiles || 0;
  document.getElementById('editDeadheadMiles').value = load.deadheadMiles || 0;
  document.getElementById('editTotalMiles').value = load.totalMiles || 0;

  // Financiero
  document.getElementById('editRpm').value = load.rpm || 0;
  document.getElementById('editTotalCharge').value = load.totalCharge || 0;
  document.getElementById('editTolls').value = load.tolls || 0;
  document.getElementById('editOtherCosts').value = load.otherCosts || 0;

  // Empresa y notas
  document.getElementById('editCompanyName').value = load.companyName || '';
  document.getElementById('editNotes').value = load.notes || '';
  document.getElementById('editRepositionMiles').value = load.repositionMiles || 0;

  // Actualizar cálculos iniciales (si existe la función)
  if (typeof updateEditCalculations === "function") {
    updateEditCalculations();
  }
}

let lastEditedField = null; // variable global dentro de history.js

// Actualizar cálculos en tiempo real (flexible)
function updateEditCalculations() {
  const loadedMiles = parseFloat(document.getElementById('editLoadedMiles')?.value) || 0;
  const deadheadMiles = parseFloat(document.getElementById('editDeadheadMiles')?.value) || 0;
  let rpm = parseFloat(document.getElementById('editRpm')?.value) || 0;
  let totalCharge = parseFloat(document.getElementById('editTotalCharge')?.value) || 0;
  const tolls = parseFloat(document.getElementById('editTolls')?.value) || 0;
  const otherCosts = parseFloat(document.getElementById('editOtherCosts')?.value) || 0;

  const totalMiles = loadedMiles + deadheadMiles;

  // Usar el último campo editado para decidir
  if (lastEditedField === 'editRpm' && totalMiles > 0) {
    totalCharge = (rpm * totalMiles) + tolls + otherCosts;
    document.getElementById('editTotalCharge').value = totalCharge.toFixed(2);
  }
  else if (lastEditedField === 'editTotalCharge' && totalMiles > 0) {
    rpm = (totalCharge - tolls - otherCosts) / totalMiles;
    document.getElementById('editRpm').value = rpm.toFixed(2);
  }

  // Cálculos de costos
  const operatingCost = totalMiles * 0.33;
  const fuelCost = totalMiles * 0.18;
  const totalExpenses = operatingCost + fuelCost + tolls + otherCosts;
  const netProfit = totalCharge - totalExpenses;
  const profitMargin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;

  // Actualizar campos calculados
  document.getElementById('editTotalMiles').value = totalMiles;
  document.getElementById('editOperatingCost').textContent = '$' + operatingCost.toFixed(2);
  document.getElementById('editFuelCost').textContent = '$' + fuelCost.toFixed(2);
  document.getElementById('editNetProfit').textContent = '$' + netProfit.toFixed(2);
  document.getElementById('editProfitMargin').textContent = profitMargin.toFixed(1) + '%';
}


// Configurar auto-cálculo
function setupEditModalCalculations() {
  const fieldsToWatch = [
    'editLoadedMiles',
    'editDeadheadMiles',
    'editRpm',
    'editTotalCharge',
    'editTolls',
    'editOtherCosts'
  ];

  fieldsToWatch.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        lastEditedField = fieldId; // recordar cuál fue modificado
        updateEditCalculations();
      });
    }
  });
}

// Guardar cambios desde el modal de edición
async function saveEditedLoad() {
  try {
    if (!currentEditingLoad || !currentEditingLoad.id) {
      throw new Error(" No hay carga válida para editar");
    }

    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    debugLog(" saveEditedLoad ejecutado, currentEditingLoad:", currentEditingLoad);

    // Leer valores del modal
    const loadedMiles = parseFloat(document.getElementById('editLoadedMiles')?.value) || 0;
    const deadheadMiles = parseFloat(document.getElementById('editDeadheadMiles')?.value) || 0;
    const totalMiles = loadedMiles + deadheadMiles;

    let rpm = parseFloat(document.getElementById('editRpm')?.value) || 0;
    let totalCharge = parseFloat(document.getElementById('editTotalCharge')?.value) || 0;
    const tolls = parseFloat(document.getElementById('editTolls')?.value) || 0;
    const otherCosts = parseFloat(document.getElementById('editOtherCosts')?.value) || 0;
    const repositionMiles = parseFloat(document.getElementById('editRepositionMiles')?.value) || 0;

    const companyName = document.getElementById('editCompanyName')?.value.trim() || '';
    const notes = document.getElementById('editNotes')?.value.trim() || '';
    const editedDate = document.getElementById('editDate')?.value || new Date().toISOString().split('T')[0];
    const loadNumber = document.getElementById('editLoadNumber')?.value.trim() || '';
    const origin = document.getElementById('editOrigin')?.value.trim() || '';
    const destination = document.getElementById('editDestination')?.value.trim() || '';

    if (!origin || !destination) throw new Error('Origen y destino son requeridos');
    if (totalMiles <= 0) throw new Error('Las millas totales deben ser mayores a 0');

    // Recalcular flexible RPM Total
    if (lastEditedField === 'editRpm' && totalMiles > 0) {
      totalCharge = (rpm * totalMiles) + tolls + otherCosts;
    } else if (lastEditedField === 'editTotalCharge' && totalMiles > 0) {
      rpm = (totalCharge - tolls - otherCosts) / totalMiles;
    } else if (rpm > 0 && totalMiles > 0) {
      totalCharge = (rpm * totalMiles) + tolls + otherCosts;
    }

    // Costos y ganancias
    const operatingCost = totalMiles * 0.33;
    const fuelCost = totalMiles * 0.18;
    const totalExpenses = operatingCost + fuelCost + tolls + otherCosts;
    const netProfit = totalCharge - totalExpenses;
    const profitMargin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;

    // Objeto actualizado
    const updatedData = {
      date: editedDate,
      loadNumber,
      origin,
      destination,
      loadedMiles,
      deadheadMiles,
      totalMiles,
      rpm,
      totalCharge,
      tolls,
      otherCosts,
      repositionMiles,
      operatingCost,
      fuelCost,
      totalExpenses,
      netProfit,
      profit: netProfit,
      profitMargin,
      companyName,
      notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Guardar en Firestore
    const docRef = firebase.firestore().collection("loads").doc(currentEditingLoad.id);
    await docRef.set(updatedData, { merge: true });

    // Actualizar en memoria
    const loadIndex = allData.findIndex(l => l.id === currentEditingLoad.id);
    if (loadIndex !== -1) {
      allData[loadIndex] = { ...allData[loadIndex], ...updatedData };
    }

    closeEditModal();
    showHistoryMessage(" Carga actualizada exitosamente", "success");
    renderFilteredImmediate();

    setTimeout(() => {
      if (currentEditingLoad && currentEditingLoad.id) {
        document.dispatchEvent(new CustomEvent('loadSaved', {
          detail: { loadId: currentEditingLoad.id, action: 'updated' }
        }));
      }
    }, 500);

  } catch (error) {
    console.error(" Error en saveEditedLoad:", error);
    showHistoryMessage(" Error: " + error.message, "error");
  }
}


// Cerrar modal
function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentEditingLoad = null;
}

// Cerrar con clic fuera del modal
document.addEventListener('click', function (event) {
  const modal = document.getElementById('editModal');
  if (modal && event.target === modal) {
    closeEditModal();
  }
});



debugLog(" Funciones completas del modal cargadas");

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('history-filter-listeners', () => {
    debugLog(" History.js DOM loaded");

    const filterInputs = ['filterOrigin', 'filterDestination', 'historyMonthSelect'];

    filterInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        let timeoutId;
        const handler = () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(renderFilteredImmediate, 300);
        };

        input.addEventListener('change', handler);
        input.addEventListener('keyup', handler);
        debugLog(` Filter event listener added to ${id}`);
      }
    });

    debugLog(" History event listeners configured");
  });
});

// ===============================
// LISTENERS PARA BOTONES DE HISTORIAL
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('history-button-listeners', () => {
    // Botón Filtrar
    document.getElementById("filterBtn")?.addEventListener("click", () => {
      debugLog(" Botón Filtrar clicado");
      if (typeof renderFiltered === "function") {
        renderFiltered();
      } else {
        console.error(" La función renderFiltered no está definida");
      }
    });

    // Botón Exportar a CSV
    document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
      debugLog(" Botón Exportar a CSV clicado");
      if (typeof exportToCSV === "function") {
        exportToCSV(); // ejecuta tu función real
      } else {
        console.error(" La función exportToCSV no está definida");
      }
    });

  });
});

// ======================================================
// LEX: Analizar historial desde la burbuja
// ======================================================
window.analyzeLexHistory = async function () {
  try {
    debugLog(" [LEX-HISTORY] Iniciando análisis de historial con Lex...");

    // Asegurar que LexAI exista
    if (!window.lexAI && typeof LexAI === 'function') {
      window.lexAI = new LexAI();
      await window.lexAI.initializeContext();
    }

    // Elegir qué datos usar: primero el filtro, si no, todo
    let dataToAnalyze = [];

    if (Array.isArray(filteredData) && filteredData.length > 0) {
      dataToAnalyze = filteredData;
      debugLog(` [LEX-HISTORY] Usando ${filteredData.length} cargas filtradas`);
    } else if (Array.isArray(allData) && allData.length > 0) {
      dataToAnalyze = allData;
      debugLog(` [LEX-HISTORY] Usando todas las ${allData.length} cargas`);
    } else {
      // Si no hay datos cargados todavía, intentamos cargarlos
      if (typeof getLoadHistory === 'function') {
        debugLog(" [LEX-HISTORY] No había datos, llamando getLoadHistory...");
        await getLoadHistory();

        if (Array.isArray(filteredData) && filteredData.length > 0) {
          dataToAnalyze = filteredData;
        } else if (Array.isArray(allData) && allData.length > 0) {
          dataToAnalyze = allData;
        }
      }
    }

    // Si sigue sin haber nada, avisamos
    if (!dataToAnalyze || dataToAnalyze.length === 0) {
      debugLog(" [LEX-HISTORY] No hay cargas para analizar");
      if (window.setLexState) {
        window.setLexState('sad', {
          message: 'No tengo cargas en el historial para analizar todavía 😕',
          duration: 4000
        });
      }
      alert('No hay cargas en el historial para analizar con Lex.');
      return null;
    }

    // Animación / estado de Lex
    if (window.setLexState) {
      window.setLexState('thinking', {
        message: `Analizando ${dataToAnalyze.length} cargas de tu historial 📚`,
        duration: 4000
      });
    }

    // Llamar al cerebro de Lex (método de la clase LexAI)
    if (window.lexAI && typeof window.lexAI.analyzeHistoryLoads === 'function') {
      const result = await window.lexAI.analyzeHistoryLoads(dataToAnalyze);
      return result;
    } else {
      console.warn("[LEX-HISTORY] lexAI o analyzeHistoryLoads no disponibles");
      if (window.setLexState) {
        window.setLexState('warning', {
          message: 'No pude acceder al análisis de historial de Lex ⚙️',
          duration: 4000
        });
      }
      return null;
    }
  } catch (err) {
    console.error('[LEX-HISTORY] Error en analyzeLexHistory:', err);
    if (window.setLexState) {
      window.setLexState('warning', {
        message: 'Algo falló al analizar el historial con Lex 🛠️',
        duration: 5000
      });
    }
    return null;
  }
};

debugLog(" History.js loaded successfully (CORRECTED VERSION)");

// ========================================
// CUSTOM MONTH PICKER MODAL - Optimizado para móvil
// ========================================

// Abrir el modal de selección de meses
function openMonthPicker() {
  const modal = document.getElementById('monthPickerModal');
  if (!modal) return;

  populateMonthPickerModal();
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Cerrar el modal de selección de meses
function closeMonthPicker() {
  const modal = document.getElementById('monthPickerModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Poblar el modal con los meses disponibles
function populateMonthPickerModal() {
  const container = document.getElementById('monthButtonsContainer');
  if (!container) return;

  const months = new Set();
  (allData || []).forEach(load => {
    const month = normalizeDate(load.date, "month");
    if (month) months.add(month);
  });

  const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));

  let html = `
    <button onclick="selectMonth('')" class="w-full py-4 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition shadow-md flex items-center justify-center gap-2">
      <span>📅</span> Todos los meses
    </button>
  `;

  sortedMonths.forEach(month => {
    html += `
      <button onclick="selectMonth('${month}')" class="w-full py-3 px-4 rounded-xl font-medium transition flex items-center justify-between" style="background-color: rgba(30, 58, 138, 0.7); color: white; border: 2px solid rgba(96, 165, 250, 0.4);">
        <span class="flex items-center gap-2">
          <span class="text-lg">📆</span> ${month}
        </span>
        <span style="color: rgba(255,255,255,0.6);">→</span>
      </button>
    `;
  });

  if (sortedMonths.length === 0) {
    html = `
      <div class="text-center py-8 text-gray-500">
        <span class="text-4xl mb-2 block">📭</span>
        <p>No hay meses con cargas registradas</p>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Seleccionar un mes y aplicar el filtro
function selectMonth(month) {
  const selector = document.getElementById('historyMonthSelect');
  if (selector) {
    selector.value = month;
  }

  // Actualizar el botón de mostrar con el mes seleccionado
  const triggerBtn = document.getElementById('monthPickerTrigger');
  if (triggerBtn) {
    triggerBtn.textContent = month || 'Todos los meses';
  }

  closeMonthPicker();

  // Aplicar filtro automáticamente
  if (typeof applyFilters === 'function') {
    applyFilters();
  } else if (typeof renderFiltered === 'function') {
    renderFiltered();
  }
}

// Inicializar el trigger button para el month picker en móvil
function initMobileMonthPicker() {
  const selector = document.getElementById('historyMonthSelect');
  if (!selector) return;

  // Detectar si es móvil
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Prevenir que se abra el select nativo
    selector.addEventListener('mousedown', function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        openMonthPicker();
      }
    });

    selector.addEventListener('touchstart', function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        openMonthPicker();
      }
    });
  }
}

// Inicializar cuando se cargue la página
document.addEventListener('DOMContentLoaded', initMobileMonthPicker);

window.getLoadHistory = getLoadHistory;
window.renderFiltered = renderFiltered;
window.exportToCSV = exportToCSV;
window.editLoad = editLoad;
window.deleteLoad = deleteLoad;
window.openMonthPicker = openMonthPicker;
window.closeMonthPicker = closeMonthPicker;
window.selectMonth = selectMonth;