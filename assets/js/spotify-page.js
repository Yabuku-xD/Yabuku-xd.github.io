(() => {
  const RECENT_LIMIT = 8;
  const nowPlaying = document.querySelector("#spotify-now-playing");
  const recent = document.querySelector("#spotify-recently-played");

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function httpUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.href;
      }
    } catch {
      return "";
    }
    return "";
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

  function cover(url, className, size) {
    const img = el("img", `fade-img ${className}`);
    img.decoding = "async";
    img.loading = "lazy";
    img.width = size;
    img.height = size;
    img.alt = "";
    const done = () => img.setAttribute("data-loaded", "");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    const src = httpUrl(url);
    if (src) img.src = src;
    return img;
  }

  function truncated(tag, className, text) {
    const node = el(tag, `${className} truncate`, text);
    node.title = text;
    return node;
  }

  function renderNowPlaying(data) {
    const link = linkTo(data.songUrl, "row-link flex items-center gap-4 min-w-0");
    const meta = el("div", "min-w-0");
    meta.append(truncated("div", "text-sm font-medium text-foreground", data.title));

    const row = el("div", "flex items-center gap-2 text-xs text-secondary mt-0.5 min-w-0");
    row.append(truncated("span", "", data.artist));
    if (data.isPlaying) {
      const live = el("span", "inline-flex items-center gap-1.5 text-xs text-foreground shrink-0");
      live.append(el("span", "live-dot"), el("span", null, "Playing now"));
      row.append(live);
    } else {
      row.append(el("span", "text-xs text-secondary shrink-0", "· Last played"));
    }
    meta.append(row);

    link.append(cover(data.albumArt, "w-16 h-16 flex-shrink-0 rounded object-cover", 64), meta);
    nowPlaying.replaceChildren(link);
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
      link.append(cover(track.albumArt, "w-10 h-10 flex-shrink-0 rounded object-cover", 40), meta);
      frag.append(link);
    });
    recent.replaceChildren(frag);
  }

  function message(node, text) {
    node.replaceChildren(el("div", "text-sm text-secondary", text));
  }

  async function getJson(path) {
    const res = await fetch(path);
    return res.ok ? res.json() : null;
  }

  async function load() {
    const [now, played] = await Promise.allSettled([
      getJson("/api/spotify/now-playing"),
      getJson("/api/spotify/recently-played"),
    ]);

    if (now.status === "fulfilled" && now.value) renderNowPlaying(now.value);
    else message(nowPlaying, "Spotify didn’t answer. Try reloading in a minute.");

    if (played.status === "fulfilled" && played.value?.length) renderRecent(played.value);
    else message(recent, "Nothing to show yet. Check back after I’ve played something.");
  }

  load();
})();
