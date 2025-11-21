//  CALCULATOR.JS - VERSIN INTEGRADA COMPLETA
// Combina: Costos reales + Todas las funcionalidades existentes

//  TUS COSTOS OPERATIVOS REALES - Actualizado Nov 2024
// Basado en analisis de datos reales de Firebase (Jun-Sep 2024)
// Promedio real: 8,587 millas/mes en meses completos normales
const TU_COSTO_REAL = {
  combustible: 0.182,      // Real de gastos: $1,346/mes / 8,587 mi/mes
  mantenimiento: 0.020,    // Aceite ($100/10k mi) + bateria + liquidos
  comida: 0.028,           // Real: $181/mes / 8,587 mi/mes
  costosFijos: 0.346,      // $2,967/mes / 8,587 mi/mes (seguro+pago+otros)
  TOTAL: 0.576            // $/mi total REAL (reserva gomas sale de ganancias)
};

// ======== DECISIÓN 2025 (realista) ========
let DECISION_MODE = (typeof window !== 'undefined' && window.DECISION_MODE) || 'realista2025';

const COSTO_BASE_MI = 0.55;
const FLOOR_ESCAPE   = 0.55;
const FLOOR_ACCEPT   = 0.75;

const ZONAS_VERDES = new Set(['PA','OH','IN','IL','MI','WI','MO','KS','KY']);
const ZONAS_AMAR   = new Set(['WV','TN','AR','AL','OK','IA','MN']);
const ZONAS_ROJAS  = new Set(['FL','GA','SC','NC','TX','AZ','NM','CO','CA','WA','OR','ID','WY','MT','ND','SD','UT','NV']);

function getDecisionMode() {
  return (typeof window !== 'undefined' && window.DECISION_MODE) || DECISION_MODE || 'realista2025';
}


//  FUNCIN: Calcular tiempo de viaje real
function calcularTiempoReal(millas) {
  const paradasCombustible = Math.floor(millas / 300); // Cada 300mi como haces t
  const tiempoManejo = millas / 75; // 75 mph promedio autopista (95% de tu tiempo)
  const tiempoParadas = paradasCombustible * 0.5; // 30 min por parada
  const tiempoTotal = tiempoManejo + tiempoParadas;
  
  return {
    paradas: paradasCombustible,
    horasTotal: tiempoTotal,
    formato: `${Math.floor(tiempoTotal)}h ${Math.round((tiempoTotal % 1) * 60)}m`
  };
}

//  FUNCIN: Reglas de decisin inteligentes basadas en tu estrategia real
function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
  // Si eliges modo original desde la UI, respetamos tu lógica anterior si existe
  if (getDecisionMode() !== 'realista2025' && typeof getDecisionInteligente_original === 'function') {
    return getDecisionInteligente_original(rpm, millas, factoresAdicionales);
  }

  const {
    zonaOrigen='DESCONOCIDA',
    zonaDestino='DESCONOCIDA',
    areaMala=false,
    relocalizaBuena=false,
    tiempoSinCarga=0
  } = factoresAdicionales;

  // Umbrales dinámicos por distancia
  let pisoAceptar = FLOOR_ACCEPT; // 0.75 base
  let pisoEscape  = FLOOR_ESCAPE; // 0.55 base
  // 👉 Si quieres que PA➜OH 0.78 sea ACEPTA, cambia 0.80 → 0.78 en la línea de abajo.
  if (millas <= 400) pisoAceptar = Math.max(pisoAceptar, 0.80);
  if (millas > 800)  pisoAceptar = Math.min(pisoAceptar, 0.72);

  // Si llevas ≥1 día parado, flexibiliza el escape un poco (sin bajar del costo base)
  if (tiempoSinCarga >= 1) pisoEscape = Math.max(COSTO_BASE_MI, pisoEscape - 0.02);

  // 1) Protección dura: por debajo del costo base
  if (rpm < COSTO_BASE_MI - 0.01) {
    return {
      decision: "RECHAZA",
      level: "reject",
      icon: "❌",
      color: "decision-reject",
      razon: `RPM $${rpm.toFixed(2)} < costo $${COSTO_BASE_MI.toFixed(2)}`,
      confianza: "Alta"
    };
  }

  // 2) Aceptar si supera piso
  if (rpm >= pisoAceptar) {
    return {
      decision: "ACEPTA",
      level: "accept",
      icon: "✅",
      color: "decision-accept",
      razon: `RPM $${rpm.toFixed(2)} ≥ ${pisoAceptar.toFixed(2)} · Destino ${zonaDestino}`,
      confianza: "Alta"
    };
  }

  // 3) Rango intermedio: evaluar/escape
  const enRangoEscape = rpm >= pisoEscape && rpm < pisoAceptar;

  if (enRangoEscape) {
    // ROJA → (AMARILLA/VERDE): relocalización
    if (areaMala && relocalizaBuena) {
      return {
        decision: "EVALÚA RELOCALIZACIÓN",
        level: "warning",
        icon: "⚙️",
        color: "decision-warning",
        razon: `Cubre costos y mueve ${zonaOrigen} ➜ ${zonaDestino}`,
        confianza: tiempoSinCarga >= 1 ? "Alta" : "Media-Alta"
      };
    }
    // AMARILLA → VERDE o AMARILLA → AMARILLA (útil)
    if (zonaDestino === 'VERDE' || (zonaOrigen === 'AMARILLA' && zonaDestino === 'AMARILLA')) {
      return {
        decision: "EVALÚA",
        level: "warning",
        icon: "⚠️",
        color: "decision-warning",
        razon: `RPM medio y dirección útil (${zonaOrigen} ➜ ${zonaDestino})`,
        confianza: "Media"
      };
    }
    // ROJA → ROJA (no conviene)
    if (zonaOrigen === 'ROJA' && zonaDestino === 'ROJA') {
      return {
        decision: "RECHAZA",
        level: "reject",
        icon: "❌",
        color: "decision-reject",
        razon: `RPM bajo y te quedas en ROJA`,
        confianza: "Alta"
      };
    }
  }

  // 4) Por defecto: rechazar
  return {
    decision: "RECHAZA",
    level: "reject",
    icon: "❌",
    color: "decision-reject",
    razon: `RPM $${rpm.toFixed(2)} por debajo de umbral y sin beneficio de dirección.`,
    confianza: "Alta"
  };
}


//  FUNCIN: Generar razones detalladas
function obtenerRazonDetallada(nivel, rpm, millas, factores, razonesEspeciales = []) {
  const categoria = millas <= 400 ? "corta" : millas <= 600 ? "media" : "larga";
  const gananciaEstimada = rpm - TU_COSTO_REAL.TOTAL;
  const gananciaTotal = gananciaEstimada * millas;
  
  let razon = `Carga ${categoria} (${millas}mi): `;
  
  if (nivel === "accept") {
    razon += `Excelente RPM $${rpm.toFixed(2)}/mi. Ganancia estimada: $${gananciaTotal.toFixed(0)}`;
  } else if (nivel === "warning") {
    razon += `RPM $${rpm.toFixed(2)}/mi en lmite. Ganancia: $${gananciaTotal.toFixed(0)}`;
    if (razonesEspeciales.length > 0) {
      razon += `. Factores a favor: ${razonesEspeciales.join(", ")}`;
    }
  } else {
    razon += `RPM $${rpm.toFixed(2)}/mi, Muy bajo. Ganancia: $${gananciaTotal.toFixed(0)}`;
    if (gananciaTotal < 50) {
      razon += ". Busca mejor alternativa.";
    }
  }
  
  return razon;
}

