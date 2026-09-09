# Releasing

**A release is the range, not the work in hand.** Everything below happens on
`release/<version>` and is read there before anything merges down, because **once the tag
exists nothing changes**: a fix is the next patch version, since editing after the fact leaves
the tag disagreeing with the published page.

Start by enumerating what the release actually contains:

```bash
git fetch origin
git log --oneline --first-parent origin/main..origin/develop
git log --oneline --merges origin/main..origin/develop
git diff --stat origin/main..origin/develop
```

Every merge in that second list needs a line in the `CHANGELOG.md` section. Not a summary of
what you remember doing — the range.

## The two halves

| | |
|---|---|
| `scripts/release.ps1` | **local**: the guards, the gate suite, the tag, the push |
| `.github/workflows/release.yml` | **the publisher**: build, attest, create the Release |

They are split because an artifact attestation can only be produced by a workflow —
`actions/attest-build-provenance` signs through Sigstore using the run's OIDC token, which
needs `id-token: write`, a permission only an Actions run can hold. A local `gh release
create` has no such token.

Change one, change the other in the same commit. This file is the authority on the flow.

## The sequence

1. **Cut `release/<version>` off `develop`.**

2. **Bump `manifest.json`.** Bare semver. The tag, the manifest and the CHANGELOG heading must
   all agree — `release.ps1` and the workflow both refuse otherwise, because Obsidian installs
   a plugin by matching the release tag against the manifest version.

3. **Write the `CHANGELOG.md` section**, heading included:

   ```
   ## 0.2.0 -- "The reading room" -- 2026-10-01
   ```

   The workflow reads the release **title** out of the quotes and the release **body** out of
   the section, so the two cannot drift. Use an **ASCII hyphen**, not an em dash: every
   published title so far uses one, and a title cannot be quietly fixed after it has been seen.

4. **Put the numbers in `.ai-context/changelog-detail.md`.** Before and after, for anything
   that changed what a shelf contains or where a book lives.

5. **Re-record what actually changed.** `release.ps1` warns when `assets/demo.webp` is older
   than the last commit to `src/`, and warns per feature clip when `src/page.js` has moved
   since that clip was recorded. Both are **warnings, not gates**, and deliberately: only a
   person can say whether anything visible changed, and a hard stop on a docs-only patch would
   be wrong often enough to get trained away.

   The staleness test compares **commit dates**, which is a proxy. Encoding an old take and
   committing it today makes a stale hero look fresh. Silence means "no evidence of
   staleness", not "the hero is current".

   Screen recordings take the `record` lock (`design/0006`).

6. **Read the whole branch.** Every doc that names a version, every link, the README's install
   block, the feature gallery.

7. **Merge `release/<version>` into `develop`, then `develop` into `main`.** `main` only ever
   receives `develop`, enforced three ways — the branch-policy workflow on the button, the
   pre-push hook on the command line, and the release workflow on the tag.

8. **Tag from `main`:**

   ```powershell
   .\scripts\release.ps1 0.2.0 -DryRun    # everything except the tag and the push
   .\scripts\release.ps1 0.2.0
   ```

   It refuses a `v` prefix, a version the manifest does not claim, a version with no CHANGELOG
   section, a branch other than `main`, a dirty tree, and a `main` that is behind origin. Then
   it runs lint and the invariant suite, builds the plugin as a pre-flight — a build that fails
   in CI would leave a **tag with no release**, and a published tag cannot be re-cut — writes
   an annotated tag whose message is the CHANGELOG section, and pushes **the branch first,
   then the tag**. That order is load-bearing: the workflow refuses to publish a tag that is
   not in `origin/main`'s history, and it starts the moment the tag lands.

9. **Watch the workflow.**

   ```bash
   gh run watch
   gh run list --workflow=release.yml --limit 1
   ```

   When it is green the Release exists with `main.js`, `manifest.json` and `styles.css`
   attached — the three files Obsidian installs — each with a build-provenance attestation:

   ```bash
   gh attestation verify main.js --repo luke321/vault-shelf
   ```

10. **Rewrite the release body.** The workflow drafts it as the raw CHANGELOG section. That is
    a first draft: put a short highlight reel on top — two or three sentences on what is
    actually different for somebody using it — and leave the CHANGELOG section verbatim
    underneath.

    ```bash
    gh release edit 0.2.0 --notes-file <file>
    ```

## Rehearsing a change to the workflow

A tag-triggered run executes the version of `release.yml` that is **at the tag**. A bug in it
shows up on the first real release, re-running re-runs the broken file, and fixing `main`
changes nothing for that tag.

So: a push to any `release/*` branch runs the whole publishing half — gates, build, attestation
— and creates **no Release**. `workflow_dispatch` with `dry_run` does the same from any branch,
and with a `tag` input runs *this branch's* file against an existing tag, which turns "the
release is broken forever" into "fix and re-run".

## After the tag

Nothing. If something is wrong, it is the next patch version.
