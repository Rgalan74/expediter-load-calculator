// âœ… history.js - VERSIÃ“N CORREGIDA PARA CARGAS HISTÃ“RICAS

let allData = [];
let filteredData = [];

// âœ… FUNCIÃ“N PRINCIPAL CORREGIDA - getLoadHistory
function getLoadHistory() {
  console.log("ðŸ“‹ Starting to load history...");
  
  if (!window.currentUser) {
    console.log("âŒ No user logged in for history");
    showHistoryMessage("Debe iniciar sesiÃ³n para ver el historial", "error");
    setLoadingState(false);
    return;
  }

  console.log("ðŸ“‹ Loading history for user:", window.currentUser.uid);
  setLoadingState(true);
  
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.error("âŒ Firebase not available");
    showHistoryMessage("Error: Firebase no estÃ¡ disponible", "error");
    setLoadingState(false);
    return;
  }
  
  // âœ… CONSULTA CORREGIDA - SIN orderBy que excluye cargas sin createdAt
  firebase.firestore()
    .collection("loads")
    .where("userId", "==", window.currentUser.uid)
    .get()
    .then(snapshot => {
      console.log(`ðŸ“¦ Firebase returned ${snapshot.docs.length} documents for history`);
      
      if (snapshot.empty) {
        console.log("ðŸ“Š No loads found for history");
        showHistoryEmpty();
        setLoadingState(false);
        return;
      }
      
      // âœ… Fix para el mapeo de datos en history.js - SecciÃ³n que procesa las cargas

   // En la funciÃ³n getLoadHistory(), reemplaza la secciÃ³n de mapeo con esto:

   allData = snapshot.docs.map(doc => {
    const data = doc.data();
    
    // Determinar fecha
   const loadDate = normalizeLoadDate(data);



    // âœ… CALCULAR CAMPOS FALTANTES BASADOS EN MILLAS
    const totalMiles = Number(data.totalMiles || data.miles || ((data.loaded || 0) + (data.deadhead || data.deadheadMiles || 0)));
    const operatingRate = data.operatingRate || 0.33;
    const fuelRate = data.fuelRate || 0.18;
    
    // âœ… MAPEAR CAMPOS ANTIGUOS A NUEVOS FORMATOS CON FALLBACKS
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
        // âœ… ASEGURAR CAMPOS DE COSTOS CON CÃLCULO AUTOMÃTICO SI FALTAN
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
        // âœ… CAMPOS ADICIONALES PARA COMPATIBILIDAD
        operatingRate: operatingRate,
        fuelRate: fuelRate
    };
});

      // âœ… ORDENAR POR FECHA (mÃ¡s recientes primero)
      allData.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return dateB - dateA;
      });

      console.log("âœ… Total processed loads for history:", allData.length);
      
      try {
        populateHistoryMonthSelector();
        renderFilteredImmediate();
        setLoadingState(false);
        
        if (allData.length === 0) {
          showHistoryMessage("No hay cargas guardadas. Crea tu primera carga en la calculadora.", "info");
        } else {
          showHistoryMessage(`âœ… Se cargaron ${allData.length} cargas exitosamente`, "success");
        }
        
      } catch (error) {
        console.error("âŒ Error updating history UI components:", error);
        showHistoryMessage("Error actualizando componentes: " + error.message, "error");
        setLoadingState(false);
      }
    })
    .catch(error => {
      console.error("âŒ Error loading history data:", error);
      setLoadingState(false);
      showHistoryMessage("âŒ Error loading history: " + error.message, "error");
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

    updateCounts();
    updateSummaryStats();
    renderHistoryTable();
    
    console.log(`âœ… History filtered and rendered: ${filteredData.length} loads from ${allData.length} total`);
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
        ðŸ“‹ No hay cargas para analizar. Â¡Crea algunas cargas primero!
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
          <p class="text-red-600 font-semibold">âŒ ${message}</p>
          <button onclick="getLoadHistory()" class="mt-3 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600">
            ðŸ”„ Reintentar
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
    const month = normalizeDate(load.date, "month"); // ðŸ‘ˆ usamos funciÃ³n unificada
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

  console.log(`âœ… Populated month selector with ${sortedMonths.length} months`);
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

function updateSummaryStats() {
  let totalMiles = 0;
  let totalProfit = 0;
  let totalRpm = 0;
  let totalRevenue = 0; // ðŸ’µ ingresos totales

  filteredData.forEach(load => {
    totalMiles += Number(load.totalMiles || 0);
    totalProfit += Number(load.netProfit || 0);
    totalRpm += Number(load.rpm || 0);
    totalRevenue += Number(load.totalCharge || 0); // sumar ingresos
  });

  const avgRpm = filteredData.length > 0 ? totalRpm / filteredData.length : 0;

  updateElement('sumTotal', filteredData.length);
  updateElement('sumMiles', totalMiles.toLocaleString());
  updateElement('sumRevenue', `$${totalRevenue.toFixed(2)}`); // ðŸ’µ mostrar ingresos
  updateElement('sumProfit', `$${totalProfit.toFixed(2)}`);
  updateElement('sumRpm', `$${avgRpm.toFixed(2)}`);
}


// âœ… FUNCIÃ“N CORREGIDA - renderHistoryTable
function renderHistoryTable() {
  const table = document.getElementById("loadList");
  if (!table) {
    console.warn("âŒ Load list table not found");
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
  origin: load.origin || '-',
  destination: load.destination || '-',
  companyName: load.companyName || '-',   // ðŸ†• agregado
  totalMiles: load.totalMiles || 0,
  rpm: load.rpm || 0,
  totalCharge: load.totalCharge || 0,
  netProfit: load.netProfit || 0,
  fuelCost: load.fuelCost || 0
};


      return `
  <tr class="hover:bg-gray-50">
    <td class="p-2 text-sm border-b">${safeLoad.date}</td>
    <td class="p-2 text-sm border-b">${safeLoad.origin}</td>
    <td class="p-2 text-sm border-b">${safeLoad.destination}</td>
    <td class="p-2 text-sm border-b">${safeLoad.companyName}</td> <!-- ðŸ†• aquÃ­ -->
    <td class="p-2 text-sm border-b">${safeLoad.totalMiles.toLocaleString()}</td>
    <td class="p-2 text-sm border-b">$${formatAmount(safeLoad.rpm)}</td>
    <td class="p-2 text-sm border-b">$${formatAmount(safeLoad.totalCharge)}</td>
    <td class="p-2 text-sm border-b ${safeLoad.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}">
      $${formatAmount(safeLoad.netProfit)}
    </td>
    <td class="p-2 text-sm border-b">$${formatAmount(safeLoad.fuelCost)}</td>
    <td class="p-2 text-sm border-b flex gap-2">
      <button class="text-purple-600 hover:underline" onclick="openNotesModal('${safeLoad.destination}')">ðŸ““ Notas</button>
      <button class="text-blue-600 hover:underline" onclick="editLoad('${safeLoad.id}')">âœï¸ Editar</button>
      <button class="text-red-600 hover:underline" onclick="deleteLoad('${safeLoad.id}')">ðŸ—‘ï¸ Eliminar</button>
    </td>
  </tr>
`;

    });

    table.innerHTML = rows.join('');
    
    console.log(`âœ… History table rendered successfully with ${filteredData.length} rows`);
  } catch (error) {
    console.error("âŒ Error rendering history table:", error);
    table.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-red-500">Error al mostrar los datos.</td></tr>';
  }
}

