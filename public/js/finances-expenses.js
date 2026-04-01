// finances-expenses.js - Expense CRUD Operations Module
// Version: 1.0.0
// Dependencies: Firebase, finances-core.js
// Last Updated: 2025-12-19

/**
 * FINANCES EXPENSES MODULE
 * 
 * Este módulo contiene todas las operaciones CRUD para gastos
 * Se carga de forma lazy (bajo demanda) para reducir el bundle inicial
 * 
 * Funciones incluidas:
 * - saveExpenseToFirebase() - Guardar/editar gasto
 * - editExpense(id) - Editar gasto existente
 * - deleteExpense(id) - Eliminar gasto
 * - openExpenseModal(expense) - Abrir modal de gastos
 * - closeExpenseModal() - Cerrar modal
 * - renderExpensesList(expenses) - Renderizar lista de gastos
 * - updateExpenseCategories(expenses) - Actualizar categorías
 */

// ========================================
// GUARDAR/ACTUALIZAR GASTO
// ========================================

// Estado de ordenamiento para gastos
window.currentExpenseSort = { column: 'date', asc: false }; // Default: ms recientes primero

async function saveExpenseToFirebase() {
    // ✅ VERIFICAR QUE LOS ELEMENTOS EXISTEN PRIMERO
    const amountEl = document.getElementById("expenseAmount");
    const typeEl = document.getElementById("expenseType");
    const descEl = document.getElementById("expenseDescription");
    const dateEl = document.getElementById("expenseDate");

    // Verificación de elementos antes de acceder a .value
    if (!amountEl || !typeEl || !descEl || !dateEl) {
        debugLog("❌ Elementos del formulario de gastos no encontrados");
        showFinancesMessage(window.i18n?.t('finances.form_not_available') || "Error: Form not available. Try reloading the page.", "error");
        return;
    }

    const amount = parseFloat(amountEl.value.trim());
    const type = typeEl.value.trim().toLowerCase();
    const description = descEl.value.trim();
    const date = dateEl.value;

    if (!window.currentUser) {
        showFinancesMessage(window.i18n?.t('finances.sign_in_required') || "Please sign in", "error");
        return;
    }

    if (!amount || amount <= 0 || !type || !date) {
        showFinancesMessage(window.i18n?.t('finances.all_fields_required') || "All fields are required", "error");
        return;
    }

    const expense = {
        userId: window.currentUser.uid,
        amount,
        type,
        description,
        date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const modal = document.getElementById("expenseModal");
    const editId = modal ? modal.dataset.editId : "";

    const saveBtn = document.querySelector("#expenseModal button[type='submit']");
    if (saveBtn) saveBtn.disabled = true;

    try {
        if (editId) {
            await firebase.firestore().collection("expenses").doc(editId).update(expense);
            debugFinances(`✅ Gasto actualizado (${editId}):`, expense);
            showFinancesMessage(window.i18n?.t('finances.expense_updated_ok') || "✅ Expense updated successfully", "success");
            if (window.showToast) {
                showToast(window.i18n?.t('finances.expense_updated_ok') || '✅ Expense updated successfully', 'success');
            }
        } else {
            const docRef = await firebase.firestore().collection("expenses").add(expense);
            debugFinances(`✅ Gasto agregado (${docRef.id}):`, expense);
            showFinancesMessage(window.i18n?.t('finances.expense_saved_ok') || "✅ Expense saved successfully", "success");
            if (window.showToast) {
                showToast(window.i18n?.t('finances.expense_saved_ok') || '✅ Expense saved successfully', 'success');
            }
        }

        document.dispatchEvent(new Event('expenseSaved'));
        if (window.CPMEngine) window.CPMEngine.clearCache();
        if (modal) modal.dataset.editId = ""; // reset
        closeExpenseModal();
        loadFinancesData();
    } catch (error) {
        debugFinances("❌ Error guardando gasto:", error);
        showFinancesMessage(window.i18n?.t('finances.expense_save_error') || "❌ Could not save expense", "error");
        if (window.showToast) {
            showToast(window.i18n?.t('finances.expense_save_error') || '❌ Could not save expense', 'error');
        }
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// ========================================
// EDITAR GASTO
// ========================================

async function editExpense(id) {
    try {
        const doc = await firebase.firestore().collection("expenses").doc(id).get();

        if (!doc.exists) {
            showFinancesMessage(window.i18n?.t('finances.expense_not_found') || "❌ Expense not found", "error");
            return;
        }

        const exp = { id, ...doc.data() };

        // Guardar ID de edición en el modal
        const modal = document.getElementById("expenseModal");
        if (modal) modal.dataset.editId = id;

        // Reutilizar openExpenseModal con datos cargados
        openExpenseModal(exp);

        debugFinances(`📝 Editando gasto (${id}):`, exp);
    } catch (err) {
        debugFinances("❌ Error al editar gasto:", err);
        showFinancesMessage(window.i18n?.t('finances.expense_load_error') || "❌ Could not load expense", "error");
    }
}

// ========================================
// ELIMINAR GASTO
// ========================================

async function deleteExpense(id) {
    if (!confirm(window.i18n?.t('finances.confirm_delete_expense') || 'Are you sure you want to delete this expense?')) {
        return;
    }

    try {
        await firebase.firestore().collection("expenses").doc(id).delete();
        if (window.CPMEngine) window.CPMEngine.clearCache();
        debugFinances(`✅ Gasto eliminado (${id})`);
        showFinancesMessage(window.i18n?.t('finances.expense_deleted_ok') || "✅ Expense deleted successfully", "success");
        if (window.showToast) {
            showToast(window.i18n?.t('finances.expense_deleted_ok') || '✅ Expense deleted successfully', 'success');
        }
        loadFinancesData(); // Refresh
    } catch (error) {
        debugFinances("❌ Error eliminando gasto:", error);
        showFinancesMessage(window.i18n?.t('finances.expense_delete_error') || "❌ Could not delete expense", "error");
        if (window.showToast) {
            showToast(window.i18n?.t('finances.expense_delete_error') || '❌ Could not delete expense', 'error');
        }
    }
}

// ========================================
// ABRIR MODAL DE GASTOS
// ========================================

async function openExpenseModal(expense = null) {
    debugFinances("📝 Abriendo modal de gastos...");
    const modal = document.getElementById('expenseModal');
    if (!modal) {
        debugFinances("❌ Modal de gastos no encontrado");
        return;
    }

    // Mostrar modal
    modal.classList.remove('hidden');

    // Inputs del modal
    const dateEl = document.getElementById('expenseDate');
    const typeEl = document.getElementById('expenseType');
    const descEl = document.getElementById('expenseDescription');
    const amountEl = document.getElementById('expenseAmount');

    if (expense) {
        // 📝 Editar gasto existente
        dateEl.value = expense.date || new Date().toISOString().split('T')[0];
        typeEl.value = expense.type || "";
        descEl.value = expense.description || "";
        amountEl.value = expense.amount || 0;
    } else {
        // ➕ Nuevo gasto
        dateEl.value = new Date().toISOString().split('T')[0];
        typeEl.value = "";
        descEl.value = "";
        amountEl.value = "";
    }

    // Cargar categorías personalizadas en el dropdown
    if (window.CustomCategories && window.CustomCategories.populateExpenseCategoriesSelect) {
        await window.CustomCategories.populateExpenseCategoriesSelect();
    }
}

// ========================================
// CERRAR MODAL DE GASTOS
// ========================================

function closeExpenseModal() {
    debugFinances("❌ Cerrando modal de gastos...");
    const modal = document.getElementById("expenseModal");
    if (!modal) return;

    // Ocultar modal
    modal.classList.add("hidden");

    // Resetear modo edición
    modal.dataset.editId = "";

    // Limpiar campos del formulario
    const fields = ["expenseDate", "expenseType", "expenseDescription", "expenseAmount"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

// ========================================
// RENDERIZAR LISTA DE GASTOS
// ========================================

// OK FUNCIÓN INDEPENDIENTE PARA RENDERIZAR GASTOS
async function renderExpensesList(filteredExpenses = []) {
    const expensesList = document.getElementById("expensesList");
    if (!expensesList) return;

    if (!filteredExpenses || filteredExpenses.length === 0) {
        expensesList.innerHTML = `
            <tr>
                <td colspan="5" class="p-4 text-center text-gray-500">
                    ${window.i18n?.t('finances.no_expenses_period') || 'No expenses registered for this period'}
                </td>
            </tr>`;
        return;
    }

    const sortedExpenses = filteredExpenses
        .sort((a, b) => {
            const { column, asc } = window.currentExpenseSort;
            let valA = a[column];
            let valB = b[column];

            // Manejo de valores nulos
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            // Comparación numérica (amount)
            if (column === 'amount') {
                return asc ? (parseFloat(valA) - parseFloat(valB)) : (parseFloat(valB) - parseFloat(valA));
            }

            // Comparación de fechas
            if (column === 'date') {
                const dateA = new Date(valA || '1970-01-01');
                const dateB = new Date(valB || '1970-01-01');
                return asc ? dateA - dateB : dateB - dateA;
            }

            // Comparación de texto (type, description)
            return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        })
        .slice(0, 10);

    const categoryIcons = {
        fuel: "⛽", maintenance: "🔧", food: "🍔", lodging: "🏨",
        tolls: "🛣️", insurance: "🛡️", permits: "📄", carpayment: "🚗", other: "📌"
    };

    // Obtener nombres de categorías (incluyendo personalizadas)
    const rowsPromises = sortedExpenses.map(async expense => {
        let categoryDisplay = expense.type;

        // Si es una categoría personalizada (custom-*), obtener el nombre real
        if (expense.type && expense.type.startsWith('custom-') && window.CustomCategories) {
            categoryDisplay = await window.CustomCategories.getCategoryName(expense.type);
        } else {
            // Categorías del sistema
            const icon = categoryIcons[expense.type] || "📌";
            categoryDisplay = `${icon} ${expense.type}`;
        }

        return `
        <tr class="hover:bg-gray-50">
            <td class="p-2 text-sm">${expense.date || "-"}</td>
            <td class="p-2 text-sm">${categoryDisplay}</td>
            <td class="p-2 text-sm">${expense.description || "-"}</td>
            <td class="p-2 text-sm font-semibold">${formatCurrency(expense.amount)}</td>
            <td class="p-2 text-sm">
                <button onclick="editExpense('${expense.id}')" class="text-blue-600 hover:underline mr-2">${window.i18n?.t('finances.btn_edit') || 'Edit'}</button>
                <button onclick="deleteExpense('${expense.id}')" class="text-red-600 hover:underline">${window.i18n?.t('finances.btn_delete') || 'Delete'}</button>
            </td>
        </tr>`;
    });

    const rows = await Promise.all(rowsPromises);
    expensesList.innerHTML = rows.join("");
    debugFinances(`✅ Lista de gastos renderizada: ${rows.length} elementos`);
}

// ========================================
// ACTUALIZAR CATEGORÍAS
// ========================================

// ==============================
//  FUNCIÓN updateExpenseCategories SIMPLIFICADA
// ==============================
function updateExpenseCategories(expenses = []) {
    debugLog("📊 Actualizando categorias de gastos...");

    const categories = calculateExpenseCategories(expenses);
    debugLog("✅ Categorias calculadas:", categories);

    // Las categorías se procesan para la tabla de gastos y gráficos
    // Ya NO intentamos actualizar elementos DOM individuales
    return categories;
}

// ========================================
// EXPORTS
// ========================================

// Export to window namespace
window.FinancesExpenses = {
    saveExpenseToFirebase,
    editExpense,
    deleteExpense,
    openExpenseModal,
    closeExpenseModal,
    renderExpensesList,
    updateExpenseCategories
};

// También exportar funciones individuales para compatibilidad
window.saveExpenseToFirebase = saveExpenseToFirebase;
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.openExpenseModal = openExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.renderExpensesList = renderExpensesList;
window.updateExpenseCategories = updateExpenseCategories;

// ========================================
// FUNCIONES DE ORDENAMIENTO (NUEVO)
// ========================================

function sortExpensesBy(column) {
    if (window.currentExpenseSort.column === column) {
        window.currentExpenseSort.asc = !window.currentExpenseSort.asc;
    } else {
        window.currentExpenseSort.column = column;
        window.currentExpenseSort.asc = true;

        // Fecha y Monto mejor descendente por defecto
        if (column === 'date' || column === 'amount') {
            window.currentExpenseSort.asc = false;
        }
    }

    updateExpenseSortIcons();

    // Necesitamos los gastos actuales para re-renderizar. 
    // Como no tenemos variable global de gastos filtrados aqu, 
    // recargamos los datos (que activar renderExpensesList)
    if (typeof loadFinancesData === 'function') {
        loadFinancesData();
    } else {
        debugLog("loadFinancesData no disponible para re-renderizar gastos");
    }
}

function updateExpenseSortIcons() {
    ['date', 'type', 'description', 'amount'].forEach(col => {
        const icon = document.getElementById(`sort-exp-${col}`);
        if (icon) {
            if (window.currentExpenseSort.column === col) {
                icon.textContent = window.currentExpenseSort.asc ? '↑' : '↓';
                icon.className = 'ml-1 text-blue-600 font-bold';
            } else {
                icon.textContent = '↕';
                icon.className = 'ml-1 text-gray-400';
            }
        }
    });
}

// Exports adicionales
window.sortExpensesBy = sortExpensesBy;
window.updateExpenseSortIcons = updateExpenseSortIcons;

debugLog("💰 Expenses module loaded successfully");
