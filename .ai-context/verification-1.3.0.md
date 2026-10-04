# Verification of 1.3.0

**Date** 2026-10-04 · **Candidate** `release/1.3.0` · **Reference** `1.2.0`

## The tag run, 2026-10-04

The maintainer reviewed the release page, the five release-branch fixes, the re-shot clips
and the update strip, and gave the go-ahead. The known `css-clip-path` lint warnings
(`design/0036`) were raised again and kept.

| Step | Result |
|---|---|
| Certified tree | `6072bce`, two complete headed greens (169/169), epoch 4, commit `b634ad7` |
| `release.yml` dry run on `release/1.3.0` | run `37200179823`, green, no Release created; attestation https://github.com/luke321/vault-shelf/attestations/52574319 |
| `develop` | `release/1.3.0` merged at `8243000`; the pre-push hook trusted the stamp and skipped the suite |
| `main` | PR #116 (`main accepts develop or hotfix`, both `quality gates`, `close the issues this push fixes`: all green), merged at `1705c9c`, tree `6072bce` |
| Tag | `release.ps1 1.3.0` on `main`: stamp trusted, tag `1.3.0` created and pushed alone |
| Publish | run `37202345602`, green: Release "1.3.0 - Parent Tags", not a draft, three assets |
| SHA-256 (published = dry run = local build) | `main.js` `17f9f58a6fc53eb5df5f0c3e4bf4bd7cf41a96a00a8315ddfdf13c13b6f9dbee` · `manifest.json` `22e577313053cfbfca33cc33c6aab3475ae6542ecf5cd045594a432788c47992` · `styles.css` `e7d83dfd43374d289e015c1d1684d884f622da9bad4cb0faaff6cbeac1d9c1ec` |
| Attestation | https://github.com/luke321/vault-shelf/attestations/52579123; `gh attestation verify main.js` on the downloaded asset exits 0 |
| Issues | #90, #97, #98, #99, #100, #101, #102 and #114 closed by the push to `develop` |

## Review fixes on 2026-10-04

A review of the `1.2.0..fcd5695` range for smaller bugs found four, fixed here on the release
branch, and a fifth, filed as `github#114` and merged in from its own branch. **Product sources changed** (`src/page.js`, `plugin/main.js`), so the built hashes
recorded below are superseded and certification restarts at **0/2**.

| Finding | Fix | Measured |
|---|---|---|
| A typed setting rebuilt every view per keystroke (`github#100`), so a half-typed people or date property could move or close the open book | Text fields hand settings to the views 800ms after the last keystroke, or when the tab closes; toggles apply at once | `refresh-check --wiring-only` 13/13: six keystrokes -> 0 redraws while typing, 1 after; tab close flushes once; toggle redraws at once |
| `adopt()` redrew twice per change | `handle.setSettings(next, data)` takes both, one `refresh()` | same harness: one `setSettings(+data)` call per adopt |
| `Show all` never reached an open library, whose next save re-hid the shelves | it calls `adoptViews()` | by reading; no live Obsidian session |
| Closing the reader left the last note's renderer loaded (`github#114`, merged from its own branch) | `closeReader()` and the no-note branch call the host's `releaseNote()` | `refresh-check` 26/26, red with the call removed; `teardown-check` clean; the `reader` smoke checks pass |
| A plus with no room on a hand-arranged shelf's last row was drawn on that row anyway (`design/0020`) | the full row is pushed and the plus gets a row of its own | new check, red on the old code (1188-1176px: 1-13px past the room, plus never alone), green after (alone from 1192px, inside the room at all 53 widths) |

Focused headed runs, all green: the new check plus both existing plus checks 3/3, the air
check 1/1, `row` 14/14, the packing golden 2/2, `settings` 3/3; `refresh-check` 22/22 and
`teardown-check` clean in a browser. Lint, typecheck, comments (baseline 1531), scope,
network, PII and `code-map --check` pass.

