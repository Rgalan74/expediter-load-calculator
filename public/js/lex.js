// ==========================================================
//  LEX.JS - Control visual del asistente Lex
//  Adaptado exactamente a tus 9 imágenes en /img/lex/
// ==========================================================

// 🔹 Rutas exactas según tus archivos
const LEX_IMAGES = {
  idle:        'img/lex/lex-neutral.png',   // estado neutral / base
  thinking:    'img/lex/lex-thinking.png',  // analizando datos
  happy:       'img/lex/lex-happy.png',     // carga buena / positiva
  warning:     'img/lex/lex-alert.png',     // alerta / dudosa
  sad:         'img/lex/lex-sad.png',       // carga mala
  blink:       'img/lex/lex-blink.png',     // parpadeo natural
  sleep:       'img/lex/lex-sleep.png',     // inactivo / descanso
  loading:     'img/lex/lex-loading.png',   // cargando / esperando
  surprise:    'img/lex/lex-surprise.png',  // sorprendido
};

// 🔹 Colores del puntico según estado
const LEX_STATUS_COLORS = {
  idle:        'bg-emerald-400',
  thinking:    'bg-blue-400',
  happy:       'bg-green-400',
  warning:     'bg-yellow-400',
  sad:         'bg-red-500',
  blink:       'bg-emerald-300',
  sleep:       'bg-slate-500',
  loading:     'bg-blue-300',
  surprise:    'bg-purple-400',
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

  // Click → usar a Lex como asistente global
  shell.addEventListener('click', async () => {
    // Si está dormido, primero lo despertamos
    if (lexCurrentState === 'sleep') {
      setLexState('idle', {
        message: 'Ya estoy despierto. Haz click de nuevo para analizar',
        duration: 4000
      });
      return;
    }

    // Si existe un disparador global de Lex, lo usamos
    if (typeof window.triggerLex === 'function') {
      try {
        await window.triggerLex();
      } catch (err) {
        console.error('[LEX] Error al ejecutar triggerLex:', err);
        setLexState('warning', {
          message: 'Error al analizar. Revisa la consola del navegador',
          duration: 6000
        });
      }
      return;
    }

    // Fallback antiguo si aún no tenemos triggerLex
    setLexState('blink', {
      message: 'Abre Calculator, History, Zones o Finances y vuelve a hacer click',
      duration: 7000
    });
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

window.closeLexChatModal = function () {
  const overlay = document.getElementById('lexChatOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  window.lexChatOpen = false;
};


