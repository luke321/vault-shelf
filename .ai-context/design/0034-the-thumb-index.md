# 0034 — The thumb index

[0015](0015-the-index.md) settled what the cuts down the right edge of an open book **say**: a tab
is a position in the contents, and the cut follows the order the contents are in. This record is
about what a tab is **made of**, and about what the rail does when the cut is longer than the page
is tall. `github#32`.

> "noticed that right side index tabs overflow sometime, file issue for multi row support, they
> need to look more like real indeces aswell"

## The overflow had already been hidden twice

`.vs-tabs` was one `flex-direction: column` with `overflow: hidden`, so a cut past the spread's
height was painted outside the box and clipped in silence. `dateTabs` capping at about thirty was
the same problem wearing the clothes of a design rule: it dropped the days and then the months, so
a book of 2,450 notes showed eleven year tabs with nothing under them.

[0032](0032-compressing-index-and-shelf-actions.md) then replaced the clip with **compression** —
the cuts share the available height, shrinking their gaps, height and type. That is right while
they stay readable and a lie once they do not. Measured on the vault shape at 1180×480 before this
work: `tags/project/website-migration` drew 25 cuts at **6.7px tall in 5.2px type**, and the
worst book in the library came out at **4.09px**. An index you cannot read is the same lie as one
you cannot see.

So three answers had been tried for one question, and all three ended in something the reader
cannot use: a cut that is clipped, a cut that is dropped, a cut that is too small to read.

## A tab is a cut, not a plate

The old rule was `border-radius: 0 3px 3px 0; border-left: 0` — the **outer** corners rounded, the
inner border dropped. That is a button hanging off the fore-edge. A printed thumb index is the
other way round: the leaf is cut, so the tab is square and flush where the page ends and the arc is
on the inside, where the knife went in.

| | |
|---|---|
| the **notch** | `border-radius: 3px 0 0 3px`, `border-right: 0`. Flush at the fore-edge, arced on the inside |
| the **stack** | the gap goes, and `margin-top: -1px` collapses adjacent hairlines into one rule. This is the change that does most of the work: three pixels of air between the cuts is what made them read as buttons stuck to the side of the book |
| the **thumb** | the accent fill, and nothing else |

The shadow follows the geometry: `1px 1px` (down and right, off a plate) became `-1px 1px` (down
and left, out of a cut). Geometry, so it lives in `page.css` and is the same in all three looks
([0016](0016-the-leather-look.md) — a look is paint, and it may not resize a control). Leather and
cyber each carried their own `border-radius` and `border-left`, which is how a shape drifts; they
now carry only their face — the type and the depth of the shadow.

**Rejected: repainting the tab** as the page's own paper. It would read as a cut more strongly
still, and it would break *the furniture is one material*, which reads a non-current tab against
the plaque in four rooms. Both look checks stay at **0 off**; geometry was enough.

## One rail, one level at a time, under the trail it came through

> "first a index with sub index needs an indicator to show that, second when moving one level down
> we can collapse the other top level index to make room for the sublevel like a trail, also you
> can then stagger the sublevels to save space, going back a level is being achieved by re
> clicking the top level index"

Every level used to stand in the same column: a year, its months, their days, for *every* year in
the book. That is what ran off the bottom of the page — not the dozen years, but the hundred months
dragged down behind them.

**The cut is a tree, and the rail lists one level of it.** The top-level cuts, or — once a cut with
something under it has been pressed — the cuts under *that*, with the cuts it came through kept
above as a trail and its siblings folded away to make the room.

| | |
|---|---|
| the **indicator** | a cut that opens further carries `›` in its own left margin, pointing out toward the fore-edge, which is the way it opens. A trail step carries `‹`, pointing back. An index that opens further on some of its cuts and not others has to say which, and the glyph doubles as the affordance for coming back |
| the **trail** | pressing a cut replaces the level with the cuts under it and keeps the cut itself above. Its siblings go: they are the room the sublevel is drawn in |
| the **staircase** | each trail step stands one notch (5px) further in from the fore-edge than the one below it, so the list being read is always at the edge of the book. Two notches is a staircase; anything deeper stands where the second stands, because a third would only cost the label its room |
| **back** | pressing a trail step returns to its level. There is no other way out and no other state |

