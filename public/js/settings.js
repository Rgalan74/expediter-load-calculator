// settings.js - Versión limpia con costos reales integrados

function loadSettings() {
    console.log("⚙️ Loading settings...");
    
    if (!window.currentUser) {
        console.log("❌ No user logged in");
        return;
    }

    // Cargar configuraciones desde Firebase
    firebase.firestore()
        .collection("users")
        .doc(window.currentUser.uid)
        .get()
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                
                // ✅ CAMPOS EXISTENTES
                if (document.getElementById('operatingCostSetting')) {
                    document.getElementById('operatingCostSetting').value = userData.operatingCostPerMile || 0.33;
                }
                if (document.getElementById('fuelCostSetting')) {
                    document.getElementById('fuelCostSetting').value = userData.fuelCostPerMile || 0.18;
                }
                if (document.getElementById('companyNameSetting')) {
                    document.getElementById('companyNameSetting').value = userData.company || '';
                }
                if (document.getElementById('phoneSetting')) {
                    document.getElementById('phoneSetting').value = userData.phone || '';
                }
                if (document.getElementById('emailNotifications')) {
                    document.getElementById('emailNotifications').checked = userData.emailNotifications !== false;
                }
                if (document.getElementById('autoSave')) {
                    document.getElementById('autoSave').checked = userData.autoSave !== false;
                }
                
                // ✅ NUEVOS CAMPOS DE COSTOS REALES
                if (document.getElementById('useRealCosts')) {
                    document.getElementById('useRealCosts').checked = userData.useRealCosts !== false;
                }
                if (document.getElementById('realCostsPeriod')) {
                    document.getElementById('realCostsPeriod').value = userData.realCostsPeriod || '3';
                }
                
                console.log("✅ Settings loaded successfully");
                
                // ✅ CARGAR COSTOS REALES ACTUALES
                setTimeout(() => {
                    displayCurrentRealCosts();
                }, 500);
                
            } else {
                // Si no existe el documento, crear configuración por defecto
                console.log("📝 Creating default settings");
                const defaultSettings = {
                    operatingCostPerMile: 0.33,
                    fuelCostPerMile: 0.18,
                    useRealCosts: true, // ✅ Activar costos reales por defecto
                    realCostsPeriod: '3',
                    emailNotifications: true,
                    autoSave: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                firebase.firestore()
                    .collection("users")
                    .doc(window.currentUser.uid)
                    .set(defaultSettings)
                    .then(() => {
                        console.log("✅ Default settings created");
                        loadSettings(); // Recargar para mostrar valores por defecto
                    });
            }
        })
        .catch(error => {
            console.error("❌ Error loading settings:", error);
        });
}

function saveUserSettings() {
    console.log("💾 Saving settings...");
    
    if (!window.currentUser) {
        showSettingsMessage("Must be logged in to save settings", "error");
        return;
    }

    // ✅ Obtener valores de inputs
    const monthlyMiles = parseFloat(document.getElementById('monthlyMilesSetting')?.value || 6000);

    // Gastos fijos de ejemplo (puedes luego jalarlos desde DB si quieres)
    const fixedCosts = 2600; // Seguro + Van + otros

    // ✅ Recalcular costo operativo con volumen de millas
const operatingCostCalc = fixedCosts / monthlyMiles;
document.getElementById('operatingCostSetting').value = operatingCostCalc.toFixed(2);

const settings = {
    operatingCostPerMile: parseFloat(document.getElementById('operatingCostSetting')?.value || 0.33),
    fuelCostPerMile: parseFloat(document.getElementById('fuelCostSetting')?.value || 0.18),
    monthlyMiles: monthlyMiles,
    company: document.getElementById('companyNameSetting')?.value || '',
    phone: document.getElementById('phoneSetting')?.value || '',
    emailNotifications: document.getElementById('emailNotifications')?.checked || false,
    autoSave: document.getElementById('autoSave')?.checked || false,
    useRealCosts: document.getElementById('useRealCosts')?.checked || false,
    realCostsPeriod: document.getElementById('realCostsPeriod')?.value || '3',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};

// ✅ ACTUALIZAR GLOBAL
window.userSettings = settings;


    firebase.firestore()
        .collection("users")
        .doc(window.currentUser.uid)
        .set(settings, { merge: true })
        .then(() => {
            showSettingsMessage("✅ Settings saved successfully", "success");
            
            // ✅ NOTIFICAR CAMBIO EN COSTOS REALES
            if (typeof window.onRealCostsSettingChanged === 'function') {
                window.onRealCostsSettingChanged(settings.useRealCosts);
            }
            
            // ✅ ACTUALIZAR DISPLAY DE COSTOS REALES
            setTimeout(() => {
                displayCurrentRealCosts();
            }, 500);
        })
        .catch(error => {
            console.error("❌ Error saving settings:", error);
            showSettingsMessage("❌ Error saving settings", "error");
        });
}
// ✅ Recalcular costo operativo automáticamente cuando cambien las millas
document.getElementById('monthlyMilesSetting')?.addEventListener('input', () => {
    const monthlyMiles = parseFloat(document.getElementById('monthlyMilesSetting').value || 6000);
    const fixedCosts = 2600; // Seguro + Van + otros
    if (monthlyMiles > 0) {
        const newOperatingCost = fixedCosts / monthlyMiles;
        document.getElementById('operatingCostSetting').value = newOperatingCost.toFixed(2);
        console.log("🔄 Recalculated cost per mile:", newOperatingCost);
    }
});



