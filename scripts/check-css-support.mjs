#!/usr/bin/env node
// github#61, design/0036 -- the CSS the sheets rely on, asked of a real Obsidian

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attach } from "./cdp.mjs";
import { currentFixture } from "./fixture-store.mjs";
import { leftWindow, placeElectronLeft, takeLeftScreen } from "./screen.mjs";
import { ownerTag } from "./lock.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes("--" + n);

const VT = "vault-shelf-view";
const PLUGIN_ID = "vault-shelf";
const PORT = Number(arg("port", "9453"));
const KEEP = flag("keep");
const TEMP = process.env.TEMP || tmpdir();
const WORK = join(TEMP, "vault-shelf-css-support");
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
    JSON.stringify({ vaults: { "0000csssupport": { path: vault, ts: Date.now(), open: true } } }), "utf8");
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

/* ---- the probes --------------------------------------------------------- */

// github#61 -- each probe runs in the page that has the real sheets loaded
const PROBES = {
  engine: `(function(){
    var ua = navigator.userAgent;
    var chrome = (/Chrome\\/([\\d.]+)/.exec(ua) || [])[1] || "?";
    var electron = (/Electron\\/([\\d.]+)/.exec(ua) || [])[1] || "?";
    var ob = (/obsidian\\/([\\d.]+)/i.exec(ua) || [])[1] || "?";
    return { chrome: chrome, electron: electron, obsidian: ob, ua: ua };
  })()`,

  // github#61 -- hit-testing proves the clip actually applied
  clipPolygon: `(function(){
    var shape = "polygon(0 0, 100% 0, 100% 100%, 50% 74%, 0 100%)";
    var supports = CSS.supports("clip-path", shape);
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:200px;height:200px;z-index:2147483646;background:#000";
    var el = document.createElement("div");
    el.style.cssText = "position:absolute;inset:0;background:#fff;clip-path:" + shape;
    host.appendChild(el);
    document.body.appendChild(host);
    var notch = document.elementFromPoint(100, 190);
    var solid = document.elementFromPoint(10, 10);
    var computed = getComputedStyle(el).clipPath;
    host.remove();
    return { supports: supports, computed: computed,
             clippedAway: notch !== el, paintedWhereSolid: solid === el };
  })()`,

  clipInset: `(function(){
    return { supports: CSS.supports("clip-path", "inset(0)") };
  })()`,

  // github#61 -- the flex code path, not multicol: measure the gap that lands
  columnGap: `(function(){
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;display:flex;align-items:center;column-gap:10px;width:400px";
    var a = document.createElement("div"), b = document.createElement("div");
    a.style.cssText = b.style.cssText = "width:50px;height:20px";
    host.appendChild(a); host.appendChild(b);
    document.body.appendChild(host);
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    var gap = +(rb.left - ra.right).toFixed(2);
    var computed = getComputedStyle(host).columnGap;
    host.remove();
    return { supports: CSS.supports("column-gap", "10px"), gap: gap, computed: computed };
  })()`,

  textDecoration: `(function(){
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;text-decoration:underline;" +
                         "text-decoration-thickness:1px;text-underline-offset:2px";
    document.body.appendChild(host);
    var cs = getComputedStyle(host);
    var thickness = cs.textDecorationThickness, offset = cs.textUnderlineOffset;
    host.style.textDecoration = "underline dotted";
    var style = getComputedStyle(host).textDecorationStyle;
    host.remove();
    return { supportsThickness: CSS.supports("text-decoration-thickness", "1px"),
             supportsOffset: CSS.supports("text-underline-offset", "2px"),
             supportsDotted: CSS.supports("text-decoration", "underline dotted"),
             thickness: thickness, offset: offset, dottedStyle: style };
  })()`,

  // github#61 -- does the keyword resolve, or does the stack fall through?
  uiMonospace: `(function(){
    function widthOf(stack) {
      var s = document.createElement("span");
      s.textContent = "0123456789 the quick brown fox";
      s.style.cssText = "position:fixed;left:-9999px;top:0;font-size:32px;white-space:pre;font-family:" + stack;
      document.body.appendChild(s);
      var w = +s.getBoundingClientRect().width.toFixed(2);
      s.remove();
      return w;
    }
    var shipped = widthOf("ui-monospace, SFMono-Regular, Menlo, monospace");
    var withoutKeyword = widthOf("SFMono-Regular, Menlo, monospace");
    var plain = widthOf("monospace");
    var serif = widthOf("serif");
    return { shipped: shipped, withoutKeyword: withoutKeyword, plain: plain, serif: serif,
             keywordResolves: shipped !== withoutKeyword,
             fallsBackToMonospace: shipped === plain,
             monospaceIsDistinct: plain !== serif };
  })()`,

  // github#61 -- which product shapes actually carry a clip in the live page
  clipInUse: `(function(){
    var root = document.querySelector(".vault-shelf");
    var seen = {};
    document.querySelectorAll("*").forEach(function (el) {
      var cp = getComputedStyle(el).clipPath;
      if (!cp || cp === "none") return;
      var key = Array.prototype.filter.call(el.classList, function (c) {
        return c.indexOf("vs-") === 0;
      }).join(".");
      if (!key) return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (!seen[key]) seen[key] = { cls: key, count: 0, clip: cp, rect: null };
      seen[key].count++;
      var onScreen = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
      // github#61 -- a rect behind the reader photographs the reader, not the shape
      var hit = onScreen ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      var topmost = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      if (!seen[key].rect && onScreen && topmost) {
        seen[key].rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
    });
    var sample = ["vs-mark", "vs-markstub", "vs-ribbon", "vs-ribbonswatch"].map(function (cls) {
      var el = document.querySelector("." + cls);
      if (!el) return { cls: cls, present: false };
      var r = el.getBoundingClientRect();
      return { cls: cls, present: true, clip: getComputedStyle(el).clipPath,
               inRoot: !!(root && root.contains(el)),
               chain: (function(){ var out = [], n = el; for (var i = 0; i < 6 && n; i++) {
                 out.push(n.tagName.toLowerCase() + (n.classList.length ? "." + Array.prototype.join.call(n.classList, ".") : ""));
                 n = n.parentElement; } return out.join(" < "); })(),
               rect: { x: r.left, y: r.top, w: +r.width.toFixed(1), h: +r.height.toFixed(1) } };
    });
    return { root: !!root, sample: sample, kinds: Object.keys(seen).map(function (k) { return seen[k]; }) };
  })()`,

  // github#61 -- [hidden] must beat a class that sets display
  hiddenWins: `(function(){
    var wrap = document.createElement("div");
    wrap.className = "vault-shelf";
    wrap.style.cssText = "position:fixed;left:-9999px;top:0";
    var el = document.createElement("div");
    el.className = "vs-railsearch";
    wrap.appendChild(el);
    document.body.appendChild(wrap);
    var shown = getComputedStyle(el).display;
    el.hidden = true;
    var hiddenDisplay = getComputedStyle(el).display;
    wrap.remove();
    return { classDisplay: shown, hiddenDisplay: hiddenDisplay,
             classSetsDisplay: shown !== "" && shown !== "block" && shown !== "none",
             hiddenWins: hiddenDisplay === "none" };
  })()`,
};