**Depth, not a chosen cut.** The state is one number — how many levels down the rail is — and every
cut it shows is derived from where the page stands. So paging with Next through a year boundary
carries the trail with it rather than leaving the index open over a year you have left, and nothing
can be open over a book you are no longer reading. Pressing a cut still goes to it as well as
opening it, so **a tab is a position** is untouched; a trail step is the cut the page is already
inside, so it has nowhere new to send anybody and does not try.

**The rail reserves its staircase rather than growing into it.** 48px of cut at the fore-edge plus
12px of trail gutter, one width whatever the fold. A rail that widened as the trail deepened would
reflow the prose under the hand that was pressing it. The index therefore costs the right-hand page
**76px of padding where it cost 72px** — 4px, once and always.

**And it is as narrow as its widest label, measured.** The first cut of this record reserved 16px
and ran 72px wide, and nothing in it said what the labels actually needed. They need **32px** —
`2020`, the widest thing the rail said at the time — so the rail is 60px, and a trail step keeps a
tighter gutter than a cut that opens, paying for its own notches out of its own room.

**Rejected: banks.** Three columns (`flex-wrap: wrap-reverse`, the bookcase law applied to the
rail) and then two, made even and with a running head on each. Both were built, both passed every
check in the suite, and both were rejected on sight: columns of small plates stop reading as one
object, and the reading order — down the rightmost, then jump to the top of the middle — is
unguessable. Banking is more room for a list that should never have been that long.

**Rejected: scrolling the rail.** The same lie as a clipped one — what you cannot see, you do not
know is there.

## The volume that opened into nothing

> "when opening 0-9 encyclopedia there are no sub tags althought we have many notes starting with
> 2022 for example"

The section above gave the rail its levels, and one volume never got any. `titlePrefix` had a
special case — **the 0-9 volume is indexed by year**, because "0-9" is the only tab a letter cut
can give a book of daily notes — and it returned `word.slice(0, 4)` at *every* depth. So depth 3
asked for a longer prefix and got the same four digits back, the layer separated nothing,
`prefixCuts` recursed once more and fell out at its own `depth > 3` cap. Every year in the volume
was a leaf by construction, whatever it held.

Measured on the vault shape, over every volume in the library:

| volume | notes | top cuts | cuts that open | biggest dead end |
|---|---|---|---|---|
| **0-9** | 2,063 | 15 | **0** | **`2026` × 587** |
| S | 481 | 16 | 12 | `Sq` × 12 |
| C | 209 | 8 | 7 | `Cy` × 1 |
| A | 78 | 14 | 3 | `Ad` × 11 |

The only volume where nothing opened, and the one holding a quarter of the vault.

**A year hands its notes to the layers a date book already uses**, read off the title rather than
the date property. That is the whole fix: `cutTree` with a `TITLE_DATE_LAYERS` twin of
`DATE_LAYERS`. It is also the only fix that keeps the promise this file opened with — the reader
learns one index, not two — and the one that keeps the rail 60px, because `DATE_LAYERS` already
labels a month `Mar` and a day `04` where a raw `2026-03` key would want the same **71px** that
made a span name its start rather than its range.

**Four digits are a year only if they stop at four.**

> "we could have a note that is not a date like 202212123123, incorporate that"

`202212123123` opens with the same four characters as `2022-12-12`. Filed under 2022 it would hang
a run of months off a title that has no date in it at all, so the test carries `(?!\d)` and a
longer digit run falls to the `0-9` bucket instead. A month is validated by probing its first day
through `isIsoDay`, for the reason `build-shelf.mjs` already carries in a comment: a real vault
produced `2024-15-03`, which the exporter once shelved as a fifteenth month called "15 2024".

