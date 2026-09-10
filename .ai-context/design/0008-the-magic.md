# 0008 — The magic

The brief asks for something **as analog as possible, with a magical twist in features a real
book never would have**. Three of them are built. Each one uses a physical vocabulary — wear,
a ribbon, books making room — to do something no physical library can.

The test each had to pass: *would a person who has never read the README understand what just
happened, and could a real shelf do it?* If the answer to the first is no it is a gimmick; if
the answer to the second is yes it is not magic, it is decoration.

---

## 1. Shelf wear — the room remembers your hands

A book you open often looks handled: the boards darken where a hand holds them, the head and
tail soften, and it never quite goes back flush with its neighbours.

`settings.wear` is a count per **book address** (`decisions/0002`), incremented on open and
persisted. `core.wearLevel()` is four steps — 0, then 2 opens, 5, 12 — and each step is
drawn as a slightly larger corner radius, a stronger light-to-dark fall on the board, and one
or two pixels of proud position on the rail.

**Wear adds luminance, never more colour.** A well-read book is a handled book, not a more
purple one, and the slot colour has a job already.

**Four steps, and a floor.** A continuous scale would make the shelf a bar chart of your own
habits, which is a dashboard wearing a book's clothes. Four steps read as *new / used / worn /
well-thumbed* and nothing finer, which is all a shelf has ever told anybody.

**What no real shelf does:** the wear is on the *address*, not the object. The books are views
— September 2026 gains notes every day — so a book can be re-made from different notes and
still remember it is the one you keep coming back to.

`"shelf wear is recorded and drawn, and survives a rebuild"` opens a book thirteen times and
asserts level 3, drawn, and still there after the library is rebuilt.

---

## 2. Ribbons that hang — your places, visible from across the room

A bookmarked note leaves a real ribbon hanging out of the bottom of the book, below the shelf
board. You can see every place you saved without opening anything.

The board has room under it precisely so the ribbon is not clipped by the rail; a book holding
more than one marked note gets a wider ribbon rather than several.

**What no real shelf does — two things.**

A ribbon marks a *note*, and a note is in six books at once, so **one ribbon appears in six
places**. Leave a ribbon in a note in September 2026 and it is also hanging out of
Encyclopedia K, the 2026 yearbook, Week 37 and Mira's volume. That is the product's whole
claim, made visible without a word of explanation.

And it **re-threads itself.** `core.resolveReading` re-resolves a mark against the current
library every time: the named book if it still holds the note, otherwise the first visible
book that does. Hide a shelf, rename a note, delete a shelf outright — the ribbon moves to
wherever the note still lives. A real ribbon falls out of a book that has been rebound.

The **Reading shelf** collects them at the head of the room: not a panel, not a list, just the
shelf of books with something hanging out of them.

---

## 3. The shelf parts as you type — the room makes space

Typing in the search box does not empty the library. Every book stays exactly where it is:
matches draw forward, gain air on both sides and take an accent edge; everything else thins to
a ghost at 16% and desaturates.

This required splitting one concept into two, and that split is the interesting part:

| | |
|---|---|
| **A filter** narrows. It removes notes *before* the books are built, so the shelf genuinely has less on it. Folders and dates work this way, and only through `__vs.setFilters` now. |
| **The query** marks. It runs *after* the books exist — `core.markMatches` scores every book by how many of its notes answer — so the shelf keeps its shape and its addresses while you type. |

`Book.matches` is the only thing that changes, and `applyQuery()` walks the existing spines
and sets `data-match` on them. **Nothing is rebuilt and nothing is removed**, which is what
makes the movement read as the room parting rather than as a new room arriving.

**What no real shelf does:** the books move themselves, and they move *back* — clearing the
box restores the room exactly, because it was never taken apart.

`"the shelf parts as you type, and no book leaves the room"` asserts the spine count is
identical before, during and after, that some drew forward and some became ghosts, and it
takes its search term from the vault it is running against rather than from the demo
fixture — hard-coding `garden` passed on the demo vault and, on the sparse one, asserted that
a query finding nothing still drew something forward.

---

## What was considered and not built

**Echoes across shelves** — hover a spine and its twin lights up on every other shelf on
screen. The strongest of the four on paper, and it is partly delivered by the ribbon already.
Worth building next; it needs a note→books index that `bookIndex` is halfway to.

**Anything with physics.** A book that tips, a shelf that sags, a page that turns. Every one
of them is a frame between somebody and their note, and `design/0005` gives the whole thing a
5px hover lift as its entire animation budget.
