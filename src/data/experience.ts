// lane 0 is the employer line, lane 1 the client line; parents are row indexes
export type Commit = {
  date: string;
  lane: 0 | 1;
  parents: number[];
  msg: string;
  tag?: string;
  meta: string;
  head?: boolean;
  merge?: boolean;
  ongoing?: boolean;
  role: string;
};

export const commits: Commit[] = [
  {
    date: "2025-01",
    lane: 1,
    parents: [1],
    head: true,
    tag: "HEAD -> forbes",
    msg: "promote: senior backend engineer",
    meta: "Forbes Vetted: Go and TypeScript services for search, cursor pagination, scraping and data pipelines",
    role: "optimum",
  },
  {
    date: "2024-05",
    lane: 1,
    parents: [2],
    msg: "checkout -b forbes",
    meta: "Embedded on the Forbes Platform and Vetted teams: Bertie CMS, Zephr and Cordial integrations",
    role: "forbes",
  },
  {
    date: "2024-05",
    lane: 0,
    parents: [3],
    ongoing: true,
    tag: "optimum",
    msg: "join Optimum Partners",
    meta: "Senior Backend Engineer, Yerevan",
    role: "optimum",
  },
  {
    date: "2023-09",
    lane: 0,
    parents: [5, 4],
    merge: true,
    msg: "merge wmg, join Datafoundry",
    meta: "Backend and infrastructure: microservices refactor, 70% coverage floor, SonarQube gates",
    role: "datafoundry-2",
  },
  {
    date: "2022-11",
    lane: 1,
    parents: [5],
    msg: "checkout -b wmg",
    meta: "Warner Music Group contract: royalty and publishing platform for ADA and DSPs",
    role: "wmg",
  },
  {
    date: "2022-11",
    lane: 0,
    parents: [6],
    msg: "join NWSLAB",
    meta: "Carpathia UI for WMG / ADA, architecture reviews with backend engineers",
    role: "nwslab",
  },
  {
    date: "2022-03",
    lane: 0,
    parents: [],
    tag: "init",
    msg: "join Datafoundry",
    meta: "DF mSignal AI: dashboard analytics app with 4 user roles",
    role: "datafoundry-1",
  },
];

export type Role = {
  id: string;
  title: string;
  company: string;
  type: string;
  logo: string;
  logoClass?: string;
  link: string;
  period: string;
  // when set, the duration is computed live from this month
  since?: string;
  duration?: string;
  location: string;
  blocks: { heading?: string; lines?: string[]; bullets?: string[] }[];
  skills: string[];
};

