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
    message: 'Hola, soy Lex. Haz click en mi para analizar cargas, zonas, finanzas e historial.',
    duration: 1000
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
      debugLog('[LEX] openLexChatModal no está disponible');
    }
  });

  // 👋 Welcome message on app load
  setTimeout(() => {
    setLexState('idle', {
      message: '👋 Hola! Soy Lex. Click en mí para conversar.',
      duration: 2500
    });

    // Go to sleep after 2.5s
    setTimeout(() => {
      setLexState('sleep');
    }, 2500);
  }, 1000); // Show 1s after app loads
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
            Asistente activo
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
          📊 Análisis
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
          💬 Chat
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
          📝 Feedback
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
        <p>Haz click en los botones de acciones rápidas para analizar:</p>
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
          ⚡ Acciones rápidas:
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
            📊 Analizar carga
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
            📈 ¿Cómo va mi mes?
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
            🗺️ Stats de zona
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
            💰 Resumen financiero
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
            <p style="opacity:0.4; font-size:11px;">Cargando resumen...</p>
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
          Enviar
        </button>
      </form>
    </div>

    <!-- CONTENIDO FEEDBACK -->
    <div id="lexContentFeedback" style="display: none; flex: 1; flex-direction: column; overflow-y: auto; padding: 12px;">
      <div style="margin-bottom: 14px;">
        <label style="display: block; font-weight: 600; color: #f9fafb; margin-bottom: 6px; font-size: 10px;">
          Tipo de feedback
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
          <option value="bug">🐛 Reportar un error</option>
          <option value="feature">💡 Sugerir una mejora</option>
          <option value="question">❓ Hacer una pregunta</option>
          <option value="other">💬 Otro</option>
        </select>
      </div>

      <div style="margin-bottom: 14px;">
        <label style="display: block; font-weight: 600; color: #f9fafb; margin-bottom: 6px; font-size: 10px;">
          Descripción
        </label>
        <textarea id="lexFeedbackMessage" rows="4" placeholder="Cuéntanos qué pasó o qué te gustaría ver..." style="
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
        📤 Enviar Feedback
      </button>

      <p style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">
        Tu feedback nos ayuda a mejorar la app
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

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const hora = now.getHours();
      const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
      const mesNombre = now.toLocaleString('es', { month: 'long' });

      const [loadsSnap, profileSnap] = await Promise.all([
        firebase.firestore().collection('loads')
          .where('userId', '==', uid)
          .where('date', '>=', firstDay.toISOString().split('T')[0])
          .get(),
        firebase.firestore().collection('lexProfiles').doc(uid).get()
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
          ? ` 📈 RPM ${diff}% sobre tu histórico.`
          : ` 📉 RPM ${Math.abs(diff)}% bajo tu histórico.`;

      const cargaActiva = window._lastDecisionData;
      const cargaText = cargaActiva
        ? `\nTienes una carga en el calculador: **${cargaActiva.decision}** — $${cargaActiva.actualRPM.toFixed(2)}/mi.`
        : '';

      const mensaje = `${saludo} 👋 — ${mesNombre}: **${loadsSnap.size} cargas**, $${ingresosMes.toFixed(0)} ingresos.${tendencia}${cargaText}\n¿En qué te ayudo?`;

      if (typeof appendLexMessage === 'function') {
        appendLexMessage(mensaje);
      }
    } catch (e) {
      debugLog('[LEX] Error en saludo proactivo:', e);
    }
  }, 600);

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
        appendLexMessage('Hubo un error procesando tu pregunta. 😕');
      }
    } else {
      debugLog('[LEX CHAT] handleLexChatMessage no está definido');
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
    debugLog('[LEX] Chat no está abierto');
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
    alert('Por favor describe tu feedback');
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
    alert('✅ ¡Gracias por tu feedback!');
    window.switchLexTab('chat');

  } catch (error) {
    debugLog('Error submitting feedback:', error);
    alert('Error al enviar feedback. Por favor intenta de nuevo.');
  }
};

