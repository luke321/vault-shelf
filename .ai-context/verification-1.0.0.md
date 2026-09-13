# Verification of 1.0.0

**Date** 2026-09-13 · **Candidate** `release/1.0.0`, currently at `7949233` (product source unchanged since `a8cdd21`), including the counter, current peek data and future recorder updates. The user retains the approved recordings and authorizes the requested counter copy.
Approved preparation was committed at `0dbce28` (tree `dcb31c0581875eed089dfd08812b2a0d61a84d8f`).
The orchestrator records the final updated tree when running the remaining gates. **Reference**: first published release; no earlier tag exists. The
abandoned 0.1.0 preparation record remains historical evidence, not a published release.

The user changed the first release to **1.0.0 — Vault Shelf** during preparation. Earlier
0.9.0 build, installation and screenshot evidence below retains its actual version and paths;
it does not establish verification of the final 1.0.0 candidate.

## What was run

| Gate | Result |
|---|---|
| Plugin build | `node scripts/build-plugin.mjs` passed after the version decision: update note 1.0.0, five bullets, one CHANGELOG release. Earlier preparation builds named 0.9.0. The current `8afede4` build with revised entries/visits wording passes: five bullets, one release. The revised-wording actual strip run passes 33/33 after the fixture readiness repair below. |
| README separation | `rg -ni 'vault[- ]graph' README.md` returned no matches after removing sibling-project links and comparisons. |
| Documentation structure | Local check matched 24 recorder feature acts to 24 recipes and 24 gallery clips, validated regeneration commands and local links (including Jekyll's `.md` → `.html` output), and found no obsolete defaults/control/fixture claims. Feature-file completion is checked separately below. |
| Standalone demo refresh | Generated sample rebuilt with the shared fixture's end date and seed: `--notes 1200 --end 2026-09-11 --seed 20260909`, then the current exporter with `--demo`. It holds 1,242 notes before and after. The first refresh aligned sample dates because product code/styles already matched then. After the search merge, it was rebuilt again with the actual new search index and match reasons: 1,687,448 bytes, four scripts parse, current source included, automatic overrides empty, PII patterns and network gate pass. |
| Real Obsidian update note | Actual 1.0.0 run passed 33/33 after harness-only fix `2fea267`, merged at `6e7d00c`. The first run was 28/31: its computed previous minor incorrectly equalled 1.0.0, so three scenarios were not upgrades. The corrected major predecessor exercises real upgrade, first install, patch, already-seen and stale-note cases. Log: `dist/update-strip-1.0.0.log`; screenshots 01-04: `dist/update-strip-1.0.0/`. Earlier 0.9.0 evidence passed 31/31. |
| Update-note cleanup | Worker reports zero pulsing controls after dismissal and reopening, zero plugin console errors, and released screen-left lock. Targeted syntax and ESLint checks passed. |
| Search integration | Orchestrator reports 15/15 targeted checks plus lint and build passed on merge `e67aa0d`, and visually inspected its query screenshot. This covers catalogue scope, shared book search and match explanations; final release-tree gates remain separate. |
| First matching contents and age wear | Merged at `8251bd2` and `033d05b`. Combined targeted checks passed 2/2. The first-finding test now waits for the selected row to become visible and its smooth scroll to settle; the measured long scroll took 1,694 ms. This repaired a fixed-wait race without changing product behavior. Age worker passed five targeted checks, core boundary/parity/immutability tests and static gates; old 2015 books show level 3 with zero saved opens, 2026 books level 0, with unchanged geometry and bindings. |
| Manage geometry across looks | Merged at `f32a376`, with the worker's three targeted checks passing 3/3: Manage geometry, four-state look invariance and colour/visibility persistence. At 390px and 320px, all looks keep the same control rows. The original look check measured 4,358 elements: 0 moved, 0 resized, 0 missing. Root visually reviewed the narrow Manage screenshot. No full-suite claim is made. |
| Installed candidate | Current product `f32a376` built with 1.0.0 metadata is installed in the owner's vault: all three source/target SHA-256 values match, and `data.json` is unchanged. Backup: OS temp directory `vault-shelf-install-before-1.0.0-20260913-065842`. The owner's Obsidian was closed, so no reload of that session is claimed. The separate real-Obsidian harness verified the strip above. Earlier 0.9.0 CLI reload remains historical evidence. |
| Lint, typecheck and static release gates | Pending final candidate. Earlier product-branch passes are not substituted for this tree. |
| Full invariant suite / stamp | The first release dry run at `0dbce28` passed 130/133. Manual plaque membership, Reading baseline measurement and index cleanup failed and were repaired below. After repairs and the counter merge, the full suite passed **135/135 in 86 seconds** at `8afede4`, tree `553ea4963488ca1a6e0bd68c0631e792826184bf` (`dist/post-counter-full-suite.log`). This is green 1/2 for that source tree; the final docs/media tree must earn its own stamp. Current stamp policy requires two consecutive full passes; no preparation-worker full run is claimed. |
| `release.ps1 1.0.0 -DryRun -AllowAnyBranch` | Initial run stopped on the 130/133 suite result (`dist/release-dryrun-1.0.0.log`). The user retained approved media and instructed continuation after the requested counter change. Updated strip verification and the next dry run measure the final committed tree. |
| `release.yml` branch dry run | Pending push and workflow. Previous private-repository attestation failure is historical; current PUBLIC repository status must be validated by this run. |
| Published assets and attestation verification | Pending tag workflow. Record run URL, three SHA-256 values and attestation verification here after publication. |

## What was looked at

The user approved the square hero v3 on 2026-09-13. It shows the library scroll, opening a
book, index navigation, reading and leaving a ribbon, returning to the top, collecting a
favourite, creating a book, changing its binding and colour, then changing a plaque's run.
Local review: `dist/hero-review-v3.html`; measured metadata: `dist/hero-verification-v3.json`.

| Approved hero | Evidence |
|---|---|
| WebP | 1000 × 1000, 398 frames, 68 seconds, 3,622,498 bytes |
| WebP SHA-256 | `374625216bb606e1b6c7e60cc5c029fec4a28971c8696abbc6a40d46c43adbf7` |
| MP4 | 1000 × 1000, 1,632 frames, 24 fps, 68 seconds, 4,451,498 bytes |
| MP4 SHA-256 | `20be6c1e1377888b4d3c839ffbf0bb4198c9b8d7084ef24f97cb8c5e42581dc5` |

The orchestrator inspected the actual 1.0.0 Obsidian update strip from its first run; the
corrected 33/33 run supplies fresh screenshots at `dist/update-strip-1.0.0/01-strip-up.png`
through `04-pulse.png`. The orchestrator re-inspected the successful run's `01-strip-up.png`; the user approved the strip on 2026-09-13. Earlier
0.9.0 screenshots and their Manage pulse review remain historical evidence.

The demo worker captured and inspected `dist/demo-0.9.0-visual.png` at 1000 × 1000 in a
temporary headless Chrome before the search merge: seeded Favourites, controls, varied leather bindings, counts and
decade plaques rendered cleanly, with 231 spines and zero console errors. The browser closed
after capture. This screenshot predates `e67aa0d`; the refreshed sample's new search behaviour
still needs visual review. Neither screenshot is a deployment check.

The current candidate is **hero v5**, approved by the user on 2026-09-13. It follows the user's correction:
the pointer stays offscreen through the opening hold and scroll, then enters smoothly for the
first click. The approach starts at 6.15 seconds and the first click is at 7 seconds. Of 1,632
MP4 frames, 152 intentionally keep the pointer offscreen and 1,480 show it. This is not an
all-frames-visible claim. Metadata: `dist/hero-v5-verification.json`; review: `dist/hero-review-v5.html`.

| Candidate hero v5 | Evidence |
|---|---|
| WebP | 1000 × 1000, 365 frames, 68 seconds, 3,585,346 bytes |
| WebP SHA-256 | `752825f3881781810c350cb0c91038194fe98d2b74142788a93d51253afe778e` |
| MP4 | 1000 × 1000, 1,632 frames, 24 fps, 68 seconds, 4,442,514 bytes |
| MP4 SHA-256 | `ef49cd33453b615e9e4efd4dbe5cfada3b885a3de7c4513c1d280ac267e6e5d8` |

All **24 fresh feature clips** are present at 1000 × 1000, totaling 321 seconds and
14,050,604 WebP bytes. Each recipe records its measured frames, duration and byte size;
all 24 files match `dist/feature-verification.json`. Full media review:
`dist/clip-review.html`; concatenated MP4: `dist/Vault Shelf 1.0.0 - Full Walkthrough.mp4`.
The user approved the complete feature set and hero v5 on 2026-09-13. The approved v5 WebP
is now promoted to `assets/demo.webp`; its SHA-256 matches the candidate evidence above.

## Release contents and docs

The full range through `7949233` contains 108 first-parent entries and 59 merge commits.
All are mapped to the CHANGELOG feature/record sections or an internal/superseded disposition
in the local `dist/release-range-audit.md`. Five merges occur outside the first-parent line.

The added search range contains #58 and #13: titles, printed cover names and declared tags,
people and folders are searched; bodies and file paths are excluded. The reader marks matching
rows, shows match counts and highlights matching title/metadata or names the matching cover.
Its own search follows the same rule. Opening under an active query reveals the first matching
contents row while preserving the selected note on the right. Age wear uses the newest note
and one-, three- and seven-year floors, without inventing saved opening history. The former body-only-hit/suggestion mismatch is resolved.

README and the docs gallery now describe six fresh shelves (Favourites plus five automatic
shelves), fourteen colours, six bindings, the sole offered Leather look and current reader
controls. The CHANGELOG section is the release body; its image URLs are pinned to 1.0.0.
Feature pages supply regeneration recipes and recording metadata. Local recipe and gallery
links passed the documentation check; all 24 feature files are now present and match their measured metadata.

## What is not verified yet


- Final candidate gates, suite stamp, local release rehearsal and CI rehearsal.
- Public release asset hashes, provenance attestations and download/install verification.
- Mobile Obsidian behaviour. Square desktop recordings do not establish mobile support.
- Post-search-merge demo visual review and live-site deployment of the sample and prepared docs.

The wheel gesture has no explicit screen-reader end-of-book announcement. It is not silently
described as verified accessibility coverage. The earlier body-only search limitation was
resolved by the added search range and is no longer listed as current behaviour.

Current demo rebuilt after `f32a376` from the same generated 1,242-note cut (`--notes 1200 --end 2026-09-11 --seed 20260909`): 1,689,693 bytes, four inline scripts parse, exact current page and shared geometry CSS included. `dist/demo-preview-1.0.0.html` is byte-identical. No browser was opened by the docs worker; current visual review remains separate.

The full walkthrough puts hero v5 first, followed by all 24 feature clips: **389 seconds (6m29s)**, 1000 x 1000, 24 fps, 9,336 frames and 24,331,631 bytes. The feature clips alone total 321 seconds; their pointer is visible in all 7,704 feature frames. Hero visibility has the intentional opening exception recorded above. `dist/full-walkthrough-verification.json` lists all 25 acts in order. The user approved this full walkthrough with the feature set on 2026-09-13.

The orchestrator inspected both 12-clip contact sheets covering all 24 features and found the
set visually coherent, then opened the 25/25 clip-review page on hero v5. This review is
followed by the owner's explicit approval of the complete media, strip and release body on
2026-09-13: "approved, push release branch and continue". Release gates and publishing remain pending.

## Release-gate follow-up and internal opening metadata

- Manual plaque merge `5ae2f13`: 5/5 targeted checks pass. A moved one-note run opens that one note; automatic plaques, ribbons, contents order and age behavior remain covered.
- Reading merge `e44298a`: 1/1 targeted check passes, retaining tight packing and rejecting real 3px layout shifts or invalid lifts. The product was unchanged.
- Index merge `f3fc294`: 2/2 targeted checks pass after waiting for viewport restoration and the pending room measurement. The product was unchanged.
- Last-opened merge `8d52c82`, source `4190089`: 3/3 targeted checks pass. Actual source-book opens save an ISO UTC timestamp; missing entries mean `never`, with no invented history. Legacy counts stay intact, favourites share source metadata, and turns/rebuilds do not restamp it. This is internal persistence; approved release prose and UI remain unchanged.

The demo was refreshed from current source `8d52c82` using the same 1,242-note generated cut: 1,690,661 bytes, four inline scripts parse, exact current page/shared CSS included, and the stable preview copy is byte-identical. It now includes the manual plaque fix and last-opened metadata. No UI or approved capture changed: manual split-run repair does not affect the recorded default plaques; Reading/index fixes are harness-only; timestamps add persistence without a visible control. The approved hero SHA-256 remains `752825f3881781810c350cb0c91038194fe98d2b74142788a93d51253afe778e`.

Full merged-tree release gates remain pending. The counter request is implemented at `8afede4`: existing note entries count once, new entries and book visits add activity.

## Counter follow-up: current evidence and retained recordings

`8afede4` adds distinct note-entry history per source address while preserving legacy visit
counts. Existing notes seed once; new IDs and actual book visits add activity. Rebuilds,
filters and removal/reappearance do not add the same entry again. Last-opened stays `never`
until a real visit. The targeted worker run passed 5/5; the merged full suite passed 135/135.

The orchestrator installed and reloaded the plugin against the owner's existing vault. Its
646 cached notes produced 407 current book/plaque addresses and 417 history entries including
10 legacy addresses. Seed totals were 90 earlier visits plus 6,934 per-book note entries =
7,024, with all 417 last-opened values initially `never`. Two later visits produced two valid
timestamps, leaving 415 `never`. Unrelated settings stayed deeply equal at seeding; two
synchronous rebuilds left all three history maps unchanged. Backup is in the OS temp directory
`vault-shelf-before-note-counters-20260913-075258`; no private vault data was copied into git.

The current generated demo remains 1,242 notes and is 1,693,161 bytes. Four scripts parse;
exact current page/CSS, counter reconciliation and timestamps are included, and the stable
preview copy is identical. Books with many notes now start visibly more worn. On 2026-09-13 the user explicitly said
"you don't need to re record" and then "continue with release process". The approved hero v5,
24 feature clips and full walkthrough are retained. Their original capture measurements and
source provenance remain valid; they are not claimed as newly captured against the counter
change. The requested counter copy and continued release are authorized without a new review step.

## Final source refresh and recording waiver

The current demo at `a8cdd21` contains 1,242 generated notes and 1,693,300 bytes. Four
inline scripts parse; exact current page/CSS includes the live source-counter peek fix, and
`dist/demo-preview-1.0.0.html` matches byte for byte. Plugin 1.0.0 builds with the existing
five updated bullets. No browser or recording was opened by the docs worker.

The explicit 2026-09-13 instruction to retain recordings overrides the usual release
re-recording step for the counter appearance change. Hero v5, all 24 features and the 389-second
full walkthrough remain approved. Future recorder recipes were updated at `a8cdd21`; no
new capture is required. The final update-strip harness passes 33/33; final committed-tree release gates remain pending.

The orchestrator inspected `dist/update-strip-1.0.0-counter/01-strip-up.png`: five clear
bullets include entries, visits and last opened, with Got it and correct release/gallery links.
That visually inspected run passed 32/33. The remaining byte-exact check sampled while
the throwaway vault metadata was still indexing: histories legitimately grew from 243 to
247 books and 161 note ledgers changed. Harness fix `abbfa28`, merged as `7949233`, now waits
for all 4,938 Markdown metadata entries and stable valid JSON before the already-seen check.
The worker's actual Obsidian rerun passes **33/33**, retaining the byte-exact unchanged-settings
guard. Its Obsidian instance closed and screen lock was released. This green run and the
orchestrator's current-copy visual inspection above are separate evidence; no new approval
or recording is required.
