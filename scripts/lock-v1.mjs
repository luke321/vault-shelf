#!/usr/bin/env node
// decisions/0022 -- atomic-lock-v1, behind the machine's marker
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const protocol = 'atomic-lock-v1';
const home = process.env.VAULT_LOCKS_HOME || tmpdir();
const root = join(home, 'obsidian-vault-locks');
const guard = join(root, '.mutation-v1.guard');
const legacyRoots = [join(home, 'vault-graph-locks'), join(home, 'vault-shelf-locks')];
const names = ['record', 'suite', 'screen-left', 'screen-right', 'screen-primary', 'screen-left-half'];
const dirFor = n => join(root, n + '.lock');
const windowMs = n => n === 'suite' ? 1800000 : 1200000;
// decisions/0022 -- the left half and the whole primary block each other
const halves = { 'screen-primary': ['screen-left-half'], 'screen-left-half': ['screen-primary'] };
const conflicts = n => n === 'record' ? names.filter(x => x !== 'suite') : n.startsWith('screen-') ? [n, 'record', ...(halves[n] || [])] : [n];
const busy = message => Object.assign(new Error(message), { code: 'BUSY' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
function exists(path) {
  try { statSync(path); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
function validate(name, owner) {
  if (!names.includes(name) || typeof owner !== 'string' || !owner.trim()) throw new Error('valid name and owner required');
}
function ready() {
  if (readFileSync(join(root, 'protocol-v1.ready'), 'utf8') !== protocol + '\n') throw new Error('INCOMPATIBLE rollout');
}
function guarded(work) {
  ready();
  try { mkdirSync(guard); }
  catch (e) { if (e.code === 'EEXIST') throw busy('mutation guard busy or abandoned'); throw e; }
  try { ready(); return work(); }
  finally { rmdirSync(guard); }
}
function meta(name) {
  const m = JSON.parse(readFileSync(join(dirFor(name), 'owner.json'), 'utf8'));
  if (!m || typeof m.owner !== 'string' || !m.owner.trim() || !Number.isSafeInteger(m.at) || !Number.isSafeInteger(m.since) ||
      m.at <= 0 || m.since <= 0 || m.since > m.at || m.at > Date.now() || m.protocol !== protocol || !['cli','process'].includes(m.holder)) {
    throw new Error('UNKNOWN ' + name + ' metadata; inspect while writers are stopped');
  }
  return m;
}
function writeMeta(name, m) {
  const path = join(dirFor(name), 'owner.json');
  const temp = path + '.' + process.pid + '.tmp';
  writeFileSync(temp, JSON.stringify(m));
  renameSync(temp, path);
}
function current(name, owner) {
  const m = meta(name);
  if (m.owner !== owner) throw new Error('REFUSED: owner does not match');
  if (Date.now() - m.at > windowMs(name)) throw new Error('EXPIRED: cannot revive a lease');
  return m;
}
function attempt(name, owner, holder) {
  return guarded(() => {
    for (const n of conflicts(name)) {
      for (const legacy of legacyRoots) {
        if (exists(join(legacy, n + '.lock')) || (name === 'suite' && exists(join(legacy, 'fullsuite.lock')))) {
          throw new Error('LEGACY state remains; migration required');
        }
      }
      if (!exists(dirFor(n))) continue;
      const m = meta(n);
      if (Date.now() - m.at > windowMs(n)) rmSync(dirFor(n), { recursive: true });
      else if (m.owner !== owner) throw busy('held as ' + n + ' by ' + m.owner);
    }
    if (!exists(dirFor(name))) {
      mkdirSync(dirFor(name));
      const now = Date.now();
      writeMeta(name, { owner, at: now, since: now, holder, protocol, ...(holder === 'process' ? { pid: process.pid } : {}) });
    }
  });
}
export function ownerTag(what) {
  const repo = dirname(dirname(fileURLToPath(import.meta.url)));
  const b = spawnSync('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', windowsHide: true });
  return what + ' ' + (b.status === 0 ? b.stdout.trim() : '?') + ' pid ' + process.pid;
}
function beatInterval() {
  const requested = Number(process.env.VAULT_LOCKS_BEAT_MS) || 30000;
  if (!Number.isFinite(requested) || requested <= 0 || requested >= 600000) throw new Error('invalid heartbeat interval');
  return requested;
}
function beat(name, owner, onLost) {
  const timer = setInterval(() => {
    try {
      guarded(() => { const m = current(name, owner); writeMeta(name, { ...m, at: Date.now() }); });
    } catch (e) {
      clearInterval(timer);
      // decisions/0022 -- onLost runs outside the guard
      onLost(e.message);
    }
  }, beatInterval());
  timer.unref();
  return () => clearInterval(timer);
}
export async function acquire(name, opts) {
  validate(name, opts.owner);
  const asCli = opts.holder === 'cli';
  if (!asCli && typeof opts.onLost !== 'function') throw new Error('process holds require onLost to stop work');
  if (!asCli) beatInterval();
  const timeout = opts.timeoutMs === undefined ? 2700000 : opts.timeoutMs;
  if (!Number.isFinite(timeout) || timeout < 0) throw new Error('invalid timeout');
  const deadline = Date.now() + timeout;
  for (;;) {
    try { attempt(name, opts.owner, asCli ? 'cli' : 'process'); break; }
    catch (e) { if (e.code !== 'BUSY' || Date.now() >= deadline) throw e; }
    await sleep(Math.min(250, Math.max(1, deadline - Date.now())));
  }
  const stop = asCli ? () => {} : beat(name, opts.owner, opts.onLost);
  (opts.say || console.log)('ACQUIRED ' + name + ' by ' + opts.owner);
  return { name, owner: opts.owner, release: () => { stop(); return releaseNamed(name, opts.owner, opts.say); } };
}
export function refreshNamed(name, owner, say = console.log) {
  try {
    validate(name, owner);
    guarded(() => { const m = current(name, owner); writeMeta(name, { ...m, at: Date.now() }); });
    say('REFRESHED ' + name); return 0;
  } catch (e) { console.error(e.message); return 2; }
}
export function releaseNamed(name, owner, say = console.log) {
  try {
    validate(name, owner);
    guarded(() => {
      if (!exists(dirFor(name))) return;
      if (meta(name).owner !== owner) throw new Error('REFUSED: owner does not match');
      rmSync(dirFor(name), { recursive: true });
    });
    say('RELEASED ' + name); return 0;
  } catch (e) { console.error(e.message); return 2; }
}
export function heldBy(name, owner) {
  try { validate(name, owner); return guarded(() => !!current(name, owner)); }
  catch { return false; }
}
export function adopt(name, opts = {}) {
  validate(name, 'adopt');
  if (typeof opts.onLost !== 'function') throw new Error('adoption requires onLost to stop work');
  beatInterval();
  // decisions/0022 -- adopt takes a CLI hold the caller chose
  const before = guarded(() => {
    if (!exists(dirFor(name))) return null;
    const m = meta(name);
    if (m.holder !== 'cli' || Date.now() - m.at > windowMs(name)) return null;
    writeMeta(name, { ...m, at: Date.now(), holder: 'process', pid: process.pid });
    return m;
  });
  if (!before) return null;
  const stop = beat(name, before.owner, opts.onLost);
  return { name, owner: before.owner, release: () => {
    stop();
    return guarded(() => {
      const m = current(name, before.owner);
      if (m.since !== before.since || m.holder !== 'process' || m.pid !== process.pid) throw new Error('adoption changed');
      const back = { ...m, at: Date.now(), holder: before.holder };
      delete back.pid;
      writeMeta(name, back);
    });
  } };
}
function status() {
  for (const name of names) {
    if (!exists(dirFor(name))) continue;
    try { const m = meta(name); console.log(name + ' by ' + m.owner + ' last beat ' + m.at); }
    catch { console.log(name + ' UNKNOWN'); }
  }
  if (exists(guard)) console.log('GUARD BUSY or abandoned; never reap automatically');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, name, ...args] = process.argv.slice(2);
  const flag = (key, fallback) => { const i = args.indexOf('--' + key); return i < 0 ? fallback : args[i + 1]; };
  const owner = flag('owner', '');
  try {
    // decisions/0022 -- a CLI hold is never a process hold
    if (flag('holder', 'cli') !== 'cli') throw new Error('--holder process requires the imported API');
    if (action === 'acquire') await acquire(name, { owner, holder: 'cli', timeoutMs: Number(flag('timeout-ms', 2700000)) });
    else if (action === 'refresh') process.exitCode = refreshNamed(name, owner);
    else if (action === 'release') process.exitCode = releaseNamed(name, owner);
    else if (action === 'status') status();
    else throw new Error('usage: lock.mjs acquire|refresh|release|status <name> --owner <id>');
  } catch (e) { console.error(e.message); process.exitCode = e.code === 'BUSY' ? 1 : 2; }
}
