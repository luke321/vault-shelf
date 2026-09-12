# 0012 — A lock names the resource, not the job

**Date** 2026-09-11 · **Status** accepted · **Issue** [#37](https://github.com/luke321/vault-shelf/issues/37),
[#25](https://github.com/luke321/vault-shelf/issues/25)

## Context

Since `decisions/0011` both plugins take their locks from one root in the OS temp dir,
`obsidian-vault-locks` — one machine, one Chrome, one screen, no matter which repository the run
belongs to. **The root is shared. The names were not**, and contention is by name: a lock only
protects what both sides think to ask for.

Three facts about this tree, read rather than assumed:

- **Three acquire sites, all `suite`** — `smoke.mjs`, `.githooks/pre-push`, `release.ps1`.
- **Nothing acquired `record`.** The name lived in `CLAUDE.md`, `AGENTS.md`, `design/0006` and
  `lock.mjs`'s own usage string. Prose only.
- **Five callers of `screen.mjs` park a *visible* Chrome on the leftmost monitor** — `smoke.mjs`,
  `refresh-check.mjs`, `teardown-check.mjs`, `check-data-escape.mjs --browser` and
  `update-layout-snapshots.mjs`. None of the five ever passes `--headless`. Four took no lock at
  all, and the fifth's `suite` lock is about Chrome, CDP and a contended GPU rather than about
  the display.

So the one thing this repo actually does to a screen was unguarded, and the guard that existed
was named after a thing this repo does not do. `design/0006` said a recording needs the `record`
lock; `design/0007` said in as many words that the recorder captures frames over CDP, touches no
desktop and needs no lock. Both could not stand.

### The failure, across the two repos

A Vault Graph `gdigrab` take on the left screen against a Vault Shelf harness parking Chrome on
that same screen. Neither asks for a name the other holds, so the two run together and the take
is ruined **silently**: the file exists, runs the right length, and looks plausible until
somebody watches it.

## Decision

**A lock is named after the display it takes over**: `screen-left`, `screen-right`,
`screen-primary`, alongside `suite`. `record` is accepted as legacy. This is
`vault-graph#87`'s argument and its exact vocabulary, because the vocabulary is what has to
match.

**Whatever seizes a display claims it, and the claim lives with the placement.** The issue
proposes that `screen.mjs` hand back the lock name beside the window position. Handing back a
name does not stop anyone forgetting to use it, so `screen.mjs` **claims and returns**:
`takeLeftScreen(owner)` gives back the window arguments *and* the hold, installs its own exit
and signal handlers, and `leftWindowArgs` / `leftWindowPos` / `placeElectronLeft` **throw** if
this process does not hold the screen. `leftmostScreen()` stays free — it is geometry, not
placement. This is the `github#8` move applied literally rather than by analogy.

**A transitional alias, matching the sister's exactly**: a `screen-*` acquire waits on a live
`record`, and `record` waits on any live screen. It is coarse on purpose — `record` never said
which display it meant — and it is deleted when the sister deletes theirs.

**`--no-lock` names the suite lock only.** It exists for a parent that already holds `suite`
(the hook, `release.ps1`); no parent ever holds a screen, so a run claims the display it is
about to park a window on either way.

**A hold is refreshed by the process that holds it** (`github#25`). `lock.mjs` wrote
`pid: process.pid` and then exited, so the recorded pid was dead within a second and a crashed
holder was byte-for-byte indistinguishable from a healthy five-minute run. Now an in-process
holder writes `holder: "process"` with its own live pid and refreshes `at` every 30 seconds;
`since` keeps the original acquire time. A hold whose named process is gone is broken at once
rather than waited out, and a holder that discovers the lock is no longer its own says so.
The CLI writes `holder: "cli"` and **no pid at all**, because nothing it can write would still
be true a second later.

**The suite aborts when it loses its lock.** Everything measured after the loss was measured on
a contended machine, so the run stops rather than publishing it — browsers down, holder named,
non-zero exit, no tree stamp.

## What this had to interoperate with

The sister reads only `owner` and `at`, with a bare `JSON.parse`, and treats a parse failure as
age `Infinity` — stale, and therefore breakable. Two consequences that shaped the code:

- **Meta is written atomically** (temp file, then rename). A heartbeat over a truncate-and-write
  would hand the sister a half-written file at random and invite it to break a live lock.
- **Refreshing `at` needs nothing from them.** Their staleness check becomes a liveness check
  for free: a live Vault Shelf hold now looks seconds old to a Vault Graph acquire instead of
  half an hour old, which is exactly the fault `github#25` reported — a hold aged past the
  window during screenshot work and the sister's `pre-push develop` broke it mid-run.
- **The stale windows stay 20 and 30 minutes.** Liveness would allow minutes, but the sister's
  own holds do not heartbeat, so a shorter window here would break *their* live runs. Shortening
  waits on both sides heartbeating. *(Revisited 2026-09-12 — see below. The windows stay, and
  the sister is no longer the reason: shortening them breaks live holders here too.)*

`vault-graph#87` merged into their `develop` (`a3e49e7`) while this was being planned, which is
why the first shape of this change is not the shape that landed — see the alternatives.

## Alternatives weighed

| Option | Why not |
|---|---|
| **Hand back the lock name, as the issue suggests** | It removes the excuse, not the mistake. `leftWindowArgs()` would still answer anyone who called it, and the four harnesses that place a window today are proof that the thing people forget is the second call, not the first. |
| **A companion `record` hold alongside every screen claim** | Chosen first, then dropped, and the reason is worth keeping: it was priced against a sister that had no alias, where it closed the last open direction at no cost. `vault-graph#87` merged thirty minutes later, their alias closed that direction from their side, and the same mechanism became pure cost — their `record-demo.ps1` takes `screen-right` itself and their alias makes a right-screen take wait on any live `record`, so a companion hold here would block every right-screen recording for the length of every left-screen harness run. Two transitional mechanisms to remember to delete instead of one. |
| **Rename to `screen-*` with no alias at all** | A rename that only works once both sides have landed is a rename that breaks the machine in between. Measured: with no alias, a Vault Graph `record` hold and a Vault Shelf `screen-left` acquire pass straight through each other. |
| **Keep `record`, and document that harnesses should take it** | It is the arrangement that produced this issue. `record` could only ever serialise a recording against another recording; a harness would not think to take it and would be right not to. |
| **One `screen` lock rather than three** | It would serialise a left-screen harness against a right-screen recording for nothing, which is the over-blocking the resource naming exists to avoid. Measured as preserved: `screen-right` and `screen-left` do not block each other, in either direction, across the two repos. |
| **A detached heartbeat for CLI holds too** | It would not have fixed the case `github#25` actually reported — an agent's per-command shell dies immediately, so there is no parent to beat for. It buys a background process per acquire, ppid semantics that differ per shell, and a new class of leaked-process bug inside the one mutex six worktrees depend on. |

## Consequences

- **The three manual harnesses `CLAUDE.md` calls "suite-lock jobs" finally are one.** They took
  no lock at all before; they now contend with the suite for the display, which is what the
  documentation already claimed.
- A blocked harness names the holder and gives up **before it builds a page**, rather than after.
  `--lock-timeout-ms` sets how long it waits, as it already did for the suite.
- Calling `leftWindowArgs()` without claiming is now a thrown error rather than a silent second
  window on somebody's screen. Any future harness gets the answer at the first run.
- `lock.mjs` is a module with a CLI rather than a CLI only. `acquire()` returns a hold; the
  command line is a wrapper over the same code, and its output is unchanged.
- The alias and the legacy `record` name are **transitional**. Delete both when the sister repo
  drops its own alias; nothing else in this repo refers to `record`.


## Amendment, 2026-09-12 — the hold follows the run, and the window is left where it is

`github#25` asked for three things. Two landed above. What was left is the half the issue's
title is actually about, and the third ask.

### A CLI hold beats while a run is under it

The decision above gives a hold taken from the command line no liveness at all, on the
reasoning in the detached-heartbeat row — an agent's per-command shell dies immediately, so
there is no parent to beat for. That reasoning holds. What it missed is that **the two gated
runs are CLI holds with a live process sitting under them**: `.githooks/pre-push` and
`release.ps1` both acquire `suite` from the command line and then run `smoke.mjs --no-lock`. So
for the length of the run whose numbers stamp a tree, the hold's age was frozen at the acquire
and nothing would have noticed it being broken — the two faults the issue names, on the one path
where the numbers matter most.

`--no-lock` no longer means *ignore the lock*; it means **adopt the caller's hold**. The run
rewrites the meta to name its own live pid, beats it under **the caller's own owner** — so the
parent's `release` still matches — and on the way out puts `holder: "cli"` back and leaves the
directory standing, because the caller still owns the release. A `--no-lock` run with nothing
holding the lock now refuses to start rather than measuring on an unguarded machine.

A *bare* CLI hold, with no run under it, still gets no beat. What it gets instead is a way to
say it is still there: `node scripts/lock.mjs refresh <name> --owner <id>` — the issue's own "a
heartbeat the holder refreshes" — and `status` now prints how long every hold has left. That is
the case the issue was actually filed about: an agent claiming `screen-left` to drive a window
by hand across screenshots and reruns, whose hold aged past the window while it was still
working.

### The stale windows stay at 30 and 20, and that is an answer

The third ask was to reconsider the 30-minute window "once liveness exists: with a heartbeat,
staleness can be minutes instead of half an hour, and a live holder is never broken." Both
halves of that sentence were taken seriously and they turn out to point in opposite directions.

A shorter window was built first, and carefully: staleness asked of the **hold** rather than of
the **name**, so a hold declaring `holder: "process"` went stale after 5 minutes while a bare
CLI hold and everything the sister repo writes kept their 30 and 20. Nothing the sister wrote
would ever have been measured against a window it did not agree to, which is what made the
original deferral look unnecessary.

**It broke a live holder within the hour, and the measurement is the reason it is not here.**
Verifying this ticket, a `--only` run printed
`BREAKING stale screen-left lock (age 301s, owner github#41 drive (after))` — a hold naming a
**live** process (the dead-pid branch prints something else and runs first), broken by the
five-minute window while its worktree was still using the screen. That is precisely the fault
the issue reports, reintroduced by the fix for it.

The cause is not a wedge and not bad luck. **A live holder is not always a talking one.**
`smoke.mjs` generates its fixtures and builds its page with `spawnSync`, which blocks its own
event loop — and therefore its own beat — for as long as the child runs. A weekly fixture
regeneration is minutes of that. Any window short enough to be worth calling short is short
enough to break those runs.

So liveness **replaces** the question the window was standing in for rather than shrinking it:

- a **dead** holder is broken in milliseconds by the pid check, not waited out — which is the
  whole of what the 30 minutes was ever protecting against in practice;
- a **live** holder is never broken by the clock, however long it has held and however long it
  has been silent — which is the issue's own second half, met exactly;
- the window stays as the **backstop** for what liveness cannot see: a wedged process, a
  recycled pid, a hold in the sister's shape that nobody can vouch for.

### A harness that loses the display says so

`takeLeftScreen` passed no `onLost`, so each of the five harnesses that park a window could lose
`screen-left` mid-run and finish as though nothing had happened — the same fault the suite
already guarded against for `suite`. It now names who took it and stops.

### And the lock has a check that can fail

Its behaviour was a hand-measured table in `invariants.md`, which is not a thing that fails on a
push. `node scripts/lock.mjs --selftest` is **25 cases against a throwaway root**
(`VAULT_LOCKS_HOME`, so never the live mutex), and the pre-push hook runs it beside the
update-note selftest — 1.0 s.

| Option | Why not |
|---|---|
| **Shorten the stale windows, per name** | Breaks the sister's live holds, which do not beat. The original deferral was right about this and it has not changed: read today, `vault-graph`'s `lock.mjs` still has no heartbeat. |
| **Shorten them per hold, for holds that declare they beat** | Built, then measured breaking a live in-process holder at 301 s, because `spawnSync` blocks the beat. Reverted. A window that only fires on a holder nobody can hear is a window that fires on a holder who is busy. |
| **Beat an adopted hold under the adopter's own owner** | `releaseNamed` refuses an owner that does not match, so the parent's own `release` would print `REFUSED` and the lock would stay held for its whole window — a leak introduced by the fix for a leak. |
| **Have the hook acquire in-process instead** | It is a shell script; the acquire has to outlive the command that makes it. That is what `holder: "cli"` is for. |
| **A worker thread to beat through a blocked event loop** | It would make a short window safe, at the price of a thread inside the one mutex six worktrees depend on, and it buys only the wedged-holder case that the backstop already covers. Worth revisiting if a wedge is ever actually seen. |
| **Leave `--no-lock` alone and document the gap** | It is the arrangement that produced the issue. The gap is invisible from inside the run, which is the only place anyone would look. |
