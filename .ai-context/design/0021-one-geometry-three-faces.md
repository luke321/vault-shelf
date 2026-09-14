# 0021 — One geometry, three faces

### 2026-09-13 — Manage rows at phone widths

At 390px, the automatic flex wrap let Leather's wider labels push Delete to another row:
Months grew from 120.5px to 162.5px, and People from 106.25px to 148.25px. The other two
looks kept those controls together. Narrow Manage rows now use the same six-column grid:
name, then classifier/arrows/Shown, then Edit/Delete, then colour rules. Every control
remains available; the shared stylesheet fixes the rows instead of a face choosing the wrap.

The Manage check compares every row's height and every control's relative top and height
across all three looks at the original viewport, 390px and 320px. All agree; controls fit
inside their row. It restores the original viewport only after the requested dimensions
and the page's room measurement settle. Clearing the viewport override and sleeping had
let the following geometry check start in the phone layout and report 728 moved / 16 resized
elements. The original four-state geometry check remains intact and passes with 0/0.

`github#14`, `github#16`. `CLAUDE.md` has said since `design/0016` that **a look is paint**: it
may repaint anything and it may move nothing. The law was enforced for a spine's size, the room's
width and — since 2026-09-11 — thirty-eight named controls. It was not enforced for anything
else, and this is the record of what that cost, what the line between *face* and *geometry*
actually is, and the check that makes it hold for everything rather than for a list.

## What was measured, before anything was changed

`docs/demo`'s fixture, driven in Chrome at 1180×900, walking **every element** under
`.vault-shelf` in all three looks and reading each box relative to the library root. 830 elements
per look, the same 830 in each.

| | modern | leather | cyber |
|---|---|---|---|
| library `scrollHeight` | 2147 | **2258 (+111)** | **2161 (+14)** |
| elements that moved | — | **818** | **679** |
| elements that changed size | — | **307** | **282** |

`github#14` reported +108px; it measured +111 on the day this was taken, and cyber drifted too —
by less, which is the only reason nobody reported it.

Where the pixels came from:

| box | modern | leather | cyber | declared in |
|---|---|---|---|---|
| `.vs-shelf` margin-bottom | 26 | **32** | 26 | `leather.css` |
| `.vs-shelfhead` margin-bottom | 9 | **14** | 9 | `leather.css` |
| `.vs-shelfhead h2` height | 18.8 | **22** | 18.8 | `font: 400 22px/1` |
| `.vs-shelfhead .vs-meta` | 17.3 | **18** | **15.8** | a `font-size` in each look |
| `--board` | **5px** | **10px** | **7px** | each look's own `.vs-track` |
| `.vs-floorgrip` height | 13 | **18** | **15** | `calc(var(--board) + 8px)` |
| `.vs-plaque` margin-top | 14 | **19** | **16** | `calc(var(--board) + 9px)`, **per row** |
| `.vs-track` / `.vs-group` height | 166.8 | **171.8** | **168.8** | the board again |
| `.vs-spine .vs-title` | 19.5 | **15.6** | **15.8** | `font: 13px/1.2`, `font-size: 10.5px` |

**`--board` is the expensive one**, because it is charged **twice per row**: once to the floor
grip's height and once to the plaque's top margin. A four-row shelf paid it four times over.
`github#14` says *"`--board` is not involved — it measures 3px in both looks"*; that was true when
the issue was written and had stopped being true by the time it was read. It is the second stale
number on this ticket, and it is the argument for a check rather than a paragraph.

## The audit `github#16` asked for, which nobody had ever made

Every declaration in both look sheets, sorted by property:

| | `leather.css` | `cyber.css` |
|---|---|---|
| **geometry** — padding, margin, height, width, gap, font-size, line-height, `font`, inset, flex, order, `--board`, transform | **52** | **28** |
| **parts** — a rule drawing something another look has not | **25** | **16** |
| **paint** — colour, border colour, shadow, texture, face | the rest | the rest |

The third list was the interesting one, exactly as the issue predicted:

1. **Leather had a private responsive layout.** A whole `@media (max-width: 860px)` block of its
   own — a different rail order (`#vs-jump { order: 4 }`, `#vs-q { flex: 1 1 140px }`), a wrapping
   shelf head, a re-padded reading page, a re-drawn tab strip — and a `(max-width: 520px)` block
   for a wrapping Manage row. `page.css` had its own, different, narrow layout. **Below 860px the
   two looks were not the same product**, and no check had ever opened a narrow viewport in a
   look. Leather's was the better of the two, so it is `page.css`'s now and every look has it.
2. **A tab's border was on a different side per look** — `border-right` in `page.css`,
   `border-left` in `leather.css`, `border-left: 0` in `cyber.css`. A border width is a box.
3. **The hover lift was three distances** — `page.css`'s 5px, leather's 5px, cyber's 6px.

## The line between a face and a box

Stated precisely enough for a machine, because a face change with `line-height: 1` was already an
attempt to keep a box fixed and it missed by a pixel:

1. **Every element's top, relative to the library root, is the same in every look.** Nothing
   slides down the page. No exception list, no named selectors.
2. **Every element is the same size across the direction its text runs** — its height where the
   text is horizontal, its width where it is upright. The line box is `page.css`'s, in pixels;
   the glyphs drawn on it are the look's.
