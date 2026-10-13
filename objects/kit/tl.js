/* motion-pack/objects/kit: extracted from ANVE's v10 launch-film set (src/tl.js) on 2026-10-13 (import path changed to ./util.js). */
/* v10 set: timeline helpers. A TRACK is a number, a function t -> value, or keys [[t, value, ease?], ...] (value may be a number or an
   array; ease names the curve INTO that key: 'cam' (default for camera), 'soft', 'move', 'enter', 'exit', 'lin', 'step').
   An EVENT LIST is an array of times in seconds (story time). Everything is a pure function of t. */
import { E, clamp, lerp } from './util.js';

export const EASE = { cam: E.cam, soft: E.soft, move: E.move, enter: E.enter, exit: E.exit, lin: (x) => clamp(x), step: (x) => (x >= 1 ? 1 : 0), pop: E.pop };
const mix = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k));

/* keys: [[t, v, ease], ...] sorted by t. Before the first key: its value; after the last: its value. */
export function keys(K, t, defEase = 'soft') {
  if (!K.length) return undefined;
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) {
    if (t < K[i][0]) { const [t0, v0] = K[i - 1], [t1, v1, e] = K[i]; return mix(v0, v1, EASE[e || defEase]((t - t0) / (t1 - t0))); }
  }
  return K[K.length - 1][1];
}
export function track(spec, t, def = 0, defEase = 'soft') {
  if (spec === undefined || spec === null) return def;
  if (typeof spec === 'function') return spec(t);
  if (Array.isArray(spec) && Array.isArray(spec[0])) return keys(spec, t, defEase);
  return spec;
}
/* events */
export const passed = (list, t) => (list || []).filter((x) => x <= t).length;
export const ev = (list) => (list || []).slice().sort((a, b) => a - b);
export const has = (x) => typeof x === 'number' && isFinite(x);
export const NEVER = 1e9;
export const at = (x) => (has(x) ? x : NEVER);
