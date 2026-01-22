// ==========================================================
//  SENTIMENT ANALYZER - Detect user emotional state
// ==========================================================

window.SentimentAnalyzer = {

    /**
     * Analyze sentiment from user text
     * @param {string} text - User's message
     * @returns {object} { type, intensity, flags }
     */
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();
        const originalText = text;

        // Initialize sentiment result
        const sentiment = {
            type: 'NEUTRAL',
            intensity: 0,
            flags: {}
        };

        // Check URGENT sentiment
        const urgentScore = this.detectUrgent(originalText, lowerText);
        if (urgentScore.intensity > sentiment.intensity) {
            sentiment.type = 'URGENT';
            sentiment.intensity = urgentScore.intensity;
            sentiment.flags = urgentScore.flags;
        }

        // Check FRUSTRATED sentiment
        const frustratedScore = this.detectFrustrated(lowerText);
        if (frustratedScore.intensity > sentiment.intensity) {
            sentiment.type = 'FRUSTRATED';
            sentiment.intensity = frustratedScore.intensity;
            sentiment.flags = frustratedScore.flags;
        }

        // Check UNCERTAIN sentiment
        const uncertainScore = this.detectUncertain(lowerText, originalText);
        if (uncertainScore.intensity > sentiment.intensity) {
            sentiment.type = 'UNCERTAIN';
            sentiment.intensity = uncertainScore.intensity;
            sentiment.flags = uncertainScore.flags;
        }

        return sentiment;
    },

    /**
     * Detect URGENT sentiment
     */
    detectUrgent(originalText, lowerText) {
        const flags = {};
        let score = 0;

        // Keywords for urgency
        const urgentKeywords = ['necesito', 'urgente', 'ya', 'ahora', 'rapido', 'rápido', 'inmediato', 'pronto'];
        const keywordMatches = urgentKeywords.filter(kw => lowerText.includes(kw)).length;

        if (keywordMatches > 0) {
            flags.urgentKeywords = keywordMatches;
            score += keywordMatches * 0.3;
        }

        // Check for ALL CAPS
        const words = originalText.split(/\s+/);
        const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase()).length;
        const capsRatio = words.length > 0 ? capsWords / words.length : 0;

        if (capsRatio > 0.3) {
            flags.allCaps = true;
            score += 0.4;
        }

        // Multiple exclamation marks
        if (/!{2,}/.test(originalText)) {
            flags.exclamations = true;
            score += 0.3;
        }

        return {
            intensity: Math.min(score, 1.0),
            flags
        };
    },

    /**
     * Detect FRUSTRATED sentiment
     */
    detectFrustrated(lowerText) {
        const flags = {};
        let score = 0;

        // Frustration keywords
        const frustratedKeywords = [
            'no entiendo', 'otra vez', 'siempre', 'nunca funciona',
            'por que', 'porque', 'dificil', 'difícil', 'complicado',
            'no puedo', 'no logro', 'no se como', 'no sé como'
        ];

        const keywordMatches = frustratedKeywords.filter(kw => lowerText.includes(kw)).length;

        if (keywordMatches > 0) {
            flags.frustratedKeywords = keywordMatches;
            score += keywordMatches * 0.4;
        }

        // Negative patterns
        const negativePatterns = ['no puedo', 'no logro', 'no funciona', 'no me sirve'];
        const negativeMatches = negativePatterns.filter(p => lowerText.includes(p)).length;

        if (negativeMatches > 0) {
            flags.negativePatterns = negativeMatches;
            score += negativeMatches * 0.3;
        }

        return {
            intensity: Math.min(score, 1.0),
            flags
        };
    },

    /**
     * Detect UNCERTAIN sentiment
     */
    detectUncertain(lowerText, originalText) {
        const flags = {};
        let score = 0;

        // Uncertainty keywords
        const uncertainKeywords = [
            'no se', 'no sé', 'duda', 'confundido', 'inseguro',
            'tal vez', 'quizas', 'quizás', 'puede ser', 'sera que', 'será que'
        ];

        const keywordMatches = uncertainKeywords.filter(kw => lowerText.includes(kw)).length;

        if (keywordMatches > 0) {
            flags.uncertainKeywords = keywordMatches;
            score += keywordMatches * 0.4;
        }

        // Multiple question marks
        if (/\?{2,}/.test(originalText)) {
            flags.multipleQuestions = true;
            score += 0.3;
        }

        // Hedging language
        const hedging = ['creo que', 'puede ser', 'tal vez', 'quizas', 'quizás'];
        const hedgingMatches = hedging.filter(h => lowerText.includes(h)).length;

        if (hedgingMatches > 0) {
            flags.hedging = hedgingMatches;
            score += hedgingMatches * 0.3;
        }

        return {
            intensity: Math.min(score, 1.0),
            flags
        };
    }
};

console.log('🎭 SentimentAnalyzer loaded');
