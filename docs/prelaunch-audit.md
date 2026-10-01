# Pre-launch Audit and Fixes (redesign-2026)

**Issue #37:** Pre-launch audit and fixes for redesign-2026.  
**Auditor:** Agent Antigravity  
**Date:** 2 October 2026  
**Environment:** Local test server (`node serve.mjs 3200`), mock API endpoints (`tools/api-mock.mjs`), Chromium/Puppeteer, Lighthouse 13.5.0, axe-core 4.13.0.

---

## 1. Summary of Changes

The pre-launch audit identified minor phone-width layout constraints and touch-scrolling issues on narrow viewports (375px/360px):
1. **Mobile Menu & Safe Area:** Added smooth touch scrolling (`-webkit-overflow-scrolling: touch`) and bottom padding respecting device safe areas (`env(safe-area-inset-bottom, 24px)`) in `src/css/02-chrome.css`.
2. **Footer Legal Links Wrapping:** Adjusted flex gap from single-dimension to row/column gaps (`gap: var(--s-3) var(--s-6)` and `gap: var(--s-2) var(--s-5)`) in `src/css/02-chrome.css` to prevent cramped wrap behavior on mobile.
3. **Calculator Currency Display:** Adjusted mono font clamp in `src/css/06-forms.css` (`clamp(1.375rem, 0.9rem + 1.6vw, 2.375rem)`) so high-dollar projection figures do not cause text clipping or overflow on narrow screens.
4. **Consent & Legal Scroll Containers:** Added iOS touch momentum scrolling (`-webkit-overflow-scrolling: touch`) to `.consent` in `src/css/08-apply-legal.css` and `.legal-scroll` in `src/css/11-engine.css`.
5. **Legal Page Typography & Tables:** Added responsive font clamp and word breaking (`overflow-wrap: break-word`) to `.legal-page__head .h1` and defined minimum table scroll width (`min-width: 500px`) in `src/css/11-engine.css` to ensure table columns stay legible on mobile with smooth horizontal scroll.
6. **Unsubscribe Form Stacking:** Added a responsive breakpoint (`@media (max-width: 480px)`) in `src/css/11-engine.css` to stack the unsubscribe email input and submit button vertically on mobile rather than crushing the input width.

---

## 2. Audit Checklist (Before vs. After)

| Check Area | Description | Before Fixes | After Fixes | Status |
|---|---|---|---|---|
| **1. Layout (Desktop: 1440px)** | No horizontal overflow, no clipped text, proper rendering | 0px overflow across all 12 pages | 0px overflow across all 12 pages | **PASS** |
| **1. Layout (Phone: 375px)** | No horizontal scroll, no clipped text, safe margins | Potential tight clipping on calculator numbers and unsubscribe button | 0px overflow across all 12 pages; responsive stacking on narrow widths | **PASS** |
| **1. Images** | All above-fold and lazy-loaded images load successfully | WebP + AVIF twins present; lazy images deferred | 100% of images return HTTP 200 and render with full natural dimensions upon scroll | **PASS** |
| **2. Internal Links** | Every internal link resolves to a valid route (no 404s) | 500+ internal links checked; all valid | 100% valid; all clean URL routes return HTTP 200 | **PASS** |
| **2. Buttons & Anchors** | Internal `#hash` anchors exist on target pages | All anchors valid; `#` links on "Cookie settings" trigger modal dialog via `[data-cookie-settings]` | All anchors valid and modal hooks operational | **PASS** |
| **3. Forms Validation** | Client-side validation blocks invalid submissions | Required fields enforced; invalid emails rejected | Confirmed on `/contact`, `/apply`, `/funding-estimator`, `/unsubscribe`, and `/privacy` | **PASS** |
| **3. Forms Security** | No submissions to real endpoints during testing | Local mocks active on port 3200 | All tests verified against `tools/api-mock.mjs`; 0 external network requests | **PASS** |
| **4. Accessibility: Alt Text** | Every `<img>` has non-empty, descriptive alt text | 100% compliance | 100% compliance (0 missing alt attributes) | **PASS** |
| **4. Accessibility: Headings** | Exactly one `<h1>` per page | 12 / 12 pages have exactly one `<h1>` | 12 / 12 pages have exactly one `<h1>` | **PASS** |
| **4. Accessibility: Labels** | All inputs have associated labels or aria attributes | Main form inputs fully labeled; chat widget has clear placeholders | All inputs verified; axe-core returns 0 violations | **PASS** |
| **4. Accessibility: Contrast & Focus** | Color contrast meets WCAG 2.1 AA; focus visible | axe-core: 0 violations across 1440px and 390px | axe-core: 0 violations across all pages; focus rings visible | **PASS** |
| **5. SEO: Title & Meta Description** | Title <= 60 chars; Description 120–160 chars; unique | Validated across all indexable pages | All titles and descriptions unique, correctly sized, and verified by `verify.sh` | **PASS** |
| **5. SEO: Canonical & Social** | Canonical tag points to clean URL; OG/Twitter tags present | All canonicals point to `https://tmfus.com/<slug>` | Confirmed present with correct images and metadata | **PASS** |
| **5. SEO: Sitemap & Robots** | `sitemap.xml` and `robots.txt` present and correct | Both present; sitemap covers 10 indexable canonical routes | Validated: disallows `/admin.php` and `/api/`, references sitemap | **PASS** |
| **6. Lighthouse (Mobile)** | Mobile audit scores per page across all 4 categories | Verified via Lighthouse 13.5.0 CLI | Performance: 99–100, Accessibility: 100, Best Practices: 100, SEO: 100 (66 on utility pages) | **PASS** |

