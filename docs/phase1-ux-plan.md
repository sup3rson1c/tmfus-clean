# TMF Team — Phase 1 UX & Design-System Plan

Status: Phase 1 (ui-ux-pro-max, planning only). Written 2026-09-12.
Next: Phase 2 (frontend-design) owns art direction, and may retune hue/typography *within* the constraints below. Phase 3 build starts only after the user switches models.

---

## 0. Inputs & locked decisions

| Topic | Decision (from client, 2026-09-12) |
|---|---|
| Business | TMF Team — US business-funding **brokerage** (not a lender). Commission paid by funders. |
| Look | Dark + light mix, **mostly dark**. Refs: Moto (cinematic black, 3D), NexDash (light gray, huge type, isometric 3D), Mercury (calm, product UI proof). |
| Scope | Multi-page: Home, Calculator, Cash Injection (MCA), SBA Loans, Home Equity (HELOC), About, Contact, Apply. |
| Brand | Keep "TMF Team" name; new logo mark + palette (retire generic teal→blue gradient). |
| Media | Higgsfield 3D renders (glass/metal) + designed app/offer UI mockups. No stock photos. |
| Calculator | **Design only** — no real math until client sends the formula. **No name/email/phone gate**: numbers in → estimate out. |
| Contact data | Collected **only in Apply** (and Contact form). |
| Trust proof | Testimonials, stats, ratings, partner logos = **clearly marked placeholders**. Never invented. |
| Forms | Front-end only: validation, loading, success states. Backend later. |
| Contact info | Placeholder phone / email / address. Real: Mon–Fri 9am–6pm EST. |

