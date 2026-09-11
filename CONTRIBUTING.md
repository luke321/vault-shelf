# Contributing

**Open an issue.** That is the way in for now, and it is a real invitation rather than a
polite deflection — bug reports, vaults that shelve badly, and "this count looks wrong to me"
are all useful.

Pull requests are not being taken yet. The project is one person's and the membership rules
are held together by decisions that were each argued out and written down; reviewing a change
to those properly takes longer than making it. That will change; until it does, an issue with
enough detail to reproduce is worth more than a patch.

## What makes a good issue here

**For anything about what a shelf contains, say what your notes look like.** Which frontmatter
property carries your dates, whether people are a property or a link, how deep your tags nest,
roughly how many notes and folders. You do not need to name anything — shapes and counts are
enough.

**For anything visual, a screenshot.** Every automated check here asserts a number; none of
them can see that something looks wrong. Both of the visual defects found so far were found by
a person looking at the thing while every check stayed green.

**For anything that says "wrong count", say which count and what you expected.** The shelf
header prints books and notes, and the spine's tooltip prints the source mix.

**Never paste a built `vault-shelf.html`, and be careful with screenshots of your own vault.**
The file contains every note title, path, tag, person and body in plain text. If you want to
show a problem without showing your notes, generate a fixture — the same shapes, none of your
content:

```bash
node scripts/make-demo-vault.mjs --out ./demo-vault
node src/build-shelf.mjs --vault ./demo-vault --out ./demo.html
```

Attach that, or a screenshot of it. Three generators cover the ground: `make-demo-vault.mjs`
(every classifier populated), `make-sparse-vault.mjs` (undated, lopsided, multiscript) and
`make-library-vault.mjs` (10,000 notes over ten years). None of them needs a vault of yours.

## If you do want to work on it

Read [`.ai-context/`](.ai-context/) first, and the record for the part you are touching. A few
choices look arbitrary and are not: the `0-9` volume, the `-undated` and `-unfiled` keys, the
26-tab cap in the reader, three colour segments on a spine. Each has a reason written down,
and the recurring failure mode in this repo is reasoning about the code instead of measuring
it.

Six commands, and all six are gates rather than suggestions:

```bash
npm run lint                                  # tsc --noEmit on src/core under strict, then typescript-eslint on our own code; every finding held at zero
node scripts/smoke.mjs                        # the invariant suite, over three vault shapes
node scripts/check-scope.mjs                  # the page cannot style, or be styled by, its host -- and nothing shipped carries an invisible character
node scripts/check-network.mjs                # nothing shipped can make a network request
node scripts/check-comments.mjs               # comments are pointers; the count of prose lines only goes down
node scripts/check-generator-determinism.mjs  # a fixture is the same vault on any day
node scripts/check-build-order-determinism.mjs # note order never depends on the filesystem
```

One more needs Obsidian itself, for the things the exporter cannot stand in for — the metadata
cache, the view lifecycle, the ribbon icon, the settings tab:

```bash
node scripts/build-plugin.mjs
node scripts/smoke.mjs --only "settings"           # one check by substring
node scripts/smoke.mjs --only "the room" --shot out.png   # and a picture of it
```

It copies a store fixture into a throwaway vault under `%TEMP%`, installs the three built
plugin files into it exactly as a release installs them, launches a **separate** Obsidian with
its own user-data directory and a remote-debugging port (the Obsidian you have open is not
touched and not reused), drives it over CDP, and prints the number behind every check. It is
opt-in and not in the pre-push hook: it needs Obsidian installed and takes minutes.

Since Obsidian 1.7.2 a tab restored in the background is **deferred**: the leaf is real and
`getLeavesOfType` finds it, but `leaf.view` is a placeholder until something reveals it. The
plugin checks `view instanceof ShelfView` before touching one, and so should anything new.

**`--shot` is not optional in spirit.** Sixteen of the seventeen things that can go wrong here
are numbers, and the seventeenth is what it looks like. Take the picture.

## The demo

```bash
node scripts/record-demo.mjs                      # the whole storyboard -> demo-vault-shelf.mp4
node scripts/record-demo.mjs --act read --fps 4   # one act, fast, for iterating on it
node scripts/record-demo.mjs --hero assets/demo.webp
```

It builds the standalone page from the demo fixture, drives it through twelve acts, and
captures every frame over CDP — **headless, so it cannot capture the wrong window and needs no
`record` lock**, unlike a screen grab. 83 seconds at 24fps takes about a minute and a half to
shoot. `design/0007` has the reasoning, including why the captions are injected by the
recorder rather than added to the page.

`git config core.hooksPath .githooks` once per clone runs those on every push to `develop` or
`main`, along with a check that refuses to publish other people's names, two that keep the
generated fixtures deterministic, and one that keeps the generated navigation files
(`.ai-context/code-map.md`, `.ai-context/code-index.md`, from `node scripts/code-map.mjs`) in
step with the source. Only the invariant suite has a skip flag, on purpose: everything else is
a static read costing seconds at most, and what most of it prevents is damage to somebody
else's software, or to somebody else. The lint gate fails closed on a clone that has not run
`npm ci` — run it, then push.

