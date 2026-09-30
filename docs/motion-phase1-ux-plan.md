# TMF Team — Motion upgrade, Phase 1 (UX plan)

Phase 1 of the motion pass (ui-ux-pro-max, planning only, no code). Written 2026-09-13.
Inputs: client feedback "the site looks good but has no movement, it's boring"; the user asked to "make the website move more… look better, feel nicer, and be more interesting" using the scroll-craft skill.
Governs: usability, accessibility, performance, responsive behaviour and interaction states of every new motion. Phase 2 (`motion-phase2-direction.md`, frontend-design + scroll-craft) owns the look, the composition and the choice of device per section, inside these limits.
Still in force: `phase1-ux-plan.md`, `phase2-creative-direction.md` (palette, type, "Engraved time"), `handoff.md` (placeholders, compliance notes).

---

## 1. Diagnosis: what moves today

Measured on the live build (1440×900 contact sheet, `temporary screenshots/shot-29-home-now-*`).

| Where | Current motion | Problem |
|---|---|---|
| Home hero | One staggered fade-up after `window.load`; dial hand sweeps once to 13.5h; status dot pulses twice | The only "scene" on the site is a single flat image. Nothing responds to scroll or pointer. Hero text waits for `window.load` (all CDN scripts and images), which can hide the headline for seconds on a slow connection. |
| Every section | 16–18px fade-up once on entry | Nine sections behave identically, so the page reads as one document shown nine times. |
| Where the hours go | Stage swap via IntersectionObserver; hand tweens to 0h / 14h / 36h | The strongest idea on the site (48 hours) jumps between three states. Large empty gaps between stages (38svh each) read as dead scroll. |
| Calculator | Step slide 24px; figures count up 0.7s | Fine functionally; the result has no moment of arrival. |
| Product pages | Fade-ups only | Charts, timelines and the 50/40/10 bar are static drawings of processes that move. |
| Navigation | Hard page loads | No continuity between pages. |
| Footer | Static | The outlined wordmark is a finish that never arrives. |

Conclusion: the site has no depth, no scroll-linked motion and no variety. Adding more fade-ups would not fix it.

## 2. Goals and non-negotiables

1. **Motion explains the offer.** The promise is time (decision in 3–24h, funds 24–48h). The biggest motion on the site must make that timeline tangible, not decorate it.
2. **Variety with restraint.** Each home section gets one distinct behaviour; one moment on the page is the peak; forms and FAQs stay calm.
3. **Never slow the task.** Primary CTA visible in the first viewport at every size. The calculator stays one click away (`#estimate`). No scroll hijacking, no snapping of the document, no input blocked by an animation.
4. **Equal information for everyone.** Reduced-motion, keyboard and screen-reader users get the same content and the same controls, in a complete static composition.
5. **Performance.** 60fps on a mid-tier laptop; transform and opacity only (clip-path for wipes, SVG stroke drawing for hairlines); CLS < 0.1; INP < 200ms; motion must not delay LCP.
6. **Honesty.** Counters and animated figures only for real client figures ($5K–$5M, 3–24h, 24–48h, 14 years of the partner company, 50/40/10). Never animate placeholder stats (000+, $00M+). No animated "Approved" or "Funded" stamps that read as a guarantee; stage copy keeps "typically" and "commonly".

## 3. Content changes the motion needs (IA)

- **Hero budget.** First viewport holds four text elements at most: status pill, H1, a lede of ≤ 20 words, CTA group. Proposed lede: "See which funding products fit your business in about a minute. No login, no credit pull, no contact details." (19 words).
- **Hero second beat.** The removed sentence ("When you're ready, a specialist comes back within 24 hours with a pre-qualified offer.") and the fact rail become the hero's scroll beat. They stay in the DOM in reading order, directly after the CTAs, and are fully visible without motion.
- **Headline.** ≤ 2 lines at ≥ 1280px if the composition allows, ≤ 3 lines at 1024px, ≤ 4 lines at 390px. Contrast ≥ 3:1 (large text) against the composited background in every hero state.
- **Scroll length.** Home is 12.5 viewport-heights today. The upgraded page must stay ≤ 14 at 1440×900, so any pinned span is paid for by trimming dead space elsewhere (for example the 38svh stage gaps).

