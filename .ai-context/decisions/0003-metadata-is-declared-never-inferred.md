# 0003 — Metadata is declared, never inferred

**Date** 2026-09-09 · **Status** accepted

## Context

Three of the eight classifiers read metadata a vault may or may not have: the date, the
people, and an arbitrary frontmatter property. Each has an obvious cheat available, and each
cheat produces a shelf that is confidently wrong — which is worse than a shelf that is
visibly incomplete, because nobody goes looking for it.

## Decision

**A date comes from a configured frontmatter field, then from a date at the start of the
title, and then from nothing.** The file's own modification time is available for every note
and is almost never the date the note is about: a sync, a bulk reformat or a `git checkout`
restamps the whole vault at once, and a Months shelf built on that reads as a decade of notes
filed under one month. So the file stamp is opt-in — `--use-file-stamp` on the exporter, a
toggle in the plugin, **off by default** — and a note with no date says so by landing in
**Undated**.

An Undated book that is large is a diagnosis. A Months shelf that is quietly wrong is not.

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
