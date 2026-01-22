//  zones.js - VERSIN COMPLETAMENTE CORREGIDA

// Variables globales
let rpmPorEstado = {};
let resumenPorEstado = {};
let zonesDataLoaded = false;
let currentZoneSort = { column: '', asc: true };


// ✅ USAR getStateCode de helpers.js (es global)
// La función ya está disponible globalmente desde helpers.js
// No necesitamos duplicar el código aquí

// Si necesitas funcionalidad específica de zones, agrega aquí
// pero para el caso general, usa window.getStateCode() de helpers.js

// Funcin principal para cargar datos de zonas
function loadZonesData() {
    if (zonesDataLoaded) {
        debugLog(" Zones data already loaded, skipping");
        return;
    }

    if (!window.currentUser) {
        debugLog(" No user logged in for zones");
        showZonesEmpty("Debe iniciar sesin para ver las zonas");
        return;
    }

    showZonesLoading();

    firebase.firestore()
        .collection("loads")
        .where("userId", "==", window.currentUser.uid)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                showZonesEmpty("No hay cargas para analizar zonas");
                return;
            }

            const loads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            calcularEstadisticas(loads);
            renderZonesTable();
            initializeMap();
            // Inicializar mapa de ciudades
            initializeCitiesMap();
            loadCitiesData();

            // Configurar layout responsivo despus de que carga el mapa
            setTimeout(() => {
                setupResponsiveMapLayout();
            }, 500);

            zonesDataLoaded = true;
        })
        .catch(error => {
            console.error(" Error loading zones data:", error);
            showZonesError("Error cargando datos: " + error.message);
            if (window.showToast) {
                showToast('Error al cargar zonas: ' + error.message, 'error');
            }
        });
}

// Calcular estadísticas por estado
function calcularEstadisticas(loads) {
    rpmPorEstado = {};
    resumenPorEstado = {};

    loads.forEach(load => {
        const originCode = window.getStateCode(load.origin);
        const destCode = window.getStateCode(load.destination);
        let rpm = parseFloat(load.rpm);
        const profit = parseFloat(load.profit || 0);
        const miles = parseFloat(load.totalMiles || 0);
        const revenue = parseFloat(load.totalCharge || 0);

        if ((isNaN(rpm) || rpm === 0) && load.totalCharge && load.totalMiles) {
            rpm = parseFloat(load.totalCharge) / parseFloat(load.totalMiles);
        }

        if (!originCode || isNaN(rpm)) return;

        // ✅ Acumular RPM para el mapa y la tabla
        if (!rpmPorEstado[originCode]) rpmPorEstado[originCode] = { total: 0, count: 0 };
        rpmPorEstado[originCode].total += rpm;
        rpmPorEstado[originCode].count++;

        if (!resumenPorEstado[destCode]) {
            resumenPorEstado[destCode] = {
                count: 0,
                totalProfit: 0,
                totalMiles: 0,
                totalRevenue: 0
            };
        }
        if (!resumenPorEstado[originCode]) {
            resumenPorEstado[originCode] = {
                count: 0,
                totalProfit: 0,
                totalMiles: 0,
                totalRevenue: 0
            };
        }

        resumenPorEstado[destCode].count++;
        resumenPorEstado[destCode].totalProfit += isNaN(profit) ? 0 : profit;
        resumenPorEstado[destCode].totalMiles += isNaN(miles) ? 0 : miles;
        resumenPorEstado[destCode].totalRevenue += isNaN(revenue) ? 0 : revenue;

        resumenPorEstado[originCode].count++;
        resumenPorEstado[originCode].totalProfit += isNaN(profit) ? 0 : profit;
        resumenPorEstado[originCode].totalMiles += isNaN(miles) ? 0 : miles;
        resumenPorEstado[originCode].totalRevenue += isNaN(revenue) ? 0 : revenue;
    });

    // ✅ Calcular promedio de RPM
    Object.keys(rpmPorEstado).forEach(code => {
        const data = rpmPorEstado[code];
        rpmPorEstado[code] = data.total / data.count;
    });

    // 🔥 ESTA LÍNEA ES LA CLAVE
    return resumenPorEstado;
}


// Renderizar tabla de zonas
function renderZonesTable() {
    const body = document.getElementById("zoneDataBody");
    if (!body) return;

    body.innerHTML = "";

    const rows = Object.entries(resumenPorEstado).map(([state, stats]) => {
        const avgRpm = rpmPorEstado[state] || 0;
        const label = avgRpm < 0.75 ? "Zona roja" : avgRpm < 1.05 ? "Zona amarilla" : "Zona verde";
        const zoneClass = avgRpm < 0.75 ? "zone-red" : avgRpm < 1.05 ? "zone-yellow" : "zone-green";

        return {
            state,
            label,
            zoneClass,
            count: stats.count,
            avgRpm,
            profit: stats.totalProfit
        };
    });

    if (currentZoneSort.column) {
        const { column, asc } = currentZoneSort;
        rows.sort((a, b) => {
            if (column === 'state') return asc ? a.state.localeCompare(b.state) : b.state.localeCompare(a.state);
            return asc ? a[column] - b[column] : b[column] - a[column];
        });
    }

    rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.className = `${row.zoneClass} border-b`;

        tr.innerHTML = `
            <td class="p-2 font-bold">${row.state}</td>
            <td class="p-2">${row.label}</td>
            <td class="p-2">${row.count}</td>
            <td class="p-2">$${row.avgRpm.toFixed(2)}</td>
            <td class="p-2 ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}">$${row.profit.toFixed(2)}</td>
            <td class="p-2">
                <div class="h-2 w-full bg-gray-200 rounded">
                    <div class="h-2 rounded ${row.avgRpm >= 1.05 ? 'bg-green-500' : row.avgRpm >= 0.75 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: ${Math.max(8, Math.min((row.avgRpm / 2) * 100, 100))}%"></div>
                </div>
            </td>
        `;

        body.appendChild(tr);
    });
}

