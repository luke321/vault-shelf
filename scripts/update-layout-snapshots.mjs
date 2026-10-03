#!/usr/bin/env node
// github#5 -- rewrite the golden geometry, deliberately

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { attach } from "./cdp.mjs";
// github#50
import { findChrome, harnessChromeArgs } from "./chrome.mjs";
// github#37, decisions/0012
import { takeLeftScreen } from "./screen.mjs";
import { ownerTag } from "./lock.mjs";
import { MEASURE, VIEWPORT, diffLayout } from "./layout-snapshots/measure.mjs";
import { LAYOUT_ARGS, LAYOUT_GENERATED, buildLayoutFixture } from "./layout-snapshots/fixture.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(HERE, "layout-snapshots");
const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
// github#37 -- a blocked run names the holder and gives up
const LOCK_TIMEOUT_MS = Number(arg("lock-timeout-ms", "2700000")) || 2700000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIXTURES = [{ name: "vault" }];

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on("error", rej);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); });
});

// github#37 -- one claim for every fixture's window
const screen = await takeLeftScreen(ownerTag("update-layout-snapshots.mjs"),
                                    { w: VIEWPORT.width, h: VIEWPORT.height,
                                      timeoutMs: LOCK_TIMEOUT_MS });

/** @param {string} htmlPath */
async function measure(htmlPath) {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "vs-snap-profile-"));
  const url = pathToFileURL(htmlPath).href;
  const chrome = spawn(findChrome(), harnessChromeArgs({
    port, profile, url, window: screen.args,
  }), { stdio: "ignore" });

  let page = null;
  try {
    const deadline = Date.now() + 30000;
    for (;;) {
      try { page = await attach(port, "vault-shelf.html"); break; }
      catch (e) { if (Date.now() > deadline) throw e; await sleep(300); }
    }
    await page.send("Emulation.setDeviceMetricsOverride",
                    { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false });
    const ready = Date.now() + 60000;
    for (;;) {
      const ok = await page.eval("!!(window.__vs && __vs.counts().spines > 0)").catch(() => false);
      if (ok) break;
      if (Date.now() > ready) throw new Error("the library never rendered");
      await sleep(300);
    }
    // github#35
    await page.eval(`(function(){
      var s = __vs.settings();
      var shelf = s.shelves.filter(function (x) { return x.classifier === "pick"; })[0];
      if (shelf && shelf.picks && shelf.picks.length) { shelf.picks = []; __vs.setFilters({}); }
    })(); void 0`);
    await page.eval(`window.dispatchEvent(new Event("resize")); void 0`);
    await sleep(400);
    return JSON.parse(await page.eval(`JSON.stringify(${MEASURE})`));
  } finally {
    try { if (page) await page.send("Browser.close"); } catch { }
    try { if (page) page.close(); } catch { }
    await sleep(200);
    try { chrome.kill(); } catch { }
    if (process.platform === "win32" && chrome.pid) {
      spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
    }
    rmSync(profile, { recursive: true, force: true });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
let bad = 0;
for (const fx of FIXTURES) {
  const fixture = buildLayoutFixture(ROOT);
  try {
    const now = await measure(fixture.html);
    const out = Object.assign({ vault: fx.name, fixtureArgs: LAYOUT_ARGS,
                               fixtureGenerated: LAYOUT_GENERATED, viewport: VIEWPORT }, now);
    const file = join(OUT_DIR, `${fx.name}.json`);
    if (CHECK) {
      if (!existsSync(file)) { console.error(`  FAIL ${fx.name}: no golden at ${file}`); bad++; continue; }
      const golden = JSON.parse(readFileSync(file, "utf8"));
      const problems = diffLayout(golden, out);
      if (JSON.stringify(golden.fixtureArgs) !== JSON.stringify(LAYOUT_ARGS) ||
          golden.fixtureGenerated !== LAYOUT_GENERATED) {
        problems.push("golden fixture inputs differ from the declared layout inputs");
      }
      if (problems.length) {
        bad++;
        console.error(`  FAIL ${fx.name}: ${problems.length} difference(s)`);
        for (const m of problems.slice(0, 12)) console.error("       " + m);
        if (problems.length > 12) console.error(`       ... and ${problems.length - 12} more`);
      } else {
        const spines = out.shelves.reduce((n, s) => n + s.books, 0);
        const rows = out.shelves.reduce((n, s) => n + s.rows, 0);
        console.log(`  ok  ${fx.name}: ${out.shelves.length} shelves, ${rows} rows, ${spines} spines, ` +
                    `room ${out.room}px`);
      }
    } else {
      writeFileSync(file, JSON.stringify(out, null, 1) + "\n", "utf8");
      const spines = out.shelves.reduce((n, s) => n + s.books, 0);
      const rows = out.shelves.reduce((n, s) => n + s.rows, 0);
      const plaques = out.shelves.reduce((n, s) => n + s.plaques.length, 0);
      console.log(`  wrote ${file} -- ${out.shelves.length} shelves, ${rows} rows, ${spines} spines, ` +
                  `${plaques} plaques, room ${out.room}px`);
    }
  } finally {
    fixture.cleanup();
  }
}

screen.release();

if (bad) {
  console.error(`\nlayout snapshots: ${bad} fixture(s) differ. If the packing changed on purpose, ` +
                `run node scripts/update-layout-snapshots.mjs and say why in the commit.`);
  process.exit(1);
}
console.log(CHECK ? "\nlayout snapshots: every fixture matches its golden"
                  : "\nlayout snapshots: written");
