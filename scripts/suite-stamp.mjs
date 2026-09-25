#!/usr/bin/env node
// github#5, decisions/0010

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync,
         rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { FIXTURE_ARGS, currentFixture, fixtureDigest } from "./fixture-store.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

export const FIXTURE_MAX_AGE_DAYS = 7;
export const FIXTURE_NAMES = ["vault"];
/* github#55, decisions/0010 -- how many green runs in a row a stamp is worth */
export const GREENS_REQUIRED = 2;
/* github#77, decisions/0010 -- which instrument earned the stamp */
export const STAMP_EPOCH = 2;

function git(args, cwd) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function commonDir(cwd = ROOT) {
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  if (!common) return null;
  return /^(?:[A-Za-z]:[\\/]|\/)/.test(common) ? common : join(cwd, common);
}

export function fixtureStore(cwd = ROOT) {
  const common = commonDir(cwd);
  return common ? join(dirname(common), ".fixtures") : join(cwd, ".fixtures");
}

export function stampDir(cwd = ROOT) {
  const common = commonDir(cwd);
  return common ? join(common, "suite-passed") : null;
}

export function treeOf(rev, cwd = ROOT) {
  return git(["rev-parse", "--verify", "--quiet", rev + "^{tree}"], cwd);
}

export function modifiedTracked(cwd = ROOT) {
  const s = git(["status", "--porcelain", "--untracked-files=no"], cwd);
  return s === null ? null : s.split("\n").filter(Boolean);
}

const todayDay = () => new Date().toISOString().slice(0, 10);
export const ageDays = (day) => Math.floor((Date.parse(todayDay()) - Date.parse(day)) / 86400000);

export function describeFixture(dir) {
  try {
    const st = JSON.parse(readFileSync(join(dir, ".stamp.json"), "utf8"));
    const pinned = Array.isArray(st.args) && st.args.indexOf("--end") >= 0;
    return { digest: st.digest, day: st.day, pinned };
  } catch {
    return null;
  }
}

export function currentFixtures(cwd = ROOT) {
  const out = [];
  for (const name of FIXTURE_NAMES) {
    /* github#13 -- the current build. Sorting by name vouched for a stale one. */
    const dir = currentFixture(cwd, name);
    const desc = dir ? describeFixture(dir) : null;
    out.push(desc ? { name, ...desc } : { name, digest: null, day: null, pinned: false });
  }
  return out;
}

function sameFixture(want, have) {
  return have && want.digest === have.digest && want.day === have.day;
}

