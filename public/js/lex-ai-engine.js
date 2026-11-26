/**
 * @copyright 2026 SmartLoad Solution — Ricardo Galan. All rights reserved.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without prior written permission.
 * Violators may be prosecuted under applicable copyright law.
 *
 * @product    Expediter Load Calculator (SmartLoad Solution)
 * @author     Ricardo Galan <ricardogalan74@gmail.com>
 * @license    Proprietary — All Rights Reserved
 * @fingerprint SLS-2026-RG74-EXPEDITER
 */
// ============================================================
//  LEX-AI-ENGINE.JS v1.7
//  Motor de AI real para Lex via OpenRouter + DeepSeek V3
//  La API key vive solo en el servidor (Cloud Function lexChat)
// ============================================================

(function () {

    // Configuración base. La API key y el modelo viven en el servidor
    // (Cloud Function lexChat) — el cliente ya no los conoce.
    const OPENROUTER_CONFIG = {
        maxTokens: 600
    };

    // ============================================================
    //  CARGAR PERFIL REAL DESDE FIREBASE — con cache en memoria (5 min TTL)
    //  Evita múltiples lecturas Firestore en una misma conversación
    // ============================================================
    let _profileCache = null;
    let _profileCacheTs = 0;
    const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    async function loadRealProfile() {
        // Servir desde cache si está fresco
        if (_profileCache && (Date.now() - _profileCacheTs) < PROFILE_CACHE_TTL) {
            debugLog('[LEX-AI] Profile desde cache (evita Firestore read)');
            return _profileCache;
        }
        try {
            if (typeof getLexProfile === 'function') {
                _profileCache = await getLexProfile();
                _profileCacheTs = Date.now();
                return _profileCache;
            }
        } catch (e) {
            debugLog('[LEX-AI] Error cargando perfil Firebase:', e.message);
        }
        return null;
    }

    // Invalidar cache cuando se guarda una nueva carga (llamado externamente)
    window.lexInvalidateProfileCache = function () {
        _profileCache = null;
        _profileCacheTs = 0;
        debugLog('[LEX-AI] Profile cache invalidado');
    };

    // ============================================================
    //  DETECTAR Y GUARDAR NOTAS DESDE EL CHAT
    // ============================================================
    function detectSaveNote(text) {
        // Español e inglés. El lugar termina en ":" si lo hay (así "Atlanta, GA: ..."
        // conserva el estado); si no, en la primera coma.
        const inicios = [
            /\bagrega(?:r)?\s+(?:una\s+)?nota\s+(?:para|de|en|sobre)\s+/i,
            /\bguarda(?:r)?\s+(?:una\s+)?nota\s+(?:para|de|en|sobre)\s+/i,
            /\banota\s+(?:para|en|sobre)\s+/i,
            /\bnota\s+(?:para|de|en)\s+/i,
            /\b(?:add|save|make|leave)\s+(?:a\s+)?note\s+(?:for|about|on|in)\s+/i,
            /\bnote\s+(?:for|about|on)\s+/i,
        ];
        for (const inicio of inicios) {
            const m = text.match(inicio);
            if (!m) continue;
            const resto = text.slice(m.index + m[0].length);
            const corte = resto.indexOf(':') > 0 ? resto.indexOf(':') : resto.indexOf(',');
            if (corte <= 0) continue;
            const lugar = resto.slice(0, corte).trim();
            const nota = resto.slice(corte + 1).trim();
            if (lugar && nota) return { lugar, nota };
        }
        return null;
    }

    async function saveNoteFromChat(lugar, nota) {
        const uid = window.currentUser?.uid;
        if (!uid) return false;
        try {
            await firebase.firestore().collection('notes').add({
                userId: uid,
                key: lugar,
                destination: lugar,
                note: nota,
                text: nota,
                source: 'lex_chat',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Regenerar stateNotes en el perfil
            if (typeof window.initializeLexProfile === 'function') {
                setTimeout(() => window.initializeLexProfile(), 1000);
            }
            return true;
        } catch (e) {
            debugLog('[LEX-AI] Error guardando nota:', e);
            return false;
        }
    }

    // ============================================================
    //  CONTEXTO DE CARGA ACTIVA EN EL CALCULADOR
    // ============================================================
    // Cache de clima para no hacer dos llamadas seguidas al mismo destino
    let _weatherCache = { destination: null, data: null };

    async function getActiveLoadContext() {
        const d = window._lastDecisionData;
        if (!d || !d.actualRPM || !d.totalMiles) return null;

        // Rate: prefer UI field value; fallback to _lastDecisionData when user entered RPM instead
        let tarifa = parseFloat(document.getElementById('rate')?.value || 0);
        if (!tarifa && d.actualRPM && d.totalMiles) tarifa = parseFloat((d.actualRPM * d.totalMiles).toFixed(2));
        const origen = document.getElementById('origin')?.value || '';
        // Destination: try visible dynamic input first, fallback to hidden #destination
        const destino =
            document.getElementById('destinationInput_0')?.value ||
            document.getElementById('destination')?.value || '';

        if (!tarifa || !origen) return null;

        const margen = d.thresholds?.cpm
            ? (((d.actualRPM - d.thresholds.cpm) / d.actualRPM) * 100).toFixed(1)
            : '?';

        // Clima del destino — async, con cache para no repetir llamadas
        let weatherLine = '';
        if (destino && typeof window.getWeatherForDestination === 'function') {
            try {
                if (_weatherCache.destination !== destino) {
                    _weatherCache.data = await window.getWeatherForDestination(destino);
                    _weatherCache.destination = destino;
                }
                const w = _weatherCache.data;
                if (w) {
                    const isSnow = w.condition?.toLowerCase().includes('snow') || w.temp <= 32;
                    const isStorm = w.condition?.toLowerCase().includes('storm') || w.condition?.toLowerCase().includes('thunder');
                    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
                    const alert = isSnow
                        ? (isEs ? '⚠️ ALERTA: Nieve/hielo — exige más RPM por condiciones peligrosas.' : '⚠️ ALERT: Snow/ice — demand higher RPM for dangerous conditions.')
                        : isStorm
                        ? (isEs ? '⚠️ ALERTA: Tormenta eléctrica — posibles retrasos.' : '⚠️ ALERT: Thunderstorm — possible delays.')
                        : '';
                    weatherLine = isEs
                        ? `- Clima en destino: ${w.text}${alert ? '\n' + alert : ''}`
                        : `- Weather at destination: ${w.text}${alert ? '\n' + alert : ''}`;
                }
            } catch (e) {
                debugLog('[LEX-AI] Weather fetch failed:', e.message);
            }
        }

        const isEsCtx = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

        // Costos EXACTOS del panel para esta carga (misma formula que la pantalla)
        const e = window._lastLoadExp;
        const money = (v) => '$' + (Number(v) || 0).toFixed(2);
        let costLines = '';
        if (e && Number.isFinite(Number(e.total)) && Number.isFinite(Number(d.netProfit))) {
            const other = (Number(e.maintenanceCost) || 0) + (Number(e.fixedCosts) || 0);
            const target = Number(d.thresholds?.acceptThreshold) || 0;
            costLines = isEsCtx
                ? `- Costos de esta carga (cifras del panel, NO las recalcules):
  - Combustible: ${money(e.fuelCost)}
  - Otros costos por milla (variables + fijos mensuales de Configuración): ${money(other)}
  - Hospedaje (promedio del mes por milla): ${money(e.foodCost)}
  - Peajes: ${money(e.tolls)}
  - Total gastos: ${money(e.total)}
- Ganancia neta: ${money(d.netProfit)}
- Costo por milla de esta carga (incluye sus peajes): $${(Number(d.thresholds?.cpm) || 0).toFixed(3)}/mi${target ? `
- Objetivo del panel: $${target.toFixed(3)}/mi = ${money(target * d.totalMiles)} total` : ''}`
                : `- Costs of this load (panel figures, do NOT recompute them):
  - Fuel: ${money(e.fuelCost)}
  - Other per-mile costs (variable + monthly fixed from Settings): ${money(other)}
  - Lodging (monthly average per mile): ${money(e.foodCost)}
  - Tolls: ${money(e.tolls)}
  - Total expenses: ${money(e.total)}
- Net profit: ${money(d.netProfit)}
- Cost per mile of this load (including its tolls): $${(Number(d.thresholds?.cpm) || 0).toFixed(3)}/mi${target ? `
- Panel target: $${target.toFixed(3)}/mi = ${money(target * d.totalMiles)} total` : ''}`;
        }


        // Notas del lugar y de viajes anteriores (las mismas del panel)
        const _ln = window._lastLoadNotes || {};
        const _noteList = [...(_ln.place || []), ...(_ln.trips || [])].slice(0, 8);
        const notesLines = _noteList.length
            ? (isEsCtx
                ? `- Notas del conductor para esta carga (lugar y viajes anteriores):\n${_noteList.map(n => `  - "${n}"`).join('\n')}\n- Si alguna nota describe un problema (esperas, muelle difícil, poca carga de salida, peajes, clima, zona peligrosa), úsala como razón concreta para subir el precio en la contraoferta y dale al usuario la frase exacta para el dispatcher mencionando ese motivo.`
                : `- Driver notes for this load (place and previous trips):\n${_noteList.map(n => `  - "${n}"`).join('\n')}\n- If a note describes a problem (waiting time, difficult dock, few outbound loads, tolls, weather, unsafe area), use it as a concrete reason to raise the price in the counteroffer and give the user the exact line for the dispatcher mentioning that reason.`)
            : '';
        if (isEsCtx) {
            return `
CARGA ACTIVA EN EL CALCULADOR (el usuario ya tiene esta carga en pantalla):
- Ruta: ${origen} → ${destino}
- Millas: ${d.totalMiles}
- Tarifa: $${tarifa}
- RPM: $${d.actualRPM.toFixed(3)}/mi
- Margen actual: ${margen}%
- Decisión del panel: ${d.decision}
${costLines}
${notesLines}
${weatherLine}
Si el usuario pregunta "¿la acepto?", "¿qué opinas?" o "analízala" sin dar datos, se refiere a ESTA carga.
Para ESTA carga usa exactamente los costos, la ganancia y el objetivo de arriba; el desglose histórico es solo referencia y no sirve para calcularla.
Tu decisión para ESTA carga es la del panel (${d.decision}); puedes aconsejar cómo negociarla o aprovecharla, pero no la cambies.`;
        } else {
            return `
ACTIVE LOAD IN CALCULATOR (user has this load on screen):
- Route: ${origen} → ${destino}
- Miles: ${d.totalMiles}
- Rate: $${tarifa}
- RPM: $${d.actualRPM.toFixed(3)}/mi
- Current margin: ${margen}%
- Panel decision: ${d.decision}
${costLines}
${notesLines}
${weatherLine}
If the user asks "should I take it?", "what do you think?" or "analyze it" without giving data, they mean THIS load.
For THIS load use exactly the costs, profit and target above; the historical breakdown is reference only and must not be used to compute it.
Your decision for THIS load is the panel's (${d.decision}); you may advise how to negotiate or make the most of it, but do not change it.`;
        }
    }

    // ============================================================
    //  BUILD SYSTEM PROMPT con datos reales del conductor
    // ============================================================
    async function buildSystemPrompt() {
        const p = await loadRealProfile() || {};

        // Cargar config del usuario para thresholds reales
        let userConfig = {};
        try {
            const uid = window.currentUser?.uid;
            if (uid) {
                const userSnap = await firebase.firestore().collection('users').doc(uid).get();
                if (userSnap.exists) userConfig = userSnap.data();
            }
        } catch (e) { }

        // CPM real desde CPMEngine
        let cpm = p.avgCPM || p.currentCosts?.total || 0.55;
        try {
            const cpmResult = await window.CPMEngine.getCPM();
            if (cpmResult?.cpm) cpm = cpmResult.cpm;
        } catch (e) { }

        const avgRPM = p.avgRPM || 0;
        const totalLoads = p.totalLoads || 0;
        const targetProfitPct = (userConfig.targetProfit || 20) / 100;

        // Thresholds dinamicos — igual que getDecisionInteligente
        const targetRPM_margen = cpm / (1 - targetProfitPct);
        // D5: RPM historico solo referencia. RPM minimo de Configuracion = piso.
        let acceptThreshold = Math.max(targetRPM_margen, Number(userConfig.targetRPM) || 0);
        // Con una carga activa en la calculadora: los mismos umbrales que el panel
        // (costo por milla de ESA carga con gasolina de la ruta y fijos actuales)
        const _panelT = window._lastDecisionData?.thresholds;
        if (Number(_panelT?.cpm) > 0 && Number(_panelT?.acceptThreshold) > 0) {
            cpm = Number(_panelT.cpm);
            acceptThreshold = Number(_panelT.acceptThreshold);
        }
        const midThreshold = acceptThreshold;

        // Estados buenos/malos desde historial REAL — sin repetir
        const stateEntries = Object.entries(p.stateStats || {})
            .filter(([, s]) => s.loads >= 2 && s.avgRPM > 0)
            .sort(([, a], [, b]) => b.avgRPM - a.avgRPM);

        const mitad = Math.ceil(stateEntries.length / 2);
        const bestKeys = new Set(stateEntries.slice(0, mitad).map(([st]) => st));

        const currentLang = window.i18n?.currentLang || localStorage.getItem('app_language') || 'en';
        const isEs = currentLang === 'es';

        const bestStates = stateEntries.slice(0, mitad)
            .map(([st, s]) => `  - ${st}: $${s.avgRPM.toFixed(2)}/mi (${s.loads} ${isEs ? 'cargas' : 'loads'})`)
            .join('\n');

        const worstStates = stateEntries.slice(-mitad).reverse()
            .filter(([st]) => !bestKeys.has(st))
            .map(([st, s]) => `  - ${st}: $${s.avgRPM.toFixed(2)}/mi (${s.loads} ${isEs ? 'cargas' : 'loads'})`)
            .join('\n');

        // Desglose de costos
        let costsText = '';
        if (p.currentCosts) {
            const c = p.currentCosts;
            costsText = isEs
                ? `\nDESGLOSE HISTÓRICO DE COSTOS (solo referencia, no para la carga activa):\n  - Combustible: $${(c.combustible || 0).toFixed(3)}/mi\n  - Mantenimiento: $${(c.mantenimiento || 0).toFixed(3)}/mi\n  - Costos fijos: $${(c.costosFijos || 0).toFixed(3)}/mi`
                : `\nHISTORICAL COST BREAKDOWN (reference only, not for the active load):\n  - Fuel: $${(c.combustible || 0).toFixed(3)}/mi\n  - Maintenance: $${(c.mantenimiento || 0).toFixed(3)}/mi\n  - Fixed costs: $${(c.costosFijos || 0).toFixed(3)}/mi`;
        }

        // Contexto financiero — mes actual y mes anterior
        let financeContext = '';
        try {
            const now = new Date();
            const uid = window.currentUser?.uid;
            const locale = isEs ? 'es' : 'en-US';

            const firstDayActual = new Date(now.getFullYear(), now.getMonth(), 1);
            const firstDayAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDayAnterior = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthName = now.toLocaleString(locale, { month: 'long', year: 'numeric' });
            const prevMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                .toLocaleString(locale, { month: 'long', year: 'numeric' });

            const [loadsActual, loadsAnterior, expActual, expAnterior] = await Promise.all([
                firebase.firestore().collection('loads').where('userId', '==', uid)
                    .where('date', '>=', firstDayActual.toISOString().split('T')[0]).get(),
                firebase.firestore().collection('loads').where('userId', '==', uid)
                    .where('date', '>=', firstDayAnterior.toISOString().split('T')[0])
                    .where('date', '<', lastDayAnterior.toISOString().split('T')[0]).get(),
                firebase.firestore().collection('expenses').where('userId', '==', uid)
                    .where('date', '>=', firstDayActual.toISOString().split('T')[0]).get(),
                firebase.firestore().collection('expenses').where('userId', '==', uid)
                    .where('date', '>=', firstDayAnterior.toISOString().split('T')[0])
                    .where('date', '<', lastDayAnterior.toISOString().split('T')[0]).get(),
            ]);

            const calcMes = (loads, exps) => {
                let revenue = 0, miles = 0, expenses = 0;
                loads.forEach(d => { revenue += d.data().totalCharge || 0; miles += d.data().totalMiles || 0; });
                exps.forEach(d => { expenses += d.data().amount || 0; });
                return { revenue, miles, expenses, rpm: miles > 0 ? revenue / miles : 0, loads: loads.size };
            };

            const actual = calcMes(loadsActual, expActual);
            const anterior = calcMes(loadsAnterior, expAnterior);
            const rpmDiffActual = (avgRPM > 0 && actual.loads > 0) ? (((actual.rpm - avgRPM) / avgRPM) * 100).toFixed(1) : null;
            const rpmDiffAnterior = (avgRPM > 0 && anterior.loads > 0) ? (((anterior.rpm - avgRPM) / avgRPM) * 100).toFixed(1) : null;

            if (isEs) {
                financeContext = `
CONTEXTO FINANCIERO:
${currentMonthName.toUpperCase()} (mes actual):
- Cargas: ${actual.loads} | Ingresos: $${actual.revenue.toFixed(2)} | Gastos: $${actual.expenses.toFixed(2)}
- Ganancia neta: $${(actual.revenue - actual.expenses).toFixed(2)} | RPM: $${actual.rpm.toFixed(3)}/mi${rpmDiffActual !== null ? ` (${parseFloat(rpmDiffActual) >= 0 ? '+' : ''}${rpmDiffActual}% vs histórico)` : ''}

${prevMonthName.toUpperCase()} (mes anterior):
- Cargas: ${anterior.loads} | Ingresos: $${anterior.revenue.toFixed(2)} | Gastos: $${anterior.expenses.toFixed(2)}
- Ganancia neta: $${(anterior.revenue - anterior.expenses).toFixed(2)} | RPM: $${anterior.rpm.toFixed(3)}/mi${rpmDiffAnterior !== null ? ` (${parseFloat(rpmDiffAnterior) >= 0 ? '+' : ''}${rpmDiffAnterior}% vs histórico)` : ''}`;
            } else {
                financeContext = `
FINANCIAL CONTEXT:
${currentMonthName.toUpperCase()} (current month):
- Loads: ${actual.loads} | Revenue: $${actual.revenue.toFixed(2)} | Expenses: $${actual.expenses.toFixed(2)}
- Net profit: $${(actual.revenue - actual.expenses).toFixed(2)} | RPM: $${actual.rpm.toFixed(3)}/mi${rpmDiffActual !== null ? ` (${parseFloat(rpmDiffActual) >= 0 ? '+' : ''}${rpmDiffActual}% vs historical avg)` : ''}

${prevMonthName.toUpperCase()} (previous month):
- Loads: ${anterior.loads} | Revenue: $${anterior.revenue.toFixed(2)} | Expenses: $${anterior.expenses.toFixed(2)}
- Net profit: $${(anterior.revenue - anterior.expenses).toFixed(2)} | RPM: $${anterior.rpm.toFixed(3)}/mi${rpmDiffAnterior !== null ? ` (${parseFloat(rpmDiffAnterior) >= 0 ? '+' : ''}${rpmDiffAnterior}% vs historical avg)` : ''}`;
            }
        } catch (e) {
            debugLog('[LEX-AI] Error cargando contexto financiero:', e);
        }

        // Contexto de carga activa — async, debe resolverse antes del template string
        const activeLoadContext = await getActiveLoadContext() || '';
        // Decision del panel para la carga activa, con los mismos terminos que usa Lex
        const _pd = activeLoadContext ? String(window._lastDecisionData?.decision || '') : '';
        const panelDecisionEs = { 'ACCEPT': 'ACEPTA', 'ALMOST ACCEPT': 'CASI ACEPTA', 'EVALUATE': 'EVALÚA CON CUIDADO', 'REJECT': 'RECHAZA' }[_pd] || '';
        const panelDecisionEn = { 'ACCEPT': 'ACCEPT', 'ALMOST ACCEPT': 'ALMOST ACCEPT', 'EVALUATE': 'EVALUATE CAREFULLY', 'REJECT': 'REJECT' }[_pd] || '';

        const langInstruction = isEs
            ? 'Responde SIEMPRE en español. Sé directo, práctico y usa números concretos.'
            : 'IMPORTANT: Always respond in English. Never switch to Spanish. Be direct, practical, and use concrete numbers.';

        const decisionTerms = isEs
            ? 'ACEPTA / EVALÚA CON CUIDADO / RECHAZA'
            : 'ACCEPT / EVALUATE CAREFULLY / REJECT';

        if (isEs) {
            return `Eres Lex, asistente de IA experto en expediting (camionería express en USA).
${langInstruction}
Si el usuario hace una pregunta que NO está relacionada con cargas, finanzas o expediting, respóndela directamente de forma amigable y útil — sin mencionar el perfil del conductor ni los umbrales de decisión.
Cuando analices una carga, muestra los cálculos clave (RPM, costo, ganancia).
IMPORTANTE: Tienes datos financieros REALES del conductor en la sección CONTEXTO FINANCIERO abajo. SIEMPRE úsalos para responder preguntas sobre su mes o rendimiento — nunca digas "no tengo información" cuando esos datos existen. Si el mes actual tiene 0 cargas, dilo claramente y compara con el mes anterior usando los datos reales.

PERFIL REAL DEL CONDUCTOR:
- CPM real (costo por milla): $${cpm.toFixed(3)}/mi
- RPM promedio histórico: ${avgRPM > 0 ? '$' + avgRPM.toFixed(3) + '/mi' : 'sin datos todavía'}
- Margen objetivo: ${(targetProfitPct * 100).toFixed(0)}%
- Cargas registradas: ${totalLoads}
${costsText}

UMBRALES DE DECISIÓN DE ESTE CONDUCTOR:
- RECHAZA si el RPM es MENOR que $${cpm.toFixed(3)} (no cubre su costo: pierde dinero)
- EVALÚA CON CUIDADO si el RPM está entre $${cpm.toFixed(3)} y $${acceptThreshold.toFixed(3)} (cubre el costo pero no llega a su margen objetivo: conviene negociar)
- ACEPTA si el RPM es IGUAL O MAYOR que $${acceptThreshold.toFixed(3)} (cubre el costo y su margen objetivo)
- Compara número contra número antes de decidir (por ejemplo, $0.73 es MAYOR que $0.61).

HISTORIAL POR ESTADO (${totalLoads} cargas reales):
MEJORES estados para este conductor:
${bestStates || '  (sin datos suficientes aún)'}
${worstStates ? `\nESTADOS CON MENOR RPM para este conductor:\n${worstStates}` : ''}
${Object.keys(p.stateNotes || {}).length > 0 ? `NOTAS OPERATIVAS DEL CONDUCTOR (experiencia real por estado):
${Object.entries(p.stateNotes || {}).map(([state, notes]) =>
                `  ${state}:\n${notes.map(n => `    - "${n}"`).join('\n')}`
            ).join('\n')}
IMPORTANTE: Cuando analices una carga hacia alguno de estos estados, SIEMPRE menciona las notas relevantes antes de dar tu recomendación.` : ''}

REGLAS DE ANÁLISIS:
1. RPM = tarifa total / millas totales (incluyendo deadhead)
2. Evalúa cada carga por su propio mérito — no asumas regreso a ningún hub fijo
3. Un estado difícil es el que históricamente da mal RPM A ESTE conductor específico
4. Margen real = (RPM - CPM) / RPM × 100
5. Contraoferta: solo si el RPM está por debajo de $${acceptThreshold.toFixed(3)}. Entonces pide al menos $${acceptThreshold.toFixed(3)} × millas totales, redondeado hacia arriba. Si la oferta ya llega o pasa de esa cifra, NUNCA sugieras pedir menos de lo que ofrecen: la carga ya cumple su objetivo (como mucho, pide algo más si hay una razón concreta: peajes, zona difícil, esperas).
${panelDecisionEs ? `6. OBLIGATORIO: para la CARGA ACTIVA tu recomendación es "${panelDecisionEs}" (la del panel), aunque el usuario diga que la acepta o insista. Nunca escribas "ACEPTA" ni "SÍ, ACEPTA" si el panel no dice ACCEPT. Puedes decirle qué negociar y cómo aprovecharla si decide tomarla, pero la recomendación no cambia.` : ''}

${activeLoadContext}
${financeContext}

FORMATO DE RESPUESTA:
- Responde de forma natural y adaptada a la pregunta del usuario.
- SI ESTÁS ANALIZANDO UNA CARGA, usa números concretos y termina tu mensaje con una recomendación usando exactamente estos términos: ${decisionTerms}
- SI ES UNA PREGUNTA GENERAL o charlando, SIEMPRE responde la pregunta directamente, sin agregar recomendación.`;
        } else {
            return `You are Lex, an AI expert in expediting (express trucking in the USA).
${langInstruction}
If the user asks a question NOT related to loads, finances or expediting, answer it directly in a friendly and helpful way — without referencing the driver profile or decision thresholds.
When analyzing a load, show the key calculations (RPM, cost, profit).
IMPORTANT: You have the driver's REAL financial data in the FINANCIAL CONTEXT section below. ALWAYS use it to answer questions about their month or performance — never say "I don't have information" when that data exists. If the current month has 0 loads, say so clearly and compare to last month using the real figures.

DRIVER REAL PROFILE:
- Real CPM (cost per mile): $${cpm.toFixed(3)}/mi
- Historical average RPM: ${avgRPM > 0 ? '$' + avgRPM.toFixed(3) + '/mi' : 'no data yet'}
- Target profit margin: ${(targetProfitPct * 100).toFixed(0)}%
- Registered loads: ${totalLoads}
${costsText}

THIS DRIVER'S DECISION THRESHOLDS:
- REJECT if RPM is LOWER than $${cpm.toFixed(3)} (does not cover their cost: losing money)
- EVALUATE CAREFULLY if RPM is between $${cpm.toFixed(3)} and $${acceptThreshold.toFixed(3)} (covers cost but misses their target margin: worth negotiating)
- ACCEPT if RPM is EQUAL TO OR HIGHER than $${acceptThreshold.toFixed(3)} (covers cost and their target margin)
- Compare number against number before deciding (for example, $0.73 is HIGHER than $0.61).

STATE HISTORY (${totalLoads} real loads):
BEST states for this driver:
${bestStates || '  (not enough data yet)'}
${worstStates ? `\nLOWEST RPM STATES for this driver:\n${worstStates}` : ''}
${Object.keys(p.stateNotes || {}).length > 0 ? `DRIVER OPERATIONAL NOTES (real experience by state):
${Object.entries(p.stateNotes || {}).map(([state, notes]) =>
                `  ${state}:\n${notes.map(n => `    - "${n}"`).join('\n')}`
            ).join('\n')}
IMPORTANT: When analyzing a load to any of these states, ALWAYS mention the relevant notes before giving your recommendation.` : ''}

ANALYSIS RULES:
1. RPM = total rate / total miles (including deadhead)
2. Evaluate each load on its own merits — do not assume return to any fixed hub
3. A difficult state is one that historically gives bad RPM for THIS specific driver
4. Real margin = (RPM - CPM) / RPM × 100
5. Counteroffer: only if RPM is below $${acceptThreshold.toFixed(3)}. Then ask for at least $${acceptThreshold.toFixed(3)} × total miles, rounded up. If the offer already meets or exceeds that amount, NEVER suggest asking for less than they offer: the load already meets their target (at most, ask for a bit more if there is a concrete reason: tolls, difficult zone, waiting time).
${panelDecisionEn ? `6. MANDATORY: for the ACTIVE LOAD your recommendation is "${panelDecisionEn}" (the panel's), even if the user says they accept it or insists. Never write "ACCEPT" or "YES, ACCEPT" unless the panel says ACCEPT. You may tell them what to negotiate and how to make the most of it if they take it, but the recommendation does not change.` : ''}

${activeLoadContext}
${financeContext}

RESPONSE FORMAT:
- Respond naturally according to the user's question.
- IF YOU ARE ANALYZING A LOAD, use concrete dollar amounts and end your message with a recommendation using exactly these terms: ${decisionTerms}
- IF IT IS A GENERAL QUESTION or chat, ALWAYS answer the question directly, without adding recommendation terms.`;
        }
    }


    // ============================================================
    //  LLAMADA A OPENROUTER API
    // ============================================================
    // Intents que requieren el prompt completo con datos del usuario
    const HEAVY_INTENTS = new Set([
        'PRICING', 'PRICING_SIMPLE', 'PRICING_WITH_DEADHEAD', 'PRICING_GENERIC',
        'COMPARE_HISTORY', 'STATE_SUMMARY', 'STATE_MARKET', 'GLOBAL_METRICS',
        'NEGOTIATION', 'DECISION_HELP', 'DEADHEAD_CONTEXT', 'FINANCES',
        'APP_INFO'
        // NOTE: 'EXTERNAL' (clima/noticias) removido — usa buildCasualPrompt() sin Firebase
    ]);

    function buildCasualPrompt() {
        const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
        return isEs
            ? 'Eres Lex, el asistente de IA experto de SmartLoad para expediters. PUEDES RESPONDER A CUALQUIER PREGUNTA del usuario sin restricciones (clima, traducciones, historia, ciencia, o charla general). Mantén tu personalidad amable y útil. Si te hablan sobre cargas sin dar datos concretos, aliéntalos a introducirlos en la calculadora.'
            : 'You are Lex, the expert AI assistant by SmartLoad for expediters. YOU CAN ANSWER ANY QUESTION from the user without restrictions (weather, translations, history, science, or general chat). Keep a friendly and helpful personality. If they talk about loads without concrete data, encourage them to use the calculator.';
    }

    // ============================================================
    //  RATE LIMITING — máx 1 llamada cada 3 segundos
    // ============================================================
    let _lastCallTs = 0;
    const RATE_LIMIT_MS = 3000;

    function isRateLimited() {
        const now = Date.now();
        if (now - _lastCallTs < RATE_LIMIT_MS) return true;
        _lastCallTs = now;
        return false;
    }

    // ============================================================
    //  DAILY MESSAGE CAP — trial: 25/día, pro: 10/día, premium: lo controla el servidor
    // ============================================================
    const TRIAL_DAILY_LIMIT = 25;

    function _dailyKey() {
        const uid = window.currentUser?.uid || 'anon';
        const today = new Date().toISOString().split('T')[0];
        return `lex_daily_${uid}_${today}`;
    }

    function getDailyCount() {
        const n = parseInt(localStorage.getItem(_dailyKey()) || '0', 10);
        return isNaN(n) ? 0 : n;
    }

    function incrementDailyCount() {
        const key = _dailyKey();
        localStorage.setItem(key, String(getDailyCount() + 1));
        // Limpiar claves de días anteriores para no llenar localStorage
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith('lex_daily_') && k !== key) localStorage.removeItem(k);
            }
        } catch (_) {}
    }

    // Límite diario que aplica en el navegador (el servidor lo vuelve a comprobar)
    function getDailyLimit() {
        const limits = window.userPlan?.limits || {};
        const trialEnd = window.userPlan?.lexTrialEndsAt;
        const planLimit = Number(limits.lexDailyLimit) > 0 ? Number(limits.lexDailyLimit) : null;
        if (limits.hasLex === true && planLimit === null) return null; // premium: lo controla el servidor
        if (trialEnd && new Date(trialEnd) > new Date()) return TRIAL_DAILY_LIMIT;
        if (limits.hasLex === true) return planLimit; // pro
        return TRIAL_DAILY_LIMIT;
    }

    function isDailyLimitReached() {
        const lim = getDailyLimit();
        return lim !== null && getDailyCount() >= lim;
    }

    async function callOpenRouter(userMessage, conversationHistory = []) {
        // Routing inteligente — prompt ligero para charla casual, pesado para análisis de negocio
        let systemPrompt;
        let maxTokens = OPENROUTER_CONFIG.maxTokens;

        const intent = typeof window.lexDetectIntent === 'function'
            ? window.lexDetectIntent(userMessage)
            : { intent: 'OTHER' };

        // Exponer intent para que lex.js pueda mostrar chips contextuales
        window._lastLexIntent = intent.intent;

        const isCasual = !HEAVY_INTENTS.has(intent.intent) && intent.intent !== 'EMPTY';
        const hasActiveLoad = !!(window._lastDecisionData?.actualRPM);

        if (isCasual && !hasActiveLoad) {
            // Charla casual sin carga activa — prompt mínimo, sin Firestore
            systemPrompt = buildCasualPrompt();
            maxTokens = 450;
            debugLog('[LEX-AI] Routing: CASUAL (intent:', intent.intent, ')');
        } else {
            // Análisis de negocio o carga activa en pantalla — prompt completo
            systemPrompt = await buildSystemPrompt();

            // ── NEGOTIATION BOOSTER ──────────────────────────────────────────
            // Si el intent es negociación, inyectar instrucciones específicas
            // para que Lex genere frases textuales para el dispatcher.
            if (intent.intent === 'NEGOTIATION') {
                const d = window._lastDecisionData;
                const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
                const targetRPM = d?.thresholds?.acceptThreshold;
                const totalMiles = d?.totalMiles;
                const targetTotal = (targetRPM && totalMiles)
                    ? `$${Math.ceil(targetRPM * totalMiles).toLocaleString()}`
                    : null;

                if (isEs) {
                    systemPrompt += `\n\n[INSTRUCCIÓN ESPECIAL — NEGOCIACIÓN]\nEl usuario quiere negociar. Genera:\n1. Una frase exacta y corta que puede decirle al dispatcher (entre comillas).\n2. El número concreto a pedir${targetTotal ? ` — el objetivo es ${targetTotal} (${targetRPM?.toFixed(3)}/mi)` : ''}.\n3. Un plan B en caso de que rechacen.\nSé directo, usa el tono de alguien que conoce el negocio. Sin rodeos.`;
                } else {
                    systemPrompt += `\n\n[SPECIAL INSTRUCTION — NEGOTIATION]\nThe user wants to negotiate. Generate:\n1. An exact short phrase they can say to the dispatcher (in quotes).\n2. The concrete number to ask for${targetTotal ? ` — target is ${targetTotal} (${targetRPM?.toFixed(3)}/mi)` : ''}.\n3. A Plan B if they reject.\nBe direct, use the tone of someone who knows the business. No fluff.`;
                }
                debugLog('[LEX-AI] NEGOTIATION booster inyectado');
            }
            // ────────────────────────────────────────────────────────────────

            debugLog('[LEX-AI] Routing: HEAVY (intent:', intent.intent, ')');
        }

        // Construir mensajes con historial de conversación (máximo últimos 4)
        const recentHistory = conversationHistory.slice(-4);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...recentHistory,
            { role: 'user', content: userMessage }
        ];

        // maxTokens dinámico: reducir salida si el prompt es muy largo
        // Estimación: 1 token ≈ 4 caracteres. Límite DeepSeek: ~8000 tokens de entrada.
        const estimatedInputTokens = Math.ceil(
            messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4
        );
        if (estimatedInputTokens > 5000) {
            maxTokens = Math.max(200, maxTokens - Math.floor((estimatedInputTokens - 5000) / 10));
            debugLog('[LEX-AI] Prompt largo (' + estimatedInputTokens + ' tokens est.), maxTokens ajustado a:', maxTokens);
        }

        // La llamada a OpenRouter se hace en el servidor (Cloud Function lexChat):
        // la API key nunca llega al navegador y el acceso (plan/trial) se valida alli.
        // El fallback de modelo tambien lo maneja el servidor.
        const lexChatFn = firebase.app().functions('us-central1').httpsCallable('lexChat');
        const res = await lexChatFn({
            messages: messages,
            maxTokens: maxTokens,
            temperature: isCasual ? 0.7 : 0.4
        });

        debugLog('[LEX-AI] Modelo:', res.data?.model);

        if (!res.data || typeof res.data.content !== 'string') {
            throw new Error('Respuesta vacía de Lex AI');
        }
        return res.data.content;
    }

    // ============================================================
    //  HISTORIAL DE CONVERSACIÓN — persiste en sessionStorage
    //  (sobrevive cambios de tab, se limpia al cerrar el navegador)
    // ============================================================
    const HISTORY_KEY = 'lex_chat_history';
    const MAX_HISTORY_MSGS = 10; // máx mensajes en historial

    function loadHistory() {
        try {
            const raw = sessionStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(history) {
        try {
            sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            debugLog('[LEX-AI] No se pudo guardar historial en sessionStorage:', e.message);
        }
    }

    // Array en memoria sincronizado con sessionStorage
    const conversationHistory = loadHistory();

    function addToHistory(role, content) {
        conversationHistory.push({ role, content });
        // Mantener solo los últimos MAX_HISTORY_MSGS mensajes
        if (conversationHistory.length > MAX_HISTORY_MSGS) {
            conversationHistory.splice(0, 2); // quitar el par más antiguo (user+assistant)
        }
        saveHistory(conversationHistory);
    }

    // ============================================================
    //  TYPING INDICATOR — 3 puntitos animados mientras Lex piensa
    // ============================================================
    function injectTypingCSS() {
        if (document.getElementById('lex-typing-css')) return;
        const style = document.createElement('style');
        style.id = 'lex-typing-css';
        style.textContent = `
      @keyframes lexDot {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30%            { transform: translateY(-4px); opacity: 1; }
      }
      #lex-typing-indicator .lex-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: #60a5fa; display: inline-block;
      }
      #lex-typing-indicator .lex-dot:nth-child(1) { animation: lexDot 1.2s infinite ease-in-out 0s; }
      #lex-typing-indicator .lex-dot:nth-child(2) { animation: lexDot 1.2s infinite ease-in-out 0.4s; }
      #lex-typing-indicator .lex-dot:nth-child(3) { animation: lexDot 1.2s infinite ease-in-out 0.8s; }
    `;
        document.head.appendChild(style);
    }

    function showTypingIndicator() {
        const messages = document.getElementById('lexChatMessages');
        if (!messages) return;
        injectTypingCSS();
        removeTypingIndicator();
        const el = document.createElement('div');
        el.id = 'lex-typing-indicator';
        el.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding: 2px 0;';
        el.innerHTML = `
      <div style="width:20px;height:20px;border-radius:9999px;background:#0f172a;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
        <img src="img/lex-thinking.webp" alt="Lex"
          style="width:100%;height:100%;object-fit:contain;"
          onerror="this.src='img/lex-neutral.webp'">
      </div>
      <div style="background:#030712;border:1px solid #1f2937;
        border-radius:12px 12px 12px 4px;padding:8px 12px;
        display:flex;align-items:center;gap:5px;">
        <span class="lex-dot"></span>
        <span class="lex-dot"></span>
        <span class="lex-dot"></span>
      </div>`;
        messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('lex-typing-indicator');
        if (el) el.remove();
    }

    // ============================================================
    //  VERIFICAR SI EL API KEY ESTÁ CONFIGURADO
    // ============================================================
    function isConfigured() {
        // "Configurado" = se puede llamar a la Cloud Function lexChat con un usuario logueado.
        try {
            return typeof firebase !== 'undefined' &&
                firebase.apps && firebase.apps.length > 0 &&
                typeof firebase.app().functions === 'function' &&
                !!firebase.auth().currentUser;
        } catch (e) {
            return false;
        }
    }

    // ============================================================
    //  PARSER DE LOAD BOARD — detecta texto pegado y llena calculadora
    // ============================================================
    function parseLoadBoardText(text) {
        const t = text.trim();

        // Mínimo de longitud — mensajes cortos nunca son load boards
        if (t.length < 20) return null;

        // ── 1. DETECTAR PRECIO ───────────────────────────────────────
        // Formatos: $975, $1,200, $1200.50, 975 usd, 975 dlls
        let rate = 0;
        const ratePatterns = [
            /\$\s*([\d,]+(?:\.\d+)?)/,                        // $1,200 o $975.50
            /\b([\d,]+(?:\.\d+)?)\s*(?:usd|dlls?|dollars?)/i // 1200 usd
        ];
        for (const p of ratePatterns) {
            const m = t.match(p);
            if (m) { rate = parseFloat(m[1].replace(/,/g, '')); break; }
        }

        // ── 2. DETECTAR MILLAS ───────────────────────────────────────
        // Formatos: 820mi, 820 miles, 820 m (standalone), 820miles
        let miles = 0;
        const milesPatterns = [
            /\b([\d,]+)\s*miles?\b/i,      // 820 miles, 820mi
            /\b([\d,]{3,4})\s*m\b/i        // 820 m (mínimo 3 dígitos para evitar "am")
        ];
        for (const p of milesPatterns) {
            const m = t.match(p);
            if (m) { miles = parseInt(m[1].replace(/,/g, '')); break; }
        }

        // Requiere al menos precio O millas para continuar
        if (rate === 0 && miles === 0) return null;

        // ── 3. DETECTAR RUTA (origen → destino) ─────────────────────
        // Soporta: "City, ST - City, ST", "City ST to City ST",
        //          "City ST → City ST", "City ST | City ST"
        let origin = '', destination = '';
        // Estado = 2 mayúsculas seguidas de límite de palabra (sin flag /i, para no
        // cortar "Atlanta" en "Atla"). Separadores: - – — → -> > | to
        const CITY_ST = "([A-Za-z][A-Za-z.' -]*?,?\\s+[A-Z]{2})\\b";
        const routeRe = new RegExp(CITY_ST + "\\s*(?:->|→|–|—|-|\\||>|\\b[Tt][Oo]\\b)\\s*" + CITY_ST);
        const m = t.match(routeRe);
        if (m) {
            const limpiar = s => s.replace(/^(?:pick\s*up|pickup|pu|from|origin|load|carga|desde|de)\s*:?\s+/i, '').trim();
            origin      = limpiar(m[1]);
            destination = limpiar(m[2]);
        }

        // ── 4. DETECTAR RPM EXPLÍCITO ────────────────────────────────
        // Formatos: 1.20/mi, 1.20 rpm, 1.20 per mile
        let rpm = 0;
        const rpmMatch = t.match(/\b(\d+\.\d+)\s*(?:rpm|\/mi|per\s*mi(?:le)?)/i);
        if (rpmMatch) {
            rpm = parseFloat(rpmMatch[1]);
        } else if (miles > 0 && rate > 0) {
            rpm = parseFloat((rate / miles).toFixed(3));
        }

        // ── 5. DETECTAR DEADHEAD ─────────────────────────────────────
        // Formatos: DH 30mi, DH:30, deadhead 30 miles, empty 30mi
        let deadhead = 0;
        const dhMatch = t.match(/(?:dh|deadhead|empty)[:\s]+(\d+)\s*mi(?:les?)?/i)
                     || t.match(/dh[:\s]*(\d+)/i);
        if (dhMatch) deadhead = parseInt(dhMatch[1]);

        // ── 6. VALIDACIÓN FINAL ──────────────────────────────────────
        // Necesitamos al menos millas Y precio (o RPM) para que tenga sentido
        const hasEnoughData = (miles > 0 && rate > 0) || (miles > 50 && rpm > 0);
        if (!hasEnoughData) return null;

        // Sanity check — valores fuera de rango no son cargas reales
        if (miles > 0 && (miles < 10 || miles > 5000)) return null;
        if (rate > 0 && (rate < 50 || rate > 50000)) return null;

        return { origin, destination, miles, deadhead, rate, rpm };
    }

    function fillCalculatorFromLoad(data) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el || !val) return;
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Tarifa y vacío van DESPUÉS de las millas: si la tarifa entra con solo el
        // vacío como millas totales, el RPM sale inflado y la tarifa se recalcula mal.
        const llenarDinero = () => {
            const rpmEl = document.getElementById('rpm');
            if (rpmEl && data.rate) rpmEl.value = '';
            if (data.deadhead)    setVal('deadheadMiles', data.deadhead);
            if (data.rate)        setVal('rate', data.rate);
            if (data.rpm && !data.rate) setVal('rpm', data.rpm);
            if (typeof window.calculate === 'function') setTimeout(() => window.calculate(), 100);
        };

        const loadedEl = document.getElementById('loadedMiles');
        const hayRuta = !!(data.origin && data.destination && document.getElementById('dest-1-input')
                           && typeof window.calculateRoute === 'function');
        if (!hayRuta) {
            if (data.miles) setVal('loadedMiles', data.miles);
            llenarDinero();
            return;
        }
        // Campo visible del primer destino; la ruta de Google llena las millas cargadas
        if (loadedEl) loadedEl.value = '';
        setVal('origin', data.origin);
        setVal('dest-1-input', data.destination);
        if (typeof window.updateLastDestination === 'function') window.updateLastDestination();
        window.calculateRoute();
        const inicio = Date.now();
        (function esperar() {
            if (Number(loadedEl?.value) > 0) return llenarDinero();
            if (Date.now() - inicio > 15000) {
                // Google no respondió: usar las millas del texto
                if (data.miles) setVal('loadedMiles', data.miles);
                return llenarDinero();
            }
            setTimeout(esperar, 300);
        })();
    }

    // ============================================================
    //  FUNCIÓN PRINCIPAL — reemplaza handleLexChatMessage
    // ============================================================
    const originalHandler = window.handleLexChatMessage;

    window.handleLexChatMessage = async function (messageText) {
        const text = (messageText || '').trim();
        if (!text) return;

        // Detectar texto pegado de load board — llenar calculadora sin gastar tokens
        const loadBoardData = parseLoadBoardText(text);
        if (loadBoardData && (loadBoardData.miles > 0 || loadBoardData.rate > 0)) {
            const replyFnLB = typeof window.appendLexMessageFromRouter === 'function'
                ? window.appendLexMessageFromRouter : null;
            const isEs = (window.i18n?.currentLang || 'en') === 'es';

            fillCalculatorFromLoad(loadBoardData);

            const parts = [];
            if (loadBoardData.origin && loadBoardData.destination)
                parts.push(isEs ? `🗺️ Ruta: **${loadBoardData.origin} → ${loadBoardData.destination}**` : `🗺️ Route: **${loadBoardData.origin} → ${loadBoardData.destination}**`);
            if (loadBoardData.miles)
                parts.push(isEs ? `📏 Millas: **${loadBoardData.miles}**` : `📏 Miles: **${loadBoardData.miles}**`);
            if (loadBoardData.rate)
                parts.push(isEs ? `💵 Tarifa: **$${loadBoardData.rate.toLocaleString()}**` : `💵 Rate: **$${loadBoardData.rate.toLocaleString()}**`);
            if (loadBoardData.rpm)
                parts.push(isEs ? `📊 RPM: **$${loadBoardData.rpm.toFixed(3)}/mi**` : `📊 RPM: **$${loadBoardData.rpm.toFixed(3)}/mi**`);
            if (loadBoardData.deadhead)
                parts.push(isEs ? `🔄 Deadhead: **${loadBoardData.deadhead}mi**` : `🔄 Deadhead: **${loadBoardData.deadhead}mi**`);

            const msg = isEs
                ? `He detectado una carga y llenado la calculadora:\n\n${parts.join('\n')}\n\n¿Analizo esta carga para ti?`
                : `I detected a load and filled the calculator:\n\n${parts.join('\n')}\n\nShould I analyze this load for you?`;

            if (replyFnLB) replyFnLB(msg);
            return;
        }

        // Detectar intención de guardar nota
        const saveNoteIntent = detectSaveNote(text);
        if (saveNoteIntent) {
            const { lugar, nota } = saveNoteIntent;
            const replyFnNote = typeof window.appendLexMessageFromRouter === 'function'
                ? window.appendLexMessageFromRouter : null;
            const ok = await saveNoteFromChat(lugar, nota);
            if (replyFnNote) {
                const isEs = (window.i18n?.currentLang || 'en') === 'es';
                replyFnNote(ok
                    ? isEs
                        ? `✅ Nota guardada para **${lugar}**:\n"${nota}"\n\nLa tendré en cuenta la próxima vez que analice una carga hacia esa zona.`
                        : `✅ Note saved for **${lugar}**:\n"${nota}"\n\nI'll keep it in mind the next time I analyze a load to that zone.`
                    : isEs
                        ? `❌ No pude guardar la nota. Intenta de nuevo.`
                        : `❌ Couldn't save the note. Please try again.`
                );
            }
            return;
        }

        // Si no está configurado el API key, usar el handler original
        if (!isConfigured()) {
            debugLog('[LEX-AI] API key no configurado. Usando sistema anterior.');
            if (typeof originalHandler === 'function') {
                return originalHandler(messageText);
            }
            return;
        }

        // Verificar plan del usuario — AI de OpenRouter es premium/trial
        // Sin acceso: caer al router local (responde con datos del perfil sin gastar tokens)
        const hasLexAccess = typeof window.canAccessFeature === 'function'
            ? window.canAccessFeature(window.userPlan, 'Lex')
            : false;

        if (!hasLexAccess) {
            debugLog('[LEX-AI] Sin acceso → router local. Plan:', window.userPlan?.plan,
                '| lexTrialEndsAt:', window.userPlan?.lexTrialEndsAt || 'no trial');
            if (typeof originalHandler === 'function') {
                return originalHandler(messageText);
            }
            // Fallback si ni el router está disponible
            const replyFnPlan = typeof window.appendLexMessageFromRouter === 'function'
                ? window.appendLexMessageFromRouter : null;
            if (replyFnPlan) {
                const isEs = (window.i18n?.currentLang || 'en') === 'es';
                replyFnPlan(
                    isEs
                        ? '💡 El análisis con IA avanzada requiere Premium. Mientras tanto puedo ayudarte con tus estadísticas básicas.\n\n' +
                          '<a href="plans.html" style="display:inline-block;margin-top:6px;padding:6px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:6px;font-weight:600;text-decoration:none;font-size:12px;">👑 Ver Premium →</a>'
                        : '💡 Advanced AI analysis requires Premium. Meanwhile I can help with your basic stats.\n\n' +
                          '<a href="plans.html" style="display:inline-block;margin-top:6px;padding:6px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:6px;font-weight:600;text-decoration:none;font-size:12px;">👑 View Premium →</a>'
                );
            }
            return;
        }

        const replyFn = typeof window.appendLexMessageFromRouter === 'function'
            ? window.appendLexMessageFromRouter
            : null;

        // Rate limiting — bloquea spam silenciosamente
        if (isRateLimited()) {
            debugLog('[LEX-AI] Rate limited — mensaje ignorado');
            const isEs = (window.i18n?.currentLang || 'en') === 'es';
            if (replyFn) replyFn(isEs
                ? '⏳ Un momento... estoy procesando tu mensaje anterior.'
                : '⏳ One moment... still processing your previous message.');
            return;
        }

        // Daily cap — trial: 25 mensajes/día
        if (isDailyLimitReached()) {
            debugLog('[LEX-AI] Daily limit reached:', getDailyCount());
            const isEs = (window.i18n?.currentLang || 'en') === 'es';
            if (replyFn) replyFn(isEs
                ? `⚡ Alcanzaste el límite de ${getDailyLimit()} mensajes diarios de Lex. Vuelve mañana o mejora a Premium (150 al día).\n\n<a href="plans.html" style="display:inline-block;margin-top:6px;padding:6px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:6px;font-weight:600;text-decoration:none;font-size:12px;">👑 Ver Premium →</a>`
                : `⚡ You've reached your ${getDailyLimit()} daily Lex messages. Come back tomorrow or upgrade to Premium (150 a day).\n\n<a href="plans.html" style="display:inline-block;margin-top:6px;padding:6px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:6px;font-weight:600;text-decoration:none;font-size:12px;">👑 Upgrade to Premium →</a>`
            );
            return;
        }
        incrementDailyCount();

        // Estado visual: pensando + typing indicator
        if (typeof window.setLexState === 'function') {
            const thinkingMsg = window.i18n?.currentLang === 'es'
                ? '🤖 Analizando con AI...'
                : '🤖 Analyzing with AI...';
            window.setLexState('thinking', {
                message: thinkingMsg,
                duration: 8000
            });
        }
        showTypingIndicator();

        // Deshabilitar input mientras responde
        const inputEl = document.getElementById('lexChatInput');
        const btnEl = document.querySelector('#lexChatForm button[type="submit"]');
        if (inputEl) inputEl.disabled = true;
        if (btnEl) btnEl.disabled = true;

        try {
            // Llamada a DeepSeek via OpenRouter
            const aiResponse = await callOpenRouter(text, conversationHistory);

            // Remover typing indicator
            removeTypingIndicator();

            // Re-habilitar input
            if (inputEl) inputEl.disabled = false;
            if (btnEl) btnEl.disabled = false;
            if (inputEl) inputEl.focus();

            // Guardar en historial para contexto de conversación
            addToHistory('user', text);
            addToHistory('assistant', aiResponse);

            // Mostrar respuesta en el chat
            if (replyFn) {
                replyFn(aiResponse);
            }

            // Estado visual según contenido de la respuesta
            if (typeof window.setLexState === 'function') {
                const lower = aiResponse.toLowerCase();
                const state = lower.includes('acepta') || lower.includes('✅') ? 'happy'
                    : lower.includes('rechaza') || lower.includes('❌') || lower.includes('trampa') ? 'sad'
                        : lower.includes('negocia') || lower.includes('⚠️') ? 'warning'
                            : 'idle';
                window.setLexState(state, { duration: 4000 });
            }

        } catch (err) {
            debugLog('[LEX-AI] Error:', err.message);

            // Limpiar UI en caso de error
            removeTypingIndicator();
            if (inputEl) inputEl.disabled = false;
            if (btnEl) btnEl.disabled = false;

            // Limite diario de mensajes alcanzado (servidor): avisar, sin fallback
            if (err && err.code === 'functions/resource-exhausted') {
                const lim = err.details?.limit;
                const isEsLim = (window.i18n?.currentLang || 'en') === 'es';
                if (replyFn) replyFn(isEsLim
                    ? `Llegaste al límite de mensajes de Lex por hoy${lim ? ` (${lim})` : ''}. Vuelve mañana y seguimos. 🙌${err.details?.tier === 'pro' ? '\n\nCon Premium tienes 150 mensajes al día. <a href="plans.html">Ver planes →</a>' : ''}`
                    : `You've reached today's Lex message limit${lim ? ` (${lim})` : ''}. Come back tomorrow and we'll keep going. 🙌${err.details?.tier === 'pro' ? '\n\nPremium gives you 150 messages a day. <a href="plans.html">See plans →</a>' : ''}`);
                return;
            }

            // Si falla la AI, caer al handler original silenciosamente
            if (typeof originalHandler === 'function') {
                debugLog('[LEX-AI] Fallback al sistema anterior por error:', err.message);
                return originalHandler(messageText);
            }

            if (replyFn) {
                const errMsg = (window.i18n?.currentLang || 'en') === 'es'
                    ? 'Tuve un problema al conectarme. Intenta de nuevo en un momento. 🛠️'
                    : 'I had a connection problem. Please try again in a moment. 🛠️';
                replyFn(errMsg);
            }

            if (typeof window.setLexState === 'function') {
                window.setLexState('sad', { duration: 3000 });
            }
        }
    };

    // ============================================================
    //  EXPONER CONFIGURACIÓN PARA ADMIN (opcional)
    // ============================================================
    window.lexAIEngine = {
        isConfigured: isConfigured,
        clearHistory: function () {
            conversationHistory.length = 0;
            sessionStorage.removeItem(HISTORY_KEY);
            debugLog('[LEX-AI] Historial limpiado (memoria + sessionStorage)');
        },
        getHistory: function () {
            return [...conversationHistory];
        },
        // Modelos disponibles para cambiar fácilmente
        models: {
            deepseek: 'deepseek/deepseek-chat',      // $0.14/$0.28 - RECOMENDADO
            geminiFlash: 'google/gemini-2.0-flash-lite', // $0.10/$0.40 - más barato
            llama: 'meta-llama/llama-3.3-70b-instruct:free', // GRATIS
            free: 'openrouter/free'               // GRATIS auto-selección
        }
    };

    // ============================================================
    //  FASE 4: BRIEFING SEMANAL PROACTIVO
    // ============================================================
    function isFirstOpenThisWeek() {
        const key = 'lex_briefing_week';
        const now = new Date();
        // Semana ISO 8601: lunes como inicio, basada en el jueves de la semana
        const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
        const weekKey = `${tmp.getUTCFullYear()}-W${weekNum}`;
        const stored = localStorage.getItem(key);
        if (stored === weekKey) return false;
        localStorage.setItem(key, weekKey);
        return true;
    }

    window.lexRunWeeklyBriefing = async function () {
        if (!isConfigured()) return;

        const hasLexAccess = typeof window.canAccessFeature === 'function'
            ? window.canAccessFeature(window.userPlan, 'Lex') : false;
        if (!hasLexAccess) return;

        if (!isFirstOpenThisWeek()) {
            debugLog('[LEX-AI] Briefing semanal ya mostrado esta semana.');
            return;
        }

        const replyFn = typeof window.appendLexMessageFromRouter === 'function'
            ? window.appendLexMessageFromRouter : null;
        if (!replyFn) return;

        debugLog('[LEX-AI] Generando briefing semanal...');

        const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
        const briefingInstruction = isEs
            ? 'Eres Lex, coach de negocios para este conductor expediter. Analiza los datos financieros de los dos últimos meses. Responde en máximo 4 líneas: (1) comparación mes actual vs anterior en ingresos y RPM, (2) el estado donde más conviene enfocarse esta semana, (3) un consejo concreto. Sé directo y usa números reales. Empieza con 📊 Briefing semanal:'
            : 'You are Lex, business coach for this expediter. Analyze the last two months of financial data. Respond in max 4 lines: (1) current vs previous month comparison on revenue and RPM, (2) the state to focus on this week, (3) one concrete action tip. Be direct and use real numbers. Start with 📊 Weekly briefing:';

        try {
            // Reutiliza callOpenRouter — mismos headers, fallback y log de tokens
            const briefing = await callOpenRouter(briefingInstruction, []);
            if (briefing) {
                replyFn(briefing);
                debugLog('[LEX-AI] Briefing semanal mostrado.');
            }
        } catch (e) {
            debugLog('[LEX-AI] Error en briefing semanal:', e.message);
        }
    };

    // ============================================================
    //  AUTO-ANÁLISIS PARA PESTAÑA ANÁLISIS
    //  Llama a DeepSeek directamente sin pasar por el chat UI
    //  Usado por renderAIAnalysis() en lex.js
    // ============================================================
    let _tabAnalysisTs = 0;

    window.lexAnalyzeForTab = async function (query) {
        if (!isConfigured()) return null;

        const hasAccess = typeof window.canAccessFeature === 'function'
            ? window.canAccessFeature(window.userPlan, 'Lex') : false;
        if (!hasAccess) return null;

        // Cooldown de 5s — evita doble llamada si el modal se abre/cierra rápido
        const now = Date.now();
        if (now - _tabAnalysisTs < 5000) return null;
        _tabAnalysisTs = now;

        try {
            const text = query || (
                (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es'
                    ? 'Analiza la carga actual'
                    : 'Analyze the current load'
            );
            return await callOpenRouter(text, []);
        } catch (e) {
            debugLog('[LEX-AI] lexAnalyzeForTab error:', e.message);
            return null;
        }
    };

    debugLog('[LEX-AI] Motor de AI cargado. Configurado:', isConfigured());

})();
