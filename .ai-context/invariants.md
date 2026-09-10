# Invariants

Properties that must not regress, and the command that checks each one. **Every number here
was measured, not reasoned about.** If a check fails because behaviour changed on purpose,
update this file and the check in the same commit — a check quietly relaxed is worse than one
that fails.

Run one: `node scripts/smoke.mjs --only "<substring>"`. Run all of them: the pre-push hook does.

Measured 2026-09-09 on the three fixture vaults: demo 394 notes / 11 folders / 8 people /
15 tags / 18 undated, sparse 756 notes / 6 folders, library 10,000 notes / 15 folders. The
demo vault draws **182 spines** across the six default shelves.

---

## The library renders, and it renders quietly

The page mounts, the core is on `window`, and spines are on screen before any check reads a
number. `"__vs is present and the library rendered"` is the gate the harness waits on before it
starts, so a failure here means every other number would have been measured against nothing.

`"the page loads with no console errors"` reads `Runtime.exceptionThrown` over CDP and asserts
zero. It is the cheapest check here and it has caught more than its share.

## The six default shelves are the six default shelves

`"the six default shelves are there, in order"` — `encyclopedia`, `years`, `months`, `weeks`,
`people`, `tags`, in that order, by id. The order is the argument the product makes on first
open (`design/0002`), so it is asserted rather than assumed.

## A shelf's note count is unique notes, never the sum of its books

This is the central law. A note with three people belongs in three books; the shelf still holds
one note. `"a shelf's note count is unique notes"` walks every shelf, collects note ids across
every book into a set, and asserts the set's size equals the shelf's own `noteCount`.

It also reports how many shelves have `sum > unique` — that is, how many genuinely place a
note in more than one book. Measured on the demo vault: **2 of 6** do, People at 478/394 and
Tags at 516/394. On the sparse vault that also covers notes naming five people and six tags at
once, which is eleven books for one note. A run where **no** shelf overlaps means the fixture
stopped exercising the law and the check has gone quiet without failing.

## Every note has at least one address

`"every note reachable from the vault is on at least one shelf"` collects every note id in
every book of every shelf and asserts nothing in `data.notes` is missing. With the six defaults
this is guaranteed by the Encyclopedia alone — every note has a title — and it is checked
anyway, because the day somebody adds a filter to a default shelf is the day notes start
disappearing quietly.

## Undated is a book, not a guess

`"an undated note lands in Undated"` counts notes with `date === null` and asserts the Years
shelf's `-undated` book holds exactly that many, and that it sorts **last**. Measured on the
demo vault: **18 undated notes, 18 in the book**, which sorts last of four. `decisions/0003` is
why there is an Undated book at all rather than a file-stamp fallback.

The sparse fixture puts about a fifth of its notes there on purpose. A run where the count is
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
before it reached A. Measured on the demo vault: 0 single-digit books, and the `0-9` volume
holds **187 of 394** notes, because its daily and meeting notes are titled with an ISO date.

## Plaques are date-only and asked for

`"year plaques only appear on date classifiers, and only when asked for"` compares, per shelf,
whether it *wants* plaques (`shelf.plaques`) against whether any of its books *has* one. The
two booleans must be equal on every shelf. A "year" plaque over a People shelf would be a year
taken from nowhere.

`"a plaque sits under the books it names, in the same scroller"` is the geometric half: the
plaque hangs **below the shelf floor**, not on top of the books — its top clears the board by
at least the board's own thickness — and one row contains both. Measured on the demo vault:
the plaque hangs **12px** below its books, clearing the **3px** floor, and matches their width
to **0px**. The floor is drawn as a background line on the track rather than as its bottom
border, which is what leaves room underneath for a plate to hang; `design/0003` is why being
in the same element is structural rather than positional.

`"years group under decade plaques, and a run that wraps is named on both rows"` asserts that
every dated year book carries a plaque whose range is a real decade — starts on a multiple of
ten, spans exactly ten years, and contains that year — that **Undated carries none**, and that
no plate anywhere in the library is drawn over an empty run. Measured on the demo vault: **16
dated year books under `2010-2019` and `2020-2029`, 40 plates across every shelf, 0 of them
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

## A book is as thick as it is full

`"a spine's thickness is its note count"` reads `--spine-w` off every spine on the Years shelf
and asserts that widths rise with note counts, that the fullest book is as wide as any book on
the shelf, and that every width falls between **22px and 58px**. Measured on the demo vault:
**26px for a 1-note book, 53px for the 227-note one**; on the 10k library vault **45px at 309
notes and 50px at 1020**. It is a tie, not an identity: two counts a few notes apart round to
the same pixel. The scale is logarithmic and it is taken against the largest book in the whole
**library**, never in the shelf, so the same thickness means the same size everywhere on the
page. `design/0011`.

Both bounds and the scale are constants in `src/page.js` (`SPINE_MIN`, `SPINE_MAX`,
`thicknessOf`). Changing one changes this section in the same commit.

## An impossible date is not a date

