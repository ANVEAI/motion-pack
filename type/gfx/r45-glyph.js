/* motion-pack / type / gfx / r45-glyph.js: round 4/5 glyph pieces (2026-10-14). Same contract as every gfx item (core.js): { tags, dur, inF, outF, d, svg(L, p, c) }
   -> SVG markup, a pure function of t (seek-safe). Positions are frame fractions, sizes px @1080 (scaled by c.s).
     type.asciiMosaic      the characters of a text scatter, then settle into a dense glyph mosaic that forms an image (luminance -> brightness or glyph
                           density), hold, and optionally dissolve back into the text. Image = an owned procedural plate ('bust', 'orb', 'spark') or a
                           luminance grid you pass ({ lum: rows x cols of 0..1 }; lumGrid(img, cols, rows) builds one from an <img> in the browser).
     type.textOnPath       text set along an SVG path with arc-length spacing (even on curves): reveal, travel, or trail a moving leader (icon / dot / svg)
     type.electricOutline  outlined numerals / short words from an owned single-stroke face, drawn on, with a seeded per-frame crackle, small arcs and a glow
   Craft learned from public launch films (round 4/5 study, October 2026): techniques only, never a brand, footage, wording, figure or sequence. Owned code. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, INK, PAPER, f2, esc, text, measure, hashf, uidOf, blurDef, blurAttr } from './core.js';
import { DEFAULT_MARK } from './media.js';
import { flattenPath, arcTable, pointAt, PATHS } from './pathsample.js';
import { mixHex } from './swap.js';

const op = (L) => clamp(L.in * 1.5) * (1 - L.out);
const FR = 30, frameOf = (u) => Math.floor(u * FR + 1e-6);

/* ---------------- asciiMosaic ---------------- */
export const RAMP = ' .,:;-=+*#%@';
/* owned procedural luminance plates: f(x, y) with x, y in 0..1 of the mosaic area (aspect = area w / h) -> 0..1 */
export const LUM_PLATES = {
  orb(x, y, a) { const X = (x - 0.5) * a, Y = y - 0.5, r = 0.4, d = Math.hypot(X, Y); if (d > r) return 0.06 + 0.05 * (1 - Math.hypot(x - 0.5, y - 0.5));
    const nz = Math.sqrt(Math.max(0, r * r - d * d)) / r, nx = X / r, ny = Y / r, l = Math.max(0, -0.5 * nx - 0.55 * ny + 0.67 * nz); return clamp(0.12 + 0.85 * l ** 1.2 + 0.25 * clamp((d / r - 0.82) / 0.18) * (nx > 0 ? 1 : 0.3)); },
  bust(x, y, a) { const X = (x - 0.5) * a, Y = y; let v = 0.02 * (1 - y);
    const hx = X, hy = Y - 0.36, hr = 0.2, hd = Math.hypot(hx / 0.86, hy); if (hd < hr) { const nz = Math.sqrt(1 - (hd / hr) ** 2); v = 0.18 + 0.75 * clamp(-0.55 * (hx / hr) - 0.35 * (hy / hr) + 0.6 * nz); }
    const nk = Math.abs(X) < 0.08 && Y > 0.5 && Y < 0.66; if (nk) v = Math.max(v, 0.32 - 0.6 * X);
    const sy = Y - 0.98, sw = 0.46, se = (X / sw) ** 2 + (sy / 0.36) ** 2; if (se < 1 && Y > 0.62) v = Math.max(v, 0.22 + 0.55 * clamp(0.6 - 0.9 * (X / sw) - 0.4 * se));
    return clamp(v); },
  spark(x, y, a) { const X = Math.abs((x - 0.5) * a) / 0.42, Y = Math.abs(y - 0.5) / 0.42, q = Math.sqrt(X) + Math.sqrt(Y); return q < 1 ? clamp(0.35 + 0.65 * (1 - q) * 1.6 - 0.25 * (x - 0.5)) : 0.04; },
};
/* browser: a luminance grid (rows x cols, 0..1) from an <img> / <canvas> / ImageBitmap, sampled once (cache it in params, never per frame) */
export function lumGrid(img, cols, rows) {
  const c = document.createElement('canvas'); c.width = cols; c.height = rows; const g = c.getContext('2d'); g.drawImage(img, 0, 0, cols, rows);
  const d = g.getImageData(0, 0, cols, rows).data; return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, k) => { const i = (r * cols + k) * 4; return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; }));
}
const sampleGrid = (G, x, y) => { const R = G.length, C = G[0].length, r = Math.min(R - 1, Math.max(0, Math.floor(y * R))), k = Math.min(C - 1, Math.max(0, Math.floor(x * C))); return +G[r][k] || 0; };
/* the mosaic plan for (p, c): cell size, grid, per-cell source luminance and level. Pure; cached per key. */
const mosaicCache = new Map();
export function asciiMosaicGrid(p, c) {
  const key = JSON.stringify([p.image, p.cols, p.area, p.levels, p.gamma, p.mode, p.text, c.W, c.H]); if (mosaicCache.has(key)) return mosaicCache.get(key);
  const [ax, ay, aw, ah] = [p.area[0] * c.W, p.area[1] * c.H, p.area[2] * c.W, p.area[3] * c.H], cw = aw / p.cols, fs = cw / 0.6, rows = Math.max(1, Math.floor(ah / fs)), y0 = ay + (ah - rows * fs) / 2;
  const fn = typeof p.image === 'string' ? LUM_PLATES[p.image] || LUM_PLATES.bust : null, a = aw / (rows * fs), cells = [], chars = String(p.text).replace(/\s+/g, '') || '#';
  for (let r = 0; r < rows; r++) for (let k = 0; k < p.cols; k++) {
    const x = (k + 0.5) / p.cols, y = (r + 0.5) / rows, lum = clamp((fn ? fn(x, y, a) : sampleGrid(p.image.lum, x, y)) ** (p.gamma || 1)), q = Math.round(lum * (p.levels - 1)), i = cells.length;
    cells.push({ i, r, k, x: ax + (k + 0.5) * cw, y: y0 + (r + 0.78) * fs, lum, q, ch: p.mode === 'ramp' ? RAMP[Math.round((q / (p.levels - 1)) * (RAMP.length - 1))] : chars[i % chars.length] });
  }
  const out = { cells, rows, cols: p.cols, fs, cw, area: [ax, y0, aw, rows * fs] }; mosaicCache.set(key, out); return out;
}
/* per-cell animation constants (line position, scatter point, delays), cached per layout */
const animCache = new Map();
function mosaicAnim(p, c, G) {
  const key = JSON.stringify([p.text, p.lineSize, p.lineChars, p.seed, p.spread, c.W, c.H, G.cells.length, G.area]); if (animCache.has(key)) return animCache.get(key);
  const n = [...String(p.text)].length, LS = p.lineSize * c.s, lw = Math.min(p.lineChars, n), lines = Math.ceil(n / p.lineChars), lx0 = c.W / 2 - (lw * 0.6 * LS) / 2, ly0 = c.H / 2 - ((lines - 1) * LS * 1.25) / 2 + LS * 0.35, [ax, ay, aw, ah] = G.area;
  const out = G.cells.map(({ i }) => { const j = i % n; return { lx: lx0 + (j % p.lineChars) * 0.6 * LS + 0.3 * LS, ly: ly0 + Math.floor(j / p.lineChars) * LS * 1.25, sx: ax - aw * 0.15 + hashf(i, 1, p.seed) * aw * 1.3,
    sy: ay - ah * 0.1 + hashf(i, 2, p.seed) * ah * 1.2, d0: hashf(i, 3, p.seed) * 0.25, dl: p.spread * hashf(i, 4, p.seed) }; });
  animCache.set(key, out); return out;
}
/* relative ink of a ramp glyph (0..1), for the rendered-brightness proxy in tests */
export const RAMP_INK = [0, 0.08, 0.14, 0.2, 0.26, 0.3, 0.4, 0.5, 0.62, 0.78, 0.88, 1];

