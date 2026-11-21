// stack-map.ts - interaction for the pre-rendered stack map: focus a technology to see what it ships with,
// filter by project

export default function mountStackMap(root: HTMLElement) {
  const caption = root.querySelector<HTMLElement>(".stackmap-caption")!;
  const usage: Record<string, string[]> = JSON.parse(root.querySelector("[data-stackmap-usage]")!.textContent!);
  const svgs = [...root.querySelectorAll<SVGSVGElement>(".stackmap-svg")];
  let project = "all";
  let focus: string | null = null;
  let pinned: string | null = null;

  function update() {
    for (const svg of svgs) {
      const active = new Set<string>();
      svg.querySelectorAll<SVGPathElement>(".stackmap-link").forEach((l) => {
        const { a, b } = l.dataset;
        const inProject = project === "all" || l.dataset.projects!.split("|").includes(project);
        const touches = a === focus || b === focus;
        const on = inProject && (!focus || touches);
        if (on) active.add(a!).add(b!);
        l.classList.toggle("is-off", !on);
        l.classList.toggle("is-on", !!focus && on);
        if (focus && on) l.parentNode!.append(l);
      });
      if (focus) active.add(focus);
      svg.classList.toggle("has-focus", !!focus);
      svg.querySelectorAll<SVGGElement>(".stackmap-node").forEach((nd) => {
        nd.classList.toggle("is-dim", !active.has(nd.dataset.name!));
        nd.classList.toggle("is-on", nd.dataset.name === focus);
      });
    }
    if (!focus) {
      caption.textContent = caption.dataset.default!;
      return;
    }
    const usedIn = usage[focus].filter((p) => project === "all" || p === project);
    caption.textContent = usedIn.length ? `${focus}: ${usedIn.join(", ")}` : `${focus}: not used in ${project}`;
  }

  const toggle = (name: string) => {
    pinned = pinned === name ? null : name;
    focus = pinned;
    update();
  };
  for (const nd of root.querySelectorAll<SVGGElement>(".stackmap-node")) {
    const name = nd.dataset.name!;
    nd.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || pinned) return;
      focus = name;
      update();
    });
    nd.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse" || pinned) return;
      focus = null;
      update();
    });
    nd.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(name);
    });
    nd.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      toggle(name);
    });
  }
  for (const svg of svgs) {
    svg.addEventListener("click", () => {
      pinned = focus = null;
      update();
    });
  }
  root.querySelectorAll<HTMLButtonElement>("[data-stackmap-project]").forEach((btn, _, all) => {
    btn.addEventListener("click", () => {
      project = btn.dataset.stackmapProject!;
      all.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      update();
    });
  });
  root.classList.add("is-ready");
}
