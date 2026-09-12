# Invariants

Properties that must not regress, and the command that checks each one. **Every number here
was measured, not reasoned about.** If a check fails because behaviour changed on purpose,
update this file and the check in the same commit — a check quietly relaxed is worse than one
that fails.

Run one: `node scripts/smoke.mjs --only "<substring>"`. Run all of them: the pre-push hook does.

**A fresh library seeds its Favourites shelf** (`github#35`). The shelf still ships empty in
`core.defaults()` — the check that pins that is unchanged — but a page mounted with no saved
settings at all seeds it from the library it has just built: the newest year, the newest month,
the busiest person and the busiest tag, four addresses off four different shelves. A reader
meeting an empty rail learns nothing about what a favourite *is*, and the film is shot on a
fresh library. `"a fresh library seeds its favourites from its own shelves"` measures what
`core.seedPicks` chooses rather than what is on the rail, because seeding happens once at mount
and the checks in a shard share one page. Measured: **4 favourites off 4 shelves, 0 dead, 0
empty, 0 an `-undated` or `-unfiled` book** — `2026 (1697)`, `Sep 2026 (301)`,
`Mira Vance (613)`, `#project/website-migration (866)`, **2,547 unique notes** against a sum of
3,477, which is the unique-notes law one level out.

Seeding fires only when the host passed **no settings at all**. Once anything has been saved,
an emptied Favourites shelf stays emptied.

**A favourite is worn by its source's address** (`github#35`, `design/0019`). The spine read
`wear[sourceOf(book).id]` and `openBook` wrote `wear[book.id]` — the same string for an
ordinary book and two different ones for a favourite, so wear recorded through a favourite's
address was wear nobody ever read back. Found because seeding put a book on that shelf: the
wear check picks the first book in the library, which had never been a reference before. Now
**2 spines** show it, the favourite and its source.

**A title is its own** (`github#36`). 362 authored phrases over 2,883 worded notes is each
phrase four times, and a suffixed copy sorts directly against its original, so the contents
read as a wall of near-copies: *Indexing is the work*, *— scope*, *— week one*, *— week two*.
**77% of neighbouring titles shared a stem.** Titles are combined now — a verb or an adjective
against a subject, or a subject against a facet — dealt without replacement, with a **quota per
opening word** so that no template's size decides how often one word opens a run.

| | before | after |
|---|---|---|
| distinct stems, of 2,883 worded titles | 660 | **2,521** |
| neighbours sharing a stem | **77.1%** | **12.5%** |
| longest run of one opening word | 52 | **15** |
| biggest group of one subject | 6 | **4** |

Two of those only showed up by reading the list rather than the number. A subject-first
template repeats its subject (*Irrigation line for the cellar*, *… for the shed*), so both
opener templates lead with the verb or the adjective and the subject-first one has a smaller
quota. And **no two openers share a root**: `Insulated` sorts directly against `Insulating`,
and the two read as a single run of sixteen.

It costs the thinnest Encyclopedia volumes their upright covers. A wider vocabulary is more
volumes, `github#34` squeezes them into one row, and at **18px** a `学` cannot be drawn upright
— it is turned on its side rather than clipped. The check asserts that every short cover is
upright *except* the ones the page names as not fitting, at most four, and that nothing upright
is clipped.

Measured 2026-09-11 on **the** fixture vault — `decisions/0014` replaced three with one, so
a number here no longer comes in threes: **4,938 notes / 17 folders / 25 people / 43 tags /
531 undated**. It draws **227 spines** across the five visible default shelves and holds
**691 addresses** in all (687 of them before the Favourites shelf was seeded). `github#17` made it eleven years and five thousand notes; the
numbers below moved with it, and `changelog-detail.md` gives each one its old value, its new
value and a reason.

The vault's own shape: **eleven years to 2026-09-11, ending today by default**, recent-heavy
(**54 notes in 2015, 1,755 in 2026**, and **2,268 in the rolling twelve months** against 146
before, none of its months below **123**); **2019 is empty on purpose** — the year nobody wrote, so a chronological shelf has a
gap to survive; a PARA-ish tree of ten numbered folders with four nested ones, a `Templates`
folder and three notes at the root, the largest holding **1,204 of 4,938** notes; **24 named
people on a long tail** — one in 613 notes, eleven in three or fewer — plus a twenty-fifth who
is only ever linked; **43 tags**, three levels deep, two non-Latin, three over thirty
characters and eighteen on a single note; **459 ISO weeks hold a note and none of the last 52
is empty**.

What it absorbed from the two fixtures it replaced (`decisions/0014`): a fifth of the notes
that are not about a day are undated, titles open with digits, punctuation and four scripts,
a handful of notes name five people and six tags at once, and two headers are impossible
dates. What it gave up, deliberately: the sparse fixture's **82 % dominant folder** (the
largest is now 24 %) and the **10,000-note scale** — nothing measures the product at that size
any more.

---

## The library renders, and it renders quietly

The page mounts, the core is on `window`, and spines are on screen before any check reads a
number. `"__vs is present and the library rendered"` is the gate the harness waits on before it
starts, so a failure here means every other number would have been measured against nothing.

`"the page loads with no console errors"` reads `Runtime.exceptionThrown` over CDP and asserts
zero. It is the cheapest check here and it has caught more than its share.

## The seven default shelves are the seven default shelves

`"the seven default shelves are there, in order, Favourites first"` — `favourites`,
`encyclopedia`, `years`, `months`, `weeks`, `people`, `tags`, in that order, by id. The order is
the argument the product makes on first open (`design/0002`, `design/0019`), so it is asserted
rather than assumed.

## A shelf's note count is unique notes, never the sum of its books

This is the central law. A note with three people belongs in three books; the shelf still holds
one note. `"a shelf's note count is unique notes"` walks every shelf, collects note ids across
every book into a set, and asserts the set's size equals the shelf's own `noteCount`.

It also reports how many shelves have `sum > unique` — that is, how many genuinely place a
note in more than one book. Measured: **3 of 7** do — Favourites at **3,552/2,611**, People at
**5,969/4,938** and Tags at **8,150/4,938**. The notes that name five people and six tags at once — eleven books for one
note — are declared in the vault rather than in a second fixture (`decisions/0014`). A run
where **no** shelf overlaps means the fixture stopped exercising the law and the check has
gone quiet without failing.

## Every note has at least one address

`"every note reachable from the vault is on at least one shelf"` collects every note id in
every book of every shelf and asserts nothing in `data.notes` is missing. With the six defaults
this is guaranteed by the Encyclopedia alone — every note has a title — and it is checked
anyway, because the day somebody adds a filter to a default shelf is the day notes start
disappearing quietly.

## A book opens on its oldest note

`"a book opens on its oldest note, and the top bar says which end"` asserts that a date-ordered
book's notes run **oldest first**, that the top-bar button reads `Oldest first` with
`aria-pressed="false"`, that clicking it reorders the same book newest-first and the label
becomes `Newest first`, and that an Encyclopedia volume stays **alphabetical under both**.
Measured: `2022-10` holds 24 notes, opening on the earliest of them.

The button says what it is rather than what pressing it would do; `design/0015` says why, and
why the Encyclopedia is exempt.

## A note with no date of its own

`"a note with no date of its own takes the earliest stamp the file has"` drives `core.stampOf`
and `core.resolveDate` directly. A file created 2019-05-17 and edited 800 days later stamps
**2019-05-17**, and so does the same pair the other way round — the earlier of the two, because
a bulk reformat moves the modification time forward and copying a vault moves the creation time
forward. Nothing usable gives **null**. The precedence is unchanged and checked in the same
breath: a declared `date` wins (2021-03-04), then a date in the title (2020-08-08), then the
stamp (2019-05-17), and with the fallback off it is **Undated**.

`decisions/0003` was amended for this, and it carries the measurement that says when the
fallback is worthless: all 545 files of the author's own vault stamped inside `2026-06` to
`2026-09`, because the vault was moved onto that machine in June.

## Undated is a book, not a guess

`"an undated note lands in Undated"` counts notes with `date === null` and asserts the Years
shelf's `-undated` book holds exactly that many, and that it sorts **last**. Measured on the
the vault: **531 undated notes, 531 in the book**, which sorts last. `decisions/0003` is
why there is an Undated book at all rather than a file-stamp fallback.

The vault puts a fifth of the notes that are not about a day there on purpose
(`decisions/0014` folded that in from the sparse fixture). A run where the count is
zero on that vault means the fixture or the date resolution changed.

**This is the check that caught the `DEL` byte.** It reported "18 undated notes, 0 in the
Undated book, which sorts at -undated" -- a sentence that disagrees with itself, because the
key printed as `-undated` and compared unequal to it. See `changelog-detail.md`.

## The ISO week keeps its week-year

`"an ISO week keeps its week-year across a January boundary"` asserts four things against
`core`, not against the page: `2027-01-01` is `2026-W53`, `2026-12-31` is `2026-W53`,
`2027-01-04` is `2027-W01`, and `weekRange("2026-W53")` spans `2026-12-28` to `2027-01-03`.

Keying week books on the calendar year splits that week across two shelves. This is the one
date rule that is wrong in most hand-written implementations.

## The Encyclopedia opens with 0-9

`"the Encyclopedia opens with a 0-9 volume"` asserts **zero** books whose key is a single
digit. A vault whose titles start with dates would otherwise open with ten one-note books
before it reached A. Measured: 0 single-digit books, and the `0-9` volume
holds **2,063 of 4,938** notes, because its daily, meeting and 1-on-1 notes are titled with an
ISO date.

## Plaques are date-only and asked for

`"year plaques only appear on date classifiers, and only when asked for"` compares, per shelf,
whether it *wants* plaques (`shelf.plaques`) against whether any of its books *has* one. The
two booleans must be equal on every shelf. A "year" plaque over a People shelf would be a year
taken from nowhere.

`"a plaque sits under the books it names, in the same scroller"` is the geometric half: the
plaque hangs **below the shelf floor**, not on top of the books — its top clears the board by
at least the board's own thickness — and one row contains both. Measured:
the plaque hangs **19px** below its books, clearing the **5px** floor, and matches their width
to **0px**. (12px over 3px until 2026-09-11, when re-reading the check's own output against
this file found the two had drifted apart; the geometry had not moved, the note about it had.) The floor is drawn as a background line on the track rather than as its bottom
border, which is what leaves room underneath for a plate to hang; `design/0003` is why being
in the same element is structural rather than positional.

`"years group under decade plaques, and a run that wraps is named on both rows"` asserts that
every dated year book carries a plaque whose range is a real decade — starts on a multiple of
ten, spans exactly ten years, and contains that year — that **Undated carries none**, and that
no plate anywhere in the library is drawn over an empty run. Measured: **11
dated year books under `2010-2019` and `2020-2029`, 52 plates across every shelf, 0 of them
orphaned**.

`"a settings file from schema 1 comes up with its decades on"` migrates a schema-1 blob and
asserts the Years shelf comes back with **plaques on**, that Months keeps its own and People
stays off, that wear and date fields survive untouched, and that a file **already at schema 2
keeps its plaques off** -- once the option can be expressed, the file means what it says.
Measured: `schema 1 -> 2: Years plaques true, Months true, People false, 3 opens survive`.

Under schema 1 the plaques checkbox was disabled for a year classifier, so `plaques: false`
on a Years shelf was the only value the option could hold and never a decision anybody made.
Turning it on is finishing the migration, not overriding a preference.

The label is the decade it holds, not `2000-2010`. The friendlier form is a lie: 2010 belongs
to the next plaque's run, and two plates claiming the same year is worse than an unfamiliar
label.

**This check is in the serial lane.** It reads a laid-out box, and four browsers contending for
one GPU report a geometry that has more to do with the other three windows.

## A plaque opens its run

`"a plaque opens the run it names as one book of unique notes, and both plates of a wrapped run
open the same one"` finds the plaque-run in the library with the widest gap between the sum of
its books and its unique notes, clicks the plate (a `<button>`), and asserts the reader opened
on `shelfId/-plaque-<label>` with exactly the unique count of rows, the title bar reading
`<shelf> · <label>`, the meta line opening `<unique> notes across <n> books`, and that Escape
closes it; then finds a plate drawn on two rows anywhere in the library, clicks both, and
asserts the same book id; and that the address list, book count and spine count are what they
were. Measured: `Tags · A` **1,812 unique across 7 books that sum to 2,043**, 12 tabs,
`-plaque-2018` drawn on two rows opening the same book. `design/0019`.

`"a ribbon left in a plaque-book re-resolves after a rebuild, and the Reading shelf holds it"`
opens the biggest plaque-run on the first plaqued shelf **by address** through
`__vs.openBook`, leaves a ribbon, asserts `settings.reading` holds one mark against that id and
that `core.resolveReading` returns a book with that id; rebuilds (`setFilters({})`) and asserts
the reader is on the same book and the same note and the Reading shelf shows the plaque-book as
a spine whose count is its unique notes and which hangs one ribbon; takes the ribbon out and
asserts the spine is gone. Measured: `years/-plaque-2020-2029` **3,908 notes**.

`"on a manual shelf a plate opens what is under it, not the whole letter"` turns Tags manual,
moves the first book of the first letter with two or more books to the very end — past
Untagged — so that letter is drawn on two plates, clicks each and asserts the last opens
exactly that one book's notes and the first the rest of the letter's unique notes, under the
same address; then puts the shelf back. Measured: `acoustics` **1 vs 1,812**.
`design/0018`, `design/0019`.

