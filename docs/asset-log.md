# TMF Team — Higgsfield asset log

Every generation is recorded here: id, placement, model, settings, cost, prompt, reason, result.
Art direction: `phase2-creative-direction.md` §7. Balance at start: 466.5 credits (2026-09-12).

## Cost preflights
| Model | Settings | Cost |
|---|---|---|
| gpt_image_2_5 | 1:1, default (low, 1k) | 1 |
| recraft_v4_1 | 1:1, 2k | 8 |
| gpt_image_2_5 | 1:1, high, 2k | 3 ← **chosen** (best quality per credit) |
| gpt_image_2_5 | 1:1, xhigh, 2k | 5 |

Shared settings for batch 1: `gpt_image_2_5`, quality `high`, resolution `2k`. Shared prompt DNA: black honed stone plinth, textured black rock, soft key from above-left, thin cool rim light with faint green cast, 85–100mm, shallow DOF, "no text / numbers / logos / people".

## Generations
| ID | Placement | Model / settings | Cost | Job ID | Status |
|---|---|---|---|---|---|
| A1 | Home hero dial core | gpt_image_2_5 high 2k 1:1 | 3 | 6b936f5a-538d-4fe8-9cc5-fa9804838223 | ✅ approved — media/a1-hero-disc.png (2048×2048); disc seen at ~35° so its face is an ellipse — SVG dial ring must be drawn in matching perspective, not flat-concentric |
| A2 | Cash Injection hero | gpt_image_2_5 high 2k 4:5 | 3 | 9abfa71d-afc4-4d4a-a73c-ef24efa0c39e | ✅ approved — media/a2-cash-injection.png (1792×2240) |
| A3 | SBA hero | gpt_image_2_5 high 2k 4:5 | 3 | a8da23d1-2f13-4350-b2bb-b4f9e77277bc | ✅ approved — media/a3-sba.png (1792×2240); columns step down like a rising bar chart |
| A4 | Home Equity hero | gpt_image_2_5 high 2k 4:5 | 3 | e188f9d3-f5a4-4de2-a7d1-5566a1d1f2b6 | ✅ approved — media/a4-home-equity.png (1792×2240) |
| A5 | Line of Credit thumb | gpt_image_2_5 high 2k 1:1 | 3 | c29822a2-c939-46d1-83cb-f7fc2954f278 | ✅ approved — media/a5-line-of-credit.png (2048×2048); caution: upright loop can read as a digit "8" — use small, cropped, or rotated |
| A6 | Calculator hero | gpt_image_2_5 high 2k 1:1 | 3 | 186026b7-4caa-487a-b740-5e211a6f9a2e | ✅ approved — media/a6-calculator-dial.png (2048×2048); top face brushed, not engraved — fine |
| A7 | Security section | gpt_image_2_5 high 2k 16:9 | 3 | ee44f1f9-5772-4e6c-b58c-fdceb36425ed | ✅ approved — media/a7-security.png (2688×1520); left third empty for copy |
| A8 | About hero | gpt_image_2_5 high 2k 4:5 | 3 | cc09dda0-d884-410e-9660-eb5aed8ee2da | ✅ approved — media/a8-about-cube.png (1792×2240); engraved rosettes visible through glass |
| A9 | Final CTA band | gpt_image_2_5 high 2k 21:9 | 3 | 56d5ee39-b3fa-40e9-bce4-ca8c4dbef513 | ✅ approved — media/a9-cta-horizon.png (2688×1152); sky empty for CTA copy |

Full prompts: see §Prompts below.

## Prompts (batch 1)
- **A1** machined brushed-steel disc, face covered in guilloché banknote-rosette engraving, bevelled polished rim, on honed black stone plinth, three-quarter overhead.
- **A2** stack of ~12 thin brushed-steel plates with guilloché engraved borders, slightly fanned, top plate lifting.
- **A3** colonnade of five square black-stone columns with brushed-steel capitals/bases on a black platform, low angle; no flags/seals/inscriptions.
- **A4** minimal gabled house form in thick smoked glass with warm glowing core.
- **A5** continuous looped brushed-steel ribbon with a single twist, upright on small plinth.
- **A6** precision knurled steel rotary dial knob with guilloché-ringed top on black anodized base; no scale markings.
- **A7** cinematic macro of blackened-steel vault-door locking bolts, gears and ringed hub; weighted right.
- **A8** smoked-glass cube with engraved brushed-steel cube suspended inside (transparency).
- **A9** ultra-wide black stone landscape, razor-thin horizon line of pale green-grey light, mist.
All prompts end with the shared lighting DNA and "no text, no numbers, no logos, no people".

