// motion.ts - the motion layer, loaded only when prefers-reduced-motion is off.
// text and block reveals, parallax depth, counters, and the pointer micro-interactions. scrolling stays native,
// so it responds the instant the wheel or finger moves.
// every timing comes from src/motion/tokens.ts

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { duration, ease, stagger, reveal, interaction, parallax, counter, land } from "../motion/tokens";
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
  landings();
  heroCorners();
  footerRise();
  flows();
  if (finePointer) {
    magnetic();
    tilt();
  }

  // fonts change line breaks and section heights
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return {
    gsap,
    ScrollTrigger,
    // triggers made before the story's pin don't know its scroll length; sorting by position fixes that
    refresh: () => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    },
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
      {
        yPercent: 4,
        ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      }
    );
  }
}

// sections land: each starts lower by its overlap with the section above, then rises faster than the page until
// it sits on its landing line. the offset is set by hand and cleared once landed, because any transform left on
// the pinned story's section would break its pin. measurements happen with the offsets cleared
function landings() {
  const items = [...document.querySelectorAll<HTMLElement>(".lands")].map((el) => ({
    el,
    d: 0,
    st: null as ScrollTrigger | null,
  }));
  // as low as it can start while its rounded corners still sit over the section above, not the page behind it
  const depth = (el: HTMLElement) => Math.max(0, (-parseFloat(getComputedStyle(el).marginTop) || 0) - land.radius);
  const apply = (it: (typeof items)[number], p: number) => {
    it.el.style.transform = p < 1 ? `translate3d(0, ${((1 - p) * it.d).toFixed(1)}px, 0)` : "";
    it.el.style.setProperty("--land-r", `${((1 - p) * land.radius).toFixed(1)}px`);
  };
  ScrollTrigger.addEventListener("refreshInit", () => {
    for (const it of items) {
      it.el.style.transform = "";
      it.d = depth(it.el);
    }
  });
  for (const it of items) {
    it.d = depth(it.el);
    it.st = ScrollTrigger.create({
      trigger: it.el,
      // from when its lowered top would enter the viewport, to when its real top reaches the landing point
      start: () => `top+=${it.d} bottom`,
      end: `top ${Math.round(land.end * 100)}%`,
      onUpdate: (self) => apply(it, self.progress),
      onRefresh: (self) => apply(it, self.progress),
    });
    apply(it, it.st.progress);
  }
}

// the hero's rounded bottom corners flatten as the next section comes up under them
function heroCorners() {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return;
  const r = parseFloat(getComputedStyle(hero).borderBottomLeftRadius) || 0;
  gsap.fromTo(
    hero,
    { "--hero-r": `${r}px` },
    {
      "--hero-r": "0px",
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "bottom bottom",
        end: `bottom ${Math.round(land.end * 100)}%`,
        scrub: true,
      },
    }
  );
}

// the footer wordmark rises from behind the panel line, its gradient drifting as it goes. the end is capped at the
// page's max scroll, so it always finishes
function footerRise() {
  const word = document.querySelector<HTMLElement>(".footer-word span");
  const box = word?.parentElement;
  if (!word || !box) return;
  gsap.fromTo(
    word,
    { y: () => box.offsetHeight, backgroundPosition: "100% 0" },
    {
      y: 0,
      backgroundPosition: "0% 0",
      ease: "none",
      scrollTrigger: {
        trigger: box,
        start: "top bottom",
        end: () =>
          Math.min(
            box.getBoundingClientRect().top + scrollY - innerHeight * land.rise,
            ScrollTrigger.maxScroll(window)
          ),
        scrub: true,
        invalidateOnRefresh: true,
      },
    }
  );
}

// the isometric drawing assembles in order: each piece rises in, the dashed arcs draw toward the next one
function flows() {
  for (const svg of document.querySelectorAll<SVGSVGElement>("[data-flow]")) {
    const steps = svg.querySelectorAll("[data-flow-step]");
    const masks = svg.querySelectorAll("[data-flow-mask]");
    const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: startAt, once: true } });
    gsap.set(masks, { attr: { "stroke-dashoffset": 1 } });
    let arcs = 0;
    steps.forEach((step, i) => {
      if (step.querySelector(".flow-arc")) {
        const mask = masks[arcs++];
        tl.to(mask, { attr: { "stroke-dashoffset": 0 }, duration: duration.lg, ease: "inOut" }, "-=0.15");
      } else {
        tl.from(step, { opacity: 0, y: 18, duration: duration.md, ease: "out" }, i ? "-=0.2" : 0);
      }
    });
    tl.from(
      svg.querySelectorAll("[data-flow-label]"),
      { opacity: 0, duration: duration.md, stagger: stagger.item },
      0.2
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
