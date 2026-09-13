# 0012 — The reader is a book

`design/0004` settled what the reading spread *does*: contents on the left, note on the right,
tabs down the edge, the native renderer in the middle of it. This record is about what it
**looks like**, and it exists because the first version did the job and read as an email client.

> "the viewer is a bit to modern doesn't remind of a book"

## Four things, none of them a texture

The animation budget for the whole project is 5px of hover lift (`design/0005`), and the paint
budget is the theme's own tokens. No paper photograph, no page-curl, no drop-cap, no sepia.
What is left is the geometry, and the geometry turns out to be enough:

| | |
|---|---|
| the **gutter** | both inner edges darken toward the fold — `.vs-page::after`, a 22px gradient on the left page's right edge and the right page's left edge. This is the one that does the work: two panes with a divider are two things, two pages that fall away into a shared fold are one object seen open |
| the **edges** | `.vs-spread::before/::after`, a repeating 1px-on-2px-off gradient down both outer edges: the stack of leaves you see looking at a book from the front |
| the **object** | rounded outer corners, a real border and `0 2px 10px` of shadow, with `overflow: hidden` so the pages are cut by the cover. The spread lies **on** the surface instead of being a region of it |
| the **setting** | the book's title and the whole table of contents are set in `var(--prose)`, the reading face. A book's index is printed in the same type as its text; only the dates stay in the UI face, because they are furniture |

The tabs moved from the left edge to the right and grew a shadow, so they read as protruding
from the pages rather than being a segmented control stuck to the side.

## Leader dots

The contents rows lost their per-row bottom border and gained leaders:

```css
background-image: radial-gradient(circle, var(--text-3) 0.6px, transparent 0.7px);
background-size: 4px 4px;
```

A printed index separates its entries with space and a leader, never with a rule under every
line. This is the single cheapest piece of "book" available and it costs one element.

**A leader only exists when something is at the end of it.** An undated note emits `.vs-t`
alone; the dots and the `.vs-when` are appended only for a dated row. A row of leader dots
running to a blank margin is a typographic error, not a decoration, and the first cut had one
on every undated note in the vault.

## What was rejected

- **A page-turn animation.** It is the first thing anybody suggests and it is a delay between a
  person and their note. The whole reader exists to get to the text.
- **A paper texture.** It fights every Obsidian theme, and this page follows the theme
  (`design/0005`). A texture that looks right in the default dark theme is dirt in Solarized.
- **A centre fold seam** — a hard line down the middle. It reads as a hinge on a folder. The
  gradient reads as depth.
