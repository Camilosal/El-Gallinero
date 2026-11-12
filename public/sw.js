const CACHE_VERSION = 'v4';
const APP_CACHE = `gallinero-app-${CACHE_VERSION}`;
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Los datos de la API nunca se cachean a nivel HTTP para evitar respuestas obsoletas.
  // La persistencia de datos offline se gestiona de forma estructurada e idempotente en IndexedDB.
  if (url.pathname.startsWith('/api/')) return;

  // Navegaciones de páginas y payloads RSC de Next.js: Network-first con fallback al caché.
  const isRscRequest = url.searchParams.has('_rsc');
  if (request.mode === 'navigate' || isRscRequest) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => {
              c.put(request, clone);
              if (request.mode === 'navigate') {
                c.put(url.pathname, clone.clone());
              }
            });
          }
          return res;
        })
        .catch(async () => {
          // 1. Intentar servir la ruta solicitada guardada previamente
          const cachedExact = await caches.match(request);
          if (cachedExact) return cachedExact;

          if (isRscRequest) {
            return new Response('', { status: 503 });
          }

          const cachedPath = await caches.match(url.pathname);
          if (cachedPath) return cachedPath;

          // 2. Fallback a la ruta dashboard si aplica
          if (url.pathname.startsWith('/dashboard')) {
            const cachedDashboard = await caches.match('/dashboard');
            if (cachedDashboard) return cachedDashboard;
          }

          // 3. Fallback a la raíz precacheada
          const rootFallback = await caches.match('/');
          if (rootFallback) return rootFallback;

          return new Response('Sin conexión a Internet. Por favor reconecta para cargar esta sección por primera vez.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Assets estáticos (JS, CSS, imágenes, iconos, fuentes): Stale-While-Revalidate.
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

// Soporte para Background Sync (Android/Chrome)
self.addEventListener('sync', (event) => {
  if (event.tag === 'gallinero-sync' || event.tag === 'sync-gallinero-records') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'GALLINERO_TRIGGER_SYNC' });
        });
      })
    );
  }
});
