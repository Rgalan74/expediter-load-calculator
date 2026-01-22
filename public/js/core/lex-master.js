// ==========================================================
//  LEX MASTER - Orquestador de agentes
// ==========================================================

class LexMaster {
  constructor() {
    this.agents = {};
    this.eventBus = window.agentEventBus;
    this.context = {
      activeTab: null,
      currentLoad: null,
      userProfile: null
    };
    console.log('🎯 LexMaster inicializado');
  }

  // Registrar agente
  registerAgent(name, agent) {
    agent.connectToEventBus(this.eventBus);
    this.agents[name] = agent;
    console.log(`✅ Agente registrado: ${name}`);
    this.eventBus.emit('AGENT_REGISTERED', { name, caps: agent.capabilities });
  }

  // Obtener agente
  getAgent(name) {
    return this.agents[name] || null;
  }

  // Procesar solicitud (punto de entrada principal)
  async processRequest(userMessage, context = {}) {
    console.log('🎯 [LexMaster] Procesando:', userMessage);

    try {
      // Actualizar contexto
      this.context = { ...this.context, ...context };

      // 1. Detectar intent
      const intent = await this.detectIntent(userMessage);
      console.log('💭 Intent:', intent.primary || intent.intent);

      // 2. Seleccionar agentes
      const agents = this.selectAgents(intent);
      console.log('🎯 Agentes:', agents.map(a => a.name));

      // 3. Ejecutar
      const results = [];
      for (const agent of agents) {
        const start = Date.now();
        try {
          const result = await agent.execute(intent, this.context);
          const duration = Date.now() - start;
          agent.recordTask(true, duration);
          results.push(result);
          console.log(`✅ [${agent.name}] ${duration}ms`);
        } catch (err) {
          agent.recordTask(false, Date.now() - start);
          console.error(`❌ [${agent.name}]`, err);
          results.push({ agent: agent.name, error: err.message });
        }
      }

      // 4. Synthesize results (NEW - Phase 2)
      const synthesis = this.synthesizeResults(results, intent);

      // 5. Emitir evento
      this.eventBus.emit('REQUEST_COMPLETED', { userMessage, intent, results, synthesis });

      return { success: true, results, synthesis, intent };

    } catch (err) {
      console.error('❌ [LexMaster] Error:', err);
      return { success: false, error: err.message };
    }
  }

  // Detectar intent
  async detectIntent(msg) {
    // Usar sistema existente si existe
    if (typeof window.detectIntent === 'function') {
      return window.detectIntent(msg);
    }

    // Fallback inteligente
    const text = (msg || '').toLowerCase();

    // Historia (PRIMERO - más específico)
    if (text.includes('histor') || text.includes('antes') || text.includes('promedio')) {
      return { primary: 'COMPARE_HISTORY', confidence: 0.8, raw: msg };
    }

    // Zonas (ESPECÍFICO)
    if (text.includes('zona') || text.includes('estado') || text.includes('trap') || text.includes('geograf')) {
      return { primary: 'CHECK_ZONE', confidence: 0.8, raw: msg };
    }

    // Finanzas (ESPECÍFICO)
    if (text.includes('finanz') || text.includes('gananci') || text.includes('gasto')) {
      return { primary: 'REVIEW_FINANCES', confidence: 0.8, raw: msg };
    }

    // Pricing/RPM
    if (text.includes('rpm') || text.includes('precio') || text.includes('rate')) {
      return { primary: 'PRICING', confidence: 0.8, raw: msg };
    }

    // Negociación
    if (text.includes('negoci') || text.includes('contraofer')) {
      return { primary: 'NEGOTIATION', confidence: 0.8, raw: msg };
    }

    // Analizar carga (DESPUÉS - más genérico)
    if (text.includes('analiz') || text.includes('calcul') || text.includes('carga')) {
      return { primary: 'ANALYZE_LOAD', confidence: 0.8, raw: msg };
    }

    // Default: chat
    return { primary: 'CHAT', confidence: 0.5, raw: msg };
  }

