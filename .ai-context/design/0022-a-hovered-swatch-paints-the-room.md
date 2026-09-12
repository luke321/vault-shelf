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

With Manage open at 1584×961, the sheet body is 760×711 and **49 of the 82 spines on screen lie
entirely clear of it** — measured on the three fixtures this was first written against as 123 of
155, 47 of 67 and 77 of 93, so the fraction has held between 60% and 83% across every shape the
suite has had.

So the sheet does give up the room; most of the spines on screen are not under it. A sample would
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

| the vault | spines | books | hover | a full `refresh()` |
|---|---|---|---|---|
| 5,000 notes over eleven years | 231 | 691 | **9.31 ms** | 32.7 ms |

Before the split it was 17.95 ms, on the three fixtures this was first written against — where a
hover and a refresh cost about the same on the two small shapes.

**The reason to paint rather than refresh is not the clock**, though: on the two smallest shapes
the suite has measured, the two cost about the same. It is that a repaint touches no geometry at all, so "a preview moves
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
tabindex), so the control count the accessibility check reads does not move (337 named controls,
before and after). The grid's column
count is read back from the computed style rather than written twice: `page.css` owns the
geometry (`design/0016`).

**A menu of the twelve opens holding its own focus**, and that is what makes "opening offers
nothing" structural rather than timed. The first shape of this focused the swatch whose colour
the slot was already wearing and swallowed that one focus event with a flag. It worked, and it
was a race: Chrome delivers that opening focus *after* the handlers are wired, and if it lands
after the hand has already moved on it yanks focus back and undoes the preview. The suite caught
it as a check that failed about one run in four on the 10k shape and never in isolation.

So no swatch takes the opening focus at all. The menu itself does (`tabIndex = -1`), the twelve
keep their `aria-pressed`, and **the first arrow steps onto the colour the unit is already
wearing** — so the keyboard's first move shows what is committed rather than something else. Tab
reaches each swatch and previews it on the way, as before. The arrow handler moved from the row
to the menu for the same reason: with focus on the container, a keydown on the row would never
hear it.

## Custom

Nothing. The OS colour picker is a native modal this page does not own; on Windows it blocks the
page while it is open, so there is no drag to paint from and no event to paint it with. Hovering
the *Custom…* button previews nothing either, because there is no colour behind it yet — it ends
the trial, the same as leaving the row. **Back to the look's own** does preview, because it is one
of the things you are choosing between: it behaves like a thirteenth swatch.

## The other three places the twelve are offered

The Manage sheet is where a slot is chosen; the right-click is where a *book* is given one by
hand, and asked for on the same day the preview was: a plate should dye what is under it, and a
shelf its whole self.

**One menu builder serves all three.** `dyeRow()` puts the twelve and *Automatic* into a menu and
hands back its offers; `openDye()` takes a **list** of books rather than one, and the lines below
the twelve — edit, delete, add to a pick shelf — are a single book's and only appear for one. The
unit each entry point passes:

| right-click | the unit | where |
|---|---|---|
| a spine | that book | `renderSpine` |
| a plate | **its run** — the adjacent books it names, wrapped rows included (`github#29`) | `renderTrack` → `runOver` |
| a shelf's head, or empty rail | every book standing on the shelf | `renderShelf`, `offersBook` |

A plate's unit is its **run**, not every book that shares its label, because that is what a plate
already means everywhere else: `design/0018` settled that a run is what is adjacent, and
`openPlaque()` opens the same run. A shelf a person has split shows two plates, and dyeing one
dyes one.

### "Wrapped rows included" was not true when this record first said so (github#29)

The row above is the correction, and it is worth keeping the memory of, because it is this
repository's own named failure mode caught in its own design record: **a claim of behaviour that
nobody had measured.** The table said "wrapped rows included" on the day the feature landed. The
code did not do it.

One `renderTrack` call is **one shelf row** (`design/0014`), so the handler wired to a plate closed
over `group.books` — the slice of the run that landed on *that board*. A run of twelve months drawn
nine-and-three dyed nine books from one plate and three from the other, while `openPlaque()`, three
lines further down the same file, resolved the whole run through `core.runsOf(view.books)` and
opened all twelve from either copy. So the two gestures on the same piece of brass disagreed about
what it named, and the check written for the feature read the run as
`plate.parentElement.querySelectorAll(".vs-spine")` — the row — so it asserted the bug and passed.

**`runOver(shelf, under)` is now the one resolution, and both gestures go through it.** It is the
body `openPlaque()` already had, lifted out: the runs of the shelf's whole sequence, the one
holding this book. A plate cannot dye a different set from the one it opens, because neither of
them computes the set any more. The builder's preview passes a draft shelf that is in no view and
has no sequence; there `runOver` returns null and the row is all there is, which is correct — that
preview is not a shelf anybody can right-click.

**And a run of one book is still a run.** `openDye()` used to infer the menu's shape from
`books.length`, so a plate over a single book grew the lines that belong to a spine — *Add to
Favourites*, *Edit book*. It now takes **where the hand landed** as an argument, and only a spine
is a spine.

**It is a stamp, not a rule.** `setBookColors()` writes one `bookColors` key per book, exactly as
right-clicking each spine in turn would — so it survives a rebuild by address, a single spine can
be re-dyed afterwards, and *Automatic* takes them all off again. A book that joins the shelf
later does **not** inherit the colour. A rule would need a new field on `Shelf` and a `migrate`
clause, and `migrate` lives in `src/core`, which this branch was told not to touch; it is worth
its own issue rather than a guess made here.

