# 0023 — A drag that reaches the edge scrolls the room

`github#34`. Three things can be dragged — a book along a manual shelf, a book onto a pick
shelf, and a whole shelf by its floor — and until this landed, **none of them scrolled
anything**. `#vs-library` is the scroller, the library is taller than the window on any real
vault, and a drag could only reach what happened to be on screen when it started. The gesture
had a reach of one screen.

While a drag is in the air, the pointer entering a **64px band** at the top or bottom of
`#vs-library` scrolls it, faster the closer it gets, stopping at the ends and the moment the
drag does.

## There is no horizontal case, and there is never going to be one

**Do not add one.** A shelf's rail does not scroll sideways, by design: *a shelf is a bookcase,
not a conveyor belt* (`design/0014`). A run too long for the room continues on the next row
down, so there is no off-screen-to-the-right for a drag to reach. The only axis the library
scrolls on is the one this record is about, and a horizontal edge scroll would be scrolling
something that does not scroll.

This paragraph exists because the obvious next commit after an edge scroll is "and the other
axis too".

## A timer, not an animation frame

`WIN.setInterval` at 16ms, started on the first `dragover` inside the band.

The room watcher already paid for this lesson (`src/page.js`, `watchRoom`): a repack was
coalesced through `requestAnimationFrame` first, and the harness caught it — the resize handler
ran, the frame callback never did, because **a window Chrome is not painting gets no frames**,
and the pending flag then stayed set for good. An auto-scroll that stalls whenever the window
is not being drawn is the same stall this ticket exists to remove, one level out.

The band's numbers, measured on the vault at 5,000 notes:

| | |
|---|---|
| band depth | **64px** at each edge |
| speed at the inner lip | **3px/tick** (~190px/s) |
| speed at the very edge | **20px/tick** (~1,250px/s) |
| tick | **16ms** |
| measured, 6px from the bottom edge | **18.4px/tick** |
| measured, 2px from the top edge | **−19.3px/tick** |

The ramp is linear across the band. `k` is clamped at 1, so a pointer dragged past the edge
entirely does not scroll faster than the edge itself.

## The mark is geometry, not the last event

`github#3` paid for this twice already: a `dragover` nobody `preventDefault`s means no drop is
ever offered, and a target that stops being under the pointer stops hearing the drag.

Scrolling makes that worse in a way a mouse never does — **the content moves under a stationary
pointer**, so what the pointer is over changes with no mouse event at all. A mark cached from
the last `dragover` is wrong one tick later, and the target that accepted the drop is no longer
the one under the pointer.

So every tick that actually moved the room **replays one `dragover`** at the last real pointer
position, on whatever `elementFromPoint` now finds there. That reuses every geometry path the
page already has — `placeIn(track, clientX)`, `shelfUnder(e)`, `leaving(e)` — instead of
duplicating any of them, and it is exactly what the browser would have delivered if the mouse
had moved a pixel.

Two details make it safe:

- **The replay is flagged** (`edgeReplaying`), and the band handler ignores a flagged event. The
  speed is therefore only ever set from a real pointer event, so a replay cannot keep a loop
  alive that the pointer has already left.
- **A synthetic `DragEvent` carries no `dataTransfer`.** Every drop target in the page already
  guards `if (de.dataTransfer)` before setting `dropEffect`, so none of them notices. This is not
  a test-only trick either: `scripts/record-demo.mjs` drives the whole film's drags with
  synthetic `DragEvent`s (`design/0007`), so it is the currency this page already runs on.

## Increments, not a target — which is why `content-visibility` needs no settle dance

`github#21` scrolls, re-measures and scrolls again, because `content-visibility: auto` on an
off-screen shelf means its height is a guess until it renders, so every `offsetTop` below it
shifts once it does.

**None of that applies here, and the reason is worth stating.** `settleOn` re-measures because
it is seeking a *computed offset* — it has to land on a particular shelf, and the number it
computed went stale. This loop never computes an offset at all. Each tick reads `scrollTop`,
`scrollHeight` and `clientHeight` fresh and adds a few pixels. A shelf whose height firms up
mid-scroll does not invalidate anything; it just extends the runway, and the next tick scrolls
into it.

The check measured that happening: the landing rail started **301px** below the fold and the
room had to travel **1,194px** to clear it, because every shelf that rendered on the way added
its real height underneath. The scroll simply kept going.

## Every exit path, because a loop left running scrolls the room on its own

`dragleave` out of the library, `drop`, `dragend`, and the page's own teardown. The two event
ones are bound on the **document with capture**, so a drag that ends anywhere — Escape, a drop
outside the window, a drop on some other part of the page — still stops it.

The suite enforces this for every check, not just this ticket's: `atRest()` now reports
`an edge scroll still running`, so **whichever check leaks one fails**, rather than the
unlucky check that trips over a library scrolling by itself afterwards. `settlePage()`
dispatches a `dragend` on the way out for the same reason.

The loop is also guarded on `dragging || shelfDrag` — the page must itself be carrying
something. A file dragged in from the desktop moves nothing.

## `prefers-reduced-motion` changes nothing here, and that is a decision

Decided rather than asked (`github#34`, unattended run). Two reasons, both structural:

- **There is nothing to unsmooth.** Every other scroll in the page branches on
  `reduceMotion` because it calls `scrollIntoView({ behavior: "smooth" })` or
  `scrollTo({ behavior: "smooth" })`, and the reduced-motion path swaps in an instant jump. This
  loop only ever writes `lib.scrollTop = n`, one small step per tick. It is already the instant
  form; there is no smoothing to turn off.
- **The scroll is the gesture's reach, not decoration.** Suppressing it would not calm anything
  down — it would delete the feature for exactly the people who asked for less motion, and leave
  them with the one-screen reach this ticket removed. Reduced motion is about non-essential
  animation, and this is the only way to drop a book somewhere you cannot currently see.

**Open for Lukas**: if he wants it the other way, it is one branch in `edgeSpeedAt` — flatten
the ramp to `EDGE_MIN`, or refuse to start the loop at all. Neither is currently written.

## What was deliberately not changed

`scripts/record-demo.mjs` still scrolls the room by hand under a carried book in the
*favourite* act. The ticket calls that an adjacent half-fix, and it is — but the act
choreographs a scroll and a pointer arc *together*, on a timeline, to compose a shot. It is a
storyboard, not a workaround waiting to be deleted, and the film would be worse if the room
started scrolling on its own timing in the middle of it. Left alone on purpose.

## The checks

`node scripts/smoke.mjs --only "reaches the edge" --only "a carried shelf scrolls"`

Both are `POINTER_DRIVEN`, so they run in the serial lane: they read boxes and scroll a room,
and a contended GPU reports a geometry that has more to do with the other Chrome than with the
code.

Both dispatch the pointer **once** and then never move it again. That is the whole point — what
keeps the room moving is the loop, and a check that kept nudging the pointer would prove nothing
about the thing this ticket is.
