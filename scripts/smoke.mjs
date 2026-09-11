import { attach, json } from "./cdp.mjs";
import { leftmostScreen, leftWindowPos } from "./screen.mjs";
// github#5, decisions/0010
import { FIXTURE_MAX_AGE_DAYS, FIXTURE_NAMES, describeFixture,
         record as recordPass } from "./suite-stamp.mjs";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync,
         renameSync, mkdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MEASURE, VIEWPORT, diffLayout } from "./layout-snapshots/measure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const argAll = (n) => {
  const out = [];
  argv.forEach((a, i) => {
    if (a === "--" + n && argv[i + 1]) out.push(...argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean));
  });
  return out;
};
/* github#8, decisions/0011 */
const NO_LOCK = argv.includes("--no-lock");
const LOCK_TIMEOUT_MS = Number(arg("lock-timeout-ms", "1800000")) || 1800000;
const LOCK_OWNER = (() => {
  const b = spawnSync("git", ["-C", ROOT, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  const where = b.status === 0 && b.stdout.trim() ? b.stdout.trim() : "?";
  return `smoke.mjs ${where} pid ${process.pid}`;
})();
let lockHeld = false;

/* github#8, decisions/0011 */
const liveBrowsers = new Set();

function killLiveBrowsers() {
  for (const child of liveBrowsers) {
    try {
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGKILL");
      }
    } catch { void 0; }
  }
  liveBrowsers.clear();
}

/* github#8, decisions/0011 */
function takeLock() {
  if (NO_LOCK) {
    console.log("--no-lock: the caller is holding the suite lock, not this run");
    return;
  }
  const r = spawnSync(process.execPath,
                      [join(HERE, "lock.mjs"), "acquire", "suite", "--owner", LOCK_OWNER,
                       "--timeout-ms", String(LOCK_TIMEOUT_MS)],
                      { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("\nsmoke: could not take the suite lock -- another suite is running on this " +
                  "machine.\nSee who holds it with: node scripts/lock.mjs status\n\n" +
                  "If YOU are holding it -- you wrapped this run in lock.mjs yourself, the way " +
                  "the\ndocs used to tell you to -- then it is waiting for its own parent. Drop " +
                  "the wrapper,\nor pass --no-lock.");
    process.exit(1);
  }
  lockHeld = true;
}

/* github#8, decisions/0011 */
function dropLock() {
  if (!lockHeld) return;
  lockHeld = false;
  spawnSync(process.execPath,
            [join(HERE, "lock.mjs"), "release", "suite", "--owner", LOCK_OWNER],
            { stdio: "inherit" });
}

process.on("exit", dropLock);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(sig, () => {
    console.log(`\nsmoke: ${sig} -- taking the browsers down and releasing the lock`);
    killLiveBrowsers();
    dropLock();
    process.exit(1);
  });
}

const PINNED_PORT = arg("port", "") ? Number(arg("port", "")) : 0;
/* Kept as the flag that says "leave the window where I can see it"; the position is now the
 * left screen either way (design/0006), so this only reads as documentation of intent. */
const HEADED = argv.includes("--headed");
if (HEADED) process.env.VS_HEADED = "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePorts(k) {
  const held = [];
  try {
    for (let i = 0; i < k; i++) {
      held.push(await new Promise((res, rej) => {
        const srv = createServer();
        srv.listen(0, "127.0.0.1", () => res(srv));
        srv.on("error", rej);
      }));
    }
    return held.map((srv) => srv.address().port);
  } finally {
    for (const srv of held) { try { srv.close(); } catch { } }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/* ------------------------------------------------------------------ chrome */

function findChrome() {
  const named = arg("chrome", "");
  if (named) return named;
  const guesses = [
    process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium"
  ];
  for (const g of guesses) if (g && existsSync(g)) return g;
  throw new Error("Chrome not found; pass --chrome <path>");
}

/* -------------------------------------------------------------- the checks */

const all = [];
const check = (name, fn) => all.push({ name, fn });

const ONLY = argAll("only").map((v) => v.toLowerCase());
const selected = () => (ONLY.length
  ? all.filter((c) => ONLY.some((q) => c.name.toLowerCase().includes(q)))
  : all);

const JOBS = Math.max(1, Number(arg("jobs", "4")) || 4);
/* NUMBERS CANNOT SEE, and this is the only thing in the repo that can. `--shot out.png` writes
 * the library and, beside it, `out-reader.png` of an open book -- from the same Chrome the
 * checks are driving, with no Obsidian involved. Use it with `--only` and one vault, or you
 * will be looking at whichever of three shapes finished last. */
const SHOT = arg("shot", "");
const LOOK = arg("look", "");
/* `--shot-note "<title>"` opens that note for the reader picture instead of the first book,
 * which is how a rendering complaint about one particular note gets looked at. */
const SHOT_NOTE = arg("shot-note", "");
/* `--shot-open manage|builder` takes the library picture with that sheet open. Manage is shot
 * with one slot and the ribbon changed, because a colours block with nothing changed shows
 * none of the marks the block exists to show; both are put back before the sheet closes. */
const SHOT_OPEN = arg("shot-open", "");
const GRID = argv.includes("--no-grid") ? false
          : argv.includes("--grid") ? true
          : JOBS > 1;

let SCREEN = null;

function gridSlot(i, k) {
  if (!SCREEN) SCREEN = leftmostScreen();
  const cols = Math.ceil(Math.sqrt(Math.max(1, k)));
  const w = Math.floor(SCREEN.w / cols), h = Math.floor(SCREEN.h / Math.ceil(Math.max(1, k) / cols));
  return { x: SCREEN.x + (i % cols) * w, y: SCREEN.y + Math.floor(i / cols) * h, w, h };
}

/* Checks that click, scroll or read a laid-out box run alone: a contended browser reports a
 * geometry that has more to do with the other three windows than with the code. */
const POINTER_DRIVEN = [
  /* A frame-time measurement and a viewport resize are as sensitive to three other Chromes
   * on the same GPU as any box-reading check is, and showed it: the scroll check failed one
   * shape in a full run and passed the same shape alone. */
  "stays smooth",
  "narrower window",
  "opens a book",
  "spine lifts",
  "reading shelf",
  "escape",
  "keyboard",
  "plaque sits",
  "tabs",
  "has a width",
  "same size",
  /* design/0018 -- a drop is a pointer position against a box, and it has to scroll a shelf
   * into view before it can read one. */
  "drag and drop",
  /* github#5 -- a golden of every box on the page, read at a fixed viewport. */
  "golden snapshot",
];
const isSerial = (c) => POINTER_DRIVEN.some((q) => c.name.toLowerCase().includes(q));

/* =========================================================== the invariants ==
 * Every check here prints the number it measured, and every one has a section in
 * .ai-context/invariants.md. A check quietly relaxed is worse than one that fails.
 */

check("the page loads with no console errors", async (p, ctx) => {
  await sleep(200);
  return { ok: ctx.errors.length === 0,
           detail: ctx.errors.length ? ctx.errors.slice(0, 3).join(" | ") : "0 errors" };
});

check("__vs is present and the library rendered", async (p) => {
  const c = await p.j("__vs.counts()");
  return { ok: c.notes > 0 && c.shelves > 0 && c.spines > 0,
           detail: `${c.notes} notes, ${c.shelves} shelves, ${c.books} books, ${c.spines} spines drawn` };
});

check("the six default shelves are there, in order", async (p) => {
  const ids = await p.j("__vs.views().map(function(v){return v.shelf.id})");
  const want = ["encyclopedia", "years", "months", "weeks", "people", "tags"];
  const ok = JSON.stringify(ids) === JSON.stringify(want);
  return { ok, detail: ok ? want.join(" -> ") : `got ${ids.join(" -> ")}` };
});

check("a shelf's note count is unique notes, never the sum of its books", async (p) => {
  const report = await p.j("__vs.checkMembership()");
  const bad = report.filter((r) => !r.ok);
  const overlap = report.filter((r) => r.sum > r.unique);
  return {
    ok: bad.length === 0,
    detail: bad.length
      ? bad.map((r) => `${r.shelf}: ${r.unique} unique vs ${r.claimed} claimed`).join("; ")
      : `${report.length} shelves agree; ${overlap.length} of them place a note in more than ` +
        `one book (${overlap.map((r) => r.shelf + " " + r.sum + "/" + r.unique).join(", ") || "none"})`
  };
});

check("every note reachable from the vault is on at least one shelf", async (p) => {
  const missing = await p.j(`(function(){
    var seen = {};
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { b.notes.forEach(function (n) { seen[n.id] = 1; }); });
    });
    return __vs.data().notes.filter(function (n) { return !seen[n.id]; }).map(function (n) { return n.id; });
  })()`);
  return { ok: missing.length === 0,
           detail: missing.length ? `${missing.length} orphaned: ${missing.slice(0, 3).join(", ")}`
                                  : "every note has an address" };
});

check("an undated note lands in Undated, not in a guessed year", async (p) => {
  const r = await p.j(`(function(){
    var undated = __vs.data().notes.filter(function (n) { return n.date === null; }).length;
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0];
    var book = years.books.filter(function (b) { return b.key === "-undated"; })[0];
    return { undated: undated, inBook: book ? book.notes.length : 0, last: years.books.length ? years.books[years.books.length - 1].key : "" };
  })()`);
  const ok = r.undated === r.inBook && (r.undated === 0 || r.last === "-undated");
  return { ok, detail: `${r.undated} undated notes, ${r.inBook} in the Undated book, ` +
                       `which sorts ${r.last === "-undated" ? "last" : "at " + r.last}` };
});

check("an impossible date is not a date, and never a fifteenth month", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var notes = __vs.data().notes;
    var unreal = notes.filter(function (n) { return n.date !== null && !core.isIsoDay(n.date); });
    var months = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0];
    var badKeys = months ? months.books.filter(function (b) {
      return b.key !== "-undated" && !/^\\d{4}-(0[1-9]|1[0-2])$/.test(b.key);
    }).map(function (b) { return b.key; }) : [];
    var typos = notes.filter(function (n) {
      var raw = n.props && n.props.date;
      return !!raw && !core.isIsoDay(String(raw).slice(0, 10));
    });
    var misdated = typos.filter(function (n) {
      if (n.date === null) return false;                      // Undated is the honest answer
      if (n.title.slice(0, 10) === n.date) return false;      // fell through to the filename
      for (var k in n.props) {                                // or to another date field
        if (String(n.props[k]).slice(0, 10) === n.date && core.isIsoDay(n.date)) return false;
      }
      return true;
    });
    return { notes: notes.length, unreal: unreal.length, badKeys: badKeys,
             typos: typos.length, misdated: misdated.map(function (n) { return n.title; }),
             fellThrough: typos.filter(function (n) {
               return n.date !== null && n.title.slice(0, 10) === n.date;
             }).length,
             undated: typos.filter(function (n) { return n.date === null; }).length };
  })()`);
  const ok = r.unreal === 0 && r.badKeys.length === 0 && r.misdated.length === 0;
  return {
    ok,
    detail: r.typos === 0
      ? `no impossible headers in this vault; ${r.notes} notes, every resolved date a real day, ` +
        `every month key inside 01-12`
      : `${r.typos} note(s) with an impossible date header: ${r.fellThrough} fell through to ` +
        `the filename, ${r.undated} are Undated, ${r.misdated.length} landed somewhere else ` +
        `(${r.badKeys.length} out-of-range month keys)`
  };
});

check("a book opens on its oldest note, and the top bar says which end", async (p) => {
  const r = await p.j(`(function(){
    function firstLast(id) {
      __vs.openBook(id, null);
      var t = [].slice.call(document.querySelectorAll("#vs-contents .vs-t"))
        .map(function (e) { return e.textContent; });
      __vs.closeReader();
      return t;
    }
    var months = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0];
    /* Seven at least: five to mark, and a free page past them to turn to. */
    var book = months.books.filter(function (b) {
      return b.key !== "-undated" && b.notes.length >= 7;
    })[0];
    var dates = book.notes.map(function (n) { return n.date || ""; });
    var rising = dates.every(function (d, i) { return i === 0 || dates[i - 1] <= d; });
    var button = document.getElementById("vs-order");
    var before = { label: button.textContent, pressed: button.getAttribute("aria-pressed") };
    var titles = firstLast(book.id);

    button.click();
    var after = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0]
      .books.filter(function (b) { return b.id === book.id; })[0];
    var flipped = after.notes.map(function (n) { return n.date || ""; });
    var falling = flipped.every(function (d, i) { return i === 0 || flipped[i - 1] >= d; });
    var swapped = { label: document.getElementById("vs-order").textContent,
                    pressed: document.getElementById("vs-order").getAttribute("aria-pressed") };
    document.getElementById("vs-order").click();

    /* An Encyclopedia volume is alphabetical either way: "the oldest of the As" is not a
     * thing anybody wants, and design/0015 cuts its tabs by letter on that assumption. */
    var enc = __vs.views().filter(function (v) { return v.shelf.id === "encyclopedia"; })[0];
    var vol = enc.books.filter(function (b) { return b.notes.length > 3; })[0];
    var volTitles = vol.notes.map(function (n) { return n.title.toLowerCase(); });
    var alphabetical = volTitles.every(function (t, i) { return i === 0 || volTitles[i - 1] <= t; });

    return { book: book.key, notes: book.notes.length, rising: rising, falling: falling,
             before: before, swapped: swapped, first: titles[0] || "",
             alphabetical: alphabetical, volume: vol.key };
  })()`);
  const ok = r.rising && r.falling && r.alphabetical &&
             r.before.label === "Oldest first" && r.before.pressed === "false" &&
             r.swapped.label === "Newest first" && r.swapped.pressed === "true";
  return {
    ok,
    detail: `${r.book} holds ${r.notes} notes oldest first (${r.rising}), opening on ` +
            `"${r.first}"; the button reads "${r.before.label}" and flips to ` +
            `"${r.swapped.label}", which reorders the same book newest first (${r.falling}). ` +
            `The ${r.volume} volume stays alphabetical either way: ${r.alphabetical}`
  };
});

check("a note with no date of its own takes the earliest stamp the file has", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var day = 86400000;
    var made = Date.UTC(2019, 4, 17, 9, 0, 0);
    var edited = made + 800 * day;
    return {
      /* The EARLIER of the two: a bulk reformat moves mtime forward, and copying a vault
       * moves ctime forward, so neither alone survives the other. */
      both: core.stampOf(made, edited),
      copied: core.stampOf(edited, made),
      noCreation: core.stampOf(0, edited),
      neither: core.stampOf(0, 0),
      rubbish: core.stampOf(NaN, -1),
      /* And it is still second to anything the note declares. */
      declared: core.resolveDate({ date: "2021-03-04" }, "untitled",
                                 core.stampOf(made, edited), ["date"]),
      fromTitle: core.resolveDate({}, "2020-08-08 a day",
                                  core.stampOf(made, edited), ["date"]),
      fallback: core.resolveDate({}, "untitled", core.stampOf(made, edited), ["date"]),
      off: core.resolveDate({}, "untitled", null, ["date"])
    };
  })()`);
  const ok = r.both === "2019-05-17" && r.copied === "2019-05-17" &&
             r.noCreation !== null && r.neither === null && r.rubbish === null &&
             r.declared === "2021-03-04" && r.fromTitle === "2020-08-08" &&
             r.fallback === "2019-05-17" && r.off === null;
  return {
    ok,
    detail: `created 2019-05-17, edited 800 days later -> ${r.both}, and the same pair the ` +
            `other way round -> ${r.copied}; no creation stamp -> ${r.noCreation}; nothing ` +
            `usable -> ${r.neither}/${r.rubbish}. A declared date still wins ` +
            `(${r.declared}), then the title (${r.fromTitle}), then the stamp ` +
            `(${r.fallback}); with the fallback off it is Undated (${r.off})`
  };
});

check("an ISO week keeps its week-year across a January boundary", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    return {
      jan1_2027: core.isoWeekOf("2027-01-01"),
      dec31_2026: core.isoWeekOf("2026-12-31"),
      jan4_2027: core.isoWeekOf("2027-01-04"),
      range: core.weekRange("2026-W53")
    };
  })()`);
  const ok = r.jan1_2027 === "2026-W53" && r.dec31_2026 === "2026-W53" &&
             r.jan4_2027 === "2027-W01" && r.range.from === "2026-12-28" && r.range.to === "2027-01-03";
  return { ok, detail: `2027-01-01 -> ${r.jan1_2027}, 2027-01-04 -> ${r.jan4_2027}, ` +
                       `2026-W53 spans ${r.range.from}..${r.range.to}` };
});

check("the Encyclopedia opens with a 0-9 volume, not ten one-note books", async (p) => {
  const r = await p.j(`(function(){
    var enc = __vs.views().filter(function (v) { return v.shelf.id === "encyclopedia"; })[0];
    var digits = enc.books.filter(function (b) { return /^[0-9]$/.test(b.key); });
    var volume = enc.books.filter(function (b) { return b.key === "0-9"; })[0];
    return { digits: digits.length, volume: volume ? volume.notes.length : 0, first: enc.books[0].key };
  })()`);
  return { ok: r.digits === 0,
           detail: `${r.digits} single-digit books, 0-9 volume holds ${r.volume}, shelf opens at ${r.first}` };
});

check("year plaques only appear on date classifiers, and only when asked for", async (p) => {
  const r = await p.j(`(function(){
    var out = {};
    __vs.views().forEach(function (v) {
      out[v.shelf.id] = {
        wants: !!v.shelf.plaques,
        has: v.books.filter(function (b) { return b.plaque !== null; }).length
      };
    });
    return out;
  })()`);
  const wrong = Object.entries(r).filter(([, v]) => (v.has > 0) !== v.wants);
  return { ok: wrong.length === 0,
           detail: wrong.length ? wrong.map(([k, v]) => `${k}: wants ${v.wants}, has ${v.has}`).join("; ")
                                : Object.entries(r).map(([k, v]) => `${k} ${v.has}`).join(", ") };
});

check("a plaque sits under the books it names, in the same scroller", async (p) => {
  const r = await p.j(`(function(){
    var group = document.querySelector('[data-shelf="months"] .vs-group');
    if (!group) return { found: false };
    var plaque = group.querySelector(".vs-plaque");
    var books = group.querySelector(".vs-books");
    if (!plaque || !books) return { found: false };
    var pb = plaque.getBoundingClientRect(), bb = books.getBoundingClientRect();
    var rail = group.closest(".vs-shelfrail");
    var app = document.getElementById("vs-app");
    var board = parseFloat(getComputedStyle(app).getPropertyValue("--board")) || 0;
    return { found: true, below: Math.round(pb.top - bb.bottom), board: board,
             sameRail: rail !== null && rail.contains(plaque) && rail.contains(books),
             widthDiff: Math.round(Math.abs(pb.width - bb.width)) };
  })()`);
  if (!r.found) return { ok: false, detail: "no plaqued group on the Months shelf" };
  /* design/0003 -- BELOW THE FLOOR, not merely below the books: the plate is screwed to the
   * front edge of the shelf, not propped against the volumes. The floor is drawn as a
   * background line --board tall directly under the books, so clearing the books by at least
   * that much is the plaque clearing the floor. */
  return { ok: r.below >= r.board && r.sameRail,
           detail: `plaque hangs ${r.below}px below its books, clearing the ${r.board}px ` +
                   `floor; same scroller: ${r.sameRail}; width differs by ${r.widthDiff}px` };
});

/* github#4 -- schema 10 gave every slot its own ribbon. A file from 9 carries one that every
 * book in the library wore, and that was a choice, so it becomes all twelve. */
check("one ribbon from an older schema becomes a ribbon on every colour", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var was = core.migrate({ schema: 9, ribbon: "#b0122b" });
    var none = core.migrate({ schema: 9 });
    var kept = core.migrate({ schema: 10, ribbons: ["#111111", "", "#333333", "", "", "", "", "", "", "", "", ""] });
    var junk = core.migrate({ schema: 10, ribbons: ["nope", 7, null] });
    return {
      schema: core.SETTINGS_SCHEMA,
      spread: was.ribbons.filter(function (c) { return c === "#b0122b"; }).length,
      hadRibbon: "ribbon" in was,
      none: none.ribbons.filter(function (c) { return c; }).length,
      noneLength: none.ribbons.length,
      keptFirst: kept.ribbons[0], keptThird: kept.ribbons[2],
      keptEmpty: kept.ribbons.filter(function (c) { return !c; }).length,
      junkLength: junk.ribbons.length, junkSet: junk.ribbons.filter(function (c) { return c; }).length
    };
  })()`);
  const ok = r.schema === 10 && r.spread === 12 && !r.hadRibbon && r.none === 0 && r.noneLength === 12 &&
             r.keptFirst === "#111111" && r.keptThird === "#333333" && r.keptEmpty === 10 &&
             r.junkLength === 12 && r.junkSet === 0;
  return {
    ok,
    detail: `schema ${r.schema}; one ribbon from 9 becomes ${r.spread} of 12, and the old field is ` +
            `${r.hadRibbon ? "STILL THERE" : "gone"}; a file with none comes up ${r.noneLength} empty; ` +
            `a sparse twelve keeps ${r.keptFirst} and ${r.keptThird} with ${r.keptEmpty} following their dyes; ` +
            `a junk array comes back ${r.junkLength} long with ${r.junkSet} set`
  };
});

