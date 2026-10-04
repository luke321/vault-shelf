// github#97, design/0013

import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const FOLD = process.platform === "win32" || process.platform === "darwin";

/** @param {string} p */
export function canonical(p) {
  let head = resolve(p);
  /** @type {string[]} */
  const tail = [];
  for (;;) {
    try { head = realpathSync.native(head); break; }
    catch {
      const up = dirname(head);
      if (up === head) break;
      tail.unshift(basename(head));
      head = up;
    }
  }
  const full = tail.length ? join(head, ...tail) : head;
  return FOLD ? full.toLowerCase() : full;
}

/** @param {string} child @param {string} parent */
function within(child, parent) {
  const r = relative(parent, child);
  return r !== "" && r !== ".." && !r.startsWith(".." + sep) && !isAbsolute(r);
}

/**
 * @param {string} source @param {string} out
 * @returns {{ how: "same" | "inside" | "contains" | null, source: string, out: string }}
 */
export function overlap(source, out) {
  const a = canonical(source), b = canonical(out);
  const how = a === b ? "same" : within(b, a) ? "inside" : within(a, b) ? "contains" : null;
  return { how, source: a, out: b };
}
