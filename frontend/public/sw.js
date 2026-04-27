/* OPUS MANAGER — Service Worker v1
 * Estrategia: network-first con fallback a cache para rutas principales.
 * No intercepta /api/* ni /static/* (deja que el navegador los gestione).
 */
const CACHE_VERSION = 'opus-v1';
const APP_SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/seguimiento',
  '/portal',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // No cachear APIs ni peticiones cross-origin (Supabase, etc.)
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  // Network-first con fallback a cache
  event.respondWith(
    fetch(req)
      .then((resp) => {
        // Solo cacheamos respuestas válidas de la app
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => null);
        }
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/login')))
  );
});
