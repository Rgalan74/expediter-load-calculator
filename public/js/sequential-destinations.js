// 🎯 SEQUENTIAL DESTINATIONS - Google Maps Style
// System for adding destinations sequentially (like stops in a route)

debugLog('[DESTINATIONS] Loading sequential destinations system...');

let destinationCounter = 0;
let destinations = []; // Array to track destination IDs in order
let destinationAutocompletes = {}; // Store autocomplete instances

/**
 * Add a new destination field
 */
function addDestination() {
    destinationCounter++;
    const destId = `dest-${destinationCounter}`;

    const container = document.getElementById('destinationsContainer');
    if (!container) {
        debugLog('[DESTINATIONS] Container not found!');
        return;
    }

    // Create destination field with delete button
    const destDiv = document.createElement('div');
    destDiv.id = destId;
    destDiv.className = 'relative';
    destDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <input type="text" 
                id="${destId}-input" 
                placeholder="Destino ${destinationCounter}"
                class="border p-3 w-full rounded-lg text-base placeholder:text-sm">
            <button type="button" 
                onclick="removeDestination('${destId}')" 
                class="flex-shrink-0 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg p-2 transition"
                title="Eliminar destino">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;

    container.appendChild(destDiv);
    destinations.push(destId);

    debugLog(`[DESTINATIONS] Added destination ${destId}`);

    // Add input event listener so typing (not just autocomplete selection) syncs hidden field
    setTimeout(() => {
        const inputEl = document.getElementById(`${destId}-input`);
        if (inputEl) {
            inputEl.addEventListener('input', handleDestInput);
            debugLog(`[DESTINATIONS] Input listener added for ${destId}`);
        }
        initializeDestinationAutocomplete(destId);
    }, 100);
}

/**
 * Initialize Google autocomplete for a destination field
 */
function initializeDestinationAutocomplete(destId, attempt = 0) {
    const input = document.getElementById(`${destId}-input`);

    if (!input) {
        debugLog(`[DESTINATIONS] Input not found for ${destId}`);
        return;
    }

    // Ya configurado para este mismo campo: no duplicar
    if (destinationAutocompletes[destId] && input.dataset.acReady === '1') return;

    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        // Google Maps carga en segundo plano: reintentar hasta que esté listo (máx. ~60 s)
        if (attempt < 200) {
            setTimeout(() => initializeDestinationAutocomplete(destId, attempt + 1), 300);
        } else {
            debugLog('[DESTINATIONS] Google Maps not loaded');
        }
        return;
    }
    input.dataset.acReady = '1';

    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        componentRestrictions: { country: 'us' }
    });

    destinationAutocompletes[destId] = autocomplete;

    autocomplete.addListener('place_changed', () => {
        debugLog(`[DESTINATIONS] Destination ${destId} changed`);
        updateLastDestination();
        calculateRoute(); // Calculate route when destination changes
    });

    debugLog(`[DESTINATIONS] Autocomplete initialized for ${destId}`);
}

// Helper to handle input changes on any destination field
function handleDestInput() {
    updateLastDestination();
    if (typeof window.triggerCalculate === 'function') window.triggerCalculate();
    else if (typeof window.calculate === 'function') window.calculate();
}

/**
 * Remove a destination field
 */
function removeDestination(destId) {
    // If it's the last remaining destination, just clear its text instead of removing the element
    if (destinations.length <= 1) {
        const input = document.getElementById(`${destId}-input`);
        if (input) input.value = '';
        debugLog(`[DESTINATIONS] Cleared single destination ${destId}`);
        updateLastDestination();
        calculateRoute();
        return;
    }

    const destDiv = document.getElementById(destId);
    if (destDiv) {
        destDiv.remove();
        delete destinationAutocompletes[destId];
        destinations = destinations.filter(id => id !== destId);

        debugLog(`[DESTINATIONS] Removed destination ${destId}`);
        updateLastDestination();
        calculateRoute(); // Recalculate after removal
    }
}