//  FUNCIN: Detectar factores especiales automticamente
function detectarFactoresEspeciales(origin, destination, { diasSinCarga = 0 } = {}) {
  const sO = getStateFromPlace(origin || '');
  const sD = getStateFromPlace(destination || '');
  const zonaO = categorizeZone(sO);
  const zonaD = categorizeZone(sD);

  const areaMala = (zonaO === 'ROJA');
  const destinoMejorQueOrigen = (
    (zonaO === 'ROJA'    && (zonaD === 'AMARILLA' || zonaD === 'VERDE')) ||
    (zonaO === 'AMARILLA' &&  zonaD === 'VERDE')
  );

  return {
    areaMala,
    relocalizaBuena: destinoMejorQueOrigen,
    zonaOrigen: zonaO,
    zonaDestino: zonaD,
    tiempoSinCarga: diasSinCarga,
    alternativasLimitadas: false
  };
}


//  FUNCIN PRINCIPAL: Calculate con costos reales
async function calculate() {
  try {
    debugLog(" Calculando con costos reales confirmados...");

    // Obtener valores de los campos
    const origin = document.getElementById('origin')?.value?.trim() || '';
    const destination = document.getElementById('destination')?.value?.trim() || '';
    let loadedMiles = Number(document.getElementById('loadedMiles')?.value || 0);
    let deadheadMiles = Number(document.getElementById('deadheadMiles')?.value || 0);
    let rpm = Number(document.getElementById('rpm')?.value || 0);
    let rate = Number(document.getElementById('rate')?.value || 0);  
    const tolls = Number(document.getElementById('tolls')?.value || 0);
    const others = Number(document.getElementById('otherCosts')?.value || 0);

    //  Definir totalMiles ANTES de validaciones
    const totalMiles = loadedMiles + deadheadMiles;

    //  Condicin mnima antes de mostrar resultados
    if (!origin || !destination || totalMiles <= 0 || (rpm <= 0 && rate <= 0)) {
      hideDecisionPanel(); 
      return;
    }

    //  Validaciones suaves (ya con totalMiles calculado)
    if (!origin || !destination) {
      debugLog(" Faltan origen/destino, no se ejecuta clculo.");
      return;
    }
    if (totalMiles <= 0) {
      debugLog(" Millas invlidas, no se ejecuta clculo.");
      return;
    }

    //  Ajuste de lgica Rate / RPM
    if (rpm > 0 && rate === 0) {
      // Si solo hay RPM  calcular Rate redondeado
     rate = Math.round(rpm * totalMiles);
    } else if (rate > 0 && totalMiles > 0) {
      // Si hay Rate  calcular RPM con 2 decimales
      rpm = Math.round((rate / totalMiles) * 100) / 100;
    }

    // Clculo de ingresos
    const baseIncome = rate;
    const totalCharge = baseIncome + tolls + others;

    //  Usar tus costos reales confirmados
    const fuelCost = totalMiles * TU_COSTO_REAL.combustible;
    const maintenanceCost = totalMiles * (TU_COSTO_REAL.mantenimiento);
    const foodCost = totalMiles * TU_COSTO_REAL.comida;
    const fixedCosts = totalMiles * TU_COSTO_REAL.costosFijos;

    const totalExpenses = fuelCost + maintenanceCost + foodCost + fixedCosts + tolls + others;
    const netProfit = totalCharge - totalExpenses;
    const margin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;
    const profitPerMile = totalMiles > 0 ? netProfit / totalMiles : 0;
    const actualRPM = totalMiles > 0 ? totalCharge / totalMiles : 0;

    // Actualizar UI principal
    updateMainResults({
      origin, destination, totalMiles, baseIncome, totalCharge,
      fuelCost, maintenanceCost, foodCost, fixedCosts, tolls, others,
      totalExpenses, netProfit, margin, profitPerMile, actualRPM, rpm, rate
    });

    //  Mostrar panel de decisin
    showDecisionPanel({
      totalCharge,
      netProfit,
      profitMargin: margin,
      profitPerMile,
      totalMiles,
      actualRPM,
      origin,
      destination
    });

    // Actualizar mapa
    updateMap();

    debugLog(" Clculo completado con costos reales");
  } catch (error) {
    console.error(' Error en clculo:', error);
    showError(error.message);
  }
}

//  Mantener sincrona entre Rate y RPM + disparar clculo completo CON DELAY
let calculateTimeout;
let listenersAdded = false; // Evitar duplicar event listeners

