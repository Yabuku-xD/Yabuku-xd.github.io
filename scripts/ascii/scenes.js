// The animated ascii landscapes that stand in for the hero photos, one per
// page. They follow ascii.rest's scene method (https://ascii.rest, MIT): each
// cell's colour is worked out as light, from a sky, a sun, terrain and weather,
// then drawn as a dot (" ·•●") whose size is the brightness, Bayer dithered,
// in the nearest of the scene's palette colours. The heavy noise is worked out
// once a size; a frame only adds what moves. Every scene is built for the grid
// its box needs, so it fills the hero at any width and the social cards.

const DOTS = " ·•●";
const COVER = [0, 0.3, 0.6, 1]; // how much of its cell each dot covers
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);

// ---------- maths ----------

function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise, wrapping every `period` lattice cells in x when period > 0.
function noise(x, y, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  let x0 = xi, x1 = xi + 1;
  if (period) {
    x0 = ((xi % period) + period) % period;
    x1 = (x0 + 1) % period;
  }
  const a = hash(x0, yi), b = hash(x1, yi), c = hash(x0, yi + 1), d = hash(x1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, octaves, period = 0) {
  let s = 0, n = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    s += amp * noise(x * f, y * f, period * f);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / n;
}

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const mix = (a, b, k) => a + (b - a) * k;
const fract = (v) => v - Math.floor(v);
const bump = (x, center, width) => Math.exp(-(((x - center) / width) ** 2));
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
const toHex = (c) => `#${c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0")).join("")}`;

// `n` colours spread evenly along a run of colour stops.
function ramp(stops, n) {
  const rgb = stops.map(hex);
  return Array.from({ length: n }, (_, i) => {
    const p = (i / (n - 1)) * (rgb.length - 1);
    const j = Math.min(rgb.length - 2, Math.floor(p));
    return toHex(rgb[j].map((v, c) => mix(v, rgb[j + 1][c], p - j)));
  });
}

// A colour from stops placed at 0 to 1, by k: [[0, [r, g, b]], [0.4, [r, g, b]], ...].
function gradient(stops, k) {
  let i = 0;
  while (i < stops.length - 2 && k > stops[i + 1][0]) i++;
  const [k0, a] = stops[i], [k1, b] = stops[i + 1];
  const f = smooth(k0, k1, k);
  return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
}

// A drifting texture of heaped noise, wide enough to wrap: clouds and fog bank.
function weather(width, rows, scale, seed) {
  const cover = new Float32Array(width * rows);
  const lit = new Float32Array(width * rows);
  const period = Math.round(width * 0.012 * scale);
  const density = (x, y) => {
    const q = fbm(x * 0.012 * scale, y * 0.03 * scale + seed, 3, period);
    return fbm(x * 0.024 * scale + q * 2.2, y * 0.05 * scale + q + seed, 4, period * 2);
  };
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < width; x++) {
      const d = density(x, r + 0.5);
      cover[r * width + x] = d;
      lit[r * width + x] = clamp(0.5 + (d - density(x + 2, r - 1.5)) * 9);
    }
  }
  return { width, cover, lit };
}

const sample = (tex, x, r) => {
  const ix = Math.floor(x), fx = x - ix;
  const w = tex.width;
  const i0 = r * w + (((ix % w) + w) % w), i1 = r * w + ((((ix + 1) % w) + w) % w);
  return [tex.cover[i0] + (tex.cover[i1] - tex.cover[i0]) * fx, tex.lit[i0] + (tex.lit[i1] - tex.lit[i0]) * fx];
};

// ---------- the scene engine ----------