function deleteLoad(loadId) {
  if (!loadId) {
    showHistoryMessage("ID de carga invÃ¡lido", "error");
    return;
  }
  
  if (!confirm("Â¿EstÃ¡s seguro de que deseas eliminar esta carga?")) {
    return;
  }

  console.log("ðŸ—‘ï¸ Deleting load:", loadId);

  firebase.firestore()
    .collection("loads")
    .doc(loadId)
    .delete()
    .then(() => {
      allData = allData.filter(l => l.id !== loadId);
      renderFilteredImmediate();
      showHistoryMessage("âœ… Carga eliminada exitosamente", "success");
      console.log("âœ… Load deleted successfully");
    })
    .catch(error => {
      console.error("âŒ Error deleting load:", error);
      showHistoryMessage("âŒ Error al eliminar la carga: " + error.message, "error");
    });
}

function exportToCSV() {
  if (!Array.isArray(filteredData) || filteredData.length === 0) {
    showHistoryMessage("No hay datos para exportar", "error");
    return;
  }

  try {
    const headers = ['Fecha', 'NÃºmero de Carga', 'Origen', 'Destino', 'Millas', 'RPM', 'Tarifa', 'Ganancia', 'Empresa'];
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
        load.netProfit || 0,
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

    showHistoryMessage(`âœ… CSV exportado con ${filteredData.length} cargas`, "success");
    console.log("âœ… CSV exported successfully");
  } catch (error) {
    console.error("Error exporting CSV:", error);
    showHistoryMessage("âŒ Error al exportar CSV", "error");
  }
}

