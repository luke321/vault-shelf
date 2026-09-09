#!/usr/bin/env node

/* design/0006 -- THE THINGS THE EXPORTER CANNOT STAND IN FOR.
 *
 * scripts/smoke.mjs drives the standalone build, which covers everything about shelves, books
 * and the reader. It cannot cover the metadata cache, the view lifecycle, the ribbon icon, the
 * settings tab or a popout window, because none of those exist outside Obsidian.
 *
 * This copies a store fixture into a throwaway vault under the OS temp directory, installs the
 * three built files into it exactly as a release installs them, launches a SEPARATE Obsidian
 * with its own user-data directory and a remote-debugging port -- the Obsidian you have open
 * is not touched and not reused -- drives it over CDP, and prints the number behind every
 * check.
 *
 * It is opt-in and not in the pre-push hook: it needs Obsidian installed and takes minutes.
 *
 * A NON-DEFAULT VAULT MUST BE TRUSTED BEFORE ANY PLUGIN LOADS. Opening a vault Obsidian has
 * not seen raises "Trust author and enable plugins?" and until that is confirmed the plugin
 * does not load AT ALL -- which looks exactly like a broken plugin and is not. This harness
 * handles it itself: it writes community-plugins.json and calls setEnable/enablePluginAndSave.
 * A hand-launched Obsidian does not.
 */

import { attach } from "./cdp.mjs";
import { leftmostScreen } from "./screen.mjs";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PLUGIN_ID = "vault-shelf";
const ASSETS = ["main.js", "manifest.json", "styles.css"];

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ONLY = (arg("only", "") || "").toLowerCase();
const KEEP = argv.includes("--keep");
const SHOT = arg("shot", "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const selected = (name) => !ONLY || name.toLowerCase().includes(ONLY);

const WORK = join(tmpdir(), "vault-shelf-obsidian");
const WIN_W = Number(arg("width", "1560"));
const WIN_H = Number(arg("height", "980"));

function findObsidian() {
  const named = arg("obsidian", "");
  if (named) return named;
  const guesses = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Obsidian", "Obsidian.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Obsidian", "Obsidian.exe"),
    "/Applications/Obsidian.app/Contents/MacOS/Obsidian",
  ].filter(Boolean);
  for (const g of guesses) if (existsSync(g)) return g;
  throw new Error("Obsidian not found -- pass --obsidian <path>");
}

function fixtureStore() {
  const g = spawnSync("git", ["-C", ROOT, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
  const common = g.status === 0 ? g.stdout.trim() : "";
  const abs = common ? (/^[A-Za-z]:[\\/]|^\//.test(common) ? common : join(ROOT, common)) : join(ROOT, ".git");
  return join(dirname(abs), ".fixtures");
}

function sourceVault() {
  const explicit = arg("vault", "");
  if (explicit) return resolve(explicit);
  const want = { demo: "demo-vault-", sparse: "sparse-vault-", "10k": "library-vault-" }[arg("fixture", "demo")];
  if (!want) throw new Error("--fixture must be demo, sparse or 10k");
  const store = fixtureStore();
  const hit = existsSync(store)
    ? readdirSync(store).find((d) => d.startsWith(want) && statSync(join(store, d)).isDirectory())
    : null;
  if (!hit) {
    throw new Error("no " + want + "* fixture in " + store +
      " -- run `node scripts/smoke.mjs --only \"no console errors\"` once to generate the store");
  }
  return join(store, hit);
}

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
    s.on("error", rej);
  });
}

function makeThrowawayVault(src) {
  for (const f of ASSETS) {
    if (!existsSync(join(ROOT, f))) {
      throw new Error(f + " is missing at the repo root -- run: node scripts/build-plugin.mjs");
    }
  }
  const dest = join(WORK, basename(src));
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  cpSync(src, dest, { recursive: true,
    filter: (p) => !/[\\/]\.obsidian[\\/](plugins|workspace\.json|workspace-mobile\.json)/.test(p) });
  const dot = join(dest, ".obsidian");
  mkdirSync(dot, { recursive: true });
  const plug = join(dot, "plugins", PLUGIN_ID);
  mkdirSync(plug, { recursive: true });
  for (const f of ASSETS) cpSync(join(ROOT, f), join(plug, f));
  writeFileSync(join(dot, "community-plugins.json"), JSON.stringify([PLUGIN_ID]) + "\n");
  return dest;
}

