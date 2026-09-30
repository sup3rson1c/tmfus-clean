/*
  Extract the scroll-scrubbed frame sequence for the funding film.

  Usage: node tools/film-frames.mjs [--fps=15] [--w=1920] [--q=78] [--only=d]
                                    [--beats=6,7,8]
  --beats re-extracts just those beats and keeps every other beat's entry in
  the existing manifest, so a re-cut late beat does not re-encode the film.
  The dev server must already be running: node serve.mjs 3200

  Decoding runs in headless Chrome rather than ffmpeg: there is no ffmpeg on
  this machine, and this sandbox's node_modules is a junction to the real
  project, so installing one would write through to it. Chrome already decodes
  H.264, so each clip is seeked and painted to a canvas.

  Why frames and not video:
    A <video> scrubbed by currentTime measures ~100ms per seek-to-paint even
    fully buffered — six times too slow for 60fps. WebCodecs decodes fine, but
    caching decoded frames costs ~589MB per beat at 1920x1072, so it can only
    fit by dropping below the resolution we already ship. Compressed frames let
    the browser's own image cache manage memory, which is the only thing that
    scales to nine beats.

  Output is chunked PER BEAT so film.js can load a window around the viewer
  and release the rest, instead of holding all nine beats at once:

    media/film/frames/d/b1/0001.webp ... (desktop)
    media/film/frames/m/b1/0001.webp ... (mobile, half width, every 2nd frame)
    media/film/frames/manifest.json

  The first frame of every clip after the first repeats the previous clip's
  end_image, so those seam frames are dropped on the way through.
*/
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { launch } from "./browser.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Beat number -> clip file. Beats are the unit of LOADING, not of shooting:
// `clips` lets one beat be cut from several back-to-back clips, which is how
// the drain is built. Kling only takes a start and an end image, so a long
// move has to be generated in 5s pieces with a shared keyframe at each join;
// making them one beat keeps the manifest, the drain curve and the counter
// working on a single continuous run of frames.
// `skip` drops time ranges (seconds) inside a clip - only where the picture
// is static, so the cut cannot be seen - to keep a beat from idling.
// `range` uses only part of a clip, in seconds. `clean` repairs a box that
// nothing in the shot should ever move through - see the beat 11 note below.
// `reverse` plays a clip backwards, which is how you get a move the model
// will not generate forwards: it renders an emptying barrel as mush because
// it is interpolating towards nothing, but filling one towards a crisp end
// frame it handles, and that clip run backwards IS the emptying.
// `fps` overrides the sample rate for one beat. Scroll length is paced per
// frame, so a long slow locked shot sampled at the film's 15fps would buy
// itself a screenful of scrolling it does not need; the drain is sampled
// lower and reads the same, because nothing in it moves quickly.
// `track` + `pace` sample a beat on WHERE SOMETHING IS instead of on the
// clock, and `chamber` freezes the space it has already moved through. Both
// are explained at beat 11, which is the only beat that needs them.
// `crop` removes [top, bottom] source rows before scaling. Kling renders some
// clips at 1912x1080 and others at 1928x1076, and fits the shared keyframe
// into each differently: measured at the offer -> signing seam, the 1080-tall
// render sat ~9px lower and 0.5% shorter. Cropping rows 9..1071 and scaling
// to the standard frame puts both sides of the seam on the same picture.
// Between the nozzle and the safe there is only the needle and the back wall,
// and nothing in the shot ever crosses it - so anything that appears there is
// debris and gets painted back out. See `clean` below.
const CLEAN_GAP = { box: [1085, 375, 1395, 695], thresh: 26 };

