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
two New shelf buttons, and that they bracket the shelves in document order.

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
| a jump chip per visible shelf, with its book count | the shelf list, as one line |
| the search box | `design/0008` — it marks, it does not narrow |
| the hit count | `12 notes in 4 books`, or nothing |
| **Manage** | reorder, hide, restore |

The per-shelf **Edit** and **Hide** buttons live in the shelf's own header and are invisible
until you hover it, so a room at rest is books and labels and nothing else.

## What this costs

A folder filter was one click; it is now `__vs.setFilters` or a purpose-built shelf. That is
the trade, and it is the right way round: a shelf you built for the folders you actually care
about is better than a filter you re-apply every time, and it persists.
