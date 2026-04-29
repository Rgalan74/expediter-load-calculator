/**
 * language-manager.js
 * Motor central de internacionalización (i18n) para la app Expediter.
 * Maneja la carga de JSONs, el reemplazo en el DOM y la preferencia de idioma.
 */

// Safe fallback: debugLog may not be defined on standalone pages (about, contact, etc.)
if (typeof debugLog === 'undefined') {
    window.debugLog = () => {};
}

class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('app_language') || 'en'; // Inglés por defecto
        this.translations = {};
        this.isLoading = false;
        this.initialized = false;
        this.observers = [];
    }

    /**
     * Inicializa el motor, cargando el archivo JSON correspondiente
     */
    async init() {
        debugLog(`[I18N] Inicializando LanguageManager con idioma de preferencia: ${this.currentLang}`);
        await this.loadDeviceLanguageIfNoPreference();
        await this.loadTranslations(this.currentLang);
        this.applyTranslationsToDOM();
        this.initialized = true;
    }

    /**
     * Si no hay preferencia guardada, intenta adivinar por el navegador (opcional)
     */
    async loadDeviceLanguageIfNoPreference() {
        if (!localStorage.getItem('app_language')) {
            const browserLang = navigator.language.split('-')[0];
            if (browserLang === 'es') {
                this.currentLang = 'es';
                debugLog(`[I18N] Idioma detectado del navegador: es`);
            }
        }
    }

    /**
     * Carga el archivo JSON con las traducciones desde el servidor
     */
    async loadTranslations(lang) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // Se usa cache-busting basico para desarrollo, quitar timestamp en prod agresivo si se prefiere
            const response = await fetch(`/js/i18n/${lang}.json?v=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error(`[I18N] Error http ${response.status} cargando ${lang}.json`);
            }
            this.translations = await response.json();
            debugLog(`✅ [I18N] Traducciones cargadas para: ${lang}`);
        } catch (error) {
            debugLog(`❌ [I18N] Error cargando idioma ${lang}:`, error);
            // Fallback a inglés si falla el español, etc.
            if (lang !== 'en') {
                debugLog(`[I18N] Reintentando con 'en' (fallback)`);
                await this.loadTranslations('en');
            }
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Cambia el idioma de la app on-the-fly
     */
    async setLanguage(lang) {
        if (lang === this.currentLang && this.initialized) return;

        debugLog(`[I18N] Cambiando idioma a: ${lang}`);
        this.currentLang = lang;
        localStorage.setItem('app_language', lang);
        
        // Guardar preferencia en Firestore si el usuario está logueado
        this.saveLanguageToFirebase(lang);

        await this.loadTranslations(lang);
        this.applyTranslationsToDOM();
        
        // Disparar evento para que otros módulos se actualicen (ej: charts)
        this.notifyObservers(lang);
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    /**
     * Guarda la selección en Firebase para mantenerla entre dispositivos
     */
    saveLanguageToFirebase(lang) {
        if (window.currentUser && window.db) {
            try {
                window.db.collection('users').doc(window.currentUser.uid).set({
                    preferredLanguage: lang
                }, { merge: true });
                debugLog(`[I18N] Preferencia guardada en Firestore`);
            } catch (err) {
                debugLog(`❌ [I18N] Error guardando preferencia de idioma en Firestore`, err);
            }
        }
    }

    /**
     * Aplica el idioma preferido del usuario desde su perfil de Firestore.
     * Recibe userData ya cargado para evitar una segunda lectura de Firestore.
     * Llamado por config.js justo después de leer el perfil del usuario.
     */
    async applyUserLanguage(userData) {
        const savedLang = userData?.preferredLanguage;
        if (savedLang && savedLang !== this.currentLang) {
            debugLog(`[I18N] Aplicando idioma de cuenta: ${savedLang}`);
            await this.setLanguage(savedLang);
        } else if (!savedLang) {
            debugLog(`[I18N] Sin preferencia en Firestore, manteniendo: ${this.currentLang}`);
        }
    }

    /**
     * Obtiene una traducción específica usando notación de puntos (ej: "nav.home")
     */
    translate(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                debugLog(`⚠️ [I18N] Llave no encontrada: ${key}`);
                return key; // Fallback: retorna la llave
            }
        }

        // Reemplazo de variables {{param}}
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return value.replace(/\{\{([^}]+)\}\}/g, (match, paramKey) => {
                return params[paramKey.trim()] !== undefined ? params[paramKey.trim()] : match;
            });
        }

        return typeof value === 'string' ? value : key;
    }

    t(key, params = {}) {
        return this.translate(key, params);
    }

    /**
     * Busca todos los elementos con data-i18n y les aplica el texto
     */
    applyTranslationsToDOM(rootNode = document) {
        const elements = rootNode.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.translate(key);

            // Si es un input, usamos placeholder o un value
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.hasAttribute('placeholder')) {
                    el.placeholder = translation;
                } else if (el.type === 'submit' || el.type === 'button') {
                    el.value = translation;
                }
            } else {
                el.innerText = translation;
            }
        });

        // data-i18n-html: igual pero con innerHTML (para texto con <strong>, <br>, etc.)
        const htmlElements = rootNode.querySelectorAll('[data-i18n-html]');
        htmlElements.forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const translation = this.translate(key);
            el.innerHTML = translation;
        });

        // data-i18n-title: traduce el atributo title
        rootNode.querySelectorAll('[data-i18n-title]').forEach(el => {
            const val = this.translate(el.getAttribute('data-i18n-title'));
            if (val) el.title = val;
        });

        // data-i18n-aria-label: traduce el atributo aria-label
        rootNode.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const val = this.translate(el.getAttribute('data-i18n-aria-label'));
            if (val) el.setAttribute('aria-label', val);
        });

        // Actualizar lang del <html>
        const htmlRoot = document.getElementById('htmlRoot');
        if (htmlRoot) htmlRoot.setAttribute('lang', this.currentLang);
    }

    /**
     * Patrón observador para componentes (charts, dynamic alerts)
     */
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.observers.push(callback);
        }
    }

    notifyObservers(lang) {
        this.observers.forEach(cb => cb(lang));
    }
}

// Inicialización global
window.i18n = new LanguageManager();

// Arrancar validación cuando cargue DOM
document.addEventListener("DOMContentLoaded", () => {
    window.i18n.init();
});
