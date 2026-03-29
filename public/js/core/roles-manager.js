/**
 * Roles Manager
 * Sistema central de gestión de roles y permisos
 * 
 * Roles disponibles:
 * - admin: Control total, puede asignar roles
 * - developer: Acceso a herramientas de desarrollo, skip onboarding
 * - user: Usuario estándar
 */

class RolesManager {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.userPermissions = [];
        this.db = null;
        this.roleCache = new Map(); // Cache de roles para performance
    }

    /**
     * Configuración de permisos por rol
     */
    static ROLE_PERMISSIONS = {
        admin: [
            'read',
            'write',
            'delete',
            'assign_roles',
            'view_all_users',
            'edit_all_users',
            'view_analytics',
            'skip_onboarding',
            'access_admin_panel'
        ],
        developer: [
            'read',
            'write',
            'delete',
            'view_analytics',
            'skip_onboarding',
            'access_dev_tools'
        ],
        user: [
            'read',
            'write',
            'delete' // Solo sus propios datos
        ]
    };

    /**
     * Inicializa el sistema de roles
     */
    async init(user = null, db = null) {
        debugLog('🔐 [ROLES] Iniciando...');

        this.currentUser = user || window.currentUser;
        this.db = db || window.db;

        if (!this.currentUser || !this.db) {
            debugLog('⏳ [ROLES] Faltan datos (user o db), esperando...');
            setTimeout(() => this.init(), 500);
            return;
        }

        try {
            await this.loadUserRole();
            debugLog('✅ [ROLES] inicializado:', {
                role: this.userRole,
                permissions: this.userPermissions.length
            });
        } catch (error) {
            debugLog('❌ [ROLES] Error en init:', error);
        }
    }

    /**
     * Carga el rol del usuario actual desde Firestore
     */
    async loadUserRole() {
        try {
            const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();

            if (!userDoc.exists) {
                debugLog('⚠️ [ROLES] Usuario no existe en Firestore');
                this.userRole = 'user';
                this.userPermissions = RolesManager.ROLE_PERMISSIONS.user;
                return;
            }

            const userData = userDoc.data();
            this.userRole = userData.role || 'user';
            this.userPermissions = RolesManager.ROLE_PERMISSIONS[this.userRole] || [];

            debugLog('👤 [ROLES] Rol cargado:', {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                role: this.userRole
            });
        } catch (error) {
            debugLog('❌ [ROLES] Error cargando rol:', error);
            this.userRole = 'user';
            this.userPermissions = RolesManager.ROLE_PERMISSIONS.user;
        }
    }

    /**
     * Obtiene el rol del usuario actual
     */
    getUserRole() {
        return this.userRole;
    }

    /**
     * Obtiene los permisos del usuario actual
     */
    getUserPermissions() {
        return this.userPermissions;
    }

    /**
     * Verifica si el usuario tiene un permiso específico
     * @param {string} permission - Nombre del permiso a verificar
     * @returns {boolean}
     */
    hasPermission(permission) {
        return this.userPermissions.includes(permission);
    }

    /**
     * Verifica si el usuario es admin
     * @returns {boolean}
     */
    isAdmin() {
        return this.userRole === 'admin';
    }

    /**
     * Verifica si el usuario es developer
     * @returns {boolean}
     */
    isDeveloper() {
        return this.userRole === 'developer';
    }

    /**
     * Verifica si el usuario es privilegiado (admin o developer)
     * @returns {boolean}
     */
    isPrivileged() {
        return this.isAdmin() || this.isDeveloper();
    }

    /**
     * Obtiene el rol de cualquier usuario (requiere permisos de admin)
     * @param {string} userId - UID del usuario
     * @returns {Promise<string>} Rol del usuario
     */
    async getUserRoleById(userId) {
        // Verificar permisos
        if (!this.hasPermission('view_all_users')) {
            throw new Error('No tienes permisos para ver roles de otros usuarios');
        }

        // Verificar cache
        if (this.roleCache.has(userId)) {
            const cached = this.roleCache.get(userId);
            // Cache válido por 5 minutos
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
                return cached.role;
            }
        }

        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            const role = userDoc.exists ? (userDoc.data().role || 'user') : 'user';

            // Actualizar cache
            this.roleCache.set(userId, {
                role,
                timestamp: Date.now()
            });

            return role;
        } catch (error) {
            debugLog('❌ [ROLES] Error obteniendo rol:', error);
            return 'user';
        }
    }

    /**
     * Asigna un rol a un usuario (solo admins)
     * @param {string} userId - UID del usuario
     * @param {string} role - Rol a asignar ('admin', 'developer', 'user')
     * @returns {Promise<void>}
     */
    async assignRole(userId, role) {
        // Verificar permisos
        if (!this.hasPermission('assign_roles')) {
            throw new Error('No tienes permisos para asignar roles');
        }

        // Validar rol
        if (!['admin', 'developer', 'user'].includes(role)) {
            throw new Error('Rol inválido. Debe ser: admin, developer, o user');
        }

        // No permitir que el usuario se quite su propio rol de admin
        if (userId === this.currentUser.uid && this.isAdmin() && role !== 'admin') {
            throw new Error('No puedes quitarte tu propio rol de administrador');
        }

        try {
            await this.db.collection('users').doc(userId).update({
                role: role,
                roleAssignedBy: this.currentUser.email,
                roleAssignedAt: new Date(),
                permissions: RolesManager.ROLE_PERMISSIONS[role]
            });

            // Invalidar cache
            this.roleCache.delete(userId);

            // Track event
            if (window.trackEvent) {
                window.trackEvent('role_assigned', {
                    targetUser: userId,
                    role: role,
                    assignedBy: this.currentUser.email
                });
            }

            debugLog('✅ [ROLES] Rol asignado:', { userId, role });
        } catch (error) {
            debugLog('❌ [ROLES] Error asignando rol:', error);
            throw error;
        }
    }

    /**
     * Lista todos los usuarios con sus roles (solo admins)
     * @returns {Promise<Array>} Lista de usuarios con roles
     */
    async listAllUsers() {
        // Verificar permisos
        if (!this.hasPermission('view_all_users')) {
            throw new Error('No tienes permisos para ver todos los usuarios');
        }

        try {
            const snapshot = await this.db.collection('users').get();
            const users = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                users.push({
                    uid: doc.id,
                    email: data.email,
                    role: data.role || 'user',
                    createdAt: data.createdAt,
                    roleAssignedBy: data.roleAssignedBy,
                    roleAssignedAt: data.roleAssignedAt
                });
            });

            return users;
        } catch (error) {
            debugLog('❌ [ROLES] Error listando usuarios:', error);
            throw error;
        }
    }

    /**
     * Obtiene permisos disponibles para un rol
     * @param {string} role - Rol a consultar
     * @returns {Array<string>} Lista de permisos
     */
    getPermissions(role) {
        return RolesManager.ROLE_PERMISSIONS[role] || [];
    }

    /**
     * Limpia el cache de roles
     */
    clearCache() {
        this.roleCache.clear();
        debugLog('🧹 [ROLES] Cache limpiado');
    }
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================

