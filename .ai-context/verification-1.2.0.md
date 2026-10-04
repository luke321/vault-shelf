# Verification of 1.2.0

**Date** 2026-09-23 · **Candidate** `release/1.2.0@d5e8ff7` (merged to `develop` as `397e793`,
to `main` as `ed7d94c`) · **Reference** `1.1.0`

**Written after the tag, not on the release branch as `releasing.md` asks.** The gates below were
all genuinely run and read at the time, on the release branch and on the merge results — nothing
here is reconstructed from memory — but this file itself should have existed before step 8's dry
run and did not. Recorded as a process gap rather than silently backfilled as if it had.

## What was run

| gate | result |
|---|---|
| Range enumerated | `git log --oneline --merges 1.1.0..develop` → 12 merges, closing `#19 #20 #42 #53 #69 #72 #73 #74 #77 #87 #88 #91`, each accounted for in the `## 1.2.0` section. `#41` referenced but not closed by any commit — closed by hand after the tag (see below). |
| Release name | **"Search Update"**, the owner's own choice, not one of the proposed candidates. |
| `## 1.2.0` section | Written from the range. Three feature sections (search vocabulary widening, match-weight, sticky-note flags), a "For the record" list for the rest, the Ko-fi block. Every image URL pinned to the `1.2.0` tag. |
| Version bump | `manifest.json` 1.1.0 → 1.2.0. |
| Update note | `plugin/whats-new.md` rewritten for 1.2.0, four bullets, one `> vs-clearquery` control line (the release's one new control). `build-plugin.mjs` → `update note for 1.2.0: 4 lines, 1838 bytes, pointing at vs-clearquery; 4 releases from the CHANGELOG, newest 1.2.0`. Rendered and read via `update-note-check.mjs --out` (33/33 passed); the strip itself was looked at, not just measured. |
| Docs repinned | 48 gallery URLs in `docs/features.md` plus every `docs/features/*.md`'s own embed moved from `1.1.0` to `1.2.0`; `docs/index.md`'s hero embed likewise. Two new gallery entries added: `matchweight` (new storyboard act, built from scratch) and `sticky` (act and clip already existed from 2026-09-17, only its gallery entry and metadata were pending — the actual gap `#19`'s own docs/features work left open). |
| Every clip re-shot | **26 of 26** feature clips + the hero, each `1000×1000`. Verified from `ffprobe` on the files, not from exit codes. |
| The hero | Reworked twice more after the first cut, on direct feedback: widened the review page to show it, then given its own search beat (originally absent entirely), then that beat redone so search opens the exact book it finds rather than a separately-browsed one. Final cut: `record-demo.mjs --exact-act --act hero --width 1000 --height 1000 --hero assets/demo.webp --hero-acts hero --hero-width 1000`, 1,776 frames, 74.0s, 1000×1000, `assets/demo.webp` ~4.1 MB. Its own assertions passed, including two new ones: the searched person's own book reads `data-named="1"` and `data-strength="4"` before it's opened, and `__vs.reader().book` is that exact book id after the click — search finds a specific book and opens it, not an unrelated one. |
| Recorder bugs found and fixed while re-shooting | Two, both in `scripts/record-demo.mjs`, neither in the product: (1) `github#34`'s own edge-autoscroll can fire mid-carry during a drag now that Favourites starts with more picks, moving the rail out from under a target cached before the carry began — fixed by re-settling onto a fresh target right before the drop. (2) the `favourite` act's hardcoded book key `"S"` can collide with the hero's own pick once both run in the same continuous walkthrough — fixed by excluding whatever Favourites already holds, same as the hero's own candidate selection. A third (`wear`, full-walkthrough-only) was found, diagnosed at length, ruled out as RAM-pressure noise, then re-confirmed as real and reproducible — filed as `github#92` rather than fixed, since nothing this release actually needs runs the un-scoped full walkthrough. |
| `npm run lint` | `tsc --noEmit` clean, `0 errors, 0 warnings`. |
| `check-pii` / `check-scope` / `check-network` / `check-comments` | clean; comment baseline held at exactly **1532** across four separate rounds of trims (every new comment in `record-demo.mjs` rewritten to fit the one-line pointer form after going over). |
| `check-generator-determinism` / `check-build-order-determinism` | clean. |
| `code-map.mjs --check` | current, regenerated after every code change. |
| `node scripts/smoke.mjs` | **159/159 × 3 separate times in a row** across the session (once per content change requiring a fresh stamp: the docs+clips+scenes commit, the square-hero-fix commit, the caption-fix commit, the search-redesign commit — the last of these is the one that actually shipped), each stamped tree confirmed via `suite-stamp.mjs`'s own printed line, never skipped. |
| `release.ps1 1.2.0 -DryRun` | reached the tag step each time it was run; the last real dry run stamped tree `81e11cc` (commit `d5e8ff7`). |
| `release.yml` dry run on `release/1.2.0` | green on every push (4 pushes total as the hero was reworked), three files attested, no Release created. |
| Merge `release/1.2.0` → `develop` | `397e793`. Hook recognised the merge tree matched the already-stamped tree and skipped re-running the suite, printing the stamp it trusted. |
| PR `develop` → `main` | [#93](https://github.com/luke321/vault-shelf/pull/93), both checks green (`close the issues this push fixes`, `main accepts develop or hotfix`), merged as `ed7d94c`. |
| `release.ps1 1.2.0` on `main` | found the stamp for `HEAD`'s tree, skipped the suite, tagged, pushed the tag alone. |
| `release.yml` publish run | green, [run 35896935413](https://github.com/luke321/vault-shelf/actions/runs/35896935413). Release created: [1.2.0 "Search Update"](https://github.com/luke321/vault-shelf/releases/tag/1.2.0). |
| SHA-256s | `main.js` `f8f74102efc6aaf347fa1920a148697cc7810a0a5ba3923277bd45398994a33f` · `manifest.json` `a2cb8e206b3b230dfd8872426b4d31b6362f2937e341beb05938ba9a08fd0c7b` · `styles.css` `c7692d5315e9d836627135a9a8c0a6a5536c03e32cae928d3b653190c68b0c93` |
| `gh attestation verify main.js --repo luke321/vault-shelf` | verified against the run; signed for commit `ed7d94c` on `refs/tags/1.2.0`, workflow `release.yml`, trigger `push`. |

## What was looked at, not just measured

- The rendered update-note strip (`01-strip-up.png` from `update-note-check.mjs`): the four bullets, the `1.2.0` and `Feature gallery` links, the `Got it` button, all reading correctly.
- Individual frames pulled from the hero and from `matchweight`, `sticky`, `autocomplete`, `looks`, `manage`, `build` clips at multiple points in this session — the search beat's ladder actually climbing on screen, the found book opening on the right title, the clear button resetting the shelf, the make-a-book sheet's Save button reachable after the scroll-into-view fix.
- The release-body review page itself, published as an Artifact with every image as a real asset (not a branch-pinned external URL, which the Artifact viewer's CSP blocks) — caught on the user's own read, twice: the page was too narrow (fixed, and the fix promoted to a standing floor rule for every review page this machine builds from now on), and the hero's search caption wasn't a grammatical sentence (fixed).

## What changed since the reference (1.1.0), and what did not

| | before (1.1.0) | after (1.2.0) |
|---|---|---|
| Suite checks | 144 | 159 |
| `docs/features/` entries | 24 | 26 (`matchweight`, `sticky` added) |
| Hero duration | 68s | 74s |
| Hero dimensions | 1000×1000 | 1000×1000 (unchanged — a mid-session regression to 1000×626 was caught and fixed before this shipped) |
| Comment baseline | 1532 | 1532 (unchanged) |

## What was NOT verified

- The suite's own 159 checks do not cover the hero or feature clips at all — those are proven only by the recorder's own inline assertions (`prove()` calls) and by eyes-on frame checks in this session, not by an automated gate. A rendering regression in a clip would not fail CI.
- No screenshot comparison was made against 1.1.0's own hero/clips pixel-for-pixel; "looks right" here means read by a person in this session, not diffed.
- `#90` (the query-air room-overflow issue filed during the match-weight ticket) remains open and unverified either way — it was out of scope for this release from the start.
- The published `docs/demo/` site (the separate interactive walkthrough, distinct from the hero video) was not rebuilt or re-verified this release; only `assets/demo.webp` and the `docs/features/` gallery were touched.
