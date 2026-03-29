// cpm-engine.js - Motor Central de CPM
// Fuente única de verdad para costos por milla
// Version: 1.0.0

/**
 * ============================================================
 * CPM ENGINE — SISTEMA DE DOS CAPAS
 * 
 * Capa 1 (usuario nuevo):    CPM desde Configuración
 * Capa 2 (usuario maduro):   CPM desde Finanzas reales
 *                            Solo categorías isOperational: true
 * 
 * Umbral para Capa 2: 3+ meses de datos Y 20+ cargas
 * ============================================================
 */

const CPMEngine = {

  // ⚙️ Configuración del umbral
  MIN_MONTHS: 3,
  MIN_LOADS: 20,

  // 💾 Cache para no recalcular en cada carga
  _cache: null,
  _cacheTime: null,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos

  // ============================================================
  // 🎯 FUNCIÓN PRINCIPAL — usa esta en todo el sistema
  // ============================================================
  async getCPM() {
    // Revisar cache
    if (this._cache && (Date.now() - this._cacheTime) < this.CACHE_TTL) {
      return this._cache;
    }

    const result = await this._calculate();
    this._cache = result;
    this._cacheTime = Date.now();
    return result;
  },

  // Limpiar cache cuando se guarda configuración o nuevos gastos
  clearCache() {
    this._cache = null;
    this._cacheTime = null;
  },

  // ============================================================
  // 🧮 CÁLCULO PRINCIPAL
  // ============================================================
  async _calculate() {
    try {
      const uid = window.currentUser?.uid;
      if (!uid) return this._fromConfig();

      // Verificar si hay suficientes datos reales
      const { months, loads } = await this._getDataMaturity(uid);

      if (months >= this.MIN_MONTHS && loads >= this.MIN_LOADS) {
        // CAPA 2 — CPM desde Finanzas reales
        return await this._fromRealData(uid, months, loads);
      } else {
        // CAPA 1 — CPM desde Configuración
        return this._fromConfig(months, loads);
      }

    } catch (error) {
      debugLog('❌ CPMEngine error:', error);
      return this._fromConfig();
    }
  },

  // ============================================================
  // 📊 CAPA 2 — CPM desde datos reales de Finanzas
  // Solo suma gastos con isOperational: true
  // Solo usa los últimos 6 meses como ventana de referencia
  // ============================================================
  async _fromRealData(uid, months, loads) {
    const db = firebase.firestore();

    // Ventana de 6 meses hacia atrás desde hoy
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffDate = sixMonthsAgo.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // Cargar categorías operacionales
    const allCategories = await window.CustomCategories.getAllCategories();
    const operationalIds = allCategories
      .filter(c => c.isOperational === true)
      .map(c => c.id);

    // Cargar gastos del usuario (todos, filtramos por fecha en cliente)
    const expensesSnap = await db.collection('expenses')
      .where('userId', '==', uid)
      .get();

    // Sumar solo gastos operacionales de los últimos 6 meses
    let totalOperational = 0;
    let countOperational = 0;
    let countSkipped = 0;

    expensesSnap.forEach(doc => {
      const expense = doc.data();
      const cat = expense.category || expense.type || '';

      // Filtrar por fecha — solo últimos 6 meses
      const expenseDate = expense.date || expense.createdAt || '';
      const dateStr = typeof expenseDate === 'string'
        ? expenseDate.split('T')[0]
        : expenseDate?.toDate?.()?.toISOString().split('T')[0] || '';

      if (dateStr && dateStr < cutoffDate) {
        countSkipped++;
        return; // ignorar gastos más viejos de 6 meses
      }

      if (operationalIds.includes(cat)) {
        totalOperational += Number(expense.amount || 0);
        countOperational++;
      }
    });

    // Cargar millas de los últimos 6 meses
    const loadsSnap = await db.collection('loads')
      .where('userId', '==', uid)
      .get();

    let totalMiles = 0;
    let loadsInWindow = 0;

    loadsSnap.forEach(doc => {
      const load = doc.data();
      const loadDate = load.date || load.createdAt || '';
      const dateStr = typeof loadDate === 'string'
        ? loadDate.split('T')[0]
        : loadDate?.toDate?.()?.toISOString().split('T')[0] || '';

      if (dateStr && dateStr < cutoffDate) return; // ignorar más viejas de 6 meses

      totalMiles += Number(load.totalMiles || 0);
      loadsInWindow++;
    });

    if (totalMiles === 0) return this._fromConfig();

    const realCPM = totalOperational / totalMiles;

    debugLog('📊 CPMEngine [REAL - últimos 6 meses]:', {
      ventana: `desde ${cutoffDate}`,
      totalOperational: `$${totalOperational.toFixed(2)}`,
      countOperational,
      countSkipped,
      loadsInWindow,
      totalMiles: totalMiles.toFixed(0),
      realCPM: realCPM.toFixed(4),
      months,
      loads
    });

    return {
      cpm: parseFloat(realCPM.toFixed(4)),
      source: 'real',
      label: `Basado en ${loadsInWindow} cargas reales (últimos 6 meses)`,
      confidence: months >= 6 ? 'high' : 'medium',
      months,
      loads,
      loadsInWindow,
      totalOperational,
      totalMiles,
      cutoffDate
    };
  },

  // ============================================================
  // ⚙️ CAPA 1 — CPM desde Configuración del usuario
  // ============================================================
  _fromConfig(months = 0, loads = 0) {
    const costs = window.currentUser?.costs;

    let cpm;
    let label;

    if (costs && costs.isDefault === false && costs.totalCPM) {
      // Configuración personalizada guardada
      cpm = costs.totalCPM;
      label = 'Basado en tu configuración';
    } else {
      // Sin configuración — usar promedio de industria
      cpm = 0.55;
      label = 'Estimado de industria — configura tu perfil';
    }

    const needed = this.MIN_LOADS - loads;

    debugLog('⚙️ CPMEngine [CONFIG]:', { cpm, label, months, loads });

    return {
      cpm: parseFloat(cpm.toFixed(4)),
      source: 'config',
      label,
      confidence: 'low',
      months,
      loads,
      neededLoads: needed > 0 ? needed : 0,
      message: needed > 0
        ? `Necesitas ${needed} cargas más para usar datos reales`
        : null
    };
  },

  // ============================================================
  // 📅 VERIFICAR MADUREZ DE DATOS
  // ============================================================
  async _getDataMaturity(uid) {
    const db = firebase.firestore();

    const loadsSnap = await db.collection('loads')
      .where('userId', '==', uid)
      .get();

    const loads = loadsSnap.size;
    if (loads === 0) return { months: 0, loads: 0 };

    // Calcular rango de fechas
    let oldest = Date.now();
    let newest = 0;

    loadsSnap.forEach(doc => {
      const data = doc.data();
      const date = data.date || data.createdAt || data.timestamp;
      if (date) {
        const ts = date.toDate ? date.toDate().getTime() : new Date(date).getTime();
        if (ts < oldest) oldest = ts;
        if (ts > newest) newest = ts;
      }
    });

    const months = Math.floor((newest - oldest) / (1000 * 60 * 60 * 24 * 30));

    return { months, loads };
  }
};

// ============================================================
// 🌐 FUNCIÓN GLOBAL — llama esta desde calculator y Lex
// ============================================================
window.getCPMForCalculator = async function() {
  const result = await CPMEngine.getCPM();
  return result.cpm;
};

// Exponer el engine completo para cuando necesites más info
window.CPMEngine = CPMEngine;

// Limpiar cache cuando se guarda configuración
document.addEventListener('configSaved', () => CPMEngine.clearCache());
document.addEventListener('expenseSaved', () => CPMEngine.clearCache());

debugLog('✅ CPM Engine cargado');
