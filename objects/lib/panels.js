/* PROVENANCE: generalised from the ANVE v10 film set's src/zones/tabs.js (makePanel, winTex, icon, makeBlock), offices.js (ICONS,
   cardFace, makeCard, makePuck) and wall.js (mkPlug, setBar) on 2026-10-13. Story constants became params; geometry, materials and
   print styles are unchanged. REAL third-party logos are NOT carried over (wall.js drew trademarked logos): plugs print our own
   text/icon faces; pass your own faceTex if a brand must appear, and then carry the trademark line in the type layer.
   Every builder: (ctx, parent, o) -> { group, ...setters, probes }; group origin = bottom-centre (sits on y = 0). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU, rad } from '../kit/util.js';
import { canvasTex, rrShape, planarUV, MAT } from './mat.js';

const bodyMat = () => new THREE.MeshPhysicalMaterial({ color: '#fbfaf7', roughness: 0.38, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 });
const texOf = (w, h, draw) => canvasTex(1024, Math.round(1024 * h / w), draw);

/* ---------- flat line icons (owned; ink strokes, ONE violet accent), on a 1-unit box ---------- */
export const ICON_KINDS = ['mic', 'page', 'lens', 'deck', 'image', 'pen', 'wave', 'check', 'lock', 'x'];
export function drawIcon(g, kind, cx, cy, s, ink = '#111111', vio = '#4a18ed') {
  g.save(); g.translate(cx, cy); g.scale(s, s); g.lineWidth = 0.075; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ink; g.fillStyle = ink;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  if (kind === 'mic') { rr(-0.15, -0.46, 0.3, 0.52, 0.15); g.stroke(); g.beginPath(); g.arc(0, -0.08, 0.28, 0.1, Math.PI - 0.1); g.stroke(); g.beginPath(); g.moveTo(0, 0.2); g.lineTo(0, 0.4); g.moveTo(-0.16, 0.42); g.lineTo(0.16, 0.42); g.stroke(); g.strokeStyle = vio; [0.42, 0.55].forEach((r) => { g.beginPath(); g.arc(0, -0.2, r, -0.5, 0.5); g.stroke(); g.beginPath(); g.arc(0, -0.2, r, Math.PI - 0.5, Math.PI + 0.5); g.stroke(); }); }
  if (kind === 'page') { g.beginPath(); g.moveTo(-0.3, -0.46); g.lineTo(0.12, -0.46); g.lineTo(0.3, -0.28); g.lineTo(0.3, 0.46); g.lineTo(-0.3, 0.46); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(0.12, -0.46); g.lineTo(0.12, -0.28); g.lineTo(0.3, -0.28); g.stroke(); g.strokeStyle = vio; g.beginPath(); g.moveTo(-0.17, -0.12); g.lineTo(0.17, -0.12); g.stroke(); g.strokeStyle = ink; [0.06, 0.22].forEach((y) => { g.beginPath(); g.moveTo(-0.17, y); g.lineTo(0.17, y); g.stroke(); }); }
  if (kind === 'lens') { g.beginPath(); g.arc(-0.07, -0.07, 0.27, 0, TAU); g.stroke(); g.strokeStyle = vio; g.lineWidth = 0.11; g.beginPath(); g.moveTo(0.14, 0.14); g.lineTo(0.38, 0.38); g.stroke(); }
  if (kind === 'deck') { rr(-0.42, -0.36, 0.84, 0.56, 0.06); g.stroke(); g.beginPath(); g.moveTo(0, 0.2); g.lineTo(0, 0.36); g.moveTo(-0.16, 0.44); g.lineTo(0, 0.36); g.lineTo(0.16, 0.44); g.stroke(); g.fillStyle = vio; rr(-0.24, -0.08, 0.1, 0.18, 0.02); g.fill(); rr(-0.06, -0.2, 0.1, 0.3, 0.02); g.fill(); rr(0.12, -0.14, 0.1, 0.24, 0.02); g.fill(); }
  if (kind === 'image') { rr(-0.42, -0.34, 0.84, 0.68, 0.08); g.stroke(); g.beginPath(); g.moveTo(-0.36, 0.26); g.lineTo(-0.1, -0.02); g.lineTo(0.08, 0.16); g.lineTo(0.2, 0.05); g.lineTo(0.36, 0.22); g.stroke(); g.fillStyle = vio; g.beginPath(); g.arc(0.18, -0.15, 0.08, 0, TAU); g.fill(); }
  if (kind === 'pen') { rr(-0.44, 0.14, 0.88, 0.2, 0.04); g.stroke(); [-0.3, -0.15, 0, 0.15, 0.3].forEach((x, i) => { g.beginPath(); g.moveTo(x, 0.14); g.lineTo(x, i % 2 ? 0.22 : 0.26); g.stroke(); }); g.save(); g.rotate(-0.7); g.strokeStyle = vio; rr(-0.07, -0.52, 0.14, 0.42, 0.03); g.stroke(); g.beginPath(); g.moveTo(-0.07, -0.1); g.lineTo(0, 0.02); g.lineTo(0.07, -0.1); g.stroke(); g.restore(); }
  if (kind === 'wave') { [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].forEach((x, i) => { const hh = [0.16, 0.34, 0.24, 0.5, 0.3, 0.38, 0.14][i]; g.strokeStyle = i === 3 ? vio : ink; g.beginPath(); g.moveTo(x, -hh / 2 - 0.02); g.lineTo(x, hh / 2 - 0.02); g.stroke(); }); }
  if (kind === 'check') { g.lineWidth = 0.12; g.strokeStyle = vio; g.beginPath(); g.moveTo(-0.32, 0.02); g.lineTo(-0.08, 0.26); g.lineTo(0.34, -0.22); g.stroke(); }
  if (kind === 'lock') { g.beginPath(); g.moveTo(-0.2, -0.02); g.lineTo(-0.2, -0.16); g.arc(0, -0.16, 0.2, Math.PI, 0); g.lineTo(0.2, -0.02); g.stroke(); rr(-0.32, -0.02, 0.64, 0.46, 0.08); g.fill(); }
  if (kind === 'x') { g.lineWidth = 0.12; g.beginPath(); g.moveTo(-0.28, -0.28); g.lineTo(0.28, 0.28); g.moveTo(0.28, -0.28); g.lineTo(-0.28, 0.28); g.stroke(); }
  g.restore();
}
/* engraved line icons as SVG path data (viewBox 100; the v8 s5 set) */
export const PATH_ICONS = {
  scales: ['M50 14V82', 'M30 86H70', 'M16 30H84', 'M16 30L6 58M16 30L26 58', 'M84 30L74 58M84 30L94 58', 'M4 58A12 12 0 0 0 28 58Z', 'M72 58A12 12 0 0 0 96 58Z'],
  ledger: ['M20 12H84V88H20Z', 'M32 12V88', 'M46 32H72', 'M46 43H72', 'M52 32A11 11 0 0 1 52 54H46', 'M48 54L68 76'],
  cross: ['M38 14H62V38H86V62H62V86H38V62H14V38H38Z'],
  dome: ['M24 54A26 26 0 0 1 76 54', 'M50 28V16', 'M14 54H86', 'M26 62V82', 'M42 62V82', 'M58 62V82', 'M74 62V82', 'M12 88H88'],
};

