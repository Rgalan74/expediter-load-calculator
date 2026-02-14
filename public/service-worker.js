/**
 * service-worker.js
 * Service Worker para Expediter App
 * Estrategias de cache para mejor performance
 * Version: 1.0.1
 */

const CACHE_VERSION = 'expediter-v5.3.0-FORCE-REFRESH';
const CACHE_NAME = 'expediter-v5.3.0-FORCE-REFRESH';
// DEPLOY_TIMESTAMP: 2026-01-29T13:15:00 - CLEAN_REPORTS

// Assets críticos para pre-cachear
const PRECACHE_ASSETS = [
  '/app.html',
  '/css/design-system.css',
  '/css/app.css',
  '/css/ui-enhancements.css',
  '/js/config.js',
  '/js/helpers.js',
  '/js/ui-feedback.js',
  '/js/main.js',
  '/img/logo-app.webp',
  '/favicon.png',
  '/icon-192.png'
];

// ========================================
// INSTALL - Pre-cache assets críticos
// ========================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching critical assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Pre-cache complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Pre-cache failed:', error);
      })
  );
});

// ========================================
// ACTIVATE - Limpiar caches viejos
// ========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// ========================================
// ESTRATEGIAS DE CACHE
// ========================================

/**
 * Network First - Para HTML y API calls
 * Intenta red primero, fallback a cache
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Si la respuesta es válida, cachear
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Si nada funciona, retornar error
    throw error;
  }
}

/**
 * Cache First - Para assets estáticos
 * Intenta cache primero, fallback a red
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed for:', request.url, error);
    throw error;
  }
}

/**
 * Stale While Revalidate - Para JS/CSS
 * Retorna cache inmediatamente, actualiza en background
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      // Validar respuesta antes de clonar y cachear
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
        return networkResponse;
      }

      // Clonar ANTES de usar/retornar
      const responseToCache = networkResponse.clone();

      caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(request, responseToCache);
        })
        .catch(err => console.error('[SW] Cache put failed:', err));

      return networkResponse;
    })
    .catch((error) => {
      console.log('[SW] Background fetch failed:', error);
    });

  // Retornar cache si existe, sino esperar red
  return cachedResponse || fetchPromise;
}

// ========================================
// FETCH - Routing de estrategias
// ========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests de otros dominios (APIs externas, etc.)
  if (url.origin !== location.origin) {
    return;
  }

  // Ignorar Chrome extensions y dev tools
  if (url.protocol === 'chrome-extension:' || url.protocol === 'devtools:') {
    return;
  }

  // ========================================
  // ESTRATEGIA POR TIPO DE RECURSO
  // ========================================

  // HTML -> Network First
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Imágenes -> Cache First
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/i)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Fonts -> Cache First
  if (request.destination === 'font' || url.pathname.match(/\.(woff|woff2|ttf|eot)$/i)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // JS/CSS -> Stale While Revalidate
  if (request.destination === 'script' || request.destination === 'style' ||
    url.pathname.match(/\.(js|css)$/i)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Firestore/Firebase -> Network First (siempre fresh)
  if (url.hostname.includes('firestore') || url.hostname.includes('firebase')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default -> Network First
  event.respondWith(networkFirst(request));
});

// ========================================
// MESSAGES - Comunicación con app
// ========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[SW] Service Worker loaded successfully');
