/* motion-pack / layers / backgrounds-r78.js: background.skyClouds (xp-r78, 2026-10-16). Owned code, no assets. Merged into BG (backgrounds.js), so it mounts through
   overlay.js mountStack like every other background:  mountStack(el, [{ kind: 'skyClouds', params: { preset: 'dunes' } }], { width, height, fps })
     skyClouds   a procedural scenic plate for UI to sit on (a card on "a photo of sand dunes and sky", a prompt bar over "sky and clouds"):
                 preset 'clouds'  a sky gradient (2-3 colours, top to horizon), an optional sun glow, and layered fractal-noise clouds with a lit side and a shaded underside
                 preset 'dunes'   the same sky over 3-6 layers of sand dunes: asymmetric crests, a light face and a shade face that follow the sun side, haze towards the far ones
   Maths (all closed form, no history, no state):
     clouds   two periodic fbm layers (a near one and a far one at 0.55 x the speed, for parallax). A value-noise lattice of period P cells in x (hashed integer corners, the
              coordinates wrapped mod P * 2^octave) is evaluated at (x * aspect * S0 - drift * t, y * S0), S0 = 3 / scale cells across the height. Coverage = smoothstep of the density
              round the threshold set by `cover`; the light is the density minus the density one step towards the sun (a directional-derivative shading): a cloud is bright where the sun
              side thins out and dark where it thickens. No random call: a seeded integer hash only (`seed`).
     loop L   the drift is a whole number of lattice periods in L seconds (k * P / L cells per second, k = round(rate * L / P) >= 1 for the near layer and the far layer), so frame t and
              t + L are the same bits. The dunes' wind is the nearest whole number of cycles per L seconds per ridge. 0 = no loop.
     band     the clouds are evaluated on a coarse grid (`cells` samples on the long side, upscaled with smoothing) and the finest octave is dropped when its wavelength would be under
              3 samples (cloudOctaves), so the field cannot alias: the largest change of density between two frames at 60 fps is a small fraction of the full range (tested).
   Guards (the pack-wide policy, layers/limits.js): a bad NUMBER is sanitised, never thrown (NaN, +-Infinity, a non-numeric string, null, an object becomes the default; out-of-range numbers
   are clamped: cells <= 256, ridges <= 6, octaves <= 5), so no parameter can hang the draw or allocate without bound. A bad COLOUR (not #RGB / #RRGGBB), a bad t or frame size throw a clear
   error that names skyClouds. Pure functions of t (no clock, no Math.random, no module-level cache); two layers on one page never share anything. */
