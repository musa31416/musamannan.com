/* Leem Lab lock screen. Derives the key from the password (PBKDF2-SHA256),
   checks it, decrypts this page's payload (AES-GCM) and replaces the document.
   The derived key is kept in sessionStorage, or localStorage when
   "Remember this device" is ticked, so other pages open without asking. */
(function () {
  var KEY = 'leemlab-key-v1';
  var me = document.currentScript;
  var payload = me.getAttribute('data-payload');
  var $ = function (id) { return document.getElementById(id); };
  function b64d(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function b64e(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function store(get, k, v) {
    try { if (get) return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) { return null; }
    try { if (v === null) { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); return; } sessionStorage.setItem(KEY, v); if (k) localStorage.setItem(KEY, v); } catch (e) {}
  }
  function aes(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); }
  function dec(key, buf) { var u = new Uint8Array(buf); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12)); }
  function showForm(msg) {
    $('gate-wait').hidden = true; $('gate').hidden = false;
    if (msg) $('gate-err').textContent = msg;
    $('gate-pw').focus();
  }
  function open(key) {
    return fetch(payload, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('fetch'); return r.arrayBuffer();
    }).then(function (buf) { return dec(key, buf); }).then(function (pt) {
      var html = new TextDecoder().decode(pt);
      document.open(); document.write(html); document.close();
    });
  }
  if (!window.crypto || !crypto.subtle) { showForm('This browser cannot decrypt the page. Use an up-to-date browser over https.'); return; }
  var cfgP = fetch('/leemlab/_gate/config.json', { cache: 'no-cache' }).then(function (r) { return r.json(); });
  var saved = store(true);
  var start = saved ? aes(b64d(saved)).then(open).catch(function () { store(false, false, null); showForm(''); }) : Promise.resolve(showForm(''));

  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'gate-form') return;
    e.preventDefault();
    var pw = $('gate-pw').value, rem = $('gate-rem').checked, btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Checking…'; $('gate-err').textContent = '';
    var raw;
    cfgP.then(function (cfg) {
      return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(cfg.salt), iterations: cfg.iter, hash: 'SHA-256' }, k, 256);
      }).then(function (bits) {
        raw = new Uint8Array(bits); return aes(raw);
      }).then(function (key) {
        return dec(key, b64d(cfg.check).buffer).then(function () { return key; });
      });
    }).then(function (key) {
      store(false, rem, b64e(raw));
      return open(key);
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Unlock';
      showForm('That password is not right.');
      $('gate-pw').select();
    });
  });
})();