3. **Width along the text is the face's.** This is the one concession, and it is the smaller
   claim than the law as written: a wider face may move a label's neighbour **along its own row**
   and nothing else. It is not unguarded — `"every control is the same size in every look"` fixes
   it wherever a rule sizes a control, and the golden snapshot now runs in every look, which is
   what holds a book's own width.
4. **A look may add decoration** — a `::before` or `::after` that is `position: absolute` and
   `pointer-events: none` paints and moves nothing. A *control*, an *affordance* or a
   *responsive layout* is `page.css`'s and belongs to every look.

`CLAUDE.md`'s law gains one clause for rule 3, because a law that promises more than the product
delivers is worse than a smaller law that holds.

### `--board` is 10px now, in every look

Asked and answered: leather's plank, not modern's edge. A bookcase is what this product is a
picture of and the walnut is what sells it, so the other two looks come up to it rather than
leather coming down. Modern gains **5px a row** and cyber **3px**; `--board` 5 → 10, the floor
grip 13 → 18, the plaque's top margin 14 → 19, and every layout golden was regenerated
deliberately. Shelf, row, spine and plaque **counts are unchanged in all three fixtures** — only
positions moved.

### The shelf head is its buttons' height

The head aligned on the **baseline**, so a bigger face lowered the baseline and the head grew
under it — 32.3px modern against 33.3 leather. `leather.css` carried a comment claiming
`line-height: 1` kept a 22px serif inside the same 32px head; measured, it was a pixel short, and
the comment had been read as a fact for a month. The head is centred now, with a fixed line box
on each label, and **no explicit height**: the tallest thing in the row decides, and `page.css`
is what sizes all of them.

*Amended under `github#32`, [0034](0034-the-thumb-index.md):* the head did carry a floor,
`min-height: 32.25px` — the modern look's measured height, pinned so the looks would agree — and
the quarter made every shelf 217.25px tall, so a track's position depended on how many shelves
stood above it and a 7px clip edge could land on a fraction the browser snaps. The floor is
**32px** now, and a text field's line box **20px** rather than 1.5 × 13, so the rail is 47 rather
than 46.5. Whole pixels, one geometry, three faces.

### A plate's lettering is not a look's

A plaque `align-self: stretch`es its run, and a run is only as wide as the widest of its books and
its plate. So a different face on the plate made the whole group — and every book standing in it —
a different width. The plate's type is `page.css`'s, like a button's (`github#9`).

### An inline box cannot be given a height

A bare inline box is sized by the **font's** own ascent and descent, which `line-height` cannot
touch: the builder's preview count stood 15px high under one face and 12 under another with an
explicit `line-height` on it the whole time. `display: inline-block` is what makes the line box
decide.

### The golden was measured in leather, and nobody knew

`core.LOOKS[0]` is leather, and a fresh library opens in it — so `scripts/layout-snapshots/*.json`
had always been taken in **leather**, and the modern look sat 6px off its own golden the whole
time without failing anything, because the check only ever ran in the look the page opened in. It
runs in all of them now, against one golden, which is only possible because a look moves nothing.

## A book with nothing to index draws a closed index

`github#16`'s first complaint. `design/0015` is right that three notes on following days are three
rows on the left and not an index, so `dateTabs` refuses to cut them — but what was left on the
edge of the page was **the find glass on its own**, and that reads as a tab that fell off rather
than as a book that needs no index.

**The strip is always there.** `.vs-tabs` runs the height of the page with the glass at its head,
and the tabs, when there are any, are cut from it. It is drawn from the plate tokens
(`--vs-plate`, `--vs-plate-edge`), so it is the same part in every look and paints itself in each
one's own material. It costs nothing in a book that has an index, and it moves nothing: the strip
was already `position: absolute` inside the spread.

How a *present* index reads and wraps is `github#32` and `github#35`, and is not this record.

## The check

`"a look moves nothing on the page"`, in the serial lane. It walks every element under
`.vault-shelf` in **four states** — the library, an open book, the Manage sheet, the builder —
in every look `core.LOOKS` knows, shelved ones included, and compares each against the modern
look's reading. It identifies an element by a **path** (tag, id, first two classes, index among
its siblings, up to the root) rather than by a selector, so a box nothing names is still compared
with the same box in the next look.

It prints **how many elements it compared**, so the coverage is itself a measurement, and reports
three numbers: moved, resized, and present in one look and not another.

**The walk stops at a page of the open book.** A `.vs-page` is furniture and is measured; what is
*set* on it — the contents list, the note's meta line, the rendered markdown, the also-shelved-in
chips — is the vault's content reflowing inside a box that scrolls on its own, and a look is
allowed to set the size it is read at (`design/0016`). Nothing outside the page can be moved by
any of it. The check says how many nodes that costs.

Measured after: **4363 / 1979 / 3517 elements** across the demo, sparse and 10k fixtures, **0
moved, 0 resized, 0 present in one look and not another**, and the library is **2186px tall in all
three looks** where it was 2258 / 2147 / 2161.

## Uprightness is geometry, so one face decides it

`github#47`. Rule 2 above says every element is the same size **across the direction its text
runs**, and rule 3 concedes the width **along** it to the face. Both rules assume the direction
itself is settled. For a short cover it was not.

