#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const CLASS = ".vault-shelf";
const PREFIX = "vs-";

const problems = [];

/* ---- 1. css ------------------------------------------------------------- */

/* EVERY stylesheet that ships, not just the first one. design/0016 added a second (the opt-in
 * leather look) and an unscoped rule in it would style Obsidian exactly as one in page.css
 * does -- the guarantee is about what the plugin loads, not about a filename. */
const STYLESHEETS = ["page.css", "leather.css"];
const sheets = STYLESHEETS.map((name) => ({ name, text: readFileSync(join(SRC, name), "utf8") }));
let rules = 0;

for (const sheet of sheets) {
  let depth = 0, inComment = false;
  sheet.text.split("\n").forEach((line, i) => {
    let scan = line, code = "";
    while (scan.length) {
      if (inComment) {
        const end = scan.indexOf("*/");
        if (end < 0) { scan = ""; } else { scan = scan.slice(end + 2); inComment = false; }
      } else {
        const start = scan.indexOf("/*");
        if (start < 0) { code += scan; scan = ""; }
        else { code += scan.slice(0, start); scan = scan.slice(start + 2); inComment = true; }
      }
    }
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;

    if (opens > 0 && (depth === 0 || depth === 1) && !/^\s*@/.test(code)) {
      rules++;
      const sel = code.slice(0, code.indexOf("{")).trim();
      for (const part of sel.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (part !== CLASS && !part.startsWith(CLASS + " ") && !part.startsWith(CLASS + ":") &&
            !part.startsWith(CLASS + "[") && !part.startsWith(CLASS + ".") &&
            !part.startsWith(CLASS + ">")) {
          problems.push(`${sheet.name}:${i + 1}  unscoped selector: ${part}`);
        }
      }
    }
    depth += opens - closes;
  });
  if (depth !== 0) problems.push(`${sheet.name}  unbalanced braces (depth ${depth} at EOF)`);
}

/* ---- 2. markup ---------------------------------------------------------- */

const html = readFileSync(join(SRC, "page.html"), "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
for (const id of ids) {
  if (!id.startsWith(PREFIX)) problems.push(`page.html  unprefixed id: ${id}`);
}
const fors = [...html.matchAll(/(?:for|aria-controls|aria-labelledby)="([^"]+)"/g)].map((m) => m[1]);
for (const ref of fors) {
  if (!ref.startsWith(PREFIX)) problems.push(`page.html  unprefixed reference: ${ref}`);
}
if (!html.includes('class="vault-shelf"')) {
  problems.push('page.html  the root element does not carry class="vault-shelf"');
}

/* ---- 2b. the host cannot style US either --------------------------------
 * design/0005 -- the OTHER half of "the page cannot style, or be styled by, its host", and
 * for a long time only the first half was guarded.
 *
 * Obsidian's app.css contains `.pdfViewer.scrollHorizontal, .spread { white-space: nowrap }`.
 * The reading spread was a `<div class="spread">`, so the app's PDF viewer styled it, one long
 * paragraph stopped wrapping, and the reader grew a horizontal scrollbar. Nothing in this repo
 * was wrong; the class name was simply a word somebody else had already claimed.
 *
 * So every class the page puts in the document carries the same `vs-` prefix its ids do. The
 * root `.vault-shelf` is the deliberate exception -- it is the scope handle, and the plugin's
 * own stylesheet needs to name it.
 */
const CLASS_EXEMPT = new Set(["vault-shelf", "vault-shelf-view"]);
const classAttrs = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
for (const name of [...new Set(classAttrs)].filter(Boolean)) {
  if (CLASS_EXEMPT.has(name) || name.startsWith(PREFIX)) continue;
  problems.push(`page.html  unprefixed class: ${name} -- the host can claim that name`);
}

const cssClasses = [];
for (const sheet of sheets) {
  const scan = sheet.text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of scan.split("}")) {
    const sel = block.slice(0, block.indexOf("{"));
    if (!sel || sel.trim().startsWith("@")) continue;
    for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) {
      cssClasses.push(m[1]);
      if (!CLASS_EXEMPT.has(m[1]) && !m[1].startsWith(PREFIX)) {
        problems.push(`${sheet.name}  unprefixed class: .${m[1]} -- the host can claim that name`);
      }
    }
  }
}


