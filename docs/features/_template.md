<!--
  Scaffold for one entry in the feature gallery (docs/features.md). Copy this file to
  docs/features/<name>.md, fill it in, and add the feature to docs/features.md.

  <name> is one of the current feature act names in scripts/record-demo.mjs's storyboard.
  The hero belongs in README rather than a feature page. The same
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

Run from the repository root. The recorder uses the shared generated vault and captures this
act frame by frame over CDP in headless Chrome, writing an MP4 and the gallery's WebP:

```powershell
node scripts/record-demo.mjs --exact-act --act <name> --width 1000 --height 1000 --out demo-<name>.mp4 --hero docs/features/<name>.webp --hero-acts <name> --hero-width 1000
```

`--fps 4` is a fast rehearsal of exactly the same film; drop it for the real take.
Leather is the default. **Every act opens what it needs**, so an
act that cannot be shot on its own is a bug in the storyboard rather than a reason to shoot
the whole thing.

`demo-*.mp4` is gitignored. Review the clip, then commit `docs/features/<name>.webp` and update
`Last re-recorded` below together. A feature capture must not overwrite the approved hero at
`assets/demo.webp`.

## Metadata

| | |
|---|---|
| **Introduced in** | `<version, or "predates versioning">` |
| **Last re-recorded** | `<version — YYYY-MM-DD, or "never — clip not yet recorded">` |
| **Frame** | `1000 × 1000` |
