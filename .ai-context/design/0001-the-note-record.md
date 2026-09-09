# 0001 — The note record

What a note is reduced to before anything shelves it, and why each field is there.

```ts
interface Note {
  id: string;        // vault-relative path, "/" separators
  path: string;
  title: string;     // basename, no extension
  folder: string;    // FIRST path segment, or "(vault root)"
  date: string | null;
  people: string[];
  tags: string[];
  props: Record<string, string>;
  excerpt: string;
  body: string;
}
```

## `id` is the path, and that is a choice with a cost

A path changes when a note is renamed or moved, which means a bookmark to a renamed note is a
bookmark to nothing. `core.resolveReading` handles the *book* going away; it cannot invent a
note that no longer answers to the id it was saved under.

The alternative — a generated id stored in frontmatter — writes to every note in the vault to
solve a problem most people do not have. The plugin does not write to notes at all, and
starting to would be a much larger promise than "your files never move".

So: the path, and the reading table degrades honestly. A row whose note cannot be found renders
disabled rather than disappearing, so a person can see that something was there.

## `folder` is the first segment only

Deliberately flat. The folder filter and the colour band on a spine are both about *where a
note came from*, at the granularity somebody actually organises at, and a vault five levels
deep would otherwise produce a filter list nobody can scan and a band nobody can read. The
Folder classifier is the place to go deeper, and it takes the whole segment path.

`(vault root)` is a real folder name here, not a null. A note at the root has a source like any
other, and the parenthesised form cannot collide with a real directory.

## `date` is a string or null, never a `Date`

A `Date` carries a timezone and a day does not. Every key this project derives — year, month,
ISO week — is a slice or an arithmetic step on `YYYY-MM-DD`, and doing that through a `Date`
means the note filed on 2026-09-01 lands in August for anybody west of Greenwich.

`core.dates.ts` therefore takes and returns strings, and constructs a `Date` only inside
`isoWeekOf`, `weekRange` and `addDays`, always through `Date.UTC`.

## `people` and `tags` are arrays because a note has several

This is what makes one note appear in eleven books and the shelf still say one note.
`core.keysFor` returns a *list* of keys, `buildShelf` de-duplicates within a note before
pushing, and `noteCount` counts members of the predicate rather than summing the books.

## `props` is `Record<string, string>` and only scalars survive

A frontmatter value that is a list, an object or a nested structure is not a book title. The
plugin keeps strings, numbers and booleans, stringified; the exporter keeps scalar lines and
routes `- item` lists to its own list map. Both drop `tags` and the configured people property
from `props`, because those already have first-class homes and would otherwise appear twice in
the property picker.

The builder shows a **count** next to each property name — `status (394)` — because the useful
question when choosing a classifier is not what properties exist but which ones most notes
actually have.

## `excerpt` and `body`

`body` is the note's text after frontmatter, and it is populated by the exporter and empty from
the plugin (`decisions/0005`). `excerpt` is the first two lines, capped, and exists so the
reader has something to show when `body` is empty. Full-text search reads `body`, which is why
search is deeper in the standalone than in the plugin — and the search box's placeholder names
what it matches everywhere: title, tag, person, text.
