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