function resetSettings() {
    if (!confirm("¿Estás seguro de que quieres restaurar la configuración por defecto?")) {
        return;
    }

    // ✅ RESTAURAR TODOS LOS VALORES POR DEFECTO
    if (document.getElementById('operatingCostSetting')) {
        document.getElementById('operatingCostSetting').value = 0.33;
    }
    if (document.getElementById('fuelCostSetting')) {
        document.getElementById('fuelCostSetting').value = 0.18;
    }
    if (document.getElementById('companyNameSetting')) {
        document.getElementById('companyNameSetting').value = '';
    }
    if (document.getElementById('phoneSetting')) {
        document.getElementById('phoneSetting').value = '';
    }
    if (document.getElementById('emailNotifications')) {
        document.getElementById('emailNotifications').checked = true;
    }
    if (document.getElementById('autoSave')) {
        document.getElementById('autoSave').checked = true;
    }
    // ✅ COSTOS REALES
    if (document.getElementById('useRealCosts')) {
        document.getElementById('useRealCosts').checked = true;
    }
    if (document.getElementById('realCostsPeriod')) {
        document.getElementById('realCostsPeriod').value = '3';
    }

    showSettingsMessage("🔄 Settings reset to defaults", "success");
}

function recalculateOperatingCost() {
    const monthlyMiles = parseFloat(document.getElementById('monthlyMilesSetting')?.value || 6000);
    const fixedCosts = 2600; // 💡 Aquí pon tus gastos fijos reales: seguro, van, etc.

    if (monthlyMiles > 0) {
        const operatingCost = fixedCosts / monthlyMiles;
        const opInput = document.getElementById('operatingCostSetting');
        if (opInput) {
            opInput.value = operatingCost.toFixed(2);
            console.log(`📊 Nuevo costo operativo calculado: $${operatingCost.toFixed(2)}/milla`);
        }
    }
}

// ✅ NUEVA FUNCIÓN: Obtener configuración de costos reales
async function getRealCostsSettings() {
    try {
        if (!window.currentUser) {
            return { useRealCosts: true, period: 3 }; // Por defecto
        }

        const doc = await firebase.firestore()
            .collection("users")
            .doc(window.currentUser.uid)
            .get();

        if (doc.exists) {
            const data = doc.data();
            return {
                useRealCosts: data.useRealCosts !== false,
                period: parseInt(data.realCostsPeriod || '3')
            };
        }

        return { useRealCosts: true, period: 3 };
    } catch (error) {
        console.error("❌ Error getting real costs settings:", error);
        return { useRealCosts: true, period: 3 };
    }
}

// ✅ FUNCIÓN PARA MOSTRAR COSTOS REALES ACTUALES
async function displayCurrentRealCosts() {
    try {
        console.log("📊 Loading current real costs for display...");

        if (!window.currentUser) {
            // Actualizar solo la tab de settings
            document.getElementById("currentRealFuelCost").textContent = "--";
            document.getElementById("currentRealMaintenanceCost").textContent = "--";
            document.getElementById("lastRealCostUpdate").textContent = "No autenticado";
            return;
        }

        // Mostrar "Calculando..." en Settings
        document.getElementById("currentRealFuelCost").textContent = "Calculando...";
        document.getElementById("currentRealMaintenanceCost").textContent = "Calculando...";
        document.getElementById("lastRealCostUpdate").textContent = "Cargando...";

        // Configuración del usuario
        const settings = await getRealCostsSettings();
        if (!settings.useRealCosts) {
            document.getElementById("currentRealFuelCost").textContent = "Desactivado";
            document.getElementById("currentRealMaintenanceCost").textContent = "Desactivado";
            document.getElementById("lastRealCostUpdate").textContent = "Función desactivada";
            return;
        }

        // Calcular costos reales
        const realFuelCost = await getRealFuelCost();      // devuelve número
        const realExpenseCosts = await getRealExpenseCosts(); // { fuel, maintenance }

        // ✅ Actualizar Settings tab
        document.getElementById("currentRealFuelCost").textContent =
            realFuelCost ? `$${realFuelCost.toFixed(4)}/milla` : "--";
        document.getElementById("currentRealMaintenanceCost").textContent =
            realExpenseCosts.maintenance ? `$${realExpenseCosts.maintenance.toFixed(4)}/milla` : "--";
        document.getElementById("lastRealCostUpdate").textContent = new Date().toLocaleString();

        // ✅ Actualizar panel en Calculadora
        updateRealCostDisplay(realFuelCost, realExpenseCosts);

        console.log("✅ Real costs displayed successfully");

    } catch (error) {
        console.error("❌ Error displaying real costs:", error);
        document.getElementById("currentRealFuelCost").textContent = "Error";
        document.getElementById("currentRealMaintenanceCost").textContent = "Error";
        document.getElementById("lastRealCostUpdate").textContent = "Error";
    }
}


