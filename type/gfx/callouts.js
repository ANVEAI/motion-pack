/* motion-pack / type / gfx / callouts.js: call-outs (6), emotion marks for mime-style spots and reels (9), comic impact marks (5).
   Positions are frame fractions (designer space, top-left origin): box = [x, y, w, h], at = [x, y]. See core.js for the contract. */
import { E, clamp, lerp, seg, TAU, mulberry32, FONT, BRAND, INK, PAPER, f2, text, textW, dash, wobblePath, polylineLen, hashf } from './core.js';

const px = (c, a) => [a[0] * c.W, a[1] * c.H];
const boxPx = (c, b) => [b[0] * c.W, b[1] * c.H, b[2] * c.W, b[3] * c.H];
const scl = (cx, cy, k, inner) => `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${Math.max(0.0001, k).toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})">${inner}</g>`;
const ellipsePts = (cx, cy, rx, ry, seed, turns = 1.12) => { const r = mulberry32(seed * 977 + 5), n = 28, o = []; for (let i = 0; i <= n * turns; i++) { const a = (i / n) * TAU - 2.2, k = 1 + (r() - 0.5) * 0.06 + i * 0.002; o.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]); } return o; };
const quadPts = (a, b, bend, n = 24) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], cx = mx - dy * bend, cy = my + dx * bend; return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; }); };
const stroke = (d, col, w, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f2(w)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const star = (cx, cy, ro, ri, n, rot = -90) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = (rot + i * 180 / n) * Math.PI / 180; return `${f2(cx + r * Math.cos(a))},${f2(cy + r * Math.sin(a))}`; }).join(' ');
const heart = (cx, cy, s) => `M${f2(cx)} ${f2(cy + s * 0.38)} C${f2(cx - s * 0.62)} ${f2(cy - s * 0.04)} ${f2(cx - s * 0.36)} ${f2(cy - s * 0.52)} ${f2(cx)} ${f2(cy - s * 0.2)} C${f2(cx + s * 0.36)} ${f2(cy - s * 0.52)} ${f2(cx + s * 0.62)} ${f2(cy - s * 0.04)} ${f2(cx)} ${f2(cy + s * 0.38)} Z`;
const drop = (cx, cy, s) => `M${f2(cx)} ${f2(cy - s)} C${f2(cx + s * 0.2)} ${f2(cy - s * 0.4)} ${f2(cx + s * 0.62)} ${f2(cy + s * 0.05)} ${f2(cx + s * 0.62)} ${f2(cy + s * 0.38)} A${f2(s * 0.62)} ${f2(s * 0.62)} 0 0 1 ${f2(cx - s * 0.62)} ${f2(cy + s * 0.38)} C${f2(cx - s * 0.62)} ${f2(cy + s * 0.05)} ${f2(cx - s * 0.2)} ${f2(cy - s * 0.4)} ${f2(cx)} ${f2(cy - s)} Z`;

