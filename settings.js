// âš™ï¸ SETTINGS.JS - VERSIÃ“N COMPLETA Y FUNCIONAL
// Maneja todas las configuraciones del negocio expediter

console.log("âš™ï¸ Loading settings.js - Complete version...");

// âœ… 1. PLANTILLAS DE VEHÃCULOS
const VEHICLE_TEMPLATES = {
    van: {
        name: "Van/Sprinter",
        fuelMPG: 18,
        maintenancePerMile: 0.080,
        tiresPerMile: 0.060,
        repairsPerMile: 0.040,
        vehiclePayment: 800,
        insurance: 1250,
        licenses: 150,
        otherFixed: 200
    },
    boxtruck: {
        name: "Box Truck",
        fuelMPG: 12,
        maintenancePerMile: 0.120,
        tiresPerMile: 0.080,
        repairsPerMile: 0.060,
        vehiclePayment: 1200,
        insurance: 1800,
        licenses: 200,
        otherFixed: 300
    },
    semi: {
        name: "Semi Trailer",
        fuelMPG: 7,
        maintenancePerMile: 0.180,
        tiresPerMile: 0.120,
        repairsPerMile: 0.100,
        vehiclePayment: 2500,
        insurance: 3000,
        licenses: 500,
        otherFixed: 500
    },
    hotshot: {
        name: "Hotshot Pickup",
        fuelMPG: 15,
        maintenancePerMile: 0.100,
        tiresPerMile: 0.070,
        repairsPerMile: 0.050,
        vehiclePayment: 1000,
        insurance: 1500,
        licenses: 175,
        otherFixed: 250
    }
};

// âœ… 2. FUNCIÃ“N PARA MOSTRAR MENSAJES
function showConfigMessage(message, type = "info") {
    console.log(`ðŸ“¢ Config message: ${message} (${type})`);
    
    let messageEl = document.getElementById('configMessage');
    
    // Crear elemento si no existe
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'configMessage';
        messageEl.className = 'config-message';
        messageEl.style.cssText = 'padding: 12px; border-radius: 8px; margin-bottom: 16px; font-weight: 500; display: none;';
        
        const settingsSection = document.getElementById('settings');
        if (settingsSection && settingsSection.firstChild) {
            settingsSection.insertBefore(messageEl, settingsSection.firstChild.nextSibling);
        }
    }
    
    // Limpiar clases anteriores
    messageEl.className = 'config-message';
    
    // Aplicar estilos segÃºn tipo
    if (type === "success") {
        messageEl.classList.add('success');
        messageEl.style.backgroundColor = '#d1fae5';
        messageEl.style.color = '#065f46';
        messageEl.style.border = '1px solid #a7f3d0';
    } else if (type === "error") {
        messageEl.classList.add('error');
        messageEl.style.backgroundColor = '#fee2e2';
        messageEl.style.color = '#991b1b';
        messageEl.style.border = '1px solid #fca5a5';
    } else {
        messageEl.style.backgroundColor = '#dbeafe';
        messageEl.style.color = '#1e40af';
        messageEl.style.border = '1px solid #93c5fd';
    }
    
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    // Auto-ocultar despuÃ©s de 4 segundos
    setTimeout(() => {
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }, 4000);
}

// âœ… 3. FUNCIÃ“N PARA CALCULAR COSTO DE COMBUSTIBLE
function calculateFuelCost() {
    console.log("â›½ Calculating fuel cost...");
    
    const mpgEl = document.getElementById('fuelMPG');
    const priceEl = document.getElementById('fuelPricePerGallon');
    const resultEl = document.getElementById('calculatedFuelCost');
    
    if (!mpgEl || !priceEl) {
        console.log("âŒ Fuel input elements not found");
        return 0.194; // Default value
    }
    
    const mpg = parseFloat(mpgEl.value) || 18;
    const pricePerGallon = parseFloat(priceEl.value) || 3.50;
    
    // Validaciones bÃ¡sicas
    if (mpg <= 0 || pricePerGallon <= 0) {
        console.log("âš ï¸ Invalid fuel values");
        return 0.194;
    }
    
    const fuelCostPerMile = pricePerGallon / mpg;
    
    if (resultEl) {
        resultEl.textContent = `$${fuelCostPerMile.toFixed(3)}/mi`;
    }
    
    console.log(`âœ… Fuel cost calculated: $${fuelCostPerMile.toFixed(3)}/mi (${mpg} MPG, $${pricePerGallon}/gal)`);
    
    return fuelCostPerMile;
}

