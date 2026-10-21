/* motion-pack/objects/lib/devices.js: NEW generic premium props (owned, procedural): LAPTOP, PHONE, MUG.
   Units: the studio-kit world (the ANVE box is 1.36 x 1.00 x 1.08; 1 unit ~ 25 cm), so a laptop is ~1.2 wide. `scale` rescales.
   Premium rules (docs/evidence/visual.md 6.1): bevel everything (>= 2% of the smallest dimension), limited material set (lib/mat.js MAT),
   no pure white/black, real contact via shadows + a soft AO decal, imperfection (roughness grain), no brand marks.
   Screens: a CanvasTexture drawn by `draw(g, w, h, state)` (default = an owned UI mock); `setScreen(level, state)` redraws only when
   the state key changes, colour is pre-multiplied with ctx.emis so the graded pixel reads the drawn hex. Pure functions of state. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, rad, TAU } from '../kit/util.js';
import { MAT, canvasTex, slabGeo, faceGeo, latheGeo, radialTex, grainTex } from './mat.js';

/* soft contact-occlusion decal (the kit rule: a decal only for contact occlusion, never as the shadow itself) */
function aoDecal(ctx, parent, w, d, opacity = 0.35) {
  const m = ctx.add(parent, new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: radialTex(), transparent: true, opacity, depthWrite: false })), { recv: false, decal: true });
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0015; m.renderOrder = 1; return m;
}
/* metals reflect the calm chrome env (big soft panels) when the stage provides it (ctx.metalEnv), else the dim fill and read dark */
const metal = (ctx, m) => { if (ctx.metalEnv) { m.envMap = ctx.metalEnv; m.envMapIntensity = 0.8; } return m; };
function screenMat(ctx, tex) { const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.copy(ctx.emis('#ffffff', 1)); return m; }
function liveTex(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { c, t, g: c.getContext('2d') }; }

