# 0019 — The Favourites shelf

> "drag and drop shelf should be at the top as favourites"

`design/0018` gave every shelf the option of standing in the order a person put it in. It did
not give anybody a shelf they could put *anything* on: a manual People shelf still holds
people, in a sequence of its own. What was asked for is the shelf at the top of the room that
starts empty and holds whichever books were dragged onto it.

## A favourite is a reference, and the reference is an address

A favourite is **not a copy of a book and not a book of its own**. It is the source book,
resolved on every build, wearing one thing of its own: an address.

```
  picks:  [ "years/2024", "people/Halvor Estrin" ]      on the shelf definition
  book:   id    "favourites/years/2024"                 its own address
          key   "years/2024"                            the source's address
          label, notes, bands, matches                  read off the source, live
```

That is the whole model, and it follows from `decisions/0002`: an address is the one thing
about a book that survives a rebuild, a rename, a filter and a new note arriving overnight. A
favourite Year 2024 therefore **grows as notes arrive**, because nothing about it was copied
to go stale.

The two alternatives were weighed and lost:

| Option | Why not |
|---|---|
| **Copy the notes onto the shelf** | The favourite is a photograph of a book. A note written tomorrow is in the year but not in the favourite, and the two drift apart forever. |
| **Store a predicate ("year = 2024")** | It is the same book re-derived by a second route, so a change to the source shelf's rule silently changes the favourite. And it cannot name a book with no rule of its own. |

**`picks` is the only list.** A pick shelf is `direction: "manual"` always, and it never carries
`order`: membership and sequence are one question here — a favourite exists *because* it was
placed — and two lists that both claim to say where a book stands is how they come to disagree.
`migrate` deletes an `order` a hand-edited file gives a pick shelf.

**The key is the whole source address, slashes included.** `bookId` is `shelfId + "/" + key`
and `favourites/years/2024` has two of them, so anything that split an address on every `/`
would have broken. Nothing did: `findBook`, `bookColors`, `wear`, the reading places and the
drag code all treat the part after the first slash as opaque, and the address check now carries
the case.

## Building it needs the other shelves

`buildShelf` classifies notes, and a pick shelf classifies nothing — so it is handed the other
shelves' **views** instead: `buildShelf(shelf, notes, order, sources)`. The caller that has
them is new: `core.buildLibrary(shelves, notes, order)` builds every ordinary shelf first, in
position order, then every pick shelf against the result. A pick shelf at position 0 cannot be
resolved before the shelf it points at exists, and the library is what knows about both.

**Hidden shelves are built, so a favourite of one resolves.** Hiding keeps a shelf's books
(`CLAUDE.md`); hiding the People shelf must not empty a favourite of a person.

**A pick that resolves to nothing is skipped on read and dropped on save**, which is exactly
the argument `design/0018` makes about a manual key: reading is where a filter is in force, and
a filter is not a deletion. So `pickBefore` and `unpick` are handed what the **unfiltered**
library resolves, and they are the only writes: a person who narrows the library to one folder
and drags a spine does not lose the favourites the filter is hiding. A shelf deleted in Manage
takes its favourites with it — at the next save, not at the next render.

## `noteCount` is unique notes, one level further out

The central law, and here it bites twice: a favourite Year 2024 and a favourite September 2024
overlap by every note in that month. The shelf's count is the size of the union, and it is
computed the same way every other shelf's is — a set of note ids across the books. Measured on
the 10k library: **338 places, 303 unique notes**, and the shelf header says 303.

## Every spine lifts; not every spine lands

`design/0018` made a spine draggable only on a manual shelf. Every spine in the library is
draggable now, because every one of them can be dropped on Favourites — but what a shelf
**accepts** is unchanged: an automatic shelf still takes no drop, a manual shelf still takes
only its own books, and `data-hand` (the grab cursor, the Alt+Arrow path, the peek line about
moving along the shelf) is still the manual shelf's and nobody else's.

- **The rail is the target, not only the spines.** An empty shelf has no spine to aim at, and a
  drop past the last book has to mean "at the end". The rail takes `dragover`/`drop` along its
  whole length and stands aside whenever a spine is under the pointer.
- **The mark is the one from 0018** — a 3px bar in the 3px gap — as soon as there is a book to
  put it beside. On an empty rail there is no gap, so the **landing** takes the accent instead.
- **A drop of a book already on the shelf moves it**, because it is the same write: `pickBefore`
  takes the pick out of the list and puts it back in front of the neighbour. A spine lifted off
  the pick shelf carries its `key`, which *is* the source address, so add and move are one path.