**The suite runs once per distinct tree, not once per push.** A green full run stamps the git
tree it measured, and the hook skips the suite for a tree that already carries a stamp, naming
it (`decisions/0010`). Measured on the reference machine: the static gates are 7.5 s and a full
suite run is 39 s, so a stamped push is the first number and an unstamped one is both. A
partial run and a dirty tree never stamp. Prefer this to `SKIP_SMOKE=1`, which leaves no record
of what was trusted:

```bash
node scripts/suite-stamp.mjs check      # what will this push do?
node scripts/suite-stamp.mjs list       # every tree this machine has passed
```

## Branches, and how work reaches main

**`develop` is where work lands. `main` only ever receives `develop`.**

```
your branch  ->  develop  ->  main
```

`main` is what the Obsidian directory installs from and what a release is tagged on, so
nothing should reach it that has not already been through `develop`, where the invariant suite
runs on every push. The rule is enforced twice, because there are two ways to move a commit
and neither mechanism can see the other -- three, once the ruleset is armed:

| | |
|---|---|
| `.github/workflows/branch-policy.yml` | a pull request into `main` fails unless its head is `develop` in this repository — GitHub has no branch-protection setting for "the PR must come from X", so it is a check the ruleset requires |
| `scripts/release.ps1` | the tag is refused unless HEAD is on `main`, is exactly `origin/main`, and is on `origin/main`'s **first-parent line** — and the script pushes the tag alone, never the branch, because `main` only ever receives `develop` through a pull request merged on the website |
| `.githooks/pre-push` | a `git push` to `main` is refused unless `develop` is already an ancestor of it — a merge of `develop` passes, a commit made straight on `main` does not |
| `.github/workflows/release.yml` | a release tag whose commit is not in `origin/main`'s history is refused before anything is built, signed or published — the same rule again, at the one moment it still matters, since a published tag cannot be moved |

**One of those three is not armed yet.** GitHub does not offer repository rulesets on a
private repository outside a paid plan, so `main` currently has no rule *requiring* the
branch-policy check to pass, forbidding a force push, or forbidding deletion. The workflow
still runs on every pull request into `main` and still reports; it just cannot block on its
own. The hook and the release workflow are unaffected and enforce the same rule from the two
other directions. **When this repository goes public, add the ruleset** — pull request
required, `main only accepts develop` required, no force pushes, no deletion — which is what
the sister repo carries.

## Comments are pointers

A comment in `plugin/`, `src/` or `scripts/` carries a reference and nothing else: a bare
`github#N`, `decisions/NNNN` or `design/NNNN`. The reasoning, the measurements and the
rejected alternatives live in `.ai-context/` — `changelog-detail.md` for what was measured,
the ADRs for why not the other thing, `invariants.md` for what a check asserts — and
`.ai-context/code-index.md` (generated) says which code cites which record. What stays in the
code besides pointers: JSDoc blocks carrying a tag (the type-aware lint reads them), section
banners (the code map reads them), the build's `BEGIN`/`END` strip markers, and PowerShell
`<# .SYNOPSIS #>` help blocks (Get-Help reads them). `decisions/0007` is the record.

`node scripts/check-comments.mjs` enforces it in the pre-push hook. It counts every comment
line in those three directories that is neither a bare pointer nor a JSDoc type annotation,
prints the count per file, and holds the total at exactly `BASELINE` — over fails, and under
fails until the baseline is lowered to the new count in the same commit, so the number can only
go down. `--list` prints every counted line.

## Commit messages

Reference the issue with a **closing keyword** — `Closes #7` on its own line in the body:

```
Give the Undated book its notes back

...what changed and what was measured...

Closes #7
```

The issue closes when that commit reaches **`develop`**. GitHub itself resolves a closing
keyword only on the default branch, `main`, and has no per-branch switch; that left an issue
open for days after its fix had landed and been gated by the full suite. So
`.github/workflows/close-issues.yml` runs on every push to `develop`, scans the pushed commits
for the keyword forms GitHub recognises (`close`, `fix`, `resolve` and their `-s`/`-d`
spellings, any case, followed by `#n`, `owner/repo#n` or the issue's URL — anywhere in the
message except inside a backtick code span, so a commit *about* the convention closes nothing),
and closes each issue it names with a comment giving the commit and saying the fix is not yet
released. The release merge into `main` then meets GitHub's own resolution on an issue already
closed. **A closed issue therefore means landed on `develop`**; whether it has shipped is what
`CHANGELOG.md` is for. A bare `#7` links without closing, and is right for a commit that only
touches an issue in passing.

If a merge into `develop` needs to close issues its commits did not name, put the keywords in
the merge commit message; the workflow reads that commit too. The scanning is
`scripts/close-issues.mjs`, which can be rehearsed on any range without writing anything:

```bash
node scripts/close-issues.mjs --range <before>..<after> --dry-run
```

For a visual change, take before-and-after screenshots of the same vault and compare them:

```bash
node scripts/smoke.mjs --shot before.png --only "the room has a width"
```

## Code of conduct

Be decent. Nothing here is important enough to be unpleasant about.
