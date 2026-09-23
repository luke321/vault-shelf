# Changelog

Every released version, newest first. Bare semver, no `v` prefix — Obsidian installs a plugin
by matching the release tag against `manifest.json`'s version, which cannot carry one.

The heading is what the release is titled: `## <version> — "<name>" — <date>`. The workflow
reads the name out of the quotes and the body out of the section, so this file and the
published page cannot disagree.

The measurements behind each entry are in
[`.ai-context/changelog-detail.md`](.ai-context/changelog-detail.md).

---

## 1.2.0 — "Search Update" — 2026-09-23

**Search Update. The search box now offers the words your vault actually has, a book draws forward by how much of it answers rather than merely whether it does, and a tag book flags exactly where its subject is written.**

### The search box suggests what you can actually read

![The search box suggests what you can actually read](https://raw.githubusercontent.com/luke321/vault-shelf/1.2.0/docs/features/autocomplete.webp)

- As you type, suggestions offer the people, tags, folders, book covers and note titles your vault actually has — spelled out in full. The list now sizes to what it holds instead of clipping at a fixed 232px: a folder name that used to read `area/personal-knowl…` reads whole.
- A small **×** now sits beside the search box to clear it in one press — focus stays in the box, filters are untouched, and the suggestion list closes with it.

### A book draws forward by how much of it answers

![A book draws forward by how much of it answers](https://raw.githubusercontent.com/luke321/vault-shelf/1.2.0/docs/features/matchweight.webp)

- A matching book used to stand the same height whether one note in it matched or every one did. It now lifts and opens air across four rungs — a half or more of its notes, a fifth, a twentieth, or a bare match — so the book that is the actual answer stands clearly proud of the ones that merely mention it.
- The hit count says so too: *"621 notes in 188 books (28 strongly)"*.

### Find the tag where it actually is

![Find the tag where it actually is](https://raw.githubusercontent.com/luke321/vault-shelf/1.2.0/docs/features/sticky.webp)

- Open a tag, person or property book and small flags stand on the fore-edge of the right-hand page, one per place the subject is written. Press one and the note scrolls there with that occurrence marked.
- A subject that is only declared in the frontmatter gets a hollow flag on the note's details line, which is where it actually is; a subject written nowhere gets no flag at all.

If Vault Shelf is useful to you:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/luke321)

### For the record

- Scrolling the library is measured by real input now, not a scripted sweep that never left the first viewport and a half — the containment unit is a row rather than a whole shelf, and the sweep runs one way down. Missed vsyncs dropped from the old measurement's blind spot to a budget the suite can actually fail.
- Five alphabetical tag books that settled a level too deep at narrow widths (1180×480) now fold the middle of their trail instead, keeping every level inside the room it has.
- The edge-index fit that could clip a cut on every re-cut of the fixture now gathers top-down into the room the rail actually has.
- `--empty-picks` clears every pick shelf it touches rather than just the first, and still skips a made book instead of deleting it.
- A CDP transport timeout at `--jobs 1` is retried once instead of failing the check outright.
- CONTRIBUTING.md, AGENTS.md and `design/0007`'s `--hero-clip` docs were corrected to match what the tooling actually does.
- Filed `github#90` (not fixed here): a long run's query-air can still overflow the room the packer measured with an empty box. Three candidate fixes are named on the issue; none is picked, because each trades against something `design/0008` or the packer's own per-query immutability protects.
- The suite grew from 144 checks to 159 over the one vault shape.

## 1.1.0 — "Indices" — 2026-09-16

**Indices. A volume of numbers reads by number, the edge index opens a digits volume into its months and days, and the shelves you arrange by hand stay where you put them.**

### Read by title, date or number

![Read by title, date or number](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/contentsorder.webp)

- **Number** joins A–Z and Date as a way to order a book or a shelf. `2`, `10` and `100` now sort as numbers rather than as characters, so a volume of numbered notes reads in the order you would say them.
- Contents and the edge index change together: choose Number in one and both follow, and your note and reading position survive the switch.

### The edge index reads like a real index

![Jump straight to the right section](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/index.webp)

- A volume of digits opens into its months and days instead of overflowing the rail.
- The rail fits the tabs into the room it actually has, at every size the library is drawn at.

### The order you chose is the order you get

![Make room for the shelves you need](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/manage.webp)

- Rearranging your shelves survives a reload, on both the plugin and the exported page. The order comes from the position each shelf stored rather than from where it happened to sit in the file — dragging a shelf, adding one at the top, or hiding and restoring one all hold.
- Notes that share a date now read A–Z within that date, in both directions, instead of running the alphabet backwards. In a vault where most notes are dated, this is most of what you read.

### Books keep their shape

![Choose a binding and colour](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/looks.webp)

- A spine that lifts on hover is painted in full: the clip that holds it now allows for the lift as well as the paint, so a lifted book is no longer flattened against its board.
- Every look is given room to paint into, so a binding that draws a little outside its spine is not sliced at the edge while the library is busy.

If Vault Shelf is useful to you:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/luke321)

### For the record

- Number ordering is a third `IndexMode` alongside `az` and `date`; saved reading directions and existing shelves load unchanged, and a shelf that has never been given an order still opens on its oldest note.
- Shelf order is held as the stored `position` of each shelf and re-read on load, rather than renumbered from the array on the way in. Hand-edited settings with a duplicate or missing position resolve to a stable sequence instead of silently reordering.
- The exporter's `--empty-picks` skips a made book rather than deleting it: a made book is a place a note lives, and only references are dropped.
- The stylesheets were measured against a real Obsidian rather than argued about: no stylesheet changed, and a gate now says which CSS features the sheets rely on and why each is supported.
- The suite grew from 90 checks to 144 over one vault shape, and four gates got sharper. `check-scope` parses a selector instead of reading the line its brace sits on, which had left 62 selector members in the shipped sheets unread, and it carries 28 negative controls that run on every invocation. `check-pii` fails loudly in CI when its name-list secret is missing instead of degrading to patterns. `check-data-escape --browser` counts only the SVG the page does not own. The scroll-smoothness budget counts missed vsyncs instead of taking a percentile of frame intervals, which could not be measured at the old 34ms line.
- The runner drains the room before blaming a check, and a check that returns with the page still moving now fails naming what it left in flight. A spine-lift check that measured a 0×0 rest box now says the spine had no box rather than claiming it did not lift.
- The screen lock is judged across sister repositories by the pid its owner string names, so a live run next door is no longer broken off the display, and a dead hold no longer queues the machine behind it.
- The comment baseline ratcheted to 1532 — the number the merged tree actually has, which was two under every number any branch measured on its own base.
- The published demo at `docs/demo/` was a release behind: it had not been rebuilt since the 1.0.0 tag, so the live site showed a library with none of this work in it. Rebuilt from the release tree, and all 24 feature clips and the hero were re-shot against it rather than only the ones whose own beats moved.
- The `wear` recording act asserted a literal 54 note entries against the 2015 book. The declared vault is eleven years ending today, so its oldest year is a partial one that shrinks as the window slides — it reached 53 and the act stopped being able to shoot at all. The assertion now asks the book for its own note count.

## 1.0.1 — "Source picker" — 2026-09-13

**Source picker. This hotfix keeps the tag, folder and property choices you make while building a shelf instead of snapping the dropdown back to the first value.**

### Fixed

- Building a shelf from a tag, folder or person now preserves the selected value while the preview refreshes.
- Property shelves keep the chosen property for the same reason: the form reads the selection before rebuilding any dependent dropdown.
- Release dry runs and branch policy now recognize `hotfix/*` branches for urgent patch releases.

### For the record

- The builder smoke check now chooses non-first folder, tag and property values and verifies that each one stays selected after the form handler runs.
- No demo recordings were updated for this patch hotfix.

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
