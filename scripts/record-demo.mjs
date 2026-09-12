#!/usr/bin/env node
// design/0007

import { attach } from "./cdp.mjs";
import { currentFixture } from "./fixture-store.mjs";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ONLY = (arg("act", "") || "").toLowerCase().split(",").map((v) => v.trim()).filter(Boolean);
const FPS = Number(arg("fps", "24"));
const W = Number(arg("width", "1440"));
const H = Number(arg("height", "900"));
const OUT = resolve(arg("out", join(ROOT, "demo-vault-shelf.mp4")));
const HERO = arg("hero", "");
/* github#21 -- the hero is an excerpt, named by act; design/0007. */
const HERO_ACTS = (arg("hero-acts", "open,favourite,ribbon,parting,room"))
  .toLowerCase().split(",").map((v) => v.trim()).filter(Boolean);
const HERO_CLIP = arg("hero-clip", "") ? arg("hero-clip", "").split(",").map(Number) : null;
/* github#21 -- leather unless asked; a fresh library opens in it. */
const LOOK = arg("look", "leather");
/* github#21 -- the hero's budget: fps first, then width, then quality. */
const HERO_FPS = Number(arg("hero-fps", "6"));
const HERO_W = Number(arg("hero-width", "780"));
const HERO_Q = Number(arg("hero-q", "38"));
const KEEP = argv.includes("--keep-frames");
const QUIET = argv.includes("--quiet");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => { if (!QUIET) console.log(m); };

/* ------------------------------------------------------------------ tools -- */

function findChrome() {
  const named = arg("chrome", "");
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

function findFfmpeg() {
  const named = arg("ffmpeg", "");
  if (named) return named;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"],
                          { encoding: "utf8" });
  const first = (which.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
  if (first && existsSync(first)) return first;
  const winget = process.env.LOCALAPPDATA &&
    join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "ffmpeg.exe");
  if (winget && existsSync(winget)) return winget;
  throw new Error("ffmpeg not found. Install it with:  winget install Gyan.FFmpeg");
}

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
    s.on("error", rej);
  });
}