## Totals
- Batch 1: 9 images × 3 credits = **27 credits**. 9/9 approved, 0 regenerations. Balance ≈ 439.5.
- ~~Build-time todo: convert PNG masters (3.5–4.9 MB) to AVIF/WebP at display sizes (e.g. 800/1200/1600w) before shipping.~~ Done: `tools/images.mjs` writes the WebP renditions in `assets/img/` and no page references a PNG master; the masters are no longer in the repo. Issue #4 (2026-09-30) added display-size storyboard stills (`media/film/k*-640/960/1280.webp`, from `tools/film-board.mjs`) and an alpha-only hero sheen mask (`assets/img/m3-disc-mask-720.webp`, 10 KB instead of a second 104 KB download).
- Optional V1 (hero light-sweep loop, image-to-video from A1) not generated — decide during build whether the static dial + CSS motion already carries the hero.

---

## Motion upgrade batch (2026-09-13)

Purpose: separable planes for the layered hero and a plate for the engraving clock (`motion-phase2-direction.md` §6, §7, §13). Balance before: 439.5 credits. After: **422.5** (17 spent).

Style preamble, verbatim at the top of every new prompt:
> Low-key product photography on a 100mm lens, shallow depth of field, true blacks, fine film grain. One soft key light from the upper left, a thin cool rim light with a faint green cast from the right, deep falloff into shadow. Materials: honed black stone, textured black rock, brushed and blackened steel. Colour grade: near-black charcoal with a trace of green, silver highlights, desaturated mid-tones. Photographic realism. No text, no numbers, no logos, no people, no money, no glow, no plastic sheen.

Cost preflights: `outpaint_image` = 2 credits (any ratio); `gpt_image_2_5` high 2k = 3 credits at 21:9 as at 1:1; `remove_background` = 1 credit (from the balance delta).

| ID | Placement | Tool / settings | Cost | Job ID | Status |
|---|---|---|---|---|---|
| M1 | Hero wide scene (alignment reference) | outpaint_image, A1 → 16:9 | 2 | 0f0107cf-6ff1-4360-b07f-26ebf9628ecb | ✅ `media/m1-hero-wide-scene.png` (2752×1536). A1 kept intact at ×0.75, offset x +608. |
| M2 | Hero clean plate, wide | gpt_image_2_5 high 2k 16:9, image_references = M1 | 3 | e2c96922-9010-46fa-adbc-103fd0872a52 | ✅ `media/m2-hero-wide-plate.png` (2688×1520). Disc removed, plinth top rebuilt; plinth and wall line up with M1 in a 50% overlay. Plinth top reads slightly rougher than in A1 (acceptable). |
| M3 | Disc cutout | remove_background on A1 | 1 | c4f44f2e-9e61-4cfb-aa9a-b01d72cfb2f8 | ✅ `media/m3-disc-bg-removed.png` (2048×2048, A1 frame). Disc only; clean rim and contact edge over grey; no shadow (added in CSS). Test composite on M2 at scale 0.7374, x 594, y 0: seated correctly, no halo. Replaces the planned geometric mask. |
| M4 | Hero portrait scene | outpaint_image, A1 → 9:16 | 2 | 34e4b4ac-309a-4070-b68d-8273b0a709fe | ✅ `media/m4-hero-portrait-scene.png` (1536×2752). Rock wall above for type, stone ground below. |
| M4b | Hero clean plate, portrait | gpt_image_2_5 high 2k 9:16, image_references = M4 | 3 | 230e4f96-44e9-4fa3-819f-d0ed66f4c111 | ✅ `media/m4b-hero-portrait-plate.png` (1520×2688). Disc removed; aligned with M4 in a 50% overlay. Cutout position to be measured at build. |
| M5 | Foreground stone slab | gpt_image_2_5 high 2k 21:9, background transparent | 3 | 857fa60e-c0f4-43ac-ab4b-62a20e4b1e21 | ✅ `media/m5-stone-slab.png` (2688×1152). Real alpha (0–254). One straight lit chamfer across the full width; slab face below; transparent above. |
| M6 | Dial plate (engraving clock) | gpt_image_2_5 high 2k 1:1, background transparent | 3 | 196edf86-362d-44d3-b787-2314293d8c37 | ✅ `media/m6-dial-plate.png` (2048×2048). Real alpha (0–254). Matte black oxide, fine radial brushing, thin polished bevel, no markings. |

