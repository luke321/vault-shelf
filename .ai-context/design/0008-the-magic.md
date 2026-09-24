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

An old book also starts worn before its first open. [0033](0033-age-and-reading-wear.md)
adds an age floor from its newest resolved note date: one, three and seven completed years.
The displayed level is the greater of that floor and the opening-count level below; saved
counts remain real opens, and recent additions keep an active collection fresh.

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

### What the query reads (2026-09-12, github#58)

> "just note titles and real book cover names, otherwise we match way too much…"

The split above says *when* the query runs. It never said what it **reads**, and what it read was
a note's title, **path**, tags, people and **body**. On the one vault that made `which` answer for
**2,867 of 4,938** notes: the room parted for nearly every book, `#vs-hits` counted a number with
no information in it, and because the match was somewhere in the prose, opening a book told you
nothing about why it had been drawn forward.

The same fault ran the other way. **Aug 2026** is a cover a person can read on a spine, and it
could not be found at all — `labelFor()` builds that string for reading and no note contains it.

> A note matches if the needle is in its **title**, in the **cover** of any book it sits behind, or
> in its own **declared metadata** — tags, people, folder. **Body and path are dropped.**

**Covers alone was rejected.** It makes the search *shelf-dependent*: `inbox` finds nothing in a
library with no Folders shelf — which is the default one — and hiding a shelf quietly makes its
notes unfindable. Declared metadata is first-class truth about a note already (`decisions/0003`),
so it matches whether or not somebody built a shelf out of it.

**A cover is not a property of a note**, so `matchesQuery(note, needle)` can no longer answer
alone: the covers a note stands behind are known only once the library is built. Resolving them
per book inside `markMatches` was the other candidate and would do the same work 687 times over,
once per book, on every keystroke. Instead `core.buildSearchIndex(views, notes)` folds each note's
own text and every cover it stands behind into **one string**, built once in `rebuild()` where the
books are — the same place, and for the same reason, as the vocabulary. `markMatches` then reads a
note **once per query** rather than once per each of the 7.6 books it stands in.

The law is therefore unchanged and the room still parts exactly as it did: `Book.matches` is still
the only thing that moves, nothing is rebuilt and nothing is removed. What changed is only which
notes answer — and, because the old rule folded 33,871 titles and 33,871 bodies on every key, a
keystroke costs **11.8 ms → 1.2 ms**.

### How much of it answers (2026-09-21, github#42)

> "search seems broken looking for sanne de vries in the new one vault highlights almost every book"

The matching was not what was broken. Of the 322 notes that answered, 320 answered on the
`people:` property — the search found the right notes. What the page did with them was the
problem: `applyQuery()` wrote `data-match="1"` or `"0"` and nothing else, and `core.markMatches`
had **already counted**. `book.matches` sat in memory and the page threw it away on the way to the
attribute.

So `people/-unfiled` — **2 notes of 2,481** — lifted 7px, gilded its number and cast a shadow on
that evidence, and looked exactly as found as `people/Sanne de Vries` at **320 of 320**. On the one
vault `sanne de vries` drew **159 of 231 books** forward. Nearly the whole room drawing forward is
the same as nothing drawing forward.

> **A book draws forward by how much of it answers**, in four rungs: a half, a fifth, a twentieth.

**Four rungs and not a continuum, for the reason wear gives above.** A continuous scale would make
the shelf a bar chart of your own library, which is a dashboard wearing a book's clothes. The
ladder is `core.matchStrength(book)`, one rule in one place, sitting beside `core.wearLevel()`.

**Three carriers, because one of them is already taken away.** `prefers-reduced-motion` flattens
the lift, so a strength living in the transform alone would be four rungs for everybody except the
reader who asked for the motion to stop — silently, and invisibly to every assertion in the suite.
The lift is geometry (2/6/10/14px), the **air** either side is geometry that reduced motion does
not touch (2/4/14/24px), and the accent is paint, which each look ramps its own way.

**The ceiling IS the room, so raising one raises the other.** Rung 4 is `--spine-lift-match`, and
`design/0021` declares the room as that rung plus the look's halo. Topping out at 14px therefore
re-declares `--spine-room` as 14 / 15 / 32px in modern / leather / cyber. Rungs 1 to 3 override the
token **on the spine**, never on the track, so the arithmetic the floor checks is unchanged in
shape — only in value.

**The air, though, is width the row was never packed for** (`github#90`). It is top-heavy for that
reason: rung 2 holds 149 of the 188 books a name lights, so 4px there buys 24px at rung 4 and still
overflows 141px less than the flat 9 on `develop`.

