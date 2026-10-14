/* motion-pack/objects/lib/flat.js (2026-10-14, round 3, owned): flat 2D pieces placed in a three.js scene.
     makeMascotPlane(ctx, parent, o) -> { group, mesh, update(t) }   the 2D mascot (characters/mascot2d.js) drawn into a canvas texture on a plane each
                                        update(t); o.spec is the mascot spec in the canvas' own px (o.px x o.px, feet near the bottom), o.height world units. */
import * as THREE from 'three';
import { drawMascot2d } from '../characters/mascot2d.js';
export function makeMascotPlane(ctx, parent, o = {}) {
  o = { px: 512, height: 1.2, spec: {}, ...o };
  const c = document.createElement('canvas'); c.width = c.height = o.px; const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const spec = { path: [[0, [o.px / 2, o.px * 0.94]]], size: o.px / 300, ...o.spec };
  const mesh = ctx.add(parent, new THREE.Mesh(new THREE.PlaneGeometry(o.height, o.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, toneMapped: false })), { cast: false, recv: false, name: 'mascot2d' });
  const api = { group: mesh, mesh, update(t) { g.clearRect(0, 0, o.px, o.px); drawMascot2d(g, t, spec, { W: o.px, H: 1080 }); tex.needsUpdate = true; return api; } };
  api.update(0); return api;
}
