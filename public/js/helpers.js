// ✅ helpers.js - Script normal sin ES6 modules

// ✅ Funciones de utilidad globales

function formatAmount(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "0.00";
  }
  return parseFloat(amount).toFixed(2);
}

function updateElement(id, value) {
  console.log("🟢 updateElement ejecutada desde helpers.js con id:", id, "valor:", value);
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    return true;
  } else {
    console.warn(`Element not found: ${id}`);
    return false;
  }
}


function showMessage(message, type = "info", elementId = "globalMessage") {
  const div = document.getElementById(elementId);
  if (!div) {
    console.log(`Message (${type}): ${message}`);
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

  // Auto-hide after 4 seconds
  setTimeout(() => {
    if (div.style.display !== "none") {
      div.style.display = "none";
    }
  }, 4000);
}

function getStateCodeFromName(stateName) {
  const stateMap = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
    'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
    'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND',
    'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'WASHINGTON D.C.': 'DC', 'DISTRICT OF COLUMBIA': 'DC'
  };
  
  if (!stateName || typeof stateName !== 'string') {
    return "";
  }
  
  return stateMap[stateName.toUpperCase()] || "";
}

function getStateCode(location) {
  if (!location || typeof location !== 'string') {
    return "";
  }
  
  const cleaned = location.trim().toUpperCase();
  
  // If it's already a 2-letter state code
  if (/^[A-Z]{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Split by comma and get the last part (usually the state)
  const parts = cleaned.split(',').map(part => part.trim());
  if (parts.length >= 2) {
    const statePart = parts[parts.length - 1];
    
    // Check if it's already a state code
    if (/^[A-Z]{2}$/.test(statePart)) {
      return statePart;
    }
    
    // Try to convert from state name
    return getStateCodeFromName(statePart);
  }
  
  // If no comma, try to convert the whole string as a state name
  return getStateCodeFromName(cleaned);
}

function showHistoryMessage(message, type = "info") {
  showMessage(message, type, "historyMessage");
}

function formatDateInput(date) {
  if (!date) return "";
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
}

function formatMonth(date) {
  if (!date) return "";
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch (error) {
    console.error("Error formatting month:", error);
    return "";
  }
}

const CANADIAN_PROVINCES_LIST = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
];

function populateMonthSelector(filteredData = [], selectorId = "monthSelector") {
  const selector = document.getElementById(selectorId);
  if (!selector) {
    console.warn(`Month selector not found: ${selectorId}`);
    return;
  }

  const months = new Set();
  filteredData.forEach(load => {
    if (load.date && typeof load.date === 'string' && load.date.length >= 7) {
      months.add(load.date.substring(0, 7));
    }
  });

  const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
  
  // Clear existing options
  selector.innerHTML = '<option value="all">Todos</option>';
  
  sortedMonths.forEach(month => {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = month;
    selector.appendChild(option);
  });
  
  console.log(`Populated ${selectorId} with ${sortedMonths.length} months`);
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function formatCurrency(amount, currency = 'USD') {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$0.00';
  }
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  } catch (error) {
    return `$${formatAmount(amount)}`;
  }
}

function formatNumber(number, decimals = 0) {
  if (isNaN(number) || number === null || number === undefined) {
    return '0';
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(number);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function isCanadianProvince(code) {
  return CANADIAN_PROVINCES_LIST.includes(code?.toUpperCase());
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function handleError(error, context = '') {
  console.error(`Error in ${context}:`, error);
  
  let message = 'Se produjo un error inesperado';
  
  if (error.code) {
    switch (error.code) {
      case 'permission-denied':
        message = 'No tienes permisos para realizar esta acción';
        break;
      case 'not-found':
        message = 'Los datos solicitados no se encontraron';
        break;
      case 'network-request-failed':
        message = 'Error de conexión. Verifica tu internet';
        break;
      default:
        message = error.message || message;
    }
  } else if (error.message) {
    message = error.message;
  }
  
  showMessage(message, 'error');
  return message;
}

console.log("✅ Helpers.js loaded successfully (normal script)");

async function resolveZipToPlace(zip) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zip}&key=TU_API_KEY`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const postalResult = data.results.find(r => r.types.includes("postal_code"));
      if (postalResult) {
        let city = "";
        let state = "";

        postalResult.address_components.forEach(c => {
          if (c.types.includes("locality")) city = c.long_name; // Ciudad
          if (c.types.includes("administrative_area_level_1")) state = c.short_name; // Estado
        });

        if (city && state) {
          return `${city}, ${state}`;   // 👈 solo Ciudad + Estado
        }
      }
    }
  } catch (err) {
    console.error("❌ Error resolviendo ZIP:", err);
  }
  return zip; // fallback → si falla, al menos devuelve el ZIP
}
// ✅ Verificar cargas del usuario actual
async function checkUserLoads() {
  if (!window.currentUser) {
    console.error("❌ No hay usuario autenticado. Inicia sesión primero.");
    return;
  }

  try {
    const snapshot = await firebase.firestore()
      .collection("loads")
      .where("userId", "==", window.currentUser.uid)
      .get();

    console.log(`📦 Total de cargas para este usuario: ${snapshot.size}`);

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`🔹 ${doc.id} | ${data.origin} ➝ ${data.destination} | Nota: ${data.notes || "—"}`);
    });

  } catch (error) {
    console.error("❌ Error verificando cargas:", error);
  }
}

// 👉 Exponer globalmente para usar desde consola
window.checkUserLoads = checkUserLoads;



