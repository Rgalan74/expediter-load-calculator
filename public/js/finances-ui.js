/**
 * finances-ui.js
 * UI update functions for financial module
 * Extracted from finances.js for better organization
 * Version: 1.0.0
 */

// ============================
//  UI MESSAGES & LOADING
// ============================

/**
 * Show finances message/notification
 * @param {string} message - Message to show
 * @param {string} type - Message type (info, success, error, warning)
 */
function showFinancesMessage(message, type = "info") {
    debugFinances(`💬 Mensaje: ${message} (${type})`);

    if (typeof showMessage === "function") {
        showMessage(message, type);
    } else {
        switch (type) {
            case "error":
                debugLog("❌ Finances:", message);
                break;
            case "success":
                debugLog("✅ Finances:", message);
                break;
            case "warning":
                debugLog("⚠️ Finances:", message);
                break;
            default:
                debugLog("ℹ️ Finances:", message);
        }
    }
}

/**
 * Show loading state in finances UI elements
 */
function showFinancesLoading() {
    debugFinances("🔄 Mostrando estado de carga...");

    const elements = [
        "totalRevenue",
        "totalExpensesSummary",
        "netProfit",
        "profitMarginPercent",
        "fuelExpenses",
        "maintenanceExpenses",
        "foodExpenses",
        "otherExpenses",
        "tollExpenses",
        "insuranceExpenses",
        "permitsExpenses",
        "costPerMile",
        "averageRPM",
        "efficiency"
    ];

    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = "...";
    });
}

/**
 * Hide loading state
 */
function hideFinancesLoading() {
    debugFinances("✅ Finalizando estado de carga");

    const loadingEls = document.querySelectorAll(".finances-loading");
    loadingEls.forEach(el => el.classList.add("hidden"));
}

// ============================
//  BUSINESS METRICS UPDATE
// ============================

/**
 * Update business metrics display
 */
function updateBusinessMetrics() {
    debugFinances("📊 Actualizando métricas de negocio...");

    const totalMiles = financesData.reduce((sum, load) => sum + Number(load.totalMiles || 0), 0);
    const totalLoadedMiles = financesData.reduce((sum, load) => sum + Number(load.loadedMiles || 0), 0);
    const totalRevenue = financesData.reduce((sum, load) => sum + Number(load.totalCharge || 0), 0);
    const totalExpenses = expensesData.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0;
    const averageRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const efficiency = totalMiles > 0 ? (totalLoadedMiles / totalMiles) * 100 : 0;

    // Update DOM elements
    const updates = [
        ['costPerMile', formatCurrency(costPerMile)],
        ['averageRPM', formatCurrency(averageRPM)],
        ['efficiency', efficiency.toFixed(1) + '%']
    ];

    updates.forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            debugFinances(`✅ Métrica actualizada ${id}: ${value}`);
        }
    });

    debugFinances("📊 Totales calculados:", {
        totalMiles,
        totalLoadedMiles,
        totalRevenue,
        totalExpenses,
        costPerMile,
        averageRPM,
        efficiency
    });
}

// ============================
//  FINANCIAL KPIs UPDATE
// ============================

/**
 * Update financial KPIs in UI
 */
function updateFinancialKPIs() {
    debugFinances("💰 Actualizando KPIs financieros...");

    // Calculate KPIs using core function
    const kpis = calculateKPIs(financesData, expensesData);

    // Helper to safely update elements
    function updateElementSafe(id, value) {
        const selectors = [
            `#finances #${id}`,
            `#${id}`,
            `[data-kpi="${id}"]`
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                el.textContent = value;
                debugFinances(`✅ Actualizado ${id}: ${value}`);
                return true;
            }
        }
        return false;
    }

    // Update all KPI elements
    updateElementSafe("totalRevenue", formatCurrency(kpis.totalRevenue));
    updateElementSafe("totalExpensesSummary", formatCurrency(kpis.totalExpenses));
    updateElementSafe("netProfit", formatCurrency(kpis.netProfit));
    updateElementSafe("profitMarginPercent", kpis.margin.toFixed(1) + "%");
    updateElementSafe("totalMiles", kpis.totalMiles.toLocaleString());
    updateElementSafe("avgRpm", formatCurrency(kpis.avgRpm));

    debugFinances("✅ KPIs actualizados exitosamente");
}

/**
 * Update KPIs UI - Simplified version
 * @param {Object} kpis - KPIs object with financial metrics
 */
