# 0007 — The recorder

`scripts/record-demo.mjs` builds the standalone page from a fixture, drives it through a
storyboard, captures every frame over CDP, and hands the sequence to ffmpeg.

## It captures frames, it does not record a screen

The sister repo records the desktop with ffmpeg's `gdigrab` and pays for it: the recording
grabs a display *region*, so a second take captures the first one's window, a notification
lands in the middle of a release asset, and the whole thing needs a machine-wide lock on **that
display** to be safe — `screen-left`, `screen-right` or `screen-primary`, shared with this repo
through one lock root (`decisions/0012`, `vault-graph#87`). It also cannot run on a machine
nobody is sitting at.

This one asks the browser for each frame — `Page.captureScreenshot` over CDP, headless.

| | |
|---|---|
| **Reproducible** | The same fixture and the same storyboard produce the same frames. There is no desktop in the picture, so there is nothing on the desktop that can get into it. |
| **Unattended** | Headless. It does not steal the screen, and it cannot capture the wrong window, so it takes no screen lock — the only thing in `scripts/` that places no window and claims no display (`decisions/0012`). |
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
WebP for the README at 8fps and 1000px wide (quality 75 by default).

The mp4 is gitignored (`demo-*.mp4`); the WebP is committed, because it is what the README
shows and `scripts/release.ps1` warns when it has gone stale against `src/`.

## Release 1.0.0: the square hero

The `hero` act is an independently shootable 68-second story, following the requested order:
scroll the populated library; open a year book; select a right-side index tab; select a note
in the contents; leave a ribbon; close the book; scroll to the top; drag an Encyclopedia book
onto Favourites; create **My Journal** on
Favourites from the generated daily-notes folder; right-click that book and choose a binding
and colour; then right-click a Months plaque and choose a binding and colour for its run.
Menus reopen between a binding choice and a colour choice because each choice closes them.
The pauses let the preview and the resulting books be seen before the next gesture.

The drag carries a real source book not already in Favourites. It asserts the visible insertion
mark before dropping, then proves the saved reference was added exactly once and the source
book and its notes stayed intact. A short hold shows the new favourite before book creation. The hand moves to empty rail
and clicks to dismiss the focus-held peek; the recorder verifies it closed.

The user revised the opening after reviewing v4: both the real CDP mouse and the drawn
cursor stay beyond the right viewport edge through the opening hold and scroll (0-6.15s).
The recorder asserts no peek appears during that introduction. At 6.15s the pointer eases
in from the edge toward the first book, arrives by 6.8s, and clicks at 7s; it stays visible
for the remaining story. Capture reports the intentional offscreen frames separately. Every control approach is eased per captured frame from the last pointer
position to the actual target rectangle; the hand pauses before the click. The drag ghost
follows a curved path. Capture reports visibility for every frame and the largest movement
between adjacent frames, so hidden controls or instant cursor jumps cannot quietly pass.

```powershell
node scripts/record-demo.mjs --act hero --fps 24 --width 1000 --height 1000 --vault-name "Vault Shelf" --out dist/demo-vault-shelf-1.0.0-hero-v5.mp4 --hero dist/hero-v5.webp --hero-width 1000
```

Both outputs are natively square: the browser viewport is 1000x1000 at DPR 1 and the WebP
preserves the aspect ratio. The animation-aware `libwebp_anim` encoder shares unchanged
regions between frames; the review page records the current bytes alongside the preceding
3,003,082-byte hero. No stretching or desktop recording is involved. `--first-frame
<path.jpg>` captures only the opening frame for visual review before spending a full take;
it also writes a one-frame MP4 to `--out`. `--keep-frames` retains the stills for inspection.
`--hero-acts` now defaults to `hero`; the earlier feature acts remain independently available.
The hero is shown first, before the full feature recordings are made. The approved 0.9.0
v3 hero and v4 age-wear take are retained while the 1.0.0 v5 take incorporates the revised
offscreen opening; v5 is reviewed
from distinct files in `dist`, so neither the README asset nor the earlier Desktop copy is
overwritten before replacement approval. Feature capture can proceed while the user reviews
the new hero; committing any media still waits for the complete review.

The existing `looks` feature act keeps its name for callers but now demonstrates the offered
six spine bindings and colour preview. Leather is the sole offered look; it no longer
advertises a removed two-look selector. Explicit `--look modern|cyber` remains a diagnostic
using the suite's `__vs.setLook` hook, and verifies the requested look was applied.

## Release 1.0.0: the complete feature set

After the square hero was approved, its MP4 and WebP were preserved unchanged. The feature
storyboard has 24 independent acts, with `close` last for the complete walkthrough. The five
additional acts cover contents order, cover-name autocomplete, manual rearrangement, edge
scroll while dragging, and Manage hide/reorder. `looks` demonstrates the six binding choices,
colour previews, and both single-book and plaque-run changes; `turn` drives the actual wheel
page-turn gesture as well as the buttons.

Each feature uses the shared `scene` driver: setup establishes its starting fixture state,
then timed steps approach the current control rectangle smoothly from the last pointer
position before activating the real control. The pointer is visible from the opening frame
through every take. Drag acts use the same visible ghost and live landing marks as the hero;
their gates inspect saved order, references, and real edge scrolling. Builder and Manage
scroll their own sheets so the final buttons remain visible in the square room.

