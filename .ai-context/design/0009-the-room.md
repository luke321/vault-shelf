# 0009 — The room

There is no sidebar. The library is the surface.

## What went, and why it could

The first build had a 268px left panel carrying six things: the vault name, a shelf list,
search, an activity calendar, folder filters, and the reading table. Three of those are gone
and three moved.

**The activity calendar and the folder filters were cut outright.** They were inherited from
the sister project, where they earn their place: the disc is one dense picture and you need a
way to interrogate it. A library is already legible — every shelf says what it is, every book
says how big it is, and the Years shelf *is* the activity calendar, drawn as books. A second
copy of the same information in a smaller, less honest form is not orientation; it is a panel.

The filter machinery itself survives in `core.applyFilters` and is still reachable through
`__vs.setFilters`, because narrowing by folder or by date is a real thing a shelf can be built
on — it just no longer has a permanent panel of its own.

**The shelf list and search moved to a rail across the top**, which is the width of a label
rather than of a panel.

**The reading table became a shelf.** `design/0008` covers why: the places you left a ribbon
are books, so they belong on a shelf, at the head of the room.

## The infinite shelf

One continuous scroll, and **the way to add a shelf is at both ends of it**. Not in a
settings tab, not behind a menu — a dashed `+ New shelf` rail above the first shelf and below
the last, so wherever you have got to in the room, making another one is the next thing on
screen.

That is the point the product has to make in its first ten seconds: *these six are not the
shelves, they are six of the shelves.* A creation affordance you have to go looking for makes
the opposite point.

`"the library is the whole surface, with no sidebar"` asserts zero `<aside>` elements, exactly
two New shelf buttons, and that they bracket the shelves in document order. Since `github#38` it
also asserts that **every shelf is still reachable** — one Manage row per shelf, each a button that
goes to it — because that is what the rail's shelf list used to be asserted for here.

## A room has a width

Full-bleed was wrong, and it took a WQHD screen to see it. Measured at 2560px, with Obsidian's
own sidebar taking ~270px of it:

- the **Years** shelf put four books on an 1,800px board;
- the **note** was a 380px column of text on the far left of a 2,000px page, with its index
  tabs pinned to the opposite edge of the screen, 1,500px from the text they index.

`--measure: 1180px`, centred. That number is two constraints meeting:

| | |
|---|---|
| the library | ~28 spines at 41px each — a shelf you can take in at a glance, and the Months shelf's 27 books very nearly fit without scrolling |
| the reader | a 220–300px contents page **plus** a 66ch note (495px at 15px serif) **plus** its index tabs — so the spread closes up into something that reads as one open book rather than two things at opposite ends of a desk |

**Chrome stays full-bleed; its contents do not.** The top rail and the reader bar keep their
background and their bottom border across the whole view — a toolbar that stops mid-screen
looks broken — but each wraps its children in `.vs-inner`, which carries the same measure. So
the search box sits above the shelves rather than a screen away from them.

**Centred, not left-aligned**, which is what Obsidian's own readable-line-length does to a
note. The measure is a `max-width`, so on a narrow leaf it does not bind at all and the room
simply fills what it has.

`"the room has a width, however wide the window is"` overrides the viewport to 2560px rather
than resizing a window, so the number is the same on a laptop as on the screen this was
reported from, and asserts the shelves, the rail, the board and the spread all fit the measure
and sit centred. Its centring tolerance is 20px, for the scrollbar: the library scrolls, so its
right gutter is narrower than its left by whatever the platform charges — and 20px cannot hide
a column that is genuinely aligned to one side, which would be off by hundreds.

## What the rail carries

| | |
|---|---|
| the vault's name | so the room belongs to somewhere |
| the search box | `design/0008` — it marks, it does not narrow |
| the hit count | `12 notes in 4 books`, or nothing |
| the gap | one `.vs-spacer`, so the name and the search sit left and the controls right |
| the order toggle | oldest first, or newest |
| the look selector | `design/0016` |
| **Manage** | reorder, hide, restore — and now, get to a shelf |

