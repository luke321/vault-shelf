# 0033 — Books carry their age as well as their reading

### Entries and visits, clarified 2026-09-13

The user explicitly extended the counter: existing distinct notes count once, a newly added
note counts once, and each actual book open counts once. `wear` retains its storage name and
all prior counts. `bookNotes[address]` is a sorted, distinct, monotonic ledger of note IDs
already counted at that address; an empty array still marks an initialized empty book.
Removing or temporarily losing a note never decrements the count or removes it from this
ledger, so reappearance cannot count it again. Explicit made-book/shelf deletion clears
its ledger with its count; reset starts from current membership again.

`reconcileBookHistory(settings, fullViews)` runs on mount and rebuild over the full unfiltered
library, including hidden shelves. References use their source history. Made books get their
own baseline. Plaques use the union of distinct notes sharing their stable plaque address,
even when a manual shelf has separated runs of the same letter. Their reader membership
still follows the clicked run. Counts remain finite safe integers, up to MAX_SAFE_INTEGER;
the former 9,999 cap would silently lose legitimate large-vault counts and is removed.

Reconciliation saves through the page's existing onSettings callback when history changes.
Known books and obsolete legacy wear keys receive explicit `lastOpened: "never"` values
without inventing a timestamp. Migration retains that literal. Only an actual open replaces
it with ISO UTC. The existing peek now calls the combined count “entries and visits”. The
wear thresholds stay 2/5/12, so populated books now often start at level three.

The plugin's existing buildData reads the metadata cache and its changed/deleted/rename
handlers rebuild after a 400ms burst. No bodies or private vault files are read by the new
helper. For the one-time real-vault update, warm the metadata cache, install the build and
open Vault Shelf; the mount saves the baseline. Opening the library again is idempotent and
does not record a book visit. The monotonic ledger protects counted IDs through temporary
metadata removal; it does not infer metadata that the host has not supplied.

### Last opened, requested 2026-09-13

Actual book opens also persist `lastOpened[sourceAddress]` as an ISO UTC timestamp with
milliseconds, beside the existing `wear` count. The raw default map starts empty;
`lastOpenedAt(settings, address)` returns `never` when no stamp exists. Migration retains
valid canonical timestamps and explicit `never`, without inventing dates for older settings.
This additive field keeps schema 10, as the existing settings migration supplies defaults.

Favourites record against the source book; made books and virtual plaques keep their stable
addresses. Page turns, search, rebuilds and adding notes do not change this timestamp.
Deletion removes it wherever the corresponding wear count is removed, and a full reset
returns to `never` entries when current books are reconciled. Timestamps add no visual control.

Requested 2026-09-13: older books should look worn, including the first time the plugin opens
in a new vault. Opening history cannot answer age: a ten-year-old journal and today's notes
both used to start at level zero.

The displayed level is the greater of two independent facts: the combined entries/visits
level (2, 5 and 12), and an age floor (1, 3 and 7 completed years). Those thresholds
read as last year's book, a few years on the shelf, and an old volume; they preserve the
existing four discrete levels rather than turn age into a continuous chart.

Age comes from the newest resolved note date in a book. A year, month or week naturally uses
its latest dated note; an active person, tag, folder or made book stays fresh when recent notes
join it, even if it also contains one very old note. Undated and empty books receive no age
floor. Future dates do not age a book. The normal date resolver already respects chosen fields,
dated titles and the optional file-stamp fallback; wear introduces no new metadata inference.

The reference date is the library's generated day. Plugin rebuilds supply today's date;
an exported library keeps the date it was built with. This makes identical library data produce
identical paint, rather than change with the viewer's time zone or while a film is being shot.
Completed anniversaries use ISO month/day comparisons: a leap-day anniversary completes on
March 1 in a non-leap year.

`buildAgeWear` runs once per rebuild over the unfiltered library and is read by address when
spines are rendered or an actual open updates their wear. A filter cannot make a collection
suddenly older by hiding its recent notes. Source references use the source address, including
when its source shelf is hidden. No date scan happens during search, hover or a page turn.
Virtual plaque books are cached on first rendering on the Reading shelf, since they do not
exist among the ordinary shelf books indexed by the rebuild.

Existing opening counts are retained, and note entries contribute as described above.
Colours, bindings, manual order and reading places remain their own data. Fresh and migrated
settings receive the same age floor. Resetting history still leaves an old book looking old.

Leather's existing edge-fade overlay is now visible at each level: opacity 0.08, 0.18 and 0.30
(previously level one had no overlay; levels two and three were 0.09 and 0.16). Binding choice
is retained, including Vellum's own ink. No size, board, row packing or address changes. The
existing worn-book lift of up to two pixels remains the same transform in every look.
The former level-three title override used one fixed ink for every binding. Ageing the oldest
month made the binding preview test expose that flattening: five inks became two. The worn
ink now mixes each binding's own ink with the faded tone; Vellum and bright dyes retain their
contrast overrides, and all five distinct inks remain visible.

`check-age-wear.mjs` exercises anniversaries, leap day, future/unknown dates, recency of mixed
collections, deterministic input order, source parity and unchanged settings. The targeted
browser check proves fresh-library paint without saved opens, existing real wear, selected
binding preservation, filter/hidden-source parity and unchanged layout dimensions. The existing
thirteen-opens check now permits an age floor before the first open, and still requires level
three after the opens and rebuild.

Measurements and the inspected screenshot are recorded in `changelog-detail.md` after the
targeted browser run. No full-suite claim belongs to this worker's result.

The Reading geometry check measures the shared board after removing only the exact allowed
wear lift (0, 1 or 2px). It separately rejects an unexpected transform or a layout offset;
painted bottoms alone are not distinct rows. Its optional screenshot includes three actual
Reading books before restoring the saved marks.
