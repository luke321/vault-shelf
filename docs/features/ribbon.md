# Keep a ribbon in it

Save a note and ribbons hang from the books that contain it. The Reading shelf gathers your marked books. Reading places survive rearranging or rebuilding, and resolve through another visible shelf if the original is hidden. Each reader ribbon carries its book's binding.

![Keep a ribbon in it](https://raw.githubusercontent.com/luke321/vault-shelf/1.1.0/docs/features/ribbon.webp)

## Storyboard

`act: "ribbon"` in `scripts/record-demo.mjs`. Design record: `design/0008`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act ribbon --width 1000 --height 1000 --out demo-ribbon.mp4 --hero docs/features/ribbon.webp --hero-acts ribbon --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.1.0 - 2026-09-16` |
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 18 seconds |
| WebP | 83 frames; 399,694 bytes |
| Frame | 1000 × 1000 |