const BEATS = [
  { beat: 1, clip: "a-owner-to-screen.mp4" },
  { beat: 2, clip: "b-into-system.mp4" },
  { beat: 3, clip: "c-out-to-analyst.mp4" },
  { beat: 4, clip: "d-to-underwriting.mp4" },
  { beat: 5, clip: "e-to-the-number.mp4" },
  // v2 ending (2026-09-22): one page from the stamp to the signature.
  // Stamp: trim the empty page between the hand leaving and the stamp
  // arriving, and all but ~0.9s of the pressed hold across the two clips.
  { beat: 6, clip: "f-stamp-down.mp4", skip: [[1.75, 2.1], [4.35, 6]] },
  { beat: 7, clip: "g-stamp-up.mp4", skip: [[0.45, 1.9]] },
  { beat: 8, clip: "h-the-offer.mp4" },
  { beat: 9, clip: "i-signing.mp4", crop: [9, 9] },
  { beat: 10, clip: "j-paper-falls.mp4", crop: [9, 9] },
  /* The drain -----------------------------------------------------------
     Three clips generated between four authored keyframes: full, "half",
     "an eighth left", empty. Kling keeps notes and coins separate while
     there is a decent column of them and mushes what is left into a gold
     blob below about a quarter full, which is why it is cut in pieces at
     all: it only ever interpolates across a stretch it can hold.

     Two things about this beat were wrong until 2026-09-23, and both came
     out of the same mistake - trusting what those keyframes were CALLED
     over what is actually in them.

     1. The stopper lurched. The keyframes were treated as 0 / 1/2 / 7/8 /
        full drained and the beat was cut to spend frames in proportion, but
        the barrel is very nearly side-on: its silhouette runs 204px at the
        back to 214px at the nozzle, so there is no foreshortening to speak
        of and the money left is simply proportional to how far along the
        barrel the stopper is. Measured that way the "half" frame is a
        quarter drained and the "eighth left" frame is barely over half, so
        the last clip was being asked to cover 40% of the barrel in 18% of
        the frames. It ran at 14px of travel per frame against 2.4px for the
        rest, with one 73px jump - the lag the client kept reporting.
        `pace` fixes it by ignoring the clock: every frame of every clip is
        measured, and the beat keeps the ones on an evenly spaced ladder of
        stopper positions. The stopper now moves the same distance on every
        single frame of the beat, and because travel IS volume here, the
        counter that rides on it comes out even too.

     2. The chamber changed. The authored "empty" frame has the stopper
        parked back at the barrel's mouth - it is really a full frame with
        the money deleted - so the last clip spends its length drawing a
        SECOND stopper at the back while the real one moves forward, and
        swings the empty glass through a hard chrome banding that strobes
        frame to frame. `chamber` paints that whole space out: the barrel
        behind the stopper is glass that nothing ever moves through, so one
        plate of it - cut from this film's own footage, near the end of the
        middle clip where the emptied stretch is longest - is composited
        into every frame behind the stopper. The barrel the viewer scrolls
        past is then identical in all 173 frames, and the phantom goes with
        it. Re-shooting the clip would not have fixed this; the keyframe it
        was aimed at is the thing that is wrong.

     `clean` still patches the gap between the nozzle and the safe, where a
     few flakes of gold get thrown out over the needle. Nothing in the shot
     ever legitimately crosses it. */
  {
    beat: 11,
    fps: 24, // the clips' own rate: measure every frame, then choose
    // Where the stopper is. It is the rightmost wide band of dark pixels
    // across the barrel - the money ahead of it is bright, the emptied glass
    // behind it is mid-grey, and taking the RIGHTMOST one is what ignores
    // the phantom the last clip draws at the back.
    track: { band: [435, 600], search: [500, 1061], dark: 60, cover: 0.62, min: 25 },
    // 173 frames puts the ladder at ~2.5px of travel per frame, which is the
    // most the last clip can carry without repeating a source frame.
    pace: { frames: 173 },
    chamber: {
      plate: "k-drain-b.mp4", // the clip the plate is cut from
      // Where the plate is allowed to paint: the barrel glass, from its back
      // rim to just short of the nozzle. It has to start at the back rim and
      // not merely where the money begins, because the last clip redraws that
      // whole end of the barrel - a fatter collar, a rod that flares - and
      // leaving a strip of it unpainted would leave the flicker in view.
      box: [336, 404, 1020, 650],
      source: [336, 770], // the emptied stretch it is cut from, mirrored to fill
      lead: 8, // stop this far short of the stopper's near edge
      feather: 26,
      edge: 16,
    },
    clips: [
      { clip: "k-drain-a.mp4", crop: [9, 9] },
      { clip: "k-drain-b.mp4", crop: [9, 9] },
      { clip: "k-drain-c.mp4", crop: [9, 9], clean: CLEAN_GAP },
    ],
  },
];

// One beat may be cut from several clips; normalise both spellings to a list.
const partsOf = (b) => b.clips ?? [{ clip: b.clip, skip: b.skip, crop: b.crop }];

