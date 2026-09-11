#!/usr/bin/env node

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync,
         renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

// github#8, decisions/0011 -- one root for every sister project
const ROOT = join(tmpdir(), "obsidian-vault-locks");

// github#8 -- the per-repo roots this replaced
const LEGACY_ROOTS = [join(tmpdir(), "vault-graph-locks"), join(tmpdir(), "vault-shelf-locks")];

// github#37, decisions/0012 -- a lock names the resource, not the job
const SCREENS = ["screen-left", "screen-right", "screen-primary"];
const NAMES = ["suite", ...SCREENS, "record"];

// github#37 -- transitional, deleted with the sister's (vault-graph#87)
const aliasesOf = (n) => (n === "record" ? SCREENS : SCREENS.includes(n) ? ["record"] : []);

const STALE_MS = {
  record: 20 * 60 * 1000, suite: 30 * 60 * 1000,
  "screen-left": 20 * 60 * 1000, "screen-right": 20 * 60 * 1000, "screen-primary": 20 * 60 * 1000
};
const DEFAULT_STALE = 20 * 60 * 1000;
const DEFAULT_TIMEOUT = 45 * 60 * 1000;
const POLL_MS = 5000;
// github#25 -- a hold is refreshed far inside the shortest stale window
const BEAT_MS = 30 * 1000;

// github#37 -- a holder names itself, so a blocked run can say who
/** @param {string} what @returns {string} */
export function ownerTag(what) {
  const repo = dirname(dirname(fileURLToPath(import.meta.url)));
  const b = spawnSync("git", ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  const where = b.status === 0 && b.stdout.trim() ? b.stdout.trim() : "?";
  return what + " " + where + " pid " + process.pid;
}

const dirFor = (n) => join(ROOT, n + ".lock");
const metaFor = (n) => join(dirFor(n), "owner.json");
const staleWindow = (n) => STALE_MS[n] || DEFAULT_STALE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} n @returns {Record<string, any> | null} */
function readMeta(n) {
  try { return JSON.parse(readFileSync(metaFor(n), "utf8")); } catch { return null; }
}

// github#25 -- the sister parses this file with a bare JSON.parse
/** @param {string} n @param {Record<string, any>} meta */
function writeMeta(n, meta) {
  const tmp = metaFor(n) + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify(meta, null, 1));
  try { renameSync(tmp, metaFor(n)); }
  catch (e) { try { rmSync(tmp, { force: true }); } catch { void 0; } throw e; }
}

/** @param {Record<string, any> | null} meta @returns {number} */
function ageOf(meta) {
  return meta && meta.at ? Date.now() - meta.at : Infinity;
}

// github#25 -- only a hold naming a live process can be asked
/** @param {Record<string, any> | null} meta @returns {boolean} */
function holderGone(meta) {
  if (!meta || meta.holder !== "process" || !meta.pid) return false;
  try { process.kill(meta.pid, 0); return false; }
  catch (e) { return e.code === "ESRCH"; }
}

/** @param {string} n @returns {{ root: string, meta: Record<string, any> } | null} */
function legacyHold(n) {
  for (const root of LEGACY_ROOTS) {
    const meta = (() => {
      try { return JSON.parse(readFileSync(join(root, n + ".lock", "owner.json"), "utf8")); }
      catch { return null; }
    })();
    if (meta && meta.at && Date.now() - meta.at <= staleWindow(n)) return { root, meta };
  }
  return null;
}

// github#37
/** @param {string} n @returns {{ name: string, root: string, meta: Record<string, any> } | null} */
function aliasHold(n) {
  for (const a of aliasesOf(n)) {
    const legacy = legacyHold(a);
    if (legacy) return { name: a, root: legacy.root, meta: legacy.meta };
    const meta = readMeta(a);
    if (meta && !holderGone(meta) && ageOf(meta) <= staleWindow(a)) {
      return { name: a, root: ROOT, meta: meta };
    }
  }
  return null;
}

/** @typedef {{ name: string, owner: string, release: () => void }} Hold */

/** @typedef {{ owner: string, timeoutMs?: number, onLost?: (who: string) => void, say?: (line: string) => void, holder?: "process" | "cli" }} Ask */