The plate became a button without moving: *a plaque sits under the books it names* still reads
**19px** below the books with **0px** width difference; *every control is the same size in every
look* measures **38** controls in three looks with 0 off; and the layout golden is unchanged.
(The floor under it was 3px then, 5px by `github#0` and **10px in every look** since
`github#14`; the plaque's offset is `calc(var(--board) + 9px)` and follows it.)

## A book is as thick as it is full

`"a spine's thickness is its note count"` reads `--spine-w` off every spine on the Years shelf
and asserts that widths rise with note counts, that the fullest book is as wide as any book on
the shelf, and that every width falls between **22px and 58px**. Measured:
**40px for a 54-note book, 56px for the 1,755-note one**; before `github#17` **45px at 309
notes and 50px at 1020**.

**An index fits on one shelf, and is squeezed until it does** (`github#34`). `0-9` and the
alphabet across two rows reads as a broken set rather than as a bookcase, so an `initial`
shelf reserves **`INDEX_SLOTS` = 35** volumes — `0-9`, A–Z and eight more for whatever scripts
a vault has — and scales every volume on it by a single factor until they fit one row, with a
floor of **13px** rather than the usual 22. Thickness still rises with the note count there;
the scale is smaller. The factor is found by **measuring, not by dividing**: every width is
rounded to a pixel, and a rounded sum overflows the room the ratio said would hold it.

Measured on this vault: **35 volumes on 1 row**, widths **21–40px**, against **23 + 12 across
two rows** at 30–57px before. The library is **10 rows** where it was 11. Below roughly a
640px room the alphabet cannot fit even at the floor, and it wraps again — "always" has that
edge, and the golden at 390px is where it shows.

The check above measures the **Years** shelf, which is not an index and is unaffected.
A width being equal is a tie, not an identity: two counts a few notes apart round to the same
pixel. The scale is logarithmic and it is taken against the largest book in the whole
**library**, never in the shelf, so the same thickness means the same size everywhere on the
page. `design/0011`.

Both bounds and the scale are constants in `src/page.js` (`SPINE_MIN`, `SPINE_MAX`,
`thicknessOf`). Changing one changes this section in the same commit.

## An impossible date is not a date

`"an impossible date is not a date, and never a fifteenth month"` asserts three things at once:
every resolved date passes `core.isIsoDay`, no month book has a key outside `01`-`12`, and any
note whose `date` header is not a real day is either **Undated** or dated from its filename —
never from the broken header. Measured: **4 impossible headers, 1 fell
through to the filename, 1 Undated, 0 landed anywhere else**.

Both notes are declared in the vault rather than left to chance, because this is the case that
separates "declared, never inferred" from "parsed loosely". The check reports what it found in
its own words, and the two structural halves still hold.

**This check exists because the exporter and the plugin disagreed about the same note.**
`src/build-shelf.mjs` had its own `ISO_DAY` regex, which accepted `2024-15-01`, so a real
vault's ordinary typo became a month book labelled "15 2024" — visible in a demo film, and
only there. `core.isIsoDay` had always rejected it. The exporter now evaluates the core bundle
and calls `core.resolveDate`, so there is one implementation. See `changelog-detail.md`.

## Book addresses are stable across a rebuild

`"book addresses are stable across a rebuild"` records every book id in order, filters the
library to a search that matches nothing, clears it, and asserts the address list is identical
element for element. `decisions/0002` is the reasoning; this is the assertion.

## Filters change membership and nothing else

`"a filter changes membership without moving a shelf"` applies the biggest folder as a filter
and asserts three things: the filtered note count went down, the shelf **order** is unchanged,
and clearing returns to exactly the starting count. Measured: 4,938 -> **1,204** under
`04 - Daily Notes`, back to 4,938.

A filter that reorders shelves would break the one thing the product promises about
orientation: a shelf lives at a stable address in the room.

## A shelf arranged by hand moves nothing but the sequence

`design/0018`. Six checks, one per thing the feature is not allowed to break. Every one of them
puts the shelf back the way it found it, because the checks in a shard share one page.

`"a shelf arranged by hand keeps every address and starts where it stood"` switches People to
`manual` and asserts the sequence and the whole library's address list are unchanged, that
every spine on that shelf became draggable and none on the automatic Tags shelf did, and that
nothing has been written to `order` yet. Measured: **26 books**, **691 addresses** unchanged,
**26/26** spines draggable, **0** elsewhere.

`"Alt+Right moves a book one place, and it survives a rebuild and a reload"` focuses the first
spine, sends `Alt+ArrowRight`, and asserts the first two books swapped, the rest did not move,
the whole sequence was saved as keys, a rebuild reads back the same sequence, `core.migrate`
over the settings blob returns the same `order`, and focus followed the book. Measured:
`Bo Lindqvist, Celestine Marchand, …` → `Celestine Marchand, Bo Lindqvist, …`, **26 keys**
saved, focus on `people/Bo Lindqvist`.

`"a drag and drop moves a book the same way a key does, across rows"` picks the shelf with the
most books, scrolls it into view, and dispatches a real `dragstart` / `dragover` / `drop` with
a `DataTransfer`, dropping the first spine on the right half of the last one. It asserts the
book landed at the end, the mark was drawn on the right side and is **3px** wide, the carried
spine was flagged as lifted, the payload was the address, and no mark was left behind.
Measured on Months: **110 books over 4 rows**, the first dragged onto the last across rows
(library) — a different row in all three, so the cross-row case is the one being measured.

`"the reading order in the top bar leaves an arranged shelf alone"` gives the Years shelf a
hand-made sequence, clicks the top bar's order button twice, and asserts the sequence did not
move — with the automatic Months shelf as the control, which must turn round. Measured:
**17 / 6 / 12** year books held still while **136 / 30 / 122** month books reversed.

`"a book nobody has arranged stands at the end of the shelf"` leaves the first key out of
`order`, which is what a note that arrived after the arrangement looks like. Measured:
**9 of 10**, **7 of 8**, **10 of 11** named; the unnamed book stands last and every address is
still there.

`"a filter narrows an arranged shelf without shuffling it"` arranges People, applies the
**smallest** folder — the first is usually the one holding most of the vault, and a filter that
removes nothing proves nothing — and asserts every surviving book is still in the arranged
order, then that clearing puts all of them back in it. Measured: **10 → 1** under
`(vault root)`, **8 → 1** under `journal`, **11 → 11** under `Journal`.

Not covered by a number: that a decade a person splits shows two plates in one row rather than
one plate over two runs. That was checked by looking — dropping *Marta Ortiz* between two A
names on the mirror vault's People shelf gives `A | M | A`, ten plates over ten groups in the
first row.

## The Favourites shelf holds references, and only references

`design/0019`. Four checks, and each one empties the shelf again on its way out, because the
checks in a shard share one page.

`"Favourites comes first and empty, fresh and by migration from schema 9"` asserts the fresh
list is `favourites -> encyclopedia -> years -> months -> weeks -> people -> tags` with a
`pick` shelf first holding **0 picks**, and that a schema-9 file of three shelves comes up at
schema **10** as `favourites -> years -> people -> tags` — Favourites at position **0**,
`direction: "manual"`, and every other shelf in the relative order it already had, a hidden
People still hidden and a hand-arranged Tags keeping its sequence (`b|a`). A file that already
says 10 is left alone (`years -> people -> tags`, no pick shelf added); a file whose own shelf
has taken the id comes up `favourites-2 -> favourites`. A hand-edited pick shelf is normalised:
`direction` manual, `order` dropped, `plaques` off, and of
`["years/2024", 7, "years/2024", "nope", "", "people/Ada Lovelace"]` exactly the two real
addresses survive. It is settings arithmetic, so the vault cannot change the answer.

`"a drop onto Favourites adds the book where it landed, and a rebuild keeps it"` dispatches
real `dragstart` / `dragover` / `drop` events with a `DataTransfer`. The empty rail says
**"Drag a book here, or right-click to make one"** at **132px** — a spine's height — and takes the accent while a book is
over it; a Years book dropped on it arrives holding **the source book's own notes**, addressed
`favourites/<source address>`; a People book dropped past it draws the **3px "after" mark** from
`design/0018` and lands second; dragging that one onto the first's left half reverses the two
and leaves **0** marks behind. A rebuild, a folder filter and `core.migrate` over the settings
blob all read back the same picks, and the favourites' addresses are unchanged across the
filter. Measured: the dropped year held **54 notes**, the
filter cut the shelf to **2 books / 48 of 134** notes without touching the
picks, the shelf's own head read **"2 books · 135 notes"** (the jump chip carried this until
`github#38`), and **12/12** Years spines
were draggable while **0** of them became `data-hand` handles — lifting is not arranging.

`"a favourite comes off by the menu, and a dead pick is dropped on save and not before"`
right-clicks a favourite's spine and asserts the `#vs-dye` menu offers **"Take off
Favourites"**, then right-clicks the source spine and asserts the same menu offers **"Add to
Favourites"**. It then hides the People shelf — **2 of 2** favourites still resolve, because
hiding keeps a shelf's books — and then deletes that shelf from the settings: **1 of 2**
resolves while the picks are still both, and only the next save writes the survivors. Measured
`[people/Halvor Estrin, years/2015]` drawn as one book, still two picks in the
file, and `[years/2015, months/2015-09]` after a save. Restoring the shelf brings the book back.

`"a favourite dragged off the shelf comes off, and a cancelled drag does not"` drives the
gesture in four parts and is the check that guards the one unrecoverable act in this feature.
Carrying a favourite off the rail marks its spine as leaving and clears the insertion mark
(**0** left on the rail); dropping it on the Years shelf takes it off Favourites and **does not**
add it to Years, which still has **17 / 6 / 12** books. Carried off and back over the rail the
mark clears again and the book stays — landing at the **end**, which is what a drop past the last
book means everywhere on this shelf, so membership is asserted and the order is reported. A drag
that ends with **no drop at all** — Escape, or a drop outside the window — keeps the book and
leaves **0** spines marked; that is the cancel path, and it is why removal is bound to `drop`
rather than to `dragend`. A spine from an ordinary shelf dragged across the library changes
nothing.

`"a second favourites shelf is built from the builder and holds its own books"` drives the
builder's own controls rather than `addShelf`: it opens the New shelf sheet, types a name, picks
**Books you drag onto it** and saves. It asserts the classifier list offers `pick`; that what
was saved is `manual`, has an empty `picks`, no `order` and no plaques; and that the form drops
the source question, the order and the recipes while **keeping the classifier** — the control
that made it a pick shelf and the only way back out — and shows the hint in place of the rule.
Then it holds **two** pick shelves at once, `Favourites` and `Reading list`, with **1 and 2**
books over **2** rails: the same year book sits on both and has **2 addresses**, one per shelf,
and taking it off the first leaves **0** there and **2** on the second. The right-click menu on
an ordinary spine offers exactly `Add to Favourites | Add to Reading list`. It is the builder
and the settings rather than the vault, so the vault cannot change the answer.

`"a note in two favourites is one note on the shelf"` favourites a year and one of its months,
so every note of the month is in both books. Measured: **60 places / 54 unique**
(`years/2015` and `months/2015-09`); the shelf claims the unique count and its header says
so. It is the same law as *a shelf's note count is unique notes*, one level further out, and
`checkMembership` walks the pick shelf like any other.

Not covered by a number: that the reader is never told a pick shelf exists. Opening a favourite
opens the source book, so `resolveReading`, `alsoShelvedIn` and the wikilink search all skip
pick shelves — the argument is in `design/0019`, and what a check would have to assert is the
absence of a second address for one book.

## A book made on the shelf is a saved query, and a place a note lives

`design/0020`. Three checks, driven through the real right-click menu, the plus and the real sheet,
and both empty the shelf again on the way out.

`"a book made on the shelf holds the notes it points at, where it was made"` right-clicks the
empty landing and asserts the rail menu (`#vs-railmenu`) offers exactly **"New book here…"**
under the shelf's name while the dye menu stays shut; that the sheet opens with the name field
focused and no Delete on it; that the name comes up **suggested from what it holds** — the
leaf of the first folder, then the leaf of the chosen one, *Everything* for the whole vault —
and that a name cleared to nothing comes back as the suggestion and saves as it (never
*Untitled book*); that the count under the form is the **real** one; and that Save
makes a book addressed `favourites/-made-dailies` — key `-made-dailies`, label `Dailies`,
holding exactly the notes of the vault's biggest folder, on a spine that is draggable, a hand
handle, focused, and has taken the landing's place, with the shelf head reading
**"1 book · 1204 notes"**. Then the
laws: a year favourite beside it overlaps it and the shelf claims the **unique** count; a filter
to another folder leaves the book on the shelf with the same address and picks (an empty spine
when nothing survives); `migrate` round-trips `picks` and `made`, and a hand-edited file of
`picks: ["-made-gone", "years/2024", "-made-x"]` with definitions for `-made-x`, a nameless
`-made-bad`, an unlisted `-made-lost` and a slashed key comes up as
`[years/2024, -made-x, -made-lost]` defining `[-made-x, -made-lost]`; a second book
right-clicked into the gap before the year lands **between** (`[-made-dailies,
-made-everything, years/…]`) holding the whole vault, with the value list hidden for "the whole
vault"; Alt+Right moves it one place; and a ribbon left in it **resolves to it**, is drawn on
its spine, puts it on the Reading shelf, *also shelved in* offers it and **not** the reference
beside it, and opening it opens it. Measured: **1,204** notes
in `04 - Daily Notes`; with the year beside it **1,258** places
are **1,228** unique notes and the header says so; the whole-vault book holds
**396 / 758 / 10000**.

`"a made book is edited, emptied and deleted from its own menu, and the vault does not move"`
right-clicks a made spine and asserts the dye menu offers the **12** swatches and then exactly
`Edit book… | Delete book` — no *Take off*; that *Edit* opens the sheet filled in (`Dailies`,
folder, the folder's name, Delete offered) and that a rename to `Journal` and a new predicate
keep the **same address** while the notes become the tag's (**78 / 73 / 1198** for the vault's
top tag); that a source the vault has lost leaves an **empty spine** (`data-empty`) which a save
keeps, unlike a dead reference; that an abandoned drag (marked leaving, then `dragend`) keeps the
book and a drop on the Years shelf **deletes** it — its colour and wear go with it, Years still
has **17 / 6 / 12** books; that the menu's *Delete book* and the sheet's own Delete each remove
it and the landing comes back; and that the vault's notes are **byte-identical** across all of
it (**396 / 758 / 10000** notes).

`"a book is made on any shelf arranged by hand, and a plus stands where the books end"` turns
the Years shelf manual and asserts what the plus is and does. An automatic Years has **0** plus
and `makeBook` refuses it; Favourites has **1**. Arranged by hand, Years has **1** plus, on the
last row, to the right of the last spine, **22 × 132 px** — the thinnest spine's width and a
spine's height — at an opacity under **0.5**, named *New book on Years*. Clicking it opens the
sheet as *New book on Years*; Save makes `years/-made-dailies` holding the biggest folder's
notes (**112 / 620 / 694**), last in the sequence, in `order`, counted once, with no plaque, a
hand handle, and the plus still after it. Alt+Left moves it one place; a rename keeps the
address; the spine's menu offers exactly `Edit book… | Delete book` and deleting it takes it
out of `order` and `made`. A settings file round-trips `made` and `order` on an ordinary
shelf, and switched back to automatic the shelf keeps the book, sorted **last**, after Undated,
with **0** plus.

Not covered by a number: a made book dragged onto *another* pick shelf does nothing — that
shelf refuses it and the take-off drop declines while over it — which is asserted only as the
absence of a change and is easier to see than to count.

## The room parts, the twelve are offered, and the thread is tonal

`"the room parts where a thing will land, the twelve are offered, and a shelf goes from its own
sheet"` measures four things a person asked for in one breath.

**The room parts, and the gap is the shape of what is coming.** The neighbour steps
aside instead and the bar stands in the space that opens — the same parting the query does to the
room. Because it is a CSS transition, it is read **after** it runs rather than in the same tick:
a book's neighbour opens to the carried book's own width — **53px for a 47px book** — and settles
back to 0, with the **3px** bar standing in the gap. A **shelf** does not open a margin at all:
it leaves the room while carried and a ghost of its height stands where it would land
(**226px**, named *Years · 17 books*), with **0** ghosts and **0** carried marks left behind.
The row, not the spine, hears the drag, because a gap opened on the target used to take the
target out from under the pointer (`design/0018`).

