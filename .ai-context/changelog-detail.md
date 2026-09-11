# Changelog detail

## 2026-09-11 — The contents follow the jump

> github#11: "when I click an index tab on the right, the index on the left should also move a
> marker there and scroll".

**The marker moved and the list did not.** `goTo()` set `reader.noteId` and `renderContents()`
put `aria-current` on the right row, but `.vs-page.vs-left` is `overflow-y: auto` and nothing
ever set its `scrollTop`, so on the demo vault's biggest book — `people/-unfiled`, 199 notes —
clicking the last tab left the marked row **3,398px** below the fold. From where the reader
sat, the tab had done nothing.

`revealCurrent()` runs at the end of every `renderContents()` and scrolls the left page to the
marked row by the **smallest move that brings it in**: a row already in view is left alone; one
below the fold comes up so it sits one row's height inside the bottom edge; one above comes
down the same way. Never centred, so turning one page does not jerk the whole list; never
`scrollIntoView()`, which walks every scrolling ancestor and inside Obsidian those are the
app's own. Smooth unless `prefers-reduced-motion` says otherwise, in which case the position is
set outright. And **only when the note changed**: `reader.revealed` holds the note the list was
last brought to, so a re-render for the find-within box — which calls the same function —
cannot pull the list out from under somebody who has scrolled it by hand.

Measured, one new check on all three shapes (last tab → Previous → a ribbon followed from the
far end):

| shape | biggest book | tab | scrollTop before → after | Previous | ribbon back |
|---|---|---|---|---|---|
| demo | `people/-unfiled`, 199 notes, 16 tabs | `2026` → row 147 | **0 → 3398** | row 146, 3398 | row 0, 120 |
| sparse | `people/-unfiled`, 501 notes, 5 tabs | `2026` → row 383 | **0 → 9431** | row 382, 9431 | row 0, 120 |
| 10k library | `people/-unfiled`, 6,937 notes, 11 tabs | `2026` → row 6461 | **0 → 164800** | row 6460, 164800 | row 0, 120 |

Exactly **1** row marked in every case, at the index the tab named; the marked row's box inside
the page's box in every case. The ribbon lands at 120 rather than 0 because row 0 comes into
view one row inside the edge and the book's title, count and search box above it are what
stays out of sight — the smallest move, not the top of the page.

**The marker reads as a marker now.** A current row was `color` and `font-weight: 600` in the
default look and vanished on a dense index of forty rows in one face. It carries an inset
**3px** bar in `--accent` and an 8% tint of the same, which is paint (an inset shadow moves
nothing) and what the leather look already did in its own oxblood. Cyber keeps its neon colour.

The suite gained `--shot-book biggest|<address>` and `--shot-tab last|<n>` so the picture of a
long book after a late tab is a flag rather than a hand. 71 checks per shape.

## 2026-09-11 — Four gates Vault Graph had and this repo did not, and the two bugs they found

> github#5: "Gates Vault Graph has and we do not" — `check-data-escape`, `teardown-check`,
> `refresh-check`, layout snapshots.

**A note's own words were markup.** The exporter wrote
`window.VAULT_DATA=${JSON.stringify(data)}` into a `<script>` block, and JSON is not
script-safe: `JSON.stringify` escapes quotes and backslashes and passes `<`, `>` and the two
Unicode line separators straight through. A note titled `</script>` therefore closed the data
block, and everything the vault said after it was parsed as markup — in a page built from
anybody's vault and shipped as one HTML file you can mail to somebody. Measured on a two-note
hostile vault: **9 raw `<` and 10 raw `>`** in the data. `jsonForScript()` escapes all four to
their `\u` form, which `JSON.parse` reads straight back, so the data is identical and the block
cannot be closed. After: **0** of each, **1,173 characters** of `VAULT_DATA`, **4** script tags
in the file and **4** script elements in the DOM, **0** `<img>`, **0** `<svg>`, **0 of 5**
payload markers executed, **0** console errors, and `__vs.data()` in the live page byte for
byte identical to the block the exporter wrote.

The hostile vault is built by the check rather than by a fixture generator: a tag that closes a
script, a person who is an `<img src=x onerror=…>`, a property beginning `"]]>`, a body with a
lone U+2028, a title carrying `${…}`. **Windows forbids `<` and `>` in a filename**, so the
note whose filename is markup is written only where the filesystem allows it and the
frontmatter payloads carry the rest. The static half is in the pre-push gate list and also
refuses a bare `JSON.stringify(data)`, so the escaping cannot be quietly walked back.

**The library did not follow the vault.** `plugin/main.js` rebuilt only when somebody ran its
Rebuild command: a note written, renamed or deleted while the library was open left the shelves
as they were. It listens now for the metadata cache's `changed` and `deleted` and the vault's
`rename`, all three through one timer — `REBUILD_MS` **400ms** — because a sync or a bulk edit
fires `changed` per file and every rebuild walks every note and repacks every shelf.

`refresh-check.mjs` proves that without an Obsidian: it builds the plugin bundle, loads it with
`obsidian` stubbed — a fake app whose metadata cache and vault are event emitters — and drives
the real scheduler. **14 changes inside 50ms → 0 rebuilds during the burst and exactly 1 after
it**; a later change → **1** more; a change caught mid-flight by `unload` → **0**.

**And its browser half found the second bug.** `refresh()` restored the open book by **row
number**: `reader.index` was clamped to the rebuilt book's length and whatever note now sat at
that index was drawn. Add a note to the book you are reading and the note that sorts into your
position takes your place. Measured on the Years 2011 book of the demo vault: 2 notes became 3
and the spread moved off the note being read onto `Refresh Probe`. A reading place is a note
now (`reader.noteId`), and the row number is only the fallback for a note the rebuild removed —
which is the same rule the saved reading place already followed. After the fix: **396 → 397
notes**, the open book **2 → 3**, its shelf **396 → 397**, its contents **2 → 3 entries** with
exactly **1** naming the new note, the reader still on its own note, every number back where it
started when the note is taken away again, and **0** console errors throughout.

**Nothing is left behind.** `teardown-check.mjs` mounts, destroys the way the plugin's
`onClose()` does and mounts again, **20 times**, counting from devtools rather than from
argument: `getEventListeners` for what is on `document` and `window`, `Memory.getDOMCounters`
for nodes and listeners, `Runtime.getHeapUsage` after two forced collections. Each cycle
dispatches a `resize` first, so `watchRoom`'s **60ms** repack timer is pending when the destroy
lands — and the check asserts it was, so it cannot pass by testing nothing. Measured on the
demo vault, 198 spines every cycle: nodes **3,370 → 3,370**, JS listeners **2,446 → 2,446**,
`document` **3**, `window` **1**, heap **1.6 → 1.7 MB** (0.005 MB a cycle against a bound of
1.5), and after every destroy **0** nodes inside the root, **0** `.vault-shelf` nodes in the
document, **0** live timers and no `window.__vs`. It found nothing, which is the result a
teardown check wants and the reason to have written it before it was needed.

**The packing is a diff now, not a feeling.** `scripts/layout-snapshots/<fixture>.json` holds,
per shelf, how many rows and books, every plaque's text and box, and the first and last spine's
address and box, measured at a viewport pinned to **1180×900** — the suite's own window is
whatever a grid slot gave it, and geometry read at an accidental width is not comparable to
anything. Every box is relative to its own shelf, and a shelf is scrolled into view before it
is read, because `content-visibility: auto` skips one that is off screen and a skipped shelf
measures nothing at all. Exact on rows, books, counts and names; **2px** of tolerance on a box,
which is where text metrics live, while the packing above it is arithmetic. Seeded at a
**1125px** room: demo **8 rows / 198 spines / 40 plaques**, sparse **6 / 77 / 19**, library
**10 / 186 / 33**. `node scripts/update-layout-snapshots.mjs` rewrites all three, deliberately
and with a reason in the commit.

