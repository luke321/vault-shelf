// github#50 -- one place decides how a harness launches Chrome, and whether it takes the keyboard

import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const named = (() => { const i = argv.indexOf("--chrome"); return i >= 0 ? argv[i + 1] || "" : ""; })();

/* github#50 -- HEADLESS IS THE DEFAULT, and this is the only switch that changes it. A window
 * Chrome has just created activates itself, and Windows allows it because the harness was
 * spawned by whatever held the foreground -- the terminal. So every headed launch is one theft
 * of the keyboard from the person typing, and nothing in the process can give it back without
 * a visible flicker and a race. Not creating the window is the only fix that prevents rather
 * than undoes. `--headed` is for watching a run; it is a debugging aid, and smoke.mjs refuses
 * to stamp a tree measured that way (see SHAPE there). */
export const HEADED = argv.includes("--headed");

/* The flags every harness here passes, and the reason they are one list: five harnesses carried
 * their own near-identical copy, and github#50 would otherwise have added the mode decision to
 * all five -- five places for the next person to miss one, which is the shape of the bug this
 * fixes. Two of these (client-side-phishing-detection, domain-reliability) were only in
 * smoke.mjs's copy; both suppress chatter and can only help the others. */
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
 * Chrome's own path. Six files carried this function byte for byte; `--chrome <path>` still
 * overrides, read from this process's own argv rather than each caller's parser.
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
 * The argument list for a harness Chrome. `window` is the caller's placement (design/0006 --
 * still the left screen when headed); a headless Chrome ignores the position and honours the
 * size, which is the half the layout depends on. `--app=` produces a page target in both modes
 * -- measured against Chrome/152, not assumed.
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
