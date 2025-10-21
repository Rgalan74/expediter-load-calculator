// âœ… config.js - SISTEMA DE AUTENTICACIÃ“N SIN RACE CONDITIONS
// VersiÃ³n: 2.0 - Basado en Promises + Eventos

// ========================================
// VARIABLES GLOBALES
// ========================================
window.currentUser = null;
window.auth = null;
window.db = null;
window.analytics = null;

// ========================================
// CONFIGURACIÃ“N FIREBASE
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY",
  authDomain: "expediter-dev.firebaseapp.com",
  projectId: "expediter-dev",
  storageBucket: "expediter-dev.appspot.com",
  messagingSenderId: "447653997176",
  appId: "1:447653997176:web:4e356867bb64b488ab5b8d"
};

// ========================================
// AUTH MANAGER CLASS
// ========================================
class AuthManager {
  constructor() {
    this.authReadyPromise = null;
    this.authReadyResolve = null;
    this.firebaseReadyPromise = null;
    this.firebaseReadyResolve = null;
    this.authUnsubscribe = null;
    
    this.createPromises();
    this.debugLog("ðŸ”§ AuthManager creado");
  }
  
  createPromises() {
    // Promise para cuando Firebase estÃ© listo
    this.firebaseReadyPromise = new Promise((resolve) => {
      this.firebaseReadyResolve = resolve;
    });
    
    // Promise para cuando Auth check estÃ© completo
    this.authReadyPromise = new Promise((resolve) => {
      this.authReadyResolve = resolve;
    });
  }
  
  debugLog(message, data = null) {
    console.log(`ðŸ”§ AUTH: ${message}`, data || '');
  }
  
  // Esperar a que Firebase estÃ© disponible
  async waitForFirebase() {
    this.debugLog("ðŸ” Verificando Firebase...");
    
    if (typeof firebase !== 'undefined') {
      this.debugLog("âœ… Firebase ya disponible");
      this.firebaseReadyResolve();
      return true;
    }
    
    // Si no estÃ¡ disponible, esperar con chequeo cada 100ms (mÃ¡ximo 5 segundos)
    let attempts = 0;
    const maxAttempts = 50;
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        attempts++;
        
        if (typeof firebase !== 'undefined') {
          clearInterval(checkInterval);
          this.debugLog("âœ… Firebase detectado!");
          this.firebaseReadyResolve();
          resolve(true);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          this.debugLog("âŒ Firebase timeout");
          reject(new Error("Firebase no disponible despuÃ©s de 5 segundos"));
        }
      }, 100);
    });
  }
  
  // Inicializar Firebase y Auth
  async initializeAuth() {
    this.debugLog("ðŸ”¥ Inicializando Firebase Auth...");
    
    try {
      // Esperar a que Firebase estÃ© disponible
      await this.waitForFirebase();
      
      // Inicializar Firebase si no estÃ¡ ya inicializado
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        this.debugLog("âœ… Firebase App inicializado");
      }
      
      // Referencias globales
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      
      // Inicializar Analytics
      try {
        window.analytics = firebase.analytics();
        this.debugLog("âœ… Firebase Analytics inicializado");
      } catch (error) {
        this.debugLog("âš ï¸ Analytics no disponible:", error.message);
      }
      
      // Configurar persistencia
      await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      this.debugLog("âœ… Persistencia configurada a LOCAL");
      
      // Setup del listener de autenticaciÃ³n
      return this.setupAuthListener();
      
    } catch (error) {
      this.debugLog("âŒ Error inicializando auth:", error);
      throw error;
    }
  }
  
  // Configurar listener de cambios de autenticaciÃ³n
  setupAuthListener() {
    this.debugLog("ðŸ‘‚ Configurando auth listener...");
    
    return new Promise((resolve) => {
      this.authUnsubscribe = window.auth.onAuthStateChanged(async (user) => {
        this.debugLog("ðŸ”„ Auth state changed:", user ? user.email : "No user");
        
        // Actualizar usuario global
        window.currentUser = user;
        
        if (user) {
          // Usuario autenticado
          await this.handleAuthenticatedUser(user);
        } else {
          // No hay usuario
          this.handleUnauthenticatedUser();
        }
        
        // Resolver la promise de auth ready
        this.authReadyResolve({ user, unsubscribe: this.authUnsubscribe });
        
        // Emitir evento global
        const event = new CustomEvent('authReady', { 
          detail: { user } 
        });
        document.dispatchEvent(event);
        
        resolve({ user, unsubscribe: this.authUnsubscribe });
      });
    });
  }
  
  // Manejar usuario autenticado
  async handleAuthenticatedUser(user) {
    this.debugLog("âœ… Usuario autenticado:", {
      email: user.email,
      uid: user.uid,
      emailVerified: user.emailVerified
    });
    
    // Cargar plan del usuario
    try {
      this.debugLog("ðŸ“‹ Cargando plan del usuario...");
      window.userPlan = await getUserPlan(user.uid);
      this.debugLog("âœ… Plan cargado:", window.userPlan.name);
      
      // Inicializar si es usuario nuevo
      if (!window.userPlan.userId) {
        this.debugLog("ðŸ†• Usuario nuevo, inicializando plan...");
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
      this.debugLog("âš ï¸ Error cargando plan:", error);
      // Default a plan gratuito
      window.userPlan = window.PLANS?.free || {
        id: 'free',
        name: 'Plan Gratuito',
        limits: { maxLoadsPerMonth: 50, hasFinances: false, hasZones: false }
      };
    }
    
    // Mostrar contenido de la app
    this.showAppContent();
    
    // Esperar a que main.js estÃ© listo antes de cargar datos
    this.waitForMainJs().then(() => {
      this.debugLog("âœ… main.js listo, cargando datos iniciales...");
      if (typeof window.loadInitialData === 'function') {
        window.loadInitialData();
      }
    });
  }
  
  // Manejar usuario no autenticado
  handleUnauthenticatedUser() {
    this.debugLog("âŒ No hay usuario autenticado");
    window.currentUser = null;
    window.userPlan = null;
    
    this.showLoginScreen();
    
    // Redirigir solo si no estamos en auth.html
    if (!window.location.pathname.includes('auth.html')) {
      this.debugLog("ðŸ”„ Redirigiendo a auth.html en 2 segundos...");
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 2000);
    }
  }
  
  // Esperar a que main.js estÃ© listo
  async waitForMainJs() {
    return new Promise((resolve) => {
      if (window.mainJsReady) {
        this.debugLog("âœ… main.js ya estÃ¡ listo");
        resolve();
      } else {
        this.debugLog("â³ Esperando evento mainJsReady...");
        document.addEventListener("mainJsReady", () => {
          this.debugLog("âœ… Evento mainJsReady recibido");
          resolve();
        }, { once: true });
      }
    });
  }
  
  // Mostrar contenido de la app
  showAppContent() {
    this.debugLog("ðŸ–¥ï¸ Mostrando contenido de la app...");
    
    const waitForElements = () => {
      const loginScreen = document.getElementById('loginScreen');
      const appContent = document.getElementById('appContent');
      
      if (!loginScreen || !appContent) {
        setTimeout(waitForElements, 50);
        return;
      }
      
      loginScreen.classList.add('hidden');
      appContent.classList.remove('hidden');
      
      this.debugLog("âœ… App content visible");
    };
    
    waitForElements();
  }
  
  // Mostrar pantalla de login
  showLoginScreen() {
    this.debugLog("ðŸ”’ Mostrando pantalla de login...");
    
    const waitForElements = () => {
      const loginScreen = document.getElementById('loginScreen');
      const appContent = document.getElementById('appContent');
      
      if (!loginScreen || !appContent) {
        setTimeout(waitForElements, 50);
        return;
      }
      
      appContent.classList.add('hidden');
      loginScreen.classList.remove('hidden');
      
      this.debugLog("âœ… Login screen visible");
    };
    
    waitForElements();
  }
  
  // MÃ©todo pÃºblico para esperar que auth estÃ© listo
  async waitForAuth() {
    this.debugLog("â³ Esperando que auth estÃ© listo...");
    const result = await this.authReadyPromise;
    this.debugLog("âœ… Auth listo:", result.user ? result.user.email : "No user");
    return result;
  }
  
  // Debug del estado actual
  debugState() {
    console.log("=== ðŸ” ESTADO DE AUTENTICACIÃ“N ===");
    console.log("Firebase disponible:", typeof firebase !== 'undefined');
    console.log("Auth inicializado:", !!window.auth);
    console.log("Current user:", window.currentUser ? window.currentUser.email : 'null');
    console.log("User plan:", window.userPlan ? window.userPlan.name : 'null');
    console.log("===================================");
  }
}

