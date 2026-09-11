# Verification of 0.1.0

**Date** 2026-09-11 · **Candidate** `release/0.1.0@<sha at the cut>` — the rows below were
run on `luke321/vault-shelf-27-release-parity`, the branch that made the release ready; the
dry run in step 8 of `releasing.md` re-earns them on the release branch itself · **Reference**
the first release, nothing to compare against.

## What was run

| gate | result |
|---|---|
| `npm run lint` (with `tsc --noEmit` over `src/core`) | 0 errors, 0 warnings |
| `node scripts/smoke.mjs` | <suite pending> |
| `check-pii` / `check-scope` / `check-network` / `check-comments` | clean (110 files, 6 names); clean (421 rules, 72 ids, 95 prefixed classes, no invisible characters); clean (13 files); comment baseline 1527 |
| `check-data-escape` | ok — every payload back byte for byte |
| the two determinism checks | clean |
| `node scripts/code-map.mjs --check` | current |
| `node scripts/suite-stamp.mjs --selftest` | 17/17, the last through a junction |
| `release.ps1 -SelfTest` | 10/10, every case `0 -> 0` tags |
| `release.ps1 0.1.0 -DryRun -AllowAnyBranch` | every guard passed (`-AllowAnyBranch` waiving the branch one), hero warning fired (github#21), lint clean, plugin built, suite 87/87 × 3, stopped before the tag; not stamped, the tree was dirty while it queued 17 min for the lock |
| `release.yml` dry run on `release/0.1.0` | **not yet run** — needs the release branch pushed (the orchestrator's) |
| `gh attestation verify main.js --repo luke321/vault-shelf` | **not yet run** — needs the tag run |

## What was looked at, not just measured

Nothing, and deliberately: no pixel moved on this branch. What changed shape is
`CHANGELOG.md`'s `## 0.1.0` section, and that is read — step 7 of the flow, on the release
branch, as the page it becomes. The hero (`assets/demo.webp`) is known stale (github#21) and
the `=== hero ===` warning fires; it is carried knowingly unless #21 lands first.

## What changed since the reference, and what did not

The first release: everything in the section is new, and the numbers behind it are the
baselines in `changelog-detail.md` ("0.1.0 — the first measurements", 2026-09-09, and every
dated entry since). The suite holds 87 checks per shape, 261 a run, on `develop`'s tree
`d0ee696` and on this branch.

## What was NOT verified

- The `release.yml` dry run and the attestation: both need a push this branch does not make.
  The step-summary text in `release.yml` changed on this branch (github#27) and has not run.
- The Obsidian plugin in a real Obsidian. The suite drives the exporter; the Obsidian harness
  was removed at `829725f`, and `refresh-check` / `teardown-check` were not run for this
  branch (nothing they cover changed).
- README's prose beyond the settings table, and the committed live demo under `docs/demo`,
  which predates the 424-note fixture — both github#21's pass.
- The release section's prose was written from the merge list and the design records and read
  against the laws in `CLAUDE.md`; every feature it names has a check, but the sentences
  themselves were not driven.