**And the vault carries one, because a guard nothing can reach goes quiet rather than red.**
`make-vault.mjs` plants `202212331243` in `00 - Inbox` as `DIGIT_RUN` and lists it with the
sentinels, so the generator refuses to finish without it. It lands at index 649 of the volume,
under a cut labelled `0-9` with nothing under it, between the 2022 and 2023 runs — which is what
takes the volume from 15 top cuts to 16, and the vault from 4,938 notes to 4,939.

Planting it re-cut the whole fixture: the digest went `178c03f6` → **`c1f3a5ca`**, every suite
stamp on this machine now misses, and `scripts/layout-snapshots/vault.json` was rewritten by
`update-layout-snapshots.mjs` (9 boxes moved, all of them month plaques, by up to 4px). That is
the standing price of touching the generator, and the reason a sentinel has to earn its place.

**A digit run is named by the digits it opens with, not by the bucket it falls into.** Lukas, on
seeing `0-9` sitting between 2022 and 2023: *"hmm it shoulld be called 2022x instead of 0-9"*. He
is right, and the reason is the law this record already keeps — **a tab is a position**. `0-9` tells
a reader nothing about where in a volume of 2,064 they have landed, and it tells them so three
times over, since the numerics are not adjacent. `202212331243` files after every `2022-` note and
before every `2023-` one, so its cut says `2022·`: where it sits, and that it is not the year.

**Amended by [0035](0035-a-volume-of-numbers.md): the mark is `·`, not `x`.** Lukas, on seeing it
in the rail: *"never show more than for numbers, replace X with something else — or make it smaller
and centered vertically so that it is clear it is a placeholder"*. `x` is a character of the same
size as the digits beside it, so it reads as part of the number; a middle dot is small and sits at
mid-height, which is what a placeholder looks like. It is also **narrower**: measured, `2022·` is
**36px** where `2022x` was 39px, so the rail's headline number went the right way. `…` was tried
first and refused at **43px in the 40px a cut leaves** — cropped.

It cost the rail's own headline number. `2022x` was **39px** against `2020`'s 32px and was then the
widest label the rail drew — inside the 48px of cut with 9px to spare, **0 cropped** at 1180×1000
and at 1180×480, so the rail stays **60px**. The measured claim above is amended rather than the
geometry: 32px was what the labels needed when every one of them was a year.

**Rejected, and built first: making the digits volume a date book outright.** The obvious next
step, and Lukas asked for it on seeing the rail — *"we are ordering by date so why showing where it
is and have it's own index? it should be at its date position"*. One line does it: default
`indexMode` to `date` for the `0-9` key on an `initial` shelf, and because `readingOrder` reads the
same function, the contents and the index move together. It measured beautifully — 11 cuts, all
years, **11 of 11 opening**, 0 rows out of date order, and `202212331243` at its own 2026-09-03
instead of between 2022 and 2023.

It was pulled because of what it does to the shelf *around* it. `readingOrder`'s date comparator is
multiplied by the top bar's oldest/newest, so the `0-9` volume began flipping with a control its
25 siblings ignore — and *date contents default to oldest and saved newest settings remain
readable* turned red on exactly that ([0035](0035-a-volume-of-numbers.md) is the answer that
does not: a `number` mode ignores the reading order the way `az` does): it asserts
`buildShelf(encyclopedia, 'oldest')` is
byte-identical to `'newest'`, which is the law that **an alphabetical shelf has nothing to say
about oldest and newest** (design/0015). One volume of twenty-six answering a switch the rest do
not is two shelves wearing one name. The reader who wants that volume by date still has the toggle,
which is what the toggle is for.

