# Choose A–Z or Date

Set a contents default for a shelf, a plaque's run or one book. The reader's A–Z/Date switch changes both contents and tabs while keeping the selected note and its scroll position. Fresh Encyclopedia and Tags books start in A–Z; other books start with dates, oldest first.

![Choose A–Z or Date](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/contentsorder.webp)

## Storyboard

`act: "contentsorder"` in `scripts/record-demo.mjs`. Design record: `design/0030`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act contentsorder --width 1000 --height 1000 --out demo-contentsorder.mp4 --hero docs/features/contentsorder.webp --hero-acts contentsorder --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved by the user on 2026-09-13 |
| Duration | 13 seconds |
| WebP | 84 frames; 852,996 bytes |
| Frame | 1000 × 1000 |