const SRC = join(ROOT, "media", "film", "clips");
const OUT = join(ROOT, "media", "film", "frames");

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
const str = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const fps = flag("fps", 15);
const width = flag("w", 1920);
const quality = flag("q", 78);
const only = str("only", "");
const onlyBeats = str("beats", "").split(",").filter(Boolean).map(Number);
const port = flag("port", 3200);
const origin = `http://localhost:${port}`;

// Only the beats whose clips actually exist — lets the film grow one beat at
// a time without this failing on the ones not generated yet.
const present = BEATS.filter((b) => partsOf(b).every((p) => existsSync(join(SRC, p.clip))));
const todo = onlyBeats.length ? present.filter((b) => onlyBeats.includes(b.beat)) : present;
if (!present.length) {
  console.error(`no clips found in ${SRC}`);
  process.exit(1);
}
console.log(`beats present: ${present.map((b) => b.beat).join(", ")}`);

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

// Land on the dev server's origin first (this path 404s, which keeps the page
// light). A setContent page has an opaque origin: the video would refuse to
// load, and would taint the canvas even if it did.
const reachable = await page.goto(`${origin}/__film-frames__`, { waitUntil: "domcontentloaded" }).catch(() => null);
if (!reachable) {
  console.error(`no dev server on ${origin} — start one first: node serve.mjs ${port}`);
  await browser.close();
  process.exit(1);
}
await page.evaluate(() => {
  document.body.innerHTML = '<video id="v" muted playsinline></video><canvas id="c"></canvas>';
});

