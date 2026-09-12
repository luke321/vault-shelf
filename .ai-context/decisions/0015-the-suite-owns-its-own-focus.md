# 0015 — The suite owns its own focus, and drives real keys

**Date** 2026-09-12 · **Status** accepted · **Issue** [#55](https://github.com/luke321/vault-shelf/issues/55)

## Context

`"a hovered swatch paints the room, and leaving puts it back"` (`github#44`, `design/0022`)
failed **three full runs in four** on `develop` at `6c99c60`, and passed **five of five** on
its own with `--only`. Always the same two flags, always the check's keyboard half:

```
FAIL  a hovered swatch paints the room, and leaving puts it back
      focused, arrowPainted -- not what a preview does
```

The pointer half of the same check passed in the same run, every time.

### What it was not

Three things were ruled out by measurement rather than argument, two of them in #55 itself and
one here:

- **Not the machine being busy.** It failed with the locks free and nothing else running.
- **Not state left behind by a check earlier in the same lane.** `"hovered swatch"` matches
  `POINTER_DRIVEN`, so it runs in the serial lane, 6th of 12, sharing one page. Its five serial
  predecessors were run in order, in one Chrome, with the check itself: **6/6 green, six
  consecutive times.** #55's own pairing experiments had used *parallel-lane* checks, which land
  in a different browser entirely, so those samples measured nothing.
- **Not the product.** The preview works; the pointer half proves it in the same run.

### What it was

The check's keyboard half was instrumented to record its own surroundings, and the second full
run went red with this:

```
hasFocus: false                          the window had lost the foreground
activeAfterSecondArrow: BUTTON.vs-swatch document.activeElement DID move
firedAfterFirstArrow:  0
firedAfterSecondArrow: 0
firedAfterFocus:       0                 the focus event never fired, not once
menuHidden: false throughout · readerOpen: false
```

**A Chrome window that does not hold the OS foreground still moves `document.activeElement`
when you call `element.focus()`, but delivers no `focus` event.** The preview hangs off
`on(btn, "focus", show)` (`src/page.js`), so it never ran. `mouseenter` is dispatched straight
at the element and needs no document focus, which is why exactly one half of one check failed.

A full run opens three Chromes — two parallel lanes, then the serial one — and Windows decides
which of them ends up in the foreground as the others are torn down. `--only` opens one window
into a quiet desktop and it keeps the foreground. That race is the whole intermittency.

## The decision

**Two changes, because the flake and the dishonesty are two different faults.**

1. **The window's focus is not the suite's business.** `runOne` now sends
   `Emulation.setFocusEmulationEnabled { enabled: true }` to every page it drives, so the page
   believes it is focused whatever the desktop is doing. This is the state a real person is
   always in — they cannot press Tab at a window that is not in front — so it is emulation of
   the truth, not a workaround. It covers every focus-driven check, not just this one:
   `smoke.mjs` calls `.focus()` in eight places and all eight were silently exposed.

2. **The keyboard half drives real keys.** It used to dispatch a synthetic
   `new KeyboardEvent("keydown", …)` at the menu and then call `element.focus()` outright.
   Neither is something a browser does, and the comment beside the second one said *"the way
   Tab reaches it"* while never pressing Tab. Both are now `Input.dispatchKeyEvent` over CDP —
   real `ArrowRight` presses and a real `Tab` — through `press()`, so the check goes through the
   same focus machinery a person's keyboard goes through.

**The assertion was not relaxed.** It gained three flags: `tabbed` (Tab landed on another of
the twelve), `tabbedOn` (and painted something different from the swatch before it), and
`windowFocused` (`document.hasFocus()`), so a harness regression names itself instead of
looking like a dead preview.

Proved by negative control: with `on(o.btn, "focus", o.show)` removed from `src/page.js`, the
rewritten check goes red on `focused, arrowPainted, tabbedOn` while `arrowLanded`, `arrowMoved`
and `tabbed` stay green — focus still moves, nothing paints, which is exactly the discrimination
the check is for.

## Rejected

| Option | Why not |
|---|---|
| **Re-run until green** | What the stamp already did once. `decisions/0010`'s amendment is the other half of this issue. |
| **Relax the assertion to `document.activeElement` alone** | It would have passed every run and proved nothing. The preview is the thing under test, not the focus ring. |
| **Have the product preview on something other than `focus`** | The product is correct: a person's window has the foreground by construction. Changing shipped code to suit a harness artefact is the wrong direction. |
| **Bring the window to the front before each check** | `Page.bringToFront` asks the OS for something it may refuse — Windows would not let a second window take the foreground during the probing for this record, in either direction. A guarantee that depends on the window manager is the thing being escaped. |
| **Keep `element.focus()` now that emulation makes it work** | It would work, and it would still be pretending. Fixing the flake without fixing the claim leaves the next reader believing Tab was tested. |

## Consequences

- Every check in the suite now runs against a page that believes it is focused, so a harness
  window losing the foreground can no longer change a measurement.
- `press(p, key)` is the one place a real key is dispatched; it carries the virtual key codes
  and refuses a key it has no code for rather than sending a keystroke the browser ignores.
- `windowFocused` is asserted, so if focus emulation is ever unavailable the suite says so in
  one named flag instead of producing an intermittent failure somewhere else.
- The check is slightly slower in wall-clock terms — the keyboard half is now several CDP round
  trips rather than one page evaluation — and measurably cheaper in human terms.
