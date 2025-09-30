// ✅ config.js - FIX PARA TIMING DE AUTENTICACIÓN

window.currentUser = null;
window.auth = null;
window.db = null;

// ✅ Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY",
  authDomain: "expediter-dev.firebaseapp.com",
  projectId: "expediter-dev",
  storageBucket: "expediter-dev.appspot.com",
  messagingSenderId: "447653997176",
  appId: "1:447653997176:web:4e356867bb64b488ab5b8d"
};

let authInitialized = false;
let authCheckComplete = false;

// ✅ Debug function
function debugLog(message, data = null) {
  console.log(`🔧 AUTH DEBUG: ${message}`, data || '');
}

// ✅ Función para esperar autenticación
function waitForAuth(callback, maxAttempts = 10) {
  let attempts = 0;
  
  const checkAuth = () => {
    attempts++;
    debugLog(`Verificando auth - Intento ${attempts}/${maxAttempts}`);
    
    if (authCheckComplete) {
      debugLog("✅ Auth check completado, ejecutando callback");
      callback();
    } else if (attempts < maxAttempts) {
      debugLog("⏳ Auth aún no completado, esperando...");
      setTimeout(checkAuth, 500);
    } else {
      debugLog("❌ Auth check timeout, ejecutando callback anyway");
      callback();
    }
  };
  
  checkAuth();
}

// ✅ Inicializar Firebase
function initializeFirebaseAuth() {
  debugLog("🔥 Iniciando Firebase Auth...");
  
  if (typeof firebase === 'undefined') {
    debugLog("⚠️ Firebase no disponible, reintentando...");
    setTimeout(initializeFirebaseAuth, 300);
    return;
  }

  try {
    // Inicializar Firebase si no está ya
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      debugLog("✅ Firebase inicializado");
    }
    
    auth = firebase.auth();
    db = firebase.firestore();

    // ✅ Inicializar Analytics
    let analytics = null;
    try {
    analytics = firebase.analytics();
    window.analytics = analytics;
    console.log('✅ Firebase Analytics inicializado');
    } catch (error) {
    console.warn('⚠️ Analytics no disponible:', error.message);
    }
    
    // ✅ CONFIGURAR PERSISTENCIA EXPLÍCITAMENTE
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {
        debugLog("✅ Persistencia configurada a LOCAL");
        setupAuthListener();
      })
      .catch((error) => {
        debugLog("⚠️ Error configurando persistencia", error);
        setupAuthListener(); // Continuar anyway
      });
    
  } catch (error) {
    debugLog("❌ Error inicializando Firebase", error);
  }
}

// ✅ Función de tracking universal
function trackEvent(eventName, params = {}) {
    const enrichedParams = {
        ...params,
        timestamp: new Date().toISOString(),
        userId: window.currentUser?.uid || 'anonymous'
    };
    
    if (analytics) {
        try {
            analytics.logEvent(eventName, enrichedParams);
            console.log('📊 Analytics:', eventName, enrichedParams);
        } catch (error) {
            console.log('📊 Event (fallback):', eventName, enrichedParams);
        }
    } else {
        console.log('📊 Event:', eventName, enrichedParams);
    }
}

window.trackEvent = trackEvent;

// ✅ Setup del listener de autenticación CON SISTEMA DE PLANES
async function setupAuthListener() {
  debugLog("👂 Configurando auth listener...");
  
  // ✅ TIMEOUT DE SEGURIDAD
  const authTimeout = setTimeout(() => {
    if (!authCheckComplete) {
      debugLog("⏰ Timeout de auth - considerando como no autenticado");
      authCheckComplete = true;
      setCurrentUser(null);
      showLoginScreen();
    }
  }, 5000); // 5 segundos máximo
  
  auth.onAuthStateChanged(async (user) => {
    clearTimeout(authTimeout); // Cancelar timeout
    authCheckComplete = true;
    authInitialized = true;
    
    debugLog("🔄 Auth state changed", user ? `Usuario: ${user.email}` : "No usuario");
    
    if (user) {
      debugLog("✅ Usuario autenticado encontrado", {
        email: user.email,
        uid: user.uid,
        emailVerified: user.emailVerified
      });
      
      setCurrentUser(user);
      
      // ✅ AGREGAR: Cargar plan del usuario
      try {
        debugLog("📋 Cargando plan del usuario...");
        window.userPlan = await getUserPlan(user.uid);
        debugLog("✅ Plan cargado:", window.userPlan.name);
        
        // Inicializar si es usuario nuevo
        if (!window.userPlan.userId) {
          debugLog("🆕 Usuario nuevo, inicializando plan...");
          await initializeUserPlan(user.uid, user.email);
          window.userPlan = await getUserPlan(user.uid);
        }
        
        // Track login event
        if (window.trackEvent) {
          trackEvent('user_login', {
            plan: window.userPlan.id,
            loads_this_month: window.userPlan.loadsThisMonth
          });
        }
        
      } catch (error) {
        debugLog("❌ Error cargando plan:", error);
        // Default a plan gratuito en caso de error
        window.userPlan = window.PLANS?.free || {
          id: 'free',
          name: 'Plan Gratuito',
          limits: { maxLoadsPerMonth: 50, hasFinances: false, hasZones: false }
        };
      }
      
      showAppContent();
      
      // Cargar datos después de mostrar app
      setTimeout(() => {
        loadInitialData();
      }, 1000);
      
    } else {
      debugLog("❌ No hay usuario autenticado");
      setCurrentUser(null);
      window.userPlan = null; // ✅ Limpiar plan
      showLoginScreen();
      
      // Solo redirigir después de un delay si no estamos en auth.html
      if (!window.location.pathname.includes('auth.html')) {
        setTimeout(() => {
          debugLog("🔄 Redirigiendo a auth.html...");
          window.location.href = 'auth.html';
        }, 3000);
      }
    }
  });
}