**So a row spends only the slack its packing left** (`github#90`). The packer knows every row's
width by arithmetic; a row whose lit books want more air than that gets `--air-k`, one factor for
every margin on it, so the ladder keeps its ratios and nothing is re-packed. A crowded row parts
less than a sparse one — the room still parts where you are looking, and nothing leaves it.
Re-packing on a query was rejected because it *is* the room being replaced under you; reserving
the worst-case air at rest was rejected because it loosens every shelf whether or not anybody is
searching.

**A fill up the spine like a level was the other candidate**, and it is the most literal gauge
there is. Rejected because every look repaints the board heavily — leather's grain and gilt,
cyber's lit panel — so a gauge needs three implementations and fights all of them, for a reading
the three carriers already give.

**`data-match` stays binary and the rung rides beside it.** *Does this book answer at all* is the
law as written, and four checks, `__vs.magic()` and the reader's contents rows all read it.

**A book the query NAMES is marked, not promoted.** A note names several people, so a person's
name lights 16 of 26 people books — the first law working correctly, and it still reads as broken:
a person who types a name expects one spine. `data-named="1"` is that one spine. It changes no
rung, because it cannot: a cover is in the search index of every note behind it (`github#58`), so
a named book is already at or near 100% share.

**`#vs-hits` keeps both halves and qualifies the second** — `621 notes in 188 books (28 strongly)`.
Dropping the book count was the other option; it was never wrong, only unqualified.

---

---

## What was considered and not built

**Echoes across shelves** — hover a spine and its twin lights up on every other shelf on
screen. The strongest of the four on paper, and it is partly delivered by the ribbon already.
Worth building next; it needs a note→books index that `bookIndex` is halfway to.

**Anything with physics.** A book that tips, a shelf that sags, a page that turns. Every one
of them is a frame between somebody and their note, and `design/0005` gives the whole thing a
5px hover lift as its entire animation budget.

## A ribbon you can see from inside the book

A ribbon showed on a spine and on the Reading shelf, and vanished the moment the book was
open — which is backwards, since a ribbon is what you put in a book to get back to a page
*while you are reading it*.

Up to three now hang out of the top edge of the cover, named with their notes and clickable.
They are drawn as ribbons rather than as tabs, and the difference is three details:

- **the cut end points up.** A ribbon comes over the top edge and down between the pages, so
  what you see is its loose end, and the notch it is cut with to stop it fraying is at that
  end rather than at the fold;
- **it has its own colour.** `--ribbon` and `--ribbon-ink`, not `--accent`: a look dyes fabric
  differently from how it dyes a button, and under leather the blanket `button` rule had made
  the ribbons look exactly like the furniture;
- **the space is always reserved.** The row keeps its 40px whether the book holds ribbons or
  not, and is `flex: 0 0` so a long contents list cannot take the pixels back. Hiding it moved
  the whole spread as you marked and unmarked, and a page that jumps under your hands is worse
  than a strip of nothing. It also owns the space above the book in every look, so that a
  ribbon emerges from the cover's edge rather than floating above it.

At the end of the row is **a stub** — the edge of a ribbon you have not pushed in yet. Pushing
it in leaves one in the page you are on. It is the same thing the `Ribbon` button in the bar
does, one hand's width closer to the page.

Three, at most. Every note in a book can be marked, and a row of forty is a different feature:
a table of contents, which is already on the left-hand page.


## A ribbon per book colour (2026-09-11)

> "make it ribbons so you can choose a color per book color, so basically a table, use
> complimentary colors by default"

The ribbon was **one colour for the whole library** — `settings.ribbon`, a hex or empty for the
look's own. Across twelve bindings that is the one arrangement guaranteed to fail somewhere: a
single thread has to sit on oxblood, forest, slate and near-black calf at once, and whichever
colour it is, it disappears against one of them.

So there are **twelve ribbons, one per palette slot** (`settings.ribbons`, schema 10), and the
Manage sheet pairs them: twelve rows, the dye on the left and the thread on the right, because
a dye and the thread that has to be seen against it are one decision. They stand **four columns
of three** in a sheet widened to 760px -- four tables rather than one, since a grid can only
make as many columns as it has children -- and fall back to two columns and then one as the
sheet narrows. Only the Manage sheet is widened; the builder is a form, which reads worse wide. The ribbon column is
drawn with the same notch the spine hangs (`page.css`, `.vs-ribbonswatch`), so the table says
which thread comes out of which board with no legend.

