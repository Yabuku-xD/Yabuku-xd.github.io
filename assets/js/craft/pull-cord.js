// A cord hangs under the email address; pull its bead down to copy the
// address. Ported from KokonutUI's PullCord (MIT, kokonut-labs/kokonutui)
// without React: a chain of points with fixed-length links (Verlet), gravity,
// a little bend stiffness, a fixed 120Hz step, and a click once the cord is
// pulled past its length. The bead is the site's copy button, so clicking it,
// or Enter and Space on it, copies too.

import { damp } from "./damp.js";

const LINKS = 7;
const LINK = 7; // px
const STEP = 1 / 120;
const GRAVITY = 1400;
const DAMPING = 0.992;
const MAX_SPEED = 4;
const BEND_MIN = LINK * 1.9;
const BEND_STIFFNESS = 0.8;
const ITERATIONS = 14;
const CLICK_PULL = 22; // px past the cord's length that copies
const MAX_STRETCH = 34;
const REST_EPSILON = 0.015;
const REST_STEPS = 24;
const DRAG_SLOP = 4; // px of movement that turns a press into a pull

/** Where a held point may go, and how far down past its length it is pulled. */
export function reach(anchor, index, x, y) {
  const dx = x - anchor.x;
  const dy = y - anchor.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const length = index * LINK;
  if (dist <= length) return { x, y, pull: 0 };
  const allowed = length + damp(dist - length, MAX_STRETCH);
  return {
    x: anchor.x + (dx / dist) * allowed,
    y: anchor.y + (dy / dist) * allowed,
    pull: dy > 0 ? (allowed - length) * (dy / dist) : 0,
  };
}

function relax(c, a, b, length, bend) {
  const aFixed = a === 0 || a === c.held;
  const bFixed = b === c.held;
  if (aFixed && bFixed) return;
  const dx = c.xs[b] - c.xs[a];
  const dy = c.ys[b] - c.ys[a];
  const dist = Math.hypot(dx, dy) || 0.0001;
  if (bend && dist >= length) return;
  const diff = ((dist - length) / dist) * (bend ? BEND_STIFFNESS : 1);
  const wa = aFixed ? 0 : bFixed ? 1 : 0.5;
  c.xs[a] += dx * diff * wa;
  c.ys[a] += dy * diff * wa;
  c.xs[b] -= dx * diff * (1 - wa);
  c.ys[b] -= dy * diff * (1 - wa);
}

