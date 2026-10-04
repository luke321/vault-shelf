# Jump through the index

Edge tabs follow the book's contents: letters for A–Z, periods for Date. Long indexes compress to fit; narrow windows place the tabs below the pages. The magnifying-glass tab and Ctrl/Cmd+F bring you to search within the book.

![Jump through the index](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/index.webp)

## Storyboard

`act: "index"` in `scripts/record-demo.mjs`. Design record: `design/0015`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act index --width 1000 --height 1000 --out demo-index.mp4 --hero docs/features/index.webp --hero-acts index --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-04` |
| Review | Final-tree re-shoot after the range review: start, middle and end stills inspected; dimensions, frame count and WebP timing read from the file |
| Duration | 12 seconds |
| WebP | 81 animation frames; 567,760 bytes |
| Frame | 1000 × 1000 |
