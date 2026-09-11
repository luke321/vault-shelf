# 0017 — The cyberpunk look

A third look, asked for in one line:

> "add a theme selector at the top, make a 3rd cyberpunky theme please"

The selector is `design/0016`'s job finished — one `<select>` in the top bar, built from
`core.LOOKS`, replacing both the standalone's corner button and the plugin's settings toggle.
This record is about the look it selects: **`src/cyber.css`, a rain-lit archive at 3am.**

## The brief, and the trap in it

Cyberpunk as a *library*, not as a poster. The room is a records vault lit by signage bleeding
through wet glass: deep blue-black ground, one edge-lit board per shelf, books that are
anodised cartridges racked on edge. **The books are still books.** A spine still carries a
title and a count, and a person still has to find a note.

The trap is the one `design/0005` already recorded for the stacked bar and `design/0016` hit
again with the leather grain, and it is worth stating in this look's own terms:

> **Neon is the light in the room. It is never the paint on the objects.**

Twelve saturated hues on twelve spines is a bar chart with a glow filter. Every decision below
is some version of pushing the colour off the face of the book and onto something that is
supposed to be emitting light — the lit edge, the board, the sign behind the plaque.

## What it is made of

| | |
|---|---|
| the **ground** | two signs across the street — cyan at 8% from the left, magenta at 96% from the right — over a blue-black fall, with sensor grain so the dark is photographed rather than filled |
| the **racking** | a seam every 168px behind the shelves, lit down one side, plus rain on the glass in front of it |
| the **board** | a strip light: dark housing, **one** lit pixel of filament, and a hue that runs cyan → violet → magenta the length of the room. `--board: 7px` |
| a **spine** | a 2px tube of the folder's colour down the leading edge, the same slot at `--tint` over the racking behind it, brushed aluminium along its length, a cap light on the top edge, and a rack marking at the tail |
| the **plaque** | backlit acrylic hanging off the front of the board, in the mono face, glowing |
| the **reader** | two sheets of dark glass in a machined frame; the fold is the seam of the device and the fore-edges are lit |
| the **sheets** | console panels: darker than the room, lit from their own edge |

Nothing is fetched. The grain, the brushing, the rain and the selector's chevron are inline
SVG data URIs written out in the file; everything else is a CSS gradient. No font is loaded —
the mono face is `ui-monospace, SFMono-Regular, Menlo, monospace`, which is the platform's.
`scripts/check-network.mjs` reads `src/cyber.css`.

## Paint only

**No rule changes what a shelf contains, where a book sits, or what it is addressed by.** A
spine is the same 22–58px × 132px box, so thickness still means the note count
(`design/0011`). Two metrics move, both local and neither measured by an invariant:

| | |
|---|---|
| `--board: 3px → 7px` on the track | still the same **background line** at `var(--spine-h)` that `design/0003` requires, so the plaque still hangs beneath it — its offset is `calc(var(--board) + 9px)` and follows |
| `.vs-spread` margin `10px/14px → 22px/26px` | the frame is a `box-shadow` ring, which costs the grid nothing; the margin is only somewhere for it to sit |

The hover lift is 6px and **no rotation**. `design/0005` sets the budget at 5px; this spends
one more and nothing else. The leather look tips a book out of a shelf; a cartridge slides out
of a rack and its tube comes up to full power, which is a transform and a shadow. A lifted
spine still cannot reflow its neighbours, and `prefers-reduced-motion` removes it.

## The twelve slots are remapped, not overridden in code

`design/0005` is why this cost no JavaScript: `page.js` never keeps a copy of the palette, it
asks the cascade. The twelve are signage gases spread around the wheel — cyan, sodium, mint,
amber, lime, magenta, violet, coral, azure, purple, and two steels for the neutrals.

**`--tint: 42%`, and both neighbouring values are failures a screenshot named.** The leather
look sets 100% because a hide simply *is* the dye. Here:

- at **100%** the shelf is the rainbow of highlighter blocks the whole look exists to avoid;
- at **30%** — the first cut — mixed against a ground this dark, cyan and azure and teal all
  collapse into the same slab, and a shelf of twelve folders reads as one. The screenshot was
  a row of identical blue-green rectangles, which is exactly what the placeholder had been.

At 42% the twelve resolve to `#176780`, `#744835`, `#1c7362`, `#745f31`, `#3d6a34`, `#74215b`,
`#433587`, `#742f42`, `#1b5087`, `#5b3287`, `#43526e`, `#2f3d5c` — still metal, and twelve of
them. Measured against the default look on the same 543-note mirror: the default at `--tint:
14%` separates the same folders *less*.

## What the screenshots changed

Every one of these was invisible to the suite and visible in a picture, which is `CLAUDE.md`'s
rule earning its keep again.

| Shot | What it showed |
|---|---|
| 1 | **The rain was cracks in the screen.** Six fat strokes at 0.5 opacity were the loudest thing on the page and read as damage. Weather is something you notice second: 0.13, hairlines, half the displacement. |
| 1 | **Every spine was a speaker grille.** The brushing runs down the panel and the scanline runs across it, and the two together drew a fine crosshatch on all 341 of them. The scanline came off the spine and stayed on the room's own surfaces. |
| 1 | **The shelf-jump strip lost three chips.** `.vs-railname` uppercase at 0.22em made "MIRROR-VAULT" 130px against the default's 75px, and the strip scrolls rather than wraps — so widening the name pushes shelves off the end. 141px of 434px was showing. 0.12em. |
| 2 | **The board was a candy stripe** ruled across the room, out-shouting every book standing on it. Two lit pixels over a saturated tube became one lit pixel over a deep one, 9px → 7px, and both blooms cut by a third. |
| 2 | **The shelf was one colour.** `--tint: 30%` → 42%, above. |
| 3 | **The look selector was a white slab** inside Obsidian and a dark field in the standalone — `design/0016`'s lesson that the standalone is not a preview of the plugin, for the third time. `appearance: none` takes the box back from the platform, and the chevron is drawn here because taking it back loses it. |

