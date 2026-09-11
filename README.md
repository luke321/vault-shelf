# Vault Shelf

**Your Obsidian vault as a browsable library.** Shelves of books built from titles, dates,
people, tags, folders or any note property — read as a two-page spread, with an index down the
right edge and a bookmark that survives the shelf being rearranged.

**The notes never move.** Shelves and books are views over the files that are already there,
so one note sits in Encyclopedia **A**, the **2026** yearbook, **September 2026**, **Week 37**,
**Mira's** volume and the **Attention** anthology at the same time. That overlap is the point:
each shelf is another useful address into one vault.

Sister project to [Vault Graph](https://github.com/luke321/vault-graph), which draws the same
vault as one disc. Both are deterministic, local, and make no network requests at all.

![A book dragged from the Years shelf onto the empty Favourites shelf, a second dropped into the gap before it, the favourite opened and a ribbon left in it, the shelf parting around a search and closing back up, and the room as it was left](assets/demo.webp)

*The first 38 seconds of the 149-second walkthrough `node scripts/record-demo.mjs` shoots:
make the shelf yours, mark your place, ask the room a question. Shot in leather, in a mirror of
a real vault with every word invented.*

**Try it live** — a real export of an invented 394-note vault spanning fifteen years, which you
can open, read, search and build a shelf in exactly like your own. The full feature list — the
bookcase, plaques, thickness, the reading spread, ribbons, shelf wear, the shelf that parts as
you type, and the two looks — is a click away too. Both are going up as a proper site from
[`docs/`](docs/); this line gets its links the moment it is live.

---

## What it does

**Six shelves on first open, and every one of them is the whole vault.**

| Shelf | A book is |
|---|---|
| **Encyclopedia** | a title initial, with an explicit `0–9` volume |
| **Years** | a year |
| **Months** | a calendar month, grouped under year plaques |
| **Weeks** | an ISO week, Monday to Sunday, grouped under year plaques |
| **People** | a person named in a note's people property |
| **Tags** | a tag, with parent tags optionally collecting their children |

**And you can build your own, from two questions.** *Which notes belong here* — the whole
vault, a tag, a person, a folder. *What makes a book* — title initial, year, month, ISO week,
person, tag, folder, or any frontmatter property you have. The builder previews the real
answer before you save: the actual note count, the actual books, the actual spines.

**Reading a book** opens a spread without losing your place on the shelf. Contents and a
*find within this book* on the left, **the note rendered by Obsidian's own renderer** on the
right — wikilinks, embeds, callouts, tasks and code, exactly as the app draws them — index
tabs down the edge: months
for a year, days for a month, initial ranges for anything alphabetical. **Also shelved in**
steps sideways to another book while staying on the same note. **Previous collection** and
`Alt+←` walk back. A bookmark saves the note to the Reading table, and re-resolves itself if
that shelf is later hidden.

**Three things a real shelf cannot do.**

- **Shelf wear.** Books you open often look handled — the boards darken, the corners soften,
  and they never sit quite flush again. The room remembers your habits without a dashboard.
- **Ribbons that hang.** A saved note leaves a ribbon out of the bottom of the book, visible
  from across the room. Because one note is in six books, one ribbon shows in six places — and
  it re-threads itself if you rename the note or hide the shelf.
- **The shelf parts as you type.** Searching does not empty the library. Matching books draw
  forward and gain air; the rest thin to ghosts and stay exactly where they were. Clear the box
  and the room is back, because it was never taken apart.

**It looks like Vault Graph, because it is painted from Vault Graph.** The same twelve colour
slots, the same surfaces, the same text ramp — read from the stylesheet rather than copied, so
a folder that is `#2a78d6` on the disc is `#2a78d6` on a spine. Light and dark follow
Obsidian's own theme.

---

## Install

Not in the community directory yet. Until it is:

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/luke321/vault-shelf/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/vault-shelf/`.
3. Reload plugins in **Settings → Community plugins**, and enable **Vault Shelf**.
4. Click the bookshelf in the ribbon, or run **Vault shelf: Open the library**.

Every release asset carries a build-provenance attestation, so you can check that the file you
downloaded was built from this repository at that tag and not assembled by hand:

```bash
gh attestation verify main.js --repo luke321/vault-shelf
```

## Settings

| | |
|---|---|
| **Date properties** | comma-separated frontmatter fields, tried in order. A note with none of them falls back to a date at the start of its title |
| **People properties** | comma-separated properties that name people, merged — `people, attendees, person` by default, because a vault rarely uses only one. Values may be wikilinks. People are **never** inferred from a note's prose |
| **What makes a note a person** | `type: people` by default, or a `#tag`. A link to a note that matches names that person, by the note's own name, so an aliased link and a plain one are one book. Empty turns it off |
| **Fall back to the file's creation date** | on by default. A note with no date property and no date in its title takes the **earlier** of the file's creation and modification stamps — the one that survives a bulk reformat and a copied vault. Turn it off to send those notes to **Undated**, where you can see how many there are |

The look is not a setting either: the selector in the library's own top bar offers **Leather**
— walnut shelves, brass labels, ivory pages inside an oxblood cover, and what a fresh library
opens in — and **Modern**, which follows Obsidian's theme and re-reads its palette when you
change it.

## What it promises

- **It never writes to your notes.** Shelves are built from Obsidian's metadata cache alone;
  the only file it ever reads is the one note you have open, to render it.
- **It makes no network requests.** Not one, and
  [`scripts/check-network.mjs`](scripts/check-network.mjs) refuses a push that adds one.
- **It never guesses.** A note with no date is Undated; a note with nobody named names nobody.
  A confidently wrong shelf is worse than a visibly incomplete one.

## The standalone exporter

The same library, as one self-contained HTML file that opens off a disk with no Obsidian at
all. It is what the invariant suite drives, and it is useful on its own:

```bash
node src/build-shelf.mjs --vault "/path/to/your/vault" --out ./vault-shelf.html
```

The file contains every note title, path, tag, person and body in plain text. Do not paste one
into an issue.

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) has the gates and the branch policy;
[`.ai-context/`](.ai-context/) has the reasoning behind every decision that looks arbitrary.
Issues are the way in.

## Licence

MIT. See [`LICENSE`](LICENSE).
