/**
 * ANALYTICS MANAGER - Google Analytics 4 + Firebase Analytics
 * Tracks user interactions and app performance
 */

class AnalyticsManager {
    constructor() {
        this.initialized = false;
        this.GA4_ID = 'G-EK7NM7PJE2'; // Google Analytics 4 - SmartLoad
        this.eventsQueue = [];
    }

    /**
     * Initialize analytics
     */
    async init() {
        if (this.initialized) return;

        try {
            // Initialize Firebase Analytics
            if (firebase.analytics) {
                firebase.analytics();
                console.log('✅ Firebase Analytics initialized');
            }

            // Initialize Google Analytics 4
            await this.loadGA4();

            this.initialized = true;

            // Process queued events
            this.processQueue();

            // Track initial page view
            this.trackPageView(window.location.pathname);

        } catch (error) {
            console.error('❌ Analytics initialization failed:', error);
        }
    }

    /**
     * Load Google Analytics 4
     */
    async loadGA4() {
        return new Promise((resolve) => {
            // Create script tag
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA4_ID}`;

            script.onload = () => {
                // Initialize gtag
                window.dataLayer = window.dataLayer || [];
                window.gtag = function () { dataLayer.push(arguments); };

                gtag('js', new Date());
                gtag('config', this.GA4_ID, {
                    send_page_view: false // We'll send manually
                });

                console.log('✅ Google Analytics 4 loaded');
                resolve();
            };

            script.onerror = () => {
                console.warn('⚠️ GA4 failed to load (ad blocker?)');
                resolve(); // Don't fail if blocked
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Track page view
     */
    trackPageView(path, title = document.title) {
        this.trackEvent('page_view', {
            page_path: path,
            page_title: title
        });
    }

    /**
     * Track custom event
     */
    trackEvent(eventName, params = {}) {
        if (!this.initialized) {
            this.eventsQueue.push({ eventName, params });
            return;
        }

        // Firebase Analytics
        if (firebase.analytics) {
            firebase.analytics().logEvent(eventName, params);
        }

        // Google Analytics 4
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, params);
        }

        console.log(`📊 Event tracked: ${eventName}`, params);
    }

    /**
     * Process queued events
     */
    processQueue() {
        while (this.eventsQueue.length > 0) {
            const { eventName, params } = this.eventsQueue.shift();
            this.trackEvent(eventName, params);
        }
    }

    /**
     * Track user engagement
     */
    trackEngagement(action, category, label, value) {
        this.trackEvent('user_engagement', {
            engagement_action: action,
            engagement_category: category,
            engagement_label: label,
            engagement_value: value
        });
    }

    /**
     * Track load calculation
     */
    trackLoadCalculation(loadData) {
        this.trackEvent('calculate_load', {
            total_miles: loadData.totalMiles || 0,
            deadhead_miles: loadData.deadheadMiles || 0,
            rpm: loadData.rpm || 0,
            net_profit: loadData.netProfit || 0,
            is_profitable: (loadData.netProfit || 0) > 0
        });
    }

    /**
     * Track expense added
     */
    trackExpense(expenseData) {
        this.trackEvent('add_expense', {
            expense_type: expenseData.type || 'other',
            expense_amount: expenseData.amount || 0,
            expense_category: expenseData.category || 'uncategorized'
        });
    }

    /**
     * Track feature usage
     */
    trackFeatureUse(featureName) {
        this.trackEvent('feature_use', {
            feature_name: featureName
        });
    }

    /**
     * Track error
     */
    trackError(errorMessage, errorType = 'javascript_error') {
        this.trackEvent('exception', {
            description: errorMessage,
            fatal: false,
            error_type: errorType
        });
    }

    /**
     * Track user property
     */
    setUserProperty(propertyName, value) {
        if (firebase.analytics) {
            firebase.analytics().setUserProperties({
                [propertyName]: value
            });
        }

        if (typeof gtag !== 'undefined') {
            gtag('set', 'user_properties', {
                [propertyName]: value
            });
        }
    }

    /**
     * Track conversion (for paid features)
     */
    trackConversion(value, currency = 'USD') {
        this.trackEvent('purchase', {
            value: value,
            currency: currency,
            transaction_id: `txn_${Date.now()}`
        });
    }
}

// Global instance
window.analyticsManager = window.analyticsManager || new AnalyticsManager();

// Auto-initialize when auth is ready
// Wait for Firebase to be initialized properly
function initializeAnalyticsWhenReady() {
    // Check if Firebase is initialized (app exists)
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        // Firebase is initialized, set up auth listener
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                window.analyticsManager.init();

                // Set user properties
                window.analyticsManager.setUserProperty('user_id', user.uid);
                window.analyticsManager.setUserProperty('user_email', user.email);
            }
        });
        console.log('📊 Analytics Manager ready (waiting for user auth)');
    } else {
        // Firebase not initialized yet, wait and try again
        setTimeout(initializeAnalyticsWhenReady, 200);
    }
}

// Start initialization after a small delay to ensure Firebase loads first
setTimeout(initializeAnalyticsWhenReady, 500);

// Expose helpers globally
window.trackEvent = (name, params) => window.analyticsManager.trackEvent(name, params);
window.trackPageView = (path) => window.analyticsManager.trackPageView(path);
window.trackFeature = (name) => window.analyticsManager.trackFeatureUse(name);

console.log('📊 Analytics Manager loaded');
