# 0018 — The manual shelf

> "add the option for a shelf without automatic order where you can drag and drop stuff"

Every shelf until now was sorted by a rule: A to Z, Z to A, or — for a date classifier — the
reading order in the top bar (`design/0015`). A shelf can now have no rule at all, and stand
in the order a person put it in.

## What it changes, and what it must not

The Order control on every shelf gains a third value, `manual`. It changes **one** thing: the
sequence the books stand in. It does not change

- **a book's address.** `shelfId/classifierKey` is still the whole of it (`decisions/0002`).
  Arranging a shelf moves no bookmark, no reading place, no hand-dyed colour, no wear count,
  because none of those has ever known where a book stood.
- **membership.** The same notes are in the same books. `noteCount` does not move.
- **what is inside a book.** A book's notes are still sorted by date or by title, and the top
  bar still turns them round. Only the books themselves stop turning.

The sequence lives on the shelf as `order: string[]`, and it is a list of **keys** rather than
addresses or indices. A key is the part of the address that survives everything
(`decisions/0002`); an index would be an index into whatever the shelf happened to contain on
the day it was written.

## The two questions a stored sequence has to answer

**A key the list does not name.** A note arrives overnight and makes a book nobody has placed.
It goes to the **end**, in the A-to-Z the shelf would otherwise have had. Not the beginning,
because the beginning is the part of a shelf a person arranged on purpose; not "wherever it
sorts", because that is the middle of somebody's arrangement.

**A key the vault no longer has.** It is dropped, and it is dropped **on save**, not on read.
Reading is where a filter is in force, and a filter is not a deletion (`CLAUDE.md`): a person
who narrows the library to one folder and then drags a spine must not lose the placement of
every book the filter is hiding. So `arrangeBook` rebuilds the shelf over the **unfiltered**
notes, applies the move to that, and writes the result. Live keys only, complete, in order —
and the two questions have answers nobody has to guess.

## The move is "before which book", never an index

`core.moveBefore(keys, key, before)` takes the key being moved and the key it has to end up
in front of — `null` for the end of the shelf. That is exactly what a drop is, and it is the
only form that survives a filter: "before Karen Falk" means the same thing whether or not the
eleven books between them are on screen, and "position 14" does not.

The neighbour is read off the shelf **as it is drawn, with the moved book taken out first**.
Without that removal, "after my right-hand neighbour" names the book being carried the moment
you drag one place to the right, `indexOf` returns −1, and the book lands at the end of the
shelf instead of one place along.

## Switching in moves nothing

The sequence is written out the moment a shelf becomes manual, from the order it was standing
in a second earlier (`seedOrder`). A Years shelf switched while the top bar says *Newest
first* therefore stays newest-first, and the top bar can no longer reach it.

That is why `autoDirection` returns plain A-to-Z for a manual shelf: the automatic sort is now
only what the **leftovers** fall into, and a leftover's position must not depend on a reading
preference the shelf has stopped listening to.

Switching back to A to Z **keeps** the list. Hiding never deletes and neither does this;
switching back again returns the arrangement rather than asking for it twice.

## Drag and drop is the browser's own

`draggable`, `dragstart`, `dragover`, `drop`, `dragend`. No library, nothing fetched
(`decisions/0006`), and the drag image is the one the operating system already draws. What is
added is the one thing HTML5 DnD does not do: say **where** the book will land.

- The mark is a 3px bar in the 3px **gap** between two books, not a highlight on a neighbour —
  a highlight says "this one", and the answer to "where" is "here".
- It is a real `<span class="vs-drop">`, **not a pseudo-element**. `.vs-spine::before` and
  `::after` are already the gilt bands of the leather binding and the neon edge of the
  cyberpunk one (`design/0016`, `design/0017`), at a specificity `page.css` cannot reach and in
  two stylesheets this feature is not allowed to touch. A mark drawn on either is invisible in
  two looks out of three. It paints in `--accent`, so each look gives it its own colour.
- `dataTransfer` carries the book's address as `text/plain`. Nothing reads it back — a
  `dragover` cannot, by design — but it is what a drop out of the page would have to mean.

**Keyboard: `Alt+ArrowLeft` and `Alt+ArrowRight` on a focused spine.** It is read off the
focused spine rather than off a selection, so it can only ever move the book the person is
standing on, and focus follows the book through the redraw. It is the accessibility path and
it is also what makes the behaviour testable without a pointer.

## Rows, and what a plaque now means

A shelf packs into full-width rows (`design/0014`) and every spine on it is draggable, so a
long manual shelf reorders across rows the way it does inside one. The measured shapes: 4, 2
and 5 rows on the three fixtures' Months shelves.

A plaque still comes from `plaqueFor`, so a manual Years shelf still shows decades and a
manual People shelf still shows letters. What changed is **what a run is**: `renderTrack`
collected its groups into a map keyed by the plaque, so two books sharing a label were drawn
side by side wherever they stood in the row. That was invisible while every shelf was sorted
by key — same-plaque books were always neighbours — and it would have silently re-ordered a
shelf arranged by hand. It now groups on **adjacency**, which is what `rowsOf` has always
packed on.

The consequence is honest and is the point: dropping *Marta Ortiz* between two A names splits
the alphabet into `A | M | A`, three plates over the books actually under them. A run is
whatever is adjacent. A plaque that lied about which books it covered would be worse than a
decade shown twice.

## No schema bump

An absent `order` is simply an automatic shelf, which is what every shelf written before this
was and what every shelf written after it still starts as. There is nothing to migrate.
`arrangedBy` in `migrate` does the other job: a hand-edited file cannot hand the builder
something that is not a list of keys, duplicates are collapsed, an empty list is dropped
rather than stored, and a `direction` that is not one of the three comes up as A to Z.

## What it costs

- **A shelf that no longer answers a question about itself.** "Why is this book here?" has an
  answer on every other shelf and only one here: because you put it there.
- **A list that grows with the vault.** 126 keys for the mirror vault's People shelf, in the
  settings file. Short strings, and the alternative — storing nothing and re-deriving — is the
  thing that cannot be done.
- **A decade that can be shown twice in one row.** See above; that is the honest reading.
