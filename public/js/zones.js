//  zones.js - VERSIN COMPLETAMENTE CORREGIDA

// Variables globales
let rpmPorEstado = {};
let resumenPorEstado = {};
let scorePorEstado = {};   // Score compuesto 0-100: RPM(65%) + Frecuencia(35%)
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
        showZonesEmpty(window.i18n?.t('zones.login_required') || "Must log in to see zones");
        return;
    }

    showZonesLoading();

    firebase.firestore()
        .collection("loads")
        .where("userId", "==", window.currentUser.uid)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                showZonesEmpty(window.i18n?.t('zones.no_loads') || "No loads to analyze zones");
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
            debugLog(" Error loading zones data:", error);
            showZonesError((window.i18n?.t('zones.error_loading') || "Error loading data: ") + error.message);
            if (window.showToast) {
                showToast((window.i18n?.t('zones.error_loading') || 'Error loading data: ') + error.message, 'error');
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

        if (!resumenPorEstado[originCode]) {
            resumenPorEstado[originCode] = {
                count: 0,
                totalProfit: 0,
                totalMiles: 0,
                totalRevenue: 0
            };
        }

        // Solo sumar al ORGEN (Salida)
        resumenPorEstado[originCode].count++;
        resumenPorEstado[originCode].totalProfit += isNaN(profit) ? 0 : profit;
        resumenPorEstado[originCode].totalMiles += isNaN(miles) ? 0 : miles;
        resumenPorEstado[originCode].totalRevenue += isNaN(revenue) ? 0 : revenue;
    });

    // ✅ Calcular promedio de RPM
    Object.keys(rpmPorEstado).forEach(code => {
        const data = rpmPorEstado[code];
        rpmPorEstado[code] = data.count > 0 ? (data.total / data.count) : 0;
    });

    // Calcular score compuesto tras tener el promedio de RPM
    calcularScoreCompuesto();

    return resumenPorEstado;
}

// Zona por reglas directas: RPM + confianza por volumen
// Regla 1: zona base del RPM (usa los mismos umbrales del usuario: $0.75 / $0.90)
// Regla 2: si < 3 cargas → bajar un nivel (verde→amarillo, amarillo→rojo)
//   Razón: con 1-2 cargas no hay suficiente muestra para confiar en el dato
function calcularScoreCompuesto() {
    scorePorEstado = {};

    Object.keys(rpmPorEstado).forEach(code => {
        const rpm    = rpmPorEstado[code] || 0;
        const cargas = resumenPorEstado[code]?.count || 0;

        // Zona base del precio (RPM)
        let score;
        if      (rpm >= 0.90) score = 75;  // Verde
        else if (rpm >= 0.75) score = 37;  // Amarillo
        else                  score = 10;  // Rojo

        // Penalización por muestra insuficiente (< 3 cargas)
        if (cargas < 3 && score > 10) {
            score = score === 75 ? 37 : 10;  // verde→amarillo, amarillo→rojo
        }

        scorePorEstado[code] = score;
        const zona = score >= 50 ? 'VERDE' : score >= 25 ? 'AMARILLO' : 'ROJO';
        debugLog(` [SCORE] ${code}: RPM=$${rpm.toFixed(2)} × ${cargas} cargas → ${zona} (score ${score})`);
    });
}

// Helper: devuelve label/color/icono/colorMapa según score
function getZoneFromScore(score) {
    if (score >= 50) return { label: window.i18n?.t('zones.zone_green')  || 'Green Zone',  color: 'text-green-600',  icon: '🟢', mapColor: '#16a34a' };
    if (score >= 25) return { label: window.i18n?.t('zones.zone_yellow') || 'Yellow Zone', color: 'text-yellow-600', icon: '🟡', mapColor: '#facc15' };
    return             { label: window.i18n?.t('zones.zone_red')    || 'Red Zone',    color: 'text-red-600',    icon: '🔴', mapColor: '#dc2626' };
}


