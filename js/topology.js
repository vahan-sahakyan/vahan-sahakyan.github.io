// topology.js - interactive architecture graphs for the projects section
// each .topo[data-topo] picks its graph from GRAPHS; d3 modules load from the cdn only when one scrolls into view

const D3_FORCE = "https://cdn.jsdelivr.net/npm/d3-force@3.0.0/+esm";
const D3_SELECTION = "https://cdn.jsdelivr.net/npm/d3-selection@3.0.0/+esm";
const MAX_TICKS = 300;

// col: layer from client side (0) to storage (last)
const DSN_NODES = [
  { id: "gateway", label: "Gateway", group: "edge", col: 0, name: "Gateway", runtime: "Go / Fiber / gRPC clients", data: "Stateless; proxies /images to MinIO", pattern: "HTTP/JSON -> gRPC, JWTs verified at the edge, 5s deadlines" },
  { id: "keycloak", label: "Keycloak", group: "infra", col: 0, name: "Keycloak", runtime: "OIDC identity provider", data: "Realm with PKCE login", pattern: "Gateway validates tokens against its JWKS" },
  { id: "argocd", label: "Argo CD", group: "infra", col: 0, name: "Argo CD", runtime: "GitOps / Helm / k3s on AWS EC2", data: "Deploy repo: image tag + chart revision per release", pattern: "App of apps; rollback = git revert" },
  { id: "users", label: "Users", group: "service", col: 1, name: "users-service", runtime: "Go / gRPC", data: "PostgreSQL / profiles + follow graph", pattern: "Transactional outbox -> user.created" },
  { id: "posts", label: "Posts", group: "service", col: 1, name: "posts-service", runtime: "Go / gRPC", data: "ScyllaDB / post and event in one LOGGED BATCH", pattern: "Outbox relay -> post.created" },
  { id: "comments", label: "Comments", group: "service", col: 1, name: "comments-service", runtime: "Go / gRPC", data: "PostgreSQL", pattern: "Transactional outbox; rejects writes on unknown posts" },
  { id: "likes", label: "Likes", group: "service", col: 1, name: "likes-service", runtime: "Go / gRPC", data: "PostgreSQL / unique (user_id, entity_id)", pattern: "Idempotent like/unlike; events only on real changes" },
  { id: "media", label: "Media", group: "service", col: 1, name: "media-service", runtime: "Go / gRPC", data: "MinIO / uploads up to 60 MB", pattern: "Client-streaming gRPC uploads" },
  { id: "rebuilder", label: "Rebuilder", group: "service", col: 1, name: "cache-rebuilder-service", runtime: "Go / gRPC", data: "ClickHouse -> Valkey", pattern: "Replays the event store into feeds, built aside and renamed in" },
  { id: "redpanda", label: "Redpanda", group: "stream", col: 2, name: "Redpanda", runtime: "Kafka-compatible broker", data: "post / comment / like / user topics + .dlq", pattern: "At-least-once; 3 retries with backoff, then dead-letter" },
  { id: "obs", label: "Telemetry", group: "infra", col: 2, name: "Observability", runtime: "OpenTelemetry -> Alloy", data: "Tempo / Loki / Prometheus / Grafana", pattern: "Tail sampling; alerts on DLQ, outbox backlog, consumer lag" },
  { id: "feed", label: "Feed", group: "service", col: 3, name: "feed-service", runtime: "Go / gRPC / consumer", data: "Valkey / sorted-set timelines, capped at 100", pattern: "Fanout-on-write, idempotent on redelivery (CQRS read side)" },
  { id: "notify", label: "Notify", group: "service", col: 3, name: "notification-service", runtime: "Go / gRPC / consumer", data: "PostgreSQL", pattern: "Row ids derived from event ids dedupe redelivery" },
  { id: "search", label: "Search", group: "service", col: 3, name: "search-service", runtime: "Go / gRPC / batch consumer", data: "Elasticsearch / one _bulk per batch", pattern: "Posts, users, trending hashtags" },
  { id: "writer", label: "Event writer", group: "service", col: 3, name: "event-writer-service", runtime: "Go / batch consumer", data: "ClickHouse / 500 msgs or 200ms per insert", pattern: "Event store; offsets commit after a durable insert" },
  { id: "scylla", label: "ScyllaDB", group: "store", col: 4, name: "ScyllaDB", runtime: "Wide-column store", data: "Posts", pattern: "LOGGED BATCH for post + outbox row" },
  { id: "pg", label: "PostgreSQL", group: "store", col: 4, name: "PostgreSQL", runtime: "Relational store", data: "A database per service", pattern: "Embedded migrations applied on startup" },
  { id: "minio", label: "MinIO", group: "store", col: 4, name: "MinIO", runtime: "S3-compatible object store", data: "Public-read images bucket", pattern: "Served through the gateway" },
  { id: "valkey", label: "Valkey", group: "store", col: 4, name: "Valkey", runtime: "In-memory cache", data: "Timelines as sorted sets, one hash per post", pattern: "1h TTL; rebuildable from the event store" },
  { id: "clickhouse", label: "ClickHouse", group: "store", col: 4, name: "ClickHouse", runtime: "Columnar event store", data: "feed_events", pattern: "Readers collapse duplicate event ids" },
  { id: "elastic", label: "Elastic", group: "store", col: 4, name: "Elasticsearch", runtime: "Search index", data: "Posts and users", pattern: "Bulk-indexed from the event stream" },
];

