/* motion-pack/objects/characters/mascot2d.js (2026-10-14, round 3, owned): a FLAT 2D mascot rig. An original character: a warm bean-shaped body with a
   sprout on top, oval eyes, a mouth that smiles / opens / talks, stick arms with round hands, two small feet. No three.js, no DOM at module scope.
   Pure function of t: poses, path, scale and look change through closed-form springs (no simulation), blinks and hops are timed bumps.
     mascotState(t, spec)               -> the resolved rig state (numbers only)
     mascotParts(state)                 -> primitives (rrect / ellipse / line / circle / path / poly), local units: feet at (0, 0), body ~180 tall
     mascotSVG(t, spec, {W, H})         -> a full-frame <svg> string (HyperFrames DOM: mountMascot2d(el, spec) re-renders it on every seek)
     drawMascot2d(g, t, spec, {W, H})   -> the same primitives on a Canvas2D context (three.js plane texture: objects/lib/flat.js)
   spec = { keys: [[t, pose]...], path: [[t, [x, y]]...] px, scale: number | [[t, s]...], size: 1 (body ~180 px at 1080p), face: 1 | -1, blinks: [t],
            hops: [t] (0.45 s hops with anticipation squash, stretch in the air, landing squash), talk: [[t0, t1]...], aim: [x, y] px (the point pose aims at it),
            color, limb, ink, cheek, book }
   Poses (MASCOT_POSES): idle, point, read (holds a book), cheer (arms up, grin), dive (stretches and tilts forward, arms ahead), wave, think. */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
