# AGENTS.md

**`CLAUDE.md` is the brief — read it first and treat it as the single source.** This file
exists so an agent that looks for `AGENTS.md` by convention finds its way there instead of
guessing, and it deliberately does not restate the laws: two copies of a rule become two
different rules.

**Where you are decides what you are.** A session in the main checkout
(`C:\git-personal\vault-shelf`) is the orchestrator: it surveys, dispatches, reviews, merges,
pushes and releases, and it never implements. A session in an Orca worktree is a worker: it
implements one piece of work, runs its own gates, and stops at its own branch. Say which one
you are before you start, and if you are the orchestrator, **take the name**:
`/rename vault-shelf-orchestrator`, so a session in the sister repo can address you.

Five things are worth knowing before you touch anything, all expanded in `CLAUDE.md`:

- **Measure, don't reason.** The recurring failure here is arguing about the code instead of
  driving it: build the page, drive it, read the numbers. `node scripts/smoke.mjs --only
  "<substring>"` is the iteration loop.
- **Numbers cannot see.** Every check in the suite asserts a number and none of them can see
  that something looks wrong. Two real bugs in this repo were found only by looking at a
  screenshot — an invisible control character inside a string constant, and `[hidden]` losing
  to a class selector so the reader painted over the library while every check passed.
  `node scripts/smoke.mjs --only "<one check>" --shot out.png` takes the picture.
- **Two things may not run twice at once.** **Any suite run** drives Chrome over CDP, so two
  runs fight for a contended GPU and each blames the code; and **any harness that places a
  window** takes over the leftmost display, so a second one — here, or a recording in the sister
  repo — lands on top of it. Both are guarded by one machine-wide mutex that every worktree —
  and every sister project — shares, and **a lock is named after the resource**: `suite`,
  `screen-left`, `screen-right`, `screen-primary` (`github#37`).

  **You do not have to remember it for a suite run.** `smoke.mjs` takes the `suite` lock itself
  and releases it on exit and on a signal, so the `--only` iteration loop is covered too. Do
  **not** wrap a run in `lock.mjs`: it would wait for its own parent. Only a caller that already
  holds the lock passes `--no-lock` (the pre-push hook, `release.ps1`). **Nor a `git push` to
  `develop` or `main`**: the hook takes the lock itself around its run, so an outer
  acquire/release makes the hook block on you and the push hang.

  **Nor do you have to remember it for any harness that opens a window** — `refresh-check`,
  `teardown-check`, `check-data-escape --browser` and `update-layout-snapshots` each claim
  `screen-left` themselves and give up by name if somebody else has the display. This repo
  makes **no screen recording** (`design/0007`), so there is nothing left to wrap by hand;
  driving a window yourself is the one case:

  ```powershell
  node scripts/lock.mjs acquire screen-left --owner "<who you are>"   # exit 1 = give up
  node scripts/lock.mjs release screen-left --owner "<who you are>"   # always, even on failure
  node scripts/lock.mjs status
  ```
- **A non-default vault must be trusted before the plugin loads.** Opening a fixture vault in
  Obsidian raises *Trust author and enable plugins?* on first open; confirm it and close the
  Settings window it opens, or you will misread an untrusted vault as a broken plugin.
- **`git push`, merging into `develop`, and a full-suite run are each a separate ask, every
  time.** None of them is implied by permission to do the work, or by how the last one went. A
  dispatched worktree stops at its own branch regardless — only the orchestrator pushes to
  `develop` or cuts a release.

`.ai-context/README.md` maps the design records; `.ai-context/code-map.md` and `code-index.md`
are generated and let you jump to a line range instead of reading a 1,200-line file top to
bottom.
