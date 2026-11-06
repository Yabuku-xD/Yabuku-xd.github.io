// Shared page craft, loaded as a module on every page: titles that settle out
// of ascii glyphs, the margin ruler on long pages, and pixel loaders for
// anything waiting on Spotify. Each one checks for its own markup first.
import { copy } from "./craft/copy.js";
import { initPixelLoaders } from "./craft/pixel-loader.js";
import { initRuler } from "./craft/ruler.js";
import { initScramble } from "./craft/scramble.js";

initPixelLoaders(copy.spotify.loading);
initRuler(copy.ruler.label);
initScramble();
