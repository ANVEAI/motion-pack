/* motion-pack / camera / cam3d.js: deterministic camera-move presets for the three.js studio kit.
   Contract = the kit's  camera(ctx, t) -> { fov, elev, az, dist, target:[x,y,z], screen:[px,py], punch, near, far }  PLUS  roll (deg) and shake ([px,py] lens-shift px).
   Every preset is a MODIFIER:  preset(base, params) -> (t) => state,  where base is a state object or a function of t. Presets nest:
       const cam = handheld(pushIn(hold(KIT.wide), { at: 1.0, dur: 1.2 }), { level: 'doc', seed: 3 });
   Pure functions of t (seconds): no clock, no Math.random, no carried state: call them in any order, twice, from any thread, and get the same numbers.
   Move windows: { at, dur }: before `at` the move is at 0, after at+dur it holds its end value. Angles in degrees, distances in the kit's units, px in output pixels at 1080p scale. Positive roll rotates the picture clockwise (same sign as CSS rotate()). */
import { E, lerp, clamp, seg, env, sines, TAU } from './ease.js';

const rad = (d) => (d * Math.PI) / 180;
export const asFn = (b) => (typeof b === 'function' ? b : () => b);
export const clone = (s) => ({ ...s, target: [...(s.target || [0, 0, 0])], screen: [...(s.screen || [0, 0])], shake: [...(s.shake || [0, 0])], roll: s.roll || 0, punch: s.punch || 0 });
const ease = (e) => (typeof e === 'function' ? e : E[e] || E.soft);
const win = (t, at, dur, e) => ease(e)(seg(t, at, at + dur));

/* the kit's own wide / tall baseline (kit/presets.js): long lens, slow orbit, 4.5% push. A convenient starting `base`. */
export const KIT = {
  wide: { fov: 18, elev: 25, az: -12, dist: 12.9, target: [0.22, 0.42, -0.25], screen: [1320, 560], punch: 0, near: 4, far: 140, roll: 0, shake: [0, 0] },
  tall: { fov: 18, elev: 24, az: -12, dist: 20.6, target: [0.18, 0.40, -0.25], screen: [540, 1192], punch: 0, near: 4, far: 140, roll: 0, shake: [0, 0] },
};
/* kit default scene drift: az -12 -> -6, dist x0.953 (12.9 -> 12.3), punch 0.010, over the scene length */
export const kitDrift = (base, dur, { azTo = -6, distTo = 0.9535, punch = 0.010, ease: e = 'lin' } = {}) => (t) => { const s = clone(asFn(base)(t)), k = ease(e)(seg(t, 0, dur)); s.az = lerp(s.az, azTo, k); s.dist *= lerp(1, distTo, k); s.punch += punch * k; return s; };

/* hold: never-dead plate: micro orbit +-driftDeg over `period` seconds */
export const hold = (base, { driftDeg = 0.4, period = 6, phase = 0 } = {}) => (t) => { const s = clone(asFn(base)(t)); s.az += driftDeg * Math.sin(TAU * t / period + phase); return s; };
/* pushIn: hero push (x0.88 in 1.2 s, E.hero) or slow push under type (pushSlow) */
export const pushIn = (base, { at = 0, dur = 1.2, ratio = 0.88, ease: e = 'hero' } = {}) => (t) => { const s = clone(asFn(base)(t)); s.dist *= lerp(1, ratio, win(t, at, dur, e)); return s; };
export const pushSlow = (base, o = {}) => pushIn(base, { dur: 6, ratio: 0.955, ease: 'sine', ...o });
export const pullOut = (base, { at = 0, dur = 1.6, ratio = 1.25, ease: e = 'move' } = {}) => pushIn(base, { at, dur, ratio, ease: e });
/* orbit: +deg of azimuth, elevation fixed, optional 0.5% parallax breathing */
export const orbit = (base, { at = 0, dur = 5, deg = 40, ease: e = 'sine', parallax = 0.005 } = {}) => (t) => { const s = clone(asFn(base)(t)), k = win(t, at, dur, e); s.az += deg * k; s.dist *= 1 + parallax * Math.sin(Math.PI * k); return s; };
/* crane: elevation sweep (absolute from/to, or relative to base when `rel`) with a slight pull */
export const crane = (base, { at = 0, dur = 3, from = 12, to = 38, rel = false, distMul = 1.1, ease: e = 'move' } = {}) => (t) => { const s = clone(asFn(base)(t)), k = win(t, at, dur, e); s.elev = rel ? s.elev + to * k : lerp(from, to, k); s.dist *= lerp(1, distMul, k); return s; };
/* truck: sideways translation of the look-at (parallax in 3D) */
export const truck = (base, { at = 0, dur = 3, dx = 1.6, dy = 0, dz = 0, ease: e = 'cam' } = {}) => (t) => { const s = clone(asFn(base)(t)), k = win(t, at, dur, e); s.target = [s.target[0] + dx * k, s.target[1] + dy * k, s.target[2] + dz * k]; return s; };
/* dolly zoom (vertigo): subject width constant: dist(t) = D0 tan(fov0/2) / tan(fov(t)/2). Use once per film. */
export const dollyZoom = (base, { at = 0, dur = 2.4, fovTo = 55, ease: e = 'sine' } = {}) => (t) => { const s = clone(asFn(base)(t)), f0 = s.fov, d0 = s.dist, k = win(t, at, dur, e); s.fov = lerp(f0, fovTo, k); s.dist = d0 * Math.tan(rad(f0 / 2)) / Math.tan(rad(s.fov / 2)); s.near = Math.min(s.near || 4, s.dist * 0.4); return s; };   // the camera ends up close: pull the near plane in so the subject is not clipped
/* whip pan: 7-frame azimuth sweep with quint ease. mode 'out' leaves the shot (0 -> deg), 'in' arrives (-deg -> 0). Cut the scene at the midpoint (result `whipMid(at,dur)`). */
export const whipPan = (base, { at = 0, dur = 7 / 30, deg = 70, mode = 'out', rollDeg = 2 } = {}) => (t) => {
  const s = clone(asFn(base)(t)), k = E.quint(seg(t, at, at + dur)); const v = mode === 'out' ? deg * k : -deg * (1 - k); s.az += v;
  s.roll += rollDeg * Math.sin(Math.PI * seg(t, at, at + dur)) * Math.sign(deg); return s; };