- **Taking one off is the same drag, run backwards**, which is the gesture a person tries
  first: carry a favourite off the rail and drop it anywhere else in the library and it comes
  off. What makes that safe is that it is a **drop**, not a `dragend`. Escape and a drop
  outside the window both end a drag with no drop, and both have to mean *cancel* — a book
  thrown away because somebody changed their mind mid-drag is the one unrecoverable thing this
  feature could do. So the library takes the drop (`takeOffZone`), and a drag that simply ends
  puts the book back.

  The other shelves refuse it on the way past: `takes` in `handleOf` accepts a foreign spine
  only on a pick shelf, so dropping a favourite on the Months shelf takes it off Favourites and
  does **not** add it to Months. Nothing is moved anywhere; one shelf loses a reference.

  **The spine says it, not the room.** While the drop would take it off, the spine left standing
  on the rail goes to a dashed outline at 0.28 — the same dashes an empty landing is drawn with.
  Lighting up the whole library instead would be a lot of paint for an act that touches one book,
  and the book is the thing that is about to change.
- **The menu is still there, and it is the keyboard path.** Right-clicking a spine opens
  `#vs-dye` (`design/0005`); it gains one line — *Take off Favourites* on a favourite, *Add to
  Favourites* on any other spine. Two doors to one verb is right here: the drag is what a hand
  reaches for, and the menu is what works without a pointer and what puts a book *on* the shelf
  from the other end of the library.

## The empty state is a shelf with room on it

A shelf that starts empty is the only shelf in the product that has to explain itself, and it
does so in the row where the books will stand: a dashed landing the height of a spine, saying
**Drag a book here**. Not a blank board, which reads as a bug, and not a hidden shelf, which
reads as no shelf. It is in the **Manage sheet** like any other shelf, and its own head carries
its book and note count. (Until `github#38` that count was also a chip in the rail's jump strip,
which is what the two checks here used to read it from; they read the shelf's head now.)

## The reader is never told about Favourites

Opening a favourite opens the **source book** — same address in the reader, same ribbons, same
wear, same colour. The reader, the reading places, *also shelved in* and the wikilink
resolution all skip pick shelves entirely.

That is one decision, not five: **a favourite is not a place a note lives.** If the reader knew
about them, one note would have two addresses that are the same book, a ribbon left in a
favourite would re-resolve to a book that only exists because somebody dragged it, and *also
shelved in* would offer you the book you are already reading under a second name. A pick shelf
is a way to **reach** books, and reaching is done on the shelf, not inside the spread. What the
favourite spine does carry is everything that is *about* the source book — its wear level, its
ribbons, its hand-given colour — because those belong to the book and the favourite is the
book.

## Schema 10

A file written under schema 9 has no pick shelf, because there was no such thing. That was
never a decision anybody made — the same argument `decadesOn` makes about plaques — so one is
inserted at position 0 and every other shelf moves down one place **in the order it was
already in**. A file that already says 10 means what it says, and a file that already has a
pick shelf anywhere keeps it where it is. The id is `favourites`, or `favourites-2` if a shelf
somebody made already took the word.

## What it costs

- **A shelf that can be wrong about itself.** Every other shelf answers "why is this book
  here?" from its own rule. This one answers "because you dragged it", and if the source book
  stops existing the answer disappears with it — silently, at the next save.
- **One more thing that has to skip pick shelves.** Five call sites do (`resolveReading`,
  `alsoShelvedIn`, the reader's nearest-shelf search, `plaqueFor`, and `buildLibrary`'s own
  source list), and a sixth added later that forgets would show a person the same book twice.
- **A pick shelf is a kind of shelf, not one shelf.** The first draft left `pick` out of the
  builder, on the argument that a second Favourites shelf was not a thing anybody had asked for.
  That was wrong within a day: *"allow users to add multiple favourite type shelfs"*. A library
  holds a reading list, a shortlist for one project and Favourites, and they are the same
  machinery pointed at different books.

  So "What makes a book?" has a ninth answer, **Books you drag onto it**, and everything that
  used to say *the* pick shelf now asks which one:

  - the **form** drops the question a pick shelf does not ask (which notes belong here), the
    order, and the recipes — but **keeps the classifier**, because it is the control that made
    this a pick shelf and the only way back out of it. A line of hint stands where the rule
    would be.
  - the **menu** offers one line per pick shelf, by name, because with two of them *Add to
    Favourites* would be a guess about which. A book already on one of them gets *Take off* on
    that line instead, so the same menu says what is so.
  - a **spine's peek** names the shelf when there is one and counts them when there are more.
  - **a book can be on several of them at once**, and that is the same law the whole product
    rests on: one note, many addresses. The reference on each shelf is its own — taking the book
    off the reading list leaves it on Favourites — and dragging a favourite from one pick shelf
    onto another **adds** it there rather than moving it, for the same reason.

  What did not change is that a pick shelf still classifies nothing, still carries `picks` and
  no `order`, and is still built last, against the others.
