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

## Placement is not activation

**This section exists because the rest of the page reads as though the problem below were
already handled, and it was not** (`github#50`). Everything about the leftmost display answers
*where a window goes*. Nothing in it answers *whether the window takes the keyboard*, and those
are two different questions with two different answers.

A window Chrome has just created **activates itself**, and Windows permits it because the
harness was spawned by whatever held the foreground — the terminal. So a window placed politely
on a screen nobody is using still stops the next keystroke from reaching the terminal that
launched it. No harness here ever asked for the foreground: there is no `SetForegroundWindow`,
no `SetWindowPos`, no `ShowWindow`, no CDP `Page.bringToFront`. The theft is structural, and it
happened once per launch — up to three per suite run, and once more for each of the four other
harnesses.

**The fix is not creating the window.** Every harness that opens one is headless by default now,
and `--headed` is the only thing that changes it. The two alternatives were considered and are
worse for the same reason: `SW_SHOWNOACTIVATE` / `SWP_NOACTIVATE` and CDP
`Browser.setWindowBounds` both run *after* the window has been created and raised, so they
return the focus after a visible flicker, in a race they can lose. They undo; headless prevents.

**`--headed` was worse than no flag at all until this.** It was parsed at the top of
`smoke.mjs`, set a `VS_HEADED` that nothing read, and was never referenced again — a switch that
reads as the control for exactly this and did nothing, which invites the belief that the default
is already headless.

**It cost nothing measurable.** The concern was that `--headless=new` would move the goldens in
`scripts/layout-snapshots/` or the frame budget, since both were taken headed. Measured on the
one vault at 1180px: the same 6 shelves, 10 rows, 227 spines, 52 plaques and 1125px room in all
three looks, and 99/99 in both modes. At the same window size the two modes hand the page an
identical box — inner 1584x961, a 15px scrollbar, `devicePixelRatio` 1 — which is why nothing
moved. What did change is which one is *reproducible*: a headless window is exactly the size
asked for every time, while a headed one is subject to the desktop it lands on.

**The `screen-left` claim is unchanged, deliberately.** It serialises who owns the display; it
has no opinion about activation, and two harnesses politely taking turns still stole the focus
once each. Nothing about this ticket is a reason to loosen it.

## Where the windows go, and who claims the screen

`scripts/screen.mjs` finds the leftmost display and the harness places its windows there, off
to the side, so a run does not take over the desktop somebody is working on. With `--jobs 4`
the four lanes tile that screen rather than stacking, which is only cosmetic but makes a
failing run watchable. Headless Chrome ignores the position and honours the size, so both are
passed in either mode and the size is the half the layout depends on.

**`scripts/chrome.mjs` is the one place that decides how a harness launches Chrome** — the
shared flag list, `--headless=new` unless `--headed`, and the `findChrome()` that six files
carried byte for byte. Five harnesses had their own near-identical copy of that list, so wiring
the mode into each of them would have been five places for the next person to miss one.
`record-demo.mjs` keeps its own launch (`design/0007` — it is already headless, and a long
capture run needs flags a check run does not) and takes only `findChrome()` from it.

**Taking that screen is a claim, not a convention** (`decisions/0012`). `takeLeftScreen(owner)`
hands back the window arguments *and* the hold, and `leftWindowArgs` / `leftWindowPos` /
`placeElectronLeft` throw if this process does not hold `screen-left` — so a harness cannot
place a window and forget to claim the display, which is what four of the five callers did
until `github#37`. `leftmostScreen()` is geometry rather than placement and stays free.

## Two things may not run twice at once

`scripts/lock.mjs` is a machine-wide mutex, and it lives in the OS temp directory rather than
the worktree so **every worktree — and every sister project — shares one**. A name is the
resource, not the job (`decisions/0012`, `vault-graph#87`): `record` could only ever serialise
a recording against another recording, while what is contended is a display, and a harness
driving a window on it would not have thought to ask for a lock called `record`.

| name | the resource |
|---|---|
| `suite` | Chrome, CDP and a contended GPU: two full runs measure each other rather than the code |
| `screen-left` | the display this repo's harnesses park their windows on — all five of them |
| `screen-right`, `screen-primary` | the other two displays, claimed by the sister repo's recordings and spike tests |
| `record` | **legacy**, and transitional: kept only until the sister repo drops its own alias |

A `screen-*` acquire waits on a live `record` and `record` waits on any live screen, so the two
vocabularies collide during the changeover instead of passing through each other. Nothing in
this repo takes `record`, and nothing should.

```bash
node scripts/lock.mjs acquire screen-left --owner "who you are"   # blocks; exit 1 = give up
node scripts/lock.mjs refresh screen-left --owner "who you are"   # a long hold, kept alive
node scripts/lock.mjs release screen-left --owner "who you are"   # always, even on failure
node scripts/lock.mjs status
```

