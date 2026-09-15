# 0017 — A smoothness budget counts frames, and proves it can still see one

**Date** 2026-09-15 · **Status** accepted · **Issue** [#77](https://github.com/luke321/vault-shelf/issues/77)

## Context

Two checks measured how smoothly something scrolls — `"scrolling the library stays smooth in
every look"` and `"a wheel on the spread stays smooth in every look"` — and both asserted the
same thing: the **95th percentile of the interval between animation frames**, under **34ms**.

That number is not measurable at 34ms. The interval between `requestAnimationFrame` callbacks
can only be a whole number of vsyncs, so the intervals arrive in clusters. Measured across
5,387 frames on this machine, on `develop` at `a2de7fa`:

| | frames | ms |
|---|---|---|
| 1 × vsync | 5185 | 16.9 – 26.0 |
| 2 × vsync | 119 | 26.5 – **37.1** |
| 3 × vsync | 42 | 51.6 – 54.2 |

**Nothing at all was observed between 26.0 and 26.5.** The 34ms budget fell inside the
two-vsync cluster, so one dropped frame — the same physical event — read 34.2 and passed or
34.7 and failed. Five runs of the library check through the real runner on a clean tree were
**red four times**:

```
leather 17.6/52.2/89  modern 17.7/18.3/19  cyber 17.5/35.4/139   FAIL
leather 17.8/53.6/90  modern 17.6/18.5/19  cyber 17.6/35.2/70    FAIL
leather 17.6/18.8/71  modern 17.6/18.3/19  cyber 17.7/18.4/69    ok
leather 17.7/35.6/87  modern 17.6/18.3/19  cyber 17.6/52.7/89    FAIL
leather 17.6/18.4/72  modern 17.6/18.3/19  cyber 17.6/35.7/89    FAIL
```

Two things made it worse. **The percentile index was derived from the sample size**, and a
slower run paints fewer frames in a fixed window, so the index moved down the tail exactly when
the jank arrived (n fell 80 → 62). And **the sweep covered the whole room in a fixed 1400ms**,
so its velocity — and therefore the paint per frame — depended on how tall a room the preceding
checks happened to leave behind: 231 spines over 1494px under `--only`, 227 over 1102px in a
full suite, a 36% difference in speed for no reason to do with the code.

The damage is to the gate rather than to anybody reading: `cyber` is shelved and unreachable,
and leather's worst frames are real but rare. But under `decisions/0010` **two greens in a row
stamp a tree**, and the pre-push hook and `release.ps1` then skip the suite entirely, so a check
green about half the time converts *by retrying* into a permanent pass. That had already
happened to tree `0989b3e`.

## Decision

**A smoothness check asserts a count of missed vsyncs, and the library one also proves, in the
same run, that the count can still see the regression it exists to catch.**

Three parts, all in `scripts/smoke.mjs`; `FRAME_HELPERS` holds the page side and
`frameGaps` / `framePeriod` / `frameStats` / `frameSteady` the node side, shared by both checks.

1. **The number is `missed`** — the frames that should have arrived, less the ones that did:
   `round(elapsed / vsync) - painted`. There is **no per-frame threshold anywhere in it**, so
   there is no cluster edge for a value to fall either side of, and no percentile index for a
   sample size to move. One dropped frame is one, and a 67ms frame is three.
2. **The vsync is calibrated, never read off the measurement being judged.** Taken off the
   sweep it is circular — a run that drops three frames in four has no single-vsync interval
   left to find, so the period reads long, the frames expected read few, and the worst run in
   the suite scores best. Measured at exactly that: containment taken off painted 15 frames
   where it should have painted 80 and scored **2 missed**. It is calibrated by nudging the
   scroller one pixel per frame, and only after a throwaway pass, for reasons the next section
   records. A period outside 6–26ms fails the check as a fact about the machine, said
   separately from the budget.
3. **The sweep runs at a fixed velocity — 800px/s, turned round at either end** — so the pixels
   crossed per frame are the same number whatever the preceding checks left on the page.
4. **The library check runs the room again with `design/0014` taken back off it** — containment
   off, the compositor layer gone — and **fails if that does not go over the budget**. #77's
   closing line was "before trusting this check as a performance gate, change something known
   to be expensive and confirm the number moves; if it does not, the budget is decorative."
   That is now an assertion rather than a note.

Budget **14 missed vsyncs**, of the ~80 a 1.4s sweep offers. Measured, six runs:

| | missed |
|---|---|
| shipped, leather / modern / cyber | **0–1 / 0–1 / 0–3** |
| the same room with `design/0014` off it | **59–66** |

The budget sits in the empty gap between 3 and 59, which is the whole point: the old one sat
inside a cluster with observations on both sides of it.

## What the probe had to be, and what it could not be

**#77's own A/B chose a slowdown that costs nothing, and that is most of why the check looked
insensitive.** Four candidates were driven against the same room before one was picked:

| slowdown | missed |
|---|---|
| a filter over every spine (blur, drop-shadow, saturate, contrast on 231 of them) | 2 |
| a 2px blur over the whole library | 3 |
| a 40px/20px shadow spread on every spine | 2 |
| a 12ms busy-wait inside every frame callback | 1 |
| `backdrop-filter: blur(8px)` on every spine | 14 |
| **`design/0014` off: containment and the compositor layer** | **61** |
| nothing at all, for comparison | 2 |

A scroll composites tiles that are **already rasterised**, so per-spine paint does not enter a
frame at all until containment is what changes. A filter on a spine is therefore free during a
scroll however expensive it looks, and 12ms of busy-wait fits inside a 17ms frame and drops
nothing — correctly. Only taking `design/0014` off puts every visible spine back to being
rasterised per step, which is the state that record measured at leather 117ms and cyber 400ms
at the 95th percentile.

So the probe is the real regression, not an invented cost. That is worth having for its own
sake: it means the check cannot pass while blind to the one optimisation the room depends on.

**The wheel check gets the metric and no probe.** There is no known-expensive change to a
reader page that has been measured here, and inventing one would assert something nobody has
established. Its budget is held at the same 14 rather than tightened, and `invariants.md` says
plainly that it is unproven — an honest gap beats a decorative proof.

## Two things the calibration cost, both measured

- **A still page is not painted at all.** A plain `requestAnimationFrame` loop over a page with
  nothing changing on it returned **two frames in 400ms**, and the period read 396–413ms — in
  three runs of five, which then failed the check for the right reason with the wrong number.
- **A creep is not a change.** Calibrating against a 40px/s sweep was worse, not better: at
  under a pixel a frame the integer scroll offset does not change, nothing is invalidated, and
  the frames stop again — 446–536ms, **six runs of six**. A whole pixel per frame, after a
  throwaway pass has frames flowing, reads 17.4–17.8ms every time.

Both are recorded because both look like a working calibration from the outside. The first
version of this change shipped neither and would have scored a catastrophically slow page as
the smoothest in the suite.

## Alternatives weighed

| Option | Why not |
|---|---|
| **Move the budget between clusters** (say 45ms) | Still a percentile, still throws away every sample but one order statistic, and still has aggravator two — the index walks down the tail as the run slows. It moves the arbitrary line from the two-vsync boundary to the three-vsync one rather than removing it. |
| **Round each interval to a whole number of vsyncs and sum** | Puts a per-frame threshold straight back inside a cluster: the one-vsync cluster runs 16.9–26.0ms, and `round(26.0 / 16.7)` is 2. The aggregate arithmetic has no such edge. |
| **Assert the worst frame** | #77 is right that a reproducible 67ms worst frame deserves saying, and the count now says it — as three. As an assertion on its own it is one sample, so it is the noisiest number available. |
| **Estimate the vsync from the sweep's own p25** | What the first version did, and what the containment-off probe caught: 15 frames painted of 80, scored 2 missed. A period read off a janky run is not a period. |
| **Assume 16.67ms** | This machine's headless Chrome calibrates at 17.4–17.8, and a fixed constant would have to be re-earned on every machine the suite is ever run on. Calibrating costs 500ms. |
| **Quarantine the check** | `decisions/0010`'s amendment already rejected a by-hand register for the same reason: it is blind to the flake nobody has spotted yet. |
| **Delete the check** | The probe shows there is a real and very large signal here — 61 missed vsyncs against 2. It was the metric that could not see it, not the subject that was not there. |
| **Raise `GREENS_REQUIRED` in `decisions/0010`** | Treats the symptom. A check with a known false-positive rate laundered itself into a stamp at two greens and will do it at three, more slowly; `0010`'s own table says each extra run buys less than the one before. The defect was the metric. |

## Consequences

- Both checks cost more: the library one **8.9s** against 7.8s (the probe sweep and the
  calibration), the wheel one 8.0s. Both are in the serial lane already.
- **`decisions/0010` is untouched by this, deliberately.** The stamp mechanism was never what
  was wrong — a check that is honest about its subject cannot launder itself, however the
  stamp counts. Whether a stamp should be earnable at all by a check with a known
  false-positive rate is a separate question and is left open on #77.
- **Stamps taken on the old check are worth what the old check was worth.** Tree `0989b3e` is
  stamped 2/2 green against a measurement that was red four runs in five. Any stamp on a tree
  predating this change should be dropped by hand — `node scripts/suite-stamp.mjs list` shows
  them — rather than trusted.
- The detail line now prints the count, the frames on offer, the calibrated period, and what
  the probe measured, so a future disagreement has the numbers in the log rather than in a
  rerun.
