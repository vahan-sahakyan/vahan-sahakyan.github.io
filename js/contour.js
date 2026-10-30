// contour.js - drifting contour lines behind the hero and the contact section (canvas[data-contour]).
// d3-contour loads after the page has painted, so it never competes with the hero text;
// data-contour shifts the hills' phases so each section gets its own terrain

import { visibleLoop, fitCanvas, onSchemeChange, reduceMotion } from "./visible-loop.js";

const D3_CONTOUR = "https://cdn.jsdelivr.net/npm/d3-contour@4.0.2/+esm";
// field resolution in css px; ~15k cells on a 1440x900 hero
const CELL = 10;
const THRESHOLDS = Array.from({ length: 25 }, (_, i) => -0.9 + i * 0.14);

// gaussian hills drifting on slow sine paths, negative amplitudes are basins
const HILLS = [
  { fx: 0.071, fy: 0.052, px: 0.4, py: 2.1, r: 0.22, a: 1.1 },
  { fx: 0.093, fy: 0.061, px: 2.6, py: 0.3, r: 0.18, a: 0.9 },
  { fx: 0.058, fy: 0.087, px: 4.1, py: 4.6, r: 0.27, a: -0.8 },
  { fx: 0.112, fy: 0.044, px: 1.3, py: 5.2, r: 0.16, a: 1.2 },
  { fx: 0.066, fy: 0.079, px: 5.5, py: 1.7, r: 0.24, a: 0.8 },
  { fx: 0.084, fy: 0.069, px: 3.3, py: 3.4, r: 0.2, a: -0.9 },
  { fx: 0.049, fy: 0.095, px: 0.9, py: 2.9, r: 0.19, a: 1.0 },
];

function mount(canvas, section, { contours }, phase) {
  const gen = contours().thresholds(THRESHOLDS);
  const pointer = { u: 0, v: 0, k: 0, target: 0 };
  let field = null;
  let color = "";
  let loop;

  const readColor = () => (color = getComputedStyle(canvas).getPropertyValue("--contour-c").trim());
  readColor();
  const s = fitCanvas(canvas, () => loop?.draw());
  const { ctx } = s;

  function step(dt, t) {
    const nx = Math.ceil(s.w / CELL) + 1;
    const ny = Math.ceil(s.h / CELL) + 1;
    if (!field || field.length !== nx * ny) field = new Float64Array(nx * ny);
    pointer.k += (pointer.target - pointer.k) * Math.min(1, dt * 3);

    // positions are in units of the canvas height, so hills stay round at any aspect ratio
    const aspect = s.w / s.h;
    const hills = HILLS.map((b) => [
      aspect * (0.5 + 0.44 * Math.sin(t * b.fx + b.px + phase)),
      0.5 + 0.44 * Math.sin(t * b.fy * 1.3 + b.py + phase * 1.7),
      1 / (2 * b.r * b.r),
      b.a,
    ]);
    if (pointer.k > 0.01) hills.push([pointer.u, pointer.v, 50, 1.3 * pointer.k]);
    const scale = CELL / s.h;
    for (let j = 0; j < ny; j++) {
      const v = j * scale;
      for (let i = 0; i < nx; i++) {
        const u = i * scale;
        let z = 0.22 * Math.sin(u * 3.1 + t * 0.07) * Math.cos(v * 2.4 - t * 0.05);
        for (const [hx, hy, k, a] of hills) {
          const dx = u - hx;
          const dy = v - hy;
          z += a * Math.exp(-(dx * dx + dy * dy) * k);
        }
        field[j * nx + i] = z;
      }
    }

    const polys = gen.size([nx, ny])(field);
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.strokeStyle = color;
    polys.forEach((p, k) => {
      if (!p.coordinates.length) return;
      // every fourth line is an index contour, drawn heavier like on a survey map
      const index = k % 4 === 0;
      ctx.beginPath();
      for (const poly of p.coordinates) {
        for (const ring of poly) {
          for (let n = 0; n < ring.length; n++) {
            const x = (ring[n][0] - 0.5) * CELL;
            const y = (ring[n][1] - 0.5) * CELL;
            n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
        }
      }
      ctx.globalAlpha = index ? 0.34 : 0.07 + (0.16 * k) / polys.length;
      ctx.lineWidth = index ? 1.1 : 0.7;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  loop = visibleLoop(canvas, step, { fps: 30 });
  canvas.classList.add("is-ready");
  onSchemeChange(() => {
    readColor();
    loop.draw();
  });

  // the pointer raises a hill; mouse only, touch scrolling stays smooth
  if (reduceMotion) return;
  section.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect();
    pointer.u = (e.clientX - r.left) / s.h;
    pointer.v = (e.clientY - r.top) / s.h;
    pointer.target = 1;
  });
  section.addEventListener("pointerleave", () => (pointer.target = 0));
}

// after load and an idle moment, or 3s at most, so a stalled third-party asset can't hold it back
const pageReady = new Promise((resolve) => {
  if (document.readyState === "complete") resolve();
  else addEventListener("load", resolve, { once: true });
  setTimeout(resolve, 3000);
}).then(() => new Promise((r) => ("requestIdleCallback" in window ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 300))));

let d3;
const loadD3 = () => (d3 ??= pageReady.then(() => import(D3_CONTOUR)));

for (const canvas of document.querySelectorAll("canvas[data-contour]")) {
  if (!("IntersectionObserver" in window)) break;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      loadD3()
        .then((m) => mount(canvas, canvas.closest("section"), m, +canvas.dataset.contour || 0))
        .catch(() => canvas.remove());
    },
    { rootMargin: "300px" }
  );
  io.observe(canvas);
}
