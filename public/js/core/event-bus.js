// ==========================================================
//  EVENT BUS - Sistema de mensajería entre agentes
// ==========================================================

class AgentEventBus {
  constructor() {
    this.listeners = {};
    this.history = [];
    this.maxHistory = 50;
    console.log('📡 EventBus inicializado');
  }

  // Emitir evento
  emit(eventType, data) {
    const event = {
      type: eventType,
      data,
      ts: Date.now(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();

    const listeners = this.listeners[eventType] || [];
    
    listeners.forEach(callback => {
      try {
        callback(event.data, event);
      } catch (err) {
        console.error(`❌ EventBus error en ${eventType}:`, err);
      }
    });

    return event.id;
  }

  // Suscribirse
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);

    // Retornar función para desuscribirse
    return () => this.off(eventType, callback);
  }

  // Desuscribirse
  off(eventType, callback) {
    if (!this.listeners[eventType]) return;
    const idx = this.listeners[eventType].indexOf(callback);
    if (idx > -1) this.listeners[eventType].splice(idx, 1);
  }

  // Emitir una vez
  once(eventType, callback) {
    const wrapped = (data, event) => {
      callback(data, event);
      this.off(eventType, wrapped);
    };
    return this.on(eventType, wrapped);
  }

  // Limpiar listeners
  removeAll(eventType) {
    if (eventType) {
      delete this.listeners[eventType];
    } else {
      this.listeners = {};
    }
  }

  // Historial
  getHistory(eventType = null, limit = 10) {
    let filtered = this.history;
    if (eventType) {
      filtered = this.history.filter(e => e.type === eventType);
    }
    return filtered.slice(-limit);
  }

  // Stats
  getStats() {
    const types = Object.keys(this.listeners);
    const totalListeners = types.reduce((sum, t) => sum + this.listeners[t].length, 0);
    return {
      eventTypes: types.length,
      totalListeners,
      historySize: this.history.length
    };
  }
}

// Crear instancia global
window.agentEventBus = new AgentEventBus();
console.log('📡 EventBus loaded');