// Renderizar tabla de zonas
function renderZonesTable() {
    const body = document.getElementById("zoneDataBody");
    if (!body) return;

    body.innerHTML = "";

    // Convertir a array para ordenar
    let rows = Object.entries(resumenPorEstado).map(([state, stats]) => {
        // RPM Promedio solo existe si hubo cargas SALIENDO de este estado
        const rawRpm = rpmPorEstado[state] || 0;

        // Score compuesto (RPM 65% + Frecuencia 35%)
        const score = scorePorEstado[state] ?? 0;
        const zone = getZoneFromScore(score);

        return {
            state,
            label: zone.label,
            zoneClass: score >= 50 ? 'zone-green' : score >= 25 ? 'zone-yellow' : 'zone-red',
            score,
            count: stats.count,
            avgRpm: rawRpm,
            profit: stats.totalProfit
        };
    });

    // Ordenar
    if (currentZoneSort.column) {
        const { column, asc } = currentZoneSort;
        rows.sort((a, b) => {
            if (column === 'state') return asc ? a.state.localeCompare(b.state) : b.state.localeCompare(a.state);
            return asc ? a[column] - b[column] : b[column] - a[column];
        });
    }

    rows.forEach(row => {
        const tr = document.createElement("tr");
        // Mapear clases de zona a estilos de fondo suave
        let bgClass = '';
        if (row.zoneClass === 'zone-red') bgClass = 'bg-red-50';
        else if (row.zoneClass === 'zone-yellow') bgClass = 'bg-yellow-50';
        else if (row.zoneClass === 'zone-green') bgClass = 'bg-green-50';
        else if (row.zoneClass === 'zone-blue') bgClass = 'bg-blue-50'; // Nueva clase azul
        else bgClass = '';

        tr.className = `${bgClass} border-b hover:bg-gray-100 transition`;

        // Formato condicional para RPM
        const rpmDisplay = row.avgRpm > 0 ? `$${row.avgRpm.toFixed(2)}` : '<span class="text-gray-400 text-xs">N/A</span>';

        // Barra de progreso condicional
        let progressBar = '';
        if (row.avgRpm > 0) {
            const barColor = row.score >= 50 ? 'bg-green-500' : row.score >= 25 ? 'bg-yellow-500' : 'bg-red-500';
            const width = Math.max(8, Math.min(row.score, 100));
            progressBar = `<div class="h-2 rounded ${barColor}" style="width: ${width}%"></div>`;
        } else if (row.zoneClass === 'zone-blue') {
            // Barra azul completa para indicar actividad de destino
            progressBar = `<div class="h-2 rounded bg-blue-200" style="width: 100%" title="Solo entregas registradas"></div>`;
        } else {
            progressBar = `<div class="h-2 rounded bg-gray-100" style="width: 100%"></div>`;
        }

        tr.innerHTML = `
            <td class="p-3 font-bold text-gray-800">${row.state}</td>
            <td class="p-3 text-sm">${row.label}</td>
            <td class="p-3 font-medium">${row.count}</td>
            <td class="p-3 font-mono font-bold text-blue-700">${rpmDisplay}</td>
            <td class="p-3 font-mono ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}">$${row.profit.toFixed(2)}</td>
            <td class="p-3 text-center">
                <span class="font-bold text-lg ${row.score >= 50 ? 'text-green-600' : row.score >= 25 ? 'text-yellow-600' : 'text-red-600'}">${row.score}</span>
                <span class="text-gray-400 text-xs">/100</span>
            </td>
            <td class="p-3">
                <div class="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    ${progressBar}
                </div>
            </td>
        `;

        body.appendChild(tr);
    });

    if (rows.length === 0) {
        showZonesEmpty(window.i18n?.t('zones.no_enough_data') || "Not enough data to generate the table.");
    }
}

// initializeMap — usa <object> + contentDocument (funciona en Firebase Hosting)
// Fallback: fetch() inline si contentDocument no llega en 5 segundos
let svgMapLoaded = false;

function initializeMap() {
    const mapObject = document.getElementById("interactiveMap");
    if (!mapObject) {
        debugLog(' [ZONES] #interactiveMap no encontrado');
        return;
    }

    // Si ya tenemos contentDocument, pintar inmediatamente
    if (mapObject.contentDocument && mapObject.contentDocument.documentElement) {
        debugLog(' [ZONES] contentDocument disponible — pintando inmediatamente');
        pintarEstados(mapObject.contentDocument);
        setupMapInteractivity(mapObject.contentDocument);
        svgMapLoaded = true;
        return;
    }

    // Retry hasta 25 veces cada 200ms (5 segundos total)
    let attempts = 0;
    const retryInterval = setInterval(() => {
        attempts++;
        const svgDoc = mapObject.contentDocument;
        if (svgDoc && svgDoc.documentElement && svgDoc.documentElement.tagName !== 'parsererror') {
            clearInterval(retryInterval);
            debugLog(` [ZONES] contentDocument listo en intento ${attempts}`);
            pintarEstados(svgDoc);
            setupMapInteractivity(svgDoc);
            svgMapLoaded = true;
        } else if (attempts >= 25) {
            clearInterval(retryInterval);
            debugLog(' [ZONES] contentDocument no disponible — usando fetch() fallback');
            _initMapViaFetch(mapObject);
        }
    }, 200);

    // También escuchar evento load
    mapObject.addEventListener('load', () => {
        const svgDoc = mapObject.contentDocument;
        if (svgDoc && svgDoc.documentElement && !svgMapLoaded) {
            clearInterval(retryInterval);
            debugLog(' [ZONES] evento load recibido — pintando');
            pintarEstados(svgDoc);
            setupMapInteractivity(svgDoc);
            svgMapLoaded = true;
        }
    }, { once: true });
}

