// finances.js - Versión Completamente Corregida

var financesData = [];
var expensesData = [];
var cashFlowChart = null;
var expenseBreakdownChart = null;
var financesLoaded = false;

// ✅ Motor de datos unificado (para Dashboard y Finances)
async function loadFinancialData(period = "all") {
  if (!window.currentUser) throw new Error("Usuario no autenticado");
  const uid = window.currentUser.uid;

  // ==============================
  // 1. Cargas (ingresos)
  // ==============================
  const loadSnapshot = await window.db
    .collection("loads")
    .where("userId", "==", uid)
    .get();

  let loads = loadSnapshot.docs.map(doc => {
    const data = doc.data();
    let loadDate = data.date || null;

    if (!loadDate && data.createdAt) {
      try {
        if (typeof data.createdAt.toDate === "function") {
          loadDate = data.createdAt.toDate().toISOString().split("T")[0];
        } else if (typeof data.createdAt.seconds === "number") {
          loadDate = new Date(data.createdAt.seconds * 1000).toISOString().split("T")[0];
        } else if (typeof data.createdAt === "string") {
          loadDate = new Date(data.createdAt).toISOString().split("T")[0];
        }
      } catch (e) {
        loadDate = new Date().toISOString().split("T")[0];
      }
    }
    if (!loadDate) loadDate = new Date().toISOString().split("T")[0];

    return {
      id: doc.id,
      date: loadDate,
      totalMiles: Number(data.totalMiles || data.miles || 0),
      totalCharge: Number(data.totalCharge || data.rate || 0),
      netProfit: Number(data.netProfit || data.profit || 0),
      rpm: Number(data.rpm || 0),
      operatingCost: Number(data.operatingCost || data.opCost || 0),
      fuelCost: Number(data.fuelCost || 0),
      tolls: Number(data.tolls || 0),
      otherCosts: Number(data.otherCosts || 0),
      origin: data.origin || "-",
      destination: data.destination || "-",
      companyName: data.companyName || "",
      notes: data.notes || ""
    };
  });

  // 📅 Filtrar por período
  if (period !== "all") {
    loads = loads.filter(l => l.date?.substring(0, 7) === period);
  }

  // ==============================
  // 2. Gastos (manuales)
  // ==============================
  const expSnapshot = await window.db
    .collection("expenses")
    .where("userId", "==", uid)
    .get();

  let expenses = expSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  if (period !== "all") {
    expenses = expenses.filter(e => e.date?.substring(0, 7) === period);
  }

  // ==============================
  // 3. KPIs
  // ==============================
  const totalRevenue = loads.reduce((s, l) => s + l.totalCharge, 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalProfit = loads.reduce((s, l) => s + l.netProfit, 0);
  const totalMiles = loads.reduce((s, l) => s + l.totalMiles, 0);

  const kpis = {
    totalRevenue,
    totalExpenses,
    netProfit: totalProfit - totalExpenses,
    margin: totalRevenue > 0 ? ((totalProfit - totalExpenses) / totalRevenue) * 100 : 0,
    totalMiles,
    avgRpm: totalMiles > 0 ? totalRevenue / totalMiles : 0
  };

  return { loads, expenses, kpis };
}


function debugFinances(message, data) {
    console.log("💰 [FINANCES] " + message, data || "");
}

function loadFinancesData() {
    debugFinances("=== INICIANDO CARGA DE DATOS FINANCIEROS ===");
    
    if (!window.currentUser) {
        debugFinances("❌ No hay usuario autenticado");
        showFinancesMessage("Debe iniciar sesión para ver las finanzas", "error");
        return;
    }
    debugFinances("✅ Usuario autenticado: " + window.currentUser.email);

    if (typeof firebase === 'undefined' || !firebase.firestore) {
        debugFinances("❌ Firebase no está disponible");
        showFinancesMessage("Error: Firebase no disponible", "error");
        return;
    }
    debugFinances("✅ Firebase disponible");

    showFinancesLoading();
    
    var dateRange = getDateRange();
    debugFinances("📅 Rango de fechas:", dateRange);

    Promise.all([
        loadLoadsForFinances(dateRange),
        loadExpensesForFinances(dateRange)
    ]).then(function(results) {
        console.log("📦 Resultados del Promise.all:", results);

        var loads = results[0];
        var expenses = results[1];
        
        debugFinances("✅ Datos cargados exitosamente:");
        debugFinances("  - Cargas: " + loads.length);
        debugFinances("  - Gastos: " + expenses.length);
        
        financesData = loads;
        expensesData = expenses;
        window.financesData = loads;
        window.expensesData = expenses;
        populateYearSelect();  // 🆕 Esto poblará el selector de año

       console.log("✅ Entró al THEN después de cargar datos financieros");

        try {
            console.log("🔁 Ejecutando updateFinancialKPIs desde loadFinancesData()");
updateFinancialKPIs();

            updateFinancialKPIs();
            updateExpenseCategories();
            renderExpensesList();
            updateBusinessMetrics();
            
            setTimeout(function() {
                updateFinancialCharts();
            }, 500);
            
            financesLoaded = true;
            
            var now = new Date();
            var formatted = now.toLocaleString();
            var updatedEl = document.getElementById("lastUpdated");
            if (updatedEl) {
                updatedEl.textContent = "Actualizado: " + formatted;
            }

            hideFinancesLoading();
            debugFinances("✅ Componentes actualizados exitosamente");
            
        } catch (error) {
            debugFinances("❌ Error actualizando componentes:", error);
            showFinancesMessage("Error actualizando componentes: " + error.message, "error");
        }
        
    }).catch(function(error) {
        console.error("❌ ERROR en Promise.all de loadFinancesData:", error);
        debugFinances("❌ Error cargando datos:", error);
        hideFinancesLoading();
        showFinancesMessage("Error cargando datos financieros: " + error.message, "error");
    });
}

function loadLoadsForFinances(dateRange) {
    return new Promise(function(resolve, reject) {
        debugFinances("📦 Cargando cargas desde Firestore...");
        
        firebase.firestore()
            .collection("loads")
            .where("userId", "==", window.currentUser.uid)
            .get()
            .then(function(snapshot) {
                debugFinances("📦 Firestore devolvió " + snapshot.docs.length + " cargas");
                
                var loads = snapshot.docs.map(function(doc) {
                    var data = doc.data();
                    
                    var loadDate = data.date;
                    if (!loadDate && data.createdAt) {
                        try {
                            loadDate = data.createdAt.toDate().toISOString().split('T')[0];
                        } catch (e) {
                            loadDate = new Date().toISOString().split('T')[0];
                        }
                    } else if (!loadDate) {
                        loadDate = new Date().toISOString().split('T')[0];
                    }
                    
                    var totalMiles = Number(data.totalMiles || data.miles || 0);
                    var rpm = Number(data.rpm || 0);
                    var baseIncome = rpm * totalMiles;
                    var tolls = Number(data.tolls || 0);
                    var otherCosts = Number(data.otherCosts || 0);
                    var totalCharge = data.totalCharge || (baseIncome + tolls + otherCosts);
                    
                    var fuelCost = Number(data.fuelCost || (totalMiles * 0.18));
                    var operatingCost = Number(data.operatingCost || (totalMiles * 0.33));
                    var totalExpenses = fuelCost + operatingCost + tolls + otherCosts;
                    var netProfit = data.netProfit || (totalCharge - totalExpenses);
                    
                    return {
                        id: doc.id,
                        date: loadDate,
                        totalCharge: totalCharge,
                        netProfit: netProfit,
                        totalMiles: totalMiles,
                        fuelCost: fuelCost,
                        operatingCost: operatingCost,
                        tolls: tolls,
                        otherCosts: otherCosts,
                        rpm: rpm,
                        loadedMiles: Number(data.loadedMiles || data.loaded || 0),
                        deadheadMiles: Number(data.deadheadMiles || data.deadhead || 0),
                        origin: data.origin || '',
                        destination: data.destination || ''
                    };
                });
                
                if (dateRange.start && dateRange.end) {
                    debugFinances("📅 Filtrando en memoria: " + dateRange.start + " - " + dateRange.end);
                    loads = loads.filter(function(load) {
                        return load.date >= dateRange.start && load.date <= dateRange.end;
                    });
                    debugFinances("📅 Filtradas " + loads.length + " cargas para el período");
                }
                
                resolve(loads);
            })
            .catch(function(error) {
                debugFinances("❌ Error cargando cargas:", error);
                reject(error);
            });
    });
}

function loadExpensesForFinances(dateRange) {
    return new Promise(function(resolve, reject) {
        debugFinances("💳 Cargando gastos desde Firestore...");
        
        firebase.firestore()
            .collection("expenses")
            .where("userId", "==", window.currentUser.uid)
            .get()
            .then(function(snapshot) {
                debugFinances("💳 Firestore devolvió " + snapshot.docs.length + " gastos");
                
                var expenses = snapshot.docs.map(function(doc) {
                    var data = doc.data();
                    return {
                        id: doc.id,
                        date: data.date,
                        type: data.type,
                        description: data.description,
                        amount: Number(data.amount || 0),
                        deductible: data.deductible
                    };
                });
                
                if (dateRange.start && dateRange.end) {
                    expenses = expenses.filter(function(expense) {
                        return expense.date >= dateRange.start && expense.date <= dateRange.end;
                    });
                }
                
                resolve(expenses);
            })
            .catch(function(error) {
                debugFinances("❌ Error cargando gastos:", error);
                reject(error);
            });
    });
}



function updateExpenseCategories() {
    debugFinances("💳 Actualizando categorías de gastos...");
    
    var categories = {
        fuel: 0,
        maintenance: 0,
        food: 0,
        other: 0
    };
    
    financesData.forEach(function(load) {
        categories.fuel += load.fuelCost || 0;
        categories.other += (load.tolls || 0) + (load.otherCosts || 0);
    });
    
    expensesData.forEach(function(expense) {
        var amount = expense.amount || 0;
        var type = (expense.type || '').toLowerCase();
        
        switch (type) {
            case 'fuel':
                categories.fuel += amount;
                break;
            case 'maintenance':
                categories.maintenance += amount;
                break;
            case 'food':
            case 'lodging':
                categories.food += amount;
                break;
            case 'tolls':
            case 'insurance':
            case 'permits':
            case 'other':
            default:
                categories.other += amount;
                break;
        }
    });
    
    updateElement('fuelExpenses', formatCurrency(categories.fuel));
    updateElement('maintenanceExpenses', formatCurrency(categories.maintenance));
    updateElement('foodExpenses', formatCurrency(categories.food));
    updateElement('otherExpenses', formatCurrency(categories.other));
    
    debugFinances("✅ Categorías actualizadas:", categories);
}

function renderExpensesList() {
    debugFinances("📋 Renderizando lista de gastos...");
    
    var tbody = document.getElementById('expensesList');
    if (!tbody) {
        debugFinances("❌ Tabla de gastos no encontrada");
        return;
    }
    
    if (expensesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay gastos registrados para este período</td></tr>';
        return;
    }
    
    var sortedExpenses = expensesData.sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    }).slice(0, 10);
    
    var rows = sortedExpenses.map(function(expense) {
        var categoryIcons = {
            fuel: '🚚',
            maintenance: '🔧',
            food: '🍔',
            lodging: '🏨',
            tolls: '🛣️',
            insurance: '🛡️',
            permits: '📋',
            shower: '🚿',
            other: '📦'
        };
        
        return '<tr class="hover:bg-gray-50">' +
            '<td class="p-2 text-sm">' + expense.date + '</td>' +
            '<td class="p-2 text-sm">' + (categoryIcons[expense.type] || '📦') + ' ' + expense.type + '</td>' +
            '<td class="p-2 text-sm">' + (expense.description || '-') + '</td>' +
            '<td class="p-2 text-sm font-semibold">' + formatCurrency(expense.amount) + '</td>' +
            '<td class="p-2 text-sm">' +
                '<button onclick="editExpense(\'' + expense.id + '\')" class="text-blue-600 hover:underline mr-2">Editar</button>' +
                '<button onclick="deleteExpense(\'' + expense.id + '\')" class="text-red-600 hover:underline">Eliminar</button>' +
            '</td>' +
        '</tr>';
    });
    
    tbody.innerHTML = rows.join('');
    debugFinances("✅ Lista de gastos renderizada: " + rows.length + " elementos");
}

