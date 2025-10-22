// âœ… main.js - VERSIÃ“N CORREGIDA SIN BUCLE INFINITO

// Estado global de la aplicaciÃ³n
let appState = {
  currentTab: 'calculator',
  isLoading: false
};
// Control para evitar repeticiÃ³n de debug
window.hasDebuggedFinances = false;

// ✅ HELPER FUNCTION - Esperar a que una función esté disponible (resuelve race conditions)
function waitForFunction(funcName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let attempts = 0;
    
    const check = () => {
      attempts++;
      const elapsed = Date.now() - start;
      
      if (typeof window[funcName] === 'function') {
        console.log(`✅ [MAIN] Function '${funcName}' available after ${attempts} attempts (${elapsed}ms)`);
        resolve();
      } else if (elapsed > timeout) {
        console.warn(`⚠️ [MAIN] Timeout: '${funcName}' not available after ${timeout}ms`);
        reject(new Error(`Timeout waiting for ${funcName}`));
      } else {
        setTimeout(check, 50); // Revisar cada 50ms
      }
    };
    
    check();
  });
}

// âœ… FUNCIÃ“N PRINCIPAL - openTab (MEJORADA)
function openTab(tabId) {
  console.log(`ðŸ”„ [MAIN] Opening tab: ${tabId}`);
  
  try {
    if (appState.isLoading) {
      console.log("[MAIN] App is loading, ignoring tab change");
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
      console.log(`âœ… [MAIN] Tab ${tabId} activated`);
    } else {
      console.error(`âŒ [MAIN] Tab element not found: ${tabId}`);
      return;
    }

    // âœ… CARGAR DATOS CON VERIFICACIÃ“N DE USUARIO
    if (window.currentUser) {
      loadTabData(tabId);
    } else {
      console.warn(`âš ï¸ [MAIN] No user available for tab ${tabId}, will load when user is ready`);
    }
    
  } catch (error) {
    console.error(`âŒ [MAIN] Error opening tab ${tabId}:`, error);
    showMessage("Error al cambiar de pestaÃ±a", "error");
  }
}

// âœ… FUNCIÃ“N MEJORADA - Cargar datos de tab
async function loadTabData(tabId) {
  console.log(`ðŸ“‚ [MAIN] Loading data for tab: ${tabId}`);
  
  // Verificar que la tab estÃ© visible
  const tabElement = document.getElementById(tabId);
  if (!tabElement || tabElement.classList.contains('hidden')) {
    console.log(`âš ï¸ [MAIN] Tab ${tabId} not visible, skipping data load`);
    return;
  }

  if (!window.currentUser && tabId !== 'calculator') {
    console.log(`âš ï¸ [MAIN] No user available for ${tabId}, skipping data load`);
    return;
  }

  try {
    switch (tabId) {
      case 'calculator':
        console.log("ðŸ“Š [MAIN] Calculator tab - no data loading needed");
        break;
        
      case 'history':
        console.log("ðŸ“‹ [MAIN] Loading history data...");
        if (typeof getLoadHistory === 'function') getLoadHistory();
        break;

      case 'finances':
        console.log("💰 [MAIN] Tab Finanzas abierta, activando Resumen...");
        initPeriodSelectors("global");

        // ✅ La carga de datos ahora usa caché inteligente
        const y = document.getElementById('yearSelect')?.value;
        const m = document.getElementById('monthSelect')?.value;
        const period = (y && m) ? `${y}-${String(m).padStart(2,'0')}` : "all";

        // ✅ SOLUCIÓN RACE CONDITION: Esperar a que loadFinancesData esté disponible
        try {
          console.log("💰 [MAIN] Esperando loadFinancesData...");
          await waitForFunction('loadFinancesData', 5000);
          
          console.log("💰 [MAIN] Auto-cargando Finanzas con período:", period);
          const result = await window.loadFinancesData(period);
          
          updateFinancialKPIs(result.kpis);
          updateExpenseCategories();
          renderExpensesList(result.expenses);
          updateFinancialCharts("global");
          updateBusinessMetrics();
          
          console.log("✅ [MAIN] Datos financieros cargados exitosamente");
        } catch (err) {
          console.error("❌ [MAIN] Error cargando datos financieros:", err);
          if (typeof showMessage === 'function') {
            showMessage("Error al cargar datos financieros. Por favor recarga la página.", "error");
          }
        }
        break;

      case 'reports':
        console.log("ðŸ§¾ [MAIN] Opening Finances REPORTS tab");
        setTimeout(() => {
          initPeriodSelectors("reports");
          if (typeof generatePLReport === "function") generatePLReport();
        }, 200);
        break;

      case 'accounts':
        console.log("ðŸ’µ [MAIN] Opening Finances ACCOUNTS tab");
        setTimeout(() => {
          initPeriodSelectors("accounts");
          if (typeof loadAccountsData === "function") loadAccountsData();
        }, 200);
        break;

      case 'zones':
        console.log("ðŸ—ºï¸ [MAIN] Loading zones data...");
        if (typeof loadZonesData === 'function') loadZonesData();
        break;

      case 'settings':
        console.log("âš™ï¸ [MAIN] Loading settings...");
        if (typeof loadSettings === 'function') loadSettings();
        break;

      default:
        console.log(`ðŸ¤· [MAIN] No specific handler for tab: ${tabId}`);
    }
  } catch (error) {
    console.error(`âŒ [MAIN] Error loading data for tab ${tabId}:`, error);
    if (typeof showMessage === 'function') {
      showMessage(`Error cargando ${tabId}`, "error");
    }
  }
}



