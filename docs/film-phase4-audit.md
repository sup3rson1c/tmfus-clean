# Funding Film — Phase 4: audit (ui-ux-pro-max)

Run against the built sandbox on localhost:3200, driven by headless Chrome
(the Browser pane doesn't composite while hidden, so pinned scroll reads as
dead there — puppeteer only).

## Verified

| Check | Desktop 1440 | Tablet 768 | Mobile 375 | Reduced motion |
|---|---|---|---|---|
| Pin length | 3602px (300%) | 3484px (240%) | 2032px (150%) | none — 270px |
| Stage / storyboard | stage / hidden | stage / hidden | stage / hidden | hidden / grid |
| Horizontal overflow | none | none | none | none |
| Console errors | none | none | none | none |
| Frame set loaded | `d/` 151 | `d/` 151 | `m/` 76 | **0 frames** |

Reduced motion downloads nothing: no canvas, no pin, no ScrollTrigger, and
not one of the 5.7MB of frames it would never display.

**Keyboard.** "Skip the film" is reached in 11 tabs, matches `:focus-visible`,
renders at `top: 12` and 136×51 (over the 44×44 floor). Enter lands on
`#estimate` at `top: 84`, clear of the 72px header.

**Brightness arc** measured across all 151 frames: min 2.3, max 157.7, ending
~45 on the analyst's lit page — dark → bright, as the hand-off to the light
estimate section requires.

## Fixed during the audit

**1. Skip link was unreachable exactly when needed.** It was `position:
absolute` inside a section that is ~3600px tall while pinned, so once a
keyboard user was actually inside the film the control sat far above the
viewport. Now reuses the header's `.skip-link` (`position: fixed`), verified
visible at `top: 12` from scrollY 2800. Landing in the same place as "Skip to
content" is deliberate — repeated help mechanisms belong in a consistent spot.

**2. Mobile cropped away three quarters of every frame.** A 16:9 frame covered
into a 375×812 portrait viewport left an unreadable centre slice — beat 2 read
as the words "ation form" over blank rows. Narrow viewports now letterbox
(`Math.min` fit, `--vault` bars) so the whole composition survives as a cinema
band. Desktop is pixel-identical to before the change; the poster's
`object-fit` switches at the same 768px breakpoint so nothing jumps when the
canvas takes over.

## Known trade-offs, not defects

- **Mobile has generous letterbox margins.** A 16:9 band in a 9:19.5 viewport
  leaves real dead space above and below. It reads as intentional cinema
  letterboxing against matching ground, but the honest fix is a dedicated 9:16
  mobile composition, as §Camera grammar anticipated. Deferred.
- **Six near-black frames (74–79)** at the moment the camera punches through
  the screen. ~100px of scroll. Dramatically justified as passing through a lit
  panel into a dark machine; flagged rather than smoothed.
- **"Application form" is baked into the frames** in the generator's own
  typeface, not Archivo/Public Sans. Small at scrub speed, but it is type on
  screen that the design system doesn't control.

## Pin budget

The hero pins for 70svh; this film is pin #2 of the recommended maximum of two.
**No further pinned section may be added to the homepage.** The clock is
scroll-driven but unpinned and does not count.

---

# Second pass — nine beats, 2026-09-19

Rebuilt after feedback: *quality is not good, scrolling experience is not good,*
plus captions per step and beats 4–9.

## Quality — it was upscaling, not the footage

The source clips are 1928×1076 and the frames were crisp at 1:1. The problem
was shipping them at **1440px** and then stretching full-bleed: on any display
wider than 1440, that is a 1.5–2× upscale. Compounded by **10fps**, which
steps visibly under scrub and reads as "bad video" even when each frame is
sharp.

Now **1920px at 15fps, q78**. 38MB on disk for nine beats (30.8 desktop,
7.2 mobile), but loading is windowed so it never lands at once.

### Why not WebCodecs, despite choosing it

Measured before building, and the measurements killed it:

| route | result |
|---|---|
| `<video>` + `currentTime`, fully buffered | **101ms** median seek→paint (needs ≤16ms) |
| WebCodecs available | yes, H.264 @1928×1076 supported |
| caching decoded frames | **589MB per beat** at 1920×1072 RGBA |

WebCodecs decodes fine, but scrubbing needs random access, which means holding
decoded frames — and that only fits by dropping below 960px, *worse than what
already shipped*. Compressed frames let the browser's image cache do the memory
management, which is the only approach that scales to nine beats. Video seeking
is simply six times too slow.

## Scroll — two easings stacked on one gesture

Lenis eased the scroll, then GSAP's `scrub: 1` eased the film toward where the
scroll landed. Two lags in series, so the film never tracked the hand. And the
pin was a full viewport per beat.

| | before | after |
|---|---|---|
| Pin per beat | 100vh | 55vh (desktop) |
| `scrub` | 1 | **0.15** — Lenis smooths, GSAP follows |
| Wheel notches, 3 beats | 27 | **15** |

Verified with a 90-step gradual scroll: **90 distinct frames painted out of a
possible 91**, median gap 85ms against an 80ms step. No stalls, no repeats.

## Windowed loading

Only the beat in view and one either side stay resident; the rest have their
Image references dropped so the browser can reclaim the decode. JS heap across
all nine beats: **2.8–3.6MB, flat, no accumulation**. (Decoded image memory
lives outside the JS heap, so this shows no JS-side growth rather than proving
the total.)

## Captions

One quiet IBM Plex Mono line, bottom-left, mint left rule, same family as the
hero's dial chips. Copy is drawn from claims the site already makes — the stat
bar's *no hard credit pulls*, *no commission added*, *24–48h* — rather than
invented. Set in `data-film-captions` on the section, and repeated as visible
text in the storyboard, since under reduced motion the storyboard *is* the film.

## Verified, nine beats

| | Desktop 1440 | Tablet 768 | Mobile 375 | Reduced |
|---|---|---|---|---|
| Section height | 5357px | 5634px | 3883px | 696px |
| Stage / storyboard | stage | stage | stage | storyboard |
| Overflow | none | none | none | none |
| Console errors | none | none | none | none |
| Screen-reader steps | 9 | 9 | 9 | 9 |

Skip link still 136×51, reachable, lands on `#estimate`.

## Open

- "Application form" is still baked into beats 1–2 in the generator's
  typeface, not Archivo/Public Sans.
- Mobile letterbox margins remain generous; a dedicated 9:16 composition is
  still the honest fix.
- Beat 9's counter wheels show numerals, which contradicts the no-text rule but
  is the point of that beat, so they stay.
