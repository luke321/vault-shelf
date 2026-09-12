# 0025 — Turning the page is under the book

`github#36`. Asked on 2026-09-11: *"need an easy way to move to next or previous note in the
book"*.

Two ways already existed and both were easy to miss. `←` and `→` stepped the reader and nothing
on screen said so. `Previous` and `Next` sat in the reader bar, pushed to the far right by a
flex spacer, beside `Back to shelves` and `Previous collection` — four buttons of the same
material in one row, where the two that turn the page were the two furthest from the page. The
commonest gesture in the reader was the least reachable thing in the spread, and the mouse had
to travel to the top-right corner of the window to make it.

It is a footer under the spread now:

```
←  Previous            14 of 303            Next  →
```

## Why not the page edges

A book turns by its outer edge, and that is the candidate closest to the metaphor the whole
product is built on. It is also the one the product has already spent.

`.vs-tabs` — the index rail, `github#32` — is `position: absolute; right: 0; z-index: 4` and
the full height of the spread. **The right edge is taken.** A click target down the left edge
and nothing down the right is half a gesture, and half a gesture is worse than none: a reader
who learns that the left edge goes back will try the right edge to go forward, find the index,
and conclude the feature is broken rather than absent.

An invisible-until-hovered strip also competes with selecting text — down the left edge that is
the contents, which is a list of things people click.

The edges stay available if the rail ever moves. They are not available while it is there.

## Why not simply make the bar buttons legible

Cheapest of the three, and it answers a different question. The ask was *where your hands and
eyes already are*, and while a book is open both are on the book. Moving two buttons from one
end of a bar to the other end of the same bar leaves them at the top of the window.

Taking them out of the bar pays a second time: the bar is down to `Back to shelves` and
`Previous collection`, which are two ways of saying *leave this page* — one row, one meaning,
instead of four buttons of the same material meaning two different things.

## Where am I

`14 of 303` is information the reader did not have. The contents only implied it, and only for
somebody willing to count rows. A footer is where it costs nothing: the two controls that move
you through the book are the two things it belongs between, and it is the label that makes
reaching the end legible rather than a dead click — `Next` disables at `notes.length - 1` as it
always did, and the count now says why.

An empty book under a filter reads `No notes` and both buttons are disabled. That path used to
leave the two buttons in whatever state the previous page put them in.

## The keys

**The glyph is the key.** The buttons read `← Previous` and `Next →` with the actual arrow-key
glyphs rather than guillemets, so the control permanently shows the key that does the same
thing. That is the issue's *say what the arrow keys do somewhere a person will see it once*,
answered without a legend to read or a tooltip to discover. `aria-keyshortcuts` carries the
same fact to anything that cannot see the glyph.

**An arrow key belongs to the caret first.** `←` and `→` still turn the page, but `typing()`
lets any text field, `<select>` or `contenteditable` have the event first. Before this, typing
in `Find within this book` and pressing `←` turned the page instead of moving the caret — the
collision the issue named, reproducible in `#vs-within` on every build. `Alt+←` is tested
before the guard, because walking back to the previous collection is not a caret move whatever
has focus.

**`PageUp`, `PageDown`, `space`, `j` and `k` do nothing new, deliberately.** `space` and
`PageDown` scroll the note, which is what a note longer than the page needs and what every
reader already expects; taking them for a page turn would make a long note unreadable in
exchange for a third way to do something there are already two ways to do. `j`/`k` are plain
letters with no affordance to discover them, and they would collide with find-as-you-type if
the reader ever grows one. Recorded here rather than left open, which is what `github#36`
asked for.

## A look is paint, and this is furniture

`page.css` owns the footer's geometry — its width, its row, the gap, the button box
(`design/0021`). `leather.css` and `cyber.css` set only `border-radius` on a generic button, so
the footer takes each look's paint for free and **no look file changed for this feature at
all**. `.vs-turn` and `#vs-place` are in the same-size check's `reading` list, and `a look moves
nothing on the page` walks them automatically in the reading state.

`#vs-place`'s width is the face's to decide — it is a label, and a wider face draws wider
glyphs — so it is measured for height only. `.vs-turn` is measured for both: it is lined up
with the spread by sharing its `max-width`, so it is the same box in all three looks in a room
of the same width.

Nothing here animates, so `prefers-reduced-motion` has nothing to guard. A turn animation is a
separate decision and was not taken.

## What did not move

The buttons kept their ids. `#vs-prevnote` and `#vs-nextnote` moved out of `.vs-readerbar` and
into the footer with their click wiring and their disable-at-the-ends logic untouched, which is
why `previous and next walk the book and stop at its ends` reads identically on both sides of
this change. A control keeps its address the way a book keeps its own (`decisions/0002` is
about books, but the habit is the same one).

`.vs-spread`'s bottom margin went from 30px to 16px so the footer sits under the book rather
than adrift below it. That is the only geometry outside the footer that this touched.
