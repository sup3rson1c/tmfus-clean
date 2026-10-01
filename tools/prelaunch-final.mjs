/* Final pre-launch browser checks, local-only.

   Run the mock server first:
     node serve.mjs 3200
     CHROME_PATH=/usr/bin/google-chrome node tools/prelaunch-final.mjs
*/
import { launch } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3200";
const parsedBase = new URL(BASE);
if (!["localhost", "127.0.0.1", "::1"].includes(parsedBase.hostname)) {
  throw new Error(`Refusing to test a non-local server: ${BASE}`);
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
  [1440, 900, "desktop"],
  [390, 844, "phone"],
];

const browser = await launch();
const failures = [];
const redirects = [
  ["/index", "/"],
  ["/home", "/"],
  ["/long-term-loans", "/sba-loans"],
  ["/calculator", "/funding-estimator"],
  ["/cash-injection", "/mca"],
  ["/home-equity", "/heloc-calculator"],
];

const check = (label, ok, detail = "") => {
  const line = `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`;
  console.log(line);
  if (!ok) failures.push(line);
};

const consoleErrors = [];
const consoleErrorUrls = [];
const newPage = async (width, height, extra = {}) => {
  const page = await browser.newPage();
  page.consoleErrors = [];
  page.on("pageerror", (error) => {
    const text = `pageerror: ${error.stack || error.message}`;
    consoleErrors.push(text);
    page.consoleErrors.push(text);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (text.includes("status of 404") && page.url().includes("/definitely-not-a-page")) return;
      consoleErrors.push(text);
      page.consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const text = `request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`;
    consoleErrors.push(text);
    consoleErrorUrls.push(request.url());
    page.consoleErrors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/definitely-not-a-page")) {
      const text = `HTTP ${response.status()} on ${response.url()}`;
      consoleErrors.push(text);
      consoleErrorUrls.push(response.url());
      page.consoleErrors.push(text);
    }
  });
  return page;
};

const click = async (page, selector) => {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.$eval(selector, (element) => element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
  await new Promise((resolve) => setTimeout(resolve, 180));
  await page.$eval(selector, (element) => element.click());
};

const fill = async (page, selector, value) => {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.$eval(selector, (element) => {
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type(selector, value);
};

try {
  for (const path of PAGES) {
    for (const [width, height, label] of WIDTHS) {
      const page = await newPage(width, height);
      const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 60000 });
      check(`page ${path} loads at ${label}`, !!response && (response.ok() || response.status() === 404), `HTTP ${response?.status()}`);
      const metrics = await page.evaluate(() => ({
        title: document.title,
        h1s: document.querySelectorAll("h1").length,
        overflow: document.documentElement.scrollWidth > innerWidth ? `${document.documentElement.scrollWidth}px > ${innerWidth}px` : "",
      }));
      check(`page ${path} renders a title at ${label}`, Boolean(metrics.title), metrics.title);
      check(`page ${path} has no horizontal overflow at ${label}`, !metrics.overflow, metrics.overflow);
      await page.close();
    }
  }

  for (const [from, expected] of redirects) {
    const page = await newPage(1440, 900);
    const response = await page.goto(`${BASE}${from}`, { waitUntil: "networkidle0", timeout: 60000 });
    check(`redirect ${from} reaches ${expected}`, new URL(page.url()).pathname === expected, `${response?.status()} -> ${page.url()}`);
    await page.close();
  }

  const adminResponse = await fetch(`${BASE}/admin`, { redirect: "manual" });
  check("redirect /admin answers 301 to /admin.php", adminResponse.status === 301 && adminResponse.headers.get("location") === "/admin.php", `HTTP ${adminResponse.status} -> ${adminResponse.headers.get("location")}`);

  const notFound = await newPage(1440, 900);
  const notFoundResponse = await notFound.goto(`${BASE}/definitely-not-a-page`, { waitUntil: "networkidle0", timeout: 60000 });
  const notFoundTitle = await notFound.evaluate(() => document.title);
  const notFoundLinks = await notFound.$$eval("a", (nodes) => nodes.map((node) => node.textContent.trim()).join(" | "));
  const notFoundConsoleErrors = notFound.consoleErrors.filter((text) => !text.includes("/definitely-not-a-page"));
  check("missing page returns the friendly 404", notFoundResponse?.status() === 404, `HTTP ${notFoundResponse?.status()}`);
  check("friendly 404 shows useful links", /Apply/.test(notFoundLinks) && /Contact/.test(notFoundLinks), `${notFoundTitle}; ${notFoundLinks}`);
  check("friendly 404 has no unexpected console errors", notFoundConsoleErrors.length === 0, notFoundConsoleErrors.join(" | "));
  await notFound.close();

  const optout = await newPage(1440, 900);
  await optout.goto(`${BASE}/privacy`, { waitUntil: "networkidle0", timeout: 60000 });
  await click(optout, "[data-optout-form] button[type='submit']");
  const optoutErr = await optout.$eval("[data-optout-form] [data-err]", (node) => node.textContent.trim());
  check("privacy opt-out rejects a bad email", optoutErr === "Not a valid email address.", optoutErr);
  await fill(optout, "#oo-email", "jordan@example.com");
  await fill(optout, "#oo-phone", "3055550188");
  await fill(optout, "#oo-business", "Lee Freight LLC");
  await click(optout, "[data-optout-form] button[type='submit']");
  await optout.waitForFunction(() => !document.querySelector("[data-optout-done]")?.hidden, { timeout: 10000 });
  const consent = await optout.evaluate(() => decodeURIComponent(document.cookie));
  check("privacy opt-out confirms after local mock", await optout.$eval("[data-optout-done]", (node) => node.textContent.includes("Request received.")));
  check("privacy opt-out switches analytics/marketing off", /"analytics":false/.test(consent) && /"marketing":false/.test(consent), consent);
  await optout.close();

  const heloc = await newPage(1440, 900);
  await heloc.goto(`${BASE}/heloc-calculator`, { waitUntil: "networkidle0", timeout: 60000 });
  const helocText = await heloc.evaluate(() => document.body.innerText);
  check("HELOC calculator is intentionally off and routes to /apply", /instant estimator is being rebuilt/i.test(helocText) && /Start my application/i.test(helocText), "handoff copy present");
  await heloc.close();

  const applyIntent = await newPage(1440, 900);
  await applyIntent.goto(`${BASE}/apply?product=heloc`, { waitUntil: "networkidle0", timeout: 60000 });
  const productField = await applyIntent.evaluate(() => {
    const el = document.querySelector('[data-field="product"]');
    return el ? { tag: el.tagName, value: el.value, editable: !el.disabled } : null;
  });
  check("apply keeps editable product intent from the HELOC CTA", productField?.value === "HELOC" && productField.editable, JSON.stringify(productField));
  await applyIntent.close();
} finally {
  await browser.close();
}

const uniqueConsoleErrors = [...new Set(consoleErrors)];
check("console stays free of errors", uniqueConsoleErrors.length === 0, uniqueConsoleErrors.join(" | "));
if (failures.length) {
  console.error(`\n${failures.length} pre-launch check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll final pre-launch checks passed.");
}