function updateFinancialCharts() {
    debugFinances("📈 Actualizando gráficos financieros...");
    
    if (typeof Chart === 'undefined') {
        debugFinances("❌ Chart.js no está disponible");
        return;
    }
    
    try {
        updateCashFlowChart();
        updateExpenseBreakdownChart();
        debugFinances("✅ Gráficos actualizados exitosamente");
    } catch (error) {
        debugFinances("❌ Error actualizando gráficos:", error);
    }
}

function updateCashFlowChart() {
    var canvas = document.getElementById('cashFlowChart');
    if (!canvas) {
        debugFinances("❌ Canvas cashFlowChart no encontrado");
        return;
    }
    
    debugFinances("📈 Creando gráfico de flujo de efectivo...");
    
    if (cashFlowChart && typeof cashFlowChart.destroy === 'function') {
        cashFlowChart.destroy();
    }
    
    var monthlyData = {};
    
    financesData.forEach(function(load) {
        var month = load.date.substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].revenue += load.totalCharge;
        monthlyData[month].expenses += load.fuelCost + load.operatingCost + load.tolls + load.otherCosts;
    });
    
    expensesData.forEach(function(expense) {
        var month = expense.date.substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].expenses += expense.amount;
    });
    
    var labels = Object.keys(monthlyData).sort();
    var revenues = labels.map(function(month) {
        return monthlyData[month].revenue;
    });
    var expenses = labels.map(function(month) {
        return monthlyData[month].expenses;
    });
    var profits = labels.map(function(month) {
        return monthlyData[month].revenue - monthlyData[month].expenses;
    });
    
    if (labels.length === 0) {
        debugFinances("⚠️ No hay datos para el gráfico");
        canvas.parentElement.innerHTML = '<div class="text-center text-gray-500 p-8">No hay datos para mostrar</div>';
        return;
    }
    
    try {
        cashFlowChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: revenues,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.3
                    },
                    {
                        label: 'Gastos',
                        data: expenses,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3
                    },
                    {
                        label: 'Ganancia',
                        data: profits,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
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
        
        debugFinances("✅ Gráfico de flujo de efectivo creado");
        
    } catch (error) {
        debugFinances("❌ Error creando gráfico de flujo de efectivo:", error);
    }
}