**Rejected: a plausible year range.** Bounding it to, say, 1900–2099 would also stop `1000 small
decisions` drawing a cut labelled `1000` beside `2015`. It is a magic number standing in for a
judgement the data cannot support, and a vault of history notes would pay for it. `1000` stays a
cut, which is what a volume spine does with a number it cannot read.

**Known and left**: the non-year numerics are not adjacent in title order — `0 to 1`, then `1000`,
then `12 weeks of running`, then the years, then `24 hours…` — and a run is whatever is adjacent,
so the rail draws **three** cuts labelled `0-9` around them. Correct by the rule, scruffy to read.
Suppressing a cut that holds one note of 2,063 is a rule about every volume, not this one.

**Since fixed at the root** by [0035](0035-a-volume-of-numbers.md), which is where it belonged:
the three `0-9` cuts were the index telling the truth about contents in the wrong order. Read by
number, the numerics are adjacent, and each gets a cut of its own.

## One word cannot be both a state and an act

> "shouldn't we flip the Date A-Z button? So that users think, what does AZ mean when date is shown
> and vice versa"

The ambiguity is real: a lone button reading `A–Z` cannot say whether it is telling you where you
are or offering to take you somewhere. But **flipping it moves the ambiguity somewhere worse**. The
toggle sits at the head of the rail, and the cuts immediately under it are cut by that mode —
letters under `A–Z`, years under `Date`. A face showing the mode it would switch *to* would stand
the word `Date` directly on top of a column of letters.

So the word stays the state, and `⇄` carries the act. The `aria-label` already said both in full
("Contents: A–Z. Switch to Date") and is unchanged; the glyph gives a sighted reader what a screen
reader already had. It comes after the word, so what the rail is cut *by* still reads first, and
the toggle's box stays **55×28 at 10px** — the glass tab's box exactly.

**The glyph is text, not a span**, and that was not the first cut of it. A `<span>` carrying its
own `font-size: 9px` and `opacity: .55` is an element *a look moves nothing on the page* measures,
and it caught it immediately: leather and cyber drew that span **12px high against modern's 10px**
and 1.7px lower, because it inherited each look's own face. Pinning its box would have meant
page.css owning a third set of numbers for a decoration. As part of the label it has no box at
all, which is the same answer [0016](0016-the-leather-look.md) gives everywhere else — the look
may repaint the type, and there is nothing else there to move.

**Rejected: both labels, one pressed** — the manage sheet's control, which is unambiguous because
it shows the pair. In the rail it would cost a second row, in the one strip whose whole problem is
running out of rows.

## Fit is measured, not calculated

How tall a cut is — in whichever look, at whatever font the host has, in a window of whatever shape
— is not a number this file owns. So `fitTabs` draws the index and, while the level that draws the
most rows does not fit, gathers it one step and draws again.

**Fitted to the fattest level the book can show**, never the one open now: which level the rail is
at follows the page and the reader's own presses, so fitting to it would re-fit on every turn and
give one book two different indexes.

**The last cut's own bottom, never `scrollHeight`.** The rail's overflow is visible by design — a
clipped index is the bug this record is about — and a box that does not scroll does not reliably
report a scrolling area.

**And nothing is thrown away to take the step.** A level that overflows is halved into spans, and
the cuts it held become what those spans open. A range of ranges is still one range, so gathering
twice spans the whole of what both held rather than nesting.

**A span is named by where it STARTS**, which is what a printed thumb index does — `A`, `D`,
`G` — and the cut below it is its other end. It read `Jan–Apr` at first, and a range label is
what made the rail wide: `2024–2025` wants **71px** where `2024` wants 32px, and at 72px it was
already being cropped on the left, silently, in thirty places. What a span covers is on the cut
instead, where a pointer and a screen reader find it.

**Every level at that depth, not only the one that overflowed.** Halving one level at a time spent
sixteen passes on one book's days and never reached its years — but it is also the wrong answer to
look at: one year's months gathered into spans while the next year's stand singly is two indexes in
one book.

