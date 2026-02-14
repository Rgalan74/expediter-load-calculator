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
                // LIGHT MODE STYLES (High Contrast Force)
                el.style.backgroundColor = '#e5e7eb'; // Gray 200 (Visible gray)
                el.style.color = '#000000'; // Pure Black
                el.style.border = '2px solid #6b7280'; // Gray 500 (Thick border)
                el.style.borderRadius = '0.5rem';

                // TRACER BULLET: FORCE PINK BACKGROUND ON MILLAS COTIZADAS
                if (el.id === 'loadedMiles') {
                    el.style.backgroundColor = '#fed7d7'; // PINK (Tailwind Red-100/200)
                    el.style.border = '2px solid #ef4444'; // RED BORDER
                    console.log('🎯 Tracer Bullet Applied to loadedMiles');
                }

                // Force placeholders if supported (not easy in JS style, but color helps)
            }

            // Add a class marker
            el.classList.add('theme-enforced');
        });

        // Inject dynamic CSS for pseudo-elements (::placeholder) which JS can't touch directly
        let styleTag = document.getElementById('theme-fix-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'theme-fix-styles';
            document.head.appendChild(styleTag);
        }

        if (isDark) {
            styleTag.innerHTML = `
                input::placeholder, textarea::placeholder, select::placeholder {
                    color: #94a3b8 !important; /* Slate 400 */
                    opacity: 1 !important;
                }
            `;
        } else {
            styleTag.innerHTML = `
                input::placeholder, textarea::placeholder, select::placeholder {
                    color: #4b5563 !important; /* Gray 600 - MUY VISIBLE */
                    opacity: 1 !important;
                }
            `;
        }

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
