// ===============================
// SISTEMA DE PLANES DE USUARIO
// userPlans.js - VERSIÃ“N CORREGIDA
// ===============================

const PLANS = {
    free: {
        id: 'free',
        name: 'Starter',
        price: 0,
        limits: {
            maxLoadsPerMonth: 30,
            hasFinances: true,
            hasZones: true,
            hasAccounts: false,
            hasAdvancedReports: false,
            hasExportAdvanced: false,
            hasLex: false,
            hasWeatherDetails: false,
            historyDays: 30,
            hasTaxReports: false,
            hasAcademy: true,
            academyModules: [0, 1, 2, 3]
        },
        // features es un getter dinámico para respetar el idioma activo
        get features() {
            const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
            return [
                t('plans.starter_f1_plain'),
                t('plans.feature_basic_rpm'),
                t('plans.feature_basic_finances'),
                t('plans.feature_basic_zones'),
                t('plans.feature_academy_free')
            ];
        }
    },
    professional: {
        id: 'professional',
        name: 'Professional',
        price: 14.99,
        limits: {
            maxLoadsPerMonth: -1,
            hasFinances: true,
            hasZones: true,
            hasAccounts: true,
            hasAdvancedReports: true,
            hasExportAdvanced: true,
            hasLex: false,
            hasWeatherDetails: false,
            historyDays: 90,
            hasTaxReports: false,
            hasAcademy: true,
            academyModules: [0, 1, 2, 3, 4, 5, 6]
        },
        get features() {
            const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
            return [
                t('plans.feature_unlimited_loads'),
                t('plans.feature_full_finances'),
                t('plans.feature_advanced_zones'),
                t('plans.feature_history_90'),
                t('plans.feature_pdf_reports'),
                t('plans.feature_excel_export'),
                t('plans.feature_academy_pro')
            ];
        }
    },
    premium: {
        id: 'premium',
        name: 'Premium + AI',
        price: 29.99,
        limits: {
            maxLoadsPerMonth: -1,
            hasFinances: true,
            hasZones: true,
            hasAccounts: true,
            hasAdvancedReports: true,
            hasExportAdvanced: true,
            hasLex: true,
            hasWeatherDetails: true,
            historyDays: -1,
            hasTaxReports: true,
            hasPrioritySupport: true,
            hasAcademy: true,
            academyModules: [0, 1, 2, 3, 4, 5, 6, 7, 8]
        },
        get features() {
            const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
            return [
                t('plans.feature_everything_pro'),
                t('plans.feature_lex_ai'),
                t('plans.feature_unlimited_history'),
                t('plans.feature_ai_analysis'),
                t('plans.feature_tax_reports'),
                t('plans.feature_priority_support'),
                t('plans.feature_full_academy')
            ];
        }
    },
    admin: {
        id: 'admin',
        name: 'Administrador',
        price: 0,
        limits: {
            maxLoadsPerMonth: -1,
            hasFinances: true,
            hasZones: true,
            hasAccounts: true,
            hasAdvancedReports: true,
            hasExportAdvanced: true,
            hasLex: true,
            hasWeatherDetails: true,
            historyDays: -1,
            hasTaxReports: true,
            hasPrioritySupport: true,
            isAdmin: true,
            hasAcademy: true,
            academyModules: [0, 1, 2, 3, 4, 5, 6, 7, 8]
        }
    }
};

