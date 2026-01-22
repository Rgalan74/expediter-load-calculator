// ==========================================================
//  PRONOUN RESOLVER - Phase 3: Contextual Understanding
//  Resolves pronouns using conversation memory
// ==========================================================

class PronounResolver {
    /**
     * Resolve pronouns and contextual references in text using memory
     * @param {string} text - User message text
     * @param {ConversationMemory} memory - Conversation memory instance
     * @returns {string} - Resolved text with pronouns replaced
     */
    static resolve(text, memory) {
        if (!memory || !text) return text;

        const context = memory.getContext();
        let resolved = text;

        console.log('[PRONOUN-RESOLVER] Original:', text);
        console.log('[PRONOUN-RESOLVER] Context:', context);

        // Pattern 1: "esta/esa carga" → use last mentioned miles/RPM
        if (/\b(esta|esa)\s+(carga|load)\b/i.test(resolved)) {
            if (context.lastMiles) {
                resolved = resolved.replace(
                    /\b(esta|esa)\s+(carga|load)\b/gi,
                    `carga de ${context.lastMiles} millas`
                );
                console.log('[PRONOUN-RESOLVER] Resolved "carga" to', context.lastMiles, 'miles');
            }
        }

        // Pattern 2: "el/al mismo estado" → use last state
        if (/\b(el|al)\s+mismo\s+estado\b/i.test(resolved) && context.lastState) {
            resolved = resolved.replace(
                /\b(el|al)\s+mismo\s+estado\b/gi,
                context.lastState
            );
            console.log('[PRONOUN-RESOLVER] Resolved "mismo estado" to', context.lastState);
        }

        // Pattern 3: "ese/el estado" → use last state
        if (/\b(ese|el)\s+estado\b/i.test(resolved) && context.lastState) {
            // Avoid replacing "el estado" if it's part of a longer phrase
            if (!/cuál es el estado|cual es el estado/i.test(resolved)) {
                resolved = resolved.replace(
                    /\b(ese|el)\s+estado\b/gi,
                    context.lastState
                );
                console.log('[PRONOUN-RESOLVER] Resolved "ese/el estado" to', context.lastState);
            }
        }

        // Pattern 4: "ese rpm" / "esa tarifa" → use last RPM
        if (/\b(ese|esa)\s+(rpm|rate|tarifa)\b/i.test(resolved) && context.lastRPM) {
            resolved = resolved.replace(
                /\b(ese|esa)\s+(rpm|rate|tarifa)\b/gi,
                `rpm ${context.lastRPM}`
            );
            console.log('[PRONOUN-RESOLVER] Resolved "ese rpm" to', context.lastRPM);
        }

        // Pattern 5: "esas/las millas" → use last miles
        if (/\b(esas|las)\s+millas\b/i.test(resolved) && context.lastMiles) {
            resolved = resolved.replace(
                /\b(esas|las)\s+millas\b/gi,
                `${context.lastMiles} millas`
            );
            console.log('[PRONOUN-RESOLVER] Resolved "las millas" to', context.lastMiles);
        }

        // Pattern 6: "ahí" / "allá" (referring to state) → use last state
        if (/\b(ahí|allá|ahi|alla)\b/i.test(resolved) && context.lastState) {
            // Only if context suggests geographic reference
            if (/ir|voy|vaya|llegar|destino/i.test(resolved)) {
                resolved = resolved.replace(
                    /\b(ahí|allá|ahi|alla)\b/gi,
                    context.lastState
                );
                console.log('[PRONOUN-RESOLVER] Resolved "ahí/allá" to', context.lastState);
            }
        }

        // Pattern 7: "con eso" / "con ese" (referring to RPM)
        if (/\bcon\s+(eso|ese)\b/i.test(resolved) && context.lastRPM) {
            // Check if it's likely referring to RPM
            if (/rpm|price|rate|tarifa/i.test(text) || context.recentMessages.some(m =>
                m.text && /rpm|price|rate|tarifa/i.test(m.text)
            )) {
                resolved = resolved.replace(
                    /\bcon\s+(eso|ese)\b/gi,
                    `con rpm ${context.lastRPM}`
                );
                console.log('[PRONOUN-RESOLVER] Resolved "con eso/ese" to rpm', context.lastRPM);
            }
        }

        if (resolved !== text) {
            console.log('[PRONOUN-RESOLVER] Resolved:', resolved);
        } else {
            console.log('[PRONOUN-RESOLVER] No changes needed');
        }

        return resolved;
    }

    /**
     * Check if text contains pronouns that could be resolved
     * @param {string} text - Text to check
     * @returns {boolean} - True if text contains resolvable pronouns
     */
    static hasResolvablePronouns(text) {
        const pronounPatterns = [
            /\b(esta|esa)\s+(carga|load)\b/i,
            /\b(el|al)\s+mismo\s+estado\b/i,
            /\b(ese|el)\s+estado\b/i,
            /\b(ese|esa)\s+(rpm|rate|tarifa)\b/i,
            /\b(esas|las)\s+millas\b/i,
            /\b(ahí|allá|ahi|alla)\b/i,
            /\bcon\s+(eso|ese)\b/i
        ];

        return pronounPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Get statistics about pronoun resolution
     * @param {ConversationMemory} memory - Conversation memory instance
     * @returns {Object} - Statistics object
     */
    static getStats(memory) {
        if (!memory) return { available: false };

        const context = memory.getContext();
        return {
            available: true,
            lastState: context.lastState || null,
            lastRPM: context.lastRPM || null,
            lastMiles: context.lastMiles || null,
            messageCount: context.messageCount || 0,
            canResolveState: !!context.lastState,
            canResolveRPM: !!context.lastRPM,
            canResolveMiles: !!context.lastMiles
        };
    }
}

// Make available globally
window.PronounResolver = PronounResolver;
console.log('🔗 PronounResolver loaded');
