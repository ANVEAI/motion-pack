/* motion-pack/objects/lib/night.js: the props and sets of the hero style scenes (templates/style-scene): a reading-room set at night in four
   worlds (clay, doc, neon, paper), a desk lamp that switches on, a book that opens, rain on a window with light streaks behind it, cut-paper
   layers with boil, and a page-peel sheet for paper transitions. three.js 0.160 on the studio-kit contract (ctx from kit/core.js runScene).
   Every setter is a pure function of its arguments; the time-based craft lives in ./scene-craft.js (pure, node-tested). */
import * as THREE from 'three';
import { clamp, lerp, E, mulberry32 } from '../kit/util.js';
import { MAT, std, canvasTex } from './mat.js';
import { makeClay } from './dome.js';
import { rainDrops, lightStreaks, paperJitter, peel } from './scene-craft.js';

/* the four worlds: colours, materials and light levels. A style picks one (CONFIG.world) and may override any field */
export const WORLDS = {
  clay: { label: 'soft clay', bg: '#2d2547', floor: '#cdbfe4', wall: '#b9a8d8', desk: '#f0e2cf', deskLegs: '#d7c3a6', sky: ['#3a2f66', '#6b5aa6'], moon: '#fff1d6',
    figure: '#8d84d4', lampBody: '#f3b6a8', lampLight: '#ffd9a0', book: '#6a4bd6', pages: '#fff6e6', mug: '#f6c9d4', mat: 'clay',
    amb: 0.55, ambSky: '#c9bdf2', ambGround: '#6f5f8f', moonK: 1.4, moonCol: '#c8d4ff', rim: null, lampCd: 9, exposure: 1.05, stars: 18, rug: '#f2a7b8' },
  doc: { label: 'documentary', bg: '#120f0b', floor: '#3a2f25', wall: '#6a5440', desk: '#5b4532', deskLegs: '#3b2b1f', sky: ['#05070c', '#1b2333'], moon: '#d8d2c0',
    figure: '#9a94b8', lampBody: '#6d6457', lampLight: '#ffc27a', book: '#7a2e22', pages: '#efe4cc', mug: '#c9bfae', mat: 'matte',
    amb: 0.42, ambSky: '#8c8f99', ambGround: '#2b2018', moonK: 1.1, moonCol: '#9fb2d6', rim: null, lampCd: 14, exposure: 1.3, stars: 0 },
  neon: { label: 'neon night', bg: '#07061a', floor: '#1c1840', wall: '#2c2560', desk: '#2a2350', deskLegs: '#141030', sky: ['#05041a', '#2a0f4a'], moon: '#ffd6f4',
    figure: '#8d84d4', lampBody: '#3a335e', lampLight: '#ffb070', book: '#ff3ec8', pages: '#f4f1ff', mug: '#3ec8ff', mat: 'gloss',
    amb: 0.2, ambSky: '#5a3cff', ambGround: '#120a2a', moonK: 0.35, moonCol: '#8a7dff', rim: ['#ff3ec8', 26], fill: ['#3ec8ff', 14], lampCd: 10, exposure: 1.0, stars: 0 },
  paper: { label: 'paper cut', bg: '#1f3b4d', floor: '#e8d9b8', wall: '#2c4d63', desk: '#d9a066', deskLegs: '#a9713e', sky: ['#173246', '#2f5a73'], moon: '#f6e7b8',
    figure: '#1f7a6e', lampBody: '#e0614f', lampLight: '#ffe2a8', book: '#1f7a6e', pages: '#fbf3e1', mug: '#f2c14e', mat: 'paper',
    amb: 0.55, ambSky: '#f2e7cf', ambGround: '#8a7556', moonK: 1.2, moonCol: '#fff3d6', rim: null, lampCd: 7, exposure: 1.0, stars: 14, rug: '#e0614f', key: ['#fff4e0', 1.6] },
};