/**
 * Update the hidden "destination" field with the last destination
 * This maintains compatibility with existing code
 */
function updateLastDestination() {
    const hiddenDestField = document.getElementById('destination');
    if (!hiddenDestField) return;

    if (destinations.length === 0) {
        hiddenDestField.value = '';
        return;
    }

    // Get the last destination value
    const lastDestId = destinations[destinations.length - 1];
    const lastInput = document.getElementById(`${lastDestId}-input`);

    if (lastInput) {
        hiddenDestField.value = lastInput.value;
        debugLog(`[DESTINATIONS] Updated last destination: ${lastInput.value}`);
    }
}

/**
 * Get all destinations in order
 */
function getAllDestinations() {
    return destinations.map(destId => {
        const input = document.getElementById(`${destId}-input`);
        return input ? input.value.trim() : '';
    }).filter(Boolean);
}

/**
 * Calculate route using Google Directions API
 */
function calculateRoute() {
    const origin = document.getElementById('origin')?.value?.trim();
    const allDestinations = getAllDestinations();

    // Need at least origin and one destination
    if (!origin || allDestinations.length === 0) {
        debugLog('[DESTINATIONS] Cannot calculate: need origin and at least one destination');
        return;
    }

    if (typeof google === 'undefined' || !google.maps || !google.maps.DirectionsService) {
        debugLog('[DESTINATIONS] Google Maps DirectionsService not available');
        return;
    }

    // Last destination is the final destination
    const finalDestination = allDestinations[allDestinations.length - 1];

    // All other destinations are waypoints
    const waypoints = allDestinations.slice(0, -1).map(loc => ({
        location: loc,
        stopover: true
    }));

    debugLog(`[DESTINATIONS] Calculating route: ${origin} → [${waypoints.length} waypoints] → ${finalDestination}`);

    const directionsService = new google.maps.DirectionsService();

    directionsService.route({
        origin,
        destination: finalDestination,
        waypoints,
        optimizeWaypoints: false, // 🎯 Respect user-defined order exactly
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status === 'OK' && result.routes && result.routes.length > 0) {
            debugLog('[DESTINATIONS] ✅ Route calculated successfully');
            if (result.routes[0].waypoint_order) {
                debugLog('[DESTINATIONS] 📍 Google optimized waypoint order:', result.routes[0].waypoint_order);
            }
            storeRouteTolls(result); // antes del calculo del panel
            updateMileage(result);
            storeRouteStateMiles(origin, finalDestination, result);
            renderMapRoute(result); // Render route on map
        } else {
            window._lastRouteTolls = null;
            debugLog(`[DESTINATIONS] ❌ Route calculation failed: ${status}`);
        }
    });
}

// ============================================================
// BOTON "CALCULAR PEAJE" (aprobado 2026-11-24): Routes API de Google, solo
// cuando el usuario lo pide. Cada consulta se cobra en el nivel Enterprise
// (1,000 gratis al mes), asi que se guarda el resultado por ruta 30 dias y
// hay un tope de 30 consultas al dia por dispositivo.
// ============================================================
const TOLL_CACHE_KEY = 'sls_toll_cache_v1';
const TOLL_CACHE_DAYS = 30;
const TOLL_DAILY_MAX = 30;

