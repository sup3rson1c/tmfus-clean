/* Screenshots of the opening loader at fixed times after navigation.
   Usage: node tools/loader-shots.mjs <outdir> */
import { launch } from "./browser.mjs";
const out = process.argv[2];
const browser = await launch();
const p = await browser.newPage();
await p.setViewport({ width: 1440, height: 900 });
p.on("pageerror", (e) => console.log("pageerror", e.message));
const t0 = Date.now();
p.goto("http://localhost:3200/");
for (const t of [700, 1300, 2150, 3800]) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await p.screenshot({ path: `${out}/loader-${t}.jpg`, type: "jpeg", quality: 70 });
}
await browser.close();
