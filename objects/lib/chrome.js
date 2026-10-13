/* PROVENANCE: extracted from kit/props.js makeChromeBlob (2026-10-13). Behaviour unchanged unless noted; see objects/README.md. */
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { clamp, smin } from '../kit/util.js';

/* ---------- liquid chrome: one smooth-min SDF polygonised by MarchingCubes, reflecting the live scene (cube camera at its centre) ---------- */
export function makeChromeBlob(ctx, o, env) {
  const { renderer, scene } = ctx, RES = o.res, S = o.box, half = S / 2, live = !!o.live;
  let cubeRT = null, cubeCam = null, pmRT;
  if (live) { cubeRT = new THREE.WebGLCubeRenderTarget(o.envRes || 256, { type: THREE.HalfFloatType, generateMipmaps: false }); cubeCam = new THREE.CubeCamera(0.05, 120, cubeRT); scene.add(cubeCam); }
  pmRT = env.pmrem.fromCubemap(env.chromeRT.texture);   // calm default: the soft studio only (no busy reflections of slab edges)
  const mat = new THREE.MeshStandardMaterial({ metalness: 1, roughness: o.rough, envMap: pmRT.texture, envMapIntensity: 1 });
  mat.color.setRGB(o.f0, o.f0, o.f0, THREE.LinearSRGBColorSpace);
  const mc = new MarchingCubes(RES, mat, false, false, o.maxPoly || 80000); mc.isolation = 0; mc.scale.setScalar(half); mc.castShadow = true; mc.receiveShadow = false; mc.frustumCulled = false;
  scene.add(mc);
  const field = mc.field, cell = S / RES, rangeOf = (lo, hi) => [clamp(Math.floor((lo + half) / cell) - 1, 1, RES - 2), clamp(Math.ceil((hi + half) / cell) + 1, 1, RES - 2)];
  return {
    mesh: mc, cubeCam, mat,
    setEnvLevel(x) { mat.envMapIntensity = x; },
    /* prims: [{c:[x,y,z] world, r, s:[sx,sy,sz] ellipsoid scale}], k = smooth-min width, centre = MC box centre (world) */
    update(centre, prims, k) {
      mc.position.set(...centre); field.fill(-1); mc.normal_cache.fill(0);
      if (!prims.length) { mc.update(); return; }
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; const P = prims.map((p) => { const s = p.s || [1, 1, 1], c = [p.c[0] - centre[0], p.c[1] - centre[1], p.c[2] - centre[2]], m = p.r * Math.max(...s) + k + 2 * cell; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - m); hi[i] = Math.max(hi[i], c[i] + m); } return { c, r: p.r, s }; });
      const [x0, x1] = rangeOf(lo[0], hi[0]), [y0, y1] = rangeOf(lo[1], hi[1]), [z0, z1] = rangeOf(lo[2], hi[2]), R2 = RES * RES;
      for (let z = z0; z <= z1; z++) { const pz = (z - RES / 2) * cell;
        for (let y = y0; y <= y1; y++) { const py = (y - RES / 2) * cell, off = z * R2 + y * RES;
          for (let x = x0; x <= x1; x++) { const px = (x - RES / 2) * cell; let d = 1e9;
            for (let i = 0; i < P.length; i++) { const q = P[i], dx = (px - q.c[0]) / q.s[0], dy = (py - q.c[1]) / q.s[1], dz = (pz - q.c[2]) / q.s[2], di = (Math.sqrt(dx * dx + dy * dy + dz * dz) - q.r) * Math.min(q.s[0], q.s[1], q.s[2]); d = i === 0 ? di : smin(d, di, k); }
            field[off + x] = clamp(-d / (3 * cell), -1, 1); } } }
      mc.update();
    },
    /* live mode only: re-render reflections from `centre` (hides itself and `hide`); shadows refreshed for the cube and the main pass */
    updateEnv(centre, hide = []) {
      if (!live) return;
      const bg = scene.background; renderer.shadowMap.needsUpdate = true; mc.visible = false; hide.forEach((h) => (h.visible = false));
      scene.background = env.chromeRT.texture; cubeCam.position.set(...centre); cubeCam.update(renderer, scene); scene.background = bg;
      mc.visible = true; hide.forEach((h) => (h.visible = true)); renderer.shadowMap.needsUpdate = true;
      env.pmrem.fromCubemap(cubeRT.texture, pmRT);
    },
  };
}
