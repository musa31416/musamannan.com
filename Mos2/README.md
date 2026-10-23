# Raman Si Calibrator

A web tool for the Leem Lab (UT Dallas). Drop raw Raman TXT exports from the spectrometer and it:

1. shifts every spectrum so its Si peak sits at 520.7 cm⁻¹ (or any reference you set),
2. finds the MoS₂ E¹₂g and A₁g peaks on the corrected axis and their peak difference Δ,
3. gives you a formatted **Excel workbook** and a **ZIP of plots** to download.

Tick the boxes in the results table to stack any set of spectra in the **Selected spectra** tab for a side-by-side comparison. **Download this figure** saves whichever view is showing as a PNG.

Everything runs in the visitor's browser. Raw data is never uploaded anywhere, so the site can be hosted for free on GitHub Pages with no server.

## What you get

**Excel workbook** (`Raman_Si_calibrated_<date>.xlsx`)
- **Summary**: one row per spectrum with Si position, shift, E¹₂g, A₁g, Δ, FWHMs, signal-to-noise and a color-coded layer class. Includes filters, frozen headers and per-file statistics. The shift and Δ cells are live formulas.
- **Overview**: the stacked plots and the Si calibration check as pictures.
- **Calibrated Spectra**: the shifted wavenumber axis and intensity, two columns per spectrum.
- **Original Spectra**: the untouched data, same layout.
- **Method**: settings, the method, and the instrument settings read from each TXT header. Changing the Si reference in `Method!B3` updates every shift on the Summary sheet.

**Plots ZIP** (`Raman_plots_<date>.zip`)
- `spectra/` has one PNG per spectrum with both peaks marked and Δ written above them.
- `overview/` has all spectra stacked (12 per page) and the Si peaks before and after calibration.
- `Peak_Summary.csv` has the numbers behind the plots.

## Putting it on GitHub Pages

1. Sign in at github.com and click **New repository**. Name it, for example `raman-si-calibrator`. Choose **Public**, since free GitHub Pages needs a public repository. Only the code is public; nobody's data is stored there.
2. On the new repository page, click **uploading an existing file**. Drag in **everything inside this folder**: `index.html`, `README.md`, `.nojekyll` and the `js` folder. Click **Commit changes**.
   - `.nojekyll` starts with a dot, so Windows Explorer may hide it. It is optional; the site works without it.
3. Go to **Settings > Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, **Branch** to `main` and folder `/ (root)`, then click **Save**.
4. Wait a minute or two and refresh the Pages settings. The address appears at the top, for example `https://<your-username>.github.io/raman-si-calibrator/`. Share that link with the lab.

To update the site later, upload the changed files to the same repository. GitHub Pages republishes automatically.

You can also open `index.html` straight from this folder on your own computer: double-click it and it works offline.

## Method

| Step | What happens |
|---|---|
| Read | TXT export with `#` setting lines, column names (repaired if split over several lines) and wavenumber/intensity pairs. Any number of spectra per file. |
| Si peak | Linear baseline from 490 to 500 and 545 to 555 cm⁻¹. Sub-pixel maximum from a Gaussian (log-parabola) fit to the points above 60% of the top. If more than 2 points are saturated, the midpoint of the two flanks at 75% height is used. |
| Shift | Each spectrum is shifted by (reference − its Si position). A spectrum with weak or missing Si uses the median Si of the other spectra in its file. |
| MoS₂ peaks | Baseline from 350 to 368 and 420 to 440 cm⁻¹, then the same peak-top fit for E¹₂g (372 to 394) and A₁g (396 to 418). FWHM read at half height. |
| Detection | MoS₂ counts as present when A₁g > 6× noise and E¹₂g > 3× noise (noise from 600 to 900 cm⁻¹). |
| Layer class | Δ 18 to <20 monolayer-like, 20 to <23 bilayer-like, 23 to 30 few-layer / thick. |

The Si shift moves both peaks equally, so it never changes Δ; it corrects the absolute peak positions. On low-resolution scans (600 gr/mm, about 2.2 cm⁻¹ per point) Δ is good to roughly ±0.5 cm⁻¹.

## Files

```
index.html            the page
js/raman-core.js      reading, Si calibration and peak finding
js/plots.js           the figures
js/excel.js           the Excel workbook
js/app.js             page behaviour
js/vendor/            ExcelJS 4.4.0 and JSZip 3.10.1 (MIT licensed), bundled so the site needs no outside servers
```

Leem Lab, Department of Mechanical Engineering, The University of Texas at Dallas. Built by Musa Ibne Mannan.
