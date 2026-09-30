# TMF Animation Sandbox — Reference Package

Written 2026-09-22 so a fresh conversation can pick up exactly where the last
one stopped. Updated later on 2026-09-22 after the v2 film ending and the
loader fix (§4, §5). Paste the prompt below into the new chat.

---

## Paste this into the new conversation

> Continue work on the TMF Team website animation sandbox at
> `D:\Desktop\Claude Code\tmf-team-animation`. Read
> `docs/REFERENCE-PACKAGE.md` first — it has the full state, every locked
> decision, the open items and the gotchas. Start the dev server with the
> `tmf-film` entry in `.claude/launch.json` (port 3200) and open
> `http://localhost:3200/?motion=force`. Don't redo finished work; ask me
> what's next.

---

## 1. What this is

- **Client:** TMF Team (tmfus.com), a US business-funding **brokerage**, not a
  lender. Products: Cash Injection (MCA), SBA loans, Home equity (HELOC), Line
  of credit.
- **Real site:** `D:\Desktop\Claude Code\tmf-team` (port 3100). **Never touched
  from here.**
- **Frozen backup of the real site:** `D:\Desktop\Claude Code\tmf-team-backup-2026-09-14`.
  Never edit.
- **This sandbox:** `D:\Desktop\Claude Code\tmf-team-animation` (port 3200). A
  replica used to build the scroll film and the backend integration.
- **Story direction (client, 2026-09-17):** competitive **rates** and
  transparent **terms** are the headline. The 24–48h funding claim is supporting
  proof only. Stay qualitative — no invented rates, testimonials or counts.

## 2. How to run it

```
node serve.mjs 3200     # from the sandbox root, or launch.json "tmf-film"
node build.mjs          # after ANY edit in src/
```

- Open `http://localhost:3200/?motion=force`. **`?motion=force` is required on
  this machine** — Windows has reduce-motion on, so without it you get the
  static play-button fallback instead of the scrubbing film. It persists for
  the session once loaded.
- `http://localhost:3200/film-preview.html` plays the film straight through.
- **Edit `src/`, never the generated output** (`index.html` and the page
  folders are built by `build.mjs`). CSS lives in `src/css/`; JS in
  `assets/js/` is edited directly (not built).
- `node_modules/` is a **junction** to the real project's. Never
  `npm install` in the sandbox — it writes through to the original.

## 3. File map