// âœ… Setup navegaciÃ³n
function setupNavigation() {
  console.log("ðŸš€ [MAIN] Setting up navigation");
  
  const tabButtons = document.querySelectorAll(".tab-link, .tab-btn:not(.dropdown-finanzas .tab-btn)");
  
  tabButtons.forEach((btn) => {
    const tabId = btn.getAttribute("data-tab");

    // ðŸ‘‰ Si no tiene data-tab, ignorar el botÃ³n (ej: Finanzas â–¾)
    if (!tabId) {
      console.log("[MAIN] Tab button missing data-tab attribute, skipping:", btn);
      return;
    }

    btn.addEventListener("click", (e) => {
  e.preventDefault();
  console.log(`ðŸ”˜ [MAIN] Tab button clicked: ${tabId}`);
  
  // Actualizar estado visual
  updateTabButtonState(btn);
  
  // Abrir la tab correspondiente
  openTab(tabId);

  // âœ… Si el botÃ³n pertenece al menÃº desplegable de Finanzas â†’ cerrar menÃº
  const dropdown = document.querySelector(".dropdown-finanzas");
  if (dropdown && dropdown.contains(btn)) {
    dropdown.classList.add("hidden");
    console.log("ðŸ“‚ [MAIN] Dropdown de Finanzas cerrado tras seleccionar:", tabId);
  }
  if (btn.classList.contains("tab-btn")) {
  const parentDropdown = btn.closest(".dropdown-finanzas");
  if (parentDropdown) {
    parentDropdown.querySelectorAll(".tab-btn").forEach((subBtn) => {
      subBtn.classList.remove("bg-blue-50", "text-blue-600", "font-bold");
    });
    btn.classList.add("bg-blue-50", "text-blue-600", "font-bold");
  }
}

});

  });

  console.log("âœ… [MAIN] Navigation setup completed");
}
// âœ… Toggle para el menÃº de Finanzas usando posiciÃ³n FIXED
document.addEventListener("DOMContentLoaded", () => {
  const finanzasBtn = document.getElementById("finanzasMenuBtn");
  const dropdown = document.querySelector(".dropdown-finanzas");

  if (finanzasBtn && dropdown) {
    finanzasBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Calcular posiciÃ³n bajo el botÃ³n
      const rect = finanzasBtn.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + 5}px`; // 5px de espacio
      dropdown.style.left = `${rect.left}px`;

      dropdown.classList.toggle("hidden");
    });

    // ðŸ‘‰ Cerrar al hacer click fuera
    document.addEventListener("click", (e) => {
      if (!finanzasBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }
});



function updateTabButtonState(activeButton) {
  // Remover estado activo de todos los botones
  document.querySelectorAll(".tab-link").forEach((b) => {
    b.classList.remove("text-blue-600", "font-bold");
    b.classList.add("text-gray-700");
  });
  
  // Activar el botÃ³n seleccionado
  activeButton.classList.remove("text-gray-700");
  activeButton.classList.add("text-blue-600", "font-bold");
}

// âœ… Setup del logout button
function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      console.log("ðŸšª [MAIN] Logging out...");
      
      try {
        if (auth) {
          await auth.signOut();
          console.log("âœ… [MAIN] User signed out successfully");
          window.location.href = 'auth.html';
        }
      } catch (error) {
        console.error("âŒ [MAIN] Error signing out:", error);
        showMessage("Error al cerrar sesiÃ³n", "error");
      }
    });
    console.log("âœ… [MAIN] Logout button configured");
  }
}

// âœ… Setup inicial de la app
function setupInitialApp() {
  console.log("ðŸš€ [MAIN] Setting up initial app...");
  
  try {
    setupNavigation();
    setupLogout();
    
    // Setup tab inicial (calculadora)
    const defaultBtn = document.querySelector('[data-tab="calculator"]');
    if (defaultBtn) {
      updateTabButtonState(defaultBtn);
      openTab("calculator");
      console.log("ðŸš€ [MAIN] Tab inicial abierta: calculator");
    }
    
    console.log("âœ… [MAIN] Initial app setup completed");
  } catch (error) {
    console.error("âŒ [MAIN] Error during app setup:", error);
  }
  // âœ… Avisar que main.js ya terminÃ³ de inicializar
window.mainJsReady = true;
document.dispatchEvent(new Event("mainJsReady"));
if (typeof debugLog === "function") {
  debugLog("ðŸš€ mainJsReady disparado desde main.js");
} else {
  console.log("ðŸš€ mainJsReady disparado desde main.js");
}


}

// âœ… FUNCIÃ“N MEJORADA - loadInitialData
function loadInitialData() {
  console.log("ðŸ”„ [MAIN] Loading initial data after authentication");
  
  if (window.currentUser && appState.currentTab) {
    console.log(`ðŸ“‚ [MAIN] Loading data for current tab: ${appState.currentTab}`);
    loadTabData(appState.currentTab);
  } else {
    console.warn("âš ï¸ [MAIN] Cannot load initial data:", {
      user: !!window.currentUser,
      currentTab: appState.currentTab
    });
  }
}

// âœ… FUNCIÃ“N DE DEBUG SIMPLIFICADA (ADAPTADA A 3 SUBTABS)
function debugFinancesSetup() {
  console.log("ðŸ” [MAIN] === DEBUGGING FINANCES SETUP ===");
  console.log("ðŸ“‹ DOM elements check:");
  
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

    // KPIs y grÃ¡ficos
    'totalRevenue', 
    'totalExpenses', 
    'netProfit',
    'profitMarginPercent',
    'cashFlowChart',
    'expenseBreakdownChart'
  ];
  
  criticalElements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`  ${id}: ${element ? 'âœ… Found' : 'âŒ Missing'}`);
  });
  
  console.log("ðŸ”§ Functions check:");
  console.log(`  loadFinancesData: ${typeof loadFinancesData}`);
  console.log(`  firebase: ${typeof firebase}`);
  console.log(`  Chart: ${typeof Chart}`);
  
  console.log("ðŸ‘¤ User check:");
  console.log(`  currentUser: ${window.currentUser?.email || 'null'}`);
  
  console.log("=====================================");
}

// âœ… Event listeners para refrescar cuando se guarde una carga
document.addEventListener('loadSaved', () => {
  console.log("ðŸ”„ [MAIN] Load saved, refreshing current tab data");
  if (window.currentUser && appState.currentTab) {
    loadTabData(appState.currentTab);
  }
});

// âœ… NUEVO EVENT LISTENER - Cuando el usuario se autentica
document.addEventListener('userStateChanged', (event) => {
  const { user } = event.detail || {};
  console.log("ðŸ‘¤ [MAIN] User state changed:", user?.email || 'logged out');
  
  if (user) {
    console.log("âœ… [MAIN] User authenticated, loading current tab data");
    setTimeout(() => {
      loadInitialData();
    }, 1000);
  }
});

// âœ… InicializaciÃ³n cuando DOM estÃ© listo
document.addEventListener("DOMContentLoaded", () => {
  console.log("ðŸš€ [MAIN] DOM loaded - Setting up app");
  
  // Setup inmediato
  setupInitialApp();
});

// âœ… Debug utilities MEJORADAS (SIN BUCLES)
window.appState = appState;
window.debugApp = () => {
  console.log("ðŸ› [MAIN] Debug:", {
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

// Comentar o eliminar esta funciÃ³n que estÃ¡ en bucle infinito
/*
window.debugFinances = () => {
  if (!window.hasDebuggedFinances) {
    debugFinancesSetup();
    window.hasDebuggedFinances = true;
  }
  console.log("Manual debug completed. To load finances manually, run:");
  console.log("window.loadFinancesData()");
};
*/


// âœ… FUNCIÃ“N MANUAL PARA CARGAR FINANZAS
window.manualLoadFinances = () => {
  if (typeof loadFinancesData === 'function' && window.currentUser) {
    console.log("ðŸ§ª [MAIN] Manual finances load...");
    loadFinancesData();
  } else {
    console.error("âŒ [MAIN] Cannot load finances manually:", {
      function: typeof loadFinancesData,
      user: !!window.currentUser
    });
  }
};

// âœ… SubmenÃº interno de Finanzas
document.addEventListener("DOMContentLoaded", () => {
  const subtabButtons = document.querySelectorAll(".fin-subtab");
  const subtabContents = document.querySelectorAll(".fin-subcontent");

function activateSubtab(target) {
  console.log("ðŸ”Ž DEBUG activateSubtab â†’ target:", target);

  // Resetear botones
  subtabButtons.forEach(b => b.classList.remove("bg-blue-100", "font-semibold"));
  const btn = document.querySelector(`.fin-subtab[data-subtab='${target}']`);
  if (btn) {
    btn.classList.add("bg-blue-100", "font-semibold");
  }

  // Mostrar solo el contenido seleccionado
  subtabContents.forEach(c => c.classList.add("hidden"));
  const content = document.getElementById(`finances-${target}`);
  console.log("ðŸ“Œ DEBUG subtab content:", content);
  if (content) {
    content.classList.remove("hidden");
  }

  console.log(`ðŸ“‚ [FINANCES] Subtab activado: ${target}`);

  if (target === "summary") {
  console.log("ðŸ’° [FINANCES] Entrando a summary");
  initPeriodSelectors("global");
  setTimeout(() => {
    console.log("ðŸ’° [FINANCES] Ejecutando loadFinancesData desde summary");
    window.loadFinancesData?.("all");
  }, 200);
}


  if (target === "reports") {
    console.log("ðŸ§¾ [FINANCES] Entrando a reports");
    initPeriodSelectors("reports");
    if (typeof generatePLReport === "function") {
      generatePLReport();
    } else {
      console.warn("âš ï¸ generatePLReport no existe");
    }
  }

  if (target === "accounts") {
    console.log("ðŸ’µ [FINANCES] Entrando a accounts");
    initPeriodSelectors("accounts");
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    } else {
      console.warn("âš ï¸ loadAccountsData no existe");
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

  // âœ… Mostrar "Resumen" por defecto al entrar en Finanzas
  document.addEventListener("financesOpened", () => {
    activateSubtab("summary");
  });
});
