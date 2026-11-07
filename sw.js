/* My Server – service worker: shows push notifications in the subscriber's language. */
importScripts('i18n.js');

const WORKER = 'https://myserver-api.darksky484.workers.dev';
const ICON = 'icon-192.png?v=2', BADGE = 'badge-72.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function savedLang() {
  try { const r = await (await caches.open('ms-meta')).match('lang'); if (r) { const l = await r.text(); if (self.MS_I18N[l]) return l; } } catch (e) { /* */ }
  return 'uk';
}

// The Cloudflare watchdog's push (the server itself is down / back): it says what happened ({type: 'watch'});
// an empty one comes from an older Worker, then /watch is asked
function watchText(lang, w) {
  const P = self.MS_I18N[lang].pn;
  if (w.down) return w.agentOnly ? {title: P.agentT, body: P.agentB, tag: 'down', critical: true} : {title: P.downT, body: P.downB, tag: 'down', critical: true};
  return {title: P.upT, body: w.min ? self.MS_FMT.fill(P.upB, {m: w.min}) : '', tag: 'down'};
}
async function fromWatchdog(lang) {
  try {
    const w = await (await fetch(WORKER + '/watch', {cache: 'no-store'})).json();
    const min = !w.down && w.lastDown && w.recoveredAt ? Math.max(1, Math.round((w.recoveredAt - w.lastDown) / 60000)) : null;
    return watchText(lang, {down: w.down, agentOnly: w.agentOnly, min});
  } catch (e) {
    return watchText(lang, {down: true});
  }
}

self.addEventListener('push', (e) => e.waitUntil((async () => {
  let m = null;
  try { m = e.data ? e.data.json() : null; } catch (x) { m = null; }
  const lang = (m && self.MS_I18N[m.lang] && m.lang) || await savedLang();
  const n = m && m.type === 'watch' ? watchText(lang, m) : m ? self.MS_FMT.pushText(lang, m) : await fromWatchdog(lang);
  const P = self.MS_I18N[lang].pn;
  const opts = {
    body: n.body || '', tag: n.tag, renotify: true, icon: ICON, badge: BADGE,
    silent: !!(m && m.silent), timestamp: (m && m.ts) || Date.now(), requireInteraction: !!n.critical,
    data: {view: n.view || 'overview'},
    actions: n.critical ? [{action: 'open', title: P.open}, {action: 'console', title: P.console}] : [{action: 'open', title: P.open}],
  };
  return self.registration.showNotification(n.title, opts);
})()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'console') { e.waitUntil(self.clients.openWindow('https://cloud.oracle.com')); return; }
  const url = new URL('./#' + ((e.notification.data && e.notification.data.view) || 'overview'), self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const c of all) { if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.postMessage({view: e.notification.data && e.notification.data.view}); return; } }
    await self.clients.openWindow(url);
  })());
});