`"an impossible date is not a date, and never a fifteenth month"` asserts three things at once:
every resolved date passes `core.isIsoDay`, no month book has a key outside `01`-`12`, and any
note whose `date` header is not a real day is either **Undated** or dated from its filename —
never from the broken header. Measured on the sparse vault: **2 impossible headers, 1 fell
through to the filename, 1 Undated, 0 landed anywhere else**.

The demo and library fixtures have no such note, and the check still runs there: it says so in
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
and clearing returns to exactly the starting count. Measured on the demo vault: 394 -> **112**
under `04 - Daily Notes`, back to 394.

A filter that reorders shelves would break the one thing the product promises about
orientation: a shelf lives at a stable address in the room.

## Hiding a shelf hides it, and never deletes it

`"a hidden shelf keeps its definition and its books"` hides the Tags shelf, asserts the
visible count went down by exactly one, asserts the hidden shelf **still has its books built**
— it holds reading places and answers "also shelved in" — then restores it and asserts the
visible count came back. Measured: 6 visible → 5 → 6, and the hidden shelf still held **16**
books.

`"hiding every shelf offers a way back rather than an empty room"` hides all six and asserts a
recovery card with a working button is on screen and zero spines are drawn, then restores.
An empty room with no way out is the worst reachable state in this product.

## The reader

`"clicking a spine opens a book on the note it names"` clicks a real spine on the Years shelf
and asserts the reader opened on the book that spine addressed, with a non-empty contents list.

`"the index tabs cut the book the way the book is ordered"` opens the largest Encyclopedia
volume and asserts its contents are in **title** order, that every tab label begins with the
volume's own letter, that the labels rise, and that there are as many as the titles admit —
up to four. Then it opens the largest person's book and asserts its tabs are **dates**,
because its contents are in date order. Measured: on the mirror of a real vault, `A` holds 56
notes behind `A Aft`; on the 10k library, `U` holds 404 behind `Ub Uc Uf Ug Ui Ul Um Up …`;
on the demo fixture `G` holds 25 behind one tab, because all 25 are titled "Greenhouse
Rebuild — …" and no prefix separates them. `design/0015`.

`"the reader's index tabs stay countable on the biggest book"` finds the largest book in the
vault and asserts its tab count is between 1 and 26. Measured on the demo vault: the biggest
book is `people/-unfiled` at **228 notes behind 20 tabs**. On the library fixture the biggest
Encyclopedia volume runs to hundreds of notes and the tabs collapse to twelve ranges;
`design/0004` says why a tab you cannot hit is not navigation.

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
notes as the second. Measured on the demo vault: `#garden` collects **78** notes with its
`garden/seeds` and `garden/soil` children and **38** without -- a difference of 40.

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

The leather look renders at **120% scale**: logical 132px spines are **158.4px** on screen,
13px Georgia titles render at **15.6px**, and spacing and controls grow with them. Row
wrapping may repeat more plaques, but note/book counts, order and addresses remain intact.

Month display labels use **Jan–Dec plus the four-digit year** (for example `Sep 2026`).
Their keys remain `YYYY-MM`; addresses, date ordering and year plaques are unchanged.

Encyclopedia (`initial`) volumes always share palette slot 1. **Manage → Vary book colors**
is off by default, including when older settings are migrated. When enabled, other books
choose one of the twelve slots by their stable address, never by changing folder counts or
membership. A theme/look switch may repaint the palette; incoming notes may not reassign it.

`node scripts/smoke.mjs --only "book colors"` drives the checkbox and reloads its saved
setting, changes the dominant folder by adding notes, and reverses folder ranks. Measured
in light, dark and leather: **419 / 194 / 709** existing book colors unchanged on demo,
sparse and 10k fixtures; encyclopedia volumes use **one** color in every case. Turning
variation on/off preserves all addresses and counts.

## A look is paint, and nothing else

`design/0016`. The leather binding is a second stylesheet (`src/leather.css`) and one setting;
it may repaint anything and it may move nothing.

`"a look is opt-in, repaints everything and moves nothing"` drives the standalone's **own
switch** rather than poking the attribute, and asserts that `data-look` goes `"" → "leather"
→ ""`; that the ground, the first spine's colour and the twelve slots **all** change; that
every book address and every count is byte-identical across the switch; and that switching
back restores the colours exactly. Measured: **182 addresses on the demo vault, 194 on the
sparse, 709 on the 10k library — identical in both looks in all three.**

The default look is the one every other check in this file measures, and it is unchanged: with
the setting off, not one selector in `leather.css` matches. `scripts/check-scope.mjs` reads
**both** stylesheets — an unscoped rule in the second would style the whole of Obsidian
exactly as one in the first — and `scripts/check-network.mjs` reads the second one too, so the
leather grain and wood stay CSS gradients and inline SVG data URIs.

The reworked leather look keeps spines at **22–58px × 132px**, with a **5px vertical hover
lift** and no rotation. Reduced motion removes transforms, including worn and matching books.
Its walnut board is **10px** deep. The reading cover has an **11px** outer ring, with **24px
side gutters** on desktop and **16px** below 860px, so the cover stays inside the view.
The page remains capped at **1180px**. These are paint dimensions, not membership constants.
Measured in leather at **390, 768 and 1440px**: zero row or page overflow; **419** demo books
at each width and in list mode. `design/0016` records the visual review.

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
running against: hard-coding one passed on the demo vault and, on the sparse one, asserted
that a query finding nothing still drew something forward.

