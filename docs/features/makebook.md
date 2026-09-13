# Make a book

Right-click a gap on a shelf arranged by hand to make a book. Give it a name and a source: a folder, a tag, a person or the whole vault. Preview its notes and choose its colour, binding and contents order before saving.

![Make a book](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/makebook.webp)

## Storyboard

`act: "makebook"` in `scripts/record-demo.mjs`. Design record: `design/0020`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act makebook --width 1000 --height 1000 --out demo-makebook.mp4 --hero docs/features/makebook.webp --hero-acts makebook --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 16 seconds |
| WebP | 106 frames; 355,394 bytes |
| Frame | 1000 × 1000 |