export function lookup(rev = "HEAD", cwd = ROOT) {
  const tree = treeOf(rev, cwd);
  if (!tree) return { ok: false, why: `${rev} does not resolve to a tree` };
  const dir = stampDir(cwd);
  const file = dir ? join(dir, tree + ".json") : null;
  if (!file || !existsSync(file)) return { ok: false, tree, why: `no stamp for tree ${tree.slice(0, 7)}` };
  let stamp;
  try { stamp = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { return { ok: false, tree, why: `unreadable stamp for tree ${tree.slice(0, 7)}: ${e.message}` }; }
  // github#77 -- a run judged by another instrument is not this tree's pass
  const epoch = Number(stamp.epoch) || 0;
  if (epoch !== STAMP_EPOCH) {
    return { ok: false, tree, stamp,
             why: `tree ${tree.slice(0, 7)} was stamped under epoch ${epoch || "none"} and the suite ` +
                  `is at epoch ${STAMP_EPOCH}, so another instrument measured it` };
  }
  const have = currentFixtures(cwd);
  const stamped = Array.isArray(stamp.fixtures) ? stamp.fixtures : [];
  for (const name of FIXTURE_NAMES) {
    const want = stamped.find((f) => f && f.name === name);
    if (!want) {
      return { ok: false, tree, stamp,
               why: `the stamp names no ${name} run, so it is not a full suite pass` };
    }
    const now = have.find((f) => f.name === name);
    if (!sameFixture(want, now)) {
      return { ok: false, tree, stamp,
               why: `fixture ${want.name} is not the one that passed (stamped ${want.digest} of ${want.day}, ` +
                    `store has ${now && now.digest ? now.digest + " of " + now.day : "none"})` };
    }
    if (!want.pinned && ageDays(want.day) > FIXTURE_MAX_AGE_DAYS) {
      return { ok: false, tree, stamp,
               why: `fixture ${want.name} is ${ageDays(want.day)} days old and the next run would regenerate it` };
    }
  }
  // github#55 -- one green run is a sample, not a measurement
  const greens = Number(stamp.greens) || 0;
  if (greens < GREENS_REQUIRED) {
    return { ok: false, tree, stamp,
             why: `tree ${tree.slice(0, 7)} has ${greens} green run(s) of the ` +
                  `${GREENS_REQUIRED} in a row a stamp needs` };
  }
  return { ok: true, tree, stamp, file };
}

/**
 * github#55 -- a red full run ends the streak
 * @param {{ cwd?: string }} [opts]
 */
export function forget({ cwd = ROOT } = {}) {
  /* github#55 -- a dirty run measured what no commit names */
  const dirty = modifiedTracked(cwd);
  if (dirty === null) return { forgot: null, why: "not a git checkout" };
  if (dirty.length) {
    return { forgot: null, why: `the working tree differs from HEAD in ${dirty.length} tracked ` +
                                `file(s), so this run measured something no commit names` };
  }
  const tree = treeOf("HEAD", cwd);
  const dir = stampDir(cwd);
  if (!tree || !dir) return { forgot: null, why: "cannot resolve HEAD's tree" };
  const file = join(dir, tree + ".json");
  if (!existsSync(file)) return { forgot: null, tree, why: `no stamp for tree ${tree.slice(0, 7)}` };
  try { unlinkSync(file); } catch (e) { return { forgot: null, tree, why: e.message }; }
  return { forgot: file, tree };
}

export function record({ fixtures, checks, cwd = ROOT }) {
  const dirty = modifiedTracked(cwd);
  if (dirty === null) return { wrote: null, why: "not a git checkout" };
  if (dirty.length) {
    return { wrote: null, why: `the working tree differs from HEAD in ${dirty.length} tracked file(s), ` +
                               `so this run measured something no commit names` };
  }
  const tree = treeOf("HEAD", cwd);
  const dir = stampDir(cwd);
  if (!tree || !dir) return { wrote: null, why: "cannot resolve HEAD's tree" };
  const ran = FIXTURE_NAMES.map((name) => (fixtures || []).find((f) => f && f.name === name));
  for (let i = 0; i < FIXTURE_NAMES.length; i++) {
    const f = ran[i];
    if (!f) return { wrote: null, why: `${FIXTURE_NAMES[i]} did not run, so this run is not the full suite` };
    if (!f.digest || !f.day) return { wrote: null, why: `${f.name} has no digest or day to record` };
  }
  mkdirSync(dir, { recursive: true });
  const file = join(dir, tree + ".json");
  const ranFixtures = ran.map((f) => ({ name: f.name, digest: f.digest, day: f.day, pinned: !!f.pinned }));
  /* github#55 -- a regenerated fixture starts the count again
   * github#77 -- and so does a new instrument */
  let before = null;
  try { before = JSON.parse(readFileSync(file, "utf8")); } catch { before = null; }
  const sameRun = before && (Number(before.epoch) || 0) === STAMP_EPOCH && FIXTURE_NAMES.every((name) =>
    sameFixture(ranFixtures.find((f) => f.name === name),
                (before.fixtures || []).find((f) => f && f.name === name)));
  const greens = (sameRun ? Number(before.greens) || 0 : 0) + 1;
  const stamp = {
    tree,
    commit: git(["rev-parse", "HEAD"], cwd),
    at: new Date().toISOString(),
    first: sameRun && before.first ? before.first : new Date().toISOString(),
    greens,
    epoch: STAMP_EPOCH,
    checks,
    fixtures,
  };
  writeFileSync(file, JSON.stringify(stamp, null, 2) + "\n");
  return { wrote: file, tree, greens,
           short: greens < GREENS_REQUIRED ? GREENS_REQUIRED - greens : 0 };
}

export function describe(hit) {
  const s = hit.stamp;
  // github#55 -- the count is part of the claim, so it is printed with it
  return `tree ${hit.tree.slice(0, 7)} passed the invariant suite ${s.greens} times in a row, ` +
         `last at ${s.at} (${s.checks} checks, epoch ${Number(s.epoch) || 0}, ` +
         `commit ${String(s.commit || "?").slice(0, 7)}, ` +
         `fixtures ${s.fixtures.map((f) => f.name + "@" + f.day).join(" ")})`;
}

function selftest() {
  const base = mkdtempSync(join(tmpdir(), "vs-stamp-selftest-"));
  const repo = join(base, "repo");
  const sh = (args) => {
    const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
    if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + r.stderr);
    return r.stdout.trim();
  };
  const fails = [];
  const expect = (label, cond) => {
    console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
    if (!cond) fails.push(label);
  };
  try {
    mkdirSync(repo);
    sh(["init", "-q", "-b", "main"]);
    sh(["config", "user.email", "selftest@example.invalid"]);
    sh(["config", "user.name", "selftest"]);
    writeFileSync(join(repo, "a.txt"), "a\n");
    sh(["add", "a.txt"]);
    sh(["commit", "-q", "-m", "one"]);
    /* github#102 -- the current fixture is the one this checkout's generator digests to */
    const gen = join(repo, "scripts", "make-vault.mjs");
    mkdirSync(dirname(gen), { recursive: true });
    writeFileSync(gen, "// selftest generator\n");
    const ours = fixtureDigest(repo, FIXTURE_ARGS.vault);

    const store = fixtureStore(repo);
    const today = todayDay();
    const seed = (name, digest, day, pinned) => {
      for (const d of (existsSync(store) ? readdirSync(store) : [])) {
        if (d.startsWith(name + "-")) rmSync(join(store, d), { recursive: true, force: true });
      }
      const dir = join(store, `${name}-${digest}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, ".stamp.json"),
                    JSON.stringify({ digest, day, args: pinned ? ["--end", "2026-08-28"] : [] }));
    };
    seed("vault", ours, today, false);

    const green = () => record({ fixtures: currentFixtures(repo), checks: 1, cwd: repo });

    expect("no stamp yet -> miss", !lookup("HEAD", repo).ok);
    const wrote = green();
    expect("a clean tree records a run", !!wrote.wrote);
    /* github#55 -- ONE GREEN RUN IS A SAMPLE, NOT A MEASUREMENT. */
    expect("one green run counts 1", wrote.greens === 1 && wrote.short === GREENS_REQUIRED - 1);
    const oneOnly = lookup("HEAD", repo);
    expect("one green run still misses",
           !oneOnly.ok && /1 green run\(s\) of the 2/.test(oneOnly.why));
    const twice = green();
    expect("a second green run counts 2", twice.greens === GREENS_REQUIRED && twice.short === 0);
    expect("the same commit hits", lookup("HEAD", repo).ok);
    expect("the hit says how many runs it stands on",
           /passed the invariant suite 2 times in a row/.test(describe(lookup("HEAD", repo))));

    /* github#55 -- consecutive means consecutive */
    const lost = forget({ cwd: repo });
    expect("a red run forgets the streak", !!lost.forgot && !lookup("HEAD", repo).ok);
    expect("forgetting twice says there was nothing to forget",
           !forget({ cwd: repo }).forgot);
    /* github#55 -- a dirty red run may not clear a stamp */
    green(); green();
    writeFileSync(join(repo, "a.txt"), "dirty\n");
    const dirtyForget = forget({ cwd: repo });
    expect("a dirty tree refuses to forget",
           !dirtyForget.forgot && /differs from HEAD/.test(dirtyForget.why));
    expect("...and the stamp it would have cleared still hits", lookup("HEAD", repo).ok);
    writeFileSync(join(repo, "a.txt"), "a\n");
    forget({ cwd: repo });
    expect("one green after a red one is back to 1", green().greens === 1);
    expect("...and misses", !lookup("HEAD", repo).ok);
    expect("two greens after a red one hit again", green().greens === 2 && lookup("HEAD", repo).ok);

    sh(["commit", "-q", "--allow-empty", "-m", "same tree, new commit"]);
    expect("a new commit with the same tree hits", lookup("HEAD", repo).ok);
    sh(["checkout", "-q", "-b", "side", "HEAD~1"]);
    sh(["checkout", "-q", "main"]);
    sh(["merge", "-q", "--no-ff", "-m", "merge", "side"]);
    expect("a merge commit with the same tree hits", lookup("HEAD", repo).ok);

    writeFileSync(join(repo, "a.txt"), "changed\n");
    const dirty = record({ fixtures: currentFixtures(repo), checks: 1, cwd: repo });
    expect("a dirty tree refuses to record", !dirty.wrote && /differs from HEAD/.test(dirty.why));
    expect("a dirty tree still hits for HEAD's own tree", lookup("HEAD", repo).ok);
    sh(["commit", "-q", "-am", "changed"]);
    const miss = lookup("HEAD", repo);
    expect("a changed tree misses", !miss.ok && /no stamp/.test(miss.why));
    expect("the earlier tree still hits by revision", lookup("HEAD~1", repo).ok);

    /* decisions/0014 -- ONE FIXTURE, so "a partial run" is a run that named none. It is
     * still the case worth checking: the whole point of the stamp is that it vouches for a
     * measurement that actually happened. */
    const none = record({ fixtures: [], checks: 0, cwd: repo });
    expect("a run naming no fixture refuses to record",
           !none.wrote && /vault did not run/.test(none.why));

    seed("vault", ours, "2026-01-01", false);
    const moved = lookup("HEAD~1", repo);
    expect("a regenerated fixture misses", !moved.ok && /not the one that passed/.test(moved.why));
    seed("vault", ours, today, false);
    expect("restoring the fixture hits again", lookup("HEAD~1", repo).ok);

    /* github#102 -- a sibling's newer build is not this checkout's */
    const foreign = join(store, "vault-ffffffff");
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, ".stamp.json"),
                  JSON.stringify({ digest: "ffffffff", day: today, args: [] }));
    expect("a newer foreign fixture is not the current one",
           currentFixture(repo, "vault") === join(store, `vault-${ours}`));
    expect("...and the stamp still hits", lookup("HEAD~1", repo).ok);
    rmSync(foreign, { recursive: true, force: true });
    writeFileSync(gen, "// selftest generator, edited\n");
    expect("an edited generator has no current fixture", currentFixture(repo, "vault") === "");
    writeFileSync(gen, "// selftest generator\n");

    /* github#55 -- driven on the changed tree, so the stamps above stand */
    green(); green();
    expect("the changed tree hits once it has two", lookup("HEAD", repo).ok);
    seed("vault", ours, new Date(Date.now() - 86400000).toISOString().slice(0, 10), false);
    expect("a run against a regenerated fixture starts the count again", green().greens === 1);
    seed("vault", ours, today, false);

    const old = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
    seed("vault", ours, old, false);
    sh(["checkout", "-q", "HEAD~1"]);
    green(); green();
    const aged = lookup("HEAD", repo);
    expect("an aged unpinned fixture misses", !aged.ok && /would regenerate/.test(aged.why));
    seed("vault", ours, "2026-08-28", true);
    green(); green();
    expect("a pinned fixture never ages", lookup("HEAD", repo).ok);

    /* github#77 -- the instrument is part of the claim */
    const epochFile = lookup("HEAD", repo).file;
    const earned = JSON.parse(readFileSync(epochFile, "utf8"));
    expect("a fresh stamp names the epoch that earned it", Number(earned.epoch) === STAMP_EPOCH);
    delete earned.epoch;
    writeFileSync(epochFile, JSON.stringify(earned, null, 2) + "\n");
    const legacy = lookup("HEAD", repo);
    expect("a stamp from before the epoch existed misses",
           !legacy.ok && /stamped under epoch none/.test(legacy.why) &&
           legacy.why.includes(`epoch ${STAMP_EPOCH}`));
    earned.epoch = STAMP_EPOCH - 1;
    earned.greens = GREENS_REQUIRED + 3;
    writeFileSync(epochFile, JSON.stringify(earned, null, 2) + "\n");
    const older = lookup("HEAD", repo);
    expect("a long streak under an older epoch misses too",
           !older.ok && /another instrument measured it/.test(older.why));
    expect("a green run after an epoch change starts the count again", green().greens === 1);
    expect("...and misses until the streak is re-earned", !lookup("HEAD", repo).ok);
    expect("two under the current epoch hit again",
           green().greens === GREENS_REQUIRED && lookup("HEAD", repo).ok);

    const named = lookup("HEAD", repo);
    const stampFile = named.file;
    const partial = JSON.parse(readFileSync(stampFile, "utf8"));
    partial.fixtures = partial.fixtures.filter((f) => f.name !== "vault");
    writeFileSync(stampFile, JSON.stringify(partial, null, 2) + "\n");
    const short = lookup("HEAD", repo);
    expect("a stamp naming no fixture misses",
           !short.ok && /names no vault run/.test(short.why));

    const cli = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "check", "HEAD"],
                          { cwd: repo, encoding: "utf8" });
    expect("the CLI answers rather than exiting silently",
           /suite-stamp: /.test(cli.stdout) && (cli.status === 0 || cli.status === 1));

    // github#27
    const link = join(base, "via-junction");
    symlinkSync(HERE, link, "junction");
    let via;
    try {
      via = spawnSync(process.execPath, [join(link, "suite-stamp.mjs"), "check", "HEAD"],
                      { cwd: repo, encoding: "utf8" });
    } finally {
      try { rmdirSync(link); } catch { unlinkSync(link); }
    }
    expect("the CLI answers when invoked through a junction",
           /suite-stamp: /.test(via.stdout) && (via.status === 0 || via.status === 1));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  console.log(fails.length ? `\nselftest: ${fails.length} FAILED` : "\nselftest: all passed");
  return fails.length ? 1 : 0;
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  const norm = (p) => realpathSync(p).replace(/\\/g, "/").toLowerCase();
  try { return norm(process.argv[1]) === norm(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) process.exit(selftest());
  const cmd = argv[0] || "check";
  if (cmd === "check") {
    const hit = lookup(argv[1] || "HEAD");
    if (hit.ok) { console.log("suite-stamp: " + describe(hit)); process.exit(0); }
    console.log("suite-stamp: " + hit.why);
    process.exit(1);
  }
  if (cmd === "list") {
    const dir = stampDir();
    for (const f of (dir && existsSync(dir) ? readdirSync(dir).sort() : [])) {
      try {
        const s = JSON.parse(readFileSync(join(dir, f), "utf8"));
        const epoch = Number(s.epoch) || 0;
        console.log(`${s.tree.slice(0, 7)}  ${s.at}  commit ${String(s.commit || "?").slice(0, 7)}  ` +
                    `${s.checks} checks  ${Number(s.greens) || 0}/${GREENS_REQUIRED} green  ` +
                    `epoch ${epoch}${epoch === STAMP_EPOCH ? "" : ` (the suite is at ${STAMP_EPOCH})`}`);
      } catch { console.log(`${f}  (unreadable)`); }
    }
    process.exit(0);
  }
  console.error("usage: node scripts/suite-stamp.mjs [check [<rev>] | list | --selftest]");
  process.exit(2);
}
