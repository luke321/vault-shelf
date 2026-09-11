# 0021 — The thumb index

`design/0015` settled what the tabs down the right edge of an open book **say**: a tab is a
position in the contents, and the cut follows the order the contents are in. This record is
about what a tab is **made of**, and about what the rail does when the cut is longer than the
page is tall. `github#32` and `github#35`.

> "noticed that right side index tabs overflow sometime, file issue for multi row support,
> they need to look more like real indeces aswell"

> "0-9 encyclopedia in my vault makes no sense with the right index, it's 0-9 then 2023 2024
> and so on in large steps, this needs to be smarter"

## The rail was a hole with a lid on it

`.vs-tabs` was one `flex-direction: column` at `position: absolute; right: 0`, with
`max-height: calc(100% - 32px)` and **`overflow: hidden`**. A tab past the spread's height was
not dropped, not scrolled to, not marked — it was painted outside the box and clipped, and
nothing anywhere said so. Measured on the demo fixture before the change: two of the fourteen
fattest books lost four tabs between them, and on the sparse fixture one lost two. Every tab
check in the suite counted tabs, and a clipped tab counts exactly like one you can reach.

`dateTabs` capping at about thirty was a mitigation for the same problem wearing the clothes of
a design rule, and it is why a book could lose its day tabs for no reason a reader could see.

## A tab is a cut, not a plate

The old rule was `border-radius: 0 3px 3px 0; border-left: 0` — the **outer** corners rounded,
the inner border dropped. That is a button hanging off the fore-edge. A printed thumb index is
the other way round: the leaf is cut, so the tab is square and flush where the page ends and
the arc is on the inside, where the knife went in. Flipping it is one line and it is the whole
difference between a segmented control stuck to the side and a bite taken out of the book.

Geometry, so it lives in `page.css` and is the same in all three looks (`design/0016` — a look
is paint, and **it may not resize a control**):

| | |
|---|---|
| the **notch** | `border-radius: 3px 0 0 3px`, `border-right: 0`. Flush at the fore-edge, arced on the inside |
| the **stack** | `gap: 3px → 0` with `margin-bottom: -1px`, so adjacent hairlines collapse into one rule. The strip reads as one cut edge divided into leaves rather than a column of floating plates. The rail carries 1px of bottom padding to pay back the last cut, which the collapse pulls one pixel past its line |
| the **thumb** | the accent fill, and nothing else. Pulling the open cut further out of the page was tried and dropped: a lane stretches its cuts to one width, so a wider tab widens the **lane** rather than the tab |

The shadow follows the geometry: `1px 1px` (down and right, off a plate) became `-1px 1px`
(down and left, out of a cut), in `page.css` and in both looks. Leather and cyberpunk each
carried their own `border-radius` and `border-left`, which is how a shape drifts; they now carry
only their face — the type, the shadow, the lit colour — and the cut comes from one place.

**Rejected: repainting the tab.** A tab painted as the page's own paper rather than as a plate
would read as a cut more strongly still, and it would break "the furniture is one material",
which reads a non-current tab against the plaque in four rooms and is the check that keeps this
product looking like one object. Geometry was enough.

## One rail, and the cut you are in folds out beside it

> "go back to one rail but make it so that if I click a year the months fold out to the right
> of it like a staggered index that is folded out"

Every level used to stand in the same column: a year, then its months indented by 8px, then its
days by 16px, all the way down, for every year in the book. That is what ran off the bottom of
the page — not the years, which are a dozen, but the hundred months underneath them.

**The column holds top-level cuts only.** The one the page is standing in unfolds its own lane
to the **right** of itself — outward, toward the fore-edge — so the deepest cut on show is
always the one at the edge of the book and the cut it belongs to steps in behind it. Press a
month and it unfolds its days the same way, three lanes deep. The rest of the index moves down
to make room, which is what a stepped index does when you open one.

Three things fall out of it, and they are the reason this is the shape rather than more columns:

- **The rail is an edge again.** 46px closed, and 94–96px with the widest fold a shape has open
  — measured across all three fixtures. Banks cost 158px and were open all the time.
- **Nothing has to be thrown away.** The fit no longer trades months for room: the 10k library's
  biggest book keeps a month tab for every one of its months, where the banked rail gathered
  them into `Jan–Apr` spans to make them fit.
- **There is no state to get wrong.** The open cut is the one the page is in, so pressing a year
  both goes there and opens it — `a tab is a position` is untouched — and paging with Next
  unfolds the year you arrive in. Nothing can be left open over a book you are no longer reading.

**Rejected: scrolling the rail.** A scrolling index is the same lie as a clipped one — what you
cannot see, you do not know is there — and nothing in this product scrolls sideways or hides a
run behind an edge.

**Rejected: an indent instead of a lane.** It is what was there, and the level it encoded was
illegible the moment the column was more than one deep.

### Two wrong turns, kept here because a check saw neither

**Three banks.** `flex-wrap: wrap-reverse` on the column, so a run too long for the room
continued in the bank to its left — the bookcase law applied to the rail. It passed every check
in the suite: nothing clipped, nothing outside the spread, both look-parity checks at zero. It
looked like a heap of small plates beside the book rather than an edge of it. What no number
saw: three columns of chips stop reading as one object, the layer step-in is illegible once
three ragged left edges stand side by side, and the reading order — down the rightmost, then
jump to the top of the middle — is unguessable.

**Two banks, made even.** The step moved inside the cut (`padding-right`) so each bank had one
straight edge; the room was capped at the taller half so the banks came out level; and a bank
opening inside a run repeated the run's label at its head, which is `design/0003`'s plaque law.
Better, and still the wrong shape: it was 158px of the prose column all the time, it showed
every month of every year whether or not you were in that year, and the second bank's reading
order was still a jump.

Both are in the history and in `changelog-detail.md`. *Look at it* is a law in this repo for
exactly this, and the first two cuts of this record were written without doing it.

## Fit is measured, not calculated

How tall a fold is — a cut's height plus its border against the spread's, in whichever look, at
whatever font the host has, in a window of whatever shape — is not a number this file owns. So
`fitTabs` draws the index and, while it does not fit, rebuilds it one step shallower and draws
again:

1. **the deepest layer is halved** — each run of deepest cuts under one parent is gathered into
   half as many, naming the span it opens: `Jan–Apr`. A range of ranges is still one range;
   gathering twice reads `Jan–Apr`, never `Jan–Feb–Mar–Apr`;
2. **then the layer is dropped**, days before months, which is what the count cap always did;
3. **then the column collapses into ranges**, halving each time, which is what a letter list
   over 26 always did.

**Fitted to the fattest fold, not the one open now.** Which cut is unfolded follows the page, so
fitting to it would re-fit on every turn and give one book two different indexes. `widestFold`
finds the deepest fold the book can ever show and the rail is fitted once to that; every other
fold is shorter by construction. The fitted list is held on `reader.tabs`, redrawn from on every
page turn, and thrown away on a resize or a rebuild.

`RAW_TABS` (90, doubled inside `dateTabs`) only bounds the **first** draw, since a deep letter
cut over a 10,000-note volume can run to hundreds of buttons.

**A cut carries the position it opens**, in `data-at`. A fold rebuilds the rail under the press,
so a cut cannot be addressed by where it stands in the DOM — not by the page, and not by a check
walking the index. `__vs.indexTabs()` hands the fitted cut to a check so it can reason about the
fold without driving the reader into it; pressing a cut re-renders the contents, and on a book
of seven thousand notes that is the whole cost of the check rather than the thing measured.

## One thumb

`aria-current` was set on **every** tab at or before the page, so a book read to its end lit the
whole rail: measured on the demo fixture, opening each of the fourteen fattest books at its last
note lit 29 of 29 tabs on the worst of them, and more than one on all fourteen. It is the last
cut the page has reached, and one only — and since a cut that folds is recorded before what is
under it, that is the **deepest** one: the day, not the year it sits in.