### Prompts (after the preamble)
- **M2 / M4b (edit):** "Edit the reference photograph. Remove the engraved steel disc completely. Rebuild the flat top of the black stone plinth where the disc was, continuing the same honed stone texture, the same soft pool of key light and the same faint surface sheen, with no shadow, ring, mark or outline left behind. Keep everything else exactly as it is: the same camera position, framing and crop, the same plinth shape, size, position and edges, the same rock wall, lighting and colour grade." (M4b also keeps "the stone ground in the foreground".)
- **M5:** the front edge of a thick slab of honed black stone, very close to camera and softly out of focus, filling the full width and lower half; one straight horizontal chamfer catching a single thin cool line of light; the upper half empty and fully transparent.
- **M6:** a perfectly round blackened-steel plate shot straight down, orthographic, centred with a small even margin; matte black oxide with fine radial brushing; no engraving, markings, centre hole or hands; a narrow polished bevel catching one thin cool line of light; evenly lit; fully transparent background.

### Totals
- 7 jobs, **17 credits**, 7/7 approved, 0 rerolls.
- WebP renditions, done 2026-09-13 by `node tools/images.mjs`: `m2-hero-plate` 1280/1920/2688 (54–184 KB); `m4b-hero-plate` 768/1152/1520 (63–185 KB); `m3-disc` cropped from the A1 frame at 340, 610, 1344×890 → 720/1080/1344 with alpha (104–281 KB); `m5-slab` 1440/2160/2688 with alpha (55–101 KB); `m6-dial-plate` 720/1080/1440 with alpha (31–114 KB). Desktop hero planes at 1440 wide load about 360 KB. Masters stay in `media/`.
- Measured at build: in the portrait outpaint M4, A1 sits at ×0.50 (not ×0.75) at left 240, top 854; in M4b the A1 frame is at left 237.5, top 834.1, size 1006.8. The composite over M4b matches M4. These numbers live in `src/css/04-home.css` (`--frame-*`, `--dx`, `--dy`).

---

## Film v2 ending (2026-09-22): one page from stamp to signature, syringe rebuilt

Brief from the user (voice, 2026-09-22): the stamp must land on the SAME lined
page the underwriting beat ends on (not a new blank sheet), once, fully on the
page, then show its ink; the signature goes on that page's signature line next
to the seal, in the look of the old signing shot; bring back "the paper falls,
then the syringe" transition; syringe needle into the safe's SIDE (short piece
of needle visible, tip hidden), money that looks like their reference clip
(`D:\Downloads\hf_20260919_185124_…mp4`: glowing gold with bills and coins), the
plunger visibly pushing in as the money drains; the counter embedded in the
screen. Offer scene kept, between the stamp and the signature.

Balance before: 239.25 credits. Uploads: k6 `fb987513…`, k7 `8e6c2271…`,
k8 `73f93071…`, k9 `feaefa59…`, money ref `3c6166f1…`, stamp guide `556fe63b…`,
KP `b6be733d…`, KS `2e215849…`, KE `8e28b6be…`.

