/*
  Local end-to-end checks for every lead-facing interactive flow.

  Run the mock server first:
    node serve.mjs 3200
    node tools/interact.mjs

  BASE_URL may point at another local port when 3200 is already occupied.
  Nothing here calls production: the script refuses any non-local base URL,
  and serve.mjs answers every /api/*.php request with tools/api-mock.mjs.
*/
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, watchCsp } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3200";
const parsedBase = new URL(BASE);
if (!["localhost", "127.0.0.1", "::1"].includes(parsedBase.hostname)) {
  throw new Error(`Refusing to test a non-local server: ${BASE}`);
}

const failures = [];
const browserErrors = [];
const check = (label, ok, detail = "") => {
  const line = `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`;
  console.log(line);
  if (!ok) failures.push(line);
};
const wait = (page, selector, options = {}) =>
  page.waitForSelector(selector, { visible: true, timeout: 10000, ...options });
const click = async (page, selector) => {
  await wait(page, selector);
  await page.$eval(selector, (element) => element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
  await new Promise((resolve) => setTimeout(resolve, 180));
  await page.$eval(selector, (element) => element.click());
};
const fill = async (page, selector, value) => {
  await wait(page, selector);
  await page.$eval(selector, (element) => {
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type(selector, value);
};
const fieldNamed = (message) =>
  Boolean(message) && !/please fill in (this field|the field)|check this field/i.test(message);

const browser = await launch();
const fixtureDir = mkdtempSync(join(tmpdir(), "tmfus-interact-"));
const statementPaths = Array.from({ length: 4 }, (_, index) => {
  const path = join(fixtureDir, `statement-${index + 1}.pdf`);
  writeFileSync(path, `%PDF-1.4\n% local test statement ${index + 1}\n%%EOF\n`);
  return path;
});
let pageSequence = 0;

const open = async (path, { keepCookieBanner = false, context = browser } = {}) => {
  const pageId = ++pageSequence;
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  if (!keepCookieBanner) {
    const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, gpc: false }));
    await page.setCookie({ name: "tmf_consent", value: consent, url: `${parsedBase.protocol}//${parsedBase.host}/` });
  }
  page.on("pageerror", (error) => browserErrors.push(`${path}#${pageId}: ${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`${path}: ${message.text()}`);
  });
  await watchCsp(page);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 60000 });
  return page;
};

async function testCalculator() {
  const page = await open("/funding-estimator");
  try {
    await click(page, "[data-calc-next]");
    const firstErrors = await page.$$eval(".calc .error:not([hidden])", (nodes) =>
      nodes.map((node) => node.textContent.trim()),
    );
    check("funding estimator blocks an empty first step", firstErrors.length === 2, firstErrors.join(" | "));
    check("funding estimator errors name what is missing", firstErrors.every(fieldNamed), firstErrors.join(" | "));

    await fill(page, "#calc-revenue", "45000");
    await click(page, 'input[name="credit"][value="650"]');
    await click(page, "[data-calc-next]");
    await click(page, 'input[name="industry"][value="restaurant"]');
    await click(page, 'input[name="tib"][value="2"]');
    await click(page, "[data-calc-next]");
    await click(page, 'input[name="positions"][value="0"]');
    await click(page, "[data-calc-next]");

    await fill(page, "#calc-first", "Jordan");
    await fill(page, "#calc-last", "Lee");
    await fill(page, "#calc-business", "Lee Freight LLC");
    await fill(page, "#calc-email", "not-an-email");
    await click(page, "[data-calc-next]");
    const badEmail = await page.$eval("#calc-email-err", (node) => node.textContent.trim());
    check("funding estimator rejects a bad email", badEmail === "Not a valid email address.", badEmail);
    await fill(page, "#calc-email", "jordan@example.com");
    await fill(page, "#calc-phone", "3055550188");
    await click(page, "[data-calc-next]");
    await page.waitForFunction(() => document.querySelector(".certificate")?.dataset.state === "result", { timeout: 10000 });
    const result = await page.$eval("[data-calc-status]", (node) => node.textContent.trim());
    check("funding estimator reaches a projected result", /Projected range/.test(result), result);
    check("funding estimator saves the estimate for Apply", await page.evaluate(() => Boolean(sessionStorage.getItem("tmf-estimate"))));
  } finally {
    await page.close();
  }
}

async function testApplication() {
  const page = await open("/apply");
  try {
    await click(page, '[data-pane="1"] [data-next]');
    const stepOneError = await page.$eval('[data-pane="1"] [data-err]', (node) => node.textContent.trim());
    check("application blocks an empty first step", Boolean(stepOneError), stepOneError);
    check("application validation names the missing field", fieldNamed(stepOneError), stepOneError);

    await fill(page, "#ap-legal", "Lee Freight LLC");
    await fill(page, "#ap-dba", "Lee Freight");
    await fill(page, "#ap-ein", "123456789");
    await fill(page, "#ap-start", "01152019");
    await fill(page, "#ap-baddr", "100 Main Street");
    await fill(page, "#ap-bcity", "Dallas");
    await page.select("#ap-bstate", "TX");
    await fill(page, "#ap-bzip", "75201");
    await page.select("#ap-industry", "Trucking / Transportation");
    await click(page, '[data-pane="1"] [data-next]');
    const stepOneState = await page.evaluate(() => ({
      active: document.querySelector('[data-pane="2"]')?.classList.contains("active"),
      error: document.querySelector('[data-pane="1"] [data-err]')?.textContent.trim(),
      values: Object.fromEntries([...document.querySelectorAll('[data-pane="1"] [data-field]')].map((node) => [node.id, node.value])),
    }));
    check(
      "application advances to owner details",
      stepOneState.active,
      stepOneState.active ? "" : `${stepOneState.error} ${JSON.stringify(stepOneState.values)}`,
    );
    if (!stepOneState.active) throw new Error(`Application step 1 did not advance: ${stepOneState.error}`);

    await fill(page, "#ap-oname", "Jordan Lee");
    await fill(page, "#ap-opct", "50");
    await fill(page, "#ap-oaddr", "100 Main Street");
    await fill(page, "#ap-ocity", "Dallas");
    await page.select("#ap-ostate", "TX");
    await fill(page, "#ap-ozip", "75201");
    await fill(page, "#ap-oemail", "jordan@example.com");
    await fill(page, "#ap-ophone", "3055550188");
    await fill(page, "#ap-amount", "150000");
    await fill(page, "#ap-odob", "04121979");
    await fill(page, "#ap-ossn", "123456789");
    await click(page, '[data-pane="2"] [data-next]');
    check("application advances to co-owner choice", await page.$eval('[data-pane="3"]', (node) => node.classList.contains("active")));

    await click(page, '[data-co="yes"]');
    check("application reveals co-owner fields", await page.$eval("[data-coowner-fields]", (node) => !node.hidden));
    await fill(page, "#ap-cname", "Taylor Lee");
    await fill(page, "#ap-cpct", "50");
    await fill(page, "#ap-caddr", "100 Main Street");
    await fill(page, "#ap-ccity", "Dallas");
    await page.select("#ap-cstate", "TX");
    await fill(page, "#ap-czip", "75201");
    await fill(page, "#ap-cdob", "06151980");
    await fill(page, "#ap-cssn", "987654321");
    await click(page, '[data-pane="3"] [data-next]');
    check("application advances to statements and consent", await page.$eval('[data-pane="4"]', (node) => node.classList.contains("active")));

    const picker = await page.$("[data-files]");
    await picker.uploadFile(...statementPaths);
    await page.waitForFunction(() => document.querySelectorAll("[data-file-list] li").length === 4);
    check("application accepts four local statement files", await page.$$eval("[data-file-list] li", (nodes) => nodes.length) === 4);
    await page.$$eval('[data-required-check]', (boxes) => boxes.forEach((box) => box.click()));

    const canvas = await page.$("[data-sig-pad]");
    await page.$eval("[data-sig-pad]", (element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await new Promise((resolve) => setTimeout(resolve, 180));
    const rect = await canvas.boundingBox();
    if (!rect) throw new Error("Signature canvas is not visible");
    await page.mouse.move(rect.x + 40, rect.y + rect.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.3, { steps: 8 });
    await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.7, { steps: 8 });
    await page.mouse.up();
    check("application records a drawn signature", await page.$eval(".sig-wrap", (node) => node.classList.contains("signed")));

    await click(page, "[data-submit]");
    await page.waitForFunction(() => document.querySelector('[data-step-label]')?.textContent.trim() === "Complete", { timeout: 15000 });
    const reference = await page.$eval("[data-reference]", (node) => node.textContent.trim());
    check("application receives a local mock reference", /^TMF-[A-F0-9]{6}$/.test(reference), reference);
    check("application shows its success pane", await page.$eval('[data-pane="done"]', (node) => node.classList.contains("active")));
  } finally {
    await page.close();
  }
}

async function testContact() {
  const page = await open("/contact");
  try {
    await click(page, '.contact__form [type="submit"]');
    const summary = await page.$$eval(".contact__form [data-error-summary] li", (nodes) =>
      nodes.map((node) => node.textContent.trim()),
    );
    check("contact form lists all empty required fields", summary.length === 4, summary.join(" | "));
    check("contact form errors name their fields", summary.every(fieldNamed), summary.join(" | "));

    await fill(page, "#c-first", "Jordan");
    await fill(page, "#c-last", "Lee");
    await fill(page, "#c-business", "Lee Freight LLC");
    await fill(page, "#c-email", "bad-address");
    await click(page, '.contact__form [type="submit"]');
    const badEmail = await page.$eval("#c-email-err", (node) => node.textContent.trim());
    check("contact form uses the approved bad-email wording", badEmail === "Not a valid email address.", badEmail);
    await fill(page, "#c-email", "jordan@example.com");
    await fill(page, "#c-message", "I would like to discuss funding options.");
    await click(page, '.contact__form [type="submit"]');
    await wait(page, "#contact-success");
    check("contact form shows success only after the local mock confirms", !(await page.$eval("#contact-success", (node) => node.hidden)));
  } finally {
    await page.close();
  }
}

async function testChat() {
  const page = await open("/");
  try {
    await wait(page, ".chat-launch:not([hidden])");
    await click(page, ".chat-launch");
    await page.waitForFunction(() => document.querySelector("[data-chat-panel]")?.classList.contains("open"));
    check("chat opens in the local mock's leave-a-message mode", await page.$eval("html", (node) => node.dataset.chatMode === "message"));
    await fill(page, "[data-chat-input]", "I have a funding question.");
    await click(page, "[data-chat-send]");
    await page.waitForFunction(() => [...document.querySelectorAll(".chat-msg")].some((node) => /Local mock/.test(node.textContent)), { timeout: 10000 });
    check("chat sends through the local mock", await page.$$eval(".chat-msg.me", (nodes) => nodes.some((node) => /funding question/.test(node.textContent))));
    await wait(page, "[data-chat-capture]");
    await fill(page, "[data-chat-name]", "Jordan Lee");
    await fill(page, "[data-chat-phone]", "3055550188");
    await click(page, "[data-chat-save]");
    await page.waitForFunction(() => [...document.querySelectorAll(".chat-msg.note")].some((node) => /Thank you/.test(node.textContent)));
    check("chat saves callback details through the local mock", true);
    await click(page, ".chat-close");
    check("chat closes and restores its launcher", await page.$eval(".chat-launch", (node) => !node.hidden));
  } finally {
    await page.close();
  }
}

async function testUnsubscribe() {
  const page = await open("/unsubscribe");
  try {
    await click(page, "#unsubBtn");
    const error = await page.$eval("#unsubMsg", (node) => node.textContent.trim());
    check("unsubscribe uses the approved bad-email wording", error === "Not a valid email address.", error);
    await fill(page, "#unsubEmail", "jordan@example.com");
    await click(page, "#unsubBtn");
    await page.waitForFunction(() => document.querySelector("#unsubMsg")?.classList.contains("ok"));
    const success = await page.$eval("#unsubMsg", (node) => node.textContent.trim());
    check("unsubscribe confirms the local mock accepted the request", /off the list/i.test(success), success);
  } finally {
    await page.close();
  }
}

async function testCookies() {
  const acceptContext = await browser.createBrowserContext();
  const page = await open("/", { keepCookieBanner: true, context: acceptContext });
  try {
    await wait(page, "[data-cookie-bar].open");
    await click(page, '[data-cookie="all"]');
    let consent = await page.evaluate(() => decodeURIComponent(document.cookie));
    check("cookie banner accepts all categories", /\"analytics\":true/.test(consent) && /\"marketing\":true/.test(consent), consent);

    await click(page, "[data-cookie-settings]");
    await wait(page, "[data-cookie-opts]");
    await page.$eval('[data-cookie-cat="analytics"]', (box) => { box.checked = false; });
    await page.$eval('[data-cookie-cat="marketing"]', (box) => { box.checked = false; });
    await click(page, '[data-cookie="save"]');
    consent = await page.evaluate(() => decodeURIComponent(document.cookie));
    check("cookie settings save chosen categories", /\"analytics\":false/.test(consent) && /\"marketing\":false/.test(consent), consent);

  } finally {
    await page.close();
    await acceptContext.close();
  }

  const rejectContext = await browser.createBrowserContext();
  const rejectPage = await open("/", { keepCookieBanner: true, context: rejectContext });
  try {
    await wait(rejectPage, "[data-cookie-bar].open");
    await click(rejectPage, '[data-cookie="essential"]');
    const consent = await rejectPage.evaluate(() => decodeURIComponent(document.cookie));
    check("cookie banner rejects non-essential categories", /\"analytics\":false/.test(consent) && /\"marketing\":false/.test(consent), consent);
  } finally {
    await rejectPage.close();
    await rejectContext.close();
  }
}

try {
  await testCalculator();
  await testApplication();
  await testContact();
  await testChat();
  await testUnsubscribe();
  await testCookies();
} finally {
  await browser.close();
  rmSync(fixtureDir, { recursive: true, force: true });
}

const uniqueBrowserErrors = [...new Set(browserErrors)];
check("browser console stays free of errors", uniqueBrowserErrors.length === 0, uniqueBrowserErrors.join(" | "));
if (failures.length) {
  console.error(`\n${failures.length} interaction check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll interaction checks passed.");
}
