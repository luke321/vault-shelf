// design/0006 -- harness windows go on the leftmost screen
import { spawnSync } from "node:child_process";
import { acquire } from "./lock.mjs";

/** @type {{ x: number, y: number, w: number, h: number } | null} */
let cached = null;

// github#37, decisions/0012 -- the display this repo's harnesses take over
const LEFT_SCREEN_LOCK = "screen-left";

/** @type {{ name: string, release: () => void } | null} */
let held = null;
let handlersOn = false;

/** @param {string} what */
function mustHold(what) {
  if (held) return;
  throw new Error(
    "screen: " + what + " was asked for the left screen without claiming it. Call\n" +
    "  const screen = await takeLeftScreen(\"<who you are>\")\n" +
    "first and place the window from screen.args -- github#37, decisions/0012.");
}

// github#37 -- the claim and the position come from one call
/** @typedef {{ name: string, args: string[], release: () => void }} Claim */

// github#25 -- a harness that loses the display says so and stops
/** @param {string} who */
function lostLeftScreen(who) {
  console.error("\nscreen: the left screen was taken by " + who + " while this run was using " +
                "it.\nEverything from here on would share the display, so this run stops. " +
                "github#25.");
  process.exit(1);
}

/**
 * @param {string} owner
 * @param {{ w?: number, h?: number, timeoutMs?: number, onLost?: (who: string) => void }} [opts]
 * @returns {Promise<Claim>}
 */
export async function takeLeftScreen(owner, opts = {}) {
  const w = opts.w === undefined ? 1600 : opts.w;
  const h = opts.h === undefined ? 1000 : opts.h;
  if (!held) {
    try {
      const lock = await acquire(LEFT_SCREEN_LOCK, {
        owner: owner, timeoutMs: opts.timeoutMs,
        // github#25 -- drop the hold before anyone releases it
        onLost: (who) => { held = null; (opts.onLost || lostLeftScreen)(who); }
      });
      held = lock;
    } catch (e) {
      if (e.code !== "BUSY") throw e;
      console.error("\n" + e.message + "\n\n" +
                    "screen: another harness or a sister-repo recording has the left screen.\n" +
                    "See who holds it with: node scripts/lock.mjs status");
      process.exit(1);
    }
    if (!handlersOn) {
      handlersOn = true;
      process.on("exit", dropLeftScreen);
      for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
        process.on(sig, () => { dropLeftScreen(); process.exit(1); });
      }
    }
  }
  return { name: LEFT_SCREEN_LOCK, args: leftWindowArgs(w, h), release: dropLeftScreen };
}

export function dropLeftScreen() {
  if (!held) return;
  const lock = held;
  held = null;
  lock.release();
}

/** @returns {{ x: number, y: number, w: number, h: number }} */
export function leftmostScreen() {
  if (cached) return cached;
  const fallback = { x: -2400, y: 0, w: 1920, h: 1080 };
  if (process.platform !== "win32") return (cached = fallback);
  const ps = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "Add-Type -AssemblyName System.Windows.Forms; " +
    "[System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.WorkingArea.Left } | Select-Object -First 1 | " +
    "ForEach-Object { '{0} {1} {2} {3}' -f $_.WorkingArea.Left, $_.WorkingArea.Top, " +
    "$_.WorkingArea.Width, $_.WorkingArea.Height }"], { encoding: "utf8" });
  const m = /(-?\d+) (-?\d+) (\d+) (\d+)/.exec((ps.stdout || "").trim());
  cached = m ? { x: +m[1], y: +m[2], w: +m[3], h: +m[4] } : fallback;
  return cached;
}

/** @param {number} [w] @param {number} [h] @returns {{ x: number, y: number, w: number, h: number }} */
export function leftWindow(w = 1600, h = 1000) {
  mustHold("leftWindow");
  const s = leftmostScreen();
  const ww = Math.min(w, s.w), hh = Math.min(h, s.h);
  return { x: s.x + Math.max(0, Math.round((s.w - ww) / 2)),
           y: s.y + Math.max(0, Math.round((s.h - hh) / 2)), w: ww, h: hh };
}

/** @param {number} [w] @param {number} [h] @returns {string[]} */
export function leftWindowArgs(w = 1600, h = 1000) {
  mustHold("leftWindowArgs");
  const b = leftWindow(w, h);
  return ["--window-position=" + b.x + "," + b.y, "--window-size=" + b.w + "," + b.h];
}

/** @param {number} [w] @param {number} [h] @returns {string} */
export function leftWindowPos(w = 1600, h = 1000) {
  mustHold("leftWindowPos");
  const b = leftWindow(w, h);
  return "--window-position=" + b.x + "," + b.y;
}

// design/0006 -- Electron ignores moveTo for its own main window
/** @param {(expr: string) => Promise<unknown>} evalIn @param {number} [w] @param {number} [h] */
export function placeElectronLeft(evalIn, w = 1600, h = 1000) {
  mustHold("placeElectronLeft");
  const b = leftWindow(w, h);
  return evalIn(
    "(function(){ try { var e = window.require && window.require('electron');" +
    " var r = e && (e.remote || window.require('@electron/remote'));" +
    " if (r && r.getCurrentWindow) { r.getCurrentWindow().setBounds({ x: " + b.x + ", y: " + b.y +
    ", width: " + b.w + ", height: " + b.h + " }); return 'setBounds'; } } catch (err) { }" +
    " try { window.moveTo(" + b.x + ", " + b.y + "); window.resizeTo(" + b.w + ", " + b.h +
    "); } catch (err) { } return 'moveTo'; })()");
}
