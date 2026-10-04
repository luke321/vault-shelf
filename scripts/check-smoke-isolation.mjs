// decisions/0021
import assert from "node:assert/strict";
import { serialBatches, waitForPushQuiet, framePeriod, frameStats } from "./smoke-isolation.mjs";

const lib = { name: "scrolling the library stays smooth in every look" };
const wheel = { name: "a wheel on the spread stays smooth in every look" };
const a = { name: "pointer check" }, b = { name: "geometry check" };
const input = [a, lib, b, wheel];
const batches = serialBatches(input);
assert.deepEqual(batches.map((x) => x.checks), [[a, b], [lib], [wheel]]);
assert.deepEqual(batches.map((x) => x.benchmark), [false, true, true]);
assert.deepEqual(input, [a, lib, b, wheel]);
assert.equal(new Set(batches.flatMap((x) => x.checks)).size, input.length);
assert.deepEqual(serialBatches([]), []);
assert.deepEqual(serialBatches([lib]).map((x) => x.checks), [[lib]]);
assert.deepEqual(serialBatches([a]).map((x) => x.checks), [[a]]);
assert.deepEqual(serialBatches([wheel, lib]).map((x) => x.checks), [[wheel], [lib]]);
let calls = 0;
const page = { eval: async () => { calls++; return { quiet: false, state: { spent: true } }; } };
await assert.rejects(waitForPushQuiet(page, 80), /push latch did not clear/);
assert.equal(calls, 1);
for (const budget of [0, -1, NaN, Infinity, 5001]) {
  await assert.rejects(waitForPushQuiet(page, budget), /positive budget/);
}
assert.equal(calls, 1);
const signal = { quiet: true, elapsed: 140, state: { spent: false } };
assert.equal(await waitForPushQuiet({ eval: async () => signal }), signal);
await assert.rejects(waitForPushQuiet({ eval: async () => { throw Error("CDP disconnected"); } }), /CDP disconnected/);
assert.equal(framePeriod([0, 16, 32, 48, 64]), 16);
assert.equal(frameStats({ ts: [0, 16, 32, 48] }, 16).missed, 0);
assert.equal(frameStats({ ts: [0, 16, 32, 1040, 1056] }, 16).missed, 62);
for (const ts of [[], [123], [0, 0], [2, 1], [0, NaN], [0, Infinity]]) {
  assert.throws(() => frameStats({ ts }, 16), /frame probe/);
  assert.throws(() => framePeriod(ts), /frame probe/);
}
for (const vsync of [0, -1, NaN, Infinity]) assert.throws(() => frameStats({ ts: [0, 16] }, vsync), /calibration/);
console.log("smoke-isolation: batch ownership, coverage, order, readiness, deadlines, frame samples and transport failures passed");
