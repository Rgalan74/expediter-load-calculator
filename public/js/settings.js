// SETTINGS.JS - VERSIÃ“N COMPLETA Y FUNCIONAL
// Maneja todas las configuraciones del negocio expediter

debugLog(" Loading settings.js - Complete version...");

// 1. PLANTILLAS DE VEHÍCULOS
const VEHICLE_TEMPLATES = {
    van: {
        name: "Van/Sprinter",
        fuelMPG: 19,
        maintenancePerMile: 0.014,
        tiresPerMile: 0.012,
        repairsPerMile: 0.025,
        vehiclePayment: 897,
        insurance: 1250,
        licenses: 10,
        otherFixed: 150
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

// 2. FUNCION PARA MOSTRAR MENSAJES
function showConfigMessage(message, type = "info") {
    debugLog(` Config message: ${message} (${type})`);

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

    // Aplicar estilos según tipo
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

    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }, 4000);
}

// 3. FUNCION PARA CALCULAR COSTO DE COMBUSTIBLE
function calculateFuelCost() {
    debugLog(" Calculating fuel cost...");

    const mpgEl = document.getElementById('fuelMPG');
    const priceEl = document.getElementById('fuelPricePerGallon');
    const resultEl = document.getElementById('calculatedFuelCost');

    if (!mpgEl || !priceEl) {
        debugLog(" Fuel input elements not found");
        return 0.194; // Default value
    }

    const mpg = parseFloat(mpgEl.value) || 18;
    const pricePerGallon = parseFloat(priceEl.value) || 3.50;

    // Validaciones básicas
    if (mpg <= 0 || pricePerGallon <= 0) {
        debugLog(" Invalid fuel values");
        return 0.194;
    }

    const fuelCostPerMile = pricePerGallon / mpg;

    if (resultEl) {
        resultEl.textContent = `$${fuelCostPerMile.toFixed(3)}/mi`;
    }

    debugLog(` Fuel cost calculated: $${fuelCostPerMile.toFixed(3)}/mi (${mpg} MPG, $${pricePerGallon}/gal)`);

    return fuelCostPerMile;
}

// 4. FUNCION PARA CALCULAR TOTALES
// These fields are USD/mi. Large legacy values are ambiguous, not auto-converted.
function validateVariableCosts(showWarning = false) {
    const message = window.i18n?.t('settings.variable_cost_warning') ||
        'Review maintenance, tires and repairs in USD/mi. Enter a value from 0 to less than 1 in each field. Historical monthly amounts are not converted automatically; confirm their units before saving.';
    let valid = true;
    for (const id of ['maintenancePerMile', 'tiresPerMile', 'repairsPerMile']) {
        const field = document.getElementById(id);
        const raw = field?.value;
        const value = Number(raw);
        const acceptable = raw !== undefined && String(raw).trim() !== '' && Number.isFinite(value) && value >= 0 && value < 1;
        field?.setCustomValidity(acceptable ? '' : message);
        if (!acceptable) valid = false;
    }
    if (!valid && showWarning) showConfigMessage(message, 'error');
    return valid;
}

