# 0037 — A sticky note on the fore-edge

[0034](0034-the-thumb-index.md) settled what the right edge of an open book is for: a cut is a
position in the *contents*. This record is about a second thing on that edge and a different
question — **where in this note is the thing this book is about?** `github#19`.

> "lets say I am in a note with tags I'd like to navigate to that tag in the note, maybe if the
> book is the tag also show a small sticky note on the right to move the scroll window of the
> note to the actual tag finding, just an idea"

You open `#garden`, read a note in it, and the note is 200 lines long. The tag is *somewhere* —
in the frontmatter, or halfway down — and nothing takes you to it. The book knows what it is
about and the page will not show you where.

## Which edge, and why it is not the top one

`#vs-marks` already owns the top of the spread ([0008](0008-the-magic.md)), and the two objects
are not the same size of thing:

| | marks | is a |
|---|---|---|
| a **ribbon** | a note in a book | thing you left, to come back to |
| a **flag** | a place in a note | thing the book is about, found for you |

A ribbon is per-note and persists; a flag is per-*occurrence* and exists only while that note is
open. Different scale, different edge.

So the flags go on the **fore-edge of the right-hand page**, which is where you flag a page, in
the 16px of air [0034](0034-the-thumb-index.md) already reserved: the rail costs the page 76px,
60 of cut and 16 of air. The flags take the air. **The rail keeps its 60px and the prose keeps
its column** — nothing about the index moved to make room, which is the only way a second object
can arrive on an edge that is already spoken for.

**A cut is a notch; a flag is its mirror.** [0034](0034-the-thumb-index.md) made the cuts square
and flush at the fore-edge with the arc on the inside, where the knife went in, and moved the
shadow from `1px 1px` to `-1px 1px` to follow it. A flag is the other shape and the other
shadow: square where it leaves the page, arced where it points out past it, `1px 1px` down and
right — a plate hanging off a leaf, which is exactly what [0034](0034-the-thumb-index.md)
rejected *for a cut*. The rejection and the adoption are the same argument.

**Below 860px the column is hidden.** The spread stacks into one page and the rail leaves the
edge to become a row of tabs (`page.css`), so there is no fore-edge to flag and no right-hand
page beside anything. A map that cannot be true is worse than no map. The details line still
says what the book is about. This is a known loss and the narrow layout is where to fix it.

## What a book is about

The **classifier's key**, and only for `tag`, `person` and `property`. Not a folder — a folder is
not written in the text. Not a date or an initial. Not a plaque, a made book or a pick, which
have no single subject. And never a key opening with `-`: `-unfiled`, `-undated`, `-plaque-…`
and `-made-…` are all synthetic, and a real tag cannot open with a dash because the exporter's
own tag pattern is `[A-Za-z][\w/-]*`.

The key is **exact**. `keysFor` gives `garden` and `garden/seeds` separate books, so a book is
never about a tag it does not name — which is why the parent book must not flag the child's
mention, and does not.

**Deliberately out of scope: the shelf's own source.** A shelf sourced `tag: garden` but
classified by month has every book about `#garden`, and a reader there would want the same
thing. It is a second subject with its own precedence question against the first, and it is a
follow-up rather than a quiet extension of this one.

## What counts as an occurrence

| | |
|---|---|
| **tag** | `#<key>`, not continuing into a word character, `-` or `/`. `#garden` matches; `#gardening` and `#garden/seeds` do not |
| **person** | a link whose target names them — `data-href` in the plugin, `data-target` on the standalone's own output — **and** the full name written out, on both word boundaries |
| **property** | the value, on both word boundaries, whatever its case |

**A tag is matched as a tag, never as a word.** *Metadata is declared, never inferred*
([decisions/0003](../decisions/0003-metadata-is-declared-never-inferred.md)): the word "garden"
in a sentence is not the tag, and flagging it would be the People-shelf-reading-prose mistake in
a new place.

**The boundary test is ASCII on purpose.** The exporter extracts an inline tag with
`[A-Za-z][\w/-]*`, which is ASCII too, so `#работа` and `#学び` reach the library from
frontmatter and never from a body. Matching the exporter's own vocabulary is what keeps the two
from disagreeing. A *name* may be anything, so the word boundary there treats every letter block
above Latin-1 as a word character and leaves the general-punctuation block out.

**`data-target` is new, and it is one attribute.** Inside Obsidian a wikilink renders as
`<a data-href="Halvor Estrin">Halvor</a>` and the target survives the alias. The standalone's own
`linked()` threw it away — it emitted `data-note`, the resolved note's *id*, and for a link with
no note behind it a bare `<span class="vs-deadlink">`. So `[[Halvor Estrin|Halvor]]` was a
person the page could not name. `linked()` now carries the raw target on both, and the flag reads
`data-href` or `data-target` or an `<a>`'s `href`, in that order.

## Frontmatter has a place to scroll to after all

The ticket asked what a flag does when the only occurrence is a property: *nothing, a mark on the
meta line, or a disabled state that explains itself.*

It is the **details line**. `#vs-notemeta` already prints the note's tags and people, it is a real
box with a real position, and it is inside `#vs-leaf` with the article — so one scan covers both
and the flag places itself at the top without a special case. It draws hollow, with a dashed
edge, and says *"#garden in this note's details"*.

That turns the commonest case in this vault from nothing-to-see into an answer to **why is this
note in this book**. Measured: **0 of 4,939** notes in the fixture write a tag inline, so without
it almost every tag book would have drawn an empty column.

**The hollow flag cannot use a surface token.** The first cut filled it with `var(--surface-1)`
and drew a dark brown blob on a cream leaf: leather redefines the surface tokens *inside the
spread*, and a rule sitting at `.vault-shelf` scope reads the room's values, not the page's. It
is `transparent` now, which is the same answer on any paper. Found by looking at it, which is the
only thing that could have found it.

