//  main.js - VERSIÍ CORREGIDA SIN BUCLE INFINITO

// Estado global de la aplicación
let appState = {
    currentTab: 'calculator',
    isLoading: false
};
// Control para evitar repetición de debug
window.hasDebuggedFinances = false;

// HELPER FUNCTION - Esperar a que una función esté disponible (resuelve race conditions)
function waitForFunction(funcName, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        let attempts = 0;

        const check = () => {
            attempts++;
            const elapsed = Date.now() - start;

            if (typeof window[funcName] === 'function') {
                debugLog(` [MAIN] Function '${funcName}' available after ${attempts} attempts (${elapsed}ms)`);
                resolve();
            } else if (elapsed > timeout) {
                console.warn(` [MAIN] Timeout: '${funcName}' not available after ${timeout}ms`);
                reject(new Error(`Timeout waiting for ${funcName}`));
            } else {
                setTimeout(check, 50); // Revisar cada 50ms
            }
        };

        check();
    });
}

//  FUNCIÍ PRINCIPAL - openTab (MEJORADA)
function openTab(tabId) {
    debugLog(` [MAIN] Opening tab: ${tabId}`);

    try {
        if (appState.isLoading) {
            debugLog("[MAIN] App is loading, ignoring tab change");
            return;
        }

        // Ocultar todas las tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('tab-active');
            tab.classList.add('hidden');
        });

        // Mostrar la tab seleccionada
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('tab-active');
            targetTab.classList.remove('hidden');
            appState.currentTab = tabId;
            debugLog(` [MAIN] Tab ${tabId} activated`);
        } else {
            console.error(`Â [MAIN] Tab element not found: ${tabId}`);
            return;
        }

        //  CARGAR DATOS CON VERIFICACIÍ DE USUARIO
        if (window.currentUser) {
            loadTabData(tabId);
        } else {
            console.warn(` [MAIN] No user available for tab ${tabId}, will load when user is ready`);
        }

    } catch (error) {
        console.error(`Â [MAIN] Error opening tab ${tabId}:`, error);
        showMessage("Error al cambiar de pestaña", "error");
    }
}

//  FUNCIÍ MEJORADA - Cargar datos de tab
async function loadTabData(tabId) {
    debugLog(` [MAIN] Loading data for tab: ${tabId}`);

    // Verificar que la tab esté visible
    const tabElement = document.getElementById(tabId);
    if (!tabElement || tabElement.classList.contains('hidden')) {
        debugLog(` [MAIN] Tab ${tabId} not visible, skipping data load`);
        return;
    }

    if (!window.currentUser && tabId !== 'calculator') {
        debugLog(` [MAIN] No user available for ${tabId}, skipping data load`);
        return;
    }

    try {
        switch (tabId) {
            case 'calculator':
                debugLog(" [MAIN] Calculator tab - no data loading needed");
                break;

            case 'history':
                debugLog(" [MAIN] Loading history data...");
                if (typeof getLoadHistory === 'function') getLoadHistory();
                break;

            case 'finances':
                debugLog(" [MAIN] Tab Finanzas abierta, activando Resumen...");
                initPeriodSelectors("global");

                // La carga de datos ahora usa caché inteligente
                const y = document.getElementById('yearSelect')?.value;
                const m = document.getElementById('monthSelect')?.value;
                const period = (y && m) ? `${y}-${String(m).padStart(2, '0')}` : "all";

                // SOLUCIÃ“N RACE CONDITION: Esperar a que loadFinancesData esté disponible
                try {
                    debugLog(" [MAIN] Esperando loadFinancesData...");
                    await waitForFunction('loadFinancesData', 5000);

                    debugLog(" [MAIN] Auto-cargando Finanzas con período:", period);
                    const result = await window.loadFinancesData(period);

                    updateFinancialKPIs(result.kpis);
                    updateExpenseCategories();
                    renderExpensesList(result.expenses);
                    updateFinancialCharts("global");
                    updateBusinessMetrics();

                    debugLog(" [MAIN] Datos financieros cargados exitosamente");
                } catch (err) {
                    console.error(" [MAIN] Error cargando datos financieros:", err);
                    if (typeof showMessage === 'function') {
                        showMessage("Error al cargar datos financieros. Por favor recarga la página.", "error");
                    }
                }
                break;

            case 'reports':
                debugLog(" [MAIN] Opening Finances REPORTS tab");
                setTimeout(() => {
                    initPeriodSelectors("reports");
                    // No generar reporte automáticamente - el usuario debe hacer clic en el botón
                }, 200);
                break;

            case 'accounts':
                debugLog(" [MAIN] Opening Finances ACCOUNTS tab");
                setTimeout(() => {
                    initPeriodSelectors("accounts");
                    if (typeof loadAccountsData === "function") loadAccountsData();
                }, 200);
                break;

            case 'zones':
                debugLog(" [MAIN] Loading zones data...");
                if (typeof loadZonesData === 'function') loadZonesData();
                break;

            case 'settings':
                debugLog(" [MAIN] Loading settings...");
                if (typeof loadSettings === 'function') loadSettings();
                break;

            default:
                debugLog(` [MAIN] No specific handler for tab: ${tabId}`);
        }
    } catch (error) {
        console.error(`Â [MAIN] Error loading data for tab ${tabId}:`, error);
        if (typeof showMessage === 'function') {
            showMessage(`Error cargando ${tabId}`, "error");
        }
    }
}