| ID | What | Model / settings | Cost | Job ID | Result |
|---|---|---|---|---|---|
| V1 | KP stamp pressed, from k6 | gpt_image_2_5 high 2k 16:9 | 3 | 4d03e77e-bb49-4bba-8fb3-c57ec7bd221a | ✗ stamp mid-page, huge hand |
| V2 | KF syringe full, new staging | gpt_image_2_5 high 2k 16:9, refs k10-full + money ref | 3 | c942e536-681f-41ca-bf8c-f5bcbfb7f269 | ✓ door faces camera, nozzle into LEFT side wall, blank screen |
| V3 | KP from red footprint guide | gpt_image_2_5 high 2k auto, refs guide + k7 | 3 | d7af1cf8-cf00-494b-9e74-3cd7396ad62f | ✓ **used** — aligned with k6 once scaled; merged onto k6 (`tools/keyframe-merge.py --no-register --keep 960,1060,2010,1536`) → `v2/kp-merge3.png` |
| V4 | KP variant | same | 3 | e324a37a-5b47-4438-b4f5-68c59de6e780 | ✗ camera moved |
| V5 | KF: short needle | gpt_image_2_5 high 2k 16:9, ref V2 | 3 | e483851c-8369-4ee4-9b3b-46e95f702e71 | ✓ **KF** = `v2/kf.png` |
| V6–7 | KP via Nano Banana 2 | nano_banana_2 2k auto (mask role rejected by API) | 2+2 | d3ec928b-…, f9ac9637-… | ✗ oversized stamp, camera moved |
| V8 | KS ink, edit of KP | gpt_image_2_5 high 2k 16:9 | 3 | 1a9a639f-2115-4609-a6ab-ae8928c73a09 | ✗ left half of page redrawn ~16px off. KS **built instead** by `tools/film-ink-frame.py` (k6 + clean-page model + procedural guilloche seal on the rectified page plane) → `v2/ks.png` |
| V9 | KE syringe empty, edit of KF | gpt_image_2_5 high 2k 16:9 | 3 | b614e0f6-4ea9-4f76-b206-a7b2b93020a0 | ✓ plunger fully in, barrel clear; merged onto KF → `v2/ke.png` |
| V10 | KO offer two-shot, stamped page | gpt_image_2_5 high 2k 16:9, refs k8 + KP | 3 | 080f907e-daaf-4db0-938b-c54a0f21c4b8 | ✓ **KO** |
| V11 | KG signed page + pen hand | gpt_image_2_5 high 2k 16:9, refs KS + k9 | 3 | c3562cdf-e89e-4656-89af-2026a85d9393 | ✓ **KG** (wider framing; it ends a camera move, so it need not match KS's framing) |
| V12 | KG variant | same | 3 | b5b34bb8-3117-4f73-88a0-e5e5e7d7f701 | spare |
| C6 | beat 6 stamp down: k6 → KP | kling3_0 pro 5s, sound off | 8.75 | 8749e18c-f678-4153-a7da-54a4b01d14f7 | ✓ one press, page never changes |
| C7 | beat 7 stamp up: KP → KS | kling3_0 pro 5s | 8.75 | e62b54c0-a3da-49b9-b2df-3101ce565abc | ✓ one lift, seal revealed in place |
| C8 | beat 8 offer: KS → KO | kling3_0 pro 5s | 8.75 | 7777b2d0-1603-4a1b-82aa-2bff39d76455 | ✓ page keeps lines + seal through the pull-back |
| C9 | beat 9 signing: KO → KG | kling3_0 pro 5s | 8.75 | 77d270a5-95a5-4288-8c49-64a1cff1f472 | ✓ signature written stroke by stroke next to the seal |
| C10 | beat 10 paper falls: KG → KF | kling3_0 pro 5s | 8.75 | 9e9b78ca-372c-464a-8dc6-b792a363f7be | ✓ page tips and slides away, syringe revealed |
| C11 | beat 11 drain: KF → KE | kling3_0 pro 8s | 14 | 7120c469-876e-4387-b091-6e0320ef2f42 | ✓ rod pushes in, stopper drives the money out through the needle |

Totals: 12 image jobs (34 credits) + 6 clips (57.75) = **91.75 credits**, 0 clip
rerolls. Balance after: **147.5**.

Clips in `media/film/clips/`: `f-stamp-down`, `g-stamp-up`, `h-the-offer`,
`i-signing`, `j-paper-falls`, `k-funded`. The v1 ending (`f-the-stamp`,
`g-the-offer`, `h-signing`, `i-funded`) is kept in `clips/v1/`, unreferenced.
Keyframes and raw generations: `media/film/v2/`.

Lessons:
- GPT Image 2.5 edits at 16:9 come back 2688×1520 and, scaled to 2752×1536,
  often sit pixel-aligned with the source on one side of the frame and drift
  on the other. SIFT registration fails on a near-featureless page; align by
  scaling only and merge by difference.
- A red translucent footprint on the source frame placed the stamp where
  prose could not.
- The Higgsfield API rejects the `mask` role for nano_banana_2 despite the
  catalogue listing it.

## Film v2.1 (2026-09-22): drain re-shot, needle shortened

Brief from the user (voice): "the animation of the money doesn't look good when
the money gets squished, please make it always clear", and "I want to see more
of the needle, not a lot, and not the tip of the needle" — then, on seeing the
first cut: "the needle is too long, cut it in like half".

Two faults in the v2 ending. **The squish:** one 8s clip from a full barrel to
an empty one gave Kling a stretch it could not hold; a second in, the notes and
coins fused into a smooth amber blob and stayed that way for most of the shot,
then sat on an empty barrel for its last 2.7s. **The needle:** only ~90px of it
showed, and what did show was mostly the syringe's faceted metal hub, which
reads as a blunt point.

Fix: re-stage the shot with the syringe further from the safe, and cut the
drain into three clips joined on keyframes that are themselves crisp. Kling
keeps notes and coins separate while a decent column of them is left and
mushes what remains below about a quarter full — so pinning authored frames at
1/2 and 1/8 means it only ever interpolates across a stretch it can hold.

| ID | What | Model / settings | Cost | Job ID | Result |
|---|---|---|---|---|---|
| W1–2 | KF long needle, 1k | gpt_image_2_5 high **size:2k** (wrong key) | 6 | d20e606f-…, 7ee66352-… | ✗ came back 1344×752 — the parameter is `resolution`, not `size`; and both recomposed the shot smaller |
| W3–4 | KF long needle, 2k | gpt_image_2_5 high res 2k, ref KF | 6 | c4b88283-…, 4ccea474-… | ✓ v3 = `v2/kf2.png`; needle ~6× longer, money crisp |
| W5 | KM2 half | gpt_image_2_5, ref KF2 | 3 | 87c27c0d-… | ✓ merged onto KF2 |
| W6 | KE2 empty | gpt_image_2_5, ref KF2 | 3 | 63f37e52-… | ✓ merged onto KF2 |
| W7 | KQ2 last eighth | gpt_image_2_5, ref KF2 | 3 | 08083028-… | ✓ merged onto KF2 |
| X1 | beat 10 reveal: KG → KF2 | kling3_0 pro 5s | 8.75 | 05f48a1b-… | superseded (needle halved) |
| X2 | drain KF2 → KM2 | kling3_0 pro 5s | 8.75 | 5b1695d3-… | superseded — but proved the money holds 100%→50% |
| X3 | drain KM2 → KE2 | kling3_0 pro 5s | 8.75 | ca73af89-… | superseded — blobbed below ~25%, which is what set the 1/8 keyframe |
| X4–5 | drain KM2 → KQ2 → KE2 | kling3_0 pro 5s + 3s | 13 | dfaf6bed-…, ddfe6a79-… | discarded mid-flight when the needle was halved |
| Y1–2 | KF half-length needle | gpt_image_2_5 high res 2k, ref KF2 | 6 | 4ffd19b6-…, 509b5384-… | ✓ v1 = `v2/kf3.png`; plain shaft 350px vs 615px (the original was 85px) |
| Y3 | KM3 half | gpt_image_2_5, ref KF3 | 3 | 625ca6de-… | ✓ `v2/km3.png` |
| Y4 | KQ3 last eighth | gpt_image_2_5, ref KF3 | 3 | ddeef5c4-… | ✓ `v2/kq3.png` |
| Y5 | KE3 empty | gpt_image_2_5, ref KF3 | 3 | 71c00750-… | ✓ `v2/ke3.png` |
| Z1 | beat 10 reveal: KG → KF3 | kling3_0 pro 5s | 8.75 | 2667a1e8-… | ✓ **used** → `j-paper-falls.mp4` |
| Z2 | drain KF3 → KM3 | kling3_0 pro 5s | 8.75 | f2d1ebbf-… | ✓ **used** → `k-drain-a.mp4` |
| Z3 | drain KM3 → KQ3 | kling3_0 pro 5s | 8.75 | 33757b16-… | ✓ **used** → `k-drain-b.mp4` |
| Z4 | drain KQ3 → KE3 | kling3_0 pro 3s | 4.25 | 6e7f01f1-… | ✓ **used** → `k-drain-c.mp4` |

Totals: 12 image jobs (36 credits) + 9 clips (69.75) = **105.75 credits**, of
which 43 was spent on the long-needle cut the user then asked to halve.
Balance after: **41.75**. (A 3s kling3_0 pro clip costs 4.25, not a pro-rated
8.75.) All four keyframes are merged onto KF3 with
`tools/keyframe-merge.py`, so the safe and its screen are byte-identical
across them and the counter's homography did not move (measured 1453,171 ·
1779,149 · 1779,284 · 1456,298 — within 2px of the value already in film.js).

