# Listening

Public Spotify listening stats for Shyamalan Kannan, the owner of this site. Visiting this page does not connect your Spotify account.

Live data is served from:

- `GET /api/spotify/now-playing`
- `GET /api/spotify/top-tracks?range=short_term|medium_term|long_term`
- `GET /api/spotify/top-artists?range=short_term|medium_term|long_term`
- `GET /api/spotify/recently-played`

Those endpoints return JSON about the site owner's listening history. They are not a general Spotify proxy.

HTML page: [https://shyamalankannan.com/spotify.html](https://shyamalankannan.com/spotify.html)
