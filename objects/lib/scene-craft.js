/* motion-pack/objects/lib/scene-craft.js: the style craft of the hero scenes as PURE functions of time (no three.js, no clock, no random):
   stop-motion stepping, handheld drift, rack focus, rain on glass, passing light streaks, cut-paper boil, a page peel, volume-kept squash.
   templates/style-scene and objects/lib/night.js use them; tools/tests/scene-craft.test.mjs proves each one seek-safe (same value in any
   call order and in a fresh process) and in range. Every seeded value comes from mulberry32(seed + index), never Math.random. */
import { clamp, lerp, seg, E, mulberry32, TAU } from '../kit/util.js';

/* stop motion: the time a frame shows when the film is animated "on 2s" (stepFps 15 at 30 fps: each pose held 2 frames). eps keeps a
   frame boundary (n / fps) on its own step, so frame n always samples floor(n * stepFps / fps) / stepFps */
export const stepTime = (t, stepFps = 15) => (stepFps > 0 ? Math.floor(t * stepFps + 1e-6) / stepFps : t);

/* a seeded list of sine partials: sum a_i sin(2 pi f_i t + phi_i), normalised so the peak is about 1 */
export function wobble(seed, freqs = [0.31, 0.53, 0.97, 1.7], amps = [1, 0.6, 0.3, 0.12]) {
  const r = mulberry32(seed >>> 0), ph = freqs.map(() => r() * TAU), norm = amps.reduce((a, b) => a + b, 0) || 1;
  return (t) => freqs.reduce((a, f, i) => a + amps[i] * Math.sin(TAU * f * t + ph[i]), 0) / norm;
}

/* handheld drift: a hand-held camera's slow, uneven breathing in degrees and scene units (documentary). amp scales every axis; a
   'settle' fraction lowers it after an operator finds the frame. -> {az, elev, roll, tx, ty} offsets */
export function handheld(t, { amp = 1, seed = 7, settle = 0 } = {}) {
  const k = amp * (1 - 0.5 * clamp(settle));
  return { az: 0.55 * k * wobble(seed)(t), elev: 0.35 * k * wobble(seed + 1, [0.43, 0.71, 1.3, 2.1])(t), roll: 0.45 * k * wobble(seed + 2, [0.27, 0.61, 1.1, 1.9])(t),
    tx: 0.012 * k * wobble(seed + 3, [0.8, 1.4, 2.6, 3.7], [1, 0.5, 0.25, 0.1])(t), ty: 0.009 * k * wobble(seed + 4, [0.9, 1.6, 2.9, 4.1], [1, 0.5, 0.25, 0.1])(t) };
}

/* rack focus: focus distance pulled from a to b over [t0, t1] with the focus puller's ease (a slight late settle) */
export const rackFocus = (t, a, b, t0, t1) => lerp(a, b, E.soft(seg(t, t0, t1)));

/* rain on a pane of glass w x h (scene units, origin bottom-left): each drop holds still, then slides down in short jerks (a drop on
   glass sticks, gathers, runs). -> [{x, y, r, run}] where run is 0..1 (how fast it is sliding now: the trail length) */
export function rainDrops(t, { n = 90, seed = 11, w = 2, h = 1.4, speed = 0.55, rMin = 0.006, rMax = 0.022 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = mulberry32((seed * 7919 + i * 104729) >>> 0), x = r() * w, rad = lerp(rMin, rMax, r() ** 2), period = 1.4 + r() * 2.6, ph = r() * period, slide = 0.25 + r() * 0.35;
    const cyc = (t + ph) / period, c = Math.floor(cyc), f = cyc - c;               // each cycle: hold, then one run of `slide` of the period
    const runK = clamp((f - (1 - slide)) / slide), dist = speed * period * slide * (c + E.move(runK)) * (0.6 + rad / rMax * 0.8);
    const y = h - ((r() * h + dist) % (h + 0.1));
    out.push({ x, y, r: rad, run: runK > 0 && runK < 1 ? Math.sin(Math.PI * runK) : 0 });
  }
  return out;
}

/* light streaks passing behind the glass (cars on a wet street): -> [{x, y, len, a, hue}] across a span of width w, each streak crossing
   once per period at its own lane height, with a fade in and out at the edges */
