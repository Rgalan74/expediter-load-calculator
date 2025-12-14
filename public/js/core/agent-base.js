// ==========================================================
//  AGENT BASE - Clase padre para todos los agentes de Lex
// ==========================================================

class AgentBase {
  constructor(name, capabilities = []) {
    this.name = name;
    this.capabilities = capabilities;
    this.state = 'IDLE';
    this.eventBus = null;
    this.memory = { shortTerm: [], longTerm: {} };
    this.metrics = { tasksCompleted: 0, avgTime: 0, errors: 0 };
  }

  // Método principal - DEBE implementarse en cada agente
  async execute(task, context) {
    throw new Error(`${this.name} must implement execute()`);
  }

  // Cambiar estado
  setState(newState) {
    const old = this.state;
    this.state = newState;
    this.emit('state_changed', { from: old, to: newState });
  }

  // Emitir evento
  emit(eventType, data) {
    if (this.eventBus) {
      this.eventBus.emit(eventType, { source: this.name, ...data });
    }
  }

  // Escuchar eventos
  on(eventType, callback) {
    if (this.eventBus) this.eventBus.on(eventType, callback);
  }

  // Conectar EventBus
  connectToEventBus(eventBus) {
    this.eventBus = eventBus;
    console.log(`✅ ${this.name} → EventBus`);
  }

  // Logging
  log(msg, level = 'INFO') {
    const emoji = { INFO: 'ℹ️', SUCCESS: '✅', ERROR: '❌', WARNING: '⚠️' }[level] || 'ℹ️';
    console.log(`${emoji} [${this.name}] ${msg}`);
  }

  // Memoria corto plazo
  remember(key, value) {
    this.memory.shortTerm.push({ key, value, ts: Date.now() });
    if (this.memory.shortTerm.length > 10) this.memory.shortTerm.shift();
  }

  recall(key) {
    const m = this.memory.shortTerm.find(x => x.key === key);
    return m ? m.value : null;
  }

  // Verificar capacidad
  canHandle(taskType) {
    return this.capabilities.includes(taskType);
  }

  // Métricas
  recordTask(success, duration) {
    this.metrics.tasksCompleted++;
    if (success) {
      const total = this.metrics.avgTime * (this.metrics.tasksCompleted - 1);
      this.metrics.avgTime = (total + duration) / this.metrics.tasksCompleted;
    } else {
      this.metrics.errors++;
    }
  }

  // Stats
  getStats() {
    return {
      name: this.name,
      state: this.state,
      capabilities: this.capabilities,
      metrics: this.metrics
    };
  }
}

// Exponer globalmente
window.AgentBase = AgentBase;
console.log('🧠 AgentBase loaded');