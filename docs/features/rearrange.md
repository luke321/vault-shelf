# Arrange books by hand

Choose Arranged by hand for a shelf, then drag books between neighbours or across rows. Alt+Left and Alt+Right move a focused book one place. Arranging changes where books stand and keeps their contents and saved places.

![Arrange books by hand](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/rearrange.webp)

## Storyboard

`act: "rearrange"` in `scripts/record-demo.mjs`. Design record: `design/0018`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act rearrange --width 1000 --height 1000 --out demo-rearrange.mp4 --hero docs/features/rearrange.webp --hero-acts rearrange --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-04` |
| Review | Final-tree re-shoot after the range review: start, middle and end stills inspected; dimensions, frame count and WebP timing read from the file |
| Duration | 11 seconds |
| WebP | 61 animation frames; 253,540 bytes |
| Frame | 1000 × 1000 |
