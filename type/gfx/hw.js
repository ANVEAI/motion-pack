/* motion-pack / type / gfx / hw.js (xp-hardware, 2026-10-16): overlay parts for AI-hardware and device launch films. Same gfx contract as every part (core.js):
   { tags, dur, inF, outF, d, svg(L, p, c) } -> SVG markup, a pure function of t (seek-safe: no module state, no caches).
     hw.specCallout   a spec callout on a 3D part: a dot on the anchor, a leader line that draws out to an elbow, the label and a value that COUNTS UP, the unit,
                      and the value's source under the line. The anchor can follow the part: `track` [[t, x, y], ...] in COMPOSITION seconds (frame fractions),
                      e.g. the per-frame projection of a 3D anchor (objects/kit/project.js), so the line stays on the part while the camera moves.
     hw.dimensionLine a measured dimension between two points (or two tracks): extension lines, the dimension line drawing out from the middle, arrowheads, the value
                      chip ("250 mm"); for the scale-reference shot.
     hw.chipDie       the "inside" beat in 2D: a package outline, the die, its blocks wiping in one by one under a scan light, then the block labels on leaders.
                      The pattern is decorative and generic (the frame says so: `note`); block names are placeholders unless you pass your own.
     hw.edgeGlint     a lens glint tuned for product edges: a tight hot core that travels along an edge segment (a projected chamfer), a short highlight line
                      on the edge itself, a thin anamorphic streak and two faint ghosts; screen-blended so it only ever adds light.
     hw.dateCard      the availability card: a kicker, the date, a rule, an optional price that counts up, and a note that says the price is indicative or a
                      placeholder (a price always prints its note and its source).
     hw.specCard      the spec sheet card: rows of label + value + unit that land one by one (each value counts up), a hairline between rows, the source line.
   HONESTY (type/tests/honesty-defaults.test.mjs): every part that prints a number has a `source` param defaulting to 'placeholder data' and prints it
   ("source: placeholder data") until a real source is given; the default copy is generic ("Memory", "Spring 2027") and the defaults say demo.
   Guards: every numeric param is clamped (num), lists are capped, colours are #hex only, text is capped at 80-120 characters (no param can hang a render). */
import { E, clamp, lerp, seg, FONT, MONO, f2, text, esc, measure } from './core.js';

const RED = '#E5484D';
const num = (v, d, lo = -1e9, hi = 1e9) => { const x = v == null || v === '' || typeof v === 'boolean' ? NaN : +v; return Number.isFinite(x) ? clamp(x, lo, hi) : d; };
const str = (v, d = '', max = 80) => (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : d);
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const hex = (v, d) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : d);
const sc = (c) => (c.H > c.W ? c.W / 1080 : c.s);           // type scale from the shorter side (9:16 keeps phone-readable sizes)
const SRC0 = 'placeholder data';
const srcLine = (p) => 'source: ' + (str(p.source, '', 100).trim() || SRC0);
/* 1234.5 -> "1,234.5" (fixed grouping, never toLocaleString: the same string in every locale and process) */
export function fmtNum(v, dec = 0) { const d = Math.round(num(dec, 0, 0, 6)), x = num(v, 0, -1e15, 1e15), s = Math.abs(x).toFixed(d), [i, f] = s.split('.'); return (x < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); }
/* a point: [x, y] frame fractions, or a track [[t, x, y], ...] in composition seconds (linear between keys, held at the ends) */
export function pointAt(a, t, d = [0.5, 0.5]) {
  if (!Array.isArray(a) || !a.length) return d.slice();
  if (!Array.isArray(a[0])) return [num(a[0], d[0], -2, 3), num(a[1], d[1], -2, 3)];
  const k = list(a, 4096).filter((q) => Array.isArray(q) && q.length >= 3 && q.every((x) => Number.isFinite(+x))); if (!k.length) return d.slice();
  if (t <= k[0][0]) return [+k[0][1], +k[0][2]]; for (let i = 1; i < k.length; i++) if (t < k[i][0]) { const u = seg(t, +k[i - 1][0], +k[i][0]); return [lerp(+k[i - 1][1], +k[i][1], u), lerp(+k[i - 1][2], +k[i][2], u)]; }
  return [+k.at(-1)[1], +k.at(-1)[2]];
}
const tnum = 'font-variant-numeric="tabular-nums"';

/* ================================================================ hw.specCallout ================================================================ */
const CALLOUT_D = { anchor: [0.56, 0.52], track: null, off: [150, -120], run: null, label: 'Memory', value: 128, from: 0, dec: 0, prefix: '', unit: 'GB', source: SRC0,
  draw: 0.45, count: 1.1, accent: '#5CC8FF', ink: '#F4F6FA', muted: '#9AA3B2', size: 1, side: 'auto', dot: true };
