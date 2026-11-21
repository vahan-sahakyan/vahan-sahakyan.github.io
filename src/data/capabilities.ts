export const lede =
  "Senior backend engineer with 5+ years designing and building distributed systems, from the data model and API design to the Kubernetes clusters they run on.";

// value is animated from 0; suffix is appended as-is
export const stats = [
  { value: 5, suffix: "+", label: "years building backends" },
  { value: 11, suffix: "", label: "Go services in the DSN reference system" },
  { value: 100, suffix: "%", label: "code coverage kept while shipping features" },
  { value: 4, suffix: "", label: "companies shipped for" },
];

export type Capability = {
  id: string;
  area: string;
  // inline html, for the one link
  body: string;
  tools: string[];
  wide?: boolean;
};

export const capabilities: Capability[] = [
  {
    id: "distributed",
    area: "Distributed Systems",
    body: 'Microservices, event-driven patterns (Kafka/Redpanda), CQRS and event sourcing, in production and in an <a href="https://github.com/vahan-sahakyan/distributed-social-network" target="_blank" rel="noopener">open-source POC</a> with 10+ services.',
    tools: ["Microservices", "CQRS", "Event sourcing", "Transactional outbox", "gRPC"],
    wide: true,
  },
  {
    id: "streaming",
    area: "Event Streaming",
    body: "Kafka-compatible brokers with async consumers: idempotent handlers, retries with backoff, dead-letter queues, and alerts on consumer lag.",
    tools: ["Kafka", "Redpanda", "Pub/Sub"],
  },
  {
    id: "cloud",
    area: "Cloud & Kubernetes",
    body: "Multi-tenant prod/staging/dev isolation, GitOps provisioning with ArgoCD and Argo Events, Gateway API.",
    tools: ["Kubernetes", "GCP", "AWS", "ArgoCD", "Argo Events", "Helm"],
  },
  {
    id: "data",
    area: "Data",
    body: "MongoDB at Forbes, PostgreSQL, ScyllaDB for time-series, ClickHouse for event stores. Chosen per workload: relational, document, time-series or analytical.",
    tools: ["MongoDB", "PostgreSQL", "ScyllaDB", "ClickHouse", "Valkey"],
  },
  {
    id: "languages",
    area: "Languages",
    body: "Go for performance-critical services, Node.js/TypeScript for full-stack work, Java/Spring in previous roles. REST and gRPC APIs in production.",
    tools: ["Go", "TypeScript", "Node.js", "Python", "Java"],
  },
  {
    id: "observability",
    area: "Observability",
    body: "Metrics, distributed tracing and structured logging as core requirements. Prometheus, Grafana, Jaeger, Loki.",
    tools: ["Prometheus", "Grafana", "Jaeger", "Loki", "Datadog", "OpenTelemetry"],
  },
  {
    id: "leadership",
    area: "Leadership",
    body: "Own architectural decisions from data model to deployment. Design docs, code review, mentoring.",
    tools: ["Design docs", "Code review", "Mentoring"],
    wide: true,
  },
];

// stack map: category -> [color group, technologies]
export const stack: Record<string, [string, string[]]> = {
  languages: ["service", ["Go", "TypeScript", "Java"]],
  apis: ["edge", ["gRPC", "REST"]],
  streaming: ["stream", ["Kafka", "Redpanda"]],
  data: ["store", ["PostgreSQL", "MongoDB", "ScyllaDB", "ClickHouse", "MySQL", "Valkey", "Elasticsearch"]],
  infra: ["infra", ["Kubernetes", "Docker", "ArgoCD", "Argo Events", "GCP", "AWS"]],
  observability: ["obs", ["Prometheus", "Grafana", "Loki", "OpenTelemetry"]],
};

// from the experience and projects sections
export const stackProjects: Record<string, string[]> = {
  Forbes: ["Go", "TypeScript", "REST", "Kafka", "MongoDB", "PostgreSQL", "Kubernetes", "Docker", "ArgoCD", "Argo Events", "GCP", "Prometheus", "Grafana"],
  DSN: ["Go", "gRPC", "Redpanda", "ScyllaDB", "PostgreSQL", "ClickHouse", "Valkey", "Elasticsearch", "Kubernetes", "ArgoCD", "AWS", "Prometheus", "Grafana", "Loki", "OpenTelemetry"],
  "Code Inspect": ["Java", "Kafka", "MySQL", "Kubernetes", "Docker"],
  "Datafoundry / WMG": ["TypeScript", "Java"],
};
