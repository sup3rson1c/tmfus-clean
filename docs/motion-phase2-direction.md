# TMF Team — Motion upgrade, Phase 2 (creative direction)

Phase 2 of the motion pass (frontend-design + scroll-craft). Written 2026-09-13.
Authority: this document governs how the motion looks and is choreographed. `motion-phase1-ux-plan.md` governs usability, accessibility, performance and responsive limits; where they conflict, this document wins on look and Phase 1 wins on function. The approved identity in `phase2-creative-direction.md` (palette, type, "Engraved time", imagery rules) is unchanged.
Brief (self-authored under explicit creative delegation): `D:\Desktop\Claude Code\scrollcraft\builds\tmf-team\BRIEF.md`.

---

## 1. Subject, audience, single job (unchanged)

A US business-funding brokerage whose one real promise is time. Owner-operators deciding under pressure. The site's job: take an owner from "I need capital" to "I know my number and I've started the application", feeling that the firm is exact, calm and honest.

## 2. Concept: "Rose engine"

A rose engine is the lathe that cuts guilloché, the engraved patterns on banknotes and watch dials. Its motion is the motion of this site. Nothing floats, bounces or glows; things move the way engraving machines, watch movements and numbering presses move.

| Verb | What it looks like here | Where |
|---|---|---|
| **Rotate** | Dials, hands and the brand mark turn; mechanical settle, never springy | Hero ring, the 48-hour dial, header mark |
| **Trace** | Hairlines are cut at a constant speed along their path, never faded in | Dial engraving, icons, diagrams, horizon line, rules |
| **Strike** | Figures and marks land like a die: scale 1.035 → 1 and opacity in 180ms, no overshoot | Calculator range, locks, nodes, facts |
| **Number** | Digits roll on wheels like a numbering machine, right to left | Real figures only: estimate, 14 years, 50 / 40 / 10, reference numbers |
| **Rise** | Display lines rise out of a mask | Hero H1, final CTA heading, inner-page H1s |
| **Light** | A sheen band rakes across engraved metal as the pointer or scroll moves | Hero disc |

Banned vocabulary: bounce and elastic easing, blur-in, glows, autonomous loops longer than 5s, marquees, magnetic buttons, card tilt, custom cursor, scroll progress bars, scroll-scrubbed video.

## 3. Page grammar: "Instrument ledger" (new)

**Organising logic.** Every section is one of two surfaces, with different laws:
- **Instruments** (dark vault grounds): things rotate, trace and respond, and some can be operated. Up to two may pin.
- **Ledgers** (statement-paper grounds): things print in order and then hold still. Never pinned.

**Chrome.** The site header is a letterhead, not a progress device: wordmark, navigation, one action. Its dial mark keeps time with the page (the hand turns once over the full scroll) and nothing else reports position.
**Sequence.** Instrument → working instrument (calculator) → ledger → peak instrument → substance → ledger → close.
**Ending.** The account settles: a final instrument at rest (the horizon), the visitor's own estimate if they made one, and one action.
**Bans.** Drift gradients between grounds (hard edges; paper feeds in by a wipe); pinned ledgers; more than two pins per page; decorative autonomous motion; section counters except real process steps; counters on anything that isn't a client figure.
**Leans on.** `pin` for instruments, `reveal` for paper feeds and diagrams, `parallax` for layered scenes, `kinetic` lines (three per page at most), and two bespoke devices, *trace* and *strike/number*.

### Why the other seven grammars lost
| Grammar | Why not |
|---|---|
| Filmic one-shot | Forbids multiple entry points and tool chrome. This site has a nav, a Solutions menu, `#estimate` anchors and a working calculator. |
| Chaptered editorial | Forbids the fixed bar and media above the fold; the approved hero is an object on stone and the multi-page nav must stay. |
| Live surface | Forbids marketing chrome and display type. TMF is a service; the calculator is one instrument, not the whole page. |
| Continuous world | Requires one fixed canvas with no sections. There is no geography to travel, and a flight would bury the calculator. |
| Typographic poster | Forbids photographic grounds; the identity depends on the engraved renders. |
| Gallery / catalog | The visitor's question is "can I get money fast, and are these people honest", not "what are the options". |
| Split stage | No two-sided argument runs the whole page; "brokerage, not lender" is one section. |
| Rhythmic cutlist | Built for energy brands. Owners under pressure need calm certainty, not a pulse. |

