//  CALCULATOR.JS - VERSION INTEGRADA COMPLETA
// Combina: Costos reales + Todas las funcionalidades existentes

// IMPORTS COMENTADOS - Usando funciones globales en su lugar
// import { sanitizeNumber, sanitizeText } from './security.js';
// import { LoadingManager, showToast } from './ui-feedback.js';
// Las funciones están disponibles globalmente desde los scripts

//  TUS COSTOS OPERATIVOS REALES - Actualizado DINÁMICO 2025
// Ahora obtiene los datos del perfil del usuario si existe, o usa defaults seguros
const DEFAULT_COSTS = {
  combustible: 0.182,
  mantenimiento: 0.020,
  comida: 0.028,
  costosFijos: 0.346,
  TOTAL: 0.576
};

// Getter dinámico para usar los costos actuales del usuario
function getUsersCosts() {
  if (window.currentUser && window.currentUser.costs) {
    const costs = window.currentUser.costs;
    // Asegurar que los valores sean numéricos
    return {
      combustible: Number(costs.combustible || costs.fuelCost) || DEFAULT_COSTS.combustible,
      mantenimiento: Number(costs.mantenimiento || costs.maintenanceCost) || DEFAULT_COSTS.mantenimiento,
      comida: Number(costs.comida || costs.otherCost) || DEFAULT_COSTS.comida,
      costosFijos: Number(costs.costosFijos || costs.fixedCost) || DEFAULT_COSTS.costosFijos,
      TOTAL: Number(costs.total || costs.totalCPM) || DEFAULT_COSTS.TOTAL
    };
  }
  return DEFAULT_COSTS;
}

// Mantener compatibilidad con llamadas directas (usando Proxy si es soportado, o getter)
// Para navegadores antiguos o simplicidad, definimos TU_COSTO_REAL como un objeto que se actualiza o una función
// La mejor estrategia es actualizar window.TU_COSTO_REAL cuando carga el usuario, pero por ahora usaremos una función wrapper
const TU_COSTO_REAL = new Proxy(DEFAULT_COSTS, {
  get: function (target, prop) {
    const dynamicCosts = getUsersCosts();
    return prop in dynamicCosts ? dynamicCosts[prop] : target[prop];
  }
});

// ========================================
//  SHARED FUNCTION: Calculate Total Expenses
// ========================================
// Used by both Decision Panel and Lex for consistent calculations
function calculateTotalExpenses(totalMiles, tolls = 0, others = 0) {
  const fuelCost = totalMiles * TU_COSTO_REAL.combustible;
  const maintenanceCost = totalMiles * TU_COSTO_REAL.mantenimiento;
  const foodCost = totalMiles * TU_COSTO_REAL.comida;
  const fixedCosts = totalMiles * TU_COSTO_REAL.costosFijos;

  return {
    fuelCost,
    maintenanceCost,
    foodCost,
    fixedCosts,
    tolls,
    others,
    total: fuelCost + maintenanceCost + foodCost + fixedCosts + tolls + others
  };
}

// Expose globally for use by Lex and other modules
window.calculateTotalExpenses = calculateTotalExpenses;


// ======== DECISION 2025 (realista) ========
let DECISION_MODE = (typeof window !== 'undefined' && window.DECISION_MODE) || 'realista2025';

const COSTO_BASE_MI = 0.55;
const FLOOR_ESCAPE = 0.55;
const FLOOR_ACCEPT = 0.75;

// NUEVA CLASIFICACION DE ZONAS basada en experiencia real de Ricardo
// Core Midwest: Zona Optima donde quieres operar siempre
const ZONAS_CORE_MIDWEST = new Set(['IL', 'IN', 'OH', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS']);

// Extended Midwest: Aceptable, puedes trabajar aqui­ sin problema
const ZONAS_EXTENDED_MIDWEST = new Set(['PA', 'KY', 'TN', 'AR', 'OK', 'AL']);

// Salida Aceptable: Solo en Ultimo caso, pero sales razonablemente
const ZONAS_SALIDA_OK = new Set(['NC', 'SC', 'GA', 'WV', 'VA', 'MD', 'DE', 'NJ', 'NY']);

// TRAP ZONES: Evitar - difI­cil/caro salir - solo con RPM premium
const ZONAS_TRAP = new Set(['FL', 'TX', 'NM', 'AZ', 'NV', 'CA', 'OR', 'WA', 'ID', 'MT', 'WY', 'UT', 'CO', 'ND', 'SD', 'NE']);

// Mantener compatibilidad con codigo existente
const ZONAS_VERDES = new Set([...ZONAS_CORE_MIDWEST, ...ZONAS_EXTENDED_MIDWEST]);
const ZONAS_AMAR = ZONAS_SALIDA_OK;
const ZONAS_ROJAS = ZONAS_TRAP;

// ========================================
//  FUNCIÓN: Obtener clima del destino
// ========================================
async function getWeatherForDestination(destination) {
  const apiKey = '07e0e0128247442ebd200704250712';
  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${destination}&aqi=no`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Weather API error');
    }

    const data = await response.json();
    const temp = Math.round(data.current.temp_f);
    const condition = data.current.condition.text;
    const isSnow = condition.toLowerCase().includes('snow');
    const isStorm = condition.toLowerCase().includes('storm') || condition.toLowerCase().includes('thunder');
    const isRain = condition.toLowerCase().includes('rain');

    // Elegir emoji según condición
    let emoji = '🌤️';
    if (isSnow) emoji = '❄️';
    else if (isStorm) emoji = '⛈️';
    else if (isRain) emoji = '🌧️';
    else if (condition.toLowerCase().includes('cloud')) emoji = '☁️';
    else if (condition.toLowerCase().includes('clear') || condition.toLowerCase().includes('sunny')) emoji = '☀️';

    // Determinar color del badge
    let badgeClass = '';
    if (isSnow || temp <= 32) {
      badgeClass = 'bg-blue-900/40 border border-blue-400/40'; // Azul para frío/nieve
    } else if (isStorm) {
      badgeClass = 'bg-orange-900/40 border border-orange-400/40'; // Naranja para tormentas
    }

    return {
      temp,
      condition,
      emoji,
      badgeClass,
      text: `${emoji} ${temp}°F • ${condition}`
    };

  } catch (error) {
    console.warn('No se pudo obtener clima:', error);
    return {
      temp: null,
      condition: 'No disponible',
      emoji: '🌤️',
      badgeClass: '',
      text: '🌤️ Clima no disponible'
    };
  }
}

// ========================================
//  FUNCIÓN: Cargar mapa con ruta y clima
// ========================================
async function loadRouteMap() {
  if (!window.weatherModalData) return;

  const { origin, destination } = window.weatherModalData;

  // Inicializar mapa
  const mapDiv = document.getElementById('routeMap');
  const map = new google.maps.Map(mapDiv, {
    zoom: 6,
    center: { lat: 39.8, lng: -86.1 }, // Centro aproximado USA
    mapTypeId: 'roadmap'
  });

  // Directions Service
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true // Usaremos markers custom con clima
  });

  // Calcular ruta
  const request = {
    origin: origin,
    destination: destination,
    travelMode: 'DRIVING'
  };

  directionsService.route(request, async (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);

      const route = result.routes[0];
      const leg = route.legs[0];

      // Waypoints: Origen, Medio, Destino
      const waypoints = [
        { position: leg.start_location, name: origin, type: 'origin' },
        { position: route.overview_path[Math.floor(route.overview_path.length / 2)], name: 'Punto Medio', type: 'mid' },
        { position: leg.end_location, name: destination, type: 'destination' }
      ];

      // Obtener clima para cada waypoint
      const waypointContainer = document.getElementById('waypointWeather');
      waypointContainer.innerHTML = '<div class="text-sm font-bold text-gray-700 mb-2">Clima en Ruta:</div>';

      for (const wp of waypoints) {
        const lat = wp.position.lat();
        const lng = wp.position.lng();

        // Llamar WeatherAPI por coordenadas
        const weatherData = await getWeatherByCoords(lat, lng);

        if (weatherData) {
          // Marker con clima
          const icon = getWeatherMarkerIcon(weatherData.temp, weatherData.condition);

          const marker = new google.maps.Marker({
            position: wp.position,
            map: map,
            title: `${wp.name}: ${weatherData.temp}°F ${weatherData.condition}`,
            label: {
              text: `${weatherData.temp}°F`,
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            },
            icon: icon
          });

          // Info en lista
          waypointContainer.innerHTML += `
            <div class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${getWeatherEmoji(weatherData.condition)}</span>
                <div>
                  <div class="font-semibold text-sm">${wp.name}</div>
                  <div class="text-xs text-gray-600">${weatherData.condition}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-lg font-bold">${weatherData.temp}°F</div>
                <div class="text-xs text-gray-600">${weatherData.wind} mph viento</div>
              </div>
            </div>
          `;
        }
      }
    } else {
      console.error('Directions request failed:', status);
      mapDiv.innerHTML = '<div class="flex items-center justify-center h-full text-red-600">Error cargando ruta</div>';
    }
  });

  window.routeMapLoaded = true;
  window.routeMap = map;
}

// ========================================
//  FUNCIÓN: Ícono de marker según clima
// ========================================
function getWeatherMarkerIcon(temp, condition) {
  let color = '#3b82f6'; // Azul default

  if (temp <= 32 || condition.toLowerCase().includes('snow')) {
    color = '#60a5fa'; // Azul claro para frío/nieve
  } else if (condition.toLowerCase().includes('rain') || condition.toLowerCase().includes('storm')) {
    color = '#6366f1'; // Índigo para lluvia
  } else if (temp >= 80) {
    color = '#f59e0b'; // Naranja para calor
  }

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: 'white',
    strokeWeight: 2
  };
}

// ========================================
//  FUNCIÓN: Toggle radar layer (RainViewer)
// ========================================
let radarLayer = null;

function toggleRadarLayer() {
  if (!window.routeMap) return;

  const button = document.getElementById('radarToggle');

  if (radarLayer) {
    // Quitar radar
    radarLayer.setMap(null);
    radarLayer = null;
    button.textContent = '📡 Mostrar Radar';
    button.className = 'px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition';
  } else {
    // Agregar radar de RainViewer
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(response => response.json())
      .then(data => {
        // Obtener el frame más reciente
        const lastFrame = data.radar.past[data.radar.past.length - 1];
        const radarUrl = `https://tilecache.rainviewer.com${lastFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

        radarLayer = new google.maps.ImageMapType({
          getTileUrl: function (coord, zoom) {
            return radarUrl.replace('{z}', zoom).replace('{x}', coord.x).replace('{y}', coord.y);
          },
          tileSize: new google.maps.Size(256, 256),
          opacity: 0.6,
          name: 'Radar'
        });

        window.routeMap.overlayMapTypes.push(radarLayer);

        button.textContent = '📡 Ocultar Radar';
        button.className = 'px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition';
      })
      .catch(error => {
        console.error('Error cargando radar:', error);
        alert('No se pudo cargar el radar');
      });
  }
}

// Exponer funciones globalmente
window.switchWeatherTab = switchWeatherTab;
window.loadRouteMap = loadRouteMap;
window.toggleRadarLayer = toggleRadarLayer;

// Exponer globalmente
window.getWeatherForDestination = getWeatherForDestination;

function getDecisionMode() {
  return (typeof window !== 'undefined' && window.DECISION_MODE) || DECISION_MODE || 'realista2025';
}

// NUEVA FUNCION: Clasificar zona segun experiencia real
function clasificarZonaReal(state) {
  if (!state) return 'DESCONOCIDA';
  if (ZONAS_CORE_MIDWEST.has(state)) return 'CORE_MIDWEST';
  if (ZONAS_EXTENDED_MIDWEST.has(state)) return 'EXTENDED_MIDWEST';
  if (ZONAS_SALIDA_OK.has(state)) return 'SALIDA_OK';
  if (ZONAS_TRAP.has(state)) return 'TRAP';
  return 'DESCONOCIDA';
}

