/**
 * finances-data.js
 * Data loading and processing for financial module
 * Extracted from finances.js - Consolidates duplicate load functions
 * Version: 1.0.0
 */

// ============================
//  PAYMENT FIELDS PROCESSOR
// ============================

/**
 * Ensure all loads have payment status fields
 * Calculates expected payment dates automatically
 * @param {Array} loads - Array of load objects
 * @returns {Array} Loads with payment fields ensured
 */
function ensurePaymentFields(loads) {
    return loads.map(load => {
        if (!load.paymentStatus) {
            // Calculate payment date automatically
            const date = new Date(load.date);
            const dayOfWeek = date.getDay();

            if (dayOfWeek === 0) {
                date.setDate(date.getDate() + 1);
            }

            const daysUntilNextFriday = (5 - date.getDay() + 7) % 7 + 7;
            const paymentDate = new Date(date);
            paymentDate.setDate(date.getDate() + daysUntilNextFriday);

            return {
                ...load,
                paymentStatus: 'pending',
                expectedPaymentDate: paymentDate.toISOString().split('T')[0],
                actualPaymentDate: null,
            };
        }
        return load;
    });
}

// ============================
//  DATA PROCESSORS
// ============================

/**
 * Process a Firestore load document
 * @param {Object} doc - Firestore document
 * @returns {Object} Processed load object
 */
function processLoadDocument(doc) {
    const data = doc.data();
    let date = data.date;

    if (!date && data.createdAt) {
        try {
            date = data.createdAt.toDate().toISOString().split("T")[0];
        } catch (e) {
            date = new Date().toISOString().split("T")[0];
        }
    }
    if (!date) date = new Date().toISOString().split("T")[0];

    return {
        id: doc.id,
        date: date,
        loadNumber: data.loadNumber || "",
        companyName: data.companyName || "",
        origin: data.origin || "-",
        destination: data.destination || "-",

        // Financial fields
        totalMiles: Number(data.totalMiles || 0),
        totalCharge: Number(data.totalCharge || 0),
        netProfit: Number(data.netProfit || 0),
        rpm: Number(data.rpm || 0),
        operatingCost: Number(data.operatingCost || 0),
        fuelCost: Number(data.fuelCost || 0),
        tolls: Number(data.tolls || 0),
        otherCosts: Number(data.otherCosts || 0),
        loadedMiles: Number(data.loadedMiles || 0),

        // Payment fields
        paymentStatus: data.paymentStatus || "pending",
        actualPaymentDate: data.actualPaymentDate || null,
        paymentDate: data.paymentDate || null,
        expectedPaymentDate: data.expectedPaymentDate || null
    };
}

/**
 * Process a Firestore expense document
 * @param {Object} doc - Firestore document
 * @returns {Object} Processed expense object
 */
function processExpenseDocument(doc) {
    const data = doc.data();
    let date = data.date;

    if (!date && data.createdAt) {
        try {
            date = data.createdAt.toDate().toISOString().split("T")[0];
        } catch (e) {
            date = new Date().toISOString().split("T")[0];
        }
    }
    if (!date) date = new Date().toISOString().split("T")[0];

    return {
        id: doc.id,
        date: date,
        amount: Number(data.amount || 0),
        type: data.type || "",
        category: data.category || data.type || "",
        description: data.description || "",
        deductible: data.deductible || false
    };
}

/**
 * Filter data by period
 * @param {Array} items - Array of items with date field
 * @param {string} period - 'all', 'YYYY', or 'YYYY-MM'
 * @returns {Array} Filtered items
 */
function filterByPeriod(items, period) {
    if (period === "all") return items;

    return items.filter(item => {
        const itemDate = item.date;
        if (period.includes("-")) {
            return itemDate.startsWith(period); // YYYY-MM
        } else {
            return itemDate.startsWith(period); // YYYY
        }
    });
}

// ============================
//  MAIN DATA LOADING FUNCTION
//  ⚠️ CONSOLIDATED from loadFinancialData + loadFinancesData
// ============================

/**
 * Load financial data from Firebase
 * Consolidates two previous duplicate functions into one
 * @param {string} period - Period filter ('all', 'YYYY', or 'YYYY-MM')
 * @returns {Promise<Object>} {loads, expenses, kpis}
 */
async function loadFinancialData(period = "all") {
    if (!window.currentUser) {
        throw new Error("Usuario no autenticado");
    }

    const uid = window.currentUser.uid;
    debugFinances("🔄 Cargando TODOS los datos sin filtrar...");

    try {
        // Load all loads from Firebase
        const loadSnapshot = await window.db
            .collection("loads")
            .where("userId", "==", uid)
            .get();

        // Process and ensure payment fields
        allFinancesData = ensurePaymentFields(
            loadSnapshot.docs.map(doc => processLoadDocument(doc))
        );

        // Load all expenses from Firebase
        const expenseSnapshot = await window.db
            .collection("expenses")
            .where("userId", "==", uid)
            .get();

        allExpensesData = expenseSnapshot.docs.map(doc => processExpenseDocument(doc));

        // Filter by period
        const filteredLoads = filterByPeriod(allFinancesData, period);
        const filteredExpenses = filterByPeriod(allExpensesData, period);

        // Update global variables
        window.financesData = filteredLoads;
        window.expensesData = filteredExpenses;
        window.allFinancesData = allFinancesData;
        window.allExpensesData = allExpensesData;

        debugFinances(`✅ Datos cargados: ${filteredLoads.length} cargas, ${filteredExpenses.length} gastos`);
        debugFinances(`📊 Cargas con actualPaymentDate: ${allFinancesData.filter(load => load.actualPaymentDate).length}`);

        // Calculate KPIs
        const kpis = calculateKPIs(filteredLoads, filteredExpenses);

        return {
            loads: filteredLoads,
            expenses: filteredExpenses,
            kpis: kpis
        };

    } catch (error) {
        console.error("❌ Error cargando datos financieros:", error);
        throw error;
    }
}

// ============================
//  LEGACY COMPATIBILITY
//  Keep old function name as alias
// ============================

/**
 * @deprecated Use loadFinancialData instead
 * Kept for backward compatibility
 */
async function loadFinancesData(period = "all") {
    debugFinances("⚠️ loadFinancesData is deprecated, using loadFinancialData");
    return await loadFinancialData(period);
}

// ============================
//  EXPOSE GLOBALLY
// ============================
if (typeof window !== 'undefined') {
    window.loadFinancialData = loadFinancialData;
    window.loadFinancesData = loadFinancesData; // Legacy support
    window.ensurePaymentFields = ensurePaymentFields;
    window.processLoadDocument = processLoadDocument;
    window.processExpenseDocument = processExpenseDocument;
    window.filterByPeriod = filterByPeriod;
}

debugFinances("✅ Data module loaded successfully");
