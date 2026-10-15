/* motion-pack / layers / canvas2d-film.js: film-lane Canvas2D layers (2026-10-16). Owned code, no assets. Merged into canvas2d.js K2D, so they mount through
   overlay.js mountStack like every other kind. Pure functions of t (no clock, no Math.random, no history); seeded hashes only.
     filmBurn         an organic film burn for transitions: a hashed fbm field on a coarse grid (96 x 54 at 16:9, the long side 96 cells), domain-warped by t,
                      burns from an edge or a point; the front glows (white-hot core -> orange -> deep red), the coverage peaks ON `at` (put `at` on the cut frame),
                      then retracts. Screen blend: it brightens, never darkens. Coverage at the peak is `peak` (0.92: nearly the whole frame).
     anamorphicFlare  a horizontal anamorphic streak through a moving light source with a soft core, a thin hot line and 3 ghost ovals mirrored through the
                      frame centre; `path` = [[t, x, y], ...] (frame fractions, local seconds) or a left-to-right sweep from `sweepFrom` to `sweepTo` over `dur`.
   burnState(t, p) / flareState(t, p) expose the maths (tests, and a host that times a cut or a sound to the peak). cuesFilm(kind, p) gives one sound per action. */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const hexRGB = (h) => { const s = String(h).replace('#', ''), n = parseInt(s.length === 3 ? [...s].map((c) => c + c).join('') : s, 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 160, 60]; };
/* 2-D value noise (hashed integer lattice, smoothstep interpolation) and a 4-octave fbm, 0..1 */
function vn2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hashf(xi, yi, s), b = hashf(xi + 1, yi, s), c = hashf(xi, yi + 1, s), d = hashf(xi + 1, yi + 1, s); return lerp(lerp(a, b, u), lerp(c, d, u), v); }
export function fbm(x, y, s) { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { v += a * vn2(x * f, y * f, s + o * 101); a *= 0.5; f *= 2.03; } return v / 0.9375; }

