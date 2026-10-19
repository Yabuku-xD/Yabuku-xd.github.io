// Renders the social preview cards in assets/og-*.png from scripts/og/cards.js.
// Uses the locally installed Chrome in headless mode, so there is nothing to
// install. Run with `npm run og`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { scenes } from "../ascii/scenes.js";
import { cards } from "./cards.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const WIDTH = 1200;
const HEIGHT = 630;

const chrome =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find(existsSync);

if (!chrome) {
  throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.");
}

const asset = (path) => pathToFileURL(resolve(here, path)).href;

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// A card's picture is its page's ascii scene, frozen at `still` seconds, or a
// photo (the home card's portrait).
const asciiScript = (
  await build({ entryPoints: [resolve(root, "scripts/ascii/hero.js")], bundle: true, format: "esm", minify: true, write: false })
).outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const photo = (card) =>
  card.scene
    ? `<div class="photo" style="background:${scenes[card.scene](8, 4).meta.ground}" data-ascii-scene="${card.scene}" data-ascii-still="${card.still}" data-ascii-cell="4"></div>`
    : `<div class="photo"><img src="${asset(card.image)}" alt="" style="object-position:${card.imagePosition}" /></div>`;

function chip(text, card, index) {
  const dot = card.liveChip && index === 0 ? '<span class="dot"></span>' : "";
  const cls = card.keepCaseChips ? "chip keep-case" : "chip";
  return `<span class="${cls}">${dot}${escape(text)}</span>`;
}

function page(card) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: GeistMono;
    src: url(${asset("../../fonts/66f30814ff6d7cdf.p.woff2")}) format("woff2");
    font-weight: 100 900;
  }
  :root {
    --color-bg: #e2e3d8;
    --color-text: oklch(0.1496 0 0);
    --color-text-muted: oklch(0.5348 0 0 / 0.85);
    --color-rule: #c1c2bc;
    --color-image-outline: rgb(0 0 0 / 0.08);
    --shadow-chip: 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px rgb(0 0 0 / 0.04);
    --shadow-image: 0 0 0 1px rgb(0 0 0 / 0.04), 0 2px 4px rgb(0 0 0 / 0.04), 0 12px 32px -8px rgb(0 0 0 / 0.18);
    --pad: 64px;
    --radius-image: 20px;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    background: var(--color-bg);
    color: var(--color-text);
    font-family: GeistMono, ui-monospace, monospace;
    text-transform: lowercase;
    -webkit-font-smoothing: antialiased;
  }
  .keep-case { text-transform: none; }
  .card {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 56px;
    padding: 48px 48px 48px var(--pad);
  }
  .copy { display: flex; flex-direction: column; min-width: 0; padding-top: 8px; }
  .top { display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 500; }
  .top img { width: 32px; height: 32px; }
  .top .url { margin-left: auto; font-weight: 400; color: var(--color-text-muted); font-size: 20px; }
  .main { margin-top: auto; margin-bottom: auto; padding-block: 24px; }
  .eyebrow { font-size: 22px; color: var(--color-text-muted); margin-bottom: 20px; }
  h1 {
    font-size: ${card.title.length > 24 ? 50 : 60}px;
    line-height: 1.12;
    font-weight: 500;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }
  p {
    margin-top: 22px;
    font-size: 25px;
    line-height: 1.45;
    color: var(--color-text-muted);
    text-wrap: pretty;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chips.compact { flex-wrap: nowrap; gap: 8px; }
  .chips.compact .chip { padding: 0 10px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    background: #fff;
    box-shadow: var(--shadow-chip);
    font-size: 21px;
    white-space: nowrap;
  }
  .dot { width: 10px; height: 10px; border-radius: 999px; background: #16a34a; }
  .photo {
    border-radius: var(--radius-image);
    overflow: hidden;
    box-shadow: var(--shadow-image);
    position: relative;
  }
  .photo { display: flex; align-items: center; }
  .photo canvas { flex: none; width: 100%; }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    outline: 1px solid var(--color-image-outline);
    outline-offset: -1px;
    pointer-events: none;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="copy">
      <div class="top">
        <img src="${asset("../../favicon.ico")}" alt="" />
        <span>s.k</span>
        <span class="url">shyamalankannan.com${escape(card.path)}</span>
      </div>
      <div class="main">
        <div class="eyebrow">${escape(card.eyebrow)}</div>
        <h1>${escape(card.title)}</h1>
        <p>${escape(card.body)}</p>
      </div>
      <div class="${card.compactChips ? "chips compact" : "chips"}">${card.chips.map((c, i) => chip(c, card, i)).join("")}</div>
    </div>
    ${photo(card)}
  </div>
  <script type="module">${asciiScript}</script>
</body>
</html>`;
}

const work = mkdtempSync(join(tmpdir(), "og-"));
try {
  for (const card of cards) {
    const html = join(work, `${card.slug}.html`);
    const png = join(work, `${card.slug}.png`);
    const out = join(root, "assets", `og-${card.slug}.jpg`);
    writeFileSync(html, page(card));
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--allow-file-access-from-files",
        "--virtual-time-budget=8000",
        `--window-size=${WIDTH},${HEIGHT}`,
        `--screenshot=${png}`,
        pathToFileURL(html).href,
      ],
      { stdio: "ignore" },
    );
    // WhatsApp skips preview images over roughly 300 KB. PNG output of these
    // photos lands near 350 KB, JPEG at quality 85 near 120 KB.
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", png, "--out", out], {
      stdio: "ignore",
    });
    const kb = Math.round(statSync(out).size / 1024);
    if (kb > 300) throw new Error(`og-${card.slug}.jpg is ${kb} KB, over the 300 KB preview budget`);
    process.stdout.write(`wrote assets/og-${card.slug}.jpg (${kb} KB)\n`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