export const roles: Role[] = [
  {
    id: "forbes",
    title: "Senior Backend Engineer",
    company: "Forbes",
    type: "Contract",
    logo: "/images/fbs-logo.jpeg",
    link: "https://www.forbes.com/careers-at-forbes/",
    period: "May 2024 - Present",
    since: "2024-05-01",
    location: "Jersey City, New Jersey, United States · Remote",
    blocks: [
      {
        heading: "Platform Team, Bertie CMS, Vetted Team",
        bullets: [
          "Contributing to multi-tenant Kubernetes infrastructure across prod/staging/dev with namespace isolation",
          "Backend development on event-driven systems (Kafka-compatible brokers, async patterns)",
          "Working with GitOps automation (ArgoCD, Argo Events) for infrastructure provisioning",
          "Production MongoDB experience: schema design, scaling concerns, consistency patterns",
          "Code reviews and mentoring junior engineers on backend/systems patterns",
          "Full-stack contributions across frontend, backend, and infrastructure layers",
        ],
      },
    ],
    skills: ["Go", "Node.js", "TypeScript", "Kubernetes", "Docker", "MongoDB", "PostgreSQL", "ArgoCD", "Argo Events", "Prometheus", "Grafana", "GCP", "Linux", "REST APIs", "React"],
  },
  {
    id: "optimum",
    title: "Senior Backend Engineer",
    company: "Optimum Partners - Armenia",
    type: "Full-time",
    logo: "/images/op-logo.png",
    link: "https://www.optimumpartners.com/",
    period: "May 2024 - Present",
    since: "2024-05-01",
    location: "Yerevan, Armenia · Hybrid",
    blocks: [
      { lines: ["Embedded at Forbes: Platform & Vetted Teams"] },
      {
        heading: "Senior Backend Engineer · Jan 2025 - Present",
        bullets: [
          "Architecting distributed Go and TypeScript services for Forbes Vetted: search, cursor pagination, scraping, data pipelines",
          "Event-driven architecture on Kafka-compatible brokers with async consumers",
          "Multi-tenant Kubernetes on GCP with namespace isolation and GitOps (ArgoCD, Argo Events)",
          "Leading backend delivery on Nexus initiatives; mentoring engineers on system design",
        ],
      },
      {
        heading: "Full Stack Software Engineer · May 2024 - Jan 2025",
        bullets: [
          "Go and TypeScript services and integrations for Bertie CMS and Vetted",
          "Integrated the Zephr and Cordial platforms",
          "Maintaining 100% code coverage while shipping new features",
          "Technical documentation: architecture decisions, runbooks, design patterns",
        ],
      },
    ],
    skills: ["Go", "Node.js", "TypeScript", "Kubernetes", "Docker", "Microservices", "MongoDB", "PostgreSQL", "Kafka", "ArgoCD", "GCP", "Linux", "Technical Leadership"],
  },
  {
    id: "datafoundry-2",
    title: "Software Engineer (Backend & Infrastructure)",
    company: "Datafoundry",
    type: "Full-time",
    logo: "/images/df-logo.png",
    link: "https://www.datafoundry.ai/",
    period: "Sep 2023 - May 2024",
    duration: "9 mos",
    location: "Yerevan, Armenia · Hybrid",
    blocks: [
      {
        heading: "DF mSignal AI, DF Literature Monitor, DF mSafety AI",
        bullets: [
          "Led large-scale refactoring across microservices architecture",
          "Set up and maintained frontend quality tools (ESLint) in legacy codebases",
          "Achieved minimum 70% unit test coverage, reduced code smells for SonarQube quality gates",
          "Restructured static components into reusable library-style modules for ecosystem-wide use",
          "Technical leadership and peer mentoring on code quality and design patterns",
        ],
      },
    ],
    skills: ["JavaScript", "TypeScript", "React", "Spring", "Node.js", "Code Review", "Technical Design", "ESLint", "Webpack", "Jest", "Technical Leadership"],
  },
  {
    id: "wmg",
    title: "Software Engineer",
    company: "Warner Music Group",
    type: "Contract",
    logo: "/images/wmg-logo.jpeg",
    link: "https://www.wmg.com/",
    period: "Nov 2022 - Sep 2023",
    duration: "11 mos",
    location: "New York, United States · Remote",
    blocks: [
      { lines: ["ADA (Alternative Distribution Alliance) & DSPs (Spotify, Apple Music, etc.)", "Music Royalty and Publishing Platform"] },
    ],
    skills: ["TypeScript", "React", "Design Patterns", "Java", "Business Analysis", "Analytics", "UX", "Redux", "JavaScript", "Node.js", "Material-UI"],
  },
  {
    id: "nwslab",
    title: "Software Engineer",
    company: "NWSLAB",
    type: "Full-time",
    logo: "/images/nwslab-logo.png",
    logoClass: "is-wide",
    link: "https://www.nwslab.com/",
    period: "Nov 2022 - Sep 2023",
    duration: "11 mos",
    location: "Yerevan, Armenia · Hybrid",
    blocks: [
      {
        heading: "Carpathia UI - Warner Music Group, ADA",
        bullets: [
          "Worked in cross-cultural environment spanning Russia, Ukraine, Armenia, US, Romania, India",
          "Contributed to architectural decision-making with backend engineers and Solutions Architect",
          "Transformed Figma designs into high-quality, maintainable code",
          "Peer-reviewed code under Tech Lead's guidance",
          "Implemented generic TypeScript utility types for project-specific needs",
        ],
      },
    ],
    skills: ["JavaScript", "React", "TypeScript", "ESLint", "Redux", "Spring", "Node.js"],
  },
  {
    id: "datafoundry-1",
    title: "Software Engineer",
    company: "Datafoundry",
    type: "Full-time",
    logo: "/images/df-logo.png",
    link: "https://www.datafoundry.ai/",
    period: "Mar 2022 - Nov 2022",
    duration: "9 mos",
    location: "Yerevan, Armenia · Hybrid",
    blocks: [
      {
        heading: "DF mSignal AI - Clinical Trials, Signal Management",
        bullets: [
          "Kick started a dashboard analytics app, with 4 user roles.",
          "Integrated and reused the legacy version of the project.",
          "Optimized the performance by modifying the state management.",
          "Refactored the codebase following the SOC concept and DRY principle.",
          "Designed tech solutions by collaborating with the back-end engineers.",
        ],
      },
    ],
    skills: ["JavaScript", "React", "Code Review", "Saga", "Ant Design", "Spring", "Node.js"],
  },
];

export const education = [
  {
    title: "Anthropic Academy: Claude with Google Cloud's Vertex AI",
    detail: "Tool-calling, Agents, RAG, MCP, Vision, Prompt Caching, Claude Code, Computer Use",
    year: "2025",
  },
  {
    title: 'Bootcamp - "BPC Armenia" [C++, Python, Linux, Bash]',
    detail: "Artak Yenokyan - Sr. Engineering Manager at Siemens EDA",
    year: "2018-2019",
  },
];
