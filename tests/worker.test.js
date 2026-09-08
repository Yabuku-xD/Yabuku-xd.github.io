import assert from "node:assert/strict";
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
    SPOTIFY_REFRESH_TOKEN: "refresh-token",
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

    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
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
  assert.match(body, /^# shyamalan kannan/m);
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
