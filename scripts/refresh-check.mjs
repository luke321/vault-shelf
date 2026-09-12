#!/usr/bin/env node
// github#5 -- does the library follow a changed vault, once

import { spawn, spawnSync } from "node:child_process";
import { currentFixture } from "./fixture-store.mjs";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
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
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
// github#37 -- a blocked run names the holder and gives up
const LOCK_TIMEOUT_MS = Number(arg("lock-timeout-ms", "2700000")) || 2700000;
const ONLY_WIRING = argv.includes("--wiring-only");
const BURST = Math.max(2, Number(arg("burst", "12")) || 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (ok, label, detail) => {
  results.push({ ok, label });
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label + (detail ? "\n          " + detail : ""));
};

/* ------------------------------------------------- the plugin's own wiring --
 * github#5 -- the bundle, with `obsidian` stubbed
 */

function stubObsidian() {
  class Events {
    constructor() { this.handlers = new Map(); }
    on(name, fn) {
      const list = this.handlers.get(name) || [];
      list.push(fn);
      this.handlers.set(name, list);
      return { name, fn, off: () => this.off(name, fn) };
    }
    off(name, fn) {
      this.handlers.set(name, (this.handlers.get(name) || []).filter((h) => h !== fn));
    }
    trigger(name, ...args) { for (const fn of this.handlers.get(name) || []) fn(...args); }
    count(name) { return (this.handlers.get(name) || []).length; }
  }
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; this.registered = []; }
    registerView() { }
    registerEvent(ref) { this.registered.push(ref); }
    addRibbonIcon() { return { addClass() { } }; }
    addCommand(cmd) { (this.commands = this.commands || []).push(cmd); }
    addSettingTab() { }
    loadData() { return Promise.resolve(null); }
    saveData() { return Promise.resolve(); }
    // github#5 -- Obsidian detaches registerEvent refs on unload
    unload() {
      for (const ref of this.registered) if (ref && ref.off) ref.off();
      this.registered = [];
      this.onunload();
    }
  }
  class ItemView {
    constructor(leaf) { this.leaf = leaf; }
    registerEvent() { }
  }
  class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
  class Setting {
    constructor() { }
    setName() { return this; } setDesc() { return this; }
    addText() { return this; } addToggle() { return this; }
  }
  class TFile { }
  class Component { }
  return {
    Events, Plugin, ItemView, PluginSettingTab, Setting, TFile, Component,
    addIcon() { }, Notice: class { }, MarkdownRenderer: { render() { return Promise.resolve(); } },
    debounce: (fn) => fn,
  };
}

async function wiringHalf() {
  const bundle = join(ROOT, "main.js");
  const built = spawnSync(process.execPath, [join(HERE, "build-plugin.mjs")], { encoding: "utf8" });
  if (built.status !== 0 || !existsSync(bundle)) {
    check(false, "the plugin bundle builds", (built.stderr || built.stdout || "").trim().split("\n").pop());
    return;
  }

  const src = readFileSync(join(ROOT, "plugin", "main.js"), "utf8");
  const wired = ["changed", "deleted", "rename"].filter((e) => new RegExp(`on\\("${e}"`).test(src));
  check(wired.length === 3, "the plugin listens for changed, deleted and rename",
        wired.length ? "wired: " + wired.join(", ") : "none of the three is wired");

  const stub = stubObsidian();
  const require_ = createRequire(import.meta.url);
  const Module = require_("node:module");
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "obsidian") return stub;
    return load.call(this, request, parent, isMain);
  };
  if (!globalThis.window) globalThis.window = globalThis;

  let plugin = null;
  try {
    const mod = require_(bundle);
    const PluginClass = mod.default || mod;
    const metadataCache = new stub.Events();
    const vault = new stub.Events();
    const app = {
      metadataCache, vault,
      workspace: Object.assign(new stub.Events(), { getLeavesOfType: () => [] }),
    };
    plugin = new PluginClass(app, { id: "vault-shelf", version: "0.0.0" });
    await plugin.onload();

    check(metadataCache.count("changed") === 1 && metadataCache.count("deleted") === 1 &&
          vault.count("rename") === 1,
          "and registers exactly one handler for each",
          `metadataCache changed ${metadataCache.count("changed")}, deleted ` +
          `${metadataCache.count("deleted")}, vault rename ${vault.count("rename")}`);

    const before = plugin.rebuilds;
    const t0 = Date.now();
    for (let i = 0; i < BURST; i++) metadataCache.trigger("changed", { path: `n${i}.md` });
    vault.trigger("rename", { path: "moved.md" }, "was.md");
    metadataCache.trigger("deleted", { path: "gone.md" });
    const spent = Date.now() - t0;
    const immediate = plugin.rebuilds - before;
    await sleep(1200);
    const total = plugin.rebuilds - before;
    check(spent < 50, `${BURST + 2} changes are fired inside 50ms`, `${spent}ms`);
    check(immediate === 0, "and none of them rebuilds on the spot", `${immediate} rebuilds during the burst`);
    check(total === 1, "the burst becomes exactly one rebuild", `${total} rebuild(s) after the burst settled`);

    const second = plugin.rebuilds;
    metadataCache.trigger("changed", { path: "later.md" });
    await sleep(1200);
    check(plugin.rebuilds - second === 1, "a later change rebuilds again, not never",
          `${plugin.rebuilds - second} rebuild(s)`);

    const settled = plugin.rebuilds;
    metadataCache.trigger("changed", { path: "unloading.md" });
    plugin.unload();
    metadataCache.trigger("changed", { path: "after-unload.md" });
    await sleep(1200);
    check(plugin.rebuilds === settled, "a change caught mid-flight by unload never rebuilds",
          `${plugin.rebuilds - settled} rebuild(s) after the plugin unloaded`);
  } catch (e) {
    check(false, "the plugin's refresh wiring runs headless", e.message);
  } finally {
    Module._load = load;
  }
}

