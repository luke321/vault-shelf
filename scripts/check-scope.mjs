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
const STYLESHEETS = ["page.css", "leather.css", "cyber.css"];

/* github#81, decisions/0017 -- at-rules that hold style rules, and at-rules that cannot */
const AT_HOLDS_RULES = new Set(
  ["media", "supports", "container", "layer", "scope", "starting-style", "document"]);
const AT_HOLDS_NO_RULES = new Set(
  ["font-face", "keyframes", "page", "property", "counter-style", "font-feature-values",
   "font-palette-values", "viewport", "import", "charset", "namespace"]);

/** @param {string} text @returns {string} */
function blankComments(text) {
  let out = "", i = 0, quote = null;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) { out += text[i + 1]; i += 2; continue; }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; i++; continue; }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      for (let k = i; k < stop; k++) out += text[k] === "\n" ? "\n" : " ";
      i = stop;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** @param {string} sel @param {number} base @returns {{ text: string, at: number }[]} */
function selectorParts(sel, base) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  const cut = (a, b) => {
    const raw = sel.slice(a, b);
    const text = raw.trim();
    if (text) parts.push({ text, at: base + a + (raw.length - raw.trimStart().length) });
  };
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth <= 0) { cut(start, i); start = i + 1; }
  }
  cut(start, sel.length);
  return parts;
}

/* github#81 -- a sibling of the page is outside the page */
/** @param {string} part @returns {boolean} */
function scoped(part) {
  if (part === CLASS) return true;
  if (!part.startsWith(CLASS) || !" :[.>".includes(part[CLASS.length])) return false;
  let i = CLASS.length, depth = 0;
  while (i < part.length) {
    const ch = part[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (!depth && (ch === "+" || ch === "~" || ch === ">" || /\s/.test(ch))) break;
    i++;
  }
  while (i < part.length && /\s/.test(part[i])) i++;
  return part[i] !== "+" && part[i] !== "~";
}

/** @param {string} s @returns {string} */
function tidy(s) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > 80 ? one.slice(0, 79) + "…" : one;
}

/* github#81, decisions/0017 -- the prelude is everything since the last brace or semicolon */
/** @param {string} name @param {string} text
 *  @returns {{ rules: number, problems: string[], selectors: { text: string, line: number }[] }} */
function scanSheet(name, text) {
  const code = blankComments(text);
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  const lineAt = (off) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };

  const found = [], said = [], stack = [];
  let rules = 0, from = 0, quote = null;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ";") { from = i + 1; continue; }
    if (ch === "}") {
      if (stack.length) stack.pop();
      else said.push(`${name}:${lineAt(i)}  a closing brace with no block open`);
      from = i + 1;
      continue;
    }
    if (ch !== "{") continue;

    const prelude = code.slice(from, i);
    const sel = prelude.trim();
    const at = from + (prelude.length - prelude.trimStart().length);
    const inside = stack[stack.length - 1];
    let kind = "rule";

    if (inside === "opaque") {
      kind = "opaque";
    } else if (inside === "rule") {
      kind = "opaque";
      said.push(`${name}:${lineAt(at)}  nested rule: ${tidy(sel)} -- this check does not read nested css`);
    } else if (sel.startsWith("@")) {
      const atName = (/^@([-\w]+)/.exec(sel) || ["", ""])[1].replace(/^-[a-z]+-/i, "").toLowerCase();
      if (AT_HOLDS_RULES.has(atName)) kind = "group";
      else {
        kind = "opaque";
        if (!AT_HOLDS_NO_RULES.has(atName)) {
          said.push(`${name}:${lineAt(at)}  unrecognised at-rule: @${atName} -- ` +
                    `say in scripts/check-scope.mjs whether style rules can live inside it`);
        }
      }
    } else if (!sel) {
      kind = "opaque";
      said.push(`${name}:${lineAt(i)}  a block with no selector in front of it`);
    } else {
      rules++;
      for (const part of selectorParts(prelude, from)) {
        found.push({ text: part.text, line: lineAt(part.at) });
        if (!scoped(part.text)) {
          said.push(`${name}:${lineAt(part.at)}  unscoped selector: ${tidy(part.text)}`);
        }
      }
    }
    stack.push(kind);
    from = i + 1;
  }

  if (stack.length) {
    said.push(`${name}  unbalanced braces (${stack.length} block(s) still open at EOF)`);
  }
  if (quote) said.push(`${name}  unterminated string`);
  return { rules, problems: said, selectors: found };
}