// ✅ FUNCIÓN AUXILIAR: Obtener combustible real para display
async function getRealFuelCostForDisplay() {
    try {
        const settings = await getRealCostsSettings();
        const monthsBack = settings.period;
        
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const startDateString = startDate.toISOString().split('T')[0];

        const snapshot = await firebase.firestore()
            .collection("loads")
            .where("userId", "==", window.currentUser.uid)
            .where("date", ">=", startDateString)
            .get();

        if (snapshot.empty) {
            return 0.18; // Valor por defecto
        }

        let totalFuelCost = 0;
        let totalMiles = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const fuelCost = Number(data.fuelCost || 0);
            const miles = Number(data.totalMiles || 0);
            
            if (fuelCost > 0 && miles > 0) {
                totalFuelCost += fuelCost;
                totalMiles += miles;
            }
        });

        return totalMiles > 0 ? totalFuelCost / totalMiles : 0.18;

    } catch (error) {
        console.error("❌ Error getting real fuel cost for display:", error);
        return 0.18;
    }
}

// ✅ FUNCIÓN AUXILIAR: Obtener costos de gastos para display
async function getRealExpenseCostsForDisplay() {
    try {
        const settings = await getRealCostsSettings();
        const monthsBack = settings.period;
        
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const startDateString = startDate.toISOString().split('T')[0];

        const [expensesSnapshot, loadsSnapshot] = await Promise.all([
            firebase.firestore()
                .collection("expenses")
                .where("userId", "==", window.currentUser.uid)
                .where("date", ">=", startDateString)
                .get(),
            firebase.firestore()
                .collection("loads")
                .where("userId", "==", window.currentUser.uid)
                .where("date", ">=", startDateString)
                .get()
        ]);

        const totalMiles = loadsSnapshot.docs.reduce((sum, doc) => {
            return sum + (Number(doc.data().totalMiles) || 0);
        }, 0);

        if (totalMiles === 0) {
            return { fuel: 0, maintenance: 0 };
        }

        let fuelExpenses = 0;
        let maintenanceExpenses = 0;

        expensesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const amount = Number(data.amount || 0);
            const type = (data.type || '').toLowerCase();

            switch (type) {
                case 'fuel':
                    fuelExpenses += amount;
                    break;
                case 'maintenance':
                    maintenanceExpenses += amount;
                    break;
            }
        });

        return {
            fuel: fuelExpenses / totalMiles,
            maintenance: maintenanceExpenses / totalMiles
        };

    } catch (error) {
        console.error("❌ Error getting real expense costs for display:", error);
        return { fuel: 0, maintenance: 0 };
    }
}

// ✅ FUNCIÓN PARA ACTUALIZAR INTERFAZ DE COSTOS REALES (solo para el tab de Configuración)
function updateSettingsCostDisplay(fuelCost, maintenanceCost, lastUpdate) {
  const fuelEl = document.getElementById('currentRealFuelCost');
  const maintenanceEl = document.getElementById('currentRealMaintenanceCost');
  const updateEl = document.getElementById('lastRealCostUpdate');

  if (fuelEl) fuelEl.textContent = fuelCost;
  if (maintenanceEl) maintenanceEl.textContent = maintenanceCost;
  if (updateEl) updateEl.textContent = lastUpdate;
}


// ✅ FUNCIÓN CUANDO CAMBIA LA CONFIGURACIÓN DE COSTOS REALES
function onRealCostsSettingChanged(useRealCosts) {
    console.log("🔄 Real costs setting changed:", useRealCosts);
    
    setTimeout(() => {
        displayCurrentRealCosts();
    }, 500);
}

