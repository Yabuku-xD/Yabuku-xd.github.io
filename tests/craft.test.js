import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { pixelCells } from "../assets/js/craft/pixel-loader.js";
import { activeIndex, indexLabel, nextActive, proximity, shownIndex } from "../assets/js/craft/ruler.js";
import { scrambleFrame, stepFor } from "../assets/js/craft/scramble.js";
import { dialAngle, tickLength } from "../assets/js/craft/detent-dial.js";
import { linePath, springStep } from "../assets/js/craft/elastic-line.js";
import { reach } from "../assets/js/craft/pull-cord.js";
import { pullOffset } from "../assets/js/craft/pull-refresh.js";
import { bounce } from "../assets/js/craft/screensaver.js";
import { applyWake, stir } from "../scripts/ascii/wake.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ascii wake heats cells near the pointer, draws heavier glyphs, then cools away", () => {
  const cols = 10;
  const rows = 3;
  const heat = new Float32Array(cols * rows);
  const frame = Array.from({ length: rows }, () => "·".repeat(cols)).join("\n");
  stir(heat, cols, rows, 5, 1.5);
  const hot = applyWake(frame, heat, cols, 0);
  assert.equal(hot.length, frame.length);
  assert.equal(hot.split("\n")[1][5], "@");
  assert.equal(hot.split("\n")[1][0], "·");
  // After a second of cooling every cell is back to the scene.
  for (let i = 0; i < 20; i++) applyWake(frame, heat, cols, 0.05);
  assert.equal(applyWake(frame, heat, cols, 0.05), frame);
});

test("elastic line springs back to straight and draws a quadratic curve", () => {
  let y = 40;
  let v = 0;
  for (let i = 0; i < 600; i++) [y, v] = springStep(y, v, 1 / 120);
  assert.ok(Math.abs(y) < 0.5, `still ${y}px off after 5s`);
  assert.equal(linePath(100, 0), "M0 24Q50.0 24.0 100 24");
  assert.equal(linePath(100, 10, 30), "M0 24Q30.0 34.0 100 24");
});

test("detent dial pulls toward each stop and flattens past the ends", () => {
  // Three stops over 270 degrees: -135, 0, 135.
  assert.equal(dialAngle(0, 2), -135);
  assert.equal(dialAngle(1, 2), 0);
  assert.equal(dialAngle(2, 2), 135);
  // Halfway between stops the knob lags behind: the detent pulls it back.
  assert.ok(dialAngle(0.4, 2) < -135 + 0.4 * 135);
  // Winding far past an end never goes more than 16 degrees beyond it.
  assert.ok(dialAngle(-10, 2) >= -135 - 16);
  assert.ok(dialAngle(12, 2) <= 135 + 16);
  // Ticks swell where the indicator points.
  const anchors = new Set([0, 12, 24]);
  assert.ok(tickLength(12, 0, anchors) > tickLength(12, -135, anchors));
});

test("pull cord stretches past its length with a soft limit", () => {
  const anchor = { x: 0, y: 0 };
  assert.equal(reach(anchor, 7, 0, 30).pull, 0);
  const pulled = reach(anchor, 7, 0, 49 + 50);
  assert.ok(pulled.pull > 22, "a firm pull passes the click point");
  assert.ok(reach(anchor, 7, 0, 49 + 1000).pull <= 34, "the stretch never passes 34px");
});

test("pull to refresh resists more the further it goes", () => {
  assert.equal(pullOffset(-20), 0);
  assert.ok(pullOffset(40) < 40);
  assert.ok(pullOffset(120) > 56, "a long pull reaches the refresh threshold");
  assert.ok(pullOffset(1000) < 88);
});

test("the 404 bounces off the box edges and stays inside", () => {
  assert.deepEqual(bounce(10, 1, 5, 100), [15, 1]);
  assert.deepEqual(bounce(98, 1, 5, 100), [97, -1]);
  assert.deepEqual(bounce(2, -1, 5, 100), [3, 1]);
  const [p] = bounce(0, 1, 500, 100);
  assert.ok(p >= 0 && p <= 100);
});