**The threads follow.** Nothing extra was needed: a thread falls out of the board it is sewn into
(`design/0008`), so previewing a board previews its ribbon, on one spine or on a hundred and
thirty. The check reads `--ribbon` across the library and asserts it moved.

**The shelf menu leads with the act tied to where the hand landed.** Right-clicking empty rail
space is a gesture about a *position* — it is how a book is made at that gap (`design/0020`) — so
*New book here…* stays first and the twelve sit under it. Two checks in the suite took that
button by position, and one of them came back holding **-1 notes** when the twelve went in above
it; that one now asks for `.vs-railline` by name, which is what it always meant.

## The menu says which gesture this one is (github#29)

> "dyeing one book and dyeing eleven are the same gesture and need different words"

They are the same right-click, the same twelve swatches and the same *Automatic*, and until now
the same menu: a name line carrying whatever was under the pointer. On a spine that name **is** the
unit. On a plate it is the label of a run whose size is nowhere on screen, and on a shelf head it
is a shelf that might hold two books or two hundred and thirty-one. The gesture that dyes 231 books
in one click should not be indistinguishable from the one that dyes one.

So the menu carries a second line, `.vs-dyeunit`: **`12 books under this plate`**, **`231 books on
this shelf`**, and nothing at all on a spine.

- **Its own line, not a suffix on the name.** `.vs-dyename` is `white-space: nowrap` with an
  ellipsis, because a tag key can be longer than a 196px popover; appending the count to it would
  have put the one fact nobody can infer behind the ellipsis on exactly the labels where the menu
  is hardest to read. The name may clip. The count may wrap. Neither may vanish.
- **A run of one still says `1 book under this plate`.** It is a plate, and saying so is how the
  two menus stay told apart; a plate that fell silent whenever its run held one book would be
  indistinguishable from a spine's menu at the moment the difference is subtlest.
- Under the shelf's menu the line sits below *New book here…*, because that button is about the
  position the hand landed on and stays first (above). Under a plate's it sits straight under the
  name, and closes the gap the name left: `.vs-dyename + .vs-dyeunit` is the only rule that
  distinguishes them, so there is one line and two placements rather than two lines.

**The undo is *Automatic*, and it is deliberately not a new word.** `github#29` asked whether
twelve keys written in one gesture want their own way back — "use the shelf's own colours again" on
the plaque menu, or something else. They do not. *Automatic* already means *no hand-given colour
here*, it already sits under the twelve on every one of these menus, and it already takes off
whatever the unit wears because the unit is what the menu was opened on. A second word for the same
act on one of the four menus would be a fourth thing to learn and a fifth thing to keep in step;
the per-slot reset in `github#4` is a different case, because a Manage swatch has a corner to put a
badge in and something to reset *to* (the look's own), where a book has neither. What did change is
that *Automatic* on a plate now takes the **run** off, from either copy, for the same reason the
twelve now dye it.

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
sleeping a fixed 250 ms — in the parallel lane it read every box as `0:0:0:0` — and it compares
only boxes that were real in the first reading: a shelf off screen has `content-visibility: auto`
and its spines have no box until the browser gets to them, so one that gains a box mid-check is
the browser catching up rather than a preview moving something.

Boxes are compared **across a preview and never across a commit**: choosing a colour re-renders
the library, which puts its scroll back to the top, and that is what committing has always done
rather than anything a hover did.

A second check, `a right-click dyes a book, a plate's run or a shelf, and hovering paints it
first`, drives the other three menus on all three shapes: each offers the twelve, a hover paints
the whole unit and its threads and saves nothing, a click saves one key per book, *Automatic*
takes them all off, and no box moves across any preview. Both checks clear the palette, the
ribbons and the hand-given colours before they measure — the checks that run before them in the
serial lane leave all three behind, and what these measure is a difference.

A third, `a plate dyes its whole run from either copy, and the colours survive a rebuild`
(`github#29`), is the one that would have caught the row-for-run bug above, and it was written by
first watching it fail against the old code. It is in the serial lane: it counts the plates a run is
drawn on, so it reads the packing.

**It goes looking for a wrapped plate rather than assuming one.** The first shape of it narrowed the
viewport until *the longest run* was drawn twice, and that never happens: the vault's longest run is
twelve months, and twelve spines fit one row at any width the library is usable at. A run wraps when
it **starts late on a row** and does not fit what is left, which is a fact about the whole shelf's
packing and not about the run's own length. So every run on every sorted shelf is asked how many
plates it is drawn on, and the biggest one drawn twice is the one that gets dyed — with the widths
kept as a fallback for a library where none is. Manual shelves are excluded, because there one label
may name two runs (`design/0018`) and this check is about one run drawn twice.

Measured on the vault: `months` plate **2022**, drawn **2** times at 1280px over a run of **12**
books, **9** on one row and **3** on the other. Right-clicking the **second** copy — the three —
says `2022 / 12 books under this plate` and dyes all **12**, writing **12** `bookColors` keys and
leaving the shelf's other **98** books alone. All **12** survive `__vs.setFilters({})` and a
`core.migrate` round-trip. A favourite dropped on a pick shelf pointing into the run follows the
dye and gains **no key of its own** (`design/0019` — a reference, never a copy). *Automatic* on the
**first** copy takes all 12 off again and every spine's tint is what it was before the dye, string
for string.

`--shot-open swatch` takes the picture of it, since numbers cannot see.
