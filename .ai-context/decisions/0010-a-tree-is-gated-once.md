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

---

## Amendment, 2026-09-12 — a tree is gated once, but it is *stamped* twice

**Issue** [#55](https://github.com/luke321/vault-shelf/issues/55) · **Status** accepted

The record above is unchanged in every respect but one: **how many green runs a stamp is
worth.** It was one. It is now two consecutive, `GREENS_REQUIRED` in `scripts/suite-stamp.mjs`.

### What went wrong

`"a hovered swatch paints the room, and leaving puts it back"` failed **three full runs in
four** on `develop` at `6c99c60`, and passed every time on its own. The one run that passed
stamped tree `f9ac717`, so `suite-stamp check` exited 0 and a push would have skipped the
suite on a tree that was red three times out of four.

That is not a bad-luck stamp. It is the *predictable* outcome of keying a stamp to a single
observation of a non-deterministic measurement: an intermittent check does not merely cost a
re-run, **it launders itself into a stamp**, and the stamp then suppresses the only thing
that would have caught it. The more intermittent the check, the more runs happen, and the
more certain the laundering becomes.

### The decision

A stamp counts a **streak**, not an event.

- `record()` increments `greens` when the stamp it finds is for the same tree **and** the
  same fixtures; otherwise it starts the count at 1. A regenerated fixture is a different
  measurement, so it does not inherit a green earned against something else.
- `lookup()` is a hit only at `greens >= GREENS_REQUIRED`, and says how far short it is
  otherwise — `tree f9ac717 has 1 green run(s) of the 2 in a row a stamp needs`.
- **A red full run deletes the stamp** (`forget()`). Without that, "two consecutive" would
  mean "two greens ever", which an intermittent check reaches on its own by being run often
  enough — the same laundering, slowed down rather than stopped. A partial run (`--only`,
  `--vault`, `--url`, `--look`) still says nothing about the tree, so it neither stamps nor
  clears.
- Stamps written under the old law carry no `greens` field, so they read as 0 and every one
  of them is demoted rather than grandfathered. That is deliberate: none of them can say how
  its measurement went, which is the thing now being asked of them.

### What it costs, said plainly

**The first push on a fresh tree pays for two suite runs instead of one** — about 45 s more
on this machine. Every push after that on the same tree is unchanged, and the release path
is unchanged, because both read the same stamp.

### Rejected

| Option | Why not |
|---|---|
| **Quarantine a check that has flaked** | Targeted and cheap, but it needs a register somebody keeps up to date by hand, and it is blind to the flake nobody has spotted yet — which is precisely the case that produced #55. Two greens needs no list and catches the unknown ones. |
| **Record the count but keep trusting one green** | Honest reporting with none of the effect. The behaviour the issue calls wrong would stay exactly as it is. |
| **Three or more greens** | Each extra run buys less than the one before, and the cost is paid on every fresh tree. Two is where a single flake stops being able to stamp on its own. |
| **Require the two runs to be on different days, or by different callers** | A clock cannot say which tree it saw — the same objection the original record makes to trusting recency. |

---

## Amendment, 2026-09-20 — a stamp names the instrument that earned it

**Issue** [#77](https://github.com/luke321/vault-shelf/issues/77) · **Status** accepted

Nothing above changes. One field is added: `epoch`, `STAMP_EPOCH` in
`scripts/suite-stamp.mjs`, and `lookup()` is a hit only when the stamp carries the epoch the
suite is at now.

### What went wrong

`"scrolling the library stays smooth in every look"` sampled a frame interval against a budget
that sat **inside a quantisation cluster**, so one dropped frame read as 34.2 (pass) or 34.7
(fail) — the same physical event on opposite sides of the line. Measured on `a2de7fa`: **four
reds in five runs**, and `modern`, the only look a user gets, could not fail at all. The budget
was replaced with a count of missed vsyncs (`decisions/0017`) and given a negative control
(`decisions/0019`).

**The stamps that check earned did not go anywhere.** Tree `0989b3e` — `develop` at the time —
was stamped 2/2 green, so a push would have skipped the suite on the strength of two coin
tosses that came up heads. The streak law of #55 is exactly what makes this durable: a stamp
that survives says two greens in a row happened, and about a check that was red four times in
five, being retried until that happens is a matter of patience.

Measured on this machine the day this landed: **79 stamps, 17 of them at the full streak, and
0 of them hitting**, because the one fixture in the store is `3ea58174` of 2026-09-16 and no
stamp names it. That is a reprieve, not a defence. A fixture digest is a function of the
generator sources, so it returns whenever those do, and `.githooks/pre-push` looks up **every
commit being pushed** rather than the tip alone — a `develop` push carrying a range of older
commits is the shape that collects dormant stamps.

### The decision

**The instrument is part of the claim.**

- `record()` writes `epoch: STAMP_EPOCH` and treats an epoch change exactly as it treats a
  regenerated fixture: the streak restarts at 1 rather than inheriting greens earned by a
  measurement now known to be unreliable.
- `lookup()` misses on any other epoch, **before** it reads the fixtures or the streak, and
  names both — `tree 0989b3e was stamped under epoch none and the suite is at epoch 2, so
  another instrument measured it`. Stamps written before the field existed read as `none` and
  are demoted, the same way #55 demoted the ones with no `greens`.
- `list` prints each stamp's epoch and says when it is not the current one, so the command the
  issue points at enumerates the candidates honestly.
- The equality is **strict**. The epoch is part of the tree, so a stamp for a tree always
  carries that tree's own epoch and a mismatch can only mean the stamp predates a bump.

| epoch | drawn at | why |
|---|---|---|
| 1 (written as `none`) | everything up to `65411f7` | the smoothness budget sampled one frame interval against a threshold inside a vsync cluster (github#77) |
| 2 | the frame-counting budget, `decisions/0017` | the budget counts missed vsyncs, sweeps at a fixed velocity, and proves on every run that it can still see the regression it exists to catch (`decisions/0019`) |

**What makes the demotion reach the past at all**: both gates run
`scripts/suite-stamp.mjs` **from the checkout doing the pushing**, not from the commit whose
stamp is being looked up — `.githooks/pre-push` calls `$root/scripts/suite-stamp.mjs` for every
sha in the range. So a working tree at epoch 2 judges an old tree's stamp by epoch 2 and misses
it. The one way round that is to check the old tree out and push from there, which runs the old
script by construction; nothing in this repo does that, and a tree old enough to matter would
fail the branch policy long before the stamp came up.

**Bumping it is a maintainer's act, and deliberately manual.** A stamp is keyed to the git
tree, and the tree contains the check, so a *future* change to a check can never inherit an old
stamp — that much is already covered. The epoch exists for the one thing tree-keying cannot
express: a discovery, made later, that a measurement already taken was lying. That is a fact
about the past, and no key derived from the tree can state it.

### What it costs, said plainly

Every tree on this machine loses its stamp, so the next `develop` push pays two suite runs to
re-earn one — about 45 s more, and **0 s today**, since nothing hit anyway. The line is drawn
bluntly: `55147fa` (2/2, 2026-09-16) was honestly earned on the new check and is demoted with
the rest.

### Rejected

| Option | Why not |
|---|---|
| **Delete the 17 files and be done** | The store lives in the shared git common dir, so it is per machine: a delete fixes this one, leaves the other untouched, and says nothing to a fresh clone. It also destroys the record, which is the defect this record holds against `SKIP_SMOKE` in the first place. |
| **Demote per stamp, by whether its `commit` has `65411f7` as an ancestor** | Surgical, and it would have kept `55147fa`. But it needs each recorded commit to exist in whatever checkout is doing the lookup, which a store shared across worktrees and machines cannot promise, and it makes trust depend on git archaeology rather than a number in the tree. |
| **Raise `GREENS_REQUIRED` instead** | Weighed and rejected in the amendment above, and it answers a different question: no number of greens rescues a stamp earned by an instrument that was not measuring its subject. |
| **Derive the epoch from a digest of the check sources** | The tree hash already is that digest, and it already works. What is wanted here is a judgement about a past measurement, which no digest of the present can carry. |
| **Accept `stamp.epoch >= STAMP_EPOCH`** | Nothing writes a stamp from the future, so it buys no case and loses fail-closed. |
