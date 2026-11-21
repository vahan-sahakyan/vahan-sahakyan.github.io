// topology.ts - interaction for the pre-rendered topology svgs: focus a node to trace its edges,
// filter edge kinds, pan and zoom. layout happens at build time, so there is no d3 here

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function mountTopology(root: HTMLElement) {
  // edge kinds per filter come from the buttons, so the data lives only in src/data/topology.ts
  const filters = Object.fromEntries(
    [...root.querySelectorAll<HTMLElement>("[data-topo-filter]")].map((b) => [b.dataset.topoFilter!, b.dataset.kinds!.split(",")])
  );
  const details: Record<string, { name: string; runtime: string; data: string; pattern: string }> = JSON.parse(
    root.querySelector("[data-topo-nodes]")!.textContent!
  );
  const card = root.querySelector<HTMLElement>(".topo-card")!;
  const defaultCard = card.innerHTML;
  const svgs = [...root.querySelectorAll<SVGSVGElement>(".topo-svg")];
  let filter = "all";
  let pinned: string | null = null;

  const links = (svg: SVGSVGElement) => [...svg.querySelectorAll<SVGPathElement>(".topo-link")];
  const nodes = (svg: SVGSVGElement) => [...svg.querySelectorAll<SVGGElement>(".topo-node")];
  const visible = (l: SVGPathElement) => filters[filter].includes(l.dataset.kind!);

  function applyFilter() {
    for (const svg of svgs) {
      for (const l of links(svg)) {
        l.classList.toggle("is-hidden", !visible(l));
        l.classList.toggle("is-shown", visible(l));
      }
    }
  }

  function showCard(id: string | null) {
    if (!id) {
      card.innerHTML = defaultCard;
      return;
    }
    const { name, runtime, data, pattern } = details[id];
    card.textContent = "";
    const title = document.createElement("p");
    title.className = "topo-card-title";
    title.textContent = `${name} - ${runtime}`;
    card.append(title);
    for (const [k, v] of [
      ["Data", data],
      ["Pattern", pattern],
    ]) {
      const row = document.createElement("p");
      const key = document.createElement("span");
      key.className = "topo-card-key";
      key.textContent = k;
      row.append(key, v ?? "");
      card.append(row);
    }
  }

  // highlights a node with its edges and neighbours in every layout variant
  function focus(id: string | null) {
    for (const svg of svgs) {
      svg.classList.toggle("has-focus", !!id);
      const near = new Set(id ? [id] : []);
      for (const l of links(svg)) {
        const touches = !!id && (l.dataset.s === id || l.dataset.t === id);
        if (touches) near.add(l.dataset.s!).add(l.dataset.t!);
        l.classList.toggle("is-on", touches);
        // the focused node's telemetry and deploy edges show even when the filter hides them
        l.classList.toggle("is-hidden", !visible(l) && !touches);
      }
      for (const nd of nodes(svg)) nd.classList.toggle("is-on", near.has(nd.dataset.id!));
    }
    showCard(id);
  }

  for (const svg of svgs) {
    for (const nd of nodes(svg)) {
      const id = nd.dataset.id!;
      nd.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && !pinned && focus(id));
      nd.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && !pinned && focus(null));
      nd.addEventListener("focus", () => focus(id));
      nd.addEventListener("blur", () => !pinned && focus(null));
      const toggle = (e: Event) => {
        e.stopPropagation();
        pinned = pinned === id ? null : id;
        focus(pinned);
      };
      nd.addEventListener("click", toggle);
      nd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(e);
        }
      });
    }
    svg.addEventListener("click", () => {
      pinned = null;
      focus(null);
    });
    panZoom(svg, root);
  }

  root.querySelectorAll<HTMLButtonElement>("[data-topo-filter]").forEach((btn, _, all) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.topoFilter!;
      all.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      applyFilter();
      if (pinned) focus(pinned);
    });
  });
  applyFilter();

  // event-edge dashes only animate while the graph is on screen
  new IntersectionObserver(([e]) => root.classList.toggle("is-paused", !e.isIntersecting)).observe(root);
  root.classList.add("is-ready");
}

// mouse drag pans, ctrl/cmd + wheel or trackpad pinch zooms, two fingers pinch on touch.
// plain wheel and one-finger swipes stay with the page. the buttons drive whichever variant is showing
function panZoom(svg: SVGSVGElement, root: HTMLElement) {
  const view = svg.querySelector<SVGGElement>("[data-view]")!;
  const [, , W, H] = svg.getAttribute("viewBox")!.split(" ").map(Number);
  const t = { k: 1, x: 0, y: 0 };
  const apply = () => view.setAttribute("transform", `translate(${t.x},${t.y}) scale(${t.k})`);
  const zoomAt = (k: number, px: number, py: number) => {
    const nk = clamp(k, 0.5, 3);
    t.x = px - ((px - t.x) * nk) / t.k;
    t.y = py - ((py - t.y) * nk) / t.k;
    t.k = nk;
    apply();
  };
  // pointer position in viewBox units
  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };

  svg.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(t.k * Math.exp(-e.deltaY * 0.01), ...local(e));
    },
    { passive: false }
  );

  const pointers = new Map<number, [number, number]>();
  let last: number[] | null = null;
  svg.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && (e.target as Element).closest(".topo-node")) return;
    pointers.set(e.pointerId, local(e));
    if (e.pointerType === "mouse" || pointers.size === 2) svg.setPointerCapture(e.pointerId);
    last = null;
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, local(e));
    const pts = [...pointers.values()];
    if (e.pointerType === "mouse") {
      const [[x, y]] = pts;
      if (last) {
        t.x += x - last[0];
        t.y += y - last[1];
        apply();
        svg.classList.add("is-panning");
      }
      last = [x, y];
    } else if (pts.length === 2) {
      const [[ax, ay], [bx, by]] = pts;
      const mid: [number, number] = [(ax + bx) / 2, (ay + by) / 2];
      const dist = Math.hypot(ax - bx, ay - by);
      if (last) {
        t.x += mid[0] - last[0];
        t.y += mid[1] - last[1];
        zoomAt((t.k * dist) / last[2], ...mid);
      }
      last = [...mid, dist];
    }
  });
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    last = null;
    svg.classList.remove("is-panning");
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  const shown = () => svg.getClientRects().length > 0;
  root.querySelector("[data-topo-zoom='in']")!.addEventListener("click", () => shown() && zoomAt(t.k * 1.25, W / 2, H / 2));
  root.querySelector("[data-topo-zoom='out']")!.addEventListener("click", () => shown() && zoomAt(t.k / 1.25, W / 2, H / 2));
  root.querySelector("[data-topo-zoom='reset']")!.addEventListener("click", () => {
    if (!shown()) return;
    Object.assign(t, { k: 1, x: 0, y: 0 });
    apply();
  });
}
