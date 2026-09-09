# Feature gallery

One page per feature, each with a short clip. The clips are recorded from the standalone build
against the generated demo vault, so nothing here shows anybody's notes.

`docs/features/_template.md` is the scaffold: copy it, fill it in, and add a row below.

| Feature | What it is |
|---|---|
| _(none recorded yet)_ | The first release ships without clips; `scripts/release.ps1` warns per feature once one exists and `src/page.js` has moved since. |

## Why the clips are separate from the hero

`assets/demo.webp` is the README hero and is expected to be re-recorded every release that
changes anything visible. A feature clip is **not**: it shows one act, and most releases do not
touch most acts. `scripts/release.ps1` warns about both but gates neither, because only a
person can say whether a given act actually looks different now.
