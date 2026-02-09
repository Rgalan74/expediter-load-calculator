/**
 * FEEDBACK SYSTEM - Bug Reports & Feature Requests
 * Allows users to submit feedback directly from the app
 */

class FeedbackSystem {
  constructor() {
    // Botón flotante deshabilitado - ahora está integrado en Lex
    // this.setupFeedbackButton();
  }

  /**
   * Create floating feedback button
   */
  setupFeedbackButton() {
    // Don't show if already exists
    if (document.getElementById('feedbackButton')) return;

    const button = document.createElement('button');
    button.id = 'feedbackButton';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    button.title = 'Reportar problema o sugerir mejora';
    button.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    `;

    button.onmouseover = () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.5)';
    };

    button.onmouseout = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
    };

    button.onclick = () => this.showFeedbackModal();

    document.body.appendChild(button);
  }

  /**
   * Show feedback modal
   */
  showFeedbackModal() {
    // Remove existing modal if any
    const existing = document.getElementById('feedbackModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'feedbackModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10003;
      animation: fadeIn 0.2s;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        #feedbackForm textarea:focus,
        #feedbackForm input:focus,
        #feedbackForm select:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }
      </style>
      <div style="
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0;">
            Feedback
          </h2>
          <button onclick="document.getElementById('feedbackModal').remove()" style="
            background: none;
            border: none;
            font-size: 28px;
            color: #9ca3af;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">&times;</button>
        </div>

        <form id="feedbackForm">
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">
              Tipo de feedback
            </label>
            <select id="feedbackType" required style="
              width: 100%;
              padding: 12px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              font-size: 14px;
              font-family: Inter, sans-serif;
              transition: all 0.2s;
            ">
              <option value="bug">🐛 Reportar un error</option>
              <option value="feature">💡 Sugerir una mejora</option>
              <option value="question">❓ Hacer una pregunta</option>
              <option value="other">💬 Otro</option>
            </select>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">
              Descripción
            </label>
            <textarea id="feedbackMessage" required rows="5" placeholder="Cuéntanos qué pasó o qué te gustaría ver..." style="
              width: 100%;
              padding: 12px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              font-size: 14px;
              font-family: Inter, sans-serif;
              resize: vertical;
              transition: all 0.2s;
            "></textarea>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">
              Email (opcional)
            </label>
            <input type="email" id="feedbackEmail" placeholder="tu@email.com" style="
              width: 100%;
              padding: 12px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              font-size: 14px;
              font-family: Inter, sans-serif;
              transition: all 0.2s;
            ">
            <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              Para que podamos responderte si lo necesitas
            </p>
          </div>

          <div style="display: flex; gap: 12px;">
            <button type="submit" style="
              flex: 1;
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              color: white;
              border: none;
              padding: 14px 24px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              cursor: pointer;
              font-family: Inter, sans-serif;
              transition: transform 0.2s;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              Enviar Feedback
            </button>
            <button type="button" onclick="document.getElementById('feedbackModal').remove()" style="
              background: #f3f4f6;
              color: #374151;
              border: none;
              padding: 14px 24px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              cursor: pointer;
              font-family: Inter, sans-serif;
            ">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup form submit
    document.getElementById('feedbackForm').onsubmit = (e) => {
      e.preventDefault();
      this.submitFeedback();
    };

    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /**
   * Submit feedback to Firebase
   */
  async submitFeedback() {
    const type = document.getElementById('feedbackType').value;
    const message = document.getElementById('feedbackMessage').value;
    const email = document.getElementById('feedbackEmail').value;

    if (!message.trim()) {
      alert('Por favor describe tu feedback');
      return;
    }

    try {
      const user = firebase.auth().currentUser;
      const feedbackData = {
        type,
        message: message.trim(),
        email: email || (user ? user.email : 'anonymous'),
        userId: user ? user.uid : 'anonymous',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        status: 'new'
      };

      await firebase.firestore()
        .collection('feedback')
        .add(feedbackData);

      // Track event
      if (window.analyticsManager) {
        window.analyticsManager.trackEvent('feedback_submitted', {
          feedback_type: type
        });
      }

      this.showThankYouMessage();
      document.getElementById('feedbackModal').remove();

    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Error al enviar feedback. Por favor intenta de nuevo.');
    }
  }

  /**
   * Show thank you message
   */
  showThankYouMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      z-index: 10000;
      font-family: Inter, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;

    message.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">🙏</div>
        <div>
          <div style="font-weight: 600; font-size: 14px;">¡Gracias!</div>
          <div style="font-size: 12px; opacity: 0.9;">Tu feedback nos ayuda a mejorar</div>
        </div>
      </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
      message.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => message.remove(), 300);
    }, 4000);
  }
}

// Initialize feedback system when page loads
window.addEventListener('load', () => {
  window.feedbackSystem = new FeedbackSystem();
});

console.log('💬 Feedback System loaded');
