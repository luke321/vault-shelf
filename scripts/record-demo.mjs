#!/usr/bin/env node
// design/0007

import { attach } from "./cdp.mjs";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

function sourceVault() {
  const explicit = arg("vault", "");
  if (explicit) return resolve(explicit);
  const store = fixtureStore();
  const hit = existsSync(store)
    ? readdirSync(store).find((d) => d.startsWith("demo-vault-") && statSync(join(store, d)).isDirectory())
    : null;
  if (!hit) {
    throw new Error("no demo-vault-* fixture in " + store +
      ' -- run `node scripts/smoke.mjs --only "no console errors"` once to generate the store');
  }
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
  const { go, caption, scrollTo, railTo, hover, click, shelfTop, railOf, spineIn } = P;

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
      async at(t) {
        await caption(t, 0.08, 0.9,
          "A spine is a book: its title, its size, where its notes came from.",
          "The band at the head is the folder mix. The number at the foot is the count.");
        const spine = await spineIn("months", 3);
        if (t > 0.2) await hover(spine);
      },
    },
    {
      name: "read",
      seconds: 8,
      async at(t, first) {
        if (first) {
          const spine = await spineIn("months", 3);
          await click(spine);
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
        if (t > 0.35 && t < 0.42) {
          await go(`(function(){
            var links = document.querySelectorAll("#vs-alsoin button");
            if (links[1]) links[1].click(); else if (links[0]) links[0].click();
          })(); void 0`);
        }
      },
    },
    {
      name: "bookmark",
      seconds: 6,
      async at(t, first) {
        await caption(t, 0.08, 0.9,
          "A ribbon saves your place.",
          "It re-resolves later, even if that shelf is hidden or that book has gone.");
        if (t > 0.3 && t < 0.36) await go(`document.getElementById("vs-ribbon").click(); void 0`);
        if (t > 0.68 && t < 0.74) await go(`document.getElementById("vs-back").click(); void 0`);
      },
    },
    {
      name: "filter",
      seconds: 8,
      async at(t, first) {
        await caption(t, 0.06, 0.9,
          "Filter by folder, by day, or by text.",
          "Membership changes. Nothing moves.");
        if (first) await scrollTo(await shelfTop("encyclopedia", -20));
        if (t > 0.22 && t < 0.28) {
          await go(`(function(){
            var rows = document.querySelectorAll("#vs-folders .folderrow");
            if (rows[0]) rows[0].click();
          })(); void 0`);
        }
        if (t > 0.78 && t < 0.84) {
          await go(`document.getElementById("vs-clearfilters").click(); void 0`);
        }
      },
    },
    {
      name: "build",
      seconds: 10,
      async at(t, first) {
        await caption(t, 0.05, 0.9,
          "Build your own from <b>two questions</b>.",
          "Which notes belong here, and what makes a book. The preview is the real thing.");
        if (first) await go(`document.getElementById("vs-newshelf").click(); void 0`);
        if (t > 0.3 && t < 0.36) {
          await go(`(function(){
            var s = document.getElementById("vs-bclassifier");
            s.value = "person";
            s.dispatchEvent(new Event("change", { bubbles: true }));
          })(); void 0`);
        }
        if (t > 0.62 && t < 0.68) {
          await go(`(function(){
            var s = document.getElementById("vs-bclassifier");
            s.value = "property";
            s.dispatchEvent(new Event("change", { bubbles: true }));
          })(); void 0`);
        }
        if (t > 0.92) await go(`document.getElementById("vs-bcancel").click(); void 0`);
      },
    },
    {
      name: "paper",
      seconds: 7,
      async at(t, first) {
        await caption(t, 0.08, 0.9,
          "<b>Two skins</b>, one feature set.",
          "Graphite is a charcoal archive. Paper &amp; cloth is the same library in warm paper.");
        if (first) await scrollTo(await shelfTop("months", -70));
        if (t > 0.3 && t < 0.36) await go(`__vs.setSkin("paper"); void 0`);
      },
    },
    {
      name: "close",
      seconds: 5,
      async at(t, first) {
        if (first) {
          await go(`__vs.setSkin("graphite"); void 0`);
          await scrollTo(await shelfTop("encyclopedia", -20));
        }
        await caption(t, 0.1, 0.8,
          "Vault Shelf",
          "An Obsidian plugin. Local, deterministic, and it never touches your files.");
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

  const click = async (p) => {
    if (!p) return;
    await hover(p);
    await go(`(function(){
      var el = document.elementFromPoint(${p.x}, ${p.y});
      while (el && !el.classList.contains("vs-spine")) el = el.parentElement;
      if (el) el.click();
    })(); void 0`);
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

  const P = { go, caption, scrollTo, railTo, hover, click, shelfTop, railOf, spineIn };
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
