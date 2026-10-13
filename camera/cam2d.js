/* motion-pack / camera / cam2d.js: deterministic 2D camera moves for HyperFrames / HTML compositions (a wrapper element, e.g. #world, gets the transform).
   State: { x, y, scale, rot, blur, blurAngle, origin:[ox,oy] }   x, y in units of frame HEIGHT (resolution independent), rot in degrees, blur = streak length in px at 1080p (180 deg shutter),
   origin = transform-origin as fractions of W,H (default centre; punch-ins re-centre on the face box).
   Presets are MODIFIERS: preset(base, params) -> (t) => state; they nest exactly like cam3d:  handheld2d(punchIn2d(ID2, {...}), {level:'doc'}).
   Pure functions of t. Same names as cam3d where the move exists in both (pushIn/pullOut/whipPan/handheld/dutch/breathe/beatPunch/lock/sequence).                              */
import { E, lerp, clamp, seg, env, sines, TAU } from './ease.js';

export const ID2 = Object.freeze({ x: 0, y: 0, scale: 1, rot: 0, blur: 0, blurAngle: 0, origin: [0.5, 0.5] });
export const asFn2 = (b) => (typeof b === 'function' ? b : () => b);
export const c2 = (s) => ({ ...ID2, ...s, origin: [...(s.origin || [0.5, 0.5])] });
const ease = (e) => (typeof e === 'function' ? e : E[e] || E.soft), win = (t, at, dur, e) => ease(e)(seg(t, at, at + dur));

export const push2d = (base, { at = 0, dur = 1.2, to = 1.12, ease: e = 'hero', origin } = {}) => (t) => { const s = c2(asFn2(base)(t)); s.scale *= lerp(1, to, win(t, at, dur, e)); if (origin) s.origin = origin; return s; };
export const pull2d = (base, { at = 0, dur = 1.6, from = 1.15, ease: e = 'move' } = {}) => (t) => { const s = c2(asFn2(base)(t)); s.scale *= lerp(from, 1, win(t, at, dur, e)); return s; };
/* pan: dx, dy in frame-height units */
export const pan2d = (base, { at = 0, dur = 2, dx = 0.1, dy = 0, ease: e = 'cam' } = {}) => (t) => { const s = c2(asFn2(base)(t)), k = win(t, at, dur, e); s.x += dx * k; s.y += dy * k; return s; };
/* whip: 7-frame sweep (quint). mode 'out' = 0 -> dx, 'in' = -dx -> 0. Directional motion blur = speed * 180 deg shutter (0.5 / fps) in px at 1080p. Cut at whipMid2. */
export const whip2d = (base, { at = 0, dur = 7 / 30, dx = 1.2, mode = 'out', rollDeg = 1.5, fps = 30 } = {}) => (t) => {
  const s = c2(asFn2(base)(t)), u = seg(t, at, at + dur), k = E.quint(u), h = 1e-3, k2 = E.quint(seg(t + h, at, at + dur)), k1 = E.quint(seg(t - h, at, at + dur));
  s.x += mode === 'out' ? dx * k : -dx * (1 - k); s.rot += rollDeg * Math.sin(Math.PI * u) * Math.sign(dx);
  const vel = Math.abs((k2 - k1) / (2 * h)) * Math.abs(dx) * 1080; s.blur = Math.max(s.blur, vel * 0.5 / fps); s.blurAngle = 0; return s; };
export const whipMid2 = (at, dur = 7 / 30) => at + dur / 2;
/* handheld: px amplitudes at 1080p (levels doc 1 / action 2.5 / subtle 0.4), closed-form seeded sines, band 0.37-1.31 Hz + 7-9 Hz micro, roll +-0.25 deg */
export const handheld2d = (base, { level = 'doc', seed = 1, rollOn = true } = {}) => {
  const L = typeof level === 'number' ? level : ({ subtle: 0.4, doc: 1, action: 2.5 })[level], slow = [0.37, 0.83, 1.31], micro = [7.1, 9.3];
  const nx = sines(seed * 17 + 1, slow, [1, 1.27, 0.79]), ny = sines(seed * 17 + 2, slow, [1, 1.27, 0.79]), mx = sines(seed * 17 + 3, micro, [1, 0.8]), my = sines(seed * 17 + 4, micro, [1, 0.8]), nr = sines(seed * 17 + 5, slow, [1, 0.6, 0.4]), mr = sines(seed * 17 + 6, micro, [1, 0.8]);
  return (t) => { const s = c2(asFn2(base)(t)); s.x += L * (5 * nx(t) + 0.8 * mx(t)) / 1080; s.y += L * (5 * ny(t) + 0.8 * my(t)) / 1080; if (rollOn) s.rot += L * (0.25 * nr(t) + 0.04 * mr(t)); s.scale *= 1 + 0.014 * L; return s; };   // +1.4% scale hides the edges
};
/* talking-head retention: scale steps at sentence boundaries. boundaries: seconds; scales cycle (default 1.00 / 1.08 / 1.00 / 1.15 ...); never two identical framings in a row;
   each step is a 6-frame ease-out-expo punch (`snap:true` makes it an instant jump cut); origins (face box centres) cycle too. */
