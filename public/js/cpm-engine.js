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
  // Para confiar en los gastos reales tiene que haber gastos registrados en al
  // menos N meses distintos de la ventana, y combustible entre ellos. Sin esto,
  // alguien con muchas cargas pero casi sin gastos anotados tendria un CPM
  // "real" cercano a cero y todas las cargas parecerian rentables.
  MIN_EXPENSE_MONTHS: 3,
  // Ventanas de los datos reales
  WINDOW_MONTHS: 12,          // gastos que no son combustible
  FUEL_WINDOW_MONTHS: 3,      // combustible (recibos recientes)
  MIN_RECENT_FUEL_MILES: 1000, // millas minimas para confiar en la ventana corta

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

  // Ultimo resultado calculado, de forma sincrona (null si aun no se calculo).
  // Lo usa calculator.js para que calculadora, guardado, panel e Historial
  // trabajen con el MISMO costo por milla.
  current() {
    return this._cache;
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
      const { months, loads, newest } = await this._getDataMaturity(uid);

      if (months >= this.MIN_MONTHS && loads >= this.MIN_LOADS) {
        // CAPA 2 — CPM desde Finanzas reales
        return await this._fromRealData(uid, months, loads, newest);
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
  // Ventana: 12 meses (combustible: recibos de los últimos 3)
  // ============================================================
  async _fromRealData(uid, months, loads, newestLoadMs) {
    const db = firebase.firestore();

    // Las ventanas se cuentan hacia atras desde la ULTIMA CARGA guardada, no
    // desde hoy. Si alguien dejo de rodar hace meses, "los ultimos 12 meses
    // desde hoy" solo veria parte de su periodo de trabajo y meteria meses
    // sin actividad en la cuenta.
    const anchor = newestLoadMs > 0 ? new Date(newestLoadMs) : new Date();
    const toDateStr = (d) => d.toISOString().split('T')[0];
    const monthsAgo = (n) => {
      const d = new Date(anchor.getTime());
      d.setMonth(d.getMonth() - n);
      return toDateStr(d);
    };
    // Tope superior: fin del mes de la ultima carga. Los gastos posteriores
    // (meses sin rodar) no forman parte del costo de operar.
    const upTo = toDateStr(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)));
    const rowDate = (row) => {
      const v = row.date || row.createdAt || '';
      return typeof v === 'string'
        ? v.split('T')[0]
        : (v?.toDate?.()?.toISOString().split('T')[0] || '');
    };

    // Dos ventanas:
    //  - WINDOW_MONTHS (12): todo lo que no es combustible. Reparte gastos
    //    grandes y poco frecuentes (gomas, reparaciones) a lo largo del año.
    //  - FUEL_WINDOW_MONTHS (3): combustible, con los recibos reales mas
    //    recientes, para reflejar antes los cambios de precio.
    const cutoffLong = monthsAgo(this.WINDOW_MONTHS);
    const cutoffFuel = monthsAgo(this.FUEL_WINDOW_MONTHS);

    // Cuentan TODOS los gastos registrados (combustible, comida, hospedaje,
    // peajes, seguro, pago del carro, "otro"...). Solo se excluyen las
    // categorias personalizadas que el usuario marco como NO operativas.
    const allCategories = await window.CustomCategories.getAllCategories();
    const excludedIds = allCategories
      .filter(c => c.isOperational === false)
      .map(c => c.id);

    const [expensesSnap, loadsSnap] = await Promise.all([
      db.collection('expenses').where('userId', '==', uid).where('date', '>=', cutoffLong).get(),
      db.collection('loads').where('userId', '==', uid).where('date', '>=', cutoffLong).get()
    ]);

    let nonFuelTotal = 0;
    let fuelLong = 0;
    let fuelRecent = 0;
    let countExpenses = 0;
    const monthsWithExpenses = new Set();
    const byCategory = {}; // para el desglose "como se calcula" en pantalla
    let afterCount = 0;    // gastos posteriores a la ultima carga (no cuentan)
    let afterTotal = 0;

    expensesSnap.forEach(doc => {
      const expense = doc.data();
      const cat = expense.category || expense.type || '';
      const dateStr = rowDate(expense);

      if (dateStr && dateStr < cutoffLong) return;
      if (dateStr && dateStr > upTo) {
        afterCount++;
        afterTotal += Number(expense.amount || 0);
        return;
      }
      if (excludedIds.includes(cat)) return;
      const amount = Number(expense.amount || 0);
      if (!(amount > 0)) return;

      countExpenses++;
      const catKey = cat || 'other';
      byCategory[catKey] = (byCategory[catKey] || 0) + amount;
      if (cat === 'fuel') {
        fuelLong += amount;
        if (dateStr >= cutoffFuel) fuelRecent += amount;
      } else {
        nonFuelTotal += amount;
      }
      if (dateStr) monthsWithExpenses.add(dateStr.slice(0, 7));
    });

    let milesLong = 0;
    let milesRecent = 0;
    let loadsInWindow = 0;
    let oldestLoadDate = '';
    const monthsWithLoads = new Set();

    loadsSnap.forEach(doc => {
      const load = doc.data();
      const dateStr = rowDate(load);
      if (dateStr && dateStr < cutoffLong) return;

      // Mismo criterio que Historial: las cargas antiguas guardaban las millas
      // con otros nombres de campo. Sin esto contaban 0 millas y el costo por
      // milla salia inflado.
      const miles = Number(
        load.totalMiles ||
        load.miles ||
        (Number(load.loadedMiles || load.loaded || 0) + Number(load.deadheadMiles || load.deadhead || 0))
      ) || 0;
      if (dateStr) monthsWithLoads.add(dateStr.slice(0, 7));
      milesLong += miles;
      if (dateStr >= cutoffFuel) milesRecent += miles;
      loadsInWindow++;
      if (dateStr && (!oldestLoadDate || dateStr < oldestLoadDate)) oldestLoadDate = dateStr;
    });

    if (milesLong === 0) return this._fromConfig(months, loads);

    // Gastos insuficientes para confiar en ellos: seguir con la estimacion
    if (monthsWithExpenses.size < this.MIN_EXPENSE_MONTHS || fuelLong <= 0) {
      debugLog('📊 CPMEngine: gastos reales insuficientes, se usa Configuración', {
        mesesConGastos: monthsWithExpenses.size, fuelLong
      });
      return this._fromConfig(months, loads);
    }

    // Combustible: recibos de los ultimos 3 meses. Si en ese periodo hay pocas
    // millas, o el resultado es menos de la mitad del promedio largo (señal de
    // que faltan recibos recientes por anotar), se usa la ventana completa.
    const fuelCpmLong = fuelLong / milesLong;
    const fuelCpmRecent = milesRecent >= this.MIN_RECENT_FUEL_MILES ? fuelRecent / milesRecent : 0;
    const useRecentFuel = fuelCpmRecent >= fuelCpmLong * 0.5 && fuelCpmRecent > 0;
    const fuelCpm = useRecentFuel ? fuelCpmRecent : fuelCpmLong;

    const nonFuelCpm = nonFuelTotal / milesLong;
    const realCPM = fuelCpm + nonFuelCpm;

    // Millas promedio por mes (para repartir el sueldo del dueño por milla)
    const spanDays = oldestLoadDate
      ? Math.max(30, (anchor.getTime() - new Date(oldestLoadDate).getTime()) / 86400000)
      : 30;
    const spanMonths = Math.min(this.WINDOW_MONTHS, spanDays / 30.44);
    const avgMonthlyMiles = milesLong / spanMonths;

    debugLog('📊 CPMEngine [REAL]:', {
      ventana: `desde ${cutoffLong} (combustible desde ${cutoffFuel})`,
      nonFuelTotal: `$${nonFuelTotal.toFixed(2)}`,
      fuelLong: `$${fuelLong.toFixed(2)}`,
      fuelRecent: `$${fuelRecent.toFixed(2)}`,
      useRecentFuel,
      countExpenses,
      loadsInWindow,
      milesLong: milesLong.toFixed(0),
      milesRecent: milesRecent.toFixed(0),
      realCPM: realCPM.toFixed(4),
      avgMonthlyMiles: avgMonthlyMiles.toFixed(0),
      months,
      loads
    });

    return {
      cpm: parseFloat(realCPM.toFixed(4)),
      source: 'real',
      fuelCpm: parseFloat(fuelCpm.toFixed(4)),
      nonFuelCpm: parseFloat(nonFuelCpm.toFixed(4)),
      fuelWindow: useRecentFuel ? 'recent' : 'long',
      avgMonthlyMiles: Math.round(avgMonthlyMiles),
      label: `Basado en ${loadsInWindow} cargas reales (últimos ${this.WINDOW_MONTHS} meses)`,
      confidence: months >= 6 ? 'high' : 'medium',
      months,
      loads,
      loadsInWindow,
      totalOperational: nonFuelTotal + fuelLong,
      totalMiles: milesLong,
      cutoffDate: cutoffLong,
      // Datos crudos para mostrar al usuario de donde sale el numero
      breakdown: {
        cutoffLong,
        cutoffFuel,
        upTo,
        lastLoadDate: toDateStr(anchor),
        milesLong: Math.round(milesLong),
        milesRecent: Math.round(milesRecent),
        loadsInWindow,
        countExpenses,
        monthsWithLoads: monthsWithLoads.size,
        monthsWithExpenses: monthsWithExpenses.size,
        fuelLong,
        fuelRecent,
        nonFuelTotal,
        afterCount,
        afterTotal,
        useRecentFuel,
        byCategory: Object.keys(byCategory)
          .map(id => {
            const def = allCategories.find(c => c.id === id);
            return { id, name: (def && def.name) || id, total: byCategory[id] };
          })
          .sort((a, b) => b.total - a.total)
      }
    };
  },

  // ============================================================
  // ⚙️ CAPA 1 — CPM desde Configuración del usuario
  // ============================================================
  _fromConfig(months = 0, loads = 0) {
    const costs = window.currentUser?.costs;

    let cpm;
    let label;
    let source;

    // Mismo numero que usa la calculadora (calculator.js getConfigCosts):
    // los componentes de Configuración o, sin configurar, el perfil default.
    const configCosts = typeof window.getConfigCosts === 'function' ? window.getConfigCosts() : null;

    if (costs && costs.isDefault === false && (configCosts?.TOTAL || costs.totalCPM)) {
      // Configuración personalizada guardada
      cpm = configCosts?.TOTAL || costs.totalCPM;
      label = 'Basado en tu configuración';
      source = 'config';
    } else {
      // Sin configuración — usar promedio de industria
      cpm = configCosts?.TOTAL || 0.55;
      label = 'Estimado de industria — configura tu perfil';
      source = 'default';
    }

    const needed = this.MIN_LOADS - loads;

    debugLog('⚙️ CPMEngine [CONFIG]:', { cpm, label, months, loads });

    return {
      cpm: parseFloat(cpm.toFixed(4)),
      source,
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

    return { months, loads, newest };
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
