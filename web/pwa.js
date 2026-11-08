/* SMART — ຕິດຕັ້ງເປັນແອັບ (PWA) ແລະ ກວດອັບເດດອັດຕະໂນມັດ */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // ກວດສະບັບໃໝ່ທຸກຄັ້ງທີ່ກັບມາເປີດແອັບ ແລະ ທຸກໆ 30 ນາທີ
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
    }).catch(function (e) { console.warn('SW register failed', e); });
  });

  // ປຸ່ມ "ຕິດຕັ້ງແອັບ" (Chrome / Edge / Android)
  var deferred = null, btn = null;
  function standalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }
  function showBtn() {
    if (btn || standalone()) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '📲 ຕິດຕັ້ງແອັບ';
    btn.setAttribute('style', 'position:fixed;left:12px;bottom:12px;z-index:99999;border:0;border-radius:999px;padding:9px 16px;' +
      'background:#ff8c00;color:#fff;font-weight:600;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer');
    btn.onclick = function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; if (btn) { btn.remove(); btn = null; } });
    };
    document.body.appendChild(btn);
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; showBtn(); });
  window.addEventListener('appinstalled', function () { if (btn) { btn.remove(); btn = null; } });
})();
