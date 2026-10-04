// decisions/0021
const FRAME_CHECKS = new Set([
  "scrolling the library stays smooth in every look",
  "a wheel on the spread stays smooth in every look",
]);

/* github#77, decisions/0017 -- and node side: missed vsyncs, never a percentile */
const frameGaps = (ts) => {
  if (!Array.isArray(ts) || ts.length < 2) throw new Error("frame probe needs at least two timestamps");
  const iv = [];
  for (let i = 1; i < ts.length; i++) {
    if (!Number.isFinite(ts[i - 1]) || !Number.isFinite(ts[i]) || ts[i] <= ts[i - 1]) {
      throw new Error("frame probe timestamps must be finite and increasing");
    }
    iv.push(ts[i] - ts[i - 1]);
  }
  return iv;
};
const frameAt = (up, q) => up[Math.min(up.length - 1, Math.floor(up.length * q))];
export const framePeriod = (ts) => frameAt(frameGaps(ts).sort((a, b) => a - b), 0.5);
export const frameStats = (s, vsync) => {
  if (!Number.isFinite(vsync) || vsync <= 0) throw new Error("frame probe has no valid vsync calibration");
  const iv = frameGaps(s.ts);
  const up = iv.slice().sort((a, b) => a - b);
  const elapsed = s.ts[s.ts.length - 1] - s.ts[0];
  return { missed: Math.max(0, Math.round(elapsed / vsync) - iv.length), painted: iv.length,
    p50: frameAt(up, 0.5), p95: frameAt(up, 0.95), worst: up[up.length - 1], span: s.span };
};
/* github#77, decisions/0017 -- a period no machine could paint means calibration failed */
export const frameSteady = (vsync) => vsync > 6 && vsync < 26;

/* decisions/0021 */
export function serialBatches(checks) {
  const ordinary = checks.filter((c) => !FRAME_CHECKS.has(c.name));
  return [
    ...(ordinary.length ? [{ checks: ordinary, benchmark: false }] : []),
    ...checks.filter((c) => FRAME_CHECKS.has(c.name))
      .map((c) => ({ checks: [c], benchmark: true })),
  ];
}

/* decisions/0021 */
export async function waitForPushQuiet(page, timeoutMs = 3000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 5000) {
    throw new Error("push quiet wait needs a positive budget of at most 5000ms");
  }
  const result = await page.eval(`(async function(){
    var start = performance.now(), state;
    for (;;) {
      state = __vs.overscroll();
      var elapsed = performance.now() - start;
      if (!state.spent) return { quiet: true, elapsed: elapsed, state: state };
      if (elapsed >= ${timeoutMs}) return { quiet: false, elapsed: elapsed, state: state };
      await new Promise(function (resolve) { setTimeout(resolve, 20); });
    }
  })()`);
  /* decisions/0021 */
  if (!result || !result.quiet) {
    throw new Error(`push latch did not clear within ${timeoutMs}ms: ${JSON.stringify(result)}`);
  }
  return result;
}