**Looked at, not only counted.** The suite ran **67/67 on all three shapes** with `--shot`, and
both pictures were opened: the library in leather with its plaques under their runs and nothing
running off the right edge, and a book open at a note with its contents, its ribbons and its
index tabs. Two new gates joined the pre-push list — `check-data-escape` and
`refresh-check --wiring-only`, both static, both unskippable; the three that drive a browser
are suite-lock jobs, run by hand.

## 2026-09-11 — The suite takes its own lock, and stops deleting other worktrees' fixtures

> github#8: "workers are not honoring our locks I think"

Two faults with one symptom — parallel worktrees corrupting each other's measurements, and the
failures looking like code bugs.

**The mutex was never in the suite.** `scripts/lock.mjs` has existed since `design/0006` and two
documents told a person to wrap a run in it, but `grep -n lock scripts/smoke.mjs` matched one
unrelated comment line. The command the iteration loop is made of — `--only "<substring>"` — is
the one nobody wraps. Six worktrees were live when this was filed.

`smoke.mjs` acquires `suite` itself now, after the `--only` spelling is checked and before the
store is touched or any Chrome starts, and releases on exit, on a throw and on a signal. Driven,
not reasoned about:

| run | result |
|---|---|
| `--only` while `vault-graph-86` held the lock, `--lock-timeout-ms 15000` | `WAITING ... held by vault-graph-86 for 13s`, `BUSY ... gave up after 15s`, exit 1, **no Chrome started** |
| the same run, lock free | waited 54 s for the sister repo's suite, then `ACQUIRED`, ran, `RELEASED` |
| a throw after acquiring (`--chrome C:/nope/chrome.exe`) | `ACQUIRED` → `RELEASED`, exit 1 |
| `--no-lock` while `test-holder` held it | ran 1/1 × 3 shapes; `test-holder`'s lock still held afterwards |
| `--only nothing-matches-this` | refused before the lock |

The two callers that legitimately hold the lock already — the pre-push hook and `release.ps1` —
pass `--no-lock`. Without that they would have waited for a lock their own parent held until the
timeout ran out, so the refusal text names that case explicitly.

**The store deleted the vault other runs were reading.** `storeRoot` is `git rev-parse
--git-common-dir`, so all six worktrees share `C:\git-personal\vault-shelf\.fixtures`, and on a
miss `gen()` removed every other `<name>-*` directory — including one another worktree's Chrome
had open. The digest is sha256 over the three generator sources, so github#7, which is editing a
generator, produced a new digest on every save and wiped the store for the other five on every
run; their next runs regenerated and wiped it again.

Nothing prunes by name now. Measured by seeding the shared store and forcing a miss (run twice,
once against each version of the collection rule):

| seeded | wanted | got |
|---|---|---|
| `demo-vault-deadbee1`, stamp dated today, with a marker file | survives | survived, marker intact |
| `demo-vault-deadbee2`, stamp dated 30 days ago | collected | collected |
| the real `demo-vault-5bd2a221`, stamp backdated 30 days, marker added | rebuilt | stamp day `2026-09-11`, marker gone |

The third row is the trap: the first draft skipped the same-digest directory in the prune, which
also made the **weekly refresh** unable to replace it — a fixture would have gone stale for ever
while reporting itself fresh. Publishing now separates a fresh same-digest directory (another run
published first: keep theirs, drop ours) from a stale one (rename aside, replace, delete), and
never renames onto an existing path, which on Windows throws rather than replacing.

### Gates

| | Before | After |
|---|---|---|
| `grep -n lock scripts/smoke.mjs` | 1 unrelated comment | the suite takes and releases it |
| `check-comments` baseline | 1096 | 1096 (new comments are bare pointers) |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| `smoke.mjs --only` one check, three shapes | 1/1 × 3 | 1/1 × 3 |

## 2026-09-11 — A tree is gated once, and every release guard has been seen to fire

> github#5, the first two groups: "Release guards and flow" and "Suite economics"

### What a run actually costs here

Measured under the `suite` lock on the reference machine, warm (no fixture regeneration),
`smoke.mjs` exit 0, 66/66 on all three shapes:

| | |
|---|---|
| full run, 198 checks (66 × 3 shapes) | **39.0 s** |
| the same run cold, regenerating all three fixtures | 43 s |
| the three builds | 7.7 s — demo 0.46 s, sparse 0.70 s, **10k 6.5 s** |
| parallel lane: 12 shards of 53 checks over 4 Chromes | ~6 s of summed check time |
| serial lane: 3 jobs of 13 layout-reading checks, one Chrome at a time | **22 s** (7 + 6 + 9) |
| the six static gates + the code map | 2.95 s |
| lint (`tsc --noEmit` over `src/core`, then typescript-eslint) | 4.0 s |
| Chrome launches per run (one per job, `decisions/0008`) | 15 |

**The serial lane is 79% of the check time**, the same shape as the sister repo's 76%, but the
absolute total is 39 s against its 587 s: there is no WebGL cascade here to animate. So the
stamp saves **about 78 s a release** (the three runs one tree was going to pay), not the twenty
minutes it saves next door. The record says so rather than inheriting a number, and
`decisions/0010` says why it was still worth doing: what it replaces is `SKIP_SMOKE=1`, which
leaves no evidence of what was trusted.

### The stamp, driven end to end

The hook was run with the ref lines git hands a `pre-push` hook, which is the only way to
measure the decision it actually makes:

| push fed to the hook | what it did | wall |
|---|---|---|
| one stamped sha to `develop` | named the stamp — `tree 9bc801f ... (198 checks, commit 59cc4ae, fixtures demo-vault@2026-09-11 sparse-vault@2026-09-11 library-vault@2026-09-11)` — and skipped the suite | **7.5 s** |
| one stamped sha to `develop` **and** one unstamped to `main` | named the hit, printed `no stamp for tree f884793` for the miss, took the lock, ran the suite (66/66 × 3), re-stamped | 201 s, of which **115 s waiting for the lock** |

That second row is the lock earning its keep on its first outing: the `gates` worktree held it,
and without it two suites would have driven Chrome at the same time — which is the failure that
does not look like a failure, since each run then blames the code. The hook had no lock at all
before this change. `suite-stamp --selftest`: **16/16**.

### Every guard, and the tag count either side of it

`release.ps1 -SelfTest`, ten cases, each against a throwaway bare `origin` plus a clone of it
carrying the working tree's scripts. Every case asserts the tag count before and after:

| case | guard that fired | tags |
|---|---|---|
| `v0.1.0` | `Drop the 'v': the tag must be bare semver (0.1.0)` | 0 → 0 |
| `0.1` | `Version must look like 0.1.0` | 0 → 0 |
| `9.9.9` | `manifest.json says 0.1.0, you asked for 9.9.9` | 0 → 0 |
| the CHANGELOG section removed and committed | `CHANGELOG.md has no '## 0.1.0' section` | 0 → 0 |
| on `not-main` | `On 'not-main', not main` | 0 → 0 |
| `main` 1 commit ahead of `origin/main` | `main is 1 commit(s) ahead of origin/main` | 0 → 0 |
| `main` 1 commit behind | `main is 1 commit(s) behind origin/main` | 0 → 0 |
| detached on a commit `main` merged, with `-AllowAnyBranch` | `HEAD (a381916) is in origin/main's history but not on its first-parent line` | 0 → 0 |
| a tracked file touched | `Working tree is dirty` | 0 → 0 |
| nothing broken | reached `=== lint ===` | 0 → 0 |

