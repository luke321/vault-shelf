# Vault Shelf — read this first

An Obsidian plugin (and a standalone exporter used for testing) that turns one vault into a
browsable library: shelves of books built from titles, dates, people, tags, folders or any
note property, read as a two-page spread. **The notes never move.** Shelves and books are
views, so one note can sit on six shelves at once.

Sister repo to [Vault Graph](https://github.com/luke321/vault-graph), and it inherits that
project's expensive lesson: **the recurring failure mode is reasoning about the code instead
of measuring it.** Build the page, drive it, read the numbers.

## Laws — every one has a check in `scripts/smoke.mjs` and a section in `.ai-context/invariants.md`

- **A shelf's note count is unique notes, never the sum of its books.** A note in three books
  is still one note.
- **Every note has at least one address.** Nothing a predicate admits may fall off a shelf.
- **A book's address is `shelfId/classifierKey`** and survives a rebuild. A saved reading
  place re-resolves: the named book, else the first visible book still holding the note.
- **Metadata is declared, never inferred.** A date comes from a property, then a title, then
  the earliest file stamp; people come from the people property, never prose; a missing value
  gets its own book, never an exclusion (`decisions/0003`).
- **The ISO week keeps its week-year.** 2027-01-01 is 2026-W53.
- **A plaque names the unit above the book** (months/weeks→year, years/people/tags→decade or
  letter), only when asked, in the same row as its books — **a run is whatever is adjacent**, so
  a hand-arranged row can carry the same label twice. **It opens its run as one book** of unique
  notes at `shelfId/-plaque-<label>`; the plaque itself gets no address, count or golden
  (`design/0019`).
- **A shelf is a bookcase, not a conveyor belt.** Nothing scrolls sideways; a run too long for
  the room continues on the next row down.
- **A filter narrows; the query marks.** A filter removes notes before books are built; the
  query never does — every book stays on the shelf, drawing forward or thinning to a ghost. It
  matches on title, on the **cover** of any book a note sits behind, or on declared metadata
  (tags, people, folder) — never body or path — against one search index built once per
  rebuild, never per keystroke (`design/0008`, `design/0026`).
- **A marked book says why, and its own find box never denies it.** `core.matchReasons` mirrors
  `matchesQuery` exactly, and *Find within this book* narrows by that same function, so a book
  can never show a match the shelf can't explain, or deny one it does (`design/0008`,
  `design/0027`).
- **A filter changes membership and nothing else.** Shelf order and book addresses do not move.
- **A hidden shelf keeps its definition and its books.** Hiding never deletes; hiding
  everything still offers a way back.
- **The page is scoped, in both directions.** Every CSS rule under `.vault-shelf`, every id and
  class prefixed `vs-`, every document through `root.ownerDocument`; nothing shipped reaches
  the network (`design/0005`).
- **The first twelve colour slots are Vault Graph's**, read live from the cascade, never
  copied; two brighter slots extend the picker to fourteen (`design/0029`). The theme is
  whatever the host says it is.
- **A tab is a position in the contents.** Encyclopedia/Tags default A-Z, others date; pickers
  can override either, and the switch below search changes both together (`design/0030`).
- **A book opens on its oldest note, and so does a date shelf.** Pickers choose A-Z or Date
  (`design/0031`); a shelf can also run **manual** — a dragged sequence held as classifier
  **keys** in `Shelf.order`, surviving a rebuild, dropping a lost key on save, sending an
  unlisted one to the end (`design/0018`).
- **A favourite is a reference, never a copy.** Position 0 can be a `pick` shelf — a **kind** of
  shelf, not a single one — holding **addresses** of other shelves' books, live. Taking one off
  is bound to `drop` not `dragend` (Escape cancels); a dead pick drops on save; the reader never
  knows a pick shelf exists, so opening a favourite opens the source book (`design/0019`).
- **A book made on a hand-arranged shelf is a saved query.** Right-click empty rail space, or
  the quiet plus at the row's end, for a name and `Source`; its key `-made-<slug>` is fixed at
  creation, so renaming keeps the address. **A reference is not a place a note lives; a made
  book is** — the reader, reading places and *also shelved in* skip references, never made
  books. A lost source is an empty spine, not a dropped book (`design/0020`).
- **A look is paint.** `data-look` picks a stylesheet — `"leather"` the only offered look
  (`design/0029`) — and may repaint anything but move nothing: not a shelf's order, a book's
  address, count or size, or any control's size. `page.css` alone owns geometry; `core.LOOKS` is
  the one list `migrate` validates against (`design/0016`, `design/0021`).

## How to work here

- `node scripts/smoke.mjs --only "<substring>"` is the iteration loop. The full suite runs on
  the push to `develop` (the pre-push hook); do not run it by hand unless asked.
- **Two Chromes at once, and two is a ceiling.** `--jobs` clamps to 2 and says so; `--jobs 1` is
  the quiet run, and is what to use beside a recording (`github#39`). **A check declares which shapes it needs** — `check(name, fn, { on: "demo" })`, or a
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

  **`suite` and a display are separate names, and must stay separate.** `smoke.mjs` takes `suite`
  and *then* `screen-left`, so aliasing the two together would hang every run against its own
  hold — the sister repo is one nested acquire from the same fault. `aliasHold()` exempts its own
  asker so the hazard cannot be reintroduced by accident, but **do not add a `suite`↔screen alias**
  (`github#43`). A hold from the sister repo is judged by the pid its **owner string** names, never
  by the `pid` it recorded — theirs belongs to a subprocess that exits at once, so trusting it
  would break a live vault-graph run off the display (`github#52`, `invariants.md`).

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
  outer lock's stale window expires (`vault-graph@f9a167a`). A plain `git push origin develop`
  is correctly gated on its own.

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
  `obsidian-vault-locks` — so a Vault Graph suite and a Vault Shelf suite block each other. A
  machine has one Chrome and one screen no matter which repository the suite belongs to; and
  contention is by **name** (`github#37`), so `--shot` is part of a suite run and is inside the
  lock like everything else.
- **The fixture store is shared and content-addressed, and nothing prunes a sibling.** Every
  worktree resolves the same `.fixtures` through git's common dir, so a fixture directory is
  named after the digest of the generators that built it, and two digests coexist. A run
  collects only what is provably finished with: a fixture older than the refresh window, and an
  abandoned build directory. `github#8`.
- `git push` and merging into `develop` are separate asks, every time; only the orchestrator
  does either. `main` only ever receives `develop`. (Orchestrator role and rules: `~/.claude/CLAUDE.md`;
  dispatch/merge/cleanup mechanics: the `orchestrator-brief` skill.)
- **Every issue the orchestrator files carries a label, and "unsure" is a question for the
  maintainer, not a reason to skip it.** `gh issue create` without `--label` silently succeeds,
  so an unlabelled issue is never caught at filing time. The set is the GitHub default: `bug`,
  `enhancement`, `documentation`, `accessibility`, `question`, plus `duplicate` / `invalid` /
  `wontfix` for closing. Most work here is `bug` or `enhancement`, and the split is about what
  the issue *claims*: something the library already promises and does not do is a `bug`;
  something it does not promise yet is an `enhancement`. **When it is genuinely either — a
  behaviour that is defensible as designed but reads as broken — ask the maintainer, or raise it
  on the issue, and file after the answer.** Do not guess and do not file bare. (Copied from
  Vault Graph, 2026-09-11.)
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
  non-daily notes undated, and a handful in eleven books at once (`decisions/0014`). Never a
  real vault, never a built `vault-shelf.html`, in anything that reaches the repo.
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
