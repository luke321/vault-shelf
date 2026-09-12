# 0026 — What the vault spells

**Date** 2026-09-12 · **Status** accepted · **Issue** [#41](https://github.com/luke321/vault-shelf/issues/41)

## Context

The search box was the one control in the product that did not know what the vault contains, and
it was surrounded by things that do. Every classifier has already collected every person, every
tag, every folder, every book key and every title, and they were all sitting in memory behind the
spines. Type `gardne` and the room said **0 notes in 0 books** — the same thing it says for a vault
with no gardening in it at all.

**The cost, measured before anything was built.** On the one vault (`decisions/0014`) — 4,938
notes, 691 books, and therefore **37,423 book-note slots**, because a note with seven addresses is
scanned seven times — `matchesQuery` reads every note's title, path, tags, people and body on every
keystroke:

| typed | ms |
|---|---|
| `g` | 5.1 |
| `garden` | 14.8 |
| `gardenx` (matches nothing) | 17.8 |
| **median / worst** | **14.5 / 17.8** |

The vocabulary that vault can offer: 25 people, 43 tags, 12 folders, 691 book labels and 4,938 note
titles — **5,689 distinct terms** after deduplication, of which two are non-Latin (`学び`, `работа`).

## Decision

**Picking a suggestion completes the text, and nothing else.**

The box still holds a string, `core.markMatches` still runs over it, every book stays on the shelf,
and `#vs-hits` still counts. `design/0008`'s law — *a filter narrows; the query marks* — is untouched
because **the query path does not change at all**. What changed is only what a person can spell into
it.

Two alternatives were on the table and both were refused:

- **Navigating to the picked book.** `Tomas Ek` really is a book on the People shelf, and a library
  catalogue really is a way to a place. But then the box is not searching: `#vs-hits` has nothing
  left to count, and a note-title suggestion has to mean something different from a tag one, so one
  list quietly does two things.
- **Narrowing — picking `tag: garden` as a filter.** The most powerful of the three, and the only
  one that can break *every note has at least one address* if it does not go through the filter path
  that already exists. It also needs tag and person filters, which the product does not have:
  `Filters` is folders and dates.

### The kind label is not decoration, and dedup is what makes that true

The objection to completing text is obvious: if a tag `garden` and a folder `garden` both complete
to `garden`, they are two rows that do the same thing, and the kind becomes ornament — which is
exactly what the issue warned against.

So the vocabulary **deduplicates on the folded spelling**. One row per distinct term, carrying
*every* kind that spells it, and the count of the distinct notes it names:

```
garden           tag · folder    412
garden/seeds     tag              38
```

The row now says the word lives in two places, which is information; and picking it still does
exactly one thing, so there is nothing to guess about before clicking.

### One flat string, no grammar

No `person:` / `tag:` / `folder:` operators. The kind is **shown** on the row and never typed. A
parser belongs in `core` with its own checks, and it has to survive a query it cannot parse without
eating the plain-substring search that works today — that is a second feature, and this one does not
need it now that a row can carry several kinds.

### Folding is `.toLowerCase()`, deliberately

Identical to `matchesQuery`. **Not** NFC-normalised, and not `toLocaleLowerCase`: normalising the
vocabulary while the query is not normalised is precisely how a box comes to offer a suggestion
that then marks nothing, and a locale-dependent fold makes two hosts disagree. Being consistent
with the search that exists beats being cleverer than it.

The invariant that falls out of this is worth more than the rule: **every suggestion the box offers
marks at least one note when it is picked**, and a check asserts it by picking every row offered for
twelve probes and requiring `#vs-hits` to be greater than zero.

### Offered on contains, ranked on prefix

Strict *starts with* is the wrong reading of "autocomplete" for this product. It puts `garden/seeds`
out of reach of someone typing `seeds`, and since `toLowerCase()` is a no-op on CJK it does nothing
useful for `学び` either. So a term is **offered** when the folded needle appears anywhere in it, and
**ranked** by whether it appears at position 0 — prefix matches sort above contains matches, so the
common case still reads as completion, and the long tail is still reachable.

The full ranking, in order: prefix before contains; structural kinds (person, tag, folder, book)
before a bare note title; more notes before fewer; shorter text before longer; then folded
lexicographic, so the list is deterministic and two runs over one vault offer the same thing.

### Note titles are capped

Titles are 4,938 of the 5,689 terms. Uncapped, typing a common word buries the tag under two hundred
note titles. `SUGGEST_ROWS = 8`, of which at most `NOTE_ROWS = 3` may be titles, and titles rank last
— so the structural vocabulary is always visible, and a title still gets in when it is what you meant.

### The list is a combobox, so it is an accessibility feature

`#vs-q` carries `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-autocomplete="list"`.
The rows are `role="option"` reached through **`aria-activedescendant`**, not focusable controls:
focus never leaves the box, so the arrows cannot scroll the room behind the list, and `every control
the keyboard can reach has a name` does not gain eight nameless rows. Escape closes the list and
keeps the box; a click anywhere else closes it, and so does a blur.

An open list is **the page still in flight** (`decisions/0013`): `atRest` sees it and `settlePage`
closes it, rather than a check being allowed to return with it hanging over the library.

### A look is paint

`page.css` owns the list's geometry — the row height, the padding, the type sizes, the max height —
in pixels, so `leather` and `cyber` may repaint it and move nothing. The width is written by
`placeSuggest()` from the box it hangs under, so it tracks the search field in the narrow layout as
well. It is placed absolutely inside `#vs-app` like `.vs-dye` and `.vs-peek` — there is no portal out
of the page, because Obsidian's own stylesheet is right there.

### The other search box is left alone

`#vs-within` has the same question and does not get the same answer, yet. The two boxes **do not
agree what a match is**: `#vs-q` reads title, path, tags, people and body; `#vs-within` reads titles
only. That disagreement is `github#13`, and it is still open. Giving the second box a vocabulary
before it is settled would bake the disagreement into a second surface and make `#13` twice as
expensive to fix.

## Consequences

**Typing costs what it cost.** The vocabulary is built once, in `rebuild()`, where the books are
built — never per keystroke. `suggest()` is one `indexOf` per term over 5,689 terms, against the
37,423 note-body scans `markMatches` was already doing.

| | median | worst |
|---|---|---|
| before | 14.5 ms | 17.8 ms |
| after | see `.ai-context/changelog-detail.md` | |

**A vault with nothing to suggest** offers nothing and says so, in one non-pickable row: *Nothing in
this vault spells that.* That is also what a typo gets, which is the case the whole feature exists
for — an empty list would say the same thing as a vault that genuinely has no gardening in it, which
is the bug being fixed.