function calloutGeo(p, c, t) {
  const s = sc(c) * num(p.size, 1, 0.3, 4), [ax, ay] = pointAt(p.track ?? p.anchor, t, CALLOUT_D.anchor), x0 = ax * c.W, y0 = ay * c.H;
  const vSize = 66 * s, lSize = 28 * s, uSize = 34 * s, val = str(p.prefix, '', 6) + fmtNum(p.value, p.dec), lw = Math.max(measure(str(p.label, '', 40), lSize, { weight: 700 }), measure(val, vSize, { weight: 800 }) + measure(' ' + str(p.unit, '', 10), uSize, { weight: 700 }));
  const lab = !(p.value != null && p.value !== '' && Number.isFinite(+p.value)) ? measure(str(p.label, '', 40), 38 * s, { weight: 700 }) : null;
  let dx = num(p.off?.[0], 150, -900, 900) * s, dy = num(p.off?.[1], -120, -900, 900) * s; const run = (p.run == null ? (lab ?? lw) + 24 * s : num(p.run, 200, 20, 1600) * s);
  const S = c.safe, right = p.side === 'left' ? false : p.side === 'right' ? true : !(x0 + Math.abs(dx) + run > S.x1 && x0 - Math.abs(dx) - run > S.x0);
  dx = right ? Math.abs(dx) : -Math.abs(dx);
  const ex = x0 + dx, ey = clamp(y0 + dy, S.y0 + vSize + lSize + 10 * s, S.y1 - 40 * s), rx = ex + (right ? run : -run);
  return { s, x0, y0, ex, ey, rx, right, vSize, lSize, uSize, val };
}
const CALLOUT = { tags: ['hardware', 'spec', 'callout', 'leader', 'count-up', 'number', 'product'], dur: 2.6, inF: 6, outF: 9, d: CALLOUT_D,
  svg(L, p, c) {
    const g = calloutGeo(p, c, L.t ?? L.u), { s, x0, y0, ex, ey, rx, right } = g, acc = hex(p.accent, CALLOUT_D.accent), ink = hex(p.ink, CALLOUT_D.ink), mut = hex(p.muted, CALLOUT_D.muted);
    const drawS = num(p.draw, 0.45, 0.05, 5), cnt = num(p.count, 1.1, 0, 10), u = L.u, o = 1 - E.exit(L.out);
    const k1 = E.move(seg(u, 0.05, 0.05 + drawS * 0.5)), k2 = E.move(seg(u, 0.05 + drawS * 0.45, 0.05 + drawS)), dotK = E.pop(seg(u, 0, 0.22));
    const mx = lerp(x0, ex, k1), my = lerp(y0, ey, k1), hx = lerp(ex, rx, k2), lx = right ? ex + 6 * s : ex - 6 * s, anc = right ? 'start' : 'end';
    const v = lerp(num(p.from, 0), num(p.value, 0), E.expoOut(seg(u, drawS * 0.7, drawS * 0.7 + Math.max(0.01, cnt)))), vStr = str(p.prefix, '', 6) + fmtNum(v, p.dec);
    const tk = E.enter(seg(u, drawS * 0.6, drawS * 0.6 + 0.35)), ty = (1 - tk) * 18 * s;
    let out = `<g opacity="${f2(o)}">`;
    if (p.dot !== false) out += `<circle cx="${f2(x0)}" cy="${f2(y0)}" r="${f2(15 * s * dotK)}" fill="none" stroke="${acc}" stroke-width="${f2(2.5 * s)}" opacity="${f2(0.6 * dotK)}"/><circle cx="${f2(x0)}" cy="${f2(y0)}" r="${f2(5.5 * s * dotK)}" fill="${acc}"/>`;
    out += `<polyline points="${f2(x0)},${f2(y0)} ${f2(mx)},${f2(my)}${k1 >= 1 ? ` ${f2(hx)},${f2(ey)}` : ''}" fill="none" stroke="${acc}" stroke-width="${f2(2.6 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const hasV = p.value != null && p.value !== '' && Number.isFinite(+p.value);
    if (tk > 0 && !hasV) {   // a label-only callout (a port name, a part name): one line, no number, so no source line
      out += `<g opacity="${f2(tk)}">` + text(str(p.label, '', 40), lx, ey - 14 * s + ty, { size: 38 * s * num(p.size, 1, 0.3, 4), weight: 700, fill: ink, anchor: anc }) + '</g>';
    } else if (tk > 0) {
      const ux = lx + (right ? 1 : -1) * 0, vy = ey - 14 * s + ty;
      out += `<g opacity="${f2(tk)}">` + text(str(p.label, '', 40).toUpperCase(), lx, vy - g.vSize - 6 * s, { size: g.lSize, weight: 700, fill: mut, anchor: anc, ls: 2.2 * s });
      const unit = str(p.unit, '', 10), vw = measure(vStr, g.vSize, { weight: 800 }), uw = unit ? measure(' ' + unit, g.uSize, { weight: 700 }) : 0;
      if (right) out += text(vStr, ux, vy, { size: g.vSize, weight: 800, fill: ink, anchor: 'start', extra: tnum }) + (unit ? text(unit, ux + vw + 10 * s, vy, { size: g.uSize, weight: 700, fill: acc, anchor: 'start' }) : '');
      else out += text(vStr, ux - uw - (unit ? 10 * s : 0), vy, { size: g.vSize, weight: 800, fill: ink, anchor: 'end', extra: tnum }) + (unit ? text(unit, ux, vy, { size: g.uSize, weight: 700, fill: acc, anchor: 'end' }) : '');
      out += text(srcLine(p), lx, ey + 34 * s, { size: 22 * s, weight: 600, fill: mut, anchor: anc, op: 0.95 }) + '</g>';
    }
    return out + '</g>';
  } };

/* ================================================================ hw.dimensionLine ================================================================ */
const DIM_D = { a: [0.36, 0.7], b: [0.64, 0.7], off: 60, ext: 18, value: 250, dec: 0, unit: 'mm', label: null, source: SRC0, accent: '#5CC8FF', ink: '#F4F6FA', muted: '#9AA3B2', draw: 0.6, size: 1 };
const DIM = { tags: ['hardware', 'dimension', 'measure', 'scale', 'size', 'number'], dur: 2.4, inF: 6, outF: 9, d: DIM_D,
  svg(L, p, c) {
    const s = sc(c) * num(p.size, 1, 0.3, 4), t = L.t ?? L.u, A = pointAt(p.a, t, DIM_D.a), B = pointAt(p.b, t, DIM_D.b), ax = A[0] * c.W, ay = A[1] * c.H, bx = B[0] * c.W, by = B[1] * c.H;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = uy, ny = -ux, off = num(p.off, 60, -800, 800) * s, ext = num(p.ext, 18, 0, 200) * s;
    const acc = hex(p.accent, DIM_D.accent), ink = hex(p.ink, DIM_D.ink), mut = hex(p.muted, DIM_D.muted), o = 1 - E.exit(L.out), dr = num(p.draw, 0.6, 0.05, 5);
    const ke = E.move(seg(L.u, 0, dr * 0.4)), kd = E.move(seg(L.u, dr * 0.3, dr)), kl = E.enter(seg(L.u, dr * 0.8, dr * 0.8 + 0.3));
    const pA = [ax + nx * off, ay + ny * off], pB = [bx + nx * off, by + ny * off], mid = [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2], h = len / 2 * kd;
    const q0 = [mid[0] - ux * h, mid[1] - uy * h], q1 = [mid[0] + ux * h, mid[1] + uy * h], sw = 2.4 * s, ah = 14 * s;
    const extL = (P, Q) => { const e = [P[0] + nx * (off + Math.sign(off || 1) * ext) * ke, P[1] + ny * (off + Math.sign(off || 1) * ext) * ke]; return `<line x1="${f2(P[0] + nx * 8 * s * Math.sign(off || 1))}" y1="${f2(P[1] + ny * 8 * s * Math.sign(off || 1))}" x2="${f2(e[0])}" y2="${f2(e[1])}" stroke="${mut}" stroke-width="${f2(1.6 * s)}" opacity="${f2(0.85 * ke)}"/>`; };
    const arrow = (P, sgn) => `<polyline points="${f2(P[0] + (ux * sgn * ah) + nx * ah * 0.55)},${f2(P[1] + (uy * sgn * ah) + ny * ah * 0.55)} ${f2(P[0])},${f2(P[1])} ${f2(P[0] + (ux * sgn * ah) - nx * ah * 0.55)},${f2(P[1] + (uy * sgn * ah) - ny * ah * 0.55)}" fill="none" stroke="${acc}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let out = `<g opacity="${f2(o)}">` + extL([ax, ay]) + extL([bx, by]);
    if (kd > 0) out += `<line x1="${f2(q0[0])}" y1="${f2(q0[1])}" x2="${f2(q1[0])}" y2="${f2(q1[1])}" stroke="${acc}" stroke-width="${f2(sw)}" stroke-linecap="round"/>` + (kd > 0.98 ? arrow(pA, 1) + arrow(pB, -1) : '');
    if (kl > 0) { const lab = p.label != null ? str(p.label, '', 30) : fmtNum(p.value, p.dec) + ' ' + str(p.unit, '', 8), fs = 34 * s, w = measure(lab, fs, { weight: 800, font: MONO }) + 30 * s, hgt = fs * 1.5, cx = mid[0] + nx * hgt * 0.9 * Math.sign(off || 1), cy = mid[1] + ny * hgt * 0.9 * Math.sign(off || 1);
      out += `<g opacity="${f2(kl)}"><rect x="${f2(cx - w / 2)}" y="${f2(cy - hgt / 2)}" width="${f2(w)}" height="${f2(hgt)}" rx="${f2(hgt / 2)}" fill="#0B0D11" fill-opacity="0.78" stroke="${acc}" stroke-width="${f2(1.6 * s)}"/>` +
        text(lab, cx, cy + fs * 0.36, { size: fs, weight: 700, fill: ink, anchor: 'middle', font: MONO, extra: tnum }) + text(srcLine(p), cx, cy + hgt / 2 + 28 * s, { size: 22 * s, weight: 600, fill: mut, anchor: 'middle' }) + '</g>'; }
    return out + '</g>';
  } };