Three things the harness itself taught, all of them the same lesson as the code it tests.
**The self-test must run the script on disk, not the one HEAD carries**: the first run reported
ten failures that were all "the old script wants a mandatory `-Version`", because a clone is a
clone of the last commit. **`origin` has to be the self-test's own**, because the guards fetch
`origin/main` before measuring it, so a faked remote-tracking ref in a clone of the real
repository is overwritten by the script under test. And **`@Args` splatted the automatic
`$Args`** — empty — so every case ran with no version at all and gave the same refusal, ten
identical failures that looked like a broken script and were a broken harness. That is the trap
`Invoke-Native`'s own comment in this file records, met from the other side.

### `close-issues`, rehearsed on real history and on a synthetic range

`--dry-run` writes nothing; every row below is a dry run.

| range | result |
|---|---|
| `4ff0cd4..10769c9` (the two docs-site commits) | 2 commits, **1 issue named**: `#1: would close` — attributed to `d58f582`, the *first* commit that named it, de-duplicating the second |
| `1911284..4ff0cd4` | 2 commits, 0 issues named |
| a synthetic 8-commit range over a **dotted tag range** `0.1.0..0.2.0` | 3 named: a subject-line `Fixes #7` de-duplicated against a later body `closes luke321/vault-shelf#7`; the issue-URL form; and a **mid-sentence** `this closes #14`, which is GitHub's own rule rather than this repo's own-line convention. Ignored, correctly: `fixed other/repo#9`, `Refs #11`, `fixe #12`, `prefix #12`, and `` `Closes #13` `` inside a backtick code span — so a commit *about* the convention closes nothing |
| the same, against `luke321/vault-graph` | `#47: already closed, nothing to do`; `#95: is a pull request, skipped` — the two branches this repo's own history cannot exercise, since it has no closed issues and no pull requests yet |
| a zero `before` | exit 1, `a new branch has no range to scan, nothing closed` |
| an unreachable `before` | exit 1, names the sha |
| a `before` that is not an ancestor of `after` (a force-push) | exit 1, `the branch was rewritten under this push` |
| no `--range` | exit 2, usage |

The dotted range matters because the documented rehearsal is a **tag** range, and the sister
repo's first version of this script matched the range with a regex that forbade dots, so the one
documented use printed usage. This one splits on the first `..` and lets `git cat-file`
validate.

### Gates

