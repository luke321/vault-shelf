# Fold busy tags into one shelf

Turn on `Only parent tags` for a Tags shelf and every child tag joins its root, once per note: `#garden/seeds` and `#garden/compost` both fold into one `garden` book. It folds and never drops, so the note count underneath is unchanged.

![Fold busy tags into one shelf](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/parenttags.webp)

## Storyboard

`act: "parenttags"` in `scripts/record-demo.mjs`. Design record: `decisions/0003`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act parenttags --width 1000 --height 1000 --out demo-parenttags.mp4 --hero docs/features/parenttags.webp --hero-acts parenttags --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.3.0` |
| Last re-recorded | `1.3.0 - 2026-09-27` |
| Review | Approved by the maintainer, 2026-09-27 |
| Duration | 16 seconds |
| WebP | 93 frames; 679,408 bytes |
| Frame | 1000 × 1000 |
