export const site = {
  url: "https://vahan-sahakyan.github.io",
  title: "Vahan Sahakyan | Senior Backend Engineer & Distributed Systems",
  description:
    "Senior Backend Engineer specializing in distributed systems, microservices architecture, Kubernetes orchestration, and event-driven systems. Go, Node.js, MongoDB. Building scalable infrastructure at Forbes.",
  ogDescription:
    "Senior Backend Engineer specializing in distributed systems, microservices architecture, Kubernetes orchestration. Go, Node.js, MongoDB. Forbes.",
  twitterDescription:
    "Senior Backend Engineer specializing in distributed systems, microservices architecture, Kubernetes orchestration. Go, Node.js, MongoDB.",
  keywords:
    "Vahan Sahakyan, Backend Engineer, Distributed Systems, Microservices, Kubernetes, Go, Node.js, MongoDB, Systems Architecture, Infrastructure, ArgoCD, Event-Driven Architecture",
};

export const person = {
  name: "Vahan Sahakyan",
  role: "Senior Backend Engineer",
  photo: "/images/hs-image-2.webp",
  cv: "https://vahan-sahakyan.github.io/cv/",
};

export const contact = {
  email: "vahan.codes@gmail.com",
  phone: { label: "+374 95 27 68 27", href: "tel:+37495276827" },
  telegram: { label: "t.me/vahan_sahakyan", href: "https://t.me/vahan_sahakyan" },
};

export const socials = [
  { name: "LinkedIn", href: "https://www.linkedin.com/in/vahan-sahakyan", icon: "linkedin" },
  { name: "GitHub", href: "https://github.com/vahan-sahakyan", icon: "github" },
  { name: "X", href: "https://x.com/_vahan_sahakyan", icon: "x" },
] as const;

export const glance: [string, string][] = [
  ["experience", "5+ years"],
  ["languages", "Go, Python, TypeScript, Java"],
  ["streaming", "Kafka, Redpanda, Pub/Sub"],
  ["data", "PostgreSQL, ScyllaDB, ClickHouse, MongoDB"],
  ["infra", "AWS, GCP, Kubernetes, ArgoCD"],
  ["observability", "Datadog, Prometheus, Grafana"],
  ["shipped for", "Forbes, Warner Music Group, Optimum Partners, Datafoundry"],
];

export const nav = [
  { label: "Approach", href: "#approach" },
  { label: "Work", href: "#work" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Experience", href: "#experience" },
];
