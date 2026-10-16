/* motion-pack/objects/lib/hwshots.js (xp-hardware, 2026-10-16): the HARDWARE SHOT DIRECTOR. Pure (no three.js, no DOM): from a plan's 3D shot list it gives
   the camera, the device state and the lights at any t, so the three.js plate (each hardware template plate.html) and node (spec callouts, dimension lines and
   edge glints that must sit ON the device in the rendered plate) compute the same numbers.
     const D = director(plan);  D.cameraAt(t) -> kit camera state;  D.stateAt(t) -> { pose, band, bandSweep, explode, die, dieGlow, fanSpin, lights, xray, show, cable, shot }
     D.px('heatsink', t) -> [x, y] frame fractions of a named anchor (objects/lib/hwdata.js anchors, with the explode offsets of its part), or null when behind the camera
   plan: { aspect: 'wide' | 'tall', W, H, device: nodeSpec overrides, shots3d: [{ id, kind, t0, dur, p: {} }] }. Shot kinds (the craft of device reveals, as moves):
     silhouette  the dark cold open: two edge lights from behind draw the outline, nothing from the front; a slow push (cam3d.pushSlow)
     sweep       macro on the front top chamfer; a long soft strip travels across (the one highlight line runs over the edge); a micro slide (cam3d.truck)
     hero        the reveal: every light on, the LED band ignites left to right, a turntable turn (cam3d.orbit equivalent: the DEVICE turns), a hero push (cam3d.pushIn)
     explode     the device rises, the parts cascade out (objects/lib/explode.js), hold and breathe while the camera cranes (cam3d.crane), then reassemble
     scale       on a desk beside the pack's own laptop and mug (objects/laptop, objects/mug), a three-quarter top view; the dimension lines sit on the corners
     ports       behind the device, close; the camera trucks along the back panel (cam3d.truck); a cable plugs in
     inside      the shell turns to x-ray (objects/lib/xray.js), the cooling lifts away, a push onto the chip; its lid lifts and the die lights
     spin        a slow turntable on one side of the frame (under a spec card)
     card        the device dim and back-lit, low in frame (under the date / price card)
     end         the band glows in the dark, the device small and low (under the end card)
   Every kind has its own wide and tall camera (a re-layout, never a crop). Every value is a function of t. */
import { seg, lerp, clamp } from '../kit/util.js';
import { E } from '../../camera/ease.js';
import { nodeLayout, anchorAt } from './hwdata.js';
import { explodePlan, explodeAt } from './explode.js';
import { project, poseApply } from '../kit/project.js';
import { pushIn, pushSlow, orbit, crane, truck, hold } from '../../camera/cam3d.js';

