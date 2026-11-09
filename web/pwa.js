/* SMART — ຕິດຕັ້ງເປັນແອັບ (PWA) ແລະ ກວດອັບເດດອັດຕະໂນມັດ */
(function () {
  if ('serviceWorker' in navigator) window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // ກວດສະບັບໃໝ່ທຸກຄັ້ງທີ່ກັບມາເປີດແອັບ ແລະ ທຸກໆ 30 ນາທີ
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
    }).catch(function (e) { console.warn('SW register failed', e); });
  });

  // 🔄 ອັບເດດອັດຕະໂນມັດ: ກວດ version.json ທຸກຄັ້ງທີ່ເປີດແອັບຄືນ ແລະ ທຸກ 5 ນາທີ.
  // ຖ້າມີສະບັບໃໝ່ → reload ເອງ (ຍັງຢູ່ໃນລະບົບ ແລະ ກັບມາໜ້າເດີມ). ຖ້າກຳລັງພິມຂໍ້ມູນຢູ່ ຈະຖາມກ່ອນ ເພື່ອບໍ່ໃຫ້ຂໍ້ມູນເສຍ.
  var MY_VER = (window.SMART_CONFIG || {}).VERSION, lastInput = 0, banner = null, reloading = false;
  document.addEventListener('input', function () { lastInput = Date.now(); }, true);
  function currentTab() { var b = document.querySelector('#mainTabs .nav-link.active'); return b && b.id ? b.id.replace(/-tab$/, '') : ''; }
  function doReload() {
    if (reloading) return; reloading = true;
    try { sessionStorage.setItem('smart_reopen_tab', currentTab()); } catch (e) {}
    location.reload();
  }
  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99999;background:#1a365d;color:#fff;border-radius:12px;' +
      'padding:10px 14px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center;max-width:calc(100% - 24px)');
    banner.innerHTML = '<span>🔄 ມີສະບັບໃໝ່ຂອງແອັບ</span>';
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = 'ອັບເດດດຽວນີ້';
    b.setAttribute('style', 'border:0;border-radius:8px;padding:6px 12px;background:#ff8c00;color:#fff;font-weight:600;cursor:pointer');
    b.onclick = doReload;
    banner.appendChild(b); document.body.appendChild(banner);
  }
  function checkVersion() {
    if (!MY_VER || reloading || !navigator.onLine) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.version || v.version === MY_VER) return;
      // ກັນ reload ວົນ: ຖ້າ reload ໄປແລ້ວເທື່ອໜຶ່ງສຳລັບສະບັບນີ້ ແຕ່ຍັງໄດ້ໜ້າເກົ່າ (cache) → ສະແດງປຸ່ມແທນ
      var tried = ''; try { tried = sessionStorage.getItem('smart_reload_for') || ''; } catch (e) {}
      var busy = Date.now() - lastInput < 2 * 60 * 1000; // ພິມຂໍ້ມູນພາຍໃນ 2 ນາທີ
      if (busy || tried === v.version) { showBanner(); return; }
      try { sessionStorage.setItem('smart_reload_for', v.version); } catch (e) {}
      doReload();
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkVersion(); });
  window.addEventListener('online', checkVersion);
  window.addEventListener('load', function () { setTimeout(checkVersion, 3000); });
  setInterval(checkVersion, 5 * 60 * 1000);

  // ຫຼັງ reload ເພື່ອອັບເດດ: ກັບໄປໜ້າທີ່ເປີດຢູ່ (ເມື່ອເຂົ້າລະບົບແລ້ວ)
  try {
    var reopen = sessionStorage.getItem('smart_reopen_tab');
    if (reopen) {
      sessionStorage.removeItem('smart_reopen_tab');
      var tries = 0, t = setInterval(function () {
        var app = document.getElementById('main-app');
        if (++tries > 40) return clearInterval(t);
        if (app && app.style.display !== 'none' && typeof window.switchTab === 'function' && document.getElementById(reopen + '-tab')) {
          clearInterval(t); try { window.switchTab(reopen); } catch (e) {}
        }
      }, 500);
    }
  } catch (e) {}

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
