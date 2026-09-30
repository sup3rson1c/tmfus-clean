/*
  Shared headless-Chrome launcher.

  The shared puppeteer install at %TEMP%/puppeteer-test lost its package.json,
  so this project uses a local puppeteer-core and points it at the Chrome that
  is already in the puppeteer browser cache. No Chromium download.
*/
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const CACHE = "C:/Users/Eli/.cache/puppeteer";

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    ["chrome", "chrome-win64", "chrome.exe"],
    ["chrome-headless-shell", "chrome-headless-shell-win64", "chrome-headless-shell.exe"],
  ];
  for (const [channel, dir, exe] of candidates) {
    const base = join(CACHE, channel);
    if (!existsSync(base)) continue;
    // Newest build wins when several versions are cached.
    const builds = readdirSync(base).sort().reverse();
    for (const b of builds) {
      const p = join(base, b, dir, exe);
      if (existsSync(p)) return p;
    }
  }
  throw new Error(`No cached Chrome found under ${CACHE}. Set CHROME_PATH.`);
}

export async function launch(extraArgs = []) {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--force-color-profile=srgb",
      "--hide-scrollbars",
      ...extraArgs,
    ],
  });
}
