// OK FUNCIÓN INDEPENDIENTE PARA RENDERIZAR GASTOS
async function renderExpensesList(filteredExpenses = []) {
    const expensesList = document.getElementById("expensesList");
    if (!expensesList) return;

    if (!filteredExpenses || filteredExpenses.length === 0) {
        expensesList.innerHTML = `
            <tr>
                <td colspan="5" class="p-4 text-center text-gray-500">
                    No hay gastos registrados para este periodo
                </td>
            </tr>`;
        return;
    }

    const sortedExpenses = filteredExpenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
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
                <button onclick="editExpense('${expense.id}')" class="text-blue-600 hover:underline mr-2">Editar</button>
                <button onclick="deleteExpense('${expense.id}')" class="text-red-600 hover:underline">Eliminar</button>
            </td>
        </tr>`;
    });

    const rows = await Promise.all(rowsPromises);
    expensesList.innerHTML = rows.join("");
    debugFinances(`✅ Lista de gastos renderizada: ${rows.length} elementos`);
}
