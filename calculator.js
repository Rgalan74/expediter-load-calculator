// ðŸš€ CALCULATOR.JS - VERSIÃ“N INTEGRADA COMPLETA
// Combina: Costos reales + Todas las funcionalidades existentes

// âœ… TUS COSTOS OPERATIVOS REALES CONFIRMADOS
const TU_COSTO_REAL = {
  combustible: 0.194,      // Real confirmado de tus gastos
  mantenimiento: 0.010,    // Sin gomas (regular)
  comida: 0.021,           // Cocinando en la van (excelente!)
  costosFijos: 0.287,      // Others: tolls + seguro + pago + duchas
  reservaGomas: 0.014,     // $700/50000 millas
  TOTAL: 0.526            // $/mi total real
};

// âœ… FUNCIÃ“N: Calcular tiempo de viaje real
function calcularTiempoReal(millas) {
  const paradasCombustible = Math.floor(millas / 300); // Cada 300mi como haces tÃº
  const tiempoManejo = millas / 75; // 75 mph promedio autopista (95% de tu tiempo)
  const tiempoParadas = paradasCombustible * 0.5; // 30 min por parada
  const tiempoTotal = tiempoManejo + tiempoParadas;
  
  return {
    paradas: paradasCombustible,
    horasTotal: tiempoTotal,
    formato: `${Math.floor(tiempoTotal)}h ${Math.round((tiempoTotal % 1) * 60)}m`
  };
}

// âœ… FUNCIÃ“N: Reglas de decisiÃ³n inteligentes basadas en tu estrategia real
function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
  const {
    tiempoSinCarga = 0,      // dÃ­as sin carga
    areaMala = false,        // Miami, Sur FL, etc.
    relocalizaBuena = false, // Â¿Te saca hacia Ã¡rea buena?
    alternativasLimitadas = false
  } = factoresAdicionales;
  
  // Costos por dÃ­as sin trabajar
  const costoFijoPorDia = 95; // $95/dÃ­a en gastos fijos
  const penalizacionEspera = tiempoSinCarga * costoFijoPorDia;
  
  // âœ… UMBRALES AJUSTADOS AL MERCADO ACTUAL
  let umbralAcepta = 0.85;
  let umbralEvalua = 0.75;
  let umbralRelocalizacion = 0.70;
  
  // Ajustes por tipo de carga (tu experiencia real)
  if (millas <= 400) {
    // Cargas cortas - deben pagar mejor
    umbralAcepta = 1.15;
    umbralEvalua = 1.00;
    umbralRelocalizacion = 0.90;
  } else if (millas > 600) {
    // Cargas largas - mÃ¡s flexibles
    umbralAcepta = 0.80;
    umbralEvalua = 0.70;
    umbralRelocalizacion = 0.65;
  }
  
  // âœ… LÃ“GICA DE DECISIÃ“N INTELIGENTE
  if (rpm >= umbralAcepta) {
    return {
      decision: "ACEPTA",
      level: "accept",
      icon: "âœ…",
      color: "decision-accept",
      razon: obtenerRazonDetallada("accept", rpm, millas, factoresAdicionales),
      confianza: "Alta"
    };
  }
  
  // Evaluar factores especiales para RPM mÃ¡s bajos
  if (rpm >= umbralRelocalizacion) {
    let puntaje = 0;
    let razones = [];
    
    if (tiempoSinCarga >= 1) {
      puntaje += 30;
      razones.push(`${tiempoSinCarga} dÃ­a(s) sin carga = $${(tiempoSinCarga * costoFijoPorDia).toFixed(0)} en gastos fijos`);
    }
    
    if (areaMala) {
      puntaje += 25;
      razones.push("Ãrea mala confirmada (Miami, Sur FL)");
    }
    
    if (relocalizaBuena) {
      puntaje += 30;
      razones.push("Te relocaliza hacia Ã¡rea buena");
    }
    
    if (alternativasLimitadas) {
      puntaje += 15;
      razones.push("Pocas alternativas disponibles");
    }
    
    if (rpm >= umbralEvalua || puntaje >= 40) {
      return {
        decision: puntaje >= 40 ? "EVALÃšA RELOCALIZACIÃ“N" : "EVALÃšA",
        level: "warning",
        icon: "âš ï¸",
        color: "decision-warning",
        razon: obtenerRazonDetallada("warning", rpm, millas, factoresAdicionales, razones),
        confianza: puntaje >= 60 ? "Media-Alta" : "Media",
        puntaje
      };
    }
  }
  
  return {
    decision: "RECHAZA",
    level: "reject", 
    icon: "âŒ",
    color: "decision-reject",
    razon: obtenerRazonDetallada("reject", rpm, millas, factoresAdicionales),
    confianza: "Alta"
  };
}

