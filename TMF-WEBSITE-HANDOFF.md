# TMF Team website — full handoff

Written for whoever picks this up next, human or AI. Assumes no prior context.
Everything needed to continue is here.

Last updated: 17 August 2026.

---

## 1. What this is

A marketing and lead-generation website for **TMF Team** (formerly "TMF Line"),
a US business-funding brokerage. Live at **https://tmfus.com**.

**Stack: deliberately plain.** No framework, no build step, no npm. Eight
static HTML pages, one CSS file, one JS file, and one PHP endpoint. Open
`index.html` in a browser and it works.

Do not "modernise" this into React or add a bundler. The owner is not a
developer and deploys by copying files. Every dependency added is a thing that
can break with nobody able to fix it.

```
index.html               Home — hero, funding calculator, products, stages, CTA
funding-estimator.html   3-step cash-injection calculator + live product matching
heloc-calculator.html    HELOC estimator + Figure API offers panel + FAQ
long-term-loans.html     Use cases, payment estimator, qualification, FAQ
mca.html                 Merchant cash advance explainer
about.html               Mission, approach, stats
contact.html             Contact form
404.html                 Not found
assets/styles.css        Entire design system. Tokens in :root at the top
assets/app.js            Every interaction, both calculators, all integrations
api/figure-heloc.php     Server-side proxy to Figure's HELOC API
api/config.example.php   Template. Real config.php lives ONLY on the server
```

**Design tokens** (top of `styles.css`): background `#0a0a0b`, text `#fafafa`,
accents `#34d399` emerald → `#4aa5e8` blue, font Geist, radius `0.75rem`.
Changing `--accent` / `--accent-2` reskins the whole site.

---

## 2. Repository and deployment

**Repo:** `https://github.com/sup3rson1c/tmfus-clean` — branch `master`.
**It is public.** Never commit credentials.

**Deploy pipeline:**

1. Push to GitHub
2. cPanel → **Git Version Control** → **Manage** → **Pull or Deploy**
3. Click **Update from Remote**, then **Deploy HEAD Commit**

`.cpanel.yml` controls what gets copied to `public_html`. It lists files
**individually**. If you add a new top-level file or folder, you must add it
there or it will silently never deploy. This bit us once already — the `api/`
folder was missing from it.

`.cpanel.yml` deliberately does **not** recursively copy `api/`, because
`api/config.php` holds the Figure credential, exists only on the server, and
must never be overwritten.

### The constraint that shapes everything

**Claude Code sessions could not push to this repo** (403 — no GitHub App
installed on the account). The workflow became: assistant produces a zip →
owner unzips over his local clone → commits and pushes with **GitHub Desktop**
→ deploys via cPanel.

If your platform *can* push, that removes several steps and a lot of friction.
Check before assuming.

### Cache busting — do not skip this

`.htaccess` sets caching. CSS and JS are `max-age=3600, must-revalidate`;
images and fonts are pinned for a year.

**Every HTML file references assets with a version string:**
`styles.css?v=12`, `app.js?v=12`.

**When you change CSS or JS, increment that number in all 8 HTML files.**
If you forget, returning visitors keep the old files and your change appears to
do nothing. Originally these were served `immutable` for a year, which made
edits invisible and cost hours of confusion before it was found.

---

## 3. Current state

Live and working:

- **Brand:** TMF Team, with "Capital Strategy" beneath it
- **Logo:** "Ascent" — three rising bars, inline SVG in header and footer, plus
  `logo-mark.svg`, `logo-lockup.svg`, `favicon.svg`, `apple-touch-icon.png`
- **Parallax:** 12 layers on the home page, backdrops on the others
- **Momentum scrolling:** wheel input eased toward a target
- **Custom scrollbar:** slim gradient thumb
- **Home page products:** revenue-based estimator and equipment financing cards
  removed; grid reflowed to one four-up row
- **Lead capture:** calculator and contact form post to a Google Sheet

Built but **blocked on a third party**:

- **Figure HELOC API** — see section 5

---

## 4. Integrations

### 4.1 Lead capture → Google Sheets

