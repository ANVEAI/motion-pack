/* motion-pack/objects/characters/poses.js: the WORKER's pose library, a 6-emotion set and timed ACTS.
   POSES: the 45 poses authored for v10 story B (the ANVE v10 film set's timelines/B.js lines 8-53, verbatim values) + a few generic ones.
   A pose is a partial of worker.BASE (radians; + yaw = turn to screen right; arms: aXu = raise, aXo = out, aXe = elbow bend).
   EMOTIONS: 6 readable states (docs/evidence/edit.md 10.1: neutral, happy, sad, surprised, angry, scheming) as pose overrides.
   ACTS: act(name, t0, o) -> pose keys [[t, pose, ease], ...] at 30 fps beats from docs/evidence/visual.md 6.3 (anticipation 3..5 f,
   7% overshoot, moving holds). Concatenate act keys into spec.keys (sorted by t) for makeWorker. Everything is data: seek-safe. */
export const look = (yaw, hYaw, hPitch, o = {}) => ({ yaw, hYaw, hPitch, gx: Math.max(-1, Math.min(1, hYaw * 1.4)), gy: Math.max(-1, Math.min(1, -hPitch * 1.6)), ...o });

export const POSES = {
  sleepy: { hPitch: 0.42, lean: 0.06, sy: 0.965, eye: 0.12, aLo: 0.06, aRo: 0.06, aLe: 0.1, aRe: 0.1 },
  wakeAntic: { sy: 0.92, crouch: 0.03, hPitch: 0.3, eye: 0.5, aLu: -0.25, aRu: -0.25 },
  stretch: { sy: 1.08, aLu: 2.95, aRu: 2.95, aLo: 0.22, aRo: 0.22, aLe: 0.05, aRe: 0.05, hPitch: -0.3, squint: 1 },
  neutral: look(0.1, 0, 0),
  lookCloud: look(0.55, 0.5, -0.32),
  reachR: { yaw: 0.6, lean: 0.12, sy: 1.04, aRu: 2.15, aRo: 0.15, aRe: 0.12, aLu: -0.3, aLo: 0.25, hYaw: 0.1, hPitch: -0.22, gy: 0.4, gx: 0.2 },
  follow: look(0.85, 0.5, -0.3, { aRu: 1.15, aRo: 0.2, aRe: 0.45, lean: -0.02 }),
  reachBoth: { yaw: 0.6, lean: 0.14, sy: 1.05, aRu: 2.3, aRo: 0.15, aRe: 0.1, aLu: 2.2, aLo: 0.1, aLe: 0.15, hPitch: -0.3, gy: 0.5 },
  jumpAntic: { yaw: 0.6, sy: 0.9, crouch: 0.03, aRu: -0.3, aLu: -0.3, hPitch: -0.2, gy: 0.5 },
  jump: { yaw: 0.6, aRu: 2.9, aLu: 2.8, aRo: 0.2, aLo: 0.2, aRe: 0.05, aLe: 0.05, hPitch: -0.45, gy: 0.8 },
  deflate: look(0.75, 0.35, 0.28, { sy: 0.95, lean: 0.08, aLo: 0.05, aRo: 0.05, eye: 0.8 }),
  hurry: { lean: 0.18, hPitch: -0.05 },
  watch: look(0.7, 0.45, -0.35, { lean: -0.04 }),
  worry: look(0.7, 0.45, -0.3, { aLu: 1.25, aLo: -0.15, aLe: 1.5, aRu: 1.25, aRo: -0.15, aRe: 1.5, sy: 0.97 }),
  slumpAntic: look(0.6, 0.4, -0.25, { sy: 1.03, aLu: 1.0, aRu: 1.0, aLe: 1.2, aRe: 1.2 }),
  slump: { yaw: 0.45, lean: 0.32, hPitch: 0.55, sy: 0.9, crouch: 0.02, aLu: 0.3, aRu: 0.3, aLo: 0.02, aRo: 0.02, aLe: 0.1, aRe: 0.1, eye: 0.55, hYaw: 0.1 },
  tabsL: look(-0.25, -0.6, -0.05), tabsR: look(0.25, 0.6, -0.05), tabsB: look(0, -0.1, -0.35),
  hunchL: look(-0.2, -0.65, 0.0, { sy: 0.95, lean: 0.06 }), hunchR: look(0.2, 0.65, 0.0, { sy: 0.95, lean: 0.06 }),
  overwhelmed: { sy: 0.93, lean: 0.05, crouch: 0.02, aLu: 2.55, aLo: 0.75, aLe: 2.0, aRu: 2.55, aRo: 0.75, aRe: 2.0, hPitch: 0.12, eye: 0.35 },
  watchWall: look(0.55, 0.35, 0.05),
  flinch: look(0.45, 0.25, -0.1, { lean: -0.12, sy: 1.03, aLu: 0.9, aLe: 1.3, aRu: 0.9, aRe: 1.3, eye: 0.5 }),
  sitAntic: look(0.3, 0.1, 0.2, { sy: 1.03 }),
  sitSad: { sit: 1, yaw: 0.25, lean: 0.28, hPitch: 0.5, aLu: 0.75, aLo: 0.05, aLe: 0.55, aRu: 0.75, aRo: 0.05, aRe: 0.55, eye: 0.5, sy: 0.97 },
  startle: { sit: 1, yaw: 0.3, lean: 0.05, hPitch: 0.0, sy: 1.04, eye: 1.2, aLu: 0.4, aRu: 0.4, aLe: 0.4, aRe: 0.4 },
  lookUpBox: look(0.6, 0.55, -0.45, { sit: 1, lean: -0.1, eye: 1.2, aLu: 0.4, aRu: 0.4, aLe: 0.4, aRe: 0.4 }),
  standAntic: look(0.6, 0.5, -0.3, { sit: 0.6, sy: 0.92, crouch: 0.04, lean: 0.2 }),
  curious: look(0.65, 0.4, -0.38, { hRoll: -0.22, eye: 1.15 }),
  nod: look(0.65, 0.4, -0.15, { hRoll: -0.1, eye: 1.0, squint: 0.4 }),
  cheerAntic: { yaw: 0.35, sy: 0.9, crouch: 0.04, aLu: -0.3, aRu: -0.3, hPitch: 0.1 },
  cheer: { yaw: 0.25, sy: 1.07, aLu: 2.75, aLo: 0.6, aLe: 0.15, aRu: 2.75, aRo: 0.6, aRe: 0.15, hPitch: -0.2, squint: 1 },
  ready: look(-0.4, -0.2, 0.0, { lean: 0.1 }),
  delight: { yaw: 0.5, sy: 1.05, aLu: 1.35, aLo: -0.35, aLe: 1.25, aRu: 1.35, aRo: -0.35, aRe: 1.25, hPitch: -0.1, hRoll: 0.12, squint: 1 },
  reliefAntic: look(0.5, 0.3, 0.15, { sy: 0.95, aLu: 0.1, aRu: 0.1 }),
  relief: { yaw: 0.3, lean: -0.1, sy: 1.04, aLu: 0.4, aLo: 0.45, aRu: 0.4, aRo: 0.45, aLe: 0.3, aRe: 0.3, hPitch: -0.15, squint: 0.8 },
  patAntic: look(0.75, 0.1, 0.35, { lean: 0.25, aRu: 1.5, aRe: 0.4, squint: 0.5 }),
  pat: look(0.75, 0.1, 0.4, { lean: 0.32, aRu: 1.05, aRe: 0.25, squint: 0.9 }),
  relaxAntic: look(0.2, 0.0, 0.0, { sy: 1.03 }),
  relaxSit: { sit: 1, yaw: 0.15, lean: -0.18, aLu: 2.75, aLo: 0.5, aLe: 2.5, aRu: 2.75, aRo: 0.5, aRe: 2.5, hPitch: -0.12, hRoll: 0.1, squint: 1 },
  // generic additions (pack): camera-facing reads for spots and talking-head inserts
  front: look(0, 0, 0),
  pointR: { yaw: 0.2, aRu: 1.55, aRo: 0.35, aRe: 0.05, hYaw: 0.45, gx: 0.7, lean: 0.03 },
  waveR: { yaw: 0, aRu: 2.6, aRo: 0.55, aRe: 0.6, hRoll: -0.08, squint: 0.6 },
  shrug: { aLu: 0.55, aLo: 0.75, aLe: 1.6, aRu: 0.55, aRo: 0.75, aRe: 1.6, hRoll: 0.14, sy: 1.02 },
  facepalm: { aRu: 2.2, aRo: -0.25, aRe: 2.25, hPitch: 0.32, lean: 0.06, eye: 0.3 },
  armsCrossed: { aLu: 0.75, aLo: -0.45, aLe: 1.95, aRu: 0.75, aRo: -0.45, aRe: 1.95, lean: -0.05, squint: 0.5 },
};

