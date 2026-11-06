import { copy } from "./craft/copy.js";
import { cover, httpUrl } from "./craft/cover.js";
import { initPullRefresh } from "./craft/pull-refresh.js";

const RECENT_LIMIT = 8;
const nowPlaying = document.querySelector("#spotify-now-playing");
const recent = document.querySelector("#spotify-recently-played");

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

function truncated(tag, className, text) {
  const node = el(tag, `${className} truncate`, text);
  node.title = text;
  node.dir = "auto";
  return node;
}

function renderNowPlaying(data) {
  const link = linkTo(data.songUrl, "np-card");
  const meta = el("span", "np-meta");
  const title = el("span", "np-title", data.title);
  title.dir = "auto";
  meta.append(title, truncated("span", "np-artist", data.artist));

  const status = el("span", "np-status");
  if (data.isPlaying) status.append(el("span", "live-dot"), el("span", null, copy.spotify.playing));
  else status.append(el("span", null, copy.spotify.lastPlayed));

  link.append(cover(data.albumArt, "np-cover", 64), meta, status);
  if (link.target) link.append(el("span", "sr-only", `(${copy.spotify.opens})`));
  // Swap only the card, so the pull grip above it stays in place.
  const old = nowPlaying.querySelector(".np-card, .pixel-loader, p");
  if (old) old.replaceWith(link);
  else nowPlaying.append(link);
}

let pullReady = false;
async function loadNowPlaying() {
  const now = await getJson("/api/spotify/now-playing");
  if (now) renderNowPlaying(now);
  // A failed refresh keeps the card that is already showing.
  else if (!nowPlaying.querySelector(".np-card")) message(nowPlaying, copy.spotify.error);
  if (now && !pullReady) {
    pullReady = true;
    initPullRefresh(nowPlaying, {
      label: copy.spotify.refresh,
      pulling: copy.spotify.pull,
      release: copy.spotify.letGo,
      loading: copy.spotify.refreshing,
      onRefresh: loadNowPlaying,
    });
  }
}

function renderRecent(tracks) {
  const frag = document.createDocumentFragment();
  tracks.slice(0, RECENT_LIMIT).forEach((track, i) => {
    if (i > 0) frag.append(el("div", "border-b border-border border-dashed"));
    const link = linkTo(track.url, "row-link flex items-center gap-3 py-2.5");
    const meta = el("div", "min-w-0 flex-1");
    meta.append(
      truncated("div", "text-sm text-foreground", track.name),
      truncated("div", "text-xs text-secondary mt-0.5", track.artist),
    );
    link.append(cover(track.albumArt, "w-10 h-10 flex-shrink-0 rounded", 40), meta);
    frag.append(link);
  });
  recent.replaceChildren(frag);
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
  const [, played] = await Promise.all([loadNowPlaying(), getJson("/api/spotify/recently-played")]);

  if (played == null) message(recent, copy.spotify.error);
  else if (played.length) renderRecent(played);
  else message(recent, copy.spotify.noRecent);
}

load();