/* ---------------- textOnPath ---------------- */
const tabCache = new Map();
function pathTab(p, c) {
  const d = PATHS[p.path] || p.path, key = [d, c.W, c.H, p.closed, p.pathBox].join('|'); if (tabCache.has(key)) return tabCache.get(key);
  const [bw, bh] = p.pathBox || [1920, 1080], s = Math.min(c.W / bw, c.H / bh), ox = (c.W - bw * s) / 2, oy = (c.H - bh * s) / 2;
  const tab = arcTable(flattenPath(d, { seg: 48 }).map(([x, y]) => [ox + x * s, oy + y * s]), !!p.closed); tab.d = d; tab.scale = s; tab.ox = ox; tab.oy = oy; tabCache.set(key, tab); return tab;
}
/* glyph states at local time u: [{ ch, s, x, y, a (deg), op }] + the leader { x, y, a } (trail mode). Pure. */
export function textOnPathState(u, p, c) {
  const S = p.size * c.s, tab = pathTab(p, c), L = tab.len, chars = [...String(p.text)], fo = { weight: p.weight, font: p.font }, ls = p.ls * S;
  const adv = chars.map((ch) => measure(ch, S, fo) + ls), tot = adv.reduce((a, b) => a + b, 0), off = []; let acc = 0; for (const w of adv) { off.push(acc + w / 2); acc += w; }
  let s0, lead = null, head = Infinity; const fadePx = p.fade * S;
  if (p.mode === 'travel') s0 = p.start * L + p.speed * c.s * u;
  else if (p.mode === 'trail') { const sl = lerp(p.start * L, p.end * L, E[p.ease] ? E[p.ease](seg(u, p.delay, p.delay + p.travel)) : seg(u, p.delay, p.delay + p.travel)); lead = { ...pointAt(tab, sl), s: sl }; s0 = sl - p.gap * S - tot; }
  else { s0 = p.start * L; head = E.soft(seg(u, p.delay, p.delay + p.travel)) * (tot + fadePx); }
  const glyphs = chars.map((ch, i) => { const s = s0 + off[i], q = pointAt(tab, s); let o = 1;
    if (!tab.closed) o *= clamp(s / fadePx) * clamp((L - s) / fadePx);
    if (p.mode === 'reveal') o *= clamp((head - off[i]) / fadePx);
    if (p.mode === 'trail' && u < p.delay) o = 0;
    return { ch, s, x: q.x, y: q.y, a: (q.a * 180) / Math.PI, op: o }; });
  return { glyphs, lead, len: L, tot, tab };
}