| | Before | After |
|---|---|---|
| `check-comments` baseline | 1096 | 1096 (every new comment is a bare pointer; `.ps1` is not scanned) |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| `smoke.mjs` | 66/66 × 3 | 66/66 × 3, and now stamps the tree |
| `release.ps1` | 292 lines, pushed the branch and the tag | **609** lines, pushes the tag alone |
| `.githooks/pre-push` | 313 lines, no lock, suite every gated push | **377** lines, lock held, suite once per tree |
| `.ai-context/releasing.md` | 125 lines | **295** (the sister repo's is 425; Sigma, the mobile harness and the per-feature doc gallery do not apply here) |

## 2026-09-11 — A ribbon per book colour, and the colours block became a table

> "make it ribbons so you can choose a color per book color, so basically a table, use
> complimentary colors by default"

**One ribbon could not serve twelve bindings.** `settings.ribbon` was a single colour for the
whole library; it is now `settings.ribbons`, twelve entries, one per palette slot
(**schema 9 → 10**). A file at 9 carries a colour every book wore, so it migrates to all
twelve: **12 of 12** on the check, with the old field gone. A file with none comes up 12 empty,
a sparse twelve keeps what it names, and a junk array comes back 12 long with 0 set.

**The Manage block is a table**: twelve rows, the dye on the left and the thread that hangs off
it on the right, **four columns of three** in a Manage sheet widened to 760px, so the whole
block and the buttons under it are on screen at once. The ribbon
column is drawn with the spine's own notch, so the table needs no legend. Each swatch keeps its
own mark and its own reset.

**The default ribbon is the dye's complement, computed not stored**, so it follows the look and
the theme the way the twelve do. The lightness rule was measured rather than argued: a fixed
subtraction left **8 of 12** separated from their dyes on the demo vault, because a
mid-lightness dye lands inside the clamp and comes back the same weight as its board. Moving
whichever way has more room inside `[0.32, 0.78]` gives **12 of 12**, and the bounds are set by
the *rooms* — cyber's ground is near-black and modern's near-white, so a thread may go neither
very dark nor very pale. A ribbon set on slot 7 reaches the spine wearing that dye and no other:
measured `#ca9a5f` before and `#aa3355` after, with 1 of 12 stored.

**`--ribbon` moved off the root.** It is written per spine from that book's dye and on the
reader's mark row from the open book's, so every ribbon in one book is one thread.

**The same-size check caught the new furniture immediately.** `.vs-slot` is `inline-flex`, so a
swatch in a table cell sits on the baseline and the row grows by the face's descender: under
leather the table was **309px against modern's 291**. Two more followed from the four-column
layout: a column **heading** is text, so the column was **109.9px under leather against
107.3** (the headings are gone), and under `table-layout: fixed` a cell 10px too narrow took
the 10px off the swatch rather than overflowing, **36 wide became 26** (columns pinned, swatch
`flex: 0 0 auto`). Block-level cells, pinned line-heights and pinned columns bring it back to
**0 off**, and the table (**92** wide) and the ribbon swatch
(**22×30**) are in the measured list now — 38 controls, 37 on the demo vault.

Crossed two files this worktree's brief had fenced off, both flagged for the orchestrator:
`src/core/defaults.ts` for the schema, and `renderSpine`/`renderMarks` in `src/page.js` for
the paint. The suite is **68 → 69** checks.

## 2026-09-11 — Dropdowns paint themselves, and the Manage sheet reads as one thing

> "dropdowns in manage do not show the correct background color, looks like dark theme"
> (github#2); "colors in manage look terrible to select, also there needs to be a reset
> button", "make hide show a toggle as well", "all settings persistent naturally" (github#4)

**The host's select rule, measured rather than guessed.** Obsidian's `app.css` rule for
`select` was read out of the shipped bundle and put into the page by a new check. On the page
from the previous commit, with that rule in: **34 wrong** — the rail selector **28 → 40px**
high, the builder's dropdown **29 → 40**, no chevron on any of the twelve dropdowns, the
leather rail selector wearing `--surface-2`. After: **0 wrong**, **28 → 28** and
**31.5 → 31.5**, every field the look's own, on all three shapes. `page.css` now sets every
property the host sets on a `select`; each look supplies `--vs-field` and `--vs-chevron`
(leather twice: the dark rail and the paper sheet), and the cyberpunk look's private fix for
`#vs-look` is gone. Leather paper reads `rgb(250, 246, 238)` on `rgb(48, 46, 39)`, the rail
`rgb(32, 33, 30)` on `rgb(204, 197, 181)`. The builder's dropdown is **31.5** now rather
than 29 because the box is ours: the same height as the Name box above it.

**Twelve bare colour wells became twelve painted, numbered slots**, drawn by the dye menu's
three-deep rule, each marked with a × once it is not the look's own — the mark is that slot's
reset — with the ribbon beside them and one *Reset colours* that is disabled when nothing is
customised. The look's own twelve are read off the cascade with the person's overrides lifted
(`OWN` in `readTheme()`), and twelve that are all the look's own again save as none, so a
reset under one look never pins its colours under another. Hide/Show on a Manage row is a
**Shown** switch beside Vary colours. Everything goes through `persist()` and back through
`core.migrate`: **12 hex** saved after one pick, `#3355aa` in slot 3 and in the cascade,
**0** saved after that slot's ×, **12** after two picks and one ×, **0 / ""** after Reset
colours, `hidden: true` then `false` from the switch with **5 → 4 → 5** visible on the demo
and the hidden shelf still holding **16** books, **0** Hide/Show buttons left.

**The same size in every look, still.** The same-size check grew from 28 to **37 controls** —
the Shown knob, a palette slot (**36×28**), a slot's reset mark, the ribbon slot, Reset
colours, and the builder's Name box, three dropdowns and Save — and reads **0 off** under
leather and cyber on all three shapes. Modern's own numbers did not move: button 27.3, search
232×29.5, ribbon 30, dye swatch 25.5.

Looked at: Manage open under leather, modern and cyber, and the builder under leather and
modern (`--shot-open manage|builder`, new). What the pictures changed: *Reset colours* was
a bar across the whole row because the sheet's wide-row rule outranked the colour row's; it is
one button at the end of the row now. What could not be looked at: the real Obsidian
rendering — the check injects the host's rule, and the plugin was not installed into a vault.

The suite is **66 → 68** checks.

## 2026-09-11 — The docs site wears the product's dark look, and it is Vault Graph's sheet

> github#1: "a theme close to vault-shelf's own dark look ... not a generic off-the-shelf
> GitHub Pages theme"

`docs/assets/css/style.scss` imports `jekyll-theme-midnight` unchanged and repaints its selectors
with the page's dark tokens, copied verbatim from the `[data-theme="dark"]` block in
`src/page.css`; `docs/_includes/head-custom.html` sets `theme-color` to the same background.
**Both files are Vault Graph's, from luke321/vault-graph#100 as merged into its `develop`
(`2242a33`), rule for rule** — the only edits are the issue pointers in the two comments. That
is by design rather than convenience: the two products share one palette (`design/0005` copies
the twelve slots, the surfaces and the text ramp out of Vault Graph's stylesheet value for
value), so their two docs sites share one sheet, and a person who reads both should not be able
to tell from the chrome which one they are on. A first draft here had gone its own way — a
serif body from the reading spread, shelf-label headings, a 44px rail — and was thrown out for
that reason.

What the sheet does: ground `--surface-1` `#1a1a19` flat where the theme had a
`#2a2a29→#1c1c1c` fixed gradient; body `--text-2` `#c3c2b7` in the system-sans stack where
the theme shipped eight OpenSans files; headings `--text-1`; links `--accent` `#3987e5` with
one lifted hover `--accent-hi` `#6aa6f0`, the one token that is not in `page.css`; inline code
on `--surface-2` with a `--border` hairline, blocks on `--surface-0`; the header a
`--surface-0` bar with a hairline under it and the "View On GitHub" link drawn as a flat
bordered control; table heads `--text-3` in spaced capitals; no image bullets, no image rule,
no shadows. Layout untouched (the theme's 650px column and fixed header). One static dark
theme, by the issue's own scope.

**Looked at, not built.** No Ruby on this machine, so Pages was reproduced without it: the
theme's `_sass`, layout, fonts and images fetched from `pages-themes/midnight`, the sheet
compiled with dart-sass over that load path, `index.md` and `features.md` rendered with marked
into the theme's `default.html` with its Liquid resolved by hand, and screenshotted at
1280×1000 in headless Chrome beside the demo export forced to the Modern look. Index and
features both read; the contents table, inline code and the section rules all take the tokens,
and the page and the library open on the same ground. Vault Graph measured the same sheet on
its live site over CDP — 28 rules declared, 28 parsed; contrast `#c3c2b7` **9.72:1**, `--text-3`
**5.16:1**, links **4.79:1**; theme requests per page **8 fonts → 0, 2 images → 0** — and since
the tokens and the rules are the same bytes those numbers hold here unchanged. What was not
run is the Pages build itself, Jekyll's own sass and kramdown; what could differ is markdown
edge cases, not colour.

**Not verified.** A 400px-wide headless window clips the right edge of the text identically
with and without the sheet, so it is Chrome's minimum window width rather than the CSS; the
theme's 480px breakpoint was not exercised. The site is still not live: enabling Pages needs
the repository public, `decisions/0009`.

## 2026-09-11 — Cyberpunk shelved, and every control the same size in every look

> "disable cyberpunk for now until redesign, make sure though to make changes to it aswell,
> make sure all componentes buttons etc have the same size in all themes, some seem off"

**Shelved, not removed.** `core.LOOKS` marks the look `shelved`; the selector lists **2 of 3**
looks (leather, modern) on every shape, the look check still paints all **3** through
`__vs.setLook()` and finds them distinct, and **194 / 419 / 709** addresses identical under
each. Schema **8 → 9**: `{ look: "cyber" }` migrates to `leather`, `{ look: "" }` stays.

**"Some seem off" became 21 numbers.** A new check measures 28 controls in every look against
modern (`invariants.md`, *Every control is the same size in every look*). Before: **21 off
under leather** (rail +14px, reader bar +9.5, every button +1.5, the search box +6, the find
box +6, tabs +1.5, contents rows +2.5, the Manage sheet 8px narrower, the spread 27px shorter)
and **1 under cyber** (the spread 12px shorter). After: **0 off** on all three shapes, and
modern's own sizes unchanged (button 27.3px, search 232×29.5, tab 27.3, ribbon 30, swatch
25.5). `page.css` now owns a control's geometry; a look sets colour, border, shadow and face.
Scrolling: leather **16.7/16.8/17**, modern **16.7/16.8/33**, cyber **16.7/16.8/67** p50/p95/
worst on the demo — unchanged within noise.

The suite is **65 → 66** checks.

## 2026-09-11 — A shelf you can arrange by hand

> "add the option for a shelf without automatic order where you can drag and drop stuff"

The Order control gains `manual` for every classifier, and a manual shelf's books stand in the
order a person dragged them into. `design/0018` records the design; `decisions/0002` is the
constraint it had to respect and did.

**Nothing moved but the sequence.** Switching People to `manual` left the whole library's
address list identical: **451 demo / 194 sparse / 709 library** addresses, element for element,
and the shelf's own sequence identical to the automatic one it replaced. `noteCount` unchanged
on every shelf, and the full suite went **54/54 → 60/60 on all three shapes** (six new checks,
none of the existing 54 moved).

**The sequence is keys, and it survives.** `Alt+ArrowRight` on the first spine swapped the
first two books and left the other **8 / 6 / 9** where they were. **10 / 8 / 11** keys were
written to `Shelf.order`; a rebuild through `__vs.setFilters({})` read back the same sequence,
and `core.migrate` over the settings blob returned the same `order` — the reload path. Focus
followed the book to `people/Halvor Estrin`.

**A drag does the same thing.** A real `dragstart` / `dragover` / `drop` with a `DataTransfer`,
first spine onto the last, on the shelf with the most books: **136 books over 4 rows** (demo),
**30 over 2** (sparse), **122 over 5** (library) — a different row in every case, so the
cross-row drop is measured rather than assumed. The insertion mark measured **3px** wide on the
correct side, and **0** marks were left in the document afterwards.

**Two things the reading order and a filter must not do.** With a hand-made sequence on Years,
two clicks of the top bar's order button left **17 / 6 / 12** year books exactly where they
were while the automatic Months shelf of **136 / 30 / 122** books reversed and came back. With
People arranged and the smallest folder applied as a filter, **10 → 1**, **8 → 1**, **11 → 11**
books survived, every one of them still in the arranged order, and clearing put all of them
back in it.

**A book nobody placed goes last.** With **9 of 10**, **7 of 8**, **10 of 11** keys named in
`order`, the unnamed book stood at the end of the shelf and every address was still there.

**What a screenshot caught that no number could.** Two things, both on the mirror vault
(543 notes, 126 People books, 4 rows):

- The drop mark was a `::before` on the spine. It painted correctly in the default look and was
  **invisible in leather and cyberpunk**, whose stylesheets already own `.vs-spine::before` and
  `::after` at a specificity `page.css` cannot reach — and which this change was not allowed to
  edit. It is a real `<span class="vs-drop">` now, and it draws in all three looks in each
  look's own `--accent`: blue in Modern, gilt in Leather, cyan in Cyberpunk.
- `renderTrack` grouped a row's books into a **map keyed by the plaque** rather than by
  adjacency. Under every automatic sort that is the same answer, because same-plaque books are
  always neighbours; under a manual one it silently re-orders the row. Dropping *Marta Ortiz*
  between two A names now gives **`A | M | A`** — ten plates over ten groups in the first row —
  instead of quietly filing her back with the Ms.

Full suite **60/60 × 3 shapes**, exit 0. `npm run lint` 0 errors 0 warnings, typecheck clean,
`check-scope` clean (358 css rules, 68 prefixed classes), `check-network` clean. No schema
bump: an absent `order` is an automatic shelf.

## 2026-09-10 — Rework the leather binding

The room changes from brown panelling to charcoal, the shelves from bright stained planks
to restrained walnut, and the books from four bands crossing upper-case titles to two bands
framing mixed-case gilt type. The reader changes from marbled surroundings and yellow paper
to an oxblood cover and ivory pages. `design/0016` records the current materials and review.

Measured before and after with `smoke.mjs --only "a look is opt-in" --only "room has a width"`:
**419 demo / 194 sparse / 709 library addresses**, unchanged when switching looks, with the
default palette restored on switching back. At 2560px the default room remains **1180px**,
with **zero row overflow** in all three fixtures. The final targeted run also covers hidden
sheets, named keyboard controls and spine geometry: **5/5 in each fixture (15/15 total)**.

Direct CDP measurements in leather at **390 / 768 / 1440px**: all **419 demo books** remain
present, and toolbar, shelf rows and reader pages have **zero horizontal overflow**. Reader
widths are **358 / 736 / 1180px**. A **57 × 132px** spine stays that size on hover and lifts
**5px**; reduced motion sets its transform to `none`. Search retains **419 books**, with
**177 matches / 242 ghosts**, and list mode retains **419**.

Visual inspection found a builder preview extending beyond the paper sheet. It now wraps:
at 1440px the preview is **566px client / 566px scroll**, and at 390px it is **289 / 289px**.
The preview keeps leather backgrounds and gilt labels inside the paper dialog.

Obsidian screenshots checked the library and spread before and after. Its markdown renderer
produced **246 characters in 4 elements**, without fallback text or horizontal overflow.
Review artifacts and the temporary inspection script are in ignored `dist/leather-review/`.
Build, lint/typecheck, scope, network and comments checks pass. No full-suite run or recording.

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

## The shelf became a bookcase, and the fixture grew fifteen years

**Rows.** A shelf was one row in a horizontal scroller; it is now as many full-width rows as it
takes, and nothing scrolls sideways (`design/0014`). Measured in a 2560px view at
`--measure: 1180`:

| Vault | Rows in the library | Longest shelf | Worst row overflow |
|---|---|---|---|
| demo (394 notes) | 15 | Weeks, 7 rows | 0px |
| sparse (758 notes) | 10 | Weeks, 4 rows | 0px |
| library (10,000 notes) | 27 | Weeks, 17 rows | 0px |

The packing is arithmetic, not layout: `thicknessOf` already knows every width. The one thing
it did not know was that **a plaque is part of its run's width** — `align-self: stretch` makes
a run of one thin book under `2010-2019` as wide as the words — which showed up as a **13px**
overflow on the sparse vault and is now costed by `plaqueWidth()`.

`room()` is measured off a `.vs-track`, which is `width: 100%` by definition. The first render
of a fresh view has no track to measure, so it packs against the container — too generous by
the width of the vertical scrollbar that does not exist yet — and `settleRoom()` corrects it
with exactly one redraw.

**Decade plaques.** `core.plaqueFor` now groups the `year` classifier under its decade, and the
default Years shelf asks for plaques. Demo vault: **16 dated year books under 2 plates**
(`2010-2019`, `2020-2029`); across the whole library **40 plates, 0 orphaned**.

**Fifteen years of fixture.** `make-demo-vault.mjs` went from `--days 760` to `--days 5480`,
and the offset is now `pow(rand(), 2.6)` rather than uniform — a real vault is thick at the
recent end and thin at the old one, and a uniform draw over fifteen years gives every year the
same twenty-six notes, which is a vault nobody has.

| | before | after |
|---|---|---|
| span | 2.1 years | **15.0 years** |
| Years books | 4 | **17** (16 dated + Undated) |
| Months books | 27 | **125** |
| Weeks books | 106 | **234** |
| notes in 2026 | 190 | **129** |
| notes in the oldest year | — | **1** (2011) |

Notes, folders, people and tags are unchanged at 394 / 11 / 8 / 15: the same vault, spread over
a life rather than a project.

## The index was cut against the grain

Every book's notes were sorted newest-first, and a book from an alphabetical classifier was
then given **letter** tabs — so `A`, `C`, `F` pointed into a list ordered by date, and the tab
marked C landed on the first note that happened to begin with C, somewhere in the middle of the
Cs. Reported as:

> "the index tabs are often only M for the M book for example but should go Ma Mb Mc etc"

Both halves are the same bug. `core.buildShelf` now sorts an `initial` book **by title** and
everything else by date, and `indexSections` cuts each book the way it is ordered
(`design/0015`). Measured:

| Book | before | after |
|---|---|---|
| mirror `A`, 56 notes | `A` | `A Aft` |
| library `U`, 404 notes | `U` | `Ub Uc Uf Ug Ui Ul Um Up …` (12 ranges) |
| mirror, Mira Vance's 62 notes | 8 letters over a date-ordered list | `2026 2025 2021 2020` |
| demo `G`, 25 notes | `G` | `Gre` — one tab, and correct: all 25 are "Greenhouse Rebuild — …" |

The prefix is the first **word**, not the first characters: "A note on ferries" cut at three
characters is `A n`, a tab with a space in it that sorts nowhere.

## Two smaller things

**Manage offers the builder.** The sheet listed every shelf and had no way to make another;
the only two doors to the builder were a card at the end of the library and a row menu that
appears on hover.

**The sort order says what it does.** The two values have always been ascending and descending;
the labels said "Alphabetical" and "Newest first", so a Years shelf appeared to offer no way to
read oldest-first. They now read "Oldest first / Newest first" on a date classifier and
"A to Z / Z to A" on any other.

## Settings schema 2

Turning on decade plaques by default reached nobody who had already opened the plugin: a
settings file written under schema 1 carries `plaques: false` on its Years shelf, and defaults
only apply to a vault with no file.

That `false` was never a choice. Under schema 1 the plaques checkbox was **disabled** for a
year classifier, so it was the only value the option could hold. `migrate` now turns it on when
it comes up from a schema below 2, and only for a shelf still classified by year; a file that
already says schema 2 keeps whatever it says, including plaques somebody has since turned off.

Measured on a schema-1 blob: `schema 1 -> 2`, Years plaques **false → true**, Months **true**
(unchanged), People **false** (unchanged), wear `years/2026: 3` and `dateFields: ["date"]`
carried through untouched. 43 checks.

## A second look, bound in leather

`design/0016`. An opt-in look — `data-look="leather"`, off by default — in a **new** stylesheet
(`src/leather.css`), wired into both builds after `page.css`. `page.css` was not changed.

**What it costs when it is off: nothing.** Every rule in the new file is scoped under
`.vault-shelf[data-look="leather"]`, so with the setting off not one selector matches, and
every other number in this file is unchanged.

| | Before | After |
|---|---|---|
| stylesheets the page ships | 1 (`page.css`, 931 lines, 141 rules) | 2 (`page.css` untouched + `leather.css`, 70 rules) |
| CSS rules `check-scope` reads | 141, in one file | **211, in two** |
| built `styles.css` | 29 KB | 58 KB |
| built `main.js` | 67 KB | 67 KB — five lines of JavaScript in all |
| the suite | 40 checks over three shapes | **41** |
| settings-tab rows | 3 | 4 |

**The look is a setting, never a class somebody pokes on.** `applyLook()` owns `data-look` and
calls `readTheme()` when it changes, because the twelve slots resolve differently under a look
and a spine dyed before that re-read carries the *previous* palette. Measured through
`__vs.slots()`: under leather the twelve come back `#6d2024, #97612f, #26492f …` (the dyes),
and switching back returns Vault Graph's `#3987e5, #d95926, #199e70 …` exactly.

**The new check.** `"a look is opt-in, repaints everything and moves nothing"` clicks the
standalone's own switch and measures both sides:

| Vault | Book addresses, look off | Book addresses, look on | The first spine |
|---|---|---|---|
| demo | 182 | **182, identical** | `#26313d` → `#641e21` |
| sparse | 194 | **194, identical** | `#26313d` → `#641e21` |
| library (10k) | 709 | **709, identical** | `#323230` → `#623e23` |

**Three metrics move under leather, and only under leather**: the shelf board `3px → 14px` (it
is still the same background line at `var(--spine-h)`, so the plaque still hangs beneath it),
the spread's margin `10/14px → 26/30px` (somewhere for a `box-shadow` cover to sit — the grid
itself does not move) and the hover lift `5px → 6px + 1.6°`. Nothing else: a spine's width
still runs 22–58px against the library's largest book, so `"a spine's thickness is its note
count"` measures the same numbers in both looks.

### Four things only a screenshot could see

The suite was green through every one of them.

1. **The grain ate the palette.** Fractal noise at `opacity 0.55` over the dye washed all
   twelve dyes to one speckled tan — brown rectangles, which is the exact failure this work
   existed to avoid. **0.22, blended `overlay`.**
2. **The index printed as plaques.** `.vs-contents button` really is a `<button>`, so the
   leather button rule reached it. A printed index is ink on the page and nothing else.
3. **The plank was a dark rule.** The books' cast shadow was 7px of near-black over a 14px
   board and had eaten the wood. **4px, a lit top edge and a lighter stain.**
4. **Inside Obsidian the index was centred, in boxes.** `app.css` gives every `button`
   `justify-content: center` and a box-shadow, and the standalone that the suite drives has no
   host stylesheet at all. Fixed under leather. **The default look still has both symptoms** —
   the fix is two declarations in `page.css` and was deliberately not made here.


## The room follows the window

Rows were packed once per render and never repacked, so a window dragged narrower kept the row
it had been packed for and let the end of it run off the side. A `resize` listener now
re-measures and redraws, coalesced into one animation frame — a drag fires `resize`
continuously, and repacking a 10k library sixty times a second is sixty renders nobody sees.

Measured at 2560px, 760px and back:

| Vault | rows at 2560 | at 760 | back | overflow |
|---|---|---|---|---|
| demo | 15 | **25** | 15 | 0px |
| sparse | 10 | **14** | 10 | 0px |
| library | 27 | **42** | 27 | 0px |

A row is 1180px at 2560 (the measure, centred 683/698) and 705px inside a 760px viewport.

## The lock was never shared, and the two suites ran together

`scripts/lock.mjs` is the same file in both sister repos and it put its lock directory under
the repo's own name — `vault-shelf-locks` beside `vault-graph-locks`. Each suite therefore held
a lock the other could not see. This was found by looking, while Vault Graph held a `suite`
lock 866 seconds old and Vault Shelf ran its own full suite three times.

Both now use `obsidian-vault-locks`, and `acquire` honours a lock still sitting in either
legacy root — checked **before** the new directory is claimed, since a legacy lock lives
somewhere else and creating this one would otherwise succeed. Verified: with Vault Graph
holding `suite`, `node scripts/lock.mjs acquire suite` in Vault Shelf reports
`WAITING … held in a legacy root` and then `BUSY`, exit 1.

## A note with no date of its own now takes the file's

`useFileStamp` was off by default and is on from settings schema 3, because an Undated book of
a few hundred notes is not worth what it costs. The order is unchanged — a declared date, then
a date in the title, then the stamp — and only the floor moved.

**The stamp is the earlier of creation and modification**, via the new `core.stampOf`, called
by both the plugin and the exporter. Neither one alone survives: a bulk reformat moves the
modification time forward, and copying a vault moves the creation time forward while leaving
the modification times intact. The exporter had been using `mtime` alone.

Measured on the mirror of a real vault, with the fallback on:

| | before | after |
|---|---|---|
| dated from frontmatter | 525 | 525 |
| dated from the file stamp | 0 | **18** |
| Undated | 18 | **0** |
| Years shelf books | 12 | **11** (Undated gone) |

**And measured on the real vault it mirrors, the fallback is nearly worthless**: all 545 files
stamped inside `2026-06` to `2026-09`, because the vault was moved onto that machine in June.
The 23 notes with no date of their own take a date meaning "when this vault arrived here". The
toggle is how you see that — turn it off and count the Undated book. `decisions/0003` carries
the amendment and the numbers.

`make-mirror-vault.mjs` now copies each source file's stamp onto its mirror (`utimesSync`,
never forward of now), because a mirror written today would give every undated note today and
make the fallback look far worse than it is.

