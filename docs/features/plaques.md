# Open a whole run

Months and weeks gather under years, years under decades, and people and tags under letters. Click a plaque to read its run as one book. When a run wraps, either copy of its plaque opens the same collection.

![Open a whole run](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/plaques.webp)

## Storyboard

`act: "plaques"` in `scripts/record-demo.mjs`. Design record: `design/0019-a-plaque-opens-its-run`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act plaques --width 1000 --height 1000 --out demo-plaques.mp4 --hero docs/features/plaques.webp --hero-acts plaques --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved by the user on 2026-09-13 |
| Duration | 10 seconds |
| WebP | 62 frames; 397,356 bytes |
| Frame | 1000 × 1000 |
