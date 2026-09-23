# Verification of 1.1.0

**Date** 2026-09-16 · **Candidate** `release/1.1.0`, cut from `develop` at `709c5f9`, currently at
the commit recorded in the dry-run row below. **Reference tag** `1.0.1`. The range is
`1.0.1..develop`: **19 merges, 73 commits**, closing `#23 #32 #43 #51 #52 #57 #61 #70 #71 #75 #78
#79 #80 #81 #82` and referencing `#69 #76 #77`.

**Nothing below is claimed from memory.** Every row names what was run and what it printed. Steps
10 to 14 of `releasing.md` — the pushes, the pull request, the tag and the post-tag rows — had not
been run when this file was first written, and are recorded below as they happened.

## A finding I got wrong, and the correction

**Withdrawn: "`main` never received 1.0.1".** It did. `origin/main` is `a8d939b`, a merge of
`hotfix/1.0.1` through PR #65, its `manifest.json` reads `1.0.1`, and
`git merge-base --is-ancestor 1.0.1 origin/main` returns true.

The error was mine and it was a method error, not a judgement call: I measured against the **local**
`main` ref, which was stale at `22c1483` with a 1.0.0 manifest, and never against `origin/main`.
`git fetch` updates remote-tracking refs and leaves a local branch exactly where it was, so a local
`main` that has not been checked out for days says nothing about what the remote holds. Every
number in the rest of this file came from a commit or a command output; that one came from a ref I
assumed was current.

Recorded rather than deleted, because the claim reached `verification-1.1.0.md`, PR #86's body and
a published preview before it was caught, and a withdrawn finding that leaves no trace is how the
same mistake gets made twice. **The rule it earns: compare against `origin/<branch>` for anything
about what the remote holds, or fetch and re-read the local ref first.**

## What was run

