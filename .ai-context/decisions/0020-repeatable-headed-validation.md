# 0020 — Repeatable headed validation

**Date** 2026-10-03 · **Status** accepted · **Issue** #110

## Decision

Local release and push gates invoke `smoke.mjs --headed --no-lock`, adopting their existing
suite hold. Direct focused runs pass `--headed --only <substring>` and take their own locks.
Before opening a browser, use the machine's screen guard and defer unless the intended
monitor is available. There is no headless fallback. The CI workflows retain static gates;
the stamp self-test runs there without Chrome and writes only to a throwaway repository.

`suite-stamp.runExclusion()` requires headed mode and rejects `--only`, `--vault`, `--url`
and `--look`, even when a value is empty, plus missing or unstamped fixtures. Jobs, locking,
ports, Chrome selection, screenshots and timing reports do not reduce coverage. Dirty trees
remain refused by `record()` and `forget()`. A failed complete eligible run breaks the streak;
a partial run cannot write or erase it. Fixture freshness, tree hashing and two consecutive
greens remain the certification rules. Epoch **3** invalidates certificates earned by the
earlier instrument. Both consumers recheck the certificate after a successful suite process:
one green is reported as 1/2 and blocks the push or release, rather than proceeding on exit 0.
They do not silently schedule an additional full run.

The shared `suite-certificate.mjs` consumer requires both exit 0 and the explicit certificate
message for every named tree. A silent exit 0, misleading text with a failing exit code, or
one uncertified tree in a multi-tree push all refuse. Its cases run with the stamp self-test.
Release SelfTest also drives the real release control flow with stubbed external work,
checking headed arguments and lock release on all five success/failure paths. Its isolated
clone setup removes the inherited manifest-version tag from the scratch clone and scratch
origin only; otherwise that tag masked later guards. No real tag changes.

## Two different uses of the same generator

The live suite keeps `make-vault.mjs`'s default end date and seven-day shared-store refresh.
Geometry uses that same generator with `--end 2026-09-24`, in an isolated temporary directory,
and pins the exported data's generation day to `2026-09-24 00:00`. Book wear reads that day,
so fixing note dates alone would still let geometry age. The normal exporter is unchanged.
The normalization is confined to the synthetic geometry build and refuses an absent or
ambiguous data block. Two regenerated pages must be byte-identical.

`layout-snapshots/fixture.mjs` owns both inputs; `vault.json` declares them alongside the
unchanged geometry. Smoke and the updater use the same builder and reject mismatched
metadata. No live shared fixture is changed, removed or pinned. Smoke navigates its existing
locked browser to the geometry page, compares every look, then restores the live page and
viewport and removes its temporary build in `finally`. Missing goldens fail rather than skip.

The existing golden was reproduced before changing its metadata: **6 shelves, 11 rows,
257 spines, 52 plaques, 1125px room**, at 1180×900, zero differences in all three looks.
The October 3 live fixture produced **66 differences** under the unchanged check, including
a Months plaque width of 108px against the golden's 138px. No geometry was rewritten and
the exact row/name/count comparisons and 2px box tolerance are unchanged.

Rejected: widening tolerances or refreshing the golden each week would hide real geometry
changes. Pinning the main fixture would stop exercising fresh recent notes. Adding another
shared-store fixture would add identity and cleanup rules for a build that costs only a few
seconds and is used by one check. The temporary fixed-input build keeps those concerns apart.

## Pointer ownership and measurement failure

The index-row test parks the CDP pointer at (0,0) before closing the reader, in `finally`.
Leaving it over the library let later scrolling open a hover preview over the sampled spine.
The paint probe now asserts that no preview is rendered both before and after each screenshot,
so a late overlay is diagnosed as occlusion. It restores its style, attributes, query, look and
scroll positions in `finally`, including when that assertion throws.

The original pair failed **1/2** with only 5px painted for a 14px lift. It now passes **2/2**
with 15/14/28px in leather/modern/cyber; the forced 40px lift still clips to the declared
15/14/32px. A scratch negative-control harness forced the clip margin to 0px: all three looks
painted 0px and the original `HEAD CUT` assertions failed. Injecting a preview after the
third screenshot threw the new precondition and restored a nondefault modern look, `garden`
query and 140px scroll exactly, with zero probe styles or attributes. A clean paint check
then passed in the same browser. No product CSS or behavior changed.

## Focused verification

- `node scripts/suite-stamp.mjs --selftest`: **59/59**, eligibility and consumer guards plus the existing streak, dirty-tree,
  freshness, missing-fixture, epoch, tree-identity and CLI/junction controls, without Chrome.
- `node scripts/layout-snapshots/selftest.mjs`: **5/5**, fixed build day, malformed-data refusals,
  metadata agreement, comparison negative controls and two byte-identical regenerations.
- `node scripts/smoke.mjs --headed --jobs 1 --only "clicking a row in the index moves the mark" --only "a lifted spine is painted whole" --only "the shelves are packed the way the golden snapshot says"`.
- `node scripts/update-layout-snapshots.mjs --headed --check`: another fresh generation,
  through the updater, without writing a golden.
- `powershell.exe -File scripts/release.ps1 -SelfTest`: **16/16**, including the five
  certificate-consumer paths and their cleanup assertions, without a browser.

No full-suite pass, real certificate, release dry run, CI run, push or merge is claimed for
this change. Those remain separate integration/release work.
