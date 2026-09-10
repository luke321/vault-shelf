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

## The band carries the colour; the board only hints at it

Vault Graph paints pure slot colour on a neutral ground — a dot *is* its folder's colour. The
first pass here washed the whole spine in it at 9%, which over a dark surface is not a hint: it
read as a row of muddy purple and brown blocks, and the band at the head, which is the part
actually carrying information, disappeared into them.

**4%, plus a light-to-dark fall down the board.** Enough that a shelf reads as a row of
different books; little enough that the colour still lives in the 4px band. Three segments,
never five — five made every spine on a mixed shelf carry the same rainbow, and the eye cannot
compare two rainbows.

The band is explicitly **not** a legend and not a filter: it has no hit target, and the same
information is in the spine's hover peek in words, because colour alone is not information
anybody can rely on.

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
