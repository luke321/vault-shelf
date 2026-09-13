# 0026 — Moving the marker moves the marker

`github#46`. Reported 2026-09-11: *"when clicking on a link in the left index it scrolls again
from the top"*.

Amends `design/0015`, which put the contents under the reader's control: the index follows the
note you are on, and a tab, a ribbon, `Previous`/`Next` and the arrow keys all move it. That
machinery stays. This is about not throwing the page's scroll away on the way through it.

## What it was

`goTo` — the one funnel every turn goes through — called `renderContents()`, which opens with
`clear(box)` and rebuilds all of it. On a 2,450-row index that is 2,450 buttons discarded and
2,450 built to move `aria-current` from one of them to another. Nothing else about the list
differed.

Two things followed, and the second is why it landed in the wrong place.

1. Emptying the `<ol>` collapses the left page's `scrollHeight`, so the browser clamps its
   `scrollTop` to **0**.
2. `revealCurrent` is a *nudge measured from* `scrollTop` — it moves the marked row just inside
   the viewport and otherwise leaves the page alone. Run against a baseline of zero, every row
   below the fold now satisfies `bottom > scrollTop + clientHeight - margin`, so it computed
   `target = bottom - clientHeight + margin` and parked the row at the **bottom edge** — after
   an animation up from the top, to a row that had been under the pointer all along.

In a book whose index is short enough that the nudge has nothing to do, the clamp is the whole
story and the animation never happens: the list is simply at the top afterwards. Measured on
`weeks/2026-W29` (55 rows): `scrollTop` 377 → 0, and 0 half a second later. That is the report,
verbatim.

## What it is

`renderContents()` keeps the clear-and-rebuild and stays the entry point for the two paths where
the list's contents really do change — opening a book, and typing in *find within this book*.
Everything else goes through `markContents()`, which drops the old `aria-current`, sets the new
one on the row that is already standing there, and calls `revealCurrent`. `goTo` calls that.

A row carries `data-note`, so the mark is placed by the same predicate the build already used
(`note.id === reader.noteId`) rather than by a second source of truth such as a row index — an
index would have to stay in step with a live `within` filter, which changes which rows are in
the DOM at all.

`revealCurrent` is **unchanged**. It was never wrong; it was being lied to. Given a truthful
baseline its own guard (`Math.abs(target - page.scrollTop) < 1`) returns without scrolling when
the row is already on screen, and it still nudges when the row is not — which is the ask exactly:
*scroll only when the row is not already there.* A tab jump or an arrow key to a note far outside
the visible index still reveals it.

Focus is the quiet dividend. The press focuses the row; the row is no longer destroyed under it,
so focus stays where the reader put it instead of falling back to `<body>` on every page turn.

## Why not capture and restore the scroll

The report offers it as the fallback, and it is the wrong shape here. It repairs the arithmetic
while still rebuilding the whole list to carry one attribute across: it pays the DOM churn, it
drops focus and any text selection inside the list on every turn, and it still flashes. It is the
right answer only on a path where a rebuild is genuinely unavoidable, and `goTo` is not one —
every one of its six callers is a turn *within the same book*. `openNote` reaches `goTo` only for
a note this book already holds; a note in another book goes through `openBook`, which rebuilds via
`renderReader`. So the rows standing there are always the right rows.

## The measurement that nearly went the other way

**`element.click()` does not reproduce this, on the broken code.** The first check written for
this ticket clicked a row programmatically, measured `scrollTop` 30988 → 30988, and passed —
green, over a live bug, in the exact shape the report describes.

The clamp needs a **layout taken while the list is empty**, and `renderContents` never reads
layout between `clear()` and the appends, so in one uninterrupted task there is nothing to force
one. What forces one under a real mouse is the **focus change**: the press focuses the row
button, `clear()` then removes the focused element, and resolving focus back to `<body>` flushes
layout — with the `<ol>` empty. No press, no focused row, no clamp.

So the check dispatches a real `Input.dispatchMouseEvent` press and release, and it reads
`scrollTop` **between** them, because that is the only moment the zero is visible: half a second
later the smooth scroll has animated part of the way back and the number looks merely wrong
rather than diagnostic.

```
people/-unfiled (2450 rows, index scrolls 61975px)
  before press 30988 · after press 30988 · after release 0 · +500ms 19489 (still animating)
weeks/2026-W29 (55 rows, index scrolls 753px)
  before press   377 · after press   377 · after release 0 · +500ms     0
```

It also picks a row a full row-height clear of both edges. A row only part-way into view is
nudged fully in by the focus the press itself gives it, and the release then lands on its
neighbour — which is its own small bug in the old behaviour (measured: a click on row 1029 marked
row 1060) and would have made the assertion flap.
