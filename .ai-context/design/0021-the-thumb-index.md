# 0021 — The thumb index

`design/0015` settled what the tabs down the right edge of an open book **say**: a tab is a
position in the contents, and the cut follows the order the contents are in. This record is
about what a tab is **made of**, how many of them the rail may hold, and what happens to the
ones that do not fit. `github#32` and `github#35`.

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

Three things, and all of them geometry, so they live in `page.css` and are the same in all
three looks (`design/0016` — a look is paint, and **it may not resize a control**):

| | |
|---|---|
| the **notch** | `border-radius: 3px 0 0 3px`, `border-right: 0`. Flush at the fore-edge, arced on the inside |
| the **stack** | `gap: 3px → 0` with `margin-bottom: -1px`, so adjacent hairlines collapse into one rule. The strip reads as one cut edge divided into leaves rather than a column of floating plates. The rail carries 1px of bottom padding to pay back the last cut in each bank, which the collapse pulls one pixel past its line |
| the **thumb** | the accent fill, and nothing else. Pulling the open cut further out of the page was tried and dropped: a bank stretches its cuts to one width, so a wider tab widens the **bank**, and the bank it sits in changes as you read |

The shadow follows the geometry: `1px 1px` (down and right, off a plate) became `-1px 1px`
(down and left, out of a cut), in `page.css` and in both looks.

Leather and cyberpunk each carried their own `border-radius` and `border-left`, which is how a
shape drifts. They now carry only their face — the type, the shadow, the lit colour — and the
cut comes from one place.

**Rejected: repainting the tab.** A tab painted as the page's own paper rather than as a plate
would read as a cut more strongly still, and it would break "the furniture is one material",
which reads a non-current tab against the plaque in four rooms and is the check that keeps this
product looking like one object. Geometry was enough.

## Banks, and what they cost

A run too long for the room continues on the next row down — that is the bookcase law, and the
rail is no different. `flex-wrap: wrap-reverse` on the column is what does it: a column flex
wraps into columns, and **reverse** puts line one at the right, which is the edge the thumb
reaches. Bank one is rightmost, bank two to its left.

**Three banks, and a fifth of the spread.** The rail stands over the right-hand page, so every
bank is paid for out of the prose column. One bank is 51px (the right page's `padding-right`
has always been 56px, and now reads `calc(var(--vs-railw) + 5px)` so it pays only for the banks
that exist). Three banks of year and month tabs measure **151–158px, about 14–15% of the
spread**; three banks of `Sep–Oct` labels would be 235px, which is a sidebar, so the width is
capped as well as the count. Measured widest across all three fixtures after the change: 158px.

**Rejected: scrolling the rail.** A scrolling index is the same lie as a clipped one — what you
cannot see, you do not know is there — and nothing in this product scrolls sideways or hides a
run behind an edge.

**The cost of banking, stated plainly:** a run that wraps loses its header. A bank that begins
mid-2023 shows `Sep–Dec` at its top with `2023` at the bottom of the bank to its right.
`design/0003`'s plaque law would repeat the label; a tab cannot, because a repeated tab would
have to point at a position *behind* the one above it, and a printed index does not do that.
The step-in geometry is what tells you it is a child of something above. Left as it is.

## Fit is measured, not calculated

How many tabs a bank holds is a tab's height plus its border against the spread's height, in
whichever look, at whatever font the host has, in a window of whatever shape — five numbers
this file does not own. So `fitTabs` draws the index at full depth, counts the banks by their
fore-edges, and while it does not fit rebuilds it one step shallower and draws again:

1. **the deepest layer is halved** — each run of deepest tabs under one parent is gathered into
   half as many, naming the span it opens: `Jan–Apr`. A range of ranges is still one range;
   gathering twice reads `Jan–Apr`, never `Jan–Feb–Mar–Apr`;
2. **then the layer is dropped**, days before months, which is what the count cap always did;
3. **then the list collapses into ranges**, halving each time, which is what a letter list over
   26 always did.

