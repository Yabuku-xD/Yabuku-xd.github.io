export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle Spotify API routes
    if (url.pathname === '/api/spotify/now-playing') {
      const token = await getAccessToken(env);
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 204) return Response.json({ isPlaying: false });
      const data = await res.json();
      return Response.json({
        isPlaying: data.is_playing,
        title: data.item.name,
        artist: data.item.artists.map(a => a.name).join(', '),
        albumArt: data.item.album.images[0].url,
        songUrl: data.item.external_urls.spotify
      });
    }

    // Fall through to static assets
    return env.ASSETS.fetch(request);
  }
};

async function getAccessToken(env) {
  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN
    })
  });
  const data = await res.json();
  return data.access_token;
}