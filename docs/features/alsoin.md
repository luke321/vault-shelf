# See another collection

Also shelved in opens another book on the same note. Links stay within the library when it contains their destination. Previous collection and Alt+Left return to the collection you came from.

![See another collection](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/alsoin.webp)

## Storyboard

`act: "alsoin"` in `scripts/record-demo.mjs`. Design record: `design/0010`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act alsoin --width 1000 --height 1000 --out demo-alsoin.mp4 --hero docs/features/alsoin.webp --hero-acts alsoin --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-03` |
| Review | Release refresh: start, middle and end stills inspected; source dimensions, frame count and WebP timing verified |
| Duration | 10 seconds |
| WebP | 55 animation frames; 435,958 bytes |
| Frame | 1000 × 1000 |
