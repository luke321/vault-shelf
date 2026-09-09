# 0002 — A book has a stable address, and the classifier key is it

**Date** 2026-09-09 · **Status** accepted

## Context

The whole premise is **returning to a familiar place**. A person bookmarks a note, closes
Obsidian, adds forty notes, comes back, and expects September 2026 to still be September 2026.
Everything in the reading table, the cross-shelf history and the "also shelved in" links is a
reference to a book, and a reference is only as good as what it names.

## Alternatives weighed

| Option | Why not |
|---|---|
| **The book's index on its shelf** | Adding one note in a new month renumbers every book after it. Every saved place would silently move. |
| **A generated id, stored with the shelf** | The shelf definition then carries a list of books, which has to be reconciled with the vault on every rebuild — and the reconciliation is the bug. |
| **The book's display label** | "September 2026" is a presentation decision. Translating the UI, or shortening a month name, would break every bookmark in the vault. |

## Decision

**`bookId = shelfId + "/" + classifierKey`,** and the classifier key is the raw sortable value
— `2026-09`, `2026-W37`, `A`, `0-9`, `Mira Vance`, `-undated`. Nothing else goes into it: not
the count, not the label, not the position.

That gives three properties for free:

- **Deterministic.** The same vault and the same shelf definition produce the same addresses,
  in the same order, on any machine and any day.
- **Sortable.** The key *is* the sort order, so `compareKeys` never has to consult a label.
- **Recoverable.** An address that no longer exists can be *re-resolved*: `core.resolveReading`
  looks for the named book, and failing that for the first visible book anywhere that still
  holds the note. A hidden shelf, a renamed note, a deleted book — the bookmark still opens
  something true.

The two special keys are `-undated` and `-unfiled`. They start with a hyphen so they can never
collide with a real tag, person, initial or date, and so `compareKeys` can sort them last in
both directions without a lookup table.

## Consequences

- Renaming a shelf does not move a book; changing its `id` does. The builder never changes an
  id after the first save, and `uniqueId()` only runs on creation.
- Changing a shelf's **classifier** changes every address on it, and that is correct: they are
  different books.
- *book addresses are stable across a rebuild* asserts the whole of this by filtering the
  library down to nothing and back, and comparing the address list element for element.
