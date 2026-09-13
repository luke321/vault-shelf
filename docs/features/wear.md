# Books carry their age and use

Books show their age, entries and visits. Existing notes count once per book; a newly added note or a visit adds to its activity. Reopening the vault or removing and restoring the same note does not count that entry again. Age also adds wear after one, three and seven years, measured from the newest dated note. Each book remembers its last actual visit; until then, its last-opened value is never. Your bindings and earlier visit counts stay intact.

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
| Review | Approved on 2026-09-13; retained by user instruction after the counter update |
| Duration | 19 seconds |
| WebP | 74 frames; 637,696 bytes |
| Frame | 1000 × 1000 |
