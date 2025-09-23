// ✅ main.js - VERSIÓN CORREGIDA SIN BUCLE INFINITO

// Estado global de la aplicación
let appState = {
  currentTab: 'calculator',
  isLoading: false
};
// Control para evitar repetición de debug
window.hasDebuggedFinances = false;

// ✅ FUNCIÓN PRINCIPAL - openTab (MEJORADA)
function openTab(tabId) {
  console.log(`🔄 [MAIN] Opening tab: ${tabId}`);
  
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
      console.log(`✅ [MAIN] Tab ${tabId} activated`);
    } else {
      console.error(`❌ [MAIN] Tab element not found: ${tabId}`);
      return;
    }

    // ✅ CARGAR DATOS CON VERIFICACIÓN DE USUARIO
    if (window.currentUser) {
      loadTabData(tabId);
    } else {
      console.warn(`⚠️ [MAIN] No user available for tab ${tabId}, will load when user is ready`);
    }
    
  } catch (error) {
    console.error(`❌ [MAIN] Error opening tab ${tabId}:`, error);
    showMessage("Error al cambiar de pestaña", "error");
  }
}

// ✅ FUNCIÓN MEJORADA - Cargar datos de tab
function loadTabData(tabId) {
  console.log(`📂 [MAIN] Loading data for tab: ${tabId}`);
  
  // Verificar que la tab esté visible
  const tabElement = document.getElementById(tabId);
  if (!tabElement || tabElement.classList.contains('hidden')) {
    console.log(`⚠️ [MAIN] Tab ${tabId} not visible, skipping data load`);
    return;
  }

  if (!window.currentUser && tabId !== 'calculator') {
    console.log(`⚠️ [MAIN] No user available for ${tabId}, skipping data load`);
    return;
  }

  try {
    switch (tabId) {
      case 'calculator':
        console.log("📊 [MAIN] Calculator tab - no data loading needed");
        break;
        
      case 'history':
        console.log("📋 [MAIN] Loading history data...");
        if (typeof getLoadHistory === 'function') getLoadHistory();
        break;

      case 'finances':
        console.log("💰 [MAIN] Tab Finanzas abierta, activando Resumen...");
        initPeriodSelectors("global");

        const y = document.getElementById('yearSelect')?.value;
        const m = document.getElementById('monthSelect')?.value;
        const period = (y && m) ? `${y}-${String(m).padStart(2,'0')}` : "all";

        if (typeof window.loadFinancesData === "function") {
        console.log("💰 [MAIN] Auto-cargando Finanzas con período:", period);
        window.loadFinancesData(period).then(r => {
        updateFinancialKPIs(r.kpis);
        updateExpenseCategories();
        renderExpensesList(r.expenses);
        updateFinancialCharts("global");   // 👈 forzamos la gráfica
        updateBusinessMetrics();
        }).catch(err => {
        console.error("❌ Error cargando datos financieros:", err);
      });
      }
      break;

      case 'reports':
        console.log("🧾 [MAIN] Opening Finances REPORTS tab");
        setTimeout(() => {
          initPeriodSelectors("reports");
          if (typeof generatePLReport === "function") generatePLReport();
        }, 200);
        break;

      case 'accounts':
        console.log("💵 [MAIN] Opening Finances ACCOUNTS tab");
        setTimeout(() => {
          initPeriodSelectors("accounts");
          if (typeof loadAccountsData === "function") loadAccountsData();
        }, 200);
        break;

      case 'zones':
        console.log("🗺️ [MAIN] Loading zones data...");
        if (typeof loadZonesData === 'function') loadZonesData();
        break;

      case 'settings':
        console.log("⚙️ [MAIN] Loading settings...");
        if (typeof loadSettings === 'function') loadSettings();
        break;

      default:
        console.log(`🤷 [MAIN] No specific handler for tab: ${tabId}`);
    }
  } catch (error) {
    console.error(`❌ [MAIN] Error loading data for tab ${tabId}:`, error);
    if (typeof showMessage === 'function') {
      showMessage(`Error cargando ${tabId}`, "error");
    }
  }
}



