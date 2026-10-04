# Six shelves to start

Favourites starts empty. Encyclopedia, Years, Months, People and Tags each organise the whole vault differently. Build a Weeks shelf whenever you want an ISO-week view.

![Six shelves to start](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/shelves.webp)

## Storyboard

`act: "shelves"` in `scripts/record-demo.mjs`. Design record: `design/0002`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act shelves --width 1000 --height 1000 --out demo-shelves.mp4 --hero docs/features/shelves.webp --hero-acts shelves --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-04` |
| Review | Final-tree re-shoot after the range review: start, middle and end stills inspected; dimensions, frame count and WebP timing read from the file |
| Duration | 14 seconds |
| WebP | 89 animation frames; 4,324,704 bytes |
| Frame | 1000 × 1000 |
