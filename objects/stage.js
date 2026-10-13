/* motion-pack/objects/stage.js: the shared STAGE scaffold every 3D demo/template starts from (the kit's polished s1 defaults).
     window.CONFIG = stageConfig({ name, seconds, colors: {...}, lights: {...} });
     runScene({ build(ctx) { st.stage = makeStage(ctx, { slab: [3.4, 0.64, 2.0] }); ... }, update(ctx, t, n, slot) { st.stage.update(n, slot); ... },
                camera: (ctx, t) => shot(ctx, t, SHOT), focus: ... });
   stage modes: slab (floating white slab on paper, the ANVE miniature look) | white (infinite seamless white cyc, no slab: mime-style world).
   Lights are fixture-free and always on unless `clicks` are given ({key, rim, top} output frames, the 3-frame flicker). */
import * as THREE from 'three';
import { E, lerp, seg, rad } from './kit/util.js';
import { LIGHTS, ENV, SET } from './kit/presets.js';
import { makeStudioEnv, makeSet, makeStudioLights } from './lib/set.js';

export function stageConfig(o = {}) {
  const fps = o.fps || 30, L = JSON.parse(JSON.stringify(LIGHTS)), clicks = o.clicks || {};
  L.key.click = clicks.key ?? -10; L.rim.click = clicks.rim ?? -10; L.top.click = clicks.top ?? -10;
  if (o.lights) for (const k of Object.keys(o.lights)) L[k] = { ...L[k], ...o.lights[k] };
  return { name: o.name || 'motion-pack-stage', fps, loopFrames: Math.round((o.seconds || 4) * fps), width: 1920, height: 1080, qaFrames: o.qaFrames || [],
    colors: { backdrop: '#f5f2ea', slab: '#fbfaf7', violet: '#4a18ed', red: '#e5483a', mint: '#34d399', amber: '#ffa64d', ink: '#111111', ...(o.colors || {}) },
    grade: { exposure: 1.0, bloom: 0.85, dofK: 60, dofMax: 3.5, shoulder: 0.90, grain: 0.02, vignette: 0.10, ...(o.grade || {}) },
    lights: L, env: { ...ENV, ...(o.env || {}) }, ...(o.extra || {}) };
}

export function makeStage(ctx, o = {}) {
  const C = ctx.C, mode = o.mode || 'slab', paper = o.paper || C.colors.backdrop;
  const env = makeStudioEnv(ctx, { paper, ...C.env, camAz: rad(o.camAz ?? -9), tint: ctx.K_KEY });
  ctx.metalEnv = env.pmrem.fromCubemap(env.chromeRT.texture).texture;   // metals (lib/devices.js) reflect the calm soft panels
  /* seamless cyc: an infinite floor that curves up into a far wall, so low and close cameras never see the black void.
     white mode: the cyc IS the world (no slab). slab mode: the cyc replaces the kit's flat floor plane (same height, same paper). */
  const cyc = (() => { const g = new THREE.Group(); ctx.scene.add(g);
    const prof = [], R = o.cycR ?? 8, far = o.cycFar ?? -16, top = 40; prof.push(new THREE.Vector2(60, 0), new THREE.Vector2(far + R, 0));
    for (let i = 1; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; prof.push(new THREE.Vector2(far + R - R * Math.sin(a), R - R * Math.cos(a))); } prof.push(new THREE.Vector2(far, top));
    const pos = [], W = 300; for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; pos.push(-W, a.y, a.x, W, a.y, a.x, -W, b.y, b.x, W, a.y, a.x, W, b.y, b.x, -W, b.y, b.x); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const m = ctx.add(g, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: paper, roughness: 1.0, side: THREE.DoubleSide })), { recv: true, name: 'cyc' });
    m.position.y = mode === 'white' ? (o.floorY ?? 0) : (o.floorY ?? SET.floorY); return { g, m }; })();
  let set;
  if (mode === 'white') set = { floor: cyc.m, slabG: cyc.g, slab: cyc.m, setDip() {} };
  else {
    const [w, h, d] = o.slab || SET.slab;
    set = makeSet(ctx, { floorY: o.floorY ?? SET.floorY, w, h, d, r: o.slabR ?? SET.slabR, paper, slab: C.colors.slab, underShadow: SET.underShadow });
    set.floor.visible = false; set.cyc = cyc.m;
  }
  const lights = makeStudioLights(ctx, set.slabG, { ...C.lights, fixtures: false, slabHalf: [5, 5] });
  return { env, set, lights, parent: set.slabG, update(n, slot, dip = 0, glint = null) { set.setDip(dip); return lights.update(n, slot, dip, glint); } };
}

/* a camera shot: numbers or [from, to] pairs eased over [t0, t1] (default the whole scene) with E.cam. Returns the kit camera contract. */
export function shot(ctx, t, S) {
  const u = E.cam(seg(t, S.t0 ?? 0, S.t1 ?? ctx.LEN)), v = (x) => (Array.isArray(x) && typeof x[0] === 'number' && x.length === 2 && S.pairs !== false ? lerp(x[0], x[1], u) : x);
  const A = ctx.aspect === 'tall' && S.tall ? { ...S, ...S.tall } : S;
  return { fov: v(A.fov ?? 18), elev: v(A.elev ?? 25), az: v(A.az ?? -9), dist: v(A.dist ?? 12.6), target: A.target || [0, 0.4, 0], screen: A.screen || (ctx.aspect === 'tall' ? [540, 1100] : [960, 560]), punch: A.punch || 0, near: A.near ?? Math.max(0.2, 0.25 * v(A.dist ?? 12.6)), far: A.far };   // near scales with distance: close-ups never clip the floor
}
/* cut list of shots: [{t, ...shot}] -> the shot active at t (hard cuts); each shot eases within its own [t, next t) window */
export function cutShots(ctx, t, list) { let i = 0; for (let k = 0; k < list.length; k++) if (list[k].t <= t + 1e-9) i = k; const S = list[i], t1 = list[i + 1] ? list[i + 1].t : ctx.LEN; return shot(ctx, t, { ...S, t0: S.t, t1 }); }
