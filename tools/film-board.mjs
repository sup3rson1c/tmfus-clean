/*
  Cut the storyboard stills straight out of the film's own frames.

  Usage: node tools/film-board.mjs

  The storyboard in home-film.html is what the section ships visible: it is
  what reduced motion, no JS, a slow connection and the moment before the
  canvas has frames all fall back to, and `k1` doubles as the poster the
  canvas fades out from. So every one of those stills has to BE a frame of
  the film.

  They used to be hand-picked keyframe renders, and they drifted: when the
  syringe was re-staged closer to the safe, `k-funded` kept the old wide gap
  and a needle stub barely longer than its hub. Scrolling in, you saw that
  picture and then watched it swap to a differently-framed one — read, quite
  reasonably, as the needle changing length mid-animation.

  Cutting them from `media/film/frames` removes the whole class of problem:
  re-run this after tools/film-frames.mjs and the fallback cannot disagree
  with the film again.
*/
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = join(ROOT, "media", "film", "frames");
const OUT = join(ROOT, "media", "film");

// The markup's width/height attributes; frames are 1920x1072 (same 16:9).
const W = 2048;
const H = 1143;

// `frame` is 1-based into the beat, or negative to count back from its end.
const BOARD = [
  { file: "k1", beat: 1, frame: 1 }, // also the canvas poster
  { file: "k3", beat: 3, frame: 1 },
  { file: "k5", beat: 5, frame: -1 },
  { file: "k-seal", beat: 7, frame: -1 }, // the ink seal, revealed
  { file: "k-signed", beat: 9, frame: -1 }, // signature beside it
  { file: "k-funded", beat: 11, frame: 1 }, // syringe full, needle in the safe
];

const manifest = JSON.parse(readFileSync(join(FRAMES, "manifest.json"), "utf8"));

for (const { file, beat, frame } of BOARD) {
  const entry = manifest.beats.find((b) => b.beat === beat);
  if (!entry) {
    console.error(`beat ${beat} is not in the manifest — skipping ${file}`);
    continue;
  }
  const n = frame < 0 ? entry.desktop.count + 1 + frame : frame;
  const src = join(FRAMES, "d", `b${beat}`, `${String(n).padStart(4, "0")}.webp`);
  const out = join(OUT, `${file}.webp`);
  await sharp(src).resize(W, H, { fit: "fill" }).webp({ quality: 82, effort: 5 }).toFile(out);
  console.log(`${file}.webp  <- beat ${beat} frame ${n}/${entry.desktop.count}  (${(statSync(out).size / 1024).toFixed(0)}KB)`);
}