**Every clip re-shot from the final tree** (`8d0554d`), per the sister repo's re-record-by-
default rule (`github#115`): all **27 feature clips and the hero**, each from its own page's
regeneration command, headed on the guard's right display, one take at a time under the
`record` lock. Source takes are **1000 x 1000 at 24 fps**, **364 s** of features plus the
hero's **74 s** (**438 s**, the same total as the previous refresh); `room` came out
byte-identical, a still card. Start, middle and end stills of all 28 (**84 frames**) were
inspected on five contact sheets: leather throughout, every caption present, no stuck sheet,
blank frame or stray window. Each page's metadata was rewritten from its WebP's own RIFF
chunks (frame count, timing, canvas, bytes). The previous 2/2 stamp was on the tree before
these clips, so certification restarts on the tree that carries them.

## Headed flake correction on 2026-10-04

The authorized complete run on `17a65be` exited **1**, passing **163/165**. The next forward
gesture arrived before Chrome cleared its spent latch; cyber scrolling missed **121** frames
against the **30** budget. An isolated green rerun was insufficient: a predecessor replay
reproduced the gesture failure at **87/88**. A later 91-check replay exposed a frame sample
with only one timestamp, caused by starting the stopwatch before the first callback.

`decisions/0021` records the fixes and evidence. Gesture checks run serially and wait for the
actual browser signal. Benchmarks start in separate browsers after font/image decoding;
their measured clock begins on the first callback. Missing/stalled callbacks and unusable
samples fail explicitly. Later gaps count, thresholds stay unchanged, and no product source
or CSS was changed. Certificate epoch 4 supersedes earlier instruments.

| Measurement | Result |
|---|---|
| Focused gesture/readiness/frame checks | 9/9; library missed frames leather/modern/cyber 21/0/19, reader 0/0/0 |
| Original predecessor context plus regression controls | 92/92 in 119s; library 12/0/18 against 30, expensive control 104; reader 0/0/5 against 14 |
| Final shared reader clock and sampler controls | 2/2 in 21s; reader 0/0/0 against 14, turns 4/3/3ms; both scheduler watchdogs refused |
| Delayed first callback / later stall | 11 samples over 167ms after a 350ms first delay; later 817ms gap counted 48 missed frames |
| Refusal controls | Stuck gesture state, broken/stuck image decode and missing first/later callbacks refused |
| Visual sampling | Library and reader screenshots inspected; no new defect observed |
| Final console gates | 19/19 passed: build, zero-warning lint/typecheck, indexes, CI parity, stamp/isolation/release/fixture controls, comments, PII, scope, network, both determinism checks, escaping, refresh wiring, update-note, path guards and locks |

Both CI workflows and the push hook carry the same **16** static gates. The stamp controls
pass **59/59**, release guard cases **16/16**, fixture controls **5/5**, refresh wiring
**10/10**, update-note **51/51**, path guards **21/21** and lock controls **34/34**.
Rebuilt `main.js`, `manifest.json` and `styles.css` retain the hashes recorded below.

Scratch receipts are under `%TEMP%`: `vault-shelf-release-headed-fix.*`,
`vault-shelf-release-flake-context.*` and `vault-shelf-release-reader-clock.timings.json`.
The context replay uses the original lane's selected checks and viewport widths, one Chrome
at a time; it is not a complete suite. The final reader clock adjustment is measured separately.

**Release status:** no new complete suite has run since these fixes. Certification is **0/2**;
the next complete headed run needs separate authorization. Push, merge-down, tag and
publication remain pending. Earlier sections below retain the pre-fix release history.

## Complete headed clip refresh on 2026-10-03/04

All **27 feature clips and the hero** were re-recorded from `a8c103d`, after the approved
#111/#112 integration. The source viewport is **1000 x 1000**, at **24 fps**; all declared
durations match the MP4 frame counts, totaling **438 seconds / 10,512 frames**. Animated
WebP timelines retain the **8 fps** timebase and matching durations; static cards can
coalesce to a still. The hero is **74 seconds / 1,776 source frames**, **4,093,090 bytes**.
Each job obtained and released the actual machine record hold, opened visibly on the
guard-approved right display, and verified its window bounds. Foreign jobs caused two
deferrals before capture; their locks and browsers were left untouched. Recording progress
was checkpointed and resumed from completed acts.

