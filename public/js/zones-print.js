//  zones.js - VERSIN COMPLETAMENTE CORREGIDA + PRINT FUNCTIONALITY

// Note: Este archivo es demasiado grande. Solo agregaré las funciones de impresión al final.
// Por favor agrega este código al final de zones.js antes de la línea debugLog final.

// ======================================================
// PRINT & EXPORT FUNCTIONALITY
// ======================================================

function generateZonesReport() {
    const currentDate = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Get sorted zones
    const sortedZones = Object.entries(resumenPorEstado)
        .map(([state, stats]) => ({
            state,
            rpm: rpmPorEstado[state] || 0,
            count: stats.count,
            profit: stats.totalProfit,
            revenue: stats.totalRevenue
        }))
        .sort((a, b) => b.rpm - a.rpm);

    const topZones = sortedZones.slice(0, 5);
    const worstZones = sortedZones.slice(-5).reverse();

    return `
        <!-- Header -->
        <div class="text-center mb-8 border-b-2 border-gray-300 pb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">📊 ANÁLISIS DE ZONAS</h1>
            <h2 class="text-xl text-blue-600 font-semibold mb-2">Revenue Per Mile (RPM) Analysis</h2>
            <p class="text-gray-600 mt-2">Generado el: <span class="font-semibold">${currentDate}</span></p>
            <p class="text-sm text-gray-500">Total de estados analizados: ${sortedZones.length}</p>
        </div>
        
        <!-- Executive Summary -->
        <div class="mb-8">
            <h3 class="text-xl font-bold text-gray-900 mb-4">🎯 Resumen Ejecutivo</h3>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="bg-white border border-gray-300 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Estados Analizados</p>
                    <p class="text-2xl font-bold text-gray-900">${sortedZones.length}</p>
                </div>
                <div class="bg-white border border-gray-300 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Cargas Totales</p>
                    <p class="text-2xl font-bold text-gray-900">${sortedZones.reduce((sum, z) => sum + z.count, 0)}</p>
                </div>
                <div class="bg-white border border-gray-300 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Ganancia Total</p>
                    <p class="text-2xl font-bold text-green-900">$${sortedZones.reduce((sum, z) => sum + z.profit, 0).toFixed(2)}</p>
                </div>
                <div class="bg-white border border-gray-300 rounded-lg p-4">
                    <p class="text-sm text-gray-600">RPM Promedio</p>
                    <p class="text-2xl font-bold text-blue-900">$${(sortedZones.reduce((sum, z) => sum + z.rpm, 0) / sortedZones.length).toFixed(2)}</p>
                </div>
            </div>
        </div>
        
        <!-- Top 5 Best Zones -->
        <div class="mb-8 zone-section">
            <h3 class="text-xl font-bold text-green-900 mb-4">🟢 Top 5 Mejores Zonas</h3>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-white border border-black">
                        <th class="border border-black p-2 text-left">Estado</th>
                        <th class="border border-black p-2 text-right">RPM</th>
                        <th class="border border-black p-2 text-right">Cargas</th>
                        <th class="border border-black p-2 text-right">Ganancia</th>
                    </tr>
                </thead>
                <tbody>
                    ${topZones.map(z => `
                        <tr class="border border-black">
                            <td class="border border-black p-2 font-bold">${z.state}</td>
                            <td class="border border-black p-2 text-right">$${z.rpm.toFixed(2)}</td>
                            <td class="border border-black p-2 text-right">${z.count}</td>
                            <td class="border border-black p-2 text-right">$${z.profit.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Bottom 5 Worst Zones -->
        <div class="mb-8 zone-section">
            <h3 class="text-xl font-bold text-red-900 mb-4">🔴 Top 5 Zonas a Evitar</h3>
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-white border border-black">
                        <th class="border border-black p-2 text-left">Estado</th>
                        <th class="border border-black p-2 text-right">RPM</th>
                        <th class="border border-black p-2 text-right">Cargas</th>
                        <th class="border border-black p-2 text-right">Ganancia</th>
                    </tr>
                </thead>
                <tbody>
                    ${worstZones.map(z => `
                        <tr class="border border-black">
                            <td class="border border-black p-2 font-bold">${z.state}</td>
                            <td class="border border-black p-2 text-right">$${z.rpm.toFixed(2)}</td>
                            <td class="border border-black p-2 text-right">${z.count}</td>
                            <td class="border border-black p-2 text-right">$${z.profit.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- All Zones Table -->
        <div class="mb-8 zone-section">
            <h3 class="text-xl font-bold text-gray-900 mb-4">📋 Todas las Zonas</h3>
            <table class="w-full border-collapse text-sm">
                <thead>
                    <tr class="bg-white border border-black">
                        <th class="border border-black p-2 text-left">Estado</th>
                        <th class="border border-black p-2 text-center">Zona</th>
                        <th class="border border-black p-2 text-right">RPM</th>
                        <th class="border border-black p-2 text-right">Cargas</th>
                        <th class="border border-black p-2 text-right">Ganancia</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedZones.map(z => {
        const zoneLabel = z.rpm >= 1.05 ? 'Verde' : z.rpm >= 0.75 ? 'Amarilla' : 'Roja';
        return `
                            <tr class="border border-black">
                                <td class="border border-black p-2 font-semibold">${z.state}</td>
                                <td class="border border-black p-2 text-center">${zoneLabel}</td>
                                <td class="border border-black p-2 text-right">$${z.rpm.toFixed(2)}</td>
                                <td class="border border-black p-2 text-right">${z.count}</td>
                                <td class="border border-black p-2 text-right">$${z.profit.toFixed(2)}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Legend -->
        <div class="mt-8 bg-white border border-gray-300 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3">📌 Leyenda de Zonas</h4>
            <ul class="space-y-2 text-sm text-gray-800">
                <li>🟢 <strong>Zona Verde:</strong> RPM ≥ $1.05 - Zonas altamente rentables</li>
                <li>🟡 <strong>Zona Amarilla:</strong> RPM $0.75 - $1.05 - Zonas aceptables</li>
                <li>🔴 <strong>Zona Roja:</strong> RPM < $0.75 - Zonas a evitar</li>
            </ul>
        </div>
    `;
}

function printZonesReport() {
    const reportHTML = generateZonesReport();

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'zonesReportModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4';
    modal.style.backdropFilter = 'blur(4px)';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-auto" style="max-height: 90vh; display: flex; flex-direction: column;">
            <!-- Header (Fijo) -->
            <div class="modal-header bg-gradient-to-r from-blue-700 to-purple-700 text-white p-4 flex justify-between items-center flex-shrink-0">
                <div>
                    <h2 class="text-2xl font-bold">📊 Análisis de Zonas</h2>
                    <p class="text-sm opacity-90">Reporte Completo</p>
                </div>
                <button onclick="closeZonesReportModal()" class="text-white hover:text-gray-300 text-2xl font-bold">×</button>
            </div>
            
            <!-- Contenido del Reporte (Scrollable) -->
            <div id="zonesReportContent" class="flex-1 p-6 bg-white" style="overflow-y: auto; min-height: 0;">
                ${reportHTML}
            </div>
            
            <!-- Footer del Modal (Fijo) -->
            <div class="flex-shrink-0 bg-white border-t p-3 flex justify-center gap-2">
                <button onclick="printZonesReportClean()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    🖨️ Imprimir / PDF
                </button>
                <button onclick="closeZonesReportModal()" class="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg text-sm font-medium" style="color: #374151;">
                    ❌ Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // ✅ Block body scroll
    document.body.style.overflow = 'hidden';

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeZonesReportModal();
    });
}

function closeZonesReportModal() {
    const modal = document.getElementById('zonesReportModal');
    if (modal) modal.remove();

    // ✅ Restore body scroll
    document.body.style.overflow = '';
}

// ✅ CLEAN PRINT - Opens new window with only report content
function printZonesReportClean() {
    const reportHTML = generateZonesReport();

    // Open new clean window
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Análisis de Zonas - Reporte</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: Arial, sans-serif; 
                    font-size: 11pt; 
                    padding: 20px; 
                    background: white;
                    color: black;
                }
                h1 { font-size: 16pt; margin: 10px 0; }
                h2 { font-size: 14pt; margin: 8px 0; }
                h3 { font-size: 12pt; margin: 6px 0; }
                p { margin: 4px 0; }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    font-size: 9pt; 
                    margin: 10px 0;
                }
                th, td { 
                    border: 1px solid black; 
                    padding: 4px; 
                    text-align: left; 
                }
                .grid { 
                    display: grid; 
                    grid-template-columns: repeat(2, 1fr); 
                    gap: 10px; 
                    margin: 10px 0;
                }
                .grid > div {
                    border: 1px solid #ccc;
                    padding: 8px;
                }
                .mb-8 { margin-bottom: 15px; }
                .mb-4 { margin-bottom: 8px; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .text-2xl { font-size: 16pt; }
                .text-3xl { font-size: 18pt; }
                .text-xl { font-size: 14pt; }
                .text-sm { font-size: 9pt; }
                .border-b-2 { border-bottom: 2px solid black; padding-bottom: 10px; }
                .rounded-lg { border: 1px solid #ccc; padding: 8px; margin: 5px 0; }
                .zone-section { margin: 15px 0; }
                ul { padding-left: 20px; }
                li { margin: 3px 0; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${reportHTML}
        </body>
        </html>
    `);

    printWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Export functions
window.generateZonesReport = generateZonesReport;
window.printZonesReport = printZonesReport;
window.closeZonesReportModal = closeZonesReportModal;
window.printZonesReportClean = printZonesReportClean;

debugLog("✅ Zones print functionality loaded");
