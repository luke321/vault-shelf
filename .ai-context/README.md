# .ai-context

Context for whoever picks this up next — human or model. Read this folder **before**
changing what a shelf contains or how a book is addressed.

| File | What it is |
|---|---|
| `architecture.md` | The pipeline, the data shapes, and where each decision is enforced |
| `invariants.md` | Properties that must not regress, and the command that checks each one |
| `changelog-detail.md` | What was measured, per change. The regression suite in prose |
| `releasing.md` | The two halves of a release, and what has to be finished before the tag exists |
| `verification-<version>.md` | Per release: what was run, what was looked at, what changed against the reference, and what was not verified |
| `original-brief.md` | The founding brief, verbatim, with a table saying where each of its six open decisions was settled |
| `decisions/` | **ADRs** — structural choices, what they cost, and what was rejected |
| `design/` | **DDRs** — the as-built design of each part of the library |
| `code-map.md` | **Generated** (`node scripts/code-map.mjs`): sections and functions of `src/page.js` and `scripts/smoke.mjs` with line numbers. Open the range, not the file |
| `code-index.md` | **Generated**: issue → code sites, ADR/DDR → code sites, invariant → check, `__vs.*` → callers |

### ADRs — `decisions/`

| | |
|---|---|
| `0001-settings-are-the-hosts-and-schema-is-migrated` | Where a shelf definition lives, and why the page stores nothing |
| `0002-a-book-has-a-stable-address` | `shelfId/key`, and why not an index or a generated id |
| `0003-metadata-is-declared-never-inferred` | Dates, people and tags come from properties; nothing is guessed from prose |
| `0004-declared-fixtures-not-a-real-vault` | A declared vault, generated on demand, keyed by generator digest, day-independent. Amended by `0014` |
| `0005-the-plugin-reads-the-metadata-cache` | Not the filesystem, and what that costs |
| `0006-zero-network-calls` | Both artifacts are offline objects, and the check that keeps them so |
| `0007-comments-are-pointers` | Why the reasoning lives here and not in the code |
| `0008-one-browser-per-run` | Why the suite takes a free port per run |
| `0009-the-docs-site-is-a-live-demo` | Why `docs/` is a Pages site with a real export in it, why the export is built from the fixture rather than the mirror, and the one rule that bends |
| `0010-a-tree-is-gated-once` | A green suite run stamps the tree it measured; what the stamp keys on, what it refuses to record, and what it actually saves here |
| `0011-the-suite-holds-its-own-lock` | Why the mutex stopped being caller discipline, and why a fixture directory is never deleted because a sibling appeared |
| `0012-lock-the-screen-not-the-job` | Why a lock is named after the display it takes over rather than the activity, what the claim-and-return shape buys over handing back a name, and how a hold proves it is still alive |
| `0013-two-chromes-and-a-check-says-what-it-needs` | Why the suite caps at two browsers where the sister repo went to one, why a check declares the shapes it needs, and why a check that leaves the page moving fails |
| `0014-one-vault-for-the-checks-and-the-film` | Four generated vaults become one: what the one vault had to absorb to replace three, what was given up, why the film stopped being shot in a mirror, and what `0013`'s per-shape narrowing means once there is one shape |
| `0015-the-suite-owns-its-own-focus` | Why the suite takes the focus of the window it drives, and sends real keys rather than synthetic events |
| `0016-the-runner-drains-the-room-before-it-blames-a-check` | Why a pending room measure is the runner's to wait out, not the check's to be failed for |
| `0017-a-gate-carries-its-own-negative-controls` | Why the scope gate parses CSS rather than lines, why a construct it cannot judge is refused rather than skipped, and why its planted shapes run on every invocation instead of behind a flag |

### DDRs — `design/`

| | |
|---|---|
| `0001-the-note-record` | What a note is reduced to before anything shelves it |
| `0002-shelves-books-and-the-builder` | Two questions, eight classifiers, and the live preview |
| `0003-year-plaques` | Why the plaque is inside the scroller, and when it is not drawn at all |
| `0004-the-reading-spread` | The two pages, the index tabs, the reading table, and cross-shelf history |
| `0005-colour-and-the-theme` | Vault Graph's own tokens, read from the cascade; the theme is the host's; why every class is prefixed |
| `0006-the-harness` | Where a driven browser goes, and the mutex two of them share |
| `0007-the-recorder` | Why the demo is captured frame by frame over CDP rather than recorded off a screen |
| `0008-the-magic` | Shelf wear, ribbons that hang, and the shelf parting as you type |
| `0009-the-room` | No sidebar: the library is the surface, and New shelf is at both ends of it |
| `0010-the-note` | Obsidian's own markdown renderer, and why that is not a filesystem read |
| `0011-thickness-is-the-note-count` | A spine's width is a measurement of the book, log-scaled against the library |
| `0012-the-reader-is-a-book` | Four pieces of geometry that make a spread an open book, and none of them a texture |
| `0013-the-mirror-vault` | The mirror of a real vault: what it preserves, what it replaces, and the guard that has no skip flag. No longer the film's vault (`decisions/0014`) |
| `0014-the-bookcase` | Rows instead of a horizontal scroller: why the packing is arithmetic, and how a plaque earns its width |
| `0015-the-index` | The tabs are cut the way the book is ordered, and as deep as its titles need |
| `0016-the-leather-look` | The opt-in leather binding: why a texture is allowed once it stops claiming to follow the theme |
| `0017-the-cyber-look` | The third look, and the selector that picks it: neon is the light in the room, never the paint on the objects |
| `0018-the-manual-shelf` | A shelf with no rule: the order a person dragged the books into, stored as keys, and what a plaque means once a run is whatever is adjacent |
| `0019-a-plaque-opens-its-run` | Clicking a plate opens the run under it as one book of unique notes, with an address of its own; why open rather than narrow, and why an address rather than none |
| `0019-the-favourites-shelf` | The shelf at the top that holds references to other shelves' books: why a favourite is an address rather than a copy, and why the reader is never told about it |
| `0020-a-book-made-on-the-shelf` | A book made on a pick shelf by right-clicking empty space: a saved query with an address of its own, why it is a place a note lives when a reference is not, and why off the rail means delete |
| `0021-one-geometry-three-faces` | Where the line between a face and a box falls, the audit of every geometry and part declaration in the two look sheets, and the walk over every element that replaced a list of 38 named controls |
| `0022-a-hovered-swatch-paints-the-room` | A hovered colour previews on the library itself, not in a sample: what the trial object is, and why a preview may paint and nothing else |
| `0023-the-update-note` | The strip the plugin shows once after a MINOR or MAJOR: the note's grammar, the decision table, why the chain is parsed out of the CHANGELOG at build time, and why the marker cannot live in the core's settings |
| `0029-leather-spine-bindings` | Five leather bindings beside colours, preserved Original, deterministic series and persisted demo settings |