/* 6 emotions as overrides (faces are shape swaps, not morphs: eye height + squint + head + body) */
export const EMOTIONS = {
  neutral: { eye: 1.0, squint: 0, hRoll: 0, sy: 1.0 },
  happy: { eye: 1.0, squint: 1.0, hPitch: -0.12, hRoll: 0.1, sy: 1.04 },
  sad: { eye: 0.55, squint: 0, hPitch: 0.45, lean: 0.12, sy: 0.94 },
  surprised: { eye: 1.3, squint: 0, hPitch: -0.12, sy: 1.06, lean: -0.08 },
  angry: { eye: 0.7, squint: 0.65, hPitch: 0.18, lean: 0.14, sy: 0.97 },
  scheming: { eye: 0.75, squint: 0.75, hRoll: -0.18, gx: 0.8, hYaw: 0.25 },
};
export const emote = (pose, emotion) => ({ ...(typeof pose === 'string' ? POSES[pose] : pose), ...EMOTIONS[emotion] });

const F = 1 / 30;
/* acts: each returns keys from t0 (seconds). o.yaw turns the whole act; o.hold extends the final moving hold. */
export const ACTS = {
  doubleTake: (t0, o = {}) => [[t0, look(o.yaw ?? 0, -0.6, 0.05)], [t0 + 8 * F, look(o.yaw ?? 0, -0.6, 0.05)], [t0 + 14 * F, { ...look(o.yaw ?? 0, -0.6, 0.05), sy: 0.92 }, 'soft'],
    [t0 + 16 * F, { ...look(o.yaw ?? 0, 0.1, -0.05), sy: 1.15, eye: 1.35 }, 'enter'], [t0 + 19 * F, { ...look(o.yaw ?? 0, 0.0, -0.02), sy: 1.0, eye: 1.3 }, 'soft'], [t0 + (19 + (o.hold ?? 12)) * F, { ...look(o.yaw ?? 0, 0, 0), eye: 1.2 }, 'soft']],
  shrug: (t0, o = {}) => [[t0, POSES.front], [t0 + 6 * F, POSES.shrug, 'enter'], [t0 + 14 * F, POSES.shrug], [t0 + 24 * F, POSES.front, 'soft']],
  wave: (t0, o = {}) => { const k = [[t0, POSES.front], [t0 + 10 * F, POSES.waveR, 'enter']]; for (let i = 1; i <= 3; i++) k.push([t0 + (10 + i * 7) * F, { ...POSES.waveR, aRo: i % 2 ? 0.25 : 0.55 }, 'soft']); k.push([t0 + 42 * F, POSES.front, 'soft']); return k; },
  point: (t0, o = {}) => [[t0, POSES.front], [t0 + 4 * F, { ...POSES.pointR, aRu: 1.2, sy: 0.97 }, 'soft'], [t0 + 10 * F, { ...POSES.pointR, aRu: 1.66 }, 'enter'], [t0 + 13 * F, POSES.pointR, 'soft'], [t0 + (13 + (o.hold ?? 20)) * F, POSES.pointR]],
  cheer: (t0) => [[t0, POSES.front], [t0 + 4 * F, POSES.cheerAntic, 'soft'], [t0 + 9 * F, POSES.cheer, 'enter'], [t0 + 24 * F, POSES.cheer], [t0 + 34 * F, POSES.delight, 'soft']],
  facepalm: (t0) => [[t0, POSES.front], [t0 + 8 * F, POSES.facepalm, 'enter'], [t0 + 22 * F, POSES.facepalm], [t0 + 27 * F, { ...POSES.facepalm, hYaw: 0.2 }, 'soft'], [t0 + 32 * F, { ...POSES.facepalm, hYaw: -0.2 }, 'soft'], [t0 + 37 * F, { ...POSES.facepalm, hYaw: 0.12 }, 'soft'], [t0 + 42 * F, POSES.facepalm, 'soft']],
  slowBurn: (t0, o = {}) => [[t0, POSES.front], [t0 + 12 * F, emote({ ...POSES.front, hRoll: 0.1, lean: 0.04 }, 'angry'), 'soft'], [t0 + 32 * F, emote({ ...POSES.front, hRoll: 0.1, lean: 0.05 }, 'angry')]],
  slump: (t0) => [[t0, POSES.front], [t0 + 6 * F, POSES.slumpAntic, 'soft'], [t0 + 12 * F, POSES.slump, 'exit'], [t0 + 40 * F, { ...POSES.slump, sy: 0.88 }, 'soft']],
  jumpScare: (t0) => [[t0, POSES.front], [t0 + 3 * F, { ...POSES.front, sy: 0.9 }, 'soft'], [t0 + 5 * F, { ...POSES.flinch, sy: 1.25, eye: 1.35 }, 'enter'], [t0 + 9 * F, { ...POSES.flinch, sy: 1.02 }, 'soft'], [t0 + 20 * F, POSES.flinch, 'soft']],
  /* dance-bob: squash on every beat (beats in seconds), arms swing on the off-beat; beat-locked from a grid */
  danceBob: (beats) => { const k = []; beats.forEach((b, i) => { const s = i % 2 ? 1 : -1; k.push([b, { ...POSES.front, sy: 0.9, crouch: 0.02, aLu: 0.6 + 0.4 * s, aRu: 0.6 - 0.4 * s, aLe: 1.2, aRe: 1.2, squint: 1 }, 'enter']); const nb = beats[i + 1]; if (nb) k.push([(b + nb) / 2, { ...POSES.front, sy: 1.04, aLu: 0.6 - 0.4 * s, aRu: 0.6 + 0.4 * s, aLe: 1.2, aRe: 1.2, hRoll: 0.08 * s, squint: 1 }, 'soft']); }); return k; },
};
/* merge act keys + loose keys; later keys at the same time win */
export const keysOf = (...lists) => lists.flat().map(([t, p, e]) => [t, typeof p === 'string' ? POSES[p] : p, e || 'soft']).sort((a, b) => a[0] - b[0]);
/* seeded blink times (2.8..5.2 s apart, 10% doubles) for a span */
export function blinkTimes(t0, t1, seed = 7) { let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const out = []; let t = t0 + 0.6 + r(); while (t < t1) { out.push(+t.toFixed(3)); if (r() < 0.1) out.push(+(t + 0.18).toFixed(3)); t += 2.8 + 2.4 * r(); } return out; }
