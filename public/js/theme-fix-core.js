/**
 * THEME FIX CORE v5.21.0
 * Enforces correct input styling for Light/Dark modes
 * NOW DELEGATES LIGHT MODE STYLES TO: public/css/theme-overrides.css
 */
(function () {
    // Debug logging (internal only)
    function log(msg) {
        // console.log(`[ThemeFix] ${msg}`);
    }

    function forceThemeInputs() {
        try {
            const themeAttr = document.documentElement.getAttribute('data-theme');
            const isDark = themeAttr !== 'light';

            const inputs = document.querySelectorAll('input, select, textarea');

            inputs.forEach(el => {
                if (el.offsetParent === null) return; // Skip hidden

                if (isDark) {
                    // 🌑 DARK MODE STYLES (Inline to force override)
                    el.style.setProperty('background-color', '#0f172a', 'important'); // Slate 900
                    el.style.setProperty('color', '#f1f5f9', 'important'); // Slate 100
                    el.style.setProperty('border-color', '#475569', 'important'); // Slate 600
                } else {
                    // ☀️ LIGHT MODE STYLES 
                    // Delegated to theme-overrides.css where possible, but enforcing base properties here
                    el.style.setProperty('background-color', '#f8fafc', 'important'); // Slate 50
                    el.style.setProperty('color', '#111827', 'important'); // Gray 900
                    el.style.setProperty('border', '1px solid #cbd5e1', 'important'); // Slate 300
                    el.style.setProperty('border-radius', '0.5rem', 'important');
                    el.style.setProperty('box-shadow', 'inset 0 4px 6px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.05)', 'important');
                }

                el.classList.add('theme-enforced');
            });

            // Inject dynamic CSS for pseudo-elements (mainly for Dark Mode now)
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
                // LIGHT MODE - Handled by css/theme-overrides.css
                // We keep this clear to avoid conflicts
                styleTag.innerHTML = ``;
            }

            // Force Body Background for Light Mode (Safety fallback)
            if (!isDark) {
                document.body.style.setProperty('background-color', '#f3f4f6', 'important'); // Gray 100
                document.body.style.setProperty('color', '#1f2937', 'important'); // Gray 800
            }

        } catch (e) {
            console.error('ThemeFix Error:', e);
        }
    }

    // Run immediately and periodically
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceThemeInputs);
    } else {
        forceThemeInputs();
    }

    // Loop to ensure it sticks
    setInterval(forceThemeInputs, 2000);

})();