Beat 11 is now 156 frames cut from three clips at 12fps (`fps` and `clips` are
new per-beat options in `tools/film-frames.mjs`); the film is ~10,960px of
scrolling, ~540px longer. `tools/film-drain.py` was rewritten: the barrel
recedes so steeply to the left that gold pixel area under-reads the drain by
half at the midpoint, so the curve is now measured per clip and anchored to
the keyframes at the joins (0 · 0.5 · 0.875 · 1).

Lessons:
- gpt_image_2_5's resolution parameter is `resolution` (1k/2k/4k). `size` is
  silently ignored and you get 1k back.
- Kling holds a generated material's structure only across a moderate change.
  Ask it to take a barrel of banknotes from full to empty in one clip and the
  notes fuse; give it authored crisp frames every ~40% and they survive.
- Measuring a physical quantity off pixel area only works if the thing is not
  in steep perspective. Anchor to authored frames instead.

### v2.1a (same day): the drain re-cut, no new generation

The user sent a screen recording: the squeeze "is lagging", the money "gets
drained before it's squished until the end", and gold was visibly coming out
of the needle — "I don't have a lot of credits, use the existing footage,
just don't make it laggy."

Measured on the frames, both faults were in `k-drain-c.mp4` and neither needed
a reroll:

- **The stall.** Its first 1.6s move nothing: gold columns hold at 243-231
  while the stopper sits still, then the whole rest drains in 1.3s. Across the
  beat that showed up as ~40 frames where the picture barely changed while the
  counter kept climbing.
