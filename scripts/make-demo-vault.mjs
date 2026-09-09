#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* decisions/0004 -- a DECLARED vault, not a mirror of anyone's.
 *
 * Every shape this repo is checked against is generated from a seeded PRNG and a fixed
 * declaration, so no fixture needs a vault of yours and the same seed always writes the same
 * bytes. It is also the only way the people, tags and property coverage this plugin sorts on
 * can be guaranteed at all: a real vault has whatever it has, and a shelf classifier with no
 * data behind it is a check that silently passes.
 *
 * THE DATES AGE ON PURPOSE. --end defaults to today so the activity calendar's live year
 * stays exercised, which means the newest note recedes from the real clock from the moment it
 * is written. scripts/smoke.mjs regenerates a fixture older than a week. Pass --end to pin
 * one, which is what the shelf-snapshot fixture does.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OUT = resolve(arg("out", join(ROOT, "demo-vault")));
const SEED = Number(arg("seed", "20260909"));
const END = arg("end", new Date().toISOString().slice(0, 10));
const DAYS = Number(arg("days", "760"));

/* ---- the PRNG ------------------------------------------------------------
 * mulberry32: one 32-bit state, no dependencies, and identical across Node versions. The
 * whole determinism story rests on nothing here consulting the clock except --end.
 */
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
const pickN = (list, n) => {
  const out = [];
  const pool = list.slice();
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
};

/* ---- the declaration -----------------------------------------------------
 * Invented names throughout, and deliberately not the folder scheme of any one vault: the
 * point of a fixture is that every classifier has something to sort.
 */

const FOLDERS = [
  { path: "00 - Inbox", weight: 3, kind: "note" },
  { path: "01 - Projects", weight: 14, kind: "note" },
  { path: "02 - Areas", weight: 7, kind: "note" },
  { path: "03 - Resources", weight: 9, kind: "note" },
  { path: "04 - Daily Notes", weight: 28, kind: "daily" },
  { path: "05 - Meeting Notes", weight: 11, kind: "meeting" },
  { path: "06 - Zettelkasten", weight: 12, kind: "zettel" },
  { path: "07 - People", weight: 4, kind: "person" },
  { path: "08 - Archive", weight: 6, kind: "note" },
  { path: "09 - Literature Notes", weight: 6, kind: "note" },
];

const PEOPLE = ["Mira Vance", "Otto Brandt", "Priya Raman", "Sanne de Vries", "Tomas Ek",
                "Ines Calder", "Yuki Harada", "Ruben Ortiz"];

const TAGS = ["attention", "attention/focus", "garden", "garden/seeds", "garden/soil",
              "idea", "idea/half-baked", "method", "reading", "systems", "tooling",
              "работа", "学び"];

const STATUS = ["Seedling", "Growing", "Evergreen", "Dormant"];

const SUBJECTS = ["Allotment Plan", "Bee Hive Setup", "Camper Van Conversion",
                  "Greenhouse Rebuild", "Home Server Rebuild", "Kitchen Renovation",
                  "Language Exchange", "Marathon Training Block", "Photo Archive Cleanup",
                  "Thesis Chapter 3", "Website Migration", "Winter Reading",
                  "Étude in Repetition", "Übung macht den Meister",
                  "1000 Small Decisions", "3 Notes on Attention"];

const FACETS = ["log", "scope", "budget", "retro", "open questions", "next steps"];


/* decisions/0003 -- A NAME THAT ONLY EVER APPEARS IN PROSE.
 * Nothing in this vault ever puts it in a people property, so a People shelf that grows a book
 * for it is a People shelf that started reading prose. scripts/smoke.mjs asserts both halves:
 * that the name IS in some bodies, and that it is in nobody's people list. */
const PROSE_ONLY = "Dagny Halvorsen";

const WORDS = ["shelf", "spine", "index", "margin", "quire", "folio", "binding", "plate",
               "gathering", "colophon", "recto", "verso", "signature", "leaf", "board"];

function paragraph(n) {
  const out = [];
  if (rand() < 0.12) out.push("Mentioned by " + PROSE_ONLY + " in passing.");
  for (let i = 0; i < n; i++) {
    const len = 6 + Math.floor(rand() * 12);
    const words = [];
    for (let k = 0; k < len; k++) words.push(pick(WORDS));
    out.push(words.join(" ") + ".");
  }
  return out.join(" ");
}

function dayAt(offset) {
  return new Date(Date.parse(END + "T00:00:00Z") - offset * 86400000).toISOString().slice(0, 10);
}

/* ---- writing it out ------------------------------------------------------ */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const written = new Set();
let count = 0;

function write(folder, name, frontmatter, body) {
  let file = name;
  let n = 2;
  while (written.has(folder + "/" + file)) { file = name + " (" + n + ")"; n++; }
  written.add(folder + "/" + file);
  const dir = join(OUT, folder);
  mkdirSync(dir, { recursive: true });
  const head = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      if (!value.length) continue;
      head.push(key + ":");
      for (const v of value) head.push("  - " + v);
    } else if (value !== null && value !== undefined && value !== "") {
      head.push(key + ": " + value);
    }
  }
  head.push("---", "");
  writeFileSync(join(dir, file + ".md"), head.join("\n") + body + "\n", "utf8");
  count++;
}

for (const person of PEOPLE) {
  write("07 - People", person, { tags: ["person"] },
        "# " + person + "\n\n" + paragraph(2));
}

for (const folder of FOLDERS) {
  if (folder.kind === "person") continue;
  const notes = folder.weight * 4;
  for (let i = 0; i < notes; i++) {
    const offset = Math.floor(rand() * DAYS);
    const day = dayAt(offset);
    const people = rand() < 0.35 ? pickN(PEOPLE, 1 + Math.floor(rand() * 2)) : [];
    const tags = pickN(TAGS, Math.floor(rand() * 3));
    const undated = folder.kind === "note" && rand() < 0.06;

    if (folder.kind === "daily") {
      write(folder.path, day, { date: day, people, tags },
            "## Notes\n\n" + paragraph(2) + "\n\n- " + pick(WORDS) + "\n- " + pick(WORDS));
      continue;
    }
    if (folder.kind === "meeting") {
      const subject = pick(SUBJECTS);
      write(folder.path, day + " " + subject,
            { date: day, people: people.length ? people : pickN(PEOPLE, 2), tags },
            "## " + subject + "\n\n" + paragraph(3));
      continue;
    }
    if (folder.kind === "zettel") {
      write(folder.path, pick(SUBJECTS) + " — " + pick(FACETS),
            { date: undated ? "" : day, tags: tags.length ? tags : ["idea"],
              status: pick(STATUS), people },
            paragraph(4));
      continue;
    }
    write(folder.path, pick(SUBJECTS) + " — " + pick(FACETS),
          { date: undated ? "" : day, tags, status: pick(STATUS), people },
          "# " + pick(SUBJECTS) + "\n\n" + paragraph(3));
  }
}

write("", "Dashboard", { tags: ["map"] }, "# Dashboard\n\n" + paragraph(1));
write("", "Home", { tags: ["map"] }, "# Home\n\n" + paragraph(1));

console.log(`wrote ${count} notes to ${OUT} (seed ${SEED}, end ${END}, ${DAYS} days)`);