// ✅ Setup navegación
function setupNavigation() {
  console.log("🚀 [MAIN] Setting up navigation");
  
  const tabButtons = document.querySelectorAll(".tab-link, .tab-btn:not(.dropdown-finanzas .tab-btn)");
  
  tabButtons.forEach((btn) => {
    const tabId = btn.getAttribute("data-tab");

    // 👉 Si no tiene data-tab, ignorar el botón (ej: Finanzas ▾)
    if (!tabId) {
      console.log("[MAIN] Tab button missing data-tab attribute, skipping:", btn);
      return;
    }

    btn.addEventListener("click", (e) => {
  e.preventDefault();
  console.log(`🔘 [MAIN] Tab button clicked: ${tabId}`);
  
  // Actualizar estado visual
  updateTabButtonState(btn);
  
  // Abrir la tab correspondiente
  openTab(tabId);

  // ✅ Si el botón pertenece al menú desplegable de Finanzas → cerrar menú
  const dropdown = document.querySelector(".dropdown-finanzas");
  if (dropdown && dropdown.contains(btn)) {
    dropdown.classList.add("hidden");
    console.log("📂 [MAIN] Dropdown de Finanzas cerrado tras seleccionar:", tabId);
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

  console.log("✅ [MAIN] Navigation setup completed");
}
// ✅ Toggle para el menú de Finanzas usando posición FIXED
document.addEventListener("DOMContentLoaded", () => {
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

    // 👉 Cerrar al hacer click fuera
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
  
  // Activar el botón seleccionado
  activeButton.classList.remove("text-gray-700");
  activeButton.classList.add("text-blue-600", "font-bold");
}

// ✅ Setup del logout button
function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      console.log("🚪 [MAIN] Logging out...");
      
      try {
        if (auth) {
          await auth.signOut();
          console.log("✅ [MAIN] User signed out successfully");
          window.location.href = 'auth.html';
        }
      } catch (error) {
        console.error("❌ [MAIN] Error signing out:", error);
        showMessage("Error al cerrar sesión", "error");
      }
    });
    console.log("✅ [MAIN] Logout button configured");
  }
}

// ✅ Setup inicial de la app
function setupInitialApp() {
  console.log("🚀 [MAIN] Setting up initial app...");
  
  try {
    setupNavigation();
    setupLogout();
    
    // Setup tab inicial (calculadora)
    const defaultBtn = document.querySelector('[data-tab="calculator"]');
    if (defaultBtn) {
      updateTabButtonState(defaultBtn);
      openTab("calculator");
      console.log("🚀 [MAIN] Tab inicial abierta: calculator");
    }
    
    console.log("✅ [MAIN] Initial app setup completed");
  } catch (error) {
    console.error("❌ [MAIN] Error during app setup:", error);
  }
  // ✅ Avisar que main.js ya terminó de inicializar
window.mainJsReady = true;
document.dispatchEvent(new Event("mainJsReady"));
if (typeof debugLog === "function") {
  debugLog("🚀 mainJsReady disparado desde main.js");
} else {
  console.log("🚀 mainJsReady disparado desde main.js");
}


}

// ✅ FUNCIÓN MEJORADA - loadInitialData
function loadInitialData() {
  console.log("🔄 [MAIN] Loading initial data after authentication");
  
  if (window.currentUser && appState.currentTab) {
    console.log(`📂 [MAIN] Loading data for current tab: ${appState.currentTab}`);
    loadTabData(appState.currentTab);
  } else {
    console.warn("⚠️ [MAIN] Cannot load initial data:", {
      user: !!window.currentUser,
      currentTab: appState.currentTab
    });
  }
}

// ✅ FUNCIÓN DE DEBUG SIMPLIFICADA (ADAPTADA A 3 SUBTABS)
function debugFinancesSetup() {
  console.log("🔍 [MAIN] === DEBUGGING FINANCES SETUP ===");
  console.log("📋 DOM elements check:");
  
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

    // KPIs y gráficos
    'totalRevenue', 
    'totalExpenses', 
    'netProfit',
    'profitMarginPercent',
    'cashFlowChart',
    'expenseBreakdownChart'
  ];
  
  criticalElements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`  ${id}: ${element ? '✅ Found' : '❌ Missing'}`);
  });
  
  console.log("🔧 Functions check:");
  console.log(`  loadFinancesData: ${typeof loadFinancesData}`);
  console.log(`  firebase: ${typeof firebase}`);
  console.log(`  Chart: ${typeof Chart}`);
  
  console.log("👤 User check:");
  console.log(`  currentUser: ${window.currentUser?.email || 'null'}`);
  
  console.log("=====================================");
}