/* ---------- default owned UI mocks ---------- */
export function uiDashboard(g, w, h, s = {}) {
  const k = s.progress ?? 0.6, acc = s.accent || '#4a18ed';
  g.fillStyle = '#f7f6f3'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w * 0.2, h);
  g.fillStyle = '#ece9e2'; g.fillRect(w * 0.2 - 2, 0, 2, h);
  [0.12, 0.2, 0.28, 0.36].forEach((y, i) => { g.fillStyle = i === 0 ? acc : '#d9d4ca'; g.beginPath(); g.roundRect(w * 0.03, h * y, w * 0.14 * (i ? 0.8 : 1), h * 0.035, h * 0.017); g.fill(); });
  g.fillStyle = '#111111'; g.font = `800 ${Math.round(h * 0.07)}px "Manrope"`; g.fillText(s.title || 'Today', w * 0.25, h * 0.15);
  for (let i = 0; i < 3; i++) { const x = w * (0.25 + i * 0.245); g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x, h * 0.22, w * 0.22, h * 0.2, h * 0.025); g.fill(); g.fillStyle = i === 0 ? acc : '#2a2930'; g.font = `800 ${Math.round(h * 0.075)}px "Manrope"`; g.fillText(s.kpis ? s.kpis[i] : ['12', '3', '0'][i], x + w * 0.02, h * 0.36); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(w * 0.25, h * 0.47, w * 0.71, h * 0.45, h * 0.025); g.fill();
  g.strokeStyle = acc; g.lineWidth = h * 0.012; g.lineJoin = 'round'; g.beginPath(); const N = 24;
  for (let i = 0; i <= N * k; i++) { const x = w * (0.28 + 0.65 * i / N), y = h * (0.85 - 0.3 * (0.5 + 0.5 * Math.sin(i * 0.55 + 0.6)) * (i / N)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
}
export function uiChat(g, w, h, s = {}) {
  const n = s.messages ?? 3, acc = s.accent || '#4a18ed';
  g.fillStyle = '#f7f6f3'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#111111'; g.font = `800 ${Math.round(w * 0.075)}px "Manrope"`; g.fillText(s.title || 'Assistant', w * 0.08, h * 0.12);
  const rows = [[0, 0.62, 'Can you draft the reply?'], [1, 0.7, 'Done. Sent to review.'], [0, 0.45, 'Perfect, thanks'], [1, 0.55, 'Anytime.']];
  rows.slice(0, n).forEach(([me, ww, txt], i) => { const y = h * (0.2 + i * 0.13), bw = w * ww, x = me ? w * 0.92 - bw : w * 0.08;
    g.fillStyle = me ? acc : '#ffffff'; g.beginPath(); g.roundRect(x, y, bw, h * 0.09, h * 0.04); g.fill();
    g.fillStyle = me ? '#ffffff' : '#1a1a1d'; g.font = `600 ${Math.round(w * 0.045)}px "Manrope"`; g.fillText(txt, x + w * 0.04, y + h * 0.057); });
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(w * 0.06, h * 0.86, w * 0.88, h * 0.07, h * 0.035); g.fill();
}

/* ======================= LAPTOP =======================
   o: { w 1.2, d 0.84, t 0.05 (base), lidT 0.03, color, keys true, draw uiDashboard, screenRes [1280, 800], scale 1 }
   state: open 0..1 (0 closed, 1 = 112 deg), screen 0..1 brightness, ui (object passed to draw). Origin = base bottom-centre. */
export function makeLaptop(ctx, parent, o = {}) {
  o = { w: 1.2, d: 0.84, t: 0.05, lidT: 0.028, color: '#c9cbd0', keys: true, draw: uiDashboard, screenRes: [1280, 800], scale: 1, seed: 3, ...o };
  const root = new THREE.Group(); root.scale.setScalar(o.scale); parent.add(root);
  const alu = metal(ctx, MAT.anodised(o.color, { roughness: 0.34, roughnessMap: grainTex(o.seed, 256, 0.06, 0.55) }));
  const base = ctx.add(root, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.t, o.d, 6, Math.min(o.t * 0.48, 0.03)), alu), { cast: true, recv: true, name: 'laptop' }); base.position.y = o.t / 2 + 0.006;
  // feet (rubber, 4) lift it 6 mm: a real contact shadow line under the base
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const f = ctx.add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.008, 24), MAT.rubber()), { cast: true }); f.position.set(sx * (o.w / 2 - 0.09), 0.004, sz * (o.d / 2 - 0.08)); });
  // keyboard well (dark satin inset) + keys (instanced bevelled caps) + trackpad (glass-smooth inset)
  const top = o.t + 0.006, well = ctx.add(root, new THREE.Mesh(faceGeo(o.w * 0.86, o.d * 0.44, 0.02), MAT.darkMetal('#3a3b40', { roughness: 0.6, metalness: 0.4 })), { recv: true });
  well.rotation.x = -Math.PI / 2; well.position.set(0, top + 0.0008, -o.d * 0.16);
  let keys = null;
  if (o.keys) {
    const cols = 14, rows = 5, kw = (o.w * 0.84) / cols, kd = (o.d * 0.42) / rows, cap = new RoundedBoxGeometry(kw * 0.84, 0.012, kd * 0.82, 2, 0.004);
    keys = new THREE.InstancedMesh(cap, MAT.satin('#232327', { roughness: 0.55, clearcoat: 0.1 }), cols * rows - 4); keys.castShadow = false; keys.receiveShadow = true;
    const m = new THREE.Matrix4(); let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (r === 4 && c > 3 && c < 9) { if (c === 4) { m.makeScale(5.6, 1, 1); m.setPosition(-o.w * 0.42 + (6.5) * kw, top + 0.006, -o.d * 0.16 - o.d * 0.21 + (r + 0.5) * kd); keys.setMatrixAt(i++, m); } continue; }
      m.makeScale(1, 1, 1); m.setPosition(-o.w * 0.42 + (c + 0.5) * kw, top + 0.006, -o.d * 0.16 - o.d * 0.21 + (r + 0.5) * kd); keys.setMatrixAt(i++, m); }
    keys.count = i; ctx.add(root, keys, { cast: false, recv: true });
  }
  const pad = ctx.add(root, new THREE.Mesh(faceGeo(o.w * 0.34, o.d * 0.27, 0.025), metal(ctx, MAT.anodised(o.color, { roughness: 0.22 }))), { recv: true }); pad.rotation.x = -Math.PI / 2; pad.position.set(0, top + 0.0009, o.d * 0.27);
  // hinge (dark barrel) + lid group pivoting at the back edge
  const hinge = ctx.add(root, new THREE.Mesh(new THREE.CylinderGeometry(o.t * 0.36, o.t * 0.36, o.w * 0.78, 32), metal(ctx, MAT.darkMetal())), { cast: true }); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, o.t * 0.62 + 0.006, -o.d / 2 + o.t * 0.3);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, o.t + 0.006 + 0.014, -o.d / 2 + 0.01); root.add(lidPivot);   // 14 mm clearance over the key caps when closed
  const lid = ctx.add(lidPivot, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.lidT, o.d * 0.98, 6, Math.min(o.lidT * 0.48, 0.03)), alu), { cast: true, recv: true, name: 'laptop.lid' });
  lid.position.set(0, o.lidT / 2, o.d * 0.49);
  // inside of the lid: black glass bezel + the screen (rounded, emissive canvas)
  const bez = ctx.add(lidPivot, new THREE.Mesh(faceGeo(o.w * 0.97, o.d * 0.95, 0.03), MAT.blackGlass()), { recv: true }); bez.rotation.x = Math.PI / 2; bez.position.set(0, -0.0008, o.d * 0.49);
  const S = liveTex(o.screenRes[0], o.screenRes[1]), sw = o.w * 0.9, sh = sw * o.screenRes[1] / o.screenRes[0], smat = screenMat(ctx, S.t), sbloom = new THREE.MeshBasicMaterial({ map: S.t }); sbloom.color.copy(ctx.emis('#ffffff', 0.12));
  const scr = ctx.add(lidPivot, new THREE.Mesh(faceGeo(sw, sh, 0.012), smat), { recv: false, bloom: sbloom }); scr.rotation.x = Math.PI / 2; scr.position.set(0, -0.0016, o.d * 0.49 + 0.012);
  const ao = aoDecal(ctx, root, o.w * 1.25, o.d * 1.25, 0.32);
  let key = '';
  const api = { group: root, lid: lidPivot, screen: scr, probes: { laptop: base, 'laptop.screen': scr },
    /* state: { open 0..1, screen 0..1, ui {} } -> sets the hinge angle and redraws the screen if needed */
    set({ open = 1, screen = 1, ui = {} } = {}) {
      lidPivot.rotation.x = -rad(112) * clamp(open) + rad(0);
      const k = JSON.stringify(ui) + '|' + screen.toFixed(3);
      if (k !== key) { key = k; o.draw(S.g, S.c.width, S.c.height, ui); if (screen < 1) { S.g.fillStyle = `rgba(4,4,6,${(1 - clamp(screen)).toFixed(3)})`; S.g.fillRect(0, 0, S.c.width, S.c.height); } S.t.needsUpdate = true; }
      scr.visible = screen > 0.001; ao.material.opacity = 0.32;
    },
    pose(p, yaw = 0) { root.position.set(p[0], p[1], p[2]); root.rotation.set(0, yaw, 0); } };
  api.set({}); return api;
}