// NUEVA FUNCION: Analizar trap penalty y calcular RPM real del ciclo
function analizarTrapPenalty(origenState, destinoState, millas, rpm) {
  const zonaOrigen = clasificarZonaReal(origenState);
  const zonaDestino = clasificarZonaReal(destinoState);

  // CASO 1: Sales del Midwest (Core o Extended) hacia TRAP
  if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
    zonaDestino === 'TRAP') {

    // Costos de salir del TRAP (basado en experiencia real)
    const millasRegreso = 2200; // Promedio West/Texas al Midwest
    const rpmSalida = 0.65; // RPM promedio que pagan para salir de TRAP
    const costoPorMilla = 0.526; // Tu costo operativo real

    // Revenue del ciclo completo
    const revenueIda = rpm * millas;
    const revenueSalida = rpmSalida * millasRegreso;
    const revenueTotal = revenueIda + revenueSalida;

    // Costo del ciclo completo
    const millasTotal = millas + millasRegreso;
    const costoTotal = millasTotal * costoPorMilla;

    // RPM real y ganancia del ciclo
    const rpmRealCiclo = revenueTotal / millasTotal;
    const gananciaCiclo = revenueTotal - costoTotal;
    const diasEstimados = Math.ceil(millasTotal / 600); // ~600 mi/di­a promedio
    const gananciaPorDia = gananciaCiclo / diasEstimados;

    return {
      esTrampa: true,
      rpmOfrecido: rpm,
      rpmRealCiclo: rpmRealCiclo,
      millasTotal: millasTotal,
      revenueTotal: revenueTotal,
      costoTotal: costoTotal,
      gananciaCiclo: gananciaCiclo,
      diasEstimados: diasEstimados,
      gananciaPorDia: gananciaPorDia,
      advertencia: `TRAMPA: Te saca del Midwest al ${destinoState}. Costo de regresar incluido.`,
      detalles: {
        ida: { millas, rpm, revenue: revenueIda },
        regreso: { millas: millasRegreso, rpm: rpmSalida, revenue: revenueSalida }
      }
    };
  }

  // CASO 2: Movimiento dentro del Midwest (Core o Extended)
  if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
    (zonaDestino === 'CORE_MIDWEST' || zonaDestino === 'EXTENDED_MIDWEST')) {
    return {
      esTrampa: false,
      rpmRealCiclo: rpm,
      nivel: 'OPTIMO',
      advertencia: `PERFECTO: Te mantienes en zona operativa rentable`,
      zonaOrigen: zonaOrigen,
      zonaDestino: zonaDestino
    };
  }

  // CASO 3: Midwest core Salida OK (Carolinas, Atlanta, etc.)
  if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
    zonaDestino === 'SALIDA_OK') {
    return {
      esTrampa: false,
      rpmRealCiclo: rpm,
      nivel: 'EVALUAR',
      advertencia: `EVALUAR: Sales del Midwest a ${destinoState}. Sale razonable pero menos cargas cortas.`,
      minimumRPM: 0.95 // Requiere premium moderado
    };
  }

  // CASO 4: Estas en TRAP y Regresando a Midwest (relocalizacion necesaria)
  if (zonaOrigen === 'TRAP' &&
    (zonaDestino === 'CORE_MIDWEST' || zonaDestino === 'EXTENDED_MIDWEST')) {
    return {
      esTrampa: false,
      rpmRealCiclo: rpm,
      nivel: 'RELOCALIZACION',
      advertencia: `RELOCALIZACION: Regresando del ${origenState} al Midwest. Necesario para volver a zona rentable.`,
      minimumRPM: 0.70 // Mas flexible, necesitas salir
    };
  }

  // CASO 5: Dentro de TRAP o entre zonas no ideales
  return {
    esTrampa: zonaDestino === 'TRAP',
    rpmRealCiclo: rpm,
    nivel: 'NORMAL',
    zonaOrigen: zonaOrigen,
    zonaDestino: zonaDestino
  };
}




//  FUNCION: Calcular tiempo de viaje real
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

