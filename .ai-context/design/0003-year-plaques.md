# 0003 — Year plaques

A Months shelf over ten years is 120 spines on one horizontal rail, and a spine reading
"September 2026" in 11px vertical type is not how anybody finds September 2026. The plaque is
the shelf label a physical library would have: a small engraved year under the run of books
that belong to it.

## The plaque is inside the scroller

This is the whole design, and getting it wrong is easy. The obvious implementation puts the
year labels in their own row above or below the rail and positions them to line up. That
version drifts the moment the rail scrolls, because two elements that scroll independently are
two elements that will eventually disagree — and the failure is silent and looks like a
rendering glitch rather than a layout mistake.

So the plaque is a sibling of its books inside one flex `.group`, and the group is inside the
`.shelfrail` that scrolls. The relationship is structural: it cannot come apart, because there
is nothing to keep in sync.

```
.shelfrail   overflow-x: auto
  .track     display: flex
    .group   display: flex; flex-direction: column
      .books display: flex          ← the spines
      .plaque                       ← the year, stretched to the group's width
```

`align-self: stretch` on the plaque is what makes it exactly as wide as its run of books
rather than as wide as its own text. *a plaque sits under the books it names, in the same
scroller* measures both: the plaque's top against the books' bottom, and that one `.shelfrail`
contains both.

## When there is no plaque, there is still a group

`renderTrack` always builds groups; a shelf with plaques off produces exactly one, keyed on the
empty string, with `plaque: null`. The DOM shape is identical in both cases, so the CSS has no
branch and neither does anything that walks the rail.

## Plaques are date-only, and asked for

`core.plaqueFor` returns `null` unless the shelf has `plaques` on **and** its classifier is
`month` or `week`. A "year" plaque over a People shelf would be a year taken from nowhere.
The builder disables the checkbox for other classifiers, `readBuilderFields` clears the flag
rather than trusting the checkbox, and the suite checks the invariant from the data side: for
every shelf, having plaques and wanting plaques must be the same boolean.

**Week plaques use the ISO week-year**, so 2026-W53 sits under 2026 even though four of its
days are in January 2027. The alternative puts one week under two plaques.

**Spines keep their own year regardless.** Turning plaques off does not shorten a label —
`monthLabel("2026-09")` is "September 2026" with or without a plaque above it — so the plaque
is redundancy for scanning, never the only place the year appears.

## The two skins

Graphite: a dark engraved label — `--surface-2` on `--rule`, letter-spaced small caps.
Paper & cloth: a restrained brass plate — a two-stop gradient in `--brass`, dark text.

Both are the same element with the same geometry. The skin changes the paint and nothing else,
which is the rule the whole visual layer follows (`design/0005`).
