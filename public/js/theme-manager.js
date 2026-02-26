/**
 * Theme Manager
 * Handles Light/Dark mode toggling and persistence.
 */
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    init() {
        // Apply initial theme
        this.applyTheme(this.theme);

        // Bind toggle button events (desktop & mobile)
        document.addEventListener('DOMContentLoaded', () => {
            this.bindEvents();
            this.updateIcon();
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.theme = theme;
        this.updateIcon();

        // Force header styles (mobile light mode fix)
        this.forceHeaderStyles();

        // Notify others if needed (e.g., charts might need redraw)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    forceHeaderStyles() {
        // Force header gradient and menu styles in mobile
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Force gradient text (Load Calculator)
            const gradientElements = document.querySelectorAll('.header-title, .gradient-text');
            gradientElements.forEach(el => {
                el.style.background = 'linear-gradient(135deg, #00D9FF 0%, #7B2FFF 100%)';
                el.style.webkitBackgroundClip = 'text';
                el.style.backgroundClip = 'text';
                el.style.webkitTextFillColor = 'transparent';
            });

            // Force menu hamburger to white (header is dark in both themes)
            const menuToggle = document.getElementById('menuToggle');
            if (menuToggle) {
                menuToggle.style.color = '#ffffff';
                menuToggle.style.fontSize = '1.75rem';
                menuToggle.style.fontWeight = '900';
            }
        }
    }

    toggle() {
        // Switch theme
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        debugLog(' [THEME] Switching to:', newTheme);
        this.applyTheme(newTheme);
    }

    bindEvents() {
        const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
        toggleBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                this.toggle();
            };
        });
    }

    updateIcon() {
        const icons = document.querySelectorAll('.theme-toggle-icon');
        icons.forEach(icon => {
            if (this.theme === 'dark') {
                // Show Sun icon (to switch to light)
                icon.textContent = '☀️';
            } else {
                // Show Moon icon (to switch to dark)
                icon.textContent = '🌙';
            }
        });
    }
}

// Initialize global instance
window.themeManager = new ThemeManager();

// Force header styles on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.themeManager.forceHeaderStyles();
    }, 100);
});