// Fallback: carga el SVG via fetch() e inyecta inline
function _initMapViaFetch(mapObject) {
    const container = mapObject.parentElement;
    if (!container) return;

    fetch(mapObject.getAttribute('data') || 'usa_states_ids_fixed_by_title.svg')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(svgText => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');
            if (!svgEl || doc.querySelector('parsererror')) throw new Error('Parse error');

            const node = document.importNode(svgEl, true);
            node.setAttribute('width', '100%');
            node.setAttribute('height', '100%');
            node.style.cssText = 'width:100%;height:100%;min-height:400px;display:block;';

            // Reemplazar el <object> con el SVG inline
            mapObject.style.display = 'none';
            container.appendChild(node);

            // Re-implementar pintarEstados/interactividad con el nuevo nodo
            // El nodo está en el DOM principal, usar document.getElementById
            _pintarEstadosInline();
            _setupInteractivityInline();
            svgMapLoaded = true;
            debugLog(' [ZONES] Fallback fetch() completado ✅');
        })
        .catch(err => debugLog(' [ZONES] fetch() fallback error:', err));
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
                <h4 class="font-semibold text-lg mb-3 text-gray-800">${window.i18n?.t('zones.state_info_panel_title') || 'State Info'}</h4>
                <div id="stateDetails" class="text-gray-500 text-center">
                    <p class="text-sm">${window.i18n?.t('zones.state_info_hover') || 'Hover over a state to see details'}</p>
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

    // Obtener score del estado — si no existe, derivar del color actual del SVG
    let score = scorePorEstado[stateCode];
    if (score === undefined || score === null) {
        // Fallback: leer el color actual del elemento SVG en el mapa
        const mapObject = document.getElementById('interactiveMap');
        const svgDoc = mapObject?.contentDocument;
        const el = svgDoc?.getElementById(stateCode);
        const fillColor = el ? (el.getAttribute('fill') || el.style.fill || '') : '';
        if (fillColor === '#16a34a') score = 75;        // Verde
        else if (fillColor === '#facc15') score = 37;   // Amarillo
        else score = 10;                                // Rojo o desconocido
        debugLog(` [ZONES] ⚠️ scorePorEstado["${stateCode}"] no encontrado — derivado del color SVG: ${fillColor} → score ${score}`);
    }

    const cargas = resumen?.count || 0;
    const rpmBase = rpm >= 0.90 ? 75 : rpm >= 0.75 ? 37 : 10;
    const pocaMuestra = cargas < 3;

    const zone      = getZoneFromScore(score);
    const zoneLabel = zone.label;
    const zoneColor = zone.color;
    const zoneIcon  = zone.icon;
    const rpmZone   = getZoneFromScore(rpmBase);

    detailsDiv.innerHTML = `
        <div class="text-left space-y-3">
            <div class="text-center">
                <h5 class="font-bold text-2xl text-gray-800">${stateCode}</h5>
                <span class="${zoneColor} font-semibold text-lg">${zoneIcon} ${zoneLabel}</span>
                ${pocaMuestra ? `<div class="mt-1 text-xs text-orange-600 font-medium">⚠️ Poca muestra (${cargas} carga${cargas !== 1 ? 's' : ''})</div>` : ''}
            </div>

            <div class="bg-gray-50 p-3 rounded space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600 text-sm">${window.i18n?.t('zones.state_info_avg_rpm') || 'Avg RPM:'}</span>
                    <span class="font-bold text-blue-600 text-lg">$${rpm.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600 text-sm">${window.i18n?.t('zones.state_info_total_loads') || 'Total Loads:'}</span>
                    <span class="font-semibold">${cargas}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600 text-sm">${window.i18n?.t('zones.state_info_total_profit') || 'Total Profit:'}</span>
                    <span class="font-semibold text-green-600">$${(resumen?.totalProfit || 0).toFixed(2)}</span>
                </div>
                ${pocaMuestra ? `<div class="text-xs text-gray-400 border-t pt-2 mt-2">Con más cargas sería: ${rpmZone.icon} ${rpmZone.label}</div>` : ''}
            </div>
        </div>
    `;
}