## 4. Motion system (tokens)

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 160ms | hover, press |
| `--dur-base` | 260ms | state changes, crossfades |
| `--dur-slow` | 640ms | entrance reveals |
| `--dur-scene` | ≤ 1600ms total | orchestrated intros (hero, calculator result) |
| exit | ≈ 65% of enter | leaving states |
| `--ease-out` | cubic-bezier(.16,1,.3,1) | arrivals |
| `--ease-mech` | cubic-bezier(.77,0,.175,1) | mechanical sweeps (dial hand settling) |
| `--ease-spring` | cubic-bezier(.34,1.56,.64,1) | press feedback only |
| linear | — | scroll-scrubbed progress, constant rotation |

Distances: reveal rise 14–24px (never a slide). Parallax ≤ 120px total per plane, ≤ 200px for a full-bleed bed. Pointer tilt ≤ 6°. Scroll-linked scale ≤ 1.12 on full-bleed media (vestibular safety).
Focal motion: one per viewport, two at most. Stagger 40–60ms between siblings, 8 items maximum per group.
Scroll-linked motion has no duration: smoothing comes from Lenis on fine pointers (lerp ≈ 0.1) or a per-frame lerp ≤ 0.2. Perceived lag must stay under ~250ms.

## 5. Interaction plan by surface

