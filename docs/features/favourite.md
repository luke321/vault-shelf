# Collect your favourites

Drag a book onto Favourites, then arrange it among the books already there. A favourite follows its source book as notes change; dragging it off removes only the reference. Create more collection shelves in the builder.

![Collect your favourites](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/favourite.webp)

## Storyboard

`act: "favourite"` in `scripts/record-demo.mjs`. Design record: `design/0019-the-favourites-shelf`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act favourite --width 1000 --height 1000 --out demo-favourite.mp4 --hero docs/features/favourite.webp --hero-acts favourite --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.1.0 - 2026-09-16` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 11 seconds |
| WebP | 62 frames; 241,226 bytes |
| Frame | 1000 × 1000 |
