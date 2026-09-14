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
`2020`, the widest thing the rail ever says — so the rail is 60px, and a trail step keeps a
tighter gutter than a cut that opens, paying for its own notches out of its own room.

**Rejected: banks.** Three columns (`flex-wrap: wrap-reverse`, the bookcase law applied to the
rail) and then two, made even and with a running head on each. Both were built, both passed every
check in the suite, and both were rejected on sight: columns of small plates stop reading as one
object, and the reading order — down the rightmost, then jump to the top of the middle — is
unguessable. Banking is more room for a list that should never have been that long.

**Rejected: scrolling the rail.** The same lie as a clipped one — what you cannot see, you do not
know is there.

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

## The checks

Three new, 88 → **91**.

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

Three others learned the new vocabulary: *the date index is layered* reads the fitted cut from
`__vs.indexTabs()` rather than counting the DOM — counting the DOM would count whichever level the
book happened to open on; *index tabs compress* reads the rail at 72px and no longer requires the
short window's cuts to be strictly shorter, since the floor may stop them; and *the reader's index
tabs stay countable* trades its cap of 26 for the structural ceiling, because what bounds the rail
now is what fits in it.
