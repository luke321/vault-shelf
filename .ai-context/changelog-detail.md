# Changelog detail

## 2026-09-24 — Only parent tags: a tag shelf can shelve by root (`github#68`, `decisions/0003`)

`parentTagsOnly` on a shelf makes the tag classifier read `a/b/c` as `a`, once per note. It is
off by default and is offered in the builder only when a tag makes the book. It folds and never
drops, so the note count is unchanged. The source predicate is still `includeSubtags` alone.

**The fixture nests its tags now, so the setting has something to show.** On the vault as it
was, the setting took the Tags shelf from 44 books to 34, which is too small a change to see. The
generator now moves about two thirds of ten common tags onto 31 new children (`garden/compost`,
`reading/fiction`, `tooling/scripts` and so on). The child is picked by a hash of the note's plan
position, so dates, people, links and every other `rand()` draw are unchanged, and
`check-generator-determinism` stays clean. The vault goes from 43 tags to 73. The layout golden was
rewritten deliberately. Note that it already carried **39 stale differences in the Months plaques
before this change**, and the rewrite absorbs those as well.

| measured on the one vault | before, setting off | after, setting off | after, setting on |
|---|---|---|---|
| default Tags shelf, books | 44 | 74 | **34** |
| default Tags shelf, notes | 4,940 | 4,940 | **4,940** |
| Untagged | 375 | 375 | **375** |
| `#garden`-sourced tag shelf, books | 27 | 57 | **17** |
| its `garden` book | 809 | 287 | **1,441**, the whole family |

## 2026-09-21 — Two states was the law, and on 5,000 notes two states is none (`github#42`, `design/0008`)

`core.markMatches` has always counted, per book, how many of its notes answer — `Book.matches` —
and `applyQuery()` reduced it to `data-match="1" | "0"` on the way to the attribute. So
`people/-unfiled` at **2 of 2,481** lifted the same 7px and took the same accent edge as
`people/Sanne de Vries` at **320 of 320**. On the one vault, `sanne de vries` drew **159 of 231
books** forward; the room with a query live was very nearly the room with an empty box.

**The rung is the share, in four steps: a half, a fifth, a twentieth.** Four and not a continuum
for the reason `design/0008` already gave for wear — a continuous scale is a bar chart of your own
library wearing a book's clothes. `core.matchStrength(book)` is the whole rule, beside
`core.wearLevel()`, so the page and anything after it cannot disagree about it.

**Three carriers, because one of them is already taken away.** `prefers-reduced-motion` flattens
the lift (`page.css`, `leather.css`), so a strength living in the transform alone would be four
rungs for everybody except the reader who asked for it to stop — silently, and invisibly to every
assertion in the suite:

| carrier | owned by | rung 1 → 4 | survives reduced motion |
|---|---|---|---|
| lift | `page.css` (geometry, one ladder for every look) | 2 / 6 / 10 / 14px | no |
| air | `page.css` (geometry) | 2 / 4 / 14 / 24px | **yes** |
| accent | each look's own sheet (paint) | its own ramp | **yes** |

| measured on `vault-3ea58174`, needle `mira vance` | before | after |
|---|---|---|
| books lit, of 231 spines | 188 | **188** — a filter narrows, a query marks |
| books at full strength | **188** | **9** |
| rung 1 (0–4.5% of the book) | — | 11 books |
| rung 2 (5.0–19.5%) | — | 149 books |
| rung 3 (20.0–36.4%) | — | 19 books |
| rung 4 (50.0–100%) | — | **9 books** |
| the thinnest lit book, `people/-unfiled` | 1 of 2,452, lifted 7px | 1 of 2,452, **lifted 1px** |
| the fullest, `people/Mira Vance` | 620 of 620, lifted 7px | 620 of 620, lifted 7px |
| `#vs-hits` | `621 notes in 188 books` | `621 notes in 188 books (28 strongly)` |
| checks | 150 → **154** |

**The ceiling MOVED, deliberately, and the floor moved with it.** The first cut topped out at the
7px `--spine-lift-max` already declared, which kept `--spine-room` untouched. Asked for more
elevation, the top rung is **14px**, so the room it *is* was re-declared with it: `--spine-room`
**7 → 14px** modern, **8 → 15px** leather, **25 → 32px** cyber, each still the tallest rung plus
that look's halo, written out because the property takes no math (`design/0021`). Rungs 1–3
override `--spine-lift-match` **on the spine**, never on the track the room is read from, so the
arithmetic check still reads `match 14` and the clip still takes nothing off any of the five
states in any of the three looks — measured, not assumed.

**And the air is top-heavy, which is `github#90`.** The air is *width*, the packer packed the row
before the query existed, and `design/0008` forbids rebuilding — so every pixel of air is a pixel
a long run can overflow by. Rung 2 holds 149 of 188 lit books, so the total is nearly all rung 2:

| air ladder | worst overflow, Encyclopedia |
|---|---|
| `9 / 9 / 9 / 9` — what `develop` ships today | **493px** |
| `3 / 5 / 7 / 9` — the first cut | 277px |
| `3 / 8 / 14 / 20` — evenly widened | 467px |
| **`2 / 4 / 14 / 24`** — shipped | **352px** |

4px at rung 2 buys 24px at rung 4 and still costs 141px less than develop's flat 9. The
overflow itself is not this change's doing and not its to fix: `github#90` holds that choice,
and `"the air a query opens still fits the room"` holds the budget meanwhile.

**`data-match` stays binary.** It answers the law's own question — does this book answer at all —
and `__vs.magic()`, the reader's contents rows and four checks read it. The rung is
`data-strength="1".."4"` beside it, on matched spines only, removed with the query.

**A book the query NAMES is marked, not promoted** (`data-named="1"`). The People shelf is the
tell the issue raised: a note names several people, so a person's name lights sixteen of
twenty-six people books, which is the first law working correctly and still reads as broken. It
needs no promotion — a cover is in the search index of every note behind it (`github#58`), so a
named book is already at or near 100% share. What it needs is to be told apart from a book that
merely co-occurs heavily, and that is what the mark does.

**Two measurement traps, both hit here first.** A spine **transitions its margin** over 160ms, so a
read taken in the same turn as `setQuery` measures the air the room is *leaving* — every rung came
back `0px` while its own token read 3/5/7/9. Waited on as a condition now (`restedRungs`), never
as a duration: the air has arrived when it equals the token it is animating towards. And a spine a
**binding has trimmed** (`design/0033`) sits its trim lower in its own track, so `trackTop - top`
understates its lift by exactly that trim — a rung-4 spine read as lifting 1px and painting 0, which
looks exactly like the clip biting. `pick(sel, flush)` takes an untrimmed candidate, the way the
sibling room check already did by hand.

## 2026-09-21 — A suggestion you could not read (`github#41`, `design/0026`)

`github#41` shipped with `Refs #41` rather than `Closes`, naming four open calls. Three settled
themselves: `github#58` put **covers** back in the vocabulary and the haystack, so date books are
offered by name again (9 month books — `Aug 2026`, `Apr 2026`, …) and the contradictory empty row
went with the body scans; and the esbuild `allowScripts` entry is on `develop`. `Week 37, 2026` is
absent because **the Weeks shelf is hidden by default** (schema 4) and book terms come from visible
shelves only — the law working, not a gap.

The fourth was the list's width. It was pinned to the search box at **232px**, so a folder wanting
227px of a 117px slot read as `area/personal-knowl…`. **A suggestion you cannot read has not told
you what it would spell**, which is the whole job of the feature.

It sizes to its content now, between a floor and a ceiling: never narrower than the box, never
wider than what is left of the room to the right of it, never past **440px**.

| over the same 13 probes, the one vault | before | after |
|---|---|---|
| rows clipped, 1,584px room | **16 / 90** | **0 / 90** |
| rows clipped, 400px room | **31 / 90** | **10 / 90** |
| list narrower than its own box | 8 / 13 | **2 / 13** |
| list reaching past the room | 0 | **0** |
| list width, 1,584px room | 232px | **342px** |
| list width, 400px room | 204px | **250px** |

**At 400px the ceiling binds and that is the law**, not a shortfall: the room holds 250px with the
box 142px into it, the longest folder wants 342px, and *nothing scrolls sideways*. The check asserts
the room at both widths and **reports** the 10 clipped rows rather than asserting them away.

**The mechanism was chosen by the cost, not by taste.** `page.css` sizes it (`width: max-content`
between `min-width` and `max-width`) and JS hands it the two bounds **once per opening**, as it
already handed it `left` and `top`. A JS pass over the rows would have been correct and would have
bought back the **14.5 → 29.5 ms** that moving `placeSuggest` off the keystroke path had just paid
off. Per-keystroke cost is therefore unchanged.

Residual, measured rather than chased: the box grows and shrinks as `#vs-hits` changes length, so a
list opened against a narrower box can sit a few pixels under it. Pre-existing — sizing to content
took it from 8 of 13 probes to 2.

## 2026-09-20 — The trail was what the deep levels were paying for (`github#88`, `design/0034`)

`github#87` left a floor it had proved it could not cross: five alphabetical tag books settled at
**depth 8 with 10 rows against a room of 9** at 1180×480 — *94 levels over* across the fourteen
fattest books — and a beam search over every grouping sequence there is (all depths × all group
counts, 600 wide, 14 steps) showed 10 was the best any chooser could do. Grouping adjacent cuts
only ever *adds* levels, and a level at depth *d* costs `d + its cuts` rows.

**What the search could not question is the cost model.** Eight of those ten rows are trail. The
rail was spending four fifths of a short window saying how you got somewhere rather than showing
what is there — so the trail is bounded at **three rows**, the way the staircase already bounds
its notches at two: past three steps the ones between the first and the last stand as one **fold**,
and a level costs `min(d, 3) + its cuts`.

**Both halves are needed, and the second closes the floor.** Folding the drawing alone would leave
every level below `room − 2` un-gathered, because `fitTabs` gathered depth *d* into `room − d`
spans and that budget ran out. With the trail bounded the budget is `room − min(d, 3)`, it stops
shrinking, and the pass runs to the bottom of the tree — so **every level draws at most `room`
rows by construction**, which is stronger than the depth bound it replaces. The depth is free to
exceed the room now, and does.

| measured over the fourteen fattest books, 1180×480 | before | after |
|---|---|---|
| levels over the room | **94** | **0** |
| deepest level | 8 | **7** |
| room | 9 rows | 9 rows |
| cuts kept (nothing dropped) | 6,025 | **6,025** |
| trail rows at depth 8 | **8** | **3** |
| 1180×1000 | room 37, deepest 3, 0 over | **unchanged** |
| checks | 149 → **150** |

**The fold is a trail step, not a gap.** It carries `‹`, stands where the second step stands, and
pressing it returns to the shallowest step it hides — one way out, one state. What it covers is
named on it (`2 steps folded: 2015 › Oct`) and on the last shown step, so the rail still says how
you got there; it stops *drawing* every step, not saying them. It is the operator `spanned`
already applies to the cut list, one axis over.

**Rejected: collapsing a raw layer**, the issue's other candidate. It buys the row directly and
throws a cut away — `design/0034` exists because three answers to one question each ended in a cut
the reader cannot use, clipped, dropped or too small, and that is the dropped one again.

**The loop is bounded by the tree now**, `depth <= deepestLevel(cuts)`: a gather fires only on a
level over its budget and each adds a single layer, so there are finitely many. A **visible** fuse
at 64 stands where `depth + 2 <= room` used to — if it ever binds, levels go un-gathered and the
converge check goes red, rather than a cap quietly leaving a tree at depth 25.

*The fitted index converges* counts a level's rows through the cap and now **asserts** the count
it used to print; `design/0034` rejected widening it only because the floor was unactionable.
*A deep trail folds to three rows and says what it hides* is new and holds the fold itself.

## 2026-09-20 — A stamp names the instrument that earned it (`github#77`, `decisions/0010`)

The measurement half of #77 landed on 2026-09-15 (`decisions/0017`, `decisions/0019`): the
smoothness budget counts missed vsyncs instead of sampling a frame interval against a threshold
sitting inside a vsync cluster, and it re-runs the same room with `design/0014` off to prove it
can still fail. **The stamps the old check earned stayed where they were.**

The old check was red **four full runs in five** on `a2de7fa`. Under `decisions/0010` two greens
in a row stamp a tree and both local gates then skip the suite, so a check that is green about
half the time converts into a permanent pass by being retried — which is what happened to tree
`0989b3e`, `develop` at the time, stamped 2/2.

| the stamp store on this machine | before | after |
|---|---|---|
| stamps held | 79 | **79** — demoted, not deleted |
| at the full two-green streak | **17** | 17, and none of them trusted |
| that `lookup()` would hit | **0** | **0** |
| why they miss | the fixture in the store is `3ea58174` of 2026-09-16 and no stamp names it | `stamped under epoch none and the suite is at epoch 2` |
| does the miss depend on what the store holds | **yes** — a digest is a function of the generator sources and returns whenever those do | no |
| `--selftest` cases | 30 | **36** |
| cost of the bump | — | 45 s per tree still in use, **0 s today** |

**0 of 79 hitting is the number that matters, and it is a reprieve rather than a defence.** The
fixture check was carrying the whole load by coincidence; `.githooks/pre-push` looks up every
commit being pushed rather than the tip alone, so a `develop` push carrying a range of older
commits is exactly the shape that collects dormant stamps.

`STAMP_EPOCH` is now written into every stamp. `lookup()` misses on any other epoch **before** it
reads the fixtures or the streak, `record()` restarts the streak across an epoch change exactly as
it does across a regenerated fixture, and `list` prints each stamp's epoch. Both halves were
proved by disabling them: without the `lookup()` gate two of the six new cases go red, without
`record()`'s reset three do.

The line is drawn bluntly at the frame-counting merge, so `55147fa` (2/2, 2026-09-16) is demoted
although it was honestly earned — a per-stamp ancestry test would need each recorded commit to
exist in whatever checkout does the lookup, which a store shared across worktrees and machines
cannot promise.

## 2026-09-17 — The index fit never converged (`github#87`, `design/0034`)

*No index cut is clipped* went red on `people/Otto Brandt` at 1180×480 the week the fixture
re-cut itself. The issue read it as `fitTabs` stopping early — `gathered` returning `null` and
the loop breaking with the tenth cut still hanging off the bottom. Traced per step, it is the
opposite: **`gathered` never returns `null` and the loop never terminates.**

A level at depth *d* draws `d + its cuts` rows, because the rail stands the trail it came through
above it. A gather **adds a level**, so gathering the fattest level makes every deeper level one
row worse; `widestOf` moves to one of those, and the two chase each other down until the 24-step
cap stops them. On `Otto Brandt` the chosen depth went 2 → 0 → 3 → 4 → 7 → … → **24**, and the
rows the fit was trying to shrink went **10 → 12**.

**The shut rail fitted, which is why one book went red and six did not.** The top of a runaway
tree is six or seven spans, so nothing clips until a fold is opened onto an over-full level
underneath. The check opens the three widest folds; on `Otto Brandt` the third landed on one.

| measured over the fourteen fattest books | before | after |
|---|---|---|
| deepest level, 1180×480 | **depth 25** (`Otto Brandt`, 486 notes) | **depth 8** |
| books whose fit had not converged | **7 of 14** | **0** |
| cuts clipped, 1180×480 | **1** | **0** |
| most cuts on show, 1180×480 | **10** in a room of 9 | **9** |
| cuts kept (nothing dropped) | 6,025 | **6,025** |
| room, 1180×1000 / 1180×480 | — | **37** / **9** rows, measured |
| 1180×1000 | room 37, nothing gathers | **unchanged** |
| checks | 148 → **149** |

**Two changes, and the second is the one that mattered.** The room is measured once — the CSS
clamp makes the fit monotonic in the row count, so a binary search settles it in six draws rather
than the twenty-four the old loop spent — and each depth is then fitted in turn, shallowest
first, into `room − depth` spans. A gather is paid for by everything under it, so the payment is
made before the levels that owe it are read; the pass ends where `room − depth` falls under two,
so the depth stays under the room by construction.

**Three chooser-only fixes were built and measured first, and all three failed.** *Gather the
deepest over-full level* fixed three books and broke four (25 → 26, 27 → 28). *Gather whichever
depth most reduces the maximum* stalled in a local minimum at 15 rows. *Keep the best tree seen*
left four books at 13. Halving is one arity chosen in advance and is too coarse to reach a
fitting tree inside the depth the trail leaves — which is why the operator changed too.

**Known and left:** `website-migration`, `garden`, `sleep`, `reading` and `idea` are ~26 letters
over four raw levels and settle at depth 8 with **10 rows against a room of 9** — 94 levels over,
each eight presses down. A beam search over every grouping sequence there is proves **10 is the
floor**: grouping adjacent cuts only ever adds levels, and each one costs a row. Filed rather
than guessed at; the two candidate operators both break something `design/0034` already settled.

## 2026-09-17 — A sticky note on the fore-edge (`github#19`, `design/0037`)

A tag, person or property book is *about* something the note contains, so the reading spread
grows a column of flags on the fore-edge of the right-hand page: one per place the subject is
written, pressed to scroll there and mark that occurrence. It stands in the 16px of air
`design/0034` already reserved inside the thumb index, so the rail keeps its 60px and the prose
keeps its column — **0 moved, 0 resized** in *a look moves nothing on the page*, and the golden
snapshot is unchanged by the code.

Measured on the vault shape, `tags/garden` open on the planted sentinel, at the suite's viewport:

| | |
|---|---|
| flags on the fore-edge | **4** — 1 on the details line, 3 in the text |
| where they stand | 8, 134, 343, **701**px down a 713px column |
| what the three written ones press to | **314, 1182, 2342** of a 2342px span, under a 3049px leaf |
| `.vs-here` marks on the page at once | **1**, always |
| the note's text before and after | 4,482 characters, **identical** |
| the same note in `tags/garden/seeds` | **2** flags — and never the parent's mention |
| a `status` property book of 543 notes | **0** flags, column hidden |
| checks | 144 → **148** |

**The first cut scrolled smoothly and went nowhere.** The targets were computed exactly right —
314, 1182, 2342 — and the page stayed at **0, 0, 0**, because a smooth scroll is an animation and
an animation does not advance in a window the compositor is throttling. It sets `scrollTop`
directly now, like `landOn`; `design/0012` had already rejected an animated page turn as *"a
delay between a person and their note"*, so the harness only found what the design record already
said.

**The hollow flag drew a dark blob on a cream leaf.** `var(--surface-1)` from a rule at
`.vault-shelf` scope is the *room's* value; leather redefines the surface tokens inside the
spread. It is `transparent` now. Found by looking at it — every assertion about it was green.

### The fixture had to learn to say its own tag, and that cost a re-cut

**0 of 4,939** notes in the vault shape wrote a tag in a body; every tag was declared in
frontmatter (808 notes declare `garden`, 404 `garden/seeds`). So the ticket's own check could not
have been earned, and would have gone quiet rather than red. `make-vault.mjs` plants one long
note that says `#garden` three times in its prose and `#garden/seeds` once, guarded like every
other sentinel.

| | before | after |
|---|---|---|
| notes in the fixture | 4,939 | **4,940** |
| fixture digest | `c1f3a5ca` | **`3ea58174`** |
| `layout-snapshots/vault.json` | — | rewritten, **16 rows moved** |
| suite stamps on this machine | — | all miss |

**And the re-cut turned an older check red, which is `github#87` and not this work.** *no index
cut is clipped* fails at 1180x480 on `people/Otto Brandt` with **1 clipped, 10 cuts on show**.
Isolated: `origin/develop`'s `src/` passes on the old fixture (0 clipped, 9 cuts) and fails on the
new one with the same numbers as this branch, so nothing in `src/` is implicated. The fixture is
unpinned and re-cuts weekly by design, so this was one month boundary away from red at any time;
`#19` drew the card rather than printing it.

## 2026-09-17 — The containment unit is a row, and the sweep goes one way down (`github#20`)

`github#20` asked whether scrolling could still be better, said the worst frame was a shelf's
first paint, and set one condition on changing the check: drive a **real input**, and if the
numbers differ from the scripted scroll then the scripted scroll is the wrong measurement. They
differ by everything.

**The check could not reach its own subject.** Its sweep crossed **1,120px** in 1.4 seconds at
800px/s and turned round at either end; a room with a Weeks shelf in it is **4,427px**. It never
left the first viewport and a half, so every pixel after the first leg was ground it had already
rasterised. Leather, same room, same browser, same minute:

| route | shelf is the unit (shipped) | row is the unit (now) |
|---|---|---|
| turned round, 1.4s @ 800px/s — **what the check did** | **2 of 81** | 1 of 80 |
| one way down @ 800px/s | **43 of 302** | 15 of 303 |
| one way down @ 2000px/s — **what it does now** | **50 of 124** | 6 of 122 |
| a real wheel over CDP, 60Hz | **25 of 320** | 16 of 319 |

