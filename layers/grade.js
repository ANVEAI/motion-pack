/* motion-pack / layers / grade.js: ONE closed-form colour grade, four emitters (JS reference, GLSL uniforms, SVG filter, .cube LUT). No DOM. Owned code.
   Display-referred (sRGB-encoded in, sRGB-encoded out). Order, identical in every emitter:
     gain * white balance -> contrast (normalised logistic about pivot) -> ASC CDL (slope, offset, power) -> saturation (Rec.709 luma)
     -> split-tone (luminance-neutral chroma shift, shadow / highlight weights) -> fade (black lift) -> clamp                          */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const LUMA = [0.2126, 0.7152, 0.0722];
export const hue2rgb = (h) => { h = (((h / 360) % 1) + 1) % 1 * 6; return [clamp(Math.abs(h - 3) - 1), clamp(2 - Math.abs(h - 2)), clamp(2 - Math.abs(h - 4))]; };

export const GRADE_DEFAULTS = Object.freeze({
  exposure: 0, temp: 0, tint: 0, contrast: 0, pivot: 0.46, slope: [1, 1, 1], offset: [0, 0, 0], power: [1, 1, 1], sat: 1,
  split: { shadowHue: 0, shadowSat: 0, highHue: 0, highSat: 0, balance: 0 }, fade: 0,
});
const v3 = (a, d) => (Array.isArray(a) ? a : [a ?? d, a ?? d, a ?? d]);
export function normalize(p = {}) {
  const sp = { ...GRADE_DEFAULTS.split, ...(p.split || {}) };
  return { ...GRADE_DEFAULTS, ...p, slope: v3(p.slope, 1), offset: v3(p.offset, 0), power: v3(p.power, 1), split: sp };
}
/* blend two grades (used for the 12-frame crossfade between at most two grades in one piece) */
export function mixGrade(a, b, k) {
  a = normalize(a); b = normalize(b); const m = (x, y) => x + (y - x) * k, m3 = (x, y) => x.map((v, i) => m(v, y[i]));
  const hm = (h0, h1) => { let d = ((h1 - h0 + 540) % 360) - 180; return (h0 + d * k + 360) % 360; };
  return { exposure: m(a.exposure, b.exposure), temp: m(a.temp, b.temp), tint: m(a.tint, b.tint), contrast: m(a.contrast, b.contrast), pivot: m(a.pivot, b.pivot),
    slope: m3(a.slope, b.slope), offset: m3(a.offset, b.offset), power: m3(a.power, b.power), sat: m(a.sat, b.sat),
    split: { shadowHue: hm(a.split.shadowHue, b.split.shadowHue), shadowSat: m(a.split.shadowSat, b.split.shadowSat), highHue: hm(a.split.highHue, b.split.highHue), highSat: m(a.split.highSat, b.split.highSat), balance: m(a.split.balance, b.split.balance) },
    fade: m(a.fade, b.fade) };
}

/* derived constants shared by every emitter */
export function derive(pIn) {
  const p = normalize(pIn), g = 2 ** (p.exposure / 2.2);
  const wb = [g * (1 + 0.10 * p.temp), g * (1 - 0.06 * p.tint), g * (1 - 0.10 * p.temp)];
  const k = 14 * p.contrast, f = (x) => 1 / (1 + Math.exp(-k * (x - p.pivot))), f0 = k === 0 ? 0 : f(0), f1 = k === 0 ? 1 : f(1);
  const tint = (h, s) => { const c = hue2rgb(h), l = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2]; return c.map((v) => (v - l) * s * 0.5); };
  return { p, wb, k, pivot: p.pivot, f0, inv: k === 0 ? 1 : 1 / (f1 - f0), shadowT: tint(p.split.shadowHue, p.split.shadowSat), highT: tint(p.split.highHue, p.split.highSat), bal: p.split.balance };
}
const curve = (D, c, x) => {   // per-channel 1D part: gain/WB -> contrast -> CDL (clamped)
  x = clamp(x * D.wb[c]);
  if (D.k !== 0) x = (1 / (1 + Math.exp(-D.k * (x - D.pivot))) - D.f0) * D.inv;
  return clamp(Math.pow(Math.max(x * D.p.slope[c] + D.p.offset[c], 0), D.p.power[c]));
};
const satMix = (c, s) => { const l = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2]; return c.map((v) => clamp(l + (v - l) * s)); };
const splitW = (D, l) => [1 - sstep(0, 0.55 + D.bal * 0.4, l), sstep(0.45 + D.bal * 0.4, 1, l)];

/* JS reference: rgb in 0..1 -> rgb in 0..1 */
export function gradeRGB(pIn, rgb) {
  const D = pIn.__D || derive(pIn); let c = [0, 1, 2].map((i) => curve(D, i, rgb[i]));
  c = satMix(c, D.p.sat);
  const l = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2], [ws, wh] = splitW(D, l);
  c = c.map((v, i) => v + D.shadowT[i] * ws + D.highT[i] * wh);
  return c.map((v) => clamp(D.p.fade + v * (1 - D.p.fade)));
}
export const prepare = (p) => ({ ...normalize(p), __D: derive(p) });
export const isIdentity = (p) => { const q = normalize(p), d = GRADE_DEFAULTS; return q.exposure === 0 && q.temp === 0 && q.tint === 0 && q.contrast === 0 && q.sat === 1 && q.fade === 0 && q.split.shadowSat === 0 && q.split.highSat === 0 && q.slope.every((v) => v === 1) && q.offset.every((v) => v === 0) && q.power.every((v) => v === 1); };

