/**
 * @copyright 2026 SmartLoad Solution — Ricardo Galan. All rights reserved.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without prior written permission.
 * Violators may be prosecuted under applicable copyright law.
 *
 * @product    Expediter Load Calculator (SmartLoad Solution)
 * @author     Ricardo Galan <ricardogalan74@gmail.com>
 * @license    Proprietary — All Rights Reserved
 * @fingerprint SLS-2026-RG74-EXPEDITER
 */
// ==========================================================
//  LEX.JS - Control visual del asistente Lex
//  Adaptado exactamente a tus 9 imágenes en /img/lex/
// ==========================================================

// 🔹 Rutas exactas según tus archivos (con soporte WebP automático)
const LEX_IMAGES_BASE = {
  idle: 'img/lex/lex-neutral',   // estado neutral / base
  thinking: 'img/lex/lex-thinking',  // analizando datos
  happy: 'img/lex/lex-happy',     // carga buena / positiva
  warning: 'img/lex/lex-alert',     // alerta / dudosa
  sad: 'img/lex/lex-sad',       // carga mala
  blink: 'img/lex/lex-blink',     // parpadeo natural
  sleep: 'img/lex/lex-sleep',     // inactivo / descanso
  loading: 'img/lex/lex-loading',   // cargando / esperando
  surprise: 'img/lex/lex-surprise',  // sorprendido
};

// 🎨 Generar rutas con WebP automatico si esta disponible
const LEX_IMAGES = {};

// Detectar si el navegador soporta WebP
const lexSupportsWebP = (() => {
  const canvas = document.createElement('canvas');
  return canvas.getContext && canvas.getContext('2d')
    ? canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
    : false;
})();

// IMPORTANTE: Las rutas son diferentes para PNG y WebP
// PNG: img/lex/lex-neutral.png
// WebP: img/lex-neutral.webp (sin subcarpeta "lex")
Object.keys(LEX_IMAGES_BASE).forEach(key => {
  const baseName = LEX_IMAGES_BASE[key].replace('img/lex/', '');
  if (lexSupportsWebP) {
    // WebP está directamente en img/
    LEX_IMAGES[key] = 'img/' + baseName.split('/').pop() + '.webp';
  } else {
    // PNG está en img/lex/
    LEX_IMAGES[key] = LEX_IMAGES_BASE[key] + '.png';
  }
});

debugLog(`🎨 Lex usando ${lexSupportsWebP ? 'WebP' : 'PNG'} images`);

// 🔹 Colores del puntico según estado
const LEX_STATUS_COLORS = {
  idle: 'bg-emerald-400',
  thinking: 'bg-blue-400',
  happy: 'bg-green-400',
  warning: 'bg-yellow-400',
  sad: 'bg-red-500',
  blink: 'bg-emerald-300',
  sleep: 'bg-slate-500',
  loading: 'bg-blue-300',
  surprise: 'bg-purple-400',
};

let lexCurrentState = 'idle';

// Shared state-code utilities — Fase 2 (destination listener) + Fase 3 (insights)
const _STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
  'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VT','VA','WA','WV','WI','WY'
]);
function _extractStateCode(text) {
  if (!text) return null;
  const tokens = text.toUpperCase().match(/\b([A-Z]{2})\b/g) || [];
  return tokens.find(s => _STATE_CODES.has(s)) || null;
}

// Shared Firestore lexProfile cache — Fase 2 + Fase 3
let _lexProfileCache = null;
async function _loadLexProfile() {
  if (_lexProfileCache) return _lexProfileCache;
  try {
    const uid = window.currentUser?.uid;
    if (!uid) return null;
    const snap = await firebase.firestore().collection('lexProfiles').doc(uid).get();
    _lexProfileCache = snap.data() || {};
    return _lexProfileCache;
  } catch (e) { return null; }
}

// ==========================================================
//  Cambiar estado visual de Lex
// ==========================================================
function setLexState(state, options = {}) {
  const imgEl = document.getElementById('lexAvatarImg');
  const dotEl = document.getElementById('lexStatusDot');
  const bubble = document.getElementById('lexBubble');
  const bubbleText = document.getElementById('lexBubbleText');
  const shell = imgEl ? imgEl.closest('.lex-avatar-shell') : null;

  if (!imgEl || !dotEl) return;
  if (!LEX_IMAGES[state]) state = 'idle';

  lexCurrentState = state;

  // Cambiar imagen
  imgEl.src = LEX_IMAGES[state];

  // Reset sleep class
  if (shell) shell.classList.remove('lex-sleep');

  // Sleep visual
  if (state === 'sleep' && shell) {
    shell.classList.add('lex-sleep');
  }

  // Cambiar color del puntito
  dotEl.className =
    'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 shadow-lg ' +
    (LEX_STATUS_COLORS[state] || LEX_STATUS_COLORS.idle);

  // Control de burbuja
  if (
    bubble &&
    bubbleText &&
    options.message &&
    !window.lexChatOpen // 👈 si el chat está abierto, NO mostramos burbuja
  ) {
    bubbleText.textContent = options.message;
    bubble.classList.remove('hidden');

    // Ocultar después de unos segundos (si duration)
    const ms = options.duration || 5000;
    setTimeout(() => {
      bubble.classList.add('hidden');
    }, ms);
  }
}


// Hacer accesible globalmente
window.setLexState = setLexState;