// âœ… FUNCIÃ“N: Generar razones detalladas
function obtenerRazonDetallada(nivel, rpm, millas, factores, razonesEspeciales = []) {
  const categoria = millas <= 400 ? "corta" : millas <= 600 ? "media" : "larga";
  const gananciaEstimada = rpm - TU_COSTO_REAL.TOTAL;
  const gananciaTotal = gananciaEstimada * millas;
  
  let razon = `Carga ${categoria} (${millas}mi): `;
  
  if (nivel === "accept") {
    razon += `Excelente RPM $${rpm.toFixed(2)}/mi. Ganancia estimada: $${gananciaTotal.toFixed(0)}`;
  } else if (nivel === "warning") {
    razon += `RPM $${rpm.toFixed(2)}/mi en lÃ­mite. Ganancia: $${gananciaTotal.toFixed(0)}`;
    if (razonesEspeciales.length > 0) {
      razon += `. Factores a favor: ${razonesEspeciales.join(", ")}`;
    }
  } else {
    razon += `RPM $${rpm.toFixed(2)}/mi muy bajo. Ganancia: $${gananciaTotal.toFixed(0)}`;
    if (gananciaTotal < 50) {
      razon += ". Busca mejor alternativa.";
    }
  }
  
  return razon;
}

// âœ… FUNCIÃ“N: Detectar factores especiales automÃ¡ticamente
function detectarFactoresEspeciales(origin, destination) {
  const areasMalas = ['miami', 'south florida', 'key west', 'fort myers'];
  const areasBuilenas = ['georgia', 'atlanta', 'texas', 'dallas', 'houston', 'charlotte'];
  
  const origenMalo = areasMalas.some(area => 
    origin.toLowerCase().includes(area) || 
    origin.toLowerCase().includes(area.split(' ')[0])
  );
  
  const destinoBueno = areasBuilenas.some(area => 
    destination.toLowerCase().includes(area) ||
    destination.toLowerCase().includes(area.split(' ')[0])
  );
  
  return {
    areaMala: origenMalo,
    relocalizaBuena: origenMalo && destinoBueno,
    // tiempoSinCarga y alternativasLimitadas requerirÃ­an input del usuario
    tiempoSinCarga: 0,
    alternativasLimitadas: false
  };
}

// âœ… FUNCIÃ“N PRINCIPAL: Calculate con costos reales
async function calculate() {
  try {
    console.log("ðŸš€ Calculando con costos reales confirmados...");

    // Obtener valores de los campos
    const origin = document.getElementById('origin')?.value?.trim() || '';
    const destination = document.getElementById('destination')?.value?.trim() || '';
    let loadedMiles = Number(document.getElementById('loadedMiles')?.value || 0);
    let deadheadMiles = Number(document.getElementById('deadheadMiles')?.value || 0);
    let rpm = Number(document.getElementById('rpm')?.value || 0);
    let rate = Number(document.getElementById('rate')?.value || 0);  
    const tolls = Number(document.getElementById('tolls')?.value || 0);
    const others = Number(document.getElementById('otherCosts')?.value || 0);

    // âœ… Definir totalMiles ANTES de validaciones
    const totalMiles = loadedMiles + deadheadMiles;

    // ðŸ‘‰ CondiciÃ³n mÃ­nima antes de mostrar resultados
    if (!origin || !destination || totalMiles <= 0 || (rpm <= 0 && rate <= 0)) {
      hideDecisionPanel(); 
      return;
    }

    // âœ… Validaciones suaves (ya con totalMiles calculado)
    if (!origin || !destination) {
      console.log("âš ï¸ Faltan origen/destino, no se ejecuta cÃ¡lculo.");
      return;
    }
    if (totalMiles <= 0) {
      console.log("âš ï¸ Millas invÃ¡lidas, no se ejecuta cÃ¡lculo.");
      return;
    }

    // âœ… Ajuste de lÃ³gica Rate / RPM
    if (rpm > 0 && rate === 0) {
      // Si solo hay RPM â†’ calcular Rate redondeado
      rate = Math.round(rpm * loadedMiles);
    } else if (rate > 0 && loadedMiles > 0) {
      // Si hay Rate â†’ calcular RPM con 2 decimales
      rpm = Math.round((rate / loadedMiles) * 100) / 100;
    }

    // CÃ¡lculo de ingresos
    const baseIncome = rate;
    const totalCharge = baseIncome + tolls + others;

    // âœ… Usar tus costos reales confirmados
    const fuelCost = totalMiles * TU_COSTO_REAL.combustible;
    const maintenanceCost = totalMiles * (TU_COSTO_REAL.mantenimiento + TU_COSTO_REAL.reservaGomas);
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

    // âœ… Mostrar panel de decisiÃ³n
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

    console.log("âœ… CÃ¡lculo completado con costos reales");
  } catch (error) {
    console.error('âŒ Error en cÃ¡lculo:', error);
    showError(error.message);
  }
}

// âœ… Mantener sincronÃ­a entre Rate y RPM + disparar cÃ¡lculo completo CON DELAY
let calculateTimeout;
let listenersAdded = false; // Evitar duplicar event listeners

