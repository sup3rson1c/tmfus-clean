/*
  Multi-shot screenshot helper: one browser session, several scroll stops.

  Usage:
    node tools/shots.mjs <path> <label> [--w=1440] [--h=900] [--stops=0,0.25,0.5] [--px=0,900] [--full] [--reduced]

  The page is walked top to bottom first so scroll-triggered reveals fire,
  then each stop is captured after a settle delay. Files are written to
  "temporary screenshots/shot-N-<label>-<i>.jpg" (never overwritten).
*/
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./browser.mjs";

const args = process.argv.slice(2);
const path = args[0] ?? "/";
const label = args[1] && !args[1].startsWith("--") ? args[1] : "page";
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};
const width = Number(opt("w", 1440));
const height = Number(opt("h", 900));
const stops = opt("stops", "0").split(",").map(Number);
const pxStops = opt("px", "") ? opt("px", "").split(",").map(Number) : null;
const OUT = "temporary screenshots";
mkdirSync(OUT, { recursive: true });
const n =
  Math.max(0, ...readdirSync(OUT).map((f) => Number(/^shot-(\d+)/.exec(f)?.[1] ?? 0))) + 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  if (args.includes("--reduced")) {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  }
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));

  await page.goto(`http://localhost:3100${path}`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.evaluate(() => document.fonts?.ready);
  await sleep(1800);

  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= total; y += Math.round(height * 0.6)) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(90);
  }

  if (args.includes("--full")) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1200);
    const file = join(OUT, `shot-${n}-${label}-full.jpg`);
    await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 72 });
    console.log(`saved ${file}`);
  } else {
    const targets = pxStops ?? stops.map((f) => Math.round(total * f));
    for (let i = 0; i < targets.length; i++) {
      await page.evaluate((v) => window.scrollTo(0, v), targets[i]);
      await sleep(1600);
      const file = join(OUT, `shot-${n}-${label}-${i}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 78 });
      console.log(`saved ${file}  (y=${targets[i]})`);
    }
  }

  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, h: document.documentElement.scrollHeight }));
  console.log(`${width}x${height}  page height ${m.h}px  ${m.sw > m.w ? `*** HORIZONTAL OVERFLOW (${m.sw}px) ***` : "no h-overflow"}`);
  console.log(errors.length ? `errors:\n  ${[...new Set(errors)].join("\n  ")}` : "no console errors");
} finally {
  await browser.close();
}
