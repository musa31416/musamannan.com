/* raman-core.js
 * Reads Raman TXT exports, calibrates each spectrum to the Si peak and finds the
 * MoS2 E2g / A1g peaks. Same method as the lab's MATLAB scripts
 * (Raman_Si_Calibration.m, Raman_AllData_Calibrate_Plot.m).
 * Works in the browser (window.RamanCore) and in Node (module.exports).
 * Leem Lab, UT Dallas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RamanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    siReference: 520.7,      // true Si TO phonon, cm^-1
    saturationLevel: 65000,  // detector counts treated as saturated
    plotMin: 350,
    plotMax: 430,
    deltaDecimals: 1,
  };

  const LAYER_BINS = [
    { key: '18-<20', lo: 18, hi: 20, name: 'Monolayer-like' },
    { key: '20-<23', lo: 20, hi: 23, name: 'Bilayer-like' },
    { key: '23-30', lo: 23, hi: 30.0000001, name: 'Few-layer / thick' },
  ];

  /* ---------- small numeric helpers ---------- */
  function median(a) {
    const s = a.filter(Number.isFinite).slice().sort((p, q) => p - q);
    if (!s.length) return NaN;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function std(a) {
    const n = a.length; if (n < 2) return NaN;
    const mu = a.reduce((p, q) => p + q, 0) / n;
    return Math.sqrt(a.reduce((p, q) => p + (q - mu) * (q - mu), 0) / (n - 1));
  }
  // least-squares line, returns [slope, intercept]
  function fitLine(x, y) {
    const n = x.length; let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); }
    const b = sxx > 0 ? sxy / sxx : 0;
    return [b, my - b * mx];
  }
  // least-squares parabola y = a x^2 + b x + c, returns [a, b, c]
  function fitParabola(x, y) {
    let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
    for (let i = 0; i < x.length; i++) {
      const xi = x[i], x2 = xi * xi;
      S0 += 1; S1 += xi; S2 += x2; S3 += x2 * xi; S4 += x2 * x2;
      T0 += y[i]; T1 += xi * y[i]; T2 += x2 * y[i];
    }
    // solve [S4 S3 S2; S3 S2 S1; S2 S1 S0] [a b c]' = [T2 T1 T0]'
    const M = [[S4, S3, S2, T2], [S3, S2, S1, T1], [S2, S1, S0, T0]];
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-300) return [0, 0, 0];
      for (let r = 0; r < 3; r++) if (r !== c) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
      }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }

  /* ---------- reading the TXT export ---------- */
  function parseTxt(text, fileName) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const meta = {};
    const header = [];
    let i = 0;
    while (i < lines.length && !/^\s*-?\d/.test(lines[i])) {
      const L = lines[i];
      if (L.startsWith('#')) {
        const c = L.indexOf(':');
        if (c > 0) meta[L.slice(1, c).trim()] = L.slice(c + 1).trim();
      } else if (L.trim()) header.push(L);
      i++;
    }
    const rows = [];
    for (; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const v = lines[i].split(/[\t,;]/).map(s => s.trim()).filter(s => s !== '').map(Number);
      if (v.length && v.every(Number.isFinite)) rows.push(v);
    }
    if (!rows.length) throw new Error(`${fileName}: no numeric data found.`);
    const nCols = rows[0].length;
    if (nCols < 2 || nCols % 2) throw new Error(`${fileName}: expected wavenumber / intensity column pairs, found ${nCols} columns.`);
    const tok = header.join(' ').split('\t').map(s => s.trim()).filter(Boolean);
    const nSpec = nCols / 2;
    const labels = tok.length === nCols
      ? tok.filter((_, k) => k % 2 === 1).map(s => s.replace(/\s+/g, ' '))
      : Array.from({ length: nSpec }, (_, k) => `Spectrum ${k + 1}`);
    const spectra = [];
    for (let k = 0; k < nSpec; k++) {
      const wn = [], y = [];
      for (const r of rows) {
        if (r.length > 2 * k + 1) { wn.push(r[2 * k]); y.push(r[2 * k + 1]); }
      }
      // keep the axis ascending
      if (wn.length > 1 && wn[0] > wn[wn.length - 1]) { wn.reverse(); y.reverse(); }
      spectra.push({ label: labels[k], wn, y });
    }
    return { fileName, meta, spectra };
  }

  /* ---------- peak tools ---------- */
  function linBaseline(x, y, r1, r2) {
    const xs = [], ys = [];
    for (let i = 0; i < x.length; i++) {
      if ((x[i] > r1[0] && x[i] < r1[1]) || (x[i] > r2[0] && x[i] < r2[1])) { xs.push(x[i]); ys.push(y[i]); }
    }
    if (xs.length < 2) return x.map(() => 0);
    const [b, a] = fitLine(xs, ys);
    return x.map(v => a + b * v);
  }

  /* Sub-pixel peak maximum: parabola through log(intensity) of the points above
   * 60% of the peak top (a Gaussian through the top). Saturated points skipped. */
  function topCenter(x, y, lo, hi, yRaw, satLevel) {
    const idxs = [];
    for (let i = 0; i < x.length; i++) if (x[i] > lo && x[i] < hi) idxs.push(i);
    if (!idxs.length) return { c: NaN, h: NaN, nSat: 0 };
    const xs = idxs.map(i => x[i]), ys = idxs.map(i => y[i]);
    const yr = yRaw ? idxs.map(i => yRaw[i]) : ys;
    let im = 0;
    for (let i = 1; i < ys.length; i++) if (ys[i] > ys[im]) im = i;
    const h0 = ys[im];
    let a = im, b = im;
    while (a > 0 && ys[a - 1] > 0.6 * h0) a--;
    while (b < ys.length - 1 && ys[b + 1] > 0.6 * h0) b++;
    a = Math.max(0, Math.min(a, im - 2));
    b = Math.min(ys.length - 1, Math.max(b, im + 2));
    const fx = [], fy = [];
    let nSat = 0;
    for (let k = a; k <= b; k++) {
      if (satLevel !== undefined && yr[k] >= satLevel) { nSat++; continue; }
      fx.push(xs[k] - xs[im]); fy.push(Math.log(Math.max(ys[k], 1)));
    }
    if (fx.length < 3) return { c: xs[im], h: h0, nSat };
    const [pa, pb, pc] = fitParabola(fx, fy);
    if (!(pa < 0)) return { c: xs[im], h: h0, nSat };
    const v = -pb / (2 * pa);
    return { c: xs[im] + v, h: Math.exp(pa * v * v + pb * v + pc), nSat };
  }

  function fwhmAt(x, y, c, h) {
    const half = h / 2;
    let L = -1, R = -1;
    for (let i = 0; i < x.length; i++) if (x[i] < c && y[i] < half) L = i;
    for (let i = 0; i < x.length; i++) if (x[i] > c && y[i] < half) { R = i; break; }
    if (L < 0 || R < 1 || L >= x.length - 1) return NaN;
    const xl = x[L] + (half - y[L]) * (x[L + 1] - x[L]) / (y[L + 1] - y[L]);
    const xr = x[R - 1] + (half - y[R - 1]) * (x[R] - x[R - 1]) / (y[R] - y[R - 1]);
    return xr - xl;
  }

  function noiseLevel(w, y) {
    const d = [];
    for (let i = 1; i < w.length; i++) if (w[i] > 600 && w[i] < 900 && w[i - 1] > 600) d.push(y[i] - y[i - 1]);
    return d.length > 3 ? std(d) / Math.SQRT2 : NaN;
  }

  function windowOf(w, y, lo, hi) {
    const x = [], v = [];
    for (let i = 0; i < w.length; i++) if (w[i] > lo && w[i] < hi) { x.push(w[i]); v.push(y[i]); }
    return { x, v };
  }

  /* Si centre: peak-top fit, or for a flat (saturated) top the midpoint of the two
   * flanks at 75% height. */
  function siCenter(w, y, noise, satLevel) {
    const { x, v: yr } = windowOf(w, y, 490, 555);
    if (x.length < 8) return { c: NaN, ok: false, nSat: 0, method: 'no Si region in this scan' };
    const base = linBaseline(x, yr, [490, 500], [545, 555]);
    const yb = yr.map((v, i) => v - base[i]);
    let { c, h, nSat } = topCenter(x, yb, 505, 535, yr, satLevel);
    let method = 'peak-top fit';
    if (nSat > 2) {
      const xs = [], ys = []; let minSat = Infinity;
      for (let i = 0; i < x.length; i++) if (x[i] > 505 && x[i] < 535) {
        xs.push(x[i]); ys.push(yb[i]);
        if (yr[i] >= satLevel) minSat = Math.min(minSat, yb[i]);
      }
      const level = 0.75 * minSat;
      let im = 0; for (let i = 1; i < ys.length; i++) if (ys[i] > ys[im]) im = i;
      let a = im, b = im;
      while (a > 0 && ys[a] >= level) a--;
      while (b < ys.length - 1 && ys[b] >= level) b++;
      const xl = xs[a] + (level - ys[a]) * (xs[a + 1] - xs[a]) / (ys[a + 1] - ys[a]);
      const xr = xs[b - 1] + (level - ys[b - 1]) * (xs[b] - xs[b - 1]) / (ys[b] - ys[b - 1]);
      c = (xl + xr) / 2;
      method = 'saturated Si: flank midpoint at 75%';
    }
    const ok = Number.isFinite(c) && h > 20 * noise && c > 508 && c < 533;
    return { c, h, ok, nSat, method };
  }

  function layerBin(d) {
    if (!Number.isFinite(d)) return { key: 'No MoS2', name: 'No MoS2 signal' };
    for (const b of LAYER_BINS) if (d >= b.lo && d < b.hi) return b;
    return d < 18 ? { key: '<18', name: 'Below 18' } : { key: '>30', name: 'Above 30' };
  }

  /* ---------- full analysis of one parsed file ---------- */
  function analyzeFile(parsed, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const out = parsed.spectra.map((s, k) => {
      const w = s.wn, y = s.y;
      const steps = []; for (let i = 1; i < w.length; i++) steps.push(Math.abs(w[i] - w[i - 1]));
      const step = median(steps);
      const noise = noiseLevel(w, y);
      const si = siCenter(w, y, noise, o.saturationLevel);
      return { k, label: s.label, w, y, step, noise, si };
    });
    // spectra whose Si cannot be used borrow the median of the good ones in the same file
    const fileMedian = median(out.filter(r => r.si.ok).map(r => r.si.c));
    return out.map(r => {
      let shift, shiftSource, note = '';
      if (r.si.ok) { shift = o.siReference - r.si.c; shiftSource = 'own Si peak'; }
      else if (Number.isFinite(fileMedian)) { shift = o.siReference - fileMedian; shiftSource = 'file median Si'; note = 'Si weak or missing; used the median Si of this file'; }
      else { shift = 0; shiftSource = 'not calibrated'; note = 'No usable Si peak; axis NOT calibrated'; }
      if (r.si.ok && r.si.nSat > 0) note = `Si top saturated (${r.si.nSat} pts); ${r.si.method}`;
      const wc = r.w.map(v => v + shift);
      const { x, v } = windowOf(wc, r.y, 350, 440);
      let E = NaN, A = NaN, hE = NaN, hA = NaN, Ew = NaN, Aw = NaN, yc = [];
      if (x.length > 10) {
        const base = linBaseline(x, v, [350, 368], [420, 440]);
        yc = v.map((q, i) => q - base[i]);
        const pe = topCenter(x, yc, 372, 394), pa = topCenter(x, yc, 396, 418);
        E = pe.c; hE = pe.h; A = pa.c; hA = pa.h;
        const left = windowOf(x, yc, -Infinity, 395), right = windowOf(x, yc, 395, Infinity);
        Ew = fwhmAt(left.x, left.v, E, hE); Aw = fwhmAt(right.x, right.v, A, hA);
      }
      const detected = Number.isFinite(hA) && hA > 6 * r.noise && hE > 3 * r.noise;
      const delta = detected ? A - E : NaN;
      const bin = layerBin(delta);
      return {
        file: parsed.fileName, index: r.k + 1, label: r.label, meta: parsed.meta,
        step: r.step, lowRes: r.step > 1.0, noise: r.noise,
        siRaw: r.si.ok ? r.si.c : NaN, siHeight: r.si.ok ? r.si.h : NaN, siMethod: r.si.ok ? r.si.method : '',
        shift, shiftSource, note,
        E: detected ? E : NaN, A: detected ? A : NaN, hE, hA,
        E_fwhm: detected ? Ew : NaN, A_fwhm: detected ? Aw : NaN,
        delta, ratio: detected ? hA / hE : NaN, snr: hA / r.noise,
        binKey: bin.key, binName: bin.name,
        status: detected ? 'OK' : 'Weak or no MoS2 signal',
        wnRaw: r.w, wnCal: wc, y: r.y, mosX: x, mosY: yc,
      };
    });
  }

  /* ---------- a synthetic example spectrum (clearly fake, for the demo) ---------- */
  function syntheticExample() {
    const lor = (x, c, w, a) => a * (w / 2) ** 2 / ((x - c) ** 2 + (w / 2) ** 2);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const make = (siPos, E, A, scale) => {
      const wn = [], y = [];
      for (let x = -58; x <= 1013; x += 0.649) {
        wn.push(x);
        y.push(900 + 0.25 * x + lor(x, siPos, 4.2, 52000) + lor(x, siPos - 3.5, 9, 2500)
          + scale * (lor(x, E, 5.2, 4200) + lor(x, A, 5.6, 7400)) + 18 * rnd() * 2);
      }
      return { wn, y };
    };
    const specs = [
      ['Synthetic A (1L-like)', 519.9, 384.4, 404.1, 0.9],
      ['Synthetic B (2L-like)', 519.9, 383.2, 405.0, 1.2],
      ['Synthetic C (thick)', 520.2, 382.3, 407.6, 1.6],
    ];
    const header = specs.map(s => `wn(${s[0]})\t${s[0]}`).join('\t');
    const data = specs.map(s => make(s[1], s[2], s[3], s[4]));
    const lines = [header];
    for (let i = 0; i < data[0].wn.length; i++) lines.push(data.map(d => `${d.wn[i].toFixed(5)}\t${d.y[i].toFixed(2)}`).join('\t'));
    return lines.join('\r\n');
  }

  return { DEFAULTS, LAYER_BINS, parseTxt, analyzeFile, topCenter, siCenter, layerBin, median, syntheticExample };
});