/* ================================================================ hw.chipDie ================================================================ */
/* the generic die blocks (fractions of the die): the SAME table as objects/lib/hwboard.js dieLayout (8 cores); type/tests/hw.test.mjs checks they agree */
export function dieBlocks(cores = 8) {
  const n = Math.max(1, Math.min(32, Math.round(num(cores, 8, 1, 32)))), cols = Math.min(n, 4), rows = Math.ceil(n / cols), cw = 0.42 / cols, chh = 0.4 / rows, B = [];
  for (let i = 0; i < n; i++) B.push({ id: 'core' + i, kind: 'core', x: 0.07 + (i % cols) * cw, y: 0.08 + Math.floor(i / cols) * chh, w: cw * 0.92, h: chh * 0.9 });
  B.push({ id: 'matrix', kind: 'matrix', x: 0.53, y: 0.08, w: 0.4, h: 0.5 }, { id: 'cache', kind: 'cache', x: 0.07, y: 0.52, w: 0.42, h: 0.18 }, { id: 'media', kind: 'misc', x: 0.53, y: 0.62, w: 0.19, h: 0.3 }, { id: 'io', kind: 'misc', x: 0.74, y: 0.62, w: 0.19, h: 0.3 }, { id: 'mem', kind: 'mem', x: 0.07, y: 0.74, w: 0.42, h: 0.18 });
  return B;
}
const DIE_D = { box: [0.3, 0.16, 0.4, 0.68], cores: 8, labels: [{ block: 'cores', text: 'CPU cores' }, { block: 'matrix', text: 'Neural engine' }, { block: 'cache', text: 'Shared cache' }, { block: 'mem', text: 'Memory interface' }],
  note: 'die pattern: render, not a real floorplan', accent: '#5CC8FF', ink: '#F4F6FA', muted: '#9AA3B2', stagger: 0.07, scan: true };
