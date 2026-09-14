#!/usr/bin/env node
// github#5 -- vault data must not break out of the data block

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { attach } from "./cdp.mjs";
// github#50
import { findChrome, harnessChromeArgs } from "./chrome.mjs";
// github#37, decisions/0012
import { takeLeftScreen } from "./screen.mjs";
import { ownerTag } from "./lock.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const BUILD = join(ROOT, "src", "build-shelf.mjs");
const argv = process.argv.slice(2);
const BROWSER = argv.includes("--browser");
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
// github#37 -- a blocked run names the holder and gives up
const LOCK_TIMEOUT_MS = Number(arg("lock-timeout-ms", "2700000")) || 2700000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// github#5 -- one marker per field, so a breakout names it
export const PAYLOAD = {
  tag: "</script><script>window.__vs_pwned_tag=1</script>",
  person: '<img src=x onerror="window.__vs_pwned_person=1">',
  prop: '"]]><script>window.__vs_pwned_prop=1</script>',
  body: "</script><svg onload=\"window.__vs_pwned_body=1\"></svg>",
  // github#5 -- a lone separator: JSON, but a newline to a script
  sep: "before" + String.fromCharCode(0x2028) + "after" + String.fromCharCode(0x2029) + "end",
  // github#5 -- template syntax, if anything ever interpolates
  title: "Hostile ${window.__vs_pwned_title=1} ]] & note",
  folder: "Notes ${1} & co",
};
export const MARKERS = ["__vs_pwned_tag", "__vs_pwned_person", "__vs_pwned_prop",
                        "__vs_pwned_body", "__vs_pwned_title"];

// github#75 -- the page draws its own icons; a stray svg did not
export const CHROME_ICONS = "#vs-manageopen, .vs-shelfaction";

// github#75 -- a bare total cannot tell an icon from an escape
export const SVG_CENSUS = `(function () {
  function where(node) {
    var path = [], e = node;
    while (e && e.nodeType === 1 && path.length < 4) {
      var cls = e.getAttribute && e.getAttribute("class");
      path.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") +
                   (cls ? "." + String(cls).trim().split(/\\s+/).join(".") : ""));
      e = e.parentElement;
    }
    return path.join(" > ");
  }
  var all = Array.prototype.slice.call(document.querySelectorAll("svg"));
  var sel = ${JSON.stringify(CHROME_ICONS)};
  var strays = all.filter(function (s) { return !s.closest(sel); });
  return {
    owned: all.length - strays.length,
    chrome: document.querySelectorAll(sel).length,
    strays: strays.map(where)
  };
})()`;

// github#5 -- Windows forbids < > : " | ? * in a filename
const FS_HOSTILE_TITLE = process.platform === "win32" ? null : "</script><b>x</b>";

