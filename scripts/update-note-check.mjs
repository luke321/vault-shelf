#!/usr/bin/env node
// github#33, design/0023 -- the strip in a real Obsidian, seven states

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attach } from "./cdp.mjs";
import { currentFixture } from "./fixture-store.mjs";
// github#37, decisions/0012
import { leftWindow, placeElectronLeft, takeLeftScreen } from "./screen.mjs";
import { ownerTag } from "./lock.mjs";
import { CHAIN_MAX, decideNote, parseNote, releaseChain, semver } from "../plugin/update-note.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes("--" + n);

const VT = "vault-shelf-view";
const PLUGIN_ID = "vault-shelf";
const PORT = Number(arg("port", "9451"));
const KEEP = flag("keep");
const TEMP = process.env.TEMP || tmpdir();
const WORK = join(TEMP, "vault-shelf-update-note-check");
const OUT = resolve(arg("out", join(WORK, "shots")));
const OPEN_TIMEOUT_MS = Number(arg("timeout", "120")) * 1000;
// github#37 -- a blocked run names the holder and gives up
const LOCK_TIMEOUT_MS = Number(arg("lock-timeout-ms", "2700000")) || 2700000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// decisions/0014 -- the one vault shape, from the store the suite shares
function sourceVault() {
  const explicit = arg("vault", "");
  if (explicit) return resolve(explicit);
  const hit = currentFixture(ROOT, "vault");
  if (!hit) throw new Error("no vault-* fixture in the store -- run node scripts/smoke.mjs --only golden once");
  return hit;
}

function makeThrowawayVault(src) {
  for (const f of ["main.js", "manifest.json", "styles.css"]) {
    if (!existsSync(join(ROOT, f))) throw new Error(f + " is missing at the repo root -- run: node scripts/build-plugin.mjs");
  }
  const dest = join(WORK, basename(src));
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  cpSync(src, dest, { recursive: true, filter: (p) => !/[\\/]\.obsidian[\\/](plugins|workspace\.json|workspace-mobile\.json)/.test(p) });
  const dot = join(dest, ".obsidian");
  mkdirSync(dot, { recursive: true });
  const plug = join(dot, "plugins", PLUGIN_ID);
  mkdirSync(plug, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) cpSync(join(ROOT, f), join(plug, f));
  writeFileSync(join(dot, "community-plugins.json"), JSON.stringify([PLUGIN_ID]) + "\n");
  return dest;
}

