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
themes. A folder that is `#2a78d6` on the disc is `#2a78d6` on a spine.

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

What is left is a **dyed board**: the dominant folder's slot mixed into the surface, with a
light-to-dark fall down the spine. A book's binding is dyed; it does not wear a legend.

The exact mix is not lost. It is in the **hover peek, in words** — `01 - Projects 14,
04 - Daily Notes 9` — which is where anything nobody should have to read a colour for belongs.

**The mix is not the same number in the two themes**, and that is not a fudge. Mixing a
saturated hue into a *dark* surface deepens it and reads as dyed cloth; mixing the same hue
into *white* can only lighten toward it, so the identical 14% that looked like a bound board in
dark came out as pale sweet-shop pastel in light — the exact look the invented palette was
pulled up for. Rendered at 4/9/14/20 in dark and 18/26/34/44 in light and looked at:
**`--tint: 14%` dark, `20%` light**, which is where the two shelves read equally understated.

`"the twelve colour slots are Vault Graph's own"` reads the slot off a **spine**, not off a
swatch: what has to be true is that a folder's colour reaches the thing a person looks at, and
that it is one of the twelve.

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