// âœ… 4. FUNCIÃ“N PARA CALCULAR TOTALES
function calculateTotals() {
    console.log("ðŸ“Š Calculating totals...");
    
    try {
        // Obtener costos fijos mensuales
        const vehiclePayment = parseFloat(document.getElementById('vehiclePayment')?.value) || 0;
        const insurance = parseFloat(document.getElementById('insurance')?.value) || 0;
        const licenses = parseFloat(document.getElementById('licenses')?.value) || 0;
        const otherFixed = parseFloat(document.getElementById('otherFixed')?.value) || 0;
        
        const totalFixed = vehiclePayment + insurance + licenses + otherFixed;
        
        // Millas mensuales objetivo
        const monthlyMiles = parseFloat(document.getElementById('monthlyMilesGoal')?.value) || 8000;
        
        // ValidaciÃ³n
        if (monthlyMiles <= 0) {
            console.log("âš ï¸ Invalid monthly miles");
            return { totalFixed: 0, fixedCostPerMile: 0 };
        }
        
        // Costo fijo por milla
        const fixedCostPerMile = totalFixed / monthlyMiles;
        
        // Actualizar display
        const totalFixedEl = document.getElementById('totalFixed');
        const fixedCostPerMileEl = document.getElementById('fixedCostPerMile');
        
        if (totalFixedEl) {
            totalFixedEl.textContent = `$${totalFixed.toLocaleString()}`;
        }
        
        if (fixedCostPerMileEl) {
            fixedCostPerMileEl.textContent = `$${fixedCostPerMile.toFixed(3)}`;
        }
        
        console.log(`âœ… Totals calculated:`, {
            totalFixed: `$${totalFixed}`,
            monthlyMiles,
            fixedCostPerMile: `$${fixedCostPerMile.toFixed(3)}`
        });
        
        return { totalFixed, fixedCostPerMile, monthlyMiles };
        
    } catch (error) {
        console.error("âŒ Error calculating totals:", error);
        return { totalFixed: 0, fixedCostPerMile: 0 };
    }
}

// âœ… 5. FUNCIÃ“N PARA CARGAR PLANTILLAS DE VEHÃCULOS
function loadVehicleTemplate(vehicleType) {
    console.log(`ðŸš› Loading template for: ${vehicleType}`);
    
    const template = VEHICLE_TEMPLATES[vehicleType];
    if (!template) {
        console.log("âŒ Template not found for:", vehicleType);
        showConfigMessage(`âŒ Plantilla no encontrada para: ${vehicleType}`, "error");
        return;
    }
    
    try {
        // Aplicar valores a los campos
        const fields = [
            ['fuelMPG', template.fuelMPG],
            ['maintenancePerMile', template.maintenancePerMile],
            ['tiresPerMile', template.tiresPerMile],
            ['repairsPerMile', template.repairsPerMile],
            ['vehiclePayment', template.vehiclePayment],
            ['insurance', template.insurance],
            ['licenses', template.licenses],
            ['otherFixed', template.otherFixed]
        ];
        
        let fieldsApplied = 0;
        
        fields.forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = value;
                fieldsApplied++;
                console.log(`âœ… Set ${fieldId} = ${value}`);
            } else {
                console.log(`âš ï¸ Element not found: ${fieldId}`);
            }
        });
        
        // Recalcular despuÃ©s de aplicar template
        setTimeout(() => {
            calculateFuelCost();
            calculateTotals();
        }, 100);
        
        showConfigMessage(`âœ… Plantilla ${template.name} aplicada (${fieldsApplied} campos)`, "success");
        
        return template;
        
    } catch (error) {
        console.error("âŒ Error loading vehicle template:", error);
        showConfigMessage("âŒ Error al cargar plantilla", "error");
    }
}

