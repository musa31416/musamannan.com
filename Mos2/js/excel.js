/* excel.js
 * Builds the formatted Excel workbook with ExcelJS:
 *   Summary            one row per spectrum, colored by layer class, live formulas
 *   Overview           the stacked plot and the Si check as pictures
 *   Calibrated Spectra shifted axis + intensity, two columns per spectrum
 *   Original Spectra   untouched axis + intensity
 *   Method             settings, method and instrument metadata
 * Leem Lab, UT Dallas.
 */
(function (root) {
  'use strict';
  const NAVY = 'FF14325C', ACCENT = 'FF2A78D6', LINE = 'FFD9DEE6', ZEBRA = 'FFF5F7FA', MUTED = 'FF5A616C';
  const BIN_FILL = { '18-<20': 'FF86B6EF', '20-<23': 'FF2A78D6', '23-30': 'FF104281' };
  const BIN_FONT = { '18-<20': 'FF14171C', '20-<23': 'FFFFFFFF', '23-30': 'FFFFFFFF' };
  const font = (o) => Object.assign({ name: 'Arial', size: 10 }, o || {});
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const thin = { style: 'thin', color: { argb: LINE } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const num = (v) => (Number.isFinite(v) ? v : null);

  function titleBlock(ws, title, subtitle, lastCol) {
    ws.mergeCells(1, 1, 1, lastCol);
    const t = ws.getCell(1, 1);
    t.value = title; t.font = font({ size: 16, bold: true, color: { argb: 'FFFFFFFF' } });
    t.fill = fill(NAVY); t.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 30;
    ws.mergeCells(2, 1, 2, lastCol);
    const s = ws.getCell(2, 1);
    s.value = subtitle; s.font = font({ italic: true, color: { argb: MUTED } }); s.alignment = { indent: 1 };
  }

  function headerRow(ws, r, labels) {
    const row = ws.getRow(r);
    labels.forEach((h, i) => {
      const c = row.getCell(i + 1);
      c.value = h; c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = fill(ACCENT);
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = box;
    });
    row.height = 34;
  }

  async function build(results, settings, images) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Raman Si Calibrator, Leem Lab UT Dallas';
    wb.created = new Date();
    const stamp = new Date().toLocaleString();
    const files = [...new Set(results.map(r => r.file))];

    /* ---------------- Summary ---------------- */
    const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: ACCENT } } });
    const cols = [
      ['File', 26], ['Spectrum #', 9], ['Label', 26], ['Point spacing (cm⁻¹)', 11],
      ['Si raw (cm⁻¹)', 11], ['Si method', 24], ['Shift applied (cm⁻¹)', 11], ['Shift source', 16],
      ['E¹₂g (cm⁻¹)', 11], ['A₁g (cm⁻¹)', 11], ['Peak difference Δ (cm⁻¹)', 13],
      ['E¹₂g FWHM (cm⁻¹)', 11], ['A₁g FWHM (cm⁻¹)', 11], ['A₁g / E¹₂g height', 11],
      ['A₁g signal / noise', 10], ['Layer class', 18], ['Status', 20], ['Note', 44],
    ];
    cols.forEach(([, w], i) => (ws.getColumn(i + 1).width = w));
    const ok = results.filter(r => r.status === 'OK');
    titleBlock(ws, 'Raman Si calibration: peak summary',
      `Si reference ${settings.siReference} cm⁻¹  |  ${files.length} file(s), ${results.length} spectra, ${ok.length} with MoS₂  |  processed ${stamp}`, cols.length);
    // legend row
    const legend = [['18-<20', 'Monolayer-like (Δ 18 to <20)'], ['20-<23', 'Bilayer-like (Δ 20 to <23)'], ['23-30', 'Few-layer / thick (Δ 23 to 30)']];
    legend.forEach(([k, txt], i) => {
      const c = ws.getCell(3, 1 + i * 3);
      ws.mergeCells(3, 1 + i * 3, 3, 3 + i * 3);
      c.value = txt; c.fill = fill(BIN_FILL[k]); c.font = font({ bold: true, color: { argb: BIN_FONT[k] } });
      c.alignment = { horizontal: 'center' };
    });
    const H = 5;
    headerRow(ws, H, cols.map(c => c[0]));
    results.forEach((r, i) => {
      const n = H + 1 + i;
      const row = ws.getRow(n);
      const vals = [r.file, r.index, r.label, num(r.step), num(r.siRaw), r.siMethod || r.shiftSource, null, r.shiftSource,
        num(r.E), num(r.A), null, num(r.E_fwhm), num(r.A_fwhm), num(r.ratio), num(r.snr), r.status === 'OK' ? r.binName : '', r.status, r.note];
      vals.forEach((v, k) => { row.getCell(k + 1).value = v; });
      row.getCell(7).value = r.shiftSource === 'own Si peak'
        ? { formula: `SiReference-E${n}`, result: r.shift }
        : r.shift;
      if (r.status === 'OK') row.getCell(11).value = { formula: `J${n}-I${n}`, result: r.delta };
      row.eachCell({ includeEmpty: true }, (c, k) => {
        if (k > cols.length) return;
        c.font = font(); c.border = box;
        if (i % 2) c.fill = fill(ZEBRA);
        if ([4, 5, 7, 9, 10, 11, 12, 13].includes(k)) c.numFmt = '0.00';
        if (k === 14) c.numFmt = '0.00';
        if (k === 15) c.numFmt = '0';
        if (k === 2) c.alignment = { horizontal: 'center' };
      });
      row.getCell(11).font = font({ bold: true, size: 11 });
      if (r.status === 'OK' && BIN_FILL[r.binKey]) {
        const c = row.getCell(16); c.fill = fill(BIN_FILL[r.binKey]); c.font = font({ bold: true, color: { argb: BIN_FONT[r.binKey] } });
      }
      if (r.status !== 'OK') row.getCell(17).font = font({ color: { argb: 'FFB3261E' } });
    });
    ws.autoFilter = { from: { row: H, column: 1 }, to: { row: H + results.length, column: cols.length } };
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: H, zoomScale: 100 }];
    // per-file statistics under the table
    let r0 = H + results.length + 3;
    ws.getCell(r0, 1).value = 'Per file'; ws.getCell(r0, 1).font = font({ bold: true, size: 12, color: { argb: NAVY.replace('FF', 'FF') } });
    headerRow(ws, r0 + 1, ['File', 'Spectra', 'With MoS₂', 'Median Δ (cm⁻¹)', 'Min Δ', 'Max Δ', 'Median shift (cm⁻¹)']);
    files.forEach((f, i) => {
      const n = r0 + 2 + i, first = H + 1, last = H + results.length;
      const rs = results.filter(r => r.file === f), d = rs.map(r => r.delta).filter(Number.isFinite);
      const row = ws.getRow(n);
      row.getCell(1).value = f;
      row.getCell(2).value = { formula: `COUNTIF($A$${first}:$A$${last},A${n})`, result: rs.length };
      row.getCell(3).value = { formula: `COUNTIFS($A$${first}:$A$${last},A${n},$Q$${first}:$Q$${last},"OK")`, result: d.length };
      row.getCell(4).value = d.length ? RamanCore.median(d) : null;
      row.getCell(5).value = d.length ? { formula: `_xlfn.MINIFS($K$${first}:$K$${last},$A$${first}:$A$${last},A${n})`, result: Math.min(...d) } : null;
      row.getCell(6).value = d.length ? { formula: `_xlfn.MAXIFS($K$${first}:$K$${last},$A$${first}:$A$${last},A${n})`, result: Math.max(...d) } : null;
      row.getCell(7).value = RamanCore.median(rs.map(r => r.shift));
      row.eachCell({ includeEmpty: true }, (c, k) => { if (k <= 7) { c.font = font(); c.border = box; if (k >= 4) c.numFmt = '0.00'; } });
    });

    /* ---------------- Overview pictures ---------------- */
    if (images && images.length) {
      const wo = wb.addWorksheet('Overview', { properties: { tabColor: { argb: 'FF104281' } } });
      wo.getColumn(1).width = 2;
      titleBlock(wo, 'Overview plots', 'Pictures of the overview figures. Full-resolution PNGs are in the plots ZIP.', 14);
      let row = 3;
      for (const im of images) {
        const id = wb.addImage({ base64: im.dataUrl, extension: 'png' });
        const w = 900, h = Math.round(900 * im.h / im.w);
        wo.addImage(id, { tl: { col: 1, row }, ext: { width: w, height: h } });
        row += Math.ceil(h / 20) + 2;
      }
    }

    /* ---------------- spectra sheets ---------------- */
    const spectraSheet = (name, key, axisLabel, tab) => {
      const s = wb.addWorksheet(name, { properties: { tabColor: { argb: tab } } });
      const r1 = s.getRow(1), r2 = s.getRow(2);
      results.forEach((r, i) => {
        const c1 = 2 * i + 1, c2 = c1 + 1;
        r1.getCell(c1).value = r.plotName; r1.getCell(c2).value = r.plotName;
        s.mergeCells(1, c1, 1, c2);
        r2.getCell(c1).value = axisLabel; r2.getCell(c2).value = 'Intensity (counts)';
        [r1.getCell(c1), r2.getCell(c1), r2.getCell(c2)].forEach(c => {
          c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = fill(i % 2 ? NAVY : ACCENT);
          c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = box;
        });
        s.getColumn(c1).width = 14; s.getColumn(c2).width = 12;
        s.getColumn(c1).numFmt = '0.000'; s.getColumn(c2).numFmt = '0.00';
      });
      r2.height = 30;
      const nMax = Math.max(...results.map(r => r[key].length));
      for (let j = 0; j < nMax; j++) {
        const vals = [];
        results.forEach(r => { vals.push(num(r[key][j])); vals.push(num(r.y[j])); });
        s.addRow(vals);
      }
      s.views = [{ state: 'frozen', ySplit: 2 }];
    };
    spectraSheet('Calibrated Spectra', 'wnCal', 'Raman shift, Si-calibrated (cm⁻¹)', 'FF2E8B57');
    spectraSheet('Original Spectra', 'wnRaw', 'Raman shift, original (cm⁻¹)', 'FF8D939C');

    /* ---------------- Method ---------------- */
    const wm = wb.addWorksheet('Method', { properties: { tabColor: { argb: 'FF8D939C' } } });
    wm.getColumn(1).width = 34; wm.getColumn(2).width = 100;
    titleBlock(wm, 'Settings and method', 'Change the Si reference in B3 and every "own Si peak" shift on the Summary sheet updates.', 2);
    const set = [
      ['Si reference (cm⁻¹)', settings.siReference],
      ['Saturation level (counts)', settings.saturationLevel],
      ['Plot range (cm⁻¹)', `${settings.plotMin} to ${settings.plotMax}`],
    ];
    set.forEach(([k, v], i) => { wm.getCell(3 + i, 1).value = k; wm.getCell(3 + i, 2).value = v; });
    wm.getCell(3, 2).font = font({ bold: true, color: { argb: 'FF0000FF' } });
    wm.getCell(3, 2).alignment = { horizontal: 'left' };
    wb.definedNames.add("'Method'!$B$3", 'SiReference');
    const steps = [
      ['Si peak', 'Linear baseline from 490-500 and 545-555 cm⁻¹. Sub-pixel maximum from a Gaussian (log-parabola) fit to the points above 60% of the peak top. If more than 2 points are saturated, the midpoint of the two flanks at 75% height is used instead.'],
      ['Shift', 'Each spectrum is shifted so its own Si peak sits at the reference. A spectrum whose Si is weak or missing uses the median Si of the other spectra in the same file.'],
      ['MoS₂ peaks', 'On the calibrated axis: linear baseline from 350-368 and 420-440 cm⁻¹, then the same peak-top fit for E¹₂g (372-394) and A₁g (396-418). FWHM is read directly at half height.'],
      ['Detection', 'MoS₂ counts as present when A₁g height > 6x noise and E¹₂g height > 3x noise. Noise is the point-to-point scatter between 600 and 900 cm⁻¹.'],
      ['Layer classes', 'Δ 18 to <20 monolayer-like, 20 to <23 bilayer-like, 23 to 30 few-layer / thick. Values within about 0.3 cm⁻¹ of a boundary are borderline.'],
      ['Low resolution', 'Scans with more than 1 cm⁻¹ between points (for example 600 gr/mm) are processed the same way; their Δ is good to roughly ±0.5 cm⁻¹.'],
    ];
    let mr = 8;
    wm.getCell(mr - 1, 1).value = 'Method'; wm.getCell(mr - 1, 1).font = font({ bold: true, size: 12 });
    steps.forEach(([k, v]) => {
      wm.getCell(mr, 1).value = k; wm.getCell(mr, 1).font = font({ bold: true });
      wm.getCell(mr, 2).value = v; wm.getCell(mr, 2).alignment = { wrapText: true, vertical: 'top' };
      wm.getRow(mr).height = 30; mr++;
    });
    mr += 1;
    wm.getCell(mr, 1).value = 'Instrument settings from the TXT headers'; wm.getCell(mr, 1).font = font({ bold: true, size: 12 }); mr++;
    const keys = ['Excitation Wavelength', 'Excitation Power', 'Grating', 'Objective Lens', 'Exposure Time', 'Averaging', 'Wavenumber Shift compensation (cm-1)', 'Measurement Time'];
    for (const f of files) {
      const meta = results.find(r => r.file === f).meta || {};
      const found = keys.filter(k => meta[k] !== undefined);
      wm.getCell(mr, 1).value = f; wm.getCell(mr, 1).font = font({ bold: true });
      wm.getCell(mr, 2).value = found.length ? found.map(k => `${k}: ${meta[k]}`).join('   |   ') : 'No instrument header in this file';
      wm.getCell(mr, 2).alignment = { wrapText: true }; mr++;
    }
    wm.eachRow(row => row.eachCell(c => { if (!c.font || !c.font.name) c.font = font(); }));

    return wb.xlsx.writeBuffer();
  }

  root.RamanExcel = { build };
})(typeof self !== 'undefined' ? self : this);