| area | files |
|---|---|
| Film | `src/partials/home-film.html`, `src/css/10-film.css`, `assets/js/film.js` |
| Hero | `src/partials/home-hero.html`, `src/css/04-home.css`, `assets/js/hero.js` |
| Scroll feel | `assets/js/motion.js` (Lenis config) |
| Loader | `src/partials/loader.html`, `src/css/02-loader.css`, `assets/js/loader.js` |
| Nav + dropdown | `src/partials/header.html`, `src/css/02-chrome.css`, `assets/js/site.js` |
| Film media | `media/film/clips/*.mp4` (11 clips; the v1 ending is parked in `clips/v1/`), `media/film/frames/{d,m}/b1..b11/` (extracted), `media/film/k*.png/.webp` (v1 keyframes), `media/film/v2/` (v2 keyframes, raw generations, clip masters) |
| Frame extraction | `tools/film-frames.mjs --beats=6,7` re-extracts only those beats (per-beat `skip` trims and `crop` in the file), then `python tools/film-drain.py` writes the counter's drain curve into the manifest |
| Keyframe tools | `tools/keyframe-merge.py` (paste only an edit's changed region back onto the source frame), `tools/film-ink-frame.py` (builds the ink keyframe from k6: clean-page model + procedural guilloche seal) |
| QA | `tools/film-shots.mjs <dir> <frames>` (film at given frame indices, walks the scroll so beats decode), `tools/loader-timing.mjs`, `tools/loader-shots.mjs`, `tools/audit.mjs`, `tools/interact.mjs`, `tools/shots.mjs`, `tools/browser.mjs` |
| Backend | `api/chat.php` (from client), `api/config.sample.php`, `tools/api-mock.mjs` |
| Client originals | `vendor/tmfus/` (untouched copies of the live site's pages, `app.js`, `styles.css`) |
| Docs | `docs/integration-plan.md`, `docs/film-phase{1,2,4}-*.md`, `docs/asset-log.md` |

## 4. The film — current state

Scroll-scrubbed: scroll position is the playhead. 11 beats rendered as image
frames painted to a canvas (15fps; 1920x1072 desktop, 960x536 mobile).

| beat | clip | what happens |
|---|---|---|
| 1–5 | a…e | unchanged from v1: owner applies → into the system → analyst → underwriting table → the lined page |
| 6 | f-stamp-down | on that SAME lined page (k6), the resting hand leaves; a silver hand brings the steel stamp in from the upper left and presses it once, fully flat, on the page's lower-left |
| 7 | g-stamp-up | the stamp lifts straight off; a guilloche ink seal is revealed where it stood |
| 8 | h-the-offer | pull back to the account executive sliding that stamped page to the merchant |
| 9 | i-signing | push in; the dark faceted hand signs on the page's signature line, next to the seal |
| 10 | j-paper-falls | pen lifts, the signed page tips and slides away, revealing the syringe |
| 11 | k-drain-a/b/c | locked shot, cut from THREE clips (the last one twice, at two sample rates): plunger rod pushes in, the money drains through the needle into the safe; counter climbs |

v2 decisions (user, 2026-09-22): the page must stay the same page from the
underwriting table to the signature (it used to turn into a blank sheet);
the stamp touches the paper once and fully; the offer scene stays between
stamp and signature; syringe needle goes into the safe's SIDE wall with a
short piece of needle visible, tip hidden; money looks like their reference
clip (glowing gold, bills and coins); the rod visibly pushes in.

v2.1 (user, same day): the money must stay **clear** the whole way down — no
squishing into a gold blob — and the needle, having gone from 85px to 615px of
visible shaft, was "too long, cut it in like half" → 350px. The drain is now
three clips (kf3 → km3 → kq3 → ke3) rather than one; see the asset log for why
one clip cannot hold it.

**Four captions** (`data-film-steps`), each in the corner its footage leaves empty:

| starts at beat | text | position |
|---|---|---|
| 1 | You apply. One form, no credit pull. | bottom-left |
| 3 | Funders compete for your file. | top-left |
| 6 | You see every term before you sign. | bottom-right |
| 11 | The money injects straight into your bank. | bottom-left |

**Pace:** `perBeat = desktop 105 / tablet 95 / mobile 78` vh per 75 frames.
Scroll length is per FRAME (beats differ: stamp beats trimmed to 60/53, the
drain runs 173). The film is ~11,180px tall at 1600x900. 887 desktop frames,
448 mobile.

**One beat, several clips.** `tools/film-frames.mjs` takes `clips: [...]` as
well as `clip`, and a per-beat `fps`. Beat 11 is three clips: Kling only takes
a start and an end image, so a long move has to be shot in 5s pieces joined on
shared keyframes, and keeping them one beat means the manifest, the drain
curve and the counter all still see one continuous run. The manifest records
`parts` as `{clip, count}` so tools can find the joins. A part can also carry
`range` (use only this time window), its own `fps`, `clean` (patch a box
nothing in the shot can cross, against the clip's own first frame) and
`reverse` (play it backwards). See the asset log entries "v2.1a" and "v2.1c".

**Beat 11 is sampled on position, not on time** (`track` + `pace`), because
its three clips move the stopper at different speeds and cutting them at a
fixed frame rate made it lurch — 14px of travel on a frame against 2.4px
elsewhere, with one 73px jump. Every source frame is decoded and measured, and
the beat keeps the 173 sitting on an evenly spaced ladder of stopper
positions; the manifest gets that position per frame as `track`. **And its
emptied barrel is frozen** (`chamber`): the authored "empty" keyframe has the
stopper parked back at the barrel's mouth, so the last clip draws a phantom
second stopper and strobes the glass. One plate cut from the film's own
footage is composited in behind the stopper on every frame. Both are explained
at length in the beat's own comment and in asset-log "v2.1d".

**Seams:** Kling rendered some clips 1928x1076 and some 1912x1080 and fits the
shared keyframe differently into each; beats 9–11 are cropped rows 9..1071
and every frame is written at exactly 1920x1072, which lines the seams up to
within a pixel (measured with ECC).

**Stage fit.** The canvas covers the stage only while the counter's `QUAD`
still clears the crop with 2% of the frame to spare; otherwise it letterboxes,
and the poster's object-fit is set from JS to match. It used to cover above
768px unconditionally, which at 1163x1022 cropped the funded total to "$24".

**The storyboard stills are cut from the film** by `tools/film-board.mjs` —
run it after `tools/film-frames.mjs`. They ship visible (and are the
reduced-motion / no-JS / slow-connection fallback), so a hand-picked still
that drifts from the footage reads as the film changing shape as it loads.

**The funded counter is drawn by the site, not the video** (the model can't
count). Screen is blank in the footage; `film.js` maps a 1000x420 plane onto
the glass with a homography (`matrix3d`):
- `QUAD` = the glass's four corners measured on `frames/d/b11` (TL 1454,170 ·
  TR 1779,148 · BR 1777,285 · BL 1457,298 of 1920x1072). The camera is locked
  for the beat, so one quad holds (drift measured at 1px across all 156
  frames). It survived the v2.1 re-shoot unchanged because every drain
  keyframe is merged onto the full one with `tools/keyframe-merge.py`, which
  leaves the safe and its screen byte-identical. Re-measure if that stops
  being true.
- `mix-blend-mode: screen`, no fill panel: it only adds light, so the footage's
  glass and reflections show through. The v1 counter painted its own upright
  panel, which sat off the perspective glass and read as pasted on.
- Value = `TARGET (248500) × drain[frame]`, the curve from
  `tools/film-drain.py`. It reads the stopper positions film-frames.mjs wrote
  into the manifest and converts them to volume through the barrel's own
  measured silhouette. It used to stretch a pixel score onto hand-declared
  anchors of 0 · 0.5 · 0.875 · 1, taken from what the keyframes were NAMED;
  measured, those frames are a quarter and a half drained, so the counter was
  reporting a number the picture did not support. Do not re-introduce them.
  Screen lights up over the first 6% of the beat at $0.
- It reads off the frame ON THE CANVAS, not off scroll position. Before
  2026-09-23 it followed the scroll, so arriving at the last beat before its
  frames were resident ran the total to $248,500 over a half-full syringe.
- Verified 2026-09-23: $0 → $248,500 across 30 samples with no tick backwards,
  and fully on stage at 1600x900, 1163x1022 and 390x844.

## 5. Other finished work

- **Scroll feel** matched to moto-card.com (same Lenis + GSAP stack, measured):
  `duration 1.25`, `easing 1 - 2^(-7.2t)`, `wheelMultiplier 1.35`,
  `touchMultiplier 1.6`. About 510px per notch, gentle onset, ~1.6s glide.
- **Hero:** exactly one screen (`.motion-ok .hero { height: 100svh }`), and the
  film starts at the next pixel. The second hero beat and the stat row
  ($5K–$5M, no credit pulls, etc.) were **deleted at the user's request** — do
  not bring them back.
- **Loader (fixed 2026-09-22):** the user saw it for "a tenth of a second". It
  was decided in a deferred script that waited on GSAP from the CDN, so the
  page painted first; and it ignored `?motion=force`, so on this machine it
  never showed. Now the head script (`partials/head.html`) decides before
  first paint (`html.is-loading`), with a 4.5s failsafe; the mark draws in CSS;
  loader.js lifts it once the wordmark finishes AND the page has loaded, plus
  300ms (~2s on screen, measured). The hero holds its entrance until the
  cover lifts (`tmf:loader-done`). Still once per session, still skips on
  scroll/key, still off under plain reduced motion.
- **Scroll cue:** bead and chevron at the bottom-right of the hero, links to
  `#estimate`, retires once scrolling starts.
- **Nav dropdown:** the panel's box starts flush against the Solutions button
  (`top: 100%`, the 12px offset is inner padding, the visible card is
  `.menu__plate`) and overlaps it by 6px, so there's no dead space to fall
  through. Close delay 320ms. Keyboard Enter/Escape verified.

## 6. Backend integration — started, not finished

The client sent `tmfus-site-changes-v43.zip`, a **partial** backup (20 files),
not the whole site. Decisions: build now, add keys later; port the backend of
everything; keep this design unless it harms function; localhost for now,
deployable to the existing cPanel host later.

**Missing from the zip, still needed from the user:** `api/config.php` (all
credentials, including Figure HELOC), `api/figure-heloc.php`,
`api/application.php`, `api/lead.php`, `api/unsubscribe.php`.

Done: the client engine is vendored in `vendor/tmfus/`; `api/config.sample.php`
lists every key read from the code (the Figure key names are **inferred** —
confirm them); `api/config.php` is gitignored; `tools/api-mock.mjs` answers all
five endpoints inside the dev server (it logs and drops leads — it does **not**
post to the live Google Sheet).

Next, in order: funding estimator + MCA calculator (client-side) → application
(multi-step, uploads) → HELOC (against the mock until `figure-heloc.php`
arrives) → lead capture, visitor memory, consent, chat → build the
`unsubscribe` and `404` pages (no designed shell yet).

Page map: index → `/`, apply → `/apply/`, funding-estimator → `/calculator/`,
heloc-calculator → `/home-equity/`, mca → `/cash-injection/`; sba-loans, about,
contact, privacy and terms keep their names. All have designed shells.

## 7. Open decisions (ask the user)

1. **Counter figure.** `$248,500` (lands near $243,627 on screen) is invented.
   The user chose "a mid-range figure" but hasn't named one.
2. **Lead capture route.** `vendor/tmfus/app.js:35` hardcodes a live Google Apps
   Script endpoint. Keep posting straight to it, or proxy through `lead.php`?
3. **Film length.** ~11,180px after the v2.1d ending (was ~9,400). If it's too
   long, trim beats rather than speed up the pace.
4. **Placeholders still live:** phone `(000) 000-0000`, email, address.

## 8. Gotchas that cost time before

- **Git Bash mangles `/`-prefixed args** into Windows paths. Prefix node tool
  calls with `MSYS_NO_PATHCONV=1`.
- **The in-app browser pane freezes GSAP** when hidden (no rAF). Verify scroll
  animation with puppeteer (`tools/browser.mjs`), not the pane.
- **Puppeteer and smooth scroll race.** Jump with
  `scrollTo({ behavior: "instant" })`, and step through gradually when frames
  must decode — jumping straight to the end can show a stale frame.
- **Headless Chrome runs rAF at ~10fps** here, so motion code must be
  time-based.
- **Python `str.replace` replaces every occurrence.** Anchor edits to unique
  text or a line range — a broad replace once broke `paint()` in film.js.
- **Video models can't render readable changing text or counting numbers.**
  Keep screens blank in the footage and overlay text in the DOM.
- **Kling clips chain via `start_image` + `end_image`.** Beat N's end frame is
  beat N+1's start. For a visible change within one beat (full → empty),
  generate both states as keyframes and use them as start and end.
- **The film's pin is created late, so it must refresh FIRST.** ScrollTrigger
  refreshes in creation order, and `film.js` only creates its pin after the
  manifest and first frames load. Everything below the film then measures a
  page without the ~11,000px pin spacer, and every start/end below comes out
  that much too high (it broke the clock in "Where the hours go": the hand
  froze at 48h and its controls scrolled into the video). Fixed 2026-09-22 by
  `refreshPriority: 1` on the pin plus `ST.sort()` before every
  `ST.refresh()` in film.js — `refresh()` alone does not reorder. Any new pin
  created after page load needs the same treatment.
- **The user tests in a real browser.** A passing automated check isn't proof —
  if they still see a bug, remove its cause structurally.
- Higgsfield `jobs_wait` accepts at most a 15s timeout; poll repeatedly.

## 9. How the user works

- Wants things done and shown, not long planning pauses. Screenshots as proof.
- Gives feedback by voice, so messages repeat themselves — act on the intent.
- Global workflow in `~/.claude/CLAUDE.md`: ui-ux-pro-max plan →
  frontend-design → build → ui-ux-pro-max audit. Say so before starting new
  build work so they can switch models.
- Never invent testimonials, stats, ratings or rates for a lending brand.
