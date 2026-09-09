# 0004 — Declared fixtures, generated on demand, never a real vault

**Date** 2026-09-09 · **Status** accepted

## Context

Every check in the suite is a number measured off a vault, so the vault is part of the test.
Three ways to get one, and two of them are traps.

## Alternatives weighed

| Option | Why not |
|---|---|
| **A real vault, pointed at by an env var** | The sister repo did this and it meant that on a contributor's machine "the suite passed" quietly meant *part* of the suite ran. It also puts somebody's note titles one mistake away from a public repository. |
| **A committed fixture vault** | Hundreds of files in every diff, and the same drift problem in slow motion: the fixture is a snapshot of whatever the generator did on the day it was committed, and the generator is the thing that is actually being maintained. |
| **Generate into the checkout, once, if missing** | This is the one that cost the sister repo a blocked push and a full bisect: every worktree kept whatever it generated whenever, so two checkouts held two different vaults and the verdict of the push gate depended on which directory you pushed from. |

## Decision

**Three declared vaults, generated on demand into one shared store keyed by generator
digest.**

- `make-demo-vault.mjs` — the shape the plugin is for: every classifier populated, eight
  people, a three-level tag hierarchy, two non-Latin tags, a `status` property, a handful of
  deliberately undated notes.
- `make-sparse-vault.mjs` — every edge the demo vault rounds off: one folder holding most of
  the vault, a fifth of the notes undated, dates in two clusters five years apart, titles
  opening with digits, punctuation and four scripts, and notes that name five people and six
  tags at once so one note lands in eleven books.
- `make-library-vault.mjs` — 10,000 notes over ten years, which is where ~520 week books on
  one rail and an Encyclopedia volume too large for one tab per initial stop being opinions.

A fixture lives at `<main repo>/.fixtures/<name>-<digest8>`, where the digest is sha256 over
the **contents** of all three generator scripts plus that fixture's arguments. Content, not
mtime: a branch switch rewrites mtimes without changing a byte. Every worktree resolves the
same store through git's common dir, so the gate sees one fixture set no matter where the push
runs. Editing a generator changes the digest and the next run regenerates; nothing has to
remember to delete anything.

**Nothing consults the calendar except `--end`.** Note counts and folder placement come from a
seeded `mulberry32` PRNG alone. `--end` moves which calendar dates the notes get and nothing
else, which is what `check-generator-determinism.mjs` asserts by generating the same seed at
two end dates three years apart and comparing per-folder counts.

**Fixtures age on purpose.** `--end` defaults to today so the activity calendar's live year
stays exercised, which means the newest note recedes from the real clock from the moment it is
written. Each fixture carries its generation day in `.stamp.json`, and anything older than a
week regenerates: the first run each week pays for it, everyone else reuses.

## Consequences

- `.fixtures/` is gitignored, and so is every generated vault directory, for the same reason:
  **the generator is the artefact**.
- A leftover `demo-vault/` in a checkout root is ignored with a one-line notice rather than
  silently used; `--vault` remains the way to point the suite at a specific vault on purpose.
- A fixture with a pinned `--end` does not age, because there is nothing for a weekly refresh
  to change. Nothing is pinned today; the first golden shelf snapshot will need one.