// âœ… Enviar carga a la calculadora
function loadIntoCalculator(loadId) {
  const load = allData.find(l => l.id === loadId);
  if (!load) {
    showHistoryMessage("Carga no encontrada", "error");
    return;
  }

  console.log("ðŸ“Š Cargando en calculadora:", loadId, load);

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
    
    showHistoryMessage("âœ… Carga cargada en la calculadora", "success");
  }, 200);
}

function showHistoryMessage(message, type = "info") {
  showMessage(message, type, "historyMessage");
}

// âœ… FunciÃ³n para abrir modal de ediciÃ³n
let currentEditingLoad = null;

function editLoad(loadId) {
  const load = allData.find(l => l.id === loadId);
  if (!load) {
    showHistoryMessage("Carga no encontrada", "error");
    return;
  }

  console.log("âœï¸ Editando carga:", loadId, load);
  currentEditingLoad = { ...load, id: loadId }; // ðŸ‘ˆ AquÃ­ SIEMPRE guardamos el id

  // Llenar los campos del modal
  populateEditForm(load);

  // Mostrar modal
  document.getElementById('editModal').classList.remove('hidden');

  // Configurar auto-cÃ¡lculo
  setupEditModalCalculations();
}

// âœ… Llenar formulario de ediciÃ³n
function populateEditForm(load) {
  // Campos bÃ¡sicos
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

  // âœ… Actualizar cÃ¡lculos iniciales (si existe la funciÃ³n)
  if (typeof updateEditCalculations === "function") {
    updateEditCalculations();
  }
}

let lastEditedField = null; // ðŸ‘ˆ variable global dentro de history.js

// âœ… Actualizar cÃ¡lculos en tiempo real (flexible)
function updateEditCalculations() {
  const loadedMiles = parseFloat(document.getElementById('editLoadedMiles')?.value) || 0;
  const deadheadMiles = parseFloat(document.getElementById('editDeadheadMiles')?.value) || 0;
  let rpm = parseFloat(document.getElementById('editRpm')?.value) || 0;
  let totalCharge = parseFloat(document.getElementById('editTotalCharge')?.value) || 0;
  const tolls = parseFloat(document.getElementById('editTolls')?.value) || 0;
  const otherCosts = parseFloat(document.getElementById('editOtherCosts')?.value) || 0;

  const totalMiles = loadedMiles + deadheadMiles;

  // ðŸ”„ Usar el Ãºltimo campo editado para decidir
  if (lastEditedField === 'editRpm' && totalMiles > 0) {
    totalCharge = (rpm * totalMiles) + tolls + otherCosts;
    document.getElementById('editTotalCharge').value = totalCharge.toFixed(2);
  } 
  else if (lastEditedField === 'editTotalCharge' && totalMiles > 0) {
    rpm = (totalCharge - tolls - otherCosts) / totalMiles;
    document.getElementById('editRpm').value = rpm.toFixed(2);
  }

  // CÃ¡lculos de costos
  const operatingCost = totalMiles * 0.33;
  const fuelCost = totalMiles * 0.18;
  const totalExpenses = operatingCost + fuelCost + tolls + otherCosts;
  const netProfit = totalCharge - totalExpenses;
  const profitMargin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;

  // âœ… Actualizar campos calculados
  document.getElementById('editTotalMiles').value = totalMiles;
  document.getElementById('editOperatingCost').textContent = '$' + operatingCost.toFixed(2);
  document.getElementById('editFuelCost').textContent = '$' + fuelCost.toFixed(2);
  document.getElementById('editNetProfit').textContent = '$' + netProfit.toFixed(2);
  document.getElementById('editProfitMargin').textContent = profitMargin.toFixed(1) + '%';
}


