/*
// mock-data.js - Datos ficticios para testing de V2
// Simula cargas guardadas en Firebase

window.MOCK_DATA_ENABLED = false; // DESACTIVADO - Usando datos reales de Firebase


// Generar datos ficticios realistas
window.generateMockLoads = function () {
    const mockLoads = [];
    const currentDate = new Date();

    // Ciudades comunes del Midwest
    const cities = [
        { city: 'Chicago, IL', state: 'IL' },
        { city: 'Detroit, MI', state: 'MI' },
        { city: 'Indianapolis, IN', state: 'IN' },
        { city: 'Columbus, OH', state: 'OH' },
        { city: 'Milwaukee, WI', state: 'WI' },
        { city: 'Minneapolis, MN', state: 'MN' },
        { city: 'Kansas City, MO', state: 'MO' },
        { city: 'St. Louis, MO', state: 'MO' },
        { city: 'Cleveland, OH', state: 'OH' },
        { city: 'Cincinnati, OH', state: 'OH' },
        { city: 'Louisville, KY', state: 'KY' },
        { city: 'Nashville, TN', state: 'TN' },
        { city: 'Atlanta, GA', state: 'GA' },
        { city: 'Charlotte, NC', state: 'NC' },
        { city: 'Dallas, TX', state: 'TX' },
        { city: 'Phoenix, AZ', state: 'AZ' }
    ];

    const companies = [
        'XPO Logistics',
        'Fedex Ground',
        'Panther Premium',
        'Load One',
        'Bolt Express',
        'Landstar',
        'CH Robinson',
        'TQL Logistics'
    ];

    // Generar 50 cargas de los últimos 3 meses
    for (let i = 0; i < 50; i++) {
        const daysAgo = Math.floor(Math.random() * 90); // Últimos 90 días
        const loadDate = new Date(currentDate);
        loadDate.setDate(loadDate.getDate() - daysAgo);

        const origin = cities[Math.floor(Math.random() * cities.length)];
        const destination = cities[Math.floor(Math.random() * cities.length)];

        // Generar millas (200-800)
        const loadedMiles = Math.floor(Math.random() * 600) + 200;
        const deadheadMiles = Math.floor(Math.random() * 100);
        const totalMiles = loadedMiles + deadheadMiles;

        // RPM realista (0.80 - 2.50)
        const rpm = (Math.random() * 1.7 + 0.80).toFixed(2);

        // Cálculos
        const rate = Math.round(rpm * loadedMiles);
        const tolls = Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0;
        const otherCosts = Math.random() > 0.8 ? Math.floor(Math.random() * 30) : 0;

        const fuelCost = totalMiles * 0.182;
        const operatingCost = totalMiles * 0.346;
        const maintenanceCost = totalMiles * 0.020;
        const foodCost = totalMiles * 0.028;

        const totalExpenses = fuelCost + operatingCost + maintenanceCost + foodCost + tolls + otherCosts;
        const totalCharge = rate + tolls + otherCosts;
        const netProfit = totalCharge - totalExpenses;
        const profitMargin = (netProfit / totalCharge) * 100;

        mockLoads.push({
            id: `mock_${Date.now()}_${i}`,
            date: loadDate.toISOString().split('T')[0],
            loadNumber: `LOAD${1000 + i}`,
            origin: origin.city,
            destination: destination.city,
            originState: origin.state,
            destinationState: destination.state,
            companyName: companies[Math.floor(Math.random() * companies.length)],
            loadedMiles: loadedMiles,
            deadheadMiles: deadheadMiles,
            totalMiles: totalMiles,
            rpm: parseFloat(rpm),
            rate: rate,
            tolls: tolls,
            otherCosts: otherCosts,
            totalCharge: totalCharge,
            fuelCost: parseFloat(fuelCost.toFixed(2)),
            operatingCost: parseFloat(operatingCost.toFixed(2)),
            maintenanceCost: parseFloat(maintenanceCost.toFixed(2)),
            foodCost: parseFloat(foodCost.toFixed(2)),
            totalExpenses: parseFloat(totalExpenses.toFixed(2)),
            netProfit: parseFloat(netProfit.toFixed(2)),
            profit: parseFloat(netProfit.toFixed(2)), // Alias para compatibilidad
            profitMargin: parseFloat(profitMargin.toFixed(2)),
            notes: Math.random() > 0.7 ? 'Carga de prueba generada automáticamente' : '',
            userId: 'mock_user_123',
            createdAt: new Date(loadDate)
        });
    }

    // Ordenar por fecha (más recientes primero)
    mockLoads.sort((a, b) => new Date(b.date) - new Date(a.date));

    return mockLoads;
};

// Función para simular carga de Firebase
window.loadMockData = function () {
    console.log('📊 Cargando datos ficticios para testing...');

    const mockLoads = window.generateMockLoads();

    // Inyectar en variables globales que usa la app
    window.allLoads = mockLoads;
    window.allData = mockLoads; // Para history.js
    window.filteredData = mockLoads; // Para history.js
    window.allFinancesData = mockLoads; // Para finances.js

    console.log(`✅ ${mockLoads.length} cargas ficticias cargadas`);
    console.log('💰 Revenue total:', mockLoads.reduce((sum, l) => sum + l.totalCharge, 0).toLocaleString());
    console.log('📈 Profit total:', mockLoads.reduce((sum, l) => sum + l.netProfit, 0).toLocaleString());

    return mockLoads;
};

// Usuario ficticio
window.MOCK_USER = {
    uid: 'mock_user_123',
    email: 'demo@expediter.com',
    displayName: 'Demo User',
    emailVerified: true
};

// Auto-cargar si está habilitado
if (window.MOCK_DATA_ENABLED) {
    document.addEventListener('DOMContentLoaded', function () {
        console.log('🎭 MODO MOCK DATA ACTIVADO');
        console.log('Para usar datos reales, cambia MOCK_DATA_ENABLED = false en mock-data.js');

        // Simular usuario autenticado
        window.currentUser = window.MOCK_USER;

        // Cargar datos después de un momento
        setTimeout(() => {
            const mockLoads = window.loadMockData();

            // Ocultar login screen y mostrar app
            const loginScreen = document.getElementById('loginScreen');
            const appContent = document.getElementById('appContent');
            if (loginScreen) loginScreen.classList.add('hidden');
            if (appContent) appContent.classList.remove('hidden');

            console.log('✨ App mostrada, esperando funciones...');

            // Esperar a que todas las funciones estén cargadas
            setTimeout(() => {
                // HISTORIAL - Forzar renderizado
                if (typeof renderFilteredImmediate === 'function') {
                    console.log('📋 Renderizando historial...');
                    renderFilteredImmediate();
                } else if (typeof getLoadHistory === 'function') {
                    console.log('📋 Llamando getLoadHistory...');
                    getLoadHistory();
                }

                // FINANZAS - Forzar renderizado
                if (typeof loadFinancesData === 'function') {
                    console.log('💰 Cargando finanzas...');
                    loadFinancesData();
                }

                console.log('✅ Todas las funciones llamadas');
            }, 2000);
        }, 1000);
    });
}

console.log('✅ Mock Data System cargado');
*/
