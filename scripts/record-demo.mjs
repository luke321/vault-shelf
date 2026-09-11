#!/usr/bin/env node
// design/0007

import { attach } from "./cdp.mjs";
import { currentFixture } from "./fixture-store.mjs";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
/* design/0007 -- the hero is an EXCERPT, not the whole film. A WebP of all 83 seconds came
 * out at 18.5 MB, which is not a thing to put at the top of a README; twelve seconds of the
 * shelves at 10fps and 900px is about 1/10th of that and says the same thing. */
const HERO_CLIP = (arg("hero-clip", "5,12") || "5,12").split(",").map(Number);
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

/* design/0013 -- WHERE THE FILM IS SHOT.
 *
 * A fixture vault is built to exercise the classifiers, and it shows: even people, smooth tag
 * counts, folders called `alpha`. The uneven shelf is the whole point of the product and a
 * fixture is the one vault that is not uneven, so the film is shot in a MIRROR of a real
 * vault -- same tree, same dates, same distributions, no real words.
 *
 * The source path is read from `.mirror-source` (gitignored, written once) or the environment,
 * never from a commit: `check-pii` refuses a vault path in a tracked file, and it is right to.
 */
function mirrorSource() {
  const explicit = arg("mirror-of", "");
  if (explicit) return resolve(explicit);
  const f = join(ROOT, ".mirror-source");
  if (existsSync(f)) {
    const line = readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim())
      .find(Boolean);
    if (line) return resolve(line);
  }
  const env = process.env.VAULT_SHELF_VAULT || process.env.OBSIDIAN_VAULT || "";
  return env ? resolve(env) : "";
}

