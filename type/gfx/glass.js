/* motion-pack / type / gfx / glass.js (xp-r78, 2026-10-16): the glass material and the edge light. Same gfx contract as every part (core.js):
   { tags, dur, inF, outF, d, svg(L, p, c) } -> SVG markup, a pure function of t (no module state, no cache, no clock).
     ui.glassPanel   a frosted-glass card for any box: the backdrop blurred behind it, a tint, a one-pixel bright edge, a soft shadow and a faint noise grain.
                     Two ways to get the blur, and they agree (tests compare them on the same picture):
                       mode 'backdrop' (default when no `plate`)  a <foreignObject> div with CSS backdrop-filter: blur() saturate(): it blurs WHATEVER the page already draws
                                       at t (a video, a canvas, another part). So it is a pure function of t exactly when everything behind it is. Needs a DOM host
                                       (mountGfx / HyperFrames), not an SVG blob drawn into a canvas.
                       mode 'plate'    (default when `plate` is given)  the SVG draws the backdrop itself: `plate` = { href } (an image) or { colors, angle } (a gradient),
                                       blurred by feGaussianBlur and clipped to the panel. Works anywhere an SVG draws (canvas, static .svg, any renderer).
                     The blur radius, the tint alpha, the edge alpha, the grain and the box are closed-form functions of t: `blurIn: [t0, t1]` (local s) resolves the glass from
                     a clear window to its full blur (the "glass rectangle resolves into a window" opening), the exit fades blur and tint together. The panel never sits under an
                     opacity group (an opacity < 1 ancestor stops backdrop-filter seeing what is behind it), so a fade-out is the blur and tint going to 0, not a group opacity.
                     Grain: feTurbulence seeded by floor(t * grainFps) (0 = one fixed seed): a pure function of t.
     ui.rimLight     an edge light that sweeps round a rounded window on a dark field: a hot head and a quadratic tail travel `turns` times round the rim on an eased curve
                     (angle = turns * ease((t - t0) / (t1 - t0)) from the chosen corner), a bloom outside the rim, an ambient colour bleed on the plate round the head, and a
                     resting glow that stays on once the sweep is done (the window that "drew itself with a glowing rim"). The rim is drawn as polyline runs of one stroke width
                     (constant in px while the angle changes), the intensity of each run read from its polar angle about the centre (a conic gradient, built from paths so it also
                     works in canvas and static SVG). rimContrast(p) is the WCAG ratio of the hot core against the field: the test requires >= 4.5.
   Both are generic: no product's look, no copy. The skeleton bars are shapes, not text; the default frame prints no number. */
import { E, clamp, lerp, seg, f2, text, esc, measure } from './core.js';
import { lum } from './core.js';
import { num, str, list, hex, obj, sc, rgbOf, mixHex, boxPx, rrPath, alive } from './r78-util.js';

const TAU = Math.PI * 2;
const rgba = (h, a) => { const [r, g, b] = rgbOf(h); return `rgba(${r},${g},${b},${f2(clamp(a))})`; };
const SAFE_HREF = /^(data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)[;,]|\/[^/\\]|\.\/|[A-Za-z0-9_-][A-Za-z0-9_./-]*\.(png|jpe?g|webp|gif|svg)$)/i;

/* ================================================================ ui.glassPanel ================================================================ */
const GLASS_D = { box: [0.3, 0.24, 0.4, 0.5], radius: 36, blur: 22, tint: '#FFFFFF', tintAlpha: 0.14, edge: '#FFFFFF', edgeAlpha: 0.6, edgeWidth: 1.5, shadow: 0.38, saturate: 1.45,
  blurIn: [0, 0.7], rise: 28, grain: 0.1, grainFps: 8, seed: 1, mode: 'auto', plate: null, skeleton: 3, label: '', accent: '#9EC5FF', ink: '#FFFFFF' };
