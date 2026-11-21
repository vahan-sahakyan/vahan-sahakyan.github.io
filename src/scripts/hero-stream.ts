// hero-stream.ts - the hero's data stream: glyphs flowing along an s-curve band, with service chips riding it and
// lighting up in order, like one event moving through the system. the cursor pushes particles aside.
// every position is a pure function of elapsed time, interpolated along an arc-length table, so motion stays
// smooth at any frame rate. with reduced motion it draws one still frame

import { stream as tokens } from "../motion/tokens";
import { reducedMotion } from "./env";

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789{}[]<>/:=._+*".split("");
const CELL = 16;
// arc-length samples along the band; positions interpolate between them
const LUT_N = 600;

type Pt = { x: number; y: number };

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
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

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
  let sectionH = 1;
  let atlas: HTMLCanvasElement;
  // lut: x, y, normal x, normal y per sample
  let lut = new Float32Array(0);
  let length = 1;
  let band = 0;

  // particles as parallel typed arrays
  let n = 0;
  let s0 = new Float32Array(0);
  let vel = new Float32Array(0);
  let off = new Float32Array(0);
  let alpha = new Float32Array(0);
  let size = new Float32Array(0);
  let seed = new Float32Array(0);
  let glyph = new Uint8Array(0);
  let tint = new Int8Array(0);

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

  function spawn(count: number) {
    n = count;
    s0 = new Float32Array(n);
    vel = new Float32Array(n);
    off = new Float32Array(n);
    alpha = new Float32Array(n);
    size = new Float32Array(n);
    seed = new Float32Array(n);
    glyph = new Uint8Array(n);
    tint = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      const stray = Math.random() < 0.12;
      s0[i] = Math.random();
      vel[i] = (0.6 + Math.random() * 0.8) * tokens.speed;
      off[i] = gauss() * (stray ? 2.6 : 1);
      alpha[i] = stray ? 0.12 + Math.random() * 0.2 : 0.25 + Math.random() * 0.6;
      size[i] = 0.6 + Math.random() * 0.45;
      seed[i] = Math.random() * 100;
      glyph[i] = Math.floor(Math.random() * GLYPHS.length);
      tint[i] = Math.random() < 0.035 ? Math.floor(Math.random() * tints.length) : -1;
    }
  }

  function layout() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width;
    H = r.height;
    sectionH = section.offsetHeight || 1;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    buildAtlas();

    const p = controlPoints();
    const raw: Pt[] = Array.from({ length: 2000 }, (_, i) => bez(p, i / 1999));
    const acc = [0];
    for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
    length = acc[acc.length - 1];
    lut = new Float32Array((LUT_N + 1) * 4);
    let j = 0;
    for (let i = 0; i <= LUT_N; i++) {
      const target = (i / LUT_N) * length;
      while (j < acc.length - 2 && acc[j + 1] < target) j++;
      const a = raw[j];
      const b = raw[j + 1];
      const k = (target - acc[j]) / (acc[j + 1] - acc[j] || 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      lut.set([a.x + dx * k, a.y + dy * k, -dy / l, dx / l], i * 4);
    }
    band = (W < 640 ? 0.55 : 1) * tokens.width * Math.max(H, 600);

    const count = Math.round(tokens.count * (W < 640 ? 0.45 : 1));
    if (count !== n) spawn(count);

    // chips sit just off the band at their own points along it
    const minX = W < 640 ? 8 : W * 0.56;
    const maxY = W < 640 ? Math.min(W * 0.62, 280) - 10 : H * 0.8;
    for (const c of chips) {
      const i = Math.round(Number(c.dataset.t) * LUT_N) * 4;
      const side = Number(c.dataset.side);
      const d = band * 0.55 + 18;
      const x = lut[i] + lut[i + 2] * d * side;
      const y = lut[i + 1] + lut[i + 3] * d * side;
      c.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      c.style.visibility = x > minX && x < W - 120 && y > 70 && y < maxY ? "" : "hidden";
    }
  }

  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  let canvasTop = 0;
  let canvasLeft = 0;
  section.addEventListener(
    "pointermove",
    (e) => {
      pointer.tx = e.clientX - canvasLeft;
      pointer.ty = e.clientY - canvasTop;
    },
    { passive: true }
  );
  section.addEventListener("pointerleave", () => {
    pointer.tx = pointer.ty = -9999;
  });

  function draw(time: number, dt: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // pointer smoothing that's the same at 60hz and 120hz
    const follow = 1 - Math.exp(-dt * 12);
    // jump straight to the cursor when it enters or leaves, glide while it moves
    if (pointer.tx < -9000 || pointer.x < -9000) {
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
    } else {
      pointer.x += (pointer.tx - pointer.x) * follow;
      pointer.y += (pointer.ty - pointer.y) * follow;
    }
    const shift = -tokens.scrollShift * Math.min(1, Math.max(0, scrollY / sectionH));
    const R = tokens.pointerRadius;
    const R2 = R * R;
    const cell = CELL * dpr;
    const half = band * 0.5;
    const fadeY0 = H * 0.86;
    const fadeY1 = H * 0.18;
    let tinted = 0;

    for (let i = 0; i < n; i++) {
      // where along the band this particle is now
      let s = s0[i] + (vel[i] * time) / length;
      s -= Math.floor(s);
      const f = s * LUT_N;
      const k = Math.floor(f);
      const fr = f - k;
      const a = k * 4;
      const b = a + 4;
      const x0 = lut[a] + (lut[b] - lut[a]) * fr;
      const y0 = lut[a + 1] + (lut[b + 1] - lut[a + 1]) * fr;
      const nx = lut[a + 2] + (lut[b + 2] - lut[a + 2]) * fr;
      const ny = lut[a + 3] + (lut[b + 3] - lut[a + 3]) * fr;
      const o = off[i] * half + Math.sin(time * 0.8 + seed[i]) * 4;
      let x = x0 + nx * o;
      let y = y0 + ny * o + shift;

      let boost = 0;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const dist = Math.sqrt(d2) || 1;
        const p = (1 - dist / R) ** 2;
        x += (dx / dist) * p * tokens.pointerForce;
        y += (dy / dist) * p * tokens.pointerForce;
        boost = p * 0.6;
      }

      // fade at the band's ends, feather its edges, and clear the row of names at the bottom
      const ends = Math.min(1, s * 8, (1 - s) * 8);
      const edge = 1 - smooth((Math.abs(off[i]) - 0.55) / 0.6) * 0.65;
      const bottom = Math.max(0, Math.min(1, (fadeY0 - y) / fadeY1));
      const al = Math.min(1, (alpha[i] + boost) * ends * edge * bottom);
      if (al <= 0.01) continue;
      if (tint[i] >= 0) {
        tinted++;
        continue;
      }
      ctx.globalAlpha = al;
      const sz = CELL * size[i];
      ctx.drawImage(atlas, glyph[i] * cell, 0, cell, cell, x - sz / 2, y - sz / 2, sz, sz);
    }

    // the few colored packets, batched by color so fillStyle changes once per color
    if (tinted) {
      for (let c = 0; c < tints.length; c++) {
        ctx.fillStyle = tints[c];
        for (let i = 0; i < n; i++) {
          if (tint[i] !== c) continue;
          let s = s0[i] + (vel[i] * time) / length;
          s -= Math.floor(s);
          const f = s * LUT_N;
          const k = Math.floor(f);
          const fr = f - k;
          const a = k * 4;
          const b = a + 4;
          const o = off[i] * half + Math.sin(time * 0.8 + seed[i]) * 4;
          const x = lut[a] + (lut[b] - lut[a]) * fr + (lut[a + 2] + (lut[b + 2] - lut[a + 2]) * fr) * o;
          const y = lut[a + 1] + (lut[b + 1] - lut[a + 1]) * fr + (lut[a + 3] + (lut[b + 3] - lut[a + 3]) * fr) * o + shift;
          ctx.globalAlpha = Math.min(1, s * 8, (1 - s) * 8) * Math.max(0, Math.min(1, (fadeY0 - y) / fadeY1));
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  const measure = () => {
    const r = canvas.getBoundingClientRect();
    canvasTop = r.top;
    canvasLeft = r.left;
  };
  addEventListener("scroll", measure, { passive: true });

  layout();
  measure();
  draw(0, 0);
  host.classList.add("is-ready");
  new ResizeObserver(() => {
    layout();
    measure();
    if (reducedMotion) draw(0, 0);
  }).observe(canvas);
  document.fonts?.ready.then(() => {
    buildAtlas();
    if (reducedMotion) draw(0, 0);
  });
  if (reducedMotion) return;

  // elapsed time with each step clamped, so a stalled frame or a resumed tab never makes the stream jump
  let time = 0;
  let raf = 0;
  let last = 0;
  let visible = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    time += dt;
    draw(time, dt);
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
