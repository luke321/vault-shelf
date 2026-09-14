# 0016 — The runner drains the room before it blames a check

**Date** 2026-09-14 · **Status** accepted · **Issue** [#57](https://github.com/luke321/vault-shelf/issues/57), [#69](https://github.com/luke321/vault-shelf/issues/69)

## Context

`decisions/0013` gave the suite a rule that has already paid for itself: **a check that returns
with the page still moving fails, and says what it left.** It is the rule that caught a stray
`DEL` byte's worth of class of defect — a check quietly reading a page mid-repack and calling it
a measurement.

Within three days of `github#55` making a stamp need **two** consecutive green runs, that law
caught something on its first use, and it was not a defect in the page.

**The measurement, on the same tree, two consecutive runs.** `"the room has a width, however
wide the window is"` on `develop` at `42b0ce6`:

```
run 1  ok    shelves 1180 (683/698), rail 1180, row 1180, spread 1084 (738/738);
             10 rows in all, months taking 4, worst overflow 0px
run 2  FAIL  ... identical numbers ...
             -- LEFT THE PAGE BUSY: a pending room measure (settleRoom's 60ms timer)
```

**Every measured value is identical, and every one of them is right.** The only difference is
that the second run returned while `settleRoom`'s 60 ms coalescing timer was still pending.

Reproduced here on the branch, before any change: **2 failures in 14 runs** at `--jobs 1` with
all 24 cores under synthetic load; **0 in 14** on the same tree idle. The check resizes the
viewport to 2560px to prove the room is capped by `--measure`, then waits `sleep(250)` — 250 ms
of *Node* wall clock — for a 60 ms *page* timer. On an idle machine the read alone outlasts the
timer. Under load the Node process is starved, the resize is dispatched late, and the sleep
expires first. **A single run was a coin toss; a stamp that needs two greens flips it twice.**

**Then a second check was caught the same way.** `github#69` — `"a lifted spine is painted whole,
in every look"` going red at `--jobs 1` on a clean `origin/develop`, 93 of 94, reported by the
`github#32` worker while baselining its own branch. One instance reads as a check that needs
correcting. **Two on unrelated checks reads as the runner missing a guarantee.**

## The decision

**A pending room measure is waited out by the runner. Everything else atRest() names still fails
the check that left it.**

`settleRoom`'s timer is the **only** item in `atRest()` that drains on its own: it is a
`setTimeout` scheduled by the browser's own resize handler, it always fires, and nothing
downstream is harmed once it has. Every other item — a sheet left open, a drag still in the air,
an edge scroll running, an overscroll band held — is state a check has to clear itself, and
those are what `decisions/0013` was written to catch. They are untouched.

So the runner calls `settled(page)` after a check returns and **before** `atRest()` judges. The
rule is not dropped; it is aimed.

**It waits inside the page, on the page's own timers.** This is the part that matters, and it is
why the fix is not a longer sleep in a new hat. A Node-side `sleep` is wall clock on a process
the machine is free to starve — which is the failure itself. The page's `setTimeout` is the same
clock `settleRoom` is coalescing into, so the waiter and the thing it waits for cannot drift
apart under load.

**Quiet is five consecutive reads, not one.** A resize event Chrome has not dispatched yet reads
`pending === 0` and sets it a tick later; one look at zero proves nothing. Five reads 20 ms apart
is the pattern the `github#32` worker arrived at independently for its own index-rail check,
which is corroboration rather than invention.

**Three seconds is the budget** (`SETTLE_MS`) — fifty of the 60 ms timer, and under `cdp.mjs`'s
10 s reply timeout. A budget that long is only ever *spent* by a room measure that is
rescheduling itself, which is a real defect: `atRest()` then fails the check exactly as before,
and now says `(still there after 3000ms)` so the two are told apart in the log.

**One mechanism, every call site.** `settled()` is used in three places by the runner — after
each check before judging, inside `settlePage()` in place of its `await sleep(90)` (a fixed sleep
past a 60 ms timer: the same bug, in the recovery path), and once before the first check of a run
so the page load's own resizes are drained too. Two helpers wrap it for checks: `viewport()`
(set the override, dispatch the resize CDP does not reliably deliver, wait for the page's own
`innerWidth`/`innerHeight` to agree *and* the repack to drain) and `unviewport()` (clear it and
come back). **All seven checks that drove `Emulation.setDeviceMetricsOverride` by hand now go
through them**, which answers `github#57`'s own closing question — the exposure was never
particular to the one check that got caught.

**And the guarantee has a check.** `"a draining room measure is waited out, and nothing else is"`
returns with the timer deliberately just scheduled, so if the runner ever stops draining it that
check is the one that goes red, with the very words `github#57` was filed over. In the same
breath it asks `atRest()` directly whether an open sheet is still named, so the exemption can
never widen into the rule without a check failing. **Verified both ways:** it passes on this
tree, and with the drain removed it fails with `LEFT THE PAGE BUSY: a pending room measure`.

## Rejected

**Lengthening the sleep.** `sleep(250)` → `sleep(500)` turns a coin toss into a longer coin toss:
it moves the cliff rather than removing it, and the next contended machine finds the new edge.
This is the argument `github#55` made about margins and `github#51` made about lifts, and it is
the one the issue itself opens with.

**Widening a tolerance, anywhere.** Nothing measured was wrong. There is no number here to
loosen that would not also stop the checks catching what they exist to catch — `github#69` says
this most sharply: a pixel tolerance wide enough to stop that flake is wide enough to miss the
6-7px slice the check was written for.

**Exempting these checks from the busy-page rule.** That rule is what *found* both of these. An
exemption is the one change guaranteed to stop the next one being found.

**Fixing it in each check instead.** Two checks caught in three days, seven checks driving the
viewport by hand, and three private copies of the same stability loop already in the file — a
third correction would have been the third of an unbounded series.

## Consequences

`"the room has a width, however wide the window is"`: **0 failures in 12 runs** under the same
24-core load that produced 2 in 14 before. Idle, unchanged.

**The suite pays about 80 ms per check** in the quiet case — five reads 20 ms apart, in one CDP
round trip. Against a run that takes 41-43 s over 146 check runs that is real but small, and it
buys the difference between a stamp that means something and a stamp that is a coin toss twice.
Several converted checks got *faster*, because a `sleep(400)` or `sleep(250)` sized for the worst
case now returns as soon as the page actually agrees.

**What is not claimed.** `github#69` **did not reproduce here** — 29 runs at `--jobs 1` under
full load, in isolation and immediately after its neighbour, all green. Its shared mechanism with
`github#57` is removed, and the runner now guarantees it a page at rest both before it starts and
when it returns. Whether that was *its* mechanism is unproven. If it recurs, the next place to
look is the compositor read inside `paintedAbove()` — `Page.captureScreenshot` returning a frame
that predates the style change despite the double `requestAnimationFrame` — and **not** a
tolerance. That check's pixel logic, thresholds and assertions are deliberately untouched here.
