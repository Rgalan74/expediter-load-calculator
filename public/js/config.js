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

// debugLog viene de helpers.js (global) — no redefinir aquí


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
      debugLog('✅ Firebase Analytics inicializado');
    } catch (error) {
      debugLog('⚠️ Analytics no disponible:', error.message);
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

  if (window.analytics) {
    try {
      window.analytics.logEvent(eventName, enrichedParams);
      debugLog('📊 Analytics:', eventName, enrichedParams);
    } catch (error) {
      debugLog('📊 Event (fallback):', eventName, enrichedParams);
    }
  } else {
    debugLog('📊 Event:', eventName, enrichedParams);
  }
}

window.trackEvent = trackEvent;

// ✅ Setup del listener de autenticación CON SISTEMA DE PLANES
async function setupAuthListener() {
  debugLog("👂 Configurando auth listener...");

  // ✅ AVISO DE CONEXIÓN LENTA — aparece a los 4s, antes del timeout real
  const slowConnTimeout = setTimeout(() => {
    if (!authCheckComplete) {
      debugLog("⏳ Auth tardando más de lo normal — posible red lenta");
      const loadingScreen = document.getElementById('loadingScreen');
      if (loadingScreen) {
        const msg = loadingScreen.querySelector('.slow-conn-msg');
        if (!msg) {
          const p = document.createElement('p');
          p.className = 'slow-conn-msg';
          p.style.cssText = 'color:#94a3b8;font-size:13px;margin-top:8px;';
          p.textContent = window.i18n?.t('auth.slow_connection') || 'Slow connection detected...';
          loadingScreen.appendChild(p);
        }
      }
    }
  }, 4000);

  // ✅ TIMEOUT DE SEGURIDAD — aumentado a 8s para redes móviles lentas
  const authTimeout = setTimeout(() => {
    if (!authCheckComplete) {
      debugLog("⏰ Timeout de auth - considerando como no autenticado");
      authCheckComplete = true;
      setCurrentUser(null);
      showLoginScreen();
    }
  }, 8000); // 8 segundos (era 5s)

  auth.onAuthStateChanged(async (user) => {
    clearTimeout(authTimeout);   // Cancelar timeout
    clearTimeout(slowConnTimeout); // Cancelar aviso de red lenta
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

      // ✅ AGREGAR: Cargar datos extendidos del perfil (Costos, Preferencias)
      try {
        debugLog("👤 Cargando perfil extendido del usuario...");
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // Inyectar datos en el objeto usuario para acceso global
          user.costs = userData.costs || null;
          user.preferences = userData.preferences || null;
          user.profileData = userData;
          user.role = userData.role || null;
          user.plan = userData.plan || 'free';
          debugLog("✅ Costos y preferencias cargados", user.costs);

          // ✅ FASE 2: Aplicar idioma preferido del usuario (sin 2ª lectura a Firestore)
          if (window.i18n?.applyUserLanguage) {
            window.i18n.applyUserLanguage(userData);
          }
        } else {
          debugLog("⚠️ Perfil no encontrado en Firestore, usando defaults");
        }
      } catch (error) {
        debugLog("❌ Error cargando perfil extendido:", error);
        // Fallback: intentar cargar costs desde localStorage backup
        try {
          const backupConfig = localStorage.getItem('userConfig_backup');
          if (backupConfig) {
            const parsed = JSON.parse(backupConfig);
            if (parsed.costs) {
              user.costs = parsed.costs;
              debugLog("✅ Costs recuperados desde localStorage backup");
            }
          }
        } catch (lsError) {
          debugLog("⚠️ localStorage backup tampoco disponible", lsError);
        }
      }

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
          limits: { maxLoadsPerMonth: 30, hasFinances: false, hasZones: false },
          loadsThisMonth: 0
        };
      }

      showAppContent();

      // Detectar upgrade pendiente
      const pendingPlan = localStorage.getItem('pendingPlan');
      if (pendingPlan) {
        debugLog('🔵 [CONFIG] pendingPlan detectado:', pendingPlan);
        localStorage.removeItem('pendingPlan');
        // Esperar a que StripeIntegration esté disponible (carga después de config.js)
        const checkStripe = setInterval(() => {
          if (window.StripeIntegration) {
            clearInterval(checkStripe);
            debugLog('🔵 [CONFIG] StripeIntegration listo, iniciando checkout:', pendingPlan);
            window.StripeIntegration.createCheckoutSession(pendingPlan);
          }
        }, 500);
        // Safety: dejar de intentar después de 10 segundos
        setTimeout(() => {
          clearInterval(checkStripe);
          if (!window.StripeIntegration) {
            debugLog('❌ [CONFIG] StripeIntegration no disponible después de 10s');
          }
        }, 10000);
      }

      // ✅ INICIALIZAR CPM ENGINE después de cargar la app
      setTimeout(async () => {
        try {
          if (window.CPMEngine) {
            const result = await window.CPMEngine.getCPM();

            // Si hay datos reales, actualizar costs con CPM del engine
            if (result.source === 'real' && window.currentUser) {
              const currentCosts = window.currentUser.costs || {};

              // Distribuir el CPM real proporcionalmente
              // mantenemos combustible de config, ajustamos el resto
              const fuelCPM = currentCosts.combustible || 0.153;
              const remainder = Math.max(0, result.cpm - fuelCPM); // Safety: nunca negativo

              window.currentUser.costs = {
                ...currentCosts,
                costosFijos: parseFloat((remainder * 0.65).toFixed(4)),
                mantenimiento: parseFloat((remainder * 0.35).toFixed(4)),
                comida: 0,
                TOTAL: result.cpm,
                totalCPM: result.cpm,
                source: 'real',
                cpmLabel: result.label
              };

              debugLog('✅ CPM Engine aplicado al calculador:', result.cpm);
            }
          }
        } catch (e) {
          debugLog('⚠️ CPM Engine init error:', e);
        }
      }, 2000); // 2 seg para que carguen todos los módulos

      // Poblar cache global para decisiones user-agnostic
      setTimeout(async () => {
        try {
          const uid = window.currentUser?.uid;
          if (!uid) return;

          // CPM real desde CPMEngine
          if (window.CPMEngine) {
            const cpmResult = await window.CPMEngine.getCPM();
            if (cpmResult?.cpm) window._userCPM = cpmResult.cpm;
          }

          // avgRPM y stateStats desde lexProfiles
          const profileSnap = await firebase.firestore()
            .collection('lexProfiles').doc(uid).get();
          if (profileSnap.exists) {
            const p = profileSnap.data();
            window._userAvgRPM = p.avgRPM || 0;
            window._userStateStats = p.stateStats || {};
          }

          debugLog('✅ Cache user-agnostic listo:', {
            cpm: window._userCPM,
            avgRPM: window._userAvgRPM,
            states: Object.keys(window._userStateStats || {}).length
          });
        } catch (e) {
          debugLog('⚠️ Error poblando cache user-agnostic:', e);
        }
      }, 3000); // 3 seg — después del CPMEngine

      // Cargar datos después de mostrar app
      setTimeout(() => {
        if (typeof window.loadInitialData === 'function') {
          window.loadInitialData();
        } else {
          debugLog('⚠️ [CONFIG] loadInitialData no disponible aún');
        }
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
// ✅ Mostrar contenido de la app CON VERIFICACIONES
function showAppContent() {
  debugLog("🖥️ Mostrando contenido de la app...");

  // Esperar a que los elementos estén disponibles
  let attempts = 0;
  const waitForElements = () => {
    attempts++;
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');

    if (!appContent) {
      if (attempts > 50) {
        debugLog("⏩ Timeout esperando appContent (posible standalone page).");
        return;
      }
      debugLog("⏳ Esperando elementos DOM...");
      setTimeout(waitForElements, 50);
      return;
    }

    // Ocultar loaders/login
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.add('hidden');

    // Mostrar app
    appContent.classList.remove('hidden');
    appContent.classList.add('fade-in'); // Add animation class if available

    debugLog("✅ App content mostrado exitosamente");
  };

  waitForElements();
}

// ✅ Mostrar pantalla de login
// ✅ Mostrar pantalla de login
function showLoginScreen() {
  debugLog("🔒 Mostrando pantalla de login...");

  let attempts = 0;
  const waitForElements = () => {
    attempts++;
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');

    if (!loginScreen) {
      if (attempts > 50) {
        debugLog("⏩ Timeout esperando loginScreen (posible standalone page).");
        return;
      }
      setTimeout(waitForElements, 50);
      return;
    }

    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (appContent) appContent.classList.add('hidden');

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

// loadInitialData es definida en main.js — no duplicar aquí


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
// loadInitialData es definida y expuesta desde main.js

// ✅ Inicializar cuando DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  debugLog("📋 DOM cargado - Iniciando auth Inmediatamente");

  // Iniciar inmediatamente para mejor performance UX
  initializeFirebaseAuth();
});

debugLog("✅ Config.js cargado (versión timing fix)");