function updateExpenseBreakdownChart() {
   var canvas = document.getElementById('expenseChart');
    if (!canvas) {
       debugFinances("❌ Canvas expenseChart no encontrado");
        return;
    }
    
    debugFinances("🥧 Creando gráfico de distribución de gastos...");
    
    // 🔧 Destruir instancia previa
    if (expenseChartInstance && typeof expenseChartInstance.destroy === "function") {
        expenseChartInstance.destroy();
    }

    var categories = {
        'Combustible': 0,
        'Mantenimiento': 0,
        'Comida/Hospedaje': 0,
        'Peajes': 0,
        'Seguros': 0,
        'Otros': 0
    };
    
    financesData.forEach(function(load) {
        categories['Combustible'] += load.fuelCost;
        categories['Peajes'] += load.tolls;
        categories['Otros'] += load.otherCosts;
    });
    
    expensesData.forEach(function(expense) {
        var type = (expense.type || '').toLowerCase();
        switch (type) {
            case 'fuel':
                categories['Combustible'] += expense.amount;
                break;
            case 'maintenance':
                categories['Mantenimiento'] += expense.amount;
                break;
            case 'food':
            case 'lodging':
                categories['Comida/Hospedaje'] += expense.amount;
                break;
            case 'tolls':
                categories['Peajes'] += expense.amount;
                break;
            case 'insurance':
                categories['Seguros'] += expense.amount;
                break;
            default:
                categories['Otros'] += expense.amount;
                break;
        }
    });
    
    var labels = Object.keys(categories);
    var data = Object.values(categories);
    var colors = ['#f97316', '#3b82f6', '#facc15', '#a855f7', '#10b981', '#6b7280'];
    
    var totalExpenses = data.reduce(function(a, b) {
        return a + b;
    }, 0);
    
    if (totalExpenses === 0) {
        debugFinances("⚠️ No hay gastos para el gráfico de distribución");
        canvas.parentElement.innerHTML = '<div class="text-center text-gray-500 p-8">No hay gastos para mostrar</div>';
        return;
    }
    
    try {
        expenseChartInstance = new Chart(canvas, {
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
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                var value = context.parsed;
                                var total = context.dataset.data.reduce(function(a, b) {
                                    return a + b;
                                }, 0);
                                var percentage = ((value / total) * 100).toFixed(1);
                                return context.label + ': ' + formatCurrency(value) + ' (' + percentage + '%)';
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



function updateBusinessMetrics() {
    debugFinances("📊 Actualizando métricas de negocio...");
    
    var totalMiles = financesData.reduce(function(sum, load) {
        return sum + load.totalMiles;
    }, 0);
    
    var totalLoadedMiles = financesData.reduce(function(sum, load) {
        return sum + (load.loadedMiles || 0);
    }, 0);
    
    var totalRevenue = financesData.reduce(function(sum, load) {
        return sum + load.totalCharge;
    }, 0);
    
    var totalExpenses = financesData.reduce(function(sum, load) {
        return sum + load.fuelCost + load.operatingCost + load.tolls + load.otherCosts;
    }, 0) + expensesData.reduce(function(sum, expense) {
        return sum + expense.amount;
    }, 0);
    
    var costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
    var averageRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    var efficiency = totalMiles > 0 ? (totalLoadedMiles / totalMiles) * 100 : 0;
    
    var updates = [
        ['costPerMile', '$' + costPerMile.toFixed(2)],
        ['averageRPM', '$' + averageRPM.toFixed(2)],
        ['efficiency', efficiency.toFixed(1) + '%']
    ];
    
    updates.forEach(function(update) {
        var id = update[0];
        var value = update[1];
        var element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            debugFinances("✅ Métrica actualizada " + id + ": " + value);
        }
    });
}

function getDateRange() {
    return { start: null, end: null };
}

function formatCurrency(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}


function showFinancesMessage(message, type) {
    debugFinances("Mensaje: " + message + " (" + (type || "info") + ")");
    if (typeof showMessage === 'function') {
        showMessage(message, type);
    } else {
        console.log("Finances " + (type || "info") + ": " + message);
    }
}

function showFinancesLoading() {
    debugFinances("🔄 Mostrando estado de carga...");
    var elements = ['totalRevenue', 'totalExpensesSummary', 'netProfit', 'profitMarginPercent'];
    elements.forEach(function(id) {
        var element = document.getElementById(id);
        if (element) element.textContent = '...';
    });
}

function hideFinancesLoading() {
    debugFinances("✅ Finalizando estado de carga");
}

function openExpenseModal() {
    debugFinances("📝 Abriendo modal de gastos...");
    var modal = document.getElementById('expenseModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    }
}

function closeExpenseModal() {
    debugFinances("❌ Cerrando modal de gastos...");
    var modal = document.getElementById('expenseModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.dataset.editId = "";
    }
}

function saveExpenseToFirebase() {
    var amount = parseFloat(document.getElementById("expenseAmount").value.trim());
    var type = document.getElementById("expenseType").value.trim().toLowerCase();
    var description = document.getElementById("expenseDescription").value.trim();
    var date = document.getElementById("expenseDate").value;

    if (!window.currentUser) {
        showFinancesMessage("Debe iniciar sesión", "error");
        return;
    }

    if (!amount || amount <= 0 || !type || !date) {
        showFinancesMessage("Todos los campos son obligatorios", "error");
        return;
    }

    var expense = {
        userId: window.currentUser.uid,
        amount: amount,
        type: type,
        description: description,
        date: date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var modal = document.getElementById("expenseModal");
    var editId = modal ? modal.dataset.editId : "";

    if (editId) {
        firebase.firestore().collection("expenses").doc(editId).update(expense)
            .then(function() {
                debugFinances("✏️ Gasto actualizado:", expense);
                showFinancesMessage("✏️ Gasto editado correctamente", "success");
                closeExpenseModal();
                loadFinancesData();
            })
            .catch(function(error) {
                debugFinances("❌ Error al actualizar gasto:", error);
                showFinancesMessage("❌ No se pudo actualizar el gasto", "error");
            });
    } else {
        firebase.firestore().collection("expenses").add(expense)
            .then(function() {
                debugFinances("✅ Gasto guardado:", expense);
                showFinancesMessage("✅ Gasto agregado correctamente", "success");
                closeExpenseModal();
                loadFinancesData();
            })
            .catch(function(error) {
                debugFinances("❌ Error al guardar gasto:", error);
                showFinancesMessage("❌ No se pudo guardar el gasto", "error");
            });
    }
}

function deleteExpense(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto?")) return;

    firebase.firestore().collection("expenses").doc(id).delete()
        .then(function() {
            showFinancesMessage("✅ Gasto eliminado", "success");
            loadFinancesData();
        })
        .catch(function(error) {
            debugFinances("❌ Error al eliminar gasto:", error);
            showFinancesMessage("Error al eliminar gasto", "error");
        });
}

function editExpense(id) {
    firebase.firestore().collection("expenses").doc(id).get()
        .then(function(doc) {
            if (!doc.exists) {
                showFinancesMessage("Gasto no encontrado", "error");
                return;
            }

            var exp = doc.data();
            exp.id = id;

            document.getElementById("expenseDate").value = exp.date;
            document.getElementById("expenseType").value = exp.type;
            document.getElementById("expenseAmount").value = exp.amount;
            document.getElementById("expenseDescription").value = exp.description || "";
            document.getElementById("expenseDeductible").checked = !!exp.deductible;

            document.getElementById("expenseModal").dataset.editId = id;
            openExpenseModal();
        })
        .catch(function(err) {
            debugFinances("❌ Error al editar gasto:", err);
            showFinancesMessage("No se pudo cargar el gasto", "error");
        });
}

function generatePLReport() {
    debugFinances("📊 Generando Estado de Resultados...");
    
    if (!financesData || !expensesData) {
        alert("No hay datos suficientes para generar el reporte");
        return;
    }
    
    var totalRevenue = financesData.reduce(function(sum, load) {
        return sum + (load.totalCharge || 0);
    }, 0);
    
    var totalExpenses = financesData.reduce(function(sum, load) {
        return sum + (load.fuelCost || 0) + (load.operatingCost || 0) + (load.tolls || 0) + (load.otherCosts || 0);
    }, 0) + expensesData.reduce(function(sum, exp) {
        return sum + (exp.amount || 0);
    }, 0);
    
    var netProfit = totalRevenue - totalExpenses;
    var margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    var reportWindow = window.open('', '_blank', 'width=800,height=600');
    var currentDate = new Date().toLocaleDateString();
    var totalMiles = financesData.reduce(function(sum, load) {
        return sum + load.totalMiles;
    }, 0);
    
    reportWindow.document.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
            '<title>Estado de Resultados</title>' +
            '<style>' +
                'body{font-family:Arial,sans-serif;margin:20px}' +
                '.header{text-align:center;margin-bottom:30px}' +
                '.table{width:100%;border-collapse:collapse}' +
                '.table th,.table td{padding:10px;text-align:left;border-bottom:1px solid #ddd}' +
                '.table th{background-color:#f5f5f5}' +
                '.total{font-weight:bold;background-color:#f0f0f0}' +
                '.positive{color:green}' +
                '.negative{color:red}' +
            '</style>' +
        '</head>' +
        '<body>' +
            '<div class="header">' +
                '<h1>ESTADO DE RESULTADOS</h1>' +
                '<p>Negocio Expediter</p>' +
                '<p>Fecha: ' + currentDate + '</p>' +
            '</div>' +
            '<table class="table">' +
                '<tr><th colspan="2">INGRESOS</th></tr>' +
                '<tr><td>Ingresos por Cargas</td><td>$' + totalRevenue.toFixed(2) + '</td></tr>' +
                '<tr class="total"><td>TOTAL INGRESOS</td><td>$' + totalRevenue.toFixed(2) + '</td></tr>' +
                '<tr><th colspan="2">GASTOS</th></tr>' +
                '<tr><td>Total Gastos</td><td>$' + totalExpenses.toFixed(2) + '</td></tr>' +
                '<tr class="total"><td>TOTAL GASTOS</td><td>$' + totalExpenses.toFixed(2) + '</td></tr>' +
                '<tr class="total"><td>UTILIDAD NETA</td><td class="' + (netProfit >= 0 ? 'positive' : 'negative') + '">$' + netProfit.toFixed(2) + '</td></tr>' +
                '<tr><td>Margen</td><td>' + margin.toFixed(1) + '%</td></tr>' +
            '</table>' +
            '<div style="margin-top:30px">' +
                '<h3>RESUMEN OPERATIVO</h3>' +
                '<table class="table">' +
                    '<tr><td>Total de Cargas</td><td>' + financesData.length + '</td></tr>' +
                    '<tr><td>Total de Millas</td><td>' + totalMiles.toLocaleString() + '</td></tr>' +
                    '<tr><td>RPM Promedio</td><td>$' + (totalMiles > 0 ? (totalRevenue / totalMiles).toFixed(2) : '0.00') + '</td></tr>' +
                    '<tr><td>Costo por Milla</td><td>$' + (totalMiles > 0 ? (totalExpenses / totalMiles).toFixed(2) : '0.00') + '</td></tr>' +
                '</table>' +
            '</div>' +
            '<div style="text-align:center;margin:40px 0">' +
                '<button onclick="window.print()" style="background-color:#007bff;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer">' +
                    'Imprimir' +
                '</button>' +
            '</div>' +
        '</body>' +
        '</html>'
    );
    
    reportWindow.document.close();
    debugFinances("✅ Estado de Resultados generado");
}

function generateTaxReport() {
    debugFinances("🧾 Generando Reporte de Impuestos...");
    
    if (!financesData || !expensesData) {
        alert("No hay datos suficientes para generar el reporte");
        return;
    }
    
    var deductibleExpenses = expensesData.filter(function(exp) {
        return exp.deductible !== false;
    });
    
    var totalDeductible = deductibleExpenses.reduce(function(sum, exp) {
        return sum + (exp.amount || 0);
    }, 0);
    
    var totalRevenue = financesData.reduce(function(sum, load) {
        return sum + (load.totalCharge || 0);
    }, 0);
    
    var totalMiles = financesData.reduce(function(sum, load) {
        return sum + (load.totalMiles || 0);
    }, 0);
    
    var fuelDeductions = financesData.reduce(function(sum, load) {
        return sum + (load.fuelCost || 0);
    }, 0) + deductibleExpenses.filter(function(e) {
        return e.type === 'fuel';
    }).reduce(function(sum, e) {
        return sum + e.amount;
    }, 0);
    
    var maintenanceDeductions = deductibleExpenses.filter(function(e) {
        return e.type === 'maintenance';
    }).reduce(function(sum, e) {
        return sum + e.amount;
    }, 0);
    
    var reportWindow = window.open('', '_blank', 'width=800,height=700');
    var currentDate = new Date().toLocaleDateString();
    
    reportWindow.document.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
            '<title>Reporte Fiscal</title>' +
            '<style>' +
                'body{font-family:Arial,sans-serif;margin:20px}' +
                '.header{text-align:center;margin-bottom:30px}' +
                '.table{width:100%;border-collapse:collapse;margin-bottom:20px}' +
                '.table th,.table td{padding:8px;text-align:left;border-bottom:1px solid #ddd}' +
                '.table th{background-color:#f5f5f5}' +
                '.total{font-weight:bold;background-color:#f0f0f0}' +
                '.note{font-size:12px;color:#666;font-style:italic}' +
            '</style>' +
        '</head>' +
        '<body>' +
            '<div class="header">' +
                '<h1>REPORTE FISCAL</h1>' +
                '<p>Negocio Expediter</p>' +
                '<p>Fecha: ' + currentDate + '</p>' +
            '</div>' +
            '<h2>RESUMEN DE INGRESOS</h2>' +
            '<table class="table">' +
                '<tr><td>Ingresos Brutos</td><td>$' + totalRevenue.toFixed(2) + '</td></tr>' +
                '<tr><td>Total Millas</td><td>' + totalMiles.toLocaleString() + '</td></tr>' +
                '<tr><td>RPM Promedio</td><td>$' + (totalMiles > 0 ? (totalRevenue / totalMiles).toFixed(2) : '0.00') + '</td></tr>' +
                '<tr><td>Total de Cargas</td><td>' + financesData.length + '</td></tr>' +
            '</table>' +
            '<h2>GASTOS DEDUCIBLES</h2>' +
            '<table class="table">' +
                '<tr><td>Combustible</td><td>$' + fuelDeductions.toFixed(2) + '</td></tr>' +
                '<tr><td>Mantenimiento</td><td>$' + maintenanceDeductions.toFixed(2) + '</td></tr>' +
                '<tr><td>Otros Gastos Deducibles</td><td>$' + (totalDeductible - fuelDeductions - maintenanceDeductions).toFixed(2) + '</td></tr>' +
                '<tr class="total"><td>TOTAL DEDUCCIONES</td><td>$' + totalDeductible.toFixed(2) + '</td></tr>' +
            '</table>' +
            '<h2>RESUMEN FISCAL</h2>' +
            '<table class="table">' +
                '<tr><td>Ingresos Netos (después de deducciones)</td><td>$' + (totalRevenue - totalDeductible).toFixed(2) + '</td></tr>' +
                '<tr><td>Porcentaje de Deducciones</td><td>' + (totalRevenue > 0 ? ((totalDeductible / totalRevenue) * 100).toFixed(1) : '0') + '%</td></tr>' +
            '</table>' +
            '<div class="note">' +
                '<p><strong>Nota:</strong> Este reporte es solo para referencia. Consulte con un contador profesional.</p>' +
            '</div>' +
            '<div style="text-align:center;margin:40px 0">' +
                '<button onclick="window.print()" style="background-color:#007bff;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer">' +
                    'Imprimir' +
                '</button>' +
            '</div>' +
        '</body>' +
        '</html>'
    );
    
    reportWindow.document.close();
    debugFinances("✅ Reporte fiscal generado");
}

function exportFinancialData() {
    debugFinances("📤 Exportando datos financieros...");
    
    if (!financesData || !expensesData) {
        alert("No hay datos suficientes para exportar");
        return;
    }
    
    var csvData = [];
    
    csvData.push([
        'Fecha', 'Origen', 'Destino', 'Millas', 'RPM', 'Ingresos', 
        'Costo Combustible', 'Costo Operativo', 'Peajes', 'Otros', 'Ganancia'
    ]);
    
    financesData.forEach(function(load) {
        csvData.push([
            load.date || '',
            (load.origin || '').replace(/,/g, ' '),
            (load.destination || '').replace(/,/g, ' '),
            load.totalMiles || 0,
            load.rpm || 0,
            load.totalCharge || 0,
            load.fuelCost || 0,
            load.operatingCost || 0,
            load.tolls || 0,
            load.otherCosts || 0,
            load.netProfit || 0
        ]);
    });
    
    csvData.push(['']);
    csvData.push(['=== GASTOS ADICIONALES ===']);
    csvData.push(['Fecha', 'Categoria', 'Descripcion', 'Monto']);
    
    expensesData.forEach(function(expense) {
        csvData.push([
            expense.date || '',
            expense.type || '',
            (expense.description || '').replace(/,/g, ' '),
            expense.amount || 0
        ]);
    });
    
    var totalRevenue = financesData.reduce(function(sum, load) {
        return sum + (load.totalCharge || 0);
    }, 0);
    
    var totalExpenses = financesData.reduce(function(sum, load) {
        return sum + (load.fuelCost || 0) + (load.operatingCost || 0) + (load.tolls || 0) + (load.otherCosts || 0);
    }, 0) + expensesData.reduce(function(sum, exp) {
        return sum + (exp.amount || 0);
    }, 0);
    
    csvData.push(['']);
    csvData.push(['=== RESUMEN ===']);
    csvData.push(['Total Ingresos', totalRevenue.toFixed(2)]);
    csvData.push(['Total Gastos', totalExpenses.toFixed(2)]);
    csvData.push(['Ganancia Neta', (totalRevenue - totalExpenses).toFixed(2)]);
    csvData.push(['Total Cargas', financesData.length]);
    csvData.push(['Total Gastos Adicionales', expensesData.length]);
    
    var csvContent = csvData.map(function(row) {
        return row.map(function(cell) {
            var cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        }).join(',');
    }).join('\n');
    
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'finanzas-expediter-' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    debugFinances("✅ Datos exportados exitosamente");
}

document.addEventListener("DOMContentLoaded", function() {
    debugFinances("📋 DOM cargado - Configurando event listeners");
});

document.addEventListener('loadSaved', function() {
    debugFinances("🔄 Load saved, refreshing finances");
    if (financesLoaded) {
        setTimeout(function() {
            loadFinancesData();
        }, 500);
    }
});
// ✅ FUNCIÓN DE DEBUG PARA VERIFICAR ELEMENTOS DOM
function debugFinancesElements() {
    debugFinances("🔍 === DEBUG DE ELEMENTOS DOM FINANCIEROS ===");
    
    var criticalElements = [
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
    
    var found = 0;
    var missing = [];
    
    criticalElements.forEach(function(id) {
        var element = document.getElementById(id);
        if (element) {
            found++;
            debugFinances("✅ " + id + ": Encontrado (" + element.tagName + ")");
            
            // Información adicional para elementos críticos
            if (['totalRevenue', 'totalExpensesSummary', 'netProfit', 'profitMarginPercent'].includes(id)) {
                debugFinances("    - Contenido actual: '" + element.textContent + "'");
                debugFinances("    - Classes: " + element.className);
            }
        } else {
            missing.push(id);
            debugFinances("❌ " + id + ": NO ENCONTRADO");
        }
    });
    
    debugFinances("📊 Resumen:");
    debugFinances("  - Elementos encontrados: " + found + "/" + criticalElements.length);
    debugFinances("  - Elementos faltantes: " + missing.join(', '));
    
    // ✅ VERIFICAR TAMBIÉN ELEMENTOS CON QUERY SELECTOR
    debugFinances("🔍 Verificación adicional con querySelector:");
    var additionalSelectors = [
        '[id*="profit"]',
        '[id*="ganancia"]', 
        '[class*="profit"]',
        '[class*="ganancia"]'
    ];
    
    additionalSelectors.forEach(function(selector) {
        var elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            debugFinances("🎯 Selector '" + selector + "' encontró " + elements.length + " elementos:");
            elements.forEach(function(el, index) {
                debugFinances("    " + (index + 1) + ". ID: '" + (el.id || 'sin-id') + "' - Texto: '" + el.textContent + "'");
            });
        }
    });
    
    debugFinances("===========================================");
}

function updateFinancialKPIs() {
    console.log("✅ Entró a updateFinancialKPIs CORREGIDA");
    
    const totalRevenue = financesData.reduce((sum, load) => sum + (load.totalCharge || 0), 0);
    const totalExpenses = financesData.reduce((sum, load) =>
        sum + (load.fuelCost || 0) + (load.operatingCost || 0) + (load.tolls || 0) + (load.otherCosts || 0), 0
    ) + expensesData.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // ✅ FUNCIÓN HELPER PARA FINANCES - SOLUCION AL PROBLEMA DE ELEMENTOS DUPLICADOS
    const updateElementInFinances = (id, value) => {
        const element = document.querySelector(`#finances #${id}`);
        if (element) {
            element.textContent = value;
            return true;
        }
        return false;
    };

    // Función para formatear moneda
    const formatCurrency = (amount) => {
        if (isNaN(amount) || amount === null || amount === undefined) {
            return '$0.00';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // ✅ ACTUALIZAR TODOS LOS ELEMENTOS EN FINANCES ESPECÍFICAMENTE
    updateElementInFinances('totalRevenue', formatCurrency(totalRevenue));
    updateElementInFinances('totalExpensesSummary', formatCurrency(totalExpenses));
    updateElementInFinances('profitMarginPercent', `${margin.toFixed(1)}%`);

    // ✅ GANANCIA NETA CON ESTILOS ESPECÍFICOS PARA FINANCES
    const netProfitEl = document.querySelector('#finances #netProfit');
    if (netProfitEl) {
        netProfitEl.textContent = formatCurrency(netProfit);
        netProfitEl.style.fontWeight = 'bold';
        netProfitEl.style.fontSize = '1.8rem';
        netProfitEl.style.textAlign = 'center';

        if (netProfit > 0) {
            netProfitEl.style.color = 'green';
        } else if (netProfit < 0) {
            netProfitEl.style.color = 'red';
        } else {
            netProfitEl.style.color = '#6b7280';
        }
    }
}
function populateYearSelect() {
    console.log("📅 Poblando selector de años...");

    if (!window.financesData || window.financesData.length === 0) {
        console.log("⚠️ No hay datos financieros para extraer años");
        return;
    }

    const years = [...new Set(window.financesData.map(load => {
        const date = load.date || '';
        return date.slice(0, 4); // solo el año
    }).filter(year => year && year !== ''))].sort().reverse();

    const yearSelect = document.getElementById("yearSelect");
    if (!yearSelect) return;

    // Limpiar y agregar opción "Todos"
    yearSelect.innerHTML = '<option value="">📊 Todos los Años</option>';

    // Agregar años encontrados
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `🗓️ ${year}`;
        yearSelect.appendChild(option);
    });

    console.log(`✅ Años disponibles: ${years.join(', ')}`);

    // Auto-seleccionar el año más reciente si hay datos
    if (years.length > 0) {
        yearSelect.value = years[0];
        updateMonthOptions(); // también llama al otro filtro
    }
}

function updateMonthOptions() {
    console.log("📅 Actualizando meses...");

    const year = document.getElementById("yearSelect")?.value;
    const monthSelect = document.getElementById("monthSelect");

    if (!monthSelect) {
        console.warn("❌ No se encontró el selector de mes");
        return;
    }

    // Limpiar y agregar opción inicial
    monthSelect.innerHTML = '<option value="">📊 Todos los Meses</option>';

    if (!year || !window.financesData) {
        console.warn("⚠️ No hay año seleccionado o datos disponibles");
        return;
    }

    const months = [...new Set(window.financesData
        .filter(load => load.date && load.date.startsWith(year))
        .map(load => load.date.slice(5, 7))
    )].sort();

    const monthNames = {
        '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
        '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
        '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
    };

    // Agregar opciones al selector
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = `📅 ${monthNames[month] || month}`;
        monthSelect.appendChild(option);
    });

    console.log(`✅ Meses para ${year}: ${months.join(', ')}`);

   if (months.length > 0) {
    const latestMonth = months[months.length - 1];
    monthSelect.value = latestMonth;
    
    // Forzar visualmente como seleccionada
    const selectedOption = [...monthSelect.options].find(opt => opt.value === latestMonth);
    if (selectedOption) selectedOption.selected = true;

    console.log(`📌 Seleccionando mes más reciente: ${latestMonth}`);
    filterByYearMonth();
}
}

// ✅ REEMPLAZO COMPLETO PARA PASO 3
// En finances.js busca la función filterByYearMonth() y reemplázala con esto:

function filterByYearMonth() {
    console.log("🔄 [FIXED v3] === INICIO filterByYearMonth CORREGIDO ===");

    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    
    if (!yearSelect || !monthSelect) {
        console.error("❌ [FIXED] Selectores no encontrados");
        return;
    }

    const year = yearSelect.value;
    const month = monthSelect.value;

    console.log("📅 [FIXED v3] Filtros seleccionados:", { year, month });

    let periodText = "Todos los datos";
    let selectedPeriod = "";

    if (year && month) {
        const monthNames = {
            '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
            '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
            '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
        };
        periodText = `${monthNames[month]} ${year}`;
        selectedPeriod = `${year}-${month}`;
    } else if (year) {
        periodText = `Año ${year}`;
        selectedPeriod = year;
    }

    // Actualizar información del período
    const periodInfo = document.getElementById("periodInfo");
    const periodSummary = document.getElementById("periodSummary");

    if (periodInfo) {
        periodInfo.textContent = `Analizando: ${periodText}`;
        console.log("📊 [FIXED v3] Período actualizado:", periodText);
    }
    
    if (periodSummary) {
        periodSummary.classList.remove('hidden');
    }

    // ✅ FILTRAR DATOS CORRECTAMENTE
    let filteredLoads = window.financesData || [];
    let filteredExpenses = window.expensesData || [];

    if (selectedPeriod) {
        filteredLoads = filteredLoads.filter(load => {
            const loadDate = load.date || '';
            return loadDate.startsWith(selectedPeriod);
        });
        
        filteredExpenses = filteredExpenses.filter(exp => {
            const expDate = exp.date || '';
            return expDate.startsWith(selectedPeriod);
        });
    }

    console.log("📊 [FIXED v3] Datos filtrados:", {
        loads: filteredLoads.length,
        expenses: filteredExpenses.length,
        period: selectedPeriod
    });

    // ✅ CALCULAR TOTALES DEL PERÍODO FILTRADO
    const totalRevenue = filteredLoads.reduce((sum, load) => sum + (Number(load.totalCharge) || 0), 0);
    const totalExpensesFromLoads = filteredLoads.reduce((sum, load) => 
        sum + (Number(load.fuelCost) || 0) + (Number(load.operatingCost) || 0) + 
              (Number(load.tolls) || 0) + (Number(load.otherCosts) || 0), 0);
    const totalExpensesFromExpenses = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const totalExpenses = totalExpensesFromLoads + totalExpensesFromExpenses;
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    console.log("💰 [FIXED v3] Totales calculados:", {
        revenue: totalRevenue.toFixed(2),
        expenses: totalExpenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        margin: margin.toFixed(1) + '%'
    });

    // ✅ FUNCIÓN PARA FORMATEAR MONEDA
    function formatCurrency(amount) {
        if (isNaN(amount) || amount === null || amount === undefined) {
            return '$0.00';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    // ✅ BUSCAR EL ELEMENTO NETPROFIT CORRECTO (EL VISIBLE)
    const todosNetProfit = document.querySelectorAll('[id="netProfit"]');
    let netProfitEl = null;
    
    todosNetProfit.forEach(el => {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            netProfitEl = el;
            console.log('✅ [FIXED v3] Encontrado netProfit VISIBLE:', el);
        }
    });

    if (netProfitEl) {
        netProfitEl.textContent = formatCurrency(netProfit);
        netProfitEl.style.fontSize = '2rem';
        netProfitEl.style.fontWeight = 'bold';
        netProfitEl.style.textAlign = 'center';
        
        if (netProfit >= 0) {
            netProfitEl.style.color = '#16a34a';
        } else {
            netProfitEl.style.color = '#dc2626';
        }
        
        console.log(`✅ [FIXED v3] Net Profit VISIBLE actualizado: ${formatCurrency(netProfit)}`);
    } else {
        console.log('❌ [FIXED v3] No se encontró netProfit visible');
    }

    // ✅ ACTUALIZAR OTROS ELEMENTOS CON TAMAÑOS UNIFORMES
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
            console.log(`✅ [FIXED v3] ${item.id}: ${item.value}`);
        }
    });

    // ✅ ACTUALIZAR CATEGORÍAS DE GASTOS (solo manuales)
