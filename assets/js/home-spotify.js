import { copy } from "./craft/copy.js";
import { cover, httpUrl } from "./craft/cover.js";

const TOP_LIMIT = 5;
const artistsBox = document.querySelector("#spotify-top-artists");
const tracksBox = document.querySelector("#spotify-top-tracks");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function linkTo(url, className) {
  const link = el("a", className);
  const href = httpUrl(url);
  if (href) {
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  return link;
}

function renderArtists(artists) {
  const frag = document.createDocumentFragment();
  for (const artist of artists.slice(0, TOP_LIMIT)) {
    const link = linkTo(artist.url, "row-link flex flex-col items-center gap-1 shrink-0");
    const name = el("span", "text-[10px] text-foreground text-center leading-tight", artist.name);
    name.title = artist.name;
    name.dir = "auto";
    link.append(cover(artist.image, "w-9 h-9 rounded-full", 36), name);
    frag.append(link);
  }
  artistsBox.replaceChildren(frag);
}

function renderTracks(tracks) {
  const frag = document.createDocumentFragment();
  tracks.slice(0, TOP_LIMIT).forEach((track, i) => {
    const link = linkTo(track.url, "row-link flex items-center gap-2 py-1.5");
    const title = el("span", "text-sm text-foreground truncate", track.name);
    title.title = track.name;
    title.dir = "auto";
    const artist = el("span", "text-xs text-secondary ml-auto shrink-0 truncate max-w-[45%]", track.artist);
    artist.title = track.artist;
    artist.dir = "auto";
    link.append(el("span", "text-xs text-secondary w-4 shrink-0 text-right font-mono", String(i + 1)), title, artist);
    frag.append(link, el("div", "border-b border-border border-dashed last:hidden"));
  });
  tracksBox.replaceChildren(frag);
}

function message(node, text) {
  node.replaceChildren(el("p", "text-sm text-secondary", text));
}

async function getJson(path) {
  try {
    const res = await fetch(path);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function load() {
  const [artists, tracks] = await Promise.all([
    getJson("/api/spotify/top-artists?range=short_term"),
    getJson("/api/spotify/top-tracks?range=short_term"),
  ]);
  // One failure message for the section, not two.
  if (artists == null && tracks == null) {
    message(artistsBox, copy.spotify.error);
    tracksBox.replaceChildren();
    return;
  }
  if (artists?.length) renderArtists(artists);
  else message(artistsBox, artists == null ? copy.spotify.error : copy.spotify.noArtists);
  if (tracks?.length) renderTracks(tracks);
  else message(tracksBox, tracks == null ? copy.spotify.error : copy.spotify.noTracks);
}

load();