// ✅ Event listeners para refrescar cuando se guarde una carga
document.addEventListener('loadSaved', () => {
  console.log("🔄 [MAIN] Load saved, refreshing current tab data");
  if (window.currentUser && appState.currentTab) {
    loadTabData(appState.currentTab);
  }
});

// ✅ NUEVO EVENT LISTENER - Cuando el usuario se autentica
document.addEventListener('userStateChanged', (event) => {
  const { user } = event.detail || {};
  console.log("👤 [MAIN] User state changed:", user?.email || 'logged out');
  
  if (user) {
    console.log("✅ [MAIN] User authenticated, loading current tab data");
    setTimeout(() => {
      loadInitialData();
    }, 1000);
  }
});

// ✅ Inicialización cuando DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 [MAIN] DOM loaded - Setting up app");
  
  // Setup inmediato
  setupInitialApp();
});

// ✅ Debug utilities MEJORADAS (SIN BUCLES)
window.appState = appState;
window.debugApp = () => {
  console.log("🐛 [MAIN] Debug:", {
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

// Comentar o eliminar esta función que está en bucle infinito
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


// ✅ FUNCIÓN MANUAL PARA CARGAR FINANZAS
window.manualLoadFinances = () => {
  if (typeof loadFinancesData === 'function' && window.currentUser) {
    console.log("🧪 [MAIN] Manual finances load...");
    loadFinancesData();
  } else {
    console.error("❌ [MAIN] Cannot load finances manually:", {
      function: typeof loadFinancesData,
      user: !!window.currentUser
    });
  }
};

// ✅ Submenú interno de Finanzas
document.addEventListener("DOMContentLoaded", () => {
  const subtabButtons = document.querySelectorAll(".fin-subtab");
  const subtabContents = document.querySelectorAll(".fin-subcontent");

function activateSubtab(target) {
  console.log("🔎 DEBUG activateSubtab → target:", target);

  // Resetear botones
  subtabButtons.forEach(b => b.classList.remove("bg-blue-100", "font-semibold"));
  const btn = document.querySelector(`.fin-subtab[data-subtab='${target}']`);
  if (btn) {
    btn.classList.add("bg-blue-100", "font-semibold");
  }

  // Mostrar solo el contenido seleccionado
  subtabContents.forEach(c => c.classList.add("hidden"));
  const content = document.getElementById(`finances-${target}`);
  console.log("📌 DEBUG subtab content:", content);
  if (content) {
    content.classList.remove("hidden");
  }

  console.log(`📂 [FINANCES] Subtab activado: ${target}`);

  if (target === "summary") {
  console.log("💰 [FINANCES] Entrando a summary");
  initPeriodSelectors("global");
  setTimeout(() => {
    console.log("💰 [FINANCES] Ejecutando loadFinancesData desde summary");
    window.loadFinancesData?.("all");
  }, 200);
}


  if (target === "reports") {
    console.log("🧾 [FINANCES] Entrando a reports");
    initPeriodSelectors("reports");
    if (typeof generatePLReport === "function") {
      generatePLReport();
    } else {
      console.warn("⚠️ generatePLReport no existe");
    }
  }

  if (target === "accounts") {
    console.log("💵 [FINANCES] Entrando a accounts");
    initPeriodSelectors("accounts");
    if (typeof loadAccountsData === "function") {
      loadAccountsData();
    } else {
      console.warn("⚠️ loadAccountsData no existe");
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

  // ✅ Mostrar "Resumen" por defecto al entrar en Finanzas
  document.addEventListener("financesOpened", () => {
    activateSubtab("summary");
  });
});





