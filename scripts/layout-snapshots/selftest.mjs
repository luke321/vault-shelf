// github#110, design/0006
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLayoutFixture, pinLayoutDay, LAYOUT_ARGS, LAYOUT_GENERATED } from "./fixture.mjs";
import { diffLayout } from "./measure.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const data = (day) => `<script>window.VAULT_DATA={"vault":"vault","generated":"${day}","notes":[]};</script>`;
test("the geometry build day is independent of the wall clock", () => {
  assert.equal(pinLayoutDay(data("2026-10-03 11:24")), pinLayoutDay(data("2030-01-12 23:59")));
  assert.ok(pinLayoutDay(data("anything")).includes(LAYOUT_GENERATED));
});
test("missing or ambiguous build days fail closed", () => {
  assert.throws(() => pinLayoutDay("no data"), /found 0/);
  assert.throws(() => pinLayoutDay(data("a") + data("b")), /found 2/);
});
const golden = JSON.parse(readFileSync(resolve(root, "scripts/layout-snapshots/vault.json"), "utf8"));
test("the golden declares the generator and wear inputs", () => {
  assert.deepEqual(golden.fixtureArgs, LAYOUT_ARGS);
  assert.equal(golden.fixtureGenerated, LAYOUT_GENERATED);
});
test("geometry, membership and labels retain their existing sensitivity", () => {
  assert.deepEqual(diffLayout(golden, golden), []);
  for (const change of [
    g => { g.shelves[1].first.w += 3; },
    g => { g.shelves[1].rows++; },
    g => { g.shelves[1].books++; },
    g => { g.shelves[1].first.name += "-wrong"; },
  ]) {
    const changed = structuredClone(golden);
    change(changed);
    assert.ok(diffLayout(golden, changed).length > 0);
  }
});
const builds = [];
try {
  builds.push(buildLayoutFixture(root));
  builds.push(buildLayoutFixture(root));
  test("two fresh generations produce byte-identical geometry pages", () => {
    assert.equal(readFileSync(builds[0].html, "utf8"), readFileSync(builds[1].html, "utf8"));
  });
} finally { for (const build of builds) build.cleanup(); }
console.log(`layout fixture selftest: ${passed}/${passed} passed`);
