# Verification of 1.3.0

**Date** 2026-09-27 · **Candidate** `release/1.3.0` · **Reference** `1.2.0`

## Release resumed on 2026-10-03

The September results below describe the earlier candidate. Before publication, the release
branch was reconciled with `develop@d98a1e2`, adding the already-integrated tooling changes
`github#89` and `github#106`. The only merge conflict was the generated code index; it was
regenerated. No files under `src/` or `plugin/`, or recorded clips, changed in this reconciliation.
The release notes now account for both additional changes and use the resumed release date.

The old suite stamp is no longer usable: `suite-stamp.mjs check` reports that the fixture is
nine days old and will regenerate. A fresh full suite and local release dry run are still
required, followed by a CI dry run of the final candidate before merging and tagging.
Run `36304102110` remains evidence for the September candidate, not this reconciled tree.

The five editor CSS warnings were also checked against the branch. Their declarations remain
unchanged, as documented in `design/0036-the-css-floor-is-measured.md`: the editor target is
Obsidian 1.6.5, below the declared minimum 1.7.2; the recorded runtime checks passed on
Obsidian 1.13.7, with a font fallback and an intentional hidden-element `!important` rule.
That earlier run does not establish runtime compatibility on the minimum Obsidian version.

| Resumed preflight | Result |
|---|---|
| Build | Successful; all three SHA-256s match the September dry-run hashes below. |
| Lint and core typecheck | 0 errors, 0 warnings. |
| Static gates | CI parity confirms all 14 hook gates exist in both workflows. PII, scope, network, comments, generator determinism, build-order determinism, data escaping, refresh wiring, update-note self-tests, path-guard self-tests, lock self-tests and generated-index checks passed. Comment baseline remains 1531. |
| CI prerequisite | Repository secret `PII_NAMES` exists; its contents were not read. |
| Clip inventory | 27 feature clips plus the hero, all decoded successfully at 1000 x 1000. All 1.3.0 image targets in the gallery and feature pages exist locally. The shared review helper searched the wrong assets directory; a scratch copy corrected its lookup to `docs/features` and treated `hero` as `assets/demo.webp`, reporting 28/28 clips. No shared skill was edited. |
| Visual inspection | Inspected midpoint frames from all 27 feature clips as three contact sheets. The shelves, reader, builder controls, feature captions and parent-tags checkbox were visible. This is a still-frame review, not a replay of every animation. |
| Closing-card duration | Decoding all three stored frames of `close.webp` and summing their durations gives exactly 5000 ms, matching the 5-second storyboard act. The earlier 3.4-second audit concern does not reproduce with the encoded frame durations. |
| Full suite / local dry run / final CI dry run | Pending. The historical pass rows below must not be read as a pass for the resumed candidate. |

## September preparation and verification

## What was run