/* the closed-form state at local time u (s): everything the panel draws is read from here (tests read it too) */
export function glassState(pIn, u, out = 0) {
  const p = obj(pIn), bi = list(p.blurIn, 2), b0 = num(bi[0], 0, 0, 600), b1 = Math.max(b0 + 1e-3, num(bi[1], 0.7, 0, 600)), kb = E.move(seg(u, b0, b1)), ex = 1 - E.exit(out);
  const ke = E.enter(seg(u, 0, 0.55));
  return { kBlur: kb, blur: num(p.blur, 22, 0, 40) * kb * ex, tintA: num(p.tintAlpha, 0.14, 0, 1) * lerp(0.35, 1, kb) * ex, edgeA: num(p.edgeAlpha, 0.6, 0, 1) * ke * ex, shadowA: num(p.shadow, 0.38, 0, 1) * ke * ex,
    grainA: num(p.grain, 0.1, 0, 1) * ke * ex, grainSeed: num(p.grainFps, 8, 0, 60) > 0 ? 1 + Math.floor(Math.max(0, u) * num(p.grainFps, 8, 0, 60) + 1e-6) % 997 : 1, ke, saturate: lerp(1, num(p.saturate, 1.45, 0.5, 3), kb), ex };
}
const modeOf = (p) => (p.mode === 'backdrop' || p.mode === 'plate' ? p.mode : p.plate ? 'plate' : 'backdrop');
const GLASS = { tags: ['glass', 'frosted', 'blur', 'panel', 'material', 'card', 'backdrop', 'ui', 'launch'], dur: 3.2, inF: 14, outF: 9, d: GLASS_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, G = glassState(p, u, L.out), [x0, y0, w0, h0] = boxPx(p.box, GLASS_D.box, c), r = num(p.radius, 36, 0, 400) * s, rise = num(p.rise, 28, -400, 400) * s;
    const sz = lerp(0.965, 1, G.ke), w = w0 * sz, h = h0 * sz, x = x0 + (w0 - w) / 2, y = y0 + (h0 - h) / 2 + (1 - G.ke) * rise, rr = r * sz;
    const tint = hex(p.tint, GLASS_D.tint), edge = hex(p.edge, GLASS_D.edge), acc = hex(p.accent, GLASS_D.accent), ink = hex(p.ink, GLASS_D.ink), mode = modeOf(p), ew = num(p.edgeWidth, 1.5, 0, 12) * s, B = G.blur * s;
    const D = rrPath(x, y, w, h, rr); let defs = `<clipPath id="gc"><path d="${D}"/></clipPath><filter id="gsh" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="${f2(22 * s)}"/></filter>` +
      `<linearGradient id="gse" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${edge}" stop-opacity="${f2(G.edgeA)}"/><stop offset="0.45" stop-color="${edge}" stop-opacity="${f2(G.edgeA * 0.28)}"/><stop offset="1" stop-color="${edge}" stop-opacity="${f2(G.edgeA * 0.55)}"/></linearGradient>` +
      `<linearGradient id="gsh2" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="${f2(0.2 * G.tintA / Math.max(0.05, num(p.tintAlpha, 0.14, 0.05, 1)))}"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;
    let out = '';
    if (G.shadowA > 0.002) out += `<g opacity="${f2(0.5 * G.shadowA)}" filter="url(#gsh)"><path d="${D}" transform="translate(0 ${f2(16 * s)})" fill="#000000"/></g>`;
    if (mode === 'backdrop') {
      const bf = B > 0.05 || G.saturate !== 1 ? `blur(${f2(B)}px) saturate(${f2(G.saturate)})` : 'none';
      out += `<foreignObject x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;box-sizing:border-box;border-radius:${f2(rr)}px;background:${rgba(tint, G.tintA)};-webkit-backdrop-filter:${bf};backdrop-filter:${bf}"></div></foreignObject>`;
    } else {
      const pl = obj(p.plate), W = c.W, H = c.H, m = B * 3 + 4, href = typeof pl.href === 'string' && SAFE_HREF.test(pl.href.trim()) ? pl.href.trim() : '';
      defs += `<filter id="gbl" filterUnits="userSpaceOnUse" x="${f2(x - m)}" y="${f2(y - m)}" width="${f2(w + 2 * m)}" height="${f2(h + 2 * m)}"><feGaussianBlur stdDeviation="${f2(Math.max(0.01, B))}" edgeMode="duplicate"/>` +
        `<feColorMatrix type="saturate" values="${f2(G.saturate)}"/></filter>`;
      let back;
      if (href) back = `<image href="${esc(href)}" x="0" y="0" width="${f2(W)}" height="${f2(H)}" preserveAspectRatio="xMidYMid slice"/>`;
      else { const cols = list(pl.colors, 6).map((q) => hex(q, '')).filter(Boolean), cc = cols.length >= 2 ? cols : ['#2B3A67', '#7A5FD1', '#E58FB4'], a = num(pl.angle, 135, -720, 720) * Math.PI / 180, dx = Math.cos(a) / 2, dy = Math.sin(a) / 2;
        defs += `<linearGradient id="gpl" gradientUnits="objectBoundingBox" x1="${f2(0.5 - dx)}" y1="${f2(0.5 - dy)}" x2="${f2(0.5 + dx)}" y2="${f2(0.5 + dy)}">${cc.map((q, i) => `<stop offset="${f2(i / (cc.length - 1))}" stop-color="${q}"/>`).join('')}</linearGradient>`;
        back = `<rect x="0" y="0" width="${f2(W)}" height="${f2(H)}" fill="url(#gpl)"/>`; }
      out += `<g clip-path="url(#gc)"><g filter="url(#gbl)">${back}</g><path d="${D}" fill="${rgba(tint, G.tintA)}"/></g>`;
    }
    out += `<path d="${D}" fill="url(#gsh2)"/>`;
    if (G.grainA > 0.002) { defs += `<filter id="gn" filterUnits="userSpaceOnUse" x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${G.grainSeed + Math.round(num(p.seed, 1, 0, 1e6))}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.7 0 0 0 -0.62"/></filter>`;
      out += `<g clip-path="url(#gc)" opacity="${f2(G.grainA)}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" filter="url(#gn)"/></g>`; }
    if (G.edgeA > 0.002 && ew > 0) out += `<path d="${D}" fill="none" stroke="url(#gse)" stroke-width="${f2(ew)}"/>`;
    /* content: placeholder skeleton bars (shapes only) and an optional label */
    const n = Math.round(num(p.skeleton, 3, 0, 8)), pad = Math.min(w, h) * 0.09, lab = str(p.label, '', 60);
    if (n > 0 || lab) { const col = rgba(ink, 0.55 * G.ex);
      if (lab) out += text(lab, x + pad, y + pad + 22 * s, { size: 26 * s, weight: 700, fill: ink, op: clamp(G.ke * G.ex * 0.9) });
      for (let i = 0; i < n; i++) { const k = E.enter(seg(u, 0.25 + i * 0.12, 0.7 + i * 0.12)) * G.ex, bh = Math.min(22 * s, h * 0.05), yy = y + pad + (lab ? 46 * s : 0) + i * bh * 2.1, ww = (w - 2 * pad) * (i === 0 ? 0.55 : 1 - ((i * 37) % 5) * 0.09);
        if (k > 0.01 && yy + bh < y + h - pad) out += `<rect x="${f2(x + pad)}" y="${f2(yy)}" width="${f2(ww * k)}" height="${f2(bh)}" rx="${f2(bh / 2)}" fill="${i === 0 ? acc : col}" opacity="${i === 0 ? f2(0.8 * G.ex) : 1}"/>`; } }
    return `<defs>${defs}</defs>` + out;
  } };