// âœ… Configurar auto-cÃ¡lculo
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
        lastEditedField = fieldId;   // ðŸ‘ˆ recordar cuÃ¡l fue modificado
        updateEditCalculations();
      });
    }
  });
}

// âœ… Guardar cambios desde el modal de ediciÃ³n
async function saveEditedLoad() {
  try {
    if (!currentEditingLoad || !currentEditingLoad.id) {
      throw new Error("âŒ No hay carga vÃ¡lida para editar");
    }

    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    console.log("ðŸ”Ž saveEditedLoad ejecutado, currentEditingLoad:", currentEditingLoad);

    // ðŸ‘‡ Leer valores del modal
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

    // ðŸ”„ Recalcular flexible RPM â†” Total
    if (lastEditedField === 'editRpm' && totalMiles > 0) {
      totalCharge = (rpm * totalMiles) + tolls + otherCosts;
    } else if (lastEditedField === 'editTotalCharge' && totalMiles > 0) {
      rpm = (totalCharge - tolls - otherCosts) / totalMiles;
    } else if (rpm > 0 && totalMiles > 0) {
      totalCharge = (rpm * totalMiles) + tolls + otherCosts;
    }

    // âœ… Costos y ganancias
    const operatingCost = totalMiles * 0.33;
    const fuelCost = totalMiles * 0.18;
    const totalExpenses = operatingCost + fuelCost + tolls + otherCosts;
    const netProfit = totalCharge - totalExpenses;
    const profitMargin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;

    // ðŸ“¦ Objeto actualizado
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

    // âœ… Guardar en Firestore
    const docRef = firebase.firestore().collection("loads").doc(currentEditingLoad.id);
    await docRef.set(updatedData, { merge: true });

    // âœ… Actualizar en memoria
    const loadIndex = allData.findIndex(l => l.id === currentEditingLoad.id);
    if (loadIndex !== -1) {
      allData[loadIndex] = { ...allData[loadIndex], ...updatedData };
    }

    closeEditModal();
    showHistoryMessage("âœ… Carga actualizada exitosamente", "success");
    renderFilteredImmediate();

    setTimeout(() => {
      if (currentEditingLoad && currentEditingLoad.id) {
        document.dispatchEvent(new CustomEvent('loadSaved', {
          detail: { loadId: currentEditingLoad.id, action: 'updated' }
        }));
      }
    }, 500);

  } catch (error) {
    console.error("âŒ Error en saveEditedLoad:", error);
    showHistoryMessage("âŒ Error: " + error.message, "error");
  }
}


// âœ… Cerrar modal
function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentEditingLoad = null;
}

// âœ… Cerrar con clic fuera del modal
document.addEventListener('click', function(event) {
  const modal = document.getElementById('editModal');
  if (modal && event.target === modal) {
    closeEditModal();
  }
});



console.log("âœ… Funciones completas del modal cargadas");

// âœ… Event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("ðŸ“‹ History.js DOM loaded");
  
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
      console.log(`âœ… Filter event listener added to ${id}`);
    }
  });
  
  console.log("âœ… History event listeners configured");
});

// ===============================
// ðŸ“œ LISTENERS PARA BOTONES DE HISTORIAL
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // ðŸ” BotÃ³n Filtrar
  document.getElementById("filterBtn")?.addEventListener("click", () => {
    console.log("ðŸ” BotÃ³n Filtrar clicado");
    if (typeof renderFiltered === "function") {
      renderFiltered();
    } else {
      console.error("âŒ La funciÃ³n renderFiltered no estÃ¡ definida");
    }
  });

  // ðŸ“¤ BotÃ³n Exportar a CSV
document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
  console.log("ðŸ“¤ BotÃ³n Exportar a CSV clicado");
  if (typeof exportToCSV === "function") {
    exportToCSV(); // ejecuta tu funciÃ³n real
  } else {
    console.error("âŒ La funciÃ³n exportToCSV no estÃ¡ definida");
  }
});

});


console.log("âœ… History.js loaded successfully (CORRECTED VERSION)");

window.getLoadHistory = getLoadHistory;
window.renderFiltered = renderFiltered;
window.exportToCSV = exportToCSV;
window.editLoad = editLoad;
window.deleteLoad = deleteLoad;