function syncRateAndRpm() {
  const loadedMilesEl = document.getElementById('loadedMiles');
  const deadheadMilesEl = document.getElementById('deadheadMiles');
  const rpmEl = document.getElementById('rpm');
  const rateEl = document.getElementById('rate');
  const tripMilesEl = document.getElementById('tripMiles');

  if (!rpmEl || !rateEl || !loadedMilesEl) return;

  // FunciÃ³n para calcular con delay (debounce) - espera que el usuario termine de escribir
  function triggerCalculate() {
    clearTimeout(calculateTimeout);
    calculateTimeout = setTimeout(() => {
      calculate();
    }, 800); // Espera 800ms despuÃ©s de que dejes de escribir
  }

  // FunciÃ³n para actualizar millas totales en pantalla
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
    // Cuando cambia RPM â†’ recalcula Rate
    rpmEl.addEventListener("input", () => {
      const { loadedMiles } = updateTotalMiles();
      const rpm = parseFloat(rpmEl.value) || 0;
      
      if (loadedMiles > 0 && rpm > 0) {
        rateEl.value = (rpm * loadedMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambia Rate â†’ recalcula RPM
    rateEl.addEventListener("input", () => {
      const { loadedMiles } = updateTotalMiles();
      const rate = parseFloat(rateEl.value) || 0;
      
      if (loadedMiles > 0 && rate > 0) {
        rpmEl.value = (rate / loadedMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambian las millas â†’ actualiza Rate/RPM y recalcula
    loadedMilesEl.addEventListener("input", () => {
      const { loadedMiles } = updateTotalMiles();
      
      if (loadedMiles > 0) {
        const rpm = parseFloat(rpmEl.value) || 0;
        const rate = parseFloat(rateEl.value) || 0;
        
        // Si hay RPM, actualizar Rate
        if (rpm > 0) {
          rateEl.value = (rpm * loadedMiles).toFixed(2);
        }
        // Si hay Rate, actualizar RPM
        else if (rate > 0) {
          rpmEl.value = (rate / loadedMiles).toFixed(2);
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

// âœ… Inicializar cuando cargue la pÃ¡gina
document.addEventListener("DOMContentLoaded", syncRateAndRpm);

// âœ… Exponer globalmente
window.calculate = calculate;

// âœ… FUNCIÃ“N: Actualizar resultados principales (mantiene compatibilidad con UI existente)
function updateMainResults(data) {
  const updates = {
    tripMiles: data.totalMiles.toLocaleString(),
    baseIncome: '$' + data.baseIncome.toFixed(2),
    additionalCosts: '$' + (data.tolls + data.others).toFixed(2),
    totalCharge: '$' + data.totalCharge.toFixed(2),
    operatingCost: '$' + (data.totalMiles * (TU_COSTO_REAL.mantenimiento + TU_COSTO_REAL.reservaGomas + TU_COSTO_REAL.comida + TU_COSTO_REAL.costosFijos)).toFixed(2),
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
    tripDays: Math.ceil(calcularTiempoReal(data.totalMiles).horasTotal / 11).toString() // 11h de manejo por dÃ­a
  };

  Object.entries(updates).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  // Actualizar estado de rentabilidad
  updateProfitabilityStatus(data.margin);
}

// âœ… FUNCIÃ“N: Panel de decisiÃ³n mejorado (combina ambas versiones)
function showDecisionPanel(calculationData = {}) {
  const panel = document.getElementById('decisionPanel');
  if (!panel) {
    console.warn("Panel de decisiÃ³n no encontrado");
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

  // âœ… CÃ¡lculos corregidos con TUS nÃºmeros reales
  const rpm = actualRPM || (totalMiles > 0 ? totalCharge / totalMiles : 0);
  const tiempo = calcularTiempoReal(totalMiles);

  // âœ… Detectar factores especiales automÃ¡ticamente
  const factoresEspeciales = detectarFactoresEspeciales(origin, destination);

  // âœ… DecisiÃ³n inteligente
  const decision = getDecisionInteligente(rpm, totalMiles, factoresEspeciales);

  // âœ… Actualizar DOM con IDs existentes
  const elementos = {
    decisionIcon: decision.icon,
    decisionText: decision.decision,
    decisionSubtitle: `ðŸŽ¯ ${totalMiles}mi â€¢ RPM $${rpm.toFixed(2)}/mi`,
    quickPrice: `$${Math.round(totalCharge)}`,
    quickNetProfit: `$${netProfit.toFixed(2)}`,
    quickProfitPerMile: `$${profitPerMile.toFixed(2)}`,
    quickProfitMargin: `${profitMargin.toFixed(1)}%`,
    timeAndStops: `â° ${tiempo.formato} â€¢ â›½ ${tiempo.paradas} parada${tiempo.paradas !== 1 ? 's' : ''}`,
    realRPMInfo: `RPM Real: $${rpm.toFixed(2)}`,
    decisionReason: decision.razon
  };

  // Actualizar elementos del DOM
  Object.entries(elementos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.textContent = valor;
    }
  });

  // Aplicar color de decisiÃ³n
  const container = document.getElementById('decisionContainer');
  if (container) {
    container.classList.remove('decision-accept', 'decision-warning', 'decision-reject');
    container.classList.add(decision.color);
  }

  // Mostrar panel
  panel.classList.remove('hidden');

  console.log(`ðŸŽ¯ DecisiÃ³n inteligente: ${decision.decision} - RPM $${rpm.toFixed(2)}/mi - Ganancia $${netProfit.toFixed(0)}`);
}


// âœ… Exponer globalmente (importante para que funcione oninput="...")
window.showDestinationNotes = showDestinationNotes;

// ========================================
// âœ… MANTENER TODAS LAS FUNCIONES EXISTENTES
// ========================================

// âœ… FUNCIÃ“N: Copiar precio al portapapeles (MANTENER)
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
        
        button.textContent = 'âœ… COPIADO';
        button.className = originalClass + ' copy-feedback';
        
        // Revertir despuÃ©s de 2 segundos
        setTimeout(() => {
            button.textContent = originalText;
            button.className = originalClass;
        }, 2000);
        
        console.log(`ðŸ’° Precio copiado: ${price}`);
        
        // Opcional: Mostrar notificaciÃ³n
        if (typeof showMessage === 'function') {
            showMessage(`Precio ${price} copiado al portapapeles`, 'success');
        }
        
    }).catch(err => {
        console.error('Error copiando precio:', err);
        alert(`Precio: ${price}\n(Copiado manualmente)`);
    });
}

// âœ… FUNCIÃ“N: Aceptar y guardar automÃ¡ticamente (MANTENER)
function acceptAndSave() {
    if (typeof saveLoad === 'function') {
        saveLoad();
        
        // Feedback visual
        const button = event.target;
        const originalText = button.textContent;
        
        button.textContent = 'âœ… GUARDANDO...';
        button.disabled = true;
        
        setTimeout(() => {
            button.textContent = 'âœ… GUARDADO';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
        }, 1000);
        
        console.log('ðŸ’¾ Carga aceptada y guardada');
    } else {
        console.warn("FunciÃ³n saveLoad no disponible");
        alert("Error: No se puede guardar la carga");
    }
}

// âœ… FUNCIÃ“N: Ocultar panel de decisiÃ³n (MANTENER)
function hideDecisionPanel() {
    const panel = document.getElementById('decisionPanel');
    if (panel) {
        panel.classList.add('hidden');
    }
}

// âœ… FunciÃ³n para guardar carga (crear o editar)
async function saveLoad(existingLoadId = null) {
  try {
    if (typeof window.db === 'undefined') {
      throw new Error('Base de datos no disponible. Inicia sesiÃ³n primero.');
    }

    // Obtener datos del formulario
    const origin = document.getElementById('origin')?.value?.trim();
    const destination = document.getElementById('destination')?.value?.trim();
    const loadedMiles = document.getElementById('loadedMiles')?.value;
    const deadheadMiles = document.getElementById('deadheadMiles')?.value;
    const rpm = document.getElementById('rpm')?.value;
    const rate = document.getElementById('rate')?.value || '0';  // ðŸ‘ˆ nuevo
    const tolls = document.getElementById('tolls')?.value || '0';
    const others = document.getElementById('otherCosts')?.value || '0';
    const loadNumber = document.getElementById('loadNumber')?.value?.trim() || '';
    // Calcular fecha de pago esperada (viernes de la semana siguiente)
function calculatePaymentDate(loadDate) {
  const date = new Date(loadDate);
  const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=SÃ¡bado
  
  // Si es domingo, mover al lunes siguiente
  if (dayOfWeek === 0) {
    date.setDate(date.getDate() + 1);
  }
  
  // Calcular el viernes de la semana siguiente
  const daysUntilNextFriday = (5 - date.getDay() + 7) % 7 + 7;
  const paymentDate = new Date(date);
  paymentDate.setDate(date.getDate() + daysUntilNextFriday);
  
  return paymentDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

    // Nuevos campos de pago
    const paymentStatus = 'pending';
    const expectedPaymentDate = calculatePaymentDate(new Date());
    const actualPaymentDate = null;
    const companyName = document.getElementById('companyName')?.value?.trim() || '';
    const notes = document.getElementById('notes')?.value?.trim() || '';

    // ðŸ“… Manejo de fechas
    let loadDate;
    try {
      const dateInputEl = document.getElementById('dateInput');
      const editDateEl  = document.getElementById('editDate');

      if (dateInputEl && dateInputEl.value) {
        loadDate = dateInputEl.value.trim();
      } else if (editDateEl && editDateEl.value) {
        loadDate = editDateEl.value.trim();
      } else if (existingLoadId && typeof existingLoadId === "string") {
        // Solo si el ID es vÃ¡lido
        const existingDoc = await window.db.collection('loads').doc(existingLoadId).get();
        loadDate = existingDoc.exists ? existingDoc.data().date : new Date().toISOString().split('T')[0];
      } else {
        loadDate = new Date().toISOString().split('T')[0];
      }
    } catch (err) {
      console.warn("âš ï¸ No se encontrÃ³ campo de fecha, usando hoy:", err);
      loadDate = new Date().toISOString().split('T')[0];
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


    // CÃ¡lculos
    const totalMiles = Number(loadedMiles) + Number(deadheadMiles);

let baseIncome;
let finalRpm;

// âœ… Si hay rate, calculamos RPM
if (Number(rate) > 0 && totalMiles > 0) {
  baseIncome = Number(rate);
  finalRpm = baseIncome / totalMiles;
} else {
  // âœ… Si no hay rate, usamos RPM
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
      date: loadDate || new Date().toISOString().split("T")[0], // ðŸ‘ˆ aseguramos siempre fecha
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'completed'
      
    };

    // Guardar en Firebase
    if (existingLoadId && typeof existingLoadId === "string") {
      await window.db.collection('loads').doc(existingLoadId).update(loadData);
      console.log('Carga actualizada con ID:', existingLoadId);
    } else {
      const doc = await window.db.collection('loads').add(loadData);
      console.log('Carga guardada con ID:', doc.id);
    }

    window.showMessage?.('âœ… Carga guardada', 'success');

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

// âœ… FUNCIÃ“N: Actualizar estado de rentabilidad (MANTENER)
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
        warning = ' - EvalÃºa destino';
    } else {
        status = 'PÃ©rdida';
        className = 'text-red-700 bg-red-100';
        warning = ' - Rechaza';
    }
    
    statusEl.textContent = status + warning;
    statusEl.className = className;
}

// âœ… FUNCIÃ“N: Limpiar formulario (MANTENER NOMBRE ORIGINAL)
function clearForm() {
    console.log('Limpiando formulario...');
    
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
    
    console.log('Formulario limpiado');
    hideDecisionPanel();

    // ðŸ‘‡ Ocultar tambiÃ©n el cuadro de notas
    hideNotesBox();
}


// ========================================
// âœ… FUNCIONES DE GOOGLE MAPS (MANTENER TODAS)
// ========================================

// âœ… Variables globales para Google Maps
let googleMap, directionsService, directionsRenderer;

// âœ… FUNCIÃ“N: Actualizar mapa
function updateMap() {
    const origin = document.getElementById('origin')?.value?.trim();
    const destination = document.getElementById('destination')?.value?.trim();
    
    if (!origin || !destination) {
        console.log("â³ Cannot update map: missing origin or destination");
        return;
    }
    
    if (googleMap && directionsService && directionsRenderer) {
        showRouteOnMap(origin, destination);
    } else {
        console.warn("âš ï¸ Map not ready, showing fallback");
        showMapFallback(origin, destination);
    }
}

// âœ… FALLBACK para cuando el mapa no estÃ© listo
function showMapFallback(origin, destination) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="w-full h-96 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center justify-center">
                <div class="text-center p-6">
                    <h3 class="text-lg font-semibold text-blue-800 mb-2">ðŸ—ºï¸ Ruta: ${origin} â†’ ${destination}</h3>
                    <p class="text-blue-600 mb-4">Mapa en proceso de carga...</p>
                    <button onclick="openGoogleMapsDirections()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Ver en Google Maps
                    </button>
                </div>
            </div>
        `;
    }
}

// âœ… FUNCIÃ“N: Abrir Google Maps (MANTENER)
function openGoogleMapsDirections() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    
    if (origin && destination) {
        const url = 'https://www.google.com/maps/dir/' + encodeURIComponent(origin) + '/' + encodeURIComponent(destination);
        window.open(url, '_blank');
    }
}

// âœ… FUNCIÃ“N: Mostrar ruta en mapa
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
            
            // Calcular distancia automÃ¡ticamente si estÃ¡ disponible
            const route = result.routes[0];
            const distance = route.legs[0].distance.value * 0.000621371; // metros a millas
            
            // Actualizar campo de millas si estÃ¡ vacÃ­o
            const loadedMilesEl = document.getElementById('loadedMiles');
            if (loadedMilesEl && !loadedMilesEl.value) {
                loadedMilesEl.value = Math.round(distance);
                updateTotalMiles();
            }
            
            console.log(`ðŸ—ºï¸ Ruta calculada: ${Math.round(distance)} millas`);
        } else {
            console.error('Error calculando ruta:', status);
            showMapFallback(origin, destination);
        }
    });
}

// âœ… FUNCIÃ“N: Calcular distancia automÃ¡ticamente
function calculateDistanceAutomatically() {
    // Intentar obtener de inputs ocultos primero (nuevo sistema)
    let origin = document.getElementById('origin-value')?.value?.trim();
    let destination = document.getElementById('destination-value')?.value?.trim();
    
    // Fallback a inputs normales (sistema legacy)
    if (!origin) origin = document.getElementById('origin')?.value?.trim();
    if (!destination) destination = document.getElementById('destination')?.value?.trim();
    
    if (!origin || !destination) {
        console.log("âš ï¸ Faltan origin/destination para calcular");
        return;
    }
    
    // Si hay funciÃ³n especÃ­fica para hidden values, usarla
    if (typeof calculateDistanceFromHidden === 'function' && 
        document.getElementById('origin-value')?.value) {
        calculateDistanceFromHidden(origin, destination);
        return;
    }
    
    // MÃ©todo estÃ¡ndar
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
                    console.log(`ðŸ“ Distancia calculada: ${Math.round(distance)} millas`);
                }
            }
        });
    }
}

// âœ… FUNCIÃ“N: Actualizar total de millas
function updateTotalMiles() {
    const loadedMiles = Number(document.getElementById('loadedMiles')?.value || 0);
    const deadheadMiles = Number(document.getElementById('deadheadMiles')?.value || 0);
    const total = loadedMiles + deadheadMiles;
    
    const tripMilesEl = document.getElementById('tripMiles');
    if (tripMilesEl) {
        tripMilesEl.textContent = total.toLocaleString();
    }
}

// âœ… FUNCIÃ“N: Inicializar Google Maps
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
        
        console.log("âœ… Google Maps inicializado correctamente");
        
        // Configurar autocompletado despuÃ©s de inicializar el mapa
        // Solo si no se ha configurado ya (evitar duplicados)
        if (!window.autocompleteConfigured) {
            window.autocompleteConfigured = true;
            setTimeout(setupGoogleAutocomplete, 1000);
        }
        
    } catch (error) {
        console.error("Error inicializando Google Maps:", error);
    }
}

// âœ… FUNCIÃ“N: Entry point oficial para Google Maps callback
function initMap() {
    console.log("âœ… initMap() llamado por Google Maps API");
    initGoogleMaps();
}

// Exponer initMap globalmente para el callback de Google Maps
window.initMap = initMap;

// âœ… FUNCIÃ“N: Configurar autocompletado de Google Places
// NOTA: PlaceAutocompleteElement no se inicializa correctamente (shadow DOM vacÃ­o)
// Usando mÃ©todo Autocomplete legacy que funciona perfectamente
async function setupGoogleAutocomplete() {
  try {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn("Google Places API no disponible");
      return;
    }

    console.log("ðŸ”„ Configurando Autocomplete (mÃ©todo legacy)...");
    
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
      console.log("âœ… Origin convertido a input normal");
    }

    if (destinationInput.tagName === 'GMP-PLACE-AUTOCOMPLETE') {
      const newDest = document.createElement('input');
      newDest.type = 'text';
      newDest.id = 'destination';
      newDest.className = destinationInput.className;
      newDest.placeholder = destinationInput.getAttribute('placeholder') || 'Destino (ej: Atlanta, GA)';
      newDest.autocomplete = 'off';
      destinationInput.parentNode.replaceChild(newDest, destinationInput);
      console.log("âœ… Destination convertido a input normal");
    }

    // Ahora configurar con el mÃ©todo legacy
    setupLegacyAutocomplete();
    
  } catch (error) {
    console.error("Error configurando autocompletado:", error);
  }
}

// ðŸ”„ FUNCIÃ“N FALLBACK: Autocomplete legacy si falla el nuevo
function setupLegacyAutocomplete() {
  try {
    console.log("ðŸ”„ Configurando Autocomplete legacy...");
    
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

    console.log("âœ… Autocomplete legacy configurado");
  } catch (error) {
    console.error("Error en legacy autocomplete:", error);
  }
}

// ðŸ†• FUNCIÃ“N: Calcular distancia usando valores de inputs ocultos
function calculateDistanceFromHidden(origin, destination) {
  if (!origin || !destination) {
    console.warn("âš ï¸ Faltan valores para calcular");
    return;
  }
  
  console.log("ðŸ“ Calculando distancia:", origin, "â†’", destination);
  
  if (!google.maps.DistanceMatrixService) {
    console.error("âŒ DistanceMatrixService no disponible");
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
      
      console.log(`âœ… Distancia calculada: ${distanceMiles} millas`);
      
      const loadedMilesEl = document.getElementById('loadedMiles');
      if (loadedMilesEl && !loadedMilesEl.value) {
        loadedMilesEl.value = distanceMiles;
        loadedMilesEl.dispatchEvent(new Event('input', { bubbles: true }));
        
        if (typeof updateTotalMiles === 'function') {
          updateTotalMiles();
        }
        
        console.log("âœ… Millas actualizadas en el campo");
      }
    } else {
      console.error("âŒ Error calculando distancia:", status);
    }
  });
}



// âœ… FUNCIÃ“N: Sincronizar vista de rentabilidad
function syncRentabilityCardSingleView() {
    const rentCard = document.getElementById('rentabilityCard');
    if (rentCard) {
        rentCard.style.display = 'none';
        rentCard.setAttribute('aria-hidden', 'true');
    }
}

// ========================================
// âœ… CONFIGURACIÃ“N DE EVENTOS (MANTENER COMPLETA)
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('ðŸš€ Calculator integrado cargado - configurando eventos');
    
    setTimeout(function() {
        // Configurar botones principales
        const calculateBtn = document.getElementById('calculateBtn');
        const saveBtn = document.getElementById('saveBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (calculateBtn) {
            calculateBtn.addEventListener('click', calculate);
            console.log('âœ… BotÃ³n calcular configurado con costos reales');
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', saveLoad);
            console.log('âœ… BotÃ³n guardar configurado');
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', clearForm);
            console.log('âœ… BotÃ³n limpiar configurado');
        }
        
        // Configurar auto-cÃ¡lculo de millas totales
        const loadedInput = document.getElementById('loadedMiles');
        const deadheadInput = document.getElementById('deadheadMiles');
        
        if (loadedInput && deadheadInput) {
            [loadedInput, deadheadInput].forEach(input => {
                input.addEventListener('input', updateTotalMiles);
            });
            console.log('âœ… Auto-cÃ¡lculo de millas totales configurado');
        }
        
        // Configurar validaciÃ³n en tiempo real
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
    
    // NO configurar autocompletado aquÃ­ - se hace automÃ¡ticamente cuando Google Maps carga via callback
    
    // Sincronizar vista de rentabilidad
    syncRentabilityCardSingleView();
});

// NO inicializar mapa manualmente - Google Maps lo hace via callback a initMap()

// ðŸ”„ Autocalculado en todos los campos de la calculadora
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
      console.warn("âš ï¸ calculate() no estÃ¡ disponible todavÃ­a");
    }
  }, 400);

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", debouncedCalc);
      el.addEventListener("change", debouncedCalc);
    }
  });

  console.log("âš¡ Auto cÃ¡lculo configurado en la calculadora");
}

function initAutoCalculation() {
  if (typeof window.calculate === "function") {
    setupAutoCalculation();
  } else {
    console.log("â³ Esperando a calculate...");
    setTimeout(initAutoCalculation, 300);
  }
}

document.addEventListener("DOMContentLoaded", initAutoCalculation);


// ðŸ‘‰ Exponer globalmente
window.showDestinationNotes = showDestinationNotes;

// =============================
// ðŸ“ Funciones para Modal de Notas
// =============================

// Variable global para recordar el destino actual
let currentDestinationKey = "";

// âœ… Normalizar destinos (para usar como key uniforme en Firestore)
function normalizeDestination(value) {
  if (!value) return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/,?\s*(ee\.?\s*uu\.?|usa|united states)/gi, "") // quitar paÃ­s
    .replace(/,/g, "")   // quitar comas
    .replace(/\s+/g, " "); // normalizar espacios
}



// ðŸ”„ Obtener notas de Firebase para un destino (por key normalizado)
async function getNotesForDestination(normalizedKey) {
  try {
    const snapshot = await firebase.firestore()
      .collection("notes")
      .where("userId", "==", window.currentUser.uid)
      .where("key", "==", normalizedKey)   // ðŸ‘ˆ bÃºsqueda exacta con clave uniforme
      .orderBy("createdAt", "desc")
      .get();

    return snapshot;
  } catch (error) {
    console.error("âŒ Error en getNotesForDestination:", error);
    return { empty: true, docs: [] };
  }
}

// ðŸ“ Cuadro amarillo de informaciÃ³n rÃ¡pida (solo contador)
async function showDestinationNotes(destination) {
  if (!destination) return;

  const normalized = normalizeDestination(destination);
  console.log("ðŸ”Ž showDestinationNotes ejecutado con:", destination, "âž¡ï¸ normalizado:", normalized);

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

  console.log("âœ… Notas filtradas para", normalized, ":", notes.length);

  const box = document.getElementById("previousNoteBox");
  const status = document.getElementById("notesStatusText");

  if (notes.length > 0) {
    status.textContent = `ðŸ“Œ ${notes.length} nota(s) guardada(s) para este destino`;
    box.classList.remove("hidden");
  } else {
    status.textContent = "â„¹ï¸ No hay notas para este destino.";
    box.classList.remove("hidden");
  }
}


// ðŸ“– Modal de Notas
async function openNotesModal(destination) {
  currentDestinationKey = normalizeDestination(destination);

  const modal = document.getElementById("notesModal");
  const title = document.getElementById("notesModalTitle");
  const list = document.getElementById("notesListModal");

  if (!currentDestinationKey) {
    title.textContent = "Notas";
    list.innerHTML = `<p class="text-gray-500 text-sm">âš ï¸ No se especificÃ³ un destino.</p>`;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    return;
  }

  // ðŸ‘‡ mostramos el destino original en el tÃ­tulo, pero usamos el key para buscar
  title.textContent = `Notas para ${destination}`;
  list.innerHTML = `<p class="text-gray-500 text-sm">Cargando notas...</p>`;
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const snapshot = await getNotesForDestination(currentDestinationKey);

  if (snapshot.empty) {
    list.innerHTML = `<p class="text-gray-500 text-sm">No hay notas registradas aÃºn.</p>`;
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
            <button class="text-blue-600 text-xs" onclick="editNote('${doc.id}', '${data.note}')">âœï¸</button>
            <button class="text-red-600 text-xs" onclick="deleteNote('${doc.id}')">ðŸ—‘ï¸</button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
  }
}

// âŒ Cerrar modal
function closeNotesModal() {
  const modal = document.getElementById("notesModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// âž• AÃ±adir nueva nota
async function addNoteToDestination(key) {
  const textarea = document.getElementById("newNoteModalInput");
  const note = textarea.value.trim();
  if (!note) return alert("La nota no puede estar vacÃ­a");

  try {
    const rawDestination = document.getElementById("destination")?.value?.trim() || key;

    await firebase.firestore().collection("notes").add({
      userId: window.currentUser.uid,
      key: normalizeDestination(rawDestination), // ðŸ‘ˆ clave uniforme para bÃºsquedas
      destination: rawDestination,               // ðŸ‘ˆ lo que ves en el input
      note: note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    textarea.value = "";
    openNotesModal(rawDestination);
    showDestinationNotes(rawDestination);
  } catch (error) {
    console.error("âŒ Error guardando nota:", error);
    alert("Error guardando nota");
  }
}

// âœ… Escuchar cambios en el destino (blur + change)
function handleDestinationChange(e) {
  const dest = e.target.value.trim();
  if (dest && dest.length > 3) {
    console.log("ðŸ”Ž Detectado destino vÃ¡lido:", dest);
    showDestinationNotes(dest);
  } else {
    console.log("âš ï¸ Destino muy corto, no se buscan notas:", dest);
  }
}

const destInput = document.getElementById("destination");
destInput?.addEventListener("blur", handleDestinationChange);
destInput?.addEventListener("change", handleDestinationChange);

// âœï¸ Editar nota
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
    console.error("âŒ Error editando nota:", error);
  }
}

// ðŸ—‘ï¸ Eliminar nota
async function deleteNote(noteId) {
  if (!confirm("Â¿Eliminar esta nota?")) return;

  try {
    await firebase.firestore().collection("notes").doc(noteId).delete();

    openNotesModal(currentDestinationKey);
    showDestinationNotes(document.getElementById("destination")?.value?.trim());
  } catch (error) {
    console.error("âŒ Error eliminando nota:", error);
  }
}

// ðŸ‘‰ Exponer globalmente
window.showDestinationNotes = showDestinationNotes;
window.openNotesModal = openNotesModal;
window.closeNotesModal = closeNotesModal;
window.addNoteToDestination = addNoteToDestination;
window.editNote = editNote;
window.deleteNote = deleteNote;


// ðŸ”Ž DEBUG: inspeccionar notas en Firestore
async function debugNotas() {
  const uid = window.currentUser?.uid;
  if (!uid) {
    console.warn("âš ï¸ Usuario no autenticado");
    return;
  }

  // 1. Ver todas las notas del usuario
  const allNotes = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .get();

  console.log("ðŸ“‚ TOTAL notas encontradas:", allNotes.docs.length);
  allNotes.docs.forEach(doc => console.log("âž¡ï¸ Nota:", doc.id, doc.data()));

  // 2. Buscar exactamente por destination
  const snapDest = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .where("destination", "==", "Miami, FL")
    .get();

  console.log("ðŸ“‚ Resultado destination='Miami, FL':", snapDest.docs.length);
  snapDest.docs.forEach(doc => console.log("âž¡ï¸ Dest:", doc.id, doc.data()));

  // 3. Buscar por key (mayÃºsculas)
  const snapKey = await firebase.firestore()
    .collection("notes")
    .where("userId", "==", uid)
    .where("key", "==", "MIAMI, FL")
    .get();

  console.log("ðŸ“‚ Resultado key='MIAMI, FL':", snapKey.docs.length);
  snapKey.docs.forEach(doc => console.log("âž¡ï¸ Key:", doc.id, doc.data()));
}

let notesTimeout;

// ðŸ”„ Ejecuta showDestinationNotes con delay (debounce)
function showDestinationNotesDebounced(value) {
  clearTimeout(notesTimeout);
  notesTimeout = setTimeout(() => {
    showDestinationNotes(value);
  }, 600); // espera 600ms despuÃ©s de dejar de escribir
}


// ========================================
// âœ… EXPOSICIÃ“N DE FUNCIONES GLOBALES (MANTENER TODAS)
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

// Funciones del panel de decisiÃ³n
window.showDecisionPanel = showDecisionPanel;
window.hideDecisionPanel = hideDecisionPanel;
window.copyPriceToClipboard = copyPriceToClipboard;
window.acceptAndSave = acceptAndSave;

// Funciones de costos reales (NUEVAS)
window.TU_COSTO_REAL = TU_COSTO_REAL;
window.calcularTiempoReal = calcularTiempoReal;
window.getDecisionInteligente = getDecisionInteligente;
window.detectarFactoresEspeciales = detectarFactoresEspeciales;

console.log('âœ… Calculator.js INTEGRADO cargado completamente - Costos reales + Funcionalidad completa');