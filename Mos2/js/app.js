/* app.js: page wiring for the Raman Si Calibrator. Leem Lab, UT Dallas. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { files: [], results: [], selected: 0, view: 'one', example: true, checked: new Set() };

  /* ---------- settings ---------- */
  function settings() {
    const v = (id, d) => { const x = parseFloat($(id).value); return Number.isFinite(x) ? x : d; };
    const s = {
      siReference: v('siRef', 520.7), plotMin: v('pMin', 350), plotMax: v('pMax', 430),
      deltaDecimals: Math.max(0, Math.min(3, Math.round(v('dec', 1)))), saturationLevel: v('sat', 65000),
    };
    if (s.plotMax <= s.plotMin) { s.plotMin = 350; s.plotMax = 430; }
    return s;
  }

  /* ---------- header sketch: a Si peak at the reference ---------- */
  function drawTrace() {
    const c = $('trace'), ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const X = (x) => 20 + (x - 505) / 30 * (W - 40), Y = (y) => H - 40 - y * (H - 80);
    ctx.strokeStyle = 'rgba(159,183,216,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, H - 40); ctx.lineTo(W - 20, H - 40); ctx.stroke();
    ctx.setLineDash([8, 7]); ctx.strokeStyle = '#9fb7d8';
    ctx.beginPath(); ctx.moveTo(X(520.7), 18); ctx.lineTo(X(520.7), H - 40); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#6fb0ff'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = 505; x <= 535; x += 0.2) {
      const y = 1 / (1 + ((x - 520.7) / 2.1) ** 2) + 0.06 / (1 + ((x - 516.5) / 4) ** 2);
      x === 505 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();
    ctx.fillStyle = '#c9d6e8'; ctx.font = '500 22px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText('Si 520.7 cm⁻¹', X(522.4), 46);
    ctx.font = '18px "IBM Plex Mono", monospace'; ctx.fillStyle = '#9fb7d8';
    ctx.fillText('510', X(510) - 16, H - 12); ctx.fillText('530', X(530) - 16, H - 12);
  }

  /* ---------- file intake ---------- */
  async function addFiles(list) {
    for (const f of list) {
      if (state.files.some(x => x.name === f.name && x.size === f.size)) continue;
      const text = await f.text();
      state.files.push({ name: f.name, size: f.size, text });
    }
    renderFiles();
  }
  function renderFiles() {
    const ul = $('files'); ul.innerHTML = '';
    for (const f of state.files) {
      const li = document.createElement('li');
      li.innerHTML = `<span></span><span class="muted">${(f.size / 1024).toFixed(0)} KB</span>`;
      li.firstChild.textContent = f.name;
      if (f.error) { li.lastChild.className = 'err'; li.lastChild.textContent = f.error; }
      ul.appendChild(li);
    }
    $('run').disabled = !state.files.length; $('clear').disabled = !state.files.length;
  }

  /* ---------- processing ---------- */
  const tick = () => new Promise(r => setTimeout(r, 0));
  function baseName(n) { return n.replace(/\.[^.]+$/, ''); }
  function safe(n) { return n.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_'); }

  async function processTexts(items, example) {
    const s = settings();
    const results = [];
    for (let i = 0; i < items.length; i++) {
      $('progress').textContent = `Reading ${i + 1} of ${items.length}: ${items[i].name}`;
      await tick();
      try {
        const parsed = RamanCore.parseTxt(items[i].text, items[i].name);
        const res = RamanCore.analyzeFile(parsed, s);
        const b = baseName(items[i].name);
        res.forEach(r => {
          r.plotName = res.length > 1 ? `${b} #${r.index}` : b;
          r.fileStem = safe(res.length > 1 ? `${b}_${String(r.index).padStart(2, '0')}` : b);
        });
        results.push(...res);
        items[i].error = '';
      } catch (e) {
        items[i].error = e.message.replace(items[i].name + ': ', '');
      }
    }
    state.results = results; state.selected = 0; state.example = example; state.checked = new Set();
    if (state.view === 'compare') state.view = 'one';
    $('banner').hidden = !example;
    $('progress').textContent = example ? '' : `Done: ${results.length} spectra from ${items.length} file(s).`;
    if (!example) renderFiles();
    render();
  }

  /* ---------- results view ---------- */
  function chip(r, dec) {
    if (r.status !== 'OK') return '<span class="chip bx">no MoS₂</span>';
    const cls = { '18-<20': 'b1', '20-<23': 'b2', '23-30': 'b3' }[r.binKey] || 'bx';
    return `<span class="chip ${cls}">${r.delta.toFixed(Math.max(dec, 1))}</span>`;
  }
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '<span class="muted">&ndash;</span>');
  const sgn = (v) => (Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) : '&ndash;');

  function render() {
    const R = state.results, s = settings();
    const files = new Set(R.map(r => r.file));
    const ok = R.filter(r => r.status === 'OK');
    $('sFiles').textContent = files.size; $('sSpec').textContent = R.length; $('sMos').textContent = ok.length;
    $('sDelta').textContent = ok.length ? RamanCore.median(ok.map(r => r.delta)).toFixed(2) : '–';
    const tb = $('tbody'); tb.innerHTML = '';
    R.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.tabIndex = 0; tr.setAttribute('aria-selected', String(i === state.selected));
      tr.title = `${r.file}, spectrum ${r.index}: ${r.label}${r.note ? '\n' + r.note : ''}`;
      tr.innerHTML = `<td class="pick"><input type="checkbox" aria-label="Compare ${r.plotName.replace(/"/g, '&quot;')}"${state.checked.has(i) ? ' checked' : ''}></td><td class="name"></td><td>${chip(r, s.deltaDecimals)}</td><td>${f2(r.siRaw)}</td><td>${sgn(r.shift)}</td><td>${f2(r.E)}</td><td>${f2(r.A)}</td>`;
      tr.children[1].textContent = r.plotName + (r.lowRes ? '  (low res)' : '');
      const box = tr.querySelector('input');
      box.addEventListener('click', (e) => e.stopPropagation());
      box.addEventListener('keydown', (e) => e.stopPropagation());
      box.addEventListener('change', () => {
        box.checked ? state.checked.add(i) : state.checked.delete(i);
        updateChecked(); setView('compare');
      });
      const pick = () => { state.selected = i; setView('one'); highlight(); };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      tb.appendChild(tr);
    });
    const has = R.length > 0;
    $('dlXlsx').disabled = !has; $('dlZip').disabled = !has; $('dlFig').disabled = !has;
    updateChecked();
    setView(state.view);
  }
  function updateChecked() {
    $('nSel').textContent = state.checked.size;
    $('clearSel').hidden = state.checked.size === 0;
  }
  function checkedList() {
    return [...state.checked].sort((a, b) => a - b).map(i => state.results[i]).filter(Boolean);
  }
  function highlight() {
    [...$('tbody').children].forEach((tr, i) => tr.setAttribute('aria-selected', String(i === state.selected)));
    drawFigure();
  }
  function setView(v) {
    state.view = v;
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
    drawFigure();
  }
  function drawFigure() {
    const c = $('fig'), s = settings(), R = state.results;
    if (!R.length) { const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); return; }
    const o = Object.assign({ scale: 2 }, s);
    if (state.view === 'one') {
      const r = R[Math.min(state.selected, R.length - 1)];
      RamanPlots.drawSpectrum(c, r, Object.assign(o, { title: r.plotName }));
      c.setAttribute('aria-label', `Plot of ${r.plotName}` + (Number.isFinite(r.delta) ? `, peak difference ${r.delta.toFixed(2)}` : ''));
    } else if (state.view === 'compare') {
      const list = checkedList();
      if (!list.length) {
        RamanPlots.drawMessage(c, 'Tick two or more spectra in the table to compare them here.', o);
        c.setAttribute('aria-label', 'No spectra ticked for comparison yet');
      } else {
        // first ticked row on top, the way the table reads
        RamanPlots.drawStacked(c, list.slice().reverse(), Object.assign(o, { title: `Selected spectra (${list.length})` }));
        c.setAttribute('aria-label', `Stacked comparison of ${list.length} selected spectra: ` + list.map(r => r.plotName + (Number.isFinite(r.delta) ? ` ${r.delta.toFixed(1)}` : '')).join(', '));
      }
    } else if (state.view === 'stack') {
      RamanPlots.drawStacked(c, R.slice(0, 14), Object.assign(o, { title: R.length > 14 ? `First 14 of ${R.length} spectra (all are in the ZIP)` : 'Si-calibrated spectra' }));
      c.setAttribute('aria-label', 'Stacked plot of all spectra with peak differences');
    } else {
      RamanPlots.drawSiCheck(c, R, o);
      c.setAttribute('aria-label', 'Si peaks before and after calibration');
    }
  }

  /* ---------- downloads ---------- */
  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }
  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const canvasBlob = (c) => new Promise(res => c.toBlob(res, 'image/png'));
  function chunks(a, n) { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; }

  async function overviewImages(s) {
    const imgs = [], c = document.createElement('canvas');
    const pages = chunks(state.results, 12);
    for (let p = 0; p < pages.length; p++) {
      RamanPlots.drawStacked(c, pages[p], Object.assign({ scale: 2, title: pages.length > 1 ? `Si-calibrated spectra, page ${p + 1} of ${pages.length}` : 'Si-calibrated spectra' }, s));
      imgs.push({ name: pages.length > 1 ? `Overview_stacked_p${p + 1}.png` : 'Overview_stacked.png', dataUrl: c.toDataURL('image/png'), w: c.width, h: c.height, blob: await canvasBlob(c) });
    }
    RamanPlots.drawSiCheck(c, state.results, Object.assign({ scale: 2 }, s));
    imgs.push({ name: 'Si_calibration_check.png', dataUrl: c.toDataURL('image/png'), w: c.width, h: c.height, blob: await canvasBlob(c) });
    return imgs;
  }

  async function downloadExcel() {
    const btn = $('dlXlsx'); btn.disabled = true;
    try {
      $('progress').textContent = 'Building the Excel workbook…'; await tick();
      const s = settings();
      const imgs = await overviewImages(s);
      const buf = await RamanExcel.build(state.results, s, imgs);
      save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Raman_Si_calibrated_${stamp()}.xlsx`);
      $('progress').textContent = 'Excel workbook downloaded.';
    } catch (e) {
      $('progress').textContent = `Could not build the workbook: ${e.message}`;
    } finally { btn.disabled = false; }
  }

  function csvSummary() {
    const head = ['File', 'Spectrum', 'Label', 'Si_raw', 'Shift', 'Shift_source', 'E2g', 'A1g', 'Peak_difference', 'E2g_FWHM', 'A1g_FWHM', 'Layer_class', 'Status', 'Note'];
    const q = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(3) : '') : `"${String(v || '').replace(/"/g, '""')}"`);
    const rows = state.results.map(r => [r.file, r.index, r.label, r.siRaw, r.shift, r.shiftSource, r.E, r.A, r.delta, r.E_fwhm, r.A_fwhm, r.status === 'OK' ? r.binName : '', r.status, r.note].map(q).join(','));
    return [head.join(','), ...rows].join('\r\n');
  }

  async function downloadZip() {
    const btn = $('dlZip'); btn.disabled = true;
    try {
      const s = settings(), zip = new JSZip(), c = document.createElement('canvas');
      const used = new Set();
      for (let i = 0; i < state.results.length; i++) {
        const r = state.results[i];
        $('progress').textContent = `Drawing plot ${i + 1} of ${state.results.length}…`;
        if (i % 4 === 0) await tick();
        RamanPlots.drawSpectrum(c, r, Object.assign({ scale: 3, title: r.plotName }, s));
        let name = r.fileStem; while (used.has(name)) name += '_';
        used.add(name);
        zip.file(`spectra/${name}.png`, await canvasBlob(c));
      }
      for (const im of await overviewImages(s)) zip.file(`overview/${im.name}`, im.blob);
      zip.file('Peak_Summary.csv', csvSummary());
      zip.file('README.txt', [
        'Raman Si Calibrator output (Leem Lab, UT Dallas)',
        `Made ${new Date().toLocaleString()}`,
        `Si reference ${s.siReference} cm-1. Every spectrum was shifted so its Si peak sits there.`,
        '', 'spectra/   one PNG per spectrum with E2g, A1g and the peak difference marked',
        'overview/  all spectra stacked, and the Si peaks before and after calibration',
        'Peak_Summary.csv  the numbers behind the plots', '',
        'Peak difference classes: 18 to <20 monolayer-like, 20 to <23 bilayer-like, 23 to 30 few-layer / thick.',
      ].join('\r\n'));
      $('progress').textContent = 'Compressing…'; await tick();
      const blob = await zip.generateAsync({ type: 'blob' });
      save(blob, `Raman_plots_${stamp()}.zip`);
      $('progress').textContent = `ZIP downloaded: ${state.results.length} spectrum plots plus overview figures.`;
    } catch (e) {
      $('progress').textContent = `Could not build the ZIP: ${e.message}`;
    } finally { btn.disabled = false; }
  }

  /* ---------- events ---------- */
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]).then(run); });
  $('file').addEventListener('change', (e) => { addFiles([...e.target.files]).then(run); e.target.value = ''; });
  $('run').addEventListener('click', run);
  $('clear').addEventListener('click', () => { state.files = []; renderFiles(); loadExample(); });
  $('dlXlsx').addEventListener('click', downloadExcel);
  $('dlZip').addEventListener('click', downloadZip);
  $('clearSel').addEventListener('click', () => {
    state.checked.clear();
    document.querySelectorAll('#tbody input[type=checkbox]').forEach(b => { b.checked = false; });
    updateChecked(); drawFigure();
  });
  $('dlFig').addEventListener('click', async () => {
    const names = { one: (state.results[state.selected] || {}).fileStem || 'spectrum', compare: 'Selected_spectra', stack: 'All_spectra', si: 'Si_calibration_check' };
    const blob = await canvasBlob($('fig'));
    if (blob) save(blob, `${names[state.view] || 'figure'}_${stamp()}.png`);
  });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  ['siRef', 'pMin', 'pMax', 'dec', 'sat'].forEach(id => $(id).addEventListener('change', () => (state.example ? loadExample() : run())));

  function run() { if (state.files.length) processTexts(state.files, false); }
  function loadExample() { processTexts([{ name: 'Synthetic_example.txt', text: RamanCore.syntheticExample() }], true); }

  drawTrace();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawTrace);
  loadExample();
})();