function showSettingsMessage(message, type = "info") {
    // Helper function para mostrar mensajes
    function showMessage(message, type = "info", elementId = "globalMessage") {
        const div = document.getElementById(elementId);
        if (!div) {
            console.log(message); // Fallback to console
            return;
        }

        const classes = {
            success: "message-success",
            error: "message-error",
            info: "message-info"
        };

        div.className = classes[type] || "message-info";
        div.textContent = message;
        div.style.display = "block";

        setTimeout(() => {
            div.style.display = "none";
        }, 4000);
    }

    // Usar la función helper
    showMessage(message, type);
}

function testFirebase() {
    if (!window.currentUser) {
        showSettingsMessage("❌ No user logged in", "error");
        return;
    }

    showSettingsMessage("🔍 Testing Firebase connection...", "info");
    
    const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        userId: window.currentUser.uid
    };

    firebase.firestore()
        .collection("test")
        .add(testData)
        .then((docRef) => {
            console.log("✅ Firebase write test successful, doc ID:", docRef.id);
            
            return firebase.firestore()
                .collection("loads")
                .where("userId", "==", window.currentUser.uid)
                .get();
        })
        .then((snapshot) => {
            console.log("✅ Firebase read test successful, found", snapshot.size, "loads");
            showSettingsMessage(`✅ Firebase OK! Found ${snapshot.size} loads`, "success");
            
            return firebase.firestore().collection("test").where("userId", "==", window.currentUser.uid).get();
        })
        .then((snapshot) => {
            snapshot.docs.forEach(doc => doc.ref.delete());
            console.log("🧹 Cleaned up test documents");
        })
        .catch((error) => {
            console.error("❌ Firebase test failed:", error);
            showSettingsMessage(`❌ Firebase error: ${error.message}`, "error");
        });
}

// ✅ NUEVA FUNCIÓN: Probar costos reales
async function testRealCosts() {
    try {
        showSettingsMessage("🔍 Testing real costs calculation...", "info");
        
        // Simular las mismas funciones que usa calculator.js
        const testFuelCost = await getRealFuelCostForDisplay();
        const testExpenseCosts = await getRealExpenseCostsForDisplay();
        
        console.log("Real fuel cost test:", testFuelCost);
        console.log("Real expense costs test:", testExpenseCosts);
        
        const totalFuelCost = testFuelCost + testExpenseCosts.fuel;
        
        showSettingsMessage(`✅ Combustible: $${totalFuelCost.toFixed(4)}/mi, Mantenimiento: $${testExpenseCosts.maintenance.toFixed(4)}/mi`, "success");
        
    } catch (error) {
        console.error("❌ Real costs test failed:", error);
        showSettingsMessage(`❌ Error testing real costs: ${error.message}`, "error");
    }
}

// ✅ EVENT LISTENERS
document.addEventListener('DOMContentLoaded', function() {
    // Event listener para el selector de período
    setTimeout(() => {
        const periodSelect = document.getElementById('realCostsPeriod');
        if (periodSelect) {
            periodSelect.addEventListener('change', function() {
                console.log("📅 Real costs period changed, recalculating...");
                setTimeout(() => {
                    displayCurrentRealCosts();
                }, 100);
            });
        }
        
        // Event listener para el checkbox de costos reales
        const useRealCostsCheckbox = document.getElementById('useRealCosts');
        if (useRealCostsCheckbox) {
            useRealCostsCheckbox.addEventListener('change', function() {
                onRealCostsSettingChanged(this.checked);
            });
        }
    }, 1000);
});

// Event listener cuando el usuario se autentica
document.addEventListener('userStateChanged', function(event) {
    const { user } = event.detail || {};
    if (user) {
        setTimeout(() => {
            displayCurrentRealCosts();
        }, 1000);
    }
});

// Actualizar costos cuando se guarda una nueva carga
document.addEventListener('loadSaved', function() {
    console.log("🔄 Load saved, updating real costs display");
    setTimeout(() => {
        displayCurrentRealCosts();
    }, 1000);
});

// Configuraciones por defecto
const defaultSettings = {
    operatingCostPerMile: 0.33,
    fuelCostPerMile: 0.18,
    currency: 'USD',
    theme: 'light',
    emailNotifications: true,
    autoSave: true,
    useRealCosts: true, // ✅ NUEVO
    realCostsPeriod: '3' // ✅ NUEVO (meses)
};

// ✅ EXPONER FUNCIONES GLOBALMENTE
window.loadSettings = loadSettings;
window.saveUserSettings = saveUserSettings;
window.resetSettings = resetSettings;
window.testFirebase = testFirebase;
window.testRealCosts = testRealCosts;
window.getRealCostsSettings = getRealCostsSettings;
window.displayCurrentRealCosts = displayCurrentRealCosts;
window.onRealCostsSettingChanged = onRealCostsSettingChanged;

console.log("✅ Settings.js with real costs configuration loaded successfully");