## Nothing found draws nothing

A property book whose value appears in no body and is not printed in the details line draws **no
flag and no column**. A mark that scrolls nowhere is the thing the ticket said not to ship, and a
line of explanation on every one of 4,939 notes is furniture. The book's own meta already says
what the book is.

## The map

Each flag's position is its occurrence's offset within the scrollable note, as a fraction of the
column. Then a forward pass with a **14px floor** between flags so two close occurrences never
land on one another, then a shift up if the last one ran off the bottom.

**No cap and no "+N".** Three ribbons is right because a real book falls open at the wrong place
with more; a column of flags is a *map*, and a map that stops at twelve is a map that lies about
what is below it. At a density the column cannot hold, the floor closes — `min(14, room / (n-1))`
— so the gaps go before the order does.

## The mark, and the note is never written

`<mark class="vs-here">` around the matched text, one at a time. The previous mark is unwrapped
and its parent `normalize()`d before the next is applied, which is also why a press **re-scans**
rather than trusting the ranges it drew the column from: the unwrap merges text nodes and every
offset it held is stale the moment it runs.

It is the **rendered view** that is wrapped. In the plugin that view is Obsidian's renderer's
output in a host of ours ([0010](0010-the-note.md)); wrapping it changes nothing on disk, and the
next render replaces it anyway. `.vs-hit` — the search's own highlight
([0027](0027-why-this-book-is-lit.md)) — is a different class and the two live on the page
together, so a query and a flag never fight over one span.

## The scroll is instant

`page.scrollTop = to`, the same as `landOn` ([0028](0028-reading-off-the-bottom-turns-the-page.md)).

The first cut used `scrollTo({ behavior: "smooth" })` and the check caught it: the targets were
computed exactly right — 314, 1182 and 2342 of a 2342px span — and the page stayed at **0, 0, 0**,
because a smooth scroll is an animation and an animation does not advance in a window the
compositor is throttling. Chasing the harness would have been the wrong repair. The reader has no
animated scroll anywhere else, [0012](0012-the-reader-is-a-book.md) rejected a page-turn
animation as *"a delay between a person and their note"*, and the whole animation budget is 5px
of hover lift ([0005](0005-colour-and-the-theme.md)). The flag goes where it says it goes, now.

The mark lands about a third down the page rather than at the top, so the sentence it is in has
some of its paragraph above it.

## The fixture had to learn to say its own tag

**Measured: 0 of 4,939 notes in the vault shape write a tag in a body.** Every tag in it is
declared in frontmatter — 808 notes declare `garden`, 404 `garden/seeds`. So the ticket's own
check, *a tag book, a note with three occurrences*, could not be earned from the fixture, and a
check written against it would have gone quiet rather than red.

`make-vault.mjs` plants **A season in the same bed, start to finish**: a long note in
`03 - Resources`, tagged `garden`, which writes `#garden` three times with whole sections between
them so the page must scroll to get from one to the next, and `#garden/seeds` once so the parent
book can be shown *not* to flag the child. The generator refuses to finish if it is missing, if
it says `#garden` fewer than three times, or if it does not say `#garden/seeds` exactly once —
the same shape of guard as every other sentinel
([decisions/0003](../decisions/0003-metadata-is-declared-never-inferred.md)).

This is the price [0034](0034-the-thumb-index.md) already paid for `202212331243`, and it is
stated rather than hidden: the vault went **4,939 → 4,940** notes, the fixture digest went
`c1f3a5ca` → **`3ea58174`**, every suite stamp on this machine misses, and
`scripts/layout-snapshots/vault.json` was rewritten by `update-layout-snapshots.mjs`. A sentinel
has to earn its place, and this one earns it by being the only note in the vault that exercises
the feature at all.

## What it measures

Measured on the vault shape, `tags/garden` open on the sentinel note, at the suite's viewport.

| | |
|---|---|
| flags on the fore-edge | **4** — 1 on the details line, 3 in the text |
| where they stand | 8, 134, 343, 701px down a 713px column |
| what the three press to | **314, 1182, 2342** of a 2342px span, under a 3049px leaf |
| marks on the page at once | **1**, always |
| the note's text before and after | 4,482 characters, **identical** |
| the same note in `tags/garden/seeds` | **2** flags — 1 declared, 1 written, and never the parent |
| a `status` property book, 543 notes | **0** flags, column hidden |

## The checks

Four new, 144 → **148**.

- **a sticky note takes the reader to where the book's subject is written** — the `garden` book
  on the sentinel: four flags at rising positions, exactly one of them declared, each press
  leaving exactly one `.vs-here` reading `#garden` and **on screen**, the three written ones
  reaching three distinct offsets, and the note's text identical afterwards.
- **a subject that is only declared is flagged on the details line** — any other note in that
  book: one flag, declared, landing at 0 with the mark inside `#vs-notemeta` and nowhere else.
  Red at *0 flags* when the scan is narrowed to the article.
- **a person is found through the alias the note actually wrote** — the `Halvor Estrin` book on a
  note carrying `[[Halvor Estrin|Halvor]]`: the mark is **"Halvor"**, the alias a reader can see.
  Red at *0 written flags* when the link rule is dropped and the name is matched as a word.
- **a book flags its own subject and no other** — the same note in the parent and the child tag
  book, and a property book whose value is in no body. Red at *6 flags instead of 4* when the
  `/` in the tag boundary is dropped, which is the whole of the parent/child rule.

All four are pointer-driven and run in the serial lane: they press a control and read where a box
landed.