/* ---- the run ------------------------------------------------------------ */

const results = [];
function report(ok, name, detail) {
  results.push({ ok: ok, name: name });
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + name + (detail ? "  -- " + detail : ""));
}

const src = sourceVault();
const vault = makeThrowawayVault(src);

console.log("check-css-support: " + findObsidian());
console.log("fixture: " + src);
console.log("throwaway vault: " + vault);
mkdirSync(OUT, { recursive: true });

const screen = await takeLeftScreen(ownerTag("check-css-support.mjs"),
                                    { w: 1600, h: 1000, timeoutMs: LOCK_TIMEOUT_MS });
const MAIN = leftWindow(1600, 1000);

const profile = join(WORK, "profile");
console.log("launching a separate Obsidian on port " + PORT + " ...");
const ob = await launchObsidian(vault, profile, screen.args);
const c = ob.cdp;
const E = (expr) => c.eval(expr);

const VIEW = "(function(){ var ls = app.workspace.getLeavesOfType(" + JSON.stringify(VT) + "); return ls[0] && ls[0].view; })()";
const READY = "(function(){ var v = " + VIEW + "; if (!v || !v.handle || !v.page) return false;" +
              " var s = v.page.querySelector('#vs-shelves'); return !!(s && s.children.length); })()";

async function dismissModals() {
  for (let i = 0; i < 3; i++) {
    const open = await E("(function(){ var b = document.querySelector('.modal-close-button'); if (b) b.click(); return !!document.querySelector('.modal-container'); })()");
    if (!open) return;
    await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(300);
  }
}