function calculateTotals() {
    if (!validateVariableCosts()) return { totalFixed: 0, fixedCostPerMile: 0, totalCPM: null };
    debugLog(" Calculating totals...");

    try {
        // Obtener costos fijos mensuales
        const vehiclePayment = parseFloat(document.getElementById('vehiclePayment')?.value) || 0;
        const insurance = parseFloat(document.getElementById('insurance')?.value) || 0;
        const licenses = parseFloat(document.getElementById('licenses')?.value) || 0;
        const otherFixed = parseFloat(document.getElementById('otherFixed')?.value) || 0;

        const totalFixed = vehiclePayment + insurance + licenses + otherFixed;

        // Millas mensuales objetivo
        const monthlyMiles = parseFloat(document.getElementById('monthlyMilesGoal')?.value) || 8000;

        // Validación
        if (monthlyMiles <= 0) {
            debugLog(" Invalid monthly miles");
            return { totalFixed: 0, fixedCostPerMile: 0 };
        }

        // Costo fijo por milla: igual que la Calculadora. Con historial real se divide
        // entre tus millas reales al mes; si no, entre tu meta de millas.
        const _eng = window.CPMEngine?.current?.();
        const realMiles = (_eng && _eng.source === 'real') ? Number(_eng.realMonthlyMiles) || 0 : 0;
        const milesForFixed = realMiles > 0 ? realMiles : monthlyMiles;
        const fixedCostPerMile = totalFixed / milesForFixed;
        const noteEl = document.getElementById('fixedPerMileNote');
        if (noteEl) {
            const _isEsN = (window.i18n?.currentLang || 'en') === 'es';
            noteEl.textContent = realMiles > 0
                ? (_isEsN ? `* Con tus millas reales: ${Math.round(realMiles).toLocaleString()} mi/mes (lo mismo que usa la Calculadora)`
                          : `* Using your real miles: ${Math.round(realMiles).toLocaleString()} mi/mo (same as the Calculator)`)
                : (_isEsN ? `* Con tu meta de ${Math.round(monthlyMiles).toLocaleString()} mi/mes (cuando tengas historial se usarán tus millas reales)`
                          : `* Using your goal of ${Math.round(monthlyMiles).toLocaleString()} mi/mo (your real miles will be used once you have history)`);
        }

        // Costos variables YA expresados en USD/milla; no dividir entre millas mensuales
        const maintenanceMonthly = parseFloat(document.getElementById('maintenancePerMile')?.value) || 0;
        const tiresMonthly       = parseFloat(document.getElementById('tiresPerMile')?.value) || 0;
        const repairsMonthly     = parseFloat(document.getElementById('repairsPerMile')?.value) || 0;
        const variableMonthly    = maintenanceMonthly + tiresMonthly + repairsMonthly;
        const variableCPM        = variableMonthly;

        const fuelCPM = parseFloat(document.getElementById('fuelPricePerGallon')?.value || 3.70) /
                        parseFloat(document.getElementById('fuelMPG')?.value || 19);
        const totalCPM = fuelCPM + variableCPM + fixedCostPerMile;

        // Actualizar display
        const totalFixedEl = document.getElementById('totalFixed');
        const fixedCostPerMileEl = document.getElementById('fixedCostPerMile');

        if (totalFixedEl) {
            totalFixedEl.textContent = `$${totalFixed.toLocaleString()}`;
        }
        if (fixedCostPerMileEl) {
            fixedCostPerMileEl.textContent = `$${fixedCostPerMile.toFixed(3)}`;
        }

        debugLog(` Totals:`, { totalFixed, fixedCostPerMile: fixedCostPerMile.toFixed(3), variableCPM: variableCPM.toFixed(3), totalCPM: totalCPM.toFixed(3) });

        return { totalFixed, fixedCostPerMile, monthlyMiles, totalCPM };

    } catch (error) {
        debugLog(" Error calculating totals:", error);
        return { totalFixed: 0, fixedCostPerMile: 0 };
    }
}

// 5. FUNCION PARA CARGAR PLANTILLAS DE VEHÍCULOS
function loadVehicleTemplate(vehicleType) {
    debugLog(` Loading template for: ${vehicleType}`);

    const template = VEHICLE_TEMPLATES[vehicleType];
    if (!template) {
        debugLog(" Template not found for:", vehicleType);
        showConfigMessage(` Plantilla no encontrada para: ${vehicleType}`, "error");
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
                debugLog(` Set ${fieldId} = ${value}`);
            } else {
                debugLog(` Element not found: ${fieldId}`);
            }
        });

        // Recalcular después de aplicar template
        setTimeout(() => {
            calculateFuelCost();
            calculateTotals();
        }, 100);

        const _isEsTpl = (window.i18n?.currentLang || 'en') === 'es';
        showConfigMessage(_isEsTpl
            ? `Plantilla ${template.name} aplicada. Revisa los valores y guarda.`
            : `${template.name} template applied. Review the values and save.`, "success");

        return template;

    } catch (error) {
        debugLog(" Error loading vehicle template:", error);
        showConfigMessage(" Error al cargar plantilla", "error");
    }
}