function _tollCacheRead() {
    try { return JSON.parse(localStorage.getItem(TOLL_CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function _tollCacheWrite(c) {
    try { localStorage.setItem(TOLL_CACHE_KEY, JSON.stringify(c)); } catch (e) { /* sin localStorage */ }
}

async function calculateRouteTolls() {
    const es = (window.i18n?.currentLang || 'en') === 'es';
    const btn = document.getElementById('calcTollsBtn');
    const msg = document.getElementById('calcTollsMsg');
    const tollsEl = document.getElementById('tolls');
    const say = (texto) => { if (msg) { msg.textContent = texto; msg.style.display = ''; } };
    const origin = document.getElementById('origin')?.value?.trim();
    const dests = getAllDestinations();
    if (!origin || !dests.length) {
        say(es ? 'Primero escribe el origen y el destino.' : 'Enter the origin and destination first.');
        return;
    }
    const key = [origin, ...dests].map(s => s.toLowerCase().replace(/\s+/g, ' ')).join('>');
    const cache = _tollCacheRead();
    const hoy = new Date().toISOString().slice(0, 10);
    const poner = (r, desdeCache) => {
        if (r.amount > 0) {
            tollsEl.value = String(r.amount);
            tollsEl.dispatchEvent(new Event('input', { bubbles: true }));
            tollsEl.dispatchEvent(new Event('change', { bubbles: true }));
            say(es
                ? `Google estima $${r.amount.toFixed(2)} (tarifa de auto, pago en efectivo).${desdeCache ? ' Guardado de una consulta anterior.' : ''} Corrígelo si tu van paga como comercial o tienes E-ZPass.`
                : `Google estimates $${r.amount.toFixed(2)} (car rate, cash).${desdeCache ? ' Saved from an earlier lookup.' : ''} Adjust it if your van pays a commercial rate or you have E-ZPass.`);
        } else if (r.hasTolls) {
            say(es ? 'Google sabe que esta ruta tiene peajes, pero no tiene el monto. Escríbelo tú.' : 'Google knows this route has tolls but has no amount. Enter it yourself.');
        } else {
            say(es ? 'Google no encuentra peajes en esta ruta.' : 'Google finds no tolls on this route.');
        }
    };

    // Resultado guardado de esta misma ruta
    const guardado = cache.routes && cache.routes[key];
    if (guardado && (Date.now() - guardado.ts) < TOLL_CACHE_DAYS * 86400000) {
        poner(guardado, true);
        return;
    }
    // Tope diario por dispositivo
    const usados = cache.day === hoy ? (cache.count || 0) : 0;
    if (usados >= TOLL_DAILY_MAX) {
        say(es ? 'Llegaste al máximo de cálculos de peaje de hoy. Escríbelo a mano.' : 'You reached today\'s toll lookup limit. Enter it manually.');
        return;
    }

    const textoBtn = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = es ? 'Calculando…' : 'Calculating…'; }
    try {
        const { Route } = await google.maps.importLibrary('routes');
        const peticion = {
            origin, destination: dests[dests.length - 1], travelMode: 'DRIVING',
            extraComputations: ['TOLLS'],
            routeModifiers: { vehicleInfo: { emissionType: 'GASOLINE' } },
            fields: ['travelAdvisory']
        };
        if (dests.length > 1) peticion.intermediates = dests.slice(0, -1).map(location => ({ location }));
        const { routes } = await Route.computeRoutes(peticion);
        const info = routes && routes[0] && routes[0].travelAdvisory && routes[0].travelAdvisory.tollInfo;
        const usd = info && (info.estimatedPrices || []).find(p => (p.currencyCode || 'USD') === 'USD');
        const amount = usd ? Math.round((Number(usd.units || 0) + Number(usd.nanos || 0) / 1e9) * 100) / 100 : 0;
        const r = { hasTolls: !!info, amount, ts: Date.now() };
        cache.routes = cache.routes || {};
        cache.routes[key] = r;
        cache.day = hoy;
        cache.count = usados + 1;
        // No dejar crecer el guardado sin limite
        const claves = Object.keys(cache.routes);
        if (claves.length > 200) claves.sort((a, b) => cache.routes[a].ts - cache.routes[b].ts).slice(0, claves.length - 200).forEach(k => delete cache.routes[k]);
        _tollCacheWrite(cache);
        poner(r, false);
    } catch (e) {
        debugLog('[PEAJES] Routes API:', e);
        say(es ? 'No se pudo calcular el peaje ahora. Escríbelo a mano.' : 'Could not calculate the toll right now. Enter it manually.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = textoBtn; }
    }
}
window.calculateRouteTolls = calculateRouteTolls;

// Peajes de la ruta (aprobado 2026-11-24): Google no da el monto en esta ruta,
// pero las instrucciones marcan los tramos "Toll road" / "peaje". Sin costo extra.
function storeRouteTolls(result) {
    try {
        const roads = [];
        let hasTolls = false;
        (result.routes[0].legs || []).forEach(leg => (leg.steps || []).forEach(step => {
            const html = String(step.instructions || '');
            if (!/toll|peaje/i.test(html)) return;
            hasTolls = true;
            const nombres = [...html.matchAll(/<b>([^<]+)<\/b>/g)].map(m => m[1].trim())
                .filter(n => /^(I|US|SR|NJ|NY|PA|FL|IL|IN|OH|MA|TX|CA)[- ]\d|turnpike|tpke|toll|expy|express|pkwy|parkway|bridge|tunnel|puente|túnel|autopista/i.test(n));
            const nombre = nombres[0];
            if (nombre && !roads.includes(nombre)) roads.push(nombre);
        }));
        window._lastRouteTolls = { hasTolls, roads: roads.slice(0, 3) };
    } catch (e) {
        window._lastRouteTolls = null;
    }
}

// Millas por estado de la ruta (avisos "Entering X" de Google) para el precio
// del combustible de la carga. Se guarda con la clave origen|destino final.
function routeKeyForFuel(origin, destination) {
    const norm = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
    return norm(origin) + '|' + norm(destination);
}
window.routeKeyForFuel = routeKeyForFuel;

function storeRouteStateMiles(origin, destination, result) {
    try {
        const F = window.SLSFuelPrices;
        const stateOf = typeof window.getStateFromLocation === 'function' ? window.getStateFromLocation : null;
        window._lastRouteStateMiles = {
            key: routeKeyForFuel(origin, destination),
            miles: F && stateOf ? F.stateMilesFromDirections(result, stateOf) : null
        };
        debugLog('[DESTINATIONS] Millas por estado:', window._lastRouteStateMiles.miles);
    } catch (e) {
        window._lastRouteStateMiles = null;
    }
}

/**
 * Update mileage field with total distance and duration
 */
function updateMileage(directionsResult) {
    let totalMeters = 0;
    let totalSeconds = 0; // 🎯 NEW: Track total duration
    const route = directionsResult.routes[0];

    route.legs.forEach((leg, index) => {
        totalMeters += leg.distance.value;
        totalSeconds += leg.duration.value; // 🎯 NEW: Add duration in seconds
        debugLog(`[DESTINATIONS] Leg ${index + 1}: ${leg.distance.text} (${leg.start_address} → ${leg.end_address})`);
    });

    const totalMiles = Math.round(totalMeters / 1609.34);

    // 🎯 NEW: Store duration for use in decision panel
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    window.routeDuration = { hours, minutes, totalSeconds };
    debugLog(`[DESTINATIONS] ✅ Route duration: ${hours}h ${minutes}m`);

    const milesInput = document.getElementById('loadedMiles');
    if (milesInput) {
        milesInput.value = totalMiles;
        milesInput.dispatchEvent(new Event('input'));
        debugLog(`[DESTINATIONS] ✅ Updated total mileage: ${totalMiles} miles`);
    }
}

/**
 * Render route on map using DirectionsRenderer
 * With retry logic and infinite loop protection
 */
function renderMapRoute(directionsResult, retryCount = 0) {
    const MAX_RETRIES = 3;

    // Check if map is ready
    if (!window.googleMap) {
        if (retryCount >= MAX_RETRIES) {
            debugLog('[DESTINATIONS] ❌ Failed to initialize map after', MAX_RETRIES, 'attempts. Skipping map rendering.');
            debugLog('[DESTINATIONS] Mileage updated but map rendering skipped');
            return;
        }

        // Try to initialize map if function exists and this is first attempt
        if (retryCount === 0 && typeof window.initGoogleMaps === 'function') {
            debugLog('[DESTINATIONS] Map not ready, triggering initialization...');
            window.initGoogleMaps();
        }

        // Retry after delay
        debugLog(`[DESTINATIONS] Waiting for map... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => renderMapRoute(directionsResult, retryCount + 1), 1500);
        return;
    }

    // Map is ready - render route
    if (!window.directionsRenderer) {
        debugLog('[DESTINATIONS] Creating DirectionsRenderer...');
        window.directionsRenderer = new google.maps.DirectionsRenderer({
            map: window.googleMap,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#22D3EE',
                strokeWeight: 4,
                strokeOpacity: 1,
                zIndex: 2
            }
        });
    }

    // Render the route
    window.directionsRenderer.setDirections(directionsResult);

    // Halo brillante bajo la ruta (linea ancha y suave del mismo cian)
    try {
        if (window._slsRouteGlow) window._slsRouteGlow.forEach(l => l.setMap(null));
        const path = directionsResult.routes[0].overview_path;
        window._slsRouteGlow = [
            new google.maps.Polyline({ path, map: window.googleMap, strokeColor: '#22D3EE', strokeOpacity: 0.12, strokeWeight: 16, zIndex: 0, clickable: false }),
            new google.maps.Polyline({ path, map: window.googleMap, strokeColor: '#22D3EE', strokeOpacity: 0.28, strokeWeight: 8, zIndex: 1, clickable: false })
        ];
    } catch (e) { /* el halo es decorativo */ }

    // Fit map bounds to show entire route
    const bounds = new google.maps.LatLngBounds();
    const route = directionsResult.routes[0];

    route.legs.forEach(leg => {
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);
    });

    window.googleMap.fitBounds(bounds);
    debugLog('[DESTINATIONS] ✅ Route rendered on map with proper bounds');
}

/**
 * Reset destinations back to a clean initial state (one empty destination)
 */
function resetDestinations() {
    debugLog('[DESTINATIONS] Resetting destinations...');
    // Remove extra destinations (from index 1 upwards)
    while (destinations.length > 1) {
        const lastId = destinations[destinations.length - 1];
        const destDiv = document.getElementById(lastId);
        if (destDiv) destDiv.remove();
        delete destinationAutocompletes[lastId];
        destinations.pop();
    }
    // Clear first destination
    if (destinations.length > 0) {
        const firstInput = document.getElementById(`${destinations[0]}-input`);
        if (firstInput) firstInput.value = '';
    }
    updateLastDestination();
}

/**
 * Initialize first destination (attaches to static DOM element or adds dynamically)
 */
function initFirstDestination() {
    const existingInput = document.getElementById('dest-1-input');
    if (existingInput) {
        if (!destinations.includes('dest-1')) {
            destinations = ['dest-1'];
            destinationCounter = Math.max(destinationCounter, 1);
        }
        existingInput.removeEventListener('input', handleDestInput);
        existingInput.addEventListener('input', handleDestInput);
        setTimeout(() => initializeDestinationAutocomplete('dest-1'), 100);
        debugLog('[DESTINATIONS] ✅ Attached to existing static dest-1 field');
        return;
    }

    const container = document.getElementById('destinationsContainer');
    if (container && container.children.length === 0) {
        debugLog('[DESTINATIONS] Auto-initializing first destination field');
        addDestination();
    }
}

// Expose functions globally
window.addDestination = addDestination;
window.removeDestination = removeDestination;
window.resetDestinations = resetDestinations;
window.initFirstDestination = initFirstDestination;
window.getAllDestinations = getAllDestinations;
window.calculateRoute = calculateRoute;

// Run initialization immediately or on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirstDestination);
} else {
    initFirstDestination();
}

debugLog('[DESTINATIONS] ✅ Sequential destinations system loaded');
