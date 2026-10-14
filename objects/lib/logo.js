/* motion-pack/objects/lib/logo.js (2026-10-14, round 3, owned): extrude an SVG mark into a bevelled 3D logo with material presets.
     makeLogoExtrude(ctx, parent, o) -> { group, meshes, set({yaw, tilt, slice, scale}), update(t), probes }
   o.svg: an SVG path `d` string (or several, array) in a 100 x 100 box, y down (the placeholder default is the pack's own orbit mark; never a third-party
          logo: a real mark is the user's own asset). Holes follow the SVG winding (three SVGLoader.createShapes).
   o.preset: chrome | glass | iridescent | satin (o.color tints it); o.depth / o.bevel in world units for a mark o.size wide.
   o.slice: null or { y: -0.5..0.5 (fraction of the mark height), offset: [x, y, z] (in the mark's spinning frame) } splits the mark along a horizontal line with two clipping planes;
          set({ slice: k }) slides the upper part by k * offset (the "sliced mark" beat). Turns on renderer.localClippingEnabled.
   update(t) is closed form: yaw = yaw0 + 2 pi * spin * t, a slow tilt wobble; seek-safe (no Date, no Math.random). */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './mat.js';

export const ORBIT_MARK = ['M88 50 A38 38 0 1 0 12 50 A38 38 0 1 0 88 50 Z M76 50 A26 26 0 1 1 24 50 A26 26 0 1 1 76 50 Z', 'M98 16 A10 10 0 1 0 78 16 A10 10 0 1 0 98 16 Z'];
export const LOGO_PRESETS = ['chrome', 'glass', 'iridescent', 'satin'];
export function logoMaterial(preset = 'chrome', color = null, ctx = null) {
  const env = ctx && ctx.metalEnv; let m;
  if (preset === 'glass') m = new THREE.MeshPhysicalMaterial({ color: color || '#ffffff', roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.35, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.03, attenuationColor: new THREE.Color(color || '#cfe3ff'), attenuationDistance: 1.2, specularIntensity: 1, envMapIntensity: 1.3 });
  else if (preset === 'iridescent') m = new THREE.MeshPhysicalMaterial({ color: color || '#d8d2ff', roughness: 0.16, metalness: 0.55, iridescence: 1, iridescenceIOR: 1.65, iridescenceThicknessRange: [180, 820], clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
  else if (preset === 'satin') m = MAT.satin(color || '#f3f1ec', { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  else if (preset === 'chrome') m = new THREE.MeshPhysicalMaterial({ color: color || '#eceef2', roughness: 0.09, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.05, envMapIntensity: 1.25 });
  else throw new Error('logoExtrude: preset must be one of ' + LOGO_PRESETS.join(' | '));
  if (env) m.envMap = env; return m;
}
export function logoGeometry(svg = ORBIT_MARK, { depth = 0.22, bevel = 0.035, size = 1.6, curve = 48 } = {}) {
  const ds = Array.isArray(svg) ? svg : [svg], shapes = [];
  for (const d of ds) { const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${d}"/></svg>`); for (const p of data.paths) shapes.push(...SVGLoader.createShapes(p)); }
  const k = size / 100; let geo = new THREE.ExtrudeGeometry(shapes, { depth: depth / k, bevelEnabled: true, bevelThickness: bevel / k, bevelSize: bevel / k * 0.8, bevelSegments: 8, curveSegments: curve });
  geo.scale(k, -k, k); flipWinding(geo); geo.computeBoundingBox(); const c = new THREE.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
  geo.deleteAttribute('normal'); geo = toCreasedNormals(geo, Math.PI / 5); flatCaps(geo); geo.computeBoundingBox();   // smooth bevels, crisp face / wall edges
  return geo;
}
/* the front and back caps keep their exact face normal: averaging their rim with the first bevel ring streaks the long cap triangles */
function flatCaps(geo) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array;
  for (let i = 0; i < P.length; i += 9) {
    const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (Math.abs(nz) > 0.9999) for (let k = 0; k < 3; k++) { N[i + 3 * k] = 0; N[i + 3 * k + 1] = 0; N[i + 3 * k + 2] = Math.sign(nz); }
  }
  geo.attributes.normal.needsUpdate = true;
}
/* the SVG y flip (a mirror) turns every triangle inside out: swap the 2nd and 3rd vertex of each triangle (indexed or not) */
function flipWinding(geo) {
  if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); } ix.needsUpdate = true; return; }
  for (const name of Object.keys(geo.attributes)) { const at = geo.attributes[name], n = at.itemSize, arr = at.array;
    for (let v = 0; v < at.count; v += 3) for (let j = 0; j < n; j++) { const i1 = (v + 1) * n + j, i2 = (v + 2) * n + j, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; } at.needsUpdate = true; }
}
export function makeLogoExtrude(ctx, parent, o = {}) {
  o = { svg: ORBIT_MARK, preset: 'chrome', color: null, depth: 0.22, bevel: 0.035, size: 1.6, spin: 0.12, yaw: 0, tilt: 0.12, wobble: 0.05, slice: null, cast: true, ...o };
  const group = new THREE.Group(); parent.add(group); const spinG = new THREE.Group(); group.add(spinG);
  const geo = logoGeometry(o.svg, o);
  const mat = logoMaterial(o.preset, o.color, ctx), meshes = [], parts = [];
  if (o.slice) {
    if (ctx.renderer) ctx.renderer.localClippingEnabled = true; const h = geo.boundingBox.max.y - geo.boundingBox.min.y, y0 = o.slice.y * h;
    for (const [sign, name] of [[1, 'upper'], [-1, 'lower']]) { const g = new THREE.Group(); spinG.add(g); const m = mat.clone(); m.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, sign, 0), -sign * y0)]; m.clipShadows = true; m.userData.local = m.clippingPlanes[0].clone();
      meshes.push(ctx.add(g, new THREE.Mesh(geo, m), { cast: o.cast, recv: true, name: 'logo-' + name })); parts.push(g); }
  } else { meshes.push(ctx.add(spinG, new THREE.Mesh(geo, mat), { cast: o.cast, recv: true, name: 'logo' })); parts.push(spinG); }
  const off = new THREE.Vector3(...((o.slice && o.slice.offset) || [0.25, 0.08, 0.12]));
  const api = { group, meshes, geometry: geo, material: mat, o,
    set({ yaw = o.yaw, tilt = o.tilt, slice = 0, scale = 1 } = {}) { spinG.rotation.set(tilt, yaw, 0); group.scale.setScalar(Math.max(1e-4, scale)); if (o.slice) { parts[0].position.copy(off).multiplyScalar(slice); group.updateMatrixWorld(true);   // clipping planes live in world space: carry the local cut with each part
        meshes.forEach((m, i) => m.material.clippingPlanes[0].copy(m.material.userData.local).applyMatrix4(parts[i].matrixWorld)); } return api; },
    update(t, extra = {}) { return api.set({ yaw: o.yaw + 2 * Math.PI * o.spin * t + (extra.yaw || 0), tilt: o.tilt + o.wobble * Math.sin(2 * Math.PI * 0.21 * t + 0.7), slice: extra.slice || 0, scale: extra.scale ?? 1 }); },
    probes: { logo: meshes[0] } };
  api.set({}); return api;
}