// âœ… 6. FUNCIÃ“N PARA GUARDAR CONFIGURACIÃ“N DE USUARIO
function saveUserConfiguration() {
    console.log("ðŸ’¾ Saving user configuration...");
    
    if (!window.currentUser) {
        console.log("âŒ No user logged in");
        showConfigMessage("Debes estar logueado para guardar la configuraciÃ³n", "error");
        return;
    }
    
    try {
        // Recopilar todos los datos del formulario
        const config = {
            // Metadatos
            configVersion: '2.0',
            updatedAt: new Date().toISOString(),
            
            // Perfil de operaciÃ³n
            vehicleType: document.getElementById('vehicleType')?.value || 'van',
            businessName: document.getElementById('businessName')?.value || '',
            operatingState: document.getElementById('operatingState')?.value || 'FL',
            
            // Costos fijos mensuales
            vehiclePayment: parseFloat(document.getElementById('vehiclePayment')?.value) || 0,
            insurance: parseFloat(document.getElementById('insurance')?.value) || 0,
            licenses: parseFloat(document.getElementById('licenses')?.value) || 0,
            otherFixed: parseFloat(document.getElementById('otherFixed')?.value) || 0,
            
            // Costos variables por milla
            fuelMPG: parseFloat(document.getElementById('fuelMPG')?.value) || 18,
            fuelPricePerGallon: parseFloat(document.getElementById('fuelPricePerGallon')?.value) || 3.50,
            maintenancePerMile: parseFloat(document.getElementById('maintenancePerMile')?.value) || 0.080,
            tiresPerMile: parseFloat(document.getElementById('tiresPerMile')?.value) || 0.060,
            repairsPerMile: parseFloat(document.getElementById('repairsPerMile')?.value) || 0.040,
            
            // ConfiguraciÃ³n de costos reales
            useRealCosts: document.getElementById('useRealCosts')?.checked || true,
            realCostsPeriod: document.getElementById('realCostsPeriod')?.value || '3',
            
            // Metas de negocio
            targetRPM: parseFloat(document.getElementById('targetRPM')?.value) || 1.25,
            monthlyMilesGoal: parseFloat(document.getElementById('monthlyMilesGoal')?.value) || 8000,
            targetProfit: parseFloat(document.getElementById('targetProfit')?.value) || 30
        };
        
        console.log("ðŸ“¦ Configuration to save:", config);
        
        // Guardar en Firestore
        const userRef = firebase.firestore().collection("users").doc(window.currentUser.uid);
        
        return userRef.set({
            ...config,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        .then(() => {
            console.log("âœ… Configuration saved to Firestore");
            showConfigMessage("âœ… ConfiguraciÃ³n guardada exitosamente", "success");
            
            // TambiÃ©n guardar en localStorage como backup
            localStorage.setItem('userConfig_backup', JSON.stringify(config));
            
            return config;
        })
        .catch((error) => {
            console.error("âŒ Error saving to Firestore:", error);
            
            // Fallback a localStorage
            localStorage.setItem('userConfig_backup', JSON.stringify(config));
            showConfigMessage("âœ… ConfiguraciÃ³n guardada localmente", "success");
            
            return config;
        });
        
    } catch (error) {
        console.error("âŒ Error saving configuration:", error);
        showConfigMessage("âŒ Error al guardar configuraciÃ³n: " + error.message, "error");
    }
}

// âœ… 7. FUNCIÃ“N PARA CARGAR CONFIGURACIÃ“N DE USUARIO
function loadUserConfiguration() {
    console.log("ðŸ”„ Loading user configuration...");
    
    if (!window.currentUser) {
        console.log("âŒ No user logged in");
        showConfigMessage("Debes estar logueado para cargar configuraciÃ³n", "error");
        return;
    }
    
    // Primero intentar cargar desde Firestore
    const userRef = firebase.firestore().collection("users").doc(window.currentUser.uid);
    
    return userRef.get()
        .then((doc) => {
            let config = null;
            
            if (doc.exists) {
                config = doc.data();
                console.log("ðŸ“¦ Configuration loaded from Firestore:", config);
            } else {
                // Fallback a localStorage
                const backupConfig = localStorage.getItem('userConfig_backup');
                if (backupConfig) {
                    config = JSON.parse(backupConfig);
                    console.log("ðŸ“¦ Configuration loaded from localStorage backup:", config);
                } else {
                    console.log("âš ï¸ No saved configuration found");
                    showConfigMessage("No hay configuraciÃ³n guardada", "error");
                    return;
                }
            }
            
            // Aplicar configuraciÃ³n a los campos
            applyConfigurationToForm(config);
            
            return config;
        })
        .catch((error) => {
            console.error("âŒ Error loading from Firestore:", error);
            
            // Fallback a localStorage
            try {
                const backupConfig = localStorage.getItem('userConfig_backup');
                if (backupConfig) {
                    const config = JSON.parse(backupConfig);
                    console.log("ðŸ“¦ Configuration loaded from localStorage backup:", config);
                    applyConfigurationToForm(config);
                    return config;
                } else {
                    showConfigMessage("No hay configuraciÃ³n guardada", "error");
                }
            } catch (backupError) {
                console.error("âŒ Error loading backup configuration:", backupError);
                showConfigMessage("âŒ Error al cargar configuraciÃ³n", "error");
            }
        });
}

// âœ… 8. FUNCIÃ“N AUXILIAR PARA APLICAR CONFIGURACIÃ“N AL FORMULARIO
function applyConfigurationToForm(config) {
    if (!config) return;
    
    try {
        // Aplicar valores a campos de texto/nÃºmero
        const fields = [
            ['vehicleType', config.vehicleType],
            ['businessName', config.businessName],
            ['operatingState', config.operatingState],
            ['vehiclePayment', config.vehiclePayment],
            ['insurance', config.insurance],
            ['licenses', config.licenses],
            ['otherFixed', config.otherFixed],
            ['fuelMPG', config.fuelMPG],
            ['fuelPricePerGallon', config.fuelPricePerGallon],
            ['maintenancePerMile', config.maintenancePerMile],
            ['tiresPerMile', config.tiresPerMile],
            ['repairsPerMile', config.repairsPerMile],
            ['targetRPM', config.targetRPM],
            ['monthlyMilesGoal', config.monthlyMilesGoal],
            ['targetProfit', config.targetProfit]
        ];
        
        let fieldsLoaded = 0;
        
        fields.forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element && value !== undefined && value !== null) {
                element.value = value;
                fieldsLoaded++;
                console.log(`âœ… Loaded ${fieldId} = ${value}`);
            }
        });
        
        // Aplicar checkboxes
        const useRealCostsEl = document.getElementById('useRealCosts');
        if (useRealCostsEl && config.useRealCosts !== undefined) {
            useRealCostsEl.checked = config.useRealCosts;
        }
        
        const realCostsPeriodEl = document.getElementById('realCostsPeriod');
        if (realCostsPeriodEl && config.realCostsPeriod) {
            realCostsPeriodEl.value = config.realCostsPeriod;
        }
        
        // Recalcular despuÃ©s de cargar
        setTimeout(() => {
            calculateFuelCost();
            calculateTotals();
        }, 100);
        
        showConfigMessage(`âœ… ConfiguraciÃ³n cargada (${fieldsLoaded} campos)`, "success");
        
    } catch (error) {
        console.error("âŒ Error applying configuration to form:", error);
        showConfigMessage("âŒ Error al aplicar configuraciÃ³n", "error");
    }
}

