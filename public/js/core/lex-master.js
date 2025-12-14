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

      // 4. Emitir evento
      this.eventBus.emit('REQUEST_COMPLETED', { userMessage, intent, results });

      return { success: true, results, intent };

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