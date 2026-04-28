/* OPUS MANAGER — Service Worker v2
 * - Network-first con fallback a cache para rutas principales (/api/* y cross-origin no se cachean).
 * - Web Push: muestra notificación con título, cuerpo, icono y URL para foco al click.
 */
const CACHE_VERSION = 'opus-v2';
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

/* ════════════════════════════════════
 * Web Push — recibir y mostrar notificación
 * ════════════════════════════════════ */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'OPUS MANAGER', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'OPUS MANAGER';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/', tipo: data.tipo || 'general' },
    tag: data.tipo || 'opus-notif',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* Click en la notificación → enfocar la pestaña existente o abrir una nueva en `data.url`. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        } catch (e) { /* ignore cross-origin */ }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