import { clamp, lerp } from './ease.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;
/* the integer hash (avalanche mix of the lattice corner and the seed): the same number in every process */
const ih = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const hexRGB = (h, what) => { const s = typeof h === 'string' ? h.trim().replace(/^#/, '') : ''; const f = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(f)) throw new Error(`skyClouds: ${what} must be a #RGB or #RRGGBB colour, got ${JSON.stringify(h)}`); const n = parseInt(f, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a).toFixed(4)})`;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * clamp(k));

/* the defaults. Colours are placeholders, not any brand's. Sizes are fractions of H (or px at 1080 where a speed is meant), so 16:9, 9:16 and 1:1 share numbers. */
export const SKY_DEFAULTS = { preset: 'clouds', sky: ['#4C8FE0', '#CFE5FF'], cover: -1, scale: 1, drift: 36, softness: 0.4, haze: 0.3, octaves: 4, cells: 160, sun: null, sunGlow: 0.6, sunSize: 0.3,
  sunColor: null, cloud: '#FFFFFF', shade: '#8FA9CF', sand: ['#F1CE96', '#DBA46A', '#B87843'], ridges: 5, height: 0.46, relief: 0.055, wind: 18, loop: 0, grain: 0, seed: 7, intensity: 1 };
const PRESET_DEFAULTS = { clouds: { cover: 0.55, sun: [0.78, 0.2], sky: ['#4C8FE0', '#CFE5FF'] }, dunes: { cover: 0.16, sun: [0.18, 0.26], sky: ['#6FA8E8', '#F8E4C2'] } };
/* [lo, hi] per numeric parameter: a value outside it is clamped, and NaN, +-Infinity, a non-numeric string, null, undefined or an object becomes the DEFAULT. layers/limits.js lists this as BG_LIM.skyClouds. */
export const SKY_RANGE = { cover: [-1, 1], scale: [0.2, 5], drift: [-2000, 2000], softness: [0, 1], haze: [0, 1], octaves: [1, 5], cells: [24, 256], sunGlow: [0, 2], sunSize: [0.02, 1], ridges: [1, 6], height: [0.1, 0.9], relief: [0, 0.4], wind: [-2000, 2000],
  loop: [0, 3600], grain: [0, 1], seed: [0, 4294967295], intensity: [0, 2] };
const INT = new Set(['octaves', 'cells', 'ridges', 'seed']);
const asNum = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
export function skyParams(pIn = {}) {
  if (pIn && pIn.__sky === true) return pIn;   // already parsed (the inner functions pass the parsed object down: no re-parse per cell)
  const preset = pIn && pIn.preset === 'dunes' ? 'dunes' : 'clouds', PD = PRESET_DEFAULTS[preset], p = { ...SKY_DEFAULTS, ...pIn, preset };
  for (const [k, [lo, hi]] of Object.entries(SKY_RANGE)) { const n = asNum(p[k]), dv = k === 'cover' ? -1 : SKY_DEFAULTS[k], v = Number.isFinite(n) ? n : dv; p[k] = INT.has(k) ? Math.round(clamp(v, lo, hi)) : clamp(v, lo, hi); }
  if (p.cover < 0) p.cover = PD.cover;   // cover < 0 (the default, -1) = the preset's own cover
  const sky = pIn && pIn.sky !== undefined && pIn.sky !== null ? pIn.sky : PD.sky; if (!Array.isArray(sky) || sky.length < 2) throw new Error('skyClouds: sky must be an array of 2 or 3 hex colours (top to horizon)');
  p.sky = sky.slice(0, 3); p.skyRGB = p.sky.map((c, i) => hexRGB(c, `sky[${i}]`)); p.cloudRGB = hexRGB(p.cloud, 'cloud'); p.shadeRGB = hexRGB(p.shade, 'shade');
  const sand = Array.isArray(p.sand) && p.sand.length >= 3 ? p.sand : SKY_DEFAULTS.sand; p.sandRGB = sand.slice(0, 3).map((c, i) => hexRGB(c, `sand[${i}]`));
  const sun = p.sun === false ? null : Array.isArray(p.sun) && p.sun.length >= 2 ? [clamp(asNum(p.sun[0]) || 0, -0.5, 1.5), clamp(asNum(p.sun[1]) || 0, -0.5, 1.5)] : PD.sun; p.sunAt = sun;
  p.sunRGB = p.sunColor == null ? [255, 244, 214] : hexRGB(p.sunColor, 'sunColor'); Object.defineProperty(p, '__sky', { value: true, enumerable: false });
  return p;
}
const dims = (W, H) => { if (!(W > 0 && H > 0 && Number.isFinite(W) && Number.isFinite(H))) throw new Error(`skyClouds: the frame must have a finite positive size, got ${W} x ${H}`); };

/* ------------------------------------------------------------------------------------------------------------------------------ clouds */
/* the lattice period (cells) and the cloud scale (cells across the height): fixed by the params, never by the aspect, so 16:9 and 9:16 show the same sky */
export const cloudS0 = (p) => 3 / p.scale;
export const cloudPeriod = (p) => Math.max(4, Math.ceil(2 * cloudS0(p) * 1.78));
/* near-layer and far-layer drift in cells per second; in a loop each is a whole number of periods per L (the nearest, at least one) unless there is no drift */
export function cloudRates(pIn) {
  const p = skyParams(pIn), P = cloudPeriod(p), base = (p.drift * cloudS0(p)) / 1080, far = base * 0.55;
  if (p.loop > 0 && base !== 0) { const q = (v) => (Math.sign(v) * Math.max(1, Math.round((Math.abs(v) * p.loop) / P)) * P) / p.loop; return { near: q(base), far: q(far), P }; }
  return { near: base, far, P };
}
/* periodic value noise: period P cells in x, hashed integer corners, smoothstep */
function vn(x, y, s, P) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = mod(xi, P), b = mod(xi + 1, P);
  return lerp(lerp(ih(a, yi, s), ih(b, yi, s), u), lerp(ih(a, yi + 1, s), ih(b, yi + 1, s), u), v); }
function fbm(x, y, s, P, oct) { let v = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 101, P * f); n += a; a *= 0.5; f *= 2; } return v / n; }
/* the finest octave kept for `nx` samples on the long side: its wavelength in samples must be >= 3 (a sample spacing of a third of the shortest wavelength) */
export function cloudOctaves(pIn, nx = 160, aspect = 16 / 9) { const p = skyParams(pIn), spc = nx / (Math.max(1, aspect) * cloudS0(p)); return Math.max(1, Math.min(p.octaves, 1 + Math.floor(Math.log2(Math.max(1, spc / 3))))); }
/* the density (0..1) at frame fraction (xf, yf) at time t, `aspect` = W / H: the two parallax layers blended */
export function cloudDensity(xf, yf, t, pIn, aspect = 16 / 9, oct = null) {
  const p = skyParams(pIn), R = cloudRates(p), S0 = cloudS0(p), o = oct || cloudOctaves(p, p.cells, aspect), u = xf * aspect * S0, v = yf * S0;
  const n = fbm(u - R.near * t, v, p.seed, R.P, o), f = fbm(u * 0.7 - R.far * t + 5.3, v * 0.7 + 2.1, p.seed + 977, R.P, o);
  return 0.62 * n + 0.38 * f;
}
/* coverage 0..1 (the alpha of the cloud) and light 0..1 at one point: the coverage thresholds the density, the light is the density minus the density one step towards the sun */
export function cloudAt(xf, yf, t, pIn, aspect = 16 / 9, oct = null) {
  const p = skyParams(pIn), f = cloudDensity(xf, yf, t, p, aspect, oct), th = lerp(0.76, 0.3, p.cover) - 0.06 * (yf - 0.4), w = 0.03 + 0.2 * p.softness, cov = sstep(th - w, th + w, f);
  const sx = p.sunAt ? p.sunAt[0] : 0.2, sy = p.sunAt ? p.sunAt[1] : -0.4, dx = sx - xf, dy = sy - yf, dl = Math.hypot(dx, dy) || 1, st = 0.14 / cloudS0(p), fs = cloudDensity(xf + (dx / dl) * st / aspect, yf + (dy / dl) * st, t, p, aspect, oct);
  const lit = clamp(0.58 + (f - fs) * 5.2 + (p.sunAt ? 0.22 * Math.exp(-(dl * dl) / 0.09) : 0));
  return { cov, lit, f };
}
/* the coarse grid the draw uses: [{x, y, cov, lit}] row-major, nx * ny (tests read it; the draw uses the same function) */
export function cloudGrid(t, pIn, nx, ny, aspect = nx / ny) { const p = skyParams(pIn), oct = cloudOctaves(p, Math.max(nx, ny), aspect), out = new Array(nx * ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out[j * nx + i] = cloudAt((i + 0.5) / nx, (j + 0.5) / ny, t, p, aspect, oct); return out; }

/* ------------------------------------------------------------------------------------------------------------------------------ dunes */
const crest = (th, ph) => 0.62 * Math.sin(th + ph) + 0.28 * Math.sin(2 * th + ph * 1.7 + 1.3) + 0.1 * Math.sin(3 * th + ph * 0.5);
/* ridge i's wind in cycles per second: scaled with depth (the near ridges move more: parallax); in a loop the nearest whole number of cycles per L (at least 1) unless the wind is 0 */
export function duneWind(pIn, i) { const p = skyParams(pIn), n = Math.max(1, p.ridges - 1), v = (p.wind / 1080) * (0.35 + 0.65 * (i / n)) * 0.5; return p.loop > 0 && v !== 0 ? (Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * p.loop))) / p.loop : v; }
/* the crest line of ridge i (0 = far, ridges - 1 = near) at frame fraction xf and time t, in px of a frame H high; asp = W / H */
export function duneProfile(t, pIn, i, xf, { H = 1080, asp = 16 / 9 } = {}) {
  const p = skyParams(pIn), n = p.ridges, top = 1 - p.height, depth = (i + 0.7) / (n + 0.2), base = top + p.height * (0.16 + 0.66 * depth ** 1.15), rel = p.relief * (0.55 + 0.9 * depth),
    fx = 0.55 + 0.9 * hashf(p.seed, i, 3) + 0.25 * i, ph = TAU * hashf(p.seed, i, 4), th = TAU * (fx * xf * asp * 0.5 + duneWind(p, i) * t);
  return H * (base - rel * crest(th, ph) * p.intensity);
}