//  FUNCION: Reglas de decision inteligentes CON ANALISIS DE TRAP LOADS
function getDecisionInteligente(rpm, millas, factoresAdicionales = {}) {
  // Si eliges modo original desde la UI, respetamos tu logica anterior si existe
  if (getDecisionMode() !== 'realista2025' && typeof getDecisionInteligente_original === 'function') {
    return getDecisionInteligente_original(rpm, millas, factoresAdicionales);
  }

  const {
    zonaOrigen = 'DESCONOCIDA',
    zonaDestino = 'DESCONOCIDA',
    origenState = '',
    destinoState = '',
    areaMala = false,
    relocalizaBuena = false,
    tiempoSinCarga = 0
  } = factoresAdicionales;

  // NUEVO: Analizar si es carga trampa
  let trapAnalysis = null;
  if (origenState && destinoState) {
    trapAnalysis = analizarTrapPenalty(origenState, destinoState, millas, rpm);
  }

  // CASO ESPECIAL: Si es TRAMPA, aplicar logica estricta
  if (trapAnalysis && trapAnalysis.esTrampa) {
    const rpmMinimo = 1.25; // Necesitas premium para compensar

    if (rpm < rpmMinimo) {
      return {
        decision: "RECHAZA - TRAMPA",
        level: "reject",
        icon: "",
        color: "decision-reject",
        razon: trapAnalysis.advertencia + `\nRPM ofrecido: $${rpm.toFixed(2)} < Minimo $${rpmMinimo}`,
        confianza: "Alta",
        trapAnalysis: trapAnalysis,
        detallesCiclo: trapAnalysis.detalles ? (`\n ANALISIS DEL CICLO COMPLETO:\nIda: ${trapAnalysis.detalles.ida.millas} mi x $${trapAnalysis.detalles.ida.rpm.toFixed(2)} = $${trapAnalysis.detalles.ida.revenue.toFixed(0)}\nRegreso: ${trapAnalysis.detalles.regreso.millas} mi x $${trapAnalysis.detalles.regreso.rpm.toFixed(2)} = $${trapAnalysis.detalles.regreso.revenue.toFixed(0)}\nTotal: ${trapAnalysis.millasTotal} mi | RPM real: $${trapAnalysis.rpmRealCiclo.toFixed(2)}\nGanancia ciclo: $${trapAnalysis.gananciaCiclo.toFixed(0)} en ${trapAnalysis.diasEstimados} dias ($${trapAnalysis.gananciaPorDia.toFixed(0)}/dia)\n\nMejor esperar cargas en Midwest a $1.00+/mi`) : ""
      };
    } else {
      return {
        decision: "EVALUA CON MUCHO CUIDADO",
        level: "warning",
        icon: "",
        color: "decision-warning",
        razon: `RPM $${rpm.toFixed(2)} es bueno, pero te saca del Midwest.\n` + trapAnalysis.advertencia,
        confianza: "Media",
        trapAnalysis: trapAnalysis,
        detallesCiclo: trapAnalysis.detalles ? (`\nANALISIS DEL CICLO COMPLETO:\nIda: ${trapAnalysis.detalles.ida.millas} mi x $${trapAnalysis.detalles.ida.rpm.toFixed(2)} = $${trapAnalysis.detalles.ida.revenue.toFixed(0)}\nRegreso: ${trapAnalysis.detalles.regreso.millas} mi x $${trapAnalysis.detalles.regreso.rpm.toFixed(2)} = $${trapAnalysis.detalles.regreso.revenue.toFixed(0)}\nRPM real del ciclo: $${trapAnalysis.rpmRealCiclo.toFixed(2)}\nGanancia estimada: $${trapAnalysis.gananciaCiclo.toFixed(0)} en ${trapAnalysis.diasEstimados} dias`) : ""
      };
    }
  }

  // âœ… CASO ESPECIAL: Movimiento optimo dentro del Midwest
  if (trapAnalysis && trapAnalysis.nivel === 'OPTIMO') {
    const umbralOptimo = millas <= 400 ? 1.00 : 0.85;
    if (rpm >= umbralOptimo) {
      return {
        decision: "ACEPTA",
        level: "accept",
        icon: "",
        color: "decision-accept",
        razon: trapAnalysis.advertencia + `\nRPM $${rpm.toFixed(2)} excelente para movimiento interno`,
        confianza: "Alta",
        trapAnalysis: trapAnalysis
      };
    }
  }

  // âœ… CASO ESPECIAL: Relocalizacion necesaria (saliendo de TRAP)
  if (trapAnalysis && trapAnalysis.nivel === 'RELOCALIZACION') {
    if (rpm >= 0.70) {
      return {
        decision: "ACEPTA",
        level: "accept",
        icon: "",
        color: "decision-accept",
        razon: trapAnalysis.advertencia + `\nRPM $${rpm.toFixed(2)} aceptable para salir`,
        confianza: tiempoSinCarga >= 1 ? "Alta" : "Media-Alta",
        trapAnalysis: trapAnalysis
      };
    }
  }

  // âœ… CASO ESPECIAL: Salida a zona OK (Carolinas, Atlanta)
  if (trapAnalysis && trapAnalysis.nivel === 'EVALUAR' && trapAnalysis.minimumRPM) {
    if (rpm >= trapAnalysis.minimumRPM) {
      return {
        decision: "EVALUA",
        level: "warning",
        icon: "",
        color: "decision-warning",
        razon: trapAnalysis.advertencia + `\nRPM $${rpm.toFixed(2)} aceptable pero evalÃºa alternativas en Midwest`,
        confianza: "Media",
        trapAnalysis: trapAnalysis
      };
    } else {
      return {
        decision: "RECHAZA",
        level: "reject",
        icon: "",
        color: "decision-reject",
        razon: `Te saca del Midwest. RPM $${rpm.toFixed(2)} < MÃ­nimo $${trapAnalysis.minimumRPM}`,
        confianza: "Alta"
      };
    }
  }

  // ==============================================================
  // LOGICA ORIGINAL (para casos no cubiertos por trap analysis)
  // ==============================================================

  // Umbrales dinamicos por distancia
  let pisoAceptar = FLOOR_ACCEPT; // 0.75 base
  let pisoEscape = FLOOR_ESCAPE; // 0.55 base
  if (millas <= 400) pisoAceptar = Math.max(pisoAceptar, 0.80);
  if (millas > 800) pisoAceptar = Math.min(pisoAceptar, 0.72);

  // Si llevas ≥ 1 día parado, flexibiliza el escape un poco (sin bajar del costo base)
  if (tiempoSinCarga >= 1) pisoEscape = Math.max(COSTO_BASE_MI, pisoEscape - 0.02);

  // 1) Proteccion dura: por debajo del costo base
  if (rpm < COSTO_BASE_MI - 0.01) {
    return {
      decision: "RECHAZA",
      level: "reject",
      icon: "",
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
      icon: "",
      color: "decision-accept",
      razon: `RPM $${rpm.toFixed(2)} &ge; ${pisoAceptar.toFixed(2)} &middot; Destino ${zonaDestino}`,
      confianza: "Alta"
    };
  }

  // 3) Rango intermedio: evaluar/escape
  const enRangoEscape = rpm >= pisoEscape && rpm < pisoAceptar;

  if (enRangoEscape) {
    // ROJA HACIA (AMARILLA/VERDE): relocalizacion
    if (areaMala && relocalizaBuena) {
      return {
        decision: "EVALUA RELOCALIZACION",
        level: "warning",
        icon: "",
        color: "decision-warning",
        razon: `Cubre costos y mueve ${zonaOrigen} → ${zonaDestino}`,
        confianza: tiempoSinCarga >= 1 ? "Alta" : "Media-Alta"
      };
    }
    // AMARILLA HACIA VERDE o AMARILLA HACIA AMARILLA (Ãºtil)
    if (zonaDestino === 'VERDE' || (zonaOrigen === 'AMARILLA' && zonaDestino === 'AMARILLA')) {
      return {
        decision: "EVALUA",
        level: "warning",
        icon: "",
        color: "decision-warning",
        razon: `RPM medio y direccion Ãºtil (${zonaOrigen} → ${zonaDestino})`,
        confianza: "Media"
      };
    }
    // ROJA HACIA ROJA (no conviene)
    if (zonaOrigen === 'ROJA' && zonaDestino === 'ROJA') {
      return {
        decision: "RECHAZA",
        level: "reject",
        icon: "",
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
    icon: "",
    color: "decision-reject",
    razon: `RPM $${rpm.toFixed(2)} por debajo de umbral y sin beneficio de direccion.`,
    confianza: "Alta"
  };
}


//  FUNCION: Generar razones detalladas
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

//  FUNCION: Detectar factores especiales automaticamente
function detectarFactoresEspeciales(origin, destination, { diasSinCarga = 0 } = {}) {
  const sO = getStateFromPlace(origin || '');
  const sD = getStateFromPlace(destination || '');
  const zonaO = categorizeZone(sO);
  const zonaD = categorizeZone(sD);

  const areaMala = (zonaO === 'ROJA');
  const destinoMejorQueOrigen = (
    (zonaO === 'ROJA' && (zonaD === 'AMARILLA' || zonaD === 'VERDE')) ||
    (zonaO === 'AMARILLA' && zonaD === 'VERDE')
  );

  return {
    areaMala,
    relocalizaBuena: destinoMejorQueOrigen,
    zonaOrigen: zonaO,
    zonaDestino: zonaD,
    origenState: sO,      // âœ… NUEVO: Pasar estado origen
    destinoState: sD,     // âœ… NUEVO: Pasar estado destino
    tiempoSinCarga: diasSinCarga,
    alternativasLimitadas: false
  };
}

//  FUNCIÓN PRINCIPAL: Calculate con costos reales
async function calculate() {
  const calculateBtn = document.getElementById('calculateBtn');

  // Show loading state
  if (calculateBtn) {
    LoadingManager.show(calculateBtn, 'Calculando...');
  }

  try {
    debugLog(" Calculando con costos reales confirmados...");

    // Obtener y sanitizar valores de los campos
    const origin = sanitizeText(document.getElementById('origin')?.value?.trim() || '', 100);
    const destination = sanitizeText(document.getElementById('destination')?.value?.trim() || '', 100);

    // Sanitize numeric inputs with reasonable limits
    console.log('[DEBUG] RAW VALUES before sanitization:');
    console.log('  loadedMiles RAW:', document.getElementById('loadedMiles')?.value);
    console.log('  rpm RAW:', document.getElementById('rpm')?.value);
    console.log('  rate RAW:', document.getElementById('rate')?.value);

    let loadedMiles = sanitizeNumber(document.getElementById('loadedMiles')?.value, 0, 10000);
    let deadheadMiles = sanitizeNumber(document.getElementById('deadheadMiles')?.value, 0, 5000);
    let rpm = sanitizeNumber(document.getElementById('rpm')?.value, 0, 50);
    let rate = sanitizeNumber(document.getElementById('rate')?.value, 0, 500000);
    const tolls = sanitizeNumber(document.getElementById('tolls')?.value, 0, 10000);
    const others = sanitizeNumber(document.getElementById('otherCosts')?.value, 0, 10000);

    //  Definir totalMiles ANTES de validaciones
    const totalMiles = loadedMiles + deadheadMiles;

    // DEBUG: Log all values before validation
    console.log('[DEBUG calculate()] Values after sanitization:');
    console.log('  origin:', origin);
    console.log('  destination:', destination);
    console.log('  loadedMiles:', loadedMiles);
    console.log('  deadheadMiles:', deadheadMiles);
    console.log('  totalMiles:', totalMiles);
    console.log('  rpm:', rpm);
    console.log('  rate:', rate);

    //  Condición mínima antes de mostrar resultados
    if (!origin || !destination || totalMiles <= 0 || (rpm <= 0 && rate <= 0)) {
      console.log('[DEBUG calculate()] FAILED validation, returning early');
      console.log('  !origin:', !origin);
      console.log('  !destination:', !destination);
      console.log('  totalMiles <= 0:', totalMiles <= 0);
      console.log('  (rpm <= 0 && rate <= 0):', (rpm <= 0 && rate <= 0));
      hideDecisionPanel();
      if (calculateBtn) LoadingManager.hide(calculateBtn);
      return;
    }

    //  Validaciones suaves
    if (!origin || !destination) {
      debugLog(" Faltan origen/destino, no se ejecuta cálculo.");
      return;
    }
    if (totalMiles <= 0) {
      debugLog(" Millas inválidas, no se ejecuta cálculo.");
      return;
    }

    //  Ajuste de lógica Rate / RPM
    if (rpm > 0 && rate === 0) {
      rate = Math.round(rpm * totalMiles);
    } else if (rate > 0 && totalMiles > 0) {
      rpm = Math.round((rate / totalMiles) * 100) / 100;
    }

    // 🎯 MULTI-STOP: Get all additional stops
    console.log('[DEBUG] About to call getStops()');
    const stops = getStops();
    console.log('[DEBUG] getStops() returned:', stops);
    let combinedMiles = totalMiles;
    let combinedRevenue = rate;
    let stopsData = []; // For breakdown display

    if (stops.length > 0) {
      // Add main leg as first stop for display
      stopsData.push({
        from: origin,
        to: destination,
        miles: totalMiles,
        rpm: rpm,
        revenue: rate
      });

      // Add all additional stops  
      let previousDest = destination;
      stops.forEach((stop, index) => {
        combinedMiles += stop.miles;
        combinedRevenue += stop.revenue;

        stopsData.push({
          from: previousDest,
          to: stop.destination,
          miles: stop.miles,
          rpm: stop.rpm,
          revenue: stop.revenue
        });

        previousDest = stop.destination;
      });

      debugLog(`[MULTI-STOP] Total: ${stopsData.length} stops, ${combinedMiles}mi, $${combinedRevenue.toFixed(0)} revenue`);
    }

    // Cálculo de ingresos (usar valores combinados si hay stops)
    console.log('[DEBUG] Calculating totals...');
    const baseIncome = combinedRevenue;
    const totalCharge = baseIncome + tolls + others;
    console.log('[DEBUG] totalCharge:', totalCharge);

    // Use shared expense calculation function for consistency with Lex (usar millas combinadas)
    // 🎯 FIX: Use totalMiles for fuel/expenses (includes deadhead), not combinedMiles
    const expenseBreakdown = calculateTotalExpenses(totalMiles, tolls, others);
    const { fuelCost, maintenanceCost, foodCost, fixedCosts } = expenseBreakdown;
    const totalExpenses = expenseBreakdown.total;

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

    // Extraer códigos de estado
    let originState = '';
    let destinationState = '';
    if (typeof window.getStateCode === 'function') {
      originState = window.getStateCode(origin) || '';
      destinationState = window.getStateCode(destination) || '';
    }


    // Mostrar panel simplificado
    console.log('[DEBUG] About to call showDecisionPanel()');
    showDecisionPanel({
      totalCharge,
      netProfit,
      profitMargin: margin,
      profitPerMile,
      totalMiles: combinedMiles, // Usar millas combinadas
      actualRPM,
      origin,
      destination,
      originState,
      destinationState,
      stopsData: stopsData // Multi-stop breakdown data
    });

    // 🎯 MULTI-STOP: Poblar breakdown visual si hay paradas
    const roundTripBreakdownEl = document.getElementById('roundTripBreakdown');
    if (roundTripBreakdownEl) {
      if (stopsData.length > 0) {
        // Mostrar breakdown
        roundTripBreakdownEl.classList.remove('hidden');
        roundTripBreakdownEl.innerHTML = ''; // Clear previous content

        // Add each stop
        stopsData.forEach((stop, index) => {
          const stopDiv = document.createElement('div');
          stopDiv.className = 'text-white/90 text-xs';
          stopDiv.innerHTML = `📍 Parada ${index + 1}: ${stop.from} → ${stop.to} | ${stop.miles}mi @ $${stop.rpm.toFixed(2)} = <strong>$${stop.revenue.toFixed(0)}</strong>`;
          roundTripBreakdownEl.appendChild(stopDiv);
        });

        // Add total
        const totalDiv = document.createElement('div');
        totalDiv.className = 'text-white font-semibold border-t border-white/20 pt-1 mt-1 text-xs';
        totalDiv.innerHTML = `💰 Total: ${combinedMiles}mi | $${combinedRevenue.toFixed(0)} revenue | $${netProfit.toFixed(0)} profit`;
        roundTripBreakdownEl.appendChild(totalDiv);
      } else {
        // Ocultar breakdown si no hay paradas adicionales
        roundTripBreakdownEl.classList.add('hidden');
      }
    }


    // Lex listo para ayudar
    if (typeof window.setLexState === 'function') {
      window.setLexState('attention', {
        message: 'Carga calculada. Si quieres mi recomendacion, haz clic en mi',
        duration: 6000
      });
    }

    // Actualizar mapa
    updateMap();

    debugLog(" Calculo completado con costos reales");

    // Show success toast
    showToast('Carga calculada exitosamente', 'success', 2000);

  } catch (error) {
    console.error(' Error en calculo:', error);
    showToast('Error al calcular: ' + error.message, 'error');
  } finally {
    // Always hide loading state
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      LoadingManager.hide(calculateBtn);
    }
  }
}

// ========================================
//  FUNCIONES AUXILIARES (FUERA DE CALCULATE)
// ========================================

//  Mantener sincronía entre Rate y RPM
let calculateTimeout;
let listenersAdded = false;

function syncRateAndRpm() {
  const loadedMilesEl = document.getElementById('loadedMiles');
  const deadheadMilesEl = document.getElementById('deadheadMiles');
  const rpmEl = document.getElementById('rpm');
  const rateEl = document.getElementById('rate');
  const tripMilesEl = document.getElementById('tripMiles');

  if (!rpmEl || !rateEl || !loadedMilesEl) return;

  // Función para calcular con delay (debounce)
  function triggerCalculate() {
    clearTimeout(calculateTimeout);
    calculateTimeout = setTimeout(() => {
      /* calculate(); */ // ← COMENTAR ESTA LÍNEA
      // Solo actualizar los campos, NO calcular automáticamente
      updateTotalMiles();
    }, 800);
  }

  // Función para actualizar millas totales en pantalla
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
    // Cuando cambia RPM → recalcula Rate
    rpmEl.addEventListener("input", () => {
      const { totalMiles } = updateTotalMiles();
      const rpm = parseFloat(rpmEl.value) || 0;

      if (totalMiles > 0 && rpm > 0) {
        rateEl.value = (rpm * totalMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambia Rate → recalcula RPM
    rateEl.addEventListener("input", () => {
      const { totalMiles } = updateTotalMiles();
      const rate = parseFloat(rateEl.value) || 0;

      if (totalMiles > 0 && rate > 0) {
        rpmEl.value = (rate / totalMiles).toFixed(2);
      }
      triggerCalculate();
    });

    // Cuando cambian las millas → actualiza Rate/RPM
    loadedMilesEl.addEventListener("input", () => {
      const { loadedMiles, totalMiles } = updateTotalMiles();

      if (totalMiles > 0) {
        const rpm = parseFloat(rpmEl.value) || 0;
        const rate = parseFloat(rateEl.value) || 0;

        if (rpm > 0) {
          rateEl.value = (rpm * totalMiles).toFixed(2);
        } else if (rate > 0) {
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

//  FUNCIÓN: Actualizar resultados principales
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
    estimatedTime: calcularTiempoReal(data.totalMiles).formato,
    fuelStops: calcularTiempoReal(data.totalMiles).paradas.toString(),
    tripDays: Math.ceil(calcularTiempoReal(data.totalMiles).horasTotal / 11).toString()
  };

  Object.entries(updates).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  updateProfitabilityStatus(data.margin);
}

//  FUNCIÓN: Panel de decisión con header dinámico
function showDecisionPanel(calculationData = {}) {
  const panel = document.getElementById('decisionPanel');
  console.log('[DEBUG showDecisionPanel] Panel element:', panel);
  console.log('[DEBUG showDecisionPanel] calculationData:', calculationData);
  if (!panel) {
    console.warn("Panel de decisión no encontrado");
    return;
  }

  const {
    totalCharge = 0,
    netProfit = 0,
    totalMiles = 0,
    actualRPM = 0,
    profitMargin = 0,
    profitPerMile = 0,
    origin = '',
    destination = '',
    originState = '',
    destinationState = ''
  } = calculationData;

  // Calcular margin si viene como profitMargin
  const margin = profitMargin || (totalCharge > 0 ? (netProfit / totalCharge) * 100 : 0);

  // ========== DETERMINAR DECISIÓN ==========
  let decision = 'EVALUAR';
  let decisionClasses = ['decision-header-warning'];
  let decisionIcon = '⚠️';
  let profitClass = 'profit-section-warning';

  // Clasificar zonas
  let zonaOrigen = '';
  let zonaDestino = '';
  if (typeof window.clasificarZonaReal === 'function') {
    zonaOrigen = window.clasificarZonaReal(originState);
    zonaDestino = window.clasificarZonaReal(destinationState);
  }

  // Usar la función getDecisionInteligente que ya tiene todas las reglas
  const decisionData = typeof window.getDecisionInteligente === 'function'
    ? window.getDecisionInteligente(actualRPM, totalMiles, {
      zonaOrigen,
      zonaDestino,
      origenState: originState,
      destinoState: destinationState
    })
    : null;

  // Aplicar decisión según el resultado
  if (decisionData) {
    if (decisionData.level === 'accept') {
      decision = 'ACEPTAR';
      decisionClasses = ['decision-header-accept', 'pulse-glow-green'];
      decisionIcon = '✅';
      profitClass = 'profit-section-positive';
    } else if (decisionData.level === 'reject') {
      decision = 'NO ACEPTAR';
      decisionClasses = ['decision-header-reject'];
      decisionIcon = '❌';
      profitClass = 'profit-section-negative';
    } else {
      decision = 'EVALUAR';
      decisionClasses = ['decision-header-warning'];
      decisionIcon = '⚠️';
      profitClass = 'profit-section-warning';
    }
  } else {
    // Fallback si no existe la función
    decision = 'EVALUAR';
    decisionClasses = ['decision-header-warning'];
    decisionIcon = '⚠️';
    profitClass = 'profit-section-warning';
  }
  // ========== ACTUALIZAR HEADER ==========
  const header = document.getElementById('decisionHeader');
  if (header) {
    header.className = 'p-4 md:p-5';
    decisionClasses.forEach(cls => header.classList.add(cls));
  }

  const titleEl = document.getElementById('decisionTitle');
  const routeEl = document.getElementById('decisionRoute');
  const iconEl = document.getElementById('decisionIcon');

  if (titleEl) titleEl.textContent = decision;
  if (iconEl) iconEl.textContent = decisionIcon;
  if (routeEl && origin && destination) {
    routeEl.textContent = `${origin} → ${destination} • ${totalMiles.toFixed(0)} mi`;
  }

  // ========== ACTUALIZAR MÉTRICAS ==========
  const quickPrice = document.getElementById('quickPrice');
  const quickRPM = document.getElementById('quickRPM');
  const quickNetProfit = document.getElementById('quickNetProfit');
  const quickMargin = document.getElementById('quickMargin');
  const quickProfitPerMile = document.getElementById('quickProfitPerMile');

  if (quickPrice) quickPrice.textContent = `$${Math.round(totalCharge).toLocaleString()}`;
  if (quickRPM) quickRPM.textContent = `$${actualRPM.toFixed(2)}`;
  if (quickNetProfit) quickNetProfit.textContent = `$${Math.round(netProfit).toLocaleString()}`;
  if (quickMargin) quickMargin.textContent = `${margin.toFixed(1)}%`;
  if (quickProfitPerMile) quickProfitPerMile.textContent = `$${profitPerMile.toFixed(2)}`;

  // ========== CREAR BADGES DINÁMICOS ==========
  const badgesContainer = document.getElementById('decisionBadges');
  if (badgesContainer) {
    let badgesHTML = '';

    // Badge de zonas
    if (zonaOrigen && zonaDestino) {
      const zonaColor = (zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') &&
        (zonaDestino === 'CORE_MIDWEST' || zonaDestino === 'EXTENDED_MIDWEST')
        ? 'bg-green-600/30 border border-green-400/40'
        : zonaDestino === 'TRAP' ? 'bg-red-900/30 border border-red-400/40' : '';

      const getShort = (z) => z === 'CORE_MIDWEST' ? 'Core' : z === 'EXTENDED_MIDWEST' ? 'Ext' : z === 'TRAP' ? 'TRAP' : '?';
      badgesHTML += `<span class="${zonaColor} px-2 md:px-3 py-1 rounded-full backdrop-blur whitespace-nowrap">🎯 ${getShort(zonaOrigen)} → ${getShort(zonaDestino)}</span>`;
    }

    // Badge de tiempo estimado - use real duration from Google Maps if available
    let estimatedTime;
    if (window.routeDuration && window.routeDuration.hours !== undefined) {
      // Use real duration from Google Maps
      estimatedTime = `${window.routeDuration.hours}h ${window.routeDuration.minutes}m`;
    } else {
      // Fallback to estimation if not available
      estimatedTime = totalMiles > 0 ? `${Math.floor(totalMiles / 50)}h ${Math.round((totalMiles / 50 % 1) * 60)}m` : '0h';
    }
    badgesHTML += `<span class="px-2 md:px-3 py-1 rounded-full backdrop-blur whitespace-nowrap">⏱️ ${estimatedTime}</span>`;

    // Badge de clima (se actualizará con API) - ESTILO DISTINTIVO CON !important
    badgesHTML += `<span id="weatherBadge" class="px-3 py-1.5 rounded-full font-semibold whitespace-nowrap cursor-pointer" onclick="showWeatherModal('${destination}')" style="background: linear-gradient(to right, #38bdf8, #3b82f6) !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 2px solid rgba(255,255,255,0.5); text-shadow: 0 1px 2px rgba(0,0,0,0.2);">🌤️ Cargando...</span>`;

    badgesContainer.innerHTML = badgesHTML;
  }

  // ========== ACTUALIZAR COSTOS ==========
  const fuelCost = totalMiles * TU_COSTO_REAL.combustible;
  const tolls = Number(document.getElementById('tolls')?.value || 0);
  const others = Number(document.getElementById('otherCosts')?.value || 0);

  if (document.getElementById('totalMilesForFuel')) {
    document.getElementById('totalMilesForFuel').textContent = totalMiles.toFixed(0);
  }
  if (document.getElementById('fuelCost')) {
    document.getElementById('fuelCost').textContent = `$${fuelCost.toFixed(2)}`;
  }
  if (document.getElementById('tollsAndOthers')) {
    document.getElementById('tollsAndOthers').textContent = `$${(tolls + others).toFixed(2)}`;
  }

  const fixedCostsValue = totalMiles * (TU_COSTO_REAL.mantenimiento + TU_COSTO_REAL.comida + TU_COSTO_REAL.costosFijos);
  if (document.getElementById('fixedCosts')) {
    document.getElementById('fixedCosts').textContent = `$${fixedCostsValue.toFixed(2)}`;
  }

  const totalExp = fuelCost + tolls + others + fixedCostsValue;
  if (document.getElementById('totalExpenses')) {
    document.getElementById('totalExpenses').textContent = `$${totalExp.toFixed(2)}`;
  }

  // ========== ACTUALIZAR GANANCIA ==========
  const profitSection = document.getElementById('profitSection');
  if (profitSection) {
    profitSection.className = 'border-2 rounded-lg p-3 md:p-4';
    profitSection.classList.add(profitClass);
  }

  if (document.getElementById('profitLabel')) {
    document.getElementById('profitLabel').textContent = netProfit >= 0 ? '💰 Ganancia Neta' : '💀 Pérdida Neta';
  }

  if (document.getElementById('netProfit')) {
    document.getElementById('netProfit').textContent = netProfit >= 0
      ? `$${netProfit.toFixed(2)}`
      : `-$${Math.abs(netProfit).toFixed(2)}`;
  }

  if (document.getElementById('profitDetails')) {
    document.getElementById('profitDetails').textContent = `$${profitPerMile.toFixed(2)}/mi • ${margin.toFixed(1)}% margen`;
  }

  // Tiempo y paradas - use real duration from Google Maps if available
  let estimatedTime;
  if (window.routeDuration && window.routeDuration.hours !== undefined) {
    // Use real duration from Google Maps
    estimatedTime = `${window.routeDuration.hours}h ${window.routeDuration.minutes}m`;
  } else {
    // Fallback to estimation if not available
    estimatedTime = totalMiles > 0 ? `${Math.floor(totalMiles / 50)}h ${Math.round((totalMiles / 50 % 1) * 60)}m` : '0h';
  }
  const fuelStops = Math.ceil(totalMiles / 300);

  if (document.getElementById('estimatedTimeShort')) {
    document.getElementById('estimatedTimeShort').textContent = `⏱️ ${estimatedTime}`;
  }

  if (document.getElementById('fuelStopsShort')) {
    document.getElementById('fuelStopsShort').textContent = `⛽ ${fuelStops} paradas`;
  }

  // Mostrar panel
  panel.classList.remove('hidden');

  debugLog(`✅ Panel mostrado: ${decision} - RPM $${actualRPM.toFixed(2)}/mi - Ganancia $${Math.round(netProfit)}`);

  // Obtener clima del destino (async)
  if (destination && typeof window.getWeatherForDestination === 'function') {
    window.getWeatherForDestination(destination).then(weather => {
      const weatherBadge = document.getElementById('weatherBadge');
      if (weatherBadge && weather) {
        weatherBadge.textContent = weather.text;
        // Mantener estilo azul siempre - usar style para forzar
        weatherBadge.style.cssText = 'background: linear-gradient(to right, #38bdf8, #3b82f6) !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 2px solid rgba(255,255,255,0.5); text-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 0.375rem 0.75rem; border-radius: 9999px; font-weight: 600; white-space: nowrap; cursor: pointer;';
        // Actualizar onclick con destino correcto
        weatherBadge.onclick = () => showWeatherModal(destination, origin);
      }
    }).catch(error => {
      console.error('Error clima:', error);
      const weatherBadge = document.getElementById('weatherBadge');
      if (weatherBadge) {
        weatherBadge.textContent = '🌤️ No disponible';
      }
    });
  }
}

//  Exponer globalmente
window.calculate = calculate;

//  Inicializar cuando cargue la página
document.addEventListener("DOMContentLoaded", () => {
  initializeOnce('calculator-sync-rate-rpm', syncRateAndRpm);

  // 🎯 FIX: Auto-calculate when RPM or Rate changes
  initializeOnce('calculator-rpm-rate-listeners', () => {
    const rpmField = document.getElementById('rpm');
    const rateField = document.getElementById('rate');

    if (rpmField) {
      rpmField.addEventListener('input', () => {
        debugLog('[RPM Field] Value changed, triggering calculate()');
        if (typeof calculate === 'function') calculate();
      });
    }

    if (rateField) {
      rateField.addEventListener('input', () => {
        debugLog('[Rate Field] Value changed, triggering calculate()');
        if (typeof calculate === 'function') calculate();
      });
    }

    debugLog('✅ RPM/Rate auto-calculate listeners configured');
  });
});


//  Exponer globalmente (importante para que funcione oninput="...")
window.showDestinationNotes = showDestinationNotes;

// ========================================
//  MANTENER TODAS LAS FUNCIONES EXISTENTES
// ========================================

//  FUNCION: Copiar precio al portapapeles (MANTENER)
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

  // Obtener clima del destino (async)
  if (destination && typeof window.getWeatherForDestination === 'function') {
    window.getWeatherForDestination(destination).then(weather => {
      const weatherBadge = document.getElementById('weatherBadge');
      if (weatherBadge && weather) {
        weatherBadge.textContent = weather.text;
        // Mantener estilo azul siempre
        weatherBadge.style.cssText = 'background: linear-gradient(to right, #38bdf8, #3b82f6) !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 2px solid rgba(255,255,255,0.5); text-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 0.375rem 0.75rem; border-radius: 9999px; font-weight: 600; white-space: nowrap; cursor: pointer;';
      }
    });
  }
}

//  FUNCION: Aceptar y guardar automaticamente (MANTENER)
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
    console.warn("Función saveLoad no disponible");
    alert("No se puede guardar la carga en este momento. Revisa la sesión e inténtalo de nuevo.");
  }
}

//  FUNCION: Ocultar panel de decision (MANTENER)
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

    //  Manejo de fechas
    let loadDate;
    try {
      const dateInputEl = document.getElementById('dateInput');
      const editDateEl = document.getElementById('editDate');

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
      console.warn(" No se encontro campo de fecha, usando hoy:", err);
      loadDate = getTodayDateString();
    }

    // Nuevos campos de pago (usando la fecha REAL de la carga)
    const paymentStatus = 'pending';
    const expectedPaymentDate = calculatePaymentDate(loadDate);
    const actualPaymentDate = null;
    const companyName = document.getElementById('companyName')?.value?.trim() || '';
    const notes = document.getElementById('notes')?.value?.trim() || '';


    // Validaciones
    if (!origin || !destination) throw new Error('Origen y destino son requeridos');

    if (!origin || !destination) {
      throw new Error('Pon origen y destino para guardar la carga 📍');
    }

    if (
      loadedMiles === "" || isNaN(loadedMiles) || loadedMiles <= 0 ||
      deadheadMiles === "" || isNaN(deadheadMiles) || deadheadMiles < 0 ||
      rpm === "" || isNaN(rpm) || rpm <= 0
    ) {
      throw new Error('Revisa millas cargadas, deadhead y RPM antes de guardar ✅');
    }



    // Calculos
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

    // NUEVO: Actualizar perfil de Lex con la nueva carga
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
    window.showMessage?.('Error al guardar la carga: ' + error.message, 'error');
  }

}




function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  } else {
    alert('⚠️ ' + message);
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

//  FUNCION: Actualizar estado de rentabilidad (MANTENER)
function updateProfitabilityStatus(margin) {
  const statusEl = document.getElementById('profitabilityStatus');
  if (!statusEl) return;

  let status, className, warning = '';

  if (margin >= 20) {
    status = 'Excelente ganancia 💰';
    className = 'text-green-700 bg-green-100';
  } else if (margin >= 10) {
    status = 'Buena ganancia 👍';
    className = 'text-blue-700 bg-blue-100';
  } else if (margin >= 0) {
    status = 'Margen justo ⚠️';
    className = 'text-yellow-700 bg-yellow-100';
    warning = ' · Evalúa el destino';
  } else {
    status = 'Pérdida 🚫';
    className = 'text-red-700 bg-red-100';
    warning = ' · Mejor rechazar';
  }

  statusEl.textContent = status + warning;
  statusEl.className = className;
}


function clearForm() {
  debugLog('Limpiando formulario...');

  const fields = ['origin', 'destination', 'loadedMiles', 'deadheadMiles', 'rpm', 'tolls', 'otherCosts', 'loadNumber', 'companyName', 'notes'];
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const resultIds = ['tripMiles', 'baseIncome', 'additionalCosts', 'totalCharge', 'operatingCost', 'fuelCost', 'maintenanceCost', 'tollsCost', 'otherCost', 'totalExpenses', 'netProfit', 'profitPerMile', 'profitMargin', 'actualRPM', 'tripDays', 'fuelStops', 'estimatedTime', 'profitabilityStatus'];
  resultIds.forEach(function (id) {
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

  // Ocultar tambien el cuadro de notas
  hideNotesBox();

  //IMPORTANTE: Resetear la bandera de Lex para permitir que vuelva a avisar
  lexNotifiedForCurrentCalc = false;
}



// ========================================
//  FUNCIONES DE GOOGLE MAPS (MANTENER TODAS)
// ========================================

//  Variables globales para Google Maps
let googleMap, directionsService, directionsRenderer;

//  FUNCION: Actualizar mapa
function updateMap() {
  //  CRITICAL: Don't override route if sequential destinations are active
  // Check if there are any destination inputs with IDs starting with "dest-"
  const hasSequentialDestinations = document.querySelector('input[id^="dest-"]') !== null;

  if (hasSequentialDestinations) {
    debugLog(" Sequential destinations active, skipping updateMap to preserve multi-waypoint route");
    return;
  }

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

//  FALLBACK para cuando el mapa no este listo
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

//  FUNCION: Abrir Google Maps (MANTENER)
function openGoogleMapsDirections() {
  const origin = document.getElementById('origin').value.trim();
  const destination = document.getElementById('destination').value.trim();

  if (origin && destination) {
    const url = 'https://www.google.com/maps/dir/' + encodeURIComponent(origin) + '/' + encodeURIComponent(destination);
    window.open(url, '_blank');
  }
}

//  FUNCION: Mostrar ruta en mapa
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

      // Calcular distancia automaticamente si est disponible
      const route = result.routes[0];
      const distance = route.legs[0].distance.value * 0.000621371; // metros a millas

      // Actualizar campo de millas si esta vacio
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

//  FUNCION: Calcular distancia automaticamente
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

  // Metodo estandar
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

//  FUNCION: Actualizar total de millas
function updateTotalMiles() {
  const loadedMiles = Number(document.getElementById('loadedMiles')?.value || 0);
  const deadheadMiles = Number(document.getElementById('deadheadMiles')?.value || 0);
  const total = loadedMiles + deadheadMiles;

  const tripMilesEl = document.getElementById('tripMiles');
  if (tripMilesEl) {
    tripMilesEl.textContent = total.toLocaleString();
  }
}

//  FUNCION: Inicializar Google Maps
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

    // Expose globally for sequential-destinations.js
    window.googleMap = googleMap;
    console.log('[MAPS] ✅ window.googleMap set (from calculator.js):', !!window.googleMap);

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

//  FUNCION: Entry point oficial para Google Maps callback
function initMap() {
  debugLog(" initMap() llamado por Google Maps API");
  initGoogleMaps();
}

// Exponer initMap globalmente para el callback de Google Maps
window.initMap = initMap;

//  FUNCION: Configurar autocompletado de Google Places
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

//  FUNCION: Calcular distancia usando valores de inputs ocultos
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



//  FUNCION: Sincronizar vista de rentabilidad
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

document.addEventListener('DOMContentLoaded', function () {
  initializeOnce('calculator-setup-events', function () {
    debugLog(' Calculator integrado cargado - configurando eventos');

    setTimeout(function () {
      // Configurar botones principales
      const calculateBtn = document.getElementById('calculateBtn');
      const saveBtn = document.getElementById('saveBtn');
      const clearBtn = document.getElementById('clearBtn');

      if (calculateBtn) {
        calculateBtn.addEventListener('click', calculate);
        debugLog(' Boton calcular configurado con costos reales');
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', saveLoad);
        debugLog(' Boton guardar configurado');
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
        debugLog(' Boton limpiar configurado');
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
          field.addEventListener('blur', function () {
            if (!this.value.trim()) {
              this.classList.add('border-red-500');
            } else {
              this.classList.remove('border-red-500');
            }
          });
        }
      });

    }, 500);

    // NO configurar autocompletado aqu - se hace automaticamente cuando Google Maps carga via callback

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

//  Cuadro amarillo de informacion rpida (solo contador)
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
    status.textContent = `📝 Tienes ${notes.length} nota(s) guardada(s) para este destino`;
    box.classList.remove("hidden");
  } else {
    status.textContent = "ℹ️ No hay notas para este destino todavía.";
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
      <button
        class="text-blue-600 text-xs"
        onclick="editNote('${doc.id}', '${data.note.replace(/'/g, "\\'")}')"
        title="Editar nota"
      >
        ✏️
      </button>
      <button
        class="text-red-600 text-xs"
        onclick="deleteNote('${doc.id}')"
        title="Eliminar nota"
      >
        🗑️
      </button>
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

//  Añadir nueva nota
async function addNoteToDestination(key) {
  const textarea = document.getElementById("newNoteModalInput");
  const note = textarea.value.trim();
  if (!note) return alert("La nota no puede estar vacía ✍️");

  try {
    const rawDestination = document.getElementById("destination")?.value?.trim() || key;

    await firebase.firestore().collection("notes").add({
      userId: window.currentUser.uid,
      key: normalizeDestination(rawDestination), //  clave uniforme para busquedas
      destination: rawDestination,               //  lo que ves en el input
      note: note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    textarea.value = "";
    openNotesModal(rawDestination);
    showDestinationNotes(rawDestination);
  } catch (error) {
    console.error(" Error guardando nota:", error);
    alert("Ocurrió un problema guardando la nota. Inténtalo de nuevo.");
  }

}

//  Escuchar cambios en el destino (blur + change)
function handleDestinationChange(e) {
  const dest = e.target.value.trim();
  if (dest && dest.length > 3) {
    debugLog(" Detectado destino valido:", dest);
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
  const nuevoTexto = prompt("Editar tu nota:", oldText);
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
    alert("No se pudo eliminar la nota. Inténtalo otra vez.");
  }
}

if (typeof window.refreshLexStateNotes === "function") {
  (async () => {
    try {
      await window.refreshLexStateNotes();
    } catch (e) {
      console.warn("[LEX] Error refrescando stateNotes después de cambiar nota:", e);
    }
  })();
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
  if (ZONAS_AMAR.has(state)) return 'AMARILLA';
  if (ZONAS_ROJAS.has(state)) return 'ROJA';
  return 'DESCONOCIDA';
}
function createZoneBadgeHTML(fx) {
  function zonaClaseTexto(z) {
    switch (z) {
      case 'VERDE': return 'zone-text-green';
      case 'AMARILLA': return 'zone-text-yellow';
      case 'ROJA': return 'zone-text-red';
      default: return 'zone-text-gray';
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
// LEX: Detectar cuando la calculadora esta lista (IDs reales)
// =========================================================
let lexNotifiedForCurrentCalc = false;

function calculatorIsReady() {
  const originEl = document.getElementById('origin');
  const destinationEl = document.getElementById('destination');
  const loadedEl = document.getElementById('loadedMiles');
  const deadheadEl = document.getElementById('deadheadMiles');
  const rpmEl = document.getElementById('rpm');
  const rateEl = document.getElementById('rate');

  // Si algo no existe, no hacemos nada
  if (!originEl || !destinationEl || !loadedEl || !deadheadEl || !rpmEl || !rateEl) {
    console.warn('[LEX] No encontrÃ© uno de los campos de la calculadora');
    return false;
  }

  const origin = originEl.value.trim();
  const destination = destinationEl.value.trim();
  const loadedMiles = Number(loadedEl.value || 0);
  const deadheadMiles = Number(deadheadEl.value || 0);
  const totalMiles = loadedMiles + deadheadMiles;
  const rpm = Number(rpmEl.value || 0);
  const rate = Number(rateEl.value || 0);

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
    const malas = ctx.badZones || [];

    if (malas.includes(destinoEstado)) zonaTipo = 'mala';
    else if (buenas.includes(destinoEstado)) zonaTipo = 'buena';
  }

  lexNotifiedForCurrentCalc = true;

  // 2) Mensajes y tono segun la zona
  let mensajeSorpresa = 'Oye Ricardo… esta carga se ve interesante 🚐';
  let mensajeAlerta = '¿Quieres que la revise por ti? Haz clic en mí 🧠✨';

  if (zonaTipo === 'mala' && destinoEstado) {
    mensajeSorpresa = `Hmm… ${destinoEstado} suele ser complicado para salir 😬`;
    mensajeAlerta = 'Mejor la revisamos bien antes de decir que sí. Haz clic en mí 🧠⚠️';
  } else if (zonaTipo === 'buena' && destinoEstado) {
    mensajeSorpresa = `Oye, ${destinoEstado} suele ser buena zona para ti ✅`;
    mensajeAlerta = 'Si quieres, la analizo y vemos si está a la altura de tus números 📊✨';
  }

  // 3) Cara de sorpresa segun la zona
  const estadoLexInicial = (zonaTipo === 'mala') ? 'warning' : 'surprise';

  window.setLexState(estadoLexInicial, {
    message: mensajeSorpresa,
    duration: 1800
  });

  // 4) DespuÃ©s de la sorpresa, invitacion a analizar + animacion
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

document.addEventListener('DOMContentLoaded', () => {
  initializeOnce('lex-calculator-input-listeners', () => {
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

    debugLog('[LEX] Listeners de calculadora configurados correctamente');
  });
});

// ==========================================================
//  BID CALCULATOR - Estrategia de ofertas en zona trap
// ==========================================================

// Hubs de escape desde zonas trap
const HUBS_ESCAPE = {
  'NV': [
    { ciudad: 'Wichita, KS', distancia: 1400, costo: 350, rating: 5, zona: 'CORE_MIDWEST' },
    { ciudad: 'Oklahoma City, OK', distancia: 1500, costo: 365, rating: 5, zona: 'EXTENDED_MIDWEST' },
    { ciudad: 'Dallas, TX', distancia: 1700, costo: 420, rating: 4, zona: 'EXTENDED_MIDWEST' }
  ],
  'CA': [
    { ciudad: 'Phoenix, AZ', distancia: 400, costo: 150, rating: 2, zona: 'TRAP' },
    { ciudad: 'Albuquerque, NM', distancia: 800, costo: 250, rating: 3, zona: 'TRAP' },
    { ciudad: 'Dallas, TX', distancia: 1400, costo: 350, rating: 4, zona: 'EXTENDED_MIDWEST' }
  ],
  'AZ': [
    { ciudad: 'Dallas, TX', distancia: 1000, costo: 280, rating: 4, zona: 'EXTENDED_MIDWEST' },
    { ciudad: 'Oklahoma City, OK', distancia: 1100, costo: 300, rating: 5, zona: 'EXTENDED_MIDWEST' }
  ],
  'OR': [
    { ciudad: 'Boise, ID', distancia: 400, costo: 150, rating: 2, zona: 'TRAP' },
    { ciudad: 'Salt Lake City, UT', distancia: 700, costo: 220, rating: 3, zona: 'TRAP' },
    { ciudad: 'Denver, CO', distancia: 1200, costo: 320, rating: 3, zona: 'TRAP' }
  ],
  'WA': [
    { ciudad: 'Boise, ID', distancia: 500, costo: 170, rating: 2, zona: 'TRAP' },
    { ciudad: 'Salt Lake City, UT', distancia: 900, costo: 260, rating: 3, zona: 'TRAP' }
  ]
};

/**
 * Calcular oferta estratégica basada en situación actual
 * @param {string} origenState - Estado origen (ej: 'NV')
 * @param {string} destinoState - Estado destino (ej: 'KS')
 * @param {number} millas - Distancia de la carga
 * @param {number} diasEnTrap - Días que llevas en zona trap
 * @param {number} profitAcumulado - Profit generado en la zona trap
 * @returns {object} Recomendación de oferta
 */
function calcularOfertaEstrategica(origenState, destinoState, millas, diasEnTrap = 0, profitAcumulado = 0) {
  const zonaOrigen = clasificarZonaReal(origenState);
  const zonaDestino = clasificarZonaReal(destinoState);

  let resultado = {
    ofertaMinima: 0.60,
    ofertaRecomendada: 0.75,
    ofertaMaxima: 0.90,
    estrategia: 'NORMAL',
    mensaje: '',
    razon: '',
    urgencia: 'BAJA'
  };

  // CASO 1: Sales de TRAP hacia MIDWEST (tu prioridad)
  if (zonaOrigen === 'TRAP' && (zonaDestino === 'CORE_MIDWEST' || zonaDestino === 'EXTENDED_MIDWEST')) {

    // Urgencia según días en trap
    if (diasEnTrap >= 5) {
      resultado.urgencia = 'CRÍTICA';
      resultado.estrategia = 'ESCAPE_AGRESIVO';
      resultado.ofertaMinima = 0.55;
      resultado.ofertaRecomendada = 0.60;
      resultado.ofertaMaxima = 0.70;
      resultado.mensaje = `ESCAPE CRÍTICO - ${diasEnTrap} días en trap`;
      resultado.razon = `Llevas ${diasEnTrap} días en zona trap. Prioridad: SALIR YA.\n` +
        `Has generado $${profitAcumulado} - puedes "gastar" $300-400 en escape.\n` +
        `Oferta agresiva $0.60/mi para competir y SALIR.`;
    } else if (diasEnTrap >= 3) {
      resultado.urgencia = 'ALTA';
      resultado.estrategia = 'ESCAPE_MODERADO';
      resultado.ofertaMinima = 0.60;
      resultado.ofertaRecomendada = 0.65;
      resultado.ofertaMaxima = 0.75;
      resultado.mensaje = `ESCAPE PRIORITARIO - ${diasEnTrap} días en trap`;
      resultado.razon = `${diasEnTrap} días en trap - tiempo de salir.\n` +
        `Oferta $0.65/mi es competitiva y te saca.\n` +
        `Pérdida pequeña (~$200) se recupera en 2 días en Midwest.`;
    } else {
      resultado.urgencia = 'MEDIA';
      resultado.estrategia = 'ESCAPE_SELECTIVO';
      resultado.ofertaMinima = 0.70;
      resultado.ofertaRecomendada = 0.75;
      resultado.ofertaMaxima = 0.85;
      resultado.mensaje = 'ESCAPE SELECTIVO - Buena oportunidad';
      resultado.razon = `Aún estás generando profit en trap.\n` +
        `Oferta $0.75/mi es razonable para salir sin perder mucho.\n` +
        `Solo acepta si quieres reposicionarte al Midwest.`;
    }

    // Ajuste por profit acumulado
    if (profitAcumulado >= 600) {
      resultado.ofertaRecomendada -= 0.05;
      resultado.razon += `\n\nTienes $${profitAcumulado} de colchón - puedes ser más agresivo.`;
    }

  }

  // CASO 2: Sales de TRAP hacia otro TRAP (no recomendado)
  else if (zonaOrigen === 'TRAP' && zonaDestino === 'TRAP') {
    resultado.urgencia = 'BAJA';
    resultado.estrategia = 'EVITAR';
    resultado.ofertaMinima = 1.20;
    resultado.ofertaRecomendada = 1.30;
    resultado.ofertaMaxima = 1.50;
    resultado.mensaje = '⚠️ NO RECOMENDADO - Te mete más profundo';
    resultado.razon = `Te mueves de trap a trap (${origenState} → ${destinoState}).\n` +
      `Solo acepta si RPM es excepcional (>$1.20/mi).\n` +
      `Mejor esperar carga hacia Midwest.`;
  }

  // CASO 3: Dentro de TRAP (movimiento local)
  else if (zonaOrigen === 'TRAP' && origenState === destinoState) {
    resultado.urgencia = 'BAJA';
    resultado.estrategia = 'LOCAL_TRAP';
    resultado.ofertaMinima = 1.15;
    resultado.ofertaRecomendada = 1.25;
    resultado.ofertaMaxima = 1.50;
    resultado.mensaje = 'Movimiento local en trap';
    resultado.razon = `Movimiento dentro de ${origenState}.\n` +
      `Requiere RPM premium ($1.20+) para que valga la pena.\n` +
      `Genera profit mientras esperas escape al Midwest.`;
  }

  // CASO 4: Desde MIDWEST hacia TRAP (trap load)
  else if ((zonaOrigen === 'CORE_MIDWEST' || zonaOrigen === 'EXTENDED_MIDWEST') && zonaDestino === 'TRAP') {
    resultado.urgencia = 'BAJA';
    resultado.estrategia = 'TRAP_LOAD';
    resultado.ofertaMinima = 1.25;
    resultado.ofertaRecomendada = 1.35;
    resultado.ofertaMaxima = 1.50;
    resultado.mensaje = '🚨 TRAP LOAD - Requiere premium';
    resultado.razon = `Te saca del Midwest hacia trap (${destinoState}).\n` +
      `Necesitas $1.25+/mi para compensar costo de regresar.\n` +
      `Mejor: Esperar cargas dentro del Midwest.`;
  }

  return resultado;
}

/**
 * Obtener hubs de escape recomendados desde estado actual
 * @param {string} estadoActual - Estado donde estás (ej: 'NV')
 * @returns {array} Lista de hubs ordenados por rating
 */
function obtenerHubsDeEscape(estadoActual) {
  const hubs = HUBS_ESCAPE[estadoActual] || [];
  return hubs.sort((a, b) => b.rating - a.rating);
}

/**
 * Calcular costo de deadhead a hub específico
 * @param {number} distancia - Distancia en millas
 * @param {number} mpg - Millas por galón (default 17)
 * @param {number} precioGalon - Precio del galón (default 3.00)
 * @returns {object} Desglose de costos
 */
function calcularCostoDeadhead(distancia, mpg = 17, precioGalon = 3.00) {
  const galones = distancia / mpg;
  const combustible = galones * precioGalon;
  const comida = Math.ceil(distancia / 600) * 50; // $50 por día de viaje
  const total = combustible + comida;

  return {
    distancia,
    galones: Math.round(galones),
    combustible: Math.round(combustible),
    comida,
    total: Math.round(total),
    diasViaje: Math.ceil(distancia / 600)
  };
}

// Exportar funciones globalmente
window.calcularOfertaEstrategica = calcularOfertaEstrategica;
window.obtenerHubsDeEscape = obtenerHubsDeEscape;
window.calcularCostoDeadhead = calcularCostoDeadhead;
window.HUBS_ESCAPE = HUBS_ESCAPE;

// ========================================
//  EXPOSICION DE FUNCIONES GLOBALES (MANTENER TODAS)
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

// Funciones del panel de decision
window.showDecisionPanel = showDecisionPanel;
window.hideDecisionPanel = hideDecisionPanel;
window.copyPriceToClipboard = copyPriceToClipboard;
window.acceptAndSave = acceptAndSave;

// Funciones de costos reales (NUEVAS)
window.TU_COSTO_REAL = TU_COSTO_REAL;
window.calcularTiempoReal = calcularTiempoReal;
window.getDecisionInteligente = getDecisionInteligente;
window.detectarFactoresEspeciales = detectarFactoresEspeciales;

// Funciones de deteccion de trap loads (NUEVAS)
window.analizarTrapPenalty = analizarTrapPenalty;
window.clasificarZonaReal = clasificarZonaReal;

// ========================================
//  CLIMA CON RUTA - VERSION SIN CONFLICTOS
//  INSTRUCCIONES: 
//  1. BORRA todo lo que pegaste antes (desde las variables hasta el final)
//  2. PEGA este código AL FINAL de calculator.js (antes del último debugLog)
// ========================================

// Variables para clima modal (nombres únicos)
let weatherModalRouteLoaded = false;
let weatherModalMap = null;
let weatherModalDirections = null;
let weatherModalLayers = {
  temp: null,
  precipitation: null,
  clouds: null,
  wind: null
};

// ========================================
//  FUNCIÓN: Modal de clima MEJORADO - Mobile First
// ========================================
async function showWeatherModal(destination, origin = null) {
  const apiKey = '07e0e0128247442ebd200704250712';
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${destination}&days=3&aqi=no&alerts=yes`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API error');

    const data = await response.json();
    const current = data.current;
    const forecast = data.forecast.forecastday;
    const alerts = data.alerts?.alert || [];
    const originCity = origin || document.getElementById('origin')?.value || '';

    // Determinar color del fondo según temperatura
    const tempF = Math.round(current.temp_f);
    let headerGradient = 'from-blue-500 to-blue-700'; // Normal
    if (tempF <= 32) headerGradient = 'from-blue-800 to-indigo-900'; // Frío
    else if (tempF >= 90) headerGradient = 'from-orange-500 to-red-600'; // Calor
    else if (tempF >= 75) headerGradient = 'from-yellow-500 to-orange-500'; // Cálido

    let modalHTML = `
  <div id="weatherModal" class="fixed inset-0 z-50 overflow-y-auto" style="display: flex; align-items: flex-start; justify-content: center; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); animation: fadeIn 0.3s ease; padding: 1rem;" onclick="if(event.target.id==='weatherModal') { closeWeatherModal(); }">
    
    <!-- Modal Container - Scrollable on mobile -->
    <div class="bg-white shadow-2xl w-full md:max-w-3xl md:rounded-2xl overflow-hidden flex flex-col my-auto" style="animation: slideUp 0.3s ease; max-height: 95vh;" onclick="event.stopPropagation()">
      
      <!-- Header con temperatura - Colores dinámicos -->
      <div class="bg-gradient-to-r ${headerGradient} text-white p-4 md:p-6 md:rounded-t-2xl relative overflow-hidden" style="flex-shrink: 0;">
        <!-- Decoración de fondo -->
        <div class="absolute inset-0 opacity-20">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        <div class="relative z-10">
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-xl md:text-2xl font-bold flex items-center gap-2">
                📍 ${data.location.name}
              </h2>
              <p class="text-white/80 text-sm mt-1">${data.location.region}, ${data.location.country}</p>
              <p class="text-white/60 text-xs mt-1">${new Date().toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            <button onclick="closeWeatherModal()" class="text-white/80 hover:text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition text-xl">&times;</button>
          </div>
          
          <div class="flex items-center gap-4 mt-4">
            <img src="https:${current.condition.icon}" alt="${current.condition.text}" class="w-20 h-20 md:w-24 md:h-24 drop-shadow-lg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
            <div>
              <div class="text-5xl md:text-6xl font-bold">${tempF}°F</div>
              <div class="text-lg text-white/90">${current.condition.text}</div>
              <div class="text-sm text-white/70 mt-1">Sensación: ${Math.round(current.feelslike_f)}°F</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Tabs mejorados -->
      <div class="flex border-b bg-gray-50" style="flex-shrink: 0;">
        <button onclick="switchWeatherTab('current')" id="tabCurrent" class="flex-1 px-4 py-4 text-sm font-bold border-b-3 border-blue-600 text-blue-600 flex items-center justify-center gap-2 transition-all">
          <span class="text-lg">🌤️</span>
          <span class="hidden sm:inline">Clima Actual</span>
          <span class="sm:hidden">Actual</span>
        </button>
        ${originCity ? `
          <button onclick="switchWeatherTab('route')" id="tabRoute" class="flex-1 px-4 py-4 text-sm font-bold border-b-3 border-transparent text-gray-500 hover:text-blue-600 flex items-center justify-center gap-2 transition-all">
            <span class="text-lg">🗺️</span>
            <span class="hidden sm:inline">Ver Ruta</span>
            <span class="sm:hidden">Ruta</span>
          </button>
        ` : ''}
      </div>
      
      <!-- Tab: Clima Actual -->
      <div id="tabContentCurrent" style="flex: 1; overflow-y: auto; min-height: 0;">
        
        <!-- Alertas meteorológicas -->
        ${alerts.length > 0 ? `
          <div class="bg-red-50 border-l-4 border-red-500 p-4 m-4 rounded-r-lg animate-pulse">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-2xl">⚠️</span>
              <h3 class="font-bold text-red-900">Alerta Meteorológica</h3>
            </div>
            <p class="text-sm text-red-800">${alerts[0].headline}</p>
            ${alerts[0].desc ? `<p class="text-xs text-red-700 mt-2 line-clamp-3">${alerts[0].desc.substring(0, 200)}...</p>` : ''}
          </div>
        ` : ''}
        
        <!-- Grid de métricas mejorado -->
        <div class="p-4 bg-gradient-to-b from-gray-50 to-white">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
              <div class="text-2xl mb-1">💨</div>
              <div class="text-xl font-bold text-gray-900">${Math.round(current.wind_mph)} mph</div>
              <div class="text-xs text-gray-500">Viento ${current.wind_dir}</div>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
              <div class="text-2xl mb-1">💧</div>
              <div class="text-xl font-bold text-gray-900">${current.humidity}%</div>
              <div class="text-xs text-gray-500">Humedad</div>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
              <div class="text-2xl mb-1">☀️</div>
              <div class="text-xl font-bold text-gray-900">${current.uv}</div>
              <div class="text-xs text-gray-500">Índice UV</div>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
              <div class="text-2xl mb-1">👁️</div>
              <div class="text-xl font-bold text-gray-900">${current.vis_miles} mi</div>
              <div class="text-xs text-gray-500">Visibilidad</div>
            </div>
          </div>
        </div>
        
        <!-- Pronóstico 3 días mejorado -->
        <div class="p-4">
          <h3 class="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span class="text-xl">📅</span> Pronóstico 3 Días
          </h3>
          <div class="space-y-2">
            ${forecast.map((day, i) => {
      const date = new Date(day.date);
      const dayName = i === 0 ? 'Hoy' : date.toLocaleDateString('es-US', { weekday: 'short' });
      return `
                <div class="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 flex items-center justify-between border border-gray-100 hover:shadow-md transition">
                  <div class="flex items-center gap-3">
                    <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}" class="w-12 h-12">
                    <div>
                      <div class="font-bold text-gray-900">${dayName}</div>
                      <div class="text-sm text-gray-600">${day.day.condition.text}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-lg">
                      <span class="text-red-500">${Math.round(day.day.maxtemp_f)}°</span>
                      <span class="text-gray-400">/</span>
                      <span class="text-blue-500">${Math.round(day.day.mintemp_f)}°</span>
                    </div>
                    <div class="flex gap-2 text-xs mt-1">
                      ${day.day.daily_chance_of_rain > 20 ? `<span class="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🌧️ ${day.day.daily_chance_of_rain}%</span>` : ''}
                      ${day.day.daily_chance_of_snow > 20 ? `<span class="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">❄️ ${day.day.daily_chance_of_snow}%</span>` : ''}
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        </div>
        
        <!-- Botón compartir -->
        <div class="p-4 border-t bg-gray-50">
          <button onclick="shareWeatherInfo('${data.location.name}', ${tempF}, '${current.condition.text}')" class="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
            <span>📤</span> Compartir Pronóstico
          </button>
        </div>
      </div>
      
      <!-- Tab: Ver Ruta (se mantiene igual) -->
      <div id="tabContentRoute" class="hidden" style="flex: 1; overflow-y: auto; min-height: 0;">
        <div class="p-4 space-y-3">
          
          <div id="routeMap" class="w-full rounded-xl bg-gray-200 relative border-2 border-gray-300" style="height: 280px;">
            <div id="mapLoading" class="absolute inset-0 flex items-center justify-center text-gray-600 bg-gray-100 z-10">
              <div class="text-center">
                <div class="text-4xl mb-2 animate-bounce">🗺️</div>
                <div class="text-sm">Cargando mapa...</div>
              </div>
            </div>
          </div>
          
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-blue-900 flex items-center gap-2">
                <span>🌦️</span> Capas de Clima
              </h3>
              <button onclick="clearAllWeatherLayers()" class="text-xs text-red-600 hover:text-red-800 font-semibold px-3 py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition">
                🗑️ Limpiar
              </button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button onclick="toggleWeatherLayer('temp')" id="btnTemp" class="px-3 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm font-semibold hover:border-orange-500 transition hover:shadow-md flex items-center justify-center gap-2">
                <span>🌡️</span> Temp
              </button>
              <button onclick="toggleWeatherLayer('precipitation')" id="btnPrecipitation" class="px-3 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm font-semibold hover:border-blue-500 transition hover:shadow-md flex items-center justify-center gap-2">
                <span>🌧️</span> Lluvia
              </button>
              <button onclick="toggleWeatherLayer('clouds')" id="btnClouds" class="px-3 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm font-semibold hover:border-gray-500 transition hover:shadow-md flex items-center justify-center gap-2">
                <span>☁️</span> Nubes
              </button>
              <button onclick="toggleWeatherLayer('wind')" id="btnWind" class="px-3 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm font-semibold hover:border-green-500 transition hover:shadow-md flex items-center justify-center gap-2">
                <span>💨</span> Viento
              </button>
            </div>
          </div>
          
          <div class="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3">
              <h3 class="font-bold flex items-center gap-2">
                <span>📍</span> Puntos de Control
              </h3>
            </div>
            <div id="waypointWeather" class="p-4 space-y-2">
              <div class="text-center text-gray-500 text-sm py-4 flex items-center justify-center gap-2">
                <span class="animate-spin">⏳</span> Cargando clima en puntos clave...
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
  </div>
  
  <style>
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(20px); opacity: 0; }
    }
  </style>
`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';

    // Restaurar scroll al cerrar modal
    const modal = document.getElementById('weatherModal');
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'weatherModal') {
        document.body.style.overflow = '';
      }
    });

    // Restaurar scroll al cerrar con X
    const closeBtn = modal.querySelector('button');
    closeBtn.addEventListener('click', () => {
      document.body.style.overflow = '';
    });

    if (originCity) {
      window.weatherModalData = {
        origin: originCity,
        destination: destination
      };
    }

  } catch (error) {
    console.error('Error forecast:', error);
    alert('No se pudo obtener el pronóstico del clima');
  }
}

function switchWeatherTab(tab) {
  document.getElementById('tabCurrent').className = tab === 'current'
    ? 'flex-1 px-4 py-3 text-sm font-semibold border-b-2 border-blue-600 text-blue-600'
    : 'flex-1 px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-gray-600 hover:text-blue-600';

  if (document.getElementById('tabRoute')) {
    document.getElementById('tabRoute').className = tab === 'route'
      ? 'flex-1 px-4 py-3 text-sm font-semibold border-b-2 border-blue-600 text-blue-600'
      : 'flex-1 px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-gray-600 hover:text-blue-600';
  }

  // PRIMERO mostrar el tab
  document.getElementById('tabContentCurrent').className = tab === 'current' ? 'flex-1 overflow-y-auto' : 'hidden';
  document.getElementById('tabContentRoute').className = tab === 'route' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden';

  // DESPUÉS cargar el mapa (con más tiempo)
  if (tab === 'route' && !weatherModalRouteLoaded) {
    console.log('🔄 Cargando mapa de ruta...');
    setTimeout(() => {
      loadRouteMapWithWeather();
    }, 300); // Más tiempo para que el DOM se actualice
  }
}

// ========================================
//  MEJORAS: Mapa + Markers + Waypoints Dinámicos
//  INSTRUCCIONES: REEMPLAZA loadRouteMapWithWeather en calculator.js
// ========================================

async function loadRouteMapWithWeather() {
  if (!window.weatherModalData) return;

  const { origin, destination } = window.weatherModalData;
  const mapDiv = document.getElementById('routeMap');

  // Crear mapa
  weatherModalMap = new google.maps.Map(mapDiv, {
    zoom: 6,
    center: { lat: 40.5, lng: -86.5 },
    mapTypeId: 'roadmap'
  });

  const directionsService = new google.maps.DirectionsService();
  weatherModalDirections = new google.maps.DirectionsRenderer({
    map: weatherModalMap,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#ef4444',
      strokeWeight: 7,
      strokeOpacity: 0.9
    }
  });

  const request = {
    origin: origin,
    destination: destination,
    travelMode: 'DRIVING'
  };

  directionsService.route(request, async (result, status) => {
    if (status === 'OK') {
      weatherModalDirections.setDirections(result);

      setTimeout(() => {
        google.maps.event.trigger(weatherModalMap, 'resize');
        weatherModalMap.setCenter({ lat: 40.5, lng: -86.5 });
      }, 500);

      const loading = document.getElementById('mapLoading');
      if (loading) loading.remove();

      const route = result.routes[0];
      const leg = route.legs[0];
      const totalMiles = leg.distance.value * 0.000621371; // metros a millas

      // ✨ CALCULAR WAYPOINTS DINÁMICOS según distancia
      let numWaypoints = 3; // Default
      if (totalMiles >= 900) {
        numWaypoints = 6; // Muy largo
      } else if (totalMiles >= 600) {
        numWaypoints = 5;
      } else if (totalMiles >= 300) {
        numWaypoints = 4;
      }

      console.log(`📏 Distancia: ${totalMiles.toFixed(0)} mi → ${numWaypoints} puntos`);

      // Crear waypoints distribuidos equitativamente
      const waypoints = [];
      const pathLength = route.overview_path.length;

      for (let i = 0; i < numWaypoints; i++) {
        let position, name, type;

        if (i === 0) {
          // Origen
          position = leg.start_location;
          name = origin;
          type = 'origin';
        } else if (i === numWaypoints - 1) {
          // Destino
          position = leg.end_location;
          name = destination;
          type = 'destination';
        } else {
          // Puntos intermedios distribuidos equitativamente
          const fraction = i / (numWaypoints - 1);
          const index = Math.floor(fraction * (pathLength - 1));
          position = route.overview_path[index];
          name = `Punto ${i}`;
          type = 'mid';
        }

        waypoints.push({ position, name, type });
      }

      const waypointContainer = document.getElementById('waypointWeather');
      waypointContainer.innerHTML = `
        <div class="text-sm font-bold text-gray-700 mb-2">
          📍 Clima en Ruta (${totalMiles.toFixed(0)} mi • ${numWaypoints} puntos)
        </div>
      `;

      for (const wp of waypoints) {
        const lat = wp.position.lat();
        const lng = wp.position.lng();

        const weatherData = await getWeatherByCoords(lat, lng);

        if (weatherData) {
          const markerColor = wp.type === 'origin' ? '#f97316' : wp.type === 'destination' ? '#6b7280' : '#3b82f6';

          // ✨ MARKER SOLO CON TEMPERATURA GRANDE (sin círculo)
          const marker = new google.maps.Marker({
            position: wp.position,
            map: weatherModalMap,
            title: `${wp.name}: ${weatherData.temp}°F - ${weatherData.condition}`,
            label: {
              text: `${weatherData.temp}°`,
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 20, // Más grande
              fillColor: markerColor,
              fillOpacity: 0.95,
              strokeColor: 'white',
              strokeWeight: 3
            }
          });

          // Info Window al hacer click
          const infowindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; min-width: 150px;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${wp.name}</div>
                <div style="font-size: 24px; font-weight: bold; color: ${markerColor};">${weatherData.temp}°F</div>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                  ${getWeatherEmoji(weatherData.condition)} ${weatherData.condition}<br>
                  💨 ${weatherData.wind} mph viento
                </div>
              </div>
            `
          });

          marker.addListener('click', () => {
            infowindow.open(weatherModalMap, marker);
          });

          // Lista de ciudades
          const bgColor = wp.type === 'origin' ? 'bg-orange-50 border-orange-300' :
            wp.type === 'destination' ? 'bg-gray-50 border-gray-300' :
              'bg-blue-50 border-blue-300';

          waypointContainer.innerHTML += `
            <div class="${bgColor} rounded-lg p-2 flex items-center justify-between border-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">${getWeatherEmoji(weatherData.condition)}</span>
                <div>
                  <div class="font-semibold text-xs">${wp.name}</div>
                  <div class="text-xs text-gray-600">${weatherData.condition}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xl font-bold" style="color: ${markerColor}">${weatherData.temp}°F</div>
                <div class="text-xs text-gray-600">${weatherData.wind} mph</div>
              </div>
            </div>
          `;
        }
      }

      console.log('✅ Mapa completo con', numWaypoints, 'puntos');

    } else {
      console.error('❌ Error de ruta:', status);
      const loading = document.getElementById('mapLoading');
      if (loading) loading.innerHTML = '<div class="text-center text-red-600">Error cargando ruta: ' + status + '</div>';
    }
  });

  weatherModalRouteLoaded = true;
}
async function getWeatherByCoords(lat, lng) {
  const apiKey = '07e0e0128247442ebd200704250712';
  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lng}&aqi=no`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return {
      temp: Math.round(data.current.temp_f),
      condition: data.current.condition.text,
      wind: Math.round(data.current.wind_mph)
    };
  } catch (error) {
    console.error('Error clima:', error);
    return null;
  }
}

function getWeatherEmoji(condition) {
  const cond = condition.toLowerCase();
  if (cond.includes('snow')) return '❄️';
  if (cond.includes('storm') || cond.includes('thunder')) return '⛈️';
  if (cond.includes('rain')) return '🌧️';
  if (cond.includes('cloud')) return '☁️';
  if (cond.includes('clear') || cond.includes('sunny')) return '☀️';
  return '🌤️';
}

function toggleWeatherLayer(layerType) {
  if (!weatherModalMap) return;

  const OWM_API_KEY = '5d26ae818c1dfb2cc24dec85ccf68338';
  const button = document.getElementById('btn' + layerType.charAt(0).toUpperCase() + layerType.slice(1));

  if (weatherModalLayers[layerType]) {
    // REMOVER CAPA: Encontrar y quitar del array overlayMapTypes
    const index = weatherModalMap.overlayMapTypes.getArray().indexOf(weatherModalLayers[layerType]);
    if (index !== -1) {
      weatherModalMap.overlayMapTypes.removeAt(index);
    }
    weatherModalLayers[layerType] = null;
    button.className = button.className.replace(/border-\w+-500/g, 'border-gray-300').replace('bg-blue-50', '');
    console.log('✅ Capa', layerType, 'removida');
  } else {
    // AGREGAR CAPA
    const layerMap = {
      temp: 'temp_new',
      precipitation: 'precipitation_new',
      clouds: 'clouds_new',
      wind: 'wind_new'
    };

    const colorMap = {
      temp: 'orange',
      precipitation: 'blue',
      clouds: 'gray',
      wind: 'green'
    };

    weatherModalLayers[layerType] = new google.maps.ImageMapType({
      getTileUrl: function (coord, zoom) {
        return `https://tile.openweathermap.org/map/${layerMap[layerType]}/${zoom}/${coord.x}/${coord.y}.png?appid=${OWM_API_KEY}`;
      },
      tileSize: new google.maps.Size(256, 256),
      opacity: 0.75,
      name: layerType
    });

    weatherModalMap.overlayMapTypes.push(weatherModalLayers[layerType]);
    button.className = button.className.replace('border-gray-300', `border-${colorMap[layerType]}-500`) + ' bg-blue-50';
    console.log('✅ Capa', layerType, 'agregada');
  }
}

function clearAllWeatherLayers() {
  if (!weatherModalMap) return;

  Object.keys(weatherModalLayers).forEach(layerType => {
    if (weatherModalLayers[layerType]) {
      // Remover del array overlayMapTypes
      const index = weatherModalMap.overlayMapTypes.getArray().indexOf(weatherModalLayers[layerType]);
      if (index !== -1) {
        weatherModalMap.overlayMapTypes.removeAt(index);
      }
      weatherModalLayers[layerType] = null;

      // Resetear botón
      const button = document.getElementById('btn' + layerType.charAt(0).toUpperCase() + layerType.slice(1));
      if (button) {
        button.className = button.className.replace(/border-\w+-500/g, 'border-gray-300').replace('bg-blue-50', '');
      }
    }
  });
  console.log('🗑️ Todas las capas removidas');
}

// ========================================
// 🎯 MULTI-STOP CALCULATOR Functions
// ========================================
let stopCounter = 0; // Global counter for unique stop IDs
const stopsArray = []; // Array to store stops data

/**
 * Add a new stop card
 */
function addStop() {
  stopCounter++;
  const stopId = `stop-${stopCounter}`;

  const stopCard = document.createElement('div');
  stopCard.id = stopId;
  stopCard.className = 'bg-white border-2 border-purple-200 rounded-lg p-3';
  stopCard.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-bold text-purple-800">📍 Parada ${stopCounter}</span>
      <button type="button" onclick="removeStop('${stopId}')" 
        class="text-red-600 hover:text-red-800 font-bold text-lg px-2">
        ×
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Destino</label>
        <input type="text" id="${stopId}-dest" placeholder="Ej: Chicago, IL"
          class="border border-gray-300 p-2 w-full rounded text-sm stop-input">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Millas</label>
        <input type="number" id="${stopId}-miles" placeholder="280"
          class="border border-gray-300 p-2 w-full rounded text-sm stop-input">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">RPM ($/mi)</label>
        <input type="number" id="${stopId}-rpm" step="0.01" placeholder="1.50"
          class="border border-gray-300 p-2 w-full rounded text-sm stop-input">
      </div>
    </div>
  `;

  const container = document.getElementById('stopsContainer');
  const noStopsMessage = document.getElementById('noStopsMessage');

  // Hide "no stops" message
  if (noStopsMessage) {
    noStopsMessage.classList.add('hidden');
  }

  container.appendChild(stopCard);

  // Add event listeners to recalculate on input
  const inputs = stopCard.querySelectorAll('.stop-input');
  inputs.forEach(input => {
    input.addEventListener('input', calculateFromInputs);
  });

  debugLog(`[MULTI-STOP] Added stop ${stopCounter}`);
}

/**
 * Remove a stop card
 */
function removeStop(stopId) {
  const stopCard = document.getElementById(stopId);
  if (stopCard) {
    stopCard.remove();
    debugLog(`[MULTI-STOP] Removed ${stopId}`);

    // Show "no stops" message if container is empty
    const container = document.getElementById('stopsContainer');
    const remainingStops = container.querySelectorAll('[id^="stop-"]');

    if (remainingStops.length === 0) {
      const noStopsMessage = document.getElementById('noStopsMessage');
      if (noStopsMessage) {
        noStopsMessage.classList.remove('hidden');
      }
    }

    // Recalculate
    calculateFromInputs();
  }
}

/**
 * Get all stops data as array
 */
function getStops() {
  const stops = [];
  const container = document.getElementById('stopsContainer');

  // Return empty array if container doesn't exist (using new sequential destinations system)
  if (!container) {
    return stops;
  }

  const stopCards = container.querySelectorAll('[id^="stop-"]');

  stopCards.forEach(card => {
    const stopId = card.id;
    const destination = sanitizeText(document.getElementById(`${stopId}-dest`)?.value || '');
    const miles = sanitizeNumber(document.getElementById(`${stopId}-miles`)?.value, 0, 10000);
    const rpm = sanitizeNumber(document.getElementById(`${stopId}-rpm`)?.value, 0, 50);

    if (destination && miles > 0 && rpm > 0) {
      stops.push({
        id: stopId,
        destination,
        miles,
        rpm,
        revenue: miles * rpm
      });
    }
  });

  return stops;
}

// Expose functions globally
window.addStop = addStop;
window.removeStop = removeStop;
window.getStops = getStops;

// Exponer funciones
// Función para cerrar modal de clima con animación
function closeWeatherModal() {
  const modal = document.getElementById('weatherModal');
  if (modal) {
    const content = modal.querySelector('.bg-white');
    if (content) {
      content.style.animation = 'slideDown 0.2s ease forwards';
    }
    modal.style.animation = 'fadeIn 0.2s ease reverse forwards';
    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = '';
    }, 200);
  }
}

// Función para compartir pronóstico del clima
function shareWeatherInfo(location, temp, condition) {
  const text = `🌤️ Clima en ${location}: ${temp}°F - ${condition}`;

  if (navigator.share) {
    navigator.share({
      title: 'Pronóstico del Clima',
      text: text,
      url: window.location.href
    }).catch(console.error);
  } else {
    // Fallback: copiar al portapapeles
    navigator.clipboard.writeText(text).then(() => {
      if (typeof showToast === 'function') {
        showToast('📋 Pronóstico copiado al portapapeles', 'success');
      } else {
        alert('Copiado: ' + text);
      }
    }).catch(() => {
      prompt('Copia este texto:', text);
    });
  }
}

window.closeWeatherModal = closeWeatherModal;
window.shareWeatherInfo = shareWeatherInfo;
window.showWeatherModal = showWeatherModal;
window.switchWeatherTab = switchWeatherTab;
window.loadRouteMapWithWeather = loadRouteMapWithWeather;
window.toggleWeatherLayer = toggleWeatherLayer;
window.clearAllWeatherLayers = clearAllWeatherLayers;
window.getWeatherByCoords = getWeatherByCoords;
window.getWeatherEmoji = getWeatherEmoji;

debugLog(' Calculator.js INTEGRADO cargado completamente - Costos reales + Funcionalidad completa');