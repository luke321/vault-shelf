# Find the tag where it actually is

When the open book is about something the note contains — a tag book, a person book, a book made
from a note property — small flags stand on the fore-edge of the right-hand page, one for each
place that subject is written. Press one and the note scrolls there with that occurrence marked,
and only that one. A subject that is only declared in the frontmatter gets a hollow flag on the
note's details line, which is where it actually is; a subject written nowhere gets no flag at
all. The note is read, never changed. Design record: `design/0037`.

## Where it lives in the storyboard

`act: "sticky"`, driven by `scripts/record-demo.mjs` (`design/0007`).

The act opens `tags/garden` on **A season in the same bed, start to finish** — the one note in
the generated vault that writes its own tag in its own prose (`make-vault.mjs` refuses to finish
without it). Every other note in that vault declares its tags in frontmatter, so no other book
can show more than the declared flag.

## Regenerating this feature's clip

Run from the repository root. The recorder uses the shared generated vault and captures this act
frame by frame over CDP in headless Chrome, writing an MP4 and the gallery's WebP:

```powershell
node scripts/record-demo.mjs --exact-act --act sticky --width 1000 --height 1000 --out demo-sticky.mp4 --hero docs/features/sticky.webp --hero-acts sticky --hero-width 1000
```

`--fps 4` is a fast rehearsal of exactly the same film; drop it for the real take. Leather is the
default.

The act proves itself while it films: it refuses to start unless the fore-edge draws four flags,
and each of its three presses asserts what the press did — the first that the page moved at all,
the second that it went further down the note than the first, the third that the declared flag
came back to the details line with the mark inside `#vs-notemeta`. A failure here is a defect in
the feature, not in the take.

`demo-*.mp4` is gitignored. Review the clip, then commit `docs/features/sticky.webp` and update
`Last re-recorded` below together. A feature capture must not overwrite the approved hero at
`assets/demo.webp`.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.2.0` |
| Last re-recorded | `1.2.0 - 2026-09-23` |
| Review | Recording requested 2026-09-17; re-recorded and added to the gallery for 1.2.0 |
| Duration | 13 seconds |
| Frame | 1000 × 1000 |
