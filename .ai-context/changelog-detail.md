# Changelog detail

## 2026-09-12 — The hold follows the run; the window was reconsidered and kept (github#25)

> "a crashed worktree's abandoned lock and a healthy five-minute run are byte-for-byte
> indistinguishable, and the only discriminator left is age."

`github#37` landed two of this issue's three asks: an in-process holder writes its own live pid,
beats every 30 s, and the suite aborts rather than publishing numbers measured after it lost the
lock. What stayed open was the half the title is about — **a hold taken from the command line
has no liveness of any kind** — and that is not a corner. `.githooks/pre-push` and `release.ps1`
both acquire `suite` from the command line and then run `smoke.mjs --no-lock`, so the one hold
whose numbers stamp a tree was the one hold nothing kept alive and nothing checked.

**`--no-lock` now adopts the caller's hold instead of ignoring it.** The run beats it under the
caller's own owner — so the parent's `release` still matches — and hands the caller's own shape
back on the way out without removing the directory. A `--no-lock` run with nothing holding the
lock refuses at startup rather than measuring on an unguarded machine.

| a gated run | before | after |
|---|---|---|
| what it says | `--no-lock: the caller is holding the suite lock, not this run` | `ADOPTED suite -- beating the hold of pre-push review-25 for this run` |
| the hold's `at` while it lasts | frozen at the acquire | refreshed every 30 s — **+177 ms at a 50 ms beat** in the selftest |
| the hold's `since` after the run | — | **11 s**, the caller's own acquire time, kept |
| the hold's shape after the run | — | `holder unverified` again: `holder: "cli"`, no `pid`, owner unchanged, directory standing |
| the caller's own `release` | `RELEASED` | `RELEASED` — the owner never changed |
| losing the lock mid-run | nothing noticed until the eventual `release` | the beat names who took it, the run stops, nothing is stamped |
| `--no-lock` with nothing held | ran the whole suite unguarded | refuses, exit **1**, before a fixture is touched |

**A bare CLI hold is refreshed rather than beaten.** An agent claiming `screen-left` to drive a
window by hand has no run under it, and that is the case the issue was filed about — a hold that
aged past its window during screenshot work while the sister repo's `pre-push develop` broke it
mid-run. `lock.mjs refresh <name> --owner <id>` puts the clock back (`REFRESHED ... stale in
1200s`, `since` unmoved; `REFUSED` and exit 3 for anyone else), and `status` now prints
`stale in 1440s` beside each hold instead of leaving the arithmetic to the reader.

**The 30-minute window was reconsidered, and deliberately kept.** A shorter one was built first
and carefully — staleness asked of the hold rather than the name, 5 minutes for a hold declaring
`holder: "process"`, the name's own window for a bare CLI hold and for everything the sister
writes. Within the hour, verifying this very ticket, a `--only` run printed

```
BREAKING stale screen-left lock (age 301s, owner github#41 drive (after))
```

— a hold naming a **live** process, broken while another worktree was still using the screen.
That is the fault this issue reports, reintroduced by the fix for it. The cause is structural:
`smoke.mjs` generates fixtures and builds the page with `spawnSync`, which blocks its own event
loop and so its own beat for as long as the child runs. **A live holder is not always a talking
one.** So liveness replaces the question the window stood in for rather than shrinking it — a
dead holder is broken in milliseconds by the pid check, a live one is never broken by the clock,
and 30/20 stays as the backstop for a wedged process, a recycled pid, or a hold in the sister's
shape that nobody can vouch for.

A harness that loses `screen-left` mid-run now says who took it and stops, too — `takeLeftScreen`
passed no `onLost`, so all five of them could finish on a shared display as though nothing had
happened.

And the lock finally has a check that can fail: `node scripts/lock.mjs --selftest`, **25 cases in
1.0 s** against a throwaway root (`VAULT_LOCKS_HOME`), never the live mutex, run by the pre-push
hook beside the update-note selftest. Until now its behaviour was a hand-measured table in
`invariants.md`, which is not a thing that fails.

## 2026-09-12 — A plate dyes its whole run, from either copy of it (github#29)

> "right click on a plaque enables to set the color for all books under the plaque"

Asked for as new work; **half of it was already on `develop`** from `github#44`, and that half was
wrong in the case the issue names. One `renderTrack` call is one shelf row (`design/0014`), so the
plate's right-click was wired to the slice of its run that landed on that board, while
`openPlaque()` — the click, three lines away in the same file — resolved the run over the shelf's
whole sequence. Both plates of a wrapped run opened the same book; only one of them dyed all of it.
`design/0022`'s own table already said "wrapped rows included", and the check written for the
feature read the run as `plate.parentElement.querySelectorAll(".vs-spine")` — the row — so it
asserted the bug and passed. Measured, not reasoned: the new check was watched failing against the
old code before the fix went in.

| | before | after |
|---|---|---|
| a plate's right-click dyes | the books on **that board** | **the run**, over the shelf's whole sequence |
| `months` "2022", drawn 2 times over 12 books, 9 + 3 | | |
| — from the copy over the **9** | 9 keys | **12** keys |
| — from the copy over the **3** | **3** keys | **12** keys |
| the shelf's other books | 98 untouched | **98** untouched |
| through `setFilters({})` and `core.migrate` | — | **12 / 12** survive |
| a favourite pointing into the run | — | follows, with **0** keys of its own |
| *Automatic* on the other copy | took its own row off | takes all **12** off; every tint back string for string |
| a plate over a run of **1** book | showed a **spine's** lines (*Add to Favourites*, *Edit book…*) | shows **0** of them |
| what the menu says it will dye | the label alone | the label **and** `12 books under this plate` |

`runOver(shelf, under)` is the one resolution both gestures use — the body `openPlaque()` already
had, lifted out — so a plate cannot dye a set it does not open. `openDye()` takes **where the hand
landed** rather than inferring the menu's shape from `books.length`, which is what had let a
one-book run wear a spine's lines. The undo stays *Automatic* rather than gaining a word of its
own (`design/0022`).

The check searches for a run that is **actually drawn twice** instead of narrowing until the
longest one wraps. The first shape of it did the latter and could never pass: the longest run in
this vault is twelve months, and twelve spines fit one row at any width the library is usable at —
a run wraps when it starts late on a row, which is a fact about the shelf's packing, not the run's
length.

| | |
|---|---|
| `smoke.mjs` | 94 → **95 checks**, 95 runs, **35s** wall over 3 Chromes |
| the new check | **0.7s**, serial lane (it counts plates, so it reads the packing) |
| suite | **95/95** on the vault |
## 2026-09-12 — The plugin says what changed, once (github#33)

Ported from Vault Graph's `github#83` / `design/0016`, which was written against the same problem
in the same host: **Obsidian swaps `main.js` under a user silently.** A dismissible strip above
the library, once, on the first open after a MINOR or MAJOR.

The whole of `plugin/update-note.mjs` came across unchanged except for the control-id namespace
(`^vg-` → `^vs-`). What did **not** come across is where the marker lives, and it is the only
real engineering in the port.

### `core.migrate()` would have eaten it

Vault Graph merges its settings as `Object.assign({}, DEFAULTS, saved)`, so a key it has never
heard of survives a round trip. Here `core.migrate()` returns a **fixed shape**
(`decisions/0001`) and drops everything else — measured directly:

| | |
|---|---|
| `core.migrate({ schema: 10, lastSeenVersion: "0.1.0" }).lastSeenVersion` | `undefined` |
| `plugin.persisted().lastSeenVersion` | **`"0.1.0"`** |

So `lastSeenVersion` inside `Persisted` would have been written once by `recordVersion()` and
erased by the next settings change — and the strip would have come back on the open after that,
which is the one thing the feature exists not to do. It is held on the plugin instead and merged
back by `persisted()` on every `saveData`. The harness check *a settings write keeps the version
the strip recorded* is the regression test.

### What it cost

| | before | after |
|---|---|---|
| `main.js` | 161 KB | **173 KB** |
| `styles.css` | 125 KB | **127 KB** |
| `release.ps1 -SelfTest` cases | 10 | **11** |
| steps in the pre-push hook | 11 | **12** |
| `check-comments` | 1500 / 1500 | **1500 / 1500** |

The comment budget is worth a line of its own: that baseline is a **two-sided** ratchet sitting
at exactly 1500, so the port arrived **19 over** and all nineteen lines became pointers. The
reasoning is in `design/0023`, which is where `decisions/0007` says it belongs anyway.

### The strip in a real Obsidian

`scripts/update-note-check.mjs` drives one over CDP through seven seeded `data.json` states. Two
departures from Vault Graph's harness. It asserts nothing about a canvas, a camera or
`--vg-canvas-top` — the library is DOM, so the equivalent measurement is the room's own box with
and without the strip. And the **multi-release chain is seeded** rather than read from
`CHANGELOG.md`: this repo has one release, so the real chain can only be one link today. Which
releases belong in a chain is the selftest's question; that they are *drawn* oldest first, each
linking its own page, is the harness's.

### Badges

`README.md` gains release, license, stars and a Ko-fi badge on one line; `.github/FUNDING.yml`
and `manifest.json`'s `fundingUrl` give GitHub and Obsidian their own Support buttons. **No
Obsidian-downloads badge**: `obsidianmd/obsidian-releases`' `community-plugins.json` was read on
2026-09-12 and lists `vault-graph` and not `vault-shelf`, so that badge would have rendered an
error rather than a number. The Ko-fi tint is **`793b3d`**, leather's page accent — leather is
the look a fresh library opens in and what the hero is shot in, and the dark side's `#d0b681` is
too pale under white badge text.

Three of the four badges are grey today: the repository is private and has no release yet, so
shields has nothing to read. They start working the moment either changes, and neither is this
ticket's to change.
## 2026-09-12 — Turning the page is under the book (github#36, design/0025)

> "need an easy way to move to next or previous note in the book"

`Previous` and `Next` moved out of the reader bar — where a flex spacer had banished them to the
top-right corner of the window, beside two buttons that mean *leave this page* — into a footer
directly under the spread, with the place between them.

| | before | after |
|---|---|---|
| controls in the reader bar | 4 | **2** |
| what says where you are in the book | nothing | **`14 of 303`** |
| what names the arrow keys | nothing | **the glyph on the button that does it** |
| `←` with the caret in *Find within this book* | turns the page | **moves the caret** |
| controls in `every control is the same size in every look` | 37 on the vault (`invariants.md`) | **40**, 0 off by more than a pixel |
| the footer's top under the spread's bottom | — | **16px**, left edge and width shared exactly |
| look files changed | — | **none** |

Measured after the change and not before it, so they stand on their own rather than as a delta:
`a look moves nothing on the page` reads **4,298 elements in four states across three looks, 0
moved, 0 resized, 0 present in one look and not another**; `every control the keyboard can reach
has a name` reads **2,253 controls, all named**.

The buttons kept their ids, so `"previous and next walk the book and stop at its ends"` reads
identically on both sides of the change — it was the cheapest way to be sure the behaviour that
already worked (disable at `0` and at `notes.length - 1`, `Alt+←` to the previous collection)
survived the move. `.vs-spread`'s bottom margin went 30px → **16px**; that is the only geometry
outside the footer that moved.

`.vs-turn` and `#vs-place` are in the same-size check's `reading` list — `.vs-turn` for both
dimensions, since it shares the spread's `max-width`, and `#vs-place` for height only, because a
label's width along its own text is the face's (`design/0021`).

