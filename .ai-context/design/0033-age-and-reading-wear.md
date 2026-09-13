# 0033 — Books carry their age as well as their reading

Requested 2026-09-13: older books should look worn, including the first time the plugin opens
in a new vault. Opening history cannot answer age: a ten-year-old journal and today's notes
both used to start at level zero.

The displayed level is the greater of two independent facts: the existing opening-count
level (2, 5 and 12 real opens), and an age floor (1, 3 and 7 completed years). Those thresholds
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

No fabricated open count is persisted. Existing `settings.wear`, colours, bindings, manual
order and reading places remain their own data. Fresh and migrated settings receive the same
age floor. Removing real opening history still leaves an old book looking old.

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
