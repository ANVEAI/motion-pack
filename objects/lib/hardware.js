/* motion-pack/objects/lib/hardware.js (xp-hardware, 2026-10-16): generic HARDWARE props for device launch films (owned, procedural, no brand marks).
     makeEnclosure(ctx, parent, o)   a configurable box: dimensions, chamfer, footprint radius, material (anodised | matteBlack | glass), glass / grille / solid top,
                                     an LED light band, side vent slots, generic back ports, rubber feet. Parts are separate groups (shell, top, base) so they explode.
     makeVentGrille(ctx, parent, o)  a vent field: slots or a hex field on a plate (instanced, cheap)
     makePorts(ctx, parent, o)       generic port cut-outs on a panel (power, network, display out, data, wide data, audio): recess + metal surround
     makeCable(ctx, parent, o)       a tube on a sagging curve with a plug; set({ insert }) pushes it home
     makeNode(ctx, parent, spec)     the assembled demo device (lib/hwdata.js layout): enclosure + board + SoC + heatsink + fan + card, every part its own group
   Board-level props (PCB, chip with a die, heatsink, fan, GPU-like card) live in lib/hwboard.js. Units: kit units (1 ~ 25 cm), origin = base centre, +Z = front.
   Every setter is a pure function of its arguments: seek-safe. Materials follow lib/mat.js rules (no pure black or white, roughness never 0). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp } from '../kit/util.js';
import { MAT, rrShape, grainTex } from './mat.js';
import { nodeLayout, PORT_KINDS } from './hwdata.js';
import { makePCB, makeChip, makeHeatsink, makeFan, makeGPUCard } from './hwboard.js';

export const metalEnv = (ctx, m, k = 0.9) => { if (ctx.metalEnv) { m.envMap = ctx.metalEnv; m.envMapIntensity = k; } return m; };
/* the shell materials: anodised aluminium (fine seeded grain in the roughness), matte black (soft-touch coat), smoked glass (dark, clear-coated, mirrors the strips) */
export function enclosureMaterial(ctx, kind = 'anodised', hex = null, seed = 7) {
  if (kind === 'matteBlack') return metalEnv(ctx, new THREE.MeshPhysicalMaterial({ color: hex || '#17181b', roughness: 0.58, metalness: 0.35, clearcoat: 0.12, clearcoatRoughness: 0.5, roughnessMap: grainTex(seed, 256, 0.05, 0.6) }), 0.6);
  if (kind === 'glass') return metalEnv(ctx, new THREE.MeshPhysicalMaterial({ color: hex || '#0d0f13', roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.6 }), 1.1);
  return metalEnv(ctx, MAT.anodised(hex || '#8e939b', { roughness: 0.3, roughnessMap: grainTex(seed, 256, 0.06, 0.55) }), 0.95);
}
/* a vertical block: rounded-rect footprint w x d, height h, a flat CHAMFER c on the top and bottom edges (one bevel segment: crisp highlight lines) */
export function chamferBlockGeo(w, h, d, r, c, curve = 12) {
  c = Math.max(0, Math.min(c, h * 0.45, w * 0.2, d * 0.2)); const s = rrShape(w - 2 * c, d - 2 * c, Math.max(0.0008, r - c));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, h - 2 * c), bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelSegments: 1, curveSegments: curve });
  g.rotateX(-Math.PI / 2); g.translate(0, c, 0); return g;
}
/* a sleeve (four walls, open top and bottom): outer w x d radius r, wall t, height h, a chamfer c on the outer top and bottom edges */
export function sleeveGeo(w, h, d, r, t, c = 0, curve = 12) {
  c = Math.max(0, Math.min(c, t * 0.8, h * 0.4)); const s = rrShape(w - 2 * c, d - 2 * c, Math.max(0.0008, r - c));
  s.holes.push(rrShape(w - 2 * t, d - 2 * t, Math.max(0.0008, r - t)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, h - 2 * c), bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelSegments: 1, curveSegments: curve });
  g.rotateX(-Math.PI / 2); g.translate(0, c, 0); return g;
}