const DSN_SERVICES = ["gateway", "users", "posts", "comments", "likes", "media", "rebuilder", "feed", "notify", "search", "writer"];

// kind: req | event | store | infra | telemetry | deploy
const DSN_LINKS = [
  ...["users", "posts", "comments", "likes", "media", "feed", "notify", "search", "rebuilder"].map((t) => ["gateway", t, "req"]),
  ["feed", "users", "req"],
  ["comments", "posts", "req"],
  ["likes", "posts", "req"],
  ["notify", "posts", "req"],
  ["gateway", "keycloak", "infra"],
  ...["posts", "comments", "likes", "users"].map((s) => [s, "redpanda", "event"]),
  ...["feed", "notify", "search", "writer"].map((t) => ["redpanda", t, "event"]),
  ["posts", "scylla", "store"],
  ...["users", "comments", "likes", "notify"].map((s) => [s, "pg", "store"]),
  ["media", "minio", "store"],
  ["gateway", "minio", "store"],
  ["feed", "valkey", "store"],
  ["rebuilder", "valkey", "store"],
  ["rebuilder", "clickhouse", "store"],
  ["writer", "clickhouse", "store"],
  ["search", "elastic", "store"],
  ...DSN_SERVICES.map((s) => [s, "obs", "telemetry"]),
  ...DSN_SERVICES.map((t) => ["argocd", t, "deploy"]),
].map(([source, target, kind]) => ({ source, target, kind }));


const CI_NODES = [
  { id: "browser", label: "Browser", group: "edge", col: 0, name: "Browser", runtime: "React 18 / Redux Toolkit SPA", data: "JWT sent as a Bearer header on every API call", pattern: "Role-based dashboards; live updates over one WebSocket" },
  { id: "k8s", label: "minikube", group: "infra", col: 0, name: "Kubernetes (minikube)", runtime: "kubectl manifests / Docker Compose", data: "Deployments, Services, ConfigMaps, PVCs", pattern: "Same stack runs on Compose or minikube" },
  { id: "ingress", label: "Ingress", group: "edge", col: 1, name: "NGINX Ingress", runtime: "Kubernetes Ingress", data: "Routes /frontend, /backend, /ws", pattern: "Path-based routing with rewrite-target" },
  { id: "frontend", label: "Frontend", group: "service", col: 2, name: "frontend", runtime: "React / Vite / 2 replicas", data: "Static SPA", pattern: "Student and code reviewer dashboards" },
  { id: "backend", label: "Backend", group: "service", col: 2, name: "backend", runtime: "Java / Spring Boot / Spring Security", data: "MySQL via Spring Data JPA", pattern: "JWT filter; student, reviewer, admin roles; 6-state review flow" },
  { id: "ws", label: "WS server", group: "service", col: 2, name: "ws-server", runtime: "Node.js / ws / kafka-node", data: "Stateless", pattern: "Consumes db-changes, pushes each change to open sockets" },
  { id: "kafka", label: "Kafka", group: "stream", col: 3, name: "Kafka", runtime: "Kafka broker", data: "Topic db-changes", pattern: "Backend publishes assignment and comment changes" },
  { id: "zookeeper", label: "ZooKeeper", group: "stream", col: 3, name: "ZooKeeper", runtime: "Kafka coordination", data: "PVC-backed data and logs", pattern: "Broker metadata" },
  { id: "mysql", label: "MySQL", group: "store", col: 3, name: "MySQL 8", runtime: "Relational store", data: "Users, authorities, assignments, comments", pattern: "PVC-backed; backend starts after its health check" },
];

