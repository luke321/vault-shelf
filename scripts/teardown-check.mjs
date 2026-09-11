#!/usr/bin/env node
// github#5 -- mount, unmount, and count what is left behind

import { spawn, spawnSync } from "node:child_process";
import { currentFixture } from "./fixture-store.mjs";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { attach } from "./cdp.mjs";
// github#37, decisions/0012
import { takeLeftScreen } from "./screen.mjs";
import { ownerTag } from "./lock.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
// github#37 -- a blocked run names the holder and gives up
const LOCK_TIMEOUT_MS = Number(arg("lock-timeout-ms", "2700000")) || 2700000;
const CYCLES = Math.max(2, Number(arg("cycles", "20")) || 20);
const MARKUP = readFileSync(join(ROOT, "src", "page.html"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const named = arg("chrome", "");
  if (named) return named;
  const guesses = [
    process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
  ];
  for (const g of guesses) if (g && existsSync(g)) return g;
  throw new Error("Chrome not found; pass --chrome <path>");
}

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on("error", rej);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); });
});

// github#5 -- the suite's shared fixture store
export function storeVault(name) {
  /* github#13 -- one answer to which build is current, shared with the suite. */
  return currentFixture(ROOT, name);
}

/** @returns {{ url: string, scratch: string }} */
function buildPage() {
  const given = arg("url", "");
  if (given) return { url: given, scratch: "" };
  const vault = arg("vault", "") || storeVault("vault");
  if (!vault) {
    throw new Error("no vault: pass --vault <dir> or --url <built page>, or run the suite once " +
                    "so the shared fixture store exists");
  }
  const scratch = mkdtempSync(join(tmpdir(), "vs-teardown-build-"));
  const out = join(scratch, "vault-shelf.html");
  const b = spawnSync(process.execPath, [join(ROOT, "src", "build-shelf.mjs"), "--vault", vault, "--out", out],
                      { encoding: "utf8" });
  if (b.status !== 0) throw new Error("build-shelf.mjs failed:\n" + (b.stderr || ""));
  console.log((b.stdout || "").trimEnd());
  return { url: pathToFileURL(out).href, scratch };
}

// github#37 -- claimed before the page is built
const screen = await takeLeftScreen(ownerTag("teardown-check.mjs"),
                                    { w: 1180, h: 900, timeoutMs: LOCK_TIMEOUT_MS });
const { url, scratch } = buildPage();
const PORT = await freePort();
const profile = mkdtempSync(join(tmpdir(), "vs-teardown-"));
const chrome = spawn(findChrome(), [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  "--disable-component-update", "--disable-sync", "--no-service-autorun",
  "--metrics-recording-only", "--no-pings", "--mute-audio", "--disable-breakpad",
  "--disable-crash-reporter",
  "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  ...screen.args, `--app=${url}`,
], { stdio: ["ignore", "ignore", "ignore"] });

let p = null;
for (let i = 0; i < 80 && !p; i++) {
  try { p = await attach(PORT, "vault-shelf.html"); } catch { await sleep(250); }
}
if (!p) { chrome.kill(); throw new Error("could not attach to Chrome on port " + PORT); }

