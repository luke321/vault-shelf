# 0007 — The recorder

`scripts/record-demo.mjs` builds the standalone page from a fixture, drives it through a
storyboard, captures every frame over CDP, and hands the sequence to ffmpeg.

## It captures frames, it does not record a screen

The sister repo records the desktop with ffmpeg's `gdigrab` and pays for it: the recording
grabs a display *region*, so a second take captures the first one's window, a notification
lands in the middle of a release asset, and the whole thing needs a machine-wide `record` lock
to be safe. It also cannot run on a machine nobody is sitting at.

This one asks the browser for each frame — `Page.captureScreenshot` over CDP, headless.

| | |
|---|---|
| **Reproducible** | The same fixture and the same storyboard produce the same frames. There is no desktop in the picture, so there is nothing on the desktop that can get into it. |
| **Unattended** | Headless. It does not steal the screen, and it cannot capture the wrong window, so it needs no lock. |
| **Framed exactly** | `Emulation.setDeviceMetricsOverride` fixes the viewport at 1440×900 and DPR 1, so the output is the size it says it is regardless of the machine's display. |
| **Slower than real time** | About 18 frames a second of capture. An 83-second video takes a little under two minutes to shoot. That is the price, and it is worth it. |

The consequence worth knowing: **the video is not a recording of the animation, it is a
sequence of states.** Anything the page animates on its own — a CSS transition — is captured
at whatever phase each frame happens to catch. Vault Shelf animates almost nothing on purpose
(`design/0005`), so this costs nothing here; a project with a running animation would need the
frames driven from its clock instead.

## The storyboard is a table

Each act declares how many **seconds** it lasts and gets handed a normalised `0..1` through
that time. The frame rate lives in one constant, so `--fps 4` is a fast rehearsal of exactly
the same video and `--fps 24` is the real one. `--act read,index` shoots a subset, which is
how you iterate on one act without paying for the other eleven.

Motion comes from the harness, not the page: `scrollTo` and `railTo` set `scrollTop` and
`scrollLeft` per frame through an ease, which is smoother than a real smooth-scroll and
exactly repeatable. Hover is a genuine `Input.dispatchMouseEvent`, because `:hover` is a real
state and faking it with a class would be demonstrating something the product does not do.

## The captions are the recorder's, never the page's

`#vsrec` is injected by the harness into the document, along with a rule that shortens
`#vs-app` by the caption bar's height. So the bar **takes** space rather than covering the
library, and no part of the product is hidden behind the thing describing it.

The first version was a gradient scrim over the bottom of the page and it was illegible: a
dark translucent wash over an already-dark charcoal UI is invisible, and the text sat on top
of the folder list. A solid band with a hairline above it, outside the app, reads at a glance.

The bar has a `paper` variant, and the act that switches skins toggles it, because a dark
caption bar under a parchment library looks like a bug.

## The fixture is copied under a name worth showing

The exporter takes the vault's name from its directory, and a fixture directory is named by
its generator digest. `demo-vault-b2957892` in the corner of a demo says nothing to anybody,
so the recorder copies the fixture to `Everything` first. `--vault-name` changes it.

## A long capture run is not a browsing session

The first full pass died at frame **948 of 1,992** with `CDP connection lost (socket closed)`
and nothing else — the browser had gone, and "socket closed" is the symptom every time. The
same acts shot in isolation (516 frames) were fine, so it was cumulative rather than anything
in a particular act.

Two things came out of that, and both are worth more than the fix:

- **Chrome's stderr is captured into a ring buffer** and printed when a capture fails twice,
  along with the process's exit code and the act and frame it died on. A harness that can only
  say "socket closed" makes the next person guess.
- **One retry per frame, and only one.** A capture that fails twice is a browser that is gone;
  continuing would silently drop frames out of the middle of the video, which is worse than
  stopping, because nobody reviews an 83-second video frame by frame.

The flags that stop it accumulating are `--disable-gpu`, `--disable-dev-shm-usage`,
`--disable-software-rasterizer` and a raised `--max-old-space-size`. None of them changes what
is drawn; they change how long a headless renderer will keep drawing it.

## One step, once, whatever the frame rate

An act is handed `t` on every frame, so `if (t > 0.16 && t < 0.22) click()` fires on **every
frame inside that window** — three times at 6fps, thirteen at 24. For an idempotent step
(set a theme, set a query) that is merely wasteful. For a **toggle** it is a coin flip decided
by the frame rate: the ribbon act left the note bookmarked at one frame rate and un-bookmarked
at another, and the film had no ribbon in it.

`once(key, at, t, fn)` fires a step the first time `t` passes a threshold and never again.
Every timed step in the storyboard goes through it.

**And every act opens what it needs.** The ribbon act relied on the previous act having left
the reader open, so `--act ribbon` on its own shot a click at a disabled button and filmed
nothing changing. An act that cannot be shot alone cannot be iterated on alone, which defeats
the point of `--act`.

## Output

`--out` writes h.264 in an mp4 (`yuv420p`, `+faststart`, even dimensions forced — an odd
width is the one thing that makes libx264 refuse). `--hero` additionally writes an animated
WebP for the README at 12fps and 1000px wide.

The mp4 is gitignored (`demo-*.mp4`); the WebP is committed, because it is what the README
shows and `scripts/release.ps1` warns when it has gone stale against `src/`.

## Which look it shoots in (2026-09-11)

`--look leather|modern|cyber` picks the look through the library's own selector, the way a
person does, and the selector stays in shot because it is part of the product. `modern` is an
alias for the selector's empty value, since an empty flag is no flag and a fresh library opens
in leather now (`design/0016`). The recorder throws rather than shooting 98 seconds of the
wrong look if the attribute does not come back as asked. Three films are kept in the review
folder, one per look, and the hero is cut from the leather one.