// Funcin initializeMap mejorada con hover
function initializeMap() {
    const mapObject = document.getElementById("interactiveMap");
    if (!mapObject) return;

    if (mapObject.contentDocument) {
        pintarEstados(mapObject.contentDocument);
        setupMapInteractivity(mapObject.contentDocument);
    } else {
        mapObject.addEventListener("load", () => {
            pintarEstados(mapObject.contentDocument);
            setupMapInteractivity(mapObject.contentDocument);
        }, { once: true });
    }
}

// Nueva funcin para configurar interactividad
function setupMapInteractivity(svgDoc) {
    if (!svgDoc) return;

    // Crear panel de informacin si no existe
    setupInfoPanel();

    // Configurar hover para cada estado con datos
    Object.keys(rpmPorEstado).forEach(stateCode => {
        const stateElement = svgDoc.getElementById(stateCode);

        if (stateElement) {
            const rpm = rpmPorEstado[stateCode];
            const resumen = resumenPorEstado[stateCode];

            // Configurar cursor
            stateElement.style.cursor = 'pointer';

            // Event listeners
            stateElement.addEventListener('mouseenter', function () {
                debugLog(` Hover en ${stateCode}`);
                this.style.stroke = '#1f2937';
                this.style.strokeWidth = '3';
                showStateInfo(stateCode, rpm, resumen);
            });

            stateElement.addEventListener('mouseleave', function () {
                this.style.strokeWidth = '1';
                this.style.stroke = '#374151';
            });

            stateElement.addEventListener('click', function () {
                debugLog(` Click en ${stateCode}`);
                showStateInfo(stateCode, rpm, resumen, true);
            });
        }
    });

    debugLog(" Interactividad del mapa configurada");
}

// Funcin para crear panel de informacin
function setupInfoPanel() {
    let infoPanel = document.getElementById('stateInfoPanel');

    if (!infoPanel) {
        const mapObject = document.getElementById('interactiveMap');
        const sidebar = mapObject.parentElement.parentElement.children[1];

        if (sidebar) {
            infoPanel = document.createElement('div');
            infoPanel.id = 'stateInfoPanel';
            infoPanel.className = 'mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm';
            infoPanel.innerHTML = `
                <h4 class="font-semibold text-lg mb-3 text-gray-800"> Informacin del Estado</h4>
                <div id="stateDetails" class="text-gray-500 text-center">
                    <p class="text-sm">Pasa el cursor sobre un estado para ver detalles</p>
                </div>
            `;
            sidebar.appendChild(infoPanel);
        }
    }
}

