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
  if (bubble && bubbleText && options.message) {
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
    message: 'Hola, soy Lex. Te ayudaré con tus decisiones de carga. 🚐',
    duration: 6000
  });

  if (!shell) return;

  // Hover → thinking
  shell.addEventListener('mouseenter', () => {
    if (lexCurrentState === 'sleep') return;

    setLexState('thinking', {
      message: 'Estoy listo para analizar cualquier carga. 🔍',
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
          message: 'Ya estoy despierto 😄 ¿qué analizamos?',
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
            message: 'Tuve un problema al analizar. Intenta de nuevo o revisa la consola 🛠️',
            duration: 6000
          });
        }
        return;
      }
  
      // Fallback antiguo si aún no tenemos triggerLex
      setLexState('blink', {
        message: 'Muy pronto podré ayudarte en toda la app. Por ahora, abre la calculadora 🧮',
        duration: 7000
      });
    });
  });