**ADR or DDR?** An ADR is a choice with alternatives that were weighed and one that won —
it explains *why not the other thing*. A DDR describes how a part actually works and the
measurements that shaped it. If you are about to change behaviour, the ADR tells you what
you would be giving up; the DDR tells you what you would be breaking.

## Why this folder exists

Vault Shelf is the sister of [Vault Graph](https://github.com/luke321/vault-graph), and it
inherits that repo's expensive lesson: **the recurring failure mode is reasoning about the
code instead of measuring it.** Every hard bug there had the same shape — a plausible
explanation that was wrong, fixed confidently, then a new symptom, because the real cause was
a number nobody had looked at.

The habit that works: **build the standalone page, drive it, and read the numbers.** Most of
that is one command — `node scripts/smoke.mjs` runs every invariant that can be checked
automatically and prints what it measured. What it cannot cover, it says so.

It runs itself before every push, once per clone:

```bash
git config core.hooksPath .githooks
```

`SKIP_SMOKE=1 git push` when you mean to skip it — there are honest reasons to, and the
alternative habit (`--no-verify`) silently disables every other hook too.

By hand, for the rest — build a page and open its console:

```bash
node scripts/make-demo-vault.mjs
node src/build-shelf.mjs --vault ./demo-vault --out ./vault-shelf.html
```

```javascript
__vs.counts()             // notes, shelves, books, spines and plaques on screen
__vs.checkMembership()    // unique notes per shelf vs what the shelf claims
__vs.addresses()          // every book's stable address, in order
__vs.sequence("people")   // one shelf's books in the order they stand, as keys (design/0018)
__vs.pick("years/2024")   // drop a book onto Favourites; __vs.unpick() takes it off (design/0019)
__vs.makeBook("favourites", { name: "Dailies", source: { kind: "folder", value: "Dailies" } })
                          // a book made on the shelf; __vs.editBook() and __vs.unmakeBook() (design/0020)
__vs.setFilters({ search: "garden" })
__vs.openBook("months/2026-09", null)
__vs.setQuery("garden")   // the shelf parts; nothing is removed
__vs.typeQuery("gard")    // as if typed: marks AND offers the list (github#41, design/0026)
__vs.suggest()            // what the box is offering right now, and which row is active
__vs.vocabulary()         // every term the vault spells, with its kinds and note count
__vs.magic()              // wear, ribbons, what drew forward and what went to ghosts
__vs.slots()              // the twelve colour slots, as the cascade resolved them
__vs.setTheme("light")    // light and dark are Vault Graph's own
__vs.setListMode(true)    // the assistive-technology view
```

## The rule

If a change is about **what a shelf contains or where a book lives**, it needs a number
before and after. The entries in `changelog-detail.md` carry those numbers on purpose — they
are the regression suite.

- [0030 ? Contents order](design/0030-contents-order.md): reader switch, saved shelf/book defaults, and book creation pickers.

- [0031 - Picker and reader controls](design/0031-picker-and-reader-controls.md): two-row palette, Minimal binding, ribbon cuts, persistent title bar and Manage layout.

- [0032 - Compressing index and shelf actions](design/0032-compressing-index-and-shelf-actions.md): fixed search/order controls, fitting tabs and inline gear/eye buttons.

- [0033 - Age and reading wear](design/0033-age-and-reading-wear.md): older books start worn without inventing opening history; recent notes keep active collections fresh.

- [0034 - The thumb index](design/0034-the-thumb-index.md): a cut is a tree and the rail lists one level of it, under the trail it came through; fit is measured, not calculated.

- [0035 - A volume of numbers](design/0035-a-volume-of-numbers.md): a third contents mode that reads digits as numbers, offered in the A-Z slot where every note opens with one.

- [0036 - The CSS floor is measured](design/0036-the-css-floor-is-measured.md): a linter's browser-support table is not evidence; a real Obsidian is, and four of five warnings were noise.