- **The debris.** From ~f45 it throws flakes of gold OUT of the nozzle, which
  hang in the air over the needle.

Fixes, both in `tools/film-frames.mjs`:
- `range` trims a clip to a time window, and a part may carry its own `fps`.
  The last clip is now listed twice: 1.0-1.6s sampled at 6fps (it carries the
  change from banknotes to flakes without spending scroll on a still picture)
  and 1.6-3.05s at 12fps. Its dead first second is simply not extracted.
- `clean` patches a box that nothing in the shot can legitimately cross —
  here the gap between the nozzle and the safe — against the clip's own first
  frame, at a threshold that keeps slow lighting changes and catches
  high-contrast debris.

Result: beat 11 is 141 frames (was 156), the film is ~10,770px, the drain runs
at a near-constant 0.0071 per frame with only 4 frames below a third of that
(was a 40-frame stall), and the worst frame now has 10 changed pixels in the
needle gap (was hundreds, as visible flakes). Counter verified $0 → $97,511 →
$166,744 → $214,629 → $237,765 → $248,500. **0 credits.**

Still imperfect: in the last ~20 frames the remaining money renders as pale
flakes rather than banknotes. That is in the generated footage and cannot be
re-cut away — only re-shot (~4.25 credits for a 3s clip), and the same
transition has already failed twice, so a reroll is not a safe bet.

### v2.1b (2026-09-23): the needle that "changes" — two causes, both in code

The user sent two photos of the same moment with visibly different needles and
asked for it to be consistent. Measured across every frame, the film's own
needle never moves: 259-260px through all 141 frames of beat 11, and it
settles to that within 7px by frame 56 of the reveal. The inconsistency was
not in the footage.

