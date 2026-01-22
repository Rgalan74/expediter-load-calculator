// ==========================================================
//  CONVERSATION MEMORY - Context tracking for Lex AI
//  Remembers recent messages and extracts entities
// ==========================================================

class ConversationMemory {
    constructor(maxMessages = 10) {
        this.history = [];  // Array of {role: 'user'|'lex', text: string, timestamp: number}
        this.entities = {}; // Extracted entities {states: [], numbers: [], rpms: [], miles: []}
        this.context = {};  // Current context {lastState: '', lastRPM: null, lastMiles: null}
        this.maxMessages = maxMessages;

        console.log('[CONVERSATION-MEMORY] Initialized with max', maxMessages, 'messages');
    }

    /**
     * Add a message to conversation history
     * @param {string} role - 'user' or 'lex'
     * @param {string} text - Message content
     */
    addMessage(role, text) {
        const msg = {
            role,
            text,
            timestamp: Date.now()
        };

        this.history.push(msg);

        // Keep only last N messages
        if (this.history.length > this.maxMessages) {
            this.history.shift();
        }

        // Extract entities from user messages
        if (role === 'user') {
            this.extractEntities(text);
        }

        console.log('[CONVERSATION-MEMORY] Added', role, 'message. Total:', this.history.length);
    }

    /**
     * Extract entities from text and update context
     * @param {string} text - User message
     */
    extractEntities(text) {
        // Initialize entity arrays if needed
        this.entities.states = this.entities.states || [];
        this.entities.rpms = this.entities.rpms || [];
        this.entities.miles = this.entities.miles || [];
        this.entities.numbers = this.entities.numbers || [];

        // Extract state (use global functions if available)
        let state = null;
        if (typeof detectStateFromTextLocal === 'function') {
            state = detectStateFromTextLocal(text);
        }
        if (!state && typeof detectStateFromCityInText === 'function') {
            state = detectStateFromCityInText(text);
        }
        if (!state && typeof detectStateFromNameInText === 'function') {
            state = detectStateFromNameInText(text);
        }

        if (state) {
            this.entities.states.push(state);
            this.context.lastState = state;
            console.log('[CONVERSATION-MEMORY] Extracted state:', state);
        }

        // Extract RPM (use global function if available)
        let rpm = null;
        if (typeof parseRPMFromText === 'function') {
            rpm = parseRPMFromText(text);
        } else {
            // Fallback: simple extraction
            const matches = text.match(/(\d+(\.\d+)?)/g);
            if (matches) {
                const candidates = matches
                    .map(str => parseFloat(str))
                    .filter(num => !isNaN(num) && num > 0.1 && num < 10);
                if (candidates.length > 0) {
                    rpm = candidates[candidates.length - 1];
                }
            }
        }

        if (rpm) {
            this.entities.rpms.push(rpm);
            this.context.lastRPM = rpm;
            console.log('[CONVERSATION-MEMORY] Extracted RPM:', rpm);
        }

        // Extract miles
        const milesMatch = text.match(/(\d+)\s*(millas|miles|mi)\b/i);
        if (milesMatch) {
            const miles = parseInt(milesMatch[1]);
            this.entities.miles.push(miles);
            this.context.lastMiles = miles;
            console.log('[CONVERSATION-MEMORY] Extracted miles:', miles);
        }

        // Extract all numbers for general reference
        const allNumbers = text.match(/\d+(\.\d+)?/g);
        if (allNumbers) {
            allNumbers.forEach(num => {
                const parsed = parseFloat(num);
                if (!isNaN(parsed)) {
                    this.entities.numbers.push(parsed);
                }
            });
        }
    }

    /**
     * Get current conversation context
     * @returns {Object} Context object with recent messages and entities
     */
    getContext() {
        return {
            recentMessages: this.history.slice(-5), // Last 5 messages
            lastState: this.context.lastState || null,
            lastRPM: this.context.lastRPM || null,
            lastMiles: this.context.lastMiles || null,
            allStates: this.entities.states || [],
            allRPMs: this.entities.rpms || [],
            allMiles: this.entities.miles || [],
            messageCount: this.history.length
        };
    }

    /**
     * Get the last user message
     * @returns {Object|null} Last user message or null
     */
    getLastUserMessage() {
        const userMessages = this.history.filter(m => m.role === 'user');
        return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
    }

    /**
     * Get the last Lex response
     * @returns {Object|null} Last Lex message or null
     */
    getLastLexMessage() {
        const lexMessages = this.history.filter(m => m.role === 'lex');
        return lexMessages.length > 0 ? lexMessages[lexMessages.length - 1] : null;
    }

    /**
     * Clear all memory
     */
    clear() {
        this.history = [];
        this.entities = {};
        this.context = {};
        console.log('[CONVERSATION-MEMORY] Cleared');
    }

    /**
     * Get memory statistics
     * @returns {Object} Stats object
     */
    getStats() {
        return {
            totalMessages: this.history.length,
            userMessages: this.history.filter(m => m.role === 'user').length,
            lexMessages: this.history.filter(m => m.role === 'lex').length,
            statesExtracted: this.entities.states?.length || 0,
            rpmsExtracted: this.entities.rpms?.length || 0,
            milesExtracted: this.entities.miles?.length || 0
        };
    }
}

// Make available globally
window.ConversationMemory = ConversationMemory;
console.log('💭 ConversationMemory class loaded');
