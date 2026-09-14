#!/usr/bin/env node

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync,
         renameSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

// github#25 -- the selftest points every root somewhere throwaway
const LOCK_HOME = process.env.VAULT_LOCKS_HOME || tmpdir();

// github#8, decisions/0011 -- one root for every sister project
const ROOT = join(LOCK_HOME, "obsidian-vault-locks");

// github#8 -- the per-repo roots this replaced
const LEGACY_ROOTS = [join(LOCK_HOME, "vault-graph-locks"), join(LOCK_HOME, "vault-shelf-locks")];

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
const BEAT_MS = Number(process.env.VAULT_LOCKS_BEAT_MS) || 30 * 1000;

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

// github#52 -- a record caught mid-handoff is not stolen
const PID_FLOOR_MS = 60 * 1000;

/** @param {number} pid @returns {boolean} */
function pidGone(pid) {
  try { process.kill(pid, 0); return false; }
  catch (e) { return e.code === "ESRCH"; }
}

// github#52 -- both spellings a holder names its own pid in
/** @param {unknown} owner @returns {number[]} */
function pidsNamedIn(owner) {
  /** @type {number[]} */
  const out = [];
  if (typeof owner !== "string") return out;
  for (const re of [/\[(\d{1,10})\]/g, /\bpid (\d{1,10})\b/g]) {
    for (let m; (m = re.exec(owner)); ) if (+m[1] > 0) out.push(+m[1]);
  }
  return out;
}

// github#52 -- which pids this record's liveness may be read from
/** @param {Record<string, any> | null} meta @returns {number[]} */
function judgedPids(meta) {
  if (!meta) return [];
  // github#52 -- a "cli" hold is never read for pids
  if (meta.holder !== undefined && meta.holder !== "process") return [];
  const own = typeof meta.pid === "number" && meta.pid > 0 ? [meta.pid] : [];
  // github#52 -- a foreign pid is a subprocess; the owner names the real one
  const named = pidsNamedIn(meta.owner);
  if (meta.holder === undefined && !named.length) return [];
  return [...new Set(own.concat(named))];
}

