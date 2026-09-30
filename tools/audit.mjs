/*
  Automated accessibility and layout audit (Phase 4).
  For every page at 1440, 390 and 320 px wide it checks: target sizes, image
  alt text, heading order, duplicate ids, accessible names, form labels,
  text contrast against the resolved background, landmarks and horizontal
  overflow. Pages load with reduced motion so every element is in its final,
  fully visible state. Usage: node tools/audit.mjs
*/
import { launch } from "./browser.mjs";

const BASE = "http://localhost:3100";
const PAGES = ["/", "/calculator/", "/cash-injection/", "/sba-loans/", "/home-equity/", "/about/", "/contact/", "/apply/", "/terms/", "/privacy/"];
const WIDTHS = [
  [1440, 900],
  [390, 844],
  [320, 640],
];

function audit() {
  const out = { targets: [], alt: [], headings: [], ids: [], names: [], labels: [], contrast: [], structure: [], overflow: "" };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.closest("[hidden]");
  };
  const desc = (el) => {
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 36);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls} "${text}"`;
  };

  if (document.documentElement.lang !== "en-US") out.structure.push("html lang missing");
  if (document.querySelectorAll("main").length !== 1) out.structure.push("main landmark count != 1");
  if (!document.querySelector(".skip-link")) out.structure.push("no skip link");

  // Target size (WCAG 2.5.8 minimum 24px; 44px recommended)
  document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])").forEach((el) => {
    if (!visible(el) || el.matches(".sr-only, .skip-link")) return;
    const inlineLink = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li, dd");
    if (inlineLink) return;
    const r = (el.matches(".choice input") ? el.parentElement : el.matches(".check input") ? el.closest("label") : el).getBoundingClientRect();
    const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (r.width < 24 || r.height < 24) out.targets.push(`FAIL ${size} ${desc(el)}`);
    else if (r.height < 44) out.targets.push(`warn ${size} ${desc(el)}`);
  });

  document.querySelectorAll("img").forEach((img) => !img.hasAttribute("alt") && out.alt.push(desc(img)));

  const heads = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((h) => !h.closest("[hidden]"));
  const h1 = heads.filter((h) => h.tagName === "H1").length;
  if (h1 !== 1) out.headings.push(`h1 count ${h1}`);
  let prev = 0;
  heads.forEach((h) => {
    const level = Number(h.tagName[1]);
    if (prev && level > prev + 1) out.headings.push(`h${prev} → h${level} ${desc(h)}`);
    prev = level;
  });

  const seen = {};
  document.querySelectorAll("[id]").forEach((el) => (seen[el.id] = (seen[el.id] || 0) + 1));
  out.ids = Object.entries(seen).filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);

  document.querySelectorAll("a[href], button").forEach((el) => {
    const name = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
    if (!name) out.names.push(desc(el));
  });

  document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach((el) => {
    if (el.getAttribute("aria-hidden") === "true") return;
    const labelled = (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label") || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (!labelled) out.labels.push(desc(el));
  });

  // Contrast
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const background = (el) => {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let base = [10, 12, 11, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return base;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const done = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || done.has(el)) continue;
    done.add(el);
    if (!visible(el) || el.closest(".sr-only, noscript, script, style, .site-footer__wordmark, .microprint")) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    let opacity = 1;
    for (let a = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
    const bg = background(el);
    const text = blend([fg[0], fg[1], fg[2], fg[3] * opacity], bg);
    const l1 = lum(text);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.contrast.push(`${ratio.toFixed(2)} < ${need} ${desc(el)} (${cs.color}, ${size}px)`);
  }

  const sw = document.documentElement.scrollWidth;
  if (sw > innerWidth) out.overflow = `horizontal overflow: ${sw}px > ${innerWidth}px`;
  return out;
}

const browser = await launch();
const report = {};
try {
  for (const path of PAGES) {
    for (const [w, h] of WIDTHS) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, isMobile: w < 768, hasTouch: w < 768 });
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 700));
      const result = await page.evaluate(audit);
      await page.close();
      for (const [key, value] of Object.entries(result)) {
        const items = Array.isArray(value) ? value : value ? [value] : [];
        for (const item of items) {
          const bucket = ((report[path] ??= {})[key] ??= new Map());
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
