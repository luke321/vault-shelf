# 0020 — A book made on the shelf

> "ability to create books directly in the UI by right clicking an empty space in the favourite
> rack, for example a book dailys pointing at the daylis folder"

Until now a book was only ever made by a shelf's classifier. `design/0019` broke half of that:
a pick shelf holds books *picked* from elsewhere rather than classified. This is the other
half — a book put on the shelf directly, defined by what it points at — and it is the smaller
of the two, because most of the machinery was already there.

## A made book is a saved query, and the query is a source

```
  made:   { "-made-dailies": { name: "Dailies", source: { kind: "folder", value: "04 - Daily Notes" } } }
  picks:  [ "-made-dailies", "years/2024" ]         the one sequence, as before
  book:   id     "favourites/-made-dailies"          its own address
          key    "-made-dailies"                     no slash, so never a source address
          label  the name; notes  matchesSource over the shelf's notes; bands  bandsOf them
```

The issue set out three shapes and asked for the first, with the others accounted for:

| Shape | Taken? | Why |
|---|---|---|
| **A source only** — folder, tag, person, the whole vault | **Yes** | `Source` is the predicate every shelf already filters by, and `matchesSource` is reused as it stands. It covers the example exactly. |
| A source plus the search query | No | *A filter narrows; the query marks* is a law. A book that narrowed by a query would be the first thing in the product to make the search filter, and it would disagree with the box the moment somebody typed in it. If a second predicate is ever wanted it should be a second `Source` kind, not the query. |
| Anything the builder can express | No | That is a one-book shelf, and the builder is where it is made. A book on Favourites should be lighter than a shelf. |

A property value as a source was left out with the second shape: `Source` has no `property`
kind, and adding one is a change to the builder's first question as much as to this sheet.

## `picks` is still the only list

`design/0019` refused two lists that both claim to say where a book stands. A made book keeps
that: its **key** goes into `picks` like any reference, so membership and sequence stay one
question and everything that reads the sequence — the drag, Alt+Arrow, `pickBefore` — works
on it unchanged. Its **definition** lives beside the list in `Shelf.made`, keyed by that key,
because a reference has something to be read from and a made book does not.

The key is `-made-<slug>`: a hyphen like the two special keys, a word no classifier produces,
and no slash, so it can never be a source address, a tag, a person, an initial or a date.
**It is fixed when the book is made and survives a rename** — the address is the one thing
about a book that has to survive (`decisions/0002`) — so a ribbon left in *Dailies* is still
in it after it is called *Journal*.

What is saved against the list changed by one line: `liveOn(shelf, live)` adds the shelf's own
made keys to the set of addresses the unfiltered library resolves. A made book is live by
definition — its definition is on the shelf — and without that `pickBefore` would have dropped
it on every save as a pick nothing resolves.

**No schema bump.** A file without `made` is a shelf with no made books, which every file
written before this was. `migrate` keeps a made key in `picks` only while `made` defines it,
appends a definition the list forgot rather than losing it, and drops a definition with no
name or an unknown source kind.

## A reference is not a place a note lives; a made book is

`design/0019` skips whole pick shelves in `resolveReading`, `alsoShelvedIn` and the reader's
nearest-shelf search — one decision, made because a favourite is its source book under a
second name. A made book has no source book: it is the **only** address those notes have
under that name. So the skip narrows from "the pick shelf" to "the reference books on it"
(`core.isReference`), and a made book is seen like any other:

- a ribbon left in it resolves to it, is drawn on its spine, and puts it on the Reading shelf;
- *also shelved in* offers it, and still never offers the favourite beside it;
- opening it opens it, and its wear, its ribbons and its hand-given colour are its own.

`sourceOf` returns a made book as its own source, which is what makes the dye menu, the wear
and the click all fall through to the right address without a second case.

## Where it lives: any shelf arranged by hand

> "should work on all manual book shelfs"

The first cut allowed it only on a pick shelf, on the argument that an ordinary shelf's books
are its classifier's and a book with a rule of its own would be a second rule on a shelf that
has one. That was the wrong line to draw: the line that matters is **whether a person has taken
the sequence in hand**. A Years shelf arranged by hand is already a shelf somebody composes,
and a *Dailies* standing among the years is the same act as a *Dailies* standing among the
favourites. So a made book lives on any shelf whose `direction` is `manual` — a pick shelf is
one, always — and the definition sits in `Shelf.made` on that shelf.