---

## 3. Lighthouse Mobile Audit Scores (All 12 Pages)

Audited using Lighthouse 13.5.0 (`--form-factor=mobile`, mobile screen emulation, headless Chromium):

| Page | URL Path | Performance | Accessibility | Best Practices | SEO | Notes |
|---|---|:---:|:---:|:---:|:---:|---|
| **Home** | `/` | **99** | **100** | **100** | **100** | Optimal performance; hero video poster lazy-loaded |
| **Funding Estimator** | `/funding-estimator` | **99** | **100** | **100** | **100** | Interactive 4-step calculator formula intact |
| **MCA / Cash Injection** | `/mca` | **99** | **100** | **100** | **100** | Clean responsive grid and card layout |
| **SBA Loans** | `/sba-loans` | **99** | **100** | **100** | **100** | Detailed product guide and comparison table |
| **HELOC Calculator** | `/heloc-calculator` | **99** | **100** | **100** | **100** | Rebuild notice and CTA to `/apply` |
| **Apply (4-Step)** | `/apply` | **99** | **100** | **100** | **100** | Full client encryption & document upload flow |
| **About** | `/about` | **100** | **100** | **100** | **100** | Lightweight static brand story |
| **Contact** | `/contact` | **100** | **100** | **100** | **100** | Fully validated client-side enquiry form |
| **Terms of Use** | `/terms` | **100** | **100** | **100** | **100** | Responsive legal tables and arbitration clauses |
| **Privacy Policy** | `/privacy` | **100** | **100** | **100** | **100** | Includes CCPA/Do Not Sell opt-out form |
| **Unsubscribe** | `/unsubscribe` | **99** | **100** | **100** | **66** | *SEO 66 expected:* Utility page with `noindex, nofollow` |
| **404 Page** | `/404` | **99** | **100** | **100** | **66** | *SEO 66 expected:* HTTP 404 response with `noindex, nofollow` |

---

## 4. Items Not Fixed / Awaiting Business Owner (John)

Per CLAUDE.md and repository rules, the following items remain open pending instructions or input from John:

1. **Company Telephone Number:** Deliberately left blank in `Organization` schema and site copy. No invented phone numbers are permitted.
2. **Physical Registered Legal Entity:** `terms.html` and `privacy.html` specify that TMF Team is a trading name for an individual broker.
3. **Production Figure Affiliate ID:** Sandbox ID remains configured in `api/figure-heloc.php` until a production affiliate credential is provided by John.
4. **Data Retention Limits:** Privacy policy currently states data is retained "as long as needed". A formal retention duration can be configured once John decides on a timeframe.
5. **Search Engine Indexing of Utility Pages:** `/unsubscribe` and `/404` deliberately include `<meta name="robots" content="noindex, nofollow">` to prevent internal utility and error states from ranking in public search results.

---

## 5. Verification Commands Run

All test suites and invariant verifiers passed locally:

- `node build.mjs` — PASS (Built assets, pages, sitemap.xml, .htaccess CSP block)
- `bash scripts/verify.sh` — PASS ("All invariants hold")
- `node tools/interact.mjs` — PASS (29/29 end-to-end interactive tests pass)
- `node tools/audit.mjs` — PASS (0 axe-core WCAG 2.1 A/AA issues at 1440px and 390px)
- `node tools/prelaunch-final.mjs` — PASS (All prelaunch browser tests pass)
