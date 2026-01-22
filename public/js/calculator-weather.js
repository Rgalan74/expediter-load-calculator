/**
 * calculator-weather.js
 * Weather and radar functionality for route planning
 * Extracted from calculator.js for lazy loading
 * Version: 1.0.0
 */

// ========================================
//  WEATHER FUNCTIONS
// ========================================

/**
 * Get weather information for a destination
 * @param {string} destination - City, State or location
 * @returns {Object} Weather data with temp, condition, emoji, badge class
 */
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
            badgeClass = 'bg-blue-900/40 border border-blue-400/40';
        } else if (isStorm) {
            badgeClass = 'bg-orange-900/40 border border-orange-400/40';
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

/**
 * Load route map with weather waypoints
 */
async function loadRouteMap() {
    if (!window.weatherModalData) return;

    const { origin, destination } = window.weatherModalData;

    // Inicializar mapa
    const mapDiv = document.getElementById('routeMap');
    const map = new google.maps.Map(mapDiv, {
        zoom: 6,
        center: { lat: 39.8, lng: -86.1 },
        mapTypeId: 'roadmap'
    });

    // Directions Service
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true
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

/**
 * Get weather icon marker for Google Maps
 */
function getWeatherMarkerIcon(temp, condition) {
    let color = '#3b82f6';

    if (temp <= 32 || condition.toLowerCase().includes('snow')) {
        color = '#60a5fa';
    } else if (condition.toLowerCase().includes('rain') || condition.toLowerCase().includes('storm')) {
        color = '#6366f1';
    } else if (temp >= 80) {
        color = '#f59e0b';
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

/**
 * Toggle radar layer on route map
 */
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
        // Agregar radar de RainView

        er
        fetch('https://api.rainviewer.com/public/weather-maps.json')
            .then(response => response.json())
            .then(data => {
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

/**
 * Get weather emoji based on condition
 */
function getWeatherEmoji(condition) {
    const cond = condition.toLowerCase();
    if (cond.includes('snow')) return '❄️';
    if (cond.includes('storm') || cond.includes('thunder')) return '⛈️';
    if (cond.includes('rain')) return '🌧️';
    if (cond.includes('cloud')) return '☁️';
    if (cond.includes('clear') || cond.includes('sunny')) return '☀️';
    return '🌤️';
}

/**
 * Get weather by coordinates
 */
async function getWeatherByCoords(lat, lng) {
    const apiKey = '07e0e0128247442ebd200704250712';
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lng}&aqi=no`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API error');

        const data = await response.json();
        return {
            temp: Math.round(data.current.temp_f),
            condition: data.current.condition.text,
            wind: Math.round(data.current.wind_mph)
        };
    } catch (error) {
        console.warn('Error getting weather by coords:', error);
        return null;
    }
}

/**
 * Switch weather tabs (if modal has tabs)
 */
function switchWeatherTab(tabName) {
    // Implementation depends on your modal structure
    console.log('Switching to weather tab:', tabName);
}

// ========================================
// EXPORTS
// ========================================

window.CalculatorWeather = {
    getWeatherForDestination,
    loadRouteMap,
    getWeatherMarkerIcon,
    toggleRadarLayer,
    getWeatherEmoji,
    getWeatherByCoords,
    switchWeatherTab
};

// Individual exports for compatibility
window.getWeatherForDestination = getWeatherForDestination;
window.loadRouteMap = loadRouteMap;
window.getWeatherMarkerIcon = getWeatherMarkerIcon;
window.toggleRadarLayer = toggleRadarLayer;
window.getWeatherEmoji = getWeatherEmoji;
window.getWeatherByCoords = getWeatherByCoords;
window.switchWeatherTab = switchWeatherTab;

console.log('📦 Calculator Weather module loaded successfully');