// github#25, github#52 -- only a hold naming a live process can be asked
/** @param {Record<string, any> | null} meta @returns {boolean} */
function holderGone(meta) {
  const pids = judgedPids(meta);
  if (!pids.length) return false;
  // github#52 -- a foreign record earns a floor; ours named itself at acquire
  if (meta && meta.holder === undefined && ageOf(meta) < PID_FLOOR_MS) return false;
  return pids.every(pidGone);
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

// github#37, github#43 -- an alias never blocks its own asker
/** @param {string} n @param {string} asker @returns {{ name: string, root: string, meta: Record<string, any> } | null} */
function aliasHold(n, asker) {
  for (const a of aliasesOf(n)) {
    const legacy = legacyHold(a);
    if (legacy && legacy.meta.owner !== asker) return { name: a, root: legacy.root, meta: legacy.meta };
    const meta = readMeta(a);
    if (meta && meta.owner !== asker && !holderGone(meta) && ageOf(meta) <= staleWindow(a)) {
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

    // github#37, github#43
    const alias = aliasHold(name, owner);
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

    // github#25, github#52
    if (holderGone(meta)) {
      say("BREAKING dead " + name + " lock (owner " + ((meta && meta.owner) || "unknown") +
          ", pid " + judgedPids(meta).join("/") + " is gone)");
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

// github#25 -- the beat is what keeps a hold alive and says when it is lost
/**
 * @param {string} name @param {string} owner
 * @param {((who: string) => void) | undefined} onLost
 * @returns {() => void}
 */
function beat(name, owner, onLost) {
  let lost = false;
  const t = setInterval(() => {
    const meta = readMeta(name);
    if (!meta || meta.owner !== owner) {
      clearInterval(t);
      if (lost) return;
      lost = true;
      if (onLost) onLost((meta && meta.owner) || "nobody -- the lock is gone");
      return;
    }
    try { writeMeta(name, { ...meta, at: Date.now() }); } catch { void 0; }
  }, BEAT_MS);
  t.unref();
  return () => clearInterval(t);
}

// github#25
/**
 * @param {string} name @param {string} owner @param {boolean} asCli
 * @param {((who: string) => void) | undefined} onLost @param {(line: string) => void} say
 * @returns {Hold}
 */
function hold(name, owner, asCli, onLost, say) {
  if (asCli) return { name: name, owner: owner, release: () => releaseNamed(name, owner, say) };
  const stop = beat(name, owner, onLost);
  return {
    name: name,
    owner: owner,
    release: () => { stop(); releaseNamed(name, owner, say); }
  };
}

// github#25 -- a CLI hold beats for as long as a run is under it
/**
 * @param {string} name
 * @param {{ onLost?: (who: string) => void, say?: (line: string) => void }} [opts]
 * @returns {Hold | null}
 */
export function adopt(name, opts = {}) {
  const meta = readMeta(name);
  if (!meta || !meta.owner) return null;
  // github#25 -- a hold already lost is not one to beat
  if (holderGone(meta) || ageOf(meta) > staleWindow(name)) return null;
  const say = opts.say || ((l) => console.log(l));
  const was = meta.holder, wasPid = meta.pid;
  writeMeta(name, { ...meta, at: Date.now(), pid: process.pid, holder: "process" });
  say("ADOPTED " + name + " -- beating the hold of " + meta.owner + " for this run");
  const stop = beat(name, meta.owner, opts.onLost);
  return {
    name: name,
    owner: meta.owner,
    // github#25 -- the caller owns the release; hand its shape back
    release: () => {
      stop();
      const now = readMeta(name);
      if (!now || now.owner !== meta.owner) return;
      const back = { ...now, at: Date.now(), holder: was, pid: wasPid };
      if (wasPid === undefined) delete back.pid;
      try { writeMeta(name, back); } catch { void 0; }
    }
  };
}

// github#25 -- a holder can ask whether the lock is still its own
/** @param {string} name @param {string} owner @returns {boolean} */
export function heldBy(name, owner) {
  const meta = readMeta(name);
  return !!meta && meta.owner === owner;
}

// github#25 -- a hold driven by hand is kept alive, not aged out
/** @param {string} name @param {string} owner @param {(line: string) => void} [say] @returns {number} */
export function refreshNamed(name, owner, say) {
  const line = say || ((l) => console.log(l));
  const meta = readMeta(name);
  if (!meta) { console.error("NOT HELD " + name + " -- nothing to refresh"); return 3; }
  if (meta.owner !== owner) {
    console.error("REFUSED -- " + name + " is held by " + meta.owner + ", not " + owner);
    return 3;
  }
  writeMeta(name, { ...meta, at: Date.now() });
  line("REFRESHED " + name + " by " + owner + " -- stale in " +
       Math.round(staleWindow(name) / 1000) + "s");
  return 0;
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
  console.error("usage: node scripts/lock.mjs <acquire|refresh|release|status> <name> --owner <id>");
  console.error("       node scripts/lock.mjs --selftest");
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
    // github#25, github#52 -- what the recorded pids are worth, said plainly
    const pids = judgedPids(meta);
    const live = !meta ? "" : !pids.length ? "  holder unverified"
      : "  holder pid " + pids.join("/") + (pids.every(pidGone) ? " DEAD" : " alive");
    const since = meta && meta.since ? "  held=" + Math.round((Date.now() - meta.since) / 1000) + "s" : "";
    console.log(n + "  owner=" + ((meta && meta.owner) || "unknown") +
                "  seen=" + Math.round(ageOf(meta) / 1000) + "s ago" + since + live +
                (ageOf(meta) > staleWindow(n) ? "  STALE"
                  : "  stale in " + Math.round((staleWindow(n) - ageOf(meta)) / 1000) + "s"));
  }
}

// github#25 -- the shared mutex, checked rather than hand-measured
/** @returns {Promise<number>} */
async function selftest() {
  let failed = 0;
  /** @param {string} what @param {boolean} ok @param {string} [detail] */
  const check = (what, ok, detail) => {
    console.log("  " + (ok ? "ok  " : "FAIL") + " " + what + (detail ? "   (" + detail + ")" : ""));
    if (!ok) failed++;
  };
  const MIN = 60 * 1000;
  const ago = (ms) => Date.now() - ms;
  /** @param {string} n @param {Record<string, any>} meta */
  const seed = (n, meta) => { mkdirSync(dirFor(n), { recursive: true }); writeMeta(n, meta); };
  /** @param {string} n */
  const clear = (n) => { try { rmSync(dirFor(n), { recursive: true, force: true }); } catch { void 0; } };
  /** @param {string} n @param {string} who */
  const ask = async (n, who) => {
    /** @type {string[]} */
    const lines = [];
    try {
      const h = await acquire(n, { owner: who, timeoutMs: 0, say: (l) => lines.push(l) });
      return { got: true, lines: lines, hold: h };
    } catch (e) {
      if (e.code !== "BUSY") throw e;
      return { got: false, lines: lines, hold: null };
    }
  };
  const cli = (...args) => spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args],
                                     { encoding: "utf8" });

  console.log("a live holder is never broken, whatever the clock says");
  seed("suite", { owner: "a run", at: ago(6 * MIN), since: ago(6 * MIN),
                  pid: process.pid, holder: "process" });
  let r = await ask("suite", "contender");
  check("a beating hold last seen 6 minutes ago keeps its name's window", !r.got,
        r.lines.join(" / "));
  clear("suite");
  seed("suite", { owner: "a run", at: ago(25 * MIN), since: ago(40 * MIN),
                  pid: process.pid, holder: "process" });
  r = await ask("suite", "contender");
  check("a live holder blocked for 25 minutes is still not broken", !r.got, r.lines.join(" / "));
  clear("suite");
  seed("suite", { owner: "a hook", at: ago(6 * MIN), since: ago(6 * MIN), holder: "cli" });
  r = await ask("suite", "contender");
  check("a CLI hold on suite seen 6 minutes ago is not stale", !r.got, r.lines.join(" / "));
  clear("suite");
  seed("suite", { owner: "the sister", at: ago(6 * MIN) });
  r = await ask("suite", "contender");
  check("a hold in the sister's shape -- owner and at alone -- is not stale either", !r.got,
        r.lines.join(" / "));
  clear("suite");

  console.log("the backstop and the pid check still break what nobody is holding");
  seed("suite", { owner: "a dead hook", at: ago(31 * MIN), since: ago(31 * MIN), holder: "cli" });
  r = await ask("suite", "contender");
  check("a CLI hold past its 30-minute window is broken",
        r.got && r.lines.some((l) => l.startsWith("BREAKING stale")), r.lines.join(" / "));
  if (r.hold) r.hold.release();
  clear("suite");
  seed("screen-left", { owner: "a dead run", at: Date.now(), since: Date.now(),
                        pid: 999999, holder: "process" });
  r = await ask("screen-left", "contender");
  check("a hold whose named process is gone is broken at once, at any age",
        r.got && r.lines.some((l) => l.startsWith("BREAKING dead")), r.lines.join(" / "));
  if (r.hold) r.hold.release();
  clear("screen-left");

  // github#52 -- the sister's record, judged by the pid its owner names
  console.log("a foreign record is read by the pid its owner names, not by its own");
  const DEAD = 999999;
  seed("screen-left", { owner: "smoke.mjs feature/x [" + process.pid + "]",
                        at: ago(2 * MIN), pid: DEAD });
  r = await ask("screen-left", "contender");
  check("a live sister run is NOT broken, though the pid it recorded is a dead subprocess",
        !r.got, r.lines.join(" / "));
  clear("screen-left");
  seed("screen-left", { owner: "smoke.mjs concept/x [" + DEAD + "]", at: ago(2 * MIN), pid: DEAD });
  r = await ask("screen-left", "contender");
  check("a sister run whose every named pid is gone is broken at once",
        r.got && r.lines.some((l) => l.startsWith("BREAKING dead")), r.lines.join(" / "));
  if (r.hold) r.hold.release();
  clear("screen-left");
  seed("screen-left", { owner: "record-demo pid " + DEAD, at: ago(2 * MIN), pid: DEAD });
  r = await ask("screen-left", "contender");
  check("the 'pid N' spelling is read too, not only '[N]'",
        r.got && r.lines.some((l) => l.startsWith("BREAKING dead")), r.lines.join(" / "));
  if (r.hold) r.hold.release();
  clear("screen-left");
  seed("screen-left", { owner: "release 2.6.0", at: ago(2 * MIN), pid: DEAD });
  r = await ask("screen-left", "contender");
  check("a foreign hold naming no pid of its own keeps its window",
        !r.got, r.lines.join(" / "));
  clear("screen-left");
  seed("screen-left", { owner: "smoke.mjs feature/x [" + DEAD + "]", at: Date.now(), pid: DEAD });
  r = await ask("screen-left", "contender");
  check("a foreign record younger than the 60s floor is not stolen mid-handoff",
        !r.got, r.lines.join(" / "));
  clear("screen-left");
  seed("screen-left", { owner: "a hand hold [" + DEAD + "]", at: ago(2 * MIN),
                        since: ago(2 * MIN), holder: "cli" });
  r = await ask("screen-left", "contender");
  check("a CLI hold is never read for pids, whatever its owner string says",
        !r.got, r.lines.join(" / "));
  clear("screen-left");
  // github#52 -- if the sister adds `holder` but keeps shelling out
  seed("screen-left", { owner: "smoke.mjs feature/x [" + process.pid + "]", at: ago(2 * MIN),
                        since: ago(2 * MIN), pid: DEAD, holder: "process" });
  r = await ask("screen-left", "contender");
  check("a record claiming holder:process is still judged on every pid it names",
        !r.got, r.lines.join(" / "));
  clear("screen-left");

  // github#43 -- row 7: the nesting an alias without this would deadlock
  console.log("an alias never blocks its own asker");
  seed("record", { owner: "smoke.mjs", at: Date.now(), since: Date.now(),
                   pid: process.pid, holder: "process" });
  r = await ask("screen-left", "smoke.mjs");
  check("a run already holding the aliased name takes the screen", r.got, r.lines.join(" / "));
  if (r.hold) r.hold.release();
  clear("record");
  clear("screen-left");
  seed("record", { owner: "somebody else", at: Date.now(), since: Date.now(),
                   pid: process.pid, holder: "process" });
  r = await ask("screen-left", "smoke.mjs");
  check("anyone else holding it still blocks", !r.got, r.lines.join(" / "));
  clear("record");
  clear("screen-left");

  console.log("status says how long a hold has left");
  seed("suite", { owner: "a hook", at: ago(6 * MIN), since: ago(6 * MIN), holder: "cli" });
  let out = (cli("status").stdout || "").trim();
  check("a CLI hold says holder unverified and when it goes stale",
        /holder unverified/.test(out) && /stale in 14\d\ds/.test(out), out);
  clear("suite");
  seed("suite", { owner: "a hook", at: ago(31 * MIN), since: ago(31 * MIN), holder: "cli" });
  out = (cli("status").stdout || "").trim();
  check("one past its window says STALE instead", /STALE/.test(out), out);
  clear("suite");

  console.log("a hold driven by hand can be kept alive");
  let acqScreen = cli("acquire", "screen-left", "--owner", "#12 plaques");
  check("the command line takes the screen", acqScreen.status === 0,
        (acqScreen.stdout || "").trim());
  const taken = readMeta("screen-left");
  writeMeta("screen-left", { ...taken, at: ago(19 * MIN) });
  const denied = cli("refresh", "screen-left", "--owner", "somebody else");
  check("refresh refuses an owner that does not match",
        denied.status === 3 && ageOf(readMeta("screen-left")) > 18 * MIN,
        (denied.stderr || "").trim());
  const kept = cli("refresh", "screen-left", "--owner", "#12 plaques");
  const fresh = readMeta("screen-left");
  check("refresh puts a 19-minute-old hold back to nothing",
        kept.status === 0 && ageOf(fresh) < 5000 && !!taken && fresh.since === taken.since,
        (kept.stdout || "").trim());
  cli("release", "screen-left", "--owner", "#12 plaques");
  check("refreshing a lock nobody holds answers 3",
        cli("refresh", "screen-left", "--owner", "#12 plaques").status === 3);
  clear("screen-left");

  console.log("a CLI hold beats while a run is under it");
  const acq = cli("acquire", "suite", "--owner", "pre-push develop");
  check("the command line takes the hold",
        acq.status === 0 && /ACQUIRED/.test(acq.stdout || ""), (acq.stdout || "").trim());
  const before = readMeta("suite");
  const adopted = adopt("suite", { say: () => void 0 });
  const mid = readMeta("suite");
  check("adoption keeps the caller's owner and its acquire time",
        !!adopted && adopted.owner === "pre-push develop" && !!before && !!mid &&
        mid.owner === before.owner && mid.since === before.since);
  check("adoption names this process as the holder",
        !!mid && mid.holder === "process" && mid.pid === process.pid, JSON.stringify(mid));
  await sleep(200);
  const beaten = readMeta("suite");
  check("the adopted hold is refreshed for as long as the run lasts",
        !!beaten && !!mid && !!before && beaten.at > mid.at && beaten.since === before.since,
        "at moved " + (beaten && mid ? beaten.at - mid.at : "?") + "ms");
  if (adopted) adopted.release();
  const after = readMeta("suite");
  check("release hands the caller its own shape back",
        !!after && !!before && after.holder === "cli" && after.pid === undefined &&
        after.owner === before.owner, JSON.stringify(after));
  check("release leaves the hold standing -- the caller owns it", existsSync(dirFor("suite")));
  const rel = cli("release", "suite", "--owner", "pre-push develop");
  check("the caller's own release still matches",
        rel.status === 0 && !existsSync(dirFor("suite")), (rel.stdout || "").trim());
  check("adopting a lock nobody holds answers null",
        adopt("suite", { say: () => void 0 }) === null);
  seed("suite", { owner: "a dead hook", at: ago(31 * MIN), since: ago(31 * MIN), holder: "cli" });
  check("adopting a hold already past its window answers null",
        adopt("suite", { say: () => void 0 }) === null);
  clear("suite");
  seed("suite", { owner: "a dead run", at: Date.now(), since: Date.now(),
                  pid: 999999, holder: "process" });
  check("adopting a hold whose process is gone answers null",
        adopt("suite", { say: () => void 0 }) === null);
  clear("suite");

  console.log("a holder notices the lock is no longer its own");
  let lostTo = "";
  await acquire("screen-right", { owner: "a run", timeoutMs: 0, say: () => void 0,
                                  onLost: (who) => { lostTo = who; } });
  check("heldBy is true while it is ours", heldBy("screen-right", "a run"));
  writeMeta("screen-right", { owner: "somebody else", at: Date.now(), since: Date.now(),
                              holder: "cli" });
  await sleep(200);
  check("the beat names who took it", lostTo === "somebody else", lostTo || "nothing reported");
  check("heldBy says so too", !heldBy("screen-right", "a run"));
  clear("screen-right");

  if (failed) { console.log("lock selftest: " + failed + " FAILED"); return 1; }
  console.log("lock selftest: all passed");
  return 0;
}

// github#25 -- never against the live mutex
/** @returns {number} */
function selftestInAThrowawayRoot() {
  const home = mkdtempSync(join(tmpdir(), "lock-selftest-"));
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--selftest-run"],
                      { stdio: "inherit",
                        env: { ...process.env, VAULT_LOCKS_HOME: home, VAULT_LOCKS_BEAT_MS: "50" } });
  try { rmSync(home, { recursive: true, force: true }); } catch { void 0; }
  return r.status === 0 ? 0 : 1;
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
  } else if (cmd === "refresh") {
    if (!name || !owner) usage(2);
    process.exit(refreshNamed(name, owner));
  } else if (cmd === "release") {
    if (!name || !owner) usage(2);
    process.exit(releaseNamed(name, owner));
  } else if (cmd === "status") {
    status();
  } else if (cmd === "--selftest") {
    process.exit(selftestInAThrowawayRoot());
  } else if (cmd === "--selftest-run") {
    process.exit(await selftest());
  } else {
    usage(2);
  }
}