### Content carried over verbatim-in-spirit from tmfus.com
- "Capital that respects your timeline." · $5K–$5M range · Decision in 3–24h · Funded 24–48h after approval · Same-day funding available on approved advances · Specialist contacts you within 24h with a pre-qualified offer · No hard credit pull to start · No login required · Dedicated advisor on every application · Application: 4 steps, ~10 minutes, 4 months of bank statements · 256-bit SSL · "The company we work with is already 14 years in business" (partner tenure — word it accurately, not as TMF's own age).
- Products: SBA 7(a)/504 (up to $5.5M, 10–25 yrs, 30–90 days) · Cash Injection/MCA ($5K–$2M, 3–18 mo, as fast as same-day) · HELOC ($25K–$750K, 10–30 yrs, offer inside the hour, AI valuation) · Line of Credit ($10K–$250K, revolving).
- 3-stage process: See your options → Talk to a specialist → Get funded.
- 6 home FAQs + calculator FAQs + SBA content (50/40/10, MCA refinancing restriction from 2025-06-01, documents list) + MCA day-by-day timeline + HELOC "where the hour goes".
- Legal disclaimer (brokerage, not an offer, estimates, not in every state) + HELOC risk line ("Borrowing against your home puts your home at risk").

---

## 1. Users & goals

| Persona | Situation | Primary goal | What builds trust for them |
|---|---|---|---|
| **Urgent operator** (restaurant, trucking, construction) | Cash gap this week; mobile, between jobs | Know *fast* if they qualify and how much | Speed numbers, no hard pull, no signup wall, a human advisor |
| **Planner** (5+ yrs, $100K+/mo) | Expansion, equipment, real estate | Compare cost vs. speed across products | Clear product comparison, honest SBA timelines, transparency on broker model |
| **Burned borrower** (has MCA positions) | Skeptical of brokers after stacking | Avoid a bad deal; maybe consolidate | Plain-English honesty ("a new advance may be the wrong tool"), how TMF is paid |
| **Homeowner-owner** | Wants larger/cheaper capital | HELOC offer quickly | "Offer inside the hour", risk disclosure, no appraisal appointment |

**North-star conversion:** Calculator completion → Apply start. Secondary: Contact / call.
**Rule:** Every page has exactly one primary CTA style (Apply / See what you qualify for); everything else is secondary.

---

## 2. Information architecture

```
/                     Home
/calculator/          Funding calculator (3 steps, ungated)
/cash-injection/      Cash Injection (MCA)
/sba-loans/           SBA 7(a) & 504
/home-equity/         HELOC
/about/               About
/contact/             Contact
/apply/               Application (4 steps)
(/terms, /privacy — footer links; content out of scope, keep placeholders)
```
Line of Credit: product card on Home + Solutions menu item → anchors to Apply (no dedicated page on the current site; not adding one).

### Global navigation
- Desktop: Logo · Solutions ▾ (Cash Injection, SBA Loans, Home Equity, Line of Credit — each with range + one-liner) · Calculator · About · Contact · [phone placeholder, text link] · **Apply now** (primary).
- Solutions menu = disclosure button (`aria-expanded`), opens on click *and* hover-intent, closes on Esc/outside click, full keyboard support.
- Mobile (<1024): Logo · "Apply" compact button · Menu button → full-height sheet with large targets; focus trapped; Esc/close button returns focus.
- Sticky header: transparent over hero → solid/blurred surface after 24px scroll; hides on scroll-down, reveals on scroll-up (never obscures focused elements).
- Active page indicated (weight + underline/dot + `aria-current="page"`).
- Skip link "Skip to content" as first focusable element.

### Footer (all pages)
Products · Company (About, Contact, Apply, Calculator) · Hours (Mon–Fri 9am–6pm EST) + placeholder phone/email/address · Legal (Terms, Privacy, Cookie policy, Do Not Sell or Share) · full brokerage disclaimer · © 2026 TMF Team.

---

## 3. Page structures

Legend: **[D]** dark section · **[L]** light section. Target ≈ 75% dark / 25% light by scroll length.

### Home
1. **[D] Hero** — H1 "Capital that respects your timeline." · sub (see options in seconds, no login) · Primary "See what you qualify for" → calculator · Secondary "Apply now" · 3D hero render · floating status micro-cards (illustrative UI: "Decision ready", "Funds sent") · live-feel "Reviewing applications — avg decision 3–24h" pill.
2. **[D] Fact rail** — $5K–$5M · 3–24h decision · 24–48h to funds · No hard credit pull. Tabular numerals.
3. **[D, elevated] Calculator (embedded, same component as /calculator)** — ungated 3 steps.
4. **[L] Capital paths** — "One platform. Multiple capital paths." 4 products compared on the same axes: range · term · speed · best for. Each links to its page.
5. **[D] How it works / "Where the 24 hours go"** — 3 stages on a time axis (desktop: pinned horizontal progress; mobile: vertical stepper, no pin).
6. **[D] Who we fund** — industries grid (Restaurant, Retail, Construction, Trucking, Healthcare, Wholesale, Salon/Spa, +more).
7. **[D] Straight about the model** — "We're a brokerage, not a lender." How TMF is paid; the honest over-leverage answer. Key differentiator for trust.
8. **[D] Proof** — stats row + 3 testimonials — **PLACEHOLDER badge visible in build**, swapped before launch.
9. **[D] Security** — 3 cards: encrypted connection · SSN & signature on secure signing platform, never stored on site · you control sharing.
10. **[L] FAQ** — 6 questions, accordion.
11. **[D] Final CTA** — "Know your number in a minute." Primary + secondary (Talk to a specialist).
12. Footer.

### Calculator (/calculator) — ungated
- Hero [D]: "How much funding can you get?" + reassurance chips (no credit impact · no contact info needed · ~60 seconds).
- **Step 1 — Revenue & credit:** Monthly revenue (currency, `inputmode="numeric"`, live $ formatting) · Credit score band (segmented control, 6 options) .
- **Step 2 — Business profile:** Industry (select/chip grid) · Time in business (segmented, 5 options).
- **Step 3 — Existing obligations:** Existing MCA positions (None/1/2/3+) · Total outstanding balance (shown only if positions ≠ None — progressive disclosure; helper text "The combined payoff amount still owed. This is deducted from your available funding.").
- **Result panel:** estimated range (large tabular figure), matched products list with fit tags, "what happens next", Primary "Apply to get real offers" (carries answers into Apply — `redundant-entry`), Secondary "Talk to a specialist". Also designed states: *over-leveraged* (non-alarming, explains consolidation path), *empty/incomplete*.
- **Math = pending.** Result uses a clearly isolated `estimate()` stub returning illustrative figures; UI labelled "Illustrative estimate" until the client formula lands.
- Desktop: two-column (inputs left, sticky result right, updates on change). Mobile: steps then result card; result summary sticky at bottom after step 1.
- Results region: `aria-live="polite"`, announces full phrase ("Estimated range $X to $Y, 3 products matched").
- FAQ (5 calculator questions from current site, reworded where they referenced the removed contact step).

### Cash Injection (MCA)
Hero [D] (fast capital aligned with revenue; $5K–$2M; 3–18 mo; same-day possible) → How remittance flexes (interactive revenue-vs-remittance visual, illustrative) → Day 1–4 timeline → Ideal businesses → **[L]** Cost clarity: factor rate explained, "not a loan — purchase of future receivables" → FAQ → CTA.

### SBA Loans
Hero [D] "Government-backed capital, explained." → 7(a) vs 504 comparison **[L]** → 504 50/40/10 split visual → Eligibility standards (6) → Documents checklist → Callout: 7(a) can't refinance MCAs (eff. 2025-06-01) + "what you can do instead" → timeline 30–90 days → FAQ → "Not sure which route fits?" CTA.

### Home Equity (HELOC)
Hero [D] "Your equity, valued in minutes. An offer inside the hour." → "Where the hour goes" 3-stage → What you need (EIN, 4 months statements, property address) → rate tiers note (~660/700/740/780) → risk disclosure (prominent, not buried) → FAQ ("What you should know") → CTA. No calculator (current site's is offline; not adding one).

### About
Hero [D] "Capital, simplified." → mission paragraph → 3 principles (Speed & Precision, Transparency, Tailored Solutions) → How we're paid (brokerage model) → partner tenure (14 yrs, worded accurately) → team — **PLACEHOLDER** → CTA.

### Contact
Two-column: left = "Talk to a funding specialist", response promise (within one business day), hours, placeholder phone/email/address; right = form (First*, Last*, Business*, Email*, Phone optional, How can we help?). Success state inline. Links to calculator/apply.

### Apply (4 steps)
Stepper with labels + "Step 2 of 4" text · autosave to sessionStorage · Back always available · prefill from calculator.
1. **Business:** legal name, DBA (helper), EIN (masked format), address, city, state (select), ZIP, start date, industry (21 options), amount requested (optional).
2. **Owner:** full name, ownership %, home address/city/state/ZIP, email, phone, DOB.
3. **Second owner?** "No, just me" / "Yes, add a co-owner" (helper: owners ≥20%). Conditional fields.
4. **Statements & consent:** drag-and-drop + button upload (last 4 months, PDF/JPG/PNG ≤10MB each, keyboard-operable, file list with remove), authorization text (collapsible, readable), 2 required checkboxes, then **"Continue to secure signing"** — SSN & signature captured on the e-sign platform (matches current site's stated practice; design shows the handoff).
- Confirmation: "Application received." + reference number + "usually within 3–24 hours".
- Failed submit → focusable error summary linking to fields + inline errors (`aria-describedby`).

---

## 4. Design system tokens (Phase 1 baseline — Phase 2 may retune hue)

> Dataset note: the generated system suggested gold + **purple** and a single-font IBM Plex stack. Rejected: purple is listed as an anti-pattern in the same output, and project rules forbid one font for headings + body. Guidance below is synthesized, not copied.

### Color — dark (default)
| Token | Hex | Role |
|---|---|---|
| `--ink` | `#07090C` | page base |
| `--surface-1` | `#0D1117` | sections / raised base |
| `--surface-2` | `#141A22` | cards |
| `--surface-3` | `#1B2230` | floating: menus, popovers, sticky result |
| `--text` | `#F3F5F2` | primary text |
| `--text-2` | `#A7B0BA` | secondary text |
| `--text-3` | `#7C8692` | tertiary / meta |
| `--accent` | `#8FE388` | "approval green" — primary CTA fill, success, focus ring |
| `--accent-2` | `#D6B370` | "brass" — premium detail: hairlines, key numerals, engraving motifs (never CTA) |
| `--danger` | `#FF7A70` | errors on dark |
| `--hairline` | `rgba(255,255,255,.08)` | decorative dividers |

### Color — light sections
| Token | Hex | Role |
|---|---|---|
| `--paper` | `#EDEFEA` | light section base (NexDash-like warm gray) |
| `--paper-card` | `#F9FAF7` | cards on light |
| `--ink-text` | `#0A0D10` | primary text / primary button fill on light |
| `--ink-2` | `#4A525B` | secondary |
| `--ink-3` | `#646C75` | tertiary |
| `--accent-deep` | `#1C6B3C` | green text/links on light |
| `--brass-deep` | `#7A5A1C` | brass text on light |
| `--danger-deep` | `#B3261E` | errors on light |

### Verified contrast (WCAG 2.2, computed)
| Pair | Ratio | Use allowed |
|---|---|---|
| text on ink / s1 / s2 / s3 | 18.18 / 17.26 / 15.95 / 14.53 | all |
| text-2 on ink … s3 | 9.08 … 7.25 | all |
| text-3 on ink / s1 / s2 | 5.39 / 5.12 / 4.73 | normal text OK |
| text-3 on s3 | **4.31** | **large text (≥24px / ≥18.66px bold) or non-essential only** |
| accent green on ink | 12.83 | text, icons |
| ink on accent (CTA label) | 12.83 | ✅ |
| brass on ink / s3 | 10.01 / 8.00 | ✅ |
| danger on s3 | 6.27 | ✅ |
| ink-text / ink-2 / ink-3 on paper | 16.82 / 6.85 / 4.60 | all |
| accent-deep / brass-deep / danger-deep on paper | 5.64 / 5.48 / 5.64 | all |
| paper on ink-text (button on light) | 16.82 | ✅ |
| `#3A4452` border on ink | **2.02** | decorative only — **input/control borders must reach ≥3:1**; pick a lighter control-border token and verify at build |

Color is never the only signal: errors get icon + text; product "fit" tags get labels; stepper states get numbers/check icons.

### Typography (baseline pairing; Phase 2 decides final treatment)
- **Display:** Archivo (variable, width axis) — expanded width, 500–650 weight, for H1/H2 and Moto-style all-caps statements. Tracking `-0.03em` at ≥40px.
- **Body/UI:** Geist — 400/500/600. Line-height 1.7 body, 1.5 UI.
- **Figures & labels:** Geist Mono — tabular numerals for amounts, timers, step counters; uppercase labels `+0.12em`.
- Load via Google Fonts with `display=swap`; preload only the display weight used above the fold.

| Style | Size (fluid) | LH | Weight |
|---|---|---|---|
| Display / wordmark | clamp(56px, 10vw, 168px) | 0.9 | 600 |
| H1 | clamp(44px, 6.4vw, 104px) | 0.95 | 600 |
| H2 | clamp(34px, 4.4vw, 68px) | 1.02 | 600 |
| H3 | clamp(22px, 2vw, 30px) | 1.2 | 600 |
| H4 | 20px | 1.3 | 600 |
| Body-L | 18px (mobile 17) | 1.7 | 400 |
| Body | 16px | 1.7 | 400 |
| Small | 14px | 1.6 | 400 |
| Label (mono) | 12–13px uppercase | 1.4 | 500 |
| Figure-XL (calculator result) | clamp(44px, 5vw, 80px) mono/tabular | 1 | 500 |

Rules: body ≥16px on mobile; line length 60–75ch desktop, ≤60ch mobile; `text-wrap: balance` on short headings with a max measure; one `h1` per page, no skipped levels.

### Spacing, grid, radius, depth
- Base unit 4px. Tokens: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160.
- Section padding: mobile 96px · tablet 128px · desktop 160px (top/bottom).
- Container: max 1320px content; gutters 20px (mobile) · 32px (tablet) · 48px (desktop). 12-col grid desktop, 8-col tablet, 4-col mobile; column gap 24/32px.
- Radius: 6 (inputs, chips) · 14 (cards) · 24 (feature panels) · 999 (pills/buttons).
- Depth (3 levels, color-tinted, low opacity — no flat `shadow-md`):
  - base: surface-1, hairline border
  - elevated: surface-2 + `0 1px 0 rgba(255,255,255,.04) inset, 0 12px 32px -12px rgba(0,0,0,.6)`
  - floating: surface-3 + `0 24px 64px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(143,227,136,.06)`
- z-index scale: base 0 · raised 10 · sticky 20 · header 40 · menu/sheet 100 · modal 1000 · toast 1100.

### Breakpoints
375 (base, mobile-first) · 640 · 768 (tablet) · 1024 (desktop nav switch) · 1280 · 1440 (reference desktop).

---

## 5. Component inventory

Header/nav + Solutions disclosure menu · Mobile menu sheet · Skip link · Buttons (primary / secondary / ghost / text-link; sizes md 48px, lg 56px) · Pill badge / status pill · Fact rail item · Product card (range, term, speed, best-for) · Comparison table (responsive → stacked cards on mobile) · Stepper (horizontal desktop / compact mobile) · Currency input · Segmented control (radio group) · Select · Chip grid (radio group) · Checkbox · Date input · Masked input (EIN) · File dropzone · Result panel (range figure, matched list, states) · Timeline / stage list · Industry tile · Testimonial card (placeholder) · Stat block (placeholder) · Security card · Callout (info / warning / risk) · Accordion (FAQ) · Toast · Error summary · Footer · Placeholder badge (dev-visible "PLACEHOLDER" marker for swap-out content).

---

## 6. Responsiveness

| Area | Mobile (<768) | Tablet (768–1023) | Desktop (≥1024) |
|---|---|---|---|
| Nav | Logo + Apply + menu sheet | same | Full inline nav + disclosure menu |
| Hero | Stack: copy → CTAs → render; render ≤55svh; no floating cards overlap copy | Copy + render stacked, larger render | Split / layered composition with floating micro-cards |
| Calculator | One step per screen; result card after; sticky mini-summary bar | Same, wider inputs | Inputs left, sticky result right |
| Product compare | Swipe-free stacked cards | 2×2 grid | 4-col cards or table |
| Timeline | Vertical stepper, no pinning | Vertical | Pinned horizontal progress (reduced-motion: static) |
| Apply | Single column; full-width 56px buttons; stepper collapses to "Step 2 of 4 · Owner" | Two-column field pairs where logical | Two-column pairs + side summary |

Use `min-h-svh/dvh`, not `100vh`. No horizontal scroll at 375px (verify `scrollWidth`). Contain overflow on pinned sections, not on `html` (ScrollTrigger breaks otherwise).

---

## 7. Accessibility requirements (WCAG 2.2 AA)
- Contrast per table above; control borders & focus indicators ≥3:1.
- Focus: `:focus-visible` 2px `--accent` ring + 2px offset (on light sections: `--ink-text` ring). Never removed. Sticky header must not obscure focused element (`scroll-padding-top` = header height).
- Landmarks: `header`, `nav[aria-label]`, `main#content`, `footer`. Logical heading order.
- Keyboard: Tab order = visual order; menus Esc-closable; accordion buttons `aria-expanded` + `aria-controls`; segmented controls are native radio groups (arrow keys); stepper uses `aria-current="step"`; file dropzone has a real `<button>`/input.
- Forms: visible `<label for>`, required marked (* + "required" in accessible name), helper text persistent, validate on blur, error text below field linked with `aria-describedby`, error summary focused on failed submit, `autocomplete` tokens (given-name, family-name, organization, email, tel, street-address, postal-code, bday), `inputmode` numeric for money/EIN/ZIP.
- Live regions: calculator result `aria-live="polite"` announcing full phrase; toasts polite, no focus steal.
- Targets: ≥44×44px for all interactive elements; ≥8px spacing between adjacent targets.
- Motion: `prefers-reduced-motion` → no smooth-scroll hijack, no pin, no parallax, reveals render final state; hero video replaced by poster frame. Auto-moving content (marquees, if any) has pause and stops on focus/hover.
- Media: meaningful renders get alt text; decorative renders `alt=""`/`aria-hidden`. Videos muted, no audio, `playsinline`, pausable.
- Language `lang="en-US"`; currency formatted `en-US`.

---

## 8. Interaction & motion principles
- Motion conveys cause→effect (money moving, time compressing, step advancing). Max 1–2 animated focal elements per viewport.
- Only `transform` and `opacity`. Never `transition-all`.
- Tokens: `--dur-fast 160ms` (hover/press) · `--dur-base 260ms` (state) · `--dur-slow 640ms` (reveals) · exit ≈ 65% of enter.
- Easing: `--ease-out-expo cubic-bezier(0.16,1,0.3,1)` for arrivals · `--ease-spring cubic-bezier(0.34,1.56,0.64,1)` for press/select feedback (small scale 0.97→1) · linear only for continuous progress.
- Scroll: GSAP + ScrollTrigger reveals (y 16px, opacity, stagger 40–60ms); Lenis smooth scroll desktop only, off for reduced motion. Pinned timeline desktop only.
- Calculator: figure count-up (tabular, ≤600ms), matched products crossfade; step transitions slide ±24px with direction (forward = left, back = right).
- Buttons: hover lift (translateY -1px) + glow opacity; active scale 0.97; focus-visible ring. Cards: hover raise + border brighten.
- Loading: button spinner + disabled during mock submit (≥600ms so it reads), then success.
- Verify scroll-driven motion with headless puppeteer at explicit scroll offsets (Browser pane freezes rAF when hidden).

---

## 9. Performance
- Hero video: H.264 MP4 + WebM, ≤3MB, poster AVIF/WebP, `preload="metadata"` for below-fold, lazy for all non-hero media; declare width/height or `aspect-ratio`.
- Fonts: 3 families max, subset weights, `display=swap`.
- Scripts `defer`; GSAP/Lenis from cdnjs pinned versions. Target CLS < 0.1.

---

## 10. Build conventions (for Phase 3)
- Static multi-page: one `index.html` per route folder; Tailwind via CDN (project rule) with a shared config script; shared `assets/site.css` (tokens, components) and `assets/site.js` (nav, calculator, forms, motion) to avoid duplication across 8 pages.
- Custom brand colors only — no default Tailwind palette.
- Serve with `node serve.mjs 3100`; screenshots with `node screenshot.mjs http://localhost:3100/<route> <label>`.
- Placeholder content wrapped with `data-placeholder` + visible badge toggle, so the client can find and replace every item.