/* GLSL uniforms (names match glsl-common.js GRADE) */
export function gradeUniforms(pIn) {
  const D = derive(pIn), p = D.p;
  return { uGradeOn: isIdentity(p) ? 0 : 1, uGWB: D.wb, uGCon: [D.k, D.pivot, D.f0, D.inv], uGSlope: p.slope, uGOffset: p.offset, uGPower: p.power, uGSat: p.sat,
    uGShadowT: D.shadowT, uGHighT: D.highT, uGBal: D.bal, uGFade: p.fade };
}

/* SVG filter for the HyperFrames DOM path: wrap any element in  style="filter:url(#id)". Same order as the reference, every stage exact:
   per-channel table (gain/WB, contrast, CDL) -> saturation matrix -> luma -> (shadow, highlight) weight tables -> positive / negative tint matrices -> add, and subtract via invert-add-invert (arithmetic with k3<0 would zero the alpha) -> fade (linear).
   Filter primitives clamp to 0..1 and quantise to 8 bits between stages, so expect ~1 level of drift, never a different look. */
export function toSVGFilter(pIn, id = 'mp-grade', n = 256) {
  const D = derive(pIn), p = D.p, tbl = (fn) => Array.from({ length: n }, (_, i) => fn(i / (n - 1)).toFixed(5)).join(' '), f5 = (a) => a.map((v) => v.toFixed(5)).join(' ');
  const ch = (c) => tbl((x) => curve(D, c, x)), s = p.sat, [r, g, b] = LUMA;
  const SAT = f5([r + s * (1 - r), g - s * g, b - s * b, 0, 0, r - s * r, g + s * (1 - g), b - s * b, 0, 0, r - s * r, g - s * g, b + s * (1 - b), 0, 0, 0, 0, 0, 1, 0]);
  const LW = f5([r, g, b, 0, 0, r, g, b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  const pos = (v) => Math.max(v, 0), neg = (v) => Math.max(-v, 0), tm = (fn) => f5([fn(D.shadowT[0]), fn(D.highT[0]), 0, 0, 0, fn(D.shadowT[1]), fn(D.highT[1]), 0, 0, 0, fn(D.shadowT[2]), fn(D.highT[2]), 0, 0, 0, 0, 0, 0, 1, 0]);
  const wS = tbl((x) => 1 - sstep(0, 0.55 + D.bal * 0.4, x)), wH = tbl((x) => sstep(0.45 + D.bal * 0.4, 1, x)), zero = tbl(() => 0);
  return `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">` +
    `<feComponentTransfer in="SourceGraphic" result="a"><feFuncR type="table" tableValues="${ch(0)}"/><feFuncG type="table" tableValues="${ch(1)}"/><feFuncB type="table" tableValues="${ch(2)}"/></feComponentTransfer>` +
    `<feColorMatrix in="a" type="matrix" values="${SAT}" result="b"/>` +
    `<feColorMatrix in="b" type="matrix" values="${LW}" result="lw"/>` +
    `<feComponentTransfer in="lw" result="w"><feFuncR type="table" tableValues="${wS}"/><feFuncG type="table" tableValues="${wH}"/><feFuncB type="table" tableValues="${zero}"/></feComponentTransfer>` +
    `<feColorMatrix in="w" type="matrix" values="${tm(pos)}" result="pp"/><feColorMatrix in="w" type="matrix" values="${tm(neg)}" result="pn"/>` +
    `<feComposite in="b" in2="pp" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="c1"/>` +
    `<feComponentTransfer in="c1" result="i1"><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>` +
    `<feComposite in="i1" in2="pn" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="i2"/>` +
    `<feComponentTransfer in="i2" result="c2"><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>` +
    `<feComponentTransfer in="c2"><feFuncR type="linear" slope="${(1 - p.fade).toFixed(5)}" intercept="${p.fade.toFixed(5)}"/><feFuncG type="linear" slope="${(1 - p.fade).toFixed(5)}" intercept="${p.fade.toFixed(5)}"/><feFuncB type="linear" slope="${(1 - p.fade).toFixed(5)}" intercept="${p.fade.toFixed(5)}"/></feComponentTransfer></filter>`;
}

/* .cube 3D LUT (ffmpeg lut3d, Resolve, Premiere): size^3, red fastest */
export function toCube(pIn, title = 'motion-pack', size = 33) {
  const P = prepare(pIn), out = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) out.push(gradeRGB(P, [r / (size - 1), g / (size - 1), b / (size - 1)]).map((v) => v.toFixed(6)).join(' '));
  return out.join('\n') + '\n';
}
/* trilinear lookup into a parsed cube (for tests) */
export function cubeLookup(text, rgb) {
  const L = text.split('\n'), size = Number(L.find((l) => l.startsWith('LUT_3D_SIZE')).split(' ')[1]), d = L.filter((l) => /^[-\d.]/.test(l)).map((l) => l.split(' ').map(Number));
  const at = (r, g, b) => d[r + g * size + b * size * size], f = rgb.map((v) => clamp(v) * (size - 1)), i = f.map((v) => Math.min(Math.floor(v), size - 2)), t = f.map((v, k) => v - i[k]);
  const o = [0, 0, 0];
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const w = (dx ? t[0] : 1 - t[0]) * (dy ? t[1] : 1 - t[1]) * (dz ? t[2] : 1 - t[2]), v = at(i[0] + dx, i[1] + dy, i[2] + dz); for (let k = 0; k < 3; k++) o[k] += w * v[k]; }
  return o;
}
