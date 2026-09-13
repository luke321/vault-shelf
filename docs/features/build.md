# Build a shelf

Choose which notes belong, then what makes a book: title, year, month, ISO week, person, tag, folder or any note property. A preview shows the actual books and counts. Recipes give you a starting point you can change.

![Build a shelf](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/build.webp)

## Storyboard

`act: "build"` in `scripts/record-demo.mjs`. Design record: `design/0002`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act build --width 1000 --height 1000 --out demo-build.mp4 --hero docs/features/build.webp --hero-acts build --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 17 seconds |
| WebP | 100 frames; 1,025,752 bytes |
| Frame | 1000 × 1000 |
