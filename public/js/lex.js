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

console.log(`🎨 Lex usando ${lexSupportsWebP ? 'WebP' : 'PNG'} images`);

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
    message: 'Hola, soy Lex. Haz click en mi para analizar cargas, zonas, finanzas e historial.',
    duration: 7000
  });

  if (!shell) return;

  // Hover → thinking
  shell.addEventListener('mouseenter', () => {
    if (lexCurrentState === 'sleep') return;

    setLexState('thinking', {
      message: 'Click para ver analisis detallado de la seccion actual',
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
      console.warn('[LEX] openLexChatModal no está disponible');
    }
  });

  // 👋 Welcome message on app load
  setTimeout(() => {
    setLexState('idle', {
      message: '👋 Hola! Soy Lex, tu asistente AI para trucking. Click en mí para conversar.',
      duration: 6000
    });

    // Go to sleep after 6s
    setTimeout(() => {
      setLexState('sleep');
    }, 6000);
  }, 2000); // Show 2s after app loads
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
    console.log('💭 ConversationMemory created for this chat session');
  } else {
    console.warn('💭 ConversationMemory class not available');
  }

  // Contenedor transparente para colocar el panel
  overlay = document.createElement('div');
  overlay.id = 'lexChatOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9999';

  // Panel de chat
  const panel = document.createElement('div');
  panel.id = 'lexChatPanel';
  panel.style.position = 'fixed';
  panel.style.right = '4.2rem';      // cerca de Lex
  panel.style.bottom = '5.2rem';
  panel.style.width = '300px';       // más pequeño
  panel.style.maxHeight = '50vh';    // altura máxima
  panel.style.backgroundColor = '#020617'; // fondo sólido
  panel.style.border = '1px solid #4b5563';
  panel.style.borderRadius = '14px';
  panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.75)';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.overflow = 'hidden';
  panel.style.fontSize = '10px';     // tamaño base más pequeño
  panel.style.pointerEvents = 'auto';

  panel.innerHTML = `
    <!-- HEADER -->
    <div style="
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 9px;
      border-bottom: 1px solid #1f2937;
      background: #020617;
    ">
      <div style="
        width: 22px;
        height: 22px;
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
      <div style="flex: 1;">
        <div style="font-size: 11px; font-weight: 600; color: #f9fafb;">
          Lex · Chat
        </div>
        <div style="font-size: 10px; color: #9ca3af;">
          Pregúntame sobre esta carga o tu RPM.
        </div>
      </div>
      <button
        onclick="window.closeLexChatModal()"
        style="
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 10px;
          cursor: pointer;
        "
      >
        ✕
      </button>
    </div>

    <!-- MENSAJES -->
    <div
      id="lexChatMessages"
      style="
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background-color: #020617;
        height: 140px;
        overflow-y: auto;
      "
    >
      <div style="display: flex; align-items: flex-start; gap: 6px;">
        <div style="
          width: 20px;
          height: 20px;
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
          <p>Hola Ricardo 👋 Puedo ayudarte con esta carga, tus zonas o tu RPM. ¿Qué quieres revisar?</p>
        </div>
      </div>
    </div>

    <!-- QUICK ACTIONS -->
    <div style="
      padding: 6px 8px;
      border-bottom: 1px solid #1f2937;
      background-color: #020617;
      display: flex;
      flex-direction: column;
      gap: 4px;
    ">
      <div style="font-size: 9px; color: #9ca3af; margin-bottom: 2px;">
        ⚡ Acciones rápidas:
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
        <button onclick="window.lexQuickAction('analizar')" style="
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid #374151;
          background: #111827;
          color: #e5e7eb;
          font-size: 9px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
          📊 Analizar carga
        </button>
        <button onclick="window.lexQuickAction('mes')" style="
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid #374151;
          background: #111827;
          color: #e5e7eb;
          font-size: 9px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
          📈 ¿Cómo va mi mes?
        </button>
        <button onclick="window.lexQuickAction('zona')" style="
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid #374151;
          background: #111827;
          color: #e5e7eb;
          font-size: 9px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
          🗺️ Stats de zona
        </button>
        <button onclick="window.lexQuickAction('finanzas')" style="
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid #374151;
          background: #111827;
          color: #e5e7eb;
          font-size: 9px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">
          💰 Resumen financiero
        </button>
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
        placeholder="Ej: RPM de esta carga?"
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
          padding: 5px 8px;
          border-radius: 9999px;
          border: none;
          background: #2563eb;
          color: white;
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
        "
      >
        Enviar
      </button>
    </form>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const form = document.getElementById('lexChatForm');
  const input = document.getElementById('lexChatInput');
  const messages = document.getElementById('lexChatMessages');

  function appendUserMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'flex-end';
    wrapper.style.alignItems = 'flex-start';
    wrapper.style.gap = '6px';
    wrapper.innerHTML = `
      <div
        style="
          background: #2563eb;
          border-radius: 12px 12px 4px 12px;
          padding: 5px 8px;
          color: #f9fafb;
          font-size: 10px;
          max-width: 85%;
        "
      >
        <p>${text}</p>
      </div>
    `;
    messages.appendChild(wrapper);
  }

  function appendLexMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'flex-start';
    wrapper.style.gap = '6px';
    wrapper.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
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
      <div
        style="
          background: #030712;
          border: 1px solid #1f2937;
          border-radius: 12px 12px 12px 4px;
          padding: 5px 8px;
          color: #e5e7eb;
          font-size: 10px;
          max-width: 85%;
        "
      >
        <p>${text}</p>
      </div>
    `;
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
        console.error('[LEX CHAT] Error procesando mensaje:', err);
        appendLexMessage('Hubo un error procesando tu pregunta. 😕');
      }
    } else {
      console.error('[LEX CHAT] handleLexChatMessage no está definido');
      appendLexMessage('Aún no tengo conectada mi lógica interna/externa, pero ya leo tus mensajes. 😉');
    }

    scrollToBottom();
  });
};

// Quick Action Handler
window.lexQuickAction = async function (action) {
  const messages = document.getElementById('lexChatMessages');
  const input = document.getElementById('lexChatInput');

  if (!messages || !input) {
    console.error('[LEX] Chat no está abierto');
    return;
  }

  // Map actions to queries
  const actionQueries = {
    'analizar': 'Analiza la carga actual',
    'mes': '¿Cómo va mi mes?',
    'zona': 'Stats de esta zona',
    'finanzas': 'Resumen financiero'
  };

  const query = actionQueries[action] || action;

  // Simulate user typing this query
  input.value = query;

  // Trigger form submit
  const form = document.getElementById('lexChatForm');
  if (form) {
    form.dispatchEvent(new Event('submit'));
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

    console.log('[LEX] Generating proactive insights...');

    // Generate insights
    const insights = await window.InsightsAnalyzer.generateInsights(profile);

    if (!insights || insights.length === 0) {
      console.log('[LEX] No insights generated');
      return;
    }

    // Show only high priority insights
    const highPriority = insights.filter(i => i.priority === 'HIGH');

    if (highPriority.length > 0) {
      console.log('[LEX] Showing', highPriority.length, 'high priority insights');
      highPriority.forEach(insight => {
        const message = `${insight.emoji} ${insight.message}`;
        if (typeof appendLexMessage === 'function') {
          appendLexMessage(message);
        }
      });
    }
  } catch (error) {
    console.error('[LEX] Error showing proactive insights:', error);
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
    console.log('💭 ConversationMemory cleared on chat close');
  }
};