function cordPath(xs, ys) {
  let d = `M${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  for (let i = 1; i < xs.length - 1; i++) {
    d += ` Q${xs[i].toFixed(2)} ${ys[i].toFixed(2)} ${((xs[i] + xs[i + 1]) / 2).toFixed(2)} ${((ys[i] + ys[i + 1]) / 2).toFixed(2)}`;
  }
  const n = xs.length - 1;
  return `${d} L${xs[n].toFixed(2)} ${ys[n].toFixed(2)}`;
}

function hang(box) {
  const bead = box.querySelector(".pull-cord-bead");
  const path = box.querySelector("path");
  if (!bead || !path) return;
  const anchor = { x: box.clientWidth / 2, y: 0 };
  const n = LINKS;
  const c = {
    xs: new Float64Array(n + 1),
    ys: new Float64Array(n + 1),
    pxs: new Float64Array(n + 1),
    pys: new Float64Array(n + 1),
    held: -1,
  };
  const rest = () => {
    for (let i = 0; i <= n; i++) {
      c.xs[i] = c.pxs[i] = anchor.x;
      c.ys[i] = c.pys[i] = anchor.y + i * LINK;
    }
  };
  rest();
  const draw = () => {
    path.setAttribute("d", cordPath(c.xs, c.ys));
    bead.style.translate = `${(c.xs[n] - anchor.x).toFixed(2)}px ${(c.ys[n] - n * LINK).toFixed(2)}px`;
  };
  draw();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let target = { x: 0, y: 0 };
  let armed = true;
  let raf = 0;
  let last = 0;
  let carry = 0;
  let still = 0;
  let start = null;
  let grab = { x: 0, y: 0 };
  let dragged = false;

  const step = () => {
    let moved = 0;
    for (let i = 1; i <= n; i++) {
      if (i === c.held) continue;
      let vx = (c.xs[i] - c.pxs[i]) * DAMPING;
      let vy = (c.ys[i] - c.pys[i]) * DAMPING;
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_SPEED) {
        vx *= MAX_SPEED / speed;
        vy *= MAX_SPEED / speed;
      }
      c.pxs[i] = c.xs[i];
      c.pys[i] = c.ys[i];
      c.xs[i] += vx;
      c.ys[i] += vy + GRAVITY * STEP * STEP;
      moved = Math.max(moved, Math.abs(vx) + Math.abs(vy));
    }
    if (c.held > 0) {
      const i = c.held;
      moved = Math.max(moved, Math.abs(target.x - c.xs[i]) + Math.abs(target.y - c.ys[i]));
      c.pxs[i] = c.xs[i];
      c.pys[i] = c.ys[i];
      c.xs[i] = target.x;
      c.ys[i] = target.y;
    }
    for (let k = 0; k < ITERATIONS; k++) {
      for (let i = 0; i < n; i++) relax(c, i, i + 1, LINK, false);
      for (let i = 0; i + 2 <= n; i++) relax(c, i, i + 2, BEND_MIN, true);
    }
    return moved;
  };
  const tick = (now) => {
    raf = 0;
    const elapsed = last ? Math.min((now - last) / 1000, 0.05) : STEP;
    last = now;
    carry += elapsed;
    let moved = 0;
    while (carry >= STEP) {
      moved = Math.max(moved, step());
      carry -= STEP;
    }
    draw();
    still = moved < REST_EPSILON ? still + 1 : 0;
    if (c.held > 0 || still < REST_STEPS) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => {
    still = 0;
    raf ||= requestAnimationFrame(tick);
  };
  const local = (event) => {
    const r = box.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  bead.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    bead.setPointerCapture(event.pointerId);
    c.held = n;
    target = { x: c.xs[n], y: c.ys[n] };
    start = local(event);
    // Keep the point under the pointer where it was grabbed, so the bead never jumps.
    grab = { x: start.x - c.xs[n], y: start.y - c.ys[n] };
    dragged = false;
    box.classList.add("is-held");
    armed = true;
    wake();
  });
  bead.addEventListener("pointermove", (event) => {
    if (c.held < 0) return;
    const p = local(event);
    if (!dragged && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_SLOP) dragged = true;
    if (!dragged) return;
    const to = reach(anchor, n, p.x - grab.x, p.y - grab.y);
    target = { x: to.x, y: to.y };
    if (armed && to.pull > CLICK_PULL) {
      armed = false;
      navigator.vibrate?.(8);
      bead.dataset.pulled = "";
      bead.click();
    } else if (!armed && to.pull < CLICK_PULL * 0.4) {
      armed = true;
    }
    wake();
  });
  const release = () => {
    if (c.held < 0) return;
    c.held = -1;
    box.classList.remove("is-held");
    wake();
  };
  bead.addEventListener("pointerup", release);
  bead.addEventListener("pointercancel", release);
  bead.addEventListener("lostpointercapture", release);
  // A pull already copied; the click the browser sends on release must not
  // copy a second time. The pull's own synthetic click carries data-pulled.
  bead.addEventListener(
    "click",
    (event) => {
      if ("pulled" in bead.dataset) {
        delete bead.dataset.pulled;
        return;
      }
      if (dragged) {
        dragged = false;
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      // A plain click or a key press: give the bead a small tug.
      c.pys[n] = c.ys[n] - 5;
      wake();
    },
    { capture: true },
  );
}

export function initPullCords(root = document) {
  for (const box of root.querySelectorAll("[data-pull-cord]")) hang(box);
}