// Funcin para mostrar informacin del estado
function showStateInfo(stateCode, rpm, resumen, isClick = false) {
    const detailsDiv = document.getElementById('stateDetails');
    if (!detailsDiv) return;

    const zoneLabel = rpm >= 1.05 ? 'Zona Verde' : rpm >= 0.75 ? 'Zona Amarilla' : 'Zona Roja';
    const zoneColor = rpm >= 1.05 ? 'text-green-600' : rpm >= 0.75 ? 'text-yellow-600' : 'text-red-600';
    const zoneIcon = rpm >= 1.05 ? '' : rpm >= 0.75 ? '' : '';

    detailsDiv.innerHTML = `
        <div class="text-left space-y-3">
            <div class="text-center">
                <h5 class="font-bold text-2xl text-gray-800">${stateCode}</h5>
                <span class="${zoneColor} font-semibold text-lg">${zoneIcon} ${zoneLabel}</span>
            </div>
            
            <div class="bg-gray-50 p-3 rounded space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600 text-sm">RPM Promedio:</span>
                    <span class="font-bold text-blue-600 text-lg">$${rpm.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600 text-sm">Total Cargas:</span>
                    <span class="font-semibold">${resumen?.count || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600 text-sm">Ganancia Total:</span>
                    <span class="font-semibold text-green-600">$${(resumen?.totalProfit || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
}

//  FUNCIN PINTARESTADOS CORREGIDA
function pintarEstados(svgDoc) {
    if (!svgDoc) {
        console.warn(" [ZONES] SVG document no disponible para pintado");
        return;
    }

    debugLog(" [ZONES] Iniciando pintado de estados...");

    // Resetear estilos antes de pintar
    const allElements = svgDoc.querySelectorAll('[id]');
    allElements.forEach(element => {
        element.style.removeProperty('background-color');
        element.style.removeProperty('color');
        element.style.removeProperty('background');
    });

    let statesPainted = 0;

    Object.keys(rpmPorEstado).forEach(stateCode => {
        const element = svgDoc.getElementById(stateCode);
        const rpm = rpmPorEstado[stateCode];

        if (!element || isNaN(rpm)) return;

        let color = rpm < 0.75 ? '#dc2626' : rpm < 1.05 ? '#facc15' : '#16a34a';

        // Aplicar mltiples mtodos
        element.setAttribute('fill', color);
        element.setAttribute('stroke', '#374151');
        element.setAttribute('stroke-width', '1');

        element.style.fill = color;
        element.style.fillOpacity = '0.8';
        element.style.stroke = '#374151';
        element.style.strokeWidth = '1';
        element.style.display = '';
        element.style.visibility = 'visible';
        element.style.opacity = '1';

        statesPainted++;
        debugLog(` ${stateCode}: RPM $${rpm.toFixed(2)} = ${color}`);
    });

    // Forzar refresh del SVG
    const svgElement = svgDoc.documentElement;
    if (svgElement) {
        svgElement.style.display = 'none';
        svgElement.offsetHeight;
        svgElement.style.display = '';
        debugLog(" [ZONES] SVG refresh forzado");
    }

    debugLog(` Estados pintados con colores: ${statesPainted}`);
}

//  FUNCIN LAYOUT RESPONSIVO - VERSIN CORREGIDA PARA MOBILE
function setupResponsiveMapLayout() {
    const mapObject = document.getElementById('interactiveMap');
    if (!mapObject) return;

    const mapContainer = mapObject.parentElement;
    const flexContainer = mapContainer?.parentElement;
    const panelLateral = flexContainer?.children[1];

    debugLog(" Configurando layout responsivo del mapa...");

    if (mapContainer && panelLateral) {
        // Detectar si es mobile
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            debugLog(" Modo mobile detectado - aplicando layout mobile");

            // SOLUCIN FINAL MOBILE
            mapContainer.style.minWidth = 'unset';
            mapContainer.style.width = '100%';
            mapContainer.style.padding = '0.5rem 0';
            mapContainer.style.paddingLeft = '0';
            mapContainer.style.paddingRight = '0';
            mapContainer.style.margin = '0';
            mapContainer.style.marginLeft = '-1rem';
            mapContainer.style.marginRight = '-1rem';

            // Forzar flex-direction column en mobile
            if (flexContainer) {
                flexContainer.style.flexDirection = 'column';
                flexContainer.style.gap = '1rem';
                flexContainer.style.paddingLeft = '0.5rem';
                flexContainer.style.paddingRight = '0.5rem';
            }

            // Mapa responsive en mobile
            mapObject.style.width = '100%';
            mapObject.style.height = '400px';
            mapObject.style.setProperty('height', '400px', 'important');
            mapObject.style.maxWidth = 'none';
            mapObject.style.margin = '0 auto';
            mapObject.style.display = 'block';

            // Panel lateral debajo en mobile
            panelLateral.style.width = '100%';
            panelLateral.style.maxWidth = 'none';
            panelLateral.style.marginTop = '1rem';
            panelLateral.style.order = '2';


        } else {
            debugLog(" Modo desktop detectado - aplicando layout desktop");

            // DESKTOP: Layout original CORREGIDO
            mapContainer.className = mapContainer.className.replace('flex-1', 'flex-[3]');
            mapContainer.style.minWidth = '600px';

            // LIMPIAR estilos mobile que pueden interferir
            mapContainer.style.marginLeft = '';
            mapContainer.style.marginRight = '';
            mapContainer.style.padding = '';
            mapContainer.style.paddingLeft = '';
            mapContainer.style.paddingRight = '';

            // Restaurar estilos desktop originales
            mapContainer.style.padding = '2rem';

            // Configurar el mapa
            mapObject.style.width = '100%';
            mapObject.style.height = '500px';
            mapObject.style.minWidth = '500px';
            mapObject.style.maxWidth = '100%';
            mapObject.style.margin = '';
            mapObject.style.display = '';

            // Configurar panel lateral (25% del espacio)
            panelLateral.style.flex = '1';
            panelLateral.style.maxWidth = '280px';
            panelLateral.style.minWidth = '220px';
            panelLateral.style.width = '';
            panelLateral.style.marginTop = '';
            panelLateral.style.order = '';

            // Limpiar estilos del flex container mobile
            if (flexContainer) {
                flexContainer.style.flexDirection = '';
                flexContainer.style.gap = '';
                flexContainer.style.paddingLeft = '';
                flexContainer.style.paddingRight = '';
            }

            // Responsive para pantallas pequeas (solo desktop)
            const mediaQuery = window.matchMedia('(max-width: 1024px)');
            function handleResponsive(e) {
                if (e.matches) {
                    mapObject.style.height = '400px';
                    mapObject.style.minWidth = '300px';
                    panelLateral.style.maxWidth = 'none';
                } else {
                    mapObject.style.height = '500px';
                    mapObject.style.minWidth = '500px';
                    panelLateral.style.maxWidth = '280px';
                }
            }

            mediaQuery.addListener(handleResponsive);
            handleResponsive(mediaQuery);
        }
        // Event listener para resize MEJORADO
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Volver a aplicar layout segn nuevo tamao
                setupResponsiveMapLayout();
            }, 150);
        };

        // Remover listener anterior si existe
        window.removeEventListener('resize', window.mapResizeHandler);
        window.mapResizeHandler = handleResize;
        window.addEventListener('resize', handleResize);

        debugLog(" Layout responsivo configurado correctamente");
    }
}

// Funciones de ordenamiento
function sortZonesBy(column) {
    if (currentZoneSort.column === column) {
        currentZoneSort.asc = !currentZoneSort.asc;
    } else {
        currentZoneSort.column = column;
        currentZoneSort.asc = true;
    }
    renderZonesTable();
}

// Funciones de estado
function showZonesLoading() {
    const body = document.getElementById("zoneDataBody");
    if (body) {
        body.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Cargando zonas...</td></tr>';
    }
}

function showZonesEmpty(message) {
    const body = document.getElementById("zoneDataBody");
    if (body) {
        body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">${message}</td></tr>`;
    }
}