const R = (d) => (d * Math.PI) / 180;
const LIGHTS = { rim: 1, top: 1, key: 0.4, edge: 0, sweep: null };
/* per kind: base camera (wide / tall), the cam3d move, the device pose, the light levels; every number is a starting value tuned on the demo device */
const KINDS = {
  silhouette: { cam: { wide: { fov: 18, elev: 8, az: -6, dist: 6.4, target: [0, 0.16, 0], screen: [960, 560] }, tall: { fov: 22, elev: 9, az: -6, dist: 8.6, target: [0, 0.16, 0], screen: [540, 1000] } },
    move: (b, d) => pushSlow(b, { at: 0, dur: d, ratio: 0.9 }), yaw: -0.32, lights: (u) => ({ rim: 0.12, top: 0, key: 0, edge: 0.75 + 0.9 * E.soft(seg(u, 0, 0.7)) }), band: (u) => 0.0 + 0.18 * E.soft(seg(u, 0.75, 1)) },
  sweep: { cam: { wide: { fov: 15, elev: 13, az: -26, dist: 3.0, target: [0.22, 0.27, 0.32], screen: [900, 560] }, tall: { fov: 20, elev: 14, az: -26, dist: 3.4, target: [0.2, 0.27, 0.32], screen: [540, 900] } },
    move: (b, d) => truck(b, { at: 0, dur: d, dx: -0.12, ease: 'sine' }), yaw: -0.32, lights: (u) => ({ rim: 0.35, top: 0.05, key: 0.02, edge: 0.4, sweep: E.move(seg(u, 0.05, 0.92)), sweepFrom: -1.5, sweepTo: 1.6, sweepZ: 1.1, sweepY: 0.75 }), band: () => 0.22 },
  hero: { cam: { wide: { fov: 20, elev: 15, az: -10, dist: 5.9, target: [0, 0.16, 0], screen: [960, 600] }, tall: { fov: 24, elev: 16, az: -10, dist: 8.0, target: [0, 0.16, 0], screen: [540, 1060] } },
    move: (b, d) => pushIn(b, { at: 0, dur: Math.min(1.6, d), ratio: 0.9, ease: 'hero' }), yaw: (u, p) => -0.95 + R(p.turn ?? 70) * E.sine(u), lights: (u) => ({ rim: 1, top: 1, key: 0.45, edge: 0.15 }), band: () => 1, bandSweep: (u, p, tl) => E.move(seg(tl, 0.05, 0.6)) },
  explode: { cam: { wide: { fov: 22, elev: 14, az: -16, dist: 7.4, target: [0, 0.5, 0], screen: [860, 560] }, tall: { fov: 26, elev: 15, az: -16, dist: 10.2, target: [0, 0.55, 0], screen: [540, 1000] } },
    move: (b, d) => crane(b, { at: 0.6, dur: d * 0.55, from: 14, to: 24, distMul: 1.06 }), yaw: (u) => -0.6 + 0.25 * E.sine(u), lights: () => ({ rim: 1, top: 1, key: 0.5, edge: 0.1 }), band: () => 1 },
  scale: { cam: { wide: { fov: 22, elev: 36, az: -22, dist: 8.2, target: [0.55, 0.12, 0.05], screen: [960, 560] }, tall: { fov: 28, elev: 40, az: -22, dist: 9.8, target: [0.4, 0.12, 0.1], screen: [540, 1000] } },
    move: (b, d) => pushSlow(b, { at: 0, dur: d, ratio: 0.96 }), yaw: 0.0, lights: () => ({ rim: 0.8, top: 1.1, key: 0.6, edge: 0 }), band: () => 1, show: { desk: true, laptop: true, mug: true } },
  ports: { cam: { wide: { fov: 16, elev: 8, az: 168, dist: 3.4, target: [-0.18, 0.13, -0.36], screen: [960, 560] }, tall: { fov: 22, elev: 9, az: 168, dist: 3.6, target: [-0.12, 0.13, -0.36], screen: [540, 1000] } },
    move: (b, d) => truck(b, { at: 0, dur: d, dx: 0.34, ease: 'sine' }), yaw: 0, lights: () => ({ rim: 1.1, top: 0.7, key: 0.6, edge: 0.3 }), band: () => 1, show: { cable: true }, cable: (u) => E.move(seg(u, 0.25, 0.6)) },
  inside: { cam: { wide: { fov: 19, elev: 38, az: -14, dist: 5.2, target: [-0.08, 0.1, 0], screen: [960, 560] }, tall: { fov: 22, elev: 42, az: -14, dist: 6.6, target: [-0.1, 0.1, 0], screen: [540, 1000] } },
    move: (b, d) => (t) => { const s = pushIn(b, { at: d * 0.42, dur: d * 0.5, ratio: 0.42, ease: 'move' })(t), k = E.move(seg(t, d * 0.42, d * 0.92)); s.target = [lerp(b.target[0], -0.2, k), lerp(b.target[1], 0.06, k), lerp(b.target[2], 0.03, k)]; s.elev = lerp(b.elev, 52, k); return s; },
    yaw: -0.25, lights: () => ({ rim: 0.9, top: 1.0, key: 0.5, edge: 0.1 }), band: () => 1, xray: (u) => E.move(seg(u, 0.05, 0.4)), lift: (u) => E.move(seg(u, 0.38, 0.62)), die: (u) => E.soft(seg(u, 0.6, 0.78)), dieGlow: (u) => seg(u, 0.7, 0.98) },
  spin: { cam: { wide: { fov: 20, elev: 14, az: -8, dist: 6.4, target: [-0.62, 0.17, 0], screen: [960, 560] }, tall: { fov: 24, elev: 15, az: -8, dist: 8.2, target: [0, 0.17, 0], screen: [540, 1480] } },
    move: (b, d) => hold(b, { driftDeg: 0.6, period: 8 }), yaw: (u, p, tl) => -0.4 + 0.22 * tl, lights: () => ({ rim: 1, top: 0.9, key: 0.4, edge: 0.1 }), band: () => 1 },
  card: { cam: { wide: { fov: 20, elev: 6, az: -4, dist: 6.6, target: [0, 0.55, 0], screen: [960, 560] }, tall: { fov: 24, elev: 6, az: -4, dist: 8.6, target: [0, 0.6, 0], screen: [540, 960] } },
    move: (b, d) => pushSlow(b, { at: 0, dur: d, ratio: 0.94 }), yaw: -0.2, lights: () => ({ rim: 0.45, top: 0, key: 0, edge: 0.9 }), band: (u, p, tl) => 0.55 + 0.1 * Math.sin(2 * Math.PI * 0.5 * tl) },
  end: { cam: { wide: { fov: 18, elev: 6, az: -4, dist: 7.4, target: [0, 0.62, 0], screen: [960, 560] }, tall: { fov: 22, elev: 6, az: -4, dist: 9.6, target: [0, 0.7, 0], screen: [540, 960] } },
    move: (b, d) => pushSlow(b, { at: 0, dur: d, ratio: 0.97 }), yaw: -0.15, lights: () => ({ rim: 0.3, top: 0, key: 0, edge: 0.6 }), band: () => 0.8 },
};
export const SHOT_KINDS = Object.keys(KINDS);
/* the cam3d move ids each kind uses (for plan.json: the ids resolve with tools/check_ids.py) */
export const SHOT_MOVES = { silhouette: 'cam3d.pushSlow', sweep: 'cam3d.truck', hero: 'cam3d.pushIn', explode: 'cam3d.crane', scale: 'cam3d.pushSlow', ports: 'cam3d.truck', inside: 'cam3d.pushIn', spin: 'cam3d.hold', card: 'cam3d.pushSlow', end: 'cam3d.pushSlow' };
const val = (f, ...a) => (typeof f === 'function' ? f(...a) : f);

