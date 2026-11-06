import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import worker from "../worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function mime(pathname) {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (pathname.endsWith(".xml")) return "application/xml";
  if (pathname.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css";
  return "application/octet-stream";
}

function createEnv(fetchImpl) {
  return {
    ASSETS: {
      fetch:
        fetchImpl ||
        (async (request) => {
          const url = new URL(request.url);
          let pathname = url.pathname;
          if (pathname === "/") pathname = "/index.html";
          const filePath = join(ROOT, pathname.replace(/^\//, ""));
          if (!existsSync(filePath)) {
            return new Response("not found", { status: 404 });
          }
          return new Response(readFileSync(filePath), {
            status: 200,
            headers: { "Content-Type": mime(pathname) },
          });
        }),
    },
    SPOTIFY_CLIENT_ID: "client-id",
    SPOTIFY_CLIENT_SECRET: "client-secret",
    SPOTIFY_KV: fakeKv({ refresh_token: "refresh-token" }),
  };
}

async function fetchSite(path, headers = {}) {
  return worker.fetch(
    new Request(`https://shyamalankannan.com${path}`, { headers }),
    createEnv(),
  );
}

test("falls through to static assets for non-api requests", async () => {
  let called = false;
  const env = createEnv(async (request) => {
    called = true;
    assert.equal(new URL(request.url).pathname, "/projects.html");
    return new Response("asset response", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  const response = await worker.fetch(
    new Request("https://example.com/projects.html"),
    env,
  );

  assert.equal(called, true);
  assert.equal(await response.text(), "asset response");
});

function fakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => void store.set(key, value),
  };
}

async function withFetch(impl, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Spotify tokens come from KV, new ones are stored, and the access token is cached", async () => {
  const kv = fakeKv({ refresh_token: "kv-refresh" });
  const env = { ...createEnv(), SPOTIFY_KV: kv };
  const tokenBodies = [];
  await withFetch(
    async (url, init) => {
      if (String(url).includes("accounts.spotify.com")) {
        tokenBodies.push(String(init.body));
        return Response.json({ access_token: "access-1", expires_in: 3600, refresh_token: "rotated" });
      }
      return Response.json({ items: [] });
    },
    async () => {
      for (let i = 0; i < 2; i++) {
        const response = await worker.fetch(new Request("https://example.com/api/spotify/top-tracks"), env);
        assert.equal(response.status, 200);
      }
    },
  );
  // KV's token wins over the Cloudflare secret, and the second request reuses the cached access token.
  assert.equal(tokenBodies.length, 1);
  assert.match(tokenBodies[0], /refresh_token=kv-refresh/);
  assert.equal(kv.store.get("refresh_token"), "rotated");
  assert.equal(kv.store.get("access_token"), "access-1");
});

test("with no sign-in in KV the Spotify routes say how to connect", async () => {
  const env = { ...createEnv(), SPOTIFY_KV: fakeKv() };
  await withFetch(
    async () => {
      throw new Error("Spotify must not be called without a sign-in");
    },
    async () => {
      const response = await worker.fetch(new Request("https://example.com/api/spotify/now-playing"), env);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: "Spotify is not connected. Open /spotify/connect to sign in.",
      });
    },
  );
});

test("/spotify/connect sends the owner to Spotify with a one-time state cookie", async () => {
  const env = { ...createEnv(), SPOTIFY_KV: fakeKv() };
  const response = await worker.fetch(new Request("https://shyamalankannan.com/spotify/connect"), env);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin + location.pathname, "https://accounts.spotify.com/authorize");
  assert.equal(location.searchParams.get("redirect_uri"), "https://shyamalankannan.com/callback");
  const state = location.searchParams.get("state");
  assert.ok(state);
  assert.match(response.headers.get("Set-Cookie"), new RegExp(`spotify_state=${state};.*HttpOnly; Secure`));
});

test("/callback saves the owner's sign-in and refuses a mismatched state or another account", async () => {
  const kv = fakeKv();
  const env = { ...createEnv(), SPOTIFY_KV: kv };
  let profileId = "owner-id";
  const callback = (state, cookieState) =>
    worker.fetch(
      new Request(`https://shyamalankannan.com/callback?code=abc&state=${state}`, {
        headers: { Cookie: `spotify_state=${cookieState}` },
      }),
      env,
    );
  await withFetch(
    async (url) => {
      if (String(url).includes("accounts.spotify.com")) {
        return Response.json({ access_token: "access-new", expires_in: 3600, refresh_token: `refresh-for-${profileId}` });
      }
      return Response.json({ id: profileId });
    },
    async () => {
      assert.equal((await callback("forged", "real")).status, 400);
      assert.equal(kv.store.size, 0);

      assert.equal((await callback("s1", "s1")).status, 200);
      assert.equal(kv.store.get("owner_id"), "owner-id");
      assert.equal(kv.store.get("refresh_token"), "refresh-for-owner-id");

      profileId = "someone-else";
      assert.equal((await callback("s2", "s2")).status, 403);
      assert.equal(kv.store.get("refresh_token"), "refresh-for-owner-id");
    },
  );
});

