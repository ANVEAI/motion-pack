/* motion-pack / type / gfx / collage.js: field layouts and connector tags (2026-10-14). Same contract as every gfx item (core.js); pure functions of t.
     layout.scatterCollage   a centred sentence builds, then explodes into a seeded field of words, stickers, small photos, numbered dots and a hand-drawn arrow, and settles
     layout.mosaicBurst      dozens of thumbnails burst from the centre into a grid (stagger by distance)
     layout.logoWall         a headline plus a grid of logo SLOTS fading in with a stagger; ships placeholder marks only (never third-party logos)
     layout.orbitRing        a centred phrase, concentric rings that draw on, icon slots that spiral in and orbit
     callout.connectorLabel  small tinted tags with elbow connectors that draw on, chained A -> B -> C, over an optional light grid
   Media slots take { href } or { svg, viewBox }; without them the owned placeholders in media.js render (abstract art, generic marks).
   Positions are seeded (mulberry32): the same seed gives the same layout on every frame and every machine. Owned code. */
import { E, clamp, lerp, seg, TAU, mulberry32, FONT, BRAND, INK, PAPER, f2, esc, text, measure, wobblePath, polylineLen, dash } from './core.js';
import { STICKERS } from './stickers.js';
import { slotMedia, placeholderLogo } from './media.js';

const F = 1 / 30;
const sticker = (name, cx, cy, size, rot = 0, k = 1) => `<g transform="translate(${f2(cx)} ${f2(cy)}) rotate(${f2(rot)}) scale(${Math.max(0.0001, (size / 100) * k).toFixed(4)}) translate(-50 -50)">${(STICKERS[name] || STICKERS.star)()}</g>`;
/* an icon / logo slot: sticker name, inline svg, or href, fitted (meet) into a box centred at cx, cy */
function iconSlot(it, cx, cy, size, k = 1) {
  if (it.href) return `<image href="${esc(it.href)}" x="${f2(cx - size * k / 2)}" y="${f2(cy - size * k / 2)}" width="${f2(size * k)}" height="${f2(size * k)}" preserveAspectRatio="xMidYMid meet"/>`;
  if (it.svg) return `<svg x="${f2(cx - size * k / 2)}" y="${f2(cy - size * k / 2)}" width="${f2(Math.max(0.01, size * k))}" height="${f2(Math.max(0.01, size * k))}" viewBox="${it.viewBox || '0 0 100 100'}">${it.svg}</svg>`;
  return sticker(it.name, cx, cy, size, 0, k);
}
/* seeded jittered grid cells inside area [x, y, w, h] (fractions), shuffled */
function cells(area, cols, rows, W, H, r, avoid = null) {
  const cw = (area[2] * W) / cols, ch = (area[3] * H) / rows, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = area[0] * W + (i + 0.5) * cw + (r() - 0.5) * cw * 0.45, y = area[1] * H + (j + 0.5) * ch + (r() - 0.5) * ch * 0.45;
    if (avoid && Math.abs(x - avoid[0]) < avoid[2] && Math.abs(y - avoid[1]) < avoid[3]) continue; out.push([x, y, cw, ch]); }
  for (let i = out.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [out[i], out[k]] = [out[k], out[i]]; }
  return out;
}
const elbowPath = (sx, sy, tx, ty, rad) => { const dx = tx - sx, dy = ty - sy, r = Math.min(rad, Math.abs(dx), Math.abs(dy)), sgx = Math.sign(dx) || 1, sgy = Math.sign(dy) || 1;
  return `M${f2(sx)} ${f2(sy)} V${f2(ty - sgy * r)} Q${f2(sx)} ${f2(ty)} ${f2(sx + sgx * r)} ${f2(ty)} H${f2(tx)}`; };

