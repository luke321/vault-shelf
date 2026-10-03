# Words from your vault

As you type, suggestions offer people, tags, folders, the names printed on book covers and note titles. Use the arrow keys and Enter, or click a suggestion, to complete the search. The offered words and the library's matches use the same catalogue of names.

![Words from your vault](https://raw.githubusercontent.com/luke321/vault-shelf/1.3.0/docs/features/autocomplete.webp)

## Storyboard

`act: "autocomplete"` in `scripts/record-demo.mjs`. Design record: `design/0026-the-search-vocabulary`.

## Regenerate the clip

Run from the repository root. The recorder uses the shared generated vault and captures frames
over CDP in visibly headed Chrome on a guard-approved monitor under the shared record lock. This act prepares its own starting state.

```powershell
node scripts/record-demo.mjs --exact-act --act autocomplete --width 1000 --height 1000 --out demo-autocomplete.mp4 --hero docs/features/autocomplete.webp --hero-acts autocomplete --hero-width 1000
```

Use `--fps 4` for a quick rehearsal. Review the resulting clip before committing it.
The MP4 is ignored; commit the WebP and update this page's metadata together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.0.0` |
| Last re-recorded | `1.3.0 - 2026-10-03` |
| Review | Release refresh: start, middle and end stills inspected; source dimensions, frame count and WebP timing verified |
| Duration | 12 seconds |
| WebP | 59 animation frames; 291,596 bytes |
| Frame | 1000 × 1000 |
