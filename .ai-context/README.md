# .ai-context

Context for whoever picks this up next — human or model. Read this folder **before**
changing what a shelf contains or how a book is addressed.

| File | What it is |
|---|---|
| `architecture.md` | The pipeline, the data shapes, and where each decision is enforced |
| `invariants.md` | Properties that must not regress, and the command that checks each one |
| `changelog-detail.md` | What was measured, per change. The regression suite in prose |
| `releasing.md` | The two halves of a release, and what has to be finished before the tag exists |
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
| `0004-declared-fixtures-not-a-real-vault` | Three generated vaults, keyed by generator digest, day-independent |
| `0005-the-plugin-reads-the-metadata-cache` | Not the filesystem, and what that costs |
| `0006-zero-network-calls` | Both artifacts are offline objects, and the check that keeps them so |
| `0007-comments-are-pointers` | Why the reasoning lives here and not in the code |
| `0008-one-browser-per-run` | Why the suite takes a free port per run |
| `0009-the-docs-site-is-a-live-demo` | Why `docs/` is a Pages site with a real export in it, why the export is built from the fixture rather than the mirror, and the one rule that bends |

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
| `0013-the-mirror-vault` | Why a film is shot in a mirror of a real vault rather than in a fixture |
| `0014-the-bookcase` | Rows instead of a horizontal scroller: why the packing is arithmetic, and how a plaque earns its width |
| `0015-the-index` | The tabs are cut the way the book is ordered, and as deep as its titles need |
| `0016-the-leather-look` | The opt-in leather binding: why a texture is allowed once it stops claiming to follow the theme |
| `0017-the-cyberpunk-look` | The third look, and the selector that picks it: neon is the light in the room, never the paint on the objects |
| `0018-the-manual-shelf` | A shelf with no rule: the order a person dragged the books into, stored as keys, and what a plaque means once a run is whatever is adjacent |
| `0019-the-favourites-shelf` | The shelf at the top that holds references to other shelves' books: why a favourite is an address rather than a copy, and why the reader is never told about it |

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
__vs.setFilters({ search: "garden" })
__vs.openBook("months/2026-09", null)
__vs.setQuery("garden")   // the shelf parts; nothing is removed
__vs.magic()              // wear, ribbons, what drew forward and what went to ghosts
__vs.slots()              // the twelve colour slots, as the cascade resolved them
__vs.setTheme("light")    // light and dark are Vault Graph's own
__vs.setListMode(true)    // the assistive-technology view
```

## The rule

If a change is about **what a shelf contains or where a book lives**, it needs a number
before and after. The entries in `changelog-detail.md` carry those numbers on purpose — they
are the regression suite.
