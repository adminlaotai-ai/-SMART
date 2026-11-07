/* SMART — ໃຊ້ແທນ google.script.run ເມື່ອໜ້າເວັບ host ຢູ່ນອກ Google (ເຊັ່ນ Vercel).
   ທຸກການເອີ້ນຈະສົ່ງເປັນ POST {fn, args} ໄປຫາ Apps Script Web App (doPost ໃນ Code.gs). */
(function () {
  if (window.google && window.google.script && window.google.script.run) return; // ກຳລັງແລ່ນໃນ Apps Script ຢູ່ແລ້ວ
  var URL = (window.SMART_CONFIG || {}).GAS_WEB_APP_URL;

  function callServer(fn, args) {
    if (!URL) return Promise.reject(new Error('ຍັງບໍ່ໄດ້ຕັ້ງ GAS_WEB_APP_URL ໃນ Vercel'));
    return fetch(URL, {
      method: 'POST',
      // text/plain ເພື່ອບໍ່ໃຫ້ browser ສົ່ງ CORS preflight (Apps Script ບໍ່ຮອງຮັບ OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args }),
      redirect: 'follow'
    }).then(function (r) {
      if (!r.ok) throw new Error('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້ (HTTP ' + r.status + ')');
      return r.json();
    }).then(function (d) {
      if (!d || d.ok !== true) throw new Error((d && d.error) || 'ເຊີບເວີຕອບກັບຜິດພາດ');
      return d.result;
    });
  }

  function runner(onOk, onFail, userObj) {
    var base = {
      withSuccessHandler: function (f) { return runner(f, onFail, userObj); },
      withFailureHandler: function (f) { return runner(onOk, f, userObj); },
      withUserObject: function (o) { return runner(onOk, onFail, o); }
    };
    return new Proxy(base, {
      get: function (t, prop) {
        if (prop in t) return t[prop];
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          callServer(prop, args).then(
            function (res) { if (onOk) onOk(res, userObj); },
            function (err) { if (onFail) onFail(err, userObj); else console.error('[' + prop + ']', err); }
          );
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = {
    run: runner(null, null, undefined),
    host: { close: function () {}, setHeight: function () {}, setWidth: function () {}, editor: { focus: function () {} }, origin: location.origin }
  };
})();
