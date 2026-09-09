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

A `mkdir` is the lock — atomic, and it survives a killed session as a **stale** entry rather
than a permanent one. Stale windows are 20 minutes for `record` and 30 for `suite`; a run that
exceeds them is a run somebody has to look at anyway.

Screenshots need no lock: they go over CDP, so overlapping windows are harmless. Pass your own
`--port`.

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
