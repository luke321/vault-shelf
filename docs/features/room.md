# The reading room

A centred bookcase keeps shelves within reach. Long shelves continue onto the next board, and the page makes room as the window narrows.

![The reading room](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/room.webp)

## Storyboard

`act: "room"` in `scripts/record-demo.mjs`. Design record: `design/0009`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act room --width 1000 --height 1000 --out demo-room.mp4 --hero docs/features/room.webp --hero-acts room --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-04` |
| Review | Final-tree re-shoot after the range review: start, middle and end stills inspected; dimensions, frame count and WebP timing read from the file |
| Duration | 5 seconds |
| WebP | 4 animation frames; 42,134 bytes |
| Frame | 1000 × 1000 |
