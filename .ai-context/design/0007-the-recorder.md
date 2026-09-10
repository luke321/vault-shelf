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

## Output

`--out` writes h.264 in an mp4 (`yuv420p`, `+faststart`, even dimensions forced — an odd
width is the one thing that makes libx264 refuse). `--hero` additionally writes an animated
WebP for the README at 12fps and 1000px wide.

The mp4 is gitignored (`demo-*.mp4`); the WebP is committed, because it is what the README
shows and `scripts/release.ps1` warns when it has gone stale against `src/`.
