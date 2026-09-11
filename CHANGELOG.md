# Changelog

Every released version, newest first. Bare semver, no `v` prefix — Obsidian installs a plugin
by matching the release tag against `manifest.json`'s version, which cannot carry one, so a
`v`-tagged release is one nobody can install.

The heading is what the release is titled: `## <version> — "<name>" — <date>`. The workflow
reads the name out of the quotes and the body out of the section, so this file and the
published page cannot disagree.

The measurements behind each entry are in
[`.ai-context/changelog-detail.md`](.ai-context/changelog-detail.md), which is the regression
suite. An entry here says what changed; that file says what it was before and after.

---

## 0.1.0 — "Beginning" — 2026-09-11

**Your vault as a library.** Shelves of books built from titles, dates, people, tags, folders
or any note property, read as a two-page spread — and the notes never move. Shelves and books
are views, so one note sits in Encyclopedia **A**, the **2026** yearbook, **September 2026**,
**Week 37**, a person's volume and a tag's anthology at once. That overlap is the point, and
it is the first thing the invariant suite checks: a shelf's note count is unique notes, never
the sum of its books.

The first version. Everything below is new.

### The library

Seven shelves on first open, and every one of them is the whole vault: **Favourites** (empty
until you drop a book on it), **Encyclopedia**, **Years**, **Months**, **Weeks** (hidden until
asked for — a vault of any age has hundreds of ISO weeks, and one click in Manage brings them
back), **People** and **Tags**. Eight classifiers behind them: title initial with an explicit
`0-9` volume, year, month, ISO week (with its week-year, so 2027-01-01 is 2026-W53), person,
tag with parents optionally collecting their children, folder, and any frontmatter property.

**Build your own from two questions** — which notes belong here (the whole vault, a tag, a
person, a folder) and what makes a book — with a preview that runs the real builder against
the real note set, so the counts it shows are the counts you get. **Manage shelves** reorders,
hides and restores; hiding never deletes, and hiding everything leaves a way back. The Colours
block is a table of painted swatches, one ribbon colour per book colour, with per-slot and
whole-palette resets. **A date shelf dyes by period**: Years by decade, Months and Weeks by
year, so a run of years reads as a run rather than as one colour, and Manage offers *Colour by
folder / year / decade* on those rows; Encyclopedia, People and Tags keep their folder's dye.

### The bookcase

A shelf is a bookcase, not a conveyor belt: nothing scrolls sideways, and a run too long for
the room continues on the next row down, so all of a People shelf is on screen at once and the
height of a shelf says how much is in it. **A spine's width is its note count**, log-scaled
against the largest book in the library. **Plaques** name the unit above the book — months and
weeks under their year, years under their decade, people and tags under their letter — and a
plaque is a button: clicking it opens the run under it as one book of unique notes, with an
address of its own so a bookmark left in a decade survives a rebuild. The room has a measure:
1180px, centred, so a shelf on a wide monitor is not four books on an 1,800px board.

### Reading

A two-page spread that keeps your place on the shelf. Contents and *find within this book* on
the left, **the note rendered by Obsidian's own renderer** on the right — wikilinks, embeds,
callouts, tasks, tables and code, exactly as the app draws them — and index tabs down the
edge, cut the way the book is ordered: letters for an Encyclopedia volume, as deep as its
titles need (Ma, Me, Mi rather than one M), dates for everything else. A tab, Previous, Next,
an arrow key or a followed link brings the contents with it. **Also shelved in** steps to
another book on the same note; **Previous collection** and `Alt+←` walk back. A wikilink
followed from the spread goes to that note in this book, else on this shelf, else on the
nearest one, and only a note the library does not hold falls through to Obsidian. Every book
opens on its oldest note, and one toggle in the top bar turns a date shelf and its books round
together.

### Favourites, and the book you make on the shelf

Drag any book onto the **Favourites** shelf and it stands there as a reference: its label,
notes and colours are the source's and stay live, and opening it opens the source book. Drag
it off to take it off (Escape cancels). A pick shelf is a kind of shelf, not one shelf — the
builder makes as many as you want, and a book may sit on several. **Right-click empty rail
space, or press the quiet plus where the books end, to make a book**: a name and a source —
a folder, a tag, a person, the whole vault — held as a saved query with an address of its own.
Any shelf arranged by hand can hold one.