function sourceVault() {
  const explicit = arg("vault", "");
  if (explicit) return resolve(explicit);

  const source = argv.includes("--no-mirror") ? "" : mirrorSource();
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
  const hit = existsSync(store)
    ? (basename(currentFixture(ROOT, "demo-vault")) || undefined)
    : null;
  if (!hit) {
    throw new Error("no demo-vault-* fixture in " + store +
      ' -- run `node scripts/smoke.mjs --only "no console errors"` once to generate the store');
  }
  say("no mirror source (.mirror-source / VAULT_SHELF_VAULT): shooting in a fixture vault");
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
`;

/* ---------------------------------------------------------- the storyboard --
 * design/0007 -- every act declares how many SECONDS it lasts and is handed a normalised
 * 0..1 through that time, so the video's length is a property of this table and nothing
 * else needs to know the frame rate.
 */
function storyboard(P) {
  const { go, j, caption, scrollTo, railTo, hover, click, shelfTop, railOf, spineIn, once } = P;
  let parted = "note";   // the search the parting act types, taken from the vault itself

  return [
    {
      name: "open",
      seconds: 4.5,
      async at(t) {
        await caption(t, 0.15, 0.95,
          "Your vault, as a library.",
          "394 notes. Nothing was moved.");
      },
    },
    {
      name: "shelves",
      seconds: 9,
      async at(t) {
        await caption(t, 0.05, 0.9,
          "<b>Six shelves</b>, and every one of them is the whole vault.",
          "Encyclopedia · Years · Months · Weeks · People · Tags");
        const from = await shelfTop("encyclopedia");
        const to = await shelfTop("tags");
        await scrollTo(lerp(from, to, easeInOut(t)));
      },
    },
    {
      name: "plaques",
      seconds: 7,
      async at(t) {
        await caption(t, 0.06, 0.9,
          "Months and weeks group under <b>year plaques</b>.",
          "The plaque scrolls with its own books, because it is inside the same rail.");
        await scrollTo(await shelfTop("months", -70));
        const rail = await railOf("months");
        await railTo(rail, lerp(0, 900, easeInOut(t)));
      },
    },
    {
      name: "peek",
      seconds: 5,
      async at(t, first) {
        await caption(t, 0.08, 0.9,
          "A spine is a book: its title, its size, where its notes came from.",
          "The band at the head is the folder mix. The number at the foot is the count.");
        // The plaques act left this rail 900px along. The fourth spine is only at a coordinate
        // worth aiming at from the start of it.
        if (first) await railTo(await railOf("months"), 0);
        const spine = await spineIn("months", 3);
        if (t > 0.2) await hover(spine);
      },
    },
    {
      name: "read",
      seconds: 8,
      async at(t, first) {
        if (first) {
          await railTo(await railOf("months"), 0);
          const spine = await spineIn("months", 3);
          const hit = await click(spine);
          const open = await j(`!document.getElementById("vs-reader").hidden`);
          if (!hit || !open) {
            throw new Error("read: the click " + (hit ? "hit a spine but no reader opened" :
              "found no spine at " + JSON.stringify(spine)) +
              " -- every act after this one films a shelf and talks about a book");
          }
        }
        await caption(t, 0.1, 0.88,
          "Open it and <b>read</b>.",
          "Contents on the left, the note on the right, an index down the edge.");
      },
    },
    {
      name: "index",
      seconds: 6,
      async at(t, first) {
        await caption(t, 0.08, 0.9,
          "The index is the book's own shape.",
          "Days for a month, months for a year, initial ranges for anything alphabetical.");
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
          "<b>One note, six addresses.</b>",
          "Step sideways into another shelf without leaving the note.");
        await once("sideways", 0.36, t, () => go(`(function(){
          var links = document.querySelectorAll("#vs-alsoin button");
          if (links[1]) links[1].click(); else if (links[0]) links[0].click();
        })(); void 0`));
      },
    },
    {
      name: "ribbon",
      seconds: 9,
      async at(t, first) {
        await caption(t, 0.05, 0.92,
          "Leave a <b>ribbon</b> in it.",
          "One note is in six books, so one ribbon hangs out of all six &mdash; and it " +
          "re-threads itself if you hide a shelf or rename the note.");
        /* EVERY ACT OPENS WHAT IT NEEDS. Relying on the previous act to have left the reader
         * open makes `--act ribbon` shoot a click at a disabled button and film nothing. */
        if (first) {
          await go(`(function(){
            if (document.getElementById("vs-reader").hidden) {
              var m = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0];
              __vs.openBook(m.books[0].id, null);
            }
          })(); void 0`);
        }
        await once("mark", 0.16, t, () => go(`document.getElementById("vs-ribbon").click(); void 0`));
        await once("back", 0.44, t, () => go(`document.getElementById("vs-back").click(); void 0`));
        if (t > 0.5) await scrollTo(0);
      },
    },
    {
      name: "parting",
      seconds: 10,
      async at(t, first) {
        await caption(t, 0.05, 0.92,
          "Search, and the shelf <b>parts</b>.",
          "Nothing is removed. Matches draw forward, the rest thin to ghosts, and clearing " +
          "the box puts the room back exactly.");
        if (first) {
          await scrollTo(await shelfTop("encyclopedia", -20));
          /* THE NEEDLE COMES OUT OF THE VAULT. It used to be the literal "garden", which is a
           * tag in the demo fixture and in no other vault on earth: filmed anywhere else the
           * shelf parted around nothing and the act argued for a feature it had just failed to
           * show. The vault's most-used tag is a word this vault is certainly about. */
          parted = await j(`(function(){
            var count = {};
            __vs.data().notes.forEach(function (n) {
              (n.tags || []).forEach(function (tag) {
                var head = String(tag).split("/")[0];
                if (head.length >= 4) count[head] = (count[head] || 0) + 1;
              });
            });
            var best = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
            return best || "note";
          })()`);
        }
        /* Typed a letter at a time, because the whole point is what happens WHILE you type. */
        const word = parted;
        if (t < 0.62) {
          const n = Math.min(word.length, Math.floor(((t - 0.12) / 0.38) * word.length) + 1);
          await go(`__vs.setQuery(${JSON.stringify(word)}.slice(0, ${Math.max(0, n)})); void 0`);
        } else if (t > 0.86) {
          await go(`__vs.setQuery(""); void 0`);
        }
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
          await go(`__vs.setQuery(""); void 0`);
          await scrollTo(await shelfTop("years", -20));
        }
        /* Thirteen opens is wear level 3 of 3 (core.wearLevel). Spread across the act so the
         * spine is seen changing rather than found already changed. */
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
      name: "theme",
      seconds: 8,
      async at(t, first) {
        await caption(t, 0.06, 0.92,
          "Painted from <b>Vault Graph</b>, and it follows your theme.",
          "The same twelve colour slots, the same surfaces &mdash; read from the stylesheet, " +
          "so a folder that is blue on the disc is blue on a spine.");
        if (first) await scrollTo(await shelfTop("months", -70));
        await once("light", 0.3, t, () => go(`__vs.setTheme("light"); void 0`));
      },
    },
    {
      name: "close",
      seconds: 5,
      async at(t, first) {
        if (first) {
          await go(`__vs.setTheme("dark"); void 0`);
          await scrollTo(await shelfTop("encyclopedia", -20));
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
  const look = arg("look", "") === "modern" ? "" : arg("look", "");
  if (look || arg("look", "") === "modern") {
    const applied = await j(`(function(){
      var sel = document.getElementById("vs-look");
      if (!sel) return "no selector";
      sel.value = ${JSON.stringify(look)};
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return document.getElementById("vs-app").getAttribute("data-look") || "";
    })()`);
    if (applied !== look) throw new Error(`--look ${look}: the page came up as "${applied}"`);
    say("look: " + look);
  }

  await go(`(function(){
    var s = document.createElement("style");
    s.textContent = ${JSON.stringify(CAPTION_CSS)};
    document.head.appendChild(s);
    var c = document.createElement("div");
    c.id = "vsrec";
    document.body.appendChild(c);
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
      c.classList.toggle("paper",
        document.getElementById("vs-app").getAttribute("data-skin") === "paper");
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

  const P = { go, j, caption, scrollTo, railTo, hover, click, shelfTop, railOf, spineIn, once };
  const acts = storyboard(P).filter((a) => !ONLY.length || ONLY.some((q) => a.name.toLowerCase().includes(q)));
  if (!acts.length) throw new Error("--act " + ONLY.join(",") + " matched no act");

  const total = acts.reduce((n, a) => n + Math.round(a.seconds * FPS), 0);
  say(`${acts.length} act(s), ${total} frames at ${FPS}fps = ${(total / FPS).toFixed(1)}s, ${W}x${H}`);

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
      try {
        await act.at(t, f === 0);
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
       "-ss", String(HERO_CLIP[0]), "-t", String(HERO_CLIP[1]), "-i", OUT,
       "-vf", "fps=10,scale=900:-2:flags=lanczos",
       "-c:v", "libwebp", "-lossless", "0", "-q:v", "48", "-compression_level", "6",
       "-loop", "0", "-an", hero]);
  say("wrote " + hero + " (" + (statSync(hero).size / 1024).toFixed(0) + " KB)");
}

if (KEEP) say("--keep-frames: " + frames);
else rmSync(scratch, { recursive: true, force: true });
