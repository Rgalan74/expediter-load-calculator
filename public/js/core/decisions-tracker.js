// ==========================================================
//  DECISIONS TRACKER - Track user decisions for learning
// ==========================================================

window.DecisionsTracker = {

    /**
     * Track a user decision
     * @param {object} loadData - Load details (state, rpm, miles, etc)
     * @param {string} decision - 'ACCEPTED' | 'REJECTED' | 'UNSURE'
     * @param {string} reasoning - Why the decision was made
     */
    async trackDecision(loadData, decision, reasoning = '') {
        try {
            const profile = await getLexProfile();
            if (!profile) return;

            // Initialize recentDecisions if not exists
            if (!profile.recentDecisions) {
                profile.recentDecisions = [];
            }

            // Add new decision
            profile.recentDecisions.unshift({
                timestamp: Date.now(),
                state: loadData.state,
                rpm: loadData.rpm,
                miles: loadData.miles,
                deadhead: loadData.deadhead,
                decision: decision,
                reasoning: reasoning
            });

            // Keep last 100 decisions
            profile.recentDecisions = profile.recentDecisions.slice(0, 100);

            // Save updated profile
            await this.saveProfile(profile);

            console.log('[DECISIONS] Tracked:', decision, 'for', loadData.state, '@', loadData.rpm);

        } catch (error) {
            console.error('[DECISIONS] Error tracking:', error);
        }
    },

    /**
     * Get decision history
     */
    async getDecisionHistory(limit = 50) {
        const profile = await getLexProfile();
        return profile?.recentDecisions?.slice(0, limit) || [];
    },

    /**
     * Save profile to Firestore
     */
    async saveProfile(profile) {
        if (typeof saveLexProfile === 'function') {
            await saveLexProfile(profile);
        } else if (firebase?.auth?.().currentUser) {
            const db = firebase.firestore();
            const userId = firebase.auth().currentUser.uid;
            await db.collection('lexProfiles').doc(userId).set(profile, { merge: true });
        }
    }
};

console.log('📝 DecisionsTracker loaded');