const CI_LINKS = [
  ["browser", "ingress", "req"],
  ["ingress", "frontend", "req"],
  ["ingress", "backend", "req"],
  ["ingress", "ws", "req"],
  ["backend", "mysql", "store"],
  ["backend", "kafka", "event"],
  ["kafka", "ws", "event"],
  ["ws", "browser", "event"],
  ["kafka", "zookeeper", "infra"],
  ...["ingress", "frontend", "backend", "ws", "kafka", "zookeeper", "mysql"].map((t) => ["k8s", t, "deploy"]),
].map(([source, target, kind]) => ({ source, target, kind }));

// filters: edge kinds each filter button shows; telemetry and deploy edges stay out of "all" to keep it readable
const GRAPHS = {
  dsn: {
    nodes: DSN_NODES,
    links: DSN_LINKS,
    filters: {
      all: ["req", "event", "store", "infra"],
      req: ["req", "infra"],
      event: ["event"],
      store: ["store"],
      platform: ["telemetry", "deploy", "infra"],
    },
  },
  "code-inspect": {
    nodes: CI_NODES,
    links: CI_LINKS,
    filters: {
      all: ["req", "event", "store", "infra"],
      req: ["req"],
      event: ["event"],
      store: ["store"],
      platform: ["deploy", "infra"],
    },
  },
};

const R = 9;

