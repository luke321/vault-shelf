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
  one row — a plate says what is under it, never what it wishes were under it. **And a plaque
  opens its run as one book**: unique notes across the books under it, addressed
  `shelfId/-plaque-<label>` so a ribbon left in it re-resolves; a plate drawn on two rows opens
  the same book; a plaque-book is never on the shelf, so no address, count or golden moves.
  `design/0019`.
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
- **A favourite is a reference, never a copy.** The shelf at position 0 is a `pick` shelf: it
  classifies nothing and holds the **addresses** of other shelves' books, in the order they were
  dropped, so its label, notes and bands are the source's and are live. `picks` is the only
  list — membership and sequence are one question here — a dead pick is dropped **on save** like
  a manual key, a hidden source still resolves, and the reader is never told a pick shelf
  exists: opening a favourite opens the source book. **Dragging one off the shelf takes it off**,
  and it is bound to a drop rather than to `dragend` so Escape cancels. A pick shelf is a **kind**
  of shelf, not one shelf: the builder makes as many as a person wants, a book may sit on several,
  and every reference is its own. `design/0019`.
- **A book can be made on any shelf arranged by hand, and it is a saved query.** Right-click
  empty rail space, or press the quiet plus where the books end: a name and a `Source` —
  folder, tag, person, the whole vault — held in `Shelf.made` under a key `-made-<slug>` that
  also stands in `picks` (a pick shelf) or `order` (any other manual shelf), so the sequence is
  still one list. The key is fixed at creation, so a rename keeps the address. An automatic
  shelf has no plus and keeps a made book it inherits, sorted last. **A reference is not a place a note
  lives; a made book is**: the reader, the reading places and *also shelved in* skip references,
  never made books. Off the rail means delete, another pick shelf refuses it, a lost source is
  an empty spine rather than a dropped book, and nothing in the vault moves. `design/0020`.
- **A look is paint.** `data-look` picks a stylesheet — `""` the default, `"leather"` the
  other one on offer, `"cyber"` shelved until its redesign but still shipped and still
  measured — and it may repaint anything and move nothing: not a shelf's
  order, not a book's address, not a count, **not a book's size and not a control's** — a
  spine is the same width and height in all three, in a room of the same width, and every
  button, box, tab, ribbon and swatch is the same height, so switching does not move the
  furniture. **Every element's top is the same in every look, and so is its box across the way
  its text runs**; the one thing a face may move is a label's neighbour **along its own row**,
  because a wider face draws wider glyphs and nothing can be done about that. `page.css` owns
  the geometry — a control's, a head's, a plank's, a line box's — and a look sets colour,
  border, shadow and face, plus decoration that is absolutely positioned and so moves nothing.
  A **responsive layout is not a look's**: leather carried a private one below 860px, and below
  that width the two looks were not the same product. `core.LOOKS` is the one list of them, in
  the order the selector offers them (leather first, which is what a fresh library opens in),
  and `migrate` validates against it. `design/0016`, `design/0021`.

## How to work here

- `node scripts/smoke.mjs --only "<substring>"` is the iteration loop. The full suite runs on
  the push to `develop` (the pre-push hook); do not run it by hand unless asked.
- **Two Chromes at once, and two is a ceiling.** `--jobs` clamps to 2 and says so; `--jobs 1` is
  the quiet run, and is what to use beside a recording. Four was the default until github#39, and
  it is the load that hard-restarted the sister repo's machine across six worktrees. **The cap
  costs time and is worth it anyway**: 78 s at four lanes against 90 s at two, before the fixture
  audit took the whole run to 41-43 s. **A check declares which shapes it needs** — `check(name, fn, { on: "demo" })`, or a
  list of fixture names — and **the default is all three**, deliberately the opposite of
  `vault-graph#113`: a forgotten annotation must cost time, not coverage. **A check that returns
  with the page still moving fails**, naming what it left open or in flight. `decisions/0013`.
- **Numbers cannot see.** Every check in the suite asserts a number, and none of them can see
  that something looks wrong. Two real bugs here were found only by taking a screenshot: a
  stray `DEL` byte inside `"-undated"` (printed identically, compared unequal, emptied every
  Undated book) and `[hidden]` losing to a class selector (the reader and both sheets painted
  over the library while every attribute-reading check passed), and a third only because the
  person the plugin is for said "does not remind me of vault graph yet" — a design record had
  claimed palette parity that nobody had ever verified. **Look at it.**
  `node scripts/smoke.mjs --only "<one check>" --shot out.png` writes the library and, beside
  it, `out-reader.png` of an open book — from the same Chrome the checks drive.