// âœ… 9. FUNCIÃ“N PARA CARGAR CONFIGURACIONES DESDE FIREBASE (COMPATIBILIDAD)
function loadSettings() {
    console.log("âš™ï¸ Loading settings (legacy function)...");
    return loadUserConfiguration();
}

// âœ… 10. CONFIGURACIÃ“N DE EVENT LISTENERS
function setupSettingsEventListeners() {
    console.log("ðŸ”— Setting up settings event listeners...");
    
    // Event listeners para cÃ¡lculos automÃ¡ticos
    const autoCalculateFields = [
        'fuelMPG',
        'fuelPricePerGallon',
        'vehiclePayment',
        'insurance',
        'licenses',
        'otherFixed',
        'monthlyMilesGoal'
    ];
    
    autoCalculateFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                setTimeout(() => {
                    if (fieldId === 'fuelMPG' || fieldId === 'fuelPricePerGallon') {
                        calculateFuelCost();
                    }
                    calculateTotals();
                }, 100);
            });
        }
    });
    
    // Event listener para cambio de tipo de vehÃ­culo
    const vehicleTypeSelect = document.getElementById('vehicleType');
    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener('change', function() {
            // No auto-aplicar plantilla, solo cuando el usuario haga clic en el botÃ³n
            console.log(`Vehicle type changed to: ${this.value}`);
        });
    }
    
    console.log("âœ… Settings event listeners configured");
}

// âœ… 11. INICIALIZACIÃ“N
function initializeSettings() {
    console.log("ðŸš€ Initializing settings...");
    
    setupSettingsEventListeners();
    
    // Cargar configuraciÃ³n si hay usuario
    if (window.currentUser) {
        setTimeout(() => {
            loadUserConfiguration();
        }, 500);
    }
    
    // Calcular valores iniciales
    setTimeout(() => {
        calculateFuelCost();
        calculateTotals();
    }, 100);
    
    console.log("âœ… Settings initialized");
}

// âœ… 12. EXPONER FUNCIONES GLOBALMENTE
window.showConfigMessage = showConfigMessage;
window.calculateFuelCost = calculateFuelCost;
window.calculateTotals = calculateTotals;
window.loadVehicleTemplate = loadVehicleTemplate;
window.saveUserConfiguration = saveUserConfiguration;
window.loadUserConfiguration = loadUserConfiguration;
window.loadSettings = loadSettings; // Compatibilidad
window.initializeSettings = initializeSettings;

// âœ… 13. AUTO-INICIALIZACIÃ“N
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initializeSettings();
    }, 1000);
});

// Event listener cuando el usuario se autentica
document.addEventListener('userStateChanged', function(event) {
    const { user } = event.detail || {};
    if (user) {
        setTimeout(() => {
            loadUserConfiguration();
        }, 1000);
    }
});

console.log("âœ… Settings.js loaded successfully - Complete version with all functionality");