function fixtureStore() {
  const g = spawnSync("git", ["-C", ROOT, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
  const common = g.status === 0 ? g.stdout.trim() : "";
  const abs = common ? (/^[A-Za-z]:[\\/]|^\//.test(common) ? common : join(ROOT, common)) : join(ROOT, ".git");
  return join(dirname(abs), ".fixtures");
}

/* decisions/0014 -- the film is shot in the vault the checks run on; design/0013's mirror is
 * `--mirror-of <path>` now, on purpose, because a default nobody typed is the one that
 * drifts. Never read from a commit: check-pii refuses a vault path in a tracked file. */
function mirrorSource() {
  const explicit = arg("mirror-of", "");
  return explicit ? resolve(explicit) : "";
}

function sourceVault() {
  const explicit = arg("vault", "");
  if (explicit) return resolve(explicit);

  const source = mirrorSource();
  if (source) {
    if (!existsSync(source)) throw new Error("mirror source does not exist: " + source);
    const out = join(ROOT, "mirror-vault");
    say("mirroring a real vault (its shape only) -> " + out);
    const made = spawnSync(process.execPath,
      [join(ROOT, "scripts", "make-mirror-vault.mjs"), "--vault", source, "--out", out],
      { encoding: "utf8" });
    process.stdout.write(made.stdout || "");
    if (made.status !== 0) {
      // A failed mirror does NOT fall through to the fixture: the reason it failed is the
      // reason it exists, and a silent downgrade would hide it behind a film that still works.
      throw new Error("make-mirror-vault failed:\n" + (made.stderr || made.stdout));
    }
    return out;
  }

  const store = fixtureStore();
  const hit = existsSync(store) ? (basename(currentFixture(ROOT, "vault")) || undefined) : null;
  if (!hit) {
    throw new Error("no vault-* fixture in " + store +
      ' -- run `node scripts/smoke.mjs --only "no console errors"` once to generate the store');
  }
  say("shooting in the fixture the suite measures: " + hit);
  return join(store, hit);
}

/* ------------------------------------------------------------ the easings -- */

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------- the caption layer --
 * design/0007 -- injected by the recorder, never by the page.
 */
const BAR = 128;

const CAPTION_CSS = `
html, body { background: #0b0c0d; }
#vs-app { height: calc(100% - ${BAR}px) !important; }
#vsrec {
  position: fixed; left: 0; right: 0; bottom: 0; height: ${BAR}px; z-index: 99;
  box-sizing: border-box;
  display: flex; flex-direction: column; justify-content: center;
  padding: 0 44px;
  font: 500 27px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.005em;
  color: #f4f2ee;
  background: #0b0c0d;
  border-top: 1px solid #2f3338;
  opacity: 0; pointer-events: none;
}
#vsrec .t { display: block; }
#vsrec b { color: #d8b46a; font-weight: 600; }
#vsrec .sub {
  display: block; margin-top: 9px;
  font-size: 17px; font-weight: 400; color: #a5a29b; letter-spacing: 0.012em;
}
#vsrec.paper {
  color: #2a241e; background: #efe8da; border-top-color: #c3b69b;
}
#vsrec.paper b { color: #7a5c22; }
#vsrec.paper .sub { color: #5c534b; }
/* design/0020 -- A POINTER THE CAMERA CAN SEE. A screenshot has no cursor in it, and an act
 * about a right-click is nothing without one, so the recorder draws its own: an arrow moved
 * to wherever the act says the hand is, and hidden by every act that does not say. */
#vsrec-cursor {
  position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 100;
  pointer-events: none; opacity: 0; transition: opacity 120ms linear;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
}
#vsrec-cursor.press { transform: scale(0.85); transform-origin: 4px 3px; }
/* github#21 -- the book in the hand: Chrome draws no drag image. */
#vsrec-ghost {
  position: fixed !important; z-index: 98; pointer-events: none; opacity: 0.9;
  margin: 0 !important; transform: rotate(-3deg); transition: none !important;
  filter: drop-shadow(0 16px 22px rgba(0,0,0,0.55));
}
`;

const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 3 L4 19 L8.6 15.2 L11.4 21.4 L14.2 20.2 L11.4 14.2 L17.6 14.2 Z" ' +
  'fill="#ffffff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';

/* ---------------------------------------------------------- the storyboard --
 * design/0007 -- every act declares how many SECONDS it lasts and is handed a normalised
 * 0..1 through that time, so the video's length is a property of this table and nothing
 * else needs to know the frame rate.
 */
function storyboard(P) {
  const { go, j, caption, scrollTo, settleOn, click, shelfTop, once, pointer, rightClick,
          pressAt, centreOf, lift, carry, drop } = P;
  let parted = "note";   // the search the parting act types, taken from the vault itself
  let turnedAt = -1;     // github#36 -- which beat of the turn act has already turned

  /* design/0020 -- the dailies folder if there is one, else the biggest. */
  const dailiesFolder = () => j(`(function(){
    var byFolder = {};
    __vs.data().notes.forEach(function (n) { byFolder[n.folder] = (byFolder[n.folder] || 0) + 1; });
    var names = Object.keys(byFolder).sort(function (a, b) { return byFolder[b] - byFolder[a]; });
    return names.filter(function (f) { return /daily|dailies|journal/i.test(f); })[0] || names[0] || "";
  })()`);
  const favId = () => j(`(__vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0] || {}).id || ""`);
  /* design/0007 -- typed a letter at a time. */
  const typeInto = (id, word, t, from, to) => {
    const n = Math.max(0, Math.min(word.length, Math.floor(((t - from) / (to - from)) * word.length) + 1));
    return go(`(function(){
      var f = document.getElementById(${JSON.stringify(id)});
      if (!f) return;
      var want = ${JSON.stringify(word)}.slice(0, ${n});
      if (f.value === want) return;
      f.value = want;
      f.dispatchEvent(new Event("input", { bubbles: true }));
    })(); void 0`);
  };

  /* github#21 -- the thickest book in shot, so only the book moves. */
  const thickest = (shelfId) => j(`(function(){
    var v = __vs.views().filter(function (v) { return v.shelf.id === ${JSON.stringify(shelfId)}; })[0];
    if (!v) return null;
    var books = v.books.filter(function (b) { return b.key.charAt(0) !== "-"; });
    books.sort(function (a, b) { return b.notes.length - a.notes.length; });
    return books[0] ? books[0].id : null;
  })()`);
  /* github#21 -- a spine on its own shelf; Reading holds it too. */
  const spineOf = (bookId, shelfId) =>
    (shelfId ? `[data-shelf="${shelfId}"] ` : "#vs-shelves ") +
    `.vs-spine[data-book="${bookId.replace(/"/g, '\\"')}"]`;
  const noteCount = () => j(`__vs.counts().notes`);
  /* github#21 -- a hand's curve, not a ruler's. */
  const arc = (a, b, bow, k) => ({
    x: Math.round((1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * bow.x + k * k * b.x),
    y: Math.round((1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * bow.y + k * k * b.y),
  });
  const glide = async (from, to, k) => {
    if (from && to) await pointer({ x: Math.round(lerp(from.x, to.x, k)), y: Math.round(lerp(from.y, to.y, k)) });
  };

  return [
    {
      name: "open",
      seconds: 4.5,
      async at(t, first) {
        if (first) {
          await go(`__vs.setQuery(""); document.getElementById("vs-library").scrollTop = 0; void 0`);
          await pointer(null);
        }
        await caption(t, 0.15, 0.95,
          "Your vault, as a <b>library</b>.",
          `${await noteCount()} notes, on every shelf at once. Nothing was moved.`);
      },
    },
    {
      /* github#21, design/0019 -- a real dragstart, dragover and drop. */
      name: "favourite",
      seconds: 13,
      async at(t, first) {
        if (first) {
          await go(`(function(){
            var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
            if (fav) { fav.picks = []; delete fav.made; }
            __vs.setQuery("");
            __vs.setFilters({ folders: [] });
            document.getElementById("vs-library").scrollTop = 0;
          })(); void 0`);
          await pointer(null);
          P.state.first = await thickest("people");
          P.state.second = await thickest("encyclopedia");
          if (!P.state.first || !P.state.second) throw new Error("favourite: no book to carry");
          P.state.down = await shelfTop("people", -70);
          P.state.settled = false;
        }
        await caption(t, 0.04, 0.95,
          "<b>Favourites</b>: drag any book onto it.",
          "A favourite is a reference, never a copy. The book stays on its own shelf, and " +
          "this one is live.");
        const fav = await favId();
        const landing = () => centreOf(`[data-shelf="${fav}"] .vs-shelfrail .vs-track`);
        /* github#21 -- down to People, and the thickest is lifted. */
        if (t < 0.12) await scrollTo(lerp(0, P.state.down, easeInOut(t / 0.12)));
        if (t >= 0.12 && !P.state.settled) { P.state.down = await settleOn("people"); P.state.settled = true; }
        const a = await centreOf(spineOf(P.state.first, "people"));
        if (t >= 0.06 && t < 0.18 && a) {
          const k = easeInOut((t - 0.06) / 0.12);
          await pointer({ x: Math.round(lerp(a.x + 260, a.x, k)), y: Math.round(lerp(a.y + 160, a.y, k)) });
        }
        await once("lift-1", 0.18, t, async () => {
          const up = await lift(spineOf(P.state.first, "people"));
          if (!up) throw new Error("favourite: dragstart on the People spine lifted nothing");
          P.state.lifted = up;
        });
        /* github#21 -- the room scrolls up under the carried book. */
        if (t >= 0.18 && t < 0.34) {
          const k = easeInOut((t - 0.18) / 0.16);
          await scrollTo(lerp(P.state.down, 0, k));
          const from = P.state.lifted;
          await carry({ x: Math.round(lerp(from.x, from.x - 120, k)), y: Math.round(lerp(from.y, 150, k)) });
        }
        if (t >= 0.34 && t < 0.5) {
          const b = await landing();
          const from = { x: P.state.lifted.x - 120, y: 150 };
          const k = easeInOut((t - 0.34) / 0.16);
          if (b) await carry(arc(from, b, { x: b.x + 220, y: (from.y + b.y) / 2 }, k));
        }
        if (t >= 0.5 && t < 0.55) await carry(await landing());
        await once("drop-1", 0.55, t, async () => {
          const lit = await j(`document.querySelector('[data-shelf="${fav}"] .vs-shelfrail').getAttribute("data-drop")`);
          if (lit !== "1") throw new Error("favourite: the landing never lit under the pointer");
          await drop(await landing());
          const picks = await j(`__vs.picks()[0].picks.length`);
          if (picks !== 1) throw new Error("favourite: the drop onto the landing did not take");
        });
        /* github#21 -- the second lands in the gap before the first. */
        const c = await centreOf(spineOf(P.state.second, "encyclopedia"));
        const firstFav = () => centreOf(spineOf(fav + "/" + P.state.first), -6, 0);
        if (t >= 0.55 && t < 0.68) await glide(await centreOf(spineOf(fav + "/" + P.state.first)), c, easeInOut((t - 0.55) / 0.13));
        await once("lift-2", 0.68, t, async () => {
          const up = await lift(spineOf(P.state.second, "encyclopedia"));
          if (!up) throw new Error("favourite: dragstart on the Encyclopedia spine lifted nothing");
        });
        if (t >= 0.68 && t < 0.87) {
          const d = await firstFav();
          if (c && d) {
            const k = easeInOut(Math.min(1, (t - 0.68) / 0.17));
            await carry(arc(c, d, { x: d.x + 200, y: (c.y + d.y) / 2 }, k));
          }
        }
        if (t >= 0.87 && t < 0.92) { const d = await firstFav(); if (d) await carry(d); }
        await once("drop-2", 0.92, t, async () => {
          const bar = await j(`!!document.querySelector('[data-shelf="${fav}"] .vs-drop[data-side="before"]')`);
          if (!bar) throw new Error("favourite: no insertion mark stood in the gap before the first favourite");
          await drop(await firstFav());
          const seq = await j(`__vs.picks()[0].picks`);
          if (seq.length !== 2 || seq[0] !== P.state.second) {
            throw new Error("favourite: the second drop did not land before the first (" + seq.join(", ") + ")");
          }
        });
        if (t > 0.92) {
          const d = await centreOf(spineOf(fav + "/" + P.state.second));
          if (d) await pointer({ x: d.x + 30 + Math.round((t - 0.92) * 400), y: d.y + 70 + Math.round((t - 0.92) * 300) });
        }
      },
    },
    {
      name: "ribbon",
      seconds: 13,
      async at(t, first) {
        await caption(t, 0.05, 0.94,
          "Open one, and leave a <b>ribbon</b> in it.",
          "One note is in five books, so one ribbon hangs out of all five, and a Reading shelf " +
          "gathers every book that has one. Rename the note or hide a shelf and it re-threads.");
        /* design/0007 -- every act opens what it needs. */
        if (first) {
          if (!P.state.first) P.state.first = await thickest("people");
          await go(`(function(){
            if (!document.getElementById("vs-reader").hidden) __vs.closeReader();
            var fav = __vs.picks()[0];
            if (fav && fav.picks.indexOf(${JSON.stringify(P.state.first)}) < 0) __vs.pick(${JSON.stringify(P.state.first)});
            __vs.setQuery("");
            document.getElementById("vs-library").scrollTop = 0;
          })(); void 0`);
          await pointer(null);
          P.state.other = await thickest("months");
          P.state.otherShelf = "months";
        }
        const fav = await favId();
        const stub = "#vs-marks .vs-markstub";
        const mark = async (name) => {
          const r = await centreOf(stub);
          await pointer(r, true);
          await go(`document.querySelector(${JSON.stringify(stub)}).click(); void 0`);
          await pointer(r, false);
          const on = await j(`!!document.querySelector('#vs-marks .vs-mark[aria-current="true"]')`);
          if (!on) throw new Error("ribbon: " + name + " took no ribbon");
        };
        const back = async () => {
          const b = await centreOf("#vs-back");
          await pointer(b, true);
          await go(`document.getElementById("vs-back").click(); void 0`);
          await pointer(null);
        };
        const open = async (sel, name) => {
          const s = await centreOf(sel);
          await pointer(s, true);
          const hit = await click(s);
          const isOpen = await j(`!document.getElementById("vs-reader").hidden`);
          if (!hit || !isOpen) throw new Error("ribbon: the click on " + name + " opened no book");
          await pointer(s, false);
        };
        /* github#21 -- the favourite first. */
        const favSpine = spineOf(fav + "/" + P.state.first);
        if (t >= 0.02 && t < 0.12) {
          const s = await centreOf(favSpine);
          if (s) await glide({ x: s.x + 360, y: s.y + 160 }, s, easeInOut((t - 0.02) / 0.1));
        }
        await once("open-1", 0.12, t, () => open(favSpine, "the favourite"));
        if (t >= 0.15 && t < 0.27) await glide(await centreOf(favSpine), await centreOf(stub), easeInOut((t - 0.15) / 0.12));
        await once("mark-1", 0.27, t, () => mark("the favourite"));
        if (t >= 0.31 && t < 0.4) await glide(await centreOf(stub), await centreOf("#vs-back"), easeInOut((t - 0.31) / 0.09));
        await once("back-1", 0.4, t, async () => { await back(); P.state.down = await shelfTop("months", -70); });
        /* github#21 -- then a book further down the library. */
        const other = spineOf(P.state.other, "months");
        if (t >= 0.41 && t < 0.47) await scrollTo(lerp(0, P.state.down, easeInOut((t - 0.41) / 0.06)));
        await once("settle-2", 0.47, t, async () => { P.state.down = await settleOn("months"); });
        if (t >= 0.47 && t < 0.52) {
          const s = await centreOf(other);
          if (s) await glide({ x: s.x + 220, y: s.y + 110 }, s, easeInOut((t - 0.47) / 0.05));
        }
        await once("open-2", 0.52, t, () => open(other, "the second book"));
        if (t >= 0.55 && t < 0.67) await glide(await centreOf(other), await centreOf(stub), easeInOut((t - 0.55) / 0.12));
        await once("mark-2", 0.67, t, () => mark("the second book"));
        if (t >= 0.71 && t < 0.8) await glide(await centreOf(stub), await centreOf("#vs-back"), easeInOut((t - 0.71) / 0.09));
        await once("back-2", 0.8, t, async () => {
          await back();
          const hung = await j(`document.querySelectorAll("#vs-shelves .vs-spine .vs-ribbon").length`);
          const reading = await j(`document.querySelectorAll('#vs-shelves [data-shelf="-reading"] .vs-spine').length`);
          if (hung < 4 || reading < 2) throw new Error("ribbon: after two marks, " + hung + " spine(s) show a ribbon and Reading holds " + reading);
        });
        if (t >= 0.8) await scrollTo(lerp(P.state.down, 0, easeInOut(Math.min(1, (t - 0.8) / 0.12))));
      },
    },
    {
      name: "parting",
      seconds: 10,
      async at(t, first) {
        await caption(t, 0.05, 0.92,
          "Ask it a question, and the shelf <b>parts</b>.",
          "Nothing is removed. Matches draw forward, the rest thin to ghosts, and clearing " +
          "the box puts the room back exactly.");
        if (first) {
          await go(`__vs.setQuery(""); void 0`);
          await scrollTo(await shelfTop("encyclopedia", -20));
          await pointer(null);
          /* github#21 -- the needle is the vault's most-named person. */
          parted = await j(`(function(){
            var count = {};
            __vs.data().notes.forEach(function (n) {
              (n.people || []).forEach(function (p) { count[p] = (count[p] || 0) + 1; });
            });
            var best = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
            return best ? best.split(/\\s+/)[0] : "note";
          })()`);
        }
        const box = () => centreOf("#vs-q", -40, 0);
        if (t >= 0.02 && t < 0.12) {
          const b = await box();
          if (b) await glide({ x: b.x - 200, y: b.y + 300 }, b, easeInOut((t - 0.02) / 0.1));
        }
        await once("focus", 0.12, t, async () => {
          await pointer(await box(), true);
          await go(`document.getElementById("vs-q").focus(); void 0`);
          await pointer(await box(), false);
        });
        /* Typed a letter at a time, because the whole point is what happens WHILE you type. */
        if (t >= 0.14 && t < 0.5) await typeInto("vs-q", parted, t, 0.14, 0.46);
        if (t >= 0.5 && t < 0.8) {
          const b = await box();
          if (b) await glide(b, { x: b.x - 80, y: b.y + 420 }, easeInOut((t - 0.5) / 0.3));
        }
        if (t >= 0.8 && t < 0.88) {
          const b = await box();
          if (b) await glide({ x: b.x - 80, y: b.y + 420 }, b, easeInOut((t - 0.8) / 0.08));
        }
        await once("clear", 0.88, t, async () => {
          await pointer(await box(), true);
          await go(`(function(){
            var f = document.getElementById("vs-q");
            f.value = ""; f.dispatchEvent(new Event("input", { bubbles: true })); f.blur();
          })(); void 0`);
          await pointer(await box(), false);
        });
      },
    },
    {
      /* github#21 -- the hero ends where it began. */
      name: "room",
      seconds: 4,
      async at(t, first) {
        if (first) {
          await go(`__vs.setQuery(""); document.getElementById("vs-library").scrollTop = 0; void 0`);
          await pointer(null);
        }
        const picks = await j(`(__vs.picks()[0] || { picks: [] }).picks.length`);
        const ribbons = await j(`document.querySelectorAll("#vs-shelves .vs-spine .vs-ribbon").length`);
        const marked = await j(`document.querySelectorAll('#vs-shelves [data-shelf="-reading"] .vs-spine').length`);
        await caption(t, 0.08, 0.9,
          "The notes never moved.",
          `${picks} favourite${picks === 1 ? "" : "s"}, ${marked} ribbon${marked === 1 ? "" : "s"} ` +
          `showing in ${ribbons} books, and ${await noteCount()} notes exactly where they were.`);
      },
    },
    {
      name: "shelves",
      seconds: 9,
      async at(t, first) {
        if (first) await go(`__vs.setQuery(""); void 0`);
        const names = await j(`__vs.views().filter(function (v) { return !v.shelf.hidden && v.shelf.classifier !== "pick"; })
          .map(function (v) { return v.shelf.name; })`);
        const word = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][names.length] || String(names.length);
        await caption(t, 0.05, 0.9,
          `<b>${word} shelves</b>, and every one of them is the whole vault.`,
          names.join(" &middot; "));
        const from = await shelfTop("encyclopedia");
        const to = await shelfTop("tags");
        await scrollTo(lerp(from, to, easeInOut(t)));
      },
    },
    {
      /* design/0019 -- a plaque names the run under it, and opens it as one book. */
      name: "plaques",
      seconds: 9,
      async at(t, first) {
        await caption(t, 0.06, 0.92,
          "Months group under <b>year plaques</b>.",
          "A plaque names the run under it on every row the run reaches &mdash; and opens the " +
          "whole run as one book.");
        if (first) {
          await go(`(function(){ if (!document.getElementById("vs-reader").hidden) __vs.closeReader(); })(); void 0`);
          await settleOn("months");
          await pointer(null);
        }
        const plaque = '[data-shelf="months"] .vs-plaque';
        /* github#21 -- the widest plate names the longest run. */
        const nth = await j(`(function(){
          var all = document.querySelectorAll(${JSON.stringify(plaque)}), best = 0, w = 0;
          for (var i = 0; i < all.length; i++) { var b = all[i].getBoundingClientRect().width; if (b > w) { w = b; best = i; } }
          return best;
        })()`);
        if (t >= 0.3 && t < 0.5) {
          const p = await centreOf(plaque, 0, 0, nth);
          if (p) await glide({ x: p.x + 300, y: p.y + 240 }, p, easeInOut((t - 0.3) / 0.2));
        }
        await once("plaque-open", 0.5, t, async () => {
          const p = await centreOf(plaque, 0, 0, nth);
          if (!p) throw new Error("plaques: the Months shelf shows no plaque");
          await pointer(p, true);
          await go(`document.querySelectorAll(${JSON.stringify(plaque)})[${nth}].click(); void 0`);
          const open = await j(`!document.getElementById("vs-reader").hidden`);
          if (!open) throw new Error("plaques: the plaque opened no book");
          await pointer(null);
        });
        await once("plaque-back", 0.9, t, () => go(`document.getElementById("vs-back").click(); void 0`));
      },
    },
    {
      name: "peek",
      seconds: 5,
      async at(t, first) {
        await caption(t, 0.08, 0.9,
          "A spine is a book: its title, its size, where its notes came from.",
          "The band at the head is the folder mix. The number at the foot is the count.");
        if (first) {
          await go(`(function(){ if (!document.getElementById("vs-reader").hidden) __vs.closeReader(); })(); void 0`);
          await settleOn("months");
          await pointer(null);
        }
        const spine = await centreOf(spineOf(await thickest("months"), "months"));
        if (t > 0.2) await pointer(spine);
      },
    },
    {
      name: "read",
      seconds: 8,
      async at(t, first) {
        if (first) {
          await settleOn("months");
          const spine = await centreOf(spineOf(await thickest("months"), "months"));
          await pointer(spine, true);
          const hit = await click(spine);
          const open = await j(`!document.getElementById("vs-reader").hidden`);
          if (!hit || !open) {
            throw new Error("read: the click " + (hit ? "hit a spine but no reader opened" :
              "found no spine at " + JSON.stringify(spine)) +
              " -- every act after this one films a shelf and talks about a book");
          }
          await pointer(null);
        }
        await caption(t, 0.1, 0.88,
          "Open it and <b>read</b>, from its oldest note.",
          "Contents on the left, the note on the right, an index down the edge.");
      },
    },
    {
      /* github#36, design/0025 -- the turn is under the book, so the camera looks there. */
      name: "turn",
      seconds: 7,
      async at(t, first) {
        await caption(t, 0.06, 0.9,
          "Turning the page is <b>under the book</b>.",
          "Previous and Next sit where your hands already are, the count says where you " +
          "are, and the glyph on each is the arrow key that does the same thing.");
        if (first) {
          /* github#36 -- the act opens its own book, so --act turn stands alone */
          if (await j(`document.getElementById("vs-reader").hidden`)) {
            const book = await thickest("months");
            await go(`__vs.openBook(${JSON.stringify(book)}, null); void 0`);
          }
          await pointer(await centreOf("#vs-nextnote"));
          return;
        }
        /* github#36 -- five turns, spaced so the count stays readable */
        const step = Math.floor(t * 5);
        if (step === turnedAt) return;
        turnedAt = step;
        /* github#54 -- a real press, or the act films a control that closes */
        const next = await centreOf("#vs-nextnote");
        await pressAt(next);
      },
    },
    {
      /* design/0015 -- a tab is a position in the contents. */
      name: "index",
      seconds: 6,
      async at(t, first) {
        await caption(t, 0.08, 0.9,
          "The index is the book's own shape.",
          "Dates for a month or a year, letters for an Encyclopedia volume &mdash; and the " +
          "book turns to where the tab points.");
        if (first) return;
        const step = Math.min(3, Math.floor(t * 4));
        await go(`(function(){
          var tabs = document.querySelectorAll("#vs-tabs button");
          if (tabs[${step}]) tabs[${step}].click();
        })(); void 0`);
      },
    },
    {
      name: "alsoin",
      seconds: 7.5,
      async at(t, first) {
        await caption(t, 0.06, 0.9,
          "<b>One note, every shelf.</b>",
          "It is in a year, a month, a person's volume and a tag's anthology at once. Step " +
          "sideways into any of them without leaving the note.");
        await once("sideways", 0.36, t, () => go(`(function(){
          var links = document.querySelectorAll("#vs-alsoin button");
          if (links[1]) links[1].click(); else if (links[0]) links[0].click();
        })(); void 0`));
      },
    },
    {
      name: "wear",
      seconds: 8,
      async at(t, first) {
        await caption(t, 0.05, 0.92,
          "And the room remembers your hands.",
          "A book you keep opening looks handled: the boards darken, the corners soften, " +
          "and it never sits quite flush again.");
        if (first) {
          await go(`(function(){ __vs.setQuery(""); if (!document.getElementById("vs-reader").hidden) __vs.closeReader(); })(); void 0`);
          await settleOn("years", -20);
          await pointer(null);
        }
        /* Thirteen opens is wear level 3 of 3, and they are spread across the act so the
         * spine is seen changing rather than found already changed. */
        if (t > 0.18 && t < 0.72) {
          await go(`(function(){
            var y = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0];
            var b = y.books[0];
            __vs.openBook(b.id, null);
            __vs.closeReader();
          })(); void 0`);
        }
      },
    },
    {
      name: "build",
      seconds: 11,
      async at(t, first) {
        await caption(t, 0.04, 0.92,
          "Build your own from <b>two questions</b>.",
          "Which notes belong here, and what makes a book. The preview is the real thing, " +
          "not an estimate.");
        if (first) await go(`document.getElementById("vs-newshelf").click(); void 0`);
        await once("person", 0.3, t, () => go(`(function(){
          var s = document.getElementById("vs-bclassifier");
          s.value = "person";
          s.dispatchEvent(new Event("change", { bubbles: true }));
        })(); void 0`));
        await once("property", 0.6, t, () => go(`(function(){
          var s = document.getElementById("vs-bclassifier");
          s.value = "property";
          s.dispatchEvent(new Event("change", { bubbles: true }));
        })(); void 0`));
        await once("cancel", 0.9, t, () => go(`document.getElementById("vs-bcancel").click(); void 0`));
      },
    },
    {
      /* design/0020 -- right-click the empty space, name it, say what it holds. */
      name: "makebook",
      seconds: 12,
      async at(t, first) {
        await caption(t, 0.04, 0.94,
          "Or <b>make</b> a book here.",
          "Right-click the empty space on Favourites: a name, and what it holds. " +
          "Nothing in the vault moves &mdash; the book follows it.");
        if (first) {
          await go(`(function(){
            var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
            if (!fav) return;
            fav.picks = [];
            delete fav.made;
            __vs.setQuery("");
            __vs.setFilters({ folders: [] });
            /* Beside a favourite from Years and one from People, as the issue pictured it. */
            var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0];
            var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
            var dated = years ? years.books.filter(function (b) { return b.key !== "-undated"; }) : [];
            if (dated.length) __vs.pick(dated[dated.length - 1].id);
            if (people && people.books.length) __vs.pick(people.books[0].id);
            document.getElementById("vs-library").scrollTop = 0;
          })(); void 0`);
          await pointer(null);
        }
        const fav = await favId();
        const rail = `[data-shelf="${fav}"] .vs-shelfrail .vs-track`;
        const last = await j(`(function(){
          var spines = document.querySelectorAll(${JSON.stringify(rail)} + " .vs-spine");
          var s = spines[spines.length - 1];
          var t = document.querySelector(${JSON.stringify(rail)});
          if (!t) return null;
          var tb = t.getBoundingClientRect();
          var right = s ? s.getBoundingClientRect().right : tb.left;
          return { x: Math.round(right + 120), y: Math.round(tb.top + 60) };
        })()`);
        if (!last) return;
        if (t >= 0.08 && t < 0.3) {
          const k = easeInOut((t - 0.08) / 0.22);
          await pointer({ x: Math.round(lerp(last.x + 380, last.x, k)), y: Math.round(lerp(last.y + 260, last.y, k)) });
        }
        await once("make-rightclick", 0.3, t, async () => {
          const up = await rightClick(last);
          if (!up) throw new Error("makebook: the right-click on the rail opened no menu");
        });
        if (t >= 0.36 && t < 0.46) {
          const line = await centreOf("#vs-railmenu button");
          if (line) await pointer(line);
        }
        await once("make-line", 0.46, t, () => go(`(function(){
          var b = document.querySelector("#vs-railmenu button");
          if (b) b.click();
        })(); void 0`));
        if (t >= 0.5 && t < 0.72) {
          const box = await centreOf("#vs-mbname", 60, 0);
          if (box) await pointer(box);
          await typeInto("vs-mbname", "Dailies", t, 0.52, 0.7);
        }
        await once("make-folder", 0.74, t, async () => {
          const folder = await dailiesFolder();
          await go(`(function(){
            var kind = document.getElementById("vs-mbsource");
            kind.value = "folder";
            kind.dispatchEvent(new Event("change", { bubbles: true }));
            var val = document.getElementById("vs-mbsourceval");
            val.value = ${JSON.stringify(folder)};
            val.dispatchEvent(new Event("change", { bubbles: true }));
          })(); void 0`);
        });
        if (t >= 0.76 && t < 0.88) {
          const save = await centreOf("#vs-mbsave");
          if (save) await pointer(save);
        }
        await once("make-save", 0.88, t, async () => {
          await pointer(await centreOf("#vs-mbsave"), true);
          await go(`document.getElementById("vs-mbsave").click(); void 0`);
          const made = await j(`Object.keys(__vs.made(${JSON.stringify(fav)})).length`);
          if (!made) throw new Error("makebook: Save made no book");
        });
        if (t > 0.9) {
          const spine = await centreOf(`[data-shelf="${fav}"] .vs-spine[data-book$="-made-dailies"]`);
          if (spine) await pointer({ x: spine.x + 40, y: spine.y + 90 });
        }
      },
    },
    {
      /* design/0020 -- edited, then deleted, from its own menu. */
      name: "editbook",
      seconds: 10,
      async at(t, first) {
        await caption(t, 0.04, 0.94,
          "Edit it, or delete it, from its own menu.",
          "A rename keeps the address, so a ribbon left in it stays in it. Deleting loses a " +
          "name and a rule &mdash; never a note.");
        const fav = await favId();
        if (first) {
          /* design/0007 -- every act opens what it needs. */
          const folder = await dailiesFolder();
          await go(`(function(){
            var fav = ${JSON.stringify(fav)};
            if (!Object.keys(__vs.made(fav)).length) {
              __vs.makeBook(fav, { name: "Dailies", source: { kind: "folder", value: ${JSON.stringify(folder)} } }, null);
            }
            document.getElementById("vs-library").scrollTop = 0;
          })(); void 0`);
          await pointer(null);
        }
        const spineSel = `[data-shelf="${fav}"] .vs-spine[data-book$="-made-dailies"]`;
        if (t >= 0.06 && t < 0.2) {
          const s = await centreOf(spineSel);
          if (s) {
            const k = easeInOut((t - 0.06) / 0.14);
            await pointer({ x: Math.round(lerp(s.x + 260, s.x, k)), y: Math.round(lerp(s.y + 200, s.y, k)) });
          }
        }
        await once("edit-menu", 0.2, t, async () => {
          const s = await centreOf(spineSel);
          if (!s) throw new Error("editbook: no made spine to right-click");
          const up = await rightClick(s);
          if (!up) throw new Error("editbook: the right-click on the spine opened no menu");
        });
        if (t >= 0.24 && t < 0.34) {
          const line = await centreOf("#vs-dye .vs-dyepick");
          if (line) await pointer(line);
        }
        await once("edit-line", 0.34, t, () => go(`(function(){
          var b = document.querySelector("#vs-dye .vs-dyepick");
          if (b) b.click();
        })(); void 0`));
        if (t >= 0.36 && t < 0.56) {
          const box = await centreOf("#vs-mbname", 60, 0);
          if (box) await pointer(box);
          await typeInto("vs-mbname", "Journal", t, 0.38, 0.54);
        }
        if (t >= 0.56 && t < 0.62) {
          const save = await centreOf("#vs-mbsave");
          if (save) await pointer(save);
        }
        await once("edit-save", 0.62, t, () => go(`document.getElementById("vs-mbsave").click(); void 0`));
        if (t >= 0.66 && t < 0.76) {
          const s = await centreOf(spineSel);
          if (s) await pointer(s);
        }
        await once("edit-menu2", 0.76, t, async () => {
          const s = await centreOf(spineSel);
          if (s) await rightClick(s);
        });
        if (t >= 0.8 && t < 0.9) {
          const line = await centreOf("#vs-dye .vs-dyepick", 0, 0, 1);
          if (line) await pointer(line);
        }
        await once("edit-delete", 0.9, t, async () => {
          await go(`(function(){
            var lines = document.querySelectorAll("#vs-dye .vs-dyepick");
            if (lines[1]) lines[1].click();
          })(); void 0`);
          await pointer(null);
        });
      },
    },
    {
      /* design/0020 -- the plus at the end of a shelf arranged by hand, on Years. */
      name: "plusbook",
      seconds: 10,
      async at(t, first) {
        await caption(t, 0.04, 0.94,
          "Any shelf you arrange by hand takes one, and ends in a quiet <b>plus</b>.",
          "It stands where the books end and moves with them. Press it: the book goes to the end.");
        if (first) {
          const folder = await dailiesFolder();
          await go(`(function(){
            var years = __vs.settings().shelves.filter(function (s) { return s.id === "years"; })[0];
            if (years && years.direction !== "manual") {
              years.direction = "manual";
              years.order = __vs.sequence("years");
            }
            delete years.made;
            years.order = (years.order || []).filter(function (k) { return k.indexOf("-made-") !== 0; });
            __vs.setFilters({ folders: [] });
            var lib = document.getElementById("vs-library");
            var el = document.querySelector('[data-shelf="years"]');
            lib.scrollTop = Math.max(0, el.offsetTop - 60);
            window.__vsDailies = ${JSON.stringify(folder)};
          })(); void 0`);
          await pointer(null);
        }
        const plusSel = '[data-shelf="years"] .vs-plusbook';
        if (t >= 0.06 && t < 0.3) {
          const s = await centreOf(plusSel);
          if (s) {
            const k = easeInOut((t - 0.06) / 0.24);
            await pointer({ x: Math.round(lerp(s.x + 300, s.x, k)), y: Math.round(lerp(s.y + 220, s.y, k)) });
          }
        }
        if (t >= 0.3 && t < 0.4) { const s = await centreOf(plusSel); if (s) await pointer(s); }
        await once("plus-click", 0.4, t, async () => {
          const s = await centreOf(plusSel);
          if (!s) throw new Error("plusbook: no plus on the Years shelf");
          await pointer(s, true);
          await go(`document.querySelector(${JSON.stringify(plusSel)}).click(); void 0`);
          await go(`(function(){
            var k = document.getElementById("vs-mbsource");
            k.value = "folder";
            k.dispatchEvent(new Event("change", { bubbles: true }));
            var v = document.getElementById("vs-mbsourceval");
            v.value = window.__vsDailies;
            v.dispatchEvent(new Event("change", { bubbles: true }));
          })(); void 0`);
        });
        if (t >= 0.42 && t < 0.68) {
          const box = await centreOf("#vs-mbname", 60, 0);
          if (box) await pointer(box);
          await typeInto("vs-mbname", "Dailies", t, 0.44, 0.64);
        }
        if (t >= 0.68 && t < 0.78) { const s = await centreOf("#vs-mbsave"); if (s) await pointer(s); }
        await once("plus-save", 0.78, t, async () => {
          await pointer(await centreOf("#vs-mbsave"), true);
          await go(`document.getElementById("vs-mbsave").click(); void 0`);
        });
        if (t > 0.8) {
          const s = await centreOf(plusSel);
          if (s) await pointer({ x: s.x + 60, y: s.y + 80 });
        }
      },
    },
    {
      /* github#21 -- leather is one palette; modern follows the theme. */
      name: "looks",
      seconds: 10,
      async at(t, first) {
        await caption(t, 0.06, 0.92,
          "Two <b>looks</b>: leather, and one painted from Vault Graph that follows your theme.",
          "The same twelve colour slots, the same surfaces &mdash; read from the stylesheet, " +
          "so a folder that is blue on the disc is blue on a spine.");
        if (first) {
          await go(`(function(){ if (!document.getElementById("vs-reader").hidden) __vs.closeReader(); __vs.setTheme("dark"); })(); void 0`);
          await settleOn("months");
          await pointer(null);
        }
        if (t >= 0.14 && t < 0.3) {
          const k = await centreOf("#vs-look");
          if (k) await glide({ x: k.x - 260, y: k.y + 300 }, k, easeInOut((t - 0.14) / 0.16));
        }
        await once("look-modern", 0.3, t, async () => {
          await pointer(await centreOf("#vs-look"), true);
          await go(`(function(){ var s = document.getElementById("vs-look"); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); })(); void 0`);
          await pointer(null);
        });
        await once("light", 0.6, t, () => go(`__vs.setTheme("light"); void 0`));
        await once("look-back", 0.9, t, () => go(`(function(){ __vs.setTheme("dark"); var s = document.getElementById("vs-look"); s.value = ${JSON.stringify(LOOK === "modern" ? "" : LOOK)}; s.dispatchEvent(new Event("change", { bubbles: true })); })(); void 0`));
      },
    },
    {
      name: "close",
      seconds: 5,
      async at(t, first) {
        if (first) {
          await go(`(function(){ __vs.setTheme("dark"); var s = document.getElementById("vs-look"); s.value = ${JSON.stringify(LOOK === "modern" ? "" : LOOK)}; s.dispatchEvent(new Event("change", { bubbles: true })); })(); void 0`);
          await scrollTo(0);
          await pointer(null);
        }
        await caption(t, 0.1, 0.8,
          "Vault Shelf",
          "An Obsidian plugin. Local, deterministic, and your notes never move.");
      },
    },
  ];
}

/* ------------------------------------------------------------------- run -- */

const vault = sourceVault();
const scratch = mkdtempSync(join(tmpdir(), "vs-record-"));
const page = join(scratch, "vault-shelf.html");
const frames = join(scratch, "frames");
mkdirSync(frames, { recursive: true });

/* design/0007 -- the exporter takes the vault's NAME from its directory, and a fixture
 * directory is named by its generator digest. "demo-vault-b2957892" in the corner of a demo
 * says nothing to anybody, so the fixture is copied under a name worth showing. */
const named = join(scratch, arg("vault-name", "Everything"));
cpSync(vault, named, { recursive: true });

say("fixture: " + vault);
const build = spawnSync(process.execPath,
                        [join(ROOT, "src", "build-shelf.mjs"), "--vault", named, "--out", page],
                        { encoding: "utf8" });
if (build.status !== 0) throw new Error("build-shelf failed:\n" + (build.stderr || build.stdout));
say((build.stdout || "").trim().split("\n").pop());

const PORT = await freePort();
const profile = mkdtempSync(join(tmpdir(), "vs-record-chrome-"));
const chrome = spawn(findChrome(), [
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
  "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync",
  "--disable-component-update", "--no-service-autorun", "--metrics-recording-only",
  "--no-pings", "--mute-audio", "--hide-scrollbars",
  "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling", "--force-device-scale-factor=1",
  /* design/0007 -- a long capture run is not a browsing session. The first full pass died at
   * frame 948 of 1,992 with nothing but "socket closed"; these are the flags that stop a
   * headless renderer accumulating its way into that on a two-thousand-frame run. */
  "--disable-gpu", "--disable-dev-shm-usage", "--disable-software-rasterizer",
  "--js-flags=--max-old-space-size=2048",
  "--headless=new", "--window-size=" + W + "," + H,
  pathToFileURL(page).href,
], { stdio: ["ignore", "ignore", "pipe"] });

/* design/0007 -- a headless browser that dies mid-capture reports "socket closed" and nothing
 * else, which is a symptom and never a cause. Its stderr is the cause, and it is worth the
 * ring buffer to have it when the run is 2,000 frames long. */
const chromeSaid = [];
let chromeGone = null;
if (chrome.stderr) {
  chrome.stderr.setEncoding("utf8");
  chrome.stderr.on("data", (d) => {
    for (const line of String(d).split("\n")) {
      const t = line.trim();
      if (t) chromeSaid.push(t);
    }
    while (chromeSaid.length > 60) chromeSaid.shift();
  });
}
chrome.on("exit", (code, sig) => { chromeGone = "exit " + code + (sig ? " " + sig : ""); });

let cdp = null;
let shot = 0;
let heroWindow = HERO_CLIP;

try {
  for (let i = 0; i < 60 && !cdp; i++) {
    try { cdp = await attach(PORT, "vault-shelf"); } catch { await sleep(300); }
  }
  if (!cdp) throw new Error("could not attach to Chrome");

  const go = (expr) => cdp.eval(expr);
  const j = async (expr) => JSON.parse(await cdp.eval("JSON.stringify(" + expr + ")"));

  for (let i = 0; i < 100; i++) {
    if (await go("!!(window.__vs && __vs.counts().spines > 0)").catch(() => false)) break;
    await sleep(200);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride",
                 { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  /* design/0016 -- SHOOT IN WHICHEVER LOOK WAS ASKED FOR. The look is a setting, so the film
   * takes it the way a person does: through the library's own selector, which is in the top
   * bar and stays in shot, because unlike the switch it replaced it is part of the product.
   */
  /* `--look modern` names the look whose selector value is the empty string, since an empty
   * flag is no flag; the page opens in leather now, so modern has to be askable for. */
  const look = LOOK === "modern" ? "" : LOOK;
  {
    const applied = await j(`(function(){
      var sel = document.getElementById("vs-look");
      if (!sel) return "no selector";
      sel.value = ${JSON.stringify(look)};
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return document.getElementById("vs-app").getAttribute("data-look") || "";
    })()`);
    if (applied !== look) throw new Error(`--look ${LOOK}: the page came up as "${applied}"`);
    say("look: " + LOOK);
  }

  await go(`(function(){
    var s = document.createElement("style");
    s.textContent = ${JSON.stringify(CAPTION_CSS)};
    document.head.appendChild(s);
    var c = document.createElement("div");
    c.id = "vsrec";
    document.body.appendChild(c);
    var k = document.createElement("div");
    k.id = "vsrec-cursor";
    k.innerHTML = ${JSON.stringify(CURSOR_SVG)};
    document.body.appendChild(k);
  })(); void 0`);

  /* ---- the primitives the storyboard is written in ---- */

  const shelfTop = async (id, pad = -24) => j(`(function(){
    var lib = document.getElementById("vs-library");
    var el = document.querySelector('[data-shelf="${id}"]');
    if (!el) return 0;
    return Math.max(0, el.offsetTop + ${pad});
  })()`);

  const railOf = async (id) => `document.querySelector('[data-shelf="${id}"] .vs-shelfrail')`;

  const scrollTo = (px) => go(`document.getElementById("vs-library").scrollTop = ${Math.round(px)}; void 0`);
  /* github#21 -- scroll, re-measure, scroll: a shelf's height is a guess. */
  const settleOn = async (id, pad = -70) => {
    let at = 0;
    for (let i = 0; i < 4; i++) {
      const want = await shelfTop(id, pad);
      if (Math.abs(want - at) < 2) break;
      at = want;
      await scrollTo(at);
    }
    return at;
  };
  const railTo = (rail, px) => go(`(function(){ var r = ${rail}; if (r) r.scrollLeft = ${Math.round(px)}; })(); void 0`);

  const spineIn = async (id, n) => j(`(function(){
    var s = document.querySelectorAll('[data-shelf="${id}"] .vs-spine')[${n}];
    if (!s) return null;
    var b = s.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
             sel: '[data-shelf="${id}"] .vs-spine:nth-of-type(${n + 1})' };
  })()`);

  const hover = async (p) => {
    if (!p) return;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y, buttons: 0 });
  };

  /* RETURNS WHETHER IT HIT A SPINE. `elementFromPoint` on a spine that has scrolled out of its
   * rail finds the page, or nothing, and clicks neither -- so the act films a shelf while its
   * caption talks about a reader, and the take looks fine until somebody watches it. Four acts
   * of one film went out that way. Callers assert on the answer. */
  const click = async (p) => {
    if (!p) return false;
    await hover(p);
    return j(`(function(){
      var el = document.elementFromPoint(${p.x}, ${p.y});
      while (el && !el.classList.contains("vs-spine")) el = el.parentElement;
      if (!el) return false;
      el.click();
      return true;
    })()`);
  };

  /* THE CAPTION FADES ON A CURVE OF ITS OWN, so a caption is never mid-fade while the thing
   * it describes is mid-move: it is fully up for the middle of every act. */
  const caption = async (t, inAt, outAt, text, sub) => {
    const fade = 0.09;
    let o = 1;
    if (t < inAt) o = 0;
    else if (t < inAt + fade) o = (t - inAt) / fade;
    else if (t > outAt) o = 0;
    else if (t > outAt - fade) o = (outAt - t) / fade;
    const html = '<span class="t">' + text + "</span>" +
                 (sub ? '<span class="sub">' + sub + "</span>" : "");
    await go(`(function(){
      var c = document.getElementById("vsrec");
      if (!c) return;
      if (c.dataset.html !== ${JSON.stringify(html)}) {
        c.innerHTML = ${JSON.stringify(html)};
        c.dataset.html = ${JSON.stringify(html)};
      }
      c.style.opacity = ${o.toFixed(3)};
      var app = document.getElementById("vs-app");
      c.classList.toggle("paper",
        app.getAttribute("data-theme") === "light" && (app.getAttribute("data-look") || "") === "");
    })(); void 0`);
  };

  /* design/0007 -- ONE STEP, ONCE, WHATEVER THE FRAME RATE.
   *
   * An act is handed t on every frame, so `if (t > 0.16 && t < 0.22) click()` fires on every
   * frame inside that window -- three times at 6fps, thirteen at 24. For an idempotent step
   * (set a theme, set a query) that is merely wasteful. For a TOGGLE it is a coin flip decided
   * by the frame rate: the ribbon act left the note bookmarked at one fps and un-bookmarked at
   * another, and the shelf in the film had no ribbon on it. */
  const fired = new Set();
  const once = async (key, at, t, fn) => {
    if (t < at || fired.has(key)) return;
    fired.add(key);
    await fn();
  };

  /* design/0020 -- the hand in shot: an arrow the recorder draws and moves. */
  /* github#21 -- quiet: the arrow moves, the real mouse does not. */
  const pointer = async (p, pressed, quiet) => {
    if (!p) {
      /* github#21 -- hidden means gone: the mouse parks in the caption bar. */
      await hover({ x: Math.round(W / 2), y: H - 12 });
      await go(`(function(){ var k = document.getElementById("vsrec-cursor"); if (k) k.style.opacity = 0; })(); void 0`);
      return;
    }
    if (!quiet) await hover(p);
    await go(`(function(){
      var k = document.getElementById("vsrec-cursor");
      if (!k) return;
      k.style.left = "${Math.round(p.x)}px";
      k.style.top = "${Math.round(p.y)}px";
      k.style.opacity = 1;
      k.classList.toggle("press", ${pressed ? "true" : "false"});
    })(); void 0`);
  };
  /* github#54 -- a real press, because el.click() arms no mousedown */
  const pressAt = async (p) => {
    if (!p) return;
    await pointer(p, true);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await pointer(p, false);
  };
  const rightClick = async (p) => {
    await pointer(p, true);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "right", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "right", clickCount: 1 });
    const up = await j(`!document.getElementById("vs-railmenu").hidden || !document.getElementById("vs-dye").hidden`);
    if (!up) {
      /* design/0007 -- a fallback when CDP raised no contextmenu. */
      await go(`(function(){
        var el = document.elementFromPoint(${p.x}, ${p.y});
        if (el) el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: ${p.x}, clientY: ${p.y} }));
      })(); void 0`);
    }
    await pointer(p, false);
    return j(`!document.getElementById("vs-railmenu").hidden || !document.getElementById("vs-dye").hidden`);
  };
  const centreOf = async (sel, dx = 0, dy = 0, nth = 0) => j(`(function(){
    var el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}];
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2 + ${dx}), y: Math.round(b.top + b.height / 2 + ${dy}) };
  })()`);

  /* github#21 -- a drag the camera can see; the events are the page's own. */
  const lift = async (sel) => {
    const up = await liftIn(sel);
    /* github#21 -- the real mouse parks, or a scroll slides a spine under it. */
    if (up) await hover({ x: Math.round(W / 2), y: H - 12 });
    return up;
  };
  const liftIn = async (sel) => j(`(function(){
    var s = document.querySelector(${JSON.stringify(sel)});
    if (!s) return null;
    var b = s.getBoundingClientRect();
    var dt = new DataTransfer();
    s.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    if (s.getAttribute("data-dragging") !== "1") return null;
    s.dispatchEvent(new MouseEvent("mouseleave"));
    window.__vsrecDrag = { dt: dt, from: s };
    var g = s.cloneNode(true);
    g.id = "vsrec-ghost";
    g.removeAttribute("data-dragging"); g.removeAttribute("data-book"); g.removeAttribute("data-hand");
    g.style.width = b.width + "px"; g.style.height = b.height + "px";
    g.style.left = b.left + "px"; g.style.top = b.top + "px";
    document.getElementById("vs-app").appendChild(g);
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  })()`);
  const carry = async (p) => {
    if (!p) return;
    await pointer(p, true, true);
    await go(`(function(){
      var g = document.getElementById("vsrec-ghost");
      if (g) { g.style.left = (${p.x} - g.offsetWidth / 2) + "px"; g.style.top = (${p.y} - g.offsetHeight / 2) + "px"; }
      var d = window.__vsrecDrag;
      var el = document.elementFromPoint(${p.x}, ${p.y});
      if (d && el) el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
        dataTransfer: d.dt, clientX: ${p.x}, clientY: ${p.y} }));
    })(); void 0`);
  };
  const drop = async (p) => {
    if (!p) return;
    await go(`(function(){
      var d = window.__vsrecDrag;
      var el = document.elementFromPoint(${p.x}, ${p.y});
      if (d && el) el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true,
        dataTransfer: d.dt, clientX: ${p.x}, clientY: ${p.y} }));
      if (d) d.from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: d.dt }));
      var g = document.getElementById("vsrec-ghost");
      if (g) g.parentNode.removeChild(g);
      window.__vsrecDrag = null;
    })(); void 0`);
    await pointer(p, false, true);
  };

  const P = { go, j, caption, scrollTo, settleOn, railTo, hover, click, shelfTop, railOf, spineIn, once,
              pointer, rightClick, pressAt, centreOf, lift, carry, drop, state: {} };
  const acts = storyboard(P).filter((a) => !ONLY.length || ONLY.some((q) => a.name.toLowerCase().includes(q)));
  if (!acts.length) throw new Error("--act " + ONLY.join(",") + " matched no act");

  const total = acts.reduce((n, a) => n + Math.round(a.seconds * FPS), 0);
  say(`${acts.length} act(s), ${total} frames at ${FPS}fps = ${(total / FPS).toFixed(1)}s, ${W}x${H}`);
  if (HERO && !HERO_CLIP) {
    /* github#21 -- the window follows the acts as they fall in this take. */
    let at = 0, from = -1, to = -1;
    for (const a of acts) {
      const n = Math.round(a.seconds * FPS) / FPS;
      if (HERO_ACTS.includes(a.name.toLowerCase())) { if (from < 0) from = at; to = at + n; }
      at += n;
    }
    if (from < 0) throw new Error("--hero: none of " + HERO_ACTS.join(",") + " is in this take");
    heroWindow = [from, to - from];
    say(`hero: ${HERO_ACTS.filter((h) => acts.some((a) => a.name === h)).join(", ")} = ` +
        `${from.toFixed(1)}s to ${to.toFixed(1)}s (${(to - from).toFixed(1)}s)`);
  }

  const diagnose = (e, where) => {
    const lines = [
      `the recorder lost the browser during "${where}", after ${shot} frame(s).`,
      "  " + e.message,
    ];
    if (chromeGone) lines.push("  chrome process: " + chromeGone);
    if (chromeSaid.length) {
      lines.push("  chrome said:");
      for (const l of chromeSaid.slice(-14)) lines.push("    " + l);
    }
    return new Error(lines.join("\n"));
  };

  const t0 = Date.now();
  for (const act of acts) {
    const n = Math.round(act.seconds * FPS);
    for (let f = 0; f < n; f++) {
      const t = n === 1 ? 1 : f / (n - 1);
      /* github#21 -- an act's own error stops the take; design/0007. */
      try {
        await act.at(t, f === 0);
      } catch (e) {
        if (chromeGone || /socket|closed|target/i.test(e.message)) throw diagnose(e, act.name);
        throw new Error(`${act.name}: frame ${f} of ${n} (t=${t.toFixed(2)}): ${e.message}`);
      }
      try {
        const res = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
        writeFileSync(join(frames, "f-" + String(shot).padStart(5, "0") + ".jpg"),
                      Buffer.from(res.data, "base64"));
      } catch {
        /* ONE RETRY, and only for a frame. A capture that fails twice is a browser that is
         * gone, and continuing would silently drop frames out of the middle of the video. */
        await sleep(250);
        try {
          const res = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
          writeFileSync(join(frames, "f-" + String(shot).padStart(5, "0") + ".jpg"),
                        Buffer.from(res.data, "base64"));
        } catch (again) {
          throw diagnose(again, act.name);
        }
      }
      shot++;
    }
    say(`  ${act.name.padEnd(10)} ${n} frames  (${shot} total)`);
  }
  say(`captured ${shot} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally {
  try { if (cdp) cdp.close(); } catch { }
  try { chrome.kill(); } catch { }
  if (process.platform === "win32" && chrome.pid) {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  }
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { }
}

if (!shot) throw new Error("no frames captured");

/* ---------------------------------------------------------------- encode -- */

const ffmpeg = findFfmpeg();
const run = (args) => {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed:\n" + (r.stderr || "").split("\n").slice(-12).join("\n"));
};

run(["-y", "-loglevel", "error", "-framerate", String(FPS),
     "-i", join(frames, "f-%05d.jpg"),
     "-c:v", "libx264", "-preset", "slow", "-crf", "20",
     "-pix_fmt", "yuv420p", "-movflags", "+faststart",
     "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", OUT]);
say("wrote " + OUT + " (" + (statSync(OUT).size / 1024 / 1024).toFixed(1) + " MB)");

if (HERO) {
  const hero = resolve(HERO);
  mkdirSync(dirname(hero), { recursive: true });
  run(["-y", "-loglevel", "error",
       "-ss", String(heroWindow[0]), "-t", String(heroWindow[1]), "-i", OUT,
       "-vf", `fps=${HERO_FPS},scale=${HERO_W}:-2:flags=lanczos`,
       "-c:v", "libwebp", "-lossless", "0", "-q:v", String(HERO_Q), "-compression_level", "6",
       "-loop", "0", "-an", hero]);
  say("wrote " + hero + " (" + (statSync(hero).size / 1024).toFixed(0) + " KB)");
}

if (KEEP) say("--keep-frames: " + frames);
else rmSync(scratch, { recursive: true, force: true });
