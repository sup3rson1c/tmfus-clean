/*
  Convert the Higgsfield PNG masters in media/ into responsive WebP files in
  assets/img/ (name-<width>.webp). Masters are 3.5–4.9 MB; the site never
  loads them directly. Usage: node tools/images.mjs
*/
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "media");
const OUT = join(ROOT, "assets", "img");
mkdirSync(OUT, { recursive: true });

// Wide banners are shown edge to edge, so they get larger renditions.
const WIDE = new Set(["a7-security", "a9-cta-horizon"]);
const widthsFor = (name) => (WIDE.has(name) ? [1080, 1600, 2400] : [480, 960, 1440]);

// Batch 1 renders (a1–a9)
for (const file of readdirSync(SRC).filter((f) => /^a\d.*\.png$/.test(f))) {
  const name = basename(file, ".png");
  const { width } = await sharp(join(SRC, file)).metadata();
  for (const w of widthsFor(name)) {
    if (w > width) continue;
    const info = await sharp(join(SRC, file))
      .resize({ width: w })
      .webp({ quality: 80, effort: 5 })
      .toFile(join(OUT, `${name}-${w}.webp`));
    console.log(`${name}-${w}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
}

/* Motion upgrade planes (docs/motion-phase2-direction.md §6–7).
   The disc cutout is cropped out of the 2048px A1 frame; the crop box is
   mirrored in CSS (src/css/09-motion.css, "frame" geometry), so keep them in sync. */
const PLANES = [
  { src: "m2-hero-wide-plate", out: "m2-hero-plate", widths: [1280, 1920, 2688] },
  { src: "m4b-hero-portrait-plate", out: "m4b-hero-plate", widths: [768, 1152, 1520] },
  { src: "m3-disc-bg-removed", out: "m3-disc", widths: [720, 1080, 1344], alpha: true, crop: { left: 340, top: 610, width: 1344, height: 890 } },
  { src: "m5-stone-slab", out: "m5-slab", widths: [1440, 2160, 2688], alpha: true },
  { src: "m6-dial-plate", out: "m6-dial-plate", widths: [720, 1080, 1440], alpha: true },
];

for (const plane of PLANES) {
  for (const w of plane.widths) {
    let img = sharp(join(SRC, `${plane.src}.png`));
    if (plane.crop) img = img.extract(plane.crop);
    const info = await img
      .resize({ width: w })
      .webp(plane.alpha ? { quality: 84, alphaQuality: 90, effort: 5 } : { quality: 80, effort: 5 })
      .toFile(join(OUT, `${plane.out}-${w}.webp`));
    console.log(`${plane.out}-${w}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
}

/* The hero sheen's CSS mask (issue #4). A mask only reads alpha, and a CSS
   mask is fetched in CORS mode, so pointing it at m3-disc-720.webp downloaded
   that 104 KB colour image a second time next to the <img>. This keeps the
   alpha channel bit for bit, paints the colour white and stores it lossless:
   the same mask for about 10 KB. */
{
  const { data, info } = await sharp(join(OUT, "m3-disc-720.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
  const mask = await sharp(data, { raw: info }).webp({ lossless: true, effort: 6 }).toFile(join(OUT, "m3-disc-mask-720.webp"));
  console.log(`m3-disc-mask-720.webp  ${mask.width}x${mask.height}  ${Math.round(mask.size / 1024)} KB`);
}