## 4. Signature move and fingerprint gate

**Signature move: the engraving clock.** In "Where the hours go", the hour hand is the cutter of a rose engine. Scroll, drag the hand, or press arrow keys, and the hand sweeps from hour 0 to hour 48, engraving an interlaced guilloché band into a blackened steel plate behind it. Each hour's sector is cut as the hand passes it; winding back un-cuts it. Because the band's curves are periodic around the dial, the engraving closes seamlessly exactly at hour 48, when the funding window completes. The hand is a real slider, so scroll, pointer and keyboard all drive the same instrument.

**Tell-someone sentence:** it's the site where you wind the clock through the 48 hours it takes to get funded, and the hand engraves the steel as the hours go by.

**Fingerprint gate.** The registry (`D:\Desktop\Claude Code\scrollcraft\FINGERPRINTS.md`) is empty: this is the first scroll-craft build in this workspace, so it has no rows to clear. The row is appended after verification.

## 5. Home score

| # | Act | Feeling | Device family | Section height (desktop) | What moves | Reduced motion |
|---|---|---|---|---|---|---|
| 1 | Hero | Composure | **parallax** (layered planes) + pointer light | 170svh, sticky 100svh (70svh travel) | Plate recedes; disc lifts off the plinth, shadow softens; stone slab rises in front; dust layers pass; sheen rakes the engraving; second beat prints | Resting composition, no sticky space |
| 2 | Calculator | Agency | **flow** (input-driven) | natural | Card and certificate rise on entry; steps slide by direction; the result is struck | Instant states |
| 3 | Four ways to fund | Orientation | **reveal** (paper feed) + print | natural | Paper wipes up over the vault; the double rule traces; rows print | Paper present; rows present |
| 4 | Where the hours go | **Anticipation → relief (peak)** | **pin** + engraving clock | 300svh, sticky 100svh (200svh travel) | Hand, engraving, windows, readout, stage cues; drag and keys | Static complete dial; slider still works |
| 5 | Who we fund | Recognition | **flow** + trace | natural | Ledger rules draw; each trade mark is engraved in turn; names rise | Present |
| 6 | A brokerage, not a lender | Trust | **reveal** (scroll-drawn diagram) | natural | Flow line You → TMF Team → Funder; nodes strike; the commission line runs back from Funder to TMF Team; "14 years" numbers | Diagram complete |
| 7 | In owners' own words | Belonging | **flow** | natural | Quiet stagger (placeholders; no figures animate) | Present |
| 8 | Handled like a vault | Safety | **parallax** (image bed) + strike | natural | Vault bed settles (slower, scale 1.08 → 1); each protection's lock strikes shut | Present |
| 9 | Straight answers | Clarity | **flow** | natural | Answers open instantly with a 6px rise | Present |
| 10 | Know your number | Resolve | **kinetic** + trace, holds | natural | Heading lines rise; a hairline of light engraves across the horizon; the visitor's estimate waits beside the button | Present |

Checks: five device families (parallax, flow, reveal, pin, kinetic) plus two bespoke devices; no family twice in a row; no scrub video; the peak is the largest span by a clear margin and the act before it is the stillest; page length target ≤ 14 viewport-heights at 1440×900 (section padding trimmed to pay for the two sticky spans).

## 6. Hero: layered depth

### Layer contract
| Plane | Asset and depth | Independent movement (desktop, over the 70svh travel) | Contact / occlusion rule |
|---|---|---|---|
| Far environment | **Clean plate** (new, from A1: same camera, disc removed), full-bleed, with the existing multiply colour layer and gradient to Vault | y −18px, scale 1 → 1.05; pointer ±6px | Contains no disc |
| Rear atmosphere | Diagonal key-light shaft (CSS gradient, screen) + 6 rear dust motes | Shaft opacity .55 → .8; motes y −40px; pointer ±10px | Sits behind the disc |
| Contact shadow | Soft ellipse on the plinth (CSS) | Anchored to the plate; opacity .7 → .3, scaleX 1 → 1.12 as the disc lifts | Always under the disc's resting footprint |
| **Subject** | **Disc cutout** (A1 disc, geometric alpha from measured ellipses) + 48h ring, hand and chips on the same plane + sheen band masked to the disc | y −56px (lifts off the plinth), scale 1 → 1.04; pointer ±14px; ring hand sweeps 0 → 13.5h on load | Starts resting on the plinth; shadow proves the lift |
| Front atmosphere | 5 larger, softer dust motes | y −140px; pointer ±24px | Pass in front of the disc |
| Near foreground | **Stone slab edge** (new), full-width, lit chamfer | Rises from +38svh to −6svh, covering the lower third | Occludes the plinth and the lower rim; never the headline or CTAs |
| Typography and controls | Status pill, H1 (2 lines ≥ 1280px), lede (19 words), CTAs; second beat: specialist sentence + fact rail | First beat y −8svh; second beat prints onto the slab at p .35 → .7 | Always above every plane; contrast checked on the composite |

