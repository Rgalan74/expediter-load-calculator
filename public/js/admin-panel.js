/**
 * Admin Panel - Sistema de Gestión de Usuarios y Roles
 * Permite a administradores ver y gestionar usuarios, asignar roles
 */

// ========================================
// LANZAR PANEL DE ADMIN
// ========================================

async function showAdminPanel() {
    // Verificar permisos
    if (!window.rolesManager || !window.rolesManager.isAdmin()) {
        console.error('❌ No tienes permisos para acceder al panel de administración');
        if (typeof showToast === 'function') {
            showToast('No tienes permisos para acceder', 'error');
        }
        return;
    }

    try {
        // Cargar lista de usuarios
        const users = await window.rolesManager.listAllUsers();

        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'adminPanelModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4';
        // Usar z-index alto para el modal de admin
        modal.style.zIndex = '1000';
        modal.innerHTML = generateAdminPanelHTML(users);

        document.body.appendChild(modal);

        // Event listeners
        attachAdminPanelListeners();

    } catch (error) {
        console.error(' Error abriendo panel de admin:', error);
        if (typeof showToast === 'function') {
            showToast('Error al cargar panel: ' + error.message, 'error');
        }
    }
}

function closeAdminPanel() {
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.remove();
    }
}

// ========================================
// GENERAR HTML DEL PANEL
// ========================================