The shelf half of that has a condition worth knowing: a `.vs-shelf` off screen has
`content-visibility: auto`, so its rendering is skipped and **the transition never runs** —
measured before `decisions/0014` on the 10,000-note fixture, where the check read 0 → 0 until
it scrolled the shelf into view
first. That is right for the product (a person parts the shelf they are looking at) and a trap
for a check, which has to scroll before it measures.

**A date shelf dyes by period, an index wears one dye, and identities vary** (`github#21`,
`github#33`, `design/0005`). Years by decade, Months and Weeks by year, unless `Shelf.colorBy`
says otherwise; the slot is the period modulo **12**, so it is the calendar's and not the
vault's.

**A dye means "what kind of book is this", and the default answer — the dominant source folder
— is the wrong one at both ends of the library** (`github#33`). An Encyclopedia volume is a
slice of the alphabet, so dyeing each volume by whichever folder happened to dominate that
letter was colour with nothing behind it: **35 volumes wore 6 dyes** for no reason a reader
could name. And every person's book draws most of its notes from the meetings folder, so a
People shelf came out **4 dyes over 26 books**. So: `initial` resolves to the `"one"` colour
rule and wears slot 0 throughout, and `person` and `tag` vary unless the file says otherwise
(`core.variesColors`, which is what the Manage switch reads — reading the raw flag instead
showed the switch **off** while the shelf varied).

**The twelve are dealt, not hashed** (`github#33`). Hashing an address into twelve slots is
even only on average, and on 44 tag books it put **8 on one slot and 2 on another**. Dealing
in key order uses every slot within one of every other and never twice in a row. The deal is
taken from an **unfiltered** rebuild, so narrowing the room cannot recolour a book — the
property `design/0005` already promised and the reason the deal is not simply the book's index
in whatever is on screen.

Measured: Months' **109** dated books over **11** years, **0** years torn between dyes and
**0** neighbouring years sharing one; Years' **2** decades likewise; Encyclopedia's **35**
volumes wear **1** dye. People **26** books over **12** slots at `3 3 2 2 2 2 2 2 2 2 2 2`
and Tags **44** over **12** at `4 4 4 4 4 4 4 4 3 3 3 3` — **0 neighbouring books sharing a
dye** on either, against 1 and 3 when they were hashed. Manage offers `folder,year,decade` on
a date shelf's row and nothing on Encyclopedia's or People's; Months by folder follows the
folder on all **109**, by decade tears **0**, and saves as `"decade"`. Between *vary* and the
folder in the ranking: a hand-given colour and a varied shelf both still win.

**The twelve are offered.** A slot's swatch used to open the operating system's colour picker,
which has sixteen million colours and none of this library's twelve. It opens a popover of the
**12** current slots — 12 distinct — with *Custom…* behind them and, on a changed slot, the way
back to the look's own. Choosing the seventh puts that colour on the slot and saves **12**.

**A shelf goes from the sheet it is edited in.** *Delete shelf* appears in the builder only when
editing (not on a new one), reads *Delete*, then *Really delete?*, leaves the shelf standing
until the second press, and closes the sheet when it goes.

**The thread is tonal, and the look paints it.** Every unchosen ribbon keeps its board's hue
(**12/12**) and sits more than a fifth of the lightness away from it (**12/12**).
The check reads the ribbon element's **painted** colour rather than the custom property, and
asserts it equals the thread the book asked for — because the first version read the property,
passed, and missed a look painting `#ad5447` over every ribbon in the library. Demo: **6**
distinct threads where there was **1**. The count is not asserted: a vault honestly
shows one, since nearly every book there draws from the same folder and wears the same dye.

**The glass heads the index.** A magnifying-glass tab stands above the index entries in the
reader's right-hand strip, the same height as a year tab. Pressing it takes the left page from
**400px** back to **0** and leaves the cursor in the find box; Ctrl/Cmd+F does the same. It is
not an index entry — it names an act rather than a position — so every check that counts index
tabs excludes it. Every unchosen ribbon keeps its board's hue (**11/11**) and
sits more than a fifth of the lightness away from it (**21/21**), which is what makes it visible
without making it a different colour.

## A hovered swatch paints the room, and leaving puts it back

`"a hovered swatch paints the room, and leaving puts it back"` (`github#44`, `design/0022`), on
all three shapes. **A preview paints and nothing else.**

While the swatch popover is open, hovering one of the twelve dyes the library in it, live; the
next swatch follows; leaving without clicking puts back **exactly** what was there when the
popover opened — not the look's own, and not the previous hover. The check drives the slot the
room is actually wearing, found by reading every spine's `--spine-tint` rather than assuming slot
1, because a shape where no book happens to wear it would otherwise pass by painting nothing.

**Nothing is written.** `settings.palette` reads **0** through a whole hover trail. The trial
twelve live in a `trial` object that `readSlots()` and `ribbonFor()` consult in place of
`settings`, and `persist()` is not reachable from the preview path at all.

**Nothing moves.** Every spine's box, every book address and every shelf's note count is read
before the first hover, with the hover standing, and again once it is put back, and all three are
identical. Boxes are compared **across a preview and never across a commit**: choosing a colour
re-renders the library, which puts its scroll back to the top, and that is what committing has
always done rather than anything a hover did.

Two things about reading boxes here, both learned by failing. **The first packing has to have
landed**, so the check waits for a spine to have a width rather than sleeping a fixed 250 ms --
in the parallel lane it read **every box as `0:0:0:0`** and would have compared nothing to
nothing. And **a shelf off screen has `content-visibility: auto`**, so its spines have no box at
all until the browser gets to them, and one that gains a box mid-check is the browser catching up
rather than a preview moving anything: only boxes that were real in the first reading are
compared. The check is in the serial lane for the same reason every other box-reading one is.

**Every route out puts it back**: the pointer leaving the popover (the commonest), `Escape`, a
click outside, a click that commits, and focus leaving. A slot already changed from the look's
goes back to *its* value, not to the look's own — the check commits one of the twelve first, so
"put it back" has something to be wrong about.

**The ribbon column paints ribbons.** Hovering in the second column changes `--ribbon` and leaves
every `--spine-tint` in the library byte-identical.

**The keyboard offers the same thing.** Focus previews, and `ArrowRight` moves focus to the next
of the twelve and previews as it goes; the twelve stay individually tabbable, so the **337**
named controls the accessibility check reads do not move. The grid's column count is read back
from the computed style, because `page.css` owns the geometry (`design/0016`).

**A menu of the twelve opens holding its own focus, and offers nothing until the hand moves.**
No swatch takes the opening focus, so "opening offers nothing" is structural rather than timed --
the first shape of this swallowed one focus event with a flag and was a race, since Chrome
delivers that focus after the handlers are wired and a late one yanks focus back and undoes a
preview (a check that failed **one run in four** on the 10k shape, and never in isolation). **The
first arrow steps onto the colour the unit is already wearing**, so the keyboard's first move
shows what is committed.

What a preview costs, and what it replaces — `readTheme()` split so a hover re-reads the twelve
without re-deriving the look's own:

| the vault (`decisions/0014`) | spines | books | hover | a full `refresh()` |
|---|---|---|---|---|
| 5,000 notes over eleven years | 231 | 691 | **9.31 ms** | 32.7 ms |

Before the split it was 17.95 ms, measured on the three fixtures this was first written
against; there a hover and a refresh cost about the same on the two small shapes, which is why
the argument below is not about the clock.

The reason to paint rather than refresh is not the clock: a repaint touches no geometry at all,
so "a preview moves nothing" is true by construction, and nothing is left in flight when a check
returns (`decisions/0013`).

**The sheet gets out of the way.** With Manage open at 1584×961 the sheet body is 760×711, and
**49 of the 82 spines on screen lie entirely clear of it** — so the room is there to repaint. What was not there was the light: the
scrim over the library is 82%, and a slot changing read as a faint shift. It thins to **40%**
while the popover is open (`data-picking="1"`, one colour-only rule per look, no geometry and no
transition).

**Custom previews nothing.** The OS picker is a native modal this page does not own and, on
Windows, blocks the page while it is open. *Back to the look's own* does preview — it is one of
the things being chosen between.

## A right-click dyes a book, a plate's run or a shelf

`"a right-click dyes a book, a plate's run or a shelf, and hovering paints it first"`
(`github#44`, `design/0022`), on all three shapes. The twelve are offered in four places now, and
all four preview the same way.

**The unit is what the right-click landed on**: a spine is one book; a plate is **its run**, the
adjacent books it names (`design/0018`, so a shelf a person has split shows two plates and dyeing
one dyes one); a shelf's head or its empty rail is every book standing on it — **231 spines over
691 books** on the vault, and a shelf of 130 is one gesture. A hover paints the
whole unit at once and **saves 0 keys**; a click saves **one key per book**; *Automatic* takes
every one of them off again and the room is byte-identical to where it started.

**A plate's run is the shelf's, never the row's.** `"a plate dyes its whole run from either copy,
and the colours survive a rebuild"` (`github#29`, `design/0022`). One `renderTrack` call is one
shelf row, so a plate wired to the books beside it is wired to the slice of the run on that board;
`runOver()` is the one resolution both the click and the right-click go through, so a plate cannot
dye a different set from the one it opens. Measured on the vault: `months` plate **2022** is drawn
**2** times over a run of **12** books, **9** and **3**; the right-click on the copy over the
**three** writes **12** `bookColors` keys, leaves the shelf's other **98** books alone, survives a
rebuild and a `core.migrate` round-trip, is followed by a favourite pointing into the run with
**no key of its own**, and comes off in one *Automatic* on the other copy. The check searches for a
run that is actually drawn twice rather than assuming the longest one is — the longest run in this
vault is twelve books and twelve spines fit one row at any usable width.

**The menu says which gesture it is.** `.vs-dyeunit` — `12 books under this plate`, `231 books on
this shelf`, absent on a spine, and `1 book under this plate` on a run that holds one, because a
plate is still a plate. It is a line of its own because `.vs-dyename` ellipsises. And the lines
below the twelve are a spine's: `openDye()` is told where the hand landed instead of inferring it
from the book count, so a run of one no longer grows them.

**A hand-given colour is a stamp, not a rule.** Each book keeps its own `bookColors` key, so it
survives a rebuild by address and one spine can be re-dyed afterwards. A book that joins the
shelf later does not inherit it.

**The threads follow the boards**, with nothing added: a thread falls out of the board it is sewn
into (`design/0008`), so the check reads `--ribbon` across the library and asserts it moved with
the boards on a plate's whole run.

**The shelf's menu leads with the act tied to where the hand landed.** Right-clicking empty rail
space is about a position — it is how a book is made at that gap (`design/0020`) — so
*New book here…* is still the first button and the twelve sit under it.

**The lines below the twelve are one book's.** Edit, delete and the per-pick-shelf lines appear on
a spine's menu and on no other; a plate's and a shelf's carry **0** of them.

**Both new checks clear the palette, the ribbons and the hand-given colours before they measure.**
They read boxes, so they sit in the serial lane, and the checks that run before them there leave
all three behind; what these measure is a difference, and a leftover palette made one preview
land on the colour its slot already wore.

## A shelf can be deleted, placed and carried

`"a shelf is deleted on the second press, made at the end the button is at, and carried by its
floor"` covers the three things Manage and the library could not do.

**Placed.** There is a *+ New shelf* at each end of the library (`design/0009`) and both of them
used to append, so the one at the top sent the shelf past everything to the bottom. The top
button now builds at position 0 and the foot button appends; the check builds one from each and
asserts the first is first and the last is last, with every other shelf's relative order kept.

**Carried.** Every row of every shelf carries a floor grip (**grips == rows**, and the builder's
preview carries none), and the board measures **10px in every look** — it was 5 / 10 / 7, each
look declaring its own, which is `github#14`'s largest single drift because a board is charged
twice a row (`design/0021`). Dragging a shelf by its floor onto the lower half of another draws an *after* mark and
lands it below that shelf, leaving **0** marks behind. A book dragged onto Favourites in the same
breath leaves the shelf order untouched — a spine is a book, a board is a shelf.

**Deleted.** The button arms on the first press (*Delete* → *Really delete?*), the shelf is still
there until the second, and arming another row disarms the first. What goes with a deleted shelf:
the wear and hand-given colours keyed by its addresses (**0** keys survive), and any favourite
pointing at its books, which is the rule `design/0019` already had. What does not go is a reading
place: it names a note, and `core.resolveReading` finds that note another home.

Hiding still never deletes, and deleting says so twice before it does.

## Hiding a shelf hides it, and never deletes it

`"a hidden shelf keeps its definition and its books"` hides the Tags shelf, asserts the
visible count went down by exactly one, asserts the hidden shelf **still has its books built**
— it holds reading places and answers "also shelved in" — then restores it and asserts the
visible count came back. Measured: 6 visible → 5 → 6, and the hidden shelf still held **16**
books.

`"hiding every shelf offers a way back rather than an empty room"` hides all six and asserts a
recovery card with a working button is on screen and zero spines are drawn, then restores.
An empty room with no way out is the worst reachable state in this product.

## The book sits on a desk you can hit

`"a click off the book puts it down, and a click on it does not"` measures the desk beside the
open book, which is what a click has to land on to close it. The spread is inset from the measure
now — it was filling it — so the desk went from **42px** to **90px**. The book
is the same book; there is simply somewhere to put it down.

## The reader

`"the turn sits under the spread, says the place, and yields to a caret"` opens the smallest book
holding three notes or more and asserts the footer reads **`1 of 3`**, that clicking `Next` moves
it to **`2 of 3`** and the reader to index **1**; that the footer's top is **16px** under the
spread's bottom and shares its left edge and its width exactly (`.vs-turn` and `.vs-spread` carry
the same `max-width`); that `←` dispatched with focus in `Find within this book` leaves the reader
at **1**, and the same key dispatched on the reader itself turns back to **0**. The two buttons are
`#vs-prevnote` and `#vs-nextnote` still — they moved out of the reader bar, they were not rebuilt —
so `"previous and next walk the book and stop at its ends"` reads identically on both sides of the
change. `github#36`, `design/0025`.

`"a wikilink in a book goes to that note in this book, this shelf, or the nearest"` opens a
Months book holding a note that links to a person's note but not the person's note itself,
clicks the link, and asserts the reader is now on that note **in another Months book**; opens a
book that holds both and asserts the click **stays in that book**; and asserts a note the
library does not hold is left to the host (`openNote` returns null). Measured on the
vault: **38** linking notes; both cases hold. Vaults with no linked person report so and pass.

`"a tag book's cover carries no hash, and every other place it is named keeps it"` walks every
spine on the visible tag shelf and asserts **0** covers open with `#`, **0** differ from the
book's key (`Untagged` for `-unfiled`), that every tagged book's label still is `#` + key and
every peek's first line is that label; that no spine stands upright unless its cover is three
characters or fewer; then opens the deepest hierarchical tag book and asserts the
title bar reads `Tags · #<key>`, the heading `#<key>`, and every `Tags:` chip in *also shelved
in* carries the hash; and that the address list is element for element what it was. Measured
on the vault: **16 spines, 0 hashed, 15/15 labels still hashed, 16/16 peeks lead with the
label, 1 upright of 2 short covers** (`学び` stands; `map` does not fit a 22px spine and stays
on its side), opened `garden/seeds`. `github#12`, `design/0002`.

