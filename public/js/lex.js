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
      // Si mientras tanto abriste el chat, tampoco la volvemos a mostrar
      if (!window.lexChatOpen) {
        bubble.classList.add('hidden');
      } else {
        bubble.classList.add('hidden');
      }
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

  // Panel de chat responsive
  const panel = document.createElement('div');
  panel.id = 'lexChatPanel';
  panel.style.position = 'fixed';
  panel.style.right = isMobile ? '5%' : '4.2rem';
  panel.style.bottom = isMobile ? '5%' : '5.2rem';
  panel.style.width = isMobile ? '90vw' : '420px';       // Bastante más ancho en PC
  panel.style.maxHeight = isMobile ? '80vh' : '75vh';    // Más alto en general
  panel.style.backgroundColor = '#020617'; // fondo sólido
  panel.style.border = '1px solid #4b5563';
  panel.style.borderRadius = '16px';
  panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.75)';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.overflow = 'hidden';
  panel.style.fontSize = isMobile ? '12px' : '14px';     // Texto legible
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

      <!-- Tabs -->
      <div style="
        display: flex;
        gap: 2px;
        padding: 4px 8px 0;
        background: #020617;
      ">
        <button id="lexTabAnalisis" onclick="window.switchLexTab('analisis')" style="
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: #fb923c;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          border-bottom: 2px solid #fb923c;
          font-family: Inter, sans-serif;
        ">
          ${window.i18n?.t('lex.tab_analysis') || '📊 Análisis'}
        </button>
        <button id="lexTabChat" onclick="window.switchLexTab('chat')" style="
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          border-bottom: 2px solid transparent;
          font-family: Inter, sans-serif;
        ">
          ${window.i18n?.t('lex.tab_chat') || '💬 Chat'}
        </button>
        <button id="lexTabFeedback" onclick="window.switchLexTab('feedback')" style="
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          border-bottom: 2px solid transparent;
          font-family: Inter, sans-serif;
        ">
          ${window.i18n?.t('lex.tab_feedback') || '📝 Feedback'}
        </button>
      </div>
    </div>

    <!-- CONTENIDO ANÁLISIS -->
    <div id="lexContentAnalisis" style="
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    ">
      <div style="
        padding: 16px;
        text-align: center;
        color: #9ca3af;
        font-size: 12px;
      ">
        <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
        <p>${window.i18n?.t('lex.analysis_prompt') || 'Haz click en los botones de acciones rápidas para analizar:'}</p>
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
        <div style="font-size: 12px; color: #fb923c; font-weight: 600; margin-bottom: 2px;">
          ${window.i18n?.t('lex.quick_actions_label') || '⚡ Acciones rápidas:'}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <button onclick="window.lexQuickAction('analizar')" style="
            padding: 12px 8px;
            border-radius: 6px;
            border: 1px solid #374151;
            background: #111827;
            color: #e5e7eb;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
            ${window.i18n?.t('lex.action_analyze') || '📊 Analizar carga'}
          </button>
          <button onclick="window.lexQuickAction('mes')" style="
            padding: 12px 8px;
            border-radius: 6px;
            border: 1px solid #374151;
            background: #111827;
            color: #e5e7eb;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
            ${window.i18n?.t('lex.action_month') || '📈 ¿Cómo va mi mes?'}
          </button>
          <button onclick="window.lexQuickAction('zona')" style="
            padding: 12px 8px;
            border-radius: 6px;
            border: 1px solid #374151;
            background: #111827;
            color: #e5e7eb;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
            ${window.i18n?.t('lex.action_zone') || '🗺️ Stats de zona'}
          </button>
          <button onclick="window.lexQuickAction('finanzas')" style="
            padding: 12px 8px;
            border-radius: 6px;
            border: 1px solid #374151;
            background: #111827;
            color: #e5e7eb;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
            ${window.i18n?.t('lex.action_finances') || '💰 Resumen financiero'}
          </button>
        </div>
      </div>
    </div>

    <!-- CONTENIDO CHAT -->
    <div id="lexContentChat" style="display: none; flex: 1; flex-direction: column; overflow: hidden;">
      <!-- MENSAJES -->
      <div
        id="lexChatMessages"
        style="
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background-color: #020617;
          height: 350px;
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
            padding: 5px 8px;
            color: #e5e7eb;
            font-size: 10px;
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
            padding: 4px 7px;
            border-radius: 9999px;
            border: 1px solid #374151;
            outline: none;
            font-size: 10px;
            line-height: 1.1;
          "
        />
        <button
          type="submit"
          style="
            padding: 6px 14px;
            border-radius: 9999px;
            border: none;
            background: linear-gradient(135deg, #fb923c, #ea580c);
            color: white;
            font-size: 11px;
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

  // Saludo proactivo al abrir el chat por primera vez
  setTimeout(async () => {
    try {
      const uid = window.currentUser?.uid;
      if (!uid) return;

      const _isEsGreet = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const hora = now.getHours();
      const saludo = _isEsGreet
        ? (hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches')
        : (hora < 12 ? 'Good morning' : hora < 18 ? 'Good afternoon' : 'Good evening');
      const mesNombre = now.toLocaleString(_isEsGreet ? 'es' : 'en-US', { month: 'long' });

      const [loadsSnap, profileSnap, recentSnap] = await Promise.all([
        firebase.firestore().collection('loads')
          .where('userId', '==', uid)
          .where('date', '>=', firstDay.toISOString().split('T')[0])
          .get(),
        firebase.firestore().collection('lexProfiles').doc(uid).get(),
        firebase.firestore().collection('loads')
          .where('userId', '==', uid)
          .orderBy('date', 'desc')
          .limit(7)
          .get()
      ]);

      const p = profileSnap.data() || {};
      let ingresosMes = 0, millasMes = 0;
      loadsSnap.forEach(d => {
        ingresosMes += d.data().totalCharge || 0;
        millasMes += d.data().totalMiles || 0;
      });

      const rpmMes = millasMes > 0 ? ingresosMes / millasMes : 0;
      const avgRPM = p.avgRPM || 0;
      const diff = avgRPM > 0 ? (((rpmMes - avgRPM) / avgRPM) * 100).toFixed(1) : null;
      const tendencia = diff === null ? ''
        : parseFloat(diff) >= 0
          ? (_isEsGreet ? ` 📈 RPM ${diff}% sobre tu histórico.` : ` 📈 RPM ${diff}% above your average.`)
          : (_isEsGreet ? ` 📉 RPM ${Math.abs(diff)}% bajo tu histórico.` : ` 📉 RPM ${Math.abs(diff)}% below your average.`);

      // ── Cálculo de racha ─────────────────────────────────────────────────
      let rachaText = '';
      if (avgRPM > 0 && recentSnap.size >= 3) {
        const recentRPMs = [];
        recentSnap.forEach(d => {
          const data = d.data();
          const rpm = (data.totalCharge || 0) / (data.totalMiles || 1);
          recentRPMs.push(rpm);
        });
        const firstDir = recentRPMs[0] >= avgRPM ? 'above' : 'below';
        let streak = 0;
        for (const rpm of recentRPMs) {
          if ((rpm >= avgRPM ? 'above' : 'below') === firstDir) streak++;
          else break;
        }
        if (firstDir === 'above' && streak >= 2) {
          rachaText = _isEsGreet
            ? ` 🔥 ¡Llevas **${streak} cargas seguidas** sobre tu promedio!`
            : ` 🔥 You're on a **${streak}-load streak** above your average!`;
        } else if (firstDir === 'below' && streak >= 3) {
          rachaText = _isEsGreet
            ? ` ⚠️ Las últimas **${streak} cargas** estuvieron bajo tu promedio.`
            : ` ⚠️ Your last **${streak} loads** were below your average.`;
        }
      }
      // ────────────────────────────────────────────────────────────────

      const cargaActiva = window._lastDecisionData;
      const cargaText = cargaActiva
        ? (_isEsGreet
            ? `
Tienes una carga en el calculador: **${cargaActiva.decision}** — $${cargaActiva.actualRPM.toFixed(2)}/mi.`
            : `
You have a load in the calculator: **${cargaActiva.decision}** — $${cargaActiva.actualRPM.toFixed(2)}/mi.`)
        : '';

      const loadsLabel = _isEsGreet ? 'cargas' : 'loads';
      const revenueLabel = _isEsGreet ? 'ingresos' : 'revenue';
      const helpLabel = _isEsGreet ? '¿En qué te ayudo?' : 'How can I help you?';
      const mensaje = `${saludo} 👋 — ${mesNombre}: **${loadsSnap.size} ${loadsLabel}**, $${ingresosMes.toFixed(0)} ${revenueLabel}.${tendencia}${rachaText}${cargaText}
${helpLabel}`;

      if (typeof appendLexMessage === 'function') {
        appendLexMessage(mensaje);
      }
    } catch (e) {
      debugLog('[LEX] Error en saludo proactivo:', e);
    }
  }, 600);

  // Briefing semanal — se muestra solo una vez por semana, después del saludo
  setTimeout(() => {
    if (typeof window.lexRunWeeklyBriefing === 'function') {
      window.lexRunWeeklyBriefing();
    }
  }, 1800);

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
          padding: 5px 8px;
          color: #f9fafb;
          font-size: 13px;
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
    // Remover "Cargando resumen..." si es el primer mensaje
    const messages = document.getElementById('lexChatMessages');
    const primero = messages?.children[0];
    if (primero?.textContent?.trim().includes('Cargando')) primero.remove();

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

      DEFAULT: isEs
        ? [['📊 Analizar carga actual', 'Analiza la carga actual'],
           ['💰 ¿Cómo va mi mes?', '¿Cómo va mi mes?'],
           ['🗺️ Stats de zona', 'Stats de esta zona']]
        : [['📊 Analyze load', 'Analyze the current load'],
           ['💰 How is my month?', 'How is my month going?'],
           ['🗺️ Zone stats', 'Zone stats for this area']]
    };

    const intentKey = window._lastLexIntent || 'DEFAULT';
    const chips = chipSets[intentKey] || chipSets.PRICING || chipSets.DEFAULT;

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
        font-size: 13px; line-height: 1.6; max-width: 85%;
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
        'color:#9ca3af', 'font-size:10px', 'padding:3px 8px',
        'border-radius:9999px', 'cursor:pointer',
        'transition:all 0.15s', 'font-family:Inter,sans-serif',
        'white-space:nowrap'
      ].join(';');
      chip.onmouseenter = () => { chip.style.borderColor = '#fb923c'; chip.style.color = '#fb923c'; };
      chip.onmouseleave = () => { chip.style.borderColor = '#374151'; chip.style.color = '#9ca3af'; };
      chip.addEventListener('click', () => {
        const inputEl = document.getElementById('lexChatInput');
        const formEl = document.getElementById('lexChatForm');
        if (inputEl && formEl) {
          inputEl.value = query;
          formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        chipsRow.style.display = 'none';
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

    // Clear form
    document.getElementById('lexFeedbackMessage').value = '';

    // Show success & switch to chat
    alert(window.i18n?.t('lex.feedback_success') || '✅ ¡Gracias por tu feedback!');
    window.switchLexTab('chat');

  } catch (error) {
    debugLog('Error submitting feedback:', error);
    alert(window.i18n?.t('lex.feedback_error') || 'Error al enviar feedback. Por favor intenta de nuevo.');
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