// 6. FUNCION PARA GUARDAR CONFIGURACIÃ“N DE USUARIO
function saveUserConfiguration() {
    debugLog(" Saving user configuration...");

    if (!window.currentUser) {
        debugLog(" No user logged in");
        showConfigMessage("Debes estar logueado para guardar la configuración", "error");
        return;
    }

    // No guardar antes de que el formulario tenga los datos del usuario: si no,
    // los campos vacios sobrescriben sus costos con ceros.
    if (!window._settingsFormLoaded) {
        const _esL = (window.i18n?.currentLang || 'en') === 'es';
        showConfigMessage(_esL ? 'Espera un momento: estamos cargando tu configuración.' : 'One moment: your settings are still loading.', 'error');
        if (!window._settingsLoading) loadUserConfiguration();
        return;
    }

    if (!validateVariableCosts(true)) return;

    // ✅ OBTENER BOTÓN DE GUARDAR
    const saveBtn = document.querySelector('button[onclick*="saveUserConfiguration"]');

    try {
        // ✅ MOSTRAR LOADING
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';
        }

        // Recopilar todos los datos del formulario
        const config = {
            // Metadatos
            configVersion: '2.0',
            updatedAt: new Date().toISOString(),

            // Perfil de operación
            vehicleType: document.getElementById('vehicleType')?.value || 'van',
            businessName: document.getElementById('businessName')?.value || '',
            operatingState: document.getElementById('operatingState')?.value || 'FL',

            // Costos fijos mensuales
            vehiclePayment: parseFloat(document.getElementById('vehiclePayment')?.value) || 0,
            insurance: parseFloat(document.getElementById('insurance')?.value) || 0,
            licenses: parseFloat(document.getElementById('licenses')?.value) || 0,
            otherFixed: parseFloat(document.getElementById('otherFixed')?.value) || 0,
            // Hotel en la carretera al mes (sin historial real). La comida no: es personal.
            lodgingMonthly: Math.max(0, parseFloat(document.getElementById('lodgingMonthly')?.value) || 0),

            // Costos variables por milla
            fuelMPG: parseFloat(document.getElementById('fuelMPG')?.value) || 18,
            fuelPricePerGallon: parseFloat(document.getElementById('fuelPricePerGallon')?.value) || 3.50,
            // Combustible por ruta (EIA): tipo y ajuste propio sobre el promedio
            fuelType: document.getElementById('fuelType')?.value === 'diesel' ? 'diesel' : 'gasoline',
            fuelPriceAdjust: Math.max(-2, Math.min(2, Number(document.getElementById('fuelPriceAdjust')?.value) || 0)),
            maintenancePerMile: Number(document.getElementById('maintenancePerMile')?.value ?? 0.080),
            tiresPerMile: Number(document.getElementById('tiresPerMile')?.value ?? 0.060),
            repairsPerMile: Number(document.getElementById('repairsPerMile')?.value ?? 0.040),

            // Configuración de costos reales
            useRealCosts: document.getElementById('useRealCosts')?.checked || true,
            realCostsPeriod: document.getElementById('realCostsPeriod')?.value || '3',

            // Metas de negocio
            // RPM minimo vacio o 0 = sin piso (antes se guardaba $1.25 sin avisar).
            targetRPM: Math.max(0, parseFloat(document.getElementById('targetRPM')?.value) || 0),
            monthlyMilesGoal: parseFloat(document.getElementById('monthlyMilesGoal')?.value) || 8000,
            // Margen vacio = 20%, el mismo valor que usa la calculadora por defecto (antes 30%).
            targetProfit: parseFloat(document.getElementById('targetProfit')?.value) || 20
        };

        debugLog(" Configuration to save:", config);

        // ✅ CALCULAR costs PARA EL CALCULADOR
        // maintenancePerMile / tiresPerMile / repairsPerMile ya estan en USD/milla
        const fuelCostPerMile   = config.fuelPricePerGallon / config.fuelMPG;
        const variableMonthly   = config.maintenancePerMile + config.tiresPerMile + config.repairsPerMile;
        const variableCPMExFuel = variableMonthly;
        const totalFixedMonthly = config.vehiclePayment + config.insurance + config.licenses + config.otherFixed;
        const fixedCPM          = config.monthlyMilesGoal > 0 ? totalFixedMonthly / config.monthlyMilesGoal : 0;
        const lodgingCPM        = config.monthlyMilesGoal > 0 ? config.lodgingMonthly / config.monthlyMilesGoal : 0;
        const totalCPM          = fuelCostPerMile + variableCPMExFuel + fixedCPM + lodgingCPM;

        // Fecha del precio de la gasolina: cambia solo cuando cambia el precio,
        // para que la Calculadora avise si lleva mas de 30 dias sin actualizar.
        const prevProfile = window.currentUser?.profileData || {};
        const priceChanged = Number(prevProfile.fuelPricePerGallon) !== config.fuelPricePerGallon;
        config.fuelPriceUpdatedAt = (priceChanged || !prevProfile.fuelPriceUpdatedAt)
            ? new Date().toISOString()
            : prevProfile.fuelPriceUpdatedAt;

        config.costs = {
            combustible:   parseFloat(fuelCostPerMile.toFixed(4)),
            mantenimiento: parseFloat(variableCPMExFuel.toFixed(4)), // mant+tires+repairs en USD/milla
            comida:        0,
            hospedaje:     parseFloat(lodgingCPM.toFixed(4)), // hotel por milla
            costosFijos:   parseFloat(fixedCPM.toFixed(4)),
            TOTAL:         parseFloat(totalCPM.toFixed(4)),
            totalCPM:      parseFloat(totalCPM.toFixed(4)),
            isDefault:     false,
            updatedAt:     new Date().toISOString()
        };

        debugLog('✅ costs calculado:', config.costs,
            `| fuel=$${fuelCostPerMile.toFixed(3)} variable=$${variableCPMExFuel.toFixed(3)} fixed=$${fixedCPM.toFixed(3)} total=$${totalCPM.toFixed(3)}`);

        // ✅ Marcar vehicle y preferences como configurados por el usuario
        config.vehicle = {
            type: config.vehicleType,
            mpg: config.fuelMPG,
            fuelPrice: config.fuelPricePerGallon,
            isDefault: false
        };

        config.preferences = {
            isDefault: false
        };

        // ✅ Marcar onboarding como completado
        config.onboarding = {
            completed: true,
            completedAt: new Date().toISOString()
        };


        // ✅ ACTUALIZAR window.currentUser.costs INMEDIATAMENTE
        if (window.currentUser) {
            window.currentUser.costs = config.costs;
            // Mantener al dia lo que leen la calculadora y el semaforo sin recargar
            window.currentUser.profileData = {
                ...(window.currentUser.profileData || {}),
                targetProfit: config.targetProfit,
                monthlyMilesGoal: config.monthlyMilesGoal,
                targetRPM: config.targetRPM,
                fuelPricePerGallon: config.fuelPricePerGallon,
                fuelMPG: config.fuelMPG,
                fuelType: config.fuelType,
                fuelPriceAdjust: config.fuelPriceAdjust,
                vehiclePayment: config.vehiclePayment,
                insurance: config.insurance,
                licenses: config.licenses,
                otherFixed: config.otherFixed,
                lodgingMonthly: config.lodgingMonthly,
                vehicleType: config.vehicleType,
                fuelPriceUpdatedAt: config.fuelPriceUpdatedAt
            };
            document.dispatchEvent(new Event('configSaved'));
        }

        debugLog("✅ costs calculado:", config.costs);

        // Guardar en Firestore
        const userRef = firebase.firestore().collection("users").doc(window.currentUser.uid);

        return userRef.set({
            ...config,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
            .then(() => {
                debugLog(" Configuration saved to Firestore");
                showConfigMessage(" Configuración guardada exitosamente", "success");
                if (window.CPMEngine) window.CPMEngine.clearCache();

                // Notificar al onboardingManager que el onboarding está completo
                if (window.onboardingManager) {
                    window.onboardingManager.userProfile = window.onboardingManager.userProfile || {};
                    window.onboardingManager.userProfile.onboarding = { completed: true };
                    // Ocultar banner de recordatorio si está visible
                    const reminder = document.getElementById('setupReminder');
                    if (reminder) reminder.remove();
                }

                // ✅ OCULTAR LOADING
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Guardar Configuración';
                }

                // También guardar en localStorage como backup
                localStorage.setItem('userConfig_backup', JSON.stringify(config));

                return config;
            })
            .catch((error) => {
                debugLog(" Error saving to Firestore:", error);

                // Fallback a localStorage
                localStorage.setItem('userConfig_backup', JSON.stringify(config));
                showConfigMessage(" Configuración guardada localmente", "success");

                // ✅ OCULTAR LOADING
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Guardar Configuración';
                }

                return config;
            });

    } catch (error) {
        debugLog(" Error saving configuration:", error);
        showConfigMessage(" Error al guardar configuración: " + error.message, "error");
    }
}

