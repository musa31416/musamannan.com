/* Runs inside a decrypted Leem Lab page: decrypts figures (data-esrc) as they
   are needed and opens PDFs or Word files (data-ehref) on click. Adds a Lock
   button that forgets the key on this device. */
(function () {
  var KEY = 'leemlab-key-v1';
  var raw = null;
  try { raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) {}
  if (!raw) { location.reload(); return; }
  function b64d(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var keyP = crypto.subtle.importKey('raw', b64d(raw), 'AES-GCM', false, ['decrypt']);
  var TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  var cache = {};
  function blobURL(url) {
    if (cache[url]) return cache[url];
    var ext = (url.split('.').pop() || '').toLowerCase();
    cache[url] = Promise.all([keyP, fetch(url + '.enc').then(function (r) { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })]).then(function (a) {
      var u = new Uint8Array(a[1]);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, a[0], u.slice(12));
    }).then(function (pt) { return URL.createObjectURL(new Blob([pt], { type: TYPES[ext] || 'application/octet-stream' })); });
    return cache[url];
  }
  /* figures: decrypt when near the viewport */
  var imgs = Array.prototype.slice.call(document.querySelectorAll('img[data-esrc]'));
  function load(img) { if (img._e) return; img._e = 1; blobURL(img.getAttribute('data-esrc')).then(function (u) { img.src = u; }); }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } }); }, { rootMargin: '600px 0px' });
    imgs.forEach(function (i) { io.observe(i); });
  } else imgs.forEach(load);
  window.addEventListener('beforeprint', function () { imgs.forEach(load); });

  /* files: open in a new tab (PDF, images) or download (Word and others) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-ehref]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    var url = a.getAttribute('data-ehref'), ext = (url.split('.').pop() || '').toLowerCase();
    var name = decodeURIComponent(url.split('/').pop());
    var view = /^(pdf|png|jpe?g|gif|svg|webp)$/.test(ext) && !a.hasAttribute('download');
    var w = view ? window.open('', '_blank') : null;
    if (w) { try { w.document.write('<title>' + name + '</title><p style="font:16px system-ui;margin:2em">Decrypting ' + name + '…</p>'); } catch (x) {} }
    blobURL(url).then(function (u) {
      if (w) { w.location.replace(u); return; }
      if (view) { location.href = u; return; }
      var d = document.createElement('a'); d.href = u; d.download = name; document.body.appendChild(d); d.click(); d.remove();
    }).catch(function () { if (w) w.close(); alertBox('Could not open ' + name + '.'); });
  }, true);
  function alertBox(t) { var p = document.createElement('div'); p.textContent = t; p.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:8px;font:14px system-ui;z-index:99'; document.body.appendChild(p); setTimeout(function () { p.remove(); }, 3500); }

  /* lock button */
  var bar = document.querySelector('.topbar-inner');
  if (bar) {
    var host = bar.querySelector('.tb-actions');
    if (!host) { host = document.createElement('div'); host.className = 'tb-actions'; bar.appendChild(host); }
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.title = 'Lock Leem Lab on this device';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span class="lbl">Lock</span>';
    b.addEventListener('click', function () { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (x) {} location.href = '/leemlab/'; });
    host.appendChild(b);
  }
})();
