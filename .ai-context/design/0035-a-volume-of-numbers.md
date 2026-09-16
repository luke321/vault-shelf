# 0035 — A volume of numbers

[0030](0030-contents-order.md) gave a book two contents orders, A–Z and Date, and
[0034](0034-the-thumb-index.md) gave the Encyclopedia's `0-9` volume a thumb index that opens
into its years. Neither fixed the thing underneath both: **A–Z on digits is a sort nobody
means.** `github#70`.

> "A volume of numbers is ordered by its characters, so 3 and 7 land after 2026."

Measured on the vault shape before this work, the `0-9` volume's 2,064 notes opened:

```
0 to 1               2025-10-31
1000 small decisions 2026-09-12
12 weeks of running  2021-02-21
2015-09-19
...
2026-09-11
202212331243         2026-09-03
24 hours without the phone
3 notes on attention
42 and after
7 day sourdough
99 problems with the ...
```

`1000` sorts above `12`, and `24`, `3`, `42`, `7` and `99` fall off the end behind eleven years
of dated notes, because `'2' < '3' < '4' < '7' < '9'` on the first character. Read as numbers
they are 0, 3, 7, 12, 24, 42, 99, 1000 — all of them at the front, where a reader looks for
them. And the index inherited it: those notes drew **three** separate cuts labelled `0-9`
scattered around the years, plus a `1000` cut that reads as a year and is not one — which
[0034](0034-the-thumb-index.md) recorded, correctly by its own rule, under *Known and left*.

## A third mode, not a special case for one volume

`core.IndexMode` gains `"number"`. Because `readingOrder` reads `indexMode`, one change moves
the contents and the rail together, which is [0030](0030-contents-order.md)'s existing law: **a
tab is a position in the contents.**

| | |
|---|---|
| **what a number is** | the leading digit run, after the trim `firstLetter` already uses — so what this reads a number off is exactly what the classifier filed under `0-9`. `12 weeks of running` is 12, `2015-09-19` is 2015, `01 - Inbox` is 01 |
| **how two compare** | by length with leading zeros stripped, then by characters. That is the whole of numeric comparison, it is exact for the twelve digits of `202212331243`, and there is no float in it to argue about. A tie falls to the existing title comparator; a note with no leading digit sorts last, so the comparator stays total for a book that has stopped being all numbers |
| **who gets it** | a **non-empty** book every one of whose notes opens with a digit. That is the `0-9` volume by construction, and it admits a folder or tag book of `01 - Inbox`, `02 - Areas` without naming it |
| **where it stands** | in the **A–Z slot**, never beside it: a book is still offered two modes, and on such a book the pair is Number and Date |

**It substitutes for the AUTOMATIC `az`, never for `date` and never for a saved mode.** This is
the line that keeps it from spreading. A Months book of daily notes is *also* all digits, so a
mode that displaced `date` would re-cut every date shelf in the library — nobody asked for that,
and it would move books whose order is already the one they are named for. A saved `az` is a
choice somebody made and is returned untouched. `indexMode(shelf, key, notes)` takes the notes
as an optional third argument, so a **shelf** picker — which has no one book — is unchanged and
still offers the two it always did.

**And like `az`, it ignores the reading order.** That is not incidental: it is the whole reason
this exists rather than the date book [0034](0034-the-thumb-index.md) built and pulled.
`readingOrder`'s date comparator is multiplied by the top bar's oldest/newest, so a `0-9` volume
made a *date* book began answering a control its twenty-five siblings ignore, and *date contents
default to oldest and saved newest settings remain readable* went red asserting exactly that.
`number` has no such coupling, and that check stays green.

## One cut per distinct number, and not a range

The issue proposed ranges — `0–99`, `100–999`, `2015` — on the reasoning that one cut per
distinct number is one cut per note. It is not: distinct **leading** numbers over the volume are
0, 3, 7, 12, 24, 42, 99, 1000, twelve years, and `202212331243` — **twenty cuts**, well inside
the rail's structural ceiling of 32 closed.

And ranges are a solved problem one level up. [0034](0034-the-thumb-index.md)'s `fitTabs` halves
a level that will not fit into spans and names each by where it starts, measured rather than
calculated. A second answer to that question, wired into one mode, would give one book two
indexes.

**A four-digit cut opens the way it already did.** `numberCuts` hands a `/^\d{4}$/` key to
`TITLE_DATE_LAYERS`, which is the same branch `prefixCuts` takes — so `2026` still opens into
`Sep` and `Sep` into `04`, read off the title. `1000` yields no ISO month and falls out a leaf
on its own, which is what a volume spine does with a number it cannot read.

**A digit run is still named by the digits it opens with, and the mark is a middle dot.**
`202212331243` is `2022·`. [0034](0034-the-thumb-index.md) settled the label and wrote the mark as
`x`; Lukas asked for something that reads as a placeholder rather than as a character of the
number — *"make it smaller and centered vertically"* — and `·` is that glyph, at mid-height and a
third the width. It is **plain text, not a span**: a span with its own `font-size` is an element
*a look moves nothing on the page* measures, and that is the trap [0034](0034-the-thumb-index.md)
records for the `⇄` glyph. Measured, `2022·` is **36px** where `2022x` was 39px, so the rail's
widest label got narrower and the rail stays 60px.

**Rejected: `…`.** The obvious truncation mark, and it does not fit: **43px in the 40px a cut
leaves**, cropped, caught by *no index cut is clipped* on the first run.