## A book whose rows read as dates

The `0-9` volume of the Encyclopedia is where every ISO-titled note lands — daily notes, meeting
notes, anything called `2024-03-17` — so in a vault of daily notes it is the largest book in the
library, and a letter cut can only ever give it the single tab `0-9`. `design/0015` records the
fix that was made for that: a numeric head took its first four digits as a **year**.

It was too coarse and it was also wrong. Too coarse, because a year in that book is hundreds of
notes and there was nothing under it. Wrong, because no hyphen was required: `1000 Small
Decisions — budget` was filed under **the year 1000**, and it had a tab of its own in the demo
fixture to prove it.

Two rules replace it.

**A book whose rows read as dates is cut by date** — not "the `0-9` volume". Half its notes or
more carrying an ISO date at the head of the title is the test, and then it gets the same
layered cut every other date-ordered book gets. Every book on every other shelf is already cut
by date, so in practice the volume is the only new wearer; but the rule is about the rows, which
is what a tab is a position in.

**The cut follows the TITLE's date, not the note's.** `decisions/0003` is about that
disagreement and does not settle it for the reader; `design/0015` does — the volume stands in
title order, and a tab that is a position in the rows has to be cut from what the rows are
sorted by. A note titled `2024-03-17` whose `date:` property says otherwise is filed here under
the title.

**The rows that are not dates keep a tab of their own.** `1000 Small Decisions` sorts before the
dates and `3D printing notes` after them, so they are two groups and not one; a run of four or
more gets one tab at its place in the contents, labelled the way the letter cut would label it.
Nothing a person can see on the left is unreachable from the right.

*Rejected: skipping them* (it is how a date-ordered book treats an undated note, but here they
are a block of the book, not strays), *and one trailing "Other" tab* (in title order they are
not contiguous, so one tab would point at one of two groups and lie about the other).

**And a numeric volume that is not dated is cut by its numbers.** `0-9` at one digit is one tab
and at two is `0-90`, which is neither a prefix nor a number. The leading digits are what these
titles are filed under and the order they stand in, so the cut deepens `1 2 3 4` → `10 24 42`
the way a letter cut deepens `M` → `Ma Me Mi`. On the 10k fixture that volume went from **one
tab over 412 notes to nine**.

## A cut must gather, or be the only cut there is

A year book of 105 notes over nine months has about one note per day, so cutting each month into
days put a tab beside almost every row: measured, **83 tabs for 105 notes**.

A day layer is drawn where its days hold two rows each on average — or where nothing coarser was
drawn at all, which is how a month book keeps the only index it can have. `design/0015`'s "a
group of three notes or fewer is not cut further" is the same idea one size down; this is the
rule for a group that is dense but spread thin.

Months are left alone deliberately: a month tab over a single note is still the unit a person
navigates a year by, and the original complaint that produced the layered index asked for months
under years even where each holds one or two notes.

## What moved

Measured 2026-09-11 on the three fixtures, before this work and after.

| | before | after |
|---|---|---|
| demo, clipped tabs over the fattest books | **2 books, 4 tabs** | 0 |
| sparse, clipped tabs | **1 book, 2 tabs** | 0 |
| widest rail, all shapes | 51px | **46px closed, 94–96px with the widest fold open (9%)** |
| most tabs on show at once | 29 (and 4 of them clipped) | **24–26** |
| demo `encyclopedia/0-9` (168 notes) | 17 tabs, largest step **51** notes | 15 cuts in the column and 31 in all, step **28** inside the fold |
| sparse `encyclopedia/0-9` (109 notes) | 3 tabs (`0-9 1000 2024`), step **54** | 5 tabs (`0 1 2 3 4`), step **28** |
| 10k `encyclopedia/0-9` (412 notes) | **1 tab**, step **412** | 9 tabs, step **58** |
| 10k `people/-unfiled` (6,937 notes) | 11 tabs | 11 cuts in the column, every month kept in the fold |
| tabs lit at the end of a book | up to **29 of 29** | **1** |