/* ------------------------------------------------------------------------------------------------------------------------------------ filmBurn */
const BURN_D = { at: 1.0, dur: 0.9, peak: 0.78, from: 'left', origin: [0.15, 0.5], scale: 3.2, warp: 0.55, speed: 0.6, colors: ['#FFF4D6', '#FF9A2E', '#C2310C'], glow: 1, cells: 96, intensity: 1, seed: 11 };
/* coverage 0..peak: rises on an ease-in to the peak exactly at `at`, then falls on an ease-out (the next shot is revealed through the retreating burn) */
export function burnState(t, raw = {}) {
  const p = { ...BURN_D, ...raw }, h = Math.max(0.05, p.dur / 2), u = t - p.at;
  if (u <= -h || u >= h) return { on: false, cover: 0, p };
  const k = u < 0 ? 1 - (-u / h) : 1 - u / h, cover = p.peak * (u < 0 ? k * k * (3 - 2 * k) : Math.pow(k, 1.4));
  return { on: cover > 1e-4, cover, k, p };
}
function burnBias(p, x, y, A) {   // 0 at the origin edge / point, 1 far from it (x, y in 0..1)
  if (p.from === 'point') { const dx = (x - p.origin[0]) * A, dy = y - p.origin[1]; return clamp(Math.hypot(dx, dy) / Math.hypot(A, 1)); }
  return clamp(p.from === 'right' ? 1 - x : p.from === 'top' ? y : p.from === 'bottom' ? 1 - y : x);
}
function drawBurn(g, W, H, t, raw, seed) {
  const S = burnState(t, raw); if (!S.on) return; const p = S.p, A = W / H, cw = Math.max(16, Math.min(256, Math.round(p.cells))), nx = A >= 1 ? cw : Math.max(8, Math.round(cw * A)), ny = A >= 1 ? Math.max(8, Math.round(cw / A)) : cw;
  const c = (g.canvas && g.canvas.ownerDocument) ? (g.__burnBuf ||= g.canvas.ownerDocument.createElement('canvas')) : null;
  const C = p.colors.map(hexRGB), tw = t * p.speed, cover = S.cover, band = 0.16, img = c ? (c.width = nx, c.height = ny, c.getContext('2d').createImageData(nx, ny)) : { data: new Uint8ClampedArray(nx * ny * 4) };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) / nx, y = (j + 0.5) / ny, wx = fbm(x * p.scale * A + 3.1, y * p.scale + tw * 0.7, seed) * p.warp, wy = fbm(x * p.scale * A - tw * 0.5, y * p.scale + 7.7, seed + 9) * p.warp;
    const v = 0.55 * fbm(x * p.scale * A + wx * 2 + tw, y * p.scale + wy * 2, seed + 17) + 0.45 * burnBias(p, x, y, A), d = cover * 1.25 - v;   // d > 0: burnt; the front is where d crosses 0
    let r = 0, gg = 0, b = 0, a = 0;
    if (d > -band) { const q = clamp((d + band) / (band * 3.2)), front = Math.exp(-((d / band) ** 2) * 1.6) * p.glow;
      const col = q < 0.5 ? C[2].map((v0, k) => lerp(v0, C[1][k], q * 2)) : C[1].map((v0, k) => lerp(v0, C[0][k], (q - 0.5) * 2)); a = clamp(q * 0.85 + front * 0.6) * p.intensity;
      r = clamp(col[0] / 255 + front * 0.25) * 255; gg = clamp(col[1] / 255 + front * 0.2) * 255; b = clamp(col[2] / 255 + front * 0.1) * 255; }
    const o = (j * nx + i) * 4; img.data[o] = r * a; img.data[o + 1] = gg * a; img.data[o + 2] = b * a; img.data[o + 3] = 255;   // premultiplied onto black: screen blend
  }
  if (c) { c.getContext('2d').putImageData(img, 0, 0); g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, W, H); g.restore(); }
  else { g.fillStyle = `rgba(255,160,60,${clamp(cover).toFixed(3)})`; g.fillRect(0, 0, W, H); }   // node / recording contexts: one rect that carries the coverage (tests read it)
}