`fitsUpright()` (`src/page.js`) decides whether a cover of three characters or fewer stands
upright by **measuring**: it builds a real `.vs-spine[data-upright="1"]` with a `.vs-title` in
it, appends the probe to `root` — the element carrying `data-look` — and reads
`title.scrollWidth <= title.clientWidth`. So the probe inherited the current look's face, and a
face is exactly what decides how wide a glyph is. The same cover at the same width could come
back `horizontal-tb` in one look and `vertical-rl` in the next, which is not a concession rule 3
makes: it swaps which axis is fixed, and the box grows eightfold.

### What it actually costs, in pixels

The three shipped faces draw the same capital letter at **8.4px** (cyber, 10.5px/600, uppercase,
0.13em), **8.9px** (leather, Georgia 13px/400, 0.015em) and **9.3px** (modern, system 13px/600,
0.04em). At the narrowest spine — 19px, which is a book of one or two notes on a squeezed index
shelf — `github#14`'s 3px inset leaves **11px** of line box and everything clears. `github#45`
derives the inset from where a binding may draw and it becomes 4px, leaving **9px**, and three
covers land inside the spread:

| cover, at a 19px spine | leather | modern | cyber | 9px of room |
|---|---|---|---|---|
| `Å` | 8.90 | **9.30** | 8.40 | upright / sideways / upright |
| `Ü` | **10.00** | **9.70** | 8.80 | sideways / sideways / upright |
| `מ` | 6.50 | **9.50** | 8.60 | upright / sideways / upright |

Three covers, three different answers per look, and `a look moves nothing on the page` reports
**20 resized** with `9 -> 76 wide` on the Encyclopedia rail. It is not `github#45`'s defect;
`github#45` is the thing that happens to move the pixel. The looks had been agreeing by **0.08px**
on the tightest cover and nothing had ever measured that.

### The answer: the probe is measured in one pinned face

Of the three the issue put up:

- **a canonical face for the probe** — taken;
- **no DOM probe at all**, deciding from a character count and a script class against `--spine-w`
  — rejected. It legislates what the type does instead of asking it, and the table above is the
  argument against legislating: three faces of the *same* nominal size disagree by 0.9px on one
  capital letter, and a fallback font for a script none of them carry would not be in the law at
  all;
- **a margin** — rejected on its own, and see below.

`page.css`'s `.vs-probe` block declares the probe title's whole type at **0-5-0**: family, size,
weight, line box, letter spacing, word spacing, case, and both feature-setting properties. 0-5-0
because a look's own `.vs-spine .vs-title` rule is 0-4-0 and its sheet is concatenated *after*
`page.css`, so anything less would be decided by file order. The stack is written out rather than
read from `var(--ui)`, on purpose: `--ui` is a look's to redefine — leather redefines it to
Georgia — and this face is **pinned**, so it moves when somebody decides it should and not when
somebody restyles the default look.

**The pinned values are not a fourth face.** They are `page.css`'s own — `13px`, `600` and
`0.04em` are exactly what `.vs-spine[data-upright="1"] .vs-title` already declares, on the
stack `--ui` already holds here — so in the default look the probe and the drawn title are the
same type, and the decision is one a reader of `page.css` can see being made. A look draws the
same cover in its own face afterwards, up to 1.45px wider on this vault, which is rule 3's
concession and nothing new.

The probe is still a real spine, so it still inherits the *room's* geometry: `--spine-w`,
`--spine-h`, the inset `github#45` derives, the border. That is the whole point. It inherits the
box and none of the paint, which is what makes the answer a measurement of geometry.

The cache key, `cover + "|" + width`, never named the look. It was safe by accident —
`drawLibrary()` clears it and a look switch goes through `refresh()` → `applyLook()` → redraw —
and it is **correct** now, with nothing left for a future redraw path to miss.

### Why no margin, when a margin is the cheap answer

A margin — require the cover to fit with a pixel or two to spare — would be calibrated to the
three faces on the machine today. Two things are wrong with that. It **moves the cliff rather
than removing it**, which the issue says in as many words; and it is not free, because at a 19px
spine every capital letter is already within a pixel of the edge, so two pixels of margin lay
covers down that fit perfectly well.

The residual is real and is left **asserted instead of absorbed**. `"a short cover is stood
upright by one face, not the look's"` reads every short cover on the one vault, at the width the
page asks about it, in every look `core.LOOKS` knows, and fails on any of: the probe reading more
than one face, a cover oriented one way in one look and another in the next, or a look's own
glyphs being clipped by the decision another face made. It also **prints two margins nobody had**
— how much wider than the deciding face the widest look draws the same cover, and how much room
the tightest upright cover has left. Neither is asserted; both are there so the next person to
move a padding sees the headroom before spending it.

Measured, on the one vault:

| | before | before + `github#45` | after | after + `github#45` |
|---|---|---|---|---|
| faces the probe reads | **3** | **3** | **1** | **1** |
| covers oriented one way in one look and another in the next | 0 | **3** | 0 | **0** |
| upright titles clipped in any look | 0 | 0 | 0 | 0 |
| `a look moves nothing`: moved / resized / present-in-one | 0/0/0 | **0/20/0** | 0/0/0 | **0/0/0** |
| short covers standing upright | 33 | 32 | 33 | 30 |
| widest face over the deciding one | 2.93px | 2.06px | **1.45px** | **1.45px** |
| room left on the tightest upright cover | 0.97px | **0.08px** | 0.97px | 0.27px |
| `Encyclopedia labels upright`, in leather | 32/35 | 31/35 | 32/35 | 29/35 |

