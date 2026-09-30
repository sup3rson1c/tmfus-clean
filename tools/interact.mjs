/*
  Interaction checks: menus, accordion, calculator flow, form validation,
  mobile menu, the engraving clock control, the CTA estimate line and
  reduced motion. Prints PASS/FAIL lines and saves
  "temporary screenshots/ix-<name>.jpg" for the visual states.
  Usage: node tools/interact.mjs
*/
import { launch } from "./browser.mjs";

const BASE = "http://localhost:3100";
const OUT = "temporary screenshots";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const browser = await launch();
const open = async (path, w = 1440, h = 900, reduced = false) => {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: w < 768, hasTouch: w < 768 });
  if (reduced) await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  p.on("pageerror", (e) => errors.push(`${path}: ${e}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
  await p.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(1400);
  return p;
};
const shot = (p, name, clip) =>
  p.screenshot({ path: `${OUT}/ix-${name}.jpg`, type: "jpeg", quality: 80, ...(clip ? { clip } : {}) });
const hidden = (p, sel) => p.$eval(sel, (el) => el.hidden);
const hour = (p) => p.$eval("[data-clock-handle]", (h) => Number(h.getAttribute("aria-valuenow")));

try {
  /* Solutions menu: hover, keyboard, Escape */
  let p = await open("/");
  check("motion system initialised (html.motion-live, html.sc-ready)", await p.evaluate(() => ["motion-live", "sc-ready"].every((c) => document.documentElement.classList.contains(c))));
  await p.hover("[data-menu-button]");
  await sleep(450);
  check("menu opens on hover", !(await hidden(p, "#solutions-menu")));
  await shot(p, "menu", { x: 380, y: 0, width: 680, height: 460 });
  await p.mouse.move(20, 700);
  await sleep(600);
  check("menu closes when pointer leaves", await hidden(p, "#solutions-menu"));
  await p.focus("[data-menu-button]");
  await p.keyboard.press("Enter");
  await sleep(250);
  check("menu opens with keyboard", !(await hidden(p, "#solutions-menu")));
  await p.keyboard.press("Tab");
  check("Tab moves into the menu", await p.evaluate(() => !!document.activeElement.closest("#solutions-menu")));
  await p.keyboard.press("Escape");
  await sleep(200);
  check(
    "Escape closes menu and returns focus",
    await p.evaluate(() => document.getElementById("solutions-menu").hidden && document.activeElement.matches("[data-menu-button]")),
  );

  /* Accordion */
  await p.click("#faq-1-btn");
  await sleep(350);
  check("FAQ item expands", !(await hidden(p, "#faq-1")) && (await p.$eval("#faq-1-btn", (b) => b.getAttribute("aria-expanded"))) === "true");
  await p.close();

  /* Engraving clock: the hand is a slider, and scroll stays the source of truth */
  p = await open("/");
  const hoursTop = await p.evaluate(() => document.querySelector("[data-clock]").getBoundingClientRect().top + scrollY);
  await p.evaluate((y) => window.scrollTo(0, y + 20), hoursTop);
  await sleep(1000);
  check("clock greets at hour 0 when the section pins", (await hour(p)) === 0, String(await hour(p)));
  await p.focus("[data-clock-handle]");
  await p.keyboard.press("End");
  await sleep(1600);
  check("End winds the clock to hour 48", (await hour(p)) === 48, String(await hour(p)));
  check("the control scrolled the page with it", await p.evaluate((y) => scrollY > y + 1000, hoursTop));
  await p.keyboard.press("Home");
  await sleep(1600);
  check("Home returns to hour 0", (await hour(p)) === 0, String(await hour(p)));
  for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowRight");
  await sleep(1300);
  check("arrow keys step one hour at a time", (await hour(p)) === 3, String(await hour(p)));
  check(
    "slider publishes readable value text",
    /^Hour \d+ of 48: /.test(await p.$eval("[data-clock-handle]", (h) => h.getAttribute("aria-valuetext"))),
  );
  check(
    "focused handle stays visible in the pinned stage",
    await p.evaluate(() => {
      const r = document.querySelector("[data-clock-handle]").getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
  );
  await p.click('[data-clock-jump="36"]');
  await sleep(1700);
  const h36 = await hour(p);
  check("jump button sets the funding window", h36 >= 35 && h36 <= 37, String(h36));
  const dial = await p.$eval("[data-clock-dial]", (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width };
  });
  await p.mouse.click(dial.x + dial.w * (0.5 + 0.372 * 0.85), dial.y + dial.w * 0.5);
  await sleep(1700);
  const h12 = await hour(p);
  check("clicking the ring jumps to that hour", h12 >= 11 && h12 <= 13, String(h12));
  await shot(p, "clock");
  await p.close();

  /* Calculator */
  p = await open("/calculator/");
  await p.click("[data-calc-next]");
  await sleep(350);
  const calcErrors = await p.$$eval(".calc .error:not([hidden])", (els) => els.map((e) => e.textContent));
  check("calculator shows step errors", calcErrors.length === 2, calcErrors.join(" | "));
  check("focus moves to first invalid field", await p.evaluate(() => document.activeElement.id === "calc-revenue"));
  await p.evaluate(() => window.scrollTo(0, document.querySelector(".calc").getBoundingClientRect().top + scrollY - 90));
  await sleep(900);
  await shot(p, "calc-errors");
  await p.type("#calc-revenue", "45000");
  check("revenue formats with commas", (await p.$eval("#calc-revenue", (i) => i.value)) === "45,000");
  await p.click('input[name="credit"][value="650-699"]');
  await p.click("[data-calc-next]");
  await sleep(700);
  await p.click('input[name="industry"][value="restaurant"]');
  await p.click('input[name="time"][value="2-5y"]');
  await p.click("[data-calc-next]");
  await sleep(700);
  await p.click('input[name="positions"][value="1"]');
  await sleep(150);
  check("balance field appears for open positions", !(await hidden(p, "[data-balance]")));
  await p.type("#calc-balance", "12000");
  await p.click("[data-calc-next]");
  await sleep(1500);
  const status = await p.$eval("[data-calc-status]", (el) => el.textContent);
  check("result announced in status region", /Illustrative range/.test(status), status);
  check("certificate shows result state", (await p.$eval(".certificate", (c) => c.dataset.state)) === "result");
  check("range figures read as plain text for assistive tech", /^\$[\d,]+$/.test(await p.$eval("[data-low]", (el) => el.textContent.trim())), await p.$eval("[data-low]", (el) => el.textContent.trim()));
  check("estimate saved for Apply", await p.evaluate(() => !!sessionStorage.getItem("tmf-estimate")));
  await p.evaluate(() => window.scrollTo(0, document.querySelector(".calc").getBoundingClientRect().top + scrollY - 90));
  await sleep(900);
  await shot(p, "calc-result");
  await p.$eval("#calc-balance", (i) => {
    i.value = "";
  });
  await p.type("#calc-balance", "90000");
  await sleep(600);
  check("over-leveraged state updates live", (await p.$eval(".certificate", (c) => c.dataset.state)) === "over");
  await shot(p, "calc-over");

  /* Apply, in the same tab so sessionStorage carries over like a real visit */
  await p.goto(`${BASE}/apply/?from=calculator`, { waitUntil: "networkidle0" });
  await sleep(1200);
  check("calculator estimate carried into Apply", !(await hidden(p, "[data-estimate-note]")));
  check("industry prefilled from calculator", (await p.$eval("#a-industry", (s) => s.value)) === "Restaurant");
  await p.click("[data-apply-next]");
  await sleep(400);
  const applyErrors = await p.$$eval("[data-error-summary] li", (els) => els.length);
  check("apply step 1 validation lists problems", applyErrors >= 7, `${applyErrors} problems`);
  await shot(p, "apply-errors");
  await p.type("#a-legal", "Lee Freight LLC");
  await p.type("#a-dba", "Lee Freight");
  await p.type("#a-ein", "12-3456789");
  await p.type("#a-start", "01152019");
  check("date input accepts typed date", (await p.$eval("#a-start", (i) => i.value)) === "2019-01-15", await p.$eval("#a-start", (i) => i.value));
  await p.type("#a-address", "100 Main St");
  await p.type("#a-city", "Dallas");
  await p.select("#a-state", "TX");
  await p.type("#a-zip", "75201");
  await p.select("#a-industry", "Trucking");
  await p.click("[data-apply-next]");
  await sleep(900);
  check("apply advances to step 2", !(await hidden(p, '[data-step="2"]')));
  check("apply draft autosaves", await p.evaluate(() => JSON.parse(sessionStorage.getItem("tmf-apply-draft") || "{}").legalName === "Lee Freight LLC"));

  /* Final CTA: the visitor's own estimate waits beside the buttons */
  await p.goto(`${BASE}/about/`, { waitUntil: "networkidle0" });
  check("estimate line stays hidden when balances come first", await hidden(p, "[data-cta-estimate]"));
  await p.evaluate(() => sessionStorage.setItem("tmf-estimate", JSON.stringify({ low: 85000, high: 115000, over: false })));
  await p.reload({ waitUntil: "networkidle0" });
  const line = await p.$eval("[data-cta-estimate]", (el) => (el.hidden ? "" : el.textContent));
  check("CTA shows the visitor's estimate", line.includes("$85,000–$115,000"), line);
  await p.close();

  /* Contact form */
  p = await open("/contact/");
  await p.click('.contact__form [type="submit"]');
  await sleep(400);
  check("contact error summary appears", !(await hidden(p, ".contact__form [data-error-summary]")));
  check("focus moves to error summary", await p.evaluate(() => document.activeElement.matches("[data-error-summary]")));
  await shot(p, "contact-errors");
  await p.type("#c-first", "Jordan");
  await p.type("#c-last", "Lee");
  await p.type("#c-business", "Lee Freight LLC");
  await p.type("#c-email", "jordan@example.com");
  await p.click('.contact__form [type="submit"]');
  await sleep(1500);
  check("contact success state shows", !(await hidden(p, "#contact-success")));
  await shot(p, "contact-success");
  await p.close();

  /* Mobile menu */
  p = await open("/", 390, 844);
  await p.click("[data-mobile-toggle]");
  await sleep(400);
  check("mobile menu opens", !(await hidden(p, "#mobile-menu")));
  check("focus moves into mobile menu", await p.evaluate(() => !!document.activeElement.closest("#mobile-menu")));
  await shot(p, "mobile-menu");
  await p.keyboard.press("Escape");
  await sleep(250);
  check("Escape closes mobile menu", await hidden(p, "#mobile-menu"));
  await p.close();

  /* Reduced motion */
  p = await open("/", 1440, 900, true);
  check("hero visible with reduced motion", (await p.$eval(".hero__title", (h) => getComputedStyle(h).opacity)) === "1");
  check("reduced motion: no pinned travel on the hero or the clock", await p.evaluate(() => document.querySelector("[data-hero]").offsetHeight <= innerHeight * 1.05 && document.querySelector("[data-clock]").offsetHeight < innerHeight * 2.2));
  check("reduced motion: the clock rests complete at hour 48", (await hour(p)) === 48, String(await hour(p)));
  await p.focus("[data-clock-handle]");
  await p.keyboard.press("Home");
  await sleep(300);
  check("reduced motion: the slider still works without scroll travel", (await hour(p)) === 0, String(await hour(p)));
  check("reduced motion: no view transitions", await p.evaluate(() => !CSS.supports("selector(::view-transition)") || matchMedia("(prefers-reduced-motion: reduce)").matches));
  await p.close();
} finally {
  await browser.close();
}
console.log(errors.length ? `console errors:\n  ${[...new Set(errors)].join("\n  ")}` : "no console errors");
console.log(failures ? `${failures} check(s) failed` : "all checks passed");
