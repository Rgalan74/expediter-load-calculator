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
                    // Inset shadow for depth ("cutout" look) + small outer shadow
                    el.style.setProperty('box-shadow', 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.05)', 'important');
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
                styleTag.innerHTML = `
                    /* Light Mode Placeholder - High Visibility */
                    input::placeholder, textarea::placeholder, select::placeholder {
                        color: #374151 !important; /* Gray 700 - Much Darker */
                        opacity: 1 !important;
                        font-style: italic !important;
                        letter-spacing: 0.025em !important;
                    }

                    /* Focus state for light mode */
                    input:focus, textarea:focus, select:focus {
                         background-color: #ffffff !important;
                         border-color: #2563eb !important; /* Blue 600 */
                         box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2) !important;
                    }

                    /* FIX NAV TABS - PILL STYLE */
                    html:not(.dark) .tab-pill-active {
                        background-color: #dbeafe !important;
                        color: #1d4ed8 !important;
                        font-weight: bold !important;
                        border-radius: 0.375rem !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                        transition: all 0.2s ease-in-out !important;
                    }
                    html:not(.dark) .tab-pill-inactive {
                        color: #4b5563 !important;
                        background-color: transparent !important;
                    }
                    html:not(.dark) .tab-pill-inactive:hover {
                        color: #2563eb !important;
                        background-color: #eff6ff !important;
                        border-radius: 0.375rem !important;
                    }
                    html:not(.dark) .nav-shadow {
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                    }

                    /* FIX VARIABLE COSTS SECTION */
                    html:not(.dark) .costs-section strong, 
                    html:not(.dark) .costs-section span,
                    html:not(.dark) #totalExpenses {
                        color: #1f2937 !important; /* Gray 800 */
                    }
                    html:not(.dark) .costs-section #fixedCosts {
                         color: #4b5563 !important; /* Gray 600 */
                    }

                    /* FIX ACTION BUTTONS - 3D & FLOATING EFFECT */
                    #saveBtn, #clearBtn, #lexAnalyzeBtn, .tab-link {
                         transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease-out !important;
                    }

                    /* Hover State - Levitate */
                    #saveBtn:hover, #clearBtn:hover, #lexAnalyzeBtn:hover {
                        transform: translateY(-3px) scale(1.02) !important; /* Higher Lift */
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                        z-index: 10 !important;
                    }

                    /* Save Button - Green */
                    #saveBtn {
                        background-color: #10b981 !important;
                        color: #ffffff !important;
                        border: 1px solid #059669 !important;
                        box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4) !important;
                    }

                    /* Clear Button - Gray */
                    #clearBtn {
                        background-color: #f3f4f6 !important;
                        color: #374151 !important;
                        border: 1px solid #d1d5db !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
                    }

                    /* Lex Button */
                    #lexAnalyzeBtn {
                        color: #ffffff !important;
                        box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4) !important;
                    }
                    #lexAnalyzeBtn span, #lexAnalyzeBtn i {
                        color: #ffffff !important;
                    }
                    
                    /* Button Icons */
                    button:not(#lexAnalyzeBtn):not(#saveBtn) i {
                        color: inherit !important; 
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