**Nothing visible moves on today's tree**: 32/35 and 33 upright before and after, the same four
covers sideways (`Œ`, `学`, `読`, `map`). The change is that the answer no longer depends on which
look asked.

### What `github#45` still owes, and why it is not paid here

With the pinned face *and* `github#45`'s 4px inset, `Å`, `Ü` and `מ` go sideways **in every
look** — stably, and correctly, because the deciding face draws them 9.30, 9.70 and 9.50 into
nine pixels of room. The `sideways` tally in `"a hovered spine shows one peek…"` therefore goes
**4 → 7**, past its tolerance of 4.

That tolerance moves under `github#45` either way: with the *old* per-look probe and the same
inset it is **5** (`Ü` alone flips in leather), which is already past 4. So it is `github#45`'s
number to move, in `github#45`'s commit, against `github#45`'s measurement — not a tolerance
relaxed here on a tree where it still reads 4 and still passes.

**Paid.** `github#45` moved it to **7** on the merged tree, against its own measurement of the
three covers; the table and the argument for a census rather than a tolerance are in the addendum
below. The three predicted here are the three that fell.

## Addendum, `github#45` — one geometry is what left leather with three pixels

> "the text should not reach the horizontal line of the book design ever"

This record gave the three looks one padding — `20px 3px 26px` — and the comment in `page.css`
recorded why: *"leather padded it 23/29 for its bands, cyber 10/15"*. The single number was
chosen so that every look's **box** came out identical, which is rule 2 above and is correct.
**Nobody then checked it against the decoration each look draws inside that box**, and the law as
written had nothing to say about that, because the decoration is paint and paint was the part
this record declared free.

What the arithmetic actually was, on a 132px spine, in *ink* rather than in offsets:

| | from the spine's top | from its bottom |
|---|---|---|
| the title's box (`padding`, plus leather's own 1px top border) | 21px | 26px |
| leather's gilt bands (`::before`, gradient stops) | 10–**17**px | **22**–29px |
| leather's panel rule (`::after`, `inset` + its 1px border) | 17–**18**px | 23–**24**px |
| cyber's cap light (`::before`) | 0–2px | — |
| cyber's rack marking (`::after`) | — | 16–19px |

So the title's box cleared leather's panel rule by **2px** at the head — not the 3 the offsets
suggest, because a rule has thickness and the inset positions its outer edge — and ran **3px into
the tail gilt band**, which starts 29px up and not 23px. The band is the outermost thing leather
paints; the panel rule was drawn *inside* it, six pixels in, and the padding was set against the
rule rather than against the band. Cyber cleared by 7px because its tail decoration sits over the
count instead of at the tail of the title. **One geometry, three different clearances, none of
them declared, and in leather the accident was negative.**

### What replaced it

`page.css` declares the region a binding may draw in, and derives the title's box from it:

```
--spine-head: 17px;       /* a look's head decoration reaches this far down */
--spine-tail: 29px;       /* ...and this far up from the bottom */
--spine-rule-side: 4px;   /* its side rules stand this far in */
--spine-rule: 1px;        /* and each of those rules is this thick */
--spine-clear: 3px;
padding: calc(head + rule + clear) rule-side calc(tail + rule + clear);   /* 21px 4px 33px */
```

**`--spine-rule` is arithmetic, not decoration.** The first cut of this fix omitted it and left
2px at the head, because a 1px rule set at `inset: 17px` paints on 17..18 while the padding is
measured to 17. It is the same pixel that made the original defect −3px rather than the −2 a
reading of the offsets gives, and the same pixel that puts the title's box at `rule-side + rule`
sideways rather than flush with the rule's outer edge.

Every look's decoration is placed **from** those numbers rather than beside them: leather's two
gilt bands end at `--spine-head` and `--spine-tail`, its panel is `inset: var(--spine-head)
var(--spine-rule-side) var(--spine-tail)`, and that panel's border is `var(--spine-rule)`. The
panel's lower rule moves from 23px to 29px — paint, and it moves no furniture — and the binding
comes out **symmetric**, because the head rule already sat exactly where the head band ended and
the tail rule never did. Cyber's rack marking keeps `bottom: 16px`: it is drawn over the **count**,
deliberately below the title's region, and takes only the declared side inset. It clears the title
by 14px now instead of 7.

The cost is 8px of title, and the ellipsis is where it shows: 13 → **19** leather titles on the
demo fixture, 9 → **12** modern, 21 → **29** cyber. Nothing else moved; the layout golden reports
the same shelves, rows, spines, plaques and room in all three looks.

Adding a fourth look means giving these four numbers whatever that binding needs and placing its
own decoration from them; it does not mean re-deriving a padding.

### Rule 5: a look may decorate, and page.css says where

The four rules above get a fifth, which is rule 4 made measurable:

> **A look may add decoration, and `page.css` declares the band it may occupy.** A `::before` or
> `::after` that is absolutely positioned and `pointer-events: none` paints and moves nothing —
> but *where* it paints is not the look's to choose alone, because the text's own box is derived
> from it. `--spine-head`, `--spine-tail`, `--spine-rule-side`, `--spine-rule` and `--spine-clear`
> are the declaration; a look that wants a rule somewhere else moves those, and every look moves
> with it.

### The sides, which were asked about and are a different question

The issue noticed that `inset: … 4px …` against `padding: … 3px …` made the title's box a pixel
**wider** than the panel on each side. That pixel is gone — the side padding is
`--spine-rule-side`, so the box is exactly the panel. It was never the interesting half.