export const punchCadence = (base, { boundaries = [], scales = [1.0, 1.08, 1.0, 1.15], origins = null, durFrames = 6, snap = false, fps = 30 } = {}) => (t) => {
  const s = c2(asFn2(base)(t)); let i = -1; for (let j = 0; j < boundaries.length; j++) if (t >= boundaries[j]) i = j; const cur = scales[(i + 1) % scales.length] , prev = i < 0 ? cur : scales[i % scales.length];
  const k = i < 0 || snap ? 1 : E.expoOut(seg(t, boundaries[i], boundaries[i] + durFrames / fps)); s.scale *= lerp(prev, cur, k);
  if (origins) { const o = origins[(i + 1) % origins.length]; s.origin = [o[0], o[1]]; } return s; };
/* single punch-in (6 f ease-out expo) at time `at`, optional return at `returnAt` */
export const punchIn2d = (base, { at = 0, to = 1.12, durFrames = 6, returnAt = null, origin = null, fps = 30 } = {}) => (t) => { const s = c2(asFn2(base)(t)); let k = E.expoOut(seg(t, at, at + durFrames / fps)); if (returnAt != null && t >= returnAt) k = 0; s.scale *= lerp(1, to, k); if (origin) s.origin = origin; return s; };
export const beatPunch2d = (base, { hits = [], amount = 0.035, attack = 1 / 30, decay = 8 / 30 } = {}) => (t) => { const s = c2(asFn2(base)(t)); s.scale *= 1 + amount * env(t, hits, { attack, decay }); return s; };
export const kenBurns = (base, { at = 0, dur = 4, from = 1.0, to = 1.08, drift = [0.02, -0.01], ease: e = 'sine' } = {}) => (t) => { const s = c2(asFn2(base)(t)), k = win(t, at, dur, e); s.scale *= lerp(from, to, k); s.x += drift[0] * k; s.y += drift[1] * k; return s; };
export const dutch2d = (base, { at = 0, dur = 20 / 30, deg = 6 } = {}) => (t) => { const s = c2(asFn2(base)(t)); s.rot += deg * win(t, at, dur, 'soft'); return s; };
export const breathe2d = (base, { amp = 0.012, period = 4 } = {}) => (t) => { const s = c2(asFn2(base)(t)); s.scale *= 1 + amp * 0.5 * (1 - Math.cos(TAU * t / period)); return s; };
export const shake2d = (base, { hits = [], px = 10, rotDeg = 0.6, decay = 4 / 30, seed = 1 } = {}) => { const nx = sines(seed * 31 + 1, [17, 23], [1, 0.7]), ny = sines(seed * 31 + 2, [19, 29], [1, 0.7]), nr = sines(seed * 31 + 3, [13, 21], [1, 0.7]);
  return (t) => { const s = c2(asFn2(base)(t)), e = env(t, hits, { attack: 0.2 / 30, decay, curve: 'exp' }); s.x += px * e * nx(t) / 1080; s.y += px * e * ny(t) / 1080; s.rot += rotDeg * e * nr(t); return s; }; };
export const lock2d = (base, windows = []) => { const f = asFn2(base); return (t) => { for (const [a, b] of windows) if (t >= a && t < b) return c2(f(a)); return f(t); }; };
export const sequence2d = (segs) => (t) => { let i = 0; for (let j = 0; j < segs.length; j++) if (t >= segs[j][0]) i = j; return c2(asFn2(segs[i][1])(t)); };