// github#25, decisions/0012 -- the holder is this process and says so
/**
 * @param {string} name
 * @param {Ask} opts
 * @returns {Promise<Hold>}
 */
export async function acquire(name, opts) {
  const owner = opts.owner;
  const asCli = opts.holder === "cli";
  const say = opts.say || ((l) => console.log(l));
  const timeoutMs = opts.timeoutMs === undefined ? DEFAULT_TIMEOUT : opts.timeoutMs;
  if (!name || !owner) throw new Error("lock: a name and an --owner are both required");
  mkdirSync(ROOT, { recursive: true });
  const dir = dirFor(name);
  const deadline = Date.now() + timeoutMs;
  let announced = false;

  const giveUp = () => {
    const e = new Error("BUSY " + name + " -- gave up after " + Math.round(timeoutMs / 1000) + "s");
    // @ts-expect-error -- a tag for the caller, not a typed field
    e.code = "BUSY";
    return e;
  };

  for (;;) {
    // github#8 -- checked before the directory is claimed, not after
    const legacy = legacyHold(name);
    if (legacy) {
      if (!announced) {
        say("WAITING for " + name + " -- held in a legacy root (" + legacy.root + ") by " +
            (legacy.meta.owner || "unknown") + " for " +
            Math.round((Date.now() - legacy.meta.at) / 1000) + "s");
        announced = true;
      }
      if (Date.now() > deadline) throw giveUp();
      await sleep(POLL_MS);
      continue;
    }

    // github#37
    const alias = aliasHold(name);
    if (alias) {
      if (!announced) {
        say("WAITING for " + name + " -- the same screen is held as " + alias.name + " by " +
            (alias.meta.owner || "unknown") + " for " +
            Math.round((Date.now() - alias.meta.at) / 1000) + "s" +
            (alias.root === ROOT ? "" : " (legacy root " + alias.root + ")"));
        announced = true;
      }
      if (Date.now() > deadline) throw giveUp();
      await sleep(POLL_MS);
      continue;
    }

    let claimed = false;
    try {
      mkdirSync(dir);
      claimed = true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    if (claimed) {
      const now = Date.now();
      // github#25 -- a CLI hold outlives this process
      writeMeta(name, asCli
        ? { owner: owner, at: now, since: now, holder: "cli" }
        : { owner: owner, at: now, since: now, pid: process.pid, holder: "process" });
      say("ACQUIRED " + name + " by " + owner);
      return hold(name, owner, asCli, opts.onLost, say);
    }

    const meta = readMeta(name);
    const age = ageOf(meta);

    if (meta && meta.owner === owner) {
      say("ALREADY HELD by " + owner + " -- not re-entrant, treat as held");
      return hold(name, owner, asCli, opts.onLost, say);
    }

    // github#25
    if (holderGone(meta)) {
      say("BREAKING dead " + name + " lock (owner " + ((meta && meta.owner) || "unknown") +
          ", pid " + (meta && meta.pid) + " is gone)");
      try { rmSync(dir, { recursive: true, force: true }); } catch { void 0; }
      continue;
    }

    if (age > staleWindow(name)) {
      say("BREAKING stale " + name + " lock (age " + Math.round(age / 1000) + "s, owner " +
          ((meta && meta.owner) || "unknown") + ")");
      try { rmSync(dir, { recursive: true, force: true }); } catch { void 0; }
      continue;
    }

    if (!announced) {
      say("WAITING for " + name + " -- held by " + ((meta && meta.owner) || "unknown") +
          " for " + Math.round(age / 1000) + "s");
      announced = true;
    }

    if (Date.now() > deadline) throw giveUp();
    await sleep(POLL_MS);
  }
}

// github#25
/**
 * @param {string} name @param {string} owner @param {boolean} asCli
 * @param {((who: string) => void) | undefined} onLost @param {(line: string) => void} say
 * @returns {Hold}
 */
function hold(name, owner, asCli, onLost, say) {
  let lost = false;
  if (asCli) return { name: name, owner: owner, release: () => releaseNamed(name, owner, say) };
  const beat = setInterval(() => {
    const meta = readMeta(name);
    if (!meta || meta.owner !== owner) {
      clearInterval(beat);
      if (lost) return;
      lost = true;
      if (onLost) onLost((meta && meta.owner) || "nobody -- the lock is gone");
      return;
    }
    try { writeMeta(name, { ...meta, at: Date.now() }); } catch { void 0; }
  }, BEAT_MS);
  beat.unref();
  return {
    name: name,
    owner: owner,
    release: () => {
      clearInterval(beat);
      releaseNamed(name, owner, say);
    }
  };
}

// github#25 -- a holder can ask whether the lock is still its own
/** @param {string} name @param {string} owner @returns {boolean} */
export function heldBy(name, owner) {
  const meta = readMeta(name);
  return !!meta && meta.owner === owner;
}

/** @param {string} name @param {string} owner @param {(line: string) => void} [say] */
export function releaseNamed(name, owner, say) {
  const line = say || ((l) => console.log(l));
  if (!existsSync(dirFor(name))) {
    line("NOT HELD " + name + " -- nothing to release");
    return 0;
  }
  const meta = readMeta(name);
  if (meta && meta.owner && meta.owner !== owner) {
    console.error("REFUSED -- " + name + " is held by " + meta.owner + ", not " + owner);
    return 3;
  }
  rmSync(dirFor(name), { recursive: true, force: true });
  line("RELEASED " + name + " by " + owner);
  return 0;
}

function usage(code) {
  console.error("usage: node scripts/lock.mjs <acquire|release|status> <name> --owner <id>");
  console.error("  names: " + NAMES.join(" | ") + " (record is legacy, github#37)");
  process.exit(code);
}

function status() {
  for (const n of NAMES) {
    const legacy = legacyHold(n);
    if (legacy) {
      console.log(n + "  owner=" + (legacy.meta.owner || "unknown") + "  age=" +
                  Math.round((Date.now() - legacy.meta.at) / 1000) + "s  (legacy root " +
                  legacy.root + ")");
    }
  }
  if (!existsSync(ROOT)) { console.log("no locks held (" + ROOT + ")"); return; }
  const held = readdirSync(ROOT).filter((f) => f.endsWith(".lock"));
  if (!held.length) { console.log("no locks held (" + ROOT + ")"); return; }
  for (const h of held) {
    const n = h.replace(/\.lock$/, "");
    const meta = readMeta(n);
    // github#25 -- what the recorded pid is worth, said plainly
    const live = !meta ? "" : meta.holder === "process"
      ? (holderGone(meta) ? "  holder pid " + meta.pid + " DEAD" : "  holder pid " + meta.pid + " alive")
      : "  holder unverified";
    const since = meta && meta.since ? "  held=" + Math.round((Date.now() - meta.since) / 1000) + "s" : "";
    console.log(n + "  owner=" + ((meta && meta.owner) || "unknown") +
                "  seen=" + Math.round(ageOf(meta) / 1000) + "s ago" + since + live +
                (ageOf(meta) > staleWindow(n) ? "  STALE" : ""));
  }
}

const RUN_DIRECTLY = (() => {
  const a = (process.argv[1] || "").split("\\").join("/").toLowerCase();
  return a.endsWith("/lock.mjs");
})();

if (RUN_DIRECTLY) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const name = argv[1];
  const flag = (n, d) => {
    const i = argv.indexOf("--" + n);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
  };
  const owner = flag("owner", "");
  const timeoutMs = Number(flag("timeout-ms", DEFAULT_TIMEOUT));
  if (cmd === "acquire") {
    if (!name || !owner) usage(2);
    try {
      await acquire(name, { owner: owner, timeoutMs: timeoutMs, holder: "cli" });
      process.exit(0);
    } catch (e) {
      if (e.code === "BUSY") { console.log(e.message); process.exit(1); }
      throw e;
    }
  } else if (cmd === "release") {
    if (!name || !owner) usage(2);
    process.exit(releaseNamed(name, owner));
  } else if (cmd === "status") {
    status();
  } else {
    usage(2);
  }
}
