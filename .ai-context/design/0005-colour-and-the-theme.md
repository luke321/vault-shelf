# 0005 — Colour, the theme, and who is allowed to style whom

**Superseded the original 0005 ("Colour and the two skins") on 2026-09-10.** That record was
wrong in a way worth keeping the memory of, so the correction is the first section.

## The correction

The original said, in as many words:

> the twelve slots are Vault Graph's, by name and by value

**They were not.** They were twelve invented pastels — `#7fb3c8`, `#c8a06a`, `#8fbf88` — and
nobody had opened the other project's stylesheet. Vault Graph's actual slots are saturated
(`#2a78d6`, `#eb6834`, `#1baf7a`, `#d3006e`) over a **light** ground (`--surface-0: #f4f3f0`),
with a dark override and a `css-change` listener that follows Obsidian's theme.

So the two plugins looked nothing alike, and the design record asserted that they did. This
repository's whole brief is *measure, don't reason*, and a claim of parity that nobody
verified is exactly the failure it warns about. It was caught by the person the plugin is for,
looking at it: **"does not remind me of vault graph yet, completely different colors."**

## The palette

Every token in `src/page.css` — surfaces, borders, the three-step text ramp, the twelve group
slots, the accent — is copied out of Vault Graph's stylesheet, value for value, in both
themes. These slots supply the book bindings; their assignment is described below.

**And the page does not keep its own copy.** `SLOT_KEYS` names `--g1`..`--g12`; `readTheme()`
asks the cascade what they currently resolve to. A copy of a palette is a palette that drifts,
and it is also a palette that cannot follow a theme switch: light and dark have different slot
values, and a hardcoded array can only ever be one of them.

`"the twelve colour slots are Vault Graph's own"` in the suite asserts all twenty-four values
— twelve light, twelve dark — against literals, so this record cannot go stale again without
a check failing.

## Nothing here needs Vault Graph installed

Worth stating plainly, because "you took the palette from the other plugin" invites the
question. **There is no runtime dependency of any kind.** The twelve values are literals in
`src/page.css`; `readTheme()` resolves `--g1`..`--g12` out of *our own* stylesheet through
`getComputedStyle`. Nothing reads the other plugin, nothing imports from it, nothing checks
whether it is installed, and `scripts/check-network.mjs` guarantees nothing fetches anything.
Vault Shelf on a vault that has never heard of Vault Graph looks exactly the same.

What the copy does cost is **drift**: if that project ever repaints, these values are a
snapshot and no longer match. That is a documentation risk, not a runtime one, and the suite
pins all twenty-four literals so the day it happens is a day a check fails rather than a day
nobody notices.

## The theme is the host's

There are no skins. The original design had *Graphite* and *Paper & cloth* as a manual toggle;
they are now simply Vault Graph's dark and light, and Obsidian decides which:

- the plugin sets `data-theme` from `body.theme-dark` and re-reads it on the `css-change`
  event, which is the only signal that the slots may now resolve differently;
- the standalone follows `prefers-color-scheme` and re-reads on change;
- `page.css` is light-first, with the dark values repeated under both
  `@media (prefers-color-scheme: dark) .vault-shelf:not([data-theme="light"])` and
  `.vault-shelf[data-theme="dark"]`, so an explicit choice wins in either direction.

Light **is** the paper library; dark **is** the graphite archive. Two names fewer, and the two
plugins can no longer disagree about what colour the room is.

## The board is the colour, and there is nothing else on the spine

The first design put a **stacked bar of the book's folder mix across the head of every
spine**. It went, and the reason is the brief: it is a chart drawn on a book, which is the
least analog thing that was in the room. It also said less than it looked like it said — on a
shelf where most books draw from the same few folders it is the same rainbow over and over,
and the eye cannot compare two rainbows anyway.

What is left is a **dyed board**, with a light-to-dark fall down the spine. A book's binding
is dyed; it does not wear a legend.

**Changed on 2026-09-10 after reviewing the leather preview:** encyclopedia volumes are a
matching set, not a folder chart. All `initial` classifier volumes use the first palette
slot. By default every other book uses that slot too. **Manage → Vary book colors** opts
the other classifiers into varied bindings in both looks. The additive `varyBookColors`
setting defaults to false for new and migrated settings; only literal true enables it.

With variation enabled, the stable `shelfId/classifierKey` address chooses the slot using
32-bit FNV-1a over its UTF-16 code units, modulo twelve. No note count, folder rank, dominant
folder, shelf position or visible-book index participates. Adding notes, new books or
folders, filtering and reordering therefore cannot recolor an existing address. Palette
values still follow the selected look and host theme. Twelve slots can be shared by many
books; color does not claim to encode a folder. Width, wear and ribbons retain their own
meanings, including on encyclopedia volumes.

