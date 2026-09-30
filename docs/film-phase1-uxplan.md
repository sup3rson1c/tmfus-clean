# Funding Film — Phase 1: UX plan (ui-ux-pro-max)

Full-bleed scroll-scrubbed film between the hero and the estimate section.
Beats 1–3 of 9 in this pass.

## 1. Scroll choreography

| | Desktop ≥1024 | Tablet 768–1023 | Mobile <768 |
|---|---|---|---|
| Pin length | `+=300%` (100vh/beat) | `+=240%` | `+=150%` |
| Frames | 150 @ 1440w | 150 @ 1080w | 75 @ 720w (every 2nd) |
| `scrub` | 1 | 1 | 0.6 (shorter throw) |

`scrub: 1` — not `true`. A small number reads as tied to the scrollbar with a
touch of inertia, which matches the Lenis feel already on the page. Instant
scrub against Lenis smoothing produces a double-easing wobble.

Beat boundaries are not cuts. Beat 2 starts on beat 1's last frame because the
clips are generated `start_image` → `end_image`, so the scrub crosses them
without a seam.

## 2. Pin budget (constraint)

The hero already pins for 70svh. Guidance: **no more than 1–2 pins per page**.
This film is pin #2 and uses the entire remaining budget — no further pinned
section may be added to the homepage. The clock section (`clock.js`) is
scroll-*driven* but not pinned, so it does not count against this.

## 3. Loading strategy

Never block the page; the film is below the fold.

1. Section renders immediately as its **poster** (frame 0) with
   `aspect-ratio` reserved → zero CLS.
2. `IntersectionObserver` at `rootMargin: 150%` starts a sequential fetch into
   `Image` objects. Sequential, not parallel — 150 concurrent requests stalls
   the connection and starves the rest of the page.
3. A 1px `--greenback` progress hairline shows load state; container carries
   `aria-busy="true"` until beat 1 is decoded.
4. Scrub activates once beat 1 (50 frames) is decoded, then upgrades as the
   rest arrive. The film is usable before it is complete.
5. **Bail-outs** → stay on static stills, no canvas:
   - `navigator.connection.saveData`
   - `effectiveType` of `2g` / `slow-2g` / `3g`
   - any frame fetch failing twice

Budget: 150 × ~45KB WebP q70 ≈ **6.7MB desktop**, ≈2MB mobile. Lazy, off the
critical path, never on first paint.

## 4. Accessibility

- **Reduced motion** → no pin, no scrub, no ScrollTrigger at all. The three
  keyframes render as a static stacked storyboard with visible captions.
  Guidance is explicit: present the final readable state, don't just shorten
  the animation.
- **Not scroll-hijacking.** Pinning holds the section while the page scrolls
  normally; we never intercept wheel or touch. Scrollbar, `PageDown`, `Space`,
  arrows and find-in-page all behave natively.
- **Skip link.** 300vh of pinned scroll is a long tunnel on a keyboard. A
  focus-visible "Skip the film" control at the section head jumps to the
  estimate section.
- **Text alternative.** `<section aria-label>` plus a visually-hidden ordered
  list naming the stages, so the story survives without the pixels.
- No text is baked into the frames — nothing to fail contrast, nothing
  untranslatable.

## 5. Hand-off

- **From the hero:** the hero rests on near-black `--vault` with low-key side
  light on stone. Beat 1 opens on that same key and ground, so the transition
  reads as the camera pulling back out of the hero's world — not as a new
  section starting.
- **To the estimate:** the estimate section sits on the light `--statement`
  ground `#e5e8e2`. Beat 3 therefore has to *end* bright — closing on the
  analyst's white document filling frame, which dissolves straight into the
  light section below. The film earns the light/dark flip instead of colliding
  with it.

## 6. Performance

- Canvas `drawImage` only; never animate width/height/top/left.
- One `requestAnimationFrame` write per scrub tick, reading the progress value
  ScrollTrigger already computed — no layout reads inside the loop.
- `ScrollTrigger.refresh()` after fonts and poster settle; pinning depends on
  deterministic height.
- Frames decoded via `createImageBitmap` where supported to keep decode off
  the main thread and stay inside the 16ms budget.
