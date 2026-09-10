# 0015 — The index

The tabs down the edge of the reading spread, and the order of the contents they point into.

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

