const SITE = "https://shyamalankannan.com";
const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const PRODUCES = ["text/html", "text/markdown"];
const PAGE_ALIASES = {
  "/about": "/about-me.html",
  "/contact": "/contact.html",
  "/privacy": "/privacy.html",
  "/projects": "/projects.html",
  "/contributions": "/contributions.html",
  "/spotify": "/spotify.html",
};
// Each page answers at one URL, the one its rel=canonical names. The other
// spellings redirect so search engines don't index duplicates.
const CANONICAL_REDIRECTS = {
  "/index": "/",
  "/index.html": "/",
  "/about-me": "/about",
  "/about-me.html": "/about",
  "/about-me.md": "/about.md",
  "/contact.html": "/contact",
  "/privacy.html": "/privacy",
  "/projects.html": "/projects",
  "/contributions.html": "/contributions",
  "/spotify.html": "/spotify",
  "/Shyamalan_Kannan_Resume_SDE.pdf": "/resume.pdf",
};
// The 404 page is the body of every miss, never a page of its own.
const ERROR_PAGES = new Set(["/404", "/404.html"]);
const STATIC_EXT =
  /\.(?:css|js|mjs|map|png|jpe?g|webp|gif|svg|avif|ico|woff2?|ttf|otf|eot|json|pdf|mp4|webm|mp3|wav|ogg|zip)$/i;

const KV_REFRESH = "refresh_token";
const KV_ACCESS = "access_token";
const KV_OWNER = "owner_id";
const CONNECT_PATH = "/spotify/connect";
const CALLBACK_PATH = "/callback";
const SPOTIFY_SCOPES = "user-read-currently-playing user-read-recently-played user-top-read";
const STATE_COOKIE = "spotify_state";
const SPOTIFY_RANGES = new Set(["short_term", "medium_term", "long_term"]);

// Sent with every response. The one inline script on each page adds the "js"
// class before first paint; its hash is the only inline code the policy runs.
// Album art and artist photos come from Spotify's image hosts over https.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'sha256-WZRJfWvsnNCPcxzZwvyhovnZGqhZaC+8gPGPRbx6wTk='",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");
const SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function toUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    return withSecurityHeaders(await route(request, env));
  },
};

/** A copy of `response` with the security headers it does not already set. */
function withSecurityHeaders(response) {
  const res = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(name)) res.headers.set(name, value);
  }
  return res;
}

async function route(request, env) {
  const url = toUrl(request.url);
  if (!url) return new Response("Bad Request", { status: 400 });

  if (url.pathname === CONNECT_PATH) return handleConnect(env);
  if (url.pathname === CALLBACK_PATH) return handleCallback(request, env, url);

  if (url.pathname.startsWith("/api/spotify")) {
    let res;
    try {
      res = await handleSpotify(request, env);
    } catch (error) {
      // Say why instead of crashing (Cloudflare error 1101), so a broken
      // token or a Spotify outage shows up in one request.
      res = Response.json({ error: String(error?.message || error) }, { status: 502 });
    }
    // Pages read this JSON; it is not a page of its own for search results.
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
    return Response.redirect(url.toString(), 308);
  }

  const canonical = CANONICAL_REDIRECTS[url.pathname];
  if (canonical) {
    url.pathname = canonical;
    return Response.redirect(url.toString(), 301);
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
    const mdPath = pathname.endsWith(".md")
      ? pathname
      : markdownPath(url.pathname);
    const mdRes = await env.ASSETS.fetch(assetRequest(request, mdPath));
    if (mdRes.status === 200) {
      return markdownResponse(mdRes, mdPath);
    }
    if (pathname.endsWith(".md") || !preferredType(accept, ["text/html"])) {
      return notFound(pathname, "markdown");
    }
  }

  const htmlPath = pathname === "/" ? "/index.html" : pathname;
  const htmlRes = ERROR_PAGES.has(pathname)
    ? null
    : await env.ASSETS.fetch(assetRequest(request, htmlPath));
  if (!htmlRes || htmlRes.status === 404) {
    if (chosen === "text/markdown") {
      return notFound(url.pathname, "markdown");
    }
    const fallback = await env.ASSETS.fetch(
      assetRequest(request, "/404.html"),
    );
    if (fallback.status === 200) {
      const res = new Response(fallback.body, {
        status: 404,
        headers: fallback.headers,
      });
      applyNegotiationHeaders(res.headers);
      res.headers.set("Content-Type", "text/html; charset=utf-8");
      res.headers.set("X-Robots-Tag", "noindex");
      addLinkHeaders(res.headers, markdownPath(url.pathname));
      return res;
    }
    return notFound(url.pathname, "html");
  }

  const res = new Response(htmlRes.body, htmlRes);
  applyNegotiationHeaders(res.headers);
  if ((res.headers.get("content-type") || "").includes("text/html")) {
    res.headers.set("Content-Type", "text/html; charset=utf-8");
    addLinkHeaders(res.headers, markdownPath(url.pathname));
  }
  return res;
}

