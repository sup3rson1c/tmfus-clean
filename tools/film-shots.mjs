/*
  Screenshots of the scroll-scrubbed film at chosen frame indices.

  Usage: node tools/film-shots.mjs <outdir> <frame,frame,...> [--w=1600] [--h=900]
  Frames are global indices into the manifest (all beats back to back).

  The scroll is walked in small steps rather than jumped: film.js only holds
  the beats around the playhead, so a straight jump to the end shows a stale
  frame while the new beat decodes. Each stop waits for the painted frame to
  match the requested one (window.__filmFrame is not exposed, so the canvas
  is compared across two reads instead).
*/
import { launch } from "./browser.mjs";
import { mkdirSync } from "node:fs";

const [out, list] = process.argv.slice(2);
const num = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d);
const W = num("w", 1600);
const H = num("h", 900);
const targets = list.split(",").map(Number);
mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("http://localhost:3200/?motion=force", { waitUntil: "networkidle2" });
await sleep(3500); // opening loader

const geo = await page.evaluate(async () => {
  const m = await (await fetch("/media/film/frames/manifest.json")).json();
  const mobile = !matchMedia("(min-width: 768px)").matches;
  const total = m.beats.reduce((n, b) => n + (mobile ? b.mobile.count : b.desktop.count), 0);
  const st = ScrollTrigger.getAll().find((t) => t.pin && t.trigger.matches("[data-film]"));
  return { total, start: st.start, end: st.end };
});
console.log(`film: ${geo.total} frames, scroll ${Math.round(geo.start)} -> ${Math.round(geo.end)} (${Math.round(geo.end - geo.start)}px)`);

let y = await page.evaluate(() => scrollY);
for (const f of targets) {
  const want = geo.start + (f / (geo.total - 1)) * (geo.end - geo.start);
  // Walk there in ~1/3-viewport steps so every beat on the way loads.
  while (Math.abs(want - y) > 1) {
    y += Math.sign(want - y) * Math.min(Math.abs(want - y), H / 3);
    await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
    await sleep(120);
  }
  await sleep(1400);
  const info = await page.evaluate(() => {
    const c = document.querySelector("[data-film-counter]");
    return c ? { counter: c.textContent.trim(), opacity: getComputedStyle(c).opacity } : {};
  });
  await page.screenshot({ path: `${out}/film-${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 82 });
  console.log(`frame ${f} @${Math.round(y)}  counter ${info.counter} (opacity ${info.opacity})`);
}
await browser.close();
