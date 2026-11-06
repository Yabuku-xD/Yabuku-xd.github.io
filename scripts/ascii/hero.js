// Plays the page's ascii scene in its hero box. The box names the scene in
// data-ascii-scene; data-ascii-still="<seconds>" draws one frozen frame instead,
// as the social cards do. ascii.rest's mount() pauses the scene off screen and
// in hidden tabs, and shows a still frame to readers who prefer reduced motion.
import { mount } from "ascii.rest";
import { scenes } from "./scenes.js";
import { applyWake, stir } from "./wake.js";

// The size of one square character cell in CSS pixels.
export const CELL = 3.4;

// Wraps a scene so each frame passes through the wake. The heat field lives
// on `state`, which the box's pointer listeners write to.
const waking = (piece, state) => ({
  meta: piece.meta,
  default(options) {
    const frame = piece.default(options);
    let last = 0;
    return (t, env) => {
      const now = performance.now();
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      return applyWake(frame(t, env), state.heat, state.cols, dt);
    };
  },
});

const frozen = (piece, at) => ({
  meta: { ...piece.meta, fps: 0 },
  default(options) {
    const frame = piece.default(options);
    return (t, env) => frame(at, env);
  },
});

function play(box) {
  const make = scenes[box.dataset.asciiScene];
  if (!make) return;
  const canvas = document.createElement("canvas");
  box.append(canvas);
  let stop = () => {};
  let size = "";
  const still = box.dataset.asciiStill;
  const wake = { heat: new Float32Array(0), cols: 0, rows: 0 };
  const fit = () => {
    const width = box.clientWidth;
    if (!width) return;
    const cols = Math.max(16, Math.round(width / (Number(box.dataset.asciiCell) || CELL)));
    const rows = Math.max(6, Math.ceil(box.clientHeight / (width / cols)));
    if (`${cols}x${rows}` === size) return;
    size = `${cols}x${rows}`;
    stop();
    const piece = make(cols, rows);
    Object.assign(wake, { heat: new Float32Array(cols * rows), cols, rows });
    stop = still === undefined ? mount(canvas, waking(piece, wake)) : mount(canvas, frozen(piece, Number(still)));
  };
  fit();
  new ResizeObserver(fit).observe(box);

  // A still frame or a reader who prefers less motion gets no wake.
  if (still !== undefined || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const onPointer = (event) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !wake.cols) return;
    const cx = ((event.clientX - r.left) / r.width) * wake.cols;
    const cy = ((event.clientY - r.top) / r.height) * wake.rows;
    stir(wake.heat, wake.cols, wake.rows, cx, cy);
  };
  box.addEventListener("pointermove", onPointer, { passive: true });
  box.addEventListener("pointerdown", onPointer, { passive: true });
}

for (const box of document.querySelectorAll("[data-ascii-scene]")) play(box);
