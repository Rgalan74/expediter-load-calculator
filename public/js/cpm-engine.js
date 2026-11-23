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
  WINDOW_MONTHS: 12,          // meses CON ACTIVIDAD que entran en el calculo
  FUEL_WINDOW_MONTHS: 3,      // combustible: recibos de los ultimos 3 meses activos
  MIN_ACTIVE_MONTH_MILES: 300, // minimo absoluto para contar un mes como activo
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
  // Ventana: 12 meses (combustible: recibos de los últimos 3)
  // ============================================================
  async _fromRealData(uid, months, loads) {
    const db = firebase.firestore();

    const rowDate = (row) => {
      const v = row.date || row.createdAt || '';
      return typeof v === 'string'
        ? v.split('T')[0]
        : (v?.toDate?.()?.toISOString().split('T')[0] || '');
    };
    // Mismo criterio que Historial: las cargas antiguas guardaban las millas
    // con otros nombres de campo.
    const loadMiles = (load) => Number(
      load.totalMiles ||
      load.miles ||
      (Number(load.loadedMiles || load.loaded || 0) + Number(load.deadheadMiles || load.deadhead || 0))
    ) || 0;

    // ── 1. Meses con actividad ────────────────────────────────────────
    // El periodo NO son "12 meses de calendario": son los ultimos 12 meses en
    // los que el usuario realmente trabajo. Asi una pausa (o una sola carga
    // suelta despues de meses parado) no mete meses sin actividad en la cuenta.
    const loadsSnap = await db.collection('loads').where('userId', '==', uid).get();

    const milesByMonth = {};
    const loadsByMonth = {};
    const daysByMonth = {};
    loadsSnap.forEach(doc => {
      const load = doc.data();
      const dateStr = rowDate(load);
      if (!dateStr) return;
      const ym = dateStr.slice(0, 7);
      milesByMonth[ym] = (milesByMonth[ym] || 0) + loadMiles(load);
      loadsByMonth[ym] = (loadsByMonth[ym] || 0) + 1;
      if (loadMiles(load) > 0) daysByMonth[ym] = (daysByMonth[ym] || 0) + this.estimateTripDays(loadMiles(load));
    });

    const monthsWithMiles = Object.keys(milesByMonth).filter(ym => milesByMonth[ym] > 0);
    if (monthsWithMiles.length === 0) return this._fromConfig(months, loads);

    // Un mes cuenta como "activo" si tiene al menos el 25% de las millas de un
    // mes tipico del usuario (mediana), con un minimo absoluto.
    const sortedMiles = monthsWithMiles.map(ym => milesByMonth[ym]).sort((a, b) => a - b);
    const median = sortedMiles[Math.floor(sortedMiles.length / 2)];
    const minActiveMiles = Math.max(this.MIN_ACTIVE_MONTH_MILES, median * 0.25);

    const activeMonths = monthsWithMiles
      .filter(ym => milesByMonth[ym] >= minActiveMiles)
      .sort()               // 'YYYY-MM' ordena cronologicamente
      .reverse()
      .slice(0, this.WINDOW_MONTHS);   // los mas recientes primero
    if (activeMonths.length === 0) return this._fromConfig(months, loads);

    const activeSet = new Set(activeMonths);
    const fuelSet = new Set(activeMonths.slice(0, this.FUEL_WINDOW_MONTHS));
    const firstMonth = activeMonths[activeMonths.length - 1];
    const lastMonth = activeMonths[0];
    const fuelMonthsList = activeMonths.slice(0, this.FUEL_WINDOW_MONTHS);
    const fuelFirstMonth = fuelMonthsList[fuelMonthsList.length - 1];

    let milesLong = 0;
    let travelDays = 0;
    let milesRecent = 0;
    let loadsInWindow = 0;
    activeMonths.forEach(ym => {
      milesLong += milesByMonth[ym];
      travelDays += daysByMonth[ym] || 0;
      loadsInWindow += loadsByMonth[ym];
      if (fuelSet.has(ym)) milesRecent += milesByMonth[ym];
    });
    if (milesLong === 0) return this._fromConfig(months, loads);

    // ── 2. Gastos de esos meses ───────────────────────────────────────
    // Cuentan TODOS los gastos registrados (combustible, comida, hospedaje,
    // seguro, pago del carro, "otro"...). Se excluyen las categorias
    // personalizadas que el usuario marco como NO operativas y los PEAJES:
    // el peaje es costo de cada carga y la calculadora ya lo suma por carga;
    // dentro del CPM se contaria dos veces.
    const allCategories = await window.CustomCategories.getAllCategories();
    // Fijos mensuales: cubiertos por Configuracion (importe actual), no por el historial
    const fixedIds = new Set(['insurance', 'carpayment', 'permits']);
    allCategories.forEach(c => { if (c && c.isFixed === true) fixedIds.add(c.id); });
    const excludedIds = allCategories
      .filter(c => c.isOperational === false)
      .map(c => c.id);

    const expensesSnap = await db.collection('expenses')
      .where('userId', '==', uid)
      .where('date', '>=', firstMonth + '-01')
      .get();

    let nonFuelTotal = 0;
    // Hospedaje (hotel) por milla. El nombre "foodLodging" se conserva por
    // compatibilidad; desde 2026-11-23 la comida ya no entra (ver foodTotal).
    let foodLodgingTotal = 0;
    let foodTotal = 0;          // comida: gasto personal, solo informativo
    let fixedHistTotal = 0;     // fijos mensuales registrados (solo para comparar)
    let fuelLong = 0;
    let fuelRecent = 0;
    let countExpenses = 0;
    const monthsWithExpenses = new Set();
    const byCategory = {};  // para el desglose "como se calcula" en pantalla
    let outsideCount = 0;   // gastos en meses sin actividad (no cuentan)
    let outsideTotal = 0;

    expensesSnap.forEach(doc => {
      const expense = doc.data();
      const cat = expense.category || expense.type || '';
      const dateStr = rowDate(expense);
      const amount = Number(expense.amount || 0);
      if (!(amount > 0)) return;

      // Cuentan los gastos desde el primer hasta el ultimo mes activo,
      // INCLUIDOS los de un mes de pausa intermedio: el seguro y el pago del
      // carro se siguen pagando aunque ese mes no se ruede, y las cargas tienen
      // que cubrirlos. Solo quedan fuera los posteriores al ultimo mes activo
      // (cuando ya no se esta operando).
      const ym = dateStr ? dateStr.slice(0, 7) : '';
      if (!ym || ym < firstMonth || ym > lastMonth) {
        outsideCount++;
        outsideTotal += amount;
        return;
      }
      if (excludedIds.includes(cat)) return;
      if (String(cat).toLowerCase() === 'tolls') return;

      countExpenses++;
      monthsWithExpenses.add(ym);
      // Comida: gasto personal (decision de Ricardo, 2026-11-23). Se ve en
      // Finanzas, pero no entra en el costo por milla de las cargas.
      if (cat === 'food') { foodTotal += amount; return; }
      const catKey = cat || 'other';
      byCategory[catKey] = (byCategory[catKey] || 0) + amount;
      if (cat === 'fuel') {
        fuelLong += amount;
        if (ym >= fuelFirstMonth) fuelRecent += amount;
      } else {
        nonFuelTotal += amount;
        if (cat === 'lodging') foodLodgingTotal += amount;
        else if (fixedIds.has(cat)) fixedHistTotal += amount;
      }
    });

    // Gastos insuficientes para confiar en ellos: seguir con la estimacion
    if (monthsWithExpenses.size < this.MIN_EXPENSE_MONTHS || fuelLong <= 0) {
      debugLog('📊 CPMEngine: gastos reales insuficientes, se usa Configuración', {
        mesesConGastos: monthsWithExpenses.size, fuelLong
      });
      return this._fromConfig(months, loads);
    }

    // ── 3. Costo por milla ────────────────────────────────────────────
    // Combustible: recibos de los ultimos 3 meses activos. Si en ese periodo
    // hay pocas millas, o el resultado es menos de la mitad del promedio largo
    // (señal de que faltan recibos por anotar), se usa el periodo completo.
    const fuelCpmLong = fuelLong / milesLong;
    const fuelCpmRecent = milesRecent >= this.MIN_RECENT_FUEL_MILES ? fuelRecent / milesRecent : 0;
    const useRecentFuel = fuelCpmRecent >= fuelCpmLong * 0.5 && fuelCpmRecent > 0;
    const receiptsFuelCpm = useRecentFuel ? fuelCpmRecent : fuelCpmLong;
    const current = this.currentFuel();
    const fuelCpm = current ? current.cpm : receiptsFuelCpm;

    // Hospedaje: gasto general del mes repartido POR MILLA (decision de Ricardo,
    // 2026-11-22). No depende de una carga concreta (el hotel se paga sobre todo
    // esperando carga), asi que cada milla paga su parte. La comida no entra
    // (gasto personal, decision 2026-11-23).
    // foodPerDay se conserva solo como dato informativo.
    const foodPerDay = travelDays > 0 ? foodLodgingTotal / travelDays : 0;
    const foodLodgingCpm = foodLodgingTotal / milesLong;
    const otherCpm = (nonFuelTotal - foodLodgingTotal) / milesLong;
    // Sin los fijos mensuales (los pone Configuracion, sin contarlos dos veces)
    const otherVarCpm = (nonFuelTotal - foodLodgingTotal - fixedHistTotal) / milesLong;
    // Meses del periodo (primero a ultimo activo, pausas incluidas): para el promedio mensual
    const [fy, fm] = firstMonth.split('-').map(Number);
    const [ly, lm] = lastMonth.split('-').map(Number);
    const spanMonths = Math.max(1, (ly - fy) * 12 + (lm - fm) + 1);

    const nonFuelCpm = nonFuelTotal / milesLong;
    // Costo por milla de referencia (Lex, notas): comida/hospedaje convertidos a su promedio por milla.
    const realCPM = fuelCpm + nonFuelCpm;
    const avgMonthlyMiles = milesLong / activeMonths.length;

    debugLog('📊 CPMEngine [REAL]:', {
      mesesActivos: activeMonths.length,
      periodo: `${firstMonth} a ${lastMonth}`,
      nonFuelTotal: `$${nonFuelTotal.toFixed(2)}`,
      fuelLong: `$${fuelLong.toFixed(2)}`,
      fuelRecent: `$${fuelRecent.toFixed(2)}`,
      useRecentFuel,
      countExpenses,
      loadsInWindow,
      milesLong: milesLong.toFixed(0),
      milesRecent: milesRecent.toFixed(0),
      realCPM: realCPM.toFixed(4),
      months,
      loads
    });

    return {
      cpm: parseFloat(realCPM.toFixed(4)),
      source: 'real',
      fuelCpm: parseFloat(fuelCpm.toFixed(4)),
      nonFuelCpm: parseFloat(nonFuelCpm.toFixed(4)),
      otherCpm: parseFloat(otherCpm.toFixed(4)),
      otherVarCpm: parseFloat(otherVarCpm.toFixed(4)),
      realMonthlyMiles: Math.round(milesLong / spanMonths),
      foodPerDay: parseFloat(foodPerDay.toFixed(2)),
      foodLodgingCpm: parseFloat(foodLodgingCpm.toFixed(4)),
      fuelSource: current ? 'price' : 'receipts',
      fuelWindow: useRecentFuel ? 'recent' : 'long',
      avgMonthlyMiles: Math.round(avgMonthlyMiles),
      label: `Basado en ${loadsInWindow} cargas reales (${activeMonths.length} meses con actividad)`,
      confidence: months >= 6 ? 'high' : 'medium',
      months,
      loads,
      loadsInWindow,
      totalOperational: nonFuelTotal + fuelLong,
      totalMiles: milesLong,
      cutoffDate: firstMonth + '-01',
      // Datos crudos para mostrar al usuario de donde sale el numero
      breakdown: {
        firstMonth,
        lastMonth,
        activeMonths: activeMonths.length,
        fuelMonths: activeMonths.slice(0, this.FUEL_WINDOW_MONTHS).slice().reverse(),
        milesLong: Math.round(milesLong),
        milesRecent: Math.round(milesRecent),
        loadsInWindow,
        countExpenses,
        monthsWithExpenses: monthsWithExpenses.size,
        fuelLong,
        fuelRecent,
        nonFuelTotal,
        outsideCount,
        outsideTotal,
        useRecentFuel,
        fuelSource: current ? 'price' : 'receipts',
        fuelPrice: current ? current.price : null,
        fuelMPG: current ? current.mpg : null,
        fuelPriceUpdatedAt: current ? current.updatedAt : null,
        receiptsFuelCpm,
        foodLodgingTotal,
        foodTotal,
        travelDays: Math.round(travelDays * 10) / 10,
        foodPerDay,
        foodLodgingCpm,
        otherTotal: nonFuelTotal - foodLodgingTotal,
        otherVarTotal: nonFuelTotal - foodLodgingTotal - fixedHistTotal,
        fixedIds: Array.from(fixedIds),
        fixedHistTotal,
        fixedHistMonthly: fixedHistTotal / spanMonths,
        spanMonths,
        realMonthlyMiles: Math.round(milesLong / spanMonths),
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
  // Precio actual del galon y MPG de Configuracion (users/{uid}). null si faltan.
  currentFuel() {
    const p = window.currentUser?.profileData || {};
    const price = Number(p.fuelPricePerGallon);
    const mpg = Number(p.fuelMPG);
    if (!(price > 0) || !(mpg > 0)) return null;
    return { price, mpg, cpm: price / mpg, updatedAt: p.fuelPriceUpdatedAt || null };
  },

  // Dias de viaje de una carga segun sus millas: horas de manejo + 30 min por
  // parada cada 300 mi, entre las horas de manejo por dia (minimo 1 dia).
  // Misma regla para el promedio historico y para cada carga nueva.
  estimateTripDays(miles, profile) {
    const pr = profile || (typeof window.getVehicleProfile === 'function' ? window.getVehicleProfile() : null) || {};
    const speed = Number(pr.speedAvg) || 60;
    const hoursPerDay = Number(pr.horasManejoPorDia) || 10;
    const m = Math.max(0, Number(miles) || 0);
    const hours = m / speed + Math.floor(m / 300) * 0.5;
    return Math.max(1, hours / hoursPerDay);
  },

  _fromConfig(months = 0, loads = 0) {
    const costs = window.currentUser?.costs;

    let cpm;
    let label;
    let source;

    // Mismo numero que usa la calculadora (calculator.js getConfigCosts):
    // los componentes de Configuración o, sin configurar, el perfil default.
    const configCosts = typeof window.getConfigCosts === 'function' ? window.getConfigCosts() : null;

    if (costs && costs.isDefault === false && (configCosts?.TOTAL ?? costs.totalCPM) !== undefined) {
      // Configuración personalizada guardada
      cpm = configCosts?.TOTAL ?? costs.totalCPM;
      label = 'Basado en tu configuración';
      source = 'config';
    } else {
      // Sin configuración — usar promedio de industria
      cpm = configCosts?.TOTAL ?? 0.55;
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
