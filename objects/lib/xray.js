/* motion-pack/objects/lib/xray.js (xp-hardware, 2026-10-16): the X-RAY / WIREFRAME-TO-SOLID transition for any object (a procedural prop or a loaded GLB).
     const X = makeXray(ctx, root, { axis: 'y', color: '#5cc8ff', angle: 24 });   X.set(k)   (k 0 = all wireframe, 1 = all solid; a pure function of k)
   How: every mesh under `root` gets an edge outline (EdgesGeometry, crease angle `angle` degrees) as an unlit line child; one world-space clipping plane sweeps
   along `axis` across the object's bounding box: below the plane the solid draws, above it the outline, and a thin glowing scan band rides the plane
   (MeshBasic + its bloom twin, the kit's emissive contract). Lines are not in ctx.ALL, so the kit's bloom pass draws them with their own colour: they glow.
   Needs renderer.localClippingEnabled (set here). `ghost` (0..1) keeps a faint solid silhouette under the outline so the x-ray never reads as empty. */
import * as THREE from 'three';
import { clamp } from '../kit/util.js';

export function makeXray(ctx, root, o = {}) {
  o = { axis: 'y', color: '#5cc8ff', angle: 24, ghost: 0.12, band: 0.006, reverse: false, ...o };
  ctx.renderer.localClippingEnabled = true;
  const ax = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }[o.axis] || new THREE.Vector3(0, 1, 0);
  const solidPlane = new THREE.Plane(ax.clone().negate(), 0), wirePlane = new THREE.Plane(ax.clone(), 0);
  const lineM = new THREE.LineBasicMaterial({ color: ctx.emis(o.color, 1.0), transparent: true, opacity: 0.95, clippingPlanes: [wirePlane], depthWrite: false });
  const ghostM = new THREE.MeshBasicMaterial({ color: ctx.emis(o.color, 0.08), transparent: true, opacity: o.ghost, depthWrite: false, clippingPlanes: [wirePlane], side: THREE.DoubleSide });
  const meshes = []; root.updateMatrixWorld(true); root.traverse((m) => { if ((m.isMesh || m.isInstancedMesh) && !m.userData.xraySkip) meshes.push(m); });
  const lines = [], ghosts = [], seen = new Map();
  for (const m of meshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mt of mats) { if (!seen.has(mt)) { seen.set(mt, mt.clippingPlanes); mt.clippingPlanes = [...(mt.clippingPlanes || []), solidPlane]; mt.needsUpdate = true; } }
    if (!m.isInstancedMesh) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, o.angle), lineM); l.userData.xraySkip = true; l.renderOrder = 3; m.add(l); lines.push(l);
      if (o.ghost > 0) { const gm = new THREE.Mesh(m.geometry, ghostM); gm.userData.xraySkip = true; gm.renderOrder = 2; m.add(gm); ghosts.push(gm); }
    }
  }
  // the scan band: a thin emissive slab spanning the bounding box at the plane
  const bb = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
  const measure = () => { root.updateMatrixWorld(true); bb.setFromObject(root, false); bb.getSize(size); bb.getCenter(ctr); return [bb.min.dot(ax), bb.max.dot(ax)]; };   // world box at the CURRENT pose (call set() after posing)
  let [lo, hi] = measure();
  const bandM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), bandB = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const band = ctx.add(ctx.scene, new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bandM), { recv: false, bloom: bandB, name: 'xray.band' }); band.userData.xraySkip = true;
  const fitBand = () => { const bw = o.axis === 'x' ? [o.band, size.y * 1.08, size.z * 1.08] : o.axis === 'z' ? [size.x * 1.08, size.y * 1.08, o.band] : [size.x * 1.08, o.band, size.z * 1.08]; band.scale.set(...bw.map((v) => Math.max(1e-4, v))); };
  const api = { lines, ghosts, band, planes: [solidPlane, wirePlane], range: [lo, hi],
    /* k: 0 wireframe .. 1 solid. The plane sits at lerp(lo, hi, k) (reverse: from the top down); band glows while the sweep is inside the object */
    set(k = 1, { color = o.color, level = 1 } = {}) {
      k = clamp(k); [lo, hi] = measure(); api.range = [lo, hi]; fitBand(); const u = o.reverse ? 1 - k : k, c = lo - 0.002 + (hi - lo + 0.004) * u;
      solidPlane.constant = c; wirePlane.constant = -c;
      if (o.reverse) { solidPlane.normal.copy(ax); solidPlane.constant = -c; wirePlane.normal.copy(ax).negate(); wirePlane.constant = c; }
      const live = k > 0.0005 && k < 0.9995, glow = live ? level : 0;
      band.visible = live; band.position.copy(ctr).addScaledVector(ax, c - ctr.dot(ax));
      bandM.color.copy(ctx.emis(color, 1.1 * glow)); bandB.color.copy(ctx.emis(color, 1.8 * glow));
      const wireOn = k < 0.9995; for (const l of lines) l.visible = wireOn; for (const gm of ghosts) gm.visible = wireOn;
      lineM.color.copy(ctx.emis(color, 1.0 * level));
      return api;
    },
    /* put every material back as it was (a scene that drops the x-ray after its shot) */
    dispose() { for (const [mt, cp] of seen) { mt.clippingPlanes = cp || null; mt.needsUpdate = true; } for (const l of lines) l.removeFromParent(); for (const gm of ghosts) gm.removeFromParent(); band.removeFromParent(); } };
  api.set(1); return api;
}