//  Setup navegación
function setupNavigation() {
    debugLog(" [MAIN] Setting up navigation");

    const tabButtons = document.querySelectorAll(".tab-link, .tab-btn:not(.dropdown-finanzas .tab-btn)");

    debugLog(` [MAIN] Found ${tabButtons.length} tab buttons`);

    tabButtons.forEach((btn) => {
        const tabId = btn.getAttribute("data-tab");

        //  Si no tiene data-tab, ignorar el botón (ej: Finanzas 
        if (!tabId) {
            debugLog("[MAIN] Tab button missing data-tab attribute, skipping:", btn);
            return;
        }

        // Remover listeners previos para evitar duplicados
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            debugLog(` [MAIN] Tab button clicked: ${tabId}`);

            // Actualizar estado visual
            updateTabButtonState(newBtn);

            // Abrir la tab correspondiente
            openTab(tabId);

            // Cerrar menú móvil si está abierto
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('scale-y-100', 'opacity-100');
                mobileMenu.classList.add('scale-y-0', 'opacity-0');
            }

            //  Si el botón pertenece al menú desplegable de Finanzas  cerrar menú
            const dropdown = document.querySelector(".dropdown-finanzas");
            if (dropdown && dropdown.contains(newBtn)) {
                dropdown.classList.add("hidden");
                debugLog(" [MAIN] Dropdown de Finanzas cerrado tras seleccionar:", tabId);
            }
            if (newBtn.classList.contains("tab-btn")) {
                const parentDropdown = newBtn.closest(".dropdown-finanzas");
                if (parentDropdown) {
                    parentDropdown.querySelectorAll(".tab-btn").forEach((subBtn) => {
                        subBtn.classList.remove("bg-blue-50", "text-blue-600", "font-bold");
                    });
                    newBtn.classList.add("bg-blue-50", "text-blue-600", "font-bold");
                }
            }

        });

    });

    debugLog(" [MAIN] Navigation setup completed");
}
//  Toggle para el menú de Finanzas usando posición FIXED
document.addEventListener("DOMContentLoaded", () => {
    initializeOnce('main-finances-dropdown', () => {
        const finanzasBtn = document.getElementById("finanzasMenuBtn");
        const dropdown = document.querySelector(".dropdown-finanzas");

        if (finanzasBtn && dropdown) {
            finanzasBtn.addEventListener("click", (e) => {
                e.preventDefault();

                // Calcular posición bajo el botón
                const rect = finanzasBtn.getBoundingClientRect();
                dropdown.style.top = `${rect.bottom + 5}px`; // 5px de espacio
                dropdown.style.left = `${rect.left}px`;

                dropdown.classList.toggle("hidden");
            });

            //  Cerrar al hacer click fuera
            document.addEventListener("click", (e) => {
                if (!finanzasBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add("hidden");
                }
            });
        }
    });
});


function updateTabButtonState(activeButton) {
    // Remover estado activo de todos los botones
    document.querySelectorAll(".tab-link").forEach((b) => {
        b.classList.remove("text-blue-600", "font-bold");
        b.classList.add("text-gray-700");
    });

    // Activar el botón seleccionado
    activeButton.classList.remove("text-gray-700");
    activeButton.classList.add("text-blue-600", "font-bold");
}

