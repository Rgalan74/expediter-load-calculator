// ==========================================================
//  RESPONSE BUILDERS - Reusable response generators
//  Now with SENTIMENT ADAPTATION
// ==========================================================

window.ResponseBuilders = {

    _isEs() {
        return (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    },

    /**
     * Build pricing analysis snippet
     * Adapts format based on sentiment (URGENT/FRUSTRATED/NEUTRAL)
     */
    buildPricingSnippet(profile, state, rpm, options = {}) {
        if (!profile || !rpm) {
            return null;
        }

        const isEs = this._isEs();
        const { isSecondary, sentiment } = options;
        const avgRPM = profile.avgRPM || 0.95;
        const minRPM = profile.minRPM || 0.85;
        const diff = ((rpm - avgRPM) / avgRPM) * 100;

        let verdict = '';
        let verdictEs = '';
        let emoji = '';

        if (rpm >= avgRPM * 1.15) {
            verdict = 'EXCELLENT'; verdictEs = 'EXCELENTE'; emoji = '🟢';
        } else if (rpm >= avgRPM * 1.05) {
            verdict = 'GOOD'; verdictEs = 'BUENO'; emoji = '🟢';
        } else if (rpm >= avgRPM * 0.95) {
            verdict = 'ACCEPTABLE'; verdictEs = 'ACEPTABLE'; emoji = '🟡';
        } else if (rpm >= minRPM) {
            verdict = 'LOW'; verdictEs = 'BAJO'; emoji = '🟠';
        } else {
            verdict = 'VERY LOW'; verdictEs = 'MUY BAJO'; emoji = '🔴';
        }

        const displayVerdict = isEs ? verdictEs : verdict;

        // URGENT: Ultra-concise format - just the verdict
        if (sentiment?.type === 'URGENT' && sentiment.intensity > 0.5) {
            return {
                type: 'PRICING',
                title: isEs ? '⚡ Decisión Rápida' : '⚡ Quick Decision',
                content: `${emoji} **${displayVerdict}** - $${rpm.toFixed(2)}/mi${state ? ` (${state})` : ''} = ${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`,
                priority: 0,
                verdict
            };
        }

        // FRUSTRATED: More explanatory with reasoning
        if (sentiment?.type === 'FRUSTRATED') {
            const reason = this.getVerdictReason(verdict, diff, avgRPM, isEs);
            return {
                type: 'PRICING',
                title: isEs ? '💰 Te explico' : '💰 Let me explain',
                content: isEs
                    ? `${emoji} Este RPM de **$${rpm.toFixed(2)}/mi** es **${displayVerdict}** porque:\n\n` +
                      `• Tu promedio histórico: $${avgRPM.toFixed(2)}/mi\n` +
                      `• Esta carga está **${diff > 0 ? '+' : ''}${diff.toFixed(0)}%** ${diff > 0 ? 'arriba ⬆️' : 'abajo ⬇️'}\n` +
                      `• ${reason}`
                    : `${emoji} This RPM of **$${rpm.toFixed(2)}/mi** is **${displayVerdict}** because:\n\n` +
                      `• Your historical average: $${avgRPM.toFixed(2)}/mi\n` +
                      `• This load is **${diff > 0 ? '+' : ''}${diff.toFixed(0)}%** ${diff > 0 ? 'above ⬆️' : 'below ⬇️'}\n` +
                      `• ${reason}`,
                priority: isSecondary ? 2 : 1,
                verdict
            };
        }

        // Normal/Secondary format
        const content = isSecondary
            ? (isEs
                ? `$${rpm.toFixed(2)}/mi${state ? ` para ${state}` : ''}: ${displayVerdict} (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs tu promedio)`
                : `$${rpm.toFixed(2)}/mi${state ? ` for ${state}` : ''}: ${displayVerdict} (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs your avg)`)
            : (isEs
                ? `**RPM**: $${rpm.toFixed(2)}/mi${state ? ` para ${state}` : ''}\n**Evaluación**: ${emoji} ${displayVerdict}\n**Comparación**: ${diff > 0 ? '+' : ''}${diff.toFixed(0)}% respecto a tu promedio de $${avgRPM.toFixed(2)}/mi`
                : `**RPM**: $${rpm.toFixed(2)}/mi${state ? ` for ${state}` : ''}\n**Rating**: ${emoji} ${displayVerdict}\n**Comparison**: ${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs your average of $${avgRPM.toFixed(2)}/mi`);

        return {
            type: 'PRICING',
            title: isEs ? '💰 Análisis de RPM' : '💰 RPM Analysis',
            content: content,
            priority: isSecondary ? 2 : 1,
            verdict: verdict
        };
    },

    /**
     * Get explanation for verdict (for FRUSTRATED mode)
     */
    getVerdictReason(verdict, diff, avgRPM, isEs) {
        if (isEs) {
            if (verdict === 'EXCELLENT') return 'Está muy por encima de tu promedio, excelente oportunidad 🎯';
            if (verdict === 'GOOD') return 'Está bien arriba de tu promedio, es buena opción ✓';
            if (verdict === 'ACCEPTABLE') return 'Está cerca de tu promedio, dentro de rango aceptable ≈';
            if (verdict === 'LOW') return 'Está por debajo de tu promedio, piénsalo bien ⚠️';
            return 'Está muy bajo, probablemente no te conviene ✗';
        } else {
            if (verdict === 'EXCELLENT') return 'Well above your average — excellent opportunity 🎯';
            if (verdict === 'GOOD') return 'Above your average — solid option ✓';
            if (verdict === 'ACCEPTABLE') return 'Near your average — within acceptable range ≈';
            if (verdict === 'LOW') return 'Below your average — think it over ⚠️';
            return 'Very low — probably not worth it ✗';
        }
    },

    /**
     * Build negotiation advice snippet
     */
    buildNegotiationSnippet(profile, state, rpm, options = {}) {
        if (!profile || !rpm) {
            return null;
        }

        const isEs = this._isEs();
        const { sentiment } = options;
        const avgRPM = profile.avgRPM || 0.95;
        const minRPM = profile.minRPM || 0.85;

        let counterOffer = avgRPM;
        let advice = '';

        if (rpm < minRPM) {
            counterOffer = Math.max(avgRPM, minRPM * 1.1);
            advice = isEs
                ? `Pide al menos **$${counterOffer.toFixed(2)}/mi** para mantener rentabilidad`
                : `Ask for at least **$${counterOffer.toFixed(2)}/mi** to stay profitable`;
        } else if (rpm < avgRPM) {
            counterOffer = avgRPM;
            advice = isEs
                ? `Pide al menos **$${counterOffer.toFixed(2)}/mi** (tu promedio)`
                : `Ask for at least **$${counterOffer.toFixed(2)}/mi** (your average)`;
        } else {
            advice = isEs
                ? `El RPM está bien, pero podrías pedir un poco más si ves interés`
                : `The RPM is solid, but you could push a bit more if there's interest`;
        }

        // URGENT: Just the number
        if (sentiment?.type === 'URGENT' && sentiment.intensity > 0.5) {
            return {
                type: 'NEGOTIATION',
                title: isEs ? '💬 Pide' : '💬 Ask for',
                content: `$${counterOffer.toFixed(2)}/mi ${isEs ? 'mínimo' : 'minimum'}`,
                priority: options.isSecondary ? 3 : 2
            };
        }

        return {
            type: 'NEGOTIATION',
            title: isEs ? '💬 Sugerencia de Negociación' : '💬 Negotiation Suggestion',
            content: advice,
            priority: options.isSecondary ? 3 : 2
        };
    },

    /**
     * Build history comparison snippet
     */
    buildHistorySnippet(profile, state, rpm, options = {}) {
        if (!profile || !state) {
            return null;
        }

        const isEs = this._isEs();
        const stateStats = profile.stateStats?.[state];

        if (!stateStats || stateStats.loads < 2) {
            return null;
        }

        const content = isEs
            ? `**Historial en ${state}**:\nCargas: ${stateStats.loads} | RPM promedio: $${stateStats.avgRPM?.toFixed(2) || 'N/A'}/mi | Deadhead: ${stateStats.avgDeadhead?.toFixed(0) || 'N/A'} mi`
            : `**History for ${state}**:\nLoads: ${stateStats.loads} | Avg RPM: $${stateStats.avgRPM?.toFixed(2) || 'N/A'}/mi | Deadhead: ${stateStats.avgDeadhead?.toFixed(0) || 'N/A'} mi`;

        return {
            type: 'HISTORY',
            title: isEs ? '📊 Comparación Histórica' : '📊 Historical Comparison',
            content: content,
            priority: options.isSecondary ? 3 : 2
        };
    },

    /**
     * Build quick decision help snippet
     * Adapts for URGENT (just verdict) and UNCERTAIN (step-by-step)
     */
    buildDecisionSnippet(profile, state, rpm, options = {}) {
        if (!profile || !rpm) {
            return null;
        }

        const isEs = this._isEs();
        const { sentiment } = options;
        const avgRPM = profile.avgRPM || 0.95;
        const minRPM = profile.minRPM || 0.85;

        let decisionEs = '';
        let decisionEn = '';
        let emoji = '';

        if (rpm >= avgRPM * 1.1) {
            decisionEs = 'ACEPTA'; decisionEn = 'ACCEPT'; emoji = '✅';
        } else if (rpm >= avgRPM) {
            decisionEs = 'ACEPTA'; decisionEn = 'ACCEPT'; emoji = '👍';
        } else if (rpm >= minRPM) {
            decisionEs = 'EVALÚA'; decisionEn = 'EVALUATE'; emoji = '🤔';
        } else {
            decisionEs = 'RECHAZA'; decisionEn = 'REJECT'; emoji = '❌';
        }

        const decision = isEs ? decisionEs : decisionEn;

        // UNCERTAIN: Provide step-by-step decision framework
        if (sentiment?.type === 'UNCERTAIN' && sentiment.intensity > 0.5) {
            const trapZones = ['CA', 'NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM', 'TX', 'FL', 'ME', 'VT', 'NH', 'NY'];
            const isTrap = state && trapZones.includes(state);
            const diff = ((rpm - avgRPM) / avgRPM) * 100;

            let finalDecision = decision;
            if (isTrap && rpm < avgRPM * 1.25) {
                finalDecision = isEs ? 'EVALÚA CON CUIDADO' : 'EVALUATE CAREFULLY';
            }

            return {
                type: 'DECISION_FRAMEWORK',
                title: isEs ? '🎯 Framework de Decisión' : '🎯 Decision Framework',
                content: isEs
                    ? `**Paso 1**: ¿El RPM es bueno?\n` +
                      `→ $${rpm.toFixed(2)}/mi vs tu promedio $${avgRPM.toFixed(2)}/mi = ${diff > 0 ? '+' : ''}${diff.toFixed(0)}%\n` +
                      `→ ${rpm >= avgRPM ? '✅ Sí, está bien' : '⚠️ No, está bajo'}\n\n` +
                      `**Paso 2**: ¿La zona es trap?\n` +
                      `→ ${state}: ${isTrap ? '⚠️ Sí, difícil salir' : '✅ No, zona normal'}\n\n` +
                      `**Paso 3**: Decisión final\n` +
                      `→ ${emoji} **${finalDecision}**${decisionEs === 'EVALÚA' ? '\n   Considera deadhead, urgencia y plan de salida' : ''}`
                    : `**Step 1**: Is the RPM good?\n` +
                      `→ $${rpm.toFixed(2)}/mi vs your average $${avgRPM.toFixed(2)}/mi = ${diff > 0 ? '+' : ''}${diff.toFixed(0)}%\n` +
                      `→ ${rpm >= avgRPM ? '✅ Yes, looks good' : '⚠️ No, it\'s low'}\n\n` +
                      `**Step 2**: Is this a trap zone?\n` +
                      `→ ${state}: ${isTrap ? '⚠️ Yes, hard to get out' : '✅ No, normal zone'}\n\n` +
                      `**Step 3**: Final decision\n` +
                      `→ ${emoji} **${finalDecision}**${decisionEn === 'EVALUATE' ? '\n   Consider deadhead, urgency, and exit plan' : ''}`,
                priority: 0
            };
        }

        // URGENT: Just the verdict
        if (sentiment?.type === 'URGENT' && sentiment.intensity > 0.5) {
            return {
                type: 'DECISION_HELP',
                title: isEs ? '🎯 Decisión' : '🎯 Decision',
                content: `${emoji} **${decision}**`,
                priority: 0
            };
        }

        // Normal
        return {
            type: 'DECISION_HELP',
            title: isEs ? '🎯 Recomendación' : '🎯 Recommendation',
            content: `${emoji} **${decision}**${decisionEn === 'EVALUATE' ? (isEs ? ' - Considera deadhead, zona y urgencia' : ' - Consider deadhead, zone and urgency') : ''}`,
            priority: 1
        };
    },

    /**
   * Build state/zone warning snippet
   * Enhanced with FRUSTRATED educational explanations
   */
    buildStateWarningSnippet(state, options = {}) {
        const trapZones = [
            'CA', 'NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM',
            'TX', 'FL', 'ME', 'VT', 'NH', 'NY'
        ];

        if (!trapZones.includes(state)) {
            return null;
        }

        const isEs = this._isEs();
        const { sentiment } = options;

        // FRUSTRATED: Provide detailed educational explanation
        if (sentiment?.type === 'FRUSTRATED' && sentiment.intensity > 0.5) {
            let explanation = '';

            if (state === 'CA') {
                explanation = isEs
                    ? `**Razón Principal**: California tiene mucho freight ENTRANTE (productos desde Asia, agricultura hacia este) pero poco freight SALIENTE.\n\n` +
                      `**Esto significa**:\n• Entras con buen RPM ✅\n• Sales vacío o a precio muy bajo ❌\n\n` +
                      `**Cómo manejarlo**:\n1. Solo acepta si el RPM es excepcional (+25%)\n2. O si ya tienes carga confirmada desde CA\n3. O si vives ahí y regresas a casa\n\n¿Tiene más sentido ahora? 😊`
                    : `**Main Reason**: California has a lot of INBOUND freight (products from Asia, agriculture heading east) but little OUTBOUND freight.\n\n` +
                      `**What this means**:\n• You enter with good RPM ✅\n• You leave empty or at very low rate ❌\n\n` +
                      `**How to handle it**:\n1. Only accept if the RPM is exceptional (+25%)\n2. Or if you already have a confirmed load out of CA\n3. Or if you live there and are heading home\n\nDoes that make more sense now? 😊`;
            } else if (['NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM'].includes(state)) {
                explanation = isEs
                    ? `**Razón Principal**: Los estados del oeste tienen mercados pequeños y están lejos de los centros industriales del este.\n\n` +
                      `**Esto significa**:\n• Hay pocas cargas de regreso disponibles ❌\n• Tienes que deadhead mucho o aceptar RPM muy bajo 📉\n\n` +
                      `**Cómo manejarlo**:\n1. Acepta solo con RPM excepcional (+25%)\n2. Planea múltiples cargas en la zona antes de entrar\n3. O ten confirmada tu salida`
                    : `**Main Reason**: Western states have small markets and are far from eastern industrial hubs.\n\n` +
                      `**What this means**:\n• Very few return loads available ❌\n• You'll deadhead a lot or accept very low RPM 📉\n\n` +
                      `**How to handle it**:\n1. Only accept with exceptional RPM (+25%)\n2. Plan multiple loads in the area before entering\n3. Or have your exit load confirmed`;
            } else if (state === 'TX') {
                explanation = isEs
                    ? `**Razón Principal**: Texas tiene mucho freight local pero es difícil conseguir cargas hacia fuera del estado.\n\n` +
                      `**Esto significa**:\n• Entras con buen rate ✅\n• Sales con rate muy bajo o vacío ❌\n\n` +
                      `**Cómo manejarlo**:\n1. Acepta solo si el RPM entrando es excepcional\n2. O si tienes broker que te saca de TX\n3. Considera el costo completo del round trip`
                    : `**Main Reason**: Texas has a lot of local freight but it's hard to find loads heading out of the state.\n\n` +
                      `**What this means**:\n• You enter with good rate ✅\n• You leave at very low rate or empty ❌\n\n` +
                      `**How to handle it**:\n1. Only accept if the inbound RPM is exceptional\n2. Or if your broker can get you out of TX\n3. Factor in the full round-trip cost`;
            } else if (state === 'FL') {
                explanation = isEs
                    ? `**Razón Principal**: Florida es una península sin salidas terrestres fáciles.\n\n` +
                      `**Esto significa**:\n• Tienes que salir por el mismo camino que entraste 🔄\n• Pocas opciones de carga de regreso ❌\n\n` +
                      `**Cómo manejarlo**:\n1. Solo acepta rates muy altos\n2. O si ya tienes carga de regreso confirmada\n3. El deadhead de regreso es casi garantizado`
                    : `**Main Reason**: Florida is a peninsula with no easy overland exits.\n\n` +
                      `**What this means**:\n• You have to exit the same way you entered 🔄\n• Very few return load options ❌\n\n` +
                      `**How to handle it**:\n1. Only accept very high rates\n2. Or if you already have a confirmed return load\n3. Deadhead back is almost guaranteed`;
            }

            return {
                type: 'STATE_WARNING',
                title: isEs ? `💰 Te explico por qué ${state} es trap` : `💰 Why ${state} is a trap zone`,
                content: explanation,
                priority: 1
            };
        }

        // Normal trap warning
        let warningText = isEs ? `**${state}** es una zona TRAP` : `**${state}** is a TRAP zone`;

        if (state === 'TX') {
            warningText += isEs
                ? ' - entras a precio alto pero sales vacío o muy bajo'
                : ' - you enter at high rate but leave empty or very low';
        } else if (['CA', 'NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM'].includes(state)) {
            warningText += isEs
                ? ' - zona oeste, difícil conseguir cargas de regreso'
                : ' - western zone, hard to find return loads';
        } else if (state === 'FL') {
            warningText += isEs
                ? ' - pocas salidas, requiere deadhead alto'
                : ' - few exits, high deadhead required';
        } else if (['ME', 'VT', 'NH', 'NY'].includes(state)) {
            warningText += isEs
                ? ' - zona frontera norte, mercado limitado'
                : ' - northern border zone, limited market';
        }

        warningText += isEs
            ? '.\nAcepta solo si el RPM es excepcional (+25% de tu promedio).'
            : '.\nOnly accept if the RPM is exceptional (+25% above your average).';

        return {
            type: 'STATE_WARNING',
            title: isEs ? '⚠️ Zona TRAP' : '⚠️ TRAP Zone',
            content: warningText,
            priority: 1
        };
    }
};

debugLog('📦 ResponseBuilders loaded');