**It takes `--spine-rule-side` and not `--spine-rule-side + --spine-rule`**, which is the
asymmetry in this fix and it is deliberate. One more pixel there is one pixel off the title's
**content box**, and `github#12`'s `fitsUpright` decides whether a short cover stands upright by
asking whether it overflows that box. The pixel is not free anywhere, and on the **squeezed index
rail** it is most of what there is: `squeezeIndex` (`github#34`) scales the Encyclopedia's spines
down until the alphabet fits one shelf, so its books stand **19px** wide where the thickness floor
elsewhere is 22px, and 4px of inset leaves them **nine pixels**.

*(Written first as "one more pixel flips covers per look", which was true of the tree this landed
on and is not true of the tree it merged into: `github#47` pinned the probe's face while this
branch was open, so the decision is one face's now and the same cover falls the same way in all
three looks. The pixel still costs uprights — it just costs them honestly. `--spine-rule` was
introduced for the head and tail, where a rule's thickness is real ink under the glyph; sideways
there is no glyph out there to protect, so the box stops at the rule and not past it.)*

### The tally that pays for it: `sideways` 4 → 7

`"a hovered spine shows one peek…"` counts short covers the geometry cannot stand upright. Nine
pixels of room against the pinned deciding face, measured on the one vault:

| cover | the deciding face draws it | margin at 4px | margin at develop's 3px |
|---|---|---|---|
| `map` (27px spine) | 27.70px | −10.70 | −8.70 |
| `学` | 13.53px | −4.53 | −2.53 |
| `読` | 13.53px | −4.53 | −2.53 |
| `Œ` | 12.69px | −3.69 | −1.69 |
| **`Ü`** | 9.67px | **−0.67** | +1.33 |
| **`מ`** | 9.45px | **−0.45** | +1.55 |
| **`Å`** | 9.25px | **−0.25** | +1.75 |
| `У` — the tightest that still stands | 8.19px | +0.81 | +2.81 |
| `Р` | 8.13px | +0.87 | +2.87 |
| `É` | 7.25px | +1.75 | +3.75 |

So the inset costs exactly three covers, all of them on the squeezed rail, all three by **under a
pixel**. `github#47` predicted the three and the 4 → 7 from its own tree; these are the widths
this branch measures on the merged one, and they agree.

**Seven, and not a looser bound.** The tally is a **census, not a tolerance**: it counts covers,
and each of the seven is derivable from two measured numbers — what the pinned face draws, and
what the spine's content box is. There is no noise for a margin to absorb. The face is pinned
(`github#47`), the widths come from note counts, and the numbers repeat exactly run to run; slack
of three would silently swallow `У`, `Р` and `É` the next time a face or an inset moved a pixel,
which is the failure `github#47` refused a constant for, from the other side. Seven also fails in
**both** directions — stand `Å` back up and the check reads 6 and someone re-derives it — where a
round 10 would only ever fail one way. The boundary was already this tight before this branch:
at 3px, `Ü` had 1.33px and `У` had 2.81px, so the two groups were never more than a pixel and a
half apart.

### And then the tally went to one, because the rail stopped being squeezed that far

Asked 2026-09-11, looking at the rail: *"characters in the encyclopedia should not have different
positions and reading direction"*. Right, and the tally above is the evidence — but the defect it
measures is **not** the three covers this ticket turned. It is that the rail draws the same kind of
thing two ways at all, and which way is decided by a sub-pixel font metric no reader can perceive:
`É` (7.25px) and `У` (8.19px) stand up, `Å` (9.25px) and `Ü` (9.67px) lie down, and nothing on the
page says why. Four covers were already lying down on `develop` before this branch existed.

It is not a script question either — it is a **width** question. A one-note volume is squeezed to
19px, which leaves nine pixels; an accented capital or a CJK glyph is 9.25–13.53px. So the answer
is to stop squeezing the rail below the width a letter needs:

```
var INDEX_MIN = 24;   /* was 13 */
```

`INDEX_MIN` is the floor in `widthOf`'s `Math.max(INDEX_MIN, Math.round(w * k))`, so it clamps the
thinnest volumes up and leaves every wider one to the scale. 24px is 13.53 (the widest cover) plus
2px of border and 8px of the declared side inset, rounded up. Measured on the one vault:

| | before | after |
|---|---|---|
| Encyclopedia volumes standing upright | 29 of 35 | **35 of 35** |
| short covers left sideways, whole library | 7 | **1** — `map`, a three-letter tag book |
| spines at the floor | 9, at 19px | 9, at **24px** |
| the rail's width against 1180px of room | 1127px | **1172px**, still **one row** |
| tightest upright cover | `У` 0.81px to spare | `学` **0.47px** |
| the title's box against the side rules, worst | **−2px** leather, −1.5px cyber | **+1px** leather, **+1.5px** cyber |

The last row is the one to notice: widening the squeezed spines is also what makes the **sideways
clearance positive**. The rail was the only place the type's own box was wider than the room
between the panel's side rules, which is why `design/0011`'s 22–58px floor read as violated there.

**The golden was rewritten deliberately** (`node scripts/update-layout-snapshots.mjs`) and it moved
two boxes: the Encyclopedia's first spine 42 → 40px, its last 18 → 24px and 13px to the right.
Shelves, rows, spines, plaques and the room are identical, and no shelf gained a row.