| Gate | Result |
|---|---|
| Range enumerated | `git log --oneline --merges 1.0.1..develop` → 19 merges, each accounted for in the `## 1.1.0` section. `git diff --stat 1.0.1..develop -- src plugin` → 7 files, 609 insertions, 163 deletions; `src/page.js` alone moved 516 lines, which is why every clip was re-shot rather than a chosen subset. |
| Release name | **"Indices"**, chosen by the owner from four candidates. |
| `## 1.1.0` section | Written from the range, not from the work in hand. Carries the Ko-fi ask required from 1.1.0 on, immediately after the last feature section and before the record (`grep -ci ko-fi CHANGELOG.md` → 1, was 0). Every image URL pinned to the `1.1.0` tag. |
| Version bump | `manifest.json` 1.0.1 → 1.1.0. `package.json` stays `0.0.0`, which is correct for this repo: the plugin manifest is the shipped artifact. |
| Update note | `plugin/whats-new.md` rewritten for 1.1.0, five bullets. No `> ` control line, deliberately: `diff` of the `id="..."` set in `src/page.html` between `1.0.1` and `HEAD` is empty, so this release adds no control of its own, and the file's own rules say to leave the line out. `node scripts/build-plugin.mjs` → `update note for 1.1.0: 5 lines, 1831 bytes; 3 releases from the CHANGELOG, newest 1.1.0`. |
| Docs repinned | 73 URLs across 26 files moved from `1.0.0`/`1.0.1` to `1.1.0`. The `.ai-context/` files naming 1.0.0 were left alone — they are historical records of past releases, not live links. |
| Published demo rebuilt | `decisions/0009`'s own recipe: `make-vault.mjs --notes 1200` then `build-shelf.mjs --demo --out docs/demo/index.html`. 1,243 notes; 1,693,300 B → 1,714,078 B. Confirmed to carry the new work rather than assumed: `grep -c '"number"'` → 15. `check-pii` clean over 194 files, `check-network` clean. This closes the half of `github#83` about the demo. |
| Clips re-shot | **24 of 24**, each by its own `docs/features/<act>.md` command, plus the hero. Verified from the files on disk, not from the runner's exit codes — which was necessary: the driver's `if node … \| tail -3` tested `tail`'s status, so it reported 23/23 ok while `wear.webp` was untouched. `ls --time-style=full-iso` caught it. |
| `github#85`, found by re-shooting | The `wear` act failed at frame 0 of 456: `wear: the old book did not keep its note entries`. **Not a regression** — the scene is byte-identical to `1.0.1`. It asserts a literal `>= 54` note entries for `years/2015`, and the declared vault is eleven years **ending today**, so its oldest year is partial and shrinks as the window slides. Measured on fixture `vault-c1f3a5ca`: span `2015-09-19` → `2026-09-14`, 2015 holds **53** notes across four months, against 150 and 190 for the full years 2016 and 2017. Fixed on this branch by asking the book for its own note count; `wear` then shot clean, its later assertions passing (`1 entry -> 2 -> 3 through two real opens; note IDs unchanged`). |
| Hero | `record-demo.mjs --act hero --fps 24 --width 1000 --height 1000 --hero-width 1000`: 1,632 frames, 68.0s, 4.4 MB MP4, `assets/demo.webp` 3,616 KB. Its own assertions passed: `hero drag verified: encyclopedia/S; Favourites 4 -> 5; source 35 books, 481 notes unchanged`; pointer visible 1,480/1,632 frames with 152 intentional offscreen intro frames. The previous hero was shot 2026-09-15, before `#79` and `#80` merged — both visible in this take. |
| Comment baseline | Ratcheted 1534 → **1532** in its own commit. The merged tree was two under every number any branch measured on its own base: `develop` read 1534, `#79`/`#81`/`#82` each carried 1536 from before `b76f7b5`'s ratchet. `check-comments` fails **under** the baseline as well as over (`decisions/0007`), so this could not have been skipped. |
| Static gates on the merge result | `npm run lint` → `typecheck: ok -- tsc --noEmit clean`, `lint: ok -- 0 errors, 0 warnings`. `check-pii` clean (194 files, 6 names, 5 patterns) · `check-scope` clean (513 css rules, 582 css selectors, 124 prefixed classes, 28 negative controls caught) · `check-network` clean · `check-data-escape` ok · `check-build-order-determinism` clean · `check-generator-determinism` clean · `update-note-selftest` all passed · `refresh-check --wiring-only` 7/7 · `code-map --check` current. |
| Full invariant suite | `node scripts/smoke.mjs` on the merge result before the release branch was cut: **144/144, exit 0, 107s**. |
| `release.ps1 1.1.0 -DryRun -AllowAnyBranch` | Passed on `release/1.1.0`. Lint clean, pre-flight build clean, release notes printed and read back in full, **144/144 in 104s**, `-DryRun: stopping before the tag and the push`. `-AllowAnyBranch` is required because the tag belongs on `main`; this is the branch dry run of `releasing.md` step 9. |
| Stamp | **Not yet stamped.** `suite-stamp: no stamp for tree e6bbda6`, then `tree e6bbda6 is 1/2 green: 1 more green run(s) before it is stamped`. Two consecutive green runs are required, and this tree has one. |
| Update strip in a real Obsidian | `node scripts/update-note-check.mjs` → **33/33 passed**, no console errors from the plugin, `screen-left` released. Shots written: `01-strip-up.png`, `02-dismissed.png`, `03-chain.png`, `04-pulse.png`. |

## What was looked at

Numbers cannot see, so four frames were pulled from the new takes and read, and the rendered strip
with them.

| Looked at | What it showed |
|---|---|
| `contentsorder` at 11.5s | Number mode live: the edge index reads `0, 3, 7, 12, 24, 42, 99, 1000` — sorted as numbers, not as characters, which is `github#70`'s whole claim. |
| `contentsorder` at 6s | Date mode, year tabs `2015…2018, 2020…2026`. **2019 is absent by design** — the declared 760-day hole, not a dropped book. |
| `index` at 6s | `Years · 2026` drilled into `Mar` and its days, which is `github#32`'s "a digits volume opens into its months and days". |
| `hero` at 20s | Reading, Favourites, Encyclopedia and Years. Encyclopedia reports **35 books · 4939 notes** and Years **12 books · 4939 notes** — the unique-membership law legible on the page, the same note counted once per shelf however many books hold it. |
| `01-strip-up.png` | *What's new in Vault Shelf 1.1*, links `1.1.0` and *Feature gallery*, five bullets matching `whats-new.md`, a *Got it* button, and the library beneath it undisturbed. |

