/* Notes – service worker: keeps the site itself for offline use (the notes are in IndexedDB, see app.js).
   The site's files are answered from the cache at once and refreshed in the background; a new VERSION here
   (bumped with every change of the site) makes the browser fetch all of them again. Requests to the server are not touched. */
const VERSION = 'notes-v1';
const FILES = ['./', 'index.html', 'style.css?v=1', 'i18n.js?v=1', 'app.js?v=1', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png',
  '../fonts/manrope-latin-wght-normal.woff2', '../fonts/manrope-cyrillic-wght-normal.woff2', '../fonts/manrope-latin-ext-wght-normal.woff2',
  '../fonts/jetbrains-mono-latin-wght-normal.woff2', '../fonts/jetbrains-mono-cyrillic-wght-normal.woff2'];

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(VERSION);
  await Promise.all(FILES.map((f) => fetch(f, {cache: 'reload'}).then((r) => (r.ok ? c.put(f, r) : null)).catch(() => null)));
  await self.skipWaiting();
})()));
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('notes-') && k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!u.pathname.startsWith(scope.pathname) && !u.pathname.includes('/fonts/')) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const nav = e.request.mode === 'navigate';
    const key = nav ? './' : e.request;
    const hit = await c.match(key, {ignoreSearch: nav});
    const fresh = fetch(e.request).then((r) => { if (r.ok) c.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(fresh.catch(() => null)); return hit; }
    return fresh.catch(() => (nav ? c.match('./') : Response.error()));
  })());
});
