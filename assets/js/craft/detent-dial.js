// A rotary dial that clicks into stops. Ported from KokonutUI's DetentDial
// (MIT, kokonut-labs/kokonutui) without React or motion: 270 degrees of
// travel, each stop pulls the knob 65% of the way toward it, winding past an
// end flattens out within 16 degrees, a flick coasts and lands on a stop,
// and the ring's ticks swell in a wave as the indicator passes. Arrow keys,
// Page Up/Down, Home/End and the wheel (only while focused) step it.

const SWEEP = 270;
const START = -135;
const MAX_OVERSHOOT = 16;
const DETENT_PULL = 0.65;
const TICKS = 24; // decorative ticks round the ring; stops sit on some of them
const WAVE_HEIGHT = 9;
const WAVE_WIDTH = 12;
const DEAD_ZONE = 14;
const FLICK = 0.4; // stops per second, as a fraction of the range, that counts as a flick
const WINDOW_MS = 80;
const COAST = 0.3;

export function damp(distance, max) {
  return max * (1 - Math.exp(-distance / max));
}

/** Knob angle in degrees for a raw (unsnapped) position between stops 0..max. */
export function dialAngle(raw, max) {
  const per = max === 0 ? 0 : SWEEP / max;
  if (raw < 0) return START - damp(-raw * per, MAX_OVERSHOOT);
  if (raw > max) return START + SWEEP + damp((raw - max) * per, MAX_OVERSHOOT);
  const notch = Math.round(raw);
  return START + (notch + (raw - notch) * (1 - DETENT_PULL)) * per;
}