/** @param {string} dir @returns {{ out: string, notes: number }} */
export function buildHostileVault(dir) {
  mkdirSync(join(dir, ".obsidian"), { recursive: true });
  writeFileSync(join(dir, ".obsidian", "app.json"), "{}", "utf8");
  const folder = join(dir, PAYLOAD.folder);
  mkdirSync(folder, { recursive: true });

  writeFileSync(join(folder, "Plain.md"),
    "---\ndate: 2026-01-05\n---\n# Plain\n\nAn ordinary note, so the hostile ones have company.\n", "utf8");

  writeFileSync(join(folder, PAYLOAD.title + ".md"),
    "---\n" +
    "date: 2026-01-06\n" +
    "tags:\n" +
    "  - " + PAYLOAD.tag + "\n" +
    "people:\n" +
    "  - " + PAYLOAD.person + "\n" +
    "status: " + PAYLOAD.prop + "\n" +
    "---\n" +
    "# Hostile\n\n" + PAYLOAD.body + "\n\n" + PAYLOAD.sep + "\n\nAnd a link to [[Plain]].\n", "utf8");

  let notes = 2;
  if (FS_HOSTILE_TITLE) {
    writeFileSync(join(folder, FS_HOSTILE_TITLE + ".md"),
      "---\ndate: 2026-01-07\n---\n# Filename\n\nThe title itself is markup.\n", "utf8");
    notes++;
  }

  const out = join(dir, "vault-shelf.html");
  const r = spawnSync(process.execPath, [BUILD, "--vault", dir, "--out", out],
                      { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build-shelf.mjs exited ${r.status}: ${(r.stderr || "").trim()}`);
  return { out, notes };
}

/** @param {string} html @returns {{ name: string, text: string }[]} */
export function inlineDataScripts(html) {
  const out = [];
  const re = /<script>window\.([A-Z_]+)=([\s\S]*?);<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push({ name: m[1], text: m[2] });
  return out;
}

/** @param {string} html @returns {number} */
const scriptTags = (html) => (html.match(/<script\b/g) || []).length;

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.on("error", rej);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

/** @param {string} htmlPath @param {Record<string, unknown>} data @returns {Promise<string[]>} */
async function inABrowser(htmlPath, data, tags) {
  const problems = [];
  const port = await freePort();
  // github#37 -- only this half places a window
  const screen = await takeLeftScreen(ownerTag("check-data-escape.mjs"),
                                      { w: 1180, h: 900, timeoutMs: LOCK_TIMEOUT_MS });
  const profile = mkdtempSync(join(tmpdir(), "vs-escape-profile-"));
  const url = pathToFileURL(htmlPath).href;
  const chrome = spawn(findChrome(), harnessChromeArgs({
    port, profile, url, window: screen.args,
  }), { stdio: "ignore" });

  let page = null;
  try {
    const deadline = Date.now() + 25000;
    for (;;) {
      try { page = await attach(port, "vault-shelf.html"); break; }
      catch (e) { if (Date.now() > deadline) throw e; await sleep(300); }
    }
    const ready = Date.now() + 30000;
    for (;;) {
      const ok = await page.eval("!!(window.__vs && __vs.counts().spines > 0)").catch(() => false);
      if (ok) break;
      if (Date.now() > ready) throw new Error("the hostile library never rendered");
      await sleep(300);
    }
    const seen = await page.eval(`JSON.stringify((function(){
      var markers = ${JSON.stringify(MARKERS)}.filter(function (k) { return window[k] !== undefined; });
      var icons = ${SVG_CENSUS};
      return {
        markers: markers,
        imgs: document.querySelectorAll("img").length,
        owned: icons.owned,
        chrome: icons.chrome,
        strays: icons.strays,
        scripts: document.querySelectorAll("script").length,
        data: __vs.data()
      };
    })())`);
    const live = JSON.parse(seen);
    if (live.markers.length) {
      problems.push(`the page executed ${live.markers.length} payload(s): ${live.markers.join(", ")}`);
    }
    if (live.imgs) problems.push(`${live.imgs} <img> element(s) in the DOM -- the payload named one`);
    // github#75 -- a stray svg is one no icon button owns
    if (live.strays.length) {
      problems.push(`${live.strays.length} <svg> element(s) outside the page's own icon buttons -- ` +
                    `the payload named one: ${live.strays.join(" | ")}`);
    }
    // github#75 -- one icon each, so nothing hides inside a button either
    if (live.owned !== live.chrome) {
      problems.push(`${live.owned} icon <svg> inside ${live.chrome} ` +
                    `"${CHROME_ICONS}" button(s) -- one each was expected`);
    }
    // github#75 -- plant a stray, so a clean read is a census that looked
    const planted = await page.eval(`JSON.stringify((function () {
      var probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      probe.id = "vs-escape-probe";
      (document.getElementById("vs-library") || document.body).appendChild(probe);
      var census = ${SVG_CENSUS};
      probe.remove();
      return census.strays;
    })())`);
    const caught = JSON.parse(planted);
    if (caught.length !== live.strays.length + 1 ||
        !caught.some((s) => /vs-escape-probe/.test(s))) {
      problems.push(`the svg census missed a planted stray: ${JSON.stringify(caught)}`);
    }
    if (live.scripts !== tags) {
      problems.push(`${live.scripts} <script> elements in the DOM, ${tags} in the file -- something closed one`);
    }
    if (JSON.stringify(live.data) !== JSON.stringify(data)) {
      problems.push("__vs.data() in the page is not the data the exporter wrote");
    }
    for (const e of page.errors) problems.push("console: " + String(e.text).split("\n")[0]);
    if (!problems.length) {
      console.log(`check-data-escape: in a browser -- 0 console errors, ${live.scripts} script elements ` +
                  `(${tags} in the file), 0 img, ${live.owned} icon svg in ${live.chrome} icon ` +
                  `buttons, 0 stray svg (a planted one caught), 0 of ${MARKERS.length} markers ran, ` +
                  `__vs.data() identical to the data block`);
    }
  } finally {
    try { if (page) await page.send("Browser.close"); } catch { }
    try { if (page) page.close(); } catch { }
    await sleep(200);
    try { chrome.kill(); } catch { }
    if (process.platform === "win32" && chrome.pid) {
      spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
    }
    rmSync(profile, { recursive: true, force: true });
    screen.release();
  }
  return problems;
}

