/**
 * Onboarding Manager
 * Detecta y gestiona el flujo de onboarding para usuarios nuevos
 * 
 * FASE 1 - MVP
 * - Detecta usuarios sin configuración
 * - Muestra modal de bienvenida
 * - Gestiona defaults inteligentes
 * - Banner de recordatorio
 */

class OnboardingManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.db = null;
    }

    /**
     * Inicializa el sistema de onboarding
     */
    async init() {
        debugLog('🎓 OnboardingManager: Iniciando...');

        // Esperar a que auth esté listo
        if (!window.currentUser || !window.db) {
            debugLog('⏳ Esperando autenticación...');
            setTimeout(() => this.init(), 500);
            return;
        }

        this.currentUser = window.currentUser;
        this.db = window.db;

        try {
            // Cargar perfil del usuario
            this.userProfile = await this.getUserProfile();

            if (!this.userProfile) {
                debugLog('⚠️ No se pudo cargar perfil de usuario');
                return;
            }

            debugLog('👤 Perfil cargado:', this.userProfile);

            // Determinar si necesita onboarding
            if (this.needsOnboarding()) {
                debugLog('🆕 Usuario necesita onboarding');
                await this.showWelcomeFlow();
            } else if (this.isUsingDefaults()) {
                debugLog('⚠️ Usuario usando defaults');
                this.showSetupReminder();
                this.showConfigStatusIndicator(); // Mostrar también en calculadora
            } else {
                debugLog('✅ Usuario configurado correctamente');
                this.showConfigStatusIndicator(); // Mostrar que está configurado
            }

        } catch (error) {
            debugLog('❌ Error en onboarding init:', error);
        }
    }

    /**
     * Obtiene el perfil del usuario desde Firestore
     */
    async getUserProfile() {
        try {
            const doc = await this.db.collection('users').doc(this.currentUser.uid).get();

            if (!doc.exists) {
                debugLog('📝 Usuario no existe en Firestore, creando...');
                await this.createDefaultProfile();
                return await this.getUserProfile(); // Recursivo para obtener el perfil creado
            }

            const profile = doc.data();

            // 🔄 Migración automática para usuarios antiguos
            if (this.needsMigration(profile)) {
                debugLog('🔄 Perfil antiguo detectado, migrando a nueva estructura...');
                await this.migrateOldProfile(profile);
                return await this.getUserProfile(); // Recursivo para obtener perfil migrado
            }

            return profile;
        } catch (error) {
            debugLog('Error obteniendo perfil:', error);
            return null;
        }
    }

    /**
     * Verifica si un perfil necesita migración
     */
    needsMigration(profile) {
        return !profile.vehicle ||
            !profile.costs ||
            !profile.preferences ||
            profile.vehicle.isDefault === undefined ||
            profile.costs.isDefault === undefined ||
            profile.preferences.isDefault === undefined;
    }

    /**
     * Migra perfil antiguo a nueva estructura
     */
    async migrateOldProfile(oldProfile) {
        const updates = {};

        // Agregar vehicle si no existe
        if (!oldProfile.vehicle || oldProfile.vehicle.isDefault === undefined) {
            updates.vehicle = {
                type: 'Cargo Van',
                mpg: 18,
                fuelPrice: 3.50,
                isDefault: true
            };
        }

        // Agregar costs si no existe
        if (!oldProfile.costs || oldProfile.costs.isDefault === undefined) {
            updates.costs = {
                fuelCost: 0.19,
                maintenanceCost: 0.12,
                insuranceCost: 0.08,
                depreciationCost: 0.10,
                otherCost: 0.06,
                totalCPM: 0.55,
                insuranceMonthly: 350,
                paymentMonthly: 600,
                maintenanceMonthly: 200,
                phoneData: 80,
                accounting: 50,
                otherMonthly: 100,
                totalFixedMonthly: 1380,
                isDefault: true
            };
        }

        // Agregar preferences si no existe
        if (!oldProfile.preferences || oldProfile.preferences.isDefault === undefined) {
            updates.preferences = {
                operatorProfile: 'not_set',
                minRPM: 1.50,
                targetRPM: 1.60,
                maxDeadhead: 100,
                daysPerMonth: 22,
                milesPerMonth: 10000,
                isDefault: true
            };
        }

        // Agregar/actualizar onboarding completo
        if (!oldProfile.onboarding || !oldProfile.onboarding.completed === undefined) {
            updates.onboarding = {
                ...oldProfile.onboarding,
                completed: false,
                currentStep: 0,
                startedAt: oldProfile.onboarding?.startedAt || null,
                completedAt: null,
                skipped: false,
                skipCount: 0,
                lastReminderShown: null
            };
        }

        // Agregar analytics si no existe
        if (!oldProfile.analytics) {
            updates.analytics = {
                totalCalculations: 0,
                totalSavedLoads: 0,
                lastActive: new Date()
            };
        }

        // Aplicar updates
        await this.db.collection('users').doc(this.currentUser.uid).update(updates);
        debugLog('✅ Perfil migrado exitosamente:', Object.keys(updates));
    }

    /**
     * Crea perfil default para usuario nuevo
     */
    async createDefaultProfile() {
        const defaultProfile = {
            uid: this.currentUser.uid,
            email: this.currentUser.email,
            createdAt: new Date(),

            // Tracking de onboarding
            onboarding: {
                completed: false,
                currentStep: 0,
                startedAt: null,
                completedAt: null,
                skipped: false,
                skipCount: 0,
                lastReminderShown: null
            },

            // Defaults de vehículo (basados en industria)
            vehicle: {
                type: 'Cargo Van',
                mpg: 18,
                fuelPrice: 3.50,
                isDefault: true
            },

            // Defaults de costos
            costs: {
                // Variable costs (per mile)
                fuelCost: 0.19,        // $3.50/gal ÷ 18 MPG
                maintenanceCost: 0.12,
                insuranceCost: 0.08,
                depreciationCost: 0.10,
                otherCost: 0.06,
                totalCPM: 0.55,

                // Fixed costs (monthly)
                insuranceMonthly: 350,
                paymentMonthly: 600,
                maintenanceMonthly: 200,
                phoneData: 80,
                accounting: 50,
                otherMonthly: 100,
                totalFixedMonthly: 1380,

                isDefault: true
            },

            // Defaults de preferencias
            preferences: {
                operatorProfile: 'not_set',
                minRPM: 1.50,
                targetRPM: 1.60,
                maxDeadhead: 100,
                daysPerMonth: 22,
                milesPerMonth: 10000,
                isDefault: true
            },

            // Analytics
            analytics: {
                totalCalculations: 0,
                totalSavedLoads: 0,
                lastActive: new Date()
            }
        };

        await this.db.collection('users').doc(this.currentUser.uid).set(defaultProfile);
        debugLog('✅ Perfil default creado');
    }

    /**
     * Verifica si es un usuario establecido (cuenta antigua con actividad)
     */
    isEstablishedUser() {
        // 🔑 PRIORIDAD 0: Verificar rol privilegiado (admin/developer)
        // Estos usuarios SIEMPRE skippean onboarding
        if (window.rolesManager) {
            const isPrivileged = window.rolesManager.isPrivileged();
            if (isPrivileged) {
                debugLog('✅ Usuario con rol privilegiado detectado:', window.rolesManager.getUserRole());
                return true;
            }
        }

        if (!this.userProfile || !this.userProfile.createdAt) {
            return false;
        }

        // Convertir createdAt a Date si es timestamp de Firebase
        const createdAt = this.userProfile.createdAt.toDate ?
            this.userProfile.createdAt.toDate() :
            new Date(this.userProfile.createdAt);

        const accountAge = Date.now() - createdAt.getTime();
        const daysOld = accountAge / (1000 * 60 * 60 * 24);

        // Criterios para usuario establecido:
        // 1. Cuenta con más de 7 días
        // 2. O tiene más de 5 cálculos guardados
        // 3. O tiene perfil operativo configurado (no 'not_set')
        const hasActivity = (this.userProfile.analytics?.totalCalculations || 0) > 5;
        const hasProfile = this.userProfile.preferences?.operatorProfile &&
            this.userProfile.preferences.operatorProfile !== 'not_set';

        return daysOld > 7 || hasActivity || hasProfile;
    }

    /**
     * Determina si el usuario necesita onboarding completo
     */
    needsOnboarding() {
        if (!this.userProfile || !this.userProfile.onboarding) {
            return true;
        }

        // NO mostrar onboarding a usuarios establecidos
        if (this.isEstablishedUser()) {
            debugLog('✅ Usuario establecido detectado, skip onboarding');
            return false;
        }

        // Necesita onboarding si:
        // - No ha completado onboarding
        // - Está usando defaults
        // - Tiene menos de 3 cálculos (usuario muy nuevo)
        return !this.userProfile.onboarding.completed &&
            this.userProfile.vehicle?.isDefault &&
            this.userProfile.costs?.isDefault &&
            (this.userProfile.analytics?.totalCalculations || 0) < 3;
    }

    /**
     * Verifica si el usuario está usando valores por defecto
     */
    isUsingDefaults() {
        if (!this.userProfile) return false;

        // 🔑 Usuarios privilegiados (admin/developer) NUNCA ven banner
        if (window.rolesManager && window.rolesManager.isPrivileged()) {
            debugLog('✅ Usuario privilegiado, no mostrar banner de defaults');
            return false;
        }

        // NO considerar que usa defaults si es usuario establecido
        // (puede tener isDefault=true pero datos personalizados antiguos)
        if (this.isEstablishedUser()) {
            // Solo mostrar warning si REALMENTE está usando valores default exactos
            const hasDefaultVehicle = this.userProfile.vehicle?.type === 'Cargo Van' &&
                this.userProfile.vehicle?.mpg === 18;
            const hasDefaultCPM = this.userProfile.costs?.totalCPM === 0.55;
            const hasDefaultProfile = this.userProfile.preferences?.operatorProfile === 'not_set';

            // Solo si tiene TODOS los defaults exactos
            return hasDefaultVehicle && hasDefaultCPM && hasDefaultProfile;
        }

        // Para usuarios nuevos, usar la lógica original
        return this.userProfile.vehicle?.isDefault ||
            this.userProfile.costs?.isDefault ||
            this.userProfile.preferences?.isDefault;
    }

    /**
     * Muestra el flujo de bienvenida
     */
    async showWelcomeFlow() {
        const choice = await this.showWelcomeModal();

        if (choice === 'setup') {
            // Actualizar tracking
            await this.db.collection('users').doc(this.currentUser.uid).update({
                'onboarding.startedAt': new Date()
            });

            // Track event
            if (window.trackEvent) {
                window.trackEvent('onboarding_started', { source: 'welcome_modal' });
            }

            // Redirigir a tab de configuración
            window.location.href = '/app.html#settings';
        } else {
            // Usuario skippeó
            await this.trackSkip();
        }
    }

    /**
     * Muestra modal de bienvenida
     * @returns {Promise<string>} 'setup' o 'skip'
     */
    showWelcomeModal() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'onboarding-modal';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="icon">🚐</div>
                        <h2 style="color: #1e293b !important;">¡Bienvenido a Smart Load Solution!</h2>
                    </div>
                    
                    <div class="modal-body">
                        <p style="color: #374151 !important;">Antes de calcular tu primera carga, configuremos tu operación (2 minutos):</p>
                        
                        <ul class="setup-benefits">
                            <li>✅ Tipo de vehículo y consumo</li>
                            <li>✅ Costos fijos mensuales</li>
                            <li>✅ Tu perfil operativo</li>
                        </ul>
                        
                        <div class="info-box">
                            <strong>📊 Cálculos precisos desde el inicio</strong>
                            <p style="color: #374151 !important; margin: 0; font-size: 0.875rem; line-height: 1.5;">Esto asegura que TODOS los cálculos sean precisos para TU operación específica.</p>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn-secondary" data-action="skip" style="color: #1e40af !important;">
                            Después (no recomendado)
                        </button>
                        <button class="btn-primary" data-action="setup">
                            Configurar Ahora
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners
            modal.querySelector('[data-action="setup"]').onclick = () => {
                modal.remove();
                resolve('setup');
            };

            modal.querySelector('[data-action="skip"]').onclick = () => {
                modal.remove();
                resolve('skip');
            };

            // Click en overlay para cerrar (cuenta como skip)
            modal.querySelector('.modal-overlay').onclick = () => {
                modal.remove();
                resolve('skip');
            };
        });
    }

    /**
     * Muestra banner de recordatorio
     */
    showSetupReminder() {
        // Verificar si ya fue dismissed muchas veces hoy
        const dismissCount = parseInt(localStorage.getItem('setupReminderDismissed') || '0');
        const lastDismiss = localStorage.getItem('setupReminderLastDismiss');

        // Resetear contador cada 24 horas
        if (lastDismiss) {
            const dayPassed = Date.now() - parseInt(lastDismiss) > 24 * 60 * 60 * 1000;
            if (dayPassed) {
                localStorage.setItem('setupReminderDismissed', '0');
            }
        }

        // Máximo 3 dismisses por día
        if (dismissCount >= 3) {
            debugLog('⏸️ Banner reminder pausado (3 dismisses hoy)');
            return;
        }

        // Crear banner
        const banner = document.createElement('div');
        banner.className = 'setup-reminder-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">⚠️</span>
                <span class="banner-text">
                    Cálculos usando valores promedio. 
                    <a href="/app.html#settings" class="banner-link">Configura tu operación</a> 
                    para precisión real.
                </span>
                <button class="banner-close">×</button>
            </div>
        `;

        // Dismiss handler
        banner.querySelector('.banner-close').onclick = () => {
            const newCount = dismissCount + 1;
            localStorage.setItem('setupReminderDismissed', newCount.toString());
            localStorage.setItem('setupReminderLastDismiss', Date.now().toString());
            banner.remove();

            // Track dismiss
            if (window.trackEvent) {
                window.trackEvent('setup_banner_dismissed', { count: newCount });
            }
        };

        // Insertar al inicio del body (después del loading screen si existe)
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen && loadingScreen.nextSibling) {
            document.body.insertBefore(banner, loadingScreen.nextSibling);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }

        debugLog('📢 Banner reminder mostrado');
    }

    /**
     * Registra que el usuario skippeó el onboarding
     */
    async trackSkip() {
        try {
            await this.db.collection('users').doc(this.currentUser.uid).update({
                'onboarding.skipped': true,
                'onboarding.skipCount': firebase.firestore.FieldValue.increment(1),
                'onboarding.lastReminderShown': new Date()
            });

            // Track event
            if (window.trackEvent) {
                window.trackEvent('onboarding_skipped', {
                    source: 'welcome_modal',
                    skip_count: (this.userProfile.onboarding?.skipCount || 0) + 1
                });
            }

            debugLog('📌 Skip registrado');
        } catch (error) {
            debugLog('Error tracking skip:', error);
        }
    }

    /**
     * Muestra indicador de estado de configuración en la calculadora
     */
    showConfigStatusIndicator() {
        const indicator = document.getElementById('configStatusIndicator');
        if (!indicator) {
            debugLog('⚠️ configStatusIndicator no encontrado en DOM');
            return;
        }

        // 🔑 Usuarios privilegiados NO ven indicador de configuración
        if (window.rolesManager && window.rolesManager.isPrivileged()) {
            debugLog('✅ Usuario privilegiado, no mostrar indicador de configuración');
            indicator.innerHTML = ''; // Limpiar cualquier contenido
            return;
        }

        if (this.isUsingDefaults()) {
            // Usando valores por defecto
            indicator.innerHTML = `
                <div style="background: rgba(255, 193, 7, 0.15); border-left: 4px solid #FFC107; padding: 0.875rem 1.25rem; margin-bottom: 1.5rem; border-radius: 0.75rem; box-shadow: 0 2px 8px rgba(255, 193, 7, 0.1);">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <span style="font-size: 1.25rem;">⚠️</span>
                        <span style="flex: 1; font-size: 0.9375rem; color: #78350f; font-weight: 500;">
                            Usando valores promedio de industria (CPM $${this.userProfile.costs.totalCPM}/mi). 
                            <a href="./config.html" style="color: #92400e; text-decoration: underline; font-weight: 700; text-decoration-thickness: 2px; text-underline-offset: 2px;">Configura tu operación →</a> 
                            para cálculos precisos.
                        </span>
                    </div>
                </div>
            `;
        } else {
            // Configuración personalizada
            const cpm = this.userProfile.costs?.totalCPM || 0.55;
            indicator.innerHTML = `
                <div style="background: rgba(76, 175, 80, 0.15); border-left: 4px solid #4CAF50; padding: 0.75rem 1.25rem; margin-bottom: 1.5rem; border-radius: 0.75rem; font-size: 0.875rem; color: #1b5e20; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.1);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>✓</span>
                        <span style="font-weight: 600;">Usando tu configuración personalizada</span>
                        <span style="opacity: 0.8;">(CPM: $${cpm.toFixed(2)}/mi)</span>
                    </div>
                </div>
            `;
        }
    }
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================

let onboardingManager;

/**
 * Inicializa onboarding cuando Firebase esté listo
 * Se ejecuta DESPUÉS de que config.js haya inicializado Firebase
 */
function initOnboardingWhenReady() {
    // Verificar que window.auth y window.db estén disponibles (creados por config.js)
    if (!window.auth || !window.db) {
        debugLog('⏳ OnboardingManager: Esperando config.js...');
        setTimeout(initOnboardingWhenReady, 300);
        return;
    }

    debugLog('✅ OnboardingManager: Firebase disponible, configurando listener...');

    // Usar el auth ya inicializado por config.js
    window.auth.onAuthStateChanged(async (user) => {
        if (user && window.currentUser) {
            debugLog('👤 OnboardingManager: Usuario detectado, esperando antes de iniciar...');

            // Delay adicional para asegurar que todo está cargado
            setTimeout(async () => {
                try {
                    debugLog('🎓 OnboardingManager: Iniciando sistema...');
                    onboardingManager = new OnboardingManager();
                    await onboardingManager.init();
                } catch (error) {
                    debugLog('❌ OnboardingManager: Error en init:', error);
                }
            }, 2000); // 2 segundos después de auth state changed
        } else {
            debugLog('⏸️ OnboardingManager: No hay usuario autenticado');
        }
    });
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        debugLog('📋 OnboardingManager: DOM cargado, esperando Firebase...');
        setTimeout(initOnboardingWhenReady, 1000);
    });
} else {
    // DOM ya está listo
    debugLog('📋 OnboardingManager: DOM ya listo, esperando Firebase...');
    setTimeout(initOnboardingWhenReady, 1000);
}

// Exponer globalmente para debugging
window.OnboardingManager = OnboardingManager;
window.getOnboardingManager = () => onboardingManager;

debugLog('✅ onboarding-manager.js cargado');
