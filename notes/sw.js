/* Notes – service worker: keeps the site itself for offline use (the notes are in IndexedDB, see app.js).
   The site's files are answered from the cache at once and refreshed in the background; a new VERSION here
   (bumped with every change of the site) makes the browser fetch all of them again. Requests to the server are not touched. */
const VERSION = 'notes-v8';
const FILES = ['./', 'index.html', 'style.css?v=8', 'i18n.js?v=8', 'app.js?v=8', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png',
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
// "Share" from another app (manifest share_target, Android): the text, link and files are kept in the cache
// "notes-share" and the site opens with ?share=1, where app.js offers to save them as a note
async function takeShare(req, scope) {
  try {
    const fd = await req.formData(), c = await caches.open('notes-share');
    for (const k of await c.keys()) await c.delete(k);
    const key = (k) => new URL('share-cache/' + k, scope).href;
    const files = fd.getAll('files').filter((f) => f && typeof f === 'object' && f.size);
    await Promise.all(files.map((f, i) => c.put(key('file/' + i), new Response(f, {headers: {'content-type': f.type || 'application/octet-stream'}}))));
    const meta = {title: String(fd.get('title') || ''), text: String(fd.get('text') || ''), url: String(fd.get('url') || ''), at: Date.now(),
      files: files.map((f, i) => ({name: f.name || 'file', type: f.type || '', key: 'file/' + i}))};
    await c.put(key('meta'), new Response(JSON.stringify(meta), {headers: {'content-type': 'application/json'}}));
  } catch (e) { /* nothing usable came: the site just opens */ }
  return Response.redirect(new URL('./?share=1', scope).href, 303);
}
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  const scope = new URL(self.registration.scope);
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname === scope.pathname + 'share') return e.respondWith(takeShare(e.request, scope.href));
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
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