`LEAD_ENDPOINT` at the top of `assets/app.js` holds a Google Apps Script Web App
URL. Submissions are appended as spreadsheet rows.

- Server code: `google-apps-script.gs` (paste into Apps Script, deploy as Web
  App, "Anyone" access)
- Setup guide: `SETUP-LEAD-CAPTURE.md`
- Sends: `kind` (`funding-calculator` / `contact` / `figure-heloc`), page,
  timestamp, referrer, and every `[data-field]` under the form
- `collectFields()` harvests fields generically, so new inputs are captured
  automatically as long as they carry `data-field="name"`

**Known tradeoff:** the endpoint URL sits in client-side JS, so it is public.
Anyone could post junk rows. Acceptable for a Sheet; if it becomes a problem,
move it behind a PHP proxy like the Figure one.

**Rule that must not be broken:** if `LEAD_ENDPOINT` is ever empty, the forms
say plainly that nothing was sent. Do not "improve" this by showing a success
message regardless. Telling someone their enquiry was delivered when it was
discarded is worse than an ugly message.

### 4.2 Figure HELOC API

Real HELOC offers on `heloc-calculator.html`.

- Endpoint: `POST https://api.figure.com/products/heloc/pre-qualify/v1`
- Docs: https://docs.figure.com/heloc-pre-qualification/api
- Proxy: `api/figure-heloc.php`
- Credential: `affiliate_id` in `api/config.php` — **server only**, gitignored
- Guide: `SETUP-FIGURE-API.md`

**Why a PHP proxy exists:** Figure sends the affiliate ID in the request
**body**. Calling their API from browser JS would publish the credential to
every visitor. It cannot be done client-side. Do not "simplify" this away.

**Endpoint versions:** `v1` takes plain JSON. `v2` accepts *only* a JWE-encrypted
body (`{"encrypted": "..."}`) and returns 400 on plain JSON. We use v1;
pre-qualification collects no SSN and the call is already over TLS.

**Response codes on this endpoint are unusual:** a **400 means "Incorrect
credentials"**, per Figure's own OpenAPI spec — not a malformed request. Their
error text says "Malformed input", which is misleading. Do not spend time
debugging your payload on a 400; check the credential and environment first.

The proxy: whitelists fields, validates enums, clamps FICO to 300–900,
uppercases the state code, casts integer-typed fields to int (floats serialise
as `250000.0` and get rejected), converts monthly income to annual, rate-limits
per IP, and logs failures without ever logging the credential.

---

## 5. Open items

### 5.1 Figure returns HTTP 500 — blocked on Figure

**Status:** everything on our side verified working; Figure's server is erroring.

Evidence gathered:

- `api/` deploys, PHP executes, `config.php` is read, the ID passes format
  validation
- On `api.test.figure.com` → **400 "Incorrect credentials"** → the ID is a
  production-only key
- On `api.figure.com` → **500**, on every request
- Isolated across nine payload variations, from bare minimum (affiliateId,
  requestType, loanPurpose, two consent flags) to fully populated — always 500
- A malformed request would return 400, not 500. Their server is failing

**Next step is Figure's support, not code.** Ask whether the account is
provisioned for the `OFFERS` request type on this endpoint.

**Likely underlying cause, unconfirmed:** the Figure Lead Portal account
associated with this work belongs to **Signet Capital Group** (signed in as
Michael Gold, `michael@signetcapitalgroup.com`), not TMF Team. If the
production affiliate ID is Signet's, their account may be enabled for the Lead
Portal but never provisioned for affiliate API offers — which would produce
exactly this.

**This also raises a question nobody has answered:** whether TMF Team is
entitled to use that partnership's credential on tmfus.com. Leads submitted
through it are attributed to whoever owns the affiliate ID. The owner was told
this twice and has not confirmed the arrangement. **Do not treat it as settled.**
Confirm whose partnership this runs under before production traffic hits it.

### 5.2 Rate limit may be exhausted

`api/config.php` has `rate_limit_per_hour` (default 20, per IP). Diagnostic
testing consumed it. If the form returns "Too many requests", either wait an
hour or raise the value.

### 5.3 No contact details anywhere on the site