**And the compression keeps a floor.** [0032](0032-compressing-index-and-shelf-actions.md)'s
sharing of the height is kept where it works — down to 20px a cut, at 11.5px type throughout — and
below that the cut gathers instead of shrinking. The two together are what make *no cut is clipped
and no cut is too small to read* true at the same time.

**A cut carries the position it opens**, in `data-at`. A press rebuilds the rail under itself, so a
cut cannot be addressed by where it stands — not by the page, and not by a check walking the index.
`__vs.indexTabs()` hands the fitted cut to a check so it can reason about the fold without pressing
into it; on a book of thousands of notes a press re-renders the contents, and that becomes the
whole cost of the check rather than the thing being measured.

## The fit never converged, and the rail hid it — `github#87`

The loop above is the fourth answer to this question, and the third one was wrong in a way none of
its checks could see. *While the level that draws the most rows does not fit, gather it one step*
**did not terminate**. It was never observed to, because the rail it left fitted when it was shut.

The issue guessed that `gathered` returned `null` and the loop stopped early. Traced per step on
`people/Otto Brandt` at 1180×480, it does the opposite — `gathered` never returns `null`, and the
loop spends all twenty-four steps:

| step | depth chosen | rows | `gathered` |
|---|---|---|---|
| 0 | 2 | 20 | 11 cuts |
| 3 | 0 | 11 | 6 cuts |
| 4 | 3 | 10 | 6 cuts |
| 5 | 4 | **12** | 6 cuts |
| 23 | **24** | **26** | 6 cuts |

**A gather adds a level, and the trail charges it to everything below.** A level at depth *d* draws
`d + its cuts` rows, because the rail stands the trail above it. So gathering the fattest level
makes every deeper level one row worse, `widestOf` moves to one of those, and the two chase each
other down: step 4 went from 10 rows to 12. The 24-step cap then left a book of 486 notes an index
**24 levels deep**, `tags/idea` 23 and `tags/project/website-migration` 22.

**The shut rail fitted, which is why one book went red and six did not.** The top level of those
runaway trees is small — six or seven spans — so nothing is clipped until a fold is opened onto one
of the over-full levels underneath. *No index cut is clipped* opens the three widest folds, and on
`Otto Brandt` the third landed on one. Measured over the fourteen fattest books at 1180×480,
**seven of them** were fitted to a tree that had not converged.

**The test was right; the chooser was not.** `--vs-tab-step: clamp(20px, (100cqh − 67px)/n, 28px)`
means the rail fits exactly when the row count is under `(height − 67px) / 20` — monotonic in the
count, so *the fattest level fits* really does imply *every level fits*. What it cannot do is say
which level to gather.

**So the room is measured once and each depth is fitted in turn, shallowest first.** A gather is
paid for by everything under it, so the payment is made before the levels that owe it are read. At
depth *d* the level is gathered into `room − d` spans, which leaves its own trail the rows it
wants; the pass ends where `room − d` falls under two and a gather has nothing left to give. The
depth therefore stays **under the room** by construction, which is the property the search it
replaced could not have.

**And a level is gathered into as many spans as the rail has room for, never into halves.** Halving
is one arity chosen in advance: a level of twenty-six needs four gathers to get under nine, and
each one is a level of depth the trail then bills to everything below. One gather into the room
that is actually there costs one. Three chooser-only fixes were built and measured first, and all
three failed on the same tree: *gather the deepest over-full level* fixed three books and broke
four; *gather whichever depth most reduces the maximum* stalled in a local minimum at 15 rows;
*keep the best tree seen* left four books at 13. Halving is too coarse to reach a fitting tree
inside the depth the trail leaves.

**Measured, 2026-09-17**, over the fourteen fattest books, no cut lost on any of them:

