// service topologies for the case studies; laid out at build time by src/lib/topology-layout.ts

export type TopoNode = {
  id: string;
  label: string;
  group: "edge" | "service" | "stream" | "store" | "infra";
  // layer from client side (0) to storage (last)
  col: number;
  name: string;
  runtime: string;
  data: string;
  pattern: string;
};
export type LinkKind = "req" | "event" | "store" | "infra" | "telemetry" | "deploy";
export type TopoLink = { source: string; target: string; kind: LinkKind };
export type Graph = {
  nodes: TopoNode[];
  links: TopoLink[];
  // edge kinds each filter shows; telemetry and deploy stay out of "all" to keep it readable
  filters: Record<string, { label: string; kinds: LinkKind[] }>;
};

const DSN_NODES: TopoNode[] = [
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

const DSN_LINKS: TopoLink[] = (
  [
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
  ] as [string, string, LinkKind][]
).map(([source, target, kind]) => ({ source, target, kind }));

const CI_NODES: TopoNode[] = [
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

const CI_LINKS: TopoLink[] = (
  [
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
  ] as [string, string, LinkKind][]
).map(([source, target, kind]) => ({ source, target, kind }));

export const graphs: Record<"dsn" | "code-inspect", Graph> = {
  dsn: {
    nodes: DSN_NODES,
    links: DSN_LINKS,
    filters: {
      all: { label: "All", kinds: ["req", "event", "store", "infra"] },
      req: { label: "Requests", kinds: ["req", "infra"] },
      event: { label: "Event Stream", kinds: ["event"] },
      store: { label: "Data Flow", kinds: ["store"] },
      platform: { label: "Observability", kinds: ["telemetry", "deploy", "infra"] },
    },
  },
  "code-inspect": {
    nodes: CI_NODES,
    links: CI_LINKS,
    filters: {
      all: { label: "All", kinds: ["req", "event", "store", "infra"] },
      req: { label: "Requests", kinds: ["req"] },
      event: { label: "Event Stream", kinds: ["event"] },
      store: { label: "Data Flow", kinds: ["store"] },
      platform: { label: "Platform", kinds: ["deploy", "infra"] },
    },
  },
};

export const legend: [TopoNode["group"], string][] = [
  ["edge", "Edge"],
  ["service", "Service"],
  ["stream", "Streaming"],
  ["store", "Data store"],
  ["infra", "Platform"],
];
