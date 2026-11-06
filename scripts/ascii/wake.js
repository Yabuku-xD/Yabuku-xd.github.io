// The pointer leaves a wake through the scene: cells near it heat up and draw
// heavier glyphs, then cool back to the scene. Rebuilt from a visual study of
// Bencho's "ASCII wake" (measured: a trail about five cells wide that cools
// within roughly 0.6s).
const WAKE_RAMP = ".:-=+*#@";
const WAKE_REACH = 2.6; // cells
const WAKE_COOL = 0.22; // seconds for heat to fall to 1/e
const WAKE_FLOOR = 0.06; // heat below this draws the scene unchanged

/** Heat a disc of cells around (cx, cy), keeping whichever heat is higher. */
export function stir(heat, cols, rows, cx, cy, reach = WAKE_REACH) {
  const x0 = Math.max(0, Math.floor(cx - reach));
  const x1 = Math.min(cols - 1, Math.ceil(cx + reach));
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(rows - 1, Math.ceil(cy + reach));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / reach;
      if (d < 1) heat[y * cols + x] = Math.max(heat[y * cols + x], 1 - d * d);
    }
  }
}

/** Cool every cell by `dt` seconds and draw hot cells over the frame text. */
export function applyWake(frame, heat, cols, dt) {
  const keep = Math.exp(-dt / WAKE_COOL);
  let chars = null;
  for (let i = 0; i < heat.length; i++) {
    if (heat[i] < WAKE_FLOOR) {
      heat[i] = 0;
      continue;
    }
    chars ??= [...frame];
    const at = Math.floor(i / cols) * (cols + 1) + (i % cols);
    if (at < chars.length && chars[at] !== "\n") {
      chars[at] = WAKE_RAMP[Math.min(WAKE_RAMP.length - 1, Math.floor(heat[i] * WAKE_RAMP.length))];
    }
    heat[i] *= keep;
  }
  return chars ? chars.join("") : frame;
}
