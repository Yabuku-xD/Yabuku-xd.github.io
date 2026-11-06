// A table of contents drawn as a ruler in the left margin. Each [data-toc]
// section gets a numbered long tick, with one short tick between rows. The
// tick for the section you are reading is the
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
    // One short tick between rows keeps the same rhythm on every page.
    if (i < items.length - 1) {
      const minor = span("ruler-minor");
      minor.setAttribute("aria-hidden", "true");
      minor.append(document.createElement("i"));
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

  // Pointer reach: only for a fine pointer and when motion is welcome. Every
  // mark reacts, long ticks and short ones, by its distance in pixels from
  // the pointer. REACH_PX is about one and a half rows: the mark under the
  // pointer leads, its neighbours follow at about a quarter, then nothing.
  const fine = matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)");
  const REACH_PX = 64;
  const marks = [...rows.map((row) => row.firstElementChild), ...list.querySelectorAll(".ruler-minor i")];
  let centers = [];
  let lit = new Set();
  let pointerY = null;
  let pointerFrame = 0;
  const measure = () => {
    centers = marks.map((mark) => {
      const box = mark.getBoundingClientRect();
      return box.top + box.height / 2;
    });
  };
  // Only marks inside the reach are written, plus the ones that just left
  // it, so a ruler with a thousand ticks costs a handful of writes per frame.
  const paint = () => {
    pointerFrame = 0;
    const next = new Set();
    if (pointerY != null) {
      centers.forEach((center, i) => {
        if (Math.abs(pointerY - center) < REACH_PX) next.add(i);
      });
    }
    for (const i of new Set([...lit, ...next])) {
      const reach = next.has(i) ? proximity(pointerY - centers[i], REACH_PX) : 0;
      if (reach) marks[i].style.setProperty("--p", reach);
      else marks[i].style.removeProperty("--p");
    }
    lit = next;
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
