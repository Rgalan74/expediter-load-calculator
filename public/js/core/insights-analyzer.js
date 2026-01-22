// ==========================================================
//  INSIGHTS ANALYZER - Proactive pattern detection
// ==========================================================

window.InsightsAnalyzer = {

    /**
     * Generate insights from user profile
     * @param {object} profile - User's Lex profile
     * @returns {Array} Array of insight objects
     */
    async generateInsights(profile) {
        if (!profile) return [];

        const insights = [];

        // Check for repeated trap zone rejections
        const trapRejections = this.checkTrapRejections(profile);
        if (trapRejections) insights.push(trapRejections);

        // Check for RPM trend
        const rpmTrend = this.checkRPMTrend(profile);
        if (rpmTrend) insights.push(rpmTrend);

        // Check for consecutive trap acceptances
        const trapStreak = this.checkTrapStreak(profile);
        if (trapStreak) insights.push(trapStreak);

        // Check for state preference changes
        const statePreference = this.checkStatePreferences(profile);
        if (statePreference) insights.push(statePreference);

        return insights;
    },

    /**
     * Check for repeated trap zone rejections (good behavior)
     */
    checkTrapRejections(profile) {
        const recentDecisions = profile.recentDecisions || [];
        const lastWeek = recentDecisions.filter(d =>
            d.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
        );

        const trapZones = ['CA', 'FL', 'NV', 'TX', 'OR', 'WA', 'AZ', 'UT', 'ID', 'MT', 'WY', 'CO', 'NM'];
        const trapRejections = lastWeek.filter(d =>
            trapZones.includes(d.state) && d.decision === 'REJECTED'
        );

        if (trapRejections.length >= 3) {
            const zones = [...new Set(trapRejections.map(d => d.state))];
            return {
                type: 'TRAP_REJECTIONS',
                priority: 'MEDIUM',
                emoji: '👍',
                message: `Noté que rechazaste ${trapRejections.length} cargas a zonas trap esta semana (${zones.join(', ')}). Bien hecho evitando zonas difíciles! 💪`
            };
        }
        return null;
    },

    /**
     * Check RPM trend (up or down)
     */
    checkRPMTrend(profile) {
        // Compare current month vs last month
        const allLoads = profile.loads || [];
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

        const thisMonth = allLoads.filter(l => l.timestamp >= thisMonthStart);
        const lastMonth = allLoads.filter(l =>
            l.timestamp >= lastMonthStart && l.timestamp < thisMonthStart
        );

        if (thisMonth.length < 5 || lastMonth.length < 5) return null;

        const thisAvg = thisMonth.reduce((sum, l) => sum + (l.rpm || 0), 0) / thisMonth.length;
        const lastAvg = lastMonth.reduce((sum, l) => sum + (l.rpm || 0), 0) / lastMonth.length;

        const change = ((thisAvg - lastAvg) / lastAvg) * 100;

        if (Math.abs(change) > 10) {
            const emoji = change > 0 ? '📈' : '📉';
            const direction = change > 0 ? 'subió' : 'bajó';
            const priority = change < 0 ? 'HIGH' : 'LOW';

            return {
                type: 'RPM_TREND',
                priority: priority,
                emoji: emoji,
                message: `Tu RPM promedio ${direction} ${Math.abs(change).toFixed(0)}% este mes: $${lastAvg.toFixed(2)} → $${thisAvg.toFixed(2)}/mi. ${change < 0 ? '¿Quieres que analice qué cambió?' : 'Vas bien! 👍'}`
            };
        }
        return null;
    },

    /**
     * Check for consecutive trap zone acceptances (warning)
     */
    checkTrapStreak(profile) {
        const recentDecisions = profile.recentDecisions || [];
        const recentAccepted = recentDecisions
            .filter(d => d.decision === 'ACCEPTED')
            .slice(0, 5);

        const trapZones = ['CA', 'FL', 'NV', 'TX'];
        const trapAccepted = recentAccepted.filter(d => trapZones.includes(d.state));

        if (trapAccepted.length >= 3) {
            const zones = [...new Set(trapAccepted.map(d => d.state))];
            return {
                type: 'TRAP_STREAK',
                priority: 'HIGH',
                emoji: '⚠️',
                message: `Aceptaste ${trapAccepted.length} cargas seguidas a zonas trap (${zones.join(', ')}). Recuerda: difícil salir. ¿Tienes plan de regreso?`
            };
        }
        return null;
    },

    /**
     * Check for new favorite states
     */
    checkStatePreferences(profile) {
        const recentDecisions = profile.recentDecisions || [];
        const lastMonth = recentDecisions.filter(d =>
            d.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000 &&
            d.decision === 'ACCEPTED'
        );

        if (lastMonth.length < 10) return null;

        // Count by state
        const stateCounts = {};
        lastMonth.forEach(d => {
            stateCounts[d.state] = (stateCounts[d.state] || 0) + 1;
        });

        // Find most frequent
        const sorted = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
        const topState = sorted[0];

        if (topState && topState[1] >= lastMonth.length * 0.4) {
            return {
                type: 'STATE_PREFERENCE',
                priority: 'LOW',
                emoji: '📍',
                message: `Noté que ${(topState[1] / lastMonth.length * 100).toFixed(0)}% de tus cargas este mes fueron a ${topState[0]}. ¿Es tu zona preferida?`
            };
        }
        return null;
    }
};

console.log('💡 InsightsAnalyzer loaded');
