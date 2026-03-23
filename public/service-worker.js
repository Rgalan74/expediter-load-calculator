/**
 * service-worker.js
 * Smart Load Solution - PWA Service Worker
 * Version: 1.0.0
 */

const CACHE_NAME = 'smartload-v1.0.18'; // Bumped for SW fetch exclusions

// Archivos esenciales para funcionar offline
const CORE_ASSETS = [
  '/app.html',
  '/app.css',
  '/manifest.json',
  '/icon192.png',
  '/icon512.png',
  '/favicon.png'
];

// ================================
// INSTALL - Cachear archivos core
// ================================
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.log('[SW] Cache failed:', err))
  );
});

// ================================
// ACTIVATE - Limpiar caches viejos
// ================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ================================
// FETCH - Network first strategy
// Firebase y APIs siempre van a la red
// ================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase, Stripe, APIs externas, y esquemas no-HTTP - siempre red
  if (
    !url.protocol.startsWith('http') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('stripe') ||
    url.hostname.includes('maps.google') ||
    url.hostname.includes('facebook') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('openrouter') ||
    url.hostname.includes('weatherapi') ||
    url.hostname.includes('rainviewer') ||
    url.hostname.includes('openweathermap') ||
    url.hostname.includes('googletagmanager') ||
    url.hostname.includes('google-analytics') ||
    url.hostname !== 'app.smartloadsolution.com' && url.hostname !== 'smartloadsolution.com' ||
    event.request.method !== 'GET'
  ) {
    return; // No interceptar
  }

  // Para todo lo demás: Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, actualizar cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red - usar cache
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            // Si es navegación y no hay cache, mostrar app.html
            if (event.request.mode === 'navigate') {
              return caches.match('/app.html');
            }
          });
      })
  );
});

// ================================
// MESSAGE - Para forzar actualizacion
// ================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});