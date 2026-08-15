const CACHE_VERSION = 'v2';
const APP_CACHE = `gallinero-app-${CACHE_VERSION}`;
const PRECACHE = ['/', '/manifest.json', '/icon-192.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Los datos de la API nunca se cachean: siempre van a la red.
  // Cachearlos servía registros obsoletos después de cada guardado.
  if (url.pathname.startsWith('/api/')) return;

  // Navegaciones: network-first con fallback al caché para modo offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('/', clone));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate.
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
