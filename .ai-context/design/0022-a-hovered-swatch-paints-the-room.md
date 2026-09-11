# 0022 — A hovered swatch paints the room

`github#44`. Asked on 2026-09-11: *"colors should live preview when the swatch is open and
hovering."*

Before this, the only way to find out what slot 7 would look like on the shelf was to commit it,
look, and change it back — and the twelve are exactly the case where you are choosing *between*
colours rather than typing a hex you already know. Now, while the swatch popover is open,
hovering one of the twelve paints the library in it; leaving without clicking puts back exactly
what was there when the popover opened.

## The rule

**A preview paints and nothing else.** Committing is what a click is for. A hover must not write
`settings` or call `saveSettings`; must not change a book's address, a shelf's order, a count, or
a book's size (`design/0016`, `design/0021`); and must not survive the popover closing by any
route.

The trial twelve live in one module-level `trial` object — `{ palette, ribbons }`, or `null` for
"nothing on trial" — read by `readSlots()` and `ribbonFor()` in place of `settings`, and by
nothing else. `persist()` is not reachable from the preview path at all, which is what makes the
first half of the rule true by construction rather than by discipline.

## The room, not a sample

The issue offered two answers and asked for a position: repaint the library behind the Manage
sheet, or show the colour in a sample the popover carries. **The room, measured rather than
assumed.**

With Manage open at 1264×1353, the sheet body is 760×711 and the spines on screen that lie
**entirely clear of it** are:

| fixture | spines on screen | clear of the sheet body |
|---|---|---|
| demo | 155 | **123 (79%)** |
| sparse | 67 | **47 (70%)** |
| 10k library | 93 | **77 (83%)** |

So the sheet does give up the room; seven or eight spines in ten are not under it. A sample would
have been a picture of a shelf standing next to a shelf.

**What the scrim cost, though, was the whole point of the feature.** `.vs-sheet` laid
`color-mix(in srgb, var(--surface-0) 82%, transparent)` over the entire library, so the room came
through at 18% and a slot changing from maroon to green read as a faint shift. The books really
were repainted and you could hardly see it. So the scrim thins to 40% **while the popover is
open** — `data-picking="1"` on the sheet, one colour-only rule in each of the three looks, no
geometry and no transition (so there is nothing for `prefers-reduced-motion` to turn off). It
changes once, when you open a colour picker, which is the moment the page should get out of the
way of the colours.

## What each column previews

- **The dye column** dyes every book that resolves to that slot — board *and* the ribbon that
  falls out of it, because `ribbonFor()` derives the thread from the board (`design/0008`).
- **The ribbon column** sets `--ribbon` and `--ribbon-ink` only, on the spines wearing that
  slot's dye. The board is not its business, and the check measures that separately.
- **Not previewed**: the Manage sheet's own twelve. Re-rendering the colours block on a hover
  would give a trial slot its `×` reset mark, which widens the slot control and moves the table —
  and `design/0016` says nothing moves. So the sheet keeps showing what is *chosen* while the
  room shows what is *offered*.

## Paint only, never rebuild

`repaint()` is the paint half of a render on its own: re-read the twelve, re-dye the bands they
feed, re-set the three custom properties on every spine already standing, and the open book's
ribbon row. No rebuild, so no address, count, size or packing can move, and nothing is left in
flight when a check returns (`decisions/0013`).

Every spine `renderSpine()` draws is pushed onto `painted` with its book and shelf, so a repaint
reuses `dyeOf()` and `ribbonFor()` rather than re-deriving them from the DOM; entries whose node
has left the page are dropped when the library is redrawn and again before each repaint.

`readTheme()` was split for this. Its first half reads the look's own twelve with the inline
values lifted off — a second forced style flush plus twelve derived threads — and the look cannot
change under a hover, so a repaint calls only the second half, `readSlots()`. That is the whole
difference between the first working version and this one:

| fixture | spines | books | hover, before the split | hover, after | a full `refresh()` |
|---|---|---|---|---|---|
| demo | 238 | 465 | 17.95 ms | **9.81 ms** | 10.1 ms |
| sparse | 77 | 194 | 6.40 ms | **3.76 ms** | 7.0 ms |
| 10k library | 186 | 709 | 14.39 ms | **8.13 ms** | 35.5 ms |

**The reason to paint rather than refresh is not the clock**, though: on the two small shapes the
two cost about the same. It is that a repaint touches no geometry at all, so "a preview moves
nothing" is true by construction instead of by argument, and `renderLibrary()`'s settle pass
cannot run under a pointer.

## Leaving

Off the twelve is off, whichever way the hand left: the pointer leaving the popover, focus
leaving it, Escape, a click outside, or a click that commits. All of them run through
`closeSwatchPick()` or `endPreview()`, and `endPreview()` restores by setting `trial` to `null`
and repainting — so what comes back is whatever the slot held when the popover opened, not the
look's own and not the previous hover. A slot already changed from the look's stays changed.

A trail across the twelve never flashes back through the committed colours between them, because
only leaving the *popover* ends a trial, not leaving a swatch.

## The keyboard

Focus previews, so Tab gives the same thing the pointer does, and the arrows walk the twelve
inside the row — left and right by one, up and down by a grid row, Home and End to the ends —
moving focus, which previews as it goes. The twelve stay individually tabbable (no roving
tabindex), so the control count the accessibility check reads does not move (344 named controls
on the demo vault, before and after). The grid's column
count is read back from the computed style rather than written twice: `page.css` owns the
geometry (`design/0016`).

**The focus the popover takes on opening offers nothing.** The popover opens on the swatch whose
colour the slot is already wearing, and the first focus event on that swatch is swallowed — a
room that changes the instant the popover opens would say a choice had been made before one was.
Chrome delivers that focus after the handlers are wired, so the guard is a flag rather than an
ordering.

## Custom

Nothing. The OS colour picker is a native modal this page does not own; on Windows it blocks the
page while it is open, so there is no drag to paint from and no event to paint it with. Hovering
the *Custom…* button previews nothing either, because there is no colour behind it yet — it ends
the trial, the same as leaving the row. **Back to the look's own** does preview, because it is one
of the things you are choosing between: it behaves like a thirteenth swatch.

## The check

`a hovered swatch paints the room, and leaving puts it back`, on all three shapes. It drives the
slot the room is actually wearing — found by reading the spines, because a shape where no book
happens to wear slot 1 would otherwise pass by painting nothing at all — and asserts, in one
pass: the room follows the pointer; nothing is saved; no spine's box, address or count moves
across a preview; the pointer leaving, Escape, a click outside and the keyboard each put back
exactly what was there; the ribbon column leaves the boards alone; a slot already committed goes
back to what *it* was rather than to the look's own; and the popover and sheet are shut at the
end.

It reads boxes, so it is in the serial lane, it waits for a spine to have a width rather than
sleeping a fixed 250 ms — in the parallel lane it read 238 boxes of `0:0:0:0` — and it compares
only boxes that were real in the first reading: a shelf off screen has `content-visibility: auto`
and its spines have no box until the browser gets to them, so one that gains a box mid-check is
the browser catching up rather than a preview moving something.

Boxes are compared **across a preview and never across a commit**: choosing a colour re-renders
the library, which puts its scroll back to the top, and that is what committing has always done
rather than anything a hover did.

`--shot-open swatch` takes the picture of it, since numbers cannot see.