function canonicalPath(pathname) {
  const clean = pathname.replace(/\/$/, "") || "/";
  if (clean === "/index.html") return "/";
  return PAGE_ALIASES[clean] || clean;
}

/** The Markdown twin of a page, named after its public URL (/about -> /about.md). */
function markdownPath(pathname) {
  const clean = pathname.replace(/\/$/, "") || "/";
  if (clean === "/") return "/index.md";
  if (clean.endsWith(".html")) return `${clean.slice(0, -5)}.md`;
  if (clean.endsWith(".md")) return clean;
  return `${clean}.md`;
}

function assetRequest(request, pathname) {
  const url = toUrl(request.url);
  if (!url) {
    return new Request(request, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
    });
  }
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
      const parts = raw
        .trim()
        .split(";")
        .map((s) => s.trim());
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
      let specificity = 2;
      if (type === "*/*") specificity = 0;
      else if (type.endsWith("/*")) specificity = 1;
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

\`${pathname}\` isn't a page on shyamalankannan.com. Retrying returns this same 404.

## Where to look next

- [Home](${SITE}/): Who Shyamalan Kannan is, current work, and contact
- [Sitemap](${SITE}/sitemap.xml): Every public URL on this site
- [llms.txt](${SITE}/llms.txt): Agent index with a Markdown twin behind every entry
- [About](${SITE}/about): Background and previous roles
- [Contact](${SITE}/contact): Email and how to write
- [Projects](${SITE}/projects): unimem, searchx, omfx, bread, ozark, and ghosted

Every public page also answers with Markdown: append \`.md\` to its path, or send \`Accept: text/markdown\`.
`;
}

