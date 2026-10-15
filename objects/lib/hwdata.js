/* motion-pack/objects/lib/hwdata.js (xp-hardware, 2026-10-16): the generic hardware device as PURE data (no three.js), shared by the builder (lib/hardware.js) and
   by node (templates that place spec callouts and dimension lines on the parts). One spec in, one layout out: part placements, the default exploded-view
   choreography and the named ANCHORS (device-local points a callout points at), all in kit units (1 unit ~ 25 cm; origin = the base centre, +Y up, +Z front).
     const L = nodeLayout({ ...NODE_DEFAULT, w: 1.1 });   L.anchors.die -> [x, y, z];  L.explode -> explodePlan parts;  L.dims -> real-world mm for dimension lines
   The default device is a FICTIONAL generic box (the demo calls it "Acme Node"): a chamfered slab with a smoked-glass top inlay, a thin LED band round the
   base, vent slots on the sides and a row of generic ports on the back. It is drawn to look like no real product. Every number here is a design value. */
export const UNIT_MM = 250;                        // 1 kit unit = 250 mm (the objects kit convention: the laptop is 1.2 wide = 30 cm)
export const PORT_KINDS = {                        // generic port shapes (names are descriptive, never a trademark): width, height in kit units, the label a callout uses
  power: { w: 0.034, h: 0.034, round: true, label: 'Power' },
  net: { w: 0.052, h: 0.044, label: 'Network' },
  display: { w: 0.07, h: 0.026, trapezoid: true, label: 'Display out' },
  data: { w: 0.036, h: 0.014, pill: true, label: 'Data' },
  wide: { w: 0.052, h: 0.02, label: 'Data (wide)' },
  audio: { w: 0.016, h: 0.016, round: true, label: 'Audio' },
};
export const NODE_DEFAULT = {
  w: 1.0, h: 0.3, d: 0.8, chamfer: 0.018, r: 0.07, wall: 0.014,
  material: 'anodised', color: '#8e939b',           // 'anodised' | 'matteBlack' | 'glass' (the shell); colour is the design hex
  top: { kind: 'glass', inset: 0.045 },               // 'glass' (smoked inlay) | 'grille' (vent field) | 'solid'
  band: { on: true, y: 0.036, h: 0.009, color: '#5cc8ff' },
  vents: { side: true, rows: 3, cols: 18 },
  feet: true,
  ports: ['power', 'net', 'net', 'display', 'data', 'data', 'wide'],
  internals: true,
  board: { color: '#10261f' },
};
const num = (v, d, lo = -1e3, hi = 1e3) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);

export function nodeSpec(o = {}) {
  const D = NODE_DEFAULT, s = { ...D, ...o, top: { ...D.top, ...(o.top || {}) }, band: { ...D.band, ...(o.band || {}) }, vents: { ...D.vents, ...(o.vents || {}) }, board: { ...D.board, ...(o.board || {}) } };
  s.w = num(s.w, D.w, 0.2, 4); s.h = num(s.h, D.h, 0.08, 4); s.d = num(s.d, D.d, 0.2, 4);
  s.chamfer = num(s.chamfer, D.chamfer, 0, Math.min(s.w, s.h, s.d) * 0.2); s.r = num(s.r, D.r, 0.002, Math.min(s.w, s.d) * 0.45); s.wall = num(s.wall, D.wall, 0.004, 0.05);
  s.vents.rows = Math.round(num(s.vents.rows, 3, 0, 12)); s.vents.cols = Math.round(num(s.vents.cols, 18, 0, 60));
  s.ports = (Array.isArray(s.ports) ? s.ports : D.ports).filter((k) => PORT_KINDS[k]).slice(0, 14);
  return s;
}