| gate | result |
|---|---|
| Range enumerated | `git log --oneline --merges 1.2.0..develop` -> 11 merges, closing `#68 #90 #92 #94 #96 #97 #98 #99 #100 #101 #102`, `Closes #105` on the pane-width follow-up committed straight to `develop`. Every one accounted for in the `## 1.3.0` section, either its own feature/fix bullet or the "For the record" tooling note. |
| Release name | **"Parent Tags"**, the owner's own choice. |
| `## 1.3.0` section | Written from the range. One feature section (`parenttags`, new clip), a "For the record" list covering the five real fixes plus the tooling-only fixes explicitly marked as not shipping, the Ko-fi block. Every image URL pinned to the `1.3.0` tag. |
| Version bump | `manifest.json` 1.2.0 -> 1.3.0. |
| Update note | `plugin/whats-new.md` rewritten for 1.3.0, four bullets, one `> vs-bparenttags` control line (the release's one new control). `build-plugin.mjs` -> `update note for 1.3.0: 4 lines, 1665 bytes, pointing at vs-bparenttags; 5 releases from the CHANGELOG, newest 1.3.0`. |
| Docs repinned | Every `docs/features/*.md`'s own embed and `docs/features.md`'s 27 gallery URLs (26 existing + `parenttags`) moved from `1.2.0` to `1.3.0`; `docs/index.md`'s hero embed likewise. One new gallery entry added: `parenttags`. |
| New feature clip | `parenttags`: new storyboard act (edit the Tags shelf, turn on Only parent tags, save, watch the shelf fold from 74 to 34 books), built from scratch, visually inspected. |
| Every existing clip re-shot | 26 of 26 feature clips, each `1000x1000`, regenerated via `scripts/record-demo.mjs --exact-act`. One recorder-side bug found and fixed while re-shooting (see below); two spot-checked visually (`matchweight`, `sticky`) after the fix, both correct. |
| The hero | Re-recorded: `record-demo.mjs --act hero --width 1000 --height 1000 --hero assets/demo.webp --hero-width 1000`. |
| Recorder bug found and fixed while re-shooting | `matchweight`'s own settle-wait (`matchweightRested`) compared the live margin against the nominal `--spine-air-match` value with no `--air-k` ration factor, so it timed out ("the ladder never settled") the first time the demo vault's People shelf happened to ration a row -- the exact class of gap `github#90`'s row-air-rationing feature introduced and `github#96` already fixed in `scripts/smoke.mjs`'s own equivalent check. Fixed the same way: `want = base * ration`. Not filed as a separate issue; recorder-only, fixed in the same commit as the release housekeeping. |
| `npm run lint` | 0 errors, 0 warnings. |
| `check-pii` | clean (206 files, 6 names, 5 patterns). |
| `check-scope` | clean (552 css rules, 624 css selectors, 79 ids, 128 prefixed classes, 75 id lookups, 19 shipped files with no invisible characters, 28 negative controls caught). |
| `check-network` | clean (18 files, 2 built artifacts). |
| `check-comments` | clean; baseline held at exactly **1531** across the whole session (including after committing the pre-existing mirror-folder WIP with its comment folded to a pointer line). |
| `check-generator-determinism` | clean -- 4,940 notes in 17 folders, byte-identical at the same `--end`. |
| `check-build-order-determinism` | clean. |
| `code-map.mjs --check` | current, regenerated after every code change (three times over the session as new content added new pointer references). |
| `node scripts/smoke.mjs` | **162/162, stamped tree `67431be` as passed 2 times in a row** (final tree, after the verification-record commit moved the tree once more). Not a clean path to get there -- see the environmental-flakiness note below. |
| `release.ps1 1.3.0 -DryRun -AllowAnyBranch` | Reached the tag step (`-DryRun: stopping before the tag and the push`). Trusted the existing stamp rather than re-running the suite. Build succeeded, lint clean, release notes rendered correctly from the CHANGELOG. `-AllowAnyBranch` is required for a dry run taken on the release branch itself, not `main` -- confirmed against the script's own self-test (`-SelfTest` case `a branch other than main`). |
| `update-note-check.mjs --out` | 33/33 passed; the strip itself was rendered and looked at (`01-strip-up.png`), not just measured -- title, four bullets and the `1.3.0`/Feature gallery links all correct. |
| `release.yml` dry run on `release/1.3.0` | Green (run `36304102110`). Three files attested, no Release created (`Create the release, or re-upload over it` step correctly skipped off `main`). |
| SHA-256s (from the dry run) | `main.js` `07cb9b40864108ca5cbdd1e663d1da8689087b87b66117cd9c046f8df4c07d6c` &middot; `manifest.json` `22e577313053cfbfca33cc33c6aab3475ae6542ecf5cd045594a432788c47992` &middot; `styles.css` `279aa9ff1d0ad636d8e13d75ff7cc7771ff3c328a95876926efac6003e83aa69` |
| Attestation (dry run) | https://github.com/luke321/vault-shelf/attestations/50521514 -- a real attestation for bytes that were never published, per `releasing.md`'s own note that a dry run's attestation is not a substitute for the tag run. |
| `gh attestation verify main.js` | TBD (after the real tag run) |
| Environmental flakiness during suite verification | The machine was heavily loaded partway through this release (confirmed by the owner: "pc was maxxed out"). Symptoms while it was: a spine measured 24x132px against the normal 44x132px, `--shot`'s CDP `Page.captureScreenshot` timed out at 10s though the recorder's own CDP frame capture worked fine minutes earlier, and the same "rung climb" check failed identically on a disposable `develop` worktree with zero code changes -- proving it wasn't this branch. Runs went 152/162 -> 153/162 (different checks failing each time, inflated durations) -> 118/162 (real Chrome GCM/updater errors visible) -> 160/162 x2 -> **162/162 x2** as load dropped. No product or test code was changed to chase this; it resolved on its own once the machine wasn't maxed out. Separately, a throwaway comparison worktree's `node_modules` was junctioned to the primary checkout's for speed, and removing that worktree afterward followed the junction and deleted the primary checkout's real `node_modules` contents -- caught immediately (`esbuild` missing), fixed with `npm ci`, confirmed harmless (git-ignored, no tracked files touched). |

## What was looked at, not just measured

- `parenttags.webp`: three frames inspected — the crowded 74-book Tags shelf before, the checkbox mid-click with the scrolled builder sheet, and the folded 34-book shelf after Save. The fold reads correctly (`garden` at 1,441 notes, `idea` at 708, `project` at 1,325, etc.).
- `matchweight.webp` (post-fix): Mira Vance drawn far forward as the strongest match, weaker matches receding, consistent with the feature.
- `sticky.webp`: the `#garden` tag book open with fore-edge flags visible, the highlighted `#garden` in prose — unaffected by this release's changes, confirmed still correct after the mechanical re-record.

## What changed since the reference, and what did not

- Tags shelf, `parentTagsOnly` off vs on (fixture `vault-945ece0a`): 74 books -> 34 books, 4,940 notes either way.
- Search-row overflow (`github#90`): Encyclopedia worst overflow 352px -> 0px (unchanged from the number already recorded when the fix landed on `develop`; re-confirmed by the untouched full-suite run below).
- Builder checkbox row at a 480px pane inside a 1180px window (`github#98`/`#105`): 168px overflow in leather -> 0px.
- Refresh leak with a book open, 20 refreshes (`github#99`): 269,058 DOM nodes / 90,387 listeners -> holds at 13,704 / 4,165 regardless of refresh count.

## What was NOT verified

- The plugin's settings-tab half of `github#100` and the `renderNote` half of `github#99` in a real, live Obsidian session — both were verified through the headless real-bundle harness (`refresh-check.mjs`), not a live app.
- The `docs/demo/` interactive walkthrough site was not rebuilt this release, matching the precedent set at 1.2.0.
- No real vault was used anywhere in this release's verification; no live Obsidian session was driven for the clips.
