# 0013 — Two Chromes is a ceiling, and a check says which shapes it needs

**Date** 2026-09-11 · **Status** accepted · **Issue** [#39](https://github.com/luke321/vault-shelf/issues/39)

## Context

Three things arrived together, and only the first was asked for.

**Four Chromes at once is more load than one machine has.** `JOBS` defaulted to 4, and each job
is its own browser with its own port and its own grid slot, so a plain run opened four. Six
worktrees may be live here (`CLAUDE.md`'s cap), and before `decisions/0011` nothing stopped two
suites running at once — four browsers per run, several runs deep. The sister repo's machine
**hard-restarted from resource exhaustion** in exactly that state, and `vault-graph#110` answered
by deleting its parallel shard outright: not `--jobs 1` by default, the mechanism removed, so no
flag could bring it back.

**Nearly every check ran against every shape, and most of them do not have a shape.** 89 checks
over three fixtures is 267 runs. But `core.stampOf` handed three literal timestamps, `migrate()`
handed a literal schema-1 blob, the twelve colour slots, every dropdown, every control's height
in every look — none of those reads the vault at all. Two checks were worse than redundant: `a
wide table scrolls inside the page` and `a wikilink in a book goes to that note` look for notes
only `make-demo-vault.mjs` writes, so on the other two shapes they returned *"nothing to
assert"* and passed. The suite was paying for them anyway.

**The measurement that reframed the ticket.** A full run was **78 s** of wall for **75 s** of
check time across **15 browsers** — so almost none of the cost was the checks running in
parallel; it was launching Chrome, loading a 760 KB to 3.3 MB page and rendering a library,
fifteen times.

**And capping the lanes, on its own, is slower.** On the unchanged runner with the lock free,
`--jobs 4` is **78 s** and `--jobs 2` is **90 s**. The cap costs **+12 s**; it buys safety, not
speed, and the first pair of numbers taken for this ticket said the opposite only because both
runs had waited on another worktree's suite and the clock was outside the lock. The runner times
itself now, after the lock, so that mistake is not available.

**Serialising exposed a real bug, as it had next door.** At `--jobs 2` the suite failed on all
three shapes: `shelf wear is recorded and drawn` asserts it starts from an unworn library, which
is true only of whichever shard runs it first. Wear is cumulative and every check that opens a
book adds some. Round-robin sharding means *which* checks share a page depends on `JOBS`: at
four lanes `a book with several ribbons in it` landed elsewhere, at two it lands immediately
before and leaves the Encyclopedia spine worn. `vault-graph#112` is the same shape — a check
that leaves something behind and a neighbour that inherits it.

## Decision

**Two lanes, and two is a ceiling rather than a default.** `LANE_CAP = 2`; `--jobs` clamps to it
and says so on the run. It is deliberately *not* the sister repo's answer of one:

- our serial lane is **25 of 89** checks, not the majority, so a second lane still has most of
  the suite to work on;
- our pages are lighter — a shelf library, not a force-directed graph settling under simulation;
- and the machine-wide `suite` lock (`decisions/0011`) now allows **one suite at a time**, which
  is the guard that did not exist when four became dangerous. Two lanes inside one lock is
  bounded; four lanes times six worktrees was not.

`--jobs 1` remains the quiet run, and is what to use beside a recording or a film.

**A check declares which shapes it needs, and the default is all of them.** `check(name, fn, {
on })` — `"demo"` for one shape, a list of fixture names for some, absent or `"all"` for every
one. The default is the safe direction on purpose, and this is the one place this repo departs
from `vault-graph#113`, which made demo-only the default. The law here is that a check is never
deleted to make the suite faster and that one which stops running needs its own argument; a
**forgotten annotation must therefore cost time, not coverage**. Narrowing is the deliberate
act. 61 checks are narrowed, 28 keep all three shapes, and `on` is validated against
`FIXTURE_NAMES` so a typo fails the run by name instead of quietly running nowhere.

**A lane is only opened when there is work to fill it.** A browser costs about five seconds
before it checks anything, so splitting a handful of fast checks across two of them loses. A
shape gets a second lane only past `MIN_PER_LANE = 32` steady checks, which after the audit only
the demo vault has.

**A check that returns with the page still moving fails, and says what it left.** The runner
asks the page, after every check, whether anything is in flight: `settleRoom`'s coalescing 60 ms
timer (`roomLog.pending`, added to the existing room diagnostic for this), a drag still in the
air, a reader or sheet left open. The check that left it is the one that fails — not the
innocent one that trips over it next — and the runner then settles the page so the next check
starts clean.

## Consequences

The suite keeps every check it had. 267 runs become 146; 15 browsers become 7.

**What this gives up.** Sixty-one checks now prove themselves against one shape. If one of them
*is* shape-sensitive in a way this audit misread, the suite will no longer say so. Two things
hold the line: `the shelves are packed the way the golden snapshot says` still runs per fixture
in all three looks, so shape-specific packing and look drift are still caught everywhere; and
the Laws — membership, addresses, dates, the query, the plaques, the network — are all in the
28 that kept every shape. The narrowing is reversible one word at a time, and `--vault` runs
everything regardless, which is the escape hatch when a shape is under suspicion.

**What it does not change.** The serial lane stays serial: `POINTER_DRIVEN` exists because a
contended GPU makes a frame time or a laid-out box measure the other windows instead of the
code, and that is not about how many lanes there are. The suite still takes its own lock, still
stamps only a full clean run, and still names the fixture a failed generator cost it.

## Rejected

**One Chrome, the sister repo's answer.** It is the right answer *there*: `vault-graph#110`'s
serial lane was the majority of its suite, so the shard bought little, and its pages settle a
simulation. Here it would give up the second lane for load we have already bounded another way.
Recorded so the difference is a decision rather than drift.

**Keeping four and auditing only the fixtures.** This would be *faster* — the cap is the one
change here that costs time (78 s to 90 s before the audit). It is refused because the crash
next door was not hypothetical and the load it took is the load six of these worktrees can
still produce. The audit then takes 90 s to 41-43 s — about four times what the cap cost — so the pair
is a large net win; the ticket asked for both.

**A page-side "no animation" mode**, which is how `vault-graph#113` bought most of its time.
Nothing here waits out a cascade: the slowest checks are a contents scroll, a frame-time probe
and a walk of every box in every look, and none of them is waiting on an animation clock we
could turn up. There was nothing to buy.
