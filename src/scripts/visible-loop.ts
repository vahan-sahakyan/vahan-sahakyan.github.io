// visible-loop.ts - shared canvas helpers: a frame loop that only runs on screen, and dpr-aware sizing

import { reducedMotion } from "./env";

export type Loop = { running: boolean; t: number; draw: () => void };

// calls step(dt, t) while el is on screen and the tab is visible. dt is in seconds and clamped,
// so a resumed tab doesn't jump the simulation
export function visibleLoop(el: Element, step: (dt: number, t: number) => void): Loop {
  let raf = 0;
  let last = 0;
  let visible = false;
  const loop: Loop = { running: false, t: performance.now() / 1000, draw: () => step(0, loop.t) };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 100) / 1000 : 0;
    last = now;
    loop.t = now / 1000;
    step(dt, loop.t);
  };
  const sync = () => {
    const on = visible && !document.hidden && !reducedMotion;
    if (on === loop.running) return;
    loop.running = on;
    if (on) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  }).observe(el);
  document.addEventListener("visibilitychange", sync);
  loop.draw();
  return loop;
}

export type Fit = { ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number };

// keeps the backing store at the css size times dpr (capped at 2); onResize runs after each change
export function fitCanvas(canvas: HTMLCanvasElement, onResize?: (s: Fit) => void): Fit {
  const ctx = canvas.getContext("2d")!;
  const s: Fit = { ctx, w: 0, h: 0, dpr: 1 };
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
