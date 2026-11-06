// Every interface string that JavaScript writes into the page. Page copy that
// must read without JavaScript stays in the HTML. Strings are whole sentences
// with placeholders, written in normal case; the site lowercases them in CSS.
export const copy = {
  ruler: {
    label: "On this page",
  },
  spotify: {
    loading: "Getting my music from Spotify",
    error: "Spotify is not answering right now. Reload the page in a minute.",
    playing: "Playing now",
    lastPlayed: "Last played",
    opens: "Opens Spotify in a new tab",
    noRecent: "I have not played anything yet. Check back later.",
    noArtists: "No top artists yet. Check back later.",
    noTracks: "No top songs yet. Check back later.",
    range: "Time range",
    ranges: ["4 weeks", "6 months", "1 year"],
    refresh: "Refresh the song playing now",
    pull: "Pull to refresh",
    letGo: "Let go to refresh",
    refreshing: "Getting the latest song",
  },
  notFound: {
    pause: "Pause",
    play: "Play",
  },
  email: {
    copied: "Email address copied.",
    copyFailed: (address) => `Copying did not work. The address is ${address}.`,
  },
};
