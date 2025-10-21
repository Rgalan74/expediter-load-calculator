// âœ… tabs.js - VersiÃ³n CORREGIDA - Abre Calculator por defecto

// âœ… Activar tab CALCULATOR por defecto
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const defaultTab = document.querySelector('[data-tab="calculator"]');
    if (defaultTab) {
      defaultTab.click();
      console.log("ðŸ“Š Tab por defecto: Calculadora");
    }
  }, 800);
});


function checkMainJsAvailability() {
  // âœ… Verificar mÃºltiples veces si main.js estÃ¡ disponible
  let attempts = 0;
  const maxAttempts = 5;
  
  const checkInterval = setInterval(() => {
    attempts++;
    
    // âœ… Verificar TODAS las condiciones necesarias
    if (typeof window.openTab === 'function' && 
        window.mainJsReady === true && 
        window.functionsReady === true) {
      console.log("âœ… Main.js is handling tabs, tabs.js will not interfere");
      clearInterval(checkInterval);
      return;
    }
    
    if (attempts >= maxAttempts) {
      console.log("ðŸ”— Main.js not available after multiple attempts, setting up fallback tab functionality");
      clearInterval(checkInterval);
      setupFallbackTabs();
    } else {
      console.log(`ðŸ”— Attempt ${attempts}/${maxAttempts} - Main.js not ready yet, waiting...`);
    }
  }, 200); // Verificar cada 200ms
}

// âœ… FunciÃ³n fallback solo si main.js no estÃ¡ disponible
function setupFallbackTabs() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  if (tabLinks.length === 0) {
    console.warn("No se encontraron elementos .tab-link");
    return;
  }

  console.log("ðŸ”— Setting up fallback tab functionality");

  tabLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const selectedTab = link.getAttribute("data-tab");
      
      if (!selectedTab) {
        console.warn("Tab link sin data-tab:", link);
        return;
      }

      console.log(`ðŸ”— Fallback tab switching to: ${selectedTab}`);

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
        console.warn(`No se encontrÃ³ elemento con id: ${selectedTab}`);
      }
      
      // âœ… INTENTAR CARGAR DATOS usando funciones globales si existen
      setTimeout(() => {
        tryLoadTabData(selectedTab);
      }, 100);
    });
  });

  console.log("âœ… Fallback tab functionality configured");
  
  // âœ… CAMBIO PRINCIPAL: Activar tab CALCULATOR por defecto en modo fallback
  const defaultTab = document.querySelector('[data-tab="calculator"]');
  if (defaultTab) {
    console.log("ðŸ”— Activating default tab: CALCULATOR (fallback mode)");
    defaultTab.click();
  }
}

// âœ… NUEVA FUNCIÃ“N - Intentar cargar datos de tab en modo fallback
function tryLoadTabData(tabId) {
  console.log(`ðŸ“‚ Trying to load data for tab: ${tabId} (fallback mode)`);

  try {
    switch (tabId) {
      case 'calculator':
        console.log("ðŸ“Š Calculator tab - no data loading needed");
        break;

      case 'history':
        if (typeof window.getLoadHistory === 'function') {
          console.log("ðŸ“‹ Loading history data via global function");
          window.getLoadHistory();
        }
        break;

          case 'zones':
        if (typeof window.loadZonesData === 'function') {
          console.log("ðŸ—ºï¸ Loading zones data via global function");
          window.loadZonesData();
        }
        break;

      case 'settings':
        if (typeof window.loadSettings === 'function') {
          console.log("âš™ï¸ Loading settings via global function");
          window.loadSettings();
        }
        break;

      // ðŸš« IMPORTANTE: eliminamos los case de finances-summary / reports / accounts
      // porque ahora esos estÃ¡n manejados SOLO en main.js

      default:
        console.log(`No specific handler for tab: ${tabId} (fallback mode)`);
    }
  } catch (error) {
    console.error(`âŒ Error loading data for tab ${tabId} in fallback mode:`, error);
  }
}

console.log("âœ… Tabs.js CLEAN VERSION - Fallback only, Calculator default");
