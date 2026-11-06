// A table of contents drawn as a ruler in the left margin. Each [data-toc]
// section gets a numbered long tick; short ticks after it can count its
// contents (data-toc-ticks). The tick for the section you are reading is the
// longest, and when a pointer runs down the ruler the ticks near it reach out
// and their names lean in, falling off across the neighbours. Rebuilt from the
// public description of Bencho's "Line sidebar".

/** How strongly a tick reacts: 1 under the pointer, easing to 0 at `reach` rows away. */
export function proximity(distance, reach) {
  if (reach <= 0) return 0;
  const t = Math.min(1, Math.abs(distance) / reach);
  return Math.round((0.5 + 0.5 * Math.cos(Math.PI * t)) * 1000) / 1000;
}

/** "01", "02" … or "001" when the page counts in three digits. */
export function indexLabel(i, total, pad = 2) {
  return String(i + 1).padStart(Math.max(pad, String(total).length), "0");
}

/** Index of the last section whose top has passed `line`, or -1 above the first. */
export function activeIndex(tops, line) {
  let active = -1;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= line) active = i;
  return active;
}

/**
 * The active index after a section crosses the reading line. Entering makes
 * it active; leaving downward (scrolling back up past its top) hands over to
 * the section before it; leaving upward waits for the next one to enter.
 */
export function nextActive(current, index, entering, below) {
  if (entering) return index;
  if (below && index === current) return index - 1;
  return current;
}

/**
 * The section the ruler marks. A section picked from the ruler wins, so a
 * short last section is marked when its link is clicked even though its top
 * never reaches the reading line. At the very bottom of the page the last
 * section is marked. Otherwise the section on the reading line is.
 */
export function shownIndex(picked, atBottom, onLine, count) {
  if (picked >= 0) return picked;
  if (atBottom && count > 0) return count - 1;
  return onLine;
}

/** data-toc-ticks is a count ("3") or a selector to count inside the section ("li"). */
export function tickCount(raw, countMatches) {
  if (!raw) return 1;
  const n = /^\d+$/.test(raw) ? Number(raw) : countMatches(raw);
  return Math.min(24, Math.max(1, n));
}

function targetId(section) {
  return section.id || section.getAttribute("aria-labelledby") || section.querySelector("[id]")?.id || "";
}