The exact mix is not lost. It is in the **hover peek, in words** — `01 - Projects 14,
04 - Daily Notes 9` — which is where anything nobody should have to read a colour for belongs.

**The mix is not the same number in the two themes**, and that is not a fudge. Mixing a
saturated hue into a *dark* surface deepens it and reads as dyed cloth; mixing the same hue
into *white* can only lighten toward it, so the identical 14% that looked like a bound board in
dark came out as pale sweet-shop pastel in light — the exact look the invented palette was
pulled up for. Rendered at 4/9/14/20 in dark and 18/26/34/44 in light and looked at:
**`--tint: 14%` dark, `20%` light**, which is where the two shelves read equally understated.

`"the twelve colour slots are Vault Graph's own"` reads the slot off a **spine**, not off a
swatch: what has to be true is that the binding uses one of the twelve.

`"book colors are optional, encyclopedia volumes match and new notes never recolor books"`
drives the Manage checkbox, verifies reload persistence and compares rendered colors before
and after incoming notes change a book's dominant folder and the folder ranks. It checks
light, dark and leather, and verifies that the toggle changes neither counts nor addresses.

## The host cannot style us either

`check-scope.mjs` has always refused a CSS rule that could leak *out* of the page. It said
nothing about what could leak *in*, and that cost a real bug:

> Obsidian's `app.css` contains
> `.pdfViewer.scrollHorizontal, .spread { white-space: nowrap }`.

The reading spread was a `<div class="spread">`. The app's PDF viewer styled it, one long
paragraph stopped wrapping, and the reader grew a horizontal scrollbar across the whole
spread. Nothing in this repository was wrong. The class name was a word somebody else had
already claimed — and `ribbon`, `page`, `title`, `contents`, `tabs`, `prose` and `sheet` were
all sitting there waiting to be claimed next.

**So every class the page puts in the document carries the same `vs-` prefix its ids do**, and
`check-scope.mjs` enforces it across `page.html`, `page.css` and `page.js`. `.vault-shelf` is
the one exception: it is the scope handle, and the plugin's own stylesheet has to name it.

The lesson generalises past CSS: **anything the page names in a shared namespace is a name it
is only borrowing.** Ids had that rule from the first commit; classes did not, for no better
reason than that nobody had been bitten yet.

## Motion, and the absence of it

A spine lifts 5px on hover or focus and that is the entire animation budget. No opening-book
transition, no page turn, no 3D. The metaphor is a way of organising information, not a
simulation of a physical object, and every frame spent on the simulation is a frame between
somebody and their note.

`prefers-reduced-motion: reduce` removes the lift, the transition, and the parting in
`design/0008`. The lift is a `transform`, never a size or a margin, so a hovered spine cannot
reflow its neighbours — `"a spine lifts on hover and holds its size"` measures the box before
and after and asserts both dimensions are unchanged.

## Whose colour a book wears (2026-09-10)

Three people can have an opinion about a book's dye, and they are ranked:

1. **The person**, by right-clicking the spine: twelve swatches and *Automatic*, kept by the
   book's address so it survives a rebuild the way a reading place does.
2. **The shelf**, if it varies its books — a slot hashed from the address, so it stays put as
   notes arrive. Per shelf and not per library, because an Encyclopedia that varies reads as
   a rainbow and a People shelf that varies reads as people; the switch is in Manage on each
   row and in the builder, and the Encyclopedia may have it too, since somebody asked.
3. **The folder**, which is what a dye means by default: a book from the meetings folder and
   one from the journal are different colours because they are different kinds of book.

The leather rework had quietly made every book slot 0 unless its shelf varied, which is why a
whole library came out one colour for a day. That was a regression of this record and it is
repaired.

**The twelve are editable.** Manage shows them as twelve colour inputs reading what the cascade
currently resolves — the look's own, until one is changed, at which point all twelve become the
person's, written inline on the root so they beat every look. A palette with one chosen colour
and eleven that change with the look is not a palette anybody chose. "Use the look's own"
clears it. The ribbon has its own input for the same reason.

**A spine shows every ribbon in it, up to three**, side by side out of the bottom edge, 9px
apart. A book with three ribbons looks like a book with three ribbons, not like one with a
wider ribbon.

## The peek is ours, and there is one of it (2026-09-11)

> "there are 2 different hover overlays when hovering a book, they need to be bigger"