`--exact-act` disables substring selection: `--act read --exact-act` records only `read`.
Each feature is captured at 1000x1000, 24fps, with an 8fps quality-75 animated WebP at the same
native width. `--keep-frames` retains representative images; the capture reports pointer
visibility and largest adjacent-frame movement for every act. A take's failed feature
assertion stops that take before it can become a review asset.

The 19-second `wear` act shows the old year book's existing note entries, then scrolls to
the one-note acoustics book. Its real initial counter is 1 and `lastOpened` is `never`.
Two actual open/close gestures produce 2 then 3 entries and visits, while `bookNotes` keeps
the same single note identity. The first visit raises visible wear to level 1; the final
peek shows the total. No counter is reset or seeded by the recorder. A recent book with
many notes can already be worn, so the earlier fresh-2026 assertion is intentionally gone.

The search story uses an actual month cover name, opens the broader year book, shows the
first matching contents row and cover-only reason, and repeats the query inside that book.
The two searches must agree on the matching note count. Autocomplete accepts the real cover
suggestion rather than inventing a keyword that happens to match.

Feature WebPs live in `docs/features/<act>.webp`. The complete walkthrough concatenates the
corrected 68-second hero first, followed by all 24 verified feature takes in source
storyboard order with `close` last: 389 seconds (6m29s), natively square throughout. The
review helper reads that same storyboard; its local scratch mapping resolves the dedicated
hero to `assets/demo.webp` / `README.md`, and the 24 feature acts to their feature clips/pages.
The owner explicitly kept the approved v5 hero, feature clips and full walkthrough after
the note-counter change, with no further release recording. The updated wear recipe is
for a future take; the 68-second hero choreography stays exactly as approved in v5,
including its offscreen introduction.
All media is reviewed before it is committed.

## Earlier hero: the drag (github#21, 2026-09-11)

*"re record all clips in leather, make the hero thematically interesting, start with favourite
shelf drag and drop, then ribbons, then search."* The order is a claim about what the product
is — you make the shelf yours, you mark your place, and the room answers you — so the film
opens on those three, and the rest follows them.

**That storyboard ran** `open, favourite, ribbon, parting, room, shelves, plaques, peek,
read, index, alsoin, wear, build, makebook, editbook, plusbook, looks, close` — 149 seconds,
3,576 frames at 24fps, 178 seconds of capture. The first five are the hero.

**Leather is the default.** `--look` reads `leather` when it is absent, since that is the look
a fresh library opens in (`design/0016`) and the old hero was cut before it was; `--look
modern` still asks for the other one.

**The hero is named by act, not by second.** (The defaults below describe the earlier cut.) `--hero-clip 5,12` stayed `5,12` while the acts
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


## Shooting the empty shelf (github#23, 2026-09-14)

A review that has to show a **drag** cannot do it with a still, and #23 is the first ticket to
test that rule against this recorder. The recorder passed the part everybody expected to fail: a
synthetic `DataTransfer` paints correctly here because the *page* draws the carried book, not the
browser (see "The ghost" above), so the landing lights, the mark stands in the gap and the book
settles by the product's own code.

What it could not do was shoot Favourites **empty**. `core.seedPicks` puts four picks — the
latest year, the latest month, the fullest person and the fullest tag — on the shelf in a demo
build, and no act clears them. So the state a fresh library actually opens in, the dashed *Drag a
book here* landing that takes the accent as a book crosses it, was the one Favourites state the
film had never shown, and the review that needed it had only a still.

`--empty-picks` takes them off through the page's own write (`__vs.unpick`) after the look is
applied and before the first act, and asserts every shelf `__vs.picks()` returns came up at
zero — `design/0019` makes a pick shelf a **kind**, not a single one, and a demo build only ever
seeds the first, but the flag clears all of them so a library carrying more than one never reports
cleared while a second stays populated (github#72). It is a **diagnostic**, like `--look` and
`--mirror-of`: off by default, so no act, no film and no committed asset changes, and any act can
now be shot from the empty state rather than only this one.

**It is for a take, not for the film.** The acts share one page, and several later ones assume
the picks are there — `autocomplete` looks for a `months/` pick, `rearrange` for a sequence to
reorder. Running the whole storyboard under `--empty-picks` fails in those acts rather than
filming something wrong, which is the right way round for a diagnostic; pair it with `--act`.

One act moved with it. `favourite`'s drop target was the plus at the row's end; an empty pick
rail draws a `.vs-dropzone` instead of a row. The target prefers the dropzone and falls back to
the plus, so a normal take — where no dropzone exists — is unchanged, and the act now throws
rather than dropping into nothing when neither resolves.

**The review window is the act's own timing.** `favourite` and `rearrange` share their beats:
rest at `neutral` to 1.8s, glide, lift at 3s, carry to 7s, drop, and the next step's glide at
7.8s. `--hero-clip` takes `<start>,<duration>`, not a start and an end — `--hero-clip 1.8,7.7`
is the window **1.8s → 9.5s**, rest → lift → carry → drop → rest without a frame of guessing.
It runs past the six-second review guideline on purpose: cutting at 6s ends the take with a
peek card lying across the library, because the act does not dismiss it until 9s.

**Taking a favourite off still has no act**, by choice. An act in the film owes a
`docs/features/<act>.md` page and clip, and those are the maintainer's to authorise — nothing
reaches a feature page on a worker's judgement. So the third clip #23 asked for "if it is cheap"
was reported as a gap instead of
quietly costing the film an act it never asked for.