What differs is which list carries the key. On a pick shelf it is `picks`; on an ordinary
shelf it is `order`, the list `design/0018` already keeps, and `arrange` places it exactly as
it places a classifier key. `buildShelf` builds the made books after the classifier's and
counts their notes into the same set, so the shelf's count is still unique notes. A made book
carries no plaque, so on a Years shelf with decades on it stands in a run of its own — a plate
says what is under it. A shelf switched **back** to automatic keeps its made books (hiding
never deletes, and neither does a change of order): `compareKeys` sorts them after the specials,
last on the shelf, until the person deletes them or arranges the shelf again.

**The plus.** *"a plus symbol for a book on the left that moves with the edge of the books on
the shelf please very subtle."* Every shelf arranged by hand ends in one: a spine's height, the
thinnest spine's width, a dashed edge at a third of the ink, standing where the books end and
moving along as books are added — on the last row, or on a row of its own when the last row is
full, which `rowsOf` reserves for it the way it reserves a plate's width. It says nothing until
the hand reaches it, then takes the accent and a peek. Clicking it opens the sheet with the
book going to the end; the right-click on the wood still puts one *here*. On an automatic
shelf there is no plus, because there is nowhere to put a book on a shelf that orders itself.
The plus hides while a drop is being offered to an empty rail, so the landing reads alone.

It follows that **no other shelf takes a made book.** A favourite dragged from one pick shelf
onto another is added there (`design/0019`), because the reference can be re-made from the
address it carries. A made book carries a definition the other shelf does not have, so
`takes` refuses it, the other shelf's empty landing does not light for it, and — because a
drop *off* the rail is a delete for this book — `leaving` returns nothing while it is over
another pick shelf's rail. Dropping Dailies on the reading list does nothing at all, which is
the safe reading of a gesture that could otherwise have meant "lose it".

## The interaction

**Right-click empty rail space** — the dashed landing, the gap after the last book, the board
between two rows — and not a spine, which is the dye menu's. The rail menu (`#vs-railmenu`,
the dye menu's box with one line in it) offers *New book here…*; **here** is where the pointer
was: before the spine whose middle it has not passed on that row (`placeIn`, the same
arithmetic a drop uses), or at the end. The empty landing now says *Drag a book here, or
right-click to make one*, because a right-click on an empty shelf is not a gesture anybody
tries unprompted.

**The keyboard's way in is the shelf head**: a hand-arranged shelf's *Edit · Hide* gains *New
book*, which opens the same sheet with the book going to the end, because a right-click needs a
pointer and the rail menu is where the pointer is, not where a tab stop is. The plus at the end
of the rail is a button too, and a tab stop.

**The sheet** is a name and *what it holds* — the four source kinds and the value list the
builder's second question already fills — with the real count under it, over the notes the
shelf is built from. Save makes the book and focuses its spine. A made book **is a spine**: it
lifts, drags along the shelf, moves on Alt+Arrow, wears, hangs ribbons, takes a colour, and
thins to a ghost under the query like any other.

**Editing and deleting are on the spine's own right-click menu**, under the twelve swatches:
*Edit book…* and *Delete book*. *Take off Favourites* is not offered on a made book, because
for this book it would be a delete under a softer name. **Dragging it off the rail deletes it**
— the same drop-not-`dragend` path a favourite comes off by, so Escape and a drop outside the
window still cancel — and the peek says so. Delete asks nothing: what is lost is a name and a
predicate, never a note. What the book owned — wear, colour — goes with it, as a deleted
shelf's does; a ribbon in it re-resolves to the next book holding the note, as a saved place
always has.

**A made book whose source is gone is an empty book, not a dropped one.** A dead reference is
dropped on save because the thing that explained it is gone. A made book's explanation is its
own definition, which a person wrote: a folder renamed away leaves an empty spine
(`data-empty`, like any empty book) until they edit or delete it.

**It is a view, not a folder.** Nothing is written to the vault and nothing moves; the book is
rebuilt from the notes on every build and filtered exactly as its neighbours are. The check
asserts the vault's notes are byte-identical across making, editing, emptying and deleting.

## What it costs

- **A second kind of book on a pick shelf.** Every place that asks "is this a reference?" now
  has to ask the right question. `isReference` is the one answer, and the five sites that
  skipped pick shelves under `design/0019` all use it; a sixth added later that still skips
  the shelf would hide a made book from the reader.
- **A definition that can go stale silently.** A made book pointing at a renamed folder is an
  empty spine that says nothing about why. The peek and the sheet show what it points at,
  which is the whole of the diagnosis, but nothing raises its hand.
- **Two menus on one rail.** A right-click on a spine opens the dye menu; on the wood, the
  rail menu. The split is by target, not by position, and the empty landing's words are what
  tell a person the second one exists.