//  FUNCIN PINTARESTADOS CORREGIDA
function pintarEstados(svgDoc) {
    if (!svgDoc) {
        debugLog(" [ZONES] SVG document no disponible para pintado");
        return;
    }

    debugLog(" [ZONES] Iniciando pintado de estados...");

    let statesPainted = 0;
    const cssRules = [];

    Object.keys(rpmPorEstado).forEach(stateCode => {
        const element = svgDoc.getElementById(stateCode);
        const rpm = rpmPorEstado[stateCode];

        if (!element || isNaN(rpm)) return;

        const color = getZoneFromScore(scorePorEstado[stateCode] ?? 0).mapColor;

        // Acumular reglas CSS con selector ID (especificidad 100 > .land clase 10)
        cssRules.push(`#${stateCode}{fill:${color};fill-opacity:0.8;stroke:#374151;stroke-width:1}`);

        // También aplicar como atributo de presentación como fallback
        element.setAttribute('fill', color);
        element.setAttribute('stroke', '#374151');
        element.setAttribute('stroke-width', '1');

        statesPainted++;
        debugLog(` ${stateCode}: RPM $${rpm.toFixed(2)} = ${color}`);
    });

    // Inyectar/actualizar bloque <style> con selectores #ID en el SVG doc
    // Esto garantiza que sobreescribe .land { fill: #CCC } sin importar inline styles
    let zoneStyle = svgDoc.getElementById('zone-overrides');
    if (!zoneStyle) {
        zoneStyle = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
        zoneStyle.setAttribute('id', 'zone-overrides');
        svgDoc.documentElement.appendChild(zoneStyle);
    }
    zoneStyle.textContent = cssRules.join('');

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

// Versiones inline para el fallback fetch() — usan document.getElementById
function _pintarEstadosInline() {
    const cssRules = [];
    Object.keys(rpmPorEstado).forEach(stateCode => {
        const element = document.getElementById(stateCode);
        const rpm = rpmPorEstado[stateCode];
        if (!element || isNaN(rpm)) return;
        const color = getZoneFromScore(scorePorEstado[stateCode] ?? 0).mapColor;
        cssRules.push(`#${stateCode}{fill:${color};fill-opacity:0.8;stroke:#374151;stroke-width:1}`);
        element.setAttribute('fill', color);
        element.setAttribute('stroke', '#374151');
        element.setAttribute('stroke-width', '1');
    });
    // Inyectar CSS con selectores #ID para sobreescribir .land clase en el SVG inlineado
    let zoneStyle = document.getElementById('zone-overrides-inline');
    if (!zoneStyle) {
        zoneStyle = document.createElement('style');
        zoneStyle.id = 'zone-overrides-inline';
        document.head.appendChild(zoneStyle);
    }
    zoneStyle.textContent = cssRules.join('');
    debugLog(' [ZONES] _pintarEstadosInline completado');
}

function _setupInteractivityInline() {
    setupInfoPanel();
    Object.keys(rpmPorEstado).forEach(stateCode => {
        const el = document.getElementById(stateCode);
        if (!el) return;
        const rpm = rpmPorEstado[stateCode];
        const resumen = resumenPorEstado[stateCode];
        el.style.cursor = 'pointer';
        el.addEventListener('mouseenter', function() {
            this.style.stroke = '#1f2937'; this.style.strokeWidth = '3';
            showStateInfo(stateCode, rpm, resumen);
        });
        el.addEventListener('mouseleave', function() {
            this.style.strokeWidth = '1'; this.style.stroke = '#374151';
        });
        el.addEventListener('click', function() { showStateInfo(stateCode, rpm, resumen, true); });
    });
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
        body.innerHTML = `<tr><td colspan="7" class="p-4 text-center">${window.i18n?.t('zones.loading') || 'Loading zones...'}</td></tr>`;
    }
}

function showZonesEmpty(message) {
    const body = document.getElementById("zoneDataBody");
    if (body) {
        body.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">${message}</td></tr>`;
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
    svgMapLoaded = false;
    rpmPorEstado = {};
    resumenPorEstado = {};
    scorePorEstado = {};
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
        debugLog(` [ZONES] Pintado incompleto: ${successCount}/${totalStates} estados`);
    }
}

// ========================================
//  MAPA DE CIUDADES CON GOOGLE MAPS
// ========================================


let zonesMap = null;
let cityMarkers = [];
let cityDataByDestination = {};
let currentCitySort = { column: 'count', asc: false }; // Por defecto: más cargas primero