export const whipMid = (at, dur = 7 / 30) => at + dur / 2;
/* angular speed (deg/s) of a camera function at t (central difference): used by motion blur and by lintCameraMoves */
export const speedAz = (cam, t, h = 1e-3) => (cam(t + h).az - cam(t - h).az) / (2 * h);
/* handheld: closed-form sum of sines with seeded phases (deterministic from t alone). amplitudes are SCREEN PIXELS at H, converted to degrees with the vertical fov. levels: doc 1, action 2.5, subtle 0.4 */
export const HANDHELD_LEVELS = { subtle: 0.4, doc: 1.0, action: 2.5 };
export const handheld = (base, { level = 'doc', seed = 1, H = 1080, rollOn = true } = {}) => {
  const L = typeof level === 'number' ? level : HANDHELD_LEVELS[level], slow = [0.37, 0.83, 1.31], micro = [7.1, 9.3];
  const nx = sines(seed * 17 + 1, slow, [1, 1.27, 0.79]), ny = sines(seed * 17 + 2, slow, [1, 1.27, 0.79]), mx = sines(seed * 17 + 3, micro, [1, 0.8]), my = sines(seed * 17 + 4, micro, [1, 0.8]), nr = sines(seed * 17 + 5, slow, [1, 0.6, 0.4]), mr = sines(seed * 17 + 6, micro, [1, 0.8]), nf = sines(seed * 17 + 7, [0.21, 0.47], [1, 0.6]);
  return (t) => { const s = clone(asFn(base)(t)), pxDeg = s.fov / H;
    const dxPx = L * (5 * nx(t) + 0.8 * mx(t)), dyPx = L * (5 * ny(t) + 0.8 * my(t));
    s.az += dxPx * pxDeg; s.elev += dyPx * pxDeg; if (rollOn) s.roll += L * (0.25 * nr(t) + 0.04 * mr(t)); s.fov *= 1 + L * 0.004 * nf(t); return s; };
};
/* punch on the beat: dist shrinks by `amount` (kit punch units) on each hit, rise 1 f, decay 8 f */
export const beatPunch = (base, { hits = [], amount = 0.012, attack = 1 / 30, decay = 8 / 30 } = {}) => (t) => { const s = clone(asFn(base)(t)); s.punch += amount * env(t, hits, { attack, decay }); return s; };
export const dutch = (base, { at = 0, dur = 20 / 30, deg = 6, ease: e = 'soft' } = {}) => (t) => { const s = clone(asFn(base)(t)); s.roll += deg * win(t, at, dur, e); return s; };
/* breathe: loop-safe scale 1.000 <-> 1 + amp over `period` s (punch units) */
export const breathe = (base, { amp = 0.012, period = 4 } = {}) => (t) => { const s = clone(asFn(base)(t)); s.punch += amp * 0.5 * (1 - Math.cos(TAU * t / period)); return s; };
/* impact shake: decaying lens-shift jolt (px) on hits */
export const impactShake = (base, { hits = [], px = 8, decay = 4 / 30, seed = 1 } = {}) => { const nx = sines(seed * 31 + 1, [17, 23], [1, 0.7]), ny = sines(seed * 31 + 2, [19, 29], [1, 0.7]);
  return (t) => { const s = clone(asFn(base)(t)), e = env(t, hits, { attack: 0.2 / 30, decay, curve: 'exp' }); s.shake = [s.shake[0] + px * e * nx(t), s.shake[1] + px * e * ny(t)]; return s; }; };
