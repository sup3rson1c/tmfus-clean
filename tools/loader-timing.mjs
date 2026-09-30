/* Measures how long the opening loader is actually on screen, from
   navigation start. Usage: node tools/loader-timing.mjs [reduced] [force] */
import { launch } from "./browser.mjs";
const reduced = process.argv.includes("reduced");
const force = process.argv.includes("force");
const browser = await launch();
const p = await browser.newPage();
await p.setViewport({ width: 1440, height: 900 });
if (reduced) await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await p.evaluateOnNewDocument(() => {
  window.__log = [];
  const t0 = performance.now();
  let last = "";
  const tick = () => {
    const el = document.querySelector("[data-loader]");
    let s = "absent";
    if (el) {
      const cs = getComputedStyle(el);
      s = el.hidden || cs.display === "none" ? "hidden" : `shown op=${(+cs.opacity).toFixed(2)}`;
    }
    if (s !== last) { window.__log.push([Math.round(performance.now() - t0), s]); last = s; }
  };
  setInterval(tick, 10);
  addEventListener("load", () => window.__log.push([Math.round(performance.now() - t0), "load event"]));
});
await p.goto("http://localhost:3200/" + (force ? "?motion=force" : ""), { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 3500));
console.log(JSON.stringify(await p.evaluate(() => window.__log)));
await browser.close();
