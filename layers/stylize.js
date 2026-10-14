/* motion-pack / layers / stylize.js: two parametric LOOK filters that remap a plate's luminance (2026-10-14). Owned code, no assets. No DOM at module scope.
     duotone        luminance -> two colours (shadow -> `dark`, highlight -> `light`), linear contrast about `pivot`.
                    Archival photos on one accent; white-line blueprint art on an accent field = swap the colours (dark: paper, light: accent).
     threshold1bit  1-bit (two-colour) threshold with optional ORDERED dithering (Bayer 4x4 / 8x8, cell size in px @1080).
   Four emitters, identical maths (display-referred: sRGB-encoded in, sRGB-encoded out; Rec.709 luma weights on the encoded values):
     stylizePixel(kind, r, g, b, x, y, params, {H})   JS reference, one pixel (0..1 floats; x, y = pixel coordinates for the dither phase)
     stylizeImageData(imageData, kind, params, {H})   canvas back-end (in place); pure function of the source pixels
     toSVGFilter(kind, params, id, {H})               SVG <filter> for HyperFrames DOM (CSS `filter: url(#id)` on a wrapper of <img>/<video>/text).
                                                      Fully synchronous: the Bayer tile is built from feFlood + feMerge + feTile (no feImage, nothing to load),
                                                      so the first rendered frame already carries the dither.
     toCube('duotone', params)                        .cube 3D LUT for ffmpeg lut3d / NLEs (duotone only: dithering is spatial, a LUT cannot hold it)
   mountLook(el, kind, params, {H}) injects the filter into the page and points `el.style.filter` at it; a look has no time input, so it is seek-safe by construction.
   Rule (same as grades and looks): ONE look per piece; it replaces the genre grade. Opaque sources only (the SVG path works on premultiplied colour). */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const LUMA = [0.2126, 0.7152, 0.0722];
export const hexRGB = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
/* last primitive of every filter: the output keeps the source's coverage (the Bayer tile is generated content and would otherwise paint the whole
   filter region, even where the source is transparent or a timed clip is hidden) */
const KEEP_ALPHA = '<feComposite in2="SourceGraphic" operator="in"/>';
const f5 = (a) => a.map((v) => (+v).toFixed(5)).join(' ');

export const STYLIZE = {
  duotone: { tags: ['duotone', 'archive', 'blueprint', 'accent', 'two-colour', 'launch'], d: { dark: '#4A18ED', light: '#F5F2EA', contrast: 1, pivot: 0.5 },
    doc: 'luminance -> two colours: shadow -> dark, highlight -> light; contrast about pivot. Swap the colours for white line art on an accent field.' },
  threshold1bit: { tags: ['threshold', '1-bit', 'dither', 'bayer', 'print', 'archive'], d: { threshold: 0.5, dither: 'bayer4', dark: '#111111', light: '#F5F2EA', cell: 2, spread: 1 },
    doc: '1-bit two-colour threshold; dither none | bayer4 | bayer8 (ordered), cell = dither cell in px at 1080p, spread = dither amplitude (1 = classic ordered dither).' },
};
export const STYLIZE_KINDS = Object.keys(STYLIZE);
export const DITHERS = ['none', 'bayer4', 'bayer8'];

/* Bayer index matrix of size n = 2^k, values 0 .. n*n-1, row-major [y][x]. Recursive definition M2n = [[4M+0, 4M+2], [4M+3, 4M+1]]. */
export function bayer(n) {
  const k = Math.round(Math.log2(n)); if (2 ** k !== n || k < 1) throw new Error('bayer: n must be a power of two >= 2');
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => { let v = 0; for (let i = 0; i < k; i++) { const xb = (x >> i) & 1, yb = (y >> i) & 1; v += 4 ** (k - 1 - i) * ((xb ^ yb) * 2 + yb); } return v; }));
}
const MAT = { bayer4: bayer(4), bayer8: bayer(8) };
const params = (kind, p = {}) => { const s = STYLIZE[kind]; if (!s) throw new Error('unknown look ' + kind + ' (stylize kinds: ' + STYLIZE_KINDS.join(', ') + ')');
  const o = { ...s.d, ...p }; if (kind === 'threshold1bit' && !DITHERS.includes(o.dither)) throw new Error('threshold1bit: dither must be one of ' + DITHERS.join(' | ')); return o; };