function mount(root, graph, { forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide }, { select }) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = root.querySelector(".topo-stage");
  const card = root.querySelector(".topo-card");
  const W = stage.clientWidth;
  // narrow screens stack the layers top to bottom
  const vertical = W < 640;
  const pad = vertical ? 40 : 60;
  const layers = Math.max(...graph.nodes.map((n) => n.col));
  // desktop height follows the busiest layer
  const perLayer = graph.nodes.reduce((acc, n) => ((acc[n.col] = (acc[n.col] || 0) + 1), acc), []);
  const rows = Math.max(...perLayer);
  const H = vertical ? 2 * pad + layers * 160 : Math.min(520, Math.max(340, Math.min(W * 0.54, rows * 80 + 160)));
  const layerPos = (col) => pad + (col * ((vertical ? H : W) - 2 * pad)) / layers;
  const uid = root.dataset.topo;

  const nodes = graph.nodes.map((n, i) => ({ ...n, x: vertical ? W / 2 + (i % 5) * 10 : layerPos(n.col), y: vertical ? layerPos(n.col) : H / 2 + (i % 5) * 10 }));
  const links = graph.links.map((l) => ({ ...l }));

  stage.textContent = "";
  const svg = select(stage)
    .append("svg")
    .attr("class", "topo-svg")
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", root.getAttribute("aria-label"));

  const defs = svg.append("defs");
  for (const kind of new Set(links.map((l) => l.kind))) {
    defs
      .append("marker")
      .attr("id", `topo-arrow-${uid}-${kind}`)
      .attr("class", `topo-arrow topo-arrow-${kind}`)
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M0,0L10,5L0,10z");
  }

  const view = svg.append("g");
  const linkSel = view
    .append("g")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", (d) => `topo-link topo-link-${d.kind}`)
    .attr("marker-end", (d) => `url(#topo-arrow-${uid}-${d.kind})`);

  const nodeSel = view
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", (d) => `topo-node topo-node-${d.group}`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `${d.name}: ${d.runtime}`);
  nodeSel.append("circle").attr("r", R);
  nodeSel
    .append("text")
    .attr("dy", R + 14)
    .attr("text-anchor", "middle")
    .text((d) => d.label);

  const sim = forceSimulation(nodes)
    .force("link", forceLink(links).id((d) => d.id).distance(70).strength((l) => (l.kind === "telemetry" || l.kind === "deploy" ? 0 : 0.04)))
    .force("charge", forceManyBody().strength(-220))
    .force("collide", forceCollide(vertical ? 30 : 34))
    .force("layer", vertical ? forceY((d) => layerPos(d.col)).strength(1) : forceX((d) => layerPos(d.col)).strength(1))
    .force("center", vertical ? forceX(W / 2).strength(0.06) : forceY(H / 2).strength(0.1))
    .stop();

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function render() {
    for (const n of nodes) {
      n.x = clamp(n.x, 38, W - 38);
      n.y = clamp(n.y, 16, H - 32);
    }
    nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    linkSel.attr("d", (d) => {
      const { x: sx, y: sy } = d.source;
      const { x: tx, y: ty } = d.target;
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.hypot(dx, dy) || 1;
      // bend sideways and stop short of the target circle so the arrow stays visible
      const mx = (sx + tx) / 2 - dy * 0.12;
      const my = (sy + ty) / 2 + dx * 0.12;
      const ex = tx - ((tx - mx) / Math.hypot(tx - mx, ty - my)) * (R + 3);
      const ey = ty - ((ty - my) / Math.hypot(tx - mx, ty - my)) * (R + 3);
      return len < 1 ? "" : `M${sx},${sy}Q${mx},${my} ${ex},${ey}`;
    });
  }

  if (reduceMotion) {
    sim.tick(MAX_TICKS);
    render();
  } else {
    let ticks = 0;
    sim.on("tick", () => {
      render();
      if (++ticks >= MAX_TICKS) sim.stop();
    });
    sim.restart();
  }

  // focus: highlight a node with its edges and neighbours
  let filter = "all";
  let pinned = null;
  const defaultCard = card.innerHTML;
  const visible = (l) => graph.filters[filter].includes(l.kind);

  function applyFilter() {
    linkSel.classed("is-hidden", (l) => !visible(l));
  }

  function focus(d) {
    if (!d) {
      svg.classed("has-focus", false);
      nodeSel.classed("is-on", false);
      linkSel.classed("is-on", false).classed("is-hidden", (l) => !visible(l));
      card.innerHTML = defaultCard;
      return;
    }
    const near = new Set([d.id]);
    linkSel.each((l) => {
      if (l.source.id === d.id || l.target.id === d.id) {
        near.add(l.source.id);
        near.add(l.target.id);
      }
    });
    svg.classed("has-focus", true);
    nodeSel.classed("is-on", (n) => near.has(n.id));
    // the focused node's telemetry/deploy edges show even when the filter hides them
    linkSel
      .classed("is-on", (l) => l.source.id === d.id || l.target.id === d.id)
      .classed("is-hidden", (l) => !visible(l) && l.source.id !== d.id && l.target.id !== d.id);
    card.innerHTML = "";
    const title = document.createElement("p");
    title.className = "topo-card-title";
    title.textContent = `${d.name} - ${d.runtime}`;
    card.append(title);
    for (const [k, v] of [
      ["Data", d.data],
      ["Pattern", d.pattern],
    ]) {
      const row = document.createElement("p");
      const b = document.createElement("span");
      b.className = "topo-card-key";
      b.textContent = k;
      row.append(b, v);
      card.append(row);
    }
  }

  nodeSel
    .on("pointerenter", (e, d) => e.pointerType === "mouse" && !pinned && focus(d))
    .on("pointerleave", (e) => e.pointerType === "mouse" && !pinned && focus(null))
    .on("focus", (e, d) => focus(d))
    .on("blur", () => !pinned && focus(null))
    .on("click", (e, d) => {
      e.stopPropagation();
      pinned = pinned === d ? null : d;
      focus(pinned);
    });
  svg.on("click", () => {
    pinned = null;
    focus(null);
  });

  root.querySelectorAll("[data-topo-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.topoFilter;
      root.querySelectorAll("[data-topo-filter]").forEach((b) => b.setAttribute("aria-pressed", b === btn));
      applyFilter();
      if (pinned) focus(pinned);
    });
  });
  applyFilter();

  // pan and zoom: mouse drag pans, ctrl/cmd + wheel or trackpad pinch zooms, two fingers pinch on touch.
  // plain wheel and one-finger swipes stay with the page
  const t = { k: 1, x: 0, y: 0 };
  const applyT = () => view.attr("transform", `translate(${t.x},${t.y}) scale(${t.k})`);
  const zoomAt = (k, px, py) => {
    const nk = clamp(k, 0.5, 3);
    t.x = px - ((px - t.x) * nk) / t.k;
    t.y = py - ((py - t.y) * nk) / t.k;
    t.k = nk;
    applyT();
  };
  const local = (e) => {
    const r = svg.node().getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  svg.on("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomAt(t.k * Math.exp(-e.deltaY * 0.01), ...local(e));
  });

  const pointers = new Map();
  let last = null;
  svg.on("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.target.closest(".topo-node")) return;
    pointers.set(e.pointerId, local(e));
    if (e.pointerType === "mouse" || pointers.size === 2) svg.node().setPointerCapture(e.pointerId);
    last = null;
  });
  svg.on("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, local(e));
    const pts = [...pointers.values()];
    if (e.pointerType === "mouse") {
      const [[x, y]] = pts;
      if (last) {
        t.x += x - last[0];
        t.y += y - last[1];
        applyT();
        svg.classed("is-panning", true);
      }
      last = [x, y];
    } else if (pts.length === 2) {
      const [[ax, ay], [bx, by]] = pts;
      const mid = [(ax + bx) / 2, (ay + by) / 2];
      const dist = Math.hypot(ax - bx, ay - by);
      if (last) {
        t.x += mid[0] - last[0];
        t.y += mid[1] - last[1];
        zoomAt((t.k * dist) / last[2], ...mid);
      }
      last = [...mid, dist];
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    last = null;
    svg.classed("is-panning", false);
  };
  svg.on("pointerup", release).on("pointercancel", release);

  root.querySelector("[data-topo-zoom='in']").addEventListener("click", () => zoomAt(t.k * 1.25, W / 2, H / 2));
  root.querySelector("[data-topo-zoom='out']").addEventListener("click", () => zoomAt(t.k / 1.25, W / 2, H / 2));
  root.querySelector("[data-topo-zoom='reset']").addEventListener("click", () => {
    Object.assign(t, { k: 1, x: 0, y: 0 });
    applyT();
  });

  root.classList.add("is-ready");
}

let d3;
const loadD3 = () => (d3 ??= Promise.all([import(D3_FORCE), import(D3_SELECTION)]));

// each graph loads once near the viewport, then pauses its edge animation while off screen
for (const root of document.querySelectorAll(".topo[data-topo]")) {
  const graph = GRAPHS[root.dataset.topo];
  if (!graph || !("IntersectionObserver" in window)) continue;
  let loaded = false;
  new IntersectionObserver(
    (entries) => {
      const on = entries[0].isIntersecting;
      root.classList.toggle("is-paused", !on);
      if (!on || loaded) return;
      loaded = true;
      loadD3()
        .then(([force, selection]) => mount(root, graph, force, selection))
        .catch(() => root.classList.add("is-failed"));
    },
    { rootMargin: "200px" }
  ).observe(root);
}