### Choreography
- **Load (≤ 1.6s):** plate and disc are painted from the first frame; the plate brightens from 80% to full exposure; H1 lines rise (starting at 150ms, done by 1s); the ring traces round the disc; the hand sweeps 0 → 13.5h with `--ease-mech`; chips strike in order Apply → Decision → Funds.
- **Pointer (fine pointers):** planes shift by depth; the sheen band follows the pointer across the engraving, so the steel catches light as you move. Lerped, reset on leave.
- **Opening (p = 0):** disc at rest on the plinth, headline and CTAs, dust in the light.
- **Midpoint (p ≈ .5):** the disc has lifted and the shadow has widened; the slab's lit edge is crossing the lower third; "When you're ready, a specialist comes back within 24 hours with a pre-qualified offer." prints, followed by the four facts.
- **Resolved (p = 1):** the slab covers the plinth; the disc hovers above its edge; facts complete. The stage releases and the calculator section continues on the slab's dark ground.

### Composition
```
DESKTOP 1440×900
┌───────────────────────────────────────────────────────────────────────────────┐
│ [mark] TMF TEAM       Solutions▾  Calculator  About  Contact   (000)… [Apply] │
│  ● Reviewing applications · average decision 3–24h      ░░ rock wall ░░░░░░░░ │
│                                                          ╲ light shaft  ·     │
│  CAPITAL THAT RESPECTS                                  ·   ╲    ·            │
│  YOUR TIMELINE.                                   ╭────── APPLY 0H ──╮        │
│                                                  │    ◉ steel disc    │ DECISION
│  See which funding products fit your business    ╰── FUNDS 24–48H ───╯        │
│  in about a minute. No login, no credit pull,   ▓▓▓▓▓▓▓ plinth top ▓▓▓▓▓▓▓▓▓▓ │
│  no contact details.                            ▓▓▓▓▓▓▓ plinth face ▓▓▓▓▓▓▓▓▓ │
│  [ See what you qualify for ]   Apply now →                                   │
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ slab edge rises on scroll, second beat prints here ▁▁▁▁▁▁▁▁▁▁ │
└───────────────────────────────────────────────────────────────────────────────┘

PHONE 390×844 (natural flow, no sticky)
┌──────────────────────────┐
│ [mark] TMF TEAM [Apply][≡]│
│ ● Avg decision 3–24h     │
│ CAPITAL THAT             │
│ RESPECTS YOUR            │
│ TIMELINE.                │
│ lede (19 words)          │
│ [See what you qualify for]│
│ Apply now →              │
│   ░ rock ░  ╭ring╮       │  portrait plate; disc rises
│        ◉ disc on plinth  │  into view at 0.85× scroll
│ ▁▁▁ slab edge ▁▁▁▁▁▁▁▁▁▁ │
│ specialist sentence      │
│ facts 2×2                │
└──────────────────────────┘
```
Phone: portrait plate, disc and ring below the copy, travel ≤ 40px, no pointer light, no sticky beat. Short landscape: resting composition.

## 7. The peak: the engraving clock ("Where the hours go")

