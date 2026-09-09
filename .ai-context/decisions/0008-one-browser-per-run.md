# 0008 — One browser per run, on a port it took itself

**Date** 2026-09-09 · **Status** accepted · Inherited from the sister repo, which paid for it

## Context

The suite drives a real Chrome over CDP. Several agents and several worktrees work this
project at once, and the suite is sharded across four jobs by default, so at any moment there
may be four browsers up on one machine.

Two browsers on one debugging port is the failure that costs the most time, because it does
not look like a failure. The second run attaches to the first run's browser, evaluates its
expressions against the first run's page, and reports numbers that have nothing to do with the
code under test — so every check fails in a way that reads like a real regression in whatever
was last changed.

## Decision

**A free port per lane, taken by the harness, and a fresh profile per run.** `freePorts(k)`
opens `k` listeners on port 0 simultaneously, reads their assigned ports, then closes them all
— simultaneously, because taking them one at a time can hand the same port out twice. Each
lane launches Chrome with `--user-data-dir` pointed at its own `mkdtemp` directory, so no two
runs share a profile, a cache or a lock file.

**`--port` pins one, and pinning is checked.** Passing `--port` is for attaching a debugger by
hand, and it is the one case where a leaked browser is plausible — so with a pinned port the
harness probes `/json/version` first and refuses to start if anything answers, with a message
that says a previous run leaked its browser rather than letting the numbers say it.

**The attached page is verified before anything is measured.** After attaching, the harness
reads `location.href` and compares it to the URL it launched; a mismatch throws
"attached to the wrong page — that is a leaked browser from an earlier run, not a defect in
the page", which is the sentence that saves the hour.

**Teardown escalates and never gives up quietly.** `Browser.close` over CDP, then
`taskkill /T /F` on the child, then — on Windows — `netstat` for whoever still holds the port,
and only then a printed warning. A browser that survives teardown poisons the next run.

## Consequences

- Layout-reading checks run **serially**, in one lane, after the sharded ones. Four browsers
  contending for one GPU report box geometry that has more to do with the other three windows
  than with the code.
- Harness windows are placed off-screen (`screen.mjs`, `design/0006`) so a run does not steal
  the desktop, and `--headed` overrides that for watching one.
- Screenshots need no lock — they go over CDP, so overlapping windows are harmless — but a
  screen **recording** does, which is what `scripts/lock.mjs` is for.
