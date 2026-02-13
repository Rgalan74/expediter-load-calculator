// Service Worker for Expediter PWA
// Version: 1.0.0

const CACHE_NAME = 'expediter-v5.0.0';
const RUNTIME_CACHE = 'expediter-runtime-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/app.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/css/app.css',
    '/css/design-system.css',
    '/js/app.js',
    '/js/auth.js',
    '/img/logo-app.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first for Firebase, cache first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-HTTP requests
    if (!request.url.startsWith('http')) {
        return;
    }

    // Firebase requests - Network First strategy
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebasestorage')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets - Cache First strategy
    if (request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'image') {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // HTML requests - Network First with fallback
    event.respondWith(networkFirstStrategy(request));
});

// Cache First Strategy - for static assets
async function cacheFirstStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        // Return offline page if available
        return caches.match('/offline.html') || new Response('Offline');
    }
}

// Network First Strategy - for dynamic content
async function networkFirstStrategy(request) {
    const cache = await caches.open(RUNTIME_CACHE);

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        console.error('[SW] Network request failed:', error);
        return new Response('Network error', { status: 503 });
    }
}

// Background Sync for offline operations
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    if (event.tag === 'sync-loads') {
        event.waitUntil(syncLoads());
    }
});

async function syncLoads() {
    // TODO: Implement sync logic when IndexedDB is added
    console.log('[SW] Syncing loads...');
}

// Push Notification handler
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Expediter Notification';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/icon-192.png',
        badge: '/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data.url || '/';

    event.waitUntil(
        clients.openWindow(url)
    );
});
