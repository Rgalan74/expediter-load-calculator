// ✅ zones.js - VERSIÓN COMPLETAMENTE CORREGIDA

// Variables globales
let rpmPorEstado = {};
let resumenPorEstado = {};
let zonesDataLoaded = false;
let currentZoneSort = { column: '', asc: true };

// Función principal para cargar datos de zonas
function loadZonesData() {
    if (zonesDataLoaded) {
        console.log("🗺️ Zones data already loaded, skipping");
        return;
    }

    if (!window.currentUser) {
        console.log("❌ No user logged in for zones");
        showZonesEmpty("Debe iniciar sesión para ver las zonas");
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
            
            // Configurar layout responsivo después de que carga el mapa
            setTimeout(() => {
                setupResponsiveMapLayout();
            }, 500);
            
            zonesDataLoaded = true;
        })
        .catch(error => {
            console.error("❌ Error loading zones data:", error);
            showZonesError("Error cargando datos: " + error.message);
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

        if ((isNaN(rpm) || rpm === 0) && load.totalCharge && load.totalMiles) {
            rpm = parseFloat(load.totalCharge) / parseFloat(load.totalMiles);
        }

        if (!originCode || isNaN(rpm)) return;

        if (!rpmPorEstado[originCode]) rpmPorEstado[originCode] = { total: 0, count: 0 };
        rpmPorEstado[originCode].total += rpm;
        rpmPorEstado[originCode].count++;

        if (!resumenPorEstado[destCode]) resumenPorEstado[destCode] = { count: 0, totalProfit: 0 };
        if (!resumenPorEstado[originCode]) resumenPorEstado[originCode] = { count: 0, totalProfit: 0 };

        resumenPorEstado[destCode].count++;
        resumenPorEstado[destCode].totalProfit += isNaN(profit) ? 0 : profit;
        resumenPorEstado[originCode].count++;
        resumenPorEstado[originCode].totalProfit += isNaN(profit) ? 0 : profit;
    });

    Object.keys(rpmPorEstado).forEach(code => {
        const data = rpmPorEstado[code];
        rpmPorEstado[code] = data.total / data.count;
    });
}

// Renderizar tabla de zonas
function renderZonesTable() {
    const body = document.getElementById("zoneDataBody");
    if (!body) return;

    body.innerHTML = "";

    const rows = Object.entries(resumenPorEstado).map(([state, stats]) => {
        const avgRpm = rpmPorEstado[state] || 0;
        const label = avgRpm < 0.75 ? "Zona roja" : avgRpm < 1.05 ? "Zona amarilla" : "Zona verde";
        const zoneClass = avgRpm < 0.75 ? "bg-red-100" : avgRpm < 1.05 ? "bg-yellow-100" : "bg-green-100";

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
            <td class="p-2 text-green-600">$${row.profit.toFixed(2)}</td>
            <td class="p-2">
                <div class="h-2 w-full bg-gray-200 rounded">
                    <div class="h-2 rounded ${row.avgRpm >= 1.05 ? 'bg-green-500' : row.avgRpm >= 0.75 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: ${Math.min((row.avgRpm / 2) * 100, 100)}%"></div>
                </div>
            </td>
        `;

        body.appendChild(tr);
    });
}

// Función initializeMap mejorada con hover
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

// Nueva función para configurar interactividad
function setupMapInteractivity(svgDoc) {
    if (!svgDoc) return;
    
    // Crear panel de información si no existe
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
            stateElement.addEventListener('mouseenter', function() {
                console.log(`🖱️ Hover en ${stateCode}`);
                this.style.stroke = '#1f2937';
                this.style.strokeWidth = '3';
                showStateInfo(stateCode, rpm, resumen);
            });
            
            stateElement.addEventListener('mouseleave', function() {
                this.style.strokeWidth = '1';
                this.style.stroke = '#374151';
            });
            
            stateElement.addEventListener('click', function() {
                console.log(`🖱️ Click en ${stateCode}`);
                showStateInfo(stateCode, rpm, resumen, true);
            });
        }
    });
    
    console.log("✅ Interactividad del mapa configurada");
}

// Función para crear panel de información
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
                <h4 class="font-semibold text-lg mb-3 text-gray-800">📍 Información del Estado</h4>
                <div id="stateDetails" class="text-gray-500 text-center">
                    <p class="text-sm">Pasa el cursor sobre un estado para ver detalles</p>
                </div>
            `;
            sidebar.appendChild(infoPanel);
        }
    }
}