function span(className, text) {
  const node = document.createElement("span");
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function build(items, label, pad) {
  const nav = document.createElement("nav");
  nav.className = "ruler";
  nav.setAttribute("aria-label", label);
  const list = document.createElement("ol");
  list.className = "ruler-list";
  items.forEach((item, i) => {
    const row = document.createElement("li");
    row.className = "ruler-item";
    const link = document.createElement("a");
    link.className = "ruler-link";
    link.href = `#${item.id}`;
    const line = span("ruler-line");
    const num = span("ruler-num", indexLabel(i, items.length, pad));
    line.setAttribute("aria-hidden", "true");
    num.setAttribute("aria-hidden", "true");
    const name = span("ruler-label", item.label);
    name.title = item.label;
    // Number and name share a baseline; the pair is centered on the tick.
    const text = span("ruler-text");
    text.append(num, name);
    link.append(line, text);
    row.append(link);
    // Counted ticks carry meaning on every row; plain spacers sit between rows.
    if (item.counted || i < items.length - 1) {
      const minor = span("ruler-minor");
      minor.setAttribute("aria-hidden", "true");
      for (let t = 0; t < item.ticks; t++) minor.append(document.createElement("i"));
      row.append(minor);
    }
    list.append(row);
  });
  nav.append(list);
  return nav;
}

export function initRuler(label, root = document) {
  const main = root.querySelector("main");
  const sections = [...(main?.querySelectorAll("[data-toc]") ?? [])];
  const items = sections
    .map((section) => ({
      section,
      id: targetId(section),
      label: section.dataset.toc,
      ticks: tickCount(section.dataset.tocTicks, (selector) => section.querySelectorAll(selector).length),
      counted: Boolean(section.dataset.tocTicks),
    }))
    .filter((item) => item.id && item.label);
  // A ruler with one mark tells the reader nothing.
  if (items.length < 2) return null;

  const nav = build(items, label, Number(main.dataset.tocPad) || 2);
  main.before(nav);
  const list = nav.querySelector(".ruler-list");
  const rows = [...list.children];
  const links = rows.map((row) => row.firstElementChild);

  // Mark the section being read: the last one whose top passed a reading line
  // at 40% of the screen. One measure on load, then an IntersectionObserver
  // watches the line, so scrolling a long page costs nothing per frame.
  let current = -1;
  const setActive = (next) => {
    if (next === current) return;
    links[current]?.removeAttribute("aria-current");
    current = next;
    const link = links[current];
    if (!link) return;
    link.setAttribute("aria-current", "location");
    // Keep the active mark visible when the ruler itself scrolls. Never
    // scrollIntoView here: it would move the page too.
    const row = rows[current];
    if (list.scrollHeight > list.clientHeight) {
      const top = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
      list.scrollTop = Math.max(0, top);
    }
  };
  // Three inputs decide the mark (see shownIndex): the section on the reading
  // line, whether the page sits at its very bottom, and a section the reader
  // picked from the ruler, which holds until they scroll by hand.
  let onLine = activeIndex(items.map((item) => item.section.getBoundingClientRect().top), innerHeight * 0.4);
  let picked = items.findIndex((item) => `#${item.id}` === location.hash);
  const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const show = () => setActive(shownIndex(picked, atBottom(), onLine, items.length));
  show();

  const index = new Map(items.map((item, i) => [item.section, i]));
  const line = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const below = entry.boundingClientRect.top > entry.rootBounds.top;
        onLine = nextActive(onLine, index.get(entry.target), entry.isIntersecting, below);
      }
      show();
    },
    { rootMargin: "-40% 0px -60% 0px" },
  );
  for (const item of items) line.observe(item.section);

  // Reaching or leaving the bottom crosses no line, so check it on scroll:
  // one comparison per frame, no layout reads.
  let scrollFrame = 0;
  addEventListener(
    "scroll",
    () => {
      scrollFrame ||= requestAnimationFrame(() => {
        scrollFrame = 0;
        show();
      });
    },
    { passive: true },
  );
  links.forEach((link, i) =>
    link.addEventListener("click", () => {
      picked = i;
      show();
    }),
  );
  const release = () => {
    if (picked < 0) return;
    picked = -1;
    show();
  };
  for (const type of ["wheel", "touchstart", "keydown"]) addEventListener(type, release, { passive: true });

  // Pointer reach: only for a fine pointer and when motion is welcome.
  const fine = matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)");
  const REACH_ROWS = 2.5;
  let centers = [];
  let rowHeight = 1;
  let pointerY = null;
  let pointerFrame = 0;
  const measure = () => {
    centers = links.map((link) => {
      const box = link.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    rowHeight = centers.length > 1 ? (centers.at(-1) - centers[0]) / (centers.length - 1) : 1;
  };
  const paint = () => {
    pointerFrame = 0;
    rows.forEach((row, i) => {
      const reach = pointerY == null ? 0 : proximity((pointerY - centers[i]) / rowHeight, REACH_ROWS);
      row.style.setProperty("--p", reach);
    });
  };
  list.addEventListener("pointerenter", (event) => {
    if (!fine.matches || event.pointerType !== "mouse") return;
    measure();
  });
  list.addEventListener("pointermove", (event) => {
    if (!fine.matches || event.pointerType !== "mouse") return;
    pointerY = event.clientY;
    pointerFrame ||= requestAnimationFrame(paint);
  });
  list.addEventListener("scroll", measure, { passive: true });
  list.addEventListener("pointerleave", () => {
    pointerY = null;
    pointerFrame ||= requestAnimationFrame(paint);
  });
  return nav;
}
