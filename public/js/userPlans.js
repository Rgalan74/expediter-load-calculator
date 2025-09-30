// ===============================
// 🔐 SISTEMA DE PLANES DE USUARIO
// userPlans.js - VERSIÓN CORREGIDA
// ===============================

const PLANS = {
  free: {
    id: 'free',
    name: 'Plan Gratuito',
    price: 0,
    limits: {
      maxLoadsPerMonth: 50,
      hasFinances: false,
      hasZones: false,
      hasAccounts: false,
      hasAdvancedReports: false,
      canExportAdvanced: false
    },
    features: [
      'Calculadora completa',
      'Hasta 50 cargas/mes',
      'Historial básico',
      'Exportación CSV simple'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Plan Profesional',
    price: 15,
    limits: {
      maxLoadsPerMonth: -1,
      hasFinances: true,
      hasZones: true,
      hasAccounts: true,
      hasAdvancedReports: true,
      canExportAdvanced: true
    },
    features: [
      'Todo del plan gratuito',
      'Cargas ilimitadas',
      'Sistema de finanzas completo',
      'Cuentas por cobrar',
      'Mapa de zonas rentables',
      'Reportes avanzados',
      'Exportación Excel'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Plan Empresarial',
    price: 35,
    limits: {
      maxLoadsPerMonth: -1,
      hasFinances: true,
      hasZones: true,
      hasAccounts: true,
      hasAdvancedReports: true,
      canExportAdvanced: true,
      hasMultiUser: true,
      hasPrioritySupport: true
    },
    features: [
      'Todo del plan profesional',
      'Múltiples usuarios',
      'Dashboard por vehículo',
      'Soporte prioritario',
      'API access'
    ]
  },
  admin: {
    id: 'admin',
    name: '👑 Administrador',
    price: 0,
    limits: {
      maxLoadsPerMonth: -1,
      hasFinances: true,
      hasZones: true,
      hasAccounts: true,
      hasAdvancedReports: true,
      canExportAdvanced: true,
      hasMultiUser: true,
      hasPrioritySupport: true,
      isAdmin: true
    },
    features: [
      'Acceso completo sin restricciones',
      'Panel de administración',
      'Gestión de usuarios',
      'Todas las features desbloqueadas'
    ]
  }
};

async function getUserPlan(userId) {
  try {
    const userDoc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const planId = userData.plan || 'free';
      const planData = PLANS[planId];
      
      return {
        ...planData,
        userId: userId,
        subscriptionStatus: userData.subscriptionStatus || 'active',
        subscriptionEndDate: userData.subscriptionEndDate || null,
        loadsThisMonth: userData.loadsThisMonth || 0,
        monthStartDate: userData.monthStartDate || new Date().toISOString()
      };
    }
    
    return {
      ...PLANS.free,
      userId: userId,
      subscriptionStatus: 'active',
      loadsThisMonth: 0
    };
    
  } catch (error) {
    console.error('Error obteniendo plan:', error);
    return PLANS.free;
  }
}

async function initializeUserPlan(userId, email) {
  try {
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .set({
        email: email,
        plan: 'free',
        subscriptionStatus: 'active',
        loadsThisMonth: 0,
        monthStartDate: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    
    console.log('✅ Plan de usuario inicializado');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando plan:', error);
    return false;
  }
}

function isAdmin(userPlan) {
  if (!userPlan) return false;
  return userPlan.id === 'admin' || userPlan.limits?.isAdmin === true;
}

async function setUserAsAdmin(userId) {
  try {
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .set({
        plan: 'admin',
        role: 'admin',
        subscriptionStatus: 'active',
        loadsThisMonth: 0,
        monthStartDate: new Date().toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    
    console.log('✅ Usuario convertido a Admin');
    return true;
  } catch (error) {
    console.error('❌ Error asignando admin:', error);
    return false;
  }
}

function canAccessFeature(userPlan, featureName) {
  if (!userPlan || !userPlan.limits) {
    return false;
  }
  
  if (isAdmin(userPlan)) {
    return true;
  }
  
  const featureKey = `has${featureName.charAt(0).toUpperCase() + featureName.slice(1)}`;
  return userPlan.limits[featureKey] === true;
}

function canCreateMoreLoads(userPlan) {
  if (!userPlan) return false;
  
  if (isAdmin(userPlan)) {
    return true;
  }
  
  const maxLoads = userPlan.limits.maxLoadsPerMonth;
  
  if (maxLoads === -1) return true;
  
  return userPlan.loadsThisMonth < maxLoads;
}

async function incrementMonthlyLoads(userId) {
  try {
    const userRef = firebase.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    const monthStart = new Date(userData.monthStartDate || new Date());
    const now = new Date();
    
    if (now.getMonth() !== monthStart.getMonth() || 
        now.getFullYear() !== monthStart.getFullYear()) {
      await userRef.update({
        loadsThisMonth: 1,
        monthStartDate: now.toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await userRef.update({
        loadsThisMonth: firebase.firestore.FieldValue.increment(1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error incrementando cargas:', error);
    return false;
  }
}

function showUpgradeModal(featureName, currentPlan = 'free') {
  const modal = document.createElement('div');
  modal.id = 'upgradeModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8">
      <div class="text-center mb-6">
        <div class="text-6xl mb-4">🔒</div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Feature Premium</h2>
        <p class="text-gray-600">
          <strong>${featureName}</strong> está disponible en nuestro Plan Profesional
        </p>
      </div>
      
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p class="text-sm text-blue-800 mb-2">
          <strong>Plan Profesional - $15/mes</strong>
        </p>
        <ul class="text-sm text-blue-700 space-y-1">
          <li>✓ Cargas ilimitadas</li>
          <li>✓ Sistema de finanzas completo</li>
          <li>✓ Cuentas por cobrar</li>
          <li>✓ Mapa de zonas rentables</li>
          <li>✓ Reportes avanzados</li>
        </ul>
      </div>
      
      <div class="flex gap-3">
        <button onclick="closeUpgradeModal()" 
                class="flex-1 bg-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-400">
          Tal vez después
        </button>
        <button onclick="goToPlans()" 
                class="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700">
          Ver Planes
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  if (window.trackEvent) {
    window.trackEvent('upgrade_prompt_shown', {
      feature: featureName,
      current_plan: currentPlan
    });
  }
}

function closeUpgradeModal() {
  const modal = document.getElementById('upgradeModal');
  if (modal) {
    modal.remove();
  }
}

function goToPlans() {
  if (window.trackEvent) {
    window.trackEvent('upgrade_clicked', {
      source: 'modal'
    });
  }
  window.location.href = 'plans.html';
}

// ===============================
// EXPORTAR FUNCIONES GLOBALMENTE
// ===============================

window.PLANS = PLANS;
window.getUserPlan = getUserPlan;
window.initializeUserPlan = initializeUserPlan;
window.canAccessFeature = canAccessFeature;
window.canCreateMoreLoads = canCreateMoreLoads;
window.incrementMonthlyLoads = incrementMonthlyLoads;
window.showUpgradeModal = showUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.goToPlans = goToPlans;
window.isAdmin = isAdmin;
window.setUserAsAdmin = setUserAsAdmin;

console.log('✅ Sistema de planes de usuario cargado correctamente');