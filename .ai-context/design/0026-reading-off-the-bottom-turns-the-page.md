# 0026 — Reading off the bottom of a page turns it

`github#40`. Asked on 2026-09-11: *"infiny scroll, but with a twist you need to push over a
certain resistance then the page blättert um"* — *blättert um* is **turns the leaf**: the physical
flip, not a jump.

Both halves of the spread are `overflow-y: auto`, so reaching the bottom of a note stopped dead.
Nothing said the page had ended or that there was a next one. The third way to turn a page now,
after the arrow keys and the footer buttons (`design/0025`), and the only one that is a
**gesture** rather than a command.

## The measurement that decided the shape

The issue lists *"a short note never overflows, so there is no overscroll to push through"* as one
trap among five. It is not a trap; it is the **dominant case**. Probed over the one vault before
any code was written — 40 books sampled every 17th, 186 notes opened:

| | |
|---|---|
| notes whose right page overflows at all | **27 of 186 — 14.5%** |
| median overscroll slack | **0px** |
| p90 / worst slack | **75px / 487px** |
| left page (the contents) overflows | 9 of 40 books |
| the right page | 814px high in a 1584×961 window |

**85% of notes do not scroll at all.** Every design that requires real overscroll therefore
delivers a gesture that silently does not exist for most of the library, where a reader cannot
tell why it works on one note and not the next.

So: **a page that cannot scroll is already at its limit**, and the push starts on the first notch.
Same threshold, same band, same feel on a three-line note as on a 900px one (D-1).

## The momentum trap, and why the latch is keyed on quiet

A trackpad and a touchscreen keep delivering deltas after the hand has left, so a naive
accumulator turns three pages on one flick. Two mechanisms were available and only one survives
the measurement:

- **Arming on a gesture that ends** — `scrollend`, or a gap between wheel events. `scrollend`
  **never fires on a page that cannot scroll**, so it is unavailable for the 85%.
- **A cooldown after the turn.** A flick's tail outlasts any cooldown short enough to feel
  responsive, and the page then turns twice.

What is used instead: a turn sets a **spent latch**, and the latch clears only after
`PUSH_QUIET` of *silence*. Every notch — absorbed or not — re-arms that timer, so the latch spans
the whole flick however long its tail runs, and a second turn costs a deliberate pause.

**That last clause is the fix for a defect the harness found.** The first version released the
latch as soon as the arriving page was not at its own limit, which is the ordinary case when you
turn onto a long note. A real wheel would then scroll that note to its bottom and turn again — one
flick, two pages. Synthetic wheel events hid it completely, because they do not scroll natively.
The check now drives the arriving page to its own bottom **between every notch** and asserts one
turn across forty of them.

A consequence worth stating: spinning a mouse wheel steadily and fast turns one page and then
refuses until you pause. That is deliberate. *A feed turns because you kept moving; a book turns
because you decided to.*

## Two silences, not one — and the gesture had a speed floor until it had two

The latch and the accumulator were one timer at first, and driving the page with **real** CDP wheel
input rather than synthetic events showed what that cost:

| real wheel input | notches apart | one timer | two timers (D-5) |
|---|---|---|---|
| one hard flick, back to back | 34ms | 1 page | **1 page** |
| a flick with a momentum tail | 44ms | 1 page | **1 page** |
| a steady fast spin | 93ms | 1 page | **1 page** |
| a slow deliberate spin, 12 notches | 229ms | **0 pages, ever** | **3 pages** |

One timer doing both jobs gave the gesture a **speed floor**: notches further apart than the
latch's silence reset the accumulator, so it never reached the threshold and a person scrolling
slowly, one notch at a time, could never turn the page at all however long they kept going. That
is the same class of failure as the 85% short-note case — a gesture that silently does not exist
for some readers.

They are different questions, so they are different numbers now. The **latch** needs only to
outlast a flick's momentum tail; the **accumulator** should hold a push that a person is making
slowly, because that is still one push. Asked rather than decided (D-5).

## The numbers

| | |
|---|---|
| threshold to turn (`PUSH_TURN`) | **240px** |
| the silence that clears the spent latch (`PUSH_QUIET`) | **140ms** |
| the silence that lets a push go (`PUSH_HOLD`) | **600ms** |
| band, mid-book (`PUSH_BAND`) | **26px** at the threshold |
| band, at either end of the book (`PUSH_BAND_END`) | **9px** |
| the band's spring back (`PUSH_SETTLE`) | **180ms** |