/* output helpers ---------------------------------------------------------------------------------------------------------------------------- */
/* minimum scale so a rotated + translated + scaled frame still covers the viewport (no empty edges). exact: inverse-map the four corners. */
export function coverScale(rotDeg, tx, ty, W, H) {
  const a = (rotDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); let m = 1;
  for (const [cx, cy] of [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]) { const px = cx - tx, py = cy - ty, u = c * px + s * py, v = -s * px + c * py; m = Math.max(m, Math.abs(u) / (W / 2), Math.abs(v) / (H / 2)); }
  return m;
}
/* CSS for a wrapper: transform + transform-origin (+ isotropic blur fallback). cover: true scales up just enough to hide edges. */
export function toCSS(st, { W = 1920, H = 1080, cover = false } = {}) {
  const s = c2(st), tx = s.x * H, ty = s.y * H; let sc = s.scale; if (cover) sc = Math.max(sc, coverScale(s.rot, tx, ty, W, H));
  return { transform: `translate(${tx.toFixed(3)}px, ${ty.toFixed(3)}px) rotate(${s.rot.toFixed(4)}deg) scale(${sc.toFixed(5)})`, transformOrigin: `${(s.origin[0] * 100).toFixed(3)}% ${(s.origin[1] * 100).toFixed(3)}%`, filter: s.blur > 0.5 ? `blur(${(s.blur * H / 1080 * 0.25).toFixed(2)}px)` : 'none' };
}
/* gsap vars (x, y, scale, rotation, transformOrigin) for tl.set / gsap.set */
export function toGSAP(st, { W = 1920, H = 1080, cover = false } = {}) {
  const s = c2(st), tx = s.x * H, ty = s.y * H; let sc = s.scale; if (cover) sc = Math.max(sc, coverScale(s.rot, tx, ty, W, H));
  return { x: +tx.toFixed(3), y: +ty.toFixed(3), scale: +sc.toFixed(5), rotation: +s.rot.toFixed(4), transformOrigin: `${(s.origin[0] * 100).toFixed(3)}% ${(s.origin[1] * 100).toFixed(3)}%` };
}
/* SVG motion-blur filter: horizontal-or-angled streak. markup + the stdDeviation attribute value for a given state ("bx by"). */
export const blurFilterSVG = (id = 'mp-streak') => `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur id="${id}-b" stdDeviation="0 0"/></filter>`;
export const blurStd = (st, H = 1080) => { const b = (st.blur || 0) * (H / 1080) * 0.3, a = ((st.blurAngle || 0) * Math.PI) / 180; return `${Math.abs(b * Math.cos(a)).toFixed(2)} ${Math.abs(b * Math.sin(a)).toFixed(2)}`; };
/* lint: scale-up punch-ins must be >= minGapSec apart (edit rule: at most one per 4 s); returns { onsets:[t...], violations:[{t,gap,msg}] } */
export function lintPunchCadence(cam, duration, { fps = 30, minGapSec = 4, minStep = 0.03, windowFrames = 8 } = {}) {
  const onsets = [], violations = []; let rising = false;
  for (let t = 0; t < duration; t += 1 / fps) { const up = cam(t + windowFrames / fps).scale - cam(t).scale >= minStep; if (up && !rising) { let t0 = t; while (t0 < t + windowFrames / fps && cam(t0 + 1 / fps).scale - cam(t0).scale < 1e-3) t0 += 1 / fps; const T = t0; if (onsets.length && T - onsets[onsets.length - 1] < minGapSec) violations.push({ t: +T.toFixed(2), gap: +(T - onsets[onsets.length - 1]).toFixed(2), msg: `punch-in ${(T - onsets[onsets.length - 1]).toFixed(1)} s after the previous one (min ${minGapSec} s)` }); onsets.push(+T.toFixed(3)); } rising = up; }
  return { onsets, violations };
}

/* 2026-10-13 expansion -------------------------------------------------------------------------------------------------------------------- */
/* crash zoom: 4-frame slam to `to` (expo) with a decaying 2-frame overshoot and a small shake; returnAt snaps back (6 f) */
export const crashZoom = (base, { at = 0, to = 1.6, frames = 4, overshoot = 0.06, shakePx = 6, returnAt = null, origin = null, fps = 30, seed = 3 } = {}) => { const nx = sines(seed * 41 + 1, [19, 27], [1, 0.6]), ny = sines(seed * 41 + 2, [23, 31], [1, 0.6]);
  return (t) => { const s = c2(asFn2(base)(t)), u = t - at; if (u < 0) return s; let k = E.expoOut(seg(u, 0, frames / fps)); const os = overshoot * Math.exp(-u * 10) * Math.sin(Math.min(u * fps / frames, 3) * Math.PI) * (u > frames / fps ? 1 : 0);
    if (returnAt != null && t >= returnAt) k = 1 - E.expoOut(seg(t, returnAt, returnAt + 6 / fps)); s.scale *= lerp(1, to, k) * (1 + os * k); const sh = Math.exp(-u * 12) * shakePx * k / 1080; s.x += sh * nx(t); s.y += sh * ny(t);
    if (origin) s.origin = origin; const v = Math.abs(lerp(1, to, E.expoOut(seg(u + 1e-3, 0, frames / fps))) - lerp(1, to, E.expoOut(seg(u - 1e-3, 0, frames / fps)))) / 2e-3; s.blur = Math.max(s.blur, v * 40 / fps); return s; }; };
