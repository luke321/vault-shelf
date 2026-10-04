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
 * github#102 -- the current one is the one this checkout's generator digest names.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/* github#8, github#102 -- the digest inputs, owned here so smoke and every reader agree */
export const GENERATORS = ["make-vault.mjs"];
export const FIXTURE_FORMAT = 1;
export const FIXTURE_ARGS = { vault: [] };

/**
 * The digest `smoke.mjs` names a fixture by, or "" when a generator cannot be read.
 * @param {string} root @param {string[]} args @returns {string}
 */
export function fixtureDigest(root, args) {
  const h = createHash("sha256");
  h.update("format:" + FIXTURE_FORMAT);
  try {
    for (const g of GENERATORS) h.update(readFileSync(join(root, "scripts", g)));
  } catch {
    return "";
  }
  h.update(JSON.stringify(args));
  return h.digest("hex").slice(0, 8);
}

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
 * @param {string} root @param {string} name @param {string[]} [args] @returns {string}
 */
export function currentFixture(root, name, args = FIXTURE_ARGS[name] || []) {
  const digest = fixtureDigest(root, args);
  if (!digest) return "";
  /* github#102 -- a sibling's newer build is not ours; no match is no fixture */
  const dir = join(fixtureStore(root), `${name}-${digest}`);
  const st = stampOf(dir);
  return st && st.digest === digest ? dir : "";
}

/** What a fixture's stamp says, or null. @param {string} dir */
export function stampOf(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, ".stamp.json"), "utf8"));
  } catch {
    return null;
  }
}