240px is between two and three notches of a mouse wheel, which Chrome delivers as 100px each:
**two notches never turn, three always do**, and that is what the check asserts rather than a
feeling about resistance. 140ms is longer than any gap inside a flick's tail (16ms at 60Hz) and
shorter than a deliberate pause. 600ms is long enough to span a slow hand and short enough that a
push is not remembered for ever — a fresh notch after it starts again at 100px, which is checked.

The band and the strip's fill are the same fraction, `min(1, pushAt / PUSH_TURN)`, linear to the
threshold and capped there.

## Which column owns the gesture

**The right page only** (D-3). The left page is the contents; it scrolls on its own and
`github#11` keeps it following the reader. Somebody scrolling a list of things they are about to
click must not turn the page they are reading. The handler is bound **on the right page**, so the
contents is excluded by construction rather than by a test — and the index rail, which is a
sibling of both pages, reaches it either.

## The ends of the book

At the first and last note the push can never give, and *resistance that never gives has to read
as the book ends here, not as a broken gesture*. So the band still gives — **9px, about a third of
its mid-book reach** — and the strip carries the words `The book ends here` instead of a fill that
counts up to nothing (D-4). `Previous` and `Next` are already `disabled` at those ends, so the
refusal is legible twice over, and that is also what a screen reader gets: the strip is
`aria-hidden`, and `#vs-place` remains the `aria-live` announcement of where you are.

`Alt+←` still walks to the previous collection, untouched.

## The keys did not change, and that is the decision

`space`, `PageUp` and `PageDown` scroll the note and never turn it. `design/0025` recorded that
deliberately and it stands unamended (D-2): **the turn is a push past resistance, and a discrete
keypress cannot express a push.** Taking `PageDown` for a turn would also make a long note's last
press ambiguous. The arrow keys keep turning at once, with no resistance to push through, because
they are a command rather than a gesture.

## A turn arrives somewhere — it is not a teleport

`goTo` reset no scroll offset at all before this, so even the arrow keys landed wherever the
browser left the box. It takes an **arrival** now: the **top** going forward, the **bottom** going
back, so the reading motion is continuous in both directions.

**Every way to another note arrives at its top, not just a push.** The issue says `goTo` resets no
offset *"so a turn today does not even reliably start you at the top of the note you turned to"*,
and that is true of all six callers — the contents, the tabs, the ribbons, `Previous`, `Next` and
the arrow keys — plus `openBook`, where the right page kept whatever scroll the last book left on
it. So `"top"` is `goTo`'s default and `openBook` lands there too; only a backward push asks for
`"bottom"`. Checked from a note scrolled to the bottom of its 188px: `Next`, `Previous`, the arrow
key, a contents row and `openBook` all arrive at **scrollTop 0**.

This surfaced sideways, which is worth recording: the per-look stills of the strip came back
**blank**, because each one opened a note while the page was still scrolled from the previous
shot, so the push was never at its limit and painted nothing. The harness was right and the page
was wrong.

The bottom landing is the awkward half. Inside Obsidian the note is rendered by the host's own
`MarkdownRenderer`, which is asynchronous, so at the moment `goTo` returns there is no content to
sit at the bottom of. The option was already typed `void | Promise<void>`, so the landing is
applied synchronously **and again** when that promise resolves, guarded on the reader still being
on the same note — the same reasoning `design/0010`'s per-render host already uses, and no
sequence number needed.

The arrival is **consumed once**. A landing left set on `reader` would be re-applied by the next
`renderNote` from any other cause, so a refresh after a back-turn would have jumped the page to
its bottom. Found in review, not by a check.

## A look is paint, and the band moves nothing

`page.css` owns all of it: the strip's box, the leaf's transform, the words' line box. Neither
`leather.css` nor `cyber.css` changed for this feature at all — the strip's colours come from
`--text-1`, `--text-3` and `--surface-2`, which each look already redefines, so it takes each
look's paint for free exactly as `design/0025`'s footer does.

Two things make it safe against `design/0021`:

- **The strip is absolutely positioned inside `.vs-spread`**, like `#vs-tabs` already is, so it
  moves nothing whatever it paints.
