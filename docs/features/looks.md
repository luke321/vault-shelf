# Colours and leather bindings

Choose from fourteen colours and six bindings: Original, Minimal, Gilt, Morocco, Vellum and Aged. Hover or focus a choice to preview it, then select to keep it. A book, a plaque's whole run or a shelf can receive the change. Manage also lets you edit book and ribbon colours and coordinate books by year or decade.

![Colours and leather bindings](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/looks.webp)

## Storyboard

`act: "looks"` in `scripts/record-demo.mjs`. Design record: `design/0029`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act looks --width 1000 --height 1000 --out demo-looks.mp4 --hero docs/features/looks.webp --hero-acts looks --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-04` |
| Review | Final-tree re-shoot after the range review: start, middle and end stills inspected; dimensions, frame count and WebP timing read from the file |
| Duration | 26 seconds |
| WebP | 143 animation frames; 1,014,424 bytes |
| Frame | 1000 × 1000 |
