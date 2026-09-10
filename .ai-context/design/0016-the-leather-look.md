# 0014 — The leather look

An opt-in second look: 19th-century leather bindings, gilt stamping, raised bands, a stained
plank, brass plaques and an open book lying on marbled endpapers. It is off by default, it is
a **setting**, and with it off nothing on the page is one pixel different.

> "I am really starting to like this — work on an old school look, that looks like real
> leather encyclopedias."

## What was rejected before, and why this is not that

`design/0012` rejected a paper texture, in as many words:

> **A paper texture.** It fights every Obsidian theme, and this page follows the theme
> (`design/0005`). A texture that looks right in the default dark theme is dirt in Solarized.

That reasoning was right and it still stands **for the default look**, which is exactly the
clause that lets this exist. The objection is not "textures are ugly"; it is *a texture cannot
follow a theme*. A look that never claims to follow the theme cannot fail to.

So the two looks answer different questions:

| | |
|---|---|
| `data-look=""` — **the default** | the library belongs to your Obsidian. It reads the host's theme, repaints on `css-change`, and uses Vault Graph's twelve slots so the two plugins describe one vault. `design/0005` |
| `data-look="leather"` — **this one** | the library is an object in your Obsidian. It has its own colours, its own light and its own furniture, and it ignores the theme on purpose |

The same argument settles what would otherwise be a contradiction: `design/0005` says *the
theme is whatever the host says it is*. Under leather it is not, and that is the whole content
of the setting. A person who wants the room to follow their theme leaves the switch alone.

## Additive, in every place it touches

The look is a **second stylesheet** — `src/leather.css` — and one attribute. Nothing in
`page.css` was changed, moved or deleted, and every rule in the new file is scoped under
`.vault-shelf[data-look="leather"]`, so with the setting off not one selector matches.

| | |
|---|---|
| `src/leather.css` | every rule. `scripts/check-scope.mjs` now reads **both** stylesheets — an unscoped rule in the second one would style the whole of Obsidian exactly as one in the first |
| `src/core/defaults.ts` | `look: "" \| "leather"` on `Persisted`, defaulting to `""`, and a `migrate` that turns anything else back into `""` |
| `src/page.js` | one function, `applyLook()`, called first in `refresh()` |
| `plugin/main.js` | one toggle in the settings tab, on both the declarative and the `display()` path, and `ShelfView.adopt()` so a mounted library repaints when the tab writes |
| `src/shell.html` | the standalone's own switch, **outside** `#vs-app` |
| `scripts/build-plugin.mjs`, `src/build-shelf.mjs` | the second stylesheet, appended after the first in both builds |

**The switch writes the setting; it never writes the attribute.** `applyLook()` owns
`data-look` because changing a look also changes what `--g1`..`--g12` resolve to, and the
twelve slots have to be re-read from the cascade before a single spine is dyed:

```js
function applyLook() {
  var want = settings.look === "leather" ? "leather" : "";
  if (root.getAttribute("data-look") === want) return;
  root.setAttribute("data-look", want);
  readTheme();
}
```

Without that `readTheme()` the first paint after a switch dyes every board with the *previous*
look's twelve values, because `readTheme()` runs once at mount, before the attribute exists.

## The twelve slots are remapped, not overridden in code

`design/0005` is the reason this look cost no JavaScript at all beyond those five lines:
`page.js` never keeps a copy of the palette, it asks the cascade. So a look that wants
different dyes declares different `--g1`..`--g12` and every spine, hover peek and preview
follows. `__vs.slots()` reports the leather dyes under leather, which is what the new check
reads.

The dyes are the ones a binder had, in slot order: oxblood, tan, dark green, ochre, forest,
plum, navy, vermilion, teal, aubergine, chestnut and near-black calf. Vault Graph's saturated
palette on a bound spine reads as a chart of bindings — the exact failure `design/0005`
records for the stacked bar — so under leather the folder is still the colour, but the colour
is a dye rather than a hue from a legend.

## Paint only

**No rule here changes what a shelf contains, where a book sits, or what it is addressed by**,
and geometry is left alone wherever it can be. A spine is the same 22–58px × 132px box, so
thickness still means the note count (`design/0011`). Three metrics move, all of them local
and none of them measured by an invariant:

| | |
|---|---|
| `--board: 3px → 14px` on the track | the floor becomes a plank. It is still the same **background line** at `var(--spine-h)` that `design/0003` requires, so the plaque still hangs beneath it — the plaque's own offset is `calc(var(--board) + 9px)` and follows |
| `.vs-spread` margin `10px/14px → 26px/30px` | the cover is a `box-shadow` ring, which costs the grid nothing; the margin is only somewhere for it to sit |
| the hover lift `5px → 6px and 1.6°` | `design/0005` set the animation budget at 5px of lift. A book tips out of a shelf before it comes off it; the tilt is a `transform` about the bottom edge, so a tipped spine still cannot reflow its neighbours, and `prefers-reduced-motion` removes it |

## Nothing is fetched

`scripts/check-network.mjs` reads `src/leather.css`. Every texture is either a CSS gradient or
an inline SVG data URI written out in the file:

- **the leather grain** — `feTurbulence type="fractalNoise" baseFrequency="0.85"`, desaturated,
  laid over the dye with `background-blend-mode: overlay`;
- **the wood grain** — the same noise stretched along the plank (`baseFrequency="0.006 0.9"`);
- **the marbled endpaper** — twenty-one combed stripes pushed through a displacement map,
  which is what marbling physically is: pigment floated on size and drawn through with a comb.

No font is loaded either. The gilt stamping is `var(--prose)`, the serif stack the reader
already sets its text in.

## What the screenshots changed

Every one of these was invisible to the suite and visible in a picture. `CLAUDE.md`'s rule —
*numbers cannot see* — earned its keep four more times:

| Shot | What it showed |
|---|---|
| 1, the standalone | The grain was at 0.55 opacity and washed all twelve dyes to the same speckled tan: the shelf was brown rectangles, which is the failure mode this whole task exists to avoid. **0.22, and blended `overlay`.** |
| 1, the reader | The index rows were little plaques — the leather `button` rule had reached `.vs-contents button`, which are buttons. A printed index is ink on the page and nothing else. |
| 2, the standalone | The plank was a dark rule: the books' cast shadow was 7px of near-black over a 14px board and had eaten the wood. **4px of shadow, a lit top edge, and a lighter stain.** |
| 3, inside Obsidian | The index rows were **centred, with a box** — and so are they in the default look, because Obsidian's `app.css` gives every `button` `justify-content: center` and a box-shadow. Fixed under leather; **the default look still has it**, and the fix belongs in `page.css`. |

## Inside Obsidian, and only inside Obsidian

The last row above is the general lesson and it is `design/0005`'s again from the other side:
**the standalone is not a preview of the plugin.** The suite drives the standalone, where no
host stylesheet exists; the app's own `button` rules only appear in the app. Anything shaped
like a native control — a button, an input, a scrollbar — has to be looked at in
`obsidian-smoke.mjs --shot`, which is why that script now takes `--look leather` and writes
the plugin's `data.json` before Obsidian starts.

## The check

`"a look is opt-in, repaints everything and moves nothing"` drives the standalone's own switch
— not the attribute — and asserts, on all three vault shapes:

- `data-look` goes `"" → "leather" → ""`;
- the first spine's colour and the twelve slots and the ground **all** change;
- **every book address and every count is byte-identical** before and after;
- switching back restores the exact colours it started with.

Measured on the demo vault: 182 addresses, identical in both. That is the law this look is
allowed to exist under, stated as a number.

## What was not built

- **A third look.** The attribute is a name, not a boolean, so a third one is a stylesheet and
  a value; nothing here assumes two. But a look is a large surface to keep true, and one that
  nobody asked for is a maintenance cost with no reader.
- **Varying book heights.** Real shelves are ragged along the top and it would be the single
  biggest gain left. It is not built because a height would have to *mean* something —
  everything else on a spine does (`design/0011`) — and a random one is decoration pretending
  to be data.
- **A page-turn.** Still rejected, for the reason `design/0012` gives: it is a delay between a
  person and their note. The leather look spends its motion budget on a book tipping out of the
  shelf, which is a way of pointing at the thing you are about to open.

## Filming it

`node scripts/record-demo.mjs --look leather` shoots the storyboard in the binding. The film
takes the look the way a person does -- by pressing the standalone's own switch -- and then
hides the switch, because it belongs to the standalone rather than to the plugin and a control
that is not in the product should not be in the film. The recorder throws rather than shooting
98 seconds of the wrong look if the attribute does not come back as asked.