- **The band transforms a wrapper, `.vs-leaf`, not the page.** A transform does not affect
  layout, so the page's own `scrollHeight` — which is what decides whether there is anything to
  push through — is unchanged by the thing the push draws.

Both are *measured* rather than argued: `.vs-push` and `#vs-pushsay` are in the same-size check's
`reading` list, and the check now opens the strip before measuring, because **hidden it is 0×0 in
every look, compares equal, and proves nothing**. `a look moves nothing on the page` walks it too,
in the reading state, for the same reason.

## `prefers-reduced-motion` removes the band and keeps the threshold

The constraint the issue set. Under reduced motion the band is not painted at all and no spring
is scheduled; the strip's fill still tracks the push, so the threshold is still legible and the
gesture still exists. This is the opposite call from `design/0024`'s edge scroll, and for a
reason: there the scroll **was** the gesture's only reach, so suppressing it would have deleted
the feature. Here the band is decoration over a threshold that is visible without it.

## `decisions/0013`: the spring is declared, not hidden

A check that returns with the page still moving fails, naming what it left in flight. A band
mid-spring is exactly that, so `__vs.overscroll()` reports `pushing` and `settling`, and
`atRest()` fails any check that leaves either set. That is how the settle diagnostic caught the
second defect in this ticket: a **turn** was starting a spring-back, and the settle timer handle
survived `closeReader`. A turn now **snaps** — the band belongs to the page being left, and there
is no rubber left to spring — and closing the book snaps for the same reason. `releasePush` clears
any pending spring before deciding whether to start one.

## The smoothness budget, measured where it means something

`scrolling the library stays smooth in every look` holds p95 under 34ms, and the issue says a
wheel handler on the spread owes the same number measured rather than assumed.

The first version of that check measured **two costs as one** and failed: leather read p95
**53.9ms** with a 264ms worst against modern's 18.4, because a single page **turn** — a full
`renderContents` / `renderMarks` / `renderTabs` / `renderNote` — landed inside the sampled frames.
The handler's own per-frame cost is what the budget is about, so it is now measured where the push
**cannot** turn: standing on the last note and pushing down, which resists for ever.

| | leather | modern | cyber |
|---|---|---|---|
| p50 / p95 / worst frame, pushing (ms) | 17.7 / **18.9** / 268 | 17.6 / **18.2** / 19 | 17.7 / **18.3** / 18 |
| one whole turn, timed separately | 3ms | 2ms | 3ms |

p95 18.9ms against the library scroll's own 18.5ms on the same machine — the gesture costs what
scrolling costs. leather's single 268ms outlier is the first look measured in either check paying
for its stylesheet's first application; the existing library check reports 158ms there against
modern's 35ms for the same reason, and p95 is the assertion in both.

## The host owns the wheel, and gets it back

The plugin is a view inside Obsidian. Three things keep the gesture inside `.vault-shelf`:

- the listener is on the right page, bound through `on()`, so it comes off with everything else —
  `teardown-check` drives twenty mount/unmount cycles and reports `timers 0`, and `pushStop` is
  registered on `onDestroy` for the same reason `edgeStop` is, so no timer outlives a mount;
- `overscroll-behavior: contain` on `.vs-page`, so the push never chains out to the host's own
  scrolling even where nothing calls `preventDefault`;
- `preventDefault` only when the delta is actually absorbed. Below the limit, native scrolling
  owns the event untouched.

**`ctrl`/`cmd` + wheel is a zoom and is handed straight back**, which the first version absorbed
into the push. Found by reading the diff, not by a check.

## The checks

```
node scripts/smoke.mjs --only "pushing past the end" --only "a turn arrives at the top" \
  --only "resists at both ends" --only "the contents never turns" \
  --only "a wheel on the spread stays smooth"
```

Every one dispatches synthetic `WheelEvent`s, which **do not scroll natively** — so wherever the
native scroll is part of the case, the check applies it by hand. That is not a shortcut: it is the
only way to drive the flick that lands on a page which can still scroll, and that case is where
the latch was released a page early.

## What was deliberately not done

No pointer or touch drag-to-turn: this is the wheel, and a drag is its own gesture with its own
conflict against selecting text. No page-turn animation beyond the band — `design/0025` left that
open and it stays open. Nothing here makes the **library** scroll into more shelves: a shelf is a
bookcase (`design/0014`), and `github#34` and `github#20` are separate.
