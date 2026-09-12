<#
.SYNOPSIS
  The local half of a release: check, gate, tag, push the tag. The publishing half is
  .github/workflows/release.yml, which the tag push triggers.

.DESCRIPTION
  Refuses a v-prefixed or non-semver version, a version the manifest does not claim, a
  version with no CHANGELOG section, a branch other than main, a HEAD that is not on
  origin/main's first-parent line (github#5, after vault-graph#47), a main that is not
  exactly origin/main (after vault-graph#94) and a dirty tree; prints the hero and
  feature-clip warnings; runs lint; builds the plugin once as a pre-flight; runs the
  invariant suite unless HEAD's tree already carries a pass stamp from an earlier full run
  (github#5, decisions/0010; -ForceSuite runs it anyway); then writes the annotated tag and
  pushes THE TAG ALONE. The branch is never pushed: main only ever receives develop through
  a pull request merged on the website, so by the time this runs main is already on origin,
  or the guard stops it. Everything after the tag push -- build, provenance attestation,
  Release, assets -- is the workflow's. .ai-context/releasing.md is the authority on the two
  halves.

.PARAMETER Version
  Bare semver, e.g. 0.1.0. No v.

.PARAMETER DryRun
  Stop after the suite, before the tag and the push.

.PARAMETER AllowDirty
  Tag a dirty tree anyway.

.PARAMETER AllowAnyBranch
  Tag off main anyway; the workflow's main-ancestry guard will then refuse to publish.

.PARAMETER ForceSuite
  Run the invariant suite even when HEAD's tree already carries a pass stamp.

.PARAMETER SelfTest
  Drive every refusal above against a throwaway clone and print which guard fired. Writes
  nothing outside the clone, tags nothing and pushes nothing.

.EXAMPLE
  .\scripts\release.ps1 0.1.0 -DryRun

.EXAMPLE
  .\scripts\release.ps1 -SelfTest
#>
[CmdletBinding()]
param(
  # NOT Mandatory, because -SelfTest takes no version and a mandatory parameter prompts --
  # and a prompt in a non-interactive session is a hang, not a question. The check is below.
  [Parameter(Position = 0)][string] $Version,
  # -Notes AND -Title ARE GONE, and their jobs did not disappear -- they moved.
  #
  # -Notes prepended a one-line summary to the release body. The body is now drafted by
  # the workflow from the `## <version>` CHANGELOG section -- the same text this script
  # writes into the tag message, so `git show <tag>` and the Release page still agree --
  # and then rewritten by hand: a highlight reel on top, the CHANGELOG section verbatim
  # underneath. See .ai-context/releasing.md for that shape. A one-liner passed at tag
  # time has nowhere useful to land in it.
  #
  # -Title named the release ("0.2.0 - The reading room"). The workflow reads that name out
  # of the CHANGELOG heading instead -- `## 0.2.0 -- "The reading room" -- 2026-10-01` -- so
  # the title and the changelog section it sits above can no longer disagree, which a
  # hand-typed argument allowed. The ASCII-hyphen decision survives in the workflow: the
  # sister repo published mojibake once when PowerShell 5.1 re-encoded a native command-line
  # argument on the way out, and although a UTF-8 runner has no such problem, a title cannot
  # be quietly fixed after it has been seen.
  [switch] $DryRun,
  [switch] $AllowDirty,
  # Cut the release from wherever HEAD is standing, instead of requiring main. The escape
  # hatch for the branch guard below, shaped like -AllowDirty: there is a legitimate case
  # (a hotfix line that never reaches main, say), and the guard exists to stop the ACCIDENT,
  # not to make the deliberate thing impossible.
  #
  # IT DOES NOT REACH THE FIRST-PARENT GUARD, and that is the point of having both. See the
  # comment on that guard: a commit main MERGED is the one case where "I know what I am
  # doing" and "I am about to make vault-graph#47's permanent mistake" look identical.
  [switch] $AllowAnyBranch,
  # Run the invariant suite even when HEAD's tree already carries a pass stamp (github#5,
  # decisions/0010). The stamp is the normal case: the dry run on the release branch measured
  # this exact tree, and the merge into main did not change it. This is the flag for not
  # trusting that -- a suspected flake, a changed Chrome, a stamp you want re-earned.
  [switch] $ForceSuite,
  # Exercise every refusal and print which one fired. See Invoke-SelfTest at the bottom.
  [switch] $SelfTest
)

$ErrorActionPreference = 'Stop'

# PowerShell 5.1 turns ANYTHING a native exe writes to stderr into a NativeCommandError,
# and with $ErrorActionPreference = 'Stop' that terminates the script. `git push` reports
# progress on stderr, so a SUCCESSFUL push killed the sister repo's script half-way through
# its first real run -- after the push had landed, before the release was created. Native
# calls go through here: stderr stays visible, and the exit code is what decides.
# Arguments as an explicit ARRAY, not ValueFromRemainingArguments: a parameter cannot be
# called $Args -- that is an automatic variable -- and binding silently broke, so
# `Invoke-Native git tag -a ...` came back as "no positional parameter accepts 'tag'".
function Invoke-Native {
  param([Parameter(Mandatory)][string] $Exe, [Parameter(Mandatory)][string[]] $Arguments)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Exe @Arguments } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "$Exe $($Arguments -join ' ') exited $LASTEXITCODE" }
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here

# ---------------------------------------------------------------- the self-test --
#
# EVERY GUARD BELOW HAS A WAY TO BE MEASURED, because a guard nobody has seen fire is a
# guard nobody knows the message of. This clones the repository locally -- `git clone
# --local`, hardlinks, no network, never the real remote -- builds each refusal's
# precondition on a throwaway branch in that clone, runs this same script there with
# -DryRun, and prints which guard fired against which was expected.
#
# The PASSING case is the interesting one: it has no guard to fire, so it is asserted on
# what it reaches instead. A fresh clone has no node_modules, so it dies at the lint gate
# with "npm ci first" -- which is proof it got past every guard, and costs no Chrome and no
# suite. github#5
function Invoke-SelfTest {
  param([string] $Repo, [string] $Script)

  $scratch = Join-Path ([IO.Path]::GetTempPath()) ("vs-release-selftest-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  $bare = Join-Path $scratch 'origin.git'
  $clone = Join-Path $scratch 'clone'
  $fails = New-Object System.Collections.ArrayList
  $rows = New-Object System.Collections.ArrayList

  $git = {
    param([string[]] $A)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = & git -C $clone @A 2>&1 } finally { $ErrorActionPreference = $prev }
    return @{ code = $LASTEXITCODE; out = ($out | Out-String) }
  }

  try {
    New-Item -ItemType Directory -Path $scratch -Force | Out-Null
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    # TWO CLONES, AND THE INNER ONE'S ORIGIN IS THE OUTER, because the guards under test
    # FETCH origin/main before measuring it. A clone whose origin is the real repository
    # would have every case's faked origin/main overwritten by the script's own fetch, so
    # the self-test owns both ends: a throwaway bare repository standing in for origin, and
    # a working clone of it. Nothing here can reach github, and the real repository is only
    # ever read.
    & git clone --bare --local --quiet $Repo $bare 2>&1 | Out-Null
    & git clone --local --no-hardlinks --quiet $bare $clone 2>&1 | Out-Null
    $ErrorActionPreference = $prev
    if (-not (Test-Path (Join-Path $clone '.git'))) { throw "could not clone $Repo into $clone" }
    & $git @('config', 'user.email', 'selftest@example.invalid') | Out-Null
    & $git @('config', 'user.name', 'selftest') | Out-Null
    # The clone's hooks are the repo's own; a commit here must not run them.
    & $git @('config', 'core.hooksPath', ([IO.Path]::Combine($scratch, 'no-hooks'))) | Out-Null

    $onMain = (& $git @('checkout', '-q', '-B', 'main', 'refs/remotes/origin/main'))
    if ($onMain.code -ne 0) { throw "could not stand the clone on main: $($onMain.out)" }

    # THE SCRIPT UNDER TEST IS THE ONE ON DISK, not the one HEAD happens to carry. A clone
    # is a clone of the last commit, so without this the guards being measured are the
    # guards as they were before the change -- which is how the first run of this self-test
    # reported ten failures that were all "the old script wants a mandatory -Version".
    # The overlay is committed and pushed, so the clone starts clean and on a main that is
    # exactly origin/main, which is what every case below breaks exactly one thing about.
    Copy-Item (Join-Path $Repo 'scripts\*') (Join-Path $clone 'scripts') -Recurse -Force
    # github#33 -- and the update note, for the same reason: it is a file the guards now READ,
    # so a clone of a main that predates it would measure the absence rather than the guard.
    $wnSrc = Join-Path $Repo 'plugin\whats-new.md'
    if (Test-Path -LiteralPath $wnSrc) {
      New-Item -ItemType Directory -Path (Join-Path $clone 'plugin') -Force | Out-Null
      Copy-Item $wnSrc (Join-Path $clone 'plugin\whats-new.md') -Force
    }
    & $git @('add', '-A') | Out-Null
    & $git @('commit', '-q', '-m', 'selftest: the working tree scripts under test') | Out-Null
    $seeded = (& $git @('push', '-q', 'origin', 'HEAD:main'))
    if ($seeded.code -ne 0) { throw "could not seed the stand-in origin: $($seeded.out)" }
    & $git @('fetch', '-q', 'origin', 'refs/heads/main:refs/remotes/origin/main') | Out-Null

    $manifestVersion = (ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path $clone 'manifest.json'), [Text.Encoding]::UTF8))).version
    $changelogHas = ([IO.File]::ReadAllText((Join-Path $clone 'CHANGELOG.md'), [Text.Encoding]::UTF8)) -match [regex]::Escape("## $manifestVersion")
    Write-Host "clone: $clone (origin: $bare)" -ForegroundColor DarkGray
    Write-Host "manifest says $manifestVersion; CHANGELOG has a section for it: $changelogHas" -ForegroundColor DarkGray
    Write-Host ""

    $runCase = {
      # NOT $Args: that is an automatic variable, and a param named after it binds nothing
      # -- which is the same trap Invoke-Native's comment above records, met a second time.
      param([string] $Name, [string[]] $CaseArgs, [string] $Expect)
      $prev = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $tagsBefore = @(& git -C $clone tag -l).Count
      # ONE EXPLICIT ARRAY, and $CaseArgs spelled out in it. Splatting `@Args` here splatted
      # the AUTOMATIC $Args -- empty -- so every case ran with no version at all and reported
      # the same "Which version?" refusal, ten identical failures that looked like a broken
      # script and were a broken harness. The same trap Invoke-Native's comment records.
      $psArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass',
                  '-File', (Join-Path $clone 'scripts\release.ps1')) + $CaseArgs
      $out = & powershell @psArgs 2>&1 | Out-String
      $code = $LASTEXITCODE
      $tagsAfter = @(& git -C $clone tag -l).Count
      $ErrorActionPreference = $prev
      $hit = $out -match $Expect
      $clean = ($tagsAfter -eq $tagsBefore)
      $ok = $hit -and $clean
      if (-not $ok) { [void] $fails.Add($Name) }
      [void] $rows.Add([pscustomobject]@{
        guard = $Name; fired = $hit; tags = "$tagsBefore -> $tagsAfter"; exit = $code
      })
      Write-Host ("  {0} {1}" -f ($(if ($ok) { 'ok  ' } else { 'FAIL' }), $Name)) -ForegroundColor $(if ($ok) { 'DarkGray' } else { 'Red' })
      $line = ($out -split "`r?`n" | Where-Object { $_ -match $Expect } | Select-Object -First 1)
      if ($line) { Write-Host ("       " + $line.Trim()) -ForegroundColor DarkGray }
      elseif (-not $hit) { Write-Host ("       expected /$Expect/, got: " + (($out -split "`r?`n" | Where-Object { $_ -match '\S' } | Select-Object -Last 2) -join ' | ')) -ForegroundColor Red }
      if (-not $clean) { Write-Host "       A TAG WAS WRITTEN ($tagsBefore -> $tagsAfter)" -ForegroundColor Red }
    }

    Write-Host "=== the refusals ===" -ForegroundColor Cyan
    & $runCase 'a v prefix'            @('v0.1.0', '-DryRun')  "Drop the 'v'"
    & $runCase 'not semver'            @('0.1', '-DryRun')     'must look like'
    & $runCase 'the manifest disagrees' @('9.9.9', '-DryRun')  'Bump the manifest first'

    # A version the manifest DOES claim but the CHANGELOG does not have a section for. The
    # manifest is the only place a version can be read from, so this case edits the
    # changelog rather than the version -- and commits and pushes it, because an uncommitted
    # edit would trip the dirty-tree guard first and prove nothing about this one.
    $cl = Join-Path $clone 'CHANGELOG.md'
    $text = [IO.File]::ReadAllText($cl, [Text.Encoding]::UTF8)
    $noBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($cl, ($text -replace [regex]::Escape("## $manifestVersion"), '## 0.0.0-nothing'), $noBom)
    & $git @('commit', '-q', '-am', 'selftest: take the changelog section away') | Out-Null
    & $git @('push', '-q', 'origin', 'HEAD:main') | Out-Null
    & $runCase 'no CHANGELOG section'  @($manifestVersion, '-DryRun') 'has no'
    & $git @('reset', '-q', '--hard', 'HEAD~1') | Out-Null
    & $git @('push', '-q', '--force', 'origin', 'HEAD:main') | Out-Null

    # github#33 -- an x.y.0 whose update note names another version. Same shape as the case
    # above: the note is edited, committed and pushed, because an uncommitted edit would trip
    # the dirty-tree guard first and prove nothing about this one.
    $wn = Join-Path $clone 'plugin\whats-new.md'
    $wnText = [IO.File]::ReadAllText($wn, [Text.Encoding]::UTF8)
    [IO.File]::WriteAllText($wn, ($wnText -replace '(?m)^#\s+\d+\.\d+\.\d+\s*$', '# 9.9.9'), $noBom)
    & $git @('commit', '-q', '-am', 'selftest: point the update note at another version') | Out-Null
    & $git @('push', '-q', 'origin', 'HEAD:main') | Out-Null
    & $runCase 'the update note is for another version' @($manifestVersion, '-DryRun') 'ships an update note'
    & $git @('reset', '-q', '--hard', 'HEAD~1') | Out-Null
    & $git @('push', '-q', '--force', 'origin', 'HEAD:main') | Out-Null

    & $git @('checkout', '-q', '-b', 'not-main') | Out-Null
    & $runCase 'a branch other than main' @($manifestVersion, '-DryRun') "not main"
    & $git @('checkout', '-q', 'main') | Out-Null

    # AHEAD of origin/main: the case vault-graph#94 was filed for. main only ever receives
    # develop through a pull request, so a commit made locally on main is a tag nothing can
    # ever land under -- and the sister repo's script called this the normal case and pushed.
    & $git @('commit', '-q', '--allow-empty', '-m', 'selftest: a local commit on main') | Out-Null
    & $runCase 'main ahead of origin/main' @($manifestVersion, '-DryRun') 'ahead of origin/main'
    & $git @('reset', '-q', '--hard', 'refs/remotes/origin/main') | Out-Null

    # BEHIND: tagging a main that is missing what is already published. Pushed to the
    # stand-in origin and then rewound locally, which is what "somebody else published" is.
    & $git @('commit', '-q', '--allow-empty', '-m', 'selftest: published by somebody else') | Out-Null
    & $git @('push', '-q', 'origin', 'HEAD:main') | Out-Null
    & $git @('reset', '-q', '--hard', 'HEAD~1') | Out-Null
    & $runCase 'main behind origin/main' @($manifestVersion, '-DryRun') 'behind origin/main'
    & $git @('reset', '-q', '--hard', 'refs/remotes/origin/main') | Out-Null

    # OFF MAIN'S FIRST-PARENT LINE: vault-graph#47's 1.8.0 exactly -- a commit main merged,
    # standing one branch over, with the branch guard deliberately waived. Built here as a
    # real merge so the second parent is a real second parent, and the merge is pushed so
    # origin/main is the merge rather than the thing merged.
    & $git @('checkout', '-q', '-b', 'side') | Out-Null
    & $git @('commit', '-q', '--allow-empty', '-m', 'selftest: work on a side branch') | Out-Null
    $sideTip = (& $git @('rev-parse', 'HEAD')).out.Trim()
    & $git @('checkout', '-q', 'main') | Out-Null
    & $git @('merge', '-q', '--no-ff', '-m', 'selftest: merge side into main', 'side') | Out-Null
    & $git @('push', '-q', 'origin', 'HEAD:main') | Out-Null
    & $git @('checkout', '-q', '--detach', $sideTip) | Out-Null
    & $runCase 'off origin/main first-parent' @($manifestVersion, '-DryRun', '-AllowAnyBranch') 'first-parent'
    & $git @('checkout', '-q', 'main') | Out-Null
    & $git @('reset', '-q', '--hard', 'refs/remotes/origin/main') | Out-Null

    # A DIRTY TREE. Untracked counts: the tag has to describe the tree it was cut from.
    Set-Content -Path (Join-Path $clone 'manifest.json') -Value ((Get-Content (Join-Path $clone 'manifest.json') -Raw) + "`n") -NoNewline -Encoding utf8
    & $runCase 'a dirty tree'          @($manifestVersion, '-DryRun') 'Working tree is dirty'
    & $git @('checkout', '-q', '--', '.') | Out-Null

    Write-Host ""
    Write-Host "=== the passing case ===" -ForegroundColor Cyan
    # Nothing to refuse: on main, equal to origin/main, on its first-parent line, clean,
    # the manifest and the CHANGELOG agreeing. So it is asserted on what it REACHES -- the
    # lint gate, which fails closed in a clone that has never run npm ci. Past every guard,
    # and no Chrome.
    & $runCase 'every guard passed, reached lint' @($manifestVersion, '-DryRun') '(=== lint ===|npm ci|lint failed)'

    Write-Host ""
    $rows | Format-Table -AutoSize | Out-String | Write-Host
    if ($fails.Count) {
      Write-Host ("release.ps1 -SelfTest: " + $fails.Count + " FAILED -- " + ($fails -join ', ')) -ForegroundColor Red
      return 1
    }
    Write-Host ("release.ps1 -SelfTest: all " + $rows.Count + " cases behaved") -ForegroundColor Green
    return 0
  } finally {
    Remove-Item -Recurse -Force $scratch -ErrorAction SilentlyContinue
  }
}