/* ---------- vent grille: o { w, h (the field size on its plane), kind 'slots' | 'hex', rows, cols, gap, color, plate (false = holes only) } in the XY plane, facing +Z ---------- */
export function makeVentGrille(ctx, parent, o = {}) {
  o = { w: 0.5, h: 0.16, kind: 'slots', rows: 3, cols: 18, gap: 0.35, color: '#060607', plate: false, plateColor: null, depth: 0.003, ...o };
  const g = new THREE.Group(); parent.add(g);
  const rows = Math.max(1, Math.min(40, Math.round(o.rows))), cols = Math.max(1, Math.min(80, Math.round(o.cols)));
  const cw = o.w / cols, ch = o.h / rows, hole = MAT.rubber(o.color, { roughness: 0.92 });
  let geo;
  if (o.kind === 'hex') { geo = new THREE.CylinderGeometry(Math.min(cw, ch) * (1 - o.gap) * 0.55, Math.min(cw, ch) * (1 - o.gap) * 0.55, o.depth, 6); geo.rotateX(Math.PI / 2); }
  else { const sw = cw * (1 - o.gap), sh = ch * (1 - o.gap); geo = new RoundedBoxGeometry(sw, sh, o.depth, 2, Math.min(sw, sh) * 0.45); }
  const im = new THREE.InstancedMesh(geo, hole, rows * cols), m = new THREE.Matrix4(); let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const off = o.kind === 'hex' && r % 2 ? cw / 2 : 0; if (o.kind === 'hex' && r % 2 && c === cols - 1) continue; m.makeTranslation(-o.w / 2 + (c + 0.5) * cw + off, -o.h / 2 + (r + 0.5) * ch, 0); im.setMatrixAt(i++, m); }
  im.count = i; ctx.add(g, im, { cast: false, recv: true, name: 'vents' });
  if (o.plate) { const pm = enclosureMaterial(ctx, 'anodised', o.plateColor); const p = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(o.w * 1.06, o.h * 1.12, o.depth * 0.8, 3, 0.01), pm), { cast: true, recv: true }); p.position.z = -o.depth * 0.6; }
  return { group: g, mesh: im, probes: { vents: im } };
}

/* ---------- ports: o { ports: [{ kind, x, y }] (PORT_KINDS of hwdata.js), metal hex } on a panel in the XY plane facing +Z; returns the port centres for callouts ---------- */
function portGeo(P, sc = 1) {
  const w = P.w * sc, h = P.h * sc;
  if (P.round) { const g = new THREE.CylinderGeometry(w / 2, w / 2, 0.006, 32); g.rotateX(Math.PI / 2); return g; }
  if (P.trapezoid) { const s = new THREE.Shape(); s.moveTo(-w / 2, h / 2); s.lineTo(w / 2, h / 2); s.lineTo(w / 2 - h * 0.35, -h / 2); s.lineTo(-w / 2 + h * 0.35, -h / 2); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }); g.translate(0, 0, -0.003); return g; }
  return new RoundedBoxGeometry(w, h, 0.006, 3, P.pill ? h * 0.49 : Math.min(w, h) * 0.12);
}
export function makePorts(ctx, parent, o = {}) {
  o = { ports: [], metal: '#b9bcc2', ...o };
  const g = new THREE.Group(); parent.add(g); const inner = MAT.rubber('#08080a', { roughness: 0.85 }), frame = metalEnv(ctx, MAT.anodised(o.metal, { roughness: 0.24 })), tongue = metalEnv(ctx, MAT.darkMetal('#3a3c42', { roughness: 0.4 }));
  const centres = [];
  for (const p of o.ports.slice(0, 16)) {
    const P = PORT_KINDS[p.kind] || PORT_KINDS.data, pg = new THREE.Group(); pg.position.set(p.x, p.y, 0); g.add(pg);
    ctx.add(pg, new THREE.Mesh(portGeo(P, 1.28), frame), { cast: false, recv: true }).position.z = -0.0022;
    ctx.add(pg, new THREE.Mesh(portGeo(P, 1.0), inner), { cast: false, recv: true }).position.z = -0.0006;
    if (p.kind === 'net') ctx.add(pg, new THREE.Mesh(new THREE.BoxGeometry(P.w * 0.36, P.h * 0.22, 0.004), inner), { recv: true }).position.set(0, -P.h * 0.58, -0.0004);   // the latch notch
    if (P.pill || p.kind === 'wide') ctx.add(pg, new THREE.Mesh(new THREE.BoxGeometry(P.w * 0.62, P.h * 0.26, 0.004), tongue), { recv: true }).position.z = 0.0002;          // the contact tongue
    if (p.kind === 'power') ctx.add(pg, new THREE.Mesh(new THREE.CylinderGeometry(P.w * 0.12, P.w * 0.12, 0.006, 16).rotateX(Math.PI / 2), frame), { recv: true }).position.z = 0.0004;
    centres.push([p.x, p.y, 0]);
  }
  return { group: g, centres, probes: { ports: g } };
}