### Stage (desktop ≥ 1024 wide and ≥ 700 tall)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│        ╭──────── 48-hour ring ────────╮          WHERE THE HOURS GO.         │
│      ╭╯ ticks · 0 · 12 · 24 · 36      ╰╮         From form to funding in     │
│      │  ░ blackened steel plate ░      │         three stages…               │
│      │  engraved band, cut up to hand   │                                    │
│      │            14h                   │         Within 24 hours            │
│      │     DECISION WINDOW              │         Talk to a specialist       │
│      │  hand = cutter ────────◉ handle  │         A funding specialist…      │
│      ╰╮ decision arc filling (green)   ╭╯                                    │
│        ╰───────────────────────────────╯         [Hour 0] [Within 24h] [24–48h]
│              Drag the hand to set the hour                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Layers (back to front)
1. Vault ground with a soft radial light behind the dial.
2. **Dial plate** (new asset: blackened steel, top-down, circular alpha) with a static conic brushed sheen (soft-light).
3. **Engraving canvas:** the guilloché band, cut from angle 0 up to the hand's angle. Bright steel hairlines (Banknote at low alpha, additive), the sector just cut slightly brighter.
4. **Ring (SVG):** 48 ticks (major every 6h), numerals 0 / 12 / 24 / 36 in Plex Mono; dim full-length window tracks; the **decision arc (3–24h, Greenback)** and **funding arc (24–48h, Banknote 62%)** fill only up to the current hour.
5. **Hand:** a hairline from the centre to the ring with cutter points where it meets each engraving track (they ride in and out with the lobes) and a **handle** on the ring: the slider (44px target).
6. **Readout** (centre): whole hours in Plex Mono, window label below: "See your options" (0–3h), "Decision window" (3–24h), "Funding window" (24–48h), "48 hours" at the close.

### Engraving geometry
- Track *i* of *K* = 16: radius `r_i(φ) = R_i + B · cos(m·φ + i·2π/K)` with *m* = 24 lobes, R_i spread between 0.34 and 0.80 of the ring radius, B ≈ 0.03. A second family with the opposite phase interlaces for the moiré.
- Every curve is periodic in φ over 2π, so the band drawn from φ = 0 to φ = 2π closes exactly: that is hour 48.
- Drawn on a DPR-capped canvas (≤ 2×): incremental when moving forward, a full redraw (≈ 20k segments, a few ms) when moving back. Final tuning of K, m and B happens on screenshots.

### Hour mapping and cues
- Progress over the 200svh travel: p 0 → .06 holds at 0h (greet); p .06 → .94 maps to 0 → 48h with small detents at 3h and 24h; p .94 → 1 holds at 48h (closure). Authored silence, noted in BRIEF.md.
- Stage cues overlap: stage 1 from 0h (greet) to 7h, stage 2 from 5h to 27h, stage 3 from 25h and holds. Heading and lede hold throughout.
- The whole stage carries `data-sc-verify-state` with the rounded hour and arc fills, and `data-sc-verify-hold` only during the two authored holds.

### The control
- Handle: `role="slider"`, 0–48, `aria-valuetext` such as "Hour 14 of 48: talk to a specialist". Arrows ±1h, Page keys ±6h, Home and End.
- Drag the handle or anywhere on the ring (4px threshold); click or tap the ring to jump; the three jump buttons below the stage set 0h, 14h and 36h.
- Every input scrolls the page to the matching point in the sticky range, so scroll stays the single source of truth.
- States: rest; hover (ring and handle brighten); focus-visible (2px Greenback ring on the handle); dragging (handle scale 1.1, grabbing cursor).
- Hint under the dial, fine pointers only: "Drag the hand to set the hour." Touch: "Tap the ring to set the hour."

### Smaller screens and reduced motion
- Below 1024px or under 700px tall: a compact dial (min(78vw, 360px)) sticks under the header while the three stages scroll beneath; the hour follows the section's scroll progress, so the band is still engraved as you read.
- Reduced motion: no sticky travel; the dial is drawn complete at 48h with both windows filled; stages listed; the slider still updates readout, band and highlighted stage instantly.

## 8. The other home acts