function showZonesError(message) {
    const body = document.getElementById("zoneDataBody");
    if (body) {
        body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-600"> ${message}</td></tr>`;
    }
}

function retryZones() {
    zonesDataLoaded = false;
    loadZonesData();
}

function resetZonesData() {
    zonesDataLoaded = false;
    rpmPorEstado = {};
    resumenPorEstado = {};
    currentZoneSort = { column: '', asc: true };
}

// Funcin para verificar que el pintado fue exitoso
function verifyPainting(svgDoc) {
    debugLog(" [ZONES] Verificando resultado del pintado...");

    let successCount = 0;
    let totalStates = Object.keys(rpmPorEstado).length;

    Object.keys(rpmPorEstado).forEach(stateCode => {
        const element = svgDoc.getElementById(stateCode);
        if (element) {
            const appliedFill = element.style.fill || element.getAttribute('fill');
            if (appliedFill && appliedFill !== '' && appliedFill !== 'none') {
                successCount++;
            }
        }
    });

    const successRate = (successCount / totalStates) * 100;

    if (successRate >= 90) {
        debugLog(` [ZONES] Pintado verificado: ${successCount}/${totalStates} estados`);
    } else {
        console.warn(` [ZONES] Pintado incompleto: ${successCount}/${totalStates} estados`);
    }
}

// ========================================
//  MAPA DE CIUDADES CON GOOGLE MAPS
// ========================================

let zonesMap = null;
let cityMarkers = [];
let cityDataByDestination = {};

// Inicializar mapa de ciudades
function initializeCitiesMap() {
    const mapElement = document.getElementById('citiesMap');
    if (!mapElement) {
        console.warn(" Elemento citiesMap no encontrado");
        // Intentar crearlo si el contenedor existe
        const container = document.getElementById('citiesMapContainer');
        if (container && !container.querySelector('#citiesMap')) {
            debugLog(" Creando elemento citiesMap...");
            container.innerHTML = '<div id="citiesMap" class="w-full h-96 rounded-lg border-2 border-gray-300 bg-gray-100"></div>';
            // Esperar un momento y reintentar
            setTimeout(initializeCitiesMap, 100);
            return;
        } else {
            return;
        }
    }

    if (typeof google === 'undefined' || !google.maps) {
        console.warn(" Google Maps no est disponible");
        return;
    }

    // Crear mapa centrado en USA
    zonesMap = new google.maps.Map(mapElement, {
        zoom: 4,
        center: { lat: 39.8283, lng: -98.5795 }, // Centro de USA
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
            {
                featureType: "poi",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    debugLog(" Mapa de ciudades inicializado");
}

// Cargar y mostrar ciudades en el mapa
function loadCitiesData() {
    if (!window.currentUser) {
        debugLog(" No user logged in");
        return;
    }

    showCitiesLoading();

    firebase.firestore()
        .collection("loads")
        .where("userId", "==", window.currentUser.uid)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                showCitiesEmpty();
                return;
            }

            const loads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            processCitiesData(loads);
            showCitiesOnMap();
            renderCitiesTable();
            hideCitiesLoading(); //  AGREGADO
        })
        .catch(error => {
            console.error(" Error loading cities:", error);
            showCitiesError(error.message);
            if (window.showToast) {
                showToast('Error al cargar ciudades: ' + error.message, 'error');
            }
        });
}

// Procesar datos de ciudades
function processCitiesData(loads) {
    cityDataByDestination = {};

    loads.forEach(load => {
        // Normalizar destino (quitar ", USA" para evitar duplicados)
        const dest = load.destination?.replace(/, USA$/i, '');
        if (!dest) return;

        if (!cityDataByDestination[dest]) {
            cityDataByDestination[dest] = {
                city: dest,
                loads: [],
                count: 0,
                totalProfit: 0,
                avgRPM: 0,
                totalRPM: 0
            };
        }

        const rpm = parseFloat(load.rpm) || 0;
        const profit = parseFloat(load.profit) || 0;

        cityDataByDestination[dest].loads.push(load);
        cityDataByDestination[dest].count++;
        cityDataByDestination[dest].totalProfit += profit;
        cityDataByDestination[dest].totalRPM += rpm;
    });

    // Calcular promedios
    Object.keys(cityDataByDestination).forEach(dest => {
        const data = cityDataByDestination[dest];
        data.avgRPM = data.count > 0 ? data.totalRPM / data.count : 0;
    });

    debugLog(` Procesadas ${Object.keys(cityDataByDestination).length} ciudades`);
}

// Mostrar ciudades en el mapa
async function showCitiesOnMap() {
    if (!zonesMap) {
        initializeCitiesMap();
        if (!zonesMap) return;
    }

    // Limpiar marcadores anteriores
    cityMarkers.forEach(marker => marker.setMap(null));
    cityMarkers = [];

    const geocoder = new google.maps.Geocoder();
    const bounds = new google.maps.LatLngBounds();

    for (const [destination, data] of Object.entries(cityDataByDestination)) {
        try {
            const result = await geocodeCity(destination, geocoder);
            if (result) {
                const marker = createCityMarker(result, data);
                cityMarkers.push(marker);
                bounds.extend(result);
            }
        } catch (error) {
            console.warn(` No se pudo geocodificar: ${destination}`);
        }
    }

    // Ajustar zoom para mostrar todos los marcadores
    if (cityMarkers.length > 0) {
        zonesMap.fitBounds(bounds);
    }

    debugLog(` ${cityMarkers.length} marcadores en el mapa`);
}

