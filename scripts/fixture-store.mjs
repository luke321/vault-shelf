#!/usr/bin/env node
// github#8, github#13
/**
 * THE ONE ANSWER TO "WHICH FIXTURE IS THE CURRENT ONE". Six scripts reach into the shared
 * store and, until this file, five of them guessed: `.sort()` and take the last, `.sort()[0]`,
 * or `.find()`. That was harmless only while the store held exactly one directory per fixture,
 * which stopped being true the moment github#8 made a regeneration keep its siblings instead
 * of deleting them -- and then `demo-vault-5bd2a221` (396 notes, stale) sorted after
 * `demo-vault-2f973453` (424 notes, current), so the layout goldens were re-taken against the
 * vault nobody was measuring. Two scripts disagreeing about which fixture is current is worse
 * than either being wrong: the stamp would then vouch for a tree the suite never measured.
 *
 * The current one is the one whose `.stamp.json` was written last. `smoke.mjs` writes that
 * stamp when it regenerates, so "most recently stamped" is "what the last suite run used" --
 * no hashing here, nothing to drift out of step with the digest smoke computes.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/** The store beside the main repo, shared by every worktree of it. @param {string} root */
export function fixtureStore(root) {
  const g = spawnSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
  if (g.status !== 0 || !g.stdout.trim()) return join(root, ".fixtures");
  const common = g.stdout.trim();
  const abs = /^[A-Za-z]:[\\/]|^\//.test(common) ? common : join(root, common);
  return join(dirname(abs), ".fixtures");
}

/**
 * The directory holding the current build of one fixture, or "" when the store has none.
 * @param {string} root @param {string} name @returns {string}
 */
export function currentFixture(root, name) {
  const store = fixtureStore(root);
  if (!existsSync(store)) return "";
  /** @type {{ dir: string, at: number }[]} */
  const found = [];
  for (const d of readdirSync(store)) {
    if (!d.startsWith(name + "-")) continue;
    const dir = join(store, d);
    let at = 0;
    try {
      at = statSync(join(dir, ".stamp.json")).mtimeMs;
    } catch {
      /* A directory with no stamp was never finished by a generator; it loses to one that
       * has a stamp, and only wins against nothing at all. */
      try { at = statSync(dir).mtimeMs - 1e12; } catch { continue; }
    }
    found.push({ dir, at });
  }
  if (!found.length) return "";
  found.sort((a, b) => b.at - a.at);
  return found[0].dir;
}

/** What a fixture's stamp says, or null. @param {string} dir */
export function stampOf(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, ".stamp.json"), "utf8"));
  } catch {
    return null;
  }
}
