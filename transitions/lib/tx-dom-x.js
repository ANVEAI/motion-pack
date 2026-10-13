/* motion-pack / transitions / lib / tx-dom-x.js
   DOM expansion (2026-10-13), merged by tx-dom.js.
   DOM_X:  real DOM back-ends (clip-path, CSS masks, CSS 3D) for 10 of the new transitions.
   APPROX: a DOM *approximation* for every GL-only key, so HyperFrames DOM templates no longer hard-cut on them.
           Each entry is either { via, params(P) } (run another DOM back-end with mapped params) or { fn(p, c) }.
           They keep the timing, the swap frame and the sound of the GL version; the look is simpler (no mirrored edges,
           no per-pixel noise). The catalog marks them `dom~` (approx). Use tx-gl.js on canvas sources when the exact look matters.
   Everything is a pure function of p (and seeded hashes of p), so it stays seek-safe. */
import { ease } from './tx-core.js';

const show = (el, on) => { el.style.opacity = on ? '1' : '0'; };
const pct = v => (v * 100).toFixed(4) + '%';
const W = el => el.clientWidth || el.getBoundingClientRect().width, H = el => el.clientHeight || el.getBoundingClientRect().height;
const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const setMask = (el, img, size = null, pos = null, rep = null) => { el.style.webkitMaskImage = img; el.style.maskImage = img;
  if (size) { el.style.webkitMaskSize = size; el.style.maskSize = size; } if (pos) { el.style.webkitMaskPosition = pos; el.style.maskPosition = pos; }
  if (rep) { el.style.webkitMaskRepeat = rep; el.style.maskRepeat = rep; } };
/* union of full-height (or full-width) bands as ONE polygon: the connectors run along an edge, so they enclose no area */
export function bandsPoly(bands, horizontalBands = false) {
  const pts = [];
  for (const [l, r] of bands) pts.push(...(horizontalBands ? [[1, l], [0, l], [0, r], [1, r]] : [[l, 1], [l, 0], [r, 0], [r, 1]]));
  if (!pts.length) return 'polygon(0 0, 0 0, 0 0)';
  return `polygon(${pts.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(',')})`;
}
const half = (p, cut, e, eCut) => (p < cut ? 1 - e / Math.max(eCut, 1e-4) : (e - eCut) / Math.max(1 - eCut, 1e-4));