/* ---------------- electricOutline: an owned single-stroke face (4 x 6 units, y down) ---------------- */
const arc = (cx, cy, rx, ry, a0, a1) => { const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 9)); return Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; }); };
const qd = (a, b, c2, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, v = 1 - t; return [v * v * a[0] + 2 * v * t * b[0] + t * t * c2[0], v * v * a[1] + 2 * v * t * b[1] + t * t * c2[1]]; });
const cat = (...ps) => ps.flat();
const P_ = [[0, 6], [0, 0], [2.3, 0]];
export const STROKE_FACE = {
  0: [arc(2, 3, 2, 3, -90, 270)], 1: [[[0.9, 1.3], [2.2, 0], [2.2, 6]]], 2: [cat(arc(2, 1.8, 1.9, 1.8, 190, 380), [[0, 6], [4, 6]])],
  3: [cat(arc(2, 1.5, 1.9, 1.5, 200, 450), arc(2, 4.5, 2, 1.5, 270, 520))], 4: [[[3, 6], [3, 0], [0, 4.2], [4, 4.2]]],
  5: [cat([[3.8, 0], [0.6, 0], [0.4, 2.8]], arc(2, 4.1, 1.9, 1.9, 220, 510))], 6: [cat(qd([3.3, 0.2], [0, 0.8], [0.1, 4.2]), arc(2, 4.2, 1.9, 1.8, 180, 540))],
  7: [[[0, 0], [4, 0], [1.4, 6]]], 8: [cat(arc(2, 1.5, 1.7, 1.5, 90, 450), arc(2, 4.5, 2, 1.5, 270, 630))], 9: [cat(arc(2, 1.8, 1.9, 1.8, 0, 360), qd([3.9, 1.8], [4, 5.4], [0.7, 5.9]))],
  A: [[[0, 6], [2, 0], [4, 6]], [[0.7, 4], [3.3, 4]]], B: [cat([[0, 6], [0, 0], [2.3, 0]], arc(2.3, 1.5, 1.5, 1.5, 270, 450), [[0, 3]]), cat([[0, 3], [2.5, 3]], arc(2.5, 4.5, 1.5, 1.5, 270, 450), [[0, 6]])],
  C: [arc(2.2, 3, 2.1, 3, 320, 40)], D: [cat([[0, 0], [0, 6], [1.6, 6]], arc(1.6, 3, 2.4, 3, 90, -90), [[0, 0]])], E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]], F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [cat(arc(2.2, 3, 2.1, 3, 320, 10), [[2.4, 3.5]])], H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]], I: [[[2, 0], [2, 6]], [[0.8, 0], [3.2, 0]], [[0.8, 6], [3.2, 6]]],
  J: [cat([[3.2, 0], [3.2, 4.3]], arc(1.8, 4.3, 1.4, 1.7, 0, 180))], K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.3, 2.5], [4, 6]]], L: [[[0, 0], [0, 6], [3.8, 6]]],
  M: [[[0, 6], [0, 0], [2, 3.6], [4, 0], [4, 6]]], N: [[[0, 6], [0, 0], [4, 6], [4, 0]]], O: [arc(2, 3, 2, 3, -90, 270)], P: [cat(P_, arc(2.3, 1.6, 1.6, 1.6, 270, 450), [[0, 3.2]])],
  Q: [arc(2, 3, 2, 3, -90, 270), [[2.4, 4.4], [4.2, 6.3]]], R: [cat(P_, arc(2.3, 1.6, 1.6, 1.6, 270, 450), [[0, 3.2]]), [[1.8, 3.2], [4, 6]]],
  S: [cat(arc(2, 1.5, 1.8, 1.5, 330, 90), arc(2, 4.5, 2, 1.5, 270, 520))], T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]], U: [cat([[0, 0], [0, 4]], arc(2, 4, 2, 2, 180, 0), [[4, 0]])],
  V: [[[0, 0], [2, 6], [4, 0]]], W: [[[0, 0], [1, 6], [2, 2], [3, 6], [4, 0]]], X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]], Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]], Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '!': [[[2, 0], [2, 4.2]], [[2, 5.6], [2, 6]]], '?': [cat(arc(2, 1.6, 1.8, 1.6, 190, 450), [[2, 4.3]]), [[2, 5.6], [2, 6]]], '.': [[[2, 5.6], [2, 6]]], '-': [[[0.6, 3.5], [3.4, 3.5]]],
  '+': [[[2, 1.5], [2, 5.5]], [[0, 3.5], [4, 3.5]]], '/': [[[3.6, 0], [0.4, 6]]], '%': [[[4, 0], [0, 6]], arc(0.9, 1.1, 0.8, 1, 0, 360), arc(3.1, 4.9, 0.8, 1, 0, 360)], '#': [[[1.4, 0.4], [1, 5.6]], [[3, 0.4], [2.6, 5.6]], [[0, 2], [4, 2]], [[0, 4], [4, 4]]],
};
const chaikin = (pts, closed, it = 2) => { let P = pts; for (let k = 0; k < it; k++) { const out = closed ? [] : [P[0]]; const n = P.length - (closed ? 0 : 1);
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % P.length]; out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
  if (!closed) out.push(P.at(-1)); P = out; } return P; };
