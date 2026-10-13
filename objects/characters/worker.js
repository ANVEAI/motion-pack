/* PROVENANCE: extracted from the ANVE v10 film set's stories/B/worker.js (2026-10-13), imports re-pointed to objects/kit; the rig, hop layer,
   follow-through, blinks and the red-rim clamp are unchanged. zoneX defaults to () => 0 (zone-local = world x), rimLight is optional.
   Pose library, emotions and acts live in characters/poses.js. Original character (periwinkle ceramic figure): ours to reuse. */
/* STORY B: THE WORKER. A small premium ceramic figure (matte glazed body, two ink eyes, no other face) who lives on the v10 desk.
   Everything is a pure function of t: pose keys blended with the later key's ease, a hop layer (anticipation crouch, arcs, stretch in
   flight, contact squash + spring), follow-through by sampling the head 2 f and the arms 3 f behind the body, breathing, blinks.
   spec (TL.worker): { color, keys: [[t, poseObject, ease]], path: [{t, zone, at:[x,z]} | {hop, start, end, zone, to:[x,z], n, h}],
                       blinks: [t], probesAt } ; positions are ZONE-LOCAL (x, z); the page passes zoneX.
   Rig (desk units; the box is 1.36 x 1.00 x 1.08): feet 0.06, legs 0.10, a pill torso 0.46 tall, a 0.205 head; standing height ~1.10. */
import * as THREE from 'three';
import { clamp, lerp, seg, E, springU, rad } from '../kit/util.js';
import { EASE } from '../kit/tl.js';

const FPS = 30;
export const BASE = { yaw: 0, lean: 0, roll: 0, twist: 0, crouch: 0, sy: 1, sit: 0,
  hYaw: 0, hPitch: 0, hRoll: 0, gx: 0, gy: 0, eye: 1, squint: 0,
  aLu: 0.05, aLo: 0.14, aLe: 0.2, aRu: 0.05, aRo: 0.14, aRe: 0.2, lLf: 0, lRf: 0 };
const HEAD = ['hYaw', 'hPitch', 'hRoll', 'gx', 'gy', 'eye', 'squint'], ARMS = ['aLu', 'aLo', 'aLe', 'aRu', 'aRo', 'aRe'];
const R = { foot: [0.078, 0.046, 0.112], footZ: 0.03, leg: [0.052, 0.07], hipX: 0.088, hipY: 0.165, torsoH: 0.46, torsoR: [0.198, 0.162], torsoZ: 0.84,
  neck: [0.058, 0.05], headR: 0.205, shoulder: [0.178, 0.355], upper: [0.048, 0.12], fore: [0.045, 0.1], hand: 0.052,
  eye: { r: 0.027, len: 0.046, yaw: 0.35, pitch: -0.03, flat: 0.45 } };