async function launchObsidian(vault, profile, port) {
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, "obsidian.json"),
    JSON.stringify({ vaults: { "0000vaultshelf": { path: vault, ts: Date.now(), open: true } } }), "utf8");

  const t0 = Date.now();
  const child = spawn(findObsidian(), ["--remote-debugging-port=" + port, "--user-data-dir=" + profile],
                      { stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    let c = null;
    try { c = await attach(port, "app://obsidian.md"); } catch { continue; }
    try {
      if (await c.eval("typeof app !== 'undefined' && !!app.workspace")) {
        return { child, cdp: c, attachedAfterMs: Date.now() - t0 };
      }
    } catch { }
    try { c.close(); } catch { }
  }
  try { child.kill(); } catch { }
  throw new Error("Obsidian never exposed its app on port " + port);
}

function killObsidian(child) {
  try { child.kill(); } catch { }
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
  }
}

/* ------------------------------------------------------------------ run -- */

let failed = 0, ran = 0;
function report(ok, name, detail) {
  ran++;
  if (!ok) failed++;
  console.log((ok ? "  ok  " : " FAIL ") + name + "\n         " + detail);
}

const src = sourceVault();
const vault = makeThrowawayVault(src);
const profile = join(WORK, "user-data");
const PORT = await freePort();

console.log("fixture:  " + src);
console.log("vault:    " + vault);
console.log("obsidian: " + findObsidian() + " on port " + PORT);
console.log("");

const ob = await launchObsidian(vault, profile, PORT);
const c = ob.cdp;
const E = async (expr) => JSON.parse(await c.eval("JSON.stringify(" + expr + ")"));

