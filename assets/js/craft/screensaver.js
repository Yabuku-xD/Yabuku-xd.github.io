// The 404 drifts round its box and bounces off the edges, like an old DVD
// screensaver. Ported from Fancy Components' Screensaver (MIT,
// danielpetho/fancy) without React or motion: 3px per 60fps frame at 45
// degrees, reflecting at each edge. The button that holds it pauses it.

const SPEED = 180; // px per second (the original's 3px per frame at 60fps)

/** Advance one axis: position p with direction d inside [0, max]; reflects at the ends. */
export function bounce(p, d, step, max) {
  let next = p + d * step;
  let dir = d;
  if (next <= 0) {
    next = -next;
    dir = Math.abs(d);
  } else if (next >= max) {
    next = Math.max(0, 2 * max - next);
    dir = -Math.abs(d);
  }
  return [Math.min(Math.max(next, 0), Math.max(max, 0)), dir];
}

export function initScreensaver(labels, root = document) {
  const box = root.querySelector("[data-screensaver]");
  const mover = box?.querySelector("[data-screensaver-item]");
  const toggle = box?.querySelector("[data-screensaver-toggle]");
  if (!box || !mover || !toggle) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    box.classList.add("is-still");
    toggle.hidden = true;
    return;
  }

  let x = 0;
  let y = 0;
  let dx = Math.SQRT1_2;
  let dy = Math.SQRT1_2;
  let paused = false;
  let visible = true;
  let frame = 0;
  let last = 0;

  const tick = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const maxX = box.clientWidth - mover.offsetWidth;
    const maxY = box.clientHeight - mover.offsetHeight;
    [x, dx] = bounce(x, dx, SPEED * dt, maxX);
    [y, dy] = bounce(y, dy, SPEED * dt, maxY);
    mover.style.translate = `${x}px ${y}px`;
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    const run = !paused && visible && !document.hidden;
    if (run && !frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    } else if (!run && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.textContent = paused ? labels.play : labels.pause;
    sync();
  });
  new IntersectionObserver((entries) => {
    visible = entries.at(-1).isIntersecting;
    sync();
  }).observe(box);
  document.addEventListener("visibilitychange", sync);
  toggle.textContent = labels.pause;
  toggle.hidden = false;
  sync();
}
