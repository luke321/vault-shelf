# 0013 — The mirror vault

`scripts/make-mirror-vault.mjs` reads a real vault and writes a fake one with the same
**shape**: the same folder tree, the same 543 notes on the same dates, the same person
appearing in the same forty notes, the same tag hierarchy with the same distribution — and not
one word of real content.

It was built for one reason: the films.

> **Amended by `decisions/0012` (2026-09-11).** It is no longer a step in the film pipeline. The
> film is shot in the one generated vault, and `record-demo.mjs` reaches a mirror only when asked
> — `--mirror-of <path>`. What the mirror *is* did not change, and neither did one line of its
> guard: it stays on disk as the diagnostic you point at your own vault when you suspect the
> product breaks on real data, which is how it earned its keep (it found `date: 2024-15-01`). The
> section below is why a fixture used to be too even to film in; `0012` measured how far apart the
> two actually were and what the one vault had to absorb.

## Why the generated fixtures are not enough

`decisions/0004` stands, and nothing here weakens it. The three generated vaults
(`make-*-vault.mjs`) are what the **suite** runs against, because a check needs a vault it
declares rather than one it discovers, and a suite that reads a real vault fails differently on
every machine.

But a fixture vault is built to exercise the classifiers, and it shows: its folders are
`alpha/`, `beta/`, its people are evenly spread, its tag counts are a smooth curve. A film shot
in it demonstrates the feature and communicates nothing, because the thing Vault Shelf is
actually for — *your* three years of daily notes, *your* one folder with 184 notes in it, *the*
person who is in every meeting — is exactly the part a fixture flattens out. The uneven shelf
from `design/0011` needs a real distribution to be uneven about.

So: fixtures for the checks, a mirror for the camera.

## What is preserved and what is replaced

| Preserved | Replaced |
|---|---|
| the folder tree's shape and depth | folder names, unless structural |
| every note's date, exactly | every note title that is not itself a date |
| how many notes each person is in | every person's name |
| the tag vocabulary's size, hierarchy and distribution | every tag word |
| how many notes each property key groups, and into how many values | every property value, and every key outside a short generic list |
| each note's rough word count | every word |

A folder keeps its name when it is *structural* — numbered (`01 - Projects`), dated (`2026`),
or one of a short list of names every PARA-ish vault shares (`Inbox`, `Archive`, `Daily
Notes`). Those carry no information about the person and their absence would make the mirror
stop looking like a vault. A folder called after a client does not survive.

## One mapping per real name, and that is the whole design

The obvious implementation — replace each name with a fresh random one at each occurrence — is
useless. A person in forty notes would become forty people in one note each, and the People
shelf would mirror nothing: forty thin books instead of one thick one. The same for tags, and
the same for property values, which is what turns a `status` shelf into three books rather than
ninety.

So `peopleMap`, `tagMap`, `valueMap` and `folderMap` are all **stable maps keyed on the real
string**, and a tag is mapped **segment by segment** so `#garden/seeds` stays a child of
`#garden` — a hierarchy the tag classifier reads as a shelf setting.

The PRNG is seeded (`mulberry32`, `--seed 7`). An unseeded generator makes every regeneration a
different vault, so two takes of the same film differ everywhere and comparing them means
nothing.

## The guard is the point

The script ends by collecting every real string it saw — people, tag segments, property values,
non-date titles — and grepping the written output for all of them, path and body. Any hit is a
non-zero exit and no mirror.

This is not belt-and-braces. A mirror exists so a real vault's shape can be filmed without its
content leaving the machine, and the one failure that matters is a mapping quietly falling
through — a frontmatter key nobody thought to map, a name that also occurs as ordinary prose.
That failure is **invisible**: the mirror looks fine, the film looks fine, and a real name is
in a video on the internet. The check is cheap, it runs every time, and it has no skip flag,
for the same reason `check-pii` has none.

If it fires, fix the mapping. Do not relax the check.

## Where the output goes

`mirror-vault/` at the repo root, `.gitignore`d, wiped and rewritten on each run. It is a
build artefact, and the thing it was built from is on the user's disk, not in this repository.
The script refuses to write inside the source vault.

## A property key is a name too

`status`, `type`, `priority` and two dozen others are the generic vocabulary of note-taking and
survive verbatim, or the property picker in the film reads as gibberish. Everything else is
mapped, because `jira_project`, `posthog_dashboard` and `acme_contract` are all the same kind
of fact about somebody's working life and none of them belongs in a video. 44 keys were mapped
out of the author's vault the first time this ran.

## What the guard taught, in the order it taught it

Four rounds, each one a real hole:

1. **`project`** — the tag, against the preserved folder `01 - Projects`. A substring match
   cannot tell a leak from a coincidence, so the match is on **word boundaries**, built from
   unicode classes rather than `\b` (which is ASCII, and would put a boundary inside `Müller`
   and so *miss* a real leak). Words of a deliberately-kept folder name are excused by name.
2. **`2026-W24`, `09-08`** — dates, at every precision and in every notation the vault used.
   A date is the thing being preserved, so `DATE_VALUE` now covers days, months, quarters and
   ISO weeks, and a date-shaped value is neither mapped nor hunted for.
3. **`index`** — a tag in the vault *and* a word in this file's own filler prose. The fix is to
   collect the secrets **before** inventing anything and prune the invented vocabulary with
   them. Excusing the collision instead would have destroyed the only distinction the guard
   exists to make.
4. **the whole English language** — the first pruning attempt banned every word of every
   multi-word secret, and after 543 note titles there was no filler left (`0 usable
   sentences`). Only **one-word** secrets can be hit by a single invented word; a phrase cannot
   be assembled by accident, and the guard is what catches it if it somehow is.

5. **`09:00`** (github#21, 2026-09-11) — a bare clock time in a `start:` property, hunted as a
   secret, found inside a preserved `created: 2026-07-22 09:00`. Both halves were right: the
   stamp is date-shaped and kept, the time was not and was mapped. A time of day is a date at
   a finer precision, so `DATE_VALUE` accepts one on its own and it is neither mapped nor hunted.

Each of those was a passing run away from being invisible. That is the argument for a check
that runs every time and cannot be skipped.

## What it found in the product

The first film shot in a mirror had a Months shelf with a book called **"15 2024"**. The note
is real and its header reads `date: 2024-15-01`. `core.isIsoDay` had always rejected it;
`src/build-shelf.mjs` had its own regex and did not. One vault of real data found a two-
implementation bug that three generated fixtures, 38 checks and a screenshot had not — which
is the whole case for shooting here.