- **Two things may not run twice at once, and `scripts/lock.mjs` is the mutex.** **Any suite
  run** drives Chrome over CDP, so two runs fight for a contended GPU and each blames the code;
  and **any harness that places a window** takes over the leftmost display, so a second one —
  here, or a `gdigrab` recording in the sister repo — lands on top of it.

  **A lock names the resource, not the job** (`github#37`, `decisions/0012`): `suite`,
  `screen-left`, `screen-right`, `screen-primary`. `record` is legacy and transitional, kept
  only until the sister repo drops its own alias, and **nothing here takes it** — this repo
  makes no screen recording at all (`design/0007`: the recorder asks the browser for each frame
  over CDP and touches no desktop).

  **`smoke.mjs` takes the `suite` lock itself now** (`github#8`), at startup, and releases it on
  exit and on a signal — so *every* run is covered, including the `--only` iteration loop, which
  is the one nobody ever wrapped. **Do not wrap a suite run in `lock.mjs`**: it would wait for a
  lock its own parent holds. A caller that legitimately holds the lock already — the pre-push
  hook, `release.ps1` — passes `--no-lock`, and nothing else should. A blocked run names who is
  holding it and gives up rather than starting.

  **The same goes for a `git push` to `develop` or `main`, and it is not a suite run you typed,
  so it is the one that gets wrapped by reflex.** `.githooks/pre-push` takes the `suite` lock
  itself around the run it makes and releases it on every way out. Wrap the push in an outer
  acquire/release and the hook's own attempt blocks on yours, and the push hangs until the
  outer lock's stale window expires. The sister repo hit that live, pushing a release
  (`vault-graph@f9a167a`). A plain `git push origin develop` is correctly gated on its own.

  **And the screen is claimed by whatever parks a window on it** (`github#37`), which is every
  one of `smoke.mjs`, `refresh-check.mjs`, `teardown-check.mjs`, `check-data-escape --browser`
  and `update-layout-snapshots.mjs`. Four of the five took no lock at all until now, and the
  fifth's `suite` lock was never about the display. The claim comes from the same call that
  gives a harness its window position, so it cannot be forgotten; `--lock-timeout-ms` says how
  long a blocked run waits before naming the holder and giving up. **There is nothing left to
  wrap by hand.** Driving a window yourself is the one case:

  ```powershell
  node scripts/lock.mjs acquire screen-left --owner "#12 plaques"   # blocks; exit 1 = give up
  node scripts/lock.mjs release screen-left --owner "#12 plaques"
  node scripts/lock.mjs status
  ```

  The lock lives in the OS temp dir under one root for **every sister project** —
  `obsidian-vault-locks` — so a Vault Graph suite and a Vault Shelf suite block each other.
  They did not until 2026-09-10: each repo had its own directory, so each held a lock the
  other could not see and the two ran together anyway. A machine has one Chrome and one
  screen no matter which repository the suite belongs to. The root was never enough on its own:
  contention is by **name**, so until `github#37` a Vault Graph recording on the left screen and
  a Vault Shelf harness on the same screen asked for nothing the other held.
  `--shot` is part of a suite run, so it is inside the lock like everything else.
- **The fixture store is shared and content-addressed, and nothing prunes a sibling.** Every
  worktree resolves the same `.fixtures` through git's common dir, so a fixture directory is
  named after the digest of the generators that built it, and two digests coexist. A run
  collects only what is provably finished with: a fixture older than the refresh window, and an
  abandoned build directory. It used to delete every other digest of a fixture on a miss, which
  pulled the vault out from under five other running suites every time somebody edited a
  generator. `github#8`.
- `git push` and merging into `develop` are separate asks, every time. `main` only ever
  receives `develop`.
- **Which session is the orchestrator is decided by where it stands.** A session opened in the
  main checkout (`C:\git-personal\vault-shelf`, on `develop` or an integration branch) *is* the
  orchestrator, and says so at the start rather than waiting to be told; a session opened in an
  Orca worktree is a worker, and never becomes an orchestrator by finishing well. The checkout
  is the role, so the answer never depends on who remembered to mention it. **And it says so
  in its name**: the orchestrator session is called `vault-shelf-orchestrator`, because a
  sister session with something to say about the shared mutex has to be able to find it in a
  list of sixty. `/rename vault-shelf-orchestrator` at the start, or `claude -n` at launch.
