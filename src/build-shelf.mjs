#!/usr/bin/env node

import { buildSync } from "esbuild";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const VAULT = resolve(arg("vault", join(ROOT, "demo-vault")));
const OUT = resolve(arg("out", join(ROOT, "vault-shelf.html")));
const DATE_FIELDS = arg("date-fields", "date,created").split(",").map((s) => s.trim()).filter(Boolean);
const PEOPLE_FIELDS = arg("people-props", "people,attendees,person")
  .split(",").map((f) => f.trim()).filter(Boolean);
const EXCLUDE = arg("exclude", "99 - Templates,.obsidian,.trash")
  .split(",").map((s) => s.trim()).filter(Boolean);

/* decisions/0003 -- THE FILE STAMP IS OPT-IN, and that is the whole decision.
 *
 * A file's mtime is always available and almost never the date the note is about: a bulk
 * reformat, a sync, or a `git checkout` restamps every file in the vault, and a Months shelf
 * built on that puts a decade of notes into one book and calls it September. Falling back to
 * it by default would mean the Undated book is never populated and nobody ever finds out
 * their dates are wrong -- so a note with no date SAYS SO, and --use-file-stamp is there for
 * the vault that genuinely wants it. */
const USE_FILE_STAMP = argv.includes("--use-file-stamp");

/* ---- the crawl -----------------------------------------------------------
 * decisions/0004 -- readdirSync's order is documented as filesystem-dependent, and note
 * order flows into every book's contents and into the golden shelf snapshots. Sorted here,
 * once, and scripts/check-build-order-determinism.mjs keeps it sorted.
 */
function walk(dir, acc) {
  for (const entry of readdirSync(dir).sort()) {
    const abs = join(dir, entry);
    const rel = relative(VAULT, abs).split(sep).join("/");
    if (EXCLUDE.some((x) => rel === x || rel.startsWith(x + "/"))) continue;
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else if (entry.toLowerCase().endsWith(".md")) {
      acc.push({ abs, rel, ctimeMs: st.birthtimeMs, mtimeMs: st.mtimeMs });
    }
  }
  return acc;
}

/* ---- frontmatter ---------------------------------------------------------
 * A deliberately small YAML reader: scalars, inline `[a, b]` lists and `- item` lists, which
 * is what a note's frontmatter is. Anything else is left as a string rather than guessed at
 * -- decisions/0003 -- and a guessed date is worse than an Undated book.
 */
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { props: {}, lists: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { props: {}, lists: {}, body: text };
  const head = text.slice(3, end).split("\n");
  const body = text.slice(text.indexOf("\n", end + 1) + 1);
  const props = {};
  const lists = {};
  let key = null;
  for (const raw of head) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && key) {
      lists[key] = lists[key] || [];
      lists[key].push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z0-9_ -]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    key = pair[1].trim();
    const value = pair[2].trim();
    if (!value) { lists[key] = []; continue; }
    if (value.startsWith("[") && value.endsWith("]")) {
      lists[key] = value.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
      continue;
    }
    props[key] = unquote(value);
  }
  return { props, lists, body };
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, "").replace(/^\[\[|\]\]$/g, "").trim();
}

const core = (() => {
  try {
    return buildSync({
      absWorkingDir: ROOT,
      entryPoints: [join(ROOT, "src", "core", "index.ts")],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "VaultShelfCore",
      platform: "browser",
      target: "es2020",
      minify: false,
      logLevel: "silent",
    }).outputFiles[0].text;
  } catch (e) {
    const messages = Array.isArray(e.errors)
      ? e.errors.map((m) => m.text + (m.location ? ` (${m.location.file}:${m.location.line})` : ""))
      : [String(e.message || e)];
    console.error("build-shelf: the core did not bundle:\n  " + messages.join("\n  "));
    process.exit(1);
  }
})();

/* THE EXPORTER RESOLVES DATES WITH THE SAME CODE THE PAGE DOES. It used to have its own
 * `ISO_DAY` regex, and that regex accepted `2024-15-01` -- a real, ordinary frontmatter typo
 * in a real vault, which the exporter then shelved as a fifteenth month called "15 2024".
 * `core.isIsoDay` had always rejected it and fallen through to the filename, so the plugin was
 * right and the exporter was wrong about the same note. One implementation, evaluated rather
 * than re-typed. (Found by shooting a demo film in a mirror of a real vault -- design/0013.)
 */
const CORE = runInNewContext(core + ";VaultShelfCore", {});

/* ---- the data ------------------------------------------------------------ */

const files = walk(VAULT, []);
const notes = [];
const folderCounts = new Map();
const sources = { field: 0, title: 0, stamp: 0, none: 0 };

/* decisions/0003 -- which notes are people, decided once before any note is shelved; the
 * plugin does the same over the metadata cache. Indexed by path without its extension and by
 * bare title, which is how a wikilink names a note. */
