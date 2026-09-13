# Manage your shelves

The gear opens Manage. Press a shelf's name to jump to it; reorder, edit, hide or delete shelves there. Hiding keeps the books, and deleting a shelf never deletes notes. Shelf gear and eye controls also sit beside each shelf's counts.

![Manage your shelves](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/manage.webp)

## Storyboard

`act: "manage"` in `scripts/record-demo.mjs`. Design record: `design/0009`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act manage --width 1000 --height 1000 --out demo-manage.mp4 --hero docs/features/manage.webp --hero-acts manage --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 19 seconds |
| WebP | 99 frames; 680,608 bytes |
| Frame | 1000 × 1000 |
