/**
 * finances-core.js
 * Core utilities and base functions for financial module
 * Extracted from finances.js for better organization
 * Version: 1.0.0
 */

// ============================
//  GLOBAL VARIABLES
// ============================
var financesData = [];
var expensesData = [];
var cashFlowChart = null;
var expenseBreakdownChart = null;
var financesLoaded = false;
var allFinancesData = [];
var allExpensesData = [];

// ============================
//  CHART.JS CONFIGURATION
// ============================
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#cbd5e1';
    Chart.defaults.borderColor = 'rgba(59, 130, 246, 0.2)';

    Chart.defaults.plugins.legend.labels.color = '#e2e8f0';
    Chart.defaults.plugins.legend.labels.font = { weight: '600', size: 13 };
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
    Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(59, 130, 246, 0.5)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    debugLog('✅ Chart.js configurado con tema oscuro');
}

// ============================
//  UTILITY FUNCTIONS
// ============================

/**
 * Get period from item (UTC-aware)
 * @param {Object} item - Item with date/createdAt/timestamp
 * @returns {string} Period in YYYY-MM format
 */
function getItemPeriodUTC(item) {
    return getUTCPeriod(item?.date || item?.createdAt || item?.timestamp);
}

/**
 * Debug wrapper for finances module
 * @param {string} message - Debug message
 * @param {any} data - Optional data to log
 */
function debugFinances(message, data) {
    debugLog("💰 [FINANCES] " + message, data || "");
}

/**
 * Normalize dates to local timezone (avoid UTC offsets)
 * @param {Date|string|Object} d - Date to normalize
 * @param {string} mode - 'year', 'month', or 'day'
 * @returns {string|null} Normalized date string
 */
function normalizeDate(d, mode = "month") {
    if (!d) return null;
    let dateObj;
    try {
        if (d.toDate) {
            dateObj = d.toDate(); // Firestore Timestamp
        } else if (typeof d === "string") {
            dateObj = new Date(d); // ISO string or "YYYY-MM-DD"
        } else if (d instanceof Date) {
            dateObj = d;
        } else {
            return null;
        }

        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");

        if (mode === "year") return `${y}`;
        if (mode === "day") return `${y}-${m}-${day}`;
        return `${y}-${m}`; // Default: month in local time
    } catch {
        return null;
    }
}

// ============================
//  CONSOLIDATED KPIs CALCULATION
//  ⚠️ IMPORTANT: This replaces TWO duplicate functions from original
// ============================

/**
 * Calculate financial KPIs from loads and expenses
 * @param {Array} loads - Array of load objects
 * @param {Array} expenses - Array of expense objects
 * @returns {Object} KPIs object with financial metrics
 */
function calculateKPIs(loads = [], expenses = []) {
    const totalRevenue = loads.reduce((sum, load) => sum + (Number(load.totalCharge) || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const totalMiles = loads.reduce((sum, load) => sum + (Number(load.totalMiles) || 0), 0);
    const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

    const kpis = {
        totalRevenue,
        totalExpenses,
        netProfit,
        margin,
        totalMiles,
        avgRpm
    };

    debugLog("💰 [KPIs] Calculados:", kpis);
    return kpis;
}

/**
 * Calculate expense categories breakdown
 * @param {Array} expenses - Array of expense objects
 * @returns {Object} Categories with totals
 */
function calculateExpenseCategories(expenses = []) {
    const categories = {
        fuel: 0,
        maintenance: 0,
        food: 0,
        lodging: 0,
        tolls: 0,
        insurance: 0,
        permits: 0,
        other: 0
    };

    expenses.forEach(expense => {
        const type = (expense.type || expense.category || '').toLowerCase();
        const amount = Number(expense.amount) || 0;

        if (categories.hasOwnProperty(type)) {
            categories[type] += amount;
        } else {
            categories.other += amount;
        }
    });

    return categories;
}

// ============================
//  EXPOSE GLOBALLY
// ============================
if (typeof window !== 'undefined') {
    window.financesData = financesData;
    window.expensesData = expensesData;
    window.allFinancesData = allFinancesData;
    window.allExpensesData = allExpensesData;
    window.cashFlowChart = cashFlowChart;
    window.expenseBreakdownChart = expenseBreakdownChart;
    window.financesLoaded = financesLoaded;

    // Functions
    window.calculateKPIs = calculateKPIs;
    window.calculateExpenseCategories = calculateExpenseCategories;
    window.normalizeDate = normalizeDate;
    window.debugFinances = debugFinances;
    window.getItemPeriodUTC = getItemPeriodUTC;
}

debugFinances("✅ Core module loaded successfully");