/* double take (comedy): punch in, pull back, then a harder punch in. beats: [first, back, second] offsets in seconds */
export const doubleTake = (base, { at = 0, beats = [0, 0.35, 0.7], to = [1.12, 1.0, 1.3], frames = 5, origin = null, fps = 30 } = {}) => (t) => { const s = c2(asFn2(base)(t)); let cur = 1;
  for (let i = 0; i < beats.length; i++) { const t0 = at + beats[i]; if (t >= t0) { const prev = i ? to[i - 1] : 1; cur = lerp(prev, to[i], E.expoOut(seg(t, t0, t0 + frames / fps))); } }
  s.scale *= cur; if (origin) s.origin = origin; return s; };
/* dolly snap: slow push (creep) that SNAPS to a tighter frame on the beat `snapAt` (6 f expo); good for a reveal line */
export const dollySnap = (base, { at = 0, snapAt = 2, creepTo = 1.06, snapTo = 1.22, frames = 6, origin = null, fps = 30 } = {}) => (t) => { const s = c2(asFn2(base)(t));
  const creep = lerp(1, creepTo, E.sine(seg(t, at, snapAt))), snap = t >= snapAt ? lerp(creepTo, snapTo, E.expoOut(seg(t, snapAt, snapAt + frames / fps))) : creep; s.scale *= t >= snapAt ? snap : creep; if (origin) s.origin = origin; return s; };
/* 2D rack focus for layered shots: adds s.dof = { fg, bg } blur in px @1080 (apply as CSS blur on the fg / bg layers); from 'fg' -> 'bg' swaps sharpness */
export const rackFocus2D = (base, { at = 0, dur = 0.8, from = 'fg', maxBlur = 10, breathing = 0.015 } = {}) => (t) => { const s = c2(asFn2(base)(t)), k = E.soft(seg(t, at, at + dur)), toBg = from === 'fg';
  const fgB = maxBlur * (toBg ? k : 1 - k), bgB = maxBlur * (toBg ? 1 - k : k); s.dof = { fg: +fgB.toFixed(3), bg: +bgB.toFixed(3) }; s.scale *= 1 + breathing * (toBg ? k : 1 - k); return s; };
/* Dutch roll: animated roll into a tilt with overshoot (pop), optional slow sway; presets: unease 6 deg, comedy 12 deg, thriller 9 deg + sway */
export const DUTCH_PRESETS = { unease: { deg: 6, sway: 0 }, comedy: { deg: 12, sway: 0 }, thriller: { deg: 9, sway: 1.2 }, drunk: { deg: 4, sway: 4 } };
export const dutchRoll = (base, { at = 0, dur = 14 / 30, deg = 6, sway = 0, period = 3.5, preset = null, aspect = 16 / 9 } = {}) => { const P = preset ? { deg, sway, ...DUTCH_PRESETS[preset] } : { deg, sway };
  return (t) => { const s = c2(asFn2(base)(t)), k = E.pop(seg(t, at, at + dur)); s.rot += P.deg * k + P.sway * Math.sin(TAU * (t - at) / period) * seg(t, at, at + dur); s.scale *= coverScale(s.rot, 0, 0, aspect, 1); return s; }; };   // exact cover: no empty corners at any roll
/* 2.5D parallax stack: one camera state -> per-layer CSS for N depth layers (0 = locked background, 1 = moves with the camera, >1 = foreground).
   const L = parallaxStack(cam, [0.2, 0.6, 1, 1.4]); L(t) -> [{ transform, transformOrigin }, ...] */
export const parallaxStack = (cam, depths, { W = 1920, H = 1080 } = {}) => (t) => { const s = c2(asFn2(cam)(t));
  return depths.map((d) => toCSS({ ...s, x: s.x * d, y: s.y * d, scale: 1 + (s.scale - 1) * d, rot: s.rot * Math.min(1, d), blur: 0 }, { W, H, cover: d < 1 })); };

export const PRESETS_2D = { push2d, pull2d, pan2d, whip2d, handheld2d, punchCadence, punchIn2d, beatPunch2d, kenBurns, dutch2d, breathe2d, shake2d, crashZoom, doubleTake, dollySnap, rackFocus2D, dutchRoll };