check("a settings file from an older schema comes up with the newer defaults", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var old = {
      schema: 1,
      shelves: [
        { id: "years", name: "Years", source: { kind: "all" }, classifier: "year",
          direction: "chronological", hidden: false, position: 0, plaques: false },
        { id: "months", name: "Months", source: { kind: "all" }, classifier: "month",
          direction: "chronological", hidden: false, position: 1, plaques: true },
        { id: "people", name: "People", source: { kind: "all" }, classifier: "person",
          direction: "alphabetical", hidden: false, position: 2, plaques: false }
      ],
      reading: [], wear: { "years/2026": 3 }, dateFields: ["date"],
      peopleFields: ["people"], useFileStamp: false
    };
    var up = core.migrate(old);
    var byId = {};
    up.shelves.forEach(function (s) { byId[s.id] = s; });

    // ...and a file that already says schema 2 keeps whatever it says.
    var chosen = core.clone(old);
    chosen.schema = 2;
    var kept = core.migrate(chosen);
    var keptYears = kept.shelves.filter(function (s) { return s.id === "years"; })[0];

    /* Schema 3 turned the file-stamp fallback on the same way, and for the same reason. A
     * blob that already says 3 keeps whatever it says. */
    var atThree = core.clone(old);
    atThree.schema = 3;
    atThree.useFileStamp = false;

    /* Schema 4 hid the Weeks shelf the same way. A blob already at 4 keeps it shown. */
    var atFour = core.clone(old);
    atFour.schema = 4;
    atFour.shelves.push({ id: "weeks", name: "Weeks", source: { kind: "all" },
      classifier: "week", direction: "chronological", hidden: false, position: 3,
      plaques: true });
    var shown = core.migrate(atFour).shelves
      .filter(function (sh) { return sh.id === "weeks"; })[0];

    var shelvedLook = core.migrate({ schema: 8, shelves: [], look: "cyber" }).look;
    var keptLook = core.migrate({ schema: 8, shelves: [], look: "" }).look;

    return { schema: up.schema, years: byId.years.plaques, months: byId.months.plaques,
             shelvedLook: shelvedLook, keptLook: keptLook,
             people: byId.people.plaques, wear: up.wear["years/2026"],
             fields: up.dateFields.join(","), keptOff: keptYears.plaques,
             stamp: up.useFileStamp, keptStampOff: core.migrate(atThree).useFileStamp,
             order: up.noteOrder,
             lettered: core.migrate({ schema: 5, shelves: [{ id: "people", name: "People",
               source: { kind: "all" }, classifier: "person", direction: "alphabetical",
               hidden: false, position: 0, plaques: false }] }).shelves[0].plaques,
             weeksHidden: core.migrate({ schema: 1, shelves: [{ id: "weeks", name: "Weeks",
               source: { kind: "all" }, classifier: "week", direction: "chronological",
               hidden: false, position: 0, plaques: true }] }).shelves[0].hidden,
             keptShown: shown ? shown.hidden === false : false };
  })()`);
  /* People carries plaques from schema 6 too -- the alphabet is a unit above the book like a
   * decade is (design/0003) -- so the shelf that proves a migration does not touch everything
   * is Months, which asked for plaques before any of this and still has them. */
  const ok = r.schema === 10 && r.years === true && r.months === true && r.people === true &&
             r.wear === 3 && r.fields === "date" && r.keptOff === false &&
             r.stamp === true && r.keptStampOff === false && r.order === "oldest" &&
             r.weeksHidden === true && r.keptShown === true && r.lettered === true &&
             r.shelvedLook === "leather" && r.keptLook === "";
  return {
    ok,
    detail: `schema 1 -> ${r.schema}: Years plaques ${r.years}, Months ${r.months}, People ` +
            `${r.people}; the file-stamp fallback comes up ${r.stamp} and the reading order ` +
            `"${r.order}"; wear and date fields survive (${r.wear} opens, "${r.fields}"). ` +
            `A file already at schema 2 keeps its Years plaques off: ${r.keptOff === false}; ` +
            `one at 3 keeps its stamp fallback off: ${r.keptStampOff === false}; the Weeks ` +
            `shelf comes up hidden (${r.weeksHidden}) unless the file already says 4 ` +
            `(${r.keptShown}); a People shelf written before schema 6 comes up with the ` +
            `alphabet on its plaques (${r.lettered}); a file naming the shelved cyberpunk ` +
            `look comes up in ${r.shelvedLook}, one naming modern keeps it ("${r.keptLook}")`
  };
});

check("years group under decade plaques, and a run that wraps is named on both rows",
      async (p) => {
  const r = await p.j(`(function(){
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0];
    var dated = years.books.filter(function (b) { return b.key !== "-undated"; });
    var wrong = dated.filter(function (b) {
      if (b.plaque === null) return true;
      var start = Number(b.plaque.split("-")[0]);
      var end = Number(b.plaque.split("-")[1]);
      var y = Number(b.key);
      return !(start <= y && y <= end && end - start === 9 && start % 10 === 0);
    }).map(function (b) { return b.key + " under " + b.plaque; });
    var undated = years.books.filter(function (b) { return b.key === "-undated"; });

    // Every row of every shelf: a plaque, if the row has one, names books that are in it.
    var rows = [].slice.call(document.querySelectorAll("#vs-shelves .vs-track"));
    var orphans = 0, plates = 0;
    rows.forEach(function (row) {
      [].slice.call(row.querySelectorAll(".vs-group")).forEach(function (g) {
        var plate = g.querySelector(".vs-plaque");
        if (!plate) return;
        plates++;
        if (!g.querySelector(".vs-spine")) orphans++;
      });
    });
    var names = {};
    [].slice.call(document.querySelectorAll('[data-shelf="years"] .vs-plaque'))
      .forEach(function (el) { names[el.textContent] = (names[el.textContent] || 0) + 1; });
    return { decades: dated.length, wrong: wrong, undatedPlaque: undated.length
               ? undated[0].plaque : null,
             plates: plates, orphans: orphans, drawn: Object.keys(names).sort() };
  })()`);
  const ok = r.wrong.length === 0 && r.undatedPlaque === null && r.orphans === 0;
  return {
    ok,
    detail: `${r.decades} dated year books, all under a decade of their own: ` +
            `${r.wrong.length === 0} (${r.drawn.join(", ") || "none drawn"}); Undated has ` +
            `${r.undatedPlaque === null ? "no plaque" : "a plaque, which is wrong"}; ` +
            `${r.plates} plates across every shelf, ${r.orphans} of them over no books` +
            (r.wrong.length ? " -- " + r.wrong.slice(0, 3).join("; ") : "")
  };
});

check("the index tabs cut the book the way the book is ordered", async (p) => {
  const r = await p.j(`(function(){
    function tabsFor(id) {
      __vs.openBook(id, null);
      var out = [].slice.call(document.querySelectorAll("#vs-tabs button"))
        .map(function (b) { return b.textContent; });
      var titles = [].slice.call(document.querySelectorAll("#vs-contents .vs-t"))
        .map(function (t) { return t.textContent; });
      __vs.closeReader();
      return { tabs: out, titles: titles };
    }
    var enc = __vs.views().filter(function (v) { return v.shelf.id === "encyclopedia"; })[0];
    var biggest = enc.books.filter(function (b) { return b.key !== "0-9" && b.key !== "#"; })
      .sort(function (a, b) { return b.notes.length - a.notes.length; })[0];
    var volume = tabsFor(biggest.id);

    // Alphabetical inside: the contents of a volume are in title order.
    var sorted = volume.titles.slice().sort(function (a, b) {
      var x = a.toLowerCase(), y = b.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
    var ordered = volume.titles.every(function (t, i) { return t === sorted[i]; });

    // A person's book is in date order, so its tabs are dates, not letters.
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    var person = people.books.filter(function (b) { return b.key !== "-unfiled"; })
      .sort(function (a, b) { return b.notes.length - a.notes.length; })[0];
    var theirs = person ? tabsFor(person.id) : { tabs: [], titles: [] };

    /* HOW MANY TABS THE TITLES ADMIT. A volume whose notes all begin with the same word --
     * which generated fixtures do produce -- cannot be cut into more than one, and demanding
     * that it is would be demanding something of the data rather than of the code. */
    var firstWords = {};
    volume.titles.forEach(function (t) {
      var w = /^[\\p{L}\\p{N}]+/u.exec(t.replace(/^[^\\p{L}\\p{N}]+/u, ""));
      firstWords[(w ? w[0] : "").slice(0, 3).toLowerCase()] = true;
    });

    return { key: biggest.key, notes: biggest.notes.length, tabs: volume.tabs,
             ordered: ordered, person: person ? person.key : null,
             possible: Object.keys(firstWords).length,
             personTabs: theirs.tabs, personNotes: person ? person.notes.length : 0 };
  })()`);
  const rising = r.tabs.every((t, i) => i === 0 || r.tabs[i - 1].toLowerCase() <= t.toLowerCase());
  const enough = r.tabs.length >= Math.min(4, r.possible);
  const deep = enough && rising && r.tabs.every((t) => t.indexOf(r.key) === 0);
  const dateish = r.personTabs.every((t) => /^[0-9]|^[A-Z][a-z]{2}$/.test(t));
  const ok = deep && r.ordered && (r.personTabs.length === 0 || dateish);
  return {
    ok,
    detail: `${r.key} holds ${r.notes} notes behind ${r.tabs.length} tabs of the ` +
            `${r.possible} its titles admit ` +
            `(${r.tabs.slice(0, 8).join(" ")}${r.tabs.length > 8 ? " ..." : ""}), all inside ` +
            `${r.key} and in order: ${deep}; its contents are in title order: ${r.ordered}. ` +
            (r.person
              ? `${r.person}'s ${r.personNotes} notes are in date order and tabbed by date: ` +
                `${dateish} (${r.personTabs.slice(0, 6).join(" ")})`
              : "no person book to check")
  };
});

check("a spine's thickness is its note count", async (p) => {
  const r = await p.j(`(function(){
    var rail = document.querySelector('[data-shelf="years"] .vs-track') ||
               document.querySelector(".vs-track");
    var spines = [].slice.call(rail.querySelectorAll(".vs-spine"));
    var read = spines.map(function (b) {
      var n = b.querySelector(".vs-n");
      return { w: parseFloat(getComputedStyle(b).getPropertyValue("--spine-w")),
               n: n ? Number(n.textContent) : 0,
               id: b.getAttribute("data-book") };
    }).filter(function (x) { return x.n > 0 && isFinite(x.w); });
    var byCount = read.slice().sort(function (a, b) { return a.n - b.n; });
    var monotonic = byCount.every(function (x, i) { return i === 0 || x.w >= byCount[i - 1].w; });
    var widest = read.slice().sort(function (a, b) { return b.w - a.w; })[0];
    var fullest = byCount[byCount.length - 1];
    var thinnest = byCount[0];
    return { count: read.length, monotonic: monotonic,
             min: Math.min.apply(null, read.map(function (x) { return x.w; })),
             max: Math.max.apply(null, read.map(function (x) { return x.w; })),
             widest: widest, fullest: fullest, thinnest: thinnest };
  })()`);
  const inBounds = r.min >= 22 && r.max <= 58;
  // The fullest book is AS WIDE AS ANY, not necessarily the unique widest: two counts a few
  // notes apart round to the same pixel, and a tie is not a violation of anything.
  const ok = r.count > 1 && r.monotonic && inBounds && r.fullest.w === r.max;
  return {
    ok,
    detail: `${r.count} spines: ${r.thinnest.n} notes -> ${r.thinnest.w}px, ` +
            `${r.fullest.n} notes -> ${r.fullest.w}px; widths rise with counts: ${r.monotonic}, ` +
            `the fullest book is as wide as any: ${r.fullest.w === r.max}, ` +
            `all within 22-58px: ${inBounds}`
  };
});

check("book addresses are stable across a rebuild", async (p) => {
  const before = await p.j("__vs.addresses()");
  await p.eval("__vs.setFilters({ search: 'zzz-nothing-matches-this' })");
  await p.eval("__vs.setFilters({ search: '' })");
  const after = await p.j("__vs.addresses()");
  const ok = JSON.stringify(before) === JSON.stringify(after);
  return { ok, detail: ok ? `${before.length} addresses unchanged`
                          : `${before.length} -> ${after.length}, first difference at ` +
                            before.findIndex((v, i) => v !== after[i]) };
});

check("a filter changes membership without moving a shelf", async (p) => {
  const r = await p.j(`(function(){
    var before = __vs.counts();
    var order = __vs.views().map(function (v) { return v.shelf.id; });
    return { before: before, order: order };
  })()`);
  const folder = await p.eval("__vs.data().folders[0].path");
  await p.eval(`__vs.setFilters({ folders: [${JSON.stringify(folder)}] })`);
  const after = await p.j(`(function(){
    return { counts: __vs.counts(), order: __vs.views().map(function (v) { return v.shelf.id; }) };
  })()`);
  await p.eval("__vs.setFilters({ folders: [] })");
  const back = await p.j("__vs.counts()");
  const ok = after.counts.filtered < r.before.filtered &&
             JSON.stringify(after.order) === JSON.stringify(r.order) &&
             back.filtered === r.before.filtered;
  return { ok, detail: `${r.before.filtered} -> ${after.counts.filtered} notes under "${folder}", ` +
                       `back to ${back.filtered}; shelf order unchanged: ` +
                       `${JSON.stringify(after.order) === JSON.stringify(r.order)}` };
});

/* design/0018 -- the six that hold the manual shelf up. Every one of them puts the shelf back
 * the way it found it, because the checks in a shard share one page. */

check("a shelf arranged by hand keeps every address and starts where it stood", async (p) => {
  const r = await p.j(`(function(){
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "people"; })[0];
    var was = shelf.direction;
    var before = __vs.sequence("people");
    var addresses = __vs.addresses();
    shelf.direction = "manual";
    __vs.setFilters({});
    var after = __vs.sequence("people");
    var same = __vs.addresses();
    var spines = document.querySelectorAll('[data-shelf="people"] .vs-spine').length;
    var draggable = document.querySelectorAll('[data-shelf="people"] .vs-spine[data-hand="1"]').length;
    var elsewhere = document.querySelectorAll('[data-shelf="tags"] .vs-spine[data-hand="1"]').length;
    var seeded = shelf.order === undefined;
    shelf.direction = was;
    delete shelf.order;
    __vs.setFilters({});
    return { books: before.length, sequence: before.join("|") === after.join("|"),
             addresses: addresses.join("|") === same.join("|"), addressCount: addresses.length,
             spines: spines, draggable: draggable, elsewhere: elsewhere, untouched: seeded };
  })()`);
  const ok = r.books > 2 && r.sequence && r.addresses && r.spines > 0 &&
             r.draggable === r.spines && r.elsewhere === 0 && r.untouched;
  return {
    ok,
    detail: `${r.books} books on People: the sequence is identical to the automatic one ` +
            `(${r.sequence}) and all ${r.addressCount} addresses in the library are unchanged ` +
            `(${r.addresses}); ${r.draggable}/${r.spines} spines became draggable and ` +
            `${r.elsewhere} on the automatic Tags shelf did; nothing was written to order yet: ` +
            `${r.untouched}`
  };
});