A handful of passes, once per book and once per resize, never per page turn: the fitted list is
held on `reader.tabs` and `goTo` redraws from it. A rail that is not laid out yet — the reader
still hidden — draws once and caches nothing. Under the 860px measure the rail is a wrapping
row under the pages, where a bank is not a thing, and the fit step stands aside.

`RAW_TABS` (90, doubled inside `dateTabs`) only bounds the **first** draw, since a deep letter
cut over a 10,000-note volume can run to hundreds of buttons. It is not the cap a person feels.

**Rejected: computing the capacity.** `floor(railHeight / pitch) * banks` is one measurement
instead of three and it is wrong the first time a look changes a border or a theme changes a
font. This repo's recurring failure is reasoning about the page instead of driving it.

## One thumb

`aria-current` was set on **every** tab at or before the page, so a book read to its end lit the
whole rail: measured on the demo fixture, opening each of the fourteen fattest books at its last
note lit 29 of 29 tabs on the worst of them, and more than one on all fourteen. It is now the
last tab the page has reached, and one only.

## A book whose rows read as dates

The `0-9` volume of the Encyclopedia is where every ISO-titled note lands — daily notes, meeting
notes, anything called `2024-03-17` — so in a vault of daily notes it is the largest book in the
library, and a letter cut can only ever give it the single tab `0-9`. `design/0015` records the
fix that was made for that: a numeric head took its first four digits as a **year**.

It was too coarse and it was also wrong. Too coarse, because a year in that book is hundreds of
notes and there is nothing under it. Wrong, because no hyphen was required: `1000 Small
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
The demo volume's index opens `1 · 2011 · 2012 · … · 2026 · 3`. Nothing a person can see on the
left is unreachable from the right.

*Rejected: skipping them* (it is how a date-ordered book treats an undated note, but here they
are a block of the book, not strays), *and one trailing "Other" tab* (in title order they are
not contiguous, so one tab would point at one of two groups and lie about the other).

**And a numeric volume that is not dated is cut by its numbers.** `0-9` at one digit is one tab
and at two is `0-90`, which is neither a prefix nor a number. The leading digits are what these
titles are filed under and the order they stand in, so the cut deepens `1 2 3 4` → `10 24 42`
the way a letter cut deepens `M` → `Ma Me Mi`. On the 10k fixture that volume went from **one
tab over 412 notes to nine**.

## A cut must gather, or be the only cut there is

Three banks of room turned out to be enough rope. A year book of 105 notes over nine months has
about one note per day, so cutting each month into days put a tab beside almost every row:
measured, **83 tabs for 105 notes**, filling three banks and 148px of the prose with a second
copy of the contents.

A day layer is drawn where its days hold two rows each on average — or where nothing coarser was
drawn at all, which is how a month book keeps the only index it can have. `design/0015`'s
"a group of three notes or fewer is not cut further" is the same idea one size down; this is the
rule for a group that is dense but spread thin.

Months are left alone deliberately: a month tab over a single note is still the unit a person
navigates a year by, and the original complaint that produced the layered index asked for months
under years even where each holds one or two notes.

## What moved

| | before | after |
|---|---|---|
| demo, clipped tabs over the 14 fattest books | **2 books, 4 tabs** | 0 |
| sparse, clipped tabs | **1 book, 2 tabs** | 0 |
| demo `encyclopedia/0-9` (168 notes) | 17 tabs, largest step **51** notes | 65 tabs in 3 banks, step **20** |
| sparse `encyclopedia/0-9` (109 notes) | 3 tabs (`0-9 1000 2024`), step **54** | 5 tabs (`0 1 2 3 4`), step **28** |
| 10k `encyclopedia/0-9` (412 notes) | **1 tab**, step **412** | 9 tabs, step **58** |
| 10k `people/-unfiled` (6,937 notes) | 11 tabs | 42 tabs in 2 banks |
| widest rail, all shapes | 51px | 158px (15% of the spread) |
| tabs lit at the end of a book | up to **29 of 29** | **1** |