//  Setup del logout button
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            debugLog(" [MAIN] Logging out...");

            try {
                if (auth) {
                    await auth.signOut();
                    debugLog(" [MAIN] User signed out successfully");
                    window.location.href = 'auth.html';
                }
            } catch (error) {
                console.error("Â [MAIN] Error signing out:", error);
                showMessage("Error al cerrar sesión", "error");
            }
        });
        debugLog(" [MAIN] Logout button configured");
    }
}

//  Setup inicial de la app
function setupInitialApp() {
    debugLog(" [MAIN] Setting up initial app...");

    try {
        setupNavigation();
        setupLogout();

        // NUEVO: Verificar si hay un hash en la URL (ej: #settings)
        const hash = window.location.hash.substring(1); // Eliminar el #
        let initialTab = 'calculator';

        if (hash && document.getElementById(hash)) {
            initialTab = hash;
            debugLog(` [MAIN] URL hash detected, opening tab: ${hash}`);
        }

        // Setup tab inicial (calculadora o la del hash)
        const defaultBtn = document.querySelector(`[data-tab="${initialTab}"]`);
        if (defaultBtn) {
            updateTabButtonState(defaultBtn);
            openTab(initialTab);
            debugLog(` [MAIN] Tab inicial abierta: ${initialTab}`);
        }

        debugLog(" [MAIN] Initial app setup completed");
    } catch (error) {
        console.error("Â [MAIN] Error during app setup:", error);
    }
    //  Avisar que main.js ya terminó de inicializar
    window.mainJsReady = true;
    document.dispatchEvent(new Event("mainJsReady"));
    if (typeof debugLog === "function") {
        debugLog(" mainJsReady disparado desde main.js");
    } else {
        debugLog(" mainJsReady disparado desde main.js");
    }


}

//  FUNCIÍ MEJORADA - loadInitialData
function loadInitialData() {
    debugLog(" [MAIN] Loading initial data after authentication");

    if (window.currentUser && appState.currentTab) {
        debugLog(` [MAIN] Loading data for current tab: ${appState.currentTab}`);
        loadTabData(appState.currentTab);
    } else {
        console.warn(" [MAIN] Cannot load initial data:", {
            user: !!window.currentUser,
            currentTab: appState.currentTab
        });
    }
}

//  FUNCIÍ DE DEBUG SIMPLIFICADA (ADAPTADA A 3 SUBTABS)
function debugFinancesSetup() {
    debugLog(" [MAIN] === DEBUGGING FINANCES SETUP ===");
    debugLog(" DOM elements check:");

    const criticalElements = [
        // Resumen
        'yearSelect',
        'monthSelect',

        // Reportes
        'reportYear',
        'reportMonth',

        // Cuentas
        'accountsYear',
        'accountsMonth',

        // KPIs y grÍ¡ficos
        'totalRevenue',
        'totalExpenses',
        'netProfit',
        'profitMarginPercent',
        'cashFlowChart',
        'expenseBreakdownChart'
    ];

    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        debugLog(` ${id}: ${element ? ' Found' : 'Â Missing'}`);
    });

    debugLog(" Functions check:");
    debugLog(` loadFinancesData: ${typeof loadFinancesData}`);
    debugLog(` firebase: ${typeof firebase}`);
    debugLog(` Chart: ${typeof Chart}`);

    debugLog(" User check:");
    debugLog(` currentUser: ${window.currentUser?.email || 'null'}`);

    debugLog("=====================================");
}

//  Event listeners para refrescar cuando se guarde una carga
document.addEventListener('loadSaved', () => {
    debugLog(" [MAIN] Load saved, refreshing current tab data");
    if (window.currentUser && appState.currentTab) {
        loadTabData(appState.currentTab);
    }
});

//  NUEVO EVENT LISTENER - Cuando el usuario se autentica
document.addEventListener('userStateChanged', (event) => {
    const { user } = event.detail || {};
    debugLog(" [MAIN] User state changed:", user?.email || 'logged out');

    if (user) {
        debugLog(" [MAIN] User authenticated, loading current tab data");
        setTimeout(() => {
            loadInitialData();
        }, 1000);
    }
});

