export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers for all API responses
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    // ── Spotify Routes ──
    if (url.pathname.startsWith('/api/spotify')) {
      const token = await getAccessToken(env);

      if (url.pathname === '/api/spotify/now-playing') {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 204) {
          // Fall back to recently played
          const recent = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await recent.json();
          const track = data.items[0].track;
          return Response.json({
            isPlaying: false,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            albumArt: track.album.images[0].url,
            songUrl: track.external_urls.spotify,
          }, { headers });
        }
        const song = await res.json();
        return Response.json({
          isPlaying: song.is_playing,
          title: song.item.name,
          artist: song.item.artists.map(a => a.name).join(', '),
          albumArt: song.item.album.images[0].url,
          songUrl: song.item.external_urls.spotify,
        }, { headers });
      }

      if (url.pathname === '/api/spotify/top-tracks') {
        const range = url.searchParams.get('range') || 'short_term';
        const res = await fetch(
          `https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${range}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        return Response.json(data.items.map(t => ({
          name: t.name,
          artist: t.artists.map(a => a.name).join(', '),
          albumArt: t.album.images[1]?.url,
          url: t.external_urls.spotify,
          duration: t.duration_ms,
        })), { headers });
      }

      if (url.pathname === '/api/spotify/top-artists') {
        const range = url.searchParams.get('range') || 'short_term';
        const res = await fetch(
          `https://api.spotify.com/v1/me/top/artists?limit=9&time_range=${range}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        const genreCount = {};
        data.items.forEach(a => {
          a.genres.forEach(g => {
            genreCount[g] = (genreCount[g] || 0) + 1;
          });
        });
        const topGenre = Object.entries(genreCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'varied';
        return Response.json({
          artists: data.items.map(a => ({
            name: a.name,
            image: a.images[1]?.url,
            genres: a.genres,
            url: a.external_urls.spotify,
          })),
          topGenre,
        }, { headers });
      }

      if (url.pathname === '/api/spotify/recently-played') {
        const res = await fetch(
          'https://api.spotify.com/v1/me/player/recently-played?limit=50',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        return Response.json(data.items.map(({ track }) => ({
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          albumArt: track.album.images[2]?.url,
          url: track.external_urls.spotify,
          duration: track.duration_ms,
        })), { headers });
      }
    }

    // ── Fall through to static site ──
    return env.ASSETS.fetch(request);
  }
};

async function getAccessToken(env) {
  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  return data.access_token;
}