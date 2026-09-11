#!/usr/bin/env node
// decisions/0004, decisions/0014, github#17

/* github#17, decisions/0004, decisions/0014 -- three passes: byte-identical at one --end,
 * the same vault with every date masked, and each date either moved with --end or kept its
 * literal. `--selftest` breaks the law four ways in a COPY of the generator. */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync,
         writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SELFTEST = process.argv.slice(2).includes("--selftest");

const GENERATORS = [
  { script: join(HERE, "make-vault.mjs"), args: [] },
];
const END_A = "2024-02-10";
const END_B = "2027-09-28";
const nowMs = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

/* A date only if it round-trips: `2023-02-30` is date-shaped and is a declared impossible
 * header (decisions/0003). */
const DATE = /\d{4}-\d{2}-\d{2}/g;
const realDate = (text) => {
  const ms = Date.parse(text + "T00:00:00Z");
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === text;
};

/* A NUL, not a space -- a vault path has spaces in it. */
const SEP = "\u0000";

/** Every markdown file in a vault, by path, in a stable order. */
function readVault(dir) {
  /** @type {{ path: string, body: string }[]} */
  const notes = [];
  (function walk(d) {
    for (const name of readdirSync(d).sort()) {
      if (name === ".obsidian" || name === ".stamp.json") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!name.endsWith(".md")) continue;
      notes.push({ path: relative(dir, p).replace(/\\/g, "/"), body: readFileSync(p, "utf8") });
    }
  })(dir);
  return notes;
}

/** The note with every real date replaced by `<DATE>`, plus those dates in the order they sat. */
function maskOf(note, endMs) {
  /** @type {{ at: string, offset: number }[]} */
  const dates = [];
  const mask = (text) => text.replace(DATE, (hit) => {
    if (!realDate(hit)) return hit;
    dates.push({ at: hit, offset: Math.round((endMs - Date.parse(hit + "T00:00:00Z")) / 86400000) });
    return "<DATE>";
  });
  return { key: mask(note.path) + SEP + mask(note.body), dates };
}

const nameOf = (note) => note.key.split(SEP)[0];

function generate(script, args, out, end) {
  const r = spawnSync(process.execPath, [script, ...args, "--out", out, "--end", end],
                      { stdio: ["ignore", "ignore", SELFTEST ? "ignore" : "inherit"] });
  return r.status === 0;
}

/** @returns {{ problems: string[], summary: string }} */
function verify(script, args, scratch) {
  const temp = () => { const d = mkdtempSync(join(tmpdir(), "vs-det-")); scratch.push(d); return d; };
  const label = basename(script);
  const outA = temp();
  const outB = temp();
  const outC = temp();

  if (!generate(script, args, outA, END_A) ||
      !generate(script, args, outB, END_B) ||
      !generate(script, args, outC, END_A)) {
    return { problems: [`${label}: a generation failed`], summary: "" };
  }

  /* ---- pass 0: the same seed and the same --end, twice ---- */
  const bytes = (dir) => readVault(dir).map((n) => n.path + SEP + n.body).join("");
  if (bytes(outA) !== bytes(outC)) {
    return { problems: [`${label}: two runs at the same seed and the same --end wrote different ` +
                        `bytes, so nothing else here means anything`], summary: "" };
  }

  const a = readVault(outA).map((n) => maskOf(n, Date.parse(END_A + "T00:00:00Z")));
  const b = readVault(outB).map((n) => maskOf(n, Date.parse(END_B + "T00:00:00Z")));

  /* ---- pass 1: with the dates masked, the two vaults are the same vault ---- */
  if (a.length !== b.length) {
    return { problems: [`${label}: ${a.length} notes at --end ${END_A} and ${b.length} at ` +
                        `${END_B}; the note COUNT depends on the generation day`], summary: "" };
  }
  /* A date in a filename moves where a note sorts; offsets are the tie-break. */
  const order = (n) => n.key + SEP + n.dates.map((d) => d.offset).join(",");
  a.sort((x, y) => (order(x) < order(y) ? -1 : order(x) > order(y) ? 1 : 0));
  b.sort((x, y) => (order(x) < order(y) ? -1 : order(x) > order(y) ? 1 : 0));

  const differing = [];
  for (let i = 0; i < a.length && differing.length < 4; i++) {
    if (a[i].key !== b[i].key) {
      differing.push(nameOf(a[i]) === nameOf(b[i])
        ? `${nameOf(a[i])} (its frontmatter or body differs)`
        : `${nameOf(a[i])} vs ${nameOf(b[i])}`);
    }
  }
  if (differing.length) {
    return { problems: [`${label}: with every date masked the two runs are NOT the same vault ` +
                        `-- something other than a date moved with --end:\n    ` +
                        differing.join("\n    ")], summary: "" };
  }

  /* ---- pass 2: every date moved with --end, or did not move at all ---- */
  let moved = 0;
  let anchored = 0;
  const wrong = [];
  for (let i = 0; i < a.length && wrong.length < 4; i++) {
    const da = a[i].dates;
    const db = b[i].dates;
    if (da.length !== db.length) {
      wrong.push(`${nameOf(a[i])}: ${da.length} dates vs ${db.length}`);
      continue;
    }
    for (let k = 0; k < da.length; k++) {
      if (da[k].offset === db[k].offset) { moved++; continue; }
      if (da[k].at === db[k].at) {
        /* github#17 -- a clock-drawn date is identical in both runs too, so an anchored one
         * near TODAY is the clock rather than the declaration. */
        if (Math.abs(nowMs - Date.parse(da[k].at + "T00:00:00Z")) / 86400000 < 400) {
          wrong.push(`${nameOf(a[i])}: ${da[k].at} is the same at both end dates and sits ` +
                     `within a year of TODAY -- it came from the clock, not from --end`);
          break;
        }
        anchored++;
        continue;
      }
      wrong.push(`${nameOf(a[i])}: ${da[k].at} became ${db[k].at}, which is neither the same ` +
                 `offset from --end (${da[k].offset} vs ${db[k].offset}) nor the same date`);
      break;
    }
  }
  if (wrong.length) {
    return { problems: [`${label}: ${wrong.length}+ date(s) neither moved with --end nor ` +
                        `stayed put:\n    ` + wrong.join("\n    ")], summary: "" };
  }

  const folders = new Set(a.map((n) => {
    const path = nameOf(n);
    return path.indexOf("/") >= 0 ? path.slice(0, path.lastIndexOf("/")) : ".";
  }));
  return { problems: [], summary:
    `${label} clean -- ${a.length} notes in ${folders.size} folders, byte-identical at the ` +
    `same --end; with dates masked the two end dates are the same vault; ${moved} dates ` +
    `moved with --end and ${anchored} are declared fixed` };
}

