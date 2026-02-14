/**
 * THEME FIX CORE v5.4.1
 * Enforces correct input styling for Light/Dark modes
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
                    // 🌑 DARK MODE STYLES
                    el.style.setProperty('background-color', '#0f172a', 'important'); // Slate 900
                    el.style.setProperty('color', '#f1f5f9', 'important'); // Slate 100
                    el.style.setProperty('border-color', '#475569', 'important'); // Slate 600
                } else {
                    // ☀️ LIGHT MODE STYLES - CLEAN & CRISP
                    // Off-White background (Slate 50) to distinguish from White Cards
                    el.style.setProperty('background-color', '#f8fafc', 'important'); // Slate 50
                    el.style.setProperty('color', '#111827', 'important'); // Gray 900
                    el.style.setProperty('border', '1px solid #cbd5e1', 'important'); // Slate 300
                    el.style.setProperty('border-radius', '0.5rem', 'important');
                    el.style.setProperty('box-shadow', 'inset 0 4px 6px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.05)', 'important'); /* Deep Inset Shadow */
                }

                el.classList.add('theme-enforced');
            });

            // Inject dynamic CSS for pseudo-elements (::placeholder)
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
            }

            /* ADD DESTINATION BUTTON - 3D STYLE */
            #addDestinationBtn {
                background - color: #f3e8ff!important; /* Purple 100 */
                color: #7e22ce!important; /* Purple 700 */
                border: 1px solid #d8b4fe!important; /* Purple 300 */
                box - shadow: 0 4px 0 0 #c084fc!important; /* Hard 3D Shadow (Purple 400) */
                transform: translateY(0)!important;
                transition: all 0.1s active!important;
                margin - bottom: 4px!important; /* Compensate for shadow */
            }
            #addDestinationBtn:active {
                transform: translateY(4px)!important; /* Press down effect */
                box - shadow: 0 0 0 0 #c084fc!important; /* Remove shadow on press */
            }
            #addDestinationBtn:hover {
                background - color: #fae8ff!important; /* Purple 50 */
            }

            /* FIX NAV TABS - PILL STYLE */
            html: not(.dark).tab - pill - active {
                background - color: #dbeafe!important;
                color: #1d4ed8!important;
                font - weight: bold!important;
                border - radius: 9999px!important; /* Full Pill */
                box - shadow: 0 4px 6px - 1px rgba(0, 0, 0, 0.1), 0 2px 4px - 1px rgba(0, 0, 0, 0.06)!important;
                transition: all 0.2s ease -in -out!important;
            }
            html: not(.dark).tab - pill - inactive {
                color: #4b5563!important;
                background - color: transparent!important;
                border - radius: 9999px!important;
            }
            html: not(.dark).tab - pill - inactive:hover {
                color: #2563eb!important;
                background - color: #eff6ff!important;
            }
            html: not(.dark).nav - shadow {
                box - shadow: 0 10px 15px - 3px rgba(0, 0, 0, 0.1), 0 4px 6px - 2px rgba(0, 0, 0, 0.05)!important;
            }

            /* FIX VARIABLE COSTS SECTION */
            html: not(.dark).costs - section strong,
                html: not(.dark).costs - section span,
                    html: not(.dark) #totalExpenses {
                color: #1f2937!important; /* Gray 800 */
            }
            html: not(.dark).costs - section #fixedCosts {
                color: #4b5563!important; /* Gray 600 */
            }

            /* FIX ACTION BUTTONS - 3D & FLOATING EFFECT */
            #saveBtn, #clearBtn, #lexAnalyzeBtn, .tab - link {
                transition: transform 0.2s cubic - bezier(0.34, 1.56, 0.64, 1), box - shadow 0.2s ease - out!important;
            }

            /* Hover State - Levitate */
            #saveBtn: hover, #clearBtn: hover, #lexAnalyzeBtn:hover {
                transform: translateY(-3px) scale(1.02)!important; /* Higher Lift */
                box - shadow: 0 10px 15px - 3px rgba(0, 0, 0, 0.15), 0 4px 6px - 2px rgba(0, 0, 0, 0.1)!important; /* Darker Shadow */
                z - index: 10!important;
            }

            /* Save Button - Green */
            #saveBtn {
                background - color: #10b981!important;
                color: #ffffff!important;
                border: 1px solid #059669!important;
                box - shadow: 0 4px 6px - 1px rgba(16, 185, 129, 0.4)!important;
            }

            /* Clear Button - Gray */
            #clearBtn {
                background - color: #f3f4f6!important;
                color: #374151!important;
                border: 1px solid #d1d5db!important;
                box - shadow: 0 4px 6px - 1px rgba(0, 0, 0, 0.1)!important;
            }

            /* Lex Button */
            #lexAnalyzeBtn {
                color: #ffffff!important;
                box - shadow: 0 4px 6px - 1px rgba(79, 70, 229, 0.4)!important;
            }
            #lexAnalyzeBtn span, #lexAnalyzeBtn i {
                color: #ffffff!important;
            }

            /* Button Icons */
            button: not(#lexAnalyzeBtn): not(#saveBtn) i {
                color: inherit!important;
            }
            `;
            }

            // Force Body & Card Backgrounds for Light Mode
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
