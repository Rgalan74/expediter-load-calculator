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
                styleTag.innerHTML = `
                    /* Light Mode Placeholder - High Visibility */
                    input::placeholder, textarea::placeholder, select::placeholder {
                        color: #6b7280 !important; /* Gray 500 - Stronger visibility */
                        opacity: 1 !important;
                        font-style: italic !important;
                        font-weight: 500 !important; /* Medium weight */
                    }

                    /* Focus state for light mode */
                    input:focus, textarea:focus, select:focus {
                         background-color: #ffffff !important;
                         border-color: #2563eb !important; /* Blue 600 */
                         box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2) !important; /* Blue Ring */
                    }
                    
                    /* ADD DESTINATION BUTTON - 3D STYLE */
                    #addDestinationBtn {
                        background-color: #f3e8ff !important; /* Purple 100 */
                        color: #7e22ce !important; /* Purple 700 */
                        border: 1px solid #d8b4fe !important; /* Purple 300 */
                        box-shadow: 0 4px 0 0 #c084fc !important; /* Hard 3D Shadow (Purple 400) */
                        transform: translateY(0) !important;
                        transition: all 0.1s active !important;
                        margin-bottom: 4px !important; /* Compensate for shadow */
                    }
                    #addDestinationBtn:active {
                        transform: translateY(4px) !important; /* Press down effect */
                        box-shadow: 0 0 0 0 #c084fc !important; /* Remove shadow on press */
                    }
                    #addDestinationBtn:hover {
                         background-color: #fae8ff !important; /* Purple 50 */
                    }

                    /* FIX NAV TABS - PILL STYLE */
                    html:not(.dark) .tab-pill-active {
                        background-color: #dbeafe !important;
                        color: #1d4ed8 !important;
                        font-weight: bold !important;
                        border-radius: 9999px !important; /* Full Pill */
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                        transition: all 0.2s ease-in-out !important;
                    }
                    html:not(.dark) .tab-pill-inactive {
                        color: #4b5563 !important;
                        background-color: transparent !important;
                        border-radius: 9999px !important; 
                    }
                    html:not(.dark) .tab-pill-inactive:hover {
                        color: #2563eb !important;
                        background-color: #eff6ff !important;
                    }
                    html:not(.dark) .nav-shadow {
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
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
                    #saveBtn, #clearBtn, #lexAnalyzeBtn, #filterBtn, #exportExcelBtn, .tab-link {
                         transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease-out !important;
                    }

                    /* Hover State - Levitate */
                    #saveBtn:hover, #clearBtn:hover, #lexAnalyzeBtn:hover, #filterBtn:hover, #exportExcelBtn:hover {
                        transform: translateY(-3px) scale(1.02) !important; /* Higher Lift */
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1) !important; /* Darker Shadow */
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
                    
                    /* Filter Button - Blue (History) */
                    #filterBtn {
                        background-color: #3b82f6 !important; /* Blue 500 */
                        color: #ffffff !important;
                        border: 1px solid #2563eb !important; /* Blue 600 */
                        box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.4) !important;
                    }

                    /* Export Excel Button - Green (History) */
                    #exportExcelBtn {
                        background-color: #10b981 !important; /* Emerald 500 */
                        color: #ffffff !important;
                        border: 1px solid #059669 !important; /* Emerald 600 */
                        box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4) !important;
                        -webkit-text-fill-color: #ffffff !important; /* Force white text override */
                    }
            
                    /* Button Icons */
        
            /* GLOBAL TABLE STYLES (Light Mode) - MODERN SAAS LOOK */
            html:not(.dark) table {
                border-collapse: separate !important;
                border-spacing: 0 6px !important; /* Space between rows */
                width: 100% !important;
                background-color: transparent !important;
                box-shadow: none !important;
                border-radius: 0 !important;
            }

            /* Header - Subtle & Clean */
            html:not(.dark) table thead {
                background-color: transparent !important;
            }
            html:not(.dark) table thead th {
                color: #64748b !important; /* Slate 500 */
                font-weight: 700 !important;
                text-transform: uppercase !important;
                font-size: 0.70rem !important;
                letter-spacing: 0.08em !important;
                padding: 0 16px 8px 16px !important;
                border-bottom: none !important;
            }
            /* Sort Icons */
            html:not(.dark) table thead th span, 
            html:not(.dark) table thead th i {
                color: #94a3b8 !important; /* Slate 400 */
                opacity: 0.6 !important;
            }

            /* Rows - Floating Cards */
            html:not(.dark) table tbody tr {
                background-color: #ffffff !important;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05) !important;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                border: 1px solid transparent !important;
            }
            
            /* Rounded corners for rows */
            html:not(.dark) table tbody tr td:first-child {
                border-top-left-radius: 8px !important;
                border-bottom-left-radius: 8px !important;
            }
            html:not(.dark) table tbody tr td:last-child {
                border-top-right-radius: 8px !important;
                border-bottom-right-radius: 8px !important;
            }

            html:not(.dark) table tbody tr:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04) !important;
                background-color: #ffffff !important; /* Keep white on hover to pop */
                z-index: 10;
                position: relative;
            }

            /* Cells */
            html:not(.dark) table tbody td {
                color: #334155 !important; /* Slate 700 */
                padding: 16px 16px !important; /* More breathing room */
                font-size: 0.875rem !important;
                border-top: 1px solid #f1f5f9 !important; /* Subtle top border */
                border-bottom: 1px solid #f1f5f9 !important; /* Subtle bottom border */
            }
            /* Remove borders from first/last cells for rounded corners to look clean */
            html:not(.dark) table tbody td:first-child { border-left: 1px solid #f1f5f9 !important; border-top: 1px solid #f1f5f9 !important; border-bottom: 1px solid #f1f5f9 !important; }
            html:not(.dark) table tbody td:last-child { border-right: 1px solid #f1f5f9 !important; border-top: 1px solid #f1f5f9 !important; border-bottom: 1px solid #f1f5f9 !important; }

            html:not(.dark) table tbody td strong {
                color: #0f172a !important; /* Slate 900 */
                font-weight: 600 !important;
            }
            /* FIX STATISTICS SUMMARY CARDS (HISTORY) */
            html:not(.dark) #sumTotal, 
            html:not(.dark) #sumMiles, 
            html:not(.dark) #sumRevenue, 
            html:not(.dark) #sumProfit, 
            html:not(.dark) #sumRpm {
                color: #111827 !important; /* Gray 900 */
                font-weight: 800 !important;
                font-size: 1.5rem !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
            }

            /* Card Containers - Richer Backgrounds */
            html:not(.dark) #sumTotal { /* Indigo Parent */
                 background-color: #e0e7ff !important;
                 border-color: #818cf8 !important;
            }
            html:not(.dark) #sumTotal ~ p { color: #4338ca !important; }
            html:not(.dark) #sumTotal ~ h4 { color: #312e81 !important; }

            /* INDIGO CARD (Total Cargas) */
            html:not(.dark) .bg-indigo-50.border-indigo-200 {
                background-color: #e0e7ff !important;
                border: 1px solid #6366f1 !important;
                box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2) !important;
            }
            html:not(.dark) .bg-indigo-50 h4 { color: #312e81 !important; font-weight: 700 !important; }
            html:not(.dark) .bg-indigo-50 p.text-indigo-600 { color: #4338ca !important; font-weight: 600 !important; }

            /* YELLOW CARD (Millas) */
            html:not(.dark) .bg-yellow-50.border-yellow-200 {
                background-color: #fef9c3 !important; /* Yellow 100 */
                border: 1px solid #eab308 !important; /* Yellow 500 */
                box-shadow: 0 4px 6px -1px rgba(234, 179, 8, 0.2) !important;
            }
            html:not(.dark) .bg-yellow-50 h4 { color: #713f12 !important; font-weight: 700 !important; }
            html:not(.dark) .bg-yellow-50 p { color: #854d0e !important; font-weight: 600 !important; }

             /* EMERALD CARD (Revenue) */
            html:not(.dark) .bg-emerald-50.border-emerald-200 {
                background-color: #d1fae5 !important; /* Emerald 100 */
                border: 1px solid #10b981 !important; /* Emerald 500 */
                box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2) !important;
            }
            html:not(.dark) .bg-emerald-50 h4 { color: #064e3b !important; font-weight: 700 !important; }
            html:not(.dark) .bg-emerald-50 p { color: #059669 !important; font-weight: 600 !important; }

            /* GREEN CARD (Profit) */
            html:not(.dark) .bg-green-50.border-green-200 {
                background-color: #dcfce7 !important; /* Green 100 */
                border: 1px solid #22c55e !important; /* Green 500 */
                box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.2) !important;
            }
            html:not(.dark) .bg-green-50 h4 { color: #14532d !important; font-weight: 700 !important; }
            html:not(.dark) .bg-green-50 p { color: #16a34a !important; font-weight: 600 !important; }
            
             /* PURPLE CARD (RPM) */
            html:not(.dark) .bg-purple-50.border-purple-200 {
                background-color: #f3e8ff !important; /* Purple 100 */
                border: 1px solid #a855f7 !important; /* Purple 500 */
                box-shadow: 0 4px 6px -1px rgba(168, 85, 247, 0.2) !important;
            }
            html:not(.dark) .bg-purple-50 h4 { color: #581c87 !important; font-weight: 700 !important; }
            html:not(.dark) .bg-purple-50 p { color: #7e22ce !important; font-weight: 600 !important; }

            /* Button Icons */
            button:not(#lexAnalyzeBtn):not(#saveBtn) i {
                color: inherit !important;
            }
            `;
                /* Card Containers - Make backgrounds richer */
                html: not(.dark) #sumTotal { /* Indigo Parent */
                    background - color: #e0e7ff!important; /* Indigo 100 */
                    border - color: #818cf8!important; /* Indigo 400 */
                }
                html: not(.dark) #sumTotal ~p { color: #4338ca!important; } /* Indigo 700 */
                html: not(.dark) #sumTotal ~h4 { color: #312e81!important; } /* Indigo 900 */

                html: not(.dark) #sumMiles { /* Yellow Parent via cousin selector logic or direct parent styling if possible. 
               Since we can't select parent in CSS/JS easily without specific IDs on parents, 
               we will target the specific classes used in the HTML if they are unique enough.
               Actually, the best way in this "JS-in-CSS" approach is to target the classes directly for Light Mode 
            */
                }

                /* TARGETING WRAPPER DIVS BY CONTENT HINT IS HARD IN PURE CSS.
                   Instead, let's target the known Tailwind classes but scoped to Light Mode + Card Context
                   OR better: Add a quick JS loop to add IDs to these parents if they don't have them?
                   
                   Actually, looking at the code:
                   <div class="bg-indigo-50 ..."> <p id="sumTotal"> ... </div>
                   
                   I can target: html:not(.dark) .bg-indigo-50.border-indigo-200 { ... } 
                */

                /* INDIGO CARD (Total Cargas) */
                html: not(.dark).bg - indigo - 50.border - indigo - 200 {
                    background - color: #e0e7ff!important; /* Indigo 100 */
                    border: 1px solid #6366f1!important; /* Indigo 500 */
                    box - shadow: 0 4px 6px - 1px rgba(99, 102, 241, 0.2)!important;
                }
                html: not(.dark).bg - indigo - 50 h4 { color: #312e81!important; font - weight: 700!important; } /* Indigo 900 */
                html: not(.dark).bg - indigo - 50 p.text - indigo - 600 { color: #4338ca!important; font - weight: 600!important; } /* Indigo 700 */

                /* YELLOW CARD (Millas) */
                html: not(.dark).bg - yellow - 50.border - yellow - 200 {
                    background - color: #fef9c3!important; /* Yellow 100 */
                    border: 1px solid #eab308!important; /* Yellow 500 */
                    box - shadow: 0 4px 6px - 1px rgba(234, 179, 8, 0.2)!important;
                }
                html: not(.dark).bg - yellow - 50 h4 { color: #713f12!important; font - weight: 700!important; } /* Yellow 900 */
                html: not(.dark).bg - yellow - 50 p.text - yellow - 600 { color: #854d0e!important; font - weight: 600!important; } /* Yellow 700 */

                /* GREEN CARD (Ingresos) */
                html: not(.dark).bg - green - 50.border - green - 200 {
                    background - color: #dcfce7!important; /* Green 100 */
                    border: 1px solid #22c55e!important; /* Green 500 */
                    box - shadow: 0 4px 6px - 1px rgba(34, 197, 94, 0.2)!important;
                }
                html: not(.dark).bg - green - 50 h4 { color: #14532d!important; font - weight: 700!important; } /* Green 900 */
                html: not(.dark).bg - green - 50 p.text - green - 600 { color: #15803d!important; font - weight: 600!important; } /* Green 700 */

                /* BLUE CARD (Ganancias) */
                html: not(.dark).bg - blue - 50.border - blue - 200 {
                    background - color: #dbeafe!important; /* Blue 100 */
                    border: 1px solid #3b82f6!important; /* Blue 500 */
                    box - shadow: 0 4px 6px - 1px rgba(59, 130, 246, 0.2)!important;
                }
                html: not(.dark).bg - blue - 50 h4 { color: #1e3a8a!important; font - weight: 700!important; } /* Blue 900 */
                html: not(.dark).bg - blue - 50 p.text - blue - 600 { color: #1d4ed8!important; font - weight: 600!important; } /* Blue 700 */

                /* PURPLE CARD (RPM) */
                html: not(.dark).bg - purple - 50.border - purple - 200 {
                    background - color: #f3e8ff!important; /* Purple 100 */
                    border: 1px solid #a855f7!important; /* Purple 500 */
                    box - shadow: 0 4px 6px - 1px rgba(168, 85, 247, 0.2)!important;
                }
                html: not(.dark).bg - purple - 50 h4 { color: #581c87!important; font - weight: 700!important; } /* Purple 900 */
                html: not(.dark).bg - purple - 50 p.text - purple - 600 { color: #7e22ce!important; font - weight: 600!important; } /* Purple 700 */

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
