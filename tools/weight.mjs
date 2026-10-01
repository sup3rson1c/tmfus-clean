/*
  Page-weight meter. Loads every page in headless Chrome against the local
  dev server and sums the bytes each one pulls over the network, by type.

  Usage:
    node serve.mjs 3200
    node tools/weight.mjs [--base=http://localhost:3200] [--w=1440] [--json=out.json]

  Two numbers per page:
    load   what arrives before anyone scrolls (networkidle after first paint)
    scroll everything after walking the page top to bottom like a visitor

  Bytes are what Chrome reports as received (encodedDataLength). The dev
  server does not compress, so local files count at full size; the CDN
  scripts and Google Fonts arrive compressed, as they would live.
*/
import { writeFileSync } from "node:fs";
import { launch } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = opt("base", process.env.BASE_URL || "http://localhost:3200");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE).hostname)) {
  throw new Error(`Refusing to measure a non-local server: ${BASE}`);
}
const WIDTH = Number(opt("w", 1440));
const HEIGHT = WIDTH < 768 ? 844 : 900;
const PAGES = ["/", "/funding-estimator", "/heloc-calculator", "/sba-loans", "/mca", "/apply",
  "/about", "/contact", "/privacy", "/terms", "/unsubscribe", "/404"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function kind(url, mime) {
  const u = url.split("?")[0];
  if (/\.(woff2?|ttf|otf)$/.test(u) || mime.startsWith("font/")) return "font";
  if (/\.(webp|avif|png|jpe?g|svg|gif)$/.test(u) || mime.startsWith("image/")) return "image";
  if (/\.(mp4|webm)$/.test(u) || mime.startsWith("video/")) return "video";
  if (/\.css$/.test(u) || mime.includes("css")) return "css";
  if (/\.m?js$/.test(u) || mime.includes("javascript")) return "js";
  if (mime.includes("html")) return "html";
  return "other";
}

const browser = await launch();
const results = [];
try {
  for (const path of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, isMobile: WIDTH < 768, hasTouch: WIDTH < 768 });
    await page.setCacheEnabled(false);
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    const reqs = new Map();
    const done = [];
    cdp.on("Network.responseReceived", (e) => {
      reqs.set(e.requestId, { url: e.response.url, mime: e.response.mimeType || "" });
    });
    cdp.on("Network.loadingFinished", (e) => {
      const r = reqs.get(e.requestId);
      if (r && !r.url.startsWith("data:")) done.push({ ...r, bytes: e.encodedDataLength });
    });
    const sum = () => {
      const t = { html: 0, css: 0, js: 0, font: 0, image: 0, video: 0, other: 0, total: 0, files: [] };
      for (const r of done) {
        const k = kind(r.url, r.mime);
        t[k] += r.bytes;
        t.total += r.bytes;
        t.files.push([r.bytes, k, r.url.replace(BASE, "")]);
      }
      t.files.sort((a, b) => b[0] - a[0]);
      return t;
    };
    await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 90000 });
    await sleep(1500);
    const load = sum();
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= total + HEIGHT; y += Math.round(HEIGHT * 0.5)) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await sleep(120);
    }
    await sleep(2500);
    const scroll = sum();
    results.push({ path, load, scroll });
    const kb = (n) => (n / 1024).toFixed(0).padStart(6);
    console.log(`${path.padEnd(20)} load ${kb(load.total)} KB  scroll ${kb(scroll.total)} KB   ` +
      `[html ${kb(load.html)} css ${kb(load.css)} js ${kb(load.js)} font ${kb(load.font)} img ${kb(load.image)} video ${kb(load.video)}]`);
    await page.close();
  }
} finally {
  await browser.close();
}
const out = opt("json", "");
if (out) writeFileSync(out, JSON.stringify(results, null, 1));
