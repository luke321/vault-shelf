// github#110, design/0006 -- geometry has fixed inputs; the live suite still ages
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const LAYOUT_ARGS = ["--end", "2026-09-24"];
export const LAYOUT_GENERATED = "2026-09-24 00:00";

export function pinLayoutDay(html) {
  const pattern = /(<script>window\.VAULT_DATA=\{"vault":"[^"\n]*","generated":")[^"\n]*(")/g;
  let count = 0;
  const pinned = html.replace(pattern, (_, start, end) => {
    count++;
    return start + LAYOUT_GENERATED + end;
  });
  if (count !== 1) throw new Error(`layout fixture expected one data generation day, found ${count}`);
  return pinned;
}

export function buildLayoutFixture(root) {
  const scratch = mkdtempSync(join(tmpdir(), "vs-layout-"));
  const cleanup = () => rmSync(scratch, { recursive: true, force: true });
  try {
    const vault = join(scratch, "vault");
    const html = join(scratch, "vault-shelf.html");
    for (const args of [
      [join(root, "scripts", "make-vault.mjs"), "--out", vault, ...LAYOUT_ARGS],
      [join(root, "src", "build-shelf.mjs"), "--vault", vault, "--out", html],
    ]) {
      const r = spawnSync(process.execPath, args, { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`layout fixture failed: ${r.stderr || r.stdout || r.error}`);
    }
    writeFileSync(html, pinLayoutDay(readFileSync(html, "utf8")));
    return { html, url: pathToFileURL(html).href, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}

export async function visitLayoutPage(page, url) {
  const r = await page.send("Page.navigate", { url });
  if (r.errorText) throw new Error(`layout navigation failed: ${r.errorText}`);
  const deadline = Date.now() + 30000;
  for (;;) {
    const ready = await page.eval(`location.href === ${JSON.stringify(url)} &&
      !!(window.__vs && __vs.counts().spines > 0 && !__vs.room().pending)`)
      .catch(() => false);
    if (ready) return;
    if (Date.now() > deadline) throw new Error("layout page did not finish rendering");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