export const cellPx = (p, H = 1080) => Math.max(1, Math.round((p.cell ?? 2) * H / 1080));
/* the dither threshold offset B in (0, 1) for pixel (x, y): (index + 0.5) / n^2; 0.5 when dither is none */
export function ditherAt(p, x, y, H = 1080) { if (p.dither === 'none') return 0.5; const M = MAT[p.dither], n = M.length, c = cellPx(p, H); return (M[Math.floor(y / c) % n][Math.floor(x / c) % n] + 0.5) / (n * n); }

/* JS reference, one pixel. r, g, b in 0..1 (sRGB-encoded). returns [r, g, b] */
export function stylizePixel(kind, r, g, b, x = 0, y = 0, pIn = {}, { H = 1080 } = {}) {
  const p = params(kind, pIn), L = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b, D = hexRGB(p.dark), Lt = hexRGB(p.light);
  if (kind === 'duotone') { const t = clamp((L - p.pivot) * p.contrast + 0.5); return D.map((d, i) => d + (Lt[i] - d) * t); }
  const v = L - p.spread * (ditherAt(p, x, y, H) - 0.5);
  return v >= p.threshold ? Lt : D;
}
/* canvas back-end: ImageData in place (RGBA 0..255). Same maths as stylizePixel. */
export function stylizeImageData(img, kind, pIn = {}, { H = img.height } = {}) {
  const p = params(kind, pIn), d = img.data, W = img.width, D = hexRGB(p.dark).map((v) => Math.round(v * 255)), Lt = hexRGB(p.light).map((v) => Math.round(v * 255));
  for (let y = 0; y < img.height; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, L = (LUMA[0] * d[i] + LUMA[1] * d[i + 1] + LUMA[2] * d[i + 2]) / 255;
    if (kind === 'duotone') { const t = clamp((L - p.pivot) * p.contrast + 0.5); for (let c = 0; c < 3; c++) d[i + c] = Math.round(D[c] + (Lt[c] - D[c]) * t); }
    else { const on = L - p.spread * (ditherAt(p, x, y, H) - 0.5) >= p.threshold, C = on ? Lt : D; d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; } }
  return img;
}
/* SVG filter. Every primitive clamps its output to 0..1, which the maths relies on (contrast clamp, threshold). */
export function toSVGFilter(kind, pIn = {}, id = 'mp-' + kind, { H = 1080 } = {}) {
  const p = params(kind, pIn), D = hexRGB(p.dark), Lt = hexRGB(p.light), [r, g, b] = LUMA;
  const lin = (sl, ic) => `<feFuncR type="linear" slope="${sl[0].toFixed(5)}" intercept="${ic[0].toFixed(5)}"/><feFuncG type="linear" slope="${sl[1].toFixed(5)}" intercept="${ic[1].toFixed(5)}"/><feFuncB type="linear" slope="${sl[2].toFixed(5)}" intercept="${ic[2].toFixed(5)}"/>`;
  const colours = `<feComponentTransfer>${lin(D.map((d, i) => Lt[i] - d), D)}</feComponentTransfer>`;   // t (grey) -> dark + (light - dark) t, per channel
  const open = `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">`;
  if (kind === 'duotone') {
    const c = p.contrast, k = 0.5 - p.pivot * c;   // t = clamp(c L + 0.5 - c pivot)
    return open + `<feColorMatrix in="SourceGraphic" type="matrix" values="${f5([c * r, c * g, c * b, 0, k, c * r, c * g, c * b, 0, k, c * r, c * g, c * b, 0, k, 0, 0, 0, 0, 1])}"/>` + colours + KEEP_ALPHA + '</filter>';
  }
  /* threshold1bit: grey = L - spread (B - 0.5) + (0.5 - threshold), then a discrete 0 | 1 step at 0.5, then the two colours.
     feComposite arithmetic also runs on alpha (premultiplied), so the tile carries Binv = 1 - B and every k is positive except k4: alpha = 1 + spread + k4 >= 1 and clamps to 1. */
  const luma = `<feColorMatrix in="SourceGraphic" type="matrix" values="${f5([r, g, b, 0, 0, r, g, b, 0, 0, r, g, b, 0, 0, 0, 0, 0, 0, 1])}" result="L"/>`;
  const step = '<feComponentTransfer><feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/></feComponentTransfer>';
  if (p.dither === 'none') {
    const k4 = 0.5 - p.threshold;
    return open + luma + `<feComponentTransfer>${lin([1, 1, 1], [k4, k4, k4])}</feComponentTransfer>` + step + colours + KEEP_ALPHA + '</filter>';
  }
  const M = MAT[p.dither], n = M.length, c = cellPx(p, H), floods = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = Math.round((1 - (M[y][x] + 0.5) / (n * n)) * 255); floods.push(`<feFlood x="${x * c}" y="${y * c}" width="${c}" height="${c}" flood-color="rgb(${v},${v},${v})" result="b${y * n + x}"/>`); }
  const tile = floods.join('') + `<feMerge x="0" y="0" width="${n * c}" height="${n * c}" result="tile">${floods.map((_, i) => `<feMergeNode in="b${i}"/>`).join('')}</feMerge><feTile in="tile" result="B"/>`;
  const k3 = p.spread, k4 = 0.5 - p.threshold - p.spread * 0.5;   // L + spread (1 - B) + k4 == L - spread (B - 0.5) + 0.5 - threshold
  return open + luma + tile + `<feComposite in="L" in2="B" operator="arithmetic" k1="0" k2="1" k3="${k3.toFixed(5)}" k4="${k4.toFixed(5)}"/>` + step + colours + KEEP_ALPHA + '</filter>';
}
/* .cube for ffmpeg lut3d (duotone only) */
export function toCube(kind, pIn = {}, title = 'motion-pack ' + kind, size = 33) {
  if (kind !== 'duotone') throw new Error('toCube: only duotone is a pure colour map (threshold1bit dithers spatially; dither none would alias in a LUT)');
  const out = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) out.push(stylizePixel(kind, r / (size - 1), g / (size - 1), b / (size - 1), 0, 0, pIn).map((v) => v.toFixed(6)).join(' '));
  return out.join('\n') + '\n';
}
/* DOM: inject the filter (one hidden <svg> per look) and apply it to `el`. Returns { id, update(params), dispose() }. */
let uid = 0;
export function mountLook(el, kind, pIn = {}, { H = 1080, id = null } = {}) {
  const doc = el.ownerDocument, fid = id || `mp-look-${kind}-${++uid}`, svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute'; doc.body.appendChild(svg);
  const set = (p) => { svg.innerHTML = toSVGFilter(kind, p, fid, { H }); el.style.filter = `url(#${fid})`; };
  set(pIn);
  return { id: fid, update(p) { set(p); return this; }, dispose() { svg.remove(); if (el.style.filter === `url(#${fid})`) el.style.filter = ''; } };
}