`PageUp`, `PageDown`, `space`, `j` and `k` were considered and deliberately left alone;
`design/0025` says why.
## 2026-09-12 — The jump strip comes out of the rail (github#38, design/0009)

*"i think the navigation to shelfs at the top needs to go"*. `#vs-jump` was the only child of the
top rail that grew (`flex: 1 1 auto`) and the only one that scrolled (`overflow-x: auto`). Measured
with `"the rail is fixed controls, and nothing in it scrolls sideways"`, which was written before
the removal so both readings come off the same instrument.

**At 1180px, the measure:**

| | before | after |
|---|---|---|
| the rail | 1 row, 47px | 1 row, **47px** |
| the vault's name | 102px, **clipped** | **116px**, whole |
| the shelf strip | **421px** of 1148px, scrolling | **gone** |
| the search box | 232px | 232px |
| the hit count | 96px | 96px |
| the gap | none | **407px**, as one `.vs-spacer` |
| order / look / Manage | 92 / 71 / 63 | 92 / 71 / 63 |
| sideways scrollers | **1** | **0** |

**At 860px, the narrow breakpoint:**

| | before | after |
|---|---|---|
| the rail | **2 rows, 93px** | **1 row, 51px** |
| the strip's own row | 828px wide, **overflowing by 57px** | — |
| the vault's name | 116px | 116px |
| the search box | 455px | 455px |
| sideways scrollers | **1** | **0** |

So the space went three ways: **407px** of deliberate gap between the search and the controls at
the measure, **14px** back to the vault's name, which the strip had been squeezing into an
ellipsis, and at 860px **a whole row of rail — 42px — back to the library**.

The 57px is the finding worth keeping: at **seven** shelves the strip already could not show itself
at 860px, and the builder makes twenty easy. That is why the check reads computed `overflow-x`
rather than only measuring today's boxes.

**Everything else held still.** The layout goldens do not move (6 shelves, 10 rows, 227 spines,
52 plaques, a 1125px room, in all three looks). `"a look moves nothing on the page"` walks
**4,221** elements in four states across three looks: 0 moved, 0 resized, 0 present in one look and
not another. `"the furniture is one material"` still reads **56** controls against the plaque with a
lowest contrast of **5.77:1** — the Manage row's name took the jump chip's place in the list of
things that must not wear a plate, so the count did not move. `"every control is the same size in
every look"` went **37 → 38** on the vault, because one chip left the list and the row's name and
its action button both joined it.

| | before | after |
|---|---|---|
| `__vs.counts()` keys | includes `jump` | `jump` gone |
| a pick shelf's count, read from | `#vs-jump [data-jump] .vs-n` → `"2"` | the shelf's own head → `"2 books · 135 notes"` |

## 2026-09-11 — Re-measured against the one vault (github#44, decisions/0014)

`develop` replaced the three fixtures with one generated vault while this branch was in flight.
The two entries below were measured against the three; these are the same numbers taken again on
the one, and they are what `invariants.md` now carries.

| | three fixtures | the vault |
|---|---|---|
| spines / books | 238 / 465, 77 / 194, 186 / 709 | **231 / 691** |
| a hover | 9.81 / 3.76 / 8.13 ms | **9.31 ms** |
| a full `refresh()` | 10.1 / 7.0 / 35.5 ms | **32.7 ms** |
| spines on screen clear of the sheet body | 123 of 155, 47 of 67, 77 of 93 | **49 of 82** |
| named controls the keyboard reaches | 344 | **337** |
| `smoke.mjs` | 91 checks × 3 shapes | **93 checks**, 93 runs |

The viewport differs too (1584×961 against 1264×1353), which is most of why the clear-of-the-sheet
fraction moved from 79% to 60%. It is still the majority of what is on screen, so `D-1` stands:
the room is worth repainting and a sample in the popover would have been a picture of a shelf
standing beside a shelf.

Both new checks carried no `on:` annotation, so they ran on all three shapes and now run on the
one without a line changing.

## 2026-09-11 — A plate dyes what is under it, and a shelf dyes itself (github#44)

> "right click on plague, change colors for everyting under the plague, right click on shelf the
> whole shelf" — and "live update for the ribbons as well, naturally"

The same preview, in the three other places the twelve are offered. Asked for while looking at
the first half of `github#44` running, so it ships on the same branch; it is a **new gesture**
rather than a preview of an existing one, and may want its own issue number.

| | before | after |
|---|---|---|
| places a colour is given by hand | a spine | a spine, **a plate's run**, **a shelf** |
| hovering one of the twelve there | did nothing | paints the whole unit, and its threads |
| written by a hover over any of them | — | **0** keys |
| written by a click on a shelf of 130 | — | **130** keys, one per book, by address |
| *Automatic* after that | — | **0** keys, room byte-identical to where it started |
| lines below the twelve (edit, delete, add to…) | a spine's | still a spine's only — **0** on the others |
| the shelf menu's first button | *New book here…* | *New book here…*, twelve below it |
| `smoke.mjs` | 90 checks | **91 checks** |
| `check-comments` baseline | 1500 | 1500 |

**A plate's unit is its run, not its label.** `design/0018` settled that a run is what is adjacent
and `openPlaque()` opens the same run, so a shelf a person has split shows two plates and dyeing
one dyes one. A plate says what is under it.

**A stamp, not a rule.** `setBookColors()` writes one `bookColors` key per book, exactly as
right-clicking each spine in turn would. A rule new books would inherit needs a field on `Shelf`
and a `migrate` clause, and `migrate` lives in `src/core`, which this branch was told not to
touch.

**The ribbons needed nothing.** A thread falls out of the board it is sewn into (`design/0008`),
so previewing a board previews its ribbon — on one spine or on a hundred and thirty. The check
reads `--ribbon` across the library and asserts it moved.

**Two suite checks took the shelf menu's first button by position**, which is how the twelve going
in above it was caught: the second made book came back holding **-1 notes**, because the click
that should have opened *New book here…* landed on swatch 1 instead. The twelve went below the
line — right-clicking a gap is a gesture about a position, so the act tied to that position leads
— and one of the two checks now asks for `.vs-railline` by name.

**The opening focus was a race, and the flag that guarded it was not enough.** The first shape
focused the swatch whose colour the slot already wore and swallowed that one focus event; Chrome
delivers it *after* the handlers are wired, so a late one yanked focus back and undid a preview.
Measured as a check that failed about **one run in four** on the 10k shape and never in
isolation. A menu of the twelve now holds its own focus (`tabIndex = -1`) and no swatch takes the
opening focus at all; **the first arrow steps onto the colour the unit is already wearing**, and
the arrow handler moved from the row to the menu, because with focus on the container a keydown
on the row would never hear it.

**Both new checks clear the palette, the ribbons and the hand-given colours before measuring.**
They read boxes, so they sit in the serial lane, and the checks that run before them there leave
all three behind; what these measure is a difference, and a leftover palette made a preview land
on the colour a slot already wore.

## 2026-09-11 — A swatch says what the library would look like (github#44)

> "colors should live preview when the swatch is open and hovering"

Hovering one of the twelve in the swatch popover now paints the library in it, live. Leaving
without clicking — pointer out, focus out, Escape, a click outside — puts back exactly what was
there when the popover opened. **A preview paints and nothing else**: it never writes
`settings`, never reaches `persist()`, and never moves a box.

| | before | after |
|---|---|---|
| finding out what slot 7 looks like | commit, look, change it back | hover it |
| `settings.palette` written by a hover trail of 12 | — | **0** |
| spine boxes / addresses / note counts across a preview | — | **identical** |
| room visible beside the sheet body (demo / sparse / 10k) | 123 / 47 / 77 of 155 / 67 / 93 | unchanged — it was always there |
| the scrim over it while choosing | **82%** | **40%** |
| hover cost, demo (238 spines, 465 books) | — | **9.81 ms** (17.95 before `readTheme` was split) |
| hover cost, sparse (77 / 194) | — | **3.76 ms** (6.40) |
| hover cost, 10k (186 / 709) | — | **8.13 ms** (14.39) |
| a full `refresh()` on the same three | 10.1 / 7.0 / 35.5 ms | unchanged |
| `--shot-open` | `manage`, `builder` | `manage`, `builder`, **`swatch`** |
| `smoke.mjs` | 89 checks | **90 checks** |
| `check-comments` baseline | 1500 | 1500 |
| named controls the keyboard reaches (demo) | 344 | 344 |

**The room, not a sample in the popover.** The issue asked for a position: the Manage sheet is
over the library, so a preview repainting books nobody can see would be theatre. Measured with
Manage open at 1264×1353 — the sheet body is 760×711 and **123 of the 155 spines on screen lie
entirely clear of it** (79%; 70% sparse, 83% on the 10k). The room is there. What was not there
was the light: `.vs-sheet` laid an 82% scrim over the whole library, so a slot going from maroon
to green read as a faint shift and the feature was invisible while working perfectly. The scrim
thins to 40% while the popover is open — `data-picking="1"`, one colour-only rule per look, no
geometry, no transition.

**Paint, not refresh, and the reason is not the clock.** `repaint()` re-reads the twelve, re-dyes
the bands they feed and re-sets three custom properties on every spine already standing. On the
two small shapes that costs about what a full `refresh()` costs; it is 4× cheaper only on the
10k. The reason to do it is that it touches **no geometry at all**, so "a preview moves nothing"
is true by construction rather than by argument, and `renderLibrary()`'s settle pass cannot run
under a pointer (`decisions/0013`).

**`readTheme()` split, and it halved the hover.** Its first half reads the look's own twelve with
the inline values lifted off — a second forced style flush plus twelve derived threads — and the
look cannot change under a hover. A repaint calls only `readSlots()`: 17.95 → 9.81 ms on the
demo, 14.39 → 8.13 on the 10k.

**Two traps in reading boxes, both found by the check failing rather than by thinking.** In the
parallel lane the first reading was **238 boxes of `0:0:0:0`** — the packing had not landed, and
the check would have compared nothing to nothing; it waits for a spine to have a width now, and
sits in the serial lane with every other box-reading check. And a shelf off screen carries
`content-visibility: auto`, so its spines have no box until the browser gets to them: one that
gains a box mid-check is the browser catching up, not a preview moving anything, so only boxes
that were real in the first reading are compared.

**Two things the harness could not see, found by looking.** The first: the preview worked from
the first build and was nearly invisible under the scrim — every number was right and the
screenshot said so. The second: a clip of the pointer crossing the twelve showed the room
changing *before* the trail started, which read as a bug and was not — the popover had opened
under a stationary pointer, so the swatch beneath it was genuinely hovered. What that chase did
find is real: **Chrome delivers the focus `openSwatchPick()` takes on opening after the handlers
are wired**, so "wired after the focus, so opening offers nothing" was false as written and is
now a flag.
## 2026-09-11 — A spine's title stopped touching the line under it (github#45)

> "the text should not reach the horizontal line of the book design ever"

Seen at 8× in leather: the **M** of a month spine crossed the lower rule of the title panel and
landed on the gilt band. `design/0021` had given the three looks one padding so that every look's
**box** was identical, and nobody checked it against the decoration each look draws **inside**
that box. The clearance was a leftover, and in leather it was negative.

Measured on the one vault (`decisions/0014`), before and after by the same isolated `--only` run
so the page state is identical in both — **231** titles, **924** painted rules in leather and
**462** in cyber, modern drawing none:

| | before | after |
|---|---|---|
| `.vs-spine` padding | `20px 3px 26px`, chosen | **`21px 4px 33px`**, derived |
| declared in `page.css` | **nothing** | `--spine-head: 17px`, `--spine-tail: 29px`, `--spine-rule-side: 4px`, `--spine-rule: 1px`, `--spine-clear: 3px` |
| nearest painted rule, leather | **−3px** (`"2026"`, box 21..105, tail band 102..109) | **+3px** |
| ...cyber | +7px, by luck | **+14px**, by construction |
| ...modern | none drawn | none drawn |
| leather's panel `inset` | `17px 4px 23px` — the lower rule six pixels inside the band | `var(--spine-head) var(--spine-rule-side) var(--spine-tail)` — symmetric |
| titles ellipsised, leather / modern / cyber | 15 / 10 / 26 | **23 / 13 / 37** |
| short covers left sideways | **4** — `Œ 学 読 map` | **7** — `Å Ü Œ מ 学 読 map` |
| sideways clearance, worst (reported, not asserted) | −2px leather, −1.5px cyber, both on a 19px spine | unchanged — it is the face's, not the box's |
| layout golden, all three looks | 6 shelves, 10 rows, 227 spines, 52 plaques, 1125px room | **identical** |
| `a look moves nothing on the page` | 4245 elements, 0/0/0 | **4245 elements, 0/0/0** |
| `smoke.mjs` | 91 checks | **92 checks, 92 runs, one vault shape** |
| `check-comments` baseline | 1500 | 1500 |

The check is the point. Every geometry check in the suite compares a box to a box, and a
binding's rules are **painted** — so all 91 passed while a glyph sat on a band.
`"a spine's title never touches a line the binding draws"` reads a pseudo-element's own border
box — off the spine's **padding** box, which is what an inset resolves against — **and the px
stops of every gradient it paints** (a run of 12px or less is a rule, wider is a wash), then
measures the gap to the title's box along the spine. Reverted against the old CSS it reports
`leather "2026" on a 132px spine: box 21..105, rule 102..109, -3px apart`.

**−3px, not the −2px a reading of the offsets gives**, and the correction is `--spine-rule`: a
rule set at `inset: … 23px` paints on 22..23, so the clearance owes a pixel to the rule's own
thickness at each end. Writing the check against the pseudo's **padding** box — which leather
narrows with a 1px top border of its own — is what surfaced it.

### And then the rail stopped being squeezed that far: `sideways` 7 → 1

> "characters in the encyclopedia should not have different positions and reading direction"

Looking at the rail, the tally above is the evidence and the three covers are not the defect. The
defect is that the rail draws the same kind of thing **two ways at all**, decided by a sub-pixel
font metric no reader can perceive: `É` (7.25px) and `У` (8.19px) stand up, `Å` (9.25px) and
`Ü` (9.67px) lie down. Four covers were already lying down on `develop` before this branch.

Not a script question — a **width** question. A one-note volume was squeezed to 19px, leaving nine
pixels between the declared side rules, and an accented capital or a CJK glyph is 9.25–13.53px.

```
var INDEX_MIN = 24;   /* was 13 */
```

| | before | after |
|---|---|---|
| Encyclopedia volumes upright | 29 of 35 | **35 of 35** |
| short covers sideways, whole library | 7 — `Å Ü Œ מ 学 読 map` | **1** — `map` |
| spines at the floor | 9, at 19px | 9, at **24px** |
| the rail against 1180px of room | 1127px | **1172px**, still **one row** |
| tightest upright cover | `У`, 0.81px to spare | `学`, **0.47px** |
| the title's box against the side rules, worst | **−2px** leather, −1.5px cyber | **+1px**, **+1.5px** |
| `a look moves nothing on the page` | 0/0/0 | **0/0/0**, 4293 elements |
| layout golden | — | **rewritten deliberately**: the Encyclopedia's first spine 42 → 40px and its last 18 → 24px, 13px right. Shelves, rows, spines, plaques, room identical; no shelf gained a row |

Widening the squeezed spines is also what turns the **sideways clearance positive** — that rail was
the only place the type's own box was wider than the room between the panel's side rules, which is
why `design/0011`'s 22–58px floor read as violated there.

**The `sideways` tolerance comes back down to 1**, by the same census argument that put it at 7.
`map` is what remains: a three-letter tag book on a 27px spine drawn 27.7px wide, which no
single-letter reasoning covers.

### The tally this ticket owed `github#47`: `sideways` 4 → 7

`github#47` pinned the probe's face while this branch was open and handed the number over
deliberately, refusing to relax it on a tree where it still read 4. With the pinned face and this
ticket's 4px inset, three covers fall — and all three by **under a pixel**, because
`squeezeIndex` (`github#34`) scales the Encyclopedia rail to **19px** so 4px of inset leaves nine:

| cover | the deciding face draws it | margin at 4px | at the old 3px |
|---|---|---|---|
| `Ü` | 9.67px | **−0.67** | +1.33 |
| `מ` | 9.45px | **−0.45** | +1.55 |
| `Å` | 9.25px | **−0.25** | +1.75 |
| `У` — the tightest that still stands | 8.19px | +0.81 | +2.81 |

(`github#47` predicted 9.30 / 9.50 / 9.70 from its own tree; these are the widths measured on the
merged one, and the three covers and the 4 → 7 agree.)

**Seven, and not a looser bound**, because the tally is a **census, not a tolerance**: it counts
covers, each derivable from two measured numbers, with no noise for a margin to absorb — the face
is pinned, the widths are note counts, and the run-to-run numbers are identical. Slack of three
would swallow `У`, `Р` and `É` the next time a face or an inset moved a pixel, which is the
failure `github#47` refused a constant for from the other side; and seven fails in **both**
directions where a round ten fails in one. `design/0021` carries the full table.

**The sides take `--spine-rule-side` and not `rule-side + rule`.** This branch first justified
that by the pixel flipping covers *per look*, which was true of the tree it was written on and
`github#47` has since made false. The reason that survives: sideways there is no glyph out past
the rule to protect — `--spine-rule` exists for the head and tail, where a rule's thickness is
real ink under the type — and the pixel would cost three further uprights on the squeezed rail
for nothing.
## 2026-09-11 — Uprightness is geometry, so one face decides it (github#47)

> "the same cover at the same spine width can fit in one look and not in another, and the answer
> is not a colour or a texture: it is the difference between a title laid out `horizontal-tb` and
> one rotated `vertical-rl`."

`fitsUpright()` appended its probe to the element carrying `data-look`, so the probe wore
whichever face the page was painted in. `page.css`'s `.vs-probe` block pins the probe title's
whole type at 0-5-0 — a look's own title rule is 0-4-0 and its sheet is concatenated after
`page.css`, so anything less would be settled by file order. The stack is written out instead of
`var(--ui)`, which leather redefines.

| on the one vault | before | before + `github#45` | after | after + `github#45` |
|---|---|---|---|---|
| faces the probe reads | **3** | **3** | **1** | **1** |
| covers oriented one way in one look, another in the next | 0 | **3** | 0 | **0** |
| upright titles clipped in any look | 0 | 0 | 0 | 0 |
| `a look moves nothing`: moved / resized / present-in-one | 0/0/0 | **0/20/0** | 0/0/0 | **0/0/0** |
| short covers standing upright | 33 | 32 | 33 | 30 |
| widest face over the deciding one | 2.93px | 2.06px | **1.45px** | **1.45px** |
| room left on the tightest upright cover | 0.97px | **0.08px** | 0.97px | 0.27px |
| Encyclopedia labels upright, in leather | 32/35 | 31/35 | 32/35 | 29/35 |
| `check-comments` baseline | 1500 | — | 1500 | — |
| `smoke.mjs` | 90 checks | — | **91 checks** | — |

**Nothing visible moves on today's tree** — 32/35 and 33 upright before and after, the same four
covers sideways (`Œ`, `学`, `読`, `map`). What changes is that the answer stops depending on which
look asked, which is what `github#45` was waiting on: with its 4px inset applied to this branch,
`a look moves nothing on the page` goes **20 resized → 0**.

The three that flipped are `Å`, `Ü` and `מ` at a **19px** spine, where `github#45`'s inset leaves
nine pixels of line box and the three faces draw a capital letter **8.4 / 8.9 / 9.3px** wide. The
looks had been agreeing by **0.08px** and nothing measured it.

No margin was added. A constant would be calibrated to the three faces shipped today and would
lay down covers that fit; the residual is asserted instead, by the new check —
`"a short cover is stood upright by one face, not the look's"` — which fails on the probe reading
more than one face (it does so on the before-tree, where nothing has flipped yet), on any cover
split across looks, and on any look's glyphs being clipped by another face's decision. It prints
the two margins nobody had: the widest face's spread over the deciding one, and the room left on
the tightest upright cover.

`design/0021` carries the reasoning and the rejected alternatives. `github#45` still owes the
`sideways` tolerance in `"a hovered spine shows one peek…"`, **4 → 7**; it is past 4 under
`github#45` either way — 5 with the old per-look probe — so it is that ticket's number to move.

## 2026-09-11 — The lock names a job; what the two plugins share is a screen (github#37, github#25)

> "only two places acquire a lock at all, nothing anywhere acquires `record`, and five
> harnesses park a headed Chrome on the leftmost monitor while four of them take no lock
> whatsoever."

Three acquire sites, all `suite` (`smoke.mjs`, `.githooks/pre-push`, `release.ps1`). Nothing
acquired `record`: the name was prose in `CLAUDE.md`, `AGENTS.md`, `design/0006` and the usage
string, describing a screen recording this repo does not make — `design/0007` says so in as many
words, and the two records had contradicted each other since `design/0007` was written.

| | before | after |
|---|---|---|
| callers of `screen.mjs` that place a window | 5 | 5 |
| ...of those, holding the display they place on | **0** | **5** |
| lock names | `record`, `suite` | `suite`, `screen-left`, `screen-right`, `screen-primary`, `record` (legacy) |
| VG holds `record`, VS wants `screen-left` | ACQUIRED — the silent ruin | **BUSY** |
| VG holds `screen-right`, VS wants `screen-left` | ACQUIRED | ACQUIRED — deliberately unmoved |
| a dead holder's lock | waited out its 1200 s window | broken in **3 ms** |
| a live hold, read 35 s apart | `at` fixed; the hold aged towards being broken | `at` +30,010 ms, `since` +0; a sister acquire measures **5 s** |
| a harness that cannot have the display | opened a second window on it | `BUSY`, exit **1**, no page built |
| `leftWindowArgs()` with no claim | returned a position | throws |
| `check-comments` baseline | 1511 | 1500 |
| `smoke.mjs` | 88/88 × 3 shapes | 88/88 × 3 shapes, unchanged |

`vault-graph#87` merged into the sister's `develop` (`a3e49e7`) mid-planning, which killed the
first shape of this change: a companion `record` hold beside every screen claim, priced against
a sister with no alias. Their alias closed that direction from their side and turned the
companion into pure cost — it would have blocked every right-screen recording for the length of
every left-screen harness run. `decisions/0012` keeps the reasoning, since the same trap is
waiting for the next cross-repo rename.

## 2026-09-11 — A look stopped moving the furniture, and the law got a check that walks (github#14, github#16)

> "shelfs still move when switching themes, because the shelf heading have a different font size"
> "modern is missing right index tabs in some books and the look a lot different from leather, we
> need to make themes real themes that do not have different component sizes"

