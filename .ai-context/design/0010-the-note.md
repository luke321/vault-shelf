# 0010 — The note

The right-hand page of the reading spread is the note. Inside Obsidian it is rendered by
**Obsidian's own renderer**, over the file's own text.

## Why this is not a contradiction of decisions/0005

That record says the plugin reads the metadata cache and **never the filesystem**, and it
means it: `buildData` walks `app.metadataCache` and reads no file, because the cache already
knows every note's frontmatter and tags, it is kept current by the app, and reading the vault
behind the app's back is how a plugin ends up disagreeing with the vault it is displaying.

Rendering one open note is a different question with a different answer:

- it is **one file**, not the whole vault;
- it is **on demand**, when a person is looking straight at it;
- it goes through **`app.vault.cachedRead`**, which is the app's own cache, not a filesystem
  crawl behind its back;
- and the alternative was showing a two-line excerpt of a note the reader has open.

`buildData` still sets `body` and `excerpt` to empty strings from this host. The note's text
never enters the shelf data; it is fetched for the one note being read and thrown away.

## What that buys

`MarkdownRenderer.render(app, body, into, path, component)` gives the reading spread
everything the app gives a preview pane: wikilinks that resolve and are clickable, embeds,
callouts, task lists, tables, code blocks with the user's own syntax theme, and any
post-processor another plugin has registered. Writing a renderer here would have meant
re-implementing Obsidian, badly, inside a plugin running in Obsidian.

The frontmatter block is stripped before rendering — it is already the metadata line above the
note, and printing it twice is noise.

## The fallback, and the seam between them

`mountVaultShelf` takes `renderNote(into, note)` as an option. Absent — which is the standalone
export, where there is no Obsidian — the page falls back to its own fifteen-line renderer over
whatever `body` the producer supplied: headings, lists, quotes, paragraphs.

Either way it **builds elements, never an HTML string.** The note body is the user's own text
and assembling markup out of it is how a vault ends up executing itself.

## The async seam, and why there is no sequence number

`renderNote` may return a promise, and a person can page through a book faster than a render
resolves. The obvious guard is a monotonic token compared on completion.

There is none, because the structure makes it unnecessary: each render appends a **fresh host
element** to the note pane, and the pane is cleared at the start of every render — which
*detaches* the previous host. A slow render that resolves after the reader has moved on writes
into an element that is no longer in the document. Nothing to cancel, nothing to compare, and
no way for a stale note to appear over a current one.

## min-width: 0, on both

A long paragraph must wrap, not widen the reader. It took two goes:

- `.vs-page` is a **grid item** and `.vs-spread` is a **flex item**, and both default to
  `min-width: auto`, which means *never shrink below your content*. Fixing only the page left
  the spread doing it.
- and then it turned out neither was the real cause: Obsidian's `app.css` was setting
  `white-space: nowrap` on the class name `.spread`, which its PDF viewer owns. `design/0005`
  has that story and the class-prefix rule that came out of it.

Both are guarded now. `"a long note wraps instead of widening the reader"` measures
`clientWidth` against `scrollWidth` on the reader, the spread, the page, the prose and the
paragraph, and fails naming whichever one is wider than it should be.
