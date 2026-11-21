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
function initializeDestinationAutocomplete(destId) {
    const input = document.getElementById(`${destId}-input`);

    if (!input) {
        debugLog(`[DESTINATIONS] Input not found for ${destId}`);
        return;
    }

    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        debugLog('[DESTINATIONS] Google Maps not loaded');
        return;
    }

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
            updateMileage(result);
            storeRouteStateMiles(origin, finalDestination, result);
            renderMapRoute(result); // Render route on map
        } else {
            debugLog(`[DESTINATIONS] ❌ Route calculation failed: ${status}`);
        }
    });
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
                strokeColor: '#4285F4',
                strokeWeight: 5
            }
        });
    }

    // Render the route
    window.directionsRenderer.setDirections(directionsResult);

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
