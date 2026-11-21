// build-time radial cluster for the stack map: a link joins two technologies used in the same project,
// bundled along the category hierarchy

import { hierarchy, cluster } from "d3-hierarchy";
import { lineRadial, curveBundle } from "d3-shape";
import { stack, stackProjects } from "../data/capabilities";

export const STACK_VARIANTS = [
  { id: "small", size: 360, inset: 86 },
  { id: "large", size: 600, inset: 110 },
] as const;

type Leaf = { name: string; children?: Leaf[] };

const colorOf: Record<string, string> = {};
for (const [, [color, techs]] of Object.entries(stack)) for (const t of techs) colorOf[t] = color;

const pairs = new Map<string, { a: string; b: string; projects: Set<string> }>();
for (const [project, techs] of Object.entries(stackProjects)) {
  for (let i = 0; i < techs.length; i++) {
    for (let j = i + 1; j < techs.length; j++) {
      const [a, b] = [techs[i], techs[j]].sort();
      const key = `${a}|${b}`;
      if (!pairs.has(key)) pairs.set(key, { a, b, projects: new Set() });
      pairs.get(key)!.projects.add(project);
    }
  }
}

const r1 = (v: number) => Math.round(v);

export function stackLayout(variant: (typeof STACK_VARIANTS)[number]) {
  const R = variant.size / 2 - variant.inset;
  const root = hierarchy<Leaf>({
    name: "",
    children: Object.entries(stack).map(([name, [, techs]]) => ({ name, children: techs.map((t) => ({ name: t })) })),
  });
  cluster<Leaf>().size([2 * Math.PI, R])(root);
  const leaves = root.leaves() as (typeof root & { x: number; y: number })[];
  const leaf = new Map(leaves.map((d) => [d.data.name, d]));
  const line = lineRadial<{ x: number; y: number }>()
    .curve(curveBundle.beta(0.85))
    .radius((d) => d.y)
    .angle((d) => d.x);
  const fix = (d: string | null) => (d ?? "").replace(/-?\d+\.\d+(e-?\d+)?/g, (n) => String(r1(+n)));

  return {
    size: variant.size,
    links: [...pairs.values()].map((p) => ({
      a: p.a,
      b: p.b,
      color: colorOf[p.a],
      projects: [...p.projects],
      d: fix(line(leaf.get(p.a)!.path(leaf.get(p.b)!) as unknown as { x: number; y: number }[])),
    })),
    nodes: leaves.map((d) => {
      const right = d.x < Math.PI;
      return {
        name: d.data.name,
        color: colorOf[d.data.name],
        transform: `rotate(${r1((d.x * 180) / Math.PI - 90)}) translate(${r1(d.y)},0)`,
        right,
      };
    }),
  };
}

export const projectsOf = (tech: string) => Object.keys(stackProjects).filter((p) => stackProjects[p].includes(tech));
