/* motion-pack/objects/lib/hwboard.js (xp-hardware, 2026-10-16): board-level hardware props (owned, procedural, generic; no vendor marks, no real part numbers).
     makePCB(ctx, parent, o)       a board: soldermask with seeded copper traces, a chip (SoC) with a die, memory packages, VRM chokes, an MLCC field, gold edge fingers
     makeChip(ctx, parent, o)      a package: substrate, metal lid (IHS), and the DIE under it; set({ open, glow }) lifts the lid and lights the die's blocks one by one
     dieTexture(o) / dieLayout(o)  the procedural die pattern (core tiles, a dense matrix block, cache, IO ring) as a canvas, and its block list (pure) for overlays
     makeHeatsink(ctx, parent, o)  a fin stack (instanced) on a copper base with heat pipes
     makeFan(ctx, parent, o)       a framed axial fan: hub + swept blades; set({ spin }) (radians, a pure function of t from the caller)
     makeGPUCard(ctx, parent, o)   a GPU-like accelerator card: board, faceted shroud with fan openings, fans, backplate, an accent light strip, bracket, edge fingers
   Units: kit units (1 ~ 25 cm). The die pattern is decorative and generic: block names on overlays are placeholders the template labels as such. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, mulberry32, seg, E } from '../kit/util.js';
import { MAT, canvasTex, rrShape } from './mat.js';
import { dieLayout } from './hwdata.js';

const metal = (ctx, m, k = 0.9) => { if (ctx.metalEnv) { m.envMap = ctx.metalEnv; m.envMapIntensity = k; } return m; };
const copper = (ctx) => metal(ctx, new THREE.MeshPhysicalMaterial({ color: '#b87a45', roughness: 0.3, metalness: 1 }), 0.9);
const gold = (ctx) => metal(ctx, new THREE.MeshPhysicalMaterial({ color: '#d4a64a', roughness: 0.25, metalness: 1 }), 0.9);

/* ---------- the die: a pure block layout (fractions of the die, 0..1) + a canvas drawing of it ---------- */
export { dieLayout };   // pure, in hwdata.js (node reads it too; type/gfx/hw.js dieBlocks is the same table, checked by templates/_hw/hw.test.mjs)
export function dieTexture(o = {}, glowOnly = false) {
  const B = dieLayout(o), seed = o.seed ?? 5, n = o.res ?? 1024;
  return canvasTex(n, n, (g) => {
    const r = mulberry32(seed);
    if (glowOnly) { g.fillStyle = '#000'; g.fillRect(0, 0, n, n); }
    else {   // silicon: a deep blue-violet ground with a thin-film sheen, an IO pad ring
      const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, '#1d2433'); gr.addColorStop(0.45, '#2a2140'); gr.addColorStop(1, '#16302e'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
      g.fillStyle = '#7d6a3a'; for (let i = 0; i < 48; i++) { const t = (i + 0.5) / 48 * n; for (const [x, y] of [[t, n * 0.025], [t, n * 0.975], [n * 0.025, t], [n * 0.975, t]]) g.fillRect(x - n * 0.006, y - n * 0.006, n * 0.012, n * 0.012); }
    }
    for (const b of B) {
      const x = b.x * n, y = b.y * n, w = b.w * n, h = b.h * n, lit = o.lit ? (o.lit[b.id] ?? 0) : 0;
      if (glowOnly) { if (lit > 0) { g.fillStyle = `rgba(255,255,255,${(0.85 * lit).toFixed(3)})`; g.fillRect(x, y, w, h); } continue; }
      const base = { core: '#3b3f5c', matrix: '#2e4a52', cache: '#4a4030', mem: '#3a3346', misc: '#33383f' }[b.kind];
      g.fillStyle = base; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(210,200,255,0.18)'; g.lineWidth = Math.max(1, n / 512);
      if (b.kind === 'matrix') { const k = 16; for (let i = 0; i <= k; i++) { g.beginPath(); g.moveTo(x + (w * i) / k, y); g.lineTo(x + (w * i) / k, y + h); g.moveTo(x, y + (h * i) / k); g.lineTo(x + w, y + (h * i) / k); g.stroke(); } }
      else if (b.kind === 'cache' || b.kind === 'mem') { for (let i = 0; i < 24; i++) { g.fillStyle = `rgba(255,236,190,${(0.05 + 0.08 * r()).toFixed(3)})`; g.fillRect(x + (w * i) / 24, y + h * 0.1, w / 26, h * 0.8); } }
      else { for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(200,220,255,${(0.05 + 0.1 * r()).toFixed(3)})`; g.fillRect(x + r() * w * 0.8, y + r() * h * 0.8, w * (0.1 + 0.2 * r()), h * (0.08 + 0.15 * r())); } }
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  });
}

/* ---------- a chip package with a die ---------- */
export function makeChip(ctx, parent, o = {}) {
  o = { size: 0.16, t: 0.012, die: 0.62, cores: 8, accent: '#5cc8ff', lid: true, seed: 5, ...o };
  const g = new THREE.Group(); parent.add(g); const S = o.size;
  ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(S, o.t * 0.4, S, 2, 0.003), MAT.satin('#1e3b2c', { roughness: 0.6, clearcoat: 0.3 })), { cast: true, recv: true }).position.y = o.t * 0.2;
  const ds = S * o.die, dieMat = new THREE.MeshPhysicalMaterial({ map: dieTexture({ cores: o.cores, seed: o.seed }), roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.55, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 700] });
  metal(ctx, dieMat, 0.7);
  const die = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(ds, o.t * 0.18, ds), dieMat), { cast: false, recv: true, name: 'die' }); die.position.y = o.t * 0.4 + o.t * 0.09;
  // the glow plane: the lit blocks drawn white on black, coloured by the accent (MeshBasic + its bloom twin)
  const glowM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), glowB = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const glow = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(ds, ds), glowM), { recv: false, decal: false, bloom: glowB, name: 'die.glow' }); glow.rotation.x = -Math.PI / 2; glow.position.y = die.position.y + o.t * 0.091;
  let lid = null; const lidG = new THREE.Group(); g.add(lidG);
  if (o.lid) { lid = ctx.add(lidG, new THREE.Mesh(new RoundedBoxGeometry(S * 0.86, o.t * 0.55, S * 0.86, 3, 0.004), metal(ctx, MAT.anodised('#c3c6cc', { roughness: 0.2 }))), { cast: true, recv: true, name: 'chip.lid' }); lid.position.y = o.t * 0.4 + o.t * 0.275; }
  const layout = dieLayout({ cores: o.cores }); let key = '';
  const api = { group: g, die, lid: lidG, layout, size: S, probes: { die, chip: lid || die },
    /* open 0..1: the lid lifts (0-0.5) and tilts away; glow 0..1: the die blocks light one by one (cores first, then the matrix, cache, memory) */
    set({ open = 0, glow: k = 0, accent = o.accent } = {}) {
      const u = E.move(seg(open, 0, 0.6)); lidG.position.set(0, u * S * 1.4, -u * S * 0.35); lidG.rotation.set(-u * 0.5, 0, 0); lidG.visible = u < 0.999;
      const lit = {}; layout.forEach((b, i) => { lit[b.id] = E.soft(clamp(k * (layout.length + 2) - i)); });
      const ky = layout.map((b) => lit[b.id].toFixed(2)).join(','); if (ky !== key) { key = ky; if (glowM.map) glowM.map.dispose(); glowM.map = dieTexture({ cores: o.cores, lit, res: 256 }, true); glowB.map = glowM.map; glowM.needsUpdate = glowB.needsUpdate = true; }
      const lv = clamp(k * 3); glowM.color.copy(ctx.emis(accent || o.accent, 0.9 * lv)); glowB.color.copy(ctx.emis(accent || o.accent, 1.2 * lv)); glow.visible = lv > 0.001;
      return api;
    } };
  api.set({}); return api;
}

/* ---------- a PCB: o { w, d, t, color, seed, chips: 'node' | 'card' | [] , soc: { x, z, size, t } } ---------- */
function traceTex(seed, color, n = 1024) {
  return canvasTex(n, n, (g) => {
    const r = mulberry32(seed); g.fillStyle = color; g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(200,170,110,0.22)'; g.lineCap = 'round';
    for (let i = 0; i < 260; i++) { g.lineWidth = n * (0.0012 + 0.002 * r()); let x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() - 0.5) * n * 0.3; else y += (r() - 0.5) * n * 0.3; const dx = (r() - 0.5) * n * 0.05; g.lineTo(x + dx, y + dx); } g.stroke(); }
    g.fillStyle = 'rgba(210,180,120,0.35)'; for (let i = 0; i < 500; i++) { const x = r() * n, y = r() * n, s = n * 0.0035; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); }
  });
}
export function makePCB(ctx, parent, o = {}) {
  o = { w: 0.86, d: 0.7, t: 0.008, color: '#10261f', seed: 11, chips: 'node', soc: { x: -0.2, z: 0.03, size: 0.16, t: 0.012 }, accent: '#5cc8ff', ...o };
  const g = new THREE.Group(); parent.add(g);
  const mask = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: traceTex(o.seed, o.color), roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  const board = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.t, o.d, 2, 0.004), mask), { cast: true, recv: true, name: 'pcb' }); board.position.y = o.t / 2;
  const top = o.t, r = mulberry32(o.seed + 3), black = MAT.ink('#141418', { roughness: 0.4, clearcoat: 0.4 }), grey = metal(ctx, MAT.darkMetal('#5a5d64', { roughness: 0.45 }));
  let chip = null;
  if (o.chips === 'node' || o.chips === 'card') {
    const so = o.soc; chip = makeChip(ctx, g, { size: so.size, t: so.t, accent: o.accent, cores: o.chips === 'card' ? 12 : 8 }); chip.group.position.set(so.x, top, so.z);
    for (const [dx, dz] of [[1.05, -0.4], [1.05, 0.4], [-1.05, -0.4], [-1.05, 0.4]]) { const m = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(so.size * 0.42, 0.006, so.size * 0.62, 1, 0.0015), black), { cast: true, recv: true }); m.position.set(so.x + dx * so.size * 0.95, top + 0.003, so.z + dz * so.size * 1.2); }
    for (let i = 0; i < 6; i++) { const m = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(0.028, 0.02, 0.028, 2, 0.003), grey), { cast: true, recv: true }); m.position.set(so.x - so.size * 0.6 + i * 0.036, top + 0.01, so.z - so.size * 1.25); }
    const mlcc = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.004, 0.004), MAT.satin('#b39a6e', { roughness: 0.5 }), 120), mm = new THREE.Matrix4();
    for (let i = 0; i < 120; i++) { mm.makeTranslation(-o.w * 0.45 + r() * o.w * 0.9, top + 0.002, -o.d * 0.45 + r() * o.d * 0.9); mlcc.setMatrixAt(i, mm); } ctx.add(g, mlcc, { cast: false, recv: true });
  }
  // gold edge fingers along the front edge
  const fingers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.0012, 0.03), gold(ctx), 40), fm = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { fm.makeTranslation(-o.w * 0.3 + i * (o.w * 0.6 / 40), top + 0.0006, o.d / 2 - 0.018); fingers.setMatrixAt(i, fm); } ctx.add(g, fingers, { recv: true });
  return { group: g, board, chip, probes: { pcb: board } };
}

/* ---------- heatsink: o { w, d, h, fins, base 0.012, pipes 3, finColor } (fins run along Z, stacked along X) ---------- */
export function makeHeatsink(ctx, parent, o = {}) {
  o = { w: 0.34, d: 0.34, h: 0.12, fins: 26, base: 0.012, pipes: 3, finColor: '#c9ccd2', ...o };
  const g = new THREE.Group(); parent.add(g); const n = Math.max(2, Math.min(120, Math.round(o.fins))), ft = Math.min(0.004, o.w / n * 0.35);
  ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(o.w * 0.7, o.base, o.d * 0.7, 2, 0.003), copper(ctx)), { cast: true, recv: true }).position.y = o.base / 2;
  const finM = metal(ctx, MAT.anodised(o.finColor, { roughness: 0.28 })), fins = new THREE.InstancedMesh(new THREE.BoxGeometry(ft, o.h - o.base, o.d), finM, n), m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m.makeTranslation(-o.w / 2 + (i + 0.5) * (o.w / n), o.base + (o.h - o.base) / 2, 0); fins.setMatrixAt(i, m); }
  ctx.add(g, fins, { cast: true, recv: true, name: 'heatsink.fins' });
  const pm = copper(ctx);
  for (let i = 0; i < o.pipes; i++) { const x = -o.w * 0.25 + (i * o.w * 0.5) / Math.max(1, o.pipes - 1), z0 = -o.d * 0.2;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, o.base * 0.5, z0), new THREE.Vector3(x, o.base * 0.5, o.d * 0.15), new THREE.Vector3(x, o.h * 0.35, o.d * 0.46), new THREE.Vector3(x, o.h * 0.85, o.d * 0.2), new THREE.Vector3(x, o.h * 0.88, -o.d * 0.42)]);
    ctx.add(g, new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.007, 10, false), pm), { cast: true, recv: true }); }
  return { group: g, fins, probes: { heatsink: fins } };
}

/* ---------- fan: o { r, t, blades, frame (true = square frame), color } (axis +Y) ---------- */
function bladeGeo(r0, r1, sweep = 0.55, t = 0.003) {
  const s = new THREE.Shape(), N = 10; s.moveTo(r0, -0.012); for (let i = 0; i <= N; i++) { const u = i / N, rr = r0 + (r1 - r0) * u, a = sweep * u * u; s.lineTo(rr * Math.cos(a), rr * Math.sin(a) - 0.012 * (1 - u)); }
  for (let i = N; i >= 0; i--) { const u = i / N, rr = r0 + (r1 - r0) * u, a = sweep * u * u + 0.42 - 0.12 * u; s.lineTo(rr * Math.cos(a), rr * Math.sin(a)); }
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
}
export function makeFan(ctx, parent, o = {}) {
  o = { r: 0.16, t: 0.028, blades: 9, frame: true, color: '#1a1b1f', pitch: 0.22, ...o };
  const g = new THREE.Group(); parent.add(g); const rot = new THREE.Group(); rot.position.y = o.t * 0.5; g.add(rot);
  const dark = MAT.satin(o.color, { roughness: 0.5, clearcoat: 0.2 });
  if (o.frame) { const S = o.r * 2.12, s = rrShape(S, S, S * 0.08), h = new THREE.Path(); h.absarc(0, 0, o.r * 1.02, 0, Math.PI * 2, true); s.holes.push(h);
    const fg = new THREE.ExtrudeGeometry(s, { depth: o.t, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 48 }); fg.rotateX(-Math.PI / 2);
    ctx.add(g, new THREE.Mesh(fg, dark), { cast: true, recv: true, name: 'fan.frame' }); }
  ctx.add(rot, new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.3, o.r * 0.3, o.t * 0.7, 40), dark), { cast: true, recv: true, name: 'fan.hub' });
  const bm = MAT.satin('#202126', { roughness: 0.45, clearcoat: 0.35 }), bg = bladeGeo(o.r * 0.28, o.r * 0.98);
  for (let i = 0; i < o.blades; i++) { const b = ctx.add(rot, new THREE.Mesh(bg, bm), { cast: true, recv: true }); b.rotation.set(0, (i / o.blades) * Math.PI * 2, o.pitch); }
  return { group: g, rotor: rot, probes: { fan: rot }, set({ spin = 0 } = {}) { rot.rotation.y = -spin; } };
}

/* ---------- GPU-like card: o { w, d, t, fans, shroud, accent, bracket } lying flat, fans up, the bracket on the -X end ---------- */
export function makeGPUCard(ctx, parent, o = {}) {
  o = { w: 0.4, d: 0.56, t: 0.06, fans: 2, shroud: '#202227', trim: '#8e939b', accent: '#5cc8ff', bracket: true, seed: 13, ...o };
  const g = new THREE.Group(); parent.add(g);
  const pcb = makePCB(ctx, g, { w: o.w, d: o.d, t: 0.006, color: '#0e1d26', seed: o.seed, chips: 'card', soc: { x: 0, z: 0, size: Math.min(o.w, o.d) * 0.3, t: 0.01 } });
  const back = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(o.w * 0.98, 0.004, o.d * 0.98, 2, 0.003), metal(ctx, MAT.anodised(o.trim, { roughness: 0.32 }))), { cast: true, recv: true }); back.position.y = -0.003;
  // the shroud: a faceted plate (octagonal outline, chamfered) with one round opening per fan
  const H = o.t - 0.012, ch = Math.min(o.w, o.d) * 0.06, sh = new THREE.Shape(), hw = o.w / 2, hd = o.d / 2;
  sh.moveTo(-hw + ch, -hd); sh.lineTo(hw - ch, -hd); sh.lineTo(hw, -hd + ch); sh.lineTo(hw, hd - ch); sh.lineTo(hw - ch, hd); sh.lineTo(-hw + ch, hd); sh.lineTo(-hw, hd - ch); sh.lineTo(-hw, -hd + ch); sh.closePath();
  const fr = Math.min(o.w * 0.42, o.d / (o.fans * 2.1)), fz = (i) => -hd + (o.d / o.fans) * (i + 0.5);
  for (let i = 0; i < o.fans; i++) { const p = new THREE.Path(); p.absarc(0, -fz(i), fr * 1.04, 0, Math.PI * 2, true); sh.holes.push(p); }
  const sgeo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 48 }); sgeo.rotateX(-Math.PI / 2);
  const shroudM = metal(ctx, new THREE.MeshPhysicalMaterial({ color: o.shroud, roughness: 0.42, metalness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3 }), 0.8);
  const shroud = ctx.add(g, new THREE.Mesh(sgeo, shroudM), { cast: true, recv: true, name: 'card.shroud' }); shroud.position.y = H;
  const walls = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(o.w * 0.96, H - 0.006, o.d * 0.96, 2, 0.004), MAT.rubber('#0c0c0e', { roughness: 0.7 })), { cast: true, recv: true }); walls.position.y = 0.006 + (H - 0.006) / 2;
  const fans = []; for (let i = 0; i < o.fans; i++) { const f = makeFan(ctx, g, { r: fr, t: 0.012, blades: 11, frame: false, pitch: 0.28 }); f.group.position.set(0, H - 0.004, fz(i)); fans.push(f); }
  // accent light strip along the +X edge of the shroud
  const am = new THREE.MeshBasicMaterial({ color: 0x000000 }), ab = new THREE.MeshBasicMaterial({ color: 0x000000 });
  ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, o.d * 0.7), am), { recv: false, bloom: ab, name: 'card.light' }).position.set(hw + 0.001, H + 0.004, 0);
  if (o.bracket) { const br = ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(0.004, o.t * 1.6, o.d * 1.02), metal(ctx, MAT.anodised('#c9ccd2', { roughness: 0.3 }))), { cast: true, recv: true, name: 'card.bracket' }); br.position.set(-hw - 0.004, o.t * 0.6, 0); }
  const api = { group: g, fans, pcb, probes: { card: shroud },
    set({ spin = 0, glow = 0, accent = o.accent } = {}) { fans.forEach((f, i) => f.set({ spin: spin * (i % 2 ? -1 : 1) + i * 0.4 })); am.color.copy(ctx.emis(accent || o.accent, Math.min(1.2, glow))); ab.color.copy(ctx.emis(accent || o.accent, 1.4 * glow)); if (pcb.chip) pcb.chip.set({ open: 0, glow: 0 }); return api; } };
  api.set({}); return api;
}