`CLAUDE.md` has said a look *"may repaint anything and move nothing"* since `design/0016`. It was
enforced for a spine's size, the room's width and 38 named controls, and nothing else. Measured on
the demo fixture at 1180×900, walking every element under `.vault-shelf` in each look:

| | modern | leather | cyber |
|---|---|---|---|
| library `scrollHeight`, before | 2147 | **2258 (+111)** | **2161 (+14)** |
| library `scrollHeight`, after | **2186** | **2186** | **2186** |
| elements moved against modern, before | — | **818** | **679** |
| elements resized against modern, before | — | **307** | **282** |
| the new walk, after (demo / sparse / 10k) | — | **0 moved, 0 resized, 0 absent** in **4363 / 1979 / 3517** elements | the same |

`github#14` reported +108px and said `--board` was not involved at 3px in both looks. It measured
+111 and `--board` was **5 / 10 / 7** — the largest single contributor, because the board is
charged **twice per row**, to the floor grip's height and to the plaque's top margin. Two stale
numbers in one issue is the argument for the check rather than the paragraph.

### The audit, which had never been made (`github#16`'s item 2)

| | `leather.css` | `cyber.css` |
|---|---|---|
| geometry declarations | **52** | **28** |
| part declarations (a rule drawing what another look has not) | **25** | **16** |

The worst of the parts: **leather carried a whole private responsive layout** — its own
`@media (max-width: 860px)` and `(max-width: 520px)` blocks re-ordering the rail, wrapping the
shelf head, re-padding the reading page and re-drawing the tab strip, against a different one in
`page.css`. Below 860px the two looks were not the same product, and no check had ever opened a
narrow viewport in a look. Leather's was the better of the two and is `page.css`'s now.

### What moved, and why

| | before | after |
|---|---|---|
| `--board` | **5px** modern, **10px** leather, **7px** cyber, each declared on its own `.vs-track` | **10px** in `page.css`, one plank for every look — leather's, because a bookcase is what this is a picture of |
| `.vs-floorgrip` height | 13 / 18 / 15 | **18** everywhere |
| `.vs-plaque` margin-top | 14 / 19 / 16 | **19** everywhere |
| first spine, relative to its shelf's top | **41.3** modern, **47.3** leather, 41.3 cyber | **41.3** in all three |
| `.vs-shelfhead` height | 32.3 modern, **33.3** leather (it aligned on the *baseline*) | its buttons' height, centred, with a fixed line box on each label and no explicit height |
| `.vs-shelf` / `.vs-shelfhead` margin-bottom | 26 / 9, and **32 / 14** under leather | 26 / 9 everywhere |
| the spine's hover lift | 5px / 5px / **6px** | **6px** everywhere |
| a spine's padding | 10/15, **23/29** under leather | **20/26** everywhere; leather's raised bands are paint over the panel |
| an index tab's border | `border-right` in `page.css`, `border-left` in leather, `border-left: 0` in cyber | one side, one box |
| the builder's preview count (`#vs-previewcount`) | **15px** high under one face, **12** under another, with an explicit `line-height` on it | `display: inline-block`, so the line box decides — a bare inline box is sized by the font's own ascent and descent |
| the builder's `Vary book colours` label | inherited leather's 17px base, grew wide enough to wrap the row, and dropped onto a line of its own in one look | a form label is a control and `page.css` sizes a control: **13px / 22px** |

### The goldens had been taken in leather the whole time

`core.LOOKS[0]` is leather and a fresh library opens in it, so `scripts/layout-snapshots/*.json`
recorded **leather's** geometry — and the modern look sat **6px** off its own golden without
failing anything, because the check only ever ran in the look the page opened in. It runs in all
three looks now, against one golden, which a look that moves nothing makes possible. All three
goldens were regenerated deliberately: **6 shelves, 11 / 7 / 11 rows, 238 / 77 / 186 spines,
53 / 19 / 33 plaques, a 1125px room — every count unchanged**, only positions moved.

### A book with nothing to index (`github#16`'s item 1)

`dateTabs` refuses to cut three notes or fewer (`design/0015`, deliberate), and `renderTabs` still
drew the find glass — so the edge of the page carried **one orphan tab**. `.vs-tabs` now runs the
height of the page as a strip drawn from the plate tokens, with the glass at its head and the
tabs, when there are any, cut from it. Same part in every look. How a *present* index reads and
wraps is `github#32` and `github#35`.

### The check (`github#16`'s item 3)

`"a look moves nothing on the page"` replaces a list of 38 selectors with a walk over **every**
element under `.vault-shelf`, in four states — the library, an open book, the Manage sheet, the
builder — in every look `core.LOOKS` knows. It identifies an element by a path rather than a
selector, so a box nothing names is still compared with the same box in the next look, and it
prints how many elements it compared so the coverage is itself a measurement. It asserts a top and
a box across the direction the text runs; width *along* the text is the face's, and is held by
`"every control is the same size in every look"` (38, 0 off) and by the golden in every look.
It stops at a page of the open book — **1596 / 1584 / 6117 nodes** set on one, which are the
vault's content and not the page's furniture — and says so. `design/0021`.

Gates: `smoke.mjs` **89/89 on all three shapes** (it was 88; this adds one), `lint` 0 errors
0 warnings with `tsc` clean, `check-pii` clean (111 files, 6 names, 5 patterns), `check-scope`
clean (418 css rules, 72 ids, 96 prefixed classes), `check-network` clean, `check-comments`
**1511, exactly at the baseline**, `code-map.mjs --check` current.

## 2026-09-11 — Four generated vaults became one, and it got twelve times thicker (github#31, github#17)

> "only one vault for checks and demo recordings" · "we need way more notes in the demo
> fixture, at least make rolling last year much denser. also is the fixture deterministic?
> only dates move like in vault graph?" · and, settling it: *"lets say 5k notes spread over 11
> years always starting from today going backwards"*.

`decisions/0014` is the record — numbered 0014, not 0012, because `github#37` and `github#39`
took 0012 and 0013 while this branch was open. Both ends were measured before anything was
decided, because
the question is how far apart a fixture and a real vault actually are:

| | the demo fixture | a real vault, through its mirror |
|---|---|---|
| notes | 424 | 544 |
| in the rolling twelve months | **146 (34 %)** | **472 (87 %)** |
| busiest month | 45 | 174 |
| people | 17 | 125, of which 86 in three notes or fewer |
| tags | 43 | 141, of which 64 on one note |
| folders | 17 | 54 |
| empty weeks in the last 52 | 12 | 16 |

The fixture was not *even* — it already had an aged curve and long tails of people and tags.
It was **thin**. A month with three notes in it is not a shelf anybody recognises, and it is
the year every date shelf opens on.

### The vault

| | before | after | why |
|---|---|---|---|
| fixtures | demo 424, sparse 756, library 10,000 | **one, 4,938** | `decisions/0014`. No check was ever sparse-only — the suite ran the same 88 checks against each shape — so folding three into one drops coverage of those checks on those shapes, not a check |
| span | 15 years | **11 years**, ending today | asked for |
| notes in the rolling twelve months | **146** | **2,213** | github#17. 15× |
| notes per month, that year | 0, 3, 3, 4, 5, 5, 6, 10, 11, 16, 19, 23, 45 | **123 … 301, none below 123** | a declared recent regime instead of the tail of the aged curve; the tail is what was clumpy |
| empty months in the last 36 | 1 | **0** | asserted by the generator, not hoped for |
| empty weeks in the last 52 | **12** | **0** | the Weeks shelf is worth un-hiding now |
| ISO weeks holding a note | 226 | **459** | daily notes became a rhythm rather than a count |
| by year | 2011:5 … 2025:80, 2026:121 | 2015:54 … 2025:896, **2026:1,697** | recent-heavy, steeper |
| an empty year | none | **2019** | a 760-day hole in offset space, wide enough that a whole calendar year falls inside it at any `--end`. It is what the sparse fixture's two clusters five years apart were for |
| undated | 18 | **523** | a fifth of the notes that are not about a day, folded in from sparse |
| people | 17 | **25**, one in 613 notes and 11 in three or fewer | the tail had to become a COUNT — see below |
| largest folder | 100 of 424 (24 %) | 1,204 of 4,938 (**24 %**) | sparse's **82 %** dominant folder is **gone**, and is named as a loss in `decisions/0014` |
| the 10,000-note scale | the library fixture | **gone** | nothing measures the product at that size any more. Named as a loss |
| title deck | 135 phrases, 11 suffixes, 14 meeting names, 40 sentences | **362 / 26 / 30 / 100** | at 5,000 notes a 135-phrase deck is every title a dozen times with "(12)" after it |

### What the suite measured, before and after

| | before (3 shapes) | after (1 vault) |
|---|---|---|
| full run | **88/88 × 3, 75 s** | **88/88, 28 s** |
| cold, regenerating | 43 s | 66 s |
| spines drawn | 238 (demo) | **227** |
| addresses | 465 / 194 / 709 | **687** |
| books on Months | 130 / 30 / 122 | **110** over 4 rows |
| books on Years | 17 / 6 / 12 | **12** over 1 row |
| shelves placing a note in more than one book | 2 of 6 (People 495/424, Tags 683/424) | 2 of 7 (**People 5,963/4,938, Tags 8,090/4,938**) |
| the `0-9` volume | 168 of 424 | **2,097 of 4,938** |
| biggest book | `people/-unfiled`, 250 behind 16 tabs (demo) | **2,481 behind 11 tabs** |
| thinnest / thickest spine | 26px at 1 note, 53px at 227 | **40px at 54, 56px at 1,697** |
| fixture store | 6 directories, **31 MB** | 1 directory, **14 MB** |
| `docs/demo/index.html` | 664 KB, 424 notes | **1,573 KB** (228 KB gzipped), **1,242 notes** at `--notes 1200` |

**Twelve times the notes and the suite is 2.7× faster.** The cost was never the size of a
vault: it was three builds, three browser warm-ups and three serial lanes.

### A tail is a count, not a share

`bagFor` deals people proportionally to the slots that exist, so when the vault grew 12× every
share grew with it and **the person who was in one note was in thirteen**. The long tail the
People shelf exists to be lopsided about flattened out completely, and the generator's own
summary printed `0 people are in three or fewer` **without anything going red**. The eleven
tail people now carry absolute counts, dealt to their own slots before the shares are cut, so
the tail is the same tail at 900 notes or 5,000 — and the guard below fails if it ever
flattens again.

### The generator proves its own declaration

`design/0013`'s pattern, and every one of these was a real failure before it was a check: no
empty month in the last 36, no empty week in the last 52, a whole calendar year inside the
hole, the sentinels present, the people tail intact, and the written total within 8 % of
`--notes`. Proven non-vacuous: **exit 1 on `--notes 900`** (one empty month) and **exit 0 on
the declared vault**. A cut below about a thousand notes refuses rather than quietly stopping
being the declared vault, which is the size floor stated out loud — and is why the docs demo
is 1,200 and not 600.

### The determinism check was weaker than the law it named

The law: nothing consults the calendar except `--end`, and `--end` moves which dates the notes
get and **nothing else**. The check compared **per-folder note counts** at two end dates —
which passes unchanged if a title, a tag, a person or a whole body changed, as long as the
notes stayed in the same folders.