The per-shelf **Edit** and **Hide** buttons live in the shelf's own header and are invisible
until you hover it, so a room at rest is books and labels and nothing else.

## The shelf list left the rail (2026-09-12, `github#38`)

*"i think the navigation to shelfs at the top needs to go"*.

`#vs-jump` was a `<nav>` of one chip per visible shelf, each with the shelf's name and its book
count. It sat between the vault's name and the search box at `flex: 1 1 auto` with
`overflow-x: auto` — **the only thing in a bar of fixed controls that grew, and the only one that
scrolled**. The thing a bookcase is for is seeing what is there, and this was a second, worse copy
of the library underneath it.

Measured before it went, at the measure and at the narrow breakpoint:

| | 1180px | 860px |
|---|---|---|
| the rail | 1 row, 47px | **2 rows, 93px** |
| the strip | **421px of 1148px** | a whole row of 828px, **and still 57px past its end** |
| the vault's name | 102px, clipped | 116px, clipped by 14px |
| sideways scrollers | 1 | 1 |

The 57px is the part worth keeping in mind: at **seven** shelves the strip already could not show
itself at 860px. The builder makes twenty easy (`github#10`, `github#3`), so the count was never
bounded by the six that ship.

### What replaces it

**The Manage sheet.** A row's name is a button: press it and the sheet closes and the library
scrolls to that shelf. The sheet already listed every shelf in the library's own order and already
had a door in the rail, so this costs one button and no new furniture — and a list that runs *down*
the page is the shape that survives twenty shelves, which is exactly the shape the strip was not.
A hidden shelf's row is disabled rather than silently doing nothing; hiding still never deletes.

### What was rejected, and why

**"Search already does it."** It does not, and this was read rather than assumed:
`core.matchesQuery` tests a note's title, path, tags, people and body — **never a shelf's name**.
Typing *Encyclopedia* marks the notes whose text says "Encyclopedia"; it does not find the
Encyclopedia shelf. Changing the placeholder to imply otherwise would have put a false claim in the
chrome.

**"Nothing."** Defensible at six shelves, indefensible at twenty, and the builder decides which.

**A sticky shelf heading.** It tells you where you *are*, which is not the job: the strip's one
irreplaceable trick was reaching a shelf several screens down without scrolling past everything
between.

### Where the space went

Not to a wider search box. `.vs-railname` is `flex: 0 1 auto` and its width follows the look's
face, so a search box that took whatever was left would be a **different width in every look**, and
a control is the same size in every look (`design/0016`). Instead the rail borrows the reader bar's
own idiom — one `.vs-spacer` after the hit count — so the name and the search sit left and the
order toggle, the look selector and **Manage** sit right. Every control keeps the width it had.

| | 1180px | 860px |
|---|---|---|
| the rail | 1 row, 47px | **1 row, 51px** |
| the gap | **407px**, as one spacer | none — the spacer is hidden and the search box takes it (455px) |
| the vault's name | **116px, no longer clipped** | 116px |
| sideways scrollers | **0** | **0** |

So: 407px of deliberate gap at the measure, 14px back to the vault's name, which the strip had been
squeezing into an ellipsis — and at 860px a **whole row of rail**, 42px, handed back to the library.

`"the rail is fixed controls, and nothing in it scrolls sideways"` holds it: at both widths no
descendant of `#vs-rail` computes `overflow-x: auto|scroll`, nothing overflows its own box, and the
rail is one row. It reads the computed overflow rather than only the boxes on purpose — a strip that
has not overflowed *yet* is still a strip.

## What this costs

A folder filter was one click; it is now `__vs.setFilters` or a purpose-built shelf. That is
the trade, and it is the right way round: a shelf you built for the folders you actually care
about is better than a filter you re-apply every time, and it persists.