/* ------------------------------------------------------------------------------------------------------------------------------ draw */
function sky(g, W, H, p, t) {
  const S = H / 1080, span = p.preset === 'dunes' ? 1 - p.height * 0.62 : 1, lg = g.createLinearGradient(0, 0, 0, H * span), n = p.skyRGB.length;
  p.skyRGB.forEach((c, i) => lg.addColorStop(i / (n - 1), rgba(c, 1))); g.fillStyle = lg; g.fillRect(0, 0, W, H);
  if (p.sunAt && p.sunGlow > 0) { const sx = p.sunAt[0] * W, sy = p.sunAt[1] * H, R = p.sunSize * Math.max(W, H) * 1.6, rg = g.createRadialGradient(sx, sy, 0, sx, sy, R), c = p.sunRGB;
    rg.addColorStop(0, rgba(c, 0.95 * p.sunGlow)); rg.addColorStop(Math.min(0.99, 0.08 + 0.1 * p.sunSize), rgba(c, 0.55 * p.sunGlow)); rg.addColorStop(0.4, rgba(c, 0.16 * p.sunGlow)); rg.addColorStop(1, rgba(c, 0)); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
}
function drawClouds(g, W, H, t, p) {
  if (p.cover <= 0.001) return; const A = W / H, long = Math.max(W, H), nx = Math.round(clamp(p.cells, 24, 256) * (W >= H ? 1 : W / H)), ny = Math.round(clamp(p.cells, 24, 256) * (W >= H ? H / W : 1)), NX = Math.max(8, nx), NY = Math.max(8, ny);
  const canvas = (g.canvas && g.canvas.ownerDocument) ? (g.__skyBuf ||= g.canvas.ownerDocument.createElement('canvas')) : null, oct = cloudOctaves(p, Math.max(NX, NY), A);
  const img = canvas ? (canvas.width = NX, canvas.height = NY, canvas.getContext('2d').createImageData(NX, NY)) : null, hz = p.skyRGB[p.skyRGB.length - 1], cr = p.cloudRGB, sr = p.shadeRGB, fall = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const yf = (j + 0.5) / NY, { cov, lit } = cloudAt((i + 0.5) / NX, yf, t, p, A, oct); const col = mix(mix(sr, cr, lit), hz, p.haze * 0.5 * sstep(0.5, 1, yf)), a = cov * (1 - 0.4 * p.haze * sstep(0.6, 1, yf)) * p.intensity;
    if (img) { const o = (j * NX + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = Math.round(clamp(a) * 255); } else if (i % 8 === 0 && j % 6 === 0) fall.push([i, j, col, a]);
  }
  if (canvas) { canvas.getContext('2d').putImageData(img, 0, 0); g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(canvas, 0, 0, W, H); g.restore(); }
  else for (const [i, j, col, a] of fall) { g.fillStyle = rgba(col, a); g.fillRect((i / NX) * W, (j / NY) * H, (8 / NX) * W, (6 / NY) * H); }   // recording / node contexts: a coarse rect grid that carries the same field
}
function drawDunes(g, W, H, t, p) {
  const N = 200, A = W / H, [lit, mid, dark] = p.sandRGB, hz = p.skyRGB[p.skyRGB.length - 1], n = p.ridges, sunSide = p.sunAt && p.sunAt[0] > 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const far = 1 - i / Math.max(1, n - 1), haze = p.haze * far * 0.85, base = mix(mid, hz, haze), shade = mix(mix(dark, hz, haze), mid, 0.15), light = mix(mix(lit, hz, haze), [255, 255, 255], 0.12 * (1 - far)), ys = [], xs = [];
    for (let c = 0; c <= N; c++) { const xf = c / N; xs.push(xf * W); ys.push(duneProfile(t, p, i, xf, { H, asp: A })); }
    g.save(); g.beginPath(); g.moveTo(0, H); for (let c = 0; c <= N; c++) g.lineTo(xs[c], ys[c]); g.lineTo(W, H); g.closePath(); g.fillStyle = rgba(base, 1); g.fill(); g.clip();   // the light and shade bands are clipped to the ridge, so they follow its slope exactly (no column steps)
    for (let c = 0; c < N; c++) { const slope = (ys[c + 1] - ys[c]) / (xs[c + 1] - xs[c]), face = clamp(0.5 - sunSide * slope * 2.4), col = mix(shade, light, face), yt = Math.min(ys[c], ys[c + 1]) - 2, band = H * (0.05 + 0.05 * (1 - far)) + Math.abs(ys[c + 1] - ys[c]), gr = g.createLinearGradient(0, yt, 0, yt + band);
      gr.addColorStop(0, rgba(col, 0.92)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(xs[c], yt, xs[c + 1] - xs[c] + 0.8, band); }
    g.restore();
  }
}
const sp = (t) => { if (!Number.isFinite(t)) throw new Error('skyClouds: t must be a finite number'); };

export const BG_R78 = {
  skyClouds: { blend: 'normal', order: 1, tags: ['sky', 'clouds', 'dunes', 'desert', 'scenic', 'plate', 'background', 'procedural', 'seeded', 'drift', 'ui', 'soft'],
    d: SKY_DEFAULTS,
    doc: "preset = 'clouds' | 'dunes'; sky = 2-3 hex (top to horizon); cover = 0..1 cloud cover (-1 = the preset's: 0.55 clouds, 0.16 dunes); scale = cloud size (1 = three cells across the height); drift = px per second at 1080 (negative = the other way); softness / haze 0..1; octaves 1-5 (the finest is dropped when it would alias at `cells` samples); cells = samples on the long side (24-256); sun = [x, y] frame fractions (null = the preset's, false = none), sunGlow, sunSize; cloud / shade = the lit and the shaded colour; dunes: sand = [lit, mid, shade], ridges 1-6, height (fraction of the frame the dunes fill), relief (crest amplitude, fraction of H), wind (px per second at 1080, the near ridges move more); loop = seconds for an exact repeat (0 = free-running); seed; intensity",
    draw(g, W, H, t, pIn) {
      dims(W, H); sp(t); const p = skyParams(pIn); sky(g, W, H, p, t); drawClouds(g, W, H, t, p); if (p.preset === 'dunes') drawDunes(g, W, H, t, p);
      if (p.grain > 0) { const gi = Math.floor((p.loop > 0 ? mod(t, p.loop) : t) * 24 + 1e-6), cnt = Math.min(9000, Math.round((p.grain * W * H) / 1600)), sz = Math.max(1, Math.round((1.3 * H) / 1080)); g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath();
        for (let q = 0; q < cnt; q += 2) g.rect(Math.floor(hashf(p.seed, gi, q, 1) * W), Math.floor(hashf(p.seed, gi, q, 2) * H), sz, sz); g.fill(); g.fillStyle = 'rgba(0,0,0,0.08)'; g.beginPath();
        for (let q = 1; q < cnt; q += 2) g.rect(Math.floor(hashf(p.seed, gi, q, 3) * W), Math.floor(hashf(p.seed, gi, q, 4) * H), sz, sz); g.fill(); }
    } },
};
