/* SMART — Service Worker
   ດຶງສະບັບໃໝ່ຈາກເຊີບເວີກ່ອນສະເໝີ (network-first) ເພື່ອໃຫ້ແອັບທີ່ຕິດຕັ້ງແລ້ວອັບເດດເອງ.
   ໃຊ້ cache ສະເພາະຕອນບໍ່ມີອິນເຕີເນັດ. ບໍ່ແຕະຂໍ້ມູນທີ່ສົ່ງໄປ Apps Script. */
const CACHE = 'smart-shell-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'config.js', 'gas-bridge.js', 'pwa.js'])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