const FILL = { core: '#2B3350', matrix: '#1E3D46', cache: '#3D3526', mem: '#33293F', misc: '#2A3038' };
const DIE = { tags: ['hardware', 'chip', 'die', 'silicon', 'inside', 'reveal', 'macro'], dur: 4.2, inF: 9, outF: 9, d: DIE_D,
  svg(L, p, c) {
    const s = sc(c), b = Array.isArray(p.box) && p.box.length >= 4 ? p.box.map((v, i) => num(v, DIE_D.box[i], -1, 2)) : DIE_D.box, bw = b[2] * c.W, bh = b[3] * c.H, side = Math.max(40, Math.min(bw, bh));
    const x = b[0] * c.W + (bw - side) / 2, y = b[1] * c.H + (bh - side) / 2, acc = hex(p.accent, DIE_D.accent), ink = hex(p.ink, DIE_D.ink), mut = hex(p.muted, DIE_D.muted), u = L.u, o = 1 - E.exit(L.out);
    const B = dieBlocks(p.cores), stag = num(p.stagger, 0.07, 0, 1), pk = E.move(seg(u, 0, 0.5)), pad = side * 0.12, dx = x + pad, dy = y + pad, ds = side - 2 * pad;
    let out = `<g opacity="${f2(o)}">`;
    // package + die outline draw on
    const per = 4 * side; out += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(side)}" height="${f2(side)}" rx="${f2(side * 0.04)}" fill="#0E1116" fill-opacity="${f2(0.75 * pk)}" stroke="${mut}" stroke-width="${f2(2 * s)}" stroke-dasharray="${f2(per)} ${f2(per + 1)}" stroke-dashoffset="${f2(per * (1 - pk))}"/>`;
    const dk = E.enter(seg(u, 0.35, 0.75)); out += `<rect x="${f2(dx)}" y="${f2(dy)}" width="${f2(ds)}" height="${f2(ds)}" fill="#151A26" opacity="${f2(dk)}" stroke="${acc}" stroke-width="${f2(1.6 * s)}" stroke-opacity="0.6"/>`;
    for (let i = 0; i < 48 && dk > 0; i++) { const tt = (i + 0.5) / 48; for (const [px, py] of [[tt, 0.02], [tt, 0.98], [0.02, tt], [0.98, tt]]) out += `<rect x="${f2(dx + px * ds - 2 * s)}" y="${f2(dy + py * ds - 2 * s)}" width="${f2(4 * s)}" height="${f2(4 * s)}" fill="#8A7440" opacity="${f2(dk * 0.7)}"/>`; }
    B.forEach((bl, i) => { const k = E.enter(seg(u, 0.7 + i * stag, 0.7 + i * stag + 0.35)); if (k <= 0) return; const X = dx + bl.x * ds, Y = dy + bl.y * ds, W = bl.w * ds, H = bl.h * ds;
      out += `<rect x="${f2(X)}" y="${f2(Y + H * (1 - k))}" width="${f2(W)}" height="${f2(H * k)}" fill="${FILL[bl.kind] || FILL.misc}" stroke="${acc}" stroke-opacity="${f2(0.35 * k)}" stroke-width="${f2(1.2 * s)}"/>`;
      if (bl.kind === 'matrix' && k > 0.5) for (let g = 1; g < 12; g++) out += `<line x1="${f2(X + (W * g) / 12)}" y1="${f2(Y)}" x2="${f2(X + (W * g) / 12)}" y2="${f2(Y + H)}" stroke="${acc}" stroke-opacity="0.18" stroke-width="${f2(s)}"/><line x1="${f2(X)}" y1="${f2(Y + (H * g) / 12)}" x2="${f2(X + W)}" y2="${f2(Y + (H * g) / 12)}" stroke="${acc}" stroke-opacity="0.18" stroke-width="${f2(s)}"/>`; });
    // the scan light: a soft bright band crossing the die once the blocks are in
    const t0 = 0.7 + B.length * stag, sk = seg(u, t0, t0 + 1.0);
    if (p.scan !== false && sk > 0 && sk < 1) { const sx = dx + ds * E.move(sk); out += `<rect x="${f2(sx - 18 * s)}" y="${f2(dy)}" width="${f2(36 * s)}" height="${f2(ds)}" fill="${acc}" opacity="${f2(0.28 * Math.sin(Math.PI * sk))}"/><line x1="${f2(sx)}" y1="${f2(dy)}" x2="${f2(sx)}" y2="${f2(dy + ds)}" stroke="#FFFFFF" stroke-width="${f2(2 * s)}" opacity="${f2(0.8 * Math.sin(Math.PI * sk))}"/>`; }
    // labels on leaders, left column for blocks left of centre, right column otherwise
    const labs = list(p.labels, 8).filter((q) => q && typeof q === 'object'); labs.forEach((lb, i) => { const bl = B.find((q) => q.id === lb.block || (lb.block === 'cores' && q.kind === 'core')) || B[0], k = E.enter(seg(u, t0 + 0.4 + i * 0.25, t0 + 0.75 + i * 0.25)); if (k <= 0) return;
      const cx = dx + (bl.x + bl.w / 2) * ds, cy = dy + (bl.y + bl.h / 2) * ds, left = bl.x + bl.w / 2 < 0.5, lx = left ? x - 30 * s : x + side + 30 * s, fs = 30 * s;
      out += `<g opacity="${f2(k)}"><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(5 * s)}" fill="${acc}"/><polyline points="${f2(cx)},${f2(cy)} ${f2(left ? x + 10 * s : x + side - 10 * s)},${f2(cy)} ${f2(lx)},${f2(cy)}" fill="none" stroke="${acc}" stroke-width="${f2(2 * s)}"/>` +
        text(str(lb.text, '', 40), lx + (left ? -12 : 12) * s, cy + fs * 0.35, { size: fs, weight: 700, fill: ink, anchor: left ? 'end' : 'start' }) + '</g>'; });
    const nk = E.enter(seg(u, 0.5, 0.9)); if (str(p.note, '', 80)) out += text(str(p.note, '', 80), x + side / 2, y + side + 44 * s, { size: 24 * s, weight: 600, fill: mut, anchor: 'middle', op: nk });
    return out + '</g>';
  } };