/* closed-form damped spring step (unit step response, zero value and slope at tau = 0) */
export function springStep(tau, zeta = 0.55, f = 2.4) {
  if (!(tau > 0)) return 0; const w = TAU * f;
  if (zeta >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
  const wd = w * Math.sqrt(1 - zeta * zeta); return 1 - Math.exp(-zeta * w * tau) * (Math.cos(wd * tau) + (zeta * w / wd) * Math.sin(wd * tau));
}
/* value at t of a keyed track [[t, v]...] (v number or array) driven by springs: v0 + sum (v_i - v_{i-1}) * step(t - t_i) */
export function track(t, keys, zeta, f) {
  if (!keys || !keys.length) return 0; const arr = Array.isArray(keys[0][1]); let v = arr ? [...keys[0][1]] : keys[0][1];
  for (let i = 1; i < keys.length; i++) { const k = springStep(t - keys[i][0], zeta, f); if (!k) continue; const a = keys[i - 1][1], b = keys[i][1]; if (arr) for (let j = 0; j < v.length; j++) v[j] += (b[j] - a[j]) * k; else v += (b - a) * k; }
  return v;
}
/* pose = arm angles (deg from straight down, + = outward / up), lean (deg, + = toward the facing side), look [-1..1, -1..1], smile -1..1, open 0..1, book 0..1, dive 0..1, brow -1..1 */
export const MASCOT_POSES = {
  idle: { armL: 14, armR: 14, lean: 0, look: [0, 0], smile: 0.5, open: 0, book: 0, dive: 0, brow: 0 },
  point: { armL: 18, armR: 96, lean: 7, look: [0.7, -0.1], smile: 0.75, open: 0.25, book: 0, dive: 0, brow: 0.3 },
  read: { armL: 52, armR: 52, lean: 0, look: [0, 0.75], smile: 0.3, open: 0, book: 1, dive: 0, brow: 0.2 },
  cheer: { armL: 158, armR: 158, lean: 0, look: [0, -0.35], smile: 1, open: 0.85, book: 0, dive: 0, brow: 0.6 },
  dive: { armL: 172, armR: 172, lean: 62, look: [0.8, 0.2], smile: 0.55, open: 0.55, book: 0, dive: 1, brow: 0.5 },
  wave: { armL: 16, armR: 150, lean: -3, look: [0.2, -0.1], smile: 0.9, open: 0.3, book: 0, dive: 0, brow: 0.4 },
  think: { armL: 14, armR: 125, lean: -4, look: [-0.5, -0.6], smile: -0.1, open: 0, book: 0, dive: 0, brow: -0.4 },
};
const FIELDS = ['armL', 'armR', 'lean', 'look', 'smile', 'open', 'book', 'dive', 'brow'];
const poseOf = (p) => (typeof p === 'string' ? MASCOT_POSES[p] || MASCOT_POSES.idle : { ...MASCOT_POSES.idle, ...p });
export const MASCOT_DEFAULTS = { keys: [[0, 'idle']], path: [[0, [960, 900]]], scale: 1, size: 1, face: 1, blinks: [], hops: [], talk: [], aim: null,
  color: '#FFB547', limb: '#D9782C', ink: '#1E1B26', cheek: '#FF7A7A', book: '#4A18ED', sprout: '#2FA866' };
/* hop: 0.45 s; anticipation squash 0.12 s before, height `h` (local units), landing squash 0.2 s after (closed form) */
function hopAt(t, hops, h = 60, d = 0.45) {
  let y = 0, sy = 1;
  for (const t0 of hops || []) { const u = (t - t0) / d;
    if (u > -0.27 && u < 0) sy *= 1 - 0.14 * Math.sin(Math.PI * (u + 0.27) / 0.27);                 // anticipation squash
    else if (u >= 0 && u <= 1) { y -= h * 4 * u * (1 - u); sy *= 1 + 0.14 * Math.abs(1 - 2 * u) * Math.sin(Math.PI * Math.min(1, u * 6)) ; }   // stretch while fast
    else if (u > 1 && u < 1.45) sy *= 1 - 0.16 * Math.exp(-(u - 1) * 7) * Math.sin(Math.PI * (u - 1) / 0.45); }   // landing squash
  return { y, sy };
}
export function mascotState(t, specIn = {}) {
  const s = { ...MASCOT_DEFAULTS, ...specIn }, keys = s.keys.map(([tk, p]) => [tk, poseOf(p)]);
  const P = {}; for (const f of FIELDS) P[f] = track(t, keys.map(([tk, p]) => [tk, p[f]]), f === 'armL' || f === 'armR' ? 0.42 : 0.6, f === 'armL' || f === 'armR' ? 2.6 : 2.0);
  const pos = track(t, s.path, 0.85, 1.4), sc = typeof s.scale === 'number' ? s.scale : track(t, s.scale, 0.8, 1.6), hop = hopAt(t, s.hops);
  let eye = 1; for (const b of s.blinks || []) { const u = (t - b) / 0.14; if (u > 0 && u < 1) eye = Math.min(eye, Math.abs(1 - 2 * u) ** 1.5); }
  let talk = 0; for (const [a, b] of s.talk || []) if (t >= a && t <= b) talk = Math.max(talk, 0.5 + 0.5 * Math.sin(TAU * 4.3 * (t - a)) * Math.sin(TAU * 1.7 * (t - a) + 0.6)) * seg(t, a, a + 0.08) * (1 - seg(t, b - 0.08, b));
  if (s.aim && P.armR > 60) { const k = clamp((P.armR - 60) / 36), sh = [pos[0] + s.face * 70 * s.size * sc, pos[1] - 100 * s.size * sc], dx = (s.aim[0] - sh[0]) * s.face, dy = s.aim[1] - sh[1], a = Math.atan2(dx, dy) * 180 / Math.PI; P.armR = lerp(P.armR, clamp(a, 20, 175), k); }
  const dv = clamp(P.dive), sy = hop.sy * (1 + 0.22 * dv), sx = 1 / Math.sqrt(hop.sy) * (1 - 0.12 * dv);
  return { ...P, x: pos[0], y: pos[1], hopY: hop.y, scale: sc * s.size, sx, sy, eye, talk, face: s.face, colors: { body: s.color, limb: s.limb, ink: s.ink, cheek: s.cheek, book: s.book, sprout: s.sprout } };
}
/* geometry in local units (feet at 0, 0; y down; facing +x when face = 1). Every primitive: { k, ...fields, fill?, stroke?, w?, a? } */
export function mascotParts(st) {
  const C = st.colors, out = [], arm = (side, deg) => { const a = deg * Math.PI / 180, sx = side * 70, sy = -102, L = 62, hx = sx + side * L * Math.sin(a), hy = sy + L * Math.cos(a);
    out.push({ k: 'line', x1: sx, y1: sy, x2: hx, y2: hy, stroke: C.limb, w: 12 }); out.push({ k: 'circle', cx: hx, cy: hy, r: 11, fill: C.limb }); };
  const lx = st.look[0] * 7, ly = st.look[1] * 6;
  out.push({ k: 'ellipse', cx: -28, cy: -2, rx: 22, ry: 9, fill: C.limb }); out.push({ k: 'ellipse', cx: 28, cy: -2, rx: 22, ry: 9, fill: C.limb });
  if (st.book < 0.5) { arm(-1, st.armL); arm(1, st.armR); }
  out.push({ k: 'path', d: 'M0 -190 C -6 -206 -4 -218 6 -230', stroke: C.sprout, w: 6, fill: 'none' });
  out.push({ k: 'path', d: 'M6 -230 C 26 -246 44 -236 40 -224 C 30 -214 14 -218 6 -230 Z', fill: C.sprout });
  out.push({ k: 'rrect', x: -76, y: -196, w: 152, h: 192, r: 74, fill: C.body });
  out.push({ k: 'rrect', x: -58, y: -180, w: 46, h: 70, r: 23, fill: '#FFFFFF', a: 0.22 });   // soft highlight
  out.push({ k: 'ellipse', cx: -46, cy: -96, rx: 13, ry: 8, fill: C.cheek, a: 0.55 }); out.push({ k: 'ellipse', cx: 46, cy: -96, rx: 13, ry: 8, fill: C.cheek, a: 0.55 });
  const ey = Math.max(0.08, st.eye);
  for (const ex of [-27, 27]) { out.push({ k: 'ellipse', cx: ex + lx, cy: -124 + ly, rx: 11, ry: 15 * ey, fill: C.ink }); if (ey > 0.5) out.push({ k: 'circle', cx: ex + lx + 3.5, cy: -129 + ly, r: 3.6, fill: '#FFFFFF' }); }
  for (const [ex, sgn] of [[-27, -1], [27, 1]]) { const b = st.brow, xi = ex - sgn * 11, xo = ex + sgn * 11; out.push({ k: 'line', x1: xo, y1: -150 - 2 * b, x2: xi, y2: -150 - 4 * b + (b < 0 ? 3 * b : 0), stroke: C.ink, w: 4 }); }
  const open = clamp(Math.max(st.open, st.talk)), sm = st.smile, mw = 16 + 6 * sm, my = -90 + ly * 0.5;
  if (open > 0.06) out.push({ k: 'path', d: `M${-mw + lx} ${my} Q ${lx} ${my + 6 + 6 * sm} ${mw + lx} ${my} Q ${lx} ${my + 6 + 22 * open} ${-mw + lx} ${my} Z`, fill: C.ink });
  else out.push({ k: 'path', d: `M${-mw + lx} ${my} Q ${lx} ${my + 12 * sm} ${mw + lx} ${my}`, stroke: C.ink, w: 4.5, fill: 'none' });
  if (st.book >= 0.5) { const bk = clamp((st.book - 0.5) * 2);
    out.push({ k: 'poly', pts: [[-58, -70], [0, -62], [0, -14], [-58, -22]], fill: C.book, a: bk }); out.push({ k: 'poly', pts: [[58, -70], [0, -62], [0, -14], [58, -22]], fill: C.book, a: bk });
    out.push({ k: 'poly', pts: [[-52, -66], [-4, -59], [-4, -20], [-52, -27]], fill: '#FFFFFF', a: 0.9 * bk }); out.push({ k: 'poly', pts: [[52, -66], [4, -59], [4, -20], [52, -27]], fill: '#FFFFFF', a: 0.9 * bk });
    for (const s of [-1, 1]) { out.push({ k: 'line', x1: s * 70, y1: -102, x2: s * 52, y2: -46, stroke: C.limb, w: 12 }); out.push({ k: 'circle', cx: s * 54, cy: -44, r: 11, fill: C.limb }); } }
  return out;
}
/* SVG transform of the rig: path position, hop, scale, squash about the feet, lean about the body centre, facing flip */
const rigTransform = (st, k) => `translate(${(st.x).toFixed(2)} ${(st.y + st.hopY * st.scale * k).toFixed(2)}) scale(${(st.scale * k * st.face * st.sx).toFixed(5)} ${(st.scale * k * st.sy).toFixed(5)}) rotate(${(st.lean).toFixed(3)} 0 -100)`;
const attrs = (p) => `${p.fill ? ` fill="${p.fill}"` : ''}${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"` : ''}${p.a != null ? ` opacity="${(+p.a).toFixed(3)}"` : ''}`;
export function partsSVG(parts) {
  return parts.map((p) => p.k === 'line' ? `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2.toFixed(2)}" y2="${p.y2.toFixed(2)}"${attrs(p)}/>` : p.k === 'circle' ? `<circle cx="${p.cx.toFixed(2)}" cy="${p.cy.toFixed(2)}" r="${p.r}"${attrs(p)}/>`
    : p.k === 'ellipse' ? `<ellipse cx="${p.cx.toFixed(2)}" cy="${p.cy.toFixed(2)}" rx="${p.rx}" ry="${(+p.ry).toFixed(2)}"${attrs(p)}/>` : p.k === 'rrect' ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r}"${attrs({ ...p, w: undefined })}/>`
    : p.k === 'poly' ? `<polygon points="${p.pts.map((q) => q.join(',')).join(' ')}"${attrs(p)}/>` : `<path d="${p.d}"${attrs(p)}/>`).join('');
}
/* full-frame SVG (W x H viewBox); k = H / 1080 so `size` and the path stay in 1080p units */
export function mascotSVG(t, spec = {}, { W = 1920, H = 1080 } = {}) {
  const st = mascotState(t, spec), k = H / 1080, s2 = { ...st, x: st.x * k, y: st.y * k };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;overflow:visible"><g transform="${rigTransform(s2, k)}">${partsSVG(mascotParts(st))}</g></svg>`;
}
export function drawMascot2d(g, t, spec = {}, { W = 1920, H = 1080 } = {}) {
  const st = mascotState(t, spec), k = H / 1080; g.save();
  g.translate(st.x * k, (st.y + st.hopY * st.scale) * k); g.scale(st.scale * k * st.face * st.sx, st.scale * k * st.sy); g.translate(0, -100); g.rotate(st.lean * Math.PI / 180); g.translate(0, 100);
  for (const p of mascotParts(st)) { g.globalAlpha = p.a ?? 1; g.beginPath();
    if (p.k === 'line') { g.moveTo(p.x1, p.y1); g.lineTo(p.x2, p.y2); } else if (p.k === 'circle') g.arc(p.cx, p.cy, p.r, 0, TAU); else if (p.k === 'ellipse') g.ellipse(p.cx, p.cy, p.rx, Math.max(0.01, p.ry), 0, 0, TAU);
    else if (p.k === 'rrect') g.roundRect(p.x, p.y, p.w, p.h, p.r); else if (p.k === 'poly') { p.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); }
    else { const pa = new Path2D(p.d); if (p.fill && p.fill !== 'none') { g.fillStyle = p.fill; g.fill(pa); } if (p.stroke) { g.strokeStyle = p.stroke; g.lineWidth = p.w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(pa); } continue; }
    if (p.fill && p.fill !== 'none') { g.fillStyle = p.fill; g.fill(); } if (p.stroke) { g.strokeStyle = p.stroke; g.lineWidth = p.w; g.lineCap = 'round'; g.stroke(); } }
  g.restore(); g.globalAlpha = 1;
}
/* HyperFrames DOM: el (absolutely positioned, full frame) gets the SVG for t; call render(t) from hf-seek */
export function mountMascot2d(el, spec = {}, { W = 1920, H = 1080 } = {}) { return { el, render(t) { el.innerHTML = mascotSVG(t, spec, { W, H }); return this; } }; }
