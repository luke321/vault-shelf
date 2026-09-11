# 0023 — The update note

`github#33`. Ported from Vault Graph's `github#83` / `design/0016`, which was written against
the same problem in the same host: **Obsidian swaps `main.js` under a user silently.** A plugin
updates in the background, the room is different the next morning, and there is no way to find
out what changed without going to look for a changelog nobody links to.

So the plugin says so itself, once: a dismissible strip above the library, on the first open
after a MINOR or MAJOR update, carrying three to five bullets somebody wrote by hand, links to
every release that was missed, and a pulse on the controls the release added.

## The note is a file, and the build refuses a bad one

`plugin/whats-new.md` is the source. It has a three-line grammar — `# <version>` once,
`- <text>` bullets, `> <ids>` controls — and everything about it is checked at **build time**
by `scripts/build-plugin.mjs`, not at run time:

| | |
|---|---|
| `NOTE_MAX_BYTES` | 4096 |
| `NOTE_MAX_LINES` | 5 bullets |
| `NOTE_MAX_LINE_CHARS` | 160 per bullet |
| `POINTS_MAX` | 4 control ids, each matching `^vs-[a-z0-9-]+$` and each an `id="…"` in `src/page.html` |
| `CHAIN_MAX` | 8 release links before the rest collapse into one `…` |

**Any problem is no note.** `parseNote` returns `{ note: null, problems }` rather than a
best-effort object, the build throws on it, and the plugin — which calls the same parser on the
same inlined text — shows nothing. There is no path where a half-parsed note reaches a reader.

The bullets are **text**: a `data:` URI or any markup is a problem, because the strip builds its
own links and a note that can carry markup is a note that can carry anything. `markup` here
means `<` followed by a letter, `!` or `/`, so *a < b, and 3 > 2* is fine and `<img src=x>` is
not.

## The chain comes from the CHANGELOG, at build time

`vs:releases` is an esbuild namespace: it parses every `## <version>` heading out of
`CHANGELOG.md` and inlines the list. Two consequences, both deliberate — **the chain cannot
name a release that was never published**, because the CHANGELOG is what publishes it; and
**nothing is fetched**, which is `decisions/0006` unchanged.

`releaseChain` lists every `x.y.0` strictly after the version last seen and not after the note's
own, oldest first, with the note's own version last. Patches are left out: a patch shows nothing
(see the table), so linking one would offer a reader a page with nothing on it they were not
already told.

## The decision table

`decideNote` answers two questions at once — what to **show**, and whether to **record** the
installed version now. Recording is what makes the note appear once.

| installed vs. last seen | shows | records | why |
|---|---|---|---|
| no `data.json` at all | — | now | `fresh install` |
| `data.json` with no marker | the note | on dismiss | `upgrade from before update notes` |
| MINOR or MAJOR up | the note | on dismiss | `minor or major bump` |
| PATCH up | — | now | `patch` |
| same | — | never | `already seen` |
| down | — | now | `downgrade` |
| up, note is for another minor | — | now | `the note is for X, not Y` |
| up, no note at all | — | now | `no note` |
| `lastSeenVersion` is not semver | — | now | `lastSeenVersion is not semver` |
| installed version is not semver | — | never | `installed version is not semver` |

Four of those rows are decisions rather than mechanics, and they are Vault Graph's, taken with
Lukas and carried over unchanged:

- **Seen on dismiss, not on open.** Recording on open means a crash, a reload or a second
  window between opening and reading costs the reader the note entirely. Dismissing is the only
  event that proves it was seen.
- **A fresh install gets nothing.** Somebody installing the plugin for the first time is not
  being told what changed since a version they never had.
- **A MINOR whose note is for another version shows nothing, never a stale one.** This is what
  `release.ps1` refuses an `x.y.0` over: a release that forgot to write its note would otherwise
  ship in silence, and nothing else would fail.
- **One synced `data.json` means the first device to dismiss wins.** The marker is one string in
  one file; a vault synced across machines has one of it. Showing it again per device would need
  per-device state in a file that is deliberately per-vault.

## Where the marker lives, and why not in the core

This is the one place the port is not a copy. Vault Graph merges its settings as
`Object.assign({}, DEFAULTS, saved)`, so a key it has never heard of survives a round trip. Here
`core.migrate()` returns a **fixed shape** (`decisions/0001`) and drops everything it does not
know — so `lastSeenVersion` inside `config` would be written once and erased by the next
settings change, and the strip would come back on the open after that.

So the marker is **not** in `Persisted`. `VaultShelfPlugin` holds it beside `config` and
`persisted()` merges it back on every `saveData`. The core stays what it is: notes in, books
out. A host's record of what it has already announced is not a property of a shelf, and putting
it there would have meant a schema bump for a field no classifier will ever read.

`recordVersion()` writes the marker onto **what is on disk**, re-read at the moment of writing —
never the defaults onto an empty file, and never an `onload`-era snapshot, so a settings change
made while the strip was up is not rolled back by dismissing it.

## The strip is above the page, not inside it

`.vault-shelf-view` is a flex column: the strip is `flex: 0 0 auto` and the library
`flex: 1 1 0%`. So the room is **the same width** with the strip up and gives its height back
when it is dismissed, without the page knowing the strip exists — `src/page.js` has no idea, and
the standalone export does not have one at all, which is right: nothing updates an exported HTML
file behind anybody's back.

The pulse (`vs-new`) is a `box-shadow` animation on a control the note points at, in the host's
own `--interactive-accent`, and it stops on dismiss — in **every** open leaf, not just the one
that was clicked, because each has its own copy of the strip. `prefers-reduced-motion` gets a
static ring instead of the animation.

## What checks it

- `scripts/update-note-selftest.mjs` — **51 cases** over the grammar, the decision table, the
  CHANGELOG parse and the chain. Pure Node, no Obsidian, no Chrome, well under a second; it runs
  in the pre-push hook and in `release.yml`, with no skip flag.
- `scripts/update-note-check.mjs` — **a real Obsidian**, over seven seeded `data.json` states,
  claiming `screen-left` (`github#37`, `decisions/0012`). It is the answer to "numbers cannot
  see": it writes `01-strip-up.png` and three more, and `release.ps1` names it on every `x.y.0`
  because a user-facing surface that ships without anybody having looked at it is exactly how
  Vault Graph shipped its own.

Two departures from Vault Graph's harness, both because this is a different page. It asserts
nothing about a canvas, a camera or `--vg-canvas-top` — the library is DOM, so the equivalent
measurement is the room's own box, taken with and without the strip. And the **multi-release
chain is seeded** rather than read from `CHANGELOG.md`: this repo has one release, so the real
chain can only ever be one link today. Which releases belong in a chain is the selftest's
question; that they are *drawn* oldest first, each linking its own page, is the harness's.

## What 0.1.0's note does not do

It carries no `>` line. That line names what a release **added**, and on the first release that
is the whole page — pointing at four controls would be a claim about novelty that is not true.
The pulse is still proved: the harness injects a note that points at `vs-order` and measures the
computed animation.
