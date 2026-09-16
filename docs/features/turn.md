# Turn the page

Use Previous and Next in the footer, or the arrow keys. With the wheel, push past the end of a note to turn forward; push back at its start to return. The gesture has resistance and works on short notes too. A continued flick turns once until you pause.

![Turn the page](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/turn.webp)

## Storyboard

`act: "turn"` in `scripts/record-demo.mjs`. Design record: `design/0028`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act turn --width 1000 --height 1000 --out demo-turn.mp4 --hero docs/features/turn.webp --hero-acts turn --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.1.0 - 2026-09-16` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 14 seconds |
| WebP | 60 frames; 383,284 bytes |
| Frame | 1000 × 1000 |