// 7. FUNCION PARA CARGAR CONFIGURACIÃ“N DE USUARIO
function loadUserConfiguration() {
    debugLog(" Loading user configuration...");

    if (!window.currentUser) {
        debugLog(" No user logged in");
        showConfigMessage("Debes estar logueado para cargar configuración", "error");
        return;
    }

    // Primero intentar cargar desde Firestore
    const userRef = firebase.firestore().collection("users").doc(window.currentUser.uid);
    window._settingsLoading = true;

    return userRef.get()
        .then((doc) => {
            let config = null;

            if (doc.exists) {
                config = doc.data();
                debugLog(" Configuration loaded from Firestore:", config);
            } else {
                // Fallback a localStorage
                const backupConfig = localStorage.getItem('userConfig_backup');
                if (backupConfig) {
                    config = JSON.parse(backupConfig);
                    debugLog(" Configuration loaded from localStorage backup:", config);
                } else {
                    debugLog(" No saved configuration found");
                    showConfigMessage("No hay configuración guardada", "error");
                    // Usuario nuevo: no hay nada que sobrescribir, puede guardar
                    window._settingsFormLoaded = true;
                    return;
                }
            }

            // Aplicar configuración a los campos
            applyConfigurationToForm(config);
            window._settingsFormLoaded = true;

            return config;
        })
        .catch((error) => {
            debugLog(" Error loading from Firestore:", error);

            // Fallback a localStorage
            try {
                const backupConfig = localStorage.getItem('userConfig_backup');
                if (backupConfig) {
                    const config = JSON.parse(backupConfig);
                    debugLog(" Configuration loaded from localStorage backup:", config);
                    applyConfigurationToForm(config);
                    window._settingsFormLoaded = true;
                    return config;
                } else {
                    showConfigMessage("No hay configuración guardada", "error");
                }
            } catch (backupError) {
                debugLog(" Error loading backup configuration:", backupError);
                showConfigMessage(" Error al cargar configuración", "error");
            }
        })
        .finally(() => { window._settingsLoading = false; });
}

