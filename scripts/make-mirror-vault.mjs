#!/usr/bin/env node
// decisions/0004, design/0013

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const VAULT = resolve(opt("vault", process.env.VAULT_SHELF_VAULT || process.env.OBSIDIAN_VAULT || ""));
const OUT = resolve(opt("out", join(ROOT, "mirror-vault")));
const SEED = Number(opt("seed", 7));
const QUIET = argv.includes("--quiet");
const say = (m) => { if (!QUIET) console.log(m); };

if (!VAULT || !existsSync(VAULT)) {
  console.error("no vault: pass --vault <path>, or set VAULT_SHELF_VAULT / OBSIDIAN_VAULT");
  process.exit(1);
}
if (OUT === VAULT || OUT.startsWith(VAULT + sep)) {
  console.error("refusing to write inside the source vault");
  process.exit(1);
}

/* ------------------------------------------------------------------ random --
 * mulberry32, seeded on purpose: an unseeded generator makes every regeneration a different
 * vault, so a re-recorded film differs everywhere and no comparison between two takes means
 * anything.
 */
let _s = SEED >>> 0;
const rnd = () => {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/* ------------------------------------------------------------ name sources --
 * Invented, and deliberately not near anybody's real vocabulary.
 */
let FIRST = ["Ada", "Alan", "Grace", "Edsger", "Barbara", "Donald", "Frances", "Ken",
  "Radia", "Leslie", "Tony", "Niklaus", "Kathleen", "Ivan", "Maurice", "Jean", "Karen",
  "Peter", "Sophie", "Marta", "Ruth", "Vint", "Anita", "Erik", "Nadia", "Otto", "Ines",
  "Halvor", "Yuki", "Priya", "Sanne", "Tomas", "Ruben", "Mira"];
let LAST = ["Lovelace", "Turing", "Hopper", "Dijkstra", "Liskov", "Knuth", "Allen",
  "Thompson", "Perlman", "Lamport", "Hoare", "Wirth", "Booth", "Sutherland", "Wilkes",
  "Bartik", "Uhlenbeck", "Naur", "Wilson", "Estrin", "Cerf", "Borg", "Meyer", "Falk",
  "Calder", "Vance", "Brandt", "Raman", "Ortiz", "Harada", "Ek", "Lie"];
let ADJ = ["quiet", "narrow", "second", "amber", "hollow", "northern", "plain", "steady",
  "distant", "folded", "open", "level", "gentle", "sharp", "silver", "early", "late",
  "broad", "shallow", "warm", "cold", "still", "loose", "tight", "clear", "vague"];
let NOUN = ["harbour", "signal", "ledger", "lantern", "corridor", "meadow", "junction",
  "cadence", "threshold", "compass", "anchor", "trellis", "basin", "ridge", "ferry",
  "orchard", "kiln", "quarry", "beacon", "sluice", "cairn", "vane", "spindle", "weir"];
let TOPIC = ["logistics", "drainage", "typography", "ferries", "beekeeping", "masonry",
  "cartography", "acoustics", "hydrology", "printing", "glassware", "rope", "signals",
  "surveying", "milling", "joinery", "tides", "lettering", "bindery", "foundry"];

/* WHOLE SENTENCES, not a bag of words. The filler is on screen in the reader for a third of
 * the film, and a paragraph of shuffled nouns reads as broken software rather than as somebody
 * else's notes. These are dull on purpose: nothing here should be more interesting than the
 * shelf behind it. */
let SENTENCES = [
  "The quiet ledger records what the harbour forgets.",
  "A signal arrives before the ferry and leaves well after it.",
  "Every corridor eventually meets a stair, and the stair is never where the plan put it.",
  "The compass is honest about north and vague about everything else.",
  "A threshold is a place you only notice twice.",
  "Measurement beats argument, and it beats it quickly.",
  "The second attempt is usually the shorter one.",
  "A plain sentence survives translation; a clever one does not.",
  "Nothing on this shelf moved, which is the entire trick.",
  "The drawing was right and the building was not, so the drawing was wrong.",
  "Three of these were agreed in a corridor and none of them were written down.",
  "Left standing overnight, the estimate doubled without anybody touching it.",
  "The list below is in the order it was found, not in the order it matters.",
  "Worth revisiting once the weather turns and the ferry runs again.",
  "It held under load, which was more than the calculation promised.",
  "Ask again in a month; the answer is seasonal.",
];

/* ------------------------------------------------------- read the real vault */

const SKIP_DIRS = new Set(["node_modules"]);
const SKIP_FILES = new Set(["claude.md", "claude-history.md", "readme.md", "license.md"]);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/* A date IS the thing being preserved, at whatever precision and in whatever notation it was
 * written -- day, month, quarter, ISO week -- so a date-shaped property value is never mapped
 * and never counted as a real string worth hunting for. */
const DATE_VALUE = /^(\d{4}|\d{1,2})([-/.](\d{1,2}|Q[1-4]|W\d{1,2})){0,2}([ T][\d:.+Z-]*)?$/i;
const DATEISH = /^\d{4}(?:[-_ ]?(?:\d{2}|Q[1-4]|W\d{1,2}))?$/i;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
      walk(p, acc);
    } else if (entry.toLowerCase().endsWith(".md") && !SKIP_FILES.has(entry.toLowerCase())) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * design/0013 -- THE SHAPE THIS PROJECT SHELVES ON is not the shape the sister project draws.
 * Vault Graph mirrors the LINK GRAPH; there are no links here at all. What has to survive is
 * what a classifier reads: the folder tree, every note's date, the PEOPLE property, the TAG
 * vocabulary with its hierarchy, and the frontmatter property keys and how their values are
 * distributed.
 */
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return { fm: "", body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

/** The exporter's own small reader, kept in step deliberately: scalars, inline and block lists. */
function parseFm(fm) {
  const scalars = {};
  const lists = {};
  let key = null;
  for (const raw of fm.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && key) { (lists[key] = lists[key] || []).push(unquote(item[1])); continue; }
    const pair = /^([A-Za-z0-9_ -]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    key = pair[1].trim();
    const value = pair[2].trim();
    if (!value) { lists[key] = lists[key] || []; continue; }
    if (value.startsWith("[") && value.endsWith("]")) {
      lists[key] = value.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
      continue;
    }
    scalars[key] = unquote(value);
  }
  return { scalars, lists };
}

const unquote = (v) => v.replace(/^["']|["']$/g, "").replace(/^\[\[|\]\]$/g, "").trim();

const files = walk(VAULT);
const notes = [];
for (const abs of files) {
  const rel = relative(VAULT, abs).split(sep).join("/");
  let raw = "";
  try { raw = readFileSync(abs, "utf8"); } catch { continue; }
  const { fm, body } = frontmatter(raw.replace(/^\uFEFF/, ""));
  const { scalars, lists } = parseFm(fm);

  const people = [];
  for (const k of ["people", "person", "attendees", "with"]) {
    for (const v of lists[k] || []) people.push(leafOf(v));
    if (scalars[k]) people.push(leafOf(scalars[k]));
  }

  const tags = [];
  for (const v of lists.tags || []) tags.push(String(v).replace(/^#/, ""));
  if (scalars.tags) for (const v of scalars.tags.split(/[,\s]+/)) if (v) tags.push(v.replace(/^#/, ""));
  for (const m of body.matchAll(/(^|\s)#([A-Za-z][\w/-]*)/g)) tags.push(m[2]);

  const props = {};
  for (const [k, v] of Object.entries(scalars)) {
    if (["tags", "people", "person", "attendees", "with", "aliases", "alias", "position"].includes(k)) continue;
    props[k] = v;
  }

  notes.push({
    rel,
    dir: dirname(rel) === "." ? "" : dirname(rel),
    base: basename(rel, ".md"),
    date: dateIn(scalars),
    people: [...new Set(people)].filter(Boolean),
    tags: [...new Set(tags)].filter(Boolean),
    props,
    words: body.split(/\s+/).filter(Boolean).length,
  });
}

function leafOf(v) {
  const inner = String(v).replace(/^\[\[|\]\]$/g, "");
  return (inner.split("|").pop() || inner).split("/").pop().trim();
}

function dateIn(scalars) {
  for (const k of ["date", "created", "Created"]) {
    const v = scalars[k];
    if (v && ISO_DAY.test(v.slice(0, 10))) return v.slice(0, 10);
  }
  return "";
}

/* ------------------------------------------------------------- the secrets --
 * design/0013 -- every real string this run must not write. Collected BEFORE anything is
 * invented, because the invented vocabulary has to be pruned with it: this file's filler is a
 * few dozen ordinary English words, and any vault large enough to be worth filming will sooner
 * or later contain one of them as a tag. It did -- `index`, which was both a tag in the source
 * vault and a word in the sentence "the shelf remembers what the index forgets".
 *
 * Pruning is the honest fix. Excusing the collision would mean the guard could no longer tell
 * that word leaking from that word coinciding, which is the one distinction it exists to make.
 */
const secrets = new Set();
for (const n of notes) {
  for (const p of n.people) if (p.length >= 3) secrets.add(p);
  for (const t of n.tags) for (const part of t.split("/")) if (part.length >= 4) secrets.add(part);
  for (const v of Object.values(n.props)) if (v.length >= 4 && !DATE_VALUE.test(v)) secrets.add(v);
  if (!ISO_DAY.test(n.base) && !DATEISH.test(n.base) && n.base.length >= 5) secrets.add(n.base);
}

/* ONLY THE ONE-WORD SECRETS. Splitting a multi-word secret into its words and banning each is
 * the obvious move and it bans the language: a note titled "Notes from the review" would put
 * `the`, `from` and `review` beyond use, and after 543 titles there is no English left. What a
 * single invented word can actually collide with is a secret that is itself a single word --
 * a tag, a property value. A phrase cannot be hit by accident, and the guard below is what
 * catches it if it somehow is. */
const secretWords = new Set();
for (const secret of secrets) {
  if (/^[\p{L}\p{N}]+$/u.test(secret)) secretWords.add(secret.toLowerCase());
}
const prune = (pool, name, floor) => {
  const kept = pool.filter((w) => !secretWords.has(w.toLowerCase()));
  if (kept.length < floor) {
    console.error(`make-mirror-vault: the ${name} list is down to ${kept.length} usable ` +
      `entries after removing words this vault already uses. Add more; do not reuse them.`);
    process.exit(1);
  }
  return kept;
};
FIRST = prune(FIRST, "first name", 12);
LAST = prune(LAST, "surname", 12);
ADJ = prune(ADJ, "adjective", 10);
NOUN = prune(NOUN, "noun", 10);
TOPIC = prune(TOPIC, "topic", 8);
SENTENCES = SENTENCES.filter((line) =>
  !line.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => w && secretWords.has(w)));
if (SENTENCES.length < 8) {
  console.error(`make-mirror-vault: only ${SENTENCES.length} filler sentences are usable after ` +
    `removing ones this vault's own words appear in. Write more; do not reuse them.`);
  process.exit(1);
}

/* --------------------------------------------------------------- the maps --
 * ONE MAPPING PER REAL NAME, and that is the whole reason this is not just random text. A
 * person who appears in forty notes has to appear in forty notes here too, or the People
 * shelf mirrors nothing: it would grow forty one-note books instead of one book of forty.
 * The same goes for every tag and every property value.
 */
const used = new Set();
/* `make` is given the attempt number so it can ESCALATE. The pools are deliberately small --
 * a large invented vocabulary is a large surface to collide with the real one -- so a vault
 * with four hundred distinct property values will exhaust the plain forms long before it runs
 * out of values. Escalating to a compound keeps every one of them a plausible word instead of
 * appending a counter, and "tides 224" on a spine is not a word anybody wrote. */
const uniq = (make) => {
  for (let i = 0; i < 4000; i++) {
    const v = make(i);
    if (!used.has(v)) { used.add(v); return v; }
  }
  throw new Error("ran out of invented names; the pools in this file are too small");
};
const newPerson = () => uniq(() => pick(FIRST) + " " + pick(LAST));
const newTitle = () => uniq(() => {
  const n = pick(ADJ) + " " + pick(NOUN) + (rnd() < 0.35 ? " " + pick(TOPIC) : "");
  return n.charAt(0).toUpperCase() + n.slice(1);
});
/* A tag or a property value: one word, then a hyphenated compound, then a longer one. */
const newWord = () => uniq((i) =>
  i < 40 ? pick(TOPIC)
  : i < 400 ? pick(ADJ) + "-" + pick(TOPIC)
  : i < 1600 ? pick(NOUN) + "-" + pick(TOPIC)
  : pick(ADJ) + "-" + pick(NOUN) + "-" + pick(TOPIC));

const mapped = (map, k, make) => {
  const key = String(k).toLowerCase();
  if (!map.has(key)) map.set(key, make());
  return map.get(key);
};
const peopleMap = new Map();
const tagMap = new Map();
const valueMap = new Map();
const folderMap = new Map();
const keyMap = new Map();

/* A PROPERTY KEY IS A NAME TOO. The generic vocabulary of note-taking says nothing about
 * anybody and has to survive, or the property picker in the film reads as gibberish. A key
 * outside this list does not: `jira_project`, `posthog_dashboard` and `acme_contract` are all
 * the same kind of fact about a person's working life, and none of them belongs in a video. */
const KEEP_PROP = new Set(["date", "created", "updated", "modified", "status", "type", "kind",
  "category", "area", "project", "topic", "stage", "state", "priority", "rating", "source",
  "author", "title", "summary", "due", "start", "end", "review", "language", "url", "link"]);
const newKey = () => uniq(() => pick(ADJ) + "_" + pick(NOUN));

/** A tag keeps its DEPTH, because `#garden` including `#garden/seeds` is a shelf setting. */
const mapTag = (tag) => String(tag).split("/")
  .map((part) => mapped(tagMap, part, newWord)).join("/");

/** A folder keeps its name if it is structural -- numbered, dated, or a common word. */
const KEEP_FOLDER = /^[_\d\W]|^(inbox|projects|areas|resources|archive|archives|daily|weekly|monthly|yearly|notes|templates|attachments|meetings?)\b/i;
const mapFolder = (dir) => {
  if (!dir) return "";
  if (folderMap.has(dir)) return folderMap.get(dir);
  const parent = mapFolder(dirname(dir) === "." ? "" : dirname(dir));
  const name = basename(dir);
  const keep = KEEP_FOLDER.test(name) || DATEISH.test(name);
  const full = (parent ? parent + "/" : "") + (keep ? name : uniq(() => pick(ADJ) + " " + pick(NOUN)));
  folderMap.set(dir, full);
  return full;
};

for (const n of notes) {
  n.mDir = mapFolder(n.dir);
  n.mBase = (ISO_DAY.test(n.base) || DATEISH.test(n.base))
    ? n.base
    : (/^\d{4}-\d{2}-\d{2}/.test(n.base)
        ? n.base.slice(0, 10) + " " + newTitle()
        : newTitle());
  n.mRel = (n.mDir ? n.mDir + "/" : "") + n.mBase.replace(/[\\/:*?"<>|]/g, "-") + ".md";
  n.mPeople = n.people.map((p) => mapped(peopleMap, p, newPerson));
  n.mTags = n.tags.map(mapTag);
  n.mProps = {};
  for (const [k, v] of Object.entries(n.props)) {
    const key = KEEP_PROP.has(k.toLowerCase()) ? k : mapped(keyMap, k, newKey);
    n.mProps[key] = DATE_VALUE.test(v) ? v : mapped(valueMap, k + "=" + v, newWord);
  }
}

/* ------------------------------------------------------------------ write -- */

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* Paragraphs, a subheading and the occasional list -- because the reader renders markdown
 * through Obsidian's own renderer (decisions/0005) and a note that is one flat block of prose
 * shows none of that. */
/* A DECK, not a die. Drawing each sentence independently put the same one twice in a
 * paragraph often enough to see it on screen, and a page that repeats itself reads as broken
 * generation rather than as somebody's notes. The deck is dealt out and reshuffled, so a
 * sentence cannot come back until every other one has been used. */
let deck = [];
const sentence = () => {
  if (!deck.length) {
    deck = SENTENCES.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
  }
  return deck.pop();
};
const heading = () => {
  const t = pick(ADJ) + " " + pick(NOUN);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const filler = (budget) => {
  const out = [];
  let spent = 0;
  let sinceHeading = 0;
  while (spent < budget) {
    if (sinceHeading >= 2 && rnd() < 0.35) {
      out.push("## " + heading());
      sinceHeading = 0;
      continue;
    }
    if (rnd() < 0.18) {
      const items = [];
      for (let i = 0, n = between(2, 4); i < n; i++) items.push("- " + sentence());
      out.push(items.join("\n"));
      spent += items.join(" ").split(" ").length;
      sinceHeading++;
      continue;
    }
    const para = [];
    for (let i = 0, n = between(2, 4); i < n; i++) para.push(sentence());
    out.push(para.join(" "));
    spent += para.join(" ").split(" ").length;
    sinceHeading++;
  }
  return out.join("\n\n");
};

let written = 0;
for (const n of notes) {
  const abs = join(OUT, n.mRel);
  mkdirSync(dirname(abs), { recursive: true });
  const fm = ["---"];
  /* One key, once. `date` reaches here twice -- as the note's own date and as the scalar
   * property it was read from -- and a repeated key is a YAML document Obsidian parses
   * differently from the one it mirrors. */
  const emitted = new Set();
  const key = (k) => { if (emitted.has(k)) return false; emitted.add(k); return true; };
  if (n.date && key("date")) fm.push("date: " + n.date);
  if (n.mPeople.length && key("people")) {
    fm.push("people:");
    for (const p of n.mPeople) fm.push("  - " + p);
  }
  if (n.mTags.length && key("tags")) {
    fm.push("tags:");
    for (const t of [...new Set(n.mTags)]) fm.push("  - " + t);
  }
  for (const [k, v] of Object.entries(n.mProps)) if (key(k)) fm.push(k + ": " + v);
  fm.push("---", "");
  writeFileSync(abs, fm.join("\n") + "# " + n.mBase + "\n\n" +
                filler(Math.max(14, Math.min(n.words, 320))) + "\n", "utf8");
  written++;
}

mkdirSync(join(OUT, ".obsidian"), { recursive: true });
writeFileSync(join(OUT, ".obsidian", "app.json"), "{}", "utf8");

/* --------------------------------------------------------------- the guard --
 * design/0013 -- THIS IS THE POINT OF THE WHOLE SCRIPT, so it is checked rather than trusted.
 * A mirror exists so a film can be recorded from a real vault's SHAPE without a word of its
 * content leaving the machine; a mapping that quietly falls through and passes a real name
 * out is the one failure that matters, and it would be invisible in a 98-second video.
 */
/* A structural folder name is kept ON PURPOSE, so a word inside it cannot also be a leak. A
 * vault with an `01 - Projects` folder and a `#projects` tag would otherwise fail this check
 * forever, with the mapping working perfectly. */
const excused = new Set();
const excuse = (text) => {
  for (const word of String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (word) excused.add(word);
};
for (const kept of folderMap.values()) excuse(kept);
for (const n of notes) for (const k of Object.keys(n.mProps)) excuse(k);
excuse("date people tags");   // the three keys this script writes itself
for (const s of [...secrets]) if (excused.has(s.toLowerCase())) secrets.delete(s);

/* AS A WORD, not as a substring. `#project` is not leaking because the preserved folder
 * `01 - Projects` happens to contain those seven letters; a boundary check knows that and a
 * substring check cannot. The boundaries are unicode classes rather than \b, because \b is
 * ASCII: it would put a boundary in the middle of "Muller" the moment it is spelled "Müller",
 * and then MISS the leak. */
const patterns = [...secrets].map((secret) => [secret, new RegExp(
  "(?<![\\p{L}\\p{N}])" + secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}])",
  "iu")]);

const leaked = [];
for (const n of notes) {
  const text = readFileSync(join(OUT, n.mRel), "utf8");
  const hay = n.mRel + "\n" + text;
  const lower = hay.toLowerCase();
  for (const [secret, re] of patterns) {
    // `includes` is the cheap filter; the regex only runs on a candidate.
    if (lower.includes(secret.toLowerCase()) && re.test(hay)) {
      leaked.push({ file: n.mRel, secret });
      break;
    }
  }
  if (leaked.length > 6) break;
}

say(`mirror vault: ${OUT}`);
say(`  ${written} notes from ${notes.length} real ones, seed ${SEED}`);
say(`  ${folderMap.size} folders mapped, ${peopleMap.size} people, ${tagMap.size} tag words, ` +
    `${valueMap.size} property values, ${keyMap.size} property keys`);
say(`  checked ${secrets.size} real strings against every written file` +
    (excused.size ? `, excusing ${excused.size} word(s) of preserved folder name` : ""));

if (leaked.length) {
  console.error(`\nmake-mirror-vault: ${leaked.length} real string(s) reached the mirror\n`);
  for (const l of leaked.slice(0, 6)) console.error(`  ${l.file}  <-  ${JSON.stringify(l.secret)}`);
  console.error(`
A mirror that carries real content is worse than no mirror, because it looks safe. Something
fell through the mapping -- most likely a frontmatter key this script does not map, or a name
that also occurs as ordinary prose. Fix the mapping; do not relax the check.`);
  process.exit(1);
}