check("Alt+Right moves a book one place, and it survives a rebuild and a reload", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "people"; })[0];
    var was = shelf.direction;
    shelf.direction = "manual";
    __vs.setFilters({});
    var before = __vs.sequence("people");
    var spine = document.querySelector('[data-shelf="people"] .vs-spine[data-hand="1"]');
    spine.focus();
    spine.dispatchEvent(new KeyboardEvent("keydown",
      { key: "ArrowRight", altKey: true, bubbles: true }));
    var after = __vs.sequence("people");
    var focused = document.activeElement ? document.activeElement.getAttribute("data-book") : null;
    var stored = (shelf.order || []).slice();
    __vs.setFilters({});
    var rebuilt = __vs.sequence("people");
    var reread = core.migrate(JSON.parse(JSON.stringify(__vs.settings())))
      .shelves.filter(function (s) { return s.id === "people"; })[0].order || [];
    shelf.direction = was;
    delete shelf.order;
    __vs.setFilters({});
    return { books: before.length, head: before.slice(0, 3), moved: after.slice(0, 3),
             swapped: after[0] === before[1] && after[1] === before[0],
             tailKept: after.slice(2).join("|") === before.slice(2).join("|"),
             rebuilt: rebuilt.join("|") === after.join("|"),
             reread: reread.join("|") === stored.join("|"),
             stored: stored.length, focused: focused,
             refocused: focused === "people/" + before[0] };
  })()`);
  const ok = r.books > 2 && r.swapped && r.tailKept && r.rebuilt && r.reread &&
             r.stored === r.books && r.refocused;
  return {
    ok,
    detail: `${r.books} books: ${r.head.join(", ")} -> ${r.moved.join(", ")}; the rest did not ` +
            `move (${r.tailKept}); ${r.stored} keys were saved, the rebuild read back the same ` +
            `sequence (${r.rebuilt}) and so did migrate() over the settings (${r.reread}); ` +
            `focus followed the book to ${r.focused}`
  };
});

check("a drag and drop moves a book the same way a key does, across rows", async (p) => {
  const picked = await p.j(`(function(){
    var best = null;
    __vs.views().forEach(function (v) {
      if (v.shelf.hidden) return;
      if (!best || v.books.length > best.books) best = { id: v.shelf.id, books: v.books.length };
    });
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === best.id; })[0];
    best.was = shelf.direction;
    shelf.direction = "manual";
    __vs.setFilters({});
    var section = document.querySelector('[data-shelf="' + best.id + '"]');
    section.scrollIntoView(true);
    best.rows = section.querySelectorAll(".vs-track").length;
    return best;
  })()`);
  await sleep(300);
  const r = await p.j(`(function(){
    var id = ${JSON.stringify(picked.id)};
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === id; })[0];
    var before = __vs.sequence(id);
    var spines = [].slice.call(
      document.querySelectorAll('[data-shelf="' + id + '"] .vs-spine[data-hand="1"]'));
    var from = spines[0];
    var onto = spines[spines.length - 1];
    var sameRow = from.closest(".vs-track") === onto.closest(".vs-track");
    var dt = new DataTransfer();
    from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    var carried = dt.getData("text/plain");
    var box = onto.getBoundingClientRect();
    var at = { bubbles: true, cancelable: true, dataTransfer: dt,
               clientX: box.left + box.width - 2, clientY: box.top + 4 };
    onto.dispatchEvent(new DragEvent("dragover", at));
    var mark = onto.getAttribute("data-drop");
    var bar = onto.querySelector(".vs-drop");
    /* The mark is an ELEMENT because both opt-in looks already own the spine's ::before and
     * ::after (design/0018), so what is measured here is a real box in the document. */
    var painted = bar ? Math.round(bar.getBoundingClientRect().width) : 0;
    var side = bar ? bar.getAttribute("data-side") : null;
    var lifted = from.getAttribute("data-dragging");
    onto.dispatchEvent(new DragEvent("drop", at));
    var after = __vs.sequence(id);
    var marksLeft = document.querySelectorAll('[data-shelf="' + id + '"] .vs-drop').length +
                    document.querySelectorAll('[data-shelf="' + id + '"] [data-drop]').length;
    shelf.direction = ${JSON.stringify(picked.was)};
    delete shelf.order;
    __vs.setFilters({});
    return { books: before.length, spines: spines.length, sameRow: sameRow, mark: mark,
             painted: painted, side: side, lifted: lifted, carried: carried,
             marksLeft: marksLeft,
             wanted: before.slice(1).concat([before[0]]).join("|") === after.join("|"),
             head: after.slice(0, 2), last: after[after.length - 1] };
  })()`);
  const ok = r.wanted && r.mark === "after" && r.side === "after" && r.painted === 3 &&
             r.lifted === "1" && r.marksLeft === 0 && r.carried === picked.id + "/" + r.last;
  return {
    ok,
    detail: `${picked.id}: ${r.books} books over ${picked.rows} row(s); dragging the first onto ` +
            `the last (a different row: ${!r.sameRow}) drew a "${r.mark}" mark ${r.painted}px ` +
            `wide and left it at the end (${r.wanted}); the shelf now opens ${r.head.join(", ")}; ` +
            `the payload was the address ${r.carried}; ${r.marksLeft} marks left behind`
  };
});

check("the reading order in the top bar leaves an arranged shelf alone", async (p) => {
  const r = await p.j(`(function(){
    var shelves = __vs.settings().shelves;
    var years = shelves.filter(function (s) { return s.id === "years"; })[0];
    var was = years.direction;
    years.direction = "manual";
    years.order = __vs.sequence("years").slice().reverse();
    __vs.setFilters({});
    var before = __vs.sequence("years");
    var autoBefore = __vs.sequence("months");
    var button = document.getElementById("vs-order");
    var said = button.textContent;
    button.click();
    var then = button.textContent;
    var after = __vs.sequence("years");
    var autoAfter = __vs.sequence("months");
    button.click();
    var back = __vs.sequence("years");
    years.direction = was;
    delete years.order;
    __vs.setFilters({});
    return { books: before.length, months: autoBefore.length, said: said, then: then,
             held: before.join("|") === after.join("|") && before.join("|") === back.join("|"),
             autoTurned: autoBefore.join("|") !== autoAfter.join("|"),
             head: before.slice(0, 2) };
  })()`);
  const control = r.months < 2 || r.autoTurned;
  return {
    ok: r.books > 1 && r.held && control,
    detail: `${r.books} year books arranged by hand, opening ${r.head.join(", ")}: "${r.said}" ` +
            `-> "${r.then}" and back left the sequence untouched (${r.held}), while the ` +
            `automatic Months shelf of ${r.months} books did turn round (${r.autoTurned})`
  };
});

check("a book nobody has arranged stands at the end of the shelf", async (p) => {
  const r = await p.j(`(function(){
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "people"; })[0];
    var was = shelf.direction;
    var auto = __vs.sequence("people");
    shelf.direction = "manual";
    /* The first book's key is left out, which is what a note that arrived after the shelf was
     * arranged looks like from here. */
    shelf.order = auto.slice(1);
    __vs.setFilters({});
    var after = __vs.sequence("people");
    var addresses = __vs.addresses().filter(function (a) { return a.indexOf("people/") === 0; });
    shelf.direction = was;
    delete shelf.order;
    __vs.setFilters({});
    return { books: auto.length, newcomer: auto[0], last: after[after.length - 1],
             kept: after.length === auto.length,
             rest: after.slice(0, -1).join("|") === auto.slice(1).join("|"),
             addresses: addresses.length };
  })()`);
  return {
    ok: r.books > 2 && r.kept && r.rest && r.last === r.newcomer,
    detail: `${r.books} books, ${r.books - 1} of them named in the sequence: the unnamed ` +
            `"${r.newcomer}" stands last (${r.last === r.newcomer}), the named ones keep their ` +
            `order (${r.rest}), and all ${r.addresses} addresses are still there (${r.kept})`
  };
});

check("a filter narrows an arranged shelf without shuffling it", async (p) => {
  /* THE SMALLEST FOLDER, not the first one: the first is usually the one holding most of the
   * vault, and a filter that removes nothing proves nothing about what survives it. */
  const folder = await p.eval(`__vs.data().folders.slice().sort(function (a, b) {
    return a.count - b.count;
  })[0].path`);
  const r = await p.j(`(function(){
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "people"; })[0];
    var was = shelf.direction;
    shelf.direction = "manual";
    shelf.order = __vs.sequence("people").slice().reverse();
    __vs.setFilters({});
    var full = __vs.sequence("people");
    __vs.setFilters({ folders: [${JSON.stringify(folder)}] });
    var narrow = __vs.sequence("people");
    var at = -1, ordered = true;
    narrow.forEach(function (k) {
      var i = full.indexOf(k);
      if (i <= at) ordered = false;
      at = i;
    });
    __vs.setFilters({ folders: [] });
    var back = __vs.sequence("people");
    shelf.direction = was;
    delete shelf.order;
    __vs.setFilters({});
    return { full: full.length, narrow: narrow.length, ordered: ordered,
             back: back.join("|") === full.join("|"), head: full.slice(0, 2) };
  })()`);
  return {
    ok: r.full > 1 && r.narrow > 0 && r.narrow <= r.full && r.ordered && r.back,
    detail: `an arranged People shelf opening ${r.head.join(", ")}: ${r.full} books narrow to ` +
            `${r.narrow} under "${folder}" and every one of them is still in the arranged order ` +
            `(${r.ordered}); clearing the filter puts all ${r.full} back in it (${r.back})`
  };
});

check("a hidden shelf keeps its definition and its books", async (p) => {
  const r = await p.j(`(function(){
    var before = __vs.counts();
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "tags"; })[0];
    shelf.hidden = true;
    __vs.setFilters({});
    var during = __vs.counts();
    var stillBuilt = __vs.views().filter(function (v) { return v.shelf.id === "tags"; })[0].books.length;
    shelf.hidden = false;
    __vs.setFilters({});
    return { before: before, during: during, stillBuilt: stillBuilt, after: __vs.counts() };
  })()`);
  const ok = r.during.visible === r.before.visible - 1 && r.stillBuilt > 0 &&
             r.after.visible === r.before.visible;
  return { ok, detail: `${r.before.visible} visible -> ${r.during.visible} hidden -> ` +
                       `${r.after.visible} restored; the hidden shelf still held ${r.stillBuilt} books` };
});

check("hiding every shelf offers a way back rather than an empty room", async (p) => {
  const r = await p.j(`(function(){
    __vs.settings().shelves.forEach(function (s) { s.hidden = true; });
    __vs.setFilters({});
    var card = document.getElementById("vs-endcard");
    var shown = card && !card.hidden;
    var out = { card: !!shown, button: shown ? !!card.querySelector("button") : false,
                spines: document.querySelectorAll("#vs-shelves .vs-spine").length };
    __vs.settings().shelves.forEach(function (s) { s.hidden = false; });
    __vs.setFilters({});
    out.restored = document.querySelectorAll("#vs-shelves .vs-spine").length;
    return out;
  })()`);
  return { ok: r.card && r.button && r.spines === 0 && r.restored > 0,
           detail: `recovery card: ${r.card}, its button: ${r.button}, ${r.spines} spines while ` +
                   `hidden, ${r.restored} after restoring` };
});

/* A check that reads the `hidden` ATTRIBUTE is not a check that anything is hidden. The
 * reader and both sheets are laid out by a class, which outranks the user agent's
 * `[hidden] { display: none }`, so all three painted over the library while every
 * attribute-reading check passed. This reads the computed style instead. */
/* design/0009 -- the room is the surface. There is no sidebar to check any more; what has to
 * be true is that everything the sidebar used to carry is still reachable. */
check("the library is the whole surface, with no sidebar", async (p) => {
  const r = await p.j(`(function(){
    var c = __vs.counts();
    return { jump: c.jump, newshelf: c.newshelf, spines: c.spines,
             sidebars: document.querySelectorAll("#vs-app aside").length,
             railChildren: document.querySelectorAll("#vs-rail .vs-inner > *").length,
             search: !!document.getElementById("vs-q"),
             topFirst: (function(){
               var lib = document.getElementById("vs-library");
               var adds = lib.querySelectorAll(".vs-newshelf");
               if (adds.length !== 2) return false;
               var shelves = document.getElementById("vs-shelves");
               return lib.firstElementChild !== shelves &&
                      adds[0].compareDocumentPosition(shelves) === 4 &&
                      shelves.compareDocumentPosition(adds[1]) === 4;
             })() };
  })()`);
  return { ok: r.sidebars === 0 && r.newshelf === 2 && r.topFirst && r.jump > 0 && r.search,
           detail: `${r.sidebars} sidebars, ${r.jump} shelves in the jump rail, ` +
                   `${r.newshelf} New shelf buttons bracketing the scroll (in order: ` +
                   `${r.topFirst}), ${r.spines} spines` };
});

/* design/0005 -- the twelve slots are Vault Graph's. This reads what the cascade actually
 * resolved rather than what a comment claims, because a comment claiming parity is exactly
 * what was wrong before: the slots were twelve invented pastels and nobody had opened the
 * other project's stylesheet. */
check("the twelve colour slots are Vault Graph's own", async (p) => {
  const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#008300", "#d3006e",
                 "#4a3aa7", "#e34948", "#00aecb", "#9412ad", "#6f6e67", "#45443f"];
  const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#008300", "#eb1580",
                "#9085e9", "#e66767", "#009fbb", "#b429d1", "#8d8c84", "#bdbcb2"];
  const r = await p.j(`(function(){
    /* design/0016 -- THESE TWELVE ARE THE MODERN LOOK'S, and a fresh library now opens in
     * leather, whose dyes are its own. So the look is chosen before the palette is read: the
     * twelve slots a look shows are checked by the look check, and what this one is about is
     * the paint the page follows the host's theme with. */
    var sel = document.getElementById("vs-look");
    sel.value = "";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    __vs.setTheme("light");
    var light = __vs.slots();
    __vs.setTheme("dark");
    var dark = __vs.slots();
    /* design/0005 -- read a binding, including the matching encyclopedia set. */
    var spine = document.querySelector("#vs-shelves .vs-spine");
    var tint = spine ? getComputedStyle(spine).getPropertyValue("--spine-tint").trim() : "";
    return { light: light, dark: dark, painted: tint,
             inSlots: dark.map(function (v) { return v.toLowerCase(); })
                          .indexOf(tint.toLowerCase()) >= 0 };
  })()`);
  const same = (a, b) => JSON.stringify(a.map((v) => v.toLowerCase())) === JSON.stringify(b);
  const ok = same(r.light, LIGHT) && same(r.dark, DARK) && r.inSlots;
  return { ok,
           detail: ok
             ? `all twelve match in both themes (light g1 ${r.light[0]}, dark g1 ${r.dark[0]}); ` +
               `a spine's board is dyed ${r.painted}, which is one of the twelve`
             : same(r.light, LIGHT) && same(r.dark, DARK)
               ? `the twelve match, but a spine is tinted "${r.painted}", which is not one of them`
               : `light ${r.light.slice(0, 3).join(",")} dark ${r.dark.slice(0, 3).join(",")}` };
});

check("the theme follows the host, and the slots are re-read when it changes", async (p) => {
  const r = await p.j(`(function(){
    /* design/0016 -- THESE TWELVE ARE THE MODERN LOOK'S, and a fresh library now opens in
     * leather, whose dyes are its own. So the look is chosen before the palette is read: the
     * twelve slots a look shows are checked by the look check, and what this one is about is
     * the paint the page follows the host's theme with. */
    var sel = document.getElementById("vs-look");
    sel.value = "";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    __vs.setTheme("light");
    var lightBg = getComputedStyle(document.getElementById("vs-app")).backgroundColor;
    var lightSlots = __vs.slots().join(",");
    var lightCounts = __vs.counts();
    __vs.setTheme("dark");
    var darkBg = getComputedStyle(document.getElementById("vs-app")).backgroundColor;
    var darkSlots = __vs.slots().join(",");
    var darkCounts = __vs.counts();
    return { lightBg: lightBg, darkBg: darkBg,
             slotsChanged: lightSlots !== darkSlots,
             same: JSON.stringify(lightCounts) === JSON.stringify(darkCounts) };
  })()`);
  return { ok: r.lightBg !== r.darkBg && r.slotsChanged && r.same,
           detail: `ground ${r.lightBg} vs ${r.darkBg}; the slots were re-read ` +
                   `(${r.slotsChanged}); the library is identical in both (${r.same})` };
});

/* design/0005 -- colours belong to stable book addresses, never changing note counts. */
const bookCount = (joined) => (joined ? joined.split("|").length : 0);

/* design/0016, design/0017 -- A LOOK IS PAINT. Each look is a stylesheet and a setting; it may
 * repaint anything and it may move nothing.
 *
 * IT WALKS core.LOOKS RATHER THAN A LIST OF ITS OWN, so a fourth look is covered the day it is
 * added instead of the day somebody remembers to widen this. And it drives the top bar's
 * `<select>` rather than poking the attribute, so what is measured is the path a person takes:
 * the selector is the only control either host offers.
 */
check("a look is opt-in, repaints everything and moves nothing", async (p) => {
  const r = await p.j(`(function(){
    var root = document.getElementById("vs-app");
    var sel = document.getElementById("vs-look");
    var spine = function () { return document.querySelector("#vs-shelves .vs-spine"); };
    var read = function () {
      var cs = getComputedStyle(spine());
      var tint = (cs.getPropertyValue("--spine-tint") || "").trim();
      var counts = __vs.counts();
      delete counts.plaques;
      return { look: root.getAttribute("data-look"),
               height: spine().getBoundingClientRect().height,
               width: spine().getBoundingClientRect().width,
               room: document.querySelector("#vs-shelves .vs-track").clientWidth,
               /* THE GROUND IS WHATEVER PAINTS IT. A look that lays its room down as a
                * gradient leaves backgroundColor transparent, so reading only the colour
                * says two looks are identical when they could not look less alike. */
               ground: getComputedStyle(root).backgroundColor + " | " +
                       getComputedStyle(root).backgroundImage.slice(0, 90),
               dye: cs.backgroundColor,
               tint: tint,
               /* design/0005 -- the dye a person LOOKS AT has to be one of the twelve the
                * cascade currently resolves. Comparing only the mixed backgroundColor cannot
                * see a stale one: --tint and --surface-2 move with the look too, so a spine
                * still carrying the previous look's hex reports a different colour and passes. */
               tintIsASlot: !tint || __vs.slots().indexOf(tint) >= 0,
               slots: __vs.slots().join(","),
               addresses: __vs.addresses().join("|"),
               counts: JSON.stringify(counts) };
    };
    /* design/0016 -- EVERY look core offers, through the control a person uses. The selector
     * is built from core.LOOKS, so a look added there is checked here without editing this. */
    var offered = [].slice.call(sel.options).map(function (o) { return o.value; });
    /* design/0017 -- A SHELVED LOOK IS STILL MEASURED. The selector lists only the offered
     * looks, so a shelved one is painted through the handle instead; it has to keep every law
     * a look keeps, or the redesign starts from a broken sheet. */
    var pick = function (value) {
      if (offered.indexOf(value) >= 0) {
        sel.value = value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        __vs.setLook(value);
      }
      return read();
    };
    var core = window.VaultShelfCore;
    var known = core.LOOKS.map(function (l) { return l.value; });
    var shelved = core.LOOKS.filter(function (l) { return l.shelved; }).map(function (l) { return l.value; });
    var start = read();
    var seen = known.map(function (v) { return { value: v, state: pick(v) }; });
    var back = pick("");
    return { offered: offered, shelved: shelved, start: start, seen: seen, back: back };
  })()`);

  /* The MODERN look is the yardstick, not the first in the list: leather is what a fresh
   * library opens in now, and the list is ordered for a person rather than for this check. */
  const base = r.seen.find((s) => s.value === "");
  const looks = r.seen.filter((s) => s.value !== "");
  /* THE ADDRESSES AND THE COUNTS ARE THE LAW, and they are compared against the default look's
   * own reading rather than pairwise, so one look drifting is one failure and not two. */
  const moved = r.seen.filter((s) => s.state.addresses !== base.state.addresses ||
                                     s.state.counts !== base.state.counts);
  /* Each look must differ from the DEFAULT and from EVERY OTHER look: two looks that resolve to
   * the same ground and the same twelve slots are one look shipped twice. */
  const paint = (s) => s.state.ground + "|" + s.state.slots + "|" + s.state.dye;
  const flat = looks.filter((s) => paint(s) === paint(base));
  const twins = looks.filter((s, i) => looks.some((o, j) => j < i && paint(o) === paint(s)));
  const named = r.seen.every((s) => s.state.look === s.value);
  const stale = r.seen.filter((s) => !s.state.tintIsASlot);
  const restored = r.back.look === "" && r.back.dye === base.state.dye &&
                   r.back.slots === base.state.slots && r.back.ground === base.state.ground;
  /* A LOOK MAY NOT MOVE A BOOK. Leather used to zoom the whole page 20%, which is the type --
   * and also the spines, the shelf width, and how many books fit in a row, so every book
   * jumped when you switched. A spine's size is a measurement of the book (design/0011); the
   * paint has no opinion about it. Readability is bought with type size alone now. */
  const sameSize = looks.every((s) => Math.abs(s.state.height - base.state.height) < 0.6 &&
                                      Math.abs(s.state.width - base.state.width) < 0.6);
  const sameRoom = looks.every((s) => Math.abs(s.state.room - base.state.room) < 1);
  /* The selector offers every look that is not shelved and none that is (design/0017). */
  const listed = r.seen.map((s) => s.value).filter((v) => !r.shelved.includes(v));
  const offersRight = r.offered.join("|") === listed.join("|");
  const ok = r.offered.length >= 2 && offersRight && named &&
             sameSize && sameRoom &&
             !moved.length && !flat.length && !twins.length && !stale.length && restored;
  return { ok,
           detail: `the selector offers ${r.offered.length} of ${r.seen.length} looks ` +
                   `(${r.offered.map((v) => v || "default").join(", ")}; shelved: ` +
                   `${r.shelved.join(", ") || "none"}) (${offersRight}); each set data-look ` +
                   `to its own value (${named}); ` +
                   looks.map((s) => `${s.value} dyes the first spine ${s.state.dye}`).join(", ") +
                   ` against the default's ${base.state.dye}; ` +
                   `${bookCount(base.state.addresses)} book addresses and every count ` +
                   `identical in all ${r.seen.length} (${!moved.length}` +
                   (moved.length ? `; moved under ${moved.map((s) => s.value).join(", ")}` : "") +
                   `); no look is a twin of another (${!twins.length}); every spine carries a ` +
                   `live slot (${!stale.length}); a book is the same size in all of them ` +
                   `(${sameSize}: ${base.state.width.toFixed(0)}x` +
                   `${base.state.height.toFixed(0)}) in a room of the same width ` +
                   `(${sameRoom}: ${base.state.room.toFixed(0)}px); back to the first look ` +
                   `unchanged (${restored})` };
});

/* design/0016 -- A LOOK MAY NOT RESIZE A CONTROL EITHER. Every button, box, tab, ribbon,
 * swatch and switch is measured in every look core knows, against the modern look's reading:
 * the same height everywhere, and the same width wherever the width is not the text's to
 * decide. "Some seem off" was the complaint, and a list of numbers is how it stops being a
 * feeling. Reads laid-out boxes, so it runs in the serial lane ("same size"). */
check("every control is the same size in every look", async (p) => {
  const r = await p.j(`(function(){
    var looks = window.VaultShelfCore.LOOKS.map(function (l) { return l.value; });
    var q = function (sel) { return document.querySelector(sel); };
    var box = function (sel) {
      var e = q(sel);
      if (!e) return null;
      var b = e.getBoundingClientRect();
      return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
    };
    /* [selector, widthMatters]. A width follows its text unless the rule fixes it. */
    var library = [
      ["#vs-q", true], ["#vs-order", true], ["#vs-look", false], ["#vs-manageopen", false],
      ["#vs-jump .vs-jump", false], ["#vs-rail", true], ["#vs-newshelf", true],
      ["#vs-shelves .vs-shelfhead", true], ["#vs-shelves .vs-plaque", false],
      ["#vs-shelves .vs-spine", true]
    ];
    var reading = [
      [".vs-readerbar", true], ["#vs-back", false], ["#vs-prevcollection", false],
      ["#vs-prevnote", false], ["#vs-nextnote", false], ["#vs-within", true],
      ["#vs-tabs button", false], ["#vs-contents button", true], ["#vs-marks", true],
      ["#vs-marks .vs-mark", false], ["#vs-marks .vs-markstub", true], [".vs-spread", true],
      [".vs-alsoin button", false]
    ];
    var managing = [
      ["#vs-managelist .vs-managerow", true], ["#vs-managelist .vs-managerow button", false],
      ["#vs-managelist .vs-toggle[data-fact=shown] .vs-knob", true],
      ["#vs-managelist .vs-toggle[data-fact=vary] .vs-knob", true], ["#vs-mclose", false],
      ["#vs-mpalette .vs-swatch", true], ["#vs-mpalette .vs-slotreset", true],
      ["#vs-mpalette .vs-ribbonswatch", true], ["#vs-mpalette .vs-dyerows", true],
      ["#vs-mpalettereset", false]
    ];
    var building = [
      ["#vs-bname", true], ["#vs-bsource", true], ["#vs-bclassifier", true],
      ["#vs-bdirection", false], ["#vs-bsave", false]
    ];
    var dyeing = [["#vs-dye .vs-swatch", true]];
    var out = {};
    var book = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0].books[0];
    looks.forEach(function (look) {
      __vs.setLook(look);
      var row = {};
      library.forEach(function (c) { row[c[0]] = { fixed: c[1], box: box(c[0]) }; });
      __vs.openBook(book.id, null);
      /* A ribbon on this page, so a ribbon and the stub are both measured. */
      var stub = q("#vs-marks .vs-markstub");
      if (stub) stub.click();
      reading.forEach(function (c) { row[c[0]] = { fixed: c[1], box: box(c[0]) }; });
      var mark = q("#vs-marks .vs-mark");
      if (mark) mark.click();
      __vs.closeReader();
      document.getElementById("vs-manageopen").click();
      /* One slot changed, so the slot's own reset mark is on the sheet to be measured. */
      var slot = q('#vs-mpalette .vs-dyerows input[type="color"]');
      slot.value = "#3355aa";
      slot.dispatchEvent(new Event("change", { bubbles: true }));
      managing.forEach(function (c) { row[c[0]] = { fixed: c[1], box: box(c[0]) }; });
      document.getElementById("vs-mpalettereset").click();
      document.getElementById("vs-mclose").click();
      document.getElementById("vs-newshelf").click();
      building.forEach(function (c) { row[c[0]] = { fixed: c[1], box: box(c[0]) }; });
      document.getElementById("vs-bcancel").click();
      var spine = q('[data-book="' + book.id + '"]');
      spine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
                                                          clientX: 300, clientY: 300 }));
      dyeing.forEach(function (c) { row[c[0]] = { fixed: c[1], box: box(c[0]) }; });
      document.body.click();
      document.getElementById("vs-dye").hidden = true;
      out[look || "modern"] = row;
    });
    __vs.setLook(looks[0]);
    return out;
  })()`);
  const base = r.modern;
  const names = Object.keys(base);
  const off = [];
  Object.keys(r).filter((l) => l !== "modern").forEach((look) => {
    names.forEach((n) => {
      const a = base[n], b = r[look][n];
      if (!a.box || !b.box) { if (!!a.box !== !!b.box) off.push(`${look} ${n}: missing`); return; }
      const dh = Math.abs(a.box.h - b.box.h), dw = Math.abs(a.box.w - b.box.w);
      if (dh > 1 || (a.fixed && dw > 1)) {
        off.push(`${look} ${n}: ${b.box.w}x${b.box.h} vs ${a.box.w}x${a.box.h}`);
      }
    });
  });
  const measured = names.filter((n) => base[n].box).length;
  return {
    ok: off.length === 0 && measured >= 34,
    detail: `${measured} controls measured in ${Object.keys(r).length} looks against modern ` +
            `(search ${base["#vs-q"].box.w}x${base["#vs-q"].box.h}, button ` +
            `${base["#vs-manageopen"].box.w}x${base["#vs-manageopen"].box.h}, tab ` +
            `${base["#vs-tabs button"].box ? base["#vs-tabs button"].box.h : "-"} high, ribbon ` +
            `${base["#vs-marks .vs-mark"].box ? base["#vs-marks .vs-mark"].box.h : "-"} high, ` +
            `swatch ${base["#vs-dye .vs-swatch"].box ? base["#vs-dye .vs-swatch"].box.w : "-"}` +
            ` wide, palette slot ${base["#vs-mpalette .vs-swatch"].box ? base["#vs-mpalette .vs-swatch"].box.w + "x" + base["#vs-mpalette .vs-swatch"].box.h : "-"}, ` +
            `dropdown ${base["#vs-bsource"].box ? base["#vs-bsource"].box.h : "-"} high); ${off.length} off by more than a pixel` +
            (off.length ? `: ${off.join("; ")}` : "")
  };
});