/* rack focus: focus point A -> B in 12 frames, dofK 60 -> 90 -> 60 (kit units). Returns { focus:[x,y,z], dofK } for the kit's def.focus(ctx,t). */
export const rackFocus = (A, B, { at = 0, dur = 12 / 30, k0 = 60, kPeak = 90 } = {}) => (t) => { const k = E.move(seg(t, at, at + dur)); return { focus: [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)], dofK: k0 + (kPeak - k0) * Math.sin(Math.PI * seg(t, at, at + dur)) }; };
/* lock: freeze the camera over the contact frames of a key action (drop, slam, snap): nothing moves while the object lands */
export const lock = (base, windows = []) => { const f = asFn(base); return (t) => { for (const [a, b] of windows) if (t >= a && t < b) return clone(f(a)); return f(t); }; };
/* sequence: hard cuts between camera functions: [[tStart, camFn], ...] (sorted). Optional crossfade seconds blends the numeric fields. */
export const sequence = (segs, { crossfade = 0 } = {}) => (t) => {
  let i = 0; for (let j = 0; j < segs.length; j++) if (t >= segs[j][0]) i = j; const cur = asFn(segs[i][1])(t);
  if (crossfade > 0 && i > 0 && t < segs[i][0] + crossfade) { const prev = asFn(segs[i - 1][1])(t), k = E.soft((t - segs[i][0]) / crossfade); return mix(prev, cur, k); } return cur; };
export function mix(a, b, k) { const o = clone(a), m = (x, y) => x + (y - x) * k; for (const f of ['fov', 'elev', 'az', 'dist', 'punch', 'roll']) o[f] = m(a[f] || 0, b[f] || 0); o.target = a.target.map((v, i) => m(v, b.target[i])); o.screen = a.screen.map((v, i) => m(v, b.screen[i])); o.shake = a.shake.map((v, i) => m(v, (b.shake || [0, 0])[i])); return o; }
/* lint: report camera motion inside key-action windows ([t0,t1] seconds) and moves that start too soon after a cut. thresholds in deg/s of azimuth or kit units/s of dist. */
export function lintCameraMoves(cam, keyActions = [], { fps = 30, maxDegPerSec = 0.8, maxDistPerSec = 0.15, maxRollPerSec = 0.8 } = {}) {
  const out = []; for (const [a, b] of keyActions) { let worst = { az: 0, dist: 0, roll: 0 }; for (let t = a; t + 1 / fps <= b + 1e-9; t += 1 / fps) { const s0 = cam(t), s1 = cam(t + 1 / fps); worst.az = Math.max(worst.az, Math.abs(s1.az - s0.az) * fps); worst.dist = Math.max(worst.dist, Math.abs(s1.dist - s0.dist) * fps); worst.roll = Math.max(worst.roll, Math.abs(s1.roll - s0.roll) * fps); }
    if (worst.az > maxDegPerSec || worst.dist > maxDistPerSec || worst.roll > maxRollPerSec) out.push({ window: [a, b], ...worst, msg: 'camera moves during a key action' }); } return out; }
/* apply a state to a THREE.PerspectiveCamera exactly like the kit rig (core.js): orbit about target, look-at, lens shift for `screen`, then roll about the view axis and the shake px.
   W,H = output pixels; scale = H/1080 (kit ctx.scale). THREE is passed in so this file has no import. */
export function applyToThree(THREE, camera, c, W, H, scale = H / 1080) {
  const el = rad(c.elev), az = rad(c.az), d = c.dist * (1 - (c.punch || 0)), T = c.target;
  camera.position.set(T[0] + d * Math.sin(az) * Math.cos(el), T[1] + d * Math.sin(el), T[2] + d * Math.cos(az) * Math.cos(el));
  camera.up.set(0, 1, 0); camera.lookAt(T[0], T[1], T[2]); if (c.roll) camera.rotateZ(rad(c.roll));
  camera.fov = c.fov; camera.aspect = W / H; camera.near = c.near || 4; camera.far = c.far || 140;
  const sh = c.shake || [0, 0], sx = c.screen[0] * scale + sh[0] * scale, sy = c.screen[1] * scale + sh[1] * scale;
  camera.setViewOffset(W, H, W / 2 - sx, H / 2 - sy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); return camera;
}
export const PRESETS_3D = { hold, pushIn, pushSlow, pullOut, orbit, crane, truck, dollyZoom, whipPan, handheld, beatPunch, dutch, breathe, impactShake };
