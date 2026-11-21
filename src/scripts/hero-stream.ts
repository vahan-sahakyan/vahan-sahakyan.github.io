// hero-stream.ts - the hero's data stream: glyphs flowing along an s-curve band, with service chips riding it and
// lighting up in order, like one event moving through the system. scrolling away spreads the glyphs over the
// whole hero and scrolling back gathers them into the band; the cursor brightens glyphs near it.
// every position is a pure function of elapsed time, interpolated along an arc-length table, so motion stays
// smooth at any frame rate. with reduced motion it draws one still frame

import { stream as tokens } from "../motion/tokens";
import { reducedMotion } from "./env";

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789{}[]<>/:=._+*".split("");
const CELL = 16;
// the atlas cell after the glyphs holds a round dot
const DOT = GLYPHS.length;
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
  // position across the ribbon (-1..1), and scatter off it, in half-band units
  let off = new Float32Array(0);
  let sc = new Float32Array(0);
  let alpha = new Float32Array(0);
  let size = new Float32Array(0);
  let seed = new Float32Array(0);
  let glyph = new Uint8Array(0);
  let tint = new Int8Array(0);
  // spread target in 0..1 of the hero, when each particle starts leaving the band and how long it takes
  let hx = new Float32Array(0);
  let hy = new Float32Array(0);
  let lag = new Float32Array(0);
  let ramp = new Float32Array(0);
  // each particle's own wander across the band, jitter along it, and twinkle, so none move in lockstep
  let wa = new Float32Array(0);
  let wf = new Float32Array(0);
  let ja = new Float32Array(0);
  let tf = new Float32Array(0);
  let td = new Float32Array(0);
  // this frame's positions and alphas, reused by the colored-packet pass
  let px = new Float32Array(0);
  let py = new Float32Array(0);
  let pa = new Float32Array(0);

  function buildAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = (GLYPHS.length + 1) * CELL * dpr;
    atlas.height = CELL * dpr;
    const a = atlas.getContext("2d")!;
    a.scale(dpr, dpr);
    a.fillStyle = "#f4f4f2";
    a.font = `400 12px "Geist Mono", ui-monospace, Menlo, monospace`;
    a.textAlign = "center";
    a.textBaseline = "middle";
    GLYPHS.forEach((g, i) => a.fillText(g, i * CELL + CELL / 2, CELL / 2));
    a.beginPath();
    a.arc(DOT * CELL + CELL / 2, CELL / 2, 1.7, 0, Math.PI * 2);
    a.fill();
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
    // desktop: a loose s-curve down the middle, behind the copy
    return [
      { x: 0.56 * W, y: -0.12 * H },
      { x: 0.4 * W, y: 0.34 * H },
      { x: 0.66 * W, y: 0.58 * H },
      { x: 0.5 * W, y: 1.12 * H },
    ];
  }

  function spawn(count: number) {
    n = count;
    s0 = new Float32Array(n);
    vel = new Float32Array(n);
    off = new Float32Array(n);
    sc = new Float32Array(n);
    alpha = new Float32Array(n);
    size = new Float32Array(n);
    seed = new Float32Array(n);
    glyph = new Uint8Array(n);
    tint = new Int8Array(n);
    hx = new Float32Array(n);
    hy = new Float32Array(n);
    lag = new Float32Array(n);
    ramp = new Float32Array(n);
    wa = new Float32Array(n);
    wf = new Float32Array(n);
    ja = new Float32Array(n);
    tf = new Float32Array(n);
    td = new Float32Array(n);
    px = new Float32Array(n);
    py = new Float32Array(n);
    pa = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const stray = Math.random() < 0.1;
      const dot = Math.random() < tokens.dots;
      // about half ride the ribbon's two edges, which read as the helix strands; the rest fill it
      const strand = Math.random() < 0.45;
      s0[i] = Math.random();
      vel[i] = (0.35 + Math.random() * 1.3) * tokens.speed;
      off[i] = strand ? (Math.random() < 0.5 ? -1 : 1) * (0.86 + Math.random() * 0.14) : Math.random() * 2 - 1;
      sc[i] = gauss() * (stray ? 1.5 : 0.12);
      alpha[i] = dot ? 0.35 + Math.random() * 0.65 : stray ? 0.12 + Math.random() * 0.2 : 0.3 + Math.random() * 0.6;
      // dots come in many sizes, mostly small
      size[i] = dot ? 0.3 + Math.random() ** 2 * 0.8 : 0.6 + Math.random() * 0.45;
      seed[i] = Math.random() * 100;
      glyph[i] = dot ? DOT : Math.floor(Math.random() * GLYPHS.length);
      tint[i] = Math.random() < 0.035 ? Math.floor(Math.random() * tints.length) : -1;
      hx[i] = Math.random();
      hy[i] = Math.random();
      // most leave early, a few hold on; lag + ramp stays within 1 so all are out at full spread
      lag[i] = Math.random() ** 1.6 * 0.55;
      ramp[i] = 0.3 + Math.random() * 0.45;
      wa[i] = 1.5 + Math.random() ** 2 * 9;
      wf[i] = 0.3 + Math.random() * 1.4;
      ja[i] = Math.random() * 16;
      tf[i] = 0.5 + Math.random() * 2.5;
      td[i] = Math.random() * 0.6;
    }
  }

  type Box = { left: number; right: number; top: number; bottom: number };
  // the copy's text boxes in canvas coordinates: ranges give the text's width rather than the full-width block,
  // and the untransformed parent gives the height, so the intro animation doesn't skew them
  function textBoxes(selector: string, pad: number): Box[] {
    const origin = canvas.getBoundingClientRect();
    const range = document.createRange();
    return [...section.querySelectorAll<HTMLElement>(selector)].map((el) => {
      range.selectNodeContents(el);
      const h = range.getBoundingClientRect();
      const v = (el.closest(".hl") ?? el).getBoundingClientRect();
      return {
        left: h.left - origin.left - pad,
        right: h.right - origin.left + pad,
        top: v.top - origin.top - pad,
        bottom: v.bottom - origin.top + pad,
      };
    });
  }
  // glyphs passing behind the headline and tagline dim so the copy stays readable
  let dim: Box[] = [];

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
    for (let i = 1; i < raw.length; i++)
      acc.push(acc[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
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

    // chips sit off the band at their own points along it. each tries spots further out, on the side away from
    // the copy first, and takes the first that covers neither the copy nor another chip; with none free it hides
    const maxY = H * 0.8;
    // phones have a thin band in a short strip above the copy, so their chips stay close to it
    const reach = W < 640 ? [0.12, 0.3, 0.5] : [0.45, 0.7, 1, 1.3, 1.6];
    const blockers = textBoxes(".hero-now, .hero-title .hl > span, .hero-tagline, .hero-actions, .hero-motto", 20);
    dim = W < 640 ? [] : textBoxes(".hero-title .hl > span, .hero-tagline", 6);
    for (const c of chips) {
      // the band's ends run under the nav and into the faded bottom on desktop, so chips spread over its middle
      const t = Number(c.dataset.t);
      const i = Math.round((W < 640 ? t : 0.16 + t * 0.62) * LUT_N) * 4;
      const nx = lut[i + 2];
      const ny = lut[i + 3];
      // on desktop, the right side, away from the copy; on phones, the chip's own side
      const first = W < 640 ? Number(c.dataset.side) : 1;
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      let spot: Box | null = null;
      for (const k of reach) {
        for (const side of [first, -first]) {
          const d = (band * k + 18) * side;
          // desktop shifts sideways, level with its point on the band; phones step out along the band's normal
          const x = W < 640 ? lut[i] + nx * d : lut[i] + d - (side < 0 ? w : 0);
          const y = W < 640 ? lut[i + 1] + ny * d : lut[i + 1] - h / 2;
          const box = { left: x, right: x + w, top: y - 10, bottom: y + h };
          const free =
            x > 8 &&
            x + w < W - 8 &&
            y > 70 &&
            y < maxY &&
            !blockers.some((r) => box.left < r.right && box.right > r.left && box.top < r.bottom && box.bottom > r.top);
          if (free) {
            spot = box;
            break;
          }
        }
        if (spot) break;
      }
      if (spot) {
        c.style.transform = `translate(${Math.round(spot.left)}px, ${Math.round(spot.top + 10)}px)`;
        // later chips keep clear of this one
        blockers.push({ left: spot.left - 12, right: spot.right + 12, top: spot.top - 6, bottom: spot.bottom + 6 });
      }
      c.style.visibility = spot ? "" : "hidden";
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

  // 0 = gathered in the band, 1 = spread over the hero; eased toward the scroll position
  let spread = 0;
  let chipFade = 1;
  let first = true;

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
    const target = reducedMotion ? 0 : Math.min(1, Math.max(0, scrollY / (sectionH * tokens.spreadAt)));
    if (first) {
      spread = target;
      first = false;
    } else {
      // gathering is speed-capped, so jumping back to the top still settles in over a moment
      const next = spread + (target - spread) * (1 - Math.exp(-dt * tokens.spreadFollow));
      spread = Math.max(next, spread - dt * tokens.gatherRate);
      if (Math.abs(spread - target) < 0.001) spread = target;
    }

    // chips belong to the band, so they fade as it comes apart
    const fade = Math.round((1 - smooth(spread * 2.5)) * 50) / 50;
    if (fade !== chipFade) {
      chipFade = fade;
      for (const c of chips) c.style.opacity = String(fade);
    }

    const R = tokens.pointerRadius;
    const R2 = R * R;
    const cell = CELL * dpr;
    const half = band * 0.5;
    const fadeY0 = H * 0.86;
    const fadeY1 = H * 0.18;
    let tinted = 0;

    for (let i = 0; i < n; i++) {
      // where along the band this particle is now, nudged back and forth on its own rhythm
      let s = s0[i] + (vel[i] * time + Math.sin(time * wf[i] * 0.7 + seed[i] * 1.7) * ja[i]) / length;
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
      // the ribbon turns around the band's path: edge-on it pinches, face-on it's full width, and the near
      // side draws bigger and brighter than the far side
      // like cloth: the twist runs at an uneven rate, the strip swells and narrows, its center ripples, and its
      // cross-section curls, so the edges bend toward or away from the viewer
      const phi = s * tokens.twists * Math.PI * 2 + time * tokens.spin + 1.4 * Math.sin(s * 5.3 + time * 0.23);
      const swell = 0.7 + 0.35 * Math.sin(s * 7.2 + time * 0.31 + 1.1);
      const ripple = Math.sin(s * 9.4 - time * 0.42) * 0.32 + Math.sin(s * 4.1 + time * 0.19) * 0.22;
      const u = off[i] * swell;
      const bend = tokens.curl * (off[i] * off[i] - 0.4);
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      const depth = Math.max(0, Math.min(1, 0.5 + 0.42 * (u * sin + bend * cos)));
      const o = (u * cos - bend * sin + ripple + sc[i]) * half + Math.sin(time * wf[i] + seed[i]) * wa[i];
      let x = x0 + nx * o;
      let y = y0 + ny * o;

      // each particle leaves on its own schedule and pace, so the band frays instead of moving as one sheet
      const p = spread && smooth((spread - lag[i]) / ramp[i]);
      if (p) {
        const sx = hx[i] * W + Math.sin(time * (0.12 + (seed[i] % 1) * 0.2) + seed[i]) * 34;
        const sy = hy[i] * H + Math.cos(time * (0.1 + (seed[i] % 1) * 0.16) + seed[i] * 1.3) * 34;
        x += (sx - x) * p;
        y += (sy - y) * p;
      }
      // fade at the band's ends, feather its edges, twinkle, and quiet down once out so the copy stays readable
      const ends = Math.min(1, s * 8, (1 - s) * 8);
      const near = 1 - (1 - depth) * 0.65 * (1 - p);
      const twinkle = 1 - td[i] * (0.5 + 0.5 * Math.sin(time * tf[i] + seed[i] * 2.3));
      let fade = ends * near * twinkle * (1 - p * 0.45);
      const scale = 1 + (depth - 0.5) * 0.6 * (1 - p);
      for (let r = 0; r < dim.length; r++) {
        const d = dim[r];
        if (x > d.left && x < d.right && y > d.top && y < d.bottom) {
          fade *= 0.35;
          break;
        }
      }

      let boost = 0;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2) boost = (1 - Math.sqrt(d2) / R) ** 2 * tokens.pointerGlow;

      // clear the row of names at the bottom
      const bottom = Math.max(0, Math.min(1, (fadeY0 - y) / fadeY1));
      const al = Math.min(1, (alpha[i] + boost) * fade * bottom);
      if (al <= 0.01) continue;
      if (tint[i] >= 0) {
        px[i] = x;
        py[i] = y;
        pa[i] = al;
        tinted++;
        continue;
      }
      ctx.globalAlpha = al;
      const sz = CELL * size[i] * scale;
      ctx.drawImage(atlas, glyph[i] * cell, 0, cell, cell, x - sz / 2, y - sz / 2, sz, sz);
    }

    // the few colored packets, batched by color so fillStyle changes once per color
    if (tinted) {
      for (let c = 0; c < tints.length; c++) {
        ctx.fillStyle = tints[c];
        for (let i = 0; i < n; i++) {
          if (tint[i] !== c || pa[i] <= 0.01) continue;
          ctx.globalAlpha = Math.min(1, pa[i] * 1.6);
          ctx.fillRect(px[i] - 1.5, py[i] - 1.5, 3, 3);
          pa[i] = 0;
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
  // the copy settles after its intro animation, so place chips and dim boxes again once it does
  section.addEventListener("animationend", () => layout());
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
    // left upward: the loop pauses fully spread, so coming back gathers from there
    if (!visible && e.boundingClientRect.top < 0) {
      spread = 1;
      chipFade = 0;
      for (const c of chips) c.style.opacity = "0";
    }
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
