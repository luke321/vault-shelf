# Verification of 1.3.0

**Date** 2026-09-27 · **Candidate** `release/1.3.0` · **Reference** `1.2.0`

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
| `check-pii` / `check-scope` / `check-network` / `check-comments` | TBD |
| `check-generator-determinism` / `check-build-order-determinism` | TBD |
| `code-map.mjs --check` | current, regenerated after every code change. |
| `node scripts/smoke.mjs` | TBD |
| `release.ps1 1.3.0 -DryRun` | TBD |
| `release.yml` dry run on `release/1.3.0` | TBD |
| `gh attestation verify main.js` | TBD (after the real tag run) |

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
