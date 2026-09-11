# Releasing

**A release is the range, not the work in hand.** Everything below happens on
`release/<version>` and is read there before anything merges down, because **once the tag
exists nothing changes**: a fix is the next patch version, since editing after the fact leaves
the tag disagreeing with the published page.

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

**`--cleanup=verbatim` is load-bearing.** `git tag -F` defaults to `--cleanup=strip`, which
treats a line starting with `#` as a comment and deletes it — and the tag message is the
CHANGELOG section, so the default silently eats the `## <version>` heading and every `###` in
it. Three of the sister repo's tags carry zero heading lines because of that, and a published
tag is not edited.

**It never pushes `main`.** `main` only ever receives `develop`, through a pull request merged
on the website, so by the time the script runs `main` is already on origin or the equality
guard stops it. The branch push the sister repo's script used to make was a no-op at best and a
`GH013` at worst, *after* the tag already existed.

## The sequence

1. **Cut `release/<version>` off `develop`.**

2. **Bump `manifest.json`.** Bare semver. The tag, the manifest and the CHANGELOG heading must
   all agree — `release.ps1` and the workflow both refuse otherwise.

3. **Write the `CHANGELOG.md` section**, heading included:

   ```
   ## 0.2.0 -- "The reading room" -- 2026-10-01
   ```

   The workflow reads the release **title** out of the quotes and the release **body** out of
   the section, so the two cannot drift. Use an **ASCII hyphen**, not an em dash: a title
   cannot be quietly fixed after it has been seen.

4. **Put the numbers in `.ai-context/changelog-detail.md.`** Before and after, for anything
   that changed what a shelf contains or where a book lives. `CHANGELOG.md` says what
   shipped; that file is the regression suite.

5. **Re-record what actually changed.** `release.ps1` warns when `assets/demo.webp` is older
   than the last commit to `src/`, and once per clip in `docs/features/` that `src/page.js` has
   moved since. Both are **warnings, not gates**, and deliberately: only a person can say
   whether anything visible changed, and a hard stop on a docs-only patch would be wrong often
   enough to get trained away.

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

7. **Rehearse the local half. This is the run that pays the suite:**

   ```powershell
   .\scripts\release.ps1 <version> -DryRun -AllowAnyBranch *> dryrun.log
   ```

   Redirected, because PowerShell 5.1 wraps anything a native exe writes to stderr. It ends
   with `stamped tree <sha> as passed`, which records the branch's tree and the three fixtures
   it ran against. **A dirty tree is never stamped; commit first.**

8. **Push the branch.** Every push to `release/*` runs `release.yml` as a **dry run**: it
   builds, gates and attests the three files on a Linux runner and creates no Release. Read its
   summary — three SHA-256 lines and an attestation URL.

9. **Merge `release/<version>` into `develop` and push.** The hook checks the pushed commit's
   tree: **if `develop` had not moved, the merge commit's tree is the branch's tree and the hook
   skips**, naming the stamp it trusts. If `develop` *had* moved, the merge is new content and
   the hook runs the suite for real and stamps the new tree. Do not reach for `SKIP_SMOKE`
   here; the stamp is what makes the skip honest.

   This push also closes every issue the range names (`close-issues.yml`).

10. **Open `develop` → `main` on the website and merge it.** The `main only accepts develop`
    check reports on the pull request. The merge commit carries `develop`'s tree.

11. **Tag from `main`:**

    ```powershell
    git switch main; git pull --ff-only
    .\scripts\release.ps1 <version>
    ```

    It finds the stamp for `HEAD`'s tree, skips the suite, tags, and pushes the tag (never
    gated).

12. **Watch the workflow.**

    ```bash
    gh run watch
    gh run list --workflow=release.yml --limit 1
    ```

    When it is green the Release exists with `main.js`, `manifest.json` and `styles.css`
    attached — the three files Obsidian installs — each with a build-provenance attestation:

    ```bash
    gh attestation verify main.js --repo luke321/vault-shelf
    ```

13. **Rewrite the release body** (the shape is below), and **write the verification record**
    (the template is below).

`node scripts/suite-stamp.mjs check` says what step 9 or 11 will do before you push, and
`list` shows every tree this machine has passed. `-ForceSuite` re-earns a stamp when there is a
reason not to trust one.

## The release body is a highlight reel ON TOP of the CHANGELOG section, not instead of it

The workflow drops the raw `## <version>` section straight into the release notes — fine as a
first draft, wrong as the finished thing. `CHANGELOG.md` is the technical record: dense,
bug-by-bug, written for someone reading the project's history. The Release page is what
somebody deciding whether to update reads first, and a wall of bug-fix prose with no picture
buries the one or two things that changed for them.

Top to bottom:

1. **One line naming the release** (`**The reading room.**` style, bold) and the two or three
   things it is actually about, in the release's own voice — not a commit-log summary.
2. **Not the hero.** `assets/demo.webp` is the README's walkthrough: it is the slowest thing
   on the page and the least specific, since it shows the whole tool rather than what changed.
   Embed the per-feature clips instead.
3. **One `###` section per genuinely new or visibly-changed feature**, and the set of them
   comes from the merge list in *First, list what is actually in the release*, not from memory.
   Each with its clip. Do not call something new that already shipped — check the source at
   the previous tag (`git show <prev-tag>:src/page.js | grep ...`). Fixes that matter but are
   not visually demonstrable go in prose under the nearest `###`, or a "Smaller things" list,
   with no clip forced onto them.
4. **A `---` divider**, then the CHANGELOG section **appended verbatim, heading included**. The
   full technical writeup lives *in* the release body, underneath the reel, so nothing is lost
   and nothing is maintained in two places.

**Pin every image URL to the tag**, never to a branch:
`raw.githubusercontent.com/luke321/vault-shelf/<version>/assets/...`. A branch ref makes the
release page's pictures change every time that branch moves, which breaks *once the tag exists
nothing changes* by construction. The sister repo has a published release whose every image is
a 404 because they were pinned to a release branch somebody later deleted, and another whose
pictures still move because they point at `develop`. While the tag does not exist yet — you are
previewing a draft — pin to `develop` and **change them to the tag before publishing**, or pin
to the commit SHA, which is permanent either way.

```bash
gh release edit <version> --notes-file <file>
```

## The verification record

**Every release gets `.ai-context/verification-<version>.md`, written on the release branch.**
It is the answer to "what was actually run, and what is still unknown" a month later, when the
only other evidence is a green tick nobody can reconstruct. Copy this shape:

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
| `release.ps1 <version> -DryRun -AllowAnyBranch` | reached the tag step |
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
