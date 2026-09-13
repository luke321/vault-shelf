# See another collection

Also shelved in opens another book on the same note. Links stay within the library when it contains their destination. Previous collection and Alt+Left return to the collection you came from.

![See another collection](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/alsoin.webp)

## Storyboard

`act: "alsoin"` in `scripts/record-demo.mjs`. Design record: `design/0010`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act alsoin --width 1000 --height 1000 --out demo-alsoin.mp4 --hero docs/features/alsoin.webp --hero-acts alsoin --hero-width 1000
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
| WebP | 60 frames; 496,636 bytes |
| Frame | 1000 × 1000 |