const grab = (url, t, first) =>
  page.evaluate(
    async (src, time, load) => {
      const v = document.getElementById("v");
      const c = document.getElementById("c");
      if (load) {
        v.src = src;
        await new Promise((res, rej) => {
          v.onloadedmetadata = res;
          v.onerror = () => rej(new Error("video load failed"));
        });
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      await new Promise((res) => {
        v.onseeked = res;
        v.currentTime = time;
      });
      c.getContext("2d").drawImage(v, 0, 0);
      // PNG here, not JPEG: this is the intermediate, so stay lossless and let
      // the single WebP pass below be the only generation of loss.
      return { data: c.toDataURL("image/png"), duration: v.duration, w: c.width, h: c.height };
    },
    url,
    t,
    first
  );

/* Repairing a box that should never change ------------------------------
   Generated footage sometimes puts something where the shot's own logic says
   nothing can be: a flake of gold in the air beside the needle. Where the box
   is genuinely static, the clip's first frame is the truth, so anything that
   differs from it by more than `thresh` is painted back out. The threshold
   keeps slow lighting changes (the plinth dims as the gold leaves) while
   catching high-contrast debris. */
const boxOf = ([x0, y0, x1, y1]) => ({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });

const patchPlate = async (probe, box) =>
  sharp(Buffer.from(probe.data.split(",")[1], "base64")).extract(boxOf(box)).removeAlpha().raw().toBuffer();

const patchBox = async (buf, plate, { box, thresh }) => {
  const rect = boxOf(box);
  const cur = await sharp(buf).extract(rect).removeAlpha().raw().toBuffer();
  let touched = 0;
  for (let i = 0; i < cur.length; i += 3) {
    const d = Math.max(Math.abs(cur[i] - plate[i]), Math.abs(cur[i + 1] - plate[i + 1]), Math.abs(cur[i + 2] - plate[i + 2]));
    if (d > thresh) {
      cur[i] = plate[i];
      cur[i + 1] = plate[i + 1];
      cur[i + 2] = plate[i + 2];
      touched += 1;
    }
  }
  if (!touched) return buf;
  const patch = await sharp(cur, { raw: { width: rect.width, height: rect.height, channels: 3 } }).png().toBuffer();
  return sharp(buf).composite([{ input: patch, left: rect.left, top: rect.top }]).png().toBuffer();
};

/* Sampling a beat on where something is -----------------------------------
   Everything below works on the FINISHED picture - cropped and scaled to the
   1920x1072 frame - because that is the only geometry the numbers in a beat's
   `track` and `chamber` could sensibly be written in. A source frame of the
   same shot can arrive 1912x1080 or 1928x1076 depending on the render. */
const FRAME_W = 1920;
const FRAME_H = 1072;

const fitted = async (buf, crop, w = FRAME_W) => {
  const img = sharp(buf);
  const { width: sw, height: sh } = await img.metadata();
  return img
    .extract({ left: 0, top: crop[0], width: sw, height: sh - crop[0] - crop[1] })
    .resize(w, Math.round((w * FRAME_H) / FRAME_W), { fit: "fill" });
};

// The stopper's near edge: scan the barrel for columns that are mostly dark,
// and take the start of the RIGHTMOST run wide enough to be the stopper.
const trackX = async (buf, crop, t) => {
  const g = await (await fitted(buf, crop)).greyscale().raw().toBuffer();
  const [y0, y1] = t.band;
  const [x0, x1] = t.search;
  const need = (y1 - y0) * t.cover;
  let best = null;
  let run = 0;
  for (let x = x0; x < x1; x += 1) {
    let dark = 0;
    for (let y = y0; y < y1; y += 1) if (g[y * FRAME_W + x] < t.dark) dark += 1;
    if (dark >= need) run += 1;
    else {
      if (run >= t.min) best = x - run;
      run = 0;
    }
  }
  if (run >= t.min) best = x1 - run;
  return best;
};

/* Pick `frames` of the measured candidates so that the tracked thing advances
   by the same distance every time. Candidates that do not advance - a stall in
   the footage - are simply never chosen, which is what keeps a scroll-scrubbed
   film from sitting still while the page moves under it. */
const onLadder = (measured, frames) => {
  let seen = -Infinity;
  const x = measured.map((m) => (seen = Math.max(seen, m.x))); // never let it slip back
  const step = (x[x.length - 1] - x[0]) / (frames - 1);
  const picked = [];
  let i = 0;
  for (let k = 0; k < frames; k += 1) {
    const want = x[0] + step * k;
    while (i + 1 < x.length && Math.abs(x[i + 1] - want) <= Math.abs(x[i] - want)) i += 1;
    picked.push({ ...measured[i], x: x[i] });
    i = Math.min(i + 1, x.length - 1); // strictly forward, so no frame repeats
  }
  return picked;
};

/* The plate that freezes the emptied barrel. It is a strip of this film's own
   footage, taken where the emptied stretch is longest, and mirrored rightwards
   to cover the rest of the barrel - the glass is banded along its length and
   almost unchanging across it, so a reflection joins onto itself invisibly and
   nothing has to be invented. */
const buildPlate = async (buf, crop, c, w) => {
  const s = w / FRAME_W;
  const box = c.box.map((v) => Math.round(v * s));
  const [sx0, sx1] = c.source.map((v) => Math.round(v * s));
  const h = box[3] - box[1];
  const src = await (await fitted(buf, crop, w))
    .extract({ left: sx0, top: box[1], width: sx1 - sx0, height: h })
    .removeAlpha()
    .raw()
    .toBuffer();
  const sw = sx1 - sx0;
  const out = Buffer.alloc((box[2] - box[0]) * h * 3);
  for (let x = box[0]; x < box[2]; x += 1) {
    // Reflect back and forth across the source strip: ...2,1,0,1,2...
    const period = 2 * (sw - 1);
    const m = (((x - sx0) % period) + period) % period;
    const from = m < sw ? m : period - m;
    for (let y = 0; y < h; y += 1) {
      src.copy(out, (y * (box[2] - box[0]) + (x - box[0])) * 3, (y * sw + from) * 3, (y * sw + from) * 3 + 3);
    }
  }
  return { box, data: out, w: box[2] - box[0], h, lead: c.lead * s, feather: c.feather * s, edge: c.edge * s };
};

// Blend the plate into a finished frame, everywhere behind the stopper.
const paintChamber = (frame, w, plate, stopper) => {
  const [bx0, by0] = plate.box;
  const cut = stopper - plate.lead;
  for (let y = 0; y < plate.h; y += 1) {
    const fy = by0 + y;
    const av = Math.min(1, Math.min(y, plate.h - 1 - y) / plate.edge);
    if (av <= 0) continue;
    for (let x = 0; x < plate.w; x += 1) {
      const fx = bx0 + x;
      const a = av * Math.min(1, Math.max(0, (cut - fx) / plate.feather)) * Math.min(1, x / plate.edge);
      if (a <= 0) continue;
      const fi = (fy * w + fx) * 3;
      const pi = (y * plate.w + x) * 3;
      for (let ch = 0; ch < 3; ch += 1) frame[fi + ch] = Math.round(frame[fi + ch] * (1 - a) + plate.data[pi + ch] * a);
    }
  }
};

/* A paced beat is cut in two passes: decode every frame of every clip to find
   out where the stopper is, then decode again only at the times the ladder
   picked. Doing both in one pass would mean holding a few hundred full-size
   PNGs at once. Seeking is ~100ms, so the second pass is the cheap one. */
const measureBeat = async (entry) => {
  const step = 1 / (entry.fps ?? fps);
  const measured = [];
  for (const [part, { clip, crop = [0, 0] }] of partsOf(entry).entries()) {
    const url = `${origin}/media/film/clips/${clip}`;
    const probe = await grab(url, 0, true);
    const before = measured.length;
    // Skip t=0 on every clip but the first: it repeats the previous clip's
    // last frame, which is the keyframe they were generated to share.
    for (let t = part ? step : 0; t < probe.duration - 1e-3; t += step) {
      const s = t === 0 ? probe : await grab(url, t, false);
      const x = await trackX(Buffer.from(s.data.split(",")[1], "base64"), crop, entry.track);
      if (x !== null) measured.push({ part, clip, crop, t, x });
    }
    console.log(`beat ${entry.beat} ${clip}: measured ${measured.length - before} frames`);
  }
  return measured;
};

const manifest = { fps, beats: [] };
// Partial run: start from the existing manifest's entries for untouched beats.
const previous = existsSync(join(OUT, "manifest.json")) ? JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8")) : { beats: [] };
if (onlyBeats.length) {
  for (const b of present) {
    if (onlyBeats.includes(b.beat)) continue;
    const old = previous.beats.find((x) => x.beat === b.beat);
    if (old) manifest.beats.push(old);
  }
}
let totalBytes = 0;

for (const entry of todo) {
  const { beat } = entry;
  const keep = [];
  // What each part contributed, so tools that need to know where one clip ends
  // and the next begins (film-drain.py anchors its curve on the keyframes at
  // those joins) do not have to re-derive it from durations - and so two
  // parts cut from the SAME clip can be recognised as one continuous stretch
  // with no keyframe between them.
  const parts = [];
  let previousClip = null;
  // A paced beat decides its own sample times, so the loop below is handed a
  // per-part list of them instead of a sample rate.
  const chosen = entry.pace ? onLadder(await measureBeat(entry), entry.pace.frames) : null;
  if (chosen) {
    const span = chosen[chosen.length - 1].x - chosen[0].x;
    console.log(`beat ${beat}: ${chosen.length} frames on a ${(span / (chosen.length - 1)).toFixed(2)}px ladder (${chosen[0].x} -> ${chosen[chosen.length - 1].x})`);
  }
  for (const [part, { clip, skip = [], crop = [0, 0], range, clean, reverse, fps: partFps }] of partsOf(entry).entries()) {
    const url = `${origin}/media/film/clips/${clip}`;
    const probe = await grab(url, 0, true);
    const step = 1 / (partFps ?? entry.fps ?? fps);
    const [from, to] = range ?? [0, probe.duration];
    const times = [];
    if (chosen) for (const c of chosen) { if (c.part === part) times.push(c.t); }
    else for (let t = from; t < Math.min(to, probe.duration) - 1e-3; t += step) {
      if (!skip.some(([a, b]) => t >= a && t < b)) times.push(t);
    }

    // The repair plate is always the clip's own first frame, even when `range`
    // means it is not kept: it has to match the clip it is patching.
    const plate = clean ? await patchPlate(probe, clean.box) : null;

    // Where the tracked thing is on each kept frame, carried alongside the
    // picture because `chamber` needs it to know what is already empty.
    const xs = chosen ? chosen.filter((c) => c.part === part).map((c) => c.x) : [];
    const shots = [];
    for (let i = 0; i < times.length; i += 1) {
      const s = times[i] === 0 ? probe : await grab(url, times[i], false);
      let buf = Buffer.from(s.data.split(",")[1], "base64");
      if (plate) buf = await patchBox(buf, plate, clean);
      // Crop rides with the frame: parts of one beat can come from renders of
      // different heights, so it cannot be decided once per beat.
      shots.push({ buf, crop, x: xs[i] });
    }
    // Drop the seam frame that repeats the previous clip's last frame - at the
    // start of every clip except the very first one in the film.
    // Reversed BEFORE the seam frame is dropped: played backwards, the frame
    // that repeats the previous clip's last one is the source's last, which
    // reversing puts first - so the rule below still lands on it.
    if (reverse) shots.reverse();
    // The first frame of a clip repeats the last frame of the one before it,
    // so it is dropped - but only at a real join. A clip listed twice to give
    // one stretch of it a different sample rate is continuous, not a seam.
    const seam = previousClip !== null && previousClip !== clip;
    const first = keep.length === 0 && beat === present[0].beat;
    const before = keep.length;
    // A paced beat dropped its seam frames while measuring, before any of
    // them could be chosen, so everything it picked is kept.
    keep.push(...(chosen || first || (previousClip === clip && keep.length) ? shots : shots.slice(1)));
    parts.push({ clip, count: keep.length - before });
    previousClip = clip;
    void seam;
  }

  // The chamber plate, cut once from the clip named in the config, at its last
  // frame - the point in the beat where the emptied stretch of barrel is
  // longest and so the strip of it to copy is widest.
  let plates = null;
  if (entry.chamber) {
    const { clip, crop = [0, 0] } = partsOf(entry).find((p) => p.clip === entry.chamber.plate);
    const url = `${origin}/media/film/clips/${clip}`;
    const probe = await grab(url, 0, true);
    const shot = await grab(url, probe.duration - 1 / (entry.fps ?? fps), false);
    const buf = Buffer.from(shot.data.split(",")[1], "base64");
    plates = { buf, crop };
    console.log(`beat ${beat}: chamber plate from ${clip} @${(probe.duration - 1 / (entry.fps ?? fps)).toFixed(2)}s`);
  }

  const sets = [
    { key: "d", dir: join(OUT, "d", `b${beat}`), w: width, list: keep },
    { key: "m", dir: join(OUT, "m", `b${beat}`), w: Math.round(width / 2), list: keep.filter((_, i) => i % 2 === 0) },
  ].filter((s) => !only || s.key === only);

  const counts = {};
  for (const set of sets) {
    rmSync(set.dir, { recursive: true, force: true });
    mkdirSync(set.dir, { recursive: true });
    const plate = plates ? await buildPlate(plates.buf, plates.crop, entry.chamber, set.w) : null;
    let bytes = 0;
    for (let i = 0; i < set.list.length; i += 1) {
      const out = join(set.dir, `${String(i + 1).padStart(4, "0")}.webp`);
      // Every frame leaves at the film's one size (1920x1072 / 960x536), so
      // a beat rendered at a slightly different aspect cannot jump at a seam.
      const { crop, x } = set.list[i];
      let img = await fitted(set.list[i].buf, crop, set.w);
      if (plate) {
        const h = Math.round((set.w * FRAME_H) / FRAME_W);
        const raw = await img.removeAlpha().raw().toBuffer();
        paintChamber(raw, set.w, plate, (x * set.w) / FRAME_W);
        img = sharp(raw, { raw: { width: set.w, height: h, channels: 3 } });
      }
      await img.webp({ quality, effort: 5 }).toFile(out);
      bytes += statSync(out).size;
    }
    counts[set.key] = set.list.length;
    totalBytes += bytes;
    console.log(`beat ${beat} ${set.key}: ${set.list.length} frames @${set.w}w, ${(bytes / 1048576).toFixed(1)}MB`);
  }

  manifest.beats = manifest.beats.filter((b) => b.beat !== beat);
  manifest.beats.push({
    beat,
    desktop: { count: counts.d ?? 0, pattern: `/media/film/frames/d/b${beat}/%d.webp` },
    mobile: { count: counts.m ?? 0, pattern: `/media/film/frames/m/b${beat}/%d.webp` },
    ...(parts.length > 1 ? { parts } : {}),
    // Where the stopper is on each frame, in frame pixels. Written here so
    // film-drain.py can turn it into a drain curve without measuring the
    // finished frames all over again, and so a future reader can see that the
    // beat really is evenly paced without opening a single image.
    ...(chosen ? { track: keep.map((s) => s.x) } : {}),
  });
}

await browser.close();

manifest.beats.sort((a, b) => a.beat - b.beat);
// Keep per-beat extras written by other tools (the counter's drain curve).
for (const b of manifest.beats) {
  const old = previous.beats.find((x) => x.beat === b.beat);
  if (old?.drain && !onlyBeats.includes(b.beat)) b.drain = old.drain;
}
writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nmanifest written · ${manifest.beats.length} beats · ${(totalBytes / 1048576).toFixed(1)}MB total on disk`);
