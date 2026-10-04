# Back in the library

The walkthrough closes on the library: a room made from the notes you already have. This is the closing overview, with the books ready to open again.

![Back in the library](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/close.webp)

## Storyboard

`act: "close"` in `scripts/record-demo.mjs`. Design record: `design/0012`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act close --width 1000 --height 1000 --out demo-close.mp4 --hero docs/features/close.webp --hero-acts close --hero-width 1000
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
| WebP | 4 animation frames; 41,692 bytes |
| Frame | 1000 × 1000 |