The `review-clips` inventory reports **28/28 clips** and **27/28 feature pages**; the hero is
documented by the README, not a separate feature page. Its legacy lookup was corrected in
a scratch copy to include `docs/features` and the hero; the shared skill was not edited.
The local release review uses the Legion theme, references actual files, and was not opened
unasked. The owner explicitly requested the recording scratchpad folder, which was opened.

**Visual review:** start, middle and end frames of every source take, plus two additional
binding-preview frames (**86 samples**), were inspected across ten contact sheets. The
review document itself was also rendered and inspected. Shelf shapes, reader contents and
edge tabs, dialogs, captions and visible pointers showed no new defects in these samples.
This is visual sampling, not a claim of watching every complete animation. Each feature's
metadata now records its actual date, dimensions, duration, animation-frame count and bytes;
the regeneration instructions and template specify headed Chrome.

The merged release self-test contract passes **21/21**: real 1.3.0 and newer synthetic
metadata each reach all 16 cases plus five consumer assertions; an injected assertion
failure exits **1** after tag-removal output. Build, lint/core typecheck and generated
indexes also pass. These console/focused checks do not certify the full suite.

| Latest release step | Status |
|---|---|
| #110, #111 and #112 integration, notes, version and name | Complete. |
| All 28 recordings and sampled visual review | Complete; metadata refreshed. |
| Final static gates and clean recording commit | All 18 console gates pass; all refreshed assets and metadata are committed on the release branch. |
| Two consecutive complete headed passes and local dry run | Pending separate full-suite authorization. |
| Release push and CI dry run | Pending separate push authorization. |
| Release/develop/main integration, tag and publication | Pending; no 1.3.0 tag exists. |

The final static pass includes build, zero-error lint/core typecheck, current indexes,
all 15 CI-parity gates, 59 certificate controls, all 16 release guard cases, five geometry
fixture controls, PII/scope/network/comment checks (1531/1531), both determinism checks,
data escaping, refresh wiring (10/10), update-note (51/51), path guards (21/21) and locks
(34/34). Rebuilt hashes remain `07cb9b40864108ca5cbdd1e663d1da8689087b87b66117cd9c046f8df4c07d6c`
for `main.js`, `22e577313053cfbfca33cc33c6aab3475ae6542ecf5cd045594a432788c47992`
for `manifest.json`, and `e7d83dfd43374d289e015c1d1684d884f622da9bad4cb0faaff6cbeac1d9c1ec`
for `styles.css`. No corrected complete headed suite or real release dry run has run.

## Recorder and release guard corrections included on 2026-10-03

`github#111` at `8c92ae3` and `github#112` at `362f9a9` were integrated into
`develop` at `594fa95` and `7a712c0`, respectively, then included in this release
by `ca5a2d1`. Both workers were measured idle before their Orca cleanup, and both
tips remain pinned by keep refs. The release merge conflicted only in the generated
code index, regenerated from the final source. The release-specific parent-tags act
and search-row settling correction remain present.

The recorder's default and explicit headed runs use the guard-approved monitor and
one shared record hold through build, capture and asynchronous encoding. Failure and
Ctrl+C checks left no owned Chrome, CDP listener, profile or frame directory. A controlled
independent browser retained its profile and CDP listener after recorder cleanup.
Twenty console controls passed on the worker and were independently repeated at its
pinned commit. Worker captures measured 120 frames / 5 seconds / 1440 x 900 and
168 frames / 7 seconds / 1080 x 1080, both at 24 fps; a moving 8 fps hero slice lasted
3 seconds. These are focused tooling measurements, not full-suite certification.

