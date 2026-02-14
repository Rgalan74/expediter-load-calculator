/**
 * THEME ENFORCER - Brute force approach to fix input visibility
 * This script runs repeatedly to ensure inputs are visible in Dark Mode
 */

(function () {
    console.log('🔥 Theme Enforcer Loaded');

    function forceDarkInputs() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        // console.log('Theme Enforcer: isDark =', isDark);

        if (!isDark) return; // Don't mess with Light Mode

        const inputs = document.querySelectorAll('input, select, textarea');

        inputs.forEach(el => {
            // Check if element is visible
            if (el.offsetParent === null) return;

            // FORCE STYLES (Inline styles override everything except !important)
            el.style.backgroundColor = '#0f172a'; // Slate 900
            el.style.color = '#f1f5f9'; // Slate 100
            el.style.borderColor = '#475569'; // Slate 600

            // Add a class marker to verify it ran
            el.classList.add('theme-enforced-dark');
        });

        // Also fix specific containers that might have white backgrounds
        const cards = document.querySelectorAll('.card-section, .bg-white');
        cards.forEach(el => {
            // Only if current background is white (computed)
            const style = window.getComputedStyle(el);
            if (style.backgroundColor === 'rgb(255, 255, 255)' || style.backgroundColor === '#ffffff') {
                el.style.backgroundColor = '#1e293b'; // Slate 800
                el.style.color = '#f1f5f9';
            }
        });
    }

    // Run on load
    document.addEventListener('DOMContentLoaded', forceDarkInputs);

    // Run on theme change
    window.addEventListener('themeChanged', () => {
        setTimeout(forceDarkInputs, 100);
    });

    // Run periodically (dirty check for dyanmic content)
    setInterval(forceDarkInputs, 1000);

    // Expose for manual debugging
    window.forceDarkInputs = forceDarkInputs;

})();