// Función para mostrar información del estado
function showStateInfo(stateCode, rpm, resumen, isClick = false) {
    const detailsDiv = document.getElementById('stateDetails');
    if (!detailsDiv) return;
    
    const zoneLabel = rpm >= 1.05 ? 'Zona Verde' : rpm >= 0.75 ? 'Zona Amarilla' : 'Zona Roja';
    const zoneColor = rpm >= 1.05 ? 'text-green-600' : rpm >= 0.75 ? 'text-yellow-600' : 'text-red-600';
    const zoneIcon = rpm >= 1.05 ? '🟢' : rpm >= 0.75 ? '🟡' : '🔴';
    
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

// ✅ FUNCIÓN PINTARESTADOS CORREGIDA
function pintarEstados(svgDoc) {
    if (!svgDoc) {
        console.warn("❌ [ZONES] SVG document no disponible para pintado");
        return;
    }

    console.log("🎨 [ZONES] Iniciando pintado de estados...");

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

        // Aplicar múltiples métodos
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
        console.log(`🎨 ${stateCode}: RPM $${rpm.toFixed(2)} = ${color}`);
    });

    // Forzar refresh del SVG
    const svgElement = svgDoc.documentElement;
    if (svgElement) {
        svgElement.style.display = 'none';
        svgElement.offsetHeight;
        svgElement.style.display = '';
        console.log("🔄 [ZONES] SVG refresh forzado");
    }

    console.log(`✅ Estados pintados con colores: ${statesPainted}`);
}

// ✅ FUNCIÓN LAYOUT RESPONSIVO (AHORA FUERA DE PINTARESTADOS)
function setupResponsiveMapLayout() {
    const mapObject = document.getElementById('interactiveMap');
    if (!mapObject) return;
    
    const mapContainer = mapObject.parentElement;
    const flexContainer = mapContainer?.parentElement;
    const panelLateral = flexContainer?.children[1];
    
    console.log("🎯 Configurando layout responsivo del mapa...");
    
    if (mapContainer && panelLateral) {
        // Configurar contenedor del mapa (75% del espacio)
        mapContainer.className = mapContainer.className.replace('flex-1', 'flex-[3]');
        mapContainer.style.minWidth = '600px';
        
        // Configurar el mapa
        mapObject.style.width = '100%';
        mapObject.style.height = '500px';
        mapObject.style.minWidth = '500px';
        mapObject.style.maxWidth = '100%';
        
        // Configurar panel lateral (25% del espacio)
        panelLateral.style.flex = '1';
        panelLateral.style.maxWidth = '280px';
        panelLateral.style.minWidth = '220px';
        
        // Event listener para resize
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (mapObject.offsetWidth < 280) {
                    mapObject.style.width = '280px';
                }
            }, 150);
        });
        
        // Responsive para pantallas pequeñas
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
        
        console.log("✅ Layout responsivo configurado - Mapa 75%, Panel 25%");
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
        body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-600">❌ ${message}</td></tr>`;
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

// Función para verificar que el pintado fue exitoso
function verifyPainting(svgDoc) {
    console.log("🔍 [ZONES] Verificando resultado del pintado...");
    
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
        console.log(`✅ [ZONES] Pintado verificado: ${successCount}/${totalStates} estados`);
    } else {
        console.warn(`⚠️ [ZONES] Pintado incompleto: ${successCount}/${totalStates} estados`);
    }
}

// Función para mostrar error de carga del mapa
function showMapLoadError() {
    const mapContainer = document.querySelector('#interactiveMap').parentElement;
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="w-full h-80 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
                <div class="text-center p-6">
                    <div class="text-4xl mb-3">❌</div>
                    <h3 class="text-lg font-semibold text-red-700 mb-2">Error cargando mapa SVG</h3>
                    <p class="text-red-600 mb-4">El mapa de zonas no pudo cargar correctamente</p>
                    <button onclick="retryZones()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        `;
    }
}

// ✅ EXPONER FUNCIONES GLOBALMENTE
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

console.log("✅ Zones.js cargado completamente (VERSIÓN CORREGIDA)");