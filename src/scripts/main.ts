// main.ts - entry. everything heavy is a dynamic import: the motion layer when motion is allowed,
// each diagram when it nears the viewport, and the hero stream once the page is idle

import { reducedMotion, idle } from "./env";
import { initNav } from "./nav";
import { initDurations } from "./durations";

declare global {
  interface Window {
    __motionReady?: boolean;
  }
}
window.__motionReady = true;

initNav();
initDurations();

// mounts a module once its element is within margin of the viewport
function whenNear<T extends Element>(selector: string, load: () => Promise<{ default: (el: T) => void }>, margin = "400px") {
  for (const el of document.querySelectorAll<T>(selector)) {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        load()
          .then((m) => m.default(el))
          .catch((err) => console.error(err));
      },
      { rootMargin: margin }
    );
    io.observe(el);
  }
}

whenNear("[data-topo]", () => import("./topology"));
whenNear("[data-evlog]", () => import("./event-log"));
whenNear("[data-stackmap]", () => import("./stack-map"));
whenNear("[data-gitlog]", () => import("./commit-graph"), "300px");

// scroll position is restored by hand: the browser would restore it before the pinned story adds its scroll
// length, landing somewhere else. it's saved on leave and put back once the layout is final; a first visit to a
// #section link goes to that section at the same point
history.scrollRestoration = "manual";
addEventListener("pagehide", () => {
  try {
    sessionStorage.setItem("scroll", String(Math.round(scrollY)));
  } catch {}
});
function restoreScroll() {
  let saved: string | null = null;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload" || nav?.type === "back_forward") saved = sessionStorage.getItem("scroll");
    sessionStorage.removeItem("scroll");
  } catch {}
  if (saved !== null) scrollTo({ top: Number(saved), behavior: "instant" });
  else if (location.hash.length > 1) {
    // offset for the nav by hand, and leave out a landing section's slide-down, which clears once it's in place
    const el = document.getElementById(location.hash.slice(1));
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (el) {
      const shift = new DOMMatrix(getComputedStyle(el).transform).m42;
      scrollTo({ top: el.getBoundingClientRect().top - shift + scrollY - pad, behavior: "instant" });
    }
  }
}

// the story binds right away: in pinned mode its scroll length is part of the page layout
const story = document.querySelector<HTMLElement>("[data-story]");

if (reducedMotion) {
  if (story) import("./story").then((m) => m.default(story, null)).then(restoreScroll);
  else restoreScroll();
} else {
  import("./motion").then(async ({ initMotion }) => {
    const motion = initMotion();
    if (story) (await import("./story")).default(story, motion);
    motion.refresh();
    restoreScroll();
  });
}

const stream = document.querySelector<HTMLElement>("[data-stream]");
if (stream) {
  // after load, so the first paint and the headline never wait on it
  const start = () => idle(() => import("./hero-stream").then((m) => m.mountHeroStream(stream)), 600);
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
}
