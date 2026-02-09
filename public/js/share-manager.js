/**
 * WEB SHARE API - Share Calculations
 * Allows users to share load calculations via native share
 */

class ShareManager {
    constructor() {
        this.canShare = 'share' in navigator;
        console.log(`🔗 Web Share API: ${this.canShare ? 'Available' : 'Not available'}`);
    }

    /**
     * Share load calculation result
     */
    async shareCalculation(loadData) {
        if (!this.canShare) {
            console.log('ℹ️ Web Share not available, using clipboard');
            return this.copyToClipboard(loadData);
        }

        const shareData = {
            title: 'Expediter Load Result - SmartLoad',
            text: this.formatLoadForShare(loadData),
            url: 'https://smartloadsolution.com'
        };

        try {
            await navigator.share(shareData);
            console.log('✅ Load shared successfully');

            // Track share
            if (typeof gtag !== 'undefined') {
                gtag('event', 'share_load', {
                    event_category: 'engagement',
                    event_label: 'Load Calculation'
                });
            }

            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('❌ Share failed:', error);
            }
            return false;
        }
    }

    /**
     * Format load data for sharing
     */
    formatLoadForShare(load) {
        const emoji = load.netProfit >= 0 ? '✅' : '❌';
        const rpmi = load.rpm ? load.rpm.toFixed(2) : '0.00';
        const profit = load.netProfit ? load.netProfit.toFixed(2) : '0.00';

        return `${emoji} Load Analysis - SmartLoad\n\n` +
            `📍 ${load.origin || 'Origin'} → ${load.destination || 'Destination'}\n` +
            `📏 ${load.totalMiles || 0} miles (${load.deadheadMiles || 0} DH)\n\n` +
            `💰 Rate: $${load.rate || 0}\n` +
            `📊 RPM: $${rpmi}\n` +
            `💵 Net Profit: $${profit}\n\n` +
            `📱 Calculate your loads at smartloadsolution.com`;
    }

    /**
     * Copy to clipboard as fallback
     */
    async copyToClipboard(loadData) {
        const text = this.formatLoadForShare(loadData);

        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied!', 'Load details copied to clipboard');
            return true;
        } catch (error) {
            console.error('❌ Clipboard copy failed:', error);
            // Show manual copy dialog as last resort
            this.showManualCopy(text);
            return false;
        }
    }

    /**
     * Show notification
     */
    showNotification(title, message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      z-index: 10000;
      font-family: Inter, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;

        notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 20px;">✅</div>
        <div>
          <div style="font-weight: 600; font-size: 14px;">${title}</div>
          <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Show manual copy dialog
     */
    showManualCopy(text) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10002;
      max-width: 400px;
      width: 90%;
    `;

        dialog.innerHTML = `
      <div style="font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #1f2937;">
        Copy to Share
      </div>
      <textarea id="manualCopyText" readonly style="
        width: 100%;
        height: 150px;
        padding: 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        resize: none;
        margin-bottom: 12px;
      ">${text}</textarea>
      <div style="display: flex; gap: 8px;">
        <button onclick="document.getElementById('manualCopyText').select(); document.execCommand('copy'); this.innerHTML='✅ Copied!'" style="
          flex: 1;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: Inter, sans-serif;
        ">
          Copy
        </button>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="
          background: #e5e7eb;
          color: #1f2937;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: Inter, sans-serif;
        ">
          Close
        </button>
      </div>
    `;

        document.body.appendChild(dialog);

        // Auto-select text
        setTimeout(() => {
            document.getElementById('manualCopyText').select();
        }, 100);
    }

    /**
     * Add share button to calculation results
     */
    addShareButton(containerId, loadData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Check if button already exists
        if (container.querySelector('.share-load-btn')) return;

        const button = document.createElement('button');
        button.className = 'share-load-btn';
        button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
      <span>Share</span>
    `;
        button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      font-family: Inter, sans-serif;
      transition: transform 0.2s, box-shadow 0.2s;
      margin-top: 12px;
    `;

        button.onmouseover = () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
        };

        button.onmouseout = () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = 'none';
        };

        button.onclick = () => this.shareCalculation(loadData);

        container.appendChild(button);
    }
}

// Global instance
window.shareManager = window.shareManager || new ShareManager();

// Expose share function globally
window.shareLoad = (loadData) => window.shareManager.shareCalculation(loadData);

console.log('🔗 Share Manager ready');
