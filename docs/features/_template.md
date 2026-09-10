<!--
  Scaffold for one entry in the feature gallery (docs/features.md). Copy this file to
  docs/features/<name>.md, fill it in, and add the feature to docs/features.md.

  <name> is one of the act names in scripts/record-demo.mjs's storyboard -- open, shelves,
  plaques, peek, read, index, alsoin, ribbon, parting, wear, build, theme, close. The same
  name goes in this filename, the `act:` line below, and the clip's own filename, which is
  what makes "regenerate this feature's clip" a single lookup instead of three.

  These pages are contributor recipes, not visitor content: docs/_config.yml excludes
  features/ from the built site, and they stay reachable by browsing the repository.
-->

# <Feature name>

<One paragraph, in the README's own voice: what it does, not how it's built. Every claim in
it has to be something you have checked in the code or in a design record -- name the record
at the end, the way docs/features.md does.>

## Where it lives in the storyboard

`act: "<name>"`, driven by `scripts/record-demo.mjs` (`design/0007`).

## Regenerating this feature's clip

One command. It builds a mirror vault from the path in `.mirror-source`, shoots just this act
frame by frame over CDP, and writes both the mp4 and the WebP the gallery embeds:

```bash
node scripts/record-demo.mjs --act <name> --out demo-<name>.mp4 \
  --hero assets/features/<name>.webp --hero-clip 0,12
```

`--fps 4` is a fast rehearsal of exactly the same film; drop it for the real take.
`--look leather` shoots it in the binding instead. **Every act opens what it needs**, so an
act that cannot be shot on its own is a bug in the storyboard rather than a reason to shoot
the whole thing.

`demo-*.mp4` is gitignored. Commit `assets/features/<name>.webp` and update
`Last re-recorded` below in the same commit -- that is what `scripts/release.ps1`'s staleness
check reads, and a feature with no clip yet is skipped rather than warned about.

## Metadata

| | |
|---|---|
| **Introduced in** | `<version, or "predates versioning">` |
| **Last re-recorded** | `<version — YYYY-MM-DD, or "never — clip not yet recorded">` |