// ==========================================================
//  Eventos iniciales: hover, click, bienvenida
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  const shell = document.querySelector('.lex-avatar-shell');

  // Bienvenida
  setLexState('idle', {
    message: window.i18n?.t('lex.hover_bubble') || 'Hola, soy Lex. Click en mi para analizar cargas.',
    duration: 1000
  });

  if (!shell) return;

  // Hover → thinking
  shell.addEventListener('mouseenter', () => {
    if (lexCurrentState === 'sleep') return;

    setLexState('thinking', {
      message: window.i18n?.t('lex.hover_bubble') || 'Click para ver analisis detallado de la seccion actual',
      duration: 3000
    });
  });

  // Salir hover → idle
  shell.addEventListener('mouseleave', () => {
    if (lexCurrentState === 'sleep') return;
    setLexState('idle');
  });

  // Click → Abrir chat directamente (profesional chatbot style)
  shell.addEventListener('click', () => {
    // Si está dormido, despertar Y abrir
    if (lexCurrentState === 'sleep') {
      setLexState('idle');
    }

    // Abrir chat modal directamente
    if (typeof window.openLexChatModal === 'function') {
      window.openLexChatModal();
    } else {
      debugLog('[LEX] openLexChatModal no está disponible');
    }
  });

  // 👋 Welcome message on app load
  setTimeout(() => {
    setLexState('idle', {
      message: window.i18n?.t('lex.welcome_bubble') || '👋 Hola! Soy Lex. Click en mí para conversar.',
      duration: 2500
    });

    // Go to sleep after 2.5s
    setTimeout(() => {
      setLexState('sleep');
    }, 2500);
  }, 1000); // Show 1s after app loads

  // ==========================================================
  //  LEX PROACTIVO: Reacciona al panel de decisión automáticamente
  //  El usuario NO necesita abrir el chat — Lex despierta y habla
  // ==========================================================
  document.addEventListener('lexDecisionChanged', (e) => {
    const d = e.detail;
    if (!d || !d.actualRPM) return;

    // Si el chat está abierto, no duplicar con burbuja exterior
    if (window.lexChatOpen) return;

    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

    // Determinar estado visual y mensaje según decisión
    let lexState = 'idle';
    let bubbleMsg = '';

    const rpm = d.actualRPM.toFixed(2);
    const dest = d.destinationState || d.destination?.split(',')[0] || '';

    switch (d.decision) {
      case 'ACCEPT':
        lexState = 'happy';
        bubbleMsg = isEs
          ? `✅ ${dest ? dest + ': ' : ''}$${rpm}/mi — ¡Buena carga! Click para análisis completo.`
          : `✅ ${dest ? dest + ': ' : ''}$${rpm}/mi — Good load! Click for full analysis.`;
        break;

      case 'ALMOST ACCEPT':
        lexState = 'warning';
        bubbleMsg = isEs
          ? `🟡 $${rpm}/mi — Casi bien. Considera negociar hacia $${d.thresholds?.acceptThreshold?.toFixed(2) || '?'}/mi.`
          : `🟡 $${rpm}/mi — Almost there. Try negotiating to $${d.thresholds?.acceptThreshold?.toFixed(2) || '?'}/mi.`;
        break;

      case 'REJECT':
        lexState = 'sad';
        bubbleMsg = isEs
          ? `❌ $${rpm}/mi — No cubre costos ($${d.thresholds?.cpm?.toFixed(2) || '?'}/mi). Rechaza o negocia fuerte.`
          : `❌ $${rpm}/mi — Below your costs ($${d.thresholds?.cpm?.toFixed(2) || '?'}/mi). Reject or negotiate hard.`;
        break;

      default: // EVALUATE
        lexState = 'warning';
        if (d.isShortHop) {
          bubbleMsg = isEs
            ? `🟠 Viaje corto — Buen RPM pero poca ganancia total. Click para ver si vale la pena.`
            : `🟠 Short hop — Good RPM but low total gain. Click to see if it's worth it.`;
        } else if (d.lowDailyProfit) {
          bubbleMsg = isEs
            ? `🟠 $${rpm}/mi — Ganancia diaria baja. Click para ver alternativas.`
            : `🟠 $${rpm}/mi — Low daily profit. Click to see alternatives.`;
        } else {
          bubbleMsg = isEs
            ? `🟠 $${rpm}/mi — Evalúa con cuidado. Click para análisis detallado.`
            : `🟠 $${rpm}/mi — Evaluate carefully. Click for detailed analysis.`;
        }
        break;
    }

    // Despertar a Lex si está dormido y mostrar burbuja
    setLexState(lexState, { message: bubbleMsg, duration: 7000 });
    debugLog('[LEX-PROACTIVE] Burbuja mostrada:', d.decision, rpm);
  });

  // ==========================================================
  //  FASE 2 AUTOPILOT: Reacciona al cambiar el destino
  //  Muestra el historial del estado ANTES de que el usuario calcule
  // ==========================================================
  let _destDebounce    = null;
  let _lastBubbleState = null; // evitar repetir la misma burbuja

  async function _onDestinationChange(value) {
    if (window.lexChatOpen) return;

    const code = _extractStateCode(value);
    if (!code) { _lastBubbleState = null; return; }

    const profile = await _loadLexProfile();
    if (!profile) return;

    const isEs   = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const avgRPM = profile.avgRPM || 0;

    // Try lane-level stats first (origin→destination)
    const originVal = document.getElementById('origin')?.value || '';
    const origCode  = _extractStateCode(originVal);
    if (origCode && origCode !== code) {
      const laneKey  = `${origCode}→${code}`;
      const laneData = profile.laneStats?.[laneKey];
      if (laneData && laneData.loads >= 2) {
        const bubbleKey = laneKey;
        if (bubbleKey === _lastBubbleState) return;
        _lastBubbleState = bubbleKey;

        const lrpm   = laneData.avgRPM.toFixed(2);
        const isGood = avgRPM > 0 ? laneData.avgRPM >= avgRPM * 0.97 : null;
        let lexSt, msg;
        if (isGood === true) {
          lexSt = 'happy';
          msg = isEs
            ? `✅ ${origCode}→${code}: $${lrpm}/mi promedio — tu carril fuerte (${laneData.loads} cargas)`
            : `✅ ${origCode}→${code}: $${lrpm}/mi avg — one of your strong lanes (${laneData.loads} loads)`;
        } else if (isGood === false) {
          lexSt = 'warning';
          msg = isEs
            ? `⚠️ ${origCode}→${code}: $${lrpm}/mi — carril bajo tu promedio histórico`
            : `⚠️ ${origCode}→${code}: $${lrpm}/mi — lane below your historical avg`;
        } else {
          lexSt = 'thinking';
          msg = isEs
            ? `📊 ${origCode}→${code}: $${lrpm}/mi promedio (${laneData.loads} cargas)`
            : `📊 ${origCode}→${code}: $${lrpm}/mi avg (${laneData.loads} loads)`;
        }
        setLexState(lexSt, { message: msg, duration: 7000 });
        debugLog('[LEX-FASE3] Burbuja carril:', laneKey, lrpm);
        return;
      }
    }

    // Fallback: state-level stats
    if (code === _lastBubbleState) return;
    _lastBubbleState = code;

    const stats = profile.stateStats?.[code];
    if (!stats || stats.loads < 2) return;

    const rpm    = stats.avgRPM.toFixed(2);
    const isGood = avgRPM > 0 ? stats.avgRPM >= avgRPM * 0.97 : null;

    let msg, lexSt;
    if (isGood === true) {
      lexSt = 'happy';
      msg   = isEs
        ? `✅ ${code}: tu RPM promedio ahí es $${rpm}/mi (${stats.loads} cargas)`
        : `✅ ${code}: your avg RPM there is $${rpm}/mi (${stats.loads} loads)`;
    } else if (isGood === false) {
      lexSt = 'warning';
      msg   = isEs
        ? `⚠️ ${code}: $${rpm}/mi promedio — uno de tus estados más bajos`
        : `⚠️ ${code}: $${rpm}/mi avg — one of your lower states`;
    } else {
      lexSt = 'thinking';
      msg   = isEs
        ? `📊 ${code}: $${rpm}/mi promedio (${stats.loads} cargas)`
        : `📊 ${code}: $${rpm}/mi avg (${stats.loads} loads)`;
    }

    const notes = profile.stateNotes?.[code];
    if (notes?.length > 0) msg += ` · "${notes[0]}"`;

    setLexState(lexSt, { message: msg, duration: 7000 });
    debugLog('[LEX-FASE2] Burbuja destino:', code, rpm);
  }

  // Delegación en document — funciona aunque el input sea creado dinámicamente
  document.addEventListener('input', (e) => {
    const id = e.target?.id || '';
    if (!id.startsWith('destinationInput') && id !== 'destination') return;
    clearTimeout(_destDebounce);
    _destDebounce = setTimeout(() => _onDestinationChange(e.target.value), 1200);
  }, true);

});

// ======================================================
// LEX CHAT: Panel pequeño junto a Lex
// ======================================================
window.lexChatOpen = window.lexChatOpen || false;

