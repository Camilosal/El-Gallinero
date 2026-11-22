const CACHE_VERSION = 'v13';
const APP_CACHE = `gallinero-app-${CACHE_VERSION}`;
const IS_DEVELOPMENT_ORIGIN =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  Boolean(self.location.port);
const PRECACHE = [
  '/',
  '/login',
  '/login/recuperar',
  '/guia',
  '/inicio',
  '/escanear',
  '/operaciones/cierre',
  '/manual',
  '/manifest.json',
  '/logo-iwagranja-horizontal.webp',
  '/logo-iwagranja.webp',
  '/logo-iwagranja-mark.webp',
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
            const reqUrl = new URL(url, self.location.origin);
            if (res.ok && !isRedirectedToLogin(reqUrl, res)) {
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

  // Turbopack reuses development chunk URLs while replacing their factories.
  // Never serve or store those mutable assets through the offline cache.
  if (IS_DEVELOPMENT_ORIGIN && url.pathname.startsWith('/_next/')) return;

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

          if (
            url.pathname === '/inicio' ||
            url.pathname.startsWith('/inicio/') ||
            url.pathname.startsWith('/almacen') ||
            url.pathname.startsWith('/analisis') ||
            url.pathname.startsWith('/animales') ||
            url.pathname.startsWith('/configuracion') ||
            url.pathname.startsWith('/contactos') ||
            url.pathname.startsWith('/escanear') ||
            url.pathname.startsWith('/exportar') ||
            url.pathname.startsWith('/finanzas') ||
            url.pathname.startsWith('/manual') ||
            url.pathname.startsWith('/inventarios') ||
            url.pathname.startsWith('/operaciones') ||
            url.pathname.startsWith('/planeacion') ||
            url.pathname.startsWith('/produccion') ||
            url.pathname.startsWith('/sanidad') ||
            url.pathname.startsWith('/soberania') ||
            url.pathname.startsWith('/ubicaciones')
          ) {
            const cachedAppShell = await caches.match(url.origin + '/inicio', { ignoreVary: true });
            if (cachedAppShell) return cachedAppShell;
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
  // C2: push local de briefings, solo si el cliente ya verificó el permiso del usuario.
  if (event.data && event.data.type === 'SHOW_BRIEFING_NOTIFICATION') {
    const payload = sanitizeBriefingPushPayload(event.data.payload);
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: payload.url },
      })
    );
  }
});

// C2: privacidad — la notificación nunca lleva datos sensibles de la granja
// (hallazgos, cifras, nombres). Solo título genérico + conteo de novedades.
function sanitizeBriefingPushPayload(raw) {
  const count = Math.max(0, Math.floor(Number(raw && raw.unreadCount) || 0));
  return {
    title: 'Gina te informa',
    body:
      count === 1
        ? 'Tienes 1 novedad de tu granja. Ábrela en IwaGranja.'
        : 'Tienes ' + count + ' novedades de tu granja. Ábrelas en IwaGranja.',
    url: '/inicio',
    tag: 'gina-briefing',
  };
}

self.addEventListener('push', (event) => {
  let raw = null;
  try {
    raw = event.data ? event.data.json() : null;
  } catch {
    raw = null;
  }
  const payload = sanitizeBriefingPushPayload(raw);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/inicio';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl).catch(() => undefined);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