  // Seleccionar agentes
  selectAgents(intent) {
    const intentMap = {
      'ANALYZE_LOAD': ['calculator'],
      'PRICING': ['calculator'],
      'COMPARE_HISTORY': ['history'],
      'CHECK_ZONE': ['zones'],
      'REVIEW_FINANCES': ['finances'],
      'NEGOTIATION': ['calculator'],
      'CHAT': ['chat']
    };

    const primary = intent.primary || intent.intent || 'CHAT';
    const names = intentMap[primary] || ['chat'];

    const selected = [];
    names.forEach(name => {
      const agent = this.agents[name];
      if (agent) selected.push(agent);
    });

    // Fallback a chat
    if (selected.length === 0 && this.agents.chat) {
      selected.push(this.agents.chat);
    }

    return selected;
  }

  // ==========================================================
  //  SYNTHESIZE RESULTS - Phase 2: Agent Collaboration
  // ==========================================================
  synthesizeResults(agentResults, intent) {
    // Agent weights based on reliability for different contexts
    // UPDATED: Zones weight increased to ensure trap zones are always considered
    const weights = {
      calculator: 0.40,  // Most reliable for immediate pricing decisions
      zones: 0.30,       // INCREASED - Critical for trap zone detection
      history: 0.20,     // Important for trend analysis
      finances: 0.10     // Supporting role for financial context
    };

    // Collect recommendations from all agents
    const recommendations = [];
    let totalWeight = 0;

    agentResults.forEach(result => {
      if (!result || !result.success || !result.recommendation) return;

      const agentName = result.agent || 'unknown';
      const weight = weights[agentName] || 0.1;
      const rec = result.recommendation;

      recommendations.push({
        agent: agentName,
        action: rec.action || 'EVALUA',  // ACEPTA, RECHAZA, EVALUA, NEGOCIA
        weight: weight,
        confidence: result.confidence || rec.confidence || 0.5,
        reasons: rec.reasons || rec.reason ? [rec.reason] : []
      });

      totalWeight += weight;
    });

    // If no valid recommendations, return neutral synthesis
    if (recommendations.length === 0 || totalWeight === 0) {
      return {
        decision: 'EVALUA',
        confidence: 0.3,
        contributingAgents: [],
        reasons: ['No se obtuvieron recomendaciones de los agentes'],
        votes: {}
      };
    }

    // Weighted voting system
    const votes = { ACEPTA: 0, RECHAZA: 0, EVALUA: 0, NEGOCIA: 0 };

    recommendations.forEach(rec => {
      const normalizedWeight = rec.weight / totalWeight;
      const weightedVote = normalizedWeight * rec.confidence;
      votes[rec.action] = (votes[rec.action] || 0) + weightedVote;
    });

    // Determine final decision (highest vote)
    const finalAction = Object.entries(votes)
      .sort((a, b) => b[1] - a[1])[0][0];

    const finalConfidence = votes[finalAction];

    // Collect all unique reasons
    const allReasons = recommendations
      .flatMap(r => r.reasons)
      .filter((r, i, arr) => arr.indexOf(r) === i); // unique only

    return {
      decision: finalAction,
      confidence: parseFloat(finalConfidence.toFixed(2)),
      contributingAgents: recommendations.map(r => r.agent),
      reasons: allReasons,
      votes: votes,
      rawRecommendations: recommendations
    };
  }

  // Actualizar contexto
  updateContext(updates) {
    this.context = { ...this.context, ...updates };
    this.eventBus.emit('CONTEXT_UPDATED', this.context);
  }

  // Stats del sistema
  getStats() {
    const agentStats = {};
    Object.entries(this.agents).forEach(([name, agent]) => {
      agentStats[name] = agent.getStats();
    });

    return {
      totalAgents: Object.keys(this.agents).length,
      agents: agentStats,
      eventBus: this.eventBus.getStats(),
      context: this.context
    };
  }
}

// Crear instancia global
window.lexMaster = new LexMaster();
console.log('🎯 LexMaster loaded');