/* github#2 -- the report came from inside Obsidian, whose app.css styles every `select`, and
 * the suite runs the standalone where none of that exists. So the host's rule is put into the
 * page here, copied out of app.css: what it sets and a rule of ours leaves alone is what a
 * dropdown in the plugin would wear. */
check("every dropdown paints itself, whatever the host says a select is", async (p) => {
  const r = await p.j(`(function(){
    var looks = window.VaultShelfCore.LOOKS.map(function (l) { return l.value; });
    var q = function (sel) { return document.querySelector(sel); };
    var height = function (sel) { var e = q(sel); return e ? Math.round(e.getBoundingClientRect().height * 10) / 10 : null; };
    var probe = document.createElement("span");
    document.body.appendChild(probe);
    var rgb = function (c) { probe.style.color = ""; probe.style.color = c; return getComputedStyle(probe).color; };
    var lum = function (c) {
      var m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c);
      return m ? Math.round((0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 2.55) / 100 : -1;
    };
    var shown = function (e) { return e.getClientRects().length > 0; };
    var read = function (e) {
      var cs = getComputedStyle(e);
      var want = cs.getPropertyValue("--vs-field").trim();
      return {
        id: e.id || e.className || e.tagName, sheet: !!e.closest(".vs-sheetbody, .vs-page"),
        field: cs.backgroundColor, want: rgb(want), ink: cs.color, appearance: cs.appearance,
        chevron: cs.backgroundImage.indexOf("data:image/svg+xml") >= 0 && cs.backgroundImage.indexOf("gradient") < 0,
        h: Math.round(e.getBoundingClientRect().height * 10) / 10,
        leaked: cs.backgroundColor === "rgb(32, 32, 32)" || cs.boxShadow.indexOf("255, 0, 0") >= 0 ||
                cs.backgroundImage.indexOf("gradient") >= 0 || cs.borderTopWidth === "0px" ||
                cs.paddingLeft === "10px"
      };
    };
    /* The two boxes the host could resize, measured before its rule is in the page. */
    document.getElementById("vs-newshelf").click();
    var before = { look: height("#vs-look"), source: height("#vs-bsource") };
    document.getElementById("vs-bcancel").click();

    var host = document.createElement("style");
    host.textContent = "select { -webkit-appearance: none; appearance: none; height: 40px; " +
      "padding: 0 30px 0 10px; border: 0; box-shadow: 0 0 0 2px #ff0000; color: #dadada; " +
      "background-color: #202020; " +
      "background-image: linear-gradient(#ff0000, #ff0000), linear-gradient(#00ff00, #00ff00); " +
      "background-repeat: no-repeat, no-repeat; background-position: right 8px top 50%, right 0.15em top 50%; " +
      "background-size: 10px auto, 2em 2em; background-blend-mode: hard-light, normal; }";
    document.head.insertBefore(host, document.head.firstChild);

    var was = document.querySelector(".vault-shelf").getAttribute("data-look") || "";
    var out = { before: before, looks: {} };
    looks.forEach(function (look) {
      __vs.setLook(look);
      document.getElementById("vs-newshelf").click();
      document.getElementById("vs-manageopen").click();
      var selects = [].slice.call(document.querySelectorAll(".vault-shelf select")).filter(shown).map(read);
      var boxes = [].slice.call(document.querySelectorAll('.vault-shelf input[type="search"], .vault-shelf input[type="text"]'))
        .filter(shown).map(read);
      document.getElementById("vs-mclose").click();
      document.getElementById("vs-bcancel").click();
      __vs.openBook(__vs.addresses()[0], null);
      var within = read(q("#vs-within"));
      __vs.closeReader();
      out.looks[look || "modern"] = { selects: selects, boxes: boxes, within: within,
                                      after: { look: height("#vs-look") } };
    });
    __vs.setLook(was);
    document.getElementById("vs-newshelf").click();
    out.after = { look: height("#vs-look"), source: height("#vs-bsource") };
    document.getElementById("vs-bcancel").click();
    host.remove();
    probe.remove();
    out.lum = {};
    Object.keys(out.looks).forEach(function (k) {
      out.looks[k].selects.forEach(function (x) { x.lumField = lum(x.field); x.lumInk = lum(x.ink); });
      out.looks[k].boxes.forEach(function (x) { x.lumField = lum(x.field); x.lumInk = lum(x.ink); });
      out.looks[k].within.lumField = lum(out.looks[k].within.field);
    });
    return out;
  })()`);
  const wrong = [];
  let selects = 0, boxes = 0;
  Object.keys(r.looks).forEach((look) => {
    const L = r.looks[look];
    L.selects.forEach((x) => {
      selects++;
      if (x.field !== x.want) wrong.push(`${look} ${x.id} field ${x.field}, wanted ${x.want}`);
      if (x.appearance !== "none") wrong.push(`${look} ${x.id} appearance ${x.appearance}`);
      if (!x.chevron) wrong.push(`${look} ${x.id} no drawn chevron`);
      if (x.leaked) wrong.push(`${look} ${x.id} wears the host's rule`);
    });
    L.boxes.forEach((x) => {
      boxes++;
      if (x.field !== x.want) wrong.push(`${look} ${x.id} box field ${x.field}, wanted ${x.want}`);
    });
    if (look === "leather") {
      /* Paper is paper: a box on the sheet is light with dark ink; one in the rail is dark. */
      L.selects.concat(L.boxes).forEach((x) => {
        if (x.sheet && !(x.lumField > 0.8 && x.lumInk < 0.4)) wrong.push(`leather ${x.id} on paper reads ${x.field} / ${x.ink}`);
        if (!x.sheet && !(x.lumField < 0.3 && x.lumInk > 0.6)) wrong.push(`leather ${x.id} in the rail reads ${x.field} / ${x.ink}`);
      });
      if (!(L.within.lumField > 0.8)) wrong.push(`leather #vs-within on the page reads ${L.within.field}`);
    }
  });
  const moved = Math.abs(r.before.look - r.after.look) > 1 || Math.abs(r.before.source - r.after.source) > 1;
  if (moved) wrong.push(`the host's rule moved a box: #vs-look ${r.before.look} -> ${r.after.look}, #vs-bsource ${r.before.source} -> ${r.after.source}`);
  const leather = r.looks.leather;
  const paper = leather ? leather.selects.filter((x) => x.sheet)[0] : null;
  const rail = leather ? leather.selects.filter((x) => !x.sheet)[0] : null;
  return {
    ok: wrong.length === 0 && selects >= 12 && boxes >= 6,
    detail: `${selects} dropdowns and ${boxes} boxes under ${Object.keys(r.looks).length} looks with Obsidian's select rule ` +
            `in the page: every field the look's own, appearance none, a drawn chevron; ` +
            `leather paper ${paper ? paper.field + " / " + paper.ink : "-"}, leather rail ` +
            `${rail ? rail.field + " / " + rail.ink : "-"}; #vs-look ${r.before.look} -> ${r.after.look} high, ` +
            `the builder's ${r.before.source} -> ${r.after.source}; ${wrong.length} wrong` +
            (wrong.length ? `: ${wrong.slice(0, 6).join("; ")}` : "")
  };
});

/* design/0008 -- MAGIC 1. A book you open often looks handled. */
check("a book's colour is the person's, then the shelf's, then the folder's", async (p) => {
  const r = await p.j(`(function(){
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0];
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    var tint = function (id) {
      var el = document.querySelector('[data-book="' + id + '"]');
      return el ? el.style.getPropertyValue("--spine-tint").trim() : "";
    };
    var slots = __vs.slots();

    /* 3. by default a book wears its dominant folder's dye, which is one of the twelve. */
    var book = years.books[0];
    var byFolder = tint(book.id);
    var folderSlot = slots.indexOf(byFolder);

    /* 1. a right-click gives it one of the twelve, which it keeps across a rebuild. */
    var spine = document.querySelector('[data-book="' + book.id + '"]');
    spine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
                                                        clientX: 300, clientY: 300 }));
    var menu = document.getElementById("vs-dye");
    var opened = !menu.hidden;
    var swatches = menu.querySelectorAll(".vs-swatch").length;
    /* PAINTED, not just present: under leather the look's own button rule outranked the
     * swatch rule and twelve colourless buttons opened, which every previous assertion here
     * passed. The swatch's computed background has to be its slot's colour. */
    var probe = document.createElement("span");
    document.body.appendChild(probe);
    var painted = [].slice.call(menu.querySelectorAll(".vs-swatch")).filter(function (sw, i) {
      probe.style.color = slots[i];
      var want = getComputedStyle(probe).color;
      return getComputedStyle(sw).backgroundColor === want;
    }).length;
    document.body.removeChild(probe);
    var pick = (folderSlot + 5) % 12;
    menu.querySelectorAll(".vs-swatch")[pick].click();
    var byHand = tint(book.id);
    __vs.setFilters({});
    var afterRebuild = tint(book.id);
    var closed = menu.hidden;

    /* 2. a shelf that varies gives every book its own, and a book with a given colour keeps
     * it anyway. */
    var before = people.books.slice(0, 6).map(function (b) { return tint(b.id); });
    var distinctBefore = new Set(before).size;
    var chosen = tint(book.id);
    return { byFolder: byFolder, folderSlot: folderSlot, opened: opened, swatches: swatches,
             painted: painted,
             pick: pick, byHand: byHand, want: slots[pick], afterRebuild: afterRebuild,
             closed: closed, distinctBefore: distinctBefore, chosen: chosen,
             peopleShown: before.length };
  })()`);
  const ok = r.folderSlot >= 0 && r.opened && r.swatches === 12 && r.painted === 12 &&
             r.byHand === r.want && r.afterRebuild === r.want && r.closed;
  return {
    ok,
    detail: `the first year book wears its folder's slot ${r.folderSlot + 1} (${r.byFolder}); ` +
            `a right-click opens ${r.swatches} swatches, ${r.painted} of them painted their ` +
            `slot's colour (${r.opened}), picking slot ` +
            `${r.pick + 1} dyes it ${r.byHand} and a rebuild keeps it (${r.afterRebuild === r.want}); ` +
            `the menu closed itself (${r.closed})`
  };
});

check("a shelf can vary its books, and a chosen palette beats the look's", async (p) => {
  const r = await p.j(`(function(){
    var tint = function (id) {
      var el = document.querySelector('[data-book="' + id + '"]');
      return el ? el.style.getPropertyValue("--spine-tint").trim() : "";
    };
    var people = function () {
      return __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    };
    var ids = people().books.slice(0, 8).map(function (b) { return b.id; });
    /* The SET of dyes, not how many: a vault with eight source folders gives eight People
     * books eight colours by folder already, and varying them changes which colours, not
     * how many. */
    var byFolderDyes = ids.map(tint).join(",");
    var byFolder = new Set(ids.map(tint)).size;

    /* Vary this shelf, through the button in Manage. */
    document.getElementById("vs-manageopen").click();
    var rows = [].slice.call(document.querySelectorAll("#vs-managelist .vs-managerow"));
    var row = rows.filter(function (r) { return r.textContent.indexOf("People") === 0; })[0];
    var vary = row.querySelector('.vs-toggle[data-fact="vary"] input[role="switch"]');
    vary.click();
    var variedDyes = ids.map(tint).join(",");
    var varied = new Set(ids.map(tint)).size;
    /* NEW NOTES NEVER RECOLOUR A VARIED SHELF: the slot is hashed from the address, so a
     * rebuild that changes what is in the books leaves every book its colour. A filter that
     * narrows the room is such a rebuild. */
    var folders = __vs.data().folders.map(function (f) { return f.path; });
    __vs.setFilters({ folders: folders.slice(0, Math.max(1, folders.length - 1)) });
    var afterNarrowing = ids.map(function (id) { return tint(id) || "(gone)"; });
    var recoloured = ids.filter(function (id, i) {
      var now = afterNarrowing[i];
      return now !== "(gone)" && now !== variedDyes.split(",")[i];
    }).length;
    __vs.setFilters({ folders: [] });
    var pressed = [].slice.call(document.querySelectorAll('#vs-managelist .vs-toggle[data-fact="vary"] input[role="switch"]'))
      .filter(function (b) { return b.checked; }).length;
    vary.click();
    var backDyes = ids.map(tint).join(",");
    var back = new Set(ids.map(tint)).size;

    /* A chosen palette: change one input and all twelve become the person's. */
    var slotsBefore = __vs.slots().join(",");
    var input = document.querySelectorAll('#vs-mpalette .vs-dyerows tbody tr td:nth-child(2) input[type="color"]')[0];
    input.value = "#123456";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    var slotsAfter = __vs.slots();
    var first = tint(__vs.views().filter(function (v) { return v.shelf.id === "years"; })[0]
      .books.filter(function (b) { return b.notes.length; })[0].id);
    /* ...and survives a look switch, because it is the person's, not the look's. */
    var sel = document.getElementById("vs-look");
    var other = [].slice.call(sel.options).map(function (o) { return o.value; })
      .filter(function (v) { return v !== sel.value; })[0];
    sel.value = other;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    var underOther = __vs.slots()[0];
    document.getElementById("vs-mpalettereset").click();
    var reset = __vs.slots()[0];
    document.getElementById("vs-mclose").click();
    return { byFolder: byFolder, varied: varied, pressed: pressed, back: back,
             changed: variedDyes !== byFolderDyes, restored: backDyes === byFolderDyes,
             recoloured: recoloured,
             slotsBefore: slotsBefore, slot1: slotsAfter[0], first: first,
             underOther: underOther, reset: reset, other: other || "modern" };
  })()`);
  const ok = r.changed && r.pressed === 1 && r.restored && r.recoloured === 0 &&
             r.slot1 === "#123456" && r.underOther === "#123456" && r.reset !== "#123456";
  return {
    ok,
    detail: `8 People books wear ${r.byFolder} colour(s) by folder and ${r.varied} varied -- ` +
            `a different set (${r.changed}), one shelf pressed (${r.pressed === 1}), ` +
            `${r.recoloured} recoloured by a narrowing rebuild, the folder dyes back after ` +
            `(${r.restored}); choosing ` +
            `#123456 for slot 1 makes it ${r.slot1}, still ${r.underOther} under the ` +
            `${r.other} look, and ${r.reset} after "Reset colours"`
  };
});

/* github#4 -- "all settings persistent naturally". Each thing the sheet can set goes through
 * persist() and comes back through core.migrate, which is the reload path in both hosts. */