`"a hovered spine shows one peek, big enough to read, and short labels stand upright"` asserts
**0** spines carry a `title` or `aria-label` (two overlays otherwise), hovers the spine with
the longest label and asserts one `#vs-peek` shows at **14px** with the name unclipped
(`"Sanne de Vries"` in a **264px** card; `"Jun 2021"` in 340px), clear of the spine, and gone
on leave; and that every Encyclopedia label of three characters or fewer is `horizontal-tb`
(**36/36**) while no longer label is; and, since `github#12`, that **0** of **37** upright
titles in view are clipped, naming any short cover that had to stay sideways because it did
not fit its spine (`map`).

`"the date index is layered: years over months over days, each only where it separates"`
opens a multi-year tag book and asserts one level-0 tab per year (**`#archive`: 4 years, 4
tabs, 26 month tabs stepped in, 30 in all**; `#area/health/running` spans **11 years, 11
tabs, 9 months, 24 in all), a month book and asserts only day tabs (`02 04 08 11 12 13 …`), and
a book of three notes or fewer and asserts **0** tabs. `design/0015`.


`"a click off the book puts it down, and a click on it does not"` opens a book, clicks the note's
own text and asserts the reader stays open; clicks the desk **42px** to the left of the cover
and asserts it closed; then presses on the page and releases on the desk — a text selection
dragged off the cover — and asserts it did **not** close. Both ends of a click have to be off
the book, or every selection dragged past the edge would put the book down on release.


`"a wide table scrolls inside the page and never widens the book"` opens the fixture note that
is one 12-row table with a 2,048-character cell and asserts the spread is still no wider than
`--measure` (**1180px**), that the right-hand page does not scroll sideways (**0px**), and that
the table rendered as a table (**13 rows, 72 cells**). It was written for a real note that is
31 rows of history and rendered as a stack of cells; `design/0010` says why the article scrolls
and the table does not.


`"clicking a spine opens a book on the note it names"` clicks a real spine on the Years shelf
and asserts the reader opened on the book that spine addressed, with a non-empty contents list.

`"the index tabs cut the book the way the book is ordered"` opens the largest Encyclopedia
volume and asserts its contents are in **title** order, that every tab label begins with the
volume's own letter, that the labels rise, and that there are as many as the titles admit.
Then it opens the largest person's book and asserts its tabs are **dates**, because its
contents are in date order. Measured: `S` holds **243 notes behind 14 tabs** (`Sa Sc Se Sh Si
Sk Sl Sm …`) of the **32** its titles admit, and Mira Vance's **613** notes are tabbed by
year.
That volume used to be `G`, 25 notes behind **one** tab, because all 25 were titled
"Greenhouse Rebuild — …" — the check was reading a fixture with nothing to cut rather than a
cut that had gone wrong, which is why `github#7` gave the titles real first words.
`design/0015`.

`"the reader's index tabs stay countable on the biggest book"` finds the largest book in the
vault and asserts its tab count is between 1 and 26. Measured: the biggest
book is `people/-unfiled` at **2,450 notes behind 11 tabs**, and the `0-9` Encyclopedia volume
holds **2,063** — the case the 10,000-note fixture used to be for, now carried by the one
vault (`decisions/0014`). `design/0004` says why a tab you cannot hit is not navigation.

`"the contents scroll to the current row after a tab, Previous and a ribbon"` opens the biggest
book in the vault, clicks the **last** index tab and asserts the marked row's box is inside the
left page's visible box, that the page's `scrollTop` moved (printed before and after), and that
exactly one row carries `aria-current` — the one at the index the tab named. Then Previous from
there, and then a ribbon left in the first page and followed from the far end, each measured
the same way. Measured: `people/-unfiled`, **2,481 notes behind 12 tabs**, tab
`2026` → row 1,703, scrollTop **0 → 43,156**; Previous → row 1,702 with the list unmoved
(43,156); the ribbon → row 0, scrollTop **43,156 → 87**. The reveal is the smallest move that brings
the row in, one row's height inside the edge, by the page's own `scrollTop` and never
`scrollIntoView()`; instant under `prefers-reduced-motion`; and only when the note changed, so
a re-render for the find-within box never moves a list somebody has scrolled by hand.
`github#11`, `design/0015`.

**Moving the marker moves the marker.** A turn within one book changes nothing about the contents
list, so the list is not rebuilt for it: `aria-current` moves between the rows already standing
there and the page keeps the scroll the reader left it at. `renderContents` rebuilds only on the
two paths whose contents really change — opening a book, and *find within this book*; every other
turn goes through `markContents`, and `goTo` is one of them. `revealCurrent` is unchanged and
still nudges a row that is genuinely out of view, which is what a tab jump or an arrow key needs.

`"clicking a row in the index moves the mark and leaves the index where it stood"` opens the
biggest book, scrolls the left page to the middle of its index, picks the row nearest the middle
that is a full row-height clear of both edges, and **dispatches a real mouse press**, reading
`scrollTop` before the press, between press and release, and once the page has settled. It asserts
all three are the same, that the mark and the reader moved to the row pressed, and that every row
is **the same DOM node** it was before — the scroll is the symptom, the un-rebuilt list is the
cause, and asserting both is what stops the fix decaying into "rebuild, then put the scroll back".
Measured on `people/-unfiled` (**2,450 rows**, index scrolls **61,975px**): from `scrollTop`
**30,988** a press on row **1,223** leaves it at **30,988 / 30,988 / 30,988**, the mark moves
**0 → 1,223**, and **2,450 of 2,450** rows are the same nodes. Before the fix the same press read
**30,988 pressed → 0 released**, then animated back to 19,489 half a second later, with **0 of
2,450** rows surviving; on `weeks/2026-W29` (55 rows) it read **377 → 0** and stayed at 0, which
is the report verbatim.

**`element.click()` cannot measure this and must never be used for it.** The clamp needs a layout
taken while the `<ol>` is empty, and what forces one under a real mouse is the focus change when
`clear()` removes the row the press had focused. A programmatic click never focuses a row, so it
never clamps: the first version of this check clicked in script, measured **30,988 → 30,988**, and
passed — green, over a live bug. The zero is also only visible *between* press and release; half a
second later the smooth scroll has carried it part of the way back and the number reads as merely
wrong rather than as the diagnosis. `github#46`, `design/0026`.

`"previous and next walk the book and stop at its ends"` opens a book with at least three
notes, asserts it opens at index 0 with **previous** disabled, that next moves to 1, and that
clicking next past the end stops at the last note with **next** disabled.

`"also shelved in moves to another book and keeps the note"` finds a note that genuinely
appears in two books, follows the first offered link, and asserts the book changed and the note
did not.

`"previous collection walks back, and Alt+Left does the same"` opens two books in sequence and
asserts both the button and the keyboard shortcut return to the first.

`"escape closes the reader and leaves the shelf where it was"` scrolls the library to 80px,
opens a book from a focused spine, presses Escape, and asserts the reader closed, the scroll
offset is **identical** (measured 80 -> 80), and focus is back on that spine.

## The reading table survives

`"the reading table survives a shelf being hidden"` bookmarks a note from a Tags book, hides the
Tags shelf, and asserts the row is still present **and still enabled** — because
`core.resolveReading` re-resolved it through another visible shelf.

`"a saved reading place re-resolves after its own book is gone"` calls `resolveReading` with a
book id that has never existed and asserts it falls back to a book that genuinely holds the
note; and that a bookmark for a note that no longer exists resolves to `null` rather than to
something plausible.

## The builder previews the truth

`"the builder previews the shelf it would actually save"` opens the builder, switches the
classifier to Person, and asserts the previewed book count equals the **real** People shelf's
book count, that spines were drawn, and that Cancel left the shelf list untouched.

`"a saved shelf gets a stable id and joins the library"` adds a property shelf on `status`,
asserts it built books, that the number of spines drawn equals the number of books, that its
addresses are prefixed with its id, and that removing it returns the shelf count to where it
started.

## Metadata is declared, never inferred

`"parent tag inclusion is a setting, and it changes the answer"` builds the same tag-sourced
shelf twice, with `includeSubtags` on and off, and asserts the first collects at least as many
notes as the second. Measured: `#garden` collects **1,440** notes with its
`garden/seeds` and `garden/soil` children and **62** without -- a difference of 48.

`"people come from the property alone, never from prose"` asserts that a name the fixtures
put **only** in note bodies — never in a people property — reaches **zero** people lists and
earns **no book of its own**. It also asserts the name really is in some bodies, so the check
cannot pass by finding nothing. `decisions/0003` is why an invented person is worse than a
missing one.

## The palette is Vault Graph's, and the theme is the host's

`"the twelve colour slots are Vault Graph's own"` asserts all **twenty-four** values — twelve
light, twelve dark — against literals copied out of the other project's stylesheet. It reads
what the cascade actually resolved rather than what a comment claims, because a comment
claiming parity is exactly what was wrong: the slots were twelve invented pastels and nobody
had opened that stylesheet. `design/0005` and `changelog-detail.md` have the whole story.

`"the theme follows the host, and the slots are re-read when it changes"` asserts a different
ground colour in each theme, that the twelve slots came back **different** after the switch —
a hardcoded array could only ever be one of them — and that the library is otherwise
identical.

## Binding colors belong to stable books

The leather look **no longer scales the page**. It shipped as `zoom: 1.2`, and this paragraph
described that: 158.4px spines, 15.6px titles, controls growing with them. `design/0016`'s own
rework note replaced it with a 17px base font size and left this standing, so the file claimed a
geometry the product had already stopped having. A spine is **the same size in every look**,
row wrapping may still repeat plaques, and counts, order and addresses are untouched.

Month display labels use **Jan–Dec plus the four-digit year** (for example `Sep 2026`).
Their keys remain `YYYY-MM`; addresses, date ordering and year plaques are unchanged.

Encyclopedia (`initial`) volumes always share palette slot 1. **Manage → Vary book colors**
is off by default on every shelf except **People and Tags**, which vary unless the file says
otherwise (`github#33`); migrating older settings does not turn it on anywhere else. When
enabled, books are dealt the twelve slots in key order from an unfiltered rebuild, never by
changing folder counts or membership. A theme/look switch may repaint the palette; incoming
notes may not reassign it.

`node scripts/smoke.mjs --only "book colors"` drives the checkbox and reloads its saved
setting, changes the dominant folder by adding notes, and reverses folder ranks. Measured
in light, dark and leather: **691** existing book colors unchanged;
encyclopedia volumes use **one** color in every case. Turning
variation on/off preserves all addresses and counts.

## A look is paint, and nothing else

`design/0016`, `design/0017`. There are **three** looks — the default, the leather binding
(`src/leather.css`) and the cyber archive (`src/cyber.css`) — each one a stylesheet and a
value of one setting. A look may repaint anything and it may move nothing.

**One of them is shelved.** Since 2026-09-11 `core.LOOKS` marks cyber `shelved: true`
(`design/0017`, addendum): `core.offeredLooks()` is what the selector lists — leather and
modern — and `core.isOffered()` is what `migrate` accepts, so a settings file naming `cyber`
comes up in leather (**schema 9**). The stylesheet still ships, `check-scope` and
`check-network` still read it, and every look check still paints it through
`__vs.setLook()`, so a change to what the looks share reaches it and is measured there.
The migration check asserts `{ schema: 8, look: "cyber" } → "leather"` and
`{ schema: 8, look: "" } → ""`.

**Its name is `Cyber`**, from `github#56` (2026-09-12), matching the value. A name is only ever
rendered through `core.offeredLooks()`, which filters shelved looks, so a shelved look's name
reaches no host and no check reads one — which is why renaming it moved no number and no address
(`design/0017`, addendum).

`"a look is opt-in, repaints everything and moves nothing"` drives the top bar's
`<select id="vs-look">` rather than poking the attribute, because that selector is now the
only control either host offers. It **walks `core.LOOKS`** rather than a list of its own, so a
fourth look is covered the day it is added, and it asserts:

- the selector offers every look in the list that is not shelved and none that is, and each
  one — offered through the selector, shelved through the handle — sets `data-look` to its own
  value;
- each look's ground, twelve slots and first-spine dye differ from the default's **and from
  every other look's** — two looks that resolve alike are one look shipped twice;
- every book address and every count is **byte-identical across all three**;
- the first spine's inline `--spine-tint` is one of the twelve the cascade *currently*
  resolves. Comparing only the mixed `backgroundColor` cannot see a stale one, because
  `--tint` and `--surface-2` move with the look too — so a spine still carrying the previous
  look's hex reports a different colour and passes. `design/0017` records what that caught;
- switching back to the default restores the ground, the dye and the slots exactly.

Measured: **691 addresses on the vault, identical under all three looks.** A book is the same
size in every look, in a room of the same **1180px** — **55x132** here, because a spine's width
is its note count against that vault's fullest book (`design/0011`) and not a constant.

The default look is the one every other check in this file measures, and it is unchanged: with
the setting off, not one selector in `leather.css` matches. `scripts/check-scope.mjs` reads
**both** stylesheets — an unscoped rule in the second would style the whole of Obsidian
exactly as one in the first — and `scripts/check-network.mjs` reads the second one too, so the
leather grain and wood stay CSS gradients and inline SVG data URIs.

The reworked leather look keeps spines at **22–58px × 132px**, with a **6px vertical hover
lift** and no rotation — one lift for every look since `github#14`, where it was 5 / 5 / 6. Reduced motion removes transforms, including worn and matching books.
Its walnut board is **10px** deep, and since `github#14` so is every other look's. The reading cover has an **11px** outer ring, with **24px
side gutters** on desktop and **16px** below 860px, so the cover stays inside the view.
The page remains capped at **1180px**. These are paint dimensions, not membership constants.
Measured in leather at **390, 768 and 1440px**: zero row or page overflow; **419** demo books
at each width and in list mode. `design/0016` records the visual review.

it selected, not one selector in `leather.css` or `cyber.css` matches. `scripts/check-scope.mjs`
reads **all three** stylesheets — an unscoped rule in any of them would style the whole of
Obsidian exactly as one in `page.css` — and `scripts/check-network.mjs` reads them too, so the
leather grain, the wood, the marbling, and cyber's sensor grain, brushed aluminium, rain and
selector chevron all stay CSS gradients and inline SVG data URIs. No look loads a font.

One constant moves under cyber and it is not a size: the `.vs-spread` margin `10px/14px →
22px/26px` (the frame is a `box-shadow` ring, which costs the grid nothing). `--board: 7px` was
the other, and `github#14` took it: the depth is `page.css`'s at **10px** in every look, and this
sheet draws its strip light on whatever plank the page lays down. The hover lift is **6px and no
rotation** and is now every look's.
### A look moves nothing on the page

