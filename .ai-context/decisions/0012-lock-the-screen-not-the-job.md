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
  waits on both sides heartbeating. *(Amended 2026-09-12 — see below. The window is now asked of
  the hold rather than of the name, which needed nothing from the sister at all.)*

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

## Amendment, 2026-09-12 — the hold follows the run, and the window follows the hold

`github#25` asked for three things. Two landed above. The third — *"reconsider the 30-minute
window once liveness exists"* — was deferred to a sister repo that still, read today, has no
heartbeat at all. And the half of the first ask that the issue's title is actually about was
left standing: **a hold taken from the command line has no liveness of any kind**, and the two
runs that take it that way are the *gated* ones. `.githooks/pre-push` and `release.ps1` both
acquire `suite` from the command line and then run `smoke.mjs --no-lock`, so for the length of
the run whose numbers stamp a tree, the hold's age was frozen at the acquire time and nothing
would have noticed it being broken.

**A CLI hold beats while a run is under it.** `--no-lock` no longer means *ignore the lock*; it
means *adopt the caller's hold*. The run rewrites the meta to name its own live pid, beats it
under **the caller's own owner** — so the parent's `release` still matches — and on the way out
puts `holder: "cli"` back and leaves the directory standing, because the caller still owns the
release. A `--no-lock` run with nothing holding the lock now refuses to start rather than
measuring on an unguarded machine.

This keeps the table above intact: a *bare* CLI hold, with no run under it, still gets no
liveness, for exactly the reasons the detached-heartbeat row gives. What changed is that the
case that actually bites always has a live process available — it just was not being asked.

**Staleness becomes a property of the hold rather than of the name.** A hold that declares
`holder: "process"` is stale after **5 minutes**; anything that does not — a bare CLI hold, and
every hold the sister repo writes — keeps its name's 30 or 20. So the window shortens where
liveness exists and nowhere else, and nothing the sister writes is ever measured against a
window it did not agree to. That is what made the deferral unnecessary: the answer needed
nothing from them.

**Five minutes, not two.** The beat is a 30-second `setInterval` on an unref'd timer, so a long
synchronous stretch inside a run can legitimately delay it. Ten missed beats is a wide margin
and still six times better than half an hour. A *dead* holder is already broken in milliseconds
by the pid check, so this window only ever catches a **wedged** one, which is rare and cheap to
wait five minutes for.

**A harness that loses the display says so.** `takeLeftScreen` passed no `onLost`, so each of
the five harnesses that park a window could lose `screen-left` mid-run and finish as though
nothing had happened — the same fault the suite already guarded against for `suite`. It now
names who took it and stops.

**And the lock has a selftest.** Until now its behaviour was hand-measured into a table in
`invariants.md`, which is not a thing that can fail on a push. `node scripts/lock.mjs --selftest`
is 19 cases against a throwaway root (`VAULT_LOCKS_HOME`), never the live mutex, and the
pre-push hook runs it beside the update-note one.

| Option | Why not |
|---|---|
| **Shorten `STALE_MS` outright** | It is the mirror image of the bug being fixed: the sister's holds do not beat, so every one of their live runs becomes breakable at five minutes. The deferral in the original decision was right about this. |
| **Beat an adopted hold under the adopter's own owner** | `releaseNamed` refuses an owner that does not match, so the hook's own `release` would print `REFUSED` and the lock would stay held for its whole stale window — a leak introduced by the fix for a leak. |
| **Have the hook acquire in-process instead** | It is a shell script; the acquire has to outlive the command that makes it. That is what `holder: "cli"` is for. |
| **Leave `--no-lock` alone and document the gap** | It is the arrangement that produced the issue. The gap is invisible from inside the run, which is the only place anyone would look. |
