# 0003 — Metadata is declared, never inferred

**Date** 2026-09-09 · **Status** accepted, amended 2026-09-10

## Context

Three of the eight classifiers read metadata a vault may or may not have: the date, the
people, and an arbitrary frontmatter property. Each has an obvious cheat available, and each
cheat produces a shelf that is confidently wrong — which is worse than a shelf that is
visibly incomplete, because nobody goes looking for it.

## Decision

**A date comes from a configured frontmatter field, then from a date at the start of the
title, and then from the file's own stamp.** The file's own modification time is available for
every note and is almost never the date the note is about: a sync, a bulk reformat or a
`git checkout` restamps the whole vault at once, and a Months shelf built on that reads as a
decade of notes filed under one month.

An Undated book that is large is a diagnosis. A Months shelf that is quietly wrong is not.

### Revised 2026-09-10 — the stamp is the last resort, not a forbidden one

The stamp was opt-in and **off by default**, and the person this is built for asked for the
opposite:

> "if created frontmatter is not available in a note, fall back to the notes system created
> date stamp"

That is a fair reading of what an Undated book of a few hundred notes is worth. The decision
above still holds for the *order* — declared beats derived, always — and what changes is only
the floor: the stamp is now the last step of `core.resolveDate` rather than a step nobody
takes, and `useFileStamp` is **on** from settings schema 3.

Two things make it defensible rather than a surrender:

**`dates.stampOf` takes the EARLIER of the creation and modification times**, never one of
them. A modification time alone is what this record warned about. A creation time alone is
worse than it sounds, because copying a vault — a new machine, a restore, a move between sync
services — gives every file today's creation time while leaving the modification times intact.
The earlier of the two survives both.

**It is still visible and still reversible.** The exporter prints how many notes were dated
from each source, and the toggle (now "Fall back to the file's creation date") is how you find
out how many notes have no date of their own: turn it off and count the Undated book.

**And it can still be worthless, which the numbers will tell you.** Measured on the author's
own vault the same day this changed: all 545 files stamped inside a four-month window,
`2026-06` to `2026-09`, because the vault was moved onto that machine in June. The 23 notes
with no date of their own take a 2026 date that means "when this vault arrived here", not
when they were written. That is the failure mode this record was written about, and the
answer to it is the same as it always was: **declare the date**.

**People come from the people property and nowhere else.** Scanning prose for capitalised
words finds every place name, product and sentence opener in the vault, and the failure is
not symmetric: a missing person is a gap somebody notices, and an invented one is a
confidently wrong volume with somebody's name on it. A wikilink in the property is unwrapped
to its leaf (`[[People/Mira Vance|Mira]]` becomes `Mira`), because a link to a person note is
the person; the brackets are not.

**Parent-tag inclusion is a visible setting, not a guess.** Whether `#garden` collects
`#garden/seeds` is a real question about somebody's tagging habits with no defensible default,
so it is `includeSubtags` on the shelf, on by default, and it appears in the builder.

**A missing value is its own book**, not an exclusion. `-unfiled` is where a note with no
value for the classifier goes, so a shelf's note count is always the whole of its predicate
and never a silently smaller number.

## Consequences

- The Undated and Unfiled books are load-bearing, not edge cases. Both fixture vaults populate
  them on purpose — the sparse vault puts about a fifth of its notes in Undated.
- `core.resolveDate` is the one implementation. It validates the day rather than trusting the
  string, so `date: 2026-13-45` is not a date and the note goes to Undated.
- *people come from the property alone, never from prose* is the check, and it works by
  planting a known name in note bodies in the fixture and asserting that no note picked it up.

### Revised 2026-09-10 — one people property was never enough

> "how does the people not work? does it need a tag or what? it does not work in my vault"

It did not, and the reason was a default. `peopleProperty` was the single string `"people"`,
and the vault it was being asked about does not have that property on a single note. Measured
across its 545 files: **`attendees` on 187, `person` on 74, `people` on none**. The People
shelf was correctly reporting that nobody was named in a property nobody used.

So the setting is a **list**, `peopleFields`, defaulting to `people, attendees, person` and
merged — the same shape `dateFields` has always had, and for the same reason. A settings file
that named one property keeps it, joined by the conventions; that one WAS a decision, unlike
the defaults schemas 2, 3 and 4 changed. With the list in place that vault yields **124
people** where it yielded none.

`core.cleanPerson` is the other half. A people property in a real vault is rarely a bare name:
it is `"[[Ada Lovelace]]"`, or `"[[People/Ada Lovelace|Ada]]"`, or a quoted scalar in a block
list. The plugin unwrapped those and the exporter did not, which is the same two-implementation
shape that once had the exporter inventing a fifteenth month. Now both call one function — and
it also refuses a `{{placeholder}}`, because a vault that keeps its templates alongside its
notes would otherwise grow a person called `{{VALUE}}` with a book of their own.

### Revised 2026-09-10 — a link to a person's note is a declaration

> "[a person] not showing as people"

They were not, and the rule was right about it: across that vault the person is named in
**no** people property. They are linked from **22 note bodies** — a plain `[[Name]]` in 14, an
aliased `[[Name|First]]` in 16 — and they have a note of their own carrying `type: people`,
like 63 others there. The vault keeps a note per person and lets the link be
the record.

That is still declared metadata. The **target** says what it is, in its own frontmatter; the
linking note says *who* by linking to it. What this record refuses is scanning prose for
capitalised words, and nothing here does that: a bare first name in running text still counts
for nothing, and the check asserts it.

So `personNote` is a setting — `type: people` by default, or a `#tag`; empty turns it off — and
a link to any note that matches it names that person, **by the target's `name` property or its
title**. Which is the one thing a property could never have promised: `[[Ada Lovelace]]` and
`[[Ada Lovelace|Ada]]` are one book, not two. A person's own note does not name itself.

Measured on that vault: **124 people → 140**, and the person in exactly the 22 notes that
link to them. The demo fixture now carries a person who exists only as a link, in 38 notes, half of
them aliased, so the suite holds all of that.

### Revised 2026-09-24 — a tag shelf can shelve by root (`github#68`)

`includeSubtags` answers whether `#garden` *collects* `#garden/seeds`. It never answered whether
`#garden/seeds` gets a book of its own, and on a vault that nests its tags the Tags shelf was
mostly children: `area/health`, `area/home`, `project/…`, each beside its parent. So
`parentTagsOnly` is a second, separate setting on the shelf. It is off by default and appears in
the builder only when a tag makes the book. When it is on, the tag classifier reads each tag as
its top-level segment (`a/b/c` → `a`), once per note. It **folds**, it never drops: a note tagged
only `#garden/seeds` goes to `#garden`, not to Untagged, so every note keeps its address. The
source predicate is untouched and stays `includeSubtags`' question.

Top-level rather than one level up, because "only parent tags" means one book per root. A
middle level would just be a smaller copy of the same clutter. This is still declared metadata:
the slash is the vault's own hierarchy, read as written.

