// Plays the page's ascii scene in its hero box. The box names the scene in
// data-ascii-scene; data-ascii-still="<seconds>" draws one frozen frame instead,
// as the social cards do. ascii.rest's mount() pauses the scene off screen and
// in hidden tabs, and shows a still frame to readers who prefer reduced motion.
import { mount } from "ascii.rest";
import { scenes } from "./scenes.js";

// The size of one square character cell in CSS pixels.
export const CELL = 3.4;

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
  const fit = () => {
    const width = box.clientWidth;
    if (!width) return;
    const cols = Math.max(16, Math.round(width / (Number(box.dataset.asciiCell) || CELL)));
    const rows = Math.max(6, Math.ceil(box.clientHeight / (width / cols)));
    if (`${cols}x${rows}` === size) return;
    size = `${cols}x${rows}`;
    stop();
    const piece = make(cols, rows);
    const still = box.dataset.asciiStill;
    stop = still === undefined ? mount(canvas, piece) : mount(canvas, frozen(piece, Number(still)));
  };
  fit();
  new ResizeObserver(fit).observe(box);
}

for (const box of document.querySelectorAll("[data-ascii-scene]")) play(box);
