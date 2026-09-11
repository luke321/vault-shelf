# 0006 — The harness

## What the suite drives

The **standalone build**, not the plugin. `src/build-shelf.mjs` inlines the core, the page, the
markup and the data into one file that a browser can open off disk, so the suite needs no
Obsidian, no vault of anybody's, and no profile. That build is the reason the exporter exists
at all — it happens to also be a useful thing on its own.

Every check reads a number out of `window.__vs`, which is the page's debug surface and is
**stripped from the plugin bundle** by `scripts/build-plugin.mjs`. It is armed by nothing and
reachable from nowhere inside Obsidian, so shipping it would be dead weight and a larger review
surface than the plugin needs. The strip is count-checked: the build fails loudly if the
`BEGIN`/`END` marker pair stops matching, rather than silently shipping the whole thing.

## Where the windows go

`scripts/screen.mjs` finds the leftmost display and the harness places its windows there, off
to the side, so a run does not take over the desktop somebody is working on. With `--jobs 4`
the four lanes tile that screen rather than stacking, which is only cosmetic but makes a
failing run watchable. `--headed` opts out and puts one window where windows normally go.

## Two things may not run twice at once

`scripts/lock.mjs` is a machine-wide mutex with two names, and it lives in the OS temp
directory rather than the worktree so **every worktree shares one**:

| name | why |
|---|---|
| `record` | a screen recording grabs a display region, so a second take captures the first one's window |
| `suite` | the full suite drives Chrome over CDP, so two runs fight for ports and each blames the code |

```bash
node scripts/lock.mjs acquire record --owner "who you are"   # blocks; exit 1 = give up
node scripts/lock.mjs release record --owner "who you are"   # always, even on failure
node scripts/lock.mjs status
```

**`suite` is taken by the suite itself** (`github#8`). It was caller discipline until
2026-09-11 — the docs told a person to wrap the run — and `smoke.mjs` contained no reference to
`lock.mjs` at all, so the command the iteration loop is actually made of, `--only`, ran
unguarded every time. Six worktrees were live when that was filed. Now the run acquires at
startup, before the fixture store is touched and before any Chrome is launched, prints who
holds it while it waits, and releases on exit, on a thrown error and on a signal — taking its
browsers down first, since handing on the lock while our own Chromes still drive gives the next
run the contended screen the lock exists to prevent. `--no-lock` is for a caller that already
holds it and nothing else; wrapping a run by hand now waits for its own parent, and the refusal
says so.

A `mkdir` is the lock — atomic, and it survives a killed session as a **stale** entry rather
than a permanent one. Stale windows are 20 minutes for `record` and 30 for `suite`; a run that
exceeds them is a run somebody has to look at anyway.

Screenshots need no lock: they go over CDP, so overlapping windows are harmless. Pass your own
`--port`. `--shot` is part of a suite run, so it is inside the suite's own lock anyway.

## One fixture store, and nothing prunes a sibling

`storeRoot` comes from `git rev-parse --git-common-dir`, so **every worktree of this repo
resolves to the same `.fixtures`** — deliberately, so the gate sees one fixture set no matter
where a push runs (`decisions/0004`). A fixture is named `<name>-<digest8>`, where the digest is
sha256 over the three generator sources plus that fixture's args, which makes the directory
content-addressed: editing a generator produces a *different* directory, not a changed one.

Until `github#8` a miss deleted **every other digest of that fixture**, including the directory
another worktree's Chrome had open. The digest moves on every save to a generator, so a worker
editing one wiped the store for the other five on every run, and their next run regenerated and
wiped it again. Two digests are allowed to coexist now — that is what naming a thing after its
content is for — and a run collects only what is provably finished with: a fixture whose own
stamp is older than `FIXTURE_MAX_AGE_DAYS`, and a `.building-` or `.retired-` scratch directory
that is not this run's and is over an hour old.

Publishing distinguishes the two ways the same digest can already be present. **Fresh** means
another run published it while this one was building: keep theirs, drop ours, since the same
digest is the same content. **Stale** means the weekly refresh — same digest, a stamp older than
the window — and that directory is renamed aside, replaced, and then deleted, so nothing is ever
removed out from under a path something may be reading, and nothing is renamed onto (on Windows
that throws rather than replacing).

## Sharding, and what may not be sharded

Checks that only read data run in `--jobs` parallel shards. Checks whose names match
`POINTER_DRIVEN` — anything that clicks, scrolls, or measures a laid-out box — run **serially**
afterwards, in one lane. Four browsers contending for one GPU report geometry that has more to
do with the other three windows than with the code, and a flaky geometry check trains people to
re-run the suite instead of reading it.

The list is by substring of the check name, so naming a new layout-reading check
`"...the plaque sits..."` puts it in the serial lane without touching the harness.

## Iterating

```bash
node scripts/smoke.mjs --only "plaque"       # one check, by substring
node scripts/smoke.mjs --vault ./my-vault    # a specific vault on purpose
node scripts/smoke.mjs --jobs 1 --headed     # one browser, on screen, watchable
```

The full suite runs on the push to `develop` (the pre-push hook). Do not run it by hand unless
asked — it takes the `suite` lock and minutes of somebody's machine.
