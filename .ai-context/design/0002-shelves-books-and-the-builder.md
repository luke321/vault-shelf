# 0002 — Shelves, books, and the builder

## A shelf is two questions

Not one. **Which notes belong here** is a predicate over the vault; **what makes a book** is a
function from a note to a set of keys. Keeping them separate is what makes the eight
classifiers multiply into something useful instead of eight fixed shelves:

- whole vault × title initial → the Encyclopedia
- whole vault × ISO week → the Weeks shelf
- `#idea` × tag → an anthology of ideas, cross-cut by their other tags
- one folder × person → who appears in this project
- whole vault × `status` → a board, arranged as books

Collapsing the two into one dropdown of named shelf types was the obvious simplification and
it is the wrong one: the interesting shelves are the combinations nobody thought to name.

## The six defaults, and why these six

| Shelf | Source | Classifier | Plaques |
|---|---|---|---|
| Encyclopedia | whole vault | title initial | — |
| Years | whole vault | year | — |
| Months | whole vault | month | yes |
| Weeks | whole vault | ISO week | yes |
| People | whole vault | person | — |
| Tags | whole vault | tag | — |

Every one of them is the whole vault, and that is the point being made on first open: the same
note is in Encyclopedia A, the 2026 yearbook, September 2026, Week 37, Mira's volume and the
Attention anthology at once. Six addresses, one file, nothing duplicated. A person who sees
that immediately understands the product; a person shown one clever shelf does not.

## Membership

`buildShelf` is one pass:

1. filter the (already globally filtered) notes by the source predicate;
2. for each note, ask the classifier for its keys and de-duplicate **within that note**;
3. push the note into each key's bucket;
4. sort each book's notes newest-first, then by title;
5. sort the books by key, special keys last;
6. compute the source-folder band from the book's own notes.

Step 2's de-duplication is the whole of the unique-membership law: a note tagged `#garden` and
`#garden/seeds` on a tag shelf that includes children yields two keys and two books, but a
note tagged `#garden` twice yields one. `noteCount` is the length of step 1's result, never
the sum of step 3, and *a shelf's note count is unique notes* checks exactly that.

Sorting is on the **key**, never the label (`decisions/0002`). `chronological` is descending
because a date shelf that opens on 2013 is a date shelf nobody scrolls.

## The classifiers

| Kind | Key | Notes with no value |
|---|---|---|
| `initial` | first letter of the title, uppercased; digits collapse to `0-9` | `#` |
| `year` | `2026` | `-undated` |
| `month` | `2026-09` | `-undated` |
| `week` | `2026-W37`, ISO week-year | `-undated` |
| `person` | the person's name, verbatim | `-unfiled` |
| `tag` | the tag without `#` | `-unfiled` |
| `folder` | the folder segment | `-unfiled` |
| `property` | the frontmatter value, verbatim | `-unfiled` |

**`0-9` is a volume, not ten books.** A vault whose titles start with dates would otherwise
open the Encyclopedia with ten one-note books before it reached A. Leading punctuation is
stripped before the first letter is taken, so `"quoted opening"` files under Q and `— a dash`
files under A; a title that is *only* punctuation gets `#`.

**The ISO week-year is not the calendar year.** 2027-01-01 is a Friday and belongs to
2026-W53. Keying on the calendar year would split that week across two shelves, which is the
bug `isoWeekOf` exists to avoid and which the suite checks by name.

## The builder

Visible from three places — the directory, every shelf's row menu, and the card at the end of
the library — because a feature reachable only from a settings tab is a feature most people
never find.

**The preview runs the real thing.** It calls `core.buildShelf` on the draft against the same
filtered note set the library is using, and reports the actual note count, the actual book
count, the actual number of plaques, and draws the actual spines (capped at 60, which is about
what fits on a rail without the preview becoming the point). A builder that previews an
estimate is worse than one that previews nothing, because it teaches the wrong thing about
what the shelf will contain.

**Controls disable rather than disappear.** Year plaques are only meaningful for month and
week classifiers, so the checkbox is disabled elsewhere rather than hidden — a control that
vanishes reads as a bug, and a disabled one teaches what it is for.

**Three recipes** — monthly journal, a book for each person, an anthology of ideas — are the
combinations worth pointing at, and each fills the whole form so it can then be edited. They
are a starting point, not a menu.