> **Superseded, 2026-09-11:** *"the complimentary default color ribbon for the standard leather
> book is ugly as hell ... I don't [think] complimentary works here."* The rule below is kept
> because the reasoning it got wrong is worth keeping: **an opposite hue is what you reach for
> when two colours have to compete for attention, and a ribbon is not competing with the book it
> is sewn into.** A binder does not put green silk in an oxblood book. The thread is now the
> **board's own hue, deeper** — same colour, richer, and far enough along in lightness to read
> against the board it hangs from. `threadOf()` is the old function with the hue turn taken out:
> the separation was never the problem, the rotation was. A grey still gets the one warm thread,
> because a grey has no hue to deepen. Measured on the demo vault: **21 of 21** painted spines
> keep their board's hue and **21 of 21** sit a fifth of the lightness away from it.

**And the look was painting over it.** The tonal rule above was only half the fault. Leather set
`background: ..., #ad5447` on every `.vs-ribbon`, so the thread a book chose never reached the
shelf under the look a fresh library opens in: twelve books wore one muddy salmon between them,
and that is what "ugly as hell" was actually looking at. Both looks paint `var(--ribbon)` under
their own sheen now — the colour is the book's, the gloss is the look's.

**A check that reads the input to a rule cannot see a rule that ignores its input.** The first
version of this check read `--ribbon` off the spine and passed while the whole shelf was one
colour. It reads the painted `backgroundColor` of the ribbon element now and compares it to the
thread the book asked for. Measured: **22/22** ribbons painted as chosen, in **6** different
colours on the demo vault where there was **1**. The count itself is not asserted — a lopsided
vault can honestly show one, since the sparse fixture's books nearly all draw from one folder and
so wear one dye.

**And the look was painting over it.** The tonal rule above was only half the fault. Leather set
`background: ..., #ad5447` on every `.vs-ribbon`, so the thread a book chose never reached the
shelf under the look a fresh library opens in: twelve books wore one muddy salmon between them,
and that is what "ugly as hell" was actually looking at. Both looks paint `var(--ribbon)` under
their own sheen now — the colour is the book's, the gloss is the look's.

**A check that reads the input to a rule cannot see a rule that ignores its input.** The first
version of this check read `--ribbon` off the spine and passed while the whole shelf was one
colour. It reads the painted `backgroundColor` of the ribbon element now and compares it to the
thread the book asked for. Measured: **22/22** ribbons painted as chosen, in **6** different
colours on the demo vault where there was **1**. The count itself is not asserted — a lopsided
vault can honestly show one, since the sparse fixture's books nearly all draw from one folder and
so wear one dye.

**The default was the dye's complement, computed and not stored.** `complementOf()` turns the
hue 180°, raises the saturation, and then moves the lightness *whichever way has more room*
inside `[0.32, 0.78]`. All three steps earn their place:

- the hue turn alone is not enough — the complement of a dark leather oxblood is a dark leather
  green, and two colours at the same lightness are one shape;
- subtracting a fixed amount is not enough either: a **mid-lightness** dye lands inside the
  clamp and comes back the same weight as its board. Measured on the demo vault, 8 of 12
  separated before the "more room" rule and **12 of 12** after;
- the bounds are about the **room**, not the book. Cyber's ground is near-black and modern's is
  near-white, so a thread may go neither very dark nor very pale: it has to read against the
  room as well as against the binding.
- a **grey has no opposite hue**, so its ribbon is the one warm thread a binder would use on a
  plain cloth board rather than a fourth shade of the same grey.

Because it is computed, an unchosen ribbon follows the look and the host theme the way the
twelve do. `settings.ribbons` is therefore **sparse on purpose**, unlike `palette`: each entry's
default comes from its own dye, so one chosen ribbon does not have to freeze the other eleven.
Setting a ribbon to the complement it already was stores empty, so a thread nobody really chose
keeps following its dye.

**Where it is painted.** `--ribbon` and `--ribbon-ink` used to be written once on the root.
They are now written on **each spine** from that book's dye, and on the reader's mark row from
the open book's — every ribbon in one book is one thread, which is how you recognise the book
you just opened. The looks still declare `--ribbon` as the fallback.

Migration: a file at schema 9 carries one `ribbon` that every book wore. That was a choice, so
it becomes **all twelve**; dropping it to reintroduce it as a default would be reading the
person's mind rather than their file.
