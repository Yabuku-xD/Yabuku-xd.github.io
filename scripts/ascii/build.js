// Bundles the ascii hero scenes into assets/js/ascii-hero.js, the one file the
// pages load. Run with `npm run ascii` after changing anything in scripts/ascii.
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

await build({
  entryPoints: [resolve(here, "hero.js")],
  outfile: resolve(root, "assets/js/ascii-hero.js"),
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: true,
  banner: {
    js: "/* Built from scripts/ascii by `npm run ascii`. Uses ascii.rest by @bas3line (https://ascii.rest), MIT licensed. */",
  },
  logLevel: "info",
});