const j = async (expr) => JSON.parse(await p.eval(`JSON.stringify((function(){ return (${expr}); })())`) ?? "null");
const cli = async (expr) => {
  const r = await p.send("Runtime.evaluate", { expression: expr, returnByValue: true, includeCommandLineAPI: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
};

const ready = async (ms) => {
  const dl = Date.now() + ms;
  for (;;) {
    if (await j("!!(window.__vs && __vs.counts().spines > 0)").catch(() => false)) return true;
    if (Date.now() > dl) return false;
    await sleep(200);
  }
};

// github#5 -- getEventListeners is the devtools API, not page script
const listeners = () => cli(`(function(){
  var count = function (target) {
    var all = getEventListeners(target), n = 0;
    for (var k in all) n += all[k].length;
    return n;
  };
  return JSON.stringify({ doc: count(document), win: count(window) });
})()`).then((s) => JSON.parse(s));

const counters = async () => {
  await p.send("HeapProfiler.collectGarbage").catch(() => {});
  await sleep(200);
  await p.send("HeapProfiler.collectGarbage").catch(() => {});
  const heap = await p.send("Runtime.getHeapUsage");
  const dom = await p.send("Memory.getDOMCounters");
  const ls = await listeners();
  const page = await j(`(function(){
    return { roots: document.querySelectorAll(".vault-shelf").length,
             debug: typeof window.__vs,
             timers: window.__vsTimers ? window.__vsTimers.size : -1,
             spines: window.__vs ? __vs.counts().spines : 0 };
  })()`);
  return { heapMB: +(heap.usedSize / 1048576).toFixed(1), nodes: dom.nodes,
           listeners: dom.jsEventListeners, doc: ls.doc, win: ls.win,
           roots: page.roots, debug: page.debug, timers: page.timers, spines: page.spines };
};

const row = (label, c) =>
  `${label.padEnd(9)} heap ${String(c.heapMB).padStart(6)} MB  nodes ${String(c.nodes).padStart(5)}  ` +
  `listeners ${String(c.listeners).padStart(4)}  document ${String(c.doc).padStart(3)}  ` +
  `window ${String(c.win).padStart(3)}  roots ${c.roots}  spines ${String(c.spines).padStart(4)}  ` +
  `timers ${c.timers}  __vs ${c.debug}`;

const problems = [];
try {
  if (!(await ready(60000))) throw new Error("the library never rendered (" + (p.firstError() || "no page error") + ")");
  await sleep(500);

  // github#5 -- a timer nobody cleared is the leak this catches
  await p.eval(`(function(){
    window.__vsTimers = new Set();
    var st = window.setTimeout, ct = window.clearTimeout;
    window.setTimeout = function (fn, ms) {
      var id = st(function () { window.__vsTimers.delete(id); if (fn) fn(); }, ms);
      window.__vsTimers.add(id);
      return id;
    };
    window.clearTimeout = function (id) { window.__vsTimers.delete(id); return ct(id); };
  })(); void 0`);

  const load = await counters();
  console.log(row("load", load));
  if (load.roots !== 1) problems.push(`the page loaded with ${load.roots} .vault-shelf roots, expected 1`);

  const after = [];
  for (let c = 1; c <= CYCLES; c++) {
    // github#5 -- a pending resize repack, torn down before it can fire
    const torn = await j(`(function(){
      window.dispatchEvent(new Event("resize"));
      var pending = window.__vsTimers.size;
      window.vsHandle.destroy();
      var root = document.getElementById("vs-app");
      var empty = root.childNodes.length;
      root.remove();
      return { pending: pending, empty: empty, roots: document.querySelectorAll(".vault-shelf").length,
               debug: typeof window.__vs, timers: window.__vsTimers.size };
    })()`);
    if (!torn.pending) problems.push(`cycle ${c}: no pending repack timer to tear down -- the check is not testing it`);
    if (torn.empty !== 0) problems.push(`cycle ${c}: destroy() left ${torn.empty} node(s) inside the root`);
    if (torn.roots !== 0) problems.push(`cycle ${c}: ${torn.roots} .vault-shelf node(s) still in the document`);
    if (torn.debug !== "undefined") problems.push(`cycle ${c}: window.__vs survived destroy() as ${torn.debug}`);
    if (torn.timers !== 0) problems.push(`cycle ${c}: ${torn.timers} timer(s) still alive after destroy()`);

    await p.eval(`(function(){
      var t = document.createElement("template");
      t.innerHTML = ${JSON.stringify(MARKUP)};
      var fresh = t.content.firstElementChild;
      document.body.insertBefore(fresh, document.body.firstChild);
      window.vsHandle = mountVaultShelf(fresh, window.VAULT_DATA, {
        core: window.VaultShelfCore,
        settings: null,
        onSettings: function () { }
      });
    })(); void 0`);
    if (!(await ready(30000))) problems.push(`cycle ${c}: the remount never rendered`);
    const now = await counters();
    after.push(now);
    if (c === 1 || c === CYCLES || c % 5 === 0) console.log(row("cycle " + c, now));
  }

  const first = after[0], last = after[after.length - 1];
  const per = (a, b) => (b - a) / (after.length - 1);
  if (last.nodes > first.nodes) {
    problems.push(`DOM nodes grew ${first.nodes} -> ${last.nodes} (${per(first.nodes, last.nodes).toFixed(1)}/cycle)`);
  }
  if (last.listeners > first.listeners) {
    problems.push(`JS listeners grew ${first.listeners} -> ${last.listeners} (${per(first.listeners, last.listeners).toFixed(1)}/cycle)`);
  }
  if (last.doc !== load.doc) problems.push(`document listeners ${load.doc} -> ${last.doc}`);
  if (last.win !== load.win) problems.push(`window listeners ${load.win} -> ${last.win}`);
  const HEAP_MB_PER_CYCLE = 1.5;
  if (per(first.heapMB, last.heapMB) > HEAP_MB_PER_CYCLE) {
    problems.push(`post-GC heap grew ${first.heapMB} -> ${last.heapMB} MB ` +
                  `(${per(first.heapMB, last.heapMB).toFixed(2)} MB/cycle, bound ${HEAP_MB_PER_CYCLE})`);
  }
  for (const e of p.errors) problems.push("console: " + String(e.text).split("\n")[0]);
} catch (e) {
  problems.push(e.message);
} finally {
  try { await p?.send("Browser.close"); } catch { }
  try { p?.close(); } catch { }
  await sleep(300);
  try { chrome.kill(); } catch { }
  if (process.platform === "win32" && chrome.pid) {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  }
  rmSync(profile, { recursive: true, force: true });
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}

if (!problems.length) {
  console.log(`\nteardown-check: clean -- ${CYCLES} destroy+mount cycles, no listener, node, timer ` +
              `or root left behind`);
  process.exit(0);
}
console.error(`\nteardown-check: ${problems.length} problem(s)`);
for (const m of problems) console.error("  FAIL " + m);
process.exit(1);
