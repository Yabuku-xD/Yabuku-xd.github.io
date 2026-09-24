(() => {
  const ta = document.querySelector("#spotify-top-artists");
  const tt = document.querySelector("#spotify-top-tracks");

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

  function showWhenLoaded(img) {
    const done = () => img.setAttribute("data-loaded", "");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }

  function renderArtists(artists) {
    const frag = document.createDocumentFragment();
    for (const artist of artists.slice(0, 5)) {
      const link = el(
        "a",
        "row-link flex flex-col items-center gap-1 shrink-0",
      );
      const href = httpUrl(artist.url);
      if (href) {
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      const img = el(
        "img",
        "fade-img w-9 h-9 rounded-full object-cover",
      );
      img.decoding = "async";
      img.loading = "lazy";
      img.width = 36;
      img.height = 36;
      img.alt = "";
      showWhenLoaded(img);
      const src = httpUrl(artist.image);
      if (src) img.src = src;
      const name = el(
        "span",
        "text-[10px] text-foreground text-center max-w-[48px] truncate leading-tight",
        artist.name,
      );
      name.title = artist.name;
      link.append(img, name);
      frag.append(link);
    }
    ta.replaceChildren(frag);
  }

  function renderTracks(tracks) {
    const frag = document.createDocumentFragment();
    tracks.slice(0, 5).forEach((track, i) => {
      const link = el(
        "a",
        "row-link flex items-center gap-2 py-1.5",
      );
      const href = httpUrl(track.url);
      if (href) {
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      const title = el("span", "text-sm text-foreground truncate", track.name);
      title.title = track.name;
      const artist = el(
        "span",
        "text-xs text-secondary ml-auto shrink-0 truncate max-w-[45%]",
        track.artist,
      );
      artist.title = track.artist;
      link.append(
        el(
          "span",
          "text-xs text-secondary w-4 shrink-0 text-right font-mono",
          String(i + 1),
        ),
        title,
        artist,
      );
      frag.append(
        link,
        el("div", "border-b border-border border-dashed last:hidden"),
      );
    });
    tt.replaceChildren(frag);
  }

  function fail(id, msg) {
    const node = document.querySelector(`#${id}`);
    node.replaceChildren(el("div", "text-sm text-secondary", msg));
  }

  async function loadData() {
    try {
      const [topArtists, topTracks] = await Promise.all([
        fetch("/api/spotify/top-artists?range=short_term").then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch("/api/spotify/top-tracks?range=short_term").then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);

      if (topArtists && topArtists.length) renderArtists(topArtists);
      else fail("spotify-top-artists", "No artists to show right now.");

      if (topTracks && topTracks.length) renderTracks(topTracks);
      else fail("spotify-top-tracks", "No tracks to show right now.");
    } catch {
      fail("spotify-top-artists", "Spotify didn’t answer. Try again in a bit.");
      fail("spotify-top-tracks", "");
    }
  }

  loadData();
})();
