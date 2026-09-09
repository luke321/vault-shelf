# Architecture

Two hosts, one page, one core. Nothing about a particular vault is anywhere in this
repository — a vault goes in at the left, a library comes out at the right.

```
                    ┌──────────────────────────────────────────┐
   a vault  ───────►│ src/build-shelf.mjs   (Node, filesystem) │──┐
   on disk          └──────────────────────────────────────────┘  │
                                                                  ├──►  ShelfData
   Obsidian ───────►┌──────────────────────────────────────────┐  │
   metadata cache   │ plugin/main.js  buildData()              │──┘
                    └──────────────────────────────────────────┘

   ShelfData ──►  src/core/  ──►  shelves, books, membership  ──►  src/page.js  ──►  the DOM
                  (TypeScript, strict)                             (one mount function)
```

## The four pieces

| | |
|---|---|
| `src/core/` | **The only TypeScript.** Notes in, books out: the eight classifiers, the source predicates, the ISO-week and month keys, stable addresses, filters, settings migration. It imports nothing from the page or the plugin and touches no DOM, which is what makes it checkable under `strict` and testable from either host. |
| `src/page.js` | **The library, as one `mountVaultShelf()`.** The directory, the shelf rails, the builder, the manage sheet, the reading spread, the filters. It is handed the core as an option rather than importing it, so each host bundles it its own way. Returns a handle with `refresh`, `setSettings` and `destroy`. |
| `src/build-shelf.mjs` | **The exporter.** Crawls a vault directory, parses frontmatter, and inlines the core, the page, the markup and the data into one self-contained HTML file. This is what the invariant suite drives — it needs no Obsidian and no browser profile of yours. |
| `plugin/main.js` | **The Obsidian host.** Reads the metadata cache (never the filesystem — `decisions/0005`), mounts the same page into an `ItemView`, persists settings through `saveData`, and offers *Edit in Obsidian* back out. |

## The data that crosses the boundary

One shape, produced by both hosts and declared twice — as JSDoc at the top of `src/page.js`
and as `interface Note` in `src/core/types.ts`. The two must agree; a mismatch shows up as a
`no-unsafe-*` error rather than as a wrong shelf, because the page reads the core's own types.

```
ShelfData
  vault      string
  generated  "YYYY-MM-DD HH:mm"
  notes      Note[]     id, path, title, folder, date|null, people[], tags[], props, excerpt, body
  folders    { path, count, slot }[]      slot is the colour index, biggest folder first
  stats      { notes, dated, people, tags }
```

`body` is populated by the exporter and empty from the plugin: inside Obsidian the note is one
click away and re-reading every file to render a preview would be the plugin doing the app's
job. The reader falls back to `excerpt`, and *Edit in Obsidian* is the real answer there.

## Where each decision is enforced

| Decision | Enforced by |
|---|---|
| A book's address is `shelfId/key` and survives a rebuild | `core.bookId`, checked by *book addresses are stable across a rebuild* |
| A shelf's note count is unique notes, not the sum of its books | `core.buildShelf`, checked by *a shelf's note count is unique notes* |
| Nothing is inferred from prose | `core.resolveDate`, `plugin/main.js buildData`, checked by *people come from the property alone* |
| A hidden shelf is still built | `rebuild()` in `src/page.js` — hidden shelves are filtered at render, not at build |
| The page cannot style or be styled by its host | `scripts/check-scope.mjs`, unskippable in the hook |
| Nothing shipped reaches the network | `scripts/check-network.mjs`, unskippable in the hook |
| Note order never depends on the filesystem | `walk()`'s `readdirSync().sort()`, checked by `check-build-order-determinism.mjs` |
| A fixture is the same vault on any day | the seeded PRNG in each generator, checked by `check-generator-determinism.mjs` |

## What the page never does

- **It never writes.** Every settings change goes out through `onSettings` and comes back in
  through `setSettings`; the page keeps no storage of its own (`decisions/0001`). In the
  standalone that host is `localStorage` in `src/shell.html`; in the plugin it is `saveData`.
- **It never reads `document`.** Only `root.ownerDocument`, because a popout window is a
  different document and a listener on the wrong one is a bug nobody can see. `check-scope`
  refuses anything else.
- **It never moves a note.** Shelves and books are views. The files are exactly where the
  person put them, and that is the whole promise.
