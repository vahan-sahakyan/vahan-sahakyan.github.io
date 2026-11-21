// main.ts - entry. everything heavy is a dynamic import: the motion layer when motion is allowed,
// each diagram when it nears the viewport, and the hero webgl once the page is idle

import { reducedMotion, canRunGl, idle } from "./env";
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

// the story binds right away: in pinned mode its scroll length is part of the page layout
const story = document.querySelector<HTMLElement>("[data-story]");

if (reducedMotion) {
  if (story) import("./story").then((m) => m.default(story, null));
} else {
  import("./motion").then(async ({ initMotion }) => {
    const motion = initMotion();
    if (story) (await import("./story")).default(story, motion);
    motion.refresh();
  });
}

const heroArt = document.querySelector<HTMLElement>("[data-hero-art]");
if (heroArt) {
  const start = () =>
    idle(() => {
      if (canRunGl()) import("./gl/hero-gl").then((m) => m.mountHeroGl(heroArt));
    });
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
}