/* ---- look.gradeIn (2026-10-14, round 3): an ANIMATED look. A gradient map (luminance -> N colour stops, evenly spaced; 2 stops = a duotone)
   resolves to the natural colour over a duration (or the reverse), keyed by t alone:
     w(t) = amount * (1 - ease(seg(t, at, at + dur)))   (reverse: amount * ease(...)) = weight of the gradient map; out = w * map(L) + (1 - w) * src.
   Emitters (same maths): gradeInPixel (JS reference), gradeInImageData (canvas), gradeInSVG (filter: luma matrix -> feComponentTransfer table ->
   feComposite arithmetic k2 = w, k3 = 1 - w), mountGradeIn(el, params) -> { render(t) } (only the two arithmetic weights change per frame: cheap,
   seek-safe), gradeInCube(params, w) (.cube for one fixed weight). Display-referred like duotone; opaque sources only. */
const EASES_GI = { lin: (x) => x, soft: (x) => x * x * (3 - 2 * x), hero: (x) => 1 - (1 - x) ** 3, sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x), expoOut: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)) };
export const GRADE_IN = { tags: ['grade', 'gradient-map', 'duotone', 'reveal', 'colour', 'animated', 'launch', 'memory'],
  d: { stops: ['#1B1340', '#E0457B', '#FFD9A8'], at: 0, dur: 1.2, ease: 'soft', reverse: false, amount: 1, contrast: 1, pivot: 0.5 },
  doc: 'stops = gradient-map colours from shadow to highlight (2 = duotone); the map resolves to natural colour from at over dur (reverse: natural -> map); ease lin | soft | hero | sine | expoOut; amount = map weight at full; contrast about pivot' };
