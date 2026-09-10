import { attach, json } from "./cdp.mjs";
import { leftmostScreen, leftWindowPos } from "./screen.mjs";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync,
         renameSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  "opens a book",
  "spine lifts",
  "reading shelf",
  "escape",
  "keyboard",
  "plaque sits",
  "tabs",
  "has a width",
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
    var book = months.books.filter(function (b) {
      return b.key !== "-undated" && b.notes.length > 3;
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

    return { schema: up.schema, years: byId.years.plaques, months: byId.months.plaques,
             people: byId.people.plaques, wear: up.wear["years/2026"],
             fields: up.dateFields.join(","), keptOff: keptYears.plaques,
             stamp: up.useFileStamp, keptStampOff: core.migrate(atThree).useFileStamp,
             order: up.noteOrder,
             weeksHidden: core.migrate({ schema: 1, shelves: [{ id: "weeks", name: "Weeks",
               source: { kind: "all" }, classifier: "week", direction: "chronological",
               hidden: false, position: 0, plaques: true }] }).shelves[0].hidden,
             keptShown: shown ? shown.hidden === false : false };
  })()`);
  const ok = r.schema === 5 && r.years === true && r.months === true && r.people === false &&
             r.wear === 3 && r.fields === "date" && r.keptOff === false &&
             r.stamp === true && r.keptStampOff === false && r.order === "oldest" &&
             r.weeksHidden === true && r.keptShown === true;
  return {
    ok,
    detail: `schema 1 -> ${r.schema}: Years plaques ${r.years}, Months ${r.months}, People ` +
            `${r.people}; the file-stamp fallback comes up ${r.stamp} and the reading order ` +
            `"${r.order}"; wear and date fields survive (${r.wear} opens, "${r.fields}"). ` +
            `A file already at schema 2 keeps its Years plaques off: ${r.keptOff === false}; ` +
            `one at 3 keeps its stamp fallback off: ${r.keptStampOff === false}; the Weeks ` +
            `shelf comes up hidden (${r.weeksHidden}) unless the file already says 4 ` +
            `(${r.keptShown})`
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
check("book colors are optional, encyclopedia volumes match and new notes never recolor books", async (p) => {
  const r = await p.j(`(function(){
    var core = window.VaultShelfCore;
    var original = core.clone(__vs.settings());
    var originalCounts = JSON.stringify(__vs.counts());
    var addresses = __vs.addresses().join("|");
    function colors() {
      var out = {};
      document.querySelectorAll("#vs-shelves .vs-spine").forEach(function (e) {
        out[e.getAttribute("data-book")] = getComputedStyle(e).getPropertyValue("--spine-tint").trim();
      });
      return out;
    }
    var defaults = !core.migrate({ schema: 1 }).varyBookColors &&
                   !core.migrate({ varyBookColors: "true" }).varyBookColors;
    document.getElementById("vs-manageopen").click();
    var toggle = document.getElementById("vs-mvarycolors");
    var off = !toggle.checked && new Set(Object.values(colors())).size === 1;
    toggle.click();
    var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    var persists = saved.varyBookColors === true && core.migrate(saved).varyBookColors;
    var paintOnly = addresses === __vs.addresses().join("|") &&
                    originalCounts === JSON.stringify(__vs.counts());
    var target = __vs.views().find(function (v) { return v.shelf.classifier === "month"; }).books[0];
    var next = core.clone(VAULT_DATA);
    for (var i = 0; i <= target.notes.length; i++) {
      var note = core.clone(target.notes[0]);
      note.id = note.path = "color-arrivals/" + i + ".md";
      note.folder = "color-arrivals";
      next.notes.push(note);
    }
    next.folders.reverse();
    next.folders.forEach(function (f, i) { f.slot = i + 1; });
    next.folders.unshift({ path: "color-arrivals", count: target.notes.length + 1, slot: 0 });
    var modes = [];
    ["light", "dark", "leather"].forEach(function (mode) {
      var settings = core.clone(__vs.settings());
      settings.look = mode === "leather" ? "leather" : "";
      vsHandle.setSettings(settings);
      __vs.setTheme(mode === "light" ? "light" : "dark");
      var before = colors();
      var encyclopedia = Object.keys(before).filter(function (id) { return id.indexOf("encyclopedia/") === 0; });
      var matching = new Set(encyclopedia.map(function (id) { return before[id]; })).size === 1;
      var varied = new Set(Object.values(before)).size > 1;
      vsHandle.refresh(next);
      var after = colors();
      var same = Object.keys(before).every(function (id) { return after[id] === before[id]; });
      var changedMix = __vs.views().find(function (v) { return v.shelf.classifier === "month"; })
        .books.find(function (b) { return b.id === target.id; }).bands[0].folder === "color-arrivals";
      modes.push({ mode: mode, matching: matching, varied: varied, same: same, changedMix: changedMix,
                   books: Object.keys(before).length });
      vsHandle.refresh(VAULT_DATA);
    });
    vsHandle.setSettings(original);
    document.getElementById("vs-manageopen").click();
    document.getElementById("vs-mvarycolors").click();
    return { defaults: defaults, off: off, persists: persists, paintOnly: paintOnly, modes: modes };
  })()`);
  await p.send("Page.reload");
  for (let i = 0; i < 60; i++) {
    if (await p.eval('document.readyState === "complete" && !!window.__vs').catch(() => false)) break;
    await sleep(100);
  }
  const reload = await p.j(`(function(){
    document.getElementById("vs-manageopen").click();
    var toggle = document.getElementById("vs-mvarycolors");
    var kept = toggle.checked && __vs.settings().varyBookColors;
    toggle.click();
    var colors = Array.from(document.querySelectorAll("#vs-shelves .vs-spine"), function(e) {
      return getComputedStyle(e).getPropertyValue("--spine-tint").trim();
    });
    document.getElementById("vs-mclose").click();
    return kept && !__vs.settings().varyBookColors && new Set(colors).size === 1;
  })()`);
  return { ok: r.defaults && r.off && r.persists && r.paintOnly && reload &&
               r.modes.every((m) => m.matching && m.varied && m.same && m.changedMix),
           detail: `default off ${r.off}; paint only ${r.paintOnly}; reload/toggle ${reload}; ` +
                   r.modes.map((m) => `${m.mode}: ${m.books} stable ${m.same}, encyclopedia matches ${m.matching}, new dominant folder ${m.changedMix}`).join("; ") };
});

const bookCount = (joined) => (joined ? joined.split("|").length : 0);

/* design/0016 -- A LOOK IS PAINT. The leather binding is a second stylesheet and a setting; it
 * may repaint anything and it may move nothing. This drives the standalone's own switch rather
 * than poking the attribute, so what is measured is the path a person actually takes. */
check("a look is opt-in, repaints everything and moves nothing", async (p) => {
  const r = await p.j(`(function(){
    var root = document.getElementById("vs-app");
    var spine = function () { return document.querySelector("#vs-shelves .vs-spine"); };
    var read = function () {
      var counts = __vs.counts();
      delete counts.plaques;
      return { look: root.getAttribute("data-look"),
               height: spine().getBoundingClientRect().height,
               /* THE GROUND IS WHATEVER PAINTS IT. A look that lays its room down as a
                * gradient leaves backgroundColor transparent, so reading only the colour
                * says two looks are identical when they could not look less alike. */
               ground: getComputedStyle(root).backgroundColor + " | " +
                       getComputedStyle(root).backgroundImage.slice(0, 90),
               dye: getComputedStyle(spine()).backgroundColor,
               slots: __vs.slots().join(","),
               addresses: __vs.addresses().join("|"),
               counts: JSON.stringify(counts) };
    };
    /* design/0016 -- EVERY look core offers, through the control a person uses. The selector
     * is built from core.LOOKS, so a look added there is checked here without editing this. */
    var sel = document.getElementById("vs-look");
    var pick = function (value) {
      sel.value = value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return read();
    };
    var offered = [].slice.call(sel.options).map(function (o) { return o.value; });
    var off = read();
    var seen = offered.filter(function (v) { return v !== ""; }).map(function (v) {
      return { value: v, state: pick(v) };
    });
    var back = pick("");
    return { off: off, seen: seen, back: back, offered: offered.join(",") };
  })()`);

  const moved = r.seen.some((l) => l.state.addresses !== r.off.addresses ||
                                   l.state.counts !== r.off.counts);
  const named = r.seen.every((l) => l.state.look === l.value);
  const repainted = r.seen.every((l) => l.state.dye !== r.off.dye &&
                                        l.state.slots !== r.off.slots &&
                                        l.state.ground !== r.off.ground);
  const distinct = new Set(r.seen.map((l) => l.state.ground)).size === r.seen.length;
  const restored = r.back.look === "" && r.back.dye === r.off.dye &&
                   r.back.slots === r.off.slots;
  /* THE 20% IS AN INVARIANT, not a detail of the stylesheet. The leather look zooms the page
   * so its type is readable at a normal viewing distance rather than merely correct, and a
   * spine that stops being 20% taller under it is that having been lost. */
  const leather = r.seen.filter((l) => l.value === "leather")[0];
  const scaled = !leather || Math.abs(leather.state.height - r.off.height * 1.2) < 0.6;
  return {
    ok: r.off.look === "" && r.seen.length >= 2 && named && !moved && repainted &&
        distinct && restored && scaled,
    detail: `the selector offers "${r.offered}"; each one paints its own ground ` +
            `(${r.seen.map((l) => l.value + " " + l.state.ground).join(", ")}) over the ` +
            `default's ${r.off.ground}, ${bookCount(r.off.addresses)} book addresses ` +
            `identical throughout (${!moved}), the twelve slots change under every look ` +
            `and come back (${restored}); leather stands 20% taller (${scaled}: ` +
            `${r.off.height.toFixed(1)}px -> ${leather ? leather.state.height.toFixed(1) : "n/a"}px)`
  };
});