export function makeWorker(ctx, parent, spec, zoneX = () => 0, rimLight = null) {
  const col = spec.color || '#8d84d4';
  const body = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.5, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.42, sheen: 0.35, sheenRoughness: 0.75, sheenColor: new THREE.Color('#ffffff') });
  // fix r1: clamp the RED rim on the worker only (it left a pink patch on the crown). The set's rim spot is matched in the shader by its
  // view-space position (uRimPos) and its direct light scaled by uRimK; the violet rim (solution) and every other light are untouched.
  const rimU = { uRimPos: { value: new THREE.Vector3(1e6, 1e6, 1e6) }, uRimK: { value: 1 } };
  if (rimLight) {
    body.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, rimU);
      const chunk = THREE.ShaderChunk.lights_fragment_begin.replace('getSpotLightInfo( spotLight, geometryPosition, directLight );',
        'getSpotLightInfo( spotLight, geometryPosition, directLight );\n\t\tif ( distance( spotLight.position, uRimPos ) < 0.001 ) directLight.color *= uRimK;');
      if (chunk === THREE.ShaderChunk.lights_fragment_begin) throw new Error('worker: rim clamp hook not found');
      sh.fragmentShader = 'uniform vec3 uRimPos;\nuniform float uRimK;\n' + sh.fragmentShader.replace('#include <lights_fragment_begin>', chunk);
    };
    body.customProgramCacheKey = () => 'worker-rimclamp';
  }
  const RIM_RED_K = 0.3;
  const rimSync = (cam) => { rimU.uRimPos.value.setFromMatrixPosition(rimLight.matrixWorld).applyMatrix4(cam.matrixWorldInverse);
    const c = rimLight.color; rimU.uRimK.value = c.r > c.b ? RIM_RED_K : 1; };
  const ink = new THREE.MeshPhysicalMaterial({ color: '#121018', roughness: 0.18, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.08 });
  const add = (p, geo, mat = body) => { const m = ctx.add(p, new THREE.Mesh(geo, mat), { cast: true, recv: true }); if (rimLight && mat === body) m.onBeforeRender = (r, sc, cam) => rimSync(cam); return m; };
  const G = (p) => { const g = new THREE.Group(); p.add(g); return g; };
  const root = G(parent), squash = G(root), hips = G(squash);
  hips.position.y = R.hipY;
  // torso: a soft pill (superellipse lathe), flattened front-to-back
  const prof = []; for (let i = 0; i <= 48; i++) { const s = i / 48, r = lerp(R.torsoR[0], R.torsoR[1], s) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 4)), 0.25); prof.push(new THREE.Vector2(Math.max(r, 1e-4), s * R.torsoH)); }
  const torso = add(hips, new THREE.LatheGeometry(prof, 64)); torso.scale.z = R.torsoZ; torso.position.y = -0.03;
  // legs + feet
  const legs = [-1, 1].map((s) => { const hip = G(hips); hip.position.set(s * R.hipX, 0.01, 0); const leg = add(hip, new THREE.CapsuleGeometry(R.leg[0], R.leg[1], 8, 20)); leg.position.y = -R.leg[1] / 2 - 0.02;
    const foot = add(hip, new THREE.SphereGeometry(1, 32, 20)); foot.scale.set(...R.foot); foot.position.set(0, -R.hipY + R.foot[1], R.footZ); return hip; });
  // neck + head + eyes
  const neck = G(hips); neck.position.y = R.torsoH - 0.05; add(neck, new THREE.CylinderGeometry(R.neck[0], R.neck[0] * 1.08, R.neck[1], 24)).position.y = R.neck[1] / 2;
  const head = G(neck); head.position.y = R.neck[1] - 0.005;
  const skull = add(head, new THREE.SphereGeometry(R.headR, 64, 48)); skull.position.y = R.headR * 0.95; skull.scale.set(1.0, 0.95, 0.94);
  const eyesG = G(head); eyesG.position.y = R.headR * 0.95;
  const eyes = [-1, 1].map((s) => { const e = G(eyesG); e.rotation.set(-R.eye.pitch, s * R.eye.yaw, 0, 'YXZ');
    const m = ctx.add(e, new THREE.Mesh(new THREE.CapsuleGeometry(R.eye.r, R.eye.len, 8, 20), ink), { cast: false, recv: false }); m.position.z = R.headR * 0.94 - 0.008; m.scale.z = R.eye.flat; return m; });
  // arms: shoulder -> upper -> elbow -> fore -> hand
  const arms = [-1, 1].map((s) => { const sh = G(hips); sh.position.set(s * R.shoulder[0], R.shoulder[1], 0);
    add(sh, new THREE.SphereGeometry(R.upper[0] * 1.05, 24, 16));
    add(sh, new THREE.CapsuleGeometry(R.upper[0], R.upper[1], 8, 20)).position.y = -R.upper[1] / 2;
    const el = G(sh); el.position.y = -R.upper[1];
    add(el, new THREE.CapsuleGeometry(R.fore[0], R.fore[1], 8, 20)).position.y = -R.fore[1] / 2;
    add(el, new THREE.SphereGeometry(R.hand, 28, 20)).position.y = -R.fore[1] - R.hand * 0.55;
    return { sh, el, s }; });
  // a soft contact shadow under the feet (AO; fades with height)
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const blob = ctx.add(parent, new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shTex, transparent: true, opacity: 0.3, depthWrite: false })), { recv: false, decal: true });
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1;

  // ---------- timing tables ----------
  const keys = (spec.keys || []).map(([t, p, e]) => [t, { ...BASE, ...p }, e || 'soft']).sort((a, b) => a[0] - b[0]);
  const abs = (z, xz) => [zoneX(z) + xz[0], xz[1]];
  const path = []; let cur = null;
  for (const m of (spec.path || []).slice().sort((a, b) => (a.t ?? a.start) - (b.t ?? b.start))) {
    if (m.hop) { const to = abs(m.zone, m.to); path.push({ ...m, from: cur, to3: to }); cur = to; } else { cur = abs(m.zone, m.at); path.push({ t: m.t, at3: cur }); }
  }
  const hops = path.filter((m) => m.hop);
  const blinks = (spec.blinks || []).slice();

  function poseAt(t) {
    if (!keys.length) return { ...BASE };
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b, e] = keys[i], u = EASE[e]((t - t0) / (t1 - t0)), o = {}; for (const k in a) o[k] = lerp(a[k], b[k], u); return o; }
    return keys[keys.length - 1][1];
  }
  const ANT = 0.15, GND = 0.2;   // anticipation before a takeoff (s); ground fraction of each hop period
  /* root + hop layer at t: { x, z, y, sy, air (0..1), dir, w (hop weight), lift } */
  function rootAt(t) {
    let m = null; for (const p of path) if ((p.hop ? p.start - ANT : p.t) <= t) m = p;
    if (!m) m = path[0] || { at3: [0, 0] };
    const o = { x: 0, z: 0, y: 0, sy: 1, air: 0, dir: 0, w: 0, arms: 0, tuck: 0 };
    if (!m.hop) { [o.x, o.z] = m.at3; return o; }
    const A = m.from || m.to3, B = m.to3, n = m.n || 1, d = (m.end - m.start) / n, h = m.h ?? 0.4, dx = B[0] - A[0], dz = B[1] - A[1];
    o.dir = Math.abs(dx) + Math.abs(dz) > 0.05 ? Math.atan2(dx, dz) : 0;
    o.w = E.soft(seg(t, m.start - ANT, m.start)) * (1 - E.soft(seg(t, m.end + 0.05, m.end + 0.35)));
    if (t < m.start) { [o.x, o.z] = A; const c = E.soft(seg(t, m.start - ANT, m.start)); o.sy = 1 - 0.13 * c; o.arms = -c; return o; }
    if (t >= m.end) { [o.x, o.z] = B; const a = t - m.end; o.sy = 1 - 0.12 * springU(a, 0.42, 3.4); o.arms = -0.6 * Math.max(0, springU(a, 0.6, 2.5)); return o; }
    const k = Math.min(n - 1, Math.floor((t - m.start) / d)), ph = (t - m.start - k * d) / d;          // hop k, phase 0..1
    const pa = clamp(ph / (1 - GND)), onG = ph > 1 - GND;                                                 // airborne phase; ground squash at the end of each hop
    const u = (k + (onG ? 1 : pa)) / n; o.x = lerp(A[0], B[0], u); o.z = lerp(A[1], B[1], u);
    if (!onG) { o.y = h * 4 * pa * (1 - pa); o.sy = 1 + 0.085 * Math.abs(1 - 2 * pa); o.air = Math.sin(Math.PI * pa); o.arms = 0.6 * o.air; o.tuck = o.air; }
    else { const g = (ph - (1 - GND)) / GND; o.sy = 1 - 0.14 * Math.sin(Math.PI * g); o.arms = -0.5 * Math.sin(Math.PI * g); }
    return o;
  }
  const blinkAt = (t) => { let k = 1; for (const b of blinks) { const f = (t - b) * FPS; if (f > -2 && f < 4) k = Math.min(k, f < 0 ? 1 - (f + 2) / 2 : f < 1 ? 0.04 : (f - 1) / 3); } return clamp(k, 0.04, 1); };

  return {
    root, probes: { worker: hips, 'worker.head': skull },
    fast(n) { const t = n / FPS; return hops.some((m) => t >= m.start - ANT && t <= m.end + 0.1); },
    update(t) {
      const P = poseAt(t), H = poseAt(t - 2 / FPS), A = poseAt(t - 3 / FPS), r = rootAt(t);
      for (const k of HEAD) P[k] = H[k]; for (const k of ARMS) P[k] = A[k];
      // the hop layer: face the travel direction, arms swing, legs tuck
      let dy = r.dir - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const yaw = P.yaw + dy * 0.78 * r.w;
      const breath = 1 + 0.009 * Math.sin((2 * Math.PI * t) / 3.2);
      root.position.set(r.x, r.y, r.z); root.rotation.y = yaw;
      const sy = P.sy * r.sy * breath, sxz = 1 / Math.sqrt(sy); squash.scale.set(sxz, sy, sxz);
      const sitDrop = 0.105 * P.sit;
      hips.position.y = R.hipY - P.crouch - sitDrop; hips.rotation.set(P.lean, P.twist, P.roll, 'YXZ');
      legs.forEach((hip, i) => { const f = (i ? P.lRf : P.lLf) + 1.45 * P.sit + 0.55 * r.tuck; hip.rotation.set(-f + P.lean * (1 - P.sit) * 0.6, 0, 0); });
      neck.rotation.set(0, 0, 0); head.rotation.set(P.hPitch, P.hYaw, P.hRoll, 'YXZ');
      eyesG.rotation.set(-P.gy * 0.16, P.gx * 0.22, 0, 'YXZ');
      const op = clamp(P.eye * blinkAt(t), 0.04, 1.25) * (1 - 0.55 * P.squint);
      eyes.forEach((e) => { e.scale.y = op; e.position.y = 0.012 * P.squint; });
      const sw = r.arms;   // hop arm swing: + = out/up in flight, - = back at takeoff/landing
      arms.forEach(({ sh, el, s }) => { const L = s > 0, up = (L ? P.aLu : P.aRu) + 0.35 * sw, out = (L ? P.aLo : P.aRo) + 0.45 * Math.max(0, sw), elb = L ? P.aLe : P.aRe;
        sh.rotation.set(-up, 0, s * out, 'XYZ'); el.rotation.set(-elb, 0, 0); });
      const lift = r.y; blob.position.set(r.x, 0.002, r.z + 0.02); const k = clamp(1 - lift / 0.7); blob.material.opacity = 0.32 * k * k; blob.scale.set(1 + 0.4 * lift, 1 + 0.4 * lift, 1);
      if (P.sit > 0.01) blob.scale.set(1.1, 1.0 + 0.6 * P.sit, 1);
    },
  };
}