/* ---------------------------------------------- the page, driven for real -- */

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on("error", rej);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); });
});

function storeVault(name) {
  /* github#13 -- one answer to which build is current, shared with the suite. */
  return currentFixture(ROOT, name);
}

async function pageHalf() {
  // github#37 -- claimed before the page is built
  const screen = await takeLeftScreen(ownerTag("refresh-check.mjs"),
                                      { w: 1180, h: 900, timeoutMs: LOCK_TIMEOUT_MS });
  let url = arg("url", "");
  let scratch = "";
  if (!url) {
    const vault = arg("vault", "") || storeVault("vault");
    if (!vault) throw new Error("no vault: pass --vault <dir> or --url <built page>");
    scratch = mkdtempSync(join(tmpdir(), "vs-refresh-build-"));
    const out = join(scratch, "vault-shelf.html");
    const b = spawnSync(process.execPath, [join(ROOT, "src", "build-shelf.mjs"), "--vault", vault, "--out", out],
                        { encoding: "utf8" });
    if (b.status !== 0) throw new Error("build-shelf.mjs failed:\n" + (b.stderr || ""));
    console.log((b.stdout || "").trimEnd());
    url = pathToFileURL(out).href;
  }

  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "vs-refresh-"));
  const chrome = spawn(findChrome(), harnessChromeArgs({
    port, profile, url, window: screen.args,
  }), { stdio: ["ignore", "ignore", "ignore"] });

  let p = null;
  try {
    for (let i = 0; i < 80 && !p; i++) {
      try { p = await attach(port, "vault-shelf.html"); } catch { await sleep(250); }
    }
    if (!p) throw new Error("could not attach to Chrome on port " + port);
    const j = async (expr) => JSON.parse(await p.eval(`JSON.stringify(${expr})`) ?? "null");
    const dl = Date.now() + 40000;
    for (;;) {
      if (await j("!!(window.__vs && __vs.counts().spines > 0)").catch(() => false)) break;
      if (Date.now() > dl) throw new Error("the library never rendered");
      await sleep(300);
    }

    const before = await j(`(function(){
      var view = __vs.views().filter(function (v) { return v.shelf.id === "years" && v.books.length; })[0]
              || __vs.views().filter(function (v) { return v.books.length; })[0];
      var book = view.books[0];
      var note = book.notes[0];
      __vs.openBook(book.id, note.id);
      return { shelf: view.shelf.id, book: book.id, key: book.key, note: note.id,
               date: note.date, folder: note.folder, people: note.people, tags: note.tags,
               inBook: book.notes.length, shelfNotes: view.noteCount,
               counts: __vs.counts(), reader: __vs.reader(),
               contents: document.querySelectorAll("#vs-contents li").length };
    })()`);
    check(!!before.reader, "a book is open before the vault changes",
          `${before.shelf}/${before.key}: ${before.inBook} notes, reader on ${before.reader && before.reader.note}`);

    const added = await j(`(function(){
      var data = __vs.data();
      var source = data.notes.filter(function (n) { return n.id === ${JSON.stringify(before.note)}; })[0];
      var probe = JSON.parse(JSON.stringify(source));
      probe.id = "refresh-probe.md";
      probe.path = "refresh-probe.md";
      probe.title = "Refresh Probe";
      probe.body = "Written after the library was drawn.";
      probe.excerpt = probe.body;
      data.notes.push(probe);
      window.vsHandle.refresh(data);
      var view = __vs.views().filter(function (v) { return v.shelf.id === ${JSON.stringify(before.shelf)}; })[0];
      var book = view.books.filter(function (b) { return b.id === ${JSON.stringify(before.book)}; })[0];
      return { book: !!book, inBook: book ? book.notes.length : 0,
               holds: book ? book.notes.some(function (n) { return n.id === "refresh-probe.md"; }) : false,
               shelfNotes: view.noteCount, counts: __vs.counts(), reader: __vs.reader(),
               contents: document.querySelectorAll("#vs-contents li").length,
               named: [].slice.call(document.querySelectorAll("#vs-contents li"))
                        .filter(function (li) { return li.textContent.indexOf("Refresh Probe") >= 0; }).length };
    })()`);

    check(added.counts.notes === before.counts.notes + 1, "the library counts one more note",
          `${before.counts.notes} -> ${added.counts.notes}`);
    check(added.book && added.inBook === before.inBook + 1 && added.holds,
          "the open book holds it, and is one thicker",
          `${before.inBook} -> ${added.inBook} notes in ${before.key}`);
    check(added.shelfNotes === before.shelfNotes + 1, "the shelf's note count moves by exactly one",
          `${before.shelfNotes} -> ${added.shelfNotes}`);
    check(added.contents === before.contents + 1 && added.named === 1,
          "and the open book's contents gained one entry, naming it",
          `${before.contents} -> ${added.contents} entries, ${added.named} named Refresh Probe`);
    check(!!added.reader && added.reader.book === before.reader.book &&
          added.reader.note === before.reader.note,
          "the reading place survived the rebuild",
          added.reader ? `${added.reader.book} at ${added.reader.note}` : "the reader closed");

    const removed = await j(`(function(){
      var data = __vs.data();
      data.notes = data.notes.filter(function (n) { return n.id !== "refresh-probe.md"; });
      window.vsHandle.refresh(data);
      var view = __vs.views().filter(function (v) { return v.shelf.id === ${JSON.stringify(before.shelf)}; })[0];
      var book = view.books.filter(function (b) { return b.id === ${JSON.stringify(before.book)}; })[0];
      return { inBook: book ? book.notes.length : 0, shelfNotes: view.noteCount,
               counts: __vs.counts(), reader: __vs.reader(),
               contents: document.querySelectorAll("#vs-contents li").length };
    })()`);
    check(removed.counts.notes === before.counts.notes &&
          removed.inBook === before.inBook && removed.shelfNotes === before.shelfNotes &&
          removed.contents === before.contents,
          "taking it away again puts every number back",
          `${removed.counts.notes} notes, ${removed.inBook} in the book, ${removed.contents} entries`);
    check(!!removed.reader && removed.reader.note === before.reader.note,
          "and the place is still where it was", removed.reader ? removed.reader.note : "the reader closed");

    const errors = p.errors;
    check(errors.length === 0, "the page said nothing on the console through all of it",
          errors.length ? String(errors[0].text).split("\n")[0] : "0 errors");
  } finally {
    try { if (p) await p.send("Browser.close"); } catch { }
    try { if (p) p.close(); } catch { }
    await sleep(250);
    try { chrome.kill(); } catch { }
    if (process.platform === "win32" && chrome.pid) {
      spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
    }
    rmSync(profile, { recursive: true, force: true });
    if (scratch) rmSync(scratch, { recursive: true, force: true });
    screen.release();
  }
}

console.log("\n=== the plugin's wiring, headless ===");
await wiringHalf();
if (!ONLY_WIRING) {
  console.log("\n=== the page, driven in a browser ===");
  await pageHalf();
}

const bad = results.filter((r) => !r.ok);
console.log(`\nrefresh-check: ${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
