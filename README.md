# mandala-studio

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmandala--studio-b67bff)](https://baditaflorin.github.io/mandala-studio/)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/baditaflorin/mandala-studio/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> A symmetry / kaleidoscope drawing canvas — draw once and it blooms into a mandala. Print or export SVG + PNG.

**Live → https://baditaflorin.github.io/mandala-studio/**

Whatever you draw is mirrored and rotated around the center into N-fold radial symmetry, so a single gesture paints a full symmetric bloom. It is meditative to use and the output is crisp vector art — no server, nothing leaves your device.

## What you can do

- **Draw** — drag with mouse or finger; each point is replicated around the center for every slice (and reflected within the slice when **Mirror** is on).
- **Tune** — segments (3–24), mirror toggle, brush color (picker + palette swatches), brush size, background color, optional center guide lines.
- **Undo / Clear** — the drawing is a list of strokes, so Undo just pops the last stroke; Clear empties the canvas.
- **Export** — **⬇ PNG** for a raster, **⬇ SVG** for crisp vectors a pen plotter or laser cutter can run.

## How it works

`symmetry.ts` is pure geometry: `symmetryTransforms(segments, mirror)` builds the list of rotate/reflect transforms, `applyTransform` maps a point through one of them about the center, and `expandStroke` replicates a drawn polyline into its full symmetric orbit. The canvas renderer and the SVG exporter (`svg.ts`) both read the **same stroke list** and apply the **same** `expandStroke`, so the export matches the screen exactly.

All geometry is pure and unit-tested (`tests/core.test.ts`); the UI in `main.ts` is a thin wiring layer that captures pointer strokes and redraws the list.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mandala-studio
cd mandala-studio
npm install
npm run dev      # http://127.0.0.1:5173
```

## Build & deploy

GitHub Pages serves the committed `docs/` directory on `main`. No CI — a local smoke gate builds and sanity-checks the output:

```bash
npm run smoke    # vitest + vite build → docs/ + output checks
```

## Privacy

100% client-side. There is no backend, no analytics, no upload. Your drawing lives only in the browser tab until you export it.

## License

MIT — see [LICENSE](./LICENSE).
