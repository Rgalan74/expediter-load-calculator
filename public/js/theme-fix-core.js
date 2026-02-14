/**
 * THEME FIX CORE - DEBUG VERSION v5.4.0
 * Includes On-Screen Logging to diagnose failure
 */
(function () {
    // 1. CREATE ON-SCREEN DEBUGGER
    let debugBox = document.getElementById('debug-console');
    if (!debugBox) {
        debugBox = document.createElement('div');
        debugBox.id = 'debug-console';
        debugBox.style.cssText = 'position:fixed; bottom:0; left:0; width:100%; height:150px; background:rgba(0,0,0,0.9); color:#0f0; font-family:monospace; font-size:12px; overflow:auto; z-index:99999; padding:10px; pointer-events:none; border-top:2px solid #0f0;';
        document.body.appendChild(debugBox);
    }

    function log(msg) {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        debugBox.appendChild(line);
        debugBox.scrollTop = debugBox.scrollHeight;
        console.log(msg);
    }

    log('🚀 JS LOADED: theme-fix-core.js v5.4.0');

    function forceThemeInputs() {
        try {
            const themeAttr = document.documentElement.getAttribute('data-theme');
            const isDark = themeAttr !== 'light';
            log(`🎨 Theme Check: data-theme="${themeAttr}" | isDark=${isDark}`);

            const inputs = document.querySelectorAll('input, select, textarea');
            log(`🔍 Found ${inputs.length} inputs`);

            inputs.forEach(el => {
                if (el.offsetParent === null) return; // Skip hidden

                if (isDark) {
                    // DARK MODE - Force Dark
                    el.style.setProperty('background-color', '#0f172a', 'important');
                    el.style.setProperty('color', '#f1f5f9', 'important');
                    el.style.setProperty('border-color', '#475569', 'important');
                } else {
                    // LIGHT MODE - Force Light
                    el.style.setProperty('background-color', '#e5e7eb', 'important'); // Gray 200
                    el.style.setProperty('color', '#000000', 'important');
                    el.style.setProperty('border', '2px solid #6b7280', 'important'); // Gray 500

                    // TRACER BULLET
                    if (el.id === 'loadedMiles' || el.id === 'origin') {
                        log(`🎯 Applying PINK to #${el.id}`);
                        el.style.setProperty('background-color', '#fca5a5', 'important'); // RED-300
                        el.style.setProperty('border', '4px solid red', 'important');
                    }
                }

                el.classList.add('theme-enforced');
            });

            // Force Body
            if (!isDark) {
                document.body.style.setProperty('background-color', '#f3f4f6', 'important');
                document.body.style.setProperty('color', '#1f2937', 'important');
            }

        } catch (e) {
            log(`❌ ERROR: ${e.message}`);
        }
    }

    // Run immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceThemeInputs);
    } else {
        forceThemeInputs();
    }

    // Loop to ensure it sticks
    setInterval(forceThemeInputs, 2000);

})();
