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

## 0.1.0 — "Six addresses" — unreleased

The first version. Everything below is new.

**The library.** Six default shelves — Encyclopedia, Years, Months, Weeks, People, Tags — and
every one of them is the whole vault, so the same note has six addresses on first open. Eight
classifiers behind them: title initial, year, month, ISO week, person, tag, folder, and any
frontmatter property.

**Shelf creation is first class.** **New shelf** in the directory, in every shelf's row menu,
and on the card at the end of the library. Two questions — which notes belong here, what makes
a book — and a preview that runs the real `buildShelf` against the real note set, so the
counts it shows are the counts you get. Three recipes to start from. **Manage shelves**
reorders, hides and restores; hiding never deletes, and hiding everything leaves a way back.

**Year plaques.** Month and week books group under an engraved year inside the same horizontal
scroller as the books, so the two cannot drift apart when the rail scrolls. Optional per shelf,
disabled for non-date classifiers, and week plaques use the ISO week-year.

**Reading.** A two-page spread that keeps the shelf's scroll position. Contents and a
*find within this book* on the left; the note on the right; index tabs down the edge that
collapse to ranges past 26. **Also shelved in** moves to another book on the same note;
**Previous collection** and `Alt+←` walk back; a bookmark saves to the Reading table and
re-resolves through another shelf if its own is hidden.

**It is painted from Vault Graph.** The same twelve slots, surfaces and text ramp, value for
value, read from the cascade rather than copied so a theme switch re-reads them. Light and dark
follow Obsidian's own theme; there are no skins.

**No sidebar.** The library is the whole surface, with one rail across the top carrying the
shelf jump-list and the search box, and **New shelf at both ends of the scroll**. The reading
table became a shelf of its own.

**Three things a real shelf cannot do.** Books you open often look handled; a saved note leaves
a ribbon hanging out of every book that holds it, and re-threads itself when the library
changes; and searching parts the shelf instead of emptying it — matches draw forward, the rest
thin to ghosts, and clearing puts the room back exactly.

**The note is rendered by Obsidian.** `MarkdownRenderer` over the file's own text: wikilinks,
embeds, callouts, tasks, code.

**Accessibility.** Every control named, visible focus, `prefers-reduced-motion` respected, and
a plain list mode that keeps every book reachable without a horizontal rail.

**The tooling.** 37 invariant checks over three generated vault shapes; 10 more inside a real
Obsidian; a comment ratchet, a PII gate, a scope gate that refuses an unscoped rule, an
unprefixed class, and an invisible character, a network gate, and two determinism gates. Plus
`scripts/record-demo.mjs`, which shoots the 83-second walkthrough frame by frame over CDP.
