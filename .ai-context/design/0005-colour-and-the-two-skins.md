# 0005 — Colour, and the two skins

## Twelve slots, and they are Vault Graph's

A folder's colour is its index in a twelve-entry palette, handed out in folder order — biggest
folder first — and cycling. The values are the sister project's, by name and by value.

That is not aesthetic laziness. Vault Shelf and Vault Graph are two views of one vault, and a
person who has both open is going to read a colour as an identity. A folder that is teal on
the disc has to be teal on a spine, or the two views are describing different vaults and the
colour is worse than no colour at all.

Twelve, cycling, means two folders can share a colour. That is deliberate and inherited: the
alternative is generating a colour per folder, which produces twenty muddy near-identical
hues in a vault with twenty folders and makes every one of them meaningless. Twelve
distinguishable colours that sometimes repeat beats forty that never do.

## The band is a fingerprint, not a label

Each spine carries a 4px band across its head, split by the source folders of the notes inside
it, widest share first, capped at five segments. It answers "where did this month's notes come
from" at a glance — a mostly-one-colour band is a month spent in one project, a striped one is
a month spent everywhere.

It is explicitly **not** a legend and not a filter. It has no hit target, and the same
information is in the spine's hover peek in words (`"01 - Projects 14, 04 - Daily Notes 9"`)
because colour alone is not information anybody can rely on. The folder filter in the
directory is the colour-independent version of the same thing, with names and counts.

## Two skins, one feature set

`data-skin="graphite"` and `data-skin="paper"` on the root, and **every** difference between
them is a custom property redefined in one block:

```
graphite   charcoal surfaces, fine rules, cool ink, brass accents held back
paper      parchment ground, cloth-coloured surfaces, warm ink, dull brass
```

Nothing else branches on the skin. The plaque's gradient and the spine's border colour are the
only two rules that name a skin directly, and both are paint. The invariant is checked
literally — *the two skins change nothing but the paint* asserts the same counts, the same
number of spines drawn, and a different computed background — because "just a theme" is a
claim that decays the moment somebody hides a control in one of them.

## Scope

Every rule in `src/page.css` is scoped under `.vault-shelf`, and `scripts/check-scope.mjs`
holds it there with no skip flag. The stylesheet ships as the plugin's own and is loaded into
Obsidian's document: one unscoped selector styles the entire app, and the bug report that comes
back says Obsidian is broken.

The same check requires every id in `page.html` to start with `vs-`, every `for` /
`aria-controls` / `aria-labelledby` reference to point at one of them, and every `$("...")` in
`page.js` to name an id that actually exists — a lookup that matches nothing returns `null` and
surfaces three functions later as "cannot read properties of null".

## Motion, and the absence of it

A spine lifts 5px on hover or focus and that is the entire animation budget. There is no
opening-book transition, no page turn, no 3D. The metaphor is a way of organising information,
not a simulation of a physical object, and every frame spent on the simulation is a frame
between somebody and their note.

`prefers-reduced-motion: reduce` removes the lift and the transition. `scrollIntoView` takes
`true` instead of `{ behavior: "smooth" }` under the same query, because a smooth scroll is
motion too and is the one most people forget.

The lift is `transform`, never a size or a margin, so a hovered spine cannot reflow its
neighbours — *a spine lifts on hover and holds its size* measures the box before and after and
asserts both dimensions are unchanged.
