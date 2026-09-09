# 0001 — Settings belong to the host; the page stores nothing

**Date** 2026-09-09 · **Status** accepted

## Context

Vault Shelf has more persisted state than its sister does: shelf definitions, their order and
visibility, the reading table, the skin, and the metadata configuration. All of it is a
person's arrangement of their own library, and losing it is worse than losing a rendering.

Two hosts want to keep it in two different places. Obsidian has `saveData`/`loadData`, which
puts it in the vault where the person's backups already reach. The standalone page has
`localStorage`, which is per-browser and per-origin and can vanish without notice.

## Alternatives weighed

| Option | Why not |
|---|---|
| **The page owns storage** | It would have to know which host it is in, and the plugin would end up with settings in `localStorage` inside Obsidian's Electron profile — not in the vault, not in anybody's backup, and invisible to Sync. |
| **A settings object passed once, mutated in place** | The page and the host would share one object, so an edit cancelled in the shelf builder would still be in the host's copy. `core.clone` exists because of this. |
| **Two code paths, one per host** | Two things that must agree, and no mechanism that makes them. |

## Decision

**Settings go in as data and come back out as data.** `mountVaultShelf` takes `settings` and
an `onSettings` callback and stores nothing itself. Every write goes through `persist()`,
which hands the host a `core.clone` of the whole object.

**Everything that arrives is migrated.** `core.migrate(raw: unknown)` is the only door: it
takes anything — an old schema, a hand-edited JSON file, `null` — and returns a well-formed
`Persisted`. Shelves that do not look like shelves are dropped; positions are renumbered from
the array order, so a corrupt `position` cannot make a shelf unreachable; a bad `skin` falls
back to graphite.

**It never throws.** A corrupt setting must not cost somebody their library, and a shelf
definition is cheap to re-make. `SETTINGS_SCHEMA` is the version number a future migration
will branch on.

## Consequences

- The plugin's `saveSettings` runs everything through `migrate` on the way in as well, so
  even a write from the page cannot put a malformed object in the vault.
- The standalone's settings are per-browser, and that is honest: it is a review artefact,
  not the product.
- A test can hand `mountVaultShelf` any settings object it likes without touching a host.