// Geocodificar ciudad
function geocodeCity(city, geocoder) {
    return new Promise((resolve, reject) => {
        geocoder.geocode({ address: city }, (results, status) => {
            if (status === 'OK' && results[0]) {
                resolve(results[0].geometry.location);
            } else {
                reject(status);
            }
        });
    });
}

// Crear marcador de ciudad
function createCityMarker(location, data) {
    const color = data.avgRPM >= 1.05 ? 'green' : data.avgRPM >= 0.75 ? 'yellow' : 'red';

    const marker = new google.maps.Marker({
        position: location,
        map: zonesMap,
        title: `${data.city} (${data.count} cargas)`,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8 + (data.count * 0.5), // Tamao basado en cantidad
            fillColor: color,
            fillOpacity: 0.8,
            strokeColor: 'white',
            strokeWeight: 2
        }
    });

    // InfoWindow con detalles
    const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(data)
    });

    marker.addListener('click', () => {
        infoWindow.open(zonesMap, marker);
        showCityLoadsModal(data);
    });

    return marker;
}

// Crear contenido del InfoWindow
function createInfoWindowContent(data) {
    const zoneLabel = data.avgRPM >= 1.05 ? ' Zona Verde' :
        data.avgRPM >= 0.75 ? ' Zona Amarilla' : ' Zona Roja';

    return `
        <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${data.city}</h3>
            <div style="background: #f3f4f6; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <p style="margin: 4px 0;"><strong>${zoneLabel}</strong></p>
                <p style="margin: 4px 0;">RPM Promedio: <strong>$${data.avgRPM.toFixed(2)}</strong></p>
                <p style="margin: 4px 0;">Total Cargas: <strong>${data.count}</strong></p>
                <p style="margin: 4px 0;">Ganancia Total: <strong style="color: green;">$${data.totalProfit.toFixed(2)}</strong></p>
            </div>
            <p style="margin: 8px 0; text-align: center; color: #6b7280; font-size: 12px;">
                Click para ver todas las cargas 
            </p>
        </div>
    `;
}