/* ======================= PHONE =======================
   o: { w 0.29, h 0.60, t 0.032, color (frame), back, draw uiChat, screenRes [720, 1490] }. Built in local XY (screen faces +Z), origin = centre.
   state: screen 0..1, ui {}. pose(p, euler[x,y,z]) e.g. lying flat face-up: [-PI/2, yaw, 0] at y = t/2. */
export function makePhone(ctx, parent, o = {}) {
  o = { w: 0.29, h: 0.60, t: 0.032, r: 0.052, color: '#8f9095', back: '#2c2d33', draw: uiChat, screenRes: [720, 1490], scale: 1, seed: 5, ...o };
  const root = new THREE.Group(); parent.add(root); const g = new THREE.Group(); g.scale.setScalar(o.scale); root.add(g);
  const frame = ctx.add(g, new THREE.Mesh(slabGeo(o.w, o.h, o.t, o.r, o.t * 0.32, 24), metal(ctx, MAT.anodised(o.color, { roughness: 0.26, roughnessMap: grainTex(o.seed, 128, 0.05, 0.5) }))), { cast: true, recv: true, name: 'phone' });
  const front = ctx.add(g, new THREE.Mesh(faceGeo(o.w * 0.975, o.h * 0.985, o.r * 0.93, 24), MAT.blackGlass()), { recv: true }); front.position.z = o.t / 2 + 0.0004;
  const backM = MAT.satin(o.back, { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const back = ctx.add(g, new THREE.Mesh(faceGeo(o.w * 0.975, o.h * 0.985, o.r * 0.93, 24), backM), { recv: true }); back.position.z = -o.t / 2 - 0.0004; back.rotation.y = Math.PI;
  // camera island (back): bevelled rounded square + 2 lenses (black glass in anodised rings)
  const isl = ctx.add(g, new THREE.Mesh(slabGeo(o.w * 0.42, o.w * 0.42, 0.008, o.w * 0.1, 0.003), MAT.satin(o.back, { roughness: 0.25, clearcoat: 1 })), { cast: true, recv: true });
  isl.position.set(o.w * 0.5 - o.w * 0.27, o.h * 0.5 - o.w * 0.27, -o.t / 2 - 0.004);
  [[-0.1, 0.1], [0.1, -0.1]].forEach(([dx, dy]) => { const ring = ctx.add(g, new THREE.Mesh(new THREE.CylinderGeometry(o.w * 0.075, o.w * 0.078, 0.01, 40), metal(ctx, MAT.anodised('#a7a9ae', { roughness: 0.2 }))), { cast: true }); ring.rotation.x = Math.PI / 2; ring.position.set(isl.position.x + dx * o.w, isl.position.y + dy * o.w, -o.t / 2 - 0.011);
    const lens = ctx.add(g, new THREE.Mesh(new THREE.CircleGeometry(o.w * 0.058, 40), MAT.blackGlass()), {}); lens.position.set(ring.position.x, ring.position.y, -o.t / 2 - 0.0162); lens.rotation.y = Math.PI; });
  // side buttons
  [[1, 0.18, 0.12], [-1, 0.24, 0.07], [-1, 0.12, 0.07]].forEach(([s, y, len]) => { const b = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(0.008, len * o.h * 1.4, o.t * 0.35, 2, 0.003), metal(ctx, MAT.anodised(o.color))), { cast: true }); b.position.set(s * (o.w / 2 + 0.002), y * o.h, 0); });
  // screen + a generic pill cutout (not any brand's island shape spec; just a camera pill)
  const S = liveTex(o.screenRes[0], o.screenRes[1]), sw = o.w * 0.93, sh = o.h * 0.955, smat = screenMat(ctx, S.t), sbloom = new THREE.MeshBasicMaterial({ map: S.t }); sbloom.color.copy(ctx.emis('#ffffff', 0.12));
  const scr = ctx.add(g, new THREE.Mesh(faceGeo(sw, sh, o.r * 0.82, 24), smat), { recv: false, bloom: sbloom }); scr.position.z = o.t / 2 + 0.0009;
  const pill = ctx.add(g, new THREE.Mesh(faceGeo(o.w * 0.3, o.w * 0.085, o.w * 0.0425, 16), MAT.blackGlass()), {}); pill.position.set(0, sh / 2 - o.w * 0.09, o.t / 2 + 0.0013);
  let key = '';
  const api = { group: root, probes: { phone: frame, 'phone.screen': scr },
    set({ screen = 1, ui = {} } = {}) { const k = JSON.stringify(ui) + '|' + screen.toFixed(3); if (k !== key) { key = k; o.draw(S.g, S.c.width, S.c.height, ui); if (screen < 1) { S.g.fillStyle = `rgba(4,4,6,${(1 - clamp(screen)).toFixed(3)})`; S.g.fillRect(0, 0, S.c.width, S.c.height); } S.t.needsUpdate = true; } scr.visible = screen > 0.001; },
    pose(p, euler = [0, 0, 0]) { root.position.set(p[0], p[1], p[2]); root.rotation.set(euler[0], euler[1], euler[2], 'YXZ'); } };
  api.set({}); return api;
}