## A book opens on its oldest note

Every book ran newest-first — a feed's order, not a notebook's:

> "it's weird to see a notebook starting with the newest note as if written backwards"

Date-ordered books now run **oldest first**, with one toggle in the top bar. An Encyclopedia
volume stays alphabetical under both, because "the oldest of the As" is not a thing and its
tabs are cut by letter (`design/0015`).

`core.buildShelf` takes the order as a third argument and flips the comparator; nothing
downstream knows, the tabs follow because they are positions in the list, and the saved reading
place re-resolves through the rebuild the way it does after any other one. 47 checks.

## Matching encyclopedia bindings, stable optional colors, and book typography

The leather preview showed **six colors across 20 encyclopedia volumes**. Those volumes
now share one oxblood binding. Manage's **Vary book colors** is off by default; when enabled,
other books choose a palette slot from their stable address instead of their dominant
folder. New notes cannot recolor an existing book. The additive setting survives migration
and reload; encyclopedia volumes match in either mode and both looks.

`node scripts/smoke.mjs --only "book colors" --jobs 1` passed on all three fixtures.
Adding enough notes from a new folder to change a monthly book's dominant folder, and
reversing folder ranks, left **419 / 194 / 709 existing colors unchanged** in light, dark
and leather. Toggling the option preserved counts and addresses; reloading retained the
choice. The targeted palette, look-switch and schema-migration checks also passed on all
three fixtures. No full-suite run was performed.