test("a refused Spotify token answers 502 with the reason instead of crashing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("accounts.spotify.com")) {
      return Response.json({ error: "invalid_grant", error_description: "Refresh token revoked" }, { status: 400 });
    }
    throw new Error("the API must not be called without a token");
  };
  try {
    for (const path of ["now-playing", "top-tracks", "top-artists", "recently-played"]) {
      const response = await worker.fetch(new Request(`https://example.com/api/spotify/${path}`), createEnv());
      assert.equal(response.status, 502, path);
      assert.deepEqual(await response.json(), { error: "Spotify sign-in failed: Refresh token revoked" });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failing Spotify API call answers 502 with the reason", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("accounts.spotify.com")) return Response.json({ access_token: "access-token" });
    return Response.json({ error: { status: 403, message: "User not registered in the Developer Dashboard" } }, { status: 403 });
  };
  try {
    const response = await worker.fetch(new Request("https://example.com/api/spotify/top-artists"), createEnv());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: "Spotify top artists failed: User not registered in the Developer Dashboard",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns normalized Spotify top tracks", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    calls.push(String(url));

    if (String(url).includes("accounts.spotify.com")) {
      return Response.json({ access_token: "access-token" });
    }

    return Response.json({
      items: [
        {
          name: "Track One",
          artists: [{ name: "Artist One" }],
          album: { images: [{ url: "large" }, { url: "medium" }] },
          external_urls: { spotify: "https://open.spotify.com/track/1" },
          duration_ms: 123456,
        },
      ],
    });
  };

  try {
    const response = await worker.fetch(
      new Request(
        "https://example.com/api/spotify/top-tracks?range=short_term",
      ),
      createEnv(),
    );
    const body = await response.json();

    // Only this site reads the API, so it grants no cross-origin access.
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.deepEqual(body, [
      {
        name: "Track One",
        artist: "Artist One",
        albumArt: "medium",
        url: "https://open.spotify.com/track/1",
        duration: 123456,
      },
    ]);
    assert.equal(
      calls.some((url) => url.includes("time_range=short_term")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing paths return HTTP 404", async () => {
  const response = await fetchSite("/some-path-that-does-not-exist");
  assert.equal(response.status, 404);
});

test("missing paths return markdown recovery when Accept prefers markdown", async () => {
  const response = await fetchSite("/some-path-that-does-not-exist", {
    Accept: "text/markdown",
  });
  const body = await response.text();
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /text\/markdown/);
  assert.match(body, /^# 404: page not found/m);
  assert.match(body, /sitemap\.xml/);
  assert.match(body, /llms\.txt/);
  assert.match(body, /\/about/);
});

test("homepage HTML keeps the page and advertises markdown", async () => {
  const response = await fetchSite("/");
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(response.headers.get("vary") || "", /Accept/i);
  assert.match(response.headers.get("link") || "", /rel="alternate"/);
  assert.match(body, /<h1[\s\S]*shyamalan kannan/i);
});

test("Accept: text/markdown serves homepage markdown with Vary: Accept", async () => {
  const response = await fetchSite("/", { Accept: "text/markdown" });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8",
  );
  assert.match(response.headers.get("vary") || "", /Accept/i);
  assert.match(response.headers.get("vary") || "", /Accept-Encoding/i);
  assert.match(body, /^# shyamalan kannan/im);
  assert.doesNotMatch(body, /<html/i);
});

test("q-values prefer markdown when it is listed first", async () => {
  const response = await fetchSite("/", {
    Accept: "text/markdown, text/html;q=0.8",
  });
  assert.match(response.headers.get("content-type"), /text\/markdown/);
});

test("explicit markdown rejection still serves HTML", async () => {
  const response = await fetchSite("/", {
    Accept: "text/markdown;q=0, text/html",
  });
  assert.match(response.headers.get("content-type"), /text\/html/);
});

test("unsupported Accept returns 406", async () => {
  const response = await fetchSite("/", { Accept: "application/pdf" });
  const body = await response.text();
  assert.equal(response.status, 406);
  assert.match(response.headers.get("vary") || "", /Accept/i);
  assert.match(body, /text\/html/);
  assert.match(body, /text\/markdown/);
});

test("/about, /contact, and /privacy resolve", async () => {
  const about = await fetchSite("/about");
  const contact = await fetchSite("/contact");
  const privacy = await fetchSite("/privacy");
  assert.equal(about.status, 200);
  assert.equal(contact.status, 200);
  assert.equal(privacy.status, 200);
  assert.match(await about.text(), /about me/i);
  assert.match(await contact.text(), /how to reach me/i);
  assert.match(await privacy.text(), /privacy/i);
});

test("invalid request URLs return HTTP 400", async () => {
  const response = await worker.fetch(
    {
      url: "not-a-url",
      method: "GET",
      headers: {
        get() {
          return null;
        },
      },
    },
    createEnv(),
  );
  assert.equal(response.status, 400);
});

test("trailing slashes redirect so relative assets keep working", async () => {
  const response = await fetchSite("/about/");
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://shyamalankannan.com/about",
  );
});

test("duplicate page URLs redirect to the canonical URL", async () => {
  for (const [from, to] of [
    ["/index", "/"],
    ["/index.html", "/"],
    ["/about-me", "/about"],
    ["/about-me.html", "/about"],
    ["/about-me.md", "/about.md"],
    ["/contact.html", "/contact"],
    ["/privacy.html", "/privacy"],
    ["/projects", "/projects.html"],
    ["/contributions", "/contributions.html"],
    ["/spotify", "/spotify.html"],
  ]) {
    const response = await fetchSite(from);
    assert.equal(response.status, 301, from);
    assert.equal(
      response.headers.get("location"),
      `https://shyamalankannan.com${to}`,
    );
  }
});

test("internal links and the sitemap use canonical URLs", () => {
  for (const file of [
    "index.html",
    "about-me.html",
    "projects.html",
    "contributions.html",
    "contact.html",
    "privacy.html",
    "spotify.html",
    "404.html",
  ]) {
    const html = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(
      html,
      /href="\/?(?:index|about-me|contact|privacy)\.html"/,
      `${file} links to a redirecting URL`,
    );
  }
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /about-me\.html/);
});

