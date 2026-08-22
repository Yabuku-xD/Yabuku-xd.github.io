const SITE = "https://shyamalankannan.com";
const PRODUCES = ["text/html", "text/markdown"];
const PAGE_ALIASES = {
  "/about": "/about-me.html",
  "/contact": "/contact.html",
  "/privacy": "/privacy.html",
};
const STATIC_EXT =
  /\.(?:css|js|mjs|map|png|jpe?g|webp|gif|svg|avif|ico|woff2?|ttf|otf|eot|json|pdf|mp4|webm|mp3|wav|ogg|zip)$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/spotify")) {
      return handleSpotify(request, env);
    }

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      const redirected = new URL(url);
      redirected.pathname = url.pathname.slice(0, -1);
      return Response.redirect(redirected.toString(), 308);
    }

    const pathname = canonicalPath(url.pathname);
    const accept = request.headers.get("accept");
    const chosen = preferredType(accept, PRODUCES);

    if (STATIC_EXT.test(pathname)) {
      return env.ASSETS.fetch(request);
    }

    if (/\.(?:xml|txt)$/i.test(pathname)) {
      const staticRes = await env.ASSETS.fetch(request);
      if (staticRes.status !== 404) return staticRes;
      return notFound(
        url.pathname,
        chosen === "text/markdown" ? "markdown" : "html",
      );
    }

    if (chosen === null && accept) {
      return notAcceptable(accept);
    }

    if (pathname.endsWith(".md") || chosen === "text/markdown") {
      const mdPath = pathname.endsWith(".md") ? pathname : markdownPath(pathname);
      const mdRes = await env.ASSETS.fetch(assetRequest(request, mdPath));
      if (mdRes.status === 200) {
        return markdownResponse(mdRes, mdPath);
      }
      if (pathname.endsWith(".md") || !preferredType(accept, ["text/html"])) {
        return notFound(pathname, "markdown");
      }
    }

    const htmlPath = pathname === "/" ? "/index.html" : pathname;
    const htmlRes = await env.ASSETS.fetch(assetRequest(request, htmlPath));
    if (htmlRes.status === 404) {
      if (chosen === "text/markdown") {
        return notFound(url.pathname, "markdown");
      }
      const fallback = await env.ASSETS.fetch(assetRequest(request, "/404.html"));
      if (fallback.status === 200) {
        const res = new Response(fallback.body, {
          status: 404,
          headers: fallback.headers,
        });
        applyNegotiationHeaders(res.headers);
        res.headers.set("Content-Type", "text/html; charset=utf-8");
        res.headers.set("X-Robots-Tag", "noindex");
        addLinkHeaders(res.headers, markdownPath(pathname));
        return res;
      }
      return notFound(url.pathname, "html");
    }

    const res = new Response(htmlRes.body, htmlRes);
    applyNegotiationHeaders(res.headers);
    if ((res.headers.get("content-type") || "").includes("text/html")) {
      res.headers.set("Content-Type", "text/html; charset=utf-8");
      addLinkHeaders(res.headers, markdownPath(pathname));
    }
    return res;
  },
};

function canonicalPath(pathname) {
  const clean = pathname.replace(/\/$/, "") || "/";
  if (clean === "/index.html") return "/";
  return PAGE_ALIASES[clean] || clean;
}

function markdownPath(pathname) {
  const clean = canonicalPath(pathname);
  if (clean === "/") return "/index.md";
  if (clean.endsWith(".html")) return `${clean.slice(0, -5)}.md`;
  if (clean.endsWith(".md")) return clean;
  return `${clean}.md`;
}

function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url.toString(), {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: request.headers,
  });
}

function parseAccept(header) {
  return header
    .split(",")
    .map((raw) => {
      const parts = raw.trim().split(";").map((s) => s.trim());
      const type = (parts[0] || "").toLowerCase();
      if (!type) return null;
      let q = 1;
      for (const param of parts.slice(1)) {
        const [name, value] = param.split("=").map((s) => s.trim());
        if (name === "q") {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
        }
      }
      const specificity = type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
      return { type, q, specificity };
    })
    .filter(Boolean);
}

function matches(entry, candidate) {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*")) {
    return candidate.startsWith(entry.type.slice(0, -1));
  }
  return entry.type === candidate;
}

function preferredType(header, produces) {
  if (!header) return produces[0] ?? null;
  const entries = parseAccept(header);
  if (entries.length === 0) return produces[0] ?? null;

  let bestType = null;
  let bestQ = -1;
  let bestPosition = Infinity;

  for (const candidate of produces) {
    let matched = null;
    let matchedPosition = Infinity;
    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx];
      if (!matches(entry, candidate)) continue;
      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity && idx < matchedPosition)
      ) {
        matched = entry;
        matchedPosition = idx;
      }
    }
    if (matched === null) continue;
    if (matched.q <= 0) continue;
    if (
      matched.q > bestQ ||
      (matched.q === bestQ && matchedPosition < bestPosition)
    ) {
      bestQ = matched.q;
      bestPosition = matchedPosition;
      bestType = candidate;
    }
  }

  return bestType;
}

