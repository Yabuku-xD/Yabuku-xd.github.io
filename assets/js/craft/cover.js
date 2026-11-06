// Cover art for Spotify rows and cards. A cover with no usable address, or one
// that fails to load, becomes a plain tile with a music note in the same box,
// so rows keep their shape and alignment.

/** The URL when it is http(s), otherwise "". Spotify data is not trusted. */
export function httpUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
  } catch {
    return "";
  }
  return "";
}

const NOTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

function missing(className, size) {
  const tile = document.createElement("span");
  tile.className = `cover-missing ${className}`;
  tile.style.width = `${size}px`;
  tile.style.height = `${size}px`;
  tile.innerHTML = NOTE;
  return tile;
}

/** An <img> that fades in once loaded, or the placeholder tile. Decorative: alt="". */
export function cover(url, className, size) {
  const src = httpUrl(url);
  if (!src) return missing(className, size);
  const img = document.createElement("img");
  img.className = `fade-img object-cover ${className}`;
  img.decoding = "async";
  img.loading = "lazy";
  img.width = size;
  img.height = size;
  img.alt = "";
  img.addEventListener("load", () => img.setAttribute("data-loaded", ""), { once: true });
  img.addEventListener("error", () => img.replaceWith(missing(className, size)), { once: true });
  img.src = src;
  return img;
}