function updateKPIsUI({ totalRevenue, totalExpenses, netProfit, margin }) {
    const netProfitEl = document.querySelector('#finances #netProfit');
    if (netProfitEl) {
        netProfitEl.textContent = formatCurrency(netProfit);
        netProfitEl.style.fontSize = '2rem';
        netProfitEl.style.fontWeight = 'bold';
        netProfitEl.style.textAlign = 'center';
        netProfitEl.style.color = netProfit >= 0 ? '#16a34a' : '#dc2626';
    }

    const marginEl = document.querySelector('#finances #profitMargin');
    if (marginEl) {
        marginEl.textContent = margin.toFixed(1) + '%';
        marginEl.style.fontSize = '1.25rem';
        marginEl.style.fontWeight = '600';
        marginEl.style.color = margin >= 0 ? '#16a34a' : '#dc2626';
    }

    const revenueEl = document.querySelector('#finances #totalRevenue');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(totalRevenue);
    }

    const expensesEl = document.querySelector('#finances #totalExpenses');
    if (expensesEl) {
        expensesEl.textContent = formatCurrency(totalExpenses);
    }
}

// ============================
//  PERIOD SELECTORS
// ============================

/**
 * Populate year selector with available years
 */
function populateYearSelect() {
    const yearSelect = document.getElementById("yearSelect");
    if (!yearSelect) return;

    const years = new Set();

    // Get years from loads
    (allFinancesData || []).forEach(load => {
        if (load.date) {
            const year = load.date.split("-")[0];
            if (year) years.add(year);
        }
    });

    // Get years from expenses
    (allExpensesData || []).forEach(expense => {
        if (expense.date) {
            const year = expense.date.split("-")[0];
            if (year) years.add(year);
        }
    });

    const sortedYears = Array.from(years).sort().reverse();

    yearSelect.innerHTML = `<option value="">${window.i18n?.t('finances.all_years') || 'All Years'}</option>`;
    sortedYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // Set current year as default
    const currentYear = new Date().getFullYear().toString();
    if (sortedYears.includes(currentYear)) {
        yearSelect.value = currentYear;
    }

    debugFinances(`✅ Selector de años poblado: ${sortedYears.length} años`);
}

/**
 * Update month options based on selected year
 */
function updateMonthOptions() {
    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");

    if (!yearSelect || !monthSelect) return;

    const selectedYear = yearSelect.value;

    if (!selectedYear) {
        monthSelect.innerHTML = `<option value="">${window.i18n?.t('finances.all_months') || 'All Months'}</option>`;
        monthSelect.disabled = true;
        return;
    }

    monthSelect.disabled = false;
    const months = new Set();

    // Get months from loads for selected year
    (allFinancesData || []).forEach(load => {
        if (load.date && load.date.startsWith(selectedYear)) {
            const month = load.date.split("-")[1];
            if (month) months.add(month);
        }
    });

    // Get months from expenses for selected year
    (allExpensesData || []).forEach(expense => {
        if (expense.date && expense.date.startsWith(selectedYear)) {
            const month = expense.date.split("-")[1];
            if (month) months.add(month);
        }
    });

    const monthNames = {
        "01": window.i18n?.t('common.month_jan') || 'January',
        "02": window.i18n?.t('common.month_feb') || 'February',
        "03": window.i18n?.t('common.month_mar') || 'March',
        "04": window.i18n?.t('common.month_apr') || 'April',
        "05": window.i18n?.t('common.month_may') || 'May',
        "06": window.i18n?.t('common.month_jun') || 'June',
        "07": window.i18n?.t('common.month_jul') || 'July',
        "08": window.i18n?.t('common.month_aug') || 'August',
        "09": window.i18n?.t('common.month_sep') || 'September',
        "10": window.i18n?.t('common.month_oct') || 'October',
        "11": window.i18n?.t('common.month_nov') || 'November',
        "12": window.i18n?.t('common.month_dec') || 'December'
    };

    const sortedMonths = Array.from(months).sort();

    monthSelect.innerHTML = '<option value="">Todos los meses</option>';
    sortedMonths.forEach(month => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = monthNames[month] || month;
        monthSelect.appendChild(option);
    });

    // Set current month as default if it's the current year
    const currentYear = new Date().getFullYear().toString();
    if (selectedYear === currentYear) {
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
        if (sortedMonths.includes(currentMonth)) {
            monthSelect.value = currentMonth;
        }
    }

    debugFinances(`✅ Meses actualizados para ${selectedYear}: ${sortedMonths.length} meses`);
}

// ============================
//  EXPOSE GLOBALLY
// ============================
if (typeof window !== 'undefined') {
    window.showFinancesMessage = showFinancesMessage;
    window.showFinancesLoading = showFinancesLoading;
    window.hideFinancesLoading = hideFinancesLoading;
    window.updateBusinessMetrics = updateBusinessMetrics;
    window.updateFinancialKPIs = updateFinancialKPIs;
    window.updateKPIsUI = updateKPIsUI;
    window.populateYearSelect = populateYearSelect;
    window.updateMonthOptions = updateMonthOptions;
}

debugFinances("✅ UI module loaded successfully");
