/*
  AVIF twins for the site's WebP images (issue #23, page weight).

  For every WebP the pages show, writes an .avif next to it at the LOWEST
  quality that still decodes to within 42 dB PSNR of the WebP, measured on the
  pixels a visitor sees (composited over the site's near-black ground, so the
  colour hidden under transparent pixels does not count). 42 dB is well past
  the point where a difference can be seen; the pages then offer the AVIF in a
  <picture> with the WebP as the fallback.

  An AVIF that does not save at least 12% over its WebP is not written, and an
  existing one is deleted, so a <source> is only worth adding where a file
  exists. Only images referenced from src/ are converted: the film board
  stills and poster are in; the 870 scroll-film frames are not (film.js
  decodes them on the fly and AVIF decodes slower); the CSS mask, lossless on
  purpose and referenced from CSS, is left alone.

  Usage: node tools/avif.mjs
*/
import sharp from "sharp";
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DB = 42;
const MIN_SAVING = 0.12;
const QUALITIES = [40, 45, 50, 55, 60, 65, 70, 75, 80];
const GROUND = { r: 10, g: 12, b: 11 };

// Only the images a page actually references (src/ is the source of truth).
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []
  );
const files = [
  ...new Set(
    walk(join(ROOT, "src")).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/\/(?:assets\/img|media\/film)\/[\w.-]+\.webp/g)].map((m) => m[0])
    )
  ),
]
  .sort()
  .map((url) => join(ROOT, url.slice(1)));

const visible = async (input) =>
  sharp(input).flatten({ background: GROUND }).removeAlpha().raw().toBuffer();

function psnr(a, b) {
  let se = 0;
  for (let i = 0; i < a.length; i++) {
    const e = a[i] - b[i];
    se += e * e;
  }
  return se === 0 ? Infinity : 10 * Math.log10((255 * 255) / (se / a.length));
}

let before = 0;
let after = 0;
for (const file of files) {
  const out = file.replace(/\.webp$/, ".avif");
  const size = statSync(file).size;
  const ref = await visible(file);
  const { hasAlpha } = await sharp(file).metadata();
  let pick = null;
  for (const quality of QUALITIES) {
    const buf = await sharp(file).avif({ quality, effort: 7, chromaSubsampling: "4:4:4" }).toBuffer();
    const db = psnr(ref, await visible(buf));
    if (db >= TARGET_DB) {
      pick = { quality, buf, db };
      break;
    }
  }
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
  before += size;
  if (!pick || pick.buf.length > size * (1 - MIN_SAVING)) {
    if (existsSync(out)) unlinkSync(out);
    after += size;
    console.log(`skip ${rel}  ${(size / 1024).toFixed(0)} KB (no AVIF saves ${MIN_SAVING * 100}% at ${TARGET_DB} dB)`);
    continue;
  }
  writeFileSync(out, pick.buf);
  after += pick.buf.length;
  console.log(
    `${rel.padEnd(42)} ${(size / 1024).toFixed(0).padStart(4)} KB -> ${(pick.buf.length / 1024).toFixed(0).padStart(4)} KB` +
      `  q${pick.quality}${hasAlpha ? " alpha" : ""}  ${pick.db.toFixed(1)} dB`
  );
}
console.log(`\nall images ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
