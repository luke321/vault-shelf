# AGENTS.md

**`CLAUDE.md` is the brief — read it first and treat it as the single source.** This file
exists so an agent that looks for `AGENTS.md` by convention finds its way there instead of
guessing, and it deliberately does not restate the laws: two copies of a rule become two
different rules.

Five things are worth knowing before you touch anything, all expanded in `CLAUDE.md`:

- **Measure, don't reason.** The recurring failure here is arguing about the code instead of
  driving it: build the page, drive it, read the numbers. `node scripts/smoke.mjs --only
  "<substring>"` is the iteration loop.
- **Numbers cannot see.** Every check in the suite asserts a number and none of them can see
  that something looks wrong. Two real bugs in this repo were found only by looking at a
  screenshot — an invisible control character inside a string constant, and `[hidden]` losing
  to a class selector so the reader painted over the library while every check passed.
  `node scripts/smoke.mjs --only "<one check>" --shot out.png` takes the picture.
- **Two things may not run twice at once.** A **screen recording** grabs a display region, so
  a second take captures the first one's window; the **full suite** drives Chrome over CDP, so
  two runs fight for ports and each blames the code. Both are guarded by one machine-wide
  mutex that every worktree shares:

  ```bash
  node scripts/lock.mjs acquire suite --owner "<who you are>"   # exit 1 = give up
  node scripts/lock.mjs release suite --owner "<who you are>"   # always, even on failure
  node scripts/lock.mjs status
  ```

  `record` and `suite` are the two names.
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
