// the approach story: one post traced through the dsn system, step by step.
// positions are hand-placed per layout; [x, y] is the node's center

type Group = "edge" | "service" | "stream" | "store" | "dlq";

export const storyNodes: { id: string; label: string; short?: string; group: Group; wide: [number, number]; narrow: [number, number] }[] = [
  { id: "client", label: "Client", group: "edge", wide: [62, 212], narrow: [180, 36] },
  { id: "gateway", label: "Gateway", group: "edge", wide: [196, 212], narrow: [180, 118] },
  { id: "posts", label: "Posts", group: "service", wide: [330, 212], narrow: [236, 208] },
  { id: "scylla", label: "ScyllaDB", group: "store", wide: [330, 366], narrow: [84, 208] },
  { id: "redpanda", label: "Redpanda", group: "stream", wide: [484, 212], narrow: [180, 308] },
  { id: "dlq", label: "post.dlq", group: "dlq", wide: [484, 378], narrow: [292, 308] },
  { id: "feed", label: "Feed", group: "service", wide: [644, 64], narrow: [52, 420] },
  { id: "notify", label: "Notify", group: "service", wide: [644, 162], narrow: [136, 420] },
  { id: "search", label: "Search", group: "service", wide: [644, 262], narrow: [224, 420] },
  { id: "writer", label: "Event writer", short: "Writer", group: "service", wide: [644, 362], narrow: [310, 420] },
  { id: "valkey", label: "Valkey", group: "store", wide: [790, 64], narrow: [52, 540] },
  { id: "rebuilder", label: "Rebuilder", group: "service", wide: [790, 212], narrow: [180, 540] },
  { id: "clickhouse", label: "ClickHouse", group: "store", wide: [790, 362], narrow: [300, 540] },
];

export const storyViewBox = { wide: [860, 430], narrow: [360, 580] } as const;

export const storyEdges: { id: string; from: string; to: string; kind: "req" | "event" | "store" | "dlq" }[] = [
  { id: "e1", from: "client", to: "gateway", kind: "req" },
  { id: "e2", from: "gateway", to: "posts", kind: "req" },
  { id: "e3", from: "posts", to: "scylla", kind: "store" },
  { id: "e4", from: "scylla", to: "redpanda", kind: "event" },
  { id: "e5", from: "redpanda", to: "feed", kind: "event" },
  { id: "e6", from: "redpanda", to: "notify", kind: "event" },
  { id: "e7", from: "redpanda", to: "search", kind: "event" },
  { id: "e8", from: "redpanda", to: "writer", kind: "event" },
  { id: "e9", from: "redpanda", to: "dlq", kind: "dlq" },
  { id: "e10", from: "writer", to: "clickhouse", kind: "store" },
  { id: "e11", from: "clickhouse", to: "rebuilder", kind: "store" },
  { id: "e12", from: "rebuilder", to: "valkey", kind: "store" },
  { id: "e13", from: "feed", to: "valkey", kind: "store" },
];

export const storySteps: { title: string; body: string; nodes: string[]; edges: string[] }[] = [
  {
    title: "Verify at the edge",
    body: "The gateway checks the JWT against Keycloak's JWKS and turns HTTP/JSON into a gRPC call with a 5s deadline.",
    nodes: ["client", "gateway"],
    edges: ["e1"],
  },
  {
    title: "Write once, atomically",
    body: "posts-service writes the post and its outbox event in one ScyllaDB LOGGED BATCH. Both exist or neither does, so there is no dual write to reconcile.",
    nodes: ["gateway", "posts", "scylla"],
    edges: ["e2", "e3"],
  },
  {
    title: "Publish from the outbox",
    body: "A relay reads the outbox and publishes post.created to Redpanda. Delivery is at-least-once, so consumers are built for redelivery.",
    nodes: ["scylla", "redpanda"],
    edges: ["e4"],
  },
  {
    title: "Fan out, independently",
    body: "Feed, notification, search and the event writer each consume at their own pace. Feed and notification writes are idempotent, and the event store collapses duplicate ids.",
    nodes: ["redpanda", "feed", "notify", "search", "writer"],
    edges: ["e5", "e6", "e7", "e8"],
  },
  {
    title: "Fail without blocking",
    body: "A poison message retries 3 times with backoff, then moves to the dead-letter topic. Alerts fire on DLQ depth, outbox backlog and consumer lag.",
    nodes: ["redpanda", "dlq"],
    edges: ["e9"],
  },
  {
    title: "Rebuild from the log",
    body: "Every event lands in ClickHouse, 500 messages or 200ms per insert. Feeds in Valkey are a read model: the rebuilder replays the store into a fresh copy and renames it in.",
    nodes: ["writer", "clickhouse", "rebuilder", "valkey", "feed"],
    edges: ["e10", "e11", "e12", "e13"],
  },
];