// ✅ Función para actualizar currentUser
function setCurrentUser(user) {
  window.currentUser = user;
  debugLog("👤 Current user actualizado", user ? user.email : "null");
}

// ✅ Mostrar contenido de la app CON VERIFICACIONES
function showAppContent() {
  debugLog("🖥️ Mostrando contenido de la app...");
  
  // Esperar a que los elementos estén disponibles
  const waitForElements = () => {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    
    if (!loginScreen || !appContent) {
      debugLog("⏳ Esperando elementos DOM...");
      setTimeout(waitForElements, 100);
      return;
    }
    
    loginScreen.classList.add('hidden');
    appContent.classList.remove('hidden');
    
    debugLog("✅ App content mostrado exitosamente");
  };
  
  waitForElements();
}

// ✅ Mostrar pantalla de login
function showLoginScreen() {
  debugLog("🔒 Mostrando pantalla de login...");
  
  const waitForElements = () => {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    
    if (!loginScreen || !appContent) {
      setTimeout(waitForElements, 100);
      return;
    }
    
    appContent.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
    debugLog("✅ Login screen mostrado");
  };
  
  waitForElements();
}

// ✅ Helper function para verificar autenticación
function requireAuth() {
  if (!window.currentUser) {
    throw new Error('User must be authenticated');
  }
  return window.currentUser;
}

// ✅ Función para cargar datos iniciales 
function loadInitialData() {
  debugLog("📂 Cargando datos iniciales...");
  
  if (!window.currentUser) {
    debugLog("❌ No hay usuario para cargar datos");
    return;
  }
  
  // Esperar a que main.js esté listo
  if (typeof window.openTab === 'function') {
    debugLog("✅ main.js disponible, cargando tab data");
    const currentTab = document.querySelector('.tab-link.text-blue-600')?.getAttribute('data-tab') 
      || window.appState.currentTab 
      || 'calculator';
    if (typeof window.loadTabData === 'function') {
      window.loadTabData(currentTab);
    }
  } else {
    debugLog("⏳ Esperando main.js (evento)...");
    document.addEventListener("mainJsReady", () => {
      debugLog("✅ main.js listo, ejecutando loadInitialData...");
      loadInitialData();
    }, { once: true });
  }
}


// ✅ Debug function para verificar estado
function debugAuthState() {
  debugLog("=== ESTADO ACTUAL ===");
  debugLog("Firebase disponible:", typeof firebase !== 'undefined');
  debugLog("Auth inicializado:", authInitialized);
  debugLog("Auth check completo:", authCheckComplete);
  debugLog("Current user:", window.currentUser ? window.currentUser.email : 'null');
  debugLog("Firebase currentUser:", auth?.currentUser ? auth.currentUser.email : 'null');
  debugLog("====================");
}

// ✅ Exponer funciones globalmente
window.requireAuth = requireAuth;
window.debugAuthState = debugAuthState;
window.loadInitialData = loadInitialData;

// ✅ Inicializar cuando DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  debugLog("📋 DOM cargado - Iniciando auth con delay");
  
  // Delay inicial para asegurar que todo esté cargado
  setTimeout(() => {
    initializeFirebaseAuth();
  }, 1000);
});

debugLog("✅ Config.js cargado (versión timing fix)");