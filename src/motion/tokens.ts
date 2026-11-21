// Motion tokens: the single place to tune timing and feel.
// Base.astro emits them as css custom properties (--dur-*, --ease-*), and the gsap scripts import them directly

// seconds
export const duration = {
  xs: 0.15,
  sm: 0.3,
  md: 0.6,
  lg: 0.9,
  xl: 1.4,
} as const;

// cubic-bezier control points; registered as gsap CustomEases under the same names
export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  soft: [0.33, 0, 0.2, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const;

// seconds between siblings
export const stagger = {
  line: 0.09,
  word: 0.03,
  item: 0.07,
} as const;

export const reveal = {
  // px the text travels in from
  y: 20,
  // fraction of the viewport from the top where a reveal starts
  start: 0.85,
} as const;

export const interaction = {
  // px a magnetic button follows the cursor
  magnet: 10,
  // max card tilt in degrees
  tilt: 3,
  // px, the cursor glow's diameter
  glow: 560,
  // 0..1 smoothing of the cursor glow per frame
  glowFollow: 0.12,
} as const;

// how far each depth layer moves in px over one viewport of scroll
export const parallax = {
  near: -90,
  mid: -50,
  far: -20,
} as const;

// sections landing as they scroll in: each starts a full overlap lower with rounded top corners and slides up
// over the section above, flattening as it lands. end is where it lands, as a fraction of the viewport from the top
export const land = {
  radius: 40,
  end: 0.58,
  // the footer wordmark finishes rising when its line is this far from the top, or at the page end if sooner
  rise: 0.45,
} as const;

export const counter = {
  duration: 1.6,
} as const;

// the hero particle stream
export const stream = {
  // particles on desktop; phones get half
  count: 2100,
  // share of particles drawn as dots instead of glyphs
  dots: 0.35,
  // px per second along the band
  speed: 46,
  // band thickness as a fraction of the hero height
  width: 0.34,
  // turns of the ribbon along the band, and how fast the twist travels, rad per second
  twists: 1.6,
  spin: 0.45,
  // how much the ribbon's cross-section curls, like cloth
  curl: 0.55,
  // px radius around the cursor where glyphs brighten
  pointerRadius: 140,
  pointerGlow: 0.45,
  // fraction of the hero scrolled by which the band has fully spread over it
  spreadAt: 1,
  // how fast the spread catches up with scroll, per second
  spreadFollow: 12,
  // max drop in spread per second while gathering
  gatherRate: 1.1,
} as const;

// the pinned approach story: viewport heights of scroll per step on desktop
export const story = {
  stepLength: 0.8,
  packetDuration: 1.1,
} as const;

const bezier = (p: readonly number[]) => `cubic-bezier(${p.join(", ")})`;

// :root custom properties for css transitions and keyframes
export function cssMotionVars(): string {
  const vars: string[] = [];
  for (const [k, v] of Object.entries(duration)) vars.push(`--dur-${k}: ${v}s`);
  for (const [k, v] of Object.entries(ease)) vars.push(`--ease-${k}: ${bezier(v)}`);
  for (const [k, v] of Object.entries(stagger)) vars.push(`--stagger-${k}: ${v}s`);
  vars.push(`--reveal-y: ${reveal.y}px`);
  return `:root{${vars.join(";")}}`;
}