/* ================================================================ hw.edgeGlint ================================================================ */
const GLINT_D = { a: [0.38, 0.42], b: [0.66, 0.4], from: 0.0, to: 1.0, sweep: 1.2, color: '#DDEBFF', core: 1, streak: 0.22, line: 0.12, ghosts: true, intensity: 1 };
const GLINT = { tags: ['hardware', 'flare', 'glint', 'edge', 'lens', 'streak', 'product'], dur: 1.6, inF: 3, outF: 6, d: GLINT_D,
  svg(L, p, c) {
    const t = L.t ?? L.u, A = pointAt(p.a, t, GLINT_D.a), B = pointAt(p.b, t, GLINT_D.b), sw = num(p.sweep, 1.2, 0.1, 20), k = seg(L.u, 0, sw), e = E.move(k), env = Math.sin(Math.PI * clamp(k)) ** 0.8 * num(p.intensity, 1, 0, 3) * (1 - L.out);
    if (env <= 0.002) return '';
    const f = lerp(num(p.from, 0, -1, 2), num(p.to, 1, -1, 2), e), px = lerp(A[0], B[0], f) * c.W, py = lerp(A[1], B[1], f) * c.H, s = c.s, col = hex(p.color, GLINT_D.color);
    const ex = (B[0] - A[0]) * c.W, ey = (B[1] - A[1]) * c.H, el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el, ll = num(p.line, 0.12, 0, 1) * el, sl = num(p.streak, 0.22, 0, 2) * c.W, cr = 26 * s * num(p.core, 1, 0, 6);
    const id = 'hwg' + Math.round(px) + '_' + Math.round(py);
    let out = `<defs><radialGradient id="${id}c"><stop offset="0" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="0.25" stop-color="${col}" stop-opacity="0.7"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${col}" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${col}" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
    out += `<g style="mix-blend-mode:screen" opacity="${f2(clamp(env))}">`;
    const ang = Math.atan2(uy, ux) * 180 / Math.PI;
    out += `<rect x="${f2(-ll / 2)}" y="${f2(-2.2 * s)}" width="${f2(ll)}" height="${f2(4.4 * s)}" rx="${f2(2.2 * s)}" fill="url(#${id}l)" transform="translate(${f2(px)} ${f2(py)}) rotate(${f2(ang)})"/>`;
    out += `<rect x="${f2(px - sl / 2)}" y="${f2(py - 1.6 * s)}" width="${f2(sl)}" height="${f2(3.2 * s)}" fill="url(#${id}s)" opacity="0.75"/>`;
    out += `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(cr)}" fill="url(#${id}c)"/>`;
    if (p.ghosts !== false) { const gx = c.W - px, gy = c.H - py; out += `<circle cx="${f2(lerp(px, gx, 0.6))}" cy="${f2(lerp(py, gy, 0.6))}" r="${f2(cr * 1.4)}" fill="${col}" opacity="0.06"/><circle cx="${f2(lerp(px, gx, 0.85))}" cy="${f2(lerp(py, gy, 0.85))}" r="${f2(cr * 0.7)}" fill="${col}" opacity="0.08"/>`; }
    return out + '</g>';
  } };