// build(W, H) does the once-a-size work and returns frame(t), which returns
// paint(x, y, px): px.r, px.g, px.b the light at the cell (0 to 1 and over),
// px.floor the dimmest dot the cell keeps, px.fade how far it thins out.
function scene(meta, build) {
  return (cols, rows) => ({
    meta: {
      name: meta.name,
      category: "scenes",
      note: meta.note,
      cols,
      rows,
      cell: 1,
      fps: 15,
      ground: meta.ground,
      palette: meta.palette,
      still: meta.still ?? 0,
    },
    default() {
      const P = meta.palette.map(hex);
      const lut = new Uint8Array(32768).fill(255);
      const nearest = (r, g, b) => {
        const k = (Math.min(31, (r * 31.99) | 0) << 10) | (Math.min(31, (g * 31.99) | 0) << 5) | Math.min(31, (b * 31.99) | 0);
        if (lut[k] !== 255) return lut[k];
        let best = 0, bd = 1e9;
        for (let i = 0; i < P.length; i++) {
          const dr = P[i][0] - r, dg = P[i][1] - g, db = P[i][2] - b;
          const d = 0.3 * dr * dr + 0.5 * dg * dg + 0.2 * db * db;
          if (d < bd) (bd = d), (best = i);
        }
        return (lut[k] = best);
      };
      const frame = build(cols, rows);
      const out = new Array(cols * rows);
      const px = { r: 0, g: 0, b: 0, floor: 0.15, fade: 1 };
      return (t, { color } = {}) => {
        const paint = frame(t);
        for (let r = 0; r < rows; r++) {
          for (let x = 0; x < cols; x++) {
            const k = r * cols + x;
            px.r = px.g = px.b = 0;
            px.floor = 0.15;
            px.fade = 1;
            paint(x, r, px);
            // Dot size from brightness, dithered; the colour then makes up what
            // the dot size could not, so a gradient stays smooth across steps.
            const peak = Math.max(px.r, px.g, px.b, 1e-4);
            const level = clamp(px.floor + (1 - px.floor) * Math.pow(peak, 0.85) * 0.95) * px.fade;
            const step = Math.max(0, Math.min(3, Math.round(level * 3 + BAYER[(r & 3) * 4 + (x & 3)])));
            out[k] = DOTS[step];
            if (color) {
              const want = step ? Math.min(1, (level + 0.06) / COVER[step]) : 0;
              const s = (0.3 + 0.7 * want) / peak;
              color[k] = nearest(clamp(px.r * s), clamp(px.g * s), clamp(px.b * s));
            }
          }
        }
        const lines = [];
        for (let r = 0; r < rows; r++) lines.push(out.slice(r * cols, (r + 1) * cols).join(""));
        return lines.join("\n");
      };
    },
  });
}

// Static layers worked out once: a colour, floor and a material for each cell.
function canvas(W, H) {
  const N = W * H;
  return { R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), F: new Float32Array(N).fill(0.15), M: new Uint8Array(N) };
}

function put(layer, k, c, floor, material) {
  layer.R[k] = c[0];
  layer.G[k] = c[1];
  layer.B[k] = c[2];
  layer.F[k] = floor;
  layer.M[k] = material;
}

function base(layer, k, px) {
  px.r = layer.R[k];
  px.g = layer.G[k];
  px.b = layer.B[k];
  px.floor = layer.F[k];
}

const AIR = 0, LAND = 1, WATER = 2, TREE = 3, FIGURE = 4;

// ---------- about: dunes at dusk ----------

// Three ranges of dunes under an ember sky. The sun sinks behind the far
// ridge, wind lifts sand off the crests, and the first stars come out.
const dunes = scene(
  {
    name: "dunes at dusk",
    note: "dunes under an ember sky, sand blowing off the crests at sundown",
    ground: "#0d0807",
    palette: [
      ...ramp(["#0d0a1a", "#2a1638", "#5a2443", "#a33d3a", "#e0652c", "#ffb35c", "#fff1c8"], 22),
      ...ramp(["#160b07", "#3a1a0e", "#6e3417", "#b45b26", "#f08c3c", "#ffc77d"], 16),
      "#f4f2ff", "#c9c5e8",
    ],
  },
  (W, H) => {
    const layer = canvas(W, H);
    const sun = [W * 0.74, H * 0.6];
    const sunR = Math.max(2, H * 0.1);
    const ranges = [
      { base: 0.68, amp: 0.14, span: 1.2, seed: 1, haze: 0.4 },
      { base: 0.82, amp: 0.18, span: 1.7, seed: 2, haze: 0.15 },
      { base: 1.02, amp: 0.24, span: 2.4, seed: 3, haze: 0 },
    ];
    const crest = (d, x) => {
      const X = x / H;
      const p = fract(X / d.span + d.seed * 0.37 + 0.35 * fbm(X * 0.7, d.seed * 5, 2));
      const s = p < 0.7 ? p / 0.7 : (1 - p) / 0.3;
      return H * (d.base - d.amp * s * s * (3 - 2 * s));
    };
    const sky = (y) =>
      gradient(
        [
          [0, [0.03, 0.03, 0.1]],
          [0.3, [0.1, 0.06, 0.17]],
          [0.5, [0.42, 0.13, 0.16]],
          [0.66, [1, 0.46, 0.18]],
        ],
        y / H,
      );
    const crests = ranges.map((d) => Float32Array.from({ length: W + 2 }, (_, x) => crest(d, x - 1)));
    for (let r = 0; r < H; r++) {
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const y = r + 0.5;
        let c = sky(y), floor = 0.12, material = AIR;
        const dx = x + 0.5 - sun[0], dy = y - sun[1];
        const ds = Math.hypot(dx, dy);
        const halo = Math.exp(-ds / (H * 0.35)) * 0.5 + Math.exp(-ds / (H * 0.1)) * 0.5;
        c = [c[0] + halo, c[1] + halo * 0.55, c[2] + halo * 0.25];
        if (ds < sunR) c = [1, 0.86, 0.6];
        for (let i = ranges.length - 1; i >= 0; i--) {
          const top = crests[i][x + 1];
          if (y < top) continue;
          const slope = crests[i][x + 2] - crests[i][x];
          const lit = clamp(0.2 + slope * 0.9) * 0.7 + 0.8 * Math.exp(-(y - top) / 0.9) * clamp(0.4 + slope);
          const ripple = 0.86 + 0.14 * Math.sin(x * 0.9 + y * 2.4 + fbm(x * 0.1, y * 0.2, 2) * 4);
          const sand = [mix(0.07, 0.95, lit) * ripple, mix(0.03, 0.48, lit) * ripple, mix(0.03, 0.18, lit) * ripple];
          const deep = 1 - 0.45 * clamp((y - top) / (H * 0.3));
          const haze = sky(top);
          c = sand.map((v, j) => mix(v * deep, haze[j] * 0.9, ranges[i].haze));
          floor = 0.08;
          material = LAND;
          break;
        }
        put(layer, k, c, floor, material);
      }
    }
    return (t) => (x, r, px) => {
      const k = r * W + x;
      base(layer, k, px);
      const y = r + 0.5;
      if (layer.M[k] === AIR && y < H * 0.42 && hash(x, r * 3 + 11) > 0.982) {
        const tw = 0.55 + 0.45 * Math.sin(t * (1.3 + hash(x, r) * 3) + hash(r, x) * 6.28);
        const s = tw * smooth(H * 0.42, H * 0.05, y);
        px.r = Math.max(px.r, s * 0.95), px.g = Math.max(px.g, s * 0.95), px.b = Math.max(px.b, s);
      }
      // sand streaming off the front crests, downwind
      for (let i = 1; i < ranges.length; i++) {
        const above = crests[i][x + 1] - y;
        if (above > -0.5 && above < H * 0.12) {
          const gust = smooth(0.55, 0.85, noise(x * 0.22 - t * 3.2, y * 0.8 + t * 0.2 + i * 9));
          const s = gust * smooth(H * 0.12, 0, above) * 0.7;
          px.r += s, px.g += s * 0.62, px.b += s * 0.3;
        }
      }
    };
  },
);

