// ==========================================================
//  PATTERN LEARNER - Learn from user's decision history
// ==========================================================

window.PatternLearner = {

    /**
     * Analyze decision patterns and learn user preferences
     * @param {Array} decisions - Array of recent decisions
     * @returns {object} Learned patterns and preferences
     */
    analyzePatterns(decisions) {
        if (!decisions || decisions.length < 10) {
            return null; // Need at least 10 decisions to learn
        }

        const patterns = {
            rpmThresholds: this.learnRPMThresholds(decisions),
            statePreferences: this.learnStatePreferences(decisions),
            acceptanceRate: this.calculateAcceptanceRate(decisions),
            trapBehavior: this.analyzeTrapBehavior(decisions)
        };

        return patterns;
    },

    /**
     * Learn RPM thresholds by state
     */
    learnRPMThresholds(decisions) {
        const byState = {};

        decisions.forEach(d => {
            if (!d.state || !d.rpm) return;

            if (!byState[d.state]) {
                byState[d.state] = { accepted: [], rejected: [] };
            }

            if (d.decision === 'ACCEPTED') {
                byState[d.state].accepted.push(d.rpm);
            } else if (d.decision === 'REJECTED') {
                byState[d.state].rejected.push(d.rpm);
            }
        });

        const thresholds = {};
        Object.keys(byState).forEach(state => {
            const data = byState[state];

            if (data.accepted.length > 0 && data.rejected.length > 0) {
                const minAccepted = Math.min(...data.accepted);
                const maxRejected = Math.max(...data.rejected);

                // Threshold is between max rejected and min accepted
                thresholds[state] = {
                    state,
                    minAccepted,
                    maxRejected,
                    threshold: (minAccepted + maxRejected) / 2,
                    confidence: this.calculateConfidence(data.accepted.length, data.rejected.length)
                };
            }
        });

        return thresholds;
    },

    /**
     * Learn state preferences (which states user accepts more)
     */
    learnStatePreferences(decisions) {
        const stateStats = {};

        decisions.forEach(d => {
            if (!d.state) return;

            if (!stateStats[d.state]) {
                stateStats[d.state] = { total: 0, accepted: 0, rejected: 0 };
            }

            stateStats[d.state].total++;
            if (d.decision === 'ACCEPTED') stateStats[d.state].accepted++;
            if (d.decision === 'REJECTED') stateStats[d.state].rejected++;
        });

        // Convert to array and sort by acceptance rate
        const preferences = Object.keys(stateStats)
            .map(state => ({
                state,
                ...stateStats[state],
                acceptanceRate: stateStats[state].accepted / stateStats[state].total
            }))
            .filter(s => s.total >= 3) // Need at least 3 decisions
            .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

        return {
            preferred: preferences.slice(0, 5).map(s => s.state),
            avoided: preferences.slice(-3).reverse().map(s => s.state),
            details: preferences
        };
    },

    /**
     * Calculate overall acceptance rate
     */
    calculateAcceptanceRate(decisions) {
        const accepted = decisions.filter(d => d.decision === 'ACCEPTED').length;
        const rejected = decisions.filter(d => d.decision === 'REJECTED').length;
        const total = accepted + rejected;

        if (total === 0) return 0;

        return {
            rate: accepted / total,
            accepted,
            rejected,
            total
        };
    },

    /**
     * Analyze behavior towards trap zones
     */
    analyzeTrapBehavior(decisions) {
        const trapZones = ['CA', 'FL', 'NV', 'TX'];
        const trapDecisions = decisions.filter(d => trapZones.includes(d.state));

        if (trapDecisions.length < 3) return null;

        const accepted = trapDecisions.filter(d => d.decision === 'ACCEPTED');
        const rejected = trapDecisions.filter(d => d.decision === 'REJECTED');

        // Calculate average RPM for accepted trap loads
        const avgRPM = accepted.length > 0
            ? accepted.reduce((sum, d) => sum + d.rpm, 0) / accepted.length
            : 0;

        return {
            totalTrapDecisions: trapDecisions.length,
            accepted: accepted.length,
            rejected: rejected.length,
            acceptanceRate: accepted.length / trapDecisions.length,
            avgAcceptedRPM: avgRPM,
            behavior: this.classifyTrapBehavior(accepted.length / trapDecisions.length)
        };
    },

    /**
     * Classify trap behavior
     */
    classifyTrapBehavior(rate) {
        if (rate > 0.7) return 'RISK_TAKER'; // Accepts most trap zones
        if (rate > 0.4) return 'SELECTIVE'; // Sometimes accepts if good RPM
        return 'CAUTIOUS'; // Mostly avoids trap zones
    },

    /**
     * Calculate confidence in pattern (0-1)
     */
    calculateConfidence(acceptedCount, rejectedCount) {
        const total = acceptedCount + rejectedCount;
        if (total < 5) return 0.3;
        if (total < 10) return 0.6;
        return 0.9;
    },

    /**
     * Predict if user will accept a load based on patterns
     */
    predictAcceptance(patterns, state, rpm) {
        if (!patterns) return null;

        let prediction = {
            willAccept: false,
            confidence: 0,
            reasons: []
        };

        // Check RPM thresholds for this state
        if (patterns.rpmThresholds[state]) {
            const threshold = patterns.rpmThresholds[state];
            if (rpm >= threshold.threshold) {
                prediction.willAccept = true;
                prediction.confidence = threshold.confidence;
                prediction.reasons.push(`RPM arriba de tu threshold aprendido ($${threshold.threshold.toFixed(2)}/mi)`);
            } else {
                prediction.willAccept = false;
                prediction.confidence = threshold.confidence;
                prediction.reasons.push(`RPM abajo de tu threshold aprendido ($${threshold.threshold.toFixed(2)}/mi)`);
            }
        }

        // Check state preferences
        if (patterns.statePreferences.preferred.includes(state)) {
            prediction.reasons.push('Zona preferida basado en tu historial');
            prediction.confidence = Math.min(prediction.confidence + 0.2, 1.0);
        } else if (patterns.statePreferences.avoided.includes(state)) {
            prediction.reasons.push('Zona que sueles evitar');
            prediction.confidence = Math.min(prediction.confidence + 0.2, 1.0);
            prediction.willAccept = false;
        }

        return prediction;
    }
};

console.log('🧠 PatternLearner loaded');