function generateAdminPanelHTML(users) {
    const stats = calculateStats(users);

    return `
        <div class="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 px-8 py-6 flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-3xl font-bold text-white flex items-center gap-3">
                            👑 Panel de Administración
                        </h2>
                        <p class="text-purple-100 mt-1">Gestión de usuarios y roles del sistema</p>
                    </div>
                    <button onclick="closeAdminPanel()" 
                            class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="px-8 py-6 border-b border-gray-200 flex-shrink-0">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    ${generateStatsCards(stats)}
                </div>
            </div>

            <!-- Search & Filters -->
            <div class="px-8 py-4 border-b border-gray-200 flex-shrink-0">
                <div class="flex flex-col sm:flex-row gap-4">
                    <div class="flex-1">
                        <input type="text" 
                               id="adminSearchInput" 
                               placeholder="🔍 Buscar por email o UID..." 
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                               oninput="filterUsers()">
                    </div>
                    <select id="adminFilterRole" 
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            onchange="filterUsers()">
                        <option value="all">Todos los roles</option>
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                        <option value="user">User</option>
                    </select>
                </div>
            </div>

            <!-- Users Table -->
            <div class="flex-1 overflow-y-auto px-8 py-6">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50 sticky top-0">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color: #111827 !important;">
                                    Usuario
                                </th>
                                <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color: #111827 !important;">
                                    Rol Actual
                                </th>
                                <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color: #111827 !important;">
                                    Asignado Por
                                </th>
                                <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color: #111827 !important;">
                                    Fecha Registro
                                </th>
                                <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color: #111827 !important;">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody" class="bg-white divide-y divide-gray-200">
                            ${generateUsersTableRows(users)}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-8 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
                <div class="flex items-center justify-between text-sm text-gray-600">
                    <span>Total: <strong>${users.length}</strong> usuarios</span>
                    <span>Sistema de roles v1.0</span>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// GENERAR COMPONENTES
// ========================================

function calculateStats(users) {
    return {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        developers: users.filter(u => u.role === 'developer').length,
        regularUsers: users.filter(u => !u.role || u.role === 'user').length
    };
}

function generateStatsCards(stats) {
    return `
        <div class="bg-blue-100 border-2 border-blue-400 rounded-xl p-5 shadow-md">
            <div class="text-sm font-bold mb-2 uppercase tracking-wide" style="color: #1e3a8a !important;">TOTAL USUARIOS</div>
            <div class="text-4xl font-extrabold" style="color: #1e3a8a !important;">${stats.total}</div>
        </div>
        <div class="bg-purple-100 border-2 border-purple-400 rounded-xl p-5 shadow-md">
            <div class="text-sm font-bold mb-2 uppercase tracking-wide" style="color: #581c87 !important;">ADMINISTRADORES</div>
            <div class="text-4xl font-extrabold" style="color: #581c87 !important;">${stats.admins}</div>
        </div>
        <div class="bg-green-100 border-2 border-green-400 rounded-xl p-5 shadow-md">
            <div class="text-sm font-bold mb-2 uppercase tracking-wide" style="color: #14532d !important;">DEVELOPERS</div>
            <div class="text-4xl font-extrabold" style="color: #14532d !important;">${stats.developers}</div>
        </div>
        <div class="bg-gray-200 border-2 border-gray-500 rounded-xl p-5 shadow-md">
            <div class="text-sm font-bold mb-2 uppercase tracking-wide" style="color: #1f2937 !important;">USUARIOS</div>
            <div class="text-4xl font-extrabold" style="color: #1f2937 !important;">${stats.regularUsers}</div>
        </div>
    `;
}

function generateUsersTableRows(users) {
    if (!users || users.length === 0) {
        return `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <p class="text-lg font-semibold">No hay usuarios registrados</p>
                </td>
            </tr>
        `;
    }

    return users.map(user => {
        // Asegurar que siempre haya un rol válido
        const role = user.role || 'user';

        const roleConfig = {
            admin: {
                bg: 'bg-purple-100',
                text: 'text-purple-800',
                border: 'border-purple-300',
                bgColor: '#f3e8ff',     // Púrpura claro
                textColor: '#581c87'    // Púrpura oscuro
            },
            developer: {
                bg: 'bg-green-100',
                text: 'text-green-800',
                border: 'border-green-300',
                bgColor: '#dcfce7',     // Verde claro
                textColor: '#14532d'    // Verde oscuro
            },
            user: {
                bg: 'bg-gray-100',
                text: 'text-gray-800',
                border: 'border-gray-300',
                bgColor: '#f3f4f6',     // Gris claro
                textColor: '#1f2937'    // Gris oscuro
            }
        };

        // Obtener configuración con fallback explícito a 'user'
        const config = roleConfig[role] || roleConfig.user;
        const roleColor = `${config.bg} ${config.text} ${config.border}`;

        const createdDate = user.createdAt ?
            (user.createdAt.toDate ? user.createdAt.toDate().toLocaleDateString() : new Date(user.createdAt).toLocaleDateString()) :
            'N/A';

        const assignedBy = user.roleAssignedBy || '-';
        const isCurrentUser = window.currentUser && user.uid === window.currentUser.uid;

        return `
            <tr class="hover:bg-gray-50 transition user-row" data-email="${user.email}" data-uid="${user.uid}" data-role="${role}">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-bold">
                                ${user.email ? user.email.charAt(0).toUpperCase() : '?'}
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">
                                ${user.email || 'Sin email'}
                                ${isCurrentUser ? '<span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Tú</span>' : ''}
                            </div>
                            <div class="text-xs text-gray-500">${user.uid.substring(0, 12)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border-2 ${roleColor}" style="background-color: ${config.bgColor} !important; color: ${config.textColor} !important;">
                        ${role.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${assignedBy}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${createdDate}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${isCurrentUser ?
                '<span class="text-gray-400">No puedes cambiar tu propio rol</span>' :
                `<button class="change-role-btn text-purple-600 hover:text-purple-900 font-semibold cursor-pointer" 
                                data-user-id="${user.uid}" 
                                data-user-email="${user.email}" 
                                data-current-role="${role}">
                            🔧 Cambiar Rol
                        </button>`
            }
                </td>
            </tr>
        `;
    }).join('');
}

// ========================================
// FILTRADO DE USUARIOS
// ========================================

function filterUsers() {
    const searchTerm = document.getElementById('adminSearchInput').value.toLowerCase();
    const roleFilter = document.getElementById('adminFilterRole').value;

    const rows = document.querySelectorAll('.user-row');

    rows.forEach(row => {
        const email = row.dataset.email.toLowerCase();
        const uid = row.dataset.uid.toLowerCase();
        const role = row.dataset.role;

        const matchesSearch = email.includes(searchTerm) || uid.includes(searchTerm);
        const matchesRole = roleFilter === 'all' || role === roleFilter;

        if (matchesSearch && matchesRole) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ========================================
// CAMBIAR ROL
// ========================================

function showChangeRoleModal(userId, userEmail, currentRole) {
    console.log('🔧 showChangeRoleModal called with:', { userId, userEmail, currentRole });

    const modal = document.createElement('div');
    modal.id = 'changeRoleModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4';
    // Z-index mayor que el modal de admin (1000) para aparecer por encima
    modal.style.zIndex = '2000';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div class="mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-2">Cambiar Rol de Usuario</h3>
                <p class="text-sm text-gray-600">
                    Usuario: <strong>${userEmail}</strong>
                </p>
                <p class="text-xs text-gray-500 mt-1">
                    Rol actual: <span class="font-semibold uppercase">${currentRole}</span>
                </p>
            </div>

            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">Seleccionar nuevo rol:</label>
                <div class="space-y-3">
                    <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition ${currentRole === 'admin' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}">
                        <input type="radio" name="newRole" value="admin" class="mr-3" ${currentRole === 'admin' ? 'checked' : ''}>
                        <div class="flex-1">
                            <div class="font-semibold text-purple-900">👑 Admin</div>
                            <div class="text-xs text-gray-600">Control total del sistema</div>
                        </div>
                    </label>
                    
                    <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-green-50 transition ${currentRole === 'developer' ? 'border-green-500 bg-green-50' : 'border-gray-200'}">
                        <input type="radio" name="newRole" value="developer" class="mr-3" ${currentRole === 'developer' ? 'checked' : ''}>
                        <div class="flex-1">
                            <div class="font-semibold text-green-900">💻 Developer</div>
                            <div class="text-xs text-gray-600">Acceso a dev tools y analytics</div>
                        </div>
                    </label>
                    
                    <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition ${currentRole === 'user' ? 'border-gray-500 bg-gray-50' : 'border-gray-200'}">
                        <input type="radio" name="newRole" value="user" class="mr-3" ${currentRole === 'user' ? 'checked' : ''}>
                        <div class="flex-1">
                            <div class="font-semibold text-gray-900">👤 User</div>
                            <div class="text-xs text-gray-600">Usuario estándar</div>
                        </div>
                    </label>
                </div>
            </div>

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <p class="text-xs text-yellow-800">
                    ⚠️ El cambio será inmediato y el usuario será notificado en su próximo inicio de sesión.
                </p>
            </div>

            <div class="flex gap-3">
                <button onclick="closeChangeRoleModal()" 
                        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition">
                    Cancelar
                </button>
                <button onclick="confirmRoleChange('${userId}')" 
                        class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition">
                    Confirmar Cambio
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeChangeRoleModal() {
    const modal = document.getElementById('changeRoleModal');
    if (modal) modal.remove();
}

async function confirmRoleChange(userId) {
    const selectedRole = document.querySelector('input[name="newRole"]:checked')?.value;

    if (!selectedRole) {
        alert('Debes seleccionar un rol');
        return;
    }

    try {
        // Mostrar loading
        const confirmBtn = event.target;
        const originalText = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Cambiando...';

        // Usar rolesManager para asignar rol
        await window.rolesManager.assignRole(userId, selectedRole);

        // Cerrar modales
        closeChangeRoleModal();
        closeAdminPanel();

        // Mostrar éxito
        if (typeof showToast === 'function') {
            showToast(`✅ Rol cambiado a ${selectedRole} exitosamente`, 'success');
        }

        // Reabrir panel actualizado
        setTimeout(() => showAdminPanel(), 1000);

    } catch (error) {
        console.error('Error cambiando rol:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Error: ' + error.message, 'error');
        }
        // Restaurar botón
        event.target.disabled = false;
        event.target.textContent = originalText;
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function attachAdminPanelListeners() {
    // Click fuera del modal para cerrar
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAdminPanel();
            }
        });

        // Event delegation para botones de cambiar rol
        modal.addEventListener('click', (e) => {
            const btn = e.target.closest('.change-role-btn');
            if (btn) {
                const userId = btn.dataset.userId;
                const userEmail = btn.dataset.userEmail;
                const currentRole = btn.dataset.currentRole;
                console.log('🎯 Clicked change role:', { userId, userEmail, currentRole });
                showChangeRoleModal(userId, userEmail, currentRole);
            }
        });
    }
}

// ========================================
// EXPORTAR
// ========================================

window.showAdminPanel = showAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.showChangeRoleModal = showChangeRoleModal;
window.closeChangeRoleModal = closeChangeRoleModal;
window.confirmRoleChange = confirmRoleChange;
window.filterUsers = filterUsers;

console.log('✅ admin-panel.js (new) cargado');
