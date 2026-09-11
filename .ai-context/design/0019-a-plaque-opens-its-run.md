# 0019 — A plaque opens its run

> "would be cool if clicking a plaque does something"

A plaque was a label and nothing else (`design/0003`): the year under a run of months, the
decade under a run of years, the letter under a run of people or tags. Clicking it was inert.
It now opens what it names as one book: click `2024` under Months and the reader opens on every
note of 2024, in reading order, with the contents cut by month; click `2010-2019` under Years
and it is the decade; click `M` under People and it is everyone whose name starts with M. The
right-hand page reads the same as any book.

## Open, not narrow

The alternative in the issue was to narrow the shelf: clicking `2024` filters the library to
that run (`design/0002`), the way the active-filter chips do. It is cheaper — no book, no
address — and it is the wrong verb. A filter changes membership across the whole library and
leaves you standing in front of a shelf with fewer books on it; it also changes the shelf's
count, which is exactly what the plaque was there to help you scan. The product's verb is
**open**: everything on a shelf that can be clicked opens into the reading spread, and a plate
that instead rearranged the room would be the one control on the page that did something
else. So a plaque opens a book.

## What it opens is the run

**A plaque-book is the union of the books under the plate, and a note in two of them is one
note.** That is the unique-notes law applied one level down: a person's note that is also a
second person's note sits in two of the M books and once in `M`. The count in the reader's
meta line is `notes.length` of the deduplicated union, and it says how many books it came
across — `37 notes across 14 books`.

The books under the plate are **the run** — the adjacent books that carry that plaque,
computed over the shelf's full sequence and not per row, so a run that wraps is still one run.
On a sorted shelf every book with a given plaque is adjacent, so the run *is* the unit: all of
2024, all of the decade, all of M. On a manual shelf (`design/0018`) a plate says only what is
under it, and a person who has split 2024 into two runs has two `2024` plates that open two
different books, each the run it stands under. `core.runsOf(books)` is the one grouping rule,
and `renderTrack` groups its row with the same adjacency, so what a plate opens is what a
plate names — never more.

The order inside is the order any book has (`design/0015`): `byTitleThenDate` on an
Encyclopedia shelf, `byDateThenTitle` turned by the top-bar toggle everywhere else. The index
tabs are then cut the way they are for any book — a year book's contents fall into months, a
decade's into years, a letter's into the span it covers — without a line of new code, because
`indexSections` reads the notes and the shelf's classifier and nothing else.

## It has an address

**`shelfId/-plaque-<label>`**, and the label is the plaque's text: `months/-plaque-2024`,
`years/-plaque-2010-2019`, `people/-plaque-M`. The key starts with a hyphen for the reason
`-undated` and `-unfiled` do (`decisions/0002`): it can never collide with a real key.

The other option was to open the plaque-book with no address and refuse ribbons on it,
visibly. It was rejected because a book you cannot leave a ribbon in is not a book — the
whole reason to open the decade rather than filter to it is to *read* it, and a place you
cannot come back to is the one thing the reading spread promises you can. With an address
every existing mechanism works unchanged, because every one of them treats an address as an
opaque string keyed into a map: wear (`settings.wear[id]`), a chosen colour
(`settings.bookColors[id]`), a shelf's hashed dye slot (`hashSlot(id)`), the ribbons
(`settings.reading[].bookId`), the history behind *Previous collection*, and `markWear`'s
attribute query. Nothing splits a book id on `/` — a tag key already contains one.

**A plaque-book is not on the shelf.** `view.books` is the shelf's books and `__vs.addresses()`
lists exactly those, so the address list a rebuild is measured against does not change, and
neither does any count. The plaque-book is synthesised when it is asked for:

- `core.plaqueBook(view, run, order)` builds one from a run;
- `core.plaqueBookFor(view, label, noteId, order)` finds the run: the runs with that label, and
  among them the first that holds `noteId` — on a sorted shelf there is one; on a manual
  shelf with a split label this is the law's own rule, *the first book that still holds the
  note*, applied to runs;
- `findBook(id, noteId)` on the page and `core.resolveReading` both fall through to it when
  the id carries the `-plaque-` marker, so a saved ribbon re-resolves through a rebuild and the
  Reading shelf shows the plaque-book as a spine like any other, as thick as its count.

`resolveReading` needed the note order to do this, since the synthesised book has to be sorted
the way the shelf's books are; it takes it as a fourth argument, defaulting to oldest first.

## Two plates, one book

A run that wraps is drawn with a plate on every row it reaches (`design/0014`). Both plates
carry the same label on the same shelf and open through the same `runsOf`, so they open the
same book with the same address. The check clicks both and compares the reader's book id.

## A plate is a button now

`.vs-plaque` is a `<button type="button">`, which is what makes it reachable by keyboard and
lets it carry focus. Two laws had to survive that:

- **The plaque sits in its row**, below the floor, in the same scroller. A button brings the
  host's own button styles with it — Obsidian's `app.css` and this page's own
  `.vault-shelf button` rule, which sets a 26px minimum height — so `.vs-plaque` resets
  `min-height`, `height`, `line-height` and `font` to what the `<div>` had. The layout golden in
  `scripts/layout-snapshots/` is the proof: a plate that grew a pixel would repack the row.
- **A look is paint** (`design/0016`). `page.css` owns the geometry; each look paints hover and
  focus — a brighter border and the reading colour in the modern look, a lit brass plate in
  leather, a neon glow in cyber — and none of them moves anything. `:focus-visible` uses an
  inset outline, which has no layout.

The cursor is a pointer and the plate lightens under it, so it reads as clickable without a
tooltip; `title` and `aria-label` stay off it for the reason they are off spines
(`design/0005`) — the text is the label.

## What the reader shows

The title bar reads `Months · 2024`; the heading `2024`; the meta line `37 notes across 14
books · 3 source folders`. *Also shelved in* lists, among other things, the note's own month
on the same shelf, which is how you step from the year down to the month you were reading.

## What is not decided here

Whether a plaque-book should show a ribbon mark of its own on the shelf. The month spines
under it already hang a ribbon for every marked note they hold, so the mark is on the shelf
either way; a mark on the plate would be a second copy of the same fact. Left off.