There is **no phone number or email address** on any page. The only ones present
are placeholder text inside form fields (`you@business.com`,
`(555) 123-4567`). A visitor who wants to make contact outside the forms
cannot. The owner has been asked twice for real details and has not supplied
them. **Chase this — it is the cheapest conversion fix available.**

### 5.4 Deliberately left alone

- The home page meta description still lists equipment financing. It is still
  offered elsewhere (term-loans page, estimator matching logic); only the home
  page *card* was removed
- Nav still links "Cash injection calculator" → `funding-estimator.html`. Only
  the home page card was removed, not the page

---

## 6. Tunable knobs

Both effects can be adjusted live in the browser without a deploy, which is how
the owner prefers to choose values.

| What | Where | Live override |
|---|---|---|
| Parallax strength | `STRENGTH` in `app.js` (currently `1.45`) | `?px=2.5`, or `?tune=1` for a slider |
| Momentum easing | `EASE` in `app.js` (currently `0.09`) | `?ease=0.05` floatier, `?ease=0.18` snappier, `?nomo=1` off |

`?tune=1` renders a slider panel. It does **not** appear for normal visitors —
verified. Once a value is settled, bake it in and delete `initTuner()`.

**Accessibility, non-negotiable:** parallax and momentum both disable under
`prefers-reduced-motion` and at ≤680px width. Verified in both states. Do not
remove these guards to make an effect "work everywhere" — motion sickness is
real and phones stutter.

---

## 7. Traps that cost real time

Read this section before debugging anything.

1. **Testing a live site through browser automation gives false negatives.**
   Background tabs freeze `requestAnimationFrame`, so scroll animation appears
   completely dead when it is fine. Several rounds were wasted concluding
   parallax was broken when the measurement was at fault. Ship a standalone
   test file the user opens themselves, or have them check.

2. **`immutable` cache headers hide deploys.** If a change "doesn't appear",
   check the deployed asset version *before* touching code.

3. **An `IntersectionObserver` gate was removed from the parallax engine.** If a
   callback was never delivered, every layer stayed flagged invisible and
   nothing moved — with no error. Do not reintroduce that optimisation; twelve
   elements cost nothing to compute.

4. **`.cpanel.yml` lists files individually.** New file or folder → add it there
   or it never deploys.

5. **A 400 from Figure means bad credentials, not bad data.** Their error text
   lies.

6. **The owner does not read code.** Explain in plain language, give numbered
   steps naming the exact button, and say what should appear on screen. He
   works in cPanel File Manager and GitHub Desktop, not a terminal.

---

## 8. Working style that suited this owner

- He asks for outcomes ("make it more aggressive"), not implementations
- He deploys manually, so **batch changes into one upload** rather than sending
  several. Each round trip is real effort for him
- **Verify before claiming something works.** He was told the parallax worked
  three times before it actually reached his browser. That damaged trust more
  than the bug did
- When something cannot be done, say so immediately and give the alternative.
  Do not keep retrying a blocked action
- He is cost-conscious about tokens. Be efficient; do not re-explain

---

## 9. Credentials — where they live

Nothing sensitive is in the repository.

| Secret | Location | Notes |
|---|---|---|
| Figure affiliate ID | `api/config.php`, server only | gitignored; never in chat or commits |
| Apps Script URL | `LEAD_ENDPOINT` in `app.js` | Public by nature; see 4.1 |
| GitHub | Owner's GitHub Desktop | Assistant sessions had no push access |
| cPanel | Owner's hosting login | LiteSpeed, PHP available |

If a credential is ever committed, rotate it with the issuer. Do not simply
delete the commit — the history remains public.

---

## 10. Immediate priorities

1. **Get contact details on the site** (5.3). Cheapest win available
2. **Resolve the Figure 500 with Figure support**, and settle whose partnership
   the credential belongs to (5.1)
3. **Push the outstanding commits** so the repo matches the server. At handoff
   the owner was applying a single-file fix directly to the server, so
   `api/figure-heloc.php` on the server may be ahead of GitHub
4. Confirm with Figure whether `householdIncome` should be annual or monthly
   (`income_is_annual` in config). Currently annual. Wrong either way skews
   every offer shown to a borrower
