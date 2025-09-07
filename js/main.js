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
  
  // Verificar usuario antes de cargar datos
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
        if (typeof getLoadHistory === 'function') {
          getLoadHistory();
        } else {
          console.warn("❌ [MAIN] getLoadHistory function not available");
        }
        break;
        
      case 'dashboard':
        console.log("📈 [MAIN] Loading dashboard data...");
        setTimeout(() => {
          if (typeof loadDashboardData === 'function') {
            loadDashboardData();
          } else {
            console.warn("❌ [MAIN] loadDashboardData function not available");
          }
        }, 200);
        break;
        
      case 'finances':
        console.log("💰 [MAIN] Loading finances data...");
        setTimeout(() => {
          if (typeof loadFinancesData === 'function') {
            console.log("💰 [MAIN] loadFinancesData function found, executing...");
            
            // Verificar dependencias críticas
            if (typeof firebase === 'undefined') {
              console.error("❌ [MAIN] Firebase not available for finances");
              return;
            }
            
            if (!window.currentUser) {
              console.error("❌ [MAIN] No user available for finances");
              return;
            }
            
            // ✅ VERIFICAR LOS NUEVOS ELEMENTOS DOM (yearSelect y monthSelect)
            const requiredElements = ['totalRevenue', 'totalExpensesSummary', 'netProfit'];
            const missingElements = requiredElements.filter(id => !document.getElementById(id));
            
            if (missingElements.length > 0) {
              console.error("❌ [MAIN] Missing DOM elements for finances:", missingElements);
              console.log("⚠️ [MAIN] Continuando con elementos faltantes...");
            }
            
            console.log("✅ [MAIN] All critical dependencies ready, loading finances data...");
            loadFinancesData();
            if (!window.hasDebuggedFinances) {
  debugFinancesSetup(); // Solo se ejecuta una vez
  window.hasDebuggedFinances = true;
}

          } else {
            console.warn("❌ [MAIN] loadFinancesData function not available");
            console.log("🔍 [MAIN] Available functions:", {
              loadFinancesData: typeof loadFinancesData,
              firebase: typeof firebase,
              currentUser: !!window.currentUser
            });
          }
        }, 500);
        break;
        
      case 'zones':
        console.log("🗺️ [MAIN] Loading zones data...");
        if (typeof loadZonesData === 'function') {
          loadZonesData();
        } else {
          console.warn("❌ [MAIN] loadZonesData function not available");
        }
        break;
        
      case 'settings':
        console.log("⚙️ [MAIN] Loading settings...");
        if (typeof loadSettings === 'function') {
          loadSettings();
        } else {
          console.warn("❌ [MAIN] loadSettings function not available");
        }
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
  
  const tabButtons = document.querySelectorAll(".tab-link");
  
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      
      const tabId = btn.getAttribute("data-tab");
      if (!tabId) {
        console.warn("[MAIN] Tab button missing data-tab attribute");
        return;
      }
      
      console.log(`🔘 [MAIN] Tab button clicked: ${tabId}`);
      
      // Actualizar estado visual
      updateTabButtonState(btn);
      
      // Abrir la tab
      openTab(tabId);
    });
  });

  console.log("✅ [MAIN] Navigation setup completed");
}

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

// ✅ FUNCIÓN DE DEBUG SIMPLIFICADA (SIN BUCLE INFINITO)
function debugFinancesSetup() {
  console.log("🔍 [MAIN] === DEBUGGING FINANCES SETUP ===");
  console.log("📋 DOM elements check:");
  
  const criticalElements = [
    'financesPeriodSelect',
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

// ✅ FUNCIÓN DE DEBUG MANUAL (SIN LLAMAR A LOADFINANCESDATA)
window.debugFinances = () => {
  if (!window.hasDebuggedFinances) {
    debugFinancesSetup();
    window.hasDebuggedFinances = true;
  }

  console.log("🔍 [MAIN] Manual debug completed. To load finances manually, run:");
  console.log("window.loadFinancesData()");
};


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


document.getElementById("menuToggle")?.addEventListener("click", () => {
  const menu = document.getElementById("mobileMenu");
  if (menu) {
    menu.classList.toggle("hidden");
  }
});


// ✅ MARCAR QUE MAIN.JS ESTÁ LISTO
window.mainJsReady = true;
window.functionsReady = true;

console.log("✅ [MAIN] main.js loaded successfully");