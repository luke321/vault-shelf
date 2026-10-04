# 0021 — Browser readiness and frame isolation

**Date** 2026-10-04 · **Status** accepted · **Related** #110, #108

## Context

The complete headed run of release candidate `17a65be` exited 1 at **163/165**. The
backward page turn landed correctly, but the next forward gesture stayed on note 1 at
scrollTop 242. Cyber library scrolling missed **121** vsyncs against the **30** limit,
including a 1,835ms gap. The pointer/clipping and fixed geometry checks from #110 passed.
An isolated rerun passed both checks, so that alone did not establish a cause or a fix.

A scratch partial replay of the original first parallel lane and the serial predecessors
reproduced the turn failure at **87/88**, even with one Chrome at a time. The trace taken
after Node's 400ms sleep still showed `spent: true`, with top and span both 242. A host-side
sleep is not evidence that the renderer serviced its 140ms timer. The scrolling trace had
no hover preview and passed at 13 missed cyber frames; no pointer cause was established.

Fresh-browser isolation alone still failed cyber at **52** missed frames. The look uses
inline filtered SVG images, whose decoding is asynchronous. Explicitly decoding those
images before sampling passed at **18**; a scratch PNG substitution passed at **3**. The
PNG substitution was investigative only: no product image or CSS was changed. The shipping
test preparation keeps the original SVGs and measures their scrolling paint cost. These
observations establish missing readiness boundaries, not a claim that all machine load or
future GPU stalls have been eliminated.

A subsequent 91-check context replay exposed another instrument defect: modern's frame
sample contained only one timestamp. The clock started before the first animation callback;
a delayed first callback could consume the entire measurement interval. The calculation
then tried to format an absent percentile instead of rejecting the unusable sample.

## Decision

- Gesture checks that read scroll arrivals or renderer timers run serially. Between two
  gestures, `waitForPushQuiet` polls the browser's actual `overscroll().spent` signal. Its
  default deadline is 3,000ms; a stuck latch throws. It never clears the latch, reopens the
  book or retries a failed gesture. The production 140ms quiet and 600ms hold remain intact.
- Each frame benchmark runs alone in its own fresh Chrome. Other serial checks keep their
  order and shared browser; the two benchmarks then run in their original relative order.
  Every selected check remains counted exactly once, with the same fixture and suite lock.
- Before a frame sample, wait for the current look's fonts and inline CSS images to decode.
  Decode failures and a 3,000ms preparation deadline fail the check. Keep decoded images
  referenced during measurement. Preparation neither rewrites CSS nor rasterises the SVGs,
  scrolls the whole room in advance, drops frame samples, or retries a red benchmark.
- Keep the **2,000px/s one-way descent**, **30** missed library frames, **14** missed reader
  frames, and the same-run expensive containment control. No tolerance is raised.
- Start measured time at the first animation callback. Allow at most 3,000ms to start,
  then the requested measurement duration plus 3,000ms to finish. Count every subsequent
  gap; never trim a stall. Reject fewer than two timestamps, nonfinite or nonincreasing
  timestamps, and invalid calibration. Invalidate one pixel before requesting the first
  frame so an idle scroller starts painting.
- Certificate epoch **4** invalidates earlier instruments. The complete headed suite now
  contains **168** checks. Two consecutive complete clean greens still certify a tree;
  partial or dirty runs cannot certify it, and each complete run remains its own ask.

## Controls

The browser regression delays the real quiet callback to 800ms. An 80ms wait must refuse
while leaving the spent latch and current note untouched; the normal wait must observe
readiness and allow the next gesture to reach note 2. A permanently spent debug signal
must also refuse. The original timer and debug function are restored in `finally`.

The asset regression requires successful normal decoding, refuses a malformed inline image,
then replaces `Image.decode` with a never-resolving promise and requires the 3,000ms deadline
to refuse. It restores the decoder and removes its control property, then decodes normally.

The sampling regression delays the first callback by 350ms, then requires a full 160ms
sample with multiple timestamps. An 800ms delay after sampling starts must exceed the
unchanged 30-frame budget. Suppressing all callbacks, or all callbacks after the first,
must trigger the corresponding watchdog. The original scheduler is restored in `finally`.

`check-smoke-isolation.mjs` verifies isolated benchmark ownership, selected-check coverage,
ordinary and benchmark order, unchanged input, empty and single-check batches, readiness
refusal, invalid budgets, invalid frame samples, counted stalls and CDP failures. It is the same console gate in the push hook and
both CI workflows. Focused results belong in the release verification record; they are not
a replacement for the complete headed certification runs.
