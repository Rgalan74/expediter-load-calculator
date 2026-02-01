// custom-categories.js - Custom Expense Categories Manager
// Version: 1.0.0
// Allows users to create and manage custom expense categories

/**
 * CUSTOM CATEGORIES MODULE
 * 
 * Gestiona categorías de gastos personalizadas del usuario
 * Las categorías se almacenan en Firebase Firestore
 */

// Categorías predeterminadas del sistema
const DEFAULT_CATEGORIES = [
    { id: "fuel", name: "Combustible", icon: "🚚", isSystem: true },
    { id: "maintenance", name: "Mantenimiento", icon: "🔧", isSystem: true },
    { id: "food", name: "Comida", icon: "🍔", isSystem: true },
    { id: "lodging", name: "Hospedaje", icon: "🏨", isSystem: true },
    { id: "tolls", name: "Peajes", icon: "🛣️", isSystem: true },
    { id: "insurance", name: "Seguro", icon: "🛡️", isSystem: true },
    { id: "permits", name: "Permisos", icon: "📋", isSystem: true },
    { id: "carpayment", name: "Pago de Auto", icon: "🚗", isSystem: true },
    { id: "other", name: "Otros", icon: "📦", isSystem: true }
];

/**
 * Obtener todas las categorías (sistema + personalizadas)
 * @returns {Promise<Array>} Array de categorías
 */
async function getAllCategories() {
    const user = firebase.auth().currentUser;
    if (!user) return DEFAULT_CATEGORIES;

    try {
        const doc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();

        const customCategories = doc.data()?.customExpenseCategories || [];
        return [...DEFAULT_CATEGORIES, ...customCategories];
    } catch (error) {
        console.error('❌ Error loading custom categories:', error);
        return DEFAULT_CATEGORIES;
    }
}

/**
 * Crear nueva categoría personalizada
 * @param {string} name - Nombre de la categoría
 * @param {string} icon - Emoji/ícono de la categoría
 * @param {string} color - Color hexadecimal
 * @returns {Promise<Object>} Nueva categoría creada
 */
async function createCustomCategory(name, icon, color) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    if (!name || name.trim().length === 0) {
        throw new Error('El nombre de la categoría es requerido');
    }

    const newCategory = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        icon: icon || '📌',
        color: color || '#6b7280',
        isSystem: false,
        createdAt: new Date().toISOString()
    };

    try {
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .set({
                customExpenseCategories: firebase.firestore.FieldValue.arrayUnion(newCategory)
            }, { merge: true });

        console.log('✅ Custom category created:', newCategory);
        return newCategory;
    } catch (error) {
        console.error('❌ Error creating custom category:', error);
        throw error;
    }
}

/**
 * Eliminar categoría personalizada
 * @param {string} categoryId - ID de la categoría a eliminar
 * @returns {Promise<boolean>} True si se eliminó exitosamente
 */
async function deleteCustomCategory(categoryId) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    const categories = await getAllCategories();
    const categoryToDelete = categories.find(c => c.id === categoryId && !c.isSystem);

    if (!categoryToDelete) {
        throw new Error('Categoría no encontrada o no se puede eliminar');
    }

    try {
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .update({
                customExpenseCategories: firebase.firestore.FieldValue.arrayRemove(categoryToDelete)
            });

        console.log('✅ Custom category deleted:', categoryId);
        return true;
    } catch (error) {
        console.error('❌ Error deleting custom category:', error);
        throw error;
    }
}

/**
 * Poblar select de categorías dinámicamente
 * @returns {Promise<void>}
 */
async function populateExpenseCategoriesSelect() {
    const select = document.getElementById('expenseType');
    if (!select) {
        console.warn('⚠️ Select expenseType not found');
        return;
    }

    const categories = await getAllCategories();

    // Limpiar opciones actuales (excepto la primera: "Seleccione una categoría")
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Agregar categorías del sistema
    const systemCategories = categories.filter(c => c.isSystem);
    systemCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon} ${cat.name}`;
        select.appendChild(option);
    });

    // Separador si hay categorías personalizadas
    const customCats = categories.filter(c => !c.isSystem);
    if (customCats.length > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '─── Categorías Personalizadas ───';
        select.appendChild(separator);

        // Agregar categorías personalizadas
        customCats.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = `${cat.icon} ${cat.name}`;
            if (cat.color) {
                option.style.color = cat.color;
                option.style.fontWeight = '600';
            }
            select.appendChild(option);
        });
    }

    console.log(`✅ Loaded ${systemCategories.length} system + ${customCats.length} custom categories`);
}

/**
 * Obtener objeto de labels para reportes
 * @returns {Promise<Object>} Objeto con id: label
 */
async function getCategoryLabels() {
    const categories = await getAllCategories();
    const labels = {};

    categories.forEach(cat => {
        labels[cat.id] = `${cat.icon} ${cat.name}`;
    });

    return labels;
}

/**
 * Obtener nombre de categoría por ID
 * @param {string} categoryId - ID de la categoría
 * @returns {Promise<string>} Nombre formateado de  la categoría
 */
async function getCategoryName(categoryId) {
    const categories = await getAllCategories();
    const category = categories.find(c => c.id === categoryId);

    if (category) {
        return `${category.icon} ${category.name}`;
    }

    return categoryId; // Fallback al ID si no se encuentra
}

// Export functions to window namespace
window.CustomCategories = {
    getAllCategories,
    createCustomCategory,
    deleteCustomCategory,
    populateExpenseCategoriesSelect,
    getCategoryLabels,
    getCategoryName,
    DEFAULT_CATEGORIES
};

console.log("✅ Custom Categories module loaded successfully");