- **Calculator (strike).** On result: the certificate's corner rosette is replaced by a small guilloché band seeded from the answers (lobes from revenue, tracks from time in business), cut by a sweep in 700ms; the range digits roll into place (low first, then high); matched products strike in with a 40ms stagger. Edits after completion re-roll only the digits that change. The sample "Illustrative" tag and sentence stay until the real formula arrives.
- **Four ways to fund (paper feed).** As the section enters, the paper wipes up from the bottom with 32px top corners easing flat (done by 40% of its travel); the double rule under "Statement of capital paths" traces left to right; column heads print; each row strikes in (50ms stagger) with its ledger rule tracing underneath. Then stillness.
- **Who we fund (ledger).** The grid hairlines draw outward from the top-left; each trade icon is traced at constant speed (700ms, 60ms stagger); names rise 14px. The equal icon grid is kept because it is a lookup list, but it now reads as a ruled ledger, not cards.
- **A brokerage, not a lender (money direction).** Scroll-linked over the diagram's visible life: the connector traces You → TMF Team → Funder, each node strikes as the line arrives, then a thin Greenback return line traces from Funder back to TMF Team under "Commission". "14 years" rolls up once. Copy stays fully visible.
- **In owners' own words.** A quiet 60ms rise. Placeholder figures never animate.
- **Handled like a vault.** The A7 bed moves at 0.8× with a 1.08 → 1 settle; each protection's lock icon strikes shut (shackle drops 3px) as its row reaches 70% of the viewport.
- **Straight answers.** Unchanged behaviour (instant open, 6px rise).
- **Know your number (settlement).** Heading lines rise; a hairline of light traces outward from the centre along the A9 horizon and stays; buttons never move after arrival. If the visitor made an estimate this session, a small certificate line sits above the buttons: "Your illustrative estimate: $85,000–$115,000 · Edit".
- **Footer.** The outlined wordmark rises into place once (clip wipe + 16% lift).

## 9. Chrome and page transitions

- **Header mark:** the brand mark's hand turns once over the full page scroll (CSS variable, rotate only). Static under reduced motion.
- **Page transitions:** cross-document View Transitions. The header keeps its own `view-transition-name` and does not move; the old page fades out and lifts 12px (180ms), the new page fades in from 16px below (320ms, `--ease-out`). Off under reduced motion; unsupported browsers navigate normally.

## 10. Inner pages

- **Page hero system (all inner pages):** H1 lines rise on load; the image card is present from the first frame and settles from 1.06 scale while its image moves at 0.85× within the card (≤ 60px); a fine-pointer parallax of ±8px inside the card; fact rail figures strike in order.
- **Cash injection:** "Payments that follow your sales" runs the week as you scroll: each day's revenue bar grows from the baseline, and its remittance bar follows a beat later (cause, then effect). "Day 1 to funded": the line traces with scroll and each day's node strikes as the line reaches it. "Not a loan." feeds in as paper; its terms print.
- **SBA loans:** the two program cards rise; the 50 / 40 / 10 bar fills left to right in sequence while each percentage rolls to its value; checklist ticks are traced in order; the risk callout's rule draws down.
- **Home equity:** "Where the hour goes" gains a compact 60-minute dial whose hand follows the stage in view; the score track fills and the 660 / 700 / 740 / 780 marks strike in turn; the risk banner is static.
- **About:** principle icons are traced; the brokerage diagram as on home; "14 years" rolls; team placeholders rise.
- **Calculator page:** knob hero follows the page hero system; the calculator strike as on home.
- **Contact and Apply (calm):** no parallax near inputs. Apply's stepper line traces between steps; success checks are traced; Apply's reference number rolls like a numbering machine.

## 11. Type, labels and copy

- **Kinetic budget:** three split headings per page at most (home: hero H1, final CTA; inner pages: H1, CTA). Section H2s rise as whole blocks, never split.
- **Eyebrows on home:** keep "Funding calculator" and "How we're paid"; remove "How it works", "Industries", "Client stories", "Security" and the CTA eyebrow. Inner pages: at most one section eyebrow per three sections, keeping only those that add information.
- **Hero copy:** lede becomes "See which funding products fit your business in about a minute. No login, no credit pull, no contact details." The removed sentence opens the second beat.
- **Em dashes:** none visible. Page titles use "·"; the calculator's empty range and empty summary values use a neutral placeholder instead of "—".
- **New microcopy:** slider value text ("Hour 14 of 48: talk to a specialist"), jump buttons ("Hour 0", "Within 24h", "24–48h"), dial hint, CTA estimate line.

## 12. Motion tokens (additions)

