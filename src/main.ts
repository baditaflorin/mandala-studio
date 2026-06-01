import {
  clamp,
  expandStroke,
  SEGMENTS_MAX,
  SEGMENTS_MIN,
  type Point,
  type Stroke,
} from "./symmetry";
import { strokesToSvg } from "./svg";

// ---- DOM helpers ----------------------------------------------------------
function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const canvas = el<HTMLCanvasElement>("canvas");
const ctx = canvas.getContext("2d")!;

// ---- app state ------------------------------------------------------------
// The stroke list is the single source of truth. The canvas is always redrawn
// from it, so Undo just pops the last stroke and the SVG export reads the same
// list. Live state (color/size/segments/…) only describes how *new* strokes are
// captured and how the whole list is rendered.
const PALETTE = [
  "#b67bff",
  "#ff6b6b",
  "#ffd166",
  "#06d6a0",
  "#4cc9f0",
  "#f72585",
  "#ffffff",
  "#1a1a22",
];

const state = {
  segments: 12,
  mirror: false,
  guides: false,
  brushColor: PALETTE[0]!,
  brushSize: 6,
  background: "#0b0a10",
};

let strokes: Stroke[] = [];
let current: Stroke | null = null;
let dpr = Math.min(2, window.devicePixelRatio || 1);

function cssSize(): { w: number; h: number } {
  const stage = canvas.parentElement!;
  const r = stage.getBoundingClientRect();
  return { w: Math.max(320, Math.floor(r.width)), h: Math.max(320, Math.floor(r.height)) };
}

function center(): Point {
  const { w, h } = cssSize();
  return { x: w / 2, y: h / 2 };
}

function resizeCanvas(): void {
  const { w, h } = cssSize();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawStroke(stroke: Stroke, c: Point): void {
  if (stroke.points.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const line of expandStroke(stroke.points, state.segments, state.mirror, c)) {
    if (line.length === 1) {
      const p = line[0]!;
      ctx.beginPath();
      ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(line[0]!.x, line[0]!.y);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i]!.x, line[i]!.y);
    ctx.stroke();
  }
}

function drawGuides(c: Point): void {
  const { w, h } = cssSize();
  const radius = Math.hypot(w, h);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i < state.segments; i++) {
    const a = (i * Math.PI * 2) / state.segments;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(a) * radius, c.y + Math.sin(a) * radius);
    ctx.stroke();
  }
  ctx.restore();
}

function redraw(): void {
  const { w, h } = cssSize();
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, w, h);
  const c = center();
  if (state.guides) drawGuides(c);
  for (const stroke of strokes) drawStroke(stroke, c);
  if (current) drawStroke(current, c);
}

// ---- pointer drawing ------------------------------------------------------
function pointerPos(e: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onPointerDown(e: PointerEvent): void {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  current = { color: state.brushColor, size: state.brushSize, points: [pointerPos(e)] };
  redraw();
}

function onPointerMove(e: PointerEvent): void {
  if (!current) return;
  e.preventDefault();
  const p = pointerPos(e);
  const last = current.points[current.points.length - 1]!;
  // Skip sub-pixel jitter so the stroke list stays compact.
  if (Math.hypot(p.x - last.x, p.y - last.y) < 1) return;
  current.points.push(p);
  redraw();
}

function onPointerUp(e: PointerEvent): void {
  if (!current) return;
  e.preventDefault();
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
  strokes.push(current);
  current = null;
  syncButtons();
  redraw();
}

// ---- controls wiring ------------------------------------------------------
function syncButtons(): void {
  el<HTMLButtonElement>("undo").disabled = strokes.length === 0;
  el<HTMLButtonElement>("clear").disabled = strokes.length === 0;
}

function setActiveSwatch(): void {
  for (const sw of document.querySelectorAll<HTMLButtonElement>(".swatch")) {
    sw.classList.toggle("active", sw.dataset.color === state.brushColor);
  }
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSwatches(): void {
  const wrap = el<HTMLElement>("swatches");
  for (const color of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.color = color;
    b.style.background = color;
    b.setAttribute("aria-label", `Brush color ${color}`);
    b.addEventListener("click", () => {
      state.brushColor = color;
      el<HTMLInputElement>("brushColor").value = color;
      setActiveSwatch();
    });
    wrap.appendChild(b);
  }
}

function wire(): void {
  buildSwatches();

  // Initialise controls from defaults.
  const seg = el<HTMLInputElement>("segments");
  seg.value = String(state.segments);
  el<HTMLOutputElement>("segments-out").textContent = String(state.segments);
  el<HTMLInputElement>("mirror").checked = state.mirror;
  el<HTMLInputElement>("guides").checked = state.guides;
  el<HTMLInputElement>("brushColor").value = state.brushColor;
  const size = el<HTMLInputElement>("brushSize");
  size.value = String(state.brushSize);
  el<HTMLOutputElement>("brushSize-out").textContent = String(state.brushSize);
  el<HTMLInputElement>("bgColor").value = state.background;
  setActiveSwatch();
  syncButtons();

  seg.addEventListener("input", (e) => {
    state.segments = clamp(
      Number((e.target as HTMLInputElement).value),
      SEGMENTS_MIN,
      SEGMENTS_MAX,
    );
    el<HTMLOutputElement>("segments-out").textContent = String(state.segments);
    redraw();
  });
  el<HTMLInputElement>("mirror").addEventListener("change", (e) => {
    state.mirror = (e.target as HTMLInputElement).checked;
    redraw();
  });
  el<HTMLInputElement>("guides").addEventListener("change", (e) => {
    state.guides = (e.target as HTMLInputElement).checked;
    redraw();
  });
  el<HTMLInputElement>("brushColor").addEventListener("input", (e) => {
    state.brushColor = (e.target as HTMLInputElement).value;
    setActiveSwatch();
  });
  size.addEventListener("input", (e) => {
    state.brushSize = Number((e.target as HTMLInputElement).value);
    el<HTMLOutputElement>("brushSize-out").textContent = String(state.brushSize);
  });
  el<HTMLInputElement>("bgColor").addEventListener("input", (e) => {
    state.background = (e.target as HTMLInputElement).value;
    redraw();
  });

  el("undo").addEventListener("click", () => {
    strokes.pop();
    syncButtons();
    redraw();
  });
  el("clear").addEventListener("click", () => {
    if (strokes.length === 0) return;
    strokes = [];
    current = null;
    syncButtons();
    redraw();
  });

  el("png").addEventListener("click", () => {
    canvas.toBlob((blob) => {
      if (blob) download("mandala.png", blob);
    }, "image/png");
  });

  el("svg").addEventListener("click", () => {
    const { w, h } = cssSize();
    const svg = strokesToSvg(strokes, {
      width: w,
      height: h,
      background: state.background,
      segments: state.segments,
      mirror: state.mirror,
      center: center(),
    });
    download("mandala.svg", new Blob([svg], { type: "image/svg+xml" }));
  });

  // Pointer drawing.
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // Panel show/hide (mobile).
  el("toggle-panel").addEventListener("click", () => el("panel").classList.add("hidden"));
  el("show-panel").addEventListener("click", () => el("panel").classList.remove("hidden"));

  el<HTMLElement>("version").textContent = `v${__APP_VERSION__} · ${__GIT_COMMIT__}`;

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeCanvas();
      redraw();
    }, 150);
  });
}

resizeCanvas();
wire();
redraw();