function syncRateAndRpm() {
  const loadedMilesEl = document.getElementById('loadedMiles');
  const deadheadMilesEl = document.getElementById('deadheadMiles');
  const rpmEl = document.getElementById('rpm');
  const rateEl = document.getElementById('rate');
  const tripMilesEl = document.getElementById('tripMiles');

  if (!rpmEl || !rateEl || !loadedMilesEl) return;

  // Funcin para calcular con delay (debounce) - espera que el usuario termine de escribir
  function triggerCalculate() {
    clearTimeout(calculateTimeout);
    calculateTimeout = setTimeout(() => {
      calculate();
    }, 800); // Espera 800ms despus de que dejes de escribir
  }

  // Funcin para actualizar millas totales en pantalla
  function updateTotalMiles() {
    const loadedMiles = Number(loadedMilesEl?.value || 0);
    const deadheadMiles = Number(deadheadMilesEl?.value || 0);
    const totalMiles = loadedMiles + deadheadMiles;
    
    if (tripMilesEl) {
      tripMilesEl.textContent = totalMiles.toLocaleString();
    }
    
    return { loadedMiles, totalMiles };
  }

  // Solo agregar listeners UNA VEZ
  if (!listenersAdded) {
    // Cuando cambia RPM  recalcula Rate
    rpmEl.addEventListener("input", () => {
      const { totalMiles } = updateTotalMiles();
      const rpm = parseFloat(rpmEl.value) || 0;
      
      if (totalMiles > 0 && rpm > 0) { 
        rateEl.value = (rpm * totalMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambia Rate  recalcula RPM
    rateEl.addEventListener("input", () => {
      const { totalMiles } = updateTotalMiles();
      const rate = parseFloat(rateEl.value) || 0;
      
      if (totalMiles > 0 && rate > 0) {
        rpmEl.value = (rate / totalMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambian las millas  actualiza Rate/RPM y recalcula
    loadedMilesEl.addEventListener("input", () => {
      const { loadedMiles, totalMiles } = updateTotalMiles();
      
      if (totalMiles > 0) {
        const rpm = parseFloat(rpmEl.value) || 0;
        const rate = parseFloat(rateEl.value) || 0;
        
        // Si hay RPM, actualizar Rate
        if (rpm > 0) {
         rateEl.value = (rpm * totalMiles).toFixed(2);
        }
        // Si hay Rate, actualizar RPM
        else if (rate > 0) {
        rpmEl.value = (rate / totalMiles).toFixed(2);
        }
      }
      triggerCalculate();
    });

    deadheadMilesEl?.addEventListener("input", () => {
      updateTotalMiles();
      triggerCalculate();
    });

    listenersAdded = true;
  }

  // Actualizar millas al iniciar
  updateTotalMiles();
}

//  Inicializar cuando cargue la pgina
document.addEventListener("DOMContentLoaded", () => {
    initializeOnce('calculator-sync-rate-rpm', syncRateAndRpm);
});

//  Exponer globalmente
window.calculate = calculate;

//  FUNCIN: Actualizar resultados principales (mantiene compatibilidad con UI existente)
function updateMainResults(data) {
  const updates = {
    tripMiles: data.totalMiles.toLocaleString(),
    baseIncome: '$' + data.baseIncome.toFixed(2),
    additionalCosts: '$' + (data.tolls + data.others).toFixed(2),
    totalCharge: '$' + data.totalCharge.toFixed(2),
    operatingCost: '$' + (data.totalMiles * (TU_COSTO_REAL.mantenimiento + TU_COSTO_REAL.comida + TU_COSTO_REAL.costosFijos)).toFixed(2),
    fuelCost: '$' + data.fuelCost.toFixed(2),
    maintenanceCost: '$' + data.maintenanceCost.toFixed(2),
    tollsCost: '$' + data.tolls.toFixed(2),
    otherCost: '$' + data.others.toFixed(2),
    totalExpenses: '$' + data.totalExpenses.toFixed(2),
    netProfit: '$' + data.netProfit.toFixed(2),
    profitPerMile: '$' + data.profitPerMile.toFixed(2),
    profitMargin: data.margin.toFixed(1) + '%',
    actualRPM: '$' + data.actualRPM.toFixed(2),
    // Calcular tiempo real
    estimatedTime: calcularTiempoReal(data.totalMiles).formato,
    fuelStops: calcularTiempoReal(data.totalMiles).paradas.toString(),
    tripDays: Math.ceil(calcularTiempoReal(data.totalMiles).horasTotal / 11).toString() // 11h de manejo por da
  };

  Object.entries(updates).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  // Actualizar estado de rentabilidad
  updateProfitabilityStatus(data.margin);
}

//  FUNCIÓN: Panel de decisión mejorado (combina ambas versiones)
function showDecisionPanel(calculationData = {}) {
  const panel = document.getElementById('decisionPanel');
  if (!panel) {
    console.warn("Panel de decisión no encontrado");
    return;
  }

  // Datos con defaults seguros
  const {
    totalCharge = 0,
    netProfit = 0,
    profitMargin = 0,
    profitPerMile = 0,
    totalMiles = 0,
    actualRPM = 0,
    origin = "",
    destination = ""
  } = calculationData;

  // Cálculos corregidos con TUS números reales
  const rpm = actualRPM || (totalMiles > 0 ? totalCharge / totalMiles : 0);
  const tiempo = calcularTiempoReal(totalMiles);

  // ✅ Detectar factores especiales automáticamente
  const factoresEspeciales = detectarFactoresEspeciales(origin, destination);

  // 🏷️ Decisión inteligente
  const decision = getDecisionInteligente(rpm, totalMiles, factoresEspeciales);

  // 🔤 Actualizar DOM con IDs existentes (SOLO TEXTO)
  const elementos = {
    decisionIcon: decision.icon,
    decisionText: decision.decision,
    decisionSubtitle: ` ${totalMiles}mi  RPM $${rpm.toFixed(2)}/mi`,
    // ❌ OJO: NO incluir zoneBadgeHTML aquí (este bucle usa textContent)
    quickPrice: `$${Math.round(totalCharge)}`,
    quickNetProfit: `$${netProfit.toFixed(2)}`,
    quickProfitPerMile: `$${profitPerMile.toFixed(2)}`,
    quickProfitMargin: `${profitMargin.toFixed(1)}%`,
    timeAndStops: ` ${tiempo.formato}   ${tiempo.paradas} parada${tiempo.paradas !== 1 ? 's' : ''}`,
    realRPMInfo: `RPM Real: $${rpm.toFixed(2)}`,
    decisionReason: decision.razon
  };

  Object.entries(elementos).forEach(([id, valor]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor; // texto plano
  });

  // 🏷️ Badge coloreado (HTML): inyectar SIEMPRE con innerHTML y DESPUÉS del bucle
  const zb = document.getElementById('zoneBadgeHTML');
  if (zb) {
    const zonaBadgeHTML = createZoneBadgeHTML(factoresEspeciales);
    zb.innerHTML = zonaBadgeHTML;
  }

  // 🎨 Aplicar color de decisión al contenedor
  const container = document.getElementById('decisionContainer');
  if (container) {
    container.classList.remove('decision-accept', 'decision-warning', 'decision-reject');
    container.classList.add(decision.color);
  }

  // Mostrar panel
  panel.classList.remove('hidden');

  debugLog(`Decisión inteligente: ${decision.decision} - RPM $${rpm.toFixed(2)}/mi - Ganancia $${netProfit.toFixed(0)}`);
}



//  Exponer globalmente (importante para que funcione oninput="...")
window.showDestinationNotes = showDestinationNotes;

// ========================================
//  MANTENER TODAS LAS FUNCIONES EXISTENTES
// ========================================

//  FUNCIN: Copiar precio al portapapeles (MANTENER)
function copyPriceToClipboard() {
    const totalChargeEl = document.getElementById('totalCharge');
    if (!totalChargeEl) {
        console.warn("Elemento totalCharge no encontrado");
        return;
    }
    
    const price = totalChargeEl.textContent;
    
    navigator.clipboard.writeText(price).then(() => {
        // Feedback visual
        const button = event.target;
        const originalText = button.textContent;
        const originalClass = button.className;
        
        button.textContent = ' COPIADO';
        button.className = originalClass + ' copy-feedback';
        
        // Revertir despus de 2 segundos
        setTimeout(() => {
            button.textContent = originalText;
            button.className = originalClass;
        }, 2000);
        
        debugLog(` Precio copiado: ${price}`);
        
        // Opcional: Mostrar notificacin
        if (typeof showMessage === 'function') {
            showMessage(`Precio ${price} copiado al portapapeles`, 'success');
        }
        
    }).catch(err => {
        console.error('Error copiando precio:', err);
        alert(`Precio: ${price}\n(Copiado manualmente)`);
    });
}

//  FUNCIN: Aceptar y guardar automticamente (MANTENER)
function acceptAndSave() {
    if (typeof saveLoad === 'function') {
        saveLoad();
        
        // Feedback visual
        const button = event.target;
        const originalText = button.textContent;
        
        button.textContent = ' GUARDANDO...';
        button.disabled = true;
        
        setTimeout(() => {
            button.textContent = ' GUARDADO';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
        }, 1000);
        
        debugLog(' Carga aceptada y guardada');
    } else {
        console.warn("Funcin saveLoad no disponible");
        alert("Error: No se puede guardar la carga");
    }
}

//  FUNCIN: Ocultar panel de decisin (MANTENER)
function hideDecisionPanel() {
    const panel = document.getElementById('decisionPanel');
    if (panel) {
        panel.classList.add('hidden');
    }
}

//  Funcin para guardar carga (crear o editar)
async function saveLoad(existingLoadId = null) {
  try {
    if (typeof window.db === 'undefined') {
      throw new Error('Base de datos no disponible. Inicia sesin primero.');
    }

    // Obtener datos del formulario
    const origin = document.getElementById('origin')?.value?.trim();
    const destination = document.getElementById('destination')?.value?.trim();
    const loadedMiles = document.getElementById('loadedMiles')?.value;
    const deadheadMiles = document.getElementById('deadheadMiles')?.value;
    const rpm = document.getElementById('rpm')?.value;
    const rate = document.getElementById('rate')?.value || '0';  //  nuevo
    const tolls = document.getElementById('tolls')?.value || '0';
    const others = document.getElementById('otherCosts')?.value || '0';
    const loadNumber = document.getElementById('loadNumber')?.value?.trim() || '';
    // Calcular fecha de pago esperada (viernes de la semana siguiente)
function calculatePaymentDate(loadDate) {
  const date = new Date(loadDate);
  const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sbado
  
  // Si es domingo, mover al lunes siguiente
  if (dayOfWeek === 0) {
    date.setDate(date.getDate() + 1);
  }
  
  // Calcular el viernes de la semana siguiente
  const daysUntilNextFriday = (5 - date.getDay() + 7) % 7 + 7;
  const paymentDate = new Date(date);
  paymentDate.setDate(date.getDate() + daysUntilNextFriday);
  
  return formatDateLocal(paymentDate); // Formato YYYY-MM-DD
}

    // Nuevos campos de pago
    const paymentStatus = 'pending';
    const expectedPaymentDate = calculatePaymentDate(new Date());
    const actualPaymentDate = null;
    const companyName = document.getElementById('companyName')?.value?.trim() || '';
    const notes = document.getElementById('notes')?.value?.trim() || '';

    //  Manejo de fechas
    let loadDate;
    try {
      const dateInputEl = document.getElementById('dateInput');
      const editDateEl  = document.getElementById('editDate');

      if (dateInputEl && dateInputEl.value) {
        loadDate = dateInputEl.value.trim();
      } else if (editDateEl && editDateEl.value) {
        loadDate = editDateEl.value.trim();
      } else if (existingLoadId && typeof existingLoadId === "string") {
        // Solo si el ID es vlido
        const existingDoc = await window.db.collection('loads').doc(existingLoadId).get();
        loadDate = existingDoc.exists ? existingDoc.data().date : getTodayDateString();
      } else {
        loadDate = getTodayDateString();
      }
    } catch (err) {
      console.warn(" No se encontr campo de fecha, usando hoy:", err);
      loadDate = getTodayDateString();
    }

    // Validaciones
if (!origin || !destination) throw new Error('Origen y destino son requeridos');

if (
  loadedMiles === "" || isNaN(loadedMiles) || loadedMiles <= 0 ||
  deadheadMiles === "" || isNaN(deadheadMiles) || deadheadMiles < 0 ||
  rpm === "" || isNaN(rpm) || rpm <= 0
) {
  throw new Error('Millas cargadas, deadhead y RPM son requeridos');
}


    // Clculos
    const totalMiles = Number(loadedMiles) + Number(deadheadMiles);

let baseIncome;
let finalRpm;

//  Si hay rate, calculamos RPM
if (Number(rate) > 0 && totalMiles > 0) {
  baseIncome = Number(rate);
  finalRpm = baseIncome / totalMiles;
} else {
  //  Si no hay rate, usamos RPM
  finalRpm = Number(rpm);
  baseIncome = finalRpm * totalMiles;
}

const additionalCosts = Number(tolls) + Number(others);
const totalCharge = baseIncome + additionalCosts;


    const fuelCost = totalMiles * TU_COSTO_REAL.combustible;
    const operatingCost = totalMiles * (
      TU_COSTO_REAL.mantenimiento +
      TU_COSTO_REAL.reservaGomas +
      TU_COSTO_REAL.comida +
      TU_COSTO_REAL.costosFijos
    );
    const totalExpenses = fuelCost + operatingCost + Number(tolls) + Number(others);
    const netProfit = totalCharge - totalExpenses;
    const profitMargin = totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0;

    // Objeto de carga
    const loadData = {
      loadNumber: loadNumber,
      paymentStatus: paymentStatus,
      expectedPaymentDate: expectedPaymentDate,
      actualPaymentDate: actualPaymentDate,
      companyName,
      origin,
      destination,
      originState: getStateFromLocation(origin),
      destinationState: getStateFromLocation(destination),
      notes,
      userId: window.currentUser?.uid || null,
      loadedMiles: Number(loadedMiles),
      deadheadMiles: Number(deadheadMiles),
      totalMiles,
      rate: Number(rate),
      rpm: finalRpm,
      baseIncome,
      tolls: Number(tolls),
      otherCosts: Number(others),
      additionalCosts,
      totalCharge,
      fuelCost,
      operatingCost,
      totalExpenses,
      netProfit,
      profitPerMile: totalMiles > 0 ? netProfit / totalMiles : 0,
      profitMargin,
      date: loadDate || getTodayDateString(), //  aseguramos siempre fecha
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'completed'
      
    };

    // Guardar en Firebase
    if (existingLoadId && typeof existingLoadId === "string") {
      await window.db.collection('loads').doc(existingLoadId).update(loadData);
      debugLog('✅ Carga actualizada con ID:', existingLoadId);
    } else {
      const doc = await window.db.collection('loads').add(loadData);
      debugLog('✅ Carga guardada con ID:', doc.id);
    }

    // 🧠 NUEVO: Actualizar perfil de Lex con la nueva carga
    if (window.lexAI && window.lexAI.updateProfileWithLoad) {
      try {
        await window.lexAI.updateProfileWithLoad(loadData);
        debugLog('🧠 Lex aprendió de esta carga');
      } catch (error) {
        console.error('⚠️ Error actualizando perfil de Lex:', error);
        // No interrumpir el flujo si falla Lex
      }
    }

    window.showMessage?.('✅ Carga guardada', 'success');

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('loadSaved'));
    }, 500);

  } catch (error) {
    console.error('Error guardando carga:', error);
    window.showMessage?.('Error: ' + error.message, 'error');
  }
}




function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    } else {
        alert(message);
    }
}

function getStateFromLocation(location) {
    if (!location) return '';
    const upper = location.toUpperCase();
    if (upper.includes('FL') || upper.includes('FLORIDA')) return 'FL';
    if (upper.includes('GA') || upper.includes('GEORGIA')) return 'GA';
    if (upper.includes('TX') || upper.includes('TEXAS')) return 'TX';
    if (upper.includes('CA') || upper.includes('CALIFORNIA')) return 'CA';
    if (upper.includes('NY') || upper.includes('NEW YORK')) return 'NY';
    if (upper.includes('PA') || upper.includes('PENNSYLVANIA')) return 'PA';
    return '';
}

//  FUNCIN: Actualizar estado de rentabilidad (MANTENER)
function updateProfitabilityStatus(margin) {
    const statusEl = document.getElementById('profitabilityStatus');
    if (!statusEl) return;
    
    let status, className, warning = '';
    
    if (margin >= 20) {
        status = 'Excelente';
        className = 'text-green-700 bg-green-100';
    } else if (margin >= 10) {
        status = 'Buena';
        className = 'text-blue-700 bg-blue-100';
    } else if (margin >= 0) {
        status = 'Marginal';
        className = 'text-yellow-700 bg-yellow-100';
        warning = ' - Evala destino';
    } else {
        status = 'Prdida';
        className = 'text-red-700 bg-red-100';
        warning = ' - Rechaza';
    }
    
    statusEl.textContent = status + warning;
    statusEl.className = className;
}

function clearForm() {
    debugLog('Limpiando formulario...');
    
    const fields = ['origin', 'destination', 'loadedMiles', 'deadheadMiles', 'rpm', 'tolls', 'otherCosts', 'loadNumber', 'companyName', 'notes'];
    fields.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    const resultIds = ['tripMiles', 'baseIncome', 'additionalCosts', 'totalCharge', 'operatingCost', 'fuelCost', 'maintenanceCost', 'tollsCost', 'otherCost', 'totalExpenses', 'netProfit', 'profitPerMile', 'profitMargin', 'actualRPM', 'tripDays', 'fuelStops', 'estimatedTime', 'profitabilityStatus'];
    resultIds.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.textContent = '--';
    });
    
    const section = document.getElementById('suggestedPriceSection');
    if (section) section.style.display = 'none';
    
    // Limpiar panel de costos reales
    const realCostPanel = document.getElementById('realCostPanel');
    if (realCostPanel) realCostPanel.remove();
    
    debugLog('Formulario limpiado');
    hideDecisionPanel();

    // Ocultar también el cuadro de notas
    hideNotesBox();

    // 🔥 IMPORTANTE: Resetear la bandera de Lex para permitir que vuelva a avisar
    lexNotifiedForCurrentCalc = false;
}



// ========================================
//  FUNCIONES DE GOOGLE MAPS (MANTENER TODAS)
// ========================================

//  Variables globales para Google Maps
let googleMap, directionsService, directionsRenderer;

//  FUNCIN: Actualizar mapa
function updateMap() {
    const origin = document.getElementById('origin')?.value?.trim();
    const destination = document.getElementById('destination')?.value?.trim();
    
    if (!origin || !destination) {
        debugLog(" Cannot update map: missing origin or destination");
        return;
    }
    
    if (googleMap && directionsService && directionsRenderer) {
        showRouteOnMap(origin, destination);
    } else {
        console.warn(" Map not ready, showing fallback");
        showMapFallback(origin, destination);
    }
}

//  FALLBACK para cuando el mapa no est listo
function showMapFallback(origin, destination) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="w-full h-96 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center justify-center">
                <div class="text-center p-6">
                    <h3 class="text-lg font-semibold text-blue-800 mb-2"> Ruta: ${origin}  ${destination}</h3>
                    <p class="text-blue-600 mb-4">Mapa en proceso de carga...</p>
                    <button onclick="openGoogleMapsDirections()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Ver en Google Maps
                    </button>
                </div>
            </div>
        `;
    }
}

//  FUNCIN: Abrir Google Maps (MANTENER)
function openGoogleMapsDirections() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    
    if (origin && destination) {
        const url = 'https://www.google.com/maps/dir/' + encodeURIComponent(origin) + '/' + encodeURIComponent(destination);
        window.open(url, '_blank');
    }
}

//  FUNCIN: Mostrar ruta en mapa
function showRouteOnMap(origin, destination) {
    if (!directionsService || !directionsRenderer) {
        console.warn("Google Maps services not ready");
        return;
    }
    
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidTolls: false,
        avoidHighways: false
    };
    
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            // Calcular distancia automticamente si est disponible
            const route = result.routes[0];
            const distance = route.legs[0].distance.value * 0.000621371; // metros a millas
            
            // Actualizar campo de millas si est vaco
            const loadedMilesEl = document.getElementById('loadedMiles');
            if (loadedMilesEl && !loadedMilesEl.value) {
                loadedMilesEl.value = Math.round(distance);
                updateTotalMiles();
            }
            
            debugLog(` Ruta calculada: ${Math.round(distance)} millas`);
        } else {
            console.error('Error calculando ruta:', status);
            showMapFallback(origin, destination);
        }
    });
}

//  FUNCIN: Calcular distancia automticamente
function calculateDistanceAutomatically() {
    // Intentar obtener de inputs ocultos primero (nuevo sistema)
    let origin = document.getElementById('origin-value')?.value?.trim();
    let destination = document.getElementById('destination-value')?.value?.trim();
    
    // Fallback a inputs normales (sistema legacy)
    if (!origin) origin = document.getElementById('origin')?.value?.trim();
    if (!destination) destination = document.getElementById('destination')?.value?.trim();
    
    if (!origin || !destination) {
        debugLog(" Faltan origin/destination para calcular");
        return;
    }
    
    // Si hay funcin especfica para hidden values, usarla
    if (typeof calculateDistanceFromHidden === 'function' && 
        document.getElementById('origin-value')?.value) {
        calculateDistanceFromHidden(origin, destination);
        return;
    }
    
    // Mtodo estndar
    if (typeof google !== 'undefined' && google.maps && google.maps.DistanceMatrixService) {
        const service = new google.maps.DistanceMatrixService();
        
        service.getDistanceMatrix({
            origins: [origin],
            destinations: [destination],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.IMPERIAL,
            avoidHighways: false,
            avoidTolls: false
        }, (response, status) => {
            if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
                const distance = response.rows[0].elements[0].distance.value * 0.000621371;
                
                const loadedMilesEl = document.getElementById('loadedMiles');
                if (loadedMilesEl && !loadedMilesEl.value) {
                    loadedMilesEl.value = Math.round(distance);
                    updateTotalMiles();
                    debugLog(` Distancia calculada: ${Math.round(distance)} millas`);
                }
            }
        });
    }
}

//  FUNCIN: Actualizar total de millas
function updateTotalMiles() {
    const loadedMiles = Number(document.getElementById('loadedMiles')?.value || 0);
    const deadheadMiles = Number(document.getElementById('deadheadMiles')?.value || 0);
    const total = loadedMiles + deadheadMiles;
    
    const tripMilesEl = document.getElementById('tripMiles');
    if (tripMilesEl) {
        tripMilesEl.textContent = total.toLocaleString();
    }
}

//  FUNCIN: Inicializar Google Maps
function initGoogleMaps() {
    try {
        if (typeof google === 'undefined') {
            console.warn("Google Maps API no cargada");
            return;
        }
        
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.warn("Elemento de mapa no encontrado");
            return;
        }
        
        // Crear mapa centrado en EE.UU.
        googleMap = new google.maps.Map(mapElement, {
            zoom: 5,
            center: { lat: 39.8283, lng: -98.5795 }, // Centro de EE.UU.
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });
        
        // Inicializar servicios de direcciones
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            draggable: false,
            panel: null
        });
        
        directionsRenderer.setMap(googleMap);
        
        debugLog(" Google Maps inicializado correctamente");
        
        // Configurar autocompletado despus de inicializar el mapa
        // Solo si no se ha configurado ya (evitar duplicados)
        if (!window.autocompleteConfigured) {
            window.autocompleteConfigured = true;
            setTimeout(setupGoogleAutocomplete, 1000);
        }
        
    } catch (error) {
        console.error("Error inicializando Google Maps:", error);
    }
}

//  FUNCIN: Entry point oficial para Google Maps callback
function initMap() {
    debugLog(" initMap() llamado por Google Maps API");
    initGoogleMaps();
}

// Exponer initMap globalmente para el callback de Google Maps
window.initMap = initMap;

//  FUNCIN: Configurar autocompletado de Google Places
// NOTA: PlaceAutocompleteElement no se inicializa correctamente (shadow DOM vaco)
// Usando mtodo Autocomplete legacy que funciona perfectamente
async function setupGoogleAutocomplete() {
  try {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn("Google Places API no disponible");
      return;
    }

    debugLog(" Configurando Autocomplete (mtodo legacy)...");
    
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');

    if (!originInput || !destinationInput) {
      console.warn("Inputs de origin/destination no encontrados");
      return;
    }

    // Si son elementos gmp-place-autocomplete, reemplazarlos con inputs normales
    if (originInput.tagName === 'GMP-PLACE-AUTOCOMPLETE') {
      const newOrigin = document.createElement('input');
      newOrigin.type = 'text';
      newOrigin.id = 'origin';
      newOrigin.className = originInput.className;
      newOrigin.placeholder = originInput.getAttribute('placeholder') || 'Origen (ej: Miami, FL)';
      newOrigin.autocomplete = 'off';
      originInput.parentNode.replaceChild(newOrigin, originInput);
      debugLog(" Origin convertido a input normal");
    }

    if (destinationInput.tagName === 'GMP-PLACE-AUTOCOMPLETE') {
      const newDest = document.createElement('input');
      newDest.type = 'text';
      newDest.id = 'destination';
      newDest.className = destinationInput.className;
      newDest.placeholder = destinationInput.getAttribute('placeholder') || 'Destino (ej: Atlanta, GA)';
      newDest.autocomplete = 'off';
      destinationInput.parentNode.replaceChild(newDest, destinationInput);
      debugLog(" Destination convertido a input normal");
    }

    // Ahora configurar con el mtodo legacy
    setupLegacyAutocomplete();
    
  } catch (error) {
    console.error("Error configurando autocompletado:", error);
  }
}

//  FUNCIN FALLBACK: Autocomplete legacy si falla el nuevo
function setupLegacyAutocomplete() {
  try {
    debugLog(" Configurando Autocomplete legacy...");
    
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');

    if (!originInput || !destinationInput) return;

    const originAutocomplete = new google.maps.places.Autocomplete(originInput, {
      types: ['geocode'],
      componentRestrictions: { country: ['us', 'ca'] }
    });

    const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {
      types: ['geocode'],
      componentRestrictions: { country: ['us', 'ca'] }
    });

    function normalizePlace(inputEl, place) {
      if (place && place.address_components) {
        let city = "";
        let state = "";

        place.address_components.forEach(c => {
          if (c.types.includes("locality")) city = c.long_name;
          if (c.types.includes("administrative_area_level_1")) state = c.short_name;
        });

        if (!city) {
          const postal = place.address_components.find(c => c.types.includes("postal_code"));
          if (postal) city = postal.long_name;
        }

        if (city && state) {
          inputEl.value = `${city}, ${state}`;
        }
      }
    }

    originAutocomplete.addListener('place_changed', () => {
      normalizePlace(originInput, originAutocomplete.getPlace());
      setTimeout(() => calculateDistanceAutomatically(), 500);
    });

    destinationAutocomplete.addListener('place_changed', () => {
      normalizePlace(destinationInput, destinationAutocomplete.getPlace());
      
      if (destinationInput.value.trim()) {
        showDestinationNotes(destinationInput.value.trim());
      }
      
      setTimeout(() => calculateDistanceAutomatically(), 500);
    });

    debugLog(" Autocomplete legacy configurado");
  } catch (error) {
    console.error("Error en legacy autocomplete:", error);
  }
}

//  FUNCIN: Calcular distancia usando valores de inputs ocultos
function calculateDistanceFromHidden(origin, destination) {
  if (!origin || !destination) {
    console.warn(" Faltan valores para calcular");
    return;
  }
  
  debugLog(" Calculando distancia:", origin, "", destination);
  
  if (!google.maps.DistanceMatrixService) {
    console.error(" DistanceMatrixService no disponible");
    return;
  }
  
  const service = new google.maps.DistanceMatrixService();
  
  service.getDistanceMatrix({
    origins: [origin],
    destinations: [destination],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
    avoidHighways: false,
    avoidTolls: false
  }, (response, status) => {
    if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
      const distanceMiles = Math.round(response.rows[0].elements[0].distance.value * 0.000621371);
      
      debugLog(` Distancia calculada: ${distanceMiles} millas`);
      
      const loadedMilesEl = document.getElementById('loadedMiles');
      if (loadedMilesEl && !loadedMilesEl.value) {
        loadedMilesEl.value = distanceMiles;
        loadedMilesEl.dispatchEvent(new Event('input', { bubbles: true }));
        
        if (typeof updateTotalMiles === 'function') {
          updateTotalMiles();
        }
        
        debugLog(" Millas actualizadas en el campo");
      }
    } else {
      console.error(" Error calculando distancia:", status);
    }
  });
}



//  FUNCIN: Sincronizar vista de rentabilidad
function syncRentabilityCardSingleView() {
    const rentCard = document.getElementById('rentabilityCard');
    if (rentCard) {
        rentCard.style.display = 'none';
        rentCard.setAttribute('aria-hidden', 'true');
    }
}

// ========================================
//  CONFIGURACIN DE EVENTOS (MANTENER COMPLETA)
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeOnce('calculator-setup-events', function() {
        debugLog(' Calculator integrado cargado - configurando eventos');
    
    setTimeout(function() {
        // Configurar botones principales
        const calculateBtn = document.getElementById('calculateBtn');
        const saveBtn = document.getElementById('saveBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (calculateBtn) {
            calculateBtn.addEventListener('click', calculate);
            debugLog(' Botn calcular configurado con costos reales');
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', saveLoad);
            debugLog(' Botn guardar configurado');
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', clearForm);
            debugLog(' Botn limpiar configurado');
        }
        
        // Configurar auto-clculo de millas totales
        const loadedInput = document.getElementById('loadedMiles');
        const deadheadInput = document.getElementById('deadheadMiles');
        
        if (loadedInput && deadheadInput) {
            [loadedInput, deadheadInput].forEach(input => {
                input.addEventListener('input', updateTotalMiles);
            });
            debugLog(' Auto-clculo de millas totales configurado');
        }
        
        // Configurar validacin en tiempo real
        const requiredFields = ['origin', 'destination', 'loadedMiles', 'deadheadMiles', 'rpm'];
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', function() {
                    if (!this.value.trim()) {
                        this.classList.add('border-red-500');
                    } else {
                        this.classList.remove('border-red-500');
                    }
                });
            }
        });
        
    }, 500);
    
    // NO configurar autocompletado aqu - se hace automticamente cuando Google Maps carga via callback
    
    // Sincronizar vista de rentabilidad
    syncRentabilityCardSingleView();
});
});

// NO inicializar mapa manualmente - Google Maps lo hace via callback a initMap()

//  Autocalculado en todos los campos de la calculadora
// ----------------------------------------------------
function setupAutoCalculation() {
  const fields = [
    "origin", "destination", "loadNumber", "companyName", "notes",
    "loadedMiles", "deadheadMiles", "rpm", "tolls", "otherCosts"
  ];

  const debouncedCalc = debounce(() => {
    if (typeof window.calculate === "function") {
      window.calculate();
    } else {
      console.warn(" calculate() no esta disponible todavia");
    }
  }, 400);

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", debouncedCalc);
      el.addEventListener("change", debouncedCalc);
    }
  });

  debugLog(" Auto clculo configurado en la calculadora");
}

function initAutoCalculation() {
  if (typeof window.calculate === "function") {
    setupAutoCalculation();
  } else {
    debugLog(" Esperando a calculate...");
    setTimeout(initAutoCalculation, 300);
  }
}

document.addEventListener("DOMContentLoaded", () => {
    initializeOnce('calculator-auto-calculation', initAutoCalculation);
});


//  Exponer globalmente
window.showDestinationNotes = showDestinationNotes;

// =============================
//  Funciones para Modal de Notas
// =============================

// Variable global para recordar el destino actual
let currentDestinationKey = "";

//  Normalizar destinos (para usar como key uniforme en Firestore)
function normalizeDestination(value) {
  if (!value) return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/,?\s*(ee\.?\s*uu\.?|usa|united states)/gi, "") // quitar pas
    .replace(/,/g, "")   // quitar comas
    .replace(/\s+/g, " "); // normalizar espacios
}



//  Obtener notas de Firebase para un destino (por key normalizado)
async function getNotesForDestination(normalizedKey) {
  try {
    const snapshot = await firebase.firestore()
      .collection("notes")
      .where("userId", "==", window.currentUser.uid)
      .where("key", "==", normalizedKey)   //  bsqueda exacta con clave uniforme
      .orderBy("createdAt", "desc")
      .get();

    return snapshot;
  } catch (error) {
    console.error(" Error en getNotesForDestination:", error);
    return { empty: true, docs: [] };
  }
}

//  Cuadro amarillo de informacin rpida (solo contador)
async function showDestinationNotes(destination) {
  if (!destination) return;

  const normalized = normalizeDestination(destination);
  debugLog(" showDestinationNotes ejecutado con:", destination, " normalizado:", normalized);

  const snapshot = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", window.currentUser.uid)
    .get();

  const notes = snapshot.docs.filter(doc => {
    const data = doc.data();
    const keyNorm = normalizeDestination(data.key || "");
    const destNorm = normalizeDestination(data.destination || "");
    return keyNorm === normalized || destNorm === normalized;
  });

  debugLog(" Notas filtradas para", normalized, ":", notes.length);

  const box = document.getElementById("previousNoteBox");
  const status = document.getElementById("notesStatusText");

  if (notes.length > 0) {
    status.textContent = ` ${notes.length} nota(s) guardada(s) para este destino`;
    box.classList.remove("hidden");
  } else {
    status.textContent = " No hay notas para este destino.";
    box.classList.remove("hidden");
  }
}


//  Modal de Notas
async function openNotesModal(destination) {
  currentDestinationKey = normalizeDestination(destination);

  const modal = document.getElementById("notesModal");
  const title = document.getElementById("notesModalTitle");
  const list = document.getElementById("notesListModal");

  if (!currentDestinationKey) {
    title.textContent = "Notas";
    list.innerHTML = `<p class="text-gray-500 text-sm"> No se especific un destino.</p>`;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    return;
  }

  //  mostramos el destino original en el ttulo, pero usamos el key para buscar
  title.textContent = `Notas para ${destination}`;
  list.innerHTML = `<p class="text-gray-500 text-sm">Cargando notas...</p>`;
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const snapshot = await getNotesForDestination(currentDestinationKey);

  if (snapshot.empty) {
    list.innerHTML = `<p class="text-gray-500 text-sm">No hay notas registradas an.</p>`;
  } else {
    let html = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      html += `
        <div class="border rounded p-2 flex justify-between items-start">
          <div>
            <p class="text-base text-gray-800">${data.note}</p>
            <p class="text-xs text-gray-500">
              ${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : ""}
            </p>
          </div>
          <div class="flex gap-2">
            <button class="text-blue-600 text-xs" onclick="editNote('${doc.id}', '${data.note}')"></button>
            <button class="text-red-600 text-xs" onclick="deleteNote('${doc.id}')"></button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
  }
}