// Inicializar mapa de ciudades
function initializeCitiesMap() {
    const mapElement = document.getElementById('citiesMap');
    if (!mapElement) {
        debugLog(" Elemento citiesMap no encontrado");
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
        debugLog(" Google Maps no est disponible");
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
            debugLog(" Error loading cities:", error);
            showCitiesError(error.message);
            if (window.showToast) {
                showToast((window.i18n?.t('zones.error_loading') || 'Error loading data: ') + error.message, 'error');
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
            debugLog(` No se pudo geocodificar: ${destination}`);
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
    const zoneLabel = data.avgRPM >= 1.05 ?
        ` ${window.i18n?.t('zones.zone_green') || 'Green Zone'}` :
        data.avgRPM >= 0.75 ?
        ` ${window.i18n?.t('zones.zone_yellow') || 'Yellow Zone'}` :
        ` ${window.i18n?.t('zones.zone_red') || 'Red Zone'}`;

    return `
        <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${data.city}</h3>
            <div style="background: #f3f4f6; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <p style="margin: 4px 0;"><strong>${zoneLabel}</strong></p>
                <p style="margin: 4px 0;">RPM Promedio: <strong>$${data.avgRPM.toFixed(2)}</strong></p>
                <p style="margin: 4px 0;">${window.i18n?.t('zones.infowindow_total_loads') || 'Total Loads:'} <strong>${data.count}</strong></p>
                <p style="margin: 4px 0;">${window.i18n?.t('zones.infowindow_total_profit') || 'Total Profit:'} <strong style="color: green;">$${data.totalProfit.toFixed(2)}</strong></p>
            </div>
            <p style="margin: 8px 0; text-align: center; color: #6b7280; font-size: 12px;">
                ${window.i18n?.t('zones.map_click_loads') || 'Click to see all loads'}
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
        .sort((a, b) => {
            const { column, asc } = currentCitySort;
            let valA = a[column];
            let valB = b[column];

            // Si la columna es 'city', es string
            if (column === 'city') {
                return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            // Para numéricos (count, avgRPM, totalProfit)
            return asc ? (valA - valB) : (valB - valA);
        });

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
            emptyOverlay.innerHTML = `<div class="text-center p-8 text-gray-500">${window.i18n?.t('zones.no_data') || 'No loads to display'}</div>`;

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
                    <h3 class="text-lg font-semibold text-red-700 mb-2">${window.i18n?.t('zones.map_load_error_title') || 'Error loading SVG map'}</h3>
                    <p class="text-red-600 mb-4">${window.i18n?.t('zones.map_load_error_body') || 'The zones map could not load correctly'}</p>
                    <button onclick="retryZones()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                        ${window.i18n?.t('common.retry') || 'Retry'}
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
        debugLog('[LEX-ZONES] Iniciando análisis de zonas…');

        // 1. Asegurar datos de zonas ya calculados
        //    Preferimos usar resumenPorEstado si ya existe
        let stats = null;

        if (window.resumenPorEstado && Object.keys(window.resumenPorEstado).length > 0) {
            stats = window.resumenPorEstado;
            debugLog('[LEX-ZONES] Usando resumenPorEstado existente');
        } else {
            // Si no existe, cargamos del historial en Firebase
            const user = firebase.auth().currentUser;
            if (!user) {
                alert(window.i18n?.t('zones.login_required') || 'You must log in to see zones');
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
                        message: window.i18n?.t('zones.no_loads') || 'No loads to analyze zones yet 🗺️',
                        duration: 5000
                    });
                }
                alert(window.i18n?.t('zones.no_loads') || 'No loads to analyze zones');
                return;
            }

            debugLog('[LEX-ZONES] Calculando estadísticas desde loads…');

            // Usa tu función original de zonas
            if (typeof calcularEstadisticas === 'function') {
                stats = calcularEstadisticas(loads);
            } else {
                debugLog('[LEX-ZONES] calcularEstadisticas no está definida');
                alert(window.i18n?.t('zones.no_enough_data') || 'Not enough data to generate statistics.');
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

        debugLog('[LEX-ZONES] Análisis completado:', analysis);
        return analysis;
    } catch (err) {
        debugLog('[LEX-ZONES] Error:', err);
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

    const _isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

    if (verdes > 0) {
        insights.push(_isEs
            ? `Tienes ${verdes} zonas verdes con buen RPM (>$1.05/mi)`
            : `You have ${verdes} green zones with good RPM (>$1.05/mi)`);
    }
    if (top.length > 0) {
        insights.push(_isEs
            ? `Tu mejor zona es ${top[0].state} con $${top[0].avgRPM.toFixed(2)}/mi`
            : `Your best zone is ${top[0].state} at $${top[0].avgRPM.toFixed(2)}/mi`);
    }
    if (totalProfit > 0) {
        insights.push(_isEs
            ? `Has generado $${totalProfit.toFixed(0)} en profit total en estas zonas`
            : `You have generated $${totalProfit.toFixed(0)} in total profit across these zones`);
    }

    if (rojas > 0) {
        alerts.push(_isEs
            ? `Tienes ${rojas} zonas rojas con RPM bajo (<$0.75/mi)`
            : `You have ${rojas} red zones with low RPM (<$0.75/mi)`);
    }
    if (amarillas > verdes) {
        alerts.push(_isEs
            ? `La mayoría de tus zonas son amarillas - busca oportunidades para mejorar RPM`
            : `Most of your zones are yellow — look for opportunities to improve RPM`);
    }
    if (worst.length > 0 && worst[0].avgRPM < 0.70) {
        alerts.push(_isEs
            ? `Evita ${worst[0].state} - solo genera $${worst[0].avgRPM.toFixed(2)}/mi`
            : `Avoid ${worst[0].state} — only generates $${worst[0].avgRPM.toFixed(2)}/mi`);
    }

    const summary = _isEs
        ? `Tienes ${verdes} estados verdes (buen RPM), ${amarillas} amarillos y ${rojas} rojos. ` +
          (top.length
              ? `Tus mejores zonas ahora mismo: ${top.map(t => `${t.state} ($${t.avgRPM.toFixed(2)}/mi)`).join(', ')}.`
              : 'Necesito más datos para identificar claramente tus mejores zonas.')
        : `You have ${verdes} green states (good RPM), ${amarillas} yellow and ${rojas} red. ` +
          (top.length
              ? `Your best zones right now: ${top.map(t => `${t.state} ($${t.avgRPM.toFixed(2)}/mi)`).join(', ')}.`
              : 'I need more data to clearly identify your best zones.');

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

    const _isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

    const safeNumber = (n, dec = 2) => {
        const v = Number(n);
        if (!Number.isFinite(v)) return '--';
        return v.toFixed(dec);
    };

    const t = (fallbackEn, fallbackEs) => _isEs ? fallbackEs : fallbackEn;

    const modal = document.createElement('div');
    modal.id = 'lexZonesModal';
    modal.className =
        'fixed inset-0 flex items-center justify-center z-50 p-4';
    style = "background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px);"
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style="max-height:90vh;">

      <!-- Header -->
      <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-2xl flex-shrink-0">
        <div class="flex items-center gap-3">
          <img src="img/lex/lex-thinking.png" class="w-10 h-10 rounded-full bg-white/10 p-1">
          <div>
            <h3 class="text-lg font-bold">${t('Zone Analysis', 'Análisis de Zonas')}</h3>
            <p class="text-xs text-purple-100">
              ${t('Based on your real load history by state', 'Basado en tu historial real de cargas por estado')}
            </p>
          </div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        <!-- KPIs principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p class="text-[10px] text-slate-500 uppercase">${t('States analyzed', 'Estados analizados')}</p>
            <p class="text-lg font-bold text-slate-900">${analysis.total}</p>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <p class="text-[10px] text-emerald-600 uppercase">${t('Green zones', 'Zonas verdes')}</p>
            <p class="text-lg font-bold" style="color: #047857 !important;">${analysis.verdes}</p>
          </div>
          <div class="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
            <p class="text-[10px] text-yellow-600 uppercase">${t('Yellow zones', 'Zonas amarillas')}</p>
            <p class="text-lg font-bold" style="color: #a16207 !important;">${analysis.amarillas}</p>
          </div>
          <div class="bg-red-50 p-3 rounded-xl border border-red-200">
            <p class="text-[10px] text-red-600 uppercase">${t('Red zones', 'Zonas rojas')}</p>
            <p class="text-lg font-bold" style="color: #b91c1c !important;">${analysis.rojas}</p>
          </div>
        </div>

        <!-- Métricas globales -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <p class="text-xs text-blue-700 font-semibold mb-1">
              ${t('Global Performance', 'Rendimiento global')}
            </p>
            <p class="text-sm text-slate-800 mb-1">
              ${t('Avg RPM:', 'RPM promedio:')} <span class="font-bold">$${safeNumber(analysis.avgRPM, 2)}/mi</span>
            </p>
            <p class="text-xs text-slate-600">
              ${t('Miles', 'Millas')}: ${safeNumber(analysis.totalMiles, 0)} · ${t('Loads', 'Cargas')}: ${analysis.totalLoads}
            </p>
          </div>

          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs text-emerald-700 font-semibold mb-1">
              ${t('Total Profit', 'Profit total')}
            </p>
            <p class="text-lg font-bold" style="color: #047857 !important;">
              $${safeNumber(analysis.totalProfit, 0)}
            </p>
            <p class="text-xs text-slate-600">
              ${t('Generated across all zones', 'Generado en todas las zonas')}
            </p>
          </div>

          <div class="bg-purple-50 border border-purple-100 p-4 rounded-xl">
            <p class="text-xs text-purple-700 font-semibold mb-1">
              ${t('Total Revenue', 'Ingreso total')}
            </p>
            <p class="text-lg font-bold" style="color: #7e22ce !important;">
              $${safeNumber(analysis.totalRevenue, 0)}
            </p>
            <p class="text-xs text-slate-600">
              ${t('Accumulated revenue', 'Revenue acumulado')}
            </p>
          </div>
        </div>

        <!-- Mejores y peores estados -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-slate-700 mb-2">&#127942; ${t('Best States', 'Mejores estados')}</p>
            <ul class="space-y-1">
              ${analysis.top.length
            ? analysis.top
                .map(s => `
                <li class="text-xs text-emerald-800">
                  • ${s.state}: $${safeNumber(s.avgRPM, 2)}/mi (${s.count} ${t('loads', 'cargas')})
                </li>`)
                .join('')
            : `<li class="text-xs text-slate-500">${t('', "Not enough data to determine your best states yet.", "Aún no tengo suficientes datos para determinar tus mejores estados.")}</li>`
        }
            </ul>
          </div>

          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">&#9888;&#65039; ${t('Challenging States', 'Estados complicados')}</p>
            <ul class="space-y-1">
              ${analysis.worst.length
            ? analysis.worst
                .map(s => `
                <li class="text-xs text-amber-800">
                  • ${s.state}: $${safeNumber(s.avgRPM, 2)}/mi (${s.count} ${t('loads', 'cargas')})
                </li>`)
                .join('')
            : `<li class="text-xs text-amber-700">${t('No clearly problematic states detected yet.', 'No se detectaron estados claramente problemáticos aún.')}</li>`
        }
            </ul>
          </div>
        </div>

        <!-- Insights y Alertas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <p class="text-xs font-semibold text-emerald-800 mb-2">
              &#9989; ${t('Positive Points', 'Puntos positivos')}
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.insights && analysis.insights.length
            ? analysis.insights.map(i => `<li class="text-xs text-emerald-800">• ${i}</li>`).join('')
            : `<li class="text-xs text-emerald-700">${t('Not enough data to generate insights yet.', 'Aún no hay suficientes datos para generar insights.')}</li>`
        }
            </ul>
          </div>

          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 mb-2">
              &#128161; ${t('Alerts & Opportunities', 'Alertas y oportunidades')}
            </p>
            <ul class="space-y-1 max-h-40 overflow-y-auto pr-1">
              ${analysis.alerts && analysis.alerts.length
            ? analysis.alerts.map(a => `<li class="text-xs text-amber-800">• ${a}</li>`).join('')
            : `<li class="text-xs text-amber-700">${t('No significant alerts detected.', 'No se detectaron alertas importantes.')}</li>`
        }
            </ul>
          </div>
        </div>

        <!-- Resumen de estrategia -->
        <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <p class="text-xs font-semibold text-slate-700 mb-1">&#129517; ${t('Strategy Summary', 'Resumen de estrategia')}</p>
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
    💬 ${t('Chat with Lex', 'Chat con Lex')}
  </button>
  <button
    type="button"
    onclick="closeLexZonesModal()"
    class="lex-modal-btn lex-modal-btn-ghost"
  >
    ✕ ${t('Close', 'Cerrar')}
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

window.currentMarketNotes = [];
window.marketNotesTypeFilter = 'ALL';

// Cargar y mostrar todas las notas en el tab de Zonas
async function loadMarketNotes() {
    const container = document.getElementById('marketNotesList');
    if (!container || !window.currentUser) return;

    try {
        const snap = await firebase.firestore().collection('notes')
            .where('userId', '==', window.currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        if (snap.empty) {
            window.currentMarketNotes = [];
            container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No tienes notas guardadas aún.</p>';
            populateStatesDropdown();
            return;
        }

        window.currentMarketNotes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateStatesDropdown();
        renderMarketNotes();

    } catch (e) {
        debugLog('Error cargando notas:', e);
        container.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Error cargando notas.</p>';
    }
}

function populateStatesDropdown() {
    const select = document.getElementById('marketNotesStateFilter');
    if (!select) return;

    // Extract state from destination (e.g. "Miami, FL" -> "FL")
    const states = new Set();
    window.currentMarketNotes.forEach(note => {
        const dest = note.destination || note.key || '';
        const match = dest.match(/,\s*([A-Z]{2})/i);
        if (match) {
            states.add(match[1].toUpperCase());
        }
    });

    const currentVal = select.value;
    select.innerHTML = `<option value="ALL">${window.i18n?.t('zones.filter_all_states') || 'All States'}</option>`;

    Array.from(states).sort().forEach(state => {
        const opt = document.createElement('option');
        opt.value = state;
        opt.textContent = state;
        select.appendChild(opt);
    });

    if (states.has(currentVal)) {
        select.value = currentVal;
    }
}

window.setMarketNotesTypeFilter = function (type) {
    window.marketNotesTypeFilter = type;

    // Update button UI
    ['ALL', 'origen', 'destino', 'ambos'].forEach(t => {
        const btn = document.getElementById(`btnNotesType-${t}`);
        if (btn) {
            if (t === type) {
                btn.className = "px-3 py-1 rounded-full font-medium transition-colors leading-none market-filter-pill-active";
                btn.style.backgroundColor = "";
            } else {
                btn.className = "px-3 py-1 rounded-full font-medium transition-colors leading-none market-filter-pill";
                btn.style.backgroundColor = "";
            }
        }
    });

    renderMarketNotes();
}

window.renderMarketNotes = function () {
    const container = document.getElementById('marketNotesList');
    if (!container) return;

    if (window.currentMarketNotes.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500 text-center py-4">${window.i18n?.t('zones.no_notes') || 'No saved notes yet.'}</p>`;
        return;
    }

    const searchInput = document.getElementById('marketNotesSearch')?.value.toLowerCase() || '';
    const stateFilter = document.getElementById('marketNotesStateFilter')?.value || 'ALL';
    const typeFilter = window.marketNotesTypeFilter || 'ALL';

    const typeBadge = {
        destino: `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">${window.i18n?.t('zones.filter_destination') || 'Destination'}</span>`,
        origen: `<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">${window.i18n?.t('zones.filter_origin') || 'Origin'}</span>`,
        ambos: `<span class="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">${window.i18n?.t('zones.filter_both') || 'Both'}</span>`,
    };

    let filtered = window.currentMarketNotes.filter(d => {
        // Search Filter
        const searchable = `${d.destination || ''} ${d.key || ''} ${d.note || ''}`.toLowerCase();
        if (searchInput && !searchable.includes(searchInput)) return false;

        // Type Filter
        if (typeFilter !== 'ALL' && d.type !== typeFilter) return false;

        // State Filter
        if (stateFilter !== 'ALL') {
            const dest = d.destination || d.key || '';
            const match = dest.match(/,\s*([A-Z]{2})/i);
            const state = match ? match[1].toUpperCase() : '';
            if (state !== stateFilter) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay notas que coincidan con los filtros.</p>';
        return;
    }

    container.innerHTML = filtered.map(d => {
        const badge = typeBadge[d.type] || typeBadge['destino'];
        return `
        <div class="flex items-start justify-between bg-white border border-gray-200 rounded-lg p-3 gap-2">
            <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="font-medium text-sm text-gray-800">${d.destination || d.key}</span>
                ${badge}
            </div>
            <p class="text-sm text-gray-600">${d.note}</p>
            </div>
            <div class="flex gap-2 shrink-0">
            <button onclick="editMarketNote('${d.id}', \`${(d.note || '').replace(/`/g, "'")}\`)"
                class="text-blue-500 hover:text-blue-700 text-xs">✏️</button>
            <button onclick="deleteMarketNote('${d.id}')"
                class="text-red-400 hover:text-red-600 text-xs">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// Guardar nota desde el tab de Zonas
async function saveMarketNote() {
    debugLog(" [ZONES] saveMarketNote triggered");
    const input = document.getElementById('noteZoneInput');
    const textarea = document.getElementById('noteZoneText');
    const type = document.getElementById('noteZoneType');

    const destination = input?.value?.trim();
    const note = textarea?.value?.trim();
    const noteType = type?.value || 'destino';

    if (!destination) return alert(window.i18n?.t('notes.no_destination') || 'Enter a destination first');
    if (!note) return alert(window.i18n?.t('notes.write_note') || 'Note cannot be empty');
    if (!window.currentUser) return alert(window.i18n?.t('notes.must_login') || 'You must be logged in');

    try {
        debugLog(" [ZONES] Attempting to save note to Firestore:", { destination, note, noteType, uid: window.currentUser.uid });
        await firebase.firestore().collection('notes').add({
            userId: window.currentUser.uid,
            key: destination.toLowerCase().replace(/,.*$/, '').trim(),
            destination: destination,
            note: note,
            type: noteType,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        debugLog(" [ZONES] Note saved successfully");
        input.value = '';
        textarea.value = '';
        loadMarketNotes();
    } catch (e) {
        debugLog(' [ZONES] CRITICAL Error guardando nota:', e);
        console.trace(e);
        alert((window.i18n?.t('notes.error_save') || 'Error saving note') + ': ' + e.message);
    }
}

// Editar nota desde Zonas
async function editMarketNote(id, oldText) {
    const nuevo = prompt(window.i18n?.t('notes.edit_prompt') || 'Edit note:', oldText);
    if (!nuevo) return;
    await firebase.firestore().collection('notes').doc(id).update({ note: nuevo });
    loadMarketNotes();
}

// Borrar nota desde Zonas
async function deleteMarketNote(id) {
    if (!confirm('¿Borrar esta nota?')) return;
    await firebase.firestore().collection('notes').doc(id).delete();
    loadMarketNotes();
}

function initNoteZoneAutocomplete() {
    const input = document.getElementById('noteZoneInput');
    if (!input || !window.google?.maps?.places) return;

    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        componentRestrictions: { country: ['us', 'ca'] }
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
            input.value = place.formatted_address;
        }
    });
}

window.initNoteZoneAutocomplete = initNoteZoneAutocomplete;

// Exponer globalmente
window.saveMarketNote = saveMarketNote;
window.editMarketNote = editMarketNote;
window.deleteMarketNote = deleteMarketNote;
window.loadMarketNotes = loadMarketNotes;

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

// Funcin de ordenamiento para ciudades
function sortCitiesBy(column) {
    if (currentCitySort.column === column) {
        currentCitySort.asc = !currentCitySort.asc;
    } else {
        currentCitySort.column = column;
        currentCitySort.asc = false; // Default desc para métricas, asc para texto
        if (column === 'city') currentCitySort.asc = true;
    }

    // Actualizar iconos
    updateCitySortIcons();
    renderCitiesTable();
}

function updateCitySortIcons() {
    ['city', 'count', 'avgRPM', 'totalProfit'].forEach(col => {
        const icon = document.getElementById(`sort-city-${col}`);
        if (icon) {
            if (currentCitySort.column === col) {
                icon.textContent = currentCitySort.asc ? '↑' : '↓';
                icon.className = 'ml-1 text-blue-600 font-bold';
            } else {
                icon.textContent = '↕';
                icon.className = 'ml-1 text-gray-400';
            }
        }
    });
}
window.sortCitiesBy = sortCitiesBy;

debugLog(" Zones.js cargado completamente (VERSIN CORREGIDA + Mapa de Ciudades)");