/* ------------------------------------------------------------------ --selftest
 * github#17 -- four breaks the old per-folder-count check passed, applied to a COPY. */
const BREAKS = [
  ["a tag list that depends on the calendar year",
   "    /** @type {Record<string, unknown>} */\n    const fm = { type: TYPE_OF[kind] };",
   "    /** @type {Record<string, unknown>} */\n    const fm = { type: TYPE_OF[kind] };\n" +
   "    fm.tags = [\"year-\" + day.slice(0, 4)];"],
  ["a title word that depends on the generation day",
   "  const base = folder.deck ? fromDeck(folder.deck, DECKS[folder.deck])\n" +
   "                           : fromDeck(\"phrases\", PHRASES);",
   "  const base = (folder.deck ? fromDeck(folder.deck, DECKS[folder.deck])\n" +
   "                            : fromDeck(\"phrases\", PHRASES)) + \" \" + dayAt(0).slice(0, 4);"],
  ["a body sentence that depends on --end",
   "const para = (n) => {\n  const out = [];",
   "const para = (n) => {\n  const out = [];\n" +
   "  out.push(\"Written in \" + dayAt(0).slice(0, 4) + \".\");"],
  ["a date drawn from the clock instead of --end",
   "write(\"\", \"Home\", { type: \"note\", tags: [\"map\"] },",
   "write(\"\", \"Home\", { type: \"note\", tags: [\"map\"],\n" +
   "        seen: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10) },"],
];

function selftest() {
  const scratch = [];
  let bad = 0;
  try {
    const source = GENERATORS[0].script;
    const original = readFileSync(source, "utf8");
    const clean = verify(source, GENERATORS[0].args, scratch);
    console.log(`  ${clean.problems.length ? "FAIL" : "ok  "} the generator as committed passes`);
    if (clean.problems.length) { bad++; for (const p of clean.problems) console.log("       " + p); }

    for (const [what, from, to] of BREAKS) {
      if (!original.includes(from)) {
        console.log(`  FAIL cannot stage "${what}" -- the generator no longer has that shape, ` +
                    `so this case has stopped being tested`);
        bad++;
        continue;
      }
      const dir = mkdtempSync(join(tmpdir(), "vs-det-break-"));
      scratch.push(dir);
      const copy = join(dir, "make-vault.mjs");
      writeFileSync(copy, original.replace(from, to), "utf8");
      /* A break that stops the generator running would "fail" for the wrong reason. */
      const runs = generate(copy, GENERATORS[0].args, join(dir, "out"), "2026-09-11");
      if (!runs) {
        console.log(`  FAIL "${what}" does not build, so catching it proves nothing`);
        bad++;
        continue;
      }
      const got = verify(copy, GENERATORS[0].args, scratch);
      console.log(`  ${got.problems.length ? "ok  " : "FAIL"} ${what} is caught`);
      if (!got.problems.length) bad++;
    }
  } finally {
    for (const d of scratch) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
  console.log(bad ? `\nselftest: ${bad} case(s) did not behave` : "\nselftest: all passed");
  process.exit(bad ? 1 : 0);
}

if (SELFTEST) selftest();

const problems = [];
const scratch = [];
try {
  for (const g of GENERATORS) {
    const got = verify(g.script, g.args, scratch);
    if (got.problems.length) problems.push(...got.problems);
    else console.log("check-generator-determinism: " + got.summary);
  }
} finally {
  for (const d of scratch) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
}

if (!problems.length) process.exit(0);
console.error(`\ncheck-generator-determinism: ${problems.length} problem(s)\n`);
for (const p of problems) console.error("  " + p);
console.error(`
The generator declares that nothing consults the calendar except --end, and that --end moves
WHICH CALENDAR DATES the notes get and nothing else: not a title, not a tag, not a person, not
a folder, not a word of a body. A layout number measured off a fixture is worthless if the
same seed can produce a different vault depending on the day it ran, and a date drawn from the
clock rather than from --end is how that happens quietly. Run --selftest if you suspect the
check rather than the generator.`);
process.exit(1);