/* ---- 3. script ----------------------------------------------------------
 * The page mounts inside Obsidian's own document -- and inside a POPOUT WINDOW's document,
 * which is a different object again. `document` in this file is whichever one the module was
 * evaluated in, so a listener added to it in a popout is added to the wrong window. There is
 * one allowed way to reach a document here and it is `root.ownerDocument`.
 */

const js = readFileSync(join(SRC, "page.js"), "utf8");

const ALLOWED_REACHES = new Set(["document.createElement", "document.title"]);
const reaches = [...js.matchAll(/(?<![\w$.])document\.[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
for (const r of [...new Set(reaches)]) {
  if (!ALLOWED_REACHES.has(r)) problems.push(`page.js  reaches the host document: ${r}`);
}

if (!js.includes('var $ = function (id) { return root.querySelector("#" + ID + id); };')) {
  problems.push("page.js  the $ accessor is not the root-scoped form");
}
if (!js.includes('var ID = "' + PREFIX + '"')) {
  problems.push("page.js  the id prefix constant is missing");
}
if (!/export \{[^}]*mountVaultShelf[^}]*\}/.test(js)) {
  problems.push("page.js  does not export mountVaultShelf");
}

const jsClasses = [...js.matchAll(/(?<![\w$.])el\("[a-zA-Z0-9]+",\s*"([a-z0-9][a-z0-9 -]*)"/g)]
  .flatMap((m) => m[1].split(/\s+/));
for (const name of [...new Set(jsClasses)].filter(Boolean)) {
  if (CLASS_EXEMPT.has(name) || name.startsWith(PREFIX)) continue;
  problems.push(`page.js  unprefixed class: ${name} -- the host can claim that name`);
}

/* ---- 4. every id the page asks for exists in the markup ------------------
 * $("foo") that matches nothing returns null and the failure surfaces three functions later
 * as "cannot read properties of null". A typo in an id is the cheapest bug in this repo to
 * find here and one of the more expensive ones to find in a browser.
 */
const known = new Set(ids);
const asked = [...js.matchAll(/(?:\$|field|node)\("([a-z0-9-]+)"\)/gi)].map((m) => m[1]);
for (const name of [...new Set(asked)]) {
  if (!known.has(PREFIX + name)) problems.push(`page.js  $("${name}") has no #${PREFIX}${name} in page.html`);
}

/* ---- 5. no invisible characters in anything that ships ------------------
 * A DEL (0x7F) once got into `const UNDATED = "-undated"` and made every Undated book
 * unreachable by its own name: the string PRINTED as "-undated", compared unequal to
 * "-undated", and the failure surfaced as an empty book that the sort still put last. A
 * control character in source is never intentional and is invisible in every editor, so it is
 * cheaper to refuse it here than to find it in a browser.
 */

const SHIPPED = ["src", "plugin"];
const CODE = /\.(m?js|ts|css|html)$/;

function walkFiles(dir, acc) {
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walkFiles(p, acc); continue; }
    if (CODE.test(name)) acc.push(p);
  }
  return acc;
}

let scanned = 0;
for (const dir of SHIPPED) {
  for (const file of walkFiles(join(ROOT, dir), [])) {
    scanned++;
    const text = readFileSync(file, "utf8");
    text.split(String.fromCharCode(10)).forEach((line, i) => {
      for (let k = 0; k < line.length; k++) {
        const code = line.charCodeAt(k);
        if ((code < 32 && code !== 9) || code === 127) {
          problems.push(`${file.slice(ROOT.length + 1).split("\\").join("/")}:${i + 1}  ` +
                        `control character U+${code.toString(16).toUpperCase().padStart(4, "0")} ` +
                        `at column ${k + 1}`);
        }
      }
    });
  }
}

/* ---- report ------------------------------------------------------------- */

if (!problems.length) {
  console.log(`check-scope: clean (${rules} css rules, ${ids.length} ids, ` +
              `${new Set([...classAttrs, ...cssClasses, ...jsClasses]).size} prefixed classes, ` +
              `${new Set(asked).size} id lookup${new Set(asked).size === 1 ? "" : "s"}, ` +
              `${scanned} shipped files with no invisible characters)`);
  process.exit(0);
}
console.error(`check-scope: ${problems.length} problem(s)\n`);
for (const p of problems) console.error("  " + p);
console.error(`
The page mounts inside Obsidian's own document. An unscoped rule styles the whole app, and a
bare id can hit the app's element instead of ours. Scope it under ${CLASS}, prefix the id
with ${PREFIX} and reach it through $(), and take documents from root.ownerDocument.`);
process.exit(1);