function notFoundHtml(pathname) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Page not found · Shyamalan Kannan</title>
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
      <p><code>${escapeHtml(pathname)}</code> isn't a page on shyamalankannan.com.</p>
      <h2>Try one of these</h2>
      <ul>
        <li><a href="/">Home page</a></li>
        <li><a href="/sitemap.xml">Every page (sitemap)</a></li>
        <li><a href="/llms.txt">llms.txt</a></li>
        <li><a href="/about">About me</a></li>
        <li><a href="/contact">Contact</a></li>
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
  const url = toUrl(request.url);
  if (!url) return new Response("Bad Request", { status: 400 });
  const headers = { "Content-Type": "application/json" };
  const range = url.searchParams.get("range") || "short_term";
  if (!SPOTIFY_RANGES.has(range)) {
    return Response.json(
      { error: `range must be one of: ${[...SPOTIFY_RANGES].join(", ")}` },
      { status: 400 },
    );
  }
  const token = await getAccessToken(env);

  if (url.pathname === "/api/spotify/now-playing") {
    const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) {
      const recent = await fetch(
        `${SPOTIFY_API}/me/player/recently-played?limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await spotifyJson(recent, "recently played");
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
    const song = await spotifyJson(res, "currently playing");
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
    const res = await fetch(
      `${SPOTIFY_API}/me/top/tracks?limit=10&time_range=${range}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await spotifyJson(res, "top tracks");
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
    const res = await fetch(
      `${SPOTIFY_API}/me/top/artists?limit=9&time_range=${range}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await spotifyJson(res, "top artists");
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
      `${SPOTIFY_API}/me/player/recently-played?limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await spotifyJson(res, "recently played");
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
  // The KV store (binding SPOTIFY_KV) holds the refresh token that
  // /spotify/connect saved, and a cached access token.
  const kv = env.SPOTIFY_KV;
  const cached = await kv?.get(KV_ACCESS);
  if (cached) return cached;
  const refreshToken = await kv?.get(KV_REFRESH);
  if (!refreshToken) throw new Error(`Spotify is not connected. Open ${CONNECT_PATH} to sign in.`);
  const data = await spotifyToken(env, { grant_type: "refresh_token", refresh_token: refreshToken });
  await saveTokens(kv, data);
  return data.access_token;
}

async function spotifyToken(env, params) {
  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const reason = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Spotify sign-in failed: ${reason}`);
  }
  return data;
}

/**
 * Keep the access token for most of its hour, and the refresh token Spotify
 * sent, if it sent one. Spotify does not always return a refresh token, and a
 * new one does not extend the 6-month sign-in; reconnecting does.
 */
async function saveTokens(kv, data) {
  if (!kv) return;
  const ttl = Math.max(60, (Number(data.expires_in) || 3600) - 300);
  await kv.put(KV_ACCESS, data.access_token, { expirationTtl: ttl });
  if (data.refresh_token) await kv.put(KV_REFRESH, data.refresh_token);
}

function connectPage(title, body, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · Shyamalan Kannan</title><link rel="stylesheet" href="/assets/css/pages.css"><link rel="stylesheet" href="/assets/css/site.css"></head><body class="antialiased"><main class="page-main" style="margin:4rem auto;padding:0 1rem;max-width:32rem;text-align:start"><h1 class="text-foreground font-medium text-lg">${escapeHtml(title)}</h1><p class="text-secondary" style="margin-top:1rem">${escapeHtml(body)}</p><p style="margin-top:1rem"><a class="ulink" href="/spotify"><span class="ulink-text">Back to the listening page</span></a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function handleConnect(env) {
  if (!env.SPOTIFY_KV) {
    return connectPage("Spotify is not set up here", "The worker has no SPOTIFY_KV store, so it cannot save a new sign-in.", 503);
  }
  const state = crypto.randomUUID();
  const authorize = new URL("https://accounts.spotify.com/authorize");
  authorize.search = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${SITE}${CALLBACK_PATH}`,
    scope: SPOTIFY_SCOPES,
    state,
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=${CALLBACK_PATH}; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

/**
 * Finish a reconnect. Only the site owner's Spotify account may connect: the
 * first account to connect is recorded as the owner, and later sign-ins from
 * any other account are refused.
 */
async function handleCallback(request, env, url) {
  const kv = env.SPOTIFY_KV;
  if (!kv) {
    return connectPage("Spotify is not set up here", "The worker has no SPOTIFY_KV store, so it cannot save a new sign-in.", 503);
  }
  const cookie = request.headers.get("Cookie") || "";
  const expected = cookie.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`))?.[1];
  const state = url.searchParams.get("state");
  if (!expected || state !== expected) {
    return connectPage("Spotify did not connect", "This sign-in link expired or did not start here. Open /spotify/connect and try again.", 400);
  }
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code) {
    return connectPage("Spotify did not connect", `Spotify answered: ${error || "no code"}. Open /spotify/connect and try again.`, 400);
  }
  try {
    const data = await spotifyToken(env, {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${SITE}${CALLBACK_PATH}`,
    });
    const me = await spotifyJson(
      await fetch(`${SPOTIFY_API}/me`, { headers: { Authorization: `Bearer ${data.access_token}` } }),
      "profile",
    );
    const owner = await kv.get(KV_OWNER);
    if (owner && owner !== me.id) {
      return connectPage("Spotify did not connect", "Only the site owner's Spotify account can connect here.", 403);
    }
    if (!owner) await kv.put(KV_OWNER, me.id);
    await saveTokens(kv, data);
    return connectPage("Spotify is connected", "The music on this site works again. The sign-in lasts 6 months; then open /spotify/connect again.");
  } catch (err) {
    return connectPage("Spotify did not connect", String(err?.message || err), 502);
  }
}

async function spotifyJson(res, what) {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const reason = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Spotify ${what} failed: ${reason}`);
  }
  return data;
}
