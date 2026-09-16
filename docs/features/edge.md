# Reach the next shelf

Carry a book or shelf toward the top or bottom of the library and the room scrolls with your drag. Move away from the edge to stop; Escape cancels the move.

![Reach the next shelf](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/edge.webp)

## Storyboard

`act: "edge"` in `scripts/record-demo.mjs`. Design record: `design/0024`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act edge --width 1000 --height 1000 --out demo-edge.mp4 --hero docs/features/edge.webp --hero-acts edge --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.1.0 - 2026-09-16` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 13 seconds |
| WebP | 75 frames; 866,338 bytes |
| Frame | 1000 × 1000 |