| | before | after |
|---|---|---|
| deepest fitted tree, 1180×480 | **24 levels** | **8** |
| books whose fit had not converged | **7 of 14** | **0** |
| cuts clipped, 1180×480 | 1 | **0** |
| most cuts on show, 1180×480 | 10 (in a room of 9) | **9** |
| 1180×1000 | room 37, nothing gathers | unchanged |

**Known and left: four alphabetical tag books are one row over, at the bottom of the rail.**
`website-migration`, `garden`, `sleep`, `reading` and `idea` are 26-ish letters over four raw
levels, and at 1180×480 they settle at depth 8 with 10 rows against a room of 9 — 94 levels over,
every one of them eight presses down. This is **not the chooser giving up**: a beam search over
every grouping sequence there is — all depths × all group counts — proves 10 is the floor. Grouping
adjacent cuts cannot do better, because it only ever *adds* levels and each one costs a row.
Closing it needs a new operator, and the two candidates both break something this record already
settled: collapsing a raw layer throws a cut away, and bounding the trail the way the staircase
bounds its notches makes the rail stop saying how you got there. It is filed rather than guessed
at, which is what the three wrong answers above earn it.

**Rejected: widening the check to every level.** It would turn the suite red on that known floor,
and a check that is red for a reason nobody intends to act on stops being read. *The fitted index
converges* asserts what was actually violated — the depth stays under the room, and every level the
pass can reach is inside it — and **prints** the floor's count so the number is on screen rather
than in a record.

## One thumb

`aria-current` was set on **every** cut at or before the page, so a book read to its end lit the
whole rail: measured over the twelve fattest books, opening each at its last note lit **every cut
on every one of them** — 26 of 26 on the worst. It is the last cut the page has reached, and one
only.

## A resize that changed only the height

The room watcher deliberately ignores a resize that did not change the **width**: the packing is
about how many books fit in a row, and a taller window costs nothing to repack. But the rail is
fitted to the height it has, so a window dragged shorter kept the index it had been fitted for and
let the end of it hang off the bottom — the same bug as the one this record is about, one level up
from where it was filed. The rail is re-fitted on every measure, before the width is compared.

## What moved

Measured 2026-09-14 on the vault shape, over the fourteen fattest books, at 1180×1000 and 1180×480.

| | before | after |
|---|---|---|
| cuts clipped | 0 | 0 |
| **smallest type, 1180×1000** | 11.5px | 11.5px |
| **smallest type, 1180×480** | **5.2px** (4.09px over the whole library) | **11.5px** |
| smallest cut box, 1180×480 | **6.7px** | 20px |
| rail width | 56px (5.2% of the spread) | 72px (**6.6%**) |
| what the index costs the prose column | 72px | 88px |
| most cuts on show at once | 27 | 32 closed, and the fold is a press away |
| `people/-unfiled`, 2,450 notes | 11 year tabs, **months and days dropped** | 11 years, each opening its months, **nothing dropped** |
| cuts lit at the end of a book | up to **26 of 26** | **1** |
| **Encyclopedia `0-9`** | 2,063 notes, 15 cuts, **0 opening**, `2026` a leaf of **587** | 2,064 notes, 16 cuts, **11 of 12 fat ones open**; `2026` (596)→9 months, `Sep` (91)→13 days; biggest dead end **5** |

## What the lane parity exposed

The merge to `develop` came back with two checks red that had never been red before, both of them
older than this branch, both green on `develop` the moment `src/` and `scripts/` were reverted in
place. Neither was in the diff. Both were in what the diff *moved*.

**A check's lane is its parity.** `smoke.mjs` deals the steady checks into its two Chromes
round-robin by index — `out[i % k]` — so inserting one check flips the lane of every check after
it, and moving three into the serial lane flips it again. *A lifted spine is painted whole, in
every look* had run in lane 1 for as long as it had existed; this branch put it in lane 2, after a
predecessor that leaves a second shelf standing above the Encyclopedia. That was enough.

