# 0014 — The bookcase

A shelf used to be one row of books in a horizontal scroller. It is now as many rows as it
takes, each one the full width of the room, and nothing on the page scrolls sideways.

## Why the scroller had to go

A vault of 543 notes puts 126 books on the People shelf. In a scroller that is a rail about
four screens long, of which you can see a quarter, with no indication of how much is off to
the right and no way to reach the far end except by dragging. The count in the header said
"126 books" and the shelf showed you thirty of them.

A bookcase does not do that. A run too long for one board continues on the next board down,
and you take in the whole unit at a glance. That is the thing being imitated (`design/0009`),
and it also happens to be the answer: **every book is on screen, and the height of a shelf
tells you how much is in it** — which is the same argument `design/0011` makes for thickness,
one level up.

## The packing is done in JavaScript

`flex-wrap` would wrap, and would also be useless here, because **the plaques are the reason
the rows exist**. A wrapped flex row cannot tell you where it broke, and a year plaque has to
be drawn under the part of its run that landed on *this* board. So `rowsOf()` packs:

- every width is already known — `thicknessOf` is arithmetic on the note count, no layout pass;
- a run that spans two rows gets a plaque on each, naming the same year twice, because each
  plate says what is on the board it is screwed to;
- **a plate is part of its run's width.** `.vs-plaque` is `align-self: stretch`, so a run of
  one thin book under `2010-2019` is as wide as the words, not as wide as the book. Packing on
  the books alone overflowed by exactly that difference — 13px on the sparse fixture, caught by
  the room check. `plaqueWidth()` is an upper bound from the label's length, and every run is
  given room for its own plate before it is allowed to start.

## The room is measured, and measured twice

`room()` is the inner width of a row, and the honest source for it is a `.vs-track`, which is
`width: 100%` of the row it fills. But the first render of a fresh view has no row to measure:
the container is asked instead, before its vertical scrollbar exists, and that answer is too
generous by the width of a scrollbar — which puts the end of a row past the right edge, where
it is clipped and simply gone.

So `renderLibrary()` draws, calls `settleRoom()`, and draws once more if the truth differed
from the guess. **One correction, not a loop**: the second measurement always agrees with the
second packing, and a render that can schedule another render is a render that can spin.

## The board is a handle

> "make the shelf floor draggable to re arrange shelves" · "for that make shelf floors a bit
> thicker"

Manage has had arrows for shelf order since the beginning, and they are still the keyboard path.
What they are not is the thing a person reaches for, which is the shelf itself. **A shelf is
carried by its floor**: press the board, drag, and drop it on the half of another shelf you want
it to land on — above or below, said as *before which shelf* for the same reason a book's move is
(`design/0018`).

The two gestures cannot be confused, and that is the whole reason this works: **a spine is a
book and a board is a shelf.** A book drag starts on a spine; a shelf drag starts on the floor;
neither handler answers to the other's payload, and the take-off zone of `design/0019` ignores a
floor grip explicitly.

**The grip is laid over the floor, not built as one.** The floor is a background on `.vs-track`
here and a walnut board in leather and an edge-lit strip in cyber — three paintings of the
same line. Rebuilding it as an element would mean editing all three stylesheets and keeping them
in step forever. Instead there is one transparent `.vs-floorgrip` per row, sized from
`--board` so it grows with whatever the look paints, standing a few pixels proud of it so it can
actually be hit, and lighting in the accent only while the pointer is on it.

**Lifting it has to wait one tick.** Taking the shelf out of the layout inside `dragstart` --
which is the obvious place to do it -- cancels the drag: Chrome takes the drag image and then
watches the element, and an element that stops being laid out ends the gesture. It shipped that
way for one commit and shelf dragging did not work at all, while every check passed, because a
synthetic `DragEvent` has no such lifecycle. `setTimeout(..., 0)`.

**And the shelf under the pointer is found by geometry, not by hit-testing**, for the same reason
the row hears a book drag (`design/0018`): the ghost this gesture inserts lands under the pointer,
`closest("[data-shelf]")` then finds nothing, the dragover stops being accepted -- and a dragover
nobody accepts means the browser never offers a drop. The shelf list is read off the page
instead: the first shelf whose middle the pointer has not passed.

**A carried shelf leaves the room, and its space goes with it.** A hairline between two shelves
said nothing about where a shelf of eleven rows was going to sit — *"shelf dragging has no
indicator at all where the shelf will end"*. The section is taken out of the flow while it is
being carried (`display: none`) and a **ghost of its own height**, named and outlined, is put
wherever it would land. Everything below is pushed down by exactly what is coming back, so the
indicator is not a line to read: it is the space itself. Measured on the demo vault: a **226px**
ghost reading *Years · 17 books*, the shelf itself out of the room, and **0** ghosts and **0**
carried marks left behind when the drag ends.

**The board went from 3px to 5px** for that reason: at three it was a hairline, which is fine to
look at and impossible to grab. Leather already painted its own at 10px and is unchanged. The
plaque hangs `calc(var(--board) + 9px)` below the books, so it moved down with the board and
nothing else did.

## What it costs

The page is taller. The 10k library fixture puts 17 rows under Weeks, which is a tall shelf —
and an honest one: that vault really does have 520 weeks in it. The alternative was a rail
you could not see the end of, which is not shorter, only smaller.

The floor runs the full width of the room even where the books stop, because a shelf does. A
half-empty last row with a board ending in mid-air reads as a broken rule rather than as a
shelf with room on it.

## And the unit of containment is a row — `github#20`

This record's own answer to what a bookcase costs to paint was `content-visibility: auto` on a
**shelf**, and the section above is why that was the wrong element: *a shelf is as many rows as it
takes*. Eleven years of weeks is 25 rows and **2,664px of spines**, so a shelf materialising paints
all of it inside one frame. Taken one way down at 2000px/s, leather missed **45 of the 121** vsyncs
on offer with a worst frame of **123ms**; with the row as the unit instead, **2–7** and **36ms**.
Cyber **41–55 → 5–9**. Modern was **2** either way, which is the same thing this record already
said: it is a look's paint, and the look that paints least never pays it.

**Keeping both is worse than either** — 65 missed, against 54 for the shelf alone and 8 for the
row alone. A skipped shelf cannot have its own rows assessed for visibility, so when it
materialises every row is evaluated, laid out and painted at once and its height jumps from the
intrinsic guess to the truth, which moves everything below it. **The shelf has to stop being a
unit for the row to become one**, and it stops being one entirely: `contain: paint` alone puts
leather back to **43**, because one paint box is one rasterisation unit however its rows are
skipped, and `contain: layout paint` also stops `margin-bottom` collapsing, which moves the
packing the golden asserts.

A row's intrinsic size is **its own `min-height`**, spelled the same way — `calc(var(--spine-h) +
var(--board) + 24px)`. A second number for the same height is a number that drifts: a flat 214px
put the cold scroll height 541px past the truth. It is exact for a plain row and 6px short for one
under a plaque, and `auto` replaces it with the measured height the first time a row renders.

**None of this was visible from the check that was supposed to see it.** Its sweep crossed 1,120px
of a 4,427px room and turned round, so it scored 2 missed of 81 on a room dropping 43 of 302 going
down. A real wheel dispatched over CDP agreed with the descent, not with the turn. `invariants.md`
carries the table and `github#20` the reasoning.