export const CALLOUTS = {
  'callout.scribbleCircle': { tags: ['callout', 'circle', 'highlight', 'hand-drawn', 'explainer'], dur: 2, inF: 14, outF: 8, d: { box: [0.38, 0.4, 0.24, 0.14], color: '#FF3B5C', width: 7, seed: 3 },
    svg(L, p, c) { const [x, y, w, h] = boxPx(c, p.box), pts = ellipsePts(x + w / 2, y + h / 2, w * 0.62, h * 0.78, p.seed), d = wobblePath(pts, p.seed, 2 * c.s), len = polylineLen(pts) * 1.05;
      return `<g opacity="${f2(1 - L.out)}">${stroke(d, p.color, p.width * c.s, dash(len, E.soft(L.in)))}</g>`; } },
  'callout.handArrow': { tags: ['callout', 'arrow', 'point', 'hand-drawn', 'tutorial'], dur: 2, inF: 14, outF: 8, d: { from: [0.25, 0.75], to: [0.45, 0.5], bend: 0.25, color: '#FFD400', width: 8, seed: 2, label: '' },
    svg(L, p, c) { const a = px(c, p.from), b = px(c, p.to), pts = quadPts(a, b, p.bend), len = polylineLen(pts), k = E.soft(L.in), hk = seg(L.in, 0.8, 1), n = pts.length - 1, [x1, y1] = pts[n], [x0, y0] = pts[n - 2], an = Math.atan2(y1 - y0, x1 - x0), hl = 34 * c.s;
      const head = `M${f2(x1 - hl * Math.cos(an - 0.5))} ${f2(y1 - hl * Math.sin(an - 0.5))} L${f2(x1)} ${f2(y1)} L${f2(x1 - hl * Math.cos(an + 0.5))} ${f2(y1 - hl * Math.sin(an + 0.5))}`;
      return `<g opacity="${f2(1 - L.out)}">${stroke(wobblePath(pts, p.seed, 1.5 * c.s), p.color, p.width * c.s, dash(len * 1.02, k))}${stroke(head, p.color, p.width * c.s, `opacity="${f2(hk)}"`)}` +
        (p.label ? text(p.label, a[0], a[1] + 50 * c.s, { size: 44 * c.s, weight: 800, fill: p.color, anchor: 'middle', op: seg(L.u, 0.3, 0.6) }) : '') + '</g>'; } },
  'callout.underline': { tags: ['callout', 'underline', 'emphasis', 'hand-drawn', 'caption'], dur: 2, inF: 10, outF: 8, d: { box: [0.35, 0.55, 0.3, 0.05], color: '#FFD400', width: 9, seed: 5, style: 'scribble' },
    svg(L, p, c) { const [x, y, w, h] = boxPx(c, p.box), r = mulberry32(p.seed * 31), pts = []; const yy = y + h;
      if (p.style === 'double') { for (let i = 0; i <= 10; i++) pts.push([x + w * i / 10, yy + (r() - 0.5) * 4 * c.s]); for (let i = 10; i >= 0; i--) pts.push([x + w * i / 10 + 6 * c.s, yy + 14 * c.s + (r() - 0.5) * 4 * c.s]); }
      else for (let i = 0; i <= 12; i++) pts.push([x + w * i / 12, yy + Math.sin(i * 1.3 + p.seed) * 5 * c.s]);
      return `<g opacity="${f2(1 - L.out)}">${stroke(wobblePath(pts, p.seed, 1.2 * c.s), p.color, p.width * c.s, dash(polylineLen(pts) * 1.02, E.soft(L.in)))}</g>`; } },
  'callout.bracket': { tags: ['callout', 'bracket', 'focus', 'frame', 'ui'], dur: 2, inF: 12, outF: 8, d: { box: [0.36, 0.36, 0.28, 0.28], color: PAPER, width: 6, corner: 0.22 },
    svg(L, p, c) { const [x, y, w, h] = boxPx(c, p.box), k = E.hero(L.in), pad = 30 * c.s * (1 - k) + 6 * c.s, l = Math.min(w, h) * p.corner, o = clamp(L.in * 2) * (1 - L.out);
      const cr = (cx, cy, sx, sy) => stroke(`M${f2(cx)} ${f2(cy + sy * l)} L${f2(cx)} ${f2(cy)} L${f2(cx + sx * l)} ${f2(cy)}`, p.color, p.width * c.s);
      return `<g opacity="${f2(o)}">${cr(x - pad, y - pad, 1, 1)}${cr(x + w + pad, y - pad, -1, 1)}${cr(x - pad, y + h + pad, 1, -1)}${cr(x + w + pad, y + h + pad, -1, -1)}</g>`; } },
  'callout.pinLeader': { tags: ['callout', 'pin', 'label', 'annotation', 'product'], dur: 2.5, inF: 18, outF: 8, d: { at: [0.5, 0.5], label: 'Runs offline', elbow: [0.14, -0.12], color: PAPER, accent: BRAND },
    svg(L, p, c) { const [ax, ay] = px(c, p.at), ex = ax + p.elbow[0] * c.W, ey = ay + p.elbow[1] * c.H, ts = 38 * c.s, tw = textW(p.label, ts) + 36 * c.s, dir = Math.sign(p.elbow[0]) || 1, lx = ex + dir * 80 * c.s;
      const pin = E.pop(seg(L.u, 0, 0.25)), l1 = E.soft(seg(L.u, 0.15, 0.4)), l2 = E.soft(seg(L.u, 0.35, 0.55)), lab = E.hero(seg(L.u, 0.5, 0.8)), o = 1 - L.out, bx = dir > 0 ? lx : lx - tw;
      return `<g opacity="${f2(o)}"><circle cx="${f2(ax)}" cy="${f2(ay)}" r="${f2(14 * c.s * pin)}" fill="${p.accent}" stroke="${PAPER}" stroke-width="${f2(4 * c.s)}"/>` +
        `<circle cx="${f2(ax)}" cy="${f2(ay)}" r="${f2(14 * c.s + 30 * c.s * seg(L.u, 0.1, 0.6))}" fill="none" stroke="${p.accent}" stroke-width="${f2(3 * c.s)}" opacity="${f2(1 - seg(L.u, 0.1, 0.6))}"/>` +
        stroke(`M${f2(ax)} ${f2(ay)} L${f2(lerp(ax, ex, l1))} ${f2(lerp(ay, ey, l1))}`, p.color, 3 * c.s) + (l2 > 0 ? stroke(`M${f2(ex)} ${f2(ey)} L${f2(lerp(ex, lx, l2))} ${f2(ey)}`, p.color, 3 * c.s) : '') +
        `<g opacity="${f2(lab)}"><rect x="${f2(bx)}" y="${f2(ey - ts * 0.9)}" width="${f2(tw)}" height="${f2(ts * 1.8)}" rx="${f2(ts * 0.3)}" fill="${INK}"/>${text(p.label, bx + 18 * c.s, ey + ts * 0.35, { size: ts, weight: 700, fill: p.color })}</g></g>`; } },
  'callout.spotlight': { tags: ['callout', 'spotlight', 'dim', 'focus', 'ui-demo'], dur: 2.5, inF: 14, outF: 10, d: { box: [0.3, 0.3, 0.4, 0.3], dim: 0.62, radius: 0.02, color: '#000000' },
    svg(L, p, c) { const [x, y, w, h] = boxPx(c, p.box), k = E.hero(L.in), grow = (1 - k) * Math.max(c.W, c.H) * 0.6, X = x - grow, Y = y - grow, Wd = w + 2 * grow, Hd = h + 2 * grow, r = p.radius * c.H + grow * 0.5;
      return `<path fill-rule="evenodd" fill="${p.color}" opacity="${f2(p.dim * k * (1 - E.exit(L.out)))}" d="M0 0 H${c.W} V${c.H} H0 Z M${f2(X + r)} ${f2(Y)} H${f2(X + Wd - r)} Q${f2(X + Wd)} ${f2(Y)} ${f2(X + Wd)} ${f2(Y + r)} V${f2(Y + Hd - r)} Q${f2(X + Wd)} ${f2(Y + Hd)} ${f2(X + Wd - r)} ${f2(Y + Hd)} H${f2(X + r)} Q${f2(X)} ${f2(Y + Hd)} ${f2(X)} ${f2(Y + Hd - r)} V${f2(Y + r)} Q${f2(X)} ${f2(Y)} ${f2(X + r)} ${f2(Y)} Z"/>`; } },

  'fx.emotion.sweat': { tags: ['emotion', 'sweat', 'nervous', 'mime', 'comedy'], dur: 1.5, inF: 6, outF: 6, d: { at: [0.58, 0.32], size: 1, color: '#7FD3FF' },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 34 * c.s * p.size; let g = ''; for (let i = 0; i < 2; i++) { const u = ((L.u * 0.9 + i * 0.5) % 1), k = E.pop(clamp(u * 5)) * (1 - seg(u, 0.75, 1));
        g += `<g transform="translate(${f2(x + i * s * 1.3)} ${f2(y + u * s * 2.2)}) scale(${f2(Math.max(0.001, k))})"><path d="${drop(0, 0, s)}" fill="${p.color}" stroke="${INK}" stroke-width="${f2(3 * c.s)}"/><ellipse cx="${f2(-s * 0.2)}" cy="${f2(s * 0.2)}" rx="${f2(s * 0.12)}" ry="${f2(s * 0.2)}" fill="#fff"/></g>`; }
      return `<g opacity="${f2(1 - L.out)}">${g}</g>`; } },
  'fx.emotion.vein': { tags: ['emotion', 'anger', 'vein', 'mime', 'anime'], dur: 1.5, inF: 6, outF: 6, d: { at: [0.56, 0.26], size: 1, color: '#E3122E' },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 64 * c.s * p.size * (1 + 0.12 * Math.max(0, Math.sin(L.u * TAU * 3))) * E.pop(L.in); let g = '';
      for (let i = 0; i < 4; i++) { const a = i * 90 + 45, r = a * Math.PI / 180, ox = Math.cos(r) * s * 0.5, oy = Math.sin(r) * s * 0.5; g += `<path d="M${f2(ox - Math.sin(r) * s * 0.35)} ${f2(oy + Math.cos(r) * s * 0.35)} Q${f2(ox * 0.3)} ${f2(oy * 0.3)} ${f2(ox + Math.sin(r) * s * 0.35)} ${f2(oy - Math.cos(r) * s * 0.35)}" fill="none" stroke="${p.color}" stroke-width="${f2(9 * c.s * p.size)}" stroke-linecap="round"/>`; }
      return `<g transform="translate(${f2(x)} ${f2(y)})" opacity="${f2(1 - L.out)}">${g}</g>`; } },
  'fx.emotion.heartBurst': { tags: ['emotion', 'love', 'hearts', 'mime', 'reaction'], dur: 1.6, inF: 6, outF: 8, d: { at: [0.5, 0.35], count: 7, size: 1, color: '#FF3B6B', seed: 4 },
    svg(L, p, c) { const [x, y] = px(c, p.at); let g = ''; for (let i = 0; i < p.count; i++) { const a = -Math.PI / 2 + (i / (p.count - 1) - 0.5) * 2.2, u = clamp(L.u / (1.1 + 0.3 * hashf(p.seed, i))), d = 160 * c.s * p.size * E.enter(u), s = 40 * c.s * p.size * (0.7 + 0.5 * hashf(p.seed, i, 2));
        const k = E.pop(clamp(u * 4)) * (1 - seg(u, 0.7, 1)); g += `<g transform="translate(${f2(x + Math.cos(a) * d)} ${f2(y + Math.sin(a) * d - 40 * c.s * u)}) rotate(${f2((hashf(p.seed, i, 3) - 0.5) * 40)}) scale(${f2(Math.max(0.001, k))})"><path d="${heart(0, 0, s)}" fill="${p.color}" stroke="${INK}" stroke-width="${f2(3 * c.s)}"/></g>`; }
      return `<g opacity="${f2(1 - L.out)}">${g}</g>`; } },
  'fx.emotion.question': { tags: ['emotion', 'question', 'confused', 'mime', 'comedy'], dur: 1.5, inF: 8, outF: 6, d: { at: [0.6, 0.25], size: 1, color: PAPER, count: 1 },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 120 * c.s * p.size; let g = ''; for (let i = 0; i < p.count; i++) { const k = E.pop(seg(L.u, i * 0.15, i * 0.15 + 0.3)), bob = Math.sin(L.u * TAU * 1.5 + i) * 8 * c.s, r = Math.sin(L.u * TAU + i) * 8;
        g += `<g transform="translate(${f2(x + i * s * 0.55)} ${f2(y + bob)}) rotate(${f2(r)}) scale(${f2(Math.max(0.001, k * (1 - i * 0.2)))})">${text('?', 0, s * 0.35, { size: s, weight: 800, fill: p.color, anchor: 'middle', extra: `stroke="${INK}" stroke-width="${f2(5 * c.s)}" paint-order="stroke"` })}</g>`; }
      return `<g opacity="${f2(1 - L.out)}">${g}</g>`; } },
  'fx.emotion.exclaim': { tags: ['emotion', 'surprise', 'alert', 'mime', 'game'], dur: 1.2, inF: 6, outF: 6, d: { at: [0.6, 0.25], size: 1, color: '#FFD400' },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 130 * c.s * p.size, k = E.pop(L.in), sh = Math.sin(L.u * 80) * 6 * c.s * (1 - seg(L.u, 0.1, 0.4)); let lines = '';
      for (let i = 0; i < 3; i++) { const a = (-150 + i * 30) * Math.PI / 180, r0 = s * 0.55, r1 = s * (0.75 + 0.15 * seg(L.u, 0, 0.3)); lines += stroke(`M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0 - s * 0.2)} L${f2(Math.cos(a) * r1)} ${f2(Math.sin(a) * r1 - s * 0.2)}`, p.color, 7 * c.s); }
      return `<g transform="translate(${f2(x + sh)} ${f2(y)}) scale(${f2(Math.max(0.001, k))})" opacity="${f2(1 - L.out)}">${text('!', 0, s * 0.35, { size: s, weight: 800, fill: p.color, anchor: 'middle', extra: `stroke="${INK}" stroke-width="${f2(6 * c.s)}" paint-order="stroke"` })}${lines}</g>`; } },
  'fx.emotion.dizzy': { tags: ['emotion', 'dizzy', 'stars', 'mime', 'cartoon'], dur: 2, inF: 6, outF: 6, d: { at: [0.5, 0.22], size: 1, count: 4, color: '#FFD400', speed: 1.2 },
    svg(L, p, c) { const [x, y] = px(c, p.at), rx = 110 * c.s * p.size, ry = 30 * c.s * p.size; let g = `<ellipse cx="${f2(x)}" cy="${f2(y)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="none" stroke="${PAPER}" stroke-width="${f2(2 * c.s)}" stroke-dasharray="${f2(8 * c.s)} ${f2(10 * c.s)}" opacity="0.5"/>`;
      for (let i = 0; i < p.count; i++) { const a = L.u * TAU * p.speed + i * TAU / p.count, sx = x + Math.cos(a) * rx, sy = y + Math.sin(a) * ry, s = 22 * c.s * p.size * (0.8 + 0.3 * Math.sin(a)); g += `<polygon points="${star(sx, sy, s, s * 0.45, 5, a * 30)}" fill="${p.color}" stroke="${INK}" stroke-width="${f2(2.5 * c.s)}"/>`; }
      return `<g opacity="${f2(clamp(L.in * 2) * (1 - L.out))}">${g}</g>`; } },
  'fx.emotion.sparkle': { tags: ['emotion', 'sparkle', 'clean', 'new', 'magic'], dur: 1.6, inF: 6, outF: 6, d: { at: [0.5, 0.4], spread: 0.12, count: 5, size: 1, color: '#FFFFFF', seed: 7 },
    svg(L, p, c) { const [x, y] = px(c, p.at); let g = ''; for (let i = 0; i < p.count; i++) { const ph = hashf(p.seed, i) * 0.8, u = (L.u + ph) % 0.9 / 0.9, k = Math.sin(Math.PI * u), s = 36 * c.s * p.size * (0.6 + 0.6 * hashf(p.seed, i, 2)), sx = x + (hashf(p.seed, i, 3) - 0.5) * 2 * p.spread * c.W, sy = y + (hashf(p.seed, i, 4) - 0.5) * 2 * p.spread * c.H;
        g += `<path transform="translate(${f2(sx)} ${f2(sy)}) scale(${f2(Math.max(0.001, k))}) rotate(${f2(u * 45)})" d="M0 ${f2(-s)} C${f2(s * 0.12)} ${f2(-s * 0.12)} ${f2(s * 0.12)} ${f2(-s * 0.12)} ${f2(s)} 0 C${f2(s * 0.12)} ${f2(s * 0.12)} ${f2(s * 0.12)} ${f2(s * 0.12)} 0 ${f2(s)} C${f2(-s * 0.12)} ${f2(s * 0.12)} ${f2(-s * 0.12)} ${f2(s * 0.12)} ${f2(-s)} 0 C${f2(-s * 0.12)} ${f2(-s * 0.12)} ${f2(-s * 0.12)} ${f2(-s * 0.12)} 0 ${f2(-s)} Z" fill="${p.color}"/>`; }
      return `<g opacity="${f2(1 - L.out)}">${g}</g>`; } },
  'fx.emotion.zzz': { tags: ['emotion', 'sleep', 'bored', 'mime', 'comedy'], dur: 2.5, inF: 6, outF: 8, d: { at: [0.58, 0.3], size: 1, color: PAPER },
    svg(L, p, c) { const [x, y] = px(c, p.at); let g = ''; for (let i = 0; i < 3; i++) { const u = ((L.u * 0.6 + i / 3) % 1), s = (40 + 40 * u) * c.s * p.size, o = Math.sin(Math.PI * u);
        g += text('Z', x + u * 90 * c.s + Math.sin(u * 7) * 10 * c.s, y - u * 160 * c.s, { size: s, weight: 800, fill: p.color, anchor: 'middle', op: o, extra: `stroke="${INK}" stroke-width="${f2(4 * c.s)}" paint-order="stroke"` }); }
      return `<g opacity="${f2(clamp(L.in * 2) * (1 - L.out))}">${g}</g>`; } },
  'fx.emotion.bulb': { tags: ['emotion', 'idea', 'bulb', 'mime', 'explainer'], dur: 1.6, inF: 10, outF: 8, d: { at: [0.5, 0.2], size: 1, color: '#FFE45C' },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 70 * c.s * p.size, k = E.pop(L.in), glow = 0.6 + 0.4 * Math.sin(L.u * TAU * 2), r = seg(L.u, 0.2, 0.5); let rays = '';
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, r0 = s * 1.15, r1 = s * (1.15 + 0.45 * r); rays += stroke(`M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0 - s * 0.1)} L${f2(Math.cos(a) * r1)} ${f2(Math.sin(a) * r1 - s * 0.1)}`, p.color, 6 * c.s, `opacity="${f2(glow)}"`); }
      return `<g transform="translate(${f2(x)} ${f2(y)}) scale(${f2(Math.max(0.001, k))})" opacity="${f2(1 - L.out)}">${rays}<circle cx="0" cy="${f2(-s * 0.1)}" r="${f2(s * 0.8)}" fill="${p.color}" stroke="${INK}" stroke-width="${f2(4 * c.s)}"/>` +
        `<rect x="${f2(-s * 0.35)}" y="${f2(s * 0.62)}" width="${f2(s * 0.7)}" height="${f2(s * 0.42)}" rx="${f2(s * 0.08)}" fill="#9BA3AF" stroke="${INK}" stroke-width="${f2(4 * c.s)}"/><ellipse cx="${f2(-s * 0.3)}" cy="${f2(-s * 0.4)}" rx="${f2(s * 0.14)}" ry="${f2(s * 0.24)}" fill="#fff" opacity="0.8"/></g>`; } },

  'fx.impact.onomatopoeia': { tags: ['impact', 'comic', 'pow', 'text', 'mime'], dur: 0.8, inF: 4, outF: 6, d: { word: 'POW!', at: [0.5, 0.45], size: 1, color: '#FFD400', burst: '#FF3B30', seed: 2 },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 150 * c.s * p.size, k = E.pop(L.in) * (1 + 0.05 * Math.sin(L.u * 40) * (1 - seg(L.u, 0, 0.3))), rot = -8 + 4 * hashf(p.seed), ro = s * 1.5;
      return `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(rot)}) scale(${f2(Math.max(0.001, k))})" opacity="${f2(1 - L.out)}"><polygon points="${star(0, 0, ro, ro * 0.62, 14)}" fill="${p.burst}" stroke="${INK}" stroke-width="${f2(6 * c.s)}" stroke-linejoin="round"/>` +
        text(p.word, 0, s * 0.35, { size: s, weight: 800, fill: p.color, anchor: 'middle', extra: `stroke="${INK}" stroke-width="${f2(12 * c.s)}" paint-order="stroke" stroke-linejoin="round"` }) + '</g>'; } },
  'fx.impact.speedLines': { tags: ['impact', 'speed-lines', 'manga', 'focus', 'comic'], dur: 1, inF: 2, outF: 4, d: { at: [0.5, 0.5], lines: 48, clear: 0.28, color: '#FFFFFF', fps: 12, seed: 3 },
    svg(L, p, c) { const [x, y] = px(c, p.at), q = Math.floor(L.u * p.fps), R = Math.hypot(c.W, c.H), r0 = p.clear * Math.min(c.W, c.H); let g = '';
      for (let i = 0; i < p.lines; i++) { if (hashf(p.seed, i, q) < 0.35) continue; const a = (i + hashf(p.seed, i, q, 1)) / p.lines * TAU, w = (0.15 + 0.5 * hashf(p.seed, i, q, 2)) * TAU / p.lines * 0.5, rr = r0 * (0.9 + 0.5 * hashf(p.seed, i, q, 3));
        g += `<polygon points="${f2(x + Math.cos(a) * rr)},${f2(y + Math.sin(a) * rr)} ${f2(x + Math.cos(a - w) * R)},${f2(y + Math.sin(a - w) * R)} ${f2(x + Math.cos(a + w) * R)},${f2(y + Math.sin(a + w) * R)}"/>`; }
      return `<g fill="${p.color}" opacity="${f2(clamp(L.in * 2) * (1 - L.out) * 0.9)}">${g}</g>`; } },
  'fx.impact.dustPoof': { tags: ['impact', 'dust', 'poof', 'landing', 'cartoon'], dur: 0.9, inF: 2, outF: 6, d: { at: [0.5, 0.8], size: 1, color: '#E8E2D6', count: 9, seed: 5 },
    svg(L, p, c) { const [x, y] = px(c, p.at); let g = ''; for (let i = 0; i < p.count; i++) { const side = i % 2 ? 1 : -1, u = E.enter(clamp(L.u / 0.8)), d = (60 + 200 * hashf(p.seed, i)) * c.s * p.size * u, r = (24 + 30 * hashf(p.seed, i, 2)) * c.s * p.size * (0.5 + u);
        g += `<circle cx="${f2(x + side * d)}" cy="${f2(y - (10 + 60 * hashf(p.seed, i, 3)) * c.s * u)}" r="${f2(r)}" fill="${p.color}" stroke="${INK}" stroke-width="${f2(3 * c.s)}"/>`; }
      return `<g opacity="${f2((1 - seg(L.u, 0.4, 0.9)) * (1 - L.out))}">${g}</g>`; } },
  'fx.impact.star': { tags: ['impact', 'hit', 'star', 'flash', 'comic'], dur: 0.5, inF: 2, outF: 6, d: { at: [0.5, 0.5], size: 1, color: '#FFFFFF', rim: '#FFD400', points: 9 },
    svg(L, p, c) { const [x, y] = px(c, p.at), s = 180 * c.s * p.size * E.pop(clamp(L.u / 0.12)), o = 1 - seg(L.u, 0.15, 0.5);
      return `<g opacity="${f2(o * (1 - L.out))}"><polygon points="${star(x, y, s, s * 0.45, p.points, -90 + L.u * 20)}" fill="${p.rim}"/><polygon points="${star(x, y, s * 0.65, s * 0.3, p.points, -90 + L.u * 20)}" fill="${p.color}"/></g>`; } },
  'fx.impact.smear': { tags: ['impact', 'smear', 'motion', 'animation', 'whip'], dur: 0.2, inF: 1, outF: 3, d: { at: [0.5, 0.5], dir: [1, 0], length: 0.35, size: 1, color: '#FFFFFF', count: 5, seed: 1 },
    svg(L, p, c) { const [x, y] = px(c, p.at), an = Math.atan2(p.dir[1], p.dir[0]) * 180 / Math.PI, len = p.length * c.W; let g = '';
      for (let i = 0; i < p.count; i++) { const off = (i - (p.count - 1) / 2) * 26 * c.s * p.size, l = len * (0.5 + 0.5 * hashf(p.seed, i)); g += `<ellipse cx="${f2(-l / 2)}" cy="${f2(off)}" rx="${f2(l / 2)}" ry="${f2(9 * c.s * p.size)}" opacity="${f2(0.35 + 0.4 * hashf(p.seed, i, 2))}"/>`; }
      return `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(an)})" fill="${p.color}" opacity="${f2(1 - L.out)}">${g}</g>`; } },
};