The release self-test copies candidate manifest, changelog and update note together.
Failed assertions throw and map to an explicit process exit of 1, even after native
tag-deletion output. The worker's 21 regression controls cover current metadata, newer
metadata against older main, and a deliberate assertion failure. Actual release guards
were not weakened. The earlier failed result below remains historical evidence.

| Current release step | Status |
|---|---|
| Include #111 and #112 | Complete at `ca5a2d1`; release body accounts for both. |
| Merged-candidate console checks | All 21 contract checks pass, including current/newer metadata and a failing assertion returning exit 1. |
| Fresh 27 feature clips and hero | Complete as documented in the refresh section above. |
| Two complete headed suite passes and local dry run | Pending separate full-suite authorization. |
| Push, CI dry run, release/develop/main integration, tag and publication | Pending separate authorization. |

## Validation correction included on 2026-10-03

`github#110` at `6da3e3b` was integrated into `develop` by `59bf8ba`, then included in
`release/1.3.0` by `c1a1188`. The only release-merge conflict was the generated code index;
it was regenerated from the final sources. The release body now accounts for #110.
The earlier failure and diagnosis sections below are historical evidence for the preceding
candidates. No corrected full-suite pass is claimed yet.

The index-row check parks the pointer before closing the reader, even on failure. The paint
probe detects an occluding preview before and after its screenshots and restores its query,
look, scroll positions and temporary probes in `finally`. The worker's focused headed checks
passed 3/3; the exact failing pair improved from 1/2 to 2/2. A forced zero clip margin still
fails the original clipping assertions in every look, and injected preview interference
throws a clear precondition failure while restoring the prior state. These measurements
belong to `6da3e3b`; they are not certification of the merged release tree.

The geometry check uses the same generator with `--end 2026-09-24` and a fixed exported
generation day. This reproduced the existing golden before its metadata was changed:
6 shelves, 11 rows, 257 spines, 52 plaques and a 1125px room at 1180 x 900, zero differences
in all three looks. No golden geometry or tolerance was rewritten. The main suite fixture
continues to age and refresh normally. Two fresh geometry builds were byte-identical.

Release and push tooling now invoke the suite headed and require the two-green certificate
after it exits. Epoch 3 invalidates certificates from the earlier instrument. Partial runs
cannot certify a candidate. The worker's stamp/consumer self-tests passed 59/59, fixture
self-tests 5/5 and release guard self-tests 16/16, without a full suite or real release.

| Current release step | Status |
|---|---|
| Include #110 | Complete at `c1a1188`; source/plugin behavior is unchanged by this tooling merge. |
| Static preflight of the merged release | Build, lint/core typecheck, generated indexes, all 15 CI-parity gates, stamp/consumer tests (59/59), geometry fixture tests (5/5), PII, scope, network, comment budget, both determinism checks, data escaping, refresh wiring (10/10), update-note (51/51), path-guard (21/21) and lock (34/34) checks pass. Release guard self-test fails as described below. |
| Rebuilt plugin hashes | `main.js`: `07cb9b40864108ca5cbdd1e663d1da8689087b87b66117cd9c046f8df4c07d6c`; `manifest.json`: `22e577313053cfbfca33cc33c6aab3475ae6542ecf5cd045594a432788c47992`; `styles.css`: `e7d83dfd43374d289e015c1d1684d884f622da9bad4cb0faaff6cbeac1d9c1ec`. Identical to the post-#109 build. |
| Fresh gallery and hero recordings | Pending. The existing recorder hardcodes headless Chrome; #111 prepares the required headed/screen/record-lock correction. |
| Full headed certification | Pending; no complete run is authorized after this correction. |
| Local release dry run | Pending; would run a full suite without an existing certificate. |
| Final CI dry run, integration/main merges, tag and publication | Pending; no new push or tag is authorized. |

### Release guard self-test integration failure

The worker's 16/16 release self-test result on the develop-based #110 branch does not hold
on this release candidate. The isolated clone starts from `origin/main` with manifest 1.2.0,
but copies the release checkout's 1.3.0 update note. Ten early refusal cases pass; the later
passing case and five certificate-consumer cases stop at the update-note mismatch instead
of reaching their intended checks. Five consumer-call/lock assertions also fail.

