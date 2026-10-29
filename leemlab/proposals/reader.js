/* Leem Lab proposals: reader controls, contents tracking, citation popups,
   figure zoom. Plain JavaScript, no dependencies. Settings are kept per
   browser in localStorage when available. */
(function () {
  var root = document.documentElement;
  var KEY = 'leemlab-reader-v1';
  var D = { fs: 19, lh: 1.7, pg: 0.9, mw: 720, al: 'left', th: 'paper' };
  var S = Object.assign({}, D);
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) S = Object.assign(S, saved); } catch (e) {}

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function apply() {
    root.style.setProperty('--fs', S.fs + 'px');
    root.style.setProperty('--lh', S.lh);
    root.style.setProperty('--pgap', S.pg + 'em');
    root.style.setProperty('--measure', S.mw + 'px');
    root.style.setProperty('--align', S.al);
    if (S.th === 'paper') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.th);
    set('fs', S.fs + ' px'); set('lh', S.lh.toFixed(2)); set('pg', S.pg.toFixed(1) + ' em'); set('mw', S.mw + ' px');
    document.querySelectorAll('[data-seg]').forEach(function (b) {
      var k = b.getAttribute('data-seg'), v = b.getAttribute('data-val');
      b.setAttribute('aria-pressed', String(S[k] === v));
    });
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function set(id, txt) { var o = document.getElementById('out-' + id); if (o) o.textContent = txt; }

  var STEP = { fs: [1, 14, 28], lh: [0.1, 1.3, 2.3], pg: [0.2, 0, 2.4], mw: [40, 520, 960] };
  document.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-step'), dir = +b.getAttribute('data-dir'), s = STEP[k];
      S[k] = Math.round(clamp(S[k] + dir * s[0], s[1], s[2]) * 100) / 100;
      apply();
    });
  });
  document.querySelectorAll('[data-seg]').forEach(function (b) {
    b.addEventListener('click', function () { S[b.getAttribute('data-seg')] = b.getAttribute('data-val'); apply(); });
  });
  var reset = document.getElementById('reset');
  if (reset) reset.addEventListener('click', function () { S = Object.assign({}, D); apply(); });

  var panel = document.getElementById('panel'), toggle = document.getElementById('aa');
  if (panel && toggle) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target) && e.target !== toggle) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); } });
  }
  apply();

  /* keyboard: + and - change size when not typing */
  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { S.fs = clamp(S.fs + 1, 14, 28); apply(); }
    if (e.key === '-' || e.key === '_') { S.fs = clamp(S.fs - 1, 14, 28); apply(); }
  });

  /* reading progress */
  var bar = document.querySelector('.progress'), doc = document.querySelector('.doc');
  function prog() {
    if (!bar || !doc) return;
    var r = doc.getBoundingClientRect(), h = r.height - window.innerHeight;
    bar.style.width = (h > 0 ? clamp(-r.top / h, 0, 1) * 100 : 100) + '%';
  }

  /* contents highlight */
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  function spy() {
    var cur = null;
    heads.forEach(function (h) { if (h.getBoundingClientRect().top < 120) cur = h; });
    links.forEach(function (a) { a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id); });
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { prog(); spy(); ticking = false; });
  }, { passive: true });
  prog(); spy();
  var det = document.querySelector('.toc details');
  if (det && window.innerWidth <= 960) det.open = false;
  links.forEach(function (a) { a.addEventListener('click', function () { var d = a.closest('details'); if (d && window.innerWidth <= 960) d.open = false; }); });

  /* citation popups */
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function openPop(a) {
    closePop();
    var li = document.getElementById(a.getAttribute('href').slice(1));
    if (!li) return;
    pop = document.createElement('div'); pop.className = 'pop'; pop.setAttribute('role', 'dialog');
    var t = li.querySelector('.rtext'), l = li.querySelector('.rlinks');
    pop.innerHTML = (t ? t.innerHTML : '') + (l ? '<div class="plinks">' + l.innerHTML + '</div>' : '');
    document.body.appendChild(pop);
    var r = a.getBoundingClientRect(), pw = pop.offsetWidth;
    var left = clamp(r.left + window.scrollX, 12 + window.scrollX, window.scrollX + window.innerWidth - pw - 12);
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    pop.addEventListener('mouseleave', function () { if (!touch) closePop(); });
  }
  var touch = false;
  window.addEventListener('touchstart', function () { touch = true; }, { once: true, passive: true });
  document.querySelectorAll('a.cite').forEach(function (a) {
    a.addEventListener('mouseenter', function () { if (!touch) openPop(a); });
    a.addEventListener('mouseleave', function (e) { if (!touch && pop && !pop.contains(e.relatedTarget)) setTimeout(function () { if (pop && !pop.matches(':hover')) closePop(); }, 120); });
    a.addEventListener('click', function (e) {
      if (touch && (!pop)) { e.preventDefault(); openPop(a); return; }
      closePop();
      var li = document.getElementById(a.getAttribute('href').slice(1));
      if (li) { li.classList.add('flash'); setTimeout(function () { li.classList.remove('flash'); }, 1600); }
    });
  });
  document.addEventListener('click', function (e) { if (pop && !pop.contains(e.target) && !e.target.closest('a.cite')) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePop(); closeLb(); if (panel) panel.hidden = true; } });

  /* figure zoom */
  var lb = document.getElementById('lightbox');
  function closeLb() { if (lb) lb.hidden = true; }
  document.querySelectorAll('figure .fig-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var img = b.querySelector('img'), cap = b.parentNode.querySelector('figcaption');
      lb.querySelector('img').src = img.src; lb.querySelector('img').alt = img.alt;
      lb.querySelector('p').textContent = cap ? cap.textContent : '';
      lb.hidden = false;
    });
  });
  if (lb) lb.addEventListener('click', closeLb);
})();