/* ------------------------------------------------------------------------------------------------------------------------------------ anamorphicFlare */
const FLARE_D = { at: 0, dur: 2.4, path: null, sweepFrom: [-0.15, 0.42], sweepTo: [1.15, 0.46], color: '#7FC8FF', core: '#FFFFFF', streak: 1, width: 1.0, ghosts: 3, intensity: 0.9, fadeIn: 0.25, fadeOut: 0.35, flicker: 0.06, seed: 5 };
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));
export function flareState(t, raw = {}) {
  const p = { ...FLARE_D, ...raw }, u = t - p.at;
  if (u < 0 || u > p.dur) return { on: false, p };
  let x, y;
  if (Array.isArray(p.path) && p.path.length) { const k = p.path; if (u <= k[0][0]) [x, y] = [k[0][1], k[0][2]]; else if (u >= k[k.length - 1][0]) [x, y] = [k[k.length - 1][1], k[k.length - 1][2]];
    else for (let i = 1; i < k.length; i++) if (u < k[i][0]) { const e = ease((u - k[i - 1][0]) / Math.max(1e-6, k[i][0] - k[i - 1][0])); x = lerp(k[i - 1][1], k[i][1], e); y = lerp(k[i - 1][2], k[i][2], e); break; } }
  else { const e = u / p.dur; x = lerp(p.sweepFrom[0], p.sweepTo[0], e); y = lerp(p.sweepFrom[1], p.sweepTo[1], e); }
  const env = sstep(0, p.fadeIn, u) * (1 - sstep(p.dur - p.fadeOut, p.dur, u)), fl = 1 + p.flicker * (hashf(Math.floor(t * 24), p.seed) * 2 - 1);
  return { on: env > 1e-4, x, y, k: env * fl * p.intensity, p };
}
function drawFlare(g, W, H, t, raw) {
  const S = flareState(t, raw); if (!S.on) return; const p = S.p, cx = S.x * W, cy = S.y * H, s = Math.min(W, H) / 1080, k = S.k, c = hexRGB(p.color), cc = hexRGB(p.core);
  const rgba = (q, a) => `rgba(${q[0]},${q[1]},${q[2]},${clamp(a).toFixed(4)})`;
  g.save(); g.globalCompositeOperation = 'lighter';
  const half = 1.25 * Math.max(W, H) * p.streak;   // the streak: a horizontal band, long falloff along x, thin gaussian across y
  for (const [hgt, a] of [[34 * s * p.width, 0.18], [9 * s * p.width, 0.42], [2.2 * s * p.width, 0.9]]) {
    const lg = g.createLinearGradient(cx - half, 0, cx + half, 0); lg.addColorStop(0, rgba(c, 0)); lg.addColorStop(0.42, rgba(c, a * 0.35 * k)); lg.addColorStop(0.5, rgba(a > 0.8 ? cc : c, a * k)); lg.addColorStop(0.58, rgba(c, a * 0.35 * k)); lg.addColorStop(1, rgba(c, 0));
    g.fillStyle = lg; g.save(); g.translate(0, cy); g.scale(1, hgt / 100); g.beginPath(); g.ellipse(cx, 0, half, 100, 0, 0, TAU); g.fill(); g.restore();
  }
  const rg = g.createRadialGradient(cx, cy, 0, cx, cy, 160 * s); rg.addColorStop(0, rgba(cc, 0.85 * k)); rg.addColorStop(0.25, rgba(c, 0.35 * k)); rg.addColorStop(1, rgba(c, 0)); g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, 160 * s, 0, TAU); g.fill();
  const n = Math.max(0, Math.min(6, Math.round(p.ghosts)));   // ghosts: on the line from the source through the frame centre, mirrored, anamorphic ovals (wider than tall)
  for (let i = 0; i < n; i++) { const f = -0.35 - 0.45 * i, gx = W / 2 + (cx - W / 2) * f, gy = H / 2 + (cy - H / 2) * f, r = (40 + 34 * i) * s, a = (0.16 - 0.03 * i) * k;
    const gr = g.createRadialGradient(gx, gy, r * 0.55, gx, gy, r); gr.addColorStop(0, rgba(c, a * 0.4)); gr.addColorStop(0.8, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.save(); g.translate(gx, gy); g.scale(1.8, 1); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.restore(); g.fill(); }
  g.restore();
}

export const K2D_FILM = {
  filmBurn: { blend: 'screen', order: 18, tags: ['film-burn', 'transition', 'film', 'trailer', 'analog', 'warm'], d: BURN_D,
    doc: 'organic film burn for a transition: fbm field burning from an edge or a point, white-hot front, coverage peaks ON `at` (the cut) then retracts', draw: drawBurn },
  anamorphicFlare: { blend: 'screen', order: 13, tags: ['flare', 'anamorphic', 'lens', 'trailer', 'scifi', 'film'], d: FLARE_D,
    doc: 'anamorphic flare: horizontal streak + hot line + core glow through a moving source, 3 mirrored ghost ovals; `path` keys or a sweep', draw: drawFlare },
};
export const FILM_LIM = { filmBurn: { cells: [16, 256], scale: [0.2, 20] }, anamorphicFlare: { ghosts: [0, 6] } };
/* one sound per action, local seconds (add the layer's start): the burn's swell ends on the peak, the flare's pass sits mid-sweep */
export function cuesFilm(kind, raw = {}) {
  if (kind === 'filmBurn') { const p = { ...BURN_D, ...raw }; return [{ t: +(p.at).toFixed(4), id: 'sfx/tx/film_burn', why: 'film burn peaks on the cut' }]; }
  if (kind === 'anamorphicFlare') { const p = { ...FLARE_D, ...raw }; return [{ t: +(p.at + p.dur * 0.5).toFixed(4), id: 'sfx/whoosh/scifi_pass', why: 'flare pass' }]; }
  return [];
}
