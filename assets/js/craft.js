// Shared page craft, loaded as a module on every page: titles that settle out
// of ascii glyphs, the margin ruler on long pages, pixel loaders for anything
// waiting on Spotify, section rules you can pluck, the email pull cord and
// the bouncing 404. Each one checks for its own markup first.
import { copy } from "./craft/copy.js";
import { initElasticLines } from "./craft/elastic-line.js";
import { initPixelLoaders } from "./craft/pixel-loader.js";
import { initPullCords } from "./craft/pull-cord.js";
import { initRuler } from "./craft/ruler.js";
import { initScramble } from "./craft/scramble.js";
import { initScreensaver } from "./craft/screensaver.js";

initPixelLoaders(copy.spotify.loading);
initRuler(copy.ruler.label);
initScramble();
initElasticLines();
initPullCords();
initScreensaver(copy.notFound);
