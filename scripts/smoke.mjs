import { attach, json } from "./cdp.mjs";
// github#50
import { HEADED, findChrome, harnessChromeArgs } from "./chrome.mjs";
import { leftmostScreen, leftWindowPos, takeLeftScreen, dropLeftScreen } from "./screen.mjs";
// github#25, github#37, decisions/0012
import { acquire, adopt, heldBy, ownerTag } from "./lock.mjs";
// github#5, decisions/0010
import { FIXTURE_MAX_AGE_DAYS, FIXTURE_NAMES, describeFixture,
         record as recordPass, forget as forgetPass, GREENS_REQUIRED } from "./suite-stamp.mjs";
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
const LOCK_OWNER = ownerTag("smoke.mjs");
/** @type {{ release: () => void } | null} */
let suiteLock = null;

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

/* github#25, decisions/0012 */
function lostLock(who) {
  suiteLock = null;
  console.error("\nsmoke: the suite lock was taken by " + who + " while this run was measuring.\n" +
                "Everything from here on would be measured on a contended machine, so this run " +
                "stops\nrather than publishing it. github#25.");
  killLiveBrowsers();
  dropLeftScreen();
  process.exit(1);
}

/* github#25 -- the same abort for the display the windows are parked on */
function lostScreen(who) {
  console.error("\nsmoke: the left screen was taken by " + who + " while this run was measuring.\n" +
                "Its windows now share the display, so this run stops rather than publishing " +
                "it.\ngithub#25.");
  killLiveBrowsers();
  process.exit(1);
}

/* github#8, github#37, decisions/0011, decisions/0012 */
async function takeLock() {
  if (NO_LOCK) {
    /* github#25 -- the caller's CLI hold neither beats nor notices */
    suiteLock = adopt("suite", { onLost: lostLock });
    if (suiteLock) {
      console.log("--no-lock: beating the suite lock held by " + suiteLock.owner);
    } else {
      console.error("\nsmoke: --no-lock says a caller is holding the suite lock, but no live " +
                    "hold is there.\nIt was never taken, or it has already been lost. This run " +
                    "would measure on a\nmachine nothing is guarding. github#25.");
      process.exit(1);
    }
  } else {
    try {
      suiteLock = await acquire("suite", { owner: LOCK_OWNER, timeoutMs: LOCK_TIMEOUT_MS,
                                           onLost: lostLock });
    } catch (e) {
      if (e.code !== "BUSY") throw e;
      console.log(e.message);
      console.error("\nsmoke: could not take the suite lock -- another suite is running on this " +
                    "machine.\nSee who holds it with: node scripts/lock.mjs status\n\n" +
                    "If YOU are holding it -- you wrapped this run in lock.mjs yourself, the way " +
                    "the\ndocs used to tell you to -- then it is waiting for its own parent. Drop " +
                    "the wrapper,\nor pass --no-lock.");
      process.exit(1);
    }
  }
  /* github#37 -- --no-lock names the suite lock; no parent ever holds the screen, so this run
   * claims the display it is about to park a window on either way. */
  await takeLeftScreen(LOCK_OWNER, { timeoutMs: LOCK_TIMEOUT_MS, onLost: lostScreen });
}

/* github#8, github#37, decisions/0011, decisions/0012 */
function dropLock() {
  if (suiteLock) {
    const lock = suiteLock;
    suiteLock = null;
    lock.release();
  }
  dropLeftScreen();
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
/* github#50, design/0006 -- --headed lives in chrome.mjs, and now does something */
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

/* -------------------------------------------------------------- the checks */

const all = [];
// github#39, decisions/0013, decisions/0014 -- the guard is why the parameter stays
const check = (name, fn, opts) => {
  const on = !opts || !opts.on || opts.on === "all" ? FIXTURE_NAMES.slice() : [].concat(opts.on);
  const stray = on.filter((n) => !FIXTURE_NAMES.includes(n));
  if (stray.length) {
    throw new Error(`check "${name}" asks for fixture(s) ${stray.join(", ")}, which do not ` +
                    `exist; the fixtures are ${FIXTURE_NAMES.join(", ")}`);
  }
  all.push({ name, fn, on });
};

const ONLY = argAll("only").map((v) => v.toLowerCase());
const selected = () => (ONLY.length
  ? all.filter((c) => ONLY.some((q) => c.name.toLowerCase().includes(q)))
  : all);

/* github#39, decisions/0013 -- a ceiling, not a default; --jobs only goes down */
const LANE_CAP = 2;
const JOBS_ASKED = Number(arg("jobs", String(LANE_CAP))) || LANE_CAP;
const JOBS = Math.max(1, Math.min(LANE_CAP, JOBS_ASKED));
/* NUMBERS CANNOT SEE, and this is the only thing in the repo that can. `--shot out.png` writes
 * the library and, beside it, `out-reader.png` of an open book -- from the same Chrome the
 * checks are driving, with no Obsidian involved. Use it with `--only` and one vault, or you
 * will be looking at whichever of three shapes finished last. */
const SHOT = arg("shot", "");
/* github#39 -- every check's ms per shape, as JSON */
const TIMINGS = arg("timings", "");
const LOOK = arg("look", "");
/* `--shot-note "<title>"` opens that note for the reader picture instead of the first book,
 * which is how a rendering complaint about one particular note gets looked at. */
const SHOT_NOTE = arg("shot-note", "");
/* `--shot-open manage|builder|swatch` takes the library picture with that sheet open. Manage
 * is shot with one slot and the ribbon changed, because a colours block with nothing changed
 * shows none of the marks the block exists to show; both are put back before the sheet closes.
 * github#44 -- `swatch` shoots a live preview with one of them hovered */
const SHOT_OPEN = arg("shot-open", "");
/* github#13 -- --shot-query shoots a room and a book mid-search */
const SHOT_QUERY = arg("shot-query", "");
/* github#11 */
const SHOT_BOOK = arg("shot-book", "");
const SHOT_TAB = arg("shot-tab", "");
/* github#12 */
const SHOT_SHELF = arg("shot-shelf", "");
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
  "first matching contents row",
  "has a width",
  "same size",
  /* design/0018 -- a drop is a pointer position against a box, and it has to scroll a shelf
   * into view before it can read one. */
  "drag and drop",
  /* github#5 -- a golden of every box on the page, read at a fixed viewport. */
  "golden snapshot",
  /* design/0019 -- the same, onto the Favourites rail, and the drag that takes one off it. */
  "onto Favourites",
  "dragged off",
  /* design/0019 -- it clicks the builder open and reads the form it draws. */
  "second favourites shelf",
  /* github#0 -- it reads boxes: a drop on the lower half of a shelf, and a floor grip. */
  "carried by its floor",
  /* github#34 -- it scrolls the room under a drag and reads where it got to. */
  "reaches the edge",
  "a carried shelf scrolls",
  /* github#0 -- it reads margins while a drag is in the air. */
  "the room parts",
  /* github#14, design/0021 -- it walks every box on the page, four times, in every look. */
  "moves nothing",
  /* github#19, design/0037 -- they press a flag and read where the mark landed. */
  "sticky note takes",
  "details line",
  "alias the note",
  "own subject and no other",
  /* github#44, design/0022 -- it reads every spine's box, before and after a hover. */
  "hovered swatch",
  "leather bindings",
  "older books wear",
  "manage colour rules",
  "automatic keeps",
  "a right-click dyes",
  /* github#29 -- it counts plates and reads tints, so it reads the packing */
  "its whole run from either copy",
  /* github#45 -- it reads every spine's title box and the rules drawn on it */
  "touches a line",
  /* design/0020 -- a right-click and a drag off the rail read boxes. */
  "made on the shelf",
  "edited, emptied",
  "any shelf arranged by hand",
  /* github#38 -- it overrides the viewport and reads every box in the rail. */
  "scrolls sideways",
  /* github#32, design/0034 -- they drive the window to two heights, open forty books and read
   * every cut's box. "tabs" above caught every check that did this while they were all named
   * for tabs; these are named for cuts, so they say so here instead. */
  "shrunk past reading",
  "under the trail it came through",
  "the deepest the page has reached",
];
const isSerial = (c) => POINTER_DRIVEN.some((q) => c.name.toLowerCase().includes(q));

/* github#32, design/0033 -- opening a book is a write: it bumps `wear` and `lastOpened`, and
 * wear is paint on a spine, so a check that opens forty of them and walks away has moved what
 * every check after it measures. Held before, put back after. */
const holdWear = async (p) => {
  await p.eval("window.__savedWear = JSON.stringify([__vs.settings().wear, __vs.settings().lastOpened]);");
  return () => p.eval(`(function(){
    var was = JSON.parse(window.__savedWear);
    __vs.settings().wear = was[0];
    __vs.settings().lastOpened = was[1];
    delete window.__savedWear;
    __vs.setFilters({});
  })(); void 0`);
};

/* github#77, decisions/0017 -- both smoothness checks share this, page side */
const FRAME_HELPERS = `(function(){
  window.__fr = {
    /* A FIXED VELOCITY, turned round at either end, so the pixels crossed per frame never
     * depend on how far the thing being scrolled happens to reach. Covering a whole span in a
     * fixed time does not measure one thing: it made the 1494px room this sees under --only
     * 36% faster than the 1102px one it sees in a full suite. */
    sweep: function (el, ms, pxPerSec) {
      return new Promise(function (done) {
        el.scrollTop = 0;
        var span = Math.max(1, el.scrollHeight - el.clientHeight);
        var ts = [], start = performance.now();
        function step(now) {
          ts.push(now);
          var gone = (now - start) / 1000 * pxPerSec;
          var leg = Math.floor(gone / span), into = gone - leg * span;
          el.scrollTop = (leg % 2) ? span - into : into;
          if (now - start < ms) requestAnimationFrame(step);
          else { el.scrollTop = 0; done({ ts: ts, span: Math.round(span) }); }
        }
        requestAnimationFrame(step);
      });
    },
    /* THIS MACHINE'S VSYNC, which is the one number neither check may read off the measurement
     * it is judging: a run that drops three frames in four has no single-vsync interval left
     * to find, so the period reads long, the frames expected read few, and the worst run
     * scores best. Two things it took measuring to get right. Call it only once frames are
     * already flowing -- a page nothing has asked to move yet is not being painted, and
     * calibrating first read the period as 396-536ms every run. And it moves a whole pixel per
     * frame rather than creeping, because a scroll too slow to change an integer offset
     * invalidates nothing and the frames stop again. A pixel is a real invalidation and no
     * paint worth the name, so every interval here is one vsync. */
    calibrate: function (el, ms) {
      return new Promise(function (done) {
        var was = el.scrollTop, step1 = was > 0 ? -1 : 1;
        var ts = [], start = performance.now(), n = 0;
        function step(now) {
          ts.push(now);
          el.scrollTop = was + (n++ % 2 ? step1 : 0);
          if (now - start < ms) requestAnimationFrame(step);
          else { el.scrollTop = was; done(ts); }
        }
        requestAnimationFrame(step);
      });
    }
  };
})(); void 0`;

/* github#77, decisions/0017 -- and node side: missed vsyncs, never a percentile */
const frameGaps = (ts) => {
  const iv = [];
  for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]);
  return iv;
};
const frameAt = (up, q) => up[Math.min(up.length - 1, Math.floor(up.length * q))];
const framePeriod = (ts) => frameAt(frameGaps(ts).sort((a, b) => a - b), 0.5);
const frameStats = (s, vsync) => {
  const iv = frameGaps(s.ts);
  const up = iv.slice().sort((a, b) => a - b);
  const elapsed = s.ts[s.ts.length - 1] - s.ts[0];
  return { missed: Math.max(0, Math.round(elapsed / vsync) - iv.length), painted: iv.length,
           p50: frameAt(up, 0.5), p95: frameAt(up, 0.95), worst: up[up.length - 1],
           span: s.span };
};
/* github#77, decisions/0017 -- a period no machine could paint means calibration failed */
const frameSteady = (vsync) => vsync > 6 && vsync < 26;

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

check("the six default shelves are there, in order, Favourites first", async (p) => {
  const ids = await p.j("__vs.views().map(function(v){return v.shelf.id})");
  const want = ["favourites", "encyclopedia", "years", "months", "people", "tags"];
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

/* design/0031 */
check("date contents default to oldest and saved newest settings remain readable", async (p) => {
  const r = await p.j(`(function(){
    var core=window.VaultShelfCore, notes=__vs.data().notes;
    var shelves=core.defaultShelves();
    var shelf=shelves.find(function(s){return s.id==='months';});
    var old=core.buildShelf(shelf,notes,'oldest');
    var recent=core.buildShelf(shelf,notes,'newest');
    var book=old.books.find(function(b){return b.notes.length>6&&b.key!=='-undated';});
    var reverse=recent.books.find(function(b){return b.id===book.id;});
    var rising=book.notes.every(function(n,i){return !i||n.date>=book.notes[i-1].date;});
    var falling=reverse.notes.every(function(n,i){return !i||n.date<=reverse.notes[i-1].date;});
    var enc=shelves.find(function(s){return s.id==='encyclopedia';});
    var alpha=JSON.stringify(core.buildShelf(enc,notes,'oldest'))===JSON.stringify(core.buildShelf(enc,notes,'newest'));
    return {rising:rising,falling:falling,alphabetical:alpha,removed:!document.getElementById('vs-order')};
  })()`);
  return {ok:Object.values(r).every(Boolean),detail:JSON.stringify(r)};
});

/* github#80, decisions/0018 */
check("notes sharing a date list A-Z in both reading directions", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var shelf = core.defaultShelves().find(function (s) { return s.id === 'months'; });
    var note = function (id, title, date, folder) {
      return { id: id, path: id + '.md', title: title, folder: folder || '', date: date,
               people: [], tags: [], props: {}, excerpt: '', body: '' };
    };
    var titles = function (list, order) {
      var book = core.buildShelf(shelf, list, order).books.filter(function (b) {
        return b.key !== '-undated';
      })[0];
      return book.notes.map(function (n) { return n.title; }).join(',');
    };
    var a = note('a', 'Alpha', '2024-03-05');
    var b = note('b', 'Beta', '2024-03-05');
    /* Case counts: the A-Z index lowercases, so a raw < would put Zebra before apple and the
     * two indexes would disagree about a pair the reader can see. */
    var lower = note('c', 'apple', '2024-03-05');
    var upper = note('d', 'Zebra', '2024-03-05');

    /* decisions/0018 -- UNDATED IS NOT PART OF THIS. A null date sorts as '', so it leads
     * oldest-first and trails newest-first, and github#80 was not allowed to move it. Only a
     * folder shelf can hold both in one book; a date shelf sends undated to its own. */
    var mixed = [note('u', 'Undated note', null, 'Notes'),
                 note('x', 'Xi', '2024-03-05', 'Notes'),
                 note('m', 'Mu', '2021-01-01', 'Notes')];
    var byFolder = Object.assign({}, shelf, { id: 'f', classifier: 'folder' });
    var folderRead = function (order) {
      return core.buildShelf(byFolder, mixed, order).books[0].notes
        .map(function (n) { return n.title; }).join(',');
    };

    /* And it has to hold over the real vault, on every same-date run in every book. */
    var all = __vs.data().notes;
    var dated = all.filter(function (n) { return n.date !== null; }).length;
    var groups = 0, affected = 0, scrambled = 0;
    core.buildShelf(shelf, all, 'oldest').books.forEach(function (bk) {
      if (bk.key === '-undated') return;
      var run = [];
      var flush = function () {
        if (run.length > 1) {
          groups++; affected += run.length;
          for (var i = 1; i < run.length; i++) {
            if (run[i - 1].title.toLowerCase() > run[i].title.toLowerCase()) {
              scrambled += run.length; break;
            }
          }
        }
        run = [];
      };
      bk.notes.forEach(function (n, i) {
        if (i && n.date !== bk.notes[i - 1].date) flush();
        run.push(n);
      });
      flush();
    });
    return {
      /* BOTH ORDERS ON DISK -- a comparator that never fires still looks right when the
       * input happens to arrive sorted. */
      oldest: titles([a, b], 'oldest') === 'Alpha,Beta',
      oldestReversedOnDisk: titles([b, a], 'oldest') === 'Alpha,Beta',
      newest: titles([a, b], 'newest') === 'Alpha,Beta',
      newestReversedOnDisk: titles([b, a], 'newest') === 'Alpha,Beta',
      caseInsensitive: titles([upper, lower], 'oldest') === 'apple,Zebra',
      undatedLeadsOldest: folderRead('oldest') === 'Undated note,Mu,Xi',
      undatedTrailsNewest: folderRead('newest') === 'Xi,Mu,Undated note',
      undated: folderRead('oldest') + ' | ' + folderRead('newest'),
      got: titles([b, a], 'oldest'),
      dated: dated, groups: groups, affected: affected, scrambled: scrambled
    };
  })()`);
  const ok = r.oldest && r.oldestReversedOnDisk && r.newest && r.newestReversedOnDisk &&
             r.caseInsensitive && r.undatedLeadsOldest && r.undatedTrailsNewest &&
             r.scrambled === 0;
  return {
    ok,
    detail: `${r.affected} of ${r.dated} dated notes share their date with another ` +
            `(${r.groups} groups); ${r.scrambled} of those sit in a run that is not A-Z. ` +
            `A reversed-on-disk pair read oldest-first gave ${r.got}; undated ${r.undated}`
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

/* github#6, design/0019 */
check("a plaque opens the run it names as one book of unique notes, and both plates of a wrapped run open the same one", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var best = null;
    __vs.views().forEach(function (v) {
      if (v.shelf.hidden) return;
      core.runsOf(v.books).forEach(function (run) {
        if (run.plaque === null) return;
        var seen = {}, sum = 0;
        run.books.forEach(function (b) { sum += b.notes.length; b.notes.forEach(function (n) { seen[n.id] = 1; }); });
        var unique = Object.keys(seen).length;
        var score = (sum - unique) * 1000 + run.books.length;
        if (!best || score > best.score) best = { view: v, run: run, unique: unique, sum: sum, score: score };
      });
    });
    if (!best) return { found: false };
    var shelf = best.view.shelf;
    var before = __vs.addresses().join("|");
    var counts = __vs.counts();
    var plates = [].slice.call(document.querySelectorAll('[data-shelf="' + shelf.id + '"] .vs-plaque'))
      .filter(function (b) { return b.textContent === best.run.plaque; });
    var isButton = plates.length && plates[0].tagName === "BUTTON";
    plates[0].click();
    var opened = __vs.reader();
    var rows = document.querySelectorAll("#vs-contents button").length;
    var title = document.getElementById("vs-readertitle").textContent;
    var meta = document.getElementById("vs-bookmeta").textContent;
    var tabs = document.querySelectorAll("#vs-tabs button").length;
    var shown = !document.getElementById("vs-reader").hidden;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    var closed = document.getElementById("vs-reader").hidden;

    /* a plate drawn twice, anywhere in the library, opens the same book from both rows */
    var twice = null;
    __vs.views().forEach(function (v) {
      if (twice || v.shelf.hidden) return;
      var byLabel = {};
      [].slice.call(document.querySelectorAll('[data-shelf="' + v.shelf.id + '"] .vs-plaque'))
        .forEach(function (b) { (byLabel[b.textContent] = byLabel[b.textContent] || []).push(b); });
      Object.keys(byLabel).forEach(function (label) {
        if (!twice && byLabel[label].length > 1) twice = { shelf: v.shelf.id, label: label, plates: byLabel[label] };
      });
    });
    var same = null;
    if (twice) {
      twice.plates[0].click();
      var a = __vs.reader();
      __vs.closeReader();
      twice.plates[1].click();
      var b = __vs.reader();
      __vs.closeReader();
      same = { a: a.book, b: b.book, equal: a.book === b.book, rows: twice.plates.length };
    }
    var after = __vs.addresses().join("|");
    var counts2 = __vs.counts();
    return { found: true, shelf: shelf.id, plaque: best.run.plaque, books: best.run.books.length,
             unique: best.unique, sum: best.sum, isButton: isButton, plates: plates.length,
             id: opened && opened.book, want: core.plaqueBookId(shelf.id, best.run.plaque),
             rows: rows, title: title, wantTitle: shelf.name + " \u00b7 " + best.run.plaque,
             meta: meta, tabs: tabs, shown: shown, closed: closed, twice: same,
             stable: before === after && counts.books === counts2.books && counts.spines === counts2.spines };
  })()`);
  if (!r.found) return { ok: false, detail: "no plaque in this library" };
  const ok = r.isButton && r.id === r.want && r.rows === r.unique && r.title === r.wantTitle &&
             r.meta.indexOf(r.unique + " notes across " + r.books + " books") === 0 &&
             r.shown && r.closed && (!r.twice || r.twice.equal) && r.stable;
  return { ok,
           detail: `${r.shelf} plate "${r.plaque}" (a button: ${r.isButton}) opens ${r.id}: ${r.rows} rows for ` +
                   `${r.unique} unique notes across ${r.books} books that sum to ${r.sum}; title "${r.title}", ` +
                   `meta "${r.meta}", ${r.tabs} tabs; Escape closes it (${r.closed}); ` +
                   (r.twice ? `"${r.twice.a.split("/").pop()}" drawn on ${r.twice.rows} rows opens the same book from both (${r.twice.equal}); `
                            : "no plate is drawn twice in this library; ") +
                   `addresses, book count and spine count unchanged (${r.stable})` };
});

/* github#6, design/0019 */
check("a ribbon left in a plaque-book re-resolves after a rebuild, and the Reading shelf holds it", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var view = __vs.views().filter(function (v) { return !v.shelf.hidden && v.books.some(function (b) { return b.plaque !== null; }); })[0];
    if (!view) return { found: false };
    var run = core.runsOf(view.books).filter(function (x) { return x.plaque !== null; })
      .sort(function (a, b) { return b.books.length - a.books.length; })[0];
    var id = core.plaqueBookId(view.shelf.id, run.plaque);
    var opened = __vs.openBook(id, null);
    var here = __vs.reader();
    var stub = document.querySelector("#vs-marks .vs-markstub");
    var had = !stub;
    if (stub) stub.click();
    var saved = __vs.settings().reading.filter(function (m) { return m.bookId === id; }).length;
    var order = __vs.settings().noteOrder;
    var resolved = core.resolveReading(here.note, id, __vs.views(), order);
    __vs.setFilters({});
    var again = __vs.reader();
    var spine = document.querySelector('[data-shelf="-reading"] [data-book="' + id.replace(/"/g, '\\"') + '"]');
    var count = spine ? spine.querySelector(".vs-n").textContent : null;
    var ribbons = spine ? spine.querySelectorAll(".vs-ribbon").length : 0;
    if (!had) {
      var mine = document.querySelector('#vs-marks .vs-mark[aria-current="true"]');
      if (mine) mine.click();
    }
    __vs.setFilters({});
    var gone = document.querySelector('[data-shelf="-reading"] [data-book="' + id.replace(/"/g, '\\"') + '"]');
    __vs.closeReader();
    return { found: true, id: id, opened: opened, note: here.note, saved: saved,
             resolvedId: resolved ? resolved.id : null, resolvedHolds: resolved ? resolved.notes.length : 0,
             sameBook: again && again.book === id, sameNote: again && again.note === here.note,
             spine: !!spine, count: count, notes: here && resolved ? resolved.notes.length : 0, ribbons: ribbons,
             gone: !had ? gone === null : true };
  })()`);
  if (!r.found) return { ok: false, detail: "no plaqued shelf in this library" };
  const ok = r.opened && r.saved === 1 && r.resolvedId === r.id && r.sameBook && r.sameNote &&
             r.spine && Number(r.count) === r.notes && r.ribbons === 1 && r.gone;
  return { ok,
           detail: `${r.id} opened by address (${r.opened}); one ribbon saved against it (${r.saved}); ` +
                   `core.resolveReading gives ${r.resolvedId} with ${r.resolvedHolds} notes; after a rebuild the reader is on ` +
                   `the same book (${r.sameBook}) and note (${r.sameNote}); the Reading shelf shows it as a spine (${r.spine}) ` +
                   `of ${r.count} with ${r.ribbons} ribbon; taken out again it leaves the shelf (${r.gone})` };
});

/* github#48, design/0014 -- one ribbon cannot see this; the y of the second can */
check("the Reading shelf lays its books in a row, and draws as many rows as it packed", async (p) => {
  await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
  const r = await p.j(`(function(){
    var settings = __vs.settings();
    var was = settings.reading.slice();
    var views = __vs.views().filter(function (v) {
      return !v.shelf.hidden && v.books.length && v.shelf.classifier !== "pick";
    });
    if (views.length < 2) return { found: false };

    /* a ribbon is {noteId, shelfId, bookId, at}; readingBooks() resolves it through
     * core.resolveReading exactly as it would after a click on the stub, so this is the real
     * shelf -- it just does not cost a reader round trip per book. */
    function mark(n) {
      settings.reading.length = 0;
      var at = 1, placed = 0;
      for (var round = 0; placed < n && round < 60; round++) {
        for (var i = 0; i < views.length && placed < n; i++) {
          var book = views[i].books[round];
          if (!book || !book.notes.length) continue;
          settings.reading.push({ noteId: book.notes[0].id, shelfId: views[i].shelf.id,
                                  bookId: book.id, at: at++ });
          placed++;
        }
      }
      __vs.setFilters({});
      return placed;
    }

    function read(asked) {
      var rail = document.querySelector('[data-shelf="-reading"] .vs-shelfrail');
      if (!rail) return { drawn: false, asked: asked };
      var line = rail.querySelector(".vs-books");
      var rows = [].slice.call(rail.querySelectorAll(".vs-track")).map(function (t) {
        return [].slice.call(t.querySelectorAll(".vs-spine")).map(function (s) {
          var b = s.getBoundingClientRect();
          var lineBox = t.querySelector('.vs-books').getBoundingClientRect();
          /* design/0033 */
          var css = getComputedStyle(s), wear = s.getAttribute('data-wear');
          var lift = wear === '3' ? 2 : wear === '2' ? 1 : 0;
          var matrix = new DOMMatrixReadOnly(css.transform === 'none' ? undefined : css.transform);
          var baseline = Math.round(b.bottom + lift);
          return { x: Math.round(b.left), bottom: baseline, paintedBottom: Math.round(b.bottom),
                   lift: lift, exactLift: matrix.m42 === -lift && matrix.m41 === 0 && matrix.a === 1 && matrix.d === 1,
                   onBoard: baseline === Math.round(lineBox.bottom),
                   inside: b.top + lift >= lineBox.top - 0.5 && b.bottom + lift <= lineBox.bottom + 0.5,
                   r: Math.round(b.right), w: Math.round(b.width) };
        });
      }).filter(function (row) { return row.length; });
      var ys = {};
      rows.forEach(function (row) { row.forEach(function (s) { ys[s.bottom] = 1; }); });

      /* A ROW BREAKS BECAUSE THE NEXT BOOK DID NOT FIT, not because of a plate that is not
       * there. rowsOf charged plaqueWidth for every run even on a shelf that draws none, so
       * the first row gave back ~48px a book -- room the next spine would have fitted in. */
      var slack = null, next = null, fits = null;
      if (rows.length > 1) {
        var r0 = rows[0];
        slack = Math.round(__vs.room().width) - (r0[r0.length - 1].r - r0[0].x);
        next = rows[1][0].w;
        fits = slack >= next + 3;
      }
      return {
        drawn: true, asked: asked,
        tracks: rows.length,
        spines: rows.reduce(function (a, row) { return a + row.length; }, 0),
        /* the packer's rows and the drawn rows are the same number, or the paint disagrees */
        bands: Object.keys(ys).length,
        flat: rows.every(function (row) {
          return row.every(function (s) { return s.bottom === row[0].bottom && s.inside && s.onBoard && s.exactLift; });
        }),
        ascending: rows.every(function (row) {
          for (var i = 1; i < row.length; i++) if (row[i].x <= row[i - 1].x) return false;
          return true;
        }),
        display: getComputedStyle(line).display,
        lineH: Math.round(line.getBoundingClientRect().height),
        spineH: Math.round(rail.querySelector(".vs-spine").getBoundingClientRect().height),
        grips: rail.querySelectorAll("[data-grip]").length,
        pluses: rail.querySelectorAll(".vs-plusbook").length,
        plates: rail.querySelectorAll(".vs-plaque").length,
        slack: slack, next: next, roomLeftForOneMore: fits,
        row0: rows.length ? rows[0].map(function (s) { return s.x + "," + s.paintedBottom + " (board " + s.bottom + ", lift " + s.lift + ", exact " + s.exactLift + ", inside " + s.inside + ")"; }).join(" ") : ""
      };
    }

    var two = read(mark(2));
    /* design/0033 */
    var probe = document.querySelector('[data-shelf="-reading"] .vs-spine');
    probe.style.transition = 'none';
    probe.style.marginBottom = '3px';
    var rejectsLayoutShift = !read(2).flat;
    probe.style.removeProperty('margin-bottom');
    probe.style.transform = 'translateY(-3px)';
    var rejectsInvalidLift = !read(2).flat;
    probe.style.removeProperty('transform');
    probe.style.removeProperty('transition');
    var three = read(mark(3));
    var shotReading = settings.reading.slice();

    /* enough books to outgrow the room, so the packer has to break a row */
    var wide = null;
    for (var n = 8; n <= 96 && !wide; n += 8) {
      var got = read(mark(n));
      if (!got.drawn) break;
      if (got.tracks > 1) wide = got;
    }

    settings.reading.length = 0;
    was.forEach(function (m) { settings.reading.push(m); });
    __vs.setFilters({});
    var restored = settings.reading.length;
    return { found: true, two: two, three: three, wide: wide, restored: restored, was: was.length, shotReading: shotReading, rejectsLayoutShift: rejectsLayoutShift, rejectsInvalidLift: rejectsInvalidLift };
  })()`);
  if (SHOT && r.found) {
    const saved = await p.j(`(function(){var s=__vs.settings(), saved=s.reading.slice(); s.reading=${JSON.stringify(r.shotReading)}; __vs.setFilters({}); window.scrollTo(0,0); return saved;})()`);
    try {
      const shot = await p.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(SHOT.replace(/\.png$/i, "-reading.png"), Buffer.from(shot.data, "base64"));
    } finally {
      await p.j(`(function(){__vs.settings().reading=${JSON.stringify(saved)}; __vs.setFilters({}); return true;})()`);
    }
  }
  if (!r.found) return { ok: false, detail: "fewer than two shelves with books in this library" };
  const sane = (m) => m && m.drawn && m.spines === m.asked && m.bands === m.tracks &&
                      m.flat && m.ascending && m.display === "flex" &&
                      m.spineH > 0 && m.lineH >= m.spineH && !m.grips && !m.pluses && !m.plates;
  const ok = r.rejectsLayoutShift && r.rejectsInvalidLift && sane(r.two) && r.two.tracks === 1 && sane(r.three) && r.three.tracks === 1 &&
             sane(r.wide) && r.wide.tracks > 1 && r.wide.roomLeftForOneMore === false &&
             r.restored === r.was;
  const say = (m) => m
    ? `${m.spines} spine(s) over ${m.tracks} track(s) on ${m.bands} band(s), one board baseline per row with exact 0/1/2px wear lift ` +
      `(${m.flat}), x ascending (${m.ascending}), the line ${m.display} and ${m.lineH}px for a ` +
      `${m.spineH}px spine, ${m.grips} grips ${m.pluses} pluses ${m.plates} plates`
    : "never wrapped";
  return { ok,
           detail: `two ribbons: ${say(r.two)} at ${r.two.row0}; three: ${say(r.three)}; ` +
                   `${r.wide ? r.wide.asked : "?"} ribbons wrap: ${say(r.wide)}` +
                   (r.wide ? `, and the first row is packed tight -- ${r.wide.slack}px left over ` +
                             `for a ${r.wide.next}px next book (room for one more: ` +
                             `${r.wide.roomLeftForOneMore})` : "") +
                   `; rejects 3px layout shift (${r.rejectsLayoutShift}) and invalid 3px lift (${r.rejectsInvalidLift}); the ${r.was} it started with are back (${r.restored})` };
});

/* github#6, design/0018, design/0019 */
check("on a manual shelf a plate opens what is under it, not the whole letter", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var shelf = __vs.settings().shelves.filter(function (s) { return s.id === "tags"; })[0];
    var view = __vs.views().filter(function (v) { return v.shelf.id === "tags"; })[0];
    if (!shelf || !view || shelf.hidden) return { found: false };
    var run = core.runsOf(view.books).filter(function (x) { return x.plaque !== null && x.books.length > 1; })[0];
    if (!run) return { found: false, why: "no letter with two books on Tags" };
    var was = shelf.direction;
    var savedOrder = shelf.order;
    var seq = __vs.sequence("tags");
    var moved = run.books[0].key;
    var others = seq.filter(function (k) { return k !== moved; });
    /* the run's first book goes to the very end, past Untagged; the rest of the letter stays */
    var order = others.concat([moved]);
    shelf.direction = "manual";
    shelf.order = order;
    __vs.setFilters({});
    var plates = [].slice.call(document.querySelectorAll('[data-shelf="tags"] .vs-plaque'))
      .filter(function (b) { return b.textContent === run.plaque; });
    var frontKeys = __vs.sequence("tags").slice(-1);
    plates[plates.length - 1].click();
    var first = __vs.reader();
    var firstRows = document.querySelectorAll("#vs-contents button").length;
    __vs.closeReader();
    plates[0].click();
    var rest = __vs.reader();
    var restRows = document.querySelectorAll("#vs-contents button").length;
    __vs.closeReader();
    var restUnique = {};
    run.books.slice(1).forEach(function (b) { b.notes.forEach(function (n) { restUnique[n.id] = 1; }); });
    plates[plates.length - 1].click();
    return { found: true, was: was, savedOrder: savedOrder, plaque: run.plaque, moved: moved, plates: plates.length, front: frontKeys[0],
             firstId: first.book, firstRows: firstRows, movedNotes: run.books[0].notes.length,
             restId: rest.book, restRows: restRows, restUnique: Object.keys(restUnique).length,
             sameId: first.book === rest.book, want: core.plaqueBookId("tags", run.plaque) };
  })()`);
  if (!r.found) return { ok: false, detail: r.why || "no Tags shelf in this library" };
  try {
    if (SHOT) {
      const shot = await p.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(SHOT.replace(/\.png$/i, "-manual-plaque.png"), Buffer.from(shot.data, "base64"));
    }
  } finally {
    await p.eval(`(function(){
      __vs.closeReader();
      var shelf=__vs.settings().shelves.find(function(s){return s.id==='tags';});
      shelf.direction=${JSON.stringify(r.was)};
      ${r.savedOrder ? "shelf.order=" + JSON.stringify(r.savedOrder) : "delete shelf.order"};
      __vs.setFilters({});
    })(); void 0`);
  }
  const ok = r.plates >= 2 && r.front === r.moved && r.firstRows === r.movedNotes &&
             r.restRows === r.restUnique && r.sameId && r.firstId === r.want && r.firstRows !== r.restRows;
  return { ok,
           detail: `"${r.moved}" moved to the end of a manual Tags shelf splits letter ${r.plaque} into ${r.plates} plates; ` +
                   `the last opens ${r.firstRows} notes (the one book under it holds ${r.movedNotes}), the first opens ` +
                   `${r.restRows} (the rest of the letter, ${r.restUnique} unique); same address for both (${r.sameId}: ${r.firstId})` };
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
  const ok = r.schema === 10 && r.spread === 14 && !r.hadRibbon && r.none === 0 && r.noneLength === 14 &&
             r.keptFirst === "#111111" && r.keptThird === "#333333" && r.keptEmpty === 12 &&
             r.junkLength === 14 && r.junkSet === 0;
  return {
    ok,
    detail: `schema ${r.schema}; one ribbon from 9 becomes ${r.spread} of 14, and the old field is ` +
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
    var only = function (settings, id) {
      return settings.shelves.filter(function (s) { return s.id === id; })[0];
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
             /* design/0019 -- BY ID, NOT BY POSITION: schema 10 puts a Favourites shelf in
              * front of whatever a file carried, so shelves[0] is no longer the shelf under
              * test. */
             lettered: only(core.migrate({ schema: 5, shelves: [{ id: "people", name: "People",
               source: { kind: "all" }, classifier: "person", direction: "alphabetical",
               hidden: false, position: 0, plaques: false }] }), "people").plaques,
             weeksHidden: only(core.migrate({ schema: 1, shelves: [{ id: "weeks", name: "Weeks",
               source: { kind: "all" }, classifier: "week", direction: "chronological",
               hidden: false, position: 0, plaques: true }] }), "weeks").hidden,
             keptShown: shown ? shown.hidden === false : false };
  })()`);
  /* People carries plaques from schema 6 too -- the alphabet is a unit above the book like a
   * decade is (design/0003) -- so the shelf that proves a migration does not touch everything
   * is Months, which asked for plaques before any of this and still has them. */
  const ok = r.schema === 10 && r.years === true && r.months === true && r.people === true &&
             r.wear === 3 && r.fields === "date" && r.keptOff === false &&
             r.stamp === true && r.keptStampOff === false && r.order === "oldest" &&
             r.weeksHidden === true && r.keptShown === true && r.lettered === true &&
             r.shelvedLook === "leather" && r.keptLook === "leather";
  return {
    ok,
    detail: `schema 1 -> ${r.schema}: Years plaques ${r.years}, Months ${r.months}, People ` +
            `${r.people}; the file-stamp fallback comes up ${r.stamp} and the reading order ` +
            `"${r.order}"; wear and date fields survive (${r.wear} opens, "${r.fields}"). ` +
            `A file already at schema 2 keeps its Years plaques off: ${r.keptOff === false}; ` +
            `one at 3 keeps its stamp fallback off: ${r.keptStampOff === false}; the Weeks ` +
            `shelf comes up hidden (${r.weeksHidden}) unless the file already says 4 ` +
            `(${r.keptShown}); a People shelf written before schema 6 comes up with the ` +
            `alphabet on its plaques (${r.lettered}); a file naming the shelved cyber ` +
            `look comes up in ${r.shelvedLook}, one naming shelved Modern also comes up in ${r.keptLook}`
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

/* design/0030 */
check("reader tabs keep their width and the search rail stays above matching ribbons", async (p) => {
  const r = await p.j(`(function(){
    var settings=__vs.settings(), saved=JSON.parse(JSON.stringify(settings));
    var rect=function(selector){return document.querySelector(selector).getBoundingClientRect();};
    try {
      __vs.setLook('leather'); __vs.setQuery('garden');
      var rail=rect('#vs-rail'), search=rect('#vs-q'), title=rect('#vs-vname');
      var centred=Math.abs((title.left+title.right)/2-(rail.left+rail.right)/2)<2;
      var book=__vs.views().find(function(v){return v.shelf.id==='tags';}).books.find(function(b){return b.notes.length>10;});
      var marked=book.notes[5];
      settings.reading=[{noteId:marked.id,shelfId:book.shelfId,bookId:book.id,at:Date.now()}];
      var spine=document.querySelector('[data-book="'+book.id+'"]'), width=spine.getBoundingClientRect().width;
      __vs.openBook(book.id,null);
      var sameRail=JSON.stringify(rail.toJSON())===JSON.stringify(rect('#vs-rail').toJSON());
      var keptQuery=document.getElementById('vs-q').value==='garden';
      var exposed=rect('#vs-reader').top>=rect('#vs-rail').bottom;
      var topmost=document.elementFromPoint(search.left+10,search.top+10)===document.getElementById('vs-q');
      var before=rect('#vs-tabs').width;
      document.querySelector('.vs-indextoggle').click();
      var fixed=rect('#vs-tabs').width===before && spine.getBoundingClientRect().width===width;
      document.querySelector('#vs-marks .vs-mark').click();
      var ribbonTarget=__vs.reader().note===marked.id;
      __vs.closeReader();
      spine.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:300}));
      var rows=new Set(Array.from(document.querySelectorAll('#vs-dye .vs-swatch')).map(function(b){return b.getBoundingClientRect().top;})).size;
      var styles=Array.from(document.querySelectorAll('#vs-dye .vs-bindingchoice')).map(function(b){return b.dataset.style;});
      var buttons=Array.from(document.querySelectorAll('#vs-dye .vs-indexbuttons button')).map(function(b){return b.dataset.indexMode;});
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      var ribbons=styles.map(function(style){
        settings.bookSpines[book.id]=style; __vs.setFilters({}); __vs.openBook(book.id,null);
        var closed=document.querySelector('[data-book="'+book.id+'"] .vs-ribbon');
        var mark=document.querySelector('#vs-marks .vs-markstub')||document.querySelector('#vs-marks .vs-mark');
        var sample=document.createElement('span');sample.className='vs-ribbon';
        if (!closed) { document.querySelector('[data-book="'+book.id+'"]').appendChild(sample); closed=sample; }
        var same=getComputedStyle(closed).clipPath===getComputedStyle(mark).clipPath;
        if(sample.isConnected) sample.remove(); __vs.closeReader(); return [style,same];
      });
      return {centred:centred,sameRail:sameRail,keptQuery:keptQuery,exposed:exposed,topmost:topmost,fixed:fixed,ribbonTarget:ribbonTarget,width:before,rows:rows,styles:styles,buttons:buttons,ribbons:ribbons};
    } finally { __vs.closeReader(); Object.assign(settings,saved); __vs.setQuery(''); __vs.setFilters({}); }
  })()`);
  return {ok:['centred','sameRail','keptQuery','exposed','topmost','fixed','ribbonTarget'].every(k=>r[k])&&r.rows===2&&r.styles[1]==='minimal'&&r.styles.length===6&&r.buttons.join(',')==='az,date'&&r.ribbons.every(([,same])=>same),detail:JSON.stringify(r)};
});

/* design/0031 */
check("Manage colour rules fit and pick shelves offer no colour variation", async (p) => {
  const original = await p.j("({width:innerWidth,height:innerHeight,look:document.getElementById('vs-app').dataset.look||''})");
  /* github#57 -- one waiter, in the harness */
  const resize = (width, height) => viewport(p, width, height);
  const results=[];
  try {
    for (const width of [original.width,390,320]) {
      await resize(width,width===original.width?original.height:844);
      const states=await p.j(`(function(){
        return VaultShelfCore.LOOKS.map(function(look){
          __vs.setLook(look.value);document.getElementById('vs-manageopen').click();
          var rows=Array.from(document.querySelectorAll('.vs-managerow'));
          var bad=[];
          var geometry=rows.map(function(row){
            var r=row.getBoundingClientRect();
            var controls=Array.from(row.querySelectorAll('button,select,label'));
            controls.forEach(function(c){var b=c.getBoundingClientRect();if(b.left<r.left-1||b.right>r.right+1)bad.push(c.className);});
            return {name:row.querySelector('.vs-name').textContent,height:r.height,
              boxes:controls.map(function(c){var b=c.getBoundingClientRect();return [b.top-r.top,b.height];})};
          });
          var pick=rows.find(function(row){return row.querySelector('[data-go="favourites"]');});
          var noVary=!pick.querySelector('[data-fact="vary"]');
          var words=document.getElementById('vs-manage').textContent.includes('Fourteen colours');
          document.getElementById('vs-mclose').click();__vs.editShelf('favourites');
          var builder=document.getElementById('vs-bvary').closest('label').hidden;
          document.getElementById('vs-bcancel').click();
          return {look:look.value||'modern',bad:bad,noVary:noVary,builder:builder,words:words,geometry:geometry};
        });
      })()`);
      const base=states.find(s=>s.look==='modern').geometry;
      const differences=[];
      for(const state of states) state.geometry.forEach((row,i)=>{
        if(Math.abs(row.height-base[i].height)>1 || row.boxes.some((b,j)=>b.some((v,k)=>Math.abs(v-base[i].boxes[j][k])>1))) differences.push(state.look+' '+row.name);
      });
      results.push({width,heights:states.map(s=>[s.look,s.geometry.map(r=>r.height)]),differences,
        ok:!differences.length&&states.every(s=>!s.bad.length&&s.noVary&&s.builder&&s.words)});
      if(SHOT&&width===390) {
        await p.eval("__vs.setLook('leather');document.getElementById('vs-manageopen').click();document.getElementById('vs-manage').scrollTop=0; void 0");
        const shot=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        writeFileSync(SHOT.replace(/\.png$/i,'-manage.png'),Buffer.from(shot.data,'base64'));
        await p.eval("document.getElementById('vs-mclose').click(); void 0");
      }
    }
  } finally {
    await p.eval(`__vs.setLook(${JSON.stringify(original.look)}); void 0`);
    await resize(original.width,original.height);
  }
  return {ok:results.every(r=>r.ok),detail:JSON.stringify(results)};
});

/* design/0030 */
check("contents defaults and the reader switch preserve the note and survive migration", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore, settings = __vs.settings();
    var saved = JSON.parse(JSON.stringify(settings));
    var select = function (scope, value) {
      document.querySelector(scope + ' [data-index-mode="' + value + '"]').click();
    };
    var menu = function (element) {
      element.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,clientX:300,clientY:300}));
    };
    try {
      var defaults = core.defaultShelves().map(function(s) { return [s.id,core.indexMode(s)]; });
      var tag = __vs.views().find(function(v){return v.shelf.id==='tags';}).books
        .filter(function(b){return b.notes.length>10;})[0];
      __vs.openBook(tag.id, tag.notes[5].id);
      var chosen = document.querySelector('#vs-contents [aria-current="true"]').getAttribute('data-note');
      var toggle = document.querySelector('.vs-indextoggle');
      var initial = toggle.getAttribute('data-index-mode');
      var belowSearch = toggle.previousElementSibling.classList.contains('vs-findtab');
      toggle.click();
      var mode = document.querySelector('.vs-indextoggle').getAttribute('data-index-mode');
      var kept = document.querySelector('#vs-contents [aria-current="true"]').getAttribute('data-note')===chosen;
      var notes = __vs.views().find(function(v){return v.shelf.id==='tags';}).books.find(function(b){return b.id===tag.id;}).notes;
      var dates = notes.filter(function(n){return n.date;}).map(function(n){return n.date;});
      var chronological = dates.every(function(d,i){return !i||d>=dates[i-1];});
      var roundtrip = core.migrate(JSON.parse(JSON.stringify(settings)));
      var persisted = roundtrip.shelves.find(function(s){return s.id==='tags';}).bookIndexes[tag.key]==='date';
      __vs.closeReader();
      menu(document.querySelector('[data-book="'+tag.id+'"]'));
      select('#vs-dye','az');
      document.querySelector('[data-book="'+tag.id+'"]').click();
      var reopened = document.querySelector('.vs-indextoggle').getAttribute('data-index-mode')==='az';
      __vs.closeReader();
      menu(document.querySelector('[data-shelf="tags"] .vs-shelfrail'));
      select('#vs-railmenu','date');
      var shelf = settings.shelves.find(function(s){return s.id==='tags';});
      var shelfDefault = shelf.indexMode==='date' && core.indexMode(shelf,'future-book')==='date';
      __vs.editShelf('tags');
      var builder = document.querySelector('#vs-bindex [data-index-mode="date"]').getAttribute('aria-pressed')==='true';
      select('#vs-bindex','az'); document.getElementById('vs-bsave').click();
      var edited = settings.shelves.find(function(s){return s.id==='tags';}).indexMode==='az';
      var plate = document.querySelector('[data-shelf="years"] .vs-plaque');
      menu(plate); select('#vs-dye','az'); plate.click();
      var plaque = document.querySelector('.vs-indextoggle').getAttribute('data-index-mode')==='az';
      __vs.closeReader();
      __vs.newShelf(); document.getElementById('vs-bname').value='Alphabetical journal';
      select('#vs-bindex','az'); document.getElementById('vs-bsave').click();
      var created = settings.shelves.some(function(s){return s.name==='Alphabetical journal'&&s.indexMode==='az';});
      return {defaults:defaults,initial:initial,belowSearch:belowSearch,mode:mode,kept:kept,
        chronological:chronological,persisted:persisted,reopened:reopened,shelfDefault:shelfDefault,builder:builder,edited:edited,plaque:plaque,created:created};
    } finally { __vs.closeReader(); Object.assign(settings,saved); __vs.setFilters({}); }
  })()`);
  return {ok:r.defaults.every(([id,mode])=>mode===(id==='tags'||id==='encyclopedia'?'az':'date')) &&
    r.initial==='az' && r.mode==='date' && ['belowSearch','kept','chronological','persisted','reopened','shelfDefault','builder','edited','plaque','created'].every(k=>r[k]),
    detail:JSON.stringify(r)};
});

/* design/0030 */
check("new books save colour binding and contents defaults while cancelled drafts save nothing", async (p) => {
  const r = await p.j(`(function(){
    var settings=__vs.settings(), saved=JSON.parse(JSON.stringify(settings));
    var choose=function(scope,value){document.querySelector(scope+' [data-index-mode="'+value+'"]').click();};
    var start=function(){document.querySelector('[data-shelf="favourites"] .vs-plusbook').click();};
    try {
      var before=JSON.stringify(settings); start();
      var swatches=document.querySelectorAll('#vs-mbappearance .vs-swatch');
      var bindings=document.querySelectorAll('#vs-mbappearance .vs-bindingchoice');
      var count=[swatches.length,bindings.length];
      swatches[12].click(); bindings[3].click(); choose('#vs-mbindex','az');
      document.getElementById('vs-mbcancel').click();
      var cancelled=before===JSON.stringify(settings); start();
      document.getElementById('vs-mbname').value='Index sample';
      document.querySelectorAll('#vs-mbappearance .vs-swatch')[13].click();
      document.querySelector('#vs-mbappearance [data-style="weathered"]').click();
      choose('#vs-mbindex','az'); document.getElementById('vs-mbsave').click();
      var shelf=settings.shelves.find(function(s){return s.id==='favourites';});
      var key=Object.keys(shelf.made).find(function(k){return shelf.made[k].name==='Index sample';});
      var id='favourites/'+key, spine=document.querySelector('[data-book="'+id+'"]');
      var savedChoice=settings.bookColors[id]===13&&settings.bookSpines[id]==='weathered'&&shelf.bookIndexes[key]==='az';
      var painted=spine.getAttribute('data-binding')==='weathered';
      __vs.openBook(id,null);
      var reader=document.querySelector('.vs-indextoggle').getAttribute('data-index-mode')==='az';
      __vs.closeReader();
      spine.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:300}));
      Array.from(document.querySelectorAll('#vs-dye button')).find(function(b){return b.textContent==='Edit book…';}).click();
      var edit=document.querySelector('#vs-mbindex [data-index-mode="az"]').getAttribute('aria-pressed')==='true' &&
        document.querySelectorAll('#vs-mbappearance .vs-swatch')[13].getAttribute('aria-pressed')==='true' &&
        document.querySelector('#vs-mbappearance [data-style="weathered"]').getAttribute('aria-pressed')==='true';
      document.getElementById('vs-mbcancel').click();
      var loaded=window.VaultShelfCore.migrate(JSON.parse(JSON.stringify(settings)));
      var migrated=loaded.bookColors[id]===13&&loaded.bookSpines[id]==='weathered'&&loaded.shelves.find(function(s){return s.id==='favourites';}).bookIndexes[key]==='az';
      __vs.unmakeBook(id);
      var deleted=!settings.bookColors[id]&&!settings.bookSpines[id]&&!shelf.bookIndexes[key];
      return {count:count,cancelled:cancelled,saved:savedChoice,painted:painted,reader:reader,edit:edit,migrated:migrated,deleted:deleted};
    } finally { __vs.closeReader(); Object.assign(settings,saved); __vs.setFilters({}); }
  })()`);
  await sleep(150);
  return {ok:r.count[0]===14&&r.count[1]===6&&['cancelled','saved','painted','reader','edit','migrated','deleted'].every(k=>r[k]),detail:JSON.stringify(r)};
});

check("the index tabs cut the book the way the book is ordered", async (p) => {
  const r = await p.j(`(function(){
    function tabsFor(id) {
      __vs.openBook(id, null);
      var out = [].slice.call(document.querySelectorAll("#vs-tabs button:not(.vs-findtab):not(.vs-indextoggle)"))
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

/* github#79 -- the reload is the only place a reorder can be lost */

check("a reordered shelf survives a reload, on both hosts", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
    var reload = function (s) { return core.migrate(clone(s)); };
    var ids = function (s) {
      return s.shelves.slice().sort(function (a, b) { return a.position - b.position; })
        .map(function (x) { return x.id; });
    };
    var shelfOf = function (list, id) {
      return list.filter(function (s) { return s.id === id; })[0];
    };
    var live = __vs.settings();
    var was = live.shelves.map(function (s) { return { id: s.id, position: s.position }; });
    var before = ids(live);
    var out = { before: before };

    /* THE CONTROL, NOT THE DATA: Manage's arrow on the last shelf in the room. */
    document.getElementById("vs-manageopen").click();
    var last = before[before.length - 1];
    var up = document.querySelector('[aria-label="Move ' + shelfOf(live.shelves, last).name + ' up"]');
    /* Never throw before the restore below: the checks in a shard share one page. */
    out.hasButton = !!up;
    if (up) up.click();
    out.moved = ids(live);
    /* The array never moved -- which is exactly why the reload could throw the move away. */
    out.arrayOrder = live.shelves.map(function (s) { return s.id; });
    out.once = ids(reload(live));
    out.twice = ids(reload(reload(live)));
    document.getElementById("vs-manage").hidden = true;

    /* The drag, through the same door the drop uses. */
    __vs.moveShelf(before[0], before[2], "after");
    out.dragged = ids(live);
    out.draggedReload = ids(reload(live));

    /* Put the room back before anything else in the shard sees it. */
    was.forEach(function (w) { shelfOf(live.shelves, w.id).position = w.position; });
    __vs.setFilters({});
    out.restored = ids(live);

    /* New-shelf-at-top leaves the draft LAST in the array and first by position. */
    var made = function (id, name, position) {
      return { id: id, name: name, source: { kind: "all" }, classifier: "year",
               direction: "chronological", hidden: false, position: position, plaques: false };
    };
    out.atTop = ids(core.migrate({ schema: 10,
      shelves: [made("a", "A", 1), made("b", "B", 2), made("draft", "Draft", 0)] }));

    /* A pre-10 file keeps its own arrangement AND still gains Favourites at 0. */
    var nine = { schema: 9,
      shelves: [made("years", "Years", 2), made("people", "People", 0), made("tags", "Tags", 1)] };
    out.nine = ids(core.migrate(nine));
    out.ten = ids(core.migrate({ schema: 10, shelves: nine.shelves }));

    /* A hand-edited file: no position goes to the end, a tie falls back to array order. */
    var odd = core.migrate({ schema: 10, shelves: [
      made("a", "A", 1),
      { id: "b", name: "B", source: { kind: "all" }, classifier: "year" },
      made("c", "C", 1) ] });
    out.odd = ids(odd);
    out.compacted = odd.shelves.slice()
      .sort(function (x, y) { return x.position - y.position; })
      .map(function (s) { return s.position; }).join(",");
    return out;
  })()`);
  const swapped = r.moved.length === r.before.length &&
                  r.moved[r.moved.length - 1] === r.before[r.before.length - 2] &&
                  r.moved[r.moved.length - 2] === r.before[r.before.length - 1];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok = r.hasButton && swapped && same(r.arrayOrder, r.before) &&
             same(r.once, r.moved) && same(r.twice, r.moved) &&
             same(r.draggedReload, r.dragged) && !same(r.dragged, r.moved) &&
             same(r.restored, r.before) &&
             same(r.atTop, ["draft", "a", "b"]) &&
             same(r.nine, ["favourites", "people", "tags", "years"]) &&
             same(r.ten, ["people", "tags", "years"]) &&
             same(r.odd, ["a", "c", "b"]) && r.compacted === "0,1,2";
  return {
    ok,
    detail: `Manage's arrow: ${r.before.join(" -> ")} became ${r.moved.join(" -> ")} while the ` +
            `array stayed ${r.arrayOrder.join(" -> ")}; the move survived one migrate ` +
            `(${same(r.once, r.moved)}, the page) and two (${same(r.twice, r.moved)}, the ` +
            `plugin saving then loading); a drag gave ${r.dragged.join(" -> ")} and reloaded to ` +
            `${r.draggedReload.join(" -> ")}; restored to ${r.restored.join(" -> ")}; ` +
            `new-shelf-at-top comes up ${r.atTop.join(" -> ")}; schema 9 gives ` +
            `${r.nine.join(" -> ")} and schema 10 ${r.ten.join(" -> ")}; a hand-edited file ` +
            `gives ${r.odd.join(" -> ")} at positions ${r.compacted}`
  };
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

check("saved reading order leaves an arranged shelf alone", async (p) => {
  const r = await p.j(`(function(){
    var shelves = __vs.settings().shelves;
    var years = shelves.filter(function (s) { return s.id === "years"; })[0];
    var was = years.direction;
    years.direction = "manual";
    years.order = __vs.sequence("years").slice().reverse();
    __vs.setFilters({});
    var before = __vs.sequence("years");
    var autoBefore = __vs.sequence("months");
    var said = __vs.settings().noteOrder;
    __vs.settings().noteOrder = said === "newest" ? "oldest" : "newest";
    __vs.setFilters({});
    var then = __vs.settings().noteOrder;
    var after = __vs.sequence("years");
    var autoAfter = __vs.sequence("months");
    __vs.settings().noteOrder = said;
    __vs.setFilters({});
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

/* design/0019 -- the four that hold the Favourites shelf up. Each one empties the picks again
 * on its way out, because the checks in a shard share one page. */

check("Favourites comes first and empty, fresh and by migration from schema 9", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var byPos = function (list) {
      return list.slice().sort(function (a, b) { return a.position - b.position; });
    };
    var ids = function (list) { return byPos(list).map(function (s) { return s.id; }); };
    var fresh = byPos(core.emptySettings().shelves);
    var nine = { schema: 9, shelves: [
      { id: "years", name: "Years", source: { kind: "all" }, classifier: "year",
        direction: "chronological", hidden: false, position: 0, plaques: true },
      { id: "people", name: "People", source: { kind: "all" }, classifier: "person",
        direction: "alphabetical", hidden: true, position: 1, plaques: true },
      { id: "tags", name: "Tags", source: { kind: "all" }, classifier: "tag",
        direction: "manual", order: ["b", "a"], hidden: false, position: 2, plaques: true }
    ] };
    var up = core.migrate(nine);
    var fav = up.shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var tags = up.shelves.filter(function (s) { return s.id === "tags"; })[0];
    /* A file already at 10 means what it says, even with no pick shelf in it. */
    var ten = core.migrate({ schema: 10, shelves: nine.shelves });
    /* A shelf a person made and called Favourites already holds the id. */
    var taken = core.migrate({ schema: 9, shelves: [
      { id: "favourites", name: "Favourites", source: { kind: "tag", value: "fav" },
        classifier: "tag", direction: "alphabetical", hidden: false, position: 0, plaques: false }
    ] });
    /* A hand-edited pick shelf comes up well-formed. */
    var hand = core.migrate({ schema: 10, shelves: [
      { id: "favourites", name: "Favourites", source: { kind: "all" }, classifier: "pick",
        direction: "alphabetical", order: ["x"], plaques: true, hidden: false, position: 0,
        picks: ["years/2024", 7, "years/2024", "nope", "", "people/Ada Lovelace"] }
    ] }).shelves[0];
    return { freshFirst: fresh[0].id, freshKind: fresh[0].classifier,
             freshPicks: fresh[0].picks.length, freshIds: ids(fresh),
             schema: up.schema, ids: ids(up.shelves), favPos: fav ? fav.position : -1,
             favPicks: fav ? fav.picks.length : -1, favDir: fav ? fav.direction : "",
             peopleHidden: up.shelves.filter(function (s) { return s.id === "people"; })[0].hidden,
             tagsOrder: (tags.order || []).join("|"),
             tenIds: ids(ten.shelves), takenIds: ids(taken.shelves),
             hand: { direction: hand.direction, order: hand.order === undefined,
                     picks: hand.picks.join("|"), plaques: hand.plaques } };
  })()`);
  const want = ["favourites", "encyclopedia", "years", "months", "people", "tags"];
  const ok = r.freshFirst === "favourites" && r.freshKind === "pick" && r.freshPicks === 0 &&
             JSON.stringify(r.freshIds) === JSON.stringify(want) &&
             r.schema === 10 &&
             JSON.stringify(r.ids) === JSON.stringify(["favourites", "years", "people", "tags"]) &&
             r.favPos === 0 && r.favPicks === 0 && r.favDir === "manual" &&
             r.peopleHidden === true && r.tagsOrder === "b|a" &&
             JSON.stringify(r.tenIds) === JSON.stringify(["years", "people", "tags"]) &&
             JSON.stringify(r.takenIds) === JSON.stringify(["favourites-2", "favourites"]) &&
             r.hand.direction === "manual" && r.hand.order && r.hand.plaques === false &&
             r.hand.picks === "years/2024|people/Ada Lovelace";
  return {
    ok,
    detail: `fresh: ${r.freshIds.join(" -> ")}, the first a ${r.freshKind} shelf with ` +
            `${r.freshPicks} picks; schema 9 -> ${r.schema}: ${r.ids.join(" -> ")}, Favourites ` +
            `at ${r.favPos} with ${r.favPicks} picks and direction "${r.favDir}", People still ` +
            `hidden (${r.peopleHidden}) and Tags' arrangement kept (${r.tagsOrder}); a file ` +
            `already at 10 keeps ${r.tenIds.join(" -> ")}; a taken id gives ` +
            `${r.takenIds.join(" -> ")}; a hand-edited pick shelf comes up ${r.hand.direction} ` +
            `with no order (${r.hand.order}), no plaques (${!r.hand.plaques}) and the picks ` +
            `"${r.hand.picks}"`
  };
});

check("a drop onto Favourites adds the book where it landed, and a rebuild keeps it", async (p) => {
  await p.eval(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    fav.picks = [];
    __vs.setFilters({});
    document.getElementById("vs-library").scrollTop = 0;
  })(); void 0`);
  await sleep(250);
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var rail = document.querySelector('[data-shelf="' + fav.id + '"] .vs-shelfrail');
    var zone = rail.querySelector(".vs-dropzone");
    var favBooks = function () {
      return __vs.views().filter(function (v) { return v.shelf.id === fav.id; })[0];
    };
    var spineOf = function (id) {
      return document.querySelector('#vs-shelves [data-book="' + id.replace(/"/g, '\\"') + '"]');
    };
    var at = function (el, dt, where) {
      var box = el.getBoundingClientRect();
      var x = where === "left" ? box.left + 3 : where === "right" ? box.right - 3 : box.left + box.width / 2;
      return { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: box.top + box.height / 2 };
    };
    var carry = function (from, onto, where) {
      var dt = new DataTransfer();
      from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      var payload = dt.getData("text/plain");
      onto.dispatchEvent(new DragEvent("dragover", at(onto, dt, where)));
      var out = { payload: payload, lifted: from.getAttribute("data-dragging"),
                  landing: rail.getAttribute("data-drop"),
                  mark: rail.querySelector("[data-drop]") ? rail.querySelector("[data-drop]").getAttribute("data-drop") : null,
                  bar: rail.querySelector(".vs-drop") ? Math.round(rail.querySelector(".vs-drop").getBoundingClientRect().width) : 0 };
      onto.dispatchEvent(new DragEvent("drop", at(onto, dt, where)));
      from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      return out;
    };
    var emptyHint = zone ? zone.textContent : "";
    var emptyHeight = zone ? Math.round(zone.getBoundingClientRect().height) : 0;

    /* 1. a Years spine onto the empty rail, aimed at the landing rather than a spine */
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0].books[0];
    var yearsSpine = spineOf(years.id);
    var first = carry(yearsSpine, rail.querySelector(".vs-track"), "middle");
    var one = favBooks();
    var sameNotes = one.books.length === 1 &&
      one.books[0].notes.map(function (n) { return n.id; }).join("|") ===
      years.notes.map(function (n) { return n.id; }).join("|");

    /* 2. a People spine, dropped on the rail past the last book */
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0].books[0];
    rail = document.querySelector('[data-shelf="' + fav.id + '"] .vs-shelfrail');
    var second = carry(spineOf(people.id), rail.querySelector(".vs-track"), "middle");
    var two = favBooks();
    var twoNotes = two.noteCount;
    var seqAfterTwo = __vs.sequence(fav.id).slice();

    /* 3. a drag within: the second favourite onto the left half of the first */
    rail = document.querySelector('[data-shelf="' + fav.id + '"] .vs-shelfrail');
    var favSpines = rail.querySelectorAll(".vs-spine");
    var within = carry(favSpines[1], favSpines[0], "left");
    var seqMoved = __vs.sequence(fav.id).slice();
    var marksLeft = document.querySelectorAll('[data-shelf="' + fav.id + '"] .vs-drop').length +
                    document.querySelectorAll('[data-shelf="' + fav.id + '"] [data-drop]').length;

    /* 4. a rebuild, a filter and migrate() all keep the picks */
    var stored = fav.picks.slice();
    __vs.setFilters({});
    var rebuilt = __vs.sequence(fav.id).slice();
    var addressesBefore = __vs.addresses().filter(function (a) { return a.indexOf(fav.id + "/") === 0; });
    var folder = years.notes[0].folder;
    __vs.setFilters({ folders: [folder] });
    var narrowed = favBooks();
    var picksUnderFilter = fav.picks.slice();
    __vs.setFilters({ folders: [] });
    var addressesAfter = __vs.addresses().filter(function (a) { return a.indexOf(fav.id + "/") === 0; });
    var reread = core.migrate(JSON.parse(JSON.stringify(__vs.settings())))
      .shelves.filter(function (s) { return s.classifier === "pick"; })[0].picks;
    /* github#38 -- the shelf's own head, where the reader actually reads the count; the
     * jump chip that used to carry it went with the strip. */
    var head = document.querySelector('[data-shelf="' + fav.id + '"] .vs-shelfhead .vs-meta').textContent;
    var draggableElsewhere = document.querySelectorAll('[data-shelf="years"] .vs-spine[draggable="true"]').length;
    var handElsewhere = document.querySelectorAll('[data-shelf="years"] .vs-spine[data-hand="1"]').length;
    var yearsSpines = document.querySelectorAll('[data-shelf="years"] .vs-spine').length;

    fav.picks = [];
    __vs.setFilters({});
    var emptied = favBooks().books.length;
    var hintBack = !!document.querySelector('[data-shelf="' + fav.id + '"] .vs-dropzone');
    return { hint: emptyHint, emptyHeight: emptyHeight, first: first, sameNotes: sameNotes,
             oneCount: one.noteCount, sourceCount: years.notes.length, oneKey: one.books[0].key,
             oneId: one.books[0].id, second: second, twoBooks: two.books.length,
             twoNotes: twoNotes,
             seqAfterTwo: seqAfterTwo, within: within, seqMoved: seqMoved, marksLeft: marksLeft,
             stored: stored, rebuilt: rebuilt, narrowedBooks: narrowed.books.length,
             narrowedNotes: narrowed.noteCount, picksUnderFilter: picksUnderFilter,
             addressesStable: addressesBefore.join("|") === addressesAfter.join("|"),
             reread: reread, head: head, draggableElsewhere: draggableElsewhere,
             handElsewhere: handElsewhere, yearsSpines: yearsSpines, emptied: emptied,
             hintBack: hintBack, yearsId: years.id, peopleId: people.id };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok = r.hint === "Drag a book here, or right-click to make one" && r.emptyHeight > 100 &&
             r.first.landing === "1" && r.first.lifted === "1" && r.first.payload === r.yearsId &&
             r.sameNotes && r.oneCount === r.sourceCount && r.oneKey === r.yearsId &&
             r.oneId === "favourites/" + r.yearsId &&
             r.second.mark === "after" && r.second.bar === 3 && r.twoBooks === 2 &&
             same(r.seqAfterTwo, [r.yearsId, r.peopleId]) &&
             r.within.mark === "before" && same(r.seqMoved, [r.peopleId, r.yearsId]) &&
             r.marksLeft === 0 && same(r.stored, r.seqMoved) && same(r.rebuilt, r.seqMoved) &&
             r.narrowedBooks <= 2 && r.narrowedNotes < r.twoNotes &&
             same(r.picksUnderFilter, r.seqMoved) && r.addressesStable &&
             same(r.reread, r.seqMoved) && r.head.indexOf("2 books") === 0 &&
             r.draggableElsewhere === r.yearsSpines && r.handElsewhere === 0 &&
             r.emptied === 0 && r.hintBack;
  return {
    ok,
    detail: `the empty rail says "${r.hint}" at ${r.emptyHeight}px and lit for the drop ` +
            `(${r.first.landing === "1"}); ${r.yearsId} landed with the source's ` +
            `${r.sourceCount} notes (${r.sameNotes}) as ${r.oneId}; ${r.peopleId} dropped past it ` +
            `drew an "${r.second.mark}" mark ${r.second.bar}px wide and the sequence is ` +
            `${r.seqAfterTwo.join(", ")}; dragging the second onto the first's left half gave ` +
            `${r.seqMoved.join(", ")} with ${r.marksLeft} marks left; a rebuild (${same(r.rebuilt, r.seqMoved)}), ` +
            `a folder filter (${r.narrowedBooks} books / ${r.narrowedNotes} of ${r.twoNotes} notes, picks kept: ` +
            `${same(r.picksUnderFilter, r.seqMoved)}, addresses stable: ${r.addressesStable}) and ` +
            `migrate() (${same(r.reread, r.seqMoved)}) keep the picks; the shelf head says "${r.head}"; ` +
            `${r.draggableElsewhere}/${r.yearsSpines} Years spines lift and ${r.handElsewhere} ` +
            `are handles; emptied to ${r.emptied} and the hint is back (${r.hintBack})`
  };
});

// github#35, design/0019
check("a fresh library seeds its favourites from its own shelves", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var views = __vs.views();
    var picks = core.seedPicks(views);
    var live = {};
    views.forEach(function (v) { v.books.forEach(function (b) { live[b.id] = b; }); });
    var books = picks.map(function (id) { return live[id]; });
    var shelves = {};
    picks.forEach(function (id) { shelves[id.slice(0, id.indexOf("/"))] = 1; });
    return {
      picks: picks,
      dead: picks.filter(function (id) { return !live[id]; }).length,
      empty: books.filter(function (b) { return b && !b.notes.length; }).length,
      placeholder: picks.filter(function (id) { return id.indexOf("/-") >= 0; }).length,
      shelves: Object.keys(shelves).length,
      labels: books.map(function (b) { return b ? b.label + " (" + b.notes.length + ")" : "(gone)"; })
    };
  })()`);
  return {
    ok: r.picks.length >= 3 && r.dead === 0 && r.empty === 0 && r.placeholder === 0 &&
        r.shelves === r.picks.length,
    detail: `seeded ${r.picks.length} favourite(s) off ${r.shelves} different shelves, ` +
            `${r.dead} of them dead and ${r.empty} empty, ${r.placeholder} an -undated or ` +
            `-unfiled book: ${r.labels.join(", ")}`
  };
});

check("a favourite comes off by the menu, and a dead pick is dropped on save and not before",
      async (p) => {
  const r = await p.j(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var shelves = __vs.settings().shelves;
    var favView = function () {
      return __vs.views().filter(function (v) { return v.shelf.id === fav.id; })[0];
    };
    var bookOn = function (shelfId) {
      return __vs.views().filter(function (v) { return v.shelf.id === shelfId; })[0].books[0].id;
    };
    var spineOf = function (id) {
      return document.querySelector('#vs-shelves [data-book="' + id.replace(/"/g, '\\"') + '"]');
    };
    var menuLine = function (spine) {
      spine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));
      var menu = document.getElementById("vs-dye");
      var line = menu.querySelector(".vs-dyepick");
      var out = { shown: !menu.hidden, text: line ? line.textContent : null };
      if (line) line.click();
      out.closed = menu.hidden;
      return out;
    };
    var years = bookOn("years"), people = bookOn("people"), months = bookOn("months");
    fav.picks = [];
    __vs.pick(years);
    __vs.pick(people);
    var two = favView().books.length;

    /* off, by the menu, from the favourite's own spine */
    var off = menuLine(spineOf("favourites/" + years));
    var afterOff = fav.picks.slice();
    /* on again, by the same menu, from the source's spine */
    var onAgain = menuLine(spineOf(years));
    var afterOn = fav.picks.slice();

    /* a hidden source shelf still resolves */
    var peopleShelf = shelves.filter(function (s) { return s.id === "people"; })[0];
    peopleShelf.hidden = true;
    __vs.setFilters({});
    var whileHidden = favView().books.length;
    peopleShelf.hidden = false;

    /* a deleted source shelf: skipped on read, dropped on the next save */
    var at = shelves.indexOf(peopleShelf);
    shelves.splice(at, 1);
    __vs.setFilters({});
    var whileGone = favView().books.length;
    var picksWhileGone = fav.picks.slice();
    __vs.pick(months);
    var afterSave = fav.picks.slice();
    shelves.splice(at, 0, peopleShelf);
    __vs.setFilters({});
    var restored = favView().books.length;

    fav.picks = [];
    __vs.setFilters({});
    return { two: two, off: off, afterOff: afterOff, onAgain: onAgain, afterOn: afterOn,
             whileHidden: whileHidden, whileGone: whileGone, picksWhileGone: picksWhileGone,
             afterSave: afterSave, restored: restored, years: years, people: people,
             months: months, left: favView().books.length };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok = r.two === 2 && r.off.shown && r.off.text === "Take off Favourites" && r.off.closed &&
             same(r.afterOff, [r.people]) && r.onAgain.text === "Add to Favourites" &&
             same(r.afterOn, [r.people, r.years]) && r.whileHidden === 2 &&
             r.whileGone === 1 && same(r.picksWhileGone, [r.people, r.years]) &&
             same(r.afterSave, [r.years, r.months]) && r.restored === 2 && r.left === 0;
  return {
    ok,
    detail: `${r.two} favourites; the menu on ${r.years} said "${r.off.text}" and left ` +
            `[${r.afterOff.join(", ")}]; on the source spine it said "${r.onAgain.text}" and gave ` +
            `[${r.afterOn.join(", ")}]; with People hidden ${r.whileHidden} still resolve; with ` +
            `People deleted ${r.whileGone} resolves and the picks are still ` +
            `[${r.picksWhileGone.join(", ")}] until a save, after which they are ` +
            `[${r.afterSave.join(", ")}]; People back: ${r.restored} books; emptied to ${r.left}`
  };
});

check("a favourite dragged off the shelf comes off, and a cancelled drag does not", async (p) => {
  await p.eval(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    fav.picks = [];
    __vs.setFilters({});
    document.getElementById("vs-library").scrollTop = 0;
  })(); void 0`);
  await sleep(250);
  const r = await p.j(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var bookOn = function (id) {
      return __vs.views().filter(function (v) { return v.shelf.id === id; })[0].books[0].id;
    };
    var years = bookOn("years"), people = bookOn("people"), months = bookOn("months");
    [years, people, months].forEach(function (id) { __vs.pick(id); });
    var started = fav.picks.slice();

    var spineOf = function (id) {
      return document.querySelector('#vs-shelves [data-book="' + id.replace(/"/g, '\\"') + '"]');
    };
    var favSpine = function (source) { return spineOf(fav.id + "/" + source); };
    var at = function (el, dt) {
      var b = el.getBoundingClientRect();
      return { bubbles: true, cancelable: true, dataTransfer: dt,
               clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 };
    };

    /* 1. carried off the rail and dropped on another shelf: it comes off, and the shelf it was
     *    dropped on does NOT take it. */
    var dt = new DataTransfer();
    var from = favSpine(people);
    from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    var onto = document.querySelector('[data-shelf="years"] .vs-track');
    onto.dispatchEvent(new DragEvent("dragover", at(onto, dt)));
    var leavingMark = __vs.leaving(fav.id + "/" + people);
    var railMarks = document.querySelectorAll('[data-shelf="' + fav.id + '"] .vs-drop').length;
    onto.dispatchEvent(new DragEvent("drop", at(onto, dt)));
    from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    var afterDrop = fav.picks.slice();
    var yearsSeq = __vs.sequence("years").length;

    /* 2. carried off and then back over the rail before dropping: it stays. */
    var dt2 = new DataTransfer();
    var from2 = favSpine(years);
    from2.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt2 }));
    var away = document.querySelector('[data-shelf="months"] .vs-track');
    away.dispatchEvent(new DragEvent("dragover", at(away, dt2)));
    var wasLeaving = __vs.leaving(fav.id + "/" + years);
    var back = document.querySelector('[data-shelf="' + fav.id + '"] .vs-track');
    back.dispatchEvent(new DragEvent("dragover", at(back, dt2)));
    var stoppedLeaving = !__vs.leaving(fav.id + "/" + years);
    back.dispatchEvent(new DragEvent("drop", at(back, dt2)));
    from2.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt2 }));
    var afterReturn = fav.picks.slice();

    /* 3. a drag that ends with no drop -- Escape, or a drop outside the window -- is a CANCEL
     *    and has to put the book back. */
    var dt3 = new DataTransfer();
    var from3 = favSpine(years);
    from3.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt3 }));
    var out = document.querySelector('[data-shelf="months"] .vs-track');
    out.dispatchEvent(new DragEvent("dragover", at(out, dt3)));
    from3.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt3 }));
    var afterCancel = fav.picks.slice();
    var leftOver = document.querySelectorAll('#vs-shelves .vs-spine[data-leaving]').length +
                   document.querySelectorAll('#vs-shelves .vs-spine[data-dragging]').length;

    /* 4. a spine from an ordinary shelf dragged across the library is not a take-off. */
    var dt4 = new DataTransfer();
    var plain = spineOf(months);
    plain.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt4 }));
    var floor = document.querySelector('[data-shelf="years"] .vs-track');
    floor.dispatchEvent(new DragEvent("dragover", at(floor, dt4)));
    floor.dispatchEvent(new DragEvent("drop", at(floor, dt4)));
    plain.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt4 }));
    var afterPlain = fav.picks.slice();

    fav.picks = [];
    __vs.setFilters({});
    return { started: started, leavingMark: leavingMark, railMarks: railMarks,
             afterDrop: afterDrop, yearsSeq: yearsSeq, wasLeaving: wasLeaving,
             stoppedLeaving: stoppedLeaving, afterReturn: afterReturn,
             afterCancel: afterCancel, leftOver: leftOver, afterPlain: afterPlain,
             years: years, people: people, months: months,
             emptied: __vs.views().filter(function (v) { return v.shelf.id === fav.id; })[0].books.length };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sameSet = (a, b) => same(a.slice().sort(), b.slice().sort());
  /* A book carried back over the rail and dropped on the rail itself lands at the END, which
   * is what a drop past the last book means everywhere else on this shelf (design/0019). So
   * what step 2 asserts is that it is still ON the shelf, and where it stands is reported. */
  const ok = same(r.started, [r.years, r.people, r.months]) &&
             r.leavingMark === true && r.railMarks === 0 &&
             same(r.afterDrop, [r.years, r.months]) &&
             r.wasLeaving === true && r.stoppedLeaving === true &&
             sameSet(r.afterReturn, [r.years, r.months]) &&
             same(r.afterCancel, r.afterReturn) && r.leftOver === 0 &&
             same(r.afterPlain, r.afterReturn) && r.emptied === 0;
  return {
    ok,
    detail: `3 favourites [${r.started.join(", ")}]: carrying ${r.people} off the rail marked the ` +
            `spine as leaving (${r.leavingMark}) with ${r.railMarks} insertion marks left on the ` +
            `rail, and dropping it on the Years shelf left [${r.afterDrop.join(", ")}] -- Years ` +
            `itself still has ${r.yearsSeq} books. Carried off and back over the rail, the mark ` +
            `cleared (${r.stoppedLeaving}) and the book stayed, landing at the end of the rail the way ` +
            `any drop past the last book does: [${r.afterReturn.join(", ")}]. A ` +
            `drag ended with no drop -- Escape, or a drop outside the window -- kept it too ` +
            `([${r.afterCancel.join(", ")}]), with ${r.leftOver} spines still marked. A spine from ` +
            `an ordinary shelf dragged across the library changed nothing ` +
            `([${r.afterPlain.join(", ")}])`
  };
});

check("a second favourites shelf is built from the builder and holds its own books", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var shelves = __vs.settings().shelves;
    var before = __vs.picks().length;

    /* Built the way a person builds one: the builder's own controls, not addShelf. The button
     * at the FOOT of the library, so this check stays about pick shelves; which end each button
     * builds at is measured by "made at the end the button is at". */
    document.getElementById("vs-newshelf2").click();
    var name = document.getElementById("vs-bname");
    name.value = "Reading list";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    var kind = document.getElementById("vs-bclassifier");
    var offered = [].map.call(kind.options, function (o) { return o.value; });
    kind.value = "pick";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    var form = {
      source: document.getElementById("vs-bsource").closest("fieldset").hidden,
      classifier: kind.closest("fieldset").hidden,
      order: document.getElementById("vs-bdirection").closest("label").hidden,
      recipes: document.getElementById("vs-recipes").closest(".vs-field").hidden,
      hint: !document.getElementById("vs-pickhint").hidden,
      preview: document.getElementById("vs-previewcount").textContent
    };
    document.getElementById("vs-bsave").click();

    var made = shelves.filter(function (s) { return s.name === "Reading list"; })[0];
    var sound = made && made.classifier === "pick" && made.direction === "manual" &&
                Array.isArray(made.picks) && made.picks.length === 0 &&
                made.order === undefined && made.plaques === false;

    /* Two shelves, different books, and neither disturbs the other. */
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0].books[0].id;
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0].books[0].id;
    var first = __vs.picks().filter(function (s) { return s.id === "favourites"; })[0].id;
    __vs.pick(years, null, first);
    __vs.pick(people, null, made.id);
    __vs.pick(years, null, made.id);
    var both = __vs.picks();

    var viewOf = function (id) {
      return __vs.views().filter(function (v) { return v.shelf.id === id; })[0];
    };
    var mine = viewOf(made.id), theirs = viewOf(first);
    var rails = document.querySelectorAll("#vs-shelves .vs-shelfrail[data-pick]").length;
    var addresses = __vs.addresses();
    var shared = addresses.filter(function (a) { return a === made.id + "/" + years; }).length +
                 addresses.filter(function (a) { return a === first + "/" + years; }).length;

    /* The same book on two pick shelves is two references and one book: taking it off one
     * leaves the other alone. */
    __vs.unpick(years, first);
    var afterOff = { first: viewOf(first).books.length, mine: viewOf(made.id).books.length };

    /* The right-click menu names every shelf that would take the book. */
    var spine = document.querySelector('#vs-shelves [data-shelf="months"] .vs-spine');
    spine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
                                                        clientX: 200, clientY: 200 }));
    var lines = [].map.call(document.querySelectorAll("#vs-dye .vs-dyepick"),
                            function (b) { return b.textContent; });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    /* Put the library back. */
    var at = shelves.indexOf(made);
    shelves.splice(at, 1);
    shelves.filter(function (s) { return s.classifier === "pick"; })
           .forEach(function (s) { s.picks = []; });
    __vs.setFilters({});

    return { before: before, offered: offered.indexOf("pick") >= 0, sound: !!sound,
             form: form, madeId: made ? made.id : "", count: both.length,
             names: both.map(function (s) { return s.name; }),
             held: both.map(function (s) { return s.picks.length; }),
             mine: mine.books.length, theirs: theirs.books.length,
             mineNotes: mine.noteCount, rails: rails, shared: shared,
             afterOff: afterOff, lines: lines,
             after: __vs.picks().length };
  })()`);
  const ok = r.before === 1 && r.offered && r.sound && r.madeId === "reading-list" &&
             r.form.source === true && r.form.classifier === false && r.form.order === true &&
             r.form.recipes === true && r.form.hint === true &&
             r.count === 2 && JSON.stringify(r.names) === JSON.stringify(["Favourites", "Reading list"]) &&
             JSON.stringify(r.held) === JSON.stringify([1, 2]) &&
             r.mine === 2 && r.theirs === 1 && r.rails === 2 && r.shared === 2 &&
             r.afterOff.first === 0 && r.afterOff.mine === 2 &&
             r.lines.length === 2 && r.lines[0] === "Add to Favourites" &&
             r.lines[1] === "Add to Reading list" && r.after === 1;
  return {
    ok,
    detail: `the builder offers "pick" (${r.offered}) and saving one gives ${r.madeId}: manual, ` +
            `0 picks, no order, no plaques (${r.sound}); the form drops the source question ` +
            `(${r.form.source}), the order (${r.form.order}) and the recipes (${r.form.recipes}), ` +
            `keeps the classifier (${!r.form.classifier}) and shows the hint (${r.form.hint}). ` +
            `${r.count} pick shelves — ${r.names.join(", ")} — holding ${r.held.join(" and ")} ` +
            `books over ${r.rails} rails; the shared year has ${r.shared} addresses, one per ` +
            `shelf. Taking it off the first left ${r.afterOff.first} there and ${r.afterOff.mine} ` +
            `on the second. The menu offered: ${r.lines.join(" | ")}. Back to ${r.after} shelf`
  };
});

check("a note in two favourites is one note on the shelf", async (p) => {
  const r = await p.j(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0].books
      .filter(function (b) { return b.key !== "-undated" && b.notes.length; })[0];
    var month = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0].books
      .filter(function (b) { return b.key.indexOf(years.key + "-") === 0; })[0];
    fav.picks = [];
    __vs.pick(years.id);
    __vs.pick(month.id);
    var view = __vs.views().filter(function (v) { return v.shelf.id === fav.id; })[0];
    var report = __vs.checkMembership().filter(function (r) { return r.shelf === fav.id; })[0];
    var head = document.querySelector('[data-shelf="' + fav.id + '"] .vs-shelfhead .vs-meta').textContent;
    fav.picks = [];
    __vs.setFilters({});
    return { years: years.id, yearsNotes: years.notes.length, month: month.id,
             monthNotes: month.notes.length, books: view.books.length, claimed: view.noteCount,
             unique: report.unique, sum: report.sum, ok: report.ok, head: head };
  })()`);
  const ok = r.books === 2 && r.ok && r.sum === r.yearsNotes + r.monthNotes &&
             r.unique === r.yearsNotes && r.claimed === r.unique && r.sum > r.unique &&
             r.head.indexOf(r.claimed + " notes") >= 0;
  return {
    ok,
    detail: `${r.years} (${r.yearsNotes} notes) and ${r.month} (${r.monthNotes}) on Favourites: ` +
            `${r.sum} places, ${r.unique} unique notes, the shelf claims ${r.claimed} and the ` +
            `header says "${r.head}"`
  };
});

/* design/0020 -- built by the real menu and sheet, then measured. */
check("a book made on the shelf holds the notes it points at, where it was made", async (p) => {
  await p.eval(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    fav.picks = [];
    delete fav.made;
    __vs.setFilters({});
    document.getElementById("vs-library").scrollTop = 0;
  })(); void 0`);
  await sleep(250);
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var viewOf = function (id) {
      return __vs.views().filter(function (v) { return v.shelf.id === id; })[0];
    };
    var spineOf = function (id) {
      return document.querySelector('#vs-shelves [data-book="' + id.replace(/"/g, '\\"') + '"]');
    };
    var rail = document.querySelector('#vs-shelves [data-shelf="' + fav.id + '"] .vs-shelfrail');
    var inFolder = function (n, f) { return n.folder === f || n.folder.indexOf(f + "/") === 0; };
    var byFolder = {};
    __vs.data().notes.forEach(function (n) { byFolder[n.folder] = (byFolder[n.folder] || 0) + 1; });
    var folders = Object.keys(byFolder).sort(function (a, b) { return byFolder[b] - byFolder[a]; });
    var folder = folders[0], other = folders[folders.length - 1];
    var expected = __vs.data().notes.filter(function (n) { return inFolder(n, folder); }).length;

    /* 1. right-click the empty landing, and the menu offers one thing */
    var landing = rail.querySelector(".vs-dropzone");
    var track = landing.parentElement;
    var lb = landing.getBoundingClientRect();
    track.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true,
      clientX: Math.round(lb.left + lb.width / 2), clientY: Math.round(lb.top + lb.height / 2) }));
    var menu = document.getElementById("vs-railmenu");
    /* github#44 -- the twelve stand above it, so the line is asked by name */
    var line = menu.querySelector(".vs-railline");
    var offered = { shown: !menu.hidden, text: line ? line.textContent : null,
                    named: menu.querySelector(".vs-dyename").textContent,
                    dyeShut: document.getElementById("vs-dye").hidden };
    line.click();

    /* 2. the sheet: a name and what it holds, with the real count under it */
    var sheet = document.getElementById("vs-madebook");
    var name = document.getElementById("vs-mbname");
    var kind = document.getElementById("vs-mbsource");
    var val = document.getElementById("vs-mbsourceval");
    var form = { shown: !sheet.hidden, menuShut: menu.hidden,
                 title: document.getElementById("vs-mbtitle").textContent,
                 focused: document.activeElement === name,
                 deleteHidden: document.getElementById("vs-mbdelete").hidden,
                 /* the name is suggested from what it holds, and follows it until typed */
                 suggested: name.value, firstValue: val.value };
    kind.value = "folder";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    val.value = folder;
    val.dispatchEvent(new Event("change", { bubbles: true }));
    form.followed = name.value;
    form.leaf = folder.split("/").pop();
    name.value = "Dailies";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    form.count = document.getElementById("vs-mbcount").textContent;
    document.getElementById("vs-mbsave").click();
    form.shut = sheet.hidden;

    /* 3. the book: its own address, the folder's notes, a spine like any favourite */
    var made = viewOf(fav.id).books[0];
    var spine = made ? spineOf(made.id) : null;
    var book = {
      id: made ? made.id : "", key: made ? made.key : "", label: made ? made.label : "",
      notes: made ? made.notes.length : -1, expected: expected,
      spine: !!spine, focused: !!spine && document.activeElement === spine,
      draggable: !!spine && spine.draggable, hand: !!spine && spine.getAttribute("data-hand") === "1",
      landingGone: !document.querySelector('#vs-shelves [data-shelf="' + fav.id + '"] .vs-dropzone'),
      /* github#38 -- the shelf's own head, since the strip went. */
      head: document.querySelector('[data-shelf="' + fav.id + '"] .vs-shelfhead .vs-meta').textContent,
      picks: fav.picks.slice(), defined: !!(fav.made && made && fav.made[made.key])
    };

    /* 4. a favourite of a year it overlaps: one note, counted once */
    var dated = made.notes.filter(function (n) { return n.date; })[0];
    var yearId = dated ? "years/" + dated.date.slice(0, 4) : viewOf("years").books[0].id;
    __vs.pick(yearId);
    var report = __vs.checkMembership().filter(function (x) { return x.shelf === fav.id; })[0];
    var overlap = { books: viewOf(fav.id).books.length, sum: report.sum, unique: report.unique,
                    claimed: viewOf(fav.id).noteCount, ok: report.ok, overlaps: report.sum > report.unique,
                    dated: !!dated };

    /* 5. a filter narrows it, and moves nothing: same address, same picks, an empty spine at worst */
    var narrowedTo = __vs.data().notes.filter(function (n) {
      return inFolder(n, folder) && inFolder(n, other);
    }).length;
    __vs.setFilters({ folders: [other] });
    var narrowed = viewOf(fav.id).books.filter(function (b) { return b.key === made.key; })[0];
    var filtered = { there: !!narrowed, notes: narrowed ? narrowed.notes.length : -1, expected: narrowedTo,
                     empty: !!spineOf(made.id) && spineOf(made.id).getAttribute("data-empty") === "1",
                     picks: JSON.stringify(fav.picks) };
    __vs.setFilters({ folders: [] });

    /* 6. the settings round-trip through migrate, and a hand-edited file is put right */
    var blob = JSON.parse(JSON.stringify(__vs.settings()));
    var back = core.migrate(blob).shelves.filter(function (s) { return s.id === fav.id; })[0];
    var roundtrip = { picks: JSON.stringify(back.picks) === JSON.stringify(fav.picks),
                      made: JSON.stringify(back.made) === JSON.stringify(fav.made) };
    var edited = core.migrate({ schema: 10, shelves: [{ id: "favourites", name: "F",
      source: { kind: "all" }, classifier: "pick", direction: "manual", hidden: false,
      position: 0, plaques: false,
      picks: ["-made-gone", "years/2024", "-made-x"],
      made: { "-made-x": { name: "X", source: { kind: "folder", value: "a" } },
              "-made-bad": { name: 3 },
              "-made-lost": { name: "Lost", source: { kind: "tag", value: "t" } },
              "years/2024": { name: "Nope", source: { kind: "all" } } } }] }).shelves[0];
    var normalised = { picks: edited.picks, made: Object.keys(edited.made) };

    /* 7. a second one, right-clicked into the gap before the year: it lands there */
    var ySpine = spineOf(fav.id + "/" + yearId);
    var yb = ySpine.getBoundingClientRect();
    ySpine.closest(".vs-track").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true,
      cancelable: true, clientX: Math.round(yb.left - 1), clientY: Math.round(yb.top + yb.height / 2) }));
    menu.querySelector("button").click();
    /* nothing typed: the whole vault suggests "Everything", and a cleared name comes back to it */
    kind.value = "all";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    var wholeSuggested = name.value;
    name.value = "";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    var wholeCleared = name.value;
    var wholeCount = document.getElementById("vs-mbcount").textContent;
    var valueHidden = val.hidden;
    document.getElementById("vs-mbsave").click();
    var whole = viewOf(fav.id).books.filter(function (b) { return b.key === "-made-everything"; })[0];
    var between = { sequence: __vs.sequence(fav.id), notes: whole ? whole.notes.length : -1,
                    total: __vs.data().notes.length, count: wholeCount, valueHidden: valueHidden,
                    suggested: wholeSuggested, cleared: wholeCleared, label: whole ? whole.label : "" };

    /* 8. Alt+Right moves it along the shelf like any book arranged by hand */
    var dSpine = spineOf(made.id);
    dSpine.focus();
    dSpine.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));
    var nudged = __vs.sequence(fav.id);

    /* 9. it is a place a note lives: a ribbon in it resolves to it, "also shelved in" offers it,
     *    and opening it opens it -- while the reference beside it stays invisible to all three */
    var note = viewOf(fav.id).books.filter(function (b) { return b.key === made.key; })[0].notes[0];
    __vs.settings().reading.push({ noteId: note.id, shelfId: fav.id, bookId: made.id, at: Date.now() });
    __vs.setFilters({});
    var resolved = core.resolveReading(note.id, made.id, __vs.views());
    var alsoIn = core.alsoShelvedIn(note.id, __vs.views(), "nowhere").map(function (b) { return b.id; });
    __vs.openBook(made.id);
    var opened = __vs.reader();
    __vs.closeReader();
    var place = {
      onReadingShelf: !!document.querySelector('#vs-shelves [data-shelf="-reading"] [data-book="' + made.id + '"]'),
      resolved: resolved ? resolved.id : null,
      ribbon: !!spineOf(made.id).querySelector(".vs-ribbon"),
      alsoIn: alsoIn.indexOf(made.id) >= 0,
      referenceNot: alsoIn.indexOf(fav.id + "/" + yearId) < 0,
      opened: opened ? opened.book : null
    };
    __vs.settings().reading.pop();

    /* put the shelf back */
    __vs.unmakeBook(made.id);
    __vs.unmakeBook(fav.id + "/-made-everything");
    fav.picks = [];
    __vs.setFilters({});
    return { offered: offered, form: form, book: book, overlap: overlap, filtered: filtered,
             roundtrip: roundtrip, normalised: normalised, between: between, nudged: nudged,
             place: place, yearId: yearId, folder: folder, other: other,
             left: viewOf(fav.id).books.length, madeLeft: Object.keys(__vs.made(fav.id)).length };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok = r.offered.shown && r.offered.text === "New book here…" && r.offered.dyeShut &&
             r.form.shown && r.form.menuShut && r.form.focused && r.form.deleteHidden &&
             r.form.title.indexOf("New book") === 0 && r.form.count === r.book.expected + " notes" &&
             r.form.suggested === r.form.firstValue.split("/").pop() && r.form.followed === r.form.leaf &&
             r.form.shut &&
             r.between.suggested === "Everything" && r.between.cleared === "Everything" &&
             r.between.label === "Everything" &&
             r.book.id === "favourites/-made-dailies" &&
             r.book.key === "-made-dailies" && r.book.label === "Dailies" &&
             r.book.notes === r.book.expected && r.book.notes > 0 && r.book.spine && r.book.focused &&
             r.book.draggable && r.book.hand && r.book.landingGone &&
             r.book.head.indexOf("1 book ") === 0 &&
             same(r.book.picks, ["-made-dailies"]) && r.book.defined &&
             r.overlap.books === 2 && r.overlap.ok && r.overlap.claimed === r.overlap.unique &&
             (!r.overlap.dated || r.overlap.overlaps) &&
             r.filtered.there && r.filtered.notes === r.filtered.expected &&
             (r.filtered.notes > 0 || r.filtered.empty) &&
             r.filtered.picks === JSON.stringify(["-made-dailies", r.yearId]) &&
             r.roundtrip.picks && r.roundtrip.made &&
             same(r.normalised.picks, ["years/2024", "-made-x", "-made-lost"]) &&
             same(r.normalised.made, ["-made-x", "-made-lost"]) &&
             same(r.between.sequence, ["-made-dailies", "-made-everything", r.yearId]) &&
             r.between.notes === r.between.total && r.between.valueHidden &&
             r.between.count === r.between.total + " notes, the whole vault" &&
             same(r.nudged, ["-made-everything", "-made-dailies", r.yearId]) &&
             r.place.onReadingShelf && r.place.resolved === r.book.id && r.place.ribbon &&
             r.place.alsoIn && r.place.referenceNot && r.place.opened === r.book.id &&
             r.left === 0 && r.madeLeft === 0;
  return {
    ok,
    detail: `right-click on the landing offered "${r.offered.text}" under "${r.offered.named}"; the ` +
            `sheet "${r.form.title}" suggested "${r.form.suggested}" for ${r.form.firstValue}, then ` +
            `"${r.form.followed}" for ${r.folder}, counted "${r.form.count}" and made ${r.book.id} ("${r.book.label}", ` +
            `${r.book.notes} of ${r.book.expected} notes in ${r.folder}), draggable ${r.book.draggable}, ` +
            `a handle ${r.book.hand}, focused ${r.book.focused}, the shelf head says "${r.book.head}"; with ` +
            `${r.yearId} beside it ${r.overlap.sum} places are ${r.overlap.unique} notes and the shelf ` +
            `claims ${r.overlap.claimed}; a filter to ${r.other} left ${r.filtered.notes} of ` +
            `${r.filtered.expected} (empty spine ${r.filtered.empty}) and the picks ${r.filtered.picks}; ` +
            `migrate round-trips picks ${r.roundtrip.picks} and made ${r.roundtrip.made}, a hand-edited ` +
            `file comes up [${r.normalised.picks.join(", ")}] defining [${r.normalised.made.join(", ")}]; ` +
            `a second one right-clicked into the gap, left unnamed (suggested "${r.between.suggested}", ` +
            `cleared back to "${r.between.cleared}", saved as "${r.between.label}"), gave ` +
            `[${r.between.sequence.join(", ")}] holding ${r.between.notes} of ${r.between.total} ` +
            `("${r.between.count}"), Alt+Right gave ` +
            `[${r.nudged.join(", ")}]; a ribbon resolves to ${r.place.resolved}, is drawn ${r.place.ribbon}, ` +
            `on the Reading shelf ${r.place.onReadingShelf}, also-shelved-in offers it ${r.place.alsoIn} ` +
            `and not the reference ${r.place.referenceNot}, opening it opened ${r.place.opened}; ` +
            `left ${r.left} books and ${r.madeLeft} definitions` +
            (ok ? "" : `; flags: ${JSON.stringify({ offered: r.offered, form: r.form, book: r.book })}`)
  };
});

/* design/0020 -- edited, emptied, deleted; the vault untouched. */
check("a made book is edited, emptied and deleted from its own menu, and the vault does not move",
      async (p) => {
  await p.eval(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    fav.picks = [];
    delete fav.made;
    __vs.setFilters({});
    document.getElementById("vs-library").scrollTop = 0;
  })(); void 0`);
  await sleep(250);
  const r = await p.j(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    var viewOf = function (id) {
      return __vs.views().filter(function (v) { return v.shelf.id === id; })[0];
    };
    var spineOf = function (id) {
      return document.querySelector('#vs-shelves [data-book="' + id.replace(/"/g, '\\"') + '"]');
    };
    var at = function (el, dt) {
      var b = el.getBoundingClientRect();
      return { bubbles: true, cancelable: true, dataTransfer: dt,
               clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 };
    };
    var notesBefore = JSON.stringify(__vs.data().notes);
    var byFolder = {}, byTag = {};
    __vs.data().notes.forEach(function (n) {
      byFolder[n.folder] = (byFolder[n.folder] || 0) + 1;
      n.tags.forEach(function (t) { byTag[t] = (byTag[t] || 0) + 1; });
    });
    var folder = Object.keys(byFolder).sort(function (a, b) { return byFolder[b] - byFolder[a]; })[0];
    var tag = Object.keys(byTag).sort(function (a, b) { return byTag[b] - byTag[a]; })[0] || "";
    var tagged = tag
      ? __vs.data().notes.filter(function (n) {
          return n.tags.some(function (t) { return t === tag || t.indexOf(tag + "/") === 0; });
        }).length
      : __vs.data().notes.length;

    var id = __vs.makeBook(fav.id, { name: "Dailies", source: { kind: "folder", value: folder } }, null);
    var first = viewOf(fav.id).books[0].notes.length;

    /* 1. the menu on a made spine: the twelve, then edit and delete, and no "take off" */
    var spine = spineOf(id);
    spine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));
    var dye = document.getElementById("vs-dye");
    var lines = [].map.call(dye.querySelectorAll(".vs-dyepick"), function (b) { return b.textContent; });
    var swatches = dye.querySelectorAll(".vs-swatch").length;

    /* 2. edit: the sheet comes up filled in; a rename and a new predicate keep the address */
    dye.querySelectorAll(".vs-dyepick")[0].click();
    var sheet = document.getElementById("vs-madebook");
    var name = document.getElementById("vs-mbname");
    var kind = document.getElementById("vs-mbsource");
    var val = document.getElementById("vs-mbsourceval");
    var form = { shown: !sheet.hidden, menuShut: dye.hidden,
                 title: document.getElementById("vs-mbtitle").textContent,
                 name: name.value, kind: kind.value, value: val.value,
                 deleteOffered: !document.getElementById("vs-mbdelete").hidden };
    name.value = "Journal";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    kind.value = tag ? "tag" : "all";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    if (tag) { val.value = tag; val.dispatchEvent(new Event("change", { bubbles: true })); }
    document.getElementById("vs-mbsave").click();
    var edited = viewOf(fav.id).books[0];
    var afterEdit = { id: edited.id, label: edited.label, notes: edited.notes.length, expected: tagged,
                      picks: fav.picks.slice(), defined: fav.made[edited.key].name };

    /* 3. a source the vault has lost: an empty book, kept through a save, unlike a dead pick */
    __vs.editBook(id, { name: "Journal", source: { kind: "folder", value: "nowhere/at/all" } });
    var years = viewOf("years").books[0].id;
    __vs.pick(years);
    var emptied = viewOf(fav.id).books.filter(function (b) { return b.id === id; })[0];
    var eSpine = spineOf(id);
    var hollow = { there: !!emptied, notes: emptied ? emptied.notes.length : -1,
                   emptySpine: !!eSpine && eSpine.getAttribute("data-empty") === "1",
                   picksAfterSave: fav.picks.slice(), defined: !!(fav.made && fav.made["-made-dailies"]) };
    __vs.unpick(years);

    /* 4. a colour and wear given to it; an abandoned drag keeps it; a drop off the rail deletes it */
    __vs.settings().bookColors[id] = 4;
    __vs.settings().wear[id] = 3;
    __vs.setFilters({});
    var yearsBooks = viewOf("years").books.length;
    var onto = document.querySelector('[data-shelf="years"] .vs-track');
    var dt = new DataTransfer();
    var lifted = spineOf(id);
    lifted.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    onto.dispatchEvent(new DragEvent("dragover", at(onto, dt)));
    var wasLeaving = __vs.leaving(id);
    lifted.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    var kept = { still: !!spineOf(id), defined: !!(fav.made && fav.made["-made-dailies"]), leaving: wasLeaving };
    var dt2 = new DataTransfer();
    lifted = spineOf(id);
    lifted.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt2 }));
    onto.dispatchEvent(new DragEvent("dragover", at(onto, dt2)));
    onto.dispatchEvent(new DragEvent("drop", at(onto, dt2)));
    lifted.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt2 }));
    var gone = { spine: !!spineOf(id), defined: !!(fav.made && fav.made["-made-dailies"]),
                 picks: fav.picks.slice(), colour: __vs.settings().bookColors[id],
                 wear: __vs.settings().wear[id], yearsBooks: viewOf("years").books.length,
                 yearsBefore: yearsBooks };

    /* 5. made again and deleted by the menu line; made again and deleted from its own sheet */
    id = __vs.makeBook(fav.id, { name: "Dailies", source: { kind: "folder", value: folder } }, null);
    spineOf(id).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));
    dye.querySelectorAll(".vs-dyepick")[1].click();
    var byMenu = { spine: !!spineOf(id), picks: fav.picks.length, menuShut: dye.hidden };
    id = __vs.makeBook(fav.id, { name: "Dailies", source: { kind: "folder", value: folder } }, null);
    spineOf(id).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));
    dye.querySelectorAll(".vs-dyepick")[0].click();
    document.getElementById("vs-mbdelete").click();
    var bySheet = { spine: !!spineOf(id), picks: fav.picks.length, sheetShut: sheet.hidden,
                    landing: !!document.querySelector('[data-shelf="' + fav.id + '"] .vs-dropzone') };

    fav.picks = [];
    delete fav.made;
    __vs.setFilters({});
    return { first: first, lines: lines, swatches: swatches, form: form, afterEdit: afterEdit,
             hollow: hollow, kept: kept, gone: gone, byMenu: byMenu, bySheet: bySheet,
             folder: folder, tag: tag, id: "favourites/-made-dailies",
             vaultSame: JSON.stringify(__vs.data().notes) === notesBefore,
             notes: __vs.data().notes.length };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok = r.first > 0 && same(r.lines, ["Edit book…", "Delete book"]) && r.swatches === 14 &&
             r.form.shown && r.form.menuShut && r.form.title === "Edit book" && r.form.name === "Dailies" &&
             r.form.kind === "folder" && r.form.value === r.folder && r.form.deleteOffered &&
             r.afterEdit.id === r.id && r.afterEdit.label === "Journal" &&
             r.afterEdit.notes === r.afterEdit.expected && same(r.afterEdit.picks, ["-made-dailies"]) &&
             r.afterEdit.defined === "Journal" &&
             r.hollow.there && r.hollow.notes === 0 && r.hollow.emptySpine &&
             r.hollow.picksAfterSave.length === 2 && r.hollow.picksAfterSave[0] === "-made-dailies" && r.hollow.defined &&
             r.kept.still && r.kept.defined && r.kept.leaving &&
             !r.gone.spine && !r.gone.defined && same(r.gone.picks, []) && r.gone.colour === undefined &&
             r.gone.wear === undefined && r.gone.yearsBooks === r.gone.yearsBefore &&
             !r.byMenu.spine && r.byMenu.picks === 0 && r.byMenu.menuShut &&
             !r.bySheet.spine && r.bySheet.picks === 0 && r.bySheet.sheetShut && r.bySheet.landing &&
             r.vaultSame;
  return {
    ok,
    detail: `${r.id} held ${r.first} notes of ${r.folder}; its menu offered ${r.swatches} swatches and ` +
            `[${r.lines.join(" | ")}]; the sheet came up "${r.form.title}" as "${r.form.name}" / ` +
            `${r.form.kind} ${r.form.value} with delete ${r.form.deleteOffered}; renamed and repointed at ` +
            `${r.tag ? "#" + r.tag : "the whole vault"} it is still ${r.afterEdit.id}, called ` +
            `"${r.afterEdit.label}", ${r.afterEdit.notes} of ${r.afterEdit.expected} notes; pointed at a ` +
            `folder the vault lacks it is ${r.hollow.notes} notes on an empty spine (${r.hollow.emptySpine}) ` +
            `and a save kept it (${r.hollow.picksAfterSave.join(", ")}); an abandoned drag left it ` +
            `(${r.kept.still}, marked leaving ${r.kept.leaving}); a drop on Years deleted it -- spine ` +
            `${r.gone.spine}, defined ${r.gone.defined}, colour ${r.gone.colour}, wear ${r.gone.wear}, ` +
            `Years still ${r.gone.yearsBooks} books; by the menu line: spine ${r.byMenu.spine}; from ` +
            `its sheet: spine ${r.bySheet.spine}, landing back ${r.bySheet.landing}; the vault's ` +
            `${r.notes} notes are byte-identical: ${r.vaultSame}`
  };
});

/* design/0020 -- on a shelf arranged by hand, and the plus that ends it. */
check("a book is made on any shelf arranged by hand, and a plus stands where the books end",
      async (p) => {
  await p.eval(`(function(){
    var fav = __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0];
    fav.picks = [];
    delete fav.made;
    __vs.setFilters({});
    document.getElementById("vs-library").scrollTop = 0;
  })(); void 0`);
  await sleep(250);
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var shelves = __vs.settings().shelves;
    var years = shelves.filter(function (s) { return s.id === "years"; })[0];
    var viewOf = function (id) {
      return __vs.views().filter(function (v) { return v.shelf.id === id; })[0];
    };
    var spineOf = function (id) {
      return document.querySelector('#vs-shelves [data-book="' + id.replace(/"/g, '\\"') + '"]');
    };
    var plusOn = function (id) {
      return document.querySelectorAll('#vs-shelves [data-shelf="' + id + '"] .vs-plusbook');
    };
    var byFolder = {};
    __vs.data().notes.forEach(function (n) { byFolder[n.folder] = (byFolder[n.folder] || 0) + 1; });
    var folder = Object.keys(byFolder).sort(function (a, b) { return byFolder[b] - byFolder[a]; })[0];
    var expected = __vs.data().notes.filter(function (n) {
      return n.folder === folder || n.folder.indexOf(folder + "/") === 0;
    }).length;

    /* 1. an automatic shelf has no plus and refuses to make a book; a hand-arranged one has both */
    var was = { direction: years.direction, order: years.order ? years.order.slice() : undefined };
    var before = { plus: plusOn("years").length, favPlus: plusOn("favourites").length,
                   refused: __vs.makeBook("years", { name: "Nope", source: { kind: "all" } }, null) };
    years.direction = "manual";
    years.order = viewOf("years").books.map(function (b) { return b.key; });
    __vs.setFilters({});
    var manual = { plus: plusOn("years").length, plusLast: false, height: 0, width: 0, opacity: "" };
    var plus = plusOn("years")[0];
    if (plus) {
      var track = plus.closest(".vs-track");
      var last = track.querySelectorAll(".vs-spine");
      manual.plusLast = last.length > 0 && plus.getBoundingClientRect().left > last[last.length - 1].getBoundingClientRect().right;
      var pb = plus.getBoundingClientRect();
      manual.height = Math.round(pb.height); manual.width = Math.round(pb.width);
      manual.opacity = getComputedStyle(plus).opacity;
      manual.lastTrack = track === track.parentElement.lastElementChild;
      manual.named = plus.getAttribute("aria-label");
    }

    /* 2. the plus opens the sheet; the book lands at the end of the arrangement, once */
    plus.click();
    var sheet = document.getElementById("vs-madebook");
    var form = { shown: !sheet.hidden, title: document.getElementById("vs-mbtitle").textContent };
    var name = document.getElementById("vs-mbname");
    name.value = "Dailies";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    var val = document.getElementById("vs-mbsourceval");
    val.value = folder;
    val.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("vs-mbsave").click();
    var made = viewOf("years").books.filter(function (b) { return b.key === "-made-dailies"; })[0];
    var seq = __vs.sequence("years");
    var report = __vs.checkMembership().filter(function (x) { return x.shelf === "years"; })[0];
    var book = { id: made ? made.id : "", notes: made ? made.notes.length : -1, expected: expected,
                 last: seq[seq.length - 1] === "-made-dailies", inOrder: years.order.indexOf("-made-dailies") >= 0,
                 unique: report.unique, claimed: report.ok, plaqued: made ? made.plaque : "?",
                 spineHand: !!spineOf("years/-made-dailies") && spineOf("years/-made-dailies").getAttribute("data-hand") === "1",
                 plusStillLast: (function () {
                   var pl = plusOn("years")[0]; var sp = spineOf("years/-made-dailies");
                   return !!pl && !!sp && pl.getBoundingClientRect().left > sp.getBoundingClientRect().right;
                 })() };

    /* 3. Alt+Left moves it; a rename keeps the address; the menu edits and deletes it */
    var sp = spineOf("years/-made-dailies");
    sp.focus();
    sp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
    var nudged = __vs.sequence("years");
    __vs.editBook("years/-made-dailies", { name: "Journal", source: { kind: "folder", value: folder } });
    var renamed = viewOf("years").books.filter(function (b) { return b.key === "-made-dailies"; })[0];
    spineOf("years/-made-dailies").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }));
    var lines = [].map.call(document.querySelectorAll("#vs-dye .vs-dyepick"), function (b) { return b.textContent; });
    document.querySelectorAll("#vs-dye .vs-dyepick")[1].click();
    var gone = { spine: !!spineOf("years/-made-dailies"), inOrder: years.order.indexOf("-made-dailies") >= 0,
                 defined: !!(years.made && years.made["-made-dailies"]), books: viewOf("years").books.length };

    /* 4. a settings file round-trips a made book on an ordinary shelf */
    __vs.makeBook("years", { name: "Dailies", source: { kind: "folder", value: folder } }, null);
    var blob = JSON.parse(JSON.stringify(__vs.settings()));
    var back = core.migrate(blob).shelves.filter(function (s) { return s.id === "years"; })[0];
    var roundtrip = { made: JSON.stringify(back.made) === JSON.stringify(years.made),
                      order: JSON.stringify(back.order) === JSON.stringify(years.order) };
    /* and an automatic shelf keeps the book, sorted last */
    years.direction = "alphabetical";
    __vs.setFilters({});
    var auto = __vs.sequence("years");
    var autoState = { last: auto[auto.length - 1] === "-made-dailies", plus: plusOn("years").length,
                      afterUndated: auto.indexOf("-made-dailies") > auto.indexOf("-undated") };
    __vs.unmakeBook("years/-made-dailies");

    years.direction = was.direction;
    if (was.order) years.order = was.order; else delete years.order;
    delete years.made;
    __vs.setFilters({});
    return { before: before, manual: manual, form: form, book: book, nudged: nudged,
             renamed: renamed ? renamed.label : "", renamedId: renamed ? renamed.id : "",
             lines: lines, gone: gone, roundtrip: roundtrip, auto: autoState, folder: folder,
             left: viewOf("years").books.filter(function (b) { return core.isMadeKey(b.key); }).length };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const n = r.nudged;
  const ok = r.before.plus === 0 && r.before.favPlus === 1 && r.before.refused === "" &&
             r.manual.plus === 1 && r.manual.plusLast && r.manual.lastTrack && r.manual.height === 132 &&
             r.manual.width === 22 && Number(r.manual.opacity) < 0.5 && r.manual.named === "New book on Years" &&
             r.form.shown && r.form.title === "New book on Years" &&
             r.book.id === "years/-made-dailies" && r.book.notes === r.book.expected && r.book.last &&
             r.book.inOrder && r.book.claimed && r.book.plaqued === null && r.book.spineHand && r.book.plusStillLast &&
             n[n.length - 2] === "-made-dailies" && r.renamed === "Journal" && r.renamedId === "years/-made-dailies" &&
             same(r.lines, ["Edit book…", "Delete book"]) && !r.gone.spine && !r.gone.inOrder && !r.gone.defined &&
             r.roundtrip.made && r.roundtrip.order && r.auto.last && r.auto.afterUndated && r.auto.plus === 0 &&
             r.left === 0;
  return {
    ok,
    detail: `Years automatic: ${r.before.plus} plus, makeBook refused ("${r.before.refused}"); Favourites: ` +
            `${r.before.favPlus} plus. Years by hand: ${r.manual.plus} plus, after the last book ` +
            `${r.manual.plusLast}, on the last row ${r.manual.lastTrack}, ${r.manual.width}x${r.manual.height} ` +
            `at opacity ${r.manual.opacity}, named "${r.manual.named}"; it opened "${r.form.title}" and made ` +
            `${r.book.id} (${r.book.notes} of ${r.book.expected} in ${r.folder}), last in the order ${r.book.last}, ` +
            `in \`order\` ${r.book.inOrder}, counted once ${r.book.claimed}, plaque ${r.book.plaqued}, a handle ` +
            `${r.book.spineHand}, plus still after it ${r.book.plusStillLast}; Alt+Left put it second to last ` +
            `(${n.slice(-3).join(", ")}); renamed "${r.renamed}" at ${r.renamedId}; menu [${r.lines.join(" | ")}]; ` +
            `deleted: spine ${r.gone.spine}, in order ${r.gone.inOrder}, defined ${r.gone.defined}; migrate ` +
            `round-trips made ${r.roundtrip.made} and order ${r.roundtrip.order}; back to automatic it sorts last ` +
            `${r.auto.last} (after Undated ${r.auto.afterUndated}) with ${r.auto.plus} plus; ${r.left} left`
  };
});

/* github#34, design/0024 -- the pointer is dispatched ONCE
 * github#34, design/0024 -- what moves the room is the loop, not the events
 */
check("a drag that reaches the edge scrolls the room, and stops at the ends", async (p) => {
  const set = await p.j(`(function(){
    var lib = document.getElementById("vs-library");
    __vs.addShelf({ id: "edge-landing", name: "Edge landing", source: { kind: "all" },
                    classifier: "pick", direction: "manual", hidden: false,
                    plaques: false, picks: [] });
    var offsetOf = function () {
      var r = document.querySelector('[data-shelf="edge-landing"] .vs-track')
                      .getBoundingClientRect();
      return r.top - lib.getBoundingClientRect().top + lib.scrollTop;
    };
    /* Park the landing rail 300px BELOW the fold: off screen when the drag begins, and
     * reachable only because the room scrolls under it. github#21 -- scroll, re-measure,
     * scroll, because content-visibility makes an off-screen shelf's height a guess. */
    for (var i = 0; i < 3; i++) {
      lib.scrollTop = Math.max(0, offsetOf() - lib.clientHeight - 300);
    }
    var lb = lib.getBoundingClientRect();
    var after = document.querySelector('[data-shelf="edge-landing"] .vs-track')
                        .getBoundingClientRect();
    return { offScreen: after.top > lb.bottom, gap: Math.round(after.top - lb.bottom),
             top: lib.scrollTop, max: Math.max(0, lib.scrollHeight - lib.clientHeight) };
  })()`);
  const lift = await p.j(`(function(){
    var lib = document.getElementById("vs-library");
    var lb = lib.getBoundingClientRect();
    /* design/0019 -- OFF AN ORDINARY SHELF, not off Favourites. The library's first spine is
     * a pick, and a reference dropped onto a second pick shelf resolves to nothing: the drag
     * under test is a book's, not a reference to a reference. */
    var picks = __vs.picks().map(function (s) { return s.id; });
    var spine = [].filter.call(document.querySelectorAll("#vs-shelves .vs-spine"),
      function (s) {
        var sec = s.closest("[data-shelf]");
        return sec && picks.indexOf(sec.getAttribute("data-shelf")) < 0;
      })[0];
    var dt = new DataTransfer();
    spine.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    window.__vsEdge = { dt: dt, from: spine, id: spine.getAttribute("data-book"),
                        x: Math.round(lb.left + lb.width / 2) };
    var y = Math.round(lb.bottom - 6);
    var under = document.elementFromPoint(window.__vsEdge.x, y) || lib;
    under.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
      dataTransfer: dt, clientX: window.__vsEdge.x, clientY: y }));
    var e = __vs.edgeScroll();
    return { lifted: spine.getAttribute("data-dragging"), running: e.running,
             speed: Math.round(e.speed * 10) / 10, top: e.top };
  })()`);
  /* github#34 -- THE POINTER IS NOW STILL from here on
   * github#21 -- and the rail keeps MOVING AWAY as shelves render under it
   * github#34 -- so wait for the loop to win rather than a fixed sleep
   */
  const seen = [lift.top];
  let reach = null;
  for (let i = 0; i < 24 && !reach; i++) {
    await sleep(150);
    const now = await p.j(`(function(){
      var lib = document.getElementById("vs-library");
      var rail = document.querySelector('[data-shelf="edge-landing"] .vs-track');
      var r = rail.getBoundingClientRect(), lb = lib.getBoundingClientRect();
      var e = __vs.edgeScroll();
      return { top: e.top, running: e.running, max: e.max,
               clear: r.top + r.height / 2 < lb.bottom - 64 };
    })()`);
    seen.push(now.top);
    if (now.clear) reach = now;
  }
  const a = seen[1];
  const b = { top: seen[seen.length - 1], reached: !!reach };
  /* github#34 -- move to the rail the scroll brought into reach */
  const landed = await p.j(`(function(){
    var rail = document.querySelector('[data-shelf="edge-landing"] .vs-track');
    var rb = rail.getBoundingClientRect();
    var at = { bubbles: true, cancelable: true, dataTransfer: window.__vsEdge.dt,
               clientX: Math.round(rb.left + rb.width / 2),
               clientY: Math.round(rb.top + rb.height / 2) };
    rail.dispatchEvent(new DragEvent("dragover", at));
    var stoppedOnLeaving = !__vs.edgeScroll().running;
    rail.dispatchEvent(new DragEvent("drop", at));
    window.__vsEdge.from.dispatchEvent(new DragEvent("dragend",
      { bubbles: true, dataTransfer: window.__vsEdge.dt }));
    var shelf = __vs.picks().filter(function (s) { return s.id === "edge-landing"; })[0];
    return { stoppedOnLeaving: stoppedOnLeaving, holds: shelf ? shelf.picks.slice() : [],
             wanted: window.__vsEdge.id, running: __vs.edgeScroll().running,
             marksLeft: document.querySelectorAll(
               "#vs-shelves [data-drop], #vs-shelves [data-dragging]").length };
  })()`);
  /* github#34 -- both ends: it clamps at the foot, and goes back up */
  await p.j(`(function(){
    var lib = document.getElementById("vs-library");
    var lb = lib.getBoundingClientRect();
    var spine = document.querySelector("#vs-shelves .vs-spine");
    var dt = new DataTransfer();
    spine.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    window.__vsEdge = { dt: dt, from: spine, x: Math.round(lb.left + lb.width / 2) };
    /* github#21 -- the foot moves as content-visibility firms up; take it twice. */
    lib.scrollTop = Math.max(0, lib.scrollHeight - lib.clientHeight - 40);
    lib.scrollTop = Math.max(0, lib.scrollHeight - lib.clientHeight - 40);
    var y = Math.round(lb.bottom - 2);
    var under = document.elementFromPoint(window.__vsEdge.x, y) || lib;
    under.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
      dataTransfer: dt, clientX: window.__vsEdge.x, clientY: y }));
    return { max: Math.max(0, lib.scrollHeight - lib.clientHeight) };
  })()`);
  await sleep(250);
  const foot = await p.j(`(function(){ var e = __vs.edgeScroll();
    return { top: e.top, max: e.max, running: e.running }; })()`);
  await sleep(200);
  const stillFoot = await p.j(`__vs.edgeScroll().top`);
  const head = await p.j(`(function(){
    var lib = document.getElementById("vs-library");
    var lb = lib.getBoundingClientRect();
    var y = Math.round(lb.top + 2);
    var under = document.elementFromPoint(window.__vsEdge.x, y) || lib;
    under.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
      dataTransfer: window.__vsEdge.dt, clientX: window.__vsEdge.x, clientY: y }));
    return { speed: Math.round(__vs.edgeScroll().speed * 10) / 10, top: __vs.edgeScroll().top };
  })()`);
  await sleep(250);
  const up = await p.j(`__vs.edgeScroll().top`);
  const clean = await p.j(`(function(){
    window.__vsEdge.from.dispatchEvent(new DragEvent("dragend",
      { bubbles: true, dataTransfer: window.__vsEdge.dt }));
    var running = __vs.edgeScroll().running;
    __vs.deleteShelf("edge-landing");
    __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })
      .forEach(function (s) { s.picks = []; });
    document.getElementById("vs-library").scrollTop = 0;
    window.__vsEdge = null;
    __vs.setFilters({});
    return { running: running };
  })()`);
  const ok = set.offScreen && lift.lifted === "1" && lift.running && lift.speed > 0 &&
             a > lift.top && b.top > a && b.reached &&
             landed.stoppedOnLeaving && landed.holds.indexOf(landed.wanted) >= 0 &&
             !landed.running && landed.marksLeft === 0 &&
             foot.top === foot.max && stillFoot === foot.max && foot.running &&
             head.speed < 0 && up < head.top && !clean.running;
  return {
    ok,
    detail: `the landing rail began ${set.gap}px below the fold; one dragover in the bottom ` +
            `band at ${lift.speed}px/tick and then a STILL pointer took the room from ` +
            `${lift.top} to ${a} to ${b.top} over ${seen.length - 1} step(s) until the rail ` +
            `was clear of the band (reached: ${b.reached}), the drop landed the ` +
            `book on it (${landed.holds.length} pick(s), ${landed.marksLeft} mark(s) left) and ` +
            `leaving the band stopped the loop (${landed.stoppedOnLeaving}); at the foot it ` +
            `clamped at ${foot.top}/${foot.max} and stayed (${stillFoot}), the top band ran ` +
            `${head.speed}px/tick back to ${up}, and dragend left nothing running ` +
            `(${!clean.running})`
  };
});

/* github#34, design/0024 -- a carried shelf scrolls the same way
 * github#34, design/0024 -- and Escape is the exit path that leaks a loop
 */
check("a carried shelf scrolls the room, and Escape leaves nothing behind", async (p) => {
  const lift = await p.j(`(function(){
    var lib = document.getElementById("vs-library");
    lib.scrollTop = 0;
    var grip = document.querySelector("#vs-shelves .vs-floorgrip");
    var id = grip.getAttribute("data-grip");
    var dt = new DataTransfer();
    grip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    var lb = lib.getBoundingClientRect();
    var x = Math.round(lb.left + lb.width / 2), y = Math.round(lb.bottom - 6);
    var under = document.elementFromPoint(x, y) || lib;
    under.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
      dataTransfer: dt, clientX: x, clientY: y }));
    window.__vsEdge = { dt: dt, from: grip, id: id };
    var e = __vs.edgeScroll();
    return { id: id, running: e.running, speed: Math.round(e.speed * 10) / 10, top: e.top };
  })()`);
  await sleep(300);
  const mid = await p.j(`(function(){
    var e = __vs.edgeScroll();
    return { top: e.top, running: e.running,
             ghosts: document.querySelectorAll("#vs-shelves .vs-shelfghost").length,
             carrying: document.querySelectorAll("#vs-shelves [data-carrying]").length };
  })()`);
  /* github#34 -- ESCAPE. A cancelled drag ends with dragend and no drop. */
  const after = await p.j(`(function(){
    window.__vsEdge.from.dispatchEvent(new DragEvent("dragend",
      { bubbles: true, dataTransfer: window.__vsEdge.dt }));
    var e = __vs.edgeScroll();
    return { top: e.top, running: e.running,
             ghosts: document.querySelectorAll("#vs-shelves .vs-shelfghost").length,
             carrying: document.querySelectorAll("#vs-shelves [data-carrying]").length,
             marks: document.querySelectorAll("#vs-shelves [data-shelfdrop]").length };
  })()`);
  await sleep(250);
  const rest = await p.j(`(function(){
    var e = __vs.edgeScroll();
    var order = __vs.views().map(function (v) { return v.shelf.id; });
    window.__vsEdge = null;
    document.getElementById("vs-library").scrollTop = 0;
    return { top: e.top, running: e.running, first: order[0] };
  })()`);
  const ok = lift.running && lift.speed > 0 && mid.top > lift.top && mid.running &&
             mid.ghosts === 1 && mid.carrying === 1 &&
             !after.running && after.ghosts === 0 && after.carrying === 0 &&
             after.marks === 0 && rest.top === after.top && !rest.running &&
             rest.first === lift.id;
  return {
    ok,
    detail: `carrying "${lift.id}" by its floor at ${lift.speed}px/tick took the room from ` +
            `${lift.top} to ${mid.top} with the pointer still (ghost: ${mid.ghosts}, ` +
            `carrying: ${mid.carrying}); Escape stopped the loop (${!after.running}), left ` +
            `${after.ghosts} ghost, ${after.carrying} carried and ${after.marks} mark(s), the ` +
            `room did not move again (${after.top} -> ${rest.top}) and the shelf order is ` +
            `unchanged (${rest.first} still first)`
  };
});

check("a shelf is deleted on the second press, made at the end the button is at, and carried by its floor",
      async (p) => {
  const r = await p.j(`(function(){
    var shelves = __vs.settings().shelves;
    var savedPicks = shelves.filter(function(s){return s.classifier==='pick';}).map(function(s){return {id:s.id,picks:s.picks.slice()};});
    var order = function () { return __vs.views().map(function (v) { return v.shelf.id; }); };
    var was = order();

    /* 1. the button at the TOP makes a shelf at the top; the one at the foot appends. */
    __vs.newShelf("top");
    document.getElementById("vs-bname").value = "Top shelf";
    document.getElementById("vs-bname").dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("vs-bsave").click();
    var afterTop = order();

    __vs.newShelf("end");
    document.getElementById("vs-bname").value = "Foot shelf";
    document.getElementById("vs-bname").dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("vs-bsave").click();
    var afterEnd = order();

    /* 2. the floor is a handle: every row of every shelf carries one, and the preview does not. */
    var grips = document.querySelectorAll("#vs-shelves .vs-floorgrip[draggable=true]").length;
    var rows = document.querySelectorAll("#vs-shelves .vs-track").length;
    var board = getComputedStyle(document.querySelector("#vs-shelves .vs-track"))
                  .getPropertyValue("background-size");

    /* Carry the top shelf by its floor and drop it on the lower half of the last one. */
    var section = document.querySelector('[data-shelf="top-shelf"]');
    var grip = section.querySelector(".vs-floorgrip");
    var last = document.querySelector('[data-shelf="foot-shelf"]');
    var dt = new DataTransfer();
    grip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    var payload = dt.getData("text/plain");
    var box = last.getBoundingClientRect();
    var at = { bubbles: true, cancelable: true, dataTransfer: dt,
               clientX: box.left + 40, clientY: box.top + box.height - 6 };
    last.dispatchEvent(new DragEvent("dragover", at));
    /* github#0 -- read AFTER a dragover: the shelf leaves the room on the tick after dragstart
     * (hiding it inside dragstart cancels the drag), so the first dragover is the first moment
     * the lift is certain to have happened. */
    var carrying = section.getAttribute("data-carrying");
    var mark = last.getAttribute("data-shelfdrop");
    last.dispatchEvent(new DragEvent("drop", at));
    grip.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    var afterDrag = order();
    var marksLeft = document.querySelectorAll("#vs-shelves [data-shelfdrop], #vs-shelves [data-carrying]").length;

    /* A spine drag is not a shelf drag: dropping a book must leave the shelf order alone. */
    var spine = document.querySelector('[data-shelf="years"] .vs-spine');
    var favWant = new Set(__vs.picks()[0].picks.concat([spine.dataset.book])).size;
    var dt2 = new DataTransfer();
    spine.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt2 }));
    var favRail = document.querySelector('[data-shelf="favourites"] .vs-track');
    var fb = favRail.getBoundingClientRect();
    var at2 = { bubbles: true, cancelable: true, dataTransfer: dt2,
                clientX: fb.left + fb.width / 2, clientY: fb.top + fb.height / 2 };
    favRail.dispatchEvent(new DragEvent("dragover", at2));
    favRail.dispatchEvent(new DragEvent("drop", at2));
    spine.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt2 }));
    var afterBook = order();
    var favHolds = __vs.picks()[0].picks.length;

    /* 3. Delete asks once. The first press arms the row, the second removes the shelf. */
    document.getElementById("vs-manageopen").click();
    var rowOf = function (name) {
      return [].filter.call(document.querySelectorAll("#vs-managelist .vs-managerow"),
        function (r) { return r.querySelector(".vs-name").textContent === name; })[0];
    };
    var del = rowOf("Foot shelf").querySelector(".vs-delete");
    var firstLabel = del.textContent;
    del.click();
    var armedLabel = rowOf("Foot shelf").querySelector(".vs-delete").textContent;
    var armedFlag = rowOf("Foot shelf").querySelector(".vs-delete").getAttribute("data-armed");
    var stillThere = order().indexOf("foot-shelf") >= 0;
    rowOf("Foot shelf").querySelector(".vs-delete").click();
    var afterDelete = order();
    /* Another row's Delete disarms the first: only one row can be asking. */
    rowOf("Top shelf").querySelector(".vs-delete").click();
    var otherArmed = rowOf("Top shelf").querySelector(".vs-delete").getAttribute("data-armed");
    rowOf("Top shelf").querySelector(".vs-delete").click();
    var afterBoth = order();
    document.getElementById("vs-mclose").click();

    /* The wear and the hand-given colour of a deleted shelf's book go with it. */
    var wearKeys = Object.keys(__vs.settings().wear)
      .filter(function (k) { return k.indexOf("top-shelf/") === 0; }).length;

    __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })
      .forEach(function (s) { s.picks = savedPicks.find(function(was){return was.id===s.id;}).picks; });
    __vs.setFilters({});
    return { was: was, afterTop: afterTop, afterEnd: afterEnd, grips: grips, rows: rows,
             board: board, carrying: carrying, payload: payload, mark: mark,
             afterDrag: afterDrag, marksLeft: marksLeft, afterBook: afterBook,
             favHolds: favHolds, favWant: favWant, firstLabel: firstLabel, armedLabel: armedLabel,
             armedFlag: armedFlag, stillThere: stillThere, afterDelete: afterDelete,
             otherArmed: otherArmed, afterBoth: afterBoth, wearKeys: wearKeys,
             back: order() };
  })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ok = r.afterTop[0] === "top-shelf" && same(r.afterTop.slice(1), r.was) &&
             r.afterEnd[r.afterEnd.length - 1] === "foot-shelf" &&
             r.grips === r.rows && r.grips > 0 && r.board.startsWith("100% 14px") &&
             r.carrying === "1" && r.payload === "top-shelf" && r.mark === "after" &&
             r.afterDrag[r.afterDrag.length - 1] === "top-shelf" &&
             r.afterDrag[r.afterDrag.length - 2] === "foot-shelf" && r.marksLeft === 0 &&
             same(r.afterBook, r.afterDrag) && r.favHolds === r.favWant &&
             r.firstLabel === "Delete" && r.armedLabel === "Really delete?" &&
             r.armedFlag === "1" && r.stillThere &&
             r.afterDelete.indexOf("foot-shelf") < 0 && r.otherArmed === "1" &&
             r.afterBoth.indexOf("top-shelf") < 0 && r.wearKeys === 0 &&
             same(r.back, r.was);
  return {
    ok,
    detail: `${r.was.length} shelves: the top button put "top-shelf" first (${r.afterTop[0]}) and ` +
            `the foot button put "foot-shelf" last (${r.afterEnd[r.afterEnd.length - 1]}). ` +
            `${r.grips}/${r.rows} rows carry a floor grip, the board reads ${r.board}; carrying ` +
            `the top shelf onto the lower half of the last drew an "${r.mark}" mark and left the ` +
            `order ${r.afterDrag.slice(-2).join(", ")} with ${r.marksLeft} marks behind. A book ` +
            `dragged onto Favourites left the shelf order alone (${same(r.afterBook, r.afterDrag)}) ` +
            `and landed (${r.favHolds} pick). Delete read "${r.firstLabel}", then ` +
            `"${r.armedLabel}" with the shelf still there (${r.stillThere}), and was gone on the ` +
            `second press; arming another row works too (${r.otherArmed === "1"}), and ${r.wearKeys} ` +
            `wear keys of the deleted shelf survive. Back to ${r.back.length} shelves`
  };
});

check("the room parts where a thing will land, the twelve are offered, and a shelf goes from its own sheet",
      async (p) => {
  await p.eval(`(function(){
    __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })
      .forEach(function (s) { s.picks = []; });
    var years = __vs.views().filter(function (v) { return v.shelf.id === "years"; })[0].books[0].id;
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0].books[0].id;
    __vs.pick(years);
    __vs.pick(people);
    document.getElementById("vs-library").scrollTop = 0;
  })(); void 0`);
  await sleep(300);

  /* 1. A BOOK'S NEIGHBOUR STEPS ASIDE. The gap is a transition, so it is read after it runs. */
  const resting = await p.j(`(function(){
    var s = document.querySelectorAll('[data-shelf="favourites"] .vs-spine');
    window.__part = { from: s[1], target: s[0], dt: new DataTransfer() };
    return Math.round(parseFloat(getComputedStyle(s[0]).marginLeft));
  })()`);
  await p.eval(`(function(){
    var P = window.__part;
    P.from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: P.dt }));
    var b = P.target.getBoundingClientRect();
    P.target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
      dataTransfer: P.dt, clientX: b.left + 3, clientY: b.top + b.height / 2 }));
  })(); void 0`);
  await sleep(320);
  const parted = await p.j(`(function(){
    var P = window.__part;
    P.carriedWidth = Math.round(P.from.getBoundingClientRect().width);
    var bar = P.target.querySelector(".vs-drop");
    var barBox = bar ? bar.getBoundingClientRect() : null;
    var spineBox = P.target.getBoundingClientRect();
    return { margin: Math.round(parseFloat(getComputedStyle(P.target).marginLeft)),
             carried: P.carriedWidth,
             side: P.target.getAttribute("data-drop"),
             barWidth: barBox ? Math.round(barBox.width) : 0,
             inTheGap: barBox ? barBox.right <= spineBox.left + 1 : false };
  })()`);
  await p.eval(`(function(){
    var P = window.__part;
    P.from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: P.dt }));
  })(); void 0`);
  await sleep(320);
  const settled = await p.j(`Math.round(parseFloat(getComputedStyle(window.__part.target).marginLeft))`);

  /* 2. A SHELF MAKES ROOM THE SAME WAY, one axis along. */
  const shelfResting = await p.j(`(function(){
    window.__sp = { section: document.querySelector('[data-shelf="encyclopedia"]'),
                    grip: document.querySelector('[data-shelf="years"] .vs-floorgrip'),
                    dt: new DataTransfer() };
    window.__sp.section.scrollIntoView(true);
    return { margin: Math.round(parseFloat(getComputedStyle(window.__sp.section).marginTop)),
             onScreen: window.__sp.section.getBoundingClientRect().top < window.innerHeight,
             grip: !!window.__sp.grip };
  })()`);
  await p.eval(`(function(){
    var S = window.__sp;
    S.grip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: S.dt }));
    var b = S.section.getBoundingClientRect();
    var over = new DragEvent("dragover", { bubbles: true, cancelable: true,
      dataTransfer: S.dt, clientX: b.left + 40, clientY: b.top + 6 });
    S.section.dispatchEvent(over);
    /* github#0 -- A DRAGOVER NOBODY ACCEPTS MEANS NO DROP AT ALL: the browser only offers a
     * drop where something called preventDefault. A synthetic drop lands either way, which is
     * how a shelf that could never be dropped anywhere still passed every check. */
    S.accepted = over.defaultPrevented;
  })(); void 0`);
  await sleep(320);
  const shelfParted = await p.j(`(function(){
    var S = window.__sp;
    var ghost = document.querySelector("#vs-shelves .vs-shelfghost");
    var carried = document.querySelector("#vs-shelves .vs-shelf[data-carrying]");
    return { accepted: S.accepted === true,
             ghost: !!ghost,
             ghostHeight: ghost ? Math.round(ghost.getBoundingClientRect().height) : 0,
             ghostName: ghost ? ghost.textContent : "",
             above: ghost && S.section
               ? Math.round(ghost.getBoundingClientRect().top) <=
                 Math.round(S.section.getBoundingClientRect().top) + 1 : false,
             hidden: carried ? getComputedStyle(carried).display === "none" : false,
             side: S.section.getAttribute("data-shelfdrop") };
  })()`);
  await p.eval(`(function(){
    var S = window.__sp;
    S.grip.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: S.dt }));
  })(); void 0`);
  await sleep(320);
  const shelfSettled = await p.j(`(function(){
    return { ghosts: document.querySelectorAll("#vs-shelves .vs-shelfghost").length,
             carrying: document.querySelectorAll("#vs-shelves [data-carrying]").length };
  })()`);

  /* 3. THE TWELVE ARE OFFERED, and 4. a shelf goes from the sheet it is edited in. */
  const rest = await p.j(`(function(){
    var out = {};
    document.getElementById("vs-manageopen").click();
    document.querySelector("#vs-mpalette .vs-dyerows .vs-slot .vs-swatch").click();
    var menu = document.getElementById("vs-swatchpick");
    var swatches = menu.querySelectorAll(".vs-swatch");
    out.pick = {
      shown: !menu.hidden, swatches: swatches.length,
      distinct: new Set([].map.call(swatches, function (b) {
        return getComputedStyle(b).backgroundColor; })).size,
      custom: [].some.call(menu.querySelectorAll(".vs-dyeauto"), function (b) {
        return b.textContent.indexOf("Custom") === 0; })
    };
    var seventh = getComputedStyle(swatches[6]).backgroundColor;
    swatches[6].click();
    out.pick.took = getComputedStyle(
      document.querySelector("#vs-mpalette .vs-dyerows .vs-slot .vs-swatch")).backgroundColor === seventh;
    out.pick.saved = __vs.settings().palette.length;
    document.getElementById("vs-mpalettereset").click();
    document.getElementById("vs-mclose").click();

    __vs.newShelf("end");
    document.getElementById("vs-bname").value = "Doomed";
    document.getElementById("vs-bname").dispatchEvent(new Event("input", { bubbles: true }));
    out.binOnNew = !document.getElementById("vs-bdelete").hidden;
    document.getElementById("vs-bsave").click();
    var live = function () { return __vs.views().map(function (v) { return v.shelf.id; }); };
    out.made = live().indexOf("doomed") >= 0;

    __vs.editShelf("doomed");
    var bin = document.getElementById("vs-bdelete");
    out.binOnEdit = !bin.hidden;
    out.first = bin.textContent;
    bin.click();
    out.armed = bin.textContent;
    out.stillThere = live().indexOf("doomed") >= 0;
    bin.click();
    out.gone = live().indexOf("doomed") < 0;
    out.sheetClosed = document.getElementById("vs-builder").hidden;

    /* A ribbon nobody chose is now the BOARD'S OWN HUE, deeper -- not its opposite.
     *
     * MEASURED AS PAINT, NOT AS A VARIABLE, and in the look the page actually opens in. The
     * first version of this read --ribbon off the spine and passed while every ribbon in the
     * leather look was one flat #ad5447: the look painted its own colour over the book's and
     * the custom property never reached the shelf. A check that reads the input to a rule
     * cannot see a rule that ignores its input. */
    /* A ribbon has to be IN a book before it hangs off one, so a few are left here and taken
     * out again -- the same thing the picture-taking path does before it shoots the reader. */
    var marked = [];
    __vs.views().filter(function (v) { return v.shelf.id === "encyclopedia"; })[0].books
      .slice(0, 8).forEach(function (b) {
        if (!b.notes.length) return;
        __vs.openBook(b.id, b.notes[0].id);
        var stub = document.querySelector("#vs-marks .vs-markstub");
        if (stub) { stub.click(); marked.push(b.id); }
      });
    __vs.closeReader();
    out.threads = [].slice.call(document.querySelectorAll("#vs-shelves .vs-spine .vs-ribbon"))
      .slice(0, 24)
      .map(function (r) {
        var spine = r.closest(".vs-spine");
        var want = getComputedStyle(spine).getPropertyValue("--ribbon").trim();
        var probe = document.createElement("span");
        probe.style.color = want;
        document.body.appendChild(probe);
        var asRgb = getComputedStyle(probe).color;
        probe.remove();
        return { dye: getComputedStyle(spine).getPropertyValue("--spine-tint").trim(),
                 thread: getComputedStyle(r).backgroundColor,
                 /* the look has to PAINT the thread the book chose, not one of its own */
                 honoured: getComputedStyle(r).backgroundColor === asRgb };
      }).filter(function (x) { return x.dye && x.thread; });
    out.look = document.getElementById("vs-app").getAttribute("data-look");
    out.ribbonsPainted = out.threads.length;
    out.oneColourForAll = new Set(out.threads.map(function (x) { return x.thread; })).size;

    /* github#0 -- THE GLASS AT THE HEAD OF THE INDEX. */
    /* The fattest book in the library, so the contents page is long enough to scroll away from. */
    var fattest = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (!fattest || b.notes.length > fattest.notes.length) fattest = b;
      });
    });
    __vs.openBook(fattest.id, null);
    var tabs = document.querySelectorAll("#vs-tabs button:not(.vs-findtab):not(.vs-indextoggle)");
    var glass = document.querySelector("#vs-tabs .vs-findtab");
    var left = document.querySelector("#vs-reader .vs-page.vs-left");
    left.scrollTop = 400;
    var scrolledAway = left.scrollTop;
    glass.click();
    out.find = {
      /* the glass heads the WHOLE strip; tabs above is the index entries without it */
      first: (function () {
        var all = document.querySelectorAll("#vs-tabs button");
        return all.length > 1 && all[0].classList.contains("vs-findtab");
      })(),
      indexTabs: tabs.length,
      glyph: glass ? glass.textContent : "",
      named: glass ? glass.getAttribute("aria-label") : "",
      scrolledAway: scrolledAway,
      scrolledBack: left.scrollTop,
      focused: document.activeElement === document.getElementById("vs-within"),
      sameHeight: glass && tabs[1]
        ? Math.round(glass.getBoundingClientRect().height) ===
          Math.round(tabs[1].getBoundingClientRect().height)
        : false
    };
    __vs.closeReader();

    /* the ribbons were for the picture, not for the file */
    marked.forEach(function (id) {
      var book = __vs.views().reduce(function (found, v) {
        return found || v.books.filter(function (b) { return b.id === id; })[0] || null;
      }, null);
      if (!book || !book.notes.length) return;
      __vs.openBook(id, book.notes[0].id);
      var mark = document.querySelector("#vs-marks .vs-mark");
      if (mark) mark.click();
    });
    __vs.closeReader();
    out.ribbonsLeft = document.querySelectorAll("#vs-shelves .vs-spine .vs-ribbon").length;

    __vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })
      .forEach(function (s) { s.picks = []; });
    __vs.setFilters({});
    return out;
  })()`);

  /* The thread keeps the board's hue and leaves its lightness. */
  const hsl = (css) => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css);
    const hex = /^#([0-9a-f]{6})$/i.exec(css);
    let R, G, B;
    if (m) { [R, G, B] = [m[1], m[2], m[3]].map((v) => Number(v) / 255); }
    else if (hex) { [R, G, B] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16) / 255); }
    else return null;
    const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
    let h = 0;
    if (d) h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) / 6 : max === G ? ((B - R) / d + 2) / 6 : ((R - G) / d + 4) / 6;
    return { h, l, sat: d };
  };
  const function_honoured = (t) => t.honoured;
  const pairs = rest.threads.map(({ dye, thread }) => ({ a: hsl(dye), b: hsl(thread) }))
    .filter((x) => x.a && x.b && x.a.sat > 0.08);
  const tonal = pairs.filter((x) => {
    const dh = Math.abs(x.a.h - x.b.h);
    return Math.min(dh, 1 - dh) < 0.08;
  }).length;
  const separated = pairs.filter((x) => Math.abs(x.a.l - x.b.l) > 0.18).length;

  const ok = parted.margin >= parted.carried && parted.side === "before" &&
             parted.barWidth === 3 && parted.inTheGap && settled === resting &&
             shelfParted.accepted && shelfParted.ghost && shelfParted.ghostHeight > 80 &&
             shelfParted.hidden &&
             shelfParted.above &&
             shelfSettled.ghosts === 0 && shelfSettled.carrying === 0 &&
             shelfResting.onScreen && shelfResting.grip &&
             rest.pick.shown && rest.pick.swatches === 14 && rest.pick.distinct >= 10 &&
             rest.pick.custom && rest.pick.took && rest.pick.saved === 14 &&
             rest.made && rest.binOnNew === false && rest.binOnEdit === true &&
             rest.first === "Delete shelf" && rest.armed === "Really delete?" &&
             rest.stillThere && rest.gone && rest.sheetClosed &&
             pairs.length > 0 && tonal === pairs.length && separated === pairs.length &&
             /* the look paints the book's thread rather than one of its own */
             rest.threads.every(function_honoured) &&
             rest.find.first && rest.find.glyph === "\u2315" && rest.find.named &&
             rest.ribbonsPainted >= 4 && rest.ribbonsLeft === 0 &&
             rest.find.scrolledAway > 0 && rest.find.scrolledBack === 0 &&
             rest.find.focused && rest.find.sameHeight;
  return {
    ok,
    detail: `a book's neighbour parts ${resting} -> ${parted.margin}px for a ${parted.carried}px book, ` +
            `with the ${parted.barWidth}px ` +
            `bar standing in the gap (${parted.inTheGap}), and settles back to ${settled}px; a shelf ` +
            `leaves the room while carried (${shelfParted.hidden}), the drag is accepted ` +
            `(${shelfParted.accepted}) and a ${shelfParted.ghostHeight}px ghost ` +
            `named "${shelfParted.ghostName}" stands where it would land (${shelfParted.above}); ` +
            `(on screen: ${shelfResting.onScreen}, grip: ${shelfResting.grip}) and ` +
            `Nothing left behind: ${shelfSettled.ghosts} ghosts, ${shelfSettled.carrying} carried. ` +
            `The colour picker offers ${rest.pick.swatches} ` +
            `swatches, ${rest.pick.distinct} distinct, plus Custom; the seventh took ` +
            `(${rest.pick.took}) and saved ${rest.pick.saved}. Delete shows only when editing ` +
            `(new ${rest.binOnNew}, edit ${rest.binOnEdit}), reads "${rest.first}" then ` +
            `"${rest.armed}" with the shelf still there (${rest.stillThere}), gone on the second ` +
            `(${rest.gone}). Ribbons: ${tonal}/${pairs.length} keep their board's hue and ` +
            `${separated}/${pairs.length} are a fifth of the lightness away from it, painted in ` +
            `${rest.oneColourForAll} different colours under "${rest.look || "modern"}", every one of them ` +
            `the thread the book chose (${rest.threads.every(function_honoured)}). The glass tab heads ` +
            `the index (${rest.find.first}), ` +
            `reads "${rest.find.glyph}" above ${rest.find.indexTabs} index tabs, is the same height as ` +
            `one of them (${rest.find.sameHeight}), ` +
            `and took the left page from ${rest.find.scrolledAway}px back to ` +
            `${rest.find.scrolledBack}px with the cursor in the find box (${rest.find.focused})`
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
    return { newshelf: c.newshelf, spines: c.spines,
             sidebars: document.querySelectorAll("#vs-app aside").length,
             railChildren: document.querySelectorAll("#vs-rail .vs-inner > *").length,
             search: !!document.getElementById("vs-q"),
             /* github#38 -- THE SHELF LIST IS STILL REACHABLE, in the sheet rather than in
              * the rail: one row per shelf, hidden ones included, each a button that goes
              * to it. That is what the jump strip used to be asserted for here. */
             shelves: c.shelves,
             go: (function(){
               document.getElementById("vs-manageopen").click();
               var rows = document.querySelectorAll("#vs-managelist .vs-name[data-go]");
               var n = rows.length;
               var live = 0;
               [].slice.call(rows).forEach(function (b) { if (!b.disabled) live++; });
               document.getElementById("vs-mclose").click();
               return { rows: n, live: live };
             })(),
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
  return { ok: r.sidebars === 0 && r.newshelf === 2 && r.topFirst && r.search &&
               r.go.rows === r.shelves && r.go.live > 0,
           detail: `${r.sidebars} sidebars, ${r.go.rows} of ${r.shelves} shelves reachable ` +
                   `from the Manage sheet (${r.go.live} not hidden), ` +
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
  const ok = same(r.light.slice(0,12), LIGHT) && same(r.dark.slice(0,12), DARK) && r.inSlots;
  return { ok,
           detail: ok
             ? `all twelve match in both themes (light g1 ${r.light[0]}, dark g1 ${r.dark[0]}); ` +
               `a spine's board is dyed ${r.painted}, which is one of the twelve`
             : same(r.light, LIGHT) && same(r.dark, DARK)
               ? `the twelve match, but a spine is tinted "${r.painted}", which is not one of them`
               : `light ${r.light.slice(0, 3).join(",")} dark ${r.dark.slice(0, 3).join(",")}` };
});

/* github#44, github#55 -- what the room is wearing, read the same way in every block */
const ROOM_HELPERS = `
    var shelves = document.getElementById("vs-shelves");
    var read = function (prop) {
      var parts = [], spines = shelves.querySelectorAll(".vs-spine");
      for (var i = 0; i < spines.length; i++) {
        parts.push(getComputedStyle(spines[i]).getPropertyValue(prop).trim());
      }
      return parts.join(",");
    };
    var room = function () { return read("--spine-tint") + "/" + read("--ribbon"); };`;

/* github#44, design/0022 -- a preview paints and nothing else */
check("a hovered swatch paints the room, and leaving puts it back", async (p) => {
  /* github#44 -- boxes are read, so the first packing has to have landed */
  for (let wait = 0; wait < 20; wait++) {
    const up = await p.j(`(function(){
      var one = document.querySelector("#vs-shelves .vs-spine");
      return one ? Math.round(one.getBoundingClientRect().width) : 0;
    })()`);
    if (up > 0) break;
    await sleep(150);
  }
  const r = await p.j(`(function(){
    var out = {};
    var fire = function (el, type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: false, cancelable: true }));
    };
    ${ROOM_HELPERS}
    /* a shelf off screen has content-visibility: auto, so its spines have no box until the
     * browser gets to them -- the packing that can be seen is the packing that is compared */
    var furniture = function () {
      var parts = [], spines = shelves.querySelectorAll(".vs-spine");
      for (var i = 0; i < spines.length; i++) {
        var b = spines[i].getBoundingClientRect();
        parts.push(Math.round(b.left) + ":" + Math.round(b.top) + ":" +
                   Math.round(b.width) + ":" + Math.round(b.height));
      }
      return parts;
    };
    var samePacking = function (was, now) {
      if (was.length !== now.length) return false;
      for (var i = 0; i < was.length; i++) {
        if (was[i] !== "0:0:0:0" && was[i] !== now[i]) return false;
      }
      return true;
    };
    var books = function () {
      return JSON.stringify(__vs.addresses()) + "#" +
             JSON.stringify(__vs.views().map(function (v) { return v.noteCount; }));
    };

    /* github#44 -- driven on a slot the room is actually wearing */
    var worn = {}, spines = shelves.querySelectorAll(".vs-spine");
    for (var i = 0; i < spines.length; i++) {
      var tint = getComputedStyle(spines[i]).getPropertyValue("--spine-tint").trim();
      worn[tint] = (worn[tint] || 0) + 1;
    }
    var slots = __vs.slots(), row = 0, best = -1;
    slots.forEach(function (hex, k) {
      var n = worn[hex] || worn[hex.toLowerCase()] || 0;
      if (n > best) { best = n; row = k; }
    });
    out.wearing = best;
    var away = (row + 6) % 14;

    /* github#44 -- the checks before this leave palettes behind, and this measures a
     * difference, so it starts from none */
    var kept = __vs.settings();
    kept.palette = [];
    kept.ribbons = kept.ribbons.map(function () { return ""; });
    Object.keys(kept.bookColors).forEach(function (k) { delete kept.bookColors[k]; });
    __vs.setFilters({});

    var menu = document.getElementById("vs-swatchpick");
    var slotSwatch = function (column) {
      return document.querySelectorAll("#vs-mpalette .vs-dyerows tr")[row]
               .querySelectorAll("td .vs-slot .vs-swatch")[column];
    };
    var offered = function (n) { return menu.querySelectorAll(".vs-swatches .vs-swatch")[n]; };
    var escape = function () {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    };

    document.getElementById("vs-manageopen").click();

    /* github#44 -- 1. the room follows the pointer, and nothing else does */
    slotSwatch(0).click();
    var before = room(), geometry = furniture(), shelved = books();
    out.laidOut = geometry.filter(function (b) { return b !== "0:0:0:0"; }).length > 0;
    out.opened = !menu.hidden;
    out.openedQuiet = room() === before;
    fire(offered(away), "mouseenter");
    var first = room();
    out.painted = first !== before;
    out.saved = __vs.settings().palette.length;
    out.stillPacked = samePacking(geometry, furniture());
    out.stillShelved = books() === shelved;
    fire(offered((away + 3) % 14), "mouseenter");
    var second = room();
    out.followed = second !== first && second !== before;

    /* github#44 -- 2. Escape puts it back, exactly rather than nearly */
    escape();
    out.escaped = room() === before && menu.hidden;
    out.escapedClean = __vs.settings().palette.length === 0;
    out.packedBack = samePacking(geometry, furniture());

    /* github#44 -- 2b. the pointer leaving is the commonest route out */
    slotSwatch(0).click();
    fire(offered(away), "mouseenter");
    out.paintedForLeave = room() !== before;
    fire(menu, "mouseleave");
    out.leftAlone = room() === before;
    out.stillOpen = !menu.hidden;
    escape();

    /* github#44 -- 3. a click outside is the same route out */
    slotSwatch(0).click();
    fire(offered(away), "mouseenter");
    out.paintedAgain = room() !== before;
    document.querySelector("#vs-manage .vs-sheetbody")
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    out.clickedOff = room() === before && menu.hidden;

    /* github#55 -- step 4 is driven from node, on real keys */
    out.row = row;
    out.away = away;
    out.before = before;
    out.shelved = shelved;
    return out;
  })()`);

  /* github#44, github#55 -- 4. real keys preview, so not mouse-only */
  const keyboard = `(function(){
    var menu = document.getElementById("vs-swatchpick");
    var offered = function (n) { return menu.querySelectorAll(".vs-swatches .vs-swatch")[n]; };
    ${ROOM_HELPERS}
    var at = function () {
      for (var k = 0; k < 14; k++) if (offered(k) === document.activeElement) return k;
      return -1;
    };
    return { menu: menu, offered: offered, room: room, at: at };
  })()`;
  /* github#55 -- one expression, so no state is left behind */
  const inMenu = (expr) => p.j(`(function(){ var h = ${keyboard}; return (${expr}); })()`);
  const before4 = r.before;

  /* github#44 -- the menu holds its focus until the hand moves */
  await p.j(`(function(){
    document.querySelectorAll("#vs-mpalette .vs-dyerows tr")[${r.row}]
      .querySelectorAll("td .vs-slot .vs-swatch")[0].click();
    return true;
  })()`);
  r.menuHolds = await inMenu("document.activeElement === h.menu");
  /* github#55 -- named, so a harness regression says so itself */
  r.windowFocused = await p.j("document.hasFocus()");

  await press(p, "ArrowRight");
  const landed = await inMenu("h.at()");
  r.arrowLanded = landed >= 0;
  const from = Math.max(landed, 0);
  await press(p, "ArrowRight");
  r.arrowMoved = await inMenu(`h.at() === ${(from + 1) % 14}`);
  r.arrowPainted = await inMenu(`h.room() !== ${JSON.stringify(before4)}`);

  /* github#55 -- a swatch reached by Tab, as the comment always claimed */
  const start = [0, 1, 2, 3].find((k) => k !== r.row && k + 1 !== r.row);
  if (start === undefined) throw new Error("no Tab start clear of the slot's own colour");
  for (let step = ((start - from - 1) % 14 + 14) % 14; step > 0; step--) {
    await press(p, "ArrowRight");
  }
  const onStart = await inMenu("h.at()");
  const painted = await inMenu("h.room()");
  await press(p, "Tab");
  r.tabbed = await inMenu(`h.at() === ${start + 1}`);
  r.focused = await inMenu(`h.room() !== ${JSON.stringify(before4)}`);
  r.tabbedOn = await inMenu(`h.room() !== ${JSON.stringify(painted)}`);
  r.tabStart = onStart === start;
  await press(p, "Escape");
  r.keyboardPutBack = await inMenu(`h.room() === ${JSON.stringify(before4)}`);

  const rest = await p.j(`(function(){
    var out = {};
    var fire = function (el, type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: false, cancelable: true }));
    };
    ${ROOM_HELPERS}
    var books = function () {
      return JSON.stringify(__vs.addresses()) + "#" +
             JSON.stringify(__vs.views().map(function (v) { return v.noteCount; }));
    };
    var menu = document.getElementById("vs-swatchpick");
    var offered = function (n) { return menu.querySelectorAll(".vs-swatches .vs-swatch")[n]; };
    var slotSwatch = function (column) {
      return document.querySelectorAll("#vs-mpalette .vs-dyerows tr")[${r.row}]
               .querySelectorAll("td .vs-slot .vs-swatch")[column];
    };
    var escape = function () {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    };
    var before = ${JSON.stringify(r.before)}, shelved = ${JSON.stringify(r.shelved)};
    var away = ${r.away};

    /* github#44 -- 5. the ribbon column paints ribbons, never boards */
    var boards = read("--spine-tint");
    slotSwatch(1).click();
    fire(offered(away), "mouseenter");
    out.threadOnly = room() !== before && read("--spine-tint") === boards;
    escape();
    out.threadPutBack = room() === before;

    /* github#44 -- 6. it goes back to what it opened on, not the look's own */
    slotSwatch(0).click();
    offered(away).click();
    var committed = room();
    out.committed = committed !== before && __vs.settings().palette.length === 14;
    slotSwatch(0).click();
    fire(offered((away + 3) % 14), "mouseenter");
    out.previewedOverCommitted = room() !== committed;
    escape();
    out.backToCommitted = room() === committed;

    /* github#44, decisions/0013 -- 7. nothing is left open or in flight */
    document.getElementById("vs-mpalettereset").click();
    out.reset = room() === before;
    out.finalShelved = books() === shelved;
    document.getElementById("vs-mclose").click();
    out.shut = menu.hidden && document.getElementById("vs-manage").hidden;
    return out;
  })()`);
  Object.assign(r, rest);
  const want = ["laidOut", "opened", "openedQuiet", "painted", "stillPacked", "stillShelved",
                "followed", "escaped", "escapedClean", "packedBack", "paintedForLeave",
                "leftAlone", "stillOpen", "paintedAgain", "clickedOff", "menuHolds",
                "windowFocused", "arrowLanded", "focused", "arrowMoved",
                "arrowPainted", "tabStart", "tabbed", "tabbedOn", "keyboardPutBack", "threadOnly", "threadPutBack", "committed",
                "previewedOverCommitted", "backToCommitted", "reset", "shut", "finalShelved"];
  const bad = want.filter((k) => r[k] !== true);
  const ok = !bad.length && r.saved === 0 && r.wearing > 0;
  return { ok,
           detail: ok
             ? `the pointer, real arrow and Tab keys, Escape and a click outside all paint ` +
               `${r.wearing} spines and put back exactly what was there; nothing was saved, ` +
               "the ribbon column paints only ribbons, and no box, address or count moved"
             : bad.length
               ? `${bad.join(", ")} -- not what a preview does`
               : r.wearing > 0
                 ? `a hover wrote ${r.saved} colours to settings; a preview saves nothing`
                 : "no spine wears any of the twelve, so nothing was measured" };
});

/* github#44, design/0022 -- the same preview where a hand gives a colour */
check("a right-click dyes a book, a plate's run or a shelf, and hovering paints it first", async (p) => {
  /* github#44 -- boxes are read, so the first packing has to have landed */
  for (let wait = 0; wait < 20; wait++) {
    const up = await p.j(`(function(){
      var one = document.querySelector("#vs-shelves .vs-spine");
      return one ? Math.round(one.getBoundingClientRect().width) : 0;
    })()`);
    if (up > 0) break;
    await sleep(150);
  }
  const r = await p.j(`(function(){
    var out = {};
    var shelves = document.getElementById("vs-shelves");
    var dye = document.getElementById("vs-dye");
    var rail = document.getElementById("vs-railmenu");
    var fire = function (el, type, x, y) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                                              clientX: x || 200, clientY: y || 200 }));
    };
    var enter = function (el) {
      el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
    };
    var escape = function () {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    };
    var read = function (sel, prop) {
      var parts = [], all = shelves.querySelectorAll(sel);
      for (var i = 0; i < all.length; i++) {
        parts.push(getComputedStyle(all[i]).getPropertyValue(prop).trim());
      }
      return parts.join(",");
    };
    var boards = function () { return read(".vs-spine", "--spine-tint"); };
    var threads = function () { return read(".vs-spine", "--ribbon"); };
    var furniture = function () {
      var parts = [], all = shelves.querySelectorAll(".vs-spine");
      for (var i = 0; i < all.length; i++) {
        var b = all[i].getBoundingClientRect();
        parts.push(Math.round(b.left) + ":" + Math.round(b.top) + ":" +
                   Math.round(b.width) + ":" + Math.round(b.height));
      }
      return parts;
    };
    var samePacking = function (was, now) {
      if (was.length !== now.length) return false;
      for (var i = 0; i < was.length; i++) {
        if (was[i] !== "0:0:0:0" && was[i] !== now[i]) return false;
      }
      return true;
    };
    var tinted = function (ids) {
      return ids.map(function (id) {
        var sp = shelves.querySelector('[data-book="' + CSS.escape(id) + '"]');
        return sp ? getComputedStyle(sp).getPropertyValue("--spine-tint").trim() : "?";
      }).join(",");
    };
    var swatches = function (menu) { return menu.querySelectorAll(".vs-swatches .vs-swatch"); };

    /* github#44 -- the same: a hand-given colour left by an earlier check is not this one's */
    var kept = __vs.settings();
    kept.palette = [];
    kept.ribbons = kept.ribbons.map(function () { return ""; });
    Object.keys(kept.bookColors).forEach(function (k) { delete kept.bookColors[k]; });
    __vs.setFilters({});
    var given = function () { return Object.keys(__vs.settings().bookColors).length; };

    var before = boards() + "/" + threads();
    var geometry = furniture();
    out.laidOut = geometry.filter(function (b) { return b !== "0:0:0:0"; }).length > 0;
    out.clean = given() === 0;

    /* github#44 -- 1. one spine: the twelve, hovered, then put back */
    var spine = shelves.querySelector(".vs-spine[data-book]");
    var one = spine.getAttribute("data-book");
    fire(spine, "contextmenu");
    out.spineMenu = !dye.hidden && swatches(dye).length === 14;
    out.spineQuiet = boards() + "/" + threads() === before;
    enter(swatches(dye)[7]);
    out.spinePainted = boards() !== before.split("/")[0] && tinted([one]) !== "?";
    out.spineSaved = given();
    out.spinePacked = samePacking(geometry, furniture());
    escape();
    out.spineBack = boards() + "/" + threads() === before && dye.hidden;

    /* github#44 -- 2. a plate dyes its whole run, and only its run */
    var plate = shelves.querySelector(".vs-plaque");
    out.hasPlate = !!plate;
    if (plate) {
      var run = [].map.call(plate.parentElement.querySelectorAll(".vs-spine[data-book]"),
                            function (s) { return s.getAttribute("data-book"); });
      out.runSize = run.length;
      fire(plate, "contextmenu");
      out.plateMenu = !dye.hidden && swatches(dye).length === 14 &&
                      dye.querySelector(".vs-dyename").textContent === plate.textContent;
      out.plateNoLines = dye.querySelectorAll(".vs-dyepick").length === 0;
      out.plateQuiet = boards() + "/" + threads() === before;
      enter(swatches(dye)[4]);
      var painted = tinted(run).split(",");
      out.plateWholeRun = painted.length === run.length &&
                          painted.every(function (c) { return c === painted[0]; }) &&
                          painted[0] !== "";
      out.plateSaved = given();
      out.platePacked = samePacking(geometry, furniture());
      /* github#44 -- the thread follows the board it is sewn into */
      out.plateThreads = threads() !== before.split("/")[1];
      escape();
      out.plateBack = boards() + "/" + threads() === before;
    }

    /* github#44 -- 3. the shelf head dyes every book on the shelf */
    /* the first shelf that HOLDS something: Favourites stands at position 0 and is empty
     * until somebody drops a book on it, and dyeing nothing proves nothing */
    var section = null;
    var sections = shelves.querySelectorAll(".vs-shelf");
    for (var si = 0; si < sections.length && !section; si++) {
      if (sections[si].querySelector(".vs-shelfhead") &&
          sections[si].querySelectorAll(".vs-spine[data-book]").length) section = sections[si];
    }
    var head = section.querySelector(".vs-shelfhead");
    var mine = [].map.call(section.querySelectorAll(".vs-spine[data-book]"),
                           function (s) { return s.getAttribute("data-book"); });
    out.shelfSize = mine.length;
    fire(head, "contextmenu");
    out.shelfMenu = !rail.hidden && swatches(rail).length === 14 &&
      !!rail.querySelector(".vs-railline") === (__vs.settings().shelves.find(function(s){return s.id===section.dataset.shelf;}).direction==='manual');
    out.shelfQuiet = boards() + "/" + threads() === before;
    enter(swatches(rail)[10]);
    var shelfPainted = tinted(mine).split(",");
    out.shelfWhole = shelfPainted.length === mine.length &&
                     shelfPainted.every(function (c) { return c === shelfPainted[0]; }) &&
                     shelfPainted[0] !== "";
    out.shelfSaved = given();
    out.shelfPacked = samePacking(geometry, furniture());
    escape();
    out.shelfBack = boards() + "/" + threads() === before && rail.hidden;
    var grip = section.querySelector('.vs-floorgrip');
    fire(grip, 'contextmenu');
    out.floorMenu = !rail.hidden && swatches(rail).length === 14 &&
      rail.querySelectorAll('.vs-bindingchoice').length === 6 && getComputedStyle(grip).height === '22px';
    escape();

    /* github#44 -- 4. a click commits what a hover only offered */
    fire(head, "contextmenu");
    swatches(rail)[10].click();
    out.committed = boards() !== before.split("/")[0] && given() === mine.length;
    out.committedSame = tinted(mine) === shelfPainted.join(",");
    out.railShut = rail.hidden;
    /* and a preview over a commit goes back to the commit, not to automatic */
    var committed = boards() + "/" + threads();
    fire(head, "contextmenu");
    enter(swatches(rail)[2]);
    out.overCommitted = boards() + "/" + threads() !== committed;
    escape();
    out.backToCommitted = boards() + "/" + threads() === committed;

    /* github#44 -- 5. Automatic takes it all off again */
    fire(head, "contextmenu");
    rail.querySelector(".vs-dyeauto").click();
    out.automatic = boards() + "/" + threads() === before && given() === 0;
    out.shut = dye.hidden && rail.hidden;
    return out;
  })()`);
  const want = ["laidOut", "clean", "spineMenu", "spineQuiet", "spinePainted", "spinePacked",
                "spineBack", "hasPlate", "plateMenu", "plateNoLines", "plateQuiet",
                "plateWholeRun", "platePacked", "plateThreads", "plateBack", "shelfMenu",
                "shelfQuiet", "shelfWhole", "shelfPacked", "shelfBack", "floorMenu", "committed",
                "committedSame", "railShut", "overCommitted", "backToCommitted", "automatic",
                "shut"];
  const bad = want.filter((k) => r[k] !== true);
  const wrote = r.spineSaved === 0 && r.plateSaved === 0 && r.shelfSaved === 0;
  const ok = !bad.length && wrote;
  return { ok,
           detail: ok
             ? `a spine, a plate over ${r.runSize} books and a shelf of ${r.shelfSize} each ` +
               "offer fourteen colours and six bindings, including from the 22px floor grip; a hover paints the whole unit and its threads and saves " +
               "nothing, a click saves one key per book, Automatic takes them all off, and no " +
               "box moved at any point"
             : bad.length
               ? `${bad.join(", ")} -- not what a hand-given colour does`
               : `a hover wrote ${r.spineSaved}/${r.plateSaved}/${r.shelfSaved} keys; ` +
                 "a preview saves nothing" };
});

/* github#29, design/0022 -- a plate dyes its run, from either copy */
check("a plate dyes its whole run from either copy, and the colours survive a rebuild", async (p) => {
  /* github#44 -- boxes are read, so the first packing has to have landed */
  for (let wait = 0; wait < 20; wait++) {
    const up = await p.j(`(function(){
      var one = document.querySelector("#vs-shelves .vs-spine");
      return one ? Math.round(one.getBoundingClientRect().width) : 0;
    })()`);
    if (up > 0) break;
    await sleep(150);
  }

  /* github#29, design/0022 -- a run drawn twice, found not assumed */
  const find = `(function(){
    var core = window.VaultShelfCore;
    var best = null, longest = null;
    __vs.views().forEach(function (v) {
      if (v.shelf.hidden || v.shelf.direction === "manual") return;
      var drawn = {};
      [].slice.call(document.querySelectorAll('[data-shelf="' + v.shelf.id + '"] .vs-plaque'))
        .forEach(function (b) { drawn[b.textContent] = (drawn[b.textContent] || 0) + 1; });
      core.runsOf(v.books).forEach(function (run) {
        if (run.plaque === null || run.books.length < 2) return;
        var one = { shelf: v.shelf.id, label: run.plaque, size: run.books.length,
                    plates: drawn[run.plaque] || 0 };
        if (!longest || one.size > longest.size) longest = one;
        if (one.plates > 1 && (!best || one.size > best.size)) best = one;
      });
    });
    return best || longest;
  })()`;

  const wasView = await p.j("({width:innerWidth,height:innerHeight})");
  let run = null, width = 0;
  for (const w of [1280, 1000, 860, 820]) {
    /* github#29, github#57 -- counted only once the repack has happened */
    await viewport(p, w, 1000);
    run = await p.j(find);
    width = w;
    if (run && run.plates > 1) break;
  }
  if (!run) {
    await unviewport(p, wasView);
    return { ok: false, detail: "no run of two books under a plaque in this library" };
  }
  if (run.plates < 2) {
    await unviewport(p, wasView);
    return { ok: false,
             detail: `the longest run (${run.shelf} "${run.label}", ${run.size} books) still ` +
                     `fits one row at ${width}px, so no second plate could be right-clicked` };
  }

  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var out = { shelf: ${JSON.stringify(run.shelf)}, label: ${JSON.stringify(run.label)} };
    var shelves = document.getElementById("vs-shelves");
    var dye = document.getElementById("vs-dye");
    var fire = function (el, type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                                              clientX: 200, clientY: 200 }));
    };
    var tint = function (id) {
      var sp = shelves.querySelector('[data-book="' + CSS.escape(id) + '"]');
      return sp ? getComputedStyle(sp).getPropertyValue("--spine-tint").trim() : "?";
    };
    var given = function () { return Object.keys(__vs.settings().bookColors).length; };
    var plates = function () {
      return [].slice.call(shelves.querySelectorAll('[data-shelf="' + out.shelf + '"] .vs-plaque'))
        .filter(function (b) { return b.textContent === out.label; });
    };
    var rowOf = function (plate) {
      return [].map.call(plate.parentElement.querySelectorAll(".vs-spine[data-book]"),
                         function (s) { return s.getAttribute("data-book"); });
    };

    /* github#44 -- a hand-given colour left by an earlier check is not this one's */
    var kept = __vs.settings();
    kept.palette = [];
    kept.ribbons = kept.ribbons.map(function () { return ""; });
    Object.keys(kept.bookColors).forEach(function (k) { delete kept.bookColors[k]; });
    __vs.setFilters({});
    out.clean = given() === 0;

    var view = __vs.views().filter(function (v) { return v.shelf.id === out.shelf; })[0];
    var theRun = core.runsOf(view.books).filter(function (x) { return x.plaque === out.label; })[0];
    var ids = theRun.books.map(function (b) { return b.id; });
    out.runSize = ids.length;
    /* every book the shelf holds that this plate does NOT name */
    var outside = view.books.map(function (b) { return b.id; })
      .filter(function (id) { return ids.indexOf(id) < 0; });
    out.outside = outside.length;

    /* design/0019 -- a favourite wears its source's colour, so one stands in the run */
    var fav = __vs.picks()[0];
    out.hasPick = !!fav;
    var favId = "";
    if (fav) {
      /* design/0019 -- a pick's key IS the source's address, so its own is one segment longer */
      __vs.pick(ids[0], null, fav.id);
      favId = core.bookId(fav.id, ids[0]);
      out.favDrawn = tint(favId) !== "?";
    }
    var wasTint = ids.map(tint);

    var two = plates();
    out.plates = two.length;
    var first = rowOf(two[0]), last = rowOf(two[two.length - 1]);
    out.firstRow = first.length;
    out.lastRow = last.length;
    out.split = first.length < ids.length && last.length < ids.length;

    /* 1. the SECOND copy of the plate, which is the whole point */
    fire(two[two.length - 1], "contextmenu");
    out.menu = !dye.hidden && dye.querySelectorAll(".vs-swatches .vs-swatch").length === 14;
    out.name = dye.querySelector(".vs-dyename").textContent;
    var unit = dye.querySelector(".vs-dyeunit");
    out.unit = unit ? unit.textContent : "";
    /* github#44 -- the lines below the twelve are one book's, and a run is not one book */
    out.noLines = dye.querySelectorAll(".vs-dyepick").length === 0;
    dye.querySelectorAll(".vs-swatches .vs-swatch")[7].click();
    out.shut = dye.hidden;

    var wore = ids.map(tint);
    out.wholeRun = wore.every(function (c) { return c === wore[0] && c !== "" && c !== "?"; });
    var colours = __vs.settings().bookColors;
    out.allSeven = ids.every(function (id) { return colours[id] === 7; });
    out.entries = given();
    out.outsideClean = outside.every(function (id) { return colours[id] === undefined; });
    /* the books on the row the plate was NOT on are dyed too: the row is not the unit */
    out.otherRowDyed = first.every(function (id) { return colours[id] === 7; });
    if (fav) {
      out.favFollows = tint(favId) === wore[0];
      /* design/0019 -- a reference, never a copy: the colour was written against the source */
      out.favNoKey = colours[favId] === undefined;
    }

    /* 2. a rebuild, and the settings round-tripped through migrate */
    __vs.setFilters({});
    out.afterRebuild = ids.map(tint).join(",") === wore.join(",");
    var migrated = core.migrate(JSON.parse(JSON.stringify(__vs.settings())));
    out.afterMigrate = ids.filter(function (id) { return migrated.bookColors[id] === 7; }).length;

    /* 3. one gesture back: Automatic on the FIRST copy takes off what the second put on */
    fire(plates()[0], "contextmenu");
    dye.querySelector(".vs-dyeauto").click();
    out.undone = given() === 0;
    /* back to exactly the room that was there, not merely to something else */
    out.undoneRoom = ids.map(tint).join(",") === wasTint.join(",");
    if (fav) __vs.unpick(ids[0], fav.id);
    __vs.setFilters({});
    out.leftClean = given() === 0;
    return out;
  })()`);

  await unviewport(p, wasView);

  const want = ["clean", "split", "menu", "noLines", "shut", "wholeRun", "allSeven",
                "outsideClean", "otherRowDyed", "afterRebuild", "undone", "undoneRoom",
                "leftClean"];
  if (r.hasPick) want.push("favDrawn", "favFollows", "favNoKey");
  const bad = want.filter((k) => r[k] !== true);
  const named = r.name === run.label && r.unit === `${r.runSize} books under this plate`;
  const kept = r.entries === r.runSize && r.afterMigrate === r.runSize;
  const ok = !bad.length && named && kept;
  return { ok,
           detail: ok
             ? `${r.shelf} plate "${r.label}" is drawn ${r.plates} times at ${width}px over a ` +
               `run of ${r.runSize} books (${r.firstRow} on one row, ${r.lastRow} on the other); ` +
               `right-clicking the second copy says "${r.name} / ${r.unit}" and dyes all ` +
               `${r.runSize}, writing ${r.entries} bookColors keys and leaving the shelf's ` +
               `other ${r.outside} books alone; ${r.afterMigrate} survive a rebuild and a ` +
               `migrate round-trip, the favourite pointing into the run follows without a key ` +
               `of its own, and Automatic on the first copy takes all ${r.runSize} off again`
             : bad.length
               ? `${bad.join(", ")} -- not what a plate names`
               : !named
                 ? `the menu said "${r.name}" / "${r.unit}", not "${run.label}" over ` +
                   `${r.runSize} books`
                 : `a run of ${r.runSize} wrote ${r.entries} keys and ${r.afterMigrate} ` +
                   "survived a migrate" };
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
  const ok = r.offered.length === 1 && r.offered[0] === "leather" && offersRight && named &&
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
      ["#vs-q", true], ["#vs-look", false], ["#vs-manageopen", false],
      ["#vs-rail", true], ["#vs-newshelf", true],
      ["#vs-shelves .vs-shelfhead", true], ["#vs-shelves .vs-plaque", false],
      ["#vs-shelves .vs-spine", true]
    ];
    var reading = [
      [".vs-readerbar", true], ["#vs-back", false], ["#vs-prevcollection", false],
      ["#vs-prevnote", false], ["#vs-nextnote", false], ["#vs-within", true],
      ["#vs-tabs button", false], ["#vs-contents button", true], ["#vs-marks", true],
      ["#vs-marks .vs-mark", false], ["#vs-marks .vs-markstub", true], [".vs-spread", true],
      /* github#36 -- the turn is furniture too, in every look */
      [".vs-turn", true], ["#vs-place", false],
      [".vs-alsoin button", false]
    ];
    var managing = [
      /* github#38 -- the row's NAME is a button now, and not an action one: the action
       * buttons are what this line has always measured, so it says so. */
      ["#vs-managelist .vs-managerow", true], ["#vs-managelist .vs-name", false],
      ["#vs-managelist .vs-managerow button:not(.vs-name)", false],
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
  await sleep(150);
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

/* github#14, github#16, design/0021 -- A LOOK MOVES NOTHING ON THE PAGE.
 * design/0021 -- every element, in four states, not 38 named ones
 * design/0021 -- a top, and a box across its text, are page.css's
 * design/0021 -- width along the text is the face's
 * design/0021 -- it stops at a page: what is on it is the vault's
 */
check("a look moves nothing on the page", async (p) => {
  const r = await p.j(`(function(){
    var root = document.getElementById("vs-app");
    var core = window.VaultShelfCore;
    var looks = core.LOOKS.map(function (l) { return l.value; });
    var book = __vs.views().filter(function (v) { return v.books.length; })[0].books[0];
    var skipped = 0;
    /* design/0021 -- a path, not a selector: it names what nothing else names. */
    var pathOf = function (el) {
      var bits = [];
      for (var n = el; n && n !== root; n = n.parentElement) {
        var up = n.parentElement;
        var cls = (n.getAttribute("class") || "").split(/\\s+/).filter(Boolean).slice(0, 2).join(".");
        bits.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (cls ? "." + cls : "") +
                     "[" + (up ? [].indexOf.call(up.children, n) : 0) + "]");
      }
      return bits.join(">");
    };
    var walk = function (state, out) {
      var box = root.getBoundingClientRect();
      var all = root.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.closest("[hidden]")) continue;
        if (el.parentElement && el.parentElement.closest(".vs-page")) { skipped++; continue; }
        var b = el.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        var cs = getComputedStyle(el);
        out[state + " " + pathOf(el)] = {
          y: Math.round((b.top - box.top) * 10) / 10,
          /* design/0021 -- across the text is fixed; along it is the face's. */
          across: Math.round((cs.writingMode.indexOf("vertical") === 0 ? b.width : b.height) * 10) / 10,
          vertical: cs.writingMode.indexOf("vertical") === 0
        };
      }
    };
    /* design/0021 -- a sheet and a spread are furniture too. */
    var readAll = function () {
      var out = {};
      walk("library", out);
      __vs.openBook(book.id, null);
      walk("reading", out);
      __vs.closeReader();
      document.getElementById("vs-manageopen").click();
      walk("managing", out);
      document.getElementById("vs-mclose").click();
      document.getElementById("vs-newshelf").click();
      walk("building", out);
      document.getElementById("vs-bcancel").click();
      return out;
    };
    var out = {};
    /* the look the page was FOUND in is the look it is left in: the checks in a lane share
     * one page, and a --look run has already chosen one. */
    var was = root.getAttribute("data-look") || "";
    looks.forEach(function (look) { __vs.setLook(look); out[look || "modern"] = readAll(); });
    __vs.setLook(was);
    return { looks: out, skipped: skipped };
  })()`);

  const base = r.looks.modern;
  const keys = Object.keys(base);
  const others = Object.keys(r.looks).filter((l) => l !== "modern");
  const moved = [], resized = [], absent = [];
  for (const look of others) {
    const got = r.looks[look];
    for (const k of keys) {
      const a = base[k], b = got[k];
      if (!b) { absent.push(`${look} ${k}: not on the page`); continue; }
      if (Math.abs(a.y - b.y) > 1) moved.push(`${look} ${k}: y ${a.y} -> ${b.y}`);
      if (Math.abs(a.across - b.across) > 1) {
        resized.push(`${look} ${k}: ${a.across} -> ${b.across} ${a.vertical ? "wide" : "high"}`);
      }
    }
    for (const k of Object.keys(got)) if (!base[k]) absent.push(`${look} ${k}: not in modern`);
  }
  const upright = keys.filter((k) => base[k].vertical).length;
  const say = (label, list) => (list.length ? `; ${list.length} ${label}: ${list.slice(0, 3).join("; ")}` : "");
  return {
    ok: !moved.length && !resized.length && !absent.length && keys.length > 600,
    detail: `${keys.length} elements in four states (${upright} of them upright type; ` +
            `${r.skipped} nodes set on a page of the open book skipped) ` +
            `compared across ${others.length + 1} looks against modern: ${moved.length} moved, ` +
            `${resized.length} resized, ${absent.length} present in one look and not another` +
            say("moved", moved) + say("resized", resized) + say("missing", absent)
  };
});

/* github#45, design/0021 -- a title never touches a line the binding draws */
/** design/0029 */
check("leather bindings preview beside colours with consistent heights and saved choices", async (p) => {
  const r = await p.j(`(function(){
    __vs.setLook('leather');
    var settings = __vs.settings(), saved = JSON.stringify(settings.bookSpines);
    var addresses = JSON.stringify(__vs.addresses());
    var spine = document.querySelector('#vs-shelves [data-shelf="months"] .vs-spine');
    var id = spine.dataset.book, before = spine.dataset.binding;
    var savedColours = JSON.stringify(settings.bookColors);
    settings.bookColors[id] = 0;
    var box = spine.getBoundingClientRect();
    var open = function () {
      spine.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
    };
    var close = function () { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); };
    open();
    var menu = document.getElementById('vs-dye');
    var choices = Array.from(menu.querySelectorAll('.vs-bindingchoice'));
    var colours = menu.querySelectorAll('.vs-swatch').length;
    var states = choices.map(function (choice) {
      choice.dispatchEvent(new MouseEvent('mouseenter'));
      var title = spine.querySelector('.vs-title').getBoundingClientRect();
      var b = spine.getBoundingClientRect(), cs = getComputedStyle(spine);
      var frame = getComputedStyle(spine, '::after');
      var top = b.top + parseFloat(cs.borderTopWidth) + parseFloat(frame.top) + parseFloat(frame.borderTopWidth);
      var bottom = b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(frame.bottom) - parseFloat(frame.borderBottomWidth);
      return { style:spine.dataset.binding, h:b.height, w:b.width,
        gap:Math.min(title.top-top,bottom-title.bottom),
        paint:cs.backgroundImage+'|'+cs.backgroundColor,
        ink:getComputedStyle(spine.querySelector('.vs-title')).color };
    });
    var untouched = saved === JSON.stringify(settings.bookSpines);
    close();
    var reverted = spine.dataset.binding === before;
    open();
    menu.querySelector('[data-style="pebbled"]').click();
    var persisted = VaultShelfCore.migrate(JSON.parse(JSON.stringify(settings))).bookSpines[id] === 'pebbled';
    var closed = menu.hidden;
    __vs.setFilters({});
    spine = Array.from(document.querySelectorAll('#vs-shelves .vs-spine')).find(function(b){return b.dataset.book===id;});
    var rebuilt = spine.dataset.binding === 'pebbled';
    open();
    menu.querySelector('[data-style="auto"]').click();
    var reset = settings.bookSpines[id] === undefined && spine.dataset.binding === before;
    open();
    menu.querySelector('[data-style="vellum"]').click();
    open();
    var vellumPaints = Array.from(menu.querySelectorAll('.vs-swatch')).map(function(swatch){
      swatch.dispatchEvent(new MouseEvent('mouseenter'));
      return getComputedStyle(spine).backgroundColor;
    });
    menu.querySelectorAll('.vs-swatch')[13].click();
    var brightSaved = VaultShelfCore.migrate(JSON.parse(JSON.stringify(settings))).bookColors[id] === 13;
    settings.bookSpines = JSON.parse(saved);
    settings.bookColors = JSON.parse(savedColours);
    __vs.setFilters({});
    var census = {};
    Array.from(document.querySelectorAll('#vs-shelves .vs-spine')).forEach(function(book){
      (census[book.dataset.binding] || (census[book.dataset.binding] = new Set())).add(getComputedStyle(book).height);
    });
    return { styles:choices.length,colours:colours, paints:new Set(states.map(function(s){return s.paint;})).size,
      vellumDyes:new Set(vellumPaints).size, brightSaved:brightSaved,
      sameTypeSameHeight:Object.values(census).every(function(heights){return heights.size===1;}),
      inks:new Set(states.map(function(s){return s.ink;})).size,minGap:Math.min.apply(Math,states.map(function(s){return s.gap;})),
      fixed:states.every(function(s){return s.w===box.width;}), heights:states.map(function(s){return s.h;}),
      untouched:untouched,reverted:reverted,persisted:persisted,closed:closed,rebuilt:rebuilt,reset:reset,
      addresses:addresses===JSON.stringify(__vs.addresses()) };
  })()`);
  return { ok: r.styles === 6 && r.colours === 14 && r.paints === 5 && r.inks === 5 && r.minGap >= 2.9 &&
      r.vellumDyes === 14 && r.brightSaved && r.sameTypeSameHeight &&
      r.fixed && JSON.stringify(r.heights) === JSON.stringify([132,131,130,128,126,124]) && r.untouched && r.reverted && r.persisted && r.closed && r.rebuilt && r.reset && r.addresses,
    detail: JSON.stringify(r) };
});

/** design/0029 */
check("Automatic keeps the scrolled shelf in place for colours and bindings", async (p) => {
  const r = await p.eval(`(async function(){
    var settings=__vs.settings(), savedColours=JSON.stringify(settings.bookColors), savedSpines=JSON.stringify(settings.bookSpines);
    var lib=document.getElementById('vs-library'), results=[];
    var wait=function(){return new Promise(function(resolve){setTimeout(resolve,80);});};
    var close=function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));};
    try {
      for (var target of ['.vs-spine','.vs-floorgrip']) {
        for (var control of ['.vs-swatch','.vs-bindingchoice']) {
          var section=document.querySelector('#vs-shelves [data-shelf="tags"]');
          section.scrollIntoView({block:'start'}); await wait();
          section.scrollIntoView({block:'start'}); await wait();
          var anchor=section.querySelector('.vs-spine'), initialTop=lib.scrollTop;
          for (var reset of [false,true]) {
            section=document.querySelector('#vs-shelves [data-shelf="tags"]');
            var node=section.querySelector(target), rect=node.getBoundingClientRect();
            node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:rect.left+10,clientY:Math.max(110,rect.top)}));
            var menu=document.getElementById(target==='.vs-spine'?'vs-dye':'vs-railmenu');
            var btn=menu.querySelector(reset?(control==='.vs-swatch'?'.vs-dyeauto':'[data-style="auto"]'):control);
            btn.dispatchEvent(new MouseEvent('mouseenter')); btn.focus({preventScroll:true}); btn.click();
            await wait();
            results.push({target:target,control:control,reset:reset,before:initialTop,after:lib.scrollTop,sameBook:anchor.isConnected});
          }
        }
      }
    } finally {
      close(); settings.bookColors=JSON.parse(savedColours); settings.bookSpines=JSON.parse(savedSpines);
      __vs.setFilters({}); lib.scrollTop=0;
    }
    return results;
  })()`);
  return {ok:r.length===8 && r.every((x)=>x.before>100 && Math.abs(x.before-x.after)<1 && x.sameBook),detail:JSON.stringify(r)};
});

/** design/0029 */
check("fresh leather defaults and automatic demo settings are deterministic", async (p) => {
  const r = await p.j(`(function(){
    var core = VaultShelfCore, fresh = core.emptySettings(), data = __vs.data();
    var one = core.demoSettings(data.notes), again = core.demoSettings(data.notes);
    var grouped = true, periods = 0;
    fresh.shelves.filter(function(s){return s.classifier==='year'||s.classifier==='month';}).forEach(function(shelf){
      var units = {};
      core.buildShelf(shelf,data.notes).books.forEach(function(book){
        var key = core.bindingUnit(shelf,book.key), style = core.automaticSpine(shelf,book.key)+'/'+core.dyePeriod(shelf,book.key);
        if (units[key] && units[key] !== style) grouped = false;
        units[key] = style;
      });
      periods += Object.keys(units).length;
    });
    var identities = fresh.shelves.filter(function(s){return s.classifier==='person'||s.classifier==='tag';})
      .map(function(s){return new Set(core.buildShelf(s,data.notes).books.map(function(b){return core.automaticSpine(s,b.key);})).size;});
    var old = core.migrate({schema:10,shelves:[{id:'weeks',name:'Weeks',source:{kind:'all'},classifier:'week',
      direction:'chronological',hidden:false,position:0,plaques:true}],look:'',bookSpines:{good:'original',bad:'nope'}});
    var storage = core.migrate(JSON.parse(JSON.stringify(one)));
    return {fresh: fresh.shelves.map(function(s){return s.id;}), look:fresh.look,offered:core.offeredLooks().map(function(l){return l.value;}),
      overrides:{colours:Object.keys(one.bookColors).length,bindings:Object.keys(one.bookSpines).length},
      deterministic:JSON.stringify(one)===JSON.stringify(again),grouped:grouped,periods:periods,identities:identities,
      persists:JSON.stringify(one.bookSpines)===JSON.stringify(storage.bookSpines),
      legacy:old.shelves.some(function(s){return s.id==='weeks'&&!s.hidden;})&&old.bookSpines.good==='original'&&!old.bookSpines.bad&&old.look==='leather'};
  })()`);
  return { ok: r.fresh.join(',') === 'favourites,encyclopedia,years,months,people,tags' && r.look === 'leather' &&
      r.offered.join(',') === 'leather' && r.overrides.colours === 0 && r.overrides.bindings === 0 && r.deterministic && r.grouped &&
      r.periods > 1 && r.identities.every((n) => n > 1) && r.persists && r.legacy,
    detail: JSON.stringify(r) };
});

check("a spine's title never touches a line the binding draws", async (p) => {
  const r = await p.j(`(function(){
    /* EVERY GEOMETRY CHECK HERE PASSED while the M of a month spine sat on leather's lower
     * gilt band, because they all compare a box to a box and a binding's rules are PAINTED
     * rather than laid out. This one reads where a look actually puts ink -- a pseudo-
     * element's own border box, and the px stops of every gradient it paints -- and measures
     * the gap from each to the title's box along the spine. page.css owns --spine-head,
     * --spine-tail, --spine-rule and --spine-clear; a look that moves a rule without moving
     * those is what this fails on.
     *
     * THE SIDES ARE A DIFFERENT QUESTION and this reports rather than asserts them: the
     * title's box stands outside the side rules now, so it cannot overhang one, but what
     * clears a side rule is the LINE BOX, and that is the face's own ascent and descent
     * against a spine whose width is its note count. design/0021 has the arithmetic. */
    var core = window.VaultShelfCore;
    var root = document.getElementById("vs-app");
    var was = root.getAttribute("data-look") || "";
    var px = function (v) { return parseFloat(v) || 0; };
    var round = function (n) { return Math.round(n * 10) / 10; };

    /* A gradient layer paints a RULE when it opens and closes on a px stop and the run
     * between them is thin; a wider one is a wash down the whole board and draws no line.
     * A layer neither a url() nor a gradient is reported rather than passed over. */
    var RULE_MAX = 12;
    var layersOf = function (image) {
      var out = [], depth = 0, start = 0;
      for (var i = 0; i < image.length; i++) {
        var c = image.charAt(i);
        if (c === "(") depth++;
        else if (c === ")") depth--;
        else if (c === "," && depth === 0) { out.push(image.slice(start, i).trim()); start = i + 1; }
      }
      out.push(image.slice(start).trim());
      return out.filter(Boolean);
    };
    var ruleIn = function (layer, box, unread) {
      if (layer === "none" || layer.indexOf("url(") === 0) return null;
      if (layer.indexOf("linear-gradient(") !== 0) { unread.push(layer.slice(0, 48)); return null; }
      var body = layer.slice("linear-gradient(".length, -1);
      /* a computed 180deg is "to bottom", which Chrome prints as no angle at all */
      var fromBottom = /^\\s*0deg\\b/.test(body);
      var stops = [], m, re = /(-?\\d+(?:\\.\\d+)?)px/g;
      while ((m = re.exec(body))) stops.push(parseFloat(m[1]));
      if (!stops.length) return null;
      var near = Math.min.apply(null, stops), far = Math.max.apply(null, stops);
      if (far - near > RULE_MAX) return null;
      return fromBottom ? { top: box.bottom - far, bottom: box.bottom - near }
                        : { top: box.top + near, bottom: box.top + far };
    };

    /* Every line a look paints on one spine, in that spine's own coordinates -- which are
     * its BORDER box, because that is what getBoundingClientRect gives for the title. A
     * pseudo-element's offsets resolve against the PADDING box, so both borders are taken
     * off first; a spine has none at the top today and a look may add one tomorrow. */
    var rulesOn = function (spine, height, unread) {
      var rules = [], sides = [];
      var own = getComputedStyle(spine);
      var padTop = px(own.borderTopWidth);
      var padH = height - padTop - px(own.borderBottomWidth);
      ["::before", "::after"].forEach(function (pseudo) {
        var cs = getComputedStyle(spine, pseudo);
        if (!cs || cs.content === "none" || cs.content === "normal") return;
        var top = cs.top === "auto" ? padH - px(cs.bottom) - px(cs.height) : px(cs.top);
        var bottom = cs.bottom === "auto" ? top + px(cs.height) : padH - px(cs.bottom);
        var box = { top: padTop + top, bottom: padTop + bottom };
        if (px(cs.left) > 0) sides.push(px(cs.left));
        if (px(cs.right) > 0) sides.push(px(cs.right));
        var edge = px(cs.borderTopWidth);
        if (edge > 0 && cs.borderTopColor.indexOf("rgba(0, 0, 0, 0)") < 0) {
          rules.push({ top: box.top, bottom: box.top + edge });
          rules.push({ top: box.bottom - px(cs.borderBottomWidth), bottom: box.bottom });
        }
        if (box.bottom - box.top <= RULE_MAX && cs.backgroundImage !== "none") {
          rules.push(box);
        } else {
          layersOf(cs.backgroundImage).forEach(function (layer) {
            var rule = ruleIn(layer, box, unread);
            if (rule) rules.push(rule);
          });
        }
      });
      return { rules: rules, sides: sides };
    };

    var read = function (look) {
      var worst = null, tightest = null, unread = [], spilled = 0, seen = 0, rules = 0;
      var run = document.createRange();
      [].slice.call(document.querySelectorAll("#vs-shelves .vs-spine")).forEach(function (spine) {
        var title = spine.querySelector(".vs-title");
        if (!title || !title.textContent) return;
        var s = spine.getBoundingClientRect();
        var t = title.getBoundingClientRect();
        var box = { top: t.top - s.top, bottom: t.bottom - s.top };
        var ink = rulesOn(spine, s.height, unread);
        seen++;
        rules += ink.rules.length;
        /* THE BOX IS THE CLIP: a glyph, and its shadow, cannot paint outside it. */
        run.selectNodeContents(title);
        var text = run.getBoundingClientRect();
        if (text.top - s.top < box.top - 0.5 || text.bottom - s.top > box.bottom + 0.5) spilled++;
        ink.rules.forEach(function (rule) {
          var gap = rule.top >= box.bottom ? rule.top - box.bottom
                  : rule.bottom <= box.top ? box.top - rule.bottom
                  : Math.max(box.top, rule.top) - Math.min(box.bottom, rule.bottom);
          if (!worst || gap < worst.gap) {
            worst = { gap: round(gap), title: title.textContent, h: Math.round(s.height),
                      rule: round(rule.top) + ".." + round(rule.bottom),
                      box: round(box.top) + ".." + round(box.bottom) };
          }
        });
        /* the sides, reported: the text's box across is the face's, the spine's width the
         * vault's, and no padding stands between them */
        ink.sides.forEach(function (inset) {
          var lip = (s.width - text.width) / 2 - inset;
          if (!tightest || lip < tightest.lip) {
            tightest = { lip: round(lip), title: title.textContent, w: Math.round(s.width),
                         line: round(text.width), inset: round(inset) };
          }
        });
      });
      return { worst: worst, tightest: tightest, unread: unread.slice(0, 3),
               spilled: spilled, seen: seen, rules: rules };
    };

    var out = {};
    core.LOOKS.forEach(function (l) {
      __vs.setLook(l.value);
      out[l.value || "modern"] = read(l.value || "modern");
    });
    __vs.setLook(was);
    var probe = document.querySelector("#vs-shelves .vs-spine");
    var cs = probe ? getComputedStyle(probe) : null;
    var declared = function (name) { return cs ? px(cs.getPropertyValue(name)) : 0; };
    return {
      looks: out,
      clear: declared("--spine-clear"),
      head: declared("--spine-head"),
      tail: declared("--spine-tail"),
      side: declared("--spine-rule-side"),
      rule: declared("--spine-rule"),
      padding: cs ? cs.padding : ""
    };
  })()`);

  const looks = Object.keys(r.looks);
  const touching = [], unread = [];
  for (const look of looks) {
    const l = r.looks[look];
    if (l.worst && l.worst.gap < r.clear) {
      touching.push(`${look} ${JSON.stringify(l.worst.title)} on a ${l.worst.h}px spine: ` +
                    `box ${l.worst.box}, rule ${l.worst.rule}, ${l.worst.gap}px apart`);
    }
    if (l.unread.length) unread.push(`${look}: ${l.unread.join(" | ")}`);
  }
  /* github#45, design/0021 -- the sides are reported, not asserted */
  const sides = looks.filter((k) => r.looks[k].tightest)
                     .map((k) => `${k} ${r.looks[k].tightest.lip}px ` +
                                 `(a ${r.looks[k].tightest.w}px spine, a ` +
                                 `${r.looks[k].tightest.line}px line box, a rule ` +
                                 `${r.looks[k].tightest.inset}px in)`);
  const seen = r.looks[looks[0]].seen;
  return {
    ok: !touching.length && !unread.length && r.clear > 0 && r.rule > 0 && seen > 0,
    detail: `${seen} titles in ${looks.length} looks against ${looks.map((k) => r.looks[k].rules)
             .join("/")} painted rules; page.css declares head ${r.head}px, tail ${r.tail}px, ` +
            `side ${r.side}px, rule ${r.rule}px, clear ${r.clear}px and pads the spine ` +
            `${r.padding}; nearest rule ` +
            looks.map((k) => `${k} ${r.looks[k].worst ? r.looks[k].worst.gap + "px" : "none drawn"}`)
                 .join(", ") +
            `; ellipsised ` + looks.map((k) => `${k} ${r.looks[k].spilled}`).join("/") +
            `; sideways (reported, not asserted) ` + sides.join(", ") +
            (touching.length ? `; ${touching.length} TOUCHING: ${touching.join("; ")}` : "") +
            (unread.length ? `; a paint layer this cannot read: ${unread.join("; ")}` : "")
  };
});

/* github#9, design/0019 -- ONE MATERIAL FOR THE FURNITURE, read as computed style */
check("the furniture is one material", async (p) => {
  const looks = await p.j(`window.VaultShelfCore.LOOKS.map(function (l) { return l.value; })`);
  await p.send("DOM.enable");
  await p.send("CSS.enable");
  const faceOf = async (sel, pseudo) => {
    const doc = await p.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await p.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel });
    if (!nodeId) return null;
    if (pseudo) await p.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: pseudo });
    const cs = await p.send("CSS.getComputedStyleForNode", { nodeId });
    if (pseudo) await p.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
    const g = {};
    for (const e of cs.computedStyle) g[e.name] = e.value;
    return {
      bg: g["background-image"], ink: g.color, edge: g["border-bottom-color"], ts: g["text-shadow"],
      ls: Math.round(parseFloat(g["letter-spacing"]) / parseFloat(g["font-size"]) * 1000) / 1000,
      ring: g["outline-style"] !== "none" && parseFloat(g["outline-width"]) > 0,
    };
  };
  const rgb = (s) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || "");
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };
  const over = (c, room) => c.map((v, i) => i < 3 ? v * c[3] + room[i] * (1 - c[3]) : 1);
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const stops = (bg) => (bg.match(/rgba?\([^)]*\)/g) || []).map(rgb).filter(Boolean);
  const same = (a, b) => a.bg === b.bg && a.ink === b.ink && a.edge === b.edge && a.ts === b.ts;

  /* github#2, design/0019 -- room plates match the plaque, paper plates the sheet's */
  const plates = {
    library: { room: ["#vs-manageopen"], paper: [] },
    /* github#9, github#3 -- the glass tab is accent-lit, like the primary button */
    reading: { room: ["#vs-back", "#vs-nextnote",
                      "#vs-tabs button:not([aria-current='true']):not(.vs-findtab)"],
               paper: [".vs-alsoin button"] },
    /* github#38 -- the action buttons; the row's name is not one */
    managing: { room: [], paper: ["#vs-managelist .vs-managerow button:not(.vs-name)", "#vs-mnew"] },
  };
  const others = {
    library: ["#vs-shelves .vs-spine", "#vs-newshelf"],
    reading: ["#vs-contents button", "#vs-marks .vs-markstub"],
    /* github#38 -- where the jump chip's place in this list went. */
    managing: ["#vs-mclose", "#vs-managelist .vs-name"],
  };
  const book = await p.j(`__vs.views().filter(function (v) { return v.shelf.id === "years"; })[0].books[0].id`);
  const off = [];
  let compared = 0, lowest = { ratio: Infinity, where: "" }, tracking = {};
  const rooms = [];
  for (const look of looks) {
    for (const theme of look === "" ? ["dark", "light"] : ["dark"]) {
      const name = (look || "modern") + (theme === "light" ? " light" : "");
      rooms.push(name);
      const room = rgb(await p.j(`(function(){
        __vs.setLook(${JSON.stringify(look)}); __vs.setTheme(${JSON.stringify(theme)});
        var c = document.createElement("span"); c.style.color = getComputedStyle(document.getElementById("vs-app")).getPropertyValue("--surface-0");
        document.body.appendChild(c); var v = getComputedStyle(c).color; c.remove(); return v; })()`)) || [0, 0, 0, 1];
      const reference = async (sel, what) => {
        const rest = await faceOf(sel), lit = await faceOf(sel, ["hover"]), focused = await faceOf(sel, ["focus", "focus-visible"]);
        if (!rest || !lit || !focused) { off.push(`${name}: no ${what} to read`); return null; }
        if (!focused.ring) off.push(`${name}: the ${what} draws no focus ring`);
        if (!same(lit, focused)) off.push(`${name}: a focused ${what} is not a lit one`);
        return { rest, lit };
      };
      const measure = (face, where) => {
        const ink = rgb(face.ink);
        for (const stop of stops(face.bg)) {
          const r = contrast(over(ink, room), over(stop, room));
          if (r < lowest.ratio) lowest = { ratio: r, where };
          if (r < 4.5) off.push(`${where}: ${r.toFixed(2)}:1 for ${face.ink} on ${JSON.stringify(stop)}`);
        }
      };
      const plaque = await reference("#vs-shelves .vs-plaque", "plaque");
      if (!plaque) continue;
      if (plaque.rest.ls < 0.1) off.push(`${name}: plaque tracking ${plaque.rest.ls}em, under 0.1em`);
      tracking[name] = { plaque: plaque.rest.ls };
      measure(plaque.rest, `${name} plate`);
      measure(plaque.lit, `${name} lit plate`);
      await p.j(`(document.getElementById("vs-manageopen").click(), 1)`);
      const paper = await reference("#vs-mnew", "paper plate");
      await p.j(`(document.getElementById("vs-mclose").click(), 1)`);
      if (!paper) continue;
      measure(paper.rest, `${name} paper plate`);
      measure(paper.lit, `${name} lit paper plate`);
      const judge = async (sel, ref, what) => {
        const face = await faceOf(sel);
        if (!face) return;
        compared++;
        const litFace = await faceOf(sel, ["hover"]), focusFace = await faceOf(sel, ["focus", "focus-visible"]);
        if (!same(face, ref.rest)) off.push(`${name} ${sel}: ${face.bg} / ${face.ink} / ${face.edge} / ${face.ts} is not the ${what}'s`);
        if (!same(litFace, ref.lit)) off.push(`${name} ${sel} hovered: ${litFace.bg} / ${litFace.ink} is not the lit ${what}'s`);
        if (!focusFace.ring) off.push(`${name} ${sel}: no focus ring`);
        if (face.ls > 0.05) off.push(`${name} ${sel}: tracking ${face.ls}em, over 0.05em`);
        tracking[name].button = face.ls;
      };
      const phase = async (which, open, close) => {
        if (open) await p.j(open);
        for (const sel of plates[which].room) await judge(sel, plaque, "plaque");
        for (const sel of plates[which].paper) await judge(sel, paper, "paper plate");
        for (const sel of others[which]) {
          const face = await faceOf(sel);
          if (!face) continue;
          compared++;
          if (face.bg === plaque.rest.bg || face.bg === paper.rest.bg) off.push(`${name} ${sel} is painted as a plate`);
          if (face.ts !== "none") off.push(`${name} ${sel} carries the plate's engraving shadow: ${face.ts}`);
        }
        if (close) await p.j(close);
      };
      await phase("library");
      await phase("reading", `(__vs.openBook(${JSON.stringify(book)}, null), 1)`, "(__vs.closeReader(), 1)");
      await phase("managing", `(document.getElementById("vs-manageopen").click(), 1)`,
                  `(document.getElementById("vs-mclose").click(), 1)`);
    }
  }
  await p.j(`(__vs.setLook(${JSON.stringify(looks[0])}), __vs.setTheme("dark"), 1)`);
  const tr = Object.keys(tracking).map((k) => `${k} ${tracking[k].plaque}/${tracking[k].button}`).join(", ");
  return {
    ok: off.length === 0 && compared >= 20,
    detail: `${compared} controls read against the plaque in ${rooms.length} rooms (${rooms.join(", ")}), rested, ` +
            `hovered and focused; lowest contrast ${lowest.ratio.toFixed(2)}:1 at ${lowest.where}; ` +
            `tracking plaque/button in em: ${tr}; ${off.length} off` + (off.length ? `: ${off.join("; ")}` : ""),
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
    var settings = __vs.settings(), savedColours = VaultShelfCore.clone(settings.bookColors);
    try {
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
    var pick = (folderSlot + 5) % 14;
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
    } finally {
      settings.bookColors = savedColours;
      __vs.setFilters({});
    }
  })()`);
  const ok = r.folderSlot >= 0 && r.opened && r.swatches === 14 && r.painted === 14 &&
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

check("a date shelf dyes by period, an index wears one dye, and identities vary", async (p) => {
  const r = await p.j(`(function(){
    var tint = function (id) {
      var el = document.querySelector('[data-book="' + id.replace(/"/g, '\\"') + '"]');
      return el ? el.style.getPropertyValue("--spine-tint").trim() : "";
    };
    var view = function (id) { return __vs.views().filter(function (v) { return v.shelf.id === id; })[0]; };
    var dated = function (id) { return view(id).books.filter(function (b) { return /^\\d{4}/.test(b.key); }); };
    var folderDye = function (b) { return b.bands.length && b.bands[0].slot ? String(b.bands[0].slot) : __vs.slots()[0]; };
    /* how many periods carry more than one dye, and how many neighbouring periods share one */
    var split = function (books, period) {
      var by = {};
      books.forEach(function (b) { var k = period(b.key); (by[k] = by[k] || {})[tint(b.id)] = 1; });
      var keys = Object.keys(by).sort();
      var torn = keys.filter(function (k) { return Object.keys(by[k]).length !== 1; }).length;
      var shared = 0;
      for (var i = 1; i < keys.length; i++) {
        if (Object.keys(by[keys[i]])[0] === Object.keys(by[keys[i - 1]])[0]) shared++;
      }
      return { periods: keys.length, torn: torn, shared: shared };
    };
    var year = function (k) { return k.slice(0, 4); };
    var decade = function (k) { return k.slice(0, 3); };
    var months = split(dated("months"), year);
    var years = split(dated("years"), decade);
    var enc = view("encyclopedia").books;
    var encByFolder = enc.filter(function (b) { return tint(b.id) === folderDye(b); }).length;
    /* github#33 -- an index wears one dye; identities wear many. */
    var distinct = function (books) {
      var seen = {};
      books.forEach(function (b) { seen[tint(b.id)] = 1; });
      return Object.keys(seen).length;
    };
    var encDyes = distinct(enc);
    var peopleDyes = distinct(view("people").books);
    var tagDyes = distinct(view("tags").books);

    /* Months to folder, then to decade, through the select in Manage. */
    document.getElementById("vs-manageopen").click();
    var rows = [].slice.call(document.querySelectorAll("#vs-managelist .vs-managerow"));
    var rowOf = function (name) { return rows.filter(function (r) { return r.textContent.indexOf(name) === 0; })[0]; };
    var by = rowOf("Months").querySelector("select.vs-colourby");
    var offered = by ? [].slice.call(by.options).map(function (o) { return o.value; }).join(",") : "(none)";
    var came = by ? by.value : "";
    var set = function (v) { by.value = v; by.dispatchEvent(new Event("change", { bubbles: true })); };
    set("folder");
    var monthsFolder = dated("months").filter(function (b) { return tint(b.id) === folderDye(b); }).length;
    set("decade");
    var monthsDecade = split(dated("months"), decade);
    var saved = __vs.settings().shelves.filter(function (s) { return s.id === "months"; })[0].colorBy;
    set("year");
    var encSelect = !!rowOf("Encyclopedia").querySelector("select.vs-colourby");
    var peopleSelect = !!rowOf("People").querySelector("select.vs-colourby");
    document.getElementById("vs-mclose").click();
    return { months: months, years: years, monthsN: dated("months").length, enc: enc.length, encByFolder: encByFolder,
             encDyes: encDyes, peopleDyes: peopleDyes, tagDyes: tagDyes,
             offered: offered, came: came, monthsFolder: monthsFolder, monthsDecade: monthsDecade, saved: saved,
             encSelect: encSelect, peopleSelect: peopleSelect };
  })()`);
  const ok = r.months.torn === 0 && r.months.shared === 0 && r.years.torn === 0 && r.years.shared === 0 &&
             r.encDyes === 1 && r.peopleDyes > 3 && r.tagDyes > 3 &&
             r.offered === "folder,year,decade" && r.came === "year" &&
             r.monthsFolder === r.monthsN && r.monthsDecade.torn === 0 && r.saved === "decade" &&
             !r.encSelect && !r.peopleSelect;
  return {
    ok,
    detail: `Months: ${r.monthsN} dated books over ${r.months.periods} years, ${r.months.torn} year(s) torn ` +
            `between dyes and ${r.months.shared} neighbouring years sharing one; Years: ${r.years.periods} ` +
            `decade(s), ${r.years.torn} torn, ${r.years.shared} shared; Encyclopedia's ${r.enc} volumes ` +
            `wear ${r.encDyes} dye (${r.encByFolder} of them their folder's), People ${r.peopleDyes} and ` +
            `Tags ${r.tagDyes}; Manage offers "${r.offered}" on Months (came up "${r.came}"), ` +
            `by folder ${r.monthsFolder}/${r.monthsN} follow the folder, by decade ${r.monthsDecade.torn} ` +
            `torn, saved as "${r.saved}"; Encyclopedia has the select: ${r.encSelect}, People: ${r.peopleSelect}`
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
    var startDyes = ids.map(tint).join(",");

    /* Vary this shelf, through the button in Manage. */
    document.getElementById("vs-manageopen").click();
    var rows = [].slice.call(document.querySelectorAll("#vs-managelist .vs-managerow"));
    var row = rows.filter(function (r) { return r.textContent.indexOf("People") === 0; })[0];
    var vary = row.querySelector('.vs-toggle[data-fact="vary"] input[role="switch"]');
    /* github#33 -- People varies by DEFAULT now, so reach the off state first. */
    var variedByDefault = vary.checked;
    if (variedByDefault) vary.click();
    /* The SET of dyes, not how many: a vault with eight source folders gives eight People
     * books eight colours by folder already, and varying them changes which colours, not
     * how many. */
    var byFolderDyes = ids.map(tint).join(",");
    var byFolder = new Set(ids.map(tint)).size;
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
    if (!variedByDefault) vary.click();
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
             changed: variedDyes !== byFolderDyes, restored: backDyes === startDyes,
             variedByDefault: variedByDefault, recoloured: recoloured,
             slotsBefore: slotsBefore, slot1: slotsAfter[0], first: first,
             underOther: underOther, reset: reset, other: other || "modern" };
  })()`);
  const ok = r.changed && r.pressed === 2 && r.restored && r.recoloured === 0 &&
             r.variedByDefault &&
             r.slot1 === "#123456" && r.underOther === "#123456" && r.reset !== "#123456";
  return {
    ok,
    detail: `8 People books wear ${r.byFolder} colour(s) by folder and ${r.varied} varied -- ` +
            `a different set (${r.changed}); People and Tags vary by default ` +
            `(${r.variedByDefault}), ${r.pressed} shelves pressed, ` +
            `${r.recoloured} recoloured by a narrowing rebuild, back to the default after ` +
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
  const ok = r.swatches === 14 && r.painted === 14 && r.numbers === "1,2,3,4,5,6,7,8,9,10,11,12,13,14" &&
             r.rows === 14 && r.threads === 14 && opposed === 14 && visible === 14 &&
             r.marksAtStart === 0 && r.resetDisabledAtStart === true &&
             a.saved === 14 && a.allHex && a.slot3 === "#3355aa" && a.marks === 1 && a.marked === "3" &&
             a.resetEnabled && a.cascade === "#3355aa" &&
             r.ribbon.saved === "#aa3355" && r.ribbon.others === 1 && r.ribbon.marks === 2 &&
             r.ribbon.onSpine === "#aa3355" && r.ribbon.before !== "#aa3355" &&
             r.afterSlotReset.saved === 0 && r.afterSlotReset.marks === 1 && r.afterSlotReset.ribbonKept === "#aa3355" &&
             r.oneOfTwo.saved === 14 && r.oneOfTwo.slot5 === "#445566" &&
             r.oneOfTwo.slot1 === r.afterReset.own1 &&
             r.afterReset.palette === 0 && r.afterReset.ribbons === 0 && r.afterReset.disabled === true &&
             r.afterReset.marks === 0 &&
             h.shownAtStart === true && h.saved === true && h.shownAfter === false &&
             h.visibleDuring === h.visibleBefore - 1 && h.stillBuilt > 0 && h.textButtons === 0 &&
             h.back === false && h.visibleAfter === h.visibleBefore;
  return {
    ok,
    detail: `${r.rows} rows, ${r.swatches} dyes painted ${r.painted}, ${r.threads} ribbons, numbered ` +
            `${r.numbers === "1,2,3,4,5,6,7,8,9,10,11,12,13,14" ? "1-14" : r.numbers}; ${opposed}/14 complements a ` +
            `hue or a third of the lightness away, ${visible}/14 visibly lighter or darker than their dye; ` +
            `${r.marksAtStart} marked and the reset ${r.resetDisabledAtStart ? "quiet" : "LIVE"} to start; ` +
            `slot 3 -> ${a.slot3}: ${a.saved} saved, ${a.marks} mark on slot ${a.marked}, cascade ${a.cascade}; ` +
            `ribbon 7 ${r.ribbon.saved} alone (${r.ribbon.others} of 14), was ${r.ribbon.before} on its spine and ` +
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

/* design/0033 */
check("older books wear on first launch without invented reading history", async (p) => {
  const r = await p.j(`(function(){
    var core=window.VaultShelfCore, saved=JSON.parse(JSON.stringify(__vs.settings()));
    __vs.closeReader();
    try {
      __vs.setFilters({from:null,to:null,folders:[]});
      window.vsHandle.setSettings(core.emptySettings());
      var years=__vs.views().find(function(v){return v.shelf.id==='years';});
      var now=Number(__vs.data().generated.slice(0,4));
      var old=years.books.find(function(b){return /^[0-9]{4}$/.test(b.key) && Number(b.key)<now-7;});
      var recent=years.books.find(function(b){return b.key===String(now);});
      if(!old || !recent) return {found:false};
      var find=function(id){return document.querySelector('[data-book="'+id+'"]');};
      var level=function(id){var el=find(id);return el ? Number(el.getAttribute('data-wear')||0) : -1;};
      var fresh={old:level(old.id),recent:level(recent.id),recentNotes:recent.notes.length,oldCount:__vs.settings().wear[old.id],oldNotes:old.notes.length,never:Object.values(__vs.settings().lastOpened).every(function(t){return t==='never';})};
      var el=find(old.id);
      el.scrollIntoView({block:'center'});
      var box=function(){return [el.offsetLeft,el.offsetTop,el.offsetWidth,el.offsetHeight];};
      var before=box(), paint=getComputedStyle(el).getPropertyValue('--vs-wear');
      el.removeAttribute('data-wear');
      var withoutAgePaint=getComputedStyle(el).getPropertyValue('--vs-wear');
      var sameBox=JSON.stringify(before)===JSON.stringify(box());
      el.setAttribute('data-wear','3');
      var existing=JSON.parse(JSON.stringify(__vs.settings()));
      existing.wear[old.id]=2;
      existing.wear[recent.id]=12;
      existing.bookSpines[old.id]='vellum';
      existing.shelves[0].picks=[old.id];
      window.vsHandle.setSettings(existing);
      var pick=document.querySelector('[data-source="'+old.id+'"]');
      var oldLevel=level(old.id), oldBinding=find(old.id).getAttribute('data-binding');
      var reference=pick && Number(pick.getAttribute('data-wear'))===oldLevel;
      var currentLevel=level(recent.id);
      __vs.openBook(old.id,null); __vs.closeReader();
      var actualOpens=__vs.settings().wear[old.id], afterOpen=level(old.id);
      var levels={};
      document.querySelectorAll('#vs-shelves .vs-spine[data-book]').forEach(function(sp){
        levels[sp.getAttribute('data-book')]=sp.getAttribute('data-wear')||'0';
      });
      __vs.setFilters({to:String(now-8)+'-12-31'});
      var filterStable=true, compared=0;
      document.querySelectorAll('#vs-shelves .vs-spine[data-book]').forEach(function(sp){
        var id=sp.getAttribute('data-book');
        if(levels[id]!==undefined){compared++;if((sp.getAttribute('data-wear')||'0')!==levels[id])filterStable=false;}
      });
      __vs.setFilters({from:null,to:null,folders:[]});
      var restored=JSON.parse(JSON.stringify(__vs.settings()));
      restored.shelves.find(function(s){return s.id==='years';}).hidden=true;
      window.vsHandle.setSettings(restored);
      pick=document.querySelector('[data-source="'+old.id+'"]');
      var hiddenParity=pick && Number(pick.getAttribute('data-wear'))===3;
      return {found:true,old:old.key,recent:recent.key,fresh:fresh,paint:paint,withoutAgePaint:withoutAgePaint,sameBox:sameBox,
        oldLevel:oldLevel,currentLevel:currentLevel,reference:reference,oldBinding:oldBinding,
        actualOpens:actualOpens,afterOpen:afterOpen,filterStable:filterStable,compared:compared,
        hiddenParity:hiddenParity,keptBinding:__vs.settings().bookSpines[old.id]};
    } finally { __vs.closeReader(); __vs.setFilters({from:null,to:null,folders:[]}); window.vsHandle.setSettings(saved); }
  })()`);
  return {ok:r.found && r.fresh.old===3 && r.fresh.recentNotes>=12 && r.fresh.recent===3 && r.fresh.oldCount===r.fresh.oldNotes && r.fresh.never &&
    Number(r.paint)>=0.3 && Number(r.withoutAgePaint)===0 && r.sameBox && r.oldLevel===3 && r.currentLevel===3 && r.reference &&
    r.oldBinding==="vellum" && r.keptBinding==="vellum" && r.actualOpens===3 && r.afterOpen===3 &&
    r.filterStable && r.compared>0 && r.hiddenParity,
    detail:JSON.stringify(r)};
});

/* design/0033 */
check("book history seeds notes once and counts additions without stamping a visit", async (p) => {
  const r=await p.j(`(function(){
    var core=VaultShelfCore,saved=JSON.parse(JSON.stringify(__vs.settings())),data=__vs.data();
    try {
      __vs.closeReader();__vs.setFilters({from:null,to:null,folders:[]});
      var source=__vs.views().find(function(v){return v.shelf.id==='years';}).books.find(function(b){return b.notes.length>2;});
      var initial=new Set(source.notes.map(function(n){return n.id;})).size;
      var clean=core.emptySettings();clean.wear[source.id]=7;
      clean.shelves.find(function(s){return s.id==='years';}).hidden=true;
      clean.shelves[0].picks=[source.id];
      window.vsHandle.setSettings(clean);
      var read=function(){return {count:__vs.settings().wear[source.id],stamp:__vs.settings().lastOpened[source.id],notes:__vs.settings().bookNotes[source.id].length};};
      var first=read(),disk=core.migrate(JSON.parse(localStorage.getItem(SETTINGS_KEY)));
      var stored=disk.wear[source.id]===first.count&&disk.lastOpened[source.id]==='never'&&disk.bookNotes[source.id].length===initial;
      window.vsHandle.setSettings(disk);__vs.setFilters({from:'2100-01-01'});var filtered=read();
      var added=Object.assign({},source.notes[0],{id:'counter-addition.md',path:'counter-addition.md',title:'Counter addition'});
      var more=Object.assign({},data,{notes:data.notes.concat([added])});window.vsHandle.refresh(more);
      var addition=read();__vs.setFilters({from:null,to:null,folders:[]});var restored=read();
      window.vsHandle.refresh(data);var removed=read();window.vsHandle.refresh(data);var repeat=read();
      var alias=document.querySelector('[data-shelf="favourites"] [data-source="'+source.id+'"]');alias.click();__vs.closeReader();
      var visit=read(),shared=__vs.settings().wear['favourites/'+source.id]===undefined;
      var made=__vs.makeBook('favourites',{name:'Counter made',source:{kind:'all'}},null);
      var madeSeed=__vs.settings().wear[made]===new Set(data.notes.map(function(n){return n.id;})).size&&__vs.settings().lastOpened[made]==='never';
      __vs.unmakeBook(made);var madeClean=__vs.settings().bookNotes[made]===undefined&&__vs.settings().wear[made]===undefined;
      __vs.deleteShelf('years');var shelfClean=__vs.settings().bookNotes[source.id]===undefined&&__vs.settings().lastOpened[source.id]===undefined;
      window.vsHandle.setSettings(core.emptySettings());var reset=read();
      var totals=Object.keys(__vs.settings().bookNotes).length,never=Object.values(__vs.settings().lastOpened).filter(function(t){return t==='never';}).length;
      return {initial:initial,first:first,stored:stored,filtered:filtered,addition:addition,restored:restored,removed:removed,repeat:repeat,visit:visit,shared:shared,madeSeed:madeSeed,madeClean:madeClean,shelfClean:shelfClean,reset:reset,totals:totals,never:never};
    } finally {__vs.closeReader();__vs.setFilters({from:null,to:null,folders:[]});window.vsHandle.refresh(data);window.vsHandle.setSettings(saved);}
  })()`);
  return {ok:r.first.count===r.initial+7&&r.first.stamp==='never'&&r.stored&&r.filtered.count===r.first.count&&
    r.addition.count===r.first.count+1&&r.addition.notes===r.initial+1&&r.addition.stamp==='never'&&
    r.restored.count===r.addition.count&&r.removed.count===r.addition.count&&r.removed.notes===r.initial+1&&r.repeat.count===r.removed.count&&
    r.visit.count===r.removed.count+1&&Number.isFinite(Date.parse(r.visit.stamp))&&r.shared&&r.madeSeed&&r.madeClean&&r.shelfClean&&
    r.reset.count===r.initial&&r.reset.stamp==='never'&&r.never===r.totals,detail:JSON.stringify(r)};
});

/* design/0033 */
check("last opened defaults to never and persists actual source-book opens", async (p) => {
  const saved=await p.j('JSON.stringify(__vs.settings())');
  try {
    const first=await p.j(`(function(){
      var core=VaultShelfCore, clean=core.emptySettings();
      window.vsHandle.setSettings(clean);
      var book=__vs.views().find(function(v){return v.shelf.id==='years';}).books.find(function(b){return b.notes.length>2;});
      var before=core.lastOpenedAt(__vs.settings(),book.id);
      __vs.settings().wear[book.id]=7;
      var began=Date.now();__vs.openBook(book.id,null);
      var stamp=core.lastOpenedAt(__vs.settings(),book.id), ended=Date.now();
      document.getElementById('vs-nextnote').click();
      var turnUnchanged=core.lastOpenedAt(__vs.settings(),book.id)===stamp;
      __vs.closeReader();__vs.setFilters({});
      return {id:book.id,before:before,stamp:stamp,began:began,ended:ended,count:__vs.settings().wear[book.id],
        turnUnchanged:turnUnchanged,rebuild:core.lastOpenedAt(__vs.settings(),book.id)===stamp};
    })()`);
    await sleep(25);
    const after=await p.j(`(function(){
      var core=VaultShelfCore,id=${JSON.stringify(first.id)};
      __vs.settings().shelves.find(function(s){return s.id==='favourites';}).picks=[id];__vs.setFilters({});
      var pick=document.querySelector('[data-shelf="favourites"] [data-source="'+id+'"]');
      var began=Date.now();pick.click();var ended=Date.now();__vs.closeReader();
      var stamp=core.lastOpenedAt(__vs.settings(),id),count=__vs.settings().wear[id];
      var alias=__vs.settings().lastOpened['favourites/'+id]===undefined;
      var stored=core.migrate(JSON.parse(localStorage.getItem(SETTINGS_KEY)));
      window.vsHandle.setSettings(stored);
      var persisted=core.lastOpenedAt(__vs.settings(),id)===stamp&&__vs.settings().wear[id]===count;
      var made=__vs.makeBook('favourites',{name:'Timestamp check',source:{kind:'all'}},null);
      __vs.openBook(made,null);__vs.closeReader();
      var madeStamped=core.lastOpenedAt(__vs.settings(),made)!=='never';
      __vs.unmakeBook(made);
      var madeGone=core.lastOpenedAt(__vs.settings(),made)==='never'&&__vs.settings().wear[made]===undefined;
      var plate=document.querySelector('[data-shelf="years"] .vs-plaque');plate.click();
      var plaque=__vs.reader().book;__vs.closeReader();
      var plaqueStamped=core.lastOpenedAt(__vs.settings(),plaque)!=='never';
      __vs.deleteShelf('years');
      var deleted=core.lastOpenedAt(__vs.settings(),id)==='never'&&core.lastOpenedAt(__vs.settings(),plaque)==='never'&&__vs.settings().wear[id]===undefined;
      window.vsHandle.setSettings(core.emptySettings());
      var reset=Object.keys(__vs.settings().lastOpened).length>0&&Object.values(__vs.settings().lastOpened).every(function(t){return t==='never';});
      return {stamp:stamp,began:began,ended:ended,count:count,alias:alias,persisted:persisted,madeStamped:madeStamped,madeGone:madeGone,plaqueStamped:plaqueStamped,deleted:deleted,reset:reset};
    })()`);
    return {ok:first.before==='never'&&first.count===8&&Date.parse(first.stamp)>=first.began&&Date.parse(first.stamp)<=first.ended&&first.turnUnchanged&&first.rebuild&&
      Date.parse(after.stamp)>Date.parse(first.stamp)&&Date.parse(after.stamp)>=after.began&&Date.parse(after.stamp)<=after.ended&&after.count===9&&
      ['alias','persisted','madeStamped','madeGone','plaqueStamped','deleted','reset'].every(k=>after[k]),detail:JSON.stringify({first,after})};
  } finally {
    await p.eval(`__vs.closeReader();window.vsHandle.setSettings(${saved}); void 0`);
  }
});

check("shelf wear is recorded and drawn, and survives a rebuild", async (p) => {
  const r = await p.j(`(function(){
    var saved=JSON.parse(JSON.stringify(__vs.settings()));
    try {
      var book=__vs.views().find(function(v){return v.shelf.id==='tags';}).books.find(function(b){return b.key==='acoustics';});
      __vs.settings().shelves.find(function(s){return s.id==='favourites';}).picks=[book.id];__vs.setFilters({});
      var spine=document.querySelector('[data-shelf="tags"] [data-book="'+book.id+'"]');
      var alias=document.querySelector('[data-shelf="favourites"] [data-source="'+book.id+'"]');
      var before=__vs.settings().wear[book.id],peeks=[];
      var hover=function(target){
        var stamp=__vs.settings().lastOpened[book.id];
        target.dispatchEvent(new MouseEvent('mouseenter'));
        var text=document.querySelector('#vs-peek .vs-peekmeta').textContent;
        var unchanged=stamp===__vs.settings().lastOpened[book.id];
        target.dispatchEvent(new MouseEvent('mouseleave'));
        return {text:text,count:__vs.settings().wear[book.id],unchanged:unchanged};
      };
      peeks.push(hover(spine));
      spine.click();__vs.closeReader();peeks.push(hover(spine));peeks.push(hover(alias));
      alias.click();__vs.closeReader();peeks.push(hover(spine));peeks.push(hover(alias));
      var sameNodes=spine===document.querySelector('[data-shelf="tags"] [data-book="'+book.id+'"]')&&alias===document.querySelector('[data-shelf="favourites"] [data-source="'+book.id+'"]');
      for(var i=0;i<11;i++){__vs.openBook(book.id,null);__vs.closeReader();}
      var count=__vs.settings().wear[book.id];
      var drawn=spine.getAttribute('data-wear');
      __vs.setFilters({});
      return {book:book.id,before:before,count:count,drawn:drawn,afterRebuild:__vs.settings().wear[book.id],peeks:peeks,sameNodes:sameNodes,
        level:document.querySelector('[data-book="'+book.id+'"]').getAttribute('data-wear')};
    } finally {__vs.closeReader();window.vsHandle.setSettings(saved);}
  })()`);
  return {ok:r.count===r.before+13&&r.drawn==='3'&&r.afterRebuild===r.count&&r.level==='3'&&r.sameNodes&&
    r.peeks.every((v,i)=>v.count===r.before+[0,1,1,2,2][i]&&v.unchanged&&v.text.includes(v.count+' entries and visits')),detail:JSON.stringify(r)};
});

/* design/0008 -- MAGIC 2. A ribbon hangs out of the book, visible from the shelf. */
check("an open book shows the ribbons in it, three at most", async (p) => {
  const r = await p.j(`(function(){
    var months = __vs.views().filter(function (v) { return v.shelf.id === "months"; })[0];
    /* SIX, NOT FIVE. Five get marked, and the turn below lands on the LAST row expecting a
     * page with no ribbon -- on a book of exactly five that row is marked, and 0 stubs is the
     * right answer to the wrong question. The vault shape's first five-note month was one. */
    var book = months.books.filter(function (b) { return b.notes.length >= 6; })[0];
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

/* github#13, design/0027 -- THE OTHER HALF OF design/0008: what the lit book says. */
check("a book the search drew forward says which of its notes matched", async (p) => {
  const r = await p.j(`(function(){
    /* THE NEEDLE COMES FROM THE VAULT, as it does for the shelf's own half. */
    var tags = {};
    __vs.data().notes.forEach(function (n) {
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var needle = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] ||
                 __vs.data().notes[0].title.slice(0, 4);
    __vs.setQuery(needle);
    var lit = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (!lit && b.matches > 0 && b.matches < b.notes.length) lit = b;
      });
    });
    if (!lit) return { lit: false, needle: needle };
    __vs.openBook(lit.id, null);
    var open = __vs.readerMatches();
    __vs.setQuery("");
    var quiet = __vs.readerMatches();
    __vs.closeReader();
    return { lit: true, needle: needle, open: open, quiet: quiet };
  })()`);
  if (!r.lit) {
    return { ok: false, detail: `no book on this vault is part-matched by "${r.needle}"` };
  }
  const o = r.open;
  return { ok: o.marked === o.matches && o.marked > 0 && o.rows === o.notes &&
               o.why.indexOf(o.matches + " of " + o.notes + " match") >= 0 &&
               r.quiet.marked === 0 && r.quiet.rows === o.notes,
           detail: `"${r.needle}" lit ${o.book}: ${o.marked} of ${o.rows} rows marked against ` +
                   `${o.matches} matching notes, all ${o.notes} still in the index ` +
                   `(it reads "${o.why}"); clearing the box leaves ${r.quiet.marked} marked ` +
                   `and ${r.quiet.rows} rows` };
});

/* github#13, design/0027 -- ONE RULE: a book can no longer deny the shelf behind it. */
check("every book the shelf draws forward finds the same needle in its own find box", async (p) => {
  const r = await p.j(`(function(){
    var tags = {};
    __vs.data().notes.forEach(function (n) {
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var needle = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] ||
                 __vs.data().notes[0].title.slice(0, 4);
    __vs.setQuery(needle);
    var lit = [];
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (b.matches > 0) lit.push(b); });
    });
    var box = document.getElementById("vs-within");
    /* github#13 -- forty opens wear forty books, and wear persists */
    var wear = __vs.settings().wear;
    var wasWorn = JSON.parse(JSON.stringify(wear));
    var tried = 0, denied = [];
    lit.slice(0, 40).forEach(function (b) {
      __vs.openBook(b.id, null);
      box.value = needle;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      var r = __vs.readerMatches();
      tried++;
      if (r.empty || r.rows === 0) denied.push(b.id + " (" + r.rows + " rows)");
      box.value = "";
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    __vs.setQuery("");
    __vs.closeReader();
    for (var k in wear) delete wear[k];
    Object.keys(wasWorn).forEach(function (k) { wear[k] = wasWorn[k]; });
    return { needle: needle, lit: lit.length, tried: tried, denied: denied.slice(0, 3),
             denials: denied.length };
  })()`);
  return { ok: r.tried > 0 && r.denials === 0,
           detail: r.denials
             ? `${r.denials} of ${r.tried} books denied the shelf: ${r.denied.join(", ")}`
             : `"${r.needle}" drew ${r.lit} books forward; ${r.tried} of them were opened and ` +
               `every one found it again in its own find box` };
});

/* github#13 + github#58, design/0027 -- where the two tickets meet, and neither caught alone */
check("a book lit only by the name on its spine finds that name inside it, and says so",
      async (p) => {
  const r = await p.j(`(function(){
    var cover = __vs.vocabulary().filter(function (t) {
      return t.kinds.length === 1 && t.kinds[0] === "book";
    })[0];
    if (!cover) return { skipped: true };
    __vs.setQuery(cover.text);
    var lit = [];
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (b.matches > 0) lit.push(b); });
    });
    var box = document.getElementById("vs-within");
    var wear = __vs.settings().wear;
    var wasWorn = JSON.parse(JSON.stringify(wear));
    var tried = 0, denied = [], unsaid = [], marked = 0;
    lit.slice(0, 20).forEach(function (b) {
      __vs.openBook(b.id, null);
      var before = __vs.readerMatches();
      marked += before.marked;
      /* design/0008, design/0018 -- a marked row, not whichever note the book opens on */
      var row = document.querySelector('#vs-contents button[data-match="1"]');
      if (!row) unsaid.push(b.id + " (no marked row)");
      else {
        row.click();
        if (__vs.readerMatches().meta.indexOf("on the shelf as") < 0) unsaid.push(b.id);
      }
      box.value = cover.text;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      var r = __vs.readerMatches();
      tried++;
      if (r.empty || r.rows === 0) denied.push(b.id + " (" + r.rows + " rows)");
      box.value = "";
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    __vs.setQuery("");
    __vs.closeReader();
    for (var k in wear) delete wear[k];
    Object.keys(wasWorn).forEach(function (k) { wear[k] = wasWorn[k]; });
    return { cover: cover.text, covers: cover.notes, lit: lit.length, tried: tried,
             marked: marked, denied: denied.slice(0, 3), denials: denied.length,
             unsaid: unsaid.length };
  })()`);
  if (r.skipped) return { ok: false, detail: "no cover-only term in the vocabulary to try" };
  return { ok: r.tried > 0 && r.denials === 0 && r.unsaid === 0 && r.marked > 0,
           detail: r.denials || r.unsaid
             ? `${r.denials} of ${r.tried} books denied the shelf (${r.denied.join(", ")}), ` +
               `${r.unsaid} opened without saying why`
             : `“${r.cover}” is on ${r.covers} notes and no note spells it; it drew ${r.lit} ` +
               `books forward, ${r.tried} were opened, ${r.marked} rows marked, every one ` +
               `found it again in its own find box and named the spine` };
});

/* github#13, design/0027 -- the rule and its explanation, kept in step by measurement. */
check("a note has a reason to be marked exactly when it is marked", async (p) => {
  const r = await p.j(`(function(){
    var notes = __vs.data().notes;
    var tags = {}, people = {};
    notes.forEach(function (n) {
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
      n.people.forEach(function (x) { people[x] = (people[x] || 0) + 1; });
    });
    var byUse = function (m) { return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }); };
    var needles = [];
    if (byUse(tags)[0]) needles.push(byUse(tags)[0]);
    if (byUse(people)[0]) needles.push(byUse(people)[0].split(" ")[0]);
    needles.push(notes[0].title.slice(0, 4));
    needles.push(notes[0].folder.slice(0, 4));
    var cover = __vs.vocabulary().filter(function (t) {
      return t.kinds.length === 1 && t.kinds[0] === "book";
    })[0];
    if (cover) needles.push(cover.text);
    needles.push("zz-nothing-spells-this");
    return { cover: cover ? cover.text : "", notes: cover ? cover.notes : 0,
             r: __vs.checkReasons(needles) };
  })()`);
  const { cover, r: c } = r;
  const kinds = Object.keys(c.fields).length;
  return { ok: c.disagree === 0 && c.matched > 0 && c.matched === c.reasoned && kinds >= 4 &&
               c.fields.cover > 0 && !c.fields.body && !c.fields.path,
           detail: c.disagree
             ? `${c.disagree} note/needle pairs disagree, e.g. ${c.sample.join("; ")}`
             : `${c.needles} needles over ${c.notes} notes: ${c.matched} marked, ${c.reasoned} ` +
               `with a reason, 0 disagreements (${JSON.stringify(c.fields)}); the cover-only ` +
               `needle was “${cover}” over ${r.notes} notes` };
});

/* github#41, design/0026 -- WHAT THE VAULT SPELLS. The box knows the vocabulary now. */
check("the search box offers what the vault spells, and says what kind each one is", async (p) => {
  const r = await p.j(`(function(){
    /* THE STEM COMES FROM THE VAULT, not from a word somebody remembered. */
    var tags = {};
    __vs.data().notes.forEach(function (n) {
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var biggest = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] || "";
    var stem = biggest.slice(0, Math.max(2, Math.min(4, biggest.length)));
    __vs.typeQuery(stem);
    var shown = __vs.suggest();
    var vocab = __vs.vocabulary();
    var kinds = {};
    vocab.forEach(function (t) {
      t.kinds.forEach(function (k) { kinds[k] = (kinds[k] || 0) + 1; });
    });
    /* github#41 -- ONE ROW PER SPELLING: a term is never offered twice. */
    var texts = shown.rows.map(function (x) { return x.text.toLowerCase(); });
    var twice = texts.filter(function (t, i) { return texts.indexOf(t) !== i; });
    var several = vocab.filter(function (t) { return t.kinds.length > 1; }).length;
    var titlesShown = shown.rows.filter(function (x) {
      return x.kinds.length === 1 && x.kinds[0] === "note";
    }).length;
    __vs.setQuery("");
    __vs.closeSuggest();
    return { stem: stem, open: shown.open, rows: shown.rows.length, twice: twice.length,
             terms: vocab.length, kinds: kinds, several: several, titlesShown: titlesShown,
             labelled: shown.rows.filter(function (x) { return x.kinds.length > 0; }).length,
             counted: shown.rows.filter(function (x) { return x.notes > 0; }).length };
  })()`);
  const everyKind = ["person", "tag", "folder", "book", "note"].every((k) => r.kinds[k] > 0);
  return { ok: r.open && r.rows > 0 && r.rows <= 8 && r.twice === 0 && everyKind &&
               r.labelled === r.rows && r.counted === r.rows && r.titlesShown <= 3,
           detail: r.twice
             ? `"${r.stem}" offered ${r.twice} spelling(s) twice; it is one row per term`
             : !everyKind
               ? `the vocabulary is missing a kind: ${JSON.stringify(r.kinds)}`
               : `${r.terms} terms (${JSON.stringify(r.kinds)}), ${r.several} spelled by more ` +
                 `than one kind; "${r.stem}" offered ${r.rows} row(s), every one labelled and ` +
                 `counted, ${r.titlesShown} of them bare titles` };
});

/* github#41, design/0026 -- THE HONESTY INVARIANT: the box never offers a dead end. */
check("every suggestion the box offers marks at least one note when it is picked", async (p) => {
  const r = await p.j(`(function(){
    var probes = ["a", "e", "o", "s", "no", "pro"];
    __vs.data().notes.slice(0, 3).forEach(function (n) { probes.push(n.title.slice(0, 3)); });
    var tags = {};
    __vs.data().notes.forEach(function (n) { n.tags.forEach(function (t) { tags[t] = 1; }); });
    Object.keys(tags).slice(0, 4).forEach(function (t) { probes.push(t.slice(0, 3)); });
    var tried = 0, bad = [];
    probes.forEach(function (probe) {
      __vs.typeQuery(probe);
      __vs.suggest().rows.forEach(function (row) {
        tried++;
        __vs.setQuery(row.text);
        var n = parseInt(document.getElementById("vs-hits").textContent, 10);
        if (!(n > 0)) bad.push(row.text);
      });
    });
    __vs.setQuery("");
    __vs.closeSuggest();
    return { tried: tried, bad: bad.slice(0, 5), bads: bad.length, probes: probes.length };
  })()`);
  return { ok: r.tried > 0 && r.bads === 0,
           detail: r.bads
             ? `${r.bads} of ${r.tried} suggestions marked nothing: ${r.bad.join(", ")}`
             : `${r.tried} suggestions over ${r.probes} probes, every one marks at least one note` };
});

/* github#41, design/0026 -- the case the whole feature exists for. */
check("a typo that spells nothing says so, and offers nothing to pick", async (p) => {
  const r = await p.j(`(function(){
    __vs.typeQuery("qzxwvkjyh");
    var list = document.getElementById("vs-suggest");
    var shown = __vs.suggest();
    var empty = list.querySelector(".vs-sugempty");
    var options = list.querySelectorAll('[role="option"]').length;
    var said = empty ? empty.textContent.trim() : "";
    var hits = document.getElementById("vs-hits").textContent;
    /* github#41 -- read before closing: this line used to sit in the return */
    var listHidden = list.hidden;
    __vs.setQuery("");
    __vs.closeSuggest();
    return { open: shown.open, rows: shown.rows.length, options: options, said: said,
             hits: hits, listHidden: listHidden, shut: __vs.suggest().open };
  })()`);
  return { ok: r.open && r.rows === 0 && r.options === 0 && r.said.length > 0 &&
               !r.listHidden && r.shut === false,
           detail: r.said
             ? `the list stays open with 0 pickable rows and says "${r.said}" while the room ` +
               `says "${r.hits}"; clearing the box shuts it`
             : "a query that spells nothing showed no row saying so" };
});

/* github#41, design/0026 -- a combobox, or it is an accessibility bug */
check("the suggestion list is a combobox the keyboard can drive", async (p) => {
  const r = await p.j(`(function(){
    var box = document.getElementById("vs-q");
    var list = document.getElementById("vs-suggest");
    var lib = document.getElementById("vs-library");
    var out = {};
    out.role = box.getAttribute("role");
    out.autocomplete = box.getAttribute("aria-autocomplete");
    out.controls = box.getAttribute("aria-controls") === "vs-suggest";
    out.listRole = list.getAttribute("role");
    out.shutAtRest = box.getAttribute("aria-expanded") === "false" && list.hidden;

    var tags = {};
    __vs.data().notes.forEach(function (n) {
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var biggest = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] || "no";
    var stem = biggest.slice(0, 3);

    box.focus();
    __vs.typeQuery(stem);
    out.expanded = box.getAttribute("aria-expanded") === "true";
    out.noneActiveYet = !box.getAttribute("aria-activedescendant");

    var top = lib.scrollTop;
    var key = function (k) {
      var e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
      box.dispatchEvent(e);
      return e.defaultPrevented;
    };
    out.downTaken = key("ArrowDown");
    out.activeFirst = box.getAttribute("aria-activedescendant") === "vs-sug-0";
    out.selectedOne = list.querySelectorAll('[aria-selected="true"]').length === 1;
    key("ArrowDown");
    out.activeSecond = box.getAttribute("aria-activedescendant") === "vs-sug-1";
    key("ArrowUp");
    out.activeBack = box.getAttribute("aria-activedescendant") === "vs-sug-0";
    /* github#41 -- THE ROOM MUST NOT MOVE while the arrows walk the list. */
    out.roomStill = lib.scrollTop === top;

    var first = __vs.suggest().rows[0];
    out.enterTaken = key("Enter");
    out.completed = document.getElementById("vs-q").value === (first ? first.text : null);
    out.shutAfterEnter = list.hidden && box.getAttribute("aria-expanded") === "false";
    out.focusKept = document.activeElement === box;
    out.marked = parseInt(document.getElementById("vs-hits").textContent, 10) > 0;

    __vs.typeQuery(stem);
    out.reopened = !list.hidden;
    out.escapeTaken = key("Escape");
    out.shutAfterEscape = list.hidden && box.getAttribute("aria-expanded") === "false";
    out.focusKeptAfterEscape = document.activeElement === box;
    /* github#41 -- the reader is not what Escape reached, so it is still shut. */
    out.readerUntouched = document.getElementById("vs-reader").hidden;

    __vs.setQuery("");
    __vs.closeSuggest();
    return out;
  })()`);
  const want = ["controls", "shutAtRest", "expanded", "noneActiveYet", "downTaken", "activeFirst",
                "selectedOne", "activeSecond", "activeBack", "roomStill", "enterTaken",
                "completed", "shutAfterEnter", "focusKept", "marked", "reopened", "escapeTaken",
                "shutAfterEscape", "focusKeptAfterEscape", "readerUntouched"];
  const bad = want.filter((k) => r[k] !== true);
  const ok = !bad.length && r.role === "combobox" && r.listRole === "listbox" &&
             r.autocomplete === "list";
  return { ok,
           detail: ok
             ? "combobox over a listbox; the arrows walk on aria-activedescendant without " +
               "scrolling the room, Enter completes the box and marks, Escape shuts the list " +
               "and keeps the focus"
             : bad.length
               ? `${bad.join(", ")} -- not what a combobox does`
               : `role=${r.role}, list role=${r.listRole}, aria-autocomplete=${r.autocomplete}` };
});

/* github#41, design/0026 -- not everything is Latin, and toLowerCase is a no-op on CJK. */
check("a vocabulary that is not Latin is still offered", async (p) => {
  const r = await p.j(`(function(){
    var vocab = __vs.vocabulary();
    /* github#41 -- a term whose FIRST character is outside Latin-1, so the probe is too. */
    var wide = vocab.filter(function (t) {
      return /^[^\\u0000-\\u00ff]/.test(t.text) && t.kinds.indexOf("note") < 0;
    });
    if (!wide.length) return { none: true };
    var term = wide[0];
    var one = Array.from(term.text)[0];
    __vs.typeQuery(one);
    var rows = __vs.suggest().rows;
    var found = rows.some(function (x) { return x.text === term.text; });
    __vs.setQuery(term.text);
    var marked = parseInt(document.getElementById("vs-hits").textContent, 10);
    __vs.setQuery("");
    __vs.closeSuggest();
    return { term: term.text, one: one, rows: rows.length, found: found, marked: marked,
             wide: wide.length };
  })()`);
  if (r.none) {
    return { ok: true, detail: "nothing to assert: this vault spells nothing outside Latin-1" };
  }
  return { ok: r.found && r.marked > 0,
           detail: r.found
             ? `"${r.one}" offers "${r.term}" among ${r.rows} row(s), and it marks ${r.marked} notes`
             : `"${r.one}" did not offer "${r.term}" (${r.wide} non-Latin term(s) in the vocabulary)` };
});

/* github#41, design/0026 -- a vault with nothing to suggest, asked of core itself. */
check("a vault with no vocabulary offers nothing", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var empty = core.buildVocabulary([], []);
    var offered = core.suggest(empty, "garden");
    var one = core.buildVocabulary([], [
      { id: "n1", path: "a/b.md", title: "Beans", folder: "a", date: null,
        people: [], tags: [], props: {}, excerpt: "", body: "" }]);
    var forBeans = core.suggest(one, "bea");
    return { terms: empty.length, offered: offered.length, oneTerms: one.length,
             oneOffered: forBeans.length, oneText: forBeans.length ? forBeans[0].text : "",
             oneKinds: forBeans.length ? forBeans[0].kinds.join(",") : "" };
  })()`);
  return { ok: r.terms === 0 && r.offered === 0 && r.oneOffered === 1 && r.oneText === "Beans",
           detail: r.terms === 0 && r.offered === 0
             ? `an empty vault spells ${r.terms} terms and offers ${r.offered}; one note spells ` +
               `${r.oneTerms} and offers "${r.oneText}" [${r.oneKinds}]`
             : `an empty vault spelled ${r.terms} terms and offered ${r.offered}` };
});

/* github#58, design/0008 -- WHAT THE SEARCH READS. Every needle comes from the vault. */
check("the search reads titles, covers and declared metadata, and never the body", async (p) => {
  const r = await p.j(`(function(){
    var notes = __vs.data().notes;
    var hits = function (q) {
      __vs.setQuery(q);
      return parseInt(document.getElementById("vs-hits").textContent, 10) || 0;
    };

    /* A NEEDLE THE PROSE SPELLS AND NOTHING ELSE DOES. The generator writes this name into
     * note bodies and never into a people property, which is what makes it the honest probe. */
    var prose = ${JSON.stringify(PROSE_ONLY)};
    var inProse = notes.filter(function (n) {
      return n.body.toLowerCase().indexOf(prose.toLowerCase()) >= 0;
    }).length;

    /* A PATH IS NOT A TITLE AND NOT A FOLDER, so a whole path spells nothing on its own. */
    var path = notes[0].path;

    /* A COVER NO NOTE SPELLS: the string a person reads on a spine and nowhere else. */
    var spelt = {};
    notes.forEach(function (n) {
      spelt[n.title.toLowerCase()] = 1;
      spelt[n.folder.toLowerCase()] = 1;
      n.tags.forEach(function (t) { spelt[t.toLowerCase()] = 1; });
      n.people.forEach(function (x) { spelt[x.toLowerCase()] = 1; });
    });
    var keys = Object.keys(spelt);
    var spellsIt = function (needle) {
      return keys.some(function (k) { return k.indexOf(needle) >= 0; });
    };
    var cover = null, coverNotes = 0, folderShelves = 0;
    __vs.views().forEach(function (v) {
      if (v.shelf.hidden) return;
      if (v.shelf.classifier === "folder") folderShelves++;
      v.books.forEach(function (b) {
        var text = (b.cover || "").trim();
        if (!text || !b.notes.length) return;
        if (spellsIt(text.toLowerCase())) return;
        if (b.notes.length > coverNotes) { cover = text; coverNotes = b.notes.length; }
      });
    });

    /* DECLARED METADATA STANDS WITHOUT A SHELF: the biggest folder, which nothing classifies. */
    var byFolder = {};
    notes.forEach(function (n) { byFolder[n.folder] = (byFolder[n.folder] || 0) + 1; });
    var folder = Object.keys(byFolder).sort(function (a, b) {
      return byFolder[b] - byFolder[a];
    })[0] || "";

    /* THE WART github#41 SHIPPED: the room and the box said opposite things a few cm apart. */
    __vs.typeQuery(prose);
    var rows = __vs.suggest().rows.length;
    var said = document.querySelector("#vs-suggest .vs-sugempty");
    var agree = rows === 0 && !!said && hits(prose) === 0;
    __vs.setQuery("");
    __vs.closeSuggest();

    var out = { inProse: inProse, prose: hits(prose), path: hits(path),
                cover: cover, coverHits: cover ? hits(cover) : 0, coverNotes: coverNotes,
                folder: folder, folderHits: folder ? hits(folder) : 0,
                folderNotes: byFolder[folder] || 0, folderShelves: folderShelves,
                title: hits(notes[0].title), agree: agree };
    __vs.setQuery("");
    out.cleared = document.getElementById("vs-hits").textContent;
    return out;
  })()`);
  const ok = r.inProse > 0 && r.prose === 0 && r.path === 0 && r.title > 0 &&
             !!r.cover && r.coverNotes > 0 && r.coverHits >= r.coverNotes &&
             r.folderNotes > 0 && r.folderHits >= r.folderNotes && r.agree && r.cleared === "";
  return { ok,
           detail: r.prose > 0
             ? `"${PROSE_ONLY}" is in ${r.inProse} bodies and still marked ${r.prose} note(s)`
             : r.path > 0
               ? `a whole path still marked ${r.path} note(s); the path is meant to be dropped`
               : !r.agree
                 ? `the room read ${r.prose} notes while the box said nothing spells it`
                 : `"${PROSE_ONLY}" is in ${r.inProse} bodies and marks ${r.prose}, a whole ` +
                   `path marks ${r.path}; the cover "${r.cover}" marks ${r.coverHits} for its ` +
                   `${r.coverNotes}-note book, and "${r.folder}" marks ${r.folderHits} of ` +
                   `${r.folderNotes} with ${r.folderShelves} folder shelf on the rail` };
});

/* design/0009 -- A ROOM HAS A WIDTH. Measured by overriding the viewport rather than by
 * resizing a window, so the number is the same on a laptop and on the WQHD screen this was
 * reported from. */
check("a narrower window grows rows, and a wide one centres the shelf", async (p) => {
  const was = await p.j("({width:innerWidth,height:innerHeight})");
  const at = async (width) => {
    await viewport(p, width, 1000);
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
  await unviewport(p, was);

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

/* github#38, design/0009 -- the rail is fixed controls, and no grower
 * github#38 -- computed overflow-x, not just the boxes it has today */
check("the rail is fixed controls, and nothing in it scrolls sideways", async (p) => {
  const was = await p.j("({width:innerWidth,height:innerHeight})");
  /* design/0009, github#57 -- CDP resizes without telling the page; viewport() waits */
  const at = async (width) => {
    await viewport(p, width, 1000);
    return p.j(`(function(){
      var rail = document.getElementById("vs-rail");
      var inner = rail.querySelector(".vs-inner");
      /* An out-of-flow child is not in the row: both screen-reader labels are absolute. */
      var kids = [].slice.call(inner.children).filter(function (k) {
        return k.getClientRects().length > 0 && getComputedStyle(k).position !== "absolute";
      });
      var scrollers = [];
      [].slice.call(rail.querySelectorAll("*")).forEach(function (n) {
        var ox = getComputedStyle(n).overflowX;
        if (ox === "auto" || ox === "scroll") scrollers.push(n.id || n.className || n.tagName);
      });
      /* CLIPPED IS NOT SCROLLED, and only one of the two is a defect: the vault's name is
       * overflow-hidden with an ellipsis on purpose (page.css -- the name is the first
       * thing to go when the rail is tight), so it is reported and not asserted on. */
      var clipped = [], rows = [], spans = {};
      var name = function (k) { return k.id || (k.getAttribute("class") || k.tagName.toLowerCase()); };
      kids.forEach(function (k) {
        var b = k.getBoundingClientRect();
        if (k.scrollWidth - k.clientWidth > 1) clipped.push(name(k) + " +" + (k.scrollWidth - k.clientWidth));
        var mid = Math.round((b.top + b.bottom) / 2);
        if (rows.indexOf(mid) < 0) rows.push(mid);
        if (!spans[mid]) spans[mid] = [];
        spans[mid].push(b);
      });
      var box = inner.getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(inner).gap) || 0;
      return { width: ${width}, rows: rows.length, scrollers: scrollers,
               clipped: clipped, inner: Math.round(box.width),
               railHigh: Math.round(rail.getBoundingClientRect().height),
               free: Math.round(Math.min.apply(Math, Object.values(spans).map(function(row) {
                 return box.width-row.reduce(function(total,b){return total+b.width;},0)-gap*Math.max(0,row.length-1);
               }))),
               controls: kids.map(function (k) {
                 return name(k) + " " + Math.round(k.getBoundingClientRect().width);
               }) };
    })()`);
  };

  const wide = await at(1180);
  const narrow = await at(860);
  await unviewport(p, was);

  /* design/0031 */
  const ok = !wide.scrollers.length && !narrow.scrollers.length &&
             wide.rows === 1 && narrow.rows === 2 && wide.free >= 0 && narrow.free >= 0;
  const say = (r) => `at ${r.width}px ${r.rows} row(s) ${r.railHigh}px high, ` +
                     `${r.free}px free of ${r.inner}px (${r.controls.join(", ")})`;
  const clipped = wide.clipped.concat(narrow.clipped);
  return {
    ok,
    detail: `${say(wide)}; ${say(narrow)}; ` +
            `${wide.scrollers.length + narrow.scrollers.length} sideways scroller(s)` +
            (wide.scrollers.length || narrow.scrollers.length
              ? `: ${wide.scrollers.concat(narrow.scrollers).join(", ")}` : "") +
            (clipped.length ? `; clipped to fit (allowed): ${clipped.join(", ")}` : "")
  };
});

/* github#77, decisions/0017 -- a count of missed vsyncs, never a percentile */
check("scrolling the library stays smooth in every look", async (p) => {
  /* MEASURED, NOT ASSUMED. The library is every spine of every shelf, and each look paints a
   * spine with its own layers of gradient and texture; what that costs is only knowable by
   * scrolling it and timing the frames. A scripted scroll of the room, in each look, keeping
   * every frame's timestamp -- the frames that never arrived are the stutter a person feels,
   * and a median of the intervals between the ones that did cannot see them at all. */
  await p.eval(FRAME_HELPERS);
  /* p.eval, not p.j: this one is a promise, and eval awaits it while j would stringify it. */
  const r = await p.eval(`(async function(){
    var lib = document.getElementById("vs-library");
    var looks = window.VaultShelfCore.LOOKS.map(function (l) { return l.value; });
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    /* the throwaway pass is what gets frames flowing at all, and __fr.calibrate says why it
     * has to come first */
    __vs.setLook("");
    await wait(120);
    await __fr.sweep(lib, 240, 800);
    var idle = await __fr.calibrate(lib, 500);

    var out = {};
    for (var i = 0; i < looks.length; i++) {
      __vs.setLook(looks[i]);
      await wait(120);
      /* one discarded pass, so the look's stylesheet has painted before anything is timed */
      await __fr.sweep(lib, 240, 800);
      out[looks[i] || "modern"] = await __fr.sweep(lib, 1400, 800);
    }

    /* github#77 -- AND THE SAME ROOM WITH design/0014 TAKEN BACK OFF IT. A budget nothing can
     * push past is decorative, which is what github#77 suspected this one of being, so the run
     * that asserts the budget also proves the number can still see THE REGRESSION IT EXISTS TO
     * CATCH rather than some cost invented for the occasion. Containment off and the compositor
     * layer gone is the state design/0014 measured at leather 117ms and cyber 400ms at the 95th
     * percentile. Three cheaper slowdowns were tried first and not one of them cost a frame --
     * a filter over every spine, a blur over the whole library, a 20px shadow spread on 231
     * spines -- because a scroll composites tiles that are already rasterised, and per-spine
     * paint does not enter a frame until containment is what changes. That is worth knowing on
     * its own: it is why github#77's own A/B looked insensitive.
     * design/0017 -- on leather, the one look the selector offers. */
    __vs.setLook("leather");
    await wait(120);
    var probe = document.createElement("style");
    probe.id = "vs-smoothprobe";
    probe.textContent =
      ".vault-shelf .vs-shelf{content-visibility:visible!important;contain-intrinsic-size:auto!important}" +
      ".vault-shelf .vs-track{contain:none!important}" +
      ".vault-shelf .vs-shelfrail{contain:none!important}" +
      ".vault-shelf #vs-shelves{will-change:auto!important}";
    document.head.appendChild(probe);
    var slowed;
    try {
      await wait(200);
      await __fr.sweep(lib, 240, 800);
      slowed = await __fr.sweep(lib, 1400, 800);
    } finally {
      probe.parentNode.removeChild(probe);
    }
    __vs.setLook(looks[0]);
    await wait(120);

    return { looks: out, slowed: slowed, idle: idle,
             spines: document.querySelectorAll("#vs-shelves .vs-spine").length };
  })()`);

  const VSYNC = framePeriod(r.idle);
  const names = Object.keys(r.looks);
  const look = {};
  for (const n of names) look[n] = frameStats(r.looks[n], VSYNC);
  const slowed = frameStats(r.slowed, VSYNC);

  /* github#77, decisions/0017 -- missed vsyncs of the ~80 a 1.4s sweep offers */
  const BUDGET = 14;
  const over = names.filter((n) => look[n].missed > BUDGET);
  /* github#77, decisions/0017 -- a budget nothing can fail has stopped seeing cost */
  const blind = slowed.missed <= BUDGET;

  return {
    ok: over.length === 0 && !blind && frameSteady(VSYNC),
    detail: `${r.spines} spines swept at 800px/s through ${look[names[0]].span}px; missed ` +
            `vsyncs of the ${look[names[0]].painted + look[names[0]].missed} on offer, and ` +
            `p50/p95/worst frame in ms -- ` + names.map((n) =>
              `${n} ${look[n].missed} (${look[n].p50.toFixed(1)}/${look[n].p95.toFixed(1)}/` +
              `${look[n].worst.toFixed(0)})`).join(", ") +
            ` (budget: ${BUDGET} missed${over.length ? "; over in " + over.join(", ") : ""})` +
            `; the same room with design/0014 off it missed ${slowed.missed} of ` +
            `${slowed.painted + slowed.missed}` +
            (blind ? `, inside the budget -- the number has stopped seeing cost` : "") +
            `; vsync calibrated at ${VSYNC.toFixed(1)}ms` +
            (frameSteady(VSYNC) ? "" : ", which is no frame this machine can paint")
  };
});

/* github#57, github#69, decisions/0016 -- the runner's own guarantee, checked both ways */
check("a draining room measure is waited out, and nothing else is", async (p) => {
  /* 1. decisions/0013 -- the rule is still armed: atRest() asked, nothing left behind */
  await p.eval(`document.getElementById("vs-manageopen").click(); void 0`);
  const withSheet = await atRest(p);
  await p.eval(`(function(){
    var b = document.getElementById("vs-mclose");
    if (b && b.offsetParent !== null) b.click();
  })(); void 0`);
  const shut = await atRest(p);

  /* 2. github#57 -- returns with the timer deliberately pending; passing IS the guarantee */
  const pending = await p.j(`(function(){
    window.dispatchEvent(new Event("resize"));
    return __vs.room().pending;
  })()`);

  /* decisions/0013 -- named, never "the page is silent": that blames a neighbour */
  const says = (out) => out.some((w) => w.indexOf("manage") >= 0);
  const named = says(withSheet) && !says(shut);
  return {
    ok: named && pending === 1,
    detail: `an open sheet is still named by the busy-page rule (${named}: ` +
            `${withSheet.join("; ") || "nothing"}), and gone once shut ` +
            `(${shut.join("; ") || "nothing"}); returning with settleRoom's timer pending ` +
            `(${pending}) is waited out by the runner rather than blamed on the check -- ` +
            `this check going red with LEFT THE PAGE BUSY is that guarantee breaking`
  };
});

/* github#57 -- the numbers were never wrong; both ends wait on real signals now */
check("the room has a width, however wide the window is", async (p) => {
  const was = await p.j("({width:innerWidth,height:innerHeight})");
  await viewport(p, 2560, 1400);
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
  await unviewport(p, was);

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

/* github#19, design/0037 -- the fore-edge flags, and the one note that earns them */
const STICKY_NOTE_TITLE = "A season in the same bed, start to finish";

/* github#19, design/0037 -- press a flag and wait for the smooth scroll to stop */
const STICKY_PRESS = `async function (at) {
  __vs.pressSticky(at);
  var page = document.querySelector("#vs-reader .vs-page.vs-right");
  var last = -1, quiet = 0;
  for (var i = 0; i < 80; i++) {
    if (page && page.scrollTop === last) { quiet++; if (quiet >= 3) break; }
    else { quiet = 0; last = page ? page.scrollTop : 0; }
    await new Promise(function (r) { setTimeout(r, 20); });
  }
  return __vs.stickies();
}`;

check("a sticky note takes the reader to where the book's subject is written", async (p) => {
  /* p.eval, not p.j: this one is a promise, and eval awaits it while j would stringify it. */
  const r = await p.eval(`(async function(){
    var press = ${STICKY_PRESS};
    var note = __vs.data().notes.filter(function (n) {
      return n.title === ${JSON.stringify(STICKY_NOTE_TITLE)}; })[0];
    if (!note) return { found: false };
    __vs.openBook("tags/garden", note.id);
    var before = __vs.stickies();
    var steps = [];
    for (var i = 0; i < before.flags.length; i++) {
      var now = await press(i);
      steps.push({ at: i, declared: before.flags[i].declared, goingTo: now.goingTo,
                   scrollTop: now.scrollTop, here: now.here, marked: now.marked,
                   onScreen: now.onScreen, inMeta: now.inMeta, span: now.span,
                   leaf: now.leaf });
    }
    var after = __vs.stickies();
    __vs.closeReader();
    return { found: true, subject: before.subject, kind: before.kind, book: before.book,
             hidden: before.hidden, tops: before.flags.map(function (f) { return f.top; }),
             declared: before.flags.filter(function (f) { return f.declared; }).length,
             steps: steps, sameText: before.text === after.text, chars: before.text.length };
  })()`);
  if (!r.found) {
    return { ok: false, detail: `this vault has no "${STICKY_NOTE_TITLE}"; the generator's own ` +
                                `guard should have refused to write it` };
  }
  const written = r.steps.filter((s) => !s.declared);
  const offsets = written.map((s) => s.scrollTop);
  const rising = r.tops.every((t, i) => i === 0 || t > r.tops[i - 1]);
  const oneMark = r.steps.every((s) => s.here === 1);
  const allSeen = r.steps.every((s) => s.onScreen);
  const rightText = r.steps.every((s) => s.marked === "#garden");
  const distinct = new Set(offsets).size;
  const ok = r.subject === "#garden" && r.kind === "tag" && !r.hidden &&
             r.declared === 1 && written.length === 3 && rising &&
             oneMark && allSeen && rightText && distinct >= 2 && r.sameText;
  return {
    ok,
    detail: `${r.book} is about ${r.subject}: ${r.tops.length} flags down the fore-edge at ` +
            `${r.tops.join(", ")}px, ${r.declared} of them on the details line and ` +
            `${written.length} in the text. Pressing each one leaves ${oneMark ? "exactly one" :
            "not one"} mark, always on "${r.steps[0] && r.steps[0].marked}", ` +
            `${allSeen ? "on screen every time" : "off screen somewhere"}; the written three ` +
            `aim at ${written.map((s) => s.goingTo).join(", ")} and ` +
            `scroll the page to ${offsets.join(", ")} (${distinct} distinct) of a ` +
            `${r.steps[0] && r.steps[0].span}px span under a ${r.steps[0] && r.steps[0].leaf}px ` +
            `leaf. The note's ${r.chars} characters are ` +
            `${r.sameText ? "identical" : "NOT identical"} afterwards`
  };
});

check("a subject that is only declared is flagged on the details line", async (p) => {
  /* p.eval, not p.j: this one is a promise, and eval awaits it while j would stringify it. */
  const r = await p.eval(`(async function(){
    var press = ${STICKY_PRESS};
    var skip = ${JSON.stringify(STICKY_NOTE_TITLE)};
    var book = null;
    __vs.views().forEach(function (v) {
      if (v.shelf.id !== "tags") return;
      v.books.forEach(function (b) {
        if (book || b.key !== "garden") return;
        book = b;
      });
    });
    if (!book) return { found: false };
    var note = book.notes.filter(function (n) { return n.title !== skip; })[0];
    if (!note) { __vs.closeReader(); return { found: false }; }
    __vs.openBook(book.id, note.id);
    var shown = __vs.stickies();
    var after = await press(0);
    __vs.closeReader();
    return { found: true, subject: shown.subject, flags: shown.flags.length,
             declared: shown.flags.filter(function (f) { return f.declared; }).length,
             label: shown.flags[0] && shown.flags[0].label,
             scrollTop: after.scrollTop, here: after.here, inMeta: after.inMeta,
             marked: after.marked, title: note.title };
  })()`);
  if (!r.found) return { ok: false, detail: "no garden book, or nothing in it but the sentinel" };
  const ok = r.subject === "#garden" && r.flags === 1 && r.declared === 1 &&
             r.here === 1 && r.inMeta === 1 && r.marked === "#garden" && r.scrollTop === 0;
  return {
    ok,
    detail: `a note whose tag is declared and never written draws ${r.flags} flag, ` +
            `${r.declared} of them on the details line ("${r.label}"). Pressing it marks ` +
            `${r.inMeta} occurrence in the details line and ${r.here - r.inMeta} in the text, ` +
            `and lands the page at ${r.scrollTop}`
  };
});

check("a person is found through the alias the note actually wrote", async (p) => {
  /* p.eval, not p.j: this one is a promise, and eval awaits it while j would stringify it. */
  const r = await p.eval(`(async function(){
    var press = ${STICKY_PRESS};
    var book = null;
    __vs.views().forEach(function (v) {
      if (v.shelf.id !== "people") return;
      v.books.forEach(function (b) { if (b.key === "Halvor Estrin") book = b; });
    });
    if (!book) { __vs.closeReader(); return { found: false }; }
    /* the alias is what the body wrote; the full name is never in the prose */
    var note = null, plain = null;
    book.notes.forEach(function (n) {
      if (note) return;
      if (n.body.indexOf("[[Halvor Estrin|Halvor]]") >= 0) note = n;
      else if (!plain && n.body.indexOf("[[Halvor Estrin]]") >= 0) plain = n;
    });
    if (!note) return { found: false };
    __vs.openBook(book.id, note.id);
    var shown = __vs.stickies();
    var written = shown.flags.filter(function (f) { return !f.declared; }).length;
    var at = shown.flags.length - 1;
    var after = await press(at);
    var out = { found: true, subject: shown.subject, kind: shown.kind,
                flags: shown.flags.length, written: written, marked: after.marked,
                here: after.here, onScreen: after.onScreen, title: note.title,
                inBody: note.body.indexOf("Halvor Estrin|Halvor") >= 0 };
    __vs.closeReader();
    return out;
  })()`);
  if (!r.found) return { ok: false, detail: "no Halvor Estrin book, or no aliased mention in it" };
  const ok = r.subject === "Halvor Estrin" && r.kind === "person" && r.written === 1 &&
             r.marked === "Halvor" && r.here === 1 && r.onScreen && r.inBody;
  return {
    ok,
    detail: `the note writes "[[Halvor Estrin|Halvor]]" and nothing else names them, so the ` +
            `book draws ${r.flags} flags, ${r.written} of them in the text. Pressing the last ` +
            `marks "${r.marked}" -- the alias the reader can see, not the target -- ` +
            `${r.onScreen ? "on screen" : "off screen"}, and it is the only mark on the page`
  };
});

check("a book flags its own subject and no other", async (p) => {
  /* p.eval, not p.j: this one is a promise, and eval awaits it while j would stringify it. */
  const r = await p.eval(`(async function(){
    var title = ${JSON.stringify(STICKY_NOTE_TITLE)};
    var note = __vs.data().notes.filter(function (n) { return n.title === title; })[0];
    if (!note) return { found: false };
    var read = function (bookId) {
      __vs.openBook(bookId, note.id);
      var s = __vs.stickies();
      return { subject: s.subject, hidden: s.hidden, flags: s.flags.length,
               declared: s.flags.filter(function (f) { return f.declared; }).length };
    };
    var parent = read("tags/garden");
    var child = read("tags/garden/seeds");
    __vs.closeReader();
    /* a property book: the value is in the frontmatter and in no body anywhere */
    __vs.addShelf({ id: "vs19-status", name: "Status", source: { kind: "all" },
                    classifier: "property", property: "status", direction: "alphabetical",
                    hidden: false, position: 9, plaques: false });
    var prop = null, propNote = null;
    __vs.views().forEach(function (v) {
      if (v.shelf.id !== "vs19-status") return;
      v.books.forEach(function (b) { if (b.key === "Evergreen") prop = b; });
    });
    if (prop) {
      propNote = prop.notes[0];
      __vs.openBook(prop.id, propNote.id);
    }
    var property = prop ? __vs.stickies() : null;
    var bodyHas = propNote ? propNote.body.toLowerCase().indexOf("evergreen") >= 0 : true;
    __vs.closeReader();
    __vs.deleteShelf("vs19-status");
    return { found: true, parent: parent, child: child,
             property: property ? { subject: property.subject, hidden: property.hidden,
                                    flags: property.flags.length } : null,
             notes: prop ? prop.notes.length : 0, bodyHas: bodyHas };
  })()`);
  if (!r.found) return { ok: false, detail: `this vault has no "${STICKY_NOTE_TITLE}"` };
  const ok = r.parent.flags === 4 && r.parent.declared === 1 &&
             r.child.flags === 2 && r.child.declared === 1 &&
             !!r.property && r.property.flags === 0 && r.property.hidden && !r.bodyHas;
  return {
    ok,
    detail: `the same note in two books: ${r.parent.subject} draws ${r.parent.flags} flags ` +
            `(1 declared, 3 written) and never the child tag, ${r.child.subject} draws ` +
            `${r.child.flags} (1 declared, 1 written) and never the parent. A property book of ` +
            `${r.notes} notes whose value is ${r.bodyHas ? "IN" : "in no"} body draws ` +
            `${r.property ? r.property.flags : "no"} flags and ` +
            `${r.property && r.property.hidden ? "stays hidden" : "shows an empty column"}`
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
    /* github#39 -- close it, or it paints over the library for the next check */
    __vs.closeReader();
    return { found: true, wanted: id, open: open, got: state ? state.book : null, contents: contents };
  })()`);
  if (!r.found) return { ok: false, detail: "no spine on the Years shelf to click" };
  return { ok: r.open && r.got === r.wanted && r.contents > 0,
           detail: `opened ${r.got} (wanted ${r.wanted}), ${r.contents} entries in its contents` };
});

check("the date index is layered: years over months over days, each only where it separates",
      async (p) => {
  const putWearBack = await holdWear(p);
  const r = await p.j(`(function(){
    /* design/0034 -- read the fitted CUT, not the column. The rail draws one level at a time
     * now, so counting the DOM would count whichever level the book happened to open on. */
    var cutOf = function (id) {
      __vs.openBook(id, null);
      var t = __vs.indexTabs();
      __vs.closeReader();
      return t.cuts;
    };
    var pick = function (shelfId, test) {
      var v = __vs.views().filter(function (v) { return v.shelf.id === shelfId; })[0];
      return v.books.filter(test)[0];
    };
    var years = function (b) {
      return new Set(b.notes.map(function (n) { return n.date ? n.date.slice(0, 4) : ""; })
        .filter(Boolean)).size;
    };
    var kidsOf = function (cuts) {
      return cuts.reduce(function (all, c) { return all.concat(c.kids); }, []);
    };
    var plain = function (cuts) { return cuts.filter(function (c) { return !c.span; }); };
    /* A person book spanning several years: years on the top layer, months under them. */
    var tag = pick("people", function (b) { return b.key !== "-unfiled" && years(b) > 1 && b.notes.length > 6; });
    var tagCuts = tag ? cutOf(tag.id) : [];
    var top = plain(tagCuts);
    var yearsShown = top.every(function (c) { return /^\\d{4}$/.test(c.label); });
    var months = plain(kidsOf(tagCuts));
    var monthsLook = months.every(function (c) { return /^[A-Z][a-z]{2}$/.test(c.label); });
    /* A month book: one year, one month -- neither separates, so the top layer IS the days. */
    var month = pick("months", function (b) { return b.key !== "-undated" && b.notes.length > 3; });
    var monthCuts = month ? cutOf(month.id) : [];
    var daysOnly = monthCuts.length > 0 &&
      plain(monthCuts).every(function (c) { return /^\\d{2}$/.test(c.label); });
    /* A book of three or fewer notes has no index at all. */
    var small = null;
    __vs.views().forEach(function (v) { v.books.forEach(function (b) {
      if (!small && b.notes.length >= 2 && b.notes.length <= 3 && v.shelf.classifier !== "initial" && v.shelf.classifier !== "tag" &&
          years(b) === 1) small = b;
    }); });
    var smallCuts = small ? cutOf(small.id) : null;
    /* design/0034 -- and a cut opens where it says it does: every kid stands at or after its
     * parent, and before the parent that follows it. */
    var nested = true;
    var walk = function (cuts, from, to) {
      cuts.forEach(function (c, i) {
        if (c.at < from || c.at > to) nested = false;
        walk(c.kids, c.at, i + 1 < cuts.length ? cuts[i + 1].at : to);
      });
    };
    walk(tagCuts, 0, tag ? tag.notes.length : 0);
    return { tag: tag ? tag.key : null, tagYears: tag ? years(tag) : 0,
             top: top.length, yearsShown: yearsShown, months: months.length, monthsLook: monthsLook,
             month: month ? month.key : null, monthCuts: plain(monthCuts).map(function (c) { return c.label; }),
             daysOnly: daysOnly, small: small ? small.key : null, nested: nested,
             smallCuts: smallCuts ? smallCuts.length : -1 };
  })()`);
  await putWearBack();
  const ok = (!r.tag || (r.top === r.tagYears && r.yearsShown && r.monthsLook)) &&
             (!r.month || r.daysOnly) && (!r.small || r.smallCuts === 0) && r.nested;
  return {
    ok,
    detail: (r.tag ? `#${r.tag} spans ${r.tagYears} years and gets ${r.top} year cuts ` +
                     `(${r.yearsShown}) with ${r.months} month cuts under them ` +
                     `(${r.monthsLook}), each inside its year (${r.nested}); ` : "no multi-year tag book here; ") +
            (r.month ? `${r.month} is one month, so only days: ${r.monthCuts.slice(0, 6).join(" ")}` +
                       `${r.monthCuts.length > 6 ? " ..." : ""} (${r.daysOnly}); ` : "") +
            (r.small ? `${r.small} holds three notes or fewer and has ${r.smallCuts} cuts` : "")
  };
});

/* github#32, design/0034 */
check("no index cut is clipped, and none is shrunk past reading", async (p) => {
  const original = await p.j("({width:innerWidth,height:innerHeight})");
  const putWearBack = await holdWear(p);

  /* github#57 -- one waiter, in the harness */
  const resize = (width, height) => viewport(p, width, height);
  /* design/0034 -- MEASURED CLOSED AND AT ITS WIDEST FOLD. A rail that fits shut and spills
   * open has not been measured; the fold that draws the most rows is the one to read. */
  const read = () => p.j(`(function(){
    var books = [];
    __vs.views().forEach(function (v) { v.books.forEach(function (b) { books.push(b); }); });
    books = books.filter(function (b) { return b.id.indexOf("favourites/") !== 0; });
    books.sort(function (a, b) { return b.notes.length - a.notes.length; });
    var worst = { clipped: 0, outside: 0, tiny: 0, wide: 0, cropped: 0, book: null, cut: null,
                  minFont: 99, rail: 0, pct: 0, rows: 0, checked: 0, folds: 0, needed: 0,
                  widest: null };
    var gauge = function (b) {
      var nav = document.getElementById("vs-tabs");
      var spread = document.querySelector(".vs-spread");
      var navBox = nav.getBoundingClientRect(), spreadBox = spread.getBoundingClientRect();
      var cuts = [].slice.call(nav.querySelectorAll(".vs-indextab"));
      if (navBox.right > spreadBox.right + 1 || navBox.left < spreadBox.left - 1) worst.outside++;
      if (navBox.width > spreadBox.width / 5) { worst.wide++; }
      worst.rail = Math.max(worst.rail, Math.round(navBox.width));
      worst.pct = Math.max(worst.pct, Math.round(navBox.width / spreadBox.width * 1000) / 10);
      worst.rows = Math.max(worst.rows, cuts.length);
      cuts.forEach(function (t) {
        var r = t.getBoundingClientRect();
        if (r.bottom > navBox.bottom + 1 || r.top < navBox.top - 1 ||
            r.right > navBox.right + 1) { worst.clipped++; worst.book = b.id; }
        var size = parseFloat(getComputedStyle(t).fontSize);
        if (size < 11) { worst.tiny++; worst.book = b.id; }
        worst.minFont = Math.min(worst.minFont, size);
        /* github#32 -- the label has to fit the box, and NOT scrollWidth: a right-aligned cut
         * with hidden overflow crops on the LEFT, which scrollWidth does not report in LTR --
         * it read 48px for both 2015 and 2015-2016. The text's own laid-out rect does. */
        var cs = getComputedStyle(t);
        var room = t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var span = document.createRange();
        span.selectNodeContents(t);
        var want = Math.ceil(span.getBoundingClientRect().width);
        span.detach();
        if (want > room + 0.5) {
          worst.cropped++;
          worst.cut = b.id + " [" + t.textContent + "] wants " + want + "px in " +
                      Math.round(room) + "px";
        }
        if (want > worst.needed) { worst.needed = want; worst.widest = t.textContent; }
      });
    };
    books.slice(0, 14).forEach(function (b) {
      __vs.openBook(b.id, null);
      worst.checked++;
      gauge(b);
      /* github#32 -- DOWN TO THE BOTTOM, not one level. The deepest trail is where the labels
       * have least room -- every notch takes another 6px off them -- so a check that opens one
       * fold measures the easy case and calls the rail fitted. */
      for (var down = 0; down < 3; down++) {
        var opens = [].slice.call(document.querySelectorAll("#vs-tabs .vs-indextab"))
          .filter(function (t) { return t.getAttribute("data-opens") === "1"; });
        if (!opens.length) break;
        var widest = opens[0], most = -1;
        opens.forEach(function (t) {
          var says = (t.getAttribute("aria-label") || "").match(/opens (\\d+) more/);
          var n = says ? Number(says[1]) : 0;
          if (n > most) { most = n; widest = t; }
        });
        widest.click();
        worst.folds++;
        gauge(b);
      }
      __vs.closeReader();
    });
    return worst;
  })()`);
  /* github#32, github#57 -- clear it, never re-set it to the size it had */
  const restore = () => unviewport(p, original);
  let tall, short;
  try {
    await resize(1180, 1000); tall = await read();
    await resize(1180, 480);  short = await read();
  } finally {
    await p.eval("__vs.closeReader();");
    await restore();
    await putWearBack();
  }
  const clean = (r) => !r.clipped && !r.outside && !r.tiny && !r.wide && !r.cropped;
  const say = (n, r) => `${n}: ${r.checked} books (${r.folds} folded), ${r.clipped} clipped, ` +
    `${r.outside} outside the spread, ${r.wide} over a fifth of it, ${r.tiny} under 11px ` +
    `(smallest ${r.minFont}px), ${r.cropped} with the label cropped, rail ${r.rail}px = ` +
    `${r.pct}%, most cuts on show ${r.rows}, widest label "${r.widest}" at ${r.needed}px` +
    (r.book ? ` -- worst ${r.book}` : "") + (r.cut ? ` -- ${r.cut}` : "");
  return { ok: clean(tall) && clean(short), detail: say("1180x1000", tall) + "; " + say("1180x480", short) };
});

/* github#32, design/0034 */
check("one cut is lit, and it is the deepest the page has reached", async (p) => {
  const putWearBack = await holdWear(p);
  const r = await p.j(`(function(){
    var books = [];
    __vs.views().forEach(function (v) { v.books.forEach(function (b) { books.push(b); }); });
    books = books.filter(function (b) { return b.id.indexOf("favourites/") !== 0 && b.notes.length > 8; });
    books.sort(function (a, b) { return b.notes.length - a.notes.length; });
    var worst = 0, over = 0, checked = 0, wrong = null, litAtEnd = 0;
    books.slice(0, 14).forEach(function (b) {
      [0, Math.floor(b.notes.length / 2), b.notes.length - 1].forEach(function (i) {
        __vs.openBook(b.id, b.notes[i].id);
        var lit = [].slice.call(document.querySelectorAll('#vs-tabs .vs-indextab[aria-current="true"]'));
        checked++;
        if (lit.length > worst) worst = lit.length;
        if (lit.length > 1) { over++; wrong = b.id; }
        if (i === b.notes.length - 1 && lit.length === 1) litAtEnd++;
        /* The lit cut is at or before the page, and the next one is past it. */
        if (lit.length === 1) {
          var all = [].slice.call(document.querySelectorAll("#vs-tabs .vs-indextab"));
          var k = all.indexOf(lit[0]);
          var after = all[k + 1];
          if (Number(lit[0].getAttribute("data-at")) > i ||
              (after && !after.classList.contains("vs-trailstep") &&
               Number(after.getAttribute("data-at")) <= i)) { over++; wrong = b.id + " @" + i; }
        }
      });
      __vs.closeReader();
    });
    return { worst: worst, over: over, checked: checked, wrong: wrong, litAtEnd: litAtEnd };
  })()`);
  await putWearBack();
  return { ok: r.worst <= 1 && r.over === 0 && r.litAtEnd > 0,
           detail: `${r.checked} openings across 14 books: most lit at once ${r.worst}, ` +
                   `${r.over} wrong${r.wrong ? " (" + r.wrong + ")" : ""}, ` +
                   `${r.litAtEnd} of 14 lit exactly one at the last note` };
});

/* github#32, design/0034 */
check("the rail lists one level under the trail it came through", async (p) => {
  const putWearBack = await holdWear(p);
  const r = await p.j(`(function(){
    var books = [];
    __vs.views().forEach(function (v) { v.books.forEach(function (b) { books.push(b); }); });
    books = books.filter(function (b) { return b.id.indexOf("favourites/") !== 0; });
    books.sort(function (a, b) { return b.notes.length - a.notes.length; });
    var rows = function () {
      return [].slice.call(document.querySelectorAll("#vs-tabs .vs-indextab")).map(function (t) {
        var r = t.getBoundingClientRect();
        return { label: t.textContent, at: Number(t.getAttribute("data-at")),
                 trail: t.classList.contains("vs-trailstep"),
                 back: t.getAttribute("data-back") === "1",
                 opens: t.getAttribute("data-opens") === "1", right: Math.round(r.right) };
      });
    };
    var found = null;
    for (var i = 0; i < books.length && !found; i++) {
      __vs.openBook(books[i].id, null);
      var cuts = __vs.indexTabs().cuts;
      var best = null;
      cuts.forEach(function (c) { if (!best || c.kids.length > best.kids.length) best = c; });
      if (!best || best.kids.length < 2) { __vs.closeReader(); continue; }
      var before = rows();
      var button = [].slice.call(document.querySelectorAll("#vs-tabs .vs-indextab"))
        .filter(function (t) { return Number(t.getAttribute("data-at")) === best.at; })[0];
      if (!button) { __vs.closeReader(); continue; }
      /* design/0034 -- pressing a cut GOES there as well as opening it: a tab is a position. */
      button.click();
      /* design/0034 -- the press rebuilds the rail, so the cut has to be handed its focus
       * back: without it Enter on a year opened the fold and focused nothing. */
      var kept = document.activeElement &&
        Number(document.activeElement.getAttribute("data-at")) === best.at;
      var open = rows();
      var trail = open.filter(function (r) { return r.trail; });
      var level = open.filter(function (r) { return !r.trail; });
      var moved = __vs.reader().index;
      /* And pressing the trail step is the way back. */
      var step = [].slice.call(document.querySelectorAll("#vs-tabs .vs-trailstep"))[0];
      step.click();
      var back = rows();
      found = {
        book: books[i].id,
        top: before.length, kids: best.kids.length, level: level.length,
        trail: trail.length,
        trailIsBack: trail.every(function (r) { return r.back && !r.opens; }),
        /* The staircase: every trail step stands further in than the level it opened. */
        staircase: trail.every(function (r) { return r.right < level[0].right; }),
        wentThere: moved === best.at, kept: kept,
        cameBack: back.length === before.length &&
                  back.every(function (r, k) { return r.at === before[k].at; })
      };
      __vs.closeReader();
    }
    return found;
  })()`);
  await putWearBack();
  if (!r) return { ok: false, detail: "no book here has a cut with anything under it" };
  return { ok: r.level === r.kids && r.trail === 1 && r.trailIsBack && r.staircase &&
               r.wentThere && r.cameBack && r.kept,
           detail: `${r.book}: ${r.top} cuts at the top; pressing the one with ${r.kids} under it ` +
                   `shows ${r.level} of them (went to its note: ${r.wentThere}) under ${r.trail} ` +
                   `trail step marked back (${r.trailIsBack}) and stepped in (${r.staircase}), keeping the focus (${r.kept}); ` +
                   `pressing it comes back (${r.cameBack})` };
});

/* github#32, design/0034 -- it asserts the FOLD, not the cuts: 15 cuts was already true and
 * already useless, while 0 of them opened and 587 notes sat behind `2026`. */
check("a numeric volume is indexed like a date book, not stopped at its years", async (p) => {
  const putWearBack = await holdWear(p);
  const r = await p.j(`(function(){
    var book = null;
    __vs.views().forEach(function (v) { v.books.forEach(function (b) {
      if (b.id.indexOf("encyclopedia/") === 0 && b.key === "0-9") book = b;
    }); });
    if (!book) return null;
    __vs.openBook(book.id, null);
    var cuts = __vs.indexTabs().cuts;
    /* Every cut's own size, from where the next one starts -- the tree carries positions. */
    var sizeOf = function (list, total) {
      return list.map(function (c, i) {
        return { cut: c, size: (i + 1 < list.length ? list[i + 1].at : total) - c.at };
      });
    };
    var top = sizeOf(cuts, book.notes.length);
    var years = top.filter(function (t) { return /^\\d{4}$/.test(t.cut.label); });
    var fat = top.filter(function (t) { return t.size > 3; });
    var dead = fat.filter(function (t) { return !t.cut.kids.length; })
                  .sort(function (a, b) { return b.size - a.size; })[0];
    /* The fattest year, and the fattest month under it. */
    /* github#32 -- the digit run the generator plants: twelve digits opening with a plausible
     * year, which must stay in the numeric bucket rather than being filed under 2022. */
    var runAt = -1;
    book.notes.forEach(function (n, i) { if (n.title === "202212331243") runAt = i; });
    var holder = null;
    top.forEach(function (t) { if (runAt >= t.cut.at && runAt < t.cut.at + t.size) holder = t; });
    var year = years.sort(function (a, b) { return b.size - a.size; })[0];
    var months = year ? sizeOf(year.cut.kids, year.cut.at + year.size) : [];
    var month = months.slice().sort(function (a, b) { return b.size - a.size; })[0];
    __vs.closeReader();
    return {
      runAt: runAt, runCut: holder ? holder.cut.label : null,
      runKids: holder ? holder.cut.kids.length : -1,
      notes: book.notes.length, top: top.length, years: years.length,
      fat: fat.length, opened: fat.filter(function (t) { return t.cut.kids.length; }).length,
      deadLabel: dead ? dead.cut.label : null, deadSize: dead ? dead.size : 0,
      year: year ? year.cut.label : null, yearSize: year ? year.size : 0,
      months: months.length,
      monthsNamed: months.every(function (m) { return /^[A-Z][a-z]{2}$/.test(m.cut.label); }),
      monthsInside: months.every(function (m) {
        return m.cut.at >= year.cut.at && m.cut.at < year.cut.at + year.size; }),
      month: month ? month.cut.label : null, monthSize: month ? month.size : 0,
      days: month ? month.cut.kids.length : 0,
      daysNamed: month ? month.cut.kids.every(function (d) { return /^\\d{2}$/.test(d.label); }) : false
    };
  })()`);
  await putWearBack();
  if (!r) return { ok: false, detail: "this vault has no 0-9 volume" };
  /* design/0034 -- the `0-9` bucket is the one fat cut that may not open: a numeric title that
   * is not a year has nothing under it to cut by. */
  return { ok: r.years >= 2 && r.opened === r.fat - (r.deadLabel === "0-9" ? 1 : 0) &&
               r.months >= 2 && r.monthsNamed && r.monthsInside && r.days >= 2 && r.daysNamed &&
               r.deadSize < 20 && r.runAt >= 0 && r.runCut === "2022\u00b7" && r.runKids === 0,
           detail: `202212331243 sits under "${r.runCut}" with ${r.runKids} under it, not in a ` +
                   `year (found at ${r.runAt}); ` +
                   `0-9 holds ${r.notes} notes behind ${r.top} cuts, ${r.years} of them years; ` +
                   `${r.opened} of ${r.fat} fat cuts open (was 0 of 15). ` +
                   `${r.year} (${r.yearSize} notes) opens into ${r.months} months ` +
                   `named Mmm (${r.monthsNamed}) and inside it (${r.monthsInside}); ` +
                   `${r.month} (${r.monthSize}) opens into ${r.days} days named dd (${r.daysNamed}); ` +
                   `biggest dead end ${r.deadLabel} x${r.deadSize} (was 2026 x587)` };
});

/* github#70, design/0035 */
check("a volume of numbers reads by number, and only such a volume is offered it", async (p) => {
  const putWearBack = await holdWear(p);
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore, settings = __vs.settings();
    var saved = JSON.parse(JSON.stringify(settings));
    var numberOf = function (title) {
      var run = core.leadingNumber(title);
      return run ? run.replace(/^0+(?=\\d)/, "") : null;
    };
    try {
      var enc = __vs.views().filter(function (v) { return v.shelf.id === "encyclopedia"; })[0];
      var digits = enc.books.filter(function (b) { return b.key === "0-9"; })[0];
      var letters = enc.books.filter(function (b) { return b.key !== "0-9" && b.key !== "#"; })
        .sort(function (a, b) { return b.notes.length - a.notes.length; })[0];
      if (!digits || !letters) return null;

      /* 0, 3, 7, 12, 24, 1000, 2015, ... -- longer is bigger, and same length compares. */
      var numbers = digits.notes.map(function (n) { return numberOf(n.title); });
      var rising = numbers.every(function (v, i) {
        if (v === null) return false;
        if (i === 0) return true;
        var was = numbers[i - 1];
        return was.length !== v.length ? was.length < v.length : was <= v;
      });

      /* Read BEFORE the toggle saves a mode: a fresh library has none, so this is the
       * automatic answer, and neither button was pressed until it learned number. */
      var picker = function (id) {
        document.querySelector('[data-book="' + id + '"]')
          .dispatchEvent(new MouseEvent("contextmenu", {bubbles:true,clientX:300,clientY:300}));
        var out = [].map.call(document.querySelectorAll("#vs-dye .vs-indexbuttons button"),
          function (b) { return b.dataset.indexMode + (b.getAttribute("aria-pressed") === "true" ? "!" : ""); });
        document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}));
        return out.join(",");
      };
      var digitPicker = picker(digits.id);

      __vs.openBook(digits.id, null);
      var toggle = document.querySelector(".vs-indextoggle");
      var face = toggle.textContent;
      var box = toggle.getBoundingClientRect();
      /* Not only cropped: a face too long WRAPS, which fits every width it is measured by. */
      var cropped = Math.max(toggle.scrollWidth - Math.ceil(box.width),
                             toggle.scrollHeight - Math.ceil(box.height));
      var faceBox = Math.round(box.width) + "x" + Math.round(box.height);
      var mode = toggle.getAttribute("data-index-mode");
      var cuts = __vs.indexTabs().cuts.map(function (c) { return c.label; });
      var numbered = cuts.every(function (label) { return /^\\d{1,4}\\u00b7?$/.test(label); });
      toggle.click();
      var toDate = document.querySelector(".vs-indextoggle").getAttribute("data-index-mode");
      document.querySelector(".vs-indextoggle").click();
      var back = document.querySelector(".vs-indextoggle").getAttribute("data-index-mode");
      __vs.closeReader();

      __vs.openBook(letters.id, null);
      var letterToggle = document.querySelector(".vs-indextoggle");
      var letterMode = letterToggle.getAttribute("data-index-mode");
      var letterBox = letterToggle.getBoundingClientRect();
      var sameBox = Math.round(letterBox.width) === Math.round(box.width) &&
                    Math.round(letterBox.height) === Math.round(box.height);
      __vs.closeReader();
      var offered = picker(letters.id);

      var blob = JSON.parse(JSON.stringify(settings));
      var shelf = blob.shelves.filter(function (s) { return s.id === "encyclopedia"; })[0];
      shelf.bookIndexes = { "0-9": "number", "A": "spiral" };
      var kept = core.migrate(blob).shelves
        .filter(function (s) { return s.id === "encyclopedia"; })[0].bookIndexes;

      return { notes: digits.notes.length, rising: rising,
               opens: numbers.slice(0, 6).join(" "), last: numbers[numbers.length - 1],
               face: face, cropped: cropped, faceBox: faceBox, sameBox: sameBox,
               mode: mode, toDate: toDate, back: back,
               cuts: cuts.length, numbered: numbered, sample: cuts.slice(0, 8).join(" "),
               letterKey: letters.key, letterMode: letterMode,
               offered: offered, digitPicker: digitPicker,
               numericDigits: core.numericBook(digits.notes),
               numericLetters: core.numericBook(letters.notes),
               keptNumber: kept["0-9"] === "number", droppedUnknown: !("A" in kept) };
    } finally { __vs.closeReader(); Object.assign(settings, saved); __vs.setFilters({}); }
  })()`);
  await putWearBack();
  if (!r) return { ok: false, detail: "this vault has no 0-9 volume to read" };
  /* design/0034 */
  const ok = r.rising && r.mode === "number" && r.toDate === "date" && r.back === "number" &&
             r.numbered && r.cropped <= 0 && r.sameBox && r.letterMode === "az" &&
             r.offered === "az!,date" && r.digitPicker === "number!,date" &&
             r.numericDigits && !r.numericLetters && r.keptNumber && r.droppedUnknown;
  return { ok, detail:
    `the 0-9 volume's ${r.notes} notes open ${r.opens} and end ${r.last}, never stepping ` +
    `back: ${r.rising}; its face reads "${r.face}" in ${r.faceBox} with ${r.cropped}px over ` +
    `the box and the lettered volume's box (${r.sameBox}), over ` +
    `${r.cuts} cuts (${r.sample}), every one a number: ${r.numbered}; the toggle runs ` +
    `${r.mode} -> ${r.toDate} -> ${r.back} and its picker offers ${r.digitPicker} ` +
    `(! is pressed); volume ${r.letterKey} stays ${r.letterMode} and is offered ` +
    `${r.offered}; migration keeps number (${r.keptNumber}) and drops an unknown mode ` +
    `(${r.droppedUnknown})` };
});

/* design/0032 */
check("index tabs compress without scrolling and shelf icons edit and hide", async (p) => {
  const original = await p.j("({width:innerWidth,height:innerHeight})");
  /* github#57 -- one waiter, in the harness */
  const resize = (width, height) => viewport(p, width, height);
  const read = () => p.j(`(function(){
    var nav=document.getElementById('vs-tabs'), bounds=nav.getBoundingClientRect();
    var tabs=Array.from(nav.querySelectorAll('.vs-indextab'));
    return {count:tabs.length, height:tabs[0].getBoundingClientRect().height,
      fits:tabs.every(function(t){var r=t.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom+1;}),
      scroll:nav.scrollHeight-nav.clientHeight, width:bounds.width,
      controls:Array.from(nav.querySelectorAll('.vs-findtab,.vs-indextoggle')).map(function(t){var r=t.getBoundingClientRect();return [r.width,r.height,getComputedStyle(t).fontSize];})};
  })()`);
  let tall, short, date, icons;
  await p.eval(`window.__savedIndexSettings=JSON.parse(JSON.stringify(__vs.settings()));`);
  try {
    icons=await p.j(`(function(){
      var shelf=__vs.settings().shelves.find(function(s){return s.id==='tags';});
      var before=JSON.stringify(shelf), head=document.querySelector('[data-shelf="tags"] .vs-shelfhead');
      var meta=head.querySelector('.vs-meta'), buttons=Array.from(meta.querySelectorAll('button'));
      var style=getComputedStyle(meta);
      var matched=buttons.every(function(b){var s=getComputedStyle(b), r=b.querySelector('svg').getBoundingClientRect();return s.color===style.color&&s.fontSize===style.fontSize&&s.visibility==='visible'&&s.opacity==='1'&&r.width===12&&r.height===12;});
      var dots=buttons.every(function(b){return b.previousSibling.textContent.trim()==='\u00b7';});
      buttons[0].click();var edits=document.getElementById('vs-bname').value===shelf.name;
      document.getElementById('vs-bcancel').click();buttons[1].click();
      var hides=shelf.hidden&&!document.querySelector('[data-shelf="tags"]');
      shelf.hidden=JSON.parse(before).hidden;var keeps=JSON.stringify(shelf)===before;__vs.setFilters({});
      var books=__vs.views().find(function(v){return v.shelf.id==='tags';}).books.slice();books.sort(function(a,b){return b.notes.length-a.notes.length;});
      __vs.openBook(books[0].id,null);
      if(document.querySelector('.vs-indextoggle').dataset.indexMode!=='az')document.querySelector('.vs-indextoggle').click();
      return {count:buttons.length,matched:matched,dots:dots,edits:edits,hides:hides,keeps:keeps};
    })()`);
    await resize(1180,1000);
    tall=await read();
    await resize(1180,480);
    short=await read();
    await p.eval(`document.querySelector('.vs-indextoggle').click();`);
    date=await read();
  } finally {
    await p.eval(`__vs.closeReader();Object.assign(__vs.settings(),window.__savedIndexSettings);delete window.__savedIndexSettings;__vs.setFilters({});`);
    await resize(original.width,original.height);
  }
  return {ok:icons.count===2&&['matched','dots','edits','hides','keeps'].every(k=>icons[k])&&
    [tall,short,date].every(r=>r.count>0&&r.fits&&r.scroll<=1&&r.width===60)&&short.height<=tall.height&&
    JSON.stringify(tall.controls)===JSON.stringify(short.controls)&&JSON.stringify(short.controls)===JSON.stringify(date.controls),
    detail:JSON.stringify({icons,tall,short,date,restored:await p.j("({width:innerWidth,height:innerHeight,pending:__vs.room().pending})"),original})};
});

check("the reader's index tabs stay countable on the biggest book", async (p) => {
  const r = await p.j(`(function(){
    var biggest = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!biggest || b.notes.length > biggest.notes.length) biggest = b; });
    });
    __vs.openBook(biggest.id, null);
    var out = { book: biggest.id, notes: biggest.notes.length,
                tabs: document.querySelectorAll("#vs-tabs button:not(.vs-findtab):not(.vs-indextoggle)").length };
    /* github#39 -- close it, or it paints over the library for the next check */
    __vs.closeReader();
    return out;
  })()`);
  /* github#32, design/0034 -- what bounds the rail is what fits in it, and the deeper cuts
   * are a press away rather than dropped. 26 was a number standing in for the measurement. */
  return { ok: r.tabs > 0 && r.tabs <= 40,
           detail: `${r.book} holds ${r.notes} notes behind ${r.tabs} cuts on show (ceiling 40)` };
});

/* design/0027 */
check("opening a searched book reveals its first matching contents row without changing the note", async (p) => {
  const saved = await p.j("__vs.settings()");
  const read = () => p.j(`(function(){
    var page = document.querySelector('.vs-page.vs-left');
    var rows = Array.from(document.querySelectorAll('#vs-contents button'));
    var first = rows.find(function (row) { return row.dataset.match === '1'; });
    var current = rows.find(function (row) { return row.getAttribute('aria-current') === 'true'; });
    var box = page.getBoundingClientRect();
    var inside = function (row) { var r = row && row.getBoundingClientRect();
      return !!r && r.top >= box.top && r.bottom <= box.bottom; };
    return { top: Math.round(page.scrollTop), first: rows.indexOf(first), hitInside: inside(first),
      currentInside: inside(current), note: __vs.reader().note, index: __vs.reader().index,
      rightTop: document.querySelector('.vs-page.vs-right').scrollTop };
  })()`);
  const settled = async (visible) => {
    const began = Date.now();
    let last, firstTop, stable = 0;
    for (let i = 0; i < 60; i++) {
      const now = await read();
      if (firstTop === undefined) firstTop = now.top;
      stable = last && now.top === last.top ? stable + 1 : 0;
      if (stable >= 3 && now[visible]) return { ...now, firstTop, waitedMs: Date.now() - began };
      last = now;
      await sleep(50);
    }
    return last;
  };
  const results = [];
  try {
    for (const mode of ["date", "az"]) {
      const pick = await p.j(`(function(){
        __vs.closeReader(); __vs.setQuery('');
        var settings = ${JSON.stringify(saved)};
        settings.shelves.forEach(function (s) { s.indexMode = ${JSON.stringify(mode)}; delete s.bookIndexes; });
        Object.assign(__vs.settings(), settings); __vs.setFilters({});
        var core = window.VaultShelfCore, views = __vs.views();
        var books = views.filter(function (v) { return !v.shelf.hidden && v.shelf.classifier !== 'pick'; })
          .flatMap(function (v) { return v.books; }).sort(function (a,b) { return b.notes.length-a.notes.length; });
        var book = books[0], index = core.buildSearchIndex(views, __vs.data().notes), pick;
        for (var i = Math.floor(book.notes.length/2); i < book.notes.length; i++) {
          var query = book.notes[i].title;
          var at = book.notes.findIndex(function (n) { return core.matchesQuery(n, query.toLowerCase(), index); });
          if (at > 60) { pick = { book: book.id, query: query, at: at, oldest: book.notes[0].id }; break; }
        }
        if (!pick) return null;
        __vs.setQuery(pick.query); __vs.openBook(pick.book, null);
        return pick;
      })()`);
      if (!pick) return { ok: false, detail: mode + " has no offscreen first match to measure" };
      const open = await settled("hitInside");
      if (SHOT && mode === "date") {
        const shot = await p.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        writeFileSync(SHOT.replace(/\.png$/i, "-first-match.png"), Buffer.from(shot.data, "base64"));
      }
      await p.eval("document.getElementById('vs-nextnote').click(); void 0");
      const next = await settled("currentInside");
      await p.eval(`__vs.setQuery('__no_such_catalogue_term__'); __vs.setQuery(${JSON.stringify(pick.query)}); void 0`);
      const query = await settled("currentInside");
      await p.eval(`__vs.openBook(${JSON.stringify(pick.book)}, ${JSON.stringify(pick.oldest)}); void 0`);
      const explicit = await settled("currentInside");
      const fallback = [];
      for (const needle of ["__no_such_catalogue_term__", ""]) {
        await p.eval(`__vs.closeReader(); __vs.setQuery(${JSON.stringify(needle)}); __vs.openBook(${JSON.stringify(pick.book)}, null); void 0`);
        fallback.push(await settled("currentInside"));
      }
      results.push({ mode, at: pick.at, open, next, query, explicit, fallback,
        ok: open.first === pick.at && open.hitInside && open.top > 0 && open.note === pick.oldest && open.rightTop === 0 &&
          next.index === 1 && next.currentInside && !next.hitInside && query.top === next.top && query.note === next.note &&
          explicit.note === pick.oldest && explicit.currentInside && !explicit.hitInside &&
          fallback.every((r) => r.first === -1 && r.index === 0 && r.note === pick.oldest && r.currentInside) });
    }
  } finally {
    await p.eval(`__vs.closeReader(); __vs.setQuery(''); Object.assign(__vs.settings(), ${JSON.stringify(saved)}); __vs.setFilters({}); void 0`);
  }
  return { ok: results.every((r) => r.ok), detail: JSON.stringify(results) };
});

/* github#11, design/0015 */
check("the contents scroll to the current row after a tab, Previous and a ribbon", async (p) => {
  const read = () => p.j(`(function(){
    var page = document.querySelector(".vs-page.vs-left");
    var rows = [].slice.call(document.querySelectorAll("#vs-contents button"));
    var marked = rows.filter(function (b) { return b.getAttribute("aria-current") === "true"; });
    var pb = page.getBoundingClientRect(), rb = marked.length ? marked[0].getBoundingClientRect() : null;
    return { scrollTop: Math.round(page.scrollTop), overflows: page.scrollHeight > page.clientHeight + 1,
             marked: marked.length, markedAt: marked.length ? rows.indexOf(marked[0]) : -1,
             inside: !!rb && rb.top >= pb.top - 0.5 && rb.bottom <= pb.bottom + 0.5,
             index: __vs.reader().index };
  })()`);
  /* github#11 */
  const measure = async () => {
    let last = null;
    for (let i = 0; i < 60; i++) {
      const now = await read();
      if (last && now.inside && now.scrollTop === last.scrollTop) return now;
      last = now;
      await sleep(50);
    }
    return last;
  };
  const opened = await p.j(`(function(){
    var biggest = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!biggest || b.notes.length > biggest.notes.length) biggest = b; });
    });
    __vs.openBook(biggest.id, null);
    var tabs = document.querySelectorAll("#vs-tabs button");
    return { book: biggest.id, notes: biggest.notes.length, tabs: tabs.length,
             scrollTop: Math.round(document.querySelector(".vs-page.vs-left").scrollTop) };
  })()`);
  if (opened.tabs < 2) return { ok: false, detail: `${opened.book} has ${opened.tabs} tab(s); nothing to jump to` };

  const named = await p.j(`(function(){
    var tabs = document.querySelectorAll("#vs-tabs button");
    var tab = tabs[tabs.length - 1];
    tab.click();
    return { label: tab.textContent, index: __vs.reader().index };
  })()`);
  const tab = await measure();
  await p.eval('document.getElementById("vs-prevnote").click(); void 0');
  const prev = await measure();
  const ribbon = await p.j(`(function(){
    var book = __vs.reader().book;
    __vs.openBook(book, null);
    var stub = document.querySelector("#vs-marks .vs-markstub");
    var already = !stub;
    if (stub) stub.click();
    var tabs = document.querySelectorAll("#vs-tabs button");
    tabs[tabs.length - 1].click();
    var far = Math.round(document.querySelector(".vs-page.vs-left").scrollTop);
    var marks = [].slice.call(document.querySelectorAll("#vs-marks .vs-mark"))
      .filter(function (b) { return b.getAttribute("aria-current") !== "true"; });
    if (marks.length) marks[0].click();
    return { far: far, hadRibbon: marks.length > 0, already: already };
  })()`);
  const back = await measure();
  if (!ribbon.already) {
    await p.j(`(function(){
      var mine = document.querySelector('#vs-marks .vs-mark[aria-current="true"]');
      if (mine) mine.click();
      return 1;
    })()`);
  }
  await p.eval("__vs.closeReader(); void 0");

  const one = (m, at) => m.marked === 1 && m.markedAt === at && m.inside;
  const moved = !opened.overflows || tab.scrollTop > opened.scrollTop;
  const ok = one(tab, named.index) && one(prev, named.index - 1) && ribbon.hadRibbon &&
             one(back, 0) && moved && (!tab.overflows || back.scrollTop < ribbon.far);
  return { ok,
           detail: `${opened.book} (${opened.notes} notes, ${opened.tabs} tabs, ` +
                   `${tab.overflows ? "contents overflow" : "contents fit"}): ` +
                   `tab "${named.label.trim()}" -> row ${named.index}, scrollTop ${opened.scrollTop} -> ${tab.scrollTop}, ` +
                   `marked ${tab.marked} row(s) at ${tab.markedAt}, inside ${tab.inside}; ` +
                   `Previous -> row ${prev.index}, scrollTop ${prev.scrollTop}, inside ${prev.inside}; ` +
                   `ribbon from scrollTop ${ribbon.far} -> row ${back.index}, scrollTop ${back.scrollTop}, inside ${back.inside}` };
});

/* github#46, design/0026 */
check("clicking a row in the index moves the mark and leaves the index where it stood", async (p) => {
  const opened = await p.j(`(function(){
    var biggest = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) { if (!biggest || b.notes.length > biggest.notes.length) biggest = b; });
    });
    __vs.openBook(biggest.id, null);
    var page = document.querySelector("#vs-reader .vs-page.vs-left");
    /* github#46 -- halfway down a long index, where the report came from */
    var span = Math.max(0, page.scrollHeight - page.clientHeight);
    page.scrollTop = Math.round(span / 2);
    var rows = [].slice.call(document.querySelectorAll("#vs-contents button"));
    /* github#46 -- a row back without its stamp was replaced */
    rows.forEach(function (b, k) { b.__vs46 = k; });
    /* github#46 -- a part-visible row is nudged in by the press's own focus */
    var pb = page.getBoundingClientRect();
    var mid = pb.top + pb.height / 2;
    var want = -1, best = Infinity, spot = null;
    rows.forEach(function (b, k) {
      var r = b.getBoundingClientRect();
      if (r.top < pb.top + r.height || r.bottom > pb.bottom - r.height) return;
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < best) {
        best = d; want = k;
        spot = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }
    });
    return { book: biggest.id, notes: biggest.notes.length, span: span,
             at: Math.round(page.scrollTop), rows: rows.length, want: want, spot: spot,
             markedAt: rows.indexOf(document.querySelector('#vs-contents button[aria-current="true"]')) };
  })()`);
  if (opened.span < 40 || opened.want < 1 || !opened.spot) {
    return { ok: false,
             detail: `${opened.book} (${opened.notes} notes, ${opened.rows} rows) gives an index ` +
                     `that scrolls ${opened.span}px with row ${opened.want} in the middle -- ` +
                     `nothing here to hold still` };
  }
  /* design/0026 -- why element.click() measures this clean on broken code */
  const top = () =>
    p.j(`Math.round(document.querySelector("#vs-reader .vs-page.vs-left").scrollTop)`);
  const press = (type) => p.send("Input.dispatchMouseEvent",
    { type, x: opened.spot.x, y: opened.spot.y, button: "left", clickCount: 1 });
  await press("mousePressed");
  const pressed = await top();
  await press("mouseReleased");
  const released = await top();
  /* github#46 -- a wrong baseline animates; let it finish */
  await sleep(600);
  const after = await p.j(`(function(){
    var page = document.querySelector("#vs-reader .vs-page.vs-left");
    var rows = [].slice.call(document.querySelectorAll("#vs-contents button"));
    return { at: Math.round(page.scrollTop), rows: rows.length,
             markedAt: rows.indexOf(document.querySelector('#vs-contents button[aria-current="true"]')),
             kept: rows.filter(function (b, k) { return b.__vs46 === k; }).length,
             index: __vs.reader().index };
  })()`);
  await p.eval("__vs.closeReader(); void 0");

  const held = [pressed, released, after.at].every((v) => Math.abs(v - opened.at) <= 1);
  const sameRows = after.rows === opened.rows && after.kept === opened.rows;
  const ok = held && sameRows && after.markedAt === opened.want && after.index === opened.want;
  return { ok,
           detail: `${opened.book} (${opened.notes} notes, ${opened.rows} rows, index scrolls ` +
                   `${opened.span}px): a press on row ${opened.want} at scrollTop ${opened.at} ` +
                   `left it at ${pressed} pressed, ${released} released and ${after.at} settled ` +
                   `(held ${held}); the mark moved ${opened.markedAt} -> ${after.markedAt} and ` +
                   `the reader to note ${after.index}; ${after.kept} of ${opened.rows} rows are ` +
                   `the same nodes (rebuilt ${!sameRows})` };
});

check("previous and next walk the book and stop at its ends", async (p) => {
  const r = await p.j(`(function(){
    /* github#17 -- the SMALLEST book with three notes, not the first: this walks a click at a
     * time, and the first is encyclopedia/0-9 at 2,097 notes, a measured 78-second walk. */
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (b.notes.length >= 3 && (!book || b.notes.length < book.notes.length)) book = b;
      });
    });
    if (!book) return { found: false };
    __vs.openBook(book.id, null);
    var first = __vs.reader().index;
    var prevDisabled = document.getElementById("vs-prevnote").disabled;
    document.getElementById("vs-nextnote").click();
    var second = __vs.reader().index;
    for (var i = 0; i < book.notes.length + 4; i++) document.getElementById("vs-nextnote").click();
    var last = __vs.reader().index;
    var out = { found: true, first: first, prevDisabled: prevDisabled, second: second,
                last: last, size: book.notes.length,
                nextDisabled: document.getElementById("vs-nextnote").disabled };
    /* github#39 -- close it, or it paints over the library for the next check */
    __vs.closeReader();
    return out;
  })()`);
  if (!r.found) return { ok: false, detail: "no book with three notes in this vault" };
  return { ok: r.first === 0 && r.prevDisabled && r.second === 1 &&
               r.last === r.size - 1 && r.nextDisabled,
           detail: `opened at ${r.first} (previous disabled: ${r.prevDisabled}), next -> ${r.second}, ` +
                   `ran to ${r.last} of ${r.size - 1} and stopped (next disabled: ${r.nextDisabled})` };
});

/* github#36, design/0025 -- the turn, and what it does not take */
check("the turn sits under the spread, says the place, and yields to a caret", async (p) => {
  const r = await p.j(`(function(){
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (b.notes.length >= 3 && (!book || b.notes.length < book.notes.length)) book = b;
      });
    });
    if (!book) return { found: false };
    __vs.openBook(book.id, null);
    var place = function () { return document.getElementById("vs-place").textContent; };
    var spread = document.querySelector(".vs-spread").getBoundingClientRect();
    var turn = document.querySelector(".vs-turn").getBoundingClientRect();
    var first = place();
    document.getElementById("vs-nextnote").click();
    var second = place();
    var at = __vs.reader().index;

    /* github#36 -- an arrow key in the find field moves the caret, not the book */
    var within = document.getElementById("vs-within");
    within.focus();
    within.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    var afterTyping = __vs.reader().index;

    /* github#36 -- and outside one it still turns the page */
    document.getElementById("vs-reader").focus();
    document.getElementById("vs-reader")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    var afterKey = __vs.reader().index;

    var out = { found: true, first: first, second: second, at: at,
                afterTyping: afterTyping, afterKey: afterKey, size: book.notes.length,
                below: Math.round(turn.top - spread.bottom),
                lined: Math.round(turn.left - spread.left) === 0 &&
                       Math.round(turn.width - spread.width) === 0 };
    /* github#39 */
    __vs.closeReader();
    return out;
  })()`);
  if (!r.found) return { ok: false, detail: "no book with three notes in this vault" };
  const ok = r.first === `1 of ${r.size}` && r.second === `2 of ${r.size}` && r.at === 1 &&
             r.afterTyping === 1 && r.afterKey === 0 && r.below >= 0 && r.below <= 40 && r.lined;
  return { ok,
           detail: `the place read ${JSON.stringify(r.first)} then ${JSON.stringify(r.second)} ` +
                   `over ${r.size} notes; the turn sits ${r.below}px under the spread and is ` +
                   `lined up with it (${r.lined}); an arrow key in the find field left the ` +
                   `reader at ${r.afterTyping}, and one outside it turned back to ${r.afterKey}` };
});

/* github#40, design/0028 -- a synthetic wheel does not scroll; these apply it by hand */
const PUSH_HELPERS = `(function(){
  window.__push = {
    right: function () { return document.querySelector("#vs-reader .vs-page.vs-right"); },
    left: function () { return document.querySelector("#vs-reader .vs-page.vs-left"); },
    wheel: function (el, dy, n) {
      for (var i = 0; i < (n || 1); i++) {
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, deltaMode: 0,
                                                   bubbles: true, cancelable: true }));
      }
    },
    /* the smallest book with at least this many notes, so a turn has somewhere to go */
    bookOf: function (min) {
      var found = null;
      __vs.views().forEach(function (v) { v.books.forEach(function (b) {
        if (b.notes.length >= min && (!found || b.notes.length < found.notes.length)) found = b;
      }); });
      return found;
    },
    /* A NOTE THAT ACTUALLY OVERFLOWS, because "arrived at the bottom" is only provable on a
     * page with a bottom to arrive at -- and most of this vault's notes have none. THE SEARCH
     * FOR ONE HAS A BUDGET, and that is the whole point of it: openBook renders the contents,
     * which costs 45-90ms on this vault's biggest books (2,450 notes), so walking one of them
     * is 93-217 SECONDS of synchronous script. Two checks used to walk views order with no cap
     * at all, which was 50ms on a fresh page and a renderer that never answered CDP again once
     * an earlier check had moved something onto the front of Favourites -- taking eleven
     * innocent neighbours down with each of them. github#40, github#57.
     * A FEW NOTES FROM EACH BOOK AND NEVER THE SAME NOTE TWICE, rather than one book at a
     * time: the books this vault has most of are the sparse early years, where a week, a
     * month, a folder and three tags all hold the one note, so a budget spent down one book
     * at a time buys a dozen distinct notes and concludes the vault has nothing tall in it.
     * Books over MAX_WALK notes are left alone because their open is the expensive one, and
     * every other book is sampled in the order the shelves are in. */
    overflowing: function (minNotes, minSpan, budget) {
      var seen = {}, opens = 0, cap = budget || 150, tallest = 0, MAX_WALK = 200;
      var books = [];
      __vs.views().forEach(function (v) { v.books.forEach(function (b) {
        if (b.notes.length >= minNotes && b.notes.length <= MAX_WALK) books.push(b);
      }); });
      for (var k = 0; k < books.length; k++) {
        var b = books[k], took = 0;
        /* stops one short of the end, so a turn forward has somewhere to go */
        for (var i = 0; i < b.notes.length - 1 && took < 4; i++) {
          var id = b.notes[i].id;
          if (seen[id]) continue;
          seen[id] = 1;
          if (opens >= cap) return { found: null, opens: opens, tallest: tallest };
          opens++; took++;
          __vs.openBook(b.id, id);
          var p = __push.right();
          if (!p) break;
          var span = p.scrollHeight - p.clientHeight;
          if (span > tallest) tallest = span;
          if (span > minSpan) {
            return { found: { id: b.id, at: i, span: span, notes: b.notes.length },
                     opens: opens };
          }
        }
      }
      return { found: null, opens: opens, tallest: tallest };
    }
  };
})(); void 0`;

/* github#40 -- past PUSH_QUIET (140ms) plus the band's spring (180ms) */
const PUSH_QUIET_WAIT = 400;

check("pushing past the end of a page turns it, and one hard flick turns one page", async (p) => {
  await p.eval(PUSH_HELPERS);
  const first = await p.j(`(function(){
    var book = __push.bookOf(4);
    if (!book) return null;
    __vs.openBook(book.id, null);
    var page = __push.right();
    /* THE 85% CASE (D-1): a note that never scrolls is already at its limit, so the push
     * starts on the first notch rather than not existing at all. */
    var span = page.scrollHeight - page.clientHeight;
    var steps = [];
    for (var i = 0; i < 3; i++) {
      __push.wheel(page, 100, 1);
      var o = __vs.overscroll();
      steps.push({ at: o.at, index: __vs.reader().index, band: Math.round(o.band * 10) / 10 });
    }
    return { book: book.id, notes: book.notes.length, span: span, steps: steps,
             turn: __vs.overscroll().turn, index: __vs.reader().index, top: page.scrollTop };
  })()`);
  if (!first) return { ok: false, detail: "no book with four notes in this vault" };
  await sleep(PUSH_QUIET_WAIT);

  const flick = await p.j(`(function(){
    var book = __push.bookOf(6);
    __vs.openBook(book.id, null);
    var page = __push.right();
    var seen = [];
    /* ONE HARD FLICK, and the page it lands on is driven to its own bottom between every
     * notch -- the momentum case. Without the latch spanning the flick this turns twice. */
    for (var i = 0; i < 40; i++) {
      __push.wheel(page, 120, 1);
      page.scrollTop = page.scrollHeight - page.clientHeight;
      seen.push(__vs.reader().index);
    }
    var turns = seen.filter(function (v, k) { return k > 0 && v !== seen[k - 1]; }).length;
    return { notches: seen.length, turns: turns, index: __vs.reader().index,
             spent: __vs.overscroll().spent };
  })()`);
  await sleep(PUSH_QUIET_WAIT);

  const again = await p.j(`(function(){
    var page = __push.right();
    page.scrollTop = page.scrollHeight - page.clientHeight;
    var before = __vs.reader().index;
    __push.wheel(page, 100, 3);
    var out = { before: before, after: __vs.reader().index };
    __vs.closeReader();
    return out;
  })()`);

  const twoNotches = first.steps[1];
  const ok = first.span === 0 && first.steps[0].index === 0 && twoNotches.index === 0 &&
             first.index === 1 && first.top === 0 && first.turn === 240 &&
             twoNotches.band < -15 && twoNotches.band > -26 &&
             flick.turns === 1 && flick.spent === true &&
             again.after === again.before + 1;
  return {
    ok,
    detail: `a note with ${first.span}px of overscroll (D-1: it never scrolls) took ` +
            `${first.steps[0].at}px then ${twoNotches.at}px of push without turning, the band ` +
            `reaching ${twoNotches.band}px, and turned on the third notch past the ` +
            `${first.turn}px threshold, arriving at scrollTop ${first.top}; one flick of ` +
            `${flick.notches} notches onto a page driven to its bottom each time turned ` +
            `${flick.turns} page (latch still held: ${flick.spent}); after the flick went quiet ` +
            `a fresh push turned ${again.before} -> ${again.after}`
  };
});

check("a push made slowly still turns, and the latch still clears on its own", async (p) => {
  await p.eval(PUSH_HELPERS);
  /* github#40, design/0028 -- D-5: two silences, measured one against the other */
  const t = await p.j(`(function(){
    var o = __vs.overscroll();
    return { quiet: o.quiet, hold: o.hold, turn: o.turn };
  })()`);
  const open = `(function(){
    var book = __push.bookOf(6);
    __vs.openBook(book.id, null);
    return book.notes.length;
  })()`;

  /* github#40 -- a gap past the latch's silence, inside the hold's */
  await p.j(open);
  const slow = [];
  for (let i = 0; i < 3; i++) {
    await p.j(`(function(){ var page = __push.right();
      page.scrollTop = page.scrollHeight - page.clientHeight;
      __push.wheel(page, 100, 1);
      return __vs.overscroll().at; })()`);
    slow.push(await p.j(`(function(){ var o = __vs.overscroll();
      return { at: o.at, index: __vs.reader().index }; })()`));
    if (i < 2) await sleep(t.quiet + 80);
  }
  const slowIndex = await p.j(`__vs.reader().index`);

  /* github#40, design/0028 */
  await sleep(t.quiet + 80);
  const partial = await p.j(`(function(){
    var page = __push.right(), unlatched = !__vs.overscroll().spent;
    page.scrollTop = page.scrollHeight - page.clientHeight;
    __push.wheel(page, 100, 2);
    return { unlatched: unlatched, at: __vs.overscroll().at, index: __vs.reader().index,
             top: page.scrollTop, span: page.scrollHeight-page.clientHeight };
  })()`);
  await sleep(t.hold + 200);
  const forgotten = await p.j(`(function(){
    var page = __push.right();
    var before = __vs.overscroll().at;
    __push.wheel(page, 100, 1);
    var o = __vs.overscroll();
    var out = { at: o.at, index: __vs.reader().index, before: before };
    __vs.closeReader();
    return out;
  })()`);

  const ok = t.quiet === 140 && t.hold === 600 && t.hold > t.quiet &&
             slow[1].at === 200 && slowIndex === 1 && partial.unlatched &&
             partial.at === 200 && partial.index === 1 && Math.abs(partial.top-partial.span) <= 1 &&
             forgotten.before === 0 && forgotten.at === 100 && forgotten.index === 1;
  return {
    ok,
    detail: `the latch clears after ${t.quiet}ms of silence and the accumulator holds its push ` +
            `for ${t.hold}ms. Three notches ${t.quiet + 80}ms apart -- further apart than the ` +
            `latch's silence -- accumulated ${slow.map((s) => s.at).join("px, ")}px and turned ` +
            `the page to ${slowIndex}; after the latch clears (${partial.unlatched}), two notches at the ` +
            `page bottom (${partial.top}/${partial.span}px) build ${partial.at}px without turning. ` +
            `After ${t.hold + 200}ms of silence that partial push is ${forgotten.before}px, ` +
            `and a fresh notch starts at ${forgotten.at}px on page ${forgotten.index}`
  };
});

check("a turn arrives at the top going forward and the bottom going back", async (p) => {
  await p.eval(PUSH_HELPERS);
  const hit = await p.j(`(function(){ var r = __push.overflowing(3, 80, 150);
                                      __vs.closeReader(); return r; })()`);
  if (!hit.found) {
    return { ok: false,
             detail: `no note that overflows its page within ${hit.opens} distinct notes of ` +
                     `this vault -- the tallest page reached ${hit.tallest}px` };
  }
  const found = { book: hit.found.id, at: hit.found.at };

  const back = await p.j(`(function(){
    __vs.openBook(${JSON.stringify(found.book)}, __vs.views() && null);
    var book = null;
    __vs.views().forEach(function (v) { v.books.forEach(function (b) {
      if (b.id === ${JSON.stringify(found.book)}) book = b; }); });
    __vs.openBook(book.id, book.notes[${found.at} + 1].id);
    var page = __push.right();
    page.scrollTop = 0;
    __push.wheel(page, -100, 3);
    return { index: __vs.reader().index, top: page.scrollTop,
             span: page.scrollHeight - page.clientHeight };
  })()`);
  await sleep(PUSH_QUIET_WAIT);

  const forward = await p.j(`(function(){
    var page = __push.right();
    page.scrollTop = page.scrollHeight - page.clientHeight;
    var from = __vs.reader().index;
    __push.wheel(page, 100, 3);
    var out = { from: from, index: __vs.reader().index, top: page.scrollTop };
    __vs.closeReader();
    return out;
  })()`);

  const atBottom = back.span > 0 && Math.abs(back.top - back.span) <= 1;
  const ok = back.index === found.at && atBottom &&
             forward.index === found.at + 1 && forward.top === 0;
  return {
    ok,
    detail: `pushing up off note ${found.at + 1} turned back to ${back.index} and landed at ` +
            `scrollTop ${back.top} of ${back.span} (the bottom: ${atBottom}); pushing down ` +
            `again turned ${forward.from} -> ${forward.index} and landed at ${forward.top} ` +
            `(the top). A turn is a reading motion, not a teleport`
  };
});

check("every way to another note starts at the top of it", async (p) => {
  await p.eval(PUSH_HELPERS);
  /* github#40, design/0028 -- goTo reset no scroll offset at all */
  const r = await p.j(`(function(){
    var hit = __push.overflowing(4, 120, 150);
    if (!hit.found) { __vs.closeReader(); return { opens: hit.opens }; }
    var found = hit.found;
    var page = __push.right();
    var out = { span: page.scrollHeight - page.clientHeight, ways: {} };

    /* each of these leaves the note scrolled to its bottom first */
    var scrolled = function () {
      var q = __push.right();
      q.scrollTop = q.scrollHeight - q.clientHeight;
      return q.scrollTop;
    };
    var at = function () { return __push.right().scrollTop; };

    scrolled();
    document.getElementById("vs-nextnote").click();
    out.ways.next = at();

    scrolled();
    document.getElementById("vs-prevnote").click();
    out.ways.previous = at();

    scrolled();
    document.getElementById("vs-reader").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    out.ways.arrow = at();

    scrolled();
    var rows = document.querySelectorAll("#vs-contents button");
    rows[rows.length - 1].click();
    out.ways.contents = at();

    /* and opening a book while the last note was left scrolled */
    scrolled();
    __vs.openBook(found.id, null);
    out.ways.openBook = at();
    __vs.closeReader();
    return out;
  })()`);
  if (!r.ways) {
    return { ok: false,
             detail: `no note that overflows its page within ${r.opens} distinct notes of ` +
                     `this vault -- the tallest page reached ${r.tallest}px` };
  }
  const ways = Object.keys(r.ways);
  const off = ways.filter((w) => r.ways[w] !== 0);
  return {
    ok: off.length === 0 && r.span > 120,
    detail: `with the note scrolled to the bottom of its ${r.span}px first, each way to another ` +
            `note arrived at scrollTop ` +
            ways.map((w) => `${w} ${r.ways[w]}`).join(", ") +
            (off.length ? ` -- ${off.join(", ")} did not start at the top` : " -- all at the top")
  };
});

check("the push resists at both ends of the book and never turns", async (p) => {
  await p.eval(PUSH_HELPERS);
  const r = await p.j(`(function(){
    var book = __push.bookOf(4);
    if (!book) return null;
    /* D-4, amended -- the band gives about a third as far and never resolves. Nothing is
     * drawn: the leaf moving is the whole indicator, and at an end it moves less. */
    __vs.openBook(book.id, null);
    var page = __push.right();
    __push.wheel(page, -100, 6);
    var head = { index: __vs.reader().index, band: __vs.overscroll().band,
                 prev: document.getElementById("vs-prevnote").disabled };
    __vs.closeReader();
    return { head: head, notes: book.notes.length, book: book.id };
  })()`);
  if (!r) return { ok: false, detail: "no book with four notes in this vault" };
  await sleep(PUSH_QUIET_WAIT);

  const tail = await p.j(`(function(){
    var book = null;
    __vs.views().forEach(function (v) { v.books.forEach(function (b) {
      if (b.id === ${JSON.stringify(r.book)}) book = b; }); });
    __vs.openBook(book.id, book.notes[book.notes.length - 1].id);
    var page = __push.right();
    page.scrollTop = page.scrollHeight - page.clientHeight;
    __push.wheel(page, 100, 6);
    var out = { index: __vs.reader().index, band: __vs.overscroll().band,
                next: document.getElementById("vs-nextnote").disabled,
                last: book.notes.length - 1 };
    __vs.closeReader();
    return out;
  })()`);

  /* github#40 -- nothing is painted anywhere, at an end or mid-book */
  const drawn = await p.j(`document.querySelectorAll("#vs-app .vs-push, #vs-app #vs-pushsay").length`);
  const ok = r.head.index === 0 && r.head.band === 9 && r.head.prev === true &&
             tail.index === tail.last && tail.band === -9 && tail.next === true &&
             drawn === 0;
  return {
    ok,
    detail: `six notches up at note 0 left the reader at ${r.head.index} with the band at ` +
            `${r.head.band}px -- a third of the 26px it gives mid-book, which is the whole ` +
            `indicator now; six down at note ${tail.last} of ${r.notes} left it at ` +
            `${tail.index}, band ${tail.band}px. Previous and Next are disabled ` +
            `(${r.head.prev}/${tail.next}), which is what says why. ${drawn} strip elements ` +
            `on the page`
  };
});

check("the contents never turns the page, and nor does a key that scrolls one", async (p) => {
  await p.eval(PUSH_HELPERS);
  const r = await p.j(`(function(){
    var book = __push.bookOf(4);
    if (!book) return null;
    __vs.openBook(book.id, null);
    /* D-3 -- the left page is a list of things you click, not a page you read. */
    var left = __push.left();
    left.scrollTop = left.scrollHeight - left.clientHeight;
    __push.wheel(left, 100, 12);
    var afterContents = { index: __vs.reader().index, dir: __vs.overscroll().dir,
                          at: __vs.overscroll().at };
    /* D-2 -- design/0025 stands: a discrete keypress cannot express a push. */
    var reader = document.getElementById("vs-reader");
    reader.focus();
    ["PageDown", " ", "PageUp", "PageDown"].forEach(function (k) {
      reader.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true,
                                                          cancelable: true }));
    });
    var afterKeys = __vs.reader().index;
    /* and the arrow key still turns at once, with no resistance to push through */
    reader.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true,
                                                        cancelable: true }));
    var afterArrow = __vs.reader().index;
    var out = { contents: afterContents, keys: afterKeys, arrow: afterArrow,
                notes: book.notes.length };
    __vs.closeReader();
    return out;
  })()`);
  if (!r) return { ok: false, detail: "no book with four notes in this vault" };
  const ok = r.contents.index === 0 && r.contents.dir === 0 && r.contents.at === 0 &&
             r.keys === 0 && r.arrow === 1;
  return {
    ok,
    detail: `twelve notches off the bottom of the contents left the reader at ` +
            `${r.contents.index} and the push at ${r.contents.at}px, never engaging ` +
            `(D-3); PageDown, space and PageUp left it at ${r.keys} (D-2, design/0025 ` +
            `unamended); the right arrow turned it to ${r.arrow} at once, as it always did`
  };
});

check("a wheel on the spread stays smooth in every look", async (p) => {
  await p.eval(PUSH_HELPERS);
  await p.eval(FRAME_HELPERS);
  /* github#40, design/0028 -- the library scroll's budget, same method */
  /* github#40, design/0028 -- two costs, so measured where the push cannot turn */
  /* github#77, decisions/0017 -- the same count, and it held the same 34ms line */
  const r = await p.eval(`(async function(){
    var looks = window.VaultShelfCore.LOOKS.map(function (l) { return l.value; });
    var was = document.getElementById("vs-app").getAttribute("data-look") || "";
    var book = __push.bookOf(8);
    var out = {}, idle = null;
    for (var i = 0; i < looks.length; i++) {
      __vs.setLook(looks[i]);
      /* the LAST note, so every notch paints the band and none of them turns */
      __vs.openBook(book.id, book.notes[book.notes.length - 1].id);
      await new Promise(function (r) { setTimeout(r, 120); });
      var page = __push.right();
      page.scrollTop = page.scrollHeight - page.clientHeight;
      /* one discarded pass, so the stylesheet is applied before anything is timed */
      __push.wheel(page, 40, 8);
      await new Promise(function (r) { setTimeout(r, 320); });
      /* the period, once, and only now that the discarded pass has frames flowing */
      if (!idle) idle = await __fr.calibrate(page, 500);
      var ts = [];
      var start = performance.now();
      await new Promise(function (done) {
        function step(now) {
          ts.push(now);
          /* a steady push, the way a trackpad delivers one */
          __push.wheel(page, 40, 1);
          if (now - start < 1200) requestAnimationFrame(step); else done();
        }
        requestAnimationFrame(step);
      });
      var turned = __vs.reader().index !== book.notes.length - 1;
      /* and the turn on its own, timed once */
      __vs.openBook(book.id, book.notes[0].id);
      await new Promise(function (r) { setTimeout(r, 200); });
      var t0 = performance.now();
      __push.wheel(__push.right(), 100, 3);
      var turn = performance.now() - t0;
      out[looks[i] || "modern"] = { ts: ts, turned: turned, turn: turn,
                                    landed: __vs.reader().index };
      __vs.closeReader();
      await new Promise(function (r) { setTimeout(r, 400); });
    }
    __vs.setLook(was);
    return { looks: out, idle: idle };
  })()`);
  const VSYNC = framePeriod(r.idle);
  const names = Object.keys(r.looks);
  const push = {};
  for (const n of names) push[n] = frameStats(r.looks[n], VSYNC);
  /* github#77, decisions/0017 -- missed vsyncs of the ~68 a 1.2s push offers */
  const BUDGET = 14;
  const over = names.filter((n) => push[n].missed > BUDGET);
  const turnedAnyway = names.filter((n) => r.looks[n].turned);
  return {
    ok: over.length === 0 && !turnedAnyway.length && frameSteady(VSYNC) &&
        names.every((n) => r.looks[n].landed === 1),
    detail: `missed vsyncs, and p50/p95/worst frame in ms, while pushing against the end of ` +
            `the book -- ` + names.map((n) => `${n} ${push[n].missed} ` +
              `(${push[n].p50.toFixed(1)}/${push[n].p95.toFixed(1)}/` +
              `${push[n].worst.toFixed(0)})`).join(", ") +
            ` of the ${push[names[0]].painted + push[names[0]].missed} on offer ` +
            `(budget: ${BUDGET} missed${over.length ? "; over in " + over.join(", ") : ""})` +
            `; one whole turn, measured separately, cost ` +
            names.map((n) => `${n} ${r.looks[n].turn.toFixed(0)}ms`).join(", ") +
            `; vsync calibrated at ${VSYNC.toFixed(1)}ms` +
            (frameSteady(VSYNC) ? "" : ", which is no frame this machine can paint") +
            (turnedAnyway.length ? `; the end gave way in ${turnedAnyway.join(", ")}` : "")
  };
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
    if (!links.length) { __vs.closeReader(); return { found: true, links: 0 }; }
    var from = __vs.reader().book;
    links[0].click();
    var to = __vs.reader();
    /* github#39 -- close it, or it paints over the library for the next check */
    __vs.closeReader();
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
    var out = { first: books[0], second: books[1], atSecond: atSecond,
                afterButton: afterButton, afterKey: __vs.reader().book };
    /* github#39 -- close it, or it paints over the library for the next check */
    __vs.closeReader();
    return out;
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

/* github#54, design/0004 -- the footer is furniture, and a press proves it */
/* github#36 -- .click() arms no mousedown, so the desk declined */
check("every part of the turn turns the page rather than putting the book down", async (p) => {
  const r = await p.j(`(function(){
    var press = function (el, x, y) {
      ["mousedown", "mouseup", "click"].forEach(function (type) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                                                clientX: x, clientY: y }));
      });
    };
    var book = null;
    __vs.views().forEach(function (v) {
      v.books.forEach(function (b) {
        if (b.notes.length >= 3 && (!book || b.notes.length < book.notes.length)) book = b;
      });
    });
    if (!book) return { found: false };
    var readerEl = document.getElementById("vs-reader");

    var spotOf = function (el) {
      if (!el) return null;
      var b = el.getBoundingClientRect();
      if (!b.width || !b.height) return null;
      var x = b.left + b.width / 2, y = b.top + b.height / 2;
      return { el: document.elementFromPoint(x, y) || el, x: x, y: y };
    };
    var byId = function (id) { return function () { return spotOf(document.getElementById(id)); }; };
    var bareTurn = function () {
      var turn = document.querySelector(".vs-turn");
      var b = turn.getBoundingClientRect();
      var y = b.top + b.height / 2;
      for (var i = 1; i < 48; i++) {
        var x = b.left + (b.width * i) / 48;
        if (document.elementFromPoint(x, y) === turn) return { el: turn, x: x, y: y };
      }
      return null;
    };

    /* github#54 -- re-measure before each press; a scrolled list lies */
    /* github#54 -- Previous is disabled at index 0 and swallows a click */
    var hit = function (pick) {
      __vs.openBook(book.id, null);
      document.getElementById("vs-nextnote").click();
      var from = __vs.reader().index;
      var spot = pick();
      if (!spot) { __vs.closeReader(); return null; }
      press(spot.el, spot.x, spot.y);
      var open = !readerEl.hidden;
      var out = { open: open, from: from, moved: open ? __vs.reader().index - from : null };
      __vs.closeReader();
      return out;
    };

    /* design/0021 -- one geometry, three faces, so measure all three */
    var root = document.querySelector(".vault-shelf");
    var was = root.getAttribute("data-look") || "";
    var out = {};
    window.VaultShelfCore.LOOKS.forEach(function (l) {
      __vs.setLook(l.value);
      out[l.value || "modern"] = { next: hit(byId("vs-nextnote")), prev: hit(byId("vs-prevnote")),
                                   place: hit(byId("vs-place")), bare: hit(bareTurn) };
    });
    __vs.setLook(was);
    return { found: true, size: book.notes.length, looks: out };
  })()`);
  if (!r.found) return { ok: false, detail: "no book with three notes in this vault" };
  const want = { next: 1, prev: -1, place: 0, bare: 0 };
  const parts = Object.keys(want);
  const looks = Object.keys(r.looks);
  const bad = [];
  for (const look of looks) {
    for (const part of parts) {
      const got = r.looks[look][part];
      if (!got) { bad.push(`${look}/${part}: nothing there to press`); continue; }
      if (!got.open) { bad.push(`${look}/${part}: put the book down`); continue; }
      if (got.moved !== want[part]) {
        bad.push(`${look}/${part}: the index moved ${got.moved}, wanted ${want[part]}`);
      }
    }
  }
  return {
    ok: bad.length === 0,
    detail: bad.length
      ? `${bad.length} of ${looks.length * parts.length} presses were wrong: ${bad.join("; ")}`
      : `in ${looks.length} looks, from index 1 of ${r.size}: Next moved +1, Previous -1, the ` +
        `place label and the footer's own background 0, and all ${looks.length * parts.length} ` +
        `left the book open`
  };
});

/* github#54, design/0004 -- the next furniture is covered in advance */
/* github#54 -- a control has its own contract; press the furniture */
check("nothing in the reader but the desk puts the book down", async (p) => {
  const r = await p.j(`(function(){
    var press = function (el, x, y) {
      ["mousedown", "mouseup", "click"].forEach(function (type) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                                                clientX: x, clientY: y }));
      });
    };
    var CONTROL = "button, a, input, select, textarea, [role=button]";
    var readerEl = document.getElementById("vs-reader");
    var address = __vs.addresses()[0];
    var nameOf = function (el) {
      if (el.id) return "#" + el.id;
      var cls = (el.getAttribute("class") || "").split(" ")[0];
      return cls ? "." + cls : el.tagName.toLowerCase();
    };
    __vs.openBook(address, null);
    var count = readerEl.children.length;
    var out = [];
    for (var i = 0; i < count; i++) {
      /* github#54 -- re-open, or one that closes takes the rest with it */
      __vs.openBook(address, null);
      var child = readerEl.children[i];
      var b = child.getBoundingClientRect();
      if (child.hidden || !b.width || !b.height) {
        out.push({ name: nameOf(child), skipped: true });
        continue;
      }
      var spot = null;
      for (var gy = 1; gy < 8 && !spot; gy++) {
        for (var gx = 1; gx < 32 && !spot; gx++) {
          var x = b.left + (b.width * gx) / 32, y = b.top + (b.height * gy) / 8;
          var el = document.elementFromPoint(x, y);
          if (el && el !== readerEl && readerEl.contains(el) && !el.closest(CONTROL)) {
            spot = { el: el, x: x, y: y };
          }
        }
      }
      if (!spot) { out.push({ name: nameOf(child), bare: false }); continue; }
      press(spot.el, spot.x, spot.y);
      out.push({ name: nameOf(child), bare: true, open: !readerEl.hidden, at: nameOf(spot.el) });
    }
    /* github#54 -- the desk must still put it down, or this proves nothing */
    __vs.openBook(address, null);
    var spread = document.querySelector("#vs-reader .vs-spread").getBoundingClientRect();
    var host = readerEl.getBoundingClientRect();
    var deskX = host.left + Math.max(4, (spread.left - host.left) / 2);
    var deskY = spread.top + spread.height / 2;
    var deskEl = document.elementFromPoint(deskX, deskY);
    press(deskEl, deskX, deskY);
    var deskClosed = readerEl.hidden;
    __vs.closeReader();
    return { children: out, count: count, deskClosed: deskClosed,
             deskIsReader: deskEl === readerEl, desk: nameOf(deskEl) };
  })()`);
  const name = (c) => c.name;
  const held = r.children.filter((c) => c.bare && c.open);
  const dropped = r.children.filter((c) => c.bare && !c.open);
  const unreachable = r.children.filter((c) => c.bare === false);
  const skipped = r.children.filter((c) => c.skipped);
  const ok = dropped.length === 0 && unreachable.length === 0 && r.deskClosed && r.deskIsReader;
  return {
    ok,
    detail: `${r.count} children of #vs-reader: ${held.length} held the book open ` +
            `(${held.map(name).join(", ") || "none"})` +
            (dropped.length ? `, ${dropped.length} PUT IT DOWN (${dropped.map(name).join(", ")})` : "") +
            (unreachable.length
              ? `, ${unreachable.length} offered no background point (${unreachable.map(name).join(", ")})`
              : "") +
            (skipped.length ? `, ${skipped.length} not on screen (${skipped.map(name).join(", ")})` : "") +
            `; the desk beside the book is ${r.desk} and still puts it down (${r.deskClosed})`
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
    var source = document.getElementById("vs-bsource");
    var sourceVal = document.getElementById("vs-bsourceval");
    source.value = "folder";
    source.dispatchEvent(new Event("change", { bubbles: true }));
    var folderOptions = [].slice.call(sourceVal.options).map(function (o) { return o.value; });
    var folder = folderOptions[Math.min(1, folderOptions.length - 1)] || "";
    sourceVal.value = folder;
    sourceVal.dispatchEvent(new Event("change", { bubbles: true }));
    var folderStayed = sourceVal.value === folder;
    source.value = "tag";
    source.dispatchEvent(new Event("change", { bubbles: true }));
    var tagOptions = [].slice.call(sourceVal.options).map(function (o) { return o.value; });
    var tag = tagOptions[Math.min(1, tagOptions.length - 1)] || "";
    sourceVal.value = tag;
    sourceVal.dispatchEvent(new Event("change", { bubbles: true }));
    var tagStayed = sourceVal.value === tag;
    var property = document.getElementById("vs-bproperty");
    document.getElementById("vs-bclassifier").value = "property";
    document.getElementById("vs-bclassifier").dispatchEvent(new Event("change", { bubbles: true }));
    var propertyOptions = [].slice.call(property.options).map(function (o) { return o.value; });
    var prop = propertyOptions[Math.min(1, propertyOptions.length - 1)] || "";
    property.value = prop;
    property.dispatchEvent(new Event("change", { bubbles: true }));
    var propertyStayed = property.value === prop;
    source.value = "all";
    source.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("vs-bclassifier").value = "person";
    document.getElementById("vs-bclassifier").dispatchEvent(new Event("change", { bubbles: true }));
    var text = document.getElementById("vs-previewcount").textContent;
    var spines = document.querySelectorAll("#vs-preview .vs-spine").length;
    var people = __vs.views().filter(function (v) { return v.shelf.id === "people"; })[0];
    document.getElementById("vs-bcancel").click();
    return { text: text, spines: spines, real: people.books.length,
             folder: folder, folderStayed: folderStayed, tag: tag, tagStayed: tagStayed,
             property: prop, propertyStayed: propertyStayed,
             cancelled: document.getElementById("vs-builder").hidden,
             shelves: __vs.settings().shelves.length };
  })()`);
  const previewed = Number((/(\d+) books?/.exec(r.text) || [0, 0])[1]);
  return { ok: previewed === r.real && r.spines > 0 && r.cancelled &&
                r.folder && r.folderStayed && r.tag && r.tagStayed && r.property && r.propertyStayed,
           detail: `preview said "${r.text}" against a real People shelf of ${r.real} books; ` +
                   `${r.spines} spines drawn; folder "${r.folder}" stayed ${r.folderStayed}, ` +
                   `tag "${r.tag}" stayed ${r.tagStayed}, property "${r.property}" stayed ` +
                   `${r.propertyStayed}; cancel left ${r.shelves} shelves` };
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
    /* github#12 */
    var clipped = 0, measured = 0, sideways = [];
    spines.forEach(function (b) {
      var t = b.querySelector(".vs-title");
      var up = b.getAttribute("data-upright") === "1";
      if (!up && t.textContent.length <= 3) sideways.push(t.textContent);
      if (!up || !t.clientWidth) return;
      measured++;
      if (t.scrollWidth > t.clientWidth) clipped++;
    });
    return { titled: titled, label: (longest.getAttribute("data-peek") || "").split(" -- ")[0],
             clippedUp: clipped, measuredUp: measured, sideways: sideways,
             shown: shown, width: Math.round(box.width), fontPx: fontPx, clipped: clipped,
             above: above, hidden: hidden, enc: enc.length, uprightEnc: uprightEnc.length,
             mode: mode, wide: wide, nameLines: Math.round(nameBox.height / (fontPx * 1.4)) };
  })()`);
  // github#34, github#36
  /* github#45, design/0021 -- ONE, and it is a census rather than a tolerance */
  const ok = r.titled === 0 && r.shown && r.fontPx >= 13 && !r.clipped && r.above && r.hidden &&
             r.uprightEnc + r.sideways.length >= r.enc && r.sideways.length <= 1 &&
             r.mode === "horizontal-tb" && r.wide === 0 && r.clippedUp === 0;
  return {
    ok,
    detail: `${r.titled} spines carry a title or aria-label (two overlays otherwise); hovering ` +
            `"${r.label}" shows one ${r.width}px peek at ${r.fontPx}px, the name in full ` +
            `(${!r.clipped}, ${r.nameLines} line(s)), clear of the spine (${r.above}), gone on ` +
            `leave (${r.hidden}); ${r.uprightEnc}/${r.enc} Encyclopedia labels stand upright ` +
            `(${r.mode}) and no label over three characters does (${r.wide === 0}); ` +
            `${r.clippedUp} of ${r.measuredUp} upright titles in view are clipped` +
            (r.sideways.length ? `; short covers too wide for their spine stay sideways: ${r.sideways.join(" ")}` : "")
  };
});

/* github#51, design/0021 -- pixels: a clipped spine's rect reads whole. */
check("a lifted spine is painted whole, in every look", async (p) => {
  await p.j(`(function(){
    var s = document.createElement("style");
    s.id = "vs-probe-51";
    document.head.appendChild(s);
    return 1;
  })()`);

  /* github#51 -- past a PAINT, or both captures come back identical. */
  const sheet = (text) => p.eval(`(async function(){
    document.getElementById("vs-probe-51").textContent = ${JSON.stringify(text)};
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    return 1;
  })()`);

  /* github#51 -- the whole width, never one column down the middle. */
  const band = async (x, y, w, rows) => {
    const shot = await p.send("Page.captureScreenshot",
      { format: "png", captureBeyondViewport: false,
        clip: { x, y, width: w, height: rows, scale: 1 } });
    return p.eval(`(async function(){
      var img = new Image();
      img.src = "data:image/png;base64," + ${JSON.stringify(shot.data)};
      await img.decode();
      var c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data, out = [];
      for (var y = 0; y < c.height; y++) {
        var row = [];
        for (var x = 0; x < c.width; x++) {
          var i = (y * c.width + x) * 4;
          row.push(d[i], d[i + 1], d[i + 2]);
        }
        out.push(row);
      }
      return out;
    })()`);
  };

  /* github#51 -- never the first shelf: the top bar is above it. */
  const pick = (sel) => p.j(`(function(){
    [].slice.call(document.querySelectorAll("#vs-app [data-probe51]"))
      .forEach(function (el) { el.removeAttribute("data-probe51"); });
    var shelves = document.querySelectorAll("#vs-shelves .vs-shelf");
    var sp = null;
    for (var i = 1; i < shelves.length && !sp; i++) sp = shelves[i].querySelector(${JSON.stringify(sel)});
    if (!sp) return null;
    sp.setAttribute("data-probe51", "1");
    var track = sp.closest(".vs-track");
    var r = sp.getBoundingClientRect(), t = track.getBoundingClientRect();
    var cs = getComputedStyle(track);
    var shelf = sp.closest(".vs-shelf");
    var room = document.getElementById("vs-shelves");
    /* The raw geometry travels with the answer: a track at a fractional top loses the band's
     * bottom row to anti-aliasing and reads one pixel short, and nothing else says so. */
    /* And every box that stands above the track, so a fractional top can be traced to the
     * element that put it there. */
    var above = [].slice.call(document.querySelectorAll("#vs-app > *, #vs-shelves > *, #vs-shelves .vs-shelf:first-child > *"))
      .map(function (e) { var b = e.getBoundingClientRect();
                          return { who: e.id || e.className || e.tagName, top: b.top, h: b.height }; })
      .filter(function (b) { return b.h > 0 && b.top < t.top; });
    return { left: r.left, w: r.width, top: r.top, trackTop: t.top,
             contain: cs.contain, declared: parseFloat(cs.overflowClipMargin) || 0,
             shelf: shelf ? shelf.getAttribute("data-shelf") : null,
             scrollY: window.scrollY, roomScroll: room ? room.scrollTop : null,
             above: above };
  })()`);

  const MOVED = 6;   /* github#51 -- dither is a unit; an arriving edge moves one by tens */
  const REACH = 44;  /* github#51 -- read UP, so the answer is a height */

  /* github#51 -- how far above its track a spine is PAINTED. */
  const paintedAbove = async (g) => {
    const x = Math.round(g.left);
    const w = Math.max(2, Math.round(g.w));
    const y = Math.floor(g.trackTop) - REACH;
    const there = await band(x, y, w, REACH);
    await sheet(" #vs-app [data-probe51] { visibility: hidden !important; }");
    const bare = await band(x, y, w, REACH);
    await sheet("");
    const moves = there.map((row, i) =>
      row.reduce((most, v, k) => Math.max(most, Math.abs(v - bare[i][k])), 0));
    const first = moves.findIndex((m) => m > MOVED);
    return { above: first < 0 ? 0 : REACH - first,
             moves: moves.slice(Math.max(0, (first < 0 ? REACH : first) - 1)).join("/") };
  };

  const looks = await p.j(`window.VaultShelfCore.LOOKS.map(function (l) { return l.value; })`);
  const was = await p.j(`document.getElementById("vs-app").getAttribute("data-look") || ""`);
  const OVER = 40;   /* github#51 -- far past any room, so the answer is the clip's */
  const granted = [];
  const matched = [];

  for (const look of looks) {
    await p.j(`(__vs.setLook(${JSON.stringify(look)}), 1)`);
    await sleep(140);
    const name = look || "modern";

    /* github#51 -- 1. the room granted, against the room declared. */
    await sheet("");
    if (!(await pick(".vs-spine"))) {
      granted.push({ look: name, declared: null, got: null, contain: null, moves: "" });
      matched.push({ look: name, needle: "", lift: null, painted: null, moves: "" });
      continue;
    }
    await sheet(` #vs-app [data-probe51] { transform: translateY(-${OVER}px) !important; }`);
    const over = await pick(".vs-spine");
    const r = await paintedAbove(over);
    await sheet("");
    granted.push({ look: name, declared: over.declared, got: r.above, contain: over.contain,
                   moves: r.moves, geo: over });

    /* github#51 -- 2. one real state, query-lifted: no hover to race. */
    const needle = await p.j(`(function(){
      var tags = {};
      __vs.data().notes.forEach(function (n) {
        n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
      });
      var n = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] ||
              __vs.data().notes[0].title.slice(0, 4);
      __vs.setQuery(n);
      return n;
    })()`);
    await sleep(260);
    const m = await pick('.vs-spine[data-match="1"]');
    if (m) {
      const lift = +(m.trackTop - m.top).toFixed(1);
      const mr = await paintedAbove(m);
      matched.push({ look: name, needle, lift, painted: mr.above, moves: mr.moves });
    } else {
      matched.push({ look: name, needle, lift: null, painted: null, moves: "" });
    }
    await p.j(`(__vs.setQuery(""), 1)`);
    await sleep(220);
  }

  await p.j(`(__vs.setLook(${JSON.stringify(was)}), 1)`);
  await sleep(140);
  await p.j(`(function(){
    [].slice.call(document.querySelectorAll("#vs-app [data-probe51]"))
      .forEach(function (el) { el.removeAttribute("data-probe51"); });
    var s = document.getElementById("vs-probe-51");
    if (s) s.remove();
    return 1;
  })()`);

  /* github#51 -- not less, which cuts a head; not more, which drifts. */
  const wrongRoom = granted.filter((x) => x.got !== x.declared);
  const notClipping = granted.filter((x) => x.got >= OVER);   /* github#51 -- 40px of lift paints the room, never 40 */
  const loose = granted.filter((x) => (x.contain || "").indexOf("paint") < 0);
  const cutShort = matched.filter((x) => x.painted === null || x.lift === null ||
                                         x.painted < x.lift);
  const ok = wrongRoom.length === 0 && notClipping.length === 0 && loose.length === 0 &&
             cutShort.length === 0 && granted.length === looks.length &&
             matched.length === looks.length && granted.every((x) => x.declared > 0);
  return {
    ok,
    detail: `a spine lifted ${OVER}px paints this far above its track, against the room page.css ` +
            `declares -- ` +
            granted.map((x) => `${x.look} ${x.got}px of ${x.declared}px` +
              (x.geo ? ` (track top ${x.geo.trackTop})` : "") +
              ((x.contain || "").indexOf("paint") < 0 ? " (CONTAINMENT OFF)" : "")).join(", ") +
            `; and a real search match, lifted by the query rather than the pointer, is painted ` +
            `to its own top edge -- ` +
            matched.map((x) => `${x.look} "${x.needle}" lifted ${x.lift}px, painted ${x.painted}px`)
              .join(", ") +
            (wrongRoom.length
              ? ` -- ROOM NOT GRANTED: ` + wrongRoom.map((x) =>
                  `${x.look} declares ${x.declared}px and paints ${x.got}px ` +
                  `(rows moved by ${x.moves}; shelf ${x.geo.shelf}, track top ${x.geo.trackTop}, ` +
                  `spine top ${x.geo.top}, scrollY ${x.geo.scrollY}, room scrollTop ${x.geo.roomScroll}; ` +
                  `above it: ${(x.geo.above || []).map((b) => `${b.who}@${b.top}+${b.h}`).join(" | ")})`).join(", ")
              : "") +
            (notClipping.length
              ? ` -- THE CLIP STOPPED CLIPPING in ${notClipping.map((x) => x.look).join(", ")}: ` +
                `a ${OVER}px lift painted all ${OVER}px`
              : "") +
            (cutShort.length
              ? ` -- HEAD CUT: ` + cutShort.map((x) =>
                  `${x.look} lifted ${x.lift}px but painted only ${x.painted}px ` +
                  `(rows moved by ${x.moves})`).join(", ")
              : "")
  };
});

/* github#51, design/0021 -- the arithmetic: the tallest rung PLUS the look's halo. */
check("the room above a spine is the largest lift plus the look's halo, in every look", async (p) => {
  const r = await p.eval(`(async function(){
    var root = document.getElementById("vs-app");
    var core = window.VaultShelfCore;
    var looks = core.LOOKS.map(function (l) { return l.value; });
    var was = root.getAttribute("data-look") || "";
    var px = function (v) { return parseFloat(v) || 0; };
    var out = [];
    for (var i = 0; i < looks.length; i++) {
      __vs.setLook(looks[i]);
      await new Promise(function (r) { setTimeout(r, 120); });
      /* github#51 -- setLook rebuilds; a detached node reads all zeroes. */
      /* github#51 -- THE SPINE MUST BE THIS TRACK'S. Querying the track and the spine
       * independently reads the slack between two different shelves: the first shelf is the
       * Favourites pick shelf, which other checks empty, and the check then measured 239.3px
       * of "slack" -- one shelf's height -- and failed on a tree where nothing was wrong.
       * Take the first track that actually holds a spine, and the spine from inside it. */
      /* github#51 -- AND THE SPINE MUST NOT BE LIFTED AT REST. A worn spine carries
       * translateY(-1px) or (-2px) by design (the worn rungs below), so it is never flush with
       * its track and the slack reads -1 on a tree where nothing is wrong. Take a spine with no
       * rest lift, from the first track that holds one. */
      var flush = '.vs-spine:not([data-wear="2"]):not([data-wear="3"])';
      var track = [].slice.call(document.querySelectorAll("#vs-shelves .vs-track"))
        .filter(function (t) { return t.querySelector(flush); })[0];
      var spine = track.querySelector(flush);
      var cs = getComputedStyle(track);
      var rungs = ["--spine-lift-worn", "--spine-lift-worn-more", "--spine-lift-worn-hover",
                   "--spine-lift-hover", "--spine-lift-match"].map(function (n) {
        return { name: n.replace("--spine-lift-", ""), px: px(cs.getPropertyValue(n)) };
      });
      var tallest = rungs.reduce(function (a, b) { return b.px > a.px ? b : a; });
      var halo = px(cs.getPropertyValue("--spine-halo"));
      /* github#51 -- off the track, not the token: a look could set it. */
      var room = px(cs.overflowClipMargin);
      /* github#51, design/0021 -- the sum CSS cannot take, written out. */
      var declared = px(cs.getPropertyValue("--spine-room"));
      /* github#51 -- containment is still ON: a margin, not a dropped clip. */
      var contains = (cs.contain || "").indexOf("paint") >= 0;
      /* github#51 -- the slack that made the clip bite: still zero. */
      var above = +(track.getBoundingClientRect().top - spine.getBoundingClientRect().top).toFixed(1);
      // design/0033
      var bindingTrim = px(cs.getPropertyValue('--spine-h')) - spine.getBoundingClientRect().height;
      out.push({ look: looks[i] || "modern", room: room, tallest: tallest.px, halo: halo,
                 declared: declared, need: tallest.px + halo,
                 by: tallest.name, contains: contains, slackAbove: -above - bindingTrim, bindingTrim: bindingTrim,
                 rungs: rungs.map(function (x) { return x.name + " " + x.px; }).join("/") });
    }
    __vs.setLook(was);
    await new Promise(function (r) { setTimeout(r, 120); });
    return out;
  })()`);
  const short = r.filter((x) => x.room < x.need);
  const loose = r.filter((x) => !x.contains);
  /* github#51 -- IS the tallest rung plus the halo, not merely at least it. */
  const adrift = r.filter((x) => x.room !== x.need);
  const unstated = r.filter((x) => x.declared !== x.room);
  const ok = short.length === 0 && loose.length === 0 && adrift.length === 0 &&
             unstated.length === 0 && r.length >= 3 &&
             r.every((x) => x.tallest > 0 && x.slackAbove === 0);
  return {
    ok,
    detail: r.map((x) => `${x.look}: room ${x.room}px for a tallest lift of ${x.tallest}px ` +
                         `(${x.by}) plus a ${x.halo}px halo, containment ${x.contains ? "on" : "OFF"}, ` +
                         `${x.slackAbove}px of box above a spine`).join("; ") +
            ` -- rungs ${r[0].rungs}` +
            (short.length ? ` -- SHORT: ${short.map((x) => `${x.look} by ${x.need - x.room}px`).join(", ")}` : "") +
            (adrift.length && !short.length
              ? ` -- ADRIFT: ${adrift.map((x) => `${x.look} allows ${x.room}px for ${x.need}px`).join(", ")}` : "") +
            (unstated.length
              ? ` -- UNSTATED: ${unstated.map((x) => `${x.look} declares --spine-room ${x.declared}px and clips at ${x.room}px`).join(", ")}` : "") +
            (loose.length ? ` -- CONTAINMENT DROPPED in ${loose.map((x) => x.look).join(", ")}` : "")
  };
});

/* github#51, design/0021 -- A LIFT IS NOT THE ONLY THING THAT LEAVES A SPINE. */
check("nothing a look paints outside a spine is cut off, in every look", async (p) => {
  await p.send("DOM.enable");
  await p.send("CSS.enable");
  await p.j(`(function(){
    var s = document.createElement("style");
    s.id = "vs-probe-51b";
    document.head.appendChild(s);
    return 1;
  })()`);

  /* github#51 -- past a PAINT, or both captures come back identical. */
  const sheet = (text) => p.eval(`(async function(){
    document.getElementById("vs-probe-51b").textContent = ${JSON.stringify(text)};
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    return 1;
  })()`);

  const MOVED = 6;   /* github#51 -- dither is a unit; an arriving edge moves one by tens */
  const REACH = 60;  /* github#51 -- past the widest room a look could ask for */
  const SIDE = 24;   /* github#51 -- a glow spills sideways too, so read wider than the spine */
  /* github#78 -- this spine's own track, not every track */
  const OPEN = " #vs-app .vs-track:has([data-probe51b]) { overflow-clip-margin: 90px !important; }";

  /* github#51, design/0021 -- the band stays in the page; only the answer crosses. */
  const grab = async (slot, x, y, w, rows) => {
    const shot = await p.send("Page.captureScreenshot",
      { format: "png", captureBeyondViewport: false,
        clip: { x, y, width: w, height: rows, scale: 1 } });
    return p.eval(`(async function(){
      var img = new Image();
      img.src = "data:image/png;base64," + ${JSON.stringify(shot.data)};
      await img.decode();
      var c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      window.__vs51b = window.__vs51b || {};
      window.__vs51b[${JSON.stringify(slot)}] =
        { d: c.getContext("2d").getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
      return c.height;
    })()`);
  };

  const reachOf = (a, b) => p.j(`(function(){
    var A = window.__vs51b[${JSON.stringify(a)}], B = window.__vs51b[${JSON.stringify(b)}];
    if (!A || !B || A.w !== B.w || A.h !== B.h) return -1;
    for (var y = 0; y < A.h; y++) {
      var most = 0;
      for (var x = 0; x < A.w; x++) {
        var i = (y * A.w + x) * 4;
        most = Math.max(most, Math.abs(A.d[i] - B.d[i]),
                        Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
      }
      if (most > ${MOVED}) return A.h - y;
    }
    return 0;
  })()`);

  /* github#78, design/0021 -- what the clip takes, not what paint wants */
  const slicedAbove = async (g) => {
    const x = Math.max(0, Math.round(g.left) - SIDE);
    const w = Math.max(2, Math.round(g.w) + SIDE * 2);
    const y = Math.floor(g.trackTop) - REACH;
    if (y < 0) return -1;
    await sheet("");
    await grab("shipped", x, y, w, REACH);
    await sheet(OPEN);
    await grab("open", x, y, w, REACH);
    await sheet("");
    return reachOf("shipped", "open");
  };

  /* github#51 -- never the first shelf: other checks empty it. */
  const mark = (sel) => p.j(`(function(){
    [].slice.call(document.querySelectorAll("#vs-app [data-probe51b]"))
      .forEach(function (el) { el.removeAttribute("data-probe51b"); });
    var shelves = document.querySelectorAll("#vs-shelves .vs-shelf");
    var sp = null;
    for (var i = 1; i < shelves.length && !sp; i++) sp = shelves[i].querySelector(${JSON.stringify(sel)});
    if (!sp) return null;
    sp.setAttribute("data-probe51b", "1");
    var track = sp.closest(".vs-track");
    var r = sp.getBoundingClientRect(), t = track.getBoundingClientRect();
    return { left: r.left, w: r.width, top: r.top, trackTop: t.top,
             room: parseFloat(getComputedStyle(track).overflowClipMargin) || 0 };
  })()`);

  const nodeOf = async (sel) => {
    const doc = await p.send("DOM.getDocument", { depth: 0 });
    const r = await p.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel });
    return r.nodeId || 0;
  };

  const FLUSH = '.vs-spine:not([data-wear="2"]):not([data-wear="3"])';
  const WORN = '.vs-spine[data-wear="3"]';
  const states = [
    { id: "at rest", sel: FLUSH, hover: false, query: false },
    { id: "worn at rest", sel: WORN, hover: false, query: false },
    { id: "hovered", sel: FLUSH, hover: true, query: false },
    { id: "worn and hovered", sel: WORN, hover: true, query: false },
    { id: "a search match", sel: '.vs-spine[data-match="1"]', hover: false, query: true },
  ];

  const looks = await p.j(`window.VaultShelfCore.LOOKS.map(function (l) { return l.value; })`);
  const was = await p.j(`document.getElementById("vs-app").getAttribute("data-look") || ""`);
  const rows = [];
  /* github#78, decisions/0016 -- a guessed sleep is how a state gets measured half-built */
  const restless = [];
  const rest = async (who) => { if (!(await settled(p))) restless.push(who); };

  for (const look of looks) {
    await p.j(`(__vs.setLook(${JSON.stringify(look)}), 1)`);
    await rest(`${look || "modern"} setLook`);
    const name = look || "modern";

    for (const st of states) {
      await sheet("");
      let needle = "";
      if (st.query) {
        needle = await p.j(`(function(){
          var tags = {};
          __vs.data().notes.forEach(function (n) {
            n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
          });
          var n = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; })[0] ||
                  __vs.data().notes[0].title.slice(0, 4);
          __vs.setQuery(n);
          return n;
        })()`);
        await rest(`${name} ${st.id} setQuery`);
      }
      const g = await mark(st.sel);
      let node = 0;
      if (g && st.hover) {
        node = await nodeOf("#vs-app [data-probe51b]");
        if (node) await p.send("CSS.forcePseudoState", { nodeId: node, forcedPseudoClasses: ["hover"] });
        await sleep(220);
      }
      if (!g) {
        rows.push({ look: name, state: st.id, missing: true });
      } else {
        /* github#78 -- the clip's own doing, not a reach minus a room. */
        const sliced = await slicedAbove(g);
        rows.push({ look: name, state: st.id, room: g.room, sliced,
                    cut: Math.max(0, sliced), needle });
      }
      if (node) await p.send("CSS.forcePseudoState", { nodeId: node, forcedPseudoClasses: [] });
      if (st.query) { await p.j(`(__vs.setQuery(""), 1)`); await rest(`${name} ${st.id} clearQuery`); }
    }
  }

  await p.j(`(__vs.setLook(${JSON.stringify(was)}), 1)`);
  await sleep(160);
  await p.j(`(function(){
    [].slice.call(document.querySelectorAll("#vs-app [data-probe51b]"))
      .forEach(function (el) { el.removeAttribute("data-probe51b"); });
    var s = document.getElementById("vs-probe-51b");
    if (s) s.remove();
    delete window.__vs51b;
    return 1;
  })()`);

  const missing = rows.filter((x) => x.missing);
  const cut = rows.filter((x) => x.cut > 0);
  const unread = rows.filter((x) => !x.missing && x.sliced < 0);
  const ok = missing.length === 0 && cut.length === 0 && unread.length === 0 &&
             restless.length === 0 && rows.length === looks.length * states.length;
  /* github#78 -- the room and the states held; the reach is gone */
  const held = new Map();
  for (const x of rows) {
    if (x.missing) continue;
    const at = held.get(x.look) || { states: 0, sliced: 0, room: x.room };
    held.set(x.look, { states: at.states + 1, sliced: at.sliced + (x.cut > 0 ? 1 : 0), room: x.room });
  }
  return {
    ok,
    detail: `a look's room is compared against itself: the band as shipped against the same band ` +
            `with that track's clip opened, so what they disagree about IS what the clip took -- ` +
            looks.map((l) => {
              const n = l || "modern";
              const h = held.get(n);
              if (!h) return `${n} measured nothing`;
              return h.sliced
                ? `${n} allows ${h.room}px and slices ${h.sliced} of its ${h.states} states`
                : `${n} allows ${h.room}px and slices nothing off any of its ${h.states} states`;
            }).join(", ") +
            (cut.length
              ? ` -- CUT: ` + cut.map((x) => x.cut > x.room
                  ? `${x.look} ${x.state} paints ${x.cut}px above its track into a room of ` +
                    `${x.room}px, so ${x.cut - x.room}px of it is sliced off`
                  /* github#78 -- opening the clip may not change what was inside it */
                  : `${x.look} ${x.state} changed ${x.cut}px above its track, INSIDE its own ` +
                    `${x.room}px room, which the clip cannot have done`).join("; ")
              : "") +
            (missing.length
              ? ` -- NO SUCH SPINE: ` + missing.map((x) => `${x.look} ${x.state}`).join(", ")
              : "") +
            (unread.length
              ? ` -- A BAND THIS COULD NOT READ: ` + unread.map((x) => `${x.look} ${x.state}`).join(", ")
              : "") +
            (restless.length
              ? ` -- STILL MOVING WHEN MEASURED: ` + restless.join(", ")
              : "")
  };
});

/* github#47, design/0021 -- one face decides it, and it walks core.LOOKS. */
check("a short cover is stood upright by one face, not the look's", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var root = document.getElementById("vs-app");
    var looks = core.LOOKS.map(function (l) { return l.value; });
    var was = root.getAttribute("data-look") || "";

    var faceOnto = function (el, cs) {
      el.style.fontFamily = cs.fontFamily;
      el.style.fontSize = cs.fontSize;
      el.style.fontWeight = cs.fontWeight;
      el.style.fontStyle = cs.fontStyle;
      el.style.fontStretch = cs.fontStretch;
      el.style.fontVariant = cs.fontVariant;
      el.style.lineHeight = cs.lineHeight;
      el.style.letterSpacing = cs.letterSpacing;
      el.style.wordSpacing = cs.wordSpacing;
      el.style.textTransform = cs.textTransform;
      el.style.fontFeatureSettings = cs.fontFeatureSettings;
      el.style.fontVariationSettings = cs.fontVariationSettings;
    };
    var faceOf = function (cs) {
      return cs.fontFamily + " | " + cs.fontSize + " | " + cs.fontWeight + " | " +
             cs.fontStyle + " | " + cs.letterSpacing + " | " + cs.wordSpacing + " | " +
             cs.textTransform + " | " + cs.fontFeatureSettings;
    };

    /* every short cover the page actually asks about, at the width it asks about it */
    var seen = {}, order = [];
    [].slice.call(document.querySelectorAll("#vs-shelves .vs-spine")).forEach(function (s) {
      var t = s.querySelector(".vs-title");
      if (!t || t.textContent.length > 3) return;
      var k = t.textContent + "|" + Math.round(s.getBoundingClientRect().width);
      if (!(k in seen)) { seen[k] = t.textContent; order.push(k); }
    });

    var read = function () {
      var rows = {};
      /* the decision, as the page made it */
      [].slice.call(document.querySelectorAll("#vs-shelves .vs-spine")).forEach(function (s) {
        var t = s.querySelector(".vs-title");
        if (!t || t.textContent.length > 3) return;
        var k = t.textContent + "|" + Math.round(s.getBoundingClientRect().width);
        if (rows[k]) return;
        var cs = getComputedStyle(t);
        /* the string's own width in the face this look draws, with no box to clamp it */
        var free = document.createElement("span");
        free.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre";
        faceOnto(free, cs);
        free.textContent = t.textContent;
        root.appendChild(free);
        var drawn = free.getBoundingClientRect().width;
        root.removeChild(free);
        var scs = getComputedStyle(s);
        rows[k] = {
          up: s.getAttribute("data-upright") === "1",
          clipped: t.scrollWidth > t.clientWidth + 1,
          drawn: Math.round(drawn * 100) / 100,
          room: Math.round((s.clientWidth - parseFloat(scs.paddingLeft) -
                            parseFloat(scs.paddingRight)) * 100) / 100
        };
      });
      return rows;
    };

    /* the deciding face, measured the way fitsUpright measures it */
    var deciding = {};
    order.forEach(function (k) {
      var probe = document.createElement("div");
      probe.className = "vs-probe";
      var spine = document.createElement("button");
      spine.className = "vs-spine";
      spine.setAttribute("data-upright", "1");
      var title = document.createElement("span");
      title.className = "vs-title";
      title.textContent = seen[k];
      spine.appendChild(title);
      probe.appendChild(spine);
      root.appendChild(probe);
      var cs = getComputedStyle(title);
      var free = document.createElement("span");
      free.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre";
      faceOnto(free, cs);
      free.textContent = seen[k];
      root.appendChild(free);
      deciding[k] = Math.round(free.getBoundingClientRect().width * 100) / 100;
      root.removeChild(free);
      root.removeChild(probe);
    });

    var out = {}, faces = {};
    looks.forEach(function (look) {
      __vs.setLook(look);
      out[look || "modern"] = read();
      /* re-read the probe's own type under this look: it must not have moved */
      var probe = document.createElement("div");
      probe.className = "vs-probe";
      var spine = document.createElement("button");
      spine.className = "vs-spine";
      spine.setAttribute("data-upright", "1");
      var title = document.createElement("span");
      title.className = "vs-title";
      title.textContent = "A";
      spine.appendChild(title);
      probe.appendChild(spine);
      root.appendChild(probe);
      var cs = getComputedStyle(title);
      faces[look || "modern"] = faceOf(cs);
      root.removeChild(probe);
    });
    __vs.setLook(was);
    return { looks: out, order: order, faces: faces, deciding: deciding };
  })()`);

  const names = Object.keys(r.looks);
  const split = [], clipped = [], missing = [];
  let upright = 0, worst = { over: -Infinity, where: "" }, tightest = { room: Infinity, where: "" };
  for (const k of r.order) {
    const rows = names.map((n) => r.looks[n][k]);
    if (rows.some((x) => !x)) { missing.push(k); continue; }
    const up = rows.map((x) => x.up);
    if (new Set(up).size > 1) {
      split.push(`${k} ${names.map((n, i) => `${n}:${up[i] ? "upright" : "sideways"}`).join(" ")}`);
    }
    if (up[0]) upright++;
    for (let i = 0; i < names.length; i++) {
      if (!rows[i].up) continue;
      if (rows[i].clipped) clipped.push(`${names[i]} ${k}: ${rows[i].drawn} in ${rows[i].room}`);
      /* github#47 -- the widest face's spread over the deciding one. */
      const over = rows[i].drawn - r.deciding[k];
      if (over > worst.over) worst = { over: Math.round(over * 100) / 100, where: `${names[i]} ${k}` };
      const room = rows[i].room - rows[i].drawn;
      if (room < tightest.room) tightest = { room: Math.round(room * 100) / 100, where: `${names[i]} ${k}` };
    }
  }
  /* github#47 -- the probe's type must read the same in every look. */
  const px = (v) => (Number.isFinite(v) ? `${v}px` : "no upright cover to measure");
  const faces = [...new Set(Object.values(r.faces))];
  const say = (label, list) => (list.length ? `; ${list.length} ${label}: ${list.slice(0, 4).join("; ")}` : "");
  return {
    ok: !split.length && !clipped.length && !missing.length && faces.length === 1 &&
        r.order.length > 20 && upright > 0,
    detail: `${r.order.length} short covers over ${names.length} looks: ${split.length} oriented ` +
            `one way in one look and another in the next, ${clipped.length} clipped by a ` +
            `decision another face made; the probe reads ${faces.length} face ` +
            `(${faces[0]}); ${upright} stand upright, the widest face draws one ` +
            `${px(worst.over)} wider than the face that decided it (${worst.where}) and the ` +
            `tightest upright cover has ${px(tightest.room)} to spare (${tightest.where})` +
            say("split", split) + say("clipped", clipped) + say("unmeasured", missing)
  };
});

/* github#12, design/0002 */
check("a tag book's cover carries no hash, and every other place it is named keeps it", async (p) => {
  const r = await p.j(`(function(){
    var view = __vs.views().filter(function (v) { return v.shelf.classifier === "tag" && !v.shelf.hidden; })[0];
    if (!view) return { found: false };
    var before = __vs.addresses().join("|");
    var tagged = view.books.filter(function (b) { return b.key !== "-unfiled"; });
    var byId = {};
    view.books.forEach(function (b) { byId[b.id] = b; });
    var spines = [].slice.call(document.querySelectorAll('#vs-shelves [data-shelf="' + view.shelf.id + '"] .vs-spine'));
    var hashed = 0, mismatched = 0, upright = 0, short = 0, labelHash = 0, peekHash = 0;
    var covers = [];
    spines.forEach(function (s) {
      var book = byId[s.getAttribute("data-book")];
      var cover = s.querySelector(".vs-title").textContent;
      covers.push(cover);
      if (cover.charAt(0) === "#") hashed++;
      var want = book.key === "-unfiled" ? "Untagged" : book.key;
      if (cover !== want) mismatched++;
      if (book.key !== "-unfiled" && book.label === "#" + book.key) labelHash++;
      if ((s.getAttribute("data-peek") || "").split(" -- ")[0] === book.label) peekHash++;
      if (cover.length <= 3) short++;
      if (s.getAttribute("data-upright") === "1") upright++;
    });
    var deepest = tagged.slice().sort(function (a, b) { return b.key.split("/").length - a.key.split("/").length || b.notes.length - a.notes.length; })[0];
    __vs.openBook(deepest.id, null);
    var title = document.getElementById("vs-readertitle").textContent;
    var heading = document.getElementById("vs-bookname").textContent;
    var chips = [].slice.call(document.querySelectorAll(".vs-alsoin button")).map(function (b) { return b.textContent; });
    var tagChips = chips.filter(function (c) { return c.indexOf(view.shelf.name + ": ") === 0; });
    __vs.closeReader();
    var after = __vs.addresses().join("|");
    return { found: true, shelf: view.shelf.id, spines: spines.length, tagged: tagged.length,
             hashed: hashed, mismatched: mismatched, labelHash: labelHash, peekHash: peekHash,
             short: short, upright: upright, shortCovers: covers.filter(function (c) { return c.length <= 3; }),
             opened: deepest.key, title: title, heading: heading,
             titleOk: title === view.shelf.name + " \u00b7 #" + deepest.key, headingOk: heading === "#" + deepest.key,
             tagChips: tagChips.length, chipHash: tagChips.filter(function (c) { return c.indexOf(": #") > 0; }).length,
             stable: before === after, count: view.noteCount };
  })()`);
  if (!r.found) return { ok: false, detail: "no visible tag shelf in this vault" };
  const ok = r.hashed === 0 && r.mismatched === 0 && r.labelHash === r.tagged && r.peekHash === r.spines &&
             r.upright <= r.short && r.titleOk && r.headingOk && r.chipHash === r.tagChips && r.stable;
  return { ok,
           detail: `${r.shelf}: ${r.spines} spines, ${r.hashed} covers open with #, ${r.mismatched} differ from the key ` +
                   `(${r.labelHash}/${r.tagged} labels still carry it, ${r.peekHash}/${r.spines} peeks lead with the label); ` +
                   `${r.upright} upright of ${r.short} covers of three characters or fewer [${r.shortCovers.join(" ")}]; ` +
                   `open "${r.opened}": title bar "${r.title}" (${r.titleOk}), heading "${r.heading}" (${r.headingOk}), ` +
                   `${r.chipHash}/${r.tagChips} tag chips hashed; addresses unchanged (${r.stable}), ${r.count} notes` };
});

check("a spine lifts on hover and holds its size", async (p) => {
  const r = await p.j(`(function(){
    var spine = document.querySelector("#vs-shelves .vs-spine");
    var before = spine.getBoundingClientRect();
    spine.focus();
    var after = spine.getBoundingClientRect();
    return { w: Math.round(before.width), h: Math.round(before.height),
             w2: Math.round(after.width), h2: Math.round(after.height),
             lift: Math.round(before.top - after.top), top: Math.round(after.top) };
  })()`);
  // github#76 -- a rest box that is not there is not a lift
  // github#57 -- the runner drains the room before the first check
  if (!r.w || !r.h) {
    return { ok: false,
             detail: `the spine had no box at rest -- read before its first packing landed, ` +
                     `not a spine that moved. It measured ${r.w2}x${r.h2} once focused, at ` +
                     `${r.top}px from the top, and an all-zero rest rect reports top 0, so the ` +
                     `old line would have called this a lift of ${-r.top}px` };
  }
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
                               `node scripts/update-layout-snapshots.mjs writes it` };
  }
  // github#35
  const emptied = await p.j(`(function(){
    var s = __vs.settings();
    var shelf = s.shelves.filter(function (x) { return x.classifier === "pick"; })[0];
    if (!shelf || !shelf.picks || !shelf.picks.length) return 0;
    var n = shelf.picks.length;
    shelf.picks = [];
    __vs.setFilters({});
    return n;
  })()`);
  /* github#57 -- a golden read mid-repack fails a tree where nothing is wrong */
  const wasView = await p.j("({width:innerWidth,height:innerHeight})");
  await viewport(p, VIEWPORT.width, VIEWPORT.height);
  /* github#14, design/0021 -- in every look against one golden; it holds a book's width. */
  const looks = await p.j(`window.VaultShelfCore.LOOKS.map(function (l) { return l.value; })`);
  const was = await p.j(`document.getElementById("vs-app").getAttribute("data-look") || ""`);
  const golden = JSON.parse(readFileSync(file, "utf8"));
  const problems = [];
  let now = null;
  for (const look of looks) {
    await p.j(`(__vs.setLook(${JSON.stringify(look)}), 1)`);
    await sleep(250);
    const seen = await p.j(MEASURE);
    if (!now) now = seen;
    for (const bad of diffLayout(golden, seen)) problems.push(`${look || "modern"}: ${bad}`);
  }
  await p.j(`(__vs.setLook(${JSON.stringify(was)}), 1)`);
  await unviewport(p, wasView);
  const rows = now.shelves.reduce((n, s) => n + s.rows, 0);
  const spines = now.shelves.reduce((n, s) => n + s.books, 0);
  const plaques = now.shelves.reduce((n, s) => n + s.plaques.length, 0);
  void emptied;
  return {
    ok: problems.length === 0,
    detail: problems.length
      ? `${problems.length} difference(s) against ${name}.json: ` + problems.slice(0, 4).join("; ") +
        (problems.length > 4 ? ` ... (node scripts/update-layout-snapshots.mjs rewrites it)` : "")
      : `${now.shelves.length} shelves, ${rows} rows, ${spines} spines, ${plaques} plaques and a ` +
        `${now.room}px room, all where ${name}.json says at ${VIEWPORT.width}px, in all ` +
        `${looks.length} looks`
  };
});

/* ------------------------------------------------------ which vault, and why
 *
 * ONE SHAPE, and it does not need a vault of yours. decisions/0014 replaced three fixtures
 * with one that carries what all three carried: 5,000 notes over eleven years ending today,
 * every classifier populated, a recent year that is genuinely active, a declared empty year
 * for a chronological shelf to survive, a fifth of the non-daily notes undated, titles
 * opening with digits, punctuation and four scripts, notes naming five people and six tags
 * at once, and two impossible dates. Eleven years is ~574 ISO weeks, which is the long rail
 * the 10k library fixture used to be for.
 *
 * IT LIVES IN A SHARED STORE, beside the main repo, and invalidates itself. A fixture lives
 * at <main repo>/.fixtures/<name>-<digest8>, where the digest is sha256 over the CONTENTS of
 * the generator plus this fixture's args -- content, not mtime, because a branch switch
 * rewrites mtimes without changing a byte. Every worktree resolves the same store through
 * git's common dir, so the gate sees one fixture no matter where the push runs. Editing the
 * generator changes the digest and the next run regenerates; nothing needs to remember to
 * delete anything.
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
  const GENERATORS = ["make-vault.mjs"];
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

  gen("make-vault.mjs", [], "vault", "the vault (5,000 notes over eleven years)");

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

/* ----------------------------------------------------------- at rest, or -- */

/* decisions/0016 -- the budget, and quiet counted in reads rather than milliseconds */
const SETTLE_MS = 3000;
const SETTLE_QUIET = 5;
const SETTLE_GAP = 20;

/**
 * github#57, github#69, decisions/0016 -- the one thing atRest() names that self-drains
 * @param {{eval:(e:string)=>Promise<unknown>}} page
 * @param {{width:number,height:number}} [want] the viewport the page must also have reached
 * @returns {Promise<boolean>} whether it reached rest inside the budget
 */
function settled(page, want) {
  const at = want
    ? `innerWidth === ${Number(want.width)} && innerHeight === ${Number(want.height)} && `
    : "";
  return page.eval(`(async function(){
    var quiet = 0, until = Date.now() + ${SETTLE_MS};
    for (;;) {
      quiet = (${at}!(window.__vs && __vs.room().pending)) ? quiet + 1 : 0;
      if (quiet >= ${SETTLE_QUIET}) return true;
      if (Date.now() > until) return false;
      await new Promise(function (r) { setTimeout(r, ${SETTLE_GAP}); });
    }
  })()`);
}

/* github#57, decisions/0016 -- a viewport that has TAKEN, not one that was asked for */
async function viewport(p, width, height) {
  await p.send("Emulation.setDeviceMetricsOverride",
               { width, height, deviceScaleFactor: 1, mobile: false });
  await p.eval(`window.dispatchEvent(new Event("resize")); void 0`);
  if (!(await settled(p, { width, height }))) {
    throw new Error(`the viewport did not settle at ${width}x${height} in ${SETTLE_MS}ms`);
  }
}

/**
 * github#32, github#57 -- CLEAR it, never re-set it to the size it had
 * @returns {Promise<boolean>} whether the page came back to `was` and settled there
 */
async function unviewport(p, was) {
  await p.send("Emulation.clearDeviceMetricsOverride");
  await p.eval(`window.dispatchEvent(new Event("resize")); void 0`);
  return settled(p, was);
}

/**
 * github#39, decisions/0013 -- what the page is still doing.
 * @returns {Promise<string[]>} what is in flight, empty when the page is at rest
 */
async function atRest(page) {
  return page.j(`(function(){
    var out = [];
    var room = __vs.room();
    if (room.pending) out.push("a pending room measure (settleRoom's 60ms timer)");
    /* github#34 -- a loop left running scrolls the library on its own. */
    var edge = __vs.edgeScroll ? __vs.edgeScroll() : null;
    if (edge && edge.running) out.push("an edge scroll still running (github#34)");
    /* github#40 -- a band mid-spring is a page still moving. */
    var push = __vs.overscroll ? __vs.overscroll() : null;
    if (push && push.pushing) out.push("an overscroll band still held (github#40)");
    if (push && push.settling) out.push("an overscroll band still springing back (github#40)");
    var mid = document.querySelectorAll(
      "#vs-app [data-dragging], #vs-app [data-carrying], #vs-app [data-leaving], " +
      "#vs-app [data-drop], #vs-app [data-shelfdrop]");
    if (mid.length) out.push(mid.length + " element(s) still mid-drag");
    /* github#41 -- an open suggestion list is the page in flight too. */
    var open = ["reader", "builder", "manage", "madebook", "dye", "railmenu",
                "suggest"].filter(function (id) {
      var n = document.getElementById("vs-" + id);
      return n && !n.hidden;
    });
    if (open.length) out.push("left open: " + open.join(", "));
    return out;
  })()`).catch(() => []);
}

/** github#39 -- back to rest, so the next check starts clean */
async function settlePage(page) {
  await page.eval(`(function(){
    /* github#39 -- THROUGH THE PAGE'S OWN CONTROLS. Setting [hidden] by hand is what this repo
     * already got caught by once: the sheets are laid out by a class that outranks it, so the
     * attribute would read shut while the sheet was still painted over the library. */
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    /* github#34 -- the exit path a cancelled drag takes, so no loop outlives a check. */
    document.dispatchEvent(new Event("dragend", { bubbles: true }));
    ["mclose", "bcancel", "mbcancel"].forEach(function (id) {
      var b = document.getElementById("vs-" + id);
      if (b && b.offsetParent !== null) b.click();
    });
    try { __vs.closeReader(); } catch (e) {}
    /* github#41 -- and the list, through the page's own way out. */
    try { __vs.closeSuggest(); } catch (e) {}
    [].slice.call(document.querySelectorAll(
      "#vs-app [data-dragging], #vs-app [data-carrying], #vs-app [data-leaving], " +
      "#vs-app [data-drop], #vs-app [data-shelfdrop]")).forEach(function (el) {
      ["data-dragging", "data-carrying", "data-leaving", "data-drop", "data-shelfdrop"]
        .forEach(function (a) { el.removeAttribute(a); });
    });
  })(); void 0`).catch(() => {});
  /* github#39, github#57 -- waited out, never slept past; decisions/0016 */
  await settled(page).catch(() => {});
}

/* --------------------------------------------------------------- one run -- */

/**
 * github#55 -- a key the browser routes itself, not a synthetic one
 * @param {{ send: (m: string, p?: object) => Promise<unknown> }} p @param {string} key
 */
async function press(p, key) {
  const CODES = { Tab: 9, Enter: 13, Escape: 27, End: 35, Home: 36,
                  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  const code = CODES[key];
  if (!code) throw new Error(`press(): no virtual key code for "${key}"`);
  for (const type of ["rawKeyDown", "keyUp"]) {
    await p.send("Input.dispatchKeyEvent", {
      type, key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
    });
  }
}

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
  const chrome = spawn(findChrome(), harnessChromeArgs({
    port: PORT, profile, url,
    /* design/0006, github#50 -- placement is not activation; headless takes the size only */
    window: [
      ...(slot ? [`--window-position=${slot.x},${slot.y}`] : [leftWindowPos()]),
      slot ? `--window-size=${slot.w},${slot.h}` : "--window-size=1600,1000",
    ],
  }), { stdio: ["ignore", "ignore", "pipe"], detached: false });
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
    /* github#55 -- the window's focus is not the suite's business */
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
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

    /* github#57 -- the load's own resizes, drained before the first check reads */
    await settled(page).catch(() => {});
    /* github#57 -- the window every check must hand back; decisions/0016 */
    let base = await page.j("({width:innerWidth,height:innerHeight})").catch(() => null);

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
      /* github#57, decisions/0016 -- past the coalescing timer before judging */
      const drained = await settled(page).catch(() => true);
      /* github#57, decisions/0016 -- a check that threw mid-resize leaves the override on */
      let leaked = false;
      if (base) {
        leaked = await page.j(`innerWidth !== ${base.width} || innerHeight !== ${base.height}`)
          .catch(() => false);
        if (leaked) {
          await page.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
          await settled(page, base).catch(() => {});
          /* github#57, decisions/0016 -- the window itself moved, not a check */
          const now = await page.j("({width:innerWidth,height:innerHeight})").catch(() => null);
          if (now && (now.width !== base.width || now.height !== base.height)) {
            base = now;
            leaked = false;
          }
        }
      }
      /* github#39, decisions/0013 -- blame the check that left it, not its neighbour */
      const busy = await atRest(page);
      if (busy.length || leaked) {
        r = { ok: r.ok && !busy.length, detail: (r.detail || "") +
              (leaked ? ` -- LEFT THE VIEWPORT OVERRIDDEN (${base.width}x${base.height} restored)` : "") +
              (busy.length ? ` -- LEFT THE PAGE BUSY: ${busy.join("; ")}` +
                             (drained ? "" : ` (still there after ${SETTLE_MS}ms)`) : "") };
        if (busy.length) await settlePage(page);
      }
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
  /* github#13, design/0027 -- the search is live in both pictures, or in neither */
  if (SHOT_QUERY) await page.eval(`__vs.setQuery(${JSON.stringify(SHOT_QUERY)}); void 0`);
  if (SHOT_SHELF) {
    await page.eval(`(function(){
      var lib = document.getElementById("vs-library");
      var head = document.querySelector('#vs-shelves [data-shelf="' + ${JSON.stringify(SHOT_SHELF)} + '"]');
      if (!head) return;
      lib.scrollTop = head.getBoundingClientRect().top - lib.getBoundingClientRect().top + lib.scrollTop - 12;
    })(); void 0`);
  }
  if (SHOT_OPEN) {
    await page.eval(`(function(){
      var sheet = ${JSON.stringify(SHOT_OPEN)};
      if (sheet === "book") { document.querySelector('[data-shelf="favourites"] .vs-plusbook').click(); return; }
      if (sheet === "builder") { document.getElementById("vs-newshelf").click(); return; }
      document.getElementById("vs-manageopen").click();
      /* github#44 -- the popover open, one of the twelve under the pointer */
      if (sheet === "swatch") {
        var body = document.querySelector("#vs-manage .vs-sheetbody").getBoundingClientRect();
        var worn = {}, spines = document.querySelectorAll("#vs-shelves .vs-spine");
        for (var i = 0; i < spines.length; i++) {
          var b = spines[i].getBoundingClientRect();
          if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
          if (!(b.right <= body.left || b.left >= body.right ||
                b.bottom <= body.top || b.top >= body.bottom)) continue;
          var tint = getComputedStyle(spines[i]).getPropertyValue("--spine-tint").trim();
          worn[tint] = (worn[tint] || 0) + 1;
        }
        var at = 0, best = -1;
        __vs.slots().forEach(function (hex, k) {
          var n = worn[hex] || worn[hex.toLowerCase()] || 0;
          if (n > best) { best = n; at = k; }
        });
        document.querySelectorAll("#vs-mpalette .vs-dyerows tr")[at]
          .querySelector(".vs-slot .vs-swatch").click();
        var one = document.querySelectorAll("#vs-swatchpick .vs-swatches .vs-swatch")[(at + 6) % 14];
        if (one) one.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
        return;
      }
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
      if (${JSON.stringify(SHOT_OPEN)} === "book") { document.getElementById("vs-mbcancel").click(); return; }
      if (${JSON.stringify(SHOT_OPEN)} === "builder") { document.getElementById("vs-bcancel").click(); return; }
      if (${JSON.stringify(SHOT_OPEN)} === "swatch") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
      document.getElementById("vs-mpalettereset").click();
      document.getElementById("vs-mclose").click();
    })(); void 0`);
  }

  const opened = SHOT_NOTE
    ? await page.j(`(function(){
        var want = ${JSON.stringify(SHOT_NOTE)};
        var note = __vs.data().notes.filter(function (n) { return n.title === want; })[0];
        if (!note) return false;
        /* github#19 -- --shot-book beside it says WHICH of the books holding it to open */
        var inBook = ${JSON.stringify(SHOT_BOOK)};
        var home = null;
        __vs.views().forEach(function (v) { v.books.forEach(function (b) {
          if (inBook && b.id !== inBook) return;
          if (!home && b.notes.some(function (n) { return n.id === note.id; })) home = b.id;
        }); });
        return home ? __vs.openBook(home, note.id) : false;
      })()`)
    : SHOT_BOOK
      ? await page.j(`(function(){
          var want = ${JSON.stringify(SHOT_BOOK)};
          var pick = null;
          __vs.views().forEach(function (v) { v.books.forEach(function (b) {
            /* github#16 -- "smallest" is how the book with NO INDEX is photographed. */
            var hit = want === "biggest" ? (!pick || b.notes.length > pick.notes.length)
                    : want === "smallest" ? (!pick || b.notes.length < pick.notes.length)
                    : b.id === want;
            if (hit) pick = b;
          }); });
          return __vs.openBook(pick ? pick.id : want, null);
        })()`)
      : SHOT_QUERY
        ? await page.j(`(function(){
            /* github#13 -- a book the query LIT, or the picture shows nothing of it */
            var pick = null;
            __vs.views().forEach(function (v) { v.books.forEach(function (b) {
              if (!pick && b.matches > 0 && b.matches < b.notes.length && b.notes.length > 8) pick = b;
            }); });
            return pick ? __vs.openBook(pick.id, null) : __vs.openBook(__vs.addresses()[0], null);
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
    if (SHOT_TAB) {
      await page.eval(`(function(){
        var tabs = document.querySelectorAll("#vs-tabs button");
        var at = ${JSON.stringify(SHOT_TAB)} === "last" ? tabs.length - 1 : Number(${JSON.stringify(SHOT_TAB)});
        if (tabs[at]) tabs[at].click();
      })(); void 0`);
      await sleep(900);
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
  // github#8, github#37, decisions/0011, decisions/0012
  await takeLock();
  /* github#39, decisions/0013 -- the run's own clock, started after the lock */
  const began = Date.now();
  const vaults = resolveVaults();
  console.log(`checking ${vaults.length} vault(s): ${vaults.map((v) => v.label).join(", ")}`);

  if (JOBS_ASKED > LANE_CAP) {
    // github#39, decisions/0013
    console.log(`--jobs ${JOBS_ASKED} clamped to ${LANE_CAP}: two Chromes is this suite's ` +
                `ceiling, not its default`);
  }

  const shaky = picked.filter(isSerial);
  const steady = picked.filter((c) => !isSerial(c));
  const shard = (list, k) => {
    const out = Array.from({ length: k }, () => []);
    list.forEach((c, i) => out[i % k].push(c));
    return out.filter((g) => g.length);
  };
  /* github#39 -- --vault and --url run everything: the escape hatch */
  const forVault = (list, v) =>
    (v.fixture ? list.filter((c) => c.on.includes(v.fixture.name)) : list);
  /* github#39, decisions/0013 -- a lane is a whole browser; open one only for real work */
  const MIN_PER_LANE = 32;
  const lanesFor = (n) => Math.max(1, Math.min(JOBS, Math.ceil(n / MIN_PER_LANE)));

  const lanePorts = PINNED_PORT ? [] : await freePorts(Math.max(JOBS, 1));

  const parallel = [], serial = [];
  const split = [];
  for (const v of vaults) {
    const url = await buildFor(v);
    const mySteady = forVault(steady, v), myShaky = forVault(shaky, v);
    split.push({ label: v.label, steady: mySteady.length, shaky: myShaky.length });
    for (const g of shard(mySteady, lanesFor(mySteady.length))) {
      parallel.push({ vault: v, checks: g, tag: v.label, url });
    }
    if (myShaky.length) {
      serial.push({ vault: v, checks: myShaky, tag: v.label + " (layout-reading, serial)", url });
    }
  }
  /* github#39 -- the split is a number on every run */
  const runs = split.reduce((n, s) => n + s.steady + s.shaky, 0);
  console.log(`${JOBS} lane(s): ${parallel.length + serial.length} Chrome(s) for ${runs} check ` +
              `runs of ${picked.length} checks (${picked.length * vaults.length} if every check ` +
              `ran on every shape)`);
  for (const s of split) {
    console.log(`  ${String(s.steady + s.shaky).padStart(3)}  ${s.label} ` +
                `(${s.steady} parallel, ${s.shaky} layout-reading)`);
  }
  console.log("");

  const failures = new Map();
  const ran = new Map();
  const clocked = [];
  const bump = (label, r) => {
    failures.set(label, (failures.get(label) || 0) + r.failed);
    ran.set(label, (ran.get(label) || 0) + r.ran);
    for (const t of r.timings) clocked.push({ vault: label, name: t.name, ms: t.ms });
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

  // github#39
  if (TIMINGS) {
    writeFileSync(TIMINGS, JSON.stringify(clocked, null, 2) + "\n");
    const total = clocked.reduce((n, t) => n + t.ms, 0);
    console.log(`wrote ${TIMINGS}: ${clocked.length} check runs, ` +
                `${(total / 1000).toFixed(1)}s of check time`);
  }

  let worst = 0;
  for (const v of vaults) worst = Math.max(worst, failures.get(v.label) || 0);
  /* github#39 -- printed before the verdict, so a red run has it too */
  const wall = (Date.now() - began) / 1000;
  console.log("");
  console.log(`${wall.toFixed(0)}s wall for ${parallel.length + serial.length} Chrome(s) and ` +
              `${runs} check runs, after the lock`);

  if (vaults.length > 1 || JOBS > 1) {
    console.log("=".repeat(72));
    for (const v of vaults) {
      const f = failures.get(v.label) || 0, t = ran.get(v.label) || 0;
      console.log(`  ${f ? "FAIL" : " ok "}  ${t - f}/${t}  ${v.label}`);
    }
  }
  // github#5, decisions/0010
  // github#27
  const lost = FIXTURE_NAMES.filter((n) => !vaults.some((v) => v.fixture && v.fixture.name === n));
  /* github#50, decisions/0010 -- the run shape; any delta suppresses the stamp */
  /* design/0006 -- what is not shape, and why, is recorded there */
  const SHAPE = {
    "--only": [ONLY.join(","), ""],
    "--vault": [argAll("vault").join(","), ""],
    "--url": [arg("url", ""), ""],
    "--look": [LOOK || "", ""],
    "--headed": [HEADED, false],
  };
  const shifted = Object.entries(SHAPE)
    .filter(([, [is, byDefault]]) => is !== byDefault).map(([flag]) => flag);
  const partial = shifted.length ? shifted.join(" and ")
                : vaults.some((v) => !v.fixture) ? "an unstamped fixture"
                : lost.length ? `a run without ${lost.join(" and ")} (the generator failed)` : "";
  // github#25 -- the stamp is a measurement, so the hold is checked again
  if (suiteLock && !heldBy("suite", suiteLock.owner)) lostLock("somebody else");
  if (!worst && !partial) {
    let checks = 0;
    for (const t of ran.values()) checks += t;
    const r = recordPass({ fixtures: vaults.map((v) => v.fixture), checks });
    /* github#55 -- a run short of the streak says how many it owes */
    console.log(r.wrote
      ? (r.short
          ? `tree ${r.tree.slice(0, 7)} is ${r.greens}/${GREENS_REQUIRED} green: ` +
            `${r.short} more green run(s) before it is stamped`
          : `stamped tree ${r.tree.slice(0, 7)} as passed ${r.greens} times in a row: ${r.wrote}`)
      : `not stamping this run: ${r.why}`);
  } else if (!worst) {
    console.log(`not stamping this run: ${partial} is not the full suite`);
  } else if (!partial) {
    /* github#55 -- a red full run ends the streak; a partial one does not */
    const f = forgetPass({});
    console.log(f.forgot ? `red run: tree ${f.tree.slice(0, 7)} loses its green streak (${f.forgot})`
                         : `red run: no green streak to lose (${f.why})`);
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