**You do not have to remember any of this for a run of anything in `scripts/`.** Every harness
that places a window claims `screen-left` itself and releases it on exit and on a signal;
`--lock-timeout-ms` says how long it waits before giving up. The command line above is for
driving a window by hand.

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
than a permanent one. Stale windows are 30 minutes for `suite` and 20 for everything else, and
`github#25` **reconsidered shortening them and deliberately did not** — see below.

**A hold says whether it is still alive** (`github#25`, `decisions/0012`). An in-process holder
writes its own pid and refreshes the timestamp every 30 seconds, so a dead holder's lock is
broken at once instead of waited out, and a live one never ages into being broken — including by
the sister repo, which reads the same timestamp and needed no change for that to work. A hold
taken from the command line writes no pid, because nothing it could write would still be true a
second later; `status` says `holder unverified` rather than pretending otherwise. The suite
checks that the lock is still its own while it runs, and **aborts rather than publishing numbers
measured on a contended machine.**

**A CLI hold beats for as long as a run is under it.** The two gated runs — the pre-push hook
and `release.ps1` — take `suite` from the command line and then pass `--no-lock`, so until
`github#25` the one hold whose numbers actually stamp a tree was the one hold nothing kept
alive and nothing checked. `--no-lock` now **adopts** that hold rather than ignoring it: the
run beats it under the caller's own owner, so their `release` still matches, aborts if it loses
it, and hands the caller's own shape back on the way out without removing the directory. A
`--no-lock` run refuses to start unless a **live** hold is there to adopt — one already dead
or past its window is not one to beat. The same abort covers the
display: a harness that loses `screen-left` mid-run says who took it and stops, rather than
finishing on a shared screen.

**A hold driven by hand is refreshed, not aged out.** An agent that claims `screen-left` to
drive a window itself has no run under it to beat, and the case `github#25` was filed about is
exactly that: a hold aged past its window during screenshot work and the sister repo's
`pre-push develop` broke it mid-run. `node scripts/lock.mjs refresh <name> --owner <id>` puts
the clock back — the issue's own "a heartbeat the holder refreshes" — and `status` now says how
long each hold has left, so there is something to act on before it matters.

**The stale windows stay 30 and 20, and that is the answer rather than a deferral.** Shortening
them can only break holders that are alive, and a live holder is not always a talking one: this
harness generates its fixtures and builds its page with `spawnSync`, which blocks its own beat
for as long as the child runs. Measured while this was being written — a five-minute window
broke a live in-process holder in another worktree at 301 s, which is the fault `github#25`
reports, reintroduced by the fix for it. Liveness **replaces** the question the window was
standing in for rather than shrinking it: a dead holder is broken in milliseconds by the pid
check, a live one is never broken by the clock, and the window is left as the backstop for what
liveness cannot see — a wedged process, a recycled pid, a hold nobody can vouch for.

`node scripts/lock.mjs --selftest` holds all of this — **25 cases against a throwaway root**
(`VAULT_LOCKS_HOME`), never the live mutex — and the pre-push hook runs it.

Screenshots need no lock *of their own*: they go over CDP, so overlapping windows are harmless.
Pass your own `--port`. But the window being shot is on the claimed screen, and `--shot` is part
of a suite run, so it is inside that run's `suite` and `screen-left` holds anyway.

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

`--headed` is a debugging aid and it **costs the stamp**: it is part of the run shape, and a run
whose shape differs from the default writes none (`github#50`, below).

The full suite runs on the push to `develop` (the pre-push hook). Do not run it by hand unless
asked — it takes the `suite` lock and minutes of somebody's machine.

## The run shape, and why a delta writes no stamp

A green full run stamps the tree it measured (`decisions/0010`), and the pre-push hook and
`release.ps1` then trust that stamp. A stamp names **which tree, against which fixtures, and
when** — so a flag that changes *what is measured* has to suppress it, or the stamp quietly
starts lying. Wiring `--headed` made that concrete: without this, a headed run of a
headless-default tree would stamp it, and both consumers would believe it.

`smoke.mjs` therefore declares the run **shape** and its defaults in one place, and any delta
sets `partial`, which already suppresses `recordPass()`. That generalises what used to be five
reasons enumerated by hand (`--only`, `--vault`, `--url`, `--look`, a bad fixture), so the next
flag that changes the measurement is covered without anyone remembering to extend a list.

**Fail-closed rather than truthful.** A stamp that recorded its own mode would only help if
every consumer remembered to compare it — today the hook and `release.ps1`, tomorrow whatever
reads it next. A run with a shape delta writes nothing, so they find no stamp and run the suite.

What is deliberately **not** shape, because none of it changes what is measured: `--jobs` (the
quiet run beside a recording is `--jobs 1`, and it is a full suite that must still stamp),
`--no-lock` (every gated push passes it), `--port`, `--chrome` and `--shot`.