Despite the `11 FAILED` summary, the external PowerShell process exits 0. Both the printed
results and the process exit were inspected; this is a failed gate. `github#112` prepares
coherent self-test metadata and an unambiguous failure exit, with isolated console checks.
No actual release guards were weakened and no real tag, full suite or push was attempted.

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

The owner confirmed that the five CSS warning categories came from the public Obsidian
community review, superseding the earlier editor-only diagnosis. After the authorized snap,
`github#109` (`d6f0f80`, integrated into `develop` by `c991a3c`) was also brought into this
release candidate. Its only merge conflict was the generated code index, regenerated again.
The official review rules reproduced 23 flagged declarations before and 10 afterward, across
Electron 30 and both conservative desktop target ranges. Four categories are cleared;
the remaining ten `clip-path` declarations preserve ribbon shapes and clipped click regions.
No rule was suppressed and the minimum Obsidian version is unchanged.

The worker's targeted headed smoke checks passed 8/8 plus a 1/1 clean capture check; the
installed Obsidian runtime checks passed 19/19 on 1.13.7. Clean library and reader captures
had zero pixel differences against the baseline. Link borders sit slightly lower than native
underlines; code text now respects the host monospace font. These measurements belong to
`d6f0f80`, whose complete tree matches the `develop` merge, not to a fresh full release run.
Runtime compatibility on the minimum Obsidian version remains unmeasured. The community
page's published score has not yet been rechecked against a released build of these changes.
Touched clips still need review/refresh before publication; the inventory below predates #109.

| Resumed preflight | Result |
|---|---|
| Build before #109 | Successful; all three SHA-256s matched the September dry-run hashes below. These are historical hashes, not the final CSS-fix candidate. |
| Build after #109 | Successful on the release reconciliation `7f3ebac` with the updated release notes. `main.js` and `manifest.json` retain the September hashes; `styles.css` SHA-256 is `e7d83dfd43374d289e015c1d1684d884f622da9bad4cb0faaff6cbeac1d9c1ec`. |
| Official CSS rules after #109 | Re-run after rebuilding: source files and built `styles.css` report only ten `css-clip-path` warnings at Electron 30.0, >=30.0 and >=31.0. No suppressions. Build, lint/core typecheck and whitespace checks passed on this candidate. |
| Lint and core typecheck | 0 errors, 0 warnings. |
| Static gates | CI parity confirms all 14 hook gates exist in both workflows. PII, scope, network, comments, generator determinism, build-order determinism, data escaping, refresh wiring, update-note self-tests, path-guard self-tests, lock self-tests and generated-index checks passed. Comment baseline remains 1531. |
| CI prerequisite | Repository secret `PII_NAMES` exists; its contents were not read. |
| Clip inventory | 27 feature clips plus the hero, all decoded successfully at 1000 x 1000. All 1.3.0 image targets in the gallery and feature pages exist locally. The shared review helper searched the wrong assets directory; a scratch copy corrected its lookup to `docs/features` and treated `hero` as `assets/demo.webp`, reporting 28/28 clips. No shared skill was edited. |
| Visual inspection | Inspected midpoint frames from all 27 feature clips as three contact sheets. The shelves, reader, builder controls, feature captions and parent-tags checkbox were visible. This is a still-frame review, not a replay of every animation. |
| Closing-card duration | Decoding all three stored frames of `close.webp` and summing their durations gives exactly 5000 ms, matching the 5-second storyboard act. The earlier 3.4-second audit concern does not reproduce with the encoded frame durations. |
| Full suite / local dry run / final CI dry run | Full headed run failed 163/165 on `48284f2`; see below. Local release dry run and final CI dry run remain pending. The historical pass rows below must not be read as a pass for the resumed candidate. |

### Full headed validation on 2026-10-03

