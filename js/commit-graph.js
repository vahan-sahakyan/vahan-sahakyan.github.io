// commit-graph.js - draws the experience timeline as git log --graph behind the html rows.
// rows carry data-lane (0 employer, 1 client) and data-parents (row indexes); the svg is measured from them

const LANE_X = [14, 40];
const STEP_MS = 170;
const SVG_NS = "http://www.w3.org/2000/svg";

function mount(root) {
  const list = root.querySelector(".gitlog-rows");
  const svg = root.querySelector(".gitlog-graph");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = (tag, attrs) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function layout() {
    const top = list.getBoundingClientRect().top;
    const rows = [...list.children].map((li, i) => {
      const m = li.querySelector(".gitlog-msg").getBoundingClientRect();
      return {
        i,
        lane: +li.dataset.lane,
        // first line of the message, even when it wraps
        y: m.top - top + Math.min(m.height, 24) / 2,
        parents: (li.dataset.parents || "").split(",").filter(Boolean).map(Number),
        head: li.hasAttribute("data-head"),
        merge: li.hasAttribute("data-merge"),
        ongoing: li.hasAttribute("data-ongoing"),
      };
    });
    const last = rows.length - 1;
    svg.setAttribute("height", list.offsetHeight);
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
      svg.append(el("circle", { cx: LANE_X[r.lane], cy: r.y, r: r.head ? 6.5 : 5, class: cls, style: `--d:${(last - r.i) * STEP_MS}ms` }));
    }
  }

  layout();
  new ResizeObserver(layout).observe(list);
  if (reduceMotion || !("IntersectionObserver" in window)) return;

  // hidden while below the fold, drawn oldest to newest once it scrolls in
  root.classList.add("is-armed");
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      requestAnimationFrame(() => root.classList.add("is-drawn"));
    },
    { threshold: 0.35 }
  );
  io.observe(root);
}

document.querySelectorAll(".gitlog").forEach(mount);
