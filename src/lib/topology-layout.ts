// build-time force layout for the topology graphs, one per breakpoint variant.
// d3-force seeds its jiggle with a fixed lcg, so the output is the same on every build

import { forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide } from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import type { Graph, TopoNode, LinkKind } from "../data/topology";

export const NODE_R = 9;
const TICKS = 300;

export const VARIANTS = [
  { id: "narrow", width: 360 },
  { id: "mid", width: 720 },
  { id: "wide", width: 1040 },
] as const;

type SimNode = TopoNode & SimulationNodeDatum & { x: number; y: number };
type SimLink = { source: SimNode; target: SimNode; kind: LinkKind };

export type LaidOut = {
  id: string;
  W: number;
  H: number;
  nodes: (TopoNode & { x: number; y: number })[];
  links: { source: string; target: string; kind: LinkKind; d: string }[];
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

export function layout(graph: Graph, variant: (typeof VARIANTS)[number]): LaidOut {
  const W = variant.width;
  // narrow screens stack the layers top to bottom
  const vertical = W < 640;
  const pad = vertical ? 40 : 60;
  const layers = Math.max(...graph.nodes.map((n) => n.col));
  const perLayer = graph.nodes.reduce<number[]>((acc, n) => ((acc[n.col] = (acc[n.col] || 0) + 1), acc), []);
  const rows = Math.max(...perLayer);
  const H = Math.round(vertical ? 2 * pad + layers * 150 : Math.min(520, Math.max(340, Math.min(W * 0.5, rows * 80 + 160))));
  const layerPos = (col: number) => pad + (col * ((vertical ? H : W) - 2 * pad)) / layers;

  const nodes: SimNode[] = graph.nodes.map((n, i) => ({
    ...n,
    x: vertical ? W / 2 + (i % 5) * 10 : layerPos(n.col),
    y: vertical ? layerPos(n.col) : H / 2 + (i % 5) * 10,
  }));
  const links = graph.links.map((l) => ({ ...l })) as unknown as SimLink[];

  forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(70)
        .strength((l) => (l.kind === "telemetry" || l.kind === "deploy" ? 0 : 0.04))
    )
    .force("charge", forceManyBody().strength(vertical ? -180 : -220))
    .force("collide", forceCollide(vertical ? 30 : 34))
    .force("layer", vertical ? forceY<SimNode>((d) => layerPos(d.col)).strength(1) : forceX<SimNode>((d) => layerPos(d.col)).strength(1))
    .force("center", vertical ? forceX(W / 2).strength(0.06) : forceY(H / 2).strength(0.1))
    .stop()
    .tick(TICKS);

  for (const n of nodes) {
    n.x = round(clamp(n.x, 40, W - 40));
    n.y = round(clamp(n.y, 16, H - 32));
  }

  return {
    id: variant.id,
    W,
    H,
    nodes: nodes.map(({ index, vx, vy, fx, fy, ...n }) => n),
    links: links.map((l) => ({ source: l.source.id, target: l.target.id, kind: l.kind, d: edgePath(l.source, l.target) })),
  };
}

// bends sideways and stops short of the target circle so the arrowhead stays visible
function edgePath(s: { x: number; y: number }, t: { x: number; y: number }) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  if (Math.hypot(dx, dy) < 1) return "";
  const mx = (s.x + t.x) / 2 - dy * 0.12;
  const my = (s.y + t.y) / 2 + dx * 0.12;
  const k = Math.hypot(t.x - mx, t.y - my);
  const ex = t.x - ((t.x - mx) / k) * (NODE_R + 3);
  const ey = t.y - ((t.y - my) / k) * (NODE_R + 3);
  return `M${round(s.x)},${round(s.y)}Q${round(mx)},${round(my)} ${round(ex)},${round(ey)}`;
}
