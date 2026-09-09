#!/usr/bin/env node

/* decisions/0004 -- THE AWKWARD SHAPE.
 *
 * The demo vault is evenly populated and every classifier finds something. This one is
 * everything that goes wrong in a real library, on purpose:
 *
 *   - a fifth of the notes have NO DATE AT ALL, so the Undated book is large rather than a
 *     curiosity, and the Years/Months/Weeks shelves all have to carry it;
 *   - ONE FOLDER HOLDS most of the vault, so the source-colour band on a spine is nearly
 *     always one colour and the folder filter has one obvious answer;
 *   - the dates cluster in TWO DISTANT YEARS with a hole between them, which is what a
 *     chronological shelf's ordering and the activity calendar's year buttons have to
 *     survive;
 *   - titles start with digits, punctuation, accents and non-Latin scripts, so the
 *     Encyclopedia's 0-9 volume and its non-Latin books are populated rather than
 *     hypothetical;
 *   - a handful of notes name FIVE PEOPLE and carry six tags, so one note lands in eleven
 *     books at once and the unique-membership law has something to be wrong about;
 *   - some notes sit at the VAULT ROOT with no folder.
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

const OUT = resolve(arg("out", join(ROOT, "sparse-vault")));
const SEED = Number(arg("seed", "424242"));
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
const pickN = (list, n) => {
  const out = [];
  const pool = list.slice();
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
};


/* decisions/0003 -- A NAME THAT ONLY EVER APPEARS IN PROSE.
 * Nothing in this vault ever puts it in a people property, so a People shelf that grows a book
 * for it is a People shelf that started reading prose. scripts/smoke.mjs asserts both halves:
 * that the name IS in some bodies, and that it is in nobody's people list. */
const PROSE_ONLY = "Dagny Halvorsen";

const PEOPLE = ["Mira Vance", "Otto Brandt", "Priya Raman", "Sanne de Vries", "Tomas Ek",
                "Ines Calder", "Yuki Harada"];
const TAGS = ["archive", "archive/cold", "archive/warm", "attention", "idea", "method",
              "reading", "systems"];
const STATUS = ["Seedling", "Growing", "Evergreen", "Dormant"];

const TITLES = [
  "0 to 1", "1000 Small Decisions", "3 Notes on Attention", "42 and after",
  "— a dash to open with", "(parenthetical)", "\"quoted opening\"",
  "Étude in Repetition", "Übung macht den Meister", "Ångström and the small",
  "работа над ошибками", "学びのノート", "מסמך אחד",
  "Aftermath", "Binding", "Colophon", "Deckle", "Endpaper", "Folio", "Gathering",
  "Headband", "Imposition", "Jacket", "Kettle Stitch", "Leaf", "Margin", "Nib",
];

/* One folder holds most of it, and the rest are slivers. */
const FOLDERS = [
  { path: "Notes", count: 620 },
  { path: "Projects", count: 48 },
  { path: "Reference", count: 31 },
  { path: "Daily", count: 44 },
  { path: "Odds", count: 7 },
  { path: "", count: 6 },
];

/* Two clusters, five years apart, with nothing in between. */
function dayFor() {
  const endMs = Date.parse(END + "T00:00:00Z");
  const recent = rand() < 0.55;
  const offset = recent
    ? Math.floor(rand() * 400)
    : 1800 + Math.floor(rand() * 400);
  return new Date(endMs - offset * 86400000).toISOString().slice(0, 10);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const written = new Set();
let count = 0, undated = 0, crowded = 0;

function write(folder, name, frontmatter, body) {
  let file = name;
  let n = 2;
  while (written.has(folder + "/" + file)) { file = name + " " + n; n++; }
  written.add(folder + "/" + file);
  const dir = folder ? join(OUT, folder) : OUT;
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
  writeFileSync(join(dir, file.replace(/[\\/:*?"<>|]/g, "-") + ".md"),
                head.join("\n") + body + "\n", "utf8");
  count++;
}

for (const folder of FOLDERS) {
  for (let i = 0; i < folder.count; i++) {
    const dated = rand() > 0.2;
    if (!dated) undated++;
    const busy = rand() < 0.04;
    if (busy) crowded++;
    const people = busy ? pickN(PEOPLE, 5) : rand() < 0.3 ? pickN(PEOPLE, 1) : [];
    const tags = busy ? pickN(TAGS, 6) : pickN(TAGS, Math.floor(rand() * 2));
    write(folder.path, pick(TITLES), {
      date: dated ? dayFor() : "",
      people,
      tags,
      status: rand() < 0.7 ? pick(STATUS) : "",
    }, rand() < 0.15
         ? "Mentioned by " + PROSE_ONLY + " in passing, and nothing else worth reading."
         : "One paragraph, and nothing else worth reading.");
  }
}

console.log(`wrote ${count} notes to ${OUT} (seed ${SEED}, end ${END}); ` +
            `${undated} undated, ${crowded} in eleven books at once`);