// ---------- projects: a meadow by a lake ----------

// A bright day: clouds drift over blue mountains, the lake mirrors them and
// glints, wind runs through the grass in waves, and a tree rustles.
const meadow = scene(
  {
    name: "lake meadow",
    note: "a lake below blue mountains, clouds drifting, wind across the grass",
    ground: "#0b1a24",
    palette: [
      ...ramp(["#0f2a4a", "#24508a", "#3d78c0", "#6ea6dc", "#a9cdee", "#e6f2fb", "#ffffff"], 16),
      ...ramp(["#1d2e44", "#3b5577", "#6b86a8", "#a2b5cc"], 8),
      ...ramp(["#0c2410", "#1d4a1c", "#33752a", "#58a03a", "#8ccc52", "#c6eb7c"], 14),
      "#ffe36e", "#ffffff", "#f39ab6", "#3a2a1a", "#5c4128",
    ],
  },
  (W, H) => {
    const layer = canvas(W, H);
    const lakeTop = H * 0.55;
    const mount = (x) => {
      const X = x / H;
      return H * (0.5 - 0.17 * fbm(X * 1.1, 7, 4) - 0.12 * bump(x / W, 0.3, 0.12) - 0.06 * bump(x / W, 0.62, 0.08));
    };
    const hill = (x) => {
      const X = x / H;
      return H * (0.74 + 0.1 * Math.sin(X * 1.6 + 0.4) - 0.07 * fbm(X * 1.5, 3, 3) + 0.2 * smooth(0.55, 0.05, x / W) - 0.08 * smooth(0.6, 0.95, x / W));
    };
    const treeX = W * 0.84;
    const treeBase = hill(treeX);
    const canopyR = H * 0.2;
    const canopy = [treeX, treeBase - H * 0.27];
    const sky = (y) => gradient([[0, [0.14, 0.36, 0.72]], [0.55, [0.7, 0.85, 0.97]]], y / H);
    const clouds = weather(W * 3, Math.ceil(lakeTop), 140 / H, 4);
    for (let r = 0; r < H; r++) {
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const y = r + 0.5;
        let c = sky(y), floor = 0.18, material = AIR;
        const top = mount(x);
        if (y >= top && y < lakeTop) {
          const lit = clamp(0.5 + (mount(x - 1) - mount(x + 1)) * 0.8);
          const snow = smooth(H * 0.4, H * 0.32, y) * smooth(0.45, 0.6, fbm(x * 0.2, y * 0.2, 3));
          const snow2 = Math.max(snow, smooth(1.6, 0, y - top) * 0.6);
          c = [mix(0.13, 0.36, lit), mix(0.2, 0.46, lit), mix(0.34, 0.66, lit)].map((v) => mix(v, 0.97, snow2));
          c = c.map((v, j) => mix(v, sky(lakeTop)[j], 0.3 * smooth(top, lakeTop, y)));
          material = LAND;
        }
        if (y >= lakeTop) {
          const mirror = 2 * lakeTop - y;
          c = mirror >= mount(x) ? [0.16, 0.24, 0.38] : sky(mirror).map((v, j) => v * [0.62, 0.78, 0.92][j]);
          floor = 0.15;
          material = WATER;
        }
        const ground = hill(x);
        if (y >= ground) {
          const lit = clamp(0.55 + (hill(x + 1) - hill(x - 1)) * 0.6 - (y - ground) / (H * 0.5));
          const tuft = 0.8 + 0.3 * fbm(x * 0.4, y * 0.6, 3);
          c = [mix(0.06, 0.45, lit) * tuft, mix(0.18, 0.78, lit) * tuft, mix(0.06, 0.25, lit) * tuft];
          const h = hash(x, r);
          if (h > 0.985) c = h > 0.993 ? [1, 1, 1] : h > 0.989 ? [1, 0.86, 0.3] : [0.98, 0.55, 0.7];
          floor = 0.1;
          material = LAND;
        }
        const tx = x + 0.5 - treeX;
        if (Math.abs(tx) < Math.max(0.6, W * 0.006) && y > canopy[1] && y < treeBase + 1) {
          c = [0.24, 0.16, 0.1];
          material = TREE;
        }
        const dc = Math.hypot(x + 0.5 - canopy[0], (y - canopy[1]) * 1.15);
        if (dc < canopyR * (0.78 + 0.35 * fbm(x * 0.25, y * 0.25, 3))) {
          const lit = clamp(0.35 + ((x + 0.5 - canopy[0]) / canopyR) * 0.35 - ((y - canopy[1]) / canopyR) * 0.4);
          c = [mix(0.05, 0.38, lit), mix(0.16, 0.66, lit), mix(0.06, 0.24, lit)];
          floor = 0.08;
          material = TREE;
        }
        put(layer, k, c, floor, material);
      }
    }
    return (t) => (x, r, px) => {
      const k = r * W + x;
      base(layer, k, px);
      const y = r + 0.5;
      const m = layer.M[k];
      if (m === AIR && r < clouds.cover.length / clouds.width) {
        const [d, l] = sample(clouds, x + t * 1.6, r);
        const cover = smooth(0.5, 0.64, d) * smooth(lakeTop, H * 0.3, y);
        if (cover > 0.01) {
          const b = clamp(0.35 + 0.65 * l);
          px.r = mix(px.r, mix(0.55, 1, b), cover);
          px.g = mix(px.g, mix(0.62, 1, b), cover);
          px.b = mix(px.b, mix(0.76, 1, b), cover);
          px.floor = 0.2;
        }
      } else if (m === WATER) {
        const w = noise(x * 0.09 + t * 0.15, y * 0.7 - t * 0.5) * 0.6 + noise(x * 0.25 - t * 0.3, y * 1.4) * 0.4;
        const glint = smooth(0.62, 0.85, w);
        px.r = px.r * (0.75 + 0.4 * w) + glint * 0.7;
        px.g = px.g * (0.75 + 0.4 * w) + glint * 0.75;
        px.b = px.b * (0.75 + 0.4 * w) + glint * 0.8;
      } else if (m === LAND && y > H * 0.6) {
        const wave = 0.5 + 0.5 * Math.sin(x * 0.11 - t * 1.7 + y * 0.18 + noise(x * 0.04, y * 0.08) * 5);
        const s = 0.82 + 0.4 * wave * wave;
        px.r *= s, px.g *= s, px.b *= s;
      } else if (m === TREE) {
        const s = 0.85 + 0.3 * noise(x * 0.5 + t * 0.8, y * 0.5 - t * 0.4);
        px.r *= s, px.g *= s, px.b *= s;
      }
      // a pair of birds crossing high up
      for (let i = 0; i < 2; i++) {
        const bx = ((t * (2.2 + i * 0.7) + i * W * 0.45) % (W + 20)) - 10;
        const by = H * (0.16 + i * 0.07) + Math.sin(t * 0.8 + i) * 1.2;
        const wing = Math.sin(t * 7 + i * 2) > 0 ? 1 : 0;
        if (Math.round(by - wing * Math.abs(x + 0.5 - bx)) === r && Math.abs(x + 0.5 - bx) < 1.6) {
          px.r = 0.12, px.g = 0.16, px.b = 0.22, px.floor = 0.6;
        }
      }
    };
  },
);

