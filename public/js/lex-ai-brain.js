// ==========================================================
//  LEX-AI-BRAIN.JS v2.0 - Sistema de Aprendizaje Completo
//  Aprende de tus cargas, zonas, finanzas y decisiones
//  $0 - Sin APIs externas - 100% Firebase
// ==========================================================

function safe(num, decimals = 2, fallback = '--') {
  const n = Number(num);
  if (!Number.isFinite(n)) return fallback;
  try {
    // Usar toLocaleString para agregar comas
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch (e) {
    console.warn('[LEX] Error en safe()', num, e);
    return n.toFixed(decimals);
  }
}
class LexAI {
  constructor() {
    // Estado y memoria de contexto
    this.userContext = {
      avgRPM: 0.95,
      preferredZones: [],
      avgCPM: 0.576,
      minRPM: 0.85,
      recentLoads: [],
      businessMetrics: {},
      stateStats: {},
      thresholds: {},
      totalLoads: 0,
      totalMiles: 0
    };

    this.profileRef = null;
    this.isLearning = true; // Flag para indicar que el sistema está aprendiendo
  }

  // ==========================================================
  //  INICIALIZAR CONTEXTO DEL USUARIO
  // ==========================================================
  async initializeContext() {
    try {
      const user = firebase.auth().currentUser;
      if (!user) return;

      const db = firebase.firestore();
      this.profileRef = db.collection('lexProfiles').doc(user.uid);

      console.log('🤖 Inicializando Lex AI...');

      // PASO 1: Intentar cargar perfil existente
      const profileDoc = await this.profileRef.get();

      if (profileDoc.exists) {
        // ✓ Perfil existe - cargar datos aprendidos
        console.log('📂 Cargando perfil de aprendizaje existente...');
        const profile = profileDoc.data();

        this.userContext = {
          ...this.userContext,
          avgRPM: profile.avgRPM || 0.95,
          avgCPM: profile.avgCPM || 0.576,
          minRPM: profile.thresholds?.minSafeRPM || 0.85,
          targetRPM: profile.thresholds?.targetRPM || 1.0,
          preferredZones: profile.preferredStates || [],
          badZones: profile.badStates || [],
          stateStats: profile.stateStats || {},
          thresholds: profile.thresholds || {},
          totalLoads: profile.totalLoads || 0,
          totalMiles: profile.totalMiles || 0,
          businessMetrics: profile.businessPatterns || {}
        };

        console.log('✅ Perfil cargado:', {
  totalLoads: this.userContext.totalLoads,
  avgRPM: this.userContext.avgRPM.toFixed(2),
  avgCPM: this.userContext.avgCPM.toFixed(3),
  estados: Object.keys(this.userContext.stateStats).length
});

      } else {
        // 🆕 Primera vez - crear perfil inicial
        console.log('🆕 Primera vez con Lex - Creando perfil inicial...');
        await this.createInitialProfile();
      }

      // PASO 2: Cargar cargas recientes para contexto
      await this.loadRecentLoads();

      console.log('🚀 Lex AI listo para analizar cargas');
    } catch (error) {
      console.error('❌ Error inicializando Lex:', error);
      // Valores por defecto en caso de error
      this.userContext = {
        ...this.userContext,
        avgRPM: 0.95,
        avgCPM: 0.576,
        minRPM: 0.85,
        targetRPM: 1.0
      };
    }
  }

  // ==========================================================
  //  CREAR PERFIL INICIAL DESDE HISTORIAL
  // ==========================================================
  async createInitialProfile() {
    try {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();

      const loadsSnapshot = await db
        .collection('loads')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();

      const loads = [];
      loadsSnapshot.forEach((doc) => {
        loads.push({ id: doc.id, ...doc.data() });
      });

      console.log(`📊 Encontradas ${loads.length} cargas para analizar`);

      if (loads.length === 0) {
        // Usuario nuevo - crear perfil vacío con valores por defecto
        await this.createEmptyProfile();
        return;
      }

      // Calcular estadísticas desde el historial
      const stats = this.calculateStatsFromLoads(loads);

      // Crear perfil en Firebase
      const profileData = {
        // Estadísticas globales
        totalLoads: loads.length,
        totalMiles: stats.totalMiles,
        totalLoadedMiles: stats.totalLoadedMiles,
        totalDeadheadMiles: stats.totalDeadheadMiles,
        totalRevenue: stats.totalRevenue,
        totalProfit: stats.totalProfit,

        // Promedios
        avgRPM: stats.avgRPM,
        avgCPM: stats.avgCPM,
        avgProfit: stats.avgProfit,

        // Estadísticas por estado
        stateStats: stats.stateStats,

        // Estados preferidos y a evitar
        preferredStates: stats.preferredStates,
        badStates: stats.badStates,
        neutralStates: stats.neutralStates,

        // Patrones de negocio
        businessPatterns: stats.businessPatterns,

        // Umbrales y seguridad
        thresholds: {
          minSafeRPM: stats.thresholds.minSafeRPM,
          targetRPM: stats.thresholds.targetRPM,
          maxDeadheadPercent: stats.thresholds.maxDeadheadPercent,
          minDailyProfit: stats.thresholds.minDailyProfit
        },

        version: '2.0',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        lastCalculated: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.profileRef.set(profileData);

      // Actualizar contexto local
      this.userContext = {
        ...this.userContext,
        ...profileData,
        minRPM: profileData.thresholds.minSafeRPM,
        targetRPM: profileData.thresholds.targetRPM
      };

      console.log('✅ Perfil inicial creado con éxito:', {
  totalLoads: this.userContext.totalLoads,
  avgRPM: this.userContext.avgRPM.toFixed(2),
  avgCPM: this.userContext.avgCPM.toFixed(3)
});

    } catch (error) {
      console.error('❌ Error creando perfil inicial:', error);
      // En caso de error, caer a perfil vacío
      await this.createEmptyProfile();
    }
  }

  // ==========================================================
  //  CREAR PERFIL VACÍO (SIN HISTORIAL)
  // ==========================================================
  async createEmptyProfile() {
    const profileData = {
      totalLoads: 0,
      totalMiles: 0,
      totalLoadedMiles: 0,
      totalDeadheadMiles: 0,
      totalRevenue: 0,
      totalProfit: 0,
      avgRPM: 0.95,
      avgCPM: 0.576,
      avgProfit: 0,
      avgDeadheadPercent: 0,
      stateStats: {},
      preferredStates: [],
      badStates: [],
      neutralStates: [],
      businessPatterns: {
        avgLoadsPerMonth: 0,
        avgMilesPerLoad: 0,
        avgDaysOut: 0
      },
      thresholds: {
        minSafeRPM: 0.85,
        targetRPM: 1.0,
        maxDeadheadPercent: 30,
        minDailyProfit: 400
      },
      version: '2.0',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    await this.profileRef.set(profileData);
    this.userContext = { ...this.userContext, ...profileData };
    console.log('✅ Perfil vacío creado - Listo para aprender');
  }

  // ==========================================================
  //  ACTUALIZAR PERFIL CON NUEVA CARGA
  // ==========================================================
  async updateProfileWithLoad(loadData) {
    try {
      if (!this.profileRef) {
        console.warn('⚠️ ProfileRef no inicializado');
        return;
      }

      console.log('📈 Actualizando perfil de Lex con nueva carga...');

      const miles = loadData.totalMiles || 0;
      const loadedMiles = loadData.loadedMiles || 0;
      const deadheadMiles = loadData.deadheadMiles || 0;
      const revenue = loadData.rate || 0;
      const rpm = loadData.rpm || 0;
      const profit =
        loadData.netProfit ||
        (revenue - miles * (this.userContext.avgCPM || 0.576));
      const state = loadData.destinationState;

      // Actualizar estadísticas globales
      const updates = {
        totalLoads: firebase.firestore.FieldValue.increment(1),
        totalMiles: firebase.firestore.FieldValue.increment(miles),
        totalLoadedMiles: firebase.firestore.FieldValue.increment(loadedMiles),
        totalDeadheadMiles:
          firebase.firestore.FieldValue.increment(deadheadMiles),
        totalRevenue: firebase.firestore.FieldValue.increment(revenue),
        totalProfit: firebase.firestore.FieldValue.increment(profit),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Actualizar estadísticas por estado
      if (state) {
        const stateKey = `stateStats.${state}`;
        updates[`${stateKey}.loads`] =
          firebase.firestore.FieldValue.increment(1);
        updates[`${stateKey}.totalMiles`] =
          firebase.firestore.FieldValue.increment(miles);
        updates[`${stateKey}.totalRevenue`] =
          firebase.firestore.FieldValue.increment(revenue);
        updates[`${stateKey}.totalProfit`] =
          firebase.firestore.FieldValue.increment(profit);
      }

      await this.profileRef.update(updates);

      // Recalcular promedios cada 5 cargas
      const newTotal = (this.userContext.totalLoads || 0) + 1;
      if (newTotal % 5 === 0) {
        await this.recalculateAverages();
      }

      console.log('✅ Perfil actualizado correctamente');
    } catch (error) {
      console.error('❌ Error actualizando perfil:', error);
    }
  }

  // ==========================================================
  //  RECALCULAR PROMEDIOS
  // ==========================================================
  async recalculateAverages() {
    try {
      const profile = await this.profileRef.get();
      if (!profile.exists) return;

      const data = profile.data();
      const totalLoads = data.totalLoads || 0;
      const totalMiles = data.totalMiles || 0;
      const totalRevenue = data.totalRevenue || 0;
      const totalProfit = data.totalProfit || 0;
      const totalDeadhead = data.totalDeadheadMiles || 0;

      if (totalLoads === 0 || totalMiles === 0) return;

      // Calcular nuevos promedios
      const avgRPM = totalRevenue / totalMiles;
      const avgCPM = (totalRevenue - totalProfit) / totalMiles;
      const avgProfit = totalProfit / totalLoads;
      const avgDeadheadPercent = (totalDeadhead / totalMiles) * 100;

      // Calcular promedios por estado
      const stateStats = data.stateStats || {};
      Object.keys(stateStats).forEach((state) => {
        const stats = stateStats[state];
        if (stats.totalMiles > 0) {
          stats.avgRPM = stats.totalRevenue / stats.totalMiles;
          stats.avgProfit = stats.totalProfit / (stats.loads || 1);
        } else {
          stats.avgRPM = 0;
          stats.avgProfit = 0;
        }
      });

      // Clasificar estados
      const stateAnalysis = Object.keys(stateStats)
        .map((state) => ({
          state,
          ...stateStats[state],
          avgRPM:
            stateStats[state].totalMiles > 0
              ? stateStats[state].totalRevenue / stateStats[state].totalMiles
              : 0,
          avgProfit:
            stateStats[state].loads > 0
              ? stateStats[state].totalProfit / stateStats[state].loads
              : 0
        }))
        .filter((s) => s.loads >= 2)
        .sort((a, b) => b.avgRPM - a.avgRPM);

      const topStates = stateAnalysis.slice(0, 5);
      const worstStates = stateAnalysis.slice(-3).reverse();

      const statesByRPM = Object.entries(stateStats).sort(
        ([, a], [, b]) => b.avgRPM - a.avgRPM
      );
      const topThird = Math.ceil(statesByRPM.length / 3);
      const preferredStates = statesByRPM
        .slice(0, topThird)
        .map(([state]) => state);
      const badStates = statesByRPM
        .slice(-topThird)
        .map(([state]) => state)
        .reverse();
      const neutralStates = statesByRPM
        .slice(topThird, -topThird)
        .map(([state]) => state);

      // Umbrales dinámicos
      const thresholds = {
        minSafeRPM: Math.max(0.85, avgCPM + 0.1),
        targetRPM: Math.max(1.0, avgCPM + 0.25),
        maxDeadheadPercent: Math.min(40, avgDeadheadPercent + 10),
        minDailyProfit: Math.max(300, avgProfit * 0.8)
      };

      // Patrones de negocio
      const monthsOfData = this.calculateMonthsOfData(data);
      const avgLoadsPerMonth =
        monthsOfData > 0 ? totalLoads / monthsOfData : totalLoads;
      const avgMilesPerLoad = totalLoads > 0 ? totalMiles / totalLoads : 0;

      const businessPatterns = {
        avgLoadsPerMonth,
        avgMilesPerLoad,
        avgDaysOut: data.businessPatterns?.avgDaysOut || 0
      };

      await this.profileRef.update({
        avgRPM,
        avgCPM,
        avgProfit,
        avgDeadheadPercent,
        stateStats,
        preferredStates,
        badStates,
        neutralStates,
        thresholds,
        businessPatterns,
        lastCalculated: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Actualizar contexto local
      this.userContext = {
        ...this.userContext,
        avgRPM,
        avgCPM,
        avgProfit,
        preferredStates,
        badStates,
        neutralStates,
        stateStats,
        thresholds,
        businessPatterns
      };

     console.log('✅ Promedios recalculados:', {
  avgRPM: avgRPM.toFixed(2),
  avgCPM: avgCPM.toFixed(3),
  avgProfit: avgProfit.toFixed(0)
});

    } catch (error) {
      console.error('❌ Error recalculando promedios:', error);
    }
  }

  // ==========================================================
  //  CARGAR CARGAS RECIENTES
  // ==========================================================
  async loadRecentLoads() {
    try {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();

      const loadsSnapshot = await db
        .collection('loads')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const loads = [];
      loadsSnapshot.forEach((doc) => {
        loads.push({ id: doc.id, ...doc.data() });
      });

      this.userContext.recentLoads = loads;
    } catch (error) {
      console.error('Error cargando cargas recientes:', error);
    }
  }

  // ==========================================================
  //  UTILIDADES
  // ==========================================================
  calculateMonthsOfData(loadsData) {
    const loads = Array.isArray(loadsData)
      ? loadsData
      : loadsData?.stateStats
      ? Object.values(loadsData.stateStats).flatMap((s) => s.loads || [])
      : [];

    if (loads.length === 0) return 0;

    const dates = loads
      .map((l) =>
        l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt)
      )
      .filter((d) => d instanceof Date && !isNaN(d));

    if (dates.length === 0) return 1;

    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));
    const diffMonths =
      (newest.getFullYear() - oldest.getFullYear()) * 12 +
      (newest.getMonth() - oldest.getMonth());

    return Math.max(diffMonths, 1);
  }

  calculateStatsFromLoads(loads) {
    const stats = {
      loads: 0,
      totalMiles: 0,
      totalLoadedMiles: 0,
      totalDeadheadMiles: 0,
      totalRevenue: 0,
      totalProfit: 0,
      rpms: [],
      stateStats: {},
      businessPatterns: {
        avgLoadsPerMonth: 0,
        avgMilesPerLoad: 0,
        avgDaysOut: 0
      },
      thresholds: {
        minSafeRPM: 0.85,
        targetRPM: 1.0,
        maxDeadheadPercent: 30,
        minDailyProfit: 400
      },
      avgRPM: 0,
      avgCPM: 0,
      avgProfit: 0,
      preferredStates: [],
      badStates: [],
      neutralStates: []
    };

    const monthsSet = new Set();

    loads.forEach((load) => {
      stats.loads += 1;

      const miles =
        (load.totalMiles ||
          load.loadedMiles ||
          0) + (load.deadheadMiles || 0);
      const loadedMiles = load.loadedMiles || 0;
      const deadheadMiles = load.deadheadMiles || 0;
      const revenue = load.rate || load.total || 0;
      const cpm = load.costPerMile || 0.576;
      const profit =
        load.netProfit || revenue - miles * cpm || 0;

      stats.totalMiles += miles;
      stats.totalLoadedMiles += loadedMiles;
      stats.totalDeadheadMiles += deadheadMiles;
      stats.totalRevenue += revenue;
      stats.totalProfit += profit;

      const rpm = miles > 0 ? revenue / miles : 0;
      stats.rpms.push(rpm);

      const createdAt = load.createdAt?.toDate
        ? load.createdAt.toDate()
        : new Date(load.createdAt);
      if (!isNaN(createdAt)) {
        const key = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
        monthsSet.add(key);
      }

      const state =
        load.destinationState || this.extractState(load.destination || '');
      if (!state) return;

      if (!stats.stateStats[state]) {
        stats.stateStats[state] = {
          state,
          loads: 0,
          totalMiles: 0,
          totalRevenue: 0,
          totalProfit: 0,
          rpms: [],
          avgRPM: 0,
          avgProfit: 0
        };
      }

      stats.stateStats[state].loads += 1;
      stats.stateStats[state].totalMiles += miles;
      stats.stateStats[state].totalRevenue += revenue;
      stats.stateStats[state].totalProfit += profit;
      stats.stateStats[state].rpms.push(rpm);
    });

    if (stats.loads > 0 && stats.totalMiles > 0) {
      stats.avgRPM = stats.totalRevenue / stats.totalMiles;
      stats.avgCPM = (stats.totalRevenue - stats.totalProfit) / stats.totalMiles;
      stats.avgProfit = stats.totalProfit / stats.loads;
    }

    const avgDeadheadPercent =
      stats.totalMiles > 0
        ? (stats.totalDeadheadMiles / stats.totalMiles) * 100
        : 0;
    stats.avgDeadheadPercent = avgDeadheadPercent;

    const months = Math.max(monthsSet.size, 1);
    stats.businessPatterns.avgLoadsPerMonth = stats.loads / months;
    stats.businessPatterns.avgMilesPerLoad =
      stats.loads > 0 ? stats.totalMiles / stats.loads : 0;

    Object.keys(stats.stateStats).forEach((state) => {
      const s = stats.stateStats[state];
      if (s.loads > 0) {
        s.avgRPM =
          s.totalMiles > 0 ? s.totalRevenue / s.totalMiles : 0;
        s.avgProfit = s.totalProfit / s.loads;
      } else {
        s.avgRPM = 0;
        s.avgProfit = 0;
      }
      delete s.rpms;
    });

    const statesByRPM = Object.entries(stats.stateStats).sort(
      ([, a], [, b]) => b.avgRPM - a.avgRPM
    );
    const topThird = Math.ceil(statesByRPM.length / 3);

    stats.preferredStates = statesByRPM
      .slice(0, topThird)
      .map(([state]) => state);
    stats.badStates = statesByRPM
      .slice(-topThird)
      .map(([state]) => state)
      .reverse();
    stats.neutralStates = statesByRPM
      .slice(topThird, -topThird)
      .map(([state]) => state);

    stats.thresholds = {
      minSafeRPM: Math.max(0.85, stats.avgCPM + 0.1),
      targetRPM: Math.max(1.0, stats.avgCPM + 0.25),
      maxDeadheadPercent: Math.min(40, avgDeadheadPercent + 10),
      minDailyProfit: Math.max(300, stats.avgProfit * 0.8)
    };

    return stats;
  }

  // ==========================================================
  //  ANALIZAR HISTORIAL COMPLETO
  // ==========================================================
  async analyzeHistoryLoads(loadsInput) {
    try {
      const loads = Array.isArray(loadsInput) ? loadsInput : [];
      if (loads.length === 0) {
        alert(
          'No hay cargas en el rango seleccionado para analizar con Lex.'
        );
        return null;
      }

      let totalMiles = 0;
      let totalRevenue = 0;
      let totalProfit = 0;
      let profitableLoads = 0;
      let unprofitableLoads = 0;

      const stateStats = {};
      const rpms = [];

      loads.forEach((load) => {
        const miles = (load.totalMiles || 0) + (load.deadheadMiles || 0);
        const revenue = load.rate || load.total || 0;
        const cost =
          load.estimatedCost ||
          (miles * (this.userContext.avgCPM || 0.576));
        const profit =
          load.netProfit || revenue - cost || 0;
        const rpm = miles > 0 ? revenue / miles : 0;

        totalMiles += miles;
        totalRevenue += revenue;
        totalProfit += profit;
        rpms.push(rpm);

        if (profit >= 0) {
          profitableLoads += 1;
        } else {
          unprofitableLoads += 1;
        }

        const state =
          load.destinationState || this.extractState(load.destination || '');
        if (!state) return;

        if (!stateStats[state]) {
          stateStats[state] = {
            state,
            loads: 0,
            totalMiles: 0,
            totalRevenue: 0,
            totalProfit: 0,
            rpms: []
          };
        }

        stateStats[state].loads += 1;
        stateStats[state].totalMiles += miles;
        stateStats[state].totalRevenue += revenue;
        stateStats[state].totalProfit += profit;
        stateStats[state].rpms.push(rpm);
      });

      const avgRPM =
        totalMiles > 0 ? totalRevenue / totalMiles : 0;
      const avgProfit =
        loads.length > 0 ? totalProfit / loads.length : 0;
      const profitMargin =
        totalRevenue > 0
          ? (totalProfit / totalRevenue) * 100
          : 0;

      Object.keys(stateStats).forEach((state) => {
        const s = stateStats[state];
        if (s.totalMiles > 0) {
          s.avgRPM = s.totalRevenue / s.totalMiles;
          s.avgProfit = s.totalProfit / (s.loads || 1);
        } else {
          s.avgRPM = 0;
          s.avgProfit = 0;
        }
        delete s.rpms;
      });

      const stateAnalysis = Object.keys(stateStats)
        .map((state) => ({
          state,
          ...stateStats[state],
          avgRPM: stateStats[state].avgRPM,
          avgProfit: stateStats[state].avgProfit
        }))
        .filter((s) => s.loads >= 2)
        .sort((a, b) => b.avgRPM - a.avgRPM);

      const topStates = stateAnalysis.slice(0, 5);
      const worstStates = stateAnalysis.slice(-3).reverse();

      const insights = [];
      const alerts = [];
      const recommendations = [];

      const targetRPM =
        this.userContext.targetRPM ||
        this.userContext.avgRPM ||
        0.95;

      // Análisis de RPM
if (avgRPM < 0.85) {
  alerts.push(
    `Tu RPM promedio está bajo: $${safe(avgRPM, 2)}/mi`
  );
  recommendations.push(
    'Considera negociar mejores tarifas o enfocarte en rutas más rentables'
  );
} else if (avgRPM >= 1.0) {
  insights.push(
    `Excelente RPM promedio: $${safe(avgRPM, 2)}/mi`
  );
}


      // Porcentaje de cargas rentables
            const profitRate =
        loads.length > 0
          ? (profitableLoads / loads.length) * 100
          : 0;

      if (profitRate < 70) {
        alerts.push(
          `Solo ${safe(profitRate, 0)}% de tus cargas son rentables`
        );
        recommendations.push(
          'Revisa tus costos operativos y estrategia de selección de cargas'
        );
      } else {
        insights.push(
          `${safe(profitRate, 0)}% de tus cargas son rentables`
        );
      }

      // Margen
      if (profitMargin < 15) {
        alerts.push(
          `Margen de ganancia bajo: ${safe(profitMargin, 1)}%`
        );
      } else if (profitMargin >= 20) {
        insights.push(
          `Excelente margen de ganancia: ${safe(profitMargin, 1)}%`
        );
      }



      // Recomendaciones por zonas
if (topStates.length > 0) {
  insights.push(
    `Tus mejores estados: ${topStates
      .slice(0, 3)
      .map(
        (s) =>
          `${s.state} ($${safe(s.avgRPM, 2)}/mi)`
      )
      .join(', ')}`
  );
}

if (worstStates.length > 0) {
  alerts.push(
    `Evita estas zonas: ${worstStates
      .map(
        (s) =>
          `${s.state} ($${safe(s.avgRPM, 2)}/mi)`
      )
      .join(', ')}`
  );
}


      // Estado emocional de Lex según historial
      let lexState = 'idle';
      if (alerts.length > 2) {
        lexState = 'sad';
      } else if (alerts.length > 0) {
        lexState = 'warning';
      } else {
        lexState = 'happy';
      }

      // Mostrar modal específico para historial
      this.showHistoryAnalysisModal({
        loads: loads.length,
        totalMiles,
        totalRevenue,
        totalProfit,
        avgRPM,
        avgProfit,
        profitMargin,
        profitableLoads,
        unprofitableLoads,
        topStates,
        worstStates,
        insights,
        alerts,
        recommendations
      });

      // Actualizar estado visual
      if (window.setLexState) {
        const message =
          alerts.length > 0
            ? `Encontré ${alerts.length} áreas de mejora en tu historial`
            : `¡Tu historial se ve bien! ${insights.length} puntos positivos`;

        window.setLexState(lexState, {
          message,
          duration: 5000
        });
      }

      return { loads: loads.length, avgRPM, avgProfit, profitMargin };
    } catch (err) {
      console.error('[LEX] Error analizando historial:', err);
      if (window.setLexState) {
        window.setLexState('sad', {
          message:
            'Tuve un problema al analizar el historial',
          duration: 4000
        });
      }
      return null;
    }
  }

  // ==========================================================
  //  EXTRAER ESTADO DE DIRECCIÓN
  // ==========================================================
  extractState(address) {
    if (!address) return null;
    const match = address.match(/,\s*([A-Z]{2})\s*$/);
    return match ? match[1] : null;
  }

  // ==========================================================
  //  MOSTRAR MODAL DE ANÁLISIS DE HISTORIAL
  // ==========================================================
  showHistoryAnalysisModal(analysis) {
    const existingModal =
      document.getElementById('lexHistoryModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'lexHistoryModal';
    modal.className =
      'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style="max-height: 90vh;">
        <div class="text-white p-4 rounded-t-2xl flex-shrink-0" style="background: linear-gradient(to right, #2563eb, #7c3aed) !important;">
          <div class="flex items-center gap-3">
            <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
            <div>
              <h3 class="text-lg font-bold">Analisis del Historial</h3>
              <p class="text-xs text-blue-100">
                Basado en tus cargas registradas, zonas y rentabilidad real
              </p>
            </div>
          </div>
        </div>

        <div class="p-4 flex-1 overflow-y-auto">
          <!-- KPIs principales -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-blue-50 p-3 rounded-xl border border-blue-200">
              <p class="text-[10px] text-blue-600 uppercase">Cargas analizadas</p>
              <p class="text-lg font-bold" style="color: #1e40af !important;">${analysis.loads}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p class="text-[10px] text-slate-500 uppercase">Millas totales</p>
              <p class="text-lg font-bold text-slate-900">${safe(analysis.totalMiles, 0)}</p>
            </div>
            <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <p class="text-[10px] text-emerald-600 uppercase">RPM promedio</p>
              <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.avgRPM, 2)}</p>
            </div>
            <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <p class="text-[10px] text-emerald-600 uppercase">Ganancia promedio</p>
              <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.avgProfit, 0)}</p>
            </div>
          </div>

          <!-- Rentabilidad -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <p class="text-xs text-emerald-700 font-semibold mb-1">
                &#128200; Resumen de rentabilidad
              </p>
              <p class="text-sm text-slate-800 mb-1">
                Margen global: <span class="font-bold">${safe(analysis.profitMargin, 1)}%</span>
              </p>
              <p class="text-xs text-slate-600">
                Cargas rentables: ${analysis.profitableLoads} &#183; No rentables: ${analysis.unprofitableLoads}
              </p>
            </div>

            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <p class="text-xs text-slate-700 font-semibold mb-1">
                &#127758; Zonas destacadas
              </p>
              <p class="text-xs text-slate-700">
                ${
                  analysis.insights.find((m) =>
                    m.startsWith('Tus mejores estados')
                  ) || 'Aun no hay suficientes datos por estado'
                }
              </p>
              <p class="text-xs text-red-600 mt-1">
                ${
                  analysis.alerts.find((m) =>
                    m.startsWith('Evita estas zonas')
                  ) || ''
                }
              </p>
            </div>
          </div>

          <!-- Insights y alertas -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <p class="text-xs font-semibold text-slate-700 mb-2">
                &#9989; Puntos positivos
              </p>
              <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
                ${
                  analysis.insights.length
                    ? analysis.insights
                        .map(
                          (i) =>
                            `<li class="text-xs text-slate-700">&#8226; ${i}</li>`
                        )
                        .join('')
                    : '<li class="text-xs text-slate-500">Aun no hay suficientes datos para generar insights.</li>'
                }
              </ul>
            </div>
            <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
              <p class="text-xs font-semibold text-amber-800 mb-2">
                &#128161; Alertas y oportunidades de mejora
              </p>
              <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
                ${
                  analysis.alerts.length
                    ? analysis.alerts
                        .map(
                          (a) =>
                            `<li class="text-xs text-amber-800">&#8226; ${a}</li>`
                        )
                        .join('')
                    : '<li class="text-xs text-amber-700">No se detectaron alertas importantes en tu historial.</li>'
                }
              </ul>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-700/60 lex-modal-actions">

  <button 
    type="button"
    onclick="window.openLexChatModal()"
    class="lex-modal-btn lex-modal-btn-primary"
  >
    💬 Chat con Lex
  </button>

  <button
    type="button"
    onclick="closeLexHistoryModal()"
    class="lex-modal-btn lex-modal-btn-ghost"
  >
    ✕ Cerrar
  </button>

</div>


        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

    // ==========================================================
  //  MOSTRAR MODAL DE ANÁLISIS FINANCIERO
  // ==========================================================
  showFinanceAnalysisModal(analysis) {
    const existingModal = document.getElementById('lexFinanceModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'lexFinanceModal';
    modal.className =
      'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style="max-height: 90vh;">
        <!-- Header -->
        <div class="text-white p-4 rounded-t-2xl flex-shrink-0" style="background: linear-gradient(to right, #059669, #1d4ed8) !important;">
          <div class="flex items-center gap-3">
            <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
            <div>
              <h3 class="text-lg font-bold">Analisis financiero</h3>
              <p class="text-xs text-emerald-100">
                Per&#237;odo: ${analysis.periodLabel || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div class="p-4 flex-1 overflow-y-auto">
          <!-- KPIs principales -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <p class="text-[10px] text-emerald-600 uppercase">Ingresos</p>
              <p class="text-lg font-bold" style="color: #047857 !important;">$${safe(analysis.totalRevenue, 0)}</p>
            </div>
            <div class="bg-red-50 p-3 rounded-xl border border-red-200">
              <p class="text-[10px] text-red-600 uppercase">Gastos</p>
              <p class="text-lg font-bold" style="color: #b91c1c !important;">$${safe(analysis.totalExpenses, 0)}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p class="text-[10px] text-slate-500 uppercase">Ganancia neta</p>
              <p class="text-lg font-bold" style="color: ${
                Number(analysis.netProfit) >= 0 ? '#047857' : '#b91c1c'
              } !important;">$${safe(analysis.netProfit, 0)}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p class="text-[10px] text-slate-500 uppercase">Margen</p>
              <p class="text-lg font-bold" style="color: ${
                Number(analysis.margin) >= 0 ? '#047857' : '#b91c1c'
              } !important;">${safe(analysis.margin, 1)}%</p>
            </div>
          </div>

          <!-- RPM y productividad -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl">
              <p class="text-xs text-blue-700 font-semibold mb-1">
                &#128202; Eficiencia operativa
              </p>
              <p class="text-sm text-slate-800 mb-1">
                Millas totales: <span class="font-bold">${safe(analysis.totalMiles, 0)}</span>
              </p>
              <p class="text-sm text-slate-800 mb-1">
                RPM promedio: <span class="font-bold">$${safe(analysis.avgRpm, 2)}/mi</span>
              </p>
              <p class="text-xs text-slate-600">
                Cargas: ${analysis.numLoads || 0} &#183; Gastos registrados: ${analysis.numExpenses || 0}
              </p>
            </div>

            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <p class="text-xs text-slate-700 font-semibold mb-1">
                &#128176; Ticket promedio
              </p>
              <p class="text-sm text-slate-800 mb-1">
                Ingreso por carga: 
                <span class="font-bold">
                  $${safe(analysis.avgRevenuePerLoad, 0)}
                </span>
              </p>
              <p class="text-sm text-slate-800 mb-1">
                Gasto por carga:
                <span class="font-bold">
                  $${safe(analysis.avgExpensePerLoad, 0)}
                </span>
              </p>
            </div>
          </div>

          <!-- Insights y alertas -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <p class="text-xs font-semibold text-emerald-800 mb-2">
                &#9989; Puntos positivos
              </p>
              <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
                ${
                  analysis.insights && analysis.insights.length
                    ? analysis.insights
                        .map(
                          (i) =>
                            `<li class="text-xs text-emerald-800">&#8226; ${i}</li>`
                        )
                        .join('')
                    : '<li class="text-xs text-emerald-700">Aún no hay suficientes datos para generar insights claros.</li>'
                }
              </ul>
            </div>
            <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
              <p class="text-xs font-semibold text-amber-800 mb-2">
                &#128161; Alertas y oportunidades de mejora
              </p>
              <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
                ${
                  analysis.alerts && analysis.alerts.length
                    ? analysis.alerts
                        .map(
                          (a) =>
                            `<li class="text-xs text-amber-800">&#8226; ${a}</li>`
                        )
                        .join('')
                    : '<li class="text-xs text-amber-700">No se detectaron alertas importantes en este período.</li>'
                }
              </ul>
            </div>
          </div>

          <!-- Recomendación general -->
          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-2">
            <p class="text-xs font-semibold text-slate-700 mb-1">
              &#129517; Resumen de Lex
            </p>
            <p class="text-sm text-slate-800">
              ${analysis.summary || 'Estoy monitoreando tus números, sigue registrando cargas y gastos para que pueda darte recomendaciones más precisas.'}
            </p>
          </div>
         </div>
        <div class="p-4 border-t border-slate-700/60 lex-modal-actions">

  <button 
    type="button"
    onclick="window.openLexChatModal()"
    class="lex-modal-btn lex-modal-btn-primary"
  >
    💬 Chat con Lex
  </button>

  <button 
    type="button"
    onclick="closeLexFinanceModal()"
    class="lex-modal-btn lex-modal-btn-ghost"
  >
    ✕ Cerrar
  </button>

</div>

      </div>
    `;

    document.body.appendChild(modal);
  }


  // ==========================================================
  //  ANALIZAR CARGA ACTUAL
  // ==========================================================
  async analyzeCurrentLoad() {
    if (window.setLexState) {
      window.setLexState('thinking', {
        message: 'Analizando esta carga con la experiencia de tus viajes 🚐',
        duration: 2000
      });
    }

    const loadData = this.getCurrentLoadData();

    if (!loadData || !loadData.totalMiles) {
      if (window.setLexState) {
        window.setLexState('sad', {
          message: 'Necesito que primero calcules la carga para ayudarte 🧮',
          duration: 4000
        });
      }
      alert('Primero calcula una carga antes de analizarla con Lex.');
      return null;
    }

    const totalMiles = loadData.totalMiles;
    const rate = loadData.rate;
    const rpm = totalMiles > 0 ? rate / totalMiles : 0;

    const costPerMile =
      this.userContext.currentCosts?.total ||
      this.userContext.avgCPM ||
      0.576;

    const estimatedCost = totalMiles * costPerMile;
    const netProfit = rate - estimatedCost;

    const dailyProfit =
      netProfit / Math.max(1, totalMiles / 500);

    const stateStats = loadData.destinationState
      ? this.userContext.stateStats?.[loadData.destinationState] ||
        null
      : null;

    let appDecision = null;
    let factoresEspeciales = null;

    if (
      typeof window.detectarFactoresEspeciales === 'function' &&
      typeof window.getDecisionInteligente === 'function'
    ) {
      factoresEspeciales =
        window.detectarFactoresEspeciales(
          loadData.origin || '',
          loadData.destination || ''
        );

      appDecision = window.getDecisionInteligente(
        rpm,
        totalMiles,
        factoresEspeciales
      );
    }

    // Target RPM dinámico basado en operación real
    let targetRPM = 1.0;

    if (loadData.totalMiles >= 300) {
      targetRPM = 0.9;
    }

    if (
      factoresEspeciales?.areaMala &&
      factoresEspeciales?.relocalizaBuena
    ) {
      targetRPM = 0.75;
    }

    this.userContext.targetRPM = targetRPM;

    // DECISIÓN BASE
    let recommendation = 'EVALUAR';
    let lexState = 'thinking';
    let confidence = 70;
    const reasons = [];

    // ==========================================================
    //  TRAP LOADS – detección y análisis seguro
    // ==========================================================
    let isTrapLoad = false;
    let trapAnalysisData = null;

    if (appDecision && appDecision.trapAnalysis) {
      trapAnalysisData = appDecision.trapAnalysis;
      isTrapLoad = trapAnalysisData.esTrampa === true;
    }

   if (isTrapLoad && trapAnalysisData) {
      console.log('[LEX] DETECTÓ: CARGA TRAMPA', trapAnalysisData);

      // Defaults seguros por si faltan campos
      const detalles = trapAnalysisData.detalles || {};
      const ida = detalles.ida || {};
      const regreso = detalles.regreso || {};

      const idaMillas   = typeof ida.millas === 'number'   ? ida.millas   : null;
      const idaRPM      = typeof ida.rpm === 'number'      ? ida.rpm      : null;
      const idaRevenue  = typeof ida.revenue === 'number'  ? ida.revenue  : null;
      const regMillas   = typeof regreso.millas === 'number'  ? regreso.millas  : null;
      const regRPM      = typeof regreso.rpm === 'number'     ? regreso.rpm     : null;
      const regRevenue  = typeof regreso.revenue === 'number' ? regreso.revenue : null;

      const rpmOfrecido = typeof trapAnalysisData.rpmOfrecido === 'number'
        ? trapAnalysisData.rpmOfrecido
        : (rpm || 0);
      const rpmRealCiclo = typeof trapAnalysisData.rpmRealCiclo === 'number'
        ? trapAnalysisData.rpmRealCiclo
        : (rpm || 0);
      const gananciaCiclo = typeof trapAnalysisData.gananciaCiclo === 'number'
        ? trapAnalysisData.gananciaCiclo
        : netProfit;
      const diasEstimados = typeof trapAnalysisData.diasEstimados === 'number'
        ? trapAnalysisData.diasEstimados
        : Math.max(1, totalMiles / 500);
      const gananciaPorDia = typeof trapAnalysisData.gananciaPorDia === 'number'
        ? trapAnalysisData.gananciaPorDia
        : gananciaCiclo / diasEstimados;

      // Obtener nombres de zona legibles
      const getZoneName = (state) => {
        const zona = trapAnalysisData.zonaOrigen || trapAnalysisData.zonaDestino;
        if (zona === 'CORE_MIDWEST') return 'Core Midwest';
        if (zona === 'EXTENDED_MIDWEST') return 'Extended Midwest';
        if (zona === 'SALIDA_OK') return 'zona aceptable';
        if (zona === 'TRAP') return 'zona trap';
        return 'zona operativa';
      };

      const origenNombre = getZoneName(loadData.originState);
      const destinoNombre = getZoneName(loadData.destinationState);

      // Forzar recomendación base para TRAP
      if (rpm < 1.25) {
        recommendation = 'RECHAZAR';
        lexState = 'sad';
        confidence = 95;
      } else {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
        confidence = 75;
      }

      // Limpiar razones anteriores y empezar solo con la lógica de trampa
      reasons.length = 0;

      reasons.push(
        `ALERTA: Sales hacia ${loadData.destinationState || 'zona complicada'} (zona trap)`
      );

      // Análisis ida/vuelta solo si hay datos suficientes
      if (
        idaMillas != null &&
        idaRPM != null &&
        idaRevenue != null &&
        regMillas != null &&
        regRPM != null &&
        regRevenue != null &&
        typeof trapAnalysisData.millasTotal === 'number'
      ) {
        reasons.push(
          'Analisis del ciclo completo (ida + regreso):\n' +
          `   - Ida: ${idaMillas} mi x $${safe(idaRPM, 2)}/mi = $${safe(idaRevenue, 0)}\n` +
          `   - Regreso: ${regMillas} mi x $${safe(regRPM, 2)}/mi = $${safe(regRevenue, 0)}\n` +
          `   - Total: ${trapAnalysisData.millasTotal} millas`
        );
      }

      // RPM real vs ofrecido (con defaults)
      reasons.push(
        `RPM ofrecido: $${safe(rpmOfrecido, 2)}/mi\n` +
        `   RPM REAL del ciclo: $${safe(rpmRealCiclo, 2)}/mi`
      );

      // Ganancia estimada del ciclo
      reasons.push(
        `Ganancia ciclo: $${safe(gananciaCiclo, 0)} en ${safe(diasEstimados, 0)} dias\n` +
        `   = $${safe(gananciaPorDia, 0)}/dia promedio`
      );

      // Recomendación específica para TRAP
      if (rpm < 1.25) {
        reasons.push(
          'Mi recomendacion: RECHAZAR\n' +
          `   Necesitas minimo $1.25/mi para que valga la pena en ${loadData.destinationState || 'esta zona'}`
        );
        reasons.push(
          'Opciones en orden de prioridad:\n' +
          '   1. IDEAL: Carga al Core Midwest (IL, IN, OH, MI, WI) a $0.85+/mi\n' +
          '   2. BUENO: Extended Midwest (KS, MO, AR) a $0.90+/mi\n' +
          '   3. ACEPTABLE: Carga corta aqui mismo (<300 mi) a $1.30+/mi\n' +
          '   4. ULTIMA: Considera deadhead 200-300 mi hacia KS/MO'
        );
      } else {
        reasons.push(
          'Mi recomendacion: ACEPTA PERO CON ESTRATEGIA\n' +
          `   El RPM es bueno ($${safe(rpm, 2)}) para zona trap\n` +
          '   Despues de esta carga, prioriza:\n' +
          '   1. Salir hacia Core/Extended Midwest\n' +
          '   2. Si te quedas, solo cargas >$1.20/mi\n' +
          '   3. Evita meterte mas profundo (CA, OR, WA)'
        );
      }

      } else if (trapAnalysisData && trapAnalysisData.nivel === 'NORMAL' && 
               trapAnalysisData.zonaOrigen === 'TRAP' && 
               trapAnalysisData.zonaDestino === 'TRAP') {
      // Movimiento dentro de zona trap (ej: Reno → Las Vegas)
      console.log('[LEX] MOVIMIENTO DENTRO DE TRAP - Minimizar daño');

      reasons.push(
        `SITUACION: Te mueves dentro de zona trap (${loadData.originState} → ${loadData.destinationState})`
      );

      if (rpm >= 1.20) {
        recommendation = 'ACEPTAR';
        lexState = 'warning';
        confidence = 75;
        reasons.push(
          `RPM $${safe(rpm, 2)} es aceptable para movimiento dentro de trap\n` +
          '   Si te vas a quedar en la zona, al menos muevete con buen RPM'
        );
        reasons.push(
          'Estrategia despues de esta carga:\n' +
          '   1. Buscar salida hacia KS, MO, AR (Extended Midwest)\n' +
          '   2. Si no hay, solo cargas >$1.20/mi dentro de la zona\n' +
          '   3. Considera deadhead parcial si pasan 2+ dias sin buenas opciones'
        );
      } else {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
        confidence = 70;
        reasons.push(
          `RPM $${safe(rpm, 2)} es bajo para zona trap\n` +
          '   Intenta negociar a $1.20+/mi minimo'
        );
        reasons.push(
          'Alternativas si no mejora el rate:\n' +
          '   - Buscar carga corta (<300 mi) a mejor RPM\n' +
          '   - Esperar 12-24 hrs por mejor opcion\n' +
          '   - Si llevas 2+ dias sin buenas cargas, considera deadhead hacia KS'
        );
      }

    } else if (trapAnalysisData && trapAnalysisData.nivel === 'OPTIMO') {
      // Carga óptima dentro de zona operativa
      console.log('[LEX] CARGA ÓPTIMA - Dentro de zona operativa');

      const zonaDescripcion = trapAnalysisData.zonaOrigen === 'CORE_MIDWEST' 
        ? 'Core Midwest' 
        : trapAnalysisData.zonaOrigen === 'EXTENDED_MIDWEST'
        ? 'Extended Midwest'
        : 'tu zona operativa';

      reasons.push(`EXCELENTE: Te mantienes en ${zonaDescripcion}`);
      reasons.push(
        `Ruta: ${loadData.originState || 'origen'} a ${
          loadData.destinationState || 'destino'
        } (ambos en zona verde)`
      );

      if (rpm >= 1.0) {
        recommendation = 'ACEPTAR';
        lexState = 'happy';
        confidence = 90;
        reasons.push(
          `RPM $${safe(rpm, 2)} es excelente para movimiento interno`
        );
      }

    } else if (trapAnalysisData && trapAnalysisData.nivel === 'RELOCALIZACION') {
      // Saliendo de una zona trap hacia zona operativa
      console.log('[LEX] RELOCALIZACIÓN - Regresando a zona operativa');

      const destinoDescripcion = trapAnalysisData.zonaDestino === 'CORE_MIDWEST'
        ? 'Core Midwest'
        : trapAnalysisData.zonaDestino === 'EXTENDED_MIDWEST'
        ? 'Extended Midwest'
        : 'zona operativa rentable';

      reasons.push(
        `RELOCALIZACION: Estas regresando de ${
          loadData.originState || 'zona trap'
        } hacia ${destinoDescripcion}`
      );
      reasons.push(
        'Esta carga es NECESARIA para volver a zona operativa rentable'
      );

      if (rpm >= 0.70) {
        recommendation = 'ACEPTAR';
        lexState = 'happy';
        confidence = 85;
        reasons.push(
          `RPM $${safe(rpm, 2)} es aceptable para salir de zona complicada`
        );
      } else {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
        confidence = 70;
        reasons.push(
          `RPM $${safe(rpm, 2)} es bajo - intenta negociar a $0.75+`
        );
      }

    } else if (trapAnalysisData && trapAnalysisData.nivel === 'EVALUAR') {
      // Sale del Midwest a zona aceptable pero no óptima
      console.log('[LEX] EVALUAR - Salida a zona aceptable');

      reasons.push(
        `EVALUAR: Sales hacia ${loadData.destinationState || 'zona'} (aceptable pero no optima)`
      );
      reasons.push(
        'Salida razonable pero tendras menos cargas cortas rentables'
      );

      const minRPM = trapAnalysisData.minimumRPM || 0.95;
      if (rpm >= minRPM) {
        recommendation = 'ACEPTAR';
        lexState = 'happy';
        confidence = 80;
        reasons.push(
          `RPM $${safe(rpm, 2)} cumple el minimo recomendado de $${safe(minRPM, 2)}`
        );
      } else {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
        confidence = 70;
        reasons.push(
          `RPM $${safe(rpm, 2)} esta por debajo del minimo recomendado ($${safe(minRPM, 2)})`
        );
      }
    }

    // ==========================================================
    //  Motor clásico de la app (solo si NO es trap load)
    // ==========================================================
    if (!isTrapLoad && appDecision) {
      const dec = (appDecision.decision || '').toUpperCase();

      let baseConfidence = 70;

      if (dec.includes('ACEPT')) {
        recommendation = 'ACEPTAR';
        lexState = 'happy';
        baseConfidence = 85;
      } else if (dec.includes('RECHAZ')) {
        recommendation = 'RECHAZAR';
        lexState = 'sad';
        baseConfidence = 85;
      } else if (
        dec.includes('NEGOC') ||
        dec.includes('EVALÚA') ||
        dec.includes('EVALUA')
      ) {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
        baseConfidence = 80;
      }

      confidence = baseConfidence;
      if (factoresEspeciales?.esZonaRoja) {
        reasons.push(
          `Zona complicada: ${factoresEspeciales.etiquetaZona}`
        );
      }
      if (factoresEspeciales?.relocalizaBuena) {
        reasons.push(
          'Puede ayudarte a salir hacia una zona mejor'
        );
      }
      if (appDecision.razon) {
        reasons.push(`Motor de la app: ${appDecision.razon}`);
      }
    } else if (!isTrapLoad) {
      reasons.push(
        'Usando la lógica de Lex sin la decisión clásica de la app.'
      );
    }

    // Ajustes por RPM vs objetivo
    const vsTarget = (Number(rpm) || 0) - (Number(targetRPM) || 0);
    const vsTargetPct = Number(targetRPM) > 0 ? (vsTarget / targetRPM) * 100 : 0;

   if (vsTargetPct >= 5) {
   if (recommendation === 'RECHAZAR') {
    recommendation = 'NEGOCIAR';
   }
  confidence += 5;

  const targetText =
    Number.isFinite(targetRPM) && targetRPM > 0
      ? `$${safe(targetRPM, 2)}/mi`
      : 'sin objetivo definido todavía';

  reasons.push(
    `RPM por encima del objetivo: $${safe(rpm, 2)}/mi vs ${targetText}`
  );
} else if (vsTargetPct <= -15) {
  confidence += 5;
  if (recommendation === 'ACEPTAR') {
    recommendation = 'NEGOCIAR';
  }

  const targetText =
    Number.isFinite(targetRPM) && targetRPM > 0
      ? `$${safe(targetRPM, 2)}/mi`
      : 'sin objetivo definido todavía';

  reasons.push(
    `RPM por debajo del objetivo: $${safe(rpm, 2)}/mi vs ${targetText} (más bajo de lo ideal)`
  );
}


    // Ajustes por profit
if (netProfit < 0) {
  reasons.push(
    `Esta carga te deja muy ajustada, casi en pérdida: -$${safe(Math.abs(netProfit), 0)} estimados`
  );
  if (recommendation === 'ACEPTAR') {
    recommendation = 'NEGOCIAR';
  }
  confidence += 5;
} else if (Number.isFinite(dailyProfit) && dailyProfit >= 400) {
  reasons.push(
    `Buena ganancia estimada por día: $${safe(dailyProfit, 0)}/día aprox.`
  );
  if (recommendation === 'RECHAZAR') {
    recommendation = 'NEGOCIAR';
  }
}

// Ajustes por stats del estado
let stateAvgRPM = null;
if (stateStats && stateStats.totalMiles > 0) {
  const computedStateAvg = stateStats.totalRevenue / stateStats.totalMiles;
  // Guardamos el promedio real para usarlo en métricas
  stateAvgRPM = computedStateAvg;

  const refAvg = Number.isFinite(stateStats.avgRPM)
    ? stateStats.avgRPM
    : computedStateAvg;

  if (Number.isFinite(refAvg)) {
    if (rpm >= refAvg) {
      reasons.push(
        `Esta oferta está igual o mejor que tu promedio en ${loadData.destinationState} ($${safe(refAvg, 2)}/mi)`
      );
    } else {
      reasons.push(
        `Históricamente has cobrado más en ${loadData.destinationState} ($${safe(refAvg, 2)}/mi)`
      );
    }
  }
}

if (this.userContext.preferredStates?.length) {
  if (this.userContext.preferredStates.includes(loadData.destinationState)) {
    reasons.push(
      `${loadData.destinationState} está entre tus mejores estados históricos`
    );
  }
}

if (this.userContext.badStates?.length) {
  if (this.userContext.badStates.includes(loadData.destinationState)) {
    reasons.push(
      `${loadData.destinationState} históricamente te ha dado bajo rendimiento`
    );
  }
}


    // Suavizar razones (extra por si algo se cuela)
    const softened = reasons.map((r) => {
      let converted = r;
      converted = converted.replace(
        'bastante bajo',
        'más bajo de lo ideal'
      );
      converted = converted.replace(
        'en negativo',
        'muy ajustada, casi en pérdida'
      );
      return converted;
    });

    reasons.length = 0;
    reasons.push(...softened);

// Ensamblar análisis final
const analysis = {
  recommendation,
  confidence: Math.max(0, Math.min(100, confidence)),
  reasons,
  metrics: {
    rpm: safe(rpm, 2),
    vsAverage: targetRPM
      ? safe(((rpm - targetRPM) / targetRPM) * 100, 1)
      : '0',
    rate: safe(rate, 0),
    estimatedCost: safe(estimatedCost, 0),
    profit: safe(netProfit, 0),
    dailyProfit: safe(dailyProfit, 0),
    stateAvgRPM: stateAvgRPM ? Number(stateAvgRPM).toFixed(2) : null
  },
  notesInsights: {
    hasNotes: false,
    rawNotes: [],
    messages: []
  }
};
    // ======================================================
    //  Cargar notas históricas del destino para Lex
    // ======================================================
    try {
      if (
        loadData.destination &&
        typeof window.normalizeDestination === 'function' &&
        typeof window.getNotesForDestination === 'function' &&
        window.currentUser
      ) {
        const destKey = window.normalizeDestination(loadData.destination);
        const snapshot = await window.getNotesForDestination(destKey);

        if (snapshot && !snapshot.empty && Array.isArray(snapshot.docs)) {
          const rawNotes = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return data && data.note ? String(data.note).trim() : '';
            })
            .filter(n => n.length > 0);

          analysis.notesInsights.hasNotes = rawNotes.length > 0;
          analysis.notesInsights.rawNotes = rawNotes;

          // Mensajes cortos “resumen” para mostrar en el modal o burbuja
          analysis.notesInsights.messages = rawNotes
            .slice(0, 3)
            .map((note, idx) => `#${idx + 1}: ${note}`);
        }
      }
    } catch (err) {
      console.error('[LEX] Error obteniendo notas del destino:', err);
    }

    window.lastLexAnalysis = analysis;

     const shortMessageMap = {
  ACEPTAR: `✅ Buena carga. Confianza: ${analysis.confidence}%`,
  RECHAZAR: `⛔ No compensa esta carga. Confianza: ${analysis.confidence}%`,
  NEGOCIAR: `🟡 Carga intermedia, mi recomendación es NEGOCIAR.`
};

   if (window.setLexState) {
  const baseMessage =
    shortMessageMap[recommendation] ||
    'Te dejo mi análisis detallado arriba';

  const notesHint =
    analysis.notesInsights?.hasNotes
      ? `\n🗒️ Tienes notas guardadas para este destino, revísalas en el panel.`
      : '';

  window.setLexState(lexState || 'thinking', {
    message: baseMessage + notesHint,
    duration: 5000
  });
}

    this.showLexAnalysisModal(analysis, lexState, loadData);
    await this.updateProfileWithLoad({
      ...loadData,
      netProfit
    });

    return analysis;
  }

  // ==========================================================
  //  OBTENER DATOS DE CARGA ACTUAL DESDE LA CALCULADORA
  // ==========================================================
  getCurrentLoadData() {
    try {
      const originEl = document.getElementById('origin');
      const destinationEl = document.getElementById('destination');
      const loadedEl = document.getElementById('loadedMiles');
      const deadheadEl =
        document.getElementById('deadheadMiles');
      const rpmEl = document.getElementById('rpm');
      const rateEl = document.getElementById('rate');

      if (
        !originEl ||
        !destinationEl ||
        !loadedEl ||
        !deadheadEl ||
        !rpmEl ||
        !rateEl
      ) {
        console.warn(
          '[LEX] No encontré uno de los campos de la calculadora'
        );
        return null;
      }

      const origin = originEl.value.trim();
      const destination = destinationEl.value.trim();
      const loadedMiles = Number(loadedEl.value || 0);
      const deadheadMiles = Number(deadheadEl.value || 0);
      const rate = Number(rateEl.value || 0);

      let originState = null;
      const originMatch = origin.match(/,\s*([A-Z]{2})/);
      if (originMatch) {
        originState = originMatch[1];
      }

      let destinationState = null;
      const destMatch = destination.match(/,\s*([A-Z]{2})/);
      if (destMatch) {
        destinationState = destMatch[1];
      }

      const totalMiles = loadedMiles + deadheadMiles;

      return {
        origin,
        originState,
        destination,
        destinationState,
        loadedMiles,
        deadheadMiles,
        totalMiles,
        rate,
        rpm: totalMiles > 0 ? rate / totalMiles : 0
      };
    } catch (error) {
      console.error('Error obteniendo datos de carga:', error);
      return null;
    }
  }

  // ==========================================================
  //  MOSTRAR MODAL DE ANÁLISIS DE CARGA ACTUAL
  // ==========================================================
  showLexAnalysisModal(analysis, lexState, loadData) {
    const existingModal =
      document.getElementById('lexAnalysisModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'lexAnalysisModal';
    modal.className =
      'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col" style="max-height: 90vh;">
        <!-- Header con gradiente -->
        <div class="text-white p-4 rounded-t-2xl flex-shrink-0" style="background: linear-gradient(to right, #2563eb, #7c3aed) !important;">
          <div class="flex items-center gap-3">
            <img src="img/lex/lex-${
              lexState === 'warning' ? 'alert' : lexState
            }.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
            <div>
              <h3 class="text-lg font-bold">Analisis de Carga</h3>
              <p class="text-xs text-blue-100">
                Basado en tus cargas anteriores, zonas preferidas y costos estimados
              </p>
            </div>
          </div>
        </div>

        <div class="p-6 flex-1 overflow-y-auto">
          <!-- Recomendacion principal -->
          <div class="mb-6">
            <div class="p-4 rounded-xl ${
              analysis.recommendation === 'ACEPTAR'
                ? 'bg-green-50 border-2 border-green-500'
                : analysis.recommendation === 'RECHAZAR'
                ? 'bg-red-50 border-2 border-red-500'
                : 'bg-yellow-50 border-2 border-yellow-500'
            }">
              <div class="flex items-center justify-between mb-2">
                <span class="text-2xl font-bold ${
                  analysis.recommendation === 'ACEPTAR'
                    ? 'text-green-700'
                    : analysis.recommendation === 'RECHAZAR'
                    ? 'text-red-700'
                    : 'text-yellow-700'
                }">${analysis.recommendation}</span>
                <span class="text-sm font-semibold ${
                  analysis.recommendation === 'ACEPTAR'
                    ? 'text-green-600'
                    : analysis.recommendation === 'RECHAZAR'
                    ? 'text-red-600'
                    : 'text-yellow-600'
                }">Confianza: ${analysis.confidence}%</span>
              </div>
            </div>
          </div>

          <!-- Metricas -->
          <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p class="text-xs text-gray-500 mb-1">RPM</p>
              <p class="text-lg font-bold text-gray-800">$${analysis.metrics.rpm}</p>
              <p class="text-xs ${
                parseFloat(analysis.metrics.vsAverage) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }">
                ${
                  parseFloat(analysis.metrics.vsAverage) >= 0 ? '+' : ''
                }${analysis.metrics.vsAverage}% vs objetivo
              </p>
            </div>

            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p class="text-xs text-gray-500 mb-1">Resumen economico</p>

              <p class="text-xs text-gray-600">
                Cobro: 
                <span class="font-semibold text-gray-800">
                  $${analysis.metrics.rate}
                </span>
              </p>

              <p class="text-xs text-gray-600">
                Gastos estimados: 
                <span class="font-semibold text-gray-800">
                  $${analysis.metrics.estimatedCost}
                </span>
              </p>

              <p class="text-xs mt-1">
                Ganancia neta: 
                <span class="font-semibold ${
                  Number(analysis.metrics.profit) >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }">
                  $${analysis.metrics.profit}
                </span>
              </p>

              <p class="text-xs text-gray-500 mt-1">
                ~ $${analysis.metrics.dailyProfit}/dia
              </p>
            </div>

            ${
              analysis.metrics.stateAvgRPM !== 'N/A'
                ? `
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200 col-span-2">
              <p class="text-xs text-blue-600 mb-1">&#128202; Estado: RPM Promedio Historico</p>
              <p class="text-lg font-bold text-blue-800">
                 $${Number(analysis.metrics.stateAvgRPM).toFixed(2)}
              </p>

            </div>
            `
                : ''
            }
          </div>

          <!-- Razones -->
          <div class="mb-6">
            <p class="text-sm font-semibold text-gray-700 mb-2">&#129504; Analisis:</p>
            <ul class="space-y-2">
              ${analysis.reasons
                .map(
                  (r) =>
                    `<li class="text-sm text-gray-700">&#8226; ${r}</li>`
                )
                .join('')}
            </ul>
          </div>

          <!-- Notas historicas para este estado -->
          ${
            analysis.notesInsights?.hasNotes
              ? `
            <div class="mb-6 border-t border-gray-200 pt-4">
              <p class="text-sm font-semibold text-gray-700 mb-2">&#128221; Notas historicas en este destino/estado</p>
              <ul class="space-y-1 mb-2">
                ${analysis.notesInsights.rawNotes
                  .map(
                    (n) =>
                      `<li class="text-xs text-gray-600">&#8226; ${n}</li>`
                  )
                  .join('')}
              </ul>
              ${
                analysis.notesInsights.messages.length
                  ? `
                <p class="text-sm font-semibold text-gray-700 mb-2">
                  &#129504; Notas aprendidas de este destino
                </p>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          <!-- Contraoferta -->
          ${
            analysis.recommendation === 'NEGOCIAR' && loadData?.rate
              ? `
          <div class="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
            <p class="text-sm font-semibold text-yellow-800 mb-2">&#128226; Sugerencia:</p>
            <p class="text-sm text-gray-800 mb-2">
              Podrias intentar negociar una tarifa un poco mas alta, basada en tu historico y zona actual.
            </p>
            <button
              type="button"
              onclick="copyLexCounteroffer(${loadData.rate})"
              class="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-yellow-600 text-white hover:bg-yellow-700">
              &#128203; Copiar mensaje de negociacion
            </button>
          </div>
          `
              : ''
          }
        </div>

        <!-- Footer: acciones -->
<div class="p-4 border-t border-slate-700/60 lex-modal-actions">
  <button 
    type="button"
    onclick="window.openLexChatModal()"
    class="lex-modal-btn lex-modal-btn-primary"
  >
    💬 Chat con Lex
  </button>
  <button 
    type="button"
    onclick="saveLexAnalysis()"
    class="lex-modal-btn lex-modal-btn-primary"
  >
    💾 Guardar análisis
  </button>
  <button 
    type="button"
    onclick="closeLexAnalysis()"
    class="lex-modal-btn lex-modal-btn-ghost"
  >
    ✕ Cerrar
  </button>
  </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}
// ==========================================================
//  FUNCIONES GLOBALES
// ==========================================================
window.lexAI = null;

window.analyzeLexLoad = async function () {
  if (!window.lexAI) {
    window.lexAI = new LexAI();
    await window.lexAI.initializeContext();
  }
  return window.lexAI.analyzeCurrentLoad();
};

window.closeLexAnalysis = function () {
  const modal = document.getElementById('lexAnalysisModal');
  if (modal) modal.remove();
  if (window.setLexState) {
    window.setLexState('idle');
  }
};

window.saveLexAnalysis = async function () {
  if (!window.lastLexAnalysis) return;

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert('Debes estar autenticado para guardar análisis');
      return;
    }

    const db = firebase.firestore();
    await db.collection('lexAnalyses').add({
      userId: user.uid,
      analysis: window.lastLexAnalysis,
      loadData: window.lexAI.getCurrentLoadData(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString()
    });

    alert('✅ Análisis guardado exitosamente');
    closeLexAnalysis();
  } catch (error) {
    console.error('Error guardando análisis:', error);
    alert('Error al guardar el análisis');
  }
};

window.copyLexCounteroffer = function (suggestedRate) {
  const rawTarget = window.lexAI?.userContext?.targetRPM;
  const targetNum = Number(rawTarget);

  const targetText = Number.isFinite(targetNum)
    ? `$${safe(targetNum, 2)}`
    : 'mi RPM objetivo';

  const message =
    `Puedo hacer esta carga por $${suggestedRate}. ` +
    `Ese precio me da un RPM justo de ${targetText}, que es mi mínimo operativo.`;

  navigator.clipboard.writeText(message).then(() => {
    if (typeof event !== 'undefined' && event.target) {
      event.target.textContent = '✅ ¡Copiado!';
      event.target.classList.add('bg-green-600');

      setTimeout(() => {
        event.target.textContent =
          '📋 Copiar mensaje de negociación';
        event.target.classList.remove('bg-green-600');
      }, 2000);
    }
  }).catch((err) => {
    console.error('[LEX] Error copiando contraoferta:', err);
    alert('No pude copiar el texto al portapapeles');
  });
};

// ==========================================================
//  INICIALIZAR LEX CUANDO EL DOM ESTÉ LISTO
// ==========================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando Lex AI v2.0...');

  setTimeout(async () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          console.log(
            '👤 Usuario autenticado, iniciando Lex AI'
          );
          window.lexAI = new LexAI();
          await window.lexAI.initializeContext();

          // Agregar botón al calculator
          setTimeout(() => {
            const calculateBtn =
              document.querySelector('#calculateBtn');
            if (
              calculateBtn &&
              !document.getElementById('lexAnalyzeBtn')
            ) {
              const lexBtn = document.createElement('button');
              lexBtn.id = 'lexAnalyzeBtn';
              lexBtn.type = 'button';
              lexBtn.className =
                'bg-gradient-to-r from-blue-600 to-purple-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-800 transition flex items-center gap-2 mt-2 w-full';
              lexBtn.innerHTML = `
                <img src="img/lex/lex-thinking.png" class="w-6 h-6">
                <span> Analizar con Lex AI</span>
              `;
              lexBtn.onclick = analyzeLexLoad;

              calculateBtn.parentElement.appendChild(lexBtn);
              console.log('✅ Botón de Lex AI agregado');
            }
          }, 2000);

          // Mensaje de bienvenida
          if (window.setLexState) {
            const totalLoads =
              window.lexAI.userContext.totalLoads || 0;
            const rawTarget = window.lexAI.userContext.targetRPM;
            const targetNum = Number(rawTarget);
            const targetText = Number.isFinite(targetNum)
            ? `$${safe(targetNum, 2)}`
            : '$1.30';

            const greeting =
            totalLoads > 0
            ? `¡Hola! He aprendido de tus ${totalLoads} cargas. RPM objetivo: ${targetText} 🚀`
            : '¡Hola! Soy Lex. Analiza cargas y empezaré a aprender de ti 🚚';

            window.setLexState('happy', {
              message: greeting,
              duration: 6000
            });
          }
        }
      });
    }
  }, 2000);
});

console.log(
  '🤖 Lex AI Brain v2.0 (Sistema de Aprendizaje) cargado exitosamente'
);

// ==========================================================
//  CERRAR MODAL DE HISTORIAL (GLOBAL)
// ==========================================================
window.closeLexHistoryModal = function () {
  const modal = document.getElementById('lexHistoryModal');
  if (modal) modal.remove();
  if (window.setLexState) {
    window.setLexState('idle');
  }
};

// ==========================================================
//  CERRAR MODAL FINANCIERO (GLOBAL)
// ==========================================================
window.closeLexFinanceModal = function () {
  const modal = document.getElementById('lexFinanceModal');
  if (modal) modal.remove();
  if (window.setLexState) {
    window.setLexState('idle');
  }
};

// ==========================================================
//  INSTANCIA GLOBAL DE LEX + INICIALIZACIÓN SEGURA
// ==========================================================

window.lexAI = window.lexAI || new LexAI();
window.lexAIInitialized = window.lexAIInitialized || false;

async function ensureLexReady() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.warn('[LEX] No hay usuario autenticado todavía');
      return;
    }

    if (!window.lexAIInitialized) {
      console.log('🧠 [LEX] Inicializando contexto por primera vez...');
      await window.lexAI.initializeContext();
      window.lexAIInitialized = true;
      console.log('✅ [LEX] Contexto inicializado');
    }
  } catch (err) {
    console.error('[LEX] Error en ensureLexReady:', err);
  }
}

// ==========================================================
//  NUEVO window.triggerLex - Usa LexMaster + LexModals
//  REEMPLAZAR líneas 2251-2340 en lex-ai-brain.js
// ==========================================================

window.triggerLex = async function() {
  try {
    // Estado visual
    if (window.setLexState) {
      window.setLexState('thinking', {
        message: 'Analizando...',
        duration: 3000
      });
    }

    // Asegurar perfil cargado
    await ensureLexReady();

    // Detectar tab activa
    const currentTab = (window.appState?.currentTab) || 'calculator';
    console.log('[LEX] Analizando tab:', currentTab);

    // Mapear tab a mensaje
    const tabMessages = {
      'calculator': 'analizar carga actual',
      'history': 'analizar historial',
      'zones': 'analizar zonas',
      'finances': 'analizar finanzas'
    };

    const message = tabMessages[currentTab] || 'ayuda';

    // USAR LEXMASTER + LEXMODALS
    if (window.lexMaster && window.lexModals) {
      console.log('[LEX] Usando sistema de agentes');
      
      // Ejecutar agente
      const result = await window.lexMaster.processRequest(message, {
        activeTab: currentTab,
        profile: window.lexAI?.userContext || {}
      });

      // Mostrar modal si hay resultado
      if (result.success && result.results[0]) {
        window.lexModals.showAgentResult(result.results[0], {
          profile: window.lexAI?.userContext || {}
        });

        // Estado visual según resultado
        const agentResult = result.results[0];
        let finalState = 'thinking';

        if (agentResult.recommendation) {
          // Calculator Agent
          finalState = agentResult.recommendation.level === 'accept' ? 'happy' :
                       agentResult.recommendation.level === 'reject' ? 'sad' : 'warning';
        } else if (agentResult.insights) {
          // History/Finances Agent
          finalState = agentResult.insights.warnings?.length > 0 ? 'warning' : 'happy';
        } else {
          finalState = 'happy';
        }

        if (window.setLexState) {
          window.setLexState(finalState, {
            message: 'Análisis completado',
            duration: 5000
          });
        }
      }

    } 
    // FALLBACK: Usar funciones antiguas
    else {
      console.warn('[LEX] Sistema de agentes no disponible, usando método antiguo');
      
      const fallbackFunctions = {
        'calculator': window.lexAI?.analyzeCurrentLoad || window.analyzeLexLoad,
        'history': window.analyzeLexHistory,
        'zones': window.analyzeLexZones,
        'finances': window.analyzeLexFinances
      };

      const fn = fallbackFunctions[currentTab];
      if (typeof fn === 'function') {
        await fn.call(window.lexAI || window);
      } else {
        if (window.setLexState) {
          window.setLexState('warning', {
            message: `No encontré analizador para ${currentTab}`,
            duration: 5000
          });
        }
      }
    }

  } catch (err) {
    console.error('[LEX] Error en triggerLex:', err);
    if (window.setLexState) {
      window.setLexState('sad', {
        message: 'Error al analizar',
        duration: 5000
      });
    }
  }
};

// Función para mostrar resultado según tab
function mostrarResultadoLex(result, tab) {
  console.log('📊 Resultado Lex:', result);

  // Calculator
  if (tab === 'calculator' && result.agent === 'Calculator') {
    const { data, recommendation } = result;
    
    // Usar modal existente de LexAI o crear simple
    if (window.lexAI?.showLoadAnalysisModal) {
      // Adaptar al formato del modal existente
      window.lexAI.showLoadAnalysisModal({
        loadData: data.loadData,
        metrics: data.metrics,
        trapAnalysis: data.trap,
        recommendation: recommendation
      });
    } else {
      // Log simple por ahora
      alert(`${recommendation.action}\n\n${recommendation.reasons.join('\n')}`);
    }

    // Estado visual
    const state = recommendation.level === 'accept' ? 'happy' : 
                  recommendation.level === 'reject' ? 'sad' : 'warning';
    
    window.setLexState?.(state, {
      message: recommendation.action,
      duration: 5000
    });
  }

  // History, Zones, Finances - usar funciones existentes por ahora
  else if (tab === 'history' && window.analyzeLexHistory) {
    window.analyzeLexHistory();
  }
  else if (tab === 'zones' && window.analyzeLexZones) {
    window.analyzeLexZones();
  }
  else if (tab === 'finances' && window.analyzeLexFinances) {
    window.analyzeLexFinances();
  }
}

// ==========================================================
//  ANALISIS AVANZADO DEL HISTORIAL
// ==========================================================
async function analyzeHistoryLex(loads = []) {
  try {
    if (!loads || loads.length === 0) {
      return {
        summary: "No hay cargas en este periodo para analizar.",
        insights: []
      };
    }

    const totalLoads = loads.length;
    let totalMiles = 0,
        totalRevenue = 0,
        totalProfit = 0;

    const stateStats = {};

    // Recoger datos básicos
    loads.forEach(load => {
      const miles = Number(load.totalMiles || 0);
      const revenue = Number(load.totalCharge || 0);
      const profit = Number(load.netProfit || 0);

      totalMiles += miles;
      totalRevenue += revenue;
      totalProfit += profit;

      const state = load.destinationState || load.destination?.slice(-2) || "??";
      if (!stateStats[state]) stateStats[state] = { loads: 0, miles: 0, revenue: 0, profit: 0 };
      stateStats[state].loads++;
      stateStats[state].miles += miles;
      stateStats[state].revenue += revenue;
      stateStats[state].profit += profit;
    });

    // KPIs
    const avgRpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const avgProfitPerLoad = totalProfit / totalLoads;
    const avgMilesPerLoad = totalMiles / totalLoads;

    // Comparación con el perfil de Lex
    const profile = this.userContext || {};
    const globalRPM = profile.avgRPM || 0.95;
    const globalProfit = profile.avgProfit || 100;
    const globalMiles = profile.avgMilesPerLoad || 350;

    // Insights
    const insights = [];

    // Comparación de RPM
    if (avgRpm > globalRPM) {
      insights.push(`RPM superior al histórico (+${(avgRpm - globalRPM).toFixed(2)}).`);
    } else {
      insights.push(`RPM por debajo del histórico (${avgRpm.toFixed(2)} vs ${globalRPM.toFixed(2)}).`);
    }

    // Profit por carga
    if (avgProfitPerLoad >= globalProfit) {
      insights.push(`Ganancia por carga por encima del promedio.`);
    } else {
      insights.push(`Ganancia por carga menor al promedio histórico.`);
    }

    // Millas por carga
    if (avgMilesPerLoad > globalMiles) {
      insights.push(`Estás haciendo cargas más largas que tu promedio.`);
    } else {
      insights.push(`Las cargas de este periodo fueron más cortas de lo normal.`);
    }

    // Estados mejores y peores
    const orderedStates = Object.entries(stateStats).sort(
      (a, b) => (b[1].revenue / b[1].miles) - (a[1].revenue / a[1].miles)
    );

    const bestStates = orderedStates.slice(0, 3).map(s => s[0]);
    const worstStates = orderedStates.slice(-3).map(s => s[0]);

    return {
      summary: `Cargas analizadas: ${totalLoads}. RPM promedio: $${avgRpm.toFixed(2)}. Ganancia total: $${totalProfit.toFixed(0)}.`,
      insights,
      bestStates,
      worstStates
    };

  } catch (error) {
    console.error("[LEX-HISTORY] Error en análisis histórico:", error);
    return {
      summary: "Error al analizar el historial.",
      insights: []
    };
  }
}


window.closeLexZonesModal = function () {
  const modal = document.getElementById('lexZonesModal');
  if (modal) modal.remove();
  if (window.setLexState) window.setLexState('idle');
};