export const COLLAGE = {
  'layout.scatterCollage': { tags: ['layout', 'collage', 'scatter', 'zine', 'explode', 'stickers', 'hook'], dur: 3.6, inF: 1, outF: 10,
    d: { text: 'Your team dreams big', size: 64, at: [0.5, 0.5], stagger: 5 * F, explodeAt: 1.2, fly: 0.75, spread: 0.2, seed: 7, stickers: ['star', 'bolt', 'heart', 'rocket', 'sparkle', 'chat'], photos: 5, dots: 4, arrow: true,
      media: [], area: [0.05, 0.08, 0.9, 0.84], cols: 6, rows: 4, color: INK, dotColor: '#FF3D9A', arrowColor: INK, weight: 700, font: FONT, float: 3 },
    svg(L, p, c) {
      const S = p.size * c.s, r = mulberry32(p.seed * 9173 + 1), u = L.u, cx = p.at[0] * c.W, cy = p.at[1] * c.H, words = p.text.split(/\s+/).filter(Boolean), sp = measure(' ', S, { weight: p.weight, font: p.font });
      const ws = words.map((w) => measure(w, S, { weight: p.weight, font: p.font })), tot = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1); let x = cx - tot / 2;
      const items = words.map((w, i) => { const it = { kind: 'word', w, sx: x + ws[i] / 2, sy: cy }; x += ws[i] + sp; return it; });
      for (let i = 0; i < p.photos; i++) items.push({ kind: 'photo', i }); p.stickers.forEach((n) => items.push({ kind: 'sticker', name: n })); for (let i = 0; i < p.dots; i++) items.push({ kind: 'dot', n: i + 1 }); if (p.arrow) items.push({ kind: 'arrow' });
      const cl = cells(p.area, p.cols, p.rows, c.W, c.H, r), tE = p.explodeAt; let out = '';
      items.slice(0, cl.length).forEach((it, i) => { const [tx, ty, cw] = cl[i], rot = (r() - 0.5) * (it.kind === 'word' ? 10 : 22), sz = 0.85 + r() * 0.4, ph = r() * TAU, delay = (Math.hypot(tx - cx, ty - cy) / c.W) * p.spread * 2;
        const k = E.pop(seg(u, tE + delay, tE + delay + p.fly)), fl = seg(u, tE + delay + p.fly, tE + delay + p.fly + 0.6) * p.float * c.s, fx = Math.sin(u * 1.3 + ph) * fl, fy = Math.cos(u * 1.1 + ph * 1.7) * fl;
        if (it.kind === 'word') { const b = E.enter(seg(u, i * p.stagger, i * p.stagger + 10 * F)), X = lerp(it.sx, tx, k) + fx, Y = lerp(it.sy, ty, k) + fy, s = lerp(1, sz, k);
          out += `<g transform="translate(${f2(X)} ${f2(Y + (1 - b) * S * 0.3)}) rotate(${f2(rot * k)}) scale(${f2(s)})" opacity="${f2(b)}">${text(it.w, 0, S * 0.35, { size: S, weight: p.weight, fill: p.color, anchor: 'middle', font: p.font })}</g>`; return; }
        const K = clamp(k), X = lerp(cx, tx, k) + fx, Y = lerp(cy, ty, k) + fy, sc = Math.max(0.0001, E.enter(seg(u, tE + delay, tE + delay + p.fly * 0.6))); if (u < tE + delay) return;
        if (it.kind === 'photo') { const w = Math.min(cw * 0.62, c.W * 0.1) * sz, h = w * (it.i % 2 ? 0.78 : 1.22);
          out += `<g transform="translate(${f2(X)} ${f2(Y)}) rotate(${f2(rot * K)}) scale(${sc.toFixed(4)})">${slotMedia(p.media[it.i], -w / 2, -h / 2, w, h, p.seed * 17 + it.i * 3, { border: 5 * c.s, shadow: true })}</g>`; }
        else if (it.kind === 'sticker') out += sticker(it.name, X, Y, c.W * 0.06 * sz, rot * K, sc);
        else if (it.kind === 'dot') { const rr = 22 * c.s * sc; out += `<circle cx="${f2(X)}" cy="${f2(Y)}" r="${f2(rr)}" fill="${p.dotColor}"/>` + text(String(it.n), X, Y + rr * 0.36, { size: rr * 1.05, weight: 800, fill: PAPER, anchor: 'middle', op: sc }); }
        else { const a = [X - 70 * c.s, Y + 34 * c.s], b2 = [X + 66 * c.s, Y - 30 * c.s], m = [X - 10 * c.s, Y - 44 * c.s], pts = Array.from({ length: 21 }, (_, q) => { const t = q / 20, v = 1 - t; return [v * v * a[0] + 2 * v * t * m[0] + t * t * b2[0], v * v * a[1] + 2 * v * t * m[1] + t * t * b2[1]]; });
          const dk = E.soft(seg(u, tE + delay + 0.2, tE + delay + 0.7)), an = Math.atan2(b2[1] - pts[18][1], b2[0] - pts[18][0]), hl = 22 * c.s, w5 = 5 * c.s;
          out += `<path d="${wobblePath(pts, p.seed, 1.5 * c.s)}" fill="none" stroke="${p.arrowColor}" stroke-width="${f2(w5)}" stroke-linecap="round" ${dash(polylineLen(pts) * 1.03, dk)}/>` +
            `<path d="M${f2(b2[0] - hl * Math.cos(an - 0.5))} ${f2(b2[1] - hl * Math.sin(an - 0.5))} L${f2(b2[0])} ${f2(b2[1])} L${f2(b2[0] - hl * Math.cos(an + 0.5))} ${f2(b2[1] - hl * Math.sin(an + 0.5))}" fill="none" stroke="${p.arrowColor}" stroke-width="${f2(w5)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f2(seg(dk, 0.85, 1))}"/>`; } });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'layout.mosaicBurst': { tags: ['layout', 'mosaic', 'burst', 'thumbnails', 'grid', 'explosion', 'montage'], dur: 2.6, inF: 1, outF: 8,
    d: { cols: 14, rows: 7, area: [0.04, 0.07, 0.92, 0.86], gap: 0.22, fly: 0.8, spread: 0.5, seed: 3, media: [], radius: 0.08, kinds: null, bg: null },
    svg(L, p, c) {
      const r = mulberry32(p.seed * 6151 + 3), tw = (p.area[2] * c.W) / p.cols, th = (p.area[3] * c.H) / p.rows, w = tw * (1 - p.gap), h = th * (1 - p.gap), cx = c.W / 2, cy = c.H / 2, u = L.u, maxD = Math.hypot(c.W, c.H) / 2;
      let out = p.bg ? `<rect width="${c.W}" height="${c.H}" fill="${p.bg}"/>` : '';
      for (let j = 0; j < p.rows; j++) for (let i = 0; i < p.cols; i++) { const n = j * p.cols + i, tx = p.area[0] * c.W + (i + 0.5) * tw, ty = p.area[1] * c.H + (j + 0.5) * th, d = Math.hypot(tx - cx, ty - cy) / maxD, jit = r() * 0.08, rot0 = (r() - 0.5) * 70, kind = p.kinds ? p.kinds[n % p.kinds.length] : null;
        const t0 = d * p.spread + jit, k = E.hero(seg(u, t0, t0 + p.fly)); if (k <= 0) continue; const X = lerp(cx + (tx - cx) * 0.08, tx, k), Y = lerp(cy + (ty - cy) * 0.08, ty, k), s = lerp(0.2, 1, k);
        out += `<g transform="translate(${f2(X)} ${f2(Y)}) rotate(${f2(rot0 * (1 - k))}) scale(${f2(s)})" opacity="${f2(clamp(k * 3))}">${slotMedia(p.media[n % Math.max(1, p.media.length)] || null, -w / 2, -h / 2, w, h, p.seed * 101 + n, { kind, radius: Math.min(w, h) * p.radius, border: Math.min(w, h) * 0.05 })}</g>`; }
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'layout.logoWall': { tags: ['layout', 'logo-wall', 'social-proof', 'grid', 'placeholder', 'customers'], dur: 3, inF: 12, outF: 10,
    d: { headline: 'More than N teams build here', source: '', logos: [], cols: 5, rows: 3, box: [0.13, 0.4, 0.74, 0.42], headY: 0.26, headSize: 60, start: 0.3, stagger: 2 * F, fade: 10 * F, seed: 2,
      color: INK, slotColor: '#6E6E7A', cellColor: '#E4E4EA', placeholderNote: 'PLACEHOLDER LOGOS', font: FONT },
    svg(L, p, c) {
      const u = L.u, hk = E.hero(L.in), HS = p.headSize * c.s, bx = p.box[0] * c.W, by = p.box[1] * c.H, cw = (p.box[2] * c.W) / p.cols, ch = (p.box[3] * c.H) / p.rows, n = p.cols * p.rows, r = mulberry32(p.seed * 31 + 5);
      const order = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; } const rank = []; order.forEach((v, i) => { rank[v] = i; });
      let out = text(p.headline, c.W / 2, p.headY * c.H + HS * 0.35 + (1 - hk) * HS * 0.4, { size: HS, weight: 800, fill: p.color, anchor: 'middle', font: p.font, ls: -0.02 * HS, op: hk }), ph = false;
      const gk = E.soft(seg(u, 0.1, 0.5)); for (let i = 1; i < p.cols; i++) out += `<line x1="${f2(bx + i * cw)}" y1="${f2(by)}" x2="${f2(bx + i * cw)}" y2="${f2(by + p.rows * ch * gk)}" stroke="${p.cellColor}" stroke-width="${f2(1.5 * c.s)}"/>`;
      for (let j = 1; j < p.rows; j++) out += `<line x1="${f2(bx)}" y1="${f2(by + j * ch)}" x2="${f2(bx + p.cols * cw * gk)}" y2="${f2(by + j * ch)}" stroke="${p.cellColor}" stroke-width="${f2(1.5 * c.s)}"/>`;
      for (let i = 0; i < n; i++) { const t0 = p.start + rank[i] * p.stagger, k = E.enter(seg(u, t0, t0 + p.fade)); if (k <= 0) continue; const x = bx + (i % p.cols) * cw, y = by + Math.floor(i / p.cols) * ch, lg = p.logos[i], lh = ch * 0.4, dy = (1 - k) * ch * 0.12;
        let m; if (lg && (lg.svg || lg.href)) m = iconSlot(lg, x + cw / 2, y + ch / 2 + dy, Math.min(cw, ch) * 0.6); else { ph = true; m = `<g transform="translate(0 ${f2(dy)})">${placeholderLogo(x + cw * 0.08, y + (ch - lh) / 2, cw * 0.84, lh, i, p.slotColor, p.font)}</g>`; }
        out += `<g opacity="${f2(k)}">${m}</g>`; }
      if (p.source) out += text('Source: ' + p.source, bx, by + p.rows * ch + 34 * c.s, { size: 18 * c.s, weight: 600, fill: p.slotColor, font: p.font });
      if (ph && p.placeholderNote) out += text(p.placeholderNote, bx + p.cols * cw, by + p.rows * ch + 34 * c.s, { size: 16 * c.s, weight: 700, fill: p.slotColor, anchor: 'end', font: p.font, ls: 2 * c.s });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'layout.orbitRing': { tags: ['layout', 'orbit', 'rings', 'integrations', 'icons', 'connected'], dur: 3.4, inF: 1, outF: 10,
    d: { text: 'Every task, connected', size: 54, at: [0.5, 0.5], rings: [0.29, 0.39, 0.49], ringColor: '#D9D9E0', ringW: 2, speed: [7, -5, 3.5], iconSize: 0.078, ringDraw: 0.6, iconStart: 0.45, stagger: 4 * F,
      icons: [{ name: 'chat', label: 'Chat', ring: 0, angle: -140 }, { name: 'calendar', label: 'Plans', ring: 1, angle: -40 }, { name: 'bolt', label: 'Automate', ring: 2, angle: 20 }, { name: 'lock', label: 'Secure', ring: 1, angle: 150 },
        { name: 'chartUp', label: 'Reports', ring: 2, angle: 220 }, { name: 'mic', label: 'Voice', ring: 0, angle: 60 }], color: INK, labelColor: '#55556A', badge: PAPER, font: FONT, weight: 700 },
    svg(L, p, c) {
      const S = p.size * c.s, cx = p.at[0] * c.W, cy = p.at[1] * c.H, u = L.u, words = p.text.split(/\s+/), sp = measure(' ', S, { weight: p.weight, font: p.font }), ws = words.map((w) => measure(w, S, { weight: p.weight, font: p.font }));
      let out = ''; p.rings.forEach((rr, i) => { const k = E.soft(seg(u, i * 4 * F, i * 4 * F + p.ringDraw)); if (k > 0) out += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(rr * c.H)}" fill="none" stroke="${p.ringColor}" stroke-width="${f2(p.ringW * c.s)}" pathLength="1" stroke-dasharray="1 1.01" stroke-dashoffset="${f2(1 - k)}" transform="rotate(-90 ${f2(cx)} ${f2(cy)})"/>`; });
      let x = cx - (ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1)) / 2; words.forEach((w, i) => { const k = E.enter(seg(u, 0.15 + i * 4 * F, 0.15 + i * 4 * F + 12 * F)); out += text(w, x, cy + S * 0.35 + (1 - k) * S * 0.25, { size: S, weight: p.weight, fill: p.color, font: p.font, op: k }); x += ws[i] + sp; });
      const IS = p.iconSize * c.H; p.icons.forEach((it, i) => { const t0 = p.iconStart + i * p.stagger, k = E.hero(seg(u, t0, t0 + 0.7)); if (k <= 0) return; const R = p.rings[it.ring ?? 0] * c.H, a = ((it.angle ?? i * 60) + (p.speed[it.ring ?? 0] || 0) * Math.max(0, u - t0) - (1 - k) * 90) * Math.PI / 180, rr = R * lerp(1.7, 1, k);
        const ix = cx + rr * Math.cos(a), iy = cy + rr * Math.sin(a), sc = E.pop(seg(u, t0, t0 + 0.45));
        out += `<g opacity="${f2(clamp(k * 2))}"><circle cx="${f2(ix)}" cy="${f2(iy)}" r="${f2(IS * 0.62 * sc)}" fill="${p.badge}" stroke="${p.ringColor}" stroke-width="${f2(1.5 * c.s)}"/>${iconSlot(it, ix, iy, IS * 0.78, sc)}` +
          (it.label ? text(it.label, ix + IS * 0.78, iy + IS * 0.13, { size: IS * 0.36, weight: 600, fill: p.labelColor, font: p.font, op: seg(u, t0 + 0.3, t0 + 0.6) }) : '') + '</g>'; });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'callout.connectorLabel': { tags: ['callout', 'connector', 'tag', 'elbow', 'workflow', 'grid', 'draw-on'], dur: 3, inF: 10, outF: 8,
    d: { items: [{ label: 'From the first idea', at: [0.34, 0.38], tint: '#FFD8C2', ink: '#3A1E10' }, { label: 'to the final deploy', at: [0.55, 0.64], tint: '#D6E2FF', ink: '#14213D' }],
      origin: [0.22, 0.16], grid: true, gridStep: 0.042, gridColor: '#E6E6EC', paper: null, line: '#2A2A33', lineW: 2.5, size: 40, step: 0.8, draw: 0.5, radius: 22, font: FONT, weight: 600 },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, gk = clamp(L.in); let out = p.paper ? `<rect width="${c.W}" height="${c.H}" fill="${p.paper}" opacity="${f2(gk)}"/>` : '';
      if (p.grid) { const st = p.gridStep * c.W; let g = ''; for (let x = st; x < c.W; x += st) g += `M${f2(x)} 0 V${c.H} `; for (let y = st; y < c.H; y += st) g += `M0 ${f2(y)} H${c.W} `; out += `<path d="${g}" stroke="${p.gridColor}" stroke-width="${f2(1.2 * c.s)}" fill="none" opacity="${f2(gk)}"/>`; }
      let sx = p.origin[0] * c.W, sy = p.origin[1] * c.H;
      p.items.forEach((it, i) => { const tw = measure(it.label, S, { weight: p.weight, font: p.font }) + S * 0.9, th = S * 1.7, tx = it.at[0] * c.W, ty = it.at[1] * c.H, t0 = i * p.step, k = E.soft(seg(u, t0, t0 + p.draw)), tk = E.hero(seg(u, t0 + p.draw * 0.85, t0 + p.draw * 0.85 + 0.35));
        if (k > 0) out += `<path d="${elbowPath(sx, sy, tx, ty + th / 2, p.radius * c.s)}" fill="none" stroke="${p.line}" stroke-width="${f2(p.lineW * c.s)}" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1.01" stroke-dashoffset="${f2(1 - k)}"/><circle cx="${f2(sx)}" cy="${f2(sy)}" r="${f2(4.5 * c.s)}" fill="${p.line}"/>`;
        if (tk > 0) { const cm = 7 * c.s, tick = (x, y, dx, dy) => `<path d="M${f2(x + dx * cm)} ${f2(y)} H${f2(x)} V${f2(y + dy * cm)}" fill="none" stroke="${it.ink || INK}" stroke-width="${f2(1.6 * c.s)}"/>`;
          out += `<svg x="${f2(tx)}" y="${f2(ty)}" width="${f2(Math.max(0.01, tw * tk))}" height="${f2(th)}" overflow="hidden"><rect width="${f2(tw)}" height="${f2(th)}" fill="${it.tint || '#EEE'}"/>${text(it.label, S * 0.45, th / 2 + S * 0.35, { size: S, weight: p.weight, fill: it.ink || INK, font: p.font })}</svg>` +
            `<g opacity="${f2(seg(tk, 0.7, 1))}">${tick(tx - 3 * c.s, ty - 3 * c.s, 1, 1)}${tick(tx + tw + 3 * c.s, ty + th + 3 * c.s, -1, -1)}</g>`; }
        sx = tx + tw * 0.3; sy = ty + th; });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },
};