**The `sideways` tolerance comes back down to 1**, by the same census argument that put it at 7 —
the bound is the measured count, not a round number with slack. `map` is the one that remains, and
it is a tag book on a 27px spine drawn 27.7px wide: three letters that no single-letter reasoning
covers. Standing *that* up is a different question from the alphabet's.

### What clears a side rule is the line box, and that is the face's

Upright type turns the geometry round: the title's extent across its own text is the face's ascent
and descent, not anything `page.css` sets. Against a spine whose width is its note count
(**22–58px**, `design/0011`, and **19px** on the squeezed index rail), the clearance is
`(spine-w − across) / 2 − rule-side`, and on the one vault the tightest is **−2px** in leather
(a 19px spine, a 15px box across) and **−1.5px** in cyber (14px across). Negative: on the squeezed
rail the type's own box is wider than the room between the panel's side rules.

There is no padding that fixes that. The three levers are all worse than the defect:

1. **Widen the side padding.** The line box does not shrink with it — `min-width: auto` on a flex
   item holds it at its own block size — so a thin spine's type overflows the content box instead
   of clearing anything, and the ellipsis appears earlier on every spine for nothing.
2. **Pull the side rules in.** `--spine-rule-side: 0` still does not clear a 15px box across on a
   19px spine once the borders are off — the face is wider than the board — and it draws a panel
   with no margin on every book that is not.
3. **Shrink the type on a thin spine.** A spine's thickness is data (`design/0011`); making the
   face depend on it makes the shelf's type a chart.

So the check **reports** the side clearance and does not assert it, with the worst spine named in
every run. The number is visible, it is in `invariants.md`, and it moves when someone changes a
face or the rule inset. That is the honest state: the horizontal rules are held by construction,
the vertical ones are held by the face and watched.

## What this did not touch

Membership, addresses, counts and `src/core` — all identical, and the existing checks say so:
465 / 194 / 709 addresses under every look, a book the same size in a room of the same width.
`cyber.css` was edited for the law only and not repainted; `github#28` is rebuilding that look.
`github#9`, which `github#16` says it sits on top of, had already landed.

## Amendment, github#51 — a lift is geometry too, and the clip edge has to be declared

`page.css` owns the geometry and a look owns the paint. That division had a gap in it: the
**lift** is neither, quite. It is a transform, so it reflows nothing and reads as paint; but it
moves a spine out of its track's box, and whether the pixels survive that is the *track's*
business. Nothing tied the two together, so the track contained its paint and no spine had any
room above it.

### What was cut, and it was never only hover

`.vs-track` has `contain: layout paint`, which clips every descendant pixel to the track's
overflow clip edge. The track's `min-height: calc(var(--spine-h) + 34px)` with
`align-items: flex-start` puts **all** of its slack below, for the board and the plaque — so the
room above a spine was `0px`, and every one of the five lifts painted outside the box:

| state | rung | what was cut |
|---|---|---|
| a worn spine at rest, `[data-wear="2"]` | 1px | 1px, **with nobody hovering** |
| a worn spine at rest, `[data-wear="3"]` | 2px | 2px, with nobody hovering |
| a worn spine hovered | 5px (6px in cyber) | 5px |
| `:hover` / `:focus-visible` | 6px | 6px |
| a search match, `[data-query="1"] [data-match="1"]` | **7px** | **7px, on every match while a query is live** |

Two of those are not hover states. A shelf with wear on it was drawn with its worn books
permanently shaved, and the law *a filter narrows; the query marks* promises a matching book
draws **forward** — forward with its head sliced off is not what that promises.

### The fix is a clip margin, and it is the only option that moves nothing

`overflow-clip-margin` moves the overflow clip edge outward. Measured headless on the one vault,
a spine lifted 20px and how far above its track it was actually **painted**:

| track | painted above |
|---|---|
| `contain: layout paint` (as shipped) | 0px |
| `+ overflow-clip-margin: 0px` | 0px |
| `+ overflow-clip-margin: 7px` | **7px** |
| `+ overflow-clip-margin: 13px` | 13px |
| `+ overflow-clip-margin: 40px` | **20px — the lift, not the margin** |
| `contain: layout` (paint dropped) | 20px |

The last two rows are the whole argument: **the clip is still a clip.** A margin wider than any
lift does not leak anything, it simply stops biting before the head. So containment survives
intact, and because a clip margin is not padding, **nothing on the page moves** — no spine, no
board, no plaque, no `min-height`, no `background-position`, and no layout golden.

The two options the issue costed were both real and both more expensive:

- **7px of `padding-top`** works (cut 6px → 0px) but pushes every shelf down 7px — about 105px of
  extra scroll over fifteen shelves — and rewrites every golden in `scripts/layout-snapshots/`.
  A paint bug should not move the furniture.
- **Dropping `paint`** also works, and its cost turned out not to be measurable on this vault:
  scrolling the whole library, p50/p95/worst ms per frame, shipped
  `leather 17.6/18.4/21 · modern 17.6/18.3/19 · cyber 17.6/18.4/18` against paint-dropped
  `leather 17.6/18.4/22 · modern 17.6/18.4/20 · cyber 17.4/18.3/19`. Indistinguishable —
  `.vs-shelf`'s `content-visibility: auto` is carrying `design/0014`'s win now, not the track's
  `paint`. But *not measurable on one vault on one machine* is not *free*, and there is no reason
  to spend it when the clip margin is free.