**The wheel agrees with the descent, not with the turn.** So the driver was never the problem and
the route was: the check still moves `scrollTop` and simply stops turning round. That is
`github#20`'s fourth line answered with a measurement rather than retired by assertion.

**A shelf is as many rows as it takes**, and eleven years of weeks is **25 rows and 2,664px of
spines**, so a shelf materialising paints all of it inside one frame. `design/0014` put
`content-visibility: auto` on the shelf; it moves to the row. One way down at 2000px/s, missed
vsyncs of the ~121 on offer, three runs each:

| | leather | modern | cyber |
|---|---|---|---|
| the shelf is the unit (before) | **45–46** | 2 | **41–55** |
| the row is the unit (now) | **2–7** | 2–3 | **5–9** |
| `design/0014` off altogether | 93–97 | 2–3 | 90–91 |

p95 **89.2 → 18.5ms** on leather and **105.7 → 18.4ms** on cyber; worst frame **123 → 36ms** and
**124 → 69ms**. **Modern is 2 in every row of that table** and always was — this is a look's
paint, which is what `design/0014` said it was.

**Keeping both units is worse than either: 65 missed, against 54 for the shelf alone and 8 for
the row alone.** A skipped shelf cannot have its own rows assessed for visibility, so when it
materialises every row is evaluated, laid out and painted at once and its height jumps from the
intrinsic guess to the truth, which moves everything below it.

**The shelf keeps no containment at all, and that was not free.** `contain: paint` on it puts the
win straight back where it was — leather **43** — because one paint box is one rasterisation unit
however its rows are skipped; and `contain: layout paint` additionally stops `margin-bottom: 26px`
collapsing, which moves the golden packing. Both were measured before the shelf was left bare.

**What a spine costs to paint is not what a scroll pays**, which is `github#20`'s second line
answered and closed. Priced against the same descent, leather: **47** with the grain's
`soft-light` blend off, **61** with the grain gone altogether, **38** with the spine's
`box-shadow` gone — against **54** shipped and **8** for containment. Not one of them is near the
win, two are inside run-to-run spread, and pre-rasterising a look's texture would have changed
the look for a fraction of what containment gives for nothing. **No look's paint was touched.**

**A row's intrinsic size is its own `min-height` expression** — `calc(var(--spine-h) +
var(--board) + 24px)` — and never a second number for the same height. A flat **214px** put the
cold scroll height **541px** past the truth; **192px** put it **32px** past. The expression is
exact for a plain row (**170px**), 6px short for one carrying a plaque (**176px**), and `auto`
replaces it with the measured height the first time a row renders. A skipped row still reports
**1180px** wide, unchanged, because `width: 100%` comes from the containing block.

**The check's room is its own.** The six default shelves are **1,494px**, a viewport and a half,
where nothing is ever deferred and every look scored a flat **0**; the check adds a Weeks shelf
for its own duration (**3,746–4,109px**, 24 rows, ~691 spines) and removes it before returning —
in a `finally`, because a split eval can leak a shelf where the old single call could not, and a
deliberately faulted run was used to confirm the goldens still read 6 shelves and 227 spines after
it. Budget **30 missed** of the ~110 a descent offers: above a loaded shipped ceiling of **17**,
below the **41–55** that putting the unit back on the shelf measures, and far below the probe's
**89–115**.
The check costs **13.7s** against 8.9s, and is split across one `Runtime.evaluate` per leg
because cdp.mjs allows any single call ten seconds and the walk is about twenty.

### What the clip check had to learn (`github#78`, `decisions/0019`)

Taking containment off the shelf made `nothing a look paints outside a spine is cut off, in every
look` go red, deterministically, in the two shelved looks: modern **1px**, cyber **8px** and
**9px** above their tracks, each of them **inside** the room that look already allows, where a
clip cannot reach. The check says so itself, and it was right to.

**It was the same paint, rasterised against a different layer.** With no paint box at the shelf,
opening one track's clip re-rasterises that row: measured, cyber's worn-and-hovered spine moved
**2 pixels of a 92px band at 8px above the track, 2 at 7px and 3 at 6px, by 12–14 of 255**. The
delta is exactly what an arriving edge has, so depth cannot separate them — but an arriving edge
arrives a **spine wide**, 44px of one. The two captures were saved and **looked at side by side**
and are indistinguishable. `MOVED = 6` per pixel now needs **`WIDE = 8`** pixels in the row with
it, and all three looks slice nothing again.

**And the floor answers for itself in the same run.** A threshold raised to make a red check green
is worth nothing without proof it still bites, so the check carries a negative control: the probed
spine is held **30px above its own track in both captures** and only the clip changes — shut to
nothing, against opened to 90px. It must read positive and reads **31px**. The first form of the
control shut the clip with **no** lift and read **0**, because what cyber paints above a hovered
spine is narrower than the floor; that is recorded rather than replaced, because it is the limit
of what the floor claims — not that nothing is up there, only that three pixels are not an edge.

Two sibling checks are unmoved throughout and are the independent word that no paint was lost: `a
lifted spine is painted whole, in every look` (leather 8 of 8, modern 7 of 7, cyber 25 of 25) and
`the room above a spine is the largest lift plus the look's halo, in every look`.

## 2026-09-16 — The comment baseline is a merge-result number (`github#79`, `github#80`, `github#81`, `github#82`)

Four branches merged into `develop` in one pass, and the comment baseline landed **2 under**
every number any of them measured. `develop` read 1534 and each branch read 1534 or 1536
against its own base; the merged tree reads **1532**, because two sides dropped different
comment lines relative to the merge base and no branch could see the other doing it. Ratcheted
to 1532 here. `check-comments` fails **under** the baseline as well as over (`decisions/0007`),
so the merge could not have been pushed without this line moving — which is the gate working,
not a defect. The 1536 quoted in the `github#81` section above is that branch measured on its
own base and stays as written.

## 2026-09-15 — A smoothness budget counts frames (`github#77`, `decisions/0017`)

`scrolling the library stays smooth in every look` was **red four runs in five** on a clean
`develop` at `a2de7fa`, and `a wheel on the spread stays smooth in every look` held the same
34ms line for the same reason. A frame interval is a whole count of vsyncs, so the intervals
cluster and a percentile of them lands inside a cluster — 5,185 frames of 5,387 at 16.9–26.0ms,
119 at 26.5–**37.1**, 42 at 51.6–54.2, and **nothing between 26.0 and 26.5**. The 34ms budget
sat in the middle of the two-vsync cluster, so one dropped frame read 34.2 and passed or 34.7
and failed.

**The number is now a count of missed vsyncs** — `round(elapsed / vsync) - painted`, no
per-frame threshold anywhere in it and no percentile index for a sample size to walk down its
own tail. The sweep runs at a **fixed 800px/s** instead of covering the whole span in a fixed
time, so the paint per frame no longer depends on what the preceding checks left on the page
(231 spines over 1494px under `--only`, 227 over 1102px in a full suite).

| | before, p95 ms | now, missed of ~80 |
|---|---|---|
| leather | 18.4 – **53.6** | **0 – 1** |
| modern | 18.3 – 18.7 | **0 – 1** |
| cyber | 18.4 – **52.7** | **0 – 3** |
| the same room with `design/0014` off it | — | **58 – 66** |
| **runs green, consecutive** | **1 of 5** | **12 of 12** |

The budget of **14** sits in the empty gap between 3 and 59, where the old one sat inside a
cluster with observations on both sides of it.

**The probe had to be the real regression.** `github#77`'s own A/B slowed the page with filters
over every spine and concluded the measurement was insensitive; four candidates, driven against
the same room, say the probe was the insensitive half:

| slowdown | missed |
|---|---|
| a filter over every spine (blur, drop-shadow, saturate, contrast on 231) | 2 |
| a 2px blur over the whole library | 3 |
| a 40px/20px shadow spread on every spine | 2 |
| a 12ms busy-wait inside every frame callback | 1 |
| `backdrop-filter: blur(8px)` on every spine | 14 |
| **`design/0014` off: containment and the compositor layer** | **61** |
| nothing at all, for comparison | 2 |

A scroll composites tiles that are already rasterised, so per-spine paint does not enter a frame
until containment is what changes. The library check now runs that last row **in the same run**
and fails if it does not clear the budget: `github#77` asked for the number to be shown to move,
and it is an assertion rather than a note.

**The vsync is calibrated, and two ways of doing it do not work.** A plain animation-frame loop
on a still page returned **two frames in 400ms** and a period of 396–413ms, three runs in five —
a page with nothing changing on it is not painted. Calibrating against a 40px/s creep was worse,
446–536ms **six runs of six**, because a scroll too slow to change an integer offset invalidates
nothing. A whole pixel per frame, after a throwaway pass has frames flowing, reads **17.4–17.8ms
every run**. Reading the period off the measured sweep instead is circular, and the probe caught
it: containment off painted **15 frames of 80** and scored **2 missed**.

Cost: the library check **8.9s** against 7.8s, the wheel check 8.0s. Both were already serial.
## 2026-09-15 — A shelf reorder is a stored position, not an array move (`github#79`)

Reordering shelves did not survive a reload, on either host. `withFavourites` renumbered every
shelf by its **array index** on load:

```ts
const placed = shelves.map((s, i) => ({ ...s, position: i }));
```

The mechanism, traced end to end rather than inferred from that line. All three reorder paths
write `position` onto the shelf objects and leave `settings.shelves` in the order it was
already in:

| path | site | what moves |
|---|---|---|
| Manage ↑/↓ | `page.js:4704` `reorder()` | sorts a copy, splices the copy, writes `position` back |
| drag a shelf | `page.js:1124` `moveShelf()` | same shape |
| new shelf at top | `page.js:4055` | `push(draft)` — draft is **last** in the array, `position` 0 |

`persist()` then clones the settings as they stand (array order old, positions new), and the
load path replaced the half that carried the change. `buildShelves` sorts on `position`
(`shelves.ts:372`), so the arrangement simply vanished — no error, no moved address, no changed
count, and therefore nothing in the suite to notice.

**The plugin loses it sooner than reported.** Both hosts route through `core.migrate`, but the
page migrates once at mount (`page.js:202`) while the plugin migrates on **save**
(`main.js:532`) and again on load (`main.js:445`). On the plugin the reorder was discarded at
save time, before any reload, and idempotence became a requirement of the fix rather than a
nicety.

`sequenced()` now orders by stored `position` before `withFavourites` decides anything, and the
`design/0019` insert keeps its own renumber — the bug was renumbering *unconditionally*, before
knowing whether an insert was happening.

Measured by the new check `a reordered shelf survives a reload, on both hosts`, before → after:

| shape | before | after |
|---|---|---|
| Manage ↑ on the last shelf, one migrate (page) | reverted | **held** |
| the same, two migrates (plugin save + load) | reverted | **held** |
| a dragged shelf, reloaded | `favourites -> encyclopedia -> years -> months -> people -> tags` | **`encyclopedia -> years -> favourites -> months -> tags -> people`** |
| new-shelf-at-top (`draft` array-last, position 0) | `a -> b -> draft` | **`draft -> a -> b`** |
| schema 9, positions disagreeing with array order | `favourites -> years -> people -> tags` | **`favourites -> people -> tags -> years`** |
| schema 10, same shelves | `years -> people -> tags` | **`people -> tags -> years`** |
| hand-edited: one duplicate position, one missing | `a -> b -> c` | **`a -> c -> b`**, positions `0,1,2` |

The `design/0019` migration check is untouched and still green: Favourites still arrives at
position 0 with `direction: "manual"`, an id that steps aside for a shelf that took the name,
and every other shelf in the relative order it already had — now the order the **file** said,
rather than the order the array happened to be in.
## 2026-09-15 — The scope gate reads a selector, not a line (`github#81`, `decisions/0019`)

`check-scope`'s CSS half walked one line at a time and took the selector to be the text on the
line carrying the `{`. Planted into a throwaway copy of the tree, one shape per run, against
`a2de7fa`:

| planted into `page.css` | before | after |
|---|---|---|
| `p,` `blockquote,` `input,` `.vault-shelf .vs-spine {` over four lines | clean, exit 0, rules 514 | **exit 1**, three hits at lines 1, 2 and 3 |
| `@media (…) { body { margin: 0 } }` on one line | clean, exit 0, rules 513 | **exit 1**, `body` |
| `@supports { @media { html { … } } }` | clean, exit 0, rules 513 | **exit 1**, `html` |
| `.vault-shelf .vs-a { … } body { … }` on one line | clean, exit 0, rules 514 | **exit 1**, `body` |
| `p, /* a note */` then a scoped member | clean, exit 0 | **exit 1**, `p` |
| `[hidden],` then a scoped member | clean, exit 0 | **exit 1**, `[hidden]` |
| `*,` then a scoped member | clean, exit 0 | **exit 1**, `*` |
| `content: "}"` then `body { margin: 0 }` | exit 1, but **`unbalanced braces (depth -1)`** | **exit 1**, `body` |
| `.vault-shelf :is(.vs-a, .vs-b) { … }` | exit 1 — **false positive**, `.vs-b)` | **exit 0** |
| `body { margin: 0 }` at depth 0 | exit 1 | unchanged |
| a scoped multi-line list, `@keyframes` | exit 0 | unchanged |

Three of those were the issue's; the string desynchronisation and the `:is()` false positive were
found while measuring. The `{` direction of the string bug is the dangerous one — it raises the
depth counter and hides rules rather than inventing a complaint.

**What the gate never read.** The rule count is the number that looked reassuring throughout:

| | rules | selector members read, before | after | never read |
|---|---|---|---|---|
| `page.css` | 340 | 347 | 366 | **19** |
| `leather.css` | 99 | 99 | 128 | **29** |
| `cyber.css` | 74 | 74 | 88 | **14** |
| **total** | **513** | **520** | **582** | **62** |

**513 rules before and 513 after** — the rewrite moves no rule count, which is exactly why the
defect was invisible. The issue's headline figure of 210 unread continuation lines counted
declaration continuations (`box-shadow: a,` over two lines) as well as selector ones; the number
of selector **members** the line walker never read is **62**, and all 62 are scoped. `124 prefixed
classes` is unchanged too: unifying the class scan onto the same parser closed its own hole —
`sel.trim().startsWith("@")` skipped the first rule inside every `@media` — and gained no new
class name, because every class inside an `@media` is used outside one as well.

**Found while writing the controls, beyond the issue:** `.vault-shelf + p` and
`.vault-shelf:hover ~ p` were read as scoped. Both style a **sibling** of the page, which is
outside it. `scoped()` now walks the root compound and refuses a `+` or `~` that follows it;
`.vault-shelf .vs-a + .vs-b` is still fine.

**The controls ship with the gate and run on every invocation** — 28 in-memory fixtures, each
asserting rules read, members read and the exact set of problems raised. Measured at **0.21 ms** for all 28,
against **4.5 ms** to scan the three sheets and **102 ms** for the whole check. `--selftest` prints them case by case:
`check-scope selftest: 28/28 controls caught`. Not a flag the hook calls, for the reason in
`decisions/0019`: this defect survived because nobody had run the equivalent by hand.

Clean line now, on `513 css rules`:

```
check-scope: clean (513 css rules, 582 css selectors, 76 ids, 124 prefixed classes,
72 id lookups, 19 shipped files with no invisible characters, 28 negative controls caught)
```

`check-comments` stays at **1536** and `check-scope.mjs`'s own share at **24**: the new code
carries pointers, and its reasoning went to `decisions/0019` rather than into the file.

## 2026-09-15 — A look's paint room is measured against itself (`github#78`, `design/0021`)

`nothing a look paints outside a spine is cut off, in every look` failed intermittently on
`develop` — about **one full-suite run in two** — reporting cyber wanting **26px** against a 25px
room, then **24px**, then exactly **25px** three times when run alone, all on an unchanged tree.
The room was not short. The **measurement** was.

It read what the paint *wanted* — whole device rows above `Math.floor(trackTop)` under a margin
that clips nothing — and inferred a slice from `wanted > room`, a CSS length off the real,
**fractional** `trackTop`. Two numbers, two frames, one subtraction. Peak 8-bit difference across
the last rows before a look's paint edge, at quarter-pixel resolution:

| look | approaching | at the edge | past it | reach |
|---|---|---|---|---|
| leather | `1 1 2` | **`67 66 67 66`** | `146 145 146` | hard, exact |
| modern | `0 0 1` | **`113 153 199 211`** | `212 212 212` | hard, exact |
| cyber | `6 6 6` | **`7 7 7 7`** | `8 8 8 8` | a 22px blur, **1 unit per 0.75px** |

Cyber's edge is decided by a single quantisation step against `MOVED = 6`, so one unit of
rendering noise moves it a whole pixel. `github#51` then set the room to 25 — the middle of its
own noise — and left leather and modern on the same zero margin, stable only because their paint
has a hard edge.

**Now the clip is compared against itself**: the band as shipped, against the same band with that
spine's own track opened (`.vs-track:has([data-probe51b])`). What they disagree about **is** what
the clip took. Both captures share the anchor, the lane, the scroll offset and the fractional
track, so all of it cancels.

Measured over eight scroll offsets, five states, three looks:

| | room | old `wanted` | new `cut` |
|---|---|---|---|
| leather | 8px | `8` every time | **0** |
| modern | 7px | `7` every time | **0** |
| cyber | 25px | **`24` or `25`** | **0** |

Four consecutive runs of the check now print a **byte-identical** detail line, at 10.8–11.3s.
The negative control still bites — cyber's room forced short:

| cyber's room | states sliced, of 5 |
|---|---|
| 26px, 29px, 32px | **0** — the room was never short; `--spine-halo` stays 18px |
| 20px | **3** — hovered, worn and hovered, a search match |
| 12px | **3** — `a search match paints 25px into a room of 12px, so 13px of it is sliced off` |

**The unstable reach is no longer printed.** "wants 26px" read as a defect and was not one; the
detail names the room and the states it held, and what the room should *be* stays with the
sibling check, which asserts `room === tallest rung + halo` exactly and takes no screenshots.

**And the check waits for the room instead of sleeping at it** (`decisions/0016`): `setLook`,
`setQuery` and `clearQuery` wait on `settled()` where they guessed at 160ms and 280ms, and a
state whose room never settles now fails by name (`STILL MOVING WHEN MEASURED`) rather than
being measured half-built.

**Nothing in `src/` changed** — no look, no room, no constant, no golden. This is the suite
learning to measure what it always claimed to.
## 2026-09-15 — A `0×0` rest box says so instead of reporting a lift (`github#76`)

**No product code changed, and the flake it was filed over did not reproduce.** `github#76`
reported `"a spine lifts on hover and holds its size"` failing 1 run in 3 under `--only "spine"`
with `0x0 at rest, 57x128 focused, lifted -168px`. This is the attempt to disprove it, and it
disproves it.

Measured on `develop` @ `7d73e7e`, which already carries `github#57`/`#69`:

| | runs | result |
|---|---|---|
| `--only "spine"`, idle (maintainer, on the issue) | 10 | 10 ok, `57x128` every time |
| `--only "spine"`, **all 24 cores under synthetic load** | 14 | **14 ok**, `57x128` every time |

The load is `github#57`'s own method — the one that took that check from 14/14 idle to **2 FAIL
in 14** before its fix. It produces nothing here: **24 consecutive greens** on this tree, not one
`0x0`.

**And the `-168px` is arithmetic, not a movement.** Driving the page directly, the first spine's
real top is **168px**, so an all-zero rest rect — which reports `top 0` — makes
`before.top - after.top` exactly **−168px**. The reported failure is one event, not two: the rest
read found no box, and the lift was computed from nothing.

| the page, driven directly | first shelf | rest box | lift printed |
|---|---|---|---|
| library at the top | `favourites`, rendered | 57×128 | 0px |
| scrolled 400px | `favourites`, rendered | 57×128 | **−400px** |
| scrolled 900px | `favourites`, rendered | 57×128 | **−900px** |
| scrolled to the foot (1494px) | `favourites`, rendered | 57×128 | **−1494px** |
| rest rect forced to zero | `favourites`, rendered | **0×0** | **−168px** |

Only the last line reproduces the report. A scrolled library prints −400/−900/−1494 and the shelf
is **never** skipped by `content-visibility` at any offset, so the second candidate mechanism is
out too; `github#57` draining the room before the first check of a run is what accounts for it.

**What changed is a diagnostic, not a verdict.** A `0×0` rest box already failed — `0 === 57` is
false — it just failed by printing `lifted -168px`, which is what sent the original reporter
looking for a spine that had moved. It now fails saying *the spine had no box at rest — read
before its first packing landed, not a spine that moved*, and names the `−168px` the old line
would have called a lift. **No run that passed before fails now, and none that failed now passes.**
Verified both ways — green on this tree, red in exactly those words with the rest rect forced to
zero.