/* github#81, decisions/0017 -- the shapes that slipped, proved caught on every run */
const CONTROLS = [
  { name: "a multi-line selector list is read past its last member",
    css: "p,\nblockquote,\ninput,\n.vault-shelf .vs-spine {\n  margin: 0;\n}\n",
    rules: 1, reads: 4,
    catches: ["unscoped selector: p", "unscoped selector: blockquote", "unscoped selector: input"] },
  { name: "an at-rule written entirely on one line",
    css: "@media (min-width: 1px) { body { margin: 0 } }\n",
    rules: 1, reads: 1, catches: ["unscoped selector: body"] },
  { name: "a rule nested two levels deep",
    css: "@supports (display: grid) { @media (min-width: 1px) { html { color: red } } }\n",
    rules: 1, reads: 1, catches: ["unscoped selector: html"] },
  { name: "the second of two rules on one line",
    css: ".vault-shelf .vs-spine { color: red } body { margin: 0 }\n",
    rules: 2, reads: 2, catches: ["unscoped selector: body"] },
  { name: "a comment sitting inside the selector list",
    css: "p, /* a note */\n.vault-shelf .vs-spine { margin: 0; }\n",
    rules: 1, reads: 2, catches: ["unscoped selector: p"] },
  { name: "an attribute selector that is not the last member",
    css: "[hidden],\n.vault-shelf .vs-spine { display: none; }\n",
    rules: 1, reads: 2, catches: ["unscoped selector: [hidden]"] },
  { name: "the universal selector that is not the last member",
    css: "*,\n.vault-shelf .vs-spine { box-sizing: border-box; }\n",
    rules: 1, reads: 2, catches: ["unscoped selector: *"] },
  { name: "a closing brace inside a string is not structure",
    css: ".vault-shelf .vs-a::before { content: \"}\"; }\nbody { margin: 0 }\n",
    rules: 2, reads: 2, catches: ["unscoped selector: body"] },
  { name: "an opening brace inside a string is not structure",
    css: ".vault-shelf .vs-a::before { content: \"{\"; }\n" +
         "@media (min-width: 1px) { body { margin: 0 } }\n",
    rules: 2, reads: 2, catches: ["unscoped selector: body"] },
  { name: "a member spread over two lines is reported on one",
    css: "p\n.vs-x,\n.vault-shelf .vs-a { margin: 0 }\n",
    rules: 1, reads: 2, catches: ["unscoped selector: p .vs-x"] },
  { name: "a plain element rule at depth 0",
    css: "body { margin: 0 }\n", rules: 1, reads: 1, catches: ["unscoped selector: body"] },
  { name: "a sibling of the page is outside the page",
    css: ".vault-shelf + p { margin: 0 }\n",
    rules: 1, reads: 1, catches: ["unscoped selector: .vault-shelf + p"] },
  { name: "a sibling of a pseudo-classed page is outside it too",
    css: ".vault-shelf:hover ~ p { margin: 0 }\n",
    rules: 1, reads: 1, catches: ["unscoped selector: .vault-shelf:hover ~ p"] },
  { name: "a class the root name is only a prefix of is a different class",
    css: ".vault-shelfx .vs-a { margin: 0 }\n",
    rules: 1, reads: 1, catches: ["unscoped selector: .vault-shelfx .vs-a"] },
  { name: "a nested rule is refused rather than skipped",
    css: ".vault-shelf .vs-a { & .vs-b { color: red } }\n",
    rules: 1, reads: 1, catches: ["nested rule: & .vs-b"] },
  { name: "an at-rule nested inside a rule is refused too",
    css: ".vault-shelf .vs-a { @media (min-width: 1px) { body { margin: 0 } } }\n",
    rules: 1, reads: 1, catches: ["nested rule: @media (min-width: 1px)"] },
  { name: "an at-rule nobody has classified is refused",
    css: "@wibble { body { margin: 0 } }\n",
    rules: 0, reads: 0, catches: ["unrecognised at-rule: @wibble"] },
  { name: "a block with nothing in front of it is named",
    css: "{ margin: 0 }\n", rules: 0, reads: 0,
    catches: ["a block with no selector in front of it"] },
  { name: "a block left open is named",
    css: ".vault-shelf .vs-a { color: red\n",
    rules: 1, reads: 1, catches: ["unbalanced braces"] },
  { name: "a scoped multi-line list stays clean",
    css: ".vault-shelf .vs-a,\n.vault-shelf .vs-b,\n.vault-shelf .vs-c {\n  margin: 0;\n}\n",
    rules: 1, reads: 3, catches: [] },
  { name: "a comma inside :is() is not a list separator",
    css: ".vault-shelf :is(.vs-a, .vs-b) { margin: 0; }\n",
    rules: 1, reads: 1, catches: [] },
  { name: "a comma inside an attribute value is not a list separator",
    css: ".vault-shelf [data-look=\"a,b\"] { margin: 0; }\n",
    rules: 1, reads: 1, catches: [] },
  { name: "a sibling combinator inside the page is fine",
    css: ".vault-shelf .vs-a + .vs-b { margin: 0 }\n",
    rules: 1, reads: 1, catches: [] },
  { name: "a space inside an attribute value does not end the compound",
    css: ".vault-shelf[data-look=\"a b\"] .vs-a { margin: 0 }\n",
    rules: 1, reads: 1, catches: [] },
  { name: "a child of the page is inside the page",
    css: ".vault-shelf>p { margin: 0 }\n", rules: 1, reads: 1, catches: [] },
  { name: "keyframe selectors are not style rules",
    css: "@keyframes vs-fade { from { opacity: 0 } to { opacity: 1 } }\n",
    rules: 0, reads: 0, catches: [] },
  { name: "a rule inside @media is read, not skipped with the at-rule",
    css: "@media (min-width: 1px) { .vault-shelf .vs-a { color: red } }\n",
    rules: 1, reads: 1, catches: [] },
  { name: "braces inside a comment are not structure",
    css: "/* } { */\n.vault-shelf .vs-a { color: red }\n",
    rules: 1, reads: 1, catches: [] },
];

