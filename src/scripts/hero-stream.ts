// hero-stream.ts - the hero's data stream: glyphs and packets flowing along an s-curve band, with service chips
// riding it and lighting up in order, like one event moving through the system. the cursor pushes particles aside.
// with reduced motion it draws one still frame

import { stream as tokens } from "../motion/tokens";
import { reducedMotion } from "./env";

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789{}[]<>/:=._+*".split("");
const CELL = 16;
const LUT_N = 240;

type Pt = { x: number; y: number };
type Particle = { s: number; off: number; speed: number; glyph: number; size: number; alpha: number; seed: number; tint: string | null };

const bez = (p: Pt[], t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x, y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y };
};

// a roughly gaussian number in -1..1, so the band is dense in the middle and sparse at the edges
const gauss = () => Math.max(-1, Math.min(1, (Math.random() + Math.random() + Math.random() - 1.5) / 1.1));

export function mountHeroStream(host: HTMLElement) {
  const canvas = host.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const chips = [...host.querySelectorAll<HTMLElement>(".hero-chip")];
  const section = host.closest<HTMLElement>("[data-hero]")!;
  const css = getComputedStyle(section);
  const tints = [css.getPropertyValue("--c-edge").trim(), css.getPropertyValue("--c-stream").trim()];

  let W = 0;
  let H = 0;
  let dpr = 1;
  let atlas: HTMLCanvasElement;
  // arc-length table: lut[i] is the point at i/LUT_N of the band's length, with its unit normal
  let lut: { x: number; y: number; nx: number; ny: number }[] = [];
  let band = 0;
  let particles: Particle[] = [];

  function buildAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = GLYPHS.length * CELL * dpr;
    atlas.height = CELL * dpr;
    const a = atlas.getContext("2d")!;
    a.scale(dpr, dpr);
    a.fillStyle = "#f4f4f2";
    a.font = `400 12px "Geist Mono", ui-monospace, Menlo, monospace`;
    a.textAlign = "center";
    a.textBaseline = "middle";
    GLYPHS.forEach((g, i) => a.fillText(g, i * CELL + CELL / 2, CELL / 2));
  }

  function controlPoints(): Pt[] {
    if (W < 640) {
      // phones: a band across the open space above the headline
      const top = Math.min(W * 0.62, 280);
      return [
        { x: -0.1 * W, y: top * 0.25 },
        { x: 0.35 * W, y: top * 1.25 },
        { x: 0.7 * W, y: -top * 0.2 },
        { x: 1.12 * W, y: top * 0.8 },
      ];
    }
    // desktop: an s-curve down the right side, clear of the copy column
    return [
      { x: 0.8 * W, y: -0.12 * H },
      { x: 0.6 * W, y: 0.32 * H },
      { x: 1.0 * W, y: 0.5 * H },
      { x: 0.74 * W, y: 1.1 * H },
    ];
  }

  function layout() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width;
    H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildAtlas();

    const p = controlPoints();
    const raw: Pt[] = Array.from({ length: 800 }, (_, i) => bez(p, i / 799));
    const acc = [0];
    for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
    const total = acc[acc.length - 1];
    lut = [];
    let j = 0;
    for (let i = 0; i <= LUT_N; i++) {
      const target = (i / LUT_N) * total;
      while (j < acc.length - 2 && acc[j + 1] < target) j++;
      const a = raw[j];
      const b = raw[j + 1];
      const k = (target - acc[j]) / (acc[j + 1] - acc[j] || 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      lut.push({ x: a.x + dx * k, y: a.y + dy * k, nx: -dy / l, ny: dx / l });
    }
    band = (W < 640 ? 0.55 : 1) * tokens.width * Math.max(H, 600);
    // chips stay right of the copy column on desktop
    const minX = W < 640 ? 8 : W * 0.56;
    // phones: only inside the open band above the name tag
    const maxY = W < 640 ? Math.min(W * 0.62, 280) - 10 : H * 0.8;

    const n = Math.round(tokens.count * (W < 640 ? 0.45 : 1));
    if (particles.length !== n) {
      particles = Array.from({ length: n }, () => {
        const stray = Math.random() < 0.12;
        const accent = Math.random() < 0.035;
        return {
          s: Math.random(),
          off: gauss() * (stray ? 2.6 : 1),
          speed: (0.6 + Math.random() * 0.8) * tokens.speed,
          glyph: Math.floor(Math.random() * GLYPHS.length),
          size: 0.6 + Math.random() * 0.45,
          alpha: stray ? 0.12 + Math.random() * 0.2 : 0.2 + Math.random() * 0.65,
          seed: Math.random() * 100,
          tint: accent ? tints[Math.floor(Math.random() * tints.length)] : null,
        };
      });
    }

    // chips sit just off the band at their own points along it
    for (const c of chips) {
      const i = Math.round(Number(c.dataset.t) * LUT_N);
      const q = lut[i];
      const side = Number(c.dataset.side);
      const d = band * 0.55 + 18;
      const x = q.x + q.nx * d * side;
      const y = q.y + q.ny * d * side;
      const visible = x > minX && x < W - 120 && y > 70 && y < maxY;
      c.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      c.style.visibility = visible ? "" : "hidden";
    }
  }

  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  section.addEventListener(
    "pointermove",
    (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = e.clientX - r.left;
      pointer.ty = e.clientY - r.top;
    },
    { passive: true }
  );
  section.addEventListener("pointerleave", () => {
    pointer.tx = pointer.ty = -9999;
  });

  function draw(t: number, dt: number) {
    ctx.clearRect(0, 0, W, H);
    pointer.x += (pointer.tx - pointer.x) * 0.18;
    pointer.y += (pointer.ty - pointer.y) * 0.18;
    const shift = -tokens.scrollShift * Math.min(1, Math.max(0, scrollY / (section.offsetHeight || 1)));
    const R = tokens.pointerRadius;
    const cell = CELL * dpr;

    for (const p of particles) {
      // speeds are px/s; the band is about 1.3 screen heights long
      p.s = (p.s + (p.speed * dt) / (Math.max(W, H) * 1.3)) % 1;
      const q = lut[Math.floor(p.s * LUT_N)];
      const wob = Math.sin(t * 0.8 + p.seed) * 4;
      let x = q.x + q.nx * (p.off * band * 0.5 + wob);
      let y = q.y + q.ny * (p.off * band * 0.5 + wob) + shift;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const dist = Math.hypot(dx, dy);
      let boost = 0;
      if (dist < R) {
        const f = (1 - dist / R) ** 2;
        x += (dx / (dist || 1)) * f * tokens.pointerForce;
        y += (dy / (dist || 1)) * f * tokens.pointerForce;
        boost = f * 0.6;
      }
      // fade in and out at the band's ends, and out over the bottom row of names
      const ends = Math.min(1, p.s * 8, (1 - p.s) * 8, Math.max(0, (H * 0.86 - y) / (H * 0.18)));
      ctx.globalAlpha = Math.min(1, (p.alpha + boost) * ends);
      if (p.tint) {
        ctx.fillStyle = p.tint;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      } else {
        const s = CELL * p.size;
        ctx.drawImage(atlas, p.glyph * cell, 0, cell, cell, x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  layout();
  draw(0, 0);
  host.classList.add("is-ready");
  new ResizeObserver(() => {
    layout();
    if (reducedMotion) draw(0, 0);
  }).observe(canvas);
  document.fonts?.ready.then(() => {
    buildAtlas();
    if (reducedMotion) draw(0, 0);
  });
  if (reducedMotion) return;

  let raf = 0;
  let last = 0;
  let visible = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 100) / 1000 : 0;
    last = now;
    draw(now / 1000, dt);
  };
  const sync = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  }).observe(section);
  document.addEventListener("visibilitychange", sync);

  // one event walking the services in order
  let hot = 0;
  setInterval(() => {
    if (!visible || document.hidden) return;
    chips.forEach((c, i) => c.classList.toggle("is-hot", i === hot));
    hot = (hot + 1) % (chips.length + 2);
  }, 700);
}
