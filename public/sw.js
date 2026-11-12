const CACHE_VERSION = 'v5';
const APP_CACHE = `gallinero-app-${CACHE_VERSION}`;
const PRECACHE = [
  '/',
  '/login',
  '/login/recuperar',
  '/dashboard/guia',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-192.png',
  '/icon-512.png',
];

function isRedirectedToLogin(requestUrl, response) {
  if (!response || !response.url) return false;
  try {
    const finalUrl = new URL(response.url);
    return !requestUrl.pathname.startsWith('/login') && finalUrl.pathname.startsWith('/login');
  } catch {
    return false;
  }
}

function buildRscCacheKey(url, includeQuery) {
  const canonical = new URL(url.origin + url.pathname);
  if (includeQuery) {
    url.searchParams.forEach((value, key) => {
      if (key !== '_rsc') canonical.searchParams.append(key, value);
    });
  }
  canonical.searchParams.set('__sw_rsc', '1');
  return canonical.toString();
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          fetch(url, { credentials: 'include' }).then((res) => {
            if (res.ok) {
              return cache.put(url, res);
            }
          })
        )
      )
    )
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
            .filter((k) => k.startsWith('gallinero-') && k !== APP_CACHE)
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

  // Los datos de la API se gestionan de forma estructurada e idempotente en IndexedDB.
  if (url.pathname.startsWith('/api/')) return;

  const accept = request.headers.get('accept') || '';
  const isRscRequest = url.searchParams.has('_rsc') || request.headers.get('rsc') === '1';
  const isHtmlRequest = request.mode === 'navigate' || (!isRscRequest && accept.includes('text/html'));

  // 1. Payloads RSC de Next.js App Router (navegación SPA entre módulos)
  if (isRscRequest) {
    const specificRscKey = buildRscCacheKey(url, true);
    const pathRscKey = buildRscCacheKey(url, false);

    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !isRedirectedToLogin(url, res)) {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => {
              c.put(request, clone.clone());
              c.put(specificRscKey, clone.clone());
              if (pathRscKey !== specificRscKey) {
                c.put(pathRscKey, clone.clone());
              }
            });
          }
          return res;
        })
        .catch(async () => {
          const cachedExact = await caches.match(request, { ignoreVary: true });
          if (cachedExact) return cachedExact;

          const cachedSpecific = await caches.match(specificRscKey, { ignoreVary: true });
          if (cachedSpecific) return cachedSpecific;

          const cachedPath = await caches.match(pathRscKey, { ignoreVary: true });
          if (cachedPath) return cachedPath;

          return new Response('', { status: 503 });
        })
    );
    return;
  }

  // 2. Documentos HTML (navegaciones completas y espejo offline de páginas)
  if (isHtmlRequest) {
    const canonicalPageKey = url.origin + url.pathname;

    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !isRedirectedToLogin(url, res)) {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => {
              c.put(request, clone.clone());
              c.put(canonicalPageKey, clone.clone());
            });
          }
          return res;
        })
        .catch(async () => {
          const cachedExact = await caches.match(request, { ignoreVary: true });
          if (cachedExact) return cachedExact;

          const cachedPage = await caches.match(canonicalPageKey, { ignoreVary: true });
          if (cachedPage) return cachedPage;

          if (url.pathname.startsWith('/dashboard')) {
            const cachedDashboard = await caches.match(url.origin + '/dashboard', { ignoreVary: true });
            if (cachedDashboard) return cachedDashboard;
          }

          const rootFallback = await caches.match(url.origin + '/', { ignoreVary: true });
          if (rootFallback) return rootFallback;

          return new Response(
            'Sin conexión a Internet. Conéctate una vez y guarda la copia offline para usar este módulo sin señal.',
            {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // 3. Assets estáticos (chunks JS/CSS de Next, imágenes, íconos, fuentes)
  const isImmutableNextStatic = url.pathname.startsWith('/_next/static/');
  e.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached && isImmutableNextStatic) {
        return cached;
      }

      const network = fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached || new Response('', { status: 504 }));

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

// Mensajes opcionales del cliente para activar inmediatamente el SW actualizado
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
