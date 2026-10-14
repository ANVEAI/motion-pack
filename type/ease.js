/* motion-pack: house easing set + closed-form helpers. Pure, deterministic. IDENTICAL copy lives in layers/, type/ and camera/ (tests/check-ease-sync asserts it).
   Names and cubic-beziers match the ANVE v8/v9 kit (util.js) bit for bit. */
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const sstep = (a, b, x) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
export function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx, cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 8; i++) { const d = sx(t) - x; if (Math.abs(d) < 1e-6) break; const dd = dsx(t); if (Math.abs(dd) < 1e-6) break; t -= d / dd; } return sy(t); };
}
export const E = { enter: bezier(0.16, 1, 0.3, 1), hero: bezier(0.22, 1, 0.36, 1), exit: bezier(0.7, 0, 0.84, 0), move: bezier(0.65, 0, 0.35, 1), soft: bezier(0.4, 0, 0.2, 1), cam: bezier(0.33, 0, 0.12, 1), pop: bezier(0.34, 1.56, 0.64, 1), lin: (x) => clamp(x),
  sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x)), expoOut: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * clamp(x))), quint: (x) => { x = clamp(x); return x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2; } };
/* beat / cut reactive envelope: for each hit time h: linear rise over `attack` seconds ending ON h, then decay over `decay` seconds. max over hits. 0..1 */
export function env(t, hits, { attack = 1 / 30, decay = 8 / 30, curve = 'exp' } = {}) {
  let m = 0;
  for (const h of hits || []) {
    const dt = t - h; let v = 0;
    if (dt < -attack || dt > decay) continue;
    if (dt <= 0) v = (dt + attack) / attack; else { const k = dt / decay; v = curve === 'exp' ? Math.exp(-4 * k) * (1 - k) : curve === 'lin' ? 1 - k : 1 - E.soft(k); }
    if (v > m) m = v;
  }
  return m;
}
/* in / hold / out window, eased */
export function windowEnv(t, t0, tin, thold, tout, ease = E.soft) { if (t < t0) return 0; const a = t - t0; if (a < tin) return ease(a / tin); if (a < tin + thold) return 1; if (a < tin + thold + tout) return 1 - ease((a - tin - thold) / tout); return 0; }
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* closed-form band-limited noise from a seed: sum of sines with seeded phases; deterministic from t alone. freqs in Hz, amps relative */
export function sines(seed, freqs, amps) { const r = mulberry32(seed), ph = freqs.map(() => r() * TAU); const s = amps.reduce((a, b) => a + b * b, 0) ** 0.5 || 1; return (t) => freqs.reduce((a, f, i) => a + amps[i] * Math.sin(TAU * f * t + ph[i]), 0) / s; }
/* closed-form springs (2026-10-14). spring(tau, cls) = unit step response of a damped spring released at tau = 0 (0 before, -> 1 after; value AND slope are 0 at tau = 0).
   springTrack(t, changes, cls): v(t) = v0 + sum_i (v_i - v_{i-1}) * spring(t - t_i). changes = [{ t, v }] or [[t, v]] in time order; changes[0].v is the start value v0
   (its t is ignored). v may be a number or an array (element-wise). A retarget mid-flight keeps the motion running: no jump, no re-trigger. Pure: same t -> same value in any order.
   Motion classes (zeta = damping ratio, f = natural frequency Hz): ui snappy + ~1% overshoot, panel settles (~0.2%), camera glides (critically damped, never overshoots),
   headline lands hard (~9%), mascot bounces (~31%). Pass { zeta, f } for a custom class. */
export const SPRING = { ui: { zeta: 0.82, f: 3.2 }, panel: { zeta: 0.9, f: 1.6 }, camera: { zeta: 1, f: 0.9 }, headline: { zeta: 0.6, f: 4 }, mascot: { zeta: 0.35, f: 2.2 } };
export function spring(tau, cls = 'ui') {
  if (!(tau > 0)) return 0; const { zeta: z, f } = typeof cls === 'string' ? SPRING[cls] || SPRING.ui : cls, w = TAU * f;
  if (z >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);   // critically damped (z > 1 is treated as 1: never overshoots)
  const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
/* settle time: first tau after which |1 - spring| stays below eps (closed-form envelope bound, conservative) */
export function springSettle(cls = 'ui', eps = 0.01) { const { zeta: z, f } = typeof cls === 'string' ? SPRING[cls] || SPRING.ui : cls, w = TAU * f; if (z >= 1) { let tau = 0; while (Math.exp(-w * tau) * (1 + w * tau) > eps) tau += 1e-3; return tau; } return Math.log(1 / (eps * Math.sqrt(1 - z * z))) / (z * w); }
export function springTrack(t, changes, cls = 'ui') {
  const ch = (changes || []).map((c) => (Array.isArray(c) && c.length === 2 && !Array.isArray(c[0]) && typeof c[0] === 'number' && (typeof c[1] === 'number' || Array.isArray(c[1])) ? { t: c[0], v: c[1] } : c));
  if (!ch.length) return 0; const v0 = ch[0].v, arr = Array.isArray(v0); let v = arr ? [...v0] : v0;
  for (let i = 1; i < ch.length; i++) { const k = spring(t - ch[i].t, cls); if (!k) continue; const a = ch[i - 1].v, b = ch[i].v; if (arr) for (let j = 0; j < v.length; j++) v[j] += (b[j] - a[j]) * k; else v += (b - a) * k; }
  return v;
}
