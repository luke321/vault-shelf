#!/usr/bin/env node

/* decisions/0004 -- THE SCALE FIXTURE.
 *
 * A 10,000-note vault over ten years. What it exists to catch is not correctness -- the demo
 * vault covers that -- but the two things that only appear at size:
 *
 *   - the Weeks shelf grows a book PER ISO WEEK, so ten years is ~520 spines on one
 *     horizontal rail, which is where virtualisation and stable book widths stop being
 *     opinions;
 *   - the Encyclopedia's biggest volume holds hundreds of notes, so the reader's index tabs
 *     have to fall back to RANGES rather than one tab per initial.
 *
 * Note count and folder placement come from the seeded PRNG alone and never from the
 * calendar, which is what scripts/check-generator-determinism.mjs asserts: a layout number
 * measured off one of these builds is worthless if the same seed can produce a different
 * vault depending on the day it ran.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OUT = resolve(arg("out", join(ROOT, "library-vault")));
const SEED = Number(arg("seed", "1010101"));
const NOTES = Number(arg("notes", "10000"));
const YEARS = Number(arg("years", "10"));
const END = arg("end", new Date().toISOString().slice(0, 10));

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const pick = (list) => list[Math.floor(rand() * list.length)];

const FOLDERS = ["Notes", "Projects", "Areas", "Resources", "Daily", "Meetings",
                 "Zettelkasten", "People", "Archive", "Literature", "Clippings",
                 "Journal", "Reading", "Courses", "Odds"];

const PEOPLE = ["Mira Vance", "Otto Brandt", "Priya Raman", "Sanne de Vries", "Tomas Ek",
                "Ines Calder", "Yuki Harada", "Ruben Ortiz", "Nadia Bloom", "Halvor Lie"];

const TAGS = ["attention", "attention/focus", "attention/drift", "garden", "garden/seeds",
              "idea", "idea/half-baked", "method", "reading", "systems", "tooling",
              "archive", "archive/cold"];


/* decisions/0003 -- A NAME THAT ONLY EVER APPEARS IN PROSE.
 * Nothing in this vault ever puts it in a people property, so a People shelf that grows a book
 * for it is a People shelf that started reading prose. scripts/smoke.mjs asserts both halves:
 * that the name IS in some bodies, and that it is in nobody's people list. */
const PROSE_ONLY = "Dagny Halvorsen";

const STATUS = ["Seedling", "Growing", "Evergreen", "Dormant", "Retired"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STEMS = ["Shelf", "Spine", "Index", "Margin", "Quire", "Folio", "Binding", "Plate",
               "Gathering", "Colophon", "Recto", "Verso", "Signature", "Leaf", "Board"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const folder of FOLDERS) mkdirSync(join(OUT, folder), { recursive: true });

const endMs = Date.parse(END + "T00:00:00Z");
const span = YEARS * 365;
let undated = 0;

for (let i = 0; i < NOTES; i++) {
  const folder = pick(FOLDERS);
  const dated = rand() > 0.05;
  if (!dated) undated++;
  const day = new Date(endMs - Math.floor(rand() * span) * 86400000).toISOString().slice(0, 10);

  const title = (rand() < 0.04 ? String(Math.floor(rand() * 999)) + " " : "") +
                pick(LETTERS.split("")) + pick(STEMS).toLowerCase() + " " + i;

  const people = [];
  const nPeople = rand() < 0.3 ? 1 + Math.floor(rand() * 3) : 0;
  for (let k = 0; k < nPeople; k++) people.push(pick(PEOPLE));

  const tags = [];
  const nTags = Math.floor(rand() * 4);
  for (let k = 0; k < nTags; k++) tags.push(pick(TAGS));

  const head = ["---"];
  if (dated) head.push("date: " + day);
  if (people.length) { head.push("people:"); for (const p of [...new Set(people)]) head.push("  - " + p); }
  if (tags.length) { head.push("tags:"); for (const t of [...new Set(tags)]) head.push("  - " + t); }
  head.push("status: " + pick(STATUS));
  head.push("---", "");

  const body = rand() < 0.1
    ? "A note, and one line of it, mentioning " + PROSE_ONLY + ".\n"
    : "A note, and one line of it.\n";
  writeFileSync(join(OUT, folder, title + ".md"), head.join("\n") + body, "utf8");
}

console.log(`wrote ${NOTES} notes to ${OUT} (seed ${SEED}, ${YEARS} years to ${END}, ` +
            `${FOLDERS.length} folders, ${undated} undated)`);
