# 0029 — Leather spine bindings beside the colour picker

The book, plaque and shelf context menus offer fourteen colours and six
binding samples together: Original, Minimal, Gilt, Morocco, Vellum and Aged. Original retains the
existing leather's raised bands and gilt frame. The alternatives change grain, tooling,
ink and ribbon shape; ribbon colour still identifies the saved reading place. The first
twelve colour slots retain their values and two brighter dyes are appended: warm gold
`#e8c779` and pale teal `#81c4bc`. Existing twelve-entry palettes still load; editing one
extends it with the current defaults. Fourteen-entry palettes, book colours and ribbons
survive migration. Bright dyes use dark title ink.

The supplied antique-book reference informed the four alternatives: Gilt has curling gold
tooling, Morocco a floral rosette, Vellum a botanical stamp and Aged faded tooling with
long edge creases and fine diagonal wrinkles. Original keeps its raised bands and gilt
frame, with the chosen dye across the full spine. Vellum
mixes 58% of the chosen dye into parchment, so every offered colour remains visible.

Hover or keyboard focus previews on the addressed books without saving. Escape, leaving
the menu or opening another picker restores saved paint. Choosing a binding writes
`bookSpines[sourceAddress]`, so favourites and their sources agree and rebuilds keep the
choice. Automatic binding removes that override. A plaque addresses its visible run and
a shelf addresses the books currently standing on it, just as their colour controls do.

`core/bindings.ts` owns the six identifiers and deterministic hash. A shelf can choose one
binding, one per book, one per year or one per decade. Fresh People and Tags vary per book;
Years coordinate by decade and Months by year. Existing shelf definitions without these
optional fields keep Original. Fresh settings contain six shelves: Favourites, Encyclopedia,
Years, Months, People and Tags. Existing saved Weeks shelves survive migration.

Leather is the default and the sole offered look. Modern and Cyber remain shipped for
geometry checks but are shelved; the look selector is hidden with only one choice.

Each type owns its height: Original 132px, Minimal 131px, Gilt 130px, Morocco 128px, Vellum 126px and
Aged 124px. Matching types have matching heights regardless of their address or colour.
The trim lives in the core's style list and `page.css` applies it equally across looks;
choosing or previewing a type changes its height while book bottoms, widths and row packing
stay fixed. Samples use a 100px base with the same trims. A source address still determines
an 88–94% leather dye mix and a 0–30px grain offset. Leather styles remain paint.

Shelf boards are 14px thick, up from 10px, with a 22px drag strip. The leather board has
subtle longitudinal grain and knot lines. Right-clicking a board or empty rail opens the
shelf's colour and binding picker on automatic shelves as well as manual ones. New book
here is offered only on manual shelves; book and plaque menus keep their existing scope.

Decoration respects the existing title contract: 17px head, 29px tail, 4px side inset,
1px rule and at least 3px title clearance. All five samples measured 3px minimum clearance;
the existing full title census also passes. List mode keeps the samples shaped as books.

`build-shelf.mjs --demo` embeds fresh automatic settings for the declared fixture, with
empty `bookColors` and `bookSpines` maps. The older `--demo-seed` option remains an alias
but no longer stamps individual books. Periods share their group's colour and binding;
Encyclopedia retains Original. The export uses the stable name `Vault Shelf Demo`, and
the shell saves the embedded settings only when storage is empty. Subsequent reloads use
the visitor's saved settings. Initial demo Favourites use the existing four source picks.

The smoke checks `leather bindings preview beside colours with consistent heights and saved choices`
and `fresh leather defaults and automatic demo settings are deterministic` cover selection,
cancellation, migration, geometry, grouping and defaults. The golden keeps six shelves, ten
rows, 227 spines and 52 plaques in a 1125px room; heights and vertical row spacing change.

Colour selection and Automatic repaint existing spines rather than rebuilding the library.
Removing the shelf DOM had clamped the scroller to zero. `Automatic keeps the scrolled shelf
in place for colours and bindings` checks eight actions on books and boards: choosing and
resetting both paint properties. All preserve the book nodes and the 1495px scroll position.
The test settles the destination twice before measuring because offscreen shelves first
use an estimated intrinsic height, which Chrome replaces when they enter view.

Minimal and matching reader ribbons are specified in [0031](0031-picker-and-reader-controls.md).
