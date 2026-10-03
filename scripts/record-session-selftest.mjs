// github#111 -- no browser; lock and signal controls use a private temporary root
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = mkdtempSync(join(tmpdir(), "vs-record-test-"));
process.env.VAULT_LOCKS_HOME = root;
process.env.VAULT_LOCKS_BEAT_MS = "50";
const { RecordingSession, recordingWindow } = await import("./record-session.mjs");
const { acquire, heldBy } = await import("./lock.mjs");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
const check = async (name, fn) => { await fn(); console.log("PASS " + name); passed++; };
const screen = { device: "right-display", x: 2560, y: 0, w: 2560, h: 1400 };
const selected = { position: "right", device: screen.device, busy: false };
const options = { width: 1440, height: 900 };
const screens = [{ ...screen, device: "left-display", x: -2560 }, screen];
const silent = () => {};
const childRun = (args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, windowsHide: true });
  let output = "";
  child.stdout.on("data", d => { output += d; }); child.stderr.on("data", d => { output += d; });
  child.on("error", reject); child.on("close", code => resolve({ code, output }));
});

try {
  await check("approved device and exact centred bounds", () => {
    assert.deepEqual(recordingWindow(selected, screens, options), { monitor: "right", left: 3120, top: 250, width: 1440, height: 900 });
  });
  await check("busy, absent, wrong and disconnected monitor refuse", () => {
    for (const pick of [null, { ...selected, busy: true }, { ...selected, device: "gone" }]) {
      assert.throws(() => recordingWindow(pick, screens, options), /DEFERRED/);
    }
    assert.throws(() => recordingWindow(selected, screens, { ...options, monitor: "left" }), /requested left/);
  });
  await check("one monitor requires per-run permission, including primary", () => {
    const pick = { ...selected, position: "primary" };
    assert.throws(() => recordingWindow(pick, [screen], options), /one screen/);
    assert.equal(recordingWindow(pick, [screen], { ...options, allowSingleScreen: true }).monitor, "primary");
    assert.throws(() => recordingWindow(pick, [screen], options), /one screen/);
  });
  await check("window fits approved monitor without changing capture dimensions", () => {
    const small = { ...screen, w: 800, h: 600 };
    const placed = recordingWindow(selected, [small, screens[0]], options);
    assert.equal(placed.width, 800); assert.equal(placed.height, 600);
    assert.deepEqual(options, { width: 1440, height: 900 });
  });
  for (const name of ["record", "screen-left", "screen-right", "screen-primary"]) {
    await check(`${name} foreign owner defers unchanged`, async () => {
      const other = await acquire(name, { owner: "foreign fixture", holder: "cli", say: silent });
      const meta = join(root, "obsidian-vault-locks", name + ".lock", "owner.json");
      const before = readFileSync(meta, "utf8");
      const session = new RecordingSession(silent);
      try { await assert.rejects(session.claim(0), /BUSY/); }
      finally { session.cleanup(); }
      assert.equal(readFileSync(meta, "utf8"), before);
      assert(heldBy(name, "foreign fixture"));
      other.release();
    });
  }
  await check("whole-job hold refreshes during asynchronous child work", async () => {
    const session = new RecordingSession(silent);
    try {
      await session.claim();
      const meta = join(root, "obsidian-vault-locks", "record.lock", "owner.json");
      const before = JSON.parse(readFileSync(meta, "utf8")).at;
      await session.run(process.execPath, ["-e", "setTimeout(()=>{},250)"]);
      assert(JSON.parse(readFileSync(meta, "utf8")).at > before);
    } finally { session.cleanup(); }
    assert(!heldBy("record", session.owner));
  });
  await check("failed child removes scratch and profile, closes CDP, releases hold", async () => {
    const session = new RecordingSession(silent);
    await session.claim();
    const scratch = session.workspace(), profile = session.browserProfile();
    writeFileSync(join(scratch, "frame.jpg"), "fixture");
    let closed = 0; session.cdp = { close: () => { closed++; } };
    try { await assert.rejects(session.run(process.execPath, ["-e", "process.exit(7)"]), /failed \(7\)/); }
    finally { session.cleanup(); session.cleanup(); }
    assert.equal(closed, 1); assert(!existsSync(scratch)); assert(!existsSync(profile));
    assert(!heldBy("record", session.owner));
  });
  await check("successful keep-frames retains only requested scratch", async () => {
    const session = new RecordingSession(silent);
    await session.claim(); const scratch = session.workspace();
    session.keep = true; session.cleanup();
    assert(existsSync(scratch)); assert(!heldBy("record", session.owner));
    rmSync(scratch, { recursive: true, force: true });
  });
  await check("broken CDP close still removes all owned resources", async () => {
    const session = new RecordingSession(silent);
    await session.claim(); const scratch = session.workspace(), profile = session.browserProfile();
    session.cdp = { close: () => { throw new Error("already disconnected"); } };
    session.cleanup();
    assert(!existsSync(scratch)); assert(!existsSync(profile)); assert(!heldBy("record", session.owner));
  });
  await check("lost ownership cleans up without releasing the replacement owner", async () => {
    const receipt = join(root, "lost.json");
    const meta = join(root, "obsidian-vault-locks", "record.lock", "owner.json");
    const program = `import {RecordingSession} from ${JSON.stringify(new URL("./record-session.mjs", import.meta.url).href)};
      import {writeFileSync} from 'node:fs';
      const s=new RecordingSession(); await s.claim();
      writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({scratch:s.workspace(),profile:s.browserProfile()}));
      writeFileSync(${JSON.stringify(meta)},JSON.stringify({owner:'replacement fixture',at:Date.now(),holder:'cli'}));
      setInterval(()=>{},1000);`;
    const result = await childRun(["--input-type=module", "-e", program]);
    assert.equal(result.code, 1, result.output); assert.match(result.output, /ownership lost/);
    const state = JSON.parse(readFileSync(receipt));
    assert(!existsSync(state.scratch)); assert(!existsSync(state.profile));
    assert(heldBy("record", "replacement fixture"));
    rmSync(join(root, "obsidian-vault-locks", "record.lock"), { recursive: true });
  });
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    await check(`${sig} handler kills owned child and removes resources`, async () => {
      const receipt = join(root, sig + ".json");
      const program = `import {RecordingSession} from ${JSON.stringify(new URL("./record-session.mjs", import.meta.url).href)};
        import {writeFileSync} from 'node:fs';
        const s=new RecordingSession(); await s.claim();
        const scratch=s.workspace(), profile=s.browserProfile();
        const c=s.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
        writeFileSync(${JSON.stringify(receipt)},JSON.stringify({scratch,profile,pid:c.pid}));
        setTimeout(()=>process.emit(${JSON.stringify(sig)}),150);`;
      const result = await childRun(["--input-type=module", "-e", program]);
      assert.equal(result.code, sig === "SIGINT" ? 130 : 143, result.output);
      const state = JSON.parse(readFileSync(receipt));
      assert(!existsSync(state.scratch)); assert(!existsSync(state.profile));
      assert.throws(() => process.kill(state.pid, 0), /ESRCH/);
      assert(!existsSync(join(root, "obsidian-vault-locks", "record.lock")));
    });
  }
  await check("CLI busy guard defers before acquiring or launching", async () => {
    const guard = join(root, "busy.ps1");
    writeFileSync(guard, "param([switch]$FreeMonitor,[switch]$Quiet,[switch]$Json)\n'null'\n");
    const result = await childRun([join(here, "record-demo.mjs"), "--chrome", "must-never-launch"], { P16_SCREEN_GUARD: guard, VAULT_LOCKS_HOME: "" });
    assert.equal(result.code, 1); assert.match(result.output, /DEFERRED: screen busy/);
    assert(!result.output.includes("ACQUIRED"));
  });
  await check("CLI headless flag refuses before opening", async () => {
    const result = await childRun([join(here, "record-demo.mjs"), "--headless=new"]);
    assert.equal(result.code, 1); assert.match(result.output, /always headed/);
  });
  await check("CLI refuses isolated lock storage before any real recording", async () => {
    const result = await childRun([join(here, "record-demo.mjs"), "--chrome", "must-never-launch"]);
    assert.equal(result.code, 1); assert.match(result.output, /require machine-wide ownership/);
    assert(!result.output.includes("ACQUIRED"));
  });
  await pause(100);
  console.log(`record-session: ${passed}/${passed} passed; no browser or live lock touched`);
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