/* ---------- appWindow: a thin satin panel with a printed app-window face (title bar, dots, name, a coloured tag, text lines) ----------
   o: { w 0.94, h 0.64, d 0.035, r 0.05, name, tag '$', tagHex '#e5483a', bar 0.27, nameEm 0.122 }. group origin = bottom-edge centre (hinge) */
export function windowTex(o) {
  return texOf(o.w, o.h, (g, w, h) => {
    const k = w / o.w, bar = h * o.bar; g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0ede6'; g.fillRect(0, 0, w, bar); g.fillStyle = '#e4dfd4'; g.fillRect(0, bar - 3, w, 3);
    [0, 1, 2].forEach((i) => { g.fillStyle = '#cfc8ba'; g.beginPath(); g.arc(w * 0.062 + i * w * 0.052, bar / 2, w * 0.016, 0, TAU); g.fill(); });
    let em = o.nameEm * k; g.font = `700 ${em}px "Manrope"`; g.letterSpacing = (-0.01 * em).toFixed(1) + 'px';
    const x0 = w * 0.215, tagW = o.tag ? w * 0.13 : 0, maxW = w * 0.97 - tagW - w * 0.03 - x0; while (g.measureText(o.name).width > maxW && em > 40) { em -= 2; g.font = `700 ${em}px "Manrope"`; }
    g.fillStyle = '#111111'; g.textBaseline = 'middle'; g.fillText(o.name, x0, bar / 2 + em * 0.04);
    if (o.tag) { const tx = w * 0.97 - tagW, th = bar * 0.56; g.fillStyle = o.tagHex; g.beginPath(); g.roundRect(tx, bar / 2 - th / 2, tagW, th, th / 2); g.fill();
      g.fillStyle = '#ffffff'; g.font = `800 ${th * 0.78}px "Manrope"`; g.letterSpacing = '0px'; g.textAlign = 'center'; g.fillText(o.tag, tx + tagW / 2, bar / 2 + th * 0.04); g.textAlign = 'left'; }
    const L = (x, y, ww, c, hh = 0.045) => { g.fillStyle = c; g.beginPath(); g.roundRect(w * x, h * y, w * ww, h * hh, h * hh / 2); g.fill(); };
    L(0.07, 0.38, 0.52, '#d9d3c5', 0.06); L(0.07, 0.52, 0.80, '#e6e1d6'); L(0.07, 0.62, 0.70, '#e6e1d6'); L(0.07, 0.72, 0.76, '#e6e1d6'); L(0.07, 0.82, 0.46, '#ece8df');
  });
}
export function makeWindow(ctx, parent, o = {}) {
  o = { w: 0.94, h: 0.64, d: 0.035, r: 0.05, name: 'Notes AI', tag: '$', tagHex: '#e5483a', bar: 0.27, nameEm: 0.122, ...o };
  const g = new THREE.Group(); parent.add(g); const inner = new THREE.Group(); inner.position.y = o.h / 2; g.add(inner);
  const bev = 0.004, geo = new THREE.ExtrudeGeometry(rrShape(o.w - 2 * bev, o.h - 2 * bev, o.r - bev), { depth: o.d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 12 });
  geo.translate(0, 0, -(o.d - 2 * bev) / 2); const body = ctx.add(inner, new THREE.Mesh(geo, bodyMat()), { cast: true, recv: true, name: 'window' });
  const fw = o.w - 0.016, fh = o.h - 0.016, fg = new THREE.ShapeGeometry(rrShape(fw, fh, o.r - 0.008), 12); planarUV(fg, 1 / fw, 1 / fh, 0.5, 0.5);
  const face = ctx.add(inner, new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: o.faceTex || windowTex(o), roughness: 0.42, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), { cast: false, recv: true });
  face.position.z = o.d / 2 + 0.0006;
  /* state: hinge 0 = upright, 1 = lying flat face-up (the "pop up from flat" move); lean deg; scale */
  return { group: g, inner, face, probes: { window: body }, set(p, { hinge = 0, yaw = 0, lean = 0, scale = 1 } = {}) { g.position.set(p[0], p[1], p[2]); g.rotation.set(-rad(84) * hinge - rad(lean), rad(yaw), 0, 'YXZ'); g.scale.setScalar(scale); } };
}

