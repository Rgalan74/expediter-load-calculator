// finances-lazy-override.js - Lazy Loading Override System
// Version: 1.0.0
// Last Updated: 2025-12-19

/**
 * LAZY LOADING OVERRIDE SYSTEM
 * 
 * Este archivo sobrescribe las funciones de finances.js que todavía existen
 * para forzar el uso de lazy loading. Se carga DESPUÉS de finances.js
 * 
 * Las funciones originales en finances.js quedan como fallback si algo falla
 */

// ========================================
// OVERRIDE: EXPENSES FUNCTIONS
// ========================================

// Store original functions as fallback
const _originalOpenExpenseModal = window.openExpenseModal;
const _originalCloseExpenseModal = window.closeExpenseModal;
const _originalSaveExpenseToFirebase = window.saveExpenseToFirebase;
const _originalEditExpense = window.editExpense;
const _originalDeleteExpense = window.deleteExpense;

// Override with lazy loading wrapper
window.openExpenseModal = async function (expense = null) {
    if (typeof window.loadExpensesModule === 'function') {
        try {
            await window.loadExpensesModule();
            if (window.FinancesExpenses && window.FinancesExpenses.openExpenseModal) {
                window.FinancesExpenses.openExpenseModal(expense);
                return;
            }
        } catch (error) {
            console.error('Error loading expenses module, using fallback:', error);
        }
    }
    // Fallback to original
    if (_originalOpenExpenseModal) _originalOpenExpenseModal(expense);
};

window.closeExpenseModal = async function () {
    if (typeof window.loadExpensesModule === 'function') {
        try {
            await window.loadExpensesModule();
            if (window.FinancesExpenses && window.FinancesExpenses.closeExpenseModal) {
                window.FinancesExpenses.closeExpenseModal();
                return;
            }
        } catch (error) {
            console.error('Error loading expenses module, using fallback:', error);
        }
    }
    // Fallback to original
    if (_originalCloseExpenseModal) _originalCloseExpenseModal();
};

window.saveExpenseToFirebase = async function () {
    if (typeof window.loadExpensesModule === 'function') {
        try {
            await window.loadExpensesModule();
            if (window.FinancesExpenses && window.FinancesExpenses.saveExpenseToFirebase) {
                await window.FinancesExpenses.saveExpenseToFirebase();
                return;
            }
        } catch (error) {
            console.error('Error loading expenses module, using fallback:', error);
        }
    }
    // Fallback to original
    if (_originalSaveExpenseToFirebase) await _originalSaveExpenseToFirebase();
};

window.editExpense = async function (id) {
    if (typeof window.loadExpensesModule === 'function') {
        try {
            await window.loadExpensesModule();
            if (window.FinancesExpenses && window.FinancesExpenses.editExpense) {
                await window.FinancesExpenses.editExpense(id);
                return;
            }
        } catch (error) {
            console.error('Error loading expenses module, using fallback:', error);
        }
    }
    // Fallback to original
    if (_originalEditExpense) await _originalEditExpense(id);
};

window.deleteExpense = async function (id) {
    if (typeof window.loadExpensesModule === 'function') {
        try {
            await window.loadExpensesModule();
            if (window.FinancesExpenses && window.FinancesExpenses.deleteExpense) {
                await window.FinancesExpenses.deleteExpense(id);
                return;
            }
        } catch (error) {
            console.error('Error loading expenses module, using fallback:', error);
        }
    }
    // Fallback to original
    if (_originalDeleteExpense) await _originalDeleteExpense(id);
};

// ========================================
// OVERRIDE: REPORTS FUNCTIONS
// ========================================

// Store originals
const _originalGeneratePLReport = window.generatePLReport;
const _originalGenerateTaxReport = window.generateTaxReport;
const _originalExportReportToPDF = window.exportReportToPDF;
const _originalOpenReportModal = window.openReportModal;
const _originalCloseReportModal = window.closeReportModal;

// Override with lazy loading
window.generatePLReport = async function () {
    if (typeof window.loadReportsModule === 'function') {
        try {
            await window.loadReportsModule();
            if (window.FinancesReports && window.FinancesReports.generatePLReport) {
                window.FinancesReports.generatePLReport();
                return;
            }
        } catch (error) {
            console.error('Error loading reports module, using fallback:', error);
        }
    }
    // Fallback
    if (_originalGeneratePLReport) _originalGeneratePLReport();
};

window.generateTaxReport = async function () {
    if (typeof window.loadReportsModule === 'function') {
        try {
            await window.loadReportsModule();
            if (window.FinancesReports && window.FinancesReports.generateTaxReport) {
                window.FinancesReports.generateTaxReport();
                return;
            }
        } catch (error) {
            console.error('Error loading reports module, using fallback:', error);
        }
    }
    // Fallback
    if (_originalGenerateTaxReport) _originalGenerateTaxReport();
};

window.exportReportToPDF = async function () {
    if (typeof window.loadReportsModule === 'function') {
        try {
            await window.loadReportsModule();
            if (window.FinancesReports && window.FinancesReports.exportReportToPDF) {
                window.FinancesReports.exportReportToPDF();
                return;
            }
        } catch (error) {
            console.error('Error loading reports module, using fallback:', error);
        }
    }
    // Fallback
    if (_originalExportReportToPDF) _originalExportReportToPDF();
};

window.openReportModal = async function (type, title, subtitle, icon) {
    if (typeof window.loadReportsModule === 'function') {
        try {
            await window.loadReportsModule();
            if (window.FinancesReports && window.FinancesReports.openReportModal) {
                window.FinancesReports.openReportModal(type, title, subtitle, icon);
                return;
            }
        } catch (error) {
            console.error('Error loading reports module, using fallback:', error);
        }
    }
    // Fallback
    if (_originalOpenReportModal) _originalOpenReportModal(type, title, subtitle, icon);
};

window.closeReportModal = async function () {
    if (typeof window.loadReportsModule === 'function') {
        try {
            await window.loadReportsModule();
            if (window.FinancesReports && window.FinancesReports.closeReportModal) {
                window.FinancesReports.closeReportModal();
                return;
            }
        } catch (error) {
            console.error('Error loading reports module, using fallback:', error);
        }
    }
    // Fallback
    if (_originalCloseReportModal) _originalCloseReportModal();
};

console.log("🚀 Lazy loading overrides applied successfully");
console.log("   - Charts: lazy loaded via finances.js wrappers");
console.log("   - Expenses: lazy loaded via override");
console.log("   - Reports: lazy loaded via override");
