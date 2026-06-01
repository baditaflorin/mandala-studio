// Render the stroke list to a standalone SVG document string. Pure — it applies
// the exact same symmetry transforms the canvas uses (via expandStroke), so the
// exported vector art is print/plotter-ready and matches the screen.

import { expandStroke, type Point, type Stroke } from "./symmetry";

function fmt(n: number): string {
  return Math.round(n * 100) / 100 + "";
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SvgOpts = {
  width: number;
  height: number;
  background: string;
  segments: number;
  mirror: boolean;
  center: Point;
};

/** Build the `<path>`/`<circle>` markup for one stroke's full symmetric orbit. */
export function strokeToSvgElements(stroke: Stroke, opts: SvgOpts): string[] {
  const els: string[] = [];
  if (stroke.points.length === 0) return els;
  const color = escapeAttr(stroke.color);
  const polylines = expandStroke(stroke.points, opts.segments, opts.mirror, opts.center);

  for (const line of polylines) {
    if (line.length === 1) {
      // A single tap renders as a filled dot (radius = half the brush width),
      // matching the round line cap the canvas paints.
      const p = line[0]!;
      els.push(
        `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(stroke.size / 2)}" fill="${color}"/>`,
      );
      continue;
    }
    const d = "M" + line.map((p, i) => `${i === 0 ? "" : "L"}${fmt(p.x)} ${fmt(p.y)}`).join(" ");
    els.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${fmt(
        stroke.size,
      )}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  return els;
}

export function strokesToSvg(strokes: Stroke[], opts: SvgOpts): string {
  const els: string[] = [];
  for (const stroke of strokes) els.push(...strokeToSvgElements(stroke, opts));
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">`,
    `<rect width="100%" height="100%" fill="${escapeAttr(opts.background)}"/>`,
    ...els,
    `</svg>`,
  ].join("\n");
}