/* paper fibre: a light speckle and a few long fibres, multiplied onto the card colour (one shared texture) */
let FIBRE = null;
export function fibreTex() {
  if (FIBRE) return FIBRE;
  FIBRE = canvasTex(512, 512, (g, W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); const r = mulberry32(17);
    for (let i = 0; i < 9000; i++) { const v = 215 + Math.floor(r() * 40); g.fillStyle = `rgb(${v},${v},${v - 6})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = 'rgba(150,130,100,0.18)'; for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H, a = r() * Math.PI; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 * Math.cos(a), y + 18 * Math.sin(a)); g.stroke(); } });
  FIBRE.wrapS = FIBRE.wrapT = THREE.RepeatWrapping; FIBRE.repeat.set(2, 2); return FIBRE;
}

/* a world material: clay (soft matte, warm core), matte (documentary), gloss (neon: wet clearcoat), paper (flat card) */
export function worldMat(kind, hex) {
  if (kind === 'clay') return makeClay(hex, { roughness: 0.82 });
  if (kind === 'gloss') return MAT.satin(hex, { roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.18 });
  if (kind === 'paper') return MAT.paper(hex, { roughness: 1.0, map: fibreTex() });
  return std(hex, { roughness: 0.78 });
}

/* the night sky behind the window: a vertical gradient, seeded stars and a moon disc (unlit: it is the light source of the view) */
function skyTex(w, k) {
  return canvasTex(512, 384, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, k.sky[0]); gr.addColorStop(1, k.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = mulberry32(91); g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < k.stars; i++) { const x = r() * W, y = r() * H * 0.7, s = 1 + r() * 2.2; g.fillRect(x, y, s, s); }
    if (k.moon && w !== 'neon') { g.fillStyle = k.moon; g.beginPath(); g.arc(W * 0.72, H * 0.3, H * 0.13, 0, Math.PI * 2); g.fill(); }
    if (w === 'neon') { for (let i = 0; i < 9; i++) { const x = (i + 0.5) * W / 9, hh = H * (0.35 + 0.4 * r()); g.fillStyle = '#0d0a26'; g.fillRect(x - W / 22, H - hh, W / 11, hh);   // a far skyline with lit windows
      for (let j = 0; j < 14; j++) { if (r() < 0.45) continue; g.fillStyle = r() < 0.5 ? 'rgba(255,62,200,0.8)' : 'rgba(62,200,255,0.7)'; g.fillRect(x - W / 26 + r() * W / 14, H - hh + j * hh / 15, 4, 3); } } }
  });
}

/* the reading-room set: floor, a back wall with a window onto the night, a small desk. -> {group, top (y of the desk top), lights, update(t)}
   lights: a hemisphere ambient, a moonlight key through the window (soft shadow), an optional neon rim and fill */
export function makeNightSet(ctx, parent, o = {}) {
  const w = o.world || 'clay', k = { ...WORLDS[w], ...(o.colors || {}) }, g = new THREE.Group(); parent.add(g);
  ctx.scene.background = new THREE.Color(k.bg);
  const m = (hex) => worldMat(k.mat, hex), D = { top: 0.58, w: 1.9, d: 0.86, t: 0.06 };
  const floor = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(40, 40), m(k.floor)), { recv: true, name: 'floor' }); floor.rotation.x = -Math.PI / 2;
  // the back wall with a window opening (four panels around it), a frame and the sky card set behind it
  const WZ = -1.6, win = { x: 0.55, y: 1.55, w: 1.5, h: 1.05 }, wall = m(k.wall), H = 5, Wd = 16;
  const panel = (x0, x1, y0, y1) => { const p = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.08), wall), { recv: true, cast: true, name: 'wall' }); p.position.set((x0 + x1) / 2, (y0 + y1) / 2, WZ); };
  panel(-Wd / 2, win.x - win.w / 2, 0, H); panel(win.x + win.w / 2, Wd / 2, 0, H); panel(win.x - win.w / 2, win.x + win.w / 2, 0, win.y - win.h / 2); panel(win.x - win.w / 2, win.x + win.w / 2, win.y + win.h / 2, H);
  const frameM = m(w === 'paper' ? '#f4ead2' : k.desk), bar = (bw, bh, x, y) => { const b = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), frameM), { cast: true, recv: true, name: 'frame' }); b.position.set(x, y, WZ + 0.03); };
  bar(win.w + 0.08, 0.05, win.x, win.y + win.h / 2); bar(win.w + 0.08, 0.05, win.x, win.y - win.h / 2); bar(0.05, win.h, win.x - win.w / 2, win.y); bar(0.05, win.h, win.x + win.w / 2, win.y); bar(0.03, win.h, win.x, win.y); bar(win.w, 0.03, win.x, win.y);
  const sky = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(win.w * 2.2, win.h * 2.2), new THREE.MeshBasicMaterial({ map: skyTex(w, k), toneMapped: false })), { recv: false, name: 'sky' });
  sky.position.set(win.x, win.y, WZ - 0.9);
  // the desk: a top on four legs
  const top = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(D.w, D.t, D.d), m(k.desk)), { cast: true, recv: true, name: 'desk' }); top.position.set(0.15, D.top - D.t / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(0.06, D.top - D.t, 0.06), m(k.deskLegs)), { cast: true, recv: true }); l.position.set(0.15 + sx * (D.w / 2 - 0.08), (D.top - D.t) / 2, sz * (D.d / 2 - 0.08)); }
  if (k.rug) { const rug = ctx.add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.012, 64), m(k.rug)), { recv: true, name: 'rug' }); rug.scale.z = 0.62; rug.position.set(-0.35, 0.006, 0.35); }
  // lights
  const hemi = new THREE.HemisphereLight(k.ambSky, k.ambGround, k.amb); ctx.scene.add(hemi);
  const moon = new THREE.DirectionalLight(k.moonCol, k.moonK); moon.position.set(win.x + 1.2, win.y + 2.2, WZ - 3); moon.target.position.set(0, 0.3, 0.4); ctx.scene.add(moon, moon.target);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.radius = w === 'paper' ? 2 : 8; moon.shadow.bias = -0.0004; const sc = moon.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -2; sc.near = 0.5; sc.far = 14;
  const extra = [];
  if (k.key) { const key = new THREE.DirectionalLight(k.key[0], k.key[1]); key.position.set(-2.6, 3.4, 4.2); key.target.position.set(0, 0.8, -1.2); ctx.scene.add(key, key.target);   // a front key: crisp drop shadows of the cut paper on the wall
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 1.5; key.shadow.bias = -0.0005; const kc = key.shadow.camera; kc.left = -5; kc.right = 5; kc.top = 4; kc.bottom = -2; kc.near = 0.5; kc.far = 14; extra.push(key); }
  for (const [key, pos] of [['rim', [1.8, 1.6, -1.2]], ['fill', [-2.4, 1.2, 1.6]]]) if (k[key]) { const s = new THREE.SpotLight(k[key][0], k[key][1], 9, 0.7, 0.9, 1.6); s.position.set(...pos); s.target.position.set(-0.5, 0.6, 0.2); ctx.scene.add(s, s.target); extra.push(s); }
  return { group: g, top: D.top, world: w, colors: k, window: { ...win, z: WZ }, lights: { hemi, moon, extra }, sky,
    probes: { desk: top, window: sky }, update() { return this; } };
}

/* the desk lamp: a weighted base, a two-part arm, a cone shade and a bulb that blooms; its spot light pours a warm pool on the desk.
   set({on 0..1, squash}) ; pose([x, y, z], yaw). squash (-0.4..0.4) is the clay tap (volume kept, about the base) */
export function makeLamp(ctx, parent, o = {}) {
  const k = { body: '#f3b6a8', light: '#ffd9a0', mat: 'clay', cd: 9, scale: 1.45, ...o }, g = new THREE.Group(), sq = new THREE.Group(); g.add(sq); parent.add(g); sq.scale.setScalar(k.scale);
  const m = worldMat(k.mat, k.body);
  const base = ctx.add(sq, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 40), m), { cast: true, name: 'lamp' }); base.position.y = 0.02;
  const arm1 = ctx.add(sq, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 16), m), { cast: true }); arm1.position.set(0.0, 0.2, 0); arm1.rotation.z = -0.25;
  const elbow = new THREE.Group(); elbow.position.set(0.042, 0.36, 0); sq.add(elbow);
  ctx.add(elbow, new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 16), m), { cast: true });
  const arm2 = ctx.add(elbow, new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.28, 16), m), { cast: true }); arm2.rotation.z = -1.15; arm2.position.set(0.12, 0.06, 0);
  const head = new THREE.Group(); head.position.set(0.25, 0.12, 0); elbow.add(head);
  const shadeGeo = new THREE.CylinderGeometry(0.035, 0.12, 0.16, 40, 1, true), shade = ctx.add(head, new THREE.Mesh(shadeGeo, Object.assign(m.clone ? m.clone() : m, { side: THREE.DoubleSide })), { cast: true }); shade.rotation.z = -0.5;
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#2a2622', toneMapped: true }), bulbBloom = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const bulb = ctx.add(head, new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), bulbMat), { bloom: bulbBloom, recv: false }); bulb.position.set(0.02, -0.05, 0);
  const spot = new THREE.SpotLight(k.light, 0, 3.2, 0.95, 0.85, 1.4); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.radius = 6; spot.shadow.bias = -0.0006;
  spot.position.set(0.02, -0.06, 0); head.add(spot); const tgt = new THREE.Object3D(); tgt.position.set(0.12, -0.6, 0.02); head.add(tgt); spot.target = tgt;
  const pool = new THREE.PointLight(k.light, 0, 1.6, 2); pool.position.set(0.02, -0.02, 0); head.add(pool);
  const warm = new THREE.Color(k.light), off = new THREE.Color('#2a2622');
  const api = { group: g, probes: { lamp: base }, head, bulb, spot,
    set({ on = 0, squash = 0 } = {}) {
      const a = clamp(on); spot.intensity = k.cd * a; pool.intensity = k.cd * 0.18 * a;
      bulbMat.color.copy(off).lerp(warm, a); bulbBloom.color.copy(warm).multiplyScalar(1.6 * a);
      const sy = clamp(1 - squash, 0.5, 1.6), sxz = 1 / Math.sqrt(sy); sq.scale.set(sxz * k.scale, sy * k.scale, sxz * k.scale); return api; },
    pose(p, yaw = 0) { g.position.set(...p); g.rotation.y = yaw; return api; } };
  return api.set({});
}

/* a book on the desk: two boards hinged on the spine, a page block and a fan of loose pages for the flutter.
   set({open 0..1, flip 0..1}) : open swings the front board over (0 closed .. 1 flat open), flip turns the loose pages one after another */
export function makeBook(ctx, parent, o = {}) {
  const k = { cover: '#6a4bd6', pages: '#fff6e6', mat: 'clay', w: 0.42, d: 0.31, t: 0.07, n: 6, ...o }, g = new THREE.Group(); parent.add(g);
  const cm = worldMat(k.mat, k.cover), pm = worldMat(k.mat === 'gloss' ? 'matte' : k.mat, k.pages), bt = 0.008;
  const back = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(k.w, bt, k.d), cm), { cast: true, recv: true, name: 'book' }); back.position.set(k.w / 2, bt / 2, 0);
  const block = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(k.w * 0.96, k.t, k.d * 0.95), pm), { cast: true, recv: true }); block.position.set(k.w * 0.49, bt + k.t / 2, 0);
  const hinge = new THREE.Group(); hinge.position.set(0, bt + k.t, 0); g.add(hinge);
  const front = ctx.add(hinge, new THREE.Mesh(new THREE.BoxGeometry(k.w, bt, k.d), cm), { cast: true, recv: true }); front.position.set(k.w / 2, bt / 2, 0);
  const leaves = []; for (let i = 0; i < k.n; i++) { const h = new THREE.Group(); h.position.set(0, bt + k.t - 0.001, 0); g.add(h);
    const p = ctx.add(h, new THREE.Mesh(new THREE.PlaneGeometry(k.w * 0.95, k.d * 0.93), Object.assign(pm.clone ? pm.clone() : pm, { side: THREE.DoubleSide })), { cast: true, recv: true }); p.rotation.x = -Math.PI / 2; p.position.x = k.w * 0.475; leaves.push(h); }
  const api = { group: g, probes: { book: block },
    set({ open = 0, flip = 0 } = {}) {
      const a = E.move(clamp(open)); hinge.rotation.z = Math.PI * 0.97 * a; hinge.position.x = -0.004 * a;     // the board lands flat to the left of the spine
      leaves.forEach((h, i) => { const s = clamp(flip * (k.n + 1) - i); h.visible = open > 0.6; h.rotation.z = Math.PI * 0.96 * E.move(s) * clamp((open - 0.6) / 0.4); h.position.y = bt + k.t - 0.001 + 0.002 * i; });
      return api; },
    pose(p, yaw = 0) { g.position.set(...p); g.rotation.y = yaw; return api; } };
  return api.set({});
}

/* rain on a window pane w x h seen from outside (neon): drops that stick and run (instanced lens spheres), with light streaks of passing
   cars on the far side. update(t) is a pure function of t (scene-craft.js rainDrops / lightStreaks) */
export function makeRainGlass(ctx, parent, o = {}) {
  const k = { w: 3.2, h: 2.0, n: 160, seed: 11, streaks: 7, colors: ['#ff3ec8', '#3ec8ff'], ...o }, g = new THREE.Group(); parent.add(g);
  const glass = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(k.w, k.h), new THREE.MeshPhysicalMaterial({ color: '#9aa7ff', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1, clearcoatRoughness: 0.05 })), { recv: false, name: 'glass' });
  glass.position.set(k.w / 2, k.h / 2, 0);
  const dropMat = new THREE.MeshPhysicalMaterial({ color: '#dfe6ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.33 });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), dropMat, k.n); ctx.add(g, drops, { recv: false, name: 'drops' });
  const trailMat = new THREE.MeshBasicMaterial({ color: '#cfd7ff', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
  const trails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), trailMat, k.n); ctx.add(g, trails, { recv: false });
  const sMats = k.colors.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, toneMapped: false, depthWrite: false })), sBloom = k.colors.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const streaks = []; for (let i = 0; i < k.streaks; i++) { const h = i % 2; const s = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(1, 0.018), sMats[h].clone()), { recv: false, bloom: sBloom[h].clone() }); s.position.z = -0.9; streaks.push(s); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const api = { group: g, probes: { glass },
    update(t) {
      rainDrops(t, { n: k.n, seed: k.seed, w: k.w, h: k.h }).forEach((d, i) => {
        S.set(d.r, d.r * (1 + 0.6 * d.run), d.r * 0.45); P.set(d.x, d.y, 0.01); M.compose(P, Q, S); drops.setMatrixAt(i, M);
        const L = 0.02 + 0.22 * d.run; S.set(d.r * 0.8, L, 1); P.set(d.x, d.y + L / 2, 0.006); M.compose(P, Q, S); trails.setMatrixAt(i, M); });
      drops.instanceMatrix.needsUpdate = true; trails.instanceMatrix.needsUpdate = true;
      lightStreaks(t, { n: k.streaks, w: k.w + 1, h: k.h * 0.5 }).forEach((s, i) => { const m = streaks[i]; m.position.set(s.x - 0.5, 0.15 + s.y, -0.9); m.scale.set(s.len, 1, 1);
        m.material.opacity = s.a; m.userData.bloomMat.color.set(k.colors[s.hue]).multiplyScalar(1.4 * s.a); });
      return api; },
    pose(p, yaw = 0) { g.position.set(...p); g.rotation.y = yaw; return api; } };
  return api.update(0);
}

/* cut-paper layers for a diorama: each layer is a card with a cut silhouette (hills, skyline, trees, clouds) set at its own depth, casting
   real shadows on the layer behind; boil hops each layer by a pixel or two on twelves (scene-craft.js paperJitter).
   layers: [{shape: 'hills'|'skyline'|'trees'|'clouds', color, z, y, w, h, seed}] ; update(t, {px, deg}) */
function silhouette(kind, w, h, seed) {
  const s = new THREE.Shape(), r = mulberry32(seed), n = kind === 'hills' ? 5 : kind === 'skyline' ? 9 : kind === 'trees' ? 7 : 4;
  s.moveTo(-w / 2, -h / 2);
  if (kind === 'star') { s.curves = []; const R = Math.min(w, h) / 2; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.45 : R; const x = rr * Math.cos(a), y = rr * Math.sin(a); if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath(); return s; }
  if (kind === 'curtain') { s.curves = []; s.moveTo(-w / 2, h / 2); s.lineTo(w / 2, h / 2); for (let i = 0; i <= 6; i++) { const u = 1 - i / 6, x = -w / 2 + u * w; s.lineTo(x, -h / 2 + (i % 2 ? 0.06 * h : 0)); } s.lineTo(-w / 2, h / 2); return s; }
  if (kind === 'skyline') { let x = -w / 2; for (let i = 0; i < n; i++) { const bw = w / n, bh = h * (0.35 + 0.6 * r()); s.lineTo(x, -h / 2 + bh); s.lineTo(x + bw * 0.9, -h / 2 + bh); s.lineTo(x + bw * 0.9, -h / 2 + bh * 0.8); x += bw; } s.lineTo(w / 2, -h / 2 + h * 0.3); }
  else if (kind === 'trees') { for (let i = 0; i <= n; i++) { const x = -w / 2 + (i / n) * w, th = h * (0.5 + 0.45 * r()); s.lineTo(x - w / n * 0.35, -h / 2 + th * 0.35); s.lineTo(x, -h / 2 + th); s.lineTo(x + w / n * 0.35, -h / 2 + th * 0.35); } }
  else if (kind === 'clouds') { for (let i = 0; i <= 24; i++) { const u = i / 24, x = -w / 2 + u * w; s.lineTo(x, -h / 2 + h * (0.55 + 0.35 * Math.abs(Math.sin(u * Math.PI * (2 + r() * 0.01) * 2)))); } }
  else { for (let i = 0; i <= 32; i++) { const u = i / 32, x = -w / 2 + u * w; s.lineTo(x, -h / 2 + h * (0.45 + 0.25 * Math.sin(u * Math.PI * 2 + seed) + 0.12 * Math.sin(u * Math.PI * 5 + seed * 2))); } }
  s.lineTo(w / 2, -h / 2); s.lineTo(-w / 2, -h / 2); return s;
}
export function makePaperLayers(ctx, parent, o = {}) {
  const k = { layers: [], ...o }, g = new THREE.Group(), list = []; parent.add(g);
  for (const [i, L] of k.layers.entries()) {
    const geo = new THREE.ExtrudeGeometry(silhouette(L.shape, L.w, L.h, L.seed ?? i + 3), { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
    const m = ctx.add(g, new THREE.Mesh(geo, MAT.paper(L.color, { roughness: 1 })), { cast: true, recv: true, name: 'paper' + i });
    m.position.set(L.x ?? 0, L.y ?? 0, L.z ?? 0); list.push({ m, base: [L.x ?? 0, L.y ?? 0], i });
  }
  const api = { group: g, layers: list, probes: { paper: list[0] && list[0].m },
    update(t, { px = 1.5, deg = 0.25, boilFps = 12 } = {}) {
      for (const L of list) { const [dx, dy, r] = paperJitter(t, L.i, { px, deg, boilFps }), s = 0.0011;   // ~1 px at a 1080 p frame of the diorama
        L.m.position.x = L.base[0] + dx * s; L.m.position.y = L.base[1] + dy * s; L.m.rotation.z = (r * Math.PI) / 180; }
      return api; } };
  return api;
}

/* the page-peel transition sheet, parented to the camera: a paper page with a printed fibre texture that unrolls over the frame and peels off
   (scene-craft.js peel). set(k): k 0..1 (0.5 covers the frame: the template cuts under it). fit(camera) sizes it to the frustum */
export function makePagePeel(ctx, o = {}) {
  const k = { color: '#f4ead2', back: '#e2d2b0', seg: 48, rad: 0.08, angle: 0.35, ...o };
  const geo = new THREE.PlaneGeometry(1, 1, k.seg, k.seg), base = geo.attributes.position.array.slice(), uv = geo.attributes.uv.array;
  const tex = canvasTex(512, 512, (g, W, H) => { g.fillStyle = k.color; g.fillRect(0, 0, W, H); const r = mulberry32(7); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,90,50,${0.03 + 0.05 * r()})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1); } });
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.FrontSide }), backM = new THREE.MeshStandardMaterial({ color: k.back, roughness: 1, side: THREE.BackSide });
  const g = new THREE.Group(), a = new THREE.Mesh(geo, front), b = new THREE.Mesh(geo, backM); a.frustumCulled = b.frustumCulled = false; g.add(a, b); g.visible = false;
  ctx.camera.add(g); if (!ctx.camera.parent) ctx.scene.add(ctx.camera);
  const P = geo.attributes.position;
  const api = { group: g,
    fit(dist = 0.4) { const c = ctx.camera, hh = 2 * dist * Math.tan((c.fov * Math.PI) / 360), ww = hh * c.aspect; g.position.set(0, 0, -dist); g.scale.set(ww * 1.04, hh * 1.04, Math.min(ww, hh)); return api; },
    set(kk) {
      g.visible = kk > 0.001 && kk < 0.999; if (!g.visible) return api;
      for (let i = 0; i < P.count; i++) { const u = uv[2 * i], v = uv[2 * i + 1], [x, y, z] = peel(kk, u, v, { rad: k.rad, angle: k.angle }); P.setXYZ(i, x - 0.5, y - 0.5, z); }
      P.needsUpdate = true; geo.computeVertexNormals(); return api; } };
  void base;
  return api;
}