async function settle(ms = 15000) {
  const deadline = Date.now() + ms;
  let prev = null, same = 0;
  for (;;) {
    const k = await E("(function(){ var v = " + VIEW + "; if (!v || !v.page) return '';" +
                      " var r = v.page.getBoundingClientRect();" +
                      " return r.height.toFixed(2) + '|' + v.page.querySelectorAll('.vs-spine').length; })()").catch(() => "");
    if (k && k === prev) { if (++same >= 3) return; } else { same = 0; }
    prev = k;
    if (Date.now() > deadline) return;
    await sleep(200);
  }
}

async function shoot(name) {
  await dismissModals();
  await E("(function(){ document.querySelectorAll('.notice').forEach(function (n) { n.remove(); }); })(); void 0");
  const r = await c.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("      " + name + ".png");
}

// github#61 -- numbers cannot see: photograph the shape itself
async function shootRect(name, rect, pad = 10) {
  await dismissModals();
  const clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad),
                 width: rect.w + pad * 2, height: rect.h + pad * 2, scale: 4 };
  const r = await c.send("Page.captureScreenshot", { format: "png", clip: clip });
  writeFileSync(join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("      " + name + ".png");
}

// github#61 -- "default" is page.css alone: no attribute
async function setLook(look) {
  await E("(function(){ var v = " + VIEW + "; if (!v) return false;" +
          " var root = v.contentEl.querySelector('.vault-shelf') || (v.page && v.page.closest('.vault-shelf'));" +
          " if (!root) return false;" +
          " if (" + JSON.stringify(look) + " === 'default') root.removeAttribute('data-look');" +
          " else root.setAttribute('data-look', " + JSON.stringify(look) + "); return true; })()");
  await sleep(600);
}

