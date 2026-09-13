# Read a two-page spread

Find the contents and a search within the book on the left, and your note on the right. With a library search active, opening the book brings its first matching contents row into view without changing the note on the right. Matching rows and highlighted metadata explain the results. The book's own search narrows its contents by the same rule. In Obsidian, its renderer draws links, embeds, callouts, tasks, tables and code. Wide tables scroll inside the page.

![Read a two-page spread](https://raw.githubusercontent.com/luke321/vault-shelf/1.0.0/docs/features/read.webp)

## Storyboard

`act: "read"` in `scripts/record-demo.mjs`. Design record: `design/0004`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in headless Chrome. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act read --width 1000 --height 1000 --out demo-read.mp4 --hero docs/features/read.webp --hero-acts read --hero-width 1000
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
| WebP | 26 frames; 219,168 bytes |
| Frame | 1000 × 1000 |
