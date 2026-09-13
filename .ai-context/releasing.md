# Releasing

**Show the status table after every step.** Whoever is driving a release keeps a table of
every step it still needs — the polish asks, the docs and clips it must carry, the version
bump, the name, the merge-down sequence, the tag — and re-posts it, updated, after each step
lands. Standing practice since the sister repo cut 2.5.0 (2026-09-11, `vault-graph@90ba5e7`):
the owner asked for it after seeing one mid-release. Columns: step, status. Call out what is
newly done since the last table and what is blocked or awaiting a decision (a release name,
whether an in-flight issue gates this release or becomes a follow-up). Drop rows that do not
apply; add a row per polish ask the release picked up.

```markdown
| # | Step | Status |
|---|---|---|
| 1 | <this release's own polish and fix asks, one row each> | |
| 2 | List the range and account for every merge in it (below) | |
| 3 | `CHANGELOG.md` section for `<version>`, written as the release body | |
| 4 | Version bump: `manifest.json` → `<version>` | |
| 5 | Release name — propose 2-4 candidates, the owner picks | |
| 6 | Re-record every clip the change touched, and the hero if the page moved (`record-demo.mjs`, headless, no lock) — before the merge, so the clips show the merged tree; a patch hotfix may explicitly skip this when the owner asks for code, changelog and release files only | | **Then run the `review-clips` skill and look at the page** (`& "$env:USERPROFILE\.claude\skills\review-clips\build-clip-review.ps1" -Repo . -Open`) — it reads the storyboard itself and prints `clips present N/N` with the missing act names, so the recording step is confirmed rather than assumed. Do not eyeball a diff to decide what was re-recorded.
| 7 | Read the whole branch: every doc naming the version, every link, the README's install block | |
| 8 | **Review the release body before the tag** — the `## <version>` section, read as the page it becomes | |
| 9 | `release.ps1 <version> -DryRun` on the branch — the run that pays the suite and stamps the tree | |
| 10 | Push `release/<version>` or `hotfix/<version>`; read the workflow's dry-run summary | |
| 11 | Merge `release/<version>` → `develop`, one plain `git push` (never wrapped in the lock), or PR `hotfix/<version>` straight to `main` for an urgent patch | |
| 12 | PR `develop` → `main` on the website, merged there | |
| 13 | `release.ps1 <version>` on `main` — the tag, pushed alone | |
| 14 | The workflow publishes; `verification-<version>.md` gets its post-tag rows | |
```

Status values: ✅ done, ⏳ not started / in progress, ⏸️ blocked (name what it is blocked on).

**A release is the range, not the work in hand.** Everything below happens on
`release/<version>` or `hotfix/<version>` and is read there before anything merges down,
because **once the tag exists nothing changes**: a fix is the next patch version, since editing
after the fact leaves the tag disagreeing with the published page.

## First, list what is actually in the release

Before the bump is decided or a word of the section is written, enumerate everything between
the previous tag and the commit being cut, and account for **every line of it**:

```bash
git fetch origin
git log --oneline --merges <prev-tag>..HEAD         # one line per body of work
git log --oneline --first-parent <prev-tag>..HEAD
git log <prev-tag>..HEAD --format=%s%n%b | grep -oE "(Closes|Refs) #[0-9]+" | sort | uniq -c
git diff --stat <prev-tag>..HEAD -- src plugin      # did the page itself change?
```

Then walk the merge list and ask of each one: **is it in the `CHANGELOG.md` section?** A body
of work that is not named there ships invisibly — the tag carries it, the release page does not
mention it, and nobody reading the release ever learns it exists.

This is written down because the sister repo shipped a release that way once: the section
described one feature while the range also held a whole user-visible feature and a performance
pass. The section had been written from the work in hand rather than from the range, and the
release was deleted and re-cut. **Before the first tag exists here, there is no previous tag to
diff against** — for `0.1.0` the range is the whole history, and the CHANGELOG section already
written for it is the one to check against `git log --oneline`.

The same pass catches the other half: **a claim about the picture has to name the tree it was
measured against.** "Nothing moved" is only ever a statement about the two builds that were
compared. Name them.

And **a count in the section is a measurement like any other**. `ls docs/features/*.webp | wc -l`
is the answer, not memory.

## The two halves

| | |
|---|---|
| `scripts/release.ps1` | **local**: the guards, the gates, the suite, the tag, the tag push |
| `.github/workflows/release.yml` | **the publisher**: build, attest, create the Release |

They are split because an artifact attestation can only be produced by a workflow —
`actions/attest-build-provenance` signs through Sigstore using the run's OIDC token, which
needs `id-token: write`, a permission only an Actions run can hold. A local `gh release
create` has no such token.

Change one, change the other in the same commit. This file is the authority on the flow.

## What `release.ps1` refuses, and why each one exists

Every guard below answers a mistake that was actually made — next door, in the repo this
tooling was cut from. `.\scripts\release.ps1 -SelfTest` drives all of them against a throwaway
clone and prints which fired; it writes nothing outside that clone and tags nothing.

| it refuses | because |
|---|---|
| a `v` prefix, or anything not bare semver | Obsidian matches the release tag against `manifest.json`'s version, which cannot carry a prefix. A `v`-tagged release is one nobody can install |
| a version the manifest does not claim | the same rule, the other half |
| a version with no `## <version>` section in `CHANGELOG.md` | a release whose changes nobody wrote down; the section is also the tag message and the draft release body |
| a branch other than `main` | `-AllowAnyBranch` overrides. `main` is what the directory installs from and what a release is tagged on |
| a HEAD that is in `origin/main`'s history but **not on its first-parent line** | `git log main` walks first parents, so a tag on a commit `main` *merged* never appears in `main`'s own log. vault-graph#47's 1.8.0 sits there permanently. **No override**: `-AllowAnyBranch` means "off `main`'s line entirely", which never reaches this check |
| a `main` that is not **exactly** `origin/main`, either direction | behind means tagging a `main` that is missing what is already published; ahead means a local merge no push can land. vault-graph#94: that cut wrote its tag and then met `GH013: changes must be made through a pull request` |
| a dirty tree | `-AllowDirty` overrides. A release has to be reproducible from its tag |
| a tag of this name pointing somewhere other than HEAD | a tag already on HEAD is a resumed run, not a mistake |

It then prints the hero and feature-clip warnings, runs lint, builds the plugin as a pre-flight
— a build that fails in CI would leave a **tag with no release**, and a published tag cannot be
re-cut — runs the invariant suite unless HEAD's tree already carries a pass stamp
(`decisions/0010`; `-ForceSuite` re-earns one), writes an annotated tag with
`--cleanup=verbatim`, and pushes **the tag alone**.

### A tag message loses every markdown heading unless you say `--cleanup=verbatim`

`git tag -F` defaults to `--cleanup=strip`, which treats a line starting with `#` as a comment
and deletes it. The tag message is the CHANGELOG section, so the default silently eats the
`## <version>` heading and every `###` in it. Measured on the sister repo's own tags: **2.0.0,
2.1.0 and 2.2.0 each carry zero heading lines**, against 8 in 2.3.0's source section — `git
show <tag>` had been telling a flattened story since that script was written, and a published
tag is not edited, so those three keep the defect. `release.ps1` here has passed
`--cleanup=verbatim` since its first version. If the tag step is ever rewritten, that flag is
the one thing about it that is not obvious from reading it.

**It never pushes `main`.** `main` only ever receives `develop`, through a pull request merged
on the website, so by the time the script runs `main` is already on origin or the equality
guard stops it. The branch push the sister repo's script used to make was a no-op at best and a
`GH013` at worst, *after* the tag already existed.

## The sequence

1. **Cut `release/<version>` off `develop`, or `hotfix/<version>` for an urgent patch.**

2. **Bump `manifest.json`.** Bare semver. The tag, the manifest and the CHANGELOG heading must
   all agree — `release.ps1` and the workflow both refuse otherwise.

3. **Write the `CHANGELOG.md` section**, heading included:

   ```
   ## 0.2.0 — "The reading room" — 2026-10-01
   ```

   The form `CHANGELOG.md`'s own preamble states, em dashes included; the file is read with an
   explicit UTF-8 encoding everywhere it is read. The workflow takes the release **title** from
   the quotes (`0.2.0 - The reading room`, ASCII on its side) and the **body** from the
   section, so the two cannot drift, and a title cannot be quietly fixed after it has been
   seen.

4. **Put the numbers in `.ai-context/changelog-detail.md.`** Before and after, for anything
   that changed what a shelf contains or where a book lives. `CHANGELOG.md` says what
   shipped; that file is the regression suite.

5. **Re-record every clip the change touched, before the merge — not only the hero.** A
   constant change, a storyboard reorder or a sizing fix makes *every* existing feature clip
   stale, not just the ones whose own beats moved, and the merged tree is what the clips
   should show, so this happens on the release branch and not after (`vault-graph@c086cf6`).
   `release.ps1` warns when `assets/demo.webp` is older than the last commit to `src/`, and
   once per clip in `docs/features/` that `src/page.js` has moved since. Both are **warnings,
   not gates**, and deliberately: only a person can say whether anything visible changed, and
   a hard stop on a docs-only patch would be wrong often enough to get trained away.

   The staleness test compares **commit dates**, which is a proxy. Encoding an old take and
   committing it today makes a stale hero look fresh. Silence means "no evidence of
   staleness", not "the hero is current".

   ```bash
   node scripts/record-demo.mjs --hero assets/demo.webp
   node scripts/record-demo.mjs --act read           # one act, for a clip
   ```

   The recorder is headless and captures frame by frame over CDP, so it needs no `record`
   lock and cannot capture the wrong window (`design/0007`). A **screen** recording does take
   the `record` lock.

6. **Read the whole branch.** Every doc that names a version, every link, the README's install
   block, the feature gallery, the docs site.

7. **Review the release body before the tag goes out.** `release.yml` publishes live the
   moment the tag lands, with the `## <version>` section as the body, **verbatim, and with no
   draft gate**. There is no GitHub draft to look at afterwards: the section going out *is*
   the publish. So read the section once, on `release/<version>`, as the page a stranger lands
   on — not as a changelog entry — and fix it there. This is the actual review step, not
   `release.ps1`'s pre-flight, and it is its own line because the workflow's step summary
   and the script's closing text used to invite the opposite: "edit it in place" after the
   tag, which is exactly the after-the-tag editing this file opens by forbidding
   (`vault-graph@af7a43f`; github#27 took the invitation out of both).

8. **Rehearse the local half. This is the run that pays the suite:**

   ```powershell
   .\scripts\release.ps1 <version> -DryRun *> dryrun.log
   ```

   Redirected, because PowerShell 5.1 wraps anything a native exe writes to stderr. It ends
   with `stamped tree <sha> as passed`, which records the branch's tree and the three fixtures
   it ran against. **A dirty tree is never stamped; commit first.**

9. **Push the branch.** Every push to `release/*` or `hotfix/*` runs `release.yml` as a **dry run**: it
   builds, gates and attests the three files on a Linux runner and creates no Release. Read its
   summary — three SHA-256 lines and an attestation URL.

10. **Merge `release/<version>` into `develop` and push — one plain `git push origin develop`,
    never wrapped in `lock.mjs`.** The hook takes the `suite` lock itself around the run it
    makes; an outer acquire/release makes the hook's own attempt block on yours and the push
    hang until the stale window expires (`vault-graph@f9a167a`, hit live while pushing a
    release). The hook checks the pushed commit's tree: **if `develop` had not moved, the merge
    commit's tree is the branch's tree and the hook skips**, naming the stamp it trusts. If
    `develop` *had* moved, the merge is new content and the hook runs the suite for real and
    stamps the new tree. Do not reach for `SKIP_SMOKE` here; the stamp is what makes the skip
    honest.

    This push also closes every issue the range names (`close-issues.yml`).

    For an urgent patch, open `hotfix/<version>` → `main` instead after its dry run and tag
    from that hotfix branch.

11. **Open `develop` → `main` on the website and merge it.** The `main accepts develop or
    hotfix` check reports on the pull request. The merge commit carries `develop`'s tree.

12. **Tag from `main`:**

    ```powershell
    git switch main; git pull --ff-only
    .\scripts\release.ps1 <version>
    ```

    It finds the stamp for `HEAD`'s tree, skips the suite, tags, and pushes the tag (never
    gated).

13. **Watch the workflow.**

    ```bash
    gh run watch
    gh run list --workflow=release.yml --limit 1
    ```

    When it is green the Release exists with `main.js`, `manifest.json` and `styles.css`
    attached — the three files Obsidian installs — each with a build-provenance attestation:

    ```bash
    gh attestation verify main.js --repo luke321/vault-shelf
    ```

14. **Finish the verification record** (the template is below) with the rows only the tag
    run can fill: the workflow run, the three SHA-256s, the attestation check. **Not the
    body.** It went out as reviewed in step 7, and an edit now is the after-the-tag change
    this file forbids; `gh release edit` stays as the recovery for a body a workflow bug
    mangled, not as a step.

`node scripts/suite-stamp.mjs check` says what step 10 or 12 will do before you push, and
`list` shows every tree this machine has passed. `-ForceSuite` re-earns a stamp when there is a
reason not to trust one.

## The release branch is where everything lands, and the tag is the end of it

**Everything the release needs is finished on `release/<version>` or `hotfix/<version>` and checked there**: the
section covering the whole range, every clip it embeds, every doc that names the version, the
verification record's pre-tag half. Only then does it go `release/<version>` → `develop` →
`main` → tag → publish. **After the tag exists, nothing changes.** Not the body, not the docs,
not the changelog. If something is wrong enough to fix, it is the next patch version.

The sister repo's 2.1.0 was cut twice and edited after both, which is what this section is
for. The branch had been used as a version-bump holder — the bump and the changelog went on it,
and the work of finding out what the release actually contained happened after the tag. So the
release was deleted and re-cut with the two bodies of work it had left out named and a clip
finally recorded, and then the body was edited twice more, because the reel had been written in
the same voice as the record it sat above and the page said everything twice. Its tag and its
`develop` still differ by the commit that trimmed it. The order above is not bureaucracy; every
one of those edits was avoidable by doing it on the branch.

## What the release branch owes before `develop`, and what happens after

The suite runs **once per distinct tree**, and the path is arranged so that the one run
happens on the release branch, where a failure is still cheap. Measured here on 2026-09-11
(`decisions/0010`, re-measured for github#27 at 87 checks per shape — the numbers are in
`changelog-detail.md`): a full warm run is under a minute, most of it the serial lane of
layout-reading checks, and the static gates ahead of it are seconds. Small next to the sister
repo's 587 s, and the point is the record rather than the seconds: a skipped run that names
the stamp it trusted, instead of `SKIP_SMOKE=1`, which names nothing.

**Before merging into `develop` or tagging a hotfix** — all of it on `release/<version>` or
`hotfix/<version>`: steps 1 to 9. The dry run in step 8 is the run that pays the suite and
ends with `stamped tree <sha> as passed`.

**After** — three moves, none of which should pay the suite again: the merge into `develop`
(step 10, skipped by the hook when `develop` had not moved), the pull request into `main`
(step 11, the branch-policy check alone), and the tag from `main` (step 12, the stamp found
again for the same tree). What used to happen next door, for the record: 2.4.0 ran the suite
on the release branch, skipped it by hand on both `develop` pushes because it had "just
passed", and ran it again in full inside the release script. The stamp replaces the by-hand
skip with one that can say what it trusted.

## The `## <version>` section is the release body, and it is written as one

The workflow drops the section straight into the release notes, verbatim, the moment the tag
lands. There is no draft in between and nothing is edited after, so the section has to be the
finished page — not a changelog entry that somebody will dress up later. Two readers, one
text: the person deciding whether to update, who reads the top and looks at the pictures, and
the person reading the project's history a year on, who wants the dense record. Top to bottom:

1. **One line naming the release** (`**The reading room.**` style, bold) and the two or three
   things it is actually about, in the release's own voice — not a commit-log summary.
2. **Not the hero.** `assets/demo.webp` is the README's walkthrough: it is the slowest thing
   on the page and the least specific, since it shows the whole tool rather than what changed.
   Embed the per-feature clips instead.
3. **One `###` section per genuinely new or visibly-changed feature**, and the set of them
   comes from the merge list in *First, list what is actually in the release*, not from memory.
   Each with its clip. Do not call something new that already shipped — check the source at
   the previous tag (`git show <prev-tag>:src/page.js | grep ...`). Fixes that matter but are
   not visually demonstrable go in prose under the nearest `###`, or a `### Smaller things`
   list, with no clip forced onto them.
4. **The Ko-fi ask, every release, always the same spot** — right after the last feature
   section, right before the record. One line of text, then the button on its own line:

   ```markdown
   If Vault Shelf is useful to you:

   [![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/luke321)
   ```

   Ported from the sister repo 2026-09-13, matching its manifest `fundingUrl`, README badge and
   `.github/FUNDING.yml` — all three already shipped with 1.0.0, but the release-body ask line
   did not, since 1.0.0's body was drafted before this step existed here. Applies from 1.1.0
   on: `1.0.0`'s published body is not amended (*once the tag exists nothing changes*). This is
   where it reaches someone who just updated and is reading what's new — never embellished,
   never repeated elsewhere on the page.

   Posting an actual Ko-fi feed announcement for the release (title, description, a mirror-vault
   screenshot) is a separate, manual step, not scripted here — see the `post-to-kofi` skill.
5. **The record, under its own `###`**, dense and bug-by-bug, at the bottom of the same
   section. Nothing is maintained in two places: the reel and the record are one document, and
   `changelog-detail.md` holds the numbers behind both.

**Pin every image URL to the tag**, never to a branch:
`raw.githubusercontent.com/luke321/vault-shelf/<version>/assets/...`. A branch ref makes the
release page's pictures change every time that branch moves, which breaks *once the tag exists
nothing changes* by construction. The sister repo has a published release whose every image is
a 404 because they were pinned to a release branch somebody later deleted, and another whose
pictures still move because they point at `develop`. A tag URL answers 404 until the tag
exists, which is fine: the review in step 7 reads the branch's file, not the rendered page. If
you want to preview the rendering, pin to `develop` while you look and **change every URL to
the tag before the dry run**, or pin to the clip's own commit SHA, which is permanent either
way.

## The verification record

**Every release gets `.ai-context/verification-<version>.md`, written on the release branch.**
It is the answer to "what was actually run, and what is still unknown" a month later, when the
only other evidence is a green tick nobody can reconstruct. Everything known before the tag —
the gates, the dry runs, what was looked at, what was not — is on the branch and merges down
with it. The three rows only the tag run can fill (the workflow run, the SHA-256s, the
attestation check) are appended on `develop` afterwards as their own commit: they are
evidence *about* the release, not part of what the tag's tree claims, so writing them later
breaks nothing the tag promised. Copy this shape:

```markdown
# Verification of <version>

**Date** YYYY-MM-DD · **Candidate** `release/<version>@<sha>` · **Reference** `<prev-tag>` (or: the first release, nothing to compare against)

## What was run

| gate | result |
|---|---|
| `npm run lint` (with `tsc --noEmit` over `src/core`) | 0 errors, 0 warnings |
| `node scripts/smoke.mjs` | N/N × three shapes, stamped tree `<sha>` |
| `check-pii` / `check-scope` / `check-network` / `check-comments` | clean; comment baseline N |
| the two determinism checks | clean |
| `node scripts/code-map.mjs --check` | current |
| `release.ps1 <version> -DryRun` | reached the tag step |
| `release.yml` dry run on `release/<version>` | three files attested, no Release; SHA-256s |
| `gh attestation verify main.js --repo luke321/vault-shelf` | verified against the run |

## What was looked at, not just measured

Screenshots taken, at which sizes, in which looks and themes, and what they showed.
**Numbers cannot see**; this section is the only part of the record that can.

## What changed since the reference, and what did not

Per claim: the number before, the number after, and the two trees it was measured on.

## What was NOT verified

The honest list. Anything the suite does not cover, anything skipped, anything assumed.
```

The sister repo's `verification-2.0.0.md` is the worked example, and its own release notes
point at it — a claim in a release body is worth what its record is worth.

## Rehearsing a change to the workflow

A tag-triggered run executes the version of `release.yml` that is **at the tag**. A bug in it
shows up on the first real release, re-running re-runs the broken file, and fixing `main`
changes nothing for that tag.

So: a push to any `release/*` branch runs the whole publishing half — gates, build, attestation
— and creates **no Release**. `workflow_dispatch` with `dry_run` does the same from any branch,
and with a `tag` input runs *this branch's* file against an existing tag, which turns "the
release is broken forever" into "fix and re-run". GitHub only lets a workflow be dispatched
once its file is on the default branch, which is why the `release/*` push trigger exists at
all.

What to read afterwards: the run's summary (three SHA-256 lines and an attestation URL); that
a local build of the same commit has the same SHA-256s; and that **no Release was created**. A
dry run's attestation is a real one, recorded for bytes that were never published — harmless,
and the reason a dry run is not a substitute for the tag run.

## What the release must NOT contain

- **Any built `vault-shelf.html`.** It embeds every note title, path, tag, person and body of
  whichever vault produced it. Publishing one publishes that. Nothing but the three plugin
  files is ever attached.
- **Any fixture or mirror vault.** The generator is the artefact (`decisions/0004`,
  `design/0013`).

## After the tag

Nothing. Not the body, not the docs, not the changelog. If something is wrong enough to fix, it
is the next patch version — an edit after the fact leaves the tag's tree disagreeing with the
published page, and nobody can tell afterwards which one was meant.
