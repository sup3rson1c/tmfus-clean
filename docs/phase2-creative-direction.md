# TMF Team — Phase 2 Creative Direction

Phase 2 (frontend-design). Written 2026-09-12. Governs every visual decision in the build.
Phase 1 (`phase1-ux-plan.md`) still governs structure, accessibility, responsiveness and interaction quality; where this document changes a Phase 1 *visual* token, this document wins, and contrast is re-verified.

---

## 1. Subject, audience, single job

- **Subject:** American small-business capital, arranged by a brokerage whose one real promise is *time* — a decision in 3–24 hours, funds 24–48 hours later.
- **Audience:** owner-operators (restaurants, trucking, construction, salons, clinics) deciding under pressure, and half-burned by brokers before.
- **Single job of the site:** get an owner from "I need capital" to "I know my number and I've started the application" — while feeling that this firm is exact, calm and honest.

## 2. Concept: "Engraved time"

Two things are native to this world and nowhere else:

1. **The engraving of American money.** Guilloché rosettes, intaglio hairlines, microprint borders, serial numbers — the visual language that has meant *this is real and trusted* for 150 years.
2. **The clock TMF is selling.** 3h. 24h. 48h. Their headline is literally "Capital that respects your timeline."

The direction fuses them: **precision-engraved instruments on black stone.** Dark, machined, quiet like Moto; exact and legible like NexDash; with Mercury's calm product proof. Not "crypto neon", not "bank navy".

## 3. Signature element — the 48-hour engraved dial

The one thing the site is remembered by.

- A circular **guilloché rosette** (procedural SVG, hairline strokes) that is also a **48-hour instrument dial**: 48 tick marks on an outer ring, with two engraved arcs — **DECISION 3–24h** and **FUNDS 24–48h** — and mono labels on the ring.
- At its center sits a **Higgsfield 3D render**: a machined steel disc with a guilloché-engraved face, on black stone, rim-lit. The SVG ring sits concentric *outside* the render with generous clearance (tolerant to render alignment).
- **Home hero:** dial on the right (desktop) / below copy (mobile). Page load: rosette layers fade and counter-rotate into place, a hand sweeps 0h → 24h and settles. *Transform + opacity only.*
- **Home "Where the hours go":** the dial returns pinned (desktop only); scroll rotates the hand through Application (0h) → Decision (3–24h) → Funds (24–48h) while the stage copy swaps. Mobile / reduced motion: static dial + vertical stages.
- **Revision after A1 came back:** the render shows the disc at ~35° from overhead, so its face is an ellipse. Build it as a layered instrument: A1 as the grounded object, the SVG dial ring laid over it in matching perspective (CSS `rotateX` on a wrapper, tuned by screenshot) so the ring reads as engraved into/hovering just above the disc face; the flat, front-on version of the dial is used in "Where the hours go", on HELOC and on mobile.
- **Echoes (restrained):** a thin engraved rosette corner-mark on calculator result panel; microprint border line on the light "statement" sections; serial-number-style reference IDs on Apply confirmation. Nowhere else.

## 4. Palette (named) — revised from Phase 1

