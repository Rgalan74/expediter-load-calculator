/**
 * PWA INSTALL PROMPT - Personalized Install Experience
 * Shows custom install banner with benefits
 */

class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = null;
        this.setupInstallPrompt();
    }

    /**
     * Setup install prompt handler
     */
    setupInstallPrompt() {
        // Capture the install prompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('💾 PWA Install prompt available');

            // Prevent default mini-infobar
            e.preventDefault();

            // Store event for later
            this.deferredPrompt = e;

            // Show custom install banner after 2 uses or 30 seconds
            this.maybeShowInstallBanner();
        });

        // Track if app was installed
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA installed successfully');
            this.deferredPrompt = null;

            // Hide banner if showing
            const banner = document.getElementById('pwaInstallBanner');
            if (banner) banner.remove();

            // Show thank you message
            this.showThankYouMessage();

            // Track installation
            if (typeof gtag !== 'undefined') {
                gtag('event', 'pwa_install', {
                    event_category: 'engagement',
                    event_label: 'PWA Installed'
                });
            }
        });
    }

    /**
     * Decide whether to show install banner
     */
    maybeShowInstallBanner() {
        // Don't show if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('✅ Already installed as PWA');
            return;
        }

        // Check if user dismissed before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedDate = new Date(dismissed);
            const daysSince = (Date.now() - dismissedDate) / (1000 * 60 * 60 * 24);

            // Don't show again for 7 days
            if (daysSince < 7) {
                console.log('⏭️ Install banner dismissed recently');
                return;
            }
        }

        // Check usage count
        let usageCount = parseInt(localStorage.getItem('app-usage-count') || '0');
        usageCount++;
        localStorage.setItem('app-usage-count', usageCount.toString());

        // Show after 2 uses or wait 30 seconds
        if (usageCount >= 2) {
            setTimeout(() => this.showInstallBanner(), 3000);
        } else {
            setTimeout(() => this.showInstallBanner(), 30000);
        }
    }

    /**
     * Show custom install banner
     */
    showInstallBanner() {
        if (!this.deferredPrompt) return;

        // Create banner
        const banner = document.createElement('div');
        banner.id = 'pwaInstallBanner';
        banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 24px;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
      z-index: 10001;
      max-width: 400px;
      width: 90%;
      font-family: Inter, sans-serif;
      animation: slideUp 0.4s ease-out;
    `;

        banner.innerHTML = `
      <style>
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        #pwaInstallBanner button {
          transition: all 0.2s;
        }
        #pwaInstallBanner button:hover {
          transform: translateY(-2px);
         box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      </style>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 32px;">📱</div>
          <div>
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">
              Instala SmartLoad
            </div>
            <div style="font-size: 13px; opacity: 0.95;">
              Acceso rápido y funciona sin internet
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; font-size: 12px; opacity: 0.9;">
          <span>⚡ Más rápido</span>
          <span>📴 Modo offline</span>
          <span>🔔 Alertas</span>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button id="pwaInstallBtn" style="
            flex: 1;
            background: white;
            color: #667eea;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            font-family: Inter, sans-serif;
          ">
            Instalar App
          </button>
          <button id="pwaInstallDismiss" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            font-family: Inter, sans-serif;
          ">
            Ahora no
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(banner);

        // Setup button handlers
        document.getElementById('pwaInstallBtn').addEventListener('click', () => {
            this.promptInstall();
        });

        document.getElementById('pwaInstallDismiss').addEventListener('click', () => {
            banner.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => banner.remove(), 300);
            localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
        });

        // Add slideDown animation
        const style = document.createElement('style');
        style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(100px); opacity: 0; }
      }
    `;
        document.head.appendChild(style);
    }

    /**
     * Trigger install prompt
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('❌ No install prompt available');
            return;
        }

        // Show native prompt
        this.deferredPrompt.prompt();

        // Wait for user choice
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`User chose: ${outcome}`);

        // Track choice
        if (typeof gtag !== 'undefined') {
            gtag('event', 'pwa_install_prompt', {
                event_category: 'engagement',
                event_label: outcome
            });
        }

        // Clear prompt
        this.deferredPrompt = null;

        // Remove banner
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.remove();
    }

    /**
     * Show thank you message after install
     */
    showThankYouMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10002;
      text-align: center;
      max-width: 400px;
      animation: fadeIn 0.3s ease-out;
    `;

        message.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      </style>
      <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
      <div style="font-size: 24px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">
        ¡Instalado!
      </div>
      <div style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">
        Ahora puedes acceder a SmartLoad desde tu pantalla principal
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 32px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-family: Inter, sans-serif;
      ">
        Entendido
      </button>
    `;

        document.body.appendChild(message);

        // Auto-remove after 5 seconds
        setTimeout(() => message.remove(), 5000);
    }

    /**
     * Check if running as installed PWA
     */
    static isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }
}

// Initialize
window.pwaInstaller = new PWAInstaller();

// Expose helper
window.isPWAInstalled = () => PWAInstaller.isInstalled();

console.log('📱 PWA Installer ready');
