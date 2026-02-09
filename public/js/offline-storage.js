/**
 * INDEXEDDB MANAGER - Offline Storage
 * Stores calculations and user data offline
 */

class OfflineStorage {
    constructor() {
        this.dbName = 'ExpediterDB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('❌ IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for calculations (pending sync)
                if (!db.objectStoreNames.contains('calculations')) {
                    const calcStore = db.createObjectStore('calculations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    calcStore.createIndex('timestamp', 'timestamp', { unique: false });
                    calcStore.createIndex('synced', 'synced', { unique: false });
                }

                // Store for expenses (pending sync)
                if (!db.objectStoreNames.contains('expenses')) {
                    const expenseStore = db.createObjectStore('expenses', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    expenseStore.createIndex('timestamp', 'timestamp', { unique: false });
                    expenseStore.createIndex('synced', 'synced', { unique: false });
                }

                // Store for loads (cached from Firebase)
                if (!db.objectStoreNames.contains('loads')) {
                    const loadStore = db.createObjectStore('loads', {
                        keyPath: 'loadId'
                    });
                    loadStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                console.log('✅ IndexedDB stores created');
            };
        });
    }

    /**
     * Save calculation offline
     */
    async saveCalculation(calcData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['calculations'], 'readwrite');
            const store = transaction.objectStore('calculations');

            const data = {
                ...calcData,
                timestamp: Date.now(),
                synced: false
            };

            const request = store.add(data);

            request.onsuccess = () => {
                console.log('✅ Calculation saved offline:', request.result);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ Error saving calculation:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Save expense offline
     */
    async saveExpense(expenseData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['expenses'], 'readwrite');
            const store = transaction.objectStore('expenses');

            const data = {
                ...expenseData,
                timestamp: Date.now(),
                synced: false
            };

            const request = store.add(data);

            request.onsuccess = () => {
                console.log('✅ Expense saved offline:', request.result);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ Error saving expense:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get all unsynced items
     */
    async getUnsyncedItems(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                // Filter for unsynced items
                const unsyncedOnly = request.result.filter(item => item.synced === false);
                resolve(unsyncedOnly);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Mark item as synced
     */
    async markAsSynced(storeName, id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    data.synced = true;
                    const updateRequest = store.put(data);

                    updateRequest.onsuccess = () => {
                        console.log(`✅ Marked as synced: ${storeName} #${id}`);
                        resolve();
                    };

                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete synced item
     */
    async deleteSynced(storeName, id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`✅ Deleted synced item: ${storeName} #${id}`);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache loads from Firebase
     */
    async cacheLoads(loads) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['loads'], 'readwrite');
            const store = transaction.objectStore('loads');

            // Clear old cache
            store.clear();

            // Add all loads
            loads.forEach(load => {
                store.add({
                    ...load,
                    timestamp: Date.now()
                });
            });

            transaction.oncomplete = () => {
                console.log(`✅ Cached ${loads.length} loads offline`);
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Get cached loads
     */
    async getCachedLoads() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['loads'], 'readonly');
            const store = transaction.objectStore('loads');
            const request = store.getAll();

            request.onsuccess = () => {
                console.log(`✅ Retrieved ${request.result.length} cached loads`);
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get storage stats
     */
    async getStats() {
        if (!this.db) await this.init();

        const stats = {};

        const storeNames = ['calculations', 'expenses', 'loads'];

        for (const storeName of storeNames) {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const count = await new Promise((resolve) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
            });
            stats[storeName] = count;
        }

        return stats;
    }
}

// Global instance
window.offlineStorage = window.offlineStorage || new OfflineStorage();

// Initialize on load
window.addEventListener('load', async () => {
    try {
        await window.offlineStorage.init();
        console.log('🗄️ Offline storage ready');
    } catch (error) {
        console.error('Failed to initialize offline storage:', error);
    }
});

console.log('🗄️ Offline Storage module loaded');