/* ================================================================ ui.rimLight ================================================================ */
const RIM_D = { box: [0.3, 0.26, 0.4, 0.48], radius: 40, color: '#FF4A5E', width: 3, sweep: [0.2, 1.8, 1], tail: 0.3, rest: 0.4, bloom: 1, bleed: 0.6, corner: 'tl', fill: '#0D0F16', fillAlpha: 0.92, field: '#06070B', segments: 180 };
const CORNER = { tl: [-1, -1], tr: [1, -1], br: [1, 1], bl: [-1, 1] };
/* a point on the rounded-rect perimeter at arclength s (clockwise from the top-left end of the top edge) -> [x, y] */
export function perimeterAt(x, y, w, h, r, s) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2)), top = w - 2 * q, side = h - 2 * q, arc = (Math.PI / 2) * q, per = 2 * top + 2 * side + 4 * arc; let d = ((s % per) + per) % per;
  if (d < top) return [x + q + d, y]; d -= top;
  if (d < arc) { const a = d / (q || 1); return [x + w - q + Math.sin(a) * q, y + q - Math.cos(a) * q]; } d -= arc;
  if (d < side) return [x + w, y + q + d]; d -= side;
  if (d < arc) { const a = d / (q || 1); return [x + w - q + Math.cos(a) * q, y + h - q + Math.sin(a) * q]; } d -= arc;
  if (d < top) return [x + w - q - d, y + h]; d -= top;
  if (d < arc) { const a = d / (q || 1); return [x + q - Math.sin(a) * q, y + h - q + Math.cos(a) * q]; } d -= arc;
  if (d < side) return [x, y + h - q - d]; d -= side;
  const a = d / (q || 1); return [x + q - Math.cos(a) * q, y + q - Math.sin(a) * q];
}
export const perimeterLen = (w, h, r) => { const q = Math.max(0, Math.min(r, w / 2, h / 2)); return 2 * (w - 2 * q) + 2 * (h - 2 * q) + 2 * Math.PI * q; };
/* the sweep at local time u: the head's polar angle (rad, unwrapped, clockwise from `corner`), the head's envelope (0..1) and the resting glow (0..1) */
export function rimState(pIn, u, geom = { w: 1, h: 1 }) {
  const p = obj(pIn), sw = list(p.sweep, 3), t0 = num(sw[0], 0.2, 0, 1e4), t1 = Math.max(t0 + 0.02, num(sw[1], 1.8, 0, 1e4)), turns = num(sw[2], 1, -16, 16), cn = CORNER[p.corner] || CORNER.tl;
  const a0 = Math.atan2(cn[1] * geom.h, cn[0] * geom.w), k = E.move(seg(u, t0, t1)), head = a0 + turns * TAU * k;
  const env = seg(u, t0 - 0.05, t0 + 0.12) * (1 - seg(u, t1, t1 + 0.35)), rest = num(p.rest, 0.4, 0, 1) * E.enter(seg(u, t0 + (t1 - t0) * 0.6, t1 + 0.5)) * 1;
  return { head, env, rest, k, t0, t1 };
}
/* the intensity of the rim at polar angle phi (rad) for a head at `head`: a quadratic tail behind the head, a short soft lead in front of it */
export function rimIntensity(phi, head, tail) {
  const d = ((head - phi) % TAU + TAU) % TAU, tl = Math.max(0.05, tail) * TAU;
  if (d <= tl) return (1 - d / tl) ** 2;
  const f = TAU - d; return f < 0.06 ? 1 - f / 0.06 : 0;
}
const HOT = '#FFFFFF';
/* WCAG contrast of the hot core (the colour at its brightest, mixed towards white) against the field */
export function rimContrast(pIn) {
  const p = obj(pIn), hot = mixHex(hex(p.color, RIM_D.color), HOT, 0.72), field = hex(p.field, RIM_D.field), a = lum(hot), b = lum(field);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const RIM = { tags: ['rim', 'light', 'edge', 'glow', 'sweep', 'bloom', 'window', 'dark', 'ui', 'launch'], dur: 3.6, inF: 6, outF: 9, d: RIM_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, [x, y, w, h] = boxPx(p.box, RIM_D.box, c), r = num(p.radius, 40, 0, 400) * s, ww = Math.max(0.5, num(p.width, 3, 0.5, 40) * s), N = Math.round(num(p.segments, 180, 24, 480)), Q = 20;
    const col = hex(p.color, RIM_D.color), hot = mixHex(col, HOT, 0.72), st = rimState(p, u, { w, h }), tail = num(p.tail, 0.3, 0.05, 0.95), ex = alive(L), cx = x + w / 2, cy = y + h / 2, per = perimeterLen(w, h, r);
    const bloom = num(p.bloom, 1, 0, 3), bleed = num(p.bleed, 0.6, 0, 2), fillA = num(p.fillAlpha, 0.92, 0, 1) * E.enter(seg(u, 0, 0.35)) * ex, restA = st.rest * ex;
    const pts = Array.from({ length: N + 1 }, (_, i) => perimeterAt(x, y, w, h, r, (i / N) * per)), lvl = [], lvlHot = [], lvlHead = [];
    for (let i = 0; i < N; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2, ph = Math.atan2(my - cy, mx - cx), I = rimIntensity(ph, st.head, tail) * st.env, A = clamp(Math.max(restA, I) * ex);
      lvl.push(Math.round(A * Q)); lvlHead.push(Math.round(clamp(I * ex) * Q)); lvlHot.push(I > 0.45 ? Math.round(clamp((I - 0.45) / 0.55) * Q * ex) : 0); }
    const runs = (levels, color, width, opMul = 1) => { let o = ''; for (let q = 1; q <= Q; q++) { let d = '', open = false;
        for (let i = 0; i < N; i++) { if (levels[i] === q) { d += open ? `L${f2(pts[i + 1][0])} ${f2(pts[i + 1][1])}` : `M${f2(pts[i][0])} ${f2(pts[i][1])}L${f2(pts[i + 1][0])} ${f2(pts[i + 1][1])}`; open = true; } else open = false; }
        if (d) o += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f2(width)}" stroke-opacity="${f2((q / Q) * opMul)}"/>`; } return o; };
    const hp = [cx + Math.cos(st.head) * Math.max(w, h), cy + Math.sin(st.head) * Math.max(w, h)], hI = st.env, headPt = (() => { let best = pts[0], bd = 1e18; for (const q of pts) { const d = Math.hypot(q[0] - hp[0], q[1] - hp[1]); if (d < bd) { bd = d; best = q; } } return best; })();
    let defs = `<filter id="rb" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="${f2(ww * 2.6)}"/></filter><filter id="rbl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f2(Math.min(w, h) * 0.12)}"/></filter>` +
      `<radialGradient id="rg" cx="${f2(headPt[0])}" cy="${f2(headPt[1])}" r="${f2(Math.max(w, h) * 0.8)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${col}" stop-opacity="${f2(0.5 * bleed * hI * ex)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
    let out = '';
    if (bleed > 0 && (hI > 0.01 || restA > 0.01)) out += `<g style="mix-blend-mode:screen"><rect x="0" y="0" width="${f2(c.W)}" height="${f2(c.H)}" fill="url(#rg)"/><g filter="url(#rbl)" opacity="${f2(0.22 * bleed * restA)}"><path d="${rrPath(x, y, w, h, r)}" fill="${col}"/></g></g>`;
    if (fillA > 0.002) out += `<path d="${rrPath(x, y, w, h, r)}" fill="${hex(p.fill, RIM_D.fill)}" fill-opacity="${f2(fillA)}"/>`;
    if (bloom > 0) out += `<g style="mix-blend-mode:screen" filter="url(#rb)" opacity="${f2(clamp(0.85 * bloom))}">${runs(lvlHead, col, ww * 3.2)}</g>`;
    out += `<g>${runs(lvl, col, ww)}${runs(lvlHot, hot, ww * 0.62)}</g>`;
    return `<defs>${defs}</defs>` + out;
  } };

export const GLASS_GFX = { 'ui.glassPanel': GLASS, 'ui.rimLight': RIM };
for (const g of Object.values(GLASS_GFX)) g.file = 'type/gfx/glass.js';
/* per-action sounds (gfxCues): local seconds; the plan adds `at` */
export const GLASS_CUES = {
  'ui.glassPanel': (p) => { const bi = list(p.blurIn, 2); return [{ t: Math.max(0, num(bi[0], 0, 0, 600) + (num(bi[1], 0.7, 0, 600) - num(bi[0], 0, 0, 600)) * 0.35), id: 'sfx/ui/pop', why: 'the glass resolves from clear to frosted' }]; },
  'ui.rimLight': (p) => { const sw = list(p.sweep, 3), t0 = num(sw[0], 0.2, 0, 1e4), t1 = Math.max(t0 + 0.02, num(sw[1], 1.8, 0, 1e4)); return [{ t: +((t0 + t1) / 2).toFixed(4), id: 'sfx/hw/light_sweep', why: 'the light at the middle of its sweep (the sweep sound peaks on its own midpoint)' }]; },
};
