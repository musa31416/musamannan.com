/* plots.js
 * Draws publication-style Raman figures on a <canvas>: one plot per spectrum with
 * the peak difference written on it, a stacked overview, and a Si calibration check.
 * White background so the PNGs drop straight into papers and slides.
 * Leem Lab, UT Dallas.
 */
(function (root) {
  'use strict';
  const FONT = 'Arial, Helvetica, "Liberation Sans", sans-serif';
  const C = {
    line: '#2a78d6', ink: '#14171c', ink2: '#555a63', grid: '#e7e9ee', axis: '#9aa1ab',
    bins: { '18-<20': '#86b6ef', '20-<23': '#2a78d6', '23-30': '#104281' }, faint: 'rgba(42,120,214,0.14)',
  };

  /* ---------- text with sub/superscripts: segs = [{t, sub, sup, bold}] ---------- */
  function richWidth(ctx, segs, size) {
    let w = 0;
    for (const s of segs) {
      ctx.font = `${s.bold ? 'bold ' : ''}${(s.sub || s.sup) ? size * 0.68 : size}px ${FONT}`;
      w += ctx.measureText(s.t).width;
    }
    return w;
  }
  function drawRich(ctx, segs, x, y, size, align, color) {
    const w = richWidth(ctx, segs, size);
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = color || C.ink; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (const s of segs) {
      const sz = (s.sub || s.sup) ? size * 0.68 : size;
      ctx.font = `${s.bold ? 'bold ' : ''}${sz}px ${FONT}`;
      const dy = s.sub ? size * 0.22 : s.sup ? -size * 0.38 : 0;
      ctx.fillText(s.t, cx, y + dy);
      cx += ctx.measureText(s.t).width;
    }
    return w;
  }
  const E2G = [{ t: 'E' }, { t: '1', sup: true }, { t: '2g', sub: true }];
  const A1G = [{ t: 'A' }, { t: '1g', sub: true }];
  const CM = [{ t: ' cm' }, { t: '−1', sup: true }];
  const deltaSegs = (d, dec, bold) => [{ t: `Δ = ${d.toFixed(dec)}`, bold }, ...CM.map(s => ({ ...s, bold }))];

  /* ---------- axes ---------- */
  function niceTicks(lo, hi, n) {
    const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
    const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function frame(ctx, W, H) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function xAxis(ctx, box, xr, s, label) {
    const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w;
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
    ctx.font = `${13 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const t of niceTicks(xr[0], xr[1], 8)) {
      const x = X(t);
      ctx.beginPath(); ctx.moveTo(x, box.y + box.h); ctx.lineTo(x, box.y + box.h + 5 * s); ctx.stroke();
      ctx.fillText(String(t), x, box.y + box.h + 8 * s);
    }
    drawRich(ctx, label, box.x + box.w / 2, box.y + box.h + 44 * s, 14 * s, 'center', C.ink);
    return X;
  }

  /* ---------- one spectrum, peak difference written on it ---------- */
  function drawSpectrum(canvas, r, o) {
    const s = o.scale || 2, W = 820 * s, H = 520 * s;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); frame(ctx, W, H);
    const xr = [o.plotMin, o.plotMax];
    const pts = [];
    for (let i = 0; i < r.wnCal.length; i++) if (r.wnCal[i] >= xr[0] && r.wnCal[i] <= xr[1]) pts.push([r.wnCal[i], r.y[i]]);
    if (!pts.length) return;
    let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
    const span = (hi - lo) || 1;
    const yr = [lo - 0.30 * span, hi + 0.34 * span];
    const box = { x: 96 * s, y: 86 * s, w: W - 130 * s, h: H - 170 * s };
    const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w;
    const Y = v => box.y + box.h - (v - yr[0]) / (yr[1] - yr[0]) * box.h;

    // title
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${17 * s}px ${FONT}`; ctx.fillStyle = C.ink;
    ctx.fillText(o.title || r.label, box.x, 34 * s);
    ctx.font = `${13 * s}px ${FONT}`; ctx.fillStyle = C.ink2;
    let sub = r.shiftSource === 'not calibrated' ? 'Si peak not found: axis NOT calibrated'
      : `Si ${Number.isFinite(r.siRaw) ? r.siRaw.toFixed(2) : '(file median)'} → ${o.siReference} cm⁻¹  (shift ${r.shift >= 0 ? '+' : ''}${r.shift.toFixed(2)})`;
    if (r.lowRes) sub += `   |   low resolution, ${r.step.toFixed(1)} cm⁻¹ per point`;
    ctx.fillText(sub, box.x, 56 * s);

    // y axis + grid
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1 * s;
    ctx.font = `${12 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const t of niceTicks(yr[0], yr[1], 5)) {
      if (t < yr[0]) continue;
      ctx.beginPath(); ctx.moveTo(box.x, Y(t)); ctx.lineTo(box.x + box.w, Y(t)); ctx.stroke();
      ctx.fillText(t >= 10000 ? t.toLocaleString('en-US') : String(t), box.x - 8 * s, Y(t));
    }
    ctx.save(); ctx.translate(26 * s, box.y + box.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.font = `${14 * s}px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText('Intensity (counts)', 0, 0); ctx.restore();
    xAxis(ctx, box, xr, s, [{ t: 'Raman shift (cm' }, { t: '−1', sup: true }, { t: '), Si-calibrated' }]);

    // spectrum
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.2 * s; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    if (r.lowRes) { ctx.fillStyle = C.line; for (const p of pts) { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2.6 * s, 0, 7); ctx.fill(); } }
    ctx.restore();

    if (!Number.isFinite(r.delta)) {
      ctx.font = `bold ${16 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center';
      ctx.fillText('No MoS₂ peaks detected in this spectrum', box.x + box.w / 2, box.y + 30 * s);
      return;
    }
    // peak markers
    ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.1 * s;
    for (const xp of [r.E, r.A]) { ctx.beginPath(); ctx.moveTo(X(xp), box.y); ctx.lineTo(X(xp), box.y + box.h); ctx.stroke(); }
    ctx.setLineDash([]);
    const yl = Y(lo - 0.07 * span);
    for (const [xp, segs] of [[r.E, E2G], [r.A, A1G]]) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(X(xp) - 30 * s, yl - 4 * s, 60 * s, 40 * s);
      drawRich(ctx, segs, X(xp), yl + 13 * s, 14 * s, 'center', C.ink2);
      ctx.font = `${12.5 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center';
      ctx.fillText(xp.toFixed(1), X(xp), yl + 31 * s);
    }
    // double arrow + delta
    const ya = Y(hi + 0.13 * span), x1 = X(r.E), x2 = X(r.A), ah = 9 * s;
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(x1 + ah, ya); ctx.lineTo(x2 - ah, ya); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, ya); ctx.lineTo(x1 + ah, ya - ah * 0.55); ctx.lineTo(x1 + ah, ya + ah * 0.55); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x2, ya); ctx.lineTo(x2 - ah, ya - ah * 0.55); ctx.lineTo(x2 - ah, ya + ah * 0.55); ctx.fill();
    drawRich(ctx, deltaSegs(r.delta, o.deltaDecimals, true), (x1 + x2) / 2, ya - 12 * s, 21 * s, 'center', C.ink);
    // layer class chip, top right
    const bc = C.bins[r.binKey];
    if (bc) {
      ctx.font = `bold ${12 * s}px ${FONT}`; const txt = r.binName; const tw = ctx.measureText(txt).width;
      const bx = box.x + box.w - tw - 22 * s, by = 22 * s;
      ctx.fillStyle = bc; roundRect(ctx, bx, by, tw + 22 * s, 24 * s, 12 * s); ctx.fill();
      ctx.fillStyle = r.binKey === '18-<20' ? C.ink : '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + 11 * s, by + 12 * s);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- stacked overview: normalized to A1g, offset, delta on each ---------- */
  function drawStacked(canvas, list, o) {
    const s = o.scale || 2, rowH = 112, n = list.length;
    const W = 900 * s, H = (150 + rowH * n) * s;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); frame(ctx, W, H);
    const xr = [o.plotMin, o.plotMax];
    const box = { x: 40 * s, y: 74 * s, w: W - 250 * s, h: H - 150 * s };
    const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w;
    ctx.font = `bold ${17 * s}px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(o.title || 'Si-calibrated spectra', box.x, 32 * s);
    drawRich(ctx, [{ t: 'Each normalized to A' }, { t: '1g', sub: true }, { t: ' and offset; peak difference in cm' }, { t: '−1', sup: true }],
      box.x, 54 * s, 13 * s, 'left', C.ink2);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1 * s;
    for (const t of niceTicks(xr[0], xr[1], 8)) { ctx.beginPath(); ctx.moveTo(X(t), box.y); ctx.lineTo(X(t), box.y + box.h); ctx.stroke(); }
    list.forEach((r, i) => {
      const base = box.y + box.h - (i + 0.18) * rowH * s;   // first item at the bottom
      const amp = rowH * 0.62 * s;
      if (r.mosX && r.mosX.length && Number.isFinite(r.hA) && r.hA > 0) {
        ctx.strokeStyle = C.bins[r.binKey] || '#8d939c'; ctx.lineWidth = 2 * s; ctx.beginPath();
        let started = false;
        r.mosX.forEach((x, k) => {
          if (x < xr[0] || x > xr[1]) return;
          const yy = base - Math.max(-0.15, Math.min(1.15, r.mosY[k] / r.hA)) * amp;
          started ? ctx.lineTo(X(x), yy) : (ctx.moveTo(X(x), yy), started = true);
        });
        ctx.stroke();
      }
      ctx.font = `${12 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(trim(ctx, r.plotName, 210 * s), X(xr[1]) + 14 * s, base - amp * 0.15);
      if (Number.isFinite(r.delta)) {
        const yb = base - amp * 1.12;
        ctx.strokeStyle = C.ink2; ctx.lineWidth = 1 * s; ctx.beginPath();
        ctx.moveTo(X(r.E), yb); ctx.lineTo(X(r.A), yb);
        ctx.moveTo(X(r.E), yb - 5 * s); ctx.lineTo(X(r.E), yb + 5 * s);
        ctx.moveTo(X(r.A), yb - 5 * s); ctx.lineTo(X(r.A), yb + 5 * s); ctx.stroke();
        drawRich(ctx, [{ t: `Δ = ${r.delta.toFixed(o.deltaDecimals)}`, bold: true }], X(r.A) + 8 * s, yb + 5 * s, 13 * s, 'left', C.ink);
      } else {
        ctx.font = `${12 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.fillText('no MoS₂ signal', X(xr[1]) + 14 * s, base - amp * 0.15 + 16 * s);
      }
    });
    xAxis(ctx, box, xr, s, [{ t: 'Raman shift (cm' }, { t: '−1', sup: true }, { t: '), Si-calibrated' }]);
  }
  function trim(ctx, t, w) {
    if (ctx.measureText(t).width <= w) return t;
    while (t.length > 3 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1);
    return t + '…';
  }

  /* ---------- Si calibration check ---------- */
  function drawSiCheck(canvas, list, o) {
    const s = o.scale || 2, W = 1000 * s, H = 440 * s;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); frame(ctx, W, H);
    ctx.font = `bold ${17 * s}px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Si calibration check (${list.length} spectra)`, 40 * s, 32 * s);
    const xr = [510, 532];
    const panels = [['Before: raw axis', 'wnRaw'], [`After: shifted so Si = ${o.siReference}`, 'wnCal']];
    panels.forEach(([t, key], p) => {
      const box = { x: (40 + p * 480) * s, y: 76 * s, w: 430 * s, h: 280 * s };
      const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w;
      const Y = v => box.y + box.h - v * box.h / 1.08;
      ctx.font = `${13 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.fillText(t, box.x, 62 * s);
      ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      for (const r of list) {
        if (r.shiftSource !== 'own Si peak') continue;
        const w = r[key], xs = [], ys = [];
        for (let i = 0; i < w.length; i++) if (w[i] > 488 && w[i] < 557) { xs.push(w[i]); ys.push(r.y[i]); }
        if (xs.length < 5) continue;
        const left = ys.slice(0, 3), right = ys.slice(-3);
        const b0 = (left.reduce((a, b) => a + b, 0) / left.length), b1 = (right.reduce((a, b) => a + b, 0) / right.length);
        const yb = ys.map((v, i) => v - (b0 + (b1 - b0) * i / (ys.length - 1)));
        const mx = Math.max(...yb);
        ctx.strokeStyle = list.length > 40 ? C.faint : 'rgba(42,120,214,0.45)'; ctx.lineWidth = 1.3 * s; ctx.beginPath();
        xs.forEach((x, i) => i ? ctx.lineTo(X(x), Y(yb[i] / mx)) : ctx.moveTo(X(x), Y(yb[i] / mx))); ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.moveTo(X(o.siReference), box.y); ctx.lineTo(X(o.siReference), box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
      xAxis(ctx, box, xr, s, [{ t: 'Raman shift (cm' }, { t: '−1', sup: true }, { t: ')' }]);
    });
  }

  /* ---------- placeholder when nothing is ticked ---------- */
  function drawMessage(canvas, text, o) {
    const s = o.scale || 2, W = 820 * s, H = 360 * s;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); frame(ctx, W, H);
    ctx.font = `${16 * s}px ${FONT}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2);
  }

  root.RamanPlots = { drawSpectrum, drawStacked, drawSiCheck, drawMessage, colors: C };
})(typeof self !== 'undefined' ? self : this);