/* ======================= MUG =======================
   A thrown ceramic mug: lathe body with a real wall (outer up, rounded rim, inner down), a swept C handle, a coffee surface.
   o: { r 0.16, h 0.38, wall 0.016, color '#f2efe8', glaze 'ceramic'|'clay', fill 0.82, liquid '#3b2416', crema '#b7835a' }
   state: fill 0..1, slosh (rad, closed-form from a kick: use mugSlosh(t - tKick)), tilt (rad, whole mug), steam unused (owned rule: no
   cheap sprite steam). Origin = base centre. */
export const mugSlosh = (tau, amp = 0.12, hz = 2.6, zeta = 0.12) => (tau <= 0 ? 0 : amp * Math.exp(-zeta * TAU * hz * tau) * Math.sin(TAU * hz * tau));
export function makeMug(ctx, parent, o = {}) {
  o = { r: 0.16, h: 0.38, wall: 0.016, foot: 0.012, color: '#f2efe8', glaze: 'ceramic', fill: 0.9, liquid: '#3b2416', crema: '#b7835a', scale: 1, ...o };
  const root = new THREE.Group(); parent.add(root); const g = new THREE.Group(); g.scale.setScalar(o.scale); root.add(g);
  const R = o.r, H = o.h, Wt = o.wall, pts = [];
  // outer: foot ring (slight undercut), belly, straight-ish wall, rounded rim; inner: down to a flat floor
  pts.push([0.0001, o.foot * 0.55], [R * 0.58, o.foot * 0.55], [R * 0.62, 0], [R * 0.80, 0], [R * 0.86, o.foot * 0.4], [R * 0.90, o.foot]);
  for (let i = 0; i <= 12; i++) { const u = i / 12, y = o.foot + u * (H - o.foot - Wt * 0.5); pts.push([R * (0.93 + 0.07 * Math.sin(Math.min(1, u * 1.4) * Math.PI / 2)), y]); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI, cx = R - Wt / 2, cy = H - Wt * 0.5; pts.push([cx + (Wt / 2) * Math.cos(a), cy + (Wt / 2) * Math.sin(a)]); }
  for (let i = 1; i <= 10; i++) { const u = i / 10, y = H - Wt * 0.5 - u * (H - o.foot - Wt * 1.6); pts.push([R - Wt - 0.004 * Math.sin(u * Math.PI), y]); }
  pts.push([R - Wt - 0.012, o.foot + Wt * 1.0], [0.0001, o.foot + Wt]);
  const mat = o.glaze === 'clay' ? MAT.clay(o.color) : MAT.ceramic(o.color);
  if (ctx.metalEnv && o.glaze !== 'clay') { mat.envMap = ctx.metalEnv; mat.envMapIntensity = 0.7; }   // glaze clearcoat picks up the soft studio panels (else it reads plain CG)
  const body = ctx.add(g, new THREE.Mesh(latheGeo(pts, 128), mat), { cast: true, recv: true, name: 'mug' });
  body.material.side = THREE.DoubleSide;
  // handle: a tube along a C curve on the +x side, flattened oval section
  const hc = new THREE.CatmullRomCurve3([[0.94, 0.78], [1.32, 0.80], [1.52, 0.62], [1.50, 0.40], [1.30, 0.24], [0.94, 0.25]].map(([x, y]) => new THREE.Vector3(R * x, H * y, 0)));
  const hg = new THREE.TubeGeometry(hc, 64, R * 0.085, 20, false); { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.72); hg.computeVertexNormals(); }
  ctx.add(g, new THREE.Mesh(hg, mat), { cast: true, recv: true, name: 'mug.handle' });
  // coffee: a disc with a crema gradient, bobbing on fill + slosh
  const cremaTex = canvasTex(256, 256, (c, w) => { const gr = c.createRadialGradient(w / 2, w / 2, w * 0.05, w / 2, w / 2, w / 2); gr.addColorStop(0, o.liquid); gr.addColorStop(0.72, o.liquid); gr.addColorStop(0.9, o.crema); gr.addColorStop(1, o.crema); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
  const liq = ctx.add(g, new THREE.Mesh(new THREE.CircleGeometry(R - Wt - 0.0035, 96), MAT.liquid('#ffffff', { map: cremaTex })), { recv: true }); liq.rotation.x = -Math.PI / 2;
  const ao = aoDecal(ctx, root, R * 3.2, R * 3.2, 0.38);
  const api = { group: root, probes: { mug: body },
    set({ fill = o.fill, slosh = 0, tilt = 0 } = {}) { const yMax = H - Wt * 1.6, y = o.foot + Wt + 0.002 + clamp(fill) * (yMax - o.foot - Wt); liq.position.y = y; liq.rotation.set(-Math.PI / 2 + slosh, 0, 0); liq.visible = fill > 0.01; g.rotation.z = tilt; ao.material.opacity = 0.38 * Math.cos(tilt) ** 4; },
    pose(p, yaw = 0) { root.position.set(p[0], p[1], p[2]); root.rotation.set(0, yaw, 0); } };
  api.set({}); return api;
}
