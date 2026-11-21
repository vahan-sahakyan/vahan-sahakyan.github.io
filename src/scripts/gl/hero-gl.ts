// hero-gl.ts - runs the hero shape live: morphs over time, leans toward the cursor, turns as the hero scrolls away.
// renders only while on screen, drops resolution if frames run long, and fades in over the static fallback

import { createShape, PRESETS } from "./shape";
import { heroGl } from "../../motion/tokens";

export function mountHeroGl(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const section = host.closest<HTMLElement>("[data-hero]")!;
  let shape: ReturnType<typeof createShape>;
  try {
    shape = createShape(canvas, PRESETS.hero, { maxDpr: heroGl.maxDpr });
  } catch {
    return;
  }
  if (!shape) return;

  const target = [0, 0];
  const pointer: [number, number] = [0, 0];
  const state = {
    time: 0,
    pointer,
    scroll: 0,
    morph: heroGl.morphSpeed,
    spin: heroGl.scrollSpin,
    tilt: heroGl.pointerTilt,
    bulge: heroGl.pointerBulge,
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      target[0] = (e.clientX / innerWidth) * 2 - 1;
      target[1] = -((e.clientY / innerHeight) * 2 - 1);
    },
    { passive: true }
  );

  let visible = false;
  let raf = 0;
  let last = 0;
  let slow = 0;
  let shown = false;
  const t0 = performance.now();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? now - last : 16;
    last = now;
    // 30 long frames in a row: step the resolution down once
    slow = dt > 24 ? slow + 1 : 0;
    if (slow > 30 && shape!.dpr > 1) {
      shape!.setDpr(1);
      slow = 0;
    }
    pointer[0] += (target[0] - pointer[0]) * heroGl.pointerFollow;
    pointer[1] += (target[1] - pointer[1]) * heroGl.pointerFollow;
    state.time = (now - t0) / 1000;
    state.scroll = Math.min(1, Math.max(0, scrollY / (section.offsetHeight || 1)));
    shape!.render(state);
    if (!shown) {
      shown = true;
      host.classList.add("is-live");
    }
  };

  const sync = () => {
    const on = visible && !document.hidden;
    cancelAnimationFrame(raf);
    last = 0;
    if (on) raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  }).observe(host);
  document.addEventListener("visibilitychange", sync);
  new ResizeObserver(() => shape!.resize()).observe(canvas);
}