/* ================================================================ hw.dateCard ================================================================ */
const DATE_D = { kicker: 'Available', date: 'Spring 2027', priceLabel: 'From', price: 999, currency: '$', dec: 0, note: 'indicative price · placeholder', source: SRC0, cta: '', name: 'Acme Node', accent: '#5CC8FF', ink: '#F4F6FA', muted: '#9AA3B2', align: 'center', box: [0.1, 0.18, 0.8, 0.64] };
const DATE = { tags: ['hardware', 'availability', 'date', 'price', 'launch', 'end-card', 'number'], dur: 3.6, inF: 12, outF: 9, d: DATE_D,
  svg(L, p, c) {
    const s = sc(c), b = Array.isArray(p.box) && p.box.length >= 4 ? p.box.map((v, i) => num(v, DATE_D.box[i], -1, 2)) : DATE_D.box, X = b[0] * c.W, Y = b[1] * c.H, W = b[2] * c.W, H = b[3] * c.H;
    const left = p.align === 'left', ax = left ? X : X + W / 2, anc = left ? 'start' : 'middle', acc = hex(p.accent, DATE_D.accent), ink = hex(p.ink, DATE_D.ink), mut = hex(p.muted, DATE_D.muted), u = L.u, o = 1 - E.exit(L.out);
    const dateS = str(p.date, '', 40), ds = Math.min(150 * s, (W * 0.92) / Math.max(1, measure(dateS, 1, { weight: 800 }))), cy = Y + H * 0.46;
    const kk = E.enter(seg(u, 0, 0.4)), kd = E.enter(seg(u, 0.12, 0.6)), kr = E.move(seg(u, 0.45, 0.95)), kp = E.enter(seg(u, 0.8, 1.2)), kn = kd; /* the note (indicative / placeholder + source) is on screen whenever a digit is */
    let out = `<g opacity="${f2(o)}">` + text(str(p.name, '', 40) ? str(p.kicker, '', 40).toUpperCase() + '  ·  ' + str(p.name, '', 40) : str(p.kicker, '', 40).toUpperCase(), ax, cy - ds * 0.95, { size: 30 * s, weight: 700, fill: acc, anchor: anc, ls: 3 * s, op: kk });
    out += `<g opacity="${f2(kd)}" transform="translate(0 ${f2((1 - kd) * 30 * s)})">` + text(dateS, ax, cy, { size: ds, weight: 800, fill: ink, anchor: anc, ls: -0.02 * ds }) + '</g>';
    const rw = Math.min(W, 520 * s) * kr; out += `<rect x="${f2(left ? ax : ax - rw / 2)}" y="${f2(cy + 36 * s)}" width="${f2(rw)}" height="${f2(3 * s)}" fill="${acc}"/>`;
    const hasP = p.price != null && p.price !== '' && Number.isFinite(+p.price);
    if (hasP) { const v = num(p.price, 0, 0, 1e9) * E.expoOut(seg(u, 0.8, 1.7)), ps = str(p.priceLabel, '', 20) + ' ' + str(p.currency, '', 4) + fmtNum(v, p.dec); out += text(ps, ax, cy + 110 * s, { size: 58 * s, weight: 700, fill: ink, anchor: anc, op: kp, extra: tnum }); }
    const note = str(p.note, '', 80).trim() || 'indicative price · placeholder', srcT = hasP ? '  ·  ' + srcLine(p) : '';
    out += text(note + srcT, ax, cy + (hasP ? 160 : 100) * s, { size: 26 * s, weight: 600, fill: mut, anchor: anc, op: kn });
    if (str(p.cta, '', 60)) out += text(str(p.cta, '', 60), ax, cy + (hasP ? 220 : 160) * s, { size: 34 * s, weight: 700, fill: ink, anchor: anc, op: kn });
    return out + '</g>';
  } };

