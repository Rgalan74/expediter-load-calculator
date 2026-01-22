// ui-feedback.js - Sistema de feedback visual
// Versión global (sin export para compatibilidad)

/**
 * Loading Manager - Maneja estados de carga en botones
 */
window.LoadingManager = {
  show: function (element, message = 'Cargando...') {
    if (!element) return;

    element.disabled = true;
    element.dataset.originalHTML = element.innerHTML;
    element.innerHTML = `
      <svg class="spinner inline-block animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="ml-2">${message}</span>
    `;
  },

  hide: function (element) {
    if (!element) return;

    element.disabled = false;
    if (element.dataset.originalHTML) {
      element.innerHTML = element.dataset.originalHTML;
      delete element.dataset.originalHTML;
    }
  }
};

/**
 * Toast Notifications
 */
window.showToast = function (message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  toast.className = `toast fixed top-4 right-4 z-50 p-4 rounded-lg shadow-xl ${colors[type]} text-white transition-all transform translate-x-0`;
  toast.style.cssText = 'animation: slideIn 0.3s ease-out;';

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-xl font-bold">${icons[type]}</span>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.cssText += 'animation: slideOut 0.3s ease-in;';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

/**
 * Confirm Dialog
 */
window.confirmDialog = function (message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
  overlay.style.backdropFilter = 'blur(4px)';

  const modal = document.createElement('div');
  modal.className = 'modal-content bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4';
  modal.style.cssText = 'animation: scaleIn 0.2s ease-out;';

  modal.innerHTML = `
    <h3 class="text-xl font-semibold mb-4">Confirmar acción</h3>
    <p class="text-gray-700 mb-6">${message}</p>
    <div class="flex gap-3 justify-end">
      <button id="cancelBtn" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition">
        Cancelar
      </button>
      <button id="confirmBtn" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition">
        Confirmar
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('#confirmBtn').onclick = () => {
    if (onConfirm) onConfirm();
    overlay.remove();
  };

  modal.querySelector('#cancelBtn').onclick = () => {
    if (onCancel) onCancel();
    overlay.remove();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      if (onCancel) onCancel();
      overlay.remove();
    }
  };
};

/**
 * Progress Bar
 */
window.ProgressBar = class {
  constructor(container) {
    this.container = container;
    this.element = null;
  }

  show() {
    this.element = document.createElement('div');
    this.element.className = 'progress-bar-container w-full bg-gray-200 rounded-full h-2 mb-4';
    this.element.innerHTML = `
      <div class="progress-bar-fill bg-blue-500 h-2 rounded-full transition-all" style="width: 0%"></div>
    `;
    this.container.appendChild(this.element);
  }

  update(percent) {
    if (!this.element) return;
    const fill = this.element.querySelector('.progress-bar-fill');
    fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  hide() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
};

// Agregar animaciones CSS
if (!document.querySelector('#ui-feedback-animations')) {
  const style = document.createElement('style');
  style.id = 'ui-feedback-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

console.log('✅ UI Feedback functions loaded globally');
