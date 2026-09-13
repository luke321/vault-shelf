# Changelog

Every released version, newest first. Bare semver, no `v` prefix — Obsidian installs a plugin
by matching the release tag against `manifest.json`'s version, which cannot carry one.

The heading is what the release is titled: `## <version> — "<name>" — <date>`. The workflow
reads the name out of the quotes and the body out of the section, so this file and the
published page cannot disagree.

The measurements behind each entry are in
[`.ai-context/changelog-detail.md`](.ai-context/changelog-detail.md).

---

## 1.0.0 — "Vault Shelf" — 2026-09-13

**Vault Shelf. Your notes become a library: build your shelves, bind your books, and read with a ribbon keeping your place. The files never move.**

### Your vault, shelved

![The library](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/shelves.webp)

- Start with Favourites, Encyclopedia, Years, Months, People and Tags. Favourites starts empty; the other five each hold your whole vault, organised a different way.
- Build more shelves from folders, tags, people or the whole vault. Group their books by title, year, month, ISO week, person, tag, folder or any note property; preview the result before saving.
- Books wrap onto the next board. Thicker spines hold more notes; hover to peek inside. Year, decade and letter plaques gather books into a run you can open together.

### Make it yours

![Colours and bindings](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/looks.webp)

- Fourteen colours and six leather bindings: Original, Minimal, Gilt, Morocco, Vellum and Aged. Preview them on a book, a plaque's run or a whole shelf before choosing.
- Coordinate colours and bindings by book, year or decade. Edit book and ribbon colours in Manage, with resets whenever you want the defaults back.
- The room opens in leather, with walnut boards, brass plaques and ivory pages. Books show age, entries and visits: existing notes count once per book, then new notes and visits add activity. The newest dated note sets their age.

### Favourites and books of your own

![Collect favourite books](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/favourite.webp)

- Drag books onto Favourites, or create more shelves for your own collections. Each favourite stays connected to its source book.
- On a shelf arranged by hand, use the plus spine or right-click a gap to make a book from a folder, tag, person or the whole vault. Choose its name, binding, colour and contents order; it grows as matching notes arrive.
- Arrange books by dragging or with Alt+Left/Right. Drag toward the edge to reach shelves beyond the screen. Taking a favourite or made book off its shelf never deletes a note.

### Find your way

![Search the library](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/parting.webp)

- Search titles, book covers, tags, people and folders. Matching books come forward while the rest remain as faint spines; suggestions offer the names your vault uses.
- Open a matching book and its contents scroll to the first match, keeping the selected note on the right. Marked rows and highlighted title or metadata explain the results. A cover match names the book that supplied it. Find within this book follows the same rule.
- Manage lets you jump to, reorder, edit, hide or delete shelves. You can also drag a shelf by its board. Hiding keeps its books, and an empty room always offers a way back.
- Search stays visible while a book is open. Shelf edit and hide controls sit beside its counts; the gear opens Manage.

### Open a book

![Read a two-page spread](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/read.webp)

- Contents and search on the left; your note on the right, rendered by Obsidian with its links, embeds, callouts, tasks, tables and code.
- Choose A–Z or Date for a book or shelf. The edge index follows that choice and fits its tabs into the available space. Switching keeps your note and reading position.
- Use the footer buttons, arrow keys or index tabs to turn pages. Push the mouse wheel past a note's end to turn to the next; push back at its start to return.
- Follow links within the library, use Also shelved in to see the same note in another book, and return with Previous collection or Alt+Left. Click the desk to put the book down.

### Keep your place

![Leave a ribbon](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/ribbon.webp)

- Save a note and ribbons hang from the books that hold it. The Reading shelf gathers your marked books for an easy return.
- Ribbons keep their place when shelves are rearranged or rebuilt, and follow another shelf when their original shelf is hidden. Inside the reader, each ribbon matches its book's binding.

### For the record

- Shelves count unique notes, even when several books contain the same note. Missing dates and properties get Undated or Unfiled books. Dates use your chosen properties, then the title, then an optional file timestamp; people come from declared properties or links to declared person notes.
- Fresh date ordering starts oldest first. Existing Weeks shelves and saved reading directions still load. Leather is the offered look; Modern and Cyber remain shelved.
- Page turns keep the contents list steady. Wide tables scroll inside the note; lifted spines remain visible; multiple Reading books share a board; clicking the turn footer keeps the book open.
- Keyboard controls, named buttons, visible focus, reduced motion and a plain list mode are included. Search suggestions complete text; note bodies and file paths are outside the catalogue search.
- The plugin follows changes in your vault, writes nothing to your notes and makes no network requests. A standalone exporter produces the library as one HTML file; the docs site includes a generated-vault demo.
- Each book remembers when you last opened it; unvisited books start at never. Existing visit counts survive the update, and rebuilding does not recount entries.
- Update notes explain future minor and major releases inside the plugin. Automated checks cover layout, saved places, metadata escaping, refresh and cleanup; release builds carry provenance attestations.
