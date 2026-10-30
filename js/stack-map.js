// stack-map.js - the stack as a radial cluster; a link joins two technologies used in the same project,
// bundled along the category hierarchy. d3 modules load from the cdn when it nears the viewport

const D3_HIERARCHY = "https://cdn.jsdelivr.net/npm/d3-hierarchy@3.1.2/+esm";
const D3_SHAPE = "https://cdn.jsdelivr.net/npm/d3-shape@3.2.0/+esm";
const D3_SELECTION = "https://cdn.jsdelivr.net/npm/d3-selection@3.0.0/+esm";

// category -> [color class, technologies]
const STACK = {
  languages: ["service", ["Go", "TypeScript", "Java"]],
  apis: ["edge", ["gRPC", "REST"]],
  streaming: ["stream", ["Kafka", "Redpanda"]],
  data: ["store", ["PostgreSQL", "MongoDB", "ScyllaDB", "ClickHouse", "MySQL", "Valkey", "Elasticsearch"]],
  infra: ["infra", ["Kubernetes", "Docker", "ArgoCD", "Argo Events", "GCP", "AWS"]],
  observability: ["obs", ["Prometheus", "Grafana", "Loki", "OpenTelemetry"]],
};

// from the experience and projects sections
const PROJECTS = {
  Forbes: ["Go", "TypeScript", "REST", "Kafka", "MongoDB", "PostgreSQL", "Kubernetes", "Docker", "ArgoCD", "Argo Events", "GCP", "Prometheus", "Grafana"],
  DSN: ["Go", "gRPC", "Redpanda", "ScyllaDB", "PostgreSQL", "ClickHouse", "Valkey", "Elasticsearch", "Kubernetes", "ArgoCD", "AWS", "Prometheus", "Grafana", "Loki", "OpenTelemetry"],
  "Code Inspect": ["Java", "Kafka", "MySQL", "Kubernetes", "Docker"],
  "Datafoundry / WMG": ["TypeScript", "Java"],
};

const colorOf = {};
for (const [, [color, techs]] of Object.entries(STACK)) for (const t of techs) colorOf[t] = color;

const pairs = new Map();
for (const [project, techs] of Object.entries(PROJECTS)) {
  for (let i = 0; i < techs.length; i++) {
    for (let j = i + 1; j < techs.length; j++) {
      const [a, b] = [techs[i], techs[j]].sort();
      const key = `${a}|${b}`;
      if (!pairs.has(key)) pairs.set(key, { a, b, projects: new Set() });
      pairs.get(key).projects.add(project);
    }
  }
}

function mount(root, { hierarchy, cluster }, { lineRadial, curveBundle }, { select }) {
  const stage = root.querySelector(".stackmap-stage");
  const caption = root.querySelector(".stackmap-caption");
  const defaultCaption = caption.textContent;
  const svg = select(stage).append("svg").attr("class", "stackmap-svg").attr("role", "img").attr("aria-label", root.getAttribute("aria-label"));
  let project = "all";
  let focus = null;
  let pinned = null;
  let width = 0;

  function render() {
    const W = Math.min(stage.clientWidth, 620);
    if (!W || W === width) return;
    width = W;
    const R = W / 2 - (W < 440 ? 84 : 106);
    svg.attr("viewBox", [-W / 2, -W / 2, W, W]).attr("width", W).attr("height", W);
    svg.selectAll("*").remove();

    const tree = hierarchy({
      children: Object.entries(STACK).map(([name, [, techs]]) => ({ name, children: techs.map((t) => ({ name: t })) })),
    });
    cluster().size([2 * Math.PI, R])(tree);
    const leaf = new Map(tree.leaves().map((d) => [d.data.name, d]));
    const line = lineRadial()
      .curve(curveBundle.beta(0.85))
      .radius((d) => d.y)
      .angle((d) => d.x);

    svg
      .append("g")
      .selectAll("path")
      .data([...pairs.values()])
      .join("path")
      .attr("class", (p) => `stackmap-link stackmap-${colorOf[p.a]}`)
      .attr("d", (p) => line(leaf.get(p.a).path(leaf.get(p.b))));

    const toggle = (name) => {
      pinned = pinned === name ? null : name;
      focus = pinned;
      update();
    };
    const node = svg
      .append("g")
      .selectAll("g")
      .data(tree.leaves())
      .join("g")
      .attr("class", (d) => `stackmap-node stackmap-${colorOf[d.data.name]}`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.data.name)
      .attr("transform", (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`);
    node.append("circle").attr("r", 3.5);
    node
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d) => (d.x < Math.PI ? 10 : -10))
      .attr("text-anchor", (d) => (d.x < Math.PI ? "start" : "end"))
      .attr("transform", (d) => (d.x >= Math.PI ? "rotate(180)" : null))
      .text((d) => d.data.name);
    node
      .on("pointerenter", (e, d) => e.pointerType === "mouse" && !pinned && ((focus = d.data.name), update()))
      .on("pointerleave", (e) => e.pointerType === "mouse" && !pinned && ((focus = null), update()))
      .on("click", (e, d) => {
        e.stopPropagation();
        toggle(d.data.name);
      })
      .on("keydown", (e, d) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        toggle(d.data.name);
      });
    update();
  }

  function update() {
    const inProject = (p) => project === "all" || p.projects.has(project);
    const touches = (p) => p.a === focus || p.b === focus;
    const shown = [...pairs.values()].filter((p) => inProject(p) && (!focus || touches(p)));
    const active = new Set(shown.flatMap((p) => [p.a, p.b]));
    if (focus) active.add(focus);

    svg.classed("has-focus", !!focus);
    svg
      .selectAll(".stackmap-link")
      .classed("is-off", (p) => !inProject(p) || (focus && !touches(p)))
      .classed("is-on", (p) => !!focus && inProject(p) && touches(p));
    if (focus) svg.selectAll(".stackmap-link.is-on").raise();
    svg
      .selectAll(".stackmap-node")
      .classed("is-dim", (d) => !active.has(d.data.name))
      .classed("is-on", (d) => d.data.name === focus);

    if (!focus) {
      caption.textContent = defaultCaption;
      return;
    }
    const usedIn = Object.keys(PROJECTS).filter((p) => PROJECTS[p].includes(focus) && (project === "all" || p === project));
    caption.textContent = usedIn.length ? `${focus}: ${usedIn.join(", ")}` : `${focus}: not used in ${project}`;
  }

  root.querySelectorAll("[data-stackmap-project]").forEach((btn, _, all) => {
    btn.addEventListener("click", () => {
      project = btn.dataset.stackmapProject;
      all.forEach((b) => b.setAttribute("aria-pressed", b === btn));
      update();
    });
  });
  svg.on("click", () => {
    pinned = focus = null;
    update();
  });

  render();
  new ResizeObserver(render).observe(stage);
  root.classList.add("is-ready");
}

for (const root of document.querySelectorAll(".stackmap")) {
  if (!("IntersectionObserver" in window)) continue;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      Promise.all([import(D3_HIERARCHY), import(D3_SHAPE), import(D3_SELECTION)])
        .then((mods) => mount(root, ...mods))
        .catch(() => root.classList.add("is-failed"));
    },
    { rootMargin: "300px" }
  );
  io.observe(root);
}
