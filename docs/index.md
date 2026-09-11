---
title: Vault Shelf
---

[Home](index.html) · [Features](features.html) · [Try it live](demo/) · [GitHub](https://github.com/luke321/vault-shelf)

# Vault Shelf

**Your Obsidian vault as a browsable library.** Shelves of books built from titles, dates,
people, tags, folders or any note property — read as a two-page spread, with an index down the
right edge and a ribbon that survives the shelf being rearranged.

**The notes never move.** Shelves and books are views over the files that are already there, so
one note sits in Encyclopedia **A**, the **2026** yearbook, **September 2026**, **Mira's**
volume and the **Attention** anthology at the same time. That overlap is the point: each shelf
is another useful address into one vault.

<img src="https://raw.githubusercontent.com/luke321/vault-shelf/main/assets/demo.webp" width="100%" alt="A book dragged from the Years shelf onto the empty Favourites shelf and a second dropped into the gap before it, the favourite opened and a ribbon left in it that hangs out of every book holding the note, the shelf parting around a search and closing back up, and the room as it was left, with the notes exactly where they were">

## Try it live

The demo below is a real export of an invented 394-note vault covering fifteen years — click
it, open a book, search it and build a shelf exactly like your own.
**[Open the live demo →](demo/)**

Nothing about it phones home. It is one self-contained HTML file, which is also how the
standalone exporter ships: the same page, off a disk, with no Obsidian at all.

## Every feature, in the words of its design record

The bookcase, plaques, thickness, the reading spread, ribbons, shelf wear, the shelf that parts
as you type, and the two looks — each with what it does and where the reasoning lives.
**[See the full feature list →](features.html)**

## Install the plugin

Ships as an **Obsidian plugin** and as a **standalone HTML exporter** — one page, two mounts,
from the same source. Install steps, settings, and what the plugin reads and writes are all in
the [README on GitHub](https://github.com/luke321/vault-shelf#readme).

It never writes to your notes, it makes no network requests, and it never guesses: a note with
no date is **Undated** rather than filed under a date nobody declared.
