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
6. compute the source-folder mix from the book's own notes — which dyes the board and fills
   the hover peek (`design/0005`).

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

## The cover drops the hash, and nothing else does (2026-09-11)

> "remove the tag symbol from book covers reads badly"

`labelFor` gives a tag book the name `#garden`, and that label reached five places: the spine,
the hover peek, the dye menu's heading, the reader's title bar and the book heading on the
left page. On the spine it is a `#` turned on its side at 10.5px — the one glyph in the library
that reads as noise rather than as a name, on a shelf that is already called Tags.

**The spine draws a separate form and the label does not change.** `Book.cover` is
`coverFor(key, kind)`: the key itself for a tag book, `labelFor` for everything else, so
`Untagged` stays `Untagged`. The spine's title and the upright rule read the cover; every other
place keeps reading the label. Which means:

| place | reads | tag book shows |
|---|---|---|
| the spine | `cover` | `garden`, `area/health/sleep` |
| the hover peek | `label` | `#garden` |
| the dye menu heading | `label` | `#garden` |
| the reader's title bar | `label` | `Tags · #garden` |
| the book heading | `label` | `#garden` |
| the *also shelved in* chips | `label` | `Tags: #garden` |

The argument for taking it off everywhere is consistency; the argument against is that a
hierarchical tag without its hash **reads as a folder path**, and `area/health/sleep` on a bare
spine is indistinguishable from the Folders shelf's own book of the same name. The hash is
noise only where it is set vertically and tiny. Set horizontally it is how a tag is written
everywhere in Obsidian, it costs nothing, and it is exactly what tells a person that
`area/health/sleep` is a tag and not a folder. So the cover, which has the shelf's own head
above it to say what it holds, gives it up; the peek one hover away, and every other place the
name is set horizontally, keeps it. The note's own metadata line is a different thing — those
are the note's tags as written in the vault — and was never the label.

**A label is not an address.** `key` is untouched (`decisions/0002`): no book moves, no count
changes, no address differs, and the suite's check asserts the address list before and after
opening a tag book element for element.

**The upright rule now measures.** A label of three characters or fewer stood upright, and
`#map` is four while `map` is three — so on the demo vault `map` stood up, on a spine of three
notes 22px wide, and the screenshot showed `m…`. Three characters was only ever a proxy for
"fits when set horizontally", and it was right for `A`, `0-9` and `Ü` because those sit on
thick volumes. `fitsUpright()` measures the cover on a probe spine of the real width under the
root — so the look's own face and the spine's real padding are what is measured, and a shelf
that `content-visibility` has skipped cannot answer wrongly — and a short cover that does not
fit stays on its side, where it is at least whole. On the demo vault `学び` stands and `map`
does not; every Encyclopedia volume still stands, and the peek check now also counts clipped
upright titles and holds that number at zero.

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