| Token | Value |
|---|---|
| `--ease-mech` | cubic-bezier(.77, 0, .175, 1) |
| strike | 180ms, scale 1.035 → 1, opacity 0 → 1, `--ease-out` |
| number | 700ms per figure, digit stagger 30ms right to left, `--ease-out` |
| rise | 900ms, 8% line stagger, expo out |
| trace | constant speed (`ease: none`), 600–900ms for icons; scroll-linked for diagrams |
| light | pointer lerp 0.08 |
| `--engrave` | rgba(241, 242, 236, .5) hairlines on steel |
| `--sheen` | rgba(241, 242, 236, .22) light band |

## 13. Assets (Higgsfield)

**Style preamble** (verbatim in every new prompt):
> Low-key product photography on a 100mm lens, shallow depth of field, true blacks, fine film grain. One soft key light from the upper left, a thin cool rim light with a faint green cast from the right, deep falloff into shadow. Materials: honed black stone, textured black rock, brushed and blackened steel. Colour grade: near-black charcoal with a trace of green, silver highlights, desaturated mid-tones. Photographic realism. No text, no numbers, no logos, no people, no money, no glow, no plastic sheen.

| ID | Placement | Method | Notes |
|---|---|---|---|
| ID | Placement | Method (as generated) | Notes |
|---|---|---|---|
| M1 | Hero wide scene | Outpaint A1 to 16:9 | Keeps A1's disc, plinth, camera and light; alignment reference |
| M2 | Hero clean plate (wide) | Edit M1: remove the disc, rebuild the plinth top | Lines up with M1 |
| M3 | Disc cutout | Background removal on A1 (clean, disc only); contact shadow in CSS | Replaced the planned geometric mask |
| M4 / M4b | Hero portrait scene + clean plate | Outpaint A1 to 9:16, then remove the disc | Phone composition |
| M5 | Foreground stone slab | Generated with a transparent background (21:9) | Real alpha; lit chamfer across the full width |
| M6 | Dial plate (peak) | Generated with a transparent background (1:1) | Real alpha; plain blackened steel with a polished bevel |

All seven jobs were preflighted, inspected over grey and in a test composite, and logged in `asset-log.md`: 17 credits spent, 422.5 left.

## 14. Build notes

- **Runtime:** GSAP 3.13.0 core + ScrollTrigger + SplitText + DrawSVGPlugin (cdnjs, pinned), Lenis 1.3.4, `gsap.matchMedia()` contexts for desktop / phone / reduced motion. The scroll-craft engine is not loaded (see Phase 1 §9).
- **Files:** `src/css/09-motion.css`; `assets/js/motion.js` (shared: reveals, rise, strike, number, trace, header mark, harness markers); `assets/js/hero.js` (layered scene); `assets/js/clock.js` (engraving clock; replaces the flat dial in `dial.js`); page moments in `assets/js/moments.js`.
- **Sticky stages** are CSS (`position: sticky`) inside sections sized in CSS behind `html.js.motion-ok`, with no JS pin spacers.
- **Harness compatibility:** sections carry `data-sc-act` (`pin` or `flow`) and `data-sc-stage`; animated copy carries `data-sc-cue`; the peak stage publishes `data-sc-verify-state`; `motion.js` adds `html.sc-ready` once initialised.

## 15. Self-critique

| Check | Verdict and change |
|---|---|
| Would a similar prompt land here anyway? | Layered parallax, one pin and rising headings are common. They are kept only where the brief earns them (hero depth is a standing requirement; the pin carries the peak) and each is given something only this subject has: light raking real engraving, an engraving that closes at hour 48, a commission line that runs from the funder. |
| First peak idea | A stylus racing one loop per hour (48 loops) was too fast to read under a hand (a loop every ~37px of scroll) and dizzying. **Changed** to the hand as a multi-point cutter engraving the band as it sweeps: calm, legible, still closes at 48. |
| First hero idea | A live WebGL disc turning toward the viewer. Most spectacle, but a CG disc against photographic stone risks a mismatch, and it would compete with the peak. **Changed** to photographic planes with a clean plate, a measured cutout and pointer light. |
| Considered and cut | A scroll-linked marquee of industry names (generic), magnetic CTAs, a scroll progress bar (the header mark does this quietly), a serial number on the estimate certificate (reads like an official document), scroll-scrubbed video of the disc (AI video warps engraving). |
| Accessory to remove | Dust motes are on probation: if the first hero screenshots read busy, they go. |
| The one risk | The peak is a live instrument the visitor operates, with a pattern that must look genuinely engraved. |
