/**
 * SYNC MANAGER - Auto-sync when online
 * Syncs offline data to Firebase when connection is restored
 */

class SyncManager {
    constructor() {
        this.syncInProgress = false;
        this.setupOnlineListener();
    }

    /**
     * Setup listener for online/offline events
     */
    setupOnlineListener() {
        window.addEventListener('online', () => {
            console.log('🌐 Connection restored - Starting sync...');
            this.showNotification('Connection restored', 'Syncing your data...');
            this.syncAll();
        });

        window.addEventListener('offline', () => {
            console.log('📴 Connection lost - Offline mode active');
            this.showNotification('Offline Mode', 'Your data will be saved locally');
        });

        // Check if we're online on load
        if (navigator.onLine) {
            // Wait a bit for auth to be ready
            setTimeout(() => this.syncAll(), 3000);
        }
    }

    /**
     * Sync all pending data
     */
    async syncAll() {
        if (this.syncInProgress) {
            console.log('⏳ Sync already in progress');
            return;
        }

        if (!navigator.onLine) {
            console.log('📴 Offline - Cannot sync now');
            return;
        }

        if (!firebase.auth().currentUser) {
            console.log('🔒 Not authenticated - Cannot sync');
            return;
        }

        this.syncInProgress = true;

        try {
            await this.syncCalculations();
            await this.syncExpenses();

            console.log('✅ Sync completed successfully');
            this.showNotification('Sync Complete', 'All your data is up to date');
        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.showNotification('Sync Failed', 'Will retry later');
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync calculations to Firebase
     */
    async syncCalculations() {
        const unsynced = await window.offlineStorage.getUnsyncedItems('calculations');

        if (unsynced.length === 0) {
            console.log('✅ No calculations to sync');
            return;
        }

        console.log(`📤 Syncing ${unsynced.length} calculations...`);

        for (const calc of unsynced) {
            try {
                const userId = firebase.auth().currentUser.uid;
                const loadId = `${userId}_${Date.now()}`;

                // Save to Firebase
                await firebase.firestore()
                    .collection('users')
                    .doc(userId)
                    .collection('loads')
                    .doc(loadId)
                    .set({
                        ...calc,
                        loadId,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                // Mark as synced and delete
                await window.offlineStorage.deleteSynced('calculations', calc.id);

                console.log(`✅ Synced calculation #${calc.id}`);
            } catch (error) {
                console.error(`❌ Failed to sync calculation #${calc.id}:`, error);
            }
        }
    }

    /**
     * Sync expenses to Firebase
     */
    async syncExpenses() {
        const unsynced = await window.offlineStorage.getUnsyncedItems('expenses');

        if (unsynced.length === 0) {
            console.log('✅ No expenses to sync');
            return;
        }

        console.log(`📤 Syncing ${unsynced.length} expenses...`);

        for (const expense of unsynced) {
            try {
                const userId = firebase.auth().currentUser.uid;
                const expenseId = `${userId}_${Date.now()}`;

                // Save to Firebase
                await firebase.firestore()
                    .collection('users')
                    .doc(userId)
                    .collection('expenses')
                    .doc(expenseId)
                    .set({
                        ...expense,
                        id: expenseId,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                // Mark as synced and delete
                await window.offlineStorage.deleteSynced('expenses', expense.id);

                console.log(`✅ Synced expense #${expense.id}`);
            } catch (error) {
                console.error(`❌ Failed to sync expense #${expense.id}:`, error);
            }
        }
    }

    /**
     * Show notification to user
     */
    showNotification(title, message) {
        // Try native notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/img/icons/icon-192x192.png',
                badge: '/img/icons/icon-72x72.png'
            });
        }

        // Also show in-app notification
        this.showInAppNotification(title, message);
    }

    /**
     * Show in-app notification banner
     */
    showInAppNotification(title, message) {
        // Check if banner already exists
        let banner = document.getElementById('syncNotificationBanner');

        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'syncNotificationBanner';
            banner.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        z-index: 10000;
        font-family: Inter, sans-serif;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      `;
            document.body.appendChild(banner);

            // Add animation
            const style = document.createElement('style');
            style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `;
            document.head.appendChild(style);
        }

        banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">${navigator.onLine ? '🌐' : '📴'}</div>
        <div>
          <div style="font-weight: 600; font-size: 14px;">${title}</div>
          <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;

        // Auto-hide after 4 seconds
        setTimeout(() => {
            banner.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => banner.remove(), 300);
        }, 4000);
    }

    /**
     * Get sync status
     */
    async getStatus() {
        const stats = await window.offlineStorage.getStats();

        const unsyncedCalcs = await window.offlineStorage.getUnsyncedItems('calculations');
        const unsyncedExpenses = await window.offlineStorage.getUnsyncedItems('expenses');

        return {
            online: navigator.onLine,
            syncInProgress: this.syncInProgress,
            pending: {
                calculations: unsyncedCalcs.length,
                expenses: unsyncedExpenses.length
            },
            cached: stats
        };
    }
}

// Global instance
window.syncManager = window.syncManager || new SyncManager();

// Expose sync function globally
window.manualSync = () => window.syncManager.syncAll();

console.log('🔄 Sync Manager initialized');