// ---------- contributions: where the streams meet ----------

// A valley at golden hour seen from above the hills: five streams wind down
// from the slopes and join into one river that carries the light toward us.
const confluence = scene(
  {
    name: "confluence",
    note: "five streams winding down a valley at golden hour and joining as one",
    ground: "#0a0705",
    palette: [
      ...ramp(["#120c10", "#2c1a22", "#5a2f2c", "#a3552f", "#e48c3a", "#ffc25e", "#fff0c4"], 22),
      ...ramp(["#0b0806", "#1c140d", "#33231a", "#4f3a28", "#6d5236"], 10),
      ...ramp(["#3a2410", "#8a5a1e", "#d8a040", "#ffe6a0"], 8),
    ],
  },
  (W, H) => {
    const layer = canvas(W, H);
    const sun = [W * 0.2, H * 0.3];
    const floorTop = H * 0.5;
    const ridge = (x, seed, baseV, amp) => H * (baseV - amp * fbm((x / H) * 1.3, seed, 4));
    const merge = [W * 0.52, H * 0.84];
    const starts = [0.08, 0.26, 0.47, 0.7, 0.92].map((p) => W * p);
    const ease = (v) => v * v * (3 - 2 * v);
    const sky = (y) => gradient([[0, [0.16, 0.1, 0.16]], [0.3, [0.55, 0.28, 0.2]], [0.5, [1, 0.7, 0.36]]], y / H);
    const centre = (i, y) => {
      if (y >= merge[1]) return merge[0] + Math.sin(y * 0.35) * 0.8;
      const e = ease(clamp((y - floorTop) / (merge[1] - floorTop)));
      return mix(starts[i], merge[0], e) + Math.sin(y * 0.45 + i * 1.9) * (1 - e) * W * 0.025;
    };
    const width = (y) => (y >= merge[1] ? 2.2 + (y - merge[1]) * 0.5 : 0.9 + ((y - floorTop) / H) * 2.6);
    const water = new Float32Array(W * H);
    for (let r = 0; r < H; r++) {
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const y = r + 0.5;
        let c = sky(y), floor = 0.14, material = AIR;
        const ds = Math.hypot(x + 0.5 - sun[0], y - sun[1]);
        const halo = Math.exp(-ds / (H * 0.3)) * 0.55 + Math.exp(-ds / (H * 0.07)) * 0.6;
        c = [c[0] + halo, c[1] + halo * 0.7, c[2] + halo * 0.35];
        const far = ridge(x, 2, 0.47, 0.16), near = ridge(x, 5, 0.56, 0.12);
        if (y >= far) {
          c = sky(far).map((v, j) => v * [0.55, 0.42, 0.42][j]);
          floor = 0.1;
          material = LAND;
        }
        if (y >= near) {
          const lit = clamp(0.4 + (ridge(x - 1, 5, 0.56, 0.12) - ridge(x + 1, 5, 0.56, 0.12)) * 0.5);
          c = [mix(0.12, 0.42, lit), mix(0.08, 0.26, lit), mix(0.06, 0.14, lit)];
          material = LAND;
        }
        if (y >= Math.max(near, floorTop)) {
          const v = (y - floorTop) / (H - floorTop);
          const grass = 0.7 + 0.4 * fbm(x * 0.12, y * 0.3, 3);
          c = [(0.2 + 0.1 * (1 - v)) * grass, (0.15 + 0.06 * (1 - v)) * grass, 0.08 * grass];
          floor = 0.08;
          material = LAND;
          let best = 1e9;
          for (let i = 0; i < starts.length; i++) best = Math.min(best, Math.abs(x + 0.5 - centre(i, y)));
          const wd = width(y);
          if (best < wd) {
            water[k] = 1 - best / wd;
            material = WATER;
            c = [1, 0.74, 0.36];
            floor = 0.2;
          } else if (best < wd + 1.2) {
            c = c.map((v) => v * 0.6);
          }
        }
        put(layer, k, c, floor, material);
      }
    }
    return (t) => (x, r, px) => {
      const k = r * W + x;
      base(layer, k, px);
      const y = r + 0.5;
      const m = layer.M[k];
      if (m === WATER) {
        const flow = noise(x * 0.3, y * 0.5 - t * 1.6) * 0.6 + noise(x * 0.8, y * 1.2 - t * 2.6) * 0.4;
        const s = (0.55 + 0.7 * flow) * (0.75 + 0.25 * water[k]);
        px.r *= s, px.g *= s, px.b *= s;
        if (flow > 0.78) (px.r = 1), (px.g = 0.95), (px.b = 0.78);
      } else if (m === AIR || y < floorTop) {
        // light rays fanning out from the low sun
        const a = Math.atan2(y - sun[1], x + 0.5 - sun[0]);
        const ray = Math.pow(0.5 + 0.5 * Math.sin(a * 22 + Math.sin(t * 0.3) * 0.8 + noise(a * 4, t * 0.15) * 2), 4);
        const s = ray * Math.exp(-Math.hypot(x + 0.5 - sun[0], y - sun[1]) / (H * 0.9)) * (m === AIR ? 0.35 : 0.12);
        px.r += s, px.g += s * 0.72, px.b += s * 0.35;
      }
      // mist lying low over the valley floor
      const mist = smooth(0.55, 0.75, noise(x * 0.05 - t * 0.12, y * 0.25)) * bump(y, floorTop + H * 0.05, H * 0.07) * 0.35;
      px.r += mist, px.g += mist * 0.8, px.b += mist * 0.6;
    };
  },
);