// github#61 -- a rebuild resets data-look and every assertion still passed
async function lookApplied() {
  return E("(function(){ var r = document.querySelector('.vault-shelf');" +
           " return r ? (r.getAttribute('data-look') || 'default') : 'no-root'; })()");
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
  await waitFor(c, "app.vault.getMarkdownFiles().every(function (file) { return !!app.metadataCache.getFileCache(file); })",
                OPEN_TIMEOUT_MS, "the complete fixture metadata cache");

  await E("app.commands.executeCommandById(" + JSON.stringify(PLUGIN_ID + ":open") + "); void 0");
  await waitFor(c, READY, OPEN_TIMEOUT_MS, "the library");
  await settle();

  const engine = await E(PROBES.engine);
  console.log("\nengine: Chromium " + engine.chrome + " / Electron " + engine.electron +
              (engine.obsidian === "?" ? "" : " / Obsidian " + engine.obsidian));
  console.log("user agent: " + engine.ua);
  const manifest = await E("JSON.stringify(app.plugins.manifests[" + JSON.stringify(PLUGIN_ID) + "])");
  console.log("manifest minAppVersion: " + (JSON.parse(manifest).minAppVersion || "?") + "\n");

  const clip = await E(PROBES.clipPolygon);
  report(clip.supports, "clip-path: polygon() is supported", "computed " + clip.computed);
  report(clip.clippedAway && clip.paintedWhereSolid, "clip-path: polygon() actually clips",
         "notch excluded " + clip.clippedAway + ", body painted " + clip.paintedWhereSolid);

  const inset = await E(PROBES.clipInset);
  report(inset.supports, "clip-path: inset() is supported", "CSS.supports " + inset.supports);

  const gap = await E(PROBES.columnGap);
  report(gap.supports && gap.gap === 10, "column-gap lands 10px in a flex row",
         "measured " + gap.gap + "px, computed " + gap.computed);

  const td = await E(PROBES.textDecoration);
  report(td.supportsThickness && td.thickness === "1px", "text-decoration-thickness applies", "computed " + td.thickness);
  report(td.supportsOffset && td.offset === "2px", "text-underline-offset applies", "computed " + td.offset);
  report(td.supportsDotted && td.dottedStyle === "dotted", "text-decoration: underline dotted applies", "computed " + td.dottedStyle);

  const mono = await E(PROBES.uiMonospace);
  report(mono.monospaceIsDistinct, "the monospace fallback resolves to a real font",
         "monospace " + mono.plain + "px vs serif " + mono.serif + "px");
  report(mono.shipped === mono.plain || mono.keywordResolves,
         "the shipped stack paints a monospace face",
         "shipped " + mono.shipped + "px, without the keyword " + mono.withoutKeyword +
         "px, plain monospace " + mono.plain + "px; ui-monospace resolves: " + mono.keywordResolves);

  // github#61 -- the guard the linter would have talked someone out of
  const hid = await E(PROBES.hiddenWins);
  report(hid.classSetsDisplay, "the class selector does set a display", "computed " + hid.classDisplay);
  report(hid.hiddenWins, "[hidden] still beats it", "computed " + hid.hiddenDisplay);

  // github#61 -- a ribbon exists once a note is left in a book
  await E("(function(){ var s = document.querySelector('.vault-shelf .vs-spine'); if (s) s.click(); })(); void 0");
  await waitFor(c, "!!document.querySelector('.vs-markstub')", 20000, "the reader");
  await sleep(500);
  await E("(function(){ var b = document.querySelector('.vs-markstub'); if (b) b.click(); })(); void 0");
  await waitFor(c, "!!document.querySelector('.vs-mark')", 20000, "the ribbon");
  await sleep(500);
  console.log("left a ribbon in the first book");

  // github#61 -- the debug api is stripped from the plugin build
  const READER_SHOWN = "(function(){ var r = document.querySelector('.vs-reader');" +
                       " return !!(r && r.offsetParent !== null); })()";
  const openReader = async () => {
    await E("(function(){ var s = document.querySelector('.vault-shelf .vs-spine'); if (s) s.click(); })(); void 0");
    await waitFor(c, READER_SHOWN, 20000, "the reader");
    await sleep(600);
  };
  const closeReader = async () => {
    await E("(function(){ var b = document.getElementById('vs-back'); if (b) b.click(); })(); void 0");
    await waitFor(c, "!" + READER_SHOWN, 20000, "the shelves");
    await sleep(600);
  };

  for (const look of ["default", "leather"]) {
    await setLook(look);
    report(await lookApplied() === look, "the reader is painted in the " + look + " look");
    const inReader = await E(PROBES.clipInUse);
    for (const sm of inReader.sample) {
      if (!sm.present) { console.log("      . " + sm.cls + ": not present"); continue; }
      console.log("      . " + sm.cls + ": clip=" + sm.clip + " inRoot=" + sm.inRoot +
                  " " + JSON.stringify(sm.rect));
      console.log("          " + sm.chain);
    }
    report(inReader.kinds.length > 0, "the reader's marks carry a live clip (" + look + ")",
           inReader.kinds.map((k) => k.cls + " x" + k.count).join(", ") || "none");
    await shoot(look + "-reader");
    let shot = 0;
    for (const k of inReader.kinds) {
      if (!k.rect || shot >= 3) continue;
      await shootRect(look + "-" + k.cls.replace(/[^a-z0-9-]+/gi, "-"), k.rect);
      shot++;
    }

    await closeReader();
    await settle();
    // github#61 -- a rebuild resets data-look; re-apply it
    await setLook(look);
    report(await lookApplied() === look, "the shelf is painted in the " + look + " look");
    const onShelf = await E(PROBES.clipInUse);
    report(onShelf.kinds.some((k) => /vs-ribbon/.test(k.cls)), "the spine's ribbon carries a live clip (" + look + ")",
           onShelf.kinds.map((k) => k.cls + " x" + k.count).join(", ") || "none");
    await shoot(look + "-shelf");
    // github#61, design/0008 -- a ribbon hangs below the board
    if (look === "default") { await openReader(); }
  }

} finally {
  try { ob.child.kill(); } catch { }
  screen.release();
  if (!KEEP) rmSync(vault, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log("\nshots: " + OUT);
console.log("check-css-support: " + (results.length - failed.length) + "/" + results.length +
            (failed.length ? " -- FAILED: " + failed.map((r) => r.name).join(", ") : ""));
process.exit(failed.length ? 1 : 0);