A spine carried a `title`, which is the browser's tooltip, and an `aria-label`, which inside
Obsidian is the app's — so a hovered spine grew two overlays, both too small to read a long tag
name in. The spine has its own text for a name, so neither attribute is needed. The peek is an
element of the page now, one `#vs-peek` moved to whichever spine is under the pointer or has
focus, 13px type up to 340px wide so a name wraps rather than clips, placed above the spine so
it never covers the book it describes.

**A label of three characters or fewer stands upright, when it fits.** An Encyclopedia's A is
read as A, not tilted; so is `0-9`, and so is Ü. Since `github#12` the fit is measured rather
than assumed (`design/0002`): `map` on a 22px spine would be `m…`, so it stays on its side.

## The colours block in Manage (2026-09-11)

> "colors in manage look terrible to select, also there needs to be a reset button"

The twelve were twelve bare `<input type="color">` and inside Obsidian those are the host's
native wells: small, unlabelled, no sense of which slot was which or whether it had been
touched, and "Use the look's own" under them did not read as a reset. The model is unchanged
— `settings.palette` is twelve hex or empty, `settings.ribbon` hex or empty — and the
presentation is:

- **twelve painted, numbered swatches** plus one for the ribbon, drawn by the same three-deep
  rule the dye menu's swatches use (`.vault-shelf .vs-slot .vs-swatch`, beside
  `.vault-shelf .vs-dye .vs-swatch`), so a look's own `button` rule cannot strip the colour
  off them. The number is written in dark or light ink by the slot's relative luminance. A
  click opens the native picker, which is an off-screen `<input type="color">` the swatch
  clicks — it is the *row* that has to read, not the picker;
- **a mark on a changed slot that is also its reset.** A small × in the swatch's corner
  appears when the slot's value is not the look's own and puts it back. The other choice was a
  right-click, which is what a spine has; a swatch has a corner to put a badge in and a spine
  does not, a badge is found by looking where a right-click has to be known about, and inside
  Obsidian a right-click on a control is the app's own menu;
- **one Reset colours** for palette and ribbon together, disabled when nothing is the
  person's, so the button itself says whether anything here has been customised.

**The look's own is read, not remembered.** `readTheme()` lifts the inline overrides off the
root, reads what the cascade resolves the twelve and the ribbon to, keeps those as `OWN`, and
only then writes the person's choice back. A slot is marked when it differs from `OWN`; a
per-slot reset writes `OWN[i]` into the palette; and **twelve that are all the look's own are
saved as none** — otherwise one reset under leather would pin leather's twelve under every
other look, which is the "palette nobody chose" this record already refused.

`"colours and hidden shelves set in Manage persist through a reload"` drives every one of
these through the sheet and back through `core.migrate`.

## A date shelf dyes by period (github#21, 2026-09-11)

*"make the encyclopedia have the same colors, but change colors for other books by decade, or
by year for example."* A folder dye says what kind of book this is, and on a Years shelf every
book is the same kind: the dominant folder of 2024 is the dominant folder of 2025, so the
whole run came out one colour with an odd one where a folder tipped. The thing that *does*
distinguish books on a date shelf is when they are, so that is what the dye follows.

`Shelf.colorBy` is `"folder" | "year" | "decade"`, and unset means the classifier's own
default: **Years by decade, Months and Weeks by year**, everything else by folder. The slot is
the period modulo twelve — `2026 % 12`, `202 % 12` — so it is fixed by the calendar rather
than by which years the vault happens to have, a new year takes the next slot along, and a
rebuild cannot recolour anything. The rule sits **between** *vary* and the folder in the
ranking above: a hand-given colour still wins, a shelf that varies still varies, and a book
whose key carries no year (`-undated`) keeps its folder's dye.

Encyclopedia is untouched, as asked, and so are People and Tags: a person's volume is a
kind of book, and the folder says which kind. Manage shows the rule as a select on the date
shelves' rows only — *Colour by folder / year / decade* — beside *Vary colours*; the other
rows do not get one, since on them it could only mean the folder.

Measured — demo / sparse / library: Months holds **129 / 29 / 121** dated books over
**16 / 5 / 11** years with **0** years torn between two dyes and **0** neighbouring years
sharing one; Years holds **2 / 1 / 2** decades, none torn, none shared; Encyclopedia
**29 / 23 / 27** of **29 / 23 / 27** books wear their folder's dye. Through Manage, Months
by folder puts **129 / 29 / 121** back on the folder, by decade tears **0**, and the
choice saves as `"decade"`. The setting is optional, so no schema moves: an older file comes
up on the defaults.
