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

        // Notify others if needed (e.g., charts might need redraw)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    toggle() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
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
