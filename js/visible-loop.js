// visible-loop.js - shared canvas helpers: a frame loop that only runs on screen, and dpr-aware sizing

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// calls step(dt, t) at most fps times a second while el is on screen and the tab is visible.
// dt is in seconds and clamped, so a resumed tab doesn't jump the simulation
export function visibleLoop(el, step, { fps = 60 } = {}) {
  const interval = 1000 / fps;
  let raf = 0;
  let last = 0;
  let visible = false;
  const loop = { running: false, t: performance.now() / 1000 };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (last && now - last < interval - 2) return;
    const dt = last ? Math.min(now - last, 100) / 1000 : 0;
    last = now;
    loop.t = now / 1000;
    step(dt, loop.t);
  };
  const sync = () => {
    const on = visible && !document.hidden && !reduceMotion;
    if (on === loop.running) return;
    loop.running = on;
    if (on) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  };

  loop.draw = () => step(0, loop.t);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  }).observe(el);
  document.addEventListener("visibilitychange", sync);
  loop.draw();
  return loop;
}

// keeps the backing store at the css size times dpr (capped at 2); onResize(s) runs after each change
export function fitCanvas(canvas, onResize) {
  const ctx = canvas.getContext("2d");
  const s = { ctx, w: 0, h: 0, dpr: 1 };
  const fit = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === s.w && height === s.h) return;
    s.dpr = Math.min(devicePixelRatio || 1, 2);
    s.w = width;
    s.h = height;
    canvas.width = Math.round(width * s.dpr);
    canvas.height = Math.round(height * s.dpr);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    onResize?.(s);
  };
  fit();
  new ResizeObserver(fit).observe(canvas);
  return s;
}

// light.css switches on prefers-color-scheme, so css colors are re-read when it flips
export function onSchemeChange(fn) {
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", fn);
}
