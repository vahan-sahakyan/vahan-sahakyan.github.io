export type CaseStudy = {
  id: "dsn" | "code-inspect";
  index: string;
  title: string;
  repo: string;
  // extra repo links shown under the title
  links?: { label: string; href: string }[];
  summary: string;
  stack: string[];
  art: "ribbon" | "prism";
  graphTitle: string;
  graphLabel: string;
  problem: string;
  architecture: string;
  result: string[];
  eventLog?: boolean;
};

export const caseStudies: CaseStudy[] = [
  {
    id: "dsn",
    index: "CASE 01",
    title: "Distributed Social Network",
    repo: "https://github.com/vahan-sahakyan/distributed-social-network",
    summary:
      "11 Go services over gRPC and Redpanda, with a transactional outbox, a CQRS feed and a ClickHouse event store. OpenTelemetry, Tempo, Loki and Prometheus for observability; deployed to Kubernetes with Helm and Argo CD.",
    stack: ["Go", "Microservices", "Kafka", "CQRS", "PostgreSQL", "ClickHouse", "Kubernetes"],
    art: "ribbon",
    graphTitle: "11 Go services, one event backbone",
    graphLabel: "Service topology of the distributed social network",
    problem:
      "Posts, comments and likes have to reach feeds, notifications and search without a shared database or distributed transactions, and survive broker redelivery and poison messages.",
    architecture:
      "Each service owns its store. Writes commit the row and an outbox event together; a relay publishes to Redpanda, where feed, notification, search and event-writer consumers fan out independently.",
    result: [
      "No dual writes: an event is published only if its row committed",
      "Idempotent consumers, so redelivery is safe",
      "Poison messages retry 3 times with backoff, then dead-letter",
      "Feeds are a CQRS read model, rebuildable from the event store",
    ],
    eventLog: true,
  },
  {
    id: "code-inspect",
    index: "CASE 02",
    title: "Code Inspect",
    repo: "https://github.com/vahan-sahakyan/ci-composed",
    links: [
      { label: "React Frontend", href: "https://github.com/vahan-sahakyan/code-inspect-frontend" },
      { label: "Spring Boot Backend", href: "https://github.com/vahan-sahakyan/code-inspect-backend" },
    ],
    summary:
      "Code review platform: assignments are submitted as GitHub branches and tracked through review states. Spring Boot API on MySQL; changes stream through Kafka to a WebSocket server for live updates. Runs on Kubernetes behind an NGINX Ingress.",
    stack: ["Java", "Spring Boot", "MySQL", "Kafka", "WebSockets", "Kubernetes"],
    art: "prism",
    graphTitle: "Spring Boot API, live updates over Kafka and WebSockets",
    graphLabel: "Service topology of Code Inspect",
    problem:
      "Students and reviewers work on the same assignments and need to see review state change as it happens, across three roles.",
    architecture:
      "A Spring Boot API on MySQL owns the 6-state review flow and publishes every change to a Kafka topic; a stateless Node.js WebSocket server consumes it and pushes to open dashboards.",
    result: [
      "Live dashboards without polling the API",
      "Stateless WebSocket tier, separate from the API",
      "JWT roles enforced in one Spring Security filter",
      "Same stack runs on Docker Compose or minikube",
    ],
  },
];