`github#14`, `github#16`, `design/0021`. The section above names **38** controls by selector,
which means anything nobody remembered to name drifted freely — and every drift found so far was
found by eye. `"a look moves nothing on the page"` walks **every element** under `.vault-shelf`
instead, in **four states** (the library, an open book, the Manage sheet, the builder), in every
look `core.LOOKS` knows, shelved ones included, against the modern look's reading. It identifies
an element by a **path** — tag, id, first two classes, index among its siblings, up to the root —
rather than by a selector, so a box nothing names is still compared with the same box in the next
look, and it **prints how many elements it compared**, so the coverage is itself a measurement.

It asserts two things and reports three numbers:

- **every element's top, relative to the library root, is the modern look's**, within a pixel.
  Nothing slides down the page. No exception list;
- **every element is the same size across the direction its text runs** — its height where the
  text is horizontal, its **width** where it is upright, because vertical type turns the box
  round and a spine title is vertical. The line box is `page.css`'s; the glyphs on it are the
  look's;
- moved, resized, and **present in one look and not another** — which is how a *part* a look
  adds or removes gets caught.

**Width along the text is the face's**, deliberately, and it is not unguarded: *every control is
the same size in every look* fixes it wherever a rule sizes a control, and *the shelves are packed
the way the golden snapshot says* now runs in **every look** against the one golden. That is the
one concession — a wider face may move a label's neighbour **along its own row** and nothing else
— and `CLAUDE.md`'s look law carries the clause.

**The walk stops at a page of the open book**, and says how many nodes that costs. A `.vs-page`
is furniture and is measured; what is *set* on it — the contents, the note's meta line, the
rendered markdown, the also-shelved-in chips — is the vault's content reflowing inside a box that
scrolls on its own, and a look may set the size it is read at (`design/0016`). Nothing outside the
page can be moved by any of it.

Measured after: **4363 / 1979 / 3517 elements** on the demo, sparse and 10k fixtures — **0 moved,
0 resized, 0 present in one look and not another** — with **1596 / 1584 / 6117** nodes on a page
skipped, and **832 / 216 / 636** of the walked ones upright type. The library is **2186px tall in
all three looks** where it was **2258 leather / 2147 modern / 2161 cyber**. Measured before, on
the demo shape: **818 moved and 307 resized** under leather, **679 and 282** under cyber.

The floor is 600 elements: below that the walk has not found the page.

### A short cover is stood upright by one face, not the look's

`github#47`, `design/0021`. The clause above says the line box is `page.css`'s and the glyphs on
it are the look's. **Whether a cover has a line box at all was the look's too**, and that is a
box, not a glyph: `fitsUpright()` builds a probe spine, appends it to the element carrying
`data-look`, and asks whether the title overflows. The probe inherited the current look's face,
so the same cover at the same width could be `horizontal-tb` in one look and `vertical-rl` in the
next — the one thing `design/0021` rule 2 forbids outright, because turning the box round swaps
which axis is fixed.

`.vs-probe` pins the probe's type now — family, size, weight, line box, tracking, word spacing,
case and both feature-setting properties — at **0-5-0**, because a look's own
`.vs-spine .vs-title` rule is 0-4-0 and its sheet is concatenated after `page.css`. The stack is
written out rather than read from `var(--ui)`: `--ui` is a look's to redefine and leather does.
The cache key stays `cover + "|" + width` and is now *correct* rather than accidentally safe —
the look was never in it, and there is no longer anything for it to miss.

`"a short cover is stood upright by one face, not the look's"` reads every short cover on the one
vault, at the width the page asks about it, in every look `core.LOOKS` knows. It asserts three
things and reports two margins:

- **the probe reads one face**, printed in full. Three is the defect, and this line fails on it
  whether or not a cover has flipped yet;
- **no cover is oriented one way in one look and another in the next**;
- **nothing a look draws is clipped** by the decision another face made for it;
- how much wider than the deciding face the widest look actually draws the same cover, and how
  much room the tightest upright cover has left. Neither is asserted — they are the margin
  nobody had measured, and `github#45` found it by moving a padding into it.

Measured on the one vault: **37 short covers over 3 looks — 1 face, 0 split, 0 clipped**, 33
upright, the widest face **1.45px** over the deciding one (leather `E` at a 31px spine) and
**0.97px** left on the tightest (leather `Ü` at 19px). Measured before, on the same tree: **3
faces**, 0 split — latent — and **2.93px** of spread. With `github#45`'s 4px inset applied to
that same before-tree: **3 split** (`Å`, `Ü`, `מ`, all at a 19px spine), **0.08px** on the
tightest, and `a look moves nothing on the page` at **20 resized** — `9 -> 76 wide`, a title that
changed orientation. With the pinned face and that same inset: **1 face, 0 split, 0 clipped, 0
resized.**

**No margin, and that is the position.** A constant would be calibrated to the three faces
shipped today and would cost uprights at the narrowest spine, where 4px of inset leaves nine
pixels and the three faces draw a capital letter **8.4 to 9.7px** wide. The residual — a future
face drawing wider than the deciding one on a cover the decision allowed upright — is *asserted*
instead, so it fails the day it happens rather than being absorbed silently by a number nobody
re-derives.

### A spine's title never touches a line the binding draws

`github#45`, `design/0021`. The check above compares a box to a box, and a binding's rules are
**painted** — so every geometry check in the suite passed while the **M** of `Mar 2013` sat on
leather's lower gilt band. `page.css` declares where a look may draw and derives the title's box
from it:

| | |
|---|---|
| `--spine-head` | **17px** — a look's head decoration reaches this far down from the spine's top |
| `--spine-tail` | **29px** — its tail decoration reaches this far up from the bottom |
| `--spine-rule-side` | **4px** — its side rules stand this far in from each edge |
| `--spine-rule` | **1px** — and each of those rules is this thick |
| `--spine-clear` | **3px** — the least the title's box keeps from any of them |
| `.vs-spine` padding | `calc(head + rule + clear)` / `rule-side` / `calc(tail + rule + clear)` = **21px 4px 33px**, was `20px 3px 26px` |

**`--spine-rule` is not decoration, it is arithmetic.** A rule drawn at `inset: 17px` puts ink on
17..18, so a padding of 20px left two pixels, not three — and leather's spine has a 1px top border
of its own, which the original reading of this defect missed in the other direction. The check
reads the ink, so both are in the number now.

`"a spine's title never touches a line the binding draws"` reads where each look actually puts
ink — a pseudo-element's own border box, taken off the spine's **padding** box because that is
what an inset resolves against, and the px stops of every gradient it paints, a run of **12px or
less** being a rule and anything wider a wash — and measures the gap to the title's box along the
spine. It also asserts the box is the **clip**: a glyph, and its `text-shadow`, cannot paint
outside it, which is why 3px of empty box is 3px of clearance and not 1px after the shadow.

Measured on the one vault, before and after by the same isolated `--only` run so the page state
is the same in both: **231** titles against **924** painted rules in leather and **462** in cyber
(modern draws none). The full-suite line reads 227 / 908 / 454, because a lane shares one page and
this check runs after ones that narrow it.

| | before | after |
|---|---|---|
| leather | **−3px** — the box ran *into* the tail gilt band (`"2026"`, box 21..105, band 102..109) | **+3px** |
| cyber | +7px, by luck | **+14px**, by construction |
| modern | no rule drawn | no rule drawn |
| titles ellipsised, leather / modern / cyber | 15 / 10 / 26 | **23 / 13 / 37** |
| short covers left sideways | 4 — `Œ 学 読 map` | **7** — `Å Ü Œ מ 学 読 map` |

The ellipsis count and the sideways tally are the price, and together they are the whole price:
the title's box is **8px shorter** and **1px narrower each side**. Nothing else moved — the golden
reports the same 6 shelves, 10 rows, 227 spines and 52 plaques in a 1125px room in all three
looks, and *a look moves nothing on the page* reads 4245 elements, 0 moved, 0 resized.

**The alphabet reads one way, and `INDEX_MIN` is what makes it.** `squeezeIndex` (`github#34`)
used to scale the Encyclopedia rail down to **19px** spines, which leaves nine pixels between the
declared side rules — and the pinned deciding face (`github#47`) draws an accented capital
9.25–9.67px and a CJK glyph 13.53px, so *some* covers stood upright and others lay on their side
with nothing on the page to say why. `É` and `У` stood; `Å`, `Ü` and `מ` did not. `INDEX_MIN` is
**24px** now — 13.53 for the widest cover, plus 2px of border and 8px of the declared inset — so
every volume is wide enough for its letter:

| | before | after |
|---|---|---|
| Encyclopedia volumes upright | 29 of 35 | **35 of 35** |
| short covers sideways, whole library | 7 | **1** (`map`, a three-letter tag book) |
| the rail against 1180px of room | 1127px | **1172px**, still one row |
| tightest upright cover | `У`, 0.81px to spare | `学`, **0.47px** |
| the title's box against the side rules, worst | −2px leather | **+1px** leather, +1.5px cyber |

**`sideways` in `"a hovered spine shows one peek…"` is 1, and it is a census rather than a
tolerance.** It counts covers the geometry cannot stand upright; each follows from two measured
numbers, the face is pinned and the widths are note counts, so nothing varies run to run for a
margin to absorb. The bound is the measured count, which fails in **both** directions, rather than
a round number that only fails in one. `design/0021` has the tables, including the 4 → 7 this
ticket passed through before the floor was raised.

**The sides are reported, not asserted**, and `design/0021` says why: the title's box is exactly
the panel now (`--spine-rule-side`, deliberately *without* the rule's own width — sideways there
is no glyph out past the rule to protect, and the pixel would cost three more uprights), but what
clears a side rule is the **line box**, and that is the face's own ascent and descent against a
spine whose width is its note count. Measured worst case: **+1px** in leather and **+1.5px** in
cyber, on a 25px spine whose box across is 15px and 14px. It was **−2px** and −1.5px until
`INDEX_MIN` went to 24 — the squeezed index rail was the only place the type's own box was wider
than the room between the side rules. No padding raises it further without clipping the type or
legislating a spine's thickness, which `design/0011` gives to the vault, so it stays reported.

### Every control is the same size in every look

