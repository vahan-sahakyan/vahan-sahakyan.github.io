// renders the gl presets to transparent pngs in src/assets/art; astro converts them to avif/webp at build
// usage: npm run art

import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = (name) => fileURLToPath(new URL(`../../src/assets/art/${name}.png`, import.meta.url));

// [file, preset, width, height, time]
const JOBS = [
  ["ribbon", "ribbon", 1400, 1000, 1.2],
  ["prism", "prism", 1400, 1000, 3.1],
];

const server = await createServer({ root, logLevel: "error", server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=metal", "--enable-gpu"] });
try {
  for (const [file, preset, w, h, t] of JOBS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error(file, e.message));
    await page.goto(`http://localhost:5199/tools/art/index.html?preset=${preset}&w=${w}&h=${h}&t=${t}`);
    await page.waitForFunction(() => window.__done);
    await page.locator("#c").screenshot({ path: out(file), omitBackground: true });
    console.log("rendered", file);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
