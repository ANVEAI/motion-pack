/* motion-pack / transitions / lib / tx-core.js
   Pure helpers shared by every transition back-end (GL, DOM, three.js, HyperFrames).
   Nothing here reads a clock, the DOM or an unseeded RNG: every function is a pure function of its arguments,
   so a frame can be rendered from t alone (seek-safe). */

// ---------- eases (named, deterministic) ----------
function bezier(x1, y1, x2, y2) {
  // CSS cubic-bezier: solve x(s) = x by Newton then bisection, return y(s). Pure and bit-stable.
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) { const e = X(s) - x, d = dX(s); if (Math.abs(e) < 1e-7) return Y(s); if (Math.abs(d) < 1e-6) break; s -= e / d; }
    let lo = 0, hi = 1; s = x;
    for (let i = 0; i < 40; i++) { const v = X(s); if (Math.abs(v - x) < 1e-7) break; if (v < x) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
}
const c01 = x => Math.min(1, Math.max(0, x));
export const EASES = {
  linear: x => c01(x),
  inQuad: x => c01(x) ** 2,
  outQuad: x => 1 - (1 - c01(x)) ** 2,
  inOutQuad: x => (x = c01(x), x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: x => c01(x) ** 3,
  outCubic: x => 1 - (1 - c01(x)) ** 3,
  inOutCubic: x => (x = c01(x), x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inExpo: x => (x = c01(x), x === 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: x => (x = c01(x), x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: x => (x = c01(x), x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: x => { x = c01(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; },
  whip: bezier(0.7, 0, 0.3, 1),        // edit.md 2.4: fast middle, the seam hides in the blur peak
  push: bezier(0.2, 0.8, 0.2, 1),      // edit.md 2.16: decisive start, soft landing
  swipe: bezier(0.32, 0.72, 0, 1),     // social swipe-up card: quick, long settle
};
export function ease(name, x) {
  if (typeof name === 'function') return name(x);
  if (Array.isArray(name)) return bezier(...name)(x);
  const f = EASES[name || 'linear']; if (!f) throw new Error('unknown ease ' + name); return f(x);
}
export { bezier };

// ---------- beat grid ----------
/** BPM snapped so that one beat is a whole number of frames (sound.md section 8). */
export const snapBpm = (bpm, fps) => fps * 60 / Math.max(1, Math.round(fps * 60 / bpm));
export const beatFrames = (bpm, fps) => fps * 60 / bpm;
/** Frame of beat k (0-based) with an optional offset in seconds; rounding is to the nearest frame. */
export const beatToFrame = (k, bpm, fps, offset_s = 0) => Math.round((offset_s + k * 60 / bpm) * fps);

/** Transition window on a beat grid. The swap (cut point) lands exactly on `cutFrame`.
    entry = registry entry (needs .timing {ms, beats, cut}); opts {fps, bpm?, cutFrame, durationFrames?}.
    Returns integer frames: {start, cut, end, frames, ms}. With bpm the length is `beats` beats, else `ms`. */
export function txWindow(entry, { fps = 30, bpm = null, cutFrame = 0, durationFrames = null } = {}) {
  const tm = entry.timing;
  let n = durationFrames ?? (bpm ? Math.round(tm.beats * 60 / bpm * fps) : Math.round(tm.ms / 1000 * fps));
  n = Math.max(tm.minFrames || 2, n);
  const pre = Math.round(tm.cut * n);
  const start = cutFrame - pre;
  return { start, cut: cutFrame, end: start + n, frames: n, ms: Math.round(n / fps * 1000) };
}
/** Progress p in [0,1] of a window at frame f (sub-frame safe: pass fractional frames for supersampling). */
export const progressAt = (win, f) => c01((f - win.start) / win.frames);

// ---------- speed ramp (retime curve) ----------
/** Speed-ramp keys [{t (s, relative to the anchor), rate}] -> monotonic timeMap(tOut) -> tSource.
    Rate is eased (inOutCubic by default) between keys; the integral is evaluated in closed form per segment
    with a fixed 64-step Simpson rule, so the map is exact-enough, monotonic and deterministic. */
export function speedRamp(keys, { anchor = 0, easeName = 'inOutCubic', steps = 64 } = {}) {
  const K = keys.map(k => ({ t: anchor + k.t, rate: k.rate })).sort((a, b) => a.t - b.t);
  const rateAt = t => {
    if (t <= K[0].t) return K[0].rate;
    if (t >= K[K.length - 1].t) return K[K.length - 1].rate;
    let i = 0; while (t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1], u = ease(easeName, (t - a.t) / (b.t - a.t));
    return a.rate + (b.rate - a.rate) * u;
  };
  const integ = (t0, t1) => {           // Simpson over [t0,t1]
    if (t1 <= t0) return 0; const h = (t1 - t0) / steps; let s = rateAt(t0) + rateAt(t1);
    for (let i = 1; i < steps; i++) s += (i % 2 ? 4 : 2) * rateAt(t0 + i * h);
    return s * h / 3;
  };
  // cumulative source time at each key, so map(t) is O(steps) not O(t)
  const cum = [0]; for (let i = 1; i < K.length; i++) cum.push(cum[i - 1] + integ(K[i - 1].t, K[i].t));
  const map = t => {
    if (t <= K[0].t) return K[0].t + (t - K[0].t) * K[0].rate;
    if (t >= K[K.length - 1].t) return K[0].t + cum[K.length - 1] + (t - K[K.length - 1].t) * K[K.length - 1].rate;
    let i = 0; while (t > K[i + 1].t) i++;
    return K[0].t + cum[i] + integ(K[i].t, t);
  };
  return { map, rateAt, keys: K };
}
/** House default ramp (edit.md 2.15): normal -> 0.3x on the hit -> hold -> 1.5x catch-up -> normal. */
export const RAMP_HIT = [{ t: -0.25, rate: 1 }, { t: 0, rate: 0.3 }, { t: 0.15, rate: 0.3 }, { t: 0.25, rate: 1.5 }, { t: 0.55, rate: 1 }];
export const RAMP_PRESETS = {
  hit: RAMP_HIT,
  bulletTime: [{ t: -0.3, rate: 1 }, { t: 0, rate: 0.12 }, { t: 0.6, rate: 0.12 }, { t: 0.9, rate: 1 }],
  rushIn: [{ t: -0.6, rate: 1 }, { t: -0.2, rate: 2.5 }, { t: 0, rate: 0.4 }, { t: 0.3, rate: 1 }],
  stutterStop: [{ t: -0.2, rate: 1 }, { t: 0, rate: 0.0 }, { t: 0.2, rate: 0.0 }, { t: 0.35, rate: 1.8 }, { t: 0.6, rate: 1 }],
  // 2026-10-13 (cuts/retime.json mirrors these): ease into slow motion / out of it / the hero ramp (fast-slow-fast) / a freeze stamp
  rampIn: [{ t: -0.5, rate: 1 }, { t: 0, rate: 0.25 }, { t: 1.0, rate: 0.25 }],
  rampOut: [{ t: -0.6, rate: 0.25 }, { t: 0, rate: 0.25 }, { t: 0.35, rate: 1 }],
  heroRamp: [{ t: -0.5, rate: 2 }, { t: -0.1, rate: 2 }, { t: 0, rate: 0.2 }, { t: 0.5, rate: 0.2 }, { t: 0.8, rate: 2 }, { t: 1.1, rate: 1 }],
  freezeStamp: [{ t: -0.1, rate: 1 }, { t: 0, rate: 0 }, { t: 0.8, rate: 0 }, { t: 0.85, rate: 1 }],
};

// ---------- match-cut helper ----------
/** Anchors are {x, y, scale, rot} in normalised frame coords (x,y in 0..1, top-left origin; scale = object size
    as a fraction of frame height; rot in radians). Returns the similarity transform of each shot at progress p so
    the two anchors coincide on the cut frame: A moves from identity to the meeting pose over the final `lead`
    fraction before the cut, B moves from the meeting pose to identity over `settle` after it.
    Meeting pose = midpoint position, geometric-mean scale, mean rotation (or B's pose with meet:'B'). */
export function matchPose(a, b, p, { cut = 0.5, lead = 1, settle = 1, meet = 'mid', easeIn = 'inCubic', easeOut = 'outCubic' } = {}) {
  const M = meet === 'B' ? { ...b } : meet === 'A' ? { ...a } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, scale: Math.sqrt(a.scale * b.scale), rot: (a.rot + b.rot) / 2 };
  const lerp = (u, v, s) => u + (v - u) * s;
  if (p < cut) {
    const s = ease(easeIn, c01((p / cut - (1 - lead)) / lead));
    return { shot: 'A', anchor: a, at: { x: lerp(a.x, M.x, s), y: lerp(a.y, M.y, s) }, k: Math.exp(lerp(0, Math.log(M.scale / a.scale), s)), rot: lerp(0, M.rot - a.rot, s) };
  }
  const s = ease(easeOut, c01(((p - cut) / (1 - cut)) / settle));
  return { shot: 'B', anchor: b, at: { x: lerp(M.x, b.x, s), y: lerp(M.y, b.y, s) }, k: Math.exp(lerp(Math.log(M.scale / b.scale), 0, s)), rot: lerp(M.rot - b.rot, 0, s) };
}
/** The same pose as a CSS transform for a full-frame layer of size W x H (transform-origin 0 0). */
export function poseToCss(pose, W, H) {
  const { anchor: a, at, k, rot } = pose, c = Math.cos(rot), s = Math.sin(rot);
  // out = at + k R (src - a)  (in pixels)
  const ax = a.x * W, ay = a.y * H, tx = at.x * W - k * (c * ax - s * ay), ty = at.y * H - k * (s * ax + c * ay);
  return `matrix(${k * c},${k * s},${-k * s},${k * c},${tx},${ty})`;
}
/** Lint helper for match cuts: how far apart (fraction of frame height) the anchors are with no camera help. */
export const matchDistance = (a, b, aspect = 16 / 9) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

// ---------- misc ----------
export const hexToRgb = h => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const bell = (p, c = 0.5) => p < c ? Math.sin(Math.PI / 2 * p / c) ** 2 : Math.sin(Math.PI / 2 * (1 - p) / (1 - c)) ** 2;
/** Merge user params over the registry defaults (unknown keys are rejected so typos are caught early). */
export function resolveParams(entry, params = {}) {
  const out = {};
  for (const [k, spec] of Object.entries(entry.params)) out[k] = spec.default;
  for (const [k, v] of Object.entries(params)) { if (!(k in entry.params)) throw new Error(`${entry.id}: unknown param '${k}'`); out[k] = v; }
  return out;
}
