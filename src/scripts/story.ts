// story.ts - the approach section. one step is current at a time and lights its path through the diagram.
// desktop with motion: the section pins and scroll scrubs through the steps, with packets running the lit edges.
// phones: steps are swipeable cards. reduced motion on desktop: a list driven by click and focus

import type { Motion } from "./motion";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { story as tokens, duration } from "../motion/tokens";

const SVG_NS = "http://www.w3.org/2000/svg";

export default function mountStory(root: HTMLElement, motion: Motion | null) {
  const pinEl = root.querySelector<HTMLElement>("[data-story-pin]")!;
  const list = root.querySelector<HTMLElement>("[data-story-steps]")!;
  const steps = [...list.querySelectorAll<HTMLElement>(".story-step")];
  const svgs = [...root.querySelectorAll<SVGSVGElement>(".story-svg")];
  const count = root.querySelector<HTMLElement>("[data-story-count]");
  const bar = root.querySelector<HTMLElement>("[data-story-progress]");
  const mobile = matchMedia("(max-width: 960px)");
  const n = steps.length;

  let current = -1;
  let pinned = false;
  let packets: { kill: () => void }[] = [];

  function runPackets(i: number) {
    packets.forEach((p) => p.kill());
    packets = [];
    if (!motion) return;
    const { gsap } = motion;
    const edges = steps[i].dataset.edges!.split(",");
    for (const svg of svgs) {
      if (!svg.getClientRects().length) continue;
      const layer = svg.querySelector("[data-packets]")!;
      edges.forEach((id, k) => {
        const path = svg.querySelector<SVGPathElement>(`[data-edge="${id}"]`);
        if (!path) return;
        const len = path.getTotalLength();
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("r", "4");
        dot.setAttribute("class", path.getAttribute("class")!.replace("sedge", "spacket"));
        layer.append(dot);
        const s = { t: 0 };
        const tw = gsap.to(s, {
          t: 1,
          duration: tokens.packetDuration,
          ease: "inOut",
          repeat: -1,
          repeatDelay: 0.35,
          // edges of one step play in sequence when they chain, together when they fan out
          delay: i === 3 ? k * 0.08 : k * tokens.packetDuration * 0.55,
          onUpdate: () => {
            const p = path.getPointAtLength(s.t * len);
            dot.setAttribute("cx", String(p.x));
            dot.setAttribute("cy", String(p.y));
            dot.setAttribute("opacity", String(Math.min(1, Math.sin(s.t * Math.PI) * 3)));
          },
        });
        packets.push({ kill: () => (tw.kill(), dot.remove()) });
      });
    }
  }

  function setStep(i: number) {
    if (i === current) return;
    const prev = current;
    current = i;
    steps.forEach((s, j) => {
      s.classList.toggle("is-active", j === i);
      s.querySelector("button")!.setAttribute("aria-pressed", String(j === i));
    });
    if (count) count.textContent = String(i + 1).padStart(2, "0");
    const nodes = new Set(steps[i].dataset.nodes!.split(","));
    const edges = new Set(steps[i].dataset.edges!.split(","));
    for (const svg of svgs) {
      svg.querySelectorAll<SVGElement>("[data-node]").forEach((el) => el.classList.toggle("is-on", nodes.has(el.dataset.node!)));
      svg.querySelectorAll<SVGElement>("[data-edge]").forEach((el) => el.classList.toggle("is-on", edges.has(el.dataset.edge!)));
    }
    if (pinned && motion && prev !== -1) {
      const dir = i > prev ? 1 : -1;
      motion.gsap.fromTo(steps[i], { y: 18 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: duration.md, ease: "out", overwrite: true });
    }
    runPackets(i);
  }

  pinEl.classList.add("is-live");
  setStep(0);

  // phones: the card snapped into view is the current step
  const io = new IntersectionObserver(
    (entries) => {
      if (!mobile.matches) return;
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit) setStep(steps.indexOf(hit.target as HTMLElement));
    },
    { root: list, threshold: [0.6, 0.9] }
  );
  steps.forEach((s) => io.observe(s));

  let trigger: ScrollTrigger | null = null;
  steps.forEach((s, i) => {
    const btn = s.querySelector("button")!;
    btn.addEventListener("click", () => {
      if (mobile.matches) {
        list.scrollTo({ left: s.offsetLeft - list.offsetLeft - parseFloat(getComputedStyle(list).paddingLeft), behavior: motion ? "smooth" : "auto" });
      }
      setStep(i);
    });
    btn.addEventListener("focus", () => !mobile.matches && !pinned && setStep(i));
    s.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && !pinned && !mobile.matches && setStep(i));
  });

  if (!motion) return;

  motion.gsap.matchMedia().add("(min-width: 961px)", () => {
    pinned = true;
    pinEl.classList.add("is-pinned");
    trigger = motion.ScrollTrigger.create({
      trigger: pinEl,
      pin: true,
      start: "center center",
      end: () => `+=${n * tokens.stepLength * innerHeight}`,
      scrub: true,
      onUpdate: (self) => {
        setStep(Math.min(n - 1, Math.floor(self.progress * n)));
        if (bar) bar.style.transform = `scaleX(${self.progress})`;
      },
    });
    return () => {
      pinned = false;
      trigger?.kill();
      trigger = null;
      pinEl.classList.remove("is-pinned");
      steps.forEach((s) => motion.gsap.set(s, { clearProps: "transform,opacity" }));
    };
  });

  // pause the packets while the section is off screen
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) runPackets(current);
    else packets.forEach((p) => p.kill());
  }).observe(root);
}