/* ---------- the enclosure ---------- */
export function makeEnclosure(ctx, parent, spec = {}) {
  const L = nodeLayout(spec), s = L.spec, { w, h, d, r, wall } = s, c = s.chamfer, topT = 0.026, foot = L.foot;
  const root = new THREE.Group(); parent.add(root); const lift = new THREE.Group(); lift.position.y = foot; root.add(lift);
  const parts = { shell: new THREE.Group(), top: new THREE.Group(), base: new THREE.Group() }; for (const k in parts) lift.add(parts[k]);
  const shellM = enclosureMaterial(ctx, s.material, s.color);
  const sleeveH = h - topT;
  const shell = ctx.add(parts.shell, new THREE.Mesh(sleeveGeo(w, sleeveH, d, r, wall, c, 16), shellM), { cast: true, recv: true, name: 'shell' });
  // the top: a chamfered plate with an inlay (smoked glass, a vent field or solid)
  const top = ctx.add(parts.top, new THREE.Mesh(chamferBlockGeo(w, topT, d, r, c * 0.9, 16), shellM), { cast: true, recv: true, name: 'top' }); top.position.y = sleeveH;
  let inlay = null;
  if (s.top.kind === 'glass') { const ins = s.top.inset; inlay = ctx.add(parts.top, new THREE.Mesh(chamferBlockGeo(w - 2 * ins, 0.004, d - 2 * ins, Math.max(0.004, r - ins), 0.0015, 16), enclosureMaterial(ctx, 'glass')), { recv: true, name: 'top.glass' }); inlay.position.y = h - 0.0015; }
  else if (s.top.kind === 'grille') { const vg = makeVentGrille(ctx, parts.top, { w: w - 2 * s.top.inset - 0.04, h: d - 2 * s.top.inset - 0.04, kind: 'hex', rows: 14, cols: 22 }); vg.group.rotation.x = -Math.PI / 2; vg.group.position.y = h + 0.0006; inlay = vg.mesh; }
  // base plate + feet (inside the footprint, recessed: the device floats a few mm on its feet)
  const base = ctx.add(parts.base, new THREE.Mesh(new RoundedBoxGeometry(w - 2 * wall - 0.004, wall, d - 2 * wall - 0.004, 3, 0.006), enclosureMaterial(ctx, 'matteBlack')), { cast: true, recv: true, name: 'base' }); base.position.y = wall / 2;
  if (s.feet) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = ctx.add(parts.base, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, foot, 24), MAT.rubber()), { cast: true }); f.position.set(sx * (w / 2 - 0.1), -foot / 2, sz * (d / 2 - 0.09)); }
  // LED band: a thin emissive ring proud of the wall by 1 mm (MeshBasic + a bloom twin: the kit's emissive contract)
  let bandMat = null, bandBloom = null, band = null;
  if (s.band.on) {
    bandMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); bandBloom = new THREE.MeshBasicMaterial({ color: 0x000000 });
    band = ctx.add(parts.shell, new THREE.Mesh(sleeveGeo(w + 0.002, s.band.h, d + 0.002, r + 0.001, 0.004, 0, 20), bandMat), { recv: false, bloom: bandBloom, name: 'band' }); band.position.y = s.band.y - s.band.h / 2;
  }
  // side vents (both x faces) and the back ports
  if (s.vents.side && s.vents.rows > 0 && s.vents.cols > 0) for (const sx of [-1, 1]) { const v = makeVentGrille(ctx, parts.shell, { w: d * 0.62, h: sleeveH * 0.42, rows: s.vents.rows, cols: s.vents.cols }); v.group.rotation.y = sx * Math.PI / 2; v.group.position.set(sx * (w / 2 + 0.0004), sleeveH * 0.58, 0); }
  const ports = makePorts(ctx, parts.shell, { ports: L.ports.map((p) => ({ kind: p.kind, x: -p.x, y: p.y })) }); ports.group.rotation.y = Math.PI; ports.group.position.z = -d / 2 - 0.0004;
  const api = { group: root, lift, parts, layout: L, band, inlay, shellMat: shellM, probes: { shell, top, band: band || shell },
    /* band: level 0..1.6 (1 = the design colour), hex: override colour, sweep: 0..1 left-to-right ignition (1 = fully lit) */
    setBand(level = 1, hex = s.band.color, sweep = 1) { if (!bandMat) return; const a = Math.max(0, level) * clamp(sweep * 1.0001); if (a <= 0) { bandMat.color.setRGB(0.012, 0.013, 0.015, THREE.LinearSRGBColorSpace); bandBloom.color.setRGB(0, 0, 0); } else { bandMat.color.copy(ctx.emis(hex, Math.min(a, 1.4))); bandBloom.color.copy(ctx.emis(hex, 1.6 * a)); } },
    pose(p = [0, 0, 0], yaw = 0, sc = 1) { root.position.set(p[0], p[1], p[2]); root.rotation.set(0, yaw, 0); root.scale.setScalar(sc); },
  };
  api.setBand(0); return api;
}

