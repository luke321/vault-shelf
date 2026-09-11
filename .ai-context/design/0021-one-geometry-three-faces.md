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

## What this did not touch

Membership, addresses, counts and `src/core` — all identical, and the existing checks say so:
465 / 194 / 709 addresses under every look, a book the same size in a room of the same width.
`cyber.css` was edited for the law only and not repainted; `github#28` is rebuilding that look.
`github#9`, which `github#16` says it sits on top of, had already landed.
