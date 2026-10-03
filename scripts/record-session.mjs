// github#111, design/0007 -- ownership belongs to the entire recording job
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { constants, setPriority, tmpdir } from "node:os";
import { join } from "node:path";
import { acquire, ownerTag } from "./lock.mjs";

export function recordingWindow(selected, screens, { monitor = "", allowSingleScreen = false, width, height }) {
  if (!selected?.position || !selected.device || selected.busy) throw new Error("DEFERRED: screen guard returned no approved monitor");
  if (monitor && selected.position !== monitor) throw new Error(`DEFERRED: requested ${monitor}, screen guard granted ${selected.position}`);
  if (!Array.isArray(screens) || !screens.length) throw new Error("DEFERRED: cannot count monitors");
  if (screens.length === 1 && !allowSingleScreen) {
    throw new Error("DEFERRED: one screen; ask permission for this recording and its duration, then pass --allow-single-screen for this run only");
  }
  const screen = screens.find(s => s.device === selected.device);
  if (!screen || ![screen.x, screen.y, screen.w, screen.h].every(Number.isFinite) || screen.w <= 0 || screen.h <= 0) {
    throw new Error("DEFERRED: approved monitor has no valid working area");
  }
  const w = Math.min(width, screen.w), h = Math.min(height, screen.h);
  return { monitor: selected.position, left: screen.x + Math.floor((screen.w - w) / 2),
    top: screen.y + Math.floor((screen.h - h) / 2), width: w, height: h };
}

export function checkRecordingScreen(options) {
  const guard = process.env.P16_SCREEN_GUARD;
  if (process.platform !== "win32" || !guard) throw new Error("DEFERRED: configure P16_SCREEN_GUARD with this machine's screen-busy.ps1");
  const call = args => {
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", ...args],
      { encoding: "utf8", windowsHide: true, timeout: 30000 });
    if (r.error || r.status !== 0) throw new Error("DEFERRED: screen check failed: " + (r.error?.message || r.stderr));
    return r.stdout.trim();
  };
  const granted = call(["-File", guard, "-FreeMonitor", "-Quiet", "-Json"]);
  if (!granted || granted === "null") throw new Error("DEFERRED: screen busy; no free monitor");
  const selected = JSON.parse(granted);
  const screens = JSON.parse(call(["-Command", "Add-Type -AssemblyName System.Windows.Forms; " +
    "@([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { " +
    "@{device=$_.DeviceName;x=$_.WorkingArea.X;y=$_.WorkingArea.Y;w=$_.WorkingArea.Width;h=$_.WorkingArea.Height} }) | ConvertTo-Json -Compress"]));
  return recordingWindow(selected, Array.isArray(screens) ? screens : [screens], options);
}

export class RecordingSession {
  constructor(say = console.log) {
    this.say = say;
    this.owner = ownerTag("record-demo");
    this.children = new Set();
    this.scratch = null;
    this.profile = null;
    this.cdp = null;
    this.hold = null;
    this.keep = false;
    this.closed = false;
    this.exit = () => this.cleanup();
    this.signals = new Map(["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"].map(sig => [sig, () => {
      console.error(`record-demo: interrupted (${sig})`);
      process.exitCode = sig === "SIGINT" ? 130 : 143;
      this.cleanup();
      process.exit(process.exitCode);
    }]));
    process.on("exit", this.exit);
    for (const [sig, fn] of this.signals) process.on(sig, fn);
  }

  async claim(timeoutMs = 0) {
    this.hold = await acquire("record", { owner: this.owner, timeoutMs, say: this.say,
      onLost: who => {
        console.error("record-demo: record ownership lost to " + who);
        process.exitCode = 1;
        this.cleanup();
        process.exit(1);
      } });
  }

  workspace() {
    this.scratch = mkdtempSync(join(tmpdir(), "vs-record-"));
    return this.scratch;
  }

  browserProfile() {
    this.profile = mkdtempSync(join(tmpdir(), "vs-record-chrome-"));
    return this.profile;
  }

  spawn(command, args, options = {}) {
    const child = spawn(command, args, { windowsHide: true, ...options });
    this.children.add(child);
    child.once("exit", () => this.children.delete(child));
    child.once("error", () => this.children.delete(child));
    return child;
  }

  run(command, args, { encode = false } = {}) {
    return new Promise((resolve, reject) => {
      const child = this.spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      if (encode && child.pid) {
        try { setPriority(child.pid, constants.priority.PRIORITY_BELOW_NORMAL); }
        catch (error) { this.stop(child); reject(error); }
      }
      let stdout = "", stderr = "";
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
      child.stdout.on("data", data => { stdout += data; });
      child.stderr.on("data", data => { stderr = (stderr + data).slice(-16000); });
      child.once("error", reject);
      child.once("close", code => code === 0 ? resolve({ stdout, stderr })
        : reject(new Error(`${command} failed (${code}):\n${(stderr || stdout).split("\n").slice(-12).join("\n")}`)));
    });
  }

  stop(child) {
    if (!this.children.has(child)) return;
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true });
    } else child.kill();
    this.children.delete(child);
  }

  closeBrowser() {
    try { this.cdp?.close(); } catch { } finally { this.cdp = null; }
    if (this.chrome) this.stop(this.chrome);
    if (!this.profile) return;
    // github#111 -- descendants can outlive the root; match only this unique profile
    if (process.platform === "win32") {
      const quoted = this.profile.replace(/'/g, "''");
      const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `$p='${quoted}'; $pattern='--user-data-dir="?'+[regex]::Escape($p)+'(?:"|\\s|$)'; ` +
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | " +
        "Where-Object { $_.CommandLine -match $pattern } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop }"],
      { encoding: "utf8", windowsHide: true, timeout: 15000 });
      if (r.error || r.status !== 0) throw new Error("recorder profile cleanup failed: " + (r.error?.message || r.stderr));
    }
    rmSync(this.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    this.profile = null;
  }

  cleanup() {
    if (this.closed) return;
    this.closed = true;
    const errors = [];
    try { this.closeBrowser(); } catch (e) { errors.push(e.message); }
    for (const child of this.children) {
      try { this.stop(child); } catch (e) { errors.push(e.message); }
    }
    if (this.scratch && !this.keep) {
      try { rmSync(this.scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
      catch (e) { errors.push(e.message); }
    }
    this.hold?.release();
    process.removeListener("exit", this.exit);
    for (const [sig, fn] of this.signals) process.removeListener(sig, fn);
    if (errors.length) {
      console.error("record-demo cleanup: " + errors.join("; "));
      process.exitCode = 1;
    }
  }
}
