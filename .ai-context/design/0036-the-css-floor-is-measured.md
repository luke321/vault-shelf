# 0036 — The CSS floor is measured, not tabulated

### The claim, and what it was worth, 2026-09-15

An editor's CSS lint flagged five things across `src/page.css`, `src/cyber.css` and
`src/leather.css`, each phrased as a gap against **Obsidian 1.6.5**: `ui-monospace` unsupported,
`clip-path` partial, `multicolumn` partial (for a `column-gap` on a flex row),
`text-decoration` partial, and an `!important` to avoid. `github#61` asked for the one thing a
compat table cannot give — a look at a real Obsidian — before any fallback was written.

Two facts settle most of it before a browser is opened.

**The target is below the floor.** `manifest.json` declares `minAppVersion: 1.7.2`. The linter
was checking 1.6.5, a version this plugin does not support and has never claimed to. A correct
1.6.5 gap would still not be a defect here.

**The target is not in the repo.** There is no `.vscode/settings.json`, no browserslist and no
CSS-lint configuration anywhere in the tree. The "Obsidian 1.6.5" target is editor-local, so no
one else running this repo sees these warnings and nothing in-repo can change them.

### What was measured

`scripts/check-css-support.mjs` installs the built plugin into a throwaway copy of the shared
vault fixture, launches a real Obsidian under CDP, and asks the engine rather than a table. It
names the engine it measured from the user agent rather than being told — **Chromium
150.0.7871.212 / Electron 43.3.0 / Obsidian 1.13.7**, 19/19:

| Flagged | Measured | Verdict |
|---|---|---|
| `clip-path: polygon()` | supported; the notch is excluded from hit-testing and the body still paints | works |
| `clip-path: inset()` | supported | works |
| `column-gap: 10px` on a flex row | computed `10px`, and the gap that lands between two items measures `10px` | works |
| `text-decoration-thickness: 1px` | computed `1px` | works |
| `text-underline-offset: 2px` | computed `2px` | works |
| `text-decoration: underline dotted` | computed style `dotted` | works |
| `ui-monospace` | does **not** resolve: the shipped stack, the stack without the keyword, and bare `monospace` all measure `527.81px` for the same string | falls back, as designed |
| `[hidden] { display: none !important }` | `.vs-railsearch` computes `flex`; with `hidden` set it computes `none` | the `!important` is load-bearing |

Four of the five warnings are compat-data noise against an engine nothing here runs. The fifth,
`ui-monospace`, is real in the narrow sense that the keyword does not resolve on Chromium — and
harmless, because every stack already reads `ui-monospace, SFMono-Regular, Menlo, monospace` and
the last entry is what paints. The fallback chain is the design, not an oversight.

### Why nothing changed

No CSS was edited. Churning shipped declarations to quiet a warning that no supported engine
reproduces is regression risk with no upside, and two of the "fixes" the linter implies would
break rules this repo already holds:

- A `clip-path` fallback would have to live in a look file and move geometry. `page.css` alone
  owns geometry, and a look may repaint but move nothing (`design/0016`, `design/0021`).
- Dropping `ui-monospace` would make the stack strictly worse on any engine that does support
  it, to gain nothing on the engine that does not.

The `!important` at `src/page.css:194` stays, and the linter's generic advice is wrong about it
specifically. `[hidden]` losing to a class selector was a real shipped bug — the reader and both
sheets painted over the library while every attribute-reading check passed. The check now asserts
both halves of that cascade, so the guard has a measurement instead of only a comment.

### What the check is for

The failure this repo keeps re-learning is a claim nobody verified: a design record once asserted
palette parity that had never been measured. This record would rot the same way, because the
answer depends on an engine that ships underneath us and moves on its own. `check-css-support.mjs`
is hand-run alongside the other browser gates — it launches a real Obsidian, so it stays out of
the pre-push hook — and it fails if the engine ever stops supporting a declaration the sheets
rely on.

### The shot that lied, and the assertion that now catches it

Building this check reproduced the repo's own first law in miniature. The harness set
`data-look="leather"` and shot the shelf — but closing the reader rebuilds the page, and a
rebuild resets the attribute. Every assertion passed while `default-shelf.png` and
`leather-shelf.png` came out **byte-identical**, and only a checksum caught it. The harness now
re-applies the look after a rebuild and **asserts which look is painted** before each shot, so a
screenshot can no longer disagree with its own caption. "Default" is `page.css` alone, which is
the attribute being absent — worth stating, because the page ships in the leather look, so the
first pass was measuring leather while calling it default.

**It measures the engine that is installed, which is not the floor.** Obsidian 1.13.7 sits well
above `minAppVersion: 1.7.2`, and nothing here has measured 1.7.2 itself. That gap is deliberate
and stated rather than papered over: installing an old build to test a floor is a bigger job than
this ticket, and the version the linter named is below the floor in any case.