// 8. FUNCION AUXILIAR PARA APLICAR CONFIGURACIÃ“N AL FORMULARIO
function applyConfigurationToForm(config) {
    if (!config) return;

    try {
        // Aplicar valores a campos de texto/número
        const fields = [
            ['vehicleType', config.vehicleType],
            ['businessName', config.businessName],
            ['operatingState', config.operatingState],
            ['vehiclePayment', config.vehiclePayment],
            ['insurance', config.insurance],
            ['licenses', config.licenses],
            ['otherFixed', config.otherFixed],
            ['lodgingMonthly', config.lodgingMonthly ?? 0],
            ['fuelMPG', config.fuelMPG],
            ['fuelPricePerGallon', config.fuelPricePerGallon],
            ['fuelType', config.fuelType || (['boxtruck', 'semi', 'hotshot'].includes(config.vehicleType) ? 'diesel' : 'gasoline')],
            ['fuelPriceAdjust', config.fuelPriceAdjust ?? 0],
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
                debugLog(` Loaded ${fieldId} = ${value}`);
            }
        });

        validateVariableCosts(true);

        // Aplicar checkboxes
        const useRealCostsEl = document.getElementById('useRealCosts');
        if (useRealCostsEl && config.useRealCosts !== undefined) {
            useRealCostsEl.checked = config.useRealCosts;
        }

        const realCostsPeriodEl = document.getElementById('realCostsPeriod');
        if (realCostsPeriodEl && config.realCostsPeriod) {
            realCostsPeriodEl.value = config.realCostsPeriod;
        }

        // Recalcular después de cargar
        setTimeout(() => {
            calculateFuelCost();
            calculateTotals();
        }, 100);

        // Cuando el motor de costos termine, recalcular el resumen con las millas reales
        if (window.CPMEngine?.getCPM) {
            window.CPMEngine.getCPM().then(() => calculateTotals()).catch(() => {});
        }

        // Sin aviso al usuario: era un mensaje tecnico en cada visita
        debugLog(`Configuracion cargada (${fieldsLoaded} campos)`);

    } catch (error) {
        debugLog(" Error applying configuration to form:", error);
        showConfigMessage(" Error al aplicar configuración", "error");
    }
}