| | before | after |
|---|---|---|
| what it compared | per-folder note counts at two `--end`s | the same seed at the same `--end` is **byte-identical**; then, with every ISO date masked, the two end dates are the **same vault** whole and sorted; then, token by token, each date **kept its offset from `--end` or kept its literal** |
| measured | 3 generators clean | **4,938 notes in 17 folders; 7,057 dates moved with `--end`, exactly 1 is declared fixed** (the `2024-01-15` title) |
| proof it fails | none | **`--selftest`, 5/5** |
| run time | 6 s | 16 s (the selftest, 1 m 44 s, is not in the gate) |

**The "or kept its literal" clause needed a fence, and the first draft did not have one.** A
date that is the same in both runs is what a *declared* fixed date looks like — and it is
exactly what `new Date()` looks like, because two runs a second apart read the same clock. The
first draft of the check **missed a date drawn from the clock** for that reason, caught only
by staging the break and watching it pass. An anchored date within 400 days of *today* is now
a failure: both end dates are years away on purpose.

`--selftest` breaks the law four ways in a **copy** of the generator — never the tracked file,
which this gate reads on every push — and each staged break is verified to still build, so
catching it proves something. A tag from the calendar year, a title from the generation day, a
body sentence from `--end`, a date from the clock: **all four caught**, and all four are things
the old check passed without a murmur.

### A stride that was floored to a whole day

Caught in the correctness review pass, not by a check. `recentOffset` walks a folder's recent
notes across the working days of the rolling year, and its stride was
`floor(workdays / count)` — so a folder asking for 160 notes strode **1** and finished inside
the first 160 working days. Seven months, not twelve: the older half of the rolling year saw
nothing from that folder, and the check that says "no empty month" passed anyway because the
daily-note rhythm covered them. A fractional stride fixed it, and the year got flatter without
getting less recent-heavy:

| | floored stride | fractional |
|---|---|---|
| notes per month, rolling year | 115, 102, 151, 137, 158, 162, 179, 173, 179, 224, 275, **308** | 149, 123, 167, 137, 147, 149, 164, 160, 168, 210, 261, **301** |
| the leanest month | **102** | **123** |
| 2025 / 2026 | 799 / 1,795 | 896 / 1,697 |

### A check whose cost was proportional to the fixture

`"previous and next walk the book and stop at its ends"` walks a book one click at a time and
picked **the first** book with three notes — which is `encyclopedia/0-9`, holding every daily,
meeting and 1-1 note because they are all titled with a date. 168 notes at 424; **2,097** now.
Measured at **37 ms a click**, that is a **78-second** walk against a 10-second budget: it timed
out and took three checks down with it. It now picks the **smallest** book with three notes.
Nothing it asserts changed. The `0-9` volume being ~40 % of the vault is not new — it was 40 %
of the old one too.

### Found in passing, not caused here

`invariants.md` said a plaque hangs **12px** below its books clearing a **3px** floor. The
check has printed **19px over 5px** for as long as the before-run log goes back; the geometry
had not moved, the note about it had. Corrected.

### Reconciling with the suite audit (github#39), after the fact

This branch was cut before `github#37` and `github#39` landed, and the orchestrator refused the
merge: it would have landed a suite that cannot start.

**`git` merged `scripts/smoke.mjs` with no conflict at all.** `FIXTURE_NAMES = ["vault"]` and
#39's 61 `{ on }` annotations touch different lines — textually compatible, semantically
contradictory. #39's guard fired at module load, before the lock and before any Chrome, and
**0 checks loaded instead of 89**. A clean merge is not agreement, and the one file that needed
judgement is the one git said was fine.

The 61 annotations went and the mechanism stayed; `decisions/0014` argues it. Proven
non-vacuous afterwards: a staged `on: "demo-vault"` still fails the run by name, and the file
came back byte-identical.

**The win was re-measured, not re-typed** — #39's was arithmetic over three shapes:

| | three shapes | one vault |
|---|---|---|
| wall, after the lock | 41-43 s | **32 s** (two runs) |
| Chromes | 7 | **3** |
| check runs | 146 | **90** |
| check time | 34.1 s | **30.3-30.5 s** |
| checks | 89 | **90** |

Runs fell 38%, check time 11%. A run costs **234 ms** across the three shapes and **338 ms**
here: this vault is twelve times the demo fixture, and most of a check's cost is the page it
drives. Narrowing removed cheap runs; one big vault makes every remaining run dearer. Worth
saying plainly, because re-typing #39's table would have claimed a saving this branch does not
deliver.

Also in the merge: the golden re-taken against `github#14`'s geometry (the board's floor moved
every row), the two dead goldens kept deleted, and 33 `decisions/0012` references renumbered to
`0014` while `github#37`'s own 0012 references — the lock, the screen, the harness, the
recorder — were left alone.

### The film

`record-demo.mjs` preferred `.mirror-source` and fell back to the fixture. The default is
flipped: it shoots the vault the suite measures, and `--mirror-of <path>` is the opt-in. A
record that left the default pointing elsewhere would describe a policy rather than bind one,
and drift is what `github#31` was filed about — a film that opened on a shelf the narration
never mentioned. `make-mirror-vault.mjs` is untouched, guard included.

## 2026-09-11 — The gate holes were closed; the proof was not (github#27)

> "Bring the release practice level with Vault Graph's, and cut 0.1.0."

The three holes `vault-graph@8ed846a` closed were already closed here by github#5 — read
against our own copies: both sides of the CLI guard realpath'd, `record()` refusing a run
missing a fixture, `lookup()` requiring all three, the hook and `release.ps1` matching the
`passed the invariant suite` line, `close-issues.mjs` splitting on the first `..` (rehearsed on
`0.1.0..0.2.0` below). What was missing was the measurement.

| | before | after |
|---|---|---|
| `suite-stamp.mjs --selftest` | **16/16**, none of them through a link | **17/17** — the CLI spawned through a junction to `scripts/` prints its `suite-stamp: ` line and exits 0 or 1 |
| the CLI through a real `mklink /J`, by hand, before the case existed | exit 0, `tree d0ee696 passed the invariant suite ... (261 checks, commit 303dec5 ...)` | the same; the hole was closed by github#5, and this is the proof |
| a run whose sparse generator fails | `not stamping this run: a fixture that could not be generated is not the full suite` | `not stamping this run: a run without sparse-vault (the generator failed) is not the full suite` — 87/87 on the two shapes that ran, exit 0, **57 s**, no stamp written |
| `release.ps1 -SelfTest` | 10/10, every case `0 -> 0` tags | the same, **13 s** |

Two things the broken-generator run taught, both about the shared store. **Every fixture's
digest covers every generator**, so breaking one gives all three a new digest, and the two
that still generate are published under it; `fixture-store.mjs` then calls the newest
`.stamp.json` current, and every stamp on the machine misses (`fixture demo-vault is not the
one that passed (stamped 2f973453 ..., store has 1c12c5c8 ...)`) until the orphans are
removed by hand — two directories, `demo-vault-1c12c5c8` and `library-vault-e01daf6a`, gone
and `develop`'s stamp hitting again. And **a fresh Orca worktree has no `node_modules`**: the
first attempt reported `FAIL 0/87` on both shapes because `build-shelf.mjs` could not find
`esbuild`, which reads like a product failure and is `npm ci`.

### The count the docs quoted, and the one the stamp holds

| where | said | measured |
|---|---|---|
| `CHANGELOG.md` 0.1.0 | 37 checks, and 10 more inside a real Obsidian | **87 per shape, 261 a run**; the Obsidian harness was removed at `829725f` |
| `CLAUDE.md` | 76 | 87 |
| `decisions/0010`, `invariants.md` | 66 × 3 = 198 (true when measured, 2026-09-11 morning) | 261 by the afternoon; the dated measurements stand as history |

### The rehearsal on this branch

