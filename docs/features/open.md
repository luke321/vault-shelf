# A library of your notes

Browse the same vault as shelves of books. A note can belong in several books while staying in its original file.

![A library of your notes](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/open.webp)

## Storyboard

`act: "open"` in `scripts/record-demo.mjs`. Design record: `design/0002`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act open --width 1000 --height 1000 --out demo-open.mp4 --hero docs/features/open.webp --hero-acts open --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 5 seconds |
| WebP | 2 frames; 43,102 bytes |
| Frame | 1000 × 1000 |
