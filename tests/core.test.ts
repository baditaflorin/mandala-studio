import { describe, expect, it } from "vitest";
import {
  applyTransform,
  clamp,
  expandStroke,
  symmetryTransforms,
  translateStroke,
  type Point,
} from "../src/symmetry";
import { strokesToSvg, strokeToSvgElements, type SvgOpts } from "../src/svg";

const C: Point = { x: 100, y: 100 };

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("symmetryTransforms", () => {
  it("yields one transform per segment without mirror", () => {
    expect(symmetryTransforms(12, false)).toHaveLength(12);
    expect(symmetryTransforms(3, false)).toHaveLength(3);
  });

  it("doubles the count with mirror", () => {
    expect(symmetryTransforms(12, true)).toHaveLength(24);
    expect(symmetryTransforms(6, true)).toHaveLength(12);
  });

  it("spaces rotation angles evenly around the circle", () => {
    const ts = symmetryTransforms(4, false);
    expect(ts[0]!.angle).toBeCloseTo(0);
    expect(ts[1]!.angle).toBeCloseTo(Math.PI / 2);
    expect(ts[2]!.angle).toBeCloseTo(Math.PI);
    expect(ts[3]!.angle).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("first transform of each pair is unmirrored, second mirrored", () => {
    const ts = symmetryTransforms(3, true);
    expect(ts[0]!.mirror).toBe(false);
    expect(ts[1]!.mirror).toBe(true);
    expect(ts[2]!.mirror).toBe(false);
  });
});

describe("applyTransform", () => {
  it("4-fold symmetry rotates (cx+10, cy) by 90° to ~(cx, cy+10)", () => {
    const ts = symmetryTransforms(4, false);
    const p = applyTransform({ x: C.x + 10, y: C.y }, ts[1]!, C);
    expect(p.x).toBeCloseTo(C.x);
    expect(p.y).toBeCloseTo(C.y + 10);
  });

  it("a full 360/segments rotation returns to start", () => {
    // The identity transform (angle 0) is a no-op; the last slice rotated by a
    // further step lands back on the original point.
    const start = { x: C.x + 37, y: C.y - 14 };
    const back = applyTransform(start, { angle: Math.PI * 2, mirror: false }, C);
    expect(back.x).toBeCloseTo(start.x);
    expect(back.y).toBeCloseTo(start.y);
  });

  it("the identity transform leaves a point unchanged", () => {
    const start = { x: 123, y: 45 };
    const same = applyTransform(start, { angle: 0, mirror: false }, C);
    expect(same.x).toBeCloseTo(start.x);
    expect(same.y).toBeCloseTo(start.y);
  });

  it("mirror reflects across the slice axis (negates the y offset)", () => {
    const p = applyTransform({ x: C.x + 20, y: C.y + 5 }, { angle: 0, mirror: true }, C);
    expect(p.x).toBeCloseTo(C.x + 20);
    expect(p.y).toBeCloseTo(C.y - 5);
  });

  it("preserves distance from center (rigid motion)", () => {
    const start = { x: C.x + 30, y: C.y + 40 }; // 50 from center
    for (const t of symmetryTransforms(7, true)) {
      const p = applyTransform(start, t, C);
      const d = Math.hypot(p.x - C.x, p.y - C.y);
      expect(d).toBeCloseTo(50);
    }
  });
});

describe("expandStroke", () => {
  const stroke: Point[] = [
    { x: C.x + 10, y: C.y },
    { x: C.x + 30, y: C.y + 5 },
  ];

  it("yields `segments`× as many polylines without mirror", () => {
    expect(expandStroke(stroke, 12, false, C)).toHaveLength(12);
    expect(expandStroke(stroke, 6, false, C)).toHaveLength(6);
  });

  it("yields 2×`segments` polylines with mirror", () => {
    expect(expandStroke(stroke, 12, true, C)).toHaveLength(24);
  });

  it("keeps each polyline the same length as the source", () => {
    const lines = expandStroke(stroke, 5, false, C);
    for (const line of lines) expect(line).toHaveLength(stroke.length);
  });

  it("the first (identity) polyline equals the input", () => {
    const lines = expandStroke(stroke, 8, false, C);
    expect(lines[0]![0]!.x).toBeCloseTo(stroke[0]!.x);
    expect(lines[0]![0]!.y).toBeCloseTo(stroke[0]!.y);
  });

  it("returns nothing for an empty stroke", () => {
    expect(expandStroke([], 12, true, C)).toHaveLength(0);
  });
});

describe("translateStroke", () => {
  const stroke = {
    color: "#4cc9f0",
    size: 5,
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
  };

  it("shifts every point by (dx, dy)", () => {
    const shifted = translateStroke(stroke, 100, -50);
    expect(shifted.points).toEqual([
      { x: 110, y: -30 },
      { x: 130, y: -10 },
    ]);
  });

  it("preserves color and size", () => {
    const shifted = translateStroke(stroke, 5, 5);
    expect(shifted.color).toBe(stroke.color);
    expect(shifted.size).toBe(stroke.size);
  });

  it("does not mutate the input stroke", () => {
    const original = JSON.parse(JSON.stringify(stroke));
    translateStroke(stroke, 7, 7);
    expect(stroke).toEqual(original);
  });

  it("is a no-op for a zero delta", () => {
    expect(translateStroke(stroke, 0, 0)).toBe(stroke);
  });

  it(
    "re-anchors a stroke to a new center: translating by (newCenter - " +
      "oldCenter) keeps the point at the same offset from center",
    () => {
      const oldCenter = { x: 100, y: 100 };
      const newCenter = { x: 250, y: 80 };
      const dx = newCenter.x - oldCenter.x;
      const dy = newCenter.y - oldCenter.y;
      const p: Point = { x: 130, y: 90 }; // offset (30, -10) from oldCenter
      const shifted = translateStroke({ ...stroke, points: [p] }, dx, dy);
      const newOffset = {
        x: shifted.points[0]!.x - newCenter.x,
        y: shifted.points[0]!.y - newCenter.y,
      };
      expect(newOffset.x).toBeCloseTo(p.x - oldCenter.x);
      expect(newOffset.y).toBeCloseTo(p.y - oldCenter.y);
    },
  );
});

describe("svg export", () => {
  const opts: SvgOpts = {
    width: 200,
    height: 200,
    background: "#0b0a10",
    segments: 6,
    mirror: false,
    center: C,
  };

  it("emits an svg with a background rect and paths", () => {
    const strokes = [
      {
        color: "#ff6b6b",
        size: 3,
        points: [
          { x: 110, y: 100 },
          { x: 140, y: 120 },
        ],
      },
    ];
    const svg = strokesToSvg(strokes, opts);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect");
    expect(svg).toContain("#0b0a10");
    expect(svg).toContain("<path");
    expect(svg).toContain('stroke="#ff6b6b"');
  });

  it("renders a single-point stroke as a circle dot", () => {
    const els = strokeToSvgElements({ color: "#fff", size: 8, points: [{ x: 130, y: 100 }] }, opts);
    expect(els).toHaveLength(opts.segments);
    expect(els[0]).toContain("<circle");
    expect(els[0]).toContain('r="4"'); // size / 2
  });

  it("produces `segments` path elements per multi-point stroke", () => {
    const els = strokeToSvgElements(
      {
        color: "#fff",
        size: 2,
        points: [
          { x: 120, y: 100 },
          { x: 150, y: 110 },
        ],
      },
      opts,
    );
    expect(els).toHaveLength(opts.segments);
  });

  it("escapes a malicious color string", () => {
    const svg = strokesToSvg(
      [{ color: '"><script>', size: 2, points: [{ x: 110, y: 100 }] }],
      opts,
    );
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});