## Two things it found that are not its own

Both are in shared code this look may not reach into, and both are reported rather than fixed:

1. **A live look switch does not re-dye the spines.** The `change` handler on `#vs-look` calls
   `applyLook()`, which sets the attribute and re-reads the palette, but never re-renders — so
   every spine keeps the inline `--spine-tint` written from the *previous* look's twelve.
   Measured on the mirror vault: after switching to cyber the first spine still carries
   `#d95926` (Vault Graph's dark `--g2`); after any rebuild it carries `#ff8a3d`, which is
   cyber's. It affects **leather too**, and it is only invisible because `--tint` and
   `--surface-2` move with the look as well, so the mixed `backgroundColor` changes anyway and
   a check comparing only that colour passes. `refresh()` in place of `applyLook()` is the
   whole fix; `refresh()` calls `applyLook()` first, so `design/0016`'s ordering still holds.
2. **`#vs-look` is 395px wide in every look**, which is `page.css`'s `select { width: 100% }`
   reaching a control that is a flex item in the top rail. That is what squeezes the shelf-jump
   strip; the width is deliberately *not* set in `cyber.css`, because papering over shared
   chrome in one look hides it in the other two — the precedent is `design/0016`, where the
   leather look fixed `.vs-contents button` for itself and left the same bug in `page.css`
   named rather than patched.

## The check

`"a look is opt-in, repaints everything and moves nothing"` was rewritten for the selector,
and it now **walks `core.LOOKS`** rather than a list of its own, so a fourth look is covered
the day it is added. On all three vault shapes it asserts:

- the selector offers every look, and each one sets `data-look` to its own value;
- each look's ground, twelve slots and first-spine dye differ from the default's **and from
  every other look's** — two looks that resolve alike are one look shipped twice;
- **every book address and every count is byte-identical across all three**;
- the first spine's `--spine-tint` is one of the twelve the cascade *currently* resolves —
  this is the assertion that catches the stale dye above, and the reason the old check could
  not: comparing the mixed `backgroundColor` alone cannot see it;
- the default comes back exactly.

Measured: **194 book addresses on the demo vault, 419 on the sparse, 709 on the 10k library —
identical under all three looks in all three.**

## Looking at it inside Obsidian

`node scripts/obsidian-smoke.mjs --vault ./mirror-vault --look cyber --shot out.png`, which is
where the six corrections above came from. That script also grew **`--host-theme light|dark`**,
which drives the host's own switch — `theme-light` on the body plus a `css-change`, the pair
the plugin listens for. A look declares its own colours and stops following the theme, so what
this catches is everything a look did *not* declare: Obsidian repaints its native controls and
its rendered markdown on that class, and both land inside the page. The vault's own
`appearance.json` does not do it — it is written, it is copied, and Obsidian starts dark anyway.

Measured under a light host: body `theme-light`, the app's own ground `rgb(255,255,255)`, the
page reading `data-theme="light"` under `data-look="cyber"`, and the note's ink still
`rgb(232,245,255)` on dark glass. No light-theme bug; the reader is identical in both.

## Addendum, 2026-09-11 — shelved until the redesign

> "disable cyberpunk for now until redesign, make sure though to make changes to it aswell"

The look is **shelved, not removed**: `core.LOOKS` carries `shelved: true` on it, the selector
lists only `core.offeredLooks()`, and `migrate` (schema 9) accepts only `core.isOffered()`
values, so a file that says `cyber` comes up in leather. Everything else stays: the stylesheet
ships, `check-scope` and `check-network` read it, `build-shelf.mjs` inlines it, and the look
check, the scroll check and the same-size check paint it through `__vs.setLook()` — so the
"changes to it as well" half of the ask is enforced rather than remembered. The two constants
that "move under cyber" above are now one: the spread margin is `page.css`'s 14px in every
look (the ring still fits), because a look may not resize the book either.

Bringing it back is one flag.

## What was not built

- **An animated scanline, a flicker, or a glitch.** All three are the page-turn argument from
  `design/0012` in fancy dress: motion between a person and their note. The scanline is static
  at 0.05 and the room does not move.
- **A monospace note.** The chrome is mono because a rack label is; the *note* stays in the
  reading face `page.css` sets, because the text is the one thing on the page that is not
  furniture.
- **Neon on the spine titles.** A glowing letterform at 10.5px is an unreadable one. The title
  is lit from behind — a cap light and a dark shadow — and the glow is spent on the edge beside
  it. Chromatic split is allowed on exactly two things, the vault's name and a shelf heading,
  both of which are short and neither of which is read as a sentence.

## Addendum, 2026-09-11 — the selector's fix became everyone's

"The look selector paints itself" above was github#2 solved once, for one control, in one look.
It is now solved for every `select` in every look in `page.css` (`design/0016`, addendum of
the same day), and the `#vs-look` rule in this file is gone: this look supplies `--vs-field`
and a cyan-stroked `--vs-chevron` on its token block, and its box rule sets
`background-color` rather than the shorthand so the drawn arrow survives. Measured under the
host's rule with the look painted through `__vs.setLook()`: field `rgba(5, 10, 20, 0.85)` on
all four dropdowns, chevron drawn, 28px high.

`node scripts/smoke.mjs --look cyber` reaches a shelved look through that same handle now,
since the selector no longer offers one; `--look modern` is the default look by name.
