// motion.ts - the motion layer, loaded only when prefers-reduced-motion is off.
// text and block reveals, parallax depth, counters, and the pointer micro-interactions. scrolling stays native,
// so it responds the instant the wheel or finger moves.
// every timing comes from src/motion/tokens.ts

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { duration, ease, stagger, reveal, interaction, parallax, counter } from "../motion/tokens";
import { finePointer } from "./env";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
for (const [name, p] of Object.entries(ease)) CustomEase.create(name, p.join(","));

const startAt = `top ${Math.round(reveal.start * 100)}%`;

export type Motion = ReturnType<typeof initMotion>;

export function initMotion() {
  splitReveals();
  blockReveals();
  counters();
  parallaxLayers();
  if (finePointer) {
    magnetic();
    tilt();
  }

  // fonts change line breaks and section heights
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return {
    gsap,
    ScrollTrigger,
    refresh: () => ScrollTrigger.refresh(),
  };
}

// headings and ledes rise in line by line from behind a mask
function splitReveals() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-split]")) {
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      // lines keep words whole, so the text reads normally; "auto" would put aria-label on <p>, which aria prohibits
      aria: "none",
      autoSplit: true,
      onSplit(self: SplitText) {
        el.classList.add("is-split");
        return gsap.from(self.lines, {
          yPercent: 108,
          duration: duration.lg,
          ease: "out",
          stagger: stagger.line,
          scrollTrigger: { trigger: el, start: startAt, once: true },
        });
      },
    } as SplitText.Vars);
  }
}

function blockReveals() {
  const els = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  ScrollTrigger.batch(els, {
    start: startAt,
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: duration.lg,
        ease: "out",
        stagger: stagger.item,
        overwrite: "auto",
      }),
  });
}

function counters() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-count]")) {
    const to = Number(el.dataset.count);
    const n = { v: 0 };
    el.textContent = "0";
    ScrollTrigger.create({
      trigger: el,
      start: startAt,
      once: true,
      onEnter: () =>
        gsap.to(n, {
          v: to,
          duration: counter.duration,
          ease: "out",
          onUpdate: () => (el.textContent = String(Math.round(n.v))),
        }),
    });
  }
}

function parallaxLayers() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-parallax]")) {
    const depth = el.dataset.parallax as keyof typeof parallax;
    const host = el.closest("section") ?? el;
    const first = host.hasAttribute("data-hero");
    gsap.to(el, {
      y: parallax[depth] * (first ? 2.4 : 1),
      ease: "none",
      scrollTrigger: { trigger: host, start: first ? "top top" : "top bottom", end: "bottom top", scrub: true },
    });
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-parallax-inner]")) {
    gsap.fromTo(
      el,
      { yPercent: -4 },
      { yPercent: 4, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } }
    );
  }
}

// buttons lean toward the cursor and spring back
function magnetic() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-magnetic]")) {
    const x = gsap.quickTo(el, "x", { duration: duration.md, ease: "out" });
    const y = gsap.quickTo(el, "y", { duration: duration.md, ease: "out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x(((e.clientX - r.left) / r.width - 0.5) * 2 * interaction.magnet);
      y(((e.clientY - r.top) / r.height - 0.5) * 2 * interaction.magnet);
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: duration.lg, ease: "spring", overwrite: true });
    });
  }
}

// cards tilt toward the cursor; the glow inside follows it
function tilt() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-tilt]")) {
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, "rotationX", { duration: duration.md, ease: "out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: duration.md, ease: "out" });
    const glow = el.querySelector<HTMLElement>(".card-glow");
    const gx = glow && gsap.quickTo(glow, "x", { duration: duration.sm, ease: "out" });
    const gy = glow && gsap.quickTo(glow, "y", { duration: duration.sm, ease: "out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      // big cards tilt less, so the edges don't swing far
      const k = interaction.tilt * Math.min(1, 420 / r.width);
      rx((0.5 - py) * k);
      ry((px - 0.5) * k);
      gx?.(e.clientX - r.left);
      gy?.(e.clientY - r.top);
    });
    el.addEventListener("pointerleave", () => {
      rx(0);
      ry(0);
    });
  }
}