async function getUserPlan(userId) {
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .get();

        const userData = userDoc.exists ? userDoc.data() : {};

        // Admin override
        if (userData.role === 'admin') {
            return {
                ...PLANS['admin'],
                userId,
                subscriptionStatus: 'active',
                loadsThisMonth: userData.loadsThisMonth || 0,
                monthStartDate: userData.monthStartDate || new Date().toISOString()
            };
        }

        // Verificar suscripción activa en Stripe (funciona en live y test mode)
        const PRICE_TO_PLAN = {
            'price_1TBCyEPrcqI2pVW0vcn6xbxd': 'professional', // TEST
            'price_1TBCzcPrcqI2pVW07PAeFG9I': 'premium',       // TEST
            'price_1T4CmZPrcqI2pVW0wjZkexA8': 'professional', // LIVE
            'price_1T4CpaPrcqI2pVW0EgoJJq6Q': 'premium'        // LIVE
        };

        const subsSnap = await firebase.firestore()
            .collection('customers').doc(userId)
            .collection('subscriptions')
            .where('status', '==', 'active')
            .get();

        // Prioridad de planes: premium > professional > free
        const PLAN_PRIORITY = { free: 0, professional: 1, premium: 2, admin: 3 };

        let planId = 'free';
        let stripeSubId = userData.subscriptionId || null;

        if (!subsSnap.empty) {
            // Si hay varias suscripciones activas (ej: upgrade en progreso), usar la de mayor nivel
            let bestPriority = -1;
            for (const doc of subsSnap.docs) {
                const priceId = doc.data().items?.[0]?.price?.id;
                const docPlanId = PRICE_TO_PLAN[priceId] || 'free';
                const priority = PLAN_PRIORITY[docPlanId] ?? 0;
                if (priority > bestPriority) {
                    bestPriority = priority;
                    planId = docPlanId;
                    stripeSubId = doc.id;
                }
            }

            // Sincronizar en users/{uid} para consistencia
            await firebase.firestore().collection('users').doc(userId)
                .set({
                    plan: planId,
                    subscriptionStatus: 'active',
                    subscriptionId: stripeSubId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
        } else {
            planId = userData.plan || 'free';
        }

        const planData = PLANS[planId] || PLANS.free;

        return {
            ...planData,
            userId,
            subscriptionId: stripeSubId,
            subscriptionStatus: userData.subscriptionStatus || 'active',
            subscriptionEndDate: userData.subscriptionEndDate || null,
            loadsThisMonth: userData.loadsThisMonth || 0,
            monthStartDate: userData.monthStartDate || new Date().toISOString()
        };

    } catch (error) {
        debugLog('Error obteniendo plan:', error);
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

        debugLog('[PLANS] Plan de usuario inicializado');
        return true;
    } catch (error) {
        debugLog(' Error inicializando plan:', error);
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

        debugLog('[PLANS] Usuario convertido a Admin');
        return true;
    } catch (error) {
        debugLog(' Error asignando admin:', error);
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
        debugLog('Error incrementando cargas:', error);
        return false;
    }
}

function showUpgradeModal(featureName, currentPlanId = 'free') {
    // Eliminar modal existente si hay uno
    const existing = document.getElementById('upgradeModal');
    if (existing) existing.remove();

    // Determinar qué plan target mostrar según la feature bloqueada y el plan actual
    // Features que SOLO están en Premium:
    const premiumOnlyFeatures = ['lex', 'weatherDetails', 'taxReports'];
    const featureKey = featureName
        ? `has${featureName.charAt(0).toUpperCase() + featureName.slice(1)}`
        : null;

    const needsPremium = premiumOnlyFeatures.some(f =>
        featureName?.toLowerCase().includes(f.toLowerCase())
    );

    // Si ya tiene Professional → mostrar Premium. De lo contrario → mostrar Professional
    const targetPlanId = (currentPlanId === 'professional' || needsPremium) ? 'premium' : 'professional';
    const targetPlan = PLANS[targetPlanId];
    const isPremiumTarget = targetPlanId === 'premium';

    const accentColor = isPremiumTarget ? '#8b5cf6' : '#FF6D4A';
    const accentBg = isPremiumTarget ? 'rgba(139,92,246,0.1)' : 'rgba(255,109,74,0.1)';
    const accentBorder = isPremiumTarget ? 'rgba(139,92,246,0.4)' : 'rgba(255,109,74,0.4)';
    const btnColor = isPremiumTarget
        ? 'background:linear-gradient(135deg,#7c3aed,#a855f7)'
        : 'background:#FF6D4A';
    const planEmoji = isPremiumTarget ? '✨' : '🚀';

    const featuresHtml = targetPlan.features
        .map(f => `<li style="padding:4px 0;color:#94a3b8;font-size:13px;">✓ &nbsp;${f}</li>`)
        .join('');

    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
    const modalTitle = featureName
        ? t('upgrade_modal.title').replace('{{feature}}', `"${featureName}"`).replace('{{plan}}', targetPlan.name)
        : `${targetPlan.name}`;
    const perMonth = t('plans.per_month') || '/mo';

    modal.innerHTML = `
<div style="background:#1e293b;border-radius:16px;max-width:420px;width:100%;padding:32px;box-shadow:0 25px 50px rgba(0,0,0,0.5);border:1px solid ${accentBorder};">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:48px;margin-bottom:12px;">${planEmoji}</div>
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;">
      ${modalTitle}
    </h2>
    <p style="margin:0;color:#94a3b8;font-size:14px;">${t('upgrade_modal.subtitle')}</p>
  </div>

  <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:12px;padding:16px;margin-bottom:24px;">
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
      <span style="font-size:28px;font-weight:900;color:#fff;">$${targetPlan.price}</span>
      <span style="color:#94a3b8;font-size:13px;">${perMonth}</span>
    </div>
    <ul style="margin:0;padding:0;list-style:none;">
      ${featuresHtml}
    </ul>
  </div>

  <div style="display:flex;gap:12px;">
    <button onclick="closeUpgradeModal()"
      style="flex:1;background:rgba(255,255,255,0.08);color:#94a3b8;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">
      ${t('upgrade_modal.btn_maybe_later')}
    </button>
    <button onclick="goToPlans()"
      style="flex:1;${btnColor};color:#fff;border:none;padding:12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">
      ${t('upgrade_modal.btn_see_plans')}
    </button>
  </div>
</div>`;

    // Cerrar al hacer click en el backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeUpgradeModal();
    });

    document.body.appendChild(modal);

    if (window.trackEvent) {
        window.trackEvent('upgrade_prompt_shown', {
            feature: featureName,
            current_plan: currentPlanId,
            target_plan: targetPlanId
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

debugLog('[PLANS] Sistema de planes de usuario cargado');
