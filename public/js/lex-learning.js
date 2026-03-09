// 🧠 LEX LEARNING SYSTEM
// Sistema de aprendizaje automático de Lex basado en datos históricos
// Sin APIs externas - Todo en Firebase

// ======================================================
// LEX: Construir stateNotes desde la colección "notes"
// ======================================================
// ======================================================
// LEX: Construir stateNotes desde la colección "notes"
// ======================================================

// Extraer código de estado robusto ("Michigan" -> "MI", "Detroit, MI" -> "MI")
function extractStateFromDestination(location) {
  if (!location || typeof location !== 'string') return '';

  const stateNames = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'IDAHO': 'ID', 'ILLINOIS': 'IL',
    'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY',
    'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA',
    'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH',
    'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC',
    'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR',
    'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY'
  };

  // Normalizar acentos: Míchigan → Michigan, Téxas → Texas
  const normalized = location.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const upper = normalized.toUpperCase();
  const validStates = new Set(Object.values(stateNames));

  // 1) Nombre completo primero
  const sortedNames = Object.keys(stateNames).sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    if (upper.includes(name)) return stateNames[name];
  }

  // 2) Código 2 letras después de coma + algo (Bay City, MI, USA)
  const m = normalized.match(/,\s*([A-Za-z]{2})\s*[,\.]/);
  if (m) {
    const code = m[1].toUpperCase();
    if (validStates.has(code)) return code;
  }

  // 3) Código 2 letras al final con coma (Miami, FL)
  const m2 = normalized.match(/,\s*([A-Za-z]{2})\s*$/);
  if (m2) {
    const code = m2[1].toUpperCase();
    if (validStates.has(code)) return code;
  }

  // 4) Código 2 letras al final sin coma (dodge city ks)
  const m3 = normalized.match(/\s([A-Za-z]{2})\s*$/);
  if (m3) {
    const code = m3[1].toUpperCase();
    if (validStates.has(code)) return code;
  }

  // 5) Exact match
  const cleanCode = upper.trim();
  if (validStates.has(cleanCode)) return cleanCode;

  // 6) Fallback: primera palabra de 2 letras
  const firstWord = cleanCode.split(' ')[0].replace(/[^A-Z]/g, '');
  if (firstWord.length === 2 && validStates.has(firstWord)) return firstWord;

  return null;
}


// Construir mapa { FL: [nota1, nota2], GA: [nota3], ... }
async function buildStateNotesFromNotesCollection(userId) {
  const db = firebase.firestore();
  const snapshot = await db
    .collection('notes')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'asc')
    .get();

  const stateNotesMap = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    const dest = data.destination || '';
    const note = (data.note || '').toString().trim();

    if (!note) return;

    const state = extractStateFromDestination(dest);
    if (!state) return;

    if (!stateNotesMap[state]) {
      stateNotesMap[state] = [];
    }

    // Evitar duplicados exactos
    if (!stateNotesMap[state].includes(note)) {
      stateNotesMap[state].push(note);
    }
  });

  // Limitar a las últimas 3 notas por estado
  const stateNotes = {};
  Object.entries(stateNotesMap).forEach(([state, notes]) => {
    stateNotes[state] = notes.slice(-3);
  });

  return stateNotes;
}

// ====================================================================
// 1. INICIALIZAR PERFIL (Ejecutar una sola vez o cuando se necesite recalcular)
// ====================================================================