// Crear instancia INMEDIATAMENTE (antes de inicializar)
const rolesManager = new RolesManager();

// Exponer globalmente desde el inicio
window.rolesManager = rolesManager;
window.RolesManager = RolesManager;
window.getRolesManager = () => rolesManager;

/**
 * Inicializa RolesManager cuando Firebase esté listo
 */
function initRolesManagerWhenReady() {
    if (!window.auth || !window.db) {
        setTimeout(initRolesManagerWhenReady, 300);
        return;
    }

    debugLog('✅ [ROLES] Firebase disponible, configurando listener...');

    window.auth.onAuthStateChanged(async (user) => {
        if (user) {
            debugLog('👤 [ROLES] Usuario detectado, iniciando...', user.email);

            setTimeout(async () => {
                try {
                    await rolesManager.init(user, window.db);
                } catch (error) {
                    debugLog('❌ [ROLES] Error en init:', error);
                }
            }, 500);
        } else {
            debugLog('⏸️ [ROLES] No hay usuario autenticado');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        debugLog('📋 [ROLES] DOM cargado, esperando Firebase...');
        initRolesManagerWhenReady();
    });
} else {
    debugLog('📋 [ROLES] DOM ya listo, esperando Firebase...');
    initRolesManagerWhenReady();
}

debugLog('✅ [ROLES] roles-manager.js cargado');