async function main() {
  const problems = [];

  {
    const src = readFileSync(BUILD, "utf8");
    if (!/<!--DATA-->[\s\S]{0,200}?jsonForScript\(data\)/.test(src)) {
      problems.push("src/build-shelf.mjs no longer writes window.VAULT_DATA through jsonForScript()");
    }
    if (/JSON\.stringify\(data\)/.test(src)) {
      problems.push("src/build-shelf.mjs puts a bare JSON.stringify(data) into the page");
    }
  }

  const dir = mkdtempSync(join(tmpdir(), "vs-escape-"));
  let built = null;
  try {
    built = buildHostileVault(dir);
    const html = readFileSync(built.out, "utf8");
    const tags = scriptTags(html);
    const scripts = inlineDataScripts(html);
    const block = scripts.find((s) => s.name === "VAULT_DATA");
    let data = null;
    if (!block) {
      problems.push("no <script>window.VAULT_DATA=...;</script> element in the built page");
    } else {
      const lt = (block.text.match(/</g) || []).length;
      const gt = (block.text.match(/>/g) || []).length;
      const seps = (block.text.match(new RegExp(String.fromCharCode(0x2028) + "|" + String.fromCharCode(0x2029), "g")) || []).length;
      if (lt) problems.push(`the VAULT_DATA block carries ${lt} raw '<' -- a note can close it`);
      if (gt) problems.push(`the VAULT_DATA block carries ${gt} raw '>'`);
      if (seps) problems.push(`the VAULT_DATA block carries ${seps} raw U+2028/U+2029`);
      try { data = JSON.parse(block.text); } catch (e) { problems.push("VAULT_DATA is not JSON: " + e.message); }
    }
    if (data) {
      if (data.notes.length !== built.notes) {
        problems.push(`expected ${built.notes} notes in the data, got ${data.notes.length}`);
      }
      const hostile = data.notes.find((n) => n.title === PAYLOAD.title);
      if (!hostile) {
        problems.push(`the hostile note is missing from the data (titles: ` +
                      data.notes.map((n) => JSON.stringify(n.title)).join(", ") + ")");
      } else {
        const want = [
          ["tags", hostile.tags.indexOf(PAYLOAD.tag) >= 0, hostile.tags],
          ["people", hostile.people.indexOf(PAYLOAD.person) >= 0, hostile.people],
          ["props.status", hostile.props.status === PAYLOAD.prop.replace(/^"/, ""), hostile.props],
          ["the body's separators", hostile.body.indexOf(PAYLOAD.sep) >= 0, hostile.body],
          ["the body's markup", hostile.body.indexOf(PAYLOAD.body) >= 0, hostile.body],
          ["folder", hostile.folder === PAYLOAD.folder, hostile.folder],
        ];
        for (const [field, ok, got] of want) {
          if (!ok) problems.push(`${field} did not round-trip: ${JSON.stringify(got)}`);
        }
      }
      for (const s of scripts) {
        if (s.name === "VAULT_DATA") continue;
        const lt = (s.text.match(/</g) || []).length;
        if (lt) problems.push(`the ${s.name} script carries ${lt} raw '<'`);
      }
      if (!problems.length) {
        console.log(`check-data-escape: ok -- ${built.notes} notes, ${block.text.length} chars of ` +
                    `VAULT_DATA, 0 raw '<', 0 raw '>', 0 raw U+2028/U+2029, ${tags} script tags in the ` +
                    `file, every payload back byte for byte`);
      }
    }
    if (BROWSER && built) problems.push(...await inABrowser(built.out, data, tags));
  } finally {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }

  if (problems.length) {
    console.error("check-data-escape: FAIL");
    for (const p of problems) console.error("  FAIL " + p);
    process.exit(1);
  }
}

// github#5 -- run as a gate, or import buildHostileVault from anywhere
const RUN_DIRECTLY = (() => {
  try {
    return !!process.argv[1] &&
           realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
})();

if (RUN_DIRECTLY) {
  main().catch((e) => { console.error("check-data-escape: " + (e.stack || e.message)); process.exit(1); });
}
