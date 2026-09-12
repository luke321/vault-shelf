# 0016 — The leather look

The opt-in leather binding gives the library its own materials and palette. The default
look still follows Obsidian. One setting selects `data-look="leather"`; every selector in
`src/leather.css` requires that attribute. The membership engine and book addresses are
unaffected. See `design/0005` for the default palette and `design/0011` for thickness.

## Reworked on 2026-09-10

The first version put polished wood, gold plates, four raised bands and marbled endpapers
across the whole interface. The bands crossed the lettering, the upper-case month names
were cramped, and navigation controls competed with the books. The new treatment gives
each material a smaller, specific job:

- **Charcoal room:** a soft pool of light above the shelves, with no repeated panel seams.
  Navigation uses plain controls and the shelf names use 22px sentence-case serif type.
  Leather typography uses locally installed Georgia, with Palatino and serif fallbacks,
  for both navigation and book text. Spine titles are 13px and counts 11px; the larger
  letterforms remain readable at library scale. Month bindings use
  three-letter names with their year, such as `Sep 2026`, to fit the title panel.
- **Dyed leather:** twelve muted bindings, including oxblood, tobacco, forest and slate.
  Rounded edge lighting and a low-opacity local grain give each spine depth.
  Bindings default to matching oxblood. Manage's **Vary book colors** assigns other books
  fixed palette slots by their stable addresses; encyclopedia volumes always stay oxblood.
  New notes never change an existing book's color. See `design/0005`.
- **Tooling:** two raised bands sit above and below the title, with a fine recessed frame
  around it. Mixed-case serif lettering uses pale gilt. The note count stays at the foot.
  Titles that exceed the panel retain ellipsis and their existing full hover/accessible name.
- **Walnut boards:** 10px deep, with a lit top edge and a modest cast shadow. The brass year
  labels are darkened metal with light engraving rather than broad bright gold strips.
- **Reading spread:** warm ivory paper, dark ink, 16px prose with 1.75 line height, a shallow
  fold, and an oxblood cover. The surrounding table is quiet; the marbling is removed.
- **Paper dialogs:** controls inherit light paper tokens while preview spines keep their dye.
  Preview books wrap within the sheet; a long preview must not paint outside the dialog.

No image or font is fetched. Both textures are authored inline SVG data URIs. The hide uses
fractal noise at 0.72 frequency, three octaves and 0.14 opacity, blended with soft-light;
wood uses stretched noise at 0.006 / 0.9 frequency and 0.18 opacity. Gradients provide the
remaining lighting, paper and metal.

## The contract

`look` remains `"" | "leather"`, defaulting to `""`. The standalone switch and Obsidian
setting both write settings; `applyLook()` sets the attribute and re-reads the twelve CSS
slots before rebuilding. The setting is paint: counts, membership, order and book addresses
stay the same. The leather token selector repeats the attribute to outrank the host-theme
selector, regardless of CSS concatenation order.

Following the request for 20% more room, the leather root uses **120% layout zoom**: books,
fonts, controls, spacing and the reader scale together. Spines retain their logical
**22–58px × 132px** geometry and render at **26.4–69.6px × 158.4px**. Hover and keyboard
focus lift them **6px** on screen. Row packing measures unscaled `clientWidth`, so it still
wraps correctly; additional rows can repeat year plaques without changing book counts or
addresses. Root width and height fill the host. Wear changes the highlight at the head and tail. Search still
parts the books, and ribbons still mark saved notes. Reduced motion removes all spine
transforms. List mode removes the binding decoration and uses ordinary horizontal text.

The spread retains its **1180px** maximum width, but reserves **24px** on either side for
its **11px** cover ring. Below 860px it reserves **16px** and stacks the pages. Navigation
wraps, shelf actions stay visible, and the index tabs become rows below the note.

## Visual and measured verification

The review artifacts live locally in `dist/leather-review/` (ignored), including before and
after Obsidian library/reader screenshots, standalone views at 390/768/1440px, search, list,
and builder screenshots, plus `measurements.json` from a temporary CDP inspection script.
Only generated fixtures were used.

The pictures caught two problems during the redesign:

1. A UTF-8 BOM in a concatenated stylesheet invalidated its first selector, so the leather
   palette and texture variables never loaded. The file is now UTF-8 without a BOM, with LF
   line endings; the scope check also caught the mixed-line-ending control character.
2. The builder preview used the full library's row width and painted books outside its paper
   sheet. Its local flex row now wraps, and the preview has no shelf-board background.

