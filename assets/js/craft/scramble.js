// Page titles settle out of the glyphs the ascii heroes are drawn with.
// Adapted from Fancy Components' ScrambleIn (MIT, danielpetho/fancy): the
// letters appear one at a time with a short tail of random glyphs ahead of
// them. Unlike the original, the rest of the title is laid out but hidden from
// the first frame, so a centered heading never shifts while it resolves.

// The hero ramp (· • ●) plus a few marks. In Geist Mono each is one letter wide.
export const GLYPHS = "·•●:+*=#";

/** Split one frame into the settled text, the scrambled tail and the hidden rest. */
export function scrambleFrame(text, settled, tail, pick) {
  const chars = [...text];
  const end = Math.min(chars.length, settled + tail);
  const scrambled = chars
    .slice(settled, end)
    .map((c) => (/\s/.test(c) ? c : pick()));
  return [chars.slice(0, settled).join(""), scrambled.join(""), chars.slice(end).join("")];
}

/** Milliseconds per letter: 50ms like the original, faster for long titles. */
export function stepFor(length, budget = 700) {
  return Math.max(16, Math.min(50, budget / Math.max(1, length)));
}

function scrambleIn(heading, { tail = 2, glyphs = GLYPHS } = {}) {
  const text = heading.textContent;
  const length = [...text].length;
  if (!text.trim()) return;

  const original = [...heading.childNodes];
  const spoken = document.createElement("span");
  spoken.className = "sr-only";
  spoken.textContent = text;
  const shown = document.createElement("span");
  shown.className = "scramble";
  shown.setAttribute("aria-hidden", "true");
  const parts = ["scramble-settled", "scramble-glyphs", "scramble-rest"].map((name) => {
    const part = document.createElement("span");
    part.className = name;
    return part;
  });
  shown.append(...parts);
  heading.replaceChildren(spoken, shown);

  const step = stepFor(length);
  const pick = () => glyphs[Math.floor(Math.random() * glyphs.length)];
  let start = 0;
  let last = 0;
  // Draw the first frame now, so the heading is never blank while it waits
  // for the next animation frame.
  scrambleFrame(text, 0, tail, pick).forEach((value, i) => {
    parts[i].textContent = value;
  });

  const frame = (now) => {
    start ||= now;
    const settled = Math.floor((now - start) / step);
    if (settled >= length) {
      heading.replaceChildren(...original);
      return;
    }
    if (settled !== last) {
      last = settled;
      scrambleFrame(text, settled, tail, pick).forEach((value, i) => {
        parts[i].textContent = value;
      });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function initScramble(root = document) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const heading of root.querySelectorAll("[data-scramble]")) scrambleIn(heading);
}