/* ================================================================ hw.specCard ================================================================ */
const SPEC_D = { title: 'Specifications', rows: [{ label: 'Compute', value: 120, unit: 'TOPS', dec: 0 }, { label: 'Memory', value: 128, unit: 'GB', dec: 0 }, { label: 'Storage', value: 4, unit: 'TB', dec: 0 }, { label: 'Power', value: 240, unit: 'W', dec: 0 }, { label: 'Weight', value: 2.1, unit: 'kg', dec: 1 }],
  source: SRC0, note: 'demo specs', box: [0.08, 0.14, 0.4, 0.72], step: 0.32, accent: '#5CC8FF', ink: '#F4F6FA', muted: '#9AA3B2', panel: '#0B0D11' };
const SPEC = { tags: ['hardware', 'spec', 'sheet', 'table', 'count-up', 'number'], dur: 4.5, inF: 9, outF: 9, d: SPEC_D,
  svg(L, p, c) {
    const s = sc(c), b = Array.isArray(p.box) && p.box.length >= 4 ? p.box.map((v, i) => num(v, SPEC_D.box[i], -1, 2)) : SPEC_D.box, X = b[0] * c.W, Y = b[1] * c.H, W = b[2] * c.W, H = b[3] * c.H;
    const rows = list(p.rows, 10).filter((r) => r && typeof r === 'object'), n = Math.max(1, rows.length), acc = hex(p.accent, SPEC_D.accent), ink = hex(p.ink, SPEC_D.ink), mut = hex(p.muted, SPEC_D.muted), u = L.u, o = 1 - E.exit(L.out), step = num(p.step, 0.32, 0.02, 3);
    const head = 96 * s, foot = 70 * s, rh = Math.min(120 * s, (H - head - foot) / n), pk = E.enter(seg(u, 0, 0.35));
    let out = `<g opacity="${f2(o)}"><rect x="${f2(X)}" y="${f2(Y)}" width="${f2(W)}" height="${f2(H)}" rx="${f2(22 * s)}" fill="${hex(p.panel, SPEC_D.panel)}" fill-opacity="${f2(0.82 * pk)}" stroke="#FFFFFF" stroke-opacity="${f2(0.1 * pk)}"/>`;
    out += text(str(p.title, '', 40).toUpperCase(), X + 40 * s, Y + 62 * s, { size: 28 * s, weight: 700, fill: acc, ls: 3 * s, op: pk });
    rows.forEach((r, i) => { const t0 = 0.25 + i * step, k = E.enter(seg(u, t0, t0 + 0.35)); if (k <= 0) return; const yy = Y + head + rh * (i + 0.7), v = num(r.value, 0, -1e12, 1e12) * E.expoOut(seg(u, t0 + 0.05, t0 + 0.75));
      out += `<g opacity="${f2(k)}" transform="translate(${f2((1 - k) * -24 * s)} 0)">` + text(str(r.label, '', 30), X + 40 * s, yy, { size: 32 * s, weight: 600, fill: mut });
      const vs = fmtNum(v, r.dec ?? 0), us = str(r.unit, '', 10), uw = us ? measure(' ' + us, 30 * s, { weight: 700 }) : 0;
      out += text(vs, X + W - 40 * s - uw - (us ? 8 * s : 0), yy, { size: 52 * s, weight: 800, fill: ink, anchor: 'end', extra: tnum }) + (us ? text(us, X + W - 40 * s, yy, { size: 30 * s, weight: 700, fill: acc, anchor: 'end' }) : '');
      if (i < n - 1) out += `<rect x="${f2(X + 40 * s)}" y="${f2(yy + rh * 0.3)}" width="${f2((W - 80 * s) * k)}" height="${f2(Math.max(1, 1.2 * s))}" fill="#FFFFFF" opacity="0.12"/>`;
      out += '</g>'; });
    const fk = pk; /* the source line is on screen with the first digit */ out += text((str(p.note, '', 40) ? str(p.note, '', 40) + '  ·  ' : '') + srcLine(p), X + 40 * s, Y + H - 30 * s, { size: 24 * s, weight: 600, fill: mut, op: fk });
    return out + '</g>';
  } };

