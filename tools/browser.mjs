/*
  Shared headless-Chrome launcher.

  The shared puppeteer install at %TEMP%/puppeteer-test lost its package.json,
  so this project uses a local puppeteer-core and points it at the Chrome that
  is already in the puppeteer browser cache. No Chromium download.
*/
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const CACHE = join(homedir(), ".cache", "puppeteer");

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const installed = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["ProgramFiles(x86)"] && join(process.env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  const systemBrowser = installed.find((path) => existsSync(path));
  if (systemBrowser) return systemBrowser;
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
  throw new Error(`No installed or cached Chrome found (checked ${CACHE}). Set CHROME_PATH.`);
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
