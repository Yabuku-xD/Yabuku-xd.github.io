import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.js";

function createEnv(fetchImpl = async () => new Response("asset")) {
  return {
    ASSETS: { fetch: fetchImpl },
    SPOTIFY_CLIENT_ID: "client-id",
    SPOTIFY_CLIENT_SECRET: "client-secret",
    SPOTIFY_REFRESH_TOKEN: "refresh-token",
  };
}

test("falls through to static assets for non-api requests", async () => {
  let called = false;
  const env = createEnv(async (request) => {
    called = true;
    assert.equal(new URL(request.url).pathname, "/projects.html");
    return new Response("asset response", { status: 200 });
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
