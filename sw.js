/* Penumbra: service worker. Guarda o app para uso offline.
   Suba a versão abaixo sempre que alterar qualquer arquivo do app. */
const VERSION = 'penumbra-v6';
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
// Bibliotecas e fonte vêm de CDNs com CORS. Ficam guardadas para funcionar sem internet.
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PRECACHE_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  PDFJS + 'pdf.min.js',
  PDFJS + 'pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap'
];
const corsReq = (url) => new Request(url, { mode: 'cors', credentials: 'omit' });

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // Se estiver sem rede agora, as bibliotecas entram no cache no primeiro uso.
    await Promise.all(PRECACHE_CDN.map(async (url) => {
      try { const r = await fetch(corsReq(url)); if (r.ok) await cache.put(url, r); } catch (e) { /* tenta no uso */ }
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

  // Página: busca a versão nova; sem rede, usa a cópia guardada.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const r = await fetch(req);
        if (r && r.ok) { cache.put('index.html', r.clone()); return r; }
      } catch (e) { /* offline */ }
      return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
    })());
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  // Demais arquivos: cópia guardada primeiro; se não houver, busca e guarda.
  // Arquivos de CDN são sempre buscados com CORS, para servirem tanto a <script> quanto a fetch().
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req.url);
    if (hit) return hit;
    try {
      const r = await fetch(sameOrigin ? req : corsReq(req.url));
      if (r && r.ok) cache.put(req.url, r.clone());
      return r;
    } catch (e) {
      return Response.error();
    }
  })());
});