/* ---------- cable: o { from [x,y,z], to [x,y,z] (the socket), dir (unit insert axis at the socket, default -Z into the panel), sag, r, color, plug 'data' | 'net' | 'power' } ---------- */
export function makeCable(ctx, parent, o = {}) {
  o = { from: [0.9, 0.0, -1.2], to: [0, 0.12, -0.4], dir: [0, 0, 1], sag: 0.18, r: 0.012, color: '#1b1c20', plug: 'data', plugLen: 0.07, ...o };
  const g = new THREE.Group(); parent.add(g); const P = PORT_KINDS[o.plug] || PORT_KINDS.data;
  const plugG = new THREE.Group(); g.add(plugG); const dirv = new THREE.Vector3(...o.dir).normalize();
  const body = ctx.add(plugG, new THREE.Mesh(new RoundedBoxGeometry(P.w * 1.5, P.h * 1.9 + 0.006, o.plugLen, 3, 0.006), MAT.rubber(o.color, { roughness: 0.6 })), { cast: true, recv: true, name: 'cable.plug' });
  body.position.z = -o.plugLen / 2;
  const tip = ctx.add(plugG, new THREE.Mesh(new RoundedBoxGeometry(P.w * 0.96, P.h * 0.96, 0.03, 2, P.pill ? P.h * 0.45 : 0.002), metalEnv(ctx, MAT.anodised('#c9ccd2', { roughness: 0.22 }))), { cast: true }); tip.position.z = 0.012;
  plugG.lookAt(dirv); // the plug's +Z points along the insert axis (towards the socket)
  const tubeM = MAT.rubber(o.color, { roughness: 0.55, clearcoat: 0.2 });
  let tube = null;
  const api = { group: g, plug: plugG, probes: { plug: body },
    /* insert 0 = 1.5 plug lengths out, 1 = seated; the cable re-shapes to follow the plug (rebuilt only when insert changes) */
    set({ insert = 1 } = {}) {
      const k = clamp(insert), back = (1 - k) * o.plugLen * 1.5, end = new THREE.Vector3(...o.to).addScaledVector(dirv, -back);
      plugG.position.copy(end);
      const tail = end.clone().addScaledVector(dirv, -o.plugLen), a = new THREE.Vector3(...o.from), mid = a.clone().lerp(tail, 0.5); mid.y -= o.sag;
      const lead = tail.clone().addScaledVector(dirv, -0.12);
      const key = k.toFixed(4); if (tube && tube.userData.key === key) return api;
      const curve = new THREE.CatmullRomCurve3([a, mid, lead, tail], false, 'centripetal');
      const geo = new THREE.TubeGeometry(curve, 80, o.r, 12, false);
      if (tube) { tube.geometry.dispose(); tube.geometry = geo; } else tube = ctx.add(g, new THREE.Mesh(geo, tubeM), { cast: true, recv: true, name: 'cable' });
      tube.userData.key = key; return api;
    } };
  api.set({}); return api;
}