/* ---------- tile: a solid satin block with an icon printed on its front face. o: { w 0.29, h 0.29, d 0.12, r 0.035, icon 'mic' } ---------- */
export function makeTile(ctx, parent, o = {}) {
  o = { w: 0.29, h: 0.29, d: 0.12, r: 0.035, icon: 'mic', ink: '#111111', accent: '#4a18ed', ...o };
  const g = new THREE.Group(); parent.add(g); const inner = new THREE.Group(); inner.position.y = o.h / 2; g.add(inner);
  const body = ctx.add(inner, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.h, o.d, 4, o.r), bodyMat()), { cast: true, recv: true, name: 'tile' });
  const fw = o.w - 0.03, fh = o.h - 0.03, fg = new THREE.ShapeGeometry(rrShape(fw, fh, o.r * 0.6), 10); planarUV(fg, 1 / fw, 1 / fh, 0.5, 0.5);
  const tex = canvasTex(512, 512, (c, w, h) => { c.clearRect(0, 0, w, h); drawIcon(c, o.icon, w / 2, h / 2, w * 0.72, o.ink, o.accent); });
  const face = ctx.add(inner, new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })), { recv: true }); face.position.z = o.d / 2 + 0.0008; face.renderOrder = 3;
  return { group: g, inner, probes: { tile: body }, set(p, { yaw = 0, roll = 0, sx = 1, sy = 1 } = {}) { g.position.set(p[0], p[1], p[2]); g.rotation.set(0, rad(yaw), rad(roll)); inner.scale.set(sx, sy, sx); inner.position.y = o.h / 2 * sy; } };
}

