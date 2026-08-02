// Pure radial-symmetry geometry. No canvas, no DOM — just numbers, so it runs
// under vitest's node env and is shared verbatim by the canvas renderer and the
// SVG exporter. A single drawn gesture is replicated into `segments`-fold
// rotational symmetry (and optionally mirrored within each slice) to bloom into
// a mandala.

export type Point = { x: number; y: number };

/** A rigid transform = rotate by `angle` (radians) about the center, then
 *  optionally reflect across the slice's bisector axis. */
export type Transform = { angle: number; mirror: boolean };

/** One stroke as the user drew it: a color, a brush size, and the raw points. */
export type Stroke = {
  color: string;
  size: number;
  points: Point[];
};

export const SEGMENTS_MIN = 3;
export const SEGMENTS_MAX = 24;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The set of transforms that turns one drawn point into its full symmetric
 * orbit. Without mirroring there is one rotation per segment (`segments`
 * transforms, evenly spaced around the circle). With mirroring each slice also
 * gets a reflected copy, doubling the count to `2 * segments`.
 *
 * The mirror is applied *before* the rotation in {@link applyTransform}, so the
 * reflection axis for every slice is the same canonical axis (the +x ray from
 * center); rotating the reflected point then lands it in the correct slice.
 */
export function symmetryTransforms(segments: number, mirror: boolean): Transform[] {
  const n = Math.max(1, Math.floor(segments));
  const step = (Math.PI * 2) / n;
  const out: Transform[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ angle: i * step, mirror: false });
    if (mirror) out.push({ angle: i * step, mirror: true });
  }
  return out;
}

/**
 * Map a point through one transform about `center`.
 *
 * Order of operations relative to center: optional reflection across the x-axis
 * (negating the y offset), then rotation by `angle`. Reflect-then-rotate keeps
 * the seam between mirrored pairs aligned to the slice boundaries.
 */
export function applyTransform(point: Point, t: Transform, center: Point): Point {
  let dx = point.x - center.x;
  let dy = point.y - center.y;
  if (t.mirror) dy = -dy;
  const cos = Math.cos(t.angle);
  const sin = Math.sin(t.angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Expand one drawn polyline into every symmetric copy. Returns one polyline per
 * transform, i.e. `segments` polylines (or `2 * segments` when mirrored). Empty
 * input yields no polylines.
 */
export function expandStroke(
  points: Point[],
  segments: number,
  mirror: boolean,
  center: Point,
): Point[][] {
  if (points.length === 0) return [];
  const transforms = symmetryTransforms(segments, mirror);
  return transforms.map((t) => points.map((p) => applyTransform(p, t, center)));
}

/**
 * Shift every point of a stroke by (dx, dy), returning a new stroke (input is
 * not mutated).
 *
 * Strokes are captured in absolute canvas-pixel coordinates, not as offsets
 * from the mandala center. If the canvas is later resized (window resize,
 * orientation change, DevTools opening/closing, ...) the center moves but
 * already-drawn strokes don't — so redrawing them against the *new* center
 * would visibly drag the whole symmetric bloom off to one side instead of
 * keeping it centered. Callers should compute the old and new center and
 * translate every existing stroke by the difference so already-drawn artwork
 * stays anchored to the (possibly relocated) center across a resize.
 */
export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  if (dx === 0 && dy === 0) return stroke;
  return {
    ...stroke,
    points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}
