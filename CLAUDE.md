# Vault Shelf — read this first

An Obsidian plugin (and a standalone exporter used for testing) that turns one vault into a
browsable library: shelves of books built from titles, dates, people, tags, folders or any
note property, read as a two-page spread. **The notes never move.** Shelves and books are
views, so one note can sit on six shelves at once.

Sister repo to [Vault Graph](https://github.com/luke321/vault-graph), and it inherits that
project's expensive lesson: **the recurring failure mode is reasoning about the code instead
of measuring it.** Build the page, drive it, read the numbers.

## Laws — every one has a check in `scripts/smoke.mjs` and a section in `.ai-context/invariants.md`

- **A shelf's note count is unique notes, never the sum of its books.** A note with three
  people is in three books and is still one note.
- **Every note has at least one address.** Nothing a predicate admits may fall off a shelf.
- **A book's address is `shelfId/classifierKey`** and survives a rebuild. A saved reading
  place re-resolves rather than breaking: the named book, else the first visible book that
  still holds the note.
- **Metadata is declared, never inferred, and the file stamp is the floor.** A date comes from
  a property, then a title, then the earliest stamp the filesystem has (`dates.stampOf` — the
  earlier of creation and modification, since a bulk edit moves one and a copied vault moves
  the other). People come from the people property and never from prose. A missing value gets
  its own book (`-undated`, `-unfiled`), never an exclusion. `decisions/0003`, amended.
- **The ISO week keeps its week-year.** 2027-01-01 is 2026-W53.
- **A plaque names the unit above the book**: months and weeks under their year, years under
  their decade, people and tags under their letter. Only when asked for. A plaque lives in the
  same row as the books it names, and a run that wraps is named on every row it reaches. **A
  run is whatever is adjacent**, so a shelf arranged by hand can carry the same label twice in
  one row — a plate says what is under it, never what it wishes were under it.
- **A shelf is a bookcase, not a conveyor belt.** Nothing scrolls sideways; a run too long for
  the room continues on the next row down.
- **A filter narrows; the query marks.** A filter removes notes before books are built. The
  search query never does: every book stays on the shelf and draws forward or thins to a ghost.
- **A filter changes membership and nothing else.** Shelf order and book addresses do not move.
- **A hidden shelf keeps its definition and its books.** Hiding never deletes; hiding
  everything still offers a way back.
- **The page is scoped, in both directions**: every CSS rule under `.vault-shelf`, every id
  and **every class** prefixed `vs-`, every document through `root.ownerDocument`; nothing
  shipped reaches the network. Obsidian's own `app.css` claims `.spread`, and it claimed ours.
- **The twelve colour slots are Vault Graph's**, read from the cascade rather than copied, and
  the theme is whatever the host says it is.
- **A tab is a position in the contents**, so the index is cut the way the book is ordered: an
  Encyclopedia volume is alphabetical inside and gets letters, everything else is in date order
  and gets dates.
- **A book opens on its oldest note, and so does a date shelf.** A notebook that starts on its
  last page reads as if it were written backwards. One toggle in the top bar turns both round;
  a shelf classified by anything else keeps its own A-to-Z. **A shelf can also have no rule**:
  `manual` is the order a person dragged the books into, held as `Shelf.order` — a list of
  classifier **keys**, so it survives a rebuild the way an address does. It moves the sequence
  and nothing else: not an address, not membership, not what is inside a book. A key it does
  not name goes to the end, a key the vault has lost is dropped on save, and the toggle in the
  top bar cannot reach it. `design/0018`.
- **A look is paint.** `data-look` picks a stylesheet — `""` the default, `"leather"` the
  other one on offer, `"cyber"` shelved until its redesign but still shipped and still
  measured — and it may repaint anything and move nothing: not a shelf's
  order, not a book's address, not a count, **not a book's size and not a control's** — a
  spine is the same width and height in all three, in a room of the same width, and every
  button, box, tab, ribbon and swatch is the same height, so switching does not move the
  furniture. `page.css` owns a control's geometry; a look sets colour, border, shadow and face. `core.LOOKS` is the one list of them, in the order the selector offers them
  (leather first, which is what a fresh library opens in), and `migrate` validates against it.
  `design/0016`.

## How to work here

- `node scripts/smoke.mjs --only "<substring>"` is the iteration loop. The full suite runs on
  the push to `develop` (the pre-push hook); do not run it by hand unless asked.
- **Numbers cannot see.** Every check in the suite asserts a number, and none of them can see
  that something looks wrong. Two real bugs here were found only by taking a screenshot: a
  stray `DEL` byte inside `"-undated"` (printed identically, compared unequal, emptied every
  Undated book) and `[hidden]` losing to a class selector (the reader and both sheets painted
  over the library while every attribute-reading check passed), and a third only because the
  person the plugin is for said "does not remind me of vault graph yet" — a design record had
  claimed palette parity that nobody had ever verified. **Look at it.**
  `node scripts/smoke.mjs --only "<one check>" --shot out.png` writes the library and, beside
  it, `out-reader.png` of an open book — from the same Chrome the checks drive.
- **Two things may not run twice at once, and `scripts/lock.mjs` is how you know.** A **screen
  recording** grabs a display region, so a second take captures the first one's window; the
  **full suite** drives Chrome over CDP, so two runs fight for ports and each blames the code.
  Take the lock, do the thing, release it — always release, even on failure:

  ```bash
  node scripts/lock.mjs acquire suite --owner "#12 plaques"   # blocks; exit 1 = give up
  node scripts/lock.mjs release suite --owner "#12 plaques"
  node scripts/lock.mjs status
  ```

  The lock lives in the OS temp dir under one root for **every sister project** —
  `obsidian-vault-locks` — so a Vault Graph suite and a Vault Shelf suite block each other.
  They did not until 2026-09-10: each repo had its own directory, so each held a lock the
  other could not see and the two ran together anyway. A machine has one Chrome and one
  screen no matter which repository the suite belongs to.
  `--shot` is part of a suite run, so it is inside the lock like everything else.
- `git push` and merging into `develop` are separate asks, every time. `main` only ever
  receives `develop`.
- **Only the orchestrator session pushes to `develop` or cuts a release.** A dispatched
  worktree — an Orca worktree of its own, never a child of the orchestrator's, one per piece of
  work — implements, runs its own gates, and stops at its own branch: it never pushes past that
  branch, never merges into `develop`, and never tags, no matter how clean the result.
  Integrating finished branches and shipping them is the orchestrator's job alone, so one place
  is answerable for what is actually on `develop` and what a release contains. The orchestrator
  itself never implements: it stays on the integration branch, surveys, dispatches, reviews and
  merges. "Merge to `develop`" authorises the local merge and nothing more; the push is its own
  ask. **At most six Orca worktrees work at once**: when six are in progress the orchestrator
  spawns nothing more — it files the issue and the brief, and dispatches when one has finished
  and been merged. (Copied from Vault Graph, 2026-09-11; the cap added the same day.)
- **A release is the range, not the work in hand.** Everything it needs — a `CHANGELOG.md`
  section accounting for every merge since the last tag, every clip it embeds, every doc naming
  the version, the release body itself — is finished on `release/<version>` and read there
  before anything merges down. **Once the tag exists nothing changes**: a fix is the next patch
  version. `.ai-context/releasing.md` opens with the commands that enumerate a range.
- Measure before and after; the numbers go into `.ai-context/changelog-detail.md`, which is
  the regression suite. A changed constant means `invariants.md` changes in the same commit.
- Fixtures: three generated vaults (`scripts/make-*-vault.mjs`) in the shared store; never a
  real vault, never a built `vault-shelf.html`, in anything that reaches the repo.
- **Films are shot in a mirror, not in a fixture.** `scripts/make-mirror-vault.mjs` rebuilds a
  real vault's shape — tree, dates, people and tag distributions — with invented words, and
  `record-demo.mjs` builds one automatically from the path in `.mirror-source` (gitignored).
  A fixture is even where a real vault is lopsided, and lopsided is the product. The generator
  refuses to finish if any real string reaches the output; that check has no skip flag either.
  `design/0013`.
- `npm run lint` holds every finding at zero, and typechecks `src/core` under `strict` first.
  `check-pii`, `check-scope`, `check-network`, `check-comments` and the two determinism checks
  gate every push and have no skip flag.
- Commit messages are sentences; `Closes #n` on its own line closes the issue when the work
  reaches `main`.

## Where things are

| | |
|---|---|
| `src/core/` | the membership engine (TypeScript, `strict`): eight classifiers, source predicates, ISO-week and month keys, stable addresses, filters, settings migration. Notes in, books out; no DOM |
| `src/page.js` | the page: directory, shelf rails, builder, manage sheet, reading spread — one `mountVaultShelf()`. **Do not read it top to bottom**; open `.ai-context/code-map.md` and go to the line range |
| `src/leather.css`, `src/cyber.css` | the opt-in looks (`design/0016`, `design/0017`): every rule under `.vault-shelf[data-look="leather"]`, off unless the setting says otherwise. `page.css` is the default look and this file never edits it |
| `src/build-shelf.mjs` | the exporter: vault → data → one HTML file. This is what the suite drives |
| `plugin/main.js` | the Obsidian plugin: metadata cache → data → mounts the page in a view |
| `scripts/smoke.mjs` | the invariant suite (Chrome over CDP), 66 checks over three vault shapes |
| `scripts/record-demo.mjs` | the demo film: a storyboard driven over CDP, captured frame by frame (`design/0007`) |
| `.ai-context/code-map.md` | **generated**: sections and functions of the two big files, with line numbers |
| `.ai-context/code-index.md` | **generated**: issue → code sites, ADR/DDR → code sites, invariant → check, `__vs.*` → callers |
| `.ai-context/README.md` | the map of the design records: `decisions/` (ADRs, why not the other thing), `design/` (DDRs, how a part works), `invariants.md`, `changelog-detail.md` |
| `CONTRIBUTING.md` | the gates and the branch policy |

Both generated files come from `node scripts/code-map.mjs`; `--check` fails when they are
stale, and the pre-push hook runs it. Comments in the code are pointers (`github#N`,
`decisions/NNNN`, `design/NNNN`); the reasoning behind them is in `.ai-context/`, reached
through the index.
