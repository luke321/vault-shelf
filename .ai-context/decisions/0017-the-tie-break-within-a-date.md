# 0017 — Notes sharing a date read A-Z, and the reading order does not reach the tie-break

**Date** 2026-09-15 · **Status** accepted · **Issue** [#80](https://github.com/luke321/vault-shelf/issues/80)

## Context

`A book opens on its oldest note` is a Law, and **Oldest first** is the default contents index for
every date shelf. So the order this record is about is the one most readers see most of the time.

Nothing had ever decided what happens when two notes share a date — and on a day-granularity date,
they share it constantly. In the one vault, **3,327 of 4,408 dated notes** sit in a group of two or
more on the same day: three quarters of everything dated, in **802 groups**. Daily notes make it
sharpest, because everything written on one day is a single same-date group by construction.

What the reader actually got was **reverse alphabetical**, from one character:

```ts
: (a, b) => (order === "newest" ? 1 : -1) * byDateThenTitle(a, b);   // shelves.ts:429
```

`byDateThenTitle` was written newest-first — date descending, then title **ascending** — and the
`-1` for the oldest-first default negated the **whole comparator**. The date axis came out
ascending, which was the intent. The title tie-break came out descending, which was not. Within a
day the order was neither chronological (the dates are equal) nor alphabetical; it was A-Z
backwards, which reads as scrambled rather than as a choice.

**Why nothing caught it.** The suite asserted that a book *opens on* its oldest note, and that
ordering is stable across a rebuild. Both were true the whole time. No check asserted what should
happen between equal dates, because no decision existed for a check to encode. This is the gap this
record closes: the bug is downstream of the missing decision, not of the missing check.

## Decision

**Within an equal date, notes read A-Z by title — in both reading directions.** The oldest/newest
control names the *date* axis, and governs that axis only.

Two details are part of the decision rather than incidental to it:

- **A-Z means the same A-Z the contents index means**: case-insensitive, sharing one comparison
  with the A-Z index. The old tie-break compared titles raw, so `Zebra` sorted before `apple`. A
  Date index whose sub-order the A-Z index would itself disagree with is not A-Z.
- **The direction is applied to the date key, not to the comparator's result.** The tie-break is no
  longer reachable by the sign, so this class of bug is removed rather than corrected.

## Consequences

**Newest-first is no longer a perfect reversal of oldest-first.** A day's notes read A-Z in both.
This is the deliberate trade, and the alternative is exactly this bug seen from the other end: a
reader who flips the control to see the other end of a book would find each day internally
re-shuffled, when all they asked for was to start from the other end.

**The repo was already holding this position in two other places**, which is what makes it
consistent rather than new. `byTitleThenDate` (A-Z mode) and `byNumberThenTitle` (number mode,
`design/0035`) are both returned **unflipped** by `readingOrder`; only date mode was negated whole.
The control governing one axis is the existing rule — date mode was the outlier.

**Undated notes are untouched by this.** A `null` date sorts as `""`, so Undated leads under
oldest-first and trails under newest-first, exactly as before. Where they belong is a separate
question this record does not answer, and moving them would have changed what readers see for a
reason #80 never raised.

`decisions/0007` puts the reasoning here rather than in the source, so the two-line comment that
used to explain the flip is now one pointer and the argument lives above.

## Rejected

**Mirror the whole order, i.e. keep today's behaviour and call it designed.** The charitable
reading is "newest-first is oldest-first backwards, so everything reverses." That is coherent for
the date axis and wrong for the tie-break, because the tie-break is what happens when the date axis
has *nothing to say*. Reversing it makes one control silently govern a second thing it never
claimed to, and the measured result is three quarters of the vault in an order the reader cannot
predict from anything on the page.

**Order by path, filename, or position on disk.** Stable, and invisible. It is an inference from
something the reader never declared — against `Metadata is declared, never inferred`
(`decisions/0003`) — and it does not survive a rename.

**Fall back to time of day within the date.** The most tempting of the three, and it fails on a
point `decisions/0003` already settled: a date resolved from a **property** or from the **title**
has no time of day at all, so this would order declared-date notes by whenever the file happened to
be touched — inference beating declaration, which is the one thing the metadata law forbids.
`invariants.md` already carries the measurement that finishes it off: all 545 files of the author's
own vault stamped inside a single four-month window, because the vault was moved onto the machine
in June. It would also make a book's order change when the vault is copied.
