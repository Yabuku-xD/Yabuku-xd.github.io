import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { scenes } from "../scripts/ascii/scenes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(ROOT, name), "utf8");

const PAGES = {
  "about-me.html": "dunes",
  "projects.html": "meadow",
  "contributions.html": "confluence",
  "contact.html": "lanterns",
  "privacy.html": "mist",
  "spotify.html": "sunbeams",
};

test("each hero page plays its own scene over the scene's ground colour", () => {
  for (const [file, name] of Object.entries(PAGES)) {
    const html = read(file);
    const box = html.match(/<div class="hero-crop hero-ascii" data-ascii-scene="([a-z]+)" style="background:(#[0-9a-f]{6})"/);
    assert.ok(box, `${file} has no ascii hero`);
    assert.equal(box[1], name, `${file} plays ${box[1]}`);
    assert.equal(box[2], scenes[name](8, 4).meta.ground, `${file} hero ground differs from the scene's`);
    assert.match(html, /<script type="module" src="assets\/js\/ascii-hero\.js"><\/script>/);
    assert.doesNotMatch(html, /<picture>/, `${file} still has a photo`);
  }
  assert.equal(new Set(Object.values(PAGES)).size, Object.keys(PAGES).length, "two pages share a scene");
});

test("every scene draws full frames that depend only on t", () => {
  for (const [name, make] of Object.entries(scenes)) {
    for (const [cols, rows] of [[198, 36], [101, 45], [95, 134]]) {
      const piece = make(cols, rows);
      const color = new Uint8Array(cols * rows);
      const frame = piece.default();
      const text = frame(7.5, { color });
      const lines = text.split("\n");
      assert.equal(lines.length, rows, `${name} ${cols}x${rows} rows`);
      assert.ok(lines.every((line) => line.length === cols), `${name} ${cols}x${rows} cols`);
      assert.ok(Math.max(...color) < piece.meta.palette.length, `${name} colour out of palette`);
      assert.equal(piece.default()(7.5), text, `${name} frame at 7.5s is not repeatable`);
    }
  }
});

test("the committed bundle is built from scripts/ascii", async () => {
  const fresh = await build({
    entryPoints: [join(ROOT, "scripts/ascii/hero.js")],
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
    write: false,
    banner: {
      js: "/* Built from scripts/ascii by `npm run ascii`. Uses ascii.rest by @bas3line (https://ascii.rest), MIT licensed. */",
    },
  });
  assert.equal(read("assets/js/ascii-hero.js"), fresh.outputFiles[0].text, "run npm run ascii");
});