On the owner's instruction to run, `node scripts/smoke.mjs --headed --jobs 1` exercised
all 165 checks against the generated vault (4,940 notes), on commit `48284f2`, tree
`be0d05be5be56b79f7951bfb33ee8e22f58409fa`. It exited **1**, with **163/165 passing**
in 194 seconds: 113/114 in the first batch and 50/51 in the layout batch. Both suite and
screen-left locks were held; Chrome ran visibly on the free left monitor. All browsers
started by these checks exited and the locks were released.

Two failures keep this candidate unverified:

- `a lifted spine is painted whole, in every look`: a real search match lifted 14px but the
  full-run measurement detected only 5px painted above the track in all three looks. A
  focused rerun passed, measuring 15/14/28px for leather/modern/cyber. Its dependence on
  earlier checks or runtime conditions is unresolved; an isolated pass does not erase the
  full-run failure.
- `the shelves are packed the way the golden snapshot says`: 66 differences against
  `vault.json`, reproduced in the focused rerun. The first reported difference is the first
  Months plaque width, expected 138px versus measured 108px. The snapshots were not updated.

For comparison, the same two focused headed checks were run with `src/` temporarily taken
from pre-#109 commit `d98a1e2`, retaining the same fixture and test harness. That source also
passed the lifted-spine check with the same 15/14/28px measurement and failed the snapshot
check with the same 66 differences and reported values. Thus the snapshot mismatch predates
#109. The clean library and reader captures from the current and baseline probes had zero
changed pixels. The current library capture was visually inspected. Source files were
restored to HEAD afterward and the working tree was verified clean before this record edit.

There is also a release-tooling conflict: `release.ps1` launches the suite without
`--headed`, and `smoke.mjs` treats `--headed` as a reason not to stamp a run. The owner's
headed-test rule was followed by invoking the full suite directly. No release dry run was
claimed, no stamp was forged, and no tag or push was attempted. This conflict needs to be
resolved before a compliant release dry run can certify the candidate.

### Headed rerun and paint-failure diagnosis

The owner requested another full headed run and an explanation of the apparent flake.
On `ee80ffb`, `node scripts/smoke.mjs --headed --jobs 1 --timings <temporary-file>` again
exited **1**, with **163/165 passing**, in 200 seconds. The same two failures reproduced:
the paint check reported 5px in all looks, and the golden comparison reported 66 differences.
The complete output and per-check timings were retained locally.

The paint failure is a reproducible test-order dependency, not evidence of a randomly
clipping spine. A temporary diagnostic replay of the 110 checks through the paint check
failed 109/110 and captured the cause: the `#joinery` hover preview covers the top of the
`#letterpress` spine selected for the paint measurement. The spine begins at y=453.5 and
its track at y=467.5; the preview extends to approximately y=461.9, leaving only about 5px
above the track visible to the pixel comparison. The screenshot was visually inspected.
The spine's geometry and declared clipping margin remain correct.

The minimal reproduction uses the unchanged harness:

```
node scripts/smoke.mjs --headed --jobs 1 --only "clicking a row in the index moves the mark" --only "a lifted spine is painted whole"
```

It fails **1/2**, with the same 5px measurement. The index-row test sends real CDP mouse
press/release events and leaves Chrome's pointer at the click position. Later scrolling
puts a shelf under that pointer and opens a hover preview over the sampled area. The paint
test alone starts without that pointer state and passes. The runner's `atRest` check does
not include the preview among the open overlays it detects.

In a temporary copy of the harness, moving the test pointer to `(0, 0)` with
`Input.dispatchMouseEvent` immediately before the paint check makes that exact pair pass
**2/2**. The measured paint returns to 15/14/28px for leather/modern/cyber; the spine still
lifts 14px, and the existing forced-lift clipping assertions remain active and pass. Product
CSS and test assertions were unchanged. This establishes the cause and a candidate test
isolation correction; the correction has not yet been applied to the repository, and no
corrected full-suite pass is claimed. The 66 snapshot differences and headed-stamp conflict
remain separate release blockers. Diagnostic browsers exited and their locks were released.

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