const PERSON_NOTE = arg("person-note", "type: people");
/** @type {Map<string, string>} */
const personByRef = new Map();
if (PERSON_NOTE) {
  for (const file of files) {
    const { props, lists } = parseFrontmatter(readFileSync(file.abs, "utf8"));
    const tags = (lists.tags || []).concat(props.tags ? props.tags.split(/[,\s]+/) : [])
      .map((t) => t.replace(/^#/, "")).filter(Boolean);
    if (!CORE.isPersonNote(PERSON_NOTE, props, tags)) continue;
    const title = file.rel.split("/").pop().replace(/\.md$/i, "");
    const who = CORE.cleanPerson(props.name || title) || title;
    personByRef.set(file.rel.replace(/\.md$/i, "").toLowerCase(), who);
    personByRef.set(title.toLowerCase(), who);
  }
}

for (const file of files) {
  const text = readFileSync(file.abs, "utf8");
  const { props, lists, body } = parseFrontmatter(text);
  const title = file.rel.split("/").pop().replace(/\.md$/i, "");
  const folder = file.rel.indexOf("/") < 0 ? "(vault root)" : file.rel.slice(0, file.rel.indexOf("/"));

  const stamp = USE_FILE_STAMP ? CORE.stampOf(file.ctimeMs, file.mtimeMs) : null;
  const date = CORE.resolveDate(props, title, stamp, DATE_FIELDS);
  // Where it came from, read back off the answer: the log below is the only consumer, and a
  // second copy of the precedence order is a second place for it to drift.
  if (date === null) sources.none++;
  else if (DATE_FIELDS.some((f) => props[f] && props[f].trim().slice(0, 10) === date)) sources.field++;
  else if (title.trim().slice(0, 10) === date) sources.title++;
  else sources.stamp++;

  /* decisions/0003 -- every people property, merged, and read through core.cleanPerson so a
   * wikilink, an alias and a quoted scalar mean here exactly what they mean in the plugin. */
  const people = [];
  for (const field of PEOPLE_FIELDS) {
    for (const v of lists[field] || []) people.push(CORE.cleanPerson(v));
    if (props[field]) people.push(CORE.cleanPerson(props[field]));
  }
  if (personByRef.size) {
    const self = file.rel.replace(/\.md$/i, "").toLowerCase();
    for (const target of CORE.linkTargets(text)) {
      const ref = target.replace(/\.md$/i, "").toLowerCase();
      if (ref === self || ref === self.split("/").pop()) continue;
      const who = personByRef.get(ref) || personByRef.get(ref.split("/").pop() || ref);
      if (who) people.push(who);
    }
  }

  const tags = (lists.tags || []).slice();
  if (props.tags) tags.push(...props.tags.split(/[,\s]+/).filter(Boolean));
  for (const m of body.matchAll(/(^|\s)#([A-Za-z][\w/-]*)/g)) tags.push(m[2]);

  const scalar = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === "tags" || PEOPLE_FIELDS.indexOf(k) >= 0) continue;
    scalar[k] = v;
  }

  folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
  notes.push({
    id: file.rel,
    path: file.rel,
    title,
    folder,
    date,
    people: [...new Set(people.filter(Boolean))].sort(),
    tags: [...new Set(tags.map((t) => t.replace(/^#/, "")))].sort(),
    props: scalar,
    excerpt: body.trim().split("\n").slice(0, 2).join(" ").slice(0, 240),
    body: body.trim(),
  });
}

const folders = [...folderCounts.entries()]
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .map(([path, count], i) => ({ path, count, slot: i }));

const data = {
  vault: VAULT.split(sep).pop(),
  generated: new Date().toISOString().slice(0, 16).replace("T", " "),
  notes,
  folders,
  stats: {
    notes: notes.length,
    dated: notes.filter((n) => n.date !== null).length,
    people: new Set(notes.flatMap((n) => n.people)).size,
    tags: new Set(notes.flatMap((n) => n.tags)).size,
  },
};

/* ---- the page ------------------------------------------------------------ */


const part = (f) => readFileSync(join(HERE, f), "utf8");

/* design/0016 -- every look but the default one, in the order core.LOOKS offers them. Each
 * paints nothing until `data-look` names it, so shipping them all costs a few KB and no
 * behaviour. */
const LOOK_SHEETS = ["leather.css", "cyber.css"];
const asScript = (js) => js.replace(/^export \{[^}]*\};?\s*$/m, "").trimEnd();

/* github#5 -- JSON is not script-safe: </script> closes the block */
const SEPARATORS = new RegExp(String.fromCharCode(0x2028) + "|" + String.fromCharCode(0x2029), "g");
const jsonForScript = (value) => JSON.stringify(value)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(SEPARATORS, (c) => (c === String.fromCharCode(0x2028) ? "\\u2028" : "\\u2029"));

const html = part("shell.html")
  .replace("<!--CSS-->", () => part("page.css").trimEnd())
  /* design/0016 -- the opt-in look travels with the page, off unless the setting says so.
   * A second stylesheet rather than a second copy of the first one. */
  .replace("<!--LOOKS-->", () => LOOK_SHEETS.map((f) => part(f).trimEnd()).join("\n\n"))
  .replace("<!--MARKUP-->", () => part("page.html").trimEnd())
  .replace("<!--SCRIPT-->", () => asScript(part("page.js")))
  .replace("<!--LIBS-->", () => `<script>\n${core.trimEnd()}\n</script>`)
  .replace("<!--ASSETS-->", () => "")
  .replace("<!--DATA-->", () => `<script>window.VAULT_DATA=${jsonForScript(data)};</script>`);

writeFileSync(OUT, html, "utf8");

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`vault-shelf: ${data.stats.notes} notes, ${folders.length} folders, ` +
            `${data.stats.people} people, ${data.stats.tags} tags`);
console.log(`dated: ${sources.field} from frontmatter, ${sources.title} from the filename, ` +
            `${sources.stamp} from the file stamp` +
            (USE_FILE_STAMP ? "" : " (--use-file-stamp is off)") +
            (sources.none ? `, ${sources.none} UNDATED` : ", none undated"));
console.log(`wrote ${OUT} (${kb} KB)`);
