# TMF Team — build handoff

Built 2026-09-12. Static multi-page site; no framework, no build step beyond a small include script.

## Run it

```bash
node build.mjs          # src/pages + src/partials + src/css  →  /index.html, /<page>/index.html, /assets/css/site.css
node serve.mjs 3100     # http://localhost:3100
node tools/images.mjs   # re-export media/*.png masters to assets/img/*.webp
```

QA scripts (need the server running): `node tools/shots.mjs <path> <label> --stops=0,0.5 [--w=390 --h=844]`, `node tools/motion-shots.mjs <path> <label> --at=top,hero@0.5,hours@0.6,.cta [--w= --h= --reduced]` (named scroll states), `node tools/interact.mjs` (menus, clock slider, calculator, forms, CTA estimate, reduced motion: 44 checks), `node tools/audit.mjs` (contrast, targets, headings, labels, overflow at 1440/390/320).
On Git Bash, prefix path arguments with `MSYS_NO_PATHCONV=1`.

## Motion system (added 2026-09-13)

Direction: `docs/motion-phase2-direction.md`. Limits: `docs/motion-phase1-ux-plan.md`. Brief: `D:\Desktop\Claude Code\scrollcraft\builds\tmf-team\BRIEF.md`.

| File | What it does |
|---|---|
| `assets/js/motion.js` | Lenis smooth scroll (fine pointers only), GSAP setup, shared verbs on `TMF.motion`: `rise` (SplitText lines), `strike`, `roll` (digit wheels, real figures only), `trace` (DrawSVG), `scrollTo`; heading reveals; the header mark's hand |
| `assets/js/hero.js` | Home hero: layered planes (clean plate, atmosphere, contact shadow, disc with 48h ring, chips and sheen, stone slab), intro, sticky scroll scene at ≥1024×760, pointer depth |
| `assets/js/clock.js` | "Where the hours go": the engraving clock. Scroll, drag, click and keys drive one `role="slider"`; the canvas guilloché band closes at hour 48 |
| `assets/js/moments.js` | Section moments (paper feed, statement print, industry rules and marks, commission line, vault locks, CTA horizon and estimate line, footer wordmark) and inner-page moments (page heroes, remittance chart, day timeline, 50/40/10, checklists, HELOC minute dial and score track, principle marks). Adds `html.motion-live` and `html.sc-ready` last |
| `src/css/04-home.css` | Hero world geometry and the clock layouts (pinned, compact sticky, static) |
| `src/css/09-motion.css` | First-paint states and CSS fallbacks, number wheels, stepper trace, CTA horizon, page transitions |

- Libraries, pinned: GSAP 3.13.0 (ScrollTrigger, SplitText, DrawSVGPlugin) from cdnjs, Lenis 1.3.4 from jsDelivr.
- Reduced motion: no pinning, parallax, smooth scroll, split text or page transitions. The hero rests; the clock shows all 48 hours and its slider still works.
- If the scripts never load, a 1.2s CSS timer reveals everything (`html.motion-ok:not(.motion-live)`).
- Pinned spans: hero 160svh (60svh of travel), clock 290svh (190svh). Home is 14.0 viewport-heights at 1440×900.
- The hero planes are registered to the images. If a plate or the disc cutout is regenerated, re-measure `--frame-*`, `--dx` and `--dy` in `04-home.css` and the crop box in `tools/images.mjs` (see `asset-log.md`).
- Motion code must be time-based: headless Chrome on this machine runs animation frames at about 10fps, which exposed a frame-based easing bug in the clock.
- scroll-craft harness (uses `playwright-core`, installed): `SCROLLCRAFT_CHROME=<cached chrome.exe> node ~/.claude/skills/scroll-craft/scripts/shoot.mjs --url http://localhost:3100 --out "temporary screenshots/harness-desktop"` (add `--width 390 --height 844` or `--reduced-motion`). Desktop and reduced motion: no dead scroll, all text clears 4.5:1. Phone: no dead scroll; it flags the clock stages at 1.2–1.8:1 because it grades frames where they sit behind the opaque sticky dial band. The text is hidden there (checked on screenshots), so this is a measurement artifact.
- Not verified: real iOS Safari and Android devices (sticky with the URL bar, touch scrolling, Lenis is off on touch by design).

## Content direction: rates and terms lead (2026-09-17)

The client asked for the site to lead on competitive rates and transparent loan conditions rather than on speed. The 48-hour funding claim is kept everywhere it was true, but demoted to a supporting proof point. No rate figures are published, because the client has none to publish and their own site publishes none either; the claim is carried by mechanism instead (a brokerage shops one file to competing funders, the commission is paid by the funder, every rate/amount/term is disclosed before signing).