### 5.1 Global
- **Smooth scroll:** Lenis on `(pointer: fine)` only, off under reduced motion. Wheel, keyboard (Space, Page keys, arrows), scrollbar and anchor links all keep working. `html.lenis-smooth` must not also carry CSS `scroll-behavior: smooth` (double smoothing).
- **Pinning:** CSS `position: sticky` stages inside tall sections, defined in CSS behind a `.js` + motion class so there is no JS-inserted spacer and no layout shift. Maximum two pinned sections per page. Native scroll always advances; nothing snaps.
- **Page transitions:** cross-document View Transitions (`@view-transition { navigation: auto }`). The header persists (`view-transition-name`), main content crossfades with a ≤ 24px rise, 320ms in / ~200ms out. Progressive enhancement: unsupported browsers load normally. Off under reduced motion. Navigation is never delayed by script.
- **Reveals:** one shared system. Fires once; content never re-hides on scroll-up. Without JS, or if the motion library fails, all content is visible (no-JS style + a short CSS fallback, ≤ 1.2s, replacing today's 2.8s).
- **Header:** keep hide-on-scroll-down / show-on-scroll-up. It must not flicker while a pinned stage is active. `scroll-padding-top` stays equal to header height + 16px so focus is never hidden.
- **Pointer effects:** `(hover: hover) and (pointer: fine)` only; interpolated, never 1:1; reset on pointer leave; no custom cursor; no pointer lock.

### 5.2 Home hero: layered depth
- **Composition:** separate background, subject, foreground and atmosphere planes (Phase 2 defines them) that move at visibly different rates on scroll and pointer. Text is semantic HTML above the planes.
- **Load:** the H1 is visible within 400ms of first paint and fully settled by 1s; the intro runs on DOMContentLoaded or a CSS animation, not `window.load`. The hero image(s) are painted from the first frame (scale and position may animate; opacity must not start at 0 for more than ~200ms) so LCP is not delayed.
- **Scroll beat:** at most one short sticky sequence of ≤ 1.8 viewport-heights of total section height on desktop, ≤ 1.3 on phones (or natural flow with scroll-linked transforms). The CTA and every link stay operable at every scroll position. The second-beat copy is real text.
- **Ambient motion:** nothing moves on its own for longer than 5 seconds (WCAG 2.2.2). Light sweeps, dust or hand sweeps either finish inside the intro or are driven by scroll or pointer (user-initiated).
- **Reduced motion:** the same composition at rest, with the ring drawn and hand at its final hour; no sticky space; all copy visible.
- **Mobile:** recomposed, not shrunk. Headline, lede and primary CTA fit in 390×844 and 360×640; the subject sits behind or below the copy; travel ≤ 40px; no pointer effects; no horizontal overflow.

### 5.3 Calculator (calm surface)
- Step change: direction-aware 24px slide + fade, 280ms, interruptible (a second click cancels and sets the final state explicitly). Focus moves to the first input with `preventScroll`.
- Choice selection: existing press scale 0.97; the checked dot scales in over 160ms.
- **Result arrival** (≤ 900ms total): range digits roll into place in tabular figures with reserved width (no shift), the certificate rosette draws its hairlines, matched products stagger 40ms. The status region announces once, as today. Editing an answer after completion updates figures in ≤ 300ms without replaying the arrival.
- Reduced motion: final values immediately.

### 5.4 Statement of capital paths (light)
- The dark-to-light change may be staged (a wipe or a rising sheet) but must complete within the first ~40% of the section's travel and never cover text being read.
- Rows arrive in order (40–60ms stagger). Hover thumbnails stay desktop-only and also appear on `:focus-visible`. Transform-only hover: hit areas never move.

### 5.5 Where the hours go: scroll-driven 48-hour instrument
- **Desktop and tablet landscape (≥ 1024px wide and ≥ 700px tall):** a sticky stage holds the dial while scroll progress maps to hour 0 → 48. Hand, rosette and arcs move continuously; the three stage texts cross over with overlapping windows (no empty moment, the last stage holds). Section height ≤ 3 viewport-heights.
- **The hand is a real control** (`role="slider"`, `aria-valuemin="0"`, `aria-valuemax="48"`, `aria-valuenow`, `aria-valuetext` such as "Hour 14 of 48: a specialist contacts you"):
  - Keyboard: ←/↓ −1h, →/↑ +1h, Page Down/Page Up ±6h, Home 0h, End 48h.
  - Pointer: drag the hand or ring with a 4px movement threshold; a single click or tap on the ring or a tick jumps there (WCAG 2.5.7 alternative to dragging).
  - Scroll position is the single source of truth: changing the slider scrolls the page to the matching point inside the sticky range (instant under reduced motion), so the dial and the page never disagree.
  - The control lives inside the sticky stage, so it stays visible while focused (WCAG 2.4.11). Target ≥ 44×44px.
  - States: rest, hover (ring brightens), focus-visible (2px Greenback ring on the handle), dragging (handle scale 1.1, `cursor: grabbing`).
- Stage text is never focusable and never `aria-hidden`; screen readers read all three stages in order. No live announcements from scroll.
- **Below 1024px, or short viewports:** no scroll-scrubbed pin. A compact sticky dial tops the section while stages scroll beneath; the readout follows the stage in view. Short landscape phones: static dial.
- Reduced motion: no sticky travel; all stages visible; the slider still works and updates readout and highlighted stage without animated scrolling.

### 5.6 Industries, model, proof, security, FAQ, CTA, footer
- **Industries:** eight items plus the "we also work with" line stay scannable. No horizontal swipe gestures on phones (vertical list). Any lateral travel on desktop is driven by vertical scroll, and every item is reachable with reduced motion (grid).
- **Brokerage model:** the "Who does what" connector may draw with scroll (You → TMF Team → Funder → commission). Text stays at full opacity once in view; only lines and nodes animate. "14 years" may count up once (1.2–1.6s, tabular, final value readable).
- **Proof (placeholders):** entrance stagger only. No counters on sample figures.
- **Security band:** image bed parallax ≤ 160px; list items and icon hairlines arrive in order. No rotation of photographic parts.
- **FAQ:** instant expansion (no height animation), content fades and rises 6px, as today.
- **Final CTA:** horizon parallax; headline line reveal; buttons never move after arrival. The last screen must resolve and hold.
- **Footer wordmark:** decorative, `aria-hidden`; may rise or wipe into place once.

### 5.7 Inner pages
- **Page hero:** image plane parallax ≤ 60px plus a scale settle (1.06 → 1) without an opacity-from-0 start (LCP). H1 lines rise from masks, ≤ 900ms. Fact rail facts arrive in order.
- **Cash injection:** bars grow from the baseline in day order (scaleY, origin bottom), each remittance bar following its revenue bar (cause → effect). The Day 1 → funded line fills as the section scrolls and days light as they are passed.
- **SBA:** the 50 / 40 / 10 segments grow left to right in sequence; percentages count to their real values. Checklists tick in order.
- **Home equity:** "Where the hour goes" progresses in order; the score scale track fills and the four marks rise in sequence.
- **About:** principle icons draw; the model flow as on home; "14 years" count-up.
- **Calculator page:** hero parallax only; the calculator follows 5.3.
- **Contact and Apply:** forms stay calm. Step transitions and success states only; no parallax near inputs.

## 6. Accessibility requirements (motion-specific)

| Requirement | Plan |
|---|---|
| `prefers-reduced-motion: reduce` | No sticky scrubbing, parallax, smooth scroll, kinetic splitting or page transitions. Opacity fades ≤ 200ms may remain. Every composition is designed in its resting state first. |
| WCAG 2.2.2 Pause, Stop, Hide | No auto-moving content longer than 5s. Everything else is scroll- or pointer-driven. |
| WCAG 2.3.3 Animation from Interactions (AAA) | Met through the OS preference. A site-level "reduce motion" switch is deferred; revisit if testing shows the scroll motion is heavy. |
| WCAG 2.3.1 Three flashes | No flashing; light sweeps are slow gradients. |
| WCAG 2.4.11 Focus Not Obscured | `scroll-padding-top`; focusable controls inside sticky stages stay in view; the header returns on focus (existing). |
| WCAG 2.5.7 Dragging Movements | Dial: click-to-jump and keyboard alternatives. |
| WCAG 2.5.8 Target Size | Every new control ≥ 24×24px (target 44×44px). |
| Reading order | Visual order equals DOM order in every state; pinned cues do not reorder content. |
| Split text | Kinetic headings keep real text (no per-letter `aria-label` hacks); only display headings are split, never paragraphs or links. |
| No-JS | All content visible; the calculator's existing noscript message remains. |
| Contrast | Measured on the composited page at the brightest frame under each line, including mid-transition states. |

## 7. Performance requirements

- Animate `transform` and `opacity` only; `clip-path` for wipes; SVG `stroke-dashoffset` for hairline drawing on small SVGs. No animated `filter`, `width`, `height`, `top` or `left`.
- Rotating dial layers are separate elements with CSS transforms (composited), not per-frame SVG attribute rewrites of complex rosettes.
- `will-change` only while a sticky stage is active; removed afterwards.
- No layout reads in scroll handlers. Measure on refresh (load, `document.fonts.ready`, resize) and cache.
- rAF loops (pointer parallax, lerps) stop when their section is off screen or the tab is hidden.
- New imagery: WebP at 3 widths, alpha kept where needed, lazy below the fold; only the hero LCP image gets `fetchpriority="high"`. Budget for new hero planes ≤ 600KB at desktop width.
- New script weight: GSAP SplitText (7KB) and DrawSVGPlugin (4KB) from the same pinned cdnjs 3.13.0 path, only on pages that use them.
- Budgets: CLS < 0.1, no long task > 50ms during scripted scrolling, INP < 200ms on the dial slider and calculator.

## 8. Responsive behaviour

| Surface | Desktop ≥ 1024 | Tablet 768–1023 | Phone < 768 | Short landscape (< 600px tall) |
|---|---|---|---|---|
| Hero | Layered scene, pointer depth, short sticky beat | Layered, no pointer, reduced travel | Recomposed stack, travel ≤ 40px | Static composition |
| Hours | Sticky 48h scrub + slider | Sticky compact dial + scrolling stages | Same as tablet | Static dial, stages listed |
| Industries | May travel laterally (vertical scroll) | Grid | Vertical list | Grid or list |
| Paths | Rows print in order | Same | Stacked statement cards | Same |
| Page transitions | On | On | On | On |
| Pointer effects | On | Off | Off | Off |

## 9. Runtime decision

- **Keep the existing GSAP 3.13 (+ ScrollTrigger, SplitText, DrawSVGPlugin) and Lenis runtime.** It already runs across eight pages; `gsap.matchMedia()` gives a clean desktop / phone / reduced-motion split with automatic revert on resize.
- **The scroll-craft engine is not loaded at runtime.** Its reset stylesheet (`html { scroll-behavior: smooth }`, body font and background, focus radius) conflicts with Lenis and the design tokens, and a second scroll runtime would duplicate reveals and scroll listeners. Its rules are applied instead: the cue contract (plateau, greet, last cue holds), ground-or-greet, reduced-motion floors, one peak, the verification pass.
- **Verification stays compatible with the scroll-craft harness:** sections carry `data-sc-act` markers and custom sticky stages publish `data-sc-verify-state`, alongside the project's own `tools/shots.mjs`, `interact.mjs` and `audit.mjs`.

## 10. Acceptance checks (for Phase 4)

1. Contact sheets per section at 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 360×640 and 844×390: opening, intermediate and resolved states.
2. Reduced-motion sheets for every page; nothing missing or unreachable.
3. Pointer-state screenshots of the hero (pixels change, layers separate, no halos or floating contact points).
4. Dial slider by keyboard, drag and click-to-jump; focus visible inside the sticky stage; scroll and dial stay in sync.
5. CLS measured with a PerformanceObserver during load and scripted scrolling; long tasks logged; frame times sampled.
6. `tools/interact.mjs` (27 existing checks, plus new motion and slider checks) and `tools/audit.mjs` (contrast, targets, headings, overflow) all pass.
7. Console errors and failed requests: none. View transitions tested in Chromium; unsupported path tested by disabling them.
8. Verified only in headless Chrome: real iOS Safari behaviour (sticky with the URL bar, Lenis off on touch) is stated as not verified.
