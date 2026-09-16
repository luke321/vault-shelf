# 0015 — The index

The tabs down the edge of the reading spread, and the order of the contents they point into.

Amended by [0030](0030-contents-order.md): Tags also defaults to A?Z, and every shelf and
book can choose its contents order. The classifier-based table below records the original rule.

## A tab is a position, so the cut must follow the order

The tabs jump to an index in `book.notes`. That is the whole constraint, and it was being
broken: every book's notes were sorted **newest first**, and a book from an alphabetical
classifier was then given **letter** tabs. A, C, F over a list ordered by date point at
nothing in particular; the tab marked C lands on the first note that happens to begin with C,
somewhere in the middle of the Cs.

So the order comes first, and the tabs are cut to match it:

| Book | Order | Tabs |
|---|---|---|
| an Encyclopedia volume (`initial`) | **by title** | letters — `A`, `Aft`, `Al` |
| a year | by date | months — `Jan`, `Feb` |
| a month, a week | by date | days — `04`, `09`, `27` |
| a person, a tag, a folder, a property value | by date | the span it covers |

`core.buildShelf` sorts a book's notes with `byTitleThenDate` when the classifier is
`initial`, and `byDateThenTitle` otherwise. An encyclopedia volume is alphabetical inside; a
record of who you met is not.

## As deep as the book needs

> "the index tabs are often only M for the M book for example but should go Ma Mb Mc etc"

Every note in the M volume begins with M, so one letter is one tab and one tab is no index at
all. `letterTabs()` cuts on one letter, and if that yields fewer than four tabs it cuts on two
— `Ma`, `Me`, `Mi` — and then on three. It stops as soon as the tabs are worth having, because
deeper is not better: `Mar`, `Mat`, `Mea` over a book of forty is a wall of tabs that says less
than `Ma`, `Me`, `Mi`.

**The prefix is the first WORD, not the first characters.** "A note on ferries" cut at three
characters is `A n` — a tab with a space in it, claiming to be a range and sorting nowhere. Its
first word is `A`, so its tab is `A`, and it files next to `A dozen` and before `Aft`. That is
how a volume spine is lettered.

Some books cannot be cut at all: the demo fixture's G volume is 25 notes all titled
"Greenhouse Rebuild — …", and no prefix separates them. One tab is then the true answer, and
the check asserts the tabs the titles *admit* rather than a number the data cannot supply.

## The span, for the books that are neither

A person's book of 62 notes over five years is indexed by year. One of 40 notes inside a single
year is indexed by month. A fortnight of them is indexed by day. `spanTabs()` takes the biggest
unit that gives more than one tab, which is the same rule a printed index follows and needs no
setting.

## Twenty-six, still

Above 26 tabs the list is collapsed into twelve ranges (`Ub–Ug`), unchanged from the first
version: a tab you cannot hit is decoration, and the 10k library's U volume has 404 notes in
it.

## Two things only a screenshot showed

**The 0-9 volume is indexed by year.** It is one book of 351 notes in a vault of daily notes,
and a letter cut can only ever give it the single tab `0-9`. What a title beginning
`2023-02-16` is filed under is 2023, so a numeric head takes the leading four digits and the
volume tabs read 2023, 2024, 2025, 2026.

**Obsidian centres every button, and a contents row is a button.** `app.css` sets
`justify-content: center` on `button`; our rule set `display: flex` and never said otherwise,
so a row with nothing after its title -- one whose date is already in the title, and therefore
has no leader (design/0012) -- floated to the middle of the column. Rows with a leader filled
the width and hid it. `justify-content: flex-start` settles it, and it is the same lesson as
`.spread`: the host styles the elements we build.

## Which end you open

> "it's weird to see a notebook starting with the newest note as if written backwards"

A book ran newest-first, which is what a feed does and a notebook never does. It now runs
**oldest first**, and the top bar carries the one control that says otherwise — in the bar
rather than in a settings sheet, because it is a reading preference and you change it while
reading.

The button says what it **is**, not what pressing it would do. A button labelled "Newest
first" that gives you oldest-first is a coin toss every time.