Leather now uses local Georgia typography throughout the library and paper dialogs,
with traditional serif fallbacks, 13px spine titles and 11px counts. Month labels are
`Jan` through `Dec` plus the year;
the `YYYY-MM` addresses are unchanged. The demo still has **394 notes and 419 books**.
Chrome screenshots at 1440 × 1000 were inspected for matching and varied bindings and the
Manage dialog. All 20 encyclopedia volumes match; month names such as `Sep 2026` fit the
title panel. Review images are local temporary artifacts under
`vault-shelf-leather-oWY351/{matching,manage,varied}.png`.

The follow-up review requested larger, more readable text. Georgia replaces the delicate
Baskerville trial, and **120% layout zoom** enlarges the whole leather interface, including
the available space for its fonts. Measured spine height is **158.39px**, up from **132px**;
13px titles render at **15.6px**. At **390 / 768 / 1000 / 1440px**, the root fills the
viewport, every shelf row fits, and reader pages, reader toolbar and Manage dialog have
**zero horizontal overflow**. Narrow Manage rows wrap their controls. The look-switch check
now verifies 120% spine height and compares semantic counts separately from repeated plaques,
since larger bindings can produce more rows. Inspected screenshots are
`vault-shelf-leather-oWY351/scaled-{1440,390,manage}.png`.

