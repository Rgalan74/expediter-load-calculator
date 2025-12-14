// lex-intents.js
// Cerebro de lenguaje de Lex: entender qué quiere el usuario a partir del texto
// Usa el dataset que preparaste con Claude (variaciones, jerga, indicadores semánticos)

(function () {
  console.log('[LEX-INTENTS] Módulo de intents cargado');

  // ============================
  // Helpers básicos
  // ============================
  function normalize(raw) {
    return (raw || '')
      .toString()
      .trim()
      .toLowerCase()
      // quitar acentos: "últimamente" -> "ultimamente"
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function hasAny(text, list) {
    return list.some((kw) => text.includes(kw));
  }

  function countMatches(text, list) {
    return list.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
  }

  function hasNumberLikeRPM(text) {
    // números tipo 0.85, 1.10, 850, 900mi, 950$
    return /\d+(\.\d+)?/.test(text) || text.includes('$');
  }

  // ============================
  // Listas basadas en tu dataset
  // ============================

  // A. Preguntas externas (clima / noticias / tiempo)
  const EXTERNAL_HINTS_LOCAL = [
    'clima', 'tiempo', 'weather', 'temperatura',
    'noticia', 'noticias', 'news'
  ];

  const PRICING_KEYWORDS = [
  'precio', 'rate', 'rpm', 'tarifa', 'pago', 'paga',
  'dolares', '$', 'cuanto', 'cual es el precio',
  'monto', 'valor', 'fee', 'cargo', 'cobrar', 'pagar',
  // inglés / spanglish
  'load', 'freight', 'pay', 'payout', 'worth'
  ];

  const PRICING_VERBS = [
    'aceptar', 'rechazar', 'negociar', 'pedir', 'cobrar',
    'ofrecer', 'tirar', 'coger', 'agarrar', 'tomar',
    'contraofertar', 'subir', 'bajar'
  ];

  const PRICING_EXPRESSIONS = [
  'esta bueno', 'esta bien', 'vale la pena', 'conviene',
  'esta flojo', 'esta fuerte', 'esta bajo', 'esta alto',
  'es poco', 'es mucho', 'me ofrecen', 'me tiraron',
  'lo agarro', 'es bueno', 'es malo', 'lo tomo', 'lo acepto',
  // spanglish
  'rate ta good', 'rate esta low', 'rate esta high', 'good rate', 'bad rate'
 ];

  // C. Comparación con histórico
  const COMPARISON_KEYWORDS = [
    'promedio', 'comparar', 'mejor', 'peor', 'vs', 'contra',
    'mas que', 'menos que', 'igual', 'diferente', 'historico',
    'antes', 'ultima vez', 'anterior', 'mis cargas', 'mi historial'
  ];

  const COMPARISON_EXPRESSIONS = [
    'vs mi promedio', 'mejor que antes', 'mas de lo que',
    'menos de lo que', 'comparado con', 'igual que', 'peor que la ultima'
  ];

  // D. Estado / zona / mercado
  const STATE_ZONE_KEYWORDS = [
    'estado', 'zona', 'area', 'region', 'mercado', 'lugar', 'ciudad',
    'midwest', 'costa', 'coast', 'norte', 'sur',
    'trap', 'trampa', 'zona caliente', 'mercado muerto'
  ];

  const STATE_ZONE_EXPRESSIONS = [
    'como esta', 'que tal', 'vale la pena', 'es trampa',
    'me quedo parado', 'me quedo trancado', 'hay salidas',
    'trap zone', 'zona caliente', 'mercado muerto', 'esta fuerte el mercado'
  ];

  // E. Historial personal
  const HISTORY_KEYWORDS = [
    'historial', 'antes', 'anterior', 'ultimas', 'previas', 'pasadas',
    'stats', 'estadisticas', 'numeros', 'como me ha ido',
    'he ganado', 'he cobrado', 'mis cargas', 'experiencia'
  ];

  const HISTORY_EXPRESSIONS = [
    'segun mi historial',
    'como me ha ido en',
    'mis numeros en',
    'he ganado en',
    'mis stats',
    'que tal me va',
    'ultimas cargas',
    'cargas previas'
  ];

  const DEADHEAD_KEYWORDS = [
  'deadhead', 'millas vacias', 'millas vac', 'vacio',
  'empty', 'empty miles', 'empty mi',
  'sin carga', 'dh', 'millas en vacio'
  ];

  const DEADHEAD_EXPRESSIONS = [
    'con deadhead',
    'millas vacias',
    'tengo que moverme',
    'sin carga',
    'empty miles',
    'me sale en vacio'
  ];

  // G. Urgencia / decision inmediata
  const URGENCY_KEYWORDS = [
    'urgente', 'rapido', 'ya', 'ahora', 'quick', 'presionando',
    'decide', 'vence', 'tiempo', 'minutos', 'ahorita', 'apurado'
  ];

  const URGENCY_EXPRESSIONS = [
    'tengo que decidir ya',
    'necesito respuesta',
    'en 10 minutos',
    'rapido',
    'me estan presionando',
    'no tengo tiempo'
  ];

  const MOVE_STUCK_KEYWORDS = [
  'moverme', 'quedarme', 'trancado', 'parado',
  'stuck', 'stuck there', 'stuck here',
  'salir', 'escape', 'atascado', 'varado',
  'sin loads', 'waiting loads', 'waiting for load',
  'esperando', 'esperar carga', 'sin cargas'
];

  const MOVE_STUCK_EXPRESSIONS = [
    'me quedo trancado',
    'quedarme parado',
    'como salgo',
    'estoy stuck',
    'varado en',
    'sin cargas',
    'esperando loads'
  ];

  // I. Validacion de decision
  const VALIDATION_KEYWORDS = [
    'bueno', 'malo', 'bien', 'mal', 'si', 'no', 'ok', 'vale',
    'sirve', 'conviene', 'verdad', 'cierto', 'correcto'
  ];

  const VALIDATION_EXPRESSIONS = [
    'esta bueno', 'es malo', 'si o no', 'lo tomo', 'lo acepto',
    'vale la pena', 'conviene', 'sirve', 'esta bien verdad'
  ];

  // J. Duda / incertidumbre
  const DOUBT_KEYWORDS = [
    'duda', 'no se', 'inseguro', 'indeciso', 'pensando',
    'dudando', 'estoy dudando', 'no estoy seguro', 'me da cosa', 'creo que'
  ];

  const DOUBT_EXPRESSIONS = [
    'no se si',
    'tengo duda',
    'no estoy seguro',
    'me da cosa',
    'creo que',
    'sera que',
    'estoy dudando'
  ];

  // K. Negociacion / contraoferta
  const NEGOTIATION_KEYWORDS = [
    'negociar', 'contraofertar', 'subir', 'pedir mas', 'regatear',
    'counter', 'contraoferta', 'mas dinero', 'aumentar', 'ajustar'
  ];

  const NEGOTIATION_EXPRESSIONS = [
    'cuanto pedir',
    'deberia negociar',
    'cuanto contraofertar',
    'pedir mas',
    'subir el precio',
    'cuanto ofrecer yo',
    'cuanto mas puedo pedir',
    'cuanto mas podria sacarle'
  ];

  // ============================
  // Detección de intent
  // ============================
  function detectIntent(messageText) {
    const raw = (messageText || '').toString();
    const t = normalize(raw);

    if (!t) {
      return {
        intent: 'EMPTY',
        confidence: 0,
        flags: { reason: 'empty' }
      };
    }

    const hasNumber  = hasNumberLikeRPM(t);
    const hasExternal = hasAny(t, EXTERNAL_HINTS_LOCAL);

    const priceScore =
      countMatches(t, PRICING_KEYWORDS) +
      countMatches(t, PRICING_VERBS) +
      countMatches(t, PRICING_EXPRESSIONS);

    const compareScore =
      countMatches(t, COMPARISON_KEYWORDS) +
      countMatches(t, COMPARISON_EXPRESSIONS);

    const stateZoneScore =
      countMatches(t, STATE_ZONE_KEYWORDS) +
      countMatches(t, STATE_ZONE_EXPRESSIONS);

    const historyScore =
      countMatches(t, HISTORY_KEYWORDS) +
      countMatches(t, HISTORY_EXPRESSIONS);

    const deadheadScore =
      countMatches(t, DEADHEAD_KEYWORDS) +
      countMatches(t, DEADHEAD_EXPRESSIONS);

    const urgencyScore =
      countMatches(t, URGENCY_KEYWORDS) +
      countMatches(t, URGENCY_EXPRESSIONS);

    const moveStuckScore =
      countMatches(t, MOVE_STUCK_KEYWORDS) +
      countMatches(t, MOVE_STUCK_EXPRESSIONS);

    const validationScore =
      countMatches(t, VALIDATION_KEYWORDS) +
      countMatches(t, VALIDATION_EXPRESSIONS);

    const doubtScore =
      countMatches(t, DOUBT_KEYWORDS) +
      countMatches(t, DOUBT_EXPRESSIONS);

    const negotiationScore =
      countMatches(t, NEGOTIATION_KEYWORDS) +
      countMatches(t, NEGOTIATION_EXPRESSIONS);

    // 1️⃣ Preguntas claramente EXTERNAS (clima / noticias)
    if (hasExternal) {
      return {
        intent: 'EXTERNAL',
        confidence: 0.9,
        flags: { hasExternal, raw }
      };
    }

    // 2️⃣ Pricing con número → PRICING_STATE o PRICING_GENERIC
    if (priceScore > 0 && hasNumber) {
      return {
        intent: 'PRICING',
        subtype: deadheadScore > 0 ? 'PRICING_WITH_DEADHEAD' : 'PRICING_SIMPLE',
        confidence: deadheadScore > 0 ? 0.9 : 0.8,
        flags: {
          hasNumber,
          priceScore,
          deadheadScore,
          validationScore,
          doubtScore,
          raw
        }
      };
    }

    // 3️⃣ Pricing sin número → PRICING_GENERIC (ej: "qué precio aceptar para Miami?")
    if (priceScore > 0 && !hasNumber) {
      return {
        intent: 'PRICING_GENERIC',
        confidence: 0.7,
        flags: { priceScore, raw }
      };
    }

    // 4️⃣ Historial / performance por estado
    if (historyScore > 0 || compareScore > 0) {
      // si además habla de estados / zonas, es más probable que quiera un resumen por estado
      if (stateZoneScore > 0) {
        return {
          intent: 'STATE_SUMMARY',
          confidence: 0.75,
          flags: { historyScore, compareScore, stateZoneScore, raw }
        };
      }
      // si no menciona estado, pero habla de promedio / mejores estados → global
      return {
        intent: 'GLOBAL_METRICS',
        confidence: 0.75,
        flags: { historyScore, compareScore, stateZoneScore, raw }
      };
    }

    // 5️⃣ Preguntas puro estado / mercado (sin pricing)
    if (stateZoneScore > 0 && !hasNumber) {
      return {
        intent: 'STATE_MARKET',
        confidence: 0.7,
        flags: { stateZoneScore, raw }
      };
    }

    // 6️⃣ Deadhead sin pricing concreto
    if (deadheadScore > 0 && !hasNumber) {
      return {
        intent: 'DEADHEAD_CONTEXT',
        confidence: 0.6,
        flags: { deadheadScore, raw }
      };
    }

    // 7️⃣ Urgencia / decisión
    if (urgencyScore > 0 || validationScore > 0 || doubtScore > 0) {
      return {
        intent: 'DECISION_HELP',
        confidence: 0.6,
        flags: { urgencyScore, validationScore, doubtScore, raw }
      };
    }

    // 8️⃣ Negociación
    if (negotiationScore > 0) {
      return {
        intent: 'NEGOTIATION',
        confidence: 0.7,
        flags: { negotiationScore, raw }
      };
    }

    // 9️⃣ Tiene número pero sin contexto claro → pricing genérico
    if (hasNumber) {
      return {
        intent: 'PRICING_GENERIC',
        confidence: 0.55,
        flags: { hasNumber, raw }
      };
    }

    // 🔟 Caso por defecto: desconocido / otro
    return {
      intent: 'OTHER',
      confidence: 0.4,
      flags: {
        raw,
        priceScore,
        stateZoneScore,
        historyScore,
        deadheadScore
      }
    };
  }

  // ============================
  // API global
  // ============================
  window.lexDetectIntent = function (messageText) {
    const result = detectIntent(messageText);
    console.log('[LEX-INTENTS] Intent detectado:', result);
    return result;
  };
})();
