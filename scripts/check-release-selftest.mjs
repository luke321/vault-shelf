#!/usr/bin/env node
// github#112 -- process exits and metadata in scratch
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "vs-release-contract-")));
const fixture = join(scratch, "candidate");
const logArg = process.argv.indexOf("--out");
const logs = logArg < 0 ? null : resolve(process.argv[logArg + 1]);
if (logs) mkdirSync(logs, { recursive: true });
const metadata = ["manifest.json", "CHANGELOG.md", "plugin/whats-new.md"];
const release = join(fixture, "scripts/release.ps1");
let passed = 0;
let failed = 0;

function git(cwd, ...args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.error || result.stderr}`);
  return result.stdout.trim();
}

function check(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; console.error(`  FAIL ${name}: ${error.message}`); }
}

function run(name) {
  console.log(`Running ${name} (isolated console processes)...`);
  const before = git(fixture, "show-ref");
  const result = spawnSync("powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", release, "-SelfTest"],
    { cwd: fixture, encoding: "utf8", windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (logs) writeFileSync(join(logs, `${name}.log`), `process exit: ${result.status}\n${output}`);
  check(`${name}: process completed`, () => assert.ifError(result.error));
  check(`${name}: source refs and tags unchanged`, () => assert.equal(git(fixture, "show-ref"), before));
  check(`${name}: inherited tag removed in both inner repositories`, () =>
    assert.equal((output.match(/^Deleted tag /gm) || []).length, 2));
  check(`${name}: five consumer call/cleanup assertions reached`, () =>
    assert.equal((output.match(/one headed suite, expected certificate calls, lock released: True/g) || []).length, 5));
  return { ...result, output };
}

function expectGreen(name, version) {
  const result = run(name);
  check(`${name}: candidate metadata reached the clone`, () =>
    assert.ok(result.output.includes(`manifest says ${version}; CHANGELOG has a section for it: True`)));
  check(`${name}: all 16 cases passed`, () => {
    assert.equal((result.output.match(/^ {2}ok {3}/gm) || []).length, 16);
    assert.match(result.output, /release.ps1 -SelfTest: all 16 cases behaved/);
    assert.doesNotMatch(result.output, /FAILED|^ {2}FAIL /m);
  });
  check(`${name}: process exits 0`, () => assert.equal(result.status, 0));
}

try {
  git(scratch, "clone", "--local", "--no-hardlinks", "--quiet", "--branch", "main", root, fixture);
  git(fixture, "remote", "remove", "origin");
  git(fixture, "config", "core.hooksPath", join(scratch, "no-hooks"));
  git(fixture, "config", "user.name", "selftest");
  git(fixture, "config", "user.email", "selftest@example.invalid");
  cpSync(join(root, "scripts"), join(fixture, "scripts"), { recursive: true });
  for (const file of metadata) cpSync(join(root, file), join(fixture, file));
  const script = readFileSync(release, "utf8");
  const manifest = JSON.parse(readFileSync(join(fixture, "manifest.json"), "utf8"));
  const oldMain = git(fixture, "rev-parse", "main");
  const oldVersion = JSON.parse(git(fixture, "show", "main:manifest.json")).version;
  git(fixture, "tag", "-f", manifest.version, "main");
  expectGreen("current-metadata", manifest.version);

  // github#112 -- uncommitted candidate versus older main
  const newer = `${Math.max(Number(oldVersion.split(".")[0]), Number(manifest.version.split(".")[0])) + 1}.0.0`;
  writeFileSync(join(fixture, "manifest.json"), `${JSON.stringify({ ...manifest, version: newer }, null, 2)}\n`);
  writeFileSync(join(fixture, "CHANGELOG.md"), `## ${newer} -- Synthetic candidate\n\nConsole fixture.\n\n${readFileSync(join(root, "CHANGELOG.md"), "utf8")}`);
  writeFileSync(join(fixture, "plugin/whats-new.md"), `# ${newer}\n- Synthetic candidate.\n`);
  git(fixture, "tag", "-f", newer, "main");
  check("newer fixture: main still has older metadata", () => {
    assert.equal(git(fixture, "rev-parse", "main"), oldMain);
    assert.equal(JSON.parse(git(fixture, "show", "main:manifest.json")).version, oldVersion);
    assert.notEqual(oldVersion, newer);
  });
  expectGreen("newer-metadata", newer);

  // github#112 -- negative assertion and success-stream controls
  for (const file of metadata) cpSync(join(root, file), join(fixture, file));
  const needle = '"Drop the \'v\'"';
  assert.equal(script.split(needle).length, 2, "the negative-control assertion must be unique");
  const noisy = "$fails = New-Object System.Collections.ArrayList";
  assert.equal(script.split(noisy).length, 2, "the success-stream control must be unique");
  writeFileSync(release, script.replace(needle, '"INJECTED_ASSERTION_NEVER_MATCHES"')
    .replace(noisy, `${noisy}\n  Write-Output 'injected success-stream text'`));
  const negative = run("failed-assertion");
  check("failed-assertion: exactly one deliberate failure", () => {
    assert.equal((negative.output.match(/^ {2}ok {3}/gm) || []).length, 15);
    assert.match(negative.output, /release.ps1 -SelfTest: 1 FAILED -- a v prefix/);
    assert.doesNotMatch(negative.output, /all 16 cases behaved/);
    assert.match(negative.output, /injected success-stream text/);
  });
  check("failed-assertion: process exits 1 despite inherited tag output", () => assert.equal(negative.status, 1));
} finally {
  const target = realpathSync(scratch);
  assert.ok(target.startsWith(realpathSync(tmpdir()) + sep), "cleanup escaped the temp directory");
  rmSync(target, { recursive: true, force: true });
}
console.log(`release-selftest contract: ${passed}/${passed + failed} checks passed`);
process.exitCode = failed ? 1 : 0;
