// Pull the now-playing card down to fetch the latest song. Rebuilt from a
// visual study of Bencho's "Pull to refresh" (a panel pulled down against
// resistance that springs back); its exact timings were not measurable from
// the public preview. The grip above the card is a button, so a click,
// Enter, Space or a tap refreshes too. On touch screens only the grip pulls,
// so scrolling the page over the card still scrolls.

const THRESHOLD = 56; // px of pull that refreshes on release
const MAX_PULL = 88;
const HOLD = 40; // px the card stays down while the song loads
const SLOP = 4;

export function damp(distance, max) {
  return max * (1 - Math.exp(-distance / max));
}

/** Visible pull for a finger/pointer travel of `dy` px. */
export function pullOffset(dy) {
  return dy <= 0 ? 0 : damp(dy, MAX_PULL);
}

export function initPullRefresh(box, { label, pulling, release, loading, onRefresh }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  box.classList.add("pull-box");
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "pull-grip";
  grip.setAttribute("aria-label", label);
  const hint = document.createElement("span");
  hint.className = "pull-hint";
  hint.setAttribute("aria-hidden", "true");
  hint.textContent = pulling;
  box.prepend(hint, grip);

  let start = null;
  let offset = 0;
  let busy = false;
  let moved = false;

  const place = (y, animate) => {
    offset = y;
    box.classList.toggle("is-settling", animate);
    box.style.setProperty("--pull", `${y}px`);
    box.style.setProperty("--pull-progress", String(Math.min(1, y / THRESHOLD)));
  };
  const refresh = async () => {
    if (busy) return;
    busy = true;
    box.classList.add("is-loading");
    hint.textContent = loading;
    if (!reduce) place(HOLD, true);
    try {
      await onRefresh();
    } finally {
      busy = false;
      box.classList.remove("is-loading");
      hint.textContent = pulling;
      place(0, true);
    }
  };

  const down = (event) => {
    if (busy || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Touch pulls from the grip only, so the card does not trap page scroll.
    if (event.pointerType === "touch" && event.currentTarget !== grip) return;
    start = { y: event.clientY, id: event.pointerId, target: event.currentTarget };
    moved = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (!start || start.id !== event.pointerId || reduce) return;
    const dy = event.clientY - start.y;
    if (!moved && Math.abs(dy) < SLOP) return;
    moved = true;
    place(pullOffset(dy), false);
    hint.textContent = offset >= THRESHOLD ? release : pulling;
  };
  const up = (event) => {
    if (!start || start.id !== event.pointerId) return;
    start = null;
    if (moved && offset >= THRESHOLD) refresh();
    else place(0, true);
  };
  for (const el of [grip, box]) {
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }
  // A drag is not a click: keep the card's link from opening after a pull.
  box.addEventListener(
    "click",
    (event) => {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );
  grip.addEventListener("click", () => {
    if (!moved) refresh();
  });
}