const giP = (p = {}) => { const o = { ...GRADE_IN.d, ...p }; if (!Array.isArray(o.stops) || o.stops.length < 2) throw new Error('gradeIn: stops needs >= 2 colours'); if (!EASES_GI[o.ease]) throw new Error('gradeIn: ease must be one of ' + Object.keys(EASES_GI).join(' | ')); return o; };
/* weight of the gradient map at t (1 = all map, 0 = natural) */
export function gradeInWeight(t, pIn = {}) { const p = giP(pIn), u = p.dur > 0 ? clamp((t - p.at) / p.dur) : t >= p.at ? 1 : 0, k = EASES_GI[p.ease](u); return p.amount * (p.reverse ? k : 1 - k); }
/* gradient map of a luminance value (0..1) -> [r, g, b]; same piecewise-linear interpolation as SVG feFunc type="table" */
export function gradientMap(L, stops, { contrast = 1, pivot = 0.5 } = {}) {
  const C = stops.map(hexRGB), n = C.length - 1, x = clamp((L - pivot) * contrast + 0.5) * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
  return [0, 1, 2].map((c) => C[k][c] + (C[k + 1][c] - C[k][c]) * f);
}
export function gradeInPixel(r, g, b, t, pIn = {}, w = null) {
  const p = giP(pIn), W = w ?? gradeInWeight(t, p), m = gradientMap(LUMA[0] * r + LUMA[1] * g + LUMA[2] * b, p.stops, p);
  return [r, g, b].map((v, i) => clamp(W * m[i] + (1 - W) * v));
}
export function gradeInImageData(img, t, pIn = {}) {
  const p = giP(pIn), w = gradeInWeight(t, p), d = img.data; if (w <= 0) return img;
  for (let i = 0; i < d.length; i += 4) { const o = gradeInPixel(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, t, p, w); d[i] = Math.round(o[0] * 255); d[i + 1] = Math.round(o[1] * 255); d[i + 2] = Math.round(o[2] * 255); }
  return img;
}
export function gradeInSVG(pIn = {}, id = 'mp-gradeIn', w = 1) {
  const p = giP(pIn), [r, g, b] = LUMA, c = p.contrast, k = 0.5 - p.pivot * c, C = p.stops.map(hexRGB), tv = (ch) => C.map((v) => v[ch].toFixed(5)).join(' ');
  return `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">` +
    `<feColorMatrix in="SourceGraphic" type="matrix" values="${f5([c * r, c * g, c * b, 0, k, c * r, c * g, c * b, 0, k, c * r, c * g, c * b, 0, k, 0, 0, 0, 0, 1])}"/>` +
    `<feComponentTransfer result="gm"><feFuncR type="table" tableValues="${tv(0)}"/><feFuncG type="table" tableValues="${tv(1)}"/><feFuncB type="table" tableValues="${tv(2)}"/></feComponentTransfer>` +
    `<feComposite id="${id}-mix" in="gm" in2="SourceGraphic" operator="arithmetic" k1="0" k2="${w.toFixed(5)}" k3="${(1 - w).toFixed(5)}" k4="0"/>` + KEEP_ALPHA + '</filter>';
}
export function gradeInCube(pIn = {}, w = 1, title = 'motion-pack gradeIn', size = 33) {
  const out = [`TITLE "${title} w=${(+w).toFixed(3)}"`, `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) out.push(gradeInPixel(r / (size - 1), g / (size - 1), b / (size - 1), 0, pIn, w).map((v) => v.toFixed(6)).join(' '));
  return out.join('\n') + '\n';
}
/* DOM: inject the filter once; render(t) sets the two arithmetic weights from t alone (at w = 0 the filter is removed, so the natural frame is untouched) */
let giUid = 0;
export function mountGradeIn(el, pIn = {}, { id = null } = {}) {
  const doc = el.ownerDocument, fid = id || `mp-gradein-${++giUid}`, svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); let p = giP(pIn);
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute'; doc.body.appendChild(svg);
  const build = () => { svg.innerHTML = gradeInSVG(p, fid, 1); }; build();
  const api = { id: fid, weight: (t) => gradeInWeight(t, p),
    render(t) { const w = gradeInWeight(t, p), m = svg.querySelector('feComposite[operator="arithmetic"]'); m.setAttribute('k2', w.toFixed(5)); m.setAttribute('k3', (1 - w).toFixed(5)); el.style.filter = w > 1e-4 ? `url(#${fid})` : ''; return api; },
    update(q) { p = giP({ ...p, ...q }); build(); return api; }, dispose() { svg.remove(); if (el.style.filter === `url(#${fid})`) el.style.filter = ''; } };
  return api;
}
