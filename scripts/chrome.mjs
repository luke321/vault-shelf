// github#50 -- how a harness launches Chrome

import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const named = (() => { const i = argv.indexOf("--chrome"); return i >= 0 ? argv[i + 1] || "" : ""; })();

/* github#50, design/0006 -- headless by default; --headed is the only switch */
export const HEADED = argv.includes("--headed");

/* github#50 -- one list; five harnesses each had a copy */
const QUIET = [
  "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--disable-component-update", "--disable-client-side-phishing-detection",
  "--disable-sync", "--no-service-autorun", "--disable-domain-reliability",
  "--metrics-recording-only", "--no-pings", "--mute-audio",
  "--disable-breakpad", "--disable-crash-reporter",
  "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
];

/**
 * github#50 -- six files carried this byte for byte
 * @returns {string}
 */
export function findChrome() {
  if (named) return named;
  const guesses = [
    process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
  ];
  for (const g of guesses) if (g && existsSync(g)) return g;
  throw new Error("Chrome not found; pass --chrome <path>");
}

/**
 * design/0006 -- `window` is the caller's placement
 * @param {{ port: number, profile: string, url: string, window?: string[] }} o
 * @returns {string[]}
 */
export function harnessChromeArgs({ port, profile, url, window = [] }) {
  return [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    ...QUIET,
    ...(HEADED ? [] : ["--headless=new"]),
    ...window,
    `--app=${url}`,
  ];
}
