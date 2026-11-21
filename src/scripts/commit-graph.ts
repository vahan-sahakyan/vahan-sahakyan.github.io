// commit-graph.ts - draws the experience timeline as git log --graph behind the html rows, and keeps
// the commit for the role in view highlighted. rows carry data-lane (0 employer, 1 client) and data-parents

import { reducedMotion } from "./env";

const LANE_X = [14, 38];
const STEP_MS = 170;
const SVG_NS = "http://www.w3.org/2000/svg";

const el = (tag: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

export default function mountCommitGraph(root: HTMLElement) {
  const list = root.querySelector<HTMLOListElement>(".gitlog-rows")!;
  const svg = root.querySelector<SVGSVGElement>(".gitlog-graph")!;
  const items = [...list.children] as HTMLLIElement[];

  function layout() {
    const top = list.getBoundingClientRect().top;
    const rows = items.map((li, i) => {
      const m = li.querySelector(".gitlog-msg")!.getBoundingClientRect();
      return {
        i,
        lane: Number(li.dataset.lane),
        // first line of the message, even when it wraps
        y: m.top - top + Math.min(m.height, 22) / 2,
        parents: (li.dataset.parents || "").split(",").filter(Boolean).map(Number),
        head: li.hasAttribute("data-head"),
        merge: li.hasAttribute("data-merge"),
        ongoing: li.hasAttribute("data-ongoing"),
      };
    });
    const last = rows.length - 1;
    svg.setAttribute("height", String(list.offsetHeight));
    svg.textContent = "";

    // edges start at the older parent, so the dash animation draws upward
    for (const c of rows) {
      for (const pi of c.parents) {
        const p = rows[pi];
        const [x0, x1] = [LANE_X[p.lane], LANE_X[c.lane]];
        const my = (p.y + c.y) / 2;
        const d = x0 === x1 ? `M${x0},${p.y}V${c.y}` : `M${x0},${p.y}C${x0},${my} ${x1},${my} ${x1},${c.y}`;
        svg.append(el("path", { d, class: `l${Math.max(p.lane, c.lane)}`, pathLength: 1, style: `--d:${(last - pi) * STEP_MS}ms` }));
      }
      // a role that's still running continues to the top
      if (c.ongoing) {
        const x = LANE_X[c.lane];
        svg.append(el("path", { d: `M${x},${c.y}V${rows[0].y - 10}`, class: `l${c.lane} tail`, style: `--d:${(last - c.i) * STEP_MS}ms` }));
      }
    }
    for (const r of rows) {
      const cls = `l${r.lane}${r.merge ? " merge" : ""}${r.head ? " head" : ""}`;
      svg.append(el("circle", { cx: LANE_X[r.lane], cy: r.y, r: r.head ? 6.5 : 5, class: cls, style: `--d:${(last - r.i) * STEP_MS}ms`, "data-i": r.i }));
    }
    highlight(activeRole);
  }

  // the role card nearest the upper third of the viewport marks its latest commit; rows run newest first
  let activeRole: string | null = null;
  function highlight(role: string | null) {
    activeRole = role;
    const latest = items.findIndex((li) => li.dataset.role === role);
    items.forEach((li, i) => {
      const on = i === latest;
      li.classList.toggle("is-active", on);
      svg.querySelector(`circle[data-i="${i}"]`)?.classList.toggle("is-active", on);
    });
    document.querySelectorAll<HTMLElement>(".role").forEach((r) => r.classList.toggle("is-active", r.dataset.role === role));
  }
  const cards = [...document.querySelectorAll<HTMLElement>(".role[data-role]")];
  const seen = new Map<Element, boolean>();
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      const first = cards.find((c) => seen.get(c));
      if (first) highlight(first.dataset.role!);
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  cards.forEach((c) => spy.observe(c));

  layout();
  new ResizeObserver(layout).observe(list);
  document.fonts?.ready.then(layout);
  if (reducedMotion) return;

  // hidden until it scrolls in, then drawn oldest to newest
  root.classList.add("is-armed");
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      requestAnimationFrame(() => root.classList.add("is-drawn"));
    },
    { threshold: 0.3 }
  );
  io.observe(root);
}