export function nodeLayout(o = {}) {
  const s = nodeSpec(o), { w, h, d, wall } = s;
  const boardY = wall + 0.012, boardT = 0.008, top = boardY + boardT;
  const soc = { x: -0.2 * w, z: 0.04 * d, size: Math.min(0.16 * w, 0.2 * d), t: 0.012 };
  const heat = { x: soc.x, z: soc.z, w: 0.34 * w, d: 0.42 * d, h: Math.min(0.13, h * 0.42), y: top + soc.t + 0.004 };
  const card = { x: 0.24 * w, z: 0.0, w: 0.4 * w, d: 0.7 * d, t: Math.min(0.06, h * 0.2), y: top + 0.03 };
  const fan = { x: soc.x, z: soc.z, r: Math.min(0.17 * w, 0.21 * d), t: 0.028, y: Math.min(h - wall - 0.034, heat.y + heat.h + 0.02) };
  const portY = Math.max(wall + 0.03, Math.min(h * 0.45, h - 0.06)), span = Math.min(0.8 * w, s.ports.length * 0.1);
  const ports = s.ports.map((kind, i) => ({ kind, ...PORT_KINDS[kind], x: s.ports.length > 1 ? -span / 2 + (span * i) / (s.ports.length - 1) : 0, y: portY, z: -d / 2 }));
  const anchors = {
    band: [w / 2 - s.r * 0.3, s.band.y, d / 2 - s.r * 0.3], top: [0.18 * w, h, 0.12 * d], corner: [w / 2, h, d / 2], vent: [w / 2, h * 0.55, 0.1 * d],
    soc: [soc.x, top + soc.t, soc.z], die: [soc.x, top + soc.t + 0.002, soc.z], heatsink: [heat.x + heat.w * 0.3, heat.y + heat.h, heat.z], card: [card.x + card.w * 0.25, card.y + card.t, card.z + card.d * 0.2],
    fan: [fan.x, fan.y + fan.t, fan.z], board: [0.05 * w, top, -0.3 * d], memory: [soc.x + soc.size * 1.05, top + 0.006, soc.z],
    ...Object.fromEntries(ports.map((p, i) => ['port' + i, [p.x, p.y, p.z]])),
  };
  const foot = 0.006;                                // rubber feet: the device stands this high; every part (and anchor) sits on top of it
  for (const k of Object.keys(anchors)) anchors[k][1] += foot;
  /* the default exploded view: a vertical stack, the top first out; the sleeve and the base drop so the internals stand clear of the walls */
  const explode = [
    { id: 'top', dir: [0, 1, 0], dist: 1.1 * h / 0.3 * 0.9 + 0.08 }, { id: 'fan', dir: [0, 1, 0], dist: 0.78 * h / 0.3 * 0.9 + 0.06 }, { id: 'heatsink', dir: [0, 1, 0], dist: 0.5 * h / 0.3 * 0.9 + 0.04 },
    { id: 'card', dir: [0.25, 1, 0], dist: 0.3 * h / 0.3 * 0.9 + 0.04 }, { id: 'board', dir: [0, 1, 0], dist: 0.1 }, { id: 'shell', dir: [0, -1, 0], dist: 0.3 * h / 0.3 + 0.02 }, { id: 'base', dir: [0, -1, 0], dist: 0.55 * h / 0.3 + 0.04 },
  ];
  /* which part carries each anchor (the anchor moves with that part's explode offset) */
  const anchorPart = { band: 'shell', top: 'top', corner: 'shell', vent: 'shell', soc: 'board', die: 'board', heatsink: 'heatsink', card: 'card', fan: 'fan', board: 'board', memory: 'board', ...Object.fromEntries(ports.map((_, i) => ['port' + i, 'shell'])) };
  const mm = (u) => Math.round(u * UNIT_MM);
  return { spec: s, foot, boardY, boardT, soc, heat, card, fan, ports, anchors, anchorPart, explode, dims: { w_mm: mm(w), h_mm: mm(h), d_mm: mm(d) } };
}

/* an anchor in device-local coordinates with the explode offsets of its part applied (offs = explodeAt(...) result, or null) */
export function anchorAt(L, name, offs = null) {
  const a = L.anchors[name]; if (!a) return null; const o = offs && offs[L.anchorPart[name]]; return o ? [a[0] + o.off[0], a[1] + o.off[1], a[2] + o.off[2]] : a.slice();
}
