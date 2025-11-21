// 🧠 LEX LEARNING SYSTEM
// Sistema de aprendizaje automático de Lex basado en datos históricos
// Sin APIs externas - Todo en Firebase

// ====================================================================
// 1. INICIALIZAR PERFIL (Ejecutar una sola vez o cuando se necesite recalcular)
// ====================================================================

async function initializeLexProfile() {
  console.log('🧠 Inicializando perfil de Lex...');
  
  if (!window.currentUser) {
    throw new Error('Usuario no autenticado');
  }

  try {
    const loadsSnapshot = await firebase.firestore()
      .collection("loads")
      .where("userId", "==", window.currentUser.uid)
      .orderBy("date", "asc")
      .get();
    
    const loads = loadsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        originState: data.originState || '',
        destinationState: data.destinationState || '',
        totalMiles: Number(data.totalMiles || 0),
        deadheadMiles: Number(data.deadheadMiles || data.deadhead || 0),
        totalCharge: Number(data.totalCharge || 0),
        netProfit: Number(data.netProfit || 0),
        rpm: Number(data.rpm || 0),
        totalExpenses: Number(data.totalExpenses || 0)
      };
    }).filter(load => load.totalMiles > 0);
    
    console.log(`📦 ${loads.length} cargas encontradas`);
    
    const totalLoads = loads.length;
    const totalMiles = loads.reduce((sum, l) => sum + l.totalMiles, 0);
    const totalRevenue = loads.reduce((sum, l) => sum + l.totalCharge, 0);
    const totalProfit = loads.reduce((sum, l) => sum + l.netProfit, 0);
    const totalExpenses = loads.reduce((sum, l) => sum + l.totalExpenses, 0);
    
    const avgRPM = totalRevenue / totalMiles;
    const avgCPM = totalExpenses / totalMiles;
    const avgProfit = totalProfit / totalLoads;
    const minSafeRPM = avgCPM + 0.18;
    
    const stateStats = {};
    
    loads.forEach(load => {
      const state = load.destinationState;
      if (!state) return;
      
      if (!stateStats[state]) {
        stateStats[state] = {
          loads: 0,
          totalMiles: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalDeadhead: 0,
          lastLoads: []
        };
      }
      
      stateStats[state].loads += 1;
      stateStats[state].totalMiles += load.totalMiles;
      stateStats[state].totalRevenue += load.totalCharge;
      stateStats[state].totalProfit += load.netProfit;
      stateStats[state].totalDeadhead += load.deadheadMiles;
      
      if (stateStats[state].lastLoads.length < 5) {
        stateStats[state].lastLoads.push({
          id: load.id,
          date: load.date,
          rpm: load.rpm,
          profit: load.netProfit
        });
      }
    });
    
    Object.keys(stateStats).forEach(state => {
      const stats = stateStats[state];
      stats.avgRPM = stats.totalRevenue / stats.totalMiles;
      stats.avgProfit = stats.totalProfit / stats.loads;
      stats.avgDeadhead = stats.totalDeadhead / stats.loads;
    });
    
    const statesWithMinLoads = Object.entries(stateStats)
      .filter(([state, stats]) => stats.loads >= 3);
    
    const preferredStates = statesWithMinLoads
      .filter(([state, stats]) => stats.avgRPM >= avgRPM && stats.avgProfit >= avgProfit)
      .map(([state]) => state)
      .sort();
    
    const avoidStates = statesWithMinLoads
      .filter(([state, stats]) => stats.avgRPM < avgRPM * 0.9 || stats.avgProfit < avgProfit * 0.8)
      .map(([state]) => state)
      .sort();
    
    const profile = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      totalLoads,
      totalMiles,
      totalRevenue,
      totalProfit,
      totalExpenses,
      avgRPM,
      avgCPM,
      avgProfit,
      minSafeRPM,
      stateStats,
      preferredStates,
      avoidStates,
      currentCosts: {
        combustible: 0.182,
        mantenimiento: 0.020,
        comida: 0.028,
        costosFijos: 0.346,
        total: 0.576
      }
    };
    
    await firebase.firestore()
      .collection('lexProfiles')
      .doc(window.currentUser.uid)
      .set(profile);
    
    console.log('✅ Perfil de Lex inicializado');
    return profile;
    
  } catch (error) {
    console.error('❌ Error inicializando perfil:', error);
    throw error;
  }
}