| Where | Change |
|---|---|
| `partials/home-hero.html` | H1 is now "Rates that compete. Terms you can read."; lede leads with the brokerage mechanism; fact rail reordered so the two "None" conditions come before "From approval to funds 24-48h"; status pill is about pricing, not review speed |
| `partials/home-terms.html` | **New section** (`.fineprint`), between the product statement and the clock. See below |
| `partials/home-paths.html` | Section lede says each path is priced by its own funders; "Best for" cells for cash injection and home equity now name the pricing angle |
| `partials/home-faq.html` | New "What will it cost?" question, placed above "How fast can I be funded?" |
| `pages/cash-injection.html` | H1 "Priced on your revenue, not your credit score."; the 3-24h decision fact became "Remittance / % of sales" |
| `pages/home-equity.html` | H1 "Cheaper capital, secured by your home."; lede leads with pricing against unsecured credit and states the trade-off |
| `pages/sba-loans.html` | H1 "The lowest rates in small business lending." |

The hero's engraved dial still reads as a 48-hour instrument. That is deliberate: it now supports the speed claim instead of making it. If the client later wants the time metaphor gone from the hero image as well, that is a new art-direction pass, not a copy change.

### The `.fineprint` section

"The fine print, set large": a banknote microprint strip hands off to the conditions it normally hides. A loupe band reads down the list once on entry (`[data-fineprint]` in `moments.js`, transform and opacity only, one-shot, nothing pinned). The checklist ticks come from the existing generic `.checklist` handler.

The class is `fineprint`, not `terms`, because `.terms` is already the definition-list component in `07-pages.css` used on the product and legal pages. Reusing it silently turned `.container` into a two-column grid and overlapped the headline.

Home is 15.1 viewport-heights at 1440x900 (was 14.0).

## Pages

| Route | Source |
|---|---|
| `/` | `src/pages/home.html` (+ `src/partials/home-*.html`) |
| `/calculator/` | `src/pages/calculator.html` |
| `/cash-injection/` | `src/pages/cash-injection.html` |
| `/sba-loans/` | `src/pages/sba-loans.html` |
| `/home-equity/` | `src/pages/home-equity.html` |
| `/about/` | `src/pages/about.html` |
| `/contact/` | `src/pages/contact.html` |
| `/apply/` | `src/pages/apply.html` |
| `/terms/`, `/privacy/` | placeholder legal pages |

Edit `src/`, then run `node build.mjs`. Never edit the generated `index.html` files directly.

## Must be replaced before launch

Search the source for `data-placeholder` and `tag--sample`.

1. **Phone number** `(000) 000-0000` / `tel:+10000000000` in `partials/header.html` (desktop + mobile menu), `partials/footer.html`, `pages/contact.html`, `pages/apply.html`.
2. **Email** `hello@example.com` in `partials/footer.html` and `pages/contact.html`.
3. **Office address** in `partials/footer.html` and `pages/contact.html`.
4. **Testimonials and stats** in `partials/home-proof.html` (remove the "Sample content" tag when real).
5. **Team** names, roles and photos in `pages/about.html`.
6. **Legal text** in `pages/terms.html` and `pages/privacy.html` (copy from the current tmfus.com pages).

## Calculator formula (waiting on the client)

`assets/js/calculator.js` → `estimate(a)` is a clearly marked placeholder. Inputs:
`{ revenue, credit: "500-549"…"750+", industry, time: "lt6m"|"6-12m"|"1-2y"|"2-5y"|"5y+", positions: "none"|"1"|"2"|"3+", balance }`.
Return `{ low, high, overleveraged, products: [{ name, fit: "good"|"maybe"|"no", note }] }` and the UI needs no other change.
When the real formula lands, also remove the "Illustrative estimate while the calculator formula is finalized" sentence and the `Illustrative` tag in `renderResult()`.

## Forms (front-end only)

- **Contact:** `[data-demo-form]` handler in `assets/js/site.js` validates, waits 900 ms and shows `#contact-success`. Replace the timeout with a real POST.
- **Apply:** `assets/js/apply.js` submit handler; step 4 is where the live build should hand off to the e-sign platform (SSN + signature are intentionally **not** collected on the site, matching the current site's security statement). Bank statement files are held in the `#statements` input.
- Drafts autosave to `sessionStorage` (`tmf-apply-draft`), never files or consent boxes. The calculator hands its answers to Apply through `tmf-estimate`.

## Notes for the client

- The current site marks the autodialer/text consent checkbox as **required** while its own text says "This is not a condition of funding." In this build it is **optional**; confirm with their compliance advisor.
- "14 years" is the funding company TMF Team works with, not TMF Team itself; copy keeps that wording.
- The SBA 7(a)/MCA refinancing restriction (effective June 1, 2025) and all product ranges come from the current tmfus.com copy.
