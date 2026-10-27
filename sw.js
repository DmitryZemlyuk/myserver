/* My Server – service worker: shows push notifications in the subscriber's language. */
importScripts('i18n.js');

const WORKER = 'https://myserver-api.darksky484.workers.dev';
const ICON = 'icon-192.png', BADGE = 'badge-72.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function savedLang() {
  try { const r = await (await caches.open('ms-meta')).match('lang'); if (r) { const l = await r.text(); if (self.MS_I18N[l]) return l; } } catch (e) { /* */ }
  return 'uk';
}

// An empty push comes from the Cloudflare watchdog (the server itself is down): ask it what happened.
async function fromWatchdog(lang) {
  const P = self.MS_I18N[lang].pn;
  try {
    const w = await (await fetch(WORKER + '/watch', {cache: 'no-store'})).json();
    if (w.down) return w.agentOnly ? {title: P.agentT, body: P.agentB, tag: 'down', critical: true} : {title: P.downT, body: P.downB, tag: 'down', critical: true};
    const m = w.lastDown && w.recoveredAt ? Math.max(1, Math.round((w.recoveredAt - w.lastDown) / 60000)) : null;
    return {title: P.upT, body: m ? self.MS_FMT.fill(P.upB, {m}) : '', tag: 'down'};
  } catch (e) {
    return {title: P.downT, body: P.downB, tag: 'down', critical: true};
  }
}

self.addEventListener('push', (e) => e.waitUntil((async () => {
  let m = null;
  try { m = e.data ? e.data.json() : null; } catch (x) { m = null; }
  const lang = (m && self.MS_I18N[m.lang] && m.lang) || await savedLang();
  const n = m ? self.MS_FMT.pushText(lang, m) : await fromWatchdog(lang);
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
