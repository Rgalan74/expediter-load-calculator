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
//  La API key se carga desde Firestore en config.js — nunca en código fuente
// ============================================================

(function () {

    // Configuración base — la apiKey se inyecta en runtime desde window._lexConfig
    // (cargado desde Firestore/config/lex_ai al hacer login)
    const OPENROUTER_CONFIG = {
        get apiKey() { return window._lexConfig?.apiKey || ''; },
        get model()  { return window._lexConfig?.model  || 'deepseek/deepseek-chat'; },
        fallbackModel: 'openrouter/free',
        maxTokens: 600,
        referer: 'https://smartloadsolution.com',
        appTitle: 'SmartLoad Lex AI'
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
        const savePatterns = [
            /agrega?\s+(?:una\s+)?nota\s+(?:para|de|en|sobre)\s+(.+?)[:,]\s*(.+)/i,
            /guarda?\s+(?:una\s+)?nota\s+(?:para|de|en|sobre)\s+(.+?)[:,]\s*(.+)/i,
            /anota\s+(?:para|en|sobre)\s+(.+?)[:,]\s*(.+)/i,
            /nota\s+(?:para|de|en)\s+(.+?)[:,]\s*(.+)/i,
        ];
        for (const pattern of savePatterns) {
            const match = text.match(pattern);
            if (match) return { lugar: match[1].trim(), nota: match[2].trim() };
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

        const tarifa = parseFloat(document.getElementById('rate')?.value || 0);
        const origen = document.getElementById('origin')?.value || '';
        const destino = document.getElementById('destination')?.value || '';

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
        if (isEsCtx) {
            return `
CARGA ACTIVA EN EL CALCULADOR (el usuario ya tiene esta carga en pantalla):
- Ruta: ${origen} → ${destino}
- Millas: ${d.totalMiles}
- Tarifa: $${tarifa}
- RPM: $${d.actualRPM.toFixed(3)}/mi
- Margen actual: ${margen}%
- Decisión del panel: ${d.decision}
${weatherLine}
Si el usuario pregunta "¿la acepto?", "¿qué opinas?" o "analízala" sin dar datos, se refiere a ESTA carga.`;
        } else {
            return `
ACTIVE LOAD IN CALCULATOR (user has this load on screen):
- Route: ${origen} → ${destino}
- Miles: ${d.totalMiles}
- Rate: $${tarifa}
- RPM: $${d.actualRPM.toFixed(3)}/mi
- Current margin: ${margen}%
- Panel decision: ${d.decision}
${weatherLine}
If the user asks "should I take it?", "what do you think?" or "analyze it" without giving data, they mean THIS load.`;
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
        const acceptThreshold = avgRPM > 0 ? Math.max(targetRPM_margen, avgRPM) : targetRPM_margen;
        const midThreshold = avgRPM > 0 ? Math.min(targetRPM_margen, avgRPM) : targetRPM_margen;

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
                ? `\nDESGLOSE DE COSTOS REALES:\n  - Combustible: $${(c.combustible || 0).toFixed(3)}/mi\n  - Mantenimiento: $${(c.mantenimiento || 0).toFixed(3)}/mi\n  - Costos fijos: $${(c.costosFijos || 0).toFixed(3)}/mi\n  - Comida/varios: $${(c.comida || 0).toFixed(3)}/mi`
                : `\nREAL COST BREAKDOWN:\n  - Fuel: $${(c.combustible || 0).toFixed(3)}/mi\n  - Maintenance: $${(c.mantenimiento || 0).toFixed(3)}/mi\n  - Fixed costs: $${(c.costosFijos || 0).toFixed(3)}/mi\n  - Food/misc: $${(c.comida || 0).toFixed(3)}/mi`;
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
            const rpmDiffActual = avgRPM > 0 ? (((actual.rpm - avgRPM) / avgRPM) * 100).toFixed(1) : null;
            const rpmDiffAnterior = avgRPM > 0 ? (((anterior.rpm - avgRPM) / avgRPM) * 100).toFixed(1) : null;

            if (isEs) {
                financeContext = `
CONTEXTO FINANCIERO:
${currentMonthName.toUpperCase()} (mes actual):
- Cargas: ${actual.loads} | Ingresos: $${actual.revenue.toFixed(2)} | Gastos: $${actual.expenses.toFixed(2)}
- Ganancia neta: $${(actual.revenue - actual.expenses).toFixed(2)} | RPM: $${actual.rpm.toFixed(3)}/mi${rpmDiffActual !== null ? ` (${parseFloat(rpmDiffActual) >= 0 ? '+' : ''}${rpmDiffActual}% vs histórico)` : ''}

${prevMonthName.toUpperCase()} (mes anterior):
- Cargas: ${anterior.loads} | Ingresos: $${anterior.revenue.toFixed(2)} | Gastos: $${anterior.expenses.toFixed(2)}
- Ganancia neta: $${(anterior.revenue - anterior.expenses).toFixed(2)} | RPM: $${anterior.rpm.toFixed(3)}/mi${rpmDiffAnterior !== null ? ` (${parseFloat(rpmDiffAnterior) >= 0 ? '+' : ''}${rpmDiffAnterior}% vs historical)` : ''}`;
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

        const langInstruction = isEs
            ? 'Responde SIEMPRE en español. Sé directo, práctico y usa números concretos.'
            : 'IMPORTANT: Always respond in English. Never switch to Spanish. Be direct, practical, and use concrete numbers.';

        const decisionTerms = isEs
            ? 'ACEPTA / CASI ACEPTA / EVALÚA CON CUIDADO / RECHAZA'
            : 'ACCEPT / ALMOST ACCEPT / EVALUATE CAREFULLY / REJECT';

        if (isEs) {
            return `Eres Lex, asistente de IA experto en expediting (camionería express en USA).
${langInstruction}
Si el usuario hace una pregunta que NO está relacionada con cargas, finanzas o expediting, respóndela directamente de forma amigable y útil — sin mencionar el perfil del conductor ni los umbrales de decisión.
Cuando analices una carga, muestra los cálculos clave (RPM, costo, ganancia).

PERFIL REAL DEL CONDUCTOR:
- CPM real (costo por milla): $${cpm.toFixed(3)}/mi
- RPM promedio histórico: $${avgRPM.toFixed(3)}/mi
- Margen objetivo: ${(targetProfitPct * 100).toFixed(0)}%
- Cargas registradas: ${totalLoads}
${costsText}

UMBRALES DE DECISIÓN DE ESTE CONDUCTOR:
- RECHAZA si RPM < $${cpm.toFixed(3)} (pierde dinero)
- EVALÚA CON CUIDADO si $${cpm.toFixed(3)} ≤ RPM < $${midThreshold.toFixed(3)}
- CASI ACEPTA si $${midThreshold.toFixed(3)} ≤ RPM < $${acceptThreshold.toFixed(3)}
- ACEPTA si RPM ≥ $${acceptThreshold.toFixed(3)}

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
5. Contraoferta sugerida = $${acceptThreshold.toFixed(3)} × millas totales

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

DRIVER REAL PROFILE:
- Real CPM (cost per mile): $${cpm.toFixed(3)}/mi
- Historical average RPM: $${avgRPM.toFixed(3)}/mi
- Target profit margin: ${(targetProfitPct * 100).toFixed(0)}%
- Registered loads: ${totalLoads}
${costsText}

THIS DRIVER'S DECISION THRESHOLDS:
- REJECT if RPM < $${cpm.toFixed(3)} (losing money)
- EVALUATE CAREFULLY if $${cpm.toFixed(3)} ≤ RPM < $${midThreshold.toFixed(3)}
- ALMOST ACCEPT if $${midThreshold.toFixed(3)} ≤ RPM < $${acceptThreshold.toFixed(3)}
- ACCEPT if RPM ≥ $${acceptThreshold.toFixed(3)}

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
5. Suggested counteroffer = $${acceptThreshold.toFixed(3)} × total miles

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

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': OPENROUTER_CONFIG.referer,
                'X-Title': OPENROUTER_CONFIG.appTitle
            },
            body: JSON.stringify({
                model: OPENROUTER_CONFIG.model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: isCasual ? 0.7 : 0.4
            })
        });

        if (!response.ok) {
            // Si falla DeepSeek, intentar con fallback
            if (OPENROUTER_CONFIG.fallbackModel && OPENROUTER_CONFIG.model !== OPENROUTER_CONFIG.fallbackModel) {
                debugLog('[LEX-AI] DeepSeek falló, intentando fallback...');
                return callWithFallback(messages);
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Error de API');
        }

        debugLog('[LEX-AI] Tokens usados:', data.usage?.total_tokens,
            '| Modelo:', data.model);

        return data.choices[0].message.content;
    }

    // Fallback al free router si DeepSeek falla
    async function callWithFallback(messages) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': OPENROUTER_CONFIG.referer,
                'X-Title': OPENROUTER_CONFIG.appTitle
            },
            body: JSON.stringify({
                model: OPENROUTER_CONFIG.fallbackModel,
                messages: messages,
                max_tokens: OPENROUTER_CONFIG.maxTokens
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices[0].message.content;
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
        <img src="img/lex/lex-thinking.png" alt="Lex"
          style="width:100%;height:100%;object-fit:contain;"
          onerror="this.src='img/lex/lex-neutral.png'">
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
        return OPENROUTER_CONFIG.apiKey &&
            OPENROUTER_CONFIG.apiKey !== 'sk-or-v1-PEGA_TU_KEY_AQUI' &&
            OPENROUTER_CONFIG.apiKey.startsWith('sk-or-');
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
        const routePatterns = [
            // "City, ST - City, ST"  o  "City ST → City ST"
            /([A-Za-z][\w\s\-\.]+?,?\s*[A-Z]{2})\s*(?:[-–—→>to|]+)\s*([A-Za-z][\w\s\-\.]+?,?\s*[A-Z]{2})/i,
            // "City ST to City ST" sin coma
            /([A-Za-z][\w\s]+\s+[A-Z]{2})\s+(?:to|→|-{1,2}|–)\s+([A-Za-z][\w\s]+\s+[A-Z]{2})/i,
        ];
        for (const p of routePatterns) {
            const m = t.match(p);
            if (m) {
                origin      = m[1].trim();
                destination = m[2].trim();
                break;
            }
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

        if (data.origin)      setVal('origin', data.origin);
        if (data.destination) setVal('destination', data.destination);
        if (data.miles)       setVal('loadedMiles', data.miles);
        if (data.deadhead)    setVal('deadheadMiles', data.deadhead);
        if (data.rate)        setVal('rate', data.rate);
        if (data.rpm && !data.rate) setVal('rpm', data.rpm);

        // Disparar cálculo automático
        if (typeof window.calculate === 'function') {
            setTimeout(() => window.calculate(), 100);
        }
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

        // Verificar plan del usuario — solo premium y admin tienen Lex AI
        const hasLexAccess = typeof window.canAccessFeature === 'function'
            ? window.canAccessFeature(window.userPlan, 'Lex')
            : false;

        if (!hasLexAccess) {
            const replyFnPlan = typeof window.appendLexMessageFromRouter === 'function'
                ? window.appendLexMessageFromRouter : null;
            if (replyFnPlan) {
                const isEs = (window.i18n?.currentLang || 'en') === 'es';
                replyFnPlan(
                    isEs
                        ? '🔒 Lex AI está disponible en el plan Premium.\n\n' +
                          'Con Lex AI puedes:\n' +
                          '• Analizar cualquier carga con lenguaje natural\n' +
                          '• Detectar cargas trampa automáticamente\n' +
                          '• Negociar con datos reales de tu historial\n\n' +
                          '<a href="/plans.html" style="display:inline-block;margin-top:8px;padding:8px 18px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;font-weight:600;text-decoration:none;font-size:13px;">👑 Ver Plan Premium →</a>'
                        : '🔒 Lex AI is available on the Premium plan.\n\n' +
                          'With Lex AI you can:\n' +
                          '• Analyze any load in natural language\n' +
                          '• Automatically detect trap loads\n' +
                          '• Negotiate using real data from your history\n\n' +
                          '<a href="/plans.html" style="display:inline-block;margin-top:8px;padding:8px 18px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;font-weight:600;text-decoration:none;font-size:13px;">👑 View Premium Plan →</a>'
                );
            }
            if (typeof window.setLexState === 'function') {
                window.setLexState('warning', { duration: 4000 });
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
        setApiKey: function (key) {
            OPENROUTER_CONFIG.apiKey = key;
            debugLog('[LEX-AI] API key actualizado');
        },
        setModel: function (model) {
            OPENROUTER_CONFIG.model = model;
            debugLog('[LEX-AI] Modelo actualizado:', model);
        },
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

    debugLog('[LEX-AI] Motor de AI cargado. Configurado:', isConfigured());

})();