try {
  const SCREEN = leftmostScreen();
  await c.eval(`(function(){ try { require("electron").remote.getCurrentWindow(); } catch (e) { }
    window.resizeTo(${WIN_W}, ${WIN_H}); window.moveTo(${SCREEN.x + 40}, ${SCREEN.y + 40}); })(); void 0`);
  await c.eval(`new Promise(function (r) { app.workspace.onLayoutReady(function () { r(true); }); })`);
  await sleep(800);

  /* THE TRUST DIALOG. Obsidian raises "Trust author and enable plugins?" the first time it
   * opens a vault it has not seen, and until it is answered nothing else on screen can be
   * read or photographed. Enabling plugins from the API (below) leaves the modal itself
   * standing, so it is closed here -- and the number of modals closed is printed, because a
   * modal nobody closed is the reason a later check "found nothing on screen". */
  const modalsClosed = await E(`(function(){
    var open = document.querySelectorAll(".modal-container");
    var n = 0;
    open.forEach(function (m) {
      var trust = [].slice.call(m.querySelectorAll("button")).filter(function (b) {
        return /trust|vertrauen/i.test(b.textContent || "");
      })[0];
      if (trust) { trust.click(); n++; return; }
      var close = m.querySelector(".modal-close-button");
      if (close) { close.click(); n++; }
    });
    return n;
  })()`);
  await sleep(1200);
  if (modalsClosed) console.log("  dismissed " + modalsClosed + " startup modal(s) (the trust prompt)");

  /* ---- the plugin loads ------------------------------------------------- */

  const tEnable = Date.now();
  let loaded = await E("!!app.plugins.getPlugin('" + PLUGIN_ID + "')");
  if (!loaded) {
    await c.eval("(async function(){ await app.plugins.setEnable(true); return true; })()");
    await sleep(1500);
    loaded = await E("!!app.plugins.getPlugin('" + PLUGIN_ID + "')");
    if (!loaded) {
      await c.eval("(async function(){ await app.plugins.enablePluginAndSave('" + PLUGIN_ID + "'); return true; })()");
      await sleep(1500);
      loaded = await E("!!app.plugins.getPlugin('" + PLUGIN_ID + "')");
    }
  }
  const msLoad = Date.now() - tEnable;
  if (selected("plugin loads")) {
    const files = await E("app.vault.getMarkdownFiles().length");
    report(loaded, "the plugin loads inside a real Obsidian",
           `${files} markdown files in the vault; the plugin was ready ${msLoad} ms after enabling`);
  }
  if (!loaded) throw new Error("the plugin never loaded -- nothing below can be measured");

  /* ---- the ribbon icon -------------------------------------------------- */

  if (selected("ribbon")) {
    const r = await E(`(function(){
      var svg = document.querySelector('.side-dock-ribbon [aria-label="Vault shelf"] svg')
             || document.querySelector('[aria-label="Vault shelf"] svg');
      if (!svg) return { found: false, labels: [].slice.call(document.querySelectorAll(".side-dock-ribbon [aria-label]")).map(function (n) { return n.getAttribute("aria-label"); }) };
      var box = svg.getBoundingClientRect();
      return { found: true, id: svg.classList.contains("svg-icon") || svg.getAttribute("class") || "",
               shapes: svg.querySelectorAll("rect, path").length,
               w: Math.round(box.width), h: Math.round(box.height),
               stroke: svg.querySelector("path[stroke]") !== null };
    })()`);
    report(r.found && r.shapes === 4 && r.w >= 14,
           "the bookshelf icon is in the ribbon",
           r.found ? `${r.shapes} shapes drawn at ${r.w}x${r.h}px, rail stroked: ${r.stroke}`
                   : `no ribbon item labelled "Vault shelf" -- found: ${(r.labels || []).join(", ")}`);
  }

  /* ---- the view opens --------------------------------------------------- */

  const tOpen = Date.now();
  await c.eval("(async function(){ await app.plugins.getPlugin('" + PLUGIN_ID + "').activate(); return true; })()");
  await sleep(1200);
  const msOpen = Date.now() - tOpen;

  if (selected("view opens")) {
    const r = await E(`(function(){
      var leaves = app.workspace.getLeavesOfType("vault-shelf-view");
      var root = document.querySelector(".vault-shelf");
      return { leaves: leaves.length, mounted: !!root,
               spines: document.querySelectorAll("#vs-shelves .spine").length,
               shelves: document.querySelectorAll("#vs-shelves .shelf").length,
               plaques: document.querySelectorAll("#vs-shelves .plaque").length,
               tabTitle: leaves.length ? leaves[0].getDisplayText() : "" };
    })()`);
    report(r.leaves === 1 && r.mounted && r.spines > 0,
           "the view opens and the library renders",
           `${r.shelves} shelves, ${r.spines} spines, ${r.plaques} year plaques, in ${msOpen} ms; ` +
           `tab reads "${r.tabTitle}"`);
  }

  if (selected("tab icon")) {
    const r = await E(`(function(){
      var tab = document.querySelector('.workspace-tab-header[aria-label="Vault shelf"] .workspace-tab-header-inner-icon svg')
             || document.querySelector('.workspace-tab-header-inner-icon svg');
      return { found: !!tab, shapes: tab ? tab.querySelectorAll("rect, path").length : 0 };
    })()`);
    report(r.found && r.shapes === 4, "the tab carries the same icon",
           r.found ? `${r.shapes} shapes in the tab header icon` : "no tab header icon found");
  }

  /* ---- the metadata cache is what it read ------------------------------- */

  if (selected("metadata")) {
    const r = await E(`(function(){
      var api = app.plugins.getPlugin("${PLUGIN_ID}");
      var files = app.vault.getMarkdownFiles().length;
      var spines = document.querySelectorAll("#vs-shelves .spine").length;
      var people = [].slice.call(document.querySelectorAll('#vs-shelves [data-shelf="people"] .spine')).length;
      var tags = [].slice.call(document.querySelectorAll('#vs-shelves [data-shelf="tags"] .spine')).length;
      return { files: files, spines: spines, people: people, tags: tags, hasApi: !!api };
    })()`);
    report(r.people > 0 && r.tags > 0,
           "people and tags came out of the metadata cache",
           `${r.files} notes produced ${r.people} people books and ${r.tags} tag books ` +
           `across ${r.spines} spines`);
  }

  /* ---- the debug surface is NOT in the shipped bundle -------------------- */

  if (selected("debug")) {
    const r = await E("typeof window.__vs");
    report(r === "undefined", "the debug surface is not in the shipped plugin",
           `window.__vs is ${r} inside Obsidian (the standalone build has it; the plugin bundle ` +
           `is stripped by scripts/build-plugin.mjs)`);
  }

  /* ---- close and reopen ------------------------------------------------- */

  if (selected("reopen")) {
    const before = await E(`(function(){ return { nodes: document.getElementsByTagName("*").length }; })()`);
    for (let i = 0; i < 3; i++) {
      await c.eval("(async function(){ app.workspace.getLeavesOfType('vault-shelf-view').forEach(function (l) { l.detach(); }); return true; })()");
      await sleep(400);
      await c.eval("(async function(){ await app.plugins.getPlugin('" + PLUGIN_ID + "').activate(); return true; })()");
      await sleep(700);
    }
    const after = await E(`(function(){
      return { nodes: document.getElementsByTagName("*").length,
               roots: document.querySelectorAll(".vault-shelf").length,
               spines: document.querySelectorAll("#vs-shelves .spine").length };
    })()`);
    report(after.roots === 1 && after.spines > 0,
           "three close-and-reopen cycles leave one library behind",
           `${after.roots} mounted root(s), ${after.spines} spines; DOM nodes ` +
           `${before.nodes} -> ${after.nodes}`);
  }

  /* ---- the settings tab ------------------------------------------------- */

  if (selected("settings")) {
    const r = await E(`(function(){
      var tab = app.setting.pluginTabs.filter(function (t) { return t.id === "${PLUGIN_ID}"; })[0];
      if (!tab) return { found: false };
      var declarative = typeof tab.getSettingDefinitions === "function"
        ? tab.getSettingDefinitions().length : 0;
      app.setting.open();
      app.setting.openTabById("${PLUGIN_ID}");
      return { found: true, declarative: declarative,
               active: app.setting.activeTab ? app.setting.activeTab.id : null };
    })()`);
    /* MEASURED ON THE TAB'S OWN containerEl, not on a class in the modal. Obsidian attaches
     * the tab's container lazily and has moved the modal's wrapper class more than once, so a
     * query against the modal reported the SEARCH tab's three rows and called this plugin's
     * settings tab empty -- a failure that was entirely in the check. `tab.containerEl` is
     * what the tab renders into, in every version. */
    await sleep(600);
    const rows = await E(`(function(){
      var tab = app.setting.pluginTabs.filter(function (t) { return t.id === "${PLUGIN_ID}"; })[0];
      if (!tab || !tab.containerEl) return { n: -1, names: [], attached: false };
      if (!tab.containerEl.querySelectorAll(".setting-item").length) tab.display();
      var n = tab.containerEl.querySelectorAll(".setting-item").length;
      var names = [].slice.call(tab.containerEl.querySelectorAll(".setting-item-name"))
        .map(function (el) { return el.textContent.trim(); });
      var attached = document.body.contains(tab.containerEl);
      app.setting.close();
      return { n: n, names: names, attached: attached };
    })()`);
    report(r.found && r.declarative >= 4 && rows.n >= 4,
           "the settings tab renders on both paths",
           r.found
             ? `${r.declarative} declarative definitions for 1.13 and later; display() renders ` +
               `${rows.n} rows for 1.7.2 through 1.12: ${rows.names.slice(0, 6).join(", ")} ` +
               `(tab active: ${r.active}, container attached: ${rows.attached})`
             : "no settings tab registered");
  }

  /* ---- a picture -------------------------------------------------------- */

  if (SHOT) {
    await c.eval(`(function(){ document.querySelectorAll(".modal-container .modal-close-button")
      .forEach(function (b) { b.click(); }); })(); void 0`);
    await c.eval("(async function(){ await app.plugins.getPlugin('" + PLUGIN_ID + "').activate(); return true; })()");
    await sleep(1500);
    const shot = await c.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("\nwrote " + SHOT);
  }

  console.log(`\n${ran - failed}/${ran} passed`);
} finally {
  try { c.close(); } catch { }
  killObsidian(ob.child);
  await sleep(500);
  if (!KEEP) rmSync(WORK, { recursive: true, force: true });
  else console.log("--keep: left the vault and profile in " + WORK);
}

process.exit(failed ? 1 : 0);
