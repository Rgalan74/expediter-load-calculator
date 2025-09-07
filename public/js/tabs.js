// ✅ tabs.js - Versión CORREGIDA - Abre Calculator por defecto

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔗 Tabs.js DOM loaded - Waiting for main.js to load...");
  
  // ✅ ESPERAR MÁS TIEMPO para que main.js se cargue completamente
  setTimeout(() => {
    checkMainJsAvailability();
  }, 800); // Aumentar delay significativamente
});

function checkMainJsAvailability() {
  // ✅ Verificar múltiples veces si main.js está disponible
  let attempts = 0;
  const maxAttempts = 5;
  
  const checkInterval = setInterval(() => {
    attempts++;
    
    // ✅ Verificar TODAS las condiciones necesarias
    if (typeof window.openTab === 'function' && 
        window.mainJsReady === true && 
        window.functionsReady === true) {
      console.log("✅ Main.js is handling tabs, tabs.js will not interfere");
      clearInterval(checkInterval);
      return;
    }
    
    if (attempts >= maxAttempts) {
      console.log("🔗 Main.js not available after multiple attempts, setting up fallback tab functionality");
      clearInterval(checkInterval);
      setupFallbackTabs();
    } else {
      console.log(`🔗 Attempt ${attempts}/${maxAttempts} - Main.js not ready yet, waiting...`);
    }
  }, 200); // Verificar cada 200ms
}

// ✅ Función fallback solo si main.js no está disponible
function setupFallbackTabs() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  if (tabLinks.length === 0) {
    console.warn("No se encontraron elementos .tab-link");
    return;
  }

  console.log("🔗 Setting up fallback tab functionality");

  tabLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const selectedTab = link.getAttribute("data-tab");
      
      if (!selectedTab) {
        console.warn("Tab link sin data-tab:", link);
        return;
      }

      console.log(`🔗 Fallback tab switching to: ${selectedTab}`);

      // Remover clase activa de todos los links
      tabLinks.forEach(btn => {
        btn.classList.remove("text-blue-600", "font-bold");
        btn.classList.add("text-gray-700");
      });

      // Agregar clase activa al link seleccionado
      link.classList.remove("text-gray-700");
      link.classList.add("text-blue-600", "font-bold");

      // Ocultar todos los contenidos
      tabContents.forEach(tab => {
        tab.classList.add("hidden");
        tab.classList.remove("tab-active");
      });

      // Mostrar el contenido correspondiente
      const activeTab = document.getElementById(selectedTab);
      if (activeTab) {
        activeTab.classList.remove("hidden");
        activeTab.classList.add("tab-active");
      } else {
        console.warn(`No se encontró elemento con id: ${selectedTab}`);
      }
      
      // ✅ INTENTAR CARGAR DATOS usando funciones globales si existen
      setTimeout(() => {
        tryLoadTabData(selectedTab);
      }, 100);
    });
  });

  console.log("✅ Fallback tab functionality configured");
  
  // ✅ CAMBIO PRINCIPAL: Activar tab CALCULATOR por defecto en modo fallback
  const defaultTab = document.querySelector('[data-tab="calculator"]');
  if (defaultTab) {
    console.log("🔗 Activating default tab: CALCULATOR (fallback mode)");
    defaultTab.click();
  }
}

// ✅ NUEVA FUNCIÓN - Intentar cargar datos de tab en modo fallback
function tryLoadTabData(tabId) {
  console.log(`📂 Trying to load data for tab: ${tabId} (fallback mode)`);

  try {
    switch (tabId) {
      case 'calculator':
        console.log("📊 Calculator tab - no data loading needed");
        break;

      case 'history':
        if (typeof window.getLoadHistory === 'function') {
          console.log("📋 Loading history data via global function");
          window.getLoadHistory();
        }
        break;

     case 'dashboard':
       console.log("📊 Opening Dashboard tab");
       updateDashboard("all");
       break;


      case 'zones':
        if (typeof window.loadZonesData === 'function') {
          console.log("🗺️ Loading zones data via global function");
          window.loadZonesData();
        }
        break;

      case 'settings':
        if (typeof window.loadSettings === 'function') {
          console.log("⚙️ Loading settings via global function");
          window.loadSettings();
        }
        break;

      case 'finances':
        if (typeof window.loadFinancesData === 'function') {
          console.log("📊 Loading finances data via global function");
          window.loadFinancesData();
        } else {
          console.warn("❌ loadFinancesData function not available");
        }
        break;

      default:
        console.log(`No specific handler for tab: ${tabId}`);
    }
  } catch (error) {
    console.error(`Error loading data for tab ${tabId} in fallback mode:`, error);
  }
}


console.log("✅ Tabs.js FIXED VERSION - Default tab set to CALCULATOR");