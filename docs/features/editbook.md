# Edit a book

Right-click a book you made to change its name or what it holds. Renaming preserves its reading places. Deleting the book removes its saved rule and leaves every note in the vault.

![Edit a book](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/editbook.webp)

## Storyboard

`act: "editbook"` in `scripts/record-demo.mjs`. Design record: `design/0020`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act editbook --width 1000 --height 1000 --out demo-editbook.mp4 --hero docs/features/editbook.webp --hero-acts editbook --hero-width 1000
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
| WebP | 101 frames; 469,516 bytes |
| Frame | 1000 × 1000 |
