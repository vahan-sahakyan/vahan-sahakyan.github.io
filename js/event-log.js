// event-log.js - simulated redpanda topics under the dsn topology: append at the head, consumer offsets behind,
// lag in between. a poison message retries 3 times with backoff, then goes to the dlq, as in the project

import { visibleLoop, fitCanvas, onSchemeChange } from "./visible-loop.js";

// [name, color token, events per second]
const TOPICS = [
  ["post", "--topo-edge", 1.4],
  ["comment", "--topo-service", 1.1],
  ["like", "--topo-stream", 2.4],
  ["user", "--topo-store", 0.5],
];
const CONSUME_RATE = 4.5;
const SPIKE = 5;
const POISON = 1 / 120;
const SPEED = 38;
const FONT = '400 11px "IBM Plex Mono", ui-monospace, Menlo, monospace';
const LANE_H = 24;
const LANE_GAP = 7;
const LEFT = 64;

function mount(root) {
  const canvas = root.querySelector(".evlog-canvas");
  const stat = root.querySelector(".evlog-stat");
  const pauseBtn = root.querySelector("[data-evlog='pause']");
  const lanes = TOPICS.map(([name, token, rate]) => ({ name, token, rate, ev: [], next: 0, budget: 0, retryAt: 0 }));
  const dlq = [];
  const totals = { produced: 0, consumed: 0, dead: 0 };
  const colors = {};
  let simT = 0;
  let spikeUntil = -1;
  let paused = false;
  let loop;

  const readColors = () => {
    const cs = getComputedStyle(root);
    for (const n of ["--topo-fg", "--topo-muted", "--topo-border", "--topo-dlq", ...TOPICS.map((t) => t[1])]) {
      colors[n] = cs.getPropertyValue(n).trim();
    }
  };
  readColors();
  const s = fitCanvas(canvas, () => loop?.draw());
  const { ctx } = s;
  const head = () => s.w - (s.w < 420 ? 52 : 64);
  const xOf = (t) => head() - (simT - t) * SPEED;

  function simulate(dt) {
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

    [...lanes, { name: "dlq", dlq: true }].forEach((l, i) => {
      const y = 4 + i * (LANE_H + LANE_GAP);
      const mid = y + LANE_H / 2;
      ctx.fillStyle = l.dlq ? colors["--topo-dlq"] : colors["--topo-fg"];
      ctx.globalAlpha = l.dlq ? 0.08 : 0.04;
      ctx.fillRect(LEFT - 6, y, hx - LEFT + 12, LANE_H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = l.dlq ? colors["--topo-dlq"] : colors["--topo-muted"];
      ctx.fillText(l.name, 0, mid);

      if (l.dlq) {
        for (const e of dlq) ctx.fillRect(xOf(e.t), y + 5, 6, LANE_H - 10);
        return;
      }
      for (const e of l.ev) {
        const failing = e.poison && e.tries > 0 && !e.done;
        ctx.fillStyle = failing ? colors["--topo-dlq"] : colors[l.token];
        ctx.globalAlpha = failing ? 0.55 + 0.45 * Math.sin(simT * 18) : e.done ? 0.4 : 1;
        ctx.fillRect(xOf(e.t), y + 5, 6, LANE_H - 10);
      }
      ctx.globalAlpha = 1;

      // committed offset
      const cx = l.next < l.ev.length ? xOf(l.ev[l.next].t) - 3 : hx + 3;
      ctx.fillStyle = colors["--topo-fg"];
      ctx.fillRect(cx - 1, y - 2, 2, LANE_H + 4);

      const lag = l.ev.length - l.next;
      ctx.fillStyle = lag > 18 ? colors["--topo-dlq"] : lag > 7 ? colors["--topo-store"] : colors["--topo-muted"];
      ctx.fillText(`lag ${lag}`, hx + 12, mid);
    });
  }

  let statAt = -Infinity;
  function step(dt, t) {
    simulate(dt);
    render();
    if (t - statAt < 0.25) return;
    statAt = t;
    stat.textContent = `produced ${totals.produced} / consumed ${totals.consumed} / dead-lettered ${totals.dead}`;
  }

  // warm start, so the first frame already shows traffic
  for (let i = 0; i < 360; i++) simulate(1 / 30);
  loop = visibleLoop(root, step);
  onSchemeChange(() => {
    readColors();
    loop.draw();
  });

  root.querySelector("[data-evlog='spike']").addEventListener("click", () => {
    spikeUntil = simT + 4;
  });
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", paused);
    pauseBtn.textContent = paused ? "Resume consumers" : "Pause consumers";
  });
}

for (const root of document.querySelectorAll(".evlog")) {
  if ("IntersectionObserver" in window) mount(root);
}