### Arranged by hand

A shelf's Order gains **Arranged by hand**. Books then stand where you put them, moved by
dragging a spine along the shelf and across rows, or by `Alt+←` / `Alt+→` on a focused one. It
changes the sequence and nothing else: not an address, not membership, not what is inside a
book. A book nobody has placed stands at the end.

### Three looks, one geometry

**Leather** — walnut shelves, brass labels, ivory pages inside an oxblood cover, and what a
fresh library opens in. **Modern** — painted from Vault Graph: the same twelve colour slots,
surfaces and text ramp, read from the cascade rather than copied, following Obsidian's light or
dark theme and re-reading it when it changes. **Cyberpunk** is shelved until its redesign: it
still ships and is still measured, but the selector does not offer it. A look is paint: it may
repaint anything and move nothing — a spine is the same size in all three, every control the
same height, so switching does not move the furniture. And a button and a plaque are made of
the same material in every look.

### Three things a real shelf cannot do

- **Shelf wear.** Books you open often look handled — the boards darken, the corners soften.
- **Ribbons that hang.** A saved note leaves a ribbon out of every book that holds it, visible
  from across the room; inside the book, up to three hang over the page you are on. A ribbon
  re-threads itself when the library changes, and re-resolves through another shelf if its own
  is hidden.
- **The shelf parts as you type.** Searching never empties the library: matching books draw
  forward and gain air, the rest thin to ghosts and stay exactly where they were.

### What a shelf is allowed to know

**Metadata is declared, never inferred.** A date comes from a property, then a title, then the
earliest stamp the filesystem has for the file — the earlier of creation and modification,
since a bulk reformat moves one and a copied vault moves the other — and that fallback can be
turned off to see the Undated book instead. People come from the people properties (`people`,
`attendees`, `person` by default, values may be wikilinks) and from a link to a note that
declares itself a person (`type: people`), never from prose. A missing value gets its own book,
`Undated` or `Unfiled`, never an exclusion. A book's colour has three claimants, ranked: the
person, from twelve swatches on the spine's own menu; the shelf, if it varies its books; and
the folder.

### Accessibility

Every control named, visible focus, `prefers-reduced-motion` respected, and a plain list mode
that keeps every book reachable without a rail.

### The exporter, and the site

The same library as one self-contained HTML file that opens off a disk with no Obsidian at
all: `node src/build-shelf.mjs --vault <vault> --out vault-shelf.html`. It is what the
invariant suite drives. `docs/` is a Pages site with the feature list and a live demo built
from a generated fixture; it goes live when the repository does.

**The film** (`assets/demo.webp`, `node scripts/record-demo.mjs`) is shot in leather, in a
mirror of a real vault with every word invented, and opens on the three things the product
is: a book dragged onto Favourites, a ribbon left in it, and a search that parts the shelf.
The recorder drives a real drag and drop, stops the take when an act throws, and cuts the
hero by act rather than by second.

### For the record

- The plugin reads Obsidian's metadata cache, never the filesystem; the only file it ever
  reads is the note you have open, to render it. It writes nothing to your notes.
- Nothing shipped makes a network request. Not one, and a gate refuses a push that adds one.
- Settings migrate by schema (10 at this release): an older file comes up with decade and
  letter plaques on, the file-stamp fallback on, Weeks hidden, and a look the selector offers.
- **The tooling.** 87 invariant checks per vault shape, over three generated shapes — a demo
  vault that reads like somebody's, a sparse and lopsided one, and a 10,000-note library — 261
  in a run, driven in a real Chrome over CDP; a golden per shape for the packing; a
  data-escape gate whose vault's metadata is markup; a teardown check over twenty
  mount/unmount cycles; a refresh check that changes the vault under an open book; a comment
  ratchet; a PII gate; a scope gate that refuses an unscoped rule, an unprefixed class and an
  invisible character; a network gate; two determinism gates; and a suite stamp, so a tree is
  gated once. `scripts/record-demo.mjs` shoots the walkthrough frame by frame over CDP, in a
  mirror of a real vault rather than in the vault itself.