No new browser floor: `overflow-clip-margin` is Chrome 90, and the page already requires
`color-mix()` (111) and `content-visibility` (85).

### The room is the ladder's top rung, by identity — and why it is not `max()`

The five lifts are declared as a ladder on `.vault-shelf`, and `--spine-lift-max` is both the
tallest rung and the room:

```css
--spine-lift-worn: 1px;
--spine-lift-worn-more: 2px;
--spine-lift-worn-hover: 5px;
--spine-lift-hover: 6px;
--spine-lift-max: 7px;
--spine-lift-match: var(--spine-lift-max);
```

This wanted to be `--spine-lift-max: max(<all five rungs>)`, so that *any* rung raised past the
room would move the room with it. It cannot be. Measured in this Chrome,
**`overflow-clip-margin` takes a bare `<length>` and rejects every math function**:

| declaration | computed `overflow-clip-margin` |
|---|---|
| `7px` | 7px |
| `max(1px, 7px)` | **0px** |
| `calc(max(1px, 7px))` | **0px** |
| `var(--m)` where `--m: max(1px, 7px)` | **0px** |
| `var(--m)` where `--m: calc(max(1px, 7px))` | **0px** |
| `var(--m)` where `--m: 7px` | 7px |
| `@property --m { syntax: "<length>" }` then `--m: max(1px, 7px)` | 7px |

Silently 0px, which puts the clip straight back to biting. Only an `@property` registration makes
the `max()` compute down to a length before substitution — and an `@property` registration is
**document-global**, where every rule in this sheet is scoped under `.vault-shelf`. `check-scope`
would not have caught it either: it skips any line starting with `@`, which is a gap in the check
rather than permission.

So the relationship is an identity instead — the top rung *is* the room — and the gap that leaves
(a **lesser** rung raised past the room, which CSS here cannot notice) is closed by a check that
names the look and the shortfall in pixels on every push.

**A look that lifts further moves its rung, on the room and not on the spine.** cyber restated two
lifts, one of them larger than `page.css`'s — a worn cartridge comes out the full 6px where
`page.css` stops a worn book at 5px. It now sets `--spine-lift-worn-hover` on
`.vault-shelf[data-look="cyber"]`, which is above the track, so `--spine-lift-max` re-derives on
the same element and the clip edge travels with the look. Setting it on the spine would not work:
the room above a book is the *track's* to allow, and the track is the spine's ancestor.

### Two checks, because each has the other's blind spot

**`a lifted spine is painted whole, in every look`** reads painted pixels, because this defect is
invisible to geometry — `getBoundingClientRect` reported the lifted spine at `y=160` whether it
was clipped or not. It lifts a spine **40px** (20px until the second amendment below raised the
rooms past it), far past any rung and past any look's room, and asks how far above its track it
is actually painted. One over-lift answers two questions: the clip grants exactly the room the
sheet declares (8 / 7 / 25px of 8 / 7 / 25px), and the clip is still biting (40px of lift paints
the room, never 40). Then one real state end to end — a search match, the top rung, lifted by the
**query** rather than the pointer.

Two earlier forms of that check were wrong, and both were wrong in ways that passed:

- **Driving all five states with a real hover and real wear.** The worn-at-rest rungs are a one
  and two pixel shift over a textured, sub-pixel-aligned ground, and it flaked outright: the same
  build came back `0/0/94/96` on one run and `104/104/101/176` on the next. A 20px over-lift moves
  a hundred units either way.
- **Differencing against the spine put back down.** Lowering a spine by its lift and comparing
  looked like a clean reference and is not one: shifting leather's steep gilt head by a pixel moves
  those pixels by more than any threshold *whether the head was clipped or not*, so the
  worn-at-rest cell read "painted" in a build where it demonstrably was not. The reference has to
  be the spine **absent** (`visibility: hidden`), which is the bare room.

And it samples the spine's **whole width**, never one column down its middle: a look's top hairline
can sit within a unit or two of the ground it stands on — leather's does — and one pixel there
cannot be told from dither. Across the full width the rounded corner, the side rules and the
closing border are all in the row.

**`the room above a spine is the largest lift, in every look`** is the arithmetic the pixels cannot
state: the room the track grants **is** the ladder's tallest rung, containment still includes
`paint`, and the box still has `0px` of slack above a spine. It costs milliseconds, it reads the
product's own tokens rather than a copy of them, and it is the only thing that catches a lesser
rung raised past the room. Without the fix it reports `SHORT: leather by 7px, modern by 7px,
cyber by 7px`.

### What this did not touch

No lift value changed. No `padding-top`, `min-height` or `background-position` on the track. The
hover peek is not inside the track and was never clipped. The goldens in
`scripts/layout-snapshots/` are **unchanged**, which is the fix's central claim and the reason
`the shelves are packed the way the golden snapshot says` was read after it rather than rewritten.


## Second amendment, github#51 — a lift is not the only thing that leaves a spine

The amendment above tied the track's room to the **lift ladder**, and that was the wrong
quantity by exactly the amount a look paints outside a spine's own border box. The fix was real
— every lift is painted whole now — and it left the same clip cutting a different thing.

### What is still cut, measured

Per look and per lifted state: how far above its track the spine is *allowed* to paint under the
7px room, against how far it *wants* to, read from the same frame with a 90px margin that clips
nothing.