async function initializeLexProfile() {
  debugLog('[LEX] Inicializando perfil de Lex...');

  if (!window.currentUser) {
    throw new Error('Usuario no autenticado');
  }

  try {
    const uid = window.currentUser.uid; // 🔹 usamos uid varias veces

    const loadsSnapshot = await firebase.firestore()
      .collection("loads")
      .where("userId", "==", uid)
      .orderBy("date", "asc")
      .get();

    const loads = loadsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        originState: extractStateFromDestination(data.originState || data.origin) || '',
        destinationState: extractStateFromDestination(data.destinationState || data.destination) || '',
        totalMiles: Number(data.totalMiles || 0),
        deadheadMiles: Number(data.deadheadMiles || data.deadhead || 0),
        totalCharge: Number(data.totalCharge || 0),
        netProfit: Number(data.netProfit || 0),
        rpm: Number(data.rpm || 0),
        totalExpenses: Number(data.totalExpenses || 0)
      };
    }).filter(load => load.totalMiles > 0);

    debugLog(`[LEX] ${loads.length} cargas encontradas`);

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

    // 🔹 NUEVO: construir stateNotes desde la colección "notes"
    let stateNotes = {};
    try {
      stateNotes = await buildStateNotesFromNotesCollection(uid);
    } catch (err) {
      console.error('[LEX] Error construyendo stateNotes desde notes:', err);
      stateNotes = {};
    }

    const profile = {
      version: '1.1',
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
      currentCosts: (window.TU_COSTO_REAL) ? {
        combustible: window.TU_COSTO_REAL.combustible || 0.182,
        mantenimiento: window.TU_COSTO_REAL.mantenimiento || 0.020,
        comida: window.TU_COSTO_REAL.comida || 0.028,
        costosFijos: window.TU_COSTO_REAL.costosFijos || 0.346,
        total: window.TU_COSTO_REAL.TOTAL || 0.576
      } : {
        combustible: 0.182,
        mantenimiento: 0.020,
        comida: 0.028,
        costosFijos: 0.346,
        total: 0.576
      },
      stateNotes // 🔹 NUEVO: notas por estado para Lex
    };

    await firebase.firestore()
      .collection('lexProfiles')
      .doc(uid)
      .set(profile);

    debugLog('[LEX] Perfil de Lex inicializado');
    return profile;

  } catch (error) {
    console.error('❌ Error inicializando perfil:', error);
    throw error;
  }
}

