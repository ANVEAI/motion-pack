/* motion-pack/objects/kit: extracted unchanged from ANVE's v9 launch-film studio kit (kit/util.js) on 2026-10-13; this copy is the one to edit. */
/* ANVE v9 studio kit: pure helpers (no three.js). Everything here is a function of its arguments: no Date, no Math.random. */
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const sstep = (a, b, x) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
export const sstep5 = (a, b, x) => { const t = seg(x, a, b); return t * t * t * (t * (t * 6 - 15) + 10); };
export const rad = (d) => (d * Math.PI) / 180;
export const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/* the v8 motion language (assets/kit/motion.js M.E), bit-identical cubic beziers */
export function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx, cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x; for (let i = 0; i < 8; i++) { const d = sx(t) - x; if (Math.abs(d) < 1e-6) break; const dd = dsx(t); if (Math.abs(dd) < 1e-6) break; t -= d / dd; }
    return sy(t);
  };
}
export const E = {
  enter: bezier(0.16, 1, 0.3, 1), exit: bezier(0.7, 0, 0.84, 0), move: bezier(0.65, 0, 0.35, 1),
  soft: bezier(0.4, 0, 0.2, 1), cam: bezier(0.33, 0, 0.12, 1), pop: bezier(0.34, 1.56, 0.64, 1), lin: (x) => clamp(x),
};
/* eased window: 0 before a, E.enter up over din, hold, E.exit down over dout before b */
export function win(t, a, b, din = 0.3, dout = 0.2) { if (t < a || t >= b) return 0; return Math.min(E.enter(seg(t, a, a + din)), 1 - E.exit(seg(t, b - dout, b))); }

export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* damped spring, closed form. springU: residual of a unit step (1 at tau = 0, -> 0, overshoots below 0 when zeta < 1).
   springKick: response to a unit velocity kick, normalised so its first peak is 1 (0 at tau = 0). zeta = damping ratio, hz = natural freq. */
export function springU(tau, zeta, hz) {
  if (tau <= 0) return 1;
  const w = TAU * hz, wd = w * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  return Math.exp(-zeta * w * tau) * (Math.cos(wd * tau) + ((zeta * w) / wd) * Math.sin(wd * tau));
}
export function springKick(tau, zeta, hz) {
  if (tau <= 0) return 0;
  const w = TAU * hz, wd = w * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta)), tp = Math.atan2(wd, zeta * w) / wd;
  const peak = Math.exp(-zeta * w * tp) * Math.sin(wd * tp);
  return (Math.exp(-zeta * w * tau) * Math.sin(wd * tau)) / peak;
}
/* the reference light click: 3-frame flicker then on, quantised to the OUTPUT frame n (never smeared across subframes) */
export const FLICKER = [0.95, 0.12, 0.7];
export const clickLevel = (n, f0, seq = FLICKER) => (n < f0 ? 0 : n - f0 < seq.length ? seq[n - f0] : 1);

/* Kelvin -> linear sRGB on the Planckian locus (Kim et al.), luminance-normalised */
export function kelvin(T) {
  let x, y;
  if (T < 4000) x = -0.2661239e9 / T ** 3 - 0.2343589e6 / T ** 2 + 0.8776956e3 / T + 0.17991; else x = -3.0258469e9 / T ** 3 + 2.1070379e6 / T ** 2 + 0.2226347e3 / T + 0.24039;
  if (T < 2222) y = -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683; else if (T < 4000) y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867; else y = 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  const X = x / y, Z = (1 - x - y) / y;
  const r = Math.max(0, 3.2404542 * X - 1.5371385 - 0.4985314 * Z), g = Math.max(0, -0.969266 * X + 1.8760108 + 0.041556 * Z), b = Math.max(0, 0.0556434 * X - 0.2040259 + 1.0572252 * Z), L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / L, g / L, b / L];
}
export const hex2lin = (h) => { const c = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return [c(parseInt(h.slice(1, 3), 16)), c(parseInt(h.slice(3, 5), 16)), c(parseInt(h.slice(5, 7), 16))]; };
export const hexMix = (a, b, k) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(lerp(v, y[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };

/* curves */
export const quadB = (p0, c, p1, t) => { const u = 1 - t; return [0, 1, 2].map((i) => u * u * p0[i] + 2 * u * t * c[i] + t * t * p1[i]); };
export const quadBd = (p0, c, p1, t) => [0, 1, 2].map((i) => 2 * (1 - t) * (c[i] - p0[i]) + 2 * t * (p1[i] - c[i]));
export const v3add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const v3len = (a) => Math.hypot(a[0], a[1], a[2]);
export const v3norm = (a) => { const l = v3len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* smooth-min (polynomial, k = blend width): the liquid-chrome operator */
export const smin = (a, b, k) => { if (k <= 1e-6) return Math.min(a, b); const h = clamp(0.5 + (0.5 * (b - a)) / k); return lerp(b, a, h) - k * h * (1 - h); };
