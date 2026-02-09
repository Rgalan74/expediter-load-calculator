/**
 * LAZY MODULE LOADER - Performance Optimization
 * Loads heavy modules only when needed
 */

class LazyModuleLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingModules = new Map();
    }

    /**
     * Load a module if not already loaded
     * @param {string} moduleName - Name of the module
     * @param {string} scriptPath - Path to the script
     * @param {Function} initCallback - Optional callback after load
     * @returns {Promise}
     */
    async load(moduleName, scriptPath, initCallback = null) {
        // Already loaded
        if (this.loadedModules.has(moduleName)) {
            return Promise.resolve();
        }

        // Currently loading
        if (this.loadingModules.has(moduleName)) {
            return this.loadingModules.get(moduleName);
        }

        console.log(`📦 Lazy loading module: ${moduleName}`);

        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = true;

            script.onload = () => {
                this.loadedModules.add(moduleName);
                this.loadingModules.delete(moduleName);
                console.log(`✅ Loaded: ${moduleName}`);

                if (initCallback && typeof initCallback === 'function') {
                    initCallback();
                }

                resolve();
            };

            script.onerror = () => {
                this.loadingModules.delete(moduleName);
                console.error(`❌ Failed to load: ${moduleName}`);
                reject(new Error(`Failed to load ${moduleName}`));
            };

            document.head.appendChild(script);
        });

        this.loadingModules.set(moduleName, loadPromise);
        return loadPromise;
    }

    /**
     * Load multiple modules in parallel
     * @param {Array} modules - Array of {name, path, callback}
     * @returns {Promise}
     */
    async loadMultiple(modules) {
        const promises = modules.map(({ name, path, callback }) =>
            this.load(name, path, callback)
        );
        return Promise.all(promises);
    }

    /**
     * Check if module is loaded
     * @param {string} moduleName
     * @returns {boolean}
     */
    isLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }
}

// Global instance
window.lazyLoader = window.lazyLoader || new LazyModuleLoader();

/**
 * FINANCE MODULE - Lazy Load
 */
async function loadFinancesModule() {
    if (window.lazyLoader.isLoaded('finances')) {
        return;
    }

    await window.lazyLoader.loadMultiple([
        { name: 'finances-core', path: '/js/finances-core.js' },
        { name: 'finances-data', path: '/js/finances-data.js' },
        { name: 'finances-ui', path: '/js/finances-ui.js' },
        { name: 'finances-expenses', path: '/js/finances-expenses.js' },
        { name: 'finances-charts', path: '/js/finances-charts.js' },
        { name: 'finances-reports', path: '/js/finances-reports-v2.js' }
    ]);

    // Mark main module as loaded
    window.lazyLoader.loadedModules.add('finances');
}

/**
 * LEX AI MODULE - Lazy Load
 */
async function loadLexModule() {
    if (window.lazyLoader.isLoaded('lex')) {
        return;
    }

    await window.lazyLoader.loadMultiple([
        { name: 'lex-intents', path: '/js/lex-intents.js' },
        { name: 'lex-learning', path: '/js/lex-learning.js' },
        { name: 'lex-brain', path: '/js/lex-ai-brain.js' },
        { name: 'lex-router', path: '/js/lex-router.js' }
    ]);

    window.lazyLoader.loadedModules.add('lex');
}

/**
 * ZONES MODULE - Lazy Load
 */
async function loadZonesModule() {
    if (window.lazyLoader.isLoaded('zones')) {
        return;
    }

    await window.lazyLoader.load('zones', '/js/zones.js');
}

/**
 * ADMIN PANEL - Lazy Load
 */
async function loadAdminModule() {
    if (window.lazyLoader.isLoaded('admin')) {
        return;
    }

    await window.lazyLoader.load('admin', '/js/admin-panel.js');
}

/**
 * SETTINGS MODULE - Lazy Load
 */
async function loadSettingsModule() {
    if (window.lazyLoader.isLoaded('settings')) {
        return;
    }

    await window.lazyLoader.load('settings', '/js/settings.js');
}

// Expose to global scope
window.loadFinancesModule = loadFinancesModule;
window.loadLexModule = loadLexModule;
window.loadZonesModule = loadZonesModule;
window.loadAdminModule = loadAdminModule;
window.loadSettingsModule = loadSettingsModule;

console.log('🚀 Lazy Module Loader initialized');
