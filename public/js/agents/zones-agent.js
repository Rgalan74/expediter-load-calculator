// ==========================================================
//  ZONES AGENT - Experto en análisis geográfico
// ==========================================================

class ZonesAgent extends AgentBase {
  constructor() {
    super('Zones', [
      'ANALYZE_GEOGRAPHY',
      'DETECT_TRAPS',
      'SUGGEST_ROUTES',
      'MARKET_ANALYSIS'
    ]);

    // Conocimiento de zonas
    this.zones = {
      'CORE_MIDWEST': {
        states: ['IL', 'IN', 'OH', 'KY', 'TN'],
        freight: 'HIGH',
        avgRPM: 1.15,
        shortLoads: 80
      },
      'EXTENDED_MIDWEST': {
        states: ['IA', 'MO', 'WI', 'MI', 'MN'],
        freight: 'MEDIUM',
        avgRPM: 1.05,
        shortLoads: 65
      },
      'TRAP': {
        states: ['NV', 'CA', 'FL'],
        freight: 'MEDIUM',
        avgRPM: 0.85,
        shortLoads: 30,
        warnings: ['Difícil salir', 'Return rates bajos']
      }
    };

    this.log('Inicializado', 'SUCCESS');
  }

  async execute(task, context) {
    this.setState('THINKING');

    try {
      // 1. Analizar zonas de usuario
      const userZones = await this.analyzeUserZones(context);

      // 2. Evaluar mercado actual
      const market = this.evaluateMarket(userZones);

      // 3. Detectar patrones geográficos
      const patterns = this.detectPatterns(userZones);

      // 4. Generar recomendaciones
      const recommendations = this.generateRecommendations(userZones, market, patterns);

      this.setState('DONE');

      return {
        agent: this.name,
        success: true,
        data: {
          userZones,
          market,
          patterns
        },
        recommendations
      };

    } catch (err) {
      this.setState('ERROR');
      this.log(err.message, 'ERROR');
      throw err;
    }
  }

  async analyzeUserZones(context) {
    // Cargar perfil de Lex si existe
    let stateStats = {};

    try {
      const user = firebase.auth().currentUser;
      if (user) {
        const profile = await firebase.firestore()
          .collection('lexProfiles')
          .doc(user.uid)
          .get();

        if (profile.exists) {
          stateStats = profile.data().stateStats || {};
        }
      }
    } catch (err) {
      this.log('No se pudo cargar perfil', 'WARNING');
    }

    // Clasificar estados
    const classified = {
      topStates: [],
      trapStates: [],
      unknownStates: []
    };

    Object.entries(stateStats).forEach(([state, stats]) => {
      if (stats.loads < 2) {
        classified.unknownStates.push({ state, ...stats });
        return;
      }

      // Identificar zona
      const zone = this.identifyZone(state);

      if (zone === 'TRAP') {
        classified.trapStates.push({ state, zone, ...stats });
      } else if (stats.avgRPM > 1.0) {
        classified.topStates.push({ state, zone, ...stats });
      }
    });

    // Ordenar
    classified.topStates.sort((a, b) => b.avgRPM - a.avgRPM);
    classified.trapStates.sort((a, b) => a.avgRPM - b.avgRPM);

    return classified;
  }

  identifyZone(state) {
    for (const [zoneName, zoneData] of Object.entries(this.zones)) {
      if (zoneData.states.includes(state)) {
        return zoneName;
      }
    }
    return 'OTHER';
  }

  evaluateMarket(userZones) {
    const market = {
      focus: null,
      avoid: []
    };

    // Recomendar enfoque
    if (userZones.topStates.length > 0) {
      const top = userZones.topStates[0];
      market.focus = {
        state: top.state,
        zone: top.zone,
        avgRPM: top.avgRPM,
        loads: top.loads
      };
    }

    // Zonas a evitar
    userZones.trapStates.forEach(trap => {
      if (trap.avgRPM < 0.85) {
        market.avoid.push({
          state: trap.state,
          avgRPM: trap.avgRPM,
          reason: 'RPM bajo + zona trampa'
        });
      }
    });

    return market;
  }

  detectPatterns(userZones) {
    const patterns = [];

    // Patrón: enfocado en Midwest
    const midwestStates = userZones.topStates.filter(s => 
      this.zones.CORE_MIDWEST.states.includes(s.state) ||
      this.zones.EXTENDED_MIDWEST.states.includes(s.state)
    );

    if (midwestStates.length >= 3) {
      patterns.push({
        type: 'MIDWEST_FOCUSED',
        description: 'Te enfocas bien en el Midwest',
        strength: 'POSITIVE'
      });
    }

    // Patrón: evitando traps
    if (userZones.trapStates.length === 0) {
      patterns.push({
        type: 'AVOIDING_TRAPS',
        description: 'Evitas zonas trampa exitosamente',
        strength: 'POSITIVE'
      });
    }

    // Patrón: atrapado en zona mala
    const trapLoads = userZones.trapStates.reduce((sum, s) => sum + (s.loads || 0), 0);
    const totalLoads = [...userZones.topStates, ...userZones.trapStates].reduce((sum, s) => sum + (s.loads || 0), 0);
    
    if (trapLoads > totalLoads * 0.3) {
      patterns.push({
        type: 'TOO_MANY_TRAPS',
        description: `${((trapLoads/totalLoads)*100).toFixed(0)}% de cargas en zonas trampa`,
        strength: 'NEGATIVE'
      });
    }

    return patterns;
  }

  generateRecommendations(userZones, market, patterns) {
    const recs = [];

    // Basado en market
    if (market.focus) {
      recs.push(`✅ Busca más cargas en ${market.focus.state} (${market.focus.zone}): $${market.focus.avgRPM.toFixed(2)}/mi`);
    }

    if (market.avoid.length > 0) {
      market.avoid.forEach(av => {
        recs.push(`⚠️ Evita ${av.state}: ${av.reason}`);
      });
    }

    // Basado en patrones
    const negPatterns = patterns.filter(p => p.strength === 'NEGATIVE');
    if (negPatterns.length > 0) {
      recs.push(`🎯 Reduce cargas en zonas trampa - están bajando tu promedio`);
    }

    return recs;
  }
}

// Auto-registrar
if (window.lexMaster) {
  const zonesAgent = new ZonesAgent();
  window.lexMaster.registerAgent('zones', zonesAgent);
}

console.log('🗺️ ZonesAgent loaded');