// event-log.ts - simulated redpanda topics under the dsn topology: append at the head, consumer offsets behind,
// lag in between. a poison message retries 3 times with backoff, then goes to the dlq, as in the project

import { visibleLoop, fitCanvas, type Loop } from "./visible-loop";

// [name, color token, events per second]
const TOPICS: [string, string, number][] = [
  ["post", "--c-edge", 1.4],
  ["comment", "--c-service", 1.1],
  ["like", "--c-stream", 2.4],
  ["user", "--c-store", 0.5],
];
const CONSUME_RATE = 4.5;
const SPIKE = 5;
const POISON = 1 / 120;
const SPEED = 38;
const FONT = '400 11px "Geist Mono", ui-monospace, Menlo, monospace';
const LANE_H = 24;
const LANE_GAP = 7;
const LEFT = 64;

type Ev = { t: number; poison: boolean; tries: number; done: boolean };
type Lane = { name: string; token: string; rate: number; ev: Ev[]; next: number; budget: number; retryAt: number };

export default function mountEventLog(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>(".evlog-canvas")!;
  const stat = root.querySelector<HTMLElement>(".evlog-stat")!;
  const pauseBtn = root.querySelector<HTMLButtonElement>("[data-evlog-action='pause']")!;
  const lanes: Lane[] = TOPICS.map(([name, token, rate]) => ({ name, token, rate, ev: [], next: 0, budget: 0, retryAt: 0 }));
  const dlq: { t: number }[] = [];
  const totals = { produced: 0, consumed: 0, dead: 0 };
  const colors: Record<string, string> = {};
  let simT = 0;
  let spikeUntil = -1;
  let paused = false;
  let loop: Loop | undefined;

  const readColors = () => {
    const cs = getComputedStyle(root);
    for (const n of ["--ink", "--muted", "--c-dlq", ...TOPICS.map((t) => t[1])]) colors[n] = cs.getPropertyValue(n).trim();
  };
  readColors();
  const s = fitCanvas(canvas, () => loop?.draw());
  const { ctx } = s;
  const head = () => s.w - (s.w < 420 ? 52 : 64);
  const xOf = (t: number) => head() - (simT - t) * SPEED;

  function simulate(dt: number) {
    simT += dt;
    const boost = simT < spikeUntil ? SPIKE : 1;
    for (const l of lanes) {
      for (let k = l.rate * boost * dt; k > 0; k -= 1) {
        if (Math.random() >= Math.min(1, k)) continue;
        l.ev.push({ t: simT, poison: Math.random() < POISON, tries: 0, done: false });
        totals.produced++;
      }
      if (!paused) {
        l.budget = Math.min(l.budget + CONSUME_RATE * dt, 2);
        while (l.budget >= 1 && l.next < l.ev.length && simT >= l.retryAt) {
          const e = l.ev[l.next];
          l.budget -= 1;
          if (e.poison && e.tries < 3) {
            e.tries++;
            l.retryAt = simT + 0.3 * 2 ** e.tries;
            break;
          }
          if (e.poison) {
            dlq.push({ t: simT });
            totals.dead++;
          }
          e.done = true;
          l.next++;
          totals.consumed++;
        }
      }
      // retention: whatever scrolls out is dropped
      while (l.ev.length && xOf(l.ev[0].t) < LEFT - 12) {
        l.ev.shift();
        l.next = Math.max(0, l.next - 1);
      }
    }
    while (dlq.length && xOf(dlq[0].t) < LEFT - 12) dlq.shift();
  }

  function render() {
    const hx = head();
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.font = FONT;
    ctx.textBaseline = "middle";

    [...lanes, null].forEach((l, i) => {
      const isDlq = l === null;
      const y = 4 + i * (LANE_H + LANE_GAP);
      const mid = y + LANE_H / 2;
      ctx.fillStyle = isDlq ? colors["--c-dlq"] : colors["--ink"];
      ctx.globalAlpha = isDlq ? 0.08 : 0.045;
      ctx.beginPath();
      ctx.roundRect(LEFT - 6, y, hx - LEFT + 12, LANE_H, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = isDlq ? colors["--c-dlq"] : colors["--muted"];
      ctx.fillText(isDlq ? "dlq" : l.name, 0, mid);

      if (isDlq) {
        for (const e of dlq) ctx.fillRect(xOf(e.t), y + 5, 6, LANE_H - 10);
        return;
      }
      for (const e of l.ev) {
        const failing = e.poison && e.tries > 0 && !e.done;
        ctx.fillStyle = failing ? colors["--c-dlq"] : colors[l.token];
        ctx.globalAlpha = failing ? 0.55 + 0.45 * Math.sin(simT * 18) : e.done ? 0.35 : 1;
        ctx.fillRect(xOf(e.t), y + 5, 6, LANE_H - 10);
      }
      ctx.globalAlpha = 1;

      // committed offset
      const cx = l.next < l.ev.length ? xOf(l.ev[l.next].t) - 3 : hx + 3;
      ctx.fillStyle = colors["--ink"];
      ctx.fillRect(cx - 1, y - 2, 2, LANE_H + 4);

      const lag = l.ev.length - l.next;
      ctx.fillStyle = lag > 18 ? colors["--c-dlq"] : lag > 7 ? colors["--c-store"] : colors["--muted"];
      ctx.fillText(`lag ${lag}`, hx + 12, mid);
    });
  }

  let statAt = -Infinity;
  function step(dt: number, t: number) {
    simulate(dt);
    render();
    if (t - statAt < 0.25) return;
    statAt = t;
    stat.textContent = `produced ${totals.produced} / consumed ${totals.consumed} / dead-lettered ${totals.dead}`;
  }

  // warm start, so the first frame already shows traffic
  for (let i = 0; i < 360; i++) simulate(1 / 30);
  loop = visibleLoop(root, step);

  // with motion off the loop is idle, so a button jumps the simulation 4s ahead to show its effect
  const advance = () => {
    if (loop!.running) return;
    for (let i = 0; i < 120; i++) simulate(1 / 30);
    statAt = -Infinity;
    loop!.draw();
  };
  root.querySelector("[data-evlog-action='spike']")!.addEventListener("click", () => {
    spikeUntil = simT + 4;
    advance();
  });
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.textContent = paused ? "Resume consumers" : "Pause consumers";
    advance();
  });
  root.classList.add("is-ready");
}
