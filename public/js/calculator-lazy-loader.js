/**
 * calculator-lazy-loader.js
 * Lazy loading system for calculator modules
 * Version: 1.0.0
 */

// ========================================
// CONFIGURATION
// ========================================

const CALCULATOR_MODULES = {
    weather: {
        path: 'js/calculator-weather.js',
        size: '~8KB',
        export: 'CalculatorWeather'
    },
    decision: {
        path: 'js/calculator-decision.js',
        size: '~14KB',
        export: 'CalculatorDecision'
    },
    maps: {
        path: 'js/calculator-maps.js',
        size: '~8KB',
        export: 'CalculatorMaps'
    },
    notes: {
        path: 'js/calculator-notes.js',
        size: '~10KB',
        export: 'CalculatorNotes'
    }
};

// ========================================
// LOADER HELPERS
// ========================================

/**
 * Load script dynamically
 */
function loadScript(src, moduleName) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        const existingScript = document.querySelector(`script[src*="${src}"]`);
        if (existingScript) {
            console.log(`✅ Module already loaded: ${moduleName}`);
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `${src}?v=1.0.0`;
        script.async = true;

        script.onload = () => {
            console.log(`✅ Module loaded: ${moduleName}`);
            resolve();
        };

        script.onerror = () => {
            console.error(`❌ Error loading module: ${moduleName}`);
            reject(new Error(`Failed to load ${moduleName}`));
        };

        document.head.appendChild(script);
    });
}

// ========================================
// MODULE LOADERS
// ========================================

/**
 * Load Weather module
 */
async function loadWeatherModule() {
    if (window.CalculatorWeather) {
        console.log("📦 Weather module already loaded");
        return Promise.resolve();
    }

    console.log("📦 Loading Weather module...");

    try {
        await loadScript(CALCULATOR_MODULES.weather.path, 'Weather');

        if (!window.CalculatorWeather) {
            throw new Error('Weather module not exported correctly');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error loading Weather module:', error);
        return Promise.reject(error);
    }
}

/**
 * Load Decision module
 */
async function loadDecisionModule() {
    if (window.CalculatorDecision) {
        console.log("📦 Decision module already loaded");
        return Promise.resolve();
    }

    console.log("📦 Loading Decision module...");

    try {
        await loadScript(CALCULATOR_MODULES.decision.path, 'Decision');

        if (!window.CalculatorDecision) {
            throw new Error('Decision module not exported correctly');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error loading Decision module:', error);
        return Promise.reject(error);
    }
}

/**
 * Load Maps module
 */
async function loadMapsModule() {
    if (window.CalculatorMaps) {
        console.log("📦 Maps module already loaded");
        return Promise.resolve();
    }

    console.log("📦 Loading Maps module...");

    try {
        await loadScript(CALCULATOR_MODULES.maps.path, 'Maps');

        if (!window.CalculatorMaps) {
            throw new Error('Maps module not exported correctly');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error loading Maps module:', error);
        return Promise.reject(error);
    }
}

/**
 * Load Notes module
 */
async function loadNotesModule() {
    if (window.CalculatorNotes) {
        console.log("📦 Notes module already loaded");
        return Promise.resolve();
    }

    console.log("📦 Loading Notes module...");

    try {
        await loadScript(CALCULATOR_MODULES.notes.path, 'Notes');

        if (!window.CalculatorNotes) {
            throw new Error('Notes module not exported correctly');
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error loading Notes module:', error);
        return Promise.reject(error);
    }
}

// ========================================
// LAZY WRAPPERS
// ========================================

/**
 * Wrapper for getWeatherForDestination
 */
async function getWeatherForDestinationLazy(destination) {
    try {
        await loadWeatherModule();
        return window.CalculatorWeather.getWeatherForDestination(destination);
    } catch (error) {
        console.error('Error loading weather:', error);
        return null;
    }
}

/**
 * Wrapper for loadRouteMap
 */
async function loadRouteMapLazy() {
    try {
        await loadWeatherModule();
        window.CalculatorWeather.loadRouteMap();
    } catch (error) {
        console.error('Error loading route map:', error);
    }
}

/**
 * Wrapper for getDecisionInteligente
 */
async function getDecisionInteligenteLazy(rpm, millas, factores) {
    try {
        await loadDecisionModule();
        return window.CalculatorDecision.getDecisionInteligente(rpm, millas, factores);
    } catch (error) {
        console.error('Error loading decision:', error);
        return null;
    }
}

/**
 * Wrapper for initGoogleMaps
 */
async function initGoogleMapsLazy() {
    try {
        await loadMapsModule();
        window.CalculatorMaps.initGoogleMaps();
    } catch (error) {
        console.error('Error loading maps:', error);
    }
}

/**
 * Wrapper for showDestin

ationNotes
 */
async function showDestinationNotesLazy(destination) {
    try {
        await loadNotesModule();
        window.CalculatorNotes.showDestinationNotes(destination);
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

/**
 * Wrapper for openNotesModal
 */
async function openNotesModalLazy(destination) {
    try {
        await loadNotesModule();
        window.CalculatorNotes.openNotesModal(destination);
    } catch (error) {
        console.error('Error loading notes modal:', error);
    }
}

// ========================================
// EXPORTS
// ========================================

// Export loaders
window.loadWeatherModule = loadWeatherModule;
window.loadDecisionModule = loadDecisionModule;
window.loadMapsModule = loadMapsModule;
window.loadNotesModule = loadNotesModule;

// Export lazy wrappers
window.getWeatherForDestinationLazy = getWeatherForDestinationLazy;
window.loadRouteMapLazy = loadRouteMapLazy;
window.getDecisionInteligenteLazy = getDecisionInteligenteLazy;
window.initGoogleMapsLazy = initGoogleMapsLazy;
window.showDestinationNotesLazy = showDestinationNotesLazy;
window.openNotesModalLazy = openNotesModalLazy;

console.log("🚀 Calculator lazy loader initialized successfully");
console.log("📦 Modules available for lazy loading:", Object.keys(CALCULATOR_MODULES));
