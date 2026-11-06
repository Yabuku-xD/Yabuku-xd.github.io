// A round patch of tiny pixels with a ripple running out from the middle,
// in the same pixel language as the ascii heroes. Rebuilt from the public
// description of Bencho's "Pixel loader"; the motion is one CSS animation per
// pixel with a delay set by its distance from the middle, so no JS timers run.

/** Pixels inside the circle, each with its distance from the middle (0 to 1). */
export function pixelCells(size = 9) {
  const middle = (size - 1) / 2;
  const radius = middle + 0.5;
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - middle, y - middle);
      if (distance <= radius) cells.push({ x, y, d: Math.round((distance / radius) * 100) / 100 });
    }
  }
  return cells;
}

function fill(slot, label, size) {
  const grid = document.createElement("span");
  grid.className = "pixel-loader-grid";
  grid.setAttribute("aria-hidden", "true");
  grid.style.setProperty("--pixels", size);
  for (const { x, y, d } of pixelCells(size)) {
    const pixel = document.createElement("span");
    pixel.style.gridArea = `${y + 1} / ${x + 1}`;
    pixel.style.setProperty("--d", d);
    grid.append(pixel);
  }
  const text = document.createElement("span");
  text.className = "sr-only";
  text.textContent = label;
  slot.classList.add("pixel-loader");
  slot.setAttribute("role", "status");
  slot.replaceChildren(grid, text);
}

/** Fill every [data-pixel-loader] slot and pause the ripple while it is off screen. */
export function initPixelLoaders(label, root = document) {
  const slots = [...root.querySelectorAll("[data-pixel-loader]")];
  for (const slot of slots) fill(slot, label, Number(slot.dataset.pixelLoader) || 9);
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute("data-paused", !entry.isIntersecting);
  });
  for (const slot of slots) observer.observe(slot);
}