The targeted smoke checks cover look switching, room width, hidden sheets, named controls
and spine geometry on the demo, sparse and 10k fixtures. The look-switch check verified
**419 / 194 / 709** addresses respectively, unchanged and with the default palette restored.
These checks mostly run in the default look; separate CDP measurements exercise leather:
**419 books** at 390, 768 and 1440px; **zero** row, toolbar or reader-page overflow; a hovered
spine stays **57 × 132px** and lifts **5px**; reduced motion resolves to `none`.
Search retains **419** books (**177** matches and **242** ghosts), and list mode retains all
**419**. Obsidian's markdown renderer was checked separately with zero horizontal overflow.

## Filming

## Picking one

The look started as a toggle on the plugin's settings tab plus a button bolted to the
standalone's chrome — two controls, in two places, neither of them the room being repainted.
It is now **one selector in the library's own top bar**, which serves both hosts and is where
you are standing when you want to change it. `core.LOOKS` is the single list it is built from,
so a further look is one entry and one stylesheet:

```ts
export const LOOKS: { value: Look; name: string }[] = [
  { value: "", name: "Default" },
  { value: "leather", name: "Leather" },
  { value: "cyber", name: "Cyberpunk" },
];
```

`migrate` validates against that same list, which is what stops a settings file from asking
for a stylesheet nobody shipped. Every look but the default one ships in the same bundle and
paints nothing until `data-look` names it, so the cost of carrying them is a few KB of CSS and
no behaviour at all.

The third look is `design/0017`.

`node scripts/record-demo.mjs --look leather` selects the same setting as the user-facing
switch. Screen recordings still require the shared `record` lock. No recording or full-suite
run is part of this design review.

## A look may not move a book

This look shipped as `zoom: 1.2` — 20% of everything, which is how it bought its readability.
It is also how it bought a different `--spine-w`, a different `--spine-h` and a different
`--measure`, so a shelf held fewer books per row than the same shelf in any other look and
every book on the page jumped when you switched.

> "make the books the same height and width in all themes so that switching does not move them
> so much"

The 20% is now bought by the base font size alone — 14px becomes 17px — because a spine's size
is a **measurement of the book** (`design/0011`) and the paint has no opinion about it. Each
look sets type, colour and material; none of them sets a dimension a book is drawn at. Measured
on the demo vault: **49×132 in a 1180px room under all three**.

## The order they are offered in, and the one you get

`LOOKS` is ordered for a person rather than alphabetically or historically: **leather, modern,
cyber**. Leather is what a fresh library opens in, from settings schema 6 — a shelf of
bound books is what this product is a picture of, and the modern look is the one that follows
your Obsidian theme when you would rather it did.


## Addendum, 2026-09-11 — a dropdown on paper is paper

> "dropdowns in manage do not show the correct background color, looks like dark theme"

Inside Obsidian, under this look, the `<select>`s on the paper sheets came up dark. The
standalone never showed it, and the reason is the lesson above for the fourth time: the
standalone is not a preview of the plugin. Obsidian's `app.css` styles every `select` in the
app — `appearance: none`, `height: var(--input-height)`, its own padding, no border, a
box-shadow, a chevron drawn as two background layers with a blend mode, and
`background-color: var(--dropdown-background)` — and every one of those a rule of ours left
unset landed on our dropdowns.

So `page.css` now sets every property the host sets, for every `select` in every look
(github#2): `appearance: none`, `height: auto`, its own padding, a chevron drawn from
`--vs-chevron`, and a field from `--vs-field`. This look supplies the two tokens twice: on the
root, the rail's dark field with a pale stroke; on `.vs-sheetbody` and `.vs-page`, the paper
field `#faf6ee` with a dark stroke — so a dropdown, a search box or a text box on a sheet
reads as paper and one in the rail as the rail. The look's own box rule sets
`background-color` and never the shorthand, because the shorthand would wipe the chevron.

`"every dropdown paints itself, whatever the host says a select is"` puts Obsidian's actual
`select` rule into the page and asserts every dropdown's field is the look's own, its
appearance none, its chevron drawn, and that the host's height did not reach it. Before: the
rail selector went **28 → 40px** high under the host's rule and the builder's **29 → 40**;
after: **28 → 28** and **31.5 → 31.5**. The builder's dropdown is 31.5 now rather than 29
because the box is ours: it is the same height as the Name box above it, which the platform's
menulist never was.