check("colours and hidden shelves set in Manage persist through a reload", async (p) => {
  const r = await p.j(`(function(){
    var reload = function () {
      return window.VaultShelfCore.migrate(JSON.parse(JSON.stringify(__vs.settings())));
    };
    var HEX = /^#[0-9a-f]{6}$/;
    var marks = function (scope) { return document.querySelectorAll(scope + " .vs-slotreset").length; };
    var pick = function (sel, value) {
      var input = document.querySelector(sel);
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    /* Row i of the twelve, whichever of the two tables of six it is standing in. */
    var cell = function (i, col) {
      var rows = [].slice.call(document.querySelectorAll("#vs-mpalette .vs-dyerows tbody tr"));
      return rows[i - 1].querySelector("td:nth-child(" + col + ') input[type="color"]');
    };
    var nth = function (i) { return cell(i, 2); };
    var thread = function (i) { return cell(i, 3); };
    var shown = function (input) { return input.parentNode.querySelector(".vs-swatch"); };
    var paintedOn = function (input) {
      return getComputedStyle(shown(input)).backgroundColor;
    };
    var rootStyle = function (name) {
      return getComputedStyle(document.querySelector(".vault-shelf")).getPropertyValue(name).trim();
    };
    var out = {};
    document.getElementById("vs-manageopen").click();
    var reset = document.getElementById("vs-mpalettereset");

    /* The block as it opens: twelve painted, numbered slots, nothing marked, nothing to reset. */
    var slots = __vs.slots();
    var probe = document.createElement("span");
    document.body.appendChild(probe);
    var swatches = [].slice.call(document.querySelectorAll('#vs-mpalette td:nth-child(2) .vs-swatch'));
    out.swatches = swatches.length;
    out.painted = swatches.filter(function (sw, i) {
      probe.style.color = slots[i];
      return getComputedStyle(sw).backgroundColor === getComputedStyle(probe).color;
    }).length;
    document.body.removeChild(probe);
    out.numbers = [].slice.call(document.querySelectorAll("#vs-mpalette .vs-dyerows tbody th"))
      .map(function (th) { return th.textContent; }).join(",");
    out.rows = document.querySelectorAll("#vs-mpalette .vs-dyerows tbody tr").length;
    out.threads = document.querySelectorAll("#vs-mpalette .vs-ribbonswatch").length;
    /* A ribbon nobody chose is its dye's complement: a different hue, and far enough in
     * lightness that the thread is not the board. */
    out.complements = [].slice.call(document.querySelectorAll("#vs-mpalette .vs-dyerows tbody tr"))
      .map(function (tr) {
        var cells = tr.querySelectorAll('input[type="color"]');
        return { dye: cells[0].value, thread: cells[1].value };
      });
    out.marksAtStart = marks("#vs-mpalette");
    out.resetDisabledAtStart = reset.disabled;

    /* One slot picked: twelve hex saved, one mark, the reset live, the cascade repainted. */
    nth(3).value = "#3355aa";
    nth(3).dispatchEvent(new Event("change", { bubbles: true }));
    var s1 = reload();
    out.afterPick = { saved: s1.palette.length, allHex: s1.palette.every(function (c) { return HEX.test(c); }),
                      slot3: s1.palette[2], marks: marks("#vs-mpalette"),
                      marked: (function () {
                        var sw = document.querySelector('#vs-mpalette .vs-swatch[data-changed="1"]');
                        var tr = sw ? sw.closest("tr") : null;
                        return tr ? tr.querySelector("th").textContent : "(none)";
                      })(),
                      resetEnabled: !reset.disabled, cascade: __vs.slots()[2] };

    /* The ribbon the same way. */
    /* A ribbon, on one slot, and the spine that wears that dye has to pick it up. */
    var spineOf = function (hex) {
      return [].slice.call(document.querySelectorAll("#vs-shelves .vs-spine")).filter(function (sp) {
        return sp.style.getPropertyValue("--spine-tint").trim() === hex;
      })[0] || null;
    };
    var slot7 = __vs.slots()[6];
    var wearer = spineOf(slot7);
    var beforeThread = wearer ? wearer.style.getPropertyValue("--ribbon").trim() : "";
    thread(7).value = "#aa3355";
    thread(7).dispatchEvent(new Event("change", { bubbles: true }));
    var s2 = reload();
    wearer = spineOf(slot7);
    out.ribbon = { saved: s2.ribbons[6], others: s2.ribbons.filter(function (r) { return r; }).length,
                   marks: marks("#vs-mpalette"), before: beforeThread,
                   onSpine: wearer ? wearer.style.getPropertyValue("--ribbon").trim() : "(no spine)" };

    /* That one slot back: all twelve are the look's own again, so nothing is saved -- the
     * file follows the look rather than pinning this look's colours under the next. */
    /* The dye's own mark, not the ribbon's: the first reset in the table belongs to slot 3. */
    nth(3).parentNode.querySelector(".vs-slotreset").click();
    var s3 = reload();
    out.afterSlotReset = { saved: s3.palette.length, marks: marks("#vs-mpalette"),
                           ribbonKept: s3.ribbons[6] };

    /* Two slots picked and one put back keeps the other eleven as the person's. */
    nth(1).value = "#112233";
    nth(1).dispatchEvent(new Event("change", { bubbles: true }));
    nth(5).value = "#445566";
    nth(5).dispatchEvent(new Event("change", { bubbles: true }));
    nth(1).parentNode.querySelector(".vs-slotreset").click();
    var s4 = reload();
    out.oneOfTwo = { saved: s4.palette.length, slot1: s4.palette[0], slot5: s4.palette[4], marks: marks("#vs-mpalette") };

    /* Reset colours: palette and ribbon together, and the button goes quiet. */
    reset.click();
    var s5 = reload();
    out.afterReset = { palette: s5.palette.length, ribbons: s5.ribbons.filter(function (r) { return r; }).length,
                       disabled: reset.disabled, marks: marks("#vs-mpalette"), own1: __vs.slots()[0] };

    /* Shown, as a switch on the row, saved as hidden and still built while hidden. */
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "tags"; })[0];
    var sw = function () {
      var row = [].slice.call(document.querySelectorAll("#vs-managelist .vs-managerow"))
        .filter(function (r) { return r.textContent.indexOf(shelf.name) === 0; })[0];
      return row.querySelector('.vs-toggle[data-fact="shown"] input[role="switch"]');
    };
    out.hide = { shownAtStart: sw().checked, visibleBefore: __vs.counts().visible };
    sw().click();
    var s6 = reload();
    out.hide.saved = s6.shelves.filter(function (s) { return s.id === "tags"; })[0].hidden;
    out.hide.shownAfter = sw().checked;
    out.hide.visibleDuring = __vs.counts().visible;
    out.hide.stillBuilt = __vs.views().filter(function (v) { return v.shelf.id === "tags"; })[0].books.length;
    out.hide.textButtons = [].slice.call(document.querySelectorAll("#vs-managelist button"))
      .filter(function (b) { return /^(Hide|Show)$/.test(b.textContent.trim()); }).length;
    sw().click();
    var s7 = reload();
    out.hide.back = s7.shelves.filter(function (s) { return s.id === "tags"; })[0].hidden;
    out.hide.visibleAfter = __vs.counts().visible;
    document.getElementById("vs-mclose").click();
    return out;
  })()`);
  const a = r.afterPick, h = r.hide;
  /* Hue apart and lightness apart, on every one of the twelve: a complement that lands on the
   * dye's own lightness is a thread you cannot see against the board it hangs off. */
  const hsl = (hex) => {
    const [R, G, B] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
    let hue = 0;
    if (d) hue = max === R ? ((G - B) / d + (G < B ? 6 : 0)) / 6 : max === G ? ((B - R) / d + 2) / 6 : ((R - G) / d + 4) / 6;
    return { h: hue, l };
  };
  const apart = r.complements.map(({ dye, thread }) => {
    const A = hsl(dye), B = hsl(thread);
    const dh = Math.abs(A.h - B.h);
    return { hue: Math.min(dh, 1 - dh), light: Math.abs(A.l - B.l) };
  });
  const opposed = apart.filter((x) => x.hue > 0.33 || x.light > 0.2).length;
  const visible = apart.filter((x) => x.light > 0.18).length;
  const ok = r.swatches === 12 && r.painted === 12 && r.numbers === "1,2,3,4,5,6,7,8,9,10,11,12" &&
             r.rows === 12 && r.threads === 12 && opposed === 12 && visible === 12 &&
             r.marksAtStart === 0 && r.resetDisabledAtStart === true &&
             a.saved === 12 && a.allHex && a.slot3 === "#3355aa" && a.marks === 1 && a.marked === "3" &&
             a.resetEnabled && a.cascade === "#3355aa" &&
             r.ribbon.saved === "#aa3355" && r.ribbon.others === 1 && r.ribbon.marks === 2 &&
             r.ribbon.onSpine === "#aa3355" && r.ribbon.before !== "#aa3355" &&
             r.afterSlotReset.saved === 0 && r.afterSlotReset.marks === 1 && r.afterSlotReset.ribbonKept === "#aa3355" &&
             r.oneOfTwo.saved === 12 && r.oneOfTwo.slot5 === "#445566" &&
             r.oneOfTwo.slot1 === r.afterReset.own1 &&
             r.afterReset.palette === 0 && r.afterReset.ribbons === 0 && r.afterReset.disabled === true &&
             r.afterReset.marks === 0 &&
             h.shownAtStart === true && h.saved === true && h.shownAfter === false &&
             h.visibleDuring === h.visibleBefore - 1 && h.stillBuilt > 0 && h.textButtons === 0 &&
             h.back === false && h.visibleAfter === h.visibleBefore;
  return {
    ok,
    detail: `${r.rows} rows, ${r.swatches} dyes painted ${r.painted}, ${r.threads} ribbons, numbered ` +
            `${r.numbers === "1,2,3,4,5,6,7,8,9,10,11,12" ? "1-12" : r.numbers}; ${opposed}/12 complements a ` +
            `hue or a third of the lightness away, ${visible}/12 visibly lighter or darker than their dye; ` +
            `${r.marksAtStart} marked and the reset ${r.resetDisabledAtStart ? "quiet" : "LIVE"} to start; ` +
            `slot 3 -> ${a.slot3}: ${a.saved} saved, ${a.marks} mark on slot ${a.marked}, cascade ${a.cascade}; ` +
            `ribbon 7 ${r.ribbon.saved} alone (${r.ribbon.others} of 12), was ${r.ribbon.before} on its spine and ` +
            `is ${r.ribbon.onSpine}; slot 3's dye back: ${r.afterSlotReset.saved} saved, ribbon still ` +
            `${r.afterSlotReset.ribbonKept}; two picked, one back: ` +
            `${r.oneOfTwo.saved} saved, slot 1 ${r.oneOfTwo.slot1 === r.afterReset.own1 ? "the look's own" : r.oneOfTwo.slot1}, ` +
            `slot 5 ${r.oneOfTwo.slot5}; Reset colours: ${r.afterReset.palette} palette and ${r.afterReset.ribbons} ribbons saved, ` +
            `button ${r.afterReset.disabled ? "quiet" : "LIVE"}; Shown off: hidden ${h.saved}, ` +
            `${h.visibleBefore} -> ${h.visibleDuring} -> ${h.visibleAfter} visible, ${h.stillBuilt} books still built, ` +
            `${h.textButtons} Hide/Show buttons left`
  };
});

check("a book with several ribbons in it shows them side by side", async (p) => {
  const r = await p.j(`(function(){
    var months = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0];
    var book = months.books.filter(function (b) { return b.notes.length >= 5; })[0];
    var count = function () {
      var el = document.querySelector('[data-book="' + book.id + '"]');
      return el ? el.querySelectorAll(".vs-ribbon").length : -1;
    };
    var none = count();
    var lefts = [];
    for (var i = 0; i < 4; i++) {
      __vs.openBook(book.id, book.notes[i].id);
      document.querySelector("#vs-marks .vs-markstub").click();
      __vs.closeReader();
      if (i === 2) {
        lefts = [].slice.call(document.querySelector('[data-book="' + book.id + '"]')
          .querySelectorAll(".vs-ribbon")).map(function (r) {
            return Math.round(r.getBoundingClientRect().left);
          });
      }
    }
    var four = count();
    for (var k = 0; k < 4; k++) {
      __vs.openBook(book.id, book.notes[k].id);
      var mine = document.querySelector('#vs-marks .vs-mark[aria-current="true"]');
      if (mine) mine.click();
      __vs.closeReader();
    }
    return { book: book.key, none: none, lefts: lefts, four: four, after: count() };
  })()`);
  const spread = r.lefts.length === 3 && r.lefts[0] < r.lefts[1] && r.lefts[1] < r.lefts[2];
  const ok = r.none === 0 && spread && r.four === 3 && r.after === 0;
  return {
    ok,
    detail: `${r.book}: ${r.none} ribbons on its spine, three side by side at x=` +
            `${r.lefts.join("/")} after three are left (${spread}), still ${r.four} drawn ` +
            `with four in (the rest are a count on the peek), ${r.after} after all come out`
  };
});

check("shelf wear is recorded and drawn, and survives a rebuild", async (p) => {
  const r = await p.j(`(function(){
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!book && b.notes.length) book = b; });
    });
    var before = __vs.magic().wornSpines;
    for (var i = 0; i < 13; i++) { __vs.openBook(book.id, null); __vs.closeReader(); }
    var after = __vs.magic();
    var level = document.querySelector('[data-book="' + book.id.replace(/"/g, '\\"') + '"]');
    var drawn = level ? level.getAttribute("data-wear") : null;
    __vs.setFilters({});
    var still = document.querySelector('[data-book="' + book.id.replace(/"/g, '\\"') + '"]');
    return { before: before, worn: after.worn, wornSpines: after.wornSpines,
             drawn: drawn, afterRebuild: still ? still.getAttribute("data-wear") : null,
             book: book.id };
  })()`);
  return { ok: r.before === 0 && r.worn >= 1 && r.drawn === "3" && r.afterRebuild === "3",
           detail: `${r.book} opened 13 times reads wear level ${r.drawn} (of 3) and still ` +
                   `${r.afterRebuild} after a rebuild; ${r.wornSpines} worn spines on screen` };
});

/* design/0008 -- MAGIC 2. A ribbon hangs out of the book, visible from the shelf. */
check("an open book shows the ribbons in it, three at most", async (p) => {
  const r = await p.j(`(function(){
    var months = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0];
    var book = months.books.filter(function (b) { return b.notes.length >= 5; })[0];
    __vs.openBook(book.id, null);

    var row = function () {
      var box = document.getElementById("vs-marks");
      return { hidden: box.hidden,
               look: document.getElementById("vs-app").getAttribute("data-look"),
               height: box.getBoundingClientRect().height,
               stub: box.querySelectorAll(".vs-markstub").length,
               /* .vs-mark .vs-markname, not .vs-markname alone: the stub carries one too,
                * and counting its label as a ribbon says a book still holds one when it
                * does not. */
               names: [].slice.call(box.querySelectorAll(".vs-mark .vs-markname"))
                 .map(function (e) { return e.textContent; }),
               more: (box.querySelector(".vs-markmore") || {}).textContent || "",
               current: [].slice.call(box.querySelectorAll('[aria-current="true"]')).length };
    };
    var empty = row();
    var stubWhenFree = empty.stub;

    /* Mark five notes of this book, from inside it, the way a person does. */
    var marked = [];
    for (var i = 0; i < 5; i++) {
      __vs.openBook(book.id, book.notes[i].id);
      document.querySelector("#vs-marks .vs-markstub").click();
      marked.push(book.notes[i].title);
    }
    var full = row();

    /* The row is this book's ribbons: the first one goes to the first marked note. */
    var before = __vs.reader().index;
    var first = document.querySelector("#vs-marks .vs-mark");
    if (first) first.click();
    var jumped = __vs.reader().index;

    /* TURNING TO A MARKED PAGE, the way six controls do it. The stub is about the page you
     * are on, so it has to go when you arrive on one that already holds a ribbon -- and the
     * row was only ever redrawn when a book was opened. */
    __vs.openBook(book.id, book.notes[3].id);
    var onFree = row();
    document.querySelectorAll("#vs-contents button")[1].click();
    var turnedToMarked = row();
    var rows = document.querySelectorAll("#vs-contents button");
    rows[rows.length - 1].click();
    var turnedToFree = row();

    /* Taking one out is its own ribbon's job, not the stub's: the stub is not there once the
     * page you are on already has one (design/0008). */
    for (var k = 0; k < 5; k++) {
      __vs.openBook(book.id, book.notes[k].id);
      var mine = document.querySelector('#vs-marks .vs-mark[aria-current="true"]');
      if (mine) mine.click();
    }
    var cleared = row();
    __vs.closeReader();
    return { turned: { onFree: onFree.stub, marked: turnedToMarked.stub, free: turnedToFree.stub },
             book: book.key, notes: book.notes.length, empty: empty, full: full,
             cleared: cleared, marked: marked, before: before, jumped: jumped };
  })()`);
  const capped = r.full.names.length === 3;
  const counted = r.full.more === "+2 more";
  /* The first three, except that the ribbon in the page you are on always has a place, so it
   * may have taken the third one (design/0008). */
  const named = r.full.names.slice(0, 2).every((n, i) => n === r.marked[i]);
  /* THE ROW KEEPS ITS HEIGHT, empty or not: hiding it moved the whole spread up and down as
   * you marked and unmarked, and a page that jumps under your hands is worse than a strip of
   * nothing. The stub -- the edge of a ribbon you have not pushed in yet -- is always there. */
  const steady = r.empty.height > 0 && Math.abs(r.empty.height - r.full.height) < 0.6 &&
                 Math.abs(r.cleared.height - r.empty.height) < 0.6;
  /* The stub is there when the page you are on has no ribbon, and gone when it has one --
   * one shape, one meaning. With five marked the reader sits on a marked note, so there is
   * none; emptied again, it is back. */
  const insertable = r.empty.stub === 1 && r.full.stub === 0 && r.cleared.stub === 1;
  const turns = r.turned.marked === 0 && r.turned.free === 1;
  const ok = capped && counted && named && steady && insertable && turns &&
             r.jumped !== r.before && r.cleared.names.length === 0;
  return {
    ok,
    detail: `${r.book} holds ${r.notes} notes; with five marked it shows ` +
            `${r.full.names.length} named ribbons and "${r.full.more}", in the order they sit ` +
            `in the book (${named}); clicking the first moved the reader ${r.before} -> ` +
            `${r.jumped}; unmarking all five leaves ${r.cleared.names.length} (${r.cleared.names.join(", ")}). The row is ` +
            `in the ${r.empty.look || "modern"} look, ${r.empty.height.toFixed(0)}/${r.full.height.toFixed(0)}/` +
            `${r.cleared.height.toFixed(0)}px empty, full and emptied again (${steady}), and ` +
            `carries a stub to push one in exactly when the page has none (${insertable}); ` +
            `turning the page keeps that true -- to a marked one ${r.turned.marked} stub, ` +
            `to a free one ${r.turned.free} (${turns})`
  };
});

check("a ribbon hangs from every book that holds a marked note", async (p) => {
  const r = await p.j(`(function(){
    __vs.settings().reading.length = 0;
    __vs.setFilters({});
    var before = __vs.magic().ribbonSpines;
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!book && b.notes.length) book = b; });
    });
    __vs.openBook(book.id, null);
    document.querySelector("#vs-marks .vs-markstub").click();
    var after = __vs.magic();
    var reading = document.querySelectorAll('#vs-shelves [data-shelf="-reading"] .vs-spine').length;
    var noteId = __vs.reader().note;
    __vs.closeReader();
    return { before: before, ribbons: after.ribbons, ribbonSpines: after.ribbonSpines,
             reading: reading, noteId: noteId };
  })()`);
  /* One note, but it is in several books at once -- that is the product -- so every book that
   * holds it grows a ribbon, and the Reading shelf collects them. */
  return { ok: r.before === 0 && r.ribbonSpines >= 1 && r.reading >= 1,
           detail: `marking one note put ribbons on ${r.ribbons} book(s) and drew ` +
                   `${r.ribbonSpines} of them; the Reading shelf collected ${r.reading}` };
});

/* design/0008 -- MAGIC 3. The query marks; it never narrows. */
check("the shelf parts as you type, and no book leaves the room", async (p) => {
  const r = await p.j(`(function(){
    __vs.setQuery("");
    var before = __vs.counts();
    /* THE NEEDLE COMES FROM THE VAULT, not from the demo fixture. Hard-coding "garden" passed
     * on the demo vault and matched nothing on the sparse one, where the check then asserted
     * that a query which finds nothing still draws something forward. */
    var tags = {};
    __vs.data().notes.forEach(function (n) {
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var needle = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] ||
                 __vs.data().notes[0].title.slice(0, 4);
    __vs.setQuery(needle);
    var during = __vs.counts();
    var m = __vs.magic();
    var hits = document.getElementById("vs-hits").textContent;
    __vs.setQuery("");
    var after = __vs.counts();
    return { before: before.spines, during: during.spines, after: after.spines,
             books: before.books, forward: m.forward, ghosts: m.ghosts, needle: needle,
             parting: m.parting, hits: hits };
  })()`);
  return { ok: r.before === r.during && r.during === r.after && r.parting &&
               r.forward > 0 && r.ghosts > 0,
           detail: `${r.before} spines before, during and after; "${r.needle}" drew ${r.forward} ` +
                   `forward and thinned ${r.ghosts} to ghosts without removing one ` +
                   `(hits read "${r.hits}")` };
});

/* design/0009 -- A ROOM HAS A WIDTH. Measured by overriding the viewport rather than by
 * resizing a window, so the number is the same on a laptop and on the WQHD screen this was
 * reported from. */