1. **The storyboard still was stale.** `media/film/k-funded.webp` — one of the
   six pictures the section ships VISIBLE, before the canvas has frames, and
   what reduced motion, no-JS and a slow connection keep — was cut from the
   pre-restaging render: syringe far from the safe, needle a stub barely
   longer than its hub. Scroll in and you saw that, then watched it swap to a
   differently-framed film. New `tools/film-board.mjs` cuts all six stills
   (including `k1`, which doubles as the canvas poster) straight out of
   `media/film/frames`, so the fallback cannot disagree with the film again.
   Run it after `tools/film-frames.mjs`.

2. **The canvas cropped the safe off at ordinary window sizes.** The stage
   covered above 768px wide, full stop. At 1163x1022 — the size in the user's
   own screenshot — covering a stage that much squarer than a 16:9 frame threw
   away a third of the width, which is where the safe and the counter live:
   the funded total rendered as "$24". `film.js` now picks cover vs contain
   from whether the counter's own QUAD still clears the crop with 2% to spare,
   not from a breakpoint, and sets the poster's object-fit to match so nothing
   jumps at the handover. Verified at eight sizes from 1920x1080 to 390x844:
   1920, 1600 and 1440-wide still cover full-bleed; squarer windows letterbox;
   the counter is fully on stage at every one.

0 credits.

### v2.1c (2026-09-23): the final drain clip re-shot

The user approved spending on the ending. Two 3s candidates were generated
against the same pair of keyframes (kq3 -> ke3), because this transition had
already failed twice and one reroll is a coin flip:

| ID | What | Model / settings | Cost | Job ID | Result |
|---|---|---|---|---|---|
| F1 | kq3 -> ke3, forwards | kling3_0 pro 3s | 5.25 | 765cdba3-… | ✓ **used** -> `k-drain-c.mp4` |
| F2 | ke3 -> kq3, to be played BACKWARDS | kling3_0 pro 3s | 5.25 | 80e1bb1a-… | ✗ loses the banknotes almost at once; kept as `v2/clips/c11c-rev.mp4` |

The reverse idea was that a model interpolating TOWARDS a crisp keyframe
should hold the notes better than one interpolating towards nothing. It did
not: F2 shows banknotes only in its first played frame, F1 holds them to ~40%
of the clip. Worth knowing — the trick is cheap to try and did not work here.

F1 fixes what the old clip got wrong: no stall (longest 9 frames vs 40),
the stopper stays in contact with the money, and **zero debris outside the
glass** before any repair. The prompt that got it states three numbered rules
— stopper stays in contact, notes stay note-shaped until they enter the
needle, nothing crosses the glass — rather than describing the shot.

Cut into the beat as two parts of one clip: 0-1.42s at the beat's 12fps (the
stretch where it still draws banknotes) and 1.42-3.05s at 6fps, so the flake
phase is over in a third of the scroll. `tools/film-frames.mjs` now records
each part's clip name in the manifest and `tools/film-drain.py` merges
consecutive parts from the same clip, so ANCHORS is back to the four authored
keyframes with nothing invented between them.

Beat 11: 147 frames, needle constant at 259-260px across every one, worst
frame 14 changed px outside the glass, film ~10,850px. Counter $0 → $134,762
→ $223,849 → $248,500. **10.5 credits. Balance after: 31.25.**


## Film v2.1d — 2026-09-23 — the drain, fixed without generating anything

**0 credits. Balance unchanged: 31.25.**

The client came back a third time: *"why the thing that pushes the money is
lagging and changing every second."* The two previous rounds had treated this
as a footage problem and re-shot the clip. It was not. Both faults were in
this repo, and both came from the same mistake — trusting what the authored
keyframes were **called** over what is actually in them.

### 1. The stopper lurched

`tools/film-drain.py` anchored the drain on keyframes declared as 0 / ½ / ⅞ /
full drained, and `film-frames.mjs` spent frames to match. Measured instead:
the barrel's silhouette is 204px at the back and 214px at the nozzle, so it is
effectively side-on and **money left = distance the stopper still has to go**.
By that measure the "half" frame is a quarter drained and the "eighth left"
frame is barely over half. The last clip was being asked to cover 40% of the
barrel in 18% of the beat.

Measured stopper travel per frame, before → after:

