/**
 * calculator-maps.js
 * Google Maps integration for route planning
 * Extracted from calculator.js for lazy loading
 * Version: 1.0.0
 */

// ========================================
// GOOGLE MAPS FUNCTIONS
// ========================================

let googleMap = null;
let directionsService = null;
let directionsRenderer = null;

/**
 * Initialize Google Maps
 */
function initGoogleMaps() {
    try {
        if (typeof google === 'undefined') {
            console.warn("Google Maps API not loaded");
            return;
        }

        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.warn("Map element not found");
            return;
        }

        googleMap = new google.maps.Map(mapElement, {
            zoom: 5,
            center: { lat: 39.8283, lng: -98.5795 },
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            draggable: false,
            panel: null
        });

        directionsRenderer.setMap(googleMap);

        if (typeof window.debugLog === 'function') {
            window.debugLog("✅ Google Maps initialized");
        }

        if (!window.autocompleteConfigured) {
            window.autocompleteConfigured = true;
            setTimeout(setupGoogleAutocomplete, 1000);
        }

    } catch (error) {
        console.error("Error initializing Google Maps:", error);
    }
}

/**
 * Entry point for Google Maps callback
 */
function initMap() {
    if (typeof window.debugLog === 'function') {
        window.debugLog("🗺️ initMap() called by Google Maps API");
    }
    initGoogleMaps();
}

/**
 * Setup Google Places Autocomplete
 */
async function setupGoogleAutocomplete() {
    try {
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            console.warn("Google Places API not available");
            return;
        }

        const originInput = document.getElementById('origin');
        const destinationInput = document.getElementById('destination');

        if (!originInput || !destinationInput) {
            console.warn("Origin/Destination inputs not found");
            return;
        }

        const options = {
            types: ['(cities)'],
            componentRestrictions: { country: 'us' }
        };

        const originAutocomplete = new google.maps.places.Autocomplete(originInput, options);
        const destAutocomplete = new google.maps.places.Autocomplete(destinationInput, options);

        originAutocomplete.addListener('place_changed', () => {
            const place = originAutocomplete.getPlace();
            if (place && place.formatted_address) {
                originInput.value = place.formatted_address;
            }
        });

        destAutocomplete.addListener('place_changed', () => {
            const place = destAutocomplete.getPlace();
            if (place && place.formatted_address) {
                destinationInput.value = place.formatted_address;
            }
        });

        if (typeof window.debugLog === 'function') {
            window.debugLog("✅ Google Autocomplete configured");
        }

    } catch (error) {
        console.error("Error setting up autocomplete:", error);
    }
}

/**
 * Update map with route
 */
function updateMap() {
    const origin = document.getElementById('origin')?.value;
    const destination = document.getElementById('destination')?.value;

    if (!origin || !destination || !directionsService || !directionsRenderer) {
        return;
    }

    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.warn('Directions request failed:', status);
        }
    });
}

/**
 * Show route on map
 */
function showRouteOnMap(origin, destination) {
    if (!googleMap || !directionsService || !directionsRenderer) {
        console.warn('Maps not initialized');
        return;
    }

    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            const route = result.routes[0];
            const leg = route.legs[0];

            if (typeof window.debugLog === 'function') {
                window.debugLog(`🗺️ Route: ${leg.distance.text}, ${leg.duration.text}`);
            }
        }
    });
}

/**
 * Calculate distance automatically
 */
function calculateDistanceAutomatically() {
    const origin = document.getElementById('origin')?.value;
    const destination = document.getElementById('destination')?.value;

    if (!origin || !destination || !directionsService) {
        return;
    }

    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            const route = result.routes[0];
            const leg = route.legs[0];
            const miles = Math.round(leg.distance.value * 0.000621371);

            const loadedMilesInput = document.getElementById('loadedMiles');
            if (loadedMilesInput) {
                loadedMilesInput.value = miles;
                if (typeof window.updateTotalMiles === 'function') {
                    window.updateTotalMiles();
                }
            }
        }
    });
}

/**
 * Open Google Maps Directions
 */
function openGoogleMapsDirections() {
    const origin = document.getElementById('origin')?.value;
    const destination = document.getElementById('destination')?.value;

    if (!origin || !destination) {
        alert('Please enter origin and destination');
        return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    window.open(url, '_blank');
}

// ========================================
// EXPORTS
// ========================================

window.CalculatorMaps = {
    initGoogleMaps,
    initMap,
    setupGoogleAutocomplete,
    updateMap,
    showRouteOnMap,
    calculateDistanceAutomatically,
    openGoogleMapsDirections
};

// Individual exports for compatibility
window.initGoogleMaps = initGoogleMaps;
window.initMap = initMap;
window.setupGoogleAutocomplete = setupGoogleAutocomplete;
window.updateMap = updateMap;
window.showRouteOnMap = showRouteOnMap;
window.calculateDistanceAutomatically = calculateDistanceAutomatically;
window.openGoogleMapsDirections = openGoogleMapsDirections;

console.log('📦 Calculator Maps module loaded successfully');