// 9. FUNCION PARA CARGAR CONFIGURACIONES DESDE FIREBASE (COMPATIBILIDAD)
function loadSettings() {
    debugLog(" Loading settings (legacy function)...");
    return loadUserConfiguration();
}

// 10. CONFIGURACIÃ“N DE EVENT LISTENERS
function setupSettingsEventListeners() {
    debugLog(" Setting up settings event listeners...");

    // Event listeners para cálculos automáticos
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

    // Event listener para cambio de tipo de vehículo
    const vehicleTypeSelect = document.getElementById('vehicleType');
    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener('change', function () {
            // No auto-aplicar plantilla, solo cuando el usuario haga clic en el botón
            debugLog(`Vehicle type changed to: ${this.value}`);
        });
    }

    debugLog(" Settings event listeners configured");
}

// 11. INICIALIZACION
function initializeSettings() {
    debugLog(" Initializing settings...");

    setupSettingsEventListeners();

    // Cargar configuración si hay usuario
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

    debugLog(" Settings initialized");
}

// 12. EXPONER FUNCIONES GLOBALMENTE
window.showConfigMessage = showConfigMessage;
window.calculateFuelCost = calculateFuelCost;
window.calculateTotals = calculateTotals;
window.loadVehicleTemplate = loadVehicleTemplate;
window.saveUserConfiguration = saveUserConfiguration;
window.loadUserConfiguration = loadUserConfiguration;
window.loadSettings = loadSettings; // Compatibilidad
window.initializeSettings = initializeSettings;

// 13. AUTO-INICIALIZACIÃ“N
document.addEventListener('DOMContentLoaded', () => {
    initializeOnce('settings-initialize', () => {
        setTimeout(() => {
            initializeSettings();
        }, 1000);
    });
});

// Event listener cuando el usuario se autentica
document.addEventListener('userStateChanged', function (event) {
    const { user } = event.detail || {};
    if (user) {
        setTimeout(() => {
            loadUserConfiguration();
        }, 1000);
    }
});

debugLog(" Settings.js loaded successfully - Complete version with all functionality");
// ==============================================
// SECCI�N DE ADMINISTRACI�N
// ==============================================

/**
 * Inicializar bot�n de admin en Settings
 * Llamar esta funci�n cuando se carga la p�gina de Settings
 */
async function initializeAdminSection() {
    // Verificar si el m�dulo AdminPanel est� disponible
    if (!window.AdminPanel) {
        debugLog('AdminPanel no est� cargado');
        return;
    }

    try {
        const hasAccess = await AdminPanel.canAccessAdminPanel();

        if (!hasAccess) {
            debugLog('Usuario no tiene acceso admin');
            return;
        }

        // Agregar bot�n de admin
        await AdminPanel.addAdminButtonToSettings();

    } catch (error) {
        debugLog('Error inicializando secci�n admin:', error);
    }
}

// Ejecutar cuando se muestra el tab de Settings
document.addEventListener('DOMContentLoaded', function () {
    // Si estamos en el tab de settings, inicializar admin
    const settingsObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.target.id === 'settingsTab' &&
                !mutation.target.classList.contains('hidden')) {
                initializeAdminSection();
            }
        });
    });

    const settingsTab = document.getElementById('settingsTab');
    if (settingsTab) {
        settingsObserver.observe(settingsTab, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Tambi�n ejecutar inmediatamente si Settings est� visible
        if (!settingsTab.classList.contains('hidden')) {
            initializeAdminSection();
        }
    }
});

// ==============================================
// FIN SECCI�N DE ADMINISTRACI�N
// ==============================================
