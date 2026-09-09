# 0005 — The plugin reads the metadata cache, not the filesystem

**Date** 2026-09-09 · **Status** accepted

## Context

The exporter crawls a directory and parses frontmatter itself, because there is nothing else
to ask. Inside Obsidian there is: `app.metadataCache` already holds every note's frontmatter,
tags, headings and links, parsed by the app's own reader and kept current as files change.

The temptation is to reuse the exporter's crawl in the plugin so there is one implementation.

## Alternatives weighed

| Option | Why not |
|---|---|
| **Reuse the exporter's crawl inside the plugin** | It reads files behind the app's back. Obsidian's frontmatter parser is a real YAML reader and the exporter's is deliberately small, so the two disagree on anything unusual — and the disagreement shows up as the plugin displaying a vault the app does not recognise. It is also `O(vault)` file reads on every rebuild, on a mobile device included. |
| **Read the cache and the file, and prefer the file** | Two sources, one of which is a superset, plus reconciliation nobody asked for. |
| **Ask the cache for everything including the body** | The cache does not hold bodies, and reading them would reintroduce the crawl for a preview the reader does not need — the note is one click away inside Obsidian. |

## Decision

**`buildData` reads `app.vault.getMarkdownFiles()` and `app.metadataCache.getFileCache()`, and
nothing else.** Tags come from `cache.tags` (the inline ones) unioned with the frontmatter
`tags` property; frontmatter scalars become `props`; `people` is read from the configured
property. The note's `body` and `excerpt` are **empty** from this host, and the reader falls
back to the excerpt and offers *Edit in Obsidian*.

The file list is sorted by path before anything else looks at it, for the same reason the
exporter sorts its `readdirSync`: note order inside a book must not depend on what order a
host happened to enumerate.

**Deferred views are checked for.** Since Obsidian 1.7.2 a tab restored in the background is
deferred: the leaf is real and `getLeavesOfType` finds it, but `leaf.view` is a placeholder
until something reveals it. `eachView` tests `view instanceof ShelfView` before touching it.

## Consequences

- Full-text search works in the standalone and not in the plugin, and the search box says so
  by matching titles, paths, tags and people in both. That asymmetry is the price, and it is
  cheaper than the plugin disagreeing with the app about what a note contains.
- A vault that Obsidian has not finished indexing yields a smaller library, briefly. Rebuild
  from the metadata cache is a command for exactly that.
- The exporter's small YAML reader only ever has to be right about the exporter's own
  fixtures, which are generated with a known frontmatter shape.
