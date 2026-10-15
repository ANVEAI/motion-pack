/* motion-pack/objects/lib/studio-hw.js (xp-hardware, 2026-10-16): the DARK product studio and the "rim + top + sweep" light rig of a hardware reveal.
     const S = makeDarkStudio(ctx, { paper: '#07080a' });            dark seamless cyc, a dark IBL whose chrome env still carries soft strips (metals read premium)
     const R = makeHwRig(ctx, { kelvin: 5600, target: [0, 0.15, 0] });
     R.update(n, slot, { rim: 1, top: 0.8, key: 0.25, sweep: 0.4, sweepAxis: 'x', edge: 0 })   levels 0..~2; sweep = 0..1 position of the travelling strip (null = off)
   The craft (learned from device keynote reveals, not copied): the product first appears as an EDGE-LIGHT silhouette (two strong rims from behind, nothing
   from the front), then a long thin soft strip TRAVELS across it so one highlight line runs over the glass and the chamfers, then a top softbox and a low
   front key bring the material up for the hero turn. Every light is fixture-free (no stands in frame). Positions jitter per subframe by a fraction of the
   source size, so four subframes average into a soft source (the kit's area-light trick); levels are pure functions of the arguments. */
import * as THREE from 'three';
import { kelvin, clamp, lerp } from '../kit/util.js';
import { linCol } from './mat.js';
import { makeStage } from '../stage.js';

export function makeDarkStudio(ctx, o = {}) {
  const st = makeStage(ctx, { mode: 'white', paper: o.paper || '#07080a', cycFar: o.cycFar ?? -10, cycR: o.cycR ?? 6, camAz: o.camAz ?? -9 });
  // makeStage also builds the kit's bright key / rim / top; a dark studio keeps them off (their intensity is only ever set by stage.update, never called here)
  return st;
}

const J = [[-0.6, -0.2], [0.2, -0.45], [0.6, 0.2], [-0.2, 0.45]];
export function makeHwRig(ctx, o = {}) {
  o = { kelvin: 5600, target: [0, 0.15, 0], span: 1.0, rimCd: 26, topCd: 22, keyNits: 5, sweepNits: 22, sweepLen: 2.6, sweepW: 0.09, edgeCd: 60, cool: '#dfe9ff', ...o };
  const { scene } = ctx, T = new THREE.Vector3(...o.target), s = o.span, col = linCol(kelvin(o.kelvin)), cool = new THREE.Color(o.cool);
  const spot = (c, cone, pen, shadow) => { const l = new THREE.SpotLight(c, 0, 0, (cone / 2) * Math.PI / 180, pen, 2); l.castShadow = !!shadow; if (shadow) { l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02; l.shadow.radius = 8; } scene.add(l); scene.add(l.target); l.target.position.copy(T); return l; };
  const rimL = spot(cool, 26, 0.9, false), rimR = spot(cool, 26, 0.9, false), top = spot(col, 56, 0.75, true), edgeL = spot(cool, 14, 0.6, false), edgeR = spot(cool, 14, 0.6, false);
  const key = new THREE.RectAreaLight(col, 0, 1.6 * s, 1.0 * s); scene.add(key);
  const sweep = new THREE.RectAreaLight(col, 0, o.sweepW * s, o.sweepLen * s); scene.add(sweep);
  const P = {   // positions relative to the target, scaled by span (behind = -z)
    rimL: [-1.6, 1.2, -2.4], rimR: [1.7, 1.0, -2.3], edgeL: [-2.6, 0.35, -2.0], edgeR: [2.6, 0.3, -2.1], top: [0.15, 4.2, 0.4], key: [-1.4, 1.1, 2.6],
  };
  const place = (l, p, j, soft = 0.12) => l.position.set(T.x + (p[0] + j[0] * soft) * s, T.y + (p[1] + j[1] * soft) * s, T.z + p[2] * s);
  return { rimL, rimR, top, key, sweep, edgeL, edgeR,
    /* S: { rim, top, key, edge (0..2 each), sweep: null | 0..1, sweepAxis 'x' | 'y', sweepFrom, sweepTo (units, along the axis, relative to the target), sweepZ, sweepY, hex } */
    update(n, slot, S = {}) {
      const j = J[((slot % 4) + 4) % 4];
      place(rimL, P.rimL, j); place(rimR, P.rimR, j); place(edgeL, P.edgeL, j, 0.05); place(edgeR, P.edgeR, j, 0.05); place(top, P.top, j, 0.3);
      rimL.intensity = rimR.intensity = o.rimCd * Math.max(0, S.rim ?? 1) * s * s; edgeL.intensity = edgeR.intensity = o.edgeCd * Math.max(0, S.edge ?? 0) * s * s;
      top.intensity = o.topCd * Math.max(0, S.top ?? 1) * s * s;
      key.position.set(T.x + P.key[0] * s, T.y + P.key[1] * s, T.z + P.key[2] * s); key.lookAt(T); key.intensity = o.keyNits * Math.max(0, S.key ?? 0.3);
      if (S.sweep == null) sweep.intensity = 0;
      else {
        const u = clamp(S.sweep), a = lerp(S.sweepFrom ?? -1.6, S.sweepTo ?? 1.6, u) * s, z = (S.sweepZ ?? 1.25) * s, y = (S.sweepY ?? 0.9) * s;
        if ((S.sweepAxis || 'x') === 'x') { sweep.position.set(T.x + a, T.y + y, T.z + z); sweep.lookAt(T.x + a * 0.35, T.y, T.z); }
        else { sweep.position.set(T.x, T.y + a + y, T.z + z); sweep.lookAt(T.x, T.y + a * 0.35, T.z); sweep.rotateZ(Math.PI / 2); }
        sweep.intensity = o.sweepNits * Math.max(0, S.sweepLevel ?? 1) * Math.sin(Math.PI * clamp(u * 1.0)) ** 0.35;
      }
      return { rim: rimL.intensity, top: top.intensity, key: key.intensity, sweep: sweep.intensity };
    } };
}