if ($SelfTest) {
  if ($Version) { throw "-SelfTest takes no version: it drives every refusal in a throwaway clone." }
  exit (Invoke-SelfTest -Repo $repo -Script $MyInvocation.MyCommand.Path)
}

if (-not $Version) {
  throw "Which version? Bare semver, e.g. .\scripts\release.ps1 0.1.0 (or -SelfTest to drive the guards)."
}

Push-Location $repo
try {
  # BARE SEMVER. A `v` gets its own message rather than a format error, because passing one
  # is the obvious mistake and the reason it is wrong is not obvious at all.
  if ($Version -match '^v\d') {
    throw ("Drop the 'v': the tag must be bare semver ($($Version.Substring(1))). Obsidian " +
           "matches the release tag against manifest.json's version, which cannot carry a " +
           "prefix -- a v-tagged release is one nobody can install.")
  }
  if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must look like 0.1.0 (bare semver -- see CHANGELOG.md's versioning section)"
  }

  # AND IT HAS TO BE THE VERSION THE MANIFEST CLAIMS. Same rule, the other half: Obsidian
  # matches the tag against manifest.json, so a tag that disagrees with it installs nothing.
  # Cheap to check here, invisible until a user reports the plugin will not update.
  $manifest = ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path $repo 'manifest.json'), [Text.Encoding]::UTF8))
  if ($manifest.version -ne $Version) {
    throw "manifest.json says $($manifest.version), you asked for $Version. Bump the manifest first."
  }

  # THE TAG BELONGS ON MAIN. main is what the Obsidian directory installs from and what a
  # release is tagged on -- CONTRIBUTING states it -- and a script that tags wherever HEAD
  # happens to be will eventually tag a develop commit. The sister repo did exactly that
  # once (vault-graph#47): 1.8.0's tag sits three commits back from main's own history,
  # `git log main` does not show where that release was cut, and a published tag cannot be
  # moved afterwards without breaking every link to it. So this is a class of mistake that
  # has to be caught BEFORE the tag exists, which is the one moment it is still free to fix.
  $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne 'main' -and -not $AllowAnyBranch) {
    throw ("On '$branch', not main. main is what the Obsidian directory installs from and " +
           "what a release is tagged on, and a tag cut elsewhere sits off main's history " +
           "permanently. Merge into main first, or pass -AllowAnyBranch if you know why.")
  }

  # ORIGIN/MAIN IS FETCHED ONCE, HERE, because both guards below measure against it and
  # "equal to a stale remote ref" is not measured at all.
  #
  # AN EXPLICIT REFSPEC, not `git fetch origin main`. That form opportunistically
  # fast-forwards the LOCAL main as well, which the sister repo observed it doing while
  # this guard was being written -- a check that silently moves a branch is not a check.
  # This updates the remote-tracking ref and nothing else.
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & git fetch origin 'refs/heads/main:refs/remotes/origin/main' --quiet 2>&1 | Out-Null
  $ErrorActionPreference = $prevPref
  $originMain = (& git rev-parse --verify --quiet 'refs/remotes/origin/main')
  if ($originMain) { $originMain = $originMain.Trim() }

  # ...AND IT HAS TO BE EXACTLY THE MAIN EVERYONE ELSE CAN SEE (after vault-graph#94). main
  # only ever receives develop, through a pull request merged on the website -- the
  # branch-policy check governs the button and the ruleset will require it once this repo is
  # public -- so by the time this script runs, main is origin/main or it is wrong.
  # BEHIND means tagging a main that is missing commits somebody else has already published.
  # AHEAD means a merge made locally that no push can land: the sister repo's script called
  # that the normal case and pushed HEAD itself, which is how 2.4.0's first cut wrote its tag
  # and then watched the push come back with GH013 -- the tag already sat on a commit origin
  # would never accept. Both are caught here, the one moment a wrong tag is still free to
  # not exist.
  if ($branch -eq 'main') {
    if (-not $originMain) {
      Write-Host ("`nno origin/main to compare against -- skipping the equality guard. " +
                  "That is the first release, or a clone that cannot reach origin.") -ForegroundColor Yellow
    } else {
      $behind = (& git rev-list --count 'HEAD..refs/remotes/origin/main').Trim()
      $ahead  = (& git rev-list --count 'refs/remotes/origin/main..HEAD').Trim()
      if ($behind -ne '0') {
        throw ("main is $behind commit(s) behind origin/main. Pull first -- tagging here " +
               "would tag a main that is missing what is already published.")
      }
      if ($ahead -ne '0') {
        throw ("main is $ahead commit(s) ahead of origin/main, and main only ever receives " +
               "develop through a pull request merged on the website (the ruleset will " +
               "refuse a direct push with GH013: changes must be made through a pull " +
               "request). Open develop -> main on the website and merge it, then " +
               "'git switch main' and 'git pull --ff-only', and run this again. Nothing " +
               "was tagged.")
      }
    }
  }

  # AND ON MAIN'S FIRST-PARENT LINE, which is a different question from "on main" and the
  # one vault-graph#47 actually turned on. `git log main` walks first parents: the merges,
  # not what they merged. A commit main MERGED is in main's history and is not on that line,
  # so a tag there is invisible to `git log main` for good -- which is what 1.8.0 is.
  #
  # NO ESCAPE HATCH, and deliberately, where every other guard here has one. -AllowAnyBranch
  # means "this tag is not meant to be on main's line" -- a hotfix line, say -- and such a
  # commit is not in origin/main's history at all, so it never reaches this guard. What this
  # guard refuses is the OTHER thing: a commit origin/main already contains, but as something
  # it merged. There is no release that wants that instead of the merge, and the mistake is
  # permanent once published. github#5
  if ($originMain) {
    $head = (& git rev-parse HEAD).Trim()
    & git merge-base --is-ancestor $head 'refs/remotes/origin/main' 2>&1 | Out-Null
    $inMain = ($LASTEXITCODE -eq 0)
    if ($inMain) {
      $onLine = @(& git rev-list --first-parent 'refs/remotes/origin/main') -contains $head
      if (-not $onLine) {
        throw ("HEAD ($($head.Substring(0,7))) is in origin/main's history but not on its " +
               "first-parent line -- it is a commit main MERGED, not a point main was at. " +
               "`git log main` walks first parents, so a tag here never appears in main's " +
               "own log, and a published tag cannot be moved (vault-graph#47 shipped 1.8.0 " +
               "exactly this way). Tag the merge commit instead: git switch main.")
      }
    }
  }

  # A release has to be reproducible from its tag, and it cannot be if the tree it was
  # built from is not the tree the tag points at.
  $dirty = (& git status --porcelain) | Where-Object { $_ }
  if ($dirty -and -not $AllowDirty) {
    Write-Host ($dirty -join "`n") -ForegroundColor DarkGray
    throw "Working tree is dirty. Commit first, or pass -AllowDirty if you know why."
  }

  # A tag already ON THIS COMMIT is a resumed run, not a mistake -- the sister repo's first
  # version of this script died between pushing and publishing, and refusing to continue
  # would have meant deleting a good tag to re-make it identically. A tag pointing anywhere
  # else is still a hard stop.
  $tagExists = [bool] (& git tag -l $Version)
  if ($tagExists) {
    $at = (& git rev-parse ($Version + '^{commit}')).Trim()
    $head = (& git rev-parse HEAD).Trim()
    if ($at -ne $head) { throw "$Version already exists and points at $($at.Substring(0,7)), not HEAD. Bump, or delete the tag." }
    Write-Host "$Version already tags HEAD -- resuming." -ForegroundColor Yellow
  }

  # The CHANGELOG is the release notes. A version with no section is a version whose
  # changes nobody wrote down, which is worth stopping for.
  # ReadAllText with an EXPLICIT encoding, not Get-Content: PowerShell 5.1 decodes a
  # BOM-less UTF-8 file as cp1252, so an em-dash arrives as three mojibake characters and
  # a later -Encoding utf8 write persists them -- into the tag message and the published
  # release notes, where they are permanent.
  $changelog = [IO.File]::ReadAllText((Join-Path $repo 'CHANGELOG.md'), [Text.Encoding]::UTF8)
  if ($changelog -notmatch [regex]::Escape("## $Version")) {
    throw "CHANGELOG.md has no '## $Version' section. Write the release notes first."
  }
  # Everything from this version's heading to the next one.
  $section = [regex]::Match($changelog, "(?s)##\s+" + [regex]::Escape($Version) + ".*?(?=\r?\n## |\z)").Value.Trim()

  # THE UPDATE NOTE IS PART OF A MINOR OR MAJOR (github#33). The plugin shows
  # plugin/whats-new.md once, on the first open after such an update -- but only when the
  # note's version matches the installed one, so a release that forgot to write it would
  # ship silently: nothing fails, the strip never appears, and nobody is told. A PATCH shows
  # nothing by design and keeps the previous note in place, so only x.y.0 is checked here.
  # A MISSING file is the same refusal as a stale one, not a crash: it is exactly the state a
  # repository is in before the first note is written, and the self-test stands in it.
  $notePath = Join-Path $repo 'plugin\whats-new.md'
  $noteVersion = ''
  if (Test-Path -LiteralPath $notePath) {
    $noteText = [IO.File]::ReadAllText($notePath, [Text.Encoding]::UTF8)
    $noteVersion = [regex]::Match($noteText, '(?m)^#\s+(\d+\.\d+\.\d+)\s*$').Groups[1].Value
  }
  if ($Version -match '\.0$' -and $noteVersion -ne $Version) {
    $has = if ($noteVersion) { "is for '$noteVersion'" } else { 'names no version' }
    throw "plugin/whats-new.md $has, not $Version. A MINOR or MAJOR ships an update note (github#33) -- write it first."
  }

  # AND IT HAS TO BE LOOKED AT (github#33). The guard above proves the note EXISTS and is for
  # this version; it proves nothing about what a user will actually see. The strip is a
  # user-facing surface that ships in the release, and numbers cannot see it.
  # scripts/update-note-check.mjs mounts it in a real Obsidian and writes 01-strip-up.png;
  # this only names the command, because it drives Obsidian on a display and claims
  # screen-left, which is not something to do from inside a release script.
  if ($Version -match '\.0$') {
    Write-Host "`n=== update strip ===" -ForegroundColor Cyan
    Write-Host "  plugin/whats-new.md is for $noteVersion. RENDER IT AND LOOK BEFORE YOU TAG:" -ForegroundColor Yellow
    Write-Host "    node scripts/update-note-check.mjs --out <dir>   # 01-strip-up.png" -ForegroundColor DarkGray
  }

  Write-Host "`n=== release notes ===" -ForegroundColor Cyan
  Write-Host $section -ForegroundColor DarkGray

  # THE README HERO IS A RECORDING, AND IT GOES STALE SILENTLY. Nothing about a build fails
  # when assets/demo.webp shows a library three releases old -- it just keeps advertising the
  # wrong thing to everyone who lands on the repo. Re-recording is part of cutting a
  # release:
  #
  #   node scripts/record-demo.mjs --hero assets/demo.webp
  #
  # A WARNING, NOT A GATE, and deliberately: only a person can say whether anything
  # visible actually changed, so a hard stop on a docs-only patch would be wrong often
  # enough to get trained away, and then it would not be read at all.
  #
  # IT COMPARES COMMIT DATES, WHICH IS A PROXY AND NOT THE TRUTH. Encoding an old take and
  # committing it today makes a stale hero look fresh. Silence here means "no evidence of
  # staleness", not "the hero is current".
  $heroAt = (& git log -1 --format=%ct -- assets/demo.webp) | Select-Object -First 1
  $srcAt  = (& git log -1 --format=%ct -- src) | Select-Object -First 1
  if ($heroAt -and $srcAt -and ([int64]$srcAt -gt [int64]$heroAt)) {
    $heroOn = (& git log -1 --format=%cs -- assets/demo.webp) | Select-Object -First 1
    $srcOn  = (& git log -1 --format=%cs -- src) | Select-Object -First 1
    Write-Host "`n=== hero ===" -ForegroundColor Cyan
    Write-Host ("assets/demo.webp was last committed $heroOn; src/ has changed since ($srcOn). " +
                "Re-record and re-encode, or carry it knowingly.") -ForegroundColor Yellow
  }

  # THE SAME PROXY, PER FEATURE -- see .ai-context/releasing.md's "Feature clips" section.
  # Unlike the hero, a feature clip is NOT expected to be re-recorded every release, so this
  # never blocks and does not claim to know which act a change actually touched -- it warns
  # against the whole of src/page.js (where every act lives), same as the hero warns against
  # the whole of src/, and leaves "does this actually need re-recording" to whoever reads
  # CHANGELOG.md and decides.
  #
  # IT WALKS THE CLIPS, NOT A PER-FEATURE DOC. The sister repo keeps one markdown file per
  # feature with a `Last re-recorded` line and reads that; here `docs/features.md` is a single
  # page and the clips sit beside it, so the clip's own commit date is the only proxy there is.
  # Reading a directory of per-feature docs that does not exist would have made this warning
  # unable to fire at all, which is worse than not having it.
  $pageAt = (& git log -1 --format=%ct -- src/page.js) | Select-Object -First 1
  $pageOn = (& git log -1 --format=%cs -- src/page.js) | Select-Object -First 1
  $featureClips = Get-ChildItem (Join-Path $repo 'docs/features') -Filter '*.webp' -ErrorAction SilentlyContinue
  $staleFeatures = @()
  foreach ($doc in $featureClips) {
    $name = $doc.BaseName
    $clip = "docs/features/$name.webp"
    $clipAt = (& git log -1 --format=%ct -- $clip) | Select-Object -First 1
    if (-not $clipAt) { continue }   # no clip recorded yet -- not staleness, just not done yet
    if ($pageAt -and ([int64]$pageAt -gt [int64]$clipAt)) {
      $clipOn = (& git log -1 --format=%cs -- $clip) | Select-Object -First 1
      $staleFeatures += "  $name`: clip committed $clipOn, src/page.js changed since ($pageOn)"
    }
  }
  if ($staleFeatures.Count) {
    Write-Host "`n=== features ===" -ForegroundColor Cyan
    Write-Host "src/page.js has changed since these feature clips were last recorded:" -ForegroundColor Yellow
    $staleFeatures | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
    Write-Host ("Re-record whichever ones this release actually changed visibly -- see " +
                "`".ai-context/releasing.md`". Not every one; that call is yours.") -ForegroundColor Yellow
  }

  # THE PLUGIN BUILD IS A PRE-FLIGHT, not an artifact. Nothing local consumes main.js at
  # release time -- the workflow builds its own copy from the tagged commit and attests that
  # -- but a build that fails in CI leaves a TAG WITH NO RELEASE, and a published tag cannot
  # be re-cut. Ten seconds here buys the one failure mode that split introduces. Both outputs
  # are gitignored, so this cannot dirty the tree.
  Write-Host "`n=== lint ===" -ForegroundColor Cyan
  try { Invoke-Native npm @('run', 'lint', '--silent') }
  catch { throw "lint failed -- not releasing (npm ci first, if this is a fresh clone)" }

  Write-Host "`n=== build (pre-flight) ===" -ForegroundColor Cyan
  try { Invoke-Native node @((Join-Path $here 'build-plugin.mjs')) }
  catch {
    throw ("the plugin build failed -- the workflow would fail the same way and leave a tag " +
           "with no release. Fix it first (npm ci, if this is a fresh clone).")
  }

  # A TREE IS GATED ONCE (github#5, decisions/0010). scripts/smoke.mjs stamps the tree it
  # passed; the dry run on the release branch is normally that run, and the merge into main
  # carries the same tree, since main only ever receives develop. So the suite is skipped
  # here when HEAD's tree already has a stamp against the fixtures now in the store, and the
  # stamp it trusts is NAMED. -ForceSuite runs it regardless. When it does run, it runs under
  # the machine-wide suite lock (scripts/lock.mjs, design/0006) and releases it on every way
  # out -- a lock held by a dead script makes every other worktree wait out its stale window.
  #
  # THE PASS LINE IS REQUIRED, not merely exit 0. The sister repo found suite-stamp.mjs
  # exiting 0 while printing nothing when it was invoked through a directory junction (its
  # CLI guard compared a realpath'd path against an un-resolved argv[1]), and a silent exit 0
  # read as "stamped" -- so the suite never ran on a push from any Orca worktree. Both halves
  # are realpath'd now, and this reads the line rather than the code.
  Write-Host "`n=== invariants ===" -ForegroundColor Cyan
  $stamped = $false
  if (-not $ForceSuite) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $stampOut = @(& node (Join-Path $here 'suite-stamp.mjs') check HEAD)
      $stampRc = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prev }
    $stampOut | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
    $stamped = ($stampRc -eq 0) -and (($stampOut -join ' ') -match 'passed the invariant suite')
  }
  if ($stamped) {
    Write-Host "HEAD's tree already passed the suite -- skipping it (-ForceSuite to run it anyway)" -ForegroundColor Yellow
  } else {
    $lockOwner = "release.ps1 $Version"
    try { Invoke-Native node @((Join-Path $here 'lock.mjs'), 'acquire', 'suite', '--owner', $lockOwner) }
    catch { throw "could not take the suite lock -- another suite is running (node scripts/lock.mjs status); not releasing" }
    try {
      # --no-lock: this script is holding the lock already (github#8). smoke.mjs takes it
      # itself now, and a nested acquire would wait for its own parent.
      try { Invoke-Native node @((Join-Path $here 'smoke.mjs'), '--no-lock') }
      catch { throw "the invariant suite failed -- not releasing" }
    } finally {
      $prev = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      try { & node (Join-Path $here 'lock.mjs') release suite --owner $lockOwner } finally { $ErrorActionPreference = $prev }
    }
  }

  if ($DryRun) { Write-Host "`n-DryRun: stopping before the tag and the push." -ForegroundColor Yellow; return }

  Write-Host "`n=== tag ===" -ForegroundColor Cyan
  # Annotated, with the notes as the message, so `git show <tag>` tells the same story as
  # the Release page.
  $msgFile = Join-Path $env:TEMP "vs-tag-$Version.txt"
  # No BOM -- git and gh both read these as bytes, and a BOM ends up in the tag message.
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($msgFile, $section, $utf8)
  # --cleanup=verbatim: git's default strips every line starting with '#' from a tag message
  # as a comment, and the message here IS the CHANGELOG section, so the default silently ate
  # the '## <version>' heading and every '###' section from three of the sister repo's tags
  # (vault-graph#47). `git show <tag>` is meant to tell the same story as the Release page.
  if (-not $tagExists) { Invoke-Native git @('tag', '-a', $Version, '--cleanup=verbatim', '-F', $msgFile) }
  Remove-Item $msgFile -ErrorAction SilentlyContinue

  # THE TAG, AND ONLY THE TAG. The workflow refuses to publish a tag that is not in
  # origin/main's history, and it starts the moment the tag lands -- so a tag pushed before
  # its commit is on origin/main would race its own guard. The equality guard above is what
  # closes that window: on main, HEAD IS origin/main, and it got there through the pull
  # request the branch policy requires. This script used to push HEAD first for that reason;
  # against a ruleset that push is a no-op at best and a GH013 at worst, after the tag has
  # already been made (vault-graph#94). Off main (-AllowAnyBranch) nothing pushes the branch
  # either -- the workflow will refuse the tag, as that switch says.
  Write-Host "`n=== push ===" -ForegroundColor Cyan
  Invoke-Native git @('push', 'origin', $Version)

  # AND STOP. .github/workflows/release.yml takes it from here: it builds main.js and
  # styles.css from the tagged commit, attests the three files with build provenance, and
  # creates the Release with the CHANGELOG section as its body, verbatim. That section was
  # reviewed on the release branch as the page it was about to become (github#27, after
  # vault-graph@af7a43f); once the tag exists nothing is edited, so nothing here asks for
  # an edit. What is left is the record of what was run.
  Write-Host "`npushed $Version. The release is the workflow's now." -ForegroundColor Green
  Write-Host @"

  Watch it:      gh run watch
  Or open it:    gh run list --workflow=release.yml --limit 1

  When it is green, the Release exists with main.js, manifest.json and styles.css
  attached -- the three files Obsidian installs -- each with a build-provenance attestation:

    gh attestation verify main.js --repo luke321/vault-shelf

  The release body is the '## $Version' section, verbatim, as it was reviewed on the
  release branch. Do not edit it now: once the tag exists nothing changes, and a fix is
  the next patch version.

  STILL YOURS TO DO: finish .ai-context/verification-$Version.md with the workflow run,
  the three SHA-256s and the attestation check -- the rows only the tag run can fill.
  releasing.md has the template.
"@ -ForegroundColor Cyan
} finally {
  Pop-Location
}