export const DOM_X = {
  cube(p, c) { const { a, b, P, e, root } = c, w = W(root), o = `50% 50% ${(-w / 2).toFixed(1)}px`, z = 1 + P.zoom * Math.sin(Math.PI * p);
    root.style.perspective = `${(P.persp * w).toFixed(0)}px`; root.style.background = P.bg;
    for (const el of [a, b]) { el.style.transformOrigin = o; el.style.backfaceVisibility = 'hidden'; }
    a.style.transform = `scale(${(1 / z).toFixed(5)}) rotateY(${(-90 * e).toFixed(3)}deg)`; b.style.transform = `scale(${(1 / z).toFixed(5)}) rotateY(${(90 * (1 - e)).toFixed(3)}deg)`;
    a.style.filter = `brightness(${(1 - P.shade * (1 - Math.cos(e * Math.PI / 2))).toFixed(4)})`; b.style.filter = `brightness(${(1 - P.shade * (1 - Math.sin(e * Math.PI / 2))).toFixed(4)})`;
    show(a, true); show(b, true); b.style.zIndex = '2'; },
  windowSlice(p, c) { const { a, b, P, e } = c, n = Math.round(P.count), bands = [];
    for (let i = 0; i < n; i++) { const x = (i + 0.5) / n, pr = sm(-P.soft, 0, x - e * (1 + P.soft)), wd = (1 - pr) / n; if (wd > 1e-5) bands.push([(i + 1) / n - wd, (i + 1) / n]); }
    show(a, true); show(b, true); b.style.zIndex = '2'; b.style.clipPath = bandsPoly(bands, P.vertical); },
  blinds(p, c) { const { a, b, P, e, cut, root } = c, n = Math.round(P.count), k = Math.min(1, Math.max(0, half(p, cut, e, ease('inOutQuad', cut)))), on = p < cut ? a : b, bands = [];
    for (let i = 0; i < n; i++) { const m = (i + 0.5) / n, hw = k / n / 2; if (hw > 1e-5) bands.push([m - hw, m + hw]); }
    show(a, p < cut); show(b, p >= cut); root.style.background = P.gap; on.style.clipPath = bandsPoly(bands, !P.vertical);
    on.style.filter = `brightness(${(1 - P.shade * 0.45 * (1 - k)).toFixed(4)})`; },
  squeeze(p, c) { const { a, b, P, e, cut, root } = c, k = Math.min(1, Math.max(0, half(p, cut, e, ease('inOutQuad', cut)))), on = p < cut ? a : b;
    show(a, p < cut); show(b, p >= cut); root.style.background = '#000';
    on.style.transform = P.vertical ? `scaleX(${Math.max(k, 0.002).toFixed(5)})` : `scaleY(${Math.max(k, 0.002).toFixed(5)})`;
    on.style.filter = `brightness(${(1 + 0.8 * (1 - k)).toFixed(4)})`; },
  polkaDots(p, c) { const { a, b, P, e, root } = c, cell = H(root) / P.dots, r = e * cell * 0.75;
    show(a, true); show(b, true); b.style.zIndex = '2';
    setMask(b, `radial-gradient(circle at 50% 50%, #000 ${r.toFixed(2)}px, transparent ${(r + 1 + P.soft * cell).toFixed(2)}px)`, `${cell.toFixed(2)}px ${cell.toFixed(2)}px`, 'center', 'repeat'); },
  dreamyZoom(p, c) { const { a, b, P, e } = c, s = x => 1 + (P.scale - 1) * x;
    a.style.transform = `rotate(${(P.rot * e).toFixed(3)}deg) scale(${s(e).toFixed(5)})`; b.style.transform = `rotate(${(-P.rot * (1 - e)).toFixed(3)}deg) scale(${s(1 - e).toFixed(5)})`;
    const g = `brightness(${(1 + P.glow * Math.sin(Math.PI * e)).toFixed(4)})`; a.style.filter = g; b.style.filter = g;
    show(a, true); b.style.opacity = sm(0.3, 0.7, e).toFixed(4); b.style.zIndex = '2'; },
  linearBlur(p, c) { const { a, b, P, e, root, ov } = c, r = P.amount * H(root) * Math.sin(Math.PI * p) * 0.3, an = P.angle * Math.PI / 180;
    ov.querySelector('feGaussianBlur').setAttribute('stdDeviation', `${Math.abs(r * Math.cos(an)).toFixed(2)} ${Math.abs(r * Math.sin(an)).toFixed(2)}`);
    const url = `url(#${ov.dataset.uid}-dblur)`; a.style.filter = url; b.style.filter = url; show(a, true); b.style.opacity = sm(0.35, 0.65, e).toFixed(4); b.style.zIndex = '2'; },
  pinwheel(p, c) { const { a, b, P, e } = c, seg = 360 / P.blades, x = e * seg, f = P.soft * seg;
    show(a, true); show(b, true); b.style.zIndex = '2';
    setMask(b, e >= 0.999 ? 'none' : `repeating-conic-gradient(from 180deg at ${pct(P.center[0])} ${pct(P.center[1])}, #000 0deg ${Math.max(0, x - f).toFixed(3)}deg, transparent ${(x + f).toFixed(3)}deg ${seg.toFixed(3)}deg)`); },
  radial(p, c) { const { a, b, P, e } = c, deg = e * 360, f = P.soft * 360, at = `at ${pct(P.center[0])} ${pct(P.center[1])}`;
    show(a, true); show(b, true); b.style.zIndex = '2';
    setMask(b, P.ccw ? `conic-gradient(from ${P.start}deg ${at}, transparent 0deg ${Math.max(0, 360 - deg - f).toFixed(3)}deg, #000 ${(360 - deg).toFixed(3)}deg)`
      : `conic-gradient(from ${P.start}deg ${at}, #000 0deg ${Math.max(0, deg - f).toFixed(3)}deg, transparent ${deg.toFixed(3)}deg)`); },
  overexposure(p, c) { const { a, b, P, cut, ov } = c, k = (p < cut ? Math.sin(Math.PI * 0.5 * p / cut) ** 2 : Math.sin(Math.PI * 0.5 * (1 - p) / (1 - cut)) ** 2) * P.strength, f = ov.querySelector('.mptx-fill');
    show(a, p < cut); show(b, p >= cut); (p < cut ? a : b).style.filter = `brightness(${(1 + 3 * k).toFixed(4)}) saturate(${(1 - 0.5 * k).toFixed(4)})`;
    f.style.background = P.tint; f.style.opacity = (k * k * 0.85).toFixed(4); },
};