It applies to books ordered by **date**. An Encyclopedia volume stays alphabetical under both
settings, because "the oldest of the As" is not a thing anybody wants — and because this
record's whole argument is that the tabs are cut the way the book is ordered, so a volume that
flipped would need letter tabs that ran Z to A.

`core.buildShelf` takes the order as its third argument and flips the comparator; nothing
downstream knows. The tabs follow because they are positions in the list, and a saved reading
place re-resolves through the rebuild the way it does after any other one.

## The shelf turns with the book

> "the shelves are not sorted oldest first but the notes inside the books are, both need to be
> oldest first or newest first"

They did not, and it was two settings pretending to be one. Each shelf carried its own
`direction`, set when it was built; the top bar turned the notes inside every book. A Years
shelf therefore ran 2026 back to 2015 while every book on it ran forwards.

`buildShelf` now takes the order for **date** classifiers — year, month, week — from the same
control, and the builder disables its own direction control for those shelves and says why. A
shelf classified by a person, a tag, a folder or a property keeps its `direction`, because
A-to-Z is not something a reading order has an opinion about.

## The date index is layered (2026-09-11)

> "the right side indexes are not consistent in tag books, sometimes only the day 22,
> sometimes the month as number, sometimes month as three letters … for 3 notes on following
> days I don't need an index, notes in different months yes but also show the year"

A year book, a month book and a tag book were cut three different ways — months, then days,
then whichever single unit happened to split the book — so the same kind of tab read `Jul` in
one book, `07` in another and `2024` in a third. Every date-ordered book is cut the same way
now: **years, then the months inside a year, then the days inside a month**, each layer drawn
only where it separates something.

- A layer with one group is not drawn: a book that is all 2026 does not need a 2026 tab.
- A group of three notes or fewer is not cut further: three notes on following days are three
  rows on the left, not an index.
- ~~The whole thing is capped at about thirty tabs, dropping days first and then months.~~
- ~~The layers step in from the edge — a year tab is bold and widest, a month tab steps in, a
  day tab steps in again.~~

**Both struck through by [0034](0034-the-thumb-index.md).** The cap was a mitigation for the
overflow wearing the clothes of a design rule, and it is why a book of 2,450 notes showed eleven
year tabs with nothing under them: the layers are nested now and the rail draws one of them at a
time, so nothing is dropped to make it fit. The step-in went with it — every level standing in
one column is what ran off the bottom of the page — and the trail says which layer you are in
instead. What this section settles and 0034 does not touch is **what the layers are**: years,
then months, then days, each drawn only where it separates something.

The Encyclopedia keeps its letters; the letter cut and the date cut are the two orders a book
can have, and the tabs follow whichever the book is in.

## The contents follow the jump (2026-09-11)

> "when I click an index tab on the right, the index on the left should also move a marker
> there and scroll"

A tab is a position in the contents, and the contents did not go there. The marker moved —
`aria-current` was on the right row — but the left page is its own scroller and nothing ever
set its `scrollTop`, so on a book of two hundred notes the marked row was three thousand pixels
below the fold and the tab had, visibly, done nothing.

`revealCurrent()` brings the row in after every render of the contents, and three choices are
worth recording:

- **The smallest move, not the centre.** A printed index is thumbed to the entry, not re-opened
  at it. A row in view stays where it is; a row past the fold comes up until it sits one row's
  height inside the edge. Turning one page with Next therefore moves the list by one row or
  not at all, instead of re-centring forty rows every time.
- **The page's own `scrollTop`, never `scrollIntoView()`.** That call walks every scrolling
  ancestor it can find, and inside Obsidian those are the workspace's. This codebase has been
  moved by it before.
- **Only when the note changed.** The same function redraws the list for the find-within box,
  and a redraw that changes nothing must not pull the list away from somebody reading it.
  `reader.revealed` is the note the list was last brought to.

Smooth unless `prefers-reduced-motion` asks for instant. And the marked row gained a bar in
the margin in the default look — weight and colour alone were not a marker on forty rows of
the same face; the leather look already knew this. `github#11`.
