/*
  Automated accessibility and layout audit using axe-core.

  Scans every page at 1440px and 390px wide for WCAG 2.1 A/AA violations
  and horizontal overflow. Pages load with reduced motion so every element
  is in its final, fully visible state.

  Run the mock server first:
    node serve.mjs 3200
    node tools/audit.mjs
*/
import { launch, watchCsp } from "./browser.mjs";
import axe from "axe-core";

const PORT = process.env.PORT || "3200";
const BASE = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");

const parsedBase = new URL(BASE);
if (!["localhost", "127.0.0.1", "::1"].includes(parsedBase.hostname)) {
  throw new Error(`Refusing to test a non-local server: ${BASE}`);
}
if (["3300", "3301"].includes(parsedBase.port)) {
  throw new Error(`Port ${parsedBase.port} is reserved and must not be used.`);
}

const PAGES = [
  "/",
  "/funding-estimator",
  "/mca",
  "/sba-loans",
  "/heloc-calculator",
  "/apply",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/unsubscribe",
  "/404",
];

const WIDTHS = [
  [1440, 900],
  [390, 844],
];

try {
  const res = await fetch(BASE + "/");
  if (!res.ok && res.status !== 404) {
    throw new Error(`Server returned HTTP ${res.status}`);
  }
} catch (err) {
  console.error(`Cannot connect to local server at ${BASE}. Start it first with: node serve.mjs ${parsedBase.port || 3200}`);
  process.exit(1);
}

const browser = await launch();
const report = {};

try {
  for (const path of PAGES) {
    for (const [w, h] of WIDTHS) {
      const page = await browser.newPage();
      const csp = [];
      await watchCsp(page);
      // " at pptr:" is code this script injected (axe fetches stylesheets to
      // read them), not the site; a visitor's browser never runs it.
      page.on("console", (m) => { if (m.text().startsWith("CSP ") && !m.text().includes(" at pptr:")) csp.push(m.text()); });
      await page.setViewport({ width: w, height: h, isMobile: w < 768, hasTouch: w < 768 });
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 600));

      const overflow = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        return sw > innerWidth ? `horizontal overflow: ${sw}px > ${innerWidth}px` : "";
      });

      await page.evaluate(axe.source);
      const { violations } = await page.evaluate(async () => {
        return await axe.run({
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
          },
        });
      });

      await page.close();

      for (const item of new Set(csp)) {
        const bucket = ((report[path] ??= {})["csp"] ??= new Map());
        bucket.set(item, [...(bucket.get(item) ?? []), w]);
      }

      if (overflow) {
        const bucket = ((report[path] ??= {})["overflow"] ??= new Map());
        bucket.set(overflow, [...(bucket.get(overflow) ?? []), w]);
      }

      for (const v of violations) {
        for (const node of v.nodes) {
          const target = Array.isArray(node.target) ? node.target.join(" ") : String(node.target);
          const item = `[${v.impact}] ${v.help} (${target})`;
          const bucket = ((report[path] ??= {})[v.id] ??= new Map());
          bucket.set(item, [...(bucket.get(item) ?? []), w]);
        }
      }
    }
  }
} finally {
  await browser.close();
}

let total = 0;
for (const [path, groups] of Object.entries(report)) {
  console.log(`\n=== ${path}`);
  for (const [key, items] of Object.entries(groups)) {
    console.log(`  [${key}]`);
    for (const [item, widths] of items) {
      total += item.startsWith("warn") ? 0 : 1;
      console.log(`    ${item}  @${widths.join("/")}`);
    }
  }
}

console.log(`\n${total} issue(s) (warnings excluded)`);
if (total === 0) {
  console.log("✓ All pages passed axe-core accessibility audit at 1440px and 390px.");
}
process.exitCode = total > 0 ? 1 : 0;
