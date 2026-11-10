/**
 * Service Worker - PWA "Mi Billetera Lite"
 * Estrategia: Cache First, Network Fallback para el App Shell
 */

const CACHE_NAME = 'billetera-lite-v4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/app.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-512x512.png'
];

// 1. Fase de Instalación: Precachear el App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Fase de Activación: Limpiar cachés antiguas y tomar control inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fase de Fetch: Estrategia Cache First, Network Fallback
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o de esquemas externos (ej. chrome-extension://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Si la respuesta de red es válida, guardar copia en caché dinámicamente
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback sin conexión para navegaciones HTML
          if (
            event.request.mode === 'navigate' ||
            (event.request.headers.get('accept') || '').includes('text/html')
          ) {
            return caches.match('./index.html', { ignoreSearch: true });
          }
          return new Response('Modo sin conexión activo', {
            status: 503,
            statusText: 'Offline'
          });
        });
    })
  );
});

