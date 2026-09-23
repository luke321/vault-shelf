# A book draws forward by how much of it answers

Two states used to be the whole of it: a book either matched or it did not, and every match
stood the same height above the shelf. On a vault of any size that stopped meaning anything — a
common name could draw over a hundred books forward as loudly as the one that was the actual
answer. Now a book lifts and opens air in proportion to the share of its own notes that matched:
a half or more is the top rung, then a fifth, then a twentieth, then a bare match at the floor.
The book that *is* the answer — every one of its notes carries the term — stands clearly proud of
the whispers around it.

![A book draws forward by how much of it answers](https://raw.githubusercontent.com/luke321/vault-shelf/1.2.0/docs/features/matchweight.webp)

## Where it lives in the storyboard

`act: "matchweight"`, driven by `scripts/record-demo.mjs` (`design/0007`). Design record:
`design/0008` (`github#42`).

The act opens the People shelf and searches the person with the most notes in the vault — their
own book is where every note carries them, so it is guaranteed to sit at the top rung whichever
vault this runs against. The act proves the ladder actually climbs (each rung's lift measurably
higher than the last) before the camera moves on, then clears the search with the new clear
button (`github#91`) to show the ladder resets with it.

## Regenerating this feature's clip

Run from the repository root. The recorder uses the shared generated vault and captures this act
frame by frame over CDP in headless Chrome, writing an MP4 and the gallery's WebP:

```powershell
node scripts/record-demo.mjs --exact-act --act matchweight --width 1000 --height 1000 --out demo-matchweight.mp4 --hero docs/features/matchweight.webp --hero-acts matchweight --hero-width 1000
```

`--fps 4` is a fast rehearsal of exactly the same film; drop it for the real take. Leather is the
default.

`demo-*.mp4` is gitignored. Review the clip, then commit `docs/features/matchweight.webp` and
update `Last re-recorded` below together.

## Metadata

| Field | Value |
|---|---|
| Introduced in | `1.2.0` |
| Last re-recorded | `1.2.0 - 2026-09-23` |
| Review | Recorded 2026-09-23 as part of the 1.2.0 release; ladder proven live (rungs 1-4, lift 2/6/10/14px) before the clip was accepted |
| Duration | 14 seconds |
| Frame | 1000 × 1000 |
