/*
  Static site builder. Usage: node build.mjs

  Pages live in src/pages/<slug>.html and start with a meta comment:
    <!--meta {"title": "...", "description": "...", "nav": "calculator", "scripts": ["calculator"]} -->
  home.html builds to /index.html, every other slug to /<slug>.html, which
  the live .htaccess serves at the clean URL /<slug> (same URLs as the old
  site, so inbound links, the sitemap and emailed unsubscribe links survive).

  Every /assets/css|js reference gets ?v=<content hash> appended, so a changed
  file is always refetched. Nobody has to remember to bump a version number.

  {{> name}} includes src/partials/name.html (recursively), {{key}} is replaced
  with a meta value. CSS files in src/css are concatenated, in filename order,
  into assets/css/site.css. JS is authored directly in assets/js.
*/
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const SOLUTIONS = ["mca", "sba-loans", "heloc-calculator"];

const read = (p) => readFileSync(p, "utf8");

function include(html, depth = 0) {
  if (depth > 8) throw new Error("partial include depth exceeded");
  return html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    const file = join(SRC, "partials", `${name}.html`);
    if (!existsSync(file)) throw new Error(`missing partial: ${name}`);
    return include(read(file), depth + 1);
  });
}

// Stylesheet
const cssDir = join(SRC, "css");
const css = readdirSync(cssDir)
  .filter((f) => f.endsWith(".css"))
  .sort()
  .map((f) => `/* ${f} */\n${read(join(cssDir, f))}`)
  .join("\n");
mkdirSync(join(ROOT, "assets", "css"), { recursive: true });
writeFileSync(join(ROOT, "assets", "css", "site.css"), css);
console.log(`built /assets/css/site.css (${(css.length / 1024).toFixed(1)} KB)`);

// Cache busting: ?v=<first 10 hex of the file's sha1>
const hashes = new Map();
function bust(html) {
  return html.replace(/(["'])(\/assets\/(?:css|js)\/[\w.-]+\.(?:css|js))\1/g, (all, q, url) => {
    if (!hashes.has(url)) {
      const file = join(ROOT, url.slice(1));
      hashes.set(url, existsSync(file) ? createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 10) : "");
    }
    const h = hashes.get(url);
    return h ? `${q}${url}?v=${h}${q}` : all;
  });
}

/* Structured data, as the live site's seo-inject.py produced it: the
   organization and website on every page, the page itself, and an FAQPage
   built from the page's own accordion. Built from the rendered questions, so
   the schema can never say something the page does not. No telephone or
   address: there is no published one yet, and invented NAP data spreads. */
const SITE = "https://tmfus.com";
const text = (h) =>
  h.replace(/<span class="accordion__icon"[^>]*><\/span>/g, "").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&rsquo;|&#39;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function schema(html, v) {
  const url = SITE + v.canonical;
  const graph = [
    {
      "@type": ["Organization", "FinancialService"],
      "@id": `${SITE}/#organization`,
      name: "TMF Team",
      url: `${SITE}/`,
      logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-mark-512.png`, width: 512, height: 512 },
      description: "TMF Team is a US business funding brokerage. It matches business owners to merchant cash advances, SBA 7(a) and 504 loans, and home equity lines of credit, and manages the application end to end.",
      areaServed: { "@type": "Country", name: "United States" },
      serviceType: ["Business funding brokerage", "Merchant cash advance", "SBA loan brokerage", "HELOC brokerage"],
    },
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "TMF Team", publisher: { "@id": `${SITE}/#organization` }, inLanguage: "en-US" },
    { "@type": "WebPage", "@id": `${url}#webpage`, url, name: v.title, description: v.description, isPartOf: { "@id": `${SITE}/#website` }, inLanguage: "en-US" },
  ];
  const qa = [...html.matchAll(/<button class="accordion__trigger"[^>]*>([\s\S]*?)<\/button>[\s\S]*?<div class="accordion__panel"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(([, q, a]) => ({ "@type": "Question", name: text(q), acceptedAnswer: { "@type": "Answer", text: text(a) } }));
  if (qa.length && !/noindex/.test(v.robots)) graph.push({ "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: qa });
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;
}

// Pages
const pagesDir = join(SRC, "pages");
for (const file of readdirSync(pagesDir).filter((f) => f.endsWith(".html"))) {
  const raw = read(join(pagesDir, file));
  const m = /^<!--meta\s+(\{[\s\S]*?\})\s*-->\s*/.exec(raw);
  if (!m) throw new Error(`${file}: missing meta comment`);

  const meta = JSON.parse(m[1]);
  const slug = file.replace(/\.html$/, "");
  const scripts = (meta.scripts ?? [])
    .map((s) => `<script src="/assets/js/${s}.js" defer></script>`)
    .join("\n  ");
  const vars = {
    bodyClass: "",
    robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    ...meta,
    slug,
    scripts,
    canonical: slug === "home" ? "/" : `/${slug}`,
  };

  let html = include(read(join(SRC, "partials", "layout.html"))).replace(
    "{{content}}",
    () => include(raw.slice(m[0].length)),
  );
  html = html.replace(/\{\{(\w+)\}\}/g, (all, key) => (key in vars ? String(vars[key]) : all));

  if (meta.nav) {
    html = html.replaceAll(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
    if (SOLUTIONS.includes(meta.nav)) {
      html = html.replace('data-nav-group="solutions"', 'data-nav-group="solutions" data-active');
    }
  }

  const leftover = html.match(/\{\{[^}]*\}\}/g);
  if (leftover) console.warn(`  ! ${file}: unresolved ${[...new Set(leftover)].join(", ")}`);

  html = bust(html);
  html = html.replace("</head>", () => `${schema(html, vars)}\n</head>`);
  const out = slug === "home" ? join(ROOT, "index.html") : join(ROOT, `${slug}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`built ${out.slice(ROOT.length).replaceAll("\\", "/")}`);
}