export function lightStreaks(t, { n = 6, seed = 23, w = 4, h = 1, period = 3.2, len = 0.7 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = mulberry32((seed * 31 + i * 977) >>> 0), dir = r() < 0.5 ? 1 : -1, p = period * (0.7 + r() * 0.8), ph = r() * p, u = ((t + ph) % p) / p;
    const x = dir > 0 ? lerp(-len, w + len, u) : lerp(w + len, -len, u), edge = Math.min(seg(u, 0, 0.12), 1 - seg(u, 0.88, 1));
    out.push({ x, y: h * (0.15 + 0.7 * r()), len: len * (0.6 + r() * 0.8), a: edge * (0.55 + 0.45 * r()), hue: r() < 0.55 ? 0 : 1, dir });
  }
  return out;
}

/* cut-paper boil: a hand-placed layer is never quite still; it hops on twelves (boilFps) by under px pixels and a fraction of a degree.
   -> [dx, dy, rotDeg] for layer i (the same value for every frame inside one boil step) */
export function paperJitter(t, i = 0, { boilFps = 12, px = 1.5, deg = 0.25, seed = 5 } = {}) {
  const s = Math.floor(t * boilFps + 1e-6), r = mulberry32(((seed + i * 131) * 2654435761 + s * 40503) >>> 0);
  return [(r() * 2 - 1) * px, (r() * 2 - 1) * px, (r() * 2 - 1) * deg];
}

/* a page peel across the frame, as a transition: k in 0..1. 0..0.5: the page unrolls in from the right edge and lies flat over the frame
   at 0.5 (the cut happens under it); 0.5..1: it peels off to the left. For a vertex at (u, v) of the page (0..1 across, 0..1 up) -> [x, y, z]
   in page units (1 = the page width): a cylinder of radius rad rolls along a fold line at `angle`; the paper behind the line lies flat,
   the paper past it wraps half the cylinder and lies back over the flat part (an inextensible curl), lifted by z */
function peelOff(q, u, v, rad, angle) {
  const ca = Math.cos(angle), sa = Math.sin(angle), dmax = ca + sa, d = u * ca + v * sa;
  const line = lerp(dmax + 0.01, -dmax - 0.2 - Math.PI * rad, q), over = d - line;
  if (over <= 0) return [u, v, 0];
  const arc = Math.min(over, Math.PI * rad), th = arc / rad, back = over - arc;
  const dn = line + rad * Math.sin(th) - back, z = rad * (1 - Math.cos(th)) + (back > 0 ? 0.002 : 0);
  return [u + (dn - d) * ca, v + (dn - d) * sa, z];
}
export function peel(k, u, v, { rad = 0.08, angle = 0.35 } = {}) {
  const inPhase = k < 0.5, q = inPhase ? 1 - 2 * clamp(k) : 2 * clamp(k) - 1;
  const [x, y, z] = peelOff(q, inPhase ? 1 - u : u, v, rad, angle);
  return [inPhase ? 1 - x : x, y, z];
}
/* how much of the frame a peel at k covers (0..1, the flat part only): the template cuts the shot when it is 1 */
export function peelCover(k, { rad = 0.08, angle = 0.35 } = {}) {
  let c = 0; const N = 12;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const u = (i + 0.5) / N, v = (j + 0.5) / N, p = peel(k, u, v, { rad, angle }); if (p[2] === 0 && p[0] >= 0 && p[0] <= 1) c++; }
  return c / (N * N);
}

/* squash and stretch that keeps the volume: amount > 0 squashes (sy < 1), < 0 stretches. -> [sxz, sy] */
export const squash = (amount) => { const sy = clamp(1 - amount, 0.4, 1.8); return [1 / Math.sqrt(sy), sy]; };
/* a contact squash after an impact at t0: the spring of a soft body (clay), peak amount, settling over ~0.4 s */
export function impactSquash(t, t0, amount = 0.18, hz = 3.2) {
  if (t < t0) return 0; const a = t - t0, w = TAU * hz;
  return amount * Math.exp(-5.5 * a) * Math.cos(w * a);
}