**Critique of Phase 1 palette:** `#07090C` + bright `#8FE388` green = the generic "near-black + single acid accent" look. **Changed:** primary CTA becomes paper-white (like a crisp bill, and like Moto's pill), green is desaturated to real currency ink and used sparingly for *meaning* (status, positive, focus), and a hairline engraving green carries texture.

| Name | Hex | Role |
|---|---|---|
| **Vault** | `#0A0C0B` | page base — black with a trace of green |
| **Intaglio** | `#121614` | section / card surface |
| **Plate** | `#1A201D` | floating: menus, sticky result, popovers |
| **Etch** | `#2A3530` | engraving hairlines, rosette strokes, dividers (decorative) |
| **Banknote** | `#F1F2EC` | primary text on dark **and** primary CTA fill |
| **Silver** | `#A9B0AA` | secondary text on dark |
| **Greenback** | `#86B79A` | status, positive figures, focus ring, DECISION arc |
| **Statement** | `#E5E8E2` | light sections base (bank-statement paper, cool — *not* cream) |
| **Ledger ink** | `#0E1311` | text + primary button on light |
| **Seal green** | `#2D6A4B` | green text/links on light |
| **Protest red** | `#E0786B` dark / `#B3362B` light | errors |

Brass was dropped from Phase 1 (Chanel rule: one accessory).

### Contrast — verified (WCAG 2.2, computed 2026-09-12)
| Pair | Vault | Intaglio | Plate |
|---|---|---|---|
| Banknote text | 17.43 | 16.21 | 14.71 |
| Silver text | 8.85 | 8.24 | 7.47 |
| Greenback text | 8.65 | 8.04 | 7.30 |
| Protest red (dark) | 6.60 | 6.14 | 5.57 |
| Etch `#2A3530` | 1.54 | 1.43 | 1.30 → **decorative only** |
| Control border `#5F6B65` | 3.53 | 3.28 | **2.98 ✗** → on Plate use a lighter control border (≥ `#66726C`, verify at build) |

| Pair | Statement `#E5E8E2` | White |
|---|---|---|
| Ledger ink | 15.16 | 18.75 |
| Seal green | 5.18 | 6.41 |
| Red (light) `#B3362B` | 4.88 | 6.04 |
| Ink-2 `#4A524D` | 6.51 | 8.06 |
| Control border `#7D8680` | 3.03 | 3.75 |

Buttons: Vault label on Banknote CTA 17.43 · Statement label on Ledger-ink button 15.16.

## 5. Typography

**Critique of Phase 1:** Geist is a default "tech site" body face. **Changed:** body moves to **Public Sans** — the typeface of the U.S. Web Design System (federal websites). It reads as official, plain-spoken and American without saying so.

| Role | Face | Treatment |
|---|---|---|
| **Display** | **Archivo** (variable, `wdth` 125 = Expanded) | ALL CAPS for H1 and short section statements only, weight 560–620, tracking `-0.02em` to `-0.03em`, line-height 0.92. Used with restraint: hero, section H2s, big result figure labels. |
| **Body / UI** | **Public Sans** | 400 body (line-height 1.7), 500 UI, 600 H3/H4 in sentence case. |
| **Utility / figures** | **IBM Plex Mono** | Amounts, hours, dial labels, eyebrows, reference numbers. Uppercase eyebrows `+0.14em`, 12–13px. Tabular figures. Evokes bank terminals / MICR lines. |

Sentence-case H3s keep the caps display from shouting. Mixed within one headline: never.

## 6. Layout concept

**Rhythm:** dark vault sections with long vertical breathing room, interrupted by two cool "statement paper" sections that behave like printed documents (products comparison, FAQ). Transitions between dark and light are hard edges with a microprint rule — like the edge of a bill.

### Home hero (desktop ≥1024)
```
[TMF mark] TMF TEAM   Solutions▾  Calculator  About  Contact   (000) 000-0000  [ Apply now ]
──────────────────────────────────────────────────────────────────────────────────────────────
● REVIEWING APPLICATIONS · AVG DECISION 3–24H                    ·  ·  ·  ·  ·  ·  ·
                                                              ·     ╭───────────╮     ·
CAPITAL THAT                                                ·  DECISION         ·    ·
RESPECTS YOUR                                              ·   3–24H  │ [3D steel │ FUNDS ·
TIMELINE.                                                   ·         │ guilloché │ 24–48H
                                                             ·        ╰───disc────╯      ·
See which funding products fit your business in about          ·   ┌──────────────────┐
a minute. No login, no credit pull, no contact details.            │ ● Decision ready │
                                                                    │   4h 12m         │
[ See what you qualify for ]   Apply now →                          └──────────────────┘
──────────────────────────────────────────────────────────────────────────────────────────────
$5K–$5M RANGE   │   3–24H DECISION   │   24–48H TO FUNDS   │   NO HARD CREDIT PULL     (mono)
```

### Home hero (mobile 375)
```
[mark] TMF TEAM            [Apply] [≡]
● AVG DECISION 3–24H
CAPITAL THAT
RESPECTS YOUR
TIMELINE.
body (2–3 lines)
[ See what you qualify for ]  (full width)
Apply now →
      ╭─ dial 88vw ─╮
      ╰─────────────╯
$5K–$5M · 3–24h · 24–48h · no hard pull  (2×2 grid)
```

### Capital paths — light "statement" section
```
STATEMENT OF CAPITAL PATHS                                    TMF TEAM · 2026
═════════════════════════════════════════════════════════════════════════════
PRODUCT              RANGE            TERM          DECISION      BEST FOR
Cash Injection       $5K – $2M        3–18 mo       3–24h         revenue-strong, needs speed   →
SBA 7(a) / 504       up to $5.5M      10–25 yrs     30–90 days    lowest rate, can wait         →
Home Equity (HELOC)  $25K – $750K     10–30 yrs     inside 1 hr   owners with property equity   →
Line of Credit       $10K – $250K     revolving     —             recurring, flexible needs     →
─────────────────────────────────────────────────────────────────────────────
microprint ‹TMF TEAM · BUSINESS FUNDING BROKERAGE · NOT A LENDER · TMF TEAM ·›
```
Each row is a large link target with a 3D thumbnail on hover (desktop) / stacked "statement cards" on mobile. The structure is justified: these are the axes owners compare on.

### Calculator
Dark, two columns: inputs on Intaglio cards left; result as a **Plate** panel right styled like an engraved certificate — rosette corner mark, mono figure, matched products list. Result says *Illustrative estimate* until the client formula lands.

### Product pages
Hero = full-bleed dark with the product's 3D object on black stone right, expanded-caps H1 left, fact rail below. Body sections quiet: text + diagrams in Etch linework (504 50/40/10 split as an engraved bar; MCA remittance flex as a hairline wave; HELOC "where the hour goes" as a 60-minute dial — reuses the signature dial at a smaller scale).

## 7. Imagery (Higgsfield) — shared art direction

One world for every render:
- **Set:** black honed stone plinths and textured black rock (Moto), deep shadow, single soft key from above-left, thin cool rim light with a faint green cast (`Greenback`).
- **Materials:** brushed and bead-blasted steel, smoked glass, black anodized metal, **guilloché engraving** on steel faces.
- **Camera:** 85–100mm product lens feel, shallow depth of field, slight low angle, square or 4:5 framing with the object centered and generous negative space.
- **Never:** text, numbers, logos, dollar signs, flags, government seals, people, cash bills/paper money, coins with portraits, neon, purple.
- UI "mockups" are **built in HTML**, not generated (crisp, accessible, editable): decision chips, offer card, matched-products list.

### Asset manifest
| ID | Placement | Aspect | Object |
|---|---|---|---|
| A1 | Home hero dial core | 1:1 | Machined steel disc, guilloché-engraved face, on black stone |
| A2 | Cash Injection hero | 4:5 | Fanned stack of thin brushed-steel plates with engraved edges, top plate lifting |
| A3 | SBA hero | 4:5 | Monolithic black-stone colonnade with steel capitals — institutional, no symbols |
| A4 | Home Equity hero | 4:5 | Simple gabled house form in smoked glass with a warm glowing core, on stone |
| A5 | Line of Credit row thumb | 1:1 | Continuous looped brushed-steel ribbon (revolving) |
| A6 | Calculator hero | 1:1 | Precision knurled steel rotary dial / control knob macro |
| A7 | Security section | 16:9 | Macro of a vault-door locking mechanism in black steel |
| A8 | About hero | 4:5 | Smoked-glass cube revealing an engraved steel core — transparency |
| A9 | Final CTA band | 21:9 | Black stone horizon, thin line of light across it |
| V1 (optional) | Home hero | 1:1 loop | A1 with slow light sweep across the engraving (image-to-video) |

All generations logged in `docs/asset-log.md` (prompt, model, settings, cost, reason).

## 8. Motion direction

Quiet by default; one orchestrated moment per page.
- **Home:** dial load sequence (≈1.6s total) → pinned "Where the hours go" dial scrub. Everything else: 16px fade-up reveals, 50ms stagger.
- **Calculator:** result figure counts up in mono (≤600ms); matched rows crossfade.
- **Product pages:** hero object drifts 12px on scroll (transform), fact rail ticks in.
- **Hover:** CTA pill lifts 1px + inner highlight opacity; statement rows slide their arrow 4px and reveal thumbnail (opacity/transform).
- Easing: arrivals `cubic-bezier(0.16,1,0.3,1)`; press `cubic-bezier(0.34,1.56,0.64,1)` scale 0.97. Never `transition-all`. `prefers-reduced-motion`: static dial, no pin, no Lenis.

## 9. Copy voice

Plain, exact, unhurried — the voice of an underwriter who respects you.
- Hours and dollars stated as numbers, never "lightning fast".
- Say what happens next: "See what you qualify for", "Apply now", "Talk to a specialist". Apply button → "Application received."
- Honest where competitors aren't: "We're a brokerage, not a lender. The funder pays us when your deal funds — you don't."
- Errors direct, no apology: "Enter monthly revenue in dollars, for example 45,000."

## 10. Self-critique log

| Checked | Verdict |
|---|---|
| Hero = big number + stats + gradient? | No — the hero is an instrument (dial) tied to the actual promise. |
| Near-black + single acid accent? | Was in Phase 1. Revised: paper-white CTA, muted currency green used for meaning only, engraving texture. |
| Cream + serif + terracotta? | Avoided — light sections are cool gray statement paper, no serif. |
| Broadsheet hairlines everywhere? | Hairlines confined to the two "statement" sections where the document metaphor is literal. |
| Numbered markers? | Only on the real sequences: 3 funding stages, 4 apply steps, 3 calculator steps. |
| Fonts I'd pick for any fintech? | Replaced Geist with Public Sans (USWDS); Archivo Expanded caps + IBM Plex Mono are subject-grounded. |
| One aesthetic risk | Banknote guilloché as a live, rotating instrument dial at hero scale. |
| Accessory removed | Brass accent, and a planned animated microprint marquee. |