/* ---------- the assembled demo device ("node"): enclosure + internals, every explode part its own group ---------- */
export function makeNode(ctx, parent, spec = {}) {
  const E = makeEnclosure(ctx, parent, spec), L = E.layout, s = L.spec, parts = E.parts;
  for (const k of ['board', 'heatsink', 'card', 'fan']) { parts[k] = new THREE.Group(); E.lift.add(parts[k]); }
  let pcb = null, chip = null, sink = null, fan = null, card = null;
  if (s.internals) {
    pcb = makePCB(ctx, parts.board, { w: s.w - 2 * s.wall - 0.03, d: s.d - 2 * s.wall - 0.03, t: L.boardT, color: s.board.color, seed: 11, chips: 'node', soc: L.soc });
    pcb.group.position.y = L.boardY;
    chip = pcb.chip;
    sink = makeHeatsink(ctx, parts.heatsink, { w: L.heat.w, d: L.heat.d, h: L.heat.h, fins: 26 }); sink.group.position.set(L.heat.x, L.heat.y, L.heat.z);
    fan = makeFan(ctx, parts.fan, { r: L.fan.r, t: L.fan.t, blades: 9 }); fan.group.position.set(L.fan.x, L.fan.y, L.fan.z);
    card = makeGPUCard(ctx, parts.card, { w: L.card.w, d: L.card.d, t: L.card.t, fans: 2, bracket: false }); card.group.position.set(L.card.x, L.card.y, L.card.z);
  }
  const api = { ...E, pcb, chip, sink, fan, card, parts, layout: L,
    probes: { ...E.probes, ...(chip ? { die: chip.probes.die } : {}), ...(card ? { card: card.probes.card } : {}) },
    /* state: { band, bandSweep, explode: explodeAt() result or null, die: 0..1 (the chip lid lifts, the die lights), dieGlow, fanSpin (radians), cardSpin } */
    set(S = {}) {
      E.setBand(S.band ?? 1, S.bandHex ?? s.band.color, S.bandSweep ?? 1);
      for (const [id, g] of Object.entries(parts)) { const x = S.explode && S.explode[id]; g.position.set(x ? x.off[0] : 0, x ? x.off[1] : 0, x ? x.off[2] : 0); g.rotation.set(x ? x.rot[0] : 0, x ? x.rot[1] : 0, x ? x.rot[2] : 0); }
      if (chip) chip.set({ open: S.die ?? 0, glow: S.dieGlow ?? (S.die ?? 0), accent: S.accent });
      if (fan) fan.set({ spin: S.fanSpin ?? 0 });
      if (card) card.set({ spin: S.cardSpin ?? S.fanSpin ?? 0, glow: S.cardGlow ?? 0, accent: S.accent });
      return api;
    } };
  api.set({}); return api;
}