check("a narrower window grows rows, and a wide one centres the shelf", async (p) => {
  const at = async (width) => {
    await p.send("Emulation.setDeviceMetricsOverride",
                 { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    /* CDP RESIZES THE VIEWPORT WITHOUT TELLING THE PAGE. `setDeviceMetricsOverride` changes
     * the metrics and, headless, does not always deliver the resize event a real window
     * manager would -- so the event is dispatched here. It is the same event the browser
     * sends, so what is being tested is still the handler and not the emulation.
     *
     * `p.j` is `JSON.stringify(expr)`: an EXPRESSION, and a promise stringifies to `{}`
     * without ever being awaited. Waiting for the repack is therefore a sleep rather than an
     * await, and 150ms is nine of the frame the handler coalesces into. */
    await p.j(`window.dispatchEvent(new Event("resize"))`);
    await sleep(150);
    return p.j(`(function(){
      var app = document.getElementById("vs-app");
      var host = app.getBoundingClientRect();
      var rows = document.querySelectorAll('[data-shelf="months"] .vs-track');
      var first = rows[0] ? rows[0].getBoundingClientRect() : null;
      var over = 0;
      [].slice.call(document.querySelectorAll("#vs-shelves .vs-track")).forEach(function (t) {
        over = Math.max(over, t.scrollWidth - t.clientWidth);
      });
      return { app: Math.round(host.width), rows: rows.length,
               total: document.querySelectorAll("#vs-shelves .vs-track").length,
               room: __vs.room(),
               row: first ? Math.round(first.width) : 0,
               left: first ? Math.round(first.left - host.left) : 0,
               right: first ? Math.round(host.right - first.right) : 0,
               over: over,
               measure: parseInt(getComputedStyle(app).getPropertyValue("--measure"), 10) };
    })()`);
  };

  const wide = await at(2560);
  const narrow = await at(760);
  const back = await at(2560);
  await p.send("Emulation.clearDeviceMetricsOverride");
  await sleep(250);

  /* Below the measure the row is the window; at or above it the row stops at the measure and
   * the gutters match. 24px of tolerance is a scrollbar, not slack. */
  const capped = wide.row <= wide.measure + 2;
  const centred = Math.abs(wide.left - wide.right) <= 24;
  const fills = narrow.row > 600 && narrow.row < 760;
  /* SOME shelf has to wrap further, not necessarily the Months one: a vault whose months
   * already fit in two rows at 1180px can still fit in two at 760px, and that is not a
   * failure of anything. The library's total row count is the honest measure. */
  const grew = narrow.total > wide.total && narrow.rows >= wide.rows;
  const restored = back.total === wide.total && back.row === wide.row;
  const ok = capped && centred && fills && grew && restored &&
             wide.over === 0 && narrow.over === 0;
  return {
    ok,
    detail: `at 2560px the Months shelf is ${wide.rows} row(s) of ${wide.row}px, centred ` +
            `${wide.left}/${wide.right}; at 760px it is ${narrow.rows} row(s) of ` +
            `${narrow.row}px; the library goes from ${wide.total} rows to ${narrow.total} ` +
            `and back to ${back.total}. ` +
            `Worst overflow ${Math.max(wide.over, narrow.over, back.over)}px; the watcher saw ` +
            `${narrow.room.resizes} resizes, measured ${narrow.room.measured} times, last ` +
            `${narrow.room.last}px, packed for ${narrow.room.width}px`
  };
});

check("scrolling the library stays smooth in every look", async (p) => {
  /* MEASURED, NOT ASSUMED. The library is every spine of every shelf, and each look paints a
   * spine with its own layers of gradient and texture; what that costs is only knowable by
   * scrolling it and timing the frames. A scripted scroll of the whole room, in each look,
   * with the interval between animation frames recorded -- the 95th percentile is the number
   * a person feels, since a single long frame is a stutter and the median hides it. */
  /* p.eval, not p.j: this one is a promise, and eval awaits it while j would stringify it. */
  const r = await p.eval(`(async function(){
    var lib = document.getElementById("vs-library");
    var looks = window.VaultShelfCore.LOOKS.map(function (l) { return l.value; });
    var out = {};
    for (var i = 0; i < looks.length; i++) {
      __vs.setLook(looks[i]);
      await new Promise(function (r) { setTimeout(r, 120); });
      lib.scrollTop = 0;
      var span = lib.scrollHeight - lib.clientHeight;
      var frames = [];
      var last = performance.now();
      var start = last;
      await new Promise(function (done) {
        function step(now) {
          frames.push(now - last);
          last = now;
          var t = Math.min(1, (now - start) / 1400);
          lib.scrollTop = span * t;
          if (t < 1) requestAnimationFrame(step); else done();
        }
        requestAnimationFrame(step);
      });
      frames.shift();
      frames.sort(function (a, b) { return a - b; });
      out[looks[i] || "modern"] = {
        p50: frames[Math.floor(frames.length * 0.5)],
        p95: frames[Math.floor(frames.length * 0.95)],
        worst: frames[frames.length - 1],
        frames: frames.length,
        span: Math.round(span)
      };
      lib.scrollTop = 0;
    }
    __vs.setLook(looks[0]);
    return { looks: out, spines: document.querySelectorAll("#vs-shelves .vs-spine").length };
  })()`);
  const names = Object.keys(r.looks);
  /* Two frames at 60Hz is the budget for the 95th percentile: one dropped frame in twenty is
   * where a scroll starts to read as jerky rather than as scrolling. */
  const BUDGET = 34;
  const over = names.filter((n) => r.looks[n].p95 > BUDGET);
  return {
    ok: over.length === 0,
    detail: `${r.spines} spines scrolled through ${r.looks[names[0]].span}px; p50/p95/worst ` +
            `frame in ms -- ` + names.map((n) =>
              `${n} ${r.looks[n].p50.toFixed(1)}/${r.looks[n].p95.toFixed(1)}/` +
              `${r.looks[n].worst.toFixed(0)}`).join(", ") +
            ` (budget: p95 under ${BUDGET}ms${over.length ? "; over in " + over.join(", ") : ""})`
  };
});

check("the room has a width, however wide the window is", async (p) => {
  await p.send("Emulation.setDeviceMetricsOverride",
               { width: 2560, height: 1400, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
  const r = await p.j(`(function(){
    var app = document.getElementById("vs-app");
    var measure = parseInt(getComputedStyle(app).getPropertyValue("--measure"), 10);
    var box = function (el) {
      if (!el) return null;
      var b = el.getBoundingClientRect();
      var host = app.getBoundingClientRect();
      return { w: Math.round(b.width),
               left: Math.round(b.left - host.left),
               right: Math.round(host.right - b.right) };
    };
    __vs.closeReader();
    var shelves = box(document.getElementById("vs-shelves"));
    var rail = box(document.querySelector("#vs-rail .vs-inner"));
    var tracks = [].slice.call(document.querySelectorAll("#vs-shelves .vs-track"));
    var track = box(tracks[0]);
    /* design/0014 -- NOTHING RUNS SIDEWAYS ANY MORE. A row is exactly as wide as the room and
     * a run too long for it continues on the next row down, so the honest question is no
     * longer "does the scroller clip" but "does anything overflow at all". */
    var overflow = tracks.reduce(function (worst, t) {
      return Math.max(worst, t.scrollWidth - t.clientWidth);
    }, 0);
    var rows = {};
    tracks.forEach(function (t) {
      var id = t.closest("[data-shelf]").getAttribute("data-shelf");
      rows[id] = (rows[id] || 0) + 1;
    });
    var most = Object.keys(rows).reduce(function (a, b) { return rows[a] >= rows[b] ? a : b; },
                                        Object.keys(rows)[0] || "");
    __vs.openBook(__vs.addresses()[0], null);
    var spread = box(document.querySelector("#vs-reader .vs-spread"));
    __vs.closeReader();
    return { measure: measure, app: Math.round(app.getBoundingClientRect().width),
             shelves: shelves, rail: rail, track: track, spread: spread,
             overflow: overflow, tracks: tracks.length, most: most, mostRows: rows[most] || 0 };
  })()`);
  await p.send("Emulation.clearDeviceMetricsOverride");
  await sleep(250);

  const fits = (b) => b && b.w <= r.measure + 2;
  /* A SCROLLBAR IS NOT AN OFF-CENTRE LAYOUT. The library scrolls, so its right gutter is
   * narrower than its left by whatever the platform's scrollbar costs -- 15px on Windows,
   * 0 on an overlay scrollbar. The tolerance is for that, not for sloppiness: 20px cannot
   * hide a genuinely left- or right-aligned column, which would be off by hundreds. */
  const centred = (b) => b && Math.abs(b.left - b.right) <= 20;
  const wide = r.app > r.measure + 400;
  const ok = wide && fits(r.shelves) && fits(r.rail) && fits(r.spread) && fits(r.track) &&
             r.overflow <= 1 && centred(r.shelves) && centred(r.spread);
  return {
    ok,
    detail: !wide
      ? `the viewport override did not take: the app is only ${r.app}px wide`
      : `in a ${r.app}px view with --measure ${r.measure}: shelves ${r.shelves.w} ` +
        `(${r.shelves.left}/${r.shelves.right}), rail ${r.rail.w}, row ${r.track.w}, spread ` +
        `${r.spread.w} (${r.spread.left}/${r.spread.right}); ${r.tracks} rows in all, ` +
        `${r.most} taking ${r.mostRows}, worst overflow ${r.overflow}px`
  };
});

check("the reader and the sheets are not painted until they are opened", async (p) => {
  const r = await p.j(`(function(){
    __vs.closeReader();
    return ["reader", "builder", "manage"].map(function (id) {
      var node = document.getElementById("vs-" + id);
      var box = node.getBoundingClientRect();
      return { id: id, attr: node.hidden, display: getComputedStyle(node).display,
               painted: node.offsetParent !== null || box.width > 0 || box.height > 0 };
    });
  })()`);
  const painted = r.filter((x) => x.painted);
  return { ok: painted.length === 0,
           detail: painted.length
             ? painted.map((x) => `${x.id} is still painted (hidden=${x.attr}, display=${x.display})`).join("; ")
             : r.map((x) => `${x.id} display:${x.display}`).join(", ") };
});

check("a wide table scrolls inside the page and never widens the book", async (p) => {
  const r = await p.j(`(function(){
    var note = __vs.data().notes.filter(function (n) { return n.title === "Wide table of everything"; })[0];
    if (!note) return null;
    var home = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (!home && b.notes.some(function (n) { return n.id === note.id; })) home = b.id;
      });
    });
    __vs.openBook(home, note.id);
    var measure = parseInt(getComputedStyle(document.getElementById("vs-app"))
      .getPropertyValue("--measure"), 10);
    var spread = document.querySelector("#vs-reader .vs-spread");
    var page = document.querySelector("#vs-reader .vs-page.vs-right");
    var prose = document.querySelector("#vs-reader .vs-prose");
    var table = prose ? prose.querySelector("table") : null;
    var out = {
      measure: measure,
      spread: Math.round(spread.getBoundingClientRect().width),
      pageScrolls: page.scrollWidth - page.clientWidth,
      proseScrolls: prose ? prose.scrollWidth - prose.clientWidth : -1,
      rows: table ? table.querySelectorAll("tr").length : 0,
      cells: table ? table.querySelectorAll("td").length : 0,
      widest: 0
    };
    if (table) {
      out.widest = Math.max.apply(null, [].slice.call(table.querySelectorAll("td"))
        .map(function (td) { return td.textContent.length; }));
    }
    __vs.closeReader();
    return out;
  })()`);
  if (r === null) return { ok: true, detail: "this vault has no wide-table note; nothing to assert" };
  const ok = r.spread <= r.measure + 2 && r.pageScrolls <= 1 && r.rows >= 12 && r.cells >= 60;
  return {
    ok,
    detail: `the note renders as a ${r.rows}-row table with ${r.cells} cells, the widest ` +
            `${r.widest} characters; the spread stays ${r.spread}px inside the ${r.measure}px ` +
            `measure, the page does not scroll sideways (${r.pageScrolls}px), and the article ` +
            `${r.proseScrolls > 0 ? "scrolls " + r.proseScrolls + "px within itself" : "fits"}`
  };
});

check("clicking a spine opens a book on the note it names", async (p) => {
  await p.eval("__vs.closeReader()");
  const r = await p.j(`(function(){
    var spine = document.querySelector('#vs-shelves [data-shelf="years"] .vs-spine');
    if (!spine) return { found: false };
    var id = spine.getAttribute("data-book");
    spine.click();
    var open = !document.getElementById("vs-reader").hidden;
    var state = __vs.reader();
    var contents = document.querySelectorAll("#vs-contents li").length;
    return { found: true, wanted: id, open: open, got: state ? state.book : null, contents: contents };
  })()`);
  if (!r.found) return { ok: false, detail: "no spine on the Years shelf to click" };
  return { ok: r.open && r.got === r.wanted && r.contents > 0,
           detail: `opened ${r.got} (wanted ${r.wanted}), ${r.contents} entries in its contents` };
});

check("the date index is layered: years over months over days, each only where it separates",
      async (p) => {
  const r = await p.j(`(function(){
    var tabsOf = function (id) {
      __vs.openBook(id, null);
      var t = [].slice.call(document.querySelectorAll("#vs-tabs button")).map(function (b) {
        return { label: b.textContent, level: Number(b.getAttribute("data-level") || 0) };
      });
      __vs.closeReader();
      return t;
    };
    var pick = function (shelfId, test) {
      var v = __vs.views().filter(function (v) { return v.shelf.id === shelfId; })[0];
      return v.books.filter(test)[0];
    };
    var years = function (b) {
      return new Set(b.notes.map(function (n) { return n.date ? n.date.slice(0, 4) : ""; })
        .filter(Boolean)).size;
    };
    /* A tag book spanning several years: years on the top layer, months under them. */
    var tag = pick("tags", function (b) { return b.key !== "-unfiled" && years(b) > 1 && b.notes.length > 6; });
    var tagTabs = tag ? tabsOf(tag.id) : [];
    var top = tagTabs.filter(function (t) { return t.level === 0; });
    var yearsShown = top.every(function (t) { return /^\\d{4}$/.test(t.label); });
    var months = tagTabs.filter(function (t) { return t.level === 1; });
    var monthsLook = months.every(function (t) { return /^[A-Z][a-z]{2}$/.test(t.label); });
    /* A month book: one year, one month -- neither is drawn; days are, if there are more than three notes. */
    var month = pick("months", function (b) { return b.key !== "-undated" && b.notes.length > 3; });
    var monthTabs = month ? tabsOf(month.id) : [];
    var daysOnly = monthTabs.length > 0 && monthTabs.every(function (t) { return t.level === 0 && /^\\d{2}$/.test(t.label); });
    /* A book of three or fewer notes has no index at all. */
    var small = null;
    __vs.views().forEach(function (v) { v.books.forEach(function (b) {
      if (!small && b.notes.length >= 2 && b.notes.length <= 3 && v.shelf.classifier !== "initial" &&
          years(b) === 1) small = b;
    }); });
    var smallTabs = small ? tabsOf(small.id) : null;
    return { tag: tag ? tag.key : null, tagYears: tag ? years(tag) : 0, tagTabs: tagTabs.length,
             top: top.length, yearsShown: yearsShown, months: months.length, monthsLook: monthsLook,
             month: month ? month.key : null, monthTabs: monthTabs.map(function (t) { return t.label; }),
             daysOnly: daysOnly, small: small ? small.key : null,
             smallTabs: smallTabs ? smallTabs.length : -1 };
  })()`);
  const ok = (!r.tag || (r.top === r.tagYears && r.yearsShown && r.monthsLook)) &&
             (!r.month || r.daysOnly) && (!r.small || r.smallTabs === 0) && r.tagTabs <= 30;
  return {
    ok,
    detail: (r.tag ? `#${r.tag} spans ${r.tagYears} years and gets ${r.top} year tabs ` +
                     `(${r.yearsShown}) with ${r.months} month tabs stepped in under them ` +
                     `(${r.monthsLook}), ${r.tagTabs} in all; ` : "no multi-year tag book here; ") +
            (r.month ? `${r.month} is one month, so only days: ${r.monthTabs.slice(0, 6).join(" ")}` +
                       `${r.monthTabs.length > 6 ? " ..." : ""} (${r.daysOnly}); ` : "") +
            (r.small ? `${r.small} holds three notes or fewer and has ${r.smallTabs} tabs` : "")
  };
});

check("the reader's index tabs stay countable on the biggest book", async (p) => {
  const r = await p.j(`(function(){
    var biggest = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!biggest || b.notes.length > biggest.notes.length) biggest = b; });
    });
    __vs.openBook(biggest.id, null);
    return { book: biggest.id, notes: biggest.notes.length,
             tabs: document.querySelectorAll("#vs-tabs button").length };
  })()`);
  return { ok: r.tabs > 0 && r.tabs <= 26,
           detail: `${r.book} holds ${r.notes} notes behind ${r.tabs} tabs (cap 26)` };
});

check("previous and next walk the book and stop at its ends", async (p) => {
  const r = await p.j(`(function(){
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!book && b.notes.length >= 3) book = b; });
    });
    if (!book) return { found: false };
    __vs.openBook(book.id, null);
    var first = __vs.reader().index;
    var prevDisabled = document.getElementById("vs-prevnote").disabled;
    document.getElementById("vs-nextnote").click();
    var second = __vs.reader().index;
    for (var i = 0; i < book.notes.length + 4; i++) document.getElementById("vs-nextnote").click();
    var last = __vs.reader().index;
    return { found: true, first: first, prevDisabled: prevDisabled, second: second,
             last: last, size: book.notes.length,
             nextDisabled: document.getElementById("vs-nextnote").disabled };
  })()`);
  if (!r.found) return { ok: false, detail: "no book with three notes in this vault" };
  return { ok: r.first === 0 && r.prevDisabled && r.second === 1 &&
               r.last === r.size - 1 && r.nextDisabled,
           detail: `opened at ${r.first} (previous disabled: ${r.prevDisabled}), next -> ${r.second}, ` +
                   `ran to ${r.last} of ${r.size - 1} and stopped (next disabled: ${r.nextDisabled})` };
});

check("a wikilink in a book goes to that note in this book, this shelf, or the nearest", async (p) => {
  const r = await p.j(`(function(){
    var notes = __vs.data().notes;
    var target = notes.filter(function (n) { return n.title === "Halvor Estrin"; })[0];
    if (!target) return null;
    var linking = notes.filter(function (n) {
      return n.id !== target.id && (n.body || "").indexOf("[[Halvor Estrin") >= 0;
    });
    if (!linking.length) return null;
    var books = function (shelfId) {
      return __vs.views().filter(function (v) { return v.shelf.id === shelfId; })[0].books;
    };
    var holds = function (b, id) { return b.notes.some(function (n) { return n.id === id; }); };

    /* Same shelf: a Months book that links to the person, whose own note sits in another month. */
    var monthBook = books("months").filter(function (b) {
      return linking.some(function (n) { return holds(b, n.id); }) && !holds(b, target.id);
    })[0];
    var linker = monthBook.notes.filter(function (n) { return linking.indexOf(n) >= 0; })[0];
    __vs.openBook(monthBook.id, linker.id);
    var link = document.querySelector("#vs-note a.vs-link");
    var rendered = !!link && link.getAttribute("data-note") === target.id;
    link.click();
    var after = __vs.reader();
    var sameShelf = after && after.note === target.id && after.book.indexOf("months/") === 0;

    /* Same book: a book that holds both the linker and the target. */
    var both = null;
    __vs.views().forEach(function (v) { v.books.forEach(function (b) {
      if (!both && holds(b, target.id) && linking.some(function (n) { return holds(b, n.id); })) both = b;
    }); });
    var sameBook = null;
    if (both) {
      var from = both.notes.filter(function (n) { return linking.indexOf(n) >= 0; })[0];
      __vs.openBook(both.id, from.id);
      document.querySelector("#vs-note a.vs-link").click();
      var r2 = __vs.reader();
      sameBook = r2 && r2.book === both.id && r2.note === target.id;
    }

    /* A link to nothing the library holds is not a link. */
    var dead = document.querySelectorAll("#vs-note .vs-deadlink").length;
    var where = __vs.openNote("no/such/note.md");
    __vs.closeReader();
    return { linking: linking.length, rendered: rendered, sameShelf: sameShelf,
             sameBook: sameBook, both: !!both, dead: dead, missing: where };
  })()`);
  if (r === null) return { ok: true, detail: "this vault has no linked note to follow" };
  const ok = r.rendered && r.sameShelf && (r.sameBook !== false) && r.missing === null;
  return {
    ok,
    detail: `${r.linking} notes link to a person's note; the link renders as a link to it ` +
            `(${r.rendered}); from a Months book that does not hold it, the click lands on ` +
            `it in another Months book (${r.sameShelf}); ` +
            (r.both ? `from a book that holds both, it stays in that book (${r.sameBook}); `
                    : "no single book holds both, so the same-book case has no fixture here; ") +
            `a note the library does not hold is left to the host (${r.missing === null})`
  };
});

check("also shelved in moves to another book and keeps the note", async (p) => {
  const r = await p.j(`(function(){
    var found = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (found) return;
        b.notes.forEach(function (n) {
          if (found) return;
          if (__vs.views().reduce(function (k, vv) {
                return k + vv.books.filter(function (bb) {
                  return bb.notes.some(function (nn) { return nn.id === n.id; });
                }).length;
              }, 0) >= 2) found = { book: b.id, note: n.id };
        });
      });
    });
    if (!found) return { found: false };
    __vs.openBook(found.book, found.note);
    var links = document.querySelectorAll("#vs-alsoin button");
    if (!links.length) return { found: true, links: 0 };
    var from = __vs.reader().book;
    links[0].click();
    var to = __vs.reader();
    return { found: true, links: links.length, from: from, to: to.book, note: to.note, wanted: found.note };
  })()`);
  if (!r.found) return { ok: false, detail: "no note appears in two books in this vault" };
  return { ok: r.links > 0 && r.to !== r.from && r.note === r.wanted,
           detail: `${r.links} other shelves offered; ${r.from} -> ${r.to}, still on the same note: ` +
                   `${r.note === r.wanted}` };
});

check("previous collection walks back, and Alt+Left does the same", async (p) => {
  const r = await p.j(`(function(){
    var books = [];
    __vs.views().forEach(function (v) { v.books.forEach(function (b) { if (b.notes.length) books.push(b.id); }); });
    __vs.openBook(books[0], null);
    __vs.openBook(books[1], null);
    var atSecond = __vs.reader().book;
    document.getElementById("vs-prevcollection").click();
    var afterButton = __vs.reader().book;
    __vs.openBook(books[1], null);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
    return { first: books[0], second: books[1], atSecond: atSecond,
             afterButton: afterButton, afterKey: __vs.reader().book };
  })()`);
  return { ok: r.afterButton === r.first && r.afterKey === r.first,
           detail: `${r.first} -> ${r.second}; the button came back to ${r.afterButton}, ` +
                   `Alt+Left to ${r.afterKey}` };
});

check("a click off the book puts it down, and a click on it does not", async (p) => {
  const r = await p.j(`(function(){
    var press = function (el, x, y) {
      ["mousedown", "mouseup", "click"].forEach(function (type) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                                                clientX: x, clientY: y }));
      });
    };
    __vs.openBook(__vs.addresses()[0], null);
    var readerEl = document.getElementById("vs-reader");
    var spread = document.querySelector("#vs-reader .vs-spread");
    var box = spread.getBoundingClientRect();
    /* On the book: the note's own text, well inside the cover. */
    var onBook = document.elementFromPoint(box.left + box.width * 0.7, box.top + box.height * 0.5);
    press(onBook, box.left + box.width * 0.7, box.top + box.height * 0.5);
    var stillOpen = !readerEl.hidden;
    /* Off the book: the desk to the left of the cover, at the book's own height. */
    var host = readerEl.getBoundingClientRect();
    var deskX = host.left + Math.max(4, (box.left - host.left) / 2);
    var deskY = box.top + box.height * 0.5;
    var desk = document.elementFromPoint(deskX, deskY);
    var deskIsReader = desk === readerEl || (desk && !desk.closest(".vs-spread"));
    press(desk, deskX, deskY);
    var closed = readerEl.hidden;
    /* A selection dragged from the page out onto the desk must not close it. */
    __vs.openBook(__vs.addresses()[0], null);
    onBook = document.elementFromPoint(box.left + box.width * 0.7, box.top + box.height * 0.5);
    onBook.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: box.left + 300, clientY: deskY }));
    desk.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: deskX, clientY: deskY }));
    desk.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: deskX, clientY: deskY }));
    var survivedDrag = !readerEl.hidden;
    __vs.closeReader();
    return { stillOpen: stillOpen, deskIsReader: deskIsReader, closed: closed,
             survivedDrag: survivedDrag, gutter: Math.round(box.left - host.left) };
  })()`);
  const ok = r.stillOpen && r.deskIsReader && r.closed && r.survivedDrag;
  return {
    ok,
    detail: `a click on the page leaves the book open (${r.stillOpen}); a click on the desk ` +
            `${r.gutter}px to its left (${r.deskIsReader ? "off the book" : "NOT off the book"}) ` +
            `puts it down (${r.closed}); a selection dragged off the cover does not (${r.survivedDrag})`
  };
});

check("escape closes the reader and leaves the shelf where it was", async (p) => {
  const r = await p.j(`(function(){
    var library = document.getElementById("vs-library");
    library.scrollTop = 80;
    var before = library.scrollTop;
    var spine = document.querySelector("#vs-shelves .vs-spine");
    spine.focus();
    spine.click();
    var open = !document.getElementById("vs-reader").hidden;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return { open: open, closed: document.getElementById("vs-reader").hidden,
             before: before, after: library.scrollTop,
             refocused: document.activeElement === spine };
  })()`);
  return { ok: r.open && r.closed && r.before === r.after && r.refocused,
           detail: `opened, closed on Escape; shelf scroll ${r.before} -> ${r.after}, ` +
                   `focus back on the spine: ${r.refocused}` };
});

check("the reading shelf survives its own shelf being hidden", async (p) => {
  const r = await p.j(`(function(){
    __vs.settings().reading.length = 0;
    __vs.setFilters({});
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!book && b.notes.length && v.shelf.id === "tags") book = b; });
    });
    if (!book) return { found: false };
    __vs.openBook(book.id, null);
    document.querySelector("#vs-marks .vs-markstub").click();
    var noteId = __vs.reader().note;
    __vs.closeReader();
    var before = document.querySelectorAll('#vs-shelves [data-shelf="-reading"] .vs-spine').length;
    __vs.settings().shelves.filter(function (s) { return s.id === "tags"; })[0].hidden = true;
    __vs.setFilters({});
    var after = document.querySelectorAll('#vs-shelves [data-shelf="-reading"] .vs-spine').length;
    var where = __vs.views().filter(function (v) {
      return !v.shelf.hidden && v.books.some(function (b) {
        return b.notes.some(function (n) { return n.id === noteId; });
      });
    }).length;
    __vs.settings().shelves.filter(function (s) { return s.id === "tags"; })[0].hidden = false;
    __vs.settings().reading.length = 0;
    __vs.setFilters({});
    return { found: true, before: before, after: after, where: where, noteId: noteId };
  })()`);
  if (!r.found) return { ok: false, detail: "no tag book to leave a ribbon in" };
  /* design/0002 -- the mark names a note, and resolveReading re-threads it through whatever
   * visible shelf still holds that note. Hiding the shelf it was marked on must not lose it. */
  return { ok: r.before >= 1 && r.after >= 1,
           detail: `a ribbon in ${r.noteId} put ${r.before} book(s) on the Reading shelf; with ` +
                   `the Tags shelf hidden it still shows ${r.after}, re-threaded through ` +
                   `${r.where} other visible shelves` };
});

check("a saved reading place re-resolves after its own book is gone", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var note = __vs.data().notes[0];
    var resolved = core.resolveReading(note.id, "no-such-shelf/no-such-book", __vs.views());
    var holdsIt = resolved ? resolved.notes.some(function (n) { return n.id === note.id; }) : false;
    var missing = core.resolveReading("no-such-note", "no-such-book", __vs.views());
    return { note: note.id, fellBackTo: resolved ? resolved.id : null, holdsIt: holdsIt,
             missing: missing };
  })()`);
  return { ok: r.fellBackTo !== null && r.holdsIt && r.missing === null,
           detail: `a bookmark naming a book that no longer exists fell back to ${r.fellBackTo}, ` +
                   `which holds the note: ${r.holdsIt}; a bookmark for a deleted note resolves to null` };
});

check("the builder previews the shelf it would actually save", async (p) => {
  const r = await p.j(`(function(){
    document.getElementById("vs-newshelf").click();
    document.getElementById("vs-bclassifier").value = "person";
    document.getElementById("vs-bclassifier").dispatchEvent(new Event("change", { bubbles: true }));
    var text = document.getElementById("vs-previewcount").textContent;
    var spines = document.querySelectorAll("#vs-preview .vs-spine").length;
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    document.getElementById("vs-bcancel").click();
    return { text: text, spines: spines, real: people.books.length,
             cancelled: document.getElementById("vs-builder").hidden,
             shelves: __vs.settings().shelves.length };
  })()`);
  const previewed = Number((/(\d+) books?/.exec(r.text) || [0, 0])[1]);
  return { ok: previewed === r.real && r.spines > 0 && r.cancelled,
           detail: `preview said "${r.text}" against a real People shelf of ${r.real} books; ` +
                   `${r.spines} spines drawn; cancel left ${r.shelves} shelves` };
});

check("a saved shelf gets a stable id and joins the library", async (p) => {
  const r = await p.j(`(function(){
    var before = __vs.settings().shelves.length;
    __vs.addShelf({ id: "smoke-status", name: "By status", source: { kind: "all" },
                    classifier: "property", property: "status",
                    direction: "alphabetical", hidden: false, plaques: false });
    var view = __vs.views().filter(function (v) { return v.shelf.id === "smoke-status"; })[0];
    var addresses = __vs.addresses().filter(function (a) { return a.indexOf("smoke-status/") === 0; });
    var drawn = document.querySelectorAll('[data-shelf="smoke-status"] .vs-spine').length;
    var settings = __vs.settings();
    settings.shelves.splice(settings.shelves.findIndex(function (s) { return s.id === "smoke-status"; }), 1);
    __vs.setFilters({});
    return { before: before, books: view ? view.books.length : 0, notes: view ? view.noteCount : 0,
             addresses: addresses.slice(0, 3), drawn: drawn,
             after: __vs.settings().shelves.length };
  })()`);
  return { ok: r.books > 0 && r.drawn === r.books && r.after === r.before,
           detail: `a property shelf on "status" built ${r.books} books over ${r.notes} notes ` +
                   `and drew ${r.drawn} spines; addresses like ${r.addresses.join(", ")}` };
});

check("parent tag inclusion is a setting, and it changes the answer", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var notes = __vs.data().notes;
    var base = { id: "t", name: "t", source: { kind: "tag", value: "garden" },
                 classifier: "tag", direction: "alphabetical", hidden: false, position: 0,
                 plaques: false };
    var withKids = core.buildShelf(Object.assign({}, base, { includeSubtags: true }), notes);
    var without = core.buildShelf(Object.assign({}, base, { includeSubtags: false }), notes);
    return { withKids: withKids.noteCount, without: without.noteCount };
  })()`);
  return { ok: r.withKids >= r.without,
           detail: `#garden collects ${r.withKids} notes with its children, ${r.without} without ` +
                   `-- a difference of ${r.withKids - r.without}` };
});

