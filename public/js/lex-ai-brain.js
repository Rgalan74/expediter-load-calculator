// ==========================================================
//  LEX-AI-BRAIN.JS v2.0 - Sistema de Aprendizaje Completo
//  Aprende de tus cargas, zonas, finanzas y decisiones
//  $0 - Sin APIs externas - 100% Firebase
// ==========================================================

class LexAI {
  constructor() {
    // Estado y memoria de contexto
    this.userContext = {
      avgRPM: 1.30,
      preferredZones: [],
      avgCPM: 0.526,
      minRPM: 1.20,
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
      
      console.log('🧠 Inicializando Lex AI...');
      
      // PASO 1: Intentar cargar perfil existente
      const profileDoc = await this.profileRef.get();
      
      if (profileDoc.exists) {
        // ✅ Perfil existe - cargar datos aprendidos
        console.log('📚 Cargando perfil de aprendizaje existente...');
        const profile = profileDoc.data();
        
        this.userContext = {
          ...this.userContext,
          avgRPM: profile.avgRPM || 1.30,
          avgCPM: profile.avgCPM || 0.526,
          minRPM: profile.thresholds?.minSafeRPM || 1.20,
          targetRPM: profile.thresholds?.targetRPM || 1.30,
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
      
      console.log('🎯 Lex AI listo para analizar cargas');
      
    } catch (error) {
      console.error('❌ Error inicializando Lex:', error);
      // Valores por defecto en caso de error
      this.userContext.avgRPM = 1.30;
      this.userContext.avgCPM = 0.526;
    }
  }

  // ==========================================================
  //  CREAR PERFIL INICIAL (Primera vez)
  // ==========================================================
  async createInitialProfile() {
    try {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      
      console.log('📊 Analizando tu historial de cargas...');
      
      // Cargar TODAS las cargas del usuario
      const loadsSnapshot = await db.collection('loads')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();
      
      const loads = [];
      loadsSnapshot.forEach(doc => {
        loads.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`📦 Encontradas ${loads.length} cargas para analizar`);
      
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
        avgDeadheadPercent: stats.avgDeadheadPercent,
        
        // Por estado
        stateStats: stats.stateStats,
        
        // Zonas clasificadas
        preferredStates: stats.preferredStates,
        badStates: stats.badStates,
        neutralStates: stats.neutralStates,
        
        // Patrones de negocio
        businessPatterns: {
          avgLoadsPerMonth: stats.avgLoadsPerMonth,
          avgMilesPerLoad: stats.avgMilesPerLoad,
          avgDaysOut: stats.avgDaysOut || 0
        },
        
        // Umbrales aprendidos
        thresholds: {
          minSafeRPM: Math.max(stats.avgRPM * 0.90, 1.00),
          targetRPM: stats.avgRPM,
          maxDeadheadPercent: 30,
          minDailyProfit: stats.avgProfit * 0.80
        },
        
        // Metadata
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
        cargas: loads.length,
        avgRPM: stats.avgRPM.toFixed(2),
        estados: Object.keys(stats.stateStats).length
      });
      
    } catch (error) {
      console.error('❌ Error creando perfil inicial:', error);
      await this.createEmptyProfile();
    }
  }

  // ==========================================================
  //  CALCULAR ESTADÍSTICAS DESDE CARGAS
  // ==========================================================
  calculateStatsFromLoads(loads) {
    let totalMiles = 0;
    let totalLoadedMiles = 0;
    let totalDeadheadMiles = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let validRPMs = [];
    let stateStats = {};
    
    loads.forEach(load => {
      // Totales
      const miles = load.totalMiles || (load.loadedMiles || 0) + (load.deadheadMiles || 0);
      const loadedMiles = load.loadedMiles || 0;
      const deadheadMiles = load.deadheadMiles || 0;
      const revenue = load.rate || load.totalCharge || 0;
      const rpm = load.rpm || (miles > 0 ? revenue / miles : 0);
      const profit = load.netProfit || (revenue - (miles * (this.userContext.avgCPM || 0.526)));
      
      totalMiles += miles;
      totalLoadedMiles += loadedMiles;
      totalDeadheadMiles += deadheadMiles;
      totalRevenue += revenue;
      totalProfit += profit;
      
      if (rpm > 0) validRPMs.push(rpm);
      
      // Por estado
      const state = load.destinationState;
      if (state) {
        if (!stateStats[state]) {
          stateStats[state] = {
            loads: 0,
            totalMiles: 0,
            totalRevenue: 0,
            totalProfit: 0,
            rpms: []
          };
        }
        stateStats[state].loads++;
        stateStats[state].totalMiles += miles;
        stateStats[state].totalRevenue += revenue;
        stateStats[state].totalProfit += profit;
        if (rpm > 0) stateStats[state].rpms.push(rpm);
      }
    });
    
    // Calcular promedios
    const avgRPM = validRPMs.length > 0 
      ? validRPMs.reduce((a, b) => a + b, 0) / validRPMs.length 
      : 1.30;
    
    const avgCPM = totalMiles > 0 
      ? (totalRevenue - totalProfit) / totalMiles 
      : 0.526;
    
    const avgProfit = loads.length > 0 
      ? totalProfit / loads.length 
      : 0;
    
    const avgDeadheadPercent = totalMiles > 0 
      ? (totalDeadheadMiles / totalMiles) * 100 
      : 0;
    
    // Calcular promedios por estado
    Object.keys(stateStats).forEach(state => {
      const stats = stateStats[state];
      stats.avgRPM = stats.rpms.length > 0 
        ? stats.rpms.reduce((a, b) => a + b, 0) / stats.rpms.length 
        : 0;
      stats.avgProfit = stats.loads > 0 
        ? stats.totalProfit / stats.loads 
        : 0;
      delete stats.rpms; // No guardar array completo
    });
    
    // Clasificar estados
    const statesByRPM = Object.entries(stateStats)
      .sort(([, a], [, b]) => b.avgRPM - a.avgRPM);
    
    const topThird = Math.ceil(statesByRPM.length / 3);
    const preferredStates = statesByRPM.slice(0, topThird).map(([state]) => state);
    const badStates = statesByRPM.slice(-topThird).map(([state]) => state);
    const neutralStates = statesByRPM
      .slice(topThird, -topThird)
      .map(([state]) => state);
    
    // Patrones de negocio
    const monthsOfData = this.calculateMonthsOfData(loads);
    const avgLoadsPerMonth = monthsOfData > 0 ? loads.length / monthsOfData : 0;
    const avgMilesPerLoad = loads.length > 0 ? totalMiles / loads.length : 0;
    
    return {
      totalMiles,
      totalLoadedMiles,
      totalDeadheadMiles,
      totalRevenue,
      totalProfit,
      avgRPM,
      avgCPM,
      avgProfit,
      avgDeadheadPercent,
      stateStats,
      preferredStates,
      badStates,
      neutralStates,
      avgLoadsPerMonth,
      avgMilesPerLoad
    };
  }

  // ==========================================================
  //  CREAR PERFIL VACÍO (Usuario nuevo)
  // ==========================================================
  async createEmptyProfile() {
    const profileData = {
      totalLoads: 0,
      totalMiles: 0,
      totalLoadedMiles: 0,
      totalDeadheadMiles: 0,
      totalRevenue: 0,
      totalProfit: 0,
      avgRPM: 1.30,
      avgCPM: 0.526,
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
        minSafeRPM: 1.20,
        targetRPM: 1.30,
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
      
      console.log('📊 Actualizando perfil de Lex con nueva carga...');
      
      const miles = loadData.totalMiles || 0;
      const loadedMiles = loadData.loadedMiles || 0;
      const deadheadMiles = loadData.deadheadMiles || 0;
      const revenue = loadData.rate || 0;
      const rpm = loadData.rpm || 0;
      const profit = loadData.netProfit || (revenue - (miles * this.userContext.avgCPM));
      const state = loadData.destinationState;
      
      // Actualizar estadísticas globales
      const updates = {
        totalLoads: firebase.firestore.FieldValue.increment(1),
        totalMiles: firebase.firestore.FieldValue.increment(miles),
        totalLoadedMiles: firebase.firestore.FieldValue.increment(loadedMiles),
        totalDeadheadMiles: firebase.firestore.FieldValue.increment(deadheadMiles),
        totalRevenue: firebase.firestore.FieldValue.increment(revenue),
        totalProfit: firebase.firestore.FieldValue.increment(profit),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Actualizar estadísticas por estado
      if (state) {
        const stateKey = `stateStats.${state}`;
        updates[`${stateKey}.loads`] = firebase.firestore.FieldValue.increment(1);
        updates[`${stateKey}.totalMiles`] = firebase.firestore.FieldValue.increment(miles);
        updates[`${stateKey}.totalRevenue`] = firebase.firestore.FieldValue.increment(revenue);
        updates[`${stateKey}.totalProfit`] = firebase.firestore.FieldValue.increment(profit);
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
      Object.keys(stateStats).forEach(state => {
        const stats = stateStats[state];
        if (stats.totalMiles > 0) {
          stats.avgRPM = stats.totalRevenue / stats.totalMiles;
          stats.avgProfit = stats.totalProfit / stats.loads;
        }
      });
      
      // Reclasificar estados
      const statesByRPM = Object.entries(stateStats)
        .filter(([, stats]) => stats.loads >= 3) // Mínimo 3 cargas
        .sort(([, a], [, b]) => (b.avgRPM || 0) - (a.avgRPM || 0));
      
      const topThird = Math.ceil(statesByRPM.length / 3);
      const preferredStates = statesByRPM.slice(0, topThird).map(([state]) => state);
      const badStates = statesByRPM.slice(-topThird).map(([state]) => state);
      
      // Actualizar umbrales
      const thresholds = {
        minSafeRPM: Math.max(avgRPM * 0.90, 1.00),
        targetRPM: avgRPM,
        maxDeadheadPercent: 30,
        minDailyProfit: avgProfit * 0.80
      };
      
      // Guardar cambios
      await this.profileRef.update({
        avgRPM,
        avgCPM,
        avgProfit,
        avgDeadheadPercent,
        stateStats,
        preferredStates,
        badStates,
        thresholds,
        lastCalculated: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Actualizar contexto local
      this.userContext.avgRPM = avgRPM;
      this.userContext.avgCPM = avgCPM;
      this.userContext.thresholds = thresholds;
      this.userContext.preferredZones = preferredStates;
      this.userContext.badZones = badStates;
      
      console.log('🔄 Promedios recalculados:', {
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
      
      const loadsSnapshot = await db.collection('loads')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      
      const loads = [];
      loadsSnapshot.forEach(doc => {
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
  calculateMonthsOfData(loads) {
    if (loads.length === 0) return 0;
    
    const dates = loads
      .map(l => l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt))
      .filter(d => d instanceof Date && !isNaN(d));
    
    if (dates.length === 0) return 1;
    
    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));
    const diffMonths = (newest.getFullYear() - oldest.getFullYear()) * 12 + 
                       (newest.getMonth() - oldest.getMonth());
    
    return Math.max(diffMonths, 1);
  }

  // ==========================================================
  //  ANALIZAR CARGA ACTUAL (Mejorado con aprendizaje)
  // ==========================================================
  async analyzeCurrentLoad() {
    // Cambiar estado visual de Lex
    if (window.setLexState) {
      window.setLexState('thinking', { message: 'Analizando carga...', duration: 2000 });
    }
    
    // Obtener datos de la carga actual
    const loadData = this.getCurrentLoadData();
    
    if (!loadData || !loadData.totalMiles) {
      if (window.setLexState) {
        window.setLexState('sad', { 
          message: 'No veo datos de carga para analizar 🤔', 
          duration: 4000 
        });
      }
      alert('Por favor, primero calcula una carga antes de analizarla con Lex');
      return null;
    }
    
    // Análisis mejorado con datos aprendidos
    const rpm = loadData.rate / loadData.totalMiles;
    const profit = loadData.rate - (loadData.totalMiles * this.userContext.avgCPM);
    const dailyProfit = profit / Math.max(1, (loadData.totalMiles / 500));
    
    // Obtener estadísticas del estado destino
    const stateStats = this.userContext.stateStats[loadData.destinationState] || null;
    
    // Determinar recomendación con aprendizaje
    let recommendation = 'EVALUAR';
    let lexState = 'thinking';
    let confidence = 0;
    
    // Lógica mejorada basada en aprendizaje
    const targetRPM = this.userContext.targetRPM || this.userContext.avgRPM;
    const minRPM = this.userContext.thresholds?.minSafeRPM || this.userContext.avgRPM * 0.90;
    
    if (rpm >= targetRPM) {
      recommendation = 'ACEPTAR';
      lexState = 'happy';
      confidence = 90;
    } else if (rpm >= targetRPM * 0.95 && profit > 400) {
      recommendation = 'ACEPTAR';
      lexState = 'happy';
      confidence = 80;
    } else if (rpm < minRPM) {
      recommendation = 'RECHAZAR';
      lexState = 'sad';
      confidence = 85;
    } else if (rpm < targetRPM * 0.90 && profit < 300) {
      recommendation = 'RECHAZAR';
      lexState = 'sad';
      confidence = 75;
    } else {
      recommendation = 'NEGOCIAR';
      lexState = 'warning';
      confidence = 70;
    }
    
    // Ajustes basados en estadísticas del estado
    if (stateStats) {
      const stateAvgRPM = stateStats.avgRPM || 0;
      
      if (this.userContext.badZones?.includes(loadData.destinationState)) {
        confidence -= 10;
        if (recommendation === 'ACEPTAR' && rpm < targetRPM * 1.05) {
          recommendation = 'NEGOCIAR';
          lexState = 'warning';
        }
      } else if (this.userContext.preferredZones?.includes(loadData.destinationState)) {
        confidence += 5;
      }
    }
    
    // Ajustar por deadhead
    if (loadData.deadheadMiles > 150) {
      confidence -= 10;
      if (recommendation === 'ACEPTAR' && loadData.deadheadMiles > 200) {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
      }
    }
    
    // Ajustar por profit bajo
    if (profit < 200) {
      confidence -= 15;
      if (recommendation === 'ACEPTAR') {
        recommendation = 'NEGOCIAR';
        lexState = 'warning';
      }
    }
    
    // Preparar análisis completo
    const analysis = {
      recommendation,
      confidence: Math.max(20, Math.min(95, confidence)),
      metrics: {
        rpm: rpm.toFixed(2),
        profit: profit.toFixed(0),
        dailyProfit: dailyProfit.toFixed(0),
        vsAverage: ((rpm / targetRPM) * 100 - 100).toFixed(1),
        stateAvgRPM: stateStats?.avgRPM?.toFixed(2) || 'N/A'
      },
      reasons: this.generateReasonsWithLearning(loadData, rpm, profit, stateStats)
    };
    
    // Mostrar resultado
    this.displayAnalysis(analysis, lexState);
    
    return analysis;
  }

  // ==========================================================
  //  GENERAR RAZONES CON APRENDIZAJE
  // ==========================================================
  generateReasonsWithLearning(loadData, rpm, profit, stateStats) {
    const reasons = [];
    const targetRPM = this.userContext.targetRPM || this.userContext.avgRPM;
    
    // RPM Analysis con comparación a datos aprendidos
    if (rpm >= targetRPM) {
      reasons.push(`✅ RPM de $${rpm.toFixed(2)} está por encima de tu objetivo ($${targetRPM.toFixed(2)})`);
    } else if (rpm >= targetRPM * 0.95) {
      reasons.push(`⚠️ RPM de $${rpm.toFixed(2)} está cerca de tu objetivo`);
    } else if (rpm < targetRPM * 0.85) {
      reasons.push(`❌ RPM de $${rpm.toFixed(2)} está ${Math.abs(((rpm / targetRPM) * 100 - 100)).toFixed(0)}% debajo de tu objetivo`);
    } else {
      reasons.push(`⚠️ RPM de $${rpm.toFixed(2)} está por debajo de tu objetivo`);
    }
    
    // Profit Analysis
    if (profit > 500) {
      reasons.push(`✅ Ganancia neta excelente de $${profit.toFixed(0)}`);
    } else if (profit > 350) {
      reasons.push(`✅ Ganancia neta buena de $${profit.toFixed(0)}`);
    } else if (profit > 200) {
      reasons.push(`⚠️ Ganancia neta aceptable de $${profit.toFixed(0)}`);
    } else {
      reasons.push(`❌ Ganancia neta baja de solo $${profit.toFixed(0)}`);
    }
    
    // Estado Analysis con datos aprendidos
    if (loadData.destinationState && stateStats) {
      const stateRPM = stateStats.avgRPM || 0;
      const stateLoads = stateStats.loads || 0;
      
      if (this.userContext.preferredZones?.includes(loadData.destinationState)) {
        reasons.push(`✅ ${loadData.destinationState} es una de tus mejores zonas (${stateLoads} cargas, $${stateRPM.toFixed(2)} RPM promedio)`);
      } else if (this.userContext.badZones?.includes(loadData.destinationState)) {
        reasons.push(`❌ ${loadData.destinationState} históricamente te ha dado bajo rendimiento ($${stateRPM.toFixed(2)} RPM promedio)`);
      } else if (stateLoads >= 3) {
        reasons.push(`ℹ️ ${loadData.destinationState}: tienes ${stateLoads} cargas previas con $${stateRPM.toFixed(2)} RPM promedio`);
      } else {
        reasons.push(`🆕 ${loadData.destinationState}: estado nuevo para ti (sin historial suficiente)`);
      }
    }
    
    // Deadhead Analysis
    const deadheadPercent = (loadData.deadheadMiles / loadData.totalMiles) * 100;
    const avgDeadheadPercent = this.userContext.avgDeadheadPercent || 20;
    
    if (deadheadPercent > avgDeadheadPercent * 1.5) {
      reasons.push(`❌ Deadhead de ${deadheadPercent.toFixed(0)}% es muy alto (tu promedio: ${avgDeadheadPercent.toFixed(0)}%)`);
    } else if (deadheadPercent < avgDeadheadPercent * 0.8) {
      reasons.push(`✅ Deadhead de ${deadheadPercent.toFixed(0)}% está por debajo de tu promedio`);
    }
    
    return reasons;
  }

  // ==========================================================
  //  MOSTRAR ANÁLISIS (mantener código existente)
  // ==========================================================
  displayAnalysis(analysis, lexState) {
    // Calcular tasa sugerida si es NEGOCIAR
    let suggestedRate = null;
    if (analysis.recommendation === 'NEGOCIAR') {
      const loadData = this.getCurrentLoadData();
      if (loadData) {
        suggestedRate = Math.ceil(loadData.totalMiles * this.userContext.targetRPM);
      }
    }
    
    // Crear modal
    const existingModal = document.getElementById('lexAnalysisModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'lexAnalysisModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 relative animate-slideIn">
        <!-- Header -->
        <div class="flex items-start gap-4 mb-6">
          <img src="img/lex/lex-${lexState === 'warning' ? 'alert' : lexState}.png" 
               class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 p-2">
          <div class="flex-1">
            <h3 class="text-xl font-bold text-gray-800 mb-1">Análisis de Lex</h3>
            <p class="text-sm text-gray-500">Basado en tus ${this.userContext.totalLoads || 0} cargas previas</p>
          </div>
          <button onclick="closeLexAnalysis()" class="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        
        <!-- Recomendación -->
        <div class="mb-6 p-4 rounded-lg ${
          analysis.recommendation === 'ACEPTAR' ? 'bg-green-50 border-2 border-green-500' :
          analysis.recommendation === 'RECHAZAR' ? 'bg-red-50 border-2 border-red-500' :
          'bg-yellow-50 border-2 border-yellow-500'
        }">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl font-bold ${
              analysis.recommendation === 'ACEPTAR' ? 'text-green-700' :
              analysis.recommendation === 'RECHAZAR' ? 'text-red-700' :
              'text-yellow-700'
            }">${analysis.recommendation}</span>
            <span class="text-sm font-semibold ${
              analysis.recommendation === 'ACEPTAR' ? 'text-green-600' :
              analysis.recommendation === 'RECHAZAR' ? 'text-red-600' :
              'text-yellow-600'
            }">Confianza: ${analysis.confidence}%</span>
          </div>
        </div>
        
        <!-- Métricas -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <div class="bg-gray-50 p-3 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">RPM</p>
            <p class="text-lg font-bold text-gray-800">$${analysis.metrics.rpm}</p>
            <p class="text-xs ${parseFloat(analysis.metrics.vsAverage) >= 0 ? 'text-green-600' : 'text-red-600'}">
              ${parseFloat(analysis.metrics.vsAverage) >= 0 ? '+' : ''}${analysis.metrics.vsAverage}% vs objetivo
            </p>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Ganancia</p>
            <p class="text-lg font-bold text-gray-800">$${analysis.metrics.profit}</p>
            <p class="text-xs text-gray-500">~$${analysis.metrics.dailyProfit}/día</p>
          </div>
          ${analysis.metrics.stateAvgRPM !== 'N/A' ? `
          <div class="bg-blue-50 p-3 rounded-lg col-span-2">
            <p class="text-xs text-blue-600 mb-1">📊 Estado: RPM Promedio Histórico</p>
            <p class="text-lg font-bold text-blue-800">$${analysis.metrics.stateAvgRPM}</p>
          </div>
          ` : ''}
        </div>
        
        <!-- Razones -->
        <div class="mb-6">
          <p class="text-sm font-semibold text-gray-700 mb-2">📋 Análisis:</p>
          <ul class="space-y-2">
            ${analysis.reasons.map(r => `<li class="text-sm text-gray-700">${r}</li>`).join('')}
          </ul>
        </div>
        
        <!-- Contraoferta -->
        ${analysis.recommendation === 'NEGOCIAR' && suggestedRate ? `
          <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
            <p class="text-sm font-semibold text-yellow-800 mb-2">💡 Sugerencia:</p>
            <p class="text-sm text-yellow-700 mb-3">
              Pide $${suggestedRate} para alcanzar tu RPM objetivo de $${this.userContext.targetRPM.toFixed(2)}
            </p>
            <button onclick="copyLexCounteroffer(${suggestedRate})" 
                    class="w-full bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 transition">
              📋 Copiar mensaje de negociación
            </button>
          </div>
        ` : ''}
        
        <!-- Botones -->
        <div class="flex gap-3">
          <button onclick="closeLexAnalysis()" 
                  class="flex-1 bg-green-600 text-gray-700 py-3 rounded-lg font-semibold hover:bg-green-300 transition">
            Entendido
          </button>
          <button onclick="saveLexAnalysis()" 
                  class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            💾 Guardar
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Mensaje en burbuja
    const shortMessage = {
      'ACEPTAR': `¡Excelente carga! ${analysis.confidence}% de confianza 👍`,
      'RECHAZAR': `Esta carga no vale la pena (${analysis.confidence}% seguro) 👎`,
      'NEGOCIAR': `Podrías negociar un mejor precio 💰`
    };
    
    if (window.setLexState) {
      window.setLexState(lexState, {
        message: shortMessage[analysis.recommendation],
        duration: 5000
      });
    }
    
    window.lastLexAnalysis = analysis;
  }

  // ==========================================================
  //  OBTENER DATOS DE CARGA ACTUAL (mantener)
  // ==========================================================
  getCurrentLoadData() {
    try {
      const loadedMiles = parseFloat(document.getElementById('loadedMiles')?.value) || 0;
      const deadheadMiles = parseFloat(document.getElementById('deadheadMiles')?.value) || 0;
      const rate = parseFloat(document.getElementById('rate')?.value) || 0;
      const origin = document.getElementById('origin')?.value || '';
      const destination = document.getElementById('destination')?.value || '';
      
      if (loadedMiles === 0 || rate === 0) {
        return null;
      }
      
      let destinationState = null;
      const stateMatch = destination.match(/,\s*([A-Z]{2})/);
      if (stateMatch) {
        destinationState = stateMatch[1];
      }
      
      return {
        origin,
        destination,
        loadedMiles,
        deadheadMiles,
        totalMiles: loadedMiles + deadheadMiles,
        rate,
        rpm: rate / (loadedMiles + deadheadMiles),
        destinationState
      };
      
    } catch (error) {
      console.error('Error obteniendo datos de carga:', error);
      return null;
    }
  }
}

// ==========================================================
//  FUNCIONES GLOBALES
// ==========================================================

window.lexAI = null;

window.analyzeLexLoad = async function() {
  if (!window.lexAI) {
    window.lexAI = new LexAI();
    await window.lexAI.initializeContext();
  }
  return window.lexAI.analyzeCurrentLoad();
};

window.closeLexAnalysis = function() {
  const modal = document.getElementById('lexAnalysisModal');
  if (modal) modal.remove();
  if (window.setLexState) {
    window.setLexState('idle');
  }
};

window.saveLexAnalysis = async function() {
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

window.copyLexCounteroffer = function(suggestedRate) {
  const message = `Puedo hacer esta carga por $${suggestedRate}. Eso me da un RPM justo de $${window.lexAI.userContext.targetRPM.toFixed(2)} que es mi mínimo operativo.`;
  
  navigator.clipboard.writeText(message).then(() => {
    event.target.textContent = '✅ ¡Copiado!';
    event.target.classList.add('bg-green-600');
    
    setTimeout(() => {
      event.target.textContent = '📋 Copiar mensaje de negociación';
      event.target.classList.remove('bg-green-600');
    }, 2000);
  });
};

// Inicializar cuando esté listo
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🤖 Iniciando Lex AI v2.0...');
  
  setTimeout(async () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          console.log('👤 Usuario autenticado, iniciando Lex AI');
          window.lexAI = new LexAI();
          await window.lexAI.initializeContext();
          
          // Agregar botón al calculator
          setTimeout(() => {
            const calculateBtn = document.querySelector('#calculateBtn');
            if (calculateBtn && !document.getElementById('lexAnalyzeBtn')) {
              const lexBtn = document.createElement('button');
              lexBtn.id = 'lexAnalyzeBtn';
              lexBtn.type = 'button';
              lexBtn.className = 'bg-gradient-to-r from-blue-600 to-purple-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-800 transition flex items-center gap-2 mt-2 w-full';
              lexBtn.innerHTML = `
                <img src="img/lex/lex-thinking.png" class="w-6 h-6">
                <span>🧠 Analizar con Lex AI</span>
              `;
              lexBtn.onclick = analyzeLexLoad;
              
              calculateBtn.parentElement.appendChild(lexBtn);
              console.log('✅ Botón de Lex AI agregado');
            }
          }, 2000);
          
          // Mensaje de bienvenida
          if (window.setLexState) {
            const totalLoads = window.lexAI.userContext.totalLoads || 0;
            const greeting = totalLoads > 0
              ? `¡Hola! He aprendido de tus ${totalLoads} cargas. RPM objetivo: $${window.lexAI.userContext.targetRPM?.toFixed(2) || '1.30'} 🎯`
              : '¡Hola! Soy Lex. Analiza cargas y empezaré a aprender de ti 🚀';
              
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

console.log('🧠 Lex AI Brain v2.0 (Sistema de Aprendizaje) cargado exitosamente');