test("scramble frames keep the title's length and spaces", () => {
  const pick = () => "#";
  assert.deepEqual(scrambleFrame("About me", 0, 2, pick), ["", "##", "out me"]);
  assert.deepEqual(scrambleFrame("About me", 4, 2, pick), ["Abou", "# ", "me"]);
  assert.deepEqual(scrambleFrame("About me", 7, 2, pick), ["About m", "#", ""]);
  for (let settled = 0; settled <= 8; settled++) {
    assert.equal(scrambleFrame("About me", settled, 2, pick).join("").length, 8);
  }
  // Characters outside the BMP count as one letter, not two halves.
  assert.deepEqual(scrambleFrame("a☕b", 1, 1, pick), ["a", "#", "b"]);
});

test("scramble speed stays at 50ms for short titles and caps long ones", () => {
  assert.equal(stepFor(7), 50);
  assert.equal(stepFor(100), 16);
  assert.ok(stepFor(28) * 28 <= 700);
});

test("ruler reach is strongest under the pointer and gone past the reach", () => {
  assert.equal(proximity(0, 2.5), 1);
  assert.equal(proximity(2.5, 2.5), 0);
  assert.equal(proximity(10, 2.5), 0);
  assert.equal(proximity(-1, 2.5), proximity(1, 2.5));
  assert.ok(proximity(1, 2.5) > proximity(2, 2.5));
  assert.equal(proximity(1, 0), 0);
});

test("ruler numbers pad to the page's own style and grow with the count", () => {
  assert.equal(indexLabel(0, 6, 3), "001");
  assert.equal(indexLabel(2, 3), "03");
  assert.equal(indexLabel(99, 120), "100");
  assert.equal(indexLabel(4, 1000), "0005");
});

test("ruler marks the last section whose top passed the reading line", () => {
  assert.equal(activeIndex([], 400), -1);
  assert.equal(activeIndex([500, 900], 400), -1);
  assert.equal(activeIndex([-300, 200, 900], 400), 1);
  assert.equal(activeIndex([-900, -500, -100], 400), 2);
});

test("ruler hands the mark over as sections cross the reading line", () => {
  assert.equal(nextActive(-1, 0, true, false), 0);
  assert.equal(nextActive(0, 1, true, false), 1);
  // Scrolling up: the active section drops below the line, the one before takes over.
  assert.equal(nextActive(1, 1, false, true), 0);
  assert.equal(nextActive(0, 0, false, true), -1);
  // Scrolling down: leaving upward keeps the mark until the next one enters.
  assert.equal(nextActive(1, 1, false, false), 1);
  // A section that was not active changes nothing when it leaves.
  assert.equal(nextActive(2, 0, false, true), 2);
});

test("ruler marks a picked section, then the last one at the page bottom", () => {
  // A short last section never reaches the reading line; picking it still marks it.
  assert.equal(shownIndex(2, true, 1, 3), 2);
  assert.equal(shownIndex(0, true, 1, 3), 0);
  // At the very bottom with nothing picked, the last section is marked.
  assert.equal(shownIndex(-1, true, 1, 3), 2);
  // Otherwise the reading line decides.
  assert.equal(shownIndex(-1, false, 1, 3), 1);
  assert.equal(shownIndex(-1, false, -1, 3), -1);
});

test("pixel loader is a filled circle that ripples from the middle", () => {
  const cells = pixelCells(9);
  const middle = cells.find((c) => c.x === 4 && c.y === 4);
  assert.equal(middle.d, 0);
  assert.ok(cells.every((c) => c.d >= 0 && c.d <= 1));
  // Corners fall outside the circle, edge midpoints stay in.
  assert.ok(!cells.some((c) => c.x === 0 && c.y === 0));
  assert.ok(cells.some((c) => c.x === 0 && c.y === 4));
  assert.equal(new Set(cells.map((c) => `${c.x},${c.y}`)).size, cells.length);
});

test("every page title scrambles in and pages load the craft module once", () => {
  for (const file of ["index.html", "about-me.html", "projects.html", "contributions.html", "contact.html", "privacy.html", "spotify.html", "404.html"]) {
    const html = readFileSync(join(ROOT, file), "utf8");
    assert.match(html, /<h1[^>]*\bdata-scramble\b/, `${file} title`);
    assert.equal(html.match(/src="\/?assets\/js\/craft\.js"/g)?.length, 1, `${file} craft.js`);
  }
});

test("long pages mark at least two sections for the ruler", () => {
  for (const file of ["about-me.html", "projects.html", "contributions.html"]) {
    const html = readFileSync(join(ROOT, file), "utf8");
    assert.ok((html.match(/\bdata-toc="/g) ?? []).length >= 2, file);
  }
});