/* The fixtures name PROSE_ONLY in note bodies and never in a people property. If it ever
 * reaches a note's people list, or earns a book of its own, something started reading prose. */
const PROSE_ONLY = "Dagny Halvorsen";

check("a person is read from every people property, and out of a wikilink", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    return {
      plain: core.cleanPerson("Ada Lovelace"),
      link: core.cleanPerson("[[Ada Lovelace]]"),
      quoted: core.cleanPerson('"[[Ada Lovelace]]"'),
      aliased: core.cleanPerson("[[People/Ada Lovelace|Ada]]"),
      pathed: core.cleanPerson("[[07 - People/Ada Lovelace]]"),
      /* A template placeholder is not a person, and a vault that keeps its templates
       * alongside its notes would otherwise grow a book for one. */
      placeholder: core.cleanPerson("[[{{VALUE}}]]"),
      blank: core.cleanPerson("   "),
      /* The setting is a LIST: a vault carries attendees on a meeting note and person on a
       * 1-on-1, and naming one of them leaves the shelf empty. */
      fields: core.migrate({ schema: 5 }).peopleFields.join(","),
      /* An older file named one property; it is kept, and joined by the conventions. */
      kept: core.migrate({ schema: 4, peopleProperty: "guests" }).peopleFields.join(","),
      chosen: core.migrate({ schema: 5, peopleFields: ["with"] }).peopleFields.join(",")
    };
  })()`);
  const ok = r.plain === "Ada Lovelace" && r.link === "Ada Lovelace" &&
             r.quoted === "Ada Lovelace" && r.aliased === "Ada" &&
             r.pathed === "Ada Lovelace" && r.placeholder === "" && r.blank === "" &&
             r.fields === "people,attendees,person" &&
             r.kept === "guests,people,attendees,person" && r.chosen === "with";
  return {
    ok,
    detail: `"[[People/Ada Lovelace|Ada]]" reads as "${r.aliased}", "[[{{VALUE}}]]" as ` +
            `"${r.placeholder}"; the default properties are ${r.fields}; a file that named ` +
            `"guests" comes up with ${r.kept}, and one that names its own keeps ${r.chosen}`
  };
});

check("a link to a person's note names that person, once, by the note's name", async (p) => {
  const r = await p.j(`(function(){
    var notes = __vs.data().notes;
    var full = "Halvor Estrin", alias = "Halvor";
    var linking = notes.filter(function (n) {
      return (n.body || "").indexOf("[[" + full) >= 0 && n.title !== full;
    });
    var named = notes.filter(function (n) { return n.people.indexOf(full) >= 0; });
    var byAlias = notes.filter(function (n) { return n.people.indexOf(alias) >= 0; });
    var own = notes.filter(function (n) { return n.title === full; })[0];
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    var book = people.books.filter(function (b) { return b.key === full; })[0];
    var aliasBook = people.books.filter(function (b) { return b.key === alias; })[0];
    return { linking: linking.length, named: named.length, byAlias: byAlias.length,
             self: own ? own.people.indexOf(full) >= 0 : null,
             book: book ? book.notes.length : 0, aliasBook: !!aliasBook,
             exact: linking.every(function (n) { return n.people.indexOf(full) >= 0; }) &&
                    named.every(function (n) { return linking.indexOf(n) >= 0; }) };
  })()`);
  if (r.linking === 0) {
    return { ok: true, detail: "this vault has no linked-only person; nothing to assert" };
  }
  const ok = r.exact && r.byAlias === 0 && !r.aliasBook && r.self === false &&
             r.book === r.linking;
  return {
    ok,
    detail: `${r.linking} notes link to Halvor Estrin and no property names them; exactly ` +
            `those ${r.named} carry the name (${r.exact}), the alias earns nobody a book ` +
            `(${r.byAlias} notes, book: ${r.aliasBook}), the person's own note does not name ` +
            `itself (${r.self === false}), and the book holds ${r.book}`
  };
});

check("people come from the property alone, never from prose", async (p) => {
  const r = await p.j(`(function(){
    var sentinel = ${JSON.stringify(PROSE_ONLY)};
    var notes = __vs.data().notes;
    var named = notes.filter(function (n) { return n.people.length; });
    var inProse = notes.filter(function (n) { return (n.body || "").indexOf(sentinel) >= 0; });
    var leaked = notes.filter(function (n) { return n.people.indexOf(sentinel) >= 0; });
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    var book = people.books.filter(function (b) { return b.key === sentinel; })[0];
    var unfiled = people.books.filter(function (b) { return b.key === "-unfiled"; })[0];
    return { named: named.length, inProse: inProse.length, leaked: leaked.length,
             book: !!book, books: people.books.length,
             unfiled: unfiled ? unfiled.notes.length : 0 };
  })()`);
  return { ok: r.leaked === 0 && !r.book && r.inProse > 0,
           detail: `${r.named} notes name someone in their property; "${PROSE_ONLY}" appears in ` +
                   `${r.inProse} note bodies and in ${r.leaked} people lists, with ` +
                   `${r.book ? "a book of its own" : "no book of its own"}; the People shelf has ` +
                   `${r.books} books and ${r.unfiled} notes name no one` };
});

check("plain list mode keeps every book reachable", async (p) => {
  const r = await p.j(`(function(){
    var before = document.querySelectorAll("#vs-shelves .vs-spine").length;
    __vs.setListMode(true);
    var after = document.querySelectorAll("#vs-shelves .vs-spine").length;
    var spine = document.querySelector("#vs-shelves .vs-spine");
    var box = spine.getBoundingClientRect();
    var horizontal = getComputedStyle(spine.querySelector(".vs-title")).writingMode;
    __vs.setListMode(false);
    return { before: before, after: after, width: Math.round(box.width),
             height: Math.round(box.height), writingMode: horizontal };
  })()`);
  return { ok: r.before === r.after && r.writingMode.indexOf("horizontal") === 0,
           detail: `${r.after} of ${r.before} books still present; a row is ${r.width}x${r.height} ` +
                   `with ${r.writingMode} text` };
});

check("every control the keyboard can reach has a name", async (p) => {
  const r = await p.j(`(function(){
    var nameless = [];
    document.querySelectorAll("#vs-app button, #vs-app input, #vs-app select").forEach(function (node) {
      var name = (node.getAttribute("aria-label") || node.textContent || "").trim();
      if (!name && node.id) {
        var label = document.querySelector('label[for="' + node.id + '"]');
        if (label) name = label.textContent.trim();
      }
      if (!name && node.closest("label")) name = node.closest("label").textContent.trim();
      if (!name && node.title) name = node.title;
      if (!name && node.placeholder) name = node.placeholder;
      if (!name) nameless.push(node.id || node.className || node.tagName);
    });
    return { total: document.querySelectorAll("#vs-app button, #vs-app input, #vs-app select").length,
             nameless: nameless };
  })()`);
  return { ok: r.nameless.length === 0,
           detail: r.nameless.length ? `${r.nameless.length} unnamed: ${r.nameless.slice(0, 5).join(", ")}`
                                     : `${r.total} controls, all named` };
});

check("nothing on the page reaches the network", async (p) => {
  const r = await p.j(`(function(){
    return { fetches: window.__vsFetches || 0,
             requests: performance.getEntriesByType("resource")
               .filter(function (e) { return /^https?:/.test(e.name); }).length };
  })()`);
  return { ok: r.requests === 0,
           detail: `${r.requests} remote resource(s) requested by the loaded page` };
});

check("a hovered spine shows one peek, big enough to read, and short labels stand upright",
      async (p) => {
  const r = await p.j(`(function(){
    var spines = [].slice.call(document.querySelectorAll("#vs-shelves .vs-spine"));
    var titled = spines.filter(function (b) { return b.hasAttribute("title") || b.hasAttribute("aria-label"); }).length;
    var longest = spines.slice().sort(function (a, b) {
      return (b.getAttribute("data-peek") || "").split("\\n")[0].length -
             (a.getAttribute("data-peek") || "").split("\\n")[0].length;
    })[0];
    longest.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    var peek = document.getElementById("vs-peek");
    var shown = !peek.hidden;
    var box = peek.getBoundingClientRect();
    var name = peek.querySelector(".vs-peekname");
    var nameBox = name.getBoundingClientRect();
    var fontPx = parseFloat(getComputedStyle(name).fontSize);
    var clipped = name.scrollWidth > name.clientWidth + 1;
    var spineBox = longest.getBoundingClientRect();
    var above = box.bottom <= spineBox.top + 1 || box.top >= spineBox.bottom - 1;
    longest.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    var hidden = peek.hidden;
    var upright = spines.filter(function (b) { return b.getAttribute("data-upright") === "1"; });
    var enc = spines.filter(function (b) { return b.getAttribute("data-book").indexOf("encyclopedia/") === 0; });
    var uprightEnc = enc.filter(function (b) { return b.getAttribute("data-upright") === "1"; });
    var mode = uprightEnc.length ? getComputedStyle(uprightEnc[0].querySelector(".vs-title")).writingMode : "";
    var wide = spines.filter(function (b) { return b.querySelector(".vs-title").textContent.length > 3 && b.getAttribute("data-upright") === "1"; }).length;
    return { titled: titled, label: (longest.getAttribute("data-peek") || "").split(" -- ")[0],
             shown: shown, width: Math.round(box.width), fontPx: fontPx, clipped: clipped,
             above: above, hidden: hidden, enc: enc.length, uprightEnc: uprightEnc.length,
             mode: mode, wide: wide, nameLines: Math.round(nameBox.height / (fontPx * 1.4)) };
  })()`);
  const ok = r.titled === 0 && r.shown && r.fontPx >= 13 && !r.clipped && r.above && r.hidden &&
             r.uprightEnc === r.enc && r.mode === "horizontal-tb" && r.wide === 0;
  return {
    ok,
    detail: `${r.titled} spines carry a title or aria-label (two overlays otherwise); hovering ` +
            `"${r.label}" shows one ${r.width}px peek at ${r.fontPx}px, the name in full ` +
            `(${!r.clipped}, ${r.nameLines} line(s)), clear of the spine (${r.above}), gone on ` +
            `leave (${r.hidden}); ${r.uprightEnc}/${r.enc} Encyclopedia labels stand upright ` +
            `(${r.mode}) and no label over three characters does (${r.wide === 0})`
  };
});

check("a spine lifts on hover and holds its size", async (p) => {
  const r = await p.j(`(function(){
    var spine = document.querySelector("#vs-shelves .vs-spine");
    var before = spine.getBoundingClientRect();
    spine.focus();
    var after = spine.getBoundingClientRect();
    return { w: Math.round(before.width), h: Math.round(before.height),
             w2: Math.round(after.width), h2: Math.round(after.height),
             lift: Math.round(before.top - after.top) };
  })()`);
  return { ok: r.w === r.w2 && r.h === r.h2,
           detail: `${r.w}x${r.h} at rest, ${r.w2}x${r.h2} focused, lifted ${r.lift}px` };
});

/* github#5 -- the packing as a diff, against a golden per fixture */
check("the shelves are packed the way the golden snapshot says", async (p, ctx) => {
  const fixture = (ctx.vault || "").split(/[\\/]/).filter(Boolean).pop() || "";
  const name = fixture.replace(/-[0-9a-f]{8}$/, "");
  const file = join(ROOT, "scripts", "layout-snapshots", `${name}.json`);
  if (!name || !existsSync(file)) {
    return { ok: true, detail: `no golden for ${name || "this vault"} -- ` +
                               `node scripts/update-layout-snapshots.mjs writes the three fixtures` };
  }
  await p.send("Emulation.setDeviceMetricsOverride",
               { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false });
  await p.j(`window.dispatchEvent(new Event("resize"))`);
  await sleep(400);
  const now = await p.j(MEASURE);
  await p.send("Emulation.clearDeviceMetricsOverride");
  await p.j(`window.dispatchEvent(new Event("resize"))`);
  await sleep(250);
  const golden = JSON.parse(readFileSync(file, "utf8"));
  const problems = diffLayout(golden, now);
  const rows = now.shelves.reduce((n, s) => n + s.rows, 0);
  const spines = now.shelves.reduce((n, s) => n + s.books, 0);
  const plaques = now.shelves.reduce((n, s) => n + s.plaques.length, 0);
  return {
    ok: problems.length === 0,
    detail: problems.length
      ? `${problems.length} difference(s) against ${name}.json: ` + problems.slice(0, 4).join("; ") +
        (problems.length > 4 ? ` ... (node scripts/update-layout-snapshots.mjs rewrites it)` : "")
      : `${now.shelves.length} shelves, ${rows} rows, ${spines} spines, ${plaques} plaques and a ` +
        `${now.room}px room, all where ${name}.json says at ${VIEWPORT.width}px`
  };
});

/* ---------------------------------------------------- which vaults, and why
 *
 * THREE SHAPES, BY DEFAULT, and none of them needs a vault of yours.
 *
 *   demo vault     ~700 notes across ten declared folders, two years of dates, every
 *                  classifier populated: eight people, thirteen tags including a three-level
 *                  hierarchy and two non-Latin ones, a status property, and a handful of
 *                  deliberately undated notes. The shape the plugin is meant for.
 *   sparse vault   ~756 notes where ONE FOLDER HOLDS 82%, a FIFTH ARE UNDATED, the dates sit
 *                  in two clusters five years apart with a hole between them, titles open
 *                  with digits, punctuation and four scripts, and a few notes name five
 *                  people and six tags at once -- eleven books for one note. Every edge the
 *                  demo vault rounds off.
 *   library vault  10,000 notes over ten years: ~520 week books on one rail, and an
 *                  Encyclopedia volume large enough that the reader's index has to fall back
 *                  to ranges.
 *
 * ALL THREE LIVE IN ONE SHARED STORE, beside the main repo, and invalidate themselves.
 * A fixture lives at <main repo>/.fixtures/<name>-<digest8>, where the digest is sha256 over
 * the CONTENTS of all three generator scripts plus this fixture's args -- content, not mtime,
 * because a branch switch rewrites mtimes without changing a byte. Every worktree resolves
 * the same store through git's common dir, so the gate sees one fixture set no matter where
 * the push runs. Editing a generator changes the digest and the next run regenerates; nothing
 * needs to remember to delete anything.
 *
 * A fixture also AGES BY DESIGN: --end defaults to today so the activity calendar's live year
 * stays exercised, which means the newest note recedes from the real clock from the moment it
 * is written. The stamp in each fixture carries its generation day, and anything older than
 * FIXTURE_MAX_AGE_DAYS regenerates -- the first run each week pays the cost, everyone else
 * reuses. A leftover fixture directory in a checkout root is ignored with a one-line notice;
 * --vault remains the explicit override for pointing the suite at any vault on purpose.
 */