//  Cerrar modal
function closeNotesModal() {
  const modal = document.getElementById("notesModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

//  Aadir nueva nota
async function addNoteToDestination(key) {
  const textarea = document.getElementById("newNoteModalInput");
  const note = textarea.value.trim();
  if (!note) return alert("La nota no puede estar vaca");

  try {
    const rawDestination = document.getElementById("destination")?.value?.trim() || key;

    await firebase.firestore().collection("notes").add({
      userId: window.currentUser.uid,
      key: normalizeDestination(rawDestination), //  clave uniforme para bsquedas
      destination: rawDestination,               //  lo que ves en el input
      note: note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    textarea.value = "";
    openNotesModal(rawDestination);
    showDestinationNotes(rawDestination);
  } catch (error) {
    console.error(" Error guardando nota:", error);
    alert("Error guardando nota");
  }
}

//  Escuchar cambios en el destino (blur + change)
function handleDestinationChange(e) {
  const dest = e.target.value.trim();
  if (dest && dest.length > 3) {
    debugLog(" Detectado destino vlido:", dest);
    showDestinationNotes(dest);
  } else {
    debugLog(" Destino muy corto, no se buscan notas:", dest);
  }
}

const destInput = document.getElementById("destination");
destInput?.addEventListener("blur", handleDestinationChange);
destInput?.addEventListener("change", handleDestinationChange);

//  Editar nota
async function editNote(noteId, oldText) {
  const nuevoTexto = prompt("Editar nota:", oldText);
  if (!nuevoTexto) return;

  try {
    await firebase.firestore().collection("notes").doc(noteId).update({
      note: nuevoTexto,
      updatedAt: new Date().toISOString()
    });

    openNotesModal(currentDestinationKey);
    showDestinationNotes(document.getElementById("destination")?.value?.trim());
  } catch (error) {
    console.error(" Error editando nota:", error);
  }
}

//  Eliminar nota
async function deleteNote(noteId) {
  if (!confirm("Eliminar esta nota?")) return;

  try {
    await firebase.firestore().collection("notes").doc(noteId).delete();

    openNotesModal(currentDestinationKey);
    showDestinationNotes(document.getElementById("destination")?.value?.trim());
  } catch (error) {
    console.error(" Error eliminando nota:", error);
  }
}

//  Exponer globalmente
window.showDestinationNotes = showDestinationNotes;
window.openNotesModal = openNotesModal;
window.closeNotesModal = closeNotesModal;
window.addNoteToDestination = addNoteToDestination;
window.editNote = editNote;
window.deleteNote = deleteNote;


//  DEBUG: inspeccionar notas en Firestore
async function debugNotas() {
  const uid = window.currentUser?.uid;
  if (!uid) {
    console.warn(" Usuario no autenticado");
    return;
  }

  // 1. Ver todas las notas del usuario
  const allNotes = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .get();

  debugLog(" TOTAL notas encontradas:", allNotes.docs.length);
  allNotes.docs.forEach(doc => debugLog(" Nota:", doc.id, doc.data()));

  // 2. Buscar exactamente por destination
  const snapDest = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .where("destination", "==", "Miami, FL")
    .get();

  debugLog(" Resultado destination='Miami, FL':", snapDest.docs.length);
  snapDest.docs.forEach(doc => debugLog(" Dest:", doc.id, doc.data()));

  // 3. Buscar por key (maysculas)
  const snapKey = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .where("key", "==", "MIAMI, FL")
    .get();

  debugLog(" Resultado key='MIAMI, FL':", snapKey.docs.length);
  snapKey.docs.forEach(doc => debugLog(" Key:", doc.id, doc.data()));
}

let notesTimeout;

//  Ejecuta showDestinationNotes con delay (debounce)
function showDestinationNotesDebounced(value) {
  clearTimeout(notesTimeout);
  notesTimeout = setTimeout(() => {
    showDestinationNotes(value);
  }, 600); // espera 600ms despus de dejar de escribir
}
function getStateFromPlace(placeStr = '') {
  const m = String(placeStr).match(/,\s*([A-Za-z]{2})\b/);
  if (m) return m[1].toUpperCase();
  const tokens = String(placeStr).toUpperCase().split(/[\s,.-]+/);
  for (const t of tokens) { if (t.length === 2) return t; }
  return '';
}
function categorizeZone(state) {
  if (!state) return 'DESCONOCIDA';
  if (ZONAS_VERDES.has(state)) return 'VERDE';
  if (ZONAS_AMAR.has(state))   return 'AMARILLA';
  if (ZONAS_ROJAS.has(state))  return 'ROJA';
  return 'DESCONOCIDA';
}
function createZoneBadgeHTML(fx) {
  function zonaClaseTexto(z) {
    switch (z) {
      case 'VERDE':    return 'zone-text-green';
      case 'AMARILLA': return 'zone-text-yellow';
      case 'ROJA':     return 'zone-text-red';
      default:         return 'zone-text-gray';
    }
  }
  const clsO = zonaClaseTexto(fx.zonaOrigen);
  const clsD = zonaClaseTexto(fx.zonaDestino);

  return `
    <div class="zone-badge px-4 py-2 rounded-xl flex items-center gap-2">
      <span class="zone-label">🏷️ Origen:</span>
      <span class="${clsO} font-semibold">${fx.zonaOrigen}</span>
      <span class="zone-label">• Destino:</span>
      <span class="${clsD} font-semibold">${fx.zonaDestino}</span>
    </div>
  `;
}

// =========================================================
// LEX: Detectar cuando la calculadora está lista (IDs reales)
// =========================================================
let lexNotifiedForCurrentCalc = false;

function calculatorIsReady() {
  const originEl      = document.getElementById('origin');
  const destinationEl = document.getElementById('destination');
  const loadedEl      = document.getElementById('loadedMiles');
  const deadheadEl    = document.getElementById('deadheadMiles');
  const rpmEl         = document.getElementById('rpm');
  const rateEl        = document.getElementById('rate');

  // Si algo no existe, no hacemos nada
  if (!originEl || !destinationEl || !loadedEl || !deadheadEl || !rpmEl || !rateEl) {
    console.warn('[LEX] No encontré uno de los campos de la calculadora');
    return false;
  }

  const origin        = originEl.value.trim();
  const destination   = destinationEl.value.trim();
  const loadedMiles   = Number(loadedEl.value || 0);
  const deadheadMiles = Number(deadheadEl.value || 0);
  const totalMiles    = loadedMiles + deadheadMiles;
  const rpm           = Number(rpmEl.value || 0);
  const rate          = Number(rateEl.value || 0);

  // Tiene que haber origen, destino, millas y (rpm o rate)
  return (
    origin &&
    destination &&
    totalMiles > 0 &&
    (rpm > 0 || rate > 0)
  );
}

function notifyLexCalculatorReady() {
  if (lexNotifiedForCurrentCalc) return; 
  if (typeof window.setLexState !== 'function') return;

  // 1) Detectar estado de destino y zonas aprendidas
  const destinationEl = document.getElementById('destination');
  let destinoTexto = destinationEl ? destinationEl.value.trim() : '';
  let destinoEstado = null;

  if (typeof window.getStateCode === 'function' && destinoTexto) {
    destinoEstado = window.getStateCode(destinoTexto);
  }

  let zonaTipo = 'neutral'; // 'buena' | 'mala' | 'neutral'

  if (destinoEstado && window.lexAI && window.lexAI.userContext) {
    const ctx = window.lexAI.userContext;
    const buenas = ctx.preferredZones || [];
    const malas  = ctx.badZones || [];

    if (malas.includes(destinoEstado)) zonaTipo = 'mala';
    else if (buenas.includes(destinoEstado)) zonaTipo = 'buena';
  }

  lexNotifiedForCurrentCalc = true;

  // 2) Mensajes y tono según la zona
  let mensajeSorpresa = 'Oye Ricardo… esta carga se ve interesante 👀';
  let mensajeAlerta   = '¿Quieres que la revise por ti? Haz clic en mí 🧠✨';

  if (zonaTipo === 'mala' && destinoEstado) {
    mensajeSorpresa = `Hmm… ${destinoEstado} suele ser complicado para salir 😬`;
    mensajeAlerta   = 'Mejor la revisamos bien antes de decir que sí. Haz clic en mí 🧠⚠️';
  } else if (zonaTipo === 'buena' && destinoEstado) {
    mensajeSorpresa = `Oye, ${destinoEstado} suele ser buena zona para ti 🔥`;
    mensajeAlerta   = 'Si quieres, la analizo y vemos si está a la altura de tus números 💰✨';
  }

  // 3) Cara de sorpresa según la zona
  const estadoLexInicial = (zonaTipo === 'mala') ? 'warning' : 'surprise';

  window.setLexState(estadoLexInicial, {
    message: mensajeSorpresa,
    duration: 1800
  });

  // 4) Después de la sorpresa, invitación a analizar + animación
  setTimeout(() => {
    window.setLexState('alert', {
      message: mensajeAlerta,
      duration: 6000
    });

    const shell = document.querySelector('.lex-avatar-shell');
    if (shell) {
      shell.classList.add('lex-attention-pulse');
      setTimeout(() => {
        shell.classList.remove('lex-attention-pulse');
      }, 6000);
    }
  }, 1800);
}

// Detectar cambios en todos los inputs importantes
const calcInputs = [
  'origin',
  'destination',
  'loadedMiles',
  'deadheadMiles',
  'rpm',
  'rate'
];

calcInputs.forEach(id => {
  const input = document.getElementById(id);
  if (!input) {
    console.warn('[LEX] Input no encontrado al registrar listener:', id);
    return;
  }

  input.addEventListener('input', () => {
    if (calculatorIsReady()) {
      notifyLexCalculatorReady();
    }
  });
});


// ========================================
//  EXPOSICIN DE FUNCIONES GLOBALES (MANTENER TODAS)
// ========================================

// Funciones principales
window.calculate = calculate;
window.saveLoad = saveLoad;
window.clearForm = clearForm;

// Funciones de mapas
window.updateMap = updateMap;
window.openGoogleMapsDirections = openGoogleMapsDirections;
window.initGoogleMaps = initGoogleMaps;
window.setupGoogleAutocomplete = setupGoogleAutocomplete;
window.setupLegacyAutocomplete = setupLegacyAutocomplete;
window.calculateDistanceAutomatically = calculateDistanceAutomatically;
window.calculateDistanceFromHidden = calculateDistanceFromHidden;
window.showRouteOnMap = showRouteOnMap;
window.updateTotalMiles = updateTotalMiles;
window.showMapFallback = showMapFallback;

// Funciones del panel de decisin
window.showDecisionPanel = showDecisionPanel;
window.hideDecisionPanel = hideDecisionPanel;
window.copyPriceToClipboard = copyPriceToClipboard;
window.acceptAndSave = acceptAndSave;

// Funciones de costos reales (NUEVAS)
window.TU_COSTO_REAL = TU_COSTO_REAL;
window.calcularTiempoReal = calcularTiempoReal;
window.getDecisionInteligente = getDecisionInteligente;
window.detectarFactoresEspeciales = detectarFactoresEspeciales;

debugLog(' Calculator.js INTEGRADO cargado completamente - Costos reales + Funcionalidad completa');