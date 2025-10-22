// âœ… helpers.js - Script normal sin ES6 modules

// âœ… Funciones de utilidad globales

function formatAmount(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "0.00";
  }
  return parseFloat(amount).toFixed(2);
}

function updateElement(id, value) {
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
  
  // Split by comma and get parts
  const parts = cleaned.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // Try each part from right to left, skipping "USA", "US", "UNITED STATES"
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      
      // Skip common country identifiers
      if (part === 'USA' || part === 'US' || part === 'UNITED STATES') {
        continue;
      }
      
      // Check if it's a 2-letter state code
      if (/^[A-Z]{2}$/.test(part)) {
        return part;
      }
      
      // Try to convert from state name
      const code = getStateCodeFromName(part);
      if (code) {
        return code;
      }
    }
  }
  
  // If no comma, try to convert the whole string as a state name
  return getStateCodeFromName(cleaned);
}


function showHistoryMessage(message, type = "info") {
  showMessage(message, type, "historyMessage");
}

// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar
// ❌ DEPRECATED - Usar formatDateLocal() en su lugar

function formatMonth(date) {
  if (!date) return "";
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  } catch (error) {
    console.error("Error formatting month:", error);
    return "";
  }
}

// ðŸ†• NUEVA FUNCIÃ“N CENTRALIZADA - NormalizaciÃ³n de fechas de cargas
// Esta funciÃ³n maneja todos los casos posibles de fechas en el sistema
function normalizeLoadDate(loadData) {
  let date = loadData.date;
  
  // Si no hay date, intentar con createdAt
  if (!date && loadData.createdAt) {
    try {
      // Si es un Timestamp de Firestore
      if (typeof loadData.createdAt.toDate === 'function') {
        date = loadData.createdAt.toDate().toISOString().split('T')[0];
      } 
      // Si tiene seconds (formato alternativo de Firestore)
      else if (loadData.createdAt.seconds) {
        date = new Date(loadData.createdAt.seconds * 1000).toISOString().split('T')[0];
      }
      // Si ya es un string
      else if (typeof loadData.createdAt === 'string') {
        date = new Date(loadData.createdAt).toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('âš ï¸ Error normalizando fecha:', e);
      date = new Date().toISOString().split('T')[0];
    }
  }
  
  // Si aÃºn no hay fecha, usar fecha actual
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }
  
  return date;
}

// === UTC Date helpers (robustos para string, Date y Firestore Timestamp) ===
function toDateLikeUTC(value) {
  if (!value) return null;
  if (value instanceof Date) return value;                 // Date
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);                             // ISO string / ms
    return isNaN(d) ? null : d;
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    const d = value.toDate();                              // Firestore Timestamp
    return isNaN(d) ? null : d;
  }
  return null;
}

function getUTCPeriod(value, mode = "month") {
  const d = toDateLikeUTC(value);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (mode === "year") return `${y}`;
  if (mode === "day") return `${y}-${m}-${day}`;
  return `${y}-${m}`;
}

function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "$0.00";
  return `$${Number(value).toFixed(2)}`;
}

// ConversiÃ³n de cÃ³digos de provincia canadiense
function getCanadianProvinceCode(provinceName) {
  const provinceMap = {
    'ALBERTA': 'AB',
    'BRITISH COLUMBIA': 'BC',
    'MANITOBA': 'MB',
    'NEW BRUNSWICK': 'NB',
    'NEWFOUNDLAND AND LABRADOR': 'NL',
    'NORTHWEST TERRITORIES': 'NT',
    'NOVA SCOTIA': 'NS',
    'NUNAVUT': 'NU',
    'ONTARIO': 'ON',
    'PRINCE EDWARD ISLAND': 'PE',
    'QUEBEC': 'QC',
    'SASKATCHEWAN': 'SK',
    'YUKON': 'YT'
  };
  
  if (!provinceName || typeof provinceName !== 'string') {
    return "";
  }
  
  const cleaned = provinceName.trim().toUpperCase();
  
  // If already a 2-letter code, return it
  if (/^[A-Z]{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  return provinceMap[cleaned] || "";
}

// Logging de ayuda para helpers.js

// ========================================
// ✅ NUEVAS FUNCIONES PARA MANEJO CORRECTO DE FECHAS
// ========================================

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando componentes locales
 * Evita problemas de zona horaria al no usar toISOString()
 * @returns {string} Fecha en formato "YYYY-MM-DD"
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte un string de fecha (YYYY-MM-DD) a objeto Date local
 * Evita interpretación incorrecta de zona horaria
 * @param {string} dateStr - Fecha en formato "YYYY-MM-DD"
 * @returns {Date|null} Objeto Date en zona horaria local
 */
function parseDateStringLocal(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  
  // Crear fecha en zona horaria local (no UTC)
  return new Date(year, month - 1, day);
}

/**
 * Formatea un objeto Date a string YYYY-MM-DD usando componentes locales
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha en formato "YYYY-MM-DD" o string vacío si inválida
 */
function formatDateLocal(date) {
  if (!date) return "";
  
  try {
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = parseDateStringLocal(date);
    } else {
      return "";
    }
    
    if (!d || isNaN(d.getTime())) return "";
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
}
console.log('âœ… Helpers.js loaded successfully (normal script)');