function applyNegotiationHeaders(headers) {
  const existing = headers.get("vary");
  const tokens = existing
    ? existing.split(",").map((s) => s.trim().toLowerCase())
    : [];
  const values = existing ? existing.split(",").map((s) => s.trim()) : [];
  if (!tokens.includes("accept")) values.push("Accept");
  if (!tokens.includes("accept-encoding")) values.push("Accept-Encoding");
  headers.set("Vary", values.join(", "));
}

function addLinkHeaders(headers, mdPath) {
  const alternate = `<${mdPath}>; rel="alternate"; type="text/markdown"`;
  const describedby = `</llms.txt>; rel="describedby"; type="text/markdown"`;
  const existing = headers.get("link");
  const next = existing
    ? `${existing}, ${alternate}, ${describedby}`
    : `${alternate}, ${describedby}`;
  headers.set("Link", next);
}

function markdownResponse(assetRes, mdPath) {
  const res = new Response(assetRes.body, assetRes);
  res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  applyNegotiationHeaders(res.headers);
  addLinkHeaders(res.headers, mdPath);
  return res;
}

function notAcceptable(requested) {
  const res = new Response(
    `Not Acceptable\n\nAvailable: text/html, text/markdown\nYou requested: ${requested}\n`,
    {
      status: 406,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
  applyNegotiationHeaders(res.headers);
  return res;
}

function notFound(pathname, format) {
  const body = notFoundMarkdown(pathname);
  if (format === "markdown") {
    const res = new Response(body, {
      status: 404,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
    applyNegotiationHeaders(res.headers);
    res.headers.set(
      "Link",
      `</llms.txt>; rel="describedby"; type="text/markdown"`,
    );
    return res;
  }
  const res = new Response(notFoundHtml(pathname), {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
  applyNegotiationHeaders(res.headers);
  return res;
}

function notFoundMarkdown(pathname) {
  return `# 404: page not found

\`${pathname}\` does not exist on shyamalankannan.com. Nothing was moved silently: this path has no page, and retrying it will return this document again.

## Where to look next

- [Home](${SITE}/): Who Shyamalan Kannan is, current work, and contact
- [Sitemap](${SITE}/sitemap.xml): Every public URL on this site
- [llms.txt](${SITE}/llms.txt): Agent index with a Markdown twin behind every entry
- [About](${SITE}/about): Background and previous roles
- [Contact](${SITE}/contact): Email and how to write
- [Projects](${SITE}/projects.html): bread, ozark, and ghosted

Every public page also answers with Markdown: append \`.md\` to its path, or send \`Accept: text/markdown\`.
`;
}

function notFoundHtml(pathname) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>not found | shyamalan kannan</title>
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <main>
      <h1>not found</h1>
      <p><code>${escapeHtml(pathname)}</code> does not exist on shyamalankannan.com.</p>
      <h2>where to look next</h2>
      <ul>
        <li><a href="/">home</a></li>
        <li><a href="/sitemap.xml">sitemap</a></li>
        <li><a href="/llms.txt">llms.txt</a></li>
        <li><a href="/about">about</a></li>
        <li><a href="/contact">contact</a></li>
      </ul>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function handleSpotify(request, env) {
  const url = new URL(request.url);
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  const token = await getAccessToken(env);

  if (url.pathname === "/api/spotify/now-playing") {
    const res = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 204) {
      const recent = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=1",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await recent.json();
      const track = data.items[0].track;
      return Response.json(
        {
          isPlaying: false,
          title: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          albumArt: track.album.images[0].url,
          songUrl: track.external_urls.spotify,
        },
        { headers },
      );
    }
    const song = await res.json();
    return Response.json(
      {
        isPlaying: song.is_playing,
        title: song.item.name,
        artist: song.item.artists.map((a) => a.name).join(", "),
        albumArt: song.item.album.images[0].url,
        songUrl: song.item.external_urls.spotify,
      },
      { headers },
    );
  }

  if (url.pathname === "/api/spotify/top-tracks") {
    const range = url.searchParams.get("range") || "short_term";
    const res = await fetch(
      `https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${range}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    return Response.json(
      data.items.map((t) => ({
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        albumArt: t.album.images[1]?.url,
        url: t.external_urls.spotify,
        duration: t.duration_ms,
      })),
      { headers },
    );
  }

  if (url.pathname === "/api/spotify/top-artists") {
    const range = url.searchParams.get("range") || "short_term";
    const res = await fetch(
      `https://api.spotify.com/v1/me/top/artists?limit=9&time_range=${range}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    return Response.json(
      data.items.map((a) => ({
        name: a.name,
        image: a.images[1]?.url,
        genres: a.genres,
        url: a.external_urls.spotify,
      })),
      { headers },
    );
  }

  if (url.pathname === "/api/spotify/recently-played") {
    const res = await fetch(
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    return Response.json(
      data.items.map(({ track }) => ({
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        albumArt: track.album.images[2]?.url,
        url: track.external_urls.spotify,
        duration: track.duration_ms,
      })),
      { headers },
    );
  }

  return new Response("Not found", { status: 404, headers });
}

async function getAccessToken(env) {
  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  return data.access_token;
}