function resolveVaults() {
  const explicit = argAll("vault");
  if (explicit.length) return explicit.map((v) => ({ path: v, label: v }));
  if (arg("url", "")) return [{ path: "", label: "the page passed with --url" }];

  const out = [];
  const GENERATORS = ["make-demo-vault.mjs", "make-sparse-vault.mjs", "make-library-vault.mjs"];
  const FIXTURE_FORMAT = 1;

  const storeRoot = (() => {
    const g = spawnSync("git", ["-C", ROOT, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
    if (g.status === 0 && g.stdout.trim()) {
      const common = g.stdout.trim();
      const abs = /^[A-Za-z]:[\\/]|^\//.test(common) ? common : join(ROOT, common);
      return join(dirname(abs), ".fixtures");
    }
    return join(ROOT, ".fixtures");
  })();

  const digestOf = (args) => {
    const h = createHash("sha256");
    h.update("format:" + FIXTURE_FORMAT);
    for (const g of GENERATORS) h.update(readFileSync(join(HERE, g)));
    h.update(JSON.stringify(args));
    return h.digest("hex").slice(0, 8);
  };

  const todayDay = () => new Date().toISOString().slice(0, 10);
  const ageDays = (day) => Math.floor((Date.parse(todayDay()) - Date.parse(day)) / 86400000);
  // github#8
  const ABANDONED_BUILD_MS = 60 * 60 * 1000;
  const SCRATCH = [".building-", ".retired-"];
  const ageMs = (p) => { try { return Date.now() - statSync(p).mtimeMs; } catch { return 0; } };

  /* github#8, decisions/0011 */
  const isFresh = (d, digest, pinned) => {
    try {
      const st = JSON.parse(readFileSync(join(d, ".stamp.json"), "utf8"));
      return st.digest === digest &&
             (pinned || (typeof st.day === "string" && ageDays(st.day) <= FIXTURE_MAX_AGE_DAYS));
    } catch { return false; }
  };

  const gen = (script, args, name, label) => {
    const digest = digestOf(args);
    const dir = join(storeRoot, `${name}-${digest}`);
    const pinned = args.indexOf("--end") >= 0;
    if (!isFresh(dir, digest, pinned)) {
      console.log(`generating ${label} ...`);
      const building = join(storeRoot, `.building-${name}-${process.pid}`);
      rmSync(building, { recursive: true, force: true });
      mkdirSync(storeRoot, { recursive: true });
      const r = spawnSync(process.execPath, [join(HERE, script), "--out", building, ...args],
                          { encoding: "utf8" });
      if (r.status !== 0) {
        console.log(`  cannot generate ${label}: ${(r.stderr || "").trim().split("\n")[0]}`);
        rmSync(building, { recursive: true, force: true });
        return;
      }
      writeFileSync(join(building, ".stamp.json"),
                    JSON.stringify({ digest, day: todayDay(), script, args }, null, 2) + "\n");
      /* github#8, decisions/0011 */
      for (const d of readdirSync(storeRoot)) {
        const full = join(storeRoot, d);
        if (SCRATCH.some((pre) => d.startsWith(pre))) {
          if (d.endsWith(`-${name}-${process.pid}`)) continue;
          if (ageMs(full) > ABANDONED_BUILD_MS) rmSync(full, { recursive: true, force: true });
          continue;
        }
        if (!d.startsWith(`${name}-`) || d === `${name}-${digest}`) continue;
        // github#8, decisions/0011
        let sib = null;
        try { sib = JSON.parse(readFileSync(join(full, ".stamp.json"), "utf8")); } catch { sib = null; }
        const sibPinned = !!(sib && Array.isArray(sib.args) && sib.args.indexOf("--end") >= 0);
        if (sib && typeof sib.day === "string" && !sibPinned &&
            ageDays(sib.day) > FIXTURE_MAX_AGE_DAYS) {
          rmSync(full, { recursive: true, force: true });
        }
      }
      /* github#8, decisions/0011 */
      if (existsSync(dir) && isFresh(dir, digest, pinned)) {
        console.log(`  another run published ${name}-${digest} first -- using theirs`);
        rmSync(building, { recursive: true, force: true });
      } else {
        if (existsSync(dir)) {
          const away = join(storeRoot, `.retired-${name}-${process.pid}`);
          rmSync(away, { recursive: true, force: true });
          renameSync(dir, away);
          renameSync(building, dir);
          rmSync(away, { recursive: true, force: true });
        } else {
          renameSync(building, dir);
        }
      }
    }
    if (existsSync(join(ROOT, name))) {
      console.log(`  note: ${name}/ exists in this checkout and is IGNORED -- the suite uses ` +
                  `the shared store (${dir}); pass --vault to use a specific vault on purpose`);
    }
    // github#5, decisions/0010
    const desc = describeFixture(dir);
    out.push({ path: dir, label, fixture: desc ? { name, ...desc } : null });
  };

  gen("make-demo-vault.mjs", [], "demo-vault", "the demo vault (every classifier populated)");
  gen("make-sparse-vault.mjs", [], "sparse-vault", "the sparse vault (undated, lopsided, multiscript)");
  gen("make-library-vault.mjs", ["--notes", "10000", "--years", "10"], "library-vault",
      "the 10k library vault (10 years)");

  if (!out.length) throw new Error("no vault to check, and none could be generated");
  return out;
}

async function buildFor(v) {
  if (arg("url", "")) return "";
  const scratch = join(mkdtempSync(join(tmpdir(), "vs-smoke-build-")), "vault-shelf.html");
  const b = spawnSync(process.execPath,
                      [join(HERE, "..", "src", "build-shelf.mjs"), "--out", scratch]
                        .concat(v.path ? ["--vault", v.path] : []),
                      { encoding: "utf8" });
  if (b.status !== 0) return "";
  const m = /^wrote (.+) \(/m.exec(b.stdout || "");
  if (!m) return "";
  console.log((b.stdout || "").trimEnd());
  return pathToFileURL(m[1].trim()).href;
}

/* --------------------------------------------------------------- one run -- */

async function runOne(vault, work) {
  const mine = work && work.checks ? work.checks : selected();
  const slot = GRID && work && work.slot !== undefined ? gridSlot(work.slot, work.slots) : null;
  const lines = [];
  const log = (m) => lines.push(m === undefined ? "" : String(m));
  let url = (work && work.url) || arg("url", "");
  let scratch = null;
  if (!url) {
    scratch = join(mkdtempSync(join(tmpdir(), "vs-smoke-build-")), "vault-shelf.html");
    const b = spawnSync(process.execPath,
                        [join(HERE, "..", "src", "build-shelf.mjs"), "--out", scratch]
                          .concat(vault ? ["--vault", vault] : []),
                        { encoding: "utf8" });
    log((b.stdout || "").trimEnd());
    if (b.status !== 0) throw new Error("build-shelf.mjs failed:\n" + (b.stderr || ""));
    const m = /^wrote (.+) \(/m.exec(b.stdout || "");
    if (!m) throw new Error("could not tell where the build landed; pass --url");
    url = pathToFileURL(m[1].trim()).href;
  }
  log(`checking ${url}\n`);

  const PORT = PINNED_PORT || (work && work.port) || (await freePort());

  /* decisions/0008 -- ONE BROWSER PER RUN. Attaching to a leaked browser from an earlier run
   * silently measures the wrong page, and every check then reports a number that has nothing
   * to do with the code under it. */
  if (PINNED_PORT) {
    let alive = false;
    try { await json(PORT, "/json/version"); alive = true; } catch { alive = false; }
    if (alive) {
      throw new Error(
        `something is already serving CDP on port ${PORT}.\n` +
        "A previous run leaked its browser, and attaching to it would silently measure the\n" +
        "wrong page. Close it and re-run, or kill whatever is holding the port."
      );
    }
  }

  const profile = mkdtempSync(join(tmpdir(), "vs-smoke-"));
  const chrome = spawn(findChrome(), [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-component-update", "--disable-client-side-phishing-detection",
    "--disable-sync", "--no-service-autorun", "--disable-domain-reliability",
    "--metrics-recording-only", "--no-pings", "--mute-audio",
    "--disable-breakpad", "--disable-crash-reporter",
    "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    /* design/0006 -- ON THE LEFT SCREEN, headed or not. A headless window is invisible and a
     * headed one is not: leaving Chrome to place itself put a test window on top of whatever
     * the person is actually doing. There is one machine here and it has a monitor the
     * harness is allowed to use. */
    ...(slot ? [`--window-position=${slot.x},${slot.y}`] : [leftWindowPos()]),
    slot ? `--window-size=${slot.w},${slot.h}` : "--window-size=1600,1000", `--app=${url}`
  ], { stdio: ["ignore", "ignore", "pipe"], detached: false });
  // github#8
  liveBrowsers.add(chrome);

  const chromeSaid = [];
  if (chrome.stderr) {
    chrome.stderr.setEncoding("utf8");
    chrome.stderr.on("data", (d) => {
      for (const line of String(d).split("\n")) {
        const t = line.trim();
        if (t) chromeSaid.push(t);
      }
      while (chromeSaid.length > 40) chromeSaid.shift();
    });
  }
  let chromeGone = null;
  chrome.on("exit", (code, sig) => { chromeGone = "exit " + code + (sig ? " " + sig : ""); });

  let page = null;
  try {
    const want = url.split("/").slice(-2)[0] || url;
    const deadline = Date.now() + 25000;
    for (;;) {
      try { page = await attach(PORT, want); break; }
      catch (e) { if (Date.now() > deadline) throw e; await sleep(400); }
    }
    const errors = [];
    await page.send("Runtime.enable").catch(() => {});
    page.on((msg) => {
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params && msg.params.exceptionDetails;
        errors.push((d && d.exception && d.exception.description) || (d && d.text) || "exception");
      }
    });

    let at = "";
    for (const wait = Date.now() + 8000; ;) {
      at = await page.eval("location.href").catch(() => "");
      if (!at || at === url || Date.now() > wait) break;
      await sleep(250);
    }
    if (at && at !== url) {
      throw new Error(
        `attached to the wrong page.\n  wanted ${url}\n  got    ${at}\n` +
        "That is a leaked browser from an earlier run, not a defect in the page."
      );
    }

    const ready = Date.now() + 30000;
    for (;;) {
      const ok = await page.eval("!!(window.__vs && window.VaultShelfCore && __vs.counts().spines > 0)")
        .catch(() => false);
      if (ok) break;
      if (Date.now() > ready) throw new Error("the library never finished rendering");
      await sleep(300);
    }

    page.j = async (expr) => JSON.parse(await page.eval(`JSON.stringify(${expr})`));
    const ctx = { errors, vault };

    /* Through the selector where it offers the look, as a person would; through the debug
     * handle for a shelved one the selector cannot reach (design/0017). "modern" is the
     * default look, whose value is "". */
    if (LOOK) {
      await page.eval(`(function(){
        var want = ${JSON.stringify(LOOK === "modern" ? "" : LOOK)};
        var sel = document.getElementById("vs-look");
        var offered = sel && [].slice.call(sel.options).some(function (o) { return o.value === want; });
        if (offered) {
          sel.value = want;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          __vs.setLook(want);
        }
      })(); void 0`);
      await sleep(200);
    }

    let failed = 0;
    const timings = [];
    for (const c of mine) {
      if (page.lost) {
        log(`\n  !! CDP connection lost (${page.lost}) -- ${mine.length - timings.length} check(s) not run`);
        if (chromeGone) log(`     chrome process: ${chromeGone}`);
        for (const l of chromeSaid.slice(-12)) log("       " + l);
        failed += mine.length - timings.length;
        break;
      }
      try {
        await page.eval("1");
      } catch (e) {
        const last = timings.length ? timings[timings.length - 1].name : "(before the first check)";
        log(`\n  !! the page stopped answering after "${last}" -- ${e.message}`);
        if (chromeGone) log(`     chrome process: ${chromeGone}`);
        for (const l of chromeSaid.slice(-12)) log("       " + l);
        log(`     ${mine.length - timings.length} check(s) not run`);
        failed += mine.length - timings.length;
        break;
      }
      let r;
      const t0 = Date.now();
      try { r = await c.fn(page, ctx); }
      catch (e) { r = { ok: false, detail: "threw: " + e.message }; }
      const ms = Date.now() - t0;
      timings.push({ name: c.name, ms });
      if (!r.ok) failed++;
      const secs = ms >= 1000 ? ` ${(ms / 1000).toFixed(1)}s` : "";
      log(`${r.ok ? "  ok  " : " FAIL "} ${c.name}${secs}\n         ${r.detail}`);
    }

    /* One file per vault shape when more than one is running, or three runs write three
     * pictures to one name and you are looking at whichever finished last. */
    if (SHOT) {
      await capture(page, work && work.vault && work.vault.label
        ? tagged(SHOT, work.vault.label) : SHOT);
    }

    const total = timings.reduce((a, t) => a + t.ms, 0);
    const slow = timings.slice().sort((a, b) => b.ms - a.ms).slice(0, 5);
    log(`\n${mine.length - failed}/${mine.length} passed in ${(total / 1000).toFixed(0)}s`);
    log("slowest: " + slow.map((t) => `${t.name} ${(t.ms / 1000).toFixed(1)}s`).join(", "));
    return { failed, ran: mine.length, lines, timings };
  } finally {
    try { if (page) await page.send("Browser.close"); } catch { }
    if (page) page.close();
    await killBrowser(chrome, PORT);
    // github#8
    liveBrowsers.delete(chrome);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
    if (scratch) { try { rmSync(dirname(scratch), { recursive: true, force: true }); } catch {} }
  }
}

/**
 * design/0006 -- THE ONE THING IN HERE THAT CAN SEE. Two pictures, because the two halves of
 * the product fail differently and both have done: the library, and a book open at a note.
 * Taken from the same page the checks just drove, so what is in the picture is what was
 * measured rather than a second run that might differ.
 */
/** "out.png" + "the sparse vault (...)" -> "out-sparse.png". */
function tagged(out, label) {
  const m = /^the (\w+)/.exec(label);
  const word = m ? m[1] : "vault";
  return out.replace(/(\.png)?$/i, "-" + word + ".png");
}

async function capture(page, out) {
  const shoot = async (file) => {
    const r = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(file, Buffer.from(r.data, "base64"));
    console.log("wrote " + file);
  };
  await page.eval('__vs.closeReader(); document.getElementById("vs-library").scrollTop = 0; void 0');
  if (SHOT_OPEN) {
    await page.eval(`(function(){
      var sheet = ${JSON.stringify(SHOT_OPEN)};
      if (sheet === "builder") { document.getElementById("vs-newshelf").click(); return; }
      document.getElementById("vs-manageopen").click();
      var pick = function (sel, value) {
        var input = document.querySelector(sel);
        if (!input) return;
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      pick('#vs-mpalette .vs-dyerows tbody tr:nth-child(3) td:nth-child(2) input[type="color"]', "#3355aa");
      pick('#vs-mpalette .vs-dyerows tbody tr:nth-child(2) td:nth-child(3) input[type="color"]', "#2a9d5c");
    })(); void 0`);
  }
  await sleep(250);
  await shoot(out);
  if (SHOT_OPEN) {
    await page.eval(`(function(){
      if (${JSON.stringify(SHOT_OPEN)} === "builder") { document.getElementById("vs-bcancel").click(); return; }
      document.getElementById("vs-mpalettereset").click();
      document.getElementById("vs-mclose").click();
    })(); void 0`);
  }

  const opened = SHOT_NOTE
    ? await page.j(`(function(){
        var want = ${JSON.stringify(SHOT_NOTE)};
        var note = __vs.data().notes.filter(function (n) { return n.title === want; })[0];
        if (!note) return false;
        var home = null;
        __vs.views().forEach(function (v) { v.books.forEach(function (b) {
          if (!home && b.notes.some(function (n) { return n.id === note.id; })) home = b.id;
        }); });
        return home ? __vs.openBook(home, note.id) : false;
      })()`)
    : await page.j('__vs.openBook(__vs.addresses()[0], null)');
  if (opened) {
    /* WITH RIBBONS IN IT. A reader with none shows an empty strip where the feature is, which
     * is a picture of the wrong thing; two are marked for the shot and taken out again. */
    const marked = await page.j(`(function(){
      var book = __vs.reader();
      var notes = __vs.views().reduce(function (all, v) {
        return all.concat(v.books.filter(function (b) { return b.id === book.book; }));
      }, [])[0];
      if (!notes || notes.notes.length < 3) return 0;
      var ids = [notes.notes[1].id, notes.notes[2].id];
      ids.forEach(function (id) {
        __vs.openBook(book.book, id);
        document.querySelector("#vs-marks .vs-markstub").click();
      });
      __vs.openBook(book.book, notes.notes[1].id);
      return ids.length;
    })()`);
    /* The ribbons are set for the picture; the note asked for is still the note the picture
     * is of, so it is opened again after the marking moved the reader off it. */
    if (SHOT_NOTE) {
      await page.j(`(function(){
        var want = ${JSON.stringify(SHOT_NOTE)};
        var note = __vs.data().notes.filter(function (n) { return n.title === want; })[0];
        var here = __vs.reader();
        return note && here ? __vs.openBook(here.book, note.id) : false;
      })()`);
    }
    await sleep(400);
    await shoot(out.replace(/(\.png)?$/i, "-reader.png"));
    if (marked) {
      await page.eval(`(function(){
        var book = __vs.reader();
        [].slice.call(document.querySelectorAll("#vs-marks .vs-mark")).length;
        __vs.data();
      })(); void 0`);
    }
    await page.eval("__vs.closeReader(); void 0");
  }
}

async function killBrowser(child, PORT) {
  const gone = async () => {
    try { await json(PORT, "/json/version"); return false; } catch { return true; }
  };

  try {
    const b = await attach(PORT, "");
    await b.send("Browser.close").catch(() => {});
    b.close();
  } catch {}
  for (let i = 0; i < 20; i++) {
    if (await gone()) return;
    await sleep(100);
  }

  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
  try { child.kill(); } catch {}
  for (let i = 0; i < 20; i++) {
    if (await gone()) return;
    await sleep(100);
  }

  if (process.platform === "win32") {
    const out = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" }).stdout || "";
    const owners = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("127.0.0.1:" + PORT) && !line.includes("[::1]:" + PORT)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (/^\d+$/.test(pid) && pid !== "0") owners.add(pid);
    }
    for (const pid of owners) spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
    for (let i = 0; i < 20; i++) {
      if (await gone()) return;
      await sleep(100);
    }
  }

  console.log(`  !! a browser is still holding port ${PORT} after teardown`);
}

/* ------------------------------------------------------------------- main -- */

async function main() {
  const picked = selected();
  if (ONLY.length && !picked.length) {
    throw new Error(`--only ${ONLY.join(", ")} matched none of the ${all.length} checks`);
  }
  if (ONLY.length) {
    console.log(`--only: ${picked.length} of ${all.length} checks -- ` +
                picked.map((c) => c.name).join("; "));
    console.log("");
  }
  // github#8, decisions/0011
  takeLock();
  const vaults = resolveVaults();
  console.log(`checking ${vaults.length} vault(s): ${vaults.map((v) => v.label).join(", ")}`);

  const shaky = picked.filter(isSerial);
  const steady = picked.filter((c) => !isSerial(c));
  const shard = (list, k) => {
    const out = Array.from({ length: k }, () => []);
    list.forEach((c, i) => out[i % k].push(c));
    return out.filter((g) => g.length);
  };

  const lanePorts = PINNED_PORT ? [] : await freePorts(Math.max(JOBS, 1));

  const parallel = [], serial = [];
  for (const v of vaults) {
    const url = await buildFor(v);
    for (const g of shard(steady, JOBS)) {
      parallel.push({ vault: v, checks: g, tag: v.label, url });
    }
    if (shaky.length) {
      serial.push({ vault: v, checks: shaky, tag: v.label + " (layout-reading, serial)", url });
    }
  }
  if (JOBS > 1) {
    console.log(`${JOBS} jobs: ${parallel.length} parallel shard(s) of ${steady.length} checks, ` +
                `then ${serial.length} serial job(s) of ${shaky.length} layout-reading one(s)`);
  }
  console.log("");

  const failures = new Map();
  const ran = new Map();
  const bump = (label, r) => {
    failures.set(label, (failures.get(label) || 0) + r.failed);
    ran.set(label, (ran.get(label) || 0) + r.ran);
  };
  const report = (work, r) => {
    console.log("=".repeat(72));
    console.log("== " + work.tag);
    console.log("=".repeat(72));
    for (const l of r.lines) console.log(l);
    console.log("");
  };

  const pool = async (list, width) => {
    let next = 0;
    const worker = async (lane) => {
      for (;;) {
        const i = next++;
        if (i >= list.length) return;
        const w = { ...list[i], slot: lane, slots: Math.min(width, list.length),
                    port: lanePorts[lane] || 0 };
        let r;
        try { r = await runOne(w.vault.path, w); }
        catch (e) {
          r = { failed: w.checks.length, ran: w.checks.length,
                lines: ["  !! this job did not run: " + e.message], timings: [] };
        }
        report(w, r);
        bump(w.vault.label, r);
      }
    };
    await Promise.all(Array.from({ length: Math.min(width, list.length) }, (_, lane) => worker(lane)));
  };

  await pool(parallel, JOBS);
  await pool(serial, 1);

  let worst = 0;
  for (const v of vaults) worst = Math.max(worst, failures.get(v.label) || 0);

  if (vaults.length > 1 || JOBS > 1) {
    console.log("=".repeat(72));
    for (const v of vaults) {
      const f = failures.get(v.label) || 0, t = ran.get(v.label) || 0;
      console.log(`  ${f ? "FAIL" : " ok "}  ${t - f}/${t}  ${v.label}`);
    }
  }
  // github#5, decisions/0010
  const partial = ONLY.length ? "--only" : argAll("vault").length ? "--vault"
                : arg("url", "") ? "--url" : LOOK ? "--look"
                : vaults.some((v) => !v.fixture) ? "an unstamped fixture"
                : FIXTURE_NAMES.some((n) => !vaults.some((v) => v.fixture.name === n))
                  ? "a fixture that could not be generated" : "";
  if (!worst && !partial) {
    let checks = 0;
    for (const t of ran.values()) checks += t;
    const r = recordPass({ fixtures: vaults.map((v) => v.fixture), checks });
    console.log(r.wrote ? `stamped tree ${r.tree.slice(0, 7)} as passed: ${r.wrote}`
                        : `not stamping this run: ${r.why}`);
  } else if (!worst) {
    console.log(`not stamping this run: ${partial} is not the full suite`);
  }
  if (worst) {
    console.log("");
    console.log("Not covered here, check by hand: anything about how it LOOKS.");
    console.log('Take a picture: node scripts/smoke.mjs --only "<one check>" --shot out.png');
  }
  return worst ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error("smoke failed to run:", e.message);
  process.exit(1);
});