// Mostrar modal con cargas de la ciudad
function showCityLoadsModal(data) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center z-50 p-6';
    modal.style.cssText = 'background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px);';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    const loadsHTML = data.loads.map((load, i) => `
        <div class="border-b border-gray-200 py-3 hover:bg-gray-50">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="font-semibold text-gray-800">#${i + 1}</span>
                    <span class="text-sm text-gray-600 ml-2">${load.origin || 'N/A'}  ${load.destination}</span>
                </div>
                <span class="text-sm font-semibold ${load.rpm >= 1.05 ? 'text-green-600' : load.rpm >= 0.75 ? 'text-yellow-600' : 'text-red-600'}">
                    $${(load.rpm || 0).toFixed(2)}/mi
                </span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div> ${load.loadedMiles || 0} mi</div>
                <div> $${(load.totalCharge || 0).toFixed(2)}</div>
                <div class="text-green-600 font-semibold">+$${(load.profit || 0).toFixed(2)}</div>
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h2 class="text-2xl font-bold mb-2"> ${data.city}</h2>
                        <p class="text-blue-100">Total de ${data.count} cargas</p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-gray-200 text-3xl"></button>
                </div>
            </div>
            
            <div class="grid grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
                <div class="text-center">
                    <p class="text-sm text-gray-600">RPM Promedio</p>
                    <p class="text-2xl font-bold text-blue-600">$${data.avgRPM.toFixed(2)}</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600">Total Cargas</p>
                    <p class="text-2xl font-bold text-purple-600">${data.count}</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600">Ganancia Total</p>
                    <p class="text-2xl font-bold text-green-600">$${data.totalProfit.toFixed(2)}</p>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6">
                <h3 class="font-semibold mb-4 text-gray-700"> Historial de Cargas</h3>
                ${loadsHTML}
            </div>
            
            <div class="p-4 bg-gray-50 border-t text-center">
                <button onclick="this.closest('.fixed').remove()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Renderizar tabla de ciudades
function renderCitiesTable() {
    const tbody = document.getElementById('citiesTableBody');
    if (!tbody) return;

    const sortedCities = Object.values(cityDataByDestination)
        .sort((a, b) => b.count - a.count);

    tbody.innerHTML = sortedCities.map((data, i) => {
        const zoneColor = data.avgRPM >= 1.05 ? 'text-green-600' :
            data.avgRPM >= 0.75 ? 'text-yellow-600' : 'text-red-600';
        const zoneIcon = data.avgRPM >= 1.05 ? '' : data.avgRPM >= 0.75 ? '' : '';

        return `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="focusCityOnMap('${data.city}')">
                <td class="p-3 border-b">${i + 1}</td>
                <td class="p-3 border-b font-semibold">${data.city}</td>
                <td class="p-3 border-b text-center">${data.count}</td>
                <td class="p-3 border-b text-center ${zoneColor} font-semibold">${zoneIcon} $${data.avgRPM.toFixed(2)}</td>
                <td class="p-3 border-b text-center text-green-600 font-semibold">$${data.totalProfit.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

// Enfocar ciudad en el mapa
function focusCityOnMap(cityName) {
    const data = cityDataByDestination[cityName];
    if (!data) return;

    const marker = cityMarkers.find(m => m.getTitle().includes(cityName));
    if (marker) {
        zonesMap.setCenter(marker.getPosition());
        zonesMap.setZoom(10);
        google.maps.event.trigger(marker, 'click');
    }
}

// Estados de carga
function showCitiesLoading() {
    const mapElement = document.getElementById('citiesMap');
    if (mapElement) {
        // Agregar overlay de carga SIN destruir el mapa
        let loadingOverlay = document.getElementById('citiesMapLoading');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'citiesMapLoading';
            loadingOverlay.className = 'absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10';
            loadingOverlay.innerHTML = '<div class="text-center"><div class="spinner mx-auto mb-2"></div><p class="text-gray-600">Cargando ciudades...</p></div>';

            // Hacer el container relative si no lo es
            const container = mapElement.parentElement;
            if (container && !container.style.position) {
                container.style.position = 'relative';
            }

            container.appendChild(loadingOverlay);
        }
        loadingOverlay.style.display = 'flex';
    }
}

function hideCitiesLoading() {
    const loadingOverlay = document.getElementById('citiesMapLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showCitiesEmpty() {
    hideCitiesLoading();
    const mapElement = document.getElementById('citiesMap');
    if (mapElement) {
        let emptyOverlay = document.getElementById('citiesMapEmpty');
        if (!emptyOverlay) {
            emptyOverlay = document.createElement('div');
            emptyOverlay.id = 'citiesMapEmpty';
            emptyOverlay.className = 'absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10';
            emptyOverlay.innerHTML = '<div class="text-center p-8 text-gray-500">No hay cargas para mostrar</div>';

            const container = mapElement.parentElement;
            if (container && !container.style.position) {
                container.style.position = 'relative';
            }

            container.appendChild(emptyOverlay);
        }
        emptyOverlay.style.display = 'flex';
    }
}

function showCitiesError(message) {
    hideCitiesLoading();
    const mapElement = document.getElementById('citiesMap');
    if (mapElement) {
        let errorOverlay = document.getElementById('citiesMapError');
        if (!errorOverlay) {
            errorOverlay = document.createElement('div');
            errorOverlay.id = 'citiesMapError';
            errorOverlay.className = 'absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10';

            const container = mapElement.parentElement;
            if (container && !container.style.position) {
                container.style.position = 'relative';
            }

            container.appendChild(errorOverlay);
        }
        errorOverlay.innerHTML = `<div class="text-center p-8 text-red-600">Error: ${message}</div>`;
        errorOverlay.style.display = 'flex';
    }
}

// Funcin para mostrar error de carga del mapa
function showMapLoadError() {
    const mapContainer = document.querySelector('#interactiveMap').parentElement;
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="w-full h-80 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
                <div class="text-center p-6">
                    <div class="text-4xl mb-3"></div>
                    <h3 class="text-lg font-semibold text-red-700 mb-2">Error cargando mapa SVG</h3>
                    <p class="text-red-600 mb-4">El mapa de zonas no pudo cargar correctamente</p>
                    <button onclick="retryZones()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                         Reintentar
                    </button>
                </div>
            </div>
        `;
    }
}

// ======================================================
// LEX: Análisis de zonas / heatmap
// ======================================================
window.analyzeLexZones = async function () {
    try {
        console.log('[LEX-ZONES] Iniciando análisis de zonas…');

        // 1. Asegurar datos de zonas ya calculados
        //    Preferimos usar resumenPorEstado si ya existe
        let stats = null;

        if (window.resumenPorEstado && Object.keys(window.resumenPorEstado).length > 0) {
            stats = window.resumenPorEstado;
            console.log('[LEX-ZONES] Usando resumenPorEstado existente');
        } else {
            // Si no existe, cargamos del historial en Firebase
            const user = firebase.auth().currentUser;
            if (!user) {
                alert('Debes iniciar sesión para analizar las zonas.');
                return;
            }

            const db = firebase.firestore();
            const snapshot = await db
                .collection('loads')
                .where('userId', '==', user.uid)
                .get();

            const loads = [];
            snapshot.forEach(doc => loads.push({ id: doc.id, ...doc.data() }));

            if (loads.length === 0) {
                if (window.setLexState) {
                    window.setLexState('sad', {
                        message: 'Todavía no tengo suficientes cargas para analizar tus zonas 🗺️',
                        duration: 5000
                    });
                }
                alert('No hay cargas registradas todavía para analizar las zonas.');
                return;
            }

            console.log('[LEX-ZONES] Calculando estadísticas desde loads…');

            // Usa tu función original de zonas
            if (typeof calcularEstadisticas === 'function') {
                stats = calcularEstadisticas(loads);
            } else {
                console.warn('[LEX-ZONES] calcularEstadisticas no está definida');
                alert('No pude calcular las estadísticas de zonas.');
                return;
            }
        }

        // 2. Preparar análisis en un formato amigable
        const analysis = prepararAnalisisZonas(stats);

        // 3. Mensaje corto para la burbuja de Lex
        if (window.setLexState) {
            let mood = 'thinking';
            if (analysis.verdes > analysis.rojas) mood = 'happy';
            else if (analysis.rojas > analysis.verdes) mood = 'warning';

            const resumenCorto =
                `Estados analizados: ${analysis.total} · ` +
                `Verdes: ${analysis.verdes} · Amarillas: ${analysis.amarillas} · Rojas: ${analysis.rojas}`;

            window.setLexState(mood, {
                message: `📊 Esto es lo que veo en tus zonas:\n${resumenCorto}`,
                duration: 8000
            });
        }

        // 4. Mostrar modal detallado (sin depender de window.lexAI)
        window.showLexZonesModal(analysis);

        console.log('[LEX-ZONES] Análisis completado:', analysis);
        return analysis;
    } catch (err) {
        console.error('[LEX-ZONES] Error:', err);
        if (window.setLexState) {
            window.setLexState('warning', {
                message: 'Tuve un problema al analizar tus zonas 🛠️',
                duration: 5000
            });
        }
        return null;
    }
};

// ======================================================
// Preparar análisis para Lex (helper interno)
// ======================================================
function prepararAnalisisZonas(stats) {
    let totalMiles = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalLoads = 0;

    const rows = Object.keys(stats).map(state => {
        const st = stats[state] || {};
        const miles = Number(st.totalMiles || 0);
        const revenue = Number(st.totalRevenue || 0);
        const profit = Number(st.totalProfit || 0);
        const count = Number(st.count || 0);

        // Acumular totales
        totalMiles += miles;
        totalRevenue += revenue;
        totalProfit += profit;
        totalLoads += count;

        const avg = miles > 0 ? revenue / miles : 0;

        let zona = 'amarilla';
        if (avg >= 1.05) zona = 'verde';
        else if (avg < 0.75) zona = 'roja';

        return {
            state,
            avgRPM: avg,
            totalProfit: profit,
            count: count,
            zona
        };
    });

    // Ordenar sin mutar el array original
    const sortedByRPM = [...rows].sort((a, b) => b.avgRPM - a.avgRPM);
    const top = sortedByRPM.slice(0, 5);
    const worst = [...rows].sort((a, b) => a.avgRPM - b.avgRPM).slice(0, 3);

    const verdes = rows.filter(r => r.zona === 'verde').length;
    const amarillas = rows.filter(r => r.zona === 'amarilla').length;
    const rojas = rows.filter(r => r.zona === 'roja').length;

    // Calcular RPM promedio global
    const avgRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;

    // Generar insights
    const insights = [];
    const alerts = [];

    if (verdes > 0) {
        insights.push(`Tienes ${verdes} zonas verdes con buen RPM (>$1.05/mi)`);
    }
    if (top.length > 0) {
        insights.push(`Tu mejor zona es ${top[0].state} con $${top[0].avgRPM.toFixed(2)}/mi`);
    }
    if (totalProfit > 0) {
        insights.push(`Has generado $${totalProfit.toFixed(0)} en profit total en estas zonas`);
    }

    if (rojas > 0) {
        alerts.push(`Tienes ${rojas} zonas rojas con RPM bajo (<$0.75/mi)`);
    }
    if (amarillas > verdes) {
        alerts.push(`La mayoría de tus zonas son amarillas - busca oportunidades para mejorar RPM`);
    }
    if (worst.length > 0 && worst[0].avgRPM < 0.70) {
        alerts.push(`Evita ${worst[0].state} - solo genera $${worst[0].avgRPM.toFixed(2)}/mi`);
    }

    const summary =
        `Tienes ${verdes} estados verdes (buen RPM), ` +
        `${amarillas} amarillos y ${rojas} rojos. ` +
        (top.length
            ? `Tus mejores zonas ahora mismo: ${top
                .map(t => `${t.state} ($${t.avgRPM.toFixed(2)}/mi)`)
                .join(', ')}.`
            : 'Necesito más datos para identificar claramente tus mejores zonas.');

    return {
        rows,
        top,
        worst,
        verdes,
        amarillas,
        rojas,
        total: rows.length,
        totalMiles,
        totalRevenue,
        totalProfit,
        totalLoads,
        avgRPM,
        insights,
        alerts,
        summary
    };
}

// ======================================================
// Modal visual para análisis de zonas
// ======================================================
window.showLexZonesModal = function (analysis) {
    const existing = document.getElementById('lexZonesModal');
    if (existing) existing.remove();

    const safeNumber = (n, dec = 2) => {
        const v = Number(n);
        if (!Number.isFinite(v)) return '--';
        return v.toFixed(dec);
    };

    const modal = document.createElement('div');
    modal.id = 'lexZonesModal';
    modal.className =
        'fixed inset-0 flex items-center justify-center z-50 p-4';
    style = "background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px);"
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style="max-height:90vh;">
     
      <!-- Header con gradiente -->
      <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-2xl flex-shrink-0">
        <div class="flex items-center gap-3">
          <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
          <div>
            <h3 class="text-lg font-bold">Análisis de Zonas</h3>
            <p class="text-xs text-purple-100">
              Basado en tu historial real de cargas por estado
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        <!-- KPIs principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">Estados analizados</p>
            <p class="text-lg font-bold text-slate-900">${analysis.total}</p>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">Zonas verdes</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">${analysis.verdes}</p>
          </div>
          <div class="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
            <p class="text-[10px] text-yellow-600 uppercase">Zonas amarillas</p>
            <p class="text-lg font-bold" style="color: #a16207 !important;">${analysis.amarillas}</p>
          </div>
          <div class="bg-red-50 p-3 rounded-xl border border-red-200">
            <p class="text-[10px] text-red-600 uppercase">Zonas rojas</p>
            <p class="text-lg font-bold" style="color: #b91c1c !important;">${analysis.rojas}</p>
          </div>
        </div>

        <!-- Métricas globales -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <p class="text-xs text-blue-700 font-semibold mb-1">
              Rendimiento global
            </p>
            <p class="text-sm text-slate-800 mb-1">
              RPM promedio: <span class="font-bold">$${safeNumber(analysis.avgRPM, 2)}/mi</span>
            </p>
            <p class="text-xs text-slate-600">
              Millas: ${safeNumber(analysis.totalMiles, 0)} · Cargas: ${analysis.totalLoads}
            </p>
          </div>

          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs text-emerald-700 font-semibold mb-1">
              Profit total
            </p>
            <p class="text-lg font-bold" style="color: #047857 !important;">
              $${safeNumber(analysis.totalProfit, 0)}
            </p>
            <p class="text-xs text-slate-600">
              Generado en todas las zonas
            </p>
          </div>

          <div class="bg-purple-50 border border-purple-100 p-4 rounded-xl">
            <p class="text-xs text-purple-700 font-semibold mb-1">
              Ingreso total
            </p>
            <p class="text-lg font-bold" style="color: #7e22ce !important;">
              $${safeNumber(analysis.totalRevenue, 0)}
            </p>
            <p class="text-xs text-slate-600">
              Revenue acumulado
            </p>
          </div>
        </div>

        <!-- Mejores y peores estados -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-slate-700 mb-2">&#127942; Mejores estados</p>
            <ul class="space-y-1">
              ${analysis.top.length
            ? analysis.top
                .map(
                    s => `
                <li class="text-xs text-emerald-800">
                  • ${s.state}: $${safeNumber(s.avgRPM, 2)}/mi (${s.count} cargas)
                </li>`
                )
                .join('')
            : '<li class="text-xs text-slate-500">Aún no tengo suficientes datos para determinar tus mejores estados.</li>'
        }
            </ul>
          </div>

          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">&#9888;&#65039; Estados complicados</p>
            <ul class="space-y-1">
              ${analysis.worst.length
            ? analysis.worst
                .map(
                    s => `
                <li class="text-xs text-amber-800">
                  • ${s.state}: $${safeNumber(s.avgRPM, 2)}/mi (${s.count} cargas)
                </li>`
                )
                .join('')
            : '<li class="text-xs text-amber-700">No se detectaron estados claramente problemáticos aún.</li>'
        }
            </ul>
          </div>
        </div>

        <!-- Insights y Alertas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs font-semibold text-emerald-800 mb-2">
              &#9989; Puntos positivos
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.insights && analysis.insights.length
            ? analysis.insights
                .map(
                    (i) =>
                        `<li class="text-xs text-emerald-800">• ${i}</li>`
                )
                .join('')
            : '<li class="text-xs text-emerald-700">Aún no hay suficientes datos para generar insights.</li>'
        }
            </ul>
          </div>

          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">
              &#128161; Alertas y oportunidades
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.alerts && analysis.alerts.length
            ? analysis.alerts
                .map(
                    (a) =>
                        `<li class="text-xs text-amber-800">• ${a}</li>`
                )
                .join('')
            : '<li class="text-xs text-amber-700">No se detectaron alertas importantes.</li>'
        }
            </ul>
          </div>
        </div>

        <!-- Resumen de estrategia -->
        <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <p class="text-xs font-semibold text-slate-700 mb-1">&#129517; Resumen de estrategia</p>
          <p class="text-sm text-slate-800">
            ${analysis.summary}
          </p>
        </div>
      </div>

     <!-- Footer -->
<div class="p-4 border-t border-slate-700/60 lex-modal-actions">
  <button 
    type="button"
    onclick="window.openLexChatModal()"
    class="lex-modal-btn lex-modal-btn-primary"
  >
    💬 Chat con Lex
  </button>
  <button 
    type="button"
    onclick="closeLexZonesModal()"
    class="lex-modal-btn lex-modal-btn-ghost"
  >
    ✕ Cerrar
  </button>  
</div>
    </div>
  `;

    document.body.appendChild(modal);
};

window.closeLexZonesModal = function () {
    const modal = document.getElementById('lexZonesModal');
    if (modal) modal.remove();
    if (window.setLexState) window.setLexState('idle');
};


//  EXPONER FUNCIONES GLOBALMENTE
window.loadZonesData = loadZonesData;
window.calcularEstadisticas = calcularEstadisticas;
window.pintarEstados = pintarEstados;
window.renderZonesTable = renderZonesTable;
window.sortZonesBy = sortZonesBy;
window.retryZones = retryZones;
window.resetZonesData = resetZonesData;
window.setupResponsiveMapLayout = setupResponsiveMapLayout;
window.showZonesLoading = showZonesLoading;
window.showZonesEmpty = showZonesEmpty;
window.showZonesError = showZonesError;
window.setupMapInteractivity = setupMapInteractivity;
window.setupInfoPanel = setupInfoPanel;
window.showStateInfo = showStateInfo;
window.verifyPainting = verifyPainting;
window.showMapLoadError = showMapLoadError;

//  Nuevas funciones de mapa de ciudades
window.initializeCitiesMap = initializeCitiesMap;
window.loadCitiesData = loadCitiesData;
window.showCitiesOnMap = showCitiesOnMap;
window.renderCitiesTable = renderCitiesTable;
window.focusCityOnMap = focusCityOnMap;
window.processCitiesData = processCitiesData;
window.showCitiesLoading = showCitiesLoading;
window.hideCitiesLoading = hideCitiesLoading;
window.showCitiesEmpty = showCitiesEmpty;
window.showCitiesError = showCitiesError;

debugLog(" Zones.js cargado completamente (VERSIN CORREGIDA + Mapa de Ciudades)");