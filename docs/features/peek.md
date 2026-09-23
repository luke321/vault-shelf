# A closer look at a spine

A thicker spine holds more notes. Hover to read its title, note count, entries and visits, source folders and a few of the notes inside.

![A closer look at a spine](https://raw.githubusercontent.com/luke321/vault-shelf/1.2.0/docs/features/peek.webp)

## Storyboard

`act: "peek"` in `scripts/record-demo.mjs`. Design record: `design/0011`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act peek --width 1000 --height 1000 --out demo-peek.mp4 --hero docs/features/peek.webp --hero-acts peek --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.2.0 - 2026-09-23` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 7 seconds |
| WebP | 27 frames; 182,982 bytes |
| Frame | 1000 × 1000 |
