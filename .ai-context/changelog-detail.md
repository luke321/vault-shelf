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

## The bar charts came off the books

The spine carried a stacked bar of its folder mix across its head. It is a chart drawn on a
book, which is the least analog thing the room had in it, and on a shelf where most books draw
from the same few folders it is the same rainbow repeated 20 times.

Removed. The colour moved into the board itself, and the **tint had to be measured per theme**
rather than guessed once: rendered at 4/9/14/20 in dark and 18/26/34/44 in light. 4% was
invisible once the bands were gone; 14% in dark reads as dyed cloth; the *same* 14% in light
came out pale pastel, because mixing a hue into white can only lighten toward it. Settled at
**14% dark, 20% light**.

The folder mix itself is unchanged in the data (`core.bandsOf` still computes it) — it now
reaches the reader as the board's colour and as words in the hover peek, rather than as a bar.

## The room got a width

Measured at 2560px wide (a WQHD screen, less Obsidian's ~270px sidebar), before:

| | before | after |
|---|---|---|
| shelf board, Years shelf (4 books) | ~1,800px | 1,180px |
| the reading spread | ~2,000px, note a 380px column at the far left | 1,180px, centred |
| index tabs to the text they index | ~1,500px | adjacent |

`--measure: 1180px`, centred, on the shelves, the rail's contents, the reader bar's contents
and the spread. It is a `max-width`, so at 1,440px and below it does not bind: measured in
Obsidian at a 1,560px window, the room still fills the leaf.

After, at 2560: shelves 1180 (683/698 gutters — the 15px difference is the scrollbar), rail
1180, board 1180, spread 1180 (690/690).

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

## Books got a thickness, and plaques went under the floor

**Thickness.** A spine's width used to be one constant, `--spine-w: 38px`, and the note count
was printed on the spine in 10px type. `design/0011` makes the width the count: log-scaled
between **22px and 58px**, against the largest book in the whole library rather than in the
shelf.

| Vault | Thinnest | Fullest |
|---|---|---|
| demo | 1 note → **26px** | 227 notes → **53px** |
| sparse | 20 notes → **42px** | 189 notes → **57px** |
| library | 309 notes → **45px** | 1,020 notes → **50px** |

The library figures are the argument for the log: on a linear scale its 12 year-books would
span **45px to 50px**… which is what they do anyway, because that vault is deliberately even.
The demo vault's 1-to-227 spread is the case a linear scale ruins, and there it spends the
whole range.

**Plaques.** The shelf floor was the track's `border-bottom`, which made it the last thing in
the box: a plaque could only ever sit *above* it, resting on the books. It is now a background
line painted at `var(--spine-h)`, so the plaque row hangs beneath it the way an engraved plate
is screwed to a shelf edge. Measured on the demo vault: **12px below the books, clearing the
3px floor, width matching to 0px** (was: 5px above, same width).

**The room's width check had to change with them.** It asserted that every `.vs-track` fitted
inside `--measure`, which was true only while books were 38px wide. With real thicknesses the
10k library's first shelf runs to **1321px** — a long shelf, which is not a bug — so the check
now asserts the **scroller** fits (1180px) and clips, and reports the track width it is
clipping.

## A fifteenth month, found by filming a real vault

`scripts/make-mirror-vault.mjs` rebuilds a real vault's *shape* with invented words
(`design/0013`), and `record-demo.mjs` now shoots there by default. The first film made in one
had a Months shelf with a book labelled **"15 2024"**.

The note behind it is real and its frontmatter says `date: 2024-15-01` — a day typed where a
month goes, in a file already named `2024-01-15 …`. Two implementations disagreed about it:

| | `2024-15-01` |
|---|---|
| `core.isIsoDay` (the plugin) | rejected — falls through to the filename, **2024-01-15** |
| `ISO_DAY` in `src/build-shelf.mjs` (the exporter) | accepted — month key **`2024-15`** |

The exporter's regex was `/^\d{4}-\d{2}-\d{2}$/` with no range check. It now evaluates the same
core bundle it inlines into the page and calls `core.resolveDate`, so there is one
implementation of the precedence and one of the validity test. Measured on the mirror: **543
notes, 0 with a month outside 01-12** (was 1).

The sparse fixture gained the two notes that make this checkable — one impossible header with a
date in its filename, one without — and `"an impossible date is not a date, and never a
fifteenth month"` asserts **1 falls through to the filename, 1 is Undated, 0 land anywhere
else**. The suite is 39 checks over three shapes.

### What the mirror preserves

543 real notes in, 543 out, same tree and same dates: **60 folders mapped, 125 people, 142 tag
words, 402 property values, 44 property keys**, and **829 real strings** grepped back out of
every written file with a word-boundary match. A structural folder name (`01 - Projects`) and
the keys this project writes itself are excused by name — **91 words** — because they are kept
on purpose; everything else is a hard failure with no mirror written.
