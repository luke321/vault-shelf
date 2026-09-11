# 0021 — One geometry, three faces

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
asymmetry in this fix and it is deliberate. One more pixel there changes **which short covers
stand upright**: `github#12`'s `fitsUpright` builds a hidden probe spine and asks whether
`scrollWidth <= clientWidth`, so the decision is taken against the title's **content box** — and
it is re-taken on every render, which means in whatever look the page is in. At `rule-side + rule`
the tag `学び` on a 38px spine came out upright in leather and cyber and turned on its side in
modern, and *"a look moves nothing on the page"* caught it as one element 20px wide in one look
and 76 in another. It had been agreeing across the three looks by a margin of about a pixel the
whole time, which nothing measured. That is a `github#12` question — an upright decision that
depends on the look is a look moving something — and it is recorded here rather than fixed here.
Measured after: **832** upright-type elements on the demo fixture, the same as before.

What clears a side rule is not the box but the **line box**, and upright type turns the geometry
round: the title's extent across its own text is the face's ascent and descent, not anything
`page.css` sets. Measured: a 13px serif on leather reads **26.4px** across, cyber's 10.5px sans
**14px**. Against a spine whose width is its note count (**22–58px**, `design/0011`), the
clearance is `(spine-w − across) / 2 − rule-side`, which came out **1.8px** on a 38px demo spine,
**1.5px** on a 26px sparse one and **6px** on the 10k library's 35px spines.

There is no padding that fixes that. The three levers are all worse than the defect:

1. **Widen the side padding.** The line box does not shrink with it — `min-width: auto` on a flex
   item holds it at its own block size — so a thin spine's type overflows the content box instead
   of clearing anything, and the ellipsis appears earlier on every spine for nothing.
2. **Pull the side rules in.** `--spine-rule-side: 0` still does not clear a 26.4px face on a
   22px spine — the face is wider than the board — and it draws a panel with no margin on every
   book that is not.
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
