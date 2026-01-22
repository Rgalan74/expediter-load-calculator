// ==========================================================
//  RESPONSE BUILDERS - Reusable response generators
//  Now with SENTIMENT ADAPTATION
// ==========================================================

window.ResponseBuilders = {

    /**
     * Build pricing analysis snippet
     * Adapts format based on sentiment (URGENT/FRUSTRATED/NEUTRAL)
     */
    buildPricingSnippet(profile, state, rpm, options = {}) {
        if (!profile || !rpm) {
            return null;
        }

        const { isSecondary, sentiment } = options;
        const avgRPM = profile.avgRPM || 0.95;
        const minRPM = profile.minRPM || 0.85;
        const diff = ((rpm - avgRPM) / avgRPM) * 100;

        let verdict = '';
        let emoji = '';

        if (rpm >= avgRPM * 1.15) {
            verdict = 'EXCELENTE';
            emoji = '🟢';
        } else if (rpm >= avgRPM * 1.05) {
            verdict = 'BUENO';
            emoji = '🟢';
        } else if (rpm >= avgRPM * 0.95) {
            verdict = 'ACEPTABLE';
            emoji = '🟡';
        } else if (rpm >= minRPM) {
            verdict = 'BAJO';
            emoji = '🟠';
        } else {
            verdict = 'MUY BAJO';
            emoji = '🔴';
        }

        // URGENT: Ultra-concise format - just the verdict
        if (sentiment?.type === 'URGENT' && sentiment.intensity > 0.5) {
            return {
                type: 'PRICING',
                title: '⚡ Decisión Rápida',
                content: `${emoji} **${verdict}** - $${rpm.toFixed(2)}/mi${state ? ` (${state})` : ''} = ${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`,
                priority: 0, // Highest priority for urgent
                verdict
            };
        }

        // FRUSTRATED: More explanatory with reasoning
        if (sentiment?.type === 'FRUSTRATED') {
            const reason = this.getVerdictReason(verdict, diff, avgRPM);
            return {
                type: 'PRICING',
                title: '💰 Te explico',
                content: `${emoji} Este RPM de **$${rpm.toFixed(2)}/mi** es **${verdict}** porque:\n\n` +
                    `• Tu promedio histórico: $${avgRPM.toFixed(2)}/mi\n` +
                    `• Esta carga está **${diff > 0 ? '+' : ''}${diff.toFixed(0)}%** ${diff > 0 ? 'arriba ⬆️' : 'abajo ⬇️'}\n` +
                    `• ${reason}`,
                priority: isSecondary ? 2 : 1,
                verdict
            };
        }

        // Normal/Secondary format
        const content = isSecondary
            ? `$${rpm.toFixed(2)}/mi${state ? ` para ${state}` : ''}: ${verdict} (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs tu promedio)`
            : `**RPM**: $${rpm.toFixed(2)}/mi${state ? ` para ${state}` : ''}\n**Evaluación**: ${emoji} ${verdict}\n**Comparación**: ${diff > 0 ? '+' : ''}${diff.toFixed(0)}% respecto a tu promedio de $${avgRPM.toFixed(2)}/mi`;

        return {
            type: 'PRICING',
            title: '💰 Análisis de RPM',
            content: content,
            priority: isSecondary ? 2 : 1,
            verdict: verdict
        };
    },

    /**
     * Get explanation for verdict (for FRUSTRATED mode)
     */
    getVerdictReason(verdict, diff, avgRPM) {
        if (verdict === 'EXCELENTE') return 'Está muy por encima de tu promedio, excelente oportunidad 🎯';
        if (verdict === 'BUENO') return 'Está bien arriba de tu promedio, es buena opción ✓';
        if (verdict === 'ACEPTABLE') return 'Está cerca de tu promedio, dentro de rango aceptable ≈';
        if (verdict === 'BAJO') return 'Está por debajo de tu promedio, piénsalo bien ⚠️';
        return 'Está muy bajo, probablemente no te conviene ✗';
    },

    /**
     * Build negotiation advice snippet
     */
    buildNegotiationSnippet(profile, state, rpm, options = {}) {
        if (!profile || !rpm) {
            return null;
        }

        const { sentiment } = options;
        const avgRPM = profile.avgRPM || 0.95;
        const minRPM = profile.minRPM || 0.85;

        let counterOffer = avgRPM;
        let advice = '';

        if (rpm < minRPM) {
            counterOffer = Math.max(avgRPM, minRPM * 1.1);
            advice = `Pide al menos **$${counterOffer.toFixed(2)}/mi** para mantener rentabilidad`;
        } else if (rpm < avgRPM) {
            counterOffer = avgRPM;
            advice = `Pide al menos **$${counterOffer.toFixed(2)}/mi** (tu promedio)`;
        } else {
            advice = `El RPM está bien, pero podrías pedir un poco más si ves interés`;
        }

        // URGENT: Just the number
        if (sentiment?.type === 'URGENT' && sentiment.intensity > 0.5) {
            return {
                type: 'NEGOTIATION',
                title: '💬 Pide',
                content: `$${counterOffer.toFixed(2)}/mi mínimo`,
                priority: options.isSecondary ? 3 : 2
            };
        }

        return {
            type: 'NEGOTIATION',
            title: '💬 Sugerencia de Negociación',
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

        const stateStats = profile.stateStats?.[state];

        if (!stateStats || stateStats.loads < 2) {
            return null; // Need at least 2 loads for comparison
        }

        const content = `**Historial en ${state}**:\n` +
            `Cargas: ${stateStats.loads} | ` +
            `RPM promedio: $${stateStats.avgRPM?.toFixed(2) || 'N/A'}/mi | ` +
            `Deadhead: ${stateStats.avgDeadhead?.toFixed(0) || 'N/A'} mi`;

        return {
            type: 'HISTORY',
            title: '📊 Comparación Histórica',
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

        const { sentiment } = options;
        const avgRPM = profile.avgRPM || 0.95;
        const minRPM = profile.minRPM || 0.85;

        let decision = '';
        let emoji = '';

        if (rpm >= avgRPM * 1.1) {
            decision = 'ACEPTA';
            emoji = '✅';
        } else if (rpm >= avgRPM) {
            decision = 'ACEPTA';
            emoji = '👍';
        } else if (rpm >= minRPM) {
            decision = 'EVALÚA';
            emoji = '🤔';
        } else {
            decision = 'RECHAZA';
            emoji = '❌';
        }

        // UNCERTAIN: Provide step-by-step decision framework
        if (sentiment?.type === 'UNCERTAIN' && sentiment.intensity > 0.5) {
            const trapZones = ['CA', 'NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM', 'TX', 'FL', 'ME', 'VT', 'NH', 'NY'];
            const isTrap = state && trapZones.includes(state);
            const diff = ((rpm - avgRPM) / avgRPM) * 100;

            let finalDecision = decision;
            if (isTrap && rpm < avgRPM * 1.25) {
                finalDecision = 'EVALÚA CON CUIDADO';
            }

            return {
                type: 'DECISION_FRAMEWORK',
                title: '🎯 Framework de Decisión',
                content:
                    `**Paso 1**: ¿El RPM es bueno?\n` +
                    `→ $${rpm.toFixed(2)}/mi vs tu promedio $${avgRPM.toFixed(2)}/mi = ${diff > 0 ? '+' : ''}${diff.toFixed(0)}%\n` +
                    `→ ${rpm >= avgRPM ? '✅ Sí, está bien' : '⚠️ No, está bajo'}\n\n` +
                    `**Paso 2**: ¿La zona es trap?\n` +
                    `→ ${state}: ${isTrap ? '⚠️ Sí, difícil salir' : '✅ No, zona normal'}\n\n` +
                    `**Paso 3**: Decisión final\n` +
                    `→ ${emoji} **${finalDecision}**${decision === 'EVALÚA' ? '\n   Considera deadhead, urgencia y plan de salida' : ''}`,
                priority: 0
            };
        }

        // URGENT: Just the verdict
        if (sentiment?.type === 'URGENT' && sentiment.intensity > 0.5) {
            return {
                type: 'DECISION_HELP',
                title: '🎯 Decisión',
                content: `${emoji} **${decision}**`,
                priority: 0
            };
        }

        // Normal
        return {
            type: 'DECISION_HELP',
            title: '🎯 Recomendación',
            content: `${emoji} **${decision}**${decision === 'EVALÚA' ? ' - Considera deadhead, zona y urgencia' : ''}`,
            priority: 1
        };
    },

    /**
   * Build state/zone warning snippet
   * Enhanced with FRUSTRATED educational explanations
   */
    buildStateWarningSnippet(state, options = {}) {
        const trapZones = [
            // Zona Oeste completa
            'CA', 'NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM',
            // Texas
            'TX',
            // Florida
            'FL',
            // Noreste cerca de Canadá
            'ME', 'VT', 'NH', 'NY'
        ];

        if (!trapZones.includes(state)) {
            return null;
        }

        const { sentiment } = options;

        // FRUSTRATED: Provide detailed educational explanation
        if (sentiment?.type === 'FRUSTRATED' && sentiment.intensity > 0.5) {
            let explanation = '';

            if (state === 'CA') {
                explanation =
                    `**Razón Principal**: California tiene mucho freight ENTRANTE (productos desde Asia, agricultura hacia este) pero poco freight SALIENTE.\n\n` +
                    `**Esto significa**:\n` +
                    `• Entras con buen RPM ✅\n` +
                    `• Sales vacío o a precio muy bajo ❌\n\n` +
                    `**Cómo manejarlo**:\n` +
                    `1. Solo acepta si el RPM es excepcional (+25%)\n` +
                    `2. O si ya tienes carga confirmada desde CA\n` +
                    `3. O si vives ahí y regresas a casa\n\n` +
                    `¿Tiene más sentido ahora? 😊`;
            } else if (['NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM'].includes(state)) {
                explanation =
                    `**Razón Principal**: Los estados del oeste tienen mercados pequeños y están lejos de los centros industriales del este.\n\n` +
                    `**Esto significa**:\n` +
                    `• Hay pocas cargas de regreso disponibles ❌\n` +
                    `• Tienes que deadhead mucho o aceptar RPM muy bajo 📉\n\n` +
                    `**Cómo manejarlo**:\n` +
                    `1. Acepta solo con RPM excepcional (+25%)\n` +
                    `2. Planea múltiples cargas en la zona antes de entrar\n` +
                    `3. O ten confirmada tu salida`;
            } else if (state === 'TX') {
                explanation =
                    `**Razón Principal**: Texas tiene mucho freight local pero es difícil conseguir cargas hacia fuera del estado.\n\n` +
                    `**Esto significa**:\n` +
                    `• Entras con buen rate ✅\n` +
                    `• Sales con rate muy bajo o vacío ❌\n\n` +
                    `**Cómo manejarlo**:\n` +
                    `1. Acepta solo si el RPM entrando es excepcional\n` +
                    `2. O si tienes broker que te saca de TX\n` +
                    `3. Considera el costo completo del round trip`;
            } else if (state === 'FL') {
                explanation =
                    `**Razón Principal**: Florida es una península sin salidas terrestres fáciles.\n\n` +
                    `**Esto significa**:\n` +
                    `• Tienes que salir por el mismo camino que entraste 🔄\n` +
                    `• Pocas opciones de carga de regreso ❌\n\n` +
                    `**Cómo manejarlo**:\n` +
                    `1. Solo acepta rates muy altos\n` +
                    `2. O si ya tienes carga de regreso confirmada\n` +
                    `3. El deadhead de regreso es casi garantizado`;
            }

            return {
                type: 'STATE_WARNING',
                title: `💰 Te explico por qué ${state} es trap`,
                content: explanation,
                priority: 1
            };
        }

        // Normal trap warning
        let warningText = `**${state}** es una zona TRAP`;

        // Specific warnings by region
        if (state === 'TX') {
            warningText += ' - entras a precio alto pero sales vacío o muy bajo';
        } else if (['CA', 'NV', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM'].includes(state)) {
            warningText += ' - zona oeste, difícil conseguir cargas de regreso';
        } else if (state === 'FL') {
            warningText += ' - pocas salidas, requiere deadhead alto';
        } else if (['ME', 'VT', 'NH', 'NY'].includes(state)) {
            warningText += ' - zona frontera norte, mercado limitado';
        }

        warningText += '.\nAcepta solo si el RPM es excepcional (+25% de tu promedio).';

        return {
            type: 'STATE_WARNING',
            title: '⚠️ Zona TRAP',
            content: warningText,
            priority: 1
        };
    }
};

console.log('📦 ResponseBuilders loaded');
