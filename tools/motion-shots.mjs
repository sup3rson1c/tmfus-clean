/*
  Motion contact sheet: scroll to named states and screenshot each one.

  Usage:
    node tools/motion-shots.mjs <path> <label> [--w=1440] [--h=900] [--reduced] --at=top,hero@0.5,hours@0.3,.paths,bottom

  Stops:
    top | bottom
    hero@p     inside the pinned hero at progress p (0–1)
    hours@p    inside the pinned engraving clock at progress p
    <selector> that element's top at 12% of the viewport
  Each line prints the scroll position and every data-sc-verify-state value.
  Files: "temporary screenshots/mo-N-<label>-<i>.jpg" (never overwritten).
*/
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./browser.mjs";

const args = process.argv.slice(2);
const path = args[0] ?? "/";
const label = args[1] && !args[1].startsWith("--") ? args[1] : "page";
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const width = Number(opt("w", 1440));
const height = Number(opt("h", 900));
const stops = opt("at", "top").split(",");
const OUT = "temporary screenshots";
mkdirSync(OUT, { recursive: true });
const n = Math.max(0, ...readdirSync(OUT).map((f) => Number(/^mo-(\d+)/.exec(f)?.[1] ?? 0))) + 1;
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
  await sleep(2200);

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const y = await page.evaluate((s) => {
      const vh = innerHeight;
      if (s === "top") return 0;
      if (s === "bottom") return document.documentElement.scrollHeight - vh;
      const named = /^(hero|hours)@([\d.]+)$/.exec(s);
      const el = document.querySelector(named ? (named[1] === "hero" ? "[data-hero]" : "[data-clock]") : s);
      if (!el) return -1;
      const top = el.getBoundingClientRect().top + scrollY;
      if (named) return Math.round(top + Number(named[2]) * Math.max(0, el.offsetHeight - vh));
      return Math.round(top - vh * 0.12);
    }, stop);
    if (y < 0) {
      console.log(`skip ${stop} (not found)`);
      continue;
    }
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(1500);
    const state = await page.evaluate(() =>
      [...document.querySelectorAll("[data-sc-verify-state]")].map((e) => e.getAttribute("data-sc-verify-state")).join("  "),
    );
    const file = join(OUT, `mo-${n}-${label}-${i}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 80 });
    console.log(`saved ${file}  ${stop} y=${y}  ${state}`);
  }

  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    w: innerWidth,
    h: document.documentElement.scrollHeight,
    vh: innerHeight,
  }));
  console.log(`${width}x${height}  page ${(m.h / m.vh).toFixed(1)} viewport-heights  ${m.sw > m.w ? `*** H-OVERFLOW ${m.sw}px ***` : "no h-overflow"}`);
  console.log(errors.length ? `errors:\n  ${[...new Set(errors)].join("\n  ")}` : "no console errors");
} finally {
  await browser.close();
}