/** Tick length: base size plus a swell that follows the indicator's angle. */
export function tickLength(i, indicator, anchors) {
  const angle = START + (i / TICKS) * SWEEP;
  const base = anchors.has(i) ? 14 : i % 4 === 0 ? 10 : 6;
  const d = (angle - indicator) / WAVE_WIDTH;
  return Math.round((base + WAVE_HEIGHT * Math.exp(-d * d)) * 10) / 10;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const polar = (c, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
};
const SVG = "http://www.w3.org/2000/svg";

/**
 * Build a dial in `slot` for `stops` ([{ value, label }]). `onChange(index)`
 * fires when the dial lands on a new stop. Returns nothing; the dial owns
 * its state.
 */
export function createDial(slot, { stops, index = 0, label, onChange }) {
  // Fewer than two stops leaves nothing to turn to.
  if (stops.length < 2) return;
  const max = stops.length - 1;
  const size = 168;
  const c = size / 2;
  const outer = c - 6;
  const anchors = new Set(stops.map((_, k) => Math.round((k / max) * TICKS)));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  slot.classList.add("dial");
  slot.style.setProperty("--dial-size", `${size}px`);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  const ticks = Array.from({ length: TICKS + 1 }, () => {
    const line = document.createElementNS(SVG, "line");
    line.setAttribute("stroke-linecap", "round");
    svg.append(line);
    return line;
  });
  const marks = stops.map((stop, k) => {
    const mark = document.createElement("span");
    mark.className = "dial-mark";
    mark.textContent = stop.label;
    const p = polar(c, outer + 14, START + (k / max) * SWEEP);
    mark.style.left = `${p.x}px`;
    mark.style.top = `${p.y}px`;
    mark.setAttribute("aria-hidden", "true");
    return mark;
  });
  const knob = document.createElement("div");
  knob.className = "dial-knob";
  knob.tabIndex = 0;
  knob.setAttribute("role", "slider");
  knob.setAttribute("aria-label", label);
  knob.setAttribute("aria-valuemin", "0");
  knob.setAttribute("aria-valuemax", String(max));
  const indicator = document.createElement("span");
  indicator.className = "dial-indicator";
  indicator.setAttribute("aria-hidden", "true");
  knob.append(indicator);
  slot.replaceChildren(svg, ...marks, knob);

  let raw = index;
  let committed = index;
  let anim = 0;
  let drag = null;

  const paint = () => {
    const angle = dialAngle(raw, max);
    indicator.style.rotate = `${angle}deg`;
    const active = Math.round((committed / max) * TICKS);
    ticks.forEach((line, i) => {
      const len = tickLength(i, angle, anchors);
      const deg = START + (i / TICKS) * SWEEP;
      const a = polar(c, outer - len, deg);
      const b = polar(c, outer, deg);
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute("class", i === active ? "is-current" : i < active ? "is-lit" : "");
    });
  };
  const commit = () => {
    const next = clamp(Math.round(raw), 0, max);
    if (next === committed) return;
    committed = next;
    show();
    navigator.vibrate?.(1);
    onChange?.(committed);
  };
  const show = () => {
    knob.setAttribute("aria-valuenow", String(committed));
    knob.setAttribute("aria-valuetext", stops[committed].label);
    marks.forEach((m, k) => m.classList.toggle("is-current", k === committed));
  };
  // A damped spring carries `raw` to `to`, starting at `velocity` stops/s.
  const settle = (to, velocity = 0, stiffness = 170, damping = 20) => {
    cancelAnimationFrame(anim);
    if (reduce) {
      raw = to;
      commit();
      paint();
      return;
    }
    let v = velocity;
    let last = 0;
    const step = (now) => {
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      v += (-stiffness * (raw - to) - damping * v) * dt;
      raw += v * dt;
      commit();
      paint();
      if (Math.abs(raw - to) > 0.001 || Math.abs(v) > 0.01) anim = requestAnimationFrame(step);
      else {
        raw = to;
        paint();
      }
    };
    anim = requestAnimationFrame(step);
  };
  const jump = (to) => {
    cancelAnimationFrame(anim);
    raw = clamp(to, 0, max);
    commit();
    paint();
  };
  const angleOf = (event, rect) => {
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return { angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90, distance: Math.hypot(dx, dy) };
  };

  knob.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelAnimationFrame(anim);
    knob.setPointerCapture(event.pointerId);
    const rect = knob.getBoundingClientRect();
    drag = { id: event.pointerId, rect, last: angleOf(event, rect).angle, samples: [{ t: event.timeStamp, v: raw }] };
    knob.classList.add("is-grabbing");
  });
  knob.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const { angle, distance } = angleOf(event, drag.rect);
    if (distance < DEAD_ZONE) {
      drag.last = angle;
      return;
    }
    let delta = angle - drag.last;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    drag.last = angle;
    raw += (delta / SWEEP) * max;
    drag.samples.push({ t: event.timeStamp, v: raw });
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > WINDOW_MS) drag.samples.shift();
    commit();
    paint();
  });
  const release = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const { samples } = drag;
    drag = null;
    knob.classList.remove("is-grabbing");
    const first = samples[0];
    const last = samples.at(-1);
    const elapsed = (last.t - first.t) / 1000;
    const paused = event.timeStamp - last.t > WINDOW_MS;
    const velocity = elapsed > 0 && !paused ? (last.v - first.v) / elapsed : 0;
    if (raw < 0 || raw > max || Math.abs(velocity) < max * FLICK) {
      settle(clamp(Math.round(raw), 0, max));
      return;
    }
    settle(clamp(Math.round(raw + velocity * COAST), 0, max), velocity, 140, 24);
  };
  knob.addEventListener("pointerup", release);
  knob.addEventListener("pointercancel", release);
  knob.addEventListener("lostpointercapture", release);
  knob.addEventListener("keydown", (event) => {
    const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 1, PageDown: -1, Home: -max, End: max };
    if (!(event.key in steps)) return;
    event.preventDefault();
    jump(committed + steps[event.key]);
  });
  let wheel = 0;
  knob.addEventListener(
    "wheel",
    (event) => {
      if (document.activeElement !== knob) return;
      event.preventDefault();
      wheel += event.deltaY;
      while (Math.abs(wheel) >= 40) {
        const sign = Math.sign(wheel);
        wheel -= sign * 40;
        jump(committed - sign);
      }
    },
    { passive: false },
  );

  show();
  paint();
}