async function refreshLexStateNotes() {
  if (!window.currentUser) {
    throw new Error('Usuario no autenticado');
  }

  const uid = window.currentUser.uid;
  const db = firebase.firestore();
  const profileRef = db.collection('lexProfiles').doc(uid);

  const stateNotes = await buildStateNotesFromNotesCollection(uid);

  await profileRef.set(
    {
      stateNotes,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  debugLog('[LEX] stateNotes actualizados desde colección notes:', stateNotes);
}

window.refreshLexStateNotes = refreshLexStateNotes;


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
      debugLog('[LEX] Perfil no existe, inicializando...');
      await initializeLexProfile();
      return;
    }

    const profile = await getLexProfile();

    // Extraer datos limpios
    const rpm = Number(loadData.rpm || loadData.actualRPM || 0);
    const totalCharge = Number(loadData.totalCharge || loadData.baseIncome || 0);
    const totalMiles = Number(loadData.totalMiles || 0);
    const netProfit = Number(loadData.netProfit || 0);
    const deadheadMiles = Number(loadData.deadheadMiles || loadData.deadhead || 0);
    const operatingCost = Number(loadData.operatingCost || loadData.totalExpenses || 0);
    const destState = extractStateFromDestination(loadData.destinationState || loadData.destination) || '';

    if (!rpm || !totalMiles || !destState) return;

    const newTotalLoads = profile.totalLoads + 1;
    const newTotalMiles = profile.totalMiles + totalMiles;
    const newTotalRevenue = profile.totalRevenue + totalCharge;
    const newTotalProfit = profile.totalProfit + netProfit;
    const newTotalExpenses = profile.totalExpenses + operatingCost;

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

    debugLog('[LEX] Perfil de Lex actualizado');

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
      debugLog('[LEX] Perfil no existe, inicializando...');
      return await initializeLexProfile();
    }

    const profileData = profileDoc.data();
    if (profileData.version !== '1.1') {
      debugLog('[LEX] Versión antigua de perfil detectada. Actualizando a 1.1...');
      return await initializeLexProfile();
    }

    return profileData;

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
    const destState = extractStateFromDestination(loadData.destinationState || loadData.destination) || '';
    const totalMiles = Number(loadData.totalMiles || 0);

    // Comparar con promedio real del usuario
    const vsYourAvg = ((rpm - profile.avgRPM) / profile.avgRPM * 100);

    // Comparar con historia en ese estado
    const stateStats = destState ? profile.stateStats[destState] : null;
    const vsStateAvg = stateStats ?
      ((rpm - stateStats.avgRPM) / stateStats.avgRPM * 100) : null;

    // Decisión inteligente con textos mejorados
    let recommendation = '';
    let reasons = [];
    let color = 'yellow';

    // ⚠️ Alerta de carga corta
    const shortLoadAlert = (() => {
      const miles = totalMiles || 0;
      if (miles > 0 && miles < 100) {
        const total = rpm * miles;
        if (total < 150) {
          return `⚠️ Carga corta (${miles} mi) — Rutas bajo 100 millas necesitan mínimo $150 flat. Esta carga paga $${total.toFixed(0)} — no cubre el tiempo invertido.`;
        }
      } else if (miles >= 100 && miles < 150) {
        if (rpm < 2.50) {
          return `⚠️ Carga corta (${miles} mi) — Para rutas de 100–150 millas necesitas mínimo $2.50/mi. Esta carga paga $${rpm.toFixed(2)}/mi — considera negociar.`;
        }
      } else if (miles >= 150 && miles <= 200) {
        if (rpm < 2.00) {
          return `⚠️ Carga corta (${miles} mi) — Para rutas de 150–200 millas necesitas mínimo $2.00/mi. Esta carga paga $${rpm.toFixed(2)}/mi — evalúa si vale el tiempo.`;
        }
      }
      return null;
    })();
    if (shortLoadAlert) reasons.unshift(shortLoadAlert);

    if (rpm < profile.minSafeRPM) {
      recommendation = 'RECHAZA ❌';
      color = 'red';
      reasons.push(`Peligro financiero: El RPM de $${rpm.toFixed(2)} está $${(profile.minSafeRPM - rpm).toFixed(2)} por debajo de tu línea de supervivencia operativa ($${profile.minSafeRPM.toFixed(2)}/mi). Aceptar esto significa pagar por trabajar.`);
    } else if (rpm >= profile.avgRPM * 1.1) {
      recommendation = 'ACEPTA ✅';
      color = 'green';
      reasons.push(`Excelente oportunidad: Esta carga rinde un ${vsYourAvg.toFixed(1)}% mejor que tu promedio histórico consolidado de $${profile.avgRPM.toFixed(2)}/mi.`);
    } else if (rpm >= profile.avgRPM) {
      recommendation = 'FACTIBLE 👍';
      color = 'green';
      reasons.push(`Carga sólida: El pago cumple con tu estándar habitual ($${profile.avgRPM.toFixed(2)}/mi). Es una ruta segura para mantener tu margen de ganancia constante.`);
    } else {
      recommendation = 'NEGOCIA ⚠️';
      color = 'yellow';
      reasons.push(`Precaución: El pago está ${Math.abs(vsYourAvg).toFixed(1)}% por debajo de tu promedio. Intenta negociar al menos $${profile.avgRPM.toFixed(2)}/mi para que la ruta valga la vuelta.`);
    }

    // Contexto del estado enriquecido
    if (stateStats) {
      if (stateStats.loads >= 3) {
        if (vsStateAvg > 10) {
          reasons.push(`Buena zona: Históricamente te ha ido muy bien en ${destState}, y esta oferta supera el promedio de tus ${stateStats.loads} cargas anteriores allí.`);
        } else if (vsStateAvg < -10) {
          reasons.push(`Advertencia de zona: Toma en cuenta que el pago ofrecido está por debajo de lo que sueles sacar cuando vas a ${destState} ($${stateStats.avgRPM.toFixed(2)}/mi).`);
        } else {
          reasons.push(`Zona estable: El pago está alineado con la rentabilidad que demostraste en tus últimas ${stateStats.loads} cargas hacia ${destState}.`);
        }
      } else {
        reasons.push(`Zona de exploración: Aún no tengo suficientes datos de tu rentabilidad en ${destState} (solo ${stateStats.loads} cargas previas). Registra el resultado de esta carga para aprender más.`);
      }
    } else {
      reasons.push(`Territorio nuevo: Nunca has registrado una carga que termine en ${destState}. Asegúrate de revisar las métricas de retorno antes de saltar a esta nueva zona.`);
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

// ====================================================================
// ANALIZAR CARGA ACTUAL (Desde Calculadora)
// ====================================================================
window.analyzeLexLoad = async function () {
  const originStr = document.getElementById('origin')?.value || '';
  const destStr = document.getElementById('destination')?.value || '';

  // Helper to parse strings like "$2.50" or "1,200" into valid numbers
  const parseNum = (str) => Number((str || '').toString().replace(/[^0-9.-]+/g, "")) || 0;

  // Attempt to read from the calculated results display, fallback to inputs
  const calculatedMiles = parseNum(document.getElementById('tripMiles')?.textContent);
  const inputMiles = parseNum(document.getElementById('loadedMiles')?.value) + parseNum(document.getElementById('deadheadMiles')?.value);
  const totalMiles = calculatedMiles > 0 ? calculatedMiles : inputMiles;

  const rpm = parseNum(document.getElementById('actualRPM')?.textContent) || parseNum(document.getElementById('rpm')?.value);
  const totalCharge = parseNum(document.getElementById('totalCharge')?.textContent);

  if (!destStr || totalMiles <= 0 || rpm <= 0) {
    alert("Calcula primero una ruta válida (Origen, Destino, Millas y RPM) para que Lex pueda analizarla.");
    return;
  }

  // Prepara los datos para Lex
  const loadData = {
    origin: originStr,
    destination: destStr,
    destinationState: extractStateFromDestination(destStr) || destStr.split(',')[1]?.trim() || '',
    totalMiles: totalMiles,
    rpm: rpm,
    totalCharge: totalCharge
  };

  try {
    const analysis = await analyzeLoadWithLearning(loadData);

    // Mostramos feedback en el avatar
    if (window.setLexState) {
      window.setLexState(analysis.color === 'green' ? 'happy' : (analysis.color === 'red' ? 'sad' : 'warning'), {
        message: analysis.recommendation + " - " + analysis.reasons[0],
        duration: 5000
      });
    }

    // Integración de resultados
    if (window.lexAI && typeof window.lexAI.showLexInsightInPanel === 'function') {
      window.lexAI.showLexInsightInPanel(analysis);
    } else if (window.lexAI && typeof window.lexAI.showLexAnalysisModal === 'function') {
      window.lexAI.showLexAnalysisModal(analysis);
    } else {
      // Fallback
      alert(`🧠 LEX AI Análisis:\n\nRecomendación: ${analysis.recommendation}\nRPM: $${analysis.rpm.toFixed(2)} (Tu promedio: $${analysis.yourAvgRPM.toFixed(2)})\n\nMotivos:\n- ${analysis.reasons.join('\n- ')}\n\nExperiencia en esta zona: ${analysis.stateExperience}`);
    }

  } catch (e) {
    console.error("Error al analizar con Lex:", e);
    alert("Hubo un problema al conectar con Lex AI");
  }
};

// ====================================================================
// 5. MÉTODOS DE ANÁLISIS EXPORTADOS A LA UI
// ====================================================================

window.lexAI = window.lexAI || {};

window.lexAI.analyzeHistoryLoads = async function (loadsInput) {
  try {
    const loads = Array.isArray(loadsInput) ? loadsInput : [];
    if (loads.length === 0) {
      alert('No hay cargas en el rango seleccionado para analizar con Lex.');
      return null;
    }

    let totalMiles = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let profitableLoads = 0;
    let unprofitableLoads = 0;

    const stateStats = {};
    const rpms = [];

    // Fallback global cpm default si no existe en currentUser
    const defaultCPM = window.TU_COSTO_REAL?.TOTAL || 0.55;

    loads.forEach((load) => {
      const miles = (load.totalMiles || 0) + (load.deadheadMiles || 0);
      const revenue = load.rate || load.total || 0;
      const cost = load.estimatedCost || (miles * defaultCPM);
      const profit = load.netProfit || revenue - cost || 0;
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

      const state = load.destinationState || extractStateFromDestination(load.destination || '');
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

    const avgRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const avgProfit = loads.length > 0 ? totalProfit / loads.length : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

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

    // Análisis de RPM
    if (avgRPM < 0.85) {
      alerts.push(`Tu RPM promedio está bajo: $${avgRPM.toFixed(2)}/mi`);
      recommendations.push('Considera negociar mejores tarifas o enfocarte en rutas más rentables');
    } else if (avgRPM >= 1.0) {
      insights.push(`Excelente RPM promedio: $${avgRPM.toFixed(2)}/mi`);
    }

    // Porcentaje de cargas rentables
    const profitRate = loads.length > 0 ? (profitableLoads / loads.length) * 100 : 0;

    if (profitRate < 70) {
      alerts.push(`Solo ${Math.round(profitRate)}% de tus cargas son rentables`);
      recommendations.push('Revisa tus costos operativos y estrategia de selección de cargas');
    } else {
      insights.push(`${Math.round(profitRate)}% de tus cargas son rentables`);
    }

    // Margen
    if (profitMargin < 15) {
      alerts.push(`Margen de ganancia bajo: ${profitMargin.toFixed(1)}%`);
    } else if (profitMargin >= 20) {
      insights.push(`Excelente margen de ganancia: ${profitMargin.toFixed(1)}%`);
    }

    // Recomendaciones por zonas
    if (topStates.length > 0) {
      insights.push(`Tus mejores estados: ${topStates.slice(0, 3).map((s) => `${s.state} ($${s.avgRPM.toFixed(2)}/mi)`).join(', ')}`);
    }

    if (worstStates.length > 0) {
      alerts.push(`Evita estas zonas: ${worstStates.map((s) => `${s.state} ($${s.avgRPM.toFixed(2)}/mi)`).join(', ')}`);
    }

    let lexState = 'happy';
    if (alerts.length > 2) {
      lexState = 'sad';
    } else if (alerts.length > 0) {
      lexState = 'warning';
    }

    const payload = {
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
    };

    if (window.lexAI.showHistoryAnalysisModal) {
      window.lexAI.showHistoryAnalysisModal(payload);
    }

    if (window.setLexState) {
      const message = alerts.length > 0
        ? `Encontré ${alerts.length} áreas de mejora en tu historial`
        : `¡Tu historial se ve bien! ${insights.length} puntos positivos`;
      window.setLexState(lexState, { message, duration: 5000 });
    }

    return { loads: loads.length, avgRPM, avgProfit, profitMargin };
  } catch (err) {
    console.error('[LEX] Error analizando historial:', err);
    if (window.setLexState) {
      window.setLexState('sad', { message: 'Tuve un problema al analizar el historial', duration: 4000 });
    }
    return null;
  }
};

window.lexAI.analyzeFinanceLoads = async function (financeData) {
  try {
    const payload = {
      periodLabel: financeData.periodLabel || 'Resumen',
      totalRevenue: financeData.totalRevenue || 0,
      totalExpenses: financeData.totalExpenses || 0,
      netProfit: financeData.netProfit || 0,
      margin: financeData.margin || 0,
      totalMiles: financeData.totalMiles || 0,
      avgRpm: financeData.totalMiles > 0 ? (financeData.totalRevenue || 0) / financeData.totalMiles : 0,
      numLoads: financeData.numLoads || 0,
      numExpenses: financeData.numExpenses || 0,
      avgRevenuePerLoad: financeData.numLoads > 0 ? (financeData.totalRevenue || 0) / financeData.numLoads : 0,
      avgExpensePerLoad: financeData.numLoads > 0 ? (financeData.totalExpenses || 0) / financeData.numLoads : 0,
      insights: financeData.insights || [],
      alerts: financeData.alerts || [],
      summary: financeData.summary || ''
    };

    if (window.lexAI.showFinanceAnalysisModal) {
      window.lexAI.showFinanceAnalysisModal(payload);
    }
  } catch (err) {
    console.error('[LEX] Error con modal financiero:', err);
  }
};

debugLog('[LEX] Lex Learning System cargado');