export const HW_GFX = { 'hw.specCallout': CALLOUT, 'hw.dimensionLine': DIM, 'hw.chipDie': DIE, 'hw.edgeGlint': GLINT, 'hw.dateCard': DATE, 'hw.specCard': SPEC };
for (const g of Object.values(HW_GFX)) g.file = 'type/gfx/hw.js';
/* per-action sounds (gfxCues): local seconds; the plan adds `at` */
export const HW_CUES = {
  'hw.specCallout': (p) => [{ t: num(p.draw, 0.45, 0.05, 5) * 0.95, id: 'sfx/hw/click_detent', why: 'callout line lands' }, { t: num(p.draw, 0.45, 0.05, 5) * 0.7, id: 'sfx/ui/count_run', why: 'value counts up' }],
  'hw.dimensionLine': (p) => [{ t: 0.0, id: 'sfx/ui/slide', why: 'dimension draws' }, { t: num(p.draw, 0.6, 0.05, 5), id: 'sfx/hw/click_detent', why: 'dimension value lands' }],
  'hw.chipDie': (p) => { const n = dieBlocks(p.cores).length, st = num(p.stagger, 0.07, 0, 1); return [{ t: 0.35, id: 'sfx/hw/led_on', why: 'die appears' }, { t: 0.7 + n * st, id: 'sfx/ui/scan_sweep', why: 'scan crosses the die' }]; },
  'hw.edgeGlint': (p) => [{ t: num(p.sweep, 1.2, 0.1, 20) * 0.5, id: 'sfx/hw/light_sweep', why: 'edge glint at its brightest (the sweep sound: anchor = its own peak)' }],
  'hw.dateCard': (p) => [{ t: 0.12, id: 'sfx/hit/soft', why: 'date lands' }, ...(p.price != null && p.price !== '' ? [{ t: 0.8, id: 'sfx/ui/count_run', why: 'price counts' }] : [])],
  'hw.specCard': (p) => list(p.rows, 10).map((_, i) => ({ t: 0.25 + i * num(p.step, 0.32, 0.02, 3), id: 'sfx/hw/click_detent', why: `spec row ${i + 1} lands` })),
};