window.openLexChatModal = function () {
  // Marcar que el chat está abierto
  window.lexChatOpen = true;
  const bubble = document.getElementById('lexBubble');
  if (bubble) bubble.classList.add('hidden');

  // Si ya existe, solo mostrarlo
  let overlay = document.getElementById('lexChatOverlay');
  if (overlay) {
    overlay.style.display = 'block';
    return;
  }

  // NEW: Crear instancia de memoria conversacional
  if (typeof ConversationMemory !== 'undefined') {
    window.lexChatMemory = new ConversationMemory(10);
    debugLog('💭 ConversationMemory created for this chat session');
  } else {
    debugLog('💭 ConversationMemory class not available');
  }

  // Contenedor para colocar el panel (ahora con blur 100% de fondo)
  overlay = document.createElement('div');
  overlay.id = 'lexChatOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = 'rgba(2, 6, 23, 0.6)'; // Fondo oscuro semitransparente (Tailwind slate-950)
  overlay.style.backdropFilter = 'blur(8px)';
  overlay.style.WebkitBackdropFilter = 'blur(8px)';
  overlay.style.pointerEvents = 'auto'; // Capturar clicks para cerrar el modal
  overlay.style.zIndex = '9998';

  // Si hacen click en el fondo borroso oscuro, cerramos el chat
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && typeof window.closeLexChatModal === 'function') {
      window.closeLexChatModal();
    }
  });

  const isMobile = window.innerWidth <= 768;

  // ── Trial banner ─────────────────────────────────────────────────────────
  const _isEsTrial = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
  const _isPremium = window.userPlan?.limits?.hasLex === true;
  const _trialDays = !_isPremium && typeof window.getLexTrialDaysRemaining === 'function'
      ? window.getLexTrialDaysRemaining(window.userPlan)
      : null;
  let _trialBannerHtml = '';
  if (!_isPremium && _trialDays !== null) {
      if (_trialDays >= 0) {
          const _daysLabel = _isEsTrial
              ? `${_trialDays} día${_trialDays !== 1 ? 's' : ''} restantes`
              : `${_trialDays} day${_trialDays !== 1 ? 's' : ''} left`;
          _trialBannerHtml = `<div style="background:rgba(34,197,94,0.08);border-bottom:1px solid rgba(34,197,94,0.2);padding:5px 14px;font-size:11px;color:#4ade80;display:flex;align-items:center;justify-content:space-between;">
              <span>🧪 ${_isEsTrial ? 'Trial gratuito' : 'Free trial'} — ${_daysLabel}</span>
              <a href="plans.html" style="color:#fb923c;text-decoration:none;font-weight:600;">${_isEsTrial ? 'Ver Premium →' : 'Upgrade →'}</a>
          </div>`;
      } else {
          _trialBannerHtml = `<div style="background:rgba(251,146,60,0.08);border-bottom:1px solid rgba(251,146,60,0.2);padding:5px 14px;font-size:11px;color:#fb923c;display:flex;align-items:center;justify-content:space-between;">
              <span>⏱️ ${_isEsTrial ? 'Tu trial de 14 días ha vencido' : 'Your 14-day trial has expired'}</span>
              <a href="plans.html" style="color:#fb923c;text-decoration:none;font-weight:700;">${_isEsTrial ? 'Upgrade →' : 'Upgrade →'}</a>
          </div>`;
      }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Panel de chat responsive
  const panel = document.createElement('div');
  panel.id = 'lexChatPanel';
  panel.style.position = 'fixed';
  if (isMobile) {
    panel.style.left = '0';
    panel.style.right = '0';
    panel.style.bottom = '0';
    panel.style.width = '100%';
    panel.style.height = '82vh'; // fallback
    panel.style.height = '82dvh'; // keyboard-aware: shrinks when keyboard opens
    panel.style.borderRadius = '16px 16px 0 0';
  } else {
    panel.style.right = '2rem';
    panel.style.bottom = '5.5rem';
    panel.style.width = '560px';
    panel.style.height = '82vh';
    panel.style.maxHeight = '780px';
  }
  panel.style.backgroundColor = '#020617';
  panel.style.border = '1px solid #4b5563';
  panel.style.borderRadius = '16px';
  panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.75)';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.overflow = 'hidden';
  panel.style.fontSize = isMobile ? '12px' : '14px';
  panel.style.pointerEvents = 'auto';

  panel.innerHTML = `
    <!-- HEADER CON PESTAÑAS -->
    <div style="
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid #1f2937;
      background: linear-gradient(135deg, #0f172a 0%, #1a0a00 100%);
      border-bottom: 1px solid rgba(251,146,60,0.2);
    ">
      <!-- Top header info -->
      <div style="
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(251,146,60,0.15);
      ">
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #0f172a;
          border: 2px solid #fb923c;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow: 0 0 10px rgba(251,146,60,0.3);
        ">
          <img src="img/lex/lex-neutral.png" alt="Lex"
            style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div style="flex: 1;">
          <div style="font-size: 15px; font-weight: 700; color: #f9fafb; letter-spacing: 0.3px;">
            Lex AI
          </div>
          <div style="font-size: 11px; color: #fb923c; display: flex; align-items: center; gap: 4px;">
            <span style="width:6px; height:6px; border-radius:50%; background:#22c55e; display:inline-block;"></span>
            ${window.i18n?.t('lex.status_active') || 'Asistente activo'}
          </div>
        </div>
        <button
          onclick="window.closeLexChatModal()"
          style="
            border: none;
            background: transparent;
            color: #9ca3af;
            font-size: 16px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >✕</button>
      </div>

      ${_trialBannerHtml}

      <!-- Tabs -->
      <div style="display:flex;gap:2px;padding:4px 8px 0;background:#020617;">
        <button id="lexTabChat" onclick="window.switchLexTab('chat')" style="
          flex:1;padding:8px 12px;border:none;background:transparent;
          color:#fb923c;font-size:14px;font-weight:600;cursor:pointer;
          border-top-left-radius:6px;border-top-right-radius:6px;
          border-bottom:2px solid #fb923c;font-family:Inter,sans-serif;
        ">💬 Chat</button>
        <button id="lexTabAnalisis" onclick="window.switchLexTab('analisis')" style="
          flex:1;padding:8px 12px;border:none;background:transparent;
          color:#9ca3af;font-size:14px;font-weight:600;cursor:pointer;
          border-top-left-radius:6px;border-top-right-radius:6px;
          border-bottom:2px solid transparent;font-family:Inter,sans-serif;
        ">📈 Mi Negocio</button>
        <button id="lexTabFeedback" onclick="window.switchLexTab('feedback')" style="
          flex:0 0 36px;padding:8px 6px;border:none;background:transparent;
          color:#4b5563;font-size:14px;cursor:pointer;
          border-top-left-radius:6px;border-top-right-radius:6px;
          border-bottom:2px solid transparent;font-family:Inter,sans-serif;
          title='Feedback';
        ">⚑</button>
      </div>
    </div>

    <!-- CONTENIDO ANÁLISIS / MI NEGOCIO -->
    <div id="lexContentAnalisis" style="
      flex: 1;
      display: none;
      flex-direction: column;
      overflow: hidden;
    ">
      <!-- Contenido dinámico — se popula automáticamente al abrir -->
      <div id="lexAnalysisContent" style="
        flex: 1;
        overflow-y: auto;
        padding: 10px 10px 0;
      ">
        <div style="text-align:center;padding:20px 0;">
          <div style="font-size:20px;opacity:0.2;">⏳</div>
        </div>
      </div>
      
      <!-- QUICK ACTIONS -->
      <div style="
        padding: 6px 8px;
        border-top: 1px solid #1f2937;
        background-color: #020617;
        display: flex;
        flex-direction: column;
        gap: 4px;
      ">
        <div id="lexMiNegocioActions" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;"></div>
      </div>
    </div>

    <!-- CONTENIDO CHAT -->
    <div id="lexContentChat" style="display: flex; flex: 1; flex-direction: column; overflow: hidden;">
      <!-- MENSAJES -->
      <div
        id="lexChatMessages"
        style="
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background-color: #020617;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        "
      >
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="
            width: 28px;
            height: 28px;
            border-radius: 9999px;
            background: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;
          ">
            <img src="img/lex/lex-neutral.png" alt="Lex"
              style="width: 100%; height: 100%; object-fit: contain;">
          </div>
          <div style="
            background: #030712;
            border: 1px solid #1f2937;
            border-radius: 12px 12px 12px 4px;
            padding: 8px 12px;
            color: #e5e7eb;
            font-size: ${isMobile ? '13px' : '15px'};
            max-width: 85%;
          ">
            <p style="opacity:0.4; font-size:11px;">${window.i18n?.t('lex.chat_loading') || 'Cargando resumen...'}</p>
          </div>
        </div>
      </div>

      <!-- INPUT -->
      <form
        id="lexChatForm"
        style="
          border-top: 1px solid #1f2937;
          padding: 5px 6px;
          padding-bottom: max(5px, env(safe-area-inset-bottom, 5px));
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: #020617;
        "
      >
        <input
          id="lexChatInput"
          type="text"
          placeholder="${window.i18n?.t('lex.placeholder') || 'Ej: RPM de esta carga?'}"
          style="
            flex: 1;
            background-color: #020617;
            color: #e5e7eb;
            padding: ${isMobile ? '6px 10px' : '8px 14px'};
            border-radius: 9999px;
            border: 1px solid #374151;
            outline: none;
            font-size: 16px;
            line-height: 1.4;
          "
        />
        <button
          type="submit"
          style="
            padding: ${isMobile ? '6px 12px' : '8px 18px'};
            border-radius: 9999px;
            border: none;
            background: linear-gradient(135deg, #fb923c, #ea580c);
            color: white;
            font-size: ${isMobile ? '11px' : '13px'};
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(251,146,60,0.3);
          "
        >
          ${window.i18n?.t('lex.btn_send') || 'Enviar'}
        </button>
      </form>
    </div>

    <!-- CONTENIDO FEEDBACK -->
    <div id="lexContentFeedback" style="display: none; flex: 1; flex-direction: column; overflow-y: auto; padding: 12px;">
      <div style="margin-bottom: 14px;">
        <label style="display: block; font-weight: 600; color: #f9fafb; margin-bottom: 6px; font-size: 10px;">
          ${window.i18n?.t('lex.feedback_type_label') || 'Tipo de feedback'}
        </label>
        <select id="lexFeedbackType" style="
          width: 100%;
          padding: 8px;
          border: 1px solid #374151;
          border-radius: 6px;
          font-size: 10px;
          font-family: Inter, sans-serif;
          background: #111827;
          color: #e5e7eb;
        ">
          <option value="bug">${window.i18n?.t('lex.feedback_type_bug') || '🐛 Reportar un error'}</option>
          <option value="feature">${window.i18n?.t('lex.feedback_type_feature') || '💡 Sugerir una mejora'}</option>
          <option value="question">${window.i18n?.t('lex.feedback_type_question') || '❓ Hacer una pregunta'}</option>
          <option value="other">${window.i18n?.t('lex.feedback_type_other') || '💬 Otro'}</option>
        </select>
      </div>

      <div style="margin-bottom: 14px;">
        <label style="display: block; font-weight: 600; color: #f9fafb; margin-bottom: 6px; font-size: 10px;">
          ${window.i18n?.t('lex.feedback_desc_label') || 'Descripción'}
        </label>
        <textarea id="lexFeedbackMessage" rows="4" placeholder="${window.i18n?.t('lex.feedback_placeholder') || 'Cuéntanos qué pasó o qué te gustaría ver...'}" style="
          width: 100%;
          padding: 8px;
          border: 1px solid #374151;
          border-radius: 6px;
          font-size: 10px;
          font-family: Inter, sans-serif;
          resize: vertical;
          background: #111827;
          color: #e5e7eb;
        "></textarea>
      </div>

      <button onclick="window.submitLexFeedback()" style="
        width: 100%;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        font-family: Inter, sans-serif;
      ">
          ${window.i18n?.t('lex.feedback_btn_submit') || '📤 Enviar Feedback'}
      </button>

      <p style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">
          ${window.i18n?.t('lex.feedback_note') || 'Tu feedback nos ayuda a mejorar la app'}
      </p>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Popula Mi Negocio tab en background
  populateAnalysisTab();
  window.addEventListener('lexGoalUpdated', () => populateAnalysisTab());

  // Mensaje de apertura: Lex ya tiene algo que decir
  setTimeout(async () => {
    try {
      const uid = window.currentUser?.uid;
      if (!uid) return;
      const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
      const cargaActiva = window._lastDecisionData;

      // ── CASO A: hay carga en calculadora → Lex analiza y opina ───────────
      if (cargaActiva?.actualRPM && cargaActiva?.totalMiles
          && typeof window.analyzeLoadWithLearning === 'function') {

        const dest = document.getElementById('destinationInput_0')?.value
                  || document.getElementById('destination')?.value
                  || cargaActiva.destination || '';
        const origin = document.getElementById('origin')?.value || '';

        const analysis = await window.analyzeLoadWithLearning({
          rpm:              cargaActiva.actualRPM,
          destinationState: cargaActiva.destinationState,
          destination:      dest,
          totalMiles:       cargaActiva.totalMiles
        });

        if (analysis) {
          // Marcar intent para chips contextuales
          window._lastLexIntent = analysis.color === 'red'    ? 'LOAD_REJECT'
                                : analysis.color === 'green'  ? 'LOAD_ACCEPT'
                                : 'LOAD_EVALUATE';

          // Construir mensaje de Lex como copilot — no como reporte
          const isGood   = analysis.color === 'green';
          const isBad    = analysis.color === 'red';
          const routeStr = (origin && dest) ? `**${origin} → ${dest}**` : (dest || '');
          const rpm      = Number(cargaActiva.actualRPM).toFixed(2);
          const profit   = Number(analysis.estimatedProfit || 0).toFixed(0);

          let stateCtx = '';
          if (analysis.vsStateAvg !== null && analysis.destState) {
            const stNum  = parseFloat(analysis.vsStateAvg) || 0;
            const stSign = stNum >= 0 ? '+' : '';
            stateCtx = isEs
              ? ` En **${analysis.destState}** tienes ${analysis.stateExperience || 'historial'} — esta carga está **${stSign}${stNum.toFixed(1)}%** vs tu promedio allí.`
              : ` In **${analysis.destState}** you have ${analysis.stateExperience || 'history'} — this load is **${stSign}${stNum.toFixed(1)}%** vs your avg there.`;
          }

          let reasonText = '';
          if (analysis.reasons?.length) {
            reasonText = '\n\n' + analysis.reasons.slice(0, 2).map(r => `• ${r}`).join('\n');
          }

          let actionLine = '';
          if (isBad) {
            const minRPM = Number(analysis.yourAvgRPM || cargaActiva.actualRPM * 1.3).toFixed(2);
            const minTotal = Math.ceil(minRPM * cargaActiva.totalMiles);
            actionLine = isEs
              ? `\n\n💡 **Contraoferta mínima:** $${minRPM}/mi (~$${minTotal.toLocaleString()} total). ¿Quieres el script exacto para el dispatcher?`
              : `\n\n💡 **Minimum counter:** $${minRPM}/mi (~$${minTotal.toLocaleString()} total). Want the exact script for the dispatcher?`;
          } else if (isGood) {
            actionLine = isEs
              ? `\n\n✅ Esta carga cumple. Acepta con confianza.`
              : `\n\n✅ This load checks out. Accept with confidence.`;
          } else {
            actionLine = isEs
              ? `\n\n⚖️ Está en zona gris. ¿Te ayudo a decidir si negociar o rechazar?`
              : `\n\n⚖️ This one's in the gray zone. Want help deciding whether to negotiate or reject?`;
          }

          const msg = isEs
            ? `Veo que estás evaluando${routeStr ? ' ' + routeStr : ''} a **$${rpm}/mi** (${cargaActiva.totalMiles} mi).${stateCtx}\n\n**${analysis.recommendation}** — Ganancia estimada: **$${profit}**${reasonText}${actionLine}`
            : `I see you're evaluating${routeStr ? ' ' + routeStr : ''} at **$${rpm}/mi** (${cargaActiva.totalMiles} mi).${stateCtx}\n\n**${analysis.recommendation}** — Est. profit: **$${profit}**${reasonText}${actionLine}`;

          if (typeof appendLexMessage === 'function') appendLexMessage(msg);
        }
        _populateMiNegocioActions(isEs, analysis?.color);
        return;
      }

      // ── CASO 0: Alertas proactivas de Lex (Phase 5) ──────────────────────
      try {
        const alertSnap = await firebase.firestore().collection('alerts').doc(uid).get();
        if (alertSnap.exists) {
          const items = alertSnap.data().items || [];
          const unread = items.filter(a => !a.read);
          if (unread.length > 0) {
            for (const alert of unread) {
              let alertMsg = '';
              if (alert.type === 'no_loads') {
                alertMsg = isEs
                  ? `⚡ Llevas más de 2 días sin registrar una carga. ¿Todo bien? Registra tu próxima carga y te doy análisis completo.`
                  : `⚡ You haven't logged a load in over 2 days. Everything ok? Log your next load and I'll give you a full breakdown.`;
              } else if (alert.type === 'rpm_drop') {
                alertMsg = isEs
                  ? `📉 Tu RPM esta semana ($${alert.avgThisWeek}/mi) bajó **${alert.dropPct}%** vs la semana pasada ($${alert.avgLastWeek}/mi). ¿Quieres que revisemos qué está pasando?`
                  : `📉 Your RPM this week ($${alert.avgThisWeek}/mi) dropped **${alert.dropPct}%** vs last week ($${alert.avgLastWeek}/mi). Want me to look into what's happening?`;
              }
              if (alertMsg && typeof appendLexMessage === 'function') appendLexMessage(alertMsg);
            }
            // Marcar como leídas
            const updated = items.map(a => ({ ...a, read: true }));
            firebase.firestore().collection('alerts').doc(uid).update({ items: updated }).catch(() => {});
          }
        }
      } catch (_e) { /* no interrumpir el flujo normal */ }

      // ── CASO B: sin carga → briefing del negocio ─────────────────────────
      window._lastLexIntent = 'DEFAULT';
      const now      = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const hora     = now.getHours();
      const saludo   = isEs
        ? (hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches')
        : (hora < 12 ? 'Good morning' : hora < 18 ? 'Good afternoon' : 'Good evening');

      const [loadsSnap, profileSnap, recentSnap] = await Promise.all([
        firebase.firestore().collection('loads')
          .where('userId', '==', uid)
          .where('date', '>=', firstDay.toISOString().split('T')[0]).get(),
        firebase.firestore().collection('lexProfiles').doc(uid).get(),
        firebase.firestore().collection('loads')
          .where('userId', '==', uid).orderBy('date', 'desc').limit(7).get()
      ]);

      const p = profileSnap.data() || {};
      let ingresos = 0, millas = 0;
      loadsSnap.forEach(d => { ingresos += d.data().totalCharge || 0; millas += d.data().totalMiles || 0; });

      const rpmMes = millas > 0 ? ingresos / millas : 0;
      const avgRPM = p.avgRPM || 0;
      const diffPct = avgRPM > 0 ? (((rpmMes - avgRPM) / avgRPM) * 100) : null;

      // Racha de cargas
      let rachaText = '';
      if (avgRPM > 0 && recentSnap.size >= 3) {
        const rpms = [];
        recentSnap.forEach(d => {
          const dat = d.data();
          rpms.push((dat.totalCharge || 0) / (dat.totalMiles || 1));
        });
        const dir = rpms[0] >= avgRPM ? 'above' : 'below';
        let streak = 0;
        for (const r of rpms) { if ((r >= avgRPM ? 'above' : 'below') === dir) streak++; else break; }
        if (dir === 'above' && streak >= 2)
          rachaText = isEs ? ` 🔥 Llevas **${streak} cargas seguidas** sobre tu promedio.` : ` 🔥 **${streak}-load streak** above your avg.`;
        else if (dir === 'below' && streak >= 3)
          rachaText = isEs ? ` ⚠️ Las últimas **${streak} cargas** estuvieron bajo tu promedio.` : ` ⚠️ Last **${streak} loads** below your avg.`;
      }

      // Tendencia
      const tendenciaLine = diffPct === null ? ''
        : parseFloat(diffPct) >= 0
          ? (isEs ? ` 📈 RPM este mes: **+${diffPct.toFixed(1)}%** vs tu histórico.` : ` 📈 RPM this month: **+${diffPct.toFixed(1)}%** vs your avg.`)
          : (isEs ? ` 📉 RPM este mes: **${diffPct.toFixed(1)}%** vs tu histórico.` : ` 📉 RPM this month: **${diffPct.toFixed(1)}%** vs your avg.`);

      const mesNombre = now.toLocaleString(isEs ? 'es' : 'en-US', { month: 'long' });
      const msg = isEs
        ? `${saludo} 👋 — ${mesNombre}: **${loadsSnap.size} cargas**, $${ingresos.toFixed(0)} en ingresos.${tendenciaLine}${rachaText}\n\n¿Tienes una carga para evaluar o en qué te ayudo?`
        : `${saludo} 👋 — ${mesNombre}: **${loadsSnap.size} loads**, $${ingresos.toFixed(0)} revenue.${tendenciaLine}${rachaText}\n\nDo you have a load to evaluate, or how can I help?`;

      if (typeof appendLexMessage === 'function') appendLexMessage(msg);
      _populateMiNegocioActions(isEs, null);

      // Briefing semanal una vez por semana
      setTimeout(() => {
        if (typeof window.lexRunWeeklyBriefing === 'function') window.lexRunWeeklyBriefing();
      }, 1200);

    } catch (e) {
      debugLog('[LEX] Error en mensaje de apertura:', e);
    }
  }, 600);

  // Genera los botones contextuales del tab Mi Negocio
  function _populateMiNegocioActions(isEs, color) {
    const grid = document.getElementById('lexMiNegocioActions');
    if (!grid) return;

    let btns;
    if (color === 'red') {
      btns = isEs
        ? [['✍️ Script para dispatcher', '¿Cuánto pedir y cómo decírselo al dispatcher?'],
           ['💸 ¿Cuánto es el mínimo?', '¿Cuál es el precio mínimo que debo aceptar para no perder?'],
           ['🗺️ ¿Qué zona es mejor?', '¿Qué zona me conviene más ahora mismo?'],
           ['📅 ¿Cómo va mi mes?', '¿Cómo va mi mes y qué necesito para mejorar?']]
        : [['✍️ Dispatcher script', 'How much to ask and what to say to the dispatcher?'],
           ['💸 What\'s my minimum?', 'What is the minimum I should accept to not lose money?'],
           ['🗺️ Better lanes?', 'What lanes are better for me right now?'],
           ['📅 How\'s my month?', 'How is my month going and what do I need to improve?']];
    } else if (color === 'green') {
      btns = isEs
        ? [['⛽ ¿Hay alertas de ruta?', '¿Hay alertas de clima o tráfico para este viaje?'],
           ['📝 Registrar esta carga', 'Ayúdame a registrar esta carga'],
           ['🎯 ¿Qué sigue?', '¿Qué debo hacer después de esta carga para optimizar?'],
           ['📅 ¿Cómo va mi mes?', '¿Cómo va mi mes y qué tan bien estoy haciendo?']]
        : [['⛽ Route alerts?', 'Are there weather or traffic alerts for this trip?'],
           ['📝 Log this load', 'Help me log this load'],
           ['🎯 What\'s next?', 'What should I do after this load to optimize?'],
           ['📅 How\'s my month?', 'How is my month going and how am I doing?']];
    } else if (color === 'yellow') {
      btns = isEs
        ? [['⚖️ ¿Negocio o rechazo?', '¿Vale la pena negociar esta carga o la rechazo directamente?'],
           ['💰 ¿Cuánto contraoferta?', '¿Cuánto debería pedir de contraoferta para que valga la pena?'],
           ['📊 Compara con historial', '¿Cómo se compara esta carga con mis cargas anteriores?'],
           ['🗺️ ¿Hay algo mejor?', '¿Hay mejores oportunidades de carga en este momento?']]
        : [['⚖️ Negotiate or reject?', 'Is it worth negotiating this load or should I reject?'],
           ['💰 Counter offer?', 'How much should I counter to make this load worth it?'],
           ['📊 Compare to history', 'How does this load compare to my previous loads?'],
           ['🗺️ Better options?', 'Are there better load opportunities right now?']];
    } else {
      btns = isEs
        ? [['📅 ¿Cómo va mi mes?', '¿Cómo va mi mes comparado con el anterior?'],
           ['🏆 ¿Mis mejores zonas?', '¿Cuáles son mis mejores zonas históricamente?'],
           ['⚠️ ¿Qué zonas evitar?', '¿Qué zonas o estados debo evitar ahora mismo?'],
           ['🧠 Analiza mi historial', 'Analiza mi historial de cargas y dame 3 insights']]
        : [['📅 How\'s my month?', 'How is my month compared to last month?'],
           ['🏆 Best lanes?', 'What are my best lanes historically?'],
           ['⚠️ Zones to avoid?', 'What zones or states should I avoid right now?'],
           ['🧠 Analyze my history', 'Analyze my load history and give me 3 insights']];
    }

    const btnStyle = [
      'padding:11px 10px', 'border-radius:6px', 'border:1px solid #1f2937',
      'background:#0a0f1a', 'color:#d1d5db', 'font-size:13px', 'font-weight:500',
      'cursor:pointer', 'transition:all 0.15s', 'font-family:Inter,sans-serif',
      'text-align:left', 'line-height:1.3'
    ].join(';');

    window._lexMiNegocioQueries = btns.map(([, q]) => q);
    grid.innerHTML = btns.map(([label], idx) => `
      <button style="${btnStyle}"
        onmouseenter="this.style.borderColor='#374151';this.style.color='#f9fafb'"
        onmouseleave="this.style.borderColor='#1f2937';this.style.color='#d1d5db'"
        onclick="window._lexMiNegocioAction(${idx})">
        ${label}
      </button>`).join('');
  }

  window._lexMiNegocioAction = function(idx) {
    const query = (window._lexMiNegocioQueries || [])[idx];
    if (!query) return;
    window.switchLexTab('chat');
    setTimeout(() => {
      if (typeof appendUserMessage === 'function') appendUserMessage(query);
      if (typeof scrollToBottom === 'function') scrollToBottom();
      if (typeof window.handleLexChatMessage === 'function') {
        window.handleLexChatMessage(query).catch(e => debugLog('[LEX-ACTION] Error:', e));
      }
    }, 150);
  };

  const form = document.getElementById('lexChatForm');
  const input = document.getElementById('lexChatInput');
  const messages = document.getElementById('lexChatMessages');

  function parseMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function appendUserMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'flex-end';
    wrapper.style.alignItems = 'flex-start';
    wrapper.style.gap = '6px';
    wrapper.innerHTML = `
      <div
        style="
          background: linear-gradient(135deg, #fb923c, #ea580c);
          border-radius: 12px 12px 4px 12px;
          padding: 7px 12px;
          color: #f9fafb;
          font-size: 15px;
          line-height: 1.6;
          max-width: 85%;
        "
      >
        <p>${parseMarkdown(text)}</p>
      </div>
    `;
    messages.appendChild(wrapper);
  }

  function appendLexMessage(text) {
    // Remover placeholder inicial ("Cargando resumen..." / "Loading summary...")
    const messages = document.getElementById('lexChatMessages');
    const primero = messages?.children[0];
    const primeroText = primero?.textContent?.trim() || '';
    if (primeroText.includes('Cargando') || primeroText.includes('Loading')) primero.remove();

    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

    // ── Suggestion Chips — contextuales según el último intent ──────────
    const chipSets = {
      NEGOTIATION: isEs
        ? [['📊 Analizar carga', 'Analiza la carga actual'],
           ['✅ ¿Lo acepto así?', '¿Vale la pena aceptar esta carga sin negociar?'],
           ['🔄 ¿Qué Plan B tengo?', '¿Qué hago si rechazan mi contraoferta?']]
        : [['📊 Analyze load', 'Analyze the current load'],
           ['✅ Accept as is?', 'Is it worth accepting this load without negotiating?'],
           ['🔄 What is my Plan B?', 'What do I do if they reject my counteroffer?']],

      PRICING: isEs
        ? [['🤝 ¿Cómo negocio?', '¿Cómo negocio esta carga?'],
           ['📍 Stats del destino', '¿Cómo me ha ido en el estado de destino?'],
           ['📈 ¿Cómo va mi mes?', '¿Cómo va mi mes?']]
        : [['🤝 How do I negotiate?', 'How do I negotiate this load?'],
           ['📍 Destination stats', 'How have I done in the destination state?'],
           ['📈 How is my month?', 'How is my month going?']],

      FINANCES: isEs
        ? [['🏆 Mejores estados', '¿Cuáles son mis mejores estados?'],
           ['📉 Zonas a evitar', '¿Qué zonas debo evitar?'],
           ['📊 Analizar carga actual', 'Analiza la carga actual']]
        : [['🏆 Best states', 'What are my best states?'],
           ['📉 Zones to avoid', 'What zones should I avoid?'],
           ['📊 Analyze load', 'Analyze the current load']],

      STATE_SUMMARY: isEs
        ? [['📊 Analizar carga actual', 'Analiza la carga actual'],
           ['💰 ¿Cómo va mi mes?', '¿Cómo va mi mes?'],
           ['🤝 Ayúdame a negociar', '¿Cómo negocio esta carga?']]
        : [['📊 Analyze current load', 'Analyze the current load'],
           ['💰 How is my month?', 'How is my month going?'],
           ['🤝 Help me negotiate', 'How do I negotiate this load?']],

      LOAD_REJECT: isEs
        ? [['✍️ Script para dispatcher', '¿Cuánto pedir y cómo decírselo al dispatcher?'],
           ['💸 ¿Cuánto es el mínimo?', '¿Cuál es el precio mínimo que debo aceptar para no perder?'],
           ['🗺️ ¿Qué zona es mejor?', '¿Qué zona me conviene más ahora mismo?']]
        : [['✍️ Dispatcher script', 'How much to ask and what to say to the dispatcher?'],
           ['💸 What\'s my floor?', 'What is the minimum I should accept to not lose money?'],
           ['🗺️ Better lanes?', 'What lanes are better for me right now?']],

      LOAD_ACCEPT: isEs
        ? [['⛽ ¿Alertas de ruta?', '¿Hay alertas de clima o tráfico para este viaje?'],
           ['📝 Registrar carga', 'Ayúdame a registrar esta carga'],
           ['🎯 ¿Qué sigue?', '¿Qué debo hacer después de esta carga para optimizar?']]
        : [['⛽ Route alerts?', 'Are there weather or traffic alerts for this trip?'],
           ['📝 Log this load', 'Help me log this load'],
           ['🎯 What\'s next?', 'What should I do after this load to optimize?']],

      LOAD_EVALUATE: isEs
        ? [['⚖️ ¿Negocio o rechazo?', '¿Vale la pena negociar esta carga o la rechazo directamente?'],
           ['💰 ¿Cuánto contraoferta?', '¿Cuánto debería pedir de contraoferta para que valga la pena?'],
           ['📊 Compara con historial', '¿Cómo se compara esta carga con mis cargas anteriores?']]
        : [['⚖️ Negotiate or reject?', 'Is it worth negotiating this load or should I reject?'],
           ['💰 Counter offer?', 'How much should I counter to make this load worth it?'],
           ['📊 Compare to history', 'How does this load compare to my previous loads?']],

      DEFAULT: isEs
        ? [['📅 ¿Cómo va mi mes?', '¿Cómo va mi mes comparado con el anterior?'],
           ['🏆 Mis mejores zonas', '¿Cuáles son mis mejores zonas históricamente?'],
           ['🧠 Analiza mi historial', 'Analiza mi historial de cargas y dame 3 insights clave']]
        : [['📅 How\'s my month?', 'How is my month compared to last month?'],
           ['🏆 Best lanes', 'What are my best lanes historically?'],
           ['🧠 Analyze my history', 'Analyze my load history and give me 3 key insights']]
    };

    const intentKey = window._lastLexIntent || 'DEFAULT';
    const chips = chipSets[intentKey] || chipSets.DEFAULT;

    // ── HTML del mensaje ─────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:column; gap:4px; margin-bottom:2px;';

    // Contenedor del mensaje + avatar
    const msgRow = document.createElement('div');
    msgRow.style.cssText = 'display:flex; align-items:flex-start; gap:6px; position:relative;';
    msgRow.innerHTML = `
      <div style="
        width: 20px; height: 20px; border-radius: 9999px;
        background: #0f172a; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0; overflow: hidden;
      ">
        <img src="img/lex/lex-neutral.png" alt="Lex"
          style="width: 100%; height: 100%; object-fit: contain;"
          onerror="this.src='img/lex/lex-neutral.png'">
      </div>
      <div class="lex-msg-bubble" style="
        position: relative;
        background: #030712; border: 1px solid #1f2937;
        border-radius: 12px 12px 12px 4px;
        padding: 5px 8px; color: #e5e7eb;
        font-size: 15px; line-height: 1.6; max-width: 85%;
      ">
        <p>${parseMarkdown(text)}</p>
        <button
          title="${isEs ? 'Copiar' : 'Copy'}"
          data-rawtext=""
          style="
            position: absolute; top: 4px; right: 6px;
            background: none; border: none; cursor: pointer;
            font-size: 11px; color: #6b7280; padding: 0;
            opacity: 0; transition: opacity 0.2s;
            line-height: 1;
          "
          class="lex-copy-btn"
        >📋</button>
      </div>
    `;

    // Guardar rawtext y vincular lógica del botón copiar
    const bubble = msgRow.querySelector('.lex-msg-bubble');
    const copyBtn = msgRow.querySelector('.lex-copy-btn');
    copyBtn._rawText = text; // referencia directa para evitar problemas de escaping en innerHTML
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(this._rawText).then(() => {
        this.textContent = '✅';
        this.style.color = '#22c55e';
        setTimeout(() => { this.textContent = '📋'; this.style.color = '#6b7280'; }, 2000);
      }).catch(() => {
        this.textContent = '⚠️';
        setTimeout(() => { this.textContent = '📋'; }, 2000);
      });
    });
    bubble.addEventListener('mouseenter', () => { copyBtn.style.opacity = '1'; });
    bubble.addEventListener('mouseleave', () => { copyBtn.style.opacity = '0'; });

    wrapper.appendChild(msgRow);

    // ── Suggestion Chips ─────────────────────────────────────────────────
    const chipsRow = document.createElement('div');
    chipsRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:5px; padding-left:26px; margin-top:2px;';

    chips.forEach(([label, query]) => {
      const chip = document.createElement('button');
      chip.textContent = label;
      chip.style.cssText = [
        'background:#0f172a', 'border:1px solid #374151',
        'color:#9ca3af', 'font-size:13px', 'padding:6px 13px',
        'border-radius:9999px', 'cursor:pointer',
        'transition:all 0.15s', 'font-family:Inter,sans-serif',
        'white-space:nowrap'
      ].join(';');
      chip.onmouseenter = () => { chip.style.borderColor = '#fb923c'; chip.style.color = '#fb923c'; };
      chip.onmouseleave = () => { chip.style.borderColor = '#374151'; chip.style.color = '#9ca3af'; };
      chip.addEventListener('click', async () => {
        chipsRow.style.display = 'none';
        appendUserMessage(query);
        scrollToBottom();
        if (typeof window.handleLexChatMessage === 'function') {
          try {
            await window.handleLexChatMessage(query);
          } catch (e) {
            debugLog('[LEX-CHIP] Error:', e);
          }
        }
      });
      chipsRow.appendChild(chip);
    });

    wrapper.appendChild(chipsRow);
    messages.appendChild(wrapper);
  }


  // 🔹 Hacemos disponible esta función para el router
  window.lexChatAddBotMessage = appendLexMessage;

  // 🔗 Hacer accesible la respuesta de Lex para otros módulos (router)
  window.appendLexMessageFromRouter = function (text) {
    appendLexMessage(text);

    // NEW: Add Lex response to memory
    if (window.lexChatMemory && typeof window.lexChatMemory.addMessage === 'function') {
      window.lexChatMemory.addMessage('lex', text);
    }

    scrollToBottom();
  };

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  // 🔗 AQUÍ CONECTAMOS CON LA LÓGICA INTERNA/EXTERNA (ROUTER)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendUserMessage(text);
    scrollToBottom();
    input.value = '';

    // NEW: Add user message to memory
    if (window.lexChatMemory && typeof window.lexChatMemory.addMessage === 'function') {
      window.lexChatMemory.addMessage('user', text);
    }

    if (typeof window.handleLexChatMessage === 'function') {
      try {
        await window.handleLexChatMessage(text);
        // Aquí podríamos hacer que handleLexChatMessage llame a otra función
        // para generar texto y luego usar appendLexMessage(...)
      } catch (err) {
        debugLog('[LEX CHAT] Error procesando mensaje:', err);
        appendLexMessage(window.i18n?.t('lex.error_processing') || 'Hubo un error procesando tu pregunta. 😕');
      }
    } else {
      debugLog('[LEX CHAT] handleLexChatMessage no está definido');
      appendLexMessage(window.i18n?.t('lex.logic_not_connected') || 'Aún no tengo conectada mi lógica interna/externa, pero ya leo tus mensajes. 😉');
    }

    scrollToBottom();
  });

  // ============================================================
  //  FASE 1 AUTOPILOT — Contenido dinámico de la pestaña Análisis
  // ============================================================

  async function populateAnalysisTab() {
    const container = document.getElementById('lexAnalysisContent');
    if (!container) return;
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

    container.innerHTML = `<div style="text-align:center;padding:20px 0;color:#4b5563;font-size:12px;">
      <div style="font-size:18px;opacity:0.25;margin-bottom:4px;">📈</div>
      <span>${isEs ? 'Cargando...' : 'Loading...'}</span>
    </div>`;

    try {
      const uid = window.currentUser?.uid;
      if (!uid) { container.innerHTML = ''; return; }

      const now        = new Date();
      const firstCur   = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstPrev  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastPrev   = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const mesLabel   = now.toLocaleString(isEs ? 'es' : 'en-US', { month: 'long', year: 'numeric' });

      const [curSnap, prevSnap, profileSnap] = await Promise.all([
        firebase.firestore().collection('loads').where('userId','==',uid)
          .where('date','>=',firstCur.toISOString().split('T')[0]).get(),
        firebase.firestore().collection('loads').where('userId','==',uid)
          .where('date','>=',firstPrev.toISOString().split('T')[0])
          .where('date','<', lastPrev.toISOString().split('T')[0]).get(),
        firebase.firestore().collection('lexProfiles').doc(uid).get()
      ]);

      let curRev=0, curMi=0, prevRev=0, prevMi=0, belowSurvival=0;
      curSnap.forEach(d => {
        const dat = d.data();
        curRev += dat.totalCharge || 0;
        curMi  += dat.totalMiles  || 0;
        const p = profileSnap.data() || {};
        const loadRPM = (dat.totalCharge||0) / (dat.totalMiles||1);
        if (p.minSafeRPM && loadRPM < p.minSafeRPM) belowSurvival++;
      });
      prevSnap.forEach(d => { const dat=d.data(); prevRev+=dat.totalCharge||0; prevMi+=dat.totalMiles||0; });

      const p       = profileSnap.data() || {};
      const curRPM  = curMi  > 0 ? curRev  / curMi  : 0;
      const prevRPM = prevMi > 0 ? prevRev / prevMi  : 0;

      // Proyección: pace actual extrapolado al mes completo
      const pace        = daysPassed > 0 ? curRev / daysPassed : 0;
      const projection  = Math.round(pace * daysInMonth);
      const daysLeft    = daysInMonth - daysPassed;
      const projDiff    = prevRev > 0 ? ((projection - prevRev) / prevRev * 100).toFixed(1) : null;

      // Mejor zona este mes (desde stateStats)
      const stateEntries = Object.entries(p.stateStats || {})
        .filter(([,s]) => s.loads >= 2).sort(([,a],[,b]) => b.avgRPM - a.avgRPM);
      const bestZone = stateEntries[0];

      const rpmVsPrev = prevRPM > 0 ? (((curRPM - prevRPM) / prevRPM) * 100).toFixed(1) : null;
      const rpmColor  = rpmVsPrev === null ? '#9ca3af'
                      : parseFloat(rpmVsPrev) >= 0 ? '#4ade80' : '#f87171';
      const rpmSign   = rpmVsPrev && parseFloat(rpmVsPrev) >= 0 ? '+' : '';

      const projColor = projDiff === null ? '#9ca3af'
                      : parseFloat(projDiff) >= 0 ? '#4ade80' : '#f87171';
      const projSign  = projDiff && parseFloat(projDiff) >= 0 ? '+' : '';

      // Goal tracking helpers
      const goal = p.monthlyGoal || 0;
      const goalPct  = goal > 0 ? Math.min(100, Math.round(curRev / goal * 100)) : 0;
      const onTrack  = goal > 0 && projection >= goal;
      const remaining = goal > 0 ? Math.max(0, goal - curRev) : 0;
      const neededPerDay = goal > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;

      container.innerHTML = `
        <!-- Header mes -->
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding:0 2px;">
          📅 ${mesLabel}
        </div>

        <!-- Goal tracking card -->
        ${goal > 0 ? `
        <div style="background:#080f1f;border:1px solid rgba(251,146,60,0.25);border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="color:#fb923c;font-weight:600;font-size:13px;">🎯 ${isEs ? 'Meta mensual' : 'Monthly goal'}</div>
            <div style="color:#9ca3af;font-size:12px;">$${Math.round(curRev).toLocaleString()} / $${goal.toLocaleString()}</div>
          </div>
          <div style="background:#1f2937;border-radius:4px;height:8px;margin-bottom:8px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#f59e0b,#fb923c);height:100%;width:${goalPct}%;border-radius:4px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:5px;">
            <div style="color:${onTrack ? '#4ade80' : '#f87171'};">
              ${onTrack
                ? (isEs ? '✅ En camino' : '✅ On track')
                : (isEs ? `⚠️ Necesitas $${neededPerDay.toLocaleString()}/día` : `⚠️ Need $${neededPerDay.toLocaleString()}/day`)}
            </div>
            <div style="color:#6b7280;">${goalPct}%</div>
          </div>
          <div style="font-size:12px;color:#6b7280;">
            ${isEs ? 'Proyección' : 'Projection'}: <strong style="color:${onTrack ? '#4ade80' : '#f87171'};">$${projection.toLocaleString()}</strong>
            &nbsp;·&nbsp; ${isEs ? 'Meta' : 'Goal'}: <strong style="color:#fb923c;">$${goal.toLocaleString()}</strong>
          </div>
        </div>` : `
        <div onclick="window.switchLexTab('chat')" style="background:#080f1f;border:1px dashed #374151;border-radius:8px;padding:10px 13px;margin-bottom:10px;font-size:12px;color:#6b7280;text-align:center;cursor:pointer;">
          🎯 ${isEs ? 'Sin meta mensual — escríbele a Lex: "mi meta es $8,000"' : 'No monthly goal — tell Lex: "my goal is $8,000"'}
        </div>`}

        <!-- Card principal: mes actual vs anterior -->
        <div style="background:#0a0f1a;border:1px solid #1f2937;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-bottom:10px;">
            <div style="background:#020617;border-radius:6px;padding:10px 12px;">
              <div style="color:#6b7280;margin-bottom:4px;">${isEs?'Cargas':'Loads'}</div>
              <div style="font-weight:700;color:#e5e7eb;font-size:22px;">${curSnap.size}</div>
              ${prevSnap.size > 0 ? `<div style="font-size:12px;color:#6b7280;">${isEs?'Ant':'Prev'}: ${prevSnap.size}</div>` : ''}
            </div>
            <div style="background:#020617;border-radius:6px;padding:10px 12px;">
              <div style="color:#6b7280;margin-bottom:4px;">${isEs?'Ingresos':'Revenue'}</div>
              <div style="font-weight:700;color:#4ade80;font-size:22px;">$${curRev.toFixed(0)}</div>
              ${prevRev > 0 ? `<div style="font-size:12px;color:#6b7280;">${isEs?'Ant':'Prev'}: $${prevRev.toFixed(0)}</div>` : ''}
            </div>
          </div>
          ${curRPM > 0 ? `
          <div style="background:#020617;border-radius:6px;padding:10px 12px;font-size:13px;">
            <div style="color:#6b7280;margin-bottom:4px;">RPM ${isEs?'este mes':'this month'}</div>
            <div style="font-weight:700;color:#fb923c;font-size:17px;">$${curRPM.toFixed(3)}/mi
              ${rpmVsPrev !== null ? `<span style="font-size:12px;color:${rpmColor};margin-left:6px;">${rpmSign}${rpmVsPrev}% ${isEs?'vs mes ant.':'vs last month'}</span>` : ''}
            </div>
          </div>` : ''}
        </div>

        <!-- Proyección -->
        ${pace > 0 ? `
        <div style="background:#080f1f;border:1px solid rgba(96,165,250,0.15);border-radius:8px;padding:11px 13px;margin-bottom:10px;font-size:13px;">
          <div style="color:#60a5fa;font-weight:600;margin-bottom:4px;">🎯 ${isEs?'Proyección del mes':'Month projection'}</div>
          <div style="color:#e5e7eb;">
            ${isEs?'Al ritmo actual terminas en':'At current pace you finish at'}
            <strong style="color:${projColor};">$${projection.toLocaleString()}</strong>
            ${projDiff !== null ? `<span style="color:${projColor};">(${projSign}${projDiff}% ${isEs?'vs mes ant.':'vs last month'})</span>` : ''}
          </div>
          <div style="color:#6b7280;margin-top:3px;font-size:12px;">${daysLeft} ${isEs?'días restantes':'days left'}</div>
        </div>` : ''}

        <!-- Alerta cargas por debajo de supervivencia -->
        ${belowSurvival > 0 ? `
        <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:11px 13px;margin-bottom:10px;font-size:13px;">
          <div style="color:#f87171;font-weight:600;margin-bottom:3px;">⚠️ ${isEs?'Alerta':'Alert'}</div>
          <div style="color:#fca5a5;">
            ${isEs
              ? `${belowSurvival} carga${belowSurvival>1?'s':''} este mes ${belowSurvival>1?'estuvieron':'estuvo'} por debajo de tu línea de supervivencia. Cada una te costó dinero.`
              : `${belowSurvival} load${belowSurvival>1?'s':''} this month went below your survival line. Each one cost you money.`}
          </div>
        </div>` : ''}

        <!-- Mejor zona -->
        ${bestZone ? `
        <div style="background:#080f1f;border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:11px 13px;font-size:13px;margin-bottom:10px;">
          <div style="color:#4ade80;font-weight:600;margin-bottom:3px;">🏆 ${isEs?'Tu mejor zona (histórico)':'Your best zone (historical)'}</div>
          <div style="color:#e5e7eb;"><strong>${bestZone[0]}</strong> — $${bestZone[1].avgRPM.toFixed(2)}/mi
            <span style="color:#6b7280;">(${bestZone[1].loads} ${isEs?'cargas':'loads'})</span>
          </div>
        </div>` : ''}

        ${(() => {
          // Patrones inteligentes: mejor carril + mejor día
          const laneEntries = Object.entries(p.laneStats || {}).filter(([,s]) => s.loads >= 2);
          const sortedLanes = [...laneEntries].sort(([,a],[,b]) => b.avgRPM - a.avgRPM);
          const topLane   = sortedLanes[0];
          const worstLane = sortedLanes[sortedLanes.length - 1];

          const DOW_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const DOW_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
          const dowEntries = Object.entries(p.dayOfWeekStats || {}).filter(([,s]) => s.loads >= 2);
          const bestDow = dowEntries.sort(([,a],[,b]) => b.avgRPM - a.avgRPM)[0];

          if (!topLane && !bestDow) return '';

          const topLaneHtml = topLane ? `
            <div style="margin-bottom:6px;">
              <span style="color:#6b7280;font-size:12px;">${isEs?'Mejor carril':'Best lane'}</span><br>
              <strong style="color:#e5e7eb;">${topLane[0]}</strong>
              <span style="color:#4ade80;margin-left:6px;">$${topLane[1].avgRPM.toFixed(2)}/mi</span>
              <span style="color:#6b7280;font-size:12px;"> (${topLane[1].loads} ${isEs?'cargas':'loads'})</span>
            </div>` : '';

          const worstLaneHtml = worstLane && worstLane[0] !== topLane?.[0] ? `
            <div style="margin-bottom:6px;">
              <span style="color:#6b7280;font-size:12px;">${isEs?'Carril a evitar':'Lane to avoid'}</span><br>
              <strong style="color:#e5e7eb;">${worstLane[0]}</strong>
              <span style="color:#f87171;margin-left:6px;">$${worstLane[1].avgRPM.toFixed(2)}/mi</span>
              <span style="color:#6b7280;font-size:12px;"> (${worstLane[1].loads} ${isEs?'cargas':'loads'})</span>
            </div>` : '';

          const bestDowHtml = bestDow ? `
            <div>
              <span style="color:#6b7280;font-size:12px;">${isEs?'Mejor día':'Best day'}</span><br>
              <strong style="color:#e5e7eb;">${isEs ? DOW_ES[bestDow[0]] : DOW_EN[bestDow[0]]}</strong>
              <span style="color:#fb923c;margin-left:6px;">$${bestDow[1].avgRPM.toFixed(2)}/mi</span>
              <span style="color:#6b7280;font-size:12px;"> (${bestDow[1].loads} ${isEs?'cargas':'loads'})</span>
            </div>` : '';

          return `
          <div style="background:#080f1f;border:1px solid rgba(251,146,60,0.15);border-radius:8px;padding:11px 13px;font-size:13px;">
            <div style="color:#fb923c;font-weight:600;margin-bottom:8px;">🧠 ${isEs?'Patrones inteligentes':'Smart patterns'}</div>
            ${topLaneHtml}${worstLaneHtml}${bestDowHtml}
          </div>`;
        })()}
      `;
    } catch (e) {
      debugLog('[LEX-MINEGOCIOS] Error:', e);
      container.innerHTML = '';
    }
  }

  // renderSmartAnalysis, renderLoadCard, renderKPICard, renderInsights removed —
  // load analysis now lives in the Chat opening message; Mi Negocio tab uses populateAnalysisTab

};