// ---------- contact: lanterns at dusk ----------

// Someone stands on a hilltop at dusk and lets paper lanterns go; they rise
// on the wind, swaying, into a sky where the first stars are out.
const lanterns = scene(
  {
    name: "lanterns at dusk",
    note: "a figure on a hilltop letting paper lanterns rise into the dusk",
    ground: "#06070f",
    palette: [
      ...ramp(["#070a1c", "#14183a", "#2c2352", "#55305e", "#93415e", "#d8644f", "#ffa95e", "#ffe2a8"], 26),
      ...ramp(["#05070a", "#0d1416", "#1a2626", "#2c3a36"], 8),
      ...ramp(["#7a2a10", "#d8641c", "#ffa83a", "#fff0b8"], 8),
      "#f2f2ff",
    ],
  },
  (W, H) => {
    const layer = canvas(W, H);
    const horizon = H * 0.66;
    const figX = W * 0.36;
    const hill = (x) => H * (0.9 - 0.24 * bump(x / W, 0.36, 0.2) - 0.03 * fbm(x * 0.05, 2, 3));
    const crestY = hill(figX);
    const figH = Math.max(3, H * 0.12);
    const sky = (y) =>
      gradient(
        [
          [0, [0.03, 0.04, 0.13]],
          [0.3, [0.16, 0.12, 0.3]],
          [0.52, [0.55, 0.24, 0.36]],
          [0.68, [1, 0.55, 0.32]],
        ],
        y / H,
      );
    const far = (x, seed, v, amp) => H * (v - amp * fbm((x / H) * 1.2, seed, 4));
    const wisps = weather(W * 3, Math.ceil(horizon), 160 / H, 9);
    for (let r = 0; r < H; r++) {
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const y = r + 0.5;
        let c = sky(y), floor = 0.13, material = AIR;
        const glow = bump(y, horizon, H * 0.12) * (0.4 + 0.6 * bump(x / W, 0.75, 0.3)) * 0.45;
        c = [c[0] + glow, c[1] + glow * 0.6, c[2] + glow * 0.3];
        for (const [seed, v, amp, shade] of [[3, 0.68, 0.1, 0.55], [6, 0.78, 0.1, 0.3]]) {
          const top = far(x, seed, v, amp);
          if (y >= top) {
            c = sky(top).map((s) => s * shade);
            floor = 0.1;
            material = LAND;
          }
        }
        const top = hill(x);
        if (y >= top) {
          const rim = Math.exp(-(y - top) / 1.2) * 0.25;
          c = [0.04 + rim, 0.06 + rim * 0.6, 0.07 + rim * 0.4].map((v) => v * (0.8 + 0.4 * fbm(x * 0.3, y * 0.4, 2)));
          floor = 0.05;
          material = LAND;
        }
        // the figure, a dark shape with a lit edge, arms raised
        const fx = x + 0.5 - figX, fy = crestY - y;
        const head = Math.hypot(fx * 1.2, fy - figH * 0.85) < Math.max(0.7, figH * 0.13);
        const body = fy > 0 && fy < figH * 0.72 && Math.abs(fx) < Math.max(0.5, figH * 0.12 * (1 - fy / (figH * 1.4)));
        const arm = fy > figH * 0.55 && fy < figH * 0.95 && Math.abs(fx - (fy - figH * 0.55) * 0.5) < 0.5;
        if (head || body || arm) {
          c = [0.02, 0.02, 0.04];
          floor = 0.55;
          material = FIGURE;
        }
        put(layer, k, c, floor, material);
      }
    }
    const COUNT = 10, LIFE = 24;
    return (t) => {
      const lights = [];
      for (let i = 0; i < COUNT; i++) {
        const age = fract(t / LIFE + i / COUNT);
        const lx = figX + figH * 0.45 + age * W * 0.32 * (0.6 + hash(i, 1)) + Math.sin(t * 0.9 + i * 2) * 1.5 * age;
        const ly = crestY - figH * 1.05 - age * (crestY - figH) * 1.15;
        const glow = smooth(0, 0.06, age) * (1 - smooth(0.7, 1, age)) * (0.85 + 0.15 * Math.sin(t * 5 + i));
        lights.push([lx, ly, glow, 1 - age * 0.6]);
      }
      return (x, r, px) => {
        const k = r * W + x;
        base(layer, k, px);
        const y = r + 0.5;
        const m = layer.M[k];
        if (m === AIR) {
          if (r < wisps.cover.length / wisps.width) {
            const [d, l] = sample(wisps, x + t * 0.8, r);
            const cover = smooth(0.6, 0.72, d) * bump(y, horizon * 0.7, H * 0.1) * 0.7;
            const b = 0.4 + 0.6 * l;
            px.r = mix(px.r, 0.95 * b, cover);
            px.g = mix(px.g, 0.5 * b, cover);
            px.b = mix(px.b, 0.48 * b, cover);
          }
          if (y < horizon * 0.7 && hash(x, r * 3 + 5) > 0.984) {
            const tw = 0.5 + 0.5 * Math.sin(t * (1.1 + hash(x, r) * 2.5) + hash(r, x) * 6.28);
            const s = tw * smooth(horizon * 0.7, 0, y);
            px.r = Math.max(px.r, s), px.g = Math.max(px.g, s), px.b = Math.max(px.b, s);
          }
        }
        if (m !== FIGURE) {
          for (const [lx, ly, glow, size] of lights) {
            const d = Math.hypot(x + 0.5 - lx, (y - ly) * 1.1);
            const g = glow * (Math.exp(-d / (0.9 * size)) * 1.7 + Math.exp(-d / (3.6 * size)) * 0.32);
            px.r += g, px.g += g * 0.74, px.b += g * 0.34;
          }
        }
      };
    };
  },
);