One thing was queried by eye and answered by measurement rather than by argument: a tab below `2026`
appeared to read `2022-` and looked clipped. The suite's own index check reports `widest label
"2022·" at 36px`, with `0 clipped, 0 outside the spread, 0 with the label cropped` — it is a real
label, correctly drawn.

## A gap in the tooling, found here

`releasing.md` step 6 says the `review-clips` skill confirms the recording step "rather than
assumed". It does not, in this repository: the skill looks for clips under `assets\features\` and
`assets\`, which is the sister repo's layout, while this repo keeps them in `docs\features\`. Run
against a complete, freshly re-shot set it reported **`clips 0/25 present`** and listed all 25 as
missing, while finding 24 of 25 pages. The looking above was therefore done directly. The skill
wants teaching this repo's layout before the next release leans on it.

## Steps 10 to 14, as they happened

| Step | Result |
|---|---|
| 10 — push `release/1.1.0` | Pushed. The branch `release.yml` dry run **failed first**, and correctly: `PII_NAMES` was not set on a PUBLIC repo, so `github#82`'s new gate refused rather than letting `check-pii` degrade to patterns-only and exit 0. Its first real run caught the thing it was built for. The secret was set from the untracked `.pii-names` (**6 names**, comma-separated) and the run re-run. |
| 10 — second failure, mine | `The generated code map and index are current` failed. Adding the `// github#85` pointer to `record-demo.mjs` shifted line numbers and earned `#85` a row in `code-index.md`, and I had not regenerated after that edit. **`release.ps1 -DryRun` does not run `code-map --check`** — only the pre-push hook and CI do — so the branch dry run could not have caught it. Regenerated in `54d3dd2`. |
| 10 — green | Run `35085660609`: 21 steps ok, 2 correctly skipped (the ancestry guard, since the branch is not `main`; and release creation, since it is a dry run). |
| 11 — merge into `develop` | `3ec2a54`, `--no-ff`. Pre-push gate ran the full suite on the merge result: **144/144 in 118s**. |
| 11 — the stamp did not carry | The branch dry run measured tree `e6bbda6`; regenerating the code index changed the tree to `a9d1329`, so that 1/2 green no longer applied and the count restarted. `a9d1329` is now 1/2 green. A stamp keys on the tree, which is the point — a doc commit is still a different tree. |
| 12 — pull request to `main` | [#86](https://github.com/luke321/vault-shelf/pull/86). Checks: `main accepts develop or hotfix` pass, `close the issues this push fixes` pass. |
| 12 — merged | `ec81392`, *Merge pull request #86 from luke321/develop*. `main`'s manifest went 1.0.1 → 1.1.0. |
| 13 — `release.ps1 1.1.0` on `main` | Ran the suite once more on tree `55147fa` — **144/144 in 111s** — which was that tree's second consecutive green, so it stamped: `stamped tree 55147fa as passed 2 times in a row`. Then tagged and pushed the tag alone. |
| 14 — the workflow published | Run [`35086834442`](https://github.com/luke321/vault-shelf/actions/runs/35086834442), all 20 steps green including the ancestry guard this time, since the tag is on `main`. |

## Published assets and attestation

Downloaded from the release, hashed locally, and compared against the release API's own digests —
all three match byte for byte.

| Asset | Bytes | SHA-256 | `gh attestation verify` |
|---|---|---|---|
| `main.js` | 227,197 | `c7c436a7aec9afc2e5876f8f34bad97b4a82eca1064521d86d058aeab2522aa8` | exit 0 |
| `manifest.json` | 483 | `841eb942cac8c2db474d679cab844fde6e7bb3ca2025bcd0e862191a2e894d85` | exit 0 |
| `styles.css` | 159,229 | `723da760caad59268677ef7ec8148ec2b035b796e4edd21d37a05ce3bfbc6571` | exit 0 |

Each carries a Sigstore/SLSA provenance statement built from `refs/tags/1.1.0`. These are the three
files Obsidian installs.

## What this release cost in gates it did not expect

Two CI failures on the way, and both were the repository catching something rather than breaking.

**`PII_NAMES` was never set.** `github#82` shipped in this very release and its first real run
refused the build: on a PUBLIC repo with no name list fed in, `check-pii` would have degraded to
patterns-only and exited 0 — a green step that checked no names at all, about other people. The
secret now holds the 6 names from the untracked `.pii-names`.

**The generated index was stale and the local dry run could not see it.** `release.ps1 -DryRun`
runs lint, the pre-flight build and the suite; it does **not** run `code-map --check`, which only
the pre-push hook and CI do. Adding one pointer comment to `record-demo.mjs` after the dry run was
enough to make `code-index.md` stale, and nothing local said so. Worth an issue: the release
script's gate set is a subset of the hook's, which makes a green dry run weaker evidence than it
reads as.
