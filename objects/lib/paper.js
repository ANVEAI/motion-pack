/* PROVENANCE: extracted from kit/props.js sheetTexture, makeSheet, makePaperBlock (2026-10-13). Behaviour unchanged unless noted; see objects/README.md. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp } from '../kit/util.js';
import { canvasTex } from './mat.js';

/* ---------- a paper card that bends (inextensible curl along its length), printed front, plain back ---------- */
export function sheetTexture(o) {
  return canvasTex(512, Math.round((512 * o.h) / o.w), (g, w, h) => {
    const r = (o.corner / o.w) * w; g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, r); g.fill();
    const hd = o.header || [0.08, 0.23, 0.10, 0.80]; g.fillStyle = o.red; g.beginPath(); g.roundRect(w * hd[2], h * hd[0], w * hd[3], h * (hd[1] - hd[0]), 10); g.fill();
    g.fillStyle = '#ffffff'; [[0.15, 0.08], [0.27, 0.12], [0.43, 0.08], [0.55, 0.16]].forEach(([x, ww]) => { g.beginPath(); g.roundRect(w * x, h * (hd[0] + (hd[1] - hd[0]) * 0.38), w * ww, h * (hd[1] - hd[0]) * 0.24, 5); g.fill(); });
    [[0.33, 0.70, '#d9d3c5'], [0.43, 0.58, '#e2ddd1'], [0.53, 0.66, '#e2ddd1'], [0.63, 0.44, '#e2ddd1'], [0.75, 0.6, '#e8e4da'], [0.84, 0.5, '#e8e4da']].forEach(([y, ww, c]) => { g.fillStyle = c; g.beginPath(); g.roundRect(w * 0.12, h * y, w * ww, h * 0.032, 6); g.fill(); });
  });
}
export function makeSheet(ctx, parent, o, tex) {
  const SEG = 16, geo = new THREE.PlaneGeometry(o.w, o.h, 2, SEG); geo.rotateX(-Math.PI / 2);   // lying flat; local -z = the printed header end
  const base = geo.attributes.position.array.slice();
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, alphaTest: 0.5, alphaToCoverage: true, side: THREE.FrontSide });
  const back = new THREE.MeshStandardMaterial({ color: '#f4f2ee', alphaMap: tex, roughness: 0.9, alphaTest: 0.5, alphaToCoverage: true, side: THREE.BackSide });
  const g = new THREE.Group(); parent.add(g);
  const mf = ctx.add(g, new THREE.Mesh(geo, front), { cast: true, recv: true }), mb = ctx.add(g, new THREE.Mesh(geo, back), { cast: false, recv: true });
  let lastKey = '';
  return {
    group: g,
    /* curl in 1/units: far = toward local -z (header end), near = toward +z; positive curls up. Inextensible: integrate the angle. */
    bend(far, near) {
      const key = far.toFixed(4) + ',' + near.toFixed(4); if (key === lastKey) return; lastKey = key;
      const pos = geo.attributes.position.array, rows = SEG + 1, hh = o.h / 2, ds = o.h / SEG, ys = new Float32Array(rows), zs = new Float32Array(rows), mid = SEG / 2;
      ys[mid] = 0; zs[mid] = 0; let th = 0;
      for (let j = mid + 1; j < rows; j++) { const s = (j - mid) * ds, k = near * clamp((s / hh - 0.08) / 0.5); th += k * ds; ys[j] = ys[j - 1] + Math.sin(th) * ds; zs[j] = zs[j - 1] + Math.cos(th) * ds; }
      th = 0; for (let j = mid - 1; j >= 0; j--) { const s = (mid - j) * ds, k = far * clamp((s / hh - 0.08) / 0.5); th += k * ds; ys[j] = ys[j + 1] + Math.sin(th) * ds; zs[j] = zs[j + 1] - Math.cos(th) * ds; }
      for (let i = 0; i < pos.length / 3; i++) { const z0 = base[i * 3 + 2], j = Math.round((z0 + hh) / ds); pos[i * 3 + 1] = ys[j]; pos[i * 3 + 2] = zs[j]; }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    },
    set(p, euler, s = 1, vis = true) { g.position.set(p[0], p[1], p[2]); g.rotation.set(euler[0], euler[1], euler[2], 'YXZ'); g.scale.setScalar(s); g.visible = vis; },
  };
}

/* a block of paper (the part of the stack that never moves): rounded box, page-edge lines on its sides */
export function makePaperBlock(ctx, parent, o) {
  const side = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f6f4ef'; g.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 3) { g.fillStyle = y % 6 === 2 ? '#e2ddd2' : '#ece8df'; g.fillRect(0, y, w, 1); } });
  const top = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), sideM = new THREE.MeshStandardMaterial({ map: side, roughness: 0.9 });
  const m = ctx.add(parent, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.h, o.d, 2, 0.012), [sideM, sideM, top, top, sideM, sideM]), { cast: true, recv: true });
  m.position.set(o.pos[0], o.h / 2, o.pos[2]); m.rotation.y = o.yaw || 0; return m;
}
