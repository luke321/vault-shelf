# A place for another book

The quiet plus after the last book opens the same creation sheet and adds the new book at the end. It appears on shelves arranged by hand, including Favourites.

![A place for another book](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/plusbook.webp)

## Storyboard

`act: "plusbook"` in `scripts/record-demo.mjs`. Design record: `design/0020`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act plusbook --width 1000 --height 1000 --out demo-plusbook.mp4 --hero docs/features/plusbook.webp --hero-acts plusbook --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 13 seconds |
| WebP | 74 frames; 287,592 bytes |
| Frame | 1000 × 1000 |
