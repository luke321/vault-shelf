# Arrange books by hand

Choose Arranged by hand for a shelf, then drag books between neighbours or across rows. Alt+Left and Alt+Right move a focused book one place. Arranging changes where books stand and keeps their contents and saved places.

![Arrange books by hand](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/rearrange.webp)

## Storyboard

`act: "rearrange"` in `scripts/record-demo.mjs`. Design record: `design/0018`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act rearrange --width 1000 --height 1000 --out demo-rearrange.mp4 --hero docs/features/rearrange.webp --hero-acts rearrange --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved by the user on 2026-09-13 |
| Duration | 11 seconds |
| WebP | 60 frames; 341,050 bytes |
| Frame | 1000 × 1000 |