/* outline loops (glyph units) of a centre-line stroke of width w: one loop for an open stroke (round caps), two (outer, inner) for a closed one. Cached. */
const loopCache = new Map();
export function strokeOutline(pts, w) {
  const key = JSON.stringify([pts, w]); if (loopCache.has(key)) return loopCache.get(key);
  const closed = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.05, P = chaikin(closed ? pts.slice(0, -1) : pts, closed), n = P.length, h = w / 2;
  const nrm = P.map((q, i) => { const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  const L = P.map((q, i) => [q[0] + nrm[i][0] * h, q[1] + nrm[i][1] * h]), R = P.map((q, i) => [q[0] - nrm[i][0] * h, q[1] - nrm[i][1] * h]);
  let loops;
  if (closed) loops = [L, R];
  else { const cap = (q, nv, dir) => { const a0 = Math.atan2(nv[1], nv[0]); return Array.from({ length: 7 }, (_, k) => { const a = a0 + (dir * Math.PI * (k + 1)) / 8; return [q[0] + h * Math.cos(a), q[1] + h * Math.sin(a)]; }); };
    loops = [[...L, ...cap(P[n - 1], nrm[n - 1], -1), ...R.slice().reverse(), ...cap(P[0], [-nrm[0][0], -nrm[0][1]], -1)]]; }
  loopCache.set(key, loops); return loops;
}

export const GLYPH_R45 = {
  'type.asciiMosaic': { file: 'type/gfx/r45-glyph.js', tags: ['type', 'ascii', 'mosaic', 'glyph-portrait', 'text-as-image', 'prompt', 'generative', 'reveal'], dur: 4.6, inF: 6, outF: 10,
    d: { text: 'a quiet figure in warm side light, soft shadows, film grain, a calm look toward the window', image: 'bust', mode: 'text', cols: 72, area: [0.2, 0.06, 0.6, 0.88], levels: 10, gamma: 1,
      lineSize: 40, lineChars: 46, scatterAt: 0.35, scatter: 0.6, settleAt: 0.9, settle: 1.1, spread: 0.7, dissolveAt: null, dissolve: 0.9, ink: '#F6E7D2', dim: '#2E2824', accent: null, font: MONO, weight: 600, seed: 4 },
    svg(L, p, c) {
      const u = L.u, G = asciiMosaicGrid(p, c), chars = [...String(p.text)], n = chars.length, LS = p.lineSize * c.s, groups = new Map(), A = mosaicAnim(p, c, G), cols = new Map();
      const colOf = (q, qs) => { const k = q * 16 + Math.round(qs * 6); if (!cols.has(k)) { const lev = q / (p.levels - 1); cols.set(k, mixHex(p.ink, mixHex(p.dim, p.accent && lev > 0.85 ? p.accent : p.ink, lev), qs)); } return cols.get(k); };
      for (const cell of G.cells) {
        const i = cell.i, a0 = A[i], copy = i >= n;
        const kA = E.soft(seg(u, p.scatterAt + a0.d0, p.scatterAt + a0.d0 + p.scatter)); if (copy && kA < 0.02) continue;
        const kB = E.hero(seg(u, p.settleAt + a0.dl, p.settleAt + a0.dl + p.settle)), kD = p.dissolveAt == null ? 0 : E.move(seg(u, p.dissolveAt + a0.dl * 0.6, p.dissolveAt + a0.dl * 0.6 + p.dissolve));
        let x = lerp(lerp(a0.lx, a0.sx, kA), cell.x, kB), y = lerp(lerp(a0.ly, a0.sy, kA), cell.y, kB); if (kD > 0) { x = lerp(cell.x, a0.lx, kD); y = lerp(cell.y, a0.ly, kD); }
        const settled = kB * (1 - kD), a = (copy ? kA * (1 - kD) : 1) * (p.mode === 'text' && settled > 0.98 && cell.lum < 0.04 ? 0 : 1); if (a < 0.02) continue;
        const qa = Math.round(a * 4) / 4, qs = Math.round(settled * 6) / 6, col = colOf(cell.q, qs), size = lerp(LS, G.fs, qs), key = col + '|' + qs + '|' + qa;
        if (!groups.has(key)) groups.set(key, { col, size, qa, items: [] });
        groups.get(key).items.push(`<text x="${f2(x)}" y="${f2(y)}">${esc(copy || settled > 0.5 ? cell.ch : chars[i % n])}</text>`);
      }
      let out = ''; for (const g of groups.values()) out += `<g fill="${g.col}" font-size="${f2(g.size)}" text-anchor="middle"${g.qa < 1 ? ` opacity="${g.qa}"` : ''}>${g.items.join('')}</g>`;
      return `<g font-family="${esc(p.font)}" font-weight="${p.weight}" opacity="${f2(op(L))}">${out}</g>`; } },

  'type.textOnPath': { file: 'type/gfx/r45-glyph.js', tags: ['type', 'text-on-path', 'curve', 'follow', 'kinetic', 'arc-length', 'icon-trail'], dur: 3, inF: 6, outF: 8,
    d: { text: 'search everything you have ever saved', path: 'swoop', closed: false, pathBox: [1920, 1080], mode: 'trail', start: 0, end: 0.92, delay: 0.1, travel: 2.2, ease: 'cam', speed: 260,
      gap: 0.5, size: 52, weight: 700, font: FONT, ls: 0, color: INK, fade: 0.8, leader: 'icon', leaderSize: 1.9, leaderColor: BRAND, showPath: false, pathColor: 'rgba(14,14,20,0.18)' },
    svg(L, p, c) {
      const S = p.size * c.s, st = textOnPathState(L.u, p, c); let out = '';
      if (p.showPath) out += `<path d="${'M' + st.tab.pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' L')}" fill="none" stroke="${p.pathColor}" stroke-width="${f2(2 * c.s)}" stroke-dasharray="${f2(6 * c.s)} ${f2(8 * c.s)}"/>`;
      for (const g of st.glyphs) if (g.op > 0.01) out += `<text transform="translate(${f2(g.x)} ${f2(g.y)}) rotate(${f2(g.a)})" y="${f2(S * 0.34)}" text-anchor="middle"${g.op < 0.995 ? ` opacity="${f2(g.op)}"` : ''}>${esc(g.ch)}</text>`;
      out = `<g font-family="${esc(p.font)}" font-size="${f2(S)}" font-weight="${p.weight}" fill="${p.color}">${out}</g>`;
      if (st.lead && p.leader && L.u >= p.delay) { const z = p.leaderSize * S, tilt = clamp(st.lead.a * 180 / Math.PI, -40, 40) * 0.35;
        const body = p.leader === 'dot' ? `<circle r="${f2(z * 0.3)}" fill="${p.leaderColor}"/>` : p.leader.svg ? `<svg x="${f2(-z / 2)}" y="${f2(-z / 2)}" width="${f2(z)}" height="${f2(z)}" viewBox="${p.leader.viewBox || '0 0 100 100'}">${p.leader.svg}</svg>` :
          `<rect x="${f2(-z / 2)}" y="${f2(-z / 2 + z * 0.06)}" width="${f2(z)}" height="${f2(z)}" rx="${f2(z * 0.24)}" fill="#000" opacity="0.18"/><rect x="${f2(-z / 2)}" y="${f2(-z / 2)}" width="${f2(z)}" height="${f2(z)}" rx="${f2(z * 0.24)}" fill="${p.leaderColor}"/>` +
            `<g transform="translate(${f2(-z * 0.3)} ${f2(-z * 0.3)}) scale(${((z * 0.6) / 100).toFixed(4)})"><path d="${DEFAULT_MARK}" fill="#FFFFFF"/></g>`;
        out += `<g transform="translate(${f2(st.lead.x)} ${f2(st.lead.y)}) rotate(${f2(tilt)})">${body}</g>`; }
      return `<g opacity="${f2(op(L))}">${out}</g>`; } },

  'type.electricOutline': { file: 'type/gfx/r45-glyph.js', tags: ['type', 'electric', 'neon', 'outline', 'chapter-mark', 'numerals', 'crackle', 'talking-head'], dur: 2.4, inF: 1, outF: 8,
    d: { text: '1', size: 300, at: [0.78, 0.42], weight: 0.95, tilt: -6, color: '#8FE6FF', core: '#FFFFFF', line: 3, glow: 9, glowOp: 0.95, draw: 0.55, stagger: 0.12, jitter: 2.6,
      crackleFps: 15, hand: 0.035, bolts: 3, boltLen: 0.42, boltOn: 0.55, spacing: 1.5, seed: 7 },
    svg(L, p, c) {
      const u = L.u, cap = p.size * c.s, un = cap / 6, id = uidOf('electricOutline', p), chars = [...String(p.text).toUpperCase()], adv = (4 + p.spacing) * un, tw = chars.length * adv - p.spacing * un;
      const x0 = p.at[0] * c.W - tw / 2, y0 = p.at[1] * c.H - cap / 2, fb = Math.floor(frameOf(u) / Math.max(1, Math.round(FR / p.crackleFps))), tr = (p.tilt * Math.PI) / 180, cx = p.at[0] * c.W, cy = p.at[1] * c.H;
      const rot = ([x, y]) => [cx + (x - cx) * Math.cos(tr) - (y - cy) * Math.sin(tr), cy + (x - cx) * Math.sin(tr) + (y - cy) * Math.cos(tr)];
      let core = '', bolts = '', si = 0;
      chars.forEach((ch, gi) => { const strokes = STROKE_FACE[ch]; if (!strokes) return; const gx = x0 + gi * adv;
        strokes.forEach((st, k) => { const hw = p.hand * 6, hand = st.map(([x, y], j) => [x + (hashf(gi, k, j, p.seed) - 0.5) * hw, y + (hashf(gi, k, j, p.seed + 1) - 0.5) * hw]);
          const kd = E.soft(seg(u, si * p.stagger, si * p.stagger + p.draw)); si++; if (kd <= 0) return;
          strokeOutline(hand, p.weight).forEach((loop, li) => { const pts = loop.map(([x, y], j) => { const jx = (hashf(gi, k, li, j, fb, p.seed) - 0.5) * 2 * p.jitter * c.s, jy = (hashf(gi, k, li, j, fb, p.seed + 3) - 0.5) * 2 * p.jitter * c.s; return rot([gx + x * un + jx, y0 + y * un + jy]); });
            core += `<path d="M${pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' L')} Z" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - kd))}"/>`;
            if (kd > 0.95) for (let b = 0; b < p.bolts; b++) { if (hashf(gi, k, li, b, fb, p.seed + 9) > p.boltOn) continue; const j0 = Math.floor(hashf(gi, k, li, b, fb, p.seed + 11) * pts.length), [bx, by] = pts[j0];
              let a = Math.atan2(by - cy, bx - cx) + (hashf(b, fb, j0, p.seed) - 0.5) * 0.8, x = bx, y = by, d = `M${f2(x)} ${f2(y)}`; const len = (p.boltLen * cap) / 4;
              for (let q = 0; q < 4; q++) { a += (hashf(b, q, fb, j0, p.seed + 13) - 0.5) * 1.3; const l = len * (0.6 + 0.8 * hashf(b, q, fb, p.seed + 17)); x += Math.cos(a) * l; y += Math.sin(a) * l; d += ` L${f2(x)} ${f2(y)}`; }
              bolts += `<path d="${d}"/>`; } }); }); });
      if (!core) return '';
      const gl = p.glow * c.s, lw = p.line * c.s;
      return `<defs>${blurDef(id + 'g', gl)}</defs><g fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="${f2(1 - L.out)}">` +
        `<g stroke="${p.color}" stroke-width="${f2(lw * 3.2)}" opacity="${f2(p.glowOp)}"${blurAttr(id + 'g', gl)}>${core}${bolts}</g><g stroke="${p.color}" stroke-width="${f2(lw * 1.7)}">${core}</g>` +
        `<g stroke="${p.core}" stroke-width="${f2(lw * 0.7)}">${core}</g><g stroke="${p.core}" stroke-width="${f2(lw * 0.5)}">${bolts}</g></g>`; } },
};
/* per-action cues (local s). type.electricOutline uses sfx/tx/glitch_stutter (zzt bursts, the closest electric sound in the pack today); an electric-arc
   sound is being added separately (elec/arc), swap the id here when it lands. */
export const GLYPH_R45_CUES = {
  'type.asciiMosaic': (p) => [{ t: p.scatterAt, id: 'sfx/whoosh/magic_swirl', why: 'characters scatter' }, { t: p.settleAt + p.spread * 0.5, id: 'sfx/sizzle/grain', why: 'glyphs settle into the picture' },
    ...(p.dissolveAt == null ? [] : [{ t: p.dissolveAt, id: 'sfx/whoosh/swish_s', why: 'mosaic dissolves back to text' }])],
  'type.textOnPath': (p) => [{ t: p.mode === 'travel' ? 0 : p.delay, id: p.mode === 'trail' ? 'sfx/whoosh/flyby' : 'sfx/whoosh/swish_s', why: p.mode === 'trail' ? 'leader flies the curve' : 'text runs along the path' }],
  'type.electricOutline': (p) => [{ t: 0, id: 'sfx/tx/glitch_stutter', why: 'outline crackles on (electric arc stand-in)' }],
};