## The People shelf was empty, and the default was why

> "how does the people not work? does it need a tag or what? it does not work in my vault"

`peopleProperty` was one string, `"people"`. Measured across the 545 files of the vault it was
being asked about:

| property | notes carrying it |
|---|---|
| `attendees` | **187** |
| `person` | **74** |
| `partner` / `partners` | 83 / 52 (organisations, not people) |
| `people` | **0** |

So the shelf was right and the default was wrong. `peopleFields` is now a list —
`people, attendees, person`, merged — the same shape `dateFields` has always had. That vault
now yields **124 people** where it yielded **0**.

`core.cleanPerson` is the other half, called by the plugin and the exporter both: it unwraps
`"[[People/Ada Lovelace|Ada]]"` to `Ada`, a quoted `"[[Ada Lovelace]]"` to `Ada Lovelace`, and
returns nothing for `[[{{VALUE}}]]`, so a vault that keeps its templates among its notes does
not grow a person called `{{VALUE}}`. The plugin had a private unwrapper and the exporter had
none — the same split that produced the fifteenth month.

## Ribbons are visible from inside the book

A ribbon showed on a spine and on the Reading shelf, and vanished the moment you opened the
book — which is backwards, since a ribbon is what you put in a book to get back to a page
*while reading it*. Up to **3** now hang over the top of the spread, named with their note
titles and clickable; beyond that they become a count (`+2 more`), because the full list of a
book's notes is already the left-hand page.

## A third look, and the check that walks the list

> "add a theme selector at the top, make a 3rd cyberpunky theme please"

`src/cyber.css` — a rain-lit archive at 3am. `design/0017` carries the design; these are the
numbers. Measured on the 543-note mirror vault and the three fixtures, 2026-09-10.

### Nothing moved, which is the law

| | Default | Leather | Cyber |
|---|---|---|---|
| book addresses, demo vault | 194 | 194 | 194 |
| book addresses, sparse vault | 419 | 419 | 419 |
| book addresses, 10k library | 709 | 709 | 709 |
| every count in `__vs.counts()` | — | byte-identical | byte-identical |

Two local constants move under cyber and neither is measured by an invariant: `--board`
`3px → 7px` on the track, and the `.vs-spread` margin `10px/14px → 22px/26px`. The hover lift
is 6px against `design/0005`'s 5px budget, with no rotation.

### The tint, which the screenshots settled

`--tint` is how much of its folder's slot a spine's face takes. Rendered at three values on the
mirror vault and looked at:

| `--tint` | What the shelf looked like |
|---|---|
| 100% (leather's) | twelve saturated slabs — a bar chart with a glow filter, the failure `design/0005` records for the stacked bar |
| 30% (the first cut) | **one colour.** Against a ground this dark, cyan, azure and teal collapse into the same slab; 341 spines photographed as identical blue-green rectangles |
| **42%** | `#176780`, `#744835`, `#1c7362`, `#745f31`, `#3d6a34`, `#74215b`, `#433587`, `#742f42`, `#1b5087`, `#5b3287`, `#43526e`, `#2f3d5c` — still metal, and twelve of them |

The default look separates the same folders *less*: it sits at `--tint: 14%` in dark.

### Four more things only a picture could see

| | Before | After |
|---|---|---|
| the rain | 6 strokes, opacity 0.5, displacement 26 — read as cracks in the screen | 0.13, hairlines, displacement 13 |
| the spines | brushing down + scanline across = a crosshatch on all 341 | scanline off the spine, on the room's surfaces only |
| the shelf-jump strip | `.vs-railname` at 0.22em made the name 130px against the default's 75px; **141px of 434px of chips showing** | 0.12em |
| the board | 9px, two lit pixels over a saturated tube, blooms 16px/22px | 7px, one lit pixel over a deep one, blooms 11px/14px |

### The look selector paints itself, and only inside Obsidian did that matter

`#vs-look` measured `rgba(5, 10, 20, 0.85)` in the standalone and photographed as a **white
slab** in the plugin: `appearance: auto` hands the box to the platform and the app's own
form-field rules land on top. `appearance: none` plus an authored chevron takes it back.
`design/0016`'s lesson — the standalone is not a preview of the plugin — for the third time.

### The check grew a third assertion, and it failed

`"a look is opt-in, repaints everything and moves nothing"` now walks `core.LOOKS` and drives
the top bar's `<select>`. Its new assertion — **the first spine's inline `--spine-tint` is one
of the twelve the cascade currently resolves** — fails on all three vault shapes, and the
failure is real and is not the look's:

| | `--spine-tint` on the first spine |
|---|---|
| after picking cyber from the selector | `#d95926` — Vault Graph's **dark `--g2`** |
| after any rebuild | `#ff8a3d` — **cyber's `--g2`** |

`applyLook()` sets the attribute and re-reads the palette but never re-renders, so every spine
keeps the hex written under the previous look. It affects **leather too** (`#3987e5` on the
demo vault, where leather's `--g1` is `#6d2024`), and the old check could not see it: `--tint`
and `--surface-2` move with the look as well, so the mixed `backgroundColor` changes anyway and
a check comparing only that colour passes. Reported rather than fixed — `src/page.js` is not
this change's file.

### Gates

| | Before | After |
|---|---|---|
| `check-scope` css rules | 219 | 290 |
| `check-scope` prefixed classes | 52 | 52 |
| `check-network` files | 13 | 15 |
| `check-comments` baseline | 746 | 746 (CSS is not scanned) |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| built `styles.css` | 61 KB | 90 KB |

## No look moves a book any more

Leather shipped as `zoom: 1.2`, which is 20% of the type and also 20% of `--spine-w`,
`--spine-h` and `--measure`. Measured before: a spine **59×158** in leather against **49×132**
elsewhere, in a room of **983 CSS px** against 1180 — a different number of books per row, and
every book jumping on a switch.

The 20% is now the base font size alone, 14px → 17px. Measured after, on all three vault
shapes and all three looks: **49×132 in a 1180px room** (demo), 57×132 (sparse), 47×132 (10k).
The look check asserts it rather than trusting it.

## Leather is what a fresh library opens in

`LOOKS` reordered to **leather, modern, cyberpunk**, and `emptySettings().look` is `leather`
from settings schema 6. A file written under an earlier schema says `""`, which was the only
look there was rather than a decision, so it comes up in leather; one that already says 6
means what it says.

Two checks had to say which look they are about: the twelve slots and the theme-follows-host
pair are about the **modern** look's palette, and now select it before reading.

## Plaques for the alphabet

`core.plaqueFor` falls through to `firstLetter(key)` for every classifier that is not a date,
and the default People and Tags shelves ask for plaques. The mirror's People shelf goes from
**126 books in one run** to 126 books under **21 letters**.

## The shelf turns with the book

The reading order in the top bar turned the notes inside every book and left the books
themselves alone, so a Years shelf ran 2026 → 2015 while every book on it ran forwards. Date
classifiers now take their direction from the same control; the builder disables its own
direction control for them and says why.

## Ribbons hang out of the top of the book

Up to three, named, clickable, drawn as ribbons rather than tabs — cut end up, their own
`--ribbon` colour per look, and a stub at the end of the row to push a new one in. The row
keeps **40px** whether the book holds ribbons or not and is `flex: 0 0`, because it was
measured at **30px on a short book and 26px on a long one**: the reader is a flex column, and a
book whose contents overflowed it had the missing pixels taken out of this row.

## A link to a person's note names that person

Reported as one missing person; measured as a vault that records people by link rather than
by property — 64 notes with `type: people`, linked from bodies, named in no `attendees`.
`personNote` (`type: people` by default) says which notes are people, and a link to one names
them by the target's own name, so an aliased link and a plain one are one book.

| | before | after |
|---|---|---|
| people in the real vault | 124 | **140** |
| notes naming the reported person | 0 | **22** (the 22 that link to her) |
| demo fixture, linked-only person | — | **38 notes, one book**, alias earns none |

The plugin resolves links through `metadataCache.getFirstLinkpathDest`, the same way the app
does; the exporter indexes person notes by path and by title. 51 checks.

## Scrolling under a look was painting every spine every step

> "performance is not good for what we are showing when scrolling"

Measured with a scripted scroll and frame timing, p50 / p95 / worst in ms:

| look | before | after |
|---|---|---|
| modern | 16.7 / 16.8 / 17 | 17.7 / 18.6 / 19 |
| leather | 50 / **117** / 150 | 17.6 / **18.7** / 105 |
| cyberpunk | 83 / **400** / 400 | 17.6 / **18.5** / 35 |

Three lines of CSS: `content-visibility: auto` on a shelf, so the ones off screen are not
painted at all; `contain: layout paint` on a row, so one row's paint cannot invalidate the
next; and `will-change: transform` on the library's contents, so a scroll moves tiles that are
already rasterised and paints only the strip that just came into view. The looks' spine paint
is untouched — it was never too expensive to paint once, only too expensive to paint sixty
times a second. 52 checks.

## Colours: the person's, then the shelf's, then the folder's

Right-click a spine for twelve swatches and *Automatic*; a chosen colour is keyed by address
and survives a rebuild. *Vary colours* moved from one library-wide switch to a button on each
shelf's row in Manage (and the builder), and a file that had the old switch on comes up with it
on for every shelf that varied under it. The twelve slots and the ribbon are editable in
Manage; a person's palette is written inline on the root and beats every look.

Measured on the demo vault: 8 People books wear **2** colours by folder and **7** when the
shelf varies; a right-click on the first Years book takes it from its folder's slot 1 to slot
6 and a rebuild keeps it; slot 1 set to `#123456` stays `#123456` under the modern look.

**A regression repaired on the way:** the leather rework had made every book slot 0 unless
its shelf varied, so a library came out one colour. The folder dye is back as the default.

A spine shows up to **three** ribbons side by side (x = 40/49/58 on the demo vault) instead of
one wider one. Schema 8; 54 checks.

## The resize repack was dead whenever the window was not being painted

Found by the suite, not by a person, and only because the check now reads the watcher's own
log: on two of three shapes the resize handler ran and its `requestAnimationFrame` callback
never did — **"saw 2 resizes, measured 0 times"** — so the library kept the rows it had been
packed for and let the end of every row run 468px off the side. Chrome gives no frames to a
window it is not painting, which is any Obsidian pane resized while another has focus, and the
watcher's pending flag then stayed set for good. It coalesces through a 60ms timer now;
measured after: **2 resizes, 2 measurements, 8 rows → 14 → 8**, 0px of overflow on all three.

The library-wide *book colors are optional* check retired with the switch it tested; its one
surviving claim — a rebuild never recolours a varied shelf — moved into the vary check, where
a narrowing filter recolours **0** of 8 books. The scroll-timing and resize checks moved to
the serial lane, since three other Chromes on one GPU showed up in their numbers. 54 checks.

## A note that is one wide table

> "claude history render strangely"

The note in question is 38 lines, 31 of them table rows, with a cell of **1,764 characters**
and 188 spans of inline code. Two things were wrong with it in the reader. The first attempt
at wide tables had put `display: block` on the table, which throws away the column layout
Obsidian's own rules give it under `markdown-rendered` — a table that is a block is a stack of
cells. And the standalone's small fallback renderer did not know pipe tables at all, so
outside Obsidian the note read as pipe soup.

Now the **article** scrolls sideways within the page, the way a code block already did, and
the table is left alone to be a table; long cells wrap at their content. The fallback renderer
learned the one block it was missing. The demo fixture carries a 12-row table with a
**1,981-character** cell, and the check opens it: the spread stays **1180px** in a 1180px
measure, the page scrolls **0px** sideways, 72 cells render.

The picture caught what the numbers had passed: squeezed to the article's 66ch, the table
gave every column a sliver and broke words down the middle — "wher/e", "Harad/a". It is
`width: max-content` now, cells wrap at 40ch and never mid-word, and the article scrolls to
the columns that do not fit. `--shot-note "<title>"` is how that picture was taken.

## A click off the book puts it down, and three small things

Clicking the desk around the open book closes it and goes back to the shelves — both ends of
the click off the book, so a selection dragged past the cover does not. Measured: the desk is
**42px** left of the cover on the demo vault; on it the book stays, off it the book closes.

The twelve swatches in the right-click menu had **no colour under leather**: every look paints
`button` at `.vault-shelf[data-look] button`, one class and an attribute and an element,
which beats the two-class swatch rule. Three classes deep now, and the check asserts all
**12 of 12** swatches paint their slot rather than merely exist.

*Vary colours* in Manage is a switch, since it is a state and not an action. 62 checks.

## A link stays in the library, one peek, upright letters, a layered index

**Wikilinks** followed from the spread go to that note in this book, this shelf or the nearest
shelf; only a note the library does not hold falls through to Obsidian, and Ctrl/Cmd-click
always does. The standalone renderer makes links of `[[wikilinks]]` too. Measured: from a
Months book, the click lands in another Months book; from a book holding both, it stays.

**The peek.** A spine carried a `title` (the browser's tooltip) and an `aria-label` (in
Obsidian, the app's), so two overlays opened, both too small for a long tag name. One
`#vs-peek` element now, 14px, up to 340px wide: **0** spines carry either attribute.

**Upright letters.** A label of three characters or fewer stands upright: **23/23**
Encyclopedia labels on the demo vault, `0-9` included.

**The layered index.** A year book, a month book and a tag book were cut three different ways.
Every date-ordered book is cut years → months → days now, each layer only where it separates
something, none for three notes or fewer, capped near thirty. `#archive`: 4 years, 26 months,
30 tabs; a month book: days only; a three-note book: no tabs. 65 checks.

