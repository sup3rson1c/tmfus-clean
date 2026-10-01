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
  into assets/css/site.css, comments stripped (see slim()). JS is authored
  directly in assets/js.
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

/* Strip comments and indentation from the built stylesheet (issue #23, page
   weight: about a quarter of site.css was notes for the next developer). The
   notes stay in src/css, which is what anyone edits. Deliberately not a real
   minifier: line breaks stay, one rule per line as written, so `grep ^.foo`
   still works and a declaration's value is never touched. Quoted strings are
   copied verbatim, so a "/*" inside content: or a data: URI survives. */
function slim(text) {
  let out = "";
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("unterminated CSS comment");
      // a/**/b must not become ab
      if (/\S/.test(out.slice(-1)) && /\S/.test(text[end + 2] ?? "")) out += " ";
      i = end + 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n") + "\n";
}

// Stylesheet
const cssDir = join(SRC, "css");
const css = slim(
  readdirSync(cssDir)
    .filter((f) => f.endsWith(".css"))
    .sort()
    .map((f) => read(join(cssDir, f)))
    .join("\n")
);
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

/* Structured data, migrated from the live site's seo-inject.py. Keep it in
   this builder so page content, metadata and schema are generated together.
   No telephone or address is emitted: llms.txt says TMF has not published
   either, and inventing or guessing NAP data would be worse than omitting it. */