`"every control is the same size in every look"` (2026-09-11, "make sure all components
buttons etc have the same size in all themes, some seem off") measures **40 controls** —
the search box, the order button, the look selector, Manage, the rail, New shelf,
a shelf head, a plaque, a spine; the reader bar and its four buttons — two of which are in the
turn's footer under the spread since `github#36`, along with the footer itself and the place it
carries — the find-within box, an
index tab, a contents row, the ribbon row, a ribbon and the stub, the spread, an also-in
button; a Manage row, its name and its action button, the Shown and Vary switches' knobs, Done, a palette
slot, a slot's reset mark, the ribbon slot and Reset colours; the builder's Name box, its
source and classifier dropdowns, its order dropdown and Save; a dye swatch — in every look
`core.LOOKS` knows, shelved included, against the modern look's reading. Since github#2 and
github#4 (2026-09-11) the palette slot is **36×28**, a ribbon swatch **22×30**, the colours
table itself **92** wide, the builder's dropdown **31.5** high and the same in all three, and
every dropdown is measured with its box taken back from the host. **40** are measured on the vault, whose first book has no index tabs — one more where a
reader has them, since an index tab is itself one of the controls in the list; the check's floor
is 34. Since `github#36` the turn's footer and its place are in the list too — `.vs-turn` for both
dimensions, since it shares the spread's `max-width`, and `#vs-place` for height only, because a
label's width along its own text is the face's. Since `github#38` (2026-09-12) the shelf jump is
gone from the list and the Manage row's **name** is on it, as a button of its own that is
deliberately not an action button — so that change went up by one, not down.

Both landed in one integration, so the figures above are the merged tree's own measurement and
not either branch's arithmetic.

The table is in that list because it caught three, all of them a look or a container quietly
resizing a control:

1. `.vs-slot` is `inline-flex`, so a swatch in a table cell sits on the cell's **baseline** and
   the row grows by the face's descender. Under leather, which is Georgia, the table came out
   **309px against modern's 291**. A swatch in a cell is block-level now.
2. A **column heading is text**, so the column was as wide as the face drew it: **109.9px under
   leather against 107.3**. The headings are gone -- four of them across a sheet is "BOOK
   RIBBON" written four times over swatches that say which is which -- and the hint above the
   block names the two columns once.
3. `table-layout: fixed` shares the leftover width between cells, and a swatch is a **flex
   item**: a cell 10px too narrow did not overflow, it took 10px off the swatch, **36 wide
   became 26**. The columns are pinned at 24 + 44 + 24 and the swatch is `flex: 0 0 auto`.

Which is the same rule as everywhere else, from three directions: a look paints a control and
does not size it, and neither does the box it is standing in. Since `github#14` this list is no
longer the only thing holding it — the section above walks every element there is, and this one
keeps the widths a rule fixes. **Height within a pixel everywhere; width within a pixel where a rule fixes it**
(a button that sizes to its text may be a different width in a different face).

Measured before: **21 controls off under leather** — the rail 60.5 vs 46.5px and the reader
bar 53.8 vs 44.3 (12px of padding the rework added), every button 28.8 vs 27.3 (a 12.5px
face), the search box 35.5 vs 29.5 and the find box 37.5 vs 31.5 (the rework's 17px base size
reaching `font: inherit`, plus a 32px floor), index tabs 28.8 vs 27.3, contents rows 28.1 vs
25.6, the Manage sheet 566 vs 574 wide (26px of padding), the spread 27px shorter — and **one
under cyber**, the spread 12px shorter (a 26px margin for its ring). After: **0 off** in all
every shape it was tried on. The fix is one rule: `page.css` owns a control's geometry — `line-height: 1.5`
on buttons and boxes, `font-size: 13px` on boxes — and a look sets colour, border, shadow and
face only. Modern's own numbers did not move: button **27.3px**, search box **232×29.5**,
tab **27.3**, ribbon **30**, swatch **25.5** wide.

### The furniture is one material

`"the furniture is one material"` (2026-09-11, github#9, "make the buttons look like the
plaques and vice versa") reads **56** controls against the plaque, as computed style through CDP,
in **4** rooms — leather, modern dark, modern light and the shelved cyber — rested, hovered
and focused (`CSS.forcePseudoState`; a synthetic event cannot put an element into `:hover`).
The Order button, Manage, Back, Next and an index tab must resolve to the plaque's
`background-image`, `color`, `border-bottom-color` and `text-shadow`; *Also shelved in*, a Manage
row's *action* button and *New shelf…* to the sheet's plate, which a look may cut from paper
(leather's bone plate). A spine, a contents row, the ribbon stub, a Manage row's **name**,
*New shelf* and *Done* must carry neither the plate's face nor its engraving shadow. The row's
name took the shelf jump's place on that list when the jump strip went (`github#38`,
2026-09-12), so the count is still **56**. A focused plaque and a focused button
draw an outline. Tracking is the one thing that may differ, and must: a plaque at or above
**0.1em** (0.14 modern, 0.1 leather, 0.22 cyber), a button at or below **0.05em** (0.03 in
every look). The ink against both ends of the plate, rested and lit, room and paper, is at least
**4.5:1** with alpha composited over `--surface-0`; the lowest is **5.77:1**, the lit brass plate
under leather. Floor: 20 controls. `design/0019`, *The furniture, and what it is made of*.

The plaque rule under leather used to set `border` on all four sides, overriding the shared
`border-top: 0`, so a leather plaque was **21.75px** high to modern's **20.75** — inside the
same-size check's one-pixel tolerance. It is 20.75 everywhere now and the layout goldens were
rewritten for it: every plaque under leather is **1px** shorter and each following row 1px
higher.

### Every dropdown paints itself

`"every dropdown paints itself, whatever the host says a select is"` (2026-09-11, github#2)
puts Obsidian's own `select` rule — copied out of `app.css`: `appearance: none`, a 40px
height, its own padding, no border, a red box-shadow, two gradient background layers with a
blend mode, `#202020` on `#dadada` — into the page ahead of ours, paints every look
`core.LOOKS` knows through `__vs.setLook()`, opens the builder and Manage, and asserts for
every visible `select` that its computed field is the look's own `--vs-field`, its appearance
is `none`, its chevron is a drawn data URI and not the host's gradients, and that none of the
host's height, padding, border or shadow reached it; for every search and text box that its
field is the token's; and under leather that everything on the paper sheet and the reading
page is light with dark ink and everything in the rail is dark with light ink. The two boxes
the host could resize are measured before and after the rule goes in.

Measured: **12 dropdowns and 6 boxes under 3 looks, 0 wrong**; leather
paper `rgb(250, 246, 238)` on `rgb(48, 46, 39)`, leather rail `rgb(32, 33, 30)` on
`rgb(204, 197, 181)`; `#vs-look` **28 → 28** and the builder's source dropdown
**31.5 → 31.5** with the host's rule in. Before, on the page built from the previous commit:
**34 wrong**, `#vs-look` **28 → 40**, the builder's **29 → 40**, no chevron on any of the
twelve, and the leather rail selector wearing `--surface-2` (`rgb(50, 51, 45)`) rather than
the rail's field.

### A ribbon is per book colour

`design/0008`. There are **twelve ribbons, one per palette slot** (`settings.ribbons`), and a
ribbon nobody has chosen is its dye's own hue **deepened**, computed from the cascade rather than
stored so it follows the look and the host theme. `--ribbon` is written per spine and per
open book, never once on the root.

`"one ribbon from an older schema becomes a ribbon on every colour"` asserts schema **10**,
that a file at 9 with one `ribbon` comes up with that colour on **all twelve** and no `ribbon`
field left, that a file with none comes up **12** empty, that a sparse twelve keeps the entries
it names and leaves the rest following their dyes, and that a junk array comes back 12 long
with 0 set.

## Whose colour a book wears

`"a book's colour is the person's, then the shelf's, then the folder's"` reads `--spine-tint`
off the first Years book and asserts it is one of the twelve (its folder's slot); right-clicks
it, asserts a menu of **12 swatches** opened and that all **12 are painted** their slot's
colour — under leather the look's own `button` rule had outranked the swatch rule and twelve
colourless buttons opened, which every earlier assertion passed — picks one, asserts the spine wears exactly that
slot, that a **rebuild keeps it**, and that the menu closed itself.

`"a shelf can vary its books, and a chosen palette beats the look's"` counts the distinct dyes
on eight People books by folder, presses that shelf's *Vary colours* in Manage and asserts
more distinct dyes and exactly **one** shelf pressed, presses it again and asserts the count
comes back; then changes slot 1 to `#123456` through the slot's picker and asserts
`__vs.slots()[0]` is `#123456`, **still is under another look**, and is the look's own again
after *Reset colours*.

`"colours and hidden shelves set in Manage persist through a reload"` (2026-09-11, github#4,
"all settings persistent naturally") runs each thing the sheet can set through `persist()`
and back through `core.migrate`, which is the reload path in both hosts. It asserts the block
opens as **12 rows, 12 dyes painted their slot's colour, 12 ribbons, numbered 1-12, 0 marked
and the reset disabled**; that every unchosen ribbon is separated from its dye — **12 of 12** a
third of the hue wheel away or a fifth of the lightness apart, and **12 of 12** visibly
lighter or darker than their dye, which is the assertion that caught a rule returning a thread
the same weight as its board on mid-lightness dyes; picking slot 3
saves **12 hex** with slot 3 `#3355aa`, marks exactly that slot, enables the reset and
repaints the cascade; a ribbon on slot 7 saves `#aa3355` **alone of the twelve** and is on the
spine wearing that dye, which was a different colour before; that slot's own
× saves **0** (all twelve are the look's own again, so nothing is pinned) and leaves the
ribbon; two slots picked and one put back saves **12** with the reset one equal to the look's
own; *Reset colours* saves **0** palette and **0** ribbons, disables itself and clears every mark; and the
Tags row's **Shown** switch, off, saves `hidden: true`, takes the visible count down by
**one** while the shelf is still built (**44** books), leaves **0** Hide/Show
buttons on the sheet, and on again saves `hidden: false` with the count restored.

`"a book with several ribbons in it shows them side by side"` marks four notes of one book
and asserts **0 → 3 → 3** ribbon elements on its spine (three at most; the rest are on the
peek), at rising x positions, and 0 after all come out.

## The magic

`design/0008`. Three things a real shelf cannot do, and each has a check.

`"shelf wear is recorded and drawn, and survives a rebuild"` opens one book **thirteen** times
and asserts it reaches wear level **3 of 3**, that the level is drawn on the spine, and that it
is still drawn after the library is rebuilt — the wear is on the book's *address*, so a book
re-made from different notes still remembers it is the one you keep coming back to.

`"a ribbon hangs from every book that holds a marked note"` marks one note and asserts a ribbon
appears on **every** book that holds it, not just the one it was marked in, and that the
Reading shelf collected them. One note is in six books; that is the product.

`"the shelf parts as you type, and no book leaves the room"` asserts the spine count is
**identical before, during and after** a query, that some books drew forward and some thinned
to ghosts, and that the room came back exactly. It takes its search term from the vault it is
running against: hard-coding one passed on one fixture and, on another, asserted
that a query finding nothing still drew something forward. Measured: **227** spines before,
during and after, **193** drawn forward and **34** thinned to ghosts, none removed.

## Scrolling stays smooth

`"scrolling the library stays smooth in every look"` scripts a 1.4-second scroll through the
whole room in each look and records the interval between animation frames; the **95th
percentile** is asserted under **34ms** — two frames at 60Hz, since one dropped frame in
twenty is where a scroll starts to read as jerky. The median hides a stutter and the worst
frame is the one-off paint of a shelf entering view, so neither is the number.

Measured before, p50/p95/worst in ms: modern **16.7/16.8/17**, leather **50/117/150**,
cyber **83/400/400** — the looks paint a spine as several layers of gradient and texture,
and every visible one was rasterised again per scroll step. After `content-visibility` on a
shelf, `contain: layout paint` on a row and a compositor layer under the library: leather
**17.6/18.7/105**, cyber **17.6/18.5/35**, modern unchanged. The worst frame is now the
first paint of a shelf as it enters, which is once per shelf rather than once per step.

## The room

`"the room has a width, however wide the window is"` overrides the viewport to **2560px** and
asserts the library, the rail, a row and the reading spread all fit inside `--measure`
(**1180px**), that the library and the spread are centred within 20px — the tolerance is a
scrollbar, not slack — and that **no row overflows by so much as a pixel**. Measured: shelves
**1180 (683/698)**, row **1180**, spread **1084 (738/738)**, **worst overflow 0px** across
**11 rows**, Months taking 4.

`"a narrower window grows rows, and a wide one centres the shelf"` drives the viewport to
2560px, to 760px and back. At 2560 a row stops at the **measure** and the gutters match; at
760 it is the window (**705px**, inside a 760px viewport). The library's row count goes
**11 → 17 → 11**, with **0px of overflow** at every width and the same row count on the way
back.

The repack is a `resize` listener coalesced through a **60ms timer** — not an animation
frame. It was a frame first, and this check caught what that costs: the handler ran and the
frame callback never did (`saw 2 resizes, measured 0 times`), because a window Chrome is not
painting gets no frames, and the pending flag then stayed set for good. A pane resized while
another view has focus is that window. The check reads the watcher's own log back
(`__vs.room()`) so a repack that silently did not happen cannot pass as one that did.
CDP's `setDeviceMetricsOverride` does not always deliver a resize event headless, so the check
dispatches the event the browser would.

Nothing runs sideways any more (`design/0014`), so the question is no longer whether the
scroller clips but whether anything overflows at all. **The 13px this check caught was a
plaque**: a plate is `align-self: stretch`, so a run of one thin book under `2010-2019` is as
wide as the words, and the packer was costing runs by their books alone.

`"the library is the whole surface, with no sidebar"` asserts **zero** `<aside>` elements,
exactly **two** New shelf buttons, and that they bracket the shelves in document order — the
affordance is at both ends of the scroll, which is the point `design/0009` makes. Since
`github#38` it also opens the Manage sheet and asserts **one row per shelf, each a button that
goes to it**, at least one of them not hidden: the shelf list left the rail, and this is the
check that says it is still reachable.

### The rail is fixed controls

`"the rail is fixed controls, and nothing in it scrolls sideways"` (2026-09-12, *"i think the
navigation to shelfs at the top needs to go"*) overrides the viewport to **1180px** and
**860px** and, at each, asserts that **no descendant of `#vs-rail` computes
`overflow-x: auto` or `scroll`**, that no in-flow child of `.vs-inner` overflows its own box,
that the rail is **one row**, and that the free space never goes negative. Out-of-flow children
are excluded — both screen-reader labels are absolute — and a box clipped by `overflow: hidden`
is *reported, not failed*: the vault's name is ellipsised on purpose.

Measured after `#vs-jump` went (`github#38`, `design/0009`):

| | 1180px | 860px |
|---|---|---|
| the rail | 1 row, **47px** | 1 row, **51px** |
| the controls | name 116, search 232, hits 96, **spacer 407**, order 92, look 71, Manage 63 | name 116, **search 455**, order 92, look 71, Manage 63 |
| sideways scrollers | **0** | **0** |

Before it went: **421px of 1148px** to the strip at 1180px, and at 860px a **second row** (93px
of rail) that the strip filled at 828px and **still overflowed by 57px** — at seven shelves.
The computed-overflow test is the part that matters: a strip that has not overflowed yet at this
vault's shelf count is still a strip, and the builder makes twenty shelves easy.

## Accessibility and scale

`"plain list mode keeps every book reachable"` asserts the book count is identical in list mode
and that a spine's title is laid out horizontally there.

`"every control the keyboard can reach has a name"` walks every `button`, `input` and
`select` under the root and asserts each has an accessible name from `aria-label`, its own
text, a `<label for>`, a wrapping `<label>`, a `title` or a placeholder. Measured:
**1,539 controls, all named**.

## Nothing reaches the network

`"nothing on the page reaches the network"` counts `performance.getEntriesByType("resource")`
entries with an `http` scheme after the page has loaded and been driven, and asserts zero. The
static half is `scripts/check-network.mjs`, which is unskippable in the pre-push hook.
`decisions/0006`.

## A spine holds its size

`"a spine lifts on hover and holds its size"` measures a spine's box at rest and focused and
asserts both dimensions are unchanged — the lift is a `transform`, so a hovered spine cannot
reflow its neighbours. Measured: **57×132 either way**. The width is
whatever that book's note count earns it (`design/0011`); what is invariant is that it does
not change when the spine is touched. Also in the serial lane, for the same reason as the
plaque check.

## Hidden means hidden

`"the reader and the sheets are not painted until they are opened"` reads the **computed
style** of the reader, the builder and the manage sheet at rest and asserts none of them is
painted.

It exists because reading the `hidden` **attribute** is not the same thing, and the difference
cost a real bug: `.vault-shelf .reader` sets `display: flex` at specificity 0-2-0, which beats
the user agent's `[hidden] { display: none }` at 0-1-0, so all three painted over the library
at all times while every attribute-reading check passed. One screenshot showed two dialogs
stacked over the shelves. `changelog-detail.md` has the whole story.

## Vault data cannot break out of the data block

`scripts/check-data-escape.mjs` (`github#5`, unskippable in the pre-push hook) builds a vault
whose metadata **is** markup and reads the built page back. One note carries a tag that closes a
script and opens another, a person who is an `<img src=x onerror=…>`, a property that begins
`"]]>`, a body holding a lone U+2028, and a title carrying `${…}`, `]]` and an ampersand;
Windows forbids `<` and `>` in a filename, so the note whose **filename** is markup is written
only where the filesystem allows it.

It found a real hole on the day it was written: `window.VAULT_DATA=${JSON.stringify(data)}`
left **9 raw `<` and 10 raw `>`** in the data of a two-note vault, so a note called
`</script>` closed the block and everything after it was markup — in a page built from
**anybody's** vault. The exporter writes through `jsonForScript()` now: `<`, `>` and the two
line separators become their `\u` escapes, which `JSON.parse` reads straight back, so every
string is still byte for byte what the note said.

Measured on the hostile vault: **1,173 characters** of `VAULT_DATA`, **0** raw `<`, **0** raw
`>`, **0** raw U+2028/U+2029, **4** script tags in the file, and every payload back byte for
byte. `--browser` drives the built page too: **0 console errors**, **4** script elements in the
DOM (the same four), **0** `<img>`, **0** `<svg>`, **0 of 5** markers executed, and
`__vs.data()` identical to the block the exporter wrote.

The static half also refuses a bare `JSON.stringify(data)` in `src/build-shelf.mjs`, so the
escaping cannot be quietly walked back.

## Mounting and unmounting leaves nothing behind

`scripts/teardown-check.mjs` (`github#5`, ported from `vault-graph#62`) mounts the page,
destroys it the way the plugin's `onClose()` does — `handle.destroy()`, then the host removes
the root — and mounts it again, **20 times**, counting after each cycle. A destroy is only
honest if nothing survives it, and nothing here is measured by reasoning: the listeners come
from devtools' own `getEventListeners`, the nodes and listener totals from
`Memory.getDOMCounters`, the heap from `Runtime.getHeapUsage` after two forced collections.

Each cycle first dispatches a `resize`, which schedules `watchRoom`'s **60ms** repack timer,
and then destroys the page with that timer still pending — the check asserts a timer **was**
pending, so it cannot pass by not testing anything. After every destroy: **0** nodes left
inside the root, **0** `.vault-shelf` nodes in the document, `window.__vs` **undefined**, and
**0** live timers.

Measured before `github#17`, 20 cycles, 198 spines drawn every time:

| | load | cycle 1 | cycle 20 |
|---|---|---|---|
| DOM nodes | 4,618 | 3,370 | 3,370 |
| JS listeners | 3,649 | 2,446 | 2,446 |
| listeners on `document` | 3 | 3 | 3 |
| listeners on `window` | 1 | 1 | 1 |
| post-GC heap | 1.6 MB | 1.6 MB | 1.7 MB |
| `.vault-shelf` roots | 1 | 1 | 1 |

Nothing grows: nodes and listeners are **flat from the first cycle to the twentieth**, the
three `document` listeners (two `keydown`, one `mousedown`) and the one `window` listener
(`resize`) are exactly what the page registers once, and the heap moves **0.005 MB a cycle**
against a bound of 1.5. The first row is the page as the browser parsed it; the steady state is
what a destroy and a remount actually cost.

## The library follows the vault

`scripts/refresh-check.mjs` (`github#5`, ported from `vault-graph#6`). Two halves, because the
two hosts fail differently.

**Headless**, and unskippable in the hook (`--wiring-only`): it builds the plugin bundle, loads
it with `obsidian` stubbed — a fake app whose metadata cache and vault are event emitters — and
drives the real scheduler. Until `github#5` the plugin rebuilt **only** when somebody ran its
Rebuild command; it now listens for the cache's `changed` and `deleted` and the vault's
`rename`, one handler each. Measured: **14 changes fired inside 50ms → 0 rebuilds during the
burst, exactly 1 after it**, a later change → **1** more, and a change caught mid-flight by
unload → **0**. The coalescing window is `REBUILD_MS` = **400ms**: a sync or a bulk edit fires
`changed` per file, and every rebuild walks every note and repacks every shelf.

**In a browser**, against the standalone: a book is opened, a note is pushed into the data and
the handle is refreshed. The library counts **one** more note, the open book is **one** thicker
and holds it, the shelf's note count moves by **exactly one**, the open book's contents gain
**one** entry naming it, and `__vs.reader()` still names the same book at the same note.
Taking the note away again puts every number back. **0** console errors throughout.

It caught a second real bug the first time it ran. `refresh()` restored the reader by **row
number**: `reader.index` was clamped to the rebuilt book's length and the note at that index
was drawn. Add a note to the book you are reading and the note that sorts into your position
takes your place — measured, on the Years 2011 book of the fixture as it then stood: 2 notes became 3, and
the spread moved from the note being read to `Refresh Probe`. The place is a note now
(`reader.noteId`), and the row number is only the fallback for a note the rebuild removed.

Measured before `github#17`: **396 → 397 notes**, the open book **2 → 3**, its shelf's count
**396 → 397**, its contents **2 → 3 entries** with exactly **1** naming the new note, and the
reader still on the note it was on. Taking the note away again: **396**, **2**, **2**, same
note. **0** console errors across the whole sequence.

## The packing has a golden

`"the shelves are packed the way the golden snapshot says"` diffs the geometry of every shelf
against `scripts/layout-snapshots/<fixture>.json`, at a viewport pinned to **1180×900** so the
answer cannot depend on which window the suite happened to get. Per shelf: how many rows, how
many books, every plaque's text and box, and the first and last spine's address and box, each
measured relative to its own shelf so where the library is scrolled cannot move a number. A
shelf is scrolled into view before it is read, because `content-visibility: auto` skips one
that is off screen and a skipped shelf measures nothing at all.

Exact for rows, books, counts and names; **2px** of tolerance on a box, which is where text
metrics live (a plaque's drawn width) while the packing above it is arithmetic
(`plaqueWidth()`, `thicknessOf()`). `node scripts/update-layout-snapshots.mjs` rewrites the
golden and `--check` diffs it without the suite. What is in it:

**In every look, against the one golden**, since `github#14`. It had only ever run in the look
the page opens in, which is `core.LOOKS[0]` — **leather** — so the golden recorded leather's
geometry and the modern look sat **6px** off it the whole time without failing anything. A look
moves nothing (`design/0021`), so one golden is the truth for all of them, and this is also what
holds a book's **width**, which the walk deliberately leaves to it.

Reseeded 2026-09-11 at 1180×900, where the room measures **1125px**:

The golden is taken with the **Favourites shelf emptied**: its contents are the vault's
rather than the packing's, and the checks in a shard share one page, so this check used to
measure whatever the shard before it had left on the rail. It passed for that reason rather
than on its merits — run alone it failed the moment a fresh library came up with four
favourites on it (`github#35`).

| shelf | rows | books | plaques |
|---|---|---|---|
| Favourites | 1 | 0 | 0 |
| Encyclopedia | **1** | 35 | 0 |
| Years | 1 | 12 | 2 |
| Months | 4 | 110 | 14 |
| People | 1 | 26 | 18 |
| Tags | 2 | 44 | 18 |
| **total** | **10** | **227 spines** | **52** |

Six shelves, not seven: Weeks is hidden by default from schema 4 on, and Favourites is emptied
before the golden is taken (`github#35`) — its contents are the vault's, not the packing's. A
decade run that wraps is named on both its rows, which is why Months carries more plaques than
it has years — the golden holds every one of them by text and by box, so a plate that drifts
off its run is a diff. The Encyclopedia has no plaques at all: a letter volume names itself.


---

## The plugin behaves inside a real Obsidian

**Not checked any more.** `scripts/obsidian-smoke.mjs` launched a real Obsidian, enabled the
plugin in a throwaway vault and drove ten checks through it — the ribbon icon, the view
lifecycle, the settings tab on both paths, Obsidian's own markdown renderer. It was removed on
2026-09-10 at the request of the person it kept interrupting: it opens Obsidian windows on a
machine somebody is working on.

What it covered is now covered by hand, and the two things it caught that nothing else could
are worth keeping in mind when changing the plugin: **Obsidian styles bare elements** (it
centres every `<button>` and gives `select` a full width), and **it will not load a plugin in
a vault it has not been told to trust** — a fresh vault asks *Trust author and enable
plugins?* behind a Settings window, and until that is confirmed the plugin does not load at
all, which looks exactly like a broken plugin.

These were taken by hand inside Obsidian on **2026-09-09**, against the fixture as it stood
before `github#7` rebuilt it (394 notes, 8 people, 13 tags). Nothing here is driven by
`smoke.mjs`, so the counts have not been re-measured against the 4,938-note vault; the shapes,
the timings and the `undefined` are the claims, and the counts move with the fixture.

| Check | Measured |
|---|---|
| the plugin loads | 394 markdown files; ready 0–1,600 ms after enabling |
| the bookshelf icon is in the ribbon | 4 shapes at 18×18px, rail stroked |
| the view opens and the library renders | 6 shelves, 182 spines, 6 year plaques, 1,250 ms — measured before `design/0019`; a fresh install now opens **7** shelves, the first one empty, and the spine count is unchanged |
| the tab carries the same icon | 4 shapes in the tab header |
| people and tags came from the metadata cache | 9 people books, 16 tag books |
| the debug surface is not shipped | `window.__vs` is `undefined` inside Obsidian |
| three close-and-reopen cycles | 1 mounted root; DOM nodes 2,675 → 2,675 |
| the settings tab renders on both paths | 4 declarative definitions, 4 rows from `display()` |
| the note is rendered by Obsidian's own renderer | 238 characters in 7 elements, no fallback text |
| a long note wraps instead of widening the reader | reader 1,216px, note 495px, nothing scrolls sideways |

`--look <name>` writes the plugin's own `data.json` before Obsidian starts, so `--shot` can
photograph any look as a person would actually have it. Re-measured 2026-09-10 on the
mirror vault under leather: **10/10, 543 files, 417 spines, 22 plaques, 4 settings rows**, and
under cyber: **10/10, 543 files, 323 spines, 13 year plaques, 122 people books and 130 tag
books** — the spine and plaque counts differ from leather's because the Weeks shelf is hidden
by default from schema 4 on, not because a look moved anything.

`--host-theme light|dark` drives the host's own switch before the shot — `theme-light` on the
body plus a `css-change`, the pair the plugin listens for. `design/0017`: a look declares its
own colours and stops following the theme, so what this catches is everything a look did *not*
declare, since Obsidian repaints its native controls and its rendered markdown on that class
and both land inside the page. The vault's own `appearance.json` does not do it — it is
written, it is copied, and Obsidian starts dark anyway. Measured under cyber with a light host:
body `theme-light`, the app's ground `rgb(255,255,255)`, the page reading `data-theme="light"`
under `data-look="cyber"`, note ink `rgb(232,245,255)`.
## The plugin says what changed, once

`node scripts/update-note-selftest.mjs` — **51 cases**, pure Node, in the pre-push hook and in
`release.yml` with no skip flag. `github#33`, `design/0023`.

Twelve of them are the decision table itself, and they are the ones worth naming: a **fresh
install** shows nothing and records the version; a `data.json` with **no marker** shows the note
(somebody who had the plugin before update notes existed); a **MINOR or MAJOR** shows it and
records nothing until it is dismissed; a **PATCH** shows nothing and records; the **same**
version shows nothing and writes nothing at all; a **downgrade** records; and a MINOR whose note
is for **another version** shows nothing rather than a stale note — which is what `release.ps1`
refuses an `x.y.0` over.

The other thirty-nine are the grammar and the chain. **Any problem is no note**: no heading, a
heading without a patch number, no bullets, prose outside a bullet, a second heading, six
bullets, a 161-character bullet, 5 KB of file, markup, a `data:` URI, a control id outside the
`vs-` namespace, five controls. And *a < b, and 3 > 2* is fine while `<img src=x>` is not,
because the markup test is `<` followed by a letter, `!` or `/`. The chain lists every `x.y.0`
strictly after the version last seen, oldest first, **patches left out**, the note's own version
last, `CHAIN_MAX` 8 before the rest collapse into a single `…`.

The constants are `NOTE_MAX_BYTES` **4096**, `NOTE_MAX_LINES` **5**, `NOTE_MAX_LINE_CHARS`
**160**, `POINTS_MAX` **4**, `CHAIN_MAX` **8**. `scripts/build-plugin.mjs` enforces every one of
them at build time and additionally refuses a `>` id that is no `id="…"` in `src/page.html`, so
a note the plugin could not show is a build that does not finish. 0.1.0's note measures **5
lines, 1,895 bytes, pointing at nothing**, and **1 release** is parsed out of `CHANGELOG.md`
into `vs:releases`.

**The marker is not in the core.** `core.migrate()` returns a fixed shape (`decisions/0001`) and
drops what it does not know, so `lastSeenVersion` inside `Persisted` would be erased by the next
settings write and the strip would come back. It is held on the plugin and merged back by
`persisted()` on every `saveData`; the harness check named *a settings write keeps the version
the strip recorded* is what pins that, and it is the one thing in this port that is not Vault
Graph's code.

`node scripts/update-note-check.mjs` — **31 checks** in a real Obsidian over seven seeded
`data.json` states, claiming `screen-left` (`github#37`, `decisions/0012`). Run by hand, like
the other browser gates; `release.ps1` names it on every `x.y.0` because **numbers cannot see**
and the strip is a user-facing surface that ships. Measured 2026-09-12 against the 4,938-note
vault, Obsidian at 1600×1000: the strip is **164.13px** tall with five bullets, and the library
goes **757.44 → 921.56px** when it is dismissed — the room takes the height back within a
pixel. **The width does not move**: 1556px either way, in a 922px view. It writes
`01-strip-up.png`, `02-dismissed.png`, `03-chain.png` and `04-pulse.png`. Past `CHAIN_MAX`
the oldest links collapse: **11 releases behind draws 9 links** — one `…` to the releases page,
then the newest eight.

## No two suite runs, no two windows on one screen, and no fixture pulled out from under one

Not a check in `smoke.mjs` but a property of the harness, held by driving the runs themselves.
`decisions/0011`, `decisions/0012`, `design/0006`.

**The suite takes the `suite` lock itself**, at startup, and releases it on every way out. Until
2026-09-11 it took no lock at all — `grep -n lock scripts/smoke.mjs` matched one unrelated
comment — and the mutex was caller discipline the `--only` iteration loop never followed.
Measured by driving it:

| run | what happened |
|---|---|
| `--only ...` while the sister repo's suite held the lock | `WAITING for suite -- held by vault-graph-86 for 13s`, then `BUSY ... gave up after 15s`, exit 1, no Chrome started |
| `--only ...` with the lock free | `ACQUIRED`, ran, `RELEASED`; `lock.mjs status` clean afterwards |
| a run that throws after acquiring (`--chrome C:/nope/chrome.exe`) | `ACQUIRED` then `RELEASED`, exit 1 — the release is an exit handler, not a happy path |
| `--no-lock` while another owner held the lock | ran to completion, and the holder's lock was **still held** afterwards: a `--no-lock` run never releases somebody else's |
| `--only` misspelled | refused before the lock is taken, so a typo never waits out another run |

The owner string carries this process's pid and `lock.mjs` refuses a release by anyone else, so
a late release cannot take a lock somebody has since acquired.

### A lock names the display, and the display is claimed by whatever parks a window on it

`github#37`, `decisions/0012`. Until 2026-09-11 the two repos shared one lock **root** and not
one **vocabulary**: Vault Graph named a lock after a screen, Vault Shelf after an activity
nothing here performs, and contention is by name. Measured by driving a real acquire from each
repo, 6-second timeout, `record`/`screen-*` only:

| holder | contender wants | before | after |
|---|---|---|---|
| VS `record` | VG `record` | BUSY | BUSY |
| VS `screen-left` | VG `record` | BUSY *(their alias)* | BUSY |
| VS `screen-left` | VG `screen-left` | BUSY | BUSY |
| VS `screen-left` | VG `screen-right` | **ACQUIRED** | **ACQUIRED** |
| VG `record` | VS `screen-left` | **ACQUIRED** — the hole | **BUSY** |
| VG `screen-left` | VS `screen-left` | BUSY | BUSY |
| VG `screen-right` | VS `screen-left` | ACQUIRED | ACQUIRED |
| VG `suite` | VS `suite` | BUSY | BUSY |

One row moves, and it is the one the issue is about: a sister-repo recording holding the left
screen no longer lets a Vault Shelf harness open a window on top of it. Two rows deliberately do
**not** move — `screen-left` against `screen-right`, in both directions — because a lock named
after a display is what keeps a right-screen recording running beside a left-screen suite.

**A harness that cannot have the display names the holder and gives up before it builds
anything**: `teardown-check --lock-timeout-ms 8000` against a held `screen-left` printed
`WAITING for screen-left -- held by vault-graph record-demo.ps1 -Monitor left for 0s`, then
`BUSY`, and exited **1** with no page built and no window opened.

**`leftWindowArgs()` without a claim throws** rather than answering, so a future harness cannot
place a window and forget to claim the screen.

### A hold says whether it is still alive

`github#25`, `decisions/0012`. `lock.mjs` wrote `pid: process.pid` and exited, so the recorded
pid was dead within a second and a crashed holder read exactly like a healthy one. Measured:

| | before | after |
|---|---|---|
| a lock whose named holder process is gone (age 0s, stale window 1200s) | waited out the full window | `BREAKING dead screen-right lock (owner ..., pid 999999 is gone)` — **3 ms** |
| a live in-process hold, read 35 s apart | `at` fixed at the acquire time, so the hold aged towards being broken | `at` moved **30,010 ms**, `since` moved **0**; a sister-repo acquire measures the hold at **5 s**, not 35 |
| a hold taken from the command line | `pid` of a process that had already exited | no `pid` at all, `holder: "cli"`, and `status` prints `holder unverified` |

The stale windows stay 30 minutes for `suite` and 20 for the rest. Liveness would allow minutes,
but the sister repo's own holds do not heartbeat, and a shorter window here would break *their*
live runs — the mirror image of the fault this fixes.

**A fixture directory is never removed because a sibling appeared.** The store is shared by
every worktree through git's common dir, and a fixture is named after the digest of the
generators that built it. Measured by seeding the store and forcing a miss, twice:

| seeded | after a run that regenerated `demo-vault` |
|---|---|
| a **fresh** sibling digest with a marker file in it | still there, marker intact — under the old prune it was deleted |
| an **aged** sibling digest (30 days) | collected |
| the **real** fixture, same digest, stamp backdated 30 days, marker file added | rebuilt: stamp day back to today, marker gone — the weekly refresh still refreshes |

That third row is the one that nearly broke: skipping the same-digest directory in the prune
made a miss unable to replace it, so a week-old fixture would have been used for ever. Publishing
now tells a **fresh** same-digest directory (another run got there first — keep theirs) from a
**stale** one (rename aside, replace, delete), and never renames onto an existing directory,
which on Windows throws rather than replacing.

## A tree is gated once, and a partial run never claims to be a full one

Not a check in `smoke.mjs` but a property of the gates themselves, held by
`node scripts/suite-stamp.mjs --selftest` — **17 cases**, against a throwaway repository and a
seeded fixture store. `decisions/0010`.

What it asserts: a clean tree records a stamp; the same tree hits again from a **new commit**
and from a **`--no-ff` merge commit**, which is the whole point, since the merge that reaches
`main` is a new commit carrying `develop`'s tree; a changed tree misses; an earlier tree still
hits when asked for by revision; a **dirty** tree refuses to record; a run that lost a fixture
to a failed generator refuses to record; a stamp naming no fixture run misses;
a **regenerated** fixture misses and hits again when the store is put back; an **unpinned**
fixture older than `FIXTURE_MAX_AGE_DAYS` (7) misses, because the next run would regenerate it
and measure something else; a **pinned** fixture never ages; and the CLI **answers rather than
exiting silently** -- a `suite-stamp: ` line, and 0 or 1 rather than a usage code.

That last case asserted exit **1** at first, which passed only while the real repository's own
HEAD happened to be unstamped: the CLI resolves `check HEAD` against the repository it lives
in, not the throwaway one it is spawned in, so stamping this branch's tip turned a green case
red. A self-test that reads state it does not own is measuring the wrong thing; what it holds
now is the property the junction bug actually broke, which was silence.

That last one is not hypothetical next door: the sister repo's copy guarded its CLI body by
comparing `process.argv[1]` as typed against a realpath'd `import.meta.url`, so through a
directory junction — which is how every Orca worktree is reached — it printed nothing and
exited 0, and both gates read that as "stamped". Every push from a worktree went out
unmeasured. Here both sides are realpath'd, and the hook and `release.ps1` both require the
`passed the invariant suite` **line** rather than an exit code. **The seventeenth case is
that junction**, driven rather than reasoned about (github#27): the self-test makes one to
`scripts/`, spawns the CLI through it, and asserts the `suite-stamp: ` line and a 0 or 1 —
the property the sister repo's bug broke, measured on the path that broke it. Driven by hand
through a real `mklink /J` the same day, before the case existed, the CLI already answered:
exit 0 and the pass line for `develop`'s tree. The hole was closed in code by github#5; what
was missing was the proof.

**A run that lost its fixture names it.** A generator that fails is dropped by `gen()`;
`record()` refuses to stamp such a run and `lookup()` refuses a stamp that names no run. Since
github#27 the runner says which one: `not stamping this run: a run without vault (the
generator failed) is not the full suite`. Before `decisions/0014` this was measured by
breaking the sparse generator for one run — 87/87 on the two shapes that still ran, exit 0, no
stamp; with one fixture there is no partial run left to have, which is why the selftest now
drives `record({ fixtures: [] })` instead.

A stamped push to `develop` costs **7.5 s** and an unstamped one the suite on top, both measured
by driving the hook with the ref lines git hands it. What the suite itself costs is the next
section.

## Two Chromes, and one shape to run them on

`decisions/0013`, `decisions/0014`, github#39, github#17. Three rules, each read off the run's
own output.

**Two lanes is a ceiling, not a default.** `LANE_CAP = 2`; `--jobs` clamps to it and says so
(`--jobs 4 clamped to 2: two Chromes is this suite's ceiling, not its default`). `--jobs 1` is
the quiet run. It was four — the load that hard-restarted the sister repo's machine across six
worktrees (`vault-graph#110`, which answered by going to one; why this repo stopped at two is in
`decisions/0013`).

**A check may still declare the shapes its assertion depends on, and nothing declares one.**
`check(name, fn, { on })` survives `decisions/0014` and its guard survives with it: `on` is
validated against `FIXTURE_NAMES`, so a name no fixture answers to fails the run **at module
load, before the lock and before any Chrome**. That is not hypothetical — it is how this
reconciliation was caught. `decisions/0014` left one vault, and github#39's 61 annotations all
named `demo-vault`, `sparse-vault` or `library-vault`; the guard rejected every one and **0
checks loaded instead of 89**.

**The 61 annotations are gone, and the mechanism is not.** An annotation naming a shape that no
longer exists is a claim about coverage that cannot be true, and the run above is what that
costs. The parameter and its guard stay because they are what turns the next stale shape name
into a loud failure rather than a silent skip; a second shape would arrive with them already
in place. `decisions/0014` records the call.

**github#39's win was arithmetic over three shapes, and it has to be re-measured rather than
re-typed.** Narrowing 61 of 89 checks off two of three shapes took 267 check runs to 146. With
one shape there is exactly **one run per check** and nothing to narrow: the same saving, reached
by having one vault instead of by annotating three. What is left of #39 here is the lane cap, the
settle check, and `--timings`.

**A check that returns with the page still moving FAILS, and says what it left.** After every
check the runner asks the page whether anything is in flight — `settleRoom`'s coalescing 60 ms
timer (`__vs.room().pending`), a drag still in the air, a reader or sheet left open — and fails
*that* check, naming it, then settles the page so the next one starts clean.

**Measured on this machine, lock free and timed by the runner's own clock** (printed after the
lock, so a wait for another worktree's suite is not counted):

| | three shapes, before `decisions/0014` | one vault, 2026-09-11 | one vault, 2026-09-12 |
|---|---|---|---|
| wall, after the lock | **41-43 s** | **32 s** (two runs) | **38-39 s** (two runs) |
| Chromes | 7 | **3** | **3** |
| check runs | 146 | **90** | **94** |
| check time | 34.1 s | **30.3-30.5 s** | **33.4-37.7 s** |
| checks | 89 | **90** | **94** |

**The run count fell by 38% and the check time by 11%, and the gap is the point.** A run costs
**234 ms** on the three shapes and **338 ms** on the 2026-09-11 column, because
`decisions/0014`'s vault is twelve times the demo fixture and most of a check's cost is the page
it is driving. Narrowing 61 checks off two small shapes removed cheap runs; one big vault makes
every remaining run dearer. The saving is real and it is smaller than the run count suggests —
which is why this table was re-measured rather than re-typed from github#39's.

**Every column of it goes stale on its own, and the second one did.** The 2026-09-11 column was
written at 90 checks and still said 90 when the suite ran 94. Three merges into `develop` moved
the count and none of them touched this table: `de80843` (90 → 91), `cefdfc2` (91 → 93) and
`38fb7ea` (93 → 94) — against this repo's own law that a changed constant moves `invariants.md`
in the same commit. Nothing was wrong with the runner; the record simply drifted, which is the
failure mode a measured table has and an asserted one does not. The third column is that
re-measurement, and the prose above no longer repeats the count, so there is one place to change
rather than two. **A column here is only ever true of the tree it names**; add a check and it owes
a new one.

**The four new checks are not what made it slower, and nothing here says what did.** They are
`a short cover is stood upright by one face`, `a hovered swatch paints the room`, `a right-click
dyes a book, a plate's run or a shelf` and `a spine's title never touches a line the binding
draws`, and together they are **958 ms and 1,066 ms** across the two runs — every one of them
*below* the 355-401 ms mean, about **1 s** of the **6-7 s** the wall moved. The remaining 5-6 s is
unattributed: the 2026-09-11 column was taken without keeping its `--timings` JSON, so there is
nothing to diff it against check by check.

**Read that gap as a measurement, not a regression.** The same tree measured **33.4 s** and
**37.7 s** of check time in two consecutive runs — a 4.2 s spread with nothing changing between
them — and both were taken on a night when five other worktrees were driving the machine and
queueing on the `suite` lock. A wall comparison across days is only worth as much as the load was
alike, and these two days were not. **Keep the `--timings` JSON beside any column added here**;
without it the next person inherits this same unanswerable gap. This column's is
`.ai-context/timings-2026-09-12.json` — the 37.7 s run, 94 rows, one per check — so the next
re-measurement has something to diff rather than a number to argue with.

`--timings <file>` writes every check's milliseconds as JSON, which is how every column was made.

## Every release guard fires, and none of them writes a tag

`.\scripts
elease.ps1 -SelfTest` — **11 cases**. A throwaway bare repository stands in for
`origin` (the guards *fetch* `origin/main`, so a self-test that faked the ref in a clone of the
real repo would have it overwritten mid-run), a clone of it carries the working tree's
`scripts/`, and each case breaks exactly one thing: a `v` prefix, a malformed version, a
manifest that disagrees, a missing CHANGELOG section, **an update note that names another
version** (`github#33`), a branch other than `main`, a `main` one commit **ahead** of
`origin/main`, a `main` one commit **behind**, a HEAD **off `origin/main`'s first-parent line**
(built as a real `--no-ff` merge and reached with `-AllowAnyBranch`, which is vault-graph#47's
1.8.0 exactly), and a dirty tree. The eleventh case breaks nothing and is asserted on reaching
the lint gate.

Every case asserts the tag count **before and after**, and all eleven are `0 -> 0`: a guard that
fires after a tag has been written is not a guard, and a published tag cannot be moved.
## A native drag is the one gesture the harness cannot drive

**This is the gap that let shelf dragging break completely while 77 checks passed.** A synthetic
`DragEvent` is an event object; a real drag is a state machine the browser owns. Two things only
the real one has, and both bit:

- **Hiding the source cancels the drag.** `liftShelf` took the carried shelf out of the layout
  inside the `dragstart` handler. Chrome takes the drag image and then keeps watching the
  element, so removing it ends the gesture before it starts -- nothing moved, at all, for a
  person. A synthetic dragstart has no such lifecycle to lose, so every check stayed green. The
  lift happens on the next tick now.
- **A dragover nobody accepts means no drop is ever offered.** A synthetic `drop` lands whether
  or not anything called `preventDefault` on the dragover before it, so a target that refuses
  every drag still passes a synthetic check. The check now asserts `defaultPrevented` on the
  dragover it dispatches, which is the part that is really about acceptance.

What still cannot be measured here: the drop itself. Chrome only synthesises a native drag under
`Input.setInterceptDrags`, and an intercepted drag is handed to the debugger rather than to the
page -- measured, with interception on and the drag forwarded back: **dragstart 1, dragover 1,
drop 0**. The page was proven to *accept* the drag (`accepted: 1`, and the ghost appeared and
followed), but the drop that would follow it in a real browser was never delivered. So the drop
handler is covered by a synthetic drop, the acceptance by `defaultPrevented`, and **the join
between them by hand**.

**A drag that reaches the edge scrolls the room** (`github#34`, `design/0024`). `#vs-library`
is the scroller and a drag used to reach only what was on screen when it started. The pointer
inside a **64px band** at the top or bottom now scrolls it, **3px/tick at the inner lip to
20px/tick at the edge, on a 16ms timer** — a timer and not an animation frame, because a Chrome
window that is not painting gets no frames and `watchRoom` already paid for that once.

Measured, with the pointer dispatched **once** and then never moved again — what keeps the room
moving is the loop, not the events:

| | |
|---|---|
| 6px from the bottom edge | **18.4px/tick** |
| 2px from the top edge | **−19.3px/tick** |
| a book drag, still pointer | **500 → 662 → 1694** over 7 steps |
| the landing rail's start | **301px below the fold** |
| the distance it took to clear it | **1,194px**, because shelves rendering underneath kept pushing it down |
| at the foot | clamps **1694/1694** and stays there, loop still running |
| the drop that followed | **1 pick, 0 marks left** |
| a shelf carried by its floor | **0 → 324** in 300ms |
| Escape, mid-scroll | **0 ghosts, 0 `[data-carrying]`, 0 marks, no loop**, and the room did not move again (563 → 563) |

**Increments, never a target**, which is why `content-visibility: auto` needs no settle dance
here: `github#21`'s `settleOn` re-measures because it seeks a computed offset, and this loop
computes none — a height that firms up mid-scroll just extends the runway. The 1,194px above is
that happening.

**The mark is recomputed from geometry as the room moves.** A tick that moved the room replays
one `dragover` at the last real pointer position, so `placeIn`, `shelfUnder` and `leaving` all
re-read rather than the page trusting a mark cached from an event that is now pointing at the
wrong book.

**And a loop that outlives its drag is a check failure, for every check in the suite.**
`atRest()` reports `an edge scroll still running`, so the check that leaks one fails rather
than the one that trips over a library scrolling by itself.

`prefers-reduced-motion` deliberately changes nothing — the scroll is already stepwise
(`scrollTop +=`, never `behavior: "smooth"`) and it is the gesture's reach rather than
decoration. `design/0024` carries the argument.

## Not covered here

- **Anything about how it looks.** Every check above asserts a number; none of them can see
  that something is ugly, misaligned or the wrong colour. **Both** of the bugs in
  `changelog-detail.md` were found by looking at a screenshot while the suite was green.
  `node scripts/smoke.mjs --only "<one check>" --shot out.png` takes it.
- **Popout windows.** The page takes its document from `root.ownerDocument` and `check-scope`
  enforces that, but nothing yet drives a popout.
- **What a theme other than the default does to it.** The suite checks Obsidian's light and
  dark; a community theme can restyle anything it likes, and the `vs-` class prefix is what
  stands between it and this page.
- **Performance at scale.** Nothing measures the product at 10,000 notes since
  `decisions/0014` retired that fixture; the one vault is 4,938. Nothing yet
  measures how long they take to, or what a virtualised rail would save.
