/* Penumbra: service worker. Guarda o app para uso offline.
   Suba a versão abaixo sempre que alterar qualquer arquivo do app. */
const VERSION = 'penumbra-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
// Bibliotecas e fontes vêm de CDNs. Ficam guardadas na primeira vez que são usadas.
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const PRECACHE_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // Tenta guardar as bibliotecas já na instalação; se estiver sem rede, elas entram depois.
    await Promise.all(PRECACHE_CDN.map(async (url) => {
      try { const r = await fetch(url, { mode: 'no-cors' }); await cache.put(url, r); } catch (e) { /* tenta de novo no uso */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: usa a cópia guardada e atualiza em segundo plano.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = (await cache.match('index.html')) || (await cache.match('./'));
      const fresh = fetch(req).then((r) => { if (r && r.ok) cache.put('index.html', r.clone()); return r; }).catch(() => null);
      return cached || (await fresh) || Response.error();
    })());
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  // Demais arquivos: cópia guardada primeiro; se não houver, busca na rede e guarda.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
      return r;
    } catch (e) {
      return Response.error();
    }
  })());
});