// ---------- privacy: peaks in the mist ----------

// Ridge after ridge fading into pale air, with banks of fog rolling through
// the valleys between them and hiding whatever they pass over.
const mist = scene(
  {
    name: "peaks in mist",
    note: "ridges fading into pale air, fog banks rolling through the valleys",
    ground: "#0f1411",
    palette: [
      ...ramp(["#121a16", "#22302a", "#384a41", "#566b60", "#7b8f84", "#a3b3aa", "#cad5ce", "#eef2ee", "#ffffff"], 30),
      ...ramp(["#2b3a2a", "#3f5a3b", "#5c7d55"], 6),
    ],
  },
  (W, H) => {
    const layer = canvas(W, H);
    const ranges = [
      { v: 0.5, amp: 0.3, seed: 1, tone: 0.78, peak: true },
      { v: 0.6, amp: 0.16, seed: 4, tone: 0.62 },
      { v: 0.72, amp: 0.14, seed: 7, tone: 0.44 },
      { v: 0.86, amp: 0.12, seed: 9, tone: 0.24 },
    ];
    const ridged = (x, seed) => {
      let s = 0, amp = 0.5, f = 1, n = 0;
      for (let i = 0; i < 4; i++) {
        s += amp * (1 - Math.abs(noise(x * f, seed + i * 3.1) * 2 - 1));
        n += amp;
        amp *= 0.5;
        f *= 2.1;
      }
      return s / n;
    };
    const top = (d, x) =>
      H * (d.v - d.amp * (0.55 * ridged((x / H) * 1.6, d.seed) + (d.peak ? 0.75 * bump(x / W, 0.72, 0.12) : 0.2)));
    const tops = ranges.map((d) => Float32Array.from({ length: W + 2 }, (_, x) => top(d, x - 1)));
    const which = new Uint8Array(W * H).fill(255);
    const fog = weather(W * 3, H, 110 / H, 2);
    for (let r = 0; r < H; r++) {
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const y = r + 0.5;
        const v = y / H;
        let c = [0.86 - 0.1 * v + 0.06 * (1 - x / W), 0.9 - 0.1 * v + 0.05 * (1 - x / W), 0.88 - 0.1 * v], floor = 0.2, material = AIR;
        for (let i = ranges.length - 1; i >= 0; i--) {
          const t0 = tops[i][x + 1];
          if (y < t0) continue;
          const lit = clamp(0.5 + (tops[i][x] - tops[i][x + 2]) * 0.45);
          const tone = ranges[i].tone;
          const forest = i >= 2 ? 0.75 + 0.35 * hash(x, r) : 0.9 + 0.15 * fbm(x * 0.3, y * 0.3, 2);
          const g = (tone * 0.75 + lit * 0.25) * forest * (1 - 0.25 * clamp((y - t0) / (H * 0.25)));
          c = [g * 0.86, g, g * 0.9];
          floor = 0.12;
          material = LAND;
          which[k] = i;
          break;
        }
        put(layer, k, c, floor, material);
      }
    }
    return (t) => (x, r, px) => {
      const k = r * W + x;
      base(layer, k, px);
      const y = r + 0.5;
      // fog banks lie in the valleys, just under each ridge's crest
      let band = 0;
      for (let i = 1; i < ranges.length; i++) band = Math.max(band, bump(y - tops[i][x + 1], -H * 0.02, H * 0.09));
      const [d, l] = sample(fog, x + t * (1.2 + (which[k] === 255 ? 0 : which[k]) * 0.4), r);
      const veil = smooth(0.46, 0.66, d) * (0.12 + 0.88 * band);
      if (veil > 0.01) {
        const b = 0.88 + 0.12 * l;
        px.r = mix(px.r, b, veil);
        px.g = mix(px.g, b, veil);
        px.b = mix(px.b, b * 0.98, veil);
        px.floor = mix(px.floor, 0.25, veil);
      }
    };
  },
);

