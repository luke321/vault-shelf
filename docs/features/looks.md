# Colours and leather bindings

Choose from fourteen colours and six bindings: Original, Minimal, Gilt, Morocco, Vellum and Aged. Hover or focus a choice to preview it, then select to keep it. A book, a plaque's whole run or a shelf can receive the change. Manage also lets you edit book and ribbon colours and coordinate books by year or decade.

![Colours and leather bindings](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/looks.webp)

## Storyboard

`act: "looks"` in `scripts/record-demo.mjs`. Design record: `design/0029`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act looks --width 1000 --height 1000 --out demo-looks.mp4 --hero docs/features/looks.webp --hero-acts looks --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved by the user on 2026-09-13 |
| Duration | 26 seconds |
| WebP | 154 frames; 1,023,164 bytes |
| Frame | 1000 × 1000 |