export function director(plan) {
  const L = nodeLayout(plan.device || {}), tall = plan.aspect === 'tall', W = plan.W || (tall ? 1080 : 1920), H = plan.H || (tall ? 1920 : 1080);
  const shots = (plan.shots3d || []).filter((s) => KINDS[s.kind]).slice().sort((a, b) => a.t0 - b.t0);
  const X = {}; for (const s of shots) if (s.kind === 'explode') { const d = s.dur, p = s.p || {}; X[s.id] = explodePlan(L.explode, { at: p.at ?? 0.9, dur: p.partDur ?? 0.8, stagger: p.stagger ?? 0.1, hold: Math.max(0.4, d - (p.at ?? 0.9) - 0.8 - 6 * (p.stagger ?? 0.1) - (p.backTail ?? 1.6)), back: p.back !== false }); }
  const shotAt = (t) => { let s = shots[0]; for (const x of shots) if (x.t0 <= t + 1e-9) s = x; return s; };
  const cams = new Map();
  const camFor = (s) => { if (!cams.has(s.id)) { const K = KINDS[s.kind], base = { ...K.cam[tall ? 'tall' : 'wide'], ...((s.p && s.p.cam) || {}), punch: 0, roll: 0, shake: [0, 0], near: 0.15, far: 80 }; if (tall && s.p && s.p.camTall) Object.assign(base, s.p.camTall); cams.set(s.id, K.move(base, s.dur)); } return cams.get(s.id); };
  const api = {
    layout: L, shots, explodePlans: X, shotAt,
    cameraAt(t) { const s = shotAt(t); if (!s) return { ...KINDS.hero.cam.wide, punch: 0 }; const c = camFor(s)(Math.max(0, t - s.t0)); return c; },
    stateAt(t) {
      const s = shotAt(t); if (!s) return null; const K = KINDS[s.kind], p = s.p || {}, tl = Math.max(0, t - s.t0), u = clamp(tl / Math.max(1e-6, s.dur));
      let explode = null, lift = 0;
      if (s.kind === 'explode') { const k = E.move(seg(tl, 0.1, 0.85)) - E.move(seg(tl, s.dur - 0.7, s.dur - 0.05)); lift = 0.62 * k; explode = explodeAt(X[s.id], tl); }
      if (s.kind === 'inside') { const k = val(K.lift, u); explode = { top: { k, off: [0, 1.6 * k, -0.4 * k], rot: [0, 0, 0] }, fan: { k, off: [0, 1.4 * k, -0.2 * k], rot: [0, 0, 0] }, heatsink: { k, off: [0, 1.2 * k, 0], rot: [0, 0, 0] }, card: { k, off: [0.9 * k, 0.5 * k, 0], rot: [0, 0, 0] } }; }
      const yaw = val(K.yaw, u, p, tl) + (p.yaw || 0);
      return { shot: s.id, kind: s.kind, u, tl, pose: { p: [0, lift, 0], yaw, s: 1 }, band: val(K.band, u, p, tl), bandSweep: K.bandSweep ? K.bandSweep(u, p, tl) : 1, explode,
        die: K.die ? K.die(u) : 0, dieGlow: K.dieGlow ? K.dieGlow(u) : explode && s.kind === 'explode' ? seg(tl, 1.4, 2.6) * (1 - seg(tl, s.dur - 1.2, s.dur - 0.6)) : 0,
        fanSpin: 9 * t, lights: { ...LIGHTS, ...val(K.lights, u, p, tl) }, xray: K.xray ? K.xray(u) : null, show: { desk: false, laptop: false, mug: false, cable: false, ...(K.show || {}) }, cable: K.cable ? K.cable(u) : 0 };
    },
    /* a named anchor -> frame fractions [x, y] at t (null when behind the camera or the anchor is unknown) */
    px(name, t) { const S = api.stateAt(t); if (!S) return null; const a = anchorAt(L, name, S.explode); if (!a) return null; const w = poseApply(S.pose, a), q = project(api.cameraAt(t), w, W, H); return q[2] > 0 ? [q[0] / W, q[1] / H] : null; },
    /* a device-local point (or a world point with world: true) -> frame fractions */
    pxPoint(pt, t, world = false) { const S = api.stateAt(t); const w = world ? pt : poseApply(S.pose, pt), q = project(api.cameraAt(t), w, W, H); return q[2] > 0 ? [q[0] / W, q[1] / H] : null; },
    /* a per-frame track [[t, x, y], ...] (composition seconds) of an anchor over [t0, t1] (cut short at the end of t0's shot: the next shot has another camera), for hw.specCallout / hw.dimensionLine / hw.edgeGlint */
    track(name, t0, t1, fps = 30, local = null) { const out = [], sid = shotAt(t0)?.id; for (let f = Math.round(t0 * fps); f <= Math.round(t1 * fps); f++) { const t = f / fps; if (shotAt(t)?.id !== sid) break; const q = local ? api.pxPoint(local, t) : api.px(name, t); if (q) out.push([+t.toFixed(4), +q[0].toFixed(5), +q[1].toFixed(5)]); } return out; },
  };
  return api;
}
