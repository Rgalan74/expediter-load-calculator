// ============================================================
//  LEX-AI-ENGINE.JS v1.5
//  Motor de AI real para Lex via OpenRouter + DeepSeek V3
//  Reemplaza respuestas pre-escritas con AI conversacional
//  $0.000047 - $0.000200 por mensaje
// ============================================================

(function () {

    // ⚠️  CONFIGURACIÓN — pon tu key de OpenRouter aquí
    //     Ve a openrouter.ai/settings/keys para obtenerla
    const OPENROUTER_CONFIG = {
        apiKey: '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',
        model: 'deepseek/deepseek-chat',       // DeepSeek V3 - mejor calidad/precio
        fallbackModel: 'openrouter/free',       // Si DeepSeek falla, usa el free router
        maxTokens: 450,
        referer: 'https://smartloadsolution.com',
        appTitle: 'SmartLoad Lex AI'
    };

    // ============================================================
    //  CARGAR PERFIL REAL DESDE FIREBASE
    // ============================================================
    async function loadRealProfile() {
        try {
            if (typeof getLexProfile === 'function') {
                return await getLexProfile();
            }
        } catch (e) {
            debugLog('[LEX-AI] Error cargando perfil Firebase:', e.message);
        }
        return null;
    }

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
    function getActiveLoadContext() {
        const d = window._lastDecisionData;
        if (!d || !d.actualRPM || !d.totalMiles) return null;

        const tarifa = parseFloat(document.getElementById('rate')?.value || 0);
        const origen = document.getElementById('origin')?.value || '';
        const destino = document.getElementById('destination')?.value || '';

        if (!tarifa || !origen) return null;

        const margen = d.thresholds?.cpm
            ? (((d.actualRPM - d.thresholds.cpm) / d.actualRPM) * 100).toFixed(1)
            : '?';

        return `
CARGA ACTIVA EN EL CALCULADOR (el usuario ya tiene esta carga en pantalla):
- Ruta: ${origen} → ${destino}
- Millas: ${d.totalMiles}
- Tarifa: $${tarifa}
- RPM: $${d.actualRPM.toFixed(3)}/mi
- Margen actual: ${margen}%
- Decisión del panel: ${d.decision}
Si el usuario pregunta "¿la acepto?", "¿qué opinas?" o "analízala" sin dar datos, se refiere a ESTA carga.`;
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

        const bestStates = stateEntries.slice(0, mitad)
            .map(([st, s]) => `  - ${st}: $${s.avgRPM.toFixed(2)}/mi (${s.loads} cargas)`)
            .join('\n');

        const worstStates = stateEntries.slice(-mitad).reverse()
            .filter(([st]) => !bestKeys.has(st))
            .map(([st, s]) => `  - ${st}: $${s.avgRPM.toFixed(2)}/mi (${s.loads} cargas)`)
            .join('\n');

        // Desglose de costos
        let costsText = '';
        if (p.currentCosts) {
            const c = p.currentCosts;
            costsText = `\nDESGLOSE DE COSTOS REALES:
  - Combustible: $${(c.combustible || 0).toFixed(3)}/mi
  - Mantenimiento: $${(c.mantenimiento || 0).toFixed(3)}/mi
  - Costos fijos: $${(c.costosFijos || 0).toFixed(3)}/mi
  - Comida/varios: $${(c.comida || 0).toFixed(3)}/mi`;
        }

        // Contexto financiero — mes actual y mes anterior
        let financeContext = '';
        try {
            const now = new Date();
            const uid = window.currentUser?.uid;

            const firstDayActual = new Date(now.getFullYear(), now.getMonth(), 1);
            const firstDayAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDayAnterior = new Date(now.getFullYear(), now.getMonth(), 1);
            const mesActualNombre = now.toLocaleString('es', { month: 'long', year: 'numeric' });
            const mesAnteriorNombre = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                .toLocaleString('es', { month: 'long', year: 'numeric' });

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
                let ingresos = 0, millas = 0, gastos = 0;
                loads.forEach(d => { ingresos += d.data().totalCharge || 0; millas += d.data().totalMiles || 0; });
                exps.forEach(d => { gastos += d.data().amount || 0; });
                return { ingresos, millas, gastos, rpm: millas > 0 ? ingresos / millas : 0, cargas: loads.size };
            };

            const actual = calcMes(loadsActual, expActual);
            const anterior = calcMes(loadsAnterior, expAnterior);
            const rpmDiffActual = avgRPM > 0 ? (((actual.rpm - avgRPM) / avgRPM) * 100).toFixed(1) : null;
            const rpmDiffAnterior = avgRPM > 0 ? (((anterior.rpm - avgRPM) / avgRPM) * 100).toFixed(1) : null;

            financeContext = `
CONTEXTO FINANCIERO:
${mesActualNombre.toUpperCase()} (mes actual):
- Cargas: ${actual.cargas} | Ingresos: $${actual.ingresos.toFixed(2)} | Gastos: $${actual.gastos.toFixed(2)}
- Ganancia neta: $${(actual.ingresos - actual.gastos).toFixed(2)} | RPM: $${actual.rpm.toFixed(3)}/mi${rpmDiffActual !== null ? ` (${parseFloat(rpmDiffActual) >= 0 ? '+' : ''}${rpmDiffActual}% vs histórico)` : ''}

${mesAnteriorNombre.toUpperCase()} (mes anterior):
- Cargas: ${anterior.cargas} | Ingresos: $${anterior.ingresos.toFixed(2)} | Gastos: $${anterior.gastos.toFixed(2)}
- Ganancia neta: $${(anterior.ingresos - anterior.gastos).toFixed(2)} | RPM: $${anterior.rpm.toFixed(3)}/mi${rpmDiffAnterior !== null ? ` (${parseFloat(rpmDiffAnterior) >= 0 ? '+' : ''}${rpmDiffAnterior}% vs histórico)` : ''}`;
        } catch (e) {
            debugLog('[LEX-AI] Error cargando contexto financiero:', e);
        }

        return `Eres Lex, asistente de IA experto en expediting (camionería express en USA).
Responde SIEMPRE en español. Sé directo, práctico y usa números concretos.
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

${getActiveLoadContext() || ''}
${financeContext}

FORMATO DE RESPUESTA:
- Máximo 5-6 líneas para preguntas simples
- Usa números concretos en dólares
- Termina con recomendación clara usando exactamente estos términos: ACEPTA / CASI ACEPTA / EVALÚA CON CUIDADO / RECHAZA`;
    }


    // ============================================================
    //  LLAMADA A OPENROUTER API
    // ============================================================
    async function callOpenRouter(userMessage, conversationHistory = []) {
        const systemPrompt = await buildSystemPrompt();

        // Construir mensajes con historial de conversación (máximo últimos 4)
        const recentHistory = conversationHistory.slice(-4);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...recentHistory,
            { role: 'user', content: userMessage }
        ];

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
                max_tokens: OPENROUTER_CONFIG.maxTokens,
                temperature: 0.4  // Más determinístico para análisis financieros
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
    //  HISTORIAL DE CONVERSACIÓN EN MEMORIA (por sesión)
    // ============================================================
    const conversationHistory = [];

    function addToHistory(role, content) {
        conversationHistory.push({ role, content });
        // Mantener solo los últimos 10 mensajes para no crecer el contexto
        if (conversationHistory.length > 10) {
            conversationHistory.splice(0, 2);
        }
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
    //  FUNCIÓN PRINCIPAL — reemplaza handleLexChatMessage
    // ============================================================
    const originalHandler = window.handleLexChatMessage;

    window.handleLexChatMessage = async function (messageText) {
        const text = (messageText || '').trim();
        if (!text) return;

        // Detectar intención de guardar nota
        const saveNoteIntent = detectSaveNote(text);
        if (saveNoteIntent) {
            const { lugar, nota } = saveNoteIntent;
            const replyFnNote = typeof window.appendLexMessageFromRouter === 'function'
                ? window.appendLexMessageFromRouter : null;
            const ok = await saveNoteFromChat(lugar, nota);
            if (replyFnNote) {
                replyFnNote(ok
                    ? `✅ Nota guardada para **${lugar}**:\n"${nota}"\n\nLa tendré en cuenta la próxima vez que analice una carga hacia esa zona.`
                    : `❌ No pude guardar la nota. Intenta de nuevo.`
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
                replyFnPlan(
                    '🔒 Lex AI está disponible en el plan Premium.\n\n' +
                    'Con Lex AI puedes:\n' +
                    '• Analizar cualquier carga con lenguaje natural\n' +
                    '• Detectar cargas trampa automáticamente\n' +
                    '• Negociar con datos reales de tu historial\n\n' +
                    '<a href="/plans.html" style="display:inline-block;margin-top:8px;padding:8px 18px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;font-weight:600;text-decoration:none;font-size:13px;">👑 Ver Plan Premium →</a>'
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

        // Estado visual: pensando + typing indicator
        if (typeof window.setLexState === 'function') {
            window.setLexState('thinking', {
                message: '🤖 Analizando con AI...',
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
                replyFn('Tuve un problema al conectarme. Intenta de nuevo en un momento. 🛠️');
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
            debugLog('[LEX-AI] Historial limpiado');
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

    debugLog('[LEX-AI] Motor de AI cargado. Configurado:', isConfigured());

})();
