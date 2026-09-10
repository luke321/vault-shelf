# Changelog detail

`CHANGELOG.md` says what changed. **This file says what it was before and after, with the
number.** Those numbers are the regression suite: if a later change moves one of them, the
question is which, and by how much, not whether it feels the same.

The rule: **if a change is about what a shelf contains or where a book lives, it needs a
number before and after.** No number, no entry — and no entry, no merge.

---

## 0.1.0 — the first measurements

Everything here is a baseline rather than a delta, because there is nothing before it.
Measured 2026-09-09.

### The fixtures

| Vault | Notes | Folders | People | Tags | Undated |
|---|---|---|---|---|---|
| demo | 394 | 11 | 8 | 15 | 18 |
| sparse | 756 | 6 | 7 | 8 | ~150 |
| library | 10,000 | 15 | 10 | 13 | ~500 |

The demo vault's 394 notes produce **182 spines** across the six default shelves: 20
Encyclopedia volumes, 4 years, 27 months under 3 year plaques, 106 ISO weeks under 3, 9 people,
16 tags.

### Membership overlap, which is the product

On the demo vault the six shelves place 394 notes into books as follows — `sum / unique`:

| Shelf | Books | Sum of book sizes | Unique notes |
|---|---|---|---|
| Encyclopedia | 20 | 394 | 394 |
| Years | 4 | 394 | 394 |
| Months | 27 | 394 | 394 |
| Weeks | 106 | 394 | 394 |
| **People** | 9 | **478** | 394 |
| **Tags** | 16 | **516** | 394 |

People and Tags are the two that overlap, by 84 and 122 placements respectively — that is the
"one note, six addresses" claim, in numbers. A run where **no** shelf overlaps means the
fixture stopped exercising the unique-membership law and the check has gone quiet without
failing.

### The Encyclopedia's 0-9 volume

**187 of 394 notes** land in `0-9` on the demo vault, because its daily and meeting notes are
titled with an ISO date. Without the volume that would be **ten single-digit books** opening
the shelf before it reached A. The check asserts zero single-digit books.

### Index tabs at scale

The largest book on the demo vault is `people/-unfiled` at **228 notes**, indexed behind **20
tabs**. Past 26 distinct index keys the tabs collapse to twelve ranges; on the library fixture
the biggest Encyclopedia volume runs into the hundreds and takes that path.

### Bundle size

`main.js` **64 KB**, `styles.css` **17 KB** — the two files Obsidian installs alongside
`manifest.json`. The standalone build of the demo vault is **309 KB**, of the sparse vault
**323 KB**, of the library vault **3,070 KB** (it carries every note body).

### Inside a real Obsidian

Measured on the demo fixture, 2026-09-09: the plugin was ready **0–1,600 ms** after being
enabled, the view mounted and drew **182 spines in ~1,250 ms**, and three close-and-reopen
cycles left **one** mounted root and the DOM node count **unchanged** (2,675 → 2,675). The
ribbon icon renders **4 shapes at 18×18**, and `window.__vs` is `undefined` inside Obsidian —
the debug surface is stripped from the plugin bundle.

---

## The palette was never Vault Graph's

`design/0005` asserted that the twelve colour slots were "Vault Graph's, by name and by value".
They were twelve invented pastels — `#7fb3c8`, `#c8a06a`, `#8fbf88` — and nobody had opened the
other project's stylesheet. Measured 2026-09-10, the real values:

| | Vault Graph, light | Vault Graph, dark | what was here |
|---|---|---|---|
| `--g1` | `#2a78d6` | `#3987e5` | `#7fb3c8` |
| `--g2` | `#eb6834` | `#d95926` | `#c8a06a` |
| `--g3` | `#1baf7a` | `#199e70` | `#8fbf88` |
| `--surface-0` | `#f4f3f0` | `#121211` | `#17181a`, dark only |

Not a near miss: a saturated, light-first palette against twelve desaturated pastels on a
charcoal ground. Caught by the person the plugin is for, looking at it.

The slots are now **read from the cascade** rather than written down — `readTheme()` resolves
`--g1`..`--g12` — so a theme switch re-reads them and a copy cannot drift. The suite asserts
all twenty-four values, twelve light and twelve dark, against literals.

## Obsidian owns `.spread`

Measured 2026-09-10, in the reading spread: the note pane was **495px wide with 1,324px of
content**, the page 916 against 1,346, and the whole spread had a horizontal scrollbar.

Two rounds of `min-width: 0` on the grid item and then the flex item did not fix it, because
neither was the cause. The browser was asked directly which rule was responsible:

```
white-space on .spread set by: app.css  {.pdfViewer.scrollHorizontal, .spread} -> nowrap
```

**Obsidian's PDF viewer owns the class name `.spread`.** Nothing in this repository was wrong;
the class name was a word somebody else had already claimed — and `ribbon`, `page`, `title`,
`contents`, `tabs`, `prose` and `sheet` were all sitting there waiting to be claimed next.

Every class the page emits now carries the `vs-` prefix its ids always had — 51 of them — and
`check-scope.mjs` enforces it across the markup, the stylesheet and the page. After: nothing
scrolls sideways, at 1,216px of reader and 495px of note.

The `min-width: 0` on both the spread and the page stayed, because both were also true: a flex
item and a grid item each default to `min-width: auto`, and fixing only one left the other
doing it.

## The query stopped narrowing

Before: `filters.search` removed notes, so a search rebuilt every shelf and books vanished.
After: `core.markMatches` scores books that already exist and `applyQuery()` sets `data-match`
on the existing spines. Measured on the demo vault: **182 spines before, during and after** a
query; 6 drew forward and 176 thinned to ghosts. Nothing is rebuilt and nothing is removed.

The check that guards it takes its search term **from the vault it is running against**.
Hard-coding `garden` passed on the demo vault and, on the sparse one — which has no such tag —
asserted that a query finding nothing still drew something forward.

---

## Two bugs a number could not see

Both were found by taking a screenshot while every automated check was green. They are here
because the lesson is the entry.

**A `DEL` byte inside `"-undated"`.** The `UNDATED` constant in `src/core/shelves.ts` carried
an invisible `U+007F` before the hyphen. The key **printed** as `-undated`, sorted last as it
should, and compared **unequal** to the literal `"-undated"` everywhere — so the Undated book
existed, held its 18 notes, and could not be found by name. The failing check reported "18
undated notes, 0 in the Undated book, which sorts at -undated", which is a sentence that
disagrees with itself and took a character-code dump to resolve.

`scripts/check-scope.mjs` now refuses any control character in `src/` or `plugin/`. 13 shipped
files, zero found.

**`[hidden]` losing to a class selector.** `.vault-shelf .reader` and `.vault-shelf .sheet`
set `display: flex` at specificity 0-2-0, which beats the user agent's `[hidden] { display:
none }` at 0-1-0 — so the reader and both dialogs painted over the library at all times, while
the `hidden` **attribute** said otherwise and every check that read the attribute passed. One
screenshot of the plugin in Obsidian showed two dialogs stacked over the shelves.

`.vault-shelf [hidden] { display: none !important; }` settles it, and a new check reads the
**computed style** of all three rather than the attribute.
