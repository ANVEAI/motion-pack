/* motion-pack / type / gfx / cornerpin.js: 4-point corner pin (2026-10-14). Warp an image, a UI card, a logo or a <video> onto a quad inside footage
   or a still: "logo on a window", "UI card on a laptop screen", "poster on a wall". Owned code, pure maths, seek-safe.
     homography(src4, dst4)          -> 3x3 (row-major, h33 = 1) mapping each src point to its dst point
     matrix3d(w, h, quad)            -> CSS 'matrix3d(...)' for an element w x h px with transform-origin 0 0 whose corners land on quad [TL, TR, BR, BL]
     cornersAt(t, corners | keys)    -> quad at t. Static: [[x,y] x4]. Keyframed: [{t, q:[[x,y] x4], ease?}] (piecewise, eased per segment; tracked
                                        footage = one key per frame, linear). Coordinates in px of the composition (or fractions with units:'frac').
     LAYOUT 'layout.cornerPin' (layout.js contract): at(t, p, {W, H}) -> { slots: [{ transform, transformOrigin, opacity, ... }], svg }, so
                                        applyLayout([el], state) pins el. el must be absolutely positioned at left 0, top 0, sized p.w x p.h px.
     drawQuad(g, img, quad, {grid})  -> the canvas back-end: the source split into grid x grid cells, each cell drawn as 2 affine triangles
                                        (an approximation of the projective map; 8 x 8 is sub-pixel for quads that are not extreme).
   Honest limits: no motion tracking here. Static corners, hand keys, or corners exported from a 3D scene (project the plane's corners per frame,
   see templates/demo-cards-objects) drive it. A pinned layer gets no lens blur or grain of its own: add them on top. */
import { E, clamp, lerp, seg } from '../ease.js';

const f6 = (v) => (Math.abs(v) < 1e-12 ? 0 : +v.toPrecision(10));
/* solve A x = b (n x n, Gaussian elimination with partial pivoting) */
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error('cornerPin: degenerate quad (three corners on a line?)');
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let q = c; q <= n; q++) M[r][q] -= k * M[c][q]; } }
  return M.map((r, i) => r[n] / r[i]);
}
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  const h = solve(A, b); return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
export const applyH = (H, [x, y]) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
/* CSS matrix3d is column-major 4x4; the 2D homography sits in rows/cols (x, y, w) with z passed through */
export function matrix3d(w, h, quad) {
  const H = homography([[0, 0], [w, 0], [w, h], [0, h]], quad);
  const m = [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, H[8]];
  return 'matrix3d(' + m.map(f6).join(',') + ')';
}
const isQuad = (c) => Array.isArray(c) && c.length === 4 && Array.isArray(c[0]) && typeof c[0][0] === 'number';
export function cornersAt(t, src) {
  if (isQuad(src)) return src.map((p) => [...p]);
  const keys = src; if (!keys || !keys.length) throw new Error('cornerPin: no corners');
  if (t <= keys[0].t) return keys[0].q.map((p) => [...p]); const last = keys[keys.length - 1]; if (t >= last.t) return last.q.map((p) => [...p]);
  let i = 0; while (keys[i + 1].t <= t) i++;   // keys sorted by t
  const a = keys[i], b = keys[i + 1], k = (E[b.ease] || E.lin)(seg(t, a.t, b.t));
  return a.q.map((p, j) => [lerp(p[0], b.q[j][0], k), lerp(p[1], b.q[j][1], k)]);
}
/* quad area sign + convexity: a pin onto a self-crossing quad is a bad track, not a look */
export function lintQuad(q) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), s = [0, 1, 2, 3].map((i) => cr(q[i], q[(i + 1) % 4], q[(i + 2) % 4]));
  const w = []; if (!(s.every((v) => v > 0) || s.every((v) => v < 0))) w.push('quad is not convex (corner order must be TL, TR, BR, BL)'); return w;
}
export const PIN_LAYOUTS = {
  'layout.cornerPin': { file: 'type/gfx/cornerpin.js', tags: ['layout', 'corner-pin', 'warp', 'perspective', 'logo-on-window', 'ui-on-footage', 'screen-replace'],
    d: { w: 1280, h: 800, corners: [[600, 300], [1300, 340], [1290, 760], [610, 740]], units: 'px', at: 0, fadeIn: 0, out: null, fadeOut: 0, opacity: 1, z: 3 },
    at(t, p, { W, H }) {
      let q = cornersAt(t, p.keys || p.corners); if (p.units === 'frac') q = q.map(([x, y]) => [x * W, y * H]);
      const o = p.opacity * (p.fadeIn > 0 ? seg(t, p.at, p.at + p.fadeIn) : t >= p.at ? 1 : 0) * (p.out != null ? 1 - (p.fadeOut > 0 ? seg(t, p.out, p.out + p.fadeOut) : t >= p.out ? 1 : 0) : 1);
      return { slots: [{ transformOrigin: '0 0', transform: matrix3d(p.w, p.h, q), opacity: String(+clamp(o).toFixed(4)), zIndex: String(p.z) }], svg: '', quad: q }; } },
};
/* canvas back-end: projective map approximated by grid x grid affine triangles (each clipped, expanded 0.6 px to hide seams) */
export function drawQuad(g, img, quad, { grid = 8, sw = null, sh = null } = {}) {
  const iw = sw ?? (img.naturalWidth || img.videoWidth || img.width), ih = sh ?? (img.naturalHeight || img.videoHeight || img.height); if (!iw || !ih) return;
  const Hm = homography([[0, 0], [iw, 0], [iw, ih], [0, ih]], quad), P = (x, y) => applyH(Hm, [x, y]);
  const tri = (s0, s1, s2) => { const d0 = P(...s0), d1 = P(...s1), d2 = P(...s2), cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, ex = (p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.6, p[1] + dy / l * 0.6]; };
    g.save(); g.beginPath(); const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2); g.moveTo(...e0); g.lineTo(...e1); g.lineTo(...e2); g.closePath(); g.clip();
    // affine from source triangle to destination triangle
    const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2, den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const a = ((d1[0] - d0[0]) * (y2 - y0) - (d2[0] - d0[0]) * (y1 - y0)) / den, c = ((d2[0] - d0[0]) * (x1 - x0) - (d1[0] - d0[0]) * (x2 - x0)) / den;
    const b = ((d1[1] - d0[1]) * (y2 - y0) - (d2[1] - d0[1]) * (y1 - y0)) / den, d = ((d2[1] - d0[1]) * (x1 - x0) - (d1[1] - d0[1]) * (x2 - x0)) / den;
    g.transform(a, b, c, d, d0[0] - a * x0 - c * y0, d0[1] - b * x0 - d * y0); g.drawImage(img, 0, 0, iw, ih); g.restore(); };
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) { const xa = iw * i / grid, xb = iw * (i + 1) / grid, ya = ih * j / grid, yb = ih * (j + 1) / grid; tri([xa, ya], [xb, ya], [xb, yb]); tri([xa, ya], [xb, yb], [xa, yb]); }
}
/* a DOM element pinned for the whole composition: pin = mountPin(el, params, {W, H}); bindHF(pin) */
export function mountPin(el, params = {}, { W = 1920, H = 1080 } = {}) {
  const L = PIN_LAYOUTS['layout.cornerPin'], p = { ...L.d, ...params };
  Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: p.w + 'px', height: p.h + 'px', margin: '0' });
  return { el, render(t) { const s = L.at(t, p, { W, H }).slots[0]; el.style.transformOrigin = s.transformOrigin; el.style.transform = s.transform; el.style.opacity = s.opacity; el.style.zIndex = s.zIndex; return this; } };
}