/* custom approximations for GL-only looks */
const FN = {
  glitch(p, c) { const { a, b, P, cut, ov } = c, on = p < cut ? a : b, bell = Math.sin(Math.PI * p), q = Math.floor(p * 12 * Math.max(1, P.quantFps / 12)), box = ov.querySelector('.mptx-bars');
    show(a, p < cut); show(b, p >= cut); on.style.transform = `translateX(${((hash(q) - 0.5) * 2 * P.sliceShift * bell * 100).toFixed(3)}%)`;
    on.style.filter = `hue-rotate(${((hash(q + 9) - 0.5) * 60 * bell).toFixed(2)}deg) contrast(${(1 + 0.4 * bell).toFixed(3)})`;
    const n = Math.round(P.slices); if (box.children.length !== n) { box.innerHTML = ''; for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;right:0;mix-blend-mode:screen'; box.appendChild(d); } }
    for (let i = 0; i < n; i++) { const d = box.children[i], y = hash(q * 31 + i), h = 0.01 + 0.05 * hash(q * 17 + i);
      Object.assign(d.style, { top: pct(y), height: pct(h), background: i % 2 ? '#00ffe0' : '#ff1e5a', opacity: (bell * 0.55 * (hash(q + i * 3) > 0.4 ? 1 : 0)).toFixed(3), transform: `translateX(${((hash(i + q) - 0.5) * 20).toFixed(2)}%)` }); } },
  filmBurn(p, c) { const { a, b, P, e, ov } = c, f = ov.querySelector('.mptx-fill'), bell = Math.sin(Math.PI * p) ** 1.5, fl = 0.85 + 0.15 * hash(Math.floor(p * P.flicker));
    const x = { left: '0% 50%', right: '100% 50%', top: '50% 0%', bottom: '50% 100%' }[P.from] || '50% 50%';
    show(a, true); b.style.opacity = sm(0.35, 0.65, e).toFixed(4); b.style.zIndex = '2';
    f.style.background = `radial-gradient(ellipse 90% 120% at ${x}, ${P.core} 0%, ${P.rim} 45%, ${P.char}00 80%)`; f.style.mixBlendMode = 'screen'; f.style.opacity = (bell * fl).toFixed(4); },
  lightLeak(p, c) { const { a, b, P, e, ov } = c, f = ov.querySelector('.mptx-fill'), bell = Math.sin(Math.PI * p) ** 2;
    show(a, true); b.style.opacity = sm(0.3, 0.7, e).toFixed(4); b.style.zIndex = '2';
    f.style.background = `linear-gradient(${(100 + 40 * p * P.drift).toFixed(1)}deg, ${P.c1}00 0%, ${P.c1} 30%, ${P.c2} 55%, ${P.c3} 75%, ${P.c3}00 100%)`; f.style.mixBlendMode = 'screen'; f.style.opacity = (bell * P.intensity).toFixed(4); },
  zoomThrough(p, c) { const { a, b, P, e, cut } = c, o = `${pct(P.center[0])} ${pct(P.center[1])}`;
    show(a, p < cut); show(b, p >= cut); a.style.transformOrigin = o; b.style.transformOrigin = o;
    if (p < cut) { const k = e / Math.max(ease('inOutCubic', cut), 1e-4); a.style.transform = `scale(${(1 + (P.scaleOut - 1) * k * k).toFixed(4)})`; a.style.filter = `blur(${(P.radialBlur * 12 * k).toFixed(2)}px)`; }
    else { const k = (p - cut) / (1 - cut); b.style.transform = `scale(${(P.scaleIn + (1 - P.scaleIn) * ease('outCubic', k)).toFixed(4)})`; b.style.filter = `blur(${(P.radialBlur * 10 * (1 - k)).toFixed(2)}px)`; } },
  pagePeel(p, c) { const { a, b, e } = c, s = 2 - e * 2.02;   /* A keeps the region x + y <= s; the diagonal travels in from the bottom-right corner */
    show(a, true); show(b, true); a.style.zIndex = '2';
    a.style.clipPath = s >= 1 ? `polygon(0 0, 100% 0, 100% ${pct(s - 1)}, ${pct(s - 1)} 100%, 0 100%)` : `polygon(0 0, ${pct(Math.max(0, s))} 0, 0 ${pct(Math.max(0, s))})`;
    a.style.filter = 'drop-shadow(-12px -12px 18px rgba(0,0,0,0.45))'; },
  tvStatic(p, c) { const { a, b, P, cut, ov } = c, f = ov.querySelector('.mptx-fill'), a0 = cut - P.hold / 2, a1 = cut + P.hold / 2, q = Math.floor(p * 30);
    show(a, p < cut); show(b, p >= cut); const on = p > a0 && p < a1;
    f.style.background = `repeating-linear-gradient(${(hash(q) * 180).toFixed(1)}deg, #222 0px, #ddd ${(1 + hash(q + 1) * 2).toFixed(2)}px, #555 ${(3 + hash(q + 2) * 3).toFixed(2)}px), #888`;
    f.style.opacity = on ? (0.85 + 0.15 * hash(q + 5)).toFixed(3) : '0'; },
  doorway(p, c) { const { a, b, P, e, root } = c, h = e * 0.5;
    show(a, true); show(b, true); a.style.zIndex = '2'; root.style.background = P.bg;
    a.style.clipPath = bandsPoly([[0, 0.5 - h], [0.5 + h, 1]]); a.style.filter = `brightness(${(1 - 0.5 * e).toFixed(4)})`;
    b.style.transform = `scale(${(P.depth + (1 - P.depth) * e).toFixed(5)})`; },
};
const ang = d => Math.atan2(d[1], d[0]) * 180 / Math.PI;
export const APPROX = {
  glitch: { fn: FN.glitch }, filmBurn: { fn: FN.filmBurn }, lightLeak: { fn: FN.lightLeak }, zoomThrough: { fn: FN.zoomThrough },
  pagePeel: { fn: FN.pagePeel }, tvStatic: { fn: FN.tvStatic }, doorway: { fn: FN.doorway },
  ink: { via: 'lumaWipe', params: P => ({ matte: 'radial', softness: 0.4, center: P.center }) },
  morph: { via: 'dreamyZoom', params: () => ({ rot: 0, scale: 1.08, glow: 0.1 }) },
  maskReveal: { via: 'iris', params: P => ({ shape: 'circle', center: P.anchor[0] < 0 ? [0.5, 0.5] : P.anchor, softness: 0.02 }) },
  pixelSort: { via: 'windowSlice', params: P => ({ count: 24, soft: 0.3, vertical: Math.abs(P.dir[1]) > Math.abs(P.dir[0]) }) },
  ripple: { via: 'dreamyZoom', params: () => ({ rot: 0, scale: 1.06, glow: 0.15 }) },
  swirl: { via: 'spin', params: P => ({ turns: Math.min(1, P.turns), center: P.center }) },
  crossWarp: { via: 'dreamyZoom', params: () => ({ rot: 0, scale: 1.15, glow: 0 }) },
  directionalWarp: { via: 'lumaWipe', params: P => ({ matte: 'linear', angle: ang(P.dir), softness: 0.35 }) },
  kaleido: { via: 'spin', params: () => ({ turns: 0.5 }) },
  hexagonalize: { via: 'blurCross', params: () => ({ radius: 0.04 }) },
  burnOut: { via: 'lumaWipe', params: P => ({ matte: 'radial', softness: 0.25, center: P.center }) },
  waterDrop: { via: 'iris', params: P => ({ shape: 'circle', center: P.center, softness: 0.05 }) },
  wind: { via: 'lumaWipe', params: P => ({ matte: 'linear', angle: ang(P.dir), softness: 0.3 }) },
  luminanceMelt: { via: 'dissolve', params: () => ({ mode: 'film' }) },
  gridFlip: { via: 'windowSlice', params: P => ({ count: Math.round(P.grid[0]), soft: 0.6 }) },
  bookFlip: { via: 'cube', params: () => ({ persp: 2.4, zoom: 0.1 }) },
};
export const APPROX_KEYS = Object.keys(APPROX);