// ========================================
// FUNCIÃ“N DE TRACKING UNIVERSAL
// ========================================
function trackEvent(eventName, params = {}) {
  const enrichedParams = {
    ...params,
    timestamp: new Date().toISOString(),
    userId: window.currentUser?.uid || 'anonymous'
  };
  
  if (window.analytics) {
    try {
      window.analytics.logEvent(eventName, enrichedParams);
      console.log('ðŸ“Š Analytics:', eventName, enrichedParams);
    } catch (error) {
      console.log('ðŸ“Š Event (fallback):', eventName, enrichedParams);
    }
  } else {
    console.log('ðŸ“Š Event:', eventName, enrichedParams);
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// Verificar que el usuario estÃ© autenticado
function requireAuth() {
  if (!window.currentUser) {
    throw new Error('User must be authenticated');
  }
  return window.currentUser;
}

// ========================================
// INSTANCIA GLOBAL DEL AUTH MANAGER
// ========================================
window.authManager = new AuthManager();
window.trackEvent = trackEvent;
window.requireAuth = requireAuth;

// Exponer mÃ©todo de debug
window.debugAuthState = () => window.authManager.debugState();

// ========================================
// INICIALIZACIÃ“N
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("ðŸ”§ AUTH: DOM cargado - Iniciando auth manager");
  
  // Inicializar auth inmediatamente (sin delays arbitrarios)
  window.authManager.initializeAuth()
    .then(() => {
      console.log("ðŸ”§ AUTH: Sistema de autenticaciÃ³n inicializado correctamente");
    })
    .catch((error) => {
      console.error("ðŸ”§ AUTH: Error crÃ­tico en inicializaciÃ³n:", error);
    });
});

console.log("âœ… Config.js cargado (versiÃ³n 2.0 - Sin race conditions)");