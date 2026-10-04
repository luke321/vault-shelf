# The shelf parts as you type

Search titles, book covers, tags, people and folders. Matching books come forward while the rest stay as faint spines in their places. Clear the query to bring the room back. Note bodies and file paths are outside this search.

Open a matching book and the left contents scroll to the first match, keeping your selected note on the right. The match count and marked rows show the rest. The note highlights
the matching title or metadata; a match from a cover names that book. The library query
keeps the full contents visible. Find within this book narrows them using the same search rule.

![The shelf parts as you type](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/parting.webp)

## Storyboard

`act: "parting"` in `scripts/record-demo.mjs`. Design records: `design/0008`, `design/0027`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act parting --width 1000 --height 1000 --out demo-parting.mp4 --hero docs/features/parting.webp --hero-acts parting --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-04` |
| Review | Final-tree re-shoot after the range review: start, middle and end stills inspected; dimensions, frame count and WebP timing read from the file |
| Duration | 25 seconds |
| WebP | 141 animation frames; 787,654 bytes |
| Frame | 1000 × 1000 |