And under `number` the run now sits where its label promises: **last**, after every year, rather
than at index 649 between 2022 and 2023.

## The rail says `0-9` and the picker says `Number`

The toggle's box is **55×28 at 10px** and a look may not resize a control
([0016](0016-the-leather-look.md)), so the face has to fit the box it has. `Number ⇄` does not:
measured, its content runs **6px** past the box and **wraps** onto a second line.

**Which every measurement of its width passes.** The check asked for `scrollWidth` against the
box and got −1px — fits — because a wrapped word does fit horizontally. It was found by
*looking at the screenshot*, which is the failure mode this repository names by name, and the
check now measures the height too.

`0–9 ⇄` is `A–Z ⇄`'s own shape and width, it fits with a pixel to spare in the same 55×28 box,
and it says the same kind of thing about what the cuts below it are cut by. The `aria-label`
("Contents: Number. Switch to Date") and the manage-sheet buttons keep the word, so a screen
reader and the picker are unchanged.

**Rejected: widening the toggle.** It would widen the rail, which
[0034](0034-the-thumb-index.md) measured at 60px against the labels it has to carry, and
`page.css` alone owns that geometry.

## Migration

`INDEX_MODES` is now the one list of contents modes, beside `LOOKS`, and `migrate` validates
`indexMode` and every `bookIndexes` entry against it. A settings file written by a newer build
naming a mode this one cannot cut by degrades to the automatic mode rather than breaking, which
is what the old two-value comparison did by hand. **No schema bump**: an older file never
carries `number`, and an older build already drops what it does not know.

## The film

Lukas, on the approved review: extend the act that exists rather than split contents order across
two pages. `contentsorder` was already the 13-second act and `docs/features/contentsorder.webp`
already the clip; both filmed a lettered book and said *"title or date"*, so the shipped clip
under-showed the control the moment this landed.

**The act films the one volume the third mode is about.** A new `inDigits` setup opens
`encyclopedia/0-9` instead of the thickest book on Years, and the beats are Number → Date → a
tab → Number, each with a `prove` on `data-index-mode`. The middle frame is the one worth the
13 seconds: the same note, `0 to 1`, stays selected across the switch and moves from **1 of
2,064** to **1349 of 2,064** — *the reader's switch keeps the note*, which no still can show.

**The title names three, the sub says why two are on screen.** A caption reading *"title, date or
number"* over a clip that never shows A–Z is a small lie; the sub carries the reason — *"A volume
of numbers opens in Number"* — and the feature page's prose still covers all three. The headings
are `Choose A–Z, Date or Number` now, in `docs/features.md` and the page itself.

**Square, because every other feature clip is.** The first take came back **1000×626**: the hero
encoder is `scale=1000:-2` with no crop, so the shape is the *capture's*, and the shipped clips
were all shot at `--width 1000 --height 1000`. Re-shot square, 551 KB at 8fps.

**And `--hero-acts` is not `--act`.** The first run filmed the whole storyboard and failed 720
frames into `hero`, because `--hero-acts` only says which acts the webp is *cut from*.
`--act contentsorder` is what limits the shoot.

**The hero was re-shot too** (`assets/demo.webp`, 68s, 1000×1000, 3,578 KB), on Lukas's call.
Nothing in its frame moved — this ticket changes the order of notes inside one book, and no layout
golden moved — so it is a re-record of the same choreography with a later commit date, which is
the only thing `release.ps1` can compare.

## What moved

Measured 2026-09-15 on the vault shape (`vault-c1f3a5ca`, 4,939 notes), the `0-9` volume.

| | before | after |
|---|---|---|
| the contents open | `0 to 1`, `1000 small decisions`, `12 weeks of running`, 2015-… | **`0 to 1`, `3 notes on attention`, `7 day sourdough`, `12 weeks of running`, `24 hours…`, `42 and after`, `99 problems…`, `1000 small decisions`**, 2015-… |
| top cuts | 16 | **20** |
| cuts labelled `0-9` | **3**, scattered around the years | **0** |
| fat cuts that open | 11 of 12 | **11 of 11** |
| biggest dead end | `0-9` ×5 | **none** |
| `202212331243` | index 649, between 2022 and 2023 | **index 2063, last** |
| its cut | `2022x`, 0 under it | **`2022·`**, 0 under it |
| widest label / rail | `2022x` 39px / 60px | **`2022·` 36px** / 60px |
| the toggle's face | `A–Z ⇄` in 55×28 | **`0–9 ⇄` in 55×28** (`Number ⇄` wraps, 6px over) |
| Encyclopedia `oldest` vs `newest` | byte-identical | **byte-identical** |

## The check

One new.

- **a volume of numbers reads by number, and only such a volume is offered it** — the `0-9`
  volume's 2,064 notes never step back in leading number; every cut in the fitted level is a
  number (`^\d{1,4}x?$`); the rail's face fits its box in **both** directions and is the same
  box the lettered volume's toggle draws; the toggle runs number → date → number; the biggest
  lettered volume stays `az` and its picker offers `az,date` and never Number; and `migrate`
  keeps a saved `number` while dropping a mode it does not know.

  Red on `develop` at the first assertion, and red twice mid-branch: at the face, where
  `Number ⇄` measured 6px over its box, and at the picker, where a numeric book with nothing
  saved drew `number,date` with **neither pressed** — the picker asked the *shelf* what the book
  would fall back to, and a shelf has no notes, so it answers `az`. The picker is therefore read
  **before** the toggle saves a mode; read after, it passes on the saved value and proves
  nothing.
