# 0027 — Why this book is lit

`github#13`. Reported while driving the rebuilt fixture: *"when searching garden a lot of books
pop up, but when opening one of them I have no idea where garden was mentioned, for example
book L"*.

The other half of `design/0008`. The shelf does its part correctly — the room parts, matching
spines draw forward, nothing is removed — and then you open one and the trail goes cold.

## What it was

Three faults, in increasing order of badness.

1. **The library query did not survive the act of opening a book.** `openBook` set
   `within: ""` unconditionally, and nothing else in the reader read the query at all.
2. **Nothing marked which notes had matched.** The contents list had no per-row match state and
   the note page drew none of the surfaces a match usually lands on.
3. **The two searches did not agree, and the book contradicted the shelf.** The library's
   `matchesQuery` tests title, path, tags, people and body. The reader's *find within this book*
   tested **titles only**. So a book drawn forward on a tag, opened and asked the same needle,
   printed *"Nothing in this book matches."* while the spine behind it was drawn as a match.

Measured on the one vault, typing `garden`: **1,462 notes in 574 books**, and on the
`Encyclopedia I` volume — 36 notes, 6 of them matching, every one of the six on a **tag** —
the contents showed **36 rows, 0 marked**, the head read `36 notes · 8 source folders`, and
typing `garden` into the book's own box left **0 rows** under that sentence.

Fault 3 is the one to fix first even on its own: a book that denies the shelf's own result reads
as a bug in the search rather than as a limitation of it.

## What it is

### One rule, not two

*Find within this book* narrows by `core.matchesQuery` — the same function `applyQuery` calls one
screen away. The contradiction is now structurally impossible rather than fixed by coincidence,
and when the scope rule narrows (`github#58`) both sides narrow together, in one edit, by
identity.

The cost is real and was weighed: with body matching still in, the box returns far more rows than
it used to. On `Favourites · 2026`, `garden` went from **10** rows to **497**. The judgement is
that a narrow reader rule compensating for a broad library rule is the wrong layer — the breadth
is `github#58`'s ticket, and a second rule in here only hides it while making the book lie.

### The query marks in here too, and narrows nothing

`renderContents` reads the live library query — a module-level variable, so there is nothing to
carry in and nothing to go stale — and sets `data-match="1"` on each row whose note matched. The
left page's head gains `· N of M match “<query>”`.

**Nothing is removed by it.** The law is *a filter narrows, the query marks*, and pre-filling the
find box from the library query would have turned the library's mark into a reader-side filter:
open the `I` volume while searching and 30 of its 36 notes would vanish. The mark answers the
question the ticket asks without taking anything off the page.

For the same reason a searched book still opens on its **oldest note**, not on its first match.
That is a law of its own and a search is not a reason to move it; the marked rows and the count
already say where the matches are.

### A row carries the mark, and an open book follows a changed query

`renderReader` records the needle it drew against on `reader.lit`, and `applyQuery` re-renders
the reader **only when that needle differs**. This is a third rebuild path for the contents list
(`design/0026` names two: opening a book, and *find within this book*), and the guard is what
keeps it from becoming a fourth: every other caller of `applyQuery` — a ribbon toggled, a dye
picked, a shelf moved — leaves the index standing, so `design/0026`'s un-rebuilt list is intact.

It is not a theoretical path. The library's search box stays in the tab order behind the open
reader, so the query really can move under a book that is already open.

### The note page names the detail, and `matchReasons` is where the rule says why

`core.matchReasons(note, needle, index)` returns the surfaces the needle was found in —
`title`, `tag`, `person`, `folder`, `cover` — and `renderMeta` marks the needle **where it
sits** inside the title, the folder, a person or a tag. `#garden/seeds` on a matched note draws
with `garden` on a ground, which is the answer to *where was garden mentioned* in one glance.

A note whose only match is a **cover** has nothing on its own page to point at, so the line
**names the spine instead** — `on the shelf as “No one named”`. This paragraph used to read
`path`, `body` and *matches in the text*, and it ended: *that phrase disappears on its own the day
those surfaces leave the rule.* `github#58` was that day. What replaced it is strictly better: the
old wording admitted there was a reason somewhere in prose the reader could not see, where the new
one **names** it, and the thing it names is printed on a spine one screen away.

**Why it lives in `core` beside `matchesQuery`, and why `matchesQuery` was not rewritten in terms
of it.** The rule and its explanation belong in one file so a change to one is a visible conflict
with the other. But `matchesQuery` runs over every note of every book on every keystroke —
millions of calls on this vault — and building an array per call to answer a boolean would be
paid on the hot path for a benefit only one note at a time ever needs. So they are two functions,
and a check asserts they agree rather than a refactor making it structural:

> `matchReasons(n, q).length > 0` if and only if `matchesQuery(n, q)`, for every note of the
> vault across six needles — one of them a name spelled **only** on a spine.

Measured: **4,938 notes × 6 needles, 4,140 marked, 4,140 with a reason, 0 disagreements**, across
`tag` 876, `cover` 3,946, `person` 620, `title` 43 and `folder` 192 — and **0** `body` or `path`,
which no longer exist as reasons because they no longer exist as matches.

**That agreement is the whole reason this merge needed hands.** Two branches that each passed
their own gates green produce, textually merged, a `matchReasons` still mirroring the rule the
search had *before* `github#58`: it would have claimed a `body` reason for a note the search no
longer marks, and stayed **silent** about a note marked only through a cover. The equivalence
above is what catches that, and it catches it only because the sixth needle is a cover-only term.

### The first matching contents row is visible when a searched book opens

An ordinary spine open with an active library query reveals the first marked row in the
book's current contents order. This scrolls only the left page: the selected note, right-page
body and default opening order stay the same. An explicit note or ribbon destination takes
precedence, and a blank query or book with no matches reveals the selected row as before.

This is a single reveal at opening, consumed by the existing contents reveal bookkeeping.
It sets the initial scroll position immediately; later navigation keeps its usual scrolling.
Later page turns reveal their selected row; changing the query does not restart the initial
search reveal or move the left page back to its first hit. Date and A-Z contents use the same
rendered row order, with no second sort or matching rule.

## Paint

A marked row wears the accent the way a matching spine does — a 15% ground and the title in the
accent at 600 — and the rules sit **above** `aria-current` so the row you are reading keeps its
own mark. The needle inside a detail is a 34% ground.

The first pass used 8%, which on leather's paper is invisible. The check read the attribute and
passed; the screenshot showed an unmarked index. Numbers cannot see, and this is the fourth time
that has been written down here.

Colour only: a marked row is the same box as an unmarked one, so nothing in the index shifts as
the query changes under it. All of it is `page.css`, so a look repaints it and moves nothing.

## What this does not touch

- **What the query matches.** That rule is `github#58`'s, and this record does not set it. It
  narrowed to title, cover and declared metadata while this branch was open, and because *find
  within this book* is the same function, the book narrowed with it in one edit — which is what
  "one rule, not two" was for. The one thing it did **not** give away for free was the index: a
  cover is not a property of a note, so every reader-side call had to be handed the same
  `SearchIndex` the library uses, or a book drawn forward by the name on its spine would deny that
  name in its own find box. That is fault 3 again, wearing the one surface that cannot be read off
  the note.
- **The body of the note.** Inside Obsidian the body is the app's own renderer
  (`opts.renderNote`), and reaching into its markup to highlight a hit is out of bounds. The
  declared detail line is what this repo owns, and it is where a declared match actually lives.
