# 0011 — The suite holds its own lock, and the fixture store is append-mostly

**Date** 2026-09-11 · **Status** accepted · **Issue** [#8](https://github.com/luke321/vault-shelf/issues/8)

## Context

Two faults with one symptom: parallel worktrees corrupted each other's measurements, and the
failures looked like code bugs.

**The mutex was caller discipline.** `scripts/lock.mjs` has existed since `design/0006`, and
`CLAUDE.md` and `AGENTS.md` both told a person to wrap a run in it — but `grep -n lock
scripts/smoke.mjs` returned one unrelated comment line. Nothing in the suite took the lock. The
command the iteration loop is actually made of is `node scripts/smoke.mjs --only "<substring>"`,
which nobody wraps because it is one line and feels cheap; two of those at once is precisely
what the lock exists to prevent. The serial lane (`POINTER_DRIVEN`) exists *because* a contended
GPU wrecks frame-time and laid-out-box checks — a check that passes alone and fails in a full
run was already a known shape here. Six worktrees were live when this was filed.

**The store was shared and pruned destructively.** `storeRoot` comes from `git rev-parse
--git-common-dir`, so every Orca worktree resolves to the same `.fixtures` beside the main
checkout. That part is deliberate: one fixture set means the gate measures the same vaults no
matter which worktree pushes (`decisions/0004`). But on a miss, `gen()` deleted **every other
digest** of that fixture — including the directory another worktree's Chrome had open at that
moment. And the digest is sha256 over the three generator sources, so a worker *editing* a
generator (issue #7 was doing exactly that) produced a new digest on every save: each of its
runs wiped the store the other five were using, whose next runs regenerated, which wiped it
again.

## Decision

**`smoke.mjs` acquires `suite` itself**, at startup — after the `--only` spelling is checked,
so a typo does not wait out somebody else's run, and before the fixture store is touched or any
Chrome is launched. It releases on exit, on a thrown error and on a signal, taking its own
browsers down first. `--no-lock` is for a caller that already holds the lock and nothing else.

**A fixture directory is never removed because a sibling appeared.** The name is the content's
digest, so two digests coexist. A run collects only what is provably finished with: a fixture
whose own stamp is older than `FIXTURE_MAX_AGE_DAYS`, and a `.building-`/`.retired-` scratch
directory that is not this run's and is over an hour old. Publishing distinguishes a **fresh**
same-digest directory (another run got there first — keep theirs) from a **stale** one (the
weekly refresh — rename aside, replace, then delete), so nothing is ever deleted out from under
a path something may be reading.

## Alternatives weighed

| Option | Why not |
|---|---|
| **Keep the wrap as documented, and document it harder** | It had been documented in two files the whole time. The run that skips it is the cheap one, and cheapness is the reason. A mutex that six parallel agents must remember is not a mutex. |
| **Key the store per worktree** (`--git-dir`, not `--git-common-dir`) | Six copies of a 10,000-note vault, six regenerations, and the gate would no longer measure one fixture set — which is the property `decisions/0004` bought and the tree stamp (`decisions/0010`) keys on. It also solves the wrong half: two runs would still fight for Chrome. |
| **A separate `fixtures` lock around generation** | Redundant once the suite holds `suite` for its whole run: the store's only writer is `smoke.mjs`. A second lock is a second thing to leak. |
| **Prune siblings, but only when no other suite is running** | That is what holding `suite` already tells us, and it still deletes a fixture that a *later* run of another worktree would have reused — the generator-editing case, which is the expensive one. |
| **Never collect anything** | The store grows without bound: a worker iterating on a generator adds a full fixture set per digest. Age-collection is the same rule the fixtures already had. |

## Consequences

- Every suite run is serialised on this machine, across worktrees **and across sister
  projects** — the lock root is shared with Vault Graph. Measured while this landed: a run here
  waited on `vault-graph-86`, named it, and gave up cleanly on a short timeout rather than
  starting a second Chrome next to it.
- **Wrapping a run by hand is now a mistake**, and the refusal says so in as many words. The
  three documents that taught the wrap — `CLAUDE.md`, `AGENTS.md`, `design/0006` — say the
  suite takes it itself, and that only `record` is still taken by hand.
- A blocked run is legible: `WAITING for suite -- held by <owner> for <n>s`, then either
  `ACQUIRED` or `BUSY ... gave up`. `--lock-timeout-ms` sets how long it will wait; the default
  is 30 minutes, which is longer than a full run here (39 s) by a wide margin.
- The signal path releases the lock, but **on Windows only a real console Ctrl+C delivers
  `SIGINT` to Node**; `SIGTERM` from another process terminates without running handlers. The
  backstop for a killed run is unchanged and is the lock's own 30-minute stale window.
- The store can now hold more than one digest per fixture, so it is bigger between refreshes.
  That is the price of not deleting a vault somebody is reading.
