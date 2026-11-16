// The app's service worker (ADR-009). Written by hand, no library.
// - At install it keeps the built app: the files listed in /precache-manifest.json (made by the build).
// - When the network fails it answers from that copy, so the app opens in airplane mode.
// - /api is never kept and never answered from here: the server is the only source of group data.
// - Each build has its own cache (named by the manifest's version); activation deletes the others.
const PREFIX = 'dan-sensei-';
const MANIFEST = '/precache-manifest.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(MANIFEST, { cache: 'no-store' });
      if (!response.ok) throw new Error('precache manifest unavailable');
      const manifest = await response.json();
      const cache = await caches.open(PREFIX + manifest.version);
      // Every file must be kept, or the install fails and the previous version keeps working.
      await cache.addAll(manifest.urls.map((url) => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Caches come back in creation order: the last one is this version's, made at install.
      const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX));
      await Promise.all(names.slice(0, -1).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js' || url.pathname === MANIFEST) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : file(request));
});

// The page: the network first (always the latest), the kept copy of the app when it fails.
async function page(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('/')) || Response.error();
  }
}

// Other files (hashed names never change): the kept copy first, the network otherwise.
async function file(request) {
  return (await caches.match(request)) || fetch(request);
}
