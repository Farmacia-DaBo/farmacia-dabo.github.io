/* Farmacia — service worker */
importScripts('core.js');
const CACHE = 'farmacia-v1.6.0';
const FILES = ['./', './index.html', './core.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/badge-96.png'];

self.addEventListener('install', e => {
  // cache: 'reload' = scarica sempre dal sito, mai dalla cache HTTP del browser
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw new Error('offline');
    }
  })());
});

async function controllo() {
  const db = await IDB.get('stato');
  if (db && db.impostazioni) impostaOrari(db.impostazioni.orari);
  if (!db || !db.impostazioni || !db.impostazioni.notifiche) return;
  db.impostazioni = Object.assign(impostazioniDefault(), db.impostazioni);
  const av = testoAvviso(db);
  try { if (self.navigator.setAppBadge) av.count ? await self.navigator.setAppBadge(av.count) : await self.navigator.clearAppBadge(); } catch {}
  const oggi = isoData();
  if (!av.count || (await IDB.get('ultimaNotifica')) === oggi) return;
  await self.registration.showNotification('Farmacia', {
    body: av.body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'scorte', renotify: false
  });
  await IDB.set('ultimaNotifica', oggi);
}
self.addEventListener('periodicsync', e => { if (e.tag === 'controllo-scorte') e.waitUntil(controllo()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});