const categories = { fuel: 0, maintenance: 0, food: 0, other: 0 };

// ❌ Ya no sumamos fuelCost automático de las cargas
filteredLoads.forEach(load => {
    categories.other += (Number(load.tolls) || 0) + (Number(load.otherCosts) || 0);
});

filteredExpenses.forEach(expense => {
    const amount = Number(expense.amount) || 0;
    const type = (expense.type || '').toLowerCase();
    
    switch (type) {
        case 'fuel': categories.fuel += amount; break;
        case 'maintenance': categories.maintenance += amount; break;
        case 'food':
        case 'lodging': categories.food += amount; break;
        default: categories.other += amount; break;
    }
});


    // Actualizar elementos de categorías
    const updateElementInFinances = (id, value) => {
        const element = document.querySelector(`#finances #${id}`);
        if (element) {
            element.textContent = value;
            return true;
        }
        return false;
    };

    updateElementInFinances('fuelExpenses', formatCurrency(categories.fuel));
    updateElementInFinances('maintenanceExpenses', formatCurrency(categories.maintenance));
    updateElementInFinances('foodExpenses', formatCurrency(categories.food));
    updateElementInFinances('otherExpenses', formatCurrency(categories.other));

    console.log("✅ [FIXED v3] Categorías actualizadas:", categories);

    // ✅ ACTUALIZAR LISTA DE GASTOS
    const expensesList = document.getElementById('expensesList');
    if (expensesList) {
        if (filteredExpenses.length === 0) {
            expensesList.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay gastos registrados para este período</td></tr>';
        } else {
            const sortedExpenses = filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
            const categoryIcons = {
                fuel: '🚚', maintenance: '🔧', food: '🍔', lodging: '🏨',
                tolls: '🛣️', insurance: '🛡️', permits: '📋', other: '📦'
            };
            
            const rows = sortedExpenses.map(expense => `
                <tr class="hover:bg-gray-50">
                    <td class="p-2 text-sm">${expense.date}</td>
                    <td class="p-2 text-sm">${categoryIcons[expense.type] || '📦'} ${expense.type}</td>
                    <td class="p-2 text-sm">${expense.description || '-'}</td>
                    <td class="p-2 text-sm font-semibold">${formatCurrency(expense.amount)}</td>
                    <td class="p-2 text-sm">
                        <button onclick="editExpense('${expense.id}')" class="text-blue-600 hover:underline mr-2">Editar</button>
                        <button onclick="deleteExpense('${expense.id}')" class="text-red-600 hover:underline">Eliminar</button>
                    </td>
                </tr>
            `);
            
            expensesList.innerHTML = rows.join('');
        }
        console.log("✅ [FIXED v3] Lista de gastos actualizada");
    }

    // ✅ ACTUALIZAR MÉTRICAS DE NEGOCIO
    const totalMiles = filteredLoads.reduce((sum, load) => sum + (Number(load.totalMiles) || 0), 0);
    const totalLoadedMiles = filteredLoads.reduce((sum, load) => sum + (Number(load.loadedMiles) || 0), 0);
    const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
    const averageRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const efficiency = totalMiles > 0 ? (totalLoadedMiles / totalMiles) * 100 : 0;

    updateElementInFinances('costPerMile', '$' + costPerMile.toFixed(2));
    updateElementInFinances('averageRPM', '$' + averageRPM.toFixed(2));
    updateElementInFinances('efficiency', efficiency.toFixed(1) + '%');

    console.log("🔄 [FIXED v3] === FIN filterByYearMonth CORREGIDO ===");
}


document.addEventListener("DOMContentLoaded", () => {
  const monthSelect = document.getElementById("dashboardMonthSelect");
  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => {
      const selected = e.target.value || "all";
      console.log("📊 Dashboard selector changed:", selected);
      updateDashboard(selected);
    });
  }

  // 🔹 Inicializar el Dashboard por defecto
  updateDashboard("all");
});


// ✅ EXPONER LA FUNCIÓN DE DEBUG GLOBALMENTE
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

debugFinances("✅ Finances.js CORREGIDO cargado completamente");