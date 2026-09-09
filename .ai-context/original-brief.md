<!-- The founding brief, kept verbatim. Everything below is what the project was asked to
be, before any of it existed. It is here rather than deleted because an ADR explains why not
the other thing, and this is the "thing" several of them are arguing against.

The six OPEN DECISIONS at the foot of this document have since been settled:

| The question | Where it was answered |
|---|---|
| Product name Vault Shelf, command "Open Vault Shelf"? | **Yes to the name.** The command is `Open the library` and the ribbon says `Vault shelf` -- Obsidian's guideline linter rejects both title case and a plugin name repeated in its own command, and the directory re-runs that rule on every published version |
| Which frontmatter date field is the first default? | `date`, then `created`. `decisions/0003`, and the file stamp is opt-in |
| May a custom shelf hold multiple source predicates at launch? | **No.** One predicate; `design/0002` explains why the two questions stay two |
| Are reading positions per book, per note, or both? | Per note, with the book as a hint that is re-resolved. `decisions/0002` |
| May a shelf hold a manual book beside classified ones? | **Not at launch.** Nothing in the address scheme forbids it; nothing implements it |
| Which colour slots and tokens are shared with Vault Graph? | All twelve, by name and by value. `design/0005` |
-->

# Vault Shelf

Continuation plan for the sister plugin to Vault Graph.

## Naming decision

Use **Vault Shelf** as the product name. A shelf is the thing people browse and customize; shelves is the plural. **Shelve** is a verb (“put a note on a shelf”), so it is useful for actions or copy but less clear as the product name.

Working repository concept: a `docs/concepts/vault-shelve/` directory in a vault-graph worktree. That worktree, and the prototype and walkthrough video in it, were deleted before this repository existed; nothing here was recovered from them, and the design records were written from this brief alone.

## Product idea

Vault Shelf turns one Obsidian vault into a continuously browsable personal library. The notes remain in their original files. Shelves and books are views over those notes, so one note can appear in several places without duplication.

The design should feel like modern software that happens to use the metaphor of century-old technology: stable addresses, readable spines, indexes, page edges, and a physical sense of returning to a familiar place. It should share Vault Graph’s calm, measured, local, recognisable character.

## Default shelves

1. **Encyclopedia 0–Z** — title initials, with an explicit 0–9 volume.
2. **Years** — collected editions of notes by year.
3. **Months** — calendar-month notebooks.
4. **Weeks** — ISO-week notebooks, Monday through Sunday.
5. **People** — notes associated with each explicit person.
6. **Tags** — thematic anthologies.

The same note can be in Encyclopedia A, the 2026 yearbook, September 2026, Week 37, Mira’s volume, and the Attention anthology. This overlap is the point: each shelf is another useful address into the same vault.

## First-class shelf creation

Shelf creation must be visible in the main browsing surface, with **New shelf** in the directory, sidebar, and end-of-library card. Every shelf can be edited from its row menu.

The builder asks two separate questions:

- **Which notes belong here?** Whole vault, tag, person, folder, or eventually a saved/compound query.
- **What makes a book?** Title initial, year, month, ISO week, person, tag, folder, or a note property such as Status.

The live preview must show the actual matching note count, number of books, book spines, and any year plaques before saving. Also offer small recipes: monthly journal, book for each person, and anthology of ideas.

Shelf settings:

- stable ID and display name;
- source predicate;
- classifier and property mapping;
- alphabetical or chronological direction;
- visible/hidden state;
- shelf position;
- optional year plaques for month/week classifiers.

Manage shelves is a dedicated surface for reordering, editing, hiding, and restoring. Hiding a shelf never deletes its definition. If all shelves are hidden, show a clear recovery path and New shelf action. Persist arrangements in plugin settings in production; the prototype uses browser storage.

## Year plaques

Month and week books may be grouped under small year plaques on the shelf. The plaque sits beneath the books in the same horizontal scrolling container, so the relationship is obvious and scrolling stays aligned.

Plaques are optional per shelf and are disabled for non-date classifiers. They use a dark engraved label in the Graphite style and a restrained brass plate in Paper & cloth. Individual spines keep their year even when plaques are switched off. Week plaques use the ISO week-year at year boundaries.

## Visual direction: Graphite

This is the primary direction and the strongest companion to Vault Graph:

- charcoal surfaces, fine rules, system sans-serif UI, readable serif note prose;
- named Vault Graph colour slots reused where a folder is represented;
- source colour shown as a small band/fingerprint on each book;
- stable spine dimensions, bounded hover lift, no ornamental 3D physics;
- compact calendar activity ribbon, folder filters, search, and visible filtered state;
- subtle page-edge stack and dark reading spread;
- index tabs are high-contrast, semantic controls rather than decoration.

Graphite should feel like a precise archive: spatially calm, quick to scan, and familiar after repeated use.

## Visual direction: Paper & cloth

Keep this as a skin over the same information architecture:

- parchment and paper surfaces, cloth bindings, dull brass rules, serif headings;
- shallow texture and book-edge depth, kept quiet enough that controls remain obvious;
- warm shelf rails and printed-looking labels;
- the same keyboard, touch, focus, reduced-motion, and screen-reader affordances.

The two directions are aesthetic choices, never different features.

## Reading a book

Clicking a spine opens a spread while retaining shelf position:

- left page: collection title, note count, contents, and a small “find within this book” search;
- right page: the source note rendered as readable Markdown;
- right-edge protruding tabs: context-specific index sections (months, days, alphabet ranges, or future headings);
- previous/next note controls and keyboard arrows;
- “Also shelved in” links that move to another book while preserving note identity;
- collection history with a Previous collection action and Alt+Left;
- a ribbon/bookmark control that saves the note to the Reading table;
- Escape/Back to shelves restores focus and scroll position.

The Reading table is a small persistent landing area for saved notes and last reading places. A saved note must reopen in a valid current collection after edits, renames, or hidden shelves; fall back to the first visible collection containing it.

## Orientation features

Borrow Vault Graph’s strength in stable orientation:

- activity calendar showing which days contain notes, with year selection;
- folder filters using source colour and counts;
- global search over title, aliases, body text where supported, and metadata;
- a visible active-filter row with Clear filters;
- hover/focus book peek with note count, source mix, and a few titles;
- stable shelf addresses and bounded book widths so new notes do not constantly shuffle the room.

## Metadata rules for production

- Dates: configured frontmatter date, recognised daily-note title, then optional creation metadata. Invalid or missing values go to Undated.
- People: explicit people property, configured people folder/type, and resolved links. Do not infer people from prose.
- Tags: make parent-tag inclusion a visible setting (`#garden` includes `#garden/seeds` or not).
- Properties: discover eligible frontmatter properties, show value counts in the preview, and expose missing-value handling.
- Membership counts are unique notes per book even when multiple metadata paths match.
- Stable source identities survive note renames. Membership updates should preserve the nearest reading anchor.

## Accessibility and scale

All books, tabs, filters, shelf controls, and dialogs need keyboard operation, named controls, visible focus, sufficient contrast, and colour-independent labels. Respect reduced motion. Keep touch targets comfortable. Offer a plain list mode for dense navigation and assistive technology.

Virtualise long vertical shelves, horizontal book tracks, and long contents. For huge indexes, use stable ranges or numbered parts rather than thousands of tiny tabs. Keep shelf and book addresses deterministic.

## Release path

1. Keep the standalone concept as a reviewable prototype.
2. Move shelf definitions into Obsidian plugin settings with schema validation and migration.
3. Build membership from metadata cache with explicit date/person/property configuration.
4. Add virtualised shelf and reader views.
5. Render full Markdown and provide Edit in Obsidian / Open in Vault Graph actions.
6. Persist Reading table, reading positions, and shelf order in plugin data.
7. Test with empty shelves, undated notes, multilingual titles, duplicate metadata, 10k-note vaults, narrow screens, keyboard-only use, and reduced motion.

## Existing evidence

The concept prototype has six default shelves, eight classifiers, shelf creation/editing/visibility/reordering, year plaques, calendar and folder filters, reading table, cross-shelf history, book previews, both visual skins, mobile layout, and reduced-motion styling.

Browser checks passed with zero captured errors across desktop and mobile viewports. The full walkthrough video is in the current workspace at `dist\vault-shelve-full-concept.mp4`; the source prototype contains the current visual and interaction decisions.

## Open decisions for Claude

- Should the final product be called **Vault Shelf** while the Obsidian command is “Open Vault Shelf”?
- Which frontmatter date field should be the first default?
- Should a custom shelf be allowed to contain multiple source predicates at launch?
- Should saved reading positions be per book, per note, or both?
- Should a shelf be able to contain an explicit manual book alongside classified books?
- Which Vault Graph colour slot names and theme tokens should be shared in a small design-token module?