**A shelf stood on a quarter-pixel, by design.** With the extra shelf above it the Encyclopedia's
track sat at `y = 652.25`: the rail was **46.5px** tall (`#vs-q` at 13px × `line-height: 1.5` =
19.5 of text) and every shelf **217.25** (`.vs-shelfhead { min-height: 32.25px }`, pinned in
[0021](0021-one-geometry-three-faces.md) to the modern look's measured height so leather and cyber
would move nothing). Fresh, the fractions happened to sum whole; one more shelf and they did not.
The track's 7px `overflow-clip-margin` then put the clip edge at 645.25, **which Chrome snaps to
646**, and a lifted spine painted six of its seven — in every look, for a pointer lift and a query
lift alike. Not the check's arithmetic: the browser's. Any reader with a ribbon in a book has the
Reading shelf, and so the fraction, and so the missing pixel.

So the geometry is whole pixels now: the head's floor is **32px** (the tallest thing in it is 29
in every look, so it is still a floor and moves nothing but the fraction), and a text field's line
box is **20px** rather than 1.5 × 13, so the rail is **47**. Measured fresh: track top **409**,
**7 of 7** painted, in all three looks. Every layout golden moved with it and was rewritten.

**The check says where the track was.** It printed *6px of 7px* and nothing else; now it prints
the track's raw `top`, the scroll state, and every box standing above the track — which is what
found the shelf head in one run rather than a bisection of forty predecessors.

**Rejected: rounding in the check.** Reading the band from a rounded edge would have gone green
and left every reader's lifted spine a pixel short. The check was right.

**Rejected: putting the lanes back.** The parity is an accident of source order; restoring it
would have hidden the same defect behind the same luck.

**And the other red was the fixture.** *An open book shows the ribbons in it, three at most* takes
the first Months book with **five** notes, marks five, and then turns to the last row expecting a
page with no ribbon. The re-cut vault's first such book — `2015-09` — has exactly five, so the last
row was marked and *0 stubs* was the right answer to the wrong question. It asks for six now, and
says why.

## The checks

Four new, 88 → **92**.

- **no index cut is clipped, and none is shrunk past reading** — every cut's box inside the rail's,
  the rail's inside the spread's and never over a fifth of it, and no cut's type under 11px, over
  the fourteen fattest books, each measured **closed and with its widest fold open**. Restoring
  only the rail's CSS turns it red with *305 cuts under 11px, smallest 4.09px*.
- **one cut is lit, and it is the deepest the page has reached** — 42 openings across fourteen
  books, at the first note, the middle and the last: at most one lit, the lit cut at or before the
  page, and the next one past it. Red today at 26 of 26.
- **the rail lists one level under the trail it came through** — presses the cut with the most
  under it and asserts exactly that many appear, that the press moved the reader to the cut's own
  note, that the trail step above is marked back and stands further in from the fore-edge, and that
  pressing it comes back to the level it left.

- **a numeric volume is indexed like a date book, not stopped at its years** — opens the `0-9`
  volume, and asserts that every cut holding more than three notes opens (bar the `0-9` bucket,
  which has nothing under it to cut by), that its fattest year opens into months named `Mmm` and
  standing inside it, and that the fattest of those opens into days named `dd`. It asserts the
  *fold*, not the presence of cuts: 15 cuts was already true and already useless. Red before the
  fix at 0 of 15 open, biggest dead end 587. It also asserts that `202212331243` sits under a
  `0-9` cut with nothing under it rather than inside a year, which is the half of the rule the
  structure alone cannot show.

Three others learned the new vocabulary: *the date index is layered* reads the fitted cut from
`__vs.indexTabs()` rather than counting the DOM — counting the DOM would count whichever level the
book happened to open on; *index tabs compress* reads the rail at 72px and no longer requires the
short window's cuts to be strictly shorter, since the floor may stop them; and *the reader's index
tabs stay countable* trades its cap of 26 for the structural ceiling, because what bounds the rail
now is what fits in it.