## The room

`"the room has a width, however wide the window is"` overrides the viewport to **2560px** and
asserts the library, the rail, a row and the reading spread all fit inside `--measure`
(**1180px**), that the library and the spread are centred within 20px — the tolerance is a
scrollbar, not slack — and that **no row overflows by so much as a pixel**. Measured: shelves
**1180 (683/698)**, row **1180**, spread **1180 (690/690)**, **worst overflow 0px** across
15 rows on the demo vault, 10 on the sparse and 27 on the library.

`"a narrower window grows rows, and a wide one centres the shelf"` drives the viewport to
2560px, to 760px and back. At 2560 a row stops at the **measure** and the gutters match; at
760 it is the window (**705px**, inside a 760px viewport). The library's row count goes
**15 → 25 → 15** on the demo vault, **10 → 14 → 10** on the sparse and **27 → 42 → 27** on the
library, with **0px of overflow** at every width and the same row count on the way back.

The repack is a `resize` listener coalesced into one animation frame; without it a window
dragged narrower keeps the row it was packed for and lets the end of it run off the side.
CDP's `setDeviceMetricsOverride` does not always deliver a resize event headless, so the check
dispatches the event the browser would.

Nothing runs sideways any more (`design/0014`), so the question is no longer whether the
scroller clips but whether anything overflows at all. **The 13px this check caught was a
plaque**: a plate is `align-self: stretch`, so a run of one thin book under `2010-2019` is as
wide as the words, and the packer was costing runs by their books alone.

`"the library is the whole surface, with no sidebar"` asserts **zero** `<aside>` elements,
exactly **two** New shelf buttons, and that they bracket the shelves in document order — the
affordance is at both ends of the scroll, which is the point `design/0009` makes.

## Accessibility and scale

`"plain list mode keeps every book reachable"` asserts the book count is identical in list mode
and that a spine's title is laid out horizontally there.

`"every control the keyboard can reach has a name"` walks every `button`, `input` and
`select` under the root and asserts each has an accessible name from `aria-label`, its own
text, a `<label for>`, a wrapping `<label>`, a `title` or a placeholder. Measured on the demo
vault: **647 controls, all named**.

## Nothing reaches the network

`"nothing on the page reaches the network"` counts `performance.getEntriesByType("resource")`
entries with an `http` scheme after the page has loaded and been driven, and asserts zero. The
static half is `scripts/check-network.mjs`, which is unskippable in the pre-push hook.
`decisions/0006`.

## A spine holds its size

`"a spine lifts on hover and holds its size"` measures a spine's box at rest and focused and
asserts both dimensions are unchanged — the lift is a `transform`, so a hovered spine cannot
reflow its neighbours. Measured on the library fixture: **47×132 either way**. The width is
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

---

## The plugin behaves inside a real Obsidian

`scripts/obsidian-smoke.mjs`, opt-in, 10 checks. Measured 2026-09-10 on the demo fixture:

| Check | Measured |
|---|---|
| the plugin loads | 394 markdown files; ready 0–1,600 ms after enabling |
| the bookshelf icon is in the ribbon | 4 shapes at 18×18px, rail stroked |
| the view opens and the library renders | 6 shelves, 182 spines, 6 year plaques, 1,250 ms |
| the tab carries the same icon | 4 shapes in the tab header |
| people and tags came from the metadata cache | 9 people books, 16 tag books |
| the debug surface is not shipped | `window.__vs` is `undefined` inside Obsidian |
| three close-and-reopen cycles | 1 mounted root; DOM nodes 2,675 → 2,675 |
| the settings tab renders on both paths | 4 declarative definitions, 4 rows from `display()` |
| the note is rendered by Obsidian's own renderer | 238 characters in 7 elements, no fallback text |
| a long note wraps instead of widening the reader | reader 1,216px, note 495px, nothing scrolls sideways |

`--look leather` writes the plugin's own `data.json` before Obsidian starts, so `--shot` can
photograph either look as a person would actually have it. Re-measured 2026-09-10 on the
mirror vault under leather: **10/10, 543 files, 417 spines, 22 plaques, 4 settings rows.**

## Not covered here

- **Anything about how it looks.** Every check above asserts a number; none of them can see
  that something is ugly, misaligned or the wrong colour. **Both** of the bugs in
  `changelog-detail.md` were found by looking at a screenshot while the suite was green.
  `node scripts/obsidian-smoke.mjs --shot out.png` takes it.
- **Popout windows.** The page takes its document from `root.ownerDocument` and `check-scope`
  enforces that, but nothing yet drives a popout.
- **What a theme other than the default does to it.** The suite checks Obsidian's light and
  dark; a community theme can restyle anything it likes, and the `vs-` class prefix is what
  stands between it and this page.
- **Performance at scale.** The library fixture proves 10,000 notes *render*; nothing yet
  measures how long they take to, or what a virtualised rail would save.
