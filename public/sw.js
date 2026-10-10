// Service Worker: permite abrir o app sem internet. A API (/api/) nunca é cacheada.
// - /_next/static/*: arquivos com hash no nome (imutáveis) → cache-first
// - páginas e demais arquivos → network-first, caindo para o cache quando offline
// Aumente CACHE_VERSION quando mudar a estratégia de cache ou a lista PRECACHE.
const CACHE_VERSION = 'v1';
const CACHE = `visitas-${CACHE_VERSION}`;
const PRECACHE = ['/', '/historico', '/login', '/manifest.webmanifest', '/pcm-worklet.js', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Não guarda payloads RSC (navegação client-side) para não misturar com o HTML da página
        if (response.ok && !url.searchParams.has('_rsc') && !request.headers.has('RSC')) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        if (request.mode === 'navigate') return (await caches.match('/')) || Response.error();
        return Response.error();
      }),
  );
});