**Still not asserted, and left alone deliberately:** the lift itself. −400px passes today, because
the check asserts only that the two readings match. Raised on the issue rather than changed here.

## 2026-09-15 — A volume of numbers reads by number (`github#70`, `design/0035`)

A third `core.IndexMode`. `number` orders a book by the leading digit run of each title —
`firstLetter`'s trim, then the digits, compared by length with leading zeros stripped and then
by characters, so `202212331243` is exact and no float is involved. It is offered **in the A–Z
slot**, never beside it, and only for a non-empty book whose every note opens with a digit; it
replaces the **automatic** `az` only, never `date` and never a saved mode. Like `az` it ignores
the top bar's oldest/newest, which is the coupling that killed the date-book version of this in
`design/0034`.

Measured on the vault shape (`vault-c1f3a5ca`, 4,939 notes), the Encyclopedia's `0-9` volume:

| | before | after |
|---|---|---|
| the contents open | `0 to 1`, `1000 small decisions`, `12 weeks of running`, 2015-… | **`0 to 1`, `3 notes on attention`, `7 day sourdough`, `12 weeks of running`, `24 hours…`, `42 and after`, `99 problems…`, `1000 small decisions`**, 2015-… |
| top cuts | 16 | **20** |
| cuts labelled `0-9` | **3**, scattered around the years | **0** |
| fat cuts that open | 11 of 12 | **11 of 11** |
| biggest dead end | `0-9` ×5 | **none** |
| `202212331243` | index 649, between 2022 and 2023 | **index 2063, last** |
| its cut | `2022x`, 0 under it | **`2022·`**, 0 under it |
| widest rail label / rail width | `2022x` 39px / 60px | **`2022·` 36px** / 60px |
| the toggle's face | `A–Z ⇄` in 55×28 | **`0–9 ⇄` in 55×28** |
| Encyclopedia `oldest` vs `newest` | byte-identical | **byte-identical** |

**The face was found by looking.** `Number ⇄` measures −1px against the toggle's width and so
passes every width assertion — because it **wraps** onto a second line, running **6px** past the
55×28 box. The screenshot showed it; the check now measures the height too, and the rail says
`0–9` (the same shape and width as `A–Z`) while the `aria-label` and the manage-sheet buttons
keep the word `Number`.

**Nothing in the packing moved**, so no layout golden was rewritten: this changes the order of
notes inside a book, not where books stand. `INDEX_MODES` is now the one list of modes beside
`LOOKS` and `migrate` validates against it; no schema bump, since an older file never carries
`number` and an older build already drops what it does not know.

**And a picker asked the wrong thing.** A numeric book with nothing saved drew its two buttons
with *neither* pressed: `indexPicker` handed `indexChoices` the **shelf's** answer as the
fallback, and a shelf has no notes, so it answers `az`. It now passes `number` where the shelf
says `az` and every book in the selection qualifies. The check reads the picker **before** the
toggle saves anything — read after, it passes on the saved value and proves nothing — and goes
red at `number,date` where it now reads `number!,date`.

**The film was re-shot, both halves.** `contentsorder` is a 13-second act and its clip already
shipped; both filmed a lettered book and said *"title or date"*. The act now opens
`encyclopedia/0-9` through a new `inDigits` setup and runs Number → Date → a tab → Number, each
beat proved on `data-index-mode`. The middle frame carries the law no still can: the same note,
`0 to 1`, stays selected across the switch and moves from **1 of 2,064** to **1349 of 2,064**.

| | before | after |
|---|---|---|
| `docs/features/contentsorder.webp` | 833 KB, 1000×1000, a lettered book | **551 KB, 1000×1000, the `0-9` volume** |
| its caption | *Read by title or date* | **Read by title, date or number** |
| its sub | *The contents and right-hand index change together* | **A volume of numbers opens in Number. Contents and index change together** |
| the feature headings | *Choose A–Z or Date* | **Choose A–Z, Date or Number** |
| `assets/demo.webp` | 3,501 KB, 68s | **3,578 KB, 68s** — same choreography, later date |
| storyboard acts | 24 | **24, unchanged** |

**Two traps on the way.** `--hero-acts` is not `--act`: the first run filmed the whole
storyboard and died 720 frames into `hero`, because `--hero-acts` only says which acts the webp
is *cut from*. And the first clip came back **1000×626** — the hero encoder is `scale=1000:-2`
with no crop, so the shape is the capture's, and every shipped clip was shot at
`--width 1000 --height 1000`.

One new check, *a volume of numbers reads by number, and only such a volume is offered it*.

## 2026-09-15 - github#75: the escape gate counted the page's own icons

`check-data-escape --browser` asserted **0** `<svg>` anywhere in the document as proof that no
vault metadata had escaped as markup. The page draws icons of its own, so it read 13 and failed
on every vault:

```
check-data-escape: FAIL
  FAIL 13 <svg> element(s) in the DOM -- the payload named one
```

Where the 13 come from, neither of them vault data:

| source | count |
|---|---|
| `#vs-manageopen`, written into `src/page.html:16` | 1 |
| `shelfAction()`, `src/page.js:520` — 6 shelves x Edit/Hide | 12 |

**Not a regression, and red for some time.** `#75` measured `1395e0a` (before `#32`) and
`9be1fb6` (after) as byte-identical failures; reproduced again here on `c625251` before any
edit. `--browser` is one of the three gates run by hand, so no push ever caught it. The static
half was clean throughout — `0` raw `<`, `0` raw `>`, every payload back byte for byte — so the
gate's real job was never in question.

**The fix is a predicate, not a subtraction.** Subtracting a constant 13 is the same bug again
the day a seventh shelf lands, and it fails with a number rather than naming what appeared. Every
`<svg>` must now sit inside `#vs-manageopen` or `.vs-shelfaction`; a stray is reported with its
ancestor path. Owned icons must come to one per icon button, so an `<svg>` hidden inside a chrome
button fails too, and the absolute 13 is never asserted.

**The census proves itself on every run.** It plants an `<svg>` in `#vs-library`, re-reads the
same census, and requires one more stray than was already there, naming `vs-escape-probe`. The
old assertion had no way to fail for having stopped looking; this one does. It asserts one *more*
rather than exactly one so that a run which has already found a genuine escape reports that
escape, instead of also claiming the probe went missing.

**Proved the other way too, end to end.** A stray `<svg id="vs-fake-escape">` added to
`#vs-library` in `src/page.html` — an svg in the page that no icon button owns, which is what an
escape looks like — and the gate caught it and said where:

```
check-data-escape: FAIL
  FAIL 1 <svg> element(s) outside the page's own icon buttons -- the payload named one:
       body > div#vs-app.vault-shelf > main#vs-library > svg#vs-fake-escape
```

Reverted immediately; `src/page.html` is untouched in the diff. That ancestor path is the whole
point of naming a stray rather than counting one — the old gate could only have said `14`.

| | before | after |
|---|---|---|
| `check-data-escape` (static) | ok, 2 notes, 1,173 chars, 0 raw `<`/`>` | = |
| `check-data-escape --browser` | **FAIL, 13 svg** | **ok** |
| script elements in the DOM | 4 (4 in the file) | = |
| `<img>` | 0 | = |
| icon `<svg>` / icon buttons | not distinguished | **13 / 13** |
| stray `<svg>` | not distinguished | **0**, and a planted one caught |
| markers executed | 0 of 5 | = |

No shipped code moved: the change is `scripts/check-data-escape.mjs` and these two documents.
`src/` is untouched, so every golden, count and geometry is unchanged by construction.

**Left open.** Nothing runs `--browser` on a push, which is why this stayed red unseen. Wiring a
browser gate into the hook is a policy change about what a push costs — flagged for the
maintainer, not decided here.

## 2026-09-14 - github#51, second pass: the room is the lift PLUS what the look paints

The first pass gave `.vs-track` `overflow-clip-margin: var(--spine-lift-max)` and every lift is
painted whole. It tied the room to the **lift ladder**, and a look paints outside a spine's own
border box as well — so the same clip went on cutting a different thing.

How far above its track a spine is painted, allowed against wanted (the same frame under a 90px
margin that clips nothing), per look and state:

| look | state | lift | allowed before | wants | cut | after |
|---|---|---|---|---|---|---|
| leather | at rest / worn at rest / hovered / worn + hovered | 0-6px | = | = | 0 | 0 |
| leather | a search match | 7px | 7px | **8px** | **1px** | **0** |
| modern | every state | 0-7px | = | = | 0 | 0 |
| cyber | hovered | 6px | 7px | **18px** | **11px** | **0** |
| cyber | worn + hovered | 6px | 7px | **20px** | **13px** | **0** |
| cyber | a search match | 7px | 7px | **25px** | **18px** | **0** |

cyber's neon is `0 0 22px` on a match and `0 0 18px` on a hover; leather's match is a
`0 0 0 1px` gilt ring. So every matching book in cyber was sliced 18px short while a query was
live.

**The fix** is two tokens and a sum, `--spine-lift-max` + `--spine-halo` = `--spine-room`, read
by the track: 7 + 0 = 7px modern, 7 + 1 = 8px leather, 7 + 18 = 25px cyber. Written out, not
computed: `overflow-clip-margin` drops a literal `calc()`/`max()` at parse time and computes a
`var()` holding one to **0px**, which is the clip back to biting with nothing looking wrong.

**Numbers that had to not move, and did not.** Goldens unchanged (`6 shelves, 10 rows, 227
spines, 52 plaques, 1125px room in all 3 looks`); `a look moves nothing on the page` = `0 moved,
0 resized` over 4,358 elements in four states; `every control is the same size in every look` =
`0 off by more than a pixel` over 39 controls. All three re-read after the merge of `develop`,
against github#32's rewritten goldens rather than the ones this branch was cut from.

**The scroll budget is the one number that could not be read by one run, and it is not this
change's.** `scrolling the library stays smooth in every look` went over budget in leather on the
merged tree — and on `develop`. Sixteen `--only` runs alternating `develop`'s `src/` with this
branch's, so both arms met the same machine:

| arm | leather p95 median | over the 34ms budget | cyber p95 |
|---|---|---|---|
| `develop` | 16.8ms | 4 of 8 | 16.8ms in 8 of 8 |
| this branch | 16.8ms | 3 of 8 | 16.8ms in 8 of 8 |

Same median, same failure rate, and **cyber — whose room this change widens furthest, 7px to
25px — never moved off 16.8ms in any of the sixteen.** A clip margin that cost paint would bill
cyber first and leather least, which is the opposite of what fails. The failing runs are the
already-recorded variance: their scroll span reads **466px** against the ~1063-1102px of a
settled run, the exact signature this file records under *2026-09-13, one place decides the
browser* — "not a regression this introduced … the variance becoming visible". Containment is
untouched and still reported on by both room checks. **The authoritative read is a full-suite
run, which is the gated push to `develop`, not an `--only` on a loaded machine.**

**Checks.** New: `nothing a look paints outside a spine is cut off, in every look` — five states
per look, painted pixels under a wide reference margin, `:hover` forced rather than pointed at.
It cost 68s in its first working form (pixels back over CDP), 54s with the band diffed in the
page, and **20s** once the second read was dropped in favour of the room the other check already
proves. Renamed: `the room above a spine is the largest lift` → `…is the largest lift plus the
look's halo`, which also now asserts `--spine-room` states the sum it clips at. Two constants
moved in `a lifted spine is painted whole, in every look` (`OVER` 20 → 40, `REACH` 26 → 44) and
nothing else in it, github#69 being live on that check.

**Both fail without the fix**, naming the look and the shortfall: `CUT: leather a search match
paints 8px above its track into a room of 7px, so 1px of it is sliced off; cyber hovered ... 11px
... ; cyber worn and hovered ... 13px ... ; cyber a search match ... 18px` and `SHORT: leather by
1px, cyber by 18px -- UNSTATED: leather declares --spine-room 8px and clips at 7px`.
## 2026-09-14 - The runner drains the room before it blames a check

`github#57` and `github#69`, one fix, in the runner. `decisions/0016`.

**Before, on this branch's base, `--jobs 1` with all 24 cores under synthetic load.**

| | idle | under load |
|---|---|---|
| `"the room has a width, however wide the window is"` | 14/14 ok | **2 FAIL in 14** |

Both failures read `-- LEFT THE PAGE BUSY: a pending room measure (settleRoom's 60ms timer)`
with **every measured value correct and identical to the passing runs**: shelves 1180 (683/698),
rail 1180, row 1180, spread 1084 (738/738), 10 rows in all, months taking 4, worst overflow 0px.
The check waited `sleep(250)` — 250 ms of *Node* wall clock — for a 60 ms *page* timer, and a
starved Node process expires that sleep before Chrome has dispatched the resize.

**After.**

| | idle | under load |
|---|---|---|
| `"the room has a width, however wide the window is"` | ok | **0 FAIL in 12** |

**What changed.** `settled(page)` waits for `__vs.room().pending` to read zero across **five
consecutive reads 20 ms apart**, polled *inside the page* on the page's own `setTimeout`, one CDP
round trip, budget `SETTLE_MS = 3000`. The runner calls it after each check **before** `atRest()`
judges, inside `settlePage()` in place of `await sleep(90)`, and once before the first check of a
run. `viewport()` / `unviewport()` wrap it for checks; **all seven checks that drove
`Emulation.setDeviceMetricsOverride` by hand now go through them**, and the three private copies
of the stability loop are gone.

**The busy-page rule is aimed, not dropped.** `settleRoom`'s timer is the only item `atRest()`
names that drains on its own; a sheet, a drag, an edge scroll, an overscroll band and a room
measure that will *not* drain in 3 s all still fail the check that left them — the last of those
now saying `(still there after 3000ms)`.

**One check added:** `"a draining room measure is waited out, and nothing else is"`, which
returns with the timer deliberately just scheduled and asks `atRest()` directly whether an open
sheet is still named. Verified both ways — it passes on this tree, and with the drain removed it
fails with the exact words `github#57` was filed over.

**Gated on the merge result, not on the stale base.** `develop` moved eleven commits mid-ticket
(to `9be1fb6`, 139 checks, fixture digest `c1f3a5ca`), so it was merged in first. Two consecutive
full runs then passed **140/140** at **103 s and 108 s wall**, stamping tree `ec48616` under
github#55's two-green law — the same law that caught this defect in the first place. Neither of
the two checks known flaky on `develop` (github#76, github#77) bit in either run, and
`LEFT THE VIEWPORT OVERRIDDEN` never fired.

**Cost is one `settled()` call per check** — a floor of five reads 20 ms apart in one CDP round
trip. **No before-figure is claimed:** the base moved and the suite grew from 135 checks to 139,
so a wall comparison would be measuring the merge rather than the drain. Several converted checks
plainly got *faster* — `sleep(400)` and `sleep(250)` sized for the worst case now return as soon
as the page agrees.

**github#69 is not claimed as measured.** `"a lifted spine is painted whole, in every look"` did
not reproduce here in **29 runs** at `--jobs 1` under full load, alone and immediately after its
neighbour. It shares github#57's mechanism, which is gone; whether that was *its* mechanism is
unproven, and its pixel logic, thresholds and assertions are deliberately untouched. Next place
to look if it recurs: the compositor read in `paintedAbove()`, never a tolerance.

## 2026-09-14 - A shelf stands on a whole pixel, and a check names its lane (github#32, design/0034)

The merge to `develop` came back **137/139**, two checks red that pre-date the branch and pass on
`develop` with `src/` and `scripts/` reverted in place. Neither was in the diff.

**A lifted spine is painted whole, in every look: 6px of 7px, all three looks, both lift kinds.**
`smoke.mjs` shards its steady checks round-robin by index, so one inserted check flipped the lane
of every check after it, and this one met a predecessor that leaves a second shelf above the
Encyclopedia. Its track then sat at **652.25**: the rail was **46.5** (`#vs-q`, 13px x 1.5 = 19.5)
and every shelf **217.25** (`.vs-shelfhead { min-height: 32.25px }`, design/0021's pin to the
modern look's measured height). The 7px clip edge at 645.25 is snapped by Chrome to 646 - a real
missing pixel for any reader with a ribbon in a book, not a measurement artefact. Fixed in the
geometry, not the check: head floor **32px**, field line box **20px**, rail **47**. Fresh: track
top **409**, **7 of 7**, every look. The layout golden moved everywhere by a fraction and was
rewritten. The check now prints the track's raw top, the scroll state and every box above it on
failure, which is what found the head in a single run.

**An open book shows the ribbons in it, three at most: 0 stubs on a page that was not free.**
Purely the re-cut fixture: the check took the first Months book with five notes, marked five, and
turned to the last row expecting no ribbon there - `2015-09` has exactly five. It asks for six
now; `2015-10` holds 15.

Split by running the suite on this branch with `develop`'s generator: ribbons green, spine still
red - so one was the vault and one was the tree.

## 2026-09-14 - The 0-9 volume opens, and the contents toggle says it is one (github#32, design/0034)

Lukas, looking at the demo: *"when opening 0-9 encyclopedia there are no sub tags althought we
have many notes starting with 2022 for example"*.

**It was the only volume in the library where nothing opened.** `titlePrefix` pinned the 0-9 key
at four digits at every depth, so a deeper ask returned the same key, the layer separated nothing,
and `prefixCuts` fell out at its own `depth > 3` cap. Measured over every volume:

| volume | notes | top cuts | cuts that open | biggest dead end |
|---|---|---|---|---|
| **0-9** | 2,063 | 15 | **0** | **`2026` x 587** |
| S | 481 | 16 | 12 | `Sq` x 12 |
| C | 209 | 8 | 7 | `Cy` x 1 |
| A | 78 | 14 | 3 | `Ad` x 11 |

A year now hands its notes to `cutTree` with a `TITLE_DATE_LAYERS` twin of `DATE_LAYERS`, read off
the title rather than the date property: **11 of 12 fat cuts open**, `2026` (596 notes) opens into
**9 months** and `Sep` (91) into **13 days**, and the biggest dead end is `0-9` x**5**. The labels
stay `Mar` and `04`, so the rail is still **60px** - a raw `2026-03` key would have wanted the
71px that made a span name its start rather than its range.

**Four digits are a year only if they stop at four** - Lukas: *"we could have a note that is not a
date like 202212123123, incorporate that"*. The test carries `(?!\d)`, so a longer digit run falls
to the `0-9` bucket rather than hanging twelve months off a title with no date in it; a month is
validated by probing its first day through `isIsoDay`, which is what stops `2024-15-03` becoming a
fifteenth month called "15 2024". Not a plausible *range*, deliberately: `1000 small decisions`
still files under `1000`.

**The vault now carries one.** A guard nothing can reach goes quiet rather than red, so
`make-vault.mjs` plants `202212331243` in `00 - Inbox` as `DIGIT_RUN` and lists it with the
sentinels it refuses to finish without. It lands at index 649 of the volume under a `0-9` cut with
nothing under it, between the 2022 and 2023 runs: the volume goes 15 cuts -> **16**, the vault
4,938 notes -> **4,939**. Planting it re-cut the fixture - digest `178c03f6` -> **`c1f3a5ca`**,
every suite stamp on this machine now misses, and `layout-snapshots/vault.json` was rewritten (9
boxes moved, all month plaques, by up to 4px).

**And its cut is named `2022x`, not `0-9`** - Lukas: *"hmm it shoulld be called 2022x instead of
0-9"*. A tab is a position, and `0-9` says nothing about where in 2,064 notes you have landed - it
says it three times over, since the numerics are not adjacent. `202212331243` files after every
`2022-` note and before every `2023-` one, so the cut says so. (**Amended 2026-09-15, `github#70`:
the mark is `·` rather than `x` — smaller, mid-height, and 36px rather than 39.**) It makes `2022x` at **39px** the
widest label the rail draws, against `2020`'s 32px: 9px inside the 48px of cut, **0 cropped** at
either window size, rail unchanged at **60px**. The record's "what the labels need is 32px" is
amended - that held while every label was a year.

**And the contents toggle grew a `⇄`** - Lukas: *"shouldn't we flip the Date A-Z button?"*. Not
flipped: the cuts directly under that button are cut by that mode, so a face showing the mode it
would switch *to* would stand `Date` on top of a column of letters. The word stays the state, the
glyph carries the act, and the `aria-label` says both as it already did. The control's box is
unchanged at **55x28 at 10px**, the glass tab's box exactly.

The glyph started as a dimmed `<span>` and *a look moves nothing on the page* rejected it inside a
minute: leather and cyber drew that span **12px high against modern's 10px**, 1.7px lower, because
it inherited each look's face. It is part of the label's text now, so there is no box to move.

One new check, 91 -> **92**. Known and left: the non-year numerics are not adjacent in title order,
so the rail draws **three** cuts labelled `0-9` around the years. Correct by *a run is whatever is
adjacent*, scruffy to read; suppressing a cut that holds one note of 2,063 is a rule about every
volume rather than this one.

## 2026-09-14 - The rail is 60px, and a span says where it starts (github#32, design/0034)

Lukas, on the first cut of this: *"make the new design less width"*. It was 72px - 56px of cut
plus 16px of reserved staircase - and nothing in the record said where either number came from.

**What the labels actually need is 32px**, measured: `2020`, the widest thing the rail ever
says. The rail is **60px** now (48px of cut plus a 12px staircase), the notch is 5px rather than
8px, and a trail step keeps a tighter gutter than a cut that opens, so it pays for its own
notches out of its own room. The right-hand page's padding goes 88px -> **76px**, which is 4px
more than it cost before any of this work rather than 16px more.

**A range label is what made it wide.** `2024-2025` wants **71px** against `2020`'s 32px, so
a span is named by where it *starts* now - `A`, `D`, `G`, which is what a printed thumb
index does - and the cut below it is its other end. What it covers moved onto the cut, where a
pointer and a screen reader find it.

**And it was already being cropped, in thirty places, at 72px.** The check measured boxes and
never the label inside one, so nothing said so. Two things it had to learn:

| | |
|---|---|
| not `scrollWidth` | a right-aligned cut with hidden overflow crops on the **left**, and `scrollWidth` does not report start-direction overflow in LTR: it answered **48px for both** `2015` and `2015-2016`. The text's own laid-out rect answers 32px and 71px |
| not one fold | every notch takes another 5px off the label beside it, so the deepest trail is where labels have least room. Opening one level: **0** cropped. Opening all of them: **6** |

The check opens each of the fourteen fattest books and then folds all the way down - 12 folds at
1180x1000 and 32 at 1180x480, against 8 and 4 before - and asserts no label is wider than its
room. `white-space: nowrap` went on the cut in the same pass: a label that wraps is cropped by
the fixed height just as silently.

| | first cut | now |
|---|---|---|
| rail width | 72px, 6.6% of the spread | **60px, 5.5%** |
| what the index costs the prose column | 88px | **76px** |
| staircase notch | 8px | 5px |
| widest label | `2024-2025`, 71px | `2020`, 32px |
| cut labels cropped | **30** at 1180x480, unmeasured | **0** |
| folds measured | 8 and 4 | 12 and 32 |


## 2026-09-14 - The index rail reads like a thumb index, and fits (github#32, design/0034)

Measured on the vault shape over the fourteen fattest books, before and after, at two window
heights. `--jobs 1`, one Chrome.

| | before | after |
|---|---|---|
| cuts clipped, 1180x1000 | 0 | 0 |
| cuts clipped, 1180x480 | 0 | 0 |
| **smallest cut type, 1180x480** | **5.2px** on `tags/project/website-migration`; **4.09px** over the whole library | **11.5px** |
| smallest cut box, 1180x480 | **6.7px** | 20px |
| smallest cut type, 1180x1000 | 11.5px | 11.5px |
| rail width | 56px, 5.2% of the spread | 72px, **6.6%** |
| what the index costs the prose column | 72px of padding | 88px |
| most cuts on show at once | 27 | 32 |
| `people/-unfiled` (2,450 notes) | 11 year tabs, **months and days dropped by the ~30 cap** | 11 years, each opening its months; **nothing dropped** |
| `tags/garden` (808 notes) | 26 tabs | 27 cuts, 22 of them opening further |
| cuts lit at the end of a book | up to **26 of 26**, and more than one on every book measured | **1**, over 42 openings |
| rail re-fits on a height-only resize | **no** - 25 cuts, `scroll: 289` overflowing at 1180x480 | yes, 7 cuts, `scroll: 0` |

**The three answers that had already been tried.** `overflow: hidden` clipped the cuts in
silence; `dateTabs`' cap of about thirty dropped the days and then the months; `design/0032`
replaced the clip with compression that ran all the way down to 4.09px type. All three end in
something the reader cannot use.

**The negative test.** Restoring only `src/page.css` to `origin/develop` and leaving the new
JavaScript in place turns *no index cut is clipped, and none is shrunk past reading* red with
**305 cuts under 11px, smallest 4.09px** at 1180x480 - the floor is doing the work, not the
gathering alone.

**Two bugs that only measuring found.** `aria-current` was on every cut at or before the page,
so a book read to its end lit the whole rail. And the room watcher deliberately ignores a
resize that did not change the *width* - correct for the packing, wrong for a rail fitted to
the height it has, so a window dragged shorter kept the index it had been fitted for and let
the end of it hang off the bottom. Neither is visible to a check that counts tabs.

**One dead end, costed.** Gathering only the single level that overflowed spent all sixteen
passes on one book's days and never reached its years: `people/-unfiled` came out with 11 cuts
overflowing the rail by 23px, with the trace `33x 33x 30x 30x 28x 27x 25x 25x 25x 25x 23x 23x
22x 21x 20x 20x`. Gathering every level at that depth together converges in a handful of passes
and is also the right answer to look at - one year's months gathered into spans while the next
year's stand singly is two indexes in one book.

Checks 88 -> **91**; `check-comments` baseline 1477 -> 1517.

## 2026-09-13 - Context-budget cleanup: history moved out of CLAUDE.md

Phase 3 of Lukas's context-budget cleanup (via Alfred) pulled the following history clauses out
of `CLAUDE.md`'s "How to work here" section, leaving each rule in place with its `github#N` /
`decisions/NNNN` pointer intact. Nothing here changed behavior; this is where the *why*
now lives instead of inline in the tracked brief.

**The suite jobs cap (`github#39`).** Four Chrome lanes was the default before this issue; it
is the load that hard-restarted the sister repo's machine across six worktrees. The cap to two
costs real time — 78s at four lanes against 90s at two — before the fixture audit brought the
whole run down to 41-43s regardless.

**The push-hang incident (`vault-graph@f9a167a`).** The sister repo hit this live, pushing a
release: wrapping a `git push` to `develop`/`main` in an outer `lock.mjs acquire`/`release`
makes the pre-push hook's own internal lock acquisition block on the outer one, and the push
hangs until the outer lock's stale window expires.

**Separate lock roots, pre-2026-09-10.** Vault Graph and Vault Shelf originally kept their own
lock directories, so each held a `screen-left` / `suite` lock the other could not see and the
two suites ran concurrently anyway despite sharing one machine, one Chrome and one screen. Fixed
by moving both onto one shared root, `obsidian-vault-locks` (`github#37`).

**The old fixture-pruning behaviour (`github#8`).** The fixture store used to delete every
other digest of a fixture on a miss, which pulled the vault out from under up to five other
suites running concurrently every time somebody edited a generator. It now only collects
fixtures provably finished with (older than the refresh window) and abandoned build
directories.

**Issue labelling before the label rule (2026-09-11).** The rule that every filed issue must
carry a label exists because the backlog it was written for had **31 of 31 open issues
carrying no label** at the time — labelling had stopped being worth filtering on at all.

**The generated-vault fixture consolidation (`decisions/0014`).** `scripts/make-vault.mjs`
replaced three separate fixture generators with the one 5,000-note generated vault the suite
now measures against exclusively.

## 2026-09-13 - Keep builder source choices while previewing

Two demo users reported that choosing a tag or folder while creating books jumped the picker
back to the top. The reproducible path was the shelf builder's source value select:
`readBuilderFields()` replaced `draft.source` before reading `#vs-bsourceval`, then refilled
the dropdown with no chosen value. A non-first folder, tag or property therefore snapped back
to the first option while the preview refreshed.

The builder now reads the current kind, value and property before rebuilding dependent lists,
and only refills the source values when the source kind changes. The made-book sheet already
kept the value select stable, and its existing smoke path still passes.

**2/2 targeted browser checks pass in 10 seconds wall.** The builder check now selects
non-first values and keeps `05 - Meeting Notes`, `area/health/running` and `date` selected
after the form handler runs; its preview still matches the real People shelf at **26 books**
over **4,938 notes**. The made-book check still makes `favourites/-made-dailies` from
`04 - Daily Notes`, holding **1,204 of 1,204** notes, and cleans up with zero made books left.
Strict lint, scope, network, comments (1477/1477), PII, data escaping, update-note selftest,
code-map check, both determinism checks, refresh wiring and lock selftest pass. No recordings
or release media were changed by request.

## 2026-09-13 - Wait for complete fixture history before the no-write strip check

The actual update-strip harness passed 32/33 because its already-seen case supplied only
a version marker, so the new book-history baseline legitimately needed saving. Reusing
migrated settings alone still failed while the throwaway vault indexed: a concrete diff
showed only wear/lastOpened/bookNotes changing, from 243 to 247 known addresses, with 161
ledgers gaining metadata-derived notes. Another sample caught data.json briefly empty during
an asynchronous write.

The harness now waits for every fixture Markdown file's metadata before its scenarios and
for valid history settings with stable bytes after opening the library, under bounded
timeouts. The already-seen case reuses migrated settings; its exact byte-for-byte no-write
assertion remains unchanged. No product code changed.

The actual 1.0.0 run reports **4,938 metadata-ready notes and 33/33 passed**, including the
unchanged data.json assertion. Syntax, strict lint, comments (1477/1477) and generated maps
pass. Evidence: `dist/update-strip-1.0.0-history-final.log` and its sibling screenshot folder.
The harness closed its own Obsidian and released screen-left. No full suite or release media
changes ran.

## 2026-09-13 - Show the current activity count in a spine's peek

After two opens, acoustics correctly held count 3 but its cached hover text still said 1.
The peek now reads the current source-address count when shown; descriptive text stays
cached, and no spine or shelf is rebuilt. Favourites read the same source count.

**2/2 targeted checks pass in 3 seconds wall**. Visible peeks report **1, 2, 2, 3, 3** across
the source and favourite before/after two opens; all preserve lastOpened, and the same
spine nodes remain. Thirteen additional visits and rebuild persistence still pass, along
with the timestamp regression. Strict lint, scope, network, comments (1477/1477), build
and generated maps pass. Evidence: `dist/live-activity-peek.log`. No capture, media edits
or full suite ran, following the user's instruction to retain the existing media.
## 2026-09-13 - Keep approved films and update the future wear recipe

The owner explicitly requested no more recordings after the counter change. Approved v5
hero, all 24 feature clips and the 389-second full walkthrough remain untouched. Only the
future 19-second wear recipe changes: existing entries on the old year book, then the
one-note acoustics book and two real opens. Its counter advances 1 to 2 to 3, its single
`bookNotes` identity stays unchanged, and `lastOpened` changes from `never` on a real open.
No counter is seeded or reset. Hero choreography and the other 23 feature acts are identical.

The one pre-waiver validation reached the correct counter 3 and visible wear level 1,
then rejected a stale peek still showing 1. That product defect is handled separately;
the recorder keeps its assertion rather than hiding the failure with a rebuild. Syntax
and strict lint pass. No additional take, product change or media replacement is included.

## 2026-09-13 - Count note entries and visits without repeating the baseline

The user extended the opening counter to include existing notes once and newly added notes.
`wear` retains legacy counts; `bookNotes` records distinct seen IDs per stable source address.
Mount/rebuild reconciliation uses full unfiltered membership and saves through the existing
onSettings callback. Removal/reappearance cannot count an ID twice. Hidden sources, made
books, reference sharing and stable plaque-address unions are covered. Known books and old
wear keys receive explicit `lastOpened: "never"`; only a real open records a timestamp.
The 9,999 cap is replaced by MAX_SAFE_INTEGER, and the existing peek says “entries and visits”.

**5/5 targeted browser checks pass in 12 seconds wall**. Measured 7 legacy opens plus 54
notes become **61**, repeated load/filter remains **61**, a new note gives **62** with
`never`, removal/rebuild remains **62**, and a favourite visit gives **63** plus its timestamp.
Reset seeds **54** again, and all **275** known fixture addresses explicitly read `never`.
The separate core check proves distinct-note deduplication, monotonic ledgers through
removal/reappearance, obsolete history preservation, large counts, made books and plaques.
Timestamp persistence, age wear, thirteen additional visits and manual plaque runs pass too.
Strict lint, scope, network, comments (1477/1477), escaping, PII patterns (no name list), build
and generated maps pass. Inspected `dist/book-note-counters-after-vault.png`: populated books
now show stronger wear, so release media needs refreshing. Results are in
`dist/book-note-counters-after.log`. No private vault mutation, media edits or full suite.

## 2026-09-13 - Refresh the demo after release-gate repairs

The demo was refreshed from current source `8d52c82` using the same 1,242-note generated cut: 1,690,661 bytes, four inline scripts parse, exact current page/shared CSS included, and the stable preview copy is byte-identical. It now includes the manual plaque fix and last-opened metadata. No UI or approved capture changed: manual split-run repair does not affect the recorded default plaques; Reading/index fixes are harness-only; timestamps add persistence without a visible control. The approved hero SHA-256 remains `752825f3881781810c350cb0c91038194fe98d2b74142788a93d51253afe778e`.
No browser or full suite ran for this documentation refresh.

## 2026-09-13 - Record when a book was last opened

Book opening history previously held a count without a timestamp. Actual opens now also
save an ISO UTC `lastOpened` value by stable source address, with `never` for missing
entries. Legacy counts remain intact and receive no invented dates. Favourites share the
source stamp; made books and plaques retain their addresses. Page turns and rebuilds leave
the stamp unchanged. Deletion and reset remove it consistently with wear. No UI changed.

**3/3 targeted checks pass in 8 seconds wall**, covering timestamp persistence, existing
wear counts and manual plaque runs. The measured source began at `never` with count 7:
first open recorded `2026-09-13T05:45:43.934Z` and count 8; opening its favourite recorded
`2026-09-13T05:45:44.046Z` and count 9 without an alias entry. Saved storage, rebuilds,
made/plaque stamping, deletion and reset passed. Core checks cover defaults, legacy counts,
round trips and malformed timestamps. Strict lint, scope, network, comments, escaping,
PII patterns (no local name list), build and generated maps pass. Inspected the unchanged
reader in `dist/last-opened-after-vault-reader.png`; results are in
`dist/last-opened-after.log`. No full suite or release media edits.

## 2026-09-13 - Keep a manual plaque's selected run when opening it

The release gate reproduced a product regression from the contents-picker refresh: moving
acoustics to the end of manual Tags made two A plates, but both opened **1,812 notes**.
`openBook` re-resolved an already-built virtual run by its shared address and lost the clicked
run. It now refreshes ordinary books through the real-book index while retaining virtual
membership. The moved plate opens **1 note**; the first still opens **1,812**. Age wear was
not involved.

**5/5 targeted checks pass in 9 seconds wall**: split manual plaques, wrapped automatic
plaques, plaque ribbons/rebuilds, contents-order persistence and age wear. The existing
manual-plaque check now captures the selected run and restores any prior manual order.
Inspected `dist/manual-plaque-after-manual-plaque.png`: one row, one selected note and
the footer's 1 of 1 agree. Logs: `dist/manual-plaque-before.log` and
`dist/manual-plaque-after.log`. Strict lint, scope, network, comments (1479/1479), static
escaping, PII patterns (no local name list), build and generated maps pass. No full suite ran.
Automatic plaque behavior and default shelf rendering are unchanged, so default release
captures do not require replacement for this fix.

## 2026-09-13 - Measure Reading rows beneath their intentional wear lift

The release run at `0dbce28` counted two painted bottom edges on a single Reading row:
296px for a level-3 aged book and 298px for a fresh one. With 32 ribbons it counted five
painted bands over two actual tracks. These were the existing 0/1/2px wear transforms, not
extra rows. The line-containment assertion also mistook the lifted top edge for overflow.

The test now requires each transform to equal its exact permitted wear lift, then measures
the untransformed top/bottom against the line and its board. Two and three ribbons each
measure one track/one baseline; 32 ribbons measure two tracks/two baselines. Packing remains
strict: 13px is left where the next book needs 42px plus the gap. Negative probes require
rejection of a 3px layout margin and an invalid 3px transform; both are rejected. Probe
transitions are disabled so their deliberately bad geometry is measured after it is applied.

The targeted Reading check passes 1/1. `dist/reading-geometry-reading.png` was inspected:
three ribboned books share one board, with legible labels, visible ribbons and the intended
small wear lift. Only the harness and its documentation change; product appearance and
approved recordings are unchanged. No full suite ran.

## 2026-09-13 - Settle the index test's restored viewport

The release run's index/icon check passed every geometry and action assertion but failed
its cleanup gate with a pending room measure. Clearing emulation and sleeping 150ms did not
prove that the resize observer and its 60ms timer had finished. The harness now saves the
original viewport, explicitly restores its exact width and height, and requires five
consecutive idle samples at each requested size. Product code and all existing assertions
are unchanged.

The affected check and its immediately following biggest-book index check pass **2/2**.
The 25 letter tabs still measure **25.4375px** high at 1180x1000 and **6.71875px** at
1180x480, with zero overflow; the fixed controls remain **28px**, the strip **56px**.
Cleanup restored the captured **1584x961** viewport with **pending: 0**. The following
2,450-note book retained its 11 tabs. Inspected `dist/index-settle-vault-reader.png`; the
spread and index are visible and unclipped. Syntax, strict lint and generated-map checks
pass. Only these two browser checks ran; no product or approved media changed.

## 2026-09-13 - Approve the complete Vault Shelf 1.0.0 release preparation

The owner approved hero v5, all 24 feature clips, the release body and actual update strip.
The promoted hero is 68 seconds, 1000 x 1000, with 365 WebP frames; the full walkthrough
is hero first plus all features: 389 seconds and 9,336 MP4 frames. Feature media totals
321 seconds and 14,050,604 WebP bytes. The current generated demo has 1,242 notes and
1,689,693 bytes, with the age, first-match and narrow Manage changes embedded. Its four
inline scripts parse, and exact current page/CSS comparisons pass. The comment checker
measured two fewer prose-comment lines after recorder cleanup, so its ratchet moves from
1,481 to 1,479. Release verification records approval separately from pending final gates.

## 2026-09-13 - Test a real predecessor for the 1.0 update strip

The actual 1.0.0 update-strip run initially passed **28/31**: the harness called 1.0.0 its
own previous minor, so its upgrade/restart assertions exercised an already-seen release.
The harness now chooses a previous major when the minor is zero and labels that transition
MAJOR. Explicit decision checks retain both 0.9.0 to 1.0.0 and 1.0.0 to 1.1.0 coverage.
The pulse target remains the current Manage control, with positive pulse, dismissal and
reopening assertions. Product code is unchanged.

The real Obsidian run with the release-prep 1.0.0 metadata and current product build passes
**33/33**: the original 31 checks plus both transition decisions. A 0.0.0 to 1.0.0 upgrade
shows the note and records nothing until dismissal; same-version and patch cases remain
quiet. The strip returns **164.13px** to the library on dismissal without changing its
**1556px** width. Inspected `dist/update-strip-1.0.0/01-strip-up.png`; the five bullets,
release/gallery links and Got it control are legible above the shelf.
`dist/update-strip-1.0.0.log` records the run. Syntax, strict lint, comments and generated-map
checks pass. Temporary release metadata was restored before committing; no full suite ran.

## 2026-09-13 - Keep narrow Manage rows identical in every look

The release follow-up reproduced `a look moves nothing on the page` failing after the
Manage viewport check: **728 moved / 16 resized**. Independent narrow measurements found
Leather wrapping Delete alone on Months and People, adding **42px**. Shared phone grid
positions now keep controls in the same rows at **390px and 320px** in all three looks;
wide geometry remains unchanged. The strengthened Manage test checks row/control geometry,
fit and pick-shelf rules, and waits for viewport restoration plus the page's room measurement.

The Manage, four-state look-invariance and colour/visibility persistence checks pass **3/3
in 11 seconds wall**. All **4,358** elements in the original look check report **0 moved,
0 resized, 0 missing**. Inspected `dist/manage-look-final-manage.png`: the phone sheet shows
the name, arrows/Shown, paired Edit/Delete and colour rules without clipped controls.
`dist/manage-look-final.log` records the final paired run. Strict lint, scope, network,
comments (1481/1481), static escaping and PII patterns pass (no local name list).
No full suite ran.

## 2026-09-13 - Wait for the requested contents row during integration checks

The combined age-wear/first-finding run caught the test sampling a long smooth Next scroll
before it started: the Date contents remained near **31,418px**, although the right note
had correctly advanced to index **1**. The bounded waiter now requires the intended row
to be visible and its scroll position stable before proceeding. Product behavior and the
assertions are unchanged; a query update cannot complete the navigation on the test's behalf.

The exact combined run passes **2/2 in 13 seconds wall**. Date Next independently reaches
**138px in 1,694ms**, and A-Z reaches **155px in 1,691ms**, before query changes. Initial
matching row **1,225** remains visible without changing note index **0**; no-hit, blank-query
and explicit-note fallbacks pass. Age wear remains **3** for 2015 versus **0** for 2026 with
zero saved opens. Existing tab/Previous/ribbon, index-click and page-turn checks also pass.
Strict lint and syntax checks pass. Inspected `dist/age-search-integration-final-first-match.png`:
the matching row is visible near the left page's top while the original note stays on the right.

An earlier overbroad targeted selection separately found the look-invariance check failing:
Leather's Manage rows grew by **42px**, with **728 moved / 16 resized** elements. This is
reported separately for release review; this test-wait repair does not resolve it.

## 2026-09-13 - A searched book reveals its first matching contents row

An ordinary book open now places the first matching row near the top of the left contents
page without changing the selected note or right-page position. The initial reveal is
immediate and consumed once; explicit note/ribbon destinations and later navigation keep
their existing selected-row behavior. Blank queries and books without a hit fall back to it.

Before: on the 2,450-note No one named book, the first matching row was **1,225**, offscreen
at left scroll **0px** in both Date and A-Z order. After: the same row is visible at
**31,426px** (Date) and **31,443px** (A-Z); the selected note remains index **0**, right scroll
**0px**. Next reveals row 1; changing the query then preserves that position. Explicit-note
opens and both fallback cases reveal the selected row. A smooth initial reveal was replaced
with immediate positioning after measurement caught it starting after the book opened.

**6/6 targeted checks pass in 21 seconds**, including contents defaults, appearance drafts,
match explanations, ribbon/tab/Previous navigation and index clicks retaining their scroll.
Build, strict lint, scope, network, comments (1481/1481), static escaping, generated maps and
PII patterns pass (no local name list). No full suite ran. Inspected
`dist/first-finding-after-first-match.png`: Wide router cutters is visible and highlighted
near the top of the left page while the right page still shows its original opening note.

## 2026-09-13 - Integrate search scope and match reasons with the spine picker

The merge keeps both reader state fields: page-edge landing and the live query used for
match explanations. Search indexes flow through library marking, contents filtering and
note reasons; contents-order controls and all six bindings remain present. Both branches'
verification records are preserved and the code map/index regenerated.

**15/15 targeted checks pass in 12 seconds** over 4,938 generated notes: metadata/cover
search excludes prose and complete paths, 4,140 matches have 4,140 reasons with zero
disagreements, and cover-only names still work inside books. Vocabulary, contents-order
persistence, book appearance drafts and reader/index geometry checks pass too. Build,
strict lint, scope, network, comments (1481/1481), static escaping, refresh wiring (7/7)
and generated-map checks pass; PII patterns pass without a local name list. No full suite ran.
The live `project` query was inspected in `dist/search-integration-vault.png` and
`dist/search-integration-vault-reader.png`: the reader shows 673 of 1,755 matches alongside
marked rows and metadata, with the Date control and reading ribbons intact.

## 2026-09-13 - Refresh the release's live demo from the declared fixture

After integrating search scope and match reasons, exported the same generated cut again.
The final demo remains **1,242 notes**, now **1,687,448 bytes**, and embeds the current
page source, search index and reason engine. Four inline scripts parse; automatic overrides
remain empty; PII patterns and network checks pass. The plugin build names version **0.9.0**.
This second export received source-only verification; the screenshot below precedes search integration.

Regenerated `docs/demo/index.html` with the current `make-vault.mjs`, `--notes 1200`,
seed `20260909` and end `2026-09-11`, matching the shared fixture `vault-178c03f6` stamp.
The scratch fixture is `dist/demo-fixture-0.9.0`; the exporter uses `--demo` and the stable
name `Vault Shelf Demo`. No real vault or mirror was read. Notes remain **1,242 -> 1,242**,
and the export is **1,679,455 bytes**. Existing embedded product code was already current;
the regenerated fixture data now follows the shared fixture's end date. All inline scripts
parse, embedded page code matches current source, and automatic colour/binding overrides
remain empty. PII patterns pass (no local name list). A separate headless Chrome captured
`dist/demo-0.9.0-visual.png` at 1000x1000, with 231 rendered spines and zero console errors,
then closed. The screenshot was inspected: seeded Favourites, library controls, varied leather
bindings, shelf counts and decade plaques render clearly with no overlay covering the library.

## 2026-09-13 - Update-note pulse check follows the current Manage control

The real Obsidian update-note check passed **30/31** before repair: its synthetic note
pointed at the removed `vs-order` control. It now points at `vs-manageopen`, preserving
the positive animation assertion and both dismissal/reopening checks; product code is unchanged.
`node scripts/update-note-check.mjs --out dist/update-strip-0.9.0 --lock-timeout-ms 1000`
passes **31/31**: Manage animates with `vs-new-pulse` for 1.9s, then zero controls pulse
after dismissal or reopening. The screen lock was released and plugin console errors were zero.
Syntax and targeted ESLint pass. Screenshot `dist/update-strip-0.9.0/04-pulse.png` was inspected:
the Manage gear is visibly highlighted while the update strip is open.

## 2026-09-13 - Compressing tabs and inline shelf actions

The right-edge section tabs compress without scrolling; Search and A-Z/Date stay 28px high.
Shelf Edit/Hide hover buttons become always-visible 12px gear/eye icons after the note count,
with matching colour and dot separators. A targeted headed check verifies all 25 tabs fit
at 1180x1000 and 1180x480, mode switching keeps control sizes, and both shelf actions work.
The index checks and cross-look geometry checks pass. No full suite was run for this change.
Manage is a gear icon, and the redundant New book header button is removed in favour of
the plus spine.

## 2026-09-13 — All checks pass in visible Chrome on the left monitor

User-authorized `node scripts/smoke.mjs --headed --jobs 1 --lock-timeout-ms 1000` ran all
121 checks in visible Chrome using the harness's left-monitor placement and screen lock.
**121/121 passed in 58 seconds** (85/85 general checks, 36/36 layout checks). Both locks
were released. Log: ignored `dist/full-suite-headed-2026-09-13.log`. The harness does not
stamp headed runs, even when every check is selected.

## 2026-09-13 — Full suite passes after the four check repairs

User-authorized `node scripts/smoke.mjs --jobs 1 --lock-timeout-ms 1000` completed in
headless Chrome: **121/121 passed in 56 seconds** (85/85 general checks and 36/36 layout
checks). All four previously failing checks pass in the full run. The complete log is kept
in ignored `dist/full-suite-2026-09-13.log`. Both locks were released. No suite stamp was
written because the working tree has uncommitted changes.

## 2026-09-12 — Repair the four full-suite failures

All four failures were in the checks or their shared-page setup; no product code changed.
Five targeted checks, including the hand-colour check immediately before decade grouping,
pass together in both headless and headed Chrome (7 seconds each).

- Migration now expects both shelved looks to resolve to Leather, matching the offered-look
  rule. All other legacy settings assertions remain.
- Reading shelves measure common **bottom** edges and require every spine to fit inside its
  row. The two-book case has 128px and 132px books ending at y=295; 32 books occupy exactly
  two rows. The first row still has only 13px spare for a 42px next book.
- The hand-colour check restores `bookColors` in `finally`. Running it before the date check
  now leaves zero split periods across 11 month-years and 2 year-decades.
- The page-turn check had sent a synthetic wheel event at the top of a page with **29px**
  left to scroll. Synthetic wheel events do not perform native scrolling. It now reaches
  the bottom explicitly and checks the two timers independently: slow notches accumulate
  100px, 200px and turn; the latch clears; a new 200px partial push expires to 0px after
  800ms; the next notch starts at 100px without turning. The 140ms/600ms timers are unchanged.

The full suite has not been rerun after these fixes.

## 2026-09-12 — Full-suite verification of the spine-picker branch

User-authorized `node scripts/smoke.mjs --jobs 1 --lock-timeout-ms 1000`: **117/121 passed
in 56 seconds** (82/85 general checks, 35/36 layout checks). No successful-suite stamp.

Four failures remain:

- Older-settings migration still expects Modern to survive; the requested sole offered
  Leather look migrates it to Leather.
- Reading-shelf row checks still compare spine tops and expect uniform height. The requested
  binding types have different heights while sharing a bottom edge.
- Decade colouring sees one split decade in the full run. It passes in isolation; the
  preceding hand-colour check leaves a book override in the shared page.
- Slow page-turn accumulation reaches 100px, 200px and then turns as expected, but its next
  push after 800ms reports 0px rather than the asserted 100px. This also fails in isolation.

The isolated follow-up selected only decade colouring and slow page turns: 1/2 passed.
No second full-suite run and no implementation or assertion changes were made for this audit.

## 2026-09-12 — Automatic preserves scroll and the demo starts automatically

Reproduced the reported jump: choosing a colour or Automatic while scrolled to Tags took
the library from 1495px to 0px and disconnected the book nodes. `setBookColors` rebuilt the
whole library even though the change was paint. It now uses the same repaint path as the
binding picker. Eight book/board actions (choose/reset colour/binding) now keep 1495px
unchanged and retain the same nodes. The regression settles the destination's lazy layout
before measuring so intrinsic-height estimation is not counted as a paint movement.

The demo now embeds automatic defaults with zero `bookColors` and `bookSpines` overrides.
`--demo` enables the export settings; the former `--demo-seed` flag remains compatible but
does not stamp book choices. Grouping is deterministic, the initial four Favourites remain,
and saved settings still win on subsequent reloads. Both generated demos were refreshed;
the open Chrome demo's existing book overrides were cleared as requested and stayed empty
after reload. Its previous settings were backed up in the ignored `dist/` directory.

## 2026-09-12 — Binding heights, antique tooling and grabbable wood shelves

User correction: height belongs to the binding type, not the book address. Measured heights
are Original 132px, Gilt 130px, Morocco 128px, Vellum 126px and Aged 124px, with exactly
one height per type across the library. Widths and addresses remain fixed during previews;
the title-to-decoration minimum stays 3px. Original's artwork remains intact. The other
four use locally drawn antique tooling inspired by the supplied reference; Aged gains edge
creases and diagonal wrinkles. Vellum now mixes 58% dye, up from 18%, and measurements
confirm 14 distinct painted backgrounds for the 14 choices.

Warm gold and pale teal extend the picker from 12 colours to 14. Saved twelve-slot palettes
still load. The new last slot survives migration, and Manage measures 14 dyes, 14 matching
ribbons and 14 distinct complements with working edits, resets and persistence.

Boards grow from 10px to 14px, their grab strips from 18px to 22px, and the leather boards
carry subtle grain and knots. Right-click now works on the board and empty automatic rail;
New book here stays limited to manual shelves. The shelf drag check now preserves the
four seeded Favourites and measures the dropped book against that starting set.
Shelf drag/drop, board picker, colour previews, title clearance, list mode and look geometry
checks pass. The updated golden keeps 6 shelves, 10 rows, 227 spines and 52 plaques in a
1125px room; every control and 4,226 elements remain aligned across the three measured looks.
Fourteen distinct targeted smoke checks pass. Build, lint, scope, network, comment budget,
data escaping, refresh wiring and build-order determinism pass; PII patterns pass with no
name list available. A real Chrome right-click on Years' wooden board opens 14 colours and
5 bindings, at both desktop width and 390px. The narrow picker stays between x=12 and x=382
and within the viewport vertically. Screenshots were inspected and Chrome reported no errors.
The generated offline demo was refreshed; the full suite was not run.
Original retains the chosen dye across the full spine, including its raised head and foot bands.

## 2026-09-12 — Five leather bindings beside the colour picker

Implemented on `develop` at `eb746bb`. The earlier work from the outdated base is stashed.
The existing Original leather remains available alongside Gilt, Morocco, Vellum and Aged.
The same menu now holds 12 colours and 5 bindings, with live preview and saved selection.

Fresh definitions go from 7 shelves (Weeks hidden) to 6 (Weeks absent); saved Weeks survive.
People and Tags vary per book, Years by decade and Months by year. Leather is the only
offered look; Modern and Cyber remain available to the measurement harness.

Measured on the declared vault: 5 distinct binding paints and inks, 3px minimum title
clearance, no size or address changes during preview, no preview writes, cancellation
restores paint, and saved choices survive migration and rebuilding. Seeded demo settings
cover 227 source books, coordinate 15 period groups, and use all 5 styles on each identity
shelf. Same seed repeats; a different seed varies the result. A real Chrome reload preserved
settings and painted bindings/colours, with no console errors.

Height variation is 0–4px per source address. The refreshed golden retains 6 shelves,
10 rows, 227 spines, 52 plaques and a 1125px room in all 3 measured looks. The title census,
existing colour previews and selection, ribbon placement, list mode and new binding checks
pass. Screenshots of the library and combined picker were inspected in Chrome.
The committed demo was regenerated from the declared 1,200-note cut with a stable seed.
See `design/0029` for persistence and the title/decoration contract.

Build, strict typecheck, lint, scope, network, comment budget, data escaping, refresh wiring,
generator determinism and build-order determinism pass. PII patterns pass; no local name list
was available. Eleven distinct targeted smoke checks pass; the full suite was not run.

## 2026-09-12 — The search reads titles, covers and declared metadata (github#58)

> "just note titles and real book cover names, otherwise we match way too much…"

`core.matchesQuery` read a note's title, **path**, tags, people and **body**. More than half the
library answered to `which`, `#vs-hits` counted a number with no information in it, and — because
the match was somewhere in the prose — opening a book told you nothing about why it had been drawn
forward. The other half of the same fault: a cover a person can *read on a spine*, **Aug 2026**,
could not be found at all, because `labelFor()` builds that string for reading and no note contains
it.

The rule, decided 2026-09-12: **a note matches if the needle is in its title, in the cover of any
book it sits behind, or in its declared metadata — tags, people, folder. Body and path are
dropped.** Covers alone was the other candidate and was rejected: it makes the search
*shelf-dependent*, so `inbox` finds nothing in a vault with no Folders shelf — which is the default
library — and hiding a shelf quietly makes its notes unfindable.

Measured on the one vault, 4,938 notes in 687 books:

| typed | before | after | why |
|---|---|---|---|
| `afternoon` | 1,446 | **0** | prose |
| `which` | **2,867** | **0** | prose |
| `agreed` | 1,842 | **0** | prose |
| `Dagny Halvorsen` | 451 | **0** | the name the generator writes only into bodies |
| `.md` | **4,938** | **0** | path |
| a whole note path | 1 | **0** | path |
| `garden` | 1,462 | **1,459** | tag · book — the signal moves by 0.2% |
| `mira` | 631 | **621** | person |
| `学び` | 137 | **136** | tag · book |
| `inbox` | 192 | **192** | folder, with **no Folders shelf on the rail** |
| `project` | 1,818 | **1,818** | folder and tag |
| `aug 2026` | **0** | **285** | a cover became searchable |
| `sep 2026` | **0** | **301** | a cover became searchable |
| `undated` | **0** | **531** | so did a sentinel's cover |
| `No one named` | **0** | **2,450** | so did that one |
| `2026-08` | 114 | **89** | the **key** stops matching; the label more than replaces it |
| `a` | 4,938 | 4,936 | the Encyclopedia volume `A` is a real cover |

**The noise goes to zero and the signal does not move.** Every number in the issue's own table is
reproduced exactly, which is what says the rule that shipped is the rule that was measured.

### A cover is not a property of a note

`matchesQuery(note, needle)` could no longer answer alone: the covers a note sits behind are known
only once the library is built. Two candidates — resolve them per book inside `markMatches`, or
build a note→covers index where the vocabulary is built. The index won, because `markMatches` walks
**33,871 book-note slots** per keystroke and the per-book form does the same work 687 times over.

`core.buildSearchIndex(views, notes)` folds each note's own text and every cover it stands behind
into **one string**, once, in `rebuild()`. Matching is then one map lookup and one `indexOf`, and
`markMatches` reads a note **once per query** rather than once per each of the 7.6 books it stands
in. That is why the change is a speed-up rather than a cost:

| sustained typing, per keystroke (one run, `project`, 210 keystrokes) | before | after |
|---|---|---|
| marking only | **11.8 ms** | **1.2 ms** |
| marking and offering the list | 11.8 ms | **1.4 ms** |
| `core.markMatches` alone, headless | 11.59 ms | **1.31 ms** |
| `core.buildSearchIndex`, **once per rebuild** | — | **5.2 ms** |

The old rule called `toLowerCase()` on 33,871 titles **and** 33,871 bodies on every key; the new one
folds 4,938 strings once per rebuild and never again.

### github#41's workaround is deleted, and its invariant is now true by identity

The vocabulary offered a book by its **key** (`2026-08`) rather than the cover you read on the
spine, precisely because a label matched nothing — that was the honesty check failing at 29 of 77
on its first run. A book contributes `book.cover` now, and the build-time verification that no key
is offered that no note spells is **gone**: with covers searchable, *the vocabulary and the search
are the same set*, so every suggestion marks at least one note by construction rather than by a
pass that checks it.

| | before | after |
|---|---|---|
| terms the box knows | 5,147 | **5,151** |
| — people / tags / folders / books / titles | 25 / 43 / 12 / 222 / 4,938 | 25 / 43 / 12 / **226** / 4,938 |
| — spelled by more than one kind | 68 | **68** |
| a suggestion that marks nothing, over all terms | not measured | **0 of 5,151** |
| a suggestion that marks nothing, the check's probes | 0 of 73 | **0 of 73** |
| `the shelf parts as you type` | 231 spines, 189 forward, 42 ghosts | **unchanged** |

The four new book terms are the **sentinel covers** — `Undated`, `Unfiled`, `No one named`,
`Untagged`. `github#41` excluded a key beginning with `-` because `-undated` is not a word; the key
is no longer what is offered, and `Undated` is a cover you can read. Leaving them out would have
left four words showing hits beside *Nothing in this vault spells that*, which is the wart this
change exists to dissolve.

**And it does dissolve it.** Typing a body-only word used to read *1446 notes in N books* in
`#vs-hits` while the row a few centimetres away said *Nothing in this vault spells that* — two true
statements that read as a contradiction. The room now says `0 notes in 0 books` beside it, and the
new check asserts both halves together rather than either alone.

### What was left alone

`#vs-within` still matches titles only — the other half of `github#13`, out of scope by the issue's
own line. A **one-character query** still offers and still marks: `a` reaches 4,936 of 4,938 through
the Encyclopedia volume `A`, which is defensible, and suppressing single characters would break
`a vocabulary that is not Latin is still offered`, which types one character (`学`) on purpose.

## 2026-09-12 — A lifted spine is painted whole (github#51)

> "a book is cut off at the top when you hover it near the shelf header"

**The header was a red herring: it cut on every row, and hover was not the worst case.**
`.vs-track` has `contain: layout paint`, and the track has `0px` of box above a spine — all 34px
of its slack is below, for the board and the plaque. So all five lifts painted outside the box and
were sliced flat, two of them with nobody hovering.

**The fix is one property and it moves nothing.** `overflow-clip-margin: var(--spine-lift-max)`
next to the `contain` it belongs to. Not padding, so no golden, no board, no plaque and no control
moved; containment survives, so the scroll cost is unchanged.

A spine lifted 20px, and how far above its track it is actually **painted** (measured
headless on the one vault, differencing the same pixel band with the spine there and hidden):

| track | painted above | reading |
|---|---|---|
| `contain: layout paint` — as shipped | **0px** | the whole lift is cut |
| `+ overflow-clip-margin: 0px` | 0px | |
| `+ overflow-clip-margin: 7px` | **7px** | the fix |
| `+ overflow-clip-margin: 13px` | 13px | the edge follows the margin exactly |
| `+ overflow-clip-margin: 40px` | **20px** | **the lift, not the margin — still a clip** |
| `contain: layout` — paint dropped | 20px | clipping gone |

The cut per state, before and after:

| state | rung | cut before | cut after |
|---|---|---|---|
| a worn spine at rest, `[data-wear="2"]` | 1px | 1px | **0** |
| a worn spine at rest, `[data-wear="3"]` | 2px | 2px | **0** |
| a worn spine hovered | 5px (cyber 6px) | 5px / 6px | **0** |
| `:hover` / `:focus-visible` | 6px | 6px | **0** |
| a search match, query live | 7px | 7px | **0** |

What the two new checks print, with the fix and without it:

| | with | without |
|---|---|---|
| `a lifted spine is painted whole, in every look` | `leather 7px of 7px, modern 7px of 7px, cyber 7px of 7px`; a match `lifted 7px, painted 7px` ×3 | `0px of 0px` ×3; a match `lifted 7px, painted 0px` ×3 |
| `the room above a spine is the largest lift, in every look` | `room 7px for a tallest lift of 7px (match), containment on, 0px of box above a spine` ×3 | `room 0px … SHORT: leather by 7px, modern by 7px, cyber by 7px` |

And the numbers that had to **not** move:

| | before | after |
|---|---|---|
| `scripts/layout-snapshots/` goldens | — | **unchanged**, `the shelves are packed the way the golden snapshot says` green |
| `every control is the same size in every look` | ok | **ok** |
| `a look moves nothing on the page` | ok | **ok** |
| scroll, p50/p95/worst ms per frame — leather | 17.6/18.4/21 | 17.6/18.4/21 |
| — modern | 17.6/18.3/19 | 17.6/18.5/23 |
| — cyber | 17.6/18.4/18 | 17.5/18.3/19 |
| `contain` on `.vs-track` | `layout paint` | `layout paint` |
| checks in the suite | 99 | **101** |

**Why not the two options the issue costed.** `padding-top: 7px` works (cut 6px → 0px) and pushes
every shelf down 7px — ~105px of extra scroll over fifteen shelves — rewriting every golden.
Dropping `paint` also works, and its cost is **not measurable on this vault**: paint-dropped reads
`leather 17.6/18.4/22 · modern 17.6/18.4/20 · cyber 17.4/18.3/19`, indistinguishable from shipped,
because `.vs-shelf`'s `content-visibility: auto` is carrying `design/0014`'s win now rather than
the track's `paint`. Not measurable is not free, and the clip margin is free.

**`overflow-clip-margin` rejects every math function in this Chrome**, which is why the room is
the top rung by identity rather than `max()` over the rungs: `max(1px, 7px)`,
`calc(max(1px, 7px))` and a `var()` holding either all compute to **`0px`**, silently. Only an
`@property` registration makes one compute down, and that is document-global.

**Two forms of the pixel check were wrong in ways that passed**, and both are recorded in
`design/0021`: driving all five states with a real hover and real wear flaked outright (the same
build read `0/0/94/96` on one run and `104/104/101/176` on the next), and differencing against the
spine *put back down* read a clipped leather head as painted, because a 1px shift of that look's
steep gilt band moves those pixels more than any threshold either way.
## 2026-09-12 — Every harness is headless, and a changed shape stamps nothing (github#50)

> "a window comes to the foreground mid-run and keystrokes stop landing in Orca, so it is not
> possible to type while a suite is going"

**Placement was never the question.** `design/0006` already put harness windows on the leftmost
display, and the ticket's own reading is the finding: a window Chrome has just created
**activates itself**, and Windows permits it because the harness was spawned by whatever held
the foreground — the terminal. So a window placed politely off to one side still took the next
keystroke. Nothing here ever asked for the foreground: no `SetForegroundWindow`, no
`SetWindowPos`, no CDP `Page.bringToFront`. Up to three thefts per suite run, once more for each
of the four other harnesses.

**The risk was that headless would move the goldens, and it was measured rather than assumed.**
It did not move anything.

| | before (headed) | after (headless default) |
|---|---|---|
| full suite | 99/99, 39s wall | **99/99, 36s wall** |
| goldens at 1180px, all 3 looks | 6 shelves, 10 rows, 227 spines, 52 plaques, 1125px room | **identical** |
| *scrolling stays smooth* p95, leather/modern/cyber | 18.4 / 18.6 / 18.5 ms | **18.6 / 18.5 / 18.6 ms** (budget 34) |
| viewport for a requested 1600×1000 | inner 1584×961 | **1584×961** |
| scrollbar / `devicePixelRatio` | 15px / 1 | **15px / 1** |
| `screen.width×height` | 2560×1440 | 800×600 — and nothing in `src/` reads it |
| windows raised per suite run | up to **3**, plus 1 per other harness | **0** |
| suite stamp on a `--headed` run | written | **refused** |

**Headless turned out to be the reproducible mode, which was not the expectation.** The scroll
span of *scrolling the library stays smooth* was **1063px in five of five** headless runs. Headed
gave 1063px in the full suite and on `develop`, and **465px in three consecutive
`--only --headed` runs**, taking leather's p95 to **36.0** and **69.5 ms** against a 34 ms budget
in two of them. A headless window is exactly the size asked for; a headed one is subject to
whatever the desktop does to it. The 465px runs are not a regression this introduced — the same
combination is `--only` on `develop`, which measured 1063px earlier the same day — they are the
variance becoming visible.

**`--headed` was inert, which is worse than absent.** Parsed at `smoke.mjs:128`, it set a
`VS_HEADED` that nothing read and was never referenced again — a switch that reads as the control
for exactly this and did nothing, inviting the belief that the default was already headless.

**One place decides now.** `scripts/chrome.mjs` owns the shared flag list, `--headless=new`
unless `--headed`, and the `findChrome()` that **six files carried byte for byte**. Five
harnesses had their own copy of the 19-flag list, so wiring the mode into each would have been
five places to miss one. Two flags only `smoke.mjs` carried
(`--disable-client-side-phishing-detection`, `--disable-domain-reliability`) now reach the other
four; both suppress chatter. `record-demo.mjs` keeps its own launch (`design/0007`) and takes
only `findChrome()`.

| | before | after |
|---|---|---|
| copies of the Chrome flag list | 5 | **1** |
| copies of `findChrome()` | 6 | **1** |
| `net` lines in `scripts/` | — | 154 removed, 65 added |

**The stamp had to move in the same commit.** `recordPass()` stores the tree, the fixtures and
the check count and **nothing about how the measurement was taken**, so the moment `--headed`
became real, a headed run of a headless-default tree would have stamped it and both the pre-push
hook and `release.ps1` would have trusted it. `smoke.mjs` now declares the run **shape** —
`{ --only, --vault, --url, --look, --headed }` — with its defaults in one place, and any delta
sets `partial`, which already suppresses the stamp. That replaces five reasons enumerated by
hand. **Fail-closed rather than truthful**: a stamp naming its own mode only helps if every
consumer remembers to compare it. Deliberately not shape — `--jobs` (the quiet run beside a
recording is `--jobs 1`, a full suite that must still stamp), `--no-lock` (every gated push
passes it), `--port`, `--chrome`, `--shot`.

**The `screen-left` claim is untouched.** It serialises who owns the *display*; it has no opinion
about activation, and two harnesses politely taking turns still stole the focus once each.
## 2026-09-12 — Moving the marker moves the marker (github#46)

> "when clicking on a link in the left index it scrolls again from the top"

`goTo` rebuilt the whole contents list to carry `aria-current` from one row to another. Emptying
the `<ol>` collapses the left page's `scrollHeight` and clamps its `scrollTop` to **0**, and
`revealCurrent` — a nudge measured *from* `scrollTop` — then ran against that baseline, parking a
row already under the pointer at the bottom edge after an animation up from the top. Where the
index is short enough that the nudge has nothing to do, the clamp is the whole story and the list
is simply left at the top.

`renderContents` keeps the rebuild for the two paths whose contents really change; `markContents`
moves the mark between rows already standing there, and `goTo` calls that. `revealCurrent` is
**unchanged** — it was never wrong, it was being lied to.

A real mouse press on a row a full row-height clear of both edges, `scrollTop` read before the
press, between press and release, and after the page settled:

| | before | after |
|---|---|---|
| `people/-unfiled` (2,450 rows, index scrolls 61,975px), from 30,988 | **30,988 → 30,988 pressed → 0 released**, 19,489 at +500ms, still animating | **30,988 / 30,988 / 30,988** |
| rows surviving the turn, same book | **0 of 2,450** — every button replaced | **2,450 of 2,450**, not rebuilt |
| `weeks/2026-W29` (55 rows, scrolls 753px), from 377 | **377 → 0**, and 0 at +500ms — the report verbatim | **377 / 377 / 377** |
| the row the press actually marked | row 1,029 pressed → row **1,060** marked on part-visible rows: the focus nudge moved the list between press and release | the row pressed, every time |
| mark and reader after the press | correct note, wrong scroll | `0 → 1,223`, reader note 1,223 |
| focus after a turn | `BODY` — the focused row was destroyed under the press | stays on the row pressed |
| `github#11`'s reveal check | ok | **ok**, unchanged: a tab jump still reveals a row that is genuinely out of view |
| checks | 100 | **101** |

**The measurement that nearly went the other way.** `element.click()` does not reproduce this at
all: the clamp needs a layout taken while the list is empty, and what forces one under a real
mouse is the focus change when `clear()` removes the row the press had focused. The first version
of this check clicked in script, measured **30,988 → 30,988**, and **passed — green, over a live
bug** in the exact shape the report describes. The zero is also visible only *between* press and
release. `design/0026` carries both traps.

Not touched: `revealCurrent` itself, *find within this book*'s rebuild (its contents do change, and
the top is a filtered list's natural start), and `github#40`, which will touch the same reveal path.
## 2026-09-12 — The Reading shelf lays its books in a row (github#48)

> "with two ribbons in the library, the second book on the Reading shelf is drawn below the
> first, under the shelf board"

**A missing element, and two things the packer was paying for and not getting.** `renderTrack`
builds `.vs-track > .vs-group > .vs-books` and `page.css:555` gives `display: flex` to
`.vs-group .vs-books` — a line *inside a group*, not the class. `renderReadingShelf` appended its
line straight into the track, so the rule never matched, the line was `display: block`, and the
spines stacked. The board is a background on the track at `background-position: 0 var(--spine-h)`,
so the second book was not on a second row: it was **under the floor**. The fix is the group, and
no CSS moved — which is what makes all three looks inherit it (`design/0021` rule 2 never comes
into play).

| | before | after |
|---|---|---|
| `.vs-books` parent on `-reading` | `.vs-track` | **`.vs-group`**, as on every other shelf |
| its computed `display` | `block` | **`flex`** |
| its height, two ribbons | **264px** (two spines) | **132px** (one) |
| its height, three ribbons | **396px** | **132px** |
| two spines' boxes | `675,163` and `675,295` | `675,163` and **`718,163`** |
| drawn bands for 1 track | **2** | **1** |
| CSS rules changed | — | **0** |

**Asserting that a row breaks because the next book did not fit** is what found the other two.
Both are the same defect — the packer charging for width the paint does not use — and both were
measured with **32 ribbons, 7 of them from the one index shelf**, in a 1,180px room:

| | before | after |
|---|---|---|
| `rowsOf`'s plate charge on a shelf that draws none | `plaqueWidth("2010-2019")` = **86.4px** per run | **0** — it takes `plaques`, and both callers say which |
| a squeezed Encyclopedia spine's charged width | `widthOf(book, null)` — **unsqueezed** | `widthOf(book, shelf ‖ shelfById(book.shelfId))` — as drawn |
| books on the first row | **26** | **28** |
| first row used | **1,104px** of 1,180 | **1,167px** |
| room left over / next book's width | **73px** left, **32px** book — it fitted | **13px** left, **42px** book — it does not |
| tracks for 32 ribbons | 2 | 2 |

`squeezeIndex` narrows the Encyclopedia's spines to fit its own rail and leaves the scale in
`indexScale`; `renderReadingShelf` draws each book through its **own** shelf, so those books drew
narrow while `rowsOf`, handed the row's shelf (`null` there), charged them wide.

**Why the suite was green.** Every check that put a book on the Reading shelf put exactly one, and
one spine in a block container and one in a flex row are the same picture. The new check,
`"the Reading shelf lays its books in a row, and draws as many rows as it packed"`, asserts the
**y of every spine** instead of its presence, at two, three and a wrapping count. It writes marks
straight into `settings.reading` rather than driving the reader once per book — `readingBooks()`
resolves them through `core.resolveReading` exactly as a click on the stub would — and puts back
what it found. **It fails on `develop` and passes here**, which is the point of it.

| | |
|---|---|
| suite | **100 checks** (99 + this one), 1 fixture |
| `check-comments` | 1500 / baseline 1500 — the reasoning is here, the code carries pointers |
| layout goldens | **unchanged** — a library with no ribbons has no Reading shelf to draw |
| `.vs-group`/`.vs-books`/`.vs-plaque` CSS | **untouched** |

One consequence worth naming: `page.css:1663` gives `[data-list="1"] .vs-group .vs-books` a
`display: block`, which could never reach the Reading shelf before. Its line was `block` in list
mode by accident; it is now `block` on purpose, and the picture is the same.

## 2026-09-12 — The shelved look is called Cyber (github#56)

> "disable cyberpunk for now, call it cyber aswell"

**One string, and the measurement is that nothing else moved.** `core.LOOKS` carried
`name: "Cyberpunk"` against `value: "cyber"` since `design/0017`; the name now matches the value.

The issue asked for a migration assertion as well, and measuring first is what showed there was
nothing to add. Three of its claims were wrong on `develop` `6c99c60`:

| the issue said | measured |
|---|---|
| nothing asserts a settings file naming `cyber` resolves | `smoke.mjs:798` already requires `shelvedLook === "leather"`, printed at `:808`, and `invariants.md` already documented it |
| …resolves to **cyber** rather than falling back | it resolves to **leather**, deliberately — `isOffered("cyber")` is `false` for a shelved look (`defaults.ts:271-273`) |
| the look check's output carries the name | it carries the **value** — `shelved: cyber` — so its output is byte-identical after the rename |

| | before | after |
|---|---|---|
| `core.LOOKS` entry | `{ value: "cyber", name: "Cyberpunk", shelved: true }` | `{ value: "cyber", name: "Cyber", shelved: true }` |
| hosts that can render that name | **0** — `offeredLooks()` filters shelved, and `fillLooks()` builds the selector from it | **0**, unchanged |
| the look check's report | `offers 2 of 3 looks (leather, default; shelved: cyber)` | **identical** |
| the migration check | `{ schema: 8, look: "cyber" } → "leather"` | **identical**, prose only |
| assertions added | — | **0**, and that is the finding |
| `check-comments` total | 1500 / baseline 1500 | **1500**, by swapping the word without rewrapping |
| book addresses, counts, spine geometry | — | untouched; no look was repainted |

`design/0017` is now `0017-the-cyber-look.md`, keeping its number — `code-map.mjs` scans the
directory, so `code-index.md` followed on its own. The genre keeps its own word inside the record
(*"Cyberpunk as a library, not as a poster"* is what the look was briefed as, not what it is
called), and both quoted asks stay verbatim. `docs/demo/index.html` still carries the old name at
`:4190`: it is a committed export refreshed when the demo goes stale (`decisions/0009`), and its
`--end` defaults to today, so rebuilding it for an unrenderable label would be ~1.4 MB of churn.
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
## 2026-09-12 — The turn footer is furniture, not desk (github#54)

Reported minutes after `github#36` reached `develop`: clicking **Previous** or **Next** closed
the book instead of turning the page. `design/0004`'s desk rule was an allow-list — *not*
`.vs-spread`, `#vs-marks`, `.vs-readerbar` or `#vs-dye` — and `github#36` put
`<footer class="vs-turn">` inside `#vs-reader` and outside `.vs-spread` without joining it. Both
ends of the click therefore landed off the book: the button's handler turned the page and the desk
handler immediately threw the turn away.

**Why the suite was green at 99/99 is sharper than "the checks press arrow keys".** They do call
`document.getElementById("vs-nextnote").click()` — but `.click()` dispatches no `mousedown`, so
`pressedOffBook` is never armed and the desk handler declines. A control exercised only by
`.click()` is not exercised. Both new checks press `mousedown` + `mouseup` + `click`, the way the
desk check already did, and both were watched failing against the old code before the fix went in.

| | before | after |
|---|---|---|
| `#vs-nextnote` pressed | **closes the book** | still open, index **+1** |
| `#vs-prevnote` pressed, from index 1 | **closes the book** | still open, index **−1** |
| `#vs-place` pressed | **closes the book** | still open, index **0** |
| `.vs-turn`'s own background pressed | **closes the book** | still open, index **0** |
| across leather, modern and cyber | **12 of 12 put the book down** | **12 of 12** leave it open |
| children of `#vs-reader` that held the book open | **3 of 4** (`.vs-turn` dropped it) | **4 of 4** |
| the desk beside the cover | closes it | **closes it**, unchanged |
| a selection dragged past the cover | does not close it | **does not**, unchanged |
| `offBook` | an allow-list of 4 selectors | `target === $("reader")` |
| checks in the suite | 99 | **101** |
| `check-comments` baseline | 1500 | **1496** |

**Inverted rather than enumerated.** The one-line fix — add `.vs-turn` to the list — was rejected
because this was already the second piece of furniture to ship without joining it. `#vs-reader`
has exactly four element children, and all four are the book, so the predicate is now the desk
test: `target === $("reader")`. New furniture is inside the book by default. The two forms are
observationally identical today; they differ on what happens next time.

That identity rests on a measured fact rather than an argument: the spread is inset by 96px
(`github#0`), so `elementFromPoint` in the gutter beside the cover returns `#vs-reader` itself —
**730px** of gutter at the suite's window — and the guard check asserts it every run.

`#vs-dye` left the predicate with it. It is a **sibling** of `#vs-reader` (`page.html:179`), so
its clicks never reached this handler; it was a dead entry that read as a live one.

The second check, *nothing in the reader but the desk puts the book down*, is the part that closes
the class rather than the instance: for every visible direct child of `#vs-reader` it finds a point
that is not a control, presses it, and asserts the book stays open — then presses the desk and
asserts it still closes, so it cannot pass a reader that has stopped closing at all. Controls are
skipped on purpose: `#vs-back` lives in `.vs-readerbar` and closes the book by its own contract.
An `offBook()`-over-the-children assertion was rejected for being near-tautological under the
inverted predicate — it would restate the implementation instead of exercising the click path the
bug actually lived on.
## 2026-09-12 — The swatch check flaked 3 runs in 4, and the one that passed stamped the tree (github#55)

Two faults, one symptom. `"a hovered swatch paints the room, and leaving puts it back"` failed
**three full runs in four** on `develop` at `6c99c60` and passed **five of five** with `--only`,
always on the same two flags — `arrowPainted` and `focused`, the keyboard half — while the pointer
half passed in the same run.

**Measured rather than reasoned, and two standing theories died first.** The issue put the cause in
state shared within a lane. The check is 6th of 12 in the serial lane, so its five serial
predecessors were run in order with it in one Chrome: **6/6 green, six consecutive times**. The
earlier pairing experiments had used *parallel-lane* checks, which land in a different browser
altogether, so those three samples measured nothing — which is why they looked random. The check
was then instrumented to record its own surroundings and the second full run went red with the
answer in one line.

| the red run said | |
|---|---|
| `hasFocus` | **false** — the window had lost the foreground |
| `activeElement` after two arrows | **`BUTTON.vs-swatch`** — focus *did* move |
| `focus` events fired | **0**, not once |
| `menu.hidden` / reader open | false / false — nothing else was wrong |

**A Chrome window without the OS foreground still moves `document.activeElement`, but delivers no
`focus` event.** The preview hangs off `on(btn, "focus", show)`; `mouseenter` is dispatched straight
at the element and needs no document focus. A full run opens three Chromes and Windows decides
which ends up in front; `--only` opens one into a quiet desktop and it keeps it.

| | before | after |
|---|---|---|
| the suite tells the page it is focused | no — every focus-driven check rode on what the desktop happened to do | `Emulation.setFocusEmulationEnabled` on every page `runOne` drives |
| the keyboard half is driven by | a synthetic `KeyboardEvent` at the menu, and `element.focus()` | real `ArrowRight` and `Tab` over `Input.dispatchKeyEvent` (`press()`) |
| flags the check asserts | 29 | **32** — `tabbed`, `tabbedOn`, `windowFocused` added; none removed, none relaxed |
| `"a hovered swatch…"` in a full run | **2 green in 6** — FAIL, pass, FAIL, FAIL (github#55) · pass, FAIL (here) | **11 green in 11**, 99/99 every time |
| `smoke.mjs` calls to `.focus()` exposed to the desktop | 8 | **0** |
| `suite-stamp --selftest` | 17 cases | **30 cases**, 13 of them the streak law |
| a stamp is worth | **1** green run | **2 consecutive** (`GREENS_REQUIRED`), and a red full run deletes it |
| `suite-stamp check develop` on tree `f9ac717` | **exit 0** — "passed the invariant suite" | **exit 1** — "has 0 green run(s) of the 2 in a row a stamp needs" |
| the first push on a fresh tree | one suite run | **two**, about 45 s more; every later push unchanged |

**The verification is a run count, because a single green proves nothing — that was the defect.**

| full runs of `smoke.mjs` | `"a hovered swatch…"` |
|---|---|
| before, github#55 on `6c99c60` | FAIL · pass · FAIL · FAIL |
| before, reproducing here on the same tree | pass · **FAIL** (instrumented; this is the run that gave the answer) |
| after the fix, 8 consecutive | ok × 8, 99/99 each |
| after the review passes, 3 more | ok × 3, 99/99 each, 35-36 s wall |

At the measured baseline rate, eleven consecutive greens by luck is about 1 in 7,000.

**Negative control**, because a check that cannot fail is not a check: with
`on(o.btn, "focus", o.show)` removed from `src/page.js`, the rewritten check goes red on
`focused, arrowPainted, tabbedOn` and stays green on `arrowLanded, arrowMoved, tabbed` — focus
still moves, nothing paints. Restored before anything was committed.

**The stamp is the other half of the issue and the more general one.** One green run stamped a tree
that was red three times in four, so a push would have skipped the suite on the strength of the run
that happened to pass. An intermittent check does not merely cost a re-run: **it launders itself
into a stamp**, and the stamp then suppresses the only thing that would have caught it. Quarantining
a check that has flaked was rejected — it needs a register kept by hand and is blind to the flake
nobody has spotted, which is exactly this case. Stamps written under the old law carry no `greens`
field, read as 0, and are demoted rather than grandfathered. `decisions/0010` amended,
`decisions/0015` new.

## 2026-09-12 — The docs site was built by Jekyll for the first time (github#22)

> github#22: "the docs site is the one thing in this repo **nobody has rendered properly**"

`github#1` shipped the Pages theme and closed without a review page, and it had rendered the
site by hand: no Ruby on the machine, so the theme's `_sass` was compiled with dart-sass and the
markdown put through `marked` into a copy of the layout with the Liquid resolved by eye. This
entry is that build done for real — Ruby 3.2.11 and the **`github-pages` gem set (232)**, which
is by construction the version set Pages runs: `jekyll 3.10.0`, `jekyll-theme-midnight 0.2.0`,
`kramdown 2.4.0`, `jekyll-sass-converter 1.5.2`. Nothing in `docs/` changed; only what is known
about it did.

**The approximation held.** Every figure `github#1` recorded, re-measured on the real build:

| | github#1 claimed | measured on the Jekyll build |
|---|---|---|
| body text `--text-2` `#c3c2b7` | 9.72:1 | **9.72:1** |
| `--text-3` `#8d8c84` | 5.16:1 | **5.16:1** |
| links `--accent` `#3987e5` | 4.79:1 | **4.79:1** |
| theme fonts fetched | 8 → 0 | **3 → 0** (32 files shipped) |
| theme images fetched | 2 → 0 | **2 → 0** (3 shipped) |

The two figures that were quoted from the sister project rather than taken here are now taken
here, and three the sheet never had: link `:hover` `--accent-hi` `#6aa6f0` **6.91:1**, inline
code on `--surface-2` **15.73:1**, the header control **8.78:1**. The served stylesheet declares
**149 rules and the browser keeps 149** — none dropped — of which **23** resolve one of our
tokens. The "→ 0" half of the old entry is the part that matters and it is exactly right, on a
measurement it never had: the **same site built twice**, once with the sheet and once with
`style.scss` cut back to the bare `@import`. Stock midnight fetches **3 font files and 2
images**; with the sheet, **0 and 0**, and the page drops from **10 requests to 5**. The images
match the old entry exactly; its **8** fonts do not, and that is because the figure was the
sister project's, taken on the sister project's pages — how many faces a page pulls depends on
what its prose sets in bold and italic. The theme *ships* 32 font files and 3 images either way.

**"Vault Graph's sheet, rule for rule" is exact, and now has a number.** Strip the comments from
both files and they are the same **2,673 bytes**, byte for byte. The whole textual difference
between them is the two issue pointers in the comments (3 insertions, 2 deletions) and a
byte-order mark this repo's copy does not carry. `docs/_includes/head-custom.html` differs only
in its comment likewise.

**And the tokens really are `page.css`'s.** Nine of nine colour tokens match the
`[data-theme="dark"]` block value for value, zero differ. The sheet adds **three** of its own,
where its comment claims one: `--accent-hi` (declared), plus `--font` and `--mono`, which are
font stacks and exist nowhere in `page.css` as tokens — and `--mono` here carries `Consolas`,
which the product's own code stack does not.

**The 480px breakpoint, which `github#1` recorded as unexercised, works.** Shot at 480 and at
375: the title block stacks, the credits centre, the column reflows, nothing overflows
sideways. The header's only control disappears under 480px — that is the theme's own
`nav { display: none }`, untouched by our sheet, and the in-page nav row carries the same four
links anyway.

**What the pictures changed.** The landing page's hero is **broken**:
`index.md` fetches `assets/demo.webp` from `raw.githubusercontent.com/luke321/vault-shelf/main`,
the file is on `main`, and raw refuses it **404** unauthenticated because the repository is
private. It would begin working on the day the repo is made public, which is the same day Pages
can be switched on — so it is a defect that cannot be seen and cannot be fixed separately from
the decision above it. Nothing else was wrong to look at.

**Two third-party requests leave the published page**, and no gate covers them:
`code.jquery.com/jquery-1.12.4.min.js` on every page, which is the midnight theme's own, and the
`raw.githubusercontent.com` hero on the index. `check-network.mjs` scans `src/` and the built
page, not `docs/`, so the law that nothing shipped reaches the network has never applied here.

**Still not live.** `has_pages: false`, `private: true`, read from the API — not POSTed to.
Enabling Pages needs the repository public (`decisions/0009`), which is the owner's call.

**What this build still is not.** It is Pages' *software*, not Pages: the site was built from a
copy of `docs/` with a `Gemfile` beside it, `PAGES_REPO_NWO` supplied by hand, and no API token,
so `jekyll-github-metadata` filled what it could and left the rest — the stylesheet is linked as
`style.css?v=` where Pages appends a build SHA, and the title block's repository fields come from
the config rather than the API. It was served over `http://127.0.0.1` rather than
`luke321.github.io`, so nothing here exercises a `baseurl`, a custom domain, or Pages' own
caching; `file://` is not a substitute either — root-absolute asset paths mean the sheet does not
load at all that way, which is worth knowing before the next person tries it. What remains
genuinely unverified is the hosting, not the rendering.
## 2026-09-12 — The search box knows what the vault spells (github#41)

> "could we implement a search with auto complete suggestions?"

The box took any string while every classifier behind it had already collected every person, tag,
folder and book key. Type `gardne` and the room said *0 notes in 0 books* — the same thing it says
for a vault with no gardening in it.

The issue would not close without a decision it called the law's: **what does picking a suggestion
do?** Answered by Lukas at the gate — it **completes the text**, not navigates and not narrows, so
`design/0008` is untouched: the query still marks, every book stays on the shelf and `#vs-hits`
still counts. One flat string, no `tag:` grammar. `#vs-within` deliberately left alone, because
`github#13` says the two boxes do not yet agree what a match *is*.

| | before | after |
|---|---|---|
| what the box knows about the vault | nothing | **5,147 terms** |
| — people / tags / folders / books / titles | — | 25 / 43 / 12 / **222** / 4,938 |
| — spelled by more than one kind | — | **68** |
| a suggestion that marks nothing when picked | — | **0 of 77** |
| — before a book was offered by key rather than label | — | ~~29 of 77~~ |
| typing `gardne` | `0 notes in 0 books`, and no reason why | *Nothing in this vault spells that.* |
| typing `gard` | — | `garden` **tag · book** 808 · `garden/seeds` 404 · `garden/soil` 337 |
| typing `学` | — | `学び` **tag · book** 135 |
| sustained keystroke, marking only | **15.1 ms** | 15.1 ms |
| sustained keystroke, marking and offering | — | **17.4 ms** |
| `core.suggest` over all 5,147 terms | — | **0.1–0.2 ms** |
| the golden packing | 1 snapshot | **unchanged** — the list moves no furniture |
| `every control the keyboard can reach has a name` | green | **green** — rows are `role="option"`, not controls |

**The honesty check earned its place immediately.** It failed on its first run at 29 of 77, and
every failure was a book: `Aug 2026`, `No one named`, `#работа`. `labelFor()` builds a string for
*reading* and `matchesQuery` reads the note's title, path, tags, people and body, which carry the
**key** — so the box was offering dead ends, which is the precise bug it was built to remove. A
book contributes `book.key` now, verified against its own notes at build time, so the invariant
holds by construction. A tag book therefore spells `garden` rather than `#garden` and merges with
the tag the notes already gave, which is where 68 multi-kind terms come from.

**Two of the three first-run failures were the checks misreading themselves** — one read
`list.hidden` *after* closing the list, the other probed the first character of `#работа`, which is
a hash. Worth recording: a check that fails for its own reasons looks exactly like a product bug.

**A pooled set of row elements was tried and reverted.** Measured against its own baseline in the
same run it bought nothing (+7.1 ms before, +7.4 ms after), and the listener churn it would have
saved had already gone when the rows moved to one delegated reader. Kept instead: placing the list
**once per opening** rather than once per keystroke, because reading the box's rectangle forces a
reflow of a room whose 691 spines `applyQuery` has just dirtied.


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

**Built for real later**, in `github#22` (2026-09-12, top of this file): the
Jekyll build below was never run at the time, and when it was run every figure in this
paragraph held.

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

## 2026-09-12 — reading off the bottom of a page turns it (`github#40`, `design/0028`)

Both halves of the spread are `overflow-y: auto`, so reaching the bottom of a note stopped dead:
nothing said the page had ended or that there was a next one, and the only ways on were the arrow
keys and the footer buttons. Keeping the wheel going now meets **resistance** — a rubber band and a
filling strip — and past a threshold the page **turns**, arriving at the top of the next note, or
at the bottom of the previous one going back.

| | before | after |
|---|---|---|
| ways to turn a page | 2 (arrow keys, footer buttons) | **3** |
| notes the gesture exists on | — | **all of them** (85% never overflow) |
| `goTo` scroll arrival | none — wherever the browser left the box | **top forward, bottom back** |
| every other way to a note | wherever the browser left the box | **scrollTop 0** |
| push to turn | — | **240px** (2 notches never, 3 always) |
| band, mid-book / at the ends | — | **26px / 9px** |
| latch clears after | — | **140ms** of silence |
| a push is held for | — | **600ms** |
| one 40-notch flick turns | — | **1 page** |
| a slow 229ms spin, 12 notches | — | **3 pages** (was 0, ever) |
| p95 frame while pushing, leather/modern/cyber | — | **18.9 / 18.2 / 18.3ms** (budget 34) |
| one whole turn, timed | — | **2–3ms** in every look |
| same-size controls measured | 40 | **40** — this draws nothing |
| look files changed | — | **none** |

**The trap the issue listed fifth was the dominant case.** Probed before any code was written — 40
books sampled every 17th, 186 notes opened — **only 27 of 186 notes overflow their page at all**,
the median slack is **0px**, p90 **75px**. A gesture that needs real overscroll would not exist for
85% of the library, and a reader cannot tell why it works on one note and not the next. So a page
that cannot scroll counts as already at its limit, and the push starts on the first notch.

**One flick, one page — and the first version got it wrong in a way synthetic events could not
see.** The latch was released as soon as the *arriving* page was not at its own limit, which is the
ordinary case when you turn onto a long note: a real wheel would scroll that note to its bottom and
turn again. Synthetic `WheelEvent`s do not scroll natively, so every early check passed. The fix is
that **every notch re-arms the quiet timer**, absorbed or not, so one latch spans one whole flick
however long its tail runs; the check now drives the arriving page to its own bottom between all 40
notches and asserts exactly one turn.

**The gesture had a speed floor, and only real wheel input showed it.** The spent latch and the
push accumulator were one timer, so notches further apart than **140ms** reset the accumulation and
it never reached the threshold: driven with real CDP wheel input, a slow deliberate spin of 12
notches **229ms apart turned 0 pages, ever**, while every flick turned exactly 1. Synthetic
`WheelEvent`s dispatched in a loop cannot show this — their spacing is the harness's, not a hand's.
The two are different questions, so they are two numbers now (**D-5**, asked rather than decided):
the latch only has to outlast a flick's momentum tail (140ms), while a push a person is making
slowly is still one push (600ms). The same slow spin now turns **3** pages and every flick still
turns exactly **1**.

**The settle diagnostic caught the second defect.** `atRest()` learned `pushing` and `settling`
from `__vs.overscroll()`, and immediately failed two of the new checks with `an overscroll band
still springing back`: a **turn** was starting a spring-back, and the settle timer handle survived
`closeReader`. A turn now snaps — the band belongs to the page being left — and `releasePush`
clears any pending spring before deciding whether to start one. `decisions/0013` working exactly as
intended, on the run that introduced the thing it caught.

**The smoothness number was two costs added together.** The first version of `a wheel on the spread
stays smooth in every look` read leather p95 **53.9ms** with a 264ms worst against modern's 18.4,
because a single page turn — a full `renderContents`/`renderMarks`/`renderTabs`/`renderNote` —
landed inside the sampled frames. Measured where the push cannot turn (the last note, pushing
down), leather reads **18.9ms** against the library scroll's own 18.5ms on the same machine, and
the turn is a separate **2–3ms**. leather's remaining 268ms worst frame is the first look measured
paying for its stylesheet's first application — the existing library check reports 158ms there for
the same reason, and p95 is the assertion in both.

**And one found by a blank screenshot.** The per-look stills of the strip came back empty: each
one opened a note while the right page was still scrolled from the previous shot, so the push was
never at its limit and painted nothing. The harness was right and the page was wrong — `goTo` reset
no offset for *any* of its six callers, nor did `openBook`, which is the rest of what the issue
meant by *"a turn today does not even reliably start you at the top of the note you turned to"*.
`"top"` is the default now, and `Next`, `Previous`, the arrow key, a contents row and `openBook` all
arrive at **scrollTop 0** from a note scrolled to its bottom.

**Two defects found by reading the diff rather than by a check.** `reader.land` was set and never
consumed, so a `refresh()` after a back-turn would have re-applied the landing and jumped the page
to its bottom; and `ctrl`/`cmd` + wheel — a zoom gesture that belongs to the host — was being
absorbed into the push.

**The strip came out after the review, at Lukas's word.** He used the build and said *"remove the
bar and shadow animation that the text moves is indicator enough"*, so the fill bar, the ground
under it and the words `The book ends here` all went (**D-6**). That removes a whole class of
question rather than just some CSS: with nothing drawn there is no absolutely-positioned decoration
to keep out of the layout, nothing to add to the same-size list, and no per-look paint to verify.
The same-size check went back from **42** controls to **40** and the look-walker from **4,229**
elements to **4,226**.

It was put to him first that an end-of-book push then looks like a mid-book push that is not
working — the reading `github#40` explicitly warns against — and he chose it anyway, so the refusal
is carried by the shorter **9px** band plus a disabled `Next` rather than by a sentence. The first
version is in `design/0026`'s history if it ever reads as broken.

**One consequence had to be taken rather than asked.** The band was suppressed under
`prefers-reduced-motion` because the strip carried the threshold alone; with the strip gone that
left **no indicator at all**, which fails the issue's own *"can still exist and still be legible"*.
Reduced motion now keeps the **offset** and drops only the **spring** — the band tracks the wheel
directly with no transition, which is direct manipulation rather than animation, on the same
reasoning `design/0024` used for the edge scroll being the gesture's reach rather than decoration.

Comment budget unchanged at **1500/1500**: the blocks written for this landed 15 lines over, and
the reasoning moved to `design/0026` rather than the baseline moving.


## 2026-09-13 ? Contents order and book creation pickers

Previously only Encyclopedia had an alphabetical index; book creation offered name/source.
Now Encyclopedia and Tags default to A?Z, other shelves to dates. A switch below the reader's
search tab changes contents and tabs together. Shelf, plaque and book menus expose the saved
default, as do shelf and book creation/editing. New books offer 14 colours and 5 bindings.

Measured on 4,938 notes: Tags' mode changes A?Z ? date while retaining the selected note;
chronological contents, migration, a subsequent spine click, shelf defaults for future books,
and builder edits all pass. Cancel leaves settings byte-identical; make/edit/migrate/delete
preserve or remove colour, binding and contents mode correctly. Existing index, navigation,
contents scrolling, builder and made-book checks pass in visible Chrome on the left display.
Desktop screenshots inspected: `dist/index-switch-vault-reader.png` and
`dist/book-creation-vault.png`. At 390px, the creation form measures 343px wide with zero
horizontal overflow; all five samples and the save controls remain reachable. Plaque menu
defaults and new shelf defaults pass too. Build, strict typecheck, lint, static gates,
generator/build determinism and refresh wiring pass. PII checked patterns only (no name list).
Full suite has not been run for this feature.


## 2026-09-13 - Picker, reader and Manage refinements

Fourteen swatches now occupy two rows of seven. Minimal follows Original, with plain leather,
no bands/frame, a straight ribbon and 131px height. All six bindings are offered in creation
and context pickers and automatic selection. A-Z/Date buttons replace the contents dropdown.

The reader sits below the original library rail. Search stays left, title centred, and query
visible; the oldest/newest button is removed while existing settings still load. The index
measures 56px in both modes, with a scrolling overflow and 72px page clearance. Ribbon cuts
match all six bindings, and after changing sort a ribbon still opens its marked note.

Manage now says Fourteen colours. Date colour rules occupy a separate row and fit a 160px
select; choosing one disables colour variation. Pick shelves have no variation toggle in
Manage or creation/editing and ignore legacy variation flags.

Measured in visible Chrome: centred title within 2px, identical rail rectangles before/after
opening a book, query retained and clickable, fixed index and spine widths, two swatch rows,
six matching ribbon cuts and correct ribbon target after switching. Manage controls fit at
desktop and 390px. The narrow creation sheet is 343px wide with zero horizontal overflow.
Cross-look checks report zero movement or resizing across 4,230 elements and 39 controls.
Golden updated for automatic binding heights: still 6 shelves, 10 rows, 227 spines, 52 plaques.
Targeted creation, persistence, date colours, drag, overlay and layout checks pass. Resize
cleanup waits were added to two tests whose assertions passed before their pending resize
had settled. Build/lint/static gates pass. Full suite not run for this change.

Screenshots inspected: `dist/reader-refinement-vault.png`,
`dist/reader-refinement-vault-reader.png`, `dist/book-creation-narrow-bottom.png` and
`dist/leather-spine-picker.png`.

## 2026-09-12 — why this book is lit (`github#13`, `design/0027`)

The shelf said *which* books matched and the reader said nothing. A book drawn forward on a tag
opened on an unmarked index, and retyping the same needle into *Find within this book* — which
tested **titles only** while the library tested title, path, tags, people and body — printed
*"Nothing in this book matches."* under a spine that was drawn as a match.

**The book no longer denies the shelf.** *Find within this book* narrows by `core.matchesQuery`,
the same function `applyQuery` calls. On `Encyclopedia I` with `garden` live — 36 notes, 6
matching, every one of them on a tag:

| | before | after |
|---|---|---|
| rows on open | 36, **0 marked** | 36, **6 marked** |
| the head reads | `36 notes · 8 source folders` | `… · 6 of 36 match “garden”` |
| typing `garden` in the find box | **0 rows**, *"Nothing in this book matches."* | **6 rows**, no such sentence |
| the matched note's details | `#garden/seeds`, unmarked | `#garden/seeds` with `garden` on a ground |

Across the vault: `project/website-migration` drew **475** books forward and **40 of 40** opened
found it again in their own box. On `favourites/years/2026`, **304 of 1,755** rows marked against
**304** matching notes with all **1,755** still in the index; the box cleared leaves **0** marked
and **1,755** rows.

**The cost of one rule, stated.** With body matching still in the scope rule, the find box returns
many more rows than it used to: `garden` on `favourites/years/2026` goes **10 → 497**. `github#58`
does not remove that — those are tag matches and it keeps tags. The judgement is that a narrow
reader rule compensating for a broad library rule is the wrong layer; the breadth is `github#58`'s
ticket, and a second rule in here only hides it while making the book lie.

**`matchReasons` mirrors `matchesQuery` rather than replacing it.** The boolean stays a fast early
return — it runs over every note of every book on every keystroke, millions of calls on this vault
— and a check holds the two in step instead of a refactor making it structural: **4,938 notes × 5
needles, 1,700 marked, 1,700 with a reason, 0 disagreements** over `tag` 876, `person` 620,
`folder` 192, `title` 43, `body` 11.

**A third rebuild path, and the guard that keeps it from being a fourth.** The library's search
box stays in the tab order behind the open reader, so the query really can move under an open
book. `renderReader` records the needle it drew against; `applyQuery` re-renders only when it
differs. Every other caller — a ribbon toggled, a dye picked, a shelf moved — leaves the index
standing, so `design/0026`'s un-rebuilt list still measures **2,450 of 2,450 rows the same nodes**.

**Found only by looking.** The first pass tinted a marked row at **8%** of the accent, which on
leather's paper is invisible. The check read `data-match` and passed; the screenshot showed an
unmarked index. It ships at **15%** with the title in the accent at 600, above `aria-current` so
the row being read keeps its own mark, and the needle inside a detail on a **34%** ground. Fourth
entry in this file whose cause was a picture.

Checks **114 → 117**. Comment budget unchanged at **1490/1490** — every new comment is
pointer-shaped and the reasoning is here and in `design/0027`. `--shot-query <needle>` is new:
the search live in both pictures, and the reader opened on a book the query actually lit.

**What the extra work costs, measured on the biggest index** (`people/-unfiled`, 2,450 notes).
`renderContents` now asks `core.matchesQuery` once more per row to decide the mark, and the find
box asks it instead of comparing titles:

| opening it | before | after |
|---|---|---|
| with no query live | 68 ms | 72 ms |
| with a query live | 87 ms | **99 ms** |
| typing in the find box | 5 ms | **10 ms** |

Twelve milliseconds on the largest book in the library, and only while a search is live. The
boolean is the reason it is that cheap: `matchReasons` builds an array and is called once per
*open note*, never per row.

**A fold that changes length is not marked.** `litText` locates the needle in `text.toLowerCase()`
and slices the original, so a case fold that changes the string's length (Turkish `İ`, and the
vault deliberately carries four scripts) would map the offsets onto the wrong characters and
mangle a title. Lengths are compared first and the text is left unmarked when they differ —
nothing is claimed rather than something being drawn wrong.

**Opening forty books wears forty books.** The find-box check drives 40 real `openBook` calls, and
wear is counted per address and persisted. It snapshots `settings.wear` and puts it back, so the
check leaves the library exactly as it found it.

## 2026-09-12 — the two searches meet (`github#13` + `github#58`, `design/0008`, `design/0027`)

Two branches, each green on its own gates, merged into one. `git merge` reported conflicts in
three documents and **none in the code** — and the code is where the damage was.

`github#58` had narrowed what the search reads to a note's title, its declared metadata, and the
**cover of any book it stands behind**; because a cover is not a property of a note, it threaded a
`SearchIndex` through `matchesQuery` and `markMatches`. `github#13`, opened against the older
rule, added `core.matchReasons` to say *why* a note was marked, a find box that narrows by the
same function the library searches with, and five new call sites. Textually the two fit together.
Semantically the merge produced a library that would have:

| | the merged text would say | what is true after `github#58` |
|---|---|---|
| a note whose only hit is in its prose | reason: `body`, *matches in the text* | **not marked at all** |
| a note whose only hit is in its path | reason: `path`, *matches in the path* | **not marked at all** |
| a note marked through a spine | **no reason at all**, silently | marked, and the one reason worth saying |
| that note's own find box, same needle | *"Nothing in this book matches."* | the needle that lit it |

So `matchReasons` was rewritten to mirror the rule as it now is — `title`, `tag`, `person`,
`folder`, `cover`, with `body` and `path` deleted from `MatchReason.field` so the compiler refuses
the old vocabulary — and all **five** reader-side calls were handed the same index the library
builds once in `rebuild()`. `SearchIndex` went from `Map<string, string>` to
`Map<string, SearchEntry>`: `text` is still the one folded haystack the boolean reads with a
single `indexOf`, and `covers` keeps the spines **unfolded** beside it, because `aug 2026` is not
what is printed on the book. The fast path is unchanged; only the naming needed the extra field.

**The reason a cover match gives is better than the one it replaced.** `design/0027` had written
*"that phrase disappears on its own the day those surfaces leave the rule"* about *matches in the
text* — an admission that the reason was somewhere the reader could not see. Its replacement
**names** the thing: `on the shelf as “No one named”`.

Measured on the one vault, 4,938 notes. The equivalence check goes from 5 needles to 6, the sixth
being a term the vocabulary spells as a book and as nothing else:

| | before the merge | after |
|---|---|---|
| notes marked / with a reason | 1,700 / 1,700 | **4,140 / 4,140** |
| disagreements | 0 | **0** |
| reason kinds | `tag` `person` `title` `folder` `body` | `tag` 876 · **`cover` 3,946** · `person` 620 · `title` 43 · `folder` 192 |
| `body` or `path` reasons | present | **0, and unrepresentable** |

The new check `"a book lit only by the name on its spine finds that name inside it, and says so"`
types `No one named` — on **2,450** notes, in the text of none — takes the **612** books it draws
forward, opens **20**, clicks a marked row in each, and asserts the detail line names the spine
and the book's own find box finds the needle again. **3,066** rows marked across the twenty, 0
denials, 0 silent notes.

**It fails on the first draft, and the first draft was the check's fault.** Asserting the reason
on whichever note the book *opens* on gave `7 of 20 opened without saying why` — correct
behaviour, wrongly demanded: a book is drawn forward by *some* of its notes and still opens on its
oldest (`design/0018`), which need not be one of them. The check now clicks a marked row first.

**And the picture was taken.** `782 of 1,755 match “No one named”` in the head, the matched rows
painted, and the detail line ending `· on the shelf as “No one named”` — the fifth time this file
records that a number could not have seen it.

## 2026-09-13 — Older books start worn, including the first launch

User ask: make old books look older, also when a new vault first opens. Worker
`luke321/older-book-wear`, based on product commit `e67aa0d`; `design/0033` records the rule.

| Measurement | Before | After |
|---|---|---|
| Fresh 2015 yearbook, zero saved opens | Level 0 from real-opening rule | Age floor 3 |
| Fresh 2026 yearbook, zero saved opens | Level 0 | Level 0 |
| Persisted fake opens needed for age | None existed | None written: 0 wear keys on fresh mount |
| Leather fade on a level 3 specimen | 0.16 old stylesheet; 0 with no wear attribute | 0.30; removing the wear attribute restores 0 |
| Existing source with 2 actual opens | Opening level 1 | Age level 3; one real open leaves saved count 3 |
| Recent source with 12 opens | Level 3 | Level 3 |
| Vellum selection and hidden-source favourite | Source-owned | Binding vellum retained; both source/reference level 3 |
| Layout dimensions on age toggling | Baseline boxes | Offset/width/height identical |
| Common spines across a date filter | 110 | 110 unchanged wear levels |
| Golden packing at 1180px | 6 shelves, 10 rows, 227 spines, 52 plaques, 1125px room |Unchanged in all 3 looks |
| Binding preview ink census on old month | 5 unaged; 2 when old fixed worn-ink override applied | 5 after preserving each binding's ink |

The first broad targeted pass found two existing assumptions exposed by applying wear on first
load. The oldest Months book's fixed level 3 ink flattened binding choices to two inks; mixing
its binding-specific ink repaired this, and the original five-ink assertion passed unchanged.
The clearance check's first unlifted book became a shorter Morocco binding with 4px of natural
height trim; measuring trim separately restores its zero-extra-room assertion without hiding
actual padding or dropped containment. The largest allowed clip lift remains 7px in every look.

Five targeted browser checks passed: age wear, actual opening history, leather binding preview,
clip clearance and golden packing. The run used `--jobs 1`, so its two Chrome jobs ran serially
alongside the owner's separate preview; it never attached to or closed that preview. No full
suite or stamp is claimed. An initial screenshot run needed the ignored dist directory created;
a test cleanup was also corrected to explicitly clear date filters before the final screenshots.

The worker inspected `dist/age-wear-vault.png`: the old year/month spines show softened, faded
edges; recent books stay darker and fresh; all chosen bindings remain recognisable. The picture
shows all 4,938 fixture notes after filter cleanup, with the Years row and multiple Months rows.
Reader screenshot is beside it. Core boundary/parity/immutability checks, lint/typecheck and
static release gates are recorded in the worker handover after the final pass.

## 2026-09-14 — The Favourites review gets its clips, and the recorder learns the empty shelf

`github#23`. #3's review carried one still of the drag and said so: *"Mid-drag… note the lifted
spine at 35% opacity"* is the most a screenshot can do, and it still cannot show the landing
lighting as the pointer crosses it, the insertion mark stepping between spines, or the book
settling. Worker `luke321/vault-shelf-23-favourites-clips`, based on `fdaddb3`.

**The answer to the question the issue asked.** The machinery *can* film a drag. A synthetic
`DataTransfer` paints correctly because the page draws the carried book, not the browser —
`#vsrec-ghost` is the spine cloned inside `.vault-shelf`, so the product's own stylesheet reaches
it (`design/0007`, "The ghost"). What the recorder could not do was shoot Favourites **empty**:
`core.seedPicks` puts four picks on the shelf in a demo build, so the state a fresh library
actually opens in — the dashed *Drag a book here* landing — was the one Favourites state the film
had never shown.

| Measurement | Before | After |
|---|---|---|
| Recorder flags | `--look`, `--vault-name`, `--mirror-of` | plus `--empty-picks` |
| `__vs.picks()[0].picks.length` at the `favourite` act's setup | 4 (seeded) | 0 under `--empty-picks` |
| Favourites head during that take | `4 books · 2611 notes` | `0 books · 0 notes` → `1 book · 481 notes` |
| Storyboard acts | 24 | **24, unchanged** |
| `docs/features/` clips | 24 | **24, unchanged** |
| Clip 1, the drag onto the empty shelf | none | 1000×1000, 7.7s, 15fps, q92, 1,098,106 bytes |
| Clip 2, the reorder | none | 1000×1000, 7.7s, 15fps, q92, 1,051,204 bytes |
| #3's review artifact | 3.3 MB, stills only | 6.07 MB, two clips inlined, same URL |

**The window is the act's own timing, not a guess.** `favourite` and `rearrange` share their
beats: the pointer rests at `neutral` until 1.8s, glides to the spine, lifts at 3s, carries to
7s, drops, and the next step's glide begins at 7.8s. `--hero-clip 1.8,7.7` is rest → lift →
carry → drop → rest. It runs 1.7s past the six-second review guideline deliberately: cutting at
6s ends the first clip with a peek card lying across the library, because the act does not
dismiss it until 9s.

**One act change, and it is a fallback rather than a branch.** `favourite`'s drop target was
`.vs-plusbook` offset +90; an empty pick rail draws a `.vs-dropzone` instead. The target now
prefers the dropzone and falls back to the plus, so a normal take — where no dropzone exists — is
byte-identical, and the act now throws rather than dropping into nothing if neither resolves.

**The optional third clip was not shipped.** Taking a favourite off through the right-click menu
has no storyboard act, and adding one owes a `docs/features/<act>.md` page and clip — surfaces
the maintainer alone puts something on. Recorded as a known gap on the issue
rather than guessed at.

**Nothing in `src/` moved**, so no invariant moved and the suite was not re-run; the tree earns
no stamp from this. Lint, `check-comments`, `check-pii`, `check-scope`, `check-network` and the
generated code-map check are what gate it.

## 2026-09-14 — The two plugins can tell a dead hold from a live one (`github#43` + `github#52`, `decisions/0012`)

Two tickets, one property. `github#43` asked whether the repos can see each other's screen claims
and warned that the sister's proposed `suite`→`screen-left` alias would deadlock our own
`smoke.mjs`; `github#52` reported a dead sister `screen-left` record never being broken, stalling
every worktree on the machine for twenty minutes. Both reduce to **cross-repo liveness**.

**What the measurement changed about the plan.** Driving both repos' real `lock.mjs` files over one
isolated root, two of `github#43`'s premises had already moved on:

| read in the sister's checkout | consequence |
|---|---|
| `smoke.mjs:6483` takes `screen-left` **by name**, and greps clean for `"suite"` | `github#43`'s rows 3 and 4 are not holes — option 1 of that ticket landed on their side |
| both `aliasesOf` are `record`↔screens; neither aliases `suite` | the row-7 deadlock is hypothetical, and a guard now keeps it that way |

**The fix `github#52` prescribed would have broken a live sister hold.** Its comment says to trust
a `pid` when `holder` is absent. Every vault-graph harness claims its display by shelling out to
`lock.mjs acquire` as a subprocess, and that CLI writes `pid: process.pid` and exits immediately:

| | measured |
|---|---|
| a **live** sister run's record | `{"owner":"smoke.mjs feature/x [1128644]", "pid":1128724}` — `meta.pid` **dead**, owner pid **alive** |
| what *trust `meta.pid`* decides on it | BREAK — two harnesses on one display |
| what the 60 s floor buys against it | nothing; their runs outlive it |

So the rule reads the pid the holder named **as its own identity**, in either spelling in use
(`[N]` from five sister harnesses, ` pid N` from `record-demo.ps1` and our own `ownerTag()`),
requires **every** pid the record names to be gone, and applies a 60 s floor to a foreign record.

**Before and after**, the same harness against both files. Two rows move:

| holder | contender wants | before | after |
|---|---|---|---|
| VG `screen-left`, orphaned, aged 2 min | VS `screen-left` | BUSY — **1200 s** | `BREAKING dead ... pid 1128132/1128296 is gone` — **at once** |
| `record` held by the **same owner** | VS `screen-left` | BUSY | ACQUIRED |
| VG `screen-left`, **live** run aged 5 min | VS `screen-left` | BUSY | BUSY |
| VG `screen-left`, orphaned, fresh (2 s) | VS `screen-left` | BUSY | BUSY — the floor |
| VG hand hold naming no pid (`release 2.6.0`) | VS `screen-left` | BUSY | BUSY |
| VS CLI hold, VS live in-process hold | VS `screen-left` | BUSY | BUSY |
| VS `suite` ↔ VG `screen-left`, both directions | — | ACQUIRED | ACQUIRED |

`status` over the exact record `github#52` reported: `holder unverified  stale in 1078s` →
`holder pid 1057524/1129552 DEAD  stale in 1080s`.

**The selftest grew 25 → 34 cases**, the floor of five runs 7.1 s → 9.5 s on a machine carrying six
worktrees. (The 1.0 s recorded for the old file in `decisions/0012` was an idle machine and does not
reproduce for it either today; the honest comparison is same-machine, same-minute.) Nine cases are
this rule: a live sister run is not broken though its recorded pid is dead; one whose every named
pid is gone is; both owner-string spellings are read; a foreign hold naming no pid keeps its window;
one inside the 60 s floor is not stolen; a `holder: "cli"` record is never read for pids whatever
its owner string says; a record *claiming* `holder: "process"` is still judged on every pid it
names; and an alias exempts its own asker but nobody else.

**The last of those is a trap the sister is one commit from walking into.** `github#52`'s comment
asks vault-graph for `holder: "process"`. That field alone does not make their recorded pid mean
anything — it would only move their records into the branch that trusts it, and we would break
their live holds off the display. So `holder` no longer decides *whether* pids are read, only
*which*: a `"cli"` hold is never read for pids, and everything else is judged on every pid it names,
its own and its owner string's. For our records that is a no-op — `ownerTag()` writes the same pid
the record does.

**One-sided by construction.** The sister's `acquire` reads only `owner` and `at`, both of which we
still write and beat, so nothing there needs changing and nothing here waits on them. The one
asymmetry left standing: they never refresh `at`, so a hold of theirs older than its window is
still broken on age — unchanged, and recorded rather than fixed from this side.

**Nothing in `src/` moved**, so no shelf invariant moved and the suite was not re-run; the tree
earns no stamp from this. `lock.mjs --selftest`, lint, `check-comments`, `check-pii`,
`check-scope`, `check-network`, the determinism checks and the generated code-map check are what
gate it.
## 2026-09-15 — The CSS lint's five warnings, measured instead of argued (`github#61`, `design/0036`)

The editor's CSS lint flagged five things against **Obsidian 1.6.5**. `manifest.json` declares
`minAppVersion: 1.7.2`, so the target sits *below* the floor; and there is no `.vscode/settings.json`,
browserslist or CSS-lint config in the tree, so the target is editor-local and invisible to anyone
else running this repo.

`scripts/check-css-support.mjs` is new: it installs the built plugin into a throwaway copy of the
shared vault fixture, launches a real Obsidian over CDP, and asks the engine. It names the
engine from the user agent rather than being told -- **Chromium 150.0.7871.212 / Electron
43.3.0 / Obsidian 1.13.7**, 19/19:

| Flagged | Measured |
|---|---|
| `clip-path: polygon()` | supported; notch excluded from hit-testing, body still paints |
| `clip-path: inset()` | supported |
| `column-gap: 10px` on flex | computed `10px`; the gap between two items measures `10px` |
| `text-decoration-thickness: 1px` | computed `1px` |
| `text-underline-offset: 2px` | computed `2px` |
| `text-decoration: underline dotted` | computed `dotted` |
| `ui-monospace` | does not resolve — shipped stack, stack without the keyword, and bare `monospace` all measure `527.81px`; `serif` measures `426.61px`, so the fallback is a real monospace face |
| `[hidden]` vs a class selector | `.vs-railsearch` computes `flex`; with `hidden` it computes `none` |

Both looks are asserted before each shot. A rebuild resets `data-look`, so the first attempt
shot the shelf twice in the same look and the two PNGs came out byte-identical while every
assertion passed -- only a checksum caught it. The harness now re-applies the look and asserts
which one is painted; "default" is `page.css` alone, the attribute being absent.

Live product shapes carry the clip in the real page: `.vs-mark` and `.vs-ribbon` both compute
`polygon(0px 0px, 100% 0px, 100% 100%, 50% 74%, 0px 100%)`, six ribbons on the shelf with the
reader closed. A close-up of `.vs-mark` shows the V-notch drawn.

**No CSS changed.** Four warnings are compat-data noise against an engine nothing here runs; the
fifth (`ui-monospace`) does not resolve on Chromium and is carried by the fallback chain that was
always there. The `!important` at `src/page.css:194` stays — the check now asserts both halves of
that cascade, so the guard has a measurement rather than only a comment.

**Nothing in `src/` moved**, so no shelf invariant moved and the suite was not re-run; the tree
earns no stamp from this. Lint, `check-comments`, `check-pii`, `check-scope`, `check-network`, the
determinism checks and the generated code-map check are what gate it, plus the new harness.

## 2026-09-15 — The tie-break within a date, decided and then asserted (`github#80`, `decisions/0018`)

Oldest-first listed notes sharing a date in **reverse alphabetical** order. One character did it:
`readingOrder` negated the whole of `byDateThenTitle` — a comparator written newest-first, date
descending then title **ascending** — so the `-1` for the oldest-first default flipped the date
axis (wanted) and the title tie-break (not wanted).

**Measured over the one vault, before and after**, by the new check itself:

| | before | after |
|---|---|---|
| dated notes | 4,408 | 4,408 |
| in a same-date group of 2+ | 3,327 (75.5%) | 3,327 |
| same-date groups | 802 | 802 |
| **notes in a run that is not A-Z** | **3,327** | **0** |
| a reversed-on-disk pair, read oldest-first | `Beta,Alpha` | `Alpha,Beta` |

The last row is the one that says it was the comparator and not the input: the same two notes, fed
in both orders on disk, came out `Beta,Alpha` either way.

**The decision came first.** Nothing in the repo had ever said what should happen between equal
dates, which is why no check failed — the suite asserted that a book *opens on* its oldest note and
that order survives a rebuild, and both were true throughout. `decisions/0018` settles it: A-Z
within a date, in **both** directions, because the oldest/newest control names the date axis and
governs only that axis. It records the three rejected alternatives — mirroring the whole order,
path order, and a time-of-day fallback (which `decisions/0003` already rules out, since a date
taken from a property or a title carries no time).

**Two further changes fell out of it.** The tie-break now uses the **same case-insensitive**
comparison the A-Z index uses — it compared titles raw before, so `Zebra` sorted ahead of `apple`
and the Date index could hold a sub-order the A-Z index would disagree with. And the direction is
applied to the date key rather than to the comparator's result, so the tie-break is no longer
reachable by the sign at all.

**Nothing else moved.** `the shelves are packed the way the golden snapshot says` is unchanged —
the packing is per book, not per note — and all 31 checks touching contents, ordering, indexes,
plaques and made books stayed green. Undated placement is untouched, and checked both ways rather than
argued: the same folder-shelf book reads `Undated note,Mu,Xi` oldest-first and
`Xi,Mu,Undated note` newest-first on the **pre-fix** comparator and on the fixed one — identical,
while the A-Z assertions fail on the first and pass on the second.

`check-comments` dropped to **1534** (from 1536): the two-line prose comment explaining the flip
became one pointer, with the argument moved into `decisions/0018` per `decisions/0007`. The
baseline moved in the same commit, as that check instructs.

**Renumbered 0017 → 0018 on 2026-09-16**, after `github#77` merged into `develop` as
`decisions/0017-a-smoothness-budget-counts-frames.md` while this branch was open. Two records
under one number whose **filenames differ** is the dangerous shape: git merges both without a
conflict, so nothing would have caught it. `github#81` hit the same wall and took `0019`,
leaving `0018` for the lower issue number. The commit that introduced the record still names
`0017` in its message, deliberately — that sha was already reported and rewriting it would
break the reference.
