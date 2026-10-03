# 0036 — The CSS floor is measured, not tabulated

## Community review, not an editor-only warning (`github#109`, 2026-10-03)

**This supersedes the earlier editor-local diagnosis and recommendation to leave every
declaration unchanged.** The owner identified Obsidian community review as the source; the
[published scorecard](https://community.obsidian.md/plugins/vault-shelf) contains the five
exact warning categories and names Obsidian 1.6.5. The absence of a lint config in this
repository never established where the warnings originated.

The [official Obsidian Stylelint config](https://github.com/obsidianmd/stylelint-config)
documents the review rules: `plugin/no-unsupported-browser-features` and
`declaration-no-important`. The former uses doiuse/caniuse feature groups, not a runtime
test of each declaration. Its `multicolumn` detector matches `column-gap` even on flex rows.

## Reproduction

`scripts/check-css-review.mjs` runs those two official rules against all three source sheets
and built `styles.css`. It has **no ignores**, including none of the upstream config's default
feature exceptions. Every finding is reported; successful completion is not a clean-score
claim. The unrelated formatting rules in the full Stylelint preset are outside this check.

Install the optional scanner outside the repository, then supply its directory:

```powershell
npm install --prefix <scanner-directory> --no-audit --no-fund stylelint@17.16.0 stylelint-config-obsidianmd@0.1.0
npm run build
node scripts/check-css-review.mjs --tools <scanner-directory> --out <report.json>
```

Measured transitive versions: stylelint-no-unsupported-browser-features 8.1.2, doiuse 6.0.6,
browserslist 4.29.3, electron-to-chromium 1.5.444. The review retains the dependency lock and
before/after JSON; future compatibility databases may give different results.

Targets are `electron 30.0` (Chrome 124, the screenshot), `electron >= 30.0` (the conservative
desktop range for `minAppVersion: 1.7.2`), and `electron >= 31.0` (the next installer floor).
The official config maps Electron 30 to Obsidian 1.6.5 and Electron 31 to 1.7.4;
[Obsidian's 1.7.4 release notes](https://obsidian.md/changelog/2024-10-16-desktop-v1.7.4/)
confirm the update to Electron 31.6.0. An app-version requirement does not force an existing
installation to update Electron. We do not label 1.7.2 an empirically tested engine, raise
the minimum version, or imply that Electron targets cover mobile WebViews.

All three targets gave the same declaration counts:

| Finding | Before | After | Decision |
|---|---:|---:|---|
| extended-system-fonts | 8 | 0 | Host monospace variable with explicit fallbacks |
| multicolumn | 1 | 0 | Flex `gap: 0 10px` |
| text-decoration | 3 | 0 | Solid/dotted inline bottom borders |
| declaration-no-important | 1 | 0 | Actual root ID specificity, last in page.css |
| css-clip-path | 10 | 10 | Preserve clipping, silhouettes and hit regions |
| **Total** | **23 / 5 categories** | **10 / 1 category** | No suppression |

Source totals: page.css 10→4, leather.css 6→6, cyber.css 7→0; built styles.css 23→10.
This reproduces the rules locally; it is not a fresh community score or a score prediction.

## Replacements and their costs

**Spacing.** `gap: 0 10px` retains the flex row's zero vertical gap; `gap: 10px` would add
space on wrapping. The narrow-view override remains `gap: 2px`. Measured wrapped probes:
1180px viewport gives 10/0px horizontal/vertical; 780px and 460px give 2/2px.

**Hidden controls.** `.vault-shelf:is(#vs-app) [hidden]`, last in page.css, has specificity
1-2-0. The actual root is `#vs-app.vault-shelf` in both hosts. It beats class display rules
and the ID-based Manage button (1-1-0), and ties the rail inner rule (1-2-0) later in source
order. Neither look sheet sets a stronger element display; their stronger display rules hide
pseudo-elements. The old plain `.vault-shelf [hidden]` at the top was only 0-2-0 and must not
be restored without the old importance. The historical hidden-reader-overlay regression
remains the reason for this guard. New display rules must pass the cascade check.

The targeted check covers all three looks, both themes, shelf and list modes, four UI states,
and reader, builder and Manage opening/closing twice. It reads computed display and geometry,
not just attributes: 5,442 hide/restore probes, 84 states, 72 open/close cycles, zero failures.

**Fonts.** All eight stacks use `var(--font-monospace, SFMono-Regular, Menlo, monospace)`.
The plugin follows Obsidian's resolved monospaced face; the standalone export, which has no
host variable, keeps the explicit fallbacks. This preserves monospace intent and respects
the host's font preference; it does not promise the same width as the previous fallback.

Primary references: Obsidian's [typography variables](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/CSS%20variables/Foundations/Typography.md),
[Monospace font setting](https://help.obsidian.md/Settings), and
[mobile development guide](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Getting%20started/Mobile%20development.md),
plus the CSS [font-family model](https://www.w3.org/TR/css-fonts-4/#generic-font-families) and
[variable fallback rules](https://www.w3.org/TR/css-variables-1/#using-variables).
Mobile uses a WebView, not desktop Electron. Named faces are tried in order; generic monospace
remains last when those faces are unavailable. No OS branching or font download was added.
Removing `ui-monospace` may choose a different monospace on Apple platforms where the keyword
resolves: a typeface difference, not loss of monospace content. macOS/iOS/Android were not run
on this Windows machine and their rendering is not claimed tested.

The updated Obsidian harness passed 19/19 on Obsidian 1.13.7 / Electron 43.3.0 / Chromium
150.0.7871.212. Its resolved host stack includes the host's platform font choices (including
`ui-monospace`); we consume that existing setting rather than copying or hiding a keyword in
a plugin variable. The new shipped stack and host control both measured 562.5px, while the
standalone fallback measured 527.81px. Host-font behaviour is verified on this installed
Windows host; Apple/mobile fallback behaviour remains a documented, unmeasured distinction.

**Links.** A headed comparison covered three-line live/dead links, descenders, inline code
and superscripts. Conventional bottom borders keep fragment widths and wrapping; paragraph
height stays 89.0625px before/after and on hover. Live links remain solid, coloured and
clickable; dead links remain muted and dotted. Hover thickens 1→2px; keyboard focus keeps its
2px outline. The border sits slightly lower and does not perform native ink-skipping. These
are visible polish differences, shown in review, not pixel identity. Inline hit rectangles
extend by 1px (2px on hover); paragraph layout does not move. No inline-block conversion or
unwrappable link was introduced. Obsidian's rendered links retain the host renderer's rules.

## Why clipping remains

Nine polygon declarations cut notches, points, angled or ragged ends into ribbons, marks and
swatches. The tenth, `inset(0)`, makes the minimal binding rectangular while retaining a
clipping boundary. Plain `none` also releases clipped paint/descendants and the clipping
context; it is not the same contract. Borders can draw simple triangles, but these controls
contain text and layered paint and their hit regions must follow their outlines. A mask or
background substitution changes the hit-test contract; rewriting them as SVG is a rendering
redesign, not an equivalent declaration substitution.

The runtime harness checks that the notch rejects a hit and the body accepts one. All ten
declarations remain visible to the scanner. The warning is reported rather than flattening
shapes, hiding declarations or promising support on every historical engine.

## Historical measurement (`github#61`, 2026-09-15)

The earlier runtime check passed 19/19 on Obsidian 1.13.7 / Electron 43.3.0 / Chromium
150.0.7871.212. Polygon/inset clipping, a 10px flex column gap, native dotted decoration,
1px thickness and 2px offset worked. Windows' old font stack and bare monospace both measured
527.81px, and the importance-based hidden guard beat the class display.

Those observations remain historical evidence, **not** proof about the minimum version or
other platforms. The deduction that the warnings were editor-local, harmless to community
review, and unfixable without regressions was not established and is superseded. The harness
now probes the shipped spacing, border and host-font choices. It continues to assert the
applied look before screenshots because a rebuild can reset it.