test("direct .md URLs serve markdown", async () => {
  const response = await fetchSite("/about.md");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/markdown/);
  assert.match(await response.text(), /Shyamalan Kannan/);
});

test("sitemap and llms.txt are served as files", async () => {
  const sitemap = await fetchSite("/sitemap.xml");
  const llms = await fetchSite("/llms.txt");
  assert.equal(sitemap.status, 200);
  assert.equal(llms.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
  assert.match(await llms.text(), /When to use this/);
});

test("every response carries the security headers", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ access_token: "access-token", items: [] });
  try {
    for (const path of ["/", "/about", "/about.md", "/assets/css/site.css", "/index.html", "/nope", "/api/spotify/top-tracks"]) {
      const response = await fetchSite(path);
      const csp = response.headers.get("content-security-policy") || "";
      assert.match(csp, /default-src 'self'/, path);
      assert.match(csp, /frame-ancestors 'none'/, path);
      assert.match(response.headers.get("strict-transport-security") || "", /max-age=31536000/, path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
      assert.equal(response.headers.get("x-frame-options"), "DENY", path);
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", path);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the CSP allows each page's inline script and nothing else inline", async () => {
  const policy = (await fetchSite("/")).headers.get("content-security-policy");
  const allowed = new Set(policy.match(/'sha256-[^']+'/g).map((h) => h.slice(8, -1)));
  for (const file of ["index.html", "about-me.html", "projects.html", "contributions.html", "contact.html", "privacy.html", "spotify.html", "404.html"]) {
    const html = readFileSync(join(ROOT, file), "utf8");
    for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
      const hash = createHash("sha256").update(body).digest("base64");
      assert.ok(allowed.has(hash), `${file} has an inline script the CSP blocks: ${body.slice(0, 60)}`);
    }
    assert.doesNotMatch(html, /\son[a-z]+="/, `${file} has an inline event handler the CSP blocks`);
  }
});

test("Spotify ranges outside the three windows are refused before Spotify is asked", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Spotify must not be called for a bad range");
  };
  try {
    for (const range of ["forever", "short_term&limit=50"]) {
      const response = await fetchSite(`/api/spotify/top-artists?range=${encodeURIComponent(range)}`);
      assert.equal(response.status, 400, range);
      assert.match((await response.json()).error, /short_term, medium_term, long_term/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the 404 page is never served as a 200 page of its own", async () => {
  for (const path of ["/404", "/404.html"]) {
    const response = await fetchSite(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex", path);
  }
});

test("each page's Markdown twin is named after its public URL", async () => {
  for (const [path, heading] of [["/about", /about/i], ["/contact", /contact/i], ["/projects.html", /projects/i]]) {
    const response = await fetchSite(path, { Accept: "text/markdown" });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /text\/markdown/, path);
    assert.match(await response.text(), heading, path);
  }
  const about = await fetchSite("/about");
  assert.match(about.headers.get("link") || "", /<\/about\.md>; rel="alternate"/);
});
