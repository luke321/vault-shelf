// github#110, decisions/0020
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const inspect = (rev) => spawnSync(process.execPath,
  [join(HERE, "suite-stamp.mjs"), "check", rev], { encoding: "utf8" });

export function verifyCertificates(revs, check = inspect) {
  if (!revs.length) return { ok: false, output: "no trees named for certification" };
  const output = [];
  let ok = true;
  for (const rev of revs) {
    const result = check(rev);
    output.push(String(result.stdout || "").trim());
    if (result.status !== 0 || !/passed the invariant suite/.test(result.stdout || "")) {
      ok = false;
      output.push(`${rev}: the required headed green streak is not certified`);
    }
  }
  return { ok, output: output.join("\n") };
}

let direct = false;
try { direct = !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
catch { direct = false; }
if (direct) {
  const result = verifyCertificates(process.argv.slice(2));
  console.log(result.output);
  process.exit(result.ok ? 0 : 1);
}