- **Only the orchestrator session pushes to `develop` or cuts a release.** A dispatched
  worktree — an Orca worktree of its own, never a child of the orchestrator's, one per piece of
  work — implements, runs its own gates, and stops at its own branch: it never pushes past that
  branch, never merges into `develop`, and never tags, no matter how clean the result.
  Integrating finished branches and shipping them is the orchestrator's job alone, so one place
  is answerable for what is actually on `develop` and what a release contains. The orchestrator
  itself never implements: it stays on the integration branch, surveys, dispatches, reviews and
  merges. **A merge is always an ask, never an initiative**: "merge N" authorises that one local
  merge and nothing more, the push is its own ask again, and no branch is merged because it
  looks finished. **The rule bites at `git merge`, not at the commit** — not a trial merge, not
  `--no-commit` to see whether it conflicts, not "just to run the suite on it". An unasked merge
  is a mistake the moment it starts, and aborting it is damage control rather than a defence.
  **A worker's handover is a claim, not a verdict** — a green gate table and "stopped at the
  branch" say the worker believes it is done, which is not the same as it being done, and the
  orchestrator has no standing to decide that on its own. **At most six Orca worktrees work at once**: when six are in progress the orchestrator
  spawns nothing more — it files the issue and the brief, and dispatches when one has finished
  and been merged. (Copied from Vault Graph, 2026-09-11; the cap added the same day.)
- **Every issue the orchestrator files carries a label, and "unsure" is a question for Lukas, not
  a reason to skip it.** `gh issue create` without `--label` silently succeeds, so an unlabelled
  issue is never caught at filing time — and unlabelled is what this backlog already is: **31 of
  31 open issues carried no label on 2026-09-11**, which is how a label stops being worth
  filtering on at all. The set is the GitHub default: `bug`, `enhancement`, `documentation`,
  `accessibility`, `question`, plus `duplicate` / `invalid` / `wontfix` for closing. Most work
  here is `bug` or `enhancement`, and the split is about what the issue *claims*: something the
  library already promises and does not do is a `bug`; something it does not promise yet is an
  `enhancement`. **When it is genuinely either — a behaviour that is defensible as designed but
  reads as broken — ask Lukas which, and file after the answer.** Do not guess and do not file
  bare. (Copied from Vault Graph, 2026-09-11.)
- **A release is the range, not the work in hand.** Everything it needs — a `CHANGELOG.md`
  section accounting for every merge since the last tag, every clip it embeds, every doc naming
  the version, the release body itself — is finished on `release/<version>` and read there
  before anything merges down. **Once the tag exists nothing changes**: a fix is the next patch
  version. `.ai-context/releasing.md` opens with the commands that enumerate a range, and it is
  the authority on the flow: every guard `release.ps1` refuses on and why, the dry run on the
  release branch, the pull request to `main` (**the script never pushes the branch, only the
  tag**), the release body's shape, and the `verification-<version>.md` every release owes.
- Measure before and after; the numbers go into `.ai-context/changelog-detail.md`, which is
  the regression suite. A changed constant means `invariants.md` changes in the same commit.
- **One vault, and it is generated.** `scripts/make-vault.mjs` in the shared store — 5,000
  notes over eleven years ending today, every classifier populated, a recent year that is
  genuinely active, a 760-day hole so one calendar year comes out empty, a fifth of the
  non-daily notes undated, and a handful in eleven books at once. It replaced three fixtures
  (`decisions/0014`), which is why nothing here says "the demo vault" any more. Never a real
  vault, never a built `vault-shelf.html`, in anything that reaches the repo.
- **The generator proves its own declaration.** It refuses to finish if a month in the last
  three years is empty, if a week in the last year is empty, if no whole calendar year fell in
  the hole, if a sentinel is missing or if the people tail flattened — the mirror's pattern,
  and every one of them was a real failure first. `--notes` cuts a smaller vault of the same
  shape and the guard still applies, which is what makes a cut below ~1,000 refuse rather than
  quietly stop being the declared vault.