`release.ps1 0.1.0 -DryRun -AllowAnyBranch`, redirected to a log as the flow prescribes:
every guard passed (`-AllowAnyBranch` waiving the branch one), the `=== hero ===` warning
fired (`assets/demo.webp` committed 2026-09-10, `src/` moved 2026-09-11 — github#21), lint
clean, the plugin built (`main.js` 151 KB, `styles.css` 119 KB), `no stamp for tree e78a750`,
and then **87/87 on all three shapes, exit 0** — twelve parallel shards of 16–17 checks in
1–16 s each and three serial jobs of 22 in 11, 11 and 19 s — and `-DryRun: stopping before
the tag and the push`. Wall **1,117 s**, of which the first 17 minutes were `WAITING for
suite -- held by pre-push develop`: the sister repo's hook held the lock for its own
ten-minute run, a second Vault Shelf worktree queued behind it too, and the lock earned its
keep a third time. **It did not stamp**, and rightly: four tracked docs were edited while it
queued, so the tree it measured was dirty — `not stamping this run: the working tree differs
from HEAD in 4 tracked file(s)`. The guard doing its job on its author. The committed tree
was stamped by the full run that followed the records' commit: **87/87 × 3, exit 0, `stamped
tree 2b327f0`**, 85 s wall with about 30 s of it queued behind a third worktree's capture.
Two full runs in an hour, and both spent longer waiting for the lock than running.

### Gates

| | before | after |
|---|---|---|
| `check-comments` baseline | 1527 | 1527 (the two new comments are bare pointers) |
| `npm run lint` | 0 / 0 | 0 / 0 |
| `code-map --check` | current | regenerated after the `smoke.mjs` edit, current |

## 2026-09-11 — The glass tab is not a plate that drifted

Merging #10 on top of #9 and #3 produced a failure neither branch could have seen alone, and
#9's own check is what caught it. `"the furniture is one material"` reads every room plate
against the plaque, and its selector for the index rail was
`#vs-tabs button:not([aria-current="true"])`. #3 then put a **glass tab at the head of the
index** — a `<button class="vs-findtab">` that opens the find-within box — and that selector
swept it up: **4 off, one per room** (leather, modern, modern light, cyber), each reporting
`none / rgb(255, 255, 255) is not the lit plaque's`.

Nothing had drifted. A hovered glass tab is `background: var(--accent); color: #fff`,
deliberately, exactly like the current tab beside it and the primary button — both of which
this check already excludes, because **an accent-lit control is an exception to the one
material rather than a plate that lost it**. The selector now reads
`:not([aria-current="true"]):not(.vs-findtab)`.

The alternative was to bend the CSS until the check passed, which would have made the find tab
a plain plate and lost the thing that marks it as the way in. A check aimed at the wrong
control is a bug in the check.

After: **56 controls read against the plaque in 4 rooms**, rested, hovered and focused, lowest
contrast **5.77:1** at leather's lit plate, **0 off** — and the suite **87/87 on all three
shapes, exit 0**.


## 2026-09-11 — One material for the furniture

> github#9: "make the buttons look like the plaques and vice versa".

A plaque was engraved furniture and a button was a plain filled rectangle, in every look. A
button is a plate now: `page.css` declares the plate as tokens (`--vs-plate`, `-lo`, `-edge`,
`-ink`, `-shadow`, `-ink-shadow`, and a `-lit-` set for hover and focus), `button` and
`.vs-plaque` are both drawn from them, and each look restates the set in its token block —
brass under leather (the values the plaque rule carried, moved up), a lit acrylic sign under
cyber, a `color-mix` of the theme's own surfaces in modern, and a **bone** plate on leather's
paper sheets and pages, the way a dropdown on paper is paper (github#2). Hover and focus are a
token swap that paints nothing itself, which is what keeps the lit plate off a spine, a ribbon,
a swatch and a contents row; a look ships no hover rule for a button or a plaque at all. The
tracking is the line between the families — a plaque at 0.14 / 0.1 / 0.22em, a button at 0.03em
in every look — and `design/0019` carries the list of what the five families are made of.

Measured, one new check on all three shapes, the same numbers on each because it reads paint:
**56** controls against the plaque in **4** rooms (leather, modern dark, modern light, cyber),
rested, hovered and focused through `CSS.forcePseudoState`, **0** off; lowest contrast
**5.77:1** (the lit brass plate under leather), floor 4.5; tracking plaque/button **0.1/0.03**
leather, **0.14/0.03** modern, **0.22/0.03** cyber.

**Geometry:** *every control is the same size in every look* still measures **38** controls in
3 looks with **0** off, and *a plaque sits under the books it names* still reads **19px** below
over a 3px floor with 0px width difference. One drift the one-pixel tolerance had hidden is
gone: the leather plaque rule set `border` on all four sides, overriding `border-top: 0`, so a
leather plaque was **21.75px** high to modern's **20.75**. It is 20.75 everywhere, and the three
layout goldens were rewritten (`node scripts/update-layout-snapshots.mjs`): every plaque under
leather is **1px** shorter — `h: 22 → 21` in the golden's integer boxes — and each following row
sits 1px higher (the demo vault's fourth Months row: **753 → 750**; the 10k vault's fifth:
**937 → 933**). Nothing else in the goldens moved. Tracking widens a text-sized button by a few
pixels in every look alike — *Manage* **60.5 → 62.5px** under leather — which the same-size
check allows for a button that sizes to its text; *Newest first* still fits its pinned 92px
(scroll width 90, no overflow). The check was run against the branch point's stylesheets before
it was trusted: **FAIL on all three shapes** with the old CSS, exit 1; **ok** with the new.

Comments trimmed to pointers to hold `check-comments` at its baseline. 76 checks per shape.

## 2026-09-11 — A Favourites shelf you drag books onto

> "drag and drop shelf should be at the top as favourites"

`design/0018` gave any shelf a manual order, but a manual shelf still only holds the books its
own classifier makes. The library now opens on a **Favourites** shelf at position 0 that starts
empty and holds whichever books were dragged onto it, from any shelf, in the order they were
dropped. `design/0019` records the model; `decisions/0002` is what it rests on.

**A favourite is a reference, stored as the source book's address.** `ClassifierKind` gains
`"pick"`; a pick shelf carries `picks: string[]` and classifies nothing. `core.buildLibrary`
builds the ordinary shelves first and the pick shelves against them, so a shelf at position 0
resolves against shelves that come after it, hidden ones included. The favourite's key is the
whole source address, so its own address has two slashes (`favourites/years/2024`) — nothing in
the page splits an address on more than the first one, and the drop check now carries the case.
Label, notes, bands and plaque (`null`) are the source's, live.

**`picks` is the only list.** A pick shelf is `manual` always and never carries `order`:
membership and sequence are one question here. One write serves add, move and remove
(`core.pickBefore` / `core.unpick`), made against what the **unfiltered** library resolves — so
a dead pick is dropped on save and never on read, which is the argument `design/0018` makes
about a manual key under a filter.

**Schema 9 → 10.** A file without a pick shelf gets one at position 0 and every other shelf
moves down one place in the order it already had; a file already at 10 is left alone, and one
whose own shelf took the id gets `favourites-2`. A hand-edited pick shelf comes up normalised:
of `["years/2024", 7, "years/2024", "nope", "", "people/Ada Lovelace"]` the two real addresses
survive, `order` is dropped and `plaques` goes off.

**The ribbon is the board's own colour, deeper.** *"the complimentary default color ribbon for
the standard leather book is ugly as hell, suggest something better ... I don't [think]
complimentary works here."* Right: an opposite hue is for two colours competing for attention,
and a ribbon is not competing with the book it is sewn into — a binder does not put green silk in
an oxblood book. `threadOf()` is the old `complementOf()` with the hue turn taken out; the
saturation lift and the lightness push stay, because the separation was never the problem. A grey
keeps the one warm thread. Measured: **21/21** spines keep their board's hue, **21/21** a fifth of
the lightness away.

**The drag layer, reworked.** *"the dragging a book between 2 books is flakey"*, *"shelf dragging
has no indicator at all where the shelf will end, let me drag the whole shelf with preview and
make space for it"*, *"make the open book a bit smaller, the clicking outside of it is fragile"*.

*A book.* The spine answered `dragover` for itself, and the gap a mark opens is the target's own
margin — so the moment it opened, the pointer was in the gap rather than on the book, the mark
cleared, the gap shut, and it started again twice a second. The **row** hears the drag now and
picks the place by geometry, so opening a gap cannot take the target away from the pointer. The
gap is the carried book's own width: **53px for a 47px book**.

*A shelf.* It leaves the room while carried and a **ghost of its own height** — named, outlined —
stands wherever it would land, pushing everything below it down by what is coming back. Measured:
**226px**, *Years · 17 books*, and nothing left behind afterwards.

*The book on the desk.* The spread filled the measure, so the desk you click to put a book down
was a few pixels at the edges. It is inset by 96px: the desk beside it went **42px → 90px**, and
the note is unaffected, being capped at 66ch anyway.

**The look was painting over the thread.** The tonal rule was only half of it: leather hard-coded
`#ad5447` on every `.vs-ribbon`, so no book's own thread ever reached the shelf in the look a
fresh library opens in. Both looks paint `var(--ribbon)` under their own sheen now. The check
that should have caught it was reading the custom property rather than the paint, and passed; it
reads `backgroundColor` now and compares it to what the book asked for. Demo: **6** distinct
threads where there was **1**, **22/22** painted as chosen.

**A magnifying glass at the head of the index.** The reader's right-hand strip jumps to places in
the book; the box that searches *inside* the book is at the top of the left page, where nobody is
looking while reading the right one. A glass tab above the index scrolls the left page up and
puts the cursor in that box — **400px → 0** and focused — and Ctrl/Cmd+F does the same. It is the
same height as a year tab (15 × 1.15 is 11.5 × 1.5), and every check that counts index tabs
excludes it, because it names an act rather than a position.

**The colour picker offers the twelve.** A slot's swatch opened the operating system's picker —
sixteen million colours and none of the library's own — so putting slot 7's dye on a ribbon meant
reading a hex out of one control and typing it into another. It opens a popover of the twelve,
with *Custom…* behind them and the way back to the look's own on a changed slot.

**A shelf can be deleted from the sheet it is edited in**, not only from Manage, and it asks
twice there too.

**The room parts where a thing will land.** A 3px bar in a 3px gap said where without saying that
anything was about to happen. The neighbour steps aside and the bar stands in the gap: a book's
neighbour **0 → 18px**, a shelf **0 → 34px**, both settling back. It is the parting the query
already does to the room, one gesture along.

**Three things Manage could not do.** *"there is no delete shelf button"*, *"when I add a shelf
with the top new shelf button i want it to be on top"*, *"make the shelf floor draggable to re
arrange shelves"* and *"for that make shelf floors a bit thicker"*.

A Manage row gains **Delete**, which arms on the first press and deletes on the second — no
`confirm()`, because inside Obsidian that is the app's modal and reads as a bug. It takes the
deleted shelf's wear and hand-given colours with it, and the favourites pointing at its books,
which is `design/0019`'s rule that a dead pick goes on save. A reading place survives, because it
names a note. The empty-room card now tells the two causes apart: every shelf hidden offers *Show
every shelf*, every shelf **deleted** offers *Build the default shelves*.

**The + New shelf at the top builds at the top**, and the one at the foot appends. Both used to
append, so the top button sent the shelf past everything.

**A shelf is carried by its floor** (`design/0014`), dropped on the half of another shelf it
should land on. The grip is a transparent strip laid over the board rather than a floor rebuilt
as an element, sized from `--board` so all three looks keep their own painting of it — and
`--board` went **3px → 5px**, because a hairline is fine to look at and impossible to grab.
Leather already painted **10px** and is unchanged. Measured: grips == rows, an *after* mark on
the lower half, **0** marks left behind, and a book dragged in the same breath leaving the shelf
order alone.

**A pick shelf is a kind of shelf, not one shelf.** *"allow users to add multiple favourite type
shelfs"* — so "What makes a book?" gains **Books you drag onto it**, and a library can hold as
many as it likes. The form drops the source question, the order and the recipes but keeps the
classifier, which is the way back out; the right-click menu offers one line per pick shelf, by
name; a spine's peek names the shelf when there is one and counts them when there are more. A
book can be on several at once, each reference its own, which is the product's own law one level
out. Measured: **2** shelves over **2** rails holding **1 and 2** books, the shared year carrying
**2 addresses**, and taking it off one leaving the other at **2**.

**Dragging one off takes it off.** Carry a favourite off the rail, drop it anywhere else in the
library, and the shelf loses it; the shelf you dropped it on does not gain it, because
`takes` only lets a foreign spine land on a pick shelf. It is bound to a **drop** rather than to
`dragend` so that Escape and a drop outside the window both cancel — a book thrown away by a
change of mind is the one unrecoverable act here. The spine left on the rail goes to a dashed
outline while the drop would remove it. The menu line stays as the pointer-free path.

**The interaction.** Every spine in the library is now `draggable` — **17/17**, **6/6** and
**12/12** Years spines on the three shapes — while **0** of them became `data-hand` handles:
lifting is not arranging, and an automatic shelf still takes no drop. The Favourites rail is a
drop target along its whole length; the empty one draws a dashed landing **132px** tall saying
*Drag a book here* and takes the accent while a book is over it; once there is a book on the
shelf the **3px** mark from `design/0018` says where the next one goes. The `#vs-dye` menu gains
one line — *Take off Favourites* on a favourite, *Add to Favourites* on any other spine.

**What was measured.** A Years book dropped on the empty rail arrived with the source's
**2 / 70 / 303 notes** (demo / sparse / library); a People book dropped past it landed second;
dragging it onto the first's left half reversed the two and left **0** marks behind. A rebuild,
a folder filter (**4 of 40**, **96 of 115**, **68 of 843** notes) and `core.migrate` over the
blob all read back the same picks, with the favourites' addresses unchanged. A year and one of
its months on the shelf give **3 places / 2 unique**, **86 / 70** and **338 / 303** notes, and
the shelf claims the unique count. Hiding the source shelf keeps **2 of 2** resolving; deleting
it leaves **1 of 2** drawn with both picks still in the file until the next save.

**The reader was told nothing.** Opening a favourite opens the source book, so `resolveReading`,
`alsoShelvedIn` and the wikilink search skip pick shelves: a favourite is a way to reach a book,
not a second place the note lives. The spine still carries everything that is about the source —
its wear, its ribbons, its hand-given colour.

Addresses did not move, because the shelf ships empty: **447 / 194 / 709** on demo / sparse /
library, the same list element for element across a rebuild. `__vs.counts().shelves` is **6 ->
7**. The suite is
**66 → 74** checks (eight new, and *the six default shelves* is now *the seven*), green on all
three shapes.
## 2026-09-11 — A plaque opens its run

> github#6: "would be cool if clicking a plaque does something".

A plaque was a `<div>` and a label. It is a `<button>` now, and clicking it opens the run under
it as one book: the union of the books it names, **unique notes**, in the shelf's own reading
order, with the index tabs cut the way any book's are — a year's contents fall into months, a
decade's into years, a letter's into the span it covers, with no new code in `indexSections`.
`design/0019` argues open over narrow (a filter changes the library; the product's verb is
open) and an address over none (a book you cannot leave a ribbon in is not a book).

**The address is `shelfId/-plaque-<label>`**, and the plaque-book is never on the shelf: it is
synthesised from the run when asked for, so `__vs.addresses()`, every count and the layout
golden are exactly what they were. `findBook` and `core.resolveReading` fall through to it,
which is what makes a ribbon left in `years/-plaque-2010-2019` re-resolve through a rebuild and
put the plaque-book on the Reading shelf as a spine. On a manual shelf a plate opens **the run
under it** (`design/0018`), so a letter split into two runs is two plates that open two
different books under one address, and re-resolution picks the run that holds the note — the
law's own rule, one level down.

Measured, three new checks on all three shapes:

| shape | plate | unique / sum / books | tabs | plate drawn twice | ribbon in a plaque-book | manual split |
|---|---|---|---|---|---|---|
| demo | `Tags · A` | **145 / 158 / 7** | 16 | `2016`, same book | `years/-plaque-2010-2019`, 105 notes, survives rebuild | `acoustics`: 1 vs 145 |
| sparse | `Tags · A` | **199 / 263 / 4** | 4 | `2026`, same book | `years/-plaque-2020-2029`, 605 | `archive`: 63 vs 160 |
| 10k library | `Tags · A` | **4,501 / 5,519 / 5** | 11 | `2018`, same book | `years/-plaque-2020-2029`, 6,431 | `archive`: 1,097 vs 3,778 |

**The button moved nothing.** The host's button geometry — this page's own 26px minimum
height and Obsidian's — is reset on `.vs-plaque`; the plate still hangs **19px** below its books
over a 3px floor with **0px** width difference, *every control is the same size in every look*
still measures **38** controls with 0 off, and the three layout goldens are byte for byte what
they were. Hover and focus are paint in each look: a brighter border and the reading colour in
modern, a lit brass plate in leather, a neon glow in cyber. The reader's meta line says what it
opened: `41 notes across 12 books · 9 source folders` for the demo vault's 2024.

`--shot-book` now falls back to opening an address that is not on a shelf, so the picture of a
plaque-book is `--shot-book months/-plaque-2024`. 75 checks per shape.

## 2026-09-11 — The hash comes off a tag book's cover

> github#12: "remove the tag symbol from book covers reads badly".

`core.labelFor` named a tag book `#garden` and the spine drew that label sideways at 10.5px:
a punctuation mark set vertically, the one glyph on the shelf that read as noise. `Book.cover`
is a second form — `coverFor(key, kind)`, the bare key for a tag book and `labelFor` for
everything else — and the spine's title and its upright rule read it. Nothing else does: the
peek, the dye menu heading, the reader's title bar, the book heading and the *also shelved in*
chips all keep the label, and `design/0002` says why: horizontally the hash is how a tag is
written and what keeps `area/health/sleep` from reading as a folder path.

A label is not an address. `key` is untouched, so no book moved, no count changed, no address
differs; the check compares `__vs.addresses()` before and after element for element. Measured
on the demo vault: **16** spines on the Tags shelf, **0** covers open with `#`, **15/15**
tagged books' labels still `#`-prefixed, **16/16** peeks lead with the label; `Tags ·
#garden/seeds` in the title bar and `#garden/seeds` in the heading. Sparse: 10 spines, 9/9;
10k library: 14 spines, 13/13, and both `Tags:` chips under its first note hashed.

**And the upright rule learned to measure.** Three characters or fewer stood upright, and
`map` — three without its hash — stood up on a three-note spine 22px wide, where a screenshot
showed `m…`. Every check was green; only the picture saw it. `fitsUpright()` now measures the
cover on a probe spine of the real width under the root, in the look's own face, and a short
cover that does not fit stays on its side. Demo vault: `学び` stands, `map` does not; **20/20,
23/23, 27/27** Encyclopedia volumes still stand, and **0 of 21, 23, 27** upright titles in view
are clipped — a number the peek check did not have before. 72 checks per shape.

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

## 2026-09-11 — One answer to which fixture is the current one

Merging #7 (a new demo fixture) on top of #5's layout goldens and #8's fixture-store fix
produced a failure neither branch could have seen alone: **the goldens were re-taken against
the vault nobody was measuring.**

`scripts/update-layout-snapshots.mjs` picked its fixture with `readdirSync(store).sort()` and
took the **last** name. That was harmless while the store held one directory per fixture —
which stopped being true when #8 stopped a regeneration deleting its siblings. The store then
held `demo-vault-2f973453` (424 notes, written by the new generator) and
`demo-vault-5bd2a221` (396 notes, stale), and `"5bd2a221"` sorts after `"2f973453"`, so the
updater measured 396 notes and wrote a golden the suite immediately failed against: **26
differences, encyclopedia 29 books against the golden's 20.**

Five scripts reached into the store this way and **three disagreed with each other**:
`update-layout-snapshots` and `refresh-check` and `teardown-check` took the last name,
`suite-stamp` took the **first** (`.sort()[0]`), `record-demo` took whatever `.find()` returned.
Two of those disagreeing is worse than either being wrong: `suite-stamp` would have vouched for
a tree the suite never measured.

`scripts/fixture-store.mjs` is now the one answer — **the build whose `.stamp.json` was written
last**, which is what the last suite run used. No hashing, so nothing can drift out of step with
the digest `smoke.mjs` computes. All five scripts call it.

Goldens re-taken against the current fixture: demo **5 shelves, 8 rows, 198 spines, 40 plaques,
room 1125px**; sparse **5 / 6 / 77 / 19**; library **5 / 10 / 186 / 33**. Suite **70/70 on all
three shapes, exit 0**. Comment baseline 1304 → 1320.


## 2026-09-11 — A demo fixture that reads like a vault

> github#7: "make the demo fixture more fidelic to show off all the different features"

`scripts/make-demo-vault.mjs` was visibly a generator. Its prose was a bag of fifteen
bookbinding nouns shuffled into sentence-shaped runs; its titles were `<Subject> — <facet>`
permutations off a deck of sixteen subjects, so the Encyclopedia's **G volume was 25 notes all
called "Greenhouse Rebuild — …"** and its index had one tab; its eight people were spread
evenly, so the People shelf was eight books of roughly the same thickness; and several things
`docs/features.md` promises had nothing in the vault to show them.

**What the vault is now.** 424 notes (was 394) over fifteen years to the `--end` day,
recent-heavy: **5 notes in 2011, 121 in 2026**. A PARA-ish tree of ten numbered folders with
**four nested ones** (`01 - Projects/Website Migration`, `02 - Areas/Health`,
`03 - Resources/Field Notes`, `05 - Meeting Notes/1-1s`), a `Templates` folder and `Home`,
`Dashboard` and the wide table at the root — **17 folders on disk, 12 the folder classifier
sees**, since it reads the top segment. **16 named people on a long tail**: Mira Vance in 44
notes, seven people in three or fewer, one in a single note. **43 tags** — three levels deep
(`area/health/sleep`), two non-Latin, three over thirty characters, and eighteen on exactly
one note each. Four properties worth a shelf: `status` (5 values), `type` (9), `priority` (3),
`area` (6). **18 undated notes**, and four headers that are not dates at all.

**People three ways, because the setting is a list.** `attendees` on a meeting note, a
`person` scalar on a 1-on-1 (whose title is then `2019-04-02 1-1 with Tomas`), and `people` on
everything else — plus the two sentinels, untouched: `Dagny Halvorsen` in **43 bodies and 0
people lists**, and `Halvor Estrin` in **36 bodies, half of them `[[Halvor Estrin|Halvor]]`**,
in no property at all, earning exactly one book of 36.

**Prose, not a bag of words.** Forty whole dull sentences dealt from a shuffled deck rather
than drawn one at a time, because drawing independently put the same sentence twice in a
paragraph often enough to see it. Headings, bullets, task lists, numbered lists, blockquotes,
callouts, fenced code, inline code, tables, bold and italics, each where that kind of note
would carry it — **emphasis in one sentence in fifty**, which is a dozen-odd notes rather than
the two hundred a tenth gave: most notes a person writes carry none, and the export the docs
site ships prints the markers rather than drawing them. The picture caught what the numbers could not: a three-line agenda reading
"2. book the collection slot / 3. book the collection slot", because each item was drawn
independently too. Items within one list are distinct now; the deck is per-list, so a
recurring chore still recurs in the next note.

**Titles with real first words**, which is the whole of the index-tab change:
`M` now holds **23 notes behind `Ma Me Mi Mo`**, of the 17 prefixes its titles admit. The
`0-9` volume stays the big one at **168 of 424**, because the daily, meeting and 1-on-1 notes
are titled with an ISO date. Daily notes arrive in **runs of one to seven consecutive days**
rather than as a uniform sprinkle, which is what gives a month book day tabs that separate
anything.

**The numbers that moved**, demo vault, before → after:

| | before | after |
|---|---|---|
| notes / folders / people / tags | 394 / 11 / 8 / 15 | 424 / 17 / 17 / 43 |
| spines drawn, addresses | 182 / 194 | 238 / 465 |
| People, Tags (places / unique) | 478/394, 516/394 | 495/424, 683/424 |
| the `0-9` volume | 187 of 394 | 168 of 424 |
| biggest Encyclopedia volume | `G`, 25 notes, **1** tab | `M`, 23 notes, **4** tabs |
| biggest book in the vault | `people/-unfiled` 228 / 20 tabs | `people/-unfiled` 250 / 16 tabs |
| plates across every shelf | 40 | 52 |
| Months books over rows | 136 / 4 | 130 / 4 |
| a folder filter | 394 → 112 → 394 | 424 → 100 → 424 |
| `#garden` with / without children | 78 / 38 | 110 / 62 |
| the wide table's widest cell | 1,981 chars | 2,048 chars |
| library rows at 2560 / 760px | 15 → 25 → 15 | 9 → 16 → 9 |

**Everything the checks pin stayed pinned.** The two sentinel names, the `type: people` notes,
the wide table at 12 rows and 6 columns with one ~2,000-character cell, `--end` / `--days` /
`--seed`, and 350–500 notes. Two runs at the same seed are byte-identical, and
`check-generator-determinism` reports **424 notes over 17 folders, identical at `--end`
2024-02-10 and 2027-09-28** — the daily-note runs are drawn from the same `--end`-independent
offsets as everything else. **66/66 on all three vault shapes, `smoke exit=0`.**

**Four impossible date headers, not two.** `date: 2024-15-01` on a note whose *filename* is
`2024-01-15 …` falls through to the filename and is right; `date: 2023-02-30` on a note with
nothing to fall through to is Undated, which is the honest answer. The other two are the
`Templates` notes carrying `date: {{date}}` — a placeholder is not a date either, and a real
vault has them. The same folder carries `people: [[{{VALUE}}]]`, which `core.cleanPerson`
must read as nobody: it does, and the People shelf grows no `{{VALUE}}` book.

**What the fixture cannot fix.** The standalone's fallback renderer
(`renderMarkdownInto`, `src/page.js`) knows headings, lists, blockquotes, tables and
wikilinks. It does **not** know inline emphasis, inline code, fenced blocks, numbered lists or
callouts, so in the export the docs site ships — and only there; inside Obsidian the app's own
renderer draws all of them — `*overnight*` prints its asterisks and a `> [!note]` callout
prints a blockquote whose first line reads `[!note]`. That is visible in the longest note in
the vault. The constructs stay, because the vault is a vault and `github#7` asks for them;
the renderer is `src/` and is somebody else's to widen.

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


## 2026-09-11 — A book made on the shelf

> "ability to create books directly in the UI by right clicking an empty space in the favourite
> rack, for example a book dailys pointing at the daylis folder"

A pick shelf held only references (`design/0019`). It now also holds books **made** on it: a
name and a source predicate — folder, tag, person, the whole vault — standing beside the
favourites in the manual order, at the place the right-click landed. `design/0020` records the
model and why the two bigger shapes from the issue were left.

**A made book is a pick with a definition beside it.** Its key is `-made-<slug>` — no slash, so
never an address — and it goes into `picks` like any reference, so the sequence stays one list
and the drag, Alt+Arrow and `pickBefore` work on it unchanged; the definition lives in
`Shelf.made` under that key. The key is fixed at creation, so a rename keeps the address.
`liveOn` adds a shelf's made keys to what its list is saved against; without it `pickBefore`
dropped a made book on every save. No schema bump: `migrate` keeps a made key only while `made`
defines it, and appends a definition the list forgot.

**A reference is not a place a note lives; a made book is.** `resolveReading`, `alsoShelvedIn`
and the reader's nearest-shelf search skip *references* now (`core.isReference`) rather than
pick shelves, so a ribbon in Dailies resolves to Dailies, is drawn on its spine, and puts it on
the Reading shelf, and *also shelved in* offers it while still never offering the favourite
beside it.

**Edit and delete on the spine's own menu**, under the twelve: *Edit book…* / *Delete book*,
no *Take off*. Dragging it off the rail deletes it by the same drop-not-`dragend` path a
favourite comes off by, so Escape cancels. Another pick shelf refuses it, and the take-off
drop declines while over one, so carrying Dailies onto a reading list does nothing rather
than losing it. A source the vault has lost leaves an **empty spine**, kept through a save —
a definition is a person's, unlike a dead reference.

Measured — demo / sparse / library: the book made on the biggest folder holds **112 / 620 /
694** notes, exactly the folder's; with a year favourite beside it **120 / 690 / 997** places
are **119 / 629 / 973** unique notes and the header says so; a second book right-clicked into
the gap before the year lands between them; renamed and repointed at the top tag it keeps
`favourites/-made-dailies` and holds **78 / 73 / 1198**; a drop on Years deletes it and Years
still has **17 / 6 / 12** books; the vault's **396 / 758 / 10000** notes are byte-identical
across making, editing, emptying and deleting. The empty landing now reads *Drag a book here,
or right-click to make one*. Two checks, 79 in the suite; the demo film gains `makebook` and
`editbook`, and the recorder draws a pointer of its own because the camera has none.

**Then: any shelf arranged by hand, and a plus.** *"should work on all manual book shelfs, I
would like a plus symbol for a book on the left that moves with the edge of the books on the
shelf please very subtle."* The first cut allowed a made book only on a pick shelf; the line
that matters is whether a person has taken the sequence in hand, so it lives on any `manual`
shelf now, its key in `order` where a pick shelf's is in `picks`, built after the classifier's
books and counted into the same set. Switched back to automatic the shelf keeps it, sorted
last. Every hand-arranged shelf ends in a **plus** — 22 × 132 px, a dashed edge at a third of
the ink, after the last spine or on a row of its own that `rowsOf` reserves — which opens the
sheet with the book going to the end. Measured on Years by hand — demo / sparse / library: the
book holds **112 / 620 / 694**, the plus is **1** and after it; automatic Years has **0** and
refuses `makeBook`. 80 checks.

**The film, re-shot for 0.1.0** (github#21). *"re record all clips in leather, make the hero
thematically interesting, start with favourite shelf drag and drop, then ribbons, then
search."* The storyboard gained `favourite`, `room` and `looks`, lost `theme`, and moved
`ribbon` and `parting` up behind the drag; every act was walked against the product and the
eight it misrepresented are listed in `design/0007`. Leather is the recorder's default; the
hero is cut by act (`--hero-acts`), not by second.

Measured, one take in a 548-note mirror: **18 acts, 149.0 s, 3,576 frames at 24fps, captured
in 178 s**, 3 min 33 s wall including the mirror, the build and the encode; the mp4 is 9.5 MB.
The hero is `open, favourite, ribbon, parting, room` = **0.0–38.5 s**; at the old 10fps/900px
it was 4.75 MB, at 8fps/800px/q40 it is **2.92 MB**, which is the default now. The drag act
asserts on the page: the landing's `data-drop` is `"1"` under the pointer, a
`.vs-drop[data-side="before"]` stands before the first favourite, and the picks read
`[encyclopedia/0-9, years/2026]` after the second drop. The first take of that act ran green
with the pointer frozen for 264 frames because the act's error was swallowed by the frame
retry; an act error stops the take now and names the act, frame and `t`. The mirror guard
fired once, on `09:00` (`design/0013`, round 5), and the film waited until it passed.

**A date shelf dyes by period** (github#21). *"make the encyclopedia have the same colors, but
change colors for other books by decade, or by year for example."* `Shelf.colorBy` is
`folder | year | decade`, unset meaning Years by decade and Months and Weeks by year; the slot is
the period modulo 12; it ranks between *vary* and the folder. Manage shows it as a select on
the date shelves' rows only. Measured — demo / sparse / library: Months **129 / 29 / 121**
dated books over **16 / 5 / 11** years, **0** torn, **0** neighbours shared; Years **2 / 1 / 2**
decades, **0 / 0**; Encyclopedia **29 / 23 / 27** of the same on the folder's dye; Manage offers
`folder,year,decade` on Months (came up `year`), by folder **129 / 29 / 121** follow the folder,
by decade **0** torn, saved `"decade"`; no select on Encyclopedia or People. One check, 88 in
the suite. No schema bump: the field is optional and an older file comes up on the defaults.

**Two Chromes, and a check says which shapes it needs** (github#39). *"look at the review of the
smoke tests that landed on vault graph, modify ours as well to work like that, max 2 in parallel
etc."* — ported from `vault-graph#110`/`#113`, and deliberately not their answer. `decisions/0013`.

Measured on the reference machine, lock free, timed by the runner's own clock (printed after the
lock, so waiting for another worktree's suite is not counted — the first pair taken for this
ticket were both spoiled by exactly that, which is why the runner prints its own number now):

| | before | after |
|---|---|---|
| wall | **78 s** | **41-43 s** (two runs) |
| Chromes | 15 | **7** |
| check runs | 267 (89 × 3) | **146** |
| check time | 75.0 s | **34.1 s** |
| shapes per check | all three | demo 89, sparse 28, library 29 |

**The measurement that reframed the ticket**: 75 s of the before's 78 s was check time, spread
over fifteen browser launches — so the win is browsers and redundant runs, not parallelism.
**And the cap on its own is slower**: on the unchanged runner, lock free, `--jobs 4` is **78 s**
and `--jobs 2` is **90 s**, so capping the lanes costs **+12 s** and buys safety rather than
speed. The first pair taken for this ticket read the other way round because both runs had
waited on another worktree's suite inside the timed window; the runner prints its own clock,
started after the lock, so that reading is no longer available.

`LANE_CAP = 2` is a ceiling — `--jobs` clamps to it and says so — not the sister repo's one,
because our serial lane is 25 of 89 rather than the majority, our pages are lighter, and the
machine-wide `suite` lock (github#8) already allows one suite at a time, which is the guard that
was missing when four became dangerous. `check(name, fn, { on })` names the shapes a check's
assertion depends on; **the default is all three**, the opposite of `vault-graph#113`, so a
forgotten annotation costs time rather than coverage. 61 narrowed, 28 kept every shape, none
deleted. Two of the 61 were asserting nothing on two shapes already — `a wide table scrolls
inside the page` and `a wikilink in a book goes to that note` look for notes only the demo
generator writes. A second lane opens only past `MIN_PER_LANE = 32` steady checks.

**Serialising found the bug class it found next door** (`vault-graph#112`). The runner now asks
the page, after every check, whether anything is in flight — `settleRoom`'s 60 ms timer
(`__vs.room().pending`, added to the existing room diagnostic), a drag in the air, a reader or
sheet left open — and **fails the check that left it** rather than the one that trips over it.
Six leaks, all invisible at four lanes: `shelf wear is recorded and drawn` asserted an unworn
library, true only of whichever shard ran it first (measured with `--jobs 1` over it and `a book
with several ribbons in it`: **2 worn spines and a FAIL, against 1 and a pass alone**); and five
checks returned with the reader painted over the library — `previous and next walk the book`,
`also shelved in`, `previous collection walks back`, `clicking a spine opens a book`, and `the
reader's index tabs stay countable`. All six fixed in their checks; no product change but the
one diagnostic field. `--timings <file>` writes every check's ms per shape as JSON. 89 checks.

## 2026-09-12 — a drag that reaches the edge scrolls the room (`github#34`, `design/0024`)

`#vs-library` is the scroller and a drag could only reach what was on screen when it started,
so a book could not be carried to a Favourites shelf that had scrolled out of view and a shelf
could not be carried past the ones around it. A 64px band at the top and bottom of the library
now scrolls it while a drag is in the air.

| | before | after |
|---|---|---|
| a drag's reach | **one screen** | the whole library |
| scroll with a still pointer | none | **500 → 662 → 1694** over 7 steps |
| speed, 6px from the bottom edge | — | **18.4px/tick** (~1,150px/s) |
| speed, 2px from the top edge | — | **−19.3px/tick** |
| band depth | — | **64px**, ramped 3 → 20px/tick, 16ms timer |
| a shelf carried by its floor | none | **0 → 324** in 300ms |
| checks | 96 | **98** |

**The pointer is dispatched once and then never moves again**, in both checks. That is the
measurement: what keeps the room moving is the loop, not the events, and a check that kept
nudging the pointer would prove nothing about the thing the ticket is.

**The rail kept moving away while the room scrolled into it.** The landing rail started 301px
below the fold and the room travelled **1,194px** to clear it, because every shelf that rendered
on the way added its real height underneath — `content-visibility: auto` makes an off-screen
shelf's height a guess until it renders (`github#21`). The loop does not care: it scrolls by
increments and never computes a target, so a height that firms up mid-scroll extends the runway
rather than invalidating anything. `settleOn` re-measures because it seeks an offset; this does
not. The first version of the check *did* assert against a fixed 500ms wait and failed exactly
there — the check was racing the thing the ticket had warned about, and the fix was to wait for
the loop to win rather than to slow the loop down.

**Three bugs found, all in the check and none in the product.** The landing rail was parked
300px above the fold instead of below it (a sign, plus a viewport rect mixed with `scrollTop`);
the source spine was the library's first, which stands on Favourites, so the drag was a
reference onto a second pick shelf and resolved to nothing (0 picks landed while the drag itself
worked); and the fixed wait above. Worth recording because all three *looked* like feature
failures in the FAIL line.

**A timer, not an animation frame**, on the precedent `watchRoom` already set: a Chrome window
that is not painting gets no frames, and an auto-scroll that stalls when the window is not being
drawn is the same stall this ticket exists to remove.

**A leaked loop is now a suite-wide failure.** `atRest()` reports `an edge scroll still
running`, so the check that leaves one running fails rather than whichever check later trips
over a library scrolling by itself. `settlePage()` dispatches a `dragend` on the way out.

Comment budget unchanged at **1500/1500** — every new comment is pointer-shaped, and the
reasoning is in `design/0024`.
