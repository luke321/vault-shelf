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

## The hero opens on the drag (github#21, 2026-09-11)

*"re record all clips in leather, make the hero thematically interesting, start with favourite
shelf drag and drop, then ribbons, then search."* The order is a claim about what the product
is — you make the shelf yours, you mark your place, and the room answers you — so the film
opens on those three, and the rest follows them.

**The storyboard now runs** `open, favourite, ribbon, parting, room, shelves, plaques, peek,
read, index, alsoin, wear, build, makebook, editbook, plusbook, looks, close` — 149 seconds,
3,576 frames at 24fps, 178 seconds of capture. The first five are the hero.

**Leather is the default.** `--look` reads `leather` when it is absent, since that is the look
a fresh library opens in (`design/0016`) and the old hero was cut before it was; `--look
modern` still asks for the other one.

**The hero is named by act, not by second.** `--hero-clip 5,12` stayed `5,12` while the acts
under it were re-timed, so it cut a beat in half and nobody noticed. `--hero-acts` (default
`open,favourite,ribbon,parting,room`) names the acts, and the window is wherever they land in
the take being shot — `--act` moves it rather than cutting through it. `--hero-clip
<start>,<duration>` still overrides it for a cut by hand.

**Its budget** is `--hero-fps 8 --hero-width 800 --hero-q 40`: 2.9 MB for 38.5 seconds. The
first cut at 10fps and 900px was 4.75 MB. Frame rate goes first, then width, then quality; at
800px the 27px caption still reads at 15px, and at 720px its second line does not.

### The drag

The events are the page's own — a `dragstart` with a `DataTransfer`, a `dragover` on whatever
is under the pointer on every frame, a `drop`, a `dragend` — so the landing lights, the mark
stands in the gap and the book settles by the product's code and nobody else's. The act
asserts on each: the rail's `data-drop` before the first drop, a `.vs-drop[data-side=before]`
before the second, and the pick shelf's sequence after both.

Two things the suite's history teaches (`github#3`) and this act depends on: the source is
never hidden on `dragstart`, which cancels the gesture in Chrome; and a `dragover` nobody
accepts offers no drop, which is why `drop` reads the page's answer rather than assuming it.

**The ghost.** A headless screenshot has no drag image in it, the way it has no cursor: Chrome
draws both outside the page. So `lift` clones the spine into `#vsrec-ghost`, inside the
library's own root so its own stylesheet paints it, and `carry` moves it with the arrow;
`drop` removes it the way the browser's would be. The spine on the shelf dims by the page's
own rule, which is the part the product does.

**The mouse stays still while a book is carried.** Chrome sends no mouse events during a
native drag; the recorder's real `mouseMoved` on every frame raised a peek under every spine
the ghost crossed. `pointer(p, pressed, quiet)` moves the arrow and not the mouse, `lift`
dispatches `mouseleave` on the source so its peek closes, and hiding the arrow parks the real
mouse in the caption bar — the spine it was last over otherwise keeps its peek open into the
next act, which is how the wear act came to film a tooltip.

### An act's own error stops the take

The first take of the new hero ran green with the pointer frozen on one spine for eleven
seconds. `act.at()` sat inside the same `try` as the screenshot, so a step that threw was
"retried" by taking the picture again, and the act filmed a frozen page to the end. The act
call has its own `try` now and reports the act, the frame and `t`; only the capture is
retried, once.

### What the old storyboard misrepresented

- The opening said 394 notes: the fixture's count, hard-coded. It reads the page now.
- "Six shelves" listed Weeks, which is hidden by default. The names are read off the page.
- The plaque act scrolled a rail sideways; nothing has scrolled sideways since `design/0014`.
  It opens the widest plaque now, since a plaque opens its run (`design/0019`).
- The peek and read acts took the fourth Months spine, a one-note book with nothing to
  index. They take the thickest.
- The theme act set `data-theme` under leather, which is one palette by design, and filmed
  nothing changing. It is a `looks` act: the selector to modern, the theme to light, and
  back to leather.
- The ribbon act clicked `#vs-ribbon`, which no longer exists; the ribbon is
  `#vs-marks .vs-markstub`. The Reading shelf that appears is named in the caption.
- The search needle was the most-used tag; it is the most-named person now, since a person
  parts a shelf harder than a tag does.
- Favourites, which the library opens on, was never mentioned. It is the first beat.

