/*
  Higgsfield + Seedance 2.5 text-to-video, the minimal example.

  Usage:
    node tools/higgsfield-seedance.mjs

  Needs HF_CREDENTIALS ("key-id:key-secret") in .env.local at the repo root.
  .env.local is git-ignored (this repo is PUBLIC). The value is read at
  runtime and never printed. Every run is a billable generation.

  tools/ is not deployed (.cpanel.yml copies files one by one), so this
  never reaches tmfus.com.
*/
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { config, higgsfield, HiggsfieldError, NotEnoughCreditsError } from "@higgsfield/client/v2";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(ROOT, ".env.local"), quiet: true });

if (!process.env.HF_CREDENTIALS || !process.env.HF_CREDENTIALS.includes(":")) {
  console.error("HF_CREDENTIALS is missing from .env.local (format key-id:key-secret).");
  process.exit(2);
}
config({ credentials: process.env.HF_CREDENTIALS });

const MODEL = "bytedance/seedance-2.5/text-to-video";
const input = {
  prompt: "A cinematic scene at sunset",
  duration: 5,
  resolution: "720p",
  aspect_ratio: "16:9",
};

try {
  console.log(`Submitting to ${MODEL} and waiting for it to finish...`);
  const result = await higgsfield.subscribe(MODEL, { input, withPolling: true });

  if (result.status === "completed" && result.video?.url) {
    console.log(`Completed. Request ${result.request_id}`);
    console.log(`Video URL: ${result.video.url}`);
  } else {
    // failed, nsfw (moderated), canceled, or completed without a video
    console.error(`Not successful: status "${result.status}", request ${result.request_id}. No video was produced.`);
    process.exit(1);
  }
} catch (err) {
  if (err instanceof NotEnoughCreditsError) console.error("Higgsfield says the account does not have enough credits.");
  else if (err instanceof HiggsfieldError) console.error(`Higgsfield error (${err.name}): ${err.message}`);
  else console.error(`Unexpected error: ${err?.message ?? err}`);
  process.exit(1);
}
