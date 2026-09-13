# 0019 — A plaque opens its run

### 2026-09-13 — Keep the run supplied by the clicked plate

The contents-picker refresh added address lookup at every book open. Two separated manual
runs can share `tags/-plaque-A`, so resolving that address without a note discarded the
clicked plate's already-built run and chose the first A run. Refresh ordinary books from
the real-book index; retain supplied virtual books. Saved ribbons still resolve by address
and note through their existing path. With acoustics moved to the end of Tags, its plate
now opens one note instead of 1,812; the first A plate still opens its own 1,812 unique notes.

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

## The furniture, and what it is made of (github#9)

> "make the buttons look like the plaques and vice versa"

Once a plaque was a button, the library had two families of small label that did not look
related. A plaque was engraved furniture — brass under leather, a lit acrylic sign under cyber,
a capped label under the shelf floor in modern — and a button was a plain filled rectangle in
every look: `--surface-2`, a hairline, radius 3. They sat centimetres apart in the same room and
read as two products. The bookcase is the thing with a point of view, so the chrome now belongs
to it: **a button is a plate**.

### One material is one token set

The plate is declared once, as tokens, and both rules read it. `page.css` sets `--vs-plate`
and `--vs-plate-lo` (the two ends of a shallow vertical gradient), `--vs-plate-edge` (the
hairline), `--vs-plate-ink`, `--vs-plate-shadow` (a lit top edge and a cast shadow) and
`--vs-plate-ink-shadow` (the engraving under the letters), with a `-lit-` set for hover and
focus. `.vault-shelf button` and `.vault-shelf .vs-plaque` are both drawn from those and nothing
else, so there is exactly one declaration of what the furniture is made of, and a look changes
the material by restating the tokens in its own token block — the brass under leather is the
values the plaque rule used to carry, moved up; the sign under cyber likewise. The alternative,
pasting the plaque's gradient into each look's `button` rule, was rejected because two copies of
a material become two materials the next time one is edited, which is exactly the drift this
started as.

Modern's values are written against the theme tokens (`color-mix` of `--text-1` into
`--surface-2`), so the plate follows Obsidian's light and dark the way the rest of that look
does. A paper surface may restate the set again: under leather, `.vs-sheetbody` and `.vs-page`
declare a **bone** plate — the same engraved label cut from ivory, dark ink, a pale engraving
shadow — for the reason a dropdown on paper is paper (`design/0016`, github#2). A brass plate on
a paper sheet was tried and looked screwed on rather than printed.

**Hover and focus are a token swap, not a paint rule.** `button:hover` and `.vs-plaque:hover`
set `--vs-plate: var(--vs-plate-lit)` and the rest, and declare no colour, background or
shadow of their own. That is what keeps the lit plate off a spine, a ribbon, a swatch and a
contents row: every one of those is a `<button>` too, and a hover rule that set a background
would paint a plate over a book. They never read the tokens, so a swap cannot reach them. A look
therefore ships no hover rule for a button or a plaque at all; the lit tokens are the hover.

### Where the line is drawn: tracking

A plaque says `2024`, `M`, `2010-2019` — one token — and is spaced like an engraving:
**0.14em** in modern, **0.1em** under leather, **0.22em** under cyber, each look's own. A button
says `Previous collection`, and 0.14em on a sentence is not legible. A button gets **0.03em**,
set once in `page.css` for every look, and no case change: small caps at 11.5px in Georgia is
too small to read, and `text-transform` on a sentence is what the issue warned against. So the
two families share everything but the tracking, and the check asserts the gap in both directions
(a plaque at or above 0.1em, a button at or below 0.05em).

### The families afterwards

This list is the deliverable as much as the CSS. Everything clickable in the library is one of
five things:

1. **Plate** — engraved furniture, drawn from the plate tokens: every plain `button` (the top bar,
   the reader bar, the shelf-head row, the sheets' rows and buttons, *Also shelved in*, *Edit in
   Obsidian*, the dye menu's *Automatic*, the builder's recipes), the index tabs (`.vs-tabs
   button`, a plate on the fore-edge that keeps its cut-from-the-page shape and its own cast
   shadow) and the plaque.
2. **Action** — `.vs-primary`: *Save shelf*, *Done*, *Show every shelf*. An accent fill, no
   engraving, no shadow. It is the one button on a sheet that is not a label.
3. **Silk** — the ribbons, `.vs-mark` and `.vs-markstub` (`design/0008`). Dyed fabric, not metal.
4. **Colour** — the swatches, the slot's reset mark and the ribbon swatch (github#4). A swatch is
   the colour it offers, and nothing may sit on top of that.
5. **Paper and cloth** — things that are a `<button>` for the keyboard and are not furniture: a
   spine (a book), a contents row (typography), a shelf jump in the rail (a chip that is nothing
   until hovered), *New shelf* (a dashed invitation). Each resets the plate's `letter-spacing`,
   `box-shadow` and `text-shadow` explicitly, because the base `button` rule reaches every one
   of them and an inherited engraving shadow under a spine title is the kind of leak nobody
   reports and everybody sees.

### Geometry did not move, except where it was already wrong

`page.css` owns every size (`design/0016`), and the plate is paint: gradient, hairline, shadow,
ink, tracking. *Every control is the same size in every look* still measures **38** controls
with 0 off. One thing did move, and it was a drift the check's one-pixel tolerance had hidden:
the leather plaque rule set `border: 1px solid` on all four sides, which overrode the shared
`border-top: 0`, so a leather plaque was **21.75px** high where modern's was **20.75**. The look
no longer sets a border at all, both are 20.75, and the layout goldens were rewritten
deliberately: every plaque row under leather is **1px** shorter, so each following row sits 1px
higher — three rows down, 3px. That is the same-height law finally holding for the one control
it had a pixel of slack on, and it is the kind of thing github#16's audit of the look sheets is
for.

Tracking widens a text-sized button by a few pixels in every look alike — *Manage* is 3px wider
than it was — and a button that sizes to its text is allowed to (`invariants.md`, *Every control
is the same size in every look*). `#vs-order` is pinned at 92px and *Newest first* still fits.

### What the check reads

*The furniture is one material* reads computed style back through CDP rather than comparing
source: in every look, and in both themes of modern, the Order button, Manage, Back, Next and an
index tab resolve to the plaque's `background-image`, `color`, `border-bottom-color` and
`text-shadow`, rested, hovered and focused — with `CSS.forcePseudoState`, since a synthetic
event cannot put an element into `:hover` — and *Also shelved in*, a Manage row's button and
*New shelf…* resolve to the sheet's plate. A spine, a contents row, the ribbon stub, a shelf jump,
*New shelf* and *Done* must not carry the plate's face or its engraving shadow. A focused plate
draws an outline. And the contrast of the ink against both ends of the gradient, rested and lit,
room and paper, is measured against WCAG's **4.5:1**, compositing the sign's alpha over the room
under cyber: the lowest is **5.77:1**, the lit brass plate under leather.
