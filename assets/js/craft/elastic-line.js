// Section rules you can pluck. Ported from Fancy Components' ElasticLine
// (MIT, danielpetho/fancy) without React or motion: the line grabs when the
// pointer comes within a few pixels of it, bends toward the pointer (2.2x,
// like the original), lets go past half the box height, and springs back
// with the original's stiffness 300 and damping 5. A frame loop runs only
// while a line is held or still moving.

const GRAB = 5; // px from the line that grabs it
const PULL = 2.2; // how far the bend overshoots the pointer
const STIFFNESS = 300;
const DAMPING = 5;
const HEIGHT = 48; // px of room above and below the 1px rule, for the bend
const REST = 0.05; // px: below this offset and speed, the line is at rest

/** One spring step toward 0 for offset y with velocity v, over dt seconds. */
export function springStep(y, v, dt, stiffness = STIFFNESS, damping = DAMPING) {
  const a = -stiffness * y - damping * v;
  const nv = v + a * dt;
  return [y + nv * dt, nv];
}

/** The quadratic path for a line of `width` bent through (cx, mid + offset). */
export function linePath(width, offset, cx = width / 2) {
  const mid = HEIGHT / 2;
  return `M0 ${mid}Q${cx.toFixed(1)} ${(mid + offset).toFixed(1)} ${width} ${mid}`;
}

function pluckable(rule) {
  const wrap = document.createElement("div");
  wrap.className = "elastic";
  wrap.setAttribute("role", "separator");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.append(path);
  wrap.append(svg);
  rule.replaceWith(wrap);

  let width = 0;
  let held = false;
  let offset = 0;
  let velocity = 0;
  let cx = 0;
  let frame = 0;
  let last = 0;
  const draw = () => path.setAttribute("d", linePath(width, offset, cx));
  const size = () => {
    width = wrap.clientWidth;
    svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
    cx = width / 2;
    draw();
  };
  const tick = (now) => {
    const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!held) {
      // Two half steps keep the very springy spring stable at 60fps.
      [offset, velocity] = springStep(offset, velocity, dt / 2);
      [offset, velocity] = springStep(offset, velocity, dt / 2);
    }
    draw();
    if (held || Math.abs(offset) > REST || Math.abs(velocity) > REST) {
      frame = requestAnimationFrame(tick);
    } else {
      offset = velocity = 0;
      cx = width / 2;
      draw();
      frame = 0;
      last = 0;
    }
  };
  const run = () => (frame ||= requestAnimationFrame(tick));

  size();
  new ResizeObserver(size).observe(wrap);

  // Called by the one window listener for every pointer move.
  return (event) => {
    const r = wrap.getBoundingClientRect();
    const dy = event.clientY - (r.top + r.height / 2);
    const inside = event.clientX >= r.left && event.clientX <= r.right;
    // A pointer that is already dragging something else never grabs a line.
    if (!held && inside && Math.abs(dy) < GRAB && !event.buttons) held = true;
    if (!held) return;
    if (!inside || Math.abs(dy) > HEIGHT / 2) {
      held = false;
      run();
      return;
    }
    cx = event.clientX - r.left;
    velocity = (dy * PULL - offset) * 60;
    offset = dy * PULL;
    run();
  };
}

export function initElasticLines(root = document) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const lines = [...root.querySelectorAll("hr.border-px")].map(pluckable);
  if (!lines.length) return;
  // The bend draws outside the rule's 1px box but never takes pointer
  // events, so it cannot cover a link near the rule; one listener checks
  // the few lines on the page instead.
  addEventListener(
    "pointermove",
    (event) => {
      for (const line of lines) line(event);
    },
    { passive: true },
  );
}