/** @returns {{ name: string, fails: string[] }[]} */
function runControls() {
  return CONTROLS.map((c) => {
    const got = scanSheet("control.css", c.css);
    const fails = [];
    if (got.rules !== c.rules) fails.push(`read ${got.rules} rule(s), not ${c.rules}`);
    if (got.selectors.length !== c.reads) {
      fails.push(`read ${got.selectors.length} selector(s), not ${c.reads}`);
    }
    if (got.problems.length !== c.catches.length) {
      fails.push(`raised ${got.problems.length} problem(s), not ${c.catches.length}` +
                 (got.problems.length ? ": " + got.problems.join(" | ") : ""));
    }
    for (const want of c.catches) {
      if (!got.problems.some((p) => p.includes(want))) fails.push(`never said "${want}"`);
    }
    return { name: c.name, fails };
  });
}

const controls = runControls();

if (process.argv.includes("--selftest")) {
  for (const c of controls) {
    console.log(`${c.fails.length ? "FAIL" : "pass"}  ${c.name}`);
    for (const f of c.fails) console.log(`        ${f}`);
  }
  const bad = controls.filter((c) => c.fails.length).length;
  console.log(`\ncheck-scope selftest: ${controls.length - bad}/${controls.length} controls caught`);
  process.exit(bad ? 1 : 0);
}

for (const c of controls) {
  for (const f of c.fails) problems.push(`control "${c.name}"  ${f}`);
}

const sheets = STYLESHEETS.map((name) => ({ name, text: readFileSync(join(SRC, name), "utf8") }));
let rules = 0;
const cssSelectors = [];

for (const sheet of sheets) {
  const got = scanSheet(sheet.name, sheet.text);
  rules += got.rules;
  for (const p of got.problems) problems.push(p);
  for (const s of got.selectors) cssSelectors.push({ sheet: sheet.name, ...s });
  /* github#81 -- a sheet nothing was read out of is the parser, not the sheet */
  if (!got.rules) problems.push(`${sheet.name}  no rules read out of a sheet that ships`);
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

/* github#81 -- the selectors section 1 read, so there is one parser */
const cssClasses = [];
for (const sel of cssSelectors) {
  for (const m of sel.text.matchAll(/\.([A-Za-z][\w-]*)/g)) {
    cssClasses.push(m[1]);
    if (!CLASS_EXEMPT.has(m[1]) && !m[1].startsWith(PREFIX)) {
      problems.push(`${sel.sheet}:${sel.line}  unprefixed class: .${m[1]} -- ` +
                    `the host can claim that name`);
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
  console.log(`check-scope: clean (${rules} css rules, ${cssSelectors.length} css selectors, ` +
              `${ids.length} ids, ` +
              `${new Set([...classAttrs, ...cssClasses, ...jsClasses]).size} prefixed classes, ` +
              `${new Set(asked).size} id lookup${new Set(asked).size === 1 ? "" : "s"}, ` +
              `${scanned} shipped files with no invisible characters, ` +
              `${controls.length} negative controls caught)`);
  process.exit(0);
}
console.error(`check-scope: ${problems.length} problem(s)\n`);
for (const p of problems) console.error("  " + p);
console.error(`
The page mounts inside Obsidian's own document. An unscoped rule styles the whole app, and a
bare id can hit the app's element instead of ours. Scope it under ${CLASS}, prefix the id
with ${PREFIX} and reach it through $(), and take documents from root.ownerDocument.`);
process.exit(1);
