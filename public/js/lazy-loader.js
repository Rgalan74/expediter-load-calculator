// lazy-loader.js - Dynamic Module Loading System
// Version: 1.0.0
// Last Updated: 2025-12-19

/**
 * LAZY LOADING SYSTEM FOR FINANCES MODULES
 * 
 * Este archivo contiene las funciones helper para cargar módulos
 * de finanzas de forma lazy (bajo demanda) para optimizar performance
 * 
 * Módulos soportados:
 * - finances-charts.js (18KB) - Gráficos Chart.js
 * - finances-reports.js (45KB) - Generación de reportes
 * - finances-expenses.js (20KB) - CRUD de gastos
 */

// ========================================
// LOADER HELPERS
// ========================================

/**
 * Carga un script de forma dinámica
 * @param {string} src - Ruta del script
 * @param {string} moduleName - Nombre del módulo para verificación
 * @returns {Promise} Promesa que resuelve cuando el script carga
 */
function loadScript(src, moduleName) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;

        script.onload = () => {
            debugLog(`✅ Módulo cargado: ${moduleName}`);
            resolve();
        };

        script.onerror = () => {
            console.error(`❌ Error cargando módulo: ${moduleName}`);
            reject(new Error(`Failed to load ${moduleName}`));
        };

        document.head.appendChild(script);
    });
}

// ========================================
// CHARTS MODULE LOADER
// ========================================

/**
 * Carga el módulo de gráficos (si no está cargado)
 * Se debe llamar antes de usar funciones de gráficos
 */
async function loadChartsModule() {
    // Si ya está cargado, no hacer nada
    if (window.FinancesCharts) {
        debugLog("📊 Charts module ya está cargado");
        return Promise.resolve();
    }

    debugLog("📊 Cargando Charts module...");

    try {
        await loadScript('js/finances-charts.js?v=1.0.0', 'FinancesCharts');

        // Verificar que se cargó correctamente
        if (!window.FinancesCharts) {
            throw new Error('Charts module no se exportó correctamente');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error cargando Charts module:', error);
        return Promise.reject(error);
    }
}

// ========================================
// REPORTS MODULE LOADER
// ========================================

/**
 * Carga el módulo de reportes (si no está cargado)
 * Se debe llamar antes de generar reportes
 */
async function loadReportsModule() {
    // Si ya está cargado, no hacer nada
    if (window.FinancesReports) {
        debugLog("📄 Reports module ya está cargado");
        return Promise.resolve();
    }

    debugLog("📄 Cargando Reports module...");

    try {
        await loadScript('js/finances-reports.js?v=1.0.0', 'FinancesReports');

        // Verificar que se cargó correctamente
        if (!window.FinancesReports) {
            throw new Error('Reports module no se exportó correctamente');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error cargando Reports module:', error);
        return Promise.reject(error);
    }
}

// ========================================
// EXPENSES MODULE LOADER
// ========================================

/**
 * Carga el módulo de gastos (si no está cargado)
 * Se debe llamar antes de abrir modal de gastos
 */
async function loadExpensesModule() {
    // Si ya está cargado, no hacer nada
    if (window.FinancesExpenses) {
        debugLog("💰 Expenses module ya está cargado");
        return Promise.resolve();
    }

    debugLog("💰 Cargando Expenses module...");

    try {
        await loadScript('js/finances-expenses.js?v=1.0.0', 'FinancesExpenses');

        // Verificar que se cargó correctamente
        if (!window.FinancesExpenses) {
            throw new Error('Expenses module no se exportó correctamente');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error cargando Expenses module:', error);
        return Promise.reject(error);
    }
}

// ========================================
// WRAPPER FUNCTIONS (LAZY LOADED)
// ========================================

/**
 * Wrapper para updateFinancialCharts con lazy loading
 */
async function updateFinancialChartsLazy(context = "global") {
    try {
        await loadChartsModule();
        window.FinancesCharts.updateFinancialCharts(context);
    } catch (error) {
        console.error('Error actualizando gráficos:', error);
        showMessage('Error cargando gráficos', 'error');
    }
}

/**
 * Wrapper para generatePLReport con lazy loading
 */
async function generatePLReportLazy() {
    try {
        await loadReportsModule();
        window.FinancesReports.generatePLReport();
    } catch (error) {
        console.error('Error generando reporte:', error);
        showMessage('Error cargando reporte', 'error');
    }
}

/**
 * Wrapper para generateTaxReport con lazy loading
 */
async function generateTaxReportLazy() {
    try {
        await loadReportsModule();
        window.FinancesReports.generateTaxReport();
    } catch (error) {
        console.error('Error generando reporte fiscal:', error);
        showMessage('Error cargando reporte fiscal', 'error');
    }
}

/**
 * Wrapper para openExpenseModal con lazy loading
 */
async function openExpenseModalLazy(expense = null) {
    try {
        await loadExpensesModule();
        window.FinancesExpenses.openExpenseModal(expense);
    } catch (error) {
        console.error('Error abriendo modal de gastos:', error);
        showMessage('Error cargando modal de gastos', 'error');
    }
}

// ========================================
// EXPORTS
// ========================================

// Export loaders
window.loadChartsModule = loadChartsModule;
window.loadReportsModule = loadReportsModule;
window.loadExpensesModule = loadExpensesModule;

// Export lazy wrappers
window.updateFinancialChartsLazy = updateFinancialChartsLazy;
window.generatePLReportLazy = generatePLReportLazy;
window.generateTaxReportLazy = generateTaxReportLazy;
window.openExpenseModalLazy = openExpenseModalLazy;

console.log("🚀 Lazy loader initialized successfully");