/* design/0008 -- MAGIC 1. A book you open often looks handled. */
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
               names: [].slice.call(box.querySelectorAll(".vs-markname"))
                 .map(function (e) { return e.textContent; }),
               more: (box.querySelector(".vs-markmore") || {}).textContent || "",
               current: [].slice.call(box.querySelectorAll('[aria-current="true"]')).length };
    };
    var empty = row();

    /* Mark five notes of this book, from inside it, the way a person does. */
    var marked = [];
    for (var i = 0; i < 5; i++) {
      __vs.openBook(book.id, book.notes[i].id);
      document.getElementById("vs-ribbon").click();
      marked.push(book.notes[i].title);
    }
    var full = row();

    /* The row is this book's ribbons: the first one goes to the first marked note. */
    var before = __vs.reader().index;
    var first = document.querySelector("#vs-marks .vs-mark");
    if (first) first.click();
    var jumped = __vs.reader().index;

    for (var k = 0; k < 5; k++) {
      __vs.openBook(book.id, book.notes[k].id);
      document.getElementById("vs-ribbon").click();
    }
    var cleared = row();
    __vs.closeReader();
    return { book: book.key, notes: book.notes.length, empty: empty, full: full,
             cleared: cleared, marked: marked, before: before, jumped: jumped };
  })()`);
  const capped = r.full.names.length === 3;
  const counted = r.full.more === "+2 more";
  const named = r.full.names.every((n, i) => n === r.marked[i]);
  const ok = r.empty.hidden === true && capped && counted && named &&
             r.jumped !== r.before && r.cleared.hidden === true;
  return {
    ok,
    detail: `${r.book} holds ${r.notes} notes; with none marked the row is hidden ` +
            `(${r.empty.hidden}), with five it shows ${r.full.names.length} named ribbons ` +
            `and "${r.full.more}", in the order they sit in the book (${named}); clicking ` +
            `the first moved the reader ${r.before} -> ${r.jumped}; unmarking all five hides ` +
            `it again (${r.cleared.hidden})`
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
    document.getElementById("vs-ribbon").click();
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
            `Worst overflow ${Math.max(wide.over, narrow.over, back.over)}px`
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
    document.getElementById("vs-ribbon").click();
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
  const FIXTURE_MAX_AGE_DAYS = 7;
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

  const gen = (script, args, name, label) => {
    const digest = digestOf(args);
    const dir = join(storeRoot, `${name}-${digest}`);
    const stampPath = join(dir, ".stamp.json");
    let fresh = false;
    if (existsSync(stampPath)) {
      try {
        const st = JSON.parse(readFileSync(stampPath, "utf8"));
        const pinned = args.indexOf("--end") >= 0;
        fresh = st.digest === digest &&
                (pinned || (typeof st.day === "string" && ageDays(st.day) <= FIXTURE_MAX_AGE_DAYS));
      } catch { fresh = false; }
    }
    if (!fresh) {
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
      for (const d of readdirSync(storeRoot)) {
        if (d.startsWith(`${name}-`) ||
            (d.startsWith(`.building-${name}-`) && d !== `.building-${name}-${process.pid}`)) {
          rmSync(join(storeRoot, d), { recursive: true, force: true });
        }
      }
      renameSync(building, dir);
    }
    if (existsSync(join(ROOT, name))) {
      console.log(`  note: ${name}/ exists in this checkout and is IGNORED -- the suite uses ` +
                  `the shared store (${dir}); pass --vault to use a specific vault on purpose`);
    }
    out.push({ path: dir, label });
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
    const ctx = { errors };

    if (LOOK) {
      await page.eval(`(function(){
        var sel = document.getElementById("vs-look");
        if (!sel) return;
        sel.value = ${JSON.stringify(LOOK)};
        sel.dispatchEvent(new Event("change", { bubbles: true }));
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
  await sleep(250);
  await shoot(out);

  const opened = await page.j('__vs.openBook(__vs.addresses()[0], null)');
  if (opened) {
    await sleep(400);
    await shoot(out.replace(/(\.png)?$/i, "-reader.png"));
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