| | clip a | clip b | clip c (head) | clip c (tail) | worst single frame |
|---|---|---|---|---|---|
| before | 2.4px | 2.8px | 4.5px | **14.3px** | **73px** |
| after | 2.55px | 2.55px | 2.55px | 2.55px | 5px |

`pace` in film-frames.mjs now ignores the clock: every frame of every clip is
decoded and measured, and the beat keeps the ones sitting on an evenly spaced
ladder of stopper positions. 313 source frames in, 173 kept. Because travel
*is* volume here, the counter riding on it came out even too — drain at each
tenth of the beat is now 0.095, 0.189, 0.289, 0.394, 0.494, 0.594, 0.711,
0.805, 0.926.

### 2. The chamber changed — a second stopper

The authored "empty" keyframe `ke3` has the stopper parked **back at the
barrel's mouth**: it is a full frame with the money deleted. So the last clip
spends its length drawing a phantom stopper at the back while the real one
moves forward, and swings the empty glass through a hard chrome banding that
strobes frame to frame (mean brightness 97 → 121 → 97 in six frames). Every
"the needle/chamber is not consistent" report traces to this.

`chamber` paints it out. The barrel behind the stopper is glass that nothing
ever moves through, so one plate of it — cut from **this film's own footage**,
at the end of the middle clip where the emptied stretch is longest, and
mirrored rightwards to cover the rest — is composited into every frame behind
the stopper, feathered at the seam. Measured after: the emptied chamber varies
by **0.19 of 255** across all 173 frames, which is WebP quantisation and
nothing else.

Re-shooting would not have fixed this. The keyframe it would have been aimed
at is the thing that is wrong.

### 3. The counter was reading the scrollbar

Found while verifying. `film.js` painted `nearest(want)` — the closest frame
already loaded — but fed `want` to the counter. Arrive at the last beat before
its frames are resident and the funded total runs to $248,500 over a syringe
still half full. That is precisely what *"the money just gets drained before
it's squished"* looks like, and it had been in there the whole time. The
counter now reads off the frame actually on the canvas; the caption still
follows the scroll, because a caption names the step you scrolled into.

Doing that exposed the other half of the same bug: a frame that arrives *after*
the playhead has passed it was never drawn, so jumping straight to the end left
the film resting one frame short with the counter stopped at $236,348. The
onUpdate body is now a named `render(progress)` that `loadBeat` also calls when
a beat finishes loading. Verified both ways — scrolled through frame by frame,
and dropped straight onto the last pixel of the pin — both land on the empty
syringe at $248,500.

### State

Beat 11: 173 frames from 3 clips [49, 63, 61], stopper 520 → 958px, zero
backward steps, chamber frozen, needle constant. Film 887 desktop / 448
mobile frames, pin 11,176px. Counter $0 → $248,500 with no tick backwards at
any of 30 sampled points. No console errors; counter fully on stage at
1600×900, 1163×1022 and 390×844.

**Lessons.** A generated keyframe is a photograph, not a specification — measure
what is in it before building a curve on its name. And when a client says the
same thing three times, the third answer is usually not more footage.

## Film v2.1e — 2026-09-27 — captions readable, ending line reworded

**0 credits.**

Client: the scroll captions are "small and black and not visible... especially
when you scroll down." Confirmed in headless Chrome — at the old
`clamp(12px, 1.05vw, 15px)` the box rendered at its 12px floor on anything
under ~1400px wide, and the box behind it (55% black, 6px blur) wasn't enough
against the brighter footage (the monitor screen in beat 1, the lit page in
the stamp beats).

`src/css/10-film.css` `.film__caption`: `clamp(16px, 1.6vw, 22px)` (was
12–15px), weight 500, background raised to 72% opacity with an 8px blur, plus
a text-shadow for the letterforms themselves. Padding and the left-rule inset
moved from `--s-3` to `--s-4` to match. Verified at 1600x900 and 375x812 —
legible over both the darkest beat (the safe) and the brightest (the monitor).

Ending caption changed per the client's wording: "You get funded." →
"The money injects straight into your bank." (`src/partials/home-film.html`,
`docs/REFERENCE-PACKAGE.md` table). The storyboard fallback's own line —
"Funds land in your account, usually within 24–48 hours." — already said this
without "you get funded" in it, so it was left as-is.