// ====================================================================
// 2. ACTUALIZAR PERFIL (Llamar cada vez que se guarda una carga)
// ====================================================================

async function updateLexProfileWithLoad(loadData) {
  if (!window.currentUser) return;

  try {
    const profileRef = firebase.firestore()
      .collection('lexProfiles')
      .doc(window.currentUser.uid);
    
    const profileDoc = await profileRef.get();
    
    if (!profileDoc.exists) {
      console.log('⚠️  Perfil no existe, inicializando...');
      await initializeLexProfile();
      return;
    }
    
    const profile = profileDoc.data();
    
    const totalMiles = Number(loadData.totalMiles || 0);
    const totalCharge = Number(loadData.totalCharge || 0);
    const netProfit = Number(loadData.netProfit || 0);
    const totalExpenses = Number(loadData.totalExpenses || 0);
    const rpm = Number(loadData.rpm || 0);
    const deadheadMiles = Number(loadData.deadheadMiles || 0);
    const destState = loadData.destinationState || '';
    
    const newTotalLoads = profile.totalLoads + 1;
    const newTotalMiles = profile.totalMiles + totalMiles;
    const newTotalRevenue = profile.totalRevenue + totalCharge;
    const newTotalProfit = profile.totalProfit + netProfit;
    const newTotalExpenses = profile.totalExpenses + totalExpenses;
    
    const newAvgRPM = newTotalRevenue / newTotalMiles;
    const newAvgCPM = newTotalExpenses / newTotalMiles;
    const newAvgProfit = newTotalProfit / newTotalLoads;
    const newMinSafeRPM = newAvgCPM + 0.18;
    
    const stateStats = profile.stateStats || {};
    
    if (destState) {
      if (!stateStats[destState]) {
        stateStats[destState] = {
          loads: 0,
          totalMiles: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalDeadhead: 0,
          avgRPM: 0,
          avgProfit: 0,
          avgDeadhead: 0,
          lastLoads: []
        };
      }
      
      const state = stateStats[destState];
      state.loads += 1;
      state.totalMiles += totalMiles;
      state.totalRevenue += totalCharge;
      state.totalProfit += netProfit;
      state.totalDeadhead += deadheadMiles;
      
      state.avgRPM = state.totalRevenue / state.totalMiles;
      state.avgProfit = state.totalProfit / state.loads;
      state.avgDeadhead = state.totalDeadhead / state.loads;
      
      state.lastLoads = state.lastLoads || [];
      state.lastLoads.unshift({
        id: loadData.id || 'new',
        date: loadData.date || new Date().toISOString().split('T')[0],
        rpm: rpm,
        profit: netProfit
      });
      
      if (state.lastLoads.length > 5) {
        state.lastLoads = state.lastLoads.slice(0, 5);
      }
    }
    
    const statesWithMinLoads = Object.entries(stateStats)
      .filter(([state, stats]) => stats.loads >= 3);
    
    const preferredStates = statesWithMinLoads
      .filter(([state, stats]) => stats.avgRPM >= newAvgRPM && stats.avgProfit >= newAvgProfit)
      .map(([state]) => state)
      .sort();
    
    const avoidStates = statesWithMinLoads
      .filter(([state, stats]) => stats.avgRPM < newAvgRPM * 0.9 || stats.avgProfit < newAvgProfit * 0.8)
      .map(([state]) => state)
      .sort();
    
    const updatedProfile = {
      ...profile,
      totalLoads: newTotalLoads,
      totalMiles: newTotalMiles,
      totalRevenue: newTotalRevenue,
      totalProfit: newTotalProfit,
      totalExpenses: newTotalExpenses,
      avgRPM: newAvgRPM,
      avgCPM: newAvgCPM,
      avgProfit: newAvgProfit,
      minSafeRPM: newMinSafeRPM,
      stateStats: stateStats,
      preferredStates: preferredStates,
      avoidStates: avoidStates,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await profileRef.set(updatedProfile, { merge: true });
    
    console.log('✅ Perfil de Lex actualizado');
    
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
  }
}

// ====================================================================
// 3. LEER PERFIL (Para usar en análisis de Lex)
// ====================================================================

async function getLexProfile() {
  if (!window.currentUser) {
    throw new Error('Usuario no autenticado');
  }

  try {
    const profileDoc = await firebase.firestore()
      .collection('lexProfiles')
      .doc(window.currentUser.uid)
      .get();
    
    if (!profileDoc.exists) {
      console.log('⚠️  Perfil no existe, inicializando...');
      return await initializeLexProfile();
    }
    
    return profileDoc.data();
    
  } catch (error) {
    console.error('❌ Error leyendo perfil:', error);
    throw error;
  }
}

// ====================================================================
// 4. ANÁLISIS CON APRENDIZAJE (Para usar en Lex AI)
// ====================================================================

async function analyzeLoadWithLearning(loadData) {
  try {
    const profile = await getLexProfile();
    
    const rpm = Number(loadData.rpm || 0);
    const destState = loadData.destinationState || '';
    const totalMiles = Number(loadData.totalMiles || 0);
    
    // Comparar con promedio real del usuario
    const vsYourAvg = ((rpm - profile.avgRPM) / profile.avgRPM * 100);
    
    // Comparar con historia en ese estado
    const stateStats = destState ? profile.stateStats[destState] : null;
    const vsStateAvg = stateStats ? 
      ((rpm - stateStats.avgRPM) / stateStats.avgRPM * 100) : null;
    
    // Decisión inteligente
    let recommendation = '';
    let reasons = [];
    let color = 'yellow';
    
    if (rpm < profile.minSafeRPM) {
      recommendation = 'RECHAZAR';
      color = 'red';
      reasons.push(`Está $${(profile.minSafeRPM - rpm).toFixed(2)}/mi debajo de tu mínimo seguro`);
    } else if (rpm >= profile.avgRPM * 1.1) {
      recommendation = 'ACEPTA';
      color = 'green';
      reasons.push(`${vsYourAvg.toFixed(1)}% mejor que tu promedio`);
    } else if (rpm >= profile.avgRPM) {
      recommendation = 'CONSIDERA';
      color = 'yellow';
      reasons.push(`Cerca de tu promedio ($${profile.avgRPM.toFixed(2)}/mi)`);
    } else {
      recommendation = 'NEGOCIA';
      color = 'yellow';
      reasons.push(`${Math.abs(vsYourAvg).toFixed(1)}% debajo de tu promedio`);
    }
    
    // Contexto del estado
    if (stateStats) {
      if (stateStats.loads >= 3) {
        if (vsStateAvg > 10) {
          reasons.push(`✅ Mejor que tus ${stateStats.loads} cargas previas en ${destState}`);
        } else if (vsStateAvg < -10) {
          reasons.push(`⚠️ Debajo del promedio de ${destState} ($${stateStats.avgRPM.toFixed(2)})`);
        }
      } else {
        reasons.push(`📍 Solo ${stateStats.loads} carga(s) previa(s) en ${destState}`);
      }
    } else {
      reasons.push(`🆕 Primera vez en ${destState}`);
    }
    
    // Calcular ganancia estimada
    const estimatedProfit = (rpm * totalMiles) - (profile.avgCPM * totalMiles);
    
    return {
      recommendation,
      color,
      rpm,
      yourAvgRPM: profile.avgRPM,
      minSafeRPM: profile.minSafeRPM,
      vsYourAvg: vsYourAvg.toFixed(1),
      vsStateAvg: vsStateAvg ? vsStateAvg.toFixed(1) : null,
      stateAvgRPM: stateStats?.avgRPM || null,
      stateExperience: stateStats ? `${stateStats.loads} cargas previas` : 'Primera vez',
      reasons,
      estimatedProfit: estimatedProfit.toFixed(2),
      destState,
      profileLoaded: true
    };
    
  } catch (error) {
    console.error('❌ Error en análisis:', error);
    return {
      recommendation: 'ERROR',
      color: 'gray',
      reasons: ['Error cargando perfil de aprendizaje'],
      profileLoaded: false
    };
  }
}

// Exponer funciones globalmente
window.initializeLexProfile = initializeLexProfile;
window.updateLexProfileWithLoad = updateLexProfileWithLoad;
window.getLexProfile = getLexProfile;
window.analyzeLoadWithLearning = analyzeLoadWithLearning;

console.log('🧠 Lex Learning System cargado');
console.log('Funciones disponibles:');
console.log('  • initializeLexProfile() - Inicializar perfil');
console.log('  • updateLexProfileWithLoad(loadData) - Actualizar con nueva carga');
console.log('  • getLexProfile() - Obtener perfil actual');
console.log('  • analyzeLoadWithLearning(loadData) - Analizar con aprendizaje');