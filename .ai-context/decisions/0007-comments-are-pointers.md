# 0007 — Comments are pointers; the reasoning lives here

**Date** 2026-09-09 · **Status** accepted

## Context

The sister repo carried its reasoning inline and reached 15,399 lines in one file, of which a
large fraction was prose explaining decisions that had since changed. Prose in code has a
specific failure: it is never reviewed against the code it describes, so it drifts, and a
comment that is wrong is worse than no comment because it is believed.

## Decision

**A comment in `plugin/`, `src/` or `scripts/` carries a reference and nothing else** — a bare
`github#N`, `decisions/NNNN` or `design/NNNN`, optionally with a short label. The reasoning,
the measurements and the rejected alternatives live in `.ai-context/`, and
`.ai-context/code-index.md` (generated) says which code cites which record.

What stays in the code besides pointers: JSDoc blocks carrying a tag, because the type-aware
lint reads them; section banners, because the code map reads them; the build's `BEGIN`/`END`
strip markers; and PowerShell `<# .SYNOPSIS #>` help blocks, because `Get-Help` reads them.

**It is a ratchet, not a rule.** `scripts/check-comments.mjs` counts every comment line in
those three directories that is neither a pointer nor a type annotation and holds the total at
exactly `BASELINE`. Over fails. **Under also fails**, until the baseline is lowered to the new
count in the same commit — so the number can only go down, and lowering it is a deliberate act
rather than something that happens by accident and then quietly reverses.

## Why a baseline rather than zero

Zero on day one would mean writing this repository's first three thousand lines with no
explanatory comment anywhere, which is a real cost paid before anybody knows which parts turn
out to need explaining. The baseline starts at what the first commit actually measured and
only goes down from there. That is the same shape the sister repo's no-unsafe budget had, and
it worked: 6,977 to zero in eleven batches.

## Consequences

- A new ADR or DDR is the cheap way to remove a comment: replace the prose with
  `decisions/NNNN` and the count drops.
- `--list` prints every counted line, which is how you find out what the number is made of.
- The check is unskippable in the pre-push hook. It reads files and costs milliseconds, so
  there is nothing to skip for.
