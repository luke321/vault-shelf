# 0014 — One vault for the checks and the film

**Date** 2026-09-11 · **Status** accepted · **Issue** [#31](https://github.com/luke321/vault-shelf/issues/31) · **Amends** `decisions/0004`, `design/0013`

## Context

Four generated vaults, each with its own generator: the demo vault the suite mostly runs on and
the docs site exports, the sparse vault that is awkward on purpose, the 10,000-note library vault
that is big on purpose, and the mirror a film is shot in.

The cost was paid daily. The fixture store held a directory per digest per vault — 6 directories,
**31 MB**, two 14 MB library vaults among them — and the digest was sha256 over **all three**
generator sources, so editing any one of them regenerated every fixture in every worktree on the
machine. A broken generator run left orphan directories that made every suite stamp miss
(`decisions/0011`, `github#8`). And the film was shot in a fourth vault the suite never looked at,
which is how a storyboard drifts out of step with the product: a film opened on a shelf the
narration never mentioned.

## What the numbers said before the decision

A fixture is supposed to be even where a real vault is lopsided (`design/0013`). Both ends were
measured before choosing, because the whole question is how far apart they actually are:

| | the demo fixture | a real vault, through its mirror |
|---|---|---|
| notes | 424 | 544 |
| in the rolling twelve months | **146 (34 %)** | **472 (87 %)** |
| busiest month | 45 | 174 |
| people | 17 | 125, of which 86 in three notes or fewer |
| tags | 43 | 141, of which 64 on one note |
| folders | 17 | 54 |
| empty weeks in the last 52 | 12 | 16 |

The fixture was not *even* — it already had an aged curve, a long tail of people and a long tail of
tags. It was **thin**. A month with three notes in it is not a shelf anybody recognises, and that
is the same complaint as `#17`.

## Alternatives weighed

| Option | Why not |
|---|---|
| **One generator, several profiles** (`--profile demo\|sparse\|large`) | Its headline benefit is false. "Editing one generator invalidates all three" is a property of the **digest**, which hashed all three sources — not of there being three files. With one file every profile shares that file, so every profile always invalidates: strictly worse than a per-fixture digest. It buys one code path and nothing else. |
| **Fold sparse into demo, keep the big one** | Two shapes instead of three, and the 10,000-note vault stays the thing nobody can regenerate cheaply. It halves the problem and keeps the half that costs 14 MB. |
| **Imitate the real vault's shape** (87 % inside one year, 125 people) | The measurement above is the argument against it, not for it. At that distribution the fifteen-year span holds 13 % of the notes and the Years shelf stops being measurable; the People shelf becomes ~125 books, most of them one note thick. That is a *different* surface from the one every number in `invariants.md` was taken on, and it is not more real — it is one person's vault, which is what a declared fixture exists not to be. |

## Decision

**One generated vault: `scripts/make-vault.mjs`, 5,000 notes over eleven years, ending today.**
It is the vault the suite drives, the vault the docs site is exported from, and the vault the film
is shot in. `make-sparse-vault.mjs` and `make-library-vault.mjs` are deleted.

`make-mirror-vault.mjs` **stays on disk and is not touched** — its guard least of all. It stops
being a step in the film pipeline and becomes what it was always best at: a diagnostic you point at
your own vault when you suspect the product breaks on real data. That is how it earned its keep in
the first place (it found `date: 2024-15-01`, a two-implementation bug three fixtures and 38 checks
had missed), and that find is now *declared* in the one vault, which is the pattern: what the
mirror discovers, the fixture absorbs.

### No check is lost, because no check was ever sparse-only

This is the part `#31` insisted on and it is worth stating plainly. The suite runs **the same 88
checks against each shape** — it printed `88/88` three times. Dropping a shape therefore drops
*coverage of those checks on that shape*, not a check. So the obligation is to show the one vault
carries every property the three carried, and to name the one that does not survive:

| was the reason for | survives as |
|---|---|
| library: ~520 week books on one rail | eleven years ≈ **574 ISO weeks**, nearly all populated — a longer rail than the property it replaces |
| library: an Encyclopedia volume too big for one tab per initial | the biggest book in the high hundreds at 5,000 notes |
| sparse: one folder holds most of the vault | eleven years of daily notes puts the largest folder near 40 % — **the 82 % extreme is gone** |
| sparse: a fifth of the notes undated | a declared undated share |
| sparse: two date clusters five years apart | a **declared empty year** inside the span: the year nobody wrote |
| sparse: titles opening with digits, punctuation and four scripts | folded into the title deck |
| sparse: five people and six tags on one note — eleven books at once | a declared rare case |
| sparse and demo: `2024-15-01` and `2023-02-30` | kept verbatim, both notes |

**What is lost, deliberately:** the 82 % dominant folder, and the 10,000-note scale itself. The
dominant-folder case survives at ~40 %, which still gives the source band one obvious colour and
the folder filter one obvious answer, but it is no longer the extreme. Nothing now measures the
product at 10,000 notes. Both are named in `changelog-detail.md` with the numbers they used to
carry.

### The film moves with it

`record-demo.mjs` already fell back to the fixture when no mirror source was configured. The
default flips: the fixture is what it shoots, and `--mirror-of <path>` is the explicit opt-in. A
decision record that left the default pointing at a mirror would be describing a policy rather than
binding one — and the drift `#31` names is exactly what an unbound policy produces.

The film gives up a real vault's extremity. `#17`'s density is what buys it back far enough to be
worth filming: a recent year that is genuinely active rather than sampled.

## What `decisions/0013`'s per-shape narrowing means now

`github#39` landed on `develop` while this branch was open. It annotated **61 of 89 checks**
with the vault shapes each one's assertion depends on — `check(name, fn, { on })` — and added a
guard that rejects a check asking for a fixture that does not exist. Its measured win was
**267 check runs down to 146**.

Merging the two produced the sharpest possible demonstration of why the guard is worth having.
`git` merged `scripts/smoke.mjs` **with no conflict at all**: `FIXTURE_NAMES = ["vault"]` and
the 61 annotations touch different lines. Textually compatible, semantically contradictory. The
guard fired at module load, before the lock and before any Chrome:

```
Error: check "the seven default shelves are there, in order, Favourites first"
asks for fixture(s) demo-vault, which do not exist; the fixtures are vault
```

**0 checks loaded instead of 89.** A clean merge is not agreement.

**Decision: the 61 annotations go; the parameter and its guard stay.**

An annotation naming `demo-vault` is a claim about coverage that cannot be true once there is
no demo vault, and nothing about "keeping it dormant" makes it truer — the guard refuses it
either way, which is correct. Rewriting all 61 to `on: "vault"` would leave 61 statements that
say nothing. So they go, and `DEMO_ONLY` goes with them: it hardcoded a dead fixture name.

The parameter stays because the **guard** is the part with ongoing value, and it is independent
of whether anything is annotated. It turns a stale shape name into a loud failure rather than a
silent skip, which is exactly the service it just performed. A second shape, if one is ever
argued for, arrives with the mechanism already in place and already proven.

**And the win had to be re-measured rather than re-typed.** `github#39`'s arithmetic was over
three shapes; with one shape there is nothing to narrow, and the saving arrives from the vault
decision instead. Measured on the runner's own clock, two runs:

| | three shapes | one vault |
|---|---|---|
| wall, after the lock | 41-43 s | **32 s** |
| Chromes | 7 | **3** |
| check runs | 146 | **90** |
| check time | 34.1 s | **30.3-30.5 s** |

The run count fell 38% and the check time 11%. The gap is the honest part: a run costs 234 ms
on the three shapes and **338 ms** here, because this vault is twelve times the demo fixture and
most of a check's cost is the page it drives. Narrowing removed cheap runs; one big vault makes
every remaining run dearer.

## Consequences

- One fixture directory in the store instead of six, and the digest question disappears with the
  second generator: there is one source to hash.
- The suite runs one shape rather than three, so a full run gets **faster**, not slower, even at
  5,000 notes. Measured before and after in `changelog-detail.md`.
- Every number in `invariants.md` that was taken on a 424-note vault moves, and the layout goldens
  are re-taken deliberately (`node scripts/update-layout-snapshots.mjs`).
- `docs/demo/index.html` is exported from the same generator at a reduced note count: at
  ~1.56 KB/note a 5,000-note export is ~7.8 MB of committed HTML on a Pages site. One generator and
  one declaration, a smaller cut — not a second shape. `decisions/0009` says which.
- Everything that named a fixture by name is renamed with it, so a stale reference fails loudly
  rather than quietly meaning something else.