| look | state | lift | allowed | wants | cut |
|---|---|---|---|---|---|
| leather | at rest, worn at rest, hovered, worn + hovered | 0–6px | = | = | 0 |
| leather | **a search match** | 7px | 7px | **8px** | **1px** |
| modern | every state | 0–7px | = | = | 0 |
| cyber | **hovered** | 6px | 7px | **18px** | **11px** |
| cyber | **worn + hovered** | 6px | 7px | **20px** | **13px** |
| cyber | **a search match** | 7px | 7px | **25px** | **18px** |

The sources are in the sheets and were never geometry: cyber's match is
`0 0 22px rgba(53,240,208,.5)` neon and its hover `0 0 18px` (`cyber.css`), leather's match a
`0 0 0 1px #d0b68166` gilt ring (`leather.css`). modern paints inside its box and 7px was
already right for it — which is why one number for all three looks would have been a guess that
happened to hold in one of them.

So **on every matching book while a query is live, cyber's glow was sliced 18px short.** That is
the same law this record already quotes — *a filter narrows; the query marks*, and a book that
draws forward does it with everything its look gives it.

### The room is the top rung plus the look's halo

```css
/* page.css, on .vault-shelf */
--spine-lift-max: 7px;   /* the tallest rung, unchanged */
--spine-halo:     0px;   /* what this look paints outside a spine's own box */
--spine-room:     7px;   /* the sum; .vs-track reads this */
```

`leather.css` sets `--spine-halo: 1px; --spine-room: 8px` and `cyber.css`
`--spine-halo: 18px; --spine-room: 25px`, on `.vault-shelf[data-look=…]` — above the track, the
same place cyber already moves `--spine-lift-worn-hover`, and for the same reason: the room above
a book is the *track's* to allow, and the track is the spine's ancestor.

### Why the sum is written out, and the re-measurement that says so

The first amendment recorded that `overflow-clip-margin` rejects `max()`. Adding two numbers
needed the wider question asked, and the answer is worse than "no `max()`":

| declaration | computed |
|---|---|
| `7px` | 7px |
| `calc(7px + 18px)` | **the declaration never applies** — the previous value stands |
| `max(7px, 25px)` | **never applies** |
| `var(--r)` where `--r: 25px` | 25px |
| `var(--r)` where `--r: calc(var(--a) + var(--b))` | **0px** |
| `calc(var(--a) + var(--b))` | **0px** |
| `calc(var(--a) + 18px)` | **0px** |

**The two failures are not the same failure.** A literal math function is dropped at parse time
and whatever was there before survives — loud enough to catch. A `var()` holding one is
substituted at computed-value time and *then* rejected, so the property falls to its initial
`0px` and the clip goes straight back to biting **with nothing in the sheet looking wrong**. That
is the trap, and it is why `--spine-room` is a bare length that a check adds up rather than CSS.

### Two checks, and the new one is what found this

**`nothing a look paints outside a spine is cut off, in every look`** walks five states in each
look — at rest, worn at rest, hovered, worn and hovered, and a search match with a query live —
and for each reads how far above its track the spine is painted under a margin wide enough to
clip nothing, then asserts the declared room is at least that. It does **not** read what the
spine is actually allowed: `a lifted spine is painted whole, in every look` already proves, per
look, that the clip grants exactly the declared room and no more, so the two checks hold the law
between them and this one costs two captures a state instead of three.

Three things about it were decided by measurement rather than taste:

- **`:hover` is forced** with `CSS.forcePseudoState`, never driven with the pointer. The
  real-pointer form of this measurement is the one the first amendment records flaking
  `0/0/94/96` then `104/104/101/176` on one build.
- **The band stays in the page.** Handing a 60-row band back over CDP as pixels is ~16,000
  numbers a capture and this check takes thirty of them: the first working form ran **68s**, the
  same numbers in-page ran **54s**, and dropping the third capture ran **20s**.
- **It reads wider than the spine** (24px each side), because a glow spills sideways as well as
  up, and the widest row above a track need not be over the spine's own width.

**`the room above a spine is the largest lift plus the look's halo, in every look`** is the
arithmetic, renamed from *…is the largest lift…*: the room granted **is** the tallest rung plus
the halo (leather `8 = 7 + 1`, modern `7 = 7 + 0`, cyber `25 = 7 + 18`), `--spine-room` states
that same sum so a look cannot declare one number and clip at another, containment still includes
`paint`, and the box still has `0px` of slack above a spine. With the room put back on the lift
ladder alone it reports `SHORT: leather by 1px, cyber by 18px -- UNSTATED: leather declares
--spine-room 8px and clips at 7px, cyber declares --spine-room 25px and clips at 7px`.

### What this did not touch

No lift changed, no glow changed, no geometry. The goldens in `scripts/layout-snapshots/` are
unchanged again, `a look moves nothing on the page` reads `0 moved, 0 resized` over 4,358
elements in four states, and `every control is the same size in every look` is `0 off by more
than a pixel` — a clip margin still only ever *permits*. Two constants moved in
`a lifted spine is painted whole, in every look` (`OVER` 20 → 40 and `REACH` 26 → 44, both sized
against a 7px room) and nothing else in that check, because `github#69` and a parallel branch are
changing its timing.

**One thing a wider room really does change**, and it is the point rather than a cost: in cyber,
a hovered or matching spine now glows up to 25px into the row above it instead of stopping at a
hard line 7px up. At rest nothing changes in any look — every look wants ≤ 3px at rest and was
already allowed 7.
