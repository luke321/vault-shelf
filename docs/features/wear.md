# Books carry their age and use

Older books arrive with faded edges, even when you first open the vault. Their newest dated note sets the age: a little wear after one year, more after three and seven. Active collections stay fresh; undated books are not guessed. Returning to a book adds reading wear, and your bindings and reading history stay intact.

![Books carry their age and use](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/wear.webp)

## Storyboard

`act: "wear"` in `scripts/record-demo.mjs`. Design records: `design/0008`, `design/0033`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act wear --width 1000 --height 1000 --out demo-wear.mp4 --hero docs/features/wear.webp --hero-acts wear --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.0.0 - 2026-09-13` |
| Review | Approved by the user on 2026-09-13 |
| Duration | 19 seconds |
| WebP | 74 frames; 637,696 bytes |
| Frame | 1000 × 1000 |
