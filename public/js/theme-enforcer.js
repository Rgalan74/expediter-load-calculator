/**
 * THEME ENFORCER - Brute force approach to fix input visibility
 * This script runs repeatedly to ensure inputs are visible in Dark Mode
 */

(function () {
    console.log('🔥 Theme Enforcer Loaded');

    function forceThemeInputs() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const inputs = document.querySelectorAll('input, select, textarea');

        inputs.forEach(el => {
            if (el.offsetParent === null) return; // Skip hidden

            if (isDark) {
                // DARK MODE STYLES
                el.style.backgroundColor = '#0f172a'; // Slate 900
                el.style.color = '#f1f5f9'; // Slate 100
                el.style.borderColor = '#475569'; // Slate 600
            } else {
                // LIGHT MODE STYLES (Force Visibility)
                el.style.backgroundColor = '#f9fafb'; // Gray 50
                el.style.color = '#111827'; // Gray 900
                el.style.borderColor = '#9ca3af'; // Gray 400
                // Placeholder handling is harder in JS, but background contrast helps
            }

            // Add a class marker
            el.classList.add('theme-enforced');
        });

        // Force Card Backgrounds in Light Mode
        if (!isDark) {
            const cards = document.querySelectorAll('.card, .card-section');
            cards.forEach(el => {
                el.style.backgroundColor = '#ffffff';
                el.style.border = '1px solid #d1d5db';
                el.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                el.style.color = '#1f2937';
            });

            // Force Body Background
            document.body.style.backgroundColor = '#f3f4f6';
            document.body.style.color = '#1f2937';
        } else {
            // Reset body/cards for dark mode if needed (usually CSS handles it, but let's be safe)
            document.body.style.backgroundColor = '';
            document.body.style.color = '';
        }
    }

    // Run on load
    document.addEventListener('DOMContentLoaded', forceThemeInputs);

    // Run on theme change
    window.addEventListener('themeChanged', () => {
        setTimeout(forceThemeInputs, 100);
    });

    // Run periodically (dirty check for dyanmic content)
    setInterval(forceThemeInputs, 1000);

    // Expose for manual debugging
    window.forceThemeInputs = forceThemeInputs;

})();