- **Films are shot in that vault too, and a mirror is the opt-in.** `record-demo.mjs` shoots
  the fixture the suite measures; `--mirror-of <path>` still builds a mirror of a real vault —
  same tree, dates and distributions, invented words — and `make-mirror-vault.mjs` still
  refuses to finish if any real string reaches the output, with no skip flag. It is a
  diagnostic you point at your own vault now, not a step in the pipeline. `design/0013`,
  amended by `decisions/0014`.
- **A tree is gated once.** A green full suite run stamps the git tree it measured
  (`scripts/suite-stamp.mjs`, `decisions/0010`); the pre-push hook and `release.ps1` skip the
  suite for a tree that already carries a stamp, and print the stamp they trust. `node
  scripts/suite-stamp.mjs check` says what a push will do before you make it, `list` shows every
  tree this machine has passed, and `release.ps1 -ForceSuite` re-earns one. A partial run
  (`--only`, `--vault`, `--url`, `--look`) and a dirty tree never stamp, which is the point:
  `$env:SKIP_SMOKE=1` leaves no record of what was trusted, and a stamp cannot say "recently" — only
  which tree, measured against which fixtures, and when.
- `npm run lint` holds every finding at zero, and typechecks `src/core` under `strict` first.
  `check-pii`, `check-scope`, `check-network`, `check-comments`, `check-data-escape`,
  `refresh-check --wiring-only` and the two determinism checks gate every push and have no
  skip flag.
- **Three gates drive a browser**, run by hand rather than by the hook: `check-data-escape
  --browser` (a vault whose metadata is markup), `teardown-check` (twenty mount/unmount cycles,
  nothing left behind) and `refresh-check` (the library and an open book follow a changed
  vault). Each claims `screen-left` itself (`github#37`) — the documentation called them
  lock jobs for months while they took no lock at all. The packing is a golden per fixture in
  `scripts/layout-snapshots/`, diffed by the suite and rewritten, deliberately, by
  `node scripts/update-layout-snapshots.mjs`.
- Commit messages are sentences; `Closes #n` on its own line closes the issue when the work
  reaches `develop` — `close-issues.yml` does it, since GitHub itself only resolves a keyword on
  the default branch, which has to stay `main`.

## Where things are

| | |
|---|---|
| `src/core/` | the membership engine (TypeScript, `strict`): eight classifiers, source predicates, ISO-week and month keys, stable addresses, filters, settings migration. Notes in, books out; no DOM |
| `src/page.js` | the page: directory, shelf rails, builder, manage sheet, reading spread — one `mountVaultShelf()`. **Do not read it top to bottom**; open `.ai-context/code-map.md` and go to the line range |
| `src/leather.css`, `src/cyber.css` | the opt-in looks (`design/0016`, `design/0017`): every rule under `.vault-shelf[data-look="leather"]`, off unless the setting says otherwise. `page.css` is the default look and this file never edits it |
| `src/build-shelf.mjs` | the exporter: vault → data → one HTML file. This is what the suite drives |
| `plugin/main.js` | the Obsidian plugin: metadata cache → data → mounts the page in a view |
| `scripts/smoke.mjs` | the invariant suite (Chrome over CDP): **90 checks over the one vault shape** (`decisions/0014`), two lanes, three browsers |
| `scripts/release.ps1` | the local half of a release: the guards, the gates, the tag, the tag push. `-SelfTest` drives every refusal in a throwaway clone; `.ai-context/releasing.md` is the authority on the flow |
| `scripts/suite-stamp.mjs` | which trees have passed the suite (`decisions/0010`), read by the pre-push hook and `release.ps1`. `--selftest` proves the hit and miss cases |
| `scripts/record-demo.mjs` | the demo film: a storyboard driven over CDP, captured frame by frame (`design/0007`) |
| `.ai-context/code-map.md` | **generated**: sections and functions of the two big files, with line numbers |
| `.ai-context/code-index.md` | **generated**: issue → code sites, ADR/DDR → code sites, invariant → check, `__vs.*` → callers |
| `.ai-context/README.md` | the map of the design records: `decisions/` (ADRs, why not the other thing), `design/` (DDRs, how a part works), `invariants.md`, `changelog-detail.md` |
| `CONTRIBUTING.md` | the gates and the branch policy |

Both generated files come from `node scripts/code-map.mjs`; `--check` fails when they are
stale, and the pre-push hook runs it. Comments in the code are pointers (`github#N`,
`decisions/NNNN`, `design/NNNN`); the reasoning behind them is in `.ai-context/`, reached
through the index.
