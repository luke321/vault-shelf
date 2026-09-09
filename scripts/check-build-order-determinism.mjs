#!/usr/bin/env node
// decisions/0004

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const BUILD = join(ROOT, "src", "build-shelf.mjs");

const FOLDERS = ["03 - Resources", "01 - Projects", "02 - Areas"];
const NOTES_PER_FOLDER = ["Zebra", "Mango", "Apple"];

function makeVault(dir, folderOrder, noteOrder) {
  mkdirSync(join(dir, ".obsidian"), { recursive: true });
  writeFileSync(join(dir, ".obsidian", "app.json"), "{}", "utf8");
  for (const folder of folderOrder) {
    const fd = join(dir, folder);
    mkdirSync(fd, { recursive: true });
    for (const note of noteOrder) {
      writeFileSync(join(fd, `${note}.md`), `---\ndate: 2026-01-0${noteOrder.indexOf(note) + 1}\n---\n# ${note}\n`, "utf8");
    }
  }
}

function buildAndReadIds(vaultDir, outFile) {
  const r = spawnSync(process.execPath, [BUILD, "--vault", vaultDir, "--out", outFile],
                       { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`build-shelf.mjs exited ${r.status} for ${vaultDir}`);
  const html = readFileSync(outFile, "utf8");
  const m = /window\.VAULT_DATA=(\{[\s\S]*?\});<\/script>/.exec(html);
  if (!m) throw new Error(`no window.VAULT_DATA found in ${outFile}`);
  const data = JSON.parse(m[1]);
  return data.notes.map((n) => n.id);
}

const vaultA = mkdtempSync(join(tmpdir(), "vs-orderA-"));
const vaultB = mkdtempSync(join(tmpdir(), "vs-orderB-"));
const outA = join(vaultA, "out.html");
const outB = join(vaultB, "out.html");

const problems = [];

{
  const src = readFileSync(BUILD, "utf8");
  const fnMatch = /function walk\(dir[^)]*\)\s*\{([\s\S]*?)\n\}/.exec(src);
  if (!fnMatch) {
    problems.push("could not find walk()'s function body in src/build-shelf.mjs to check");
  } else if (!/readdirSync\([^)]*\)\s*\.sort\(/.test(fnMatch[1])) {
    problems.push("walk() no longer sorts its readdirSync(dir) result before using it");
  }
}

try {
  makeVault(vaultA, FOLDERS, NOTES_PER_FOLDER);
  makeVault(vaultB, [...FOLDERS].reverse(), [...NOTES_PER_FOLDER].reverse());

  const idsA = buildAndReadIds(vaultA, outA);
  const idsB = buildAndReadIds(vaultB, outB);
  const sortedA = [...idsA].sort();

  if (idsA.length !== FOLDERS.length * NOTES_PER_FOLDER.length) {
    problems.push(`expected ${FOLDERS.length * NOTES_PER_FOLDER.length} notes, got ${idsA.length}`);
  }
  if (JSON.stringify(idsA) !== JSON.stringify(sortedA)) {
    problems.push(`build A is not in sorted order:\n    got:    ${idsA.join(", ")}\n    ` +
      `expected: ${sortedA.join(", ")}`);
  }
  if (JSON.stringify(idsA) !== JSON.stringify(idsB)) {
    problems.push(`two vaults with the same notes, created in a different order, built to ` +
      `different note orders:\n    A: ${idsA.join(", ")}\n    B: ${idsB.join(", ")}`);
  }
} finally {
  for (const dir of [vaultA, vaultB]) if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

if (!problems.length) {
  console.log("check-build-order-determinism: clean -- note order is sorted and " +
    "independent of on-disk creation order");
  process.exit(0);
}
console.error(`\ncheck-build-order-determinism: ${problems.length} problem(s)\n`);
for (const p of problems) console.error("  " + p);
console.error(`
build-shelf.mjs's note order should never depend on filesystem enumeration order -- walk()
must sort each directory's entries before recursing or collecting. If this fails, that sort
was removed or bypassed, and note order inside every book -- and every golden shelf snapshot
taken from a build -- becomes a function of what order the disk happened to hand files back
in, which differs between machines and between a fresh clone and a warm one.`);
process.exit(1);