/* ---------- standCard: a standing card with an engraved line icon (PATH_ICONS) and a name (bump-mapped engraving). The card leans back
   `lean` deg about its slot line. o: { w 0.81, h 0.56, name 'Law firms', icon 'scales', em 0.125 } ---------- */
const CD = { tail: 0.06, t: 0.035, r: 0.06, bevel: 0.008, rough: 0.5, margin: 0.035, base: 0.065, icon: { s: 0.22, inset: 0.055, stroke: 7.0 } };
const textEm = (s) => { const g = document.createElement('canvas').getContext('2d'); g.font = '800 100px "Manrope"'; g.letterSpacing = '-2px'; return g.measureText(s).width / 100; };
function cardFace(o, W, Hh, em, bump) {
  const PXU = 1024 / W, w = 1024, h = Math.round(Hh * PXU), X = (x) => (x + W / 2) * PXU, Y = (y) => (Hh - y) * PXU, I = CD.icon;
  return canvasTex(w, h, (g) => {
    g.fillStyle = bump ? '#ffffff' : o.color; g.fillRect(0, 0, w, h);
    const s = I.s * PXU / 100; g.save(); g.translate(X(-W / 2 + I.inset), Y(Hh - I.inset)); g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = I.stroke; g.strokeStyle = bump ? '#000000' : o.ink;
    (PATH_ICONS[o.icon] || []).forEach((d) => g.stroke(new Path2D(d))); g.restore();
    if (!bump) { const px = em * PXU; g.font = `800 ${px.toFixed(1)}px "Manrope"`; g.letterSpacing = (-0.02 * px).toFixed(1) + 'px'; g.fillStyle = o.ink; g.textBaseline = 'alphabetic'; g.fillText(o.name, X(-W / 2 + CD.margin), Y(CD.base)); }
  }, !bump);
}
export function makeStandCard(ctx, parent, o = {}) {
  o = { w: 0.81, h: 0.56, name: 'Law firms', icon: 'scales', em: 0.125, color: '#ffffff', ink: '#111111', ...o };
  const W = o.w, Hh = o.h, lean = new THREE.Group(); parent.add(lean);
  const bv = CD.bevel, sh = new THREE.Shape(), x0 = -W / 2 + bv, x1 = W / 2 - bv, y0 = -CD.tail + bv, y1 = Hh - bv, r = CD.r - bv;
  sh.moveTo(x0 + r, y0); sh.lineTo(x1 - r, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + r); sh.lineTo(x1, y1 - r); sh.quadraticCurveTo(x1, y1, x1 - r, y1); sh.lineTo(x0 + r, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
  const depth = CD.t - 2 * bv, geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2); planarUV(geo, 1 / W, 1 / Hh, 0.5, 0);
  const em = Math.min(o.em, (W - 2 * CD.margin) / textEm(o.name));
  const map = cardFace(o, W, Hh, em, false), bmp = cardFace(o, W, Hh, em, true); [map, bmp].forEach((t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  const face = new THREE.MeshStandardMaterial({ map, bumpMap: bmp, bumpScale: 1.6, roughness: CD.rough }), edge = new THREE.MeshStandardMaterial({ color: o.color, roughness: CD.rough });
  const mesh = ctx.add(lean, new THREE.Mesh(geo, [face, edge]), { cast: true, recv: true, name: 'card' });
  const seat = [W / 2 - 0.05 - 0.115, Hh - 0.05 - 0.115];   // where a puck sits (top-right)
  return { group: lean, mesh, seat, probes: { card: mesh }, set(p, { yaw = 0, lean: l = 12 } = {}) { lean.position.set(p[0], p[1], p[2]); lean.rotation.set(-rad(l), rad(yaw), 0, 'YXZ'); } };
}

/* ---------- puck: a two-sided enamel puck (front: red LOCK, back: mint CHECK by default). set(p, ry, sxy, sz, rx) ---------- */
function puckTex(bg, draw) { return canvasTex(256, 256, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round'; draw(g); }); }
export const PUCK_FACES = {
  lock: (hex) => puckTex(hex, (q) => { q.lineWidth = 17; q.beginPath(); q.moveTo(98, 122); q.lineTo(98, 100); q.arc(128, 100, 30, Math.PI, 0); q.lineTo(158, 122); q.stroke(); q.beginPath(); q.roundRect(76, 116, 104, 80, 14); q.fill(); q.fillStyle = hex; q.beginPath(); q.arc(128, 148, 10, 0, 2 * Math.PI); q.fill(); q.fillRect(124, 150, 8, 22); }),
  check: (hex) => puckTex(hex, (q) => { q.lineWidth = 22; q.beginPath(); q.moveTo(76, 132); q.lineTo(112, 168); q.lineTo(182, 94); q.stroke(); }),
  x: (hex) => puckTex(hex, (q) => { q.lineWidth = 22; q.beginPath(); q.moveTo(86, 86); q.lineTo(170, 170); q.moveTo(170, 86); q.lineTo(86, 170); q.stroke(); }),
};
export function makePuck(ctx, parent, o = {}) {
  o = { r: 0.115, t: 0.04, front: ['lock', '#e5483a'], back: ['check', '#34d399'], rough: 0.32, clearcoat: 0.6, ccRough: 0.18, ...o };
  const R = o.r, T = o.t, g = new THREE.Group(), inner = new THREE.Group(); parent.add(g); g.add(inner);
  const half = (tex, sgn) => { const geo = new THREE.CylinderGeometry(R, R, T / 2, 64, 1, false); geo.rotateX(Math.PI / 2); geo.translate(0, 0, sgn * T / 4); planarUV(geo, sgn / (2 * R), 1 / (2 * R), 0.5, 0.5);
    return ctx.add(inner, new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: o.rough, clearcoat: o.clearcoat, clearcoatRoughness: o.ccRough })), { cast: true, recv: true }); };
  half(PUCK_FACES[o.front[0]](o.front[1]), 1); half(PUCK_FACES[o.back[0]](o.back[1]), -1);
  return { group: g, probes: { puck: inner }, set(p, ry = 0, sxy = 1, sz = 1, rx = 0) { g.position.set(p[0], p[1], p[2]); g.rotation.set(rx, ry, 0, 'YXZ'); inner.scale.set(sxy, sxy, sz); } };
}

/* ---------- plug: a satin connector block (metal blade at the back, printed face, LED bar). o: { w 0.38, h 0.42, d 0.28, label, icon, blade } ----------
   setLed(level, hex): 0 = off grey; > 0 = lit (emissive, blooms). Face: label text (Manrope 800) and/or an icon. */
export function makePlug(ctx, parent, o = {}) {
  o = { w: 0.38, h: 0.42, d: 0.28, r: 0.05, blade: [0.17, 0.045, 0.06], bladeY: 0.06, faceBox: [0.30, 0.28], faceY: 0.255, bar: [0.17, 0.018], barY: 0.065, label: 'API', icon: null, ink: '#111111', accent: '#4a18ed', ...o };
  const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner); parent.add(outer);
  const bodyM = MAT.satin('#f3f1ec', { roughness: 0.40, clearcoat: 0.25, clearcoatRoughness: 0.30 });
  const body = ctx.add(inner, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.h, o.d, 4, o.r), bodyM), { cast: true, recv: true, name: 'plug' }); body.position.set(0, o.h / 2, o.d / 2);
  if (o.blade) ctx.add(inner, new THREE.Mesh(new RoundedBoxGeometry(o.blade[0], o.blade[1], o.blade[2] + 0.02, 2, 0.008), MAT.anodised('#d2d3d7')), { cast: true, recv: true }).position.set(0, o.bladeY, -o.blade[2] / 2 + 0.01);
  const fw = 640, fh = Math.round(640 * o.faceBox[1] / o.faceBox[0]);
  const ftex = o.faceTex || canvasTex(fw, fh, (g, w, h) => { g.clearRect(0, 0, w, h);
    if (o.icon) drawIcon(g, o.icon, w / 2, o.label ? h * 0.38 : h / 2, h * (o.label ? 0.55 : 0.8), o.ink, o.accent);
    if (o.label) { let px = Math.round(h * (o.icon ? 0.24 : 0.42)); g.font = `800 ${px}px "Manrope"`; const tw = g.measureText(o.label).width; px = Math.floor(px * Math.min(1, (w * 0.9) / tw)); g.font = `800 ${px}px "Manrope"`; g.fillStyle = o.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.label, w / 2, o.icon ? h * 0.82 : h / 2); } });
  const face = ctx.add(inner, new THREE.Mesh(new THREE.PlaneGeometry(o.faceBox[0], o.faceBox[1]), new THREE.MeshStandardMaterial({ map: ftex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })), { recv: true });
  face.position.set(0, o.faceY, o.d + 0.0012); face.renderOrder = 3;
  const barM = new THREE.MeshBasicMaterial({ color: 0x000000 }), barB = new THREE.MeshBasicMaterial({ color: 0x000000 });
  ctx.add(inner, new THREE.Mesh(new RoundedBoxGeometry(o.bar[0], o.bar[1], 0.006, 2, o.bar[1] * 0.45), barM), { bloom: barB }).position.set(0, o.barY, o.d + 0.001);
  const api = { group: outer, inner, probes: { plug: body },
    setLed(level, hex = '#34d399', lv = 1) { if (level > 0) { barM.color.copy(ctx.emis(hex, Math.min(level, 1.6) * lv)); barB.color.copy(ctx.emis(hex, 1.8 * level * lv)); } else { barM.color.copy(ctx.emis('#cfcac1', 0.82)); barB.color.setRGB(0, 0, 0); } },
    /* pose: base-front position (x, y, zFront), rock (rad, about x), squash along z (sz < 1 = compressed), LED */
    set(p, { rock = 0, sz = 1, led = 0, ledHex, lv = 1 } = {}) { outer.position.set(p[0], p[1], p[2] - o.d / 2); outer.rotation.set(rock, 0, 0); const k = 1 + 0.5 * (1 - sz); inner.scale.set(k, k, sz); api.setLed(led, ledHex, lv); } };
  api.setLed(0); return api;
}
