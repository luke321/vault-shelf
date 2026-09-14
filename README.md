# Vault Shelf

[![Latest release](https://img.shields.io/github/v/release/luke321/vault-shelf?label=release)](https://github.com/luke321/vault-shelf/releases/latest) [![License: MIT](https://img.shields.io/github/license/luke321/vault-shelf)](LICENSE) [![GitHub stars](https://img.shields.io/github/stars/luke321/vault-shelf)](https://github.com/luke321/vault-shelf/stargazers) [![Ko-fi](https://img.shields.io/badge/Ko--fi-support-793b3d?logo=ko-fi&logoColor=white)](https://ko-fi.com/luke321)

**Your Obsidian vault as a browsable library.** Build shelves from titles, dates, people,
tags, folders or any note property. Open a book as a two-page spread, and leave a ribbon
where you want to return.

**The notes never move.** A note can sit in Encyclopedia **A**, the **2026** yearbook,
**September 2026**, a person's volume and a tag's anthology at the same time. Each is
another way into the same file. Vault Shelf works locally and makes no network requests.

![Scroll through the library, open a book, use its index, read a note and leave a ribbon, return to the top, drag a book onto Favourites, create a book, choose its binding and colour, and change the binding and colour of a plaque’s run](assets/demo.webp)

*Browse, read, collect and bind your books. Recorded at 1000 × 1000 in a generated vault;
every note in the film is invented.*

[Try the live demo](https://luke321.github.io/vault-shelf/demo/) ·
[Explore every feature](https://luke321.github.io/vault-shelf/features.html)

## What it does

**Six shelves to start.** Favourites is yours to fill; the other five each organise the
whole vault differently.

| Shelf | A book is |
|---|---|
| **Favourites** | a book you collected from another shelf, or one you made |
| **Encyclopedia** | a title initial, including a `0–9` volume |
| **Years** | a year, grouped under its decade |
| **Months** | a calendar month, grouped under its year |
| **People** | a person declared in the note's metadata or linked person notes |
| **Tags** | a tag, optionally including its children |

**Build a shelf from two questions.** Which notes belong here: the whole vault, a tag,
a person or a folder. What makes a book: title, year, month, ISO week, person, tag, folder
or a note property. Preview the actual books before saving. Weeks is available in the
builder; any Weeks shelf saved before this release is kept.

**Make it yours.** Drag books onto Favourites or create more collection shelves. Arrange
books by hand, and make a book from a source that grows as matching notes arrive. Fourteen
colours and six leather bindings let you dress a book, a plaque's run or a whole shelf.
Hover or focus a choice to preview it before saving.

**Read a book.** Contents and search on the left; your note on the right, rendered by
Obsidian with links, embeds, callouts, tasks, tables and code. Choose A–Z or Date for the
contents and edge tabs — or Number, where every note in the book starts with one. Turn with the footer buttons, arrow keys, or a wheel push past
the end of a note. Also shelved in opens another book on the same note; Previous collection
and Alt+Left return.

**Keep your place.** Saved notes leave ribbons in the books that hold them, and the Reading
shelf gathers your marked books. Reading places survive a rebuild or rearrangement. Books
show their age, entries and visits: existing notes count once per book, then new entries and
visits add activity. Each book remembers when you last opened it; an unvisited book starts at never.

**Find and organise.** Search titles, book covers, tags, people and folders. Matching books
come forward while the rest stay on their shelves; inside a book, marked contents rows and
highlighted metadata explain the matches. Opening a matching book brings its first match into
view on the left while keeping the selected note on the right. Suggestions offer the names your vault uses.
The gear opens Manage, where you can jump
to, edit, reorder, hide or delete shelves. Hiding preserves books; deleting a shelf never
deletes notes.

The room opens in leather: walnut boards, brass plaques and ivory pages. It offers keyboard
controls, visible focus, reduced motion and a plain list mode.

## Install

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/luke321/vault-shelf/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/vault-shelf/`.
3. Reload plugins in **Settings → Community plugins**, and enable **Vault Shelf**.
4. Click the bookshelf in the ribbon, or run **Vault Shelf: Open the library**.

Release assets carry build-provenance attestations:

```powershell
gh attestation verify main.js --repo luke321/vault-shelf
```

## Settings

| Setting | What it controls |
|---|---|
| **Date properties** | Comma-separated frontmatter fields, tried in order, followed by a date at the start of the title. |
| **People properties** | Fields that name people, merged together: `people, attendees, person` by default. Values may be wikilinks. |
| **What makes a note a person** | `type: people` by default, or a `#tag`. Linking to a matching note names that person. Leave empty to turn this off. |
| **Fall back to the file's creation date** | On by default. Uses the earlier of creation and modification when no property or title supplies a date. Turn it off to see those notes in Undated. |

Set shelf defaults and edit the book/ribbon palette in **Manage**. Use a book's right-click
menu for its colour, binding and contents order. **Leather** is the offered look.

## What it promises

- **It never writes to your notes.** Shelves use Obsidian's metadata cache; the open note
  is read on demand for rendering.
- **It makes no network requests.** The plugin and exported library work locally.
- **It uses declared metadata.** Missing dates or properties get Undated or Unfiled books.
  People come from your chosen properties and declared person notes, never inferred from prose.
- **A shelf counts unique notes.** A note in three books is still one note in the shelf's count.

## The standalone exporter

The same library as one self-contained HTML file, usable without Obsidian:

```powershell
node src/build-shelf.mjs --vault "C:/path/to/your/vault" --out ./vault-shelf.html
```

The file includes the vault's note titles, paths, tags, people and bodies in plain text.
Keep an export private if its vault is private.

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) has the gates and branch policy;
[`.ai-context/`](.ai-context/) records the design decisions. Issues are the way in.

## Licence

MIT. See [`LICENSE`](LICENSE).