// ---------- listening: sunbeams over a valley ----------

// Late light pours through a gap in the mountains: beams sweep slowly over a
// forested valley, dust glitters in them, and a flock crosses in formation.
const sunbeams = scene(
  {
    name: "valley sunbeams",
    note: "beams of late light sweeping over a forested valley, a flock passing",
    ground: "#0c0806",
    palette: [
      ...ramp(["#140d0b", "#2e1c15", "#56331f", "#8c5229", "#c97a36", "#f0a84e", "#ffd38a", "#fff4d6"], 26),
      ...ramp(["#0a0a07", "#17170f", "#272618", "#3c3a22"], 8),
      ...ramp(["#3a2c26", "#6a5244", "#a08066"], 6),
    ],
  },
  (W, H) => {
    const layer = canvas(W, H);
    const sun = [W * 0.82, H * 0.24];
    const ridge = (x, seed, v, amp) => H * (v - amp * fbm((x / H) * 1.15, seed, 5));
    const ranges = [
      [3, 0.46, 0.22, 0.45],
      [5, 0.6, 0.18, 0.28],
      [8, 0.74, 0.14, 0.12],
    ];
    const sky = (y) => gradient([[0, [0.32, 0.22, 0.24]], [0.45, [0.95, 0.66, 0.4]]], y / H);
    const trees = [];
    for (let x = 0; x < W; x += 1.6 + hash(x * 7, 3) * 2.4) trees.push([x, H * (0.82 + 0.06 * hash(x, 9)), H * (0.1 + 0.12 * hash(x, 4))]);
    const shadeOf = new Float32Array(W * H);
    for (let r = 0; r < H; r++) {
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const y = r + 0.5;
        let c = sky(y), floor = 0.14, material = AIR;
        const ds = Math.hypot(x + 0.5 - sun[0], y - sun[1]);
        const halo = Math.exp(-ds / (H * 0.4)) * 0.5 + Math.exp(-ds / (H * 0.08)) * 0.8;
        c = [c[0] + halo, c[1] + halo * 0.8, c[2] + halo * 0.5];
        for (const [seed, v, amp, haze] of ranges) {
          const top = ridge(x, seed, v, amp);
          if (y >= top) {
            const lit = clamp(0.5 + (ridge(x - 1, seed, v, amp) - ridge(x + 1, seed, v, amp)) * 0.5);
            const rock = [mix(0.06, 0.4, lit), mix(0.04, 0.22, lit), mix(0.03, 0.13, lit)];
            c = rock.map((s, j) => mix(s, sky(top)[j], haze));
            floor = 0.1;
            material = LAND;
            shadeOf[k] = haze;
          }
        }
        for (const [tx, tb, th] of trees) {
          const dy = y - (tb - th);
          if (dy >= 0 && y < H + 1 && Math.abs(x + 0.5 - tx) <= (dy / th) * Math.max(0.9, th * 0.22) + 0.3) {
            c = [0.05, 0.05, 0.03].map((s) => s + (x + 0.5 > tx ? 0.05 : 0));
            floor = 0.06;
            material = TREE;
          }
        }
        put(layer, k, c, floor, material);
      }
    }
    return (t) => (x, r, px) => {
      const k = r * W + x;
      base(layer, k, px);
      const y = r + 0.5;
      const m = layer.M[k];
      const a = Math.atan2(y - sun[1], x + 0.5 - sun[0]);
      const beam = Math.pow(0.5 + 0.5 * Math.sin(a * 16 + t * 0.12 + noise(a * 3, t * 0.08) * 2.5), 3);
      const reach = Math.exp(-Math.hypot(x + 0.5 - sun[0], y - sun[1]) / (H * 1.1));
      const s = beam * reach * (m === TREE ? 0.05 : m === LAND ? 0.25 + shadeOf[k] * 0.3 : 0.4);
      px.r += s, px.g += s * 0.75, px.b += s * 0.42;
      if (m !== TREE && beam > 0.5 && hash(x, r * 7 + 3) > 0.985) {
        const tw = 0.5 + 0.5 * Math.sin(t * (2 + hash(r, x) * 3) + hash(x, r) * 6.28);
        px.r += tw * 0.6, px.g += tw * 0.5, px.b += tw * 0.3;
      }
      // a flock in a loose V, crossing right to left
      const lead = W + 12 - ((t * 3.2) % (W + 30));
      for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
        const bx = lead + rank * 2.6, by = H * 0.3 + side * rank * 1.1 + Math.sin(t * 6 + i) * 0.3;
        if (Math.abs(x + 0.5 - bx) < 0.6 && Math.abs(y - by) < 0.6) (px.r = 0.08), (px.g = 0.06), (px.b = 0.05), (px.floor = 0.5);
      }
    };
  },
);

export const scenes = { dunes, meadow, confluence, lanterns, mist, sunbeams };
