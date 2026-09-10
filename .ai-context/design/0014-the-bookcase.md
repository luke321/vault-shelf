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

## What it costs

The page is taller. The 10k library fixture puts 17 rows under Weeks, which is a tall shelf —
and an honest one: that vault really does have 520 weeks in it. The alternative was a rail
you could not see the end of, which is not shorter, only smaller.

The floor runs the full width of the room even where the books stop, because a shelf does. A
half-empty last row with a board ending in mid-air reads as a broken rule rather than as a
shelf with room on it.
