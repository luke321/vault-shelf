# 0010 — A tree is gated once

**Date** 2026-09-11 · **Status** accepted · **Issue** [#5](https://github.com/luke321/vault-shelf/issues/5) · Ported from the sister repo's `decisions/0013` ([vault-graph#93](https://github.com/luke321/vault-graph/issues/93))

## Context

The invariant suite builds the standalone page and drives a real Chrome against three
generated vault shapes. Measured on this machine on 2026-09-11, warm (no fixture
regeneration), under the `suite` lock:

| | |
|---|---|
| a full run, 198 checks (66 × 3 shapes) | **39.0 s** |
| of which the three builds | 7.7 s (demo 0.46, sparse 0.70, 10k **6.5**) |
| the parallel lane: 12 shards of 53 checks over 4 Chromes | ~6 s of check time |
| the serial lane: 3 jobs of 13 layout-reading checks, one Chrome at a time | **22 s** of check time (7 + 6 + 9) |
| the same run cold, regenerating all three fixtures | 43 s |
| the static gates ahead of it (six checks + code map) | 2.95 s |
| lint (with `tsc --noEmit` over `src/core`) | 4.0 s |

Chrome is launched **15 times** in a run, one per job, because a second run attaching to a
live browser measures the wrong page (`decisions/0008`).

The release path was going to pay that full run at least three times for one tree: the dry
run on `release/<version>`, the hook on the `release/<version>` → `develop` push, and
`release.ps1`'s own run before the tag. **The premise that makes those redundant holds here
as it does next door**: `main` only ever receives `develop` — the branch-policy workflow
governs the button, the pre-push hook governs `git push`, and `release.yml` refuses a tag
that is not in `origin/main`'s history — so the merge commit that reaches `main` carries
exactly the tree `develop`'s push already gated. Re-driving Chrome over identical content is
cost, not a second opinion.

**The saving here is seconds, not minutes, and the record says so rather than inheriting the
sister repo's numbers.** Over there a run is 587 s and the stamp saves about twenty minutes a
release; here a run is 39 s and it saves about **78 s** a release. That is a real but small
number, and it is not the main reason this was worth doing.

## Decision

**A green full run of `smoke.mjs` stamps the git tree it measured, and the two local gates
trust the stamp.** `scripts/suite-stamp.mjs` writes one JSON file per tree under
`suite-passed/` in the shared git common dir: the tree, the commit it was taken from, the
time, the check count, and the three fixtures (name, digest, generation day, whether the
`--end` date is pinned). `.githooks/pre-push` looks up every commit being pushed to `develop`
or `main` (`gated_shas`); `release.ps1` looks up `HEAD`. A hit skips the suite and **prints
what it trusts**. A miss runs it, under the `suite` lock, and stamps.

**The record is the point more than the seconds.** What this replaces is `SKIP_SMOKE=1`, which
is what a person reaches for when the suite "just passed" — a true statement that nothing
writes down, so afterwards a right skip and a wrong one look identical. A stamp cannot say
"recently"; it can only say *which tree*, measured *against which fixtures*, and *when*.

A stamp is written only by a **full** default run — no `--only`, `--vault`, `--url` or
`--look` — of a tree with **no modified tracked files**, so it never names a measurement no
commit can reproduce. It misses when a fixture in the shared store is no longer the one that
passed, when an unpinned fixture has crossed the seven-day refresh (the next run would
regenerate it and measure something else), or when a generator failed and the run silently
went ahead with two shapes. `SKIP_SMOKE` stays as the manual override; `release.ps1
-ForceSuite` re-earns a stamp on demand.

## Alternatives weighed

| Option | Why not |
|---|---|
| **Key by commit hash** | The merge into `main` is a new commit by construction while its tree is not, so the one case this is about would always miss. |
| **Trust a recent green run by time** | A window says a suite passed recently; it cannot say which tree it saw. Several worktrees move at once here — the lock was contended twice while this was being measured — so "recently" is the least trustworthy fact available. |
| **Drop the run in `release.ps1` and keep the hook's** | The tag is the point of no return, and the dry run on the release branch is where a failure is cheapest. Keeping the release script's run and making it conditional keeps the safety net where it costs least. |
| **Keep `SKIP_SMOKE` as the way** | It leaves no record, which is the whole defect. |
| **Do nothing, since 39 s is cheap** | The cost is not the only thing the stamp buys, and a gate that is cheap today is one nobody notices getting expensive. The 10k fixture's build alone is already 6.5 s of every run. |

## Consequences

- The release path pays the suite once, on the release branch's dry run. The merge into
  `develop` skips when `develop` had not moved and runs when it had, which is the right
  answer both times; the merge into `main` and the tag never pay it. `releasing.md` lays the
  path out step by step.
- The hook now holds the `suite` lock while a real run is in progress and releases it on
  every exit path, including a signal. It did not before. Measured while this landed: a hook
  run with one unstamped sha **waited 115 s** for the `gates` worktree to finish before
  starting, which is two suites that would otherwise have driven Chrome at the same time.
- `node scripts/suite-stamp.mjs check [<rev>]` answers "what will this push do" before it is
  made; `list` shows every tree this machine has passed. `--selftest` proves the hit and miss
  cases against a throwaway repository — seventeen cases, the last of them the CLI driven through a directory junction (github#27).
- **Both callers require the pass line, not exit 0.** The sister repo found its copy of this
  script exiting 0 while printing nothing when it was invoked through a directory junction —
  every Orca worktree is reached through one — so `if ! node ... check` read silence as
  "stamped" and the suite never ran on those pushes. Here the CLI guard realpaths both sides,
  and the hook and `release.ps1` both match on `passed the invariant suite`.
- The stamp is only as good as the store it was taken against, which is why the fixtures'
  identity is part of the key rather than assumed from the generator sources in the tree.
  Two worktrees whose generators differ thrash one shared store, and the stamps of each miss
  as soon as the other has run — which is correct, and visible in the printed reason.