//  Inicialización cuando DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    initializeOnce('main-setup-app', () => {
        debugLog(" [MAIN] DOM loaded - Setting up app");

        // Setup inmediato
        setupInitialApp();
    });
});

// NUEVO: Escuchar cambios en el hash (para navegación con #)
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
        debugLog(` [MAIN] Hash changed to: ${hash}, switching tab`);
        const btn = document.querySelector(`[data-tab="${hash}"]`);
        if (btn) {
            updateTabButtonState(btn);
            openTab(hash);
        }
    }
});

//  Debug utilities MEJORADAS (SIN BUCLES)
window.appState = appState;
window.debugApp = () => {
    debugLog(" [MAIN] Debug:", {
        currentTab: appState.currentTab,
        currentUser: window.currentUser?.email || 'null',
        availableFunctions: {
            getLoadHistory: typeof getLoadHistory,
            loadDashboardData: typeof loadDashboardData,
            loadFinancesData: typeof loadFinancesData,
            loadZonesData: typeof loadZonesData,
            openTab: typeof openTab
        },
        domElements: {
            financesPeriodSelect: !!document.getElementById('financesPeriodSelect'),
            totalRevenue: !!document.getElementById('totalRevenue'),
            cashFlowChart: !!document.getElementById('cashFlowChart')
        },
        libraries: {
            firebase: typeof firebase,
            Chart: typeof Chart
        }
    });
};

// Comentar o eliminar esta función que estÍ¡ en bucle infinito
/*
window.debugFinances = () => {
 if (!window.hasDebuggedFinances) {
 debugFinancesSetup();
 window.hasDebuggedFinances = true;
 }
 debugLog("Manual debug completed. To load finances manually, run:");
 debugLog("window.loadFinancesData()");
};
*/


//  FUNCION MANUAL PARA CARGAR FINANZAS
window.manualLoadFinances = () => {
    if (typeof loadFinancesData === 'function' && window.currentUser) {
        debugLog(" [MAIN] Manual finances load...");
        loadFinancesData();
    } else {
        console.error("Â [MAIN] Cannot load finances manually:", {
            function: typeof loadFinancesData,
            user: !!window.currentUser
        });
    }
};

//  Submenu interno de Finanzas
document.addEventListener("DOMContentLoaded", () => {
    initializeOnce('main-finances-subtabs', () => {
        const subtabButtons = document.querySelectorAll(".fin-subtab");
        const subtabContents = document.querySelectorAll(".fin-subcontent");

        function activateSubtab(target) {
            debugLog(" DEBUG activateSubtab  target:", target);

            // Resetear botones
            subtabButtons.forEach(b => b.classList.remove("bg-blue-50", "font-semibold"));
            const btn = document.querySelector(`.fin-subtab[data-subtab='${target}']`);
            if (btn) {
                btn.classList.add("bg-blue-50", "font-semibold");
            }

            // Mostrar solo el contenido seleccionado
            subtabContents.forEach(c => c.classList.add("hidden"));
            const content = document.getElementById(`finances-${target}`);
            debugLog(" DEBUG subtab content:", content);
            if (content) {
                content.classList.remove("hidden");
            }

            debugLog(` [FINANCES] Subtab activado: ${target}`);

            if (target === "summary") {
                debugLog(" [FINANCES] Entrando a summary");
                initPeriodSelectors("global");
                setTimeout(() => {
                    debugLog(" [FINANCES] Ejecutando loadFinancesData desde summary");
                    window.loadFinancesData?.("all");
                }, 200);
            }

            if (target === "reports") {
                debugLog(" [FINANCES] Entrando a reports");
                initPeriodSelectors("reports");
                // No generar reporte automáticamente - el usuario debe hacer clic en el botón
            }

            if (target === "accounts") {
                debugLog(" [FINANCES] Entrando a accounts");
                initPeriodSelectors("accounts");
                if (typeof loadAccountsData === "function") {
                    loadAccountsData();
                } else {
                    console.warn(" loadAccountsData no existe");
                }
            }
        }

        // Evento click en botones
        subtabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.getAttribute("data-subtab");
                activateSubtab(target);
            });
        });

        //  Mostrar "Resumen" por defecto al entrar en Finanzas
        document.addEventListener("financesOpened", () => {
            activateSubtab("summary");
        });
    });
});


