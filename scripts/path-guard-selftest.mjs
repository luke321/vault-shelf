#!/usr/bin/env node
// github#97, design/0013

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { overlap } from "./path-guard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIRROR = join(HERE, "make-mirror-vault.mjs");
const FOLDS = process.platform === "win32" || process.platform === "darwin";
const NOTE = "---\ncreated: 2021-03-04\ntags: [alpha]\n---\nA plain note about a quiet harbour.\n";

let failed = 0;
/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail) {
  console.log("  " + (ok ? "ok  " : "FAIL") + " " + name + (detail ? "   (" + detail + ")" : ""));
  if (!ok) failed++;
}

const ROOT = mkdtempSync(join(tmpdir(), "vs-path-guard-"));
let n = 0;
function sandbox() {
  const box = join(ROOT, "case-" + (++n));
  const vault = join(box, "vault");
  mkdirSync(join(vault, "Projects"), { recursive: true });
  for (let i = 1; i <= 6; i++) {
    writeFileSync(join(vault, i % 2 ? "Projects" : "", "Note " + i + ".md"), NOTE, "utf8");
  }
  return { box, vault, note: join(vault, "Projects", "Note 1.md") };
}
/** @param {string} target @param {string} at */
function link(target, at) {
  try { symlinkSync(target, at, process.platform === "win32" ? "junction" : "dir"); return true; }
  catch { return false; }
}
/** @param {string} a @param {string} b @param {string | null} want @param {string} label */
function expect(a, b, want, label) {
  const got = overlap(a, b);
  check(label, got.how === want, "got " + String(got.how) + ", want " + String(want));
}

try {
  console.log("overlap");
  {
    const { box, vault } = sandbox();
    expect(vault, vault, "same", "the vault itself");
    expect(vault, join(vault, "mirror"), "inside", "a new directory below the vault");
    expect(vault, join(vault, "Projects"), "inside", "an existing directory below the vault");
    expect(vault, box, "contains", "the vault's parent");
    expect(vault, parse(vault).root, "contains", "the filesystem root");
    expect(vault, join(box, "vault2"), null, "a sibling sharing the vault's name as a prefix");
    expect(vault, join(vault, "..", "mirror"), null, "a sibling reached through ..");
    if (FOLDS) {
      expect(vault, join(box, "VAULT"), "same", "the vault spelled in capitals");
      expect(vault, join(box.toUpperCase(), "Vault", "sub"), "inside", "a cased spelling below the vault");
      expect(vault, box.toUpperCase(), "contains", "the parent spelled in capitals");
    }
    const toVault = join(ROOT, "link-to-vault-" + n), toBox = join(ROOT, "link-to-box-" + n);
    if (link(vault, toVault) && link(box, toBox)) {
      expect(vault, toVault, "same", "a link to the vault");
      expect(vault, join(toVault, "new"), "inside", "a new directory through a link to the vault");
      expect(vault, toBox, "contains", "a link to the vault's parent");
      expect(join(toBox, "vault"), box, "contains", "the source spelled through a link, the parent real");
    } else {
      check("links could be made in " + ROOT, false, "neither a junction nor a symlink was allowed");
    }
  }

  console.log("make-mirror-vault");
  /** @param {string} label @param {(s: ReturnType<typeof sandbox>) => string | null} outOf @param {boolean} safe */
  function run(label, outOf, safe) {
    const s = sandbox();
    const out = outOf(s);
    if (out === null) { check(label, false, "could not make the link"); return; }
    const r = spawnSync(process.execPath, [MIRROR, "--vault", s.vault, "--out", out, "--quiet"],
      { encoding: "utf8", env: { ...process.env, VAULT_SHELF_VAULT: "", OBSIDIAN_VAULT: "" } });
    const kept = existsSync(s.note) && readFileSync(s.note, "utf8") === NOTE;
    const said = (r.stderr || r.stdout || "").trim().split("\n")[0];
    if (safe) check(label, r.status === 0 && kept && existsSync(join(out, ".obsidian")),
      "exit " + r.status + ", source " + (kept ? "kept" : "GONE") + (r.status ? ", " + said : ""));
    else check(label, r.status === 1 && kept,
      "exit " + r.status + ", source " + (kept ? "kept" : "GONE") + ", " + said);
  }
  /** @param {string} target @param {string} at */
  const linked = (target, at) => link(target, at) ? at : null;
  run("refuses the vault's parent", (s) => s.box, false);
  run("refuses the vault itself", (s) => s.vault, false);
  run("refuses a directory below the vault", (s) => join(s.vault, "mirror"), false);
  if (FOLDS) run("refuses the vault spelled in capitals", (s) => join(s.box, "VAULT"), false);
  run("refuses a link to the vault", (s) => linked(s.vault, join(s.box, "alias")), false);
  run("refuses a link to the vault's parent", (s) => linked(s.box, join(ROOT, "alias-" + n)), false);
  run("writes a sibling and leaves the source alone", (s) => join(s.box, "mirror"), true);
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}

console.log(failed ? `\npath-guard selftest: ${failed} FAILED` : "\npath-guard selftest: all ok");
process.exit(failed ? 1 : 0);