async function launchObsidian(vault, profile, args) {
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, "obsidian.json"),
    JSON.stringify({ vaults: { "0000updatenote": { path: vault, ts: Date.now(), open: true } } }), "utf8");
  const child = spawn(findObsidian(), ["--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, ...args],
                      { stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    let c = null;
    try { c = await attach(PORT, "app://obsidian.md"); } catch { continue; }
    try {
      if (await c.eval("typeof app !== 'undefined' && !!app.workspace")) return { child, cdp: c };
    } catch { }
    try { c.close(); } catch { }
  }
  try { child.kill(); } catch { }
  throw new Error("Obsidian never exposed its app on port " + PORT);
}

function killObsidian(child) {
  try { child.kill(); } catch { }
}

async function waitFor(c, expr, ms, label) {
  const deadline = Date.now() + ms;
  for (;;) {
    let v = null;
    try { v = await c.eval(expr); } catch { v = null; }
    if (v) return v;
    if (Date.now() > deadline) throw new Error(label + " did not happen within " + ms + " ms");
    await sleep(120);
  }
}

/* ---- the checks --------------------------------------------------------- */

const results = [];
function report(ok, name, detail) {
  results.push({ ok, name, detail });
  console.log("  " + (ok ? "ok  " : "FAIL") + " " + name + (detail ? "   (" + detail + ")" : ""));
}

const VIEW = "(function(){ var ls = app.workspace.getLeavesOfType(" + JSON.stringify(VT) + "); return ls[0] && ls[0].view; })()";
const STRIP = "(function(){ var v = " + VIEW + "; return v ? v.contentEl.querySelector('.vs-whatsnew') : null; })()";
const READY = "(function(){ var v = " + VIEW + "; if (!v || !v.handle || !v.page) return false;" +
              " var s = v.page.querySelector('#vs-shelves'); return !!(s && s.children.length); })()";

const src = sourceVault();
const vault = makeThrowawayVault(src);
const plugDir = join(vault, ".obsidian", "plugins", PLUGIN_ID);
const dataFile = join(plugDir, "data.json");
const note = parseNote(readFileSync(join(ROOT, "plugin", "whats-new.md"), "utf8")).note;
if (!note) throw new Error("plugin/whats-new.md does not parse -- the build would have refused it");
const N = note.version;
const [maj, min, pat] = semver(N);
const PREV_RELEASE = min > 0 ? maj + "." + (min - 1) + ".0" : (maj - 1) + ".0.0";
const BUMP = min > 0 ? "MINOR" : "MAJOR";
if (maj === 0 && min === 0) throw new Error("the update-note harness needs a release after 0.0.x");
const NEXT_PATCH = maj + "." + min + "." + (pat + 1);
const NEXT_MINOR = maj + "." + (min + 1) + ".0";

console.log("update-note-check: " + findObsidian());
console.log("fixture: " + src);
console.log("throwaway vault: " + vault);
console.log("note: " + N + " (" + note.lines.length + " line" + (note.lines.length === 1 ? "" : "s") + ")");
mkdirSync(OUT, { recursive: true });

const screen = await takeLeftScreen(ownerTag("update-note-check.mjs"),
                                    { w: 1600, h: 1000, timeoutMs: LOCK_TIMEOUT_MS });
const MAIN = leftWindow(1600, 1000);

const profile = join(WORK, "profile");
console.log("launching a separate Obsidian on port " + PORT + " ...");
const ob = await launchObsidian(vault, profile, screen.args);
const c = ob.cdp;
const E = (expr) => c.eval(expr);

const readData = () => existsSync(dataFile) ? readFileSync(dataFile, "utf8") : null;
const lastSeen = () => { const t = readData(); if (t === null) return null; const j = JSON.parse(t); return "lastSeenVersion" in j ? j.lastSeenVersion : undefined; };

/** @param {object | null} data @param {string} installed */
async function reloadPlugin(data, installed) {
  if (data === null) rmSync(dataFile, { force: true });
  else writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n", "utf8");
  const man = JSON.parse(readFileSync(join(plugDir, "manifest.json"), "utf8"));
  man.version = installed;
  writeFileSync(join(plugDir, "manifest.json"), JSON.stringify(man, null, 2) + "\n", "utf8");
  await E("(async function(){ await app.plugins.disablePlugin(" + JSON.stringify(PLUGIN_ID) + ");" +
          " var m = app.plugins.manifests[" + JSON.stringify(PLUGIN_ID) + "]; if (m) m.version = " + JSON.stringify(installed) + ";" +
          " await app.plugins.enablePlugin(" + JSON.stringify(PLUGIN_ID) + "); return true; })()");
  await waitFor(c, "!!app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ")", 30000, "the plugin reload");
  await sleep(400);
  const v = await E("app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ").manifest.version");
  if (v !== installed) throw new Error("the reloaded plugin reports " + v + ", wanted " + installed);
}

// github#33 -- settled is two equal measurements of the room's box
async function settle(ms = 15000) {
  const deadline = Date.now() + ms;
  let prev = null, same = 0;
  for (;;) {
    const k = await E("(function(){ var v = " + VIEW + "; if (!v || !v.page) return '';" +
                      " var r = v.page.getBoundingClientRect();" +
                      " return r.height.toFixed(2) + '|' + v.page.querySelectorAll('.vs-book').length; })()").catch(() => "");
    if (k && k === prev) { if (++same >= 3) return; } else { same = 0; }
    prev = k;
    if (Date.now() > deadline) return;
    await sleep(200);
  }
}

async function openLibrary() {
  await E("app.commands.executeCommandById(" + JSON.stringify(PLUGIN_ID + ":open") + "); void 0");
  await waitFor(c, READY, OPEN_TIMEOUT_MS, "the library");
  await settle();
}

async function closeLibrary() {
  await E("(function(){ app.workspace.getLeavesOfType(" + JSON.stringify(VT) + ").forEach(function (l) { l.detach(); }); })(); void 0");
  await sleep(300);
}

const stripShown = () => E("!!" + STRIP);
const geometry = () => E("(function(){ var v = " + VIEW + "; var s = " + STRIP + "; var page = v.page;" +
                         " return { strip: s ? +s.getBoundingClientRect().height.toFixed(2) : 0," +
                         " page: page ? +page.getBoundingClientRect().height.toFixed(2) : 0," +
                         " view: v.contentEl.clientHeight," +
                         " width: page ? +page.getBoundingClientRect().width.toFixed(2) : 0," +
                         " placed: !!(s && page && s.parentElement === v.contentEl && s.nextElementSibling === page) }; })()");

async function dismissModals() {
  for (let i = 0; i < 3; i++) {
    const open = await E("(function(){ var b = document.querySelector('.modal-close-button'); if (b) b.click(); return !!document.querySelector('.modal-container'); })()");
    if (!open) return;
    await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(300);
  }
}

async function shoot(name) {
  await dismissModals();
  await E("(function(){ document.querySelectorAll('.notice').forEach(function (n) { n.remove(); }); })(); void 0");
  const r = await c.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("      " + name + ".png");
}

try {
  await placeElectronLeft(E, MAIN.w, MAIN.h);
  await E("new Promise(function (r) { app.workspace.onLayoutReady(function () { try { app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse(); } catch (e) { } r(true); }); })");
  await sleep(500);
  const already = await E("!!app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ")");
  if (!already) {
    await E("(async function(){ await app.plugins.setEnable(true); return true; })()");
    await sleep(1500);
    if (!await E("!!app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ")")) {
      await E("(async function(){ await app.plugins.enablePluginAndSave(" + JSON.stringify(PLUGIN_ID) + "); return true; })()");
    }
  }
  await waitFor(c, "!!app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ")", 30000, "the plugin load");
  await dismissModals();

  // github#33, design/0023
  for (const [kind, lastSeen, installed] of [["MINOR", "1.0.0", "1.1.0"], ["MAJOR", "0.9.0", "1.0.0"]]) {
    const candidate = { version: installed, lines: note.lines, points: [] };
    const decision = decideNote({ installed, lastSeen, hadData: true, note: candidate });
    report(decision.show === candidate && !decision.record,
           kind + " upgrade waits for dismissal before recording", lastSeen + " -> " + installed);
  }

  console.log("fresh install (no data.json, " + N + ")");
  await reloadPlugin(null, N);
  await openLibrary();
  report(!await stripShown(), "a fresh install shows no note");
  report(lastSeen() === N, "a fresh install records the version", "lastSeenVersion " + lastSeen());
  await closeLibrary();

  console.log("upgrade from before update notes ({ schema: 10 }, " + N + ")");
  await reloadPlugin({ schema: 10 }, N);
  await openLibrary();
  report(await stripShown(), "a data.json without lastSeenVersion shows the note");
  report(lastSeen() === undefined, "nothing is recorded while the note is up", "lastSeenVersion " + lastSeen());
  const links = await E("(function(){ var s = " + STRIP + "; return s ? Array.prototype.map.call(s.querySelectorAll('a'), function (a) { return a.getAttribute('href') + ' ' + a.getAttribute('target'); }) : []; })()");
  report(links.length === 2 && links[0] === "https://github.com/luke321/vault-shelf/releases/tag/" + N + " _blank" &&
         links[1] === "https://luke321.github.io/vault-shelf/features.html _blank",
         "the strip links to the release page and the feature gallery, in a new window", links.join(" | "));
  const bullets = await E("(function(){ var s = " + STRIP + "; return s ? Array.prototype.map.call(s.querySelectorAll('li'), function (l) { return l.textContent; }) : []; })()");
  report(bullets.join("\n") === note.lines.join("\n"), "the bullets are the note file's, verbatim", bullets.length + " bullet" + (bullets.length === 1 ? "" : "s"));
  await shoot("01-strip-up");
  await closeLibrary();

  await openLibrary();
  report(await stripShown(), "reopening the view before dismissing shows it again");
  const up = await geometry();
  await E("(function(){ var s = " + STRIP + "; s.querySelector('.vs-whatsnew-ok').click(); })(); void 0");
  await settle();
  const after = await geometry();
  report(!await stripShown(), "dismissing removes the strip");
  report(lastSeen() === N, "dismissing records the installed version", "lastSeenVersion " + lastSeen());
  report(up.strip > 0 && Math.abs((after.page - up.page) - up.strip) <= 1,
         "the library takes the strip's height back, within a pixel",
         "strip " + up.strip + " px, library " + up.page + " -> " + after.page + " px");
  report(up.placed, "the strip sits in the view above the page root, not inside it");
  report(up.width === after.width && up.view === after.view,
         "and the room is the same width with and without it",
         "width " + up.width + " -> " + after.width + ", view " + up.view + " -> " + after.view);
  await shoot("02-dismissed");
  await closeLibrary();
  await openLibrary();
  report(!await stripShown(), "reopening after dismissing shows nothing");

  // github#33, design/0023 -- D-1: core.migrate() drops what it does not know
  const beforeSave = lastSeen();
  await E("(async function(){ var p = app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ");" +
          " await p.saveSettings(p.config); return true; })()");
  await sleep(400);
  report(beforeSave === N && lastSeen() === N,
         "a settings write keeps the version the strip recorded",
         "lastSeenVersion " + beforeSave + " -> " + lastSeen());
  await closeLibrary();

  console.log(BUMP + " bump ({ lastSeenVersion: " + PREV_RELEASE + " }, " + N + ")");
  await reloadPlugin({ lastSeenVersion: PREV_RELEASE }, N);
  await openLibrary();
  report(await stripShown(), "a " + BUMP + " bump shows the note");
  const one = await E("(function(){ var s = " + STRIP + "; return s ? Array.prototype.map.call(s.querySelectorAll('.vs-whatsnew-chain a'), function (a) { return a.textContent; }) : []; })()");
  report(one.length === 1 && one[0] === N, BUMP + " predecessor: the chain is the note's version alone", one.join(", "));
  await closeLibrary();

  await reloadPlugin(JSON.parse(readData()), N);
  await openLibrary();
  report(await stripShown(), "a plugin restart before dismissing shows it again");
  report(lastSeen() === PREV_RELEASE, "and still records nothing", "lastSeenVersion " + lastSeen());
  await closeLibrary();

  // github#33, design/0023 -- a span invented, because the CHANGELOG has one
  const invented =[{ version: "0.4.0", name: "Plaques" }, { version: "0.3.1", name: "" },
                    { version: "0.3.0", name: "" }, { version: "0.2.0", name: "Bookcase" }];
  const top = { version: "0.4.0", lines: note.lines, points: [] };
  const want = releaseChain({ releases: invented, lastSeen: "0.1.0", installed: top.version, note: top });
  await reloadPlugin({ lastSeenVersion: PREV_RELEASE }, N);
  await openLibrary();
  await closeLibrary();
  await E("(function(){ var p = app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ");" +
          " p.pendingNote = " + JSON.stringify(top) + "; p.pendingChain = " + JSON.stringify(want) + "; })(); void 0");
  await openLibrary();
  const got = await E("(function(){ var s = " + STRIP + "; return s ? Array.prototype.map.call(s.querySelectorAll('.vs-whatsnew-chain a'), function (a) { return { v: a.textContent, href: a.getAttribute('href'), title: a.getAttribute('title') || '' }; }) : []; })()");
  report(want.map((r) => r.version).join("|") === "0.2.0|0.3.0|0.4.0",
         "0.1.0 to 0.4.0 is every x.y.0 between, oldest first, the patch left out",
         want.map((r) => r.version).join(", "));
  report(got.length === want.length &&
         got.every((g, i) => g.v === want[i].version && g.href === "https://github.com/luke321/vault-shelf/releases/tag/" + want[i].version && g.title === want[i].name),
         "and the strip draws exactly those, each linking its own release page, the name on hover",
         got.map((g) => g.v + (g.title ? " (" + g.title + ")" : "")).join(", "));
  await shoot("03-chain");
  await closeLibrary();

  // github#33, design/0023 -- past CHAIN_MAX the oldest collapse into one link
  const many = [];
  for (let i = 1; i <= CHAIN_MAX + 3; i++) many.push({ version: "0." + i + ".0", name: "" });
  await E("(function(){ var p = app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ");" +
          " p.pendingNote = " + JSON.stringify(top) + "; p.pendingChain = " + JSON.stringify(many) + "; })(); void 0");
  await openLibrary();
  const over = await E("(function(){ var s = " + STRIP + "; return s ? Array.prototype.map.call(s.querySelectorAll('.vs-whatsnew-chain a'), function (a) { return { v: a.textContent, href: a.getAttribute('href'), title: a.getAttribute('title') || '' }; }) : []; })()");
  const first = over[0] || {};
  report(over.length === CHAIN_MAX + 1 && first.v === "…" && first.href === "https://github.com/luke321/vault-shelf/releases" &&
         first.title === "3 earlier releases" &&
         over[1].v === many[3].version && over[over.length - 1].v === many[many.length - 1].version,
         CHAIN_MAX + 3 + " releases behind: the oldest 3 become one link to the releases page, the newest " + CHAIN_MAX + " stay",
         over.map((g) => g.v).join(", "));
  await closeLibrary();

  console.log("the controls a note points at (github#33)");
  await reloadPlugin({ lastSeenVersion: PREV_RELEASE }, N);
  const POINT = "vs-manageopen";
  await E("(function(){ var p = app.plugins.getPlugin(" + JSON.stringify(PLUGIN_ID) + ");" +
          " p.pendingNote = { version: p.manifest.version, lines: ['x'], points: [" + JSON.stringify(POINT) + "] }; })(); void 0");
  await openLibrary();
  const lit = await E("(function(){ var v = " + VIEW + "; var el = v.contentEl.querySelector('#" + POINT + "');" +
                      " if (!el) return null; var cs = getComputedStyle(el);" +
                      " return { on: el.classList.contains('vs-new'), anim: cs.animationName, dur: cs.animationDuration }; })()");
  report(!!lit && lit.on && lit.anim === "vs-new-pulse",
         "a control the note points at carries the pulse while the strip is up",
         lit ? lit.anim + " " + lit.dur : "the control was not found");
  await shoot("04-pulse");
  await E("(function(){ var v = " + VIEW + "; v.contentEl.querySelector('.vs-whatsnew-ok').click(); })(); void 0");
  await sleep(700);
  const out = await E("(function(){ var v = " + VIEW + "; return v.contentEl.querySelectorAll('.vs-new').length; })()");
  report(out === 0, "dismissing stops the pulse", out + " still pulsing");
  await closeLibrary();
  await openLibrary();
  const reopened = await E("(function(){ var v = " + VIEW + "; return v.contentEl.querySelectorAll('.vs-new').length; })()");
  report(reopened === 0, "and it does not come back when the view is reopened", reopened + " pulsing");
  await closeLibrary();

  console.log("patch bump ({ lastSeenVersion: " + N + " }, " + NEXT_PATCH + ")");
  await reloadPlugin({ lastSeenVersion: N }, NEXT_PATCH);
  await openLibrary();
  report(!await stripShown(), "a PATCH bump shows nothing");
  report(lastSeen() === NEXT_PATCH, "a PATCH bump records the version", "lastSeenVersion " + lastSeen());
  await closeLibrary();

  console.log("already seen ({ lastSeenVersion: " + N + " }, " + N + ")");
  await reloadPlugin({ lastSeenVersion: N }, N);
  const bytesBefore = readData();
  await openLibrary();
  report(!await stripShown(), "an already-seen version shows nothing");
  report(readData() === bytesBefore, "and writes nothing", "data.json unchanged");
  await closeLibrary();

  console.log("note for another minor ({ lastSeenVersion: " + N + " }, " + NEXT_MINOR + ")");
  await reloadPlugin({ lastSeenVersion: N }, NEXT_MINOR);
  await openLibrary();
  report(!await stripShown(), "a MINOR bump whose note is for another version shows nothing");
  report(lastSeen() === NEXT_MINOR, "and records the version", "lastSeenVersion " + lastSeen());
  await closeLibrary();

  const errors = c.errors.filter((e) => /vault-shelf|whatsnew|update-note/i.test(String(e.text)));
  report(errors.length === 0, "no console errors from the plugin", errors.map((e) => String(e.text).split("\n")[0]).join(" | "));
} finally {
  if (KEEP) {
    console.log("--keep: Obsidian left open on port " + PORT + ", vault " + vault);
  } else {
    try { c.close(); } catch { }
    killObsidian(ob.child);
  }
  screen.release();
}

const failed = results.filter((r) => !r.ok).length;
console.log("update-note-check: " + (results.length - failed) + "/" + results.length + " passed" + (failed ? ", " + failed + " FAILED" : ""));
console.log("shots: " + OUT);
process.exit(failed ? 1 : 0);