const SITE = "https://tmfus.com";
const DATE_PUBLISHED = "2026-08-20";
const DATE_MODIFIED = "2026-09-30";
const CRUMBS = {
  about: "About",
  contact: "Contact",
  apply: "Apply",
  "funding-estimator": "Cash injection calculator",
  "heloc-calculator": "Home equity",
  "sba-loans": "SBA loans",
  mca: "Merchant cash advance",
  terms: "Terms of Use",
  privacy: "Privacy Policy",
};
const SERVICES = {
  mca: ["Merchant Cash Advance", "Revenue-based business funding from $5K to $2M with remittances aligned to card and bank receipts."],
  "sba-loans": ["SBA 7(a) and 504 Loans", "SBA-guaranteed business lending: 7(a) for working capital and acquisitions, 504 for property and long-life equipment financing."],
  "heloc-calculator": ["Home Equity Line of Credit", "A line secured against home equity for business owners, up to $750K, valued without an appraisal appointment."],
  "funding-estimator": ["Business Funding Estimate", "A four-step estimate of the cash injection a business may qualify for, based on revenue, time in business and credit."],
};
const LOAN_PRODUCTS = {
  mca: {
    name: "Merchant Cash Advance",
    description: "A purchase of future receivables rather than a loan. Repaid as an agreed share of card and bank receipts instead of a fixed monthly instalment.",
    minValue: 5000,
    maxValue: 2000000,
  },
  "sba-loans": {
    name: "SBA 7(a) and 504 Loans",
    description: "Government-guaranteed business lending arranged through SBA lenders. 7(a) for working capital, acquisitions and mixed purposes; 504 for commercial property and long-life equipment.",
    maxValue: 5500000,
  },
  "heloc-calculator": {
    name: "Home Equity Line of Credit",
    description: "A revolving line secured against the equity in a home, for business owners who would rather use personal equity than business credit.",
    minValue: 25000,
    maxValue: 750000,
  },
};
const HOW_TO = {
  name: "How to apply for business funding with TMF Team",
  description: "The TMF Team application is four steps and takes about ten minutes. An advisor reviews the file, usually within 3 to 24 hours.",
  totalTime: "PT10M",
  supply: [
    "Business legal name, EIN and business start date",
    "Owner name, home address, date of birth and Social Security number",
    "Ownership percentages for every owner",
    "Four months of business bank statements",
  ],
  steps: [
    ["Business details", "Enter the business legal name, DBA, EIN, address, start date and industry."],
    ["Owner details", "Enter the owner name, home address, ownership percentage, email, phone, date of birth and Social Security number. Sensitive details are encrypted as soon as they reach us and are never stored in plain text."],
    ["Co-owner details", "Add a second owner if anyone else holds a share of the business. Ownership across all owners cannot exceed 100 percent."],
    ["Statements and consent", "Attach four months of business bank statements, read the authorization, tick both boxes and sign in the box. Submit, and a reference number comes back straight away."],
  ],
};
const SITEMAP = [
  ["/", "1.0", "weekly"],
  ["/sba-loans", "0.9", "monthly"],
  ["/mca", "0.9", "monthly"],
  ["/heloc-calculator", "0.9", "monthly"],
  ["/funding-estimator", "0.9", "monthly"],
  ["/apply", "0.8", "monthly"],
  ["/about", "0.6", "yearly"],
  ["/contact", "0.6", "yearly"],
  ["/terms", "0.3", "yearly"],
  ["/privacy", "0.3", "yearly"],
];
const text = (h) =>
  h.replace(/<span class="accordion__icon"[^>]*><\/span>/g, "").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&rsquo;|&#39;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function schema(html, v) {
  const url = SITE + v.canonical;
  const indexable = !/noindex/.test(v.robots);
  const pageType = v.slug === "about" ? "AboutPage" : v.slug === "contact" ? "ContactPage" : "WebPage";
  const graph = [
    {
      "@type": ["Organization", "FinancialService"],
      "@id": `${SITE}/#organization`,
      name: "TMF Team",
      alternateName: "TMF Team Capital Strategy",
      url: `${SITE}/`,
      logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-mark-512.png`, width: 512, height: 512 },
      description: "TMF Team is a US business funding brokerage. It matches business owners to merchant cash advances, SBA 7(a) and 504 loans, equipment financing, and home equity lines of credit, and manages the application end to end.",
      areaServed: { "@type": "Country", name: "United States" },
      knowsAbout: ["merchant cash advance", "SBA 7(a) loans", "SBA 504 loans", "home equity line of credit", "equipment financing", "small business working capital", "revenue-based financing"],
      serviceType: ["Business funding brokerage", "Merchant cash advance", "SBA loan brokerage", "Equipment financing", "HELOC brokerage"],
    },
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "TMF Team", publisher: { "@id": `${SITE}/#organization` }, inLanguage: "en-US" },
    {
      "@type": pageType,
      "@id": `${url}#webpage`,
      url,
      name: v.title,
      description: v.description,
      isPartOf: { "@id": `${SITE}/#website` },
      about: { "@id": `${SITE}/#organization` },
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      inLanguage: "en-US",
      ...(v.canonical !== "/" && indexable ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    },
  ];
  if (v.canonical !== "/" && indexable) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: CRUMBS[v.slug] ?? v.title, item: url },
      ],
    });
  }
  if (SERVICES[v.slug]) {
    const [name, description] = SERVICES[v.slug];
    graph.push({ "@type": "Service", name, description, provider: { "@id": `${SITE}/#organization` }, areaServed: { "@type": "Country", name: "United States" }, url });
  }
  if (LOAN_PRODUCTS[v.slug]) {
    const p = LOAN_PRODUCTS[v.slug];
    graph.push({
      "@type": "LoanOrCredit",
      "@id": `${url}#product`,
      name: p.name,
      description: p.description,
      provider: { "@id": `${SITE}/#organization` },
      areaServed: { "@type": "Country", name: "United States" },
      url,
      amount: { "@type": "MonetaryAmount", currency: "USD", minValue: p.minValue, maxValue: p.maxValue },
    });
  }
  if (v.slug === "apply") {
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: HOW_TO.name,
      description: HOW_TO.description,
      totalTime: HOW_TO.totalTime,
      supply: HOW_TO.supply.map((name) => ({ "@type": "HowToSupply", name })),
      step: HOW_TO.steps.map(([name, stepText], i) => ({ "@type": "HowToStep", position: i + 1, name, text: stepText })),
    });
  }
  const qa = [...html.matchAll(/<button class="accordion__trigger"[^>]*>([\s\S]*?)<\/button>[\s\S]*?<div class="accordion__panel"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(([, q, a]) => ({ "@type": "Question", name: text(q), acceptedAnswer: { "@type": "Answer", text: text(a) } }));
  if (qa.length && indexable) graph.push({ "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: qa });
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
    modelLink: "/about",
    modelLinkText: "Learn about TMF Team",
    ...meta,
    slug,
    scripts,
    canonical: slug === "home" ? "/" : `/${slug}`,
    ogType: slug === "home" ? "website" : "article",
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

const sitemapRows = SITEMAP.map(([path, priority, changefreq]) => [
  "  <url>",
  `    <loc>${SITE}${path}</loc>`,
  `    <lastmod>${DATE_MODIFIED}</lastmod>`,
  `    <changefreq>${changefreq}</changefreq>`,
  `    <priority>${priority}</priority>`,
  "  </url>",
].join("\n")).join("\n");
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  "<!-- Generated by build.mjs. Edit SITEMAP there, not this file. -->",
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  sitemapRows,
  "</urlset>",
  "",
].join("\n");
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);
console.log(`built /sitemap.xml (${SITEMAP.length} URLs)`);