// Quick Action Handler
window.lexQuickAction = async function (action) {
  const messages = document.getElementById('lexChatMessages');
  const input = document.getElementById('lexChatInput');

  if (!messages || !input) {
    debugLog('[LEX] Chat no está abierto');
    return;
  }

  // Map actions to queries
  const actionQueries = {
    'analizar': window.i18n?.t('lex.query_analyze') || 'Analiza la carga actual',
    'mes': window.i18n?.t('lex.query_month') || '¿Cómo va mi mes?',
    'zona': window.i18n?.t('lex.query_zone') || 'Stats de esta zona',
    'finanzas': window.i18n?.t('lex.query_finances') || 'Resumen financiero'
  };

  const query = actionQueries[action] || action;

  // Simulate user typing this query
  input.value = query;

  // Cambiar a la pestaña de chat para que el usuario navegue hacia la respuesta
  if (typeof window.switchLexTab === 'function') {
    window.switchLexTab('chat');
  }

  // Trigger form submit de forma que el eventListener lo escuche
  const form = document.getElementById('lexChatForm');
  if (form) {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
};

// ======================================================
// NOTE: openLexChatModal is defined above in DOMContentLoaded
// This section removed to prevent duplicate/override
// ======================================================

/**
 * Show proactive insights when chat opens  
 * (Called from original openLexChatModal in DOMContentLoaded)
 */
async function showProactiveInsights() {
  // Only show if InsightsAnalyzer is loaded
  if (!window.InsightsAnalyzer) return;

  try {
    // Get user profile
    const profile = typeof getLexProfile === 'function'
      ? await getLexProfile()
      : null;

    if (!profile || profile.totalLoads < 10) {
      // Not enough data for insights
      return;
    }

    debugLog('[LEX] Generating proactive insights...');

    // Generate insights
    const insights = await window.InsightsAnalyzer.generateInsights(profile);

    if (!insights || insights.length === 0) {
      debugLog('[LEX] No insights generated');
      return;
    }

    // Show only high priority insights
    const highPriority = insights.filter(i => i.priority === 'HIGH');

    if (highPriority.length > 0) {
      debugLog('[LEX] Showing', highPriority.length, 'high priority insights');
      highPriority.forEach(insight => {
        const message = `${insight.emoji} ${insight.message}`;
        if (typeof appendLexMessage === 'function') {
          appendLexMessage(message);
        }
      });
    }
  } catch (error) {
    debugLog('[LEX] Error showing proactive insights:', error);
  }
}

window.closeLexChatModal = function () {
  const overlay = document.getElementById('lexChatOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  window.lexChatOpen = false;

  // NEW: Clear conversation memory when chat closes
  if (window.lexChatMemory && typeof window.lexChatMemory.clear === 'function') {
    window.lexChatMemory.clear();
    debugLog('💭 ConversationMemory cleared on chat close');
  }
};

// ==========================================================
//  TAB SWITCHING
// ==========================================================
window.switchLexTab = function (tab) {
  // Update tab buttons
  const tabs = ['analisis', 'chat', 'feedback'];
  tabs.forEach(t => {
    const btn = document.getElementById(`lexTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`lexContent${t.charAt(0).toUpperCase() + t.slice(1)}`);

    if (t === tab) {
      // Active tab
      btn.style.background = 'transparent';
      btn.style.color = '#fb923c';
      btn.style.borderBottom = '2px solid #fb923c';
      content.style.display = 'flex';
    } else {
      // Inactive tab
      btn.style.background = 'transparent';
      btn.style.color = '#9ca3af';
      btn.style.borderBottom = '2px solid transparent';
      content.style.display = 'none';
    }
  });
};

// ==========================================================
//  FEEDBACK SUBMISSION
// ==========================================================
window.submitLexFeedback = async function () {
  const type = document.getElementById('lexFeedbackType').value;
  const message = document.getElementById('lexFeedbackMessage').value;

  if (!message.trim()) {
    alert(window.i18n?.t('lex.feedback_required') || 'Por favor describe tu feedback');
    return;
  }

  try {
    const user = firebase.auth().currentUser;
    const feedbackData = {
      type,
      message: message.trim(),
      email: user ? user.email : 'anonymous',
      userId: user ? user.uid : 'anonymous',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      status: 'new',
      source: 'lex_tab'
    };

    await firebase.firestore()
      .collection('feedback')
      .add(feedbackData);

    // Track event
    if (window.analyticsManager) {
      window.analyticsManager.trackEvent('feedback_submitted', {
        feedback_type: type,
        source: 'lex_tab'
      });
    }

    // Clear form and show inline success message
    document.getElementById('lexFeedbackMessage').value = '';
    const feedbackContent = document.getElementById('lexContentFeedback');
    if (feedbackContent) {
      // Remove any previous success message
      const prev = feedbackContent.querySelector('.lex-feedback-success');
      if (prev) prev.remove();
      const successMsg = document.createElement('div');
      successMsg.className = 'lex-feedback-success';
      successMsg.style.cssText = 'background:#052e16;border:1px solid #166534;border-radius:8px;padding:12px;text-align:center;color:#4ade80;font-size:13px;font-weight:600;margin-bottom:10px;';
      successMsg.textContent = window.i18n?.t('lex.feedback_success') || '✅ ¡Gracias por tu feedback! Lo revisaremos pronto.';
      feedbackContent.insertBefore(successMsg, feedbackContent.firstChild);
      setTimeout(() => { successMsg.remove(); window.switchLexTab('chat'); }, 2500);
    }

  } catch (error) {
    debugLog('Error submitting feedback:', error);
    const feedbackContent = document.getElementById('lexContentFeedback');
    if (feedbackContent) {
      const prev = feedbackContent.querySelector('.lex-feedback-error');
      if (prev) prev.remove();
      const errMsg = document.createElement('div');
      errMsg.className = 'lex-feedback-error';
      errMsg.style.cssText = 'background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:10px;text-align:center;color:#f87171;font-size:12px;margin-bottom:8px;';
      errMsg.textContent = window.i18n?.t('lex.feedback_error') || 'Error al enviar. Intenta de nuevo.';
      feedbackContent.insertBefore(errMsg, feedbackContent.firstChild);
      setTimeout(() => errMsg.remove(), 3000);
    }
  }
};

// ==========================================================
//  LANGUAGE CHANGE — rebuild panel so labels update
// ==========================================================
document.addEventListener('languageChanged', () => {
  const overlay = document.getElementById('lexChatOverlay');
  if (overlay) {
    // Panel is open — close and destroy so it rebuilds with new language
    if (typeof window.closeLexChatModal === 'function') {
      window.closeLexChatModal();
    }
    overlay.remove();
    window.lexChatOpen = false;
  }
  // Also update the bubble message if visible
  const bubble = document.getElementById('lexBubble');
  if (bubble && !bubble.classList.contains('hidden')) {
    const msg = bubble.querySelector('.lex-bubble-text');
    if (msg) msg.textContent = window.i18n?.t('lex.hover_bubble') || 'Click to analyze loads.